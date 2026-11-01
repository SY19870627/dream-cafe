// 我單方面辭退老闆後，開了一間夢想中的咖啡店 — 2.5D 紙片原型
// 3D 房間 + 2D 紙片（billboard）擺飾與人物，驗證手機直立的顧客視角。
import * as THREE from 'three';
import * as A from './art.js';

const PPM = A.SIZES.PPM;
const $ = (id) => document.getElementById(id);

/* ---------- 開發者模式：網址加 ?dev=1（測試可再加 &speed=20 讓動作加速） ---------- */
const params = new URLSearchParams(location.search);
const DEV = params.get('dev') === '1';
const DEV_SPEED = DEV ? Math.max(1, Number(params.get('speed')) || 1) : 1;

/* ---------- 基本設定 ---------- */
const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fitOverview();
}
window.addEventListener('resize', resize);

/* ---------- 房間 ---------- */
const ROOM = { w: 6, d: 8, h: 3.2 };
const lambert = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra });

const floorTex = A.tex(A.woodFloor(), [3, 4]);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), lambert(floorTex));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

function addWall(w, x, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), lambert(A.tex(A.wall(w, ROOM.h))));
  m.position.set(x, ROOM.h / 2, z);
  m.rotation.y = ry;
  scene.add(m);
  return m;
}
addWall(ROOM.w, 0, -ROOM.d / 2, 0); // 後牆
addWall(ROOM.d, -ROOM.w / 2, 0, Math.PI / 2); // 左牆
addWall(ROOM.d, ROOM.w / 2, 0, -Math.PI / 2); // 右牆（吧台後）
const frontWall = addWall(ROOM.w, 0, ROOM.d / 2, Math.PI); // 前牆，只在坐下時顯示

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), lambert(A.tex(A.ceiling(ROOM.w, ROOM.d))));
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ROOM.h;
scene.add(ceiling);

// 窗戶（不受光照影響，自己發亮）
const winTex = { day: A.tex(A.windowView(false)), night: A.tex(A.windowView(true)) };
const windows = [];
function addWindow(x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), new THREE.MeshBasicMaterial({ map: winTex.day }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
  windows.push(m);
}
addWindow(-1.7, 1.75, -ROOM.d / 2 + 0.02, 0);
addWindow(-ROOM.w / 2 + 0.02, 1.7, -0.6, Math.PI / 2);

// 吧台後方層架
const backBar = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), lambert(A.tex(A.backBar(2.8, 1.8)), { transparent: true, alphaTest: 0.1 }));
backBar.position.set(ROOM.w / 2 - 0.02, 1.85, -1.6);
backBar.rotation.y = -Math.PI / 2;
scene.add(backBar);

// 牆上的老溫度計
const thermoMat = new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.1 });
const thermo = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.9), thermoMat);
thermo.position.set(1.4, 1.65, -ROOM.d / 2 + 0.02);
scene.add(thermo);
// 溫度上升時，溫度計後面亮起一圈暖光
const thermoGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4),
  new THREE.MeshBasicMaterial({ map: A.tex(A.glow()), color: '#ffb066', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
thermoGlow.position.set(1.4, 1.65, -ROOM.d / 2 + 0.01);
thermoGlow.visible = false;
scene.add(thermoGlow);

// 吧台（實體盒子；大型家具用立體，小擺飾與人物用紙片）
const wood = new THREE.MeshLambertMaterial({ color: '#8a5a3b' });
const woodTop = new THREE.MeshLambertMaterial({ color: '#5e3c28' });
const counter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 3.4), wood);
counter.position.set(2.0, 0.5, -1.5);
scene.add(counter);
const counterTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 3.5), woodTop);
counterTop.position.set(2.0, 1.03, -1.5);
scene.add(counterTop);

function table(x, z, h = 0.74, r = 0.38) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 32), woodTop);
  top.position.y = h;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 12), new THREE.MeshLambertMaterial({ color: '#3a3330' }));
  leg.position.y = h / 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 24), leg.material);
  foot.position.y = 0.015;
  g.add(top, leg, foot);
  g.position.set(x, 0, z);
  scene.add(g);
  return { x, z, h };
}

// 吊燈
const pendants = [];
for (const z of [-2.5, -0.7]) {
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd59a', side: THREE.DoubleSide }));
  shade.position.set(2.0, 2.45, z);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.65), new THREE.MeshBasicMaterial({ color: '#222' }));
  cord.position.set(2.0, 2.87, z);
  const light = new THREE.PointLight('#ffb46b', 6, 0, 1.6);
  light.position.set(2.0, 2.3, z);
  scene.add(shade, cord, light);
  pendants.push({ shade, light });
}

/* ---------- 光線 ---------- */
const hemi = new THREE.HemisphereLight('#dfe8ff', '#a8865f', 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.0);
sun.position.set(-6, 5, -1.5);
scene.add(sun);
const lampLight = new THREE.PointLight('#ffb46b', 0, 0, 1.6);
scene.add(lampLight);

/* ---------- 紙片 ---------- */
const papers = [];
const blobTex = A.tex(A.blob());

function paper(canvas, x, z, opt = {}) {
  const w = canvas.width / PPM, h = canvas.height / PPM;
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
  const mat = new THREE.MeshLambertMaterial({ map: A.tex(canvas), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = opt.y || 0;
  group.add(mesh);
  if (opt.shadow !== false && !opt.y) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.1, Math.max(0.25, w * 0.5)), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.005;
    group.add(s);
    group.userData.shadow = s;
  }
  group.position.set(x, 0, z);
  group.userData = { ...group.userData, mesh, base: opt.base ?? 0, clamp: opt.clamp ?? Math.PI, name: opt.name };
  scene.add(group);
  papers.push(group);
  return group;
}

