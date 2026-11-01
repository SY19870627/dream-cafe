// 我單方面辭退老闆後，開了一間夢想中的咖啡店 — 2.5D 紙片原型
// 3D 房間 + 2D 紙片（billboard）擺飾與人物，驗證手機直立的顧客視角。
import * as THREE from 'three';
import * as A from './art.js';
import { createStore, giveStarters } from './save.js';
import { temperature, completeTasks, taskById } from './tasks.js';
import { CATALOG, CATEGORY, itemById, balance, commitLayout } from './catalog.js';
import { dayIndex, daysOpen, dateLabel, JUMP_DAY_MS } from './clock.js';
import { LETTERS, LAWYER_LETTER, letterById, dueLetter, markRead } from './letters.js';
import { writeJournal, keepPage } from './journal.js';
import { runOpening } from './opening.js';

const PPM = A.SIZES.PPM;
const $ = (id) => document.getElementById(id);

/* ---------- 開發者模式：網址加 ?dev=1（測試可再加 &speed=20 讓動作加速） ---------- */
const params = new URLSearchParams(location.search);
const DEV = params.get('dev') === '1';
const DEV_SPEED = DEV ? Math.max(1, Number(params.get('speed')) || 1) : 1;

/* ---------- 存檔與遊戲時間 ---------- */
// 現實一天＝遊戲一天；開發者模式可以跳天數（時間偏移存在存檔裡，一般模式不採用）
const store = createStore();
const save = store.load();
const now = () => Date.now() + (DEV ? save.dev.offsetMs : 0);
const today = () => daysOpen(save.createdAt, now());
const returningDay = store.status === 'loaded' && dayIndex(save.lastSeen) < dayIndex(now()); // 隔天以後才回到店裡
const lastSeenAtLoad = save.lastSeen; // 離線營業日誌從這裡結算
// 測試用：?dev=1&opening=0 直接當作看過開場（德叔的三件初始擺飾照樣收進倉庫）
if (DEV && params.get('opening') === '0' && !save.flags.seenOpening) {
  save.flags.seenOpening = true;
  giveStarters(save);
}
let resetting = false;
function persist() {
  if (resetting) return;
  save.lastSeen = now();
  store.write(save);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
window.addEventListener('pagehide', persist);
setInterval(persist, 60000);

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

function removePaper(p) {
  scene.remove(p);
  papers.splice(papers.indexOf(p), 1);
  p.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map !== blobTex) o.material.map?.dispose(); o.material.dispose(); }
  });
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

// 德叔與龍眼
const HOME = new THREE.Vector3(2.6, 0, -1.6);
const deshuCanvas = { idle: A.deshu('idle'), pour: A.deshu('pour'), wipe: A.deshu('wipe'), wipe2: A.deshu('wipe2') };
const deshu = paper(deshuCanvas.idle, HOME.x, HOME.z);
// 予安的第一個里程碑在開店第 2 天（劇本），第 1 天店裡還沒有她
const showYuan = () => { yuan.visible = today() >= 2; };
showYuan();
// 老先生的信：德叔從吧台抽屜拿出來，放在吧台上
const envelope = paper(A.envelope(), 1.8, -0.75, { y: TOP, shadow: false });
envelope.userData.mesh.scale.setScalar(1.7); // 從俯瞰鏡頭也看得到
envelope.visible = false;
const catCanvas = { sleep: A.cat('sleep'), sit: A.cat('sit') };
const cat = paper(catCanvas.sleep, -2.3, -2.9);

/* ---------- 擺飾：依存檔擺在店裡；佈置模式裡改的是一份工作清單，按「確定」才寫回存檔 ---------- */
const artCache = new Map();
function artFor(item, night = state.night) {
  const key = item.art + (item.light && night ? ':on' : '');
  if (!artCache.has(key)) artCache.set(key, item.art === 'floorLamp' ? A.floorLamp(item.light && night) : A[item.art]());
  return artCache.get(key);
}

