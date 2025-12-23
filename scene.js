(() => {
  /** @type {HTMLCanvasElement|null} */
  const canvas = document.getElementById('scene');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  const state = {
    dpr: 1,
    w: 0,
    h: 0,
    t: 0,
    mouseX: 0,
    mouseY: 0,
    pointerPx: 0,
    pointerPy: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    yaw: 0,
    pitch: 0,
    fov: 720,
    baseFov: 720,
    scene: {
      topY: 0,
      bottomY: 0,
      treeHeight: 0,
      maxR: 0,
      zRange: 0,
      bgGradient: null,
      bg0: '#07101d',
      bg1: '#02040a',
      bg2: '#000',
    },
    boost: {
      start: 0,
      until: 0,
      duration: 0,
      strength: 0,
    },
    perfStats: {
      lastNow: 0,
      emaDt: 16.67,
      fps: 60,
    },
    gyro: {
      enabled: false,
      permission: 'unknown', // 'unknown', 'granted', 'denied'
      beta: 0,  // front-to-back tilt (-180 to 180)
      gamma: 0, // left-to-right tilt (-90 to 90)
      alpha: 0, // compass direction (0 to 360)
    },
    settings: {
      density: 1.15,
      size: 1.1,
      glow: 1.15,
      mouse: 1.05,
      color: 1.05,
      zoom: 1,
      snow: true,
      wind: 0.15,
      garland: true,
      perf: false,
      sway: 0.45,
      freefly: false,
      freeflySpeed: 0.95,

      // Optional modes/features (used by new pages)
      mode: 'default',
      fireworks: false,
      gyroSnow: true, // Enable gyro-based snow effects by default
    },
    loop: {
      rafId: 0,
      running: true,
    },
  };

  const palette = [
    [255, 90, 90],
    [255, 206, 71],
    [140, 255, 193],
    [103, 197, 255],
    [192, 137, 255],
    [255, 255, 255],
  ];

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
      this.drift = (Math.random() * 2 - 1) * 0.75;
    }
  }

  /** @type {Light[]} */
  const lights = [];

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

  class Firework {
    constructor({ x, y, z, vx, vy, vz, radius, color, life, drag, kind }) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.vx = vx;
      this.vy = vy;
      this.vz = vz;
      this.radius = radius;
      this.color = color;
      this.life = life;
      this.drag = drag;
      this.kind = kind; // 'rocket' | 'spark'
      this.phase = Math.random() * Math.PI * 2;
    }
  }

  /** @type {Firework[]} */
  const fireworks = [];

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothNoise01(t) {
    return (
      0.5 +
      0.25 * Math.sin(t) +
      0.15 * Math.sin(t * 0.73 + 1.7) +
      0.1 * Math.sin(t * 1.31 + 0.2)
    );
  }

  function getCssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name);
      const s = String(v || '').trim();
      return s || fallback;
    } catch {
      return fallback;
    }
  }

  function rebuildBackgroundGradient() {
    state.scene.bg0 = getCssVar('--scene-bg-0', state.scene.bg0);
    state.scene.bg1 = getCssVar('--scene-bg-1', state.scene.bg1);
    state.scene.bg2 = getCssVar('--scene-bg-2', state.scene.bg2);

    const cx = state.w * 0.5;
    const cy = state.h * 0.35;
    const r = Math.max(state.w, state.h) * 0.85;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, state.scene.bg0);
    g.addColorStop(0.55, state.scene.bg1);
    g.addColorStop(1, state.scene.bg2);
    state.scene.bgGradient = g;
  }

  function boostFactor01(now) {
    const until = state.boost.until;
    if (!until || now >= until) return 0;
    const dur = Math.max(1, state.boost.duration || 1);
    const t = clamp((now - state.boost.start) / dur, 0, 1);
    // Ease out: strong at start, fades smoothly.
    return (1 - t) * (1 - t);
  }

  function updatePerfStats(now) {
    const ps = state.perfStats;
    if (!ps.lastNow) {
      ps.lastNow = now;
      return;
    }

    const dt = now - ps.lastNow;
    ps.lastNow = now;
    if (!(dt > 0 && dt < 250)) return;

    // EMA to avoid noisy FPS.
    ps.emaDt = ps.emaDt * 0.92 + dt * 0.08;
    ps.fps = clamp(1000 / Math.max(1, ps.emaDt), 1, 240);
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

    const base = Math.min(state.w, state.h);
    state.baseFov = clamp(base * 1.25, 520, 1000);
    applyZoomToFov();

    rebuildBackgroundGradient();

    buildScene();
  }

  function applyZoomToFov() {
    const z = clamp(Number(state.settings?.zoom ?? 1) || 1, 0.7, 1.6);
    state.fov = clamp(state.baseFov * z, 360, 1600);
  }

  function buildScene() {
    lights.length = 0;
    snow.length = 0;
    fireworks.length = 0;

    const w = state.w;
    const h = state.h;
    
    const mode = String(state.settings?.mode || 'default');
    const isGlobe = mode === 'globe';

    // Adjust tree positioning for globe mode to fit better
    let topY, bottomY;
    if (isGlobe) {
      // Globe center is at h * 0.55, radius is min(w,h) * 0.42
      // Make tree fit within globe with some margin
      const globeCy = h * 0.55;
      const base = Math.min(w, h);
      const globeR = base * 0.42;
      
      // Position tree to fit inside globe (with 10% margin)
      const treeMargin = globeR * 0.9;
      topY = globeCy - treeMargin * 0.85;  // Top of tree
      bottomY = globeCy + treeMargin * 0.65;  // Bottom of tree (wider base)
    } else {
      topY = h * 0.18;
      bottomY = h * 0.86;
    }
    
    const treeHeight = bottomY - topY;
    const maxR = Math.min(w, h) * 0.23;

    state.scene.topY = topY;
    state.scene.bottomY = bottomY;
    state.scene.treeHeight = treeHeight;
    state.scene.maxR = maxR;

    const baseDensity = 0.00011;
    const densityMul = state.settings?.density ?? 1.0;
    const perf = Boolean(state.settings?.perf);
    const count = clamp(Math.floor(w * h * baseDensity * densityMul), perf ? 1200 : 1600, perf ? 5200 : 9000);

    const zRange = maxR * 1.15;
    state.scene.zRange = zRange;

    const sizeMul = state.settings?.size ?? 1.0;

    for (let i = 0; i < count; i++) {
      const t = Math.pow(Math.random(), 0.72);
      const y = topY + t * treeHeight;

      const rAtY = t ** 0.9 * maxR;
      const theta = Math.random() * Math.PI * 2;

      const rr = Math.sqrt(Math.random()) * rAtY;
      const x = Math.cos(theta) * rr;
      // Keep depth jitter proportional to local radius so the silhouette
      // still reads as a cone (random but still tree-shaped).
      const z = Math.sin(theta) * rr + randBetween(-1, 1) * rAtY * 0.18;

      const radius = randBetween(0.85 * sizeMul, 3.2 * sizeMul) * (1 - t * 0.18);
      const colorIndex = Math.random() < 0.14 ? 5 : Math.floor(Math.random() * (palette.length - 1));
      const altColorIndex = Math.floor(Math.random() * (palette.length - 1));
      const phase = Math.random() * Math.PI * 2;
      const twinkleSpeed = randBetween(0.75, 1.85);
      const colorShiftSpeed = randBetween(0.25, 1.15);
      lights.push(
        new Light({
          x,
          y,
          z,
          radius,
          colorIndex,
          altColorIndex,
          phase,
          twinkleSpeed,
          colorShiftSpeed,
          kind: 'tree',
        })
      );
    }

    // Spiral garland lights (strings wrapping around the cone)
    if (state.settings?.garland) {
      const turns = 3.2;
      const strands = perf ? 1 : 2;
      const garlandCount = clamp(Math.floor(count * (perf ? 0.06 : 0.085)), 160, perf ? 700 : 1100);
      const garlandColors = [0, 1, 3, 4];

      for (let s = 0; s < strands; s++) {
        const strandPhase = (s / Math.max(1, strands)) * Math.PI;
        for (let i = 0; i < garlandCount; i++) {
          const t = i / Math.max(1, garlandCount - 1);
          const y = topY + t * treeHeight;
          const r = t ** 0.9 * maxR * 0.94;
          const theta = t * Math.PI * 2 * turns + strandPhase;

          const j = (1 - t) * 0.6;
          const x = Math.cos(theta) * r + randBetween(-1.2, 1.2) * j;
          const z = Math.sin(theta) * r + randBetween(-1.2, 1.2) * j;

          const colorIndex = garlandColors[Math.floor(Math.random() * garlandColors.length)];
          lights.push(
            new Light({
              x,
              y,
              z,
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

    // Tree tip sparkle cluster (lightweight): keeps the top from looking empty
    // without the expensive topper rays.
    {
      const perf = Boolean(state.settings?.perf);
      const tipCount = perf ? 10 : 16;
      for (let i = 0; i < tipCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = randBetween(0, maxR * 0.10) * Math.sqrt(Math.random());
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r * 0.45;
        const y = topY + randBetween(-maxR * 0.03, maxR * 0.12);

        const radius = randBetween(0.9 * sizeMul, 2.0 * sizeMul);
        // Mostly white/warm near the tip.
        const colorIndex = Math.random() < 0.75 ? 5 : 1;
        lights.push(
          new Light({
            x,
            y,
            z,
            radius,
            colorIndex,
            altColorIndex: 5,
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: randBetween(0.95, 1.8),
            colorShiftSpeed: randBetween(0.15, 0.45),
            kind: 'tree',
          })
        );
      }
    }

    if (state.settings?.snow) {
      const snowCount = clamp(Math.floor((w * h * 0.000035) / (perf ? 1.6 : 1)), perf ? 110 : 180, perf ? 420 : 720);
      const zDepth = maxR * 1.8;
      for (let i = 0; i < snowCount; i++) {
        snow.push(
          new Snow({
            x: randBetween(-w * 0.55, w * 0.55),
            y: randBetween(-h * 0.25, h * 1.15),
            z: randBetween(-zDepth, zDepth),
            size: randBetween(0.6, 2.2) * (perf ? 0.9 : 1),
            vy: randBetween(0.35, 1.35),
            phase: Math.random() * Math.PI * 2,
          })
        );
      }
    }
  }

  function computeSnowTargetCount(now) {
    if (!state.settings?.snow) return 0;
    const w = state.w;
    const h = state.h;
    const perf = Boolean(state.settings?.perf);

    const base = clamp(Math.floor((w * h * 0.000035) / (perf ? 1.6 : 1)), perf ? 110 : 180, perf ? 420 : 720);
    const b = boostFactor01(now) * (state.boost.strength || 0);
    // During boost, temporarily add more snow.
    const mul = 1 + b * 1.35;
    return Math.floor(base * mul);
  }

  function ensureSnowCount(now) {
    const target = computeSnowTargetCount(now);
    if (!target) {
      if (snow.length) snow.length = 0;
      return;
    }

    const perf = Boolean(state.settings?.perf);
    const maxR = state.scene.maxR || Math.min(state.w, state.h) * 0.23;
    const zDepth = maxR * 1.8;

    // Add gradually to avoid spikes.
    if (snow.length < target) {
      const add = Math.min(target - snow.length, perf ? 6 : 10);
      for (let i = 0; i < add; i++) {
        snow.push(
          new Snow({
            x: randBetween(-state.w * 0.55, state.w * 0.55),
            y: randBetween(-state.h * 0.25, state.h * 1.15),
            z: randBetween(-zDepth, zDepth),
            size: randBetween(0.6, 2.2) * (perf ? 0.9 : 1),
            vy: randBetween(0.35, 1.35),
            phase: Math.random() * Math.PI * 2,
          })
        );
      }
    } else if (snow.length > target) {
      // Trim quickly when reducing.
      snow.length = target;
    }
  }

  function rotateY(x, z, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: x * c - z * s, z: x * s + z * c };
  }

  function rotateX(y, z, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { y: y * c - z * s, z: y * s + z * c };
  }

  function projectPoint(x, y, z) {
    const dz = state.fov / (state.fov + z);
    return { x: state.w * 0.5 + x * dz, y: y, s: dz };
  }

  function rgb([r, g, b], a = 1) {
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawLight(p, now) {
    const tw = 0.55 + 0.45 * Math.sin(now * 0.001 * p.twinkleSpeed + p.phase);
    const boost = boostFactor01(now) * (state.boost.strength || 0);
    const glowMul =
      (state.settings?.glow ?? 1) * (state.settings?.perf ? 0.8 : 1) * (1 + boost * (state.settings?.perf ? 0.45 : 0.65));

    let col = palette[p.colorIndex];
    if (p.kind === 'tree') {
      const shift = smoothNoise01(now * 0.00025 * (state.settings?.color ?? 1) * p.colorShiftSpeed + p.phase);
      const a = palette[p.colorIndex];
      const b = palette[p.altColorIndex];
      col = [
        Math.round(lerp(a[0], b[0], shift)),
        Math.round(lerp(a[1], b[1], shift)),
        Math.round(lerp(a[2], b[2], shift)),
      ];
    }

    const coreA = 0.55 + tw * 0.35;
    const outerA = 0.12 + tw * 0.12;

    const rr = Math.max(0.6, p.radius) * glowMul;

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 5.2);
    grad.addColorStop(0, rgb(col, coreA));
    grad.addColorStop(0.35, rgb(col, 0.22 + tw * 0.12));
    grad.addColorStop(1, rgb(col, outerA));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgb(col, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.7, rr * 0.75), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnow(s, now) {
    const w = state.w;
    const h = state.h;

    let wind = (state.settings?.wind ?? 0) * 0.9;
    
    // Apply gyro sensor influence to snow if enabled
    if (state.gyro.enabled && state.settings?.gyroSnow && state.settings?.snow) {
      // gamma is left-to-right tilt (-90 to 90)
      // beta is front-to-back tilt (-180 to 180)
      const gamma = state.gyro.gamma || 0;
      const beta = state.gyro.beta || 0;
      
      // Convert tilt to wind influence
      // Normalize gamma to -1 to 1 range and add to wind
      const gyroWind = clamp(gamma / 45, -1, 1) * 0.8;
      
      // Beta affects fall speed (tilt forward = faster fall)
      const tiltFactor = clamp((beta - 45) / 45, -0.5, 0.5);
      
      wind += gyroWind;
      s.vy = clamp(s.vy * (1 + tiltFactor * 0.15), 0.2, 2.5);
    }
    
    const boost = boostFactor01(now) * (state.boost.strength || 0);
    const boostVy = 1 + boost * 0.65;

    const mode = String(state.settings?.mode || 'default');
    const isGlobe = mode === 'globe';

    const vx = Number(s.vx || 0);
    const swirl = isGlobe ? 1 : 0;

    s.y += s.vy * boostVy;
    s.x += vx + wind * (0.8 + 0.35 * Math.sin(now * 0.001 + s.phase));

    if (isGlobe) {
      // Swirl field inside a virtual globe.
      const base = Math.min(state.w, state.h);
      // IMPORTANT: snow particles use world-x where 0 maps to screen center.
      // So globe center in world space is x=0.
      const cx = 0;
      const cy = state.h * 0.55;
      const R = base * 0.42;

      const dx = s.x;
      const dy = s.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const inside = dist < R;

      // Mouse influence: only if pointer is inside globe area.
      // Convert pointer from screen px into the same world-x space.
      const pmx = (state.pointerPx ?? state.w * 0.5) - state.w * 0.5;
      const pmy = state.pointerPy ?? cy;
      const mdx = pmx - cx;
      const mdy = pmy - cy;
      const md = Math.sqrt(mdx * mdx + mdy * mdy);
      const mouseIn = md < R;

      const falloff = clamp(1 - dist / R, 0, 1);
      const mouseFalloff = mouseIn ? clamp(1 - md / R, 0, 1) : 0;

      // Tangential acceleration (soft, not too violent).
      const swirlA = (0.05 + 0.18 * mouseFalloff) * falloff;
      const tx = -dy / dist;
      const ty = dx / dist;

      s.vx = clamp((Number(s.vx || 0) + tx * swirlA) * 0.985, -1.6, 1.6);
      s.vy = clamp((s.vy + ty * swirlA * 0.22) * 0.995, 0.1, 2.2);

      // Confine snow to globe: if outside, respawn near top inside.
      if (!inside) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * (R * 0.96);
        s.x = Math.cos(a) * rr;
        s.y = cy + Math.sin(a) * rr;
        s.vx = 0;
        s.vy = randBetween(0.35, 1.35);
      }
    }

    if (s.y > h * 1.12) {
      s.y = -h * 0.12;
      s.x = randBetween(-w * 0.55, w * 0.55);
      s.vx = 0;
    }

    const yaw = state.yaw;
    const pitch = state.pitch;

    const ry = rotateY(s.x, s.z, yaw);
    const rx = rotateX(s.y - h * 0.15, ry.z, pitch);

    const proj = projectPoint(ry.x, rx.y + h * 0.15, rx.z);

    const a = 0.12 + 0.18 * Math.sin(now * 0.0014 + s.phase) + boost * 0.10;
    const r = s.size * (0.75 + proj.s * 0.55);

    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function onPointerMove(ev) {
    if (state.settings?.freefly) return;
    state.pointerPx = ev.clientX;
    state.pointerPy = ev.clientY;
    const x = (ev.clientX / state.w) * 2 - 1;
    const y = (ev.clientY / state.h) * 2 - 1;
    state.targetMouseX = x;
    state.targetMouseY = y;
  }

  function onTouchMove(ev) {
    if (state.settings?.freefly) return;
    if (!ev.touches || ev.touches.length === 0) return;
    const t = ev.touches[0];
    state.pointerPx = t.clientX;
    state.pointerPy = t.clientY;
    const x = (t.clientX / state.w) * 2 - 1;
    const y = (t.clientY / state.h) * 2 - 1;
    state.targetMouseX = x;
    state.targetMouseY = y;
  }

  function drawFireworkDot({ col, rr, tw }) {
    // More minimal / softer than tree lights.
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 5.4);
    grad.addColorStop(0, rgb(col, 0.34 + tw * 0.14));
    grad.addColorStop(0.32, rgb(col, 0.10 + tw * 0.06));
    grad.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 2.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgb(col, 0.72);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.7, rr * 0.82), 0, Math.PI * 2);
    ctx.fill();
  }

  function maybeSpawnFirework(now) {
    const enabled = Boolean(state.settings?.fireworks);
    if (!enabled) return;

    const perf = Boolean(state.settings?.perf);
    const fps = state.perfStats.fps || 60;
    const fpsFactor = clamp(fps / 60, 0.45, 1.1);
    const max = Math.floor((perf ? 150 : 360) * fpsFactor);
    if (fireworks.length > max) return;

    // Spawn rate ~ every 950-1600ms, adaptively slowed down on low FPS.
    if (!maybeSpawnFirework._next || now >= maybeSpawnFirework._next) {
      const base = perf ? 1350 : 1050;
      const slow = clamp(60 / Math.max(20, fps), 1, 2.6);
      maybeSpawnFirework._next = now + randBetween(base * slow, (base + 650) * slow);

      const maxR = state.scene.maxR || Math.min(state.w, state.h) * 0.23;
      const topY = state.scene.topY || state.h * 0.18;
      const bottomY = state.scene.bottomY || state.h * 0.86;

      const x = randBetween(-maxR * 0.55, maxR * 0.55);
      const z = randBetween(-maxR, maxR) * 0.35;
      const y = bottomY + randBetween(40, 110);

      const vy = randBetween(-4.6, -6.2) * (perf ? 0.95 : 1);
      const vx = randBetween(-0.18, 0.18);
      const vz = randBetween(-0.12, 0.12);

      fireworks.push(
        new Firework({
          x,
          y,
          z,
          vx,
          vy,
          vz,
          radius: randBetween(1.2, 2.2) * (state.settings?.size ?? 1),
          color: Math.floor(Math.random() * (palette.length - 1)),
          life: randBetween(820, 1100),
          drag: 0.992,
          kind: 'rocket',
        })
      );

      // Keep bursts in the upper half.
      maybeSpawnFirework._burstY = randBetween(topY + 30, topY + (bottomY - topY) * 0.35);
    }
  }

  function burstFirework(fw) {
    const perf = Boolean(state.settings?.perf);
    const fps = state.perfStats.fps || 60;
    const fpsFactor = clamp(fps / 60, 0.5, 1.05);
    const count = Math.floor((perf ? 14 : 22) * fpsFactor);
    const baseSpd = perf ? 1.45 : 1.7;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + randBetween(-0.12, 0.12);
      const sp = baseSpd * randBetween(0.7, 1.35);
      fireworks.push(
        new Firework({
          x: fw.x,
          y: fw.y,
          z: fw.z,
          vx: Math.cos(a) * sp * randBetween(0.75, 1.1),
          vy: Math.sin(a) * sp * randBetween(0.75, 1.1),
          vz: randBetween(-0.45, 0.45) * sp,
          radius: randBetween(1.1, 2.3) * (state.settings?.size ?? 1),
          color: fw.color,
          life: randBetween(820, 1280),
          drag: 0.985,
          kind: 'spark',
        })
      );
    }
  }

  function updateAndDrawFireworks(now) {
    const enabled = Boolean(state.settings?.fireworks);
    if (!enabled) {
      if (fireworks.length) fireworks.length = 0;
      return;
    }

    maybeSpawnFirework(now);

    const dt = 16;
    const g = 0.0105;
    const burstY = maybeSpawnFirework._burstY ?? state.h * 0.28;

    for (let i = fireworks.length - 1; i >= 0; i--) {
      const fw = fireworks[i];
      fw.life -= dt;
      if (fw.life <= 0) {
        fireworks.splice(i, 1);
        continue;
      }

      fw.vx *= fw.drag;
      fw.vy *= fw.drag;
      fw.vz *= fw.drag;

      if (fw.kind === 'spark') fw.vy += g * dt;

      fw.x += fw.vx * dt;
      fw.y += fw.vy * dt;
      fw.z += fw.vz * dt;

      if (fw.kind === 'rocket' && fw.y <= burstY) {
        // Burst and remove rocket
        burstFirework(fw);
        fireworks.splice(i, 1);
        continue;
      }

      // Draw
      const ry = rotateY(fw.x, fw.z, state.yaw);
      const rx = rotateX(fw.y - state.h * 0.15, ry.z, state.pitch);
      const proj = projectPoint(ry.x, rx.y + state.h * 0.15, rx.z);

      // Skip if far outside viewport.
      if (proj.x < -80 || proj.x > state.w + 80 || proj.y < -120 || proj.y > state.h + 120) continue;

      const tw = 0.6 + 0.4 * Math.sin(now * 0.004 + fw.phase);
      const rr = fw.radius * (0.85 + proj.s * 0.55);
      const col = palette[fw.color] || palette[0];

      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.scale(proj.s, proj.s);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fw.kind === 'rocket' ? 0.75 : 0.68;
      drawFireworkDot({ col, rr, tw });
      ctx.restore();
    }
  }

  function tick(now) {
    state.t = now;

    updatePerfStats(now);

    // smooth input
    state.mouseX = lerp(state.mouseX, state.targetMouseX, 0.08);
    state.mouseY = lerp(state.mouseY, state.targetMouseY, 0.08);

    const mouseStrength = state.settings?.mouse ?? 1;

    if (state.settings?.freefly) {
      const spd = state.settings?.freeflySpeed ?? 1;
      state.yaw = Math.sin(now * 0.00033 * spd) * 0.55;
      state.pitch = Math.sin(now * 0.00027 * spd + 1.2) * 0.22;
    } else {
      state.yaw = state.mouseX * 0.9 * mouseStrength;
      state.pitch = -state.mouseY * 0.45 * mouseStrength;
    }

    const sway = state.settings?.sway ?? 0;
    const swayA = Math.sin(now * 0.00055) * sway * 0.18;

    // background (theme-aware)
    ctx.fillStyle = state.scene.bgGradient || '#000';
    ctx.fillRect(0, 0, state.w, state.h);

    const mode = String(state.settings?.mode || 'default');
    const isGlobe = mode === 'globe';

    // Globe mask: only render tree/snow/fireworks inside the globe.
    let globeCx = 0;
    let globeCy = 0;
    let globeR = 0;
    if (isGlobe) {
      const base = Math.min(state.w, state.h);
      globeCx = state.w * 0.5;
      globeCy = state.h * 0.55;
      globeR = base * 0.42;
      ctx.save();
      ctx.beginPath();
      ctx.arc(globeCx, globeCy, globeR, 0, Math.PI * 2);
      ctx.clip();
    }

    const ordered = lights
      .map((p) => {
        const ry = rotateY(p.x, p.z, state.yaw + swayA * p.drift);
        const rx = rotateX(p.y - state.h * 0.15, ry.z, state.pitch);
        const proj = projectPoint(ry.x, rx.y + state.h * 0.15, rx.z);
        return { p, proj, z: rx.z };
      })
      .sort((a, b) => a.z - b.z);

    for (const it of ordered) {
      ctx.save();
      ctx.translate(it.proj.x, it.proj.y);
      ctx.scale(it.proj.s, it.proj.s);
      drawLight(it.p, now);
      ctx.restore();
    }

    if (state.settings?.snow) {
      ensureSnowCount(now);
      for (const s of snow) drawSnow(s, now);
    }

    updateAndDrawFireworks(now);

    if (isGlobe) {
      ctx.restore();

      // Dim outside globe + add soft edge
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 0, state.w, state.h);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(globeCx, globeCy, globeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Edge vignette ring
      ctx.save();
      const ring = ctx.createRadialGradient(globeCx, globeCy, globeR * 0.80, globeCx, globeCy, globeR * 1.06);
      ring.addColorStop(0, 'rgba(255,255,255,0)');
      ring.addColorStop(0.82, 'rgba(255,255,255,0.03)');
      ring.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(globeCx, globeCy, globeR * 1.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (state.loop.running) {
      state.loop.rafId = requestAnimationFrame(tick);
    }
  }

  function init() {
    resize();
    // start centered
    state.targetMouseX = 0;
    state.targetMouseY = 0;

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    state.loop.running = true;
    state.loop.rafId = requestAnimationFrame(tick);

    // Pause rendering when the tab is hidden to save battery/CPU.
    // Resume smoothly by resetting perf dt tracking.
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          state.loop.running = false;
          if (state.loop.rafId) cancelAnimationFrame(state.loop.rafId);
          state.loop.rafId = 0;
          return;
        }
        state.perfStats.lastNow = 0;
        state.loop.running = true;
        if (!state.loop.rafId) state.loop.rafId = requestAnimationFrame(tick);
      },
      { passive: true }
    );
  }

  function setSettings(partial, { rebuild } = { rebuild: false }) {
    const next = { ...(partial || {}) };
    // Topper was removed for performance; ignore legacy settings.
    if (Object.prototype.hasOwnProperty.call(next, 'topper')) delete next.topper;
    state.settings = { ...state.settings, ...next };
    if (Object.prototype.hasOwnProperty.call(next, 'zoom')) applyZoomToFov();
    if (rebuild) buildScene();
  }

  function getSettings() {
    return { ...state.settings };
  }

  function rebuild() {
    buildScene();
  }

  function triggerBoost({ durationMs = 4200, strength = 1 } = {}) {
    const now = state.t || performance.now();
    const dur = clamp(Number(durationMs) || 4200, 800, 12000);
    const str = clamp(Number(strength) || 1, 0, 2);
    state.boost.start = now;
    state.boost.duration = dur;
    state.boost.until = now + dur;
    state.boost.strength = str;
  }

  function handleDeviceOrientation(event) {
    if (!state.settings?.gyroSnow || !state.gyro.enabled) return;
    
    // Update gyro state with device orientation
    state.gyro.alpha = event.alpha || 0;
    state.gyro.beta = event.beta || 0;
    state.gyro.gamma = event.gamma || 0;
  }

  async function requestGyroPermission() {
    // Check if DeviceOrientationEvent is available
    if (!window.DeviceOrientationEvent) {
      state.gyro.permission = 'denied';
      return false;
    }

    // For iOS 13+ devices, we need to request permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          state.gyro.permission = 'granted';
          state.gyro.enabled = true;
          window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
          return true;
        } else {
          state.gyro.permission = 'denied';
          return false;
        }
      } catch (error) {
        console.warn('Error requesting device orientation permission:', error);
        state.gyro.permission = 'denied';
        return false;
      }
    } else {
      // For other devices, just start listening
      state.gyro.permission = 'granted';
      state.gyro.enabled = true;
      window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
      return true;
    }
  }

  function initGyroSensor() {
    // Only attempt on mobile/tablet devices or if gyro is explicitly supported
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile && !window.DeviceOrientationEvent) {
      state.gyro.permission = 'denied';
      return;
    }

    // For devices that need permission request, wait for user interaction
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      // iOS 13+ requires user interaction, so we'll request on first touch/click
      const requestOnInteraction = async () => {
        const granted = await requestGyroPermission();
        if (granted) {
          // Remove the listener after successful permission
          window.removeEventListener('click', requestOnInteraction);
          window.removeEventListener('touchstart', requestOnInteraction);
        }
      };
      
      window.addEventListener('click', requestOnInteraction, { once: true, passive: true });
      window.addEventListener('touchstart', requestOnInteraction, { once: true, passive: true });
    } else if (window.DeviceOrientationEvent) {
      // For devices that don't need permission, start immediately
      state.gyro.permission = 'granted';
      state.gyro.enabled = true;
      window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
    }
  }

  // Rebuild background if theme changes.
  window.addEventListener(
    'cdthemechange',
    () => {
      rebuildBackgroundGradient();
    },
    { passive: true }
  );

  window.CD_Scene = Object.freeze({ setSettings, getSettings, rebuild, triggerBoost });

  init();
  initGyroSensor();
})();
