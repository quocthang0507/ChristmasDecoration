(() => {
  function applyTheme(theme) {
    const resolved = theme === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    root.dataset.theme = resolved;

    return resolved;
  }

  function initThemeToggle({ toggleSelector } = {}) {
    // Theme toggle removed. Keep default dark theme like the original UI.
    // Still expose applyTheme() for internal use, but we always start dark.
    void toggleSelector;
    applyTheme('dark');
  }

  function initNavActive({ navSelector = '.nav' } = {}) {
    const nav = document.querySelector(navSelector);
    if (!nav) return;

    const links = Array.from(nav.querySelectorAll('a.nav__link[href]'));
    if (!links.length) return;

    let current = '';
    try {
      const u = new URL(window.location.href);
      current = (u.pathname.split('/').pop() || '').toLowerCase();
    } catch {
      current = '';
    }
    if (!current) return;

    for (const a of links) {
      const href = (a.getAttribute('href') || '').split('#')[0].split('?')[0];
      const target = href.split('/').pop()?.toLowerCase() || '';
      a.classList.toggle('nav__link--active', target === current);
    }
  }

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

    // UX: press Esc to collapse when expanded.
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape') return;
        if (panel.classList.contains('is-collapsed')) return;
        setCollapsed(true);
      },
      { passive: true }
    );
  }

  // Auto-init theme toggle if present.
  // (Safe on pages without the toggle button.)
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        initThemeToggle({ toggleSelector: '#theme-toggle' });
        initNavActive();
      },
      { once: true }
    );
  } else {
    initThemeToggle({ toggleSelector: '#theme-toggle' });
    initNavActive();
  }

  window.CD_UI = Object.freeze({ initCornerPanel, initThemeToggle, initNavActive, applyTheme });
})();