function setPaper(p, canvas) {
  p.userData.mesh.material.map.dispose();
  p.userData.mesh.material.map = A.tex(canvas);
  p.userData.mesh.material.needsUpdate = true;
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function faceCamera() {
  for (const p of papers) {
    const yaw = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
    const d = THREE.MathUtils.clamp(wrapAngle(yaw - p.userData.base), -p.userData.clamp, p.userData.clamp);
    p.rotation.y = p.userData.base + d;
    if (p.userData.shadow) p.userData.shadow.rotation.z = -p.rotation.y; // 影子保持朝地
  }
}

/* ---------- 座位 ---------- */
const tA = table(-2.2, -0.6);
const tC = table(-1.45, 2.4, 0.45, 0.42);
const tY = table(-0.4, -2.3, 0.74, 0.34);

const SEATS = [
  {
    id: 'window', name: '窗邊座',
    eye: new THREE.Vector3(-1.9, 1.15, 0.3), look: new THREE.Vector3(-1.75, 0.85, -3.6),
    cup: new THREE.Vector3(-1.9, tA.h + 0.02, -0.62), serve: new THREE.Vector3(-1.55, 0, -0.9),
    prop: paper(A.chair(), -1.9, 0.15, { name: 'chair' }),
  },
  {
    id: 'bar', name: '吧台座',
    eye: new THREE.Vector3(0.75, 1.42, -0.9), look: new THREE.Vector3(2.6, 1.4, -1.6),
    cup: new THREE.Vector3(1.72, 1.06, -1.22), serve: null,
    prop: paper(A.stool(), 1.3, -1.0, { name: 'stool' }),
  },
  {
    id: 'sofa', name: '角落沙發',
    eye: new THREE.Vector3(-2.05, 1.0, 3.25), look: new THREE.Vector3(1.0, 0.95, -2.4),
    cup: new THREE.Vector3(-1.35, tC.h + 0.02, 2.3), serve: new THREE.Vector3(-0.8, 0, 2.0),
    prop: paper(A.sofa(), -2.1, 3.3, { base: Math.PI * 0.85, clamp: 0.7, name: 'sofa' }),
  },
];
paper(A.stool(), 1.3, -2.1);
paper(A.stool(), 1.3, -2.9);

// 吧台上的手沖架
/* ---------- 吧台上的手沖器具（立體小物，沖煮過程用動作呈現） ---------- */
const TOP = 1.06;
const M = {
  darkWood: new THREE.MeshLambertMaterial({ color: '#4a3326' }),
  steel: new THREE.MeshLambertMaterial({ color: '#c9ced2' }),
  ceramic: new THREE.MeshLambertMaterial({ color: '#f4f1ea', side: THREE.DoubleSide }),
  glass: new THREE.MeshLambertMaterial({ color: '#d6ecf2', transparent: true, opacity: 0.35, depthWrite: false }),
  coffee: new THREE.MeshLambertMaterial({ color: '#3f2010' }),
  grounds: new THREE.MeshLambertMaterial({ color: '#6b4428' }),
  water: new THREE.MeshBasicMaterial({ color: '#d9eef5', transparent: true, opacity: 0.7 }),
};
const cyl = (rt, rb, h, mat, seg = 24, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);

// 手搖磨豆機
const grinder = new THREE.Group();
const gBody = cyl(0.045, 0.05, 0.13, M.darkWood); gBody.position.y = 0.065;
const gBowl = cyl(0.05, 0.035, 0.04, M.steel); gBowl.position.y = 0.15;
const gHandle = new THREE.Group(); gHandle.position.y = 0.18;
const gArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.008, 0.014), M.steel); gArm.position.x = 0.05;
const gKnob = cyl(0.012, 0.012, 0.03, M.darkWood, 10); gKnob.position.set(0.1, 0.02, 0);
gHandle.add(gArm, gKnob);
grinder.add(gBody, gBowl, gHandle);
grinder.position.set(2.05, TOP, -2.05);
scene.add(grinder);

// 濾杯與下壺
const brewer = new THREE.Group();
const server = cyl(0.055, 0.05, 0.11, M.glass); server.position.y = 0.055;
const serverLiquid = cyl(0.048, 0.045, 1, M.coffee); serverLiquid.scale.y = 0.001; serverLiquid.position.y = 0.002;
const dripper = cyl(0.075, 0.03, 0.08, M.ceramic, 24, true); dripper.position.y = 0.155;
const groundsBed = cyl(0.045, 0.03, 0.03, M.grounds); groundsBed.position.y = 0.135; groundsBed.scale.set(1, 0.01, 1);
const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.grounds);
bloom.position.y = 0.145; bloom.scale.setScalar(0.001);
brewer.add(server, serverLiquid, dripper, groundsBed, bloom);
brewer.position.set(1.95, TOP, -1.7);
scene.add(brewer);

