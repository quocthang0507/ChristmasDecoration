(() => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });

  const state = {
    dpr: 1,
    w: 0,
    h: 0,
    t: 0,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    // camera-ish
    yaw: 0,
    pitch: 0,
    fov: 720,
  };

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

  state.settings = { ...DEFAULT_SETTINGS };

  const palette = [
    [255, 90, 90],
    [255, 206, 71],
    [140, 255, 193],
    [103, 197, 255],
    [192, 137, 255],
    [255, 255, 255],
  ];

  /**
   * Particle represents a tiny light at a 3D position (x,y,z).
   * y grows downward.
   */
  class Light {
    constructor({ x, y, z, radius, colorIndex, altColorIndex, phase, twinkleSpeed, colorShiftSpeed, kind }) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.radius = radius;
      this.colorIndex = colorIndex;
      this.altColorIndex = altColorIndex;
      this.phase = phase;
      this.twinkleSpeed = twinkleSpeed;
      this.colorShiftSpeed = colorShiftSpeed;
      this.kind = kind || 'tree';

      // a per-light drift factor to keep it alive
      this.drift = (Math.random() * 2 - 1) * 0.75;
    }
  }

  /** @type {Light[]} */
  const lights = [];

  const STORAGE_KEY = 'xmasTreeSettingsV1';
  const PANEL_KEY = 'xmasPanelCollapsedV1';

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
    // Works well with Python's http.server directory listing.
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const exts = ['.mp3', '.m4a', '.ogg', '.wav'];
    const out = [];

    function normalizeHref(href) {
      if (!href) return '';
      // drop query/hash
      const clean = href.split('#')[0].split('?')[0];
      // ignore absolute urls
      if (/^https?:\/\//i.test(clean)) return '';
      // normalize leading parts
      let h = clean.replace(/^\.\//, '');
      h = h.replace(/^\/+/, '');
      h = h.replace(/^music\//i, '');
      // do not allow parent traversal
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
    // 1) Prefer explicit playlist
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

      // Validate entries; if playlist exists but points to missing files,
      // fall back to directory scanning so user-added tracks still work.
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

    // 2) Fallback: parse server directory listing
    try {
      const res = await fetch('./music/', { cache: 'no-store' });
      if (!res.ok) return [];
      const htmlText = await res.text();
      return parseDirectoryListingForAudio(htmlText);
    } catch {
      return [];
    }
  }

  function smoothNoise01(t) {
    // 0..1, smooth-ish (sum of sines)
    return (
      0.5 +
      0.25 * Math.sin(t) +
      0.15 * Math.sin(t * 0.73 + 1.7) +
      0.10 * Math.sin(t * 1.31 + 0.2)
    );
  }

  class Snow {
    constructor({ x, y, z, size, vy, phase }) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.size = size;
      this.vy = vy;
      this.phase = phase;
    }
  }

  /** @type {Snow[]} */
  const snow = [];

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch {
      // ignore
    }
  }

  function loadPanelCollapsed() {
    try {
      const raw = localStorage.getItem(PANEL_KEY);
      if (raw === null) return null;
      return raw === '1';
    } catch {
      return null;
    }
  }

  function savePanelCollapsed(collapsed) {
    try {
      localStorage.setItem(PANEL_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function resize() {
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    state.dpr = dpr;
    state.w = Math.floor(window.innerWidth);
    state.h = Math.floor(window.innerHeight);

    canvas.width = Math.floor(state.w * dpr);
    canvas.height = Math.floor(state.h * dpr);
    canvas.style.width = `${state.w}px`;
    canvas.style.height = `${state.h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // fov scales with shortest dimension for consistent perspective feel
    const base = Math.min(state.w, state.h);
    state.fov = clamp(base * 1.25, 520, 1000);

    // rebuild for consistent density
    buildScene();
  }

  function buildScene() {
    lights.length = 0;
    snow.length = 0;

    const w = state.w;
    const h = state.h;

    // Tree layout (3D cone):
    // y: from topY to bottomY
    // radius at y grows from 0 to maxR
    const topY = h * 0.18;
    const bottomY = h * 0.86;
    const treeHeight = bottomY - topY;
    const maxR = Math.min(w, h) * 0.23;

    // Amount of lights: scale with area but clamp.
    const baseDensity = 0.00011; // tuned for performance
    const densityMul = state.settings?.density ?? 1.0;
    const perf = Boolean(state.settings?.perf);
    const count = clamp(Math.floor(w * h * baseDensity * densityMul), perf ? 1200 : 1600, perf ? 5200 : 9000);

    // Depth range for pseudo-3D
    const zRange = maxR * 1.15;

    // Star topper: a compact bright cluster (normal tree tip look)
    const starCount = 160;

    const sizeMul = state.settings?.size ?? 1.0;

    for (let i = 0; i < count; i++) {
      // pick a y along the tree with bias to middle/lower (more lush)
      const t = Math.pow(Math.random(), 0.72);
      const y = topY + t * treeHeight;

      const rAtY = (t ** 0.9) * maxR;
      const theta = Math.random() * Math.PI * 2;

      // distribute inside a disk -> sqrt for uniform area
      const rr = Math.sqrt(Math.random()) * rAtY;
      const x = Math.cos(theta) * rr;
      const z = Math.sin(theta) * rr + randBetween(-zRange, zRange) * 0.22;

      const radius = randBetween(0.85 * sizeMul, 3.2 * sizeMul) * (1 - t * 0.18);
      const colorIndex = Math.random() < 0.14 ? 5 : Math.floor(Math.random() * (palette.length - 1));
      const altColorIndex =
        colorIndex === 5
          ? 5
          : Math.random() < 0.25
            ? 5
            : Math.floor(Math.random() * (palette.length - 1));
      const phase = Math.random() * Math.PI * 2;
      const twinkleSpeed = randBetween(0.9, 1.9);
      const colorShiftSpeed = randBetween(0.25, 0.95);

      lights.push(
        new Light({ x, y, z, radius, colorIndex, altColorIndex, phase, twinkleSpeed, colorShiftSpeed, kind: 'tree' })
      );
    }

    // Spiral garland lights (strings wrapping around the cone)
    if (state.settings?.garland ?? true) {
      const turns = 3.3;
      const strands = 2;
      const garlandCount = clamp(Math.floor(count * (perf ? 0.12 : 0.16)), 260, 1400);

      for (let s = 0; s < strands; s++) {
        const strandPhase = (s / strands) * Math.PI;
        for (let i = 0; i < garlandCount; i++) {
          const t = i / (garlandCount - 1);
          const y = topY + t * treeHeight;
          const rAtY = (t ** 0.9) * maxR * 0.94;
          const theta = t * Math.PI * 2 * turns + strandPhase;

          const x = Math.cos(theta) * rAtY;
          const z = Math.sin(theta) * rAtY;

          // small jitter so it doesn't look like a perfect line
          const j = (1 - t) * 0.6;
          const x2 = x + randBetween(-1.2, 1.2) * j;
          const z2 = z + randBetween(-1.2, 1.2) * j;

          // Choose a cohesive set of garland colors
          const garlandColors = [0, 1, 3, 4];
          const colorIndex = garlandColors[Math.floor(Math.random() * garlandColors.length)];

          lights.push(
            new Light({
              x: x2,
              y,
              z: z2,
              radius: randBetween(1.05 * sizeMul, 2.6 * sizeMul),
              colorIndex,
              altColorIndex: 5,
              phase: Math.random() * Math.PI * 2,
              twinkleSpeed: randBetween(1.0, 2.2),
              colorShiftSpeed: randBetween(0.2, 0.6),
              kind: 'garland',
            })
          );
        }
      }
    }

    if (state.settings?.topper ?? true) {
      // Top cluster made of dots (no explicit star shape)
      for (let i = 0; i < starCount; i++) {
        const spread = maxR * 0.055;
        const x = randBetween(-spread, spread);
        const y = topY + randBetween(-spread * 0.35, spread * 0.85);
        const z = randBetween(-spread, spread);

        lights.push(
          new Light({
            x,
            y,
            z,
            radius: randBetween(2.0 * sizeMul, 4.0 * sizeMul),
            colorIndex: 5,
            altColorIndex: 5,
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: randBetween(1.6, 2.6),
            colorShiftSpeed: 0,
            kind: 'star',
          })
        );
      }
    }

    // Add a subtle trunk base glow (few warm lights)
    const trunkCount = clamp(Math.floor(count * 0.055), 80, perf ? 260 : 360);
    for (let i = 0; i < trunkCount; i++) {
      const t = randBetween(0.885, 0.99);
      const y = topY + t * treeHeight;
      const rAtY = (t ** 0.9) * maxR;
      // Keep trunk lights tightly centered so they don't appear outside the tree
      const x = randBetween(-rAtY * 0.075, rAtY * 0.075);
      const z = randBetween(-rAtY * 0.075, rAtY * 0.075);

      lights.push(
        new Light({
          x,
          y,
          z,
          radius: randBetween(1.15 * sizeMul, 3.1 * sizeMul),
          colorIndex: 1,
          altColorIndex: 1,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: randBetween(0.6, 1.2),
          colorShiftSpeed: 0,
          kind: 'trunk',
        })
      );
    }

    // Sort once by z for stable painter's order without per-frame sort cost.
    lights.sort((a, b) => a.z - b.z);

    // Snow particles (background)
    if (state.settings?.snow ?? true) {
      const baseSnow = clamp(Math.floor(w * h * 0.00006), 180, perf ? 650 : 1100);
      for (let i = 0; i < baseSnow; i++) {
        snow.push(
          new Snow({
            x: randBetween(-w * 0.6, w * 0.6),
            y: randBetween(-h * 0.6, h * 0.6),
            z: randBetween(-maxR * 1.1, maxR * 1.1),
            size: randBetween(0.8, 2.4) * (perf ? 0.95 : 1.0),
            vy: randBetween(18, 48) * (perf ? 0.9 : 1.0),
            phase: Math.random() * Math.PI * 2,
          })
        );
      }
    }
  }

  function projectPoint(x, y, z) {
    // Apply yaw/pitch rotation (camera moving around tree)
    const cy = Math.cos(state.yaw);
    const sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);

    // yaw around Y axis (but our vertical is y, so yaw around vertical)
    // We'll rotate XZ plane:
    let rx = x * cy - z * sy;
    let rz = x * sy + z * cy;

    // pitch: rotate around X axis to tilt up/down
    let ry = y * cp - rz * sp;
    rz = y * sp + rz * cp;

    // perspective
    const depth = state.fov / (state.fov + rz);

    const cx2 = state.w * 0.5;
    const cy2 = state.h * 0.5;

    return {
      x: cx2 + rx * depth,
      y: ry * depth,
      depth,
      rz,
    };
  }

  function drawBackground() {
    // A dark gradient backdrop with a hint of vignette
    const w = state.w;
    const h = state.h;

    // Fill solid base (alpha false context)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.75);
    g.addColorStop(0, '#061225');
    g.addColorStop(0.5, '#02040A');
    g.addColorStop(1, '#000000');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // subtle floor haze
    const floor = ctx.createRadialGradient(w * 0.5, h * 0.92, 0, w * 0.5, h * 0.92, Math.max(w, h) * 0.6);
    floor.addColorStop(0, 'rgba(30, 80, 55, 0.16)');
    floor.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, w, h);
  }

  function draw() {
    const w = state.w;
    const h = state.h;

    drawBackground();

    // If free-fly is enabled, drive the "mouse" target automatically.
    if (state.settings?.freefly) {
      const sp = state.settings?.freeflySpeed ?? 1.0;
      const tt = state.t * 0.00065 * sp;
      const nx = smoothNoise01(tt);
      const ny = smoothNoise01(tt + 2.3);

      // map to [-1..1] with gentle bias
      state.targetMouseX = clamp((nx * 2 - 1) * 0.95, -1, 1);
      state.targetMouseY = clamp((ny * 2 - 1) * 0.75, -1, 1);
    }

    // ease mouse for smooth parallax
    state.mouseX = lerp(state.mouseX, state.targetMouseX, 0.08);
    state.mouseY = lerp(state.mouseY, state.targetMouseY, 0.08);

    // map mouse [-1..1] -> yaw/pitch
    const mx = clamp(state.mouseX, -1, 1);
    const my = clamp(state.mouseY, -1, 1);

    // Keep subtle: this should feel like 3D parallax, not spinning wildly
    const mouseMul = state.settings?.mouse ?? 1.0;
    const sway = state.settings?.sway ?? 0;
    const swayYaw = Math.sin(state.t * 0.00035) * 0.22 * sway;
    const swayPitch = Math.sin(state.t * 0.00027 + 1.2) * 0.10 * sway;

    const targetYaw = mx * 0.55 * mouseMul + swayYaw;
    const targetPitch = my * 0.22 * mouseMul + swayPitch;

    state.yaw = lerp(state.yaw, targetYaw, 0.06);
    state.pitch = lerp(state.pitch, targetPitch, 0.06);

    const topY = h * 0.18;
    const bottomY = h * 0.86;
    const maxR = Math.min(w, h) * 0.23;
    const treeHeight = bottomY - topY;

    // A gentle camera bob gives shimmer depth.
    const bob = Math.sin(state.t * 0.0006) * 0.7;

    // draw silhouette haze behind lights for tree shape
    const silhouette = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, Math.min(w, h) * 0.45);
    silhouette.addColorStop(0, 'rgba(8, 40, 24, 0.35)');
    silhouette.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = silhouette;
    ctx.fillRect(0, 0, w, h);

    // Snow (background)
    if ((state.settings?.snow ?? true) && snow.length) {
      const wind = state.settings?.wind ?? 0;
      const perf = Boolean(state.settings?.perf);
      const windPx = wind * (perf ? 34 : 52);

      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < snow.length; i++) {
        const s = snow[i];

        // update
        const drift = Math.sin(state.t * 0.001 + s.phase) * 0.35;
        s.y += (s.vy / 60) * (perf ? 0.9 : 1.0);
        s.x += (windPx / 60) + drift;

        // wrap
        if (s.y > h * 0.75) s.y = -h * 0.75;
        if (s.x > w * 0.75) s.x = -w * 0.75;
        if (s.x < -w * 0.75) s.x = w * 0.75;

        // project in same 3D space (snow is more in camera space)
        const proj = projectPoint(s.x, s.y, s.z);
        const sx = proj.x;
        const sy = proj.y + h * 0.5;
        const depth = clamp(proj.depth, 0.25, 1.25);

        if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;

        const r = s.size * depth;
        const a = clamp(0.08 + 0.22 * depth, 0.06, 0.26);
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.2);
        grad.addColorStop(0, `rgba(235, 246, 255, ${a})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // subtle trunk silhouette so the base reads clearer
    {
      // Keep it short and within the tree base.
      const trunkW = maxR * 0.14;
      const trunkH = treeHeight * 0.085;
      const tx = w * 0.5 - trunkW * 0.5;
      const ty = bottomY - trunkH * 0.78;

      const trunkGrad = ctx.createLinearGradient(0, ty, 0, ty + trunkH);
      trunkGrad.addColorStop(0, 'rgba(22, 14, 8, 0)');
      trunkGrad.addColorStop(0.3, 'rgba(22, 14, 8, 0.28)');
      trunkGrad.addColorStop(1, 'rgba(22, 14, 8, 0.62)');
      ctx.fillStyle = trunkGrad;
      ctx.fillRect(tx, ty, trunkW, trunkH);
    }

    // Render lights
    ctx.globalCompositeOperation = 'lighter';

    const perf = Boolean(state.settings?.perf);
    const glowScale = perf ? 0.78 : 1.0;
    const glowIntensity = state.settings?.glow ?? 1.0;

    for (let ii = 0; ii < lights.length; ii++) {
      const p = lights[ii];

      // Normalize y into [-h/2..h/2] for pitch projection, then shift back.
      const localY = (p.y - (topY + bottomY) * 0.5) + bob;

      // Micro drift tied to time + per-light drift factor
      const drift = Math.sin(state.t * 0.001 + p.phase) * p.drift;

      // Parallax following mouse: nudge x/z slightly by mouse to fake depth
      const parallaxX = mx * mouseMul * (10 + p.z * 0.02);
      const parallaxZ = -mx * mouseMul * 18;
      const parallaxY = my * mouseMul * 10;

      const proj = projectPoint(p.x + drift + parallaxX, localY + parallaxY, p.z + parallaxZ);

      // Convert projected y back to screen y
      const sy = proj.y + h * 0.5;
      const sx = proj.x;

      // Cull offscreen early
      if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

      // Depth affects size and alpha
      const depth = clamp(proj.depth, 0.2, 1.4);

      const base = palette[p.colorIndex];
      const alt = palette[p.altColorIndex ?? p.colorIndex];

      // Color shifting: smoothly blend between two palette colors.
      // Keep subtle so it reads as "lấp lánh" rather than strobing.
      const globalColor = state.settings?.color ?? 1.0;
      const cs = (p.colorShiftSpeed || 0) * globalColor;
      const mix = cs <= 0 ? 0 : 0.5 + 0.5 * Math.sin(p.phase * 0.9 + state.t * 0.001 * cs);

      const r = Math.round(lerp(base[0], alt[0], mix));
      const g = Math.round(lerp(base[1], alt[1], mix));
      const b = Math.round(lerp(base[2], alt[2], mix));

      // Twinkle: a smooth sine + a tiny high-frequency wobble
      const tw = 0.55 + 0.45 * Math.sin(p.phase + state.t * 0.0018 * p.twinkleSpeed);
      const tw2 = 0.85 + 0.15 * Math.sin(p.phase * 1.7 + state.t * 0.0042);
      const alpha = clamp((0.14 + tw * 0.68) * glowIntensity, 0.05, 0.98) * tw2;

      const baseRadius = p.radius * depth;

      const glowMult =
        p.kind === 'star'
          ? randBetween(5.0, 6.2)
          : p.kind === 'trunk'
            ? randBetween(4.2, 5.4)
            : p.kind === 'garland'
              ? randBetween(3.6, 4.8)
              : randBetween(3.2, 4.2);
      const glowRadius = baseRadius * glowMult * glowScale * (0.85 + glowIntensity * 0.35);

      // soft glow
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      grad.addColorStop(0.15, `rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // core sparkle
      const coreBoost = p.kind === 'star' ? 0.28 : 0.12;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${clamp(alpha + coreBoost, 0, 1)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.7, baseRadius), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    state.t = performance.now();
    requestAnimationFrame(draw);
  }

  function onPointerMove(ev) {
    if (state.settings?.freefly) return;
    const x = (ev.clientX / state.w) * 2 - 1;
    const y = (ev.clientY / state.h) * 2 - 1;
    state.targetMouseX = x;
    state.targetMouseY = y;
  }

  function onTouchMove(ev) {
    if (state.settings?.freefly) return;
    if (!ev.touches || ev.touches.length === 0) return;
    const t = ev.touches[0];
    const x = (t.clientX / state.w) * 2 - 1;
    const y = (t.clientY / state.h) * 2 - 1;
    state.targetMouseX = x;
    state.targetMouseY = y;
  }

  function init() {
    state.settings = loadSettings();
    resize();

    // start centered
    state.targetMouseX = 0;
    state.targetMouseY = 0;

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    // UI controls (optional if markup exists)
    const controlsPanel = document.querySelector('.controls');
    const elPanelToggle = document.getElementById('ctl-panel-toggle');
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

    // Music UI
    const audio = /** @type {HTMLAudioElement|null} */ (document.getElementById('bgm'));
    const elMusic = document.getElementById('ctl-music');
    const elTrack = document.getElementById('ctl-track');
    const elVolume = document.getElementById('ctl-volume');
    const elVolumeVal = document.getElementById('ctl-volume-val');

    const elDensityVal = document.getElementById('ctl-density-val');
    const elSizeVal = document.getElementById('ctl-size-val');
    const elGlowVal = document.getElementById('ctl-glow-val');
    const elMouseVal = document.getElementById('ctl-mouse-val');
    const elFreeflySpeedVal = document.getElementById('ctl-freeflyspeed-val');
    const elColorVal = document.getElementById('ctl-color-val');
    const elWindVal = document.getElementById('ctl-wind-val');
    const elSwayVal = document.getElementById('ctl-sway-val');

    function syncUI() {
      if (elDensity) elDensity.value = String(state.settings.density);
      if (elSize) elSize.value = String(state.settings.size);
      if (elGlow) elGlow.value = String(state.settings.glow);
      if (elMouse) elMouse.value = String(state.settings.mouse);
      if (elFreefly) elFreefly.checked = Boolean(state.settings.freefly);
      if (elFreeflySpeed) elFreeflySpeed.value = String(state.settings.freeflySpeed);
      if (elColor) elColor.value = String(state.settings.color);
      if (elWind) elWind.value = String(state.settings.wind);
      if (elSway) elSway.value = String(state.settings.sway);
      if (elTop) elTop.checked = Boolean(state.settings.topper);
      if (elSnow) elSnow.checked = Boolean(state.settings.snow);
      if (elGarland) elGarland.checked = Boolean(state.settings.garland);
      if (elPerf) elPerf.checked = Boolean(state.settings.perf);

      if (elDensityVal) elDensityVal.textContent = `${state.settings.density.toFixed(2)}×`;
      if (elSizeVal) elSizeVal.textContent = `${state.settings.size.toFixed(2)}×`;
      if (elGlowVal) elGlowVal.textContent = `${state.settings.glow.toFixed(2)}×`;
      if (elMouseVal) elMouseVal.textContent = `${state.settings.mouse.toFixed(2)}×`;
      if (elColorVal) elColorVal.textContent = `${state.settings.color.toFixed(2)}×`;
      if (elWindVal) elWindVal.textContent = `${state.settings.wind.toFixed(2)}`;
      if (elSwayVal) elSwayVal.textContent = `${state.settings.sway.toFixed(2)}×`;
      if (elFreeflySpeedVal) elFreeflySpeedVal.textContent = `${state.settings.freeflySpeed.toFixed(2)}×`;

      // When free-fly is on, de-emphasize the "3D theo chuột" slider.
      if (elMouse) elMouse.disabled = Boolean(state.settings.freefly);

      if (elMusic) elMusic.checked = Boolean(state.settings.music);
      if (elVolume) elVolume.value = String(state.settings.volume);
      if (elVolumeVal) elVolumeVal.textContent = `${Math.round(state.settings.volume * 100)}%`;
    }

    // Panel collapse/expand (mobile-friendly)
    if (controlsPanel && elPanelToggle) {
      const mq = window.matchMedia('(max-width: 600px)');
      const saved = loadPanelCollapsed();
      const initialCollapsed = saved !== null ? saved : mq.matches;

      function setCollapsed(collapsed) {
        controlsPanel.classList.toggle('is-collapsed', collapsed);
        elPanelToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        elPanelToggle.textContent = collapsed ? 'Mở' : 'Đóng';
        savePanelCollapsed(collapsed);
      }

      setCollapsed(initialCollapsed);
      elPanelToggle.addEventListener('click', () => {
        const collapsed = controlsPanel.classList.contains('is-collapsed');
        setCollapsed(!collapsed);
      });
    }

    function onSettingsChange({ rebuild } = { rebuild: false }) {
      saveSettings();
      syncUI();
      if (rebuild) buildScene();
    }

    if (elDensity) {
      elDensity.addEventListener(
        'input',
        () => {
          state.settings.density = clamp(Number(elDensity.value), 0.7, 1.6);
          onSettingsChange({ rebuild: true });
        },
        { passive: true }
      );
    }

    if (elSize) {
      elSize.addEventListener(
        'input',
        () => {
          state.settings.size = clamp(Number(elSize.value), 0.75, 1.7);
          onSettingsChange({ rebuild: true });
        },
        { passive: true }
      );
    }

    if (elGlow) {
      elGlow.addEventListener(
        'input',
        () => {
          state.settings.glow = clamp(Number(elGlow.value), 0.6, 1.9);
          onSettingsChange({ rebuild: false });
        },
        { passive: true }
      );
    }

    if (elMouse) {
      elMouse.addEventListener(
        'input',
        () => {
          state.settings.mouse = clamp(Number(elMouse.value), 0, 1.8);
          onSettingsChange({ rebuild: false });
        },
        { passive: true }
      );
    }

    if (elFreefly) {
      elFreefly.addEventListener(
        'change',
        () => {
          state.settings.freefly = Boolean(elFreefly.checked);
          // reset targets so it doesn't jump
          state.targetMouseX = 0;
          state.targetMouseY = 0;
          onSettingsChange({ rebuild: false });
        },
        { passive: true }
      );
    }

    if (elFreeflySpeed) {
      elFreeflySpeed.addEventListener(
        'input',
        () => {
          state.settings.freeflySpeed = clamp(Number(elFreeflySpeed.value), 0.2, 2.2);
          onSettingsChange({ rebuild: false });
        },
        { passive: true }
      );
    }

    if (elColor) {
      elColor.addEventListener(
        'input',
        () => {
          state.settings.color = clamp(Number(elColor.value), 0, 1.6);
          onSettingsChange({ rebuild: false });
        },
        { passive: true }
      );
    }

    if (elWind) {
      elWind.addEventListener(
        'input',
        () => {
          state.settings.wind = clamp(Number(elWind.value), -1, 1);
          onSettingsChange({ rebuild: false });
        },
        { passive: true }
      );
    }

    if (elSway) {
      elSway.addEventListener(
        'input',
        () => {
          state.settings.sway = clamp(Number(elSway.value), 0, 1.6);
          onSettingsChange({ rebuild: false });
        },
        { passive: true }
      );
    }

    if (elTop) {
      elTop.addEventListener(
        'change',
        () => {
          state.settings.topper = Boolean(elTop.checked);
          onSettingsChange({ rebuild: true });
        },
        { passive: true }
      );
    }

    if (elSnow) {
      elSnow.addEventListener(
        'change',
        () => {
          state.settings.snow = Boolean(elSnow.checked);
          onSettingsChange({ rebuild: true });
        },
        { passive: true }
      );
    }

    if (elGarland) {
      elGarland.addEventListener(
        'change',
        () => {
          state.settings.garland = Boolean(elGarland.checked);
          onSettingsChange({ rebuild: true });
        },
        { passive: true }
      );
    }

    if (elPerf) {
      elPerf.addEventListener(
        'change',
        () => {
          state.settings.perf = Boolean(elPerf.checked);
          onSettingsChange({ rebuild: true });
        },
        { passive: true }
      );
    }

    if (elReset) {
      elReset.addEventListener('click', () => {
        state.settings = { ...DEFAULT_SETTINGS };
        onSettingsChange({ rebuild: true });
      });
    }

    async function setTrack(src) {
      if (!audio) return;
      if (!src) {
        audio.removeAttribute('src');
        audio.load();
        return;
      }
      if (audio.src && audio.src.endsWith(src.replace(/^\.\//, ''))) return;
      audio.src = src;
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = clamp(state.settings.volume, 0, 1);
      try {
        await audio.play();
      } catch {
        // autoplay likely blocked; will retry on first user gesture
      }
    }

    async function applyMusicState() {
      if (!audio) return;
      audio.volume = clamp(state.settings.volume, 0, 1);

      if (!state.settings.music) {
        audio.pause();
        return;
      }

      // best effort autoplay
      audio.muted = true;
      try {
        await audio.play();
      } catch {
        // ignore
      }
    }

    function enableAudioOnFirstGesture() {
      if (!audio) return;
      if (!state.settings.music) return;
      audio.muted = false;
      audio.volume = clamp(state.settings.volume, 0, 1);
      audio.play().catch(() => {});
      window.removeEventListener('pointerdown', enableAudioOnFirstGesture);
      window.removeEventListener('keydown', enableAudioOnFirstGesture);
    }

    // Populate track list
    (async () => {
      if (!elTrack) return;
      const tracks = await discoverTracks();
      elTrack.innerHTML = '';

      if (!tracks.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(Không tìm thấy nhạc trong /music)';
        elTrack.appendChild(opt);
        if (audio) audio.pause();
        syncUI();
        return;
      }

      for (const t of tracks) {
        const opt = document.createElement('option');
        opt.value = t.src;
        opt.textContent = t.title;
        elTrack.appendChild(opt);
      }

      // pick persisted track if available
      const persisted = state.settings.track;
      const chosen = tracks.find((t) => t.src === persisted) || tracks[0];
      state.settings.track = chosen.src;
      saveSettings();

      elTrack.value = chosen.src;
      await setTrack(chosen.src);

      // Loop is enabled, so we do not auto-advance tracks on end.

      await applyMusicState();
      window.addEventListener('pointerdown', enableAudioOnFirstGesture, { passive: true });
      window.addEventListener('keydown', enableAudioOnFirstGesture);
      syncUI();
    })();

    if (elMusic) {
      elMusic.addEventListener(
        'change',
        () => {
          state.settings.music = Boolean(elMusic.checked);
          saveSettings();
          syncUI();
          applyMusicState();
        },
        { passive: true }
      );
    }

    if (elVolume) {
      elVolume.addEventListener(
        'input',
        () => {
          state.settings.volume = clamp(Number(elVolume.value), 0, 1);
          saveSettings();
          syncUI();
          if (audio) audio.volume = state.settings.volume;
        },
        { passive: true }
      );
    }

    if (elTrack) {
      elTrack.addEventListener('change', () => {
        const src = String(elTrack.value || '');
        state.settings.track = src;
        saveSettings();
        setTrack(src);
      });
    }

    syncUI();

    state.t = performance.now();
    requestAnimationFrame(draw);
  }

  init();
})();
