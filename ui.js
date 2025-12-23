(() => {
  const THEME_STORAGE_KEY = 'cd.theme.v1';

  function getSystemTheme() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  }

  function readStoredTheme() {
    try {
      const v = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (v === 'dark' || v === 'light') return v;
      return null;
    } catch {
      return null;
    }
  }

  function applyTheme(theme, { persist } = { persist: true }) {
    const resolved = theme === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    root.dataset.theme = resolved;
    if (persist) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
      } catch {
        // ignore
      }
    }

    // Notify canvas renderer to rebuild cached gradients.
    try {
      window.dispatchEvent(new CustomEvent('cdthemechange', { detail: { theme: resolved } }));
    } catch {
      // ignore
    }

    return resolved;
  }

  function initThemeToggle({ toggleSelector } = {}) {
    const toggle = toggleSelector ? document.querySelector(toggleSelector) : null;

    const stored = readStoredTheme();
    const initial = stored || getSystemTheme();
    const current = applyTheme(initial, { persist: false });

    function labelForNextTheme(currentTheme) {
      // Show the action (what happens on click), not the current state.
      // Vietnamese labels match the rest of the UI.
      return currentTheme === 'dark' ? 'Sáng' : 'Tối';
    }

    function syncLabel(theme) {
      if (!toggle) return;
      toggle.textContent = labelForNextTheme(theme);
      toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    }

    syncLabel(current);

    if (toggle) {
      toggle.addEventListener('click', () => {
        const now = (document.documentElement.dataset.theme || 'dark') === 'dark' ? 'dark' : 'light';
        const next = now === 'dark' ? 'light' : 'dark';
        const applied = applyTheme(next, { persist: true });
        syncLabel(applied);
      });
    }
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