// 咖啡杯（每次沖煮做一個新的，端走後留在客人桌上）
const CUP_SCALE = 1.25; // 原本直徑 8 公分在手機上太不明顯，放大一點
const CUP_H = 0.07 * CUP_SCALE;
function makeCup() {
  const g = new THREE.Group();
  g.scale.setScalar(CUP_SCALE);
  const body = cyl(0.04, 0.034, 0.07, M.ceramic); body.position.y = 0.035;
  const saucer = cyl(0.07, 0.065, 0.008, M.ceramic); saucer.position.y = 0.004;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 16), M.ceramic);
  handle.position.set(0.048, 0.04, 0);
  const liquid = cyl(0.036, 0.036, 0.004, M.coffee); liquid.position.y = 0.066; liquid.visible = false;
  g.add(body, saucer, handle, liquid);
  g.userData.liquid = liquid;
  return g;
}
const CUP_SPOT = new THREE.Vector3(1.95, TOP, -1.35);
let stationCup = makeCup();
stationCup.position.copy(CUP_SPOT);
scene.add(stationCup);

// 手沖壺
const kettle = new THREE.Group();
const kBody = cyl(0.045, 0.05, 0.1, M.steel); kBody.position.y = 0.05;
const kLid = cyl(0.03, 0.04, 0.02, M.steel); kLid.position.y = 0.11;
const kHandle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 16, Math.PI), M.darkWood);
kHandle.position.set(0.05, 0.06, 0); kHandle.rotation.z = -Math.PI / 2;
const kSpout = cyl(0.005, 0.008, 0.15, M.steel, 10);
kSpout.position.set(-0.08, 0.08, 0); kSpout.rotation.z = 0.85;
const kTip = new THREE.Object3D(); kTip.position.set(-0.137, 0.13, 0);
kettle.add(kBody, kLid, kHandle, kSpout, kTip);
const KETTLE_REST = new THREE.Vector3(2.22, TOP, -1.25);
kettle.position.copy(KETTLE_REST);
scene.add(kettle);

// 水柱
const stream = cyl(0.0035, 0.0035, 1, M.water, 8);
stream.visible = false;
scene.add(stream);
function updateStream(targetY) {
  const tip = kTip.getWorldPosition(new THREE.Vector3());
  const len = Math.max(0.01, tip.y - targetY);
  stream.scale.y = len;
  stream.position.set(tip.x, tip.y - len / 2, tip.z);
}

// 予安（作家熟客）
const yuan = paper(A.yuan(), -0.4, -1.75);

// 可移動的擺飾
const DECOR = [
  paper(A.plant(), -2.55, -3.45, { name: '盆栽' }),
  paper(A.bookshelf(), -0.1, -3.72, { name: '書櫃', clamp: 0.9 }),
  paper(A.recordPlayer(), 0.75, -3.6, { name: '黑膠唱機', clamp: 1.0 }),
  paper(A.floorLamp(false), -2.6, 2.3, { name: '落地燈' }),
  paper(A.menuBoard(), 0.6, 1.6, { name: '黑板立牌' }),
];
const lamp = DECOR[3];

// 德叔與龍眼
const HOME = new THREE.Vector3(2.6, 0, -1.6);
const deshuCanvas = { idle: A.deshu('idle'), pour: A.deshu('pour') };
const deshu = paper(deshuCanvas.idle, HOME.x, HOME.z);
const catCanvas = { sleep: A.cat('sleep'), sit: A.cat('sit') };
const cat = paper(catCanvas.sleep, -2.3, -2.9);

/* ---------- 蒸氣 ---------- */
const puffTex = A.tex(A.puff());
const puffs = [];
function emitSteam(pos) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0.5, depthWrite: false }));
  s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.04));
  s.scale.setScalar(0.06);
  s.userData.life = 0;
  scene.add(s);
  puffs.push(s);
}
function updateSteam(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const s = puffs[i];
    s.userData.life += dt;
    s.position.y += dt * 0.12;
    s.scale.setScalar(0.06 + s.userData.life * 0.08);
    s.material.opacity = Math.max(0, 0.5 - s.userData.life * 0.25);
    if (s.userData.life > 2) { scene.remove(s); s.material.dispose(); puffs.splice(i, 1); }
  }
}

/* ---------- 溫度與任務 ---------- */
const state = { temp: 20, tasks: new Set(), sat: new Set(), devSpeed: DEV_SPEED, hold: false, night: false, mode: 'overview', seat: null, placing: false, selected: null };
// 遊戲時間的流速：開發者模式的倍率 × 沖煮中按住畫面的 ×3
const HOLD_SPEED = 3;
const speedNow = () => state.devSpeed * (state.hold && brewing ? HOLD_SPEED : 1);

let shownTemp = state.temp; // 畫面上顯示的溫度，會慢慢追上 state.temp
let drawnTemp = null;
function drawThermo() {
  const t = Math.round(shownTemp * 10) / 10;
  if (t === drawnTemp) return;
  drawnTemp = t;
  thermoMat.map?.dispose();
  thermoMat.map = A.tex(A.thermometer(t));
  thermoMat.needsUpdate = true;
  $('temp').textContent = t.toFixed(1) + '°C';
}
drawThermo();

// 溫度上升：數字與老溫度計用約兩秒慢慢爬上去，右上角與溫度計輕輕亮一下
function riseTemp(dT) {
  state.temp += dT;
  const from = shownTemp, to = state.temp;
  const badge = $('temp');
  badge.classList.remove('rise');
  void badge.offsetWidth; // 重新觸發 CSS 動畫
  badge.classList.add('rise');
  thermoGlow.visible = true;
  let t = 0;
  realWaiters.push((dt) => {
    t += dt;
    const k = Math.min(1, t / 2);
    shownTemp = from + (to - from) * ease(k);
    thermoGlow.material.opacity = Math.sin(Math.PI * Math.min(1, t / 3)) * 0.85;
    drawThermo();
    if (t >= 3) { thermoGlow.visible = false; return true; }
    return false;
  });
}