// 擺飾不能放進吧台、桌椅與人身上；要靠牆的東西放在牆邊會自動貼牆、轉向室內
const KEEP_OUT = [
  [tA.x, tA.z, 0.62], [tC.x, tC.z, 0.62], [tY.x, tY.z, 0.5], [yuan.position.x, yuan.position.z, 0.35],
  [-1.9, 0.15, 0.4], [-2.1, 3.3, 0.85], [1.3, -1.0, 0.3], [1.3, -2.1, 0.3], [1.3, -2.9, 0.3],
];
const WALL_GAP = 0.22;
// 牆上不能被高的擺飾擋住的東西：窗戶與老溫度計（沿著牆的區間）
const WALL_KEEP = {
  back: [[-2.55, -0.85], [1.15, 1.65]],
  left: [[-1.45, 0.25]],
  right: [],
};
// 沿牆找最接近 c、又不擋到窗戶與溫度計的位置
function alongWall(c, half, lo, hi, keep) {
  const ok = (v) => v >= lo - 1e-6 && v <= hi + 1e-6 && keep.every(([a, b]) => v + half <= a || v - half >= b);
  const cands = [THREE.MathUtils.clamp(c, lo, hi)];
  for (const [a, b] of keep) cands.push(a - half - 0.02, b + half + 0.02);
  const good = cands.filter(ok).sort((p, q) => Math.abs(p - c) - Math.abs(q - c));
  return good.length ? good[0] : cands[0];
}
function orient(item, x, z) {
  const art = artFor(item);
  const half = art.width / PPM / 2;
  const tall = art.height / PPM > 1.05; // 比窗台高，才會擋到窗戶與溫度計
  x = THREE.MathUtils.clamp(x, -2.7, 2.7);
  z = THREE.MathUtils.clamp(z, -3.75, 3.7);
  if (item.wall) {
    const dBack = z + ROOM.d / 2, dLeft = x + ROOM.w / 2, dRight = z > 0.6 ? ROOM.w / 2 - x : Infinity;
    const near = Math.min(dBack, dLeft, dRight);
    if (near < 0.8) {
      // 貼牆的紙片只能小角度轉向鏡頭，不然另一側會轉進牆裡
      const clamp = Math.min(0.9, Math.asin(Math.min(1, WALL_GAP / half)));
      const keep = (side) => (tall ? WALL_KEEP[side] : []);
      if (near === dBack) return { x: alongWall(x, half, -ROOM.w / 2 + half + 0.05, ROOM.w / 2 - half - 0.05, keep('back')), z: -ROOM.d / 2 + WALL_GAP, base: 0, clamp };
      if (near === dLeft) return { x: -ROOM.w / 2 + WALL_GAP, z: alongWall(z, half, -ROOM.d / 2 + half + 0.05, ROOM.d / 2 - half - 0.05, keep('left')), base: Math.PI / 2, clamp };
      return { x: ROOM.w / 2 - WALL_GAP, z: alongWall(z, half, 0.6 + half, ROOM.d / 2 - half - 0.05, keep('right')), base: -Math.PI / 2, clamp };
    }
  }
  for (let k = 0; k < 4; k++) {
    if (x > 1.45 && z < 0.4) x = 1.45;
    for (const [cx, cz, r] of KEEP_OUT) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < r) { const s = d < 1e-3 ? 1 : r / d; x = cx + (d < 1e-3 ? r : dx * s); z = cz + dz * s; }
    }
  }
  return { x, z, base: 0, clamp: item.wall ? 0.9 : Math.PI };
}

// 新擺出來的東西先找一個空位
// 先挑靠牆與角落的位置，避開三個座位往前看的視線
const FREE_SPOTS = [[2.4, 1.6], [-2.5, -2.3], [0.4, -3.5], [2.4, 3.2], [1.2, 3.5], [-0.3, 3.5], [-1.3, -3.4], [0.9, 2.5], [-2.5, 1.4], [0.8, -0.3], [0.3, 0.9], [-0.6, 0.0], [0.2, 2.2], [-0.9, 0.9]];
function freeSpot(item, entries) {
  const taken = entries.filter((e) => e.placed);
  const spots = item.wall ? [[-1.3, -3.6], [0.4, -3.6], [-2.8, 1.5], [2.8, 2.0], ...FREE_SPOTS] : FREE_SPOTS;
  for (const [x, z] of spots) {
    const o = orient(item, x, z);
    if (taken.every((e) => Math.hypot(e.x - o.x, e.z - o.z) > 0.7)) return o;
  }
  return orient(item, 0.3, 0.9);
}

const decorPapers = new Map(); // 擺在店裡的項目 → 紙片
let layout = null; // 佈置模式中的工作清單；null 代表不在佈置（畫面直接反映存檔）
const entries = () => layout || save.owned;
const lampLights = [];

function decorPaper(e) {
  const item = itemById(e.item);
  const o = orient(item, e.x, e.z);
  const p = paper(artFor(item), o.x, o.z, { name: item.name, base: o.base, clamp: o.clamp });
  p.userData.entry = e;
  p.userData.item = item;
  if (e.trial) { p.userData.mesh.material.opacity = 0.72; } // 試擺中的東西淡一點
  if (item.light) {
    const l = new THREE.PointLight('#ffb46b', 0, 0, 1.6);
    l.position.set(0, 1.45, 0.3); // 放在紙片前面一點：光源和紙片同一平面時照不到紙片本身
    p.add(l);
    lampLights.push(l);
  }
  return p;
}

function renderDecor() {
  for (const p of decorPapers.values()) removePaper(p);
  decorPapers.clear();
  lampLights.length = 0;
  for (const e of entries()) if (e.placed) decorPapers.set(e, decorPaper(e));
  applyLamps();
}

function moveDecor(e, x, z) {
  const o = orient(itemById(e.item), x, z);
  e.x = o.x; e.z = o.z;
  const p = decorPapers.get(e);
  if (p) { p.position.set(o.x, 0, o.z); p.userData.base = o.base; p.userData.clamp = o.clamp; }
}

