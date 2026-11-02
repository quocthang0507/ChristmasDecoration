(() => {
  const DRAFT_KEY = 'cd.santa.draft.v1';
  // Light obfuscation so a glance at the link doesn't spoil the surprise (not encryption).
  const MASK = 'ho-ho-ho-merry-christmas';

  const $ = (id) => document.getElementById(id);
  const elSetup = $('santa-setup');
  const elReveal = $('santa-reveal');
  const elEvent = /** @type {HTMLInputElement|null} */ ($('santa-event'));
  const elBudget = /** @type {HTMLInputElement|null} */ ($('santa-budget'));
  const elDate = /** @type {HTMLInputElement|null} */ ($('santa-date'));
  const elNames = /** @type {HTMLTextAreaElement|null} */ ($('santa-names'));
  const elExclude = /** @type {HTMLTextAreaElement|null} */ ($('santa-exclude'));
  const elDraw = $('santa-draw');
  const elStatus = $('santa-status');
  const elResults = $('santa-results');
  const elList = $('santa-list');
  const elCopyAll = $('santa-copy-all');

  function setStatus(text) {
    if (elStatus) elStatus.textContent = text;
  }

  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach((b, i) => {
      bin += String.fromCharCode(b ^ MASK.charCodeAt(i % MASK.length));
    });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(str) {
    try {
      const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(bin, (c, i) => c.charCodeAt(0) ^ MASK.charCodeAt(i % MASK.length));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  function parseNames(text) {
    const seen = new Set();
    const out = [];
    for (const line of String(text || '').split(/\n|,/)) {
      const name = line.trim().slice(0, 40);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }

  // "An - Bình" per line: these two never draw each other.
  function parseExclusions(text) {
    const pairs = new Set();
    for (const line of String(text || '').split('\n')) {
      const [a, b] = line.split(/\s*[-–,&+]\s*/).map((s) => s.trim().toLowerCase());
      if (a && b) {
        pairs.add(`${a}|${b}`);
        pairs.add(`${b}|${a}`);
      }
    }
    return pairs;
  }

  function shuffle(arr) {
    const a = arr.slice();
    const rnd = new Uint32Array(a.length);
    crypto.getRandomValues(rnd);
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd[i] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Random assignment giver → receiver with no self-draws and no excluded pairs. */
  function draw(names, exclusions) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const receivers = shuffle(names);
      const ok = names.every((g, i) => {
        const r = receivers[i];
        return g !== r && !exclusions.has(`${g.toLowerCase()}|${r.toLowerCase()}`);
      });
      if (ok) return names.map((g, i) => ({ giver: g, receiver: receivers[i] }));
    }
    return null;
  }

  function linkFor(pair, meta) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = `r=${encode({ g: pair.giver, r: pair.receiver, ...meta })}`;
    return url.toString();
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      window.prompt('Copy:', text);
      return false;
    }
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function saveDraft(draft) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }

  function readMeta() {
    return {
      e: String(elEvent?.value || '').trim().slice(0, 60),
      b: String(elBudget?.value || '').trim().slice(0, 30),
      d: String(elDate?.value || ''),
    };
  }

  function renderResults(links) {
    if (!elList || !elResults) return;
    elList.innerHTML = '';
    for (const { giver, url } of links) {
      const li = document.createElement('li');
      li.className = 'santa__item';
      const name = document.createElement('span');
      name.className = 'santa__item-name';
      name.textContent = giver;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'santa__btn santa__btn--mini';
      btn.textContent = 'Copy link';
      btn.addEventListener('click', async () => {
        await copy(url);
        btn.textContent = 'Đã copy ✓';
        li.classList.add('is-copied');
      });
      li.append(name, btn);
      elList.appendChild(li);
    }
    elResults.hidden = !links.length;
    if (elCopyAll) {
      elCopyAll.onclick = async () => {
        const text = links.map((l) => `🎅 ${l.giver}: ${l.url}`).join('\n');
        if (await copy(text)) setStatus('Đã copy tất cả link — gửi riêng từng người nhé!');
      };
    }
  }

  function onDraw() {
    const names = parseNames(elNames?.value);
    if (names.length < 3) {
      setStatus('Cần ít nhất 3 người tham gia.');
      return;
    }
    const pairs = draw(names, parseExclusions(elExclude?.value));
    if (!pairs) {
      setStatus('Không bốc được với các cặp loại trừ này — hãy bớt điều kiện.');
      return;
    }
    const meta = readMeta();
    const links = pairs.map((p) => ({ giver: p.giver, url: linkFor(p, meta) }));
    saveDraft({ names: elNames?.value || '', exclude: elExclude?.value || '', ...meta, links });
    renderResults(links);
    setStatus(`Đã bốc thăm cho ${names.length} người. Đừng mở link của người khác 🤫`);
    window.CD_Scene?.triggerBoost({ durationMs: 2400, strength: 0.7 });
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Scratch card: drag to clear a silver foil drawn over the receiver's name.
  function initScratch(canvas, onDone) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      onDone();
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const g = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    g.addColorStop(0, '#9aa3ad');
    g.addColorStop(0.5, '#e4e8ec');
    g.addColorStop(1, '#8c949e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = 'rgba(40,46,56,0.8)';
    ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ Cào ở đây ✨', rect.width / 2, rect.height / 2);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 34;

    let drawing = false;
    let last = null;
    let moves = 0;
    let finished = false;

    function point(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function clearedRatio() {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 4 * 16) {
        total++;
        if (data[i] === 0) clear++;
      }
      return total ? clear / total : 1;
    }

    function finish() {
      if (finished) return;
      finished = true;
      canvas.classList.add('is-cleared');
      onDone();
    }

    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      last = point(e);
      canvas.setPointerCapture?.(e.pointerId);
      ctx.beginPath();
      ctx.arc(last.x, last.y, 17, 0, Math.PI * 2);
      ctx.fill();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing || !last) return;
      const p = point(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      if (++moves % 12 === 0 && clearedRatio() > 0.45) finish();
    });

    const end = () => {
      drawing = false;
      last = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    // Keyboard / accessibility fallback.
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish();
      }
    });
  }

  function showReveal(data) {
    if (elSetup) elSetup.hidden = true;
    if (elReveal) elReveal.hidden = false;
    $('santa-hello').textContent = `Chào ${data.g}! 🎅`;
    $('santa-target').textContent = data.r;
    $('santa-event-name').textContent = data.e || 'Secret Santa';
    const details = [];
    if (data.b) details.push(`💰 Ngân sách: ${data.b}`);
    const when = formatDate(data.d);
    if (when) details.push(`📅 Trao quà: ${when}`);
    $('santa-details').textContent = details.join('\n');

    const canvas = /** @type {HTMLCanvasElement} */ ($('santa-scratch'));
    initScratch(canvas, () => {
      $('santa-after').hidden = false;
      window.CD_Scene?.triggerBoost({ durationMs: 5000, strength: 1 });
      window.CD_Scene?.setSettings({ fireworks: true }, { rebuild: false });
      navigator.vibrate?.([30, 40, 60]);
    });
  }

  function init() {
    window.CD_Scene?.setSettings({ mode: 'default', snow: true, fireworks: false }, { rebuild: true });

    const m = /(?:^#|&)r=([A-Za-z0-9_-]+)/.exec(window.location.hash);
    const data = m ? decode(m[1]) : null;
    if (data && data.g && data.r) {
      showReveal(data);
      return;
    }
    if (m) setStatus('Link không hợp lệ hoặc bị cắt mất.');

    const draft = loadDraft();
    if (draft) {
      if (elNames) elNames.value = draft.names || '';
      if (elExclude) elExclude.value = draft.exclude || '';
      if (elEvent) elEvent.value = draft.e || '';
      if (elBudget) elBudget.value = draft.b || '';
      if (elDate) elDate.value = draft.d || '';
      if (Array.isArray(draft.links)) renderResults(draft.links);
    }

    elDraw?.addEventListener('click', onDraw);
  }

  init();
})();
