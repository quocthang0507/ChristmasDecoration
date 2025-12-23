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
    targetMouseX: 0,
    targetMouseY: 0,
    yaw: 0,
    pitch: 0,
    fov: 720,
    settings: {
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
    state.fov = clamp(base * 1.25, 520, 1000);

    buildScene();
  }

  function buildScene() {
    lights.length = 0;
    snow.length = 0;

    const w = state.w;
    const h = state.h;

    const topY = h * 0.18;
    const bottomY = h * 0.86;
    const treeHeight = bottomY - topY;
    const maxR = Math.min(w, h) * 0.23;

    const baseDensity = 0.00011;
    const densityMul = state.settings?.density ?? 1.0;
    const perf = Boolean(state.settings?.perf);
    const count = clamp(Math.floor(w * h * baseDensity * densityMul), perf ? 1200 : 1600, perf ? 5200 : 9000);

    const zRange = maxR * 1.15;

    const sizeMul = state.settings?.size ?? 1.0;

    for (let i = 0; i < count; i++) {
      const t = Math.pow(Math.random(), 0.72);
      const y = topY + t * treeHeight;

      const rAtY = t ** 0.9 * maxR;
      const theta = Math.random() * Math.PI * 2;

      const rr = Math.sqrt(Math.random()) * rAtY;
      const x = Math.cos(theta) * rr;
      const z = Math.sin(theta) * rr + randBetween(-zRange, zRange) * 0.22;

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

    if (state.settings?.topper) {
      // Single big topper with long rays (drawn in drawLight).
      lights.push(
        new Light({
          x: 0,
          y: topY - maxR * 0.095,
          z: 0,
          radius: 8.5 * sizeMul,
          colorIndex: 5,
          altColorIndex: 1,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 1.35,
          colorShiftSpeed: 0,
          kind: 'topper',
        })
      );
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

  function drawTopperRays({ col, tw, rr, now, perf }) {
    // Cleaner starburst: tapered rays (triangles) with gradient fills.
    // This avoids jagged/ugly strokes and looks more like lens flare.

    // Soft bloom behind everything
    const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 26);
    bloom.addColorStop(0, rgb(col, 0.26 + tw * 0.16));
    bloom.addColorStop(0.14, rgb(col, 0.14 + tw * 0.10));
    bloom.addColorStop(0.42, rgb(col, 0.06 + tw * 0.06));
    bloom.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 15, 0, Math.PI * 2);
    ctx.fill();

    // Extra subtle outer glow to soften the rays
    const outerGlow = ctx.createRadialGradient(0, 0, rr * 2, 0, 0, rr * 34);
    outerGlow.addColorStop(0, rgb(col, 0.10 + tw * 0.06));
    outerGlow.addColorStop(0.35, rgb(col, 0.04 + tw * 0.04));
    outerGlow.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 22, 0, Math.PI * 2);
    ctx.fill();

    function rayTriangle(angle, innerR, outerR, halfWidth, a0, a1) {
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const px = -sa * halfWidth;
      const py = ca * halfWidth;

      const x0 = ca * innerR;
      const y0 = sa * innerR;
      const x1 = ca * outerR;
      const y1 = sa * outerR;

      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, rgb(col, a1));
      g.addColorStop(0.35, rgb(col, a0));
      g.addColorStop(1, rgb(col, 0));

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 + px, y0 + py);
      ctx.lineTo(x0 - px, y0 - py);
      ctx.lineTo(x1, y1);
      ctx.closePath();
      ctx.fill();
    }

    const rayCount = perf ? 8 : 12;
    const baseRot = now * 0.00018;

    // Make rays less sharp: draw them with blur + shadow glow.
    // (Core dot is drawn outside this function, crisp.)
    const blurPx = rr * (perf ? 0.22 : 0.32);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
    ctx.shadowColor = rgb(col, 0.18 + tw * 0.10);
    ctx.shadowBlur = rr * (perf ? 3.2 : 4.6);

    // Long rays (soft)
    const longOuter = rr * (27 + 11 * tw);
    const longInner = rr * 1.8;
    const longHalfW = rr * 0.40;
    for (let i = 0; i < rayCount; i++) {
      const ang = baseRot + (i / rayCount) * Math.PI * 2;
      rayTriangle(ang, longInner, longOuter, longHalfW, 0.06 + tw * 0.06, 0.14 + tw * 0.08);
    }

    // Secondary rays (between long rays, smaller + brighter)
    const midOuter = rr * (17 + 8 * tw);
    const midInner = rr * 1.45;
    const midHalfW = rr * 0.34;
    for (let i = 0; i < rayCount; i++) {
      const ang = baseRot + (i / rayCount) * Math.PI * 2 + Math.PI / rayCount;
      rayTriangle(ang, midInner, midOuter, midHalfW, 0.08 + tw * 0.07, 0.18 + tw * 0.10);
    }

    // Cross flare (4 strong rays) for a nicer highlight
    const crossOuter = rr * (30 + 12 * tw);
    const crossInner = rr * 1.2;
    const crossHalfW = rr * 0.30;
    for (let k = 0; k < 4; k++) {
      const ang = baseRot * 0.7 + k * (Math.PI / 2);
      rayTriangle(ang, crossInner, crossOuter, crossHalfW, 0.07 + tw * 0.07, 0.16 + tw * 0.10);
    }

    ctx.restore();
    ctx.filter = 'none';
  }

  function drawLight(p, now) {
    const tw = 0.55 + 0.45 * Math.sin(now * 0.001 * p.twinkleSpeed + p.phase);
    const glowMul = (state.settings?.glow ?? 1) * (state.settings?.perf ? 0.8 : 1);

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

    if (p.kind === 'topper') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawTopperRays({ col, tw, rr, now, perf: Boolean(state.settings?.perf) });

      // Core dot (single big bright point)
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 7.6);
      grad.addColorStop(0, rgb(col, 0.75 + tw * 0.22));
      grad.addColorStop(0.22, rgb(col, 0.22 + tw * 0.10));
      grad.addColorStop(1, rgb(col, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rr * 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rgb(col, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1.2, rr * 0.95), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

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

    const wind = (state.settings?.wind ?? 0) * 0.9;

    s.y += s.vy;
    s.x += wind * (0.8 + 0.35 * Math.sin(now * 0.001 + s.phase));

    if (s.y > h * 1.12) {
      s.y = -h * 0.12;
      s.x = randBetween(-w * 0.55, w * 0.55);
    }

    const yaw = state.yaw;
    const pitch = state.pitch;

    const ry = rotateY(s.x, s.z, yaw);
    const rx = rotateX(s.y - h * 0.15, ry.z, pitch);

    const proj = projectPoint(ry.x, rx.y + h * 0.15, rx.z);

    const a = 0.12 + 0.18 * Math.sin(now * 0.0014 + s.phase);
    const r = s.size * (0.75 + proj.s * 0.55);

    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
    ctx.fill();
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

  function tick(now) {
    state.t = now;

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

    // background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, state.w, state.h);

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
      for (const s of snow) drawSnow(s, now);
    }

    requestAnimationFrame(tick);
  }

  function init() {
    resize();
    // start centered
    state.targetMouseX = 0;
    state.targetMouseY = 0;

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    requestAnimationFrame(tick);
  }

  function setSettings(partial, { rebuild } = { rebuild: false }) {
    state.settings = { ...state.settings, ...(partial || {}) };
    if (rebuild) buildScene();
  }

  function getSettings() {
    return { ...state.settings };
  }

  function rebuild() {
    buildScene();
  }

  window.CD_Scene = Object.freeze({ setSettings, getSettings, rebuild });

  init();
})();
