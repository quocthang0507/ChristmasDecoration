(() => {
  function initCornerPanel({
    panelSelector,
    toggleSelector,
    storageKey,
    defaultCollapsed = true,
    collapsedLabel = 'Tùy biến',
    expandedLabel = 'Thu gọn',
  }) {
    const panel = document.querySelector(panelSelector);
    const toggle = document.querySelector(toggleSelector);
    if (!panel || !toggle) return;

    function setCollapsed(collapsed, { persist } = { persist: true }) {
      panel.classList.toggle('is-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.textContent = collapsed ? collapsedLabel : expandedLabel;
      if (!persist) return;
      try {
        window.localStorage.setItem(storageKey, collapsed ? '1' : '0');
      } catch {
        // ignore
      }
    }

    let collapsed = defaultCollapsed;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null) collapsed = raw === '1';
    } catch {
      // ignore
    }

    setCollapsed(collapsed, { persist: false });

    toggle.addEventListener('click', () => {
      const now = panel.classList.contains('is-collapsed');
      setCollapsed(!now);
    });
  }

  window.CD_UI = Object.freeze({ initCornerPanel });
})();
