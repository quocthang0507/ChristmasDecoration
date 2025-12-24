import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('immersive');

const elPanelToggle = document.getElementById('im-panel-toggle');
const elCamBtn = document.getElementById('im-camera');
const elUpload = document.getElementById('im-upload');
const elGesture = document.getElementById('im-gesture');
const elStatus = document.getElementById('im-status');
const elVideo = document.getElementById('im-video');
const elVideoWrap = document.getElementById('im-video-wrap');
const elSkeleton = document.getElementById('im-skeleton');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function createGlowSpriteTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  // White-to-transparent: color comes from vertex colors.
  // Brighter core + smoother halo (closer to a light/bokeh dot).
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.08, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.58)');
  grad.addColorStop(0.48, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');

  g.clearRect(0, 0, size, size);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function setStatus(text) {
  if (elStatus) elStatus.textContent = String(text || '');
}

function setGesture(text) {
  if (elGesture) elGesture.textContent = String(text || '—');
}

function readCssColor(name, fallback = 'rgba(255,255,255,0.9)') {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    const s = String(raw || '').trim();
    return s || fallback;
  } catch {
    return fallback;
  }
}

function setPreviewVisible(on) {
  if (!elVideoWrap) return;
  elVideoWrap.classList.toggle('is-on', Boolean(on));
}

function ensureSkeletonCanvasSize() {
  if (!elSkeleton || !elVideo) return;
  const w = elVideo.videoWidth || 0;
  const h = elVideo.videoHeight || 0;
  if (!w || !h) return;
  if (elSkeleton.width !== w) elSkeleton.width = w;
  if (elSkeleton.height !== h) elSkeleton.height = h;
}

const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

function drawHandOverlay(results) {
  if (!elSkeleton) return;
  const ctx2d = elSkeleton.getContext('2d');
  if (!ctx2d) return;

  ensureSkeletonCanvasSize();

  const w = elSkeleton.width;
  const h = elSkeleton.height;
  if (!w || !h) return;

  ctx2d.clearRect(0, 0, w, h);

  const hand = results?.multiHandLandmarks?.[0];
  if (!hand) return;

  const stroke = readCssColor('--ui-text-strong', 'rgba(255,255,255,0.9)');
  const fill = readCssColor('--ui-text', 'rgba(255,255,255,0.82)');

  ctx2d.lineWidth = 3;
  ctx2d.strokeStyle = stroke;
  ctx2d.fillStyle = fill;

  ctx2d.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    const s = hand[a];
    const e = hand[b];
    if (!s || !e) continue;
    ctx2d.moveTo(s.x * w, s.y * h);
    ctx2d.lineTo(e.x * w, e.y * h);
  }
  ctx2d.stroke();

  for (const p of hand) {
    ctx2d.beginPath();
    ctx2d.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
    ctx2d.fill();
  }
}

function parseCssColorToRGB(css) {
  // Supports rgb()/rgba() and hex (#rgb/#rrggbb). Falls back to white.
  const s = String(css || '').trim();
  const m1 = s.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/i);
  if (m1) return { r: Number(m1[1]) / 255, g: Number(m1[2]) / 255, b: Number(m1[3]) / 255 };

  const m2 = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m2) {
    const hex = m2[1].toLowerCase();
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r: r / 255, g: g / 255, b: b / 255 };
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r: r / 255, g: g / 255, b: b / 255 };
  }

  return { r: 1, g: 1, b: 1 };
}