// 落地燈：晚上亮。燈只有前兩盞真的打光，避免手機上光源太多
function applyLamps() {
  for (const [e, p] of decorPapers) {
    const item = itemById(e.item);
    if (!item.light) continue;
    setPaper(p, artFor(item));
    // 晚上燈罩自己發亮
    const m = p.userData.mesh.material;
    m.emissiveMap = m.map;
    m.emissive.set(state.night ? '#ffffff' : '#000000');
    m.emissiveIntensity = 0.75;
    m.needsUpdate = true;
  }
  lampLights.forEach((l, i) => { l.intensity = state.night && i < 2 ? 5 : 0; });
}

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
// tutorial：開場在店裡的段落 'enter'（第三幕德叔的三句話）→ 'sit' → 'brew' → 'gift' → 'choose'（第四幕），null 代表不在開場
// letter：德叔放在吧台上、還沒讀的信；cinematic：讀完信後看德叔擦琺瑯杯的鏡頭
const state = { temp: temperature(save), satThisVisit: 0, weather: 'clear', devSpeed: DEV_SPEED, hold: false, night: false, mode: 'overview', seat: null, placing: false, selected: null,
  tutorial: null, letter: null, cinematic: false };
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
function riseTemp(to) {
  state.temp = to;
  const from = shownTemp;
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

// 檢查溫度任務：條件達成的任務記進存檔、溫度上升、溫度基金撥款。
// 不跳任務清單，由角色的一句話（tasks.js 的 line）或動作帶出；delay 讓台詞不要蓋過正在說的話。
// 回傳這次完成的任務 id。
function checkTasks({ delay = 1200 } = {}) {
  const done = completeTasks(save, { daysOpen: today() }, now());
  if (!done.length) return [];
  persist();
  riseTemp(temperature(save));
  glowFund();
  announce(done.filter((t) => t.line).map((t) => t.line), delay);
  return done.map((t) => t.id);
}

// 基金撥款時，「佈置」鈕輕輕亮一下（錢只用來佈置；不跳提示框）
function glowFund() {
  const b = $('place');
  b.classList.remove('rise');
  void b.offsetWidth;
  b.classList.add('rise');
}

const fmt = (n) => n.toLocaleString('zh-TW');

/* ---------- 對話泡泡（只用在角色說話） ---------- */
const bubble = $('bubble');
let bubbleTimer;
let speaker = null;
const NAMES = new Map();
let sayEnds = 0; // 這句話什麼時候說完（老先生的信要等店裡安靜下來才交）
function say(text, ms = 3500, who = deshu) {
  speaker = who;
  sayEnds = performance.now() + (ms || 4000);
  bubble.innerHTML = `<b>${NAMES.get(who) || ''}</b>${text}`;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  if (ms) bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}

// 依序說幾句話（例如同時完成兩個任務）：[說話的人, 台詞]
const sayQueue = [];
let sayBusy = false;
function announce(lines, delay = 1200) {
  if (!lines.length) return;
  sayQueue.push(...lines);
  if (sayBusy) return;
  sayBusy = true;
  setTimeout(function next() {
    const l = sayQueue.shift();
    if (!l) { sayBusy = false; return; }
    say(l[1], 3800, WHO[l[0]] || deshu);
    setTimeout(next, 4300);
  }, delay);
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
  save.stats.cups++;
  if (state.weather === 'rain' && seat.id === 'window') save.stats.rainyWindowCups++; // 天氣在之後的階段加入
  persist();
  // 開場第四幕：溫度要等德叔說完「店是空的……」才上升（劇本第 4、5 步的順序），交給 tutorialAfterCup()
  const inTutorial = state.tutorial === 'brew';
  const firstCup = !inTutorial && checkTasks({ delay: 4800 }).includes('first-coffee');
  if (inTutorial) tutorialAfterCup(true);

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
  applyLamps();
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
  if (state.tutorial === 'sit') {
    // 開場第四幕：坐下之後德叔自己開始沖，玩家不用做任何事
    state.tutorial = 'brew';
    state.satThisVisit++;
    updateUI();
    if (!save.seatsSat.includes(seat.id)) { save.seatsSat.push(seat.id); persist(); }
    setTimeout(() => { if (state.tutorial === 'brew' && state.seat === seat) brew(seat); }, 1400 / DEV_SPEED);
    return;
  }
  updateUI();
  if (++state.satThisVisit === 1) setTimeout(() => say('不急，咖啡會等人，人也該等咖啡。'), 1500);
  if (!save.seatsSat.includes(seat.id)) { save.seatsSat.push(seat.id); persist(); }
  // 坐遍三個座位：德叔的一句話寫在 tasks.js（【待定】）
  checkTasks({ delay: state.satThisVisit === 1 ? 5200 : 1800 });
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

const show = (id, on) => { $(id).hidden = !on; };
function updateUI() {
  const over = state.mode === 'overview';
  const placing = state.placing, sel = !!state.selected;
  const tut = state.tutorial, film = state.cinematic || tut === 'enter'; // 演出中：下面的按鈕都先收起來
  const letter = !!state.letter && !film;
  const free = !tut && !film && !letter;
  $('labels').style.display = over && !placing && !film && !letter && (!tut || tut === 'sit') ? '' : 'none';
  show('stand', !over && free);
  show('brew', !over && !film && !letter && (!tut || tut === 'brew'));
  show('place', over && !placing && free);
  show('night', !placing && free);
  show('read-letter', letter);
  show('tut-place', tut === 'choose');
  show('tut-later', tut === 'choose');
  show('op-skip-shop', !!tut);
  show('p-catalog', placing && !sel);
  show('p-store', placing && !sel);
  show('p-putaway', placing && sel);
  show('p-deselect', placing && sel);
  show('p-revert', placing);
  show('p-done', placing);
  $('brew').disabled = phase === 'wait' || phase === 'serve';
  $('brew').textContent = !brewing ? '請德叔沖一杯'
    : phase === 'wait' ? '德叔走回吧台…'
    : phase === 'serve' ? '德叔端過來了'
    : state.closeup ? '回座位' : '看德叔沖';
  $('day').textContent = `開店第 ${today()} 天`;
  const hint = film ? ''
    : letter ? '德叔把一封信放在吧台上' // 【待定】
    : tut === 'sit' ? '點一張椅子坐下'
    : tut === 'gift' || tut === 'choose' ? ''
    : !over
    ? (brewing ? (state.hold ? '時間走快了一點……' : '按住畫面可以讓時間走快一點') : '左右拖曳環顧四周，點人物可以搭話')
    : !placing ? '點座位坐下，用客人的角度看看這間店'
    : sel ? `已選：${state.selected.userData.name}，點地板放到那裡`
    : placingHint();
  $('hint').textContent = hint;
  $('hint').hidden = !hint;
}

/* ---------- 佈置：移動、倉庫、德叔的型錄 ---------- */
// 試擺不扣錢、擺放永遠免費；按「確定」才寫回存檔，「復原」回到進來時的樣子
const trials = () => (layout || []).filter((e) => e.trial);
const trialCost = () => trials().reduce((s, e) => s + itemById(e.item).price, 0);
function placingHint() {
  const t = trials();
  if (t.length) return `試擺 ${t.length} 件，共 ${fmt(trialCost())} 元・溫度基金 ${fmt(balance(save))} 元`;
  return '點擺飾再點地板移動它；按「確定」才算數';
}

function startPlacing() {
  state.placing = true;
  layout = save.owned.map((o) => ({ ...o }));
  renderDecor();
  select(null);
  if (!save.flags.storeHint && layout.some((e) => !e.placed)) {
    save.flags.storeHint = true;
    persist();
    // 【待定】第一次進佈置模式、倉庫裡還有東西時德叔的提醒（看完開場第四幕的人已經聽過送擺飾那句，不會再說）
    say('倉庫裡有三件東西，是我先替老闆準備的。想放哪就放哪。', 4200);
  }
}

function revertPlacing() {
  layout = save.owned.map((o) => ({ ...o }));
  select(null);
  renderDecor();
  closeSheet();
}

function finishPlacing() {
  const before = save.owned.filter((o) => o.placed).length;
  const r = commitLayout(save, layout, now());
  layout = null;
  state.placing = false;
  select(null);
  closeSheet();
  renderDecor();
  persist();
  const after = save.owned.filter((o) => o.placed).length;
  const ids = checkTasks({ delay: r.returned.length ? 4400 : 600 });
  // 【待定】基金還沒撥到那裡時，德叔把試擺的東西退回型錄（不說「不夠」「不划算」）
  if (r.returned.length) say(`${itemById(r.returned[0]).name}${r.returned.length > 1 ? '那幾件' : ''}，我先放回型錄。基金再撥一點下來，就帶回來。`, 4200);
  else if (!ids.some((id) => taskById(id).line) && (r.bought.length || after > before)) say('這個放這裡，從吧台看過去剛好。');
  updateUI();
}

// 把一件東西擺進店裡（從倉庫拿出來，或從型錄試擺），擺好後直接選起來，點地板就能換位置
function putOut(e) {
  const item = itemById(e.item);
  const o = freeSpot(item, layout);
  e.placed = true; e.x = o.x; e.z = o.z;
  if (!layout.includes(e)) layout.push(e);
  renderDecor();
  closeSheet();
  select(decorPapers.get(e));
}

function putAway() {
  const e = state.selected?.userData.entry;
  if (!e) return;
  if (e.trial) layout.splice(layout.indexOf(e), 1); // 試擺的東西直接退回型錄
  else e.placed = false;
  select(null);
  renderDecor();
}

$('place').onclick = startPlacing;
$('p-done').onclick = finishPlacing;
$('p-revert').onclick = revertPlacing;
$('p-putaway').onclick = putAway;
$('p-deselect').onclick = () => select(null);
$('p-catalog').onclick = () => openSheet('catalog');
$('p-store').onclick = () => openSheet('store');

// 型錄與倉庫：從畫面下方拉起的面板
const sheet = $('sheet');
const thumbs = new Map();
function thumb(item) {
  if (!thumbs.has(item.id)) {
    const src = artFor(item, false);
    const c = document.createElement('canvas');
    c.width = c.height = 112;
    const g = c.getContext('2d');
    const s = Math.min(100 / src.width, 100 / src.height);
    g.drawImage(src, (112 - src.width * s) / 2, (112 - src.height * s) / 2, src.width * s, src.height * s);
    thumbs.set(item.id, c.toDataURL());
  }
  return thumbs.get(item.id);
}

function row(item, note, btnText, onClick) {
  const r = document.createElement('div');
  r.className = 'sheet-row';
  r.innerHTML = `<img alt="" src="${thumb(item)}"><div class="info"><b>${item.name}</b><span>${item.desc}</span><small>${note}</small></div>`;
  const b = document.createElement('button');
  b.textContent = btnText;
  b.onclick = onClick;
  r.appendChild(b);
  return r;
}

let sheetKind = null;
function openSheet(kind) {
  sheetKind = kind;
  const list = $('sheet-list');
  list.innerHTML = '';
  const bal = balance(save);
  if (kind === 'catalog') {
    $('sheet-title').textContent = '德叔的型錄';
    const left = bal - trialCost();
    $('sheet-sub').textContent = `溫度基金 ${fmt(bal)} 元${trials().length ? `・試擺中 ${fmt(trialCost())} 元` : ''}。試擺不花錢，按「確定」才帶回來。`;
    for (const cat of Object.keys(CATEGORY)) {
      const h = document.createElement('h3');
      h.textContent = CATEGORY[cat];
      list.appendChild(h);
      for (const item of CATALOG.filter((i) => i.cat === cat)) {
        const have = (layout || save.owned).filter((e) => e.item === item.id && !e.trial).length;
        // 錢不夠時不寫「餘額不足」，只寫「再等等」
        const note = `${fmt(item.price)} 元${item.price > left ? '・基金再等等' : ''}${have ? `・店裡已有 ${have} 件` : ''}`;
        list.appendChild(row(item, note, '試擺', () => putOut({ item: item.id, trial: true, placed: true, x: 0, z: 0 })));
      }
    }
  } else {
    $('sheet-title').textContent = '倉庫';
    const stored = layout.filter((e) => !e.placed);
    $('sheet-sub').textContent = stored.length ? '收起來的東西都在這裡，隨時可以再擺出來。' : '倉庫是空的。型錄裡的東西試擺後按「確定」，就會是老闆的。';
    for (const e of stored) list.appendChild(row(itemById(e.item), CATEGORY[itemById(e.item).cat], '擺出來', () => putOut(e)));
  }
  sheet.hidden = false;
  list.scrollTop = 0;
  $('sheet-close').focus();
}
function closeSheet() { sheet.hidden = true; sheetKind = null; }
$('sheet-close').onclick = closeSheet;
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

$('stand').onclick = stand;
$('brew').onclick = () => { if (phase === 'brew') toggleCloseup(); else if (!brewing && state.seat) brew(state.seat); };
$('night').onclick = () => { state.night = !state.night; applyLight(); };
// 測試用的快轉鈕只在開發者模式出現
const speedLabel = () => (state.devSpeed === 1 ? '正常速度' : `快轉 ×${state.devSpeed}`);
$('speed').hidden = !DEV;
$('speed').textContent = speedLabel();
$('speed').onclick = () => {
  state.devSpeed = state.devSpeed === 1 ? (DEV_SPEED > 1 ? DEV_SPEED : 4) : 1;
  $('speed').textContent = speedLabel();
};

/* ---------- 選單：關於（開發者資訊）、店的記事本、開發者工具 ---------- */
const about = $('about');
const notebook = $('notebook');
function openAbout(open) {
  about.hidden = !open;
  $('menu-btn').setAttribute('aria-expanded', String(open));
  if (open) { refreshDevTools(); $('about-close').focus(); }
}
$('menu-btn').onclick = () => openAbout(about.hidden);
$('about-close').onclick = () => openAbout(false);
about.addEventListener('click', (e) => { if (e.target === about) openAbout(false); }); // 點面板外面關閉
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('letter').hidden) closeLetter();
  else if (!$('journal').hidden) closeJournal();
  else if (!notebook.hidden) openNotebook(false);
  else if (!sheet.hidden) closeSheet();
  else if (!about.hidden) openAbout(false);
});
if (!store.available) show('save-note', true); // 私密模式等存不了檔的情況，照常遊戲