// 完成溫度任務：不跳任務清單，由角色的反應帶出（反應由呼叫端安排）
function task(id, dT) {
  if (state.tasks.has(id)) return false;
  state.tasks.add(id);
  riseTemp(dT);
  return true;
}

/* ---------- 對話泡泡（只用在角色說話） ---------- */
const bubble = $('bubble');
let bubbleTimer;
let speaker = null;
const NAMES = new Map();
function say(text, ms = 3500, who = deshu) {
  speaker = who;
  bubble.innerHTML = `<b>${NAMES.get(who) || ''}</b>${text}`;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  if (ms) bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}

const waiters = []; // 依遊戲時間推進（會被快轉、按住加速）
const realWaiters = []; // 依真實時間推進（介面動畫）
const wait = (sec) => animate(sec, () => {});
// 依遊戲時間推進的補間動畫；fn 收到 0→1 的進度
function animate(sec, fn) {
  return new Promise((r) => {
    let t = 0;
    waiters.push((dt) => {
      t += dt * speedNow();
      const k = Math.min(1, t / sec);
      fn(k);
      if (k >= 1) { r(); return true; }
      return false;
    });
  });
}
const ease = (k) => 0.5 - Math.cos(Math.PI * k) / 2;

function walk(p, to, speed = 0.7) {
  return new Promise((r) => {
    waiters.push((dt) => {
      const d = new THREE.Vector3(to.x - p.position.x, 0, to.z - p.position.z);
      const step = speed * dt * speedNow();
      if (d.length() <= step) { p.position.x = to.x; p.position.z = to.z; r(); return true; }
      d.setLength(step);
      p.position.add(d);
      p.userData.mesh.position.y = Math.abs(Math.sin(performance.now() / 160)) * 0.03; // 走路時輕微起伏
      return false;
    });
  });
}

// 「看了一眼」：紙片轉向另一邊一會兒再轉回來，不說話
async function glance(p, sec = 1.6) {
  const m = p.userData.mesh;
  await animate(0.35, (k) => { m.scale.x = 1 - 2 * ease(k); });
  await wait(sec);
  await animate(0.35, (k) => { m.scale.x = -1 + 2 * ease(k); });
  m.scale.x = 1;
}

/* ---------- 德叔沖咖啡：用動作呈現，不用文字描述 ---------- */
// 把手沖壺移到某個目標上方並傾斜
function moveKettle(target, sec = 0.9) {
  const from = kettle.position.clone(), fromRot = kettle.rotation.z;
  const to = target ? target.clone().add(new THREE.Vector3(0.18, 0.2, 0)) : KETTLE_REST.clone();
  const rot = target ? 0.5 : 0;
  return animate(sec, (k) => {
    const e = ease(k);
    kettle.position.lerpVectors(from, to, e);
    kettle.position.y += Math.sin(Math.PI * k) * 0.06;
    kettle.rotation.z = fromRot + (rot - fromRot) * e;
  });
}

const steamSources = new Set();
// brewing：從按下沖咖啡到杯子放上桌為止。
// phase：'wait'（等德叔走回吧台）→ 'brew'（吧台沖煮）→ 'serve'（端過來）
let brewing = false;
let phase = null;
let deshuReturning = null; // 德叔端完杯子走回吧台，是獨立的背景動作
const cups = [];
const CLOSE = { pos: new THREE.Vector3(0.95, 1.62, -0.35), look: new THREE.Vector3(2.3, 1.36, -1.65) };
const WALK = 0.85; // 德叔端杯的走速（公尺／秒）

