(() => {
  const elTarget = document.getElementById('cd-target');
  const elCustomRow = document.getElementById('cd-custom-row');
  const elCustom = /** @type {HTMLInputElement|null} */ (document.getElementById('cd-custom'));
  const elTime = document.getElementById('cd-time');
  const elHudEvent = document.getElementById('cd-hud-event');
  const elHudDays = document.getElementById('cd-hud-days');
  const elHudHours = document.getElementById('cd-hud-hours');
  const elHudMinutes = document.getElementById('cd-hud-minutes');
  const elHudSeconds = document.getElementById('cd-hud-seconds');
  const elHudMessage = document.getElementById('cd-hud-message');
  const elWhen = document.getElementById('cd-when');
  const elStatus = document.getElementById('cd-status');

  const STORAGE_KEY = 'cd.countdown.target.v1';
  const CUSTOM_KEY = 'cd.countdown.custom.v1';
  const KINDS = ['christmas', 'newyear', 'tet', 'custom'];
  const DAY_MS = 24 * 60 * 60 * 1000;
  const BASE_TITLE = document.title;

  // Tết Nguyên Đán (mùng 1 tháng Giêng) — [year, monthIndex, day] theo âm lịch Việt Nam.
  const TET_DATES = [
    [2026, 1, 17],
    [2027, 1, 6],
    [2028, 0, 26],
    [2029, 1, 13],
    [2030, 1, 3],
    [2031, 0, 23],
    [2032, 1, 11],
    [2033, 0, 31],
    [2034, 1, 19],
    [2035, 1, 8],
  ];

  const EVENTS = {
    christmas: { title: 'Đếm ngược đến Giáng Sinh', greeting: 'Merry Christmas! 🎄', short: 'Giáng Sinh' },
    newyear: { title: 'Đếm ngược đến Năm Mới', greeting: 'Chúc mừng Năm Mới! 🎆', short: 'Năm Mới' },
    tet: { title: 'Đếm ngược đến Tết Nguyên Đán', greeting: 'Chúc mừng năm mới — An khang thịnh vượng! 🧧', short: 'Tết' },
    custom: { title: 'Đếm ngược', greeting: 'Đã đến giờ! 🎉', short: 'Mốc tuỳ chọn' },
  };

  function pad2(n) {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
  }

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  // Occurrences of a yearly event (start of the day) around `now`, sorted ascending.
  function occurrences(kind, now) {
    const y = now.getFullYear();
    if (kind === 'christmas') return [y - 1, y, y + 1].map((yy) => new Date(yy, 11, 25));
    if (kind === 'newyear') return [y, y + 1].map((yy) => new Date(yy, 0, 1));
    if (kind === 'tet') return TET_DATES.map(([yy, m, d]) => new Date(yy, m, d));
    return [];
  }

  function parseCustom(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  /**
   * Returns { target, celebrating }.
   * Yearly events "celebrate" for the whole day once reached, then roll over to the next occurrence.
   * A custom target celebrates forever once reached.
   */
  function resolve(kind, now) {
    if (kind === 'custom') {
      const target = parseCustom(elCustom?.value || '');
      if (!target) return { target: null, celebrating: false };
      return { target, celebrating: target.getTime() <= now.getTime() };
    }

    const t = now.getTime();
    for (const d of occurrences(kind, now)) {
      const start = d.getTime();
      if (t >= start && t < start + DAY_MS) return { target: d, celebrating: true };
      if (start > t) return { target: d, celebrating: false };
    }
    return { target: null, celebrating: false };
  }

  function formatWhen(d) {
    try {
      return d.toLocaleString('vi-VN', {
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return d.toString();
    }
  }

  function loadTarget() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return KINDS.includes(v) ? v : 'christmas';
    } catch {
      return 'christmas';
    }
  }

  function saveItem(key, v) {
    try {
      localStorage.setItem(key, v);
    } catch {
      // ignore
    }
  }

  function loadCustom() {
    try {
      return localStorage.getItem(CUSTOM_KEY) || '';
    } catch {
      return '';
    }
  }

  // Tracks the previous celebrating state so the boost fires once per transition.
  let wasCelebrating = false;
  let lastKind = '';

  function tick() {
    const kind = KINDS.includes(String(elTarget?.value)) ? String(elTarget.value) : 'christmas';
    const ev = EVENTS[kind];
    const now = new Date();
    const { target, celebrating } = resolve(kind, now);

    if (kind !== lastKind) {
      lastKind = kind;
      wasCelebrating = false;
    }

    setText(elHudEvent, ev.title);
    setText(elWhen, target ? formatWhen(target) : kind === 'custom' ? 'Chọn ngày giờ trong panel' : '—');

    if (celebrating && !wasCelebrating) {
      // A few seconds of extra brightness + thicker snow.
      window.CD_Scene?.triggerBoost({ durationMs: 4800, strength: 1 });
    }
    wasCelebrating = celebrating;

    if (elHudMessage) {
      elHudMessage.hidden = !celebrating;
      setText(elHudMessage, celebrating ? ev.greeting : '');
    }
    setText(elStatus, celebrating ? ev.greeting : '');

    const diff = target && !celebrating ? Math.max(0, target.getTime() - now.getTime()) : 0;
    const total = Math.floor(diff / 1000);
    const days = Math.floor(total / 86400);
    const hh = pad2(Math.floor((total % 86400) / 3600));
    const mm = pad2(Math.floor((total % 3600) / 60));
    const ss = pad2(total % 60);

    setText(elHudDays, String(days));
    setText(elHudHours, hh);
    setText(elHudMinutes, mm);
    setText(elHudSeconds, ss);
    setText(elTime, days > 0 ? `${days} ngày ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`);

    const title = celebrating
      ? `${ev.greeting} — ${BASE_TITLE}`
      : target
        ? `${days > 0 ? `${days}d ` : ''}${hh}:${mm}:${ss} • ${ev.short}`
        : BASE_TITLE;
    if (document.title !== title) document.title = title;
  }

  function syncCustomRow() {
    if (elCustomRow) elCustomRow.hidden = elTarget?.value !== 'custom';
  }

  function init() {
    // Corner panel collapse
    window.CD_UI?.initCornerPanel({
      panelSelector: '.card-ui__panel',
      toggleSelector: '#countdown-panel-toggle',
      storageKey: 'cd.countdown.panelCollapsed.v2',
      defaultCollapsed: true,
    });

    // Scene: tree + snow, no fireworks, default mode.
    window.CD_Scene?.setSettings({ snow: true, mode: 'default', fireworks: false }, { rebuild: true });

    if (elTarget) elTarget.value = loadTarget();
    if (elCustom) elCustom.value = loadCustom();
    syncCustomRow();

    elTarget?.addEventListener('change', () => {
      saveItem(STORAGE_KEY, String(elTarget.value));
      syncCustomRow();
      tick();
    });

    elCustom?.addEventListener('change', () => {
      saveItem(CUSTOM_KEY, String(elCustom.value || ''));
      wasCelebrating = false;
      tick();
    });

    // Second-level precision is enough; avoid touching the DOM every animation frame.
    tick();
    setInterval(tick, 250);
  }

  init();
})();