// 店的記事本：只列已經發生的事，不列還沒完成的（避免變成待辦清單，決定 D8）
function openNotebook(open) {
  notebook.hidden = !open;
  if (!open) return;
  openAbout(false);
  $('nb-summary').textContent = `開店第 ${today()} 天・溫度 ${temperature(save).toFixed(1)}°C・溫度基金 ${fmt(balance(save))} 元`;
  const placed = save.owned.filter((o) => o.placed).length;
  $('nb-decor').textContent = `店裡擺著 ${placed} 件東西${save.owned.length > placed ? `，倉庫裡還有 ${save.owned.length - placed} 件` : ''}。`;
  // 可以重讀的東西：最近一頁營業日誌、律師信、讀過的老先生的信
  const links = $('nb-links');
  links.innerHTML = '';
  const link = (text, fn) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.onclick = () => { openNotebook(false); fn(); };
    links.appendChild(b);
  };
  const lastPage = save.journal[save.journal.length - 1];
  if (lastPage) link(`德叔的營業日誌・${dateLabel(lastPage.t)}`, () => openJournal(lastPage));
  if (save.flags.seenOpening) link('律師信', () => openLetter(LAWYER_LETTER));
  for (const r of save.letters) {
    const l = letterById(r.id);
    if (l) link(`老先生的${l.title}・${dateLabel(r.t)}`, () => openLetter(l));
  }
  const list = $('nb-list');
  list.innerHTML = '';
  for (const d of [...save.tasks].reverse()) {
    const t = taskById(d.id);
    if (!t) continue;
    const li = document.createElement('li');
    li.innerHTML = `<small>${dateLabel(d.t)}・第 ${d.day || 1} 天</small><b>${t.name}</b><span>+${t.temp}°C・溫度基金撥款 ${fmt(t.fund)} 元</span>`;
    list.appendChild(li);
  }
  // 【待定】記事本還是空的時候的一句話
  $('nb-empty').hidden = save.tasks.length > 0;
  $('nb-close').focus();
}
$('open-notebook').onclick = () => openNotebook(true);
$('nb-close').onclick = () => openNotebook(false);
notebook.addEventListener('click', (e) => { if (e.target === notebook) openNotebook(false); });