function mixRGB(a, b, t) {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

// Match the existing project palette (see scene.js) for a familiar colorful tree.
const PALETTE = [
  { r: 255 / 255, g: 90 / 255, b: 90 / 255 },
  { r: 255 / 255, g: 206 / 255, b: 71 / 255 },
  { r: 140 / 255, g: 255 / 255, b: 193 / 255 },
  { r: 103 / 255, g: 197 / 255, b: 255 / 255 },
  { r: 192 / 255, g: 137 / 255, b: 255 / 255 },
  { r: 255 / 255, g: 255 / 255, b: 255 / 255 },
];

// Derive “gold/silver/jade” tints from existing theme primitives.
const rgbStrong = parseCssColorToRGB(readCssColor('--ui-text-strong', 'rgba(255,255,255,0.9)'));
const rgbBg0 = parseCssColorToRGB(readCssColor('--scene-bg-0', '#07101d'));
const rgbBg1 = parseCssColorToRGB(readCssColor('--scene-bg-1', '#02040a'));
const rgbBg2 = parseCssColorToRGB(readCssColor('--scene-bg-2', '#000000'));

const tintSilver = mixRGB(rgbStrong, rgbBg0, 0.15);
const tintGold = mixRGB(rgbStrong, rgbBg1, 0.25);
const tintJade = mixRGB(rgbStrong, rgbBg0, 0.35);

// Three.js setup
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);

// Filmic tone mapping for a more "cinematic" bloom look (inspired by the reference).
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();

// Fog for depth (use existing scene background tone).
scene.fog = new THREE.FogExp2(new THREE.Color(rgbBg2.r, rgbBg2.g, rgbBg2.b), 0.095);

const cameraRig = new THREE.Group();
scene.add(cameraRig);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
camera.position.set(0, 0.5, 6.5);
cameraRig.add(camera);

// Lights (subtle)
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffffff, 0.75);
key.position.set(2.5, 3.5, 2.0);
scene.add(key);

// Postprocessing bloom
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.12);
composer.addPass(bloom);

// Environment reflections for ornaments (PMREM + RoomEnvironment).
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

// Starfield (subtle, performance-friendly)
{
  const STAR_COUNT = 700;
  const pos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // A loose sphere around origin.
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 18 + Math.random() * 55;
    pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(rgbStrong.r, rgbStrong.g, rgbStrong.b),
    size: 0.06,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const stars = new THREE.Points(g, mat);
  scene.add(stars);
}

// Particle system
const PARTICLES = 3200;

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLES * 3);
const targets = new Float32Array(PARTICLES * 3);
const colors = new Float32Array(PARTICLES * 3);

function seedTreeInitial() {
  // Start in a tree silhouette already, with colorful points like the other pages.
  setTargetsTree();
  for (let i = 0; i < PARTICLES; i++) {
    // Spawn near target with a little jitter so it "breathes" into place.
    const tx = targets[i * 3 + 0];
    const ty = targets[i * 3 + 1];
    const tz = targets[i * 3 + 2];

    positions[i * 3 + 0] = tx + (Math.random() - 0.5) * 0.55;
    positions[i * 3 + 1] = ty + (Math.random() - 0.5) * 0.55;
    positions[i * 3 + 2] = tz + (Math.random() - 0.5) * 0.55;

    // Colorful palette distribution (slightly biased toward white near the tip).
    const t = i / Math.max(1, PARTICLES - 1);
    const pickWhite = Math.random() < 0.12 + t * 0.08;
    const p = pickWhite ? PALETTE[5] : PALETTE[Math.floor(Math.random() * 5)];
    const fade = 0.78 + 0.22 * Math.random();
    colors[i * 3 + 0] = p.r * fade;
    colors[i * 3 + 1] = p.g * fade;
    colors[i * 3 + 2] = p.b * fade;
  }
}

function setTargetsTree() {
  // Cone-like tree with slight spiral.
  const height = 4.6;
  const baseR = 1.9;

  for (let i = 0; i < PARTICLES; i++) {
    const t = Math.pow(i / (PARTICLES - 1), 0.92);
    const y = lerp(-height * 0.45, height * 0.55, t);

    const r = (1 - t) * baseR * (0.9 + 0.1 * Math.random());
    const theta = (t * 14.5 + Math.random() * 0.35) * Math.PI * 2;

    const x = Math.cos(theta) * r + (Math.random() - 0.5) * 0.08;
    const z = Math.sin(theta) * r + (Math.random() - 0.5) * 0.08;

    targets[i * 3 + 0] = x;
    targets[i * 3 + 1] = y;
    targets[i * 3 + 2] = z;
  }
}

