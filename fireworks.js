(() => {
  const elEnabled = document.getElementById('fw-enabled');
  const elPerf = document.getElementById('fw-perf');

  const STORAGE_KEY = 'cd.fireworks.enabled.v1';
  const PERF_KEY = 'cd.fireworks.perf.v1';

  function loadBool(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      return v === '1';
    } catch {
      return fallback;
    }
  }

  function saveBool(key, val) {
    try {
      localStorage.setItem(key, val ? '1' : '0');
    } catch {
      // ignore
    }
  }

  function sync() {
    const enabled = Boolean(elEnabled?.checked);
    const perf = Boolean(elPerf?.checked);

    window.CD_Scene?.setSettings(
      {
        mode: 'default',
        fireworks: enabled,
        perf,
        snow: true,
      },
      { rebuild: false }
    );

    saveBool(STORAGE_KEY, enabled);
    saveBool(PERF_KEY, perf);
  }

  function init() {
    window.CD_UI?.initCornerPanel({
      panelSelector: '.card-ui__panel',
      toggleSelector: '#fw-panel-toggle',
      storageKey: 'cd.fireworks.panelCollapsed.v1',
      defaultCollapsed: true,
      collapsedLabel: 'Pháo hoa',
      expandedLabel: 'Thu gọn',
    });

    if (elEnabled) elEnabled.checked = loadBool(STORAGE_KEY, false);
    if (elPerf) elPerf.checked = loadBool(PERF_KEY, false);

    elEnabled?.addEventListener('change', sync);
    elPerf?.addEventListener('change', sync);

    // Initial
    sync();
  }

  init();
})();
