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
  });

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
        zoom: clamp(Number(parsed.zoom ?? DEFAULT_SETTINGS.zoom), 0.7, 1.6),
        snow: toBool(parsed.snow, DEFAULT_SETTINGS.snow),
        snowAmount: clamp(Number(parsed.snowAmount ?? DEFAULT_SETTINGS.snowAmount), 0.2, 2.2),
        snowSpeed: clamp(Number(parsed.snowSpeed ?? DEFAULT_SETTINGS.snowSpeed), 0.5, 2),
        snowSize: clamp(Number(parsed.snowSize ?? DEFAULT_SETTINGS.snowSize), 0.5, 2),
        adaptiveSnow: toBool(parsed.adaptiveSnow, DEFAULT_SETTINGS.adaptiveSnow),
        gyroLook: toBool(parsed.gyroLook, DEFAULT_SETTINGS.gyroLook),
        wind: clamp(Number(parsed.wind ?? DEFAULT_SETTINGS.wind), -1, 1),
        garland: toBool(parsed.garland, DEFAULT_SETTINGS.garland),
        perf: toBool(parsed.perf, DEFAULT_SETTINGS.perf),
        sway: clamp(Number(parsed.sway ?? DEFAULT_SETTINGS.sway), 0, 1.6),
        freefly: toBool(parsed.freefly, DEFAULT_SETTINGS.freefly),
        freeflySpeed: clamp(Number(parsed.freeflySpeed ?? DEFAULT_SETTINGS.freeflySpeed), 0.2, 2.2),
        music: toBool(parsed.music, DEFAULT_SETTINGS.music),
        volume: clamp(Number(parsed.volume ?? DEFAULT_SETTINGS.volume), 0, 1),
        track: String(parsed.track ?? DEFAULT_SETTINGS.track),
        shuffle: toBool(parsed.shuffle, DEFAULT_SETTINGS.shuffle),
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
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
        elHudHint.textContent = 'Di chuột để 3D • Cuộn để zoom • P: Tùy biến';
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
    const elNext = document.getElementById('ctl-next');
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
      audio.loop = true;
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
        if ('density' in parsed) settings.density = clamp(Number(parsed.density), 0.7, 1.6);
        if ('size' in parsed) settings.size = clamp(Number(parsed.size), 0.75, 1.7);
        if ('glow' in parsed) settings.glow = clamp(Number(parsed.glow), 0.6, 1.9);
        if ('mouse' in parsed) settings.mouse = clamp(Number(parsed.mouse), 0, 1.8);
        if ('color' in parsed) settings.color = clamp(Number(parsed.color), 0, 1.6);
        if ('zoom' in parsed) settings.zoom = clamp(Number(parsed.zoom), 0.7, 1.6);
        if ('snow' in parsed) settings.snow = toBool(parsed.snow, settings.snow);
        if ('snowAmount' in parsed) settings.snowAmount = clamp(Number(parsed.snowAmount), 0.2, 2.2);
        if ('snowSpeed' in parsed) settings.snowSpeed = clamp(Number(parsed.snowSpeed), 0.5, 2);
        if ('snowSize' in parsed) settings.snowSize = clamp(Number(parsed.snowSize), 0.5, 2);
        if ('adaptiveSnow' in parsed) settings.adaptiveSnow = toBool(parsed.adaptiveSnow, settings.adaptiveSnow);
        if ('gyroLook' in parsed) settings.gyroLook = toBool(parsed.gyroLook, settings.gyroLook);
        if ('wind' in parsed) settings.wind = clamp(Number(parsed.wind), -1, 1);
        if ('garland' in parsed) settings.garland = toBool(parsed.garland, settings.garland);
        if ('perf' in parsed) settings.perf = toBool(parsed.perf, settings.perf);
        if ('sway' in parsed) settings.sway = clamp(Number(parsed.sway), 0, 1.6);
        if ('freefly' in parsed) settings.freefly = toBool(parsed.freefly, settings.freefly);
        if ('freeflySpeed' in parsed) settings.freeflySpeed = clamp(Number(parsed.freeflySpeed), 0.2, 2.2);
        if ('music' in parsed) settings.music = toBool(parsed.music, settings.music);
        if ('volume' in parsed) settings.volume = clamp(Number(parsed.volume), 0, 1);
        if ('track' in parsed) settings.track = String(parsed.track || '');
        if ('shuffle' in parsed) settings.shuffle = toBool(parsed.shuffle, settings.shuffle);

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

    // Init
    syncUI();
    applyAudio();
  }

  init();
})();