// 開發者工具：跳天數、加基金、重置存檔（只在 ?dev=1 出現）
show('dev-tools', DEV);
function refreshDevTools() {
  if (DEV) $('dev-day').textContent = `開發者工具・開店第 ${today()} 天・基金 ${fmt(balance(save))} 元`;
}
// 跳天數就像老闆離開了 n 天：德叔把這幾天的營業日誌交給老闆，收好之後再說到期的任務
function jumpDays(n) {
  const from = now();
  save.dev.offsetMs += n * JUMP_DAY_MS;
  const page = save.flags.seenOpening ? writeJournal(save, from, now()) : null;
  keepPage(save, page);
  persist();
  showYuan();
  updateUI();
  refreshDevTools();
  if (page) { openAbout(false); openJournal(page, () => checkTasks({ delay: 600 })); }
  else checkTasks();
}
$('dev-day1').onclick = () => jumpDays(1);
$('dev-day7').onclick = () => jumpDays(7);
$('dev-fund').onclick = () => {
  save.fund.ledger.push({ t: now(), kind: 'dev', ref: '開發者模式', amount: 5000 });
  persist();
  refreshDevTools();
};
$('dev-reset').onclick = () => {
  resetting = true;
  store.clear();
  location.reload();
};

// 開店第 N 天：跨過午夜時更新，「開店滿 3 天／7 天」也在這時完成
let shownDay = today();
setInterval(() => {
  const d = today();
  if (d === shownDay) return;
  shownDay = d;
  showYuan();
  updateUI();
  checkTasks();
}, 20000);

