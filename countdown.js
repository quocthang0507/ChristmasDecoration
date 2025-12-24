(() => {
  const elTarget = document.getElementById('cd-target');
  const elTime = document.getElementById('cd-time');
  const elHudEvent = document.getElementById('cd-hud-event');
  const elHudHours = document.getElementById('cd-hud-hours');
  const elHudMinutes = document.getElementById('cd-hud-minutes');
  const elHudSeconds = document.getElementById('cd-hud-seconds');
  const elWhen = document.getElementById('cd-when');
  const elStatus = document.getElementById('cd-status');

  const STORAGE_KEY = 'cd.countdown.target.v1';

  function pad2(n) {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
  }

  function setStatus(text) {
    if (!elStatus) return;
    elStatus.textContent = text;
  }

  function getTargetDate(kind) {
    const now = new Date();
    const y = now.getFullYear();

    if (kind === 'newyear') {
      // Next Jan 1 00:00
      const d = new Date(y + 1, 0, 1, 0, 0, 0, 0);
      return d;
    }

    // Christmas: Dec 25 00:00; if already passed, next year.
    const d = new Date(y, 11, 25, 0, 0, 0, 0);
    if (d.getTime() <= now.getTime()) return new Date(y + 1, 11, 25, 0, 0, 0, 0);
    return d;
  }

  function formatWhen(d) {
    try {
      return d.toLocaleString('vi-VN', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return d.toString();
    }
  }

  function loadTarget() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'christmas' || v === 'newyear') return v;
      return 'christmas';
    } catch {
      return 'christmas';
    }
  }

  function saveTarget(v) {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  }

  let done = false;

  function tick() {
    const kind = String(elTarget?.value || 'christmas');
    const target = getTargetDate(kind);

    if (elHudEvent) {
      elHudEvent.textContent = kind === 'newyear' ? 'Đếm ngược đến Năm Mới' : 'Đếm ngược đến Giáng Sinh';
    }

    const now = Date.now();
    const diff = target.getTime() - now;

    if (elWhen) elWhen.textContent = formatWhen(target);

    if (diff <= 0) {
      if (!done) {
        done = true;
        setStatus('00:00 — Chúc mừng!');
        // A few seconds of extra brightness + thicker snow.
        window.CD_Scene?.triggerBoost({ durationMs: 4800, strength: 1 });
      }
      if (elTime) elTime.textContent = '00:00:00';

      if (elHudHours) elHudHours.textContent = '00';
      if (elHudMinutes) elHudMinutes.textContent = '00';
      if (elHudSeconds) elHudSeconds.textContent = '00';

      requestAnimationFrame(tick);
      return;
    }

    done = false;
    setStatus('');

    const total = Math.floor(diff / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    const hh = pad2(h);
    const mm = pad2(m);
    const ss = pad2(s);

    if (elTime) elTime.textContent = `${hh}:${mm}:${ss}`;

    if (elHudHours) elHudHours.textContent = hh;
    if (elHudMinutes) elHudMinutes.textContent = mm;
    if (elHudSeconds) elHudSeconds.textContent = ss;

    requestAnimationFrame(tick);
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

    const initial = loadTarget();
    if (elTarget) elTarget.value = initial;

    elTarget?.addEventListener('change', () => {
      saveTarget(String(elTarget.value));
    });

    tick();
  }

  init();
})();