function explodeToNebula() {
  // Re-randomize targets outwards.
  for (let i = 0; i < PARTICLES; i++) {
    const r = Math.pow(Math.random(), 0.35) * 3.4;
    const a = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const rr = Math.sqrt(Math.max(0, 1 - u * u));

    targets[i * 3 + 0] = r * rr * Math.cos(a);
    targets[i * 3 + 1] = (r * u) * 0.85;
    targets[i * 3 + 2] = r * rr * Math.sin(a);
  }
}

seedTreeInitial();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 0.044,
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

// Make points look like glowing circular lights (not square pixels).
{
  const sprite = createGlowSpriteTexture();
  if (sprite) {
    material.map = sprite;
    material.alphaMap = sprite;
    material.transparent = true;
    material.needsUpdate = true;
  }
}

const points = new THREE.Points(geometry, material);
scene.add(points);

// Ornaments (simple PBR-ish spheres/bars) — use derived tints, not new colors.
const ornaments = new THREE.Group();
scene.add(ornaments);

function makeOrnamentBall(tint, scale = 1) {
  const geo = new THREE.SphereGeometry(0.08 * scale, 18, 14);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tint.r, tint.g, tint.b),
    metalness: 0.95,
    roughness: 0.22,
    emissive: new THREE.Color(tint.r, tint.g, tint.b).multiplyScalar(0.08),
    emissiveIntensity: 1,
  });
  return new THREE.Mesh(geo, mat);
}

function makeOrnamentBar(tint, scale = 1) {
  const geo = new THREE.BoxGeometry(0.16 * scale, 0.06 * scale, 0.06 * scale);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tint.r, tint.g, tint.b),
    metalness: 0.95,
    roughness: 0.18,
    emissive: new THREE.Color(tint.r, tint.g, tint.b).multiplyScalar(0.06),
    emissiveIntensity: 1,
  });
  return new THREE.Mesh(geo, mat);
}

function seedOrnaments() {
  ornaments.clear();
  const n = 26;
  for (let i = 0; i < n; i++) {
    const isBall = Math.random() < 0.7;
    const p = Math.random() < 0.22 ? PALETTE[5] : PALETTE[Math.floor(Math.random() * 5)];
    const tint = { r: p.r, g: p.g, b: p.b };
    const m = isBall ? makeOrnamentBall(tint, 1) : makeOrnamentBar(tint, 1);

    const y = lerp(-1.6, 2.2, Math.random());
    const rr = (1 - (y + 1.6) / 3.8) * 1.4;
    const a = Math.random() * Math.PI * 2;

    m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    m.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
    ornaments.add(m);
  }
}

seedOrnaments();

// Photo memory library
const photos = [];
let lastPhoto = null;

function addPhotoTextureFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve({ tex, url, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function placePhotoPlane(texInfo) {
  const aspect = texInfo.w / Math.max(1, texInfo.h);
  const h = 0.55;
  const w = h * aspect;

  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({
    map: texInfo.tex,
    transparent: true,
    metalness: 0.1,
    roughness: 0.85,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.isPhoto = true;

  // Auto-place based on current mode.
  if (mode === 'tree') {
    const y = lerp(-1.4, 2.0, Math.random());
    const rr = (1 - (y + 1.4) / 3.4) * 1.25;
    const a = Math.random() * Math.PI * 2;
    mesh.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
  } else {
    const r = Math.pow(Math.random(), 0.5) * 2.6;
    const a = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const rr = Math.sqrt(Math.max(0, 1 - u * u));
    mesh.position.set(r * rr * Math.cos(a), (r * u) * 0.7, r * rr * Math.sin(a));
  }

  photos.push(mesh);
  lastPhoto = mesh;
  scene.add(mesh);
}

// Interaction state
let mode = 'tree'; // 'nebula' | 'tree'
let treeSpin = 0;
let spinVel = 0;
let camYaw = 0;
let camYawVel = 0;

let pinchActive = false;
let pinchStart = 0;
let pinchCamStartZ = 0;
let pinchPhotoStartScale = 1;
let pinchDepth = 3.6;

const focusTarget = new THREE.Vector3(0, 0, 0);

function setMode(next) {
  if (next === mode) return;
  mode = next;

  if (mode === 'tree') {
    setTargetsTree();
    spinVel = 0.0075;
    setGesture('✊ Nắm đấm');
  } else {
    explodeToNebula();
    setGesture('🖐 Mở tay');
  }
}

// Animation loop
let lastNow = performance.now();

function animate(now) {
  const dt = clamp(now - lastNow, 8, 34);
  lastNow = now;

  // Morph particles toward targets
  const k = mode === 'tree' ? 0.062 : 0.045;
  for (let i = 0; i < PARTICLES * 3; i++) {
    positions[i] += (targets[i] - positions[i]) * k;
  }
  geometry.attributes.position.needsUpdate = true;

  // Spin tree gently
  if (mode === 'tree') {
    treeSpin += spinVel * dt;
    spinVel *= 0.995;
    spinVel = clamp(spinVel, -0.02, 0.02);
    points.rotation.y = treeSpin;
    ornaments.rotation.y = treeSpin;
  } else {
    points.rotation.y = lerp(points.rotation.y, 0, 0.025);
    ornaments.rotation.y = lerp(ornaments.rotation.y, 0, 0.025);
  }

  // Camera yaw inertia (wave)
  camYaw += camYawVel * dt;
  camYawVel *= 0.985;
  camYawVel = clamp(camYawVel, -0.0028, 0.0028);
  cameraRig.rotation.y = camYaw;

  // Camera focus
  if (pinchActive && lastPhoto) {
    camera.lookAt(focusTarget);
  } else {
    camera.lookAt(0, 0, 0);
  }

  // Keep photos facing camera
  for (const p of photos) {
    p.lookAt(camera.position);
  }

  composer.render();
  requestAnimationFrame(animate);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();

  bloom.setSize(w, h);
}

window.addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(animate);

// Panel collapse (reuse existing UI helper)
window.CD_UI?.initCornerPanel?.({
  panelSelector: '.card-ui__panel',
  toggleSelector: '#im-panel-toggle',
  storageKey: 'cd.immersive.panelCollapsed.v1',
  defaultCollapsed: true,
  collapsedLabel: '3D nhập vai',
  expandedLabel: 'Thu gọn',
});

// MediaPipe gesture recognition
let mpCamera = null;
let hands = null;

const history = {
  lastX: null,
  lastT: 0,
};

function lm(results, idx) {
  const hand = results?.multiHandLandmarks?.[0];
  if (!hand) return null;
  const p = hand[idx];
  if (!p) return null;
  return p;
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function detectGesture(results) {
  const wrist = lm(results, 0);
  const thumbTip = lm(results, 4);
  const indexTip = lm(results, 8);
  const middleTip = lm(results, 12);
  const ringTip = lm(results, 16);
  const pinkyTip = lm(results, 20);
  const indexMcp = lm(results, 5);
  if (!wrist || !thumbTip || !indexTip || !middleTip || !ringTip || !pinkyTip || !indexMcp) return { kind: 'none' };

  const palmRef = indexMcp;
  const fingers = [indexTip, middleTip, ringTip, pinkyTip];

  const avgFingerToPalm = fingers.reduce((acc, f) => acc + dist2(f, palmRef), 0) / fingers.length;
  const pinch = dist2(thumbTip, indexTip);

  const isPinch = pinch < 0.045;
  const isFist = avgFingerToPalm < 0.12;
  const isPalm = avgFingerToPalm > 0.18;

  return {
    kind: isPinch ? 'pinch' : isFist ? 'fist' : isPalm ? 'palm' : 'none',
    wristX: wrist.x,
    indexX: indexTip.x,
    indexY: indexTip.y,
    pinch,
  };
}

function applyGesture(g, now) {
  if (g.kind === 'fist') {
    setMode('tree');
    setGesture('✊ Nắm đấm');
    setStatus('Gom hạt thành cây thông');
    pinchActive = false;
    return;
  }

  if (g.kind === 'palm') {
    setMode('nebula');
    setGesture('🖐 Mở tay');
    setStatus('Tinh vân: vẫy để xoay');
    pinchActive = false;

    // In nebula mode, treat sustained open palm + horizontal motion as a “wave”.
    if (mode === 'nebula' && typeof g.wristX === 'number') {
      const x = g.wristX;
      if (history.lastX != null) {
        const dt = Math.max(1, now - history.lastT);
        const vx = (x - history.lastX) / dt;
        if (Math.abs(vx) > 0.00035) {
          camYawVel += clamp(vx * 2.2, -0.0012, 0.0012);
          setGesture('👋 Vẫy');
          setStatus('Xoay phối cảnh');
        }
      }
      history.lastX = x;
      history.lastT = now;
    }

    return;
  }

  if (g.kind === 'pinch') {
    setGesture('🤏 Chụm');
    setStatus('Zoom ảnh');

    // Focus/zoom on last uploaded photo if present.
    if (lastPhoto) {
      if (!pinchActive) {
        pinchActive = true;
        pinchStart = clamp(Number(g.pinch ?? 0.06), 0.02, 0.12);
        pinchCamStartZ = camera.position.z;
        pinchPhotoStartScale = Number(lastPhoto.scale?.x || 1);
        pinchDepth = clamp(camera.position.z - 1.8, 2.6, 5.2);
      }

      // Scale zoom by pinch distance: smaller pinch => closer.
      const p = clamp(Number(g.pinch ?? pinchStart), 0.02, 0.12);
      const p0 = clamp(Number(pinchStart || 0.06), 0.02, 0.12);

      const pinchScale = clamp(p / p0, 0.65, 1.65);

      // Gentle camera zoom (keeps immersion) + photo scaling (clear "phóng to").
      camera.position.z = lerp(camera.position.z, clamp(pinchCamStartZ * pinchScale, 2.2, 8.8), 0.12);
      const targetPhotoScale = clamp(pinchPhotoStartScale * (1 / pinchScale), 0.6, 3.2);
      lastPhoto.scale.setScalar(lerp(lastPhoto.scale.x, targetPhotoScale, 0.18));

      // Grab/move photo in 3D using index tip position.
      if (typeof g.indexX === 'number' && typeof g.indexY === 'number') {
        const ndc = new THREE.Vector3(g.indexX * 2 - 1, -(g.indexY * 2 - 1), 0.5);
        ndc.unproject(camera);
        const dir = ndc.sub(camera.position).normalize();
        const targetPos = camera.position.clone().add(dir.multiplyScalar(pinchDepth));
        lastPhoto.position.lerp(targetPos, 0.22);
      }

      // Update shared focus target used by animation loop.
      lastPhoto.getWorldPosition(focusTarget);
    }
    return;
  }

  // Reset pinch state when pinch is released.
  if (pinchActive) pinchActive = false;

  // Wave: when in nebula, rotate camera with inertia based on wrist X velocity.
  if (mode === 'nebula' && typeof g.wristX === 'number') {
    const x = g.wristX;
    if (history.lastX != null) {
      const dt = Math.max(1, now - history.lastT);
      const vx = (x - history.lastX) / dt;
      if (Math.abs(vx) > 0.00035) {
        // “Wave” detected.
        camYawVel += clamp(vx * 2.2, -0.0012, 0.0012);
        setGesture('👋 Vẫy');
        setStatus('Xoay phối cảnh');
      }
    }
    history.lastX = x;
    history.lastT = now;
  }
}

async function startCamera() {
  if (!window.Hands || !window.Camera) {
    setStatus('Thiếu MediaPipe (Hands/Camera).');
    return;
  }

  // Camera permissions won't work when opened as file://
  if (window.location?.protocol === 'file:') {
    setStatus('Không thể bật camera khi mở bằng file://. Hãy chạy server và mở qua http://localhost:<port>/immersive.html');
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Trình duyệt không hỗ trợ getUserMedia (camera).');
    return;
  }

  // Preflight permission for clearer error messages.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    // Immediately stop; MediaPipe Camera will request again.
    for (const t of stream.getTracks()) t.stop();
  } catch (err) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setStatus('Bạn đã từ chối quyền camera. Hãy cho phép camera trong trình duyệt + macOS Privacy & Security.');
      return;
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      setStatus('Không tìm thấy camera. Hãy kiểm tra thiết bị/cáp hoặc app khác đang chiếm camera.');
      return;
    }
    setStatus(`Không thể truy cập camera: ${name || 'lỗi không rõ'}`);
    return;
  }

  hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  hands.onResults((results) => {
    const now = performance.now();
    const g = detectGesture(results);
    if (g.kind === 'none') return;

    // Attach pinch distance for zoom heuristic.
    const thumbTip = lm(results, 4);
    const indexTip = lm(results, 8);
    if (thumbTip && indexTip) g.pinch = dist2(thumbTip, indexTip);

    drawHandOverlay(results);
    applyGesture(g, now);
  });

  mpCamera = new window.Camera(elVideo, {
    onFrame: async () => {
      await hands.send({ image: elVideo });
    },
    width: 640,
    height: 480,
  });

  try {
    await mpCamera.start();
    setStatus('Camera đang chạy.');
    if (elCamBtn) elCamBtn.textContent = 'Tắt camera';
    setPreviewVisible(true);
  } catch (err) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setStatus('Bị từ chối quyền camera. Kiểm tra quyền Site Settings và macOS Camera permission.');
      return;
    }
    setStatus(`Không thể bật camera: ${name || 'lỗi không rõ'} (gợi ý: dùng http://localhost hoặc https)`);
  }
}