// 正常速度下吧台沖煮約 19 秒：六個動作都保留，只縮短停頓與注水
async function brew(seat) {
  if (brewing) return;
  brewing = true;
  if (deshuReturning) {
    phase = 'wait';
    updateUI();
    await deshuReturning;
  }
  phase = 'brew';
  say('好，等我一下。', 2500);
  state.closeup = true;
  cam.yaw = 0; cam.pitch = 0;
  moveCamera(CLOSE.pos, CLOSE.look, 1.2);
  updateUI();
  await wait(1.2);

  const cupTop = CUP_SPOT.clone().add(new THREE.Vector3(0, CUP_H, 0));
  const dripTop = brewer.position.clone().add(new THREE.Vector3(0, 0.19, 0));
  const cupSteam = cupTop.clone().add(new THREE.Vector3(0, 0.02, 0));
  const dripSteam = dripTop.clone();

  // 1. 溫杯：熱水沖進杯子，冒出熱氣
  setPaper(deshu, deshuCanvas.pour);
  await moveKettle(cupTop);
  stream.visible = true;
  steamSources.add(cupSteam);
  await animate(1.6, () => updateStream(cupTop.y));
  stream.visible = false;
  await moveKettle(null, 0.7);
  setPaper(deshu, deshuCanvas.idle);

  // 2. 磨豆：把手轉動，濾杯裡的粉慢慢堆起來
  await wait(0.3);
  setPaper(deshu, deshuCanvas.pour);
  await animate(3.0, (k) => {
    gHandle.rotation.y = k * Math.PI * 10;
    grinder.position.x = 2.05 + Math.sin(k * 60) * 0.002;
    groundsBed.scale.y = Math.max(0.01, k);
  });
  setPaper(deshu, deshuCanvas.idle);
  await wait(0.3);

  // 3. 悶蒸：少量注水，粉層膨脹冒泡
  setPaper(deshu, deshuCanvas.pour);
  await moveKettle(dripTop);
  stream.visible = true;
  await animate(1.0, (k) => { updateStream(dripTop.y - 0.04); bloom.scale.set(k * 0.8, k * 0.5, k * 0.8); });
  stream.visible = false;
  steamSources.add(dripSteam);
  await animate(2.2, (k) => {
    const b = 0.8 + 0.2 * ease(k);
    bloom.scale.set(b, 0.5 + 0.5 * ease(k), b);
  });

  // 4. 注水：手沖壺繞小圈，下壺的咖啡慢慢升起
  stream.visible = true;
  const base = kettle.position.clone();
  await animate(4.6, (k) => {
    const a = k * Math.PI * 6;
    kettle.position.set(base.x + Math.cos(a) * 0.012, base.y, base.z + Math.sin(a) * 0.012);
    updateStream(dripTop.y - 0.04);
    serverLiquid.scale.y = 0.001 + k * 0.085;
    serverLiquid.position.y = serverLiquid.scale.y / 2 + 0.002;
  });
  stream.visible = false;
  await moveKettle(null, 0.7);
  setPaper(deshu, deshuCanvas.idle);
  await wait(0.4);

  // 5. 倒進杯子
  stationCup.userData.liquid.visible = true;
  await animate(1.2, (k) => {
    serverLiquid.scale.y = 0.086 * (1 - k) + 0.001;
    serverLiquid.position.y = serverLiquid.scale.y / 2 + 0.002;
  });
  steamSources.delete(cupSteam);
  steamSources.delete(dripSteam);

  // 6. 端上桌
  phase = 'serve';
  const cup = stationCup;
  const atSeat = () => state.mode === 'seat' && state.seat === seat;
  state.closeup = false;
  if (atSeat()) { cam.yaw = 0; cam.pitch = 0; moveCamera(seat.eye, seat.look); }
  updateUI();
  const path = [new THREE.Vector3(2.6, 0, 0.6), new THREE.Vector3(1.3, 0, 0.8), seat.serve];
  if (seat.serve) {
    say('好了，我端過去。', 2500);
    deshu.attach(cup);
    cup.position.set(0.32, 0.98, 0.12);
    cup.rotation.set(0, 0, 0);
    for (const pt of path) await walk(deshu, pt, WALK);
    deshu.userData.mesh.position.y = 0;
    scene.attach(cup);
    const from = cup.position.clone();
    await animate(0.8, (k) => { cup.position.lerpVectors(from, seat.cup, ease(k)); cup.position.y += Math.sin(Math.PI * k) * 0.05; });
  } else {
    const from = cup.position.clone();
    await animate(1.2, (k) => { cup.position.lerpVectors(from, seat.cup, ease(k)); cup.position.y += Math.sin(Math.PI * k) * 0.03; });
  }
  placeCup(cup, seat);
  say('東山的豆，就是窗外那片山。', 4500);

  // 收拾吧台，準備下一杯
  groundsBed.scale.y = 0.01;
  bloom.scale.setScalar(0.001);
  stationCup = makeCup();
  stationCup.position.copy(CUP_SPOT);
  scene.add(stationCup);

  // 杯子上桌就算數：沖咖啡結束、按鈕恢復，溫度在這一刻上升
  brewing = false;
  phase = null;
  state.hold = false;
  updateUI();
  const firstCup = task('first-coffee', 0.5);

  // 德叔走回吧台：背景動作，期間再按沖咖啡會等他回到吧台
  deshuReturning = (async () => {
    await wait(firstCup ? 2.6 : 1.8);
    if (firstCup) await glance(deshu); // 劇本：「德叔看了一眼溫度計，沒說話。」
    if (seat.serve) {
      for (const pt of [path[1], path[0], HOME]) await walk(deshu, pt, WALK);
      deshu.userData.mesh.position.y = 0;
    }
    deshuReturning = null;
  })();
}

// 杯子落桌：輕輕一沉一彈、冒一陣熱氣；同一個座位只留最新的一杯
function placeCup(cup, seat) {
  for (let i = cups.length - 1; i >= 0; i--) {
    if (cups[i].userData.seat === seat.id) { scene.remove(cups[i]); cups.splice(i, 1); }
  }
  cup.position.copy(seat.cup);
  cup.rotation.set(0, 0, 0);
  cup.userData.seat = seat.id;
  cup.userData.steamAt = cup.position.clone().add(new THREE.Vector3(0, CUP_H + 0.02, 0));
  cup.userData.age = 0;
  cups.push(cup);
  for (let i = 0; i < 4; i++) emitSteam(cup.userData.steamAt);
  let t = 0;
  realWaiters.push((dt) => {
    t += dt;
    const k = Math.min(1, t / 0.45);
    const s = 1 - Math.sin(Math.PI * k) * 0.12;
    cup.scale.set(CUP_SCALE * (2 - s), CUP_SCALE * s, CUP_SCALE * (2 - s));
    if (k >= 1) { cup.scale.setScalar(CUP_SCALE); return true; }
    return false;
  });
}