function select(p) {
  if (state.selected) state.selected.userData.mesh.material.color.set('#ffffff');
  state.selected = p || null;
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
  const decor = [...decorPapers.values()];
  const hit = ray.intersectObjects(decor.map((d) => d.userData.mesh))[0];
  if (hit) { select(decor.find((d) => d.userData.mesh === hit.object)); return; }
  if (state.selected) {
    const f = ray.intersectObject(floor)[0];
    if (f) {
      moveDecor(state.selected.userData.entry, f.point.x, f.point.z); // 擺放永遠免費；按「確定」才寫回存檔
      select(null);
    }
  }
});

/* ---------- 點人物搭話 ---------- */
NAMES.set(deshu, '德叔').set(yuan, '予安').set(cat, '龍眼');
const WHO = { 德叔: deshu, 予安: yuan, 龍眼: cat }; // tasks.js 台詞裡的說話者
const HEAD = new Map([[deshu, 2.0], [yuan, 1.45], [cat, 0.5]]);
const LINES = new Map([
  [deshu, ['不急。', '老闆，今天想坐哪裡？', '水溫九十度，剛好。', '這間店，慢慢會有自己的樣子。']],
  [yuan, ['這句我又刪掉了。', '窗外那片山，今天的顏色很好看。', '再一杯黑咖啡，我就寫得出來。', '我阿公以前也在這條路上烤龍眼。']],
  [cat, ['（呼嚕呼嚕）', '喵。', '（翻了個身，繼續睡）']],
]);
function talkTo(r) {
  if (state.cinematic || state.tutorial === 'enter') return;
  const hit = r.intersectObjects([deshu, yuan, cat].filter((p) => p.visible).map((p) => p.userData.mesh))[0];
  if (!hit) return;
  const who = [deshu, yuan, cat].find((p) => p.userData.mesh === hit.object);
  if (who === deshu && brewing) return;
  let line;
  if (who === yuan && !save.flags.metYuan) { line = '……啊，你好。我叫予安，常坐在這裡寫稿。'; save.flags.metYuan = true; persist(); }
  else { const l = LINES.get(who); line = l[Math.floor(Math.random() * l.length)]; }
  say(line, 3500, who);
}

/* ---------- 開場：推門進店（第三幕後半）與第一杯（第四幕） ---------- */
// 第一幕到第三幕前半是 DOM 畫面（src/opening.js），推門之後在 3D 店裡演
const realWait = (ms) => new Promise((r) => setTimeout(r, ms / DEV_SPEED)); // 開發者模式的倍率也縮短等待
const tsay = (text, ms) => say(text, ms / DEV_SPEED);
const DOOR = { from: new THREE.Vector3(0.1, 1.6, 3.9), to: new THREE.Vector3(0.45, 1.55, 2.9), look: new THREE.Vector3(2.6, 1.45, -1.6) };
let tutToken = 0; // 略過時讓還在等的段落作廢

function startOpening() {
  const op = runOpening({ root: $('opening'), save, persist, art: A, speed: DEV_SPEED });
  op.done.then(({ lines }) => enterShop(lines));
  openingCtl = op;
}
let openingCtl = null;

async function enterShop(lines) {
  const my = ++tutToken;
  state.tutorial = 'enter';
  if (!lines) { beginAct4(); return; }
  state.mode = 'door';
  ceiling.visible = true;
  cam.yaw = 0; cam.pitch = 0;
  cam.pos.copy(DOOR.from); cam.look.copy(DOOR.look);
  moveCamera(DOOR.to, DOOR.look, 2.6); // 推門進去，往吧台走兩步
  updateUI();
  await realWait(1700);
  // 劇本第三幕：吧台後的人抬頭
  for (const line of ['老闆，歡迎回來。', '哦，是第一次來。習慣了，對每個人都這樣說。', '那隻貓叫龍眼，是這間三合院本來就有的。他不是我們的，是我們是他的。']) {
    if (my !== tutToken) return;
    tsay(line, 3900);
    await realWait(4300);
  }
  if (my === tutToken) beginAct4();
}

// 第四幕 1：「先坐。」教玩家點椅子坐下
function beginAct4() {
  const my = ++tutToken;
  if (state.mode !== 'overview') {
    state.mode = 'overview';
    frontWall.visible = false;
    ceiling.visible = false;
    cam.yaw = 0; cam.pitch = 0;
    moveCamera(OVER.pos, OVER.look, 1.6);
  }
  if (save.stats.cups >= 1) { tutorialAfterCup(false); return; } // 喝過第一杯才重新整理的話，從送擺飾接著演
  state.tutorial = 'sit';
  updateUI();
  setTimeout(() => { if (my === tutToken && state.tutorial === 'sit') tsay('先坐。', 4000); }, 900 / DEV_SPEED);
}

// 第四幕 4～5：杯子上桌後德叔說「店是空的……」、送三件初始擺飾，溫度計從 20°C 爬到 20.5°C，德叔看了一眼溫度計
async function tutorialAfterCup(justServed) {
  const my = ++tutToken;
  state.tutorial = 'gift';
  updateUI();
  if (justServed) await realWait(4800); // 先讓「東山的豆，就是窗外那片山。」說完
  if (my !== tutToken) return;
  tsay('店是空的。老闆，你想坐在什麼樣的店裡？', 5000);
  giveStarters(save);
  save.flags.storeHint = true; // 送擺飾這句已經說了，佈置時不用再提醒
  persist();
  await realWait(1600);
  if (my !== tutToken) return;
  checkTasks({ delay: 99999 }); // 第一杯：溫度上升與撥款（這個任務沒有台詞）
  (async () => { if (deshuReturning) await deshuReturning; await glance(deshu); })(); // 「德叔看了一眼溫度計，沒說話。」
  await realWait(3800);
  if (my !== tutToken) return;
  // 【待定】送三件初始擺飾時德叔說的話（劇本只寫「送三件初始擺飾」）
  tsay('倉庫裡有三件，是我替老闆準備的開店禮。', 4200);
  state.tutorial = 'choose';
  updateUI();
}

