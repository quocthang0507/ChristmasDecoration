(() => {
  // Page-specific logic for index (tree page): settings persistence, controls wiring, music.

  const DEFAULT_SETTINGS = Object.freeze({
    density: 1.15,
    size: 1.1,
    glow: 1.15,
    mouse: 1.05,
    color: 1.05,
    topper: true,
    snow: true,
    wind: 0.15,
    garland: true,
    perf: false,
    sway: 0.45,
    freefly: false,
    freeflySpeed: 0.95,
    music: true,
    volume: 0.45,
    track: '',
  });

  const STORAGE_KEY = 'xmasTreeSettingsV2';

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        density: clamp(Number(parsed.density ?? DEFAULT_SETTINGS.density), 0.7, 1.6),
        size: clamp(Number(parsed.size ?? DEFAULT_SETTINGS.size), 0.75, 1.7),
        glow: clamp(Number(parsed.glow ?? DEFAULT_SETTINGS.glow), 0.6, 1.9),
        mouse: clamp(Number(parsed.mouse ?? DEFAULT_SETTINGS.mouse), 0, 1.8),
        color: clamp(Number(parsed.color ?? DEFAULT_SETTINGS.color), 0, 1.6),
        topper: Boolean(parsed.topper ?? DEFAULT_SETTINGS.topper),
        snow: Boolean(parsed.snow ?? DEFAULT_SETTINGS.snow),
        wind: clamp(Number(parsed.wind ?? DEFAULT_SETTINGS.wind), -1, 1),
        garland: Boolean(parsed.garland ?? DEFAULT_SETTINGS.garland),
        perf: Boolean(parsed.perf ?? DEFAULT_SETTINGS.perf),
        sway: clamp(Number(parsed.sway ?? DEFAULT_SETTINGS.sway), 0, 1.6),
        freefly: Boolean(parsed.freefly ?? DEFAULT_SETTINGS.freefly),
        freeflySpeed: clamp(Number(parsed.freeflySpeed ?? DEFAULT_SETTINGS.freeflySpeed), 0.2, 2.2),
        music: Boolean(parsed.music ?? DEFAULT_SETTINGS.music),
        volume: clamp(Number(parsed.volume ?? DEFAULT_SETTINGS.volume), 0, 1),
        track: String(parsed.track ?? DEFAULT_SETTINGS.track),
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }

  function filenameFromUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || '';
      return decodeURIComponent(last);
    } catch {
      const parts = String(url).split('/');
      return parts[parts.length - 1] || String(url);
    }
  }

  function titleFromFilename(name) {
    return name
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  function parseDirectoryListingForAudio(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const exts = ['.mp3', '.m4a', '.ogg', '.wav'];
    const out = [];

    function normalizeHref(href) {
      if (!href) return '';
      const clean = href.split('#')[0].split('?')[0];
      if (/^https?:\/\//i.test(clean)) return '';
      let h = clean.replace(/^\.\//, '');
      h = h.replace(/^\/+/, '');
      h = h.replace(/^music\//i, '');
      if (h.startsWith('..')) return '';
      return h;
    }

    for (const a of anchors) {
      const hrefRaw = a.getAttribute('href') || '';
      const href = normalizeHref(hrefRaw);
      if (!href || href.endsWith('/')) continue;
      const lower = href.toLowerCase();
      if (!exts.some((e) => lower.endsWith(e))) continue;
      const src = `./music/${href}`;
      const name = filenameFromUrl(src);
      out.push({ title: titleFromFilename(name), src });
    }
    return out;
  }

  async function discoverTracks() {
    try {
      const data = await fetchJson('./music/playlist.json');
      const tracks = Array.isArray(data) ? data : Array.isArray(data?.tracks) ? data.tracks : [];
      const normalized = tracks
        .map((t) => {
          const src = String(t?.src || '').trim();
          if (!src) return null;
          const title = String(t?.title || '').trim() || titleFromFilename(filenameFromUrl(src));
          return { title, src };
        })
        .filter(Boolean);

      if (normalized.length) {
        const checks = await Promise.all(
          normalized.map(async (t) => {
            try {
              const res = await fetch(t.src, { method: 'HEAD', cache: 'no-store' });
              return res.ok ? t : null;
            } catch {
              return null;
            }
          })
        );
        const ok = checks.filter(Boolean);
        if (ok.length) return ok;
      }
    } catch {
      // ignore
    }

    try {
      const res = await fetch('./music/', { cache: 'no-store' });
      if (!res.ok) return [];
      const htmlText = await res.text();
      return parseDirectoryListingForAudio(htmlText);
    } catch {
      return [];
    }
  }

  function init() {
    // Shared UI behavior
    window.CD_UI?.initCornerPanel({
      panelSelector: '.controls',
      toggleSelector: '#ctl-panel-toggle',
      storageKey: 'xmasPanelCollapsedV2',
      defaultCollapsed: true,
    });

    const settings = loadSettings();
    saveSettings(settings);

    // Apply to scene
    window.CD_Scene?.setSettings(settings, { rebuild: true });

    // UI controls
    const elDensity = document.getElementById('ctl-density');
    const elSize = document.getElementById('ctl-size');
    const elGlow = document.getElementById('ctl-glow');
    const elMouse = document.getElementById('ctl-mouse');
    const elFreefly = document.getElementById('ctl-freefly');
    const elFreeflySpeed = document.getElementById('ctl-freeflyspeed');
    const elColor = document.getElementById('ctl-color');
    const elWind = document.getElementById('ctl-wind');
    const elSway = document.getElementById('ctl-sway');
    const elTop = document.getElementById('ctl-top');
    const elSnow = document.getElementById('ctl-snow');
    const elGarland = document.getElementById('ctl-garland');
    const elPerf = document.getElementById('ctl-perf');
    const elReset = document.getElementById('ctl-reset');

    const elDensityVal = document.getElementById('ctl-density-val');
    const elSizeVal = document.getElementById('ctl-size-val');
    const elGlowVal = document.getElementById('ctl-glow-val');
    const elMouseVal = document.getElementById('ctl-mouse-val');
    const elFreeflySpeedVal = document.getElementById('ctl-freeflyspeed-val');
    const elColorVal = document.getElementById('ctl-color-val');
    const elWindVal = document.getElementById('ctl-wind-val');
    const elSwayVal = document.getElementById('ctl-sway-val');

    // Music
    const audio = /** @type {HTMLAudioElement|null} */ (document.getElementById('bgm'));
    const elMusic = document.getElementById('ctl-music');
    const elTrack = document.getElementById('ctl-track');
    const elVolume = document.getElementById('ctl-volume');
    const elVolumeVal = document.getElementById('ctl-volume-val');

    function syncUI() {
      if (elDensity) elDensity.value = String(settings.density);
      if (elSize) elSize.value = String(settings.size);
      if (elGlow) elGlow.value = String(settings.glow);
      if (elMouse) elMouse.value = String(settings.mouse);
      if (elFreefly) elFreefly.checked = Boolean(settings.freefly);
      if (elFreeflySpeed) elFreeflySpeed.value = String(settings.freeflySpeed);
      if (elColor) elColor.value = String(settings.color);
      if (elWind) elWind.value = String(settings.wind);
      if (elSway) elSway.value = String(settings.sway);
      if (elTop) elTop.checked = Boolean(settings.topper);
      if (elSnow) elSnow.checked = Boolean(settings.snow);
      if (elGarland) elGarland.checked = Boolean(settings.garland);
      if (elPerf) elPerf.checked = Boolean(settings.perf);

      if (elDensityVal) elDensityVal.textContent = `${settings.density.toFixed(2)}×`;
      if (elSizeVal) elSizeVal.textContent = `${settings.size.toFixed(2)}×`;
      if (elGlowVal) elGlowVal.textContent = `${settings.glow.toFixed(2)}×`;
      if (elMouseVal) elMouseVal.textContent = `${settings.mouse.toFixed(2)}×`;
      if (elColorVal) elColorVal.textContent = `${settings.color.toFixed(2)}×`;
      if (elWindVal) elWindVal.textContent = `${settings.wind.toFixed(2)}`;
      if (elSwayVal) elSwayVal.textContent = `${settings.sway.toFixed(2)}×`;
      if (elFreeflySpeedVal) elFreeflySpeedVal.textContent = `${settings.freeflySpeed.toFixed(2)}×`;

      if (elMouse) elMouse.disabled = Boolean(settings.freefly);

      if (elMusic) elMusic.checked = Boolean(settings.music);
      if (elVolume) elVolume.value = String(settings.volume);
      if (elVolumeVal) elVolumeVal.textContent = `${Math.round(settings.volume * 100)}%`;
    }

    function applyToScene({ rebuild } = { rebuild: false }) {
      window.CD_Scene?.setSettings(
        {
          density: settings.density,
          size: settings.size,
          glow: settings.glow,
          mouse: settings.mouse,
          color: settings.color,
          topper: settings.topper,
          snow: settings.snow,
          wind: settings.wind,
          garland: settings.garland,
          perf: settings.perf,
          sway: settings.sway,
          freefly: settings.freefly,
          freeflySpeed: settings.freeflySpeed,
        },
        { rebuild: Boolean(rebuild) }
      );
    }

    function onSettingsChange({ rebuild } = { rebuild: false }) {
      saveSettings(settings);
      syncUI();
      applyToScene({ rebuild });
    }

    // Wire sliders/toggles
    elDensity?.addEventListener('input', () => {
      settings.density = clamp(Number(elDensity.value), 0.7, 1.6);
      onSettingsChange({ rebuild: true });
    });

    elSize?.addEventListener('input', () => {
      settings.size = clamp(Number(elSize.value), 0.75, 1.7);
      onSettingsChange({ rebuild: true });
    });

    elGlow?.addEventListener('input', () => {
      settings.glow = clamp(Number(elGlow.value), 0.6, 1.9);
      onSettingsChange({ rebuild: false });
    });

    elMouse?.addEventListener('input', () => {
      settings.mouse = clamp(Number(elMouse.value), 0, 1.8);
      onSettingsChange({ rebuild: false });
    });

    elFreefly?.addEventListener('change', () => {
      settings.freefly = Boolean(elFreefly.checked);
      onSettingsChange({ rebuild: false });
    });

    elFreeflySpeed?.addEventListener('input', () => {
      settings.freeflySpeed = clamp(Number(elFreeflySpeed.value), 0.2, 2.2);
      onSettingsChange({ rebuild: false });
    });

    elColor?.addEventListener('input', () => {
      settings.color = clamp(Number(elColor.value), 0, 1.6);
      onSettingsChange({ rebuild: false });
    });

    elWind?.addEventListener('input', () => {
      settings.wind = clamp(Number(elWind.value), -1, 1);
      onSettingsChange({ rebuild: false });
    });

    elSway?.addEventListener('input', () => {
      settings.sway = clamp(Number(elSway.value), 0, 1.6);
      onSettingsChange({ rebuild: false });
    });

    elTop?.addEventListener('change', () => {
      settings.topper = Boolean(elTop.checked);
      onSettingsChange({ rebuild: true });
    });

    elSnow?.addEventListener('change', () => {
      settings.snow = Boolean(elSnow.checked);
      onSettingsChange({ rebuild: true });
    });

    elGarland?.addEventListener('change', () => {
      settings.garland = Boolean(elGarland.checked);
      onSettingsChange({ rebuild: true });
    });

    elPerf?.addEventListener('change', () => {
      settings.perf = Boolean(elPerf.checked);
      onSettingsChange({ rebuild: true });
    });

    elReset?.addEventListener('click', () => {
      Object.assign(settings, { ...DEFAULT_SETTINGS });
      onSettingsChange({ rebuild: true });
      // music handled below
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
      }
    });

    // Music wiring (best-effort autoplay)
    let tracks = [];

    async function ensureTracks() {
      if (tracks.length) return tracks;
      tracks = await discoverTracks();
      return tracks;
    }

    function setTrackOptions() {
      if (!elTrack) return;
      elTrack.innerHTML = '';
      for (const t of tracks) {
        const opt = document.createElement('option');
        opt.value = t.src;
        opt.textContent = t.title;
        elTrack.appendChild(opt);
      }
      if (settings.track && tracks.some((t) => t.src === settings.track)) {
        elTrack.value = settings.track;
      } else if (tracks[0]) {
        settings.track = tracks[0].src;
        elTrack.value = settings.track;
      }
      saveSettings(settings);
    }

    async function applyAudio() {
      if (!audio) return;
      audio.loop = true;
      audio.volume = settings.volume;
      if (!settings.music) {
        audio.pause();
        return;
      }

      await ensureTracks();
      setTrackOptions();
      if (!settings.track) return;

      if (audio.src !== new URL(settings.track, window.location.href).toString()) {
        audio.src = settings.track;
      }

      try {
        await audio.play();
      } catch {
        // Autoplay blocked; will start on user gesture.
        const unlock = async () => {
          try {
            await audio.play();
          } catch {
            // ignore
          }
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('touchstart', unlock);
          window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
      }
    }

    elMusic?.addEventListener('change', () => {
      settings.music = Boolean(elMusic.checked);
      saveSettings(settings);
      syncUI();
      applyAudio();
    });

    elVolume?.addEventListener('input', () => {
      settings.volume = clamp(Number(elVolume.value), 0, 1);
      saveSettings(settings);
      syncUI();
      if (audio) audio.volume = settings.volume;
    });

    elTrack?.addEventListener('change', () => {
      settings.track = String(elTrack.value || '');
      saveSettings(settings);
      applyAudio();
    });

    // Init
    syncUI();
    applyAudio();
  }

  init();
})();