// 沖煮中可以在吧台特寫與自己的座位之間切換
function toggleCloseup() {
  if (!state.seat) return;
  state.closeup = !state.closeup;
  cam.yaw = 0; cam.pitch = 0;
  if (state.closeup) moveCamera(CLOSE.pos, CLOSE.look);
  else moveCamera(state.seat.eye, state.seat.look);
  updateUI();
}

/* ---------- 龍眼的散步 ---------- */
const CAT_SPOTS = [new THREE.Vector3(-2.3, 0, -2.9), new THREE.Vector3(-0.9, 0, 3.2), new THREE.Vector3(0.9, 0, 0.3), new THREE.Vector3(-2.4, 0, 1.2)];
let catBusy = false;
async function catWander() {
  if (catBusy) return;
  catBusy = true;
  const to = CAT_SPOTS[Math.floor(Math.random() * CAT_SPOTS.length)];
  setPaper(cat, catCanvas.sit);
  await walk(cat, to, 0.35);
  cat.userData.mesh.position.y = 0;
  await wait(2);
  setPaper(cat, catCanvas.sleep);
  catBusy = false;
}
setInterval(() => { if (Math.random() < 0.6) catWander(); }, 22000);

/* ---------- 白天／夜晚 ---------- */
function applyLight() {
  const n = state.night;
  hemi.color.set(n ? '#3a4466' : '#dfe8ff');
  hemi.groundColor.set(n ? '#2a1d14' : '#a8865f');
  hemi.intensity = n ? 0.35 : 1.6;
  sun.intensity = n ? 0 : 2.0;
  for (const p of pendants) p.light.intensity = n ? 9 : 3;
  lampLight.intensity = n ? 5 : 0;
  setPaper(lamp, A.floorLamp(n));
  for (const w of windows) { w.material.map = n ? winTex.night : winTex.day; w.material.needsUpdate = true; }
  scene.background = new THREE.Color(n ? '#13151d' : '#ece2d0');
  renderer.toneMappingExposure = n ? 1.15 : 1.0;
  $('night').textContent = n ? '夜晚 2700K' : '白天 5200K';
}

/* ---------- 鏡頭 ---------- */
const OVER = { pos: new THREE.Vector3(-0.3, 11.8, 7.4), look: new THREE.Vector3(0, 0, 0.1) };
const OVER_DIR = OVER.pos.clone().sub(OVER.look).normalize();
const cam = { pos: OVER.pos.clone(), look: OVER.look.clone(), yaw: 0, pitch: 0 };
let tween = null;

// 依畫面寬高比調整俯瞰距離：整間店的地板、後牆的溫度計高度、三個座位標籤，
// 都要落在上方標題列與下方按鈕之間（直立窄畫面原本會把角落沙發切掉一半）
const FIT_ROOM = [];
for (const x of [-ROOM.w / 2, ROOM.w / 2]) for (const z of [-ROOM.d / 2, ROOM.d / 2]) FIT_ROOM.push(new THREE.Vector3(x, 0, z));
FIT_ROOM.push(new THREE.Vector3(-ROOM.w / 2, 2.1, -ROOM.d / 2), new THREE.Vector3(ROOM.w / 2, 2.1, -ROOM.d / 2));
const UI_SPACE = { top: 64, bottom: 140, labelW: 62, labelH: 52 }; // 介面佔用的像素（約略）
function fitOverview() {
  const w = app.clientWidth, h = app.clientHeight;
  if (!w || !h) return;
  const probe = new THREE.PerspectiveCamera(50, w / h, 0.05, 80);
  const v = new THREE.Vector3();
  const top = 1 - (2 * UI_SPACE.top) / h, bottom = -1 + (2 * UI_SPACE.bottom) / h;
  const fits = (d) => {
    probe.position.copy(OVER.look).addScaledVector(OVER_DIR, d);
    probe.lookAt(OVER.look);
    probe.updateMatrixWorld();
    for (const p of FIT_ROOM) {
      v.copy(p).project(probe);
      if (Math.abs(v.x) > 0.96 || v.y > top || v.y < bottom) return false;
    }
    for (const s of SEATS) {
      v.copy(s.prop.position).setY(1.1).project(probe);
      if (Math.abs(v.x) > 1 - (2 * UI_SPACE.labelW) / w || v.y > top - (2 * UI_SPACE.labelH) / h || v.y < bottom) return false;
    }
    return true;
  };
  let lo = 6, hi = 60;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  OVER.pos.copy(OVER.look).addScaledVector(OVER_DIR, hi);
  if (state.mode === 'overview' && !tween) cam.pos.copy(OVER.pos);
}
function moveCamera(pos, look, dur = 1.4) {
  tween = { from: cam.pos.clone(), fromLook: cam.look.clone(), to: pos.clone(), toLook: look.clone(), t: 0, dur };
}
function updateCamera(dt) {
  if (tween) {
    tween.t += dt / tween.dur;
    const k = tween.t >= 1 ? 1 : 0.5 - Math.cos(Math.PI * tween.t) / 2;
    cam.pos.lerpVectors(tween.from, tween.to, k);
    cam.look.lerpVectors(tween.fromLook, tween.toLook, k);
    if (tween.t >= 1) tween = null;
  }
  const targetFov = state.mode === 'overview' ? 50 : state.closeup ? 52 : 72;
  if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  if (state.mode === 'overview') {
    const off = cam.pos.clone().sub(OVER.look).applyAxisAngle(new THREE.Vector3(0, 1, 0), cam.yaw);
    camera.position.copy(OVER.look).add(off);
    camera.lookAt(cam.look);
  } else {
    camera.position.copy(cam.pos);
    const dir = cam.look.clone().sub(cam.pos);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cam.yaw);
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    dir.applyAxisAngle(side, cam.pitch);
    camera.lookAt(cam.pos.clone().add(dir));
  }
}

