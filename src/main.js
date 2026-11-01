// 我單方面辭退老闆後，開了一間夢想中的咖啡店 — 2.5D 紙片原型
// 3D 房間 + 2D 紙片（billboard）擺飾與人物，驗證手機直立的顧客視角。
import * as THREE from 'three';
import * as A from './art.js';
import { createStore, giveStarters } from './save.js';
import { temperature, completeTasks, taskById, TASKS, isDone } from './tasks.js';
import { CATALOG, CATEGORY, itemById, balance, commitLayout } from './catalog.js';
import { dayIndex, daysOpen, dateLabel, JUMP_DAY_MS } from './clock.js';
import { LETTERS, LAWYER_LETTER, letterById, dueLetter, markRead } from './letters.js';
import { writeJournal, keepPage } from './journal.js';
import { runOpening } from './opening.js';
import { weatherOn, rainFloorDue, RAIN_HINT } from './weather.js';
import * as S from './story.js';
import { catSpotOn, tryNewSpot, placedSet, petCat, jumpsOnChair, PURR, CAT_LINES } from './cat.js';
import * as H from './afterhours.js';
import * as F from './farewell.js';
import { createAudio, VOLUMES, VOLUME_NAMES } from './audio.js';

const PPM = A.SIZES.PPM;
const $ = (id) => document.getElementById(id);
const lightsEl = $('lights'); // 打烊後每盞燈旁邊的「關燈／開燈」

/* ---------- 開發者模式：網址加 ?dev=1（測試可再加 &speed=20 讓動作加速） ---------- */
const params = new URLSearchParams(location.search);
const DEV = params.get('dev') === '1';
const DEV_SPEED = DEV ? Math.max(1, Number(params.get('speed')) || 1) : 1;
// 測試用：?dev=1&regulars=0 關掉熟客（不測熟客的冒煙測試段落用，溫度與基金才算得準）；&weather=rain|typhoon 指定店裡的天氣
const REGULARS_ON = !(DEV && params.get('regulars') === '0');
const DEV_WEATHER = DEV ? params.get('weather') : null;

/* ---------- 存檔與遊戲時間 ---------- */
// 現實一天＝遊戲一天；開發者模式可以跳天數（時間偏移存在存檔裡，一般模式不採用）
const store = createStore();
const save = store.load();
const now = () => Date.now() + (DEV ? save.dev.offsetMs : 0);
const today = () => daysOpen(save.createdAt, now());
const keeper = () => F.departed(save); // 離開東山之後：店轉為常態經營，凱文顧店（德叔跟著老闆去下一站）
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

const audio = createAudio(); // 聲音與音樂（src/audio.js）；接到場景的部分見「聲音與音樂」一節

/* ---------- 基本設定 ---------- */
const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
// 效能（階段 7）：解析度最高 2 倍；中低階手機連續幾秒畫不到 40 FPS 時，每次往下降 0.25（最低 1 倍），見 perfTick()
const PERF = { cap: Math.min(window.devicePixelRatio || 1, 2), ratio: 1, frames: 0, acc: 0, fps: 0, low: 0, since: performance.now(), drops: 0, skipped: 0 };
PERF.ratio = PERF.cap;
renderer.setPixelRatio(PERF.ratio);
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

// 窗戶（不受光照影響，自己發亮）；窗外隨白天／夜晚與天氣（晴、雨、颱風）換一張
const winTexCache = new Map();
function winTex(night, weather) {
  const k = `${night}:${weather}`;
  if (!winTexCache.has(k)) winTexCache.set(k, A.tex(A.windowView(night, weather)));
  return winTexCache.get(k);
}
const windows = [];
const rainTex = { rain: A.tex(A.rain(false)), typhoon: A.tex(A.rain(true)) };
for (const t of Object.values(rainTex)) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.2); }
const rainPlanes = [];
function addWindow(x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), new THREE.MeshBasicMaterial({ map: winTex(false, 'clear') }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
  windows.push(m);
  // 雨絲：貼在窗戶前面一點，往下捲動
  const r = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), new THREE.MeshBasicMaterial({ map: rainTex.rain, transparent: true, depthWrite: false }));
  r.position.set(x, y, z);
  r.rotation.y = ry;
  r.translateZ(0.025);
  r.visible = false;
  scene.add(r);
  rainPlanes.push(r);
}
addWindow(-1.7, 1.75, -ROOM.d / 2 + 0.02, 0);
addWindow(-ROOM.w / 2 + 0.02, 1.7, -0.6, Math.PI / 2);

// 吧台後方層架（小黑板寫著今日手沖；阿哲的豆上架後多一行）
const backBar = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), lambert(A.tex(A.backBar(2.8, 1.8, save.menu)), { transparent: true, alphaTest: 0.1 }));
backBar.position.set(ROOM.w / 2 - 0.02, 1.85, -1.6);
backBar.rotation.y = -Math.PI / 2;
scene.add(backBar);
function drawBackBar(menu = save.menu) {
  backBar.material.map?.dispose();
  backBar.material.map = A.tex(A.backBar(2.8, 1.8, menu));
  backBar.material.needsUpdate = true;
}

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
  pendants.push({ shade, light, level: 1, pos: new THREE.Vector3(2.0, 2.45, z) });
}
// 夜裡吧台正面（客人那一側）的補光：吊燈在吧台正上方，正面原本只剩一片暗（階段 7）；跟著吊燈一起開關
const barFill = new THREE.PointLight('#ffc58a', 0, 3.2, 1.4);
barFill.position.set(0.9, 1.5, -1.5);
scene.add(barFill);

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
  group.userData = { ...group.userData, mesh, base: opt.base ?? 0, clamp: opt.clamp ?? Math.PI, name: opt.name, overClamp: !!opt.overClamp };
  scene.add(group);
  papers.push(group);
  return group;
}

function setPaper(p, canvas) {
  const m = p.userData.mesh.material;
  m.map.dispose();
  m.map = A.tex(canvas);
  if (m.emissiveMap) m.emissiveMap = m.map; // 夜裡人物自己帶一點光（applyLight）
  m.needsUpdate = true;
}

// 換一張大小不同的圖（例如凱文從站著走進來變成坐下）：平面的尺寸也跟著換
function setArt(p, canvas) {
  const mesh = p.userData.mesh;
  const w = canvas.width / PPM, h = canvas.height / PPM;
  const prm = mesh.geometry.parameters;
  if (Math.abs(prm.width - w) > 1e-3 || Math.abs(prm.height - h) > 1e-3) {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
  }
  setPaper(p, canvas);
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
// 紙片轉向鏡頭。階段 7 打磨：
// 1. 俯瞰時店前半部的紙片幾乎是從正上方看，只剩一條線：不靠牆的紙片往後仰一點（鏡頭越高越仰，最多約 27°），坐下時不仰
// 2. 角落沙發平常只能小角度轉（坐下看起來才自然），俯瞰時整張轉向鏡頭，不再是側面；轉的時候慢慢轉
function faceCamera(dt = 0) {
  const over = state.mode === 'overview';
  for (const p of papers) {
    const yaw = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
    const clamp = over && p.userData.overClamp ? Math.PI : p.userData.clamp;
    const d = THREE.MathUtils.clamp(wrapAngle(yaw - p.userData.base), -clamp, clamp);
    const target = p.userData.base + d;
    if (p.userData.overClamp && dt) p.rotation.y += wrapAngle(target - p.rotation.y) * Math.min(1, dt * 4);
    else p.rotation.y = target;
    if (p.userData.shadow) p.userData.shadow.rotation.z = -p.rotation.y; // 影子保持朝地
    if (p.userData.clamp >= Math.PI - 1e-6 || p.userData.overClamp) {
      const m = p.userData.mesh;
      const h = m.geometry.parameters.height * 0.5 + m.position.y;
      const elev = Math.atan2(camera.position.y - h, Math.hypot(camera.position.x - p.position.x, camera.position.z - p.position.z));
      m.rotation.x = -THREE.MathUtils.clamp((elev - 0.5) * 0.6, 0, 0.47);
    }
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
    prop: paper(A.sofa(), -2.1, 3.3, { base: Math.PI * 0.85, clamp: 0.7, name: 'sofa', overClamp: true }),
  },
];
const stoolMid = paper(A.stool(), 1.3, -2.1);
const stoolFar = paper(A.stool(), 1.3, -2.9); // 凱文的位子：他坐下時，他的圖本身就畫了高腳椅

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
  cocoa: new THREE.MeshLambertMaterial({ color: '#8a5a3c' }),
  longan: new THREE.MeshLambertMaterial({ color: '#7a4120' }),
  enamel: new THREE.MeshLambertMaterial({ color: '#f4f2ec' }), // 那個舊的琺瑯杯：白底、深藍杯緣
  navy: new THREE.MeshLambertMaterial({ color: '#23406e' }),
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
// kind：'hot'（手沖）、'cocoa'（德叔給予安的熱可可）、'iced'（凱文的冰美式）、'enamel'（最後一晚，德叔用那個琺瑯杯）；
// dish：旁邊放一小碟窯烤龍眼乾
function makeCup(kind = 'hot', dish = false) {
  const g = new THREE.Group();
  g.scale.setScalar(CUP_SCALE);
  if (kind === 'enamel') {
    const body = cyl(0.04, 0.04, 0.075, M.enamel); body.position.y = 0.0375;
    const rim = cyl(0.0415, 0.0415, 0.01, M.navy, 24, true); rim.position.y = 0.072;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 16), M.navy);
    handle.position.set(0.05, 0.04, 0);
    const liquid = cyl(0.037, 0.037, 0.004, M.coffee); liquid.position.y = 0.07; liquid.visible = false;
    g.add(body, rim, handle, liquid);
    g.userData.liquid = liquid;
    g.userData.enamel = true;
    return g;
  }
  if (kind === 'iced') {
    const liquid = cyl(0.03, 0.026, 0.075, M.coffee); liquid.position.y = 0.04;
    const glass = cyl(0.035, 0.029, 0.1, M.glass); glass.position.y = 0.05;
    g.add(liquid, glass);
    g.userData.liquid = liquid;
    g.userData.iced = true;
    return g;
  }
  const body = cyl(0.04, 0.034, 0.07, M.ceramic); body.position.y = 0.035;
  const saucer = cyl(0.07, 0.065, 0.008, M.ceramic); saucer.position.y = 0.004;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 16), M.ceramic);
  handle.position.set(0.048, 0.04, 0);
  const liquid = cyl(0.036, 0.036, 0.004, kind === 'cocoa' ? M.cocoa : M.coffee); liquid.position.y = 0.066; liquid.visible = false;
  g.add(body, saucer, handle, liquid);
  if (dish) {
    const plate = cyl(0.035, 0.03, 0.006, M.ceramic); plate.position.set(-0.075, 0.003, 0.05);
    g.add(plate);
    for (const [x, z] of [[-0.085, 0.045], [-0.068, 0.058], [-0.074, 0.038]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), M.longan);
      b.position.set(x, 0.012, z);
      g.add(b);
    }
  }
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

// 三位熟客（予安、阿哲、凱文）與阿哲的阿公：紙片的圖依姿勢換（src/art.js 的同名函式）
const poseCache = new Map();
function poseArt(who, pose) {
  const k = `${who}:${pose}`;
  if (!poseCache.has(k)) poseCache.set(k, A[who](pose));
  return poseCache.get(k);
}
const yuan = paper(poseArt('yuan', 'type'), -0.4, -1.75);
const zhe = paper(poseArt('zhe', 'stand'), 0.15, 3.7);
const kevin = paper(poseArt('kevin', 'sit'), 1.3, -2.9);
const grandpa = paper(poseArt('grandpa', 'stand'), 0.15, 3.7);
const poses = { yuan: 'type', zhe: 'stand', kevin: 'sit', grandpa: 'stand' };
function setPose(who, pose) {
  if (!pose || poses[who] === pose) return;
  poses[who] = pose;
  setArt(PEOPLE[who], poseArt(who, pose));
}

// 德叔與龍眼
const HOME = new THREE.Vector3(2.6, 0, -1.6);
const deshuCanvas = { idle: A.deshu('idle'), pour: A.deshu('pour'), wipe: A.deshu('wipe'), wipe2: A.deshu('wipe2') };
const deshu = paper(deshuCanvas.idle, HOME.x, HOME.z);
const PEOPLE = { deshu, yuan, zhe, kevin, grandpa };
// 熟客由故事線決定什麼時候出現（startDay）；關掉熟客的測試模式沿用舊做法：予安從開店第 2 天起坐在窗邊
for (const p of [yuan, zhe, kevin, grandpa]) p.visible = false;
const showYuan = () => { if (!REGULARS_ON) yuan.visible = today() >= 2; };
showYuan();
// 吧台上的那袋龍眼乾（阿哲第一次來時放的）
const counterBag = paper(A.longanBag(), 1.95, -0.1, { y: TOP, shadow: false });
counterBag.visible = save.menu.includes('longan');
// 老先生的信：德叔從吧台抽屜拿出來，放在吧台上
const envelope = paper(A.envelope(), 1.8, -0.75, { y: TOP, shadow: false });
envelope.userData.mesh.scale.setScalar(1.7); // 從俯瞰鏡頭也看得到
envelope.visible = false;
// 門口的徵才啟事：告別第 2 段貼出去，凱文來面試之後收起來
const noticeSign = paper(A.noticeBoard(''), 0.95, 3.45, { name: 'notice' });
let noticeDrawn = '';
function refreshNotice() {
  const up = F.noticeUp(save);
  const text = F.noticeText(save);
  if (up && text !== noticeDrawn) { setArt(noticeSign, A.noticeBoard(text)); noticeDrawn = text; }
  noticeSign.visible = up;
}
refreshNotice();
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
  [1.3, -0.2, 0.35], [-2.35, -1.3, 0.3], [-0.85, 1.75, 0.3], // 阿哲站的吧台前、凱文坐到老闆對面的位子
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
// 階段 7：靠牆的家具（書櫃、碗櫥、唱機……）先沿三面牆找空位，不再落到店中間；
// 高的東西不放在店中間那幾個點（窗邊座、吧台座看出去的視線上），真的沒地方了才放
const WALL_SPOTS = [[-1.3, -3.6], [0.4, -3.6], [-2.8, 1.5], [2.8, 2.0],
  ...[-2.4, -0.3, 0.6, 2.2].map((x) => [x, -3.6]), ...[-3.3, -2.3, 1.0, 2.4].map((z) => [-2.8, z]), ...[1.2, 2.8, 3.5].map((z) => [2.8, z])];