async function stopCamera() {
  try {
    mpCamera?.stop();
  } catch {
    // ignore
  }
  mpCamera = null;
  hands = null;
  setStatus('Đã tắt camera.');
  if (elCamBtn) elCamBtn.textContent = 'Bật camera';
  setPreviewVisible(false);

  // Clear overlay
  if (elSkeleton) {
    const ctx2d = elSkeleton.getContext('2d');
    if (ctx2d) ctx2d.clearRect(0, 0, elSkeleton.width, elSkeleton.height);
  }
}

let camOn = false;

elCamBtn?.addEventListener('click', async () => {
  camOn = !camOn;
  if (camOn) await startCamera();
  else await stopCamera();
});

elUpload?.addEventListener('change', async () => {
  try {
    const files = Array.from(elUpload.files || []);
    if (!files.length) return;
    setStatus('Đang tải ảnh...');
    let ok = 0;
    for (const f of files) {
      try {
        const info = await addPhotoTextureFromFile(f);
        placePhotoPlane(info);
        ok++;
      } catch {
        // keep going
      }
    }
    setStatus(ok ? `Đã thêm ${ok} ảnh vào cảnh.` : 'Không thể đọc ảnh.');
  } catch {
    setStatus('Không thể đọc ảnh.');
  } finally {
    // allow re-upload same file
    elUpload.value = '';
  }
});

// Initial hint
setGesture('—');
setStatus('Mở panel để bật camera hoặc tải ảnh.');
