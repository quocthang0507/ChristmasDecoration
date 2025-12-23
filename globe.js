(() => {
  const elPerf = document.getElementById('globe-perf');
  const PERF_KEY = 'cd.globe.perf.v1';

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
    const perf = Boolean(elPerf?.checked);
    window.CD_Scene?.setSettings(
      {
        mode: 'globe',
        fireworks: false,
        snow: true,
        perf,
      },
      { rebuild: true }
    );
    saveBool(PERF_KEY, perf);
  }

  function init() {
    window.CD_UI?.initCornerPanel({
      panelSelector: '.card-ui__panel',
      toggleSelector: '#globe-panel-toggle',
      storageKey: 'cd.globe.panelCollapsed.v1',
      defaultCollapsed: true,
      collapsedLabel: 'Globe',
      expandedLabel: 'Thu gọn',
    });

    if (elPerf) elPerf.checked = loadBool(PERF_KEY, false);
    elPerf?.addEventListener('change', sync);
    sync();
  }

  init();
})();