const MID_SPOTS = new Set(['0.8,-0.3', '0.3,0.9', '-0.6,0', '0.2,2.2', '-0.9,0.9']);
function freeSpot(item, entries) {
  const taken = entries.filter((e) => e.placed);
  const half = artFor(item).width / PPM / 2;
  const tall = artFor(item).height / PPM > 1.05;
  const free = (o) => taken.every((e) => {
    const w = artFor(itemById(e.item)).width / PPM / 2;
    return Math.hypot(e.x - o.x, e.z - o.z) > Math.max(0.7, half + w * 0.8);
  });
  const open = tall ? FREE_SPOTS.filter(([x, z]) => !MID_SPOTS.has(`${x},${z}`)) : FREE_SPOTS;
  const spots = item.wall ? [...WALL_SPOTS, ...open] : open;
  for (const [x, z] of [...spots, ...FREE_SPOTS]) {
    const o = orient(item, x, z);
    if (free(o)) return o;
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
    p.userData.lightId = e.uid ? 'l' + e.uid : null; // 打烊後可以關的燈（試擺中的燈沒有編號，一直亮著）
    const l = new THREE.PointLight('#ffb46b', 0, 0, 1.6);
    l.userData.lightId = p.userData.lightId;
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
  applySound(); // 擺了黑膠唱機，音樂多一點唱針的沙沙聲
  buildLightLabels();
}

function moveDecor(e, x, z) {
  const o = orient(itemById(e.item), x, z);
  e.x = o.x; e.z = o.z;
  const p = decorPapers.get(e);
  if (p) { p.position.set(o.x, 0, o.z); p.userData.base = o.base; p.userData.clamp = o.clamp; }
}

// 落地燈：晚上亮（打烊後老闆關掉的燈不亮）。燈只有前兩盞真的打光，避免手機上光源太多
function applyLamps() {
  for (const [e, p] of decorPapers) {
    const item = itemById(e.item);
    if (!item.light) continue;
    const on = state.night && lightOn(p.userData.lightId);
    setPaper(p, artFor(item, on));
    // 晚上燈罩自己發亮
    const m = p.userData.mesh.material;
    m.emissiveMap = m.map;
    m.emissive.set(on ? '#ffffff' : '#000000');
    m.emissiveIntensity = 0.75;
    m.needsUpdate = true;
  }
  lampLights.forEach((l, i) => { l.intensity = state.night && i < 2 && lightOn(l.userData.lightId) ? 5 : 0; });
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
// scene：正在演的熟客里程碑；choice：畫面下方的選項開著
const state = { temp: temperature(save), satThisVisit: 0, weather: 'clear', devSpeed: DEV_SPEED, hold: false, night: false, mode: 'overview', seat: null, placing: false, selected: null,
  tutorial: null, letter: null, cinematic: false, scene: null, choice: false };

// 店裡今天的天氣：依季節（weather.js，和營業日誌同一個結果）；颱風夜那天整晚都是颱風
const seedOf = (s) => (Number(s.createdAt) || 0) % 2147483647; // 與 journal.js 相同
function weatherToday() {
  if (DEV_WEATHER === 'rain' || DEV_WEATHER === 'typhoon' || DEV_WEATHER === 'clear') return DEV_WEATHER;
  if (state.scene?.id === 'zhe3' || (save.story.typhoonDay && save.story.typhoonDay === today())) return 'typhoon';
  const t = now();
  const d = today();
  if (save.story.rainFloorDay === d) return 'rain';
  const w = weatherOn(dayIndex(t), new Date(t).getMonth(), seedOf(save));
  // 保底雨天（weather.js）：「在雨天坐窗邊喝一杯」還沒完成時，隔一陣子老闆在的那天就下雨
  if (w === 'clear' && save.flags.seenOpening && !keeper() && rainFloorDue({ day: d, done: isDone(save, 'rain-window'), last: save.story.rainFloorDay })) {
    save.story.rainFloorDay = d;
    return 'rain';
  }
  return w;
}
state.weather = weatherToday();
// 下班後進店是夜裡的光線（決定 D11、D104）：設定的下班時間（預設 18:00）到清晨 6 點。開場第一次進店照劇本是傍晚，不切。
// 開發者模式不看時鐘（測試才算得準），用 &night=1 指定
function afterWork() {
  if (DEV) return params.get('night') === '1';
  const d = new Date();
  const [h, m] = String(save.settings.offWork || '18:00').split(':').map(Number);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= (h || 18) * 60 + (m || 0) || mins < 6 * 60;
}
if (state.weather === 'typhoon' || (save.flags.seenOpening && afterWork())) state.night = true;
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
// 泡泡上的名字；凱文在主管叫出他的名字以前，店裡都叫他「冰美式先生」
const nameOf = (who) => (who === kevin && !S.hasMilestone(save, 'kevin', 2) ? '冰美式先生' : NAMES.get(who) || '');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let sayEnds = 0; // 這句話什麼時候說完（老先生的信要等店裡安靜下來才交）
// who：說話的人的紙片，或 'player'（老闆自己說的話，泡泡固定在畫面下方）；name：覆寫泡泡上的名字
function say(text, ms = 3500, who = deshu, name = null) {
  if (!String(text ?? '').trim()) { bubble.classList.remove('show'); return; } // 沒有字的泡泡不畫
  speaker = who;
  // 對話中（熟客的場景、客人模式的聊天）：說話的人轉進畫面裡
  if (conversing() && state.mode === 'seat' && !state.closeup && who && who !== 'player' && who.visible && isPerson(who) && who !== focusP) lookToward(who, 2.3);
  sayEnds = performance.now() + (ms || 4000);
  bubble.classList.toggle('me', who === 'player');
  bubble.innerHTML = `<b>${name ?? (who === 'player' ? '你' : nameOf(who))}</b>${esc(text)}`; // 台詞可能帶著玩家自己寫的名字
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

// 走路時繞開店裡的擺飾（階段 7）：擺飾當成圓形的障礙，往前看到擋路的就往旁邊偏；
// 目的地或出發點本身就在某件擺飾旁邊（例如德叔走到唱機旁、龍眼去睡書櫃）時，那一件不算；
// 走了比直走久很多還沒到（繞不出去），就直接走過去，不會卡住
function obstacles(from, to) {
  const out = [];
  for (const d of decorPapers.values()) {
    const w = d.userData.mesh.geometry.parameters.width;
    const r = THREE.MathUtils.clamp(w * 0.28, 0.15, 0.5);
    const o = { x: d.position.x, z: d.position.z, r };
    if (Math.hypot(to.x - o.x, to.z - o.z) < r + 0.3 || Math.hypot(from.x - o.x, from.z - o.z) < r + 0.1) continue;
    out.push(o);
  }
  return out;
}
const AHEAD = 1.1; // 往前看多遠（公尺）
function walk(p, to, speed = 0.7) {
  const obs = obstacles(p.position, to);
  let budget = (Math.hypot(to.x - p.position.x, to.z - p.position.z) / speed) * 2 + 3; // 遊戲時間（秒）
  return new Promise((r) => {
    waiters.push((dt) => {
      const d = new THREE.Vector3(to.x - p.position.x, 0, to.z - p.position.z);
      const step = speed * dt * speedNow();
      const dist = d.length();
      if (dist <= step) { p.position.x = to.x; p.position.z = to.z; r(); return true; }
      budget -= dt * speedNow();
      d.divideScalar(dist);
      if (obs.length && budget > 0) {
        const px = -d.z, pz = d.x; // 往左的垂直方向
        let sx = 0, sz = 0;
        for (const o of obs) {
          const rx = o.x - p.position.x, rz = o.z - p.position.z;
          const along = rx * d.x + rz * d.z;
          if (along < -o.r || along > Math.min(dist, AHEAD) + o.r) continue;
          const lat = rx * px + rz * pz; // 障礙在左邊為正
          const clear = o.r + 0.18;
          if (Math.abs(lat) >= clear) continue;
          const side = lat >= 0 ? -1 : 1;
          const k = ((clear - Math.abs(lat)) / clear) * (1 - Math.max(0, along) / (AHEAD + o.r)) * 2.2;
          sx += px * side * k; sz += pz * side * k;
        }
        d.x += sx; d.z += sz;
        d.normalize();
      }
      d.multiplyScalar(step);
      p.position.add(d);
      if (budget > 0) for (const o of obs) { // 還是撞進去了：推回邊緣
        const ox = p.position.x - o.x, oz = p.position.z - o.z, od = Math.hypot(ox, oz);
        if (od < o.r && od > 1e-4) { p.position.x = o.x + (ox / od) * o.r; p.position.z = o.z + (oz / od) * o.r; }
      }
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
// 看德叔沖：正對吧台，磨豆機、濾杯、杯子排成一列在畫面中間，德叔的臉在上方約 1/3（美術評分修正 a：原本斜看，直立畫面只看得到吧台一角）
const CLOSE = { pos: new THREE.Vector3(-0.1, 1.55, -1.7), look: new THREE.Vector3(2.6, 1.41, -1.68) };
const WALK = 0.85; // 德叔端杯的走速（公尺／秒）

// 正常速度下吧台沖煮約 19 秒：六個動作都保留，只縮短停頓與注水
// bean：菜單上的哪一支豆子（MENU 的 id）；窯烤龍眼乾上了菜單之後，杯子旁邊多一小碟
// opt.last：打烊後的最後一杯；opt.guest：客人模式點的那杯；opt.enamel：最後一晚，德叔用那個琺瑯杯沖（farewell.js 第 7 段）
async function brew(seat, bean = 'dongshan', opt = {}) {
  if (brewing) return;
  brewing = true;
  if (deshuReturning) {
    phase = 'wait';
    updateUI();
    await deshuReturning;
  }
  const withLongan = save.menu.includes('longan') && !opt.enamel;
  if (opt.enamel) {
    scene.remove(stationCup);
    stationCup = makeCup('enamel');
    stationCup.position.copy(CUP_SPOT);
    scene.add(stationCup);
  } else if (withLongan) {
    scene.remove(stationCup);
    stationCup = makeCup('hot', true);
    stationCup.position.copy(CUP_SPOT);
    scene.add(stationCup);
  }
  phase = 'brew';
  say(keeper() ? F.KEEPER.brewStart : '好，等我一下。', 2500);
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
  audio.start('pour');
  await animate(1.6, () => updateStream(cupTop.y));
  audio.stop('pour');
  stream.visible = false;
  await moveKettle(null, 0.7);
  setPaper(deshu, deshuCanvas.idle);

  // 2. 磨豆：把手轉動，濾杯裡的粉慢慢堆起來
  await wait(0.3);
  setPaper(deshu, deshuCanvas.pour);
  audio.start('grind');
  await animate(3.0, (k) => {
    gHandle.rotation.y = k * Math.PI * 10;
    grinder.position.x = 2.05 + Math.sin(k * 60) * 0.002;
    groundsBed.scale.y = Math.max(0.01, k);
  });
  audio.stop('grind');
  setPaper(deshu, deshuCanvas.idle);
  await wait(0.3);

  // 3. 悶蒸：少量注水，粉層膨脹冒泡
  setPaper(deshu, deshuCanvas.pour);
  await moveKettle(dripTop);
  stream.visible = true;
  audio.start('pour');
  await animate(1.0, (k) => { updateStream(dripTop.y - 0.04); bloom.scale.set(k * 0.8, k * 0.5, k * 0.8); });
  audio.stop('pour');
  stream.visible = false;
  steamSources.add(dripSteam);
  await animate(2.2, (k) => {
    const b = 0.8 + 0.2 * ease(k);
    bloom.scale.set(b, 0.5 + 0.5 * ease(k), b);
  });

  // 4. 注水：手沖壺繞小圈，下壺的咖啡慢慢升起
  stream.visible = true;
  const base = kettle.position.clone();
  audio.start('pour');
  await animate(4.6, (k) => {
    const a = k * Math.PI * 6;
    kettle.position.set(base.x + Math.cos(a) * 0.012, base.y, base.z + Math.sin(a) * 0.012);
    updateStream(dripTop.y - 0.04);
    serverLiquid.scale.y = 0.001 + k * 0.085;
    serverLiquid.position.y = serverLiquid.scale.y / 2 + 0.002;
  });
  audio.stop('pour');
  stream.visible = false;
  await moveKettle(null, 0.7);
  setPaper(deshu, deshuCanvas.idle);
  await wait(0.4);

  // 5. 倒進杯子
  stationCup.userData.liquid.visible = true;
  audio.start('pourCup');
  await animate(1.2, (k) => {
    serverLiquid.scale.y = 0.086 * (1 - k) + 0.001;
    serverLiquid.position.y = serverLiquid.scale.y / 2 + 0.002;
  });
  audio.stop('pourCup');
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
    say(keeper() ? F.KEEPER.serveWalk : '好了，我端過去。', 2500);
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
  if (opt.enamel) { /* 最後一晚：德叔叫老闆名字的那句，由告別的場景說（farewell.js 第 7 段） */ }
  else if (opt.last) say(H.CLOSING.lastCup, 4500); // 劇本：打烊「最後一杯，是老闆的。」
  else if (bean === 'zhe-beans') say('阿哲的豆。他說寫大一點，我就寫大一點。', 4500); // 【待定】
  else if (withLongan && !save.flags.longanServed) { save.flags.longanServed = true; say('配阿哲阿公的龍眼乾。窯烤的。', 4500); } // 【待定】
  else say(keeper() ? F.KEEPER.served : '東山的豆，就是窗外那片山。', 4500);

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
  if (state.weather !== 'clear' && seat.id === 'window') save.stats.rainyWindowCups++; // 雨天（颱風夜也算）坐窗邊喝一杯
  persist();
  // 開場第四幕：溫度要等德叔說完「店是空的……」才上升（劇本第 4、5 步的順序），交給 tutorialAfterCup()
  const inTutorial = state.tutorial === 'brew';
  const firstCup = !inTutorial && checkTasks({ delay: 4800 }).includes('first-coffee');
  if (inTutorial) tutorialAfterCup(true);
  if (opt.last) afterLastCup(bean);
  if (opt.guest) guestListen(seat);

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
  audio.play('cup', { enamel: !!cup.userData.enamel });
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

/* ---------- 龍眼：睡覺的地方、散步、給不給摸、跳上老闆的椅子（src/cat.js） ---------- */
// 睡覺的地方依擺飾換（cat.js 決定，和營業日誌同一個結果）；平常睡在那裡，偶爾起來走一走再回去
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const CAT_WANDER = [V3(-0.9, 0, 3.2), V3(0.9, 0, 0.3), V3(-2.4, 0, 1.2), V3(0.6, 0, -3.3), V3(-0.3, 0, 1.4)];
const CAT_SEAT_Y = { window: 0.42, bar: 0.72, sofa: 0.42 }; // 三張椅子的椅面高度
const CAT_ITEM_Y = { bookshelf: 1.88, 'book-wall': 2.48, 'cat-cushion': 0.1, 'cat-tree': 1.5, 'rattan-chair': 0.55 }; // 睡在擺飾上的高度
let catBusy = false;
let catHoldUntil = 0; // 龍眼陪著熟客（跳上凱文的腿、睡在予安旁邊）的時候不散步
let catSpot = null; // 今天睡的地方（cat.js 的 CAT_SPOTS）
let catAtHome = false; // 在睡覺的地方
let catOnSeat = null; // 跳上了哪張椅子（座位 id）
let catSeatUntil = 0;
const catMood = { taps: [], awayUntil: 0 }; // 點太多次就走開（cat.js 的 petCat）

// 睡覺的地方在店裡的哪裡：擺飾的位置（靠牆的東西往室內一點），沒有擺飾的地方是固定的點
function catSpotPlace(spot) {
  if (spot.items) {
    const p = [...decorPapers.values()].find((d) => spot.items.includes(d.userData.item.id) && !d.userData.entry.trial);
    if (p) {
      const b = p.userData.base;
      const n = V3(Math.sin(b), 0, Math.cos(b)); // 擺飾面向室內的方向
      return { pos: p.position.clone().setY(0).addScaledVector(n, 0.12), y: CAT_ITEM_Y[p.userData.item.id] ?? 0 };
    }
  }
  if (spot.id === 'sofa') return { pos: V3(-1.65, 0, 3.45), y: 0.42 };
  if (spot.id === 'step') return { pos: V3(0.75, 0, 3.6), y: 0 };
  return { pos: V3(-1.7, 0, -3.55), y: 0 }; // 窗台下
}
// 跳上、跳下：y 是要到的高度
function catHop(y, sec = 0.45) {
  const m = cat.userData.mesh, from = m.position.y;
  return animate(sec, (k) => { m.position.y = from + (y - from) * ease(k) + Math.sin(Math.PI * k) * 0.18; });
}
// 走到某處（在高處就先跳下來），到了再跳上去
async function catGo(to, y = 0, pose = 'sleep', speed = 0.45) {
  setPaper(cat, catCanvas.sit);
  if (cat.userData.mesh.position.y > 0.02) await catHop(0);
  await walk(cat, to, speed);
  cat.userData.mesh.position.y = 0;
  if (y > 0) await catHop(y);
  cat.userData.mesh.position.y = y;
  setPaper(cat, catCanvas[pose]);
}
// 回到今天睡覺的地方；第一次睡上新的擺飾時，德叔說一句（announce）
async function catHome(announceFirst = false) {
  if (catBusy || !catSpot) return;
  catBusy = true;
  catOnSeat = null;
  const spot = catSpot, at = catSpotPlace(spot);
  await catGo(at.pos, at.y);
  catBusy = false;
  catAtHome = spot === catSpot;
  if (spot.items && !save.cat.seen.includes(spot.id)) {
    save.cat.seen.push(spot.id);
    persist();
    if (announceFirst && spot.first) announce([['德叔', spot.first]], 600);
  }
}
// 開店時龍眼已經睡在那裡了
function placeCatAtHome() {
  catSpot = catSpotOn(save, today());
  const at = catSpotPlace(catSpot);
  cat.position.copy(at.pos);
  cat.userData.mesh.position.y = at.y;
  setPaper(cat, catCanvas.sleep);
  catAtHome = true;
  catOnSeat = null;
  if (catSpot.items && !save.cat.seen.includes(catSpot.id)) { save.cat.seen.push(catSpot.id); persist(); }
}
// 擺飾換了、換了一天：睡覺的地方可能也換了
function refreshCat(announceFirst = false) {
  catSpot = catSpotOn(save, today());
  catAtHome = false;
  if (!catBusy && performance.now() > catHoldUntil && !catOnSeat) catHome(announceFirst);
}
const catHeld = () => catBusy || performance.now() < catHoldUntil || performance.now() < catMood.awayUntil;
// 偶爾起來走一走；陪完熟客、跳上椅子一陣子、走開一陣子之後，回去睡
setInterval(async () => {
  if (catBusy || performance.now() < catHoldUntil || !catSpot) return;
  if (catOnSeat) { if (performance.now() > catSeatUntil) catHome(); return; }
  if (!catAtHome) { if (performance.now() > catMood.awayUntil) catHome(); return; }
  if (Math.random() > 0.35 || state.scene) return;
  catBusy = true;
  catAtHome = false;
  await catGo(CAT_WANDER[Math.floor(Math.random() * CAT_WANDER.length)], 0, 'sit', 0.35);
  await wait(5);
  catBusy = false;
  catHome();
}, 22000);

// 點龍眼：給摸就呼嚕；點太多次，他就轉身走開，一陣子不理人
function petTheCat() {
  const r = petCat(catMood, performance.now());
  if (r === 'ignore') return;
  if (r === 'purr') {
    say(PURR[Math.floor(Math.random() * PURR.length)], 2500, cat);
    const m = cat.userData.mesh;
    let t = 0;
    realWaiters.push((dt) => { t += dt; m.scale.y = 1 - Math.sin(Math.PI * Math.min(1, t / 0.5)) * 0.12; return t >= 0.5; });
    return;
  }
  bubble.classList.remove('show');
  catMood.awayUntil = performance.now() + 45000 / DEV_SPEED;
  if (!save.cat.refused) { save.cat.refused = true; persist(); announce([['德叔', CAT_LINES.refuseFirst]], 1400); }
  if (catBusy) return;
  // 走到離老闆最遠的地方
  const far = CAT_WANDER.slice().sort((a, b) => b.distanceTo(camera.position) - a.distanceTo(camera.position))[0];
  catBusy = true;
  catAtHome = false;
  catOnSeat = null;
  (async () => {
    await glance(cat, 0.3);
    await catGo(far, 0, 'sleep', 0.55);
    catBusy = false;
  })();
}

// 老闆站起來，椅子還熱著：龍眼跳上去睡（溫度任務 #7）
function maybeCatChair(seat, satSec) {
  if (performance.now() < catHoldUntil || performance.now() < catMood.awayUntil || catOnSeat) return;
  if (state.scene || state.tutorial || state.guest || !save.flags.seenOpening) return;
  if (!jumpsOnChair(save, satSec, Math.random())) return;
  (async () => {
    await realWait(700);
    for (let i = 0; catBusy && i < 40; i++) await realWait(200); // 正在散步的話，等他走完
    if (catBusy || state.mode === 'seat') return;
    catBusy = true;
    catAtHome = false;
    await catGo(seat.prop.position.clone().add(V3(0, 0, 0.12)), CAT_SEAT_Y[seat.id], 'sleep', 0.6);
    catBusy = false;
    if (state.mode === 'seat' && state.seat === seat) { catShoo(); return; } // 老闆又坐回去了
    catOnSeat = seat.id;
    catSeatUntil = performance.now() + 90000 / DEV_SPEED;
    save.cat.chairs++;
    if (!save.flags.catOnChair) save.flags.catOnChair = true;
    persist();
    checkTasks({ delay: 500 }); // 德叔的一句話寫在 tasks.js（【待定】）
  })();
}
// 老闆要坐的椅子上有龍眼（或他就睡在旁邊）：他跳下來，走到旁邊
function catShoo() {
  if (catBusy) return;
  const s = state.seat;
  if (!s) return;
  const near = catOnSeat === s.id || cat.position.distanceTo(V3(s.prop.position.x, 0, s.prop.position.z)) < 0.75;
  if (!near) return;
  catOnSeat = null;
  catBusy = true;
  catAtHome = false;
  const to = CAT_WANDER.slice().sort((a, b) => a.distanceTo(cat.position) - b.distanceTo(cat.position))[0];
  catGo(to, 0, 'sit', 0.5).then(() => { catBusy = false; });
}

/* ---------- 白天／夜晚 ---------- */
// 雨天：天光灰一點、窗外下雨；颱風夜：一定是夜裡，窗外的雨斜著打
function applyLight() {
  const n = state.night;
  const wet = state.weather !== 'clear', storm = state.weather === 'typhoon';
  hemi.color.set(n ? (storm ? '#7d8a99' : '#a594b0') : wet ? '#c9d2dc' : '#dfe8ff'); // 夜裡是室內燈的暖光，不是天光
  hemi.groundColor.set(n ? '#5a3f2c' : '#a8865f');
  hemi.intensity = n ? (storm ? 0.8 : 0.9) : wet ? 1.15 : 1.6; // 夜裡留足夠的環境光，背對吊燈的紙片才不會整片黑
  sun.intensity = n ? 0 : wet ? 0.6 : 2.0;
  applyLamps(); // 吊燈的亮度每一幀由 updateLights() 依開關慢慢調
  for (const w of windows) { w.material.map = winTex(n, state.weather); w.material.needsUpdate = true; }
  // 夜裡（打烊、颱風夜）人物與龍眼帶一點自己的光：站在吊燈前面背光時，才不會只剩一個黑影
  for (const p of [deshu, yuan, zhe, kevin, grandpa, cat]) {
    const m = p.userData.mesh.material;
    m.emissiveMap = m.map;
    m.emissive.set(n ? '#6a5a4c' : '#000000');
    m.needsUpdate = true;
  }
  for (const r of rainPlanes) { r.visible = wet; r.material.map = storm ? rainTex.typhoon : rainTex.rain; r.material.opacity = storm ? 0.95 : 0.7; r.material.needsUpdate = true; }
  scene.background = new THREE.Color(n ? '#13151d' : '#ece2d0');
  renderer.toneMappingExposure = n ? 1.15 : 1.0;
  $('night').textContent = n ? '夜晚 2700K' : '白天 5200K';
  applySound();
}

/* ---------- 鏡頭 ---------- */
const OVER = { pos: new THREE.Vector3(-0.3, 11.8, 7.4), look: new THREE.Vector3(0, 0, 0.1) };
const cam = { pos: OVER.pos.clone(), look: OVER.look.clone(), yaw: 0, pitch: 0 };
let tween = null;

// 依可用的高度調整俯瞰鏡頭（美術評分修正 a）：扣掉頂部介面（量出來的，含第二列的「略過開場」與快轉）與底部按鈕列＋提示，
// 在剩下的範圍裡找最大的房間：仰角在 58°～66° 之間挑一個讓房間最高的，距離用二分法，房間在可用範圍裡垂直置中。
// 整間店的地板、後牆的溫度計高度、三個座位與它們上方的標籤，都要落在範圍裡（直立窄畫面原本下半部空了一大塊）
const FIT_ROOM = [];
for (const x of [-ROOM.w / 2, ROOM.w / 2]) for (const z of [-ROOM.d / 2, ROOM.d / 2]) FIT_ROOM.push(new THREE.Vector3(x, 0, z));
FIT_ROOM.push(new THREE.Vector3(-ROOM.w / 2, 2.1, -ROOM.d / 2), new THREE.Vector3(ROOM.w / 2, 2.1, -ROOM.d / 2));
const FIT_FRONT = [1, 3]; // FIT_ROOM 裡地板靠鏡頭（z＝ROOM.d / 2）的兩個角
// 介面佔用的像素：top＝頂部介面最下緣（measureUi() 量），bottom＝底部按鈕列＋一行提示；labelH＝座位標籤（含小三角）的高度
const UI_SPACE = { top: 64, bottom: 112, labelW: 48, labelH: 44 };
const UI_GAP = 8; // 泡泡、標籤和頂部介面之間至少留的距離
// 量頂部介面的最下緣（相對於 #app）；變了就回傳 true
function measureUi() {
  const a = app.getBoundingClientRect();
  let top = 0;
  for (const el of document.querySelectorAll('.top, #speed, #op-skip-shop')) {
    if (el.hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.height) top = Math.max(top, r.bottom - a.top);
  }
  top = Math.ceil(top) || 64;
  const changed = top !== UI_SPACE.top;
  UI_SPACE.top = top;
  return changed;
}
const OVER_BASE = { yaw: Math.atan2(OVER.pos.x - OVER.look.x, OVER.pos.z - OVER.look.z), look: OVER.look.clone() };
const propTop = (p) => p.userData.mesh.geometry.parameters.height + p.userData.mesh.position.y;
function fitOverview() {
  const w = app.clientWidth, h = app.clientHeight;
  if (!w || !h) return;
  measureUi();
  const probe = new THREE.PerspectiveCamera(50, w / h, 0.05, 80);
  const v = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
  const top = 1 - (2 * (UI_SPACE.top + UI_GAP)) / h, bottom = -1 + (2 * UI_SPACE.bottom) / h;
  const labelUp = (2 * (UI_SPACE.labelH + 10)) / h, labelSide = 1 - (2 * UI_SPACE.labelW) / w;
  const pts = [...FIT_ROOM];
  for (const st of SEATS) pts.push(st.prop.position.clone(), st.prop.position.clone().setY(propTop(st.prop)));
  const look = new THREE.Vector3();
  // 放好鏡頭（仰角 e、距離 d），把整間店在可用範圍裡垂直置中；回傳是否放得下與房間的高度（NDC）
  const place = (e, d) => {
    const dir = new THREE.Vector3(Math.sin(OVER_BASE.yaw) * Math.cos(e), Math.sin(e), Math.cos(OVER_BASE.yaw) * Math.cos(e));
    look.copy(OVER_BASE.look);
    let lo = 0, hi = 0, ok = true;
    for (let it = 0; it < 4; it++) {
      probe.position.copy(look).addScaledVector(dir, d);
      probe.lookAt(look);
      probe.updateMatrixWorld();
      lo = Infinity; hi = -Infinity; ok = true;
      pts.forEach((p, i) => {
        v.copy(p).project(probe);
        lo = Math.min(lo, v.y); hi = Math.max(hi, v.y);
        // 地板靠鏡頭的兩個角是空地板：可以切掉一點；其他點（後牆、座位）都要完整在畫面裡
        if (Math.abs(v.x) > (FIT_FRONT.includes(i) ? 1.1 : 0.96)) ok = false;
      });
      right.set(1, 0, 0).applyQuaternion(probe.quaternion);
      for (const st of SEATS) {
        const half = st.prop.userData.mesh.geometry.parameters.width / 2;
        for (const sgn of [-1, 1]) {
          v.copy(st.prop.position).addScaledVector(right, sgn * half).project(probe);
          if (Math.abs(v.x) > 0.97) ok = false;
        }
      }
      for (const st of SEATS) {
        v.copy(st.prop.position).setY(propTop(st.prop)).project(probe);
        hi = Math.max(hi, v.y + labelUp);
        if (Math.abs(v.x) > labelSide) ok = false;
      }
      if (it === 3) break;
      // 往上下平移，讓房間（含標籤）的中心對齊可用範圍的中心
      const shift = ((lo + hi) / 2 - (top + bottom) / 2) * d * Math.tan(THREE.MathUtils.degToRad(25));
      up.set(0, 1, 0).applyQuaternion(probe.quaternion);
      look.addScaledVector(up, shift);
    }
    // 房間看起來多大：地板四個角在畫面上的高度
    let f0 = Infinity, f1 = -Infinity;
    for (let i = 0; i < 4; i++) { v.copy(FIT_ROOM[i]).project(probe); f0 = Math.min(f0, v.y); f1 = Math.max(f1, v.y); }
    return { ok: ok && hi <= top + 0.01 && lo >= bottom - 0.01, span: f1 - f0, dir };
  };
  let best = null;
  for (let deg = 58; deg <= 66; deg += 2) {
    const e = THREE.MathUtils.degToRad(deg);
    let lo = 6, hi = 60;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (place(e, mid).ok) hi = mid; else lo = mid; }
    const r = place(e, hi);
    if (r.ok && (!best || r.span > best.span + 0.02)) best = { deg, span: r.span, pos: look.clone().addScaledVector(r.dir, hi), look: look.clone() };
  }
  if (!best) return;
  OVER.deg = best.deg;
  OVER.pos.copy(best.pos);
  OVER.look.copy(best.look);
  if (state.mode === 'overview' && !tween) { cam.pos.copy(OVER.pos); cam.look.copy(OVER.look); }
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
  const targetFov = state.mode === 'overview' ? 50 : state.closeup ? 52 : state.focus ? FOCUS_FOV : SEAT_FOV;
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
  focusP = null; lookTok++;
  moveCamera(seat.eye, seat.look);
  state.satAt = performance.now();
  catShoo(); // 椅子上（或旁邊）睡著龍眼的話，他跳下來讓位
  if (state.guest === 'sit') {
    // 客人模式：坐下之後德叔過來點單
    if (!save.seatsSat.includes(seat.id)) { save.seatsSat.push(seat.id); persist(); }
    guestOrder(seat);
    return;
  }
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
  if (state.closing === 'lastcup') {
    // 打烊：坐下之後，德叔沖最後一杯
    setTimeout(() => { if (state.closing === 'lastcup' && state.seat === seat) lastCup(seat); }, 1400 / DEV_SPEED);
    if (!save.seatsSat.includes(seat.id)) { save.seatsSat.push(seat.id); persist(); }
    checkTasks({ delay: 1800 });
    return;
  }
  if (++state.satThisVisit === 1 && !state.closing) setTimeout(() => say('不急，咖啡會等人，人也該等咖啡。'), 1500);
  if (!save.seatsSat.includes(seat.id)) { save.seatsSat.push(seat.id); persist(); }
  // 坐遍三個座位：德叔的一句話寫在 tasks.js（【待定】）
  checkTasks({ delay: state.satThisVisit === 1 ? 5200 : 1800 });
}

function stand() {
  const seat = state.seat;
  focusP = null; lookTok++;
  const satSec = ((performance.now() - (state.satAt || performance.now())) / 1000) * DEV_SPEED;
  state.closeup = false;
  state.seat.prop.visible = true;
  state.mode = 'overview';
  state.seat = null;
  cam.yaw = 0; cam.pitch = 0;
  frontWall.visible = false;
  ceiling.visible = false;
  moveCamera(OVER.pos, OVER.look);
  updateUI();
  maybeCatChair(seat, satSec); // 椅子還熱著：龍眼可能跳上去
}

/* ---------- 介面 ---------- */
const labels = SEATS.map((s) => {
  const b = document.createElement('button');
  b.className = 'seat-label';
  b.innerHTML = `<span>${s.name}</span>`;
  b.onclick = () => sit(s);
  $('labels').appendChild(b);
  return b;
});

const show = (id, on) => { $(id).hidden = !on; };
function updateUI() {
  applySound(); // 音樂跟著店裡的狀態（打烊後、明天見之後）；只有變了才會動
  const over = state.mode === 'overview';
  const placing = state.placing, sel = !!state.selected;
  // 演出中（讀信後的鏡頭、推門進店、熟客的里程碑、客人模式、打烊時客人離開）：下面的按鈕都先收起來；有選項時只留選項
  const tut = state.tutorial, g = state.guest, cl = state.closing;
  const film = state.cinematic || tut === 'enter' || !!state.scene || g === 'enter' || g === 'order' || g === 'talk' || cl === 'leaving' || cl === 'bye' || !!state.arriving;
  const choosing = state.choice;
  const letter = !!state.letter && !film;
  const free = !tut && !film && !letter && !choosing && !g;
  const after = cl === 'after';
  const canSit = !film && !letter && !choosing && ((!tut && !g) || tut === 'sit' || g === 'sit');
  $('labels').style.display = (over || g === 'sit') && !placing && canSit ? '' : 'none';
  // 打烊後的燈：每盞燈旁邊的「關燈／開燈」
  lightsEl.style.display = after && !placing && free ? '' : 'none';
  show('stand', !over && free);
  show('brew', !over && !film && !letter && !choosing && (!tut || tut === 'brew') && (!g || g === 'brew') && (!cl || brewing));
  show('place', over && !placing && free);
  show('night', !placing && free && !cl);
  show('close-shop', over && !placing && free && !cl && !!save.flags.seenOpening && !F.departureDue(save, today()));
  show('diary-btn', after && !placing && free);
  show('goodnight', after && !placing && free);
  show('choices', choosing);
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
  const bar = keeper() ? '凱文' : '德叔'; // 離開東山之後，吧台後面是凱文
  $('brew').textContent = !brewing ? `請${bar}沖一杯`
    : phase === 'wait' ? `${bar}走回吧台……`
    : phase === 'serve' ? `${bar}端過來了`
    : state.closeup ? '回座位' : `看${bar}沖`;
  $('day').textContent = `開店第 ${today()} 天`;
  // 打烊後沒有任何提示（企劃：沒有任何任務）；沖煮中的「按住畫面」與佈置的操作說明照常
  const hint = choosing ? state.choicePrompt || ''
    : film ? ''
    : letter ? '德叔把一封信放在吧台上' // 【待定】
    : tut === 'sit' || g === 'sit' ? '點一張椅子坐下'
    : tut === 'gift' || tut === 'choose' ? ''
    : cl && !brewing && !placing ? ''
    : !over
    ? (brewing ? (state.hold ? '時間走快了一點……' : '按住畫面可以讓時間走快一點') : g ? '' : '左右拖曳環顧四周，點人物可以搭話')
    : !placing ? '點座位坐下，用客人的角度看看這間店'
    : sel ? `已選：${state.selected.userData.name}，點地板放到那裡`
    : placingHint();
  $('hint').textContent = hint;
  $('hint').hidden = !hint;
  if (measureUi()) fitOverview(); // 「略過開場」出現或收起：俯瞰鏡頭跟著可用的高度重算
  endFocus();
  $('vignette').classList.toggle('on', !!state.focus && state.mode === 'seat' && !state.closeup);
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
  const beforeSet = placedSet(save);
  const r = commitLayout(save, layout, now());
  tryNewSpot(save, beforeSet, today()); // 擺了新的貓窩：龍眼今天先去試睡
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
  refreshCat(true);
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
    for (const e of stored) { const it = itemById(e.item); list.appendChild(row(it, it.carry ? '可以帶去下一站' : CATEGORY[it.cat], '擺出來', () => putOut(e))); }
  }
  sheet.hidden = false;
  list.scrollTop = 0;
  $('sheet-close').focus();
}
function closeSheet() { sheet.hidden = true; sheetKind = null; }
$('sheet-close').onclick = closeSheet;
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

$('stand').onclick = stand;
// 菜單上有兩支以上的豆子（阿哲的豆上架後），先選今天喝哪一支
$('brew').onclick = async () => {
  if (phase === 'brew') { toggleCloseup(); return; }
  if (brewing || !state.seat || state.choice) return;
  const coffees = save.menu.filter((id) => S.MENU[id]?.kind === 'coffee');
  let bean = 'dongshan';
  if (coffees.length > 1) bean = coffees[await choose(coffees.map((id) => S.MENU[id].name), '今天想喝哪一支豆子？')];
  if (!brewing && state.seat) brew(state.seat, bean);
};

// 畫面下方的選項（≥ 44px）：回傳選了第幾個
function choose(options, prompt = '') {
  return new Promise((resolve) => {
    const box = $('choices');
    box.innerHTML = '';
    options.forEach((text, i) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = () => { state.choice = false; state.choicePrompt = ''; box.innerHTML = ''; updateUI(); resolve(i); };
      box.appendChild(b);
    });
    state.choice = true;
    state.choicePrompt = prompt;
    updateUI();
  });
}
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
  if (!$('map').hidden) closeMap();
  else if (!$('diary').hidden) closeDiary();
  else if (!$('letter').hidden) closeLetter();
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
  $('nb-decor').textContent = `店裡擺著 ${placed} 件東西${save.owned.length > placed ? `，倉庫裡還有 ${save.owned.length - placed} 件` : ''}。${keeper() ? '店長：凱文。' : ''}`;
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
  if (lastPage) link(`${lastPage.keeper ? '凱文' : '德叔'}的營業日誌・${dateLabel(lastPage.t)}`, () => openJournal(lastPage));
  if (keeper()) link(F.MAP.title, () => showMap('notebook'));
  if (save.flags.seenOpening) link('律師信', () => openLetter(LAWYER_LETTER));
  for (const r of save.letters) {
    const l = letterById(r.id);
    if (l) link(`老先生的${l.title}・${dateLabel(r.t)}`, () => openLetter(l));
  }
  if (S.hasMilestone(save, 'yuan', 5)) link('予安念的稿子', () => openLetter(S.DOCS.manuscript));
  if (S.hasMilestone(save, 'yuan', 6)) link('予安的書・扉頁', () => openLetter(S.DOCS.dedication));
  if (save.diary.length) link(`今天的一杯・咖啡日記（${save.diary.length} 杯）`, () => openDiary('read'));
  // 店裡的熟客（只列見過的人，不列來店次數）與菜單
  const people = $('nb-people');
  people.innerHTML = '';
  const met = S.REGULAR_IDS.filter((w) => S.hasMilestone(save, w, 1));
  if (met.length) {
    const h = document.createElement('h3');
    h.textContent = '店裡的熟客';
    people.appendChild(h);
    for (const w of met) {
      const info = S.REGULARS[w];
      const named = w !== 'kevin' || S.hasMilestone(save, 'kevin', 2);
      const p = document.createElement('p');
      p.className = 'nb-person';
      p.innerHTML = `<b>${named ? `${info.name}（${info.short}）` : '冰美式先生'}</b><span>${info.about}</span>`;
      people.appendChild(p);
    }
  }
  const h = document.createElement('h3');
  h.textContent = '菜單';
  people.appendChild(h);
  const menu = document.createElement('p');
  menu.className = 'nb-person';
  menu.textContent = save.menu.map((id) => S.MENU[id]?.name).filter(Boolean).join('・');
  people.appendChild(menu);
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
// 開發者工具：畫面效能（FPS、解析度倍率、每幀繪製次數、貼圖數）
function refreshPerfLine() {
  const m = renderer.info;
  $('dev-perf').textContent = `${Math.round(PERF.fps)} FPS・解析度 ×${PERF.ratio}（上限 ×${PERF.cap}）・繪製 ${m.render.calls} 次・貼圖 ${m.memory.textures} 張`;
}
function refreshDevTools() {
  if (!DEV) return;
  const prog = S.REGULAR_IDS.map((w) => `${S.REGULARS[w].short} ${save.regulars[w].milestones.length}/6`).join('・');
  $('dev-day').textContent = `開發者工具・開店第 ${today()} 天・基金 ${fmt(balance(save))} 元・${prog}・告別 ${F.fw(save).step}/7${keeper() ? '（已離開東山）' : ''}`;
}
// 營業日誌接上熟客的里程碑引擎：一天一天結算老闆不在的日子（今天由 startDay 在店裡演）
function journalOpts() {
  if (!REGULARS_ON) return { keeper: keeper() };
  return {
    story: (day) => S.settleThrough(save, Math.min(day, today() - 1)).map((e) => ({ line: e.line, kind: e.kind })),
    met: (day) => S.metOn(save, day),
    keeper: keeper(),
  };
}
// 跳天數就像老闆離開了 n 天：德叔把這幾天的營業日誌交給老闆，收好之後再說到期的任務
function jumpDays(n) {
  const from = now();
  stopStory(); // 正在演的熟客場景作廢（開發者工具才會在演出中跳天數）
  stopGuest();
  exitClosing(); // 打烊的店，隔天重新開門
  save.dev.offsetMs += n * JUMP_DAY_MS;
  shownDay = today(); // 跳過去的天數不用再由午夜的檢查處理一次
  const page = save.flags.seenOpening && !F.departureDue(save, today()) ? writeJournal(save, from, now(), journalOpts()) : null;
  if (page && keeper()) page.keeper = true;
  keepPage(save, page);
  persist();
  showYuan();
  refreshWeather();
  refreshCat();
  updateUI();
  refreshDevTools();
  if (page) { openAbout(false); openJournal(page, () => { checkTasks({ delay: 600 }); startDay(); }); }
  else { openAbout(false); checkTasks(); startDay(); }
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
  if (d === shownDay || state.closing || state.guest) return; // 打烊後、客人模式中過了午夜：等老闆離開店裡再換一天
  shownDay = d;
  showYuan();
  refreshCat();
  // 老闆在店裡過了午夜：昨天沒來得及在店裡出現的熟客照常結算，可離線的里程碑由德叔一句話帶過
  if (REGULARS_ON && save.flags.seenOpening) {
    const ev = S.settleThrough(save, d - 1).filter((e) => e.kind === 'milestone');
    announce(ev.slice(0, 2).map((e) => ['德叔', e.line]), 1500);
  }
  refreshWeather();
  updateUI();
  checkTasks();
  startDay();
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
NAMES.set(deshu, '德叔').set(yuan, '予安').set(cat, '龍眼').set(zhe, '阿哲').set(kevin, '凱文').set(grandpa, '阿公');
const WHO = { 德叔: deshu, 予安: yuan, 龍眼: cat, 阿哲: zhe, 凱文: kevin }; // tasks.js 台詞裡的說話者
const HEAD = new Map([[deshu, 2.0], [cat, 0.5]]);
// 泡泡的高度：紙片的頭頂（姿勢不同，高度不同）
// 美術評分修正 a：圖的上面常有留白（例如坐著的予安），改用圖裡第一列有畫東西的高度，泡泡與對話鏡頭才對得準頭
const inkCache = new WeakMap();
function inkTop(img) {
  if (!img?.getContext) return 0;
  if (inkCache.has(img)) return inkCache.get(img);
  let empty = 0;
  try {
    const { data } = img.getContext('2d').getImageData(0, 0, img.width, img.height);
    let row = 0;
    find: for (; row < img.height; row++) for (let x = 3; x < img.width * 4; x += 16) if (data[row * img.width * 4 + x] > 40) break find;
    empty = row < img.height ? row / img.height : 0;
  } catch { empty = 0; }
  inkCache.set(img, empty);
  return empty;
}
const headOf = (p) => {
  const m = p.userData.mesh;
  const h = m.geometry.parameters.height;
  return (HEAD.get(p) ?? h * (1 - inkTop(m.material.map?.image)) + 0.06) + m.position.y; // 龍眼睡在書架上、椅子上時泡泡跟著高
};
const LINES = new Map([
  [deshu, ['不急。', '老闆，今天想坐哪裡？', '水溫九十度，剛好。', '這間店，慢慢會有自己的樣子。']],
]);
// 熟客的台詞依故事進度（story.js 的 TALK）
function regularLine(w) {
  const n = save.regulars[w].milestones.length;
  const groups = S.TALK[w].filter((g) => (g.after || 0) <= n);
  const latest = groups[groups.length - 1];
  const pool = Math.random() < 0.6 ? latest.lines : groups.flatMap((g) => g.lines);
  return pool[Math.floor(Math.random() * pool.length)];
}
function talkTo(r) {
  if (state.cinematic || state.tutorial === 'enter' || state.scene || state.choice || state.guest || state.arriving) return;
  const people = [deshu, yuan, zhe, kevin, cat].filter((p) => p.visible);
  const hit = r.intersectObjects(people.map((p) => p.userData.mesh))[0];
  if (!hit) return;
  const who = people.find((p) => p.userData.mesh === hit.object);
  if (who === deshu && brewing) return;
  if (who === cat) { petTheCat(); return; } // 摸龍眼（點太多次他會走開）
  let line;
  if (who === yuan && !save.flags.metYuan) { line = '……啊，你好。我叫予安，常坐在這裡寫稿。'; save.flags.metYuan = true; persist(); }
  else if (who === yuan || who === zhe || who === kevin) line = regularLine(who === yuan ? 'yuan' : who === zhe ? 'zhe' : 'kevin');
  else if (who === deshu && keeper()) { const l = state.closing ? F.KEEPER.closingTalk : F.KEEPER.talk; line = l[Math.floor(Math.random() * l.length)]; } // 離開東山之後，吧台後面是凱文
  else if (who === deshu && state.closing) line = H.CLOSING.deshuTalk[Math.floor(Math.random() * H.CLOSING.deshuTalk.length)]; // 打烊後，他在擦杯子
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
  const op = runOpening({ root: $('opening'), save, persist, art: A, speed: DEV_SPEED, sound: { stage: () => applySound(), play: (n) => audio.play(n) } });
  op.done.then(({ lines }) => enterShop(lines));
  openingCtl = op;
  applySound();
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
  audio.play('door'); audio.play('bell');
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
  startDay(); // 開店第一天：阿哲會拎著龍眼乾來
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
  $('jr-title').textContent = page.keeper ? '凱文的營業日誌' : '德叔的營業日誌'; // 離開東山之後，凱文寫
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
  const hand = letter.hand ?? letter !== LAWYER_LETTER; // 律師信是印刷的，其他是手寫的
  letterEl.querySelector('.card').classList.toggle('hand', hand);
  $('lt-title').textContent = letter.title;
  $('lt-body').innerHTML = letter.paragraphs
    .map((p, i) => `<p>${letter.shaky ? shaky(p, 97 + i * 31) : p.replace(/[<>&]/g, '')}</p>`).join('');
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
const overlayOpen = () => [about, notebook, sheet, journalEl, letterEl, $('opening'), $('diary'), $('closed'), $('map')].some((el) => !el.hidden);
function quiet() {
  return save.flags.seenOpening && !state.tutorial && !state.letter && !state.cinematic && !state.scene && !state.choice && !brewing && !deshuReturning && !state.placing
    && !state.guest && (!state.closing || state.closing === 'after') && !overlayOpen() && !sayBusy && performance.now() > Math.max(readyAt, sayEnds + 1500 / DEV_SPEED);
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
    if (letter.id === 'second') departScene(); // 離開東山的早上：讀完就出發
    else wipeScene();
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
    if (f !== frame) { frame = f; mat.map = f % 2 ? tex.wipe2 : tex.wipe; if (mat.emissiveMap) mat.emissiveMap = mat.map; mat.needsUpdate = true; }
    if (t > 6.5) { done(); return true; }
    return false;
  }));
  if (seat && state.seat === seat) moveCamera(seat.eye, seat.look);
  else { ceiling.visible = false; moveCamera(OVER.pos, OVER.look); }
  await realWait(1500);
  mat.map = idleMap;
  if (mat.emissiveMap) mat.emissiveMap = idleMap;
  mat.needsUpdate = true;
  tex.wipe.dispose(); tex.wipe2.dispose();
  state.cinematic = false;
  readyAt = performance.now() + 4000 / DEV_SPEED;
  updateUI();
}

/* ---------- 三位熟客：在店裡的一天（里程碑引擎在 src/story.js） ---------- */
// 老闆在店裡時，今天會來的熟客依自己的習慣出現：予安整天坐窗邊、阿哲不固定、凱文下午五點。
// 走進店裡就記一次來店；可以演的里程碑等店裡安靜下來（和交信一樣）才演，「在場」里程碑一天最多一個。
const V2 = (x, z) => new THREE.Vector3(x, 0, z);
const DOOR_IN = V2(0.15, 3.7);
// 每個人的位子：pos 站或坐的地方、cup 德叔把杯子放在哪裡（null 就拿在手上）、counter 在吧台前（德叔從吧台裡面遞）、stool 會被擋住的高腳椅
const SPOT = {
  yuan: { pos: V2(-0.4, -1.75), cup: new THREE.Vector3(-0.22, tY.h + 0.02, -2.15) },
  kevin: { pos: V2(1.3, -2.9), cup: new THREE.Vector3(1.72, TOP, -2.9), counter: true, stool: stoolFar },
  bar: { pos: V2(1.3, -0.2), cup: new THREE.Vector3(1.72, TOP, -0.2), counter: true },
};
// 凱文坐到老闆對面（依老闆坐的位子）
const OPPOSITE = {
  window: { pos: V2(-2.35, -1.3), cup: new THREE.Vector3(-2.2, tA.h + 0.02, -0.85) },
  bar: { pos: V2(1.3, -2.1), cup: new THREE.Vector3(1.72, TOP, -2.1), counter: true, stool: stoolMid },
  sofa: { pos: V2(-0.85, 1.75), cup: new THREE.Vector3(-1.2, tC.h + 0.02, 2.2) },
};
// 角落的候選位置（凱文躲起來、阿公坐的地方）
const CORNERS = [V2(-2.45, -3.3), V2(-1.3, -3.45), V2(0.75, -3.45), V2(2.35, 3.1), V2(-0.55, 3.35), V2(0.75, 3.4)];
const HOME_SPOT = { yuan: SPOT.yuan, kevin: SPOT.kevin, zhe: SPOT.bar };

const live = { day: 0, token: 0, expect: new Map(), arrived: new Set(), leaveAt: new Map(), at: {}, answers: {}, cups: new Map(), seatHinted: false, walking: 0, planned: {}, held: new Set(), fwHinted: 0 };
const ABORT = Symbol('abort');
const PEOPLE_IDS = ['yuan', 'zhe', 'kevin', 'grandpa'];
const defaultPose = (w) => (w === 'yuan' ? 'type'
  : w === 'kevin' ? (S.hasMilestone(save, 'kevin', 5) ? 'free' : 'sit')
  : w === 'zhe' ? (save.story.typhoonDay === today() ? 'towel' : 'stand')
  : 'sit');

// 角落：挑一個沒有擺飾、也沒有人的地方；老闆坐著的話，挑他轉頭看得到的那個
function freeCorner(w) {
  const near = (v, x, z, r) => Math.hypot(x - v.x, z - v.z) < r;
  const busy = (v) => [...decorPapers.values()].some((d) => near(v, d.position.x, d.position.z, 0.6))
    || [...PEOPLE_IDS.filter((o) => o !== w).map((o) => PEOPLE[o]), cat].some((p) => p.visible && near(v, p.position.x, p.position.z, 0.6));
  const s = state.mode === 'seat' ? state.seat : null;
  const ang = (x, z) => Math.atan2(x - s.eye.x, z - s.eye.z);
  // 從座位看過去，被比較近的人擋住的角落不選（例如阿公坐在予安正後方）
  const blocked = (v) => PEOPLE_IDS.some((o) => o !== w && PEOPLE[o].visible
    && Math.hypot(PEOPLE[o].position.x - s.eye.x, PEOPLE[o].position.z - s.eye.z) < Math.hypot(v.x - s.eye.x, v.z - s.eye.z)
    && Math.abs(wrapAngle(ang(PEOPLE[o].position.x, PEOPLE[o].position.z) - ang(v.x, v.z))) < 0.3);
  const turn = (v) => {
    if (!s) return 0;
    const b = s.look.clone().sub(s.eye);
    return Math.abs(wrapAngle(ang(v.x, v.z) - Math.atan2(b.x, b.z))) + (blocked(v) ? 3 : 0);
  };
  const free = CORNERS.filter((v) => !busy(v));
  const best = (free.length ? free : CORNERS).slice().sort((a, b) => turn(a) - turn(b))[0];
  return { pos: best.clone(), cup: null };
}
function spotFor(w, at) {
  if (at === 'home') return HOME_SPOT[w];
  if (at === 'bar') return SPOT.bar;
  if (at === 'opposite') return OPPOSITE[state.seat?.id] || SPOT.bar;
  if (at === 'corner') return freeCorner(w);
  if (at === 'cornerSide') { // 阿哲站在阿公旁邊
    const g = live.planned.grandpa?.pos || live.at.grandpa?.pos || CORNERS[2];
    return { pos: V2(g.x + (g.x > 0.5 ? -0.6 : 0.6), g.z - 0.1), cup: null };
  }
  return HOME_SPOT[w] || SPOT.bar;
}

// 走路：前後距離遠的話，先走到中間的走道（吧台與窗邊桌之間），不穿過桌子
function route(from, to) {
  const pts = [];
  if (Math.abs(to.z - from.z) > 1.2) pts.push(V2(0.45, from.z), V2(0.45, to.z));
  pts.push(to.clone());
  return pts;
}
async function walkPath(p, pts, speed) {
  for (const pt of pts) await walk(p, pt, speed);
  p.userData.mesh.position.y = 0;
}
function settle(w, spot) {
  if (live.at[w]?.stool) live.at[w].stool.visible = true;
  live.at[w] = spot;
  if (spot.stool) spot.stool.visible = false;
  PEOPLE[w].position.set(spot.pos.x, 0, spot.pos.z);
}
function placeAt(w, spot, pose) {
  setPose(w, pose || defaultPose(w));
  settle(w, spot);
  PEOPLE[w].visible = true;
}
const walkSpeed = (w, fast) => (fast ? 1.3 : w === 'grandpa' ? 0.45 : 0.75);
async function enterPerson(w, spot, walkPose, thenPose, fast) {
  const p = PEOPLE[w];
  const tok = live.token;
  setPose(w, walkPose || (w === 'kevin' ? 'walk' : 'stand'));
  p.position.copy(DOOR_IN);
  p.visible = true;
  if (!(w === 'grandpa' && PEOPLE.zhe.visible && PEOPLE.zhe.position.distanceTo(DOOR_IN) < 1)) audio.play('bell'); // 有人推門進來（阿公跟在阿哲後面，鈴只響一次）
  await walkPath(p, route(DOOR_IN, spot.pos), walkSpeed(w, fast));
  if (tok !== live.token) return; // 走到一半換了一天（開發者跳天數）
  settle(w, spot);
  setPose(w, thenPose || defaultPose(w));
}
async function movePerson(w, spot, walkPose, thenPose) {
  const p = PEOPLE[w];
  if (live.at[w]?.stool) live.at[w].stool.visible = true;
  const tok = live.token;
  if (walkPose) setPose(w, walkPose);
  await walkPath(p, route(p.position, spot.pos), walkSpeed(w));
  if (tok !== live.token) return;
  settle(w, spot);
  setPose(w, thenPose || defaultPose(w));
}
async function leavePerson(w) {
  const p = PEOPLE[w];
  if (!p.visible) return;
  live.arrived.delete(w);
  if (live.at[w]?.stool) live.at[w].stool.visible = true;
  delete live.at[w];
  removeGuestCup(w);
  setPose(w, w === 'kevin' ? 'walk' : w === 'grandpa' ? 'stand' : poses[w]);
  const tok = live.token;
  await walkPath(p, route(p.position, DOOR_IN), walkSpeed(w));
  if (tok === live.token) { p.visible = false; if (w !== 'grandpa') audio.play('bell'); }
}
function removeGuestCup(w) {
  const c = live.cups.get(w);
  if (!c) return;
  c.parent?.remove(c);
  const i = cups.indexOf(c);
  if (i >= 0) cups.splice(i, 1);
  live.cups.delete(w);
}

// 德叔走過去：要去吧台裡面或外面時，從吧台的出口繞
const behindBar = (v) => v.x > 1.7 && v.z < 0.5;
async function deshuGo(target) {
  while (live.deshuWalk) await live.deshuWalk; // 上一段還沒走完（場景裡「不等德叔走回去」的那一步）
  const pts = [];
  const from = deshu.position.clone();
  if (behindBar(from) && !behindBar(target)) pts.push(V2(2.6, 0.6), V2(1.3, 0.8));
  if (!behindBar(from) && behindBar(target)) pts.push(...route(from, V2(1.3, 0.8)), V2(2.6, 0.6));
  pts.push(...route(pts.length ? pts[pts.length - 1] : from, target));
  await walkPath(deshu, pts, WALK);
}
// 站在某人旁邊的位置（吧台前的人，德叔從吧台裡面）
function nearSpot(w) {
  const spot = live.at[w];
  const pos = spot?.pos || PEOPLE[w].position;
  if (spot?.counter) return V2(2.5, pos.z);
  return V2(THREE.MathUtils.clamp(pos.x + (pos.x < 0.45 ? 0.5 : -0.5), -2.7, 2.7), THREE.MathUtils.clamp(pos.z + 0.12, -3.7, 3.6));
}

// 德叔端東西給熟客：從吧台拿杯子，走過去放在他桌上（沒有桌子就交到他手上）
async function serveTo(w, kind) {
  removeGuestCup(w);
  await deshuGo(HOME);
  const cup = makeCup(kind);
  if (cup.userData.liquid && kind !== 'iced') cup.userData.liquid.visible = true;
  setPaper(deshu, deshuCanvas.pour);
  await wait(0.6);
  setPaper(deshu, deshuCanvas.idle);
  deshu.attach(cup);
  cup.position.set(0.32, 0.98, 0.12);
  await deshuGo(nearSpot(w));
  deshu.userData.mesh.position.y = 0;
  scene.attach(cup);
  const spot = live.at[w];
  if (spot?.cup) {
    const from = cup.position.clone();
    await animate(0.7, (k) => { cup.position.lerpVectors(from, spot.cup, ease(k)); cup.position.y += Math.sin(Math.PI * k) * 0.05; });
    placeCup(cup, { id: 'guest:' + w, cup: spot.cup });
    if (kind === 'iced') cup.userData.age = 999; // 冰的不冒煙
  } else {
    PEOPLE[w].attach(cup);
    cup.position.set(0, 0.5, 0.08);
    cup.rotation.set(0, 0, 0);
  }
  live.cups.set(w, cup);
}

// 龍眼走到某人身邊：lap＝跳上他的腿（凱文），不然就睡在旁邊（予安念稿）
async function catTo(w, lap) {
  while (catBusy) await realWait(200);
  catBusy = true;
  catAtHome = false;
  catOnSeat = null;
  catHoldUntil = performance.now() + 120000 / DEV_SPEED;
  const p = PEOPLE[w];
  const toCam = V2(camera.position.x - p.position.x, camera.position.z - p.position.z).setLength(lap ? 0.14 : 0.45);
  const target = p.position.clone().add(toCam);
  setPaper(cat, catCanvas.sit);
  if (cat.userData.mesh.position.y > 0.02) await catHop(0); // 睡在書架上、椅子上的話，先跳下來
  cat.userData.mesh.position.y = 0;
  await walk(cat, target, 0.6);
  if (lap) await animate(0.4, (k) => { cat.userData.mesh.position.y = 0.48 * ease(k) + Math.sin(Math.PI * k) * 0.12; });
  else { cat.userData.mesh.position.y = 0; setPaper(cat, catCanvas.sleep); }
  catBusy = false;
}

// 德叔把音樂調小：走到黑膠唱機或收音機旁（沒有的話就是吧台後面的音響），音符縮小、淡掉
const noteTex = A.tex(A.note());
async function musicDown() {
  audio.duck(0.35, 120); // 真的把音樂調小
  const src = [...decorPapers.values()].find((d) => d.userData.item.id === 'record-player' || d.userData.item.id === 'radio');
  const pos = src ? src.position.clone() : V2(2.85, -1.6);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthWrite: false }));
  sprite.position.set(pos.x, src ? 0.95 : 2.35, pos.z);
  sprite.scale.setScalar(0.32);
  scene.add(sprite);
  await deshuGo(src ? V2(THREE.MathUtils.clamp(pos.x + (pos.x < 0 ? 0.55 : -0.55), -2.6, 2.6), pos.z + 0.2) : HOME);
  setPaper(deshu, deshuCanvas.pour);
  await animate(1.6, (k) => { sprite.scale.setScalar(0.32 - 0.2 * k); sprite.material.opacity = 1 - 0.6 * k; });
  setPaper(deshu, deshuCanvas.idle);
  animate(2, (k) => { sprite.material.opacity = 0.4 * (1 - k); }).then(() => { scene.remove(sprite); sprite.material.dispose(); });
}

// 笑：紙片輕輕跳兩下（不用泡泡描述動作）
async function laugh(w) {
  const m = PEOPLE[w].userData.mesh;
  await animate(0.9, (k) => { m.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * 0.06; });
  m.position.y = 0;
}

// 坐著的時候，鏡頭慢慢轉向說話的人；max：最多轉幾度（客人模式聽人聊天時可以轉過身去看）
// p 為 null：轉回座位原本的視線（看著自己桌上的杯子）
// 坐著的時候把視線轉向某個人（p＝null：回到座位原本的方向）。
// 美術評分修正 a：對話時說話的人要完整入鏡——水平置中、臉放在畫面上方約 1/3（同時算 yaw 與 pitch）；
// 熟客的場景與客人模式裡，畫面略微推近（FOCUS_FOV）、四周加一點暗角；前景擋住臉的人由 updateOcclusion() 淡掉
const FOCUS_FOV = 62, SEAT_FOV = 72;
const FACE_DROP = 0.2; // 臉的中心在頭頂（headOf）往下多少
let focusP = null;
let lookTok = 0;
const isPerson = (p) => p === cat || Object.values(PEOPLE).includes(p);
const conversing = () => !!state.scene || (!!state.guest && state.guest !== 'enter' && state.guest !== 'sit'); // 客人模式：坐下之後的點單、上桌、聊天
function lookToward(p, max = 1.2) {
  if (state.mode !== 'seat' || !state.seat || p === undefined) return;
  const s = state.seat;
  const person = !!p && isPerson(p);
  focusP = person ? p : null;
  if (person && conversing()) state.focus = true;
  $('vignette').classList.toggle('on', !!state.focus && !state.closeup);
  const b = s.look.clone().sub(s.eye), t = p ? p.position.clone().sub(s.eye) : b;
  const yaw = THREE.MathUtils.clamp(wrapAngle(Math.atan2(t.x, t.z) - Math.atan2(b.x, b.z)), -max, max);
  let pitch = 0;
  if (person) {
    const fov = THREE.MathUtils.degToRad(state.focus ? FOCUS_FOV : SEAT_FOV);
    const fy = p.position.y + headOf(p) - FACE_DROP - s.eye.y;
    const want = Math.atan2(fy, Math.hypot(t.x, t.z)) - Math.atan((1 / 3) * Math.tan(fov / 2)); // 臉在畫面上方 1/3
    pitch = THREE.MathUtils.clamp(want - Math.atan2(b.y, Math.hypot(b.x, b.z)), -0.6, 0.5);
  }
  const from = cam.yaw, fromPitch = cam.pitch;
  const my = ++lookTok;
  let k = 0;
  realWaiters.push((dt) => {
    if (my !== lookTok) return true; // 又轉向別人了
    k = Math.min(1, k + dt * 1.2 * DEV_SPEED);
    cam.yaw = from + (yaw - from) * ease(k);
    cam.pitch = fromPitch + (pitch - fromPitch) * ease(k);
    return k >= 1;
  });
}
// 對話結束（場景演完、客人模式聊完）：推近與暗角收起來，視線回到座位原本的方向
function endFocus() {
  if (!state.focus || conversing()) return;
  state.focus = false;
  $('vignette').classList.remove('on');
  if (state.mode === 'seat' && !state.closeup) lookToward(null);
  focusP = null;
}
// 前景的人擋住說話的人的臉：淡成半透明；沒擋住就慢慢恢復
const occ = new THREE.Vector3();
function updateOcclusion(dt) {
  const f = state.mode === 'seat' && !state.closeup && focusP && focusP.visible ? focusP : null;
  let face = null;
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  if (f) {
    occ.copy(f.position); occ.y += headOf(f) - FACE_DROP;
    const d = camera.position.distanceTo(occ);
    occ.project(camera);
    if (occ.z < 1) face = { x: occ.x, y: occ.y, d, ry: 0.2 / (d * tanH), rx: 0.16 / (d * tanH * camera.aspect) };
  }
  for (const q of [...Object.values(PEOPLE), cat]) {
    const m = q.userData.mesh, mat = m.material;
    let target = 1;
    if (face && q !== f && q.visible) {
      const prm = m.geometry.parameters;
      occ.copy(q.position); occ.y += m.position.y + prm.height / 2;
      const d = camera.position.distanceTo(occ);
      if (d < face.d - 0.3) {
        occ.project(camera);
        const hx = (prm.width * 0.35) / (d * tanH * camera.aspect), hy = (prm.height * 0.45) / (d * tanH); // 圖的四周有留白：只算中間的身體
        if (occ.z < 1 && Math.abs(occ.x - face.x) < hx + face.rx && Math.abs(occ.y - face.y) < hy + face.ry) target = 0.35;
      }
    }
    if (Math.abs(mat.opacity - target) < 0.005) continue;
    mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
    if (Math.abs(mat.opacity - target) < 0.005) mat.opacity = target;
    mat.alphaTest = mat.opacity < 0.99 ? 0.08 : 0.35;
  }
}

// 颱風夜：天色一下子暗下來，窗外的雨斜著打，風雨聲
function startTyphoon() {
  state.weather = 'typhoon';
  state.night = true;
  applyLight();
  applySound();
  return realWait(600);
}

// 德叔在吧台試沖阿哲的兩包豆子
async function brewTaste() {
  await deshuGo(HOME);
  const steam = brewer.position.clone().add(new THREE.Vector3(0, 0.19, 0));
  steamSources.add(steam);
  setPaper(deshu, deshuCanvas.pour);
  await wait(2.4);
  setPaper(deshu, deshuCanvas.idle);
  await wait(0.8);
  setPaper(deshu, deshuCanvas.pour);
  await wait(2.0);
  setPaper(deshu, deshuCanvas.idle);
  steamSources.delete(steam);
}

const sayMs = (text) => Math.min(6500, 1900 + [...text].length * 115);
const personOf = (w) => (w === 'boss' ? kevin : w === 'player' ? 'player' : w === 'cat' ? cat : w === 'window' ? windows[0] : w === 'thermo' ? thermo : PEOPLE[w]);

async function playSteps(steps, tok) {
  for (const s of steps) {
    if (tok !== live.token) throw ABORT;
    await playStep(s, tok);
  }
}
async function playStep(s, tok) {
  switch (s.do) {
    case 'say': { const ms = sayMs(s.text); say(s.text, ms / DEV_SPEED, personOf(s.who), s.name || null); return realWait(ms + 450); }
    case 'wait': return realWait(s.sec * 1000);
    case 'look': lookToward(personOf(s.who), 2.3); return realWait(500); // 和對話時轉向說話的人一樣，可以轉到身後
    case 'pose': setPose(s.who, s.pose); return realWait(350);
    case 'enter': {
      if (S.REGULAR_IDS.includes(s.who)) { S.arrive(save, s.who, today()); live.arrived.add(s.who); }
      const spot = spotFor(s.who, s.at);
      live.planned[s.who] = spot; // 一起走進來的人（阿哲站在阿公旁邊）要知道對方要去哪裡
      const go = enterPerson(s.who, spot, s.pose, s.then || s.pose, s.fast);
      if (!s.async) await go;
      return;
    }
    case 'walk': return movePerson(s.who, spotFor(s.who, s.at), s.pose, s.then);
    case 'arrived': {
      const t0 = performance.now();
      while (live.at[s.who] !== live.planned[s.who] && performance.now() - t0 < 30000) await realWait(100);
      return undefined;
    }
    case 'leave': return leavePerson(s.who);
    case 'deshuTo': return deshuGo(nearSpot(s.who));
    case 'deshuHome': {
      if (!s.async) return deshuGo(HOME);
      const go = deshuGo(HOME).finally(() => { if (live.deshuWalk === go) live.deshuWalk = null; });
      live.deshuWalk = go;
      return undefined;
    }
    case 'serve': return serveTo(s.who, s.kind);
    case 'cat': return catTo(s.who, s.lap);
    case 'music': return musicDown();
    case 'laugh': return Promise.all(s.who.map(laugh));
    case 'glance': return glance(personOf(s.who));
    case 'weather': return startTyphoon();
    case 'prop': counterBag.visible = true; return realWait(500);
    case 'choice': { const i = await choose(s.options, s.prompt || ''); live.answers[s.key] = i; save.story.answers[s.key] = i; persist(); return; }
    case 'branch': return playSteps(s.cases[live.answers[s.key] ?? save.story.answers[s.key] ?? 0] || [], tok); // 隔天才用到的選項（凱文念啟事）從存檔讀
    case 'notice': return postNotice();
    case 'keys': return handKeys(s.who);
    case 'name': { // 最後一晚：德叔第一次叫老闆的名字
      const t = F.nameLine(save.player.name), ms = sayMs(t) + 800;
      lookToward(null); // 視線回到桌上的琺瑯杯
      say(t, ms / DEV_SPEED, deshu);
      return realWait(ms + 450);
    }
    case 'ifFire': return save.player.resignation === 'fire' ? playSteps(s.steps, tok) : undefined;
    case 'read': return new Promise((r) => openLetter(S.DOCS[s.doc], r));
    case 'brewTaste': return brewTaste();
    case 'menu': drawBackBar([...save.menu, 'zhe-beans']); return realWait(800);
    default: return undefined;
  }
}

// 演一個里程碑；演完才記進存檔（中途重新整理就從頭再演一次）
async function runScene(m) {
  const tok = ++live.token;
  state.scene = m;
  bubble.classList.remove('show');
  updateUI();
  try {
    await playSteps(m.scene, tok);
    if (!behindBar(deshu.position) || deshu.position.distanceTo(HOME) > 0.05) await deshuGo(HOME);
  } catch (e) {
    if (e !== ABORT) console.warn('熟客場景中斷', e);
    if (tok !== live.token) return; // 跳天數等等讓場景作廢：不記進存檔
  }
  const d = today();
  S.complete(save, m, d);
  if (m.menu) { drawBackBar(); counterBag.visible = save.menu.includes('longan'); }
  if (m.gift) glowFund(); // 熟客送的東西收進倉庫：佈置鈕輕輕亮一下
  if (m.id === 'zhe4') for (const w of ['zhe', 'grandpa']) live.leaveAt.set(w, performance.now() + 60000 / DEV_SPEED);
  if (m.id === 'zhe3') live.leaveAt.delete('zhe'); // 颱風夜，阿哲待在店裡
  persist();
  state.scene = null;
  updateUI();
  refreshDevTools();
  checkTasks({ delay: 600 });
  readyAt = performance.now() + 6000 / DEV_SPEED;
}

// 新的一天（進店、跳天數、過了午夜）：決定今天誰會來
function stopStory() {
  live.token++;
  state.scene = null;
  if (state.choice) { state.choice = false; $('choices').innerHTML = ''; }
  for (const w of PEOPLE_IDS) {
    PEOPLE[w].visible = false;
    removeGuestCup(w);
  }
  for (const s of [stoolFar, stoolMid]) s.visible = true;
  live.expect.clear(); live.arrived.clear(); live.leaveAt.clear();
  live.at = {}; live.planned = {}; live.answers = {}; live.seatHinted = false; live.closeHinted = false; live.deshuWalk = null; live.fwHinted = 0; live.held = new Set();
  live.day = 0;
  catHoldUntil = 0;
}
function startDay() {
  if (!REGULARS_ON || !save.flags.seenOpening) return;
  const d = today();
  if (live.day === d) return;
  stopStory();
  live.day = d;
  S.settleThrough(save, d - 1);
  refreshNotice();
  if (F.departureDue(save, d)) { departureMorning(); updateUI(); return; } // 離開東山的早上
  if (H.closedOn(save, d)) {
    // 今天已經打烊了（打烊後重新整理）；最後一晚的話，凱文還在，龍眼睡在他腿上
    if (REGULARS_ON && (F.fw(save).on[7] === d || F.segmentDue(save, d)?.lastNight)) { placeAt('kevin', SPOT.kevin, 'free'); live.arrived.add('kevin'); }
    updateUI();
    return;
  }
  const t = performance.now();
  for (const p of S.planToday(save, d)) {
    if (p.who === 'kevin' && keeper()) continue; // 離開東山之後，凱文在吧台後面顧店
    if (p.already) {
      // 同一天重新整理：予安、凱文還在位子上；阿哲平常早就走了（颱風夜還在，或還有話要說時才在）
      if (p.who !== 'zhe' || save.story.typhoonDay === d || S.liveNext(save, 'zhe', d)) {
        placeAt(p.who, HOME_SPOT[p.who]);
        live.arrived.add(p.who);
      }
      continue;
    }
    live.expect.set(p.who, t + arrivalDelay(p.who, d));
  }
  planFarewellDay(d, t);
  updateUI();
}
// 什麼時候走進來（毫秒）：予安一開門就在；阿哲隔一會兒；凱文下午五點（開發者模式不等五點）
function arrivalDelay(w, d) {
  if (w === 'yuan') return 0;
  if (w === 'zhe') return (20000 + Math.floor(((d * 7919) % 25) * 1000)) / DEV_SPEED;
  if (DEV) return 8000 / DEV_SPEED;
  if (F.inFarewell(save) && F.done(save, 3)) return 10000; // 錄取之後，凱文早一點來（德叔：「明天早一點來。」）
  const ms = S.kevinWaitMs(new Date(now()));
  return ms ? ms : 3000;
}
async function arriveNormally(w) {
  const d = today();
  S.arrive(save, w, d);
  persist();
  if (w === 'yuan') { placeAt('yuan', SPOT.yuan); live.arrived.add('yuan'); return; }
  const m = S.nextMilestone(save, w);
  const seatPose = m?.arrivePose && S.isDue(save, m, d) ? m.arrivePose : defaultPose(w);
  live.walking = (live.walking || 0) + 1;
  await enterPerson(w, HOME_SPOT[w], w === 'kevin' ? 'walk' : 'stand', seatPose);
  live.walking--;
  if (live.day !== d) return;
  live.arrived.add(w);
  if (w === 'zhe') live.leaveAt.set('zhe', performance.now() + 100000 / DEV_SPEED);
}
const sceneReady = () => quiet() && !dueLetter(save, letterCtx());

function storyTick() {
  if (!REGULARS_ON || !live.day || live.day !== today()) return;
  const d = live.day, t = performance.now();
  for (const [w, at] of live.expect) {
    if (state.guest || state.closing) break; // 客人模式、打烊時沒有人走進來
    if (t < at) continue;
    const m = S.nextMilestone(save, w);
    // 自己走進來就是演出的里程碑（颱風夜、阿哲帶阿公來）：等店裡安靜下來
    if (m?.entrance && S.isDue(save, m, d) && (!m.present || save.story.lastPresentDay !== d)) {
      if (sceneReady() && !state.scene) { live.expect.delete(w); runScene(m); return; }
      continue;
    }
    live.expect.delete(w);
    arriveNormally(w);
  }
  for (const [w, at] of live.leaveAt) {
    if (state.guest) break; // 客人模式中，聊天的人不會走
    if (t > at && !state.scene && (!S.REGULAR_IDS.includes(w) || !S.liveNext(save, w, d)) && !farewellNeeds(w, d)) { live.leaveAt.delete(w); leavePerson(w); }
  }
  if (state.scene || !sceneReady()) return;
  const cands = [...live.arrived].map((w) => S.liveNext(save, w, d)).filter(Boolean)
    .sort((a, b) => (a.present - b.present) || S.MILESTONES.indexOf(a) - S.MILESTONES.indexOf(b));
  for (const m of cands) {
    // 予安念稿：要老闆按了「打烊」、喝完最後一杯；還沒打烊時德叔提一次
    if (!!m.needClosing !== (state.closing === 'after')) {
      if (m.needClosing && !state.closing && !live.closeHinted) { live.closeHinted = true; say(m.needClosingHint, 4800); }
      continue;
    }
    if (m.needSeat && state.mode !== 'seat') {
      if (!live.seatHinted) { live.seatHinted = true; say(m.needSeatHint, 4800); }
      continue;
    }
    runScene(m);
    return;
  }
  farewellTick(d);
}
setInterval(storyTick, 500);

// 測試用：熟客這邊還有沒有事情要發生（正在演、還沒走進來、或有里程碑等著演）
// withGuest：德叔準備邀請老闆當一次客人，也算還有事（測試快轉天數時不會跳過）
function storyBusy(withGuest = true) {
  if (!REGULARS_ON || !live.day) return false;
  if (withGuest && !state.closing && !save.flags.guestVisit && H.guestDue(save, temperature(save), today())) return true;
  if (state.scene || state.letter || state.cinematic || live.walking > 0 || state.guest) return true;
  if (state.closing && state.closing !== 'after') return true;
  if ([...live.expect.values()].some((at) => at - performance.now() < 60000)) return true;
  const d = live.day;
  return [...live.arrived].some((w) => { const m = S.liveNext(save, w, d); return m && (!m.needSeat || state.mode === 'seat') && !!m.needClosing === (state.closing === 'after'); })
    || !!dueLetter(save, letterCtx()) || farewellReady(d) || !!state.arriving;
}

/* ---------- 第一站的結尾：徵店長與告別（src/farewell.js） ---------- */
// 溫度達 37°C 後，七段依序在老闆在場時發生，可以分幾天看完：
// 打烊後「店會自己呼吸了」→ 貼徵才啟事 →（隔天）凱文來面試 → 予安的告別 →（隔天）阿哲的告別 → 凱文的交接 →
// 打烊後的最後一晚（琺瑯杯、德叔第一次叫老闆的名字）→（隔天以後）離開東山的早上：第二封信 → 你的咖啡地圖 → 常態店（凱文顧店）
// 告別期間要演的那一段需要誰，那個人當天一定會來；凱文來面試那天，他是第一個走進門的人
function planFarewellDay(d, t) {
  if (!REGULARS_ON || !F.inFarewell(save)) return;
  const temp = temperature(save);
  for (const w of F.needsToday(save, d, temp)) {
    if (!live.expect.has(w) && !live.arrived.has(w)) live.expect.set(w, t + arrivalDelay(w, d));
  }
  const seg = F.segmentDue(save, d, temp);
  if (seg?.entrance) {
    // 凱文來面試：他自己走進來就是演出，予安、阿哲等他面試完再來
    live.expect.delete('kevin');
    for (const w of ['yuan', 'zhe']) if (live.expect.has(w)) { live.expect.set(w, Infinity); live.held.add(w); }
  }
}
// 這位熟客今天還有告別的戲（阿哲等到說完再走）
function farewellNeeds(w, d) {
  return REGULARS_ON && F.inFarewell(save) && F.needsToday(save, d, temperature(save)).has(w);
}
// 現在可以演的告別段落（不看店裡安不安靜）
function farewellSegment(d) {
  if (!REGULARS_ON || state.guest) return null;
  const seg = F.segmentDue(save, d, temperature(save));
  if (!seg) return null;
  const closingAfter = state.closing === 'after' && !!save.closing.lastCup;
  if (!!seg.needClosing !== closingAfter) return null;
  if (seg.who && !seg.entrance && !live.arrived.has(seg.who)) return null;
  return seg;
}
// 測試用：告別這邊還有事情要發生
const farewellReady = (d) => !!farewellSegment(d) || F.departureDue(save, d);
function farewellTick(d) {
  const seg = F.segmentDue(save, d, temperature(save));
  if (!seg || !REGULARS_ON || state.guest) return false;
  // 要打烊才演的段落：還沒打烊時德叔提一次（每天一次）
  if (seg.needClosing && !state.closing && live.fwHinted !== seg.n) { live.fwHinted = seg.n; say(seg.hint, 4800); return false; }
  if (seg.lastNight && state.closing === 'after' && !PEOPLE.kevin.visible) { placeAt('kevin', SPOT.kevin, 'free'); live.arrived.add('kevin'); } // 最後一晚，凱文留下來
  if (seg.entrance && PEOPLE.kevin.visible) { PEOPLE.kevin.visible = false; live.arrived.delete('kevin'); } // 面試那天中途重新整理：從門口重新走進來
  if (!farewellSegment(d)) return false;
  runFarewell(seg);
  return true;
}
// 演一段告別；演完才記進存檔（中途重新整理就從這一段重新演）
async function runFarewell(seg) {
  const tok = ++live.token;
  state.scene = { id: 'farewell' + seg.n, farewell: seg.n };
  bubble.classList.remove('show');
  updateUI();
  try {
    await playSteps(seg.scene, tok);
    if (!behindBar(deshu.position) || deshu.position.distanceTo(HOME) > 0.05) await deshuGo(HOME);
  } catch (e) {
    if (e !== ABORT) console.warn('告別的場景中斷', e);
    if (tok !== live.token) return;
  }
  const d = today();
  F.complete(save, seg.n, d);
  if (seg.gift) glowFund(); // 送的東西收進倉庫：佈置鈕輕輕亮一下
  refreshNotice();
  if (seg.n === 3) { // 面試完了：予安、阿哲照常走進來
    const t = performance.now();
    let k = 0;
    for (const w of live.held) live.expect.set(w, t + (6000 + 6000 * k++) / DEV_SPEED);
    live.held.clear();
  }
  if (seg.n === 5) live.leaveAt.set('zhe', performance.now() + 90000 / DEV_SPEED);
  persist();
  state.scene = null;
  updateUI();
  refreshDevTools();
  // 下一段如果是緊接著的（貼啟事）就短一點；其他段落之間留一段安靜的時間
  readyAt = performance.now() + (F.segment(seg.n + 1)?.chain ? 2500 : 12000) / DEV_SPEED;
}
// 第 2 段：貼出徵才啟事（老闆選的那句），德叔拿到門口貼好
async function postNotice() {
  const n = F.postNotice(save, live.answers.notice ?? save.story.answers.notice ?? 0);
  persist();
  await new Promise((r) => openLetter({ title: '徵才啟事', paragraphs: [n.text], hand: true }, r));
  await deshuGo(V2(0.6, 3.15));
  setPaper(deshu, deshuCanvas.pour);
  setArt(noticeSign, A.noticeBoard(n.text));
  noticeDrawn = n.text;
  noticeSign.visible = true;
  await wait(0.9);
  setPaper(deshu, deshuCanvas.idle);
  lookToward(noticeSign);
}
// 第 6 段：德叔把吧台的鑰匙交給凱文
async function handKeys(w) {
  const k = paper(A.key(), deshu.position.x, deshu.position.z, { y: 1.05, shadow: false });
  k.userData.mesh.scale.setScalar(1.6);
  const from = deshu.position.clone(), to = PEOPLE[w].position.clone();
  setPaper(deshu, deshuCanvas.pour);
  await animate(1.1, (t) => {
    k.position.lerpVectors(from, to, ease(t));
    k.userData.mesh.position.y = 1.05 - 0.3 * ease(t) + Math.sin(Math.PI * t) * 0.08;
  });
  setPaper(deshu, deshuCanvas.idle);
  realWait(5000).then(() => removePaper(k));
}

// 離開東山的早上：凱文繫著圍裙站在吧台前，德叔說一句，接著交第二封信（letters.js，由交信的計時器處理）
function departureMorning() {
  if (state.night && state.weather !== 'typhoon') { state.night = false; applyLight(); }
  if (REGULARS_ON) { placeAt('kevin', SPOT.bar, 'apron'); live.arrived.add('kevin'); }
  say(F.DEPART.greet, 3600);
  readyAt = performance.now() + 4500 / DEV_SPEED;
}
// 讀完第二封信：凱文送行、德叔說「走吧。」，畫面暗下來，打開你的咖啡地圖；這時店轉為常態經營
async function departScene() {
  F.depart(save, now());
  persist();
  const tok = ++live.token;
  state.scene = { id: 'depart' };
  updateUI();
  try {
    await realWait(1200);
    await playSteps(F.DEPART.after.filter((s) => REGULARS_ON || s.who !== 'kevin'), tok);
  } catch (e) { if (e !== ABORT) console.warn('出發的場景中斷', e); }
  await fade(true);
  if (state.seat) stand();
  becomeKeeper();
  state.scene = null;
  showMap('end');
  fadeEl.classList.remove('on');
  updateUI();
}
// 常態店：吧台後面換成凱文（沖煮、端杯、打烊後擦杯子的演出都照用德叔的那一套）
function becomeKeeper() {
  for (const k of ['idle', 'pour', 'wipe', 'wipe2']) deshuCanvas[k] = A.kevinBar(k);
  for (const k of ['a', 'b']) { wipeTex[k]?.dispose(); wipeTex[k] = null; }
  setArt(deshu, deshuCanvas.idle);
  deshu.position.copy(HOME);
  NAMES.set(deshu, F.KEEPER.name);
  kevin.visible = false;
  live.arrived.delete('kevin');
  live.expect.delete('kevin');
}
// 回東山坐坐：從門口推門進來，凱文打招呼（第一次是「老闆，歡迎回來。……德叔說，要這樣講。」）
async function keeperArrive() {
  state.arriving = true;
  updateUI();
  if (state.seat) { state.seat.prop.visible = true; state.seat = null; }
  state.mode = 'door';
  frontWall.visible = false;
  ceiling.visible = true;
  cam.yaw = 0; cam.pitch = 0;
  tween = null;
  cam.pos.copy(DOOR.from); cam.look.copy(DOOR.look);
  moveCamera(DOOR.to, DOOR.look, 2.6);
  audio.play('door'); audio.play('bell');
  await realWait(1700);
  const f = F.fw(save);
  const lines = f.keeperGreeted ? [F.KEEPER.greet[Math.floor(Math.random() * F.KEEPER.greet.length)]] : F.KEEPER.firstGreet;
  f.keeperGreeted = true;
  persist();
  for (const l of lines) { const ms = sayMs(l); say(l, ms / DEV_SPEED); await realWait(ms + 300); }
  state.mode = 'overview';
  ceiling.visible = false;
  moveCamera(OVER.pos, OVER.look, 1.6);
  state.arriving = false;
  readyAt = performance.now() + 4000 / DEV_SPEED;
  updateUI();
  checkTasks({ delay: 1200 });
  startDay();
}
// 你的咖啡地圖：mode 'end'（第一站結尾，按鈕「回東山坐坐」）或 'notebook'（從記事本打開，按鈕「闔上」）
const mapEl = $('map');
let mapMode = null;
function showMap(mode) {
  mapMode = mode;
  if (!$('map-img').getAttribute('src')) $('map-img').src = A.coffeeMap().toDataURL();
  $('map-title').textContent = F.MAP.title;
  $('map-sub').textContent = F.MAP.sub;
  $('map-line').textContent = F.MAP.line;
  const list = $('map-list');
  list.innerHTML = '';
  for (const st of F.MAP.stations) {
    const li = document.createElement('li');
    li.className = st.lit ? 'lit' : '';
    li.innerHTML = `<b>${st.name}</b><span>${st.note}</span>`;
    list.appendChild(li);
  }
  $('map-back').textContent = mode === 'end' ? F.MAP.back : F.MAP.close;
  mapEl.hidden = false;
  $('map-back').focus();
}
function closeMap() {
  mapEl.hidden = true;
  const mode = mapMode;
  mapMode = null;
  if (mode !== 'end') { updateUI(); return; }
  F.fw(save).mapSeen = true;
  persist();
  keeperArrive();
}
$('map-back').onclick = closeMap;

// 開發者工具：直接到告別前（36.5°C）。三條線全部走完、溫度任務只留一個 +0.5°C 的（通常是「擺上第一件擺飾」）
function devToFarewell() {
  stopStory();
  stopGuest();
  exitClosing();
  const d = today();
  const typhoon = save.story.typhoonDay;
  for (const m of S.MILESTONES) if (!S.hasMilestone(save, m.who, m.n)) S.complete(save, m, d);
  if (!typhoon || typhoon === d) save.story.typhoonDay = Math.max(1, d - 4); // 颱風夜不要變成今天
  for (const w of S.REGULAR_IDS) { const r = save.regulars[w]; r.visits = Math.max(r.visits, 10); r.lastMilestoneDay = d - 1; r.settled = Math.max(r.settled, d - 1); }
  save.flags.guestVisit = true;
  const left = ['first-decor', 'cat-chair', 'rain-window', 'first-coffee', 'open-3-days', 'zhe-longan'].find((id) => !isDone(save, id) && !taskById(id).when(save, { daysOpen: d }));
  for (const t of TASKS) {
    if (isDone(save, t.id) || t.id === left) continue;
    save.tasks.push({ id: t.id, t: now(), day: d });
    save.fund.ledger.push({ t: now(), kind: 'grant', ref: t.id, amount: t.fund });
  }
  persist();
  riseTemp(temperature(save));
  drawBackBar();
  counterBag.visible = save.menu.includes('longan');
  refreshWeather();
  refreshDevTools();
  openAbout(false);
  readyAt = performance.now() + 3000 / DEV_SPEED;
  startDay();
}
$('dev-fw').onclick = devToFarewell;

/* ---------- 聲音與音樂（src/audio.js：WebAudio 即時合成，不用音檔；預設音量小，選單裡可以分別關掉） ---------- */
// 音樂只在店裡（開場的辦公室沒有音樂，推門進店才開始）；打烊後換成更慢、更暗的版本；「明天見」之後安靜下來
const audioScene = () => ({
  music: !!save.settings.music,
  sfx: !!save.settings.sound,
  volume: save.settings.volume,
  weather: state.weather,
  night: state.night,
  closingStyle: !!state.closing || state.night,
  vinyl: [...decorPapers.values()].some((d) => d.userData.item.id === 'record-player'),
  inShop: (!openingCtl || openingCtl.stage === 'shop') && (save.flags.seenOpening || !!openingCtl) && $('closed').hidden,
  office: openingCtl?.stage === 'office',
});
let audioKey = '';
function applySound() {
  const sc = audioScene();
  const k = JSON.stringify(sc);
  if (k === audioKey) return;
  audioKey = k;
  audio.set(sc);
}
// 瀏覽器要等玩家點過畫面才能出聲
const unlockAudio = () => { applySound(); audio.unlock(); };
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') audio.pause(); else audio.resume(); });
function refreshWeather() {
  const w = weatherToday();
  if (w === state.weather) return;
  if (state.weather === 'typhoon') state.night = false;
  state.weather = w;
  if (w === 'typhoon') state.night = true;
  applyLight();
  applySound();
}
const onOff = (v) => (v ? '開' : '關');
function soundLabels() {
  $('music-toggle').textContent = `音樂：${onOff(save.settings.music)}`;
  $('sound-toggle').textContent = `店裡的聲音：${onOff(save.settings.sound)}`;
  $('volume-btn').textContent = `音量：${VOLUME_NAMES[save.settings.volume] || VOLUME_NAMES[0]}`;
}
soundLabels();
$('music-toggle').onclick = () => { save.settings.music = !save.settings.music; persist(); soundLabels(); applySound(); };
$('sound-toggle').onclick = () => { save.settings.sound = !save.settings.sound; persist(); soundLabels(); applySound(); };
$('volume-btn').onclick = () => {
  save.settings.volume = ((Number(save.settings.volume) || 0) + 1) % VOLUMES.length;
  persist();
  soundLabels();
  applySound();
  audio.play('cup'); // 聽一下現在多大聲
};

/* ---------- 打烊後模式（src/afterhours.js） ---------- */
// 老闆按「打烊」：客人離開、德叔去門口翻牌子、天色轉成夜裡 → 坐下，德叔沖「最後一杯，是老闆的」→
// 打烊後：燈一盞一盞由老闆自己關、可以整理擺飾、摸龍眼、寫「今天的一杯」；德叔在吧台擦那個琺瑯杯。沒有任何任務提示。
// state.closing：'leaving'（客人離開）→ 'lastcup'（等老闆坐下、沖最後一杯）→ 'after'（打烊後）
let closeTok = 0;
const lightOn = (id) => !id || !state.closing || !save.closing.lightsOff.includes(id);
const canClose = () => save.flags.seenOpening && !state.closing && !state.tutorial && !state.scene && !state.letter && !state.cinematic
  && !state.choice && !state.guest && !brewing && !deshuReturning && !state.placing && !state.arriving && !F.departureDue(save, today());

async function startClosingMode() {
  if (!canClose()) return;
  const tok = ++closeTok;
  const d = today();
  H.startClosing(save, d);
  persist();
  state.closing = 'leaving';
  live.expect.clear(); // 打烊之後不會再有熟客走進來
  bubble.classList.remove('show');
  updateUI();
  say(H.CLOSING.start, 3400);
  // 予安有稿子想念的那天，她留下來；颱風夜，阿哲待在店裡
  const stay = new Set();
  if (REGULARS_ON && S.liveNext(save, 'yuan', d)?.needClosing && live.arrived.has('yuan')) stay.add('yuan');
  if (save.story.typhoonDay === d) stay.add('zhe');
  if (REGULARS_ON && F.segmentDue(save, d)?.lastNight) stay.add('kevin'); // 告別的最後一晚：凱文留下來
  const going = PEOPLE_IDS.filter((w) => PEOPLE[w].visible && !stay.has(w));
  await Promise.all([...going.map((w) => leavePerson(w)), (async () => { await realWait(1200); await deshuGo(V2(0.45, 3.2)); await glance(deshu, 0.6); })()]);
  if (tok !== closeTok) return;
  state.night = true;
  applyLight();
  buildLightLabels();
  await deshuGo(HOME);
  if (tok !== closeTok) return;
  enterLastCup();
}
function enterLastCup() {
  state.closing = 'lastcup';
  updateUI();
  if (state.mode === 'seat' && state.seat) lastCup(state.seat);
  else say(H.CLOSING.sitDown, 4200);
}
// 最後一杯：菜單上有兩支豆子時先選；沖好端上桌時德叔說「最後一杯，是老闆的。」
async function lastCup(seat) {
  if (state.closing !== 'lastcup' || brewing || state.choice) return;
  const coffees = save.menu.filter((id) => S.MENU[id]?.kind === 'coffee');
  let bean = 'dongshan';
  if (coffees.length > 1) bean = coffees[await choose(coffees.map((id) => S.MENU[id].name), H.CLOSING.chooseBean)];
  if (state.closing !== 'lastcup' || brewing || state.seat !== seat) return;
  // 告別的最後一晚：德叔用那個琺瑯杯沖（劇本：第一次放在玩家面前）
  brew(seat, bean, { last: true, enamel: REGULARS_ON && !!F.segmentDue(save, today())?.lastNight });
}
function afterLastCup(bean) {
  save.closing.lastCup = true;
  save.closing.bean = bean;
  persist();
  state.closing = 'after';
  buildLightLabels();
  updateUI();
  readyAt = performance.now() + 5000 / DEV_SPEED;
}
// 打烊之後重新整理（同一天）：店還是打烊的樣子
function resumeClosing() {
  state.closing = save.closing.lastCup ? 'after' : 'lastcup';
  state.night = true;
  applyLight();
  buildLightLabels();
}
// 換了一天（開發者跳天數）：店重新開門
function exitClosing() {
  if (!state.closing) return;
  closeTok++;
  state.closing = null;
  state.night = state.weather === 'typhoon' || afterWork();
  $('closed').hidden = true;
  $('diary').hidden = true;
  applyLight();
  buildLightLabels();
  updateUI();
}
// 「明天見」：德叔說一句，畫面暗下來（關掉也沒關係；「再待一下」回到打烊後的店裡）
async function goodnight() {
  const tok = closeTok;
  save.closing.done = true;
  persist();
  state.closing = 'bye';
  updateUI();
  say(H.CLOSING.goodnight, 2600);
  await realWait(2400);
  if (tok !== closeTok) return;
  const entry = H.diaryOn(save, today());
  $('cl-title').textContent = H.CLOSING.endTitle;
  $('cl-sub').textContent = H.CLOSING.endSub;
  $('cl-date').textContent = `${dateLabel(now())}・開店第 ${today()} 天`;
  $('cl-diary').textContent = entry ? `今天的一杯：「${entry.text}」` : '';
  $('cl-diary').hidden = !entry;
  $('closed').hidden = false;
  $('cl-stay').focus();
}
$('close-shop').onclick = startClosingMode;
$('goodnight').onclick = goodnight;
$('cl-stay').onclick = () => { $('closed').hidden = true; state.closing = 'after'; updateUI(); };

// 燈：吊燈兩盞（p0、p1）與店裡的落地燈（l<uid>）。打烊後每盞燈旁邊有一顆「關燈／開燈」
let lightLabels = [];
function lightList() {
  const out = pendants.map((p, i) => ({ id: 'p' + i, pos: p.pos.clone().setY(2.75) }));
  for (const p of decorPapers.values()) if (p.userData.lightId) out.push({ id: p.userData.lightId, pos: p.position.clone().setY(1.55) });
  return out;
}
function buildLightLabels() {
  lightsEl.innerHTML = '';
  lightLabels = [];
  if (!state.closing) return;
  for (const l of lightList()) {
    const b = document.createElement('button');
    b.className = 'light-label';
    b.dataset.light = l.id;
    b.onclick = () => {
      H.toggleLight(save, l.id);
      audio.play('click');
      persist();
      applyLamps();
      refreshLightLabels();
    };
    lightsEl.appendChild(b);
    lightLabels.push({ ...l, el: b });
  }
  refreshLightLabels();
}
function refreshLightLabels() {
  for (const l of lightLabels) {
    const on = lightOn(l.id);
    l.el.textContent = on ? '關燈' : '開燈';
    l.el.classList.toggle('off', !on);
    l.el.setAttribute('aria-label', `${l.id.startsWith('p') ? '吊燈' : '落地燈'}：${on ? '關燈' : '開燈'}`);
  }
}
// 每一幀：吊燈的亮度慢慢跟上開關；打烊後，關掉的燈越多，店裡越接近窗外的月光
const SHADE_ON = new THREE.Color('#ffd59a'), SHADE_OFF = new THREE.Color('#4a3d30');
const MOON = new THREE.Color('#7483ad'), WARM_NIGHT = new THREE.Color('#a594b0');
let closeGlow = 1;
function updateLights(dt) {
  const k = Math.min(1, dt * 5);
  pendants.forEach((p, i) => {
    p.level += ((lightOn('p' + i) ? 1 : 0) - p.level) * k;
    let I = (state.night ? 9 : 3) * p.level;
    if (state.weather === 'typhoon' && state.night && Math.random() < 0.004) I = 2 * p.level; // 颱風夜吊燈偶爾閃一下
    p.light.intensity = I;
    p.shade.material.color.copy(SHADE_OFF).lerp(SHADE_ON, p.level);
  });
  const avg = pendants.reduce((a, p) => a + p.level, 0) / pendants.length;
  barFill.intensity = state.night ? 2.2 * avg : 0;
  if (!state.closing) { closeGlow = 1; return; }
  const all = lightList();
  const on = all.length ? all.filter((l) => lightOn(l.id)).length / all.length : 1;
  closeGlow += (on - closeGlow) * Math.min(1, dt * 3);
  if (flash <= 0) {
    hemi.intensity = 0.75 + 0.15 * closeGlow; // 全關也看得到店裡：月光從窗戶進來
    hemi.color.copy(MOON).lerp(WARM_NIGHT, closeGlow);
  }
}

// 打烊後，德叔在吧台擦那個琺瑯杯（劇本：打烊後會擦一個舊的琺瑯杯，從不讓別人用）
const wipeTex = { a: null, b: null, keep: null };
let wipeOn = false, wipeT = 0;
function updateWipe(dt) {
  const mat = deshu.userData.mesh.material;
  const want = state.closing === 'after' && !state.scene && !state.cinematic && !state.letter && !brewing && !deshuReturning
    && !cups.some((c) => c.userData.enamel) // 最後一晚，琺瑯杯在老闆桌上
    && !live.deshuWalk && deshu.position.distanceTo(HOME) < 0.05;
  if (want) {
    if (!wipeOn) {
      wipeOn = true;
      wipeTex.a ??= A.tex(deshuCanvas.wipe);
      wipeTex.b ??= A.tex(deshuCanvas.wipe2);
      wipeTex.keep = mat.map;
      wipeT = 0;
    }
    wipeT += dt;
    const map = Math.floor(wipeT / 0.7) % 2 ? wipeTex.b : wipeTex.a;
    if (mat.map !== map) { mat.map = map; if (mat.emissiveMap) mat.emissiveMap = map; mat.needsUpdate = true; }
  } else if (wipeOn) {
    wipeOn = false;
    if (mat.map === wipeTex.a || mat.map === wipeTex.b) { mat.map = wipeTex.keep; if (mat.emissiveMap) mat.emissiveMap = mat.map; mat.needsUpdate = true; }
    else wipeTex.keep?.dispose(); // 別的動作已經換過圖了
    wipeTex.keep = null;
  }
}

/* ---------- 「今天的一杯」咖啡日記 ---------- */
const diaryEl = $('diary');
function openDiary(mode) {
  const write = mode === 'write';
  $('dy-write').hidden = !write;
  $('dy-read').hidden = write;
  $('dy-close').hidden = write;
  $('dy-title').textContent = write ? H.DIARY.title : '今天的一杯・咖啡日記';
  if (write) {
    const bean = S.MENU[save.closing.bean || 'dongshan']?.name || '東山的豆';
    $('dy-sub').textContent = `${dateLabel(now())}・開店第 ${today()} 天・${bean}`;
    const t = $('dy-text');
    t.value = H.diaryOn(save, today())?.text || '';
    t.placeholder = H.DIARY.placeholder;
    t.maxLength = H.DIARY_MAX;
    diaryCount();
  } else {
    $('dy-sub').textContent = `一共 ${save.diary.length} 杯。`;
    const body = $('dy-read');
    body.innerHTML = '';
    for (const e of [...save.diary].reverse()) {
      const h = document.createElement('h3');
      h.className = 'jr-day';
      h.textContent = `${dateLabel(e.t)}・第 ${e.day} 天・${S.MENU[e.bean]?.name || '東山的豆'}`;
      const p = document.createElement('p');
      p.className = 'dy-entry';
      p.textContent = e.text;
      body.append(h, p);
    }
    body.scrollTop = 0;
  }
  diaryEl.hidden = false;
  if (write) setTimeout(() => $('dy-text').focus(), 50); else $('dy-close').focus();
}
// 手機鍵盤：iOS 與新版 Android Chrome 打開鍵盤時只縮小 visualViewport，版面不動，置中的日記卡片會被鍵盤蓋住。
// 量出鍵盤擋住的高度，讓卡片往上移（Android 另有 viewport 的 interactive-widget=resizes-content）
if (window.visualViewport) {
  const vv = window.visualViewport;
  const onVV = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    app.style.setProperty('--kb', `${Math.round(kb)}px`);
    app.classList.toggle('kb', kb > 80);
  };
  vv.addEventListener('resize', onVV);
  vv.addEventListener('scroll', onVV);
}
function diaryCount() { $('dy-count').textContent = `${[...$('dy-text').value].length}／${H.DIARY_MAX}`; }
function closeDiary() { diaryEl.hidden = true; $('dy-text').blur(); updateUI(); }
$('dy-text').addEventListener('input', diaryCount);
$('dy-save').onclick = () => {
  H.writeDiary(save, { day: today(), t: now(), bean: save.closing.bean, text: $('dy-text').value });
  persist();
  closeDiary();
};
$('dy-cancel').onclick = closeDiary;
$('dy-close').onclick = closeDiary;
$('diary-btn').onclick = () => openDiary('write');
diaryEl.addEventListener('click', (e) => { if (e.target === diaryEl) closeDiary(); });

/* ---------- 一次客人模式（溫度任務 #17） ---------- */
// 溫度 ≥ 28°C 後的某次進店，等店裡安靜下來，德叔問老闆要不要從門口進來一次（決定 D9）。
// 推門進店 → 「歡迎。不急，先坐。」→ 坐下 → 德叔過來點單 → 沖好端上 → 聽兩位熟客聊這間店（依擺飾）→ 德叔小聲說兩句
// state.guest：'offer' → 'enter' → 'sit' → 'order' → 'brew' → 'talk'
const DEV_GUEST = DEV && params.get('guest') === '1'; // 測試用：不看溫度，直接邀請
let guestTok = 0;
let guestPair = null;
function guestReady() {
  if (state.closing || state.guest || !quiet() || dueLetter(save, letterCtx())) return false;
  if (REGULARS_ON && storyBusy(false)) return false;
  if (performance.now() < readyAt + 3000 / DEV_SPEED) return false;
  return DEV_GUEST ? !save.flags.guestVisit && save.flags.guestOffered !== today() : H.guestDue(save, temperature(save), today());
}
setInterval(() => { if (guestReady()) offerGuest(); }, 1000);

async function offerGuest() {
  const tok = ++guestTok;
  save.flags.guestOffered = today();
  persist();
  state.guest = 'offer';
  updateUI();
  say(H.GUEST.invite, 0);
  const i = await choose([H.GUEST.yes, H.GUEST.no]);
  if (tok !== guestTok) return;
  if (i === 1) {
    state.guest = null;
    updateUI();
    say(H.GUEST.later, 3000);
    readyAt = performance.now() + 4000 / DEV_SPEED;
    return;
  }
  bubble.classList.remove('show');
  guestEnter(tok);
}
const fadeEl = $('fade');
function fade(on) {
  fadeEl.classList.toggle('on', on);
  return realWait(850);
}
// 誰在聊天：見過的熟客裡挑兩位（予安在的話一定有她）
function pickGuestPair() {
  const met = S.REGULAR_IDS.filter((w) => S.hasMilestone(save, w, 1));
  const pool = met.length >= 2 ? met : ['yuan', 'zhe'];
  const a = pool.includes('yuan') ? 'yuan' : pool[0];
  const rest = pool.filter((w) => w !== a);
  const b = rest[Math.floor(((today() * 7) % 10) / 10 * rest.length)] || rest[0];
  return [a, b];
}
async function guestEnter(tok) {
  state.guest = 'enter';
  updateUI();
  await fade(true);
  if (tok !== guestTok) return;
  // 鏡頭退到門外；兩位熟客在店裡（予安在她的桌子，另一位站在桌子另一邊），龍眼睡在他的地方
  if (state.seat) { state.seat.prop.visible = true; state.seat = null; }
  state.closeup = false;
  guestPair = pickGuestPair();
  const d = today();
  const [a, b] = guestPair;
  const beside = { pos: V2(-1.0, -2.05), cup: null }; // 三個座位都看得到、不會擋住予安
  const spots = a === 'yuan' ? { [a]: SPOT.yuan, [b]: beside } : { [a]: SPOT.bar, [b]: b === 'kevin' ? SPOT.kevin : beside };
  for (const w of guestPair) {
    if (REGULARS_ON) { S.arrive(save, w, d); live.arrived.add(w); live.expect.delete(w); live.leaveAt.delete(w); }
    placeAt(w, spots[w], spots[w] === beside ? (w === 'kevin' ? 'walk' : 'stand') : undefined);
  }
  persist();
  deshu.position.copy(HOME);
  state.mode = 'door';
  frontWall.visible = false;
  ceiling.visible = true;
  cam.yaw = 0; cam.pitch = 0;
  tween = null;
  cam.pos.copy(DOOR.from); cam.look.copy(DOOR.look);
  await fade(false);
  if (tok !== guestTok) return;
  moveCamera(DOOR.to, DOOR.look, 2.6); // 推門進去
  audio.play('door'); audio.play('bell');
  await realWait(1700);
  say(H.GUEST.welcome, 3800);
  await realWait(2400);
  if (tok !== guestTok) return;
  // 回到俯瞰，挑一個位子（從門口看，座位在身後或被吧台擋住）
  state.mode = 'overview';
  ceiling.visible = false;
  moveCamera(OVER.pos, OVER.look, 1.6);
  state.guest = 'sit';
  updateUI();
}
// 德叔點單、收杯子時站的地方：離座位一步遠，坐著看得到他（太近會整個人擋住畫面）
const ORDER_SPOT = { window: V2(-0.95, -1.35), bar: V2(2.5, -1.0), sofa: V2(-0.55, 1.8) };
// 坐下之後，德叔走過來點單
async function guestOrder(seat) {
  const tok = guestTok;
  state.guest = 'order';
  updateUI();
  await realWait(1600);
  await deshuGo(ORDER_SPOT[seat.id]);
  if (tok !== guestTok) return;
  lookToward(deshu);
  const coffees = save.menu.filter((id) => S.MENU[id]?.kind === 'coffee');
  say(H.GUEST.order, 0);
  const i = await choose(coffees.map((id) => S.MENU[id].name));
  if (tok !== guestTok) return;
  say(H.GUEST.orderOk, 2500);
  await deshuGo(HOME);
  if (tok !== guestTok) return;
  state.guest = 'brew';
  updateUI();
  brew(seat, coffees[i], { guest: true });
}
// 杯子上桌之後：聽兩位熟客聊這間店，最後德叔過來小聲說兩句
async function guestListen(seat) {
  const tok = guestTok;
  state.guest = 'talk';
  updateUI();
  await realWait(4600); // 先讓德叔端上桌的那句話說完
  for (const l of H.guestTalk(save, guestPair, today())) {
    if (tok !== guestTok) return;
    const p = PEOPLE[l.who];
    lookToward(p, 2.3); // 坐吧台的話，聊天的人在身後
    const ms = sayMs(l.text);
    say(l.text, ms / DEV_SPEED, p);
    await realWait(ms + 500);
  }
  await realWait(1200);
  if (deshuReturning) await deshuReturning;
  if (tok !== guestTok) return;
  await deshuGo(ORDER_SPOT[seat.id]);
  if (tok !== guestTok) return;
  lookToward(deshu);
  for (const t of H.GUEST.end) {
    const ms = sayMs(t);
    say(t, ms / DEV_SPEED);
    await realWait(ms + 450);
  }
  save.flags.guestVisit = true;
  persist();
  // 聊完的熟客再坐一會兒；阿哲照常先走（予安、凱文本來就待到很晚）
  if (guestPair.includes('zhe')) live.leaveAt.set('zhe', performance.now() + 60000 / DEV_SPEED);
  state.guest = null;
  updateUI();
  checkTasks({ delay: 400 });
  const back = deshuGo(HOME).finally(() => { if (live.deshuWalk === back) live.deshuWalk = null; });
  live.deshuWalk = back;
  readyAt = performance.now() + 6000 / DEV_SPEED;
}
function stopGuest() {
  if (!state.guest) return;
  guestTok++;
  state.guest = null;
  fadeEl.classList.remove('on');
  if (state.mode === 'door') { state.mode = 'overview'; ceiling.visible = false; moveCamera(OVER.pos, OVER.look); }
}

/* ---------- 主迴圈 ---------- */
let last = performance.now();
const tmp = new THREE.Vector3();
const clampN = THREE.MathUtils.clamp;
// 把 3D 位置投影成畫面上的標籤或泡泡；座位標籤與泡泡都夾在畫面內，不會被切掉
// edge：說話的人不在畫面裡時（例如坐著背對他），泡泡改放在畫面上方，台詞一樣看得到
function project(pos, el, yOff = 0, pinned = false, edge = false) {
  tmp.copy(pos); tmp.y += yOff;
  tmp.project(camera);
  const W = app.clientWidth, H = app.clientHeight;
  if (edge && (tmp.z >= 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05)) {
    el.style.opacity = '';
    el.style.transform = `translate(-50%,-100%) translate(${W / 2}px, ${UI_SPACE.top + el.offsetHeight + 16}px)`;
    return;
  }
  const visible = tmp.z < 1 && (pinned || (Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15));
  el.style.opacity = visible ? '' : '0';
  const half = el.offsetWidth / 2 + 8;
  const x = clampN(((tmp.x + 1) / 2) * W, half, W - half);
  let y = ((1 - tmp.y) / 2) * H;
  y = clampN(y, el.offsetHeight + UI_SPACE.top, pinned ? H - UI_SPACE.bottom : H);
  el.style.transform = `translate(-50%,-100%) translate(${x}px, ${y}px)`;
}

/* ---------- 泡泡與座位標籤的位置（美術評分修正 a） ---------- */
// 泡泡：頂部介面（標題、溫度、選單、略過開場、快轉）是禁區，上緣至少在介面最下緣往下 8px，左右各留 12px；
// 尾巴指向說話的人（泡泡被推開、指不到人時不畫尾巴）。
// 座位標籤：小三角指向家具的上緣；標籤之間、標籤和泡泡之間重疊時往上推（推到介面下緣還是重疊，就改放到下面）。
const EDGE = 12;
const sv = new THREE.Vector3();
const rectHit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
function placeBubble(W, H) {
  if (!speaker || !bubble.textContent.trim() || getComputedStyle(bubble).visibility === 'hidden') return null;
  const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
  const minTop = UI_SPACE.top + UI_GAP;
  let x = W / 2, top = minTop, aim = null;
  if (speaker === 'player') top = H - 120 - bh; // 老闆自己說的話：固定在畫面下方的按鈕上面
  else {
    sv.copy(speaker.position); sv.y += headOf(speaker); sv.project(camera);
    if (sv.z < 1 && Math.abs(sv.x) <= 1.05 && Math.abs(sv.y) <= 1.05) {
      x = aim = ((sv.x + 1) / 2) * W;
      top = ((1 - sv.y) / 2) * H - 9 - bh;
    }
  }
  const left = clampN(x - bw / 2, EDGE, W - EDGE - bw);
  const want = top;
  top = clampN(top, minTop, H - EDGE - bh - 9);
  const tail = speaker === 'player' || (aim !== null && Math.abs(top - want) < 2);
  bubble.classList.toggle('notail', !tail);
  bubble.style.setProperty('--tail', aim !== null && tail ? `${clampN(aim - left, 18, bw - 18)}px` : '50%');
  bubble.style.opacity = '';
  bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  return bubble.classList.contains('show') ? { l: left, t: top, r: left + bw, b: top + bh + 9 } : null;
}
function placeLabels(W, H, avoid) {
  if ($('labels').style.display === 'none') return;
  const minTop = UI_SPACE.top + UI_GAP, maxBottom = H - UI_SPACE.bottom;
  const items = SEATS.map((st, i) => {
    const el = labels[i];
    // 家具在畫面上的上緣：底部與頂部投影比較高（畫面上比較上面）的那一個
    sv.copy(st.prop.position).setY(propTop(st.prop)).project(camera);
    const y1 = ((1 - sv.y) / 2) * H, x = ((sv.x + 1) / 2) * W;
    sv.copy(st.prop.position).project(camera);
    const y0 = ((1 - sv.y) / 2) * H;
    return { el, x, tip: Math.min(y0, y1) - 6, w: el.offsetWidth, h: el.offsetHeight };
  }).sort((a, b) => b.tip - a.tip); // 從畫面下面的標籤開始放：上面的被推的時候往上走
  const placed = avoid ? [avoid] : [];
  for (const it of items) {
    const left = clampN(it.x - it.w / 2, EDGE, W - EDGE - it.w);
    let top = clampN(it.tip - it.h, minTop, maxBottom - it.h);
    let below = false;
    for (let n = 0; n < 8; n++) {
      const hit = placed.find((p) => rectHit({ l: left, t: top, r: left + it.w, b: top + it.h }, p));
      if (!hit) break;
      if (hit.t - 4 - it.h >= minTop) top = hit.t - 4 - it.h;
      else { top = hit.b + 4; below = true; }
    }
    placed.push({ l: left, t: top, r: left + it.w, b: top + it.h });
    it.el.classList.toggle('below', below);
    it.el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
}
function layoutOverlays() {
  const W = app.clientWidth, H = app.clientHeight;
  placeLabels(W, H, placeBubble(W, H));
}

// 每 2 秒算一次 FPS；開店前 6 秒（著色器編譯、貼圖上傳）不算；分頁在背景時不算
function perfTick(raw) {
  PERF.frames++;
  PERF.acc += raw;
  if (PERF.acc < 2) return;
  PERF.fps = PERF.frames / PERF.acc;
  PERF.frames = 0; PERF.acc = 0;
  if (performance.now() - PERF.since < 6000 || document.visibilityState !== 'visible') return;
  PERF.low = PERF.fps < 40 ? PERF.low + 1 : 0;
  if (PERF.low >= 2 && PERF.ratio > 1) {
    PERF.ratio = Math.max(1, PERF.ratio - 0.25);
    PERF.low = 0;
    PERF.drops++;
    renderer.setPixelRatio(PERF.ratio);
    resize();
  }
  if (DEV) refreshPerfLine();
}
// 開場第一～三幕是整片不透明的畫面：底下的店先不畫（省電）
const sceneHidden = () => !!openingCtl && openingCtl.stage !== 'shop' && openingCtl.stage !== null;

let steamAcc = 0;
let flash = 0;
function loop() {
  const now = performance.now();
  const raw = (now - last) / 1000;
  const dt = Math.min(raw, 0.1);
  last = now;
  perfTick(raw);
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i](dt)) waiters.splice(i, 1);
  for (let i = realWaiters.length - 1; i >= 0; i--) if (realWaiters[i](dt)) realWaiters.splice(i, 1);
  updateCamera(dt);
  faceCamera(dt);
  updateOcclusion(dt);
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
  layoutOverlays();
  // 雨絲往下捲；颱風夜偶爾閃電、吊燈閃一下
  if (state.weather !== 'clear') {
    const tx = state.weather === 'typhoon' ? rainTex.typhoon : rainTex.rain;
    tx.offset.y += dt * (state.weather === 'typhoon' ? 1.6 : 0.7);
    if (state.weather === 'typhoon') {
      tx.offset.x += dt * 0.25;
      if (Math.random() < dt * 0.09) { flash = 0.18; audio.play('thunder'); }
      if (flash > 0) { flash -= dt; hemi.intensity = flash > 0 ? 2.4 : state.closing ? hemi.intensity : 0.8; }
    }
  }
  updateLights(dt);
  updateWipe(dt);
  if (lightsEl.style.display !== 'none') for (const l of lightLabels) project(l.pos, l.el, 0.12);
  if (sceneHidden()) PERF.skipped++;
  else renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

frontWall.visible = false;
ceiling.visible = false;
if (save.flags.seenOpening && H.closedOn(save, today())) resumeClosing(); // 今天已經打烊了
resize();
renderDecor();
placeCatAtHome();
applyLight();
updateUI();
loop();
persist(); // 新存檔在這一刻寫下第一次開店的時間

// 回到店裡：隔天以後回來先看德叔的營業日誌，收好之後德叔說劇本「開店」台詞；同一天回來是「老闆，歡迎回來。」
// 離線期間到期的任務（例如開店滿 3 天），等德叔打完招呼再說
function greet() {
  if (keeper() && !F.fw(save).mapSeen) { showMap('end'); return; } // 看地圖之前關掉了：從咖啡地圖接著看
  if (keeper() && !state.closing) { keeperArrive(); return; } // 回東山坐坐：從門口推門進來
  if (F.departureDue(save, today())) { checkTasks({ delay: 3800 }); startDay(); return; } // 離開東山的早上（德叔的招呼在 departureMorning）
  if (state.closing) {
    // 今天已經打烊了：店還是打烊後的樣子；最後一杯還沒喝的話，德叔等老闆坐下
    say(H.CLOSING.closedAgain, 3800);
    if (state.closing === 'lastcup') setTimeout(() => { if (state.closing === 'lastcup' && state.mode !== 'seat') say(H.CLOSING.sitDown, 4200); }, 4300 / DEV_SPEED);
    readyAt = performance.now() + 5000 / DEV_SPEED;
    startDay();
    return;
  }
  say(returningDay ? '燈亮了。老闆，今天想坐哪裡？' : '老闆，歡迎回來。', 3500);
  checkTasks({ delay: 3800 });
  rainHint();
  readyAt = performance.now() + 5000 / DEV_SPEED;
  startDay();
}
// 下雨的日子、老闆還沒在雨天坐過窗邊：德叔提一句窗邊（一天一次）
function rainHint() {
  if (state.weather !== 'rain' || isDone(save, 'rain-window') || keeper() || save.flags.rainHintDay === today()) return;
  save.flags.rainHintDay = today();
  persist();
  announce([['德叔', RAIN_HINT]], 4600);
}
if (!save.flags.seenOpening) {
  startOpening(); // 新存檔：從 16:49 的辦公室開始
} else {
  // 離開東山的早上不寫日誌（直接出發）；離開東山之後，日誌是凱文寫的
  const page = returningDay && !F.departureDue(save, today()) ? writeJournal(save, lastSeenAtLoad, now(), journalOpts()) : null;
  if (page && keeper()) page.keeper = true;
  if (page) { keepPage(save, page); persist(); }
  if (keeper()) becomeKeeper();
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
    get overDeg() { return OVER.deg; },
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
    get quiet() { return quiet(); },
    get letterDue() { return dueLetter(save, letterCtx())?.id || null; },
    get waitInfo() { return { tut: state.tutorial, letter: !!state.letter, cin: state.cinematic, scene: !!state.scene, choice: state.choice, brewing, ret: !!deshuReturning, placing: state.placing, guest: state.guest, closing: state.closing, overlay: overlayOpen(), sayBusy, ready: Math.round(Math.max(readyAt, sayEnds) - performance.now()) }; },
    get cinematic() { return state.cinematic; },
    get journalPages() { return save.journal.length; },
    get yuanHere() { return yuan.visible; },
    // 階段 4：熟客
    get story() {
      const r = (w) => ({ visits: save.regulars[w].visits, milestones: [...save.regulars[w].milestones], on: { ...save.regulars[w].on } });
      return { yuan: r('yuan'), zhe: r('zhe'), kevin: r('kevin'), ...save.story, menu: [...save.menu] };
    },
    get scene() { return state.scene?.id || null; },
    get storyBusy() { return storyBusy(); },
    get here() { return PEOPLE_IDS.filter((w) => PEOPLE[w].visible); },
    get weather() { return state.weather; },
    get night() { return state.night; },
    get choosing() { return state.choice; },
    get owned() { return save.owned.map((o) => o.item); },
    // 某個人在畫面上的位置（相對 #app 的像素）
    personOnScreen(w) {
      const p = PEOPLE[w];
      if (!p?.visible) return null;
      const v = p.position.clone().add(new THREE.Vector3(0, 0.8, 0)).project(camera);
      return { x: ((v.x + 1) / 2) * app.clientWidth, y: ((1 - v.y) / 2) * app.clientHeight, inFront: v.z < 1 };
    },
    // 階段 5：龍眼、打烊後、客人模式
    get catSpot() { return catSpot?.id || null; },
    get catOnSeat() { return catOnSeat; },
    get catBusy() { return catBusy; },
    get catAway() { return performance.now() < catMood.awayUntil; },
    get catHome() { return catAtHome; },
    get catPos() { return { x: cat.position.x, y: cat.userData.mesh.position.y, z: cat.position.z }; },
    catOnScreen() {
      const v = cat.position.clone().add(new THREE.Vector3(0, cat.userData.mesh.position.y + 0.2, 0)).project(camera);
      return { x: ((v.x + 1) / 2) * app.clientWidth, y: ((1 - v.y) / 2) * app.clientHeight, inFront: v.z < 1 };
    },
    get closing() { return state.closing; },
    get closingSave() { return JSON.parse(JSON.stringify(save.closing)); },
    get diary() { return save.diary.map((e) => ({ ...e })); },
    get guest() { return state.guest; },
    get guestPair() { return guestPair; },
    get needClosing() { return REGULARS_ON && !state.closing && !!S.liveNext(save, 'yuan', today())?.needClosing && live.arrived.has('yuan'); },
    get pendantLevels() { return pendants.map((p) => Math.round(p.level * 100) / 100); },
    get hemi() { return Math.round(hemi.intensity * 100) / 100; },
    get deshuWiping() { return wipeOn; },
    // 階段 6：徵店長與告別、第二封信、咖啡地圖、常態店
    get farewell() { return JSON.parse(JSON.stringify(save.farewell)); },
    get keeper() { return keeper(); },
    get noticeUp() { return noticeSign.visible; },
    get mapOpen() { return !$('map').hidden; },
    get arriving() { return !!state.arriving; },
    get barName() { return NAMES.get(deshu); },
    get poses() { return { ...poses }; },
    get departureDue() { return F.departureDue(save, today()); },
    get enamelOnTable() { return cups.some((c) => c.userData.enamel); },
    // 階段 7：聲音與效能
    get audio() { return audio.state; },
    audioPeak() { return audio.peak(); },
    get perf() { const m = renderer.info; return { fps: Math.round(PERF.fps), ratio: PERF.ratio, cap: PERF.cap, drops: PERF.drops, skipped: PERF.skipped, calls: m.render.calls, triangles: m.render.triangles, textures: m.memory.textures, geometries: m.memory.geometries }; },
    get settings() { return { ...save.settings }; },
    // 某個座位上那杯咖啡在畫面上的位置（相對 #app 的像素）
    cupOnScreen(seatId) {
      const c = cups.find((x) => x.userData.seat === seatId);
      if (!c) return null;
      const v = c.position.clone().add(new THREE.Vector3(0, CUP_H / 2, 0)).project(camera);
      return { x: ((v.x + 1) / 2) * app.clientWidth, y: ((1 - v.y) / 2) * app.clientHeight, inFront: v.z < 1 };
    },
  };
}