function sit(seat) {
  state.mode = 'seat';
  state.seat = seat;
  state.placing = false;
  cam.yaw = 0; cam.pitch = 0;
  frontWall.visible = true;
  ceiling.visible = true;
  seat.prop.visible = false;
  moveCamera(seat.eye, seat.look);
  updateUI();
  state.sat.add(seat.id);
  if (state.sat.size === 1) setTimeout(() => say('不急，咖啡會等人，人也該等咖啡。'), 1500);
  // 【待定】坐遍三個座位時德叔的一句話（劇本只寫了任務，沒寫台詞）
  if (state.sat.size === SEATS.length && task('all-seats', 1)) setTimeout(() => say('每張椅子，都認得老闆了。'), 1800);
}

function stand() {
  state.closeup = false;
  state.seat.prop.visible = true;
  state.mode = 'overview';
  state.seat = null;
  cam.yaw = 0; cam.pitch = 0;
  frontWall.visible = false;
  ceiling.visible = false;
  moveCamera(OVER.pos, OVER.look);
  updateUI();
}

/* ---------- 介面 ---------- */
const labels = SEATS.map((s) => {
  const b = document.createElement('button');
  b.className = 'seat-label';
  b.textContent = s.name;
  b.onclick = () => sit(s);
  $('labels').appendChild(b);
  return b;
});

function updateUI() {
  const over = state.mode === 'overview';
  $('labels').style.display = over && !state.placing ? '' : 'none';
  $('stand').style.display = over ? 'none' : '';
  $('brew').style.display = over ? 'none' : '';
  $('brew').disabled = phase === 'wait' || phase === 'serve';
  $('brew').textContent = !brewing ? '請德叔沖一杯'
    : phase === 'wait' ? '德叔走回吧台…'
    : phase === 'serve' ? '德叔端過來了'
    : state.closeup ? '回座位' : '看德叔沖';
  $('place').style.display = over ? '' : 'none';
  $('place').textContent = state.placing ? '完成佈置' : '佈置';
  $('hint').textContent = over
    ? (state.placing ? (state.selected ? `已選：${state.selected.userData.name}，點地板放到那裡` : '點一件擺飾，再點地板移動它') : '點座位坐下，用客人的角度看看這間店')
    : brewing ? (state.hold ? '時間走快了一點……' : '按住畫面可以讓時間走快一點')
    : '左右拖曳環顧四周，點人物可以搭話';
}

$('stand').onclick = stand;
$('brew').onclick = () => { if (phase === 'brew') toggleCloseup(); else if (!brewing && state.seat) brew(state.seat); };
$('night').onclick = () => { state.night = !state.night; applyLight(); };
$('place').onclick = () => {
  state.placing = !state.placing;
  select(null);
  updateUI();
};
// 測試用的快轉鈕只在開發者模式出現
const speedLabel = () => (state.devSpeed === 1 ? '正常速度' : `快轉 ×${state.devSpeed}`);
$('speed').hidden = !DEV;
$('speed').textContent = speedLabel();
$('speed').onclick = () => {
  state.devSpeed = state.devSpeed === 1 ? (DEV_SPEED > 1 ? DEV_SPEED : 4) : 1;
  $('speed').textContent = speedLabel();
};

/* ---------- 選單：關於（開發者資訊）；之後的設定也放這裡 ---------- */
const about = $('about');
function openAbout(open) {
  about.hidden = !open;
  $('menu-btn').setAttribute('aria-expanded', String(open));
  if (open) $('about-close').focus();
}
$('menu-btn').onclick = () => openAbout(about.hidden);
$('about-close').onclick = () => openAbout(false);
about.addEventListener('click', (e) => { if (e.target === about) openAbout(false); }); // 點面板外面關閉
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !about.hidden) openAbout(false); });

function select(p) {
  if (state.selected) state.selected.userData.mesh.material.color.set('#ffffff');
  state.selected = p;
  if (p) p.userData.mesh.material.color.set('#ffd27a');
  updateUI();
}