// 開場結束：之後重新整理就直接進店
function endOpening() {
  tutToken++;
  state.tutorial = null;
  save.flags.seenOpening = true;
  delete save.flags.openingAct;
  giveStarters(save);
  persist();
  updateUI();
  checkTasks({ delay: 1200 }); // 略過第四幕時，已經上桌的第一杯照樣算數
  readyAt = performance.now() + 6000 / DEV_SPEED;
}

$('tut-place').onclick = () => {
  endOpening();
  if (state.seat) stand();
  startPlacing();
  openSheet('store');
};
$('tut-later').onclick = () => { endOpening(); glowFund(); };
// 「略過開場」：第三幕後半略過就到第四幕，第四幕略過就直接結束
$('op-skip-shop').onclick = () => {
  if (state.tutorial === 'enter') { beginAct4(); return; }
  if (state.mode === 'door') { state.mode = 'overview'; ceiling.visible = false; moveCamera(OVER.pos, OVER.look); }
  endOpening();
};

/* ---------- 德叔的營業日誌 ---------- */
const journalEl = $('journal');
let journalDone = null;
function openJournal(page, onClose = null) {
  journalDone = onClose;
  const body = $('jr-body');
  body.innerHTML = '';
  const n = page.days.length + (page.summary ? 1 : 0);
  // 【待定】日誌抬頭的一句
  $('jr-sub').textContent = page.summary || n > 1 ? `老闆不在的這幾天，店裡的事。` : '老闆不在的時候，店裡的事。';
  const add = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; el.textContent = text; body.appendChild(el); return el; };
  if (page.summary) {
    add('p', 'jr-sum', page.summary);
    if (page.notes.length) {
      const ul = add('ul', 'jr-list', '');
      for (const t of page.notes) { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }
    }
  }
  for (const d of page.days) {
    add('h3', 'jr-day', `${d.date}・第 ${d.day} 天${d.rain ? '・雨' : ''}`);
    const ul = add('ul', 'jr-list', '');
    for (const t of d.lines) { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }
  }
  journalEl.hidden = false;
  body.scrollTop = 0;
  $('jr-close').focus();
}
function closeJournal() {
  journalEl.hidden = true;
  const fn = journalDone;
  journalDone = null;
  fn?.();
}
$('jr-close').onclick = closeJournal;
journalEl.addEventListener('click', (e) => { if (e.target === journalEl) closeJournal(); });

/* ---------- 老先生的信 ---------- */
const letterEl = $('letter');
let letterDone = null;
// 手寫的信：每個字一點點歪，看起來字有點抖（同一封信每次打開都抖得一樣）
function shaky(text, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return [...text].map((ch) => `<i style="transform:rotate(${((r() - 0.5) * 5).toFixed(1)}deg) translateY(${((r() - 0.5) * 1.6).toFixed(1)}px)">${ch}</i>`).join('');
}
function openLetter(letter, onClose = null) {
  letterDone = onClose;
  const hand = letter !== LAWYER_LETTER;
  letterEl.querySelector('.card').classList.toggle('hand', hand);
  $('lt-title').textContent = letter.title;
  $('lt-body').innerHTML = letter.paragraphs
    .map((p, i) => `<p>${hand ? shaky(p, 97 + i * 31) : p.replace(/[<>&]/g, '')}</p>`).join('');
  letterEl.hidden = false;
  $('lt-body').scrollTop = 0;
  $('lt-close').focus();
}
function closeLetter() {
  letterEl.hidden = true;
  const fn = letterDone;
  letterDone = null;
  fn?.();
}
$('lt-close').onclick = closeLetter;
letterEl.addEventListener('click', (e) => { if (e.target === letterEl) closeLetter(); });

// 交信要等店裡安靜下來：開場結束、沒在沖咖啡、沒在佈置、沒有打開的面板、德叔沒在說話
let readyAt = Infinity;
const overlayOpen = () => [about, notebook, sheet, journalEl, letterEl, $('opening')].some((el) => !el.hidden);
function quiet() {
  return save.flags.seenOpening && !state.tutorial && !state.letter && !state.cinematic && !brewing && !deshuReturning && !state.placing
    && !overlayOpen() && !sayBusy && performance.now() > Math.max(readyAt, sayEnds + 1500 / DEV_SPEED);
}
const letterCtx = () => ({ daysOpen: today(), temp: temperature(save) });
setInterval(() => {
  if (!quiet()) return;
  const l = dueLetter(save, letterCtx());
  if (l) deliverLetter(l);
}, 1000);

// 德叔從吧台抽屜拿出來，放在吧台上
async function deliverLetter(letter) {
  state.letter = letter;
  updateUI();
  setPaper(deshu, deshuCanvas.pour); // 彎腰拉開抽屜
  await realWait(700);
  setPaper(deshu, deshuCanvas.idle);
  envelope.visible = true;
  envelope.userData.mesh.position.y = TOP - 0.12;
  await animate(0.6, (k) => { envelope.userData.mesh.position.y = TOP - 0.12 + 0.12 * ease(k); });
  say(letter.give(letterCtx()), 4200);
}

$('read-letter').onclick = () => {
  const letter = state.letter;
  if (!letter) return;
  openLetter(letter, () => {
    markRead(save, letter.id, now(), today());
    persist();
    state.letter = null;
    envelope.visible = false;
    wipeScene();
  });
};

