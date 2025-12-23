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

    function syncLabel(theme) {
      if (!toggle) return;
      toggle.textContent = theme === 'dark' ? 'Dark' : 'Light';
      toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
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

  // Auto-init theme toggle if present.
  // (Safe on pages without the toggle button.)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initThemeToggle({ toggleSelector: '#theme-toggle' }), {
      once: true,
    });
  } else {
    initThemeToggle({ toggleSelector: '#theme-toggle' });
  }

  window.CD_UI = Object.freeze({ initCornerPanel, initThemeToggle, applyTheme });
})();