/* ---------- 觸控 ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
// 沖煮中按住畫面：德叔的動作 ×3，放開恢復
function setHold(on) {
  on = on && brewing;
  if (state.hold === on) return;
  state.hold = on;
  updateUI();
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: cam.yaw, pitch: cam.pitch, held: brewing };
  setHold(true);
});
for (const ev of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(ev, () => setHold(false));
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (state.mode === 'seat') {
    cam.yaw = THREE.MathUtils.clamp(down.yaw + dx * 0.004, -1.2, 1.2);
    cam.pitch = THREE.MathUtils.clamp(down.pitch - dy * 0.003, -0.35, 0.35);
  } else if (!state.placing) {
    cam.yaw = THREE.MathUtils.clamp(down.yaw - dx * 0.004, -0.6, 0.6);
  }
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const longHold = down.held && performance.now() - down.t > 400; // 按住加速後放開，不算點擊
  down = null;
  if (moved > 10 || longHold) return;
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!state.placing) { talkTo(ray); return; }
  if (state.mode !== 'overview') return;
  const hit = ray.intersectObjects(DECOR.map((d) => d.userData.mesh))[0];
  if (hit) { select(DECOR.find((d) => d.userData.mesh === hit.object)); return; }
  if (state.selected) {
    const f = ray.intersectObject(floor)[0];
    if (f) {
      let x = THREE.MathUtils.clamp(f.point.x, -2.7, 2.7);
      const z = THREE.MathUtils.clamp(f.point.z, -3.75, 3.7);
      if (x > 1.45 && z < 0.4) x = 1.45; // 不能放進吧台
      state.selected.position.x = x;
      state.selected.position.z = z;
      // 劇本任務 #2「擺上第一件擺飾」；階段 2 有倉庫與購買後改成真的「擺上」
      if (task('first-decor', 0.5)) say('這個放這裡，從吧台看過去剛好。');
      select(null);
    }
  }
});

/* ---------- 點人物搭話 ---------- */
NAMES.set(deshu, '德叔').set(yuan, '予安').set(cat, '龍眼');
const HEAD = new Map([[deshu, 2.0], [yuan, 1.45], [cat, 0.5]]);
const LINES = new Map([
  [deshu, ['不急。', '老闆，今天想坐哪裡？', '水溫九十度，剛好。', '這間店，慢慢會有自己的樣子。']],
  [yuan, ['這句我又刪掉了。', '窗外那片山，今天的顏色很好看。', '再一杯黑咖啡，我就寫得出來。', '我阿公以前也在這條路上烤龍眼。']],
  [cat, ['（呼嚕呼嚕）', '喵。', '（翻了個身，繼續睡）']],
]);
const talked = new Set();
function talkTo(r) {
  const hit = r.intersectObjects([deshu, yuan, cat].map((p) => p.userData.mesh))[0];
  if (!hit) return;
  const who = [deshu, yuan, cat].find((p) => p.userData.mesh === hit.object);
  if (who === deshu && brewing) return;
  let line;
  if (who === yuan && !talked.has(yuan)) line = '……啊，你好。我叫予安，常坐在這裡寫稿。';
  else { const l = LINES.get(who); line = l[Math.floor(Math.random() * l.length)]; }
  talked.add(who);
  say(line, 3500, who);
}

/* ---------- 主迴圈 ---------- */
let last = performance.now();
const tmp = new THREE.Vector3();
const clampN = THREE.MathUtils.clamp;
// 把 3D 位置投影成畫面上的標籤或泡泡；座位標籤與泡泡都夾在畫面內，不會被切掉
function project(pos, el, yOff = 0, pinned = false) {
  tmp.copy(pos); tmp.y += yOff;
  tmp.project(camera);
  const W = app.clientWidth, H = app.clientHeight;
  const visible = tmp.z < 1 && (pinned || (Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15));
  el.style.opacity = visible ? '' : '0';
  const half = el.offsetWidth / 2 + 8;
  const x = clampN(((tmp.x + 1) / 2) * W, half, W - half);
  let y = ((1 - tmp.y) / 2) * H;
  y = clampN(y, el.offsetHeight + UI_SPACE.top, pinned ? H - UI_SPACE.bottom : H);
  el.style.transform = `translate(-50%,-100%) translate(${x}px, ${y}px)`;
}

let steamAcc = 0;
function loop() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i](dt)) waiters.splice(i, 1);
  for (let i = realWaiters.length - 1; i >= 0; i--) if (realWaiters[i](dt)) realWaiters.splice(i, 1);
  updateCamera(dt);
  faceCamera();
  // 龍眼睡覺時的呼吸
  if (!catBusy) cat.userData.mesh.scale.y = 1 + Math.sin(performance.now() / 900) * 0.03;
  // 予安偶爾低頭打字
  yuan.userData.mesh.position.y = Math.sin(performance.now() / 1300) > 0.85 ? 0.01 : 0;
  steamAcc += dt;
  if (steamAcc > 0.35) {
    steamAcc = 0;
    for (const c of cups) if ((c.userData.age += 0.35) < 90) emitSteam(c.userData.steamAt);
    for (const p of steamSources) emitSteam(p);
  }
  updateSteam(dt);
  lampLight.position.set(lamp.position.x, 1.5, lamp.position.z);
  if (speaker) project(speaker.position, bubble, HEAD.get(speaker) || 2.0);
  SEATS.forEach((s, i) => project(s.prop.position, labels[i], 1.1, true));
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

frontWall.visible = false;
ceiling.visible = false;
resize();
applyLight();
updateUI();
loop();
setTimeout(() => say('老闆，歡迎回來。', 3500), 800);

// 開發者模式：給冒煙測試讀狀態用（一般玩家不會有這個物件）
if (DEV) {
  window.__cafe = {
    get temp() { return state.temp; },
    get shownTemp() { return shownTemp; },
    get brewing() { return brewing; },
    get phase() { return phase; },
    get speed() { return speedNow(); },
    get mode() { return state.mode; },
    get closeup() { return !!state.closeup; },
    get tasks() { return [...state.tasks]; },
    get deshuHome() { return !deshuReturning; },
    // 某個座位上那杯咖啡在畫面上的位置（相對 #app 的像素）
    cupOnScreen(seatId) {
      const c = cups.find((x) => x.userData.seat === seatId);
      if (!c) return null;
      const v = c.position.clone().add(new THREE.Vector3(0, CUP_H / 2, 0)).project(camera);
      return { x: ((v.x + 1) / 2) * app.clientWidth, y: ((1 - v.y) / 2) * app.clientHeight, inFront: v.z < 1 };
    },
  };
}