// 讀完信，往德叔看：他正在擦那個琺瑯杯，沒抬頭
const WIPE = { pos: new THREE.Vector3(0.9, 1.55, -0.35), look: new THREE.Vector3(2.6, 1.3, -1.6) };
async function wipeScene() {
  state.cinematic = true;
  bubble.classList.remove('show'); // 德叔沒抬頭，也沒說話
  updateUI();
  const seat = state.mode === 'seat' ? state.seat : null;
  ceiling.visible = true;
  cam.yaw = 0; cam.pitch = 0;
  moveCamera(WIPE.pos, WIPE.look, 1.6);
  const tex = { wipe: A.tex(deshuCanvas.wipe), wipe2: A.tex(deshuCanvas.wipe2) };
  const mat = deshu.userData.mesh.material;
  const idleMap = mat.map;
  let t = 0, frame = -1;
  await new Promise((done) => realWaiters.push((dt) => {
    t += dt * DEV_SPEED;
    const f = Math.floor(t / 0.5);
    if (f !== frame) { frame = f; mat.map = f % 2 ? tex.wipe2 : tex.wipe; mat.needsUpdate = true; }
    if (t > 6.5) { done(); return true; }
    return false;
  }));
  if (seat && state.seat === seat) moveCamera(seat.eye, seat.look);
  else { ceiling.visible = false; moveCamera(OVER.pos, OVER.look); }
  await realWait(1500);
  mat.map = idleMap;
  mat.needsUpdate = true;
  tex.wipe.dispose(); tex.wipe2.dispose();
  state.cinematic = false;
  readyAt = performance.now() + 4000 / DEV_SPEED;
  updateUI();
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
  // 吧台上的信輕輕晃，等老闆來拿
  if (envelope.visible) envelope.userData.mesh.rotation.z = Math.sin(performance.now() / 500) * 0.08;
  steamAcc += dt;
  if (steamAcc > 0.35) {
    steamAcc = 0;
    for (const c of cups) if ((c.userData.age += 0.35) < 90) emitSteam(c.userData.steamAt);
    for (const p of steamSources) emitSteam(p);
  }
  updateSteam(dt);
  if (speaker) project(speaker.position, bubble, HEAD.get(speaker) || 2.0);
  SEATS.forEach((s, i) => project(s.prop.position, labels[i], 1.1, true));
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

frontWall.visible = false;
ceiling.visible = false;
resize();
renderDecor();
applyLight();
updateUI();
loop();
persist(); // 新存檔在這一刻寫下第一次開店的時間

// 回到店裡：隔天以後回來先看德叔的營業日誌，收好之後德叔說劇本「開店」台詞；同一天回來是「老闆，歡迎回來。」
// 離線期間到期的任務（例如開店滿 3 天），等德叔打完招呼再說
function greet() {
  say(returningDay ? '燈亮了。老闆，今天想坐哪裡？' : '老闆，歡迎回來。', 3500);
  checkTasks({ delay: 3800 });
  readyAt = performance.now() + 5000 / DEV_SPEED;
}
if (!save.flags.seenOpening) {
  startOpening(); // 新存檔：從 16:49 的辦公室開始
} else {
  const page = returningDay ? writeJournal(save, lastSeenAtLoad, now()) : null;
  if (page) { keepPage(save, page); persist(); }
  setTimeout(() => (page ? openJournal(page, greet) : greet()), 800);
}

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
    get tasks() { return save.tasks.map((d) => d.id); },
    get fund() { return balance(save); },
    get ledgerSum() { return save.fund.ledger.reduce((s, e) => s + e.amount, 0); },
    get grants() { return save.fund.ledger.filter((e) => e.kind === 'grant').reduce((s, e) => s + e.amount, 0); },
    get day() { return today(); },
    get placing() { return state.placing; },
    get saveStatus() { return store.status; },
    get placed() { return save.owned.filter((o) => o.placed).map((o) => o.item); },
    get stored() { return save.owned.filter((o) => !o.placed).map((o) => o.item); },
    get layoutPlaced() { return [...decorPapers.keys()].map((e) => ({ item: e.item, trial: !!e.trial, x: e.x, z: e.z })); },
    get selected() { return state.selected?.userData.entry?.item || null; },
    // 某件擺飾在畫面上的位置（相對 #app 的像素），給測試點擊用
    decorOnScreen(item) {
      const p = [...decorPapers.values()].find((d) => d.userData.entry.item === item);
      if (!p) return null;
      const v = p.position.clone().add(new THREE.Vector3(0, 0.4, 0)).project(camera);
      return { x: ((v.x + 1) / 2) * app.clientWidth, y: ((1 - v.y) / 2) * app.clientHeight };
    },
    get deshuHome() { return !deshuReturning; },
    get tutorial() { return state.tutorial; },
    get openingStage() { return openingCtl?.stage || null; },
    get seenOpening() { return !!save.flags.seenOpening; },
    get player() { return { ...save.player }; },
    get letters() { return save.letters.map((l) => l.id); },
    get letterWaiting() { return state.letter?.id || null; },
    get cinematic() { return state.cinematic; },
    get journalPages() { return save.journal.length; },
    get yuanHere() { return yuan.visible; },
    // 某個座位上那杯咖啡在畫面上的位置（相對 #app 的像素）
    cupOnScreen(seatId) {
      const c = cups.find((x) => x.userData.seat === seatId);
      if (!c) return null;
      const v = c.position.clone().add(new THREE.Vector3(0, CUP_H / 2, 0)).project(camera);
      return { x: ((v.x + 1) / 2) * app.clientWidth, y: ((1 - v.y) / 2) * app.clientHeight, inFront: v.z < 1 };
    },
  };
}
