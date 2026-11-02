(() => {
  // Page-specific logic for index (tree page): settings persistence, controls wiring, music.

  const DEFAULT_SETTINGS = Object.freeze({
    density: 1.15,
    size: 1.1,
    glow: 1.15,
    mouse: 1.05,
    color: 1.05,
    zoom: 1,
    snow: true,
    snowAmount: 1,
    snowSpeed: 1,
    snowSize: 1,
    adaptiveSnow: true,
    gyroLook: false,
    wind: 0.15,
    garland: true,
    perf: false,
    sway: 0.45,
    freefly: false,
    freeflySpeed: 0.95,
    music: true,
    volume: 0.45,
    track: '',
    shuffle: false,
    loopOne: false,
  });

  // Numeric bounds shared by storage, paste and share-link parsing.
  const RANGES = Object.freeze({
    density: [0.7, 1.6],
    size: [0.75, 1.7],
    glow: [0.6, 1.9],
    mouse: [0, 1.8],
    color: [0, 1.6],
    zoom: [0.7, 1.6],
    snowAmount: [0.2, 2.2],
    snowSpeed: [0.5, 2],
    snowSize: [0.5, 2],
    wind: [-1, 1],
    sway: [0, 1.6],
    freeflySpeed: [0.2, 2.2],
    volume: [0, 1],
  });

  // Keys included in a share link (audio preferences stay local).
  const SHARE_KEYS = Object.freeze([
    'density',
    'size',
    'glow',
    'mouse',
    'color',
    'zoom',
    'snow',
    'snowAmount',
    'snowSpeed',
    'snowSize',
    'wind',
    'garland',
    'sway',
    'freefly',
    'freeflySpeed',
  ]);

  const STORAGE_KEY = 'xmasTreeSettingsV2';

  function toBool(v, fallback) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
      if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === '') return false;
    }
    return fallback;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /** Copies valid, known keys from `parsed` into `target` (clamped; invalid values ignored). */
  function mergeSettings(target, parsed) {
    if (!parsed || typeof parsed !== 'object') return target;
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (!(key in parsed)) continue;
      const def = DEFAULT_SETTINGS[key];
      const v = parsed[key];
      if (typeof def === 'boolean') {
        target[key] = toBool(v, target[key]);
      } else if (typeof def === 'number') {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        const [min, max] = RANGES[key] || [-Infinity, Infinity];
        target[key] = clamp(n, min, max);
      } else {
        target[key] = String(v ?? '');
      }
    }
    return target;
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return mergeSettings({ ...DEFAULT_SETTINGS }, JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function encodeShare(settings) {
    const picked = {};
    for (const k of SHARE_KEYS) picked[k] = settings[k];
    return btoa(JSON.stringify(picked)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeShare(hash) {
    const m = /(?:^#|&)s=([A-Za-z0-9_-]+)/.exec(hash || '');
    if (!m) return null;
    try {
      const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64));
    } catch {
      return null;
    }
  }

  function isTypingTarget(target) {
    const el = /** @type {HTMLElement|null} */ (target);
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'select' || tag === 'textarea' || el.isContentEditable;
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

    // HUD hints: keep lightweight and contextual
    const elHudHint = document.querySelector('.hud__hint');
    const elHudMeta = document.getElementById('hud-meta');
    const elPanel = document.querySelector('.controls');
    const elPanelToggle = document.getElementById('ctl-panel-toggle');
    const isCoarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const defaultHudHint = elHudHint?.textContent || '';

    let statusLine = '';
    let fpsLine = '';

    function setStatusLine(text) {
      statusLine = String(text || '');
      if (elHudMeta) elHudMeta.textContent = [statusLine, fpsLine].filter(Boolean).join('\n');
    }

    function setFpsLine(text) {
      fpsLine = String(text || '');
      if (elHudMeta) elHudMeta.textContent = [statusLine, fpsLine].filter(Boolean).join('\n');
    }

    function syncHudHint() {
      if (!elHudHint) return;
      if (!isCoarse) {
        elHudHint.textContent = 'Di chuột để 3D • Cuộn để zoom • P: Tùy biến • S: Chụp ảnh • V: Quay clip • H: Toàn màn hình';
        return;
      }
      const collapsed = Boolean(elPanel?.classList.contains('is-collapsed'));
      elHudHint.textContent = collapsed
        ? 'Nhấn “Tùy biến” để mở bảng điều khiển'
        : 'Dùng các slider để tuỳ biến • Cuộn để zoom';
    }

    syncHudHint();
    elPanelToggle?.addEventListener('click', () => {
      // Update after the UI script toggles classes.
      setTimeout(syncHudHint, 0);
    });

    const settings = loadSettings();

    // A share link (#s=...) overrides the visual settings, then is removed from the URL.
    const shared = decodeShare(window.location.hash);
    if (shared) {
      mergeSettings(settings, shared);
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        // ignore
      }
    }
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
    const elZoom = document.getElementById('ctl-zoom');
    const elSway = document.getElementById('ctl-sway');
    const elSnow = document.getElementById('ctl-snow');
    const elSnowAmt = document.getElementById('ctl-snowamt');
    const elSnowSpeed = document.getElementById('ctl-snowspeed');
    const elSnowSize = document.getElementById('ctl-snowsize');
    const elAdaptiveSnow = document.getElementById('ctl-adaptivesnow');
    const elGyroLook = document.getElementById('ctl-gyrol');
    const elGarland = document.getElementById('ctl-garland');
    const elPerf = document.getElementById('ctl-perf');
    const elReset = document.getElementById('ctl-reset');

    const elPreset = document.getElementById('ctl-preset');

    const elDensityVal = document.getElementById('ctl-density-val');
    const elSizeVal = document.getElementById('ctl-size-val');
    const elGlowVal = document.getElementById('ctl-glow-val');
    const elMouseVal = document.getElementById('ctl-mouse-val');
    const elFreeflySpeedVal = document.getElementById('ctl-freeflyspeed-val');
    const elColorVal = document.getElementById('ctl-color-val');
    const elWindVal = document.getElementById('ctl-wind-val');
    const elZoomVal = document.getElementById('ctl-zoom-val');
    const elSwayVal = document.getElementById('ctl-sway-val');
    const elSnowAmtVal = document.getElementById('ctl-snowamt-val');
    const elSnowSpeedVal = document.getElementById('ctl-snowspeed-val');
    const elSnowSizeVal = document.getElementById('ctl-snowsize-val');

    // Music
    const audio = /** @type {HTMLAudioElement|null} */ (document.getElementById('bgm'));
    const elMusic = document.getElementById('ctl-music');
    const elTrack = document.getElementById('ctl-track');
    const elVolume = document.getElementById('ctl-volume');
    const elVolumeVal = document.getElementById('ctl-volume-val');

    const elShuffle = document.getElementById('ctl-shuffle');
    const elLoopOne = document.getElementById('ctl-loopone');
    const elPrev = document.getElementById('ctl-prev');
    const elNext = document.getElementById('ctl-next');
    const elLink = document.getElementById('ctl-link');
    const elShot = document.getElementById('ctl-shot');
    const elFullscreen = document.getElementById('ctl-fullscreen');
    const elCopy = document.getElementById('ctl-copy');
    const elPaste = document.getElementById('ctl-paste');

    function syncUI() {
      if (elDensity) elDensity.value = String(settings.density);
      if (elSize) elSize.value = String(settings.size);
      if (elGlow) elGlow.value = String(settings.glow);
      if (elMouse) elMouse.value = String(settings.mouse);
      if (elFreefly) elFreefly.checked = Boolean(settings.freefly);
      if (elFreeflySpeed) elFreeflySpeed.value = String(settings.freeflySpeed);
      if (elColor) elColor.value = String(settings.color);
      if (elWind) elWind.value = String(settings.wind);
      if (elZoom) elZoom.value = String(settings.zoom);
      if (elSway) elSway.value = String(settings.sway);
      if (elSnow) elSnow.checked = Boolean(settings.snow);
      if (elSnowAmt) elSnowAmt.value = String(settings.snowAmount);
      if (elSnowSpeed) elSnowSpeed.value = String(settings.snowSpeed);
      if (elSnowSize) elSnowSize.value = String(settings.snowSize);
      if (elAdaptiveSnow) elAdaptiveSnow.checked = Boolean(settings.adaptiveSnow);
      if (elGyroLook) elGyroLook.checked = Boolean(settings.gyroLook);
      if (elGarland) elGarland.checked = Boolean(settings.garland);
      if (elPerf) elPerf.checked = Boolean(settings.perf);

      if (elDensityVal) elDensityVal.textContent = `${settings.density.toFixed(2)}×`;
      if (elSizeVal) elSizeVal.textContent = `${settings.size.toFixed(2)}×`;
      if (elGlowVal) elGlowVal.textContent = `${settings.glow.toFixed(2)}×`;
      if (elMouseVal) elMouseVal.textContent = `${settings.mouse.toFixed(2)}×`;
      if (elColorVal) elColorVal.textContent = `${settings.color.toFixed(2)}×`;
      if (elWindVal) {
        const v = Number(settings.wind || 0);
        const a = Math.abs(v);
        const dir = v < -0.01 ? '←' : v > 0.01 ? '→' : '•';
        const strength = a < 0.2 ? 'Nhẹ' : a < 0.55 ? 'Vừa' : 'Mạnh';
        elWindVal.textContent = a < 0.01 ? 'Tắt' : `${dir} ${strength}`;
      }
      if (elZoomVal) elZoomVal.textContent = `${settings.zoom.toFixed(2)}×`;
      if (elSwayVal) elSwayVal.textContent = `${settings.sway.toFixed(2)}×`;
      if (elSnowAmtVal) elSnowAmtVal.textContent = `${settings.snowAmount.toFixed(2)}×`;
      if (elSnowSpeedVal) elSnowSpeedVal.textContent = `${settings.snowSpeed.toFixed(2)}×`;
      if (elSnowSizeVal) elSnowSizeVal.textContent = `${settings.snowSize.toFixed(2)}×`;
      if (elFreeflySpeedVal) elFreeflySpeedVal.textContent = `${settings.freeflySpeed.toFixed(2)}×`;

      if (elMouse) elMouse.disabled = Boolean(settings.freefly);
      if (elSnowAmt) elSnowAmt.disabled = !Boolean(settings.snow);
      if (elSnowSpeed) elSnowSpeed.disabled = !Boolean(settings.snow);
      if (elSnowSize) elSnowSize.disabled = !Boolean(settings.snow);
      if (elAdaptiveSnow) elAdaptiveSnow.disabled = !Boolean(settings.snow);

      if (elMusic) elMusic.checked = Boolean(settings.music);
      if (elVolume) elVolume.value = String(settings.volume);
      if (elVolumeVal) elVolumeVal.textContent = `${Math.round(settings.volume * 100)}%`;

      if (elShuffle) elShuffle.checked = Boolean(settings.shuffle);
      if (elLoopOne) elLoopOne.checked = Boolean(settings.loopOne);
    }

    function applyToScene({ rebuild } = { rebuild: false }) {
      window.CD_Scene?.setSettings(
        {
          density: settings.density,
          size: settings.size,
          glow: settings.glow,
          mouse: settings.mouse,
          color: settings.color,
          zoom: settings.zoom,
          snow: settings.snow,
          snowAmount: settings.snowAmount,
          snowSpeed: settings.snowSpeed,
          snowSize: settings.snowSize,
          adaptiveSnow: settings.adaptiveSnow,
          gyroLook: settings.gyroLook,
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

    function applyPreset(kind) {
      const k = String(kind || 'custom');
      if (k === 'soft') {
        Object.assign(settings, {
          perf: false,
          density: 1.05,
          glow: 1.05,
          size: 1.05,
          color: 0.9,
          snow: true,
          snowAmount: 0.85,
          snowSpeed: 0.95,
          snowSize: 0.95,
          wind: 0.12,
          sway: 0.35,
        });
        return true;
      }
      if (k === 'vivid') {
        Object.assign(settings, {
          perf: false,
          density: 1.35,
          glow: 1.55,
          size: 1.15,
          color: 1.25,
          snow: true,
          snowAmount: 1.35,
          snowSpeed: 1.1,
          snowSize: 1.1,
          wind: 0.2,
          sway: 0.55,
        });
        return true;
      }
      if (k === 'perf') {
        Object.assign(settings, {
          perf: true,
          density: 0.9,
          glow: 0.95,
          size: 1,
          color: 1,
          snow: true,
          snowAmount: 0.7,
          snowSpeed: 0.95,
          snowSize: 0.9,
          garland: false,
          wind: 0.1,
          sway: 0.25,
        });
        return true;
      }
      return false;
    }

    function onSettingsChange({ rebuild } = { rebuild: false }) {
      saveSettings(settings);
      syncUI();
      applyToScene({ rebuild });
    }

    // Wire sliders/toggles
    elPreset?.addEventListener('change', () => {
      const applied = applyPreset(String(elPreset.value || 'custom'));
      if (applied) onSettingsChange({ rebuild: true });
    });

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

    elZoom?.addEventListener('input', () => {
      settings.zoom = clamp(Number(elZoom.value), 0.7, 1.6);
      onSettingsChange({ rebuild: false });
    });

    elSway?.addEventListener('input', () => {
      settings.sway = clamp(Number(elSway.value), 0, 1.6);
      onSettingsChange({ rebuild: false });
    });

    elSnow?.addEventListener('change', () => {
      settings.snow = Boolean(elSnow.checked);
      onSettingsChange({ rebuild: true });
    });

    elSnowAmt?.addEventListener('input', () => {
      settings.snowAmount = clamp(Number(elSnowAmt.value), 0.2, 2.2);
      onSettingsChange({ rebuild: true });
    });

    elSnowSpeed?.addEventListener('input', () => {
      settings.snowSpeed = clamp(Number(elSnowSpeed.value), 0.5, 2);
      onSettingsChange({ rebuild: false });
    });

    elSnowSize?.addEventListener('input', () => {
      settings.snowSize = clamp(Number(elSnowSize.value), 0.5, 2);
      onSettingsChange({ rebuild: false });
    });

    elAdaptiveSnow?.addEventListener('change', () => {
      settings.adaptiveSnow = Boolean(elAdaptiveSnow.checked);
      onSettingsChange({ rebuild: true });
    });

    elGyroLook?.addEventListener('change', () => {
      settings.gyroLook = Boolean(elGyroLook.checked);
      onSettingsChange({ rebuild: false });
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
      if (elPreset) elPreset.value = 'custom';
      // music handled below
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
      }
    });

    // Wheel zoom (tree page): smooth, lightweight camera zoom.
    // Avoid stealing scroll when interacting with UI panels/controls.
    function isInteractiveTarget(el) {
      if (!el) return false;
      if (el.closest('.controls') || el.closest('.card-ui__panel') || el.closest('.nav')) return true;
      const tag = String(el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button';
    }

    function onWheel(e) {
      if (isInteractiveTarget(e.target)) return;
      if (e.ctrlKey) return; // browser pinch-zoom gesture
      // Prefer trackpad wheel: use deltaY sign only.
      const dy = Number(e.deltaY || 0);
      if (!dy) return;
      // Negative deltaY typically means zoom in.
      const baseStep = 0.05;
      const intensity = clamp(Math.abs(dy) / 100, 0.55, 2.5);
      const dir = dy < 0 ? 1 : -1;
      settings.zoom = clamp(Number(settings.zoom || 1) + dir * baseStep * intensity, 0.7, 1.6);
      onSettingsChange({ rebuild: false });
      e.preventDefault();
    }

    const canvas = document.getElementById('scene');
    (canvas || window).addEventListener('wheel', onWheel, { passive: false, capture: true });

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
      audio.loop = Boolean(settings.loopOne);
      audio.volume = settings.volume;
      if (!settings.music) {
        audio.pause();
        setStatusLine('');
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
        setStatusLine('');
      } catch {
        // Autoplay blocked; will start on user gesture.
        setStatusLine('Nhấn/click để bật nhạc');
        const unlock = async () => {
          try {
            await audio.play();
          } catch {
            // ignore
          }
          setStatusLine('');
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

    elShuffle?.addEventListener('change', () => {
      settings.shuffle = Boolean(elShuffle.checked);
      saveSettings(settings);
      syncUI();
    });

    elLoopOne?.addEventListener('change', () => {
      settings.loopOne = Boolean(elLoopOne.checked);
      saveSettings(settings);
      syncUI();
      if (audio) audio.loop = settings.loopOne;
    });

    // Playlist mode: advance when a track finishes (audio.loop handles "Lặp 1 bài").
    audio?.addEventListener('ended', () => {
      if (!settings.loopOne) nextTrack();
    });

    function prevTrack() {
      if (!tracks.length) return;
      const idx = tracks.findIndex((t) => t.src === settings.track);
      const prev = tracks[(Math.max(0, idx) - 1 + tracks.length) % tracks.length];
      settings.track = prev.src;
      saveSettings(settings);
      if (elTrack) elTrack.value = settings.track;
      applyAudio();
    }

    function nextTrack() {
      if (!tracks.length) return;
      const current = settings.track;
      const idx = tracks.findIndex((t) => t.src === current);

      let next = tracks[0];
      if (settings.shuffle) {
        const n = tracks.length;
        if (n === 1) next = tracks[0];
        else {
          let tries = 6;
          while (tries-- > 0) {
            const pick = tracks[Math.floor(Math.random() * n)];
            if (pick.src !== current) {
              next = pick;
              break;
            }
          }
        }
      } else {
        next = tracks[(Math.max(0, idx) + 1) % tracks.length];
      }

      settings.track = next.src;
      saveSettings(settings);
      if (elTrack) elTrack.value = settings.track;
      applyAudio();
    }

    elNext?.addEventListener('click', async () => {
      await ensureTracks();
      nextTrack();
    });

    elPrev?.addEventListener('click', async () => {
      await ensureTracks();
      prevTrack();
    });

    function flashStatus(text, ms = 1400) {
      setStatusLine(text);
      setTimeout(() => setStatusLine(''), ms);
    }

    elLink?.addEventListener('click', async () => {
      const url = `${window.location.origin}${window.location.pathname}#s=${encodeShare(settings)}`;
      try {
        if (navigator.share && isCoarse) {
          await navigator.share({ title: document.title, url });
          return;
        }
        await navigator.clipboard.writeText(url);
        flashStatus('Đã copy link chia sẻ');
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        window.prompt('Copy link chia sẻ:', url);
      }
    });

    function takeScreenshot() {
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      window.CD_Export?.downloadCanvasAsImage('scene', `christmas-tree-${stamp}.png`);
    }

    function toggleFullscreen() {
      const doc = /** @type {any} */ (document);
      const root = /** @type {any} */ (document.documentElement);
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
      } else {
        const req = root.requestFullscreen || root.webkitRequestFullscreen;
        if (!req) {
          flashStatus('Trình duyệt không hỗ trợ toàn màn hình');
          return;
        }
        Promise.resolve(req.call(root)).catch(() => {});
      }
    }

    function syncFullscreenLabel() {
      if (!elFullscreen) return;
      const on = Boolean(document.fullscreenElement || /** @type {any} */ (document).webkitFullscreenElement);
      elFullscreen.textContent = on ? 'Thoát toàn màn hình' : 'Toàn màn hình';
      document.body.classList.toggle('is-fullscreen', on);
    }

    elShot?.addEventListener('click', takeScreenshot);
    elFullscreen?.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', syncFullscreenLabel);
    document.addEventListener('webkitfullscreenchange', syncFullscreenLabel);

    elCopy?.addEventListener('click', async () => {
      const text = JSON.stringify(settings);
      try {
        await navigator.clipboard.writeText(text);
        setStatusLine('Đã copy cấu hình');
        setTimeout(() => setStatusLine(''), 1400);
      } catch {
        // Fallback: show prompt for manual copy
        window.prompt('Copy JSON settings:', text);
      }
    });

    elPaste?.addEventListener('click', () => {
      const raw = window.prompt('Paste JSON settings:');
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') throw new Error('bad');
        // Best-effort validation using the same bounds as loadSettings.
        mergeSettings(settings, parsed);

        onSettingsChange({ rebuild: true });
        setStatusLine('Đã áp dụng cấu hình');
        setTimeout(() => setStatusLine(''), 1400);
      } catch {
        setStatusLine('JSON không hợp lệ');
        setTimeout(() => setStatusLine(''), 1600);
      }
    });

    // Keyboard shortcuts (avoid when typing in inputs)
    window.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      // Leave browser shortcuts (Cmd/Ctrl+R, Ctrl+S, ...) alone.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = String(e.key || '').toLowerCase();
      if (k === 'p') {
        elPanelToggle?.click();
        e.preventDefault();
      } else if (k === 'r') {
        elReset?.click();
        e.preventDefault();
      } else if (k === 'm') {
        if (elMusic) {
          elMusic.checked = !elMusic.checked;
          settings.music = Boolean(elMusic.checked);
          saveSettings(settings);
          syncUI();
          applyAudio();
        }
        e.preventDefault();
      } else if (k === 'f') {
        if (elFreefly) {
          elFreefly.checked = !elFreefly.checked;
          settings.freefly = Boolean(elFreefly.checked);
          onSettingsChange({ rebuild: false });
        }
        e.preventDefault();
      } else if (k === 'n') {
        void ensureTracks().then(() => nextTrack());
        e.preventDefault();
      } else if (k === 'b') {
        void ensureTracks().then(() => prevTrack());
        e.preventDefault();
      } else if (k === 's') {
        takeScreenshot();
        e.preventDefault();
      } else if (k === 'h') {
        toggleFullscreen();
        e.preventDefault();
      } else if (k === 'v') {
        toggleClip();
        e.preventDefault();
      }
    });

    // Lightweight FPS estimation for UX hints
    {
      let last = performance.now();
      let acc = 0;
      let frames = 0;
      function raf(now) {
        const dt = now - last;
        last = now;
        if (dt > 0 && dt < 250) {
          acc += dt;
          frames++;
          if (acc >= 600) {
            const fps = Math.round((frames * 1000) / acc);
            const hint = fps < 45 ? ' • Gợi ý: bật Performance' : '';
            setFpsLine(`FPS ~ ${fps}${hint}`);
            acc = 0;
            frames = 0;
          }
        }
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }

    // Blow into the microphone: loudness becomes a wind gust, a strong blow lights the tree up.
    const elMic = /** @type {HTMLInputElement|null} */ (document.getElementById('ctl-mic'));
    let mic = null;

    async function startMic() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      const ctx = new AC();
      // Safari creates contexts suspended until resumed from a user gesture.
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      mic = {
        stream,
        ctx,
        analyser,
        buf: new Uint8Array(analyser.fftSize),
        gust: 0,
        holdSince: 0,
        lastBoost: 0,
        lastNow: 0,
        lastWind: NaN,
        raf: 0,
      };

      const loop = (now) => {
        if (!mic) return;
        const dt = mic.lastNow ? Math.min(100, now - mic.lastNow) : 16.7;
        mic.lastNow = now;

        // Byte samples are supported everywhere (float needs newer Safari); 128 = silence.
        mic.analyser.getByteTimeDomainData(mic.buf);
        let sum = 0;
        for (let i = 0; i < mic.buf.length; i++) {
          const v = (mic.buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / mic.buf.length);
        // Ignore room noise; a blow on the mic is loud and sustained.
        const target = clamp((rms - 0.035) / 0.18, 0, 1);
        const k = target > mic.gust ? 0.35 : 0.04;
        mic.gust += (target - mic.gust) * (1 - Math.pow(1 - k, dt / 16.7));
        if (mic.gust > 0.6) mic.holdSince = mic.holdSince || now;
        else mic.holdSince = 0;

        const dir = settings.wind < 0 ? -1 : 1;
        const wind = Math.round((settings.wind + dir * mic.gust * 2.2) * 100) / 100;
        if (wind !== mic.lastWind) {
          mic.lastWind = wind;
          window.CD_Scene?.setSettings({ wind }, { rebuild: false });
        }

        if (mic.holdSince && now - mic.holdSince > 350 && now - mic.lastBoost > 3500) {
          mic.lastBoost = now;
          window.CD_Scene?.triggerBoost({ durationMs: 2600, strength: 0.9 });
          navigator.vibrate?.(40);
        }
        mic.raf = requestAnimationFrame(loop);
      };
      mic.raf = requestAnimationFrame(loop);
    }

    function stopMic() {
      if (!mic) return;
      cancelAnimationFrame(mic.raf);
      mic.stream.getTracks().forEach((t) => t.stop());
      void mic.ctx.close().catch(() => {});
      mic = null;
      applyToScene({ rebuild: false });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && clip) stopClip();
      if (!mic) return;
      if (document.hidden) void mic.ctx.suspend?.().catch(() => {});
      else void mic.ctx.resume?.().catch(() => {});
    });

    elMic?.addEventListener('change', async () => {
      if (!elMic.checked) {
        stopMic();
        return;
      }
      try {
        await startMic();
        flashStatus('Thổi nhẹ vào micro để tuyết bay 🌬️', 2600);
      } catch {
        elMic.checked = false;
        flashStatus('Không truy cập được micro', 2200);
      }
    });

    // Record a short clip of the canvas (optionally cropped to 9:16) with the background music.
    const elClip = document.getElementById('ctl-clip');
    const elClipFmt = /** @type {HTMLSelectElement|null} */ (document.getElementById('ctl-clipfmt'));
    const CLIP_SECONDS = 10;
    let clip = null;
    let audioStream = null;

    function pickMimeType() {
      const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      return types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
    }

    function setClipLabel(text) {
      if (elClip) elClip.textContent = text;
    }

    function startClip() {
      const src = /** @type {HTMLCanvasElement|null} */ (document.getElementById('scene'));
      if (!src || !window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
        flashStatus('Trình duyệt không hỗ trợ quay clip', 2200);
        return;
      }

      // Crop rectangle (center) in source pixels.
      let cw = src.width;
      let ch = src.height;
      if (elClipFmt?.value === 'vertical') {
        if (cw / ch > 9 / 16) cw = Math.round((ch * 9) / 16);
        else ch = Math.round((cw * 16) / 9);
      }
      const scale = Math.min(1, 1920 / Math.max(cw, ch));
      const out = document.createElement('canvas');
      out.width = Math.round(cw * scale) & ~1;
      out.height = Math.round(ch * scale) & ~1;
      const octx = out.getContext('2d');
      if (!octx) return;
      const sx = Math.round((src.width - cw) / 2);
      const sy = Math.round((src.height - ch) / 2);
      const caption = `Merry Christmas ${new Date().getFullYear()} ✨`;

      const draw = () => {
        if (!clip) return;
        octx.drawImage(src, sx, sy, cw, ch, 0, 0, out.width, out.height);
        const fs = Math.round(out.height * 0.035);
        octx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
        octx.textAlign = 'center';
        octx.fillStyle = 'rgba(255,255,255,0.88)';
        octx.shadowColor = 'rgba(0,0,0,0.7)';
        octx.shadowBlur = fs * 0.5;
        octx.fillText(caption, out.width / 2, out.height - fs * 2.2);
        octx.shadowBlur = 0;
        clip.raf = requestAnimationFrame(draw);
      };

      const stream = out.captureStream(30);
      try {
        const media = /** @type {any} */ (audio);
        if (settings.music && audio && !audio.paused && media.captureStream) {
          audioStream = audioStream || media.captureStream();
          audioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
        }
      } catch {
        // Video only.
      }

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 8000000 });
      const chunks = [];
      clip = { recorder, raf: 0, timer: 0, left: CLIP_SECONDS };
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'video/webm';
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        void saveClip(new Blob(chunks, { type }), `christmas-${Date.now()}.${ext}`);
      };

      draw();
      recorder.start(250);
      setClipLabel(`Dừng (${clip.left}s)`);
      clip.timer = setInterval(() => {
        if (!clip) return;
        clip.left -= 1;
        if (clip.left <= 0) stopClip();
        else setClipLabel(`Dừng (${clip.left}s)`);
      }, 1000);
    }

    function stopClip() {
      if (!clip) return;
      clearInterval(clip.timer);
      cancelAnimationFrame(clip.raf);
      if (clip.recorder.state !== 'inactive') clip.recorder.stop();
      clip = null;
      setClipLabel(`Quay clip ${CLIP_SECONDS}s`);
    }

    async function saveClip(blob, filename) {
      const file = new File([blob], filename, { type: blob.type });
      // On phones, the share sheet lets people post straight to TikTok/Reels.
      if (isCoarse && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Merry Christmas' });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      flashStatus('Đã lưu clip 🎬', 1800);
    }

    function toggleClip() {
      if (clip) stopClip();
      else startClip();
    }

    elClip?.addEventListener('click', toggleClip);

    // Init
    syncUI();
    applyAudio();
  }

  init();
})();
