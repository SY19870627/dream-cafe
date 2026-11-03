// 我單方面辭退老闆後，開了一間夢想中的咖啡店 — 2.5D 紙片原型
// 3D 房間 + 2D 紙片（billboard）擺飾與人物，驗證手機直立的顧客視角。
import * as THREE from 'three';
import * as A from './art.js';
import { createStore, giveStarters } from './save.js';
import { temperature, completeTasks, taskById, TASKS, isDone, stageNoteText } from './tasks.js';
import { CATALOG, CATEGORY, itemById, balance, commitLayout } from './catalog.js';
import { dayIndex, daysOpen, dateLabel, JUMP_DAY_MS } from './clock.js';
import { LETTERS, LAWYER_LETTER, letterById, dueLetter, markRead } from './letters.js';
import { writeJournal, keepPage } from './journal.js';
import { runOpening } from './opening.js';
import { weatherOn, rainFloorDue, RAIN_HINT } from './weather.js';
import * as S from './story.js';
import { petCat, jumpsOnChair, PURR, CAT_LINES } from './cat.js';
import * as H from './afterhours.js';
import * as F from './farewell.js';
import { createAudio, VOLUMES, VOLUME_NAMES } from './audio.js';

const $ = (id) => document.getElementById(id);
const lightsEl = $('lights'); // 打烊後每盞燈旁邊的「關燈／開燈」

/* ---------- art2b：開場、介面的手繪圖（CSS 變數）、介面圖示、啟動畫面 ---------- */
// 圖載到了才設 CSS 變數，index.html 用 var(--art-*, none)：沒有載到就是原本的漸層、純色與 2px 墨色框
for (const [v, name] of [['--art-office', 'scene_office_night'], ['--art-paper', 'ui_paper_lined'], ['--art-bubble', 'ui_bubble_9slice']]) {
  const url = A.artUrl(name);
  if (url) document.documentElement.style.setProperty(v, `url("${url}")`);
}
$('app').classList.toggle('art-bubble', !!A.artUrl('ui_bubble_9slice'));
// 介面圖示：ui_icons.svg 的四個 <symbol> 放進頁面裡（同一份文件，<use href="#icon-…"> 一定找得到），
// 選單、快轉、溫度、開燈前面加圖示；沒有載到就照舊只有文字（選單是「≡」）
const ICONS = !!A.iconSymbols();
if (ICONS) {
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  sprite.innerHTML = A.iconSymbols();
  document.body.prepend(sprite);
}
const iconSvg = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${id}"/></svg>`;
// 按鈕前面加圖示，文字放進 .lbl（之後改字用 setLabel，圖示不會被蓋掉）；only＝只要圖示（選單）
function iconize(el, id, only = false) {
  if (!ICONS || el.querySelector('.icon')) return;
  const text = el.textContent;
  el.innerHTML = iconSvg(id) + (only ? '' : '<span class="lbl"></span>');
  if (!only) el.querySelector('.lbl').textContent = text;
  el.classList.add('has-icon');
}
const setLabel = (el, text) => { (el.querySelector('.lbl') || el).textContent = text; };
iconize($('menu-btn'), 'menu', true);
iconize($('speed'), 'fastforward');
iconize($('temp'), 'temperature');
iconize($('lights-btn'), 'light');
// 啟動畫面：main.js 開始跑時手繪圖都載完了（art.js 的 top-level await），淡出後拿掉
{
  const sp = $('splash');
  if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 700); }
}

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

// 接正式美術第二批：地板、牆、天花板、吧台與桌面是手繪的無縫材質（沒有載到時 art.js 回傳同樣大小的 Canvas 版本），依公尺設定 repeat
const floorTex = A.tex(A.woodFloor(), [ROOM.w / 2, ROOM.d / 2]); // 一張 2×2 公尺
// 同一張圖的不同 repeat：clone() 共用同一份圖（GPU 只上傳一次）
const texRepeat = (t, x, y) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; };
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), lambert(floorTex));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// 牆：上半石灰牆、下半 1 公尺高的紅磚腰牆（上緣是木腰帶），各一片平鋪 1×1 公尺的材質
const WAINSCOT = 1.0;
const plasterTex = A.tex(A.wallPlaster(), [1, 1]), wainscotTex = A.tex(A.wallWainscot(), [1, 1]);
function addWall(w, x, z, ry) {
  const m = new THREE.Group();
  const up = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h - WAINSCOT), lambert(texRepeat(plasterTex, w, ROOM.h - WAINSCOT)));
  up.position.y = (ROOM.h + WAINSCOT) / 2;
  const low = new THREE.Mesh(new THREE.PlaneGeometry(w, WAINSCOT), lambert(texRepeat(wainscotTex, w, 1)));
  low.position.y = WAINSCOT / 2;
  m.add(up, low);
  m.position.set(x, 0, z);
  m.rotation.y = ry;
  scene.add(m);
  return m;
}
addWall(ROOM.w, 0, -ROOM.d / 2, 0); // 後牆
addWall(ROOM.d, -ROOM.w / 2, 0, Math.PI / 2); // 左牆
addWall(ROOM.d, ROOM.w / 2, 0, -Math.PI / 2); // 右牆（吧台後）
const frontWall = addWall(ROOM.w, 0, ROOM.d / 2, Math.PI); // 前牆，只在坐下時顯示

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), lambert(A.tex(A.ceiling(), [ROOM.w, ROOM.d]))); // 一張 1×1 公尺
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ROOM.h;
scene.add(ceiling);

// 窗戶（不受光照影響，自己發亮）；窗外隨白天／夜晚與天氣（晴、雨、颱風）換一張。
// 接正式美術第二批：窗景六張是畫好的最終亮度；窗框是另一張透明圖，貼在窗景與雨絲前面（受店裡的光照）
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
const frameTex = A.tex(A.windowFrame());
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
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), lambert(frameTex, { transparent: true, alphaTest: 0.35 }));
  f.position.set(x, y, z);
  f.rotation.y = ry;
  f.translateZ(0.035);
  scene.add(f);
}
addWindow(-1.7, 1.75, -ROOM.d / 2 + 0.02, 0);
addWindow(-ROOM.w / 2 + 0.02, 1.7, -0.6, Math.PI / 2);

// 吧台後方層架（小黑板寫著今日手沖；阿哲的豆上架後多一行）。
// 接正式美術第二批：手繪的層架下半是一座有抽屜的櫃子，底邊在離地 0.95 公尺：底下補一座靠牆的矮櫃（正面用吧台正面的材質）撐著
const backBar = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), lambert(A.tex(A.backBar(2.8, 1.8, save.menu)), { transparent: true, alphaTest: 0.1 }));
backBar.position.set(ROOM.w / 2 - 0.02, 1.85, -1.6);
backBar.rotation.y = -Math.PI / 2;
scene.add(backBar);
const BACK_BASE = { d: 0.2, h: 0.95 };
const counterFrontTex = A.tex(A.counterFront(), [1, 1]);
const woodTopTex = A.tex(A.woodTop(), [1, 1]);
{
  const front = lambert(texRepeat(counterFrontTex, 2.8 / 1.7, BACK_BASE.h));
  const top = lambert(texRepeat(woodTopTex, BACK_BASE.d, 2.8));
  const side = lambert(texRepeat(counterFrontTex, BACK_BASE.d / 1.7, BACK_BASE.h));
  const base = new THREE.Mesh(new THREE.BoxGeometry(BACK_BASE.d, BACK_BASE.h, 2.8), [side, front, top, top, side, side]);
  base.position.set(ROOM.w / 2 - BACK_BASE.d / 2, BACK_BASE.h / 2, -1.6);
  scene.add(base);
}
function drawBackBar(menu = save.menu) {
  backBar.material.map?.dispose();
  backBar.material.map = A.tex(A.backBar(2.8, 1.8, menu));
  backBar.material.needsUpdate = true;
}

// 牆上的老溫度計
const thermoMat = new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.1 });
const thermo = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.9), thermoMat);
// 美術評分修正 e：從 x＝1.4 往左移到 1.0：從吧台座轉頭看坐在最裡面高腳椅的凱文，他的頭原本正好疊在溫度計上
thermo.position.set(1.0, 1.65, -ROOM.d / 2 + 0.02);
scene.add(thermo);
// 溫度上升時，溫度計後面亮起一圈暖光
const thermoGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4),
  new THREE.MeshBasicMaterial({ map: A.tex(A.glow()), color: '#ffb066', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
thermoGlow.position.set(1.0, 1.65, -ROOM.d / 2 + 0.01);
thermoGlow.visible = false;
scene.add(thermoGlow);

// 吧台（實體盒子；大型家具用立體，小擺飾與人物用紙片）。
// 接正式美術第二批：正面（客人那一側）與兩端貼吧台正面的材質（1.7×1 公尺一張），檯面與圓桌貼木頭檯面（1×1 公尺一張）
// BoxGeometry 六個面的順序：+x、−x、+y、−y、+z、−z
const counterSide = lambert(texRepeat(counterFrontTex, 0.7 / 1.7, 1));
const counterFace = lambert(texRepeat(counterFrontTex, 3.4 / 1.7, 1));
const counter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 3.4), [counterFace, counterFace, counterSide, counterSide, counterSide, counterSide]);
counter.position.set(2.0, 0.5, -1.5);
scene.add(counter);
// 檯面：木紋順著吧台長的方向（材質轉 90°）
const topTex = texRepeat(woodTopTex, 3.5, 0.8);
topTex.center.set(0.5, 0.5); topTex.rotation = Math.PI / 2;
const topEdge = lambert(texRepeat(woodTopTex, 3.5, 0.06)), topEnd = lambert(texRepeat(woodTopTex, 0.8, 0.06));
const counterTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 3.5), [topEdge, topEdge, lambert(topTex), topEnd, topEnd, topEnd]);
counterTop.position.set(2.0, 1.03, -1.5);
scene.add(counterTop);

const tableEdge = new THREE.MeshLambertMaterial({ color: '#8a5a3b' });
function table(x, z, h = 0.74, r = 0.38) {
  const g = new THREE.Group();
  const face = lambert(texRepeat(woodTopTex, 2 * r, 2 * r)); // 圓桌面的 UV 是整個圓：直徑幾公尺就重複幾次
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 32), [tableEdge, face, face]);
  top.position.y = h;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 12), new THREE.MeshLambertMaterial({ color: '#3a3330' }));
  leg.position.y = h / 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 24), leg.material);
  foot.position.y = 0.015;
  g.add(top, leg, foot);
  top.userData.table = leg.userData.table = foot.userData.table = true;
  g.position.set(x, 0, z);
  scene.add(g);
  return { x, z, h };
}

// 吊燈。接正式美術第二批：手繪的吊燈是紙片（燈罩下緣在原本圓錐的下緣 2.35 公尺，電線往上接到天花板），
// 只轉水平方向面向鏡頭（hanging）；燈罩的亮度用 emissive（只有燈罩那段發亮）。沒有載到就用原本的立體圓錐
const pendants = [];
const hanging = [];
const lampArt = A.pendantLamp();
const lampTex = lampArt && A.tex(lampArt), lampGlow = lampArt && A.tex(lampArt.glow);
for (const z of [-2.5, -0.7]) {
  let shade;
  if (lampTex) {
    const w = lampArt.width / lampArt.ppm, h = lampArt.height / lampArt.ppm;
    shade = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0),
      new THREE.MeshLambertMaterial({ map: lampTex, emissiveMap: lampGlow, emissive: '#ffffff', emissiveIntensity: 0.7, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
    shade.position.set(2.0, 2.35, z);
    hanging.push(shade);
    scene.add(shade);
  } else {
    shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd59a', side: THREE.DoubleSide }));
    shade.position.set(2.0, 2.45, z);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.65), new THREE.MeshBasicMaterial({ color: '#222' }));
    cord.position.set(2.0, 2.87, z);
    scene.add(shade, cord);
  }
  const light = new THREE.PointLight('#ffb46b', 6, 0, 1.6);
  light.position.set(2.0, 2.3, z);
  scene.add(light);
  pendants.push({ shade, light, level: 1, pos: new THREE.Vector3(2.0, 2.45, z) });
}
// 夜裡吧台正面（客人那一側）的補光：吊燈在吧台正上方，正面原本只剩一片暗（階段 7）；跟著吊燈一起開關
const barFill = new THREE.PointLight('#ffc58a', 0, 3.2, 1.4);
barFill.position.set(0.9, 1.5, -1.5);
scene.add(barFill);
// 美術評分修正 c：坐下時，自己那張桌子上方一點暖光（深色桌面在近景占一大塊，原本是整片暗色）；跟著吊燈一起開關
const seatLamp = new THREE.PointLight('#ffcf94', 0, 1.8, 1.2);
scene.add(seatLamp);

/* ---------- 光線 ---------- */
const hemi = new THREE.HemisphereLight('#dfe8ff', '#a8865f', 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.0);
sun.position.set(-6, 5, -1.5);
scene.add(sun);

/* ---------- 紙片 ---------- */
const papers = [];
const blobTex = A.tex(A.blob());
// 落地燈亮的時候燈罩前面的暖光（手繪的落地燈用）
const haloTex = A.tex(A.glow());
const floorGlow = new Map(); // 手繪落地燈的圖 → 只有燈罩的發光材質（每張圖做一次）
function lampGlowTex(art) {
  if (!floorGlow.has(art)) floorGlow.set(art, A.tex(A.glowOnly(art, 0, 0.24)));
  return floorGlow.get(art);
}

function paper(canvas, x, z, opt = {}) {
  const w = canvas.width / A.ppmOf(canvas), h = canvas.height / A.ppmOf(canvas);
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
  p.userData.art = canvas; // 現在用的是哪張圖（龍眼走路時依它決定要不要鏡像、德叔的小動作只在站著時做）
  const m = p.userData.mesh.material;
  m.map.dispose();
  m.map = A.tex(canvas);
  if (m.emissiveMap) m.emissiveMap = m.map; // 夜裡人物自己帶一點光（applyLight）
  m.needsUpdate = true;
}

// 換一張大小不同的圖（例如凱文從站著走進來變成坐下）：平面的尺寸也跟著換
function setArt(p, canvas) {
  const mesh = p.userData.mesh;
  const w = canvas.width / A.ppmOf(canvas), h = canvas.height / A.ppmOf(canvas);
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
    if (o.material) { if (o.material.map !== blobTex && o.material.map !== haloTex) o.material.map?.dispose(); o.material.dispose(); }
  });
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// 紙片轉向鏡頭。階段 7 打磨：
// 1. 俯瞰時店前半部的紙片幾乎是從正上方看，只剩一條線：不靠牆的紙片往後仰一點（鏡頭越高越仰，最多約 27°），坐下時不仰
// 2. 角落沙發平常只能小角度轉（坐下看起來才自然），俯瞰時整張轉向鏡頭，不再是側面；轉的時候慢慢轉
// 美術評分修正 d：俯瞰時不靠牆的紙片只繞垂直軸轉到和畫面平行（不是各自對著鏡頭的位置，畫面邊上的才不會斜成側面），
// 往後仰的角度不變，剩下看不到的高度用往上拉長補回來（最多 1.8 倍）：原本仰 27° 還是扁扁的，看起來像倒在地上
const camFwd = new THREE.Vector3();
function faceCamera(dt = 0) {
  const over = state.mode === 'overview';
  camera.getWorldDirection(camFwd);
  const screenYaw = Math.atan2(-camFwd.x, -camFwd.z); // 和畫面平行的方向（美術評分修正 d）
  for (const m of hanging) m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
  for (const p of papers) {
    const free = p.userData.clamp >= Math.PI - 1e-6 || p.userData.overClamp; // 站在地上、可以整張轉的紙片（靠牆的不算）
    const yaw = over && free ? screenYaw : Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
    const clamp = over && p.userData.overClamp ? Math.PI : p.userData.clamp;
    const d = THREE.MathUtils.clamp(wrapAngle(yaw - p.userData.base), -clamp, clamp);
    const target = p.userData.base + d;
    if (p.userData.overClamp && dt) p.rotation.y += wrapAngle(target - p.rotation.y) * Math.min(1, dt * 4);
    else p.rotation.y = target;
    if (p.userData.shadow) p.userData.shadow.rotation.z = -p.rotation.y; // 影子保持朝地
    if (free) {
      const m = p.userData.mesh;
      const h = m.geometry.parameters.height * 0.5 + m.position.y;
      const elev = Math.atan2(camera.position.y - h, Math.hypot(camera.position.x - p.position.x, camera.position.z - p.position.z));
      const lean = THREE.MathUtils.clamp((elev - 0.5) * 0.6, 0, 0.47);
      m.rotation.x = -lean;
      // 美術評分修正 d：俯瞰時剩下的角度用拉長補回來，畫出來和原圖一樣高，不會看起來扁扁地躺在地上
      const sy = over ? Math.min(1.8, 1 / Math.cos(Math.max(0, elev - lean))) : 1;
      m.scale.y = sy * (p.userData.squash ?? 1);
    }
    // 美術評分修正 e：俯瞰時人物與龍眼放大（OVER_BIG，評審：德叔約 40px、貓約 30px 太小），以腳底為準；坐下時慢慢縮回原本的大小
    if (p.userData.big !== undefined) {
      const m = p.userData.mesh, to = over ? OVER_BIG : 1;
      p.userData.big = dt ? p.userData.big + (to - p.userData.big) * Math.min(1, dt * 4) : to;
      m.scale.x = (p.userData.flip ?? 1) * p.userData.big;
      if (free) m.scale.y *= p.userData.big;
      else m.scale.y = (p.userData.squash ?? 1) * p.userData.big;
    }
  }
}
const OVER_BIG = 1.3;

/* ---------- 座位 ---------- */
const tA = table(-2.2, -0.6);
const tC = table(-1.45, 2.4, 0.45, 0.42);
const tY = table(-0.4, -2.3, 0.74, 0.34);

const SEATS = [
  {
    id: 'window', name: '窗邊座',
    // 美術評分修正 c：往後、往右退一點，推近（fov），窗景是主體，桌子只在左下角露一角（原本占左下約 1/3）
    eye: new THREE.Vector3(-1.55, 1.25, 0.6), look: new THREE.Vector3(-2.0, 0.85, -3.6), fov: 60,
    cup: new THREE.Vector3(-1.9, tA.h + 0.02, -0.62), serve: new THREE.Vector3(-1.55, 0, -0.9), table: tA,
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
    // 美術評分修正 c：退到沙發的左後角、坐低一點，轉向吧台：德叔與吧台是主體，桌子在下面變扁、上面一點暖光
    eye: new THREE.Vector3(-2.75, 0.95, 3.72), look: new THREE.Vector3(2.2, 0.8, -1.5), fov: 62,
    cup: new THREE.Vector3(-1.35, tC.h + 0.02, 2.3), serve: new THREE.Vector3(-0.8, 0, 2.0), table: tC,
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
  longan: new THREE.MeshLambertMaterial({ color: '#7a4120' }),
  enamel: new THREE.MeshLambertMaterial({ color: '#f4f2ec' }), // 那個舊的琺瑯杯：白底、綠杯緣（Q59：統一成 prop_cup 的白杯綠邊）
  enamelRim: new THREE.MeshLambertMaterial({ color: '#3d6b4f' }),
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
// 美術評分修正 e（Q63）：平常的杯子（老闆每天的那杯、熟客、一次客人、凱文的冰美式）都用手繪的 prop_cup_daily（米白馬克杯、赭黃杯緣），
// 德叔的琺瑯杯（prop_cup，白底綠邊）只在最後一晚出現在老闆桌上（劇本：從不讓別人用，最後一晚第一次放在玩家面前）。
// 兩張都裝著咖啡、一直面向鏡頭；沒有載到時用 A.cupDaily()／A.cup() 的 Canvas 杯子（最後一晚的琺瑯杯沒有圖時照舊是立體的杯子，杯緣是綠的，Q59）。
// 凱文的冰美式原本是程式畫的深色玻璃杯（評分：程式畫的），改成平常的杯子、不冒煙
const dailyImg = A.cupDaily();
const dailyArt = A.artLoaded('prop_cup_daily');
const enamelImg = A.cup();
const cupArt = A.artLoaded('prop_cup');
const DAILY_SHRINK = 0.95; // 畫師提醒：馬克杯放進去看起來大約 5%，縮一點才和桌面、手的比例對得上
const NEAR_SHRINK = 0.95; // 美術評分修正 f：老闆自己那杯（沖煮、上桌都是近景）再縮 5%（評審：近景約大 5～10%，中景合適）
// 每個杯子共用；不受光照，夜裡由 applyLight() 調暗。
// 美術評分修正 f：平常的杯子不套色調映射（toneMapped: false）：ACES 會把米白和細的赭黃杯緣一起推亮、洗成白色（評審：看起來像白杯配淡米色邊）
const cupMat = new THREE.SpriteMaterial({ map: A.tex(dailyImg), alphaTest: 0.35, color: '#f2ece4', toneMapped: false });
const enamelMat = new THREE.SpriteMaterial({ map: A.tex(enamelImg), alphaTest: 0.35, color: '#f2ece4' });
function cupSprite(g, enamel = false, near = false) {
  const img = enamel ? enamelImg : dailyImg;
  const s = new THREE.Sprite(enamel ? enamelMat : cupMat);
  // 手繪圖裁掉了留白，杯身約 9.5 公分高；Canvas 杯子的畫布上下有留白
  const h = (enamel ? (cupArt ? 0.095 : 0.12) : (dailyArt ? 0.095 * DAILY_SHRINK * (near ? NEAR_SHRINK : 1) : 0.12)) / CUP_SCALE;
  s.scale.set(h * img.width / img.height, h, 1);
  s.center.set(0.5, 0);
  const liquid = new THREE.Object3D(); // 圖裡已經有咖啡：倒進去之前也是滿的（沒有空杯的圖）
  g.add(s, liquid);
  g.userData.liquid = liquid;
  g.userData.sprite = s;
}
// near：老闆自己那杯（stationCup，沖煮與上桌都是近景）
function makeCup(kind = 'hot', dish = false, near = false) {
  const g = new THREE.Group();
  g.scale.setScalar(CUP_SCALE);
  if (kind === 'enamel' && cupArt) {
    cupSprite(g, true);
    g.userData.enamel = true;
    return g;
  }
  if (kind === 'enamel') {
    const body = cyl(0.04, 0.04, 0.075, M.enamel); body.position.y = 0.0375;
    const rim = cyl(0.0415, 0.0415, 0.01, M.enamelRim, 24, true); rim.position.y = 0.072;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 16), M.enamelRim);
    handle.position.set(0.05, 0.04, 0);
    const liquid = cyl(0.037, 0.037, 0.004, M.coffee); liquid.position.y = 0.07; liquid.visible = false;
    g.add(body, rim, handle, liquid);
    g.userData.liquid = liquid;
    g.userData.enamel = true;
    return g;
  }
  if (kind === 'iced') g.userData.iced = true;
  cupSprite(g, false, near);
  if (dish) {
    const plate = cyl(0.035, 0.03, 0.006, M.ceramic); plate.position.set(-0.075, 0.003, 0.05);
    g.add(plate);
    for (const [x, z] of [[-0.085, 0.045], [-0.068, 0.058], [-0.074, 0.038]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), M.longan);
      b.position.set(x, 0.012, z);
      g.add(b);
    }
  }
  return g;
}
const CUP_SPOT = new THREE.Vector3(1.9, TOP, -1.42); // 美術評分修正 d：往德叔靠一點，看德叔沖的特寫才放得進來
let stationCup = makeCup('hot', false, true);
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

// 美術評分修正 d：德叔的沖煮圖（char_deshu_brew）已經畫了手沖壺、濾杯與下壺，吧台上的立體器具（磨豆機、濾杯與下壺、手沖壺、水柱）
// 收起來，不要同時出現兩套；沖煮的六個步驟照舊用聲音、熱氣、德叔的小動作與杯子呈現。凱文顧店（他的圖沒有器具）與退回 Canvas 時照舊
const kitInArt = () => !keeper() && A.artLoaded('char_deshu_brew');
function syncBrewKit() {
  const on = !kitInArt();
  for (const o of [grinder, brewer, kettle]) o.visible = on;
}
syncBrewKit();
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
// 接正式美術：凱文坐著的手繪圖沒有椅子，依他坐的地方在底下畫一張（吧台的高腳椅 'stool'，其他地方 'chair'）；
// 吧台的位子（spot.stool）坐下時店裡那張高腳椅照舊藏起來，改畫在他的圖裡
const poseCache = new Map();
function poseArt(who, pose, seat) {
  const k = `${who}:${pose}:${seat || ''}`;
  if (!poseCache.has(k)) poseCache.set(k, A[who](pose, seat || undefined));
  return poseCache.get(k);
}
let seatOf = () => null; // 坐在哪種椅子上（live 宣告之後換成真的）
const yuan = paper(poseArt('yuan', 'type'), -0.4, -1.75);
const zhe = paper(poseArt('zhe', 'stand'), 0.15, 3.7);
const kevin = paper(poseArt('kevin', 'sit'), 1.3, -2.9);
const grandpa = paper(poseArt('grandpa', 'stand'), 0.15, 3.7);
const poses = { yuan: 'type', zhe: 'stand', kevin: 'sit', grandpa: 'stand' };
const seats = {};
function setPose(who, pose) {
  const seat = who === 'kevin' ? seatOf(who) : null;
  if (!pose || (poses[who] === pose && seats[who] === seat)) return;
  poses[who] = pose;
  seats[who] = seat;
  setArt(PEOPLE[who], poseArt(who, pose, seat));
}
// 予安的椅子：手繪的予安坐著沒有畫椅子，窗邊那張小桌放一張（在她身後一點，鏡頭都在南邊，椅子總是在她後面）。
// 她不在的時候，就是一張空椅子；退回 Canvas 繪圖（她的圖自己有坐姿）時不放
const yuanChair = paper(A.chair(), -0.4, -1.86);
const YUAN_CHAIR = A.artLoaded('char_yuan_sit');
yuanChair.visible = YUAN_CHAIR;
// 接正式美術第二批：她坐在這張椅子上時，椅子已經畫進她的圖裡（A.yuan() 坐姿），店裡這張先收起來，免得兩張疊在一起
function updateYuanChair() {
  const on = yuan.visible && poses.yuan !== 'book' && poses.yuan !== 'frame' && poses.yuan !== 'stand'
    && Math.hypot(yuan.position.x - yuanChair.position.x, yuan.position.z - yuanChair.position.z) < 0.5;
  yuanChair.visible = YUAN_CHAIR && !on;
}

// 德叔與龍眼
const HOME = new THREE.Vector3(2.6, 0, -1.6);
const DESHU_POSES = ['idle', 'pour', 'wipe', 'wipe2', 'serve', 'smile', 'thermo'];
const deshuCanvas = Object.fromEntries(DESHU_POSES.map((k) => [k, A.deshu(k)]));
const deshu = paper(deshuCanvas.idle, HOME.x, HOME.z);
deshu.userData.art = deshuCanvas.idle;
const PEOPLE = { deshu, yuan, zhe, kevin, grandpa };
// 熟客由故事線決定什麼時候出現（startDay）；關掉熟客的測試模式沿用舊做法：予安從開店第 2 天起坐在窗邊
for (const p of [yuan, zhe, kevin, grandpa]) p.visible = false;
const showYuan = () => { if (!REGULARS_ON) yuan.visible = today() >= 2; };
showYuan();
// 吧台上的那袋龍眼乾（阿哲第一次來時放的）
const counterBag = paper(A.longanBag(), 1.95, -0.1, { y: TOP, shadow: false });
// 接正式美術第二批：吧台裡側最裡面放一組手繪的手沖器具（德叔沖煮用的是前面那組立體的，這組是擺著的）；
// 窗邊座的桌上放一張手寫菜單的杯墊當焦點。兩張都只有手繪圖，沒有載到就不放
if (A.artLoaded('kettleSet')) paper(A.kettleSet(), 2.2, -2.85, { y: TOP, shadow: false, clamp: 0.9, base: -Math.PI / 2 });
if (A.coaster()) paper(A.coaster(), tA.x + 0.2, tA.z - 0.14, { y: tA.h + 0.02, shadow: false });
counterBag.visible = save.menu.includes('longan');
// 老先生的信：德叔從吧台抽屜拿出來，放在吧台上
const envelope = paper(A.envelope(), 1.8, -0.75, { y: TOP, shadow: false });
envelope.userData.mesh.scale.setScalar(1.7); // 從俯瞰鏡頭也看得到
envelope.userData.squash = 1.7; // 高度由 faceCamera() 每一格設（俯瞰時會拉長）
envelope.visible = false;
/* ---------- 門口（承峰 11/3 試玩回饋：「門口沒有門，只有牆」，D178） ---------- */
// 客人從前牆 x 0.15 的地方進出（DOOR_IN），原本那裡只有一整片牆。還沒有門的手繪圖：先用程式的幾何＋現有材質（吧台正面的木板、
// 檯面的木頭）做一扇老木門：門框、下半木板、上半四格玻璃（看得到窗景）、黃銅把手、門楣上的黃銅小鈴。
// 門與門外的景掛在前牆底下，跟著前牆只在坐下時出現；門檻與門口的腳踏墊在地上，俯瞰也看得到門在哪裡。
// 有人推門進來或走出去時門往店裡開、鈴晃一下（swingDoor()）；有人快走到門口時鈴先輕輕晃（ringDoorBell()）
const DOORWAY = { x: 0.15, w: 0.92, h: 2.1, jamb: 0.08 };
const doorWood = lambert(texRepeat(counterFrontTex, DOORWAY.w / 1.7, 0.72));
doorWood.map.offset.y = 0.28; // 吧台正面的材質下緣是一段磨石子踢腳：門板只用上面的木板
const doorTrim = new THREE.MeshLambertMaterial({ color: '#5b3b27' });
const brass = new THREE.MeshLambertMaterial({ color: '#c9a04a', emissive: '#3a2a10' });
const doorView = new Map(); // 窗景裁成直的一條（門的比例），白天／夜裡、天氣各一張
function doorViewTex(night, weather) {
  const k = `${night}:${weather}`;
  if (!doorView.has(k)) {
    const t = winTex(night, weather).clone();
    t.repeat.set((DOORWAY.w / DOORWAY.h) / (1.6 / 1.3), 1);
    t.offset.set(0.5 - t.repeat.x / 2, 0);
    t.needsUpdate = true;
    doorView.set(k, t);
  }
  return doorView.get(k);
}
const door = new THREE.Group(); // 前牆的子物件：前牆轉了 180°，所以 x 要反過來、+z 朝店裡
door.position.set(-DOORWAY.x, 0, 0);
frontWall.add(door);
const doorOutside = new THREE.Mesh(new THREE.PlaneGeometry(DOORWAY.w, DOORWAY.h), new THREE.MeshBasicMaterial({ map: doorViewTex(false, 'clear') }));
doorOutside.position.set(0, DOORWAY.h / 2, 0.004);
door.add(doorOutside);
{
  const J = DOORWAY.jamb, W = DOORWAY.w, H = DOORWAY.h;
  const side = new THREE.BoxGeometry(J, H + J, 0.07);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(side, doorTrim); m.position.set(s * (W + J) / 2, (H + J) / 2, 0.035); door.add(m); }
  const head = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * J + 0.06, J + 0.02, 0.09), doorTrim);
  head.position.set(0, H + J / 2 + 0.01, 0.045);
  door.add(head);
}
// 門板：鉸鏈在前牆的本地 −x（從店裡看過去是左邊），往店裡開
const doorLeaf = new THREE.Group();
doorLeaf.position.set(-DOORWAY.w / 2, 0, 0.03);
door.add(doorLeaf);
{
  const W = DOORWAY.w - 0.01, H = DOORWAY.h - 0.01, T = 0.045, S = 0.09, low = 0.95;
  const box = (w, h, x, y, mat, d = T) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, 0); doorLeaf.add(m); return m; };
  const cx = W / 2; // 門板的本地座標從鉸鏈算起
  box(W - 2 * S, low - S, cx, S + (low - S) / 2, doorWood, T * 0.7); // 下半的木板
  box(S, H, S / 2, H / 2, doorTrim); box(S, H, W - S / 2, H / 2, doorTrim); // 左右門梃
  box(W, S, cx, S / 2, doorTrim); box(W, S * 0.8, cx, low, doorTrim); box(W, S, cx, H - S / 2, doorTrim); // 下、中、上冒頭
  box(0.035, H - low - S, cx, (low + H - S) / 2, doorTrim, T * 0.8); // 玻璃的直櫺
  box(W - 2 * S, 0.03, cx, (low + H - S) / 2 + 0.02, doorTrim, T * 0.8); // 玻璃的橫櫺
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * S, H - low - S), new THREE.MeshBasicMaterial({ color: '#fff3dc', transparent: true, opacity: 0.16, depthWrite: false }));
  glass.position.set(cx, (low + H - S) / 2, 0.004);
  doorLeaf.add(glass);
  // 把手（店裡那一側，鉸鏈的另一邊）
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.01), brass);
  plate.position.set(W - 0.1, 1.0, T / 2 + 0.005);
  const knob = cyl(0.022, 0.022, 0.05, brass, 12); knob.rotation.x = Math.PI / 2; knob.position.set(W - 0.1, 0.98, T / 2 + 0.03);
  doorLeaf.add(plate, knob);
}
// 門楣上的黃銅小鈴：吊在門開的那一邊，門一推就碰到
const doorBell = new THREE.Group();
doorBell.position.set(DOORWAY.w / 2 - 0.18, DOORWAY.h - 0.02, 0.11);
{
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.09), brass); arm.position.set(0, 0.03, -0.04);
  const string = cyl(0.003, 0.003, 0.08, doorTrim, 6); string.position.y = -0.01;
  const cup = cyl(0.012, 0.038, 0.06, brass, 16, true); cup.position.y = -0.08; cup.material.side = THREE.DoubleSide;
  const clap = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), doorTrim); clap.position.y = -0.11;
  doorBell.add(arm, string, cup, clap);
}
door.add(doorBell);
// 門檻與腳踏墊（地上，不跟前牆一起收起來）
const threshold = new THREE.Mesh(new THREE.BoxGeometry(DOORWAY.w + 2 * DOORWAY.jamb, 0.025, 0.14), new THREE.MeshLambertMaterial({ color: '#a8977f' })); // 磨石子門檻
threshold.position.set(DOORWAY.x, 0.0125, ROOM.d / 2 - 0.07);
scene.add(threshold);
const doorMat = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), lambert(A.tex(A.doorMat())));
doorMat.rotation.x = -Math.PI / 2;
doorMat.position.set(DOORWAY.x, 0.006, ROOM.d / 2 - 0.42);
scene.add(doorMat);
// 俯瞰時前牆收起來：改成一道矮矮的剖面（紅磚＋木壓條），門口那一段留空，看得出客人從哪裡進來
const frontStub = new THREE.Group();
const capWood = new THREE.MeshLambertMaterial({ color: '#9a5a33' }); // 比門框亮、比地板深的木壓條：門口的缺口才看得出來
{
  const SH = 0.45, gap0 = DOORWAY.x - DOORWAY.w / 2 - DOORWAY.jamb, gap1 = DOORWAY.x + DOORWAY.w / 2 + DOORWAY.jamb;
  for (const [x0, x1] of [[-ROOM.w / 2, gap0], [gap1, ROOM.w / 2]]) {
    const w = x1 - x0;
    const brick = new THREE.Mesh(new THREE.BoxGeometry(w, SH, 0.1), lambert(texRepeat(wainscotTex, w, SH)));
    brick.position.set((x0 + x1) / 2, SH / 2, ROOM.d / 2 - 0.05);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.14), capWood);
    cap.position.set((x0 + x1) / 2, SH + 0.015, ROOM.d / 2 - 0.05);
    frontStub.add(brick, cap);
  }
  for (const s of [-1, 1]) { // 門框的兩根柱子，同樣剖到這個高度
    const post = new THREE.Mesh(new THREE.BoxGeometry(DOORWAY.jamb, SH + 0.15, 0.16), doorTrim);
    post.position.set(DOORWAY.x + s * (DOORWAY.w + DOORWAY.jamb) / 2, (SH + 0.15) / 2, ROOM.d / 2 - 0.05);
    frontStub.add(post);
  }
}
scene.add(frontStub);
// 門的動作：open 0～1（1＝開到約 75°），bell 是鈴擺動的幅度，每一格衰減
const doorMotion = { open: 0, want: 0, holdUntil: 0, bell: 0, phase: 0 };
function swingDoor(holdMs = 1600) {
  doorMotion.want = 1;
  doorMotion.holdUntil = performance.now() + holdMs / speedNow();
  doorMotion.bell = Math.max(doorMotion.bell, 0.6);
}
function ringDoorBell(amount = 0.22) { doorMotion.bell = Math.max(doorMotion.bell, amount); }
function updateDoor(dt) {
  const m = doorMotion;
  if (m.want && performance.now() > m.holdUntil) m.want = 0;
  const k = Math.min(1, dt * (m.want ? 2.4 : 1.6) * speedNow());
  m.open += (m.want - m.open) * k;
  doorLeaf.rotation.y = -m.open * 1.3;
  m.phase += dt * 9;
  m.bell *= Math.exp(-dt * 1.4);
  doorBell.rotation.z = Math.sin(m.phase) * m.bell * 0.6;
}
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
const catCanvas = { sleep: A.cat('sleep'), sit: A.cat('sit'), walk: A.cat('walk') };
const cat = paper(catCanvas.sleep, -2.3, -2.9);
cat.userData.art = catCanvas.sleep;
for (const p of [...Object.values(PEOPLE), cat]) p.userData.big = 1; // 俯瞰時放大（faceCamera()）
// 美術評分修正 e：俯瞰時龍眼背後一圈淡淡的暖光：有人提到龍眼（catMentionUntil），或他睡在書架、貓跳台這類高處的時候
// （評審：德叔說「龍眼上了書架」，書架上的貓只有約 15px，幾乎找不到）
const catHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#ffd9a0', transparent: true, depthWrite: false, opacity: 0 }));
catHalo.renderOrder = -1;
catHalo.raycast = () => {}; // 點不到（點龍眼時不擋）
scene.add(catHalo);
let catMentionUntil = 0;
function updateCatHalo(dt) {
  const m = cat.userData.mesh;
  const on = state.mode === 'overview' && cat.visible && (performance.now() < catMentionUntil || m.position.y > 0.9);
  const mat = catHalo.material;
  mat.opacity += ((on ? 0.55 : 0) - mat.opacity) * Math.min(1, dt * 3);
  catHalo.visible = mat.opacity > 0.01;
  if (!catHalo.visible) return;
  const h = tallOf(m);
  catHalo.position.copy(cat.position).setY(m.position.y + h * 0.45);
  catHalo.position.addScaledVector(camFwd, 0.15); // 稍微往後，墊在龍眼後面
  catHalo.scale.setScalar(Math.max(0.75, h * 3.2));
}

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
  back: [[-2.55, -0.85], [0.75, 1.25]], // 溫度計美術評分修正 e 起在 x＝1.0
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
  const half = art.width / A.ppmOf(art) / 2;
  const tall = art.height / A.ppmOf(art) > 1.05; // 比窗台高，才會擋到窗戶與溫度計
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
// 美術評分修正 e：[-2.5, -2.3] 往後、往右一點到 [-2.45, -2.75]：初始擺飾的落地燈放這裡，從窗邊座看過去燈罩原本被畫面左邊切掉
const FREE_SPOTS = [[2.4, 1.6], [-2.45, -2.75], [0.4, -3.5], [2.4, 3.2], [1.2, 3.5], [-0.3, 3.5], [-1.3, -3.4], [0.9, 2.5], [-2.5, 1.4], [0.8, -0.3], [0.3, 0.9], [-0.6, 0.0], [0.2, 2.2], [-0.9, 0.9]];
// 階段 7：靠牆的家具（書櫃、碗櫥、唱機……）先沿三面牆找空位，不再落到店中間；
// 高的東西不放在店中間那幾個點（窗邊座、吧台座看出去的視線上），真的沒地方了才放
const WALL_SPOTS = [[-1.3, -3.6], [0.4, -3.6], [-2.8, 1.5], [2.8, 2.0],
  ...[-2.4, -0.3, 0.6, 2.2].map((x) => [x, -3.6]), ...[-3.3, -2.3, 1.0, 2.4].map((z) => [-2.8, z]), ...[1.2, 2.8, 3.5].map((z) => [2.8, z])];
const MID_SPOTS = new Set(['0.8,-0.3', '0.3,0.9', '-0.6,0', '0.2,2.2', '-0.9,0.9']);
function freeSpot(item, entries) {
  const taken = entries.filter((e) => e.placed);
  const art = artFor(item);
  const half = art.width / A.ppmOf(art) / 2;
  const tall = art.height / A.ppmOf(art) > 1.05;
  const free = (o) => taken.every((e) => {
    const ea = artFor(itemById(e.item));
    const w = ea.width / A.ppmOf(ea) / 2;
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
    // 接正式美術第二批：手繪的落地燈沒有畫光暈（畫師照規格留給程式），燈罩前面加一圈放射狀的暖光，亮的時候才出現
    if (artFor(item).art) {
      const h = p.userData.mesh.geometry.parameters.height;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#ffbf73', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(0, h * 0.89, 0.06);
      halo.scale.setScalar(0.85);
      halo.visible = false;
      p.add(halo);
      p.userData.halo = halo;
    }
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
  if (!state.placing) fitOverview(true); // 俯瞰鏡頭不能切到家具：擺好之後重算（佈置中不動，免得畫面跟著跳）
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
    const art = artFor(item, on);
    setPaper(p, art);
    if (p.userData.halo) p.userData.halo.visible = on;
    // 晚上燈罩自己發亮（手繪的落地燈只有上面燈罩那段發亮，黃銅燈桿不亮）
    const m = p.userData.mesh.material;
    m.emissiveMap = art.art ? lampGlowTex(art) : m.map;
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
// 等客人（承峰 11/3 回饋，D179）：line＝提示列現在的等待句子、approach＝有人快走到門口、quietFrom＝上次有人走進來的時間
const waiting = { line: '', approach: null, quietFrom: 0 };
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
// 右上角溫度膠囊的底色（美術評分修正 b）：20°C 是偏冷的陶土色，越暖越接近琥珀色；白字的對比都在 4.5 以上
const TEMP_COOL = new THREE.Color('#7f5546'), TEMP_WARM = new THREE.Color('#b35f1a');
const tempColor = (t) => '#' + TEMP_COOL.clone().lerp(TEMP_WARM, THREE.MathUtils.clamp((t - 20) / 17, 0, 1)).getHexString();
let drawnTemp = null;
function drawThermo() {
  const t = Math.round(shownTemp * 10) / 10;
  if (t === drawnTemp) return;
  drawnTemp = t;
  thermoMat.map?.dispose();
  thermoMat.map = A.tex(A.thermometer(t));
  thermoMat.needsUpdate = true;
  setLabel($('temp'), t.toFixed(1) + '°C');
  $('temp').style.backgroundColor = tempColor(t);
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
  const lines = done.filter((t) => t.line).map((t) => t.line);
  announce(lines, delay);
  stageNote(done);
  deshuMoment('thermo', 2600).then((ok) => { if (ok && lines.length) deshuMoment('smile', 2600); });
  return done.map((t) => t.id);
}

// 完成一個溫度任務：地點牌下方淡入一張小紙條（任務名稱＋店裡暖了多少），幾秒後淡出（承峰 11/3 試玩回饋 4，D180）。
// 點不到、不擋按鈕與地點牌；同時完成幾個就一張一張來；彈窗（日誌、信、選單）打開時先等它關上
const STAGE_NOTE_MS = 4200;
const stageEl = $('stage-note');
const stageQueue = [];
const stageLog = []; // 測試用：出現過的紙條
let stageBusy = false;
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
function stageNote(tasks) {
  stageQueue.push(...tasks.map(stageNoteText));
  if (!stageBusy) runStageNotes();
}
async function runStageNotes() {
  stageBusy = true;
  await realSleep(300); // 和溫度膠囊亮起來差一點點
  while (stageQueue.length) {
    while (overlayOpen() || sceneHidden()) await realSleep(400);
    const n = stageQueue.shift();
    stageEl.innerHTML = `<b>${esc(n.title)}</b><span>${esc(n.sub)}</span>`;
    stageEl.style.top = `${UI_SPACE.top + 6}px`;
    stageEl.classList.add('show');
    stageLog.push(n);
    await realSleep(STAGE_NOTE_MS);
    stageEl.classList.remove('show');
    await realSleep(900); // 淡出（.7 秒）之後才換下一張
  }
  stageBusy = false;
}
// 紙條在畫面上的範圍（相對 #app）：泡泡與座位標籤避開它；沒有顯示時是 null
function stageRect() {
  if (!stageEl.classList.contains('show')) return null;
  const a = app.getBoundingClientRect(), r = stageEl.getBoundingClientRect();
  return { l: r.left - a.left, t: r.top - a.top, r: r.right - a.left, b: r.bottom - a.top };
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
let lastSaid = null; // 最後一句話（誰、什麼時候）：選項出現時，上面那一行就是這句（美術評分修正 b）
// who：說話的人的紙片，或 'player'（老闆自己說的話，泡泡固定在畫面下方）；name：覆寫泡泡上的名字
// voice：畫外音（說話的人不在店裡，例如視訊裡的主管）：泡泡沒有尾巴、虛線框（美術評分修正 e）
function say(text, ms = 3500, who = deshu, name = null, voice = false) {
  if (!String(text ?? '').trim()) { bubble.classList.remove('show'); return; } // 沒有字的泡泡不畫
  speaker = who;
  // art2b：熟客的場景演到一半、老闆正在看德叔沖（吧台特寫）時，別人開口：先回到座位的視角再轉向他（原本畫面停在吧台，聽得到看不到）
  if (state.scene && state.closeup && state.mode === 'seat' && who !== deshu && who !== 'player' && isPerson(who) && who.visible) { toggleCloseup(); focusP = null; }
  // 對話中（熟客的場景、客人模式的聊天）：說話的人轉進畫面裡
  if (conversing() && state.mode === 'seat' && !state.closeup && who && who !== 'player' && who.visible && isPerson(who) && (who !== focusP || movedSinceLook(who))) lookToward(who, 2.3);
  sayEnds = performance.now() + (ms || 4000);
  bubble.classList.toggle('me', who === 'player');
  bubble.classList.toggle('voice', voice);
  const label = name ?? (who === 'player' ? '你' : nameOf(who));
  bubble.innerHTML = `<b>${label}</b>${esc(text)}`; // 台詞可能帶著玩家自己寫的名字
  if (/龍眼(?!乾)/.test(String(text)) && who !== cat) catMentionUntil = performance.now() + (ms || 4000) + 1500;
  lastSaid = who === 'player' ? null : { name: label, text: String(text), at: performance.now() };
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
// own＝熟客走進來、換位子、走出去：同一個人同時只走一段，新的一段開始時舊的那段馬上結束、回傳 false
// （例如熟客走進來走到一半就打烊，原本走進來和走出去兩段同時推著他，往兩個方向互相抵消，人就停在店中間；
// 美術評分修正 b 的冒煙測試碰到）。德叔與龍眼照舊
let walkSeq = 0;
function walk(p, to, speed = 0.7, own = false) {
  const obs = obstacles(p.position, to);
  let budget = (Math.hypot(to.x - p.position.x, to.z - p.position.z) / speed) * 2 + 3; // 遊戲時間（秒）
  const id = own ? (p.userData.walkId = ++walkSeq) : null;
  return new Promise((r) => {
    waiters.push((dt) => {
      if (own && p.userData.walkId !== id) { r(false); return true; } // 被新的一段取代了
      const d = new THREE.Vector3(to.x - p.position.x, 0, to.z - p.position.z);
      const step = speed * dt * speedNow();
      const dist = d.length();
      if (dist <= step) { p.position.x = to.x; p.position.z = to.z; r(true); return true; }
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
  // 美術評分修正 e：左右翻記在 userData.flip，寬度由 faceCamera() 每一格乘上俯瞰的放大倍率
  await animate(0.35, (k) => { p.userData.flip = 1 - 2 * ease(k); });
  await wait(sec);
  await animate(0.35, (k) => { p.userData.flip = -1 + 2 * ease(k); });
  p.userData.flip = 1;
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
const CLOSE_KIT = { pos: new THREE.Vector3(-0.1, 1.55, -1.7), look: new THREE.Vector3(2.6, 1.41, -1.68), fov: 52 };
// 美術評分修正 d：德叔的沖煮圖自己拿著手沖壺與濾杯，吧台上沒有立體器具：鏡頭拉高往下看、推近一點，
// 吧台正面只剩畫面最下面一條（直立畫面約 11%），德叔的臉在上方約 1/3，吧台上的杯子在他右手邊
const CLOSE_ART = { pos: new THREE.Vector3(0.3, 1.75, -1.55), look: new THREE.Vector3(2.6, 1.24, -1.55), fov: 42 };
const closeView = () => (kitInArt() ? CLOSE_ART : CLOSE_KIT);
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
    stationCup = makeCup('hot', true, true);
    stationCup.position.copy(CUP_SPOT);
    scene.add(stationCup);
  }
  phase = 'brew';
  say(keeper() ? F.KEEPER.brewStart : '好，等我一下。', 2500);
  state.closeup = true;
  cam.yaw = 0; cam.pitch = 0; focusP = null; // 視線回到正前方：下一句話要重新轉向說話的人
  moveCamera(closeView().pos, closeView().look, 1.2);
  updateUI();
  await wait(1.2);

  const cupTop = CUP_SPOT.clone().add(new THREE.Vector3(0, CUP_H, 0));
  const dripTop = brewer.position.clone().add(new THREE.Vector3(0, 0.19, 0));
  const cupSteam = cupTop.clone().add(new THREE.Vector3(0, 0.02, 0));
  const dripSteam = dripTop.clone();
  if (kitInArt()) await brewInArt(cupSteam);
  else await brewWithKit(cupTop, dripTop, cupSteam, dripSteam);
  steamSources.delete(cupSteam);
  steamSources.delete(dripSteam);

  // 6. 端上桌
  phase = 'serve';
  const cup = stationCup;
  const atSeat = () => state.mode === 'seat' && state.seat === seat;
  state.closeup = false;
  if (atSeat()) { cam.yaw = 0; cam.pitch = 0; focusP = null; moveCamera(seat.eye, seat.look); refocusSpeaker(); }
  updateUI();
  const path = [new THREE.Vector3(2.6, 0, 0.6), new THREE.Vector3(1.3, 0, 0.8), seat.serve];
  if (seat.serve) {
    say(keeper() ? F.KEEPER.serveWalk : '好了，我端過去。', 2500);
    deshu.attach(cup);
    cup.position.set(0.32, 0.98, 0.12);
    cup.rotation.set(0, 0, 0);
    const carried = carryCup(cup);
    for (const pt of path) await walk(deshu, pt, WALK);
    deshu.userData.mesh.position.y = 0;
    putDownCup(cup, carried);
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
  stationCup = makeCup('hot', false, true);
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

// 吧台上的立體器具沖（凱文顧店、德叔的圖沒有載到）
async function brewWithKit(cupTop, dripTop, cupSteam, dripSteam) {
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
}

// 美術評分修正 d：德叔的沖煮圖已經拿著手沖壺與濾杯：六個步驟的節奏照舊（時間、聲音、熱氣、杯子），
// 器具不另外畫，改成德叔的小動作——注水時身體微微側傾、磨豆時輕輕晃、繞圈注水時左右慢慢擺；沖到倒進杯子為止都用沖煮圖，不換回站姿
async function brewInArt(cupSteam) {
  const m = deshu.userData.mesh;
  const dripSteam = deshu.position.clone().add(new THREE.Vector3(-0.15, 1.12, -0.03)); // 圖裡濾杯的位置（大約，在他胸前）
  const lean = (to, sec) => { const from = m.rotation.z; return animate(sec, (k) => { m.rotation.z = from + (to - from) * ease(k); }); };
  setPaper(deshu, deshuCanvas.pour);
  // 1. 溫杯：熱水沖進杯子，冒出熱氣
  await lean(0.025, 0.9);
  steamSources.add(cupSteam);
  audio.start('pour');
  await wait(1.6);
  audio.stop('pour');
  await lean(0, 0.7);
  // 2. 磨豆
  await wait(0.3);
  audio.start('grind');
  await animate(3.0, (k) => { m.position.x = Math.sin(k * 90) * 0.006; });
  m.position.x = 0;
  audio.stop('grind');
  await wait(0.3);
  // 3. 悶蒸：少量注水，濾杯冒出熱氣
  await lean(0.025, 0.9);
  audio.start('pour');
  await wait(1.0);
  audio.stop('pour');
  steamSources.add(dripSteam);
  await wait(2.2);
  // 4. 注水：繞小圈，身體跟著左右慢慢擺
  audio.start('pour');
  await animate(4.6, (k) => { m.position.x = Math.sin(k * Math.PI * 6) * 0.012; });
  m.position.x = 0;
  audio.stop('pour');
  await lean(0, 0.7);
  await wait(0.4);
  // 5. 倒進杯子
  stationCup.userData.liquid.visible = true;
  audio.start('pourCup');
  await wait(1.2);
  audio.stop('pourCup');
  steamSources.delete(dripSteam);
  setPaper(deshu, deshuCanvas.idle);
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
  cam.yaw = 0; cam.pitch = 0; focusP = null;
  if (state.closeup) moveCamera(closeView().pos, closeView().look);
  else { moveCamera(state.seat.eye, state.seat.look); refocusSpeaker(); }
  updateUI();
}

/* ---------- 龍眼：睡在窗台、給不給摸、跳上老闆的椅子（src/cat.js） ---------- */
// 美術評分修正 f（Q64，作者：「好，固定吧」）：龍眼在店裡固定睡在後面那扇窗的窗台上，不再依擺飾每天換地方（D71 的店內部分）、
// 也不再自己起來散步。離開窗台的只有劇本、企劃寫到的時候與熟客的場景：跳上老闆剛坐過的椅子（任務 #7）、
// 點太多次走開（可以拒絕互動）、陪熟客（凱文的腿、予安旁邊、最後一晚）、開場德叔介紹他、客人模式聊天時走到兩人前面；
// 這些結束後他回窗台。營業日誌照舊寫他「換到哪裡睡」（劇本的日誌範例），那是老闆不在店裡的日子
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const CAT_WANDER = [V3(-0.9, 0, 3.2), V3(0.9, 0, 0.3), V3(-2.4, 0, 1.2), V3(0.6, 0, -3.3), V3(-0.3, 0, 1.4)]; // 走開、讓位時去的地方
const CAT_SEAT_Y = { window: 0.42, bar: 0.72, sofa: 0.42 }; // 三張椅子的椅面高度
const SILL = { pos: V3(-1.3, 0, -3.84), y: 1.1 }; // 後面那扇窗的窗台右邊（美術評分修正 d 起坐窗邊座時睡這裡）
let catBusy = false;
let catHoldUntil = 0; // 龍眼陪著熟客（跳上凱文的腿、睡在予安旁邊）的時候不回窗台
let catAtHome = false; // 睡在窗台上
let catOnSeat = null; // 跳上了哪張椅子（座位 id）
let catSeatUntil = 0;
const catMood = { taps: [], awayUntil: 0 }; // 點太多次就走開（cat.js 的 petCat）
// 接正式美術：走路的龍眼面向左，往畫面右邊走的時候鏡像（停下來就維持最後的方向，換成別張圖就轉回來）
const catPrev = new THREE.Vector3();
const camRight = new THREE.Vector3();
function flipCat() {
  const facing = cat.userData.art?.facing;
  const dx = cat.position.x - catPrev.x, dz = cat.position.z - catPrev.z;
  catPrev.copy(cat.position);
  if (!facing) { cat.userData.flip = 1; return; }
  if (dx * dx + dz * dz < 1e-8) return;
  camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  const right = dx * camRight.x + dz * camRight.z > 0;
  cat.userData.flip = right === (facing === 'left') ? -1 : 1;
}
// 跳上、跳下：y 是要到的高度
function catHop(y, sec = 0.45) {
  const m = cat.userData.mesh, from = m.position.y;
  return animate(sec, (k) => { m.position.y = from + (y - from) * ease(k) + Math.sin(Math.PI * k) * 0.18; });
}
// 走到某處（在高處就先跳下來），到了再跳上去
async function catGo(to, y = 0, pose = 'sleep', speed = 0.45) {
  catAtHome = false;
  cat.userData.shadow.visible = true;
  setPaper(cat, catCanvas.walk);
  if (cat.userData.mesh.position.y > 0.02) await catHop(0);
  await walk(cat, to, speed);
  cat.userData.mesh.position.y = 0;
  if (y > 0) await catHop(y);
  cat.userData.mesh.position.y = y;
  setPaper(cat, catCanvas[pose]);
}
// 睡在窗台上：地上的影子在窗台下面，收起來
function catSillPose() {
  cat.userData.mesh.position.y = SILL.y;
  setPaper(cat, catCanvas.sleep);
  cat.userData.shadow.visible = false;
  catAtHome = true;
  catOnSeat = null;
}
// 走回窗台、跳上去
async function catHome() {
  if (catBusy || catAtHome) return;
  catBusy = true;
  catOnSeat = null;
  await catGo(SILL.pos, SILL.y, 'sleep', 0.9);
  catBusy = false;
  catSillPose();
}
// 開店時龍眼已經睡在窗台上了
function placeCatAtHome() {
  cat.position.copy(SILL.pos);
  catPrev.copy(SILL.pos);
  catSillPose();
}
// 擺飾換了、換了一天：不在窗台上（也沒在陪人、沒有走開）的話，回窗台
function refreshCat() {
  if (!catBusy && !catHeld() && !catOnSeat) catHome();
}
const catHeld = () => catBusy || performance.now() < catHoldUntil || performance.now() < catMood.awayUntil;
// 陪完熟客、跳上椅子一陣子、走開一陣子之後，回窗台（不再自己起來散步）
setInterval(() => {
  if (catBusy || catAtHome || performance.now() < catHoldUntil || state.scene) return;
  if (catOnSeat) { if (performance.now() > catSeatUntil) catHome(); return; }
  if (performance.now() > catMood.awayUntil) catHome();
}, 6000);

// 美術評分修正 e：有人提到龍眼、畫面卻看不到他的時候（開場德叔介紹龍眼、客人模式熟客聊天），他自己走進畫面裡、坐下來。
// hold：之後幾秒不去散步、不回去睡（時間到了照常由上面的散步回去）。龍眼正忙（陪熟客、走開了）就不叫
let catVisiting = false; // catVisit() 的停留（不是陪熟客）：老闆坐窗邊座時可以中斷（美術評分修正 f）
async function catVisit(pos, hold = 30) {
  if (catBusy || catHeld() || catOnSeat) return;
  catBusy = true;
  catAtHome = false;
  catVisiting = true;
  catHoldUntil = performance.now() + (hold * 1000) / DEV_SPEED;
  await catGo(pos, 0, 'sit', 0.9);
  catBusy = false;
}

// 點龍眼：給摸就呼嚕；點太多次，他就轉身走開，一陣子不理人
function petTheCat() {
  const r = petCat(catMood, performance.now());
  if (r === 'ignore') return;
  if (r === 'purr') {
    say(PURR[Math.floor(Math.random() * PURR.length)], 2500, cat);
    let t = 0;
    realWaiters.push((dt) => { t += dt; cat.userData.squash = 1 - Math.sin(Math.PI * Math.min(1, t / 0.5)) * 0.12; return t >= 0.5; });
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
// 美術評分修正 d：老闆坐窗邊座時，龍眼睡在後面那扇窗的窗台上，窗景和他一起是這個位子的畫面（D130）。
// 美術評分修正 f：窗台就是他平常睡的地方（Q64），通常已經在那裡了；不在的話（剛跳下別張還熱著的椅子、
// 走開後回來的途中），等他手上的事做完（最多 8 秒）再走過來跳上窗台。陪熟客、走開了、正在演熟客場景時不過來
// 開場德叔介紹龍眼、客人模式聊天時走過來坐著（catVisit()）的停留不算：老闆一坐下就回窗台（評審：開場 phone-4 這一格龍眼不在窗台）。
// 他閒著的話，趁鏡頭從俯瞰移下來的途中直接換過去（那時畫面在動，看不出來；美術評分修正 d 的做法）
async function catToSill(seat) {
  await realWait(600);
  const here = () => state.mode === 'seat' && state.seat === seat && !catAtHome;
  if (catVisiting && !state.scene) { catVisiting = false; catHoldUntil = 0; }
  if (!here() || state.scene || performance.now() < catHoldUntil || performance.now() < catMood.awayUntil) return;
  if (!catBusy) { catOnSeat = null; placeCatAtHome(); return; }
  for (let i = 0; catBusy && i < 16; i++) await realWait(500);
  if (!here() || catBusy || catHeld() || state.scene) return;
  catHome();
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
  doorOutside.material.map = doorViewTex(n, state.weather); doorOutside.material.needsUpdate = true;
  // 夜裡（打烊、颱風夜）人物與龍眼帶一點自己的光：站在吊燈前面背光時，才不會只剩一個黑影
  for (const p of [deshu, yuan, zhe, kevin, grandpa, cat]) {
    const m = p.userData.mesh.material;
    m.emissiveMap = m.map;
    m.emissive.set(n ? '#6a5a4c' : '#000000');
    m.needsUpdate = true;
  }
  enamelMat.color.set(n ? '#c4b29e' : wet ? '#e2dbd2' : '#f2ece4'); // 杯子的圖不受光照：夜裡、雨天暗一點，才不會比桌子亮
  cupMat.color.set(n ? '#a89a8a' : wet ? '#ddd5cb' : '#f2ece4'); // 平常的杯子不套色調映射（美術評分修正 f），夜裡要再暗一點才和琺瑯杯差不多
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
// 美術評分修正 c：吧台（含檯面）的八個角；擺飾、德叔、吧台的外框四周留的邊距（px）
const FIT_BAR = [];
for (const x of [1.6, 2.4]) for (const z of [-3.25, 0.25]) for (const y of [0, 1.06]) FIT_BAR.push(new THREE.Vector3(x, y, z));
const FIT_MARGIN = 24;
// 美術評分修正 e：兩扇窗的上緣（窗框高 1.3 公尺、中心 1.75／1.7 公尺）也要在畫面裡（桌機俯瞰原本切掉窗戶頂端）
const FIT_WIN = [V3(-2.5, 2.42, -ROOM.d / 2), V3(-0.9, 2.42, -ROOM.d / 2), V3(-ROOM.w / 2, 2.37, -1.4), V3(-ROOM.w / 2, 2.37, 0.2)];
// 座位標籤的小三角要指在家具和它那張桌子兩者的上緣之上（評審：「窗邊座」「角落沙發」的標籤蓋住桌面）：桌子離鏡頭最遠的那一緣
const seatTops = (st, out = []) => {
  out.length = 0;
  out.push(topPoint(st.prop, new THREE.Vector3()));
  if (st.table) for (const dx of [-0.6, 0, 0.6]) out.push(V3(st.table.x + dx * 0.38, st.table.h + 0.02, st.table.z - 0.38));
  return out;
};
const OVER_DESK_MIN = Number(params.get('overmin')) || 44; // art2b：桌機俯瞰最低的仰角
const WALL_SINK = 0.5; // 房間被寬度卡住時，後牆上緣最多可以往下沉到可用高度的一半（空白留在頂部介面那一帶，不留在提示上面）
// 圖真正畫到的地方離中線多遠（圖寬的比例，0～0.5）：從透明度量，每張圖只量一次；量不到（換成跨網域的圖檔等）就當作整張
const drawnCache = new WeakMap();
function drawnHalf(img) {
  img = img?.canvas || img; // 手繪圖的材質是 ImageData，量回它的 canvas
  if (!img) return 0.5;
  if (drawnCache.has(img)) return drawnCache.get(img);
  let r = 0.5;
  try {
    const W = img.width, H = img.height, step = Math.max(1, Math.round(W / 160));
    const c = document.createElement('canvas'); c.width = Math.ceil(W / step); c.height = Math.ceil(H / step);
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let m = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) m = Math.max(m, Math.abs(x + 0.5 - c.width / 2));
    r = Math.min(0.5, m / c.width + 0.01);
  } catch { /* 讀不到像素：整張 */ }
  drawnCache.set(img, r);
  return r;
}
// 介面佔用的像素：top＝頂部介面最下緣（measureUi() 量），bottom＝底部按鈕列＋一行提示；labelH＝座位標籤（含小三角）的高度
const UI_SPACE = { top: 64, bottom: 112, labelW: 48, labelH: 44 };
const UI_GAP = 8; // 泡泡、標籤和頂部介面之間至少留的距離
// 量頂部介面的最下緣（相對於 #app）；變了就回傳 true
function measureUi() {
  const a = app.getBoundingClientRect();
  let top = 0;
  for (const el of document.querySelectorAll('.top')) { // 快轉併進右上角、「略過開場」移到底部按鈕列之後，頂部只剩一列
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
// 美術評分修正 d：俯瞰時紙片會往後仰、拉長（faceCamera()），上緣的高度跟著算
const tallOf = (m) => m.geometry.parameters.height * m.scale.y * Math.cos(m.rotation.x);
const propTop = (p) => tallOf(p.userData.mesh) + p.userData.mesh.position.y;
// 紙片上緣中點在世界座標的位置（含後仰）
const topPoint = (p, out) => out.set(0, p.userData.mesh.geometry.parameters.height, 0).applyMatrix4(p.userData.mesh.matrixWorld);
function fitOverview(smooth = false) {
  const w = app.clientWidth, h = app.clientHeight;
  if (!w || !h) return;
  measureUi();
  const probe = new THREE.PerspectiveCamera(50, w / h, 0.05, 80);
  const v = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
  const top = 1 - (2 * (UI_SPACE.top + UI_GAP)) / h, bottom = -1 + (2 * UI_SPACE.bottom) / h;
  const labelUp = (2 * (UI_SPACE.labelH + 10)) / h, labelSide = 1 - (2 * UI_SPACE.labelW) / w;
  const mx = (2 * FIT_MARGIN) / w, my = (2 * FIT_MARGIN) / h;
  const pts = [...FIT_ROOM];
  for (const st of SEATS) pts.push(st.prop.position.clone(), st.prop.position.clone().setY(propTop(st.prop)));
  // 擺出來的家具也要完整（美術評分修正 b：地板靠鏡頭的角可以多切一點，但不能切到東西）
  const props = [...SEATS.map((st) => st.prop), ...decorPapers.values()];
  const look = new THREE.Vector3();
  const fl = [0, 1, 3, 2].map(() => new THREE.Vector3()); // 地板四個角（繞一圈）在畫面上的位置
  const tops = [];
  // 線段 a–b 在畫面裡（|x| ≤ 1）那一段的 y 範圍，併進 r＝[最低, 最高]
  const clipY = (a, b, r) => {
    for (const [p, q] of [[a, b], [b, a]]) {
      let y = p.y;
      if (Math.abs(p.x) > 1) {
        const edge = Math.sign(p.x);
        if ((q.x - edge) * edge > 0 || q.x === p.x) continue; // 整條邊都在同一側的畫面外
        y = p.y + ((edge - p.x) / (q.x - p.x)) * (q.y - p.y);
      }
      r[0] = Math.min(r[0], y); r[1] = Math.max(r[1], y);
    }
    return r;
  };
  const wall = [new THREE.Vector3(), new THREE.Vector3()];
  // 地板在畫面裡看得到的部分，最低與最高的 y：切到畫面外的角不算，房間才會往下填滿
  const floorSpan = () => {
    [0, 1, 3, 2].forEach((k, i) => fl[i].copy(FIT_ROOM[k]).project(probe));
    const r = [Infinity, -Infinity];
    for (let i = 0; i < 4; i++) clipY(fl[i], fl[(i + 1) % 4], r);
    return r;
  };
  // 後牆上緣在畫面裡看得到的那一段（兩端的牆角切到畫面外時，用切到的地方）
  const wallTop = (y = 2.1) => {
    wall[0].copy(FIT_ROOM[4]).setY(y).project(probe); wall[1].copy(FIT_ROOM[5]).setY(y).project(probe);
    return clipY(wall[0], wall[1], [Infinity, -Infinity]);
  };
  // 放好鏡頭（仰角 e、距離 d），把整間店在可用範圍裡垂直置中；回傳是否放得下與房間的高度（NDC）
  const place = (e, d, yaw = OVER_BASE.yaw) => {
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(e), Math.sin(e), Math.cos(yaw) * Math.cos(e));
    look.copy(OVER_BASE.look);
    let lo = 0, hi = 0, ok = true;
    for (let it = 0; it < 4; it++) {
      probe.position.copy(look).addScaledVector(dir, d);
      probe.lookAt(look);
      probe.updateMatrixWorld();
      lo = Infinity; hi = -Infinity; ok = true;
      let sL = Infinity, sR = Infinity; // 左右各還剩多少空間（NDC）：美術評分修正 c 用來左右置中
      const lim = (x, L) => { if (Math.abs(x) > L) ok = false; sL = Math.min(sL, x + L); sR = Math.min(sR, L - x); };
      pts.forEach((p, i) => {
        v.copy(p).project(probe);
        // 地板靠鏡頭的兩個角是空地板：可以切掉一些（上下的範圍改用畫面裡看得到的地板）；
        // 後面的牆角（空牆、空地板）可以切一點點；座位與家具（下面的 props）一定完整在畫面裡
        if (FIT_FRONT.includes(i)) { lim(v.x, 1.4); return; }
        lim(v.x, i < 4 ? 1.12 : i < 6 ? 1.16 : 0.96);
        if (i < 6) return; // 地板與後牆：上下的範圍用畫面裡看得到的那一段（下面）
        lo = Math.min(lo, v.y); hi = Math.max(hi, v.y);
      });
      const [f0, f1] = floorSpan(), [, w1] = wallTop();
      // 美術評分修正 e：桌機的地板靠鏡頭的那一緣可以伸到按鈕列底下、一直到畫面最下面（原本停在按鈕列上面，下面留一條約 110px 的米色空帶）；
      // 座位、家具、德叔照舊要在按鈕列上面
      // （直立的手機畫面被寬度卡住，往下伸只會把空白移到上面，照舊停在按鈕列上面）
      lo = Math.min(lo, f0 + (desk ? bottom + 1 : 0)); hi = Math.max(hi, f1, w1);
      right.set(1, 0, 0).applyQuaternion(probe.quaternion);
      SEATS.forEach((st, i) => { // 座位：整張圖（含留白）都在畫面裡
        const half = st.prop.userData.mesh.geometry.parameters.width / 2;
        for (const sgn of [-1, 1]) {
          v.copy(st.prop.position).addScaledVector(right, sgn * half).project(probe);
          lim(v.x, 0.97);
        }
      });
      // 擺飾：圖的四周有留白，畫出來的部分（drawnHalf() 量的）的外框在畫面裡；
      // 美術評分修正 c：德叔與吧台也算進來（原本德叔和吧台會被畫面右邊切掉），外框四周再留約 24px
      const keep = (p, sx, sy) => {
        lim(p.x, 1 - sx);
        lo = Math.min(lo, p.y - sy); hi = Math.max(hi, p.y + sy);
      };
      for (const pr of [...props.slice(SEATS.length), deshu]) {
        const big = pr.userData.big ? OVER_BIG / pr.userData.big : 1; // 德叔俯瞰時放大（美術評分修正 e）
        const half = big * pr.userData.mesh.geometry.parameters.width * drawnHalf(pr === deshu ? deshuCanvas.idle : pr.userData.mesh.material.map?.image);
        const at = pr === deshu ? HOME : pr.position;
        for (const sgn of [-1, 1]) for (const y of [0, propTop(pr) * big]) keep(v.copy(at).setY(y).addScaledVector(right, sgn * half).project(probe), mx, my);
      }
      for (const p of FIT_BAR) keep(v.copy(p).project(probe), mx, my);
      for (const p of FIT_WIN) keep(v.copy(p).project(probe), 0, my);
      for (const st of SEATS) {
        v.copy(st.prop.position).setY(propTop(st.prop)).project(probe);
        lim(v.x, labelSide);
        for (const q of seatTops(st, tops)) { v.copy(q).project(probe); hi = Math.max(hi, v.y + labelUp); }
      }
      if (it === 3) break;
      // 往上下平移：房間（含標籤）放得下時往下靠，地板貼近按鈕列上面的提示（美術評分修正 b：直立畫面下面不留白），
      // 上面多出來的是後牆 2.1 公尺以上的牆面；牆真正的上緣原本不能掉到頂部介面下面，美術評分修正 c 起可以往下沉一些（WALL_SINK）：
      // 德叔、吧台與擺飾都要完整之後房間常被寬度卡住，空白留在頂部介面與泡泡那一帶，比留在提示上面好。放不下就置中
      const [, wallEdge] = wallTop(ROOM.h);
      const fits = hi - lo <= top - bottom;
      const move = fits ? Math.max(Math.min(lo - bottom, wallEdge - top + WALL_SINK * (top - bottom)), hi - top) : (lo + hi) / 2 - (top + bottom) / 2; // 正的＝房間往下
      const shift = move * d * Math.tan(THREE.MathUtils.degToRad(25));
      up.set(0, 1, 0).applyQuaternion(probe.quaternion);
      look.addScaledVector(up, shift);
      // 左右平移：兩邊剩下的空間一樣多（原本只上下移動，靠右牆的擺飾、德叔卡住寬度時，左邊還空著一塊）
      look.addScaledVector(right, ((sL - sR) / 2) * d * Math.tan(THREE.MathUtils.degToRad(25)) * (w / h));
    }
    // 房間看起來多大：畫面裡看得到的地板有多高
    const [f0, f1] = floorSpan();
    return { ok: ok && hi <= top + 0.01 && lo >= bottom - 0.01, span: f1 - f0, dir };
  };
  // 仰角 58°～66°、水平方向在原本的角度左右 8° 以內，挑地板看起來最高的（直立畫面原本被寬度卡住，下面留一塊空白）
  // art2b：桌機（場景欄比直式寬，CSS 的 @media (min-aspect-ratio: 3/5)）的俯瞰角色太小（評審：約 20px）：仰角放低到 OVER_DESK_MIN，
  // 改挑德叔畫出來最高的角度（地板變扁、站著的紙片變高）。手機照舊挑地板最高的
  const desk = innerWidth / innerHeight >= 3 / 5;
  const tall = new THREE.Vector3(), feet = new THREE.Vector3();
  const deshuPx = () => { feet.copy(HOME).project(probe); tall.copy(HOME).setY(1.67).project(probe); return tall.y - feet.y; };
  let best = null;
  for (let deg = desk ? OVER_DESK_MIN : 58; deg <= 74; deg += 2) for (let yd = -8; yd <= 8; yd += 4) {
    const e = THREE.MathUtils.degToRad(deg), yaw = OVER_BASE.yaw + THREE.MathUtils.degToRad(yd);
    let lo = 6, hi = 60;
    for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (place(e, mid, yaw).ok) hi = mid; else lo = mid; }
    const r = place(e, hi, yaw);
    if (desk) r.span = deshuPx();
    if (r.ok && (!best || r.span > best.span + (desk ? 0.002 : 0.02))) best = { deg, yd, span: r.span, pos: look.clone().addScaledVector(r.dir, hi), look: look.clone() };
  }
  if (!best) return;
  OVER.deg = best.deg;
  OVER.yd = best.yd;
  OVER.pos.copy(best.pos);
  OVER.look.copy(best.look);
  if (state.mode === 'overview' && !tween) {
    if (smooth) moveCamera(OVER.pos, OVER.look, 1.0);
    else { cam.pos.copy(OVER.pos); cam.look.copy(OVER.look); }
  }
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
  const targetFov = state.mode === 'overview' ? 50 : state.closeup ? closeView().fov : state.focus ? focusFov : seatFov();
  // 推近跟著開發者模式的倍率（和轉向說話的人一樣）；一般玩家的倍率是 1，沒有差別
  if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3 * DEV_SPEED); camera.updateProjectionMatrix(); }
  if (state.mode === 'overview') {
    const off = cam.pos.clone().sub(OVER.look).applyAxisAngle(new THREE.Vector3(0, 1, 0), cam.yaw);
    camera.position.copy(OVER.look).add(off);
    camera.lookAt(cam.look);
  } else {
    camera.position.copy(cam.pos);
    const dir = cam.look.clone().sub(cam.pos);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cam.yaw);
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    dir.applyAxisAngle(side, cam.pitch + barTilt());
    camera.lookAt(cam.pos.clone().add(dir));
  }
}

// 美術評分修正 f：吧台座往左轉頭看凱文（他坐在最裡面那張高腳椅，比站著的德叔低）時，鏡頭跟著往下壓約 9°：
// 他的高腳椅和腳露在提示條上方、上半部的空牆收掉（評審：凱文太低、凳子被按鈕列蓋住、上半部約一半是空牆）。
// 轉向說話的人、演熟客場景、看德叔沖的時候不壓（那些鏡頭自己算好角度）
function barTilt() {
  if (state.mode !== 'seat' || state.seat?.id !== 'bar' || state.closeup || state.scene || focusP) return 0;
  return -0.16 * THREE.MathUtils.smoothstep(cam.yaw, 0.35, 0.85);
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
  if (seat.id === 'window') catToSill(seat);
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
  // 美術評分修正 e：坐著的時候燈多半不在畫面裡（原本「開燈」被擠到畫面左側中段）：改成底部按鈕列的一顆，一次開或關一盞
  lightsEl.style.display = after && !placing && free && over ? '' : 'none';
  show('lights-btn', after && !placing && free && !over);
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
  const hint = choosing ? '' // 選項的問句在選項上面那一行（#ask）
    : film ? S.sceneHint(state.scene) // 熟客的場景沒有按鈕時的提示（颱風夜也顯示）
    : letter ? '德叔把一封信放在吧台上' // 【待定】
    : tut === 'sit' || g === 'sit' ? '點一張椅子坐下'
    : tut === 'gift' || tut === 'choose' ? ''
    : cl && !brewing && !placing ? ''
    : !over
    ? (brewing ? (state.hold ? '時間走快了一點……' : '按住畫面可以讓時間走快一點') : g ? '' : waiting.line || '左右拖曳環顧四周，點人物可以搭話')
    : !placing ? (waiting.approach ? S.WAIT_HINT.approach : '點座位坐下，用客人的角度看看這間店')
    : sel ? `已選：${state.selected.userData.name}，點地板放到那裡`
    : placingHint();
  $('hint').textContent = hint;
  $('hint').hidden = !hint;
  // 熟客場景的提示與等待的句子：提示列慢慢呼吸，看得出畫面沒有停住（承峰 11/3 回饋，D179）
  $('hint').classList.toggle('breathe', !!hint && (hint === S.SCENE_HINT || Object.values(S.WAIT_HINT).includes(hint)));
  refreshAsk(choosing);
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
  refreshCat();
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
  if (coffees.length > 1) bean = coffees[await choose(coffees.map((id) => S.MENU[id].name), '今天想喝哪一支豆子？', keeper() ? '凱文' : '德叔')];
  if (!brewing && state.seat) brew(state.seat, bean);
};

// 畫面下方的選項（≥ 44px）：回傳選了第幾個
// 選項上面一行是問句（美術評分修正 b）：有 prompt 就用 prompt（asker 是問的人的名字，空字串＝旁白），
// 沒有的話用剛剛說的那句話（例如凱文問「你當初怎麼敢辭職的？」），泡泡先收起來，免得同一句出現兩次
function choose(options, prompt = '', asker = '') {
  return new Promise((resolve) => {
    const box = $('choices');
    box.innerHTML = '';
    options.forEach((text, i) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = () => { state.choice = false; state.choiceAsk = null; box.innerHTML = ''; updateUI(); resolve(i); };
      box.appendChild(b);
    });
    const recent = lastSaid && performance.now() - lastSaid.at < 20000 ? lastSaid : null;
    state.choiceAsk = prompt ? { name: asker, text: prompt } : recent;
    bubble.classList.remove('show');
    state.choice = true;
    updateUI();
  });
}
// 選項的問句與後面的漸層：漸層從問句（或第一個選項）上面一點開始，蓋到畫面底
function refreshAsk(choosing) {
  const ask = $('ask'), a = choosing ? state.choiceAsk : null;
  ask.hidden = !a;
  if (a) ask.innerHTML = `${a.name ? `<b>${esc(a.name)}</b>` : ''}${esc(a.text)}`;
  app.classList.toggle('choosing', choosing); // 選項出現時泡泡馬上收起來（不等淡出），問句只出現在選項上面那一行
  const shade = $('shade');
  shade.classList.toggle('on', choosing);
  if (choosing) {
    const top = (a ? ask : $('choices')).getBoundingClientRect().top - app.getBoundingClientRect().top;
    shade.style.setProperty('--shade-h', `${Math.max(0, Math.round(app.clientHeight - top + 56))}px`);
  }
}
$('night').onclick = () => { state.night = !state.night; applyLight(); };
// 測試用的快轉鈕只在開發者模式出現
// 併進右上角之後只寫倍率（桌機的直式畫面只有約 330px 寬）；完整的說明在 aria-label
const speedLabel = () => `×${state.devSpeed}`;
$('speed').setAttribute('aria-label', '快轉（開發者）');
$('speed').hidden = !DEV;
setLabel($('speed'), speedLabel());
$('speed').onclick = () => {
  state.devSpeed = state.devSpeed === 1 ? (DEV_SPEED > 1 ? DEV_SPEED : 4) : 1;
  setLabel($('speed'), speedLabel());
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
const yawRange = () => [-1.2, 1.2]; // 坐著時左右轉頭的範圍（弧度）
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: cam.yaw, pitch: cam.pitch, held: brewing };
  setHold(true);
});
for (const ev of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(ev, () => setHold(false));
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (state.mode === 'seat') {
    cam.yaw = THREE.MathUtils.clamp(down.yaw + dx * 0.004, ...yawRange());
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
  img = img?.canvas || img;
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
  const h = tallOf(m);
  const fixed = HEAD.get(p);
  return (fixed !== undefined ? fixed * (p.userData.big ?? 1) : h * (1 - inkTop(m.material.map?.image)) + 0.06) + m.position.y; // 龍眼睡在書架上、椅子上時泡泡跟著高
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
  catVisit(V3(1.45, 0, 0.55), 25); // 美術評分修正 e：德叔說「那隻貓叫龍眼」的時候，龍眼走到吧台前面坐下（畫面下方原本是空的地板）
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
// 避頭點（美術評分修正 b）：每個字各自是一個 inline-block，瀏覽器的 line-break 管不到，
// 所以句號、逗號、後引號這類不能放在行首的字，和前一個字包在一起；前引號和後一個字包在一起
const NO_START = new Set([...'，。、；：！？」』）〉》…—,.!?']);
const NO_END = new Set([...'「『（〈《']);
function shaky(text, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const groups = [];
  let glue = false;
  for (const ch of text) {
    if (groups.length && (glue || NO_START.has(ch))) groups[groups.length - 1].push(ch);
    else groups.push([ch]);
    glue = NO_END.has(ch);
  }
  const one = (ch) => `<i style="transform:rotate(${((r() - 0.5) * 5).toFixed(1)}deg) translateY(${((r() - 0.5) * 1.6).toFixed(1)}px)">${ch}</i>`;
  return groups.map((g) => (g.length === 1 ? one(g[0]) : `<span class="nb">${g.map(one).join('')}</span>`)).join('');
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
// 彈窗打開時，場景上的標籤、提示、泡泡、按鈕列都收起來（index.html 的 #app.modal；美術評分修正 b）。
// 任何彈窗的 hidden 一變就馬上切換，不等下一格
const syncModal = () => app.classList.toggle('modal', overlayOpen());
const modalWatch = new MutationObserver(syncModal);
for (const el of [about, notebook, sheet, journalEl, letterEl, $('opening'), $('diary'), $('closed'), $('map')]) modalWatch.observe(el, { attributes: true, attributeFilter: ['hidden'] });
syncModal();
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
seatOf = (w) => (live.at[w]?.stool ? 'stool' : 'chair');
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
// 走完回傳 true；中途被新的一段取代就停下來、回傳 false
async function walkPath(p, pts, speed, own = false) {
  for (const pt of pts) if (!(await walk(p, pt, speed, own))) return false;
  p.userData.mesh.position.y = 0;
  return true;
}
function settle(w, spot) {
  if (live.at[w]?.stool) live.at[w].stool.visible = true;
  live.at[w] = spot;
  if (spot.stool) spot.stool.visible = false;
  PEOPLE[w].position.set(spot.pos.x, 0, spot.pos.z);
}
function placeAt(w, spot, pose) {
  settle(w, spot); // 先坐定位，setPose 才知道他坐的是高腳椅還是椅子
  setPose(w, pose || defaultPose(w));
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
  swingDoor(w === 'grandpa' ? 3200 : 1600); // 阿公走得慢：門開久一點
  waiting.approach = null; waiting.quietFrom = performance.now();
  if (!(await walkPath(p, route(DOOR_IN, spot.pos), walkSpeed(w, fast), true))) return; // 走到一半就要離開了（打烊）
  if (tok !== live.token) return; // 走到一半換了一天（開發者跳天數）
  settle(w, spot);
  setPose(w, thenPose || defaultPose(w));
}
async function movePerson(w, spot, walkPose, thenPose) {
  const p = PEOPLE[w];
  if (live.at[w]?.stool) live.at[w].stool.visible = true;
  const tok = live.token;
  if (walkPose) setPose(w, walkPose);
  if (!(await walkPath(p, route(p.position, spot.pos), walkSpeed(w), true))) return;
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
  setPose(w, w === 'kevin' ? 'walk' : w === 'grandpa' || w === 'yuan' ? 'stand' : poses[w]); // 予安站起來走（Canvas 版站著與坐著是同一張）
  const tok = live.token;
  const out = await walkPath(p, route(p.position, DOOR_IN), walkSpeed(w), true);
  if (out && tok === live.token) { p.visible = false; swingDoor(1000); if (w !== 'grandpa') audio.play('bell'); }
}
function removeGuestCup(w) {
  const c = live.cups.get(w);
  if (!c) return;
  c.parent?.remove(c);
  const i = cups.indexOf(c);
  if (i >= 0) cups.splice(i, 1);
  live.cups.delete(w);
}

// 接正式美術：德叔端杯子走過去時換成 serve 的圖（圖裡手上已經端著杯子），立體的杯子先藏起來；
// 到了再從圖裡杯子的位置拿出來放下。Canvas 版與凱文顧店時沒有這張圖（cupAt），照舊拿著立體的杯子走
function carryCup(cup) {
  const c = deshuCanvas.serve;
  if (!c.cupAt) return false;
  setPaper(deshu, c);
  cup.visible = false;
  return true;
}
function putDownCup(cup, carried) {
  if (!carried) return;
  const [x, y] = deshuCanvas.serve.cupAt;
  cup.position.set(x, y, 0.08);
  cup.visible = true;
  setPaper(deshu, deshuCanvas.idle);
}
// 德叔站在吧台後面、沒在做事的時候的小動作：溫度升高時拿起老溫度計看一眼、任務完成的那句話時笑一下（只有手繪圖有這兩張）
async function deshuMoment(pose, ms) {
  const c = deshuCanvas[pose];
  if (!c?.art || keeper() || brewing || wipeOn || state.cinematic || state.scene) return false;
  if (deshu.userData.art !== deshuCanvas.idle || deshu.position.distanceTo(HOME) > 0.05) return false;
  setPaper(deshu, c);
  await realWait(ms);
  if (deshu.userData.art !== c) return false; // 中途有別的動作換過圖了
  setPaper(deshu, deshuCanvas.idle);
  return true;
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
  if (spot?.counter) return V2(2.5, behindBarZ(PEOPLE[w], pos.z));
  return V2(THREE.MathUtils.clamp(pos.x + (pos.x < 0.45 ? 0.5 : -0.5), -2.7, 2.7), THREE.MathUtils.clamp(pos.z + 0.12, -3.7, 3.6));
}

// art2b：吧台前的人，德叔從吧台裡面走到他對面時，在吧台裡錯開一點（評審：颱風夜阿哲正好站在德叔前面，看起來像一個雙頭人）。
// 從現在的鏡頭看過去，兩個人畫出來的範圍（左右）不能重疊：在吧台裡面（z −3.0～0）找離那個人最近、又不重疊的位置；
// 怎麼放都重疊時，挑分得最開的
const barProbe = new THREE.Vector3();
function behindBarZ(p, z) {
  camera.updateMatrixWorld();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const span = (x, zz, half) => {
    const xs = [-1, 1].map((sg) => { barProbe.set(x, 1.0, zz).addScaledVector(right, sg * half).project(camera); return barProbe.x; });
    return [Math.min(...xs), Math.max(...xs)];
  };
  const halfOf = (q) => q.userData.mesh.geometry.parameters.width * drawnHalf(q.userData.mesh.material.map?.image);
  const [a0, a1] = span(p.position.x, p.position.z, halfOf(p) * 0.85);
  const dh = halfOf(deshu) * 0.85;
  let best = z, bestGap = -Infinity;
  for (let k = 0; k <= 12; k++) for (const sg of k ? [-1, 1] : [1]) {
    const zz = z + sg * k * 0.1;
    if (zz < -3.0 || zz > 0) continue;
    const [b0, b1] = span(2.5, zz, dh);
    const gap = Math.max(b0 - a1, a0 - b1); // 正的＝分開了多少（NDC）
    if (gap > 0.04) return zz;
    if (gap > bestGap) { bestGap = gap; best = zz; }
  }
  return best;
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
  const carried = carryCup(cup);
  await deshuGo(nearSpot(w));
  deshu.userData.mesh.position.y = 0;
  putDownCup(cup, carried);
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
  catVisiting = false; // 陪熟客的停留，老闆坐窗邊座也不中斷
  const p = PEOPLE[w];
  const toCam = V2(camera.position.x - p.position.x, camera.position.z - p.position.z).setLength(lap ? 0.14 : 0.45);
  const target = p.position.clone().add(toCam);
  setPaper(cat, catCanvas.walk);
  cat.userData.shadow.visible = true;
  if (cat.userData.mesh.position.y > 0.02) await catHop(0); // 睡在窗台上、椅子上的話，先跳下來
  cat.userData.mesh.position.y = 0;
  await walk(cat, target, 0.6);
  if (lap) { setPaper(cat, catCanvas.sit); await animate(0.4, (k) => { cat.userData.mesh.position.y = 0.48 * ease(k) + Math.sin(Math.PI * k) * 0.12; }); }
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
const seatFov = () => state.seat?.fov || SEAT_FOV; // 美術評分修正 c：座位可以有自己的視角（推近一點，桌子少一點）
// 美術評分修正 c：說話的人離得遠時再推近一點，身高（地板到頭頂）至少占畫面約 35%（評審：凱文第二幕凱文太小）；最多推到 30°
let focusFov = FOCUS_FOV;
const SPEAKER_SHARE = 0.52, FOCUS_FOV_MIN = 30; // 0.52：headOf() 算到泡泡的位置、比畫出來的頭頂高，實測畫面上約 37%
const FACE_DROP = 0.2; // 臉的中心在頭頂（headOf）往下多少
let focusP = null;
let focusAlso = null; // 和說話的人一起入鏡的另一位（美術評分修正 e）：前景淡出時不算他
// art2b：轉向說話的人時他站在哪裡；同一個人走開了（德叔說完「我端過去」走到桌邊才說下一句），下一句要重新轉過去
const focusAt = new THREE.Vector3();
const movedSinceLook = (p) => p.position.distanceTo(focusAt) > 0.8;
let lookTok = 0, turnTok = 0; // turnTok：正在轉向的那一次（轉完是 0；開發者模式的 camStill 用）
const isPerson = (p) => p === cat || Object.values(PEOPLE).includes(p);
const conversing = () => !!state.scene || (!!state.guest && state.guest !== 'enter' && state.guest !== 'sit'); // 客人模式：坐下之後的點單、上桌、聊天
// also：一起入鏡的另一個人（客人模式聊天的兩位熟客）：鏡頭對著兩人的中間，視角放到兩人都完整、腳底貼近畫面下緣、頭上留給泡泡
const PAIR_HALF = 0.32; // 一個人畫出來的半寬（公尺）
const PAIR_HEADROOM = 0.3, PAIR_FOOT = 0.04; // 頭頂以上留畫面高度的 30%（泡泡與頂部介面），腳底以下留 4%
function pairView(s, list) {
  const b = s.look.clone().sub(s.eye), base = Math.atan2(b.x, b.z), basePitch = Math.atan2(b.y, Math.hypot(b.x, b.z));
  let a0 = Infinity, a1 = -Infinity, top = -Infinity, bot = Infinity;
  // 龍眼坐在兩人旁邊（catVisit()）的話也一起入鏡
  const near = cat.visible && cat.userData.mesh.position.y < 0.05 && list.some((q) => q.position.distanceTo(cat.position) < 1.5);
  for (const q of near ? [...list, cat] : list) {
    const t = q.position.clone().sub(s.eye), dist = Math.hypot(t.x, t.z);
    const a = wrapAngle(Math.atan2(t.x, t.z) - base), w = Math.atan((q === cat ? 0.25 : PAIR_HALF) / dist);
    a0 = Math.min(a0, a - w); a1 = Math.max(a1, a + w);
    if (q !== cat) top = Math.max(top, Math.atan2(q.position.y + headOf(q) - s.eye.y, dist));
    bot = Math.min(bot, Math.atan2(-s.eye.y, dist));
  }
  const aspect = camera.aspect;
  let F = (top - bot) / (1 - PAIR_HEADROOM - PAIR_FOOT);
  const needH = (a1 - a0) / 2 + 0.03;
  const vForH = 2 * Math.atan(Math.tan(needH) / aspect);
  F = THREE.MathUtils.clamp(Math.max(F, vForH), THREE.MathUtils.degToRad(FOCUS_FOV_MIN), THREE.MathUtils.degToRad(75));
  // 頭頂貼在留白線上的仰角與腳底貼在下緣的仰角；寬度卡住、視角放大時兩者之間都可以，取中間
  const pitch = ((top + PAIR_HEADROOM * F - F / 2) + (bot + F / 2 - PAIR_FOOT * F)) / 2;
  return { yaw: (a0 + a1) / 2, pitch: THREE.MathUtils.clamp(pitch - basePitch, -0.6, 0.5), fov: THREE.MathUtils.radToDeg(F) };
}
function lookToward(p, max = 1.2, also = null) {
  if (state.mode !== 'seat' || !state.seat || p === undefined) return;
  const s = state.seat;
  const person = !!p && isPerson(p);
  focusP = person ? p : null;
  if (person) focusAt.copy(p.position);
  if (person && conversing()) state.focus = true;
  $('vignette').classList.toggle('on', !!state.focus && !state.closeup);
  const b = s.look.clone().sub(s.eye), t = p ? p.position.clone().sub(s.eye) : b;
  if (person && state.focus) {
    const tall = p.position.y + headOf(p), dist = Math.hypot(t.x, t.z);
    focusFov = THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(Math.atan(tall / (2 * SPEAKER_SHARE * dist))), FOCUS_FOV_MIN, FOCUS_FOV);
  }
  let yaw = THREE.MathUtils.clamp(wrapAngle(Math.atan2(t.x, t.z) - Math.atan2(b.x, b.z)), -max, max);
  let pitch = 0;
  const pair = person && state.focus && also && also.visible && isPerson(also) ? pairView(s, [p, also]) : null;
  focusAlso = null;
  if (pair && Math.abs(pair.yaw) <= max) {
    focusAlso = also;
    focusFov = pair.fov;
    yaw = pair.yaw;
    pitch = pair.pitch;
  } else if (person) {
    const fov = THREE.MathUtils.degToRad(state.focus ? focusFov : seatFov());
    const fy = p.position.y + headOf(p) - FACE_DROP - s.eye.y;
    const want = Math.atan2(fy, Math.hypot(t.x, t.z)) - Math.atan((1 / 3) * Math.tan(fov / 2)); // 臉在畫面上方 1/3
    pitch = THREE.MathUtils.clamp(want - Math.atan2(b.y, Math.hypot(b.x, b.z)), -0.6, 0.5);
  }
  let from = null, fromPitch = 0;
  const my = ++lookTok;
  let k = 0;
  realWaiters.push((dt) => {
    if (my !== lookTok) return true; // 又轉向別人了
    // 鏡頭還在移回座位（例如看完德叔沖、端上桌之後）：等它到了再轉。
    // 轉的角度是相對座位原本的方向算的，移動中先轉，說話的人會被切到畫面邊上（美術評分修正 b：桌機客人模式予安被切掉一半）
    if (tween) return false;
    if (state.mode !== 'seat') return true; // 等的時候站起來了
    if (from === null) { from = cam.yaw; fromPitch = cam.pitch; }
    turnTok = my;
    k = Math.min(1, k + dt * 1.2 * DEV_SPEED);
    if (k >= 1) turnTok = 0;
    cam.yaw = from + (yaw - from) * ease(k);
    cam.pitch = fromPitch + (pitch - fromPitch) * ease(k);
    return k >= 1;
  });
}
// art2b：對話中途看完德叔沖、鏡頭移回座位時，視線回到正前方：正在說話的人（泡泡還在）要再轉回來
// （原本要等下一個人開口才轉；颱風夜阿哲的最後一句，畫面停在窗戶上、泡泡沒有尾巴）。lookToward() 會等鏡頭移完再轉
function refocusSpeaker() {
  if (conversing() && bubble.classList.contains('show') && speaker && speaker !== 'player' && isPerson(speaker) && speaker.visible) lookToward(speaker, 2.3);
}
// 鏡頭移動（例如端上桌之後移回座位）做完：對話的下一句等鏡頭到了再說，說話的人才會在畫面裡（快轉時台詞比鏡頭快很多）
const camSettled = () => new Promise((r) => { const f = () => (tween ? requestAnimationFrame(f) : r()); f(); });
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
const BIG_FG = 1.3; // 前景的人看起來比說話的人大 1.3 倍以上就淡出
function updateOcclusion(dt) {
  // art2b：鏡頭轉向誰（focusP）之外，對話中正在說話的人也算（客人模式德叔端上桌的那句，鏡頭剛移回座位、還沒轉向他）
  const talker = focusP || (conversing() && bubble.classList.contains('show') && speaker && speaker !== 'player' && isPerson(speaker) ? speaker : null);
  const f = state.mode === 'seat' && !state.closeup && talker && talker.visible ? talker : null;
  let face = null;
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  if (f) {
    occ.copy(f.position); occ.y += headOf(f) - FACE_DROP;
    const d = camera.position.distanceTo(occ);
    occ.project(camera);
    if (occ.z < 1) face = { x: occ.x, y: occ.y, d, ry: 0.2 / (d * tanH), rx: 0.16 / (d * tanH * camera.aspect), size: (f.position.y + headOf(f)) / d };
  }
  for (const q of [...Object.values(PEOPLE), cat]) {
    const m = q.userData.mesh, mat = m.material;
    let target = 1;
    if (face && q !== f && q !== focusAlso && q.visible) {
      const prm = m.geometry.parameters;
      occ.copy(q.position); occ.y += m.position.y + prm.height / 2;
      const d = camera.position.distanceTo(occ);
      if (d < face.d - 0.3) {
        occ.project(camera);
        const hx = (prm.width * 0.35) / (d * tanH * camera.aspect), hy = (prm.height * 0.45) / (d * tanH); // 圖的四周有留白：只算中間的身體
        if (occ.z < 1 && Math.abs(occ.x - face.x) < hx + face.rx && Math.abs(occ.y - face.y) < hy + face.ry) target = 0.35;
        // 美術評分修正 c：前景的人在畫面裡、看起來比說話的人大很多（凱文第二幕的予安比凱文大三倍）：整個淡出，說話的人才是焦點
        else if (occ.z < 1 && Math.abs(occ.x) < 1 + hx && Math.abs(occ.y) < 1 + hy && (q.position.y + headOf(q)) / d > BIG_FG * face.size) target = 0;
      }
      // 美術評分修正 e：被畫面左右邊緣切掉一大塊的人（評審：告別第六段德叔在右邊被切掉半張臉）：要嘛完整入鏡、要嘛完全出鏡，淡出
      if (target > 0 && edgeCut(q)) target = 0;
    }
    fadeTo(mat, target, dt);
  }
  // art2b：前景的擺飾與椅子也一樣（評審：桌機客人模式，前景的畫架擋住右邊 1/3 和德叔；高腳椅在畫面正中下方）。
  // 比說話的人近、畫出來的範圍和說話的人左右重疊（擋在中間），或在畫面裡看起來比說話的人高，就淡出（修正 f 以前是 30%）；試擺中的東西本來就是 72%
  let body = null;
  if (face) {
    const r = screenRect(f, 0.8);
    if (r) body = r;
  }
  // 美術評分修正 e：坐著時，緊貼在鏡頭前、上緣只比按鈕列高一點的椅子（吧台座轉頭看凱文時旁邊那張空高腳椅）大半被提示條和按鈕列蓋住：整個淡出
  const uiLine = -1 + (2 * UI_SPACE.bottom) / (app.clientHeight || 1) + 0.25;
  for (const q of occProps()) {
    const mat = q.userData.mesh.material;
    const base = q.userData.entry?.trial ? 0.72 : 1;
    let target = base;
    if (state.mode === 'seat' && !state.closeup && q.visible) {
      const r = screenRect(q, 0.92);
      // 美術評分修正 f：一半以上在按鈕列與提示條底下就算（吧台座看凱文時鏡頭往下壓，前景那張空高腳椅的上緣變高了）
      if (r && r.d < 2.0 && r.x1 > -1 && r.x0 < 1 && (Math.min(uiLine, r.y1) - r.y0) / Math.max(1e-3, r.y1 - r.y0) > 0.5) target = 0;
    }
    if (body && q.visible) {
      const r = screenRect(q, 0.92);
      if (r && r.d < face.d - 0.3 && r.x1 > -1 && r.x0 < 1 && r.y1 > -1 && r.y0 < 1) {
        // 擋在鏡頭和說話的人中間：左右和說話的人重疊（上下不看：吧台前的高腳椅比吧台後的德叔低，但正好在他前面）
        const ox = Math.min(r.x1, body.x1) - Math.max(r.x0, body.x0);
        // 美術評分修正 f：直接淡到看不見（評審：颱風夜阿哲前面停著一張半透明的凳子殘影）
        if (ox > 0.3 * Math.min(r.x1 - r.x0, body.x1 - body.x0) || r.size > face.size) target = 0;
      }
      // 美術評分修正 e：前景被畫面邊緣切掉一大塊的椅子、擺飾（評審：左邊一條深色的椅子弧線）也淡出
      if (r && r.d < face.d - 0.3 && edgeCut(q, r)) target = 0;
    }
    fadeTo(mat, target, dt);
  }
}
// 紙片畫出來的範圍有一部分在畫面左右邊緣外：看得到的部分在 5%～75% 之間（大半在外、或被切掉一大塊）
function edgeCut(q, r = screenRect(q, 0.9)) {
  if (!r || r.x1 - r.x0 < 1e-3) return false;
  const seen = (Math.min(1, r.x1) - Math.max(-1, r.x0)) / (r.x1 - r.x0);
  return (r.x0 < -1 || r.x1 > 1) && seen > 0.05 && seen < 0.75 && r.y1 > -1 && r.y0 < 1;
}
function fadeTo(mat, target, dt) {
  if (Math.abs(mat.opacity - target) < 0.005) return;
  mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
  if (Math.abs(mat.opacity - target) < 0.005) mat.opacity = target;
  mat.alphaTest = mat.opacity < 0.99 ? 0.08 : 0.35;
}
// 會擋到人的擺飾與椅子（老闆自己坐的那張也算：坐吧台時高腳椅就在鏡頭前面；在鏡頭後面的 screenRect() 會略過）
const occProps = () => [...decorPapers.values(), ...SEATS.map((st) => st.prop), stoolMid, stoolFar, yuanChair, noticeSign];
// 紙片畫出來的範圍在畫面上的外框（NDC）、離鏡頭多遠、看起來多高（公尺÷距離）；shrink：外框往內縮一點（圖的邊緣多半是細的椅腳、葉子）
const rectV = new THREE.Vector3(), rectR = new THREE.Vector3();
function screenRect(q, shrink = 1) {
  const m = q.userData.mesh, prm = m.geometry.parameters;
  const img = m.material.map?.image;
  const half = prm.width * drawnHalf(img) * shrink;
  const y0 = q.position.y + m.position.y, y1 = y0 + prm.height * (1 - inkTop(img)) * (shrink < 1 ? 0.96 : 1);
  rectR.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const d = camera.position.distanceTo(rectV.copy(q.position).setY((y0 + y1) / 2));
  let x0 = Infinity, x1 = -Infinity, ya = Infinity, yb = -Infinity;
  for (const sg of [-1, 1]) for (const y of [y0, y1]) {
    rectV.copy(q.position).setY(y).addScaledVector(rectR, sg * half).project(camera);
    if (rectV.z >= 1) return null; // 在鏡頭後面
    x0 = Math.min(x0, rectV.x); x1 = Math.max(x1, rectV.x); ya = Math.min(ya, rectV.y); yb = Math.max(yb, rectV.y);
  }
  return { x0, x1, y0: ya, y1: yb, d, size: (y1 - y0 + Math.max(0, y0)) / d };
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
    // 快轉時泡泡至少留 0.7 秒（下一句會直接換掉）：美術評分修正 c，全流程截圖才拍得到泡泡；一般玩家 DEV_SPEED＝1，沒有差別
    case 'say': { if (state.mode === 'seat') await camSettled(); const ms = sayMs(s.text); // 美術評分修正 e：視訊裡的主管不在店裡：泡泡改成沒有尾巴的「畫外音」樣式（原本尾巴指著凱文）
      say(s.text, Math.max(ms / DEV_SPEED, Math.min(ms, 700)), personOf(s.who), s.name || null, s.who === 'boss');
      return realWait(ms + 450); }
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

/* ---------- 等客人（承峰 11/3 試玩回饋 3，D179） ---------- */
// 「要玩家等，但要等啥沒讓玩家知道，會以為當機了」：熟客快走到門口的前幾秒，門外有腳步聲、門上的鈴輕輕晃，
// 提示列寫「好像有人往這邊走來了……」；坐著、一陣子沒人說話時，提示列換成等待的句子（文字與規則在 story.js 的 waitHint()）。
// 熟客場景裡「什麼都不用做，在這裡就好」（D177）一字不改，只讓提示列慢慢呼吸（index.html 的 .hint.breathe），看得出畫面沒有停住
// 下一位熟客還有幾毫秒走進門（遊戲時間，開發者倍率換算回來）；今天沒有人要來、客人模式、打烊時是 null
function nextArrivalMs() {
  if (!REGULARS_ON || !live.day || live.day !== today() || state.guest || state.closing) return null;
  const t = performance.now();
  let best = null;
  for (const [w, at] of live.expect) {
    if (!Number.isFinite(at)) continue;
    const m = S.nextMilestone(save, w);
    if (m?.entrance && S.isDue(save, m, live.day) && !sceneReady()) continue; // 走進來就是演出的：要等店裡安靜下來，時間說不準
    best = Math.min(best ?? Infinity, Math.max(0, at - t) * DEV_SPEED);
  }
  return best;
}
function waitTick() {
  const next = nextArrivalMs();
  if (next !== null && next <= S.APPROACH_MS && !waiting.approach) {
    waiting.approach = { until: performance.now() + (next + 4000) / DEV_SPEED };
    audio.play('steps');
    ringDoorBell();
  }
  if (waiting.approach && performance.now() > waiting.approach.until) waiting.approach = null;
  const here = PEOPLE_IDS.some((w) => PEOPLE[w].visible);
  const idleMs = (performance.now() - Math.max(state.satAt || 0, sayEnds, waiting.quietFrom)) * DEV_SPEED;
  const line = S.waitHint({ approaching: !!waiting.approach, nextMs: next, idleMs, here });
  if (line !== waiting.line) { waiting.line = line; updateUI(); }
}
setInterval(waitTick, 500);

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
  k.userData.squash = 1.6;
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
  for (const k of DESHU_POSES) deshuCanvas[k] = A.kevinBar(k);
  for (const k of ['a', 'b']) { wipeTex[k]?.dispose(); wipeTex[k] = null; }
  setArt(deshu, deshuCanvas.idle);
  deshu.position.copy(HOME);
  syncBrewKit(); // 凱文的圖沒有手沖器具：吧台上的立體器具拿出來
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
  // art2b：手繪地圖是 SVG（標記由程式畫），沒有載到是 Canvas；第一次打開才做，之後沿用
  if (!$('map-wrap').firstElementChild) $('map-wrap').appendChild(A.coffeeMap('台灣地圖：台南東山亮著一盞燈，花蓮舞鶴待續'));
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
  if (coffees.length > 1) bean = coffees[await choose(coffees.map((id) => S.MENU[id].name), H.CLOSING.chooseBean, keeper() ? '凱文' : '德叔')];
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
    if (ICONS) { b.innerHTML = iconSvg('light') + '<span class="lbl"></span>'; b.classList.add('has-icon'); }
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
// 底部按鈕列的那一顆：還有亮著的燈就「關燈」（關掉下一盞），全關了就「開燈」（打開一盞）
function lightsBtnNext() {
  const all = lightList();
  return all.find((l) => lightOn(l.id)) || all[0];
}
$('lights-btn').onclick = () => {
  const l = lightsBtnNext();
  if (!l) return;
  H.toggleLight(save, l.id);
  audio.play('click');
  persist();
  applyLamps();
  refreshLightLabels();
};
function refreshLightLabels() {
  const lb = $('lights-btn'), anyOn = lightList().some((l) => lightOn(l.id));
  setLabel(lb, anyOn ? '關燈' : '開燈');
  lb.setAttribute('aria-label', anyOn ? '關一盞燈' : '開一盞燈');
  for (const l of lightLabels) {
    const on = lightOn(l.id);
    setLabel(l.el, on ? '關燈' : '開燈');
    l.el.classList.toggle('off', !on);
    l.el.setAttribute('aria-label', `${l.id.startsWith('p') ? '吊燈' : '落地燈'}：${on ? '關燈' : '開燈'}`);
  }
}
// 每一幀：吊燈的亮度慢慢跟上開關；打烊後，關掉的燈越多，店裡越接近窗外的月光
const SEAT_LAMP = 3;
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
    if (p.shade.material.emissiveMap) p.shade.material.emissiveIntensity = 0.7 * p.level; // 手繪的吊燈：關掉時燈罩不再發亮
    else p.shade.material.color.copy(SHADE_OFF).lerp(SHADE_ON, p.level);
  });
  const avg = pendants.reduce((a, p) => a + p.level, 0) / pendants.length;
  barFill.intensity = state.night ? 2.2 * avg : 0;
  const tb = state.mode === 'seat' ? state.seat?.table : null;
  if (tb) seatLamp.position.set(tb.x, tb.h + 0.8, tb.z);
  seatLamp.intensity += ((tb ? SEAT_LAMP * avg : 0) - seatLamp.intensity) * Math.min(1, dt * 2);
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
  await camSettled(); // 端上桌之後鏡頭移回座位：到了再開始聊（德叔那句「東山的豆……」也等鏡頭轉向他）
  if (tok !== guestTok) return;
  state.guest = 'talk';
  updateUI();
  // 美術評分修正 e：龍眼走到聊天的兩個人前面坐下（評審：他不在畫面裡，下方是一片空地板）
  {
    const [pa, pb] = guestPair.map((w) => PEOPLE[w].position);
    const mid = V3((pa.x + pb.x) / 2, 0, (pa.z + pb.z) / 2), to = V3(seat.eye.x, 0, seat.eye.z).sub(mid);
    if (to.length() > 1.4) catVisit(mid.addScaledVector(to.normalize(), 0.45), 60);
  }
  await realWait(4600); // 先讓德叔端上桌的那句話說完
  for (const l of H.guestTalk(save, guestPair, today())) {
    if (tok !== guestTok) return;
    const p = PEOPLE[l.who];
    await camSettled();
    // 坐吧台的話，聊天的人在身後；美術評分修正 e：兩個人一起入鏡（桌機的視角比較窄，原本鏡頭對著說話的人，另一位被切掉一半）
    lookToward(p, 2.3, PEOPLE[guestPair.find((w) => PEOPLE[w] !== p)]);
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
  const half = el.offsetWidth / 2 + EDGE; // 左右和底部按鈕列一樣留 12px
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
// 吧台（FIT_BAR 的八個角）在畫面上的外框（凸包，像素）
function barHull(W, H) {
  const pts = FIT_BAR.map((p) => { sv.copy(p).project(camera); return [((sv.x + 1) / 2) * W, ((1 - sv.y) / 2) * H]; })
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => { const h = []; for (const p of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
  return [...half(pts), ...half([...pts].reverse())];
}
// 長方形和凸多邊形有沒有重疊（分離軸）
function rectHull(r, hull) {
  const rect = [[r.l, r.t], [r.r, r.t], [r.r, r.b], [r.l, r.b]];
  const axes = [[1, 0], [0, 1], ...hull.map((p, i) => { const q = hull[(i + 1) % hull.length]; return [q[1] - p[1], p[0] - q[0]]; })];
  for (const [ax, ay] of axes) {
    const pr = (list) => list.reduce((m, [x, y]) => { const d = x * ax + y * ay; return [Math.min(m[0], d), Math.max(m[1], d)]; }, [Infinity, -Infinity]);
    const a = pr(rect), b = pr(hull);
    if (a[1] <= b[0] || b[1] <= a[0]) return false;
  }
  return true;
}
function placeBubble(W, H, note = null) {
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
  let left = clampN(x - bw / 2, EDGE, W - EDGE - bw);
  const want = top;
  top = clampN(top, minTop, H - EDGE - bh - 9);
  // 承峰 11/3 回饋（D180）：左上角的小紙條還在的時候，泡泡放到它下面
  if (note && speaker !== 'player' && left < note.r + 4 && top < note.b + UI_GAP) top = Math.min(note.b + UI_GAP, H - EDGE - bh - 9);
  // 美術評分修正 c：俯瞰時泡泡不要蓋在吧台上：先往上推（德叔上方），推到頂還蓋到，就放到吧台旁邊
  if (state.mode === 'overview' && speaker !== 'player') {
    const bar = barHull(W, H), box = (l, t) => ({ l, t, r: l + bw, b: t + bh + 9 });
    if (rectHull(box(left, top), bar)) {
      let t = top;
      while (t > minTop && rectHull(box(left, t), bar)) t = Math.max(minTop, t - 6);
      if (!rectHull(box(left, t), bar)) top = t;
      else {
        const xs = bar.map((p) => p[0]), side = [Math.max(...xs) + 6, Math.min(...xs) - 6 - bw]
          .map((l) => clampN(l, EDGE, W - EDGE - bw)).find((l) => !rectHull(box(l, top), bar));
        if (side !== undefined) left = side;
      }
    }
  }
  const tail = !bubble.classList.contains('voice') && (speaker === 'player' || (aim !== null && Math.abs(top - want) < 2));
  bubble.classList.toggle('notail', !tail);
  bubble.style.setProperty('--tail', aim !== null && tail ? `${clampN(aim - left, 18, bw - 18)}px` : '50%');
  bubble.style.opacity = '';
  bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  return bubble.classList.contains('show') ? { l: left, t: top, r: left + bw, b: top + bh + 9 } : null;
}
const labelTops = [];
function placeLabels(W, H, avoid, note = null) {
  if ($('labels').style.display === 'none') return;
  const minTop = UI_SPACE.top + UI_GAP, maxBottom = H - UI_SPACE.bottom;
  const items = SEATS.map((st, i) => {
    const el = labels[i];
    // 家具在畫面上的上緣：底部與頂部投影比較高（畫面上比較上面）的那一個；美術評分修正 e：連它那張桌子的上緣也算，標籤不蓋桌面
    topPoint(st.prop, sv).project(camera);
    const x = ((sv.x + 1) / 2) * W;
    sv.copy(st.prop.position).project(camera);
    let tip = ((1 - sv.y) / 2) * H;
    for (const q of seatTops(st, labelTops)) { sv.copy(q).project(camera); if (sv.z < 1) tip = Math.min(tip, ((1 - sv.y) / 2) * H); }
    const fr = screenRect(st.prop);
    return { el, x, tip: tip - 6, foot: fr ? ((1 - fr.y0) / 2) * H : null, w: el.offsetWidth, h: el.offsetHeight };
  }).sort((a, b) => b.tip - a.tip); // 從畫面下面的標籤開始放：上面的被推的時候往上走
  const placed = avoid ? [avoid] : [];
  if (note) placed.push({ l: note.l - 4, t: note.t - 4, r: note.r + 4, b: note.b + 4 });
  // 美術評分修正 e：標籤也不蓋住龍眼（標籤移到桌子上方之後，龍眼跳下椅子坐的地方常在標籤底下，點不到他）
  const cr = cat.visible ? screenRect(cat) : null;
  if (cr) placed.push({ l: ((cr.x0 + 1) / 2) * W - 4, r: ((cr.x1 + 1) / 2) * W + 4, t: ((1 - cr.y1) / 2) * H - 4, b: ((1 - cr.y0) / 2) * H + 4 });
  // 美術評分修正 f：吧台前另外兩張高腳椅（評審：「吧台座」的標籤壓在中間那張凳子上）。三張排成一直線往後，
  // 標籤往上移只會改壓到後面那張，所以壓到的話改放在吧台座那張凳子的下面、小三角朝上（.under）
  const stools = [stoolMid, stoolFar].filter((q) => q.visible).map((q) => screenRect(q, 0.9)).filter(Boolean)
    .map((r) => ({ l: ((r.x0 + 1) / 2) * W, r: ((r.x1 + 1) / 2) * W, t: ((1 - r.y1) / 2) * H, b: ((1 - r.y0) / 2) * H }));
  for (const it of items) {
    const left = clampN(it.x - it.w / 2, EDGE, W - EDGE - it.w);
    let top = clampN(it.tip - it.h, minTop, maxBottom - it.h);
    let below = false, under = false;
    for (let n = 0; n < 8; n++) {
      const hit = placed.find((p) => rectHit({ l: left, t: top, r: left + it.w, b: top + it.h }, p));
      if (!hit) break;
      if (hit.t - 4 - it.h >= minTop) top = hit.t - 4 - it.h;
      else { top = hit.b + 4; below = true; }
    }
    // 標籤的牌子（看得到的部分，不含 44px 透明外框上方的空白）有沒有壓到別的凳子
    const onStool = (t) => stools.some((p) => rectHit({ l: left + 4, t: t + it.h - 34, r: left + it.w - 4, b: t + it.h - 7 }, p));
    if (it.foot !== null && onStool(top)) {
      const t2 = it.foot - 4;
      const r2 = { l: left, t: t2, r: left + it.w, b: t2 + it.h };
      if (t2 + it.h <= maxBottom && !placed.some((p) => rectHit(r2, p)) && !stools.some((p) => rectHit(r2, p))) { top = t2; under = true; below = false; }
    }
    placed.push({ l: left, t: top, r: left + it.w, b: top + it.h });
    it.el.classList.toggle('under', under);
    it.el.classList.toggle('below', below);
    it.el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
}
function layoutOverlays() {
  const W = app.clientWidth, H = app.clientHeight;
  const note = stageRect(); // 完成任務的小紙條（D180）：泡泡與標籤都讓開
  placeLabels(W, H, placeBubble(W, H, note), note);
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
  updateCatHalo(dt);
  updateYuanChair();
  flipCat();
  updateOcclusion(dt);
  updateDoor(dt);
  frontStub.visible = !frontWall.visible; // 前牆收起來的時候（俯瞰）才有剖面
  // 龍眼睡覺時的呼吸
  if (!catBusy) cat.userData.squash = 1 + Math.sin(performance.now() / 900) * 0.03;
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
  else { renderer.render(scene, camera); paintBackdrop(now); }
  requestAnimationFrame(loop);
}

// 桌機：直式畫面兩側的黑邊鋪上模糊的店內畫面（美術評分修正 b）。
// 每 0.5 秒把剛畫好的那一格縮成很小的圖（要在 render 之後、同一格裡讀，不需要 preserveDrawingBuffer），CSS 再放大、模糊；
// 兩側沒有空間（手機）時不畫
const backdrop = document.getElementById('backdrop');
let backdropCv = null, backdropAt = 0;
function paintBackdrop(t) {
  if (t - backdropAt < 500 || window.innerWidth - app.clientWidth < 40) return;
  backdropAt = t;
  if (!backdropCv) {
    backdropCv = document.createElement('canvas');
    backdropCv.width = 48; backdropCv.height = 64;
    backdrop.appendChild(backdropCv);
  }
  try {
    backdropCv.getContext('2d').drawImage(renderer.domElement, 0, 0, backdropCv.width, backdropCv.height);
    backdropCv.classList.add('on');
  } catch { /* 讀不到畫面就維持紙張紋理 */ }
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
    // 美術評分修正 b：德叔的材質（每公尺像素、mipmap、三線性過濾）
    get artInfo() { const m = deshu.userData.mesh.material.map; return { ppm: A.ppmOf(m.image), mip: m.generateMipmaps, trilinear: m.minFilter === THREE.LinearMipmapLinearFilter, srgb: m.colorSpace === THREE.SRGBColorSpace }; },
    // 接正式美術：載到了哪些手繪圖、每個人現在的材質是哪一張（Canvas 繪圖是 null）
    get art() {
      const of = (p) => { const img = p.userData.mesh.material.map?.image; return (img?.canvas || img)?.art || null; };
      const img = (m) => { const i = m.map?.image; return i?.canvas || i; };
      return { loaded: A.artNames(), room: A.roomArtNames(), now: Object.fromEntries(Object.entries({ ...PEOPLE, cat }).map(([k, p]) => [k, of(p)])), yuanChair: yuanChair.visible,
        // 接正式美術第二批：店內用到的手繪圖（座位的椅子、吧台後的層架、溫度計、吊燈紙片、窗景與材質的像素寬）
        props: Object.fromEntries(SEATS.map((st) => [st.id, of(st.prop)])), backBar: img(backBar.material)?.art || null, thermo: img(thermoMat)?.art || null,
        hanging: hanging.length, windowW: img(windows[0].material)?.width, floorW: floorTex.image?.width,
        // art2b：開場、地圖與介面的圖（DOM 用）、介面圖示、吧台上老先生的信封
        ui: A.uiArtNames(), icons: ICONS, envelope: img(envelope.userData.mesh.material)?.art || null };
    },
    // art2b：地圖、縣道、信箱各自是哪一種元素（手繪圖：svg／IMG；沒有圖：CANVAS）
    uiArtTags() { return { map: A.coffeeMap().tagName, road: A.countyRoad().tagName, mail: A.mailboxes().tagName }; },
    // 俯瞰：畫面裡看得到的地板最下緣，離提示（或按鈕列）上緣還有幾 px
    overviewGap() {
      const H = app.clientHeight, W = app.clientWidth, v = new THREE.Vector3();
      const c = [[-ROOM.w / 2, -ROOM.d / 2], [-ROOM.w / 2, ROOM.d / 2], [ROOM.w / 2, ROOM.d / 2], [ROOM.w / 2, -ROOM.d / 2]];
      let low = 0;
      for (let i = 0; i < 4; i++) for (let k = 0; k <= 60; k++) {
        const [x0, z0] = c[i], [x1, z1] = c[(i + 1) % 4];
        v.set(x0 + (x1 - x0) * k / 60, 0, z0 + (z1 - z0) * k / 60).project(camera);
        if (Math.abs(v.x) <= 1 && v.z < 1) low = Math.max(low, ((1 - v.y) / 2) * H);
      }
      const ui = $('hint').hidden ? document.querySelector('.bottom .row') : $('hint');
      return ui.getBoundingClientRect().top - app.getBoundingClientRect().top - low;
    },
    get overYaw() { return OVER.yd; },
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
    // art2b：某個人畫出來的左右範圍（相對 #app 的像素）
    spanOnScreen(w) {
      const p = w === 'deshu' ? deshu : PEOPLE[w];
      const r = p?.visible ? screenRect(p, 0.85) : null;
      return r && [((r.x0 + 1) / 2) * app.clientWidth, ((r.x1 + 1) / 2) * app.clientWidth].map(Math.round);
    },
    // art2b：鏡頭的狀態（轉了多少、在不在推近、看著誰）
    get camInfo() { return { yaw: Math.round(cam.yaw * 100) / 100, focus: !!state.focus, closeup: !!state.closeup, focusP: focusP ? nameOf(focusP) : null, tween: !!tween, mode: state.mode, seat: state.seat?.id || null, speaker: isPerson(speaker) ? nameOf(speaker) : null, scene: state.scene?.id || null, show: bubble.classList.contains('show'), zheVisible: zhe.visible, guest: state.guest }; },
    // art2b：直接演某一個熟客里程碑的場景（截圖檢查站位用；會照常記進存檔）
    playScene(id) { const m = S.milestoneById(id); if (m && !state.scene) runScene(m); return !!m; },
    // art2b：對話時前景淡出的狀態：誰是說話的人、哪些擺飾與椅子淡掉了（透明度 < 1）
    get occlusion() {
      const talker = focusP || (conversing() && bubble.classList.contains('show') && isPerson(speaker) ? speaker : null);
      const name = (q) => q?.userData.name || q?.userData.item?.id || (q === stoolMid ? 'stoolMid' : q === stoolFar ? 'stoolFar' : q === yuanChair ? 'yuanChair' : '?');
      return { talker: talker ? nameOf(talker) : null, faded: occProps().filter((q) => q.visible && q.userData.mesh.material.opacity < 0.99).map(name),
        rects: occProps().filter((q) => q.visible).map((q) => { const r = screenRect(q, 0.92); return [name(q), r && Math.round(r.d * 10) / 10, r && [r.x0, r.x1, r.y0, r.y1].map((v) => Math.round(v * 100) / 100)]; }) };
    },
    // art2b：某個人（含德叔、龍眼）在畫面上畫出來有幾 px 高（腳底到頭頂）
    heightOnScreen(w) {
      const p = w === 'deshu' ? deshu : w === 'cat' ? cat : PEOPLE[w];
      if (!p?.visible) return null;
      const a = p.position.clone(), b = a.clone();
      a.y += p.userData.mesh.position.y;
      const m = p.userData.mesh;
      b.y = a.y + m.geometry.parameters.height * (1 - inkTop(m.material.map?.image));
      a.project(camera); b.project(camera);
      return Math.round(Math.abs(b.y - a.y) / 2 * app.clientHeight);
    },
    // 階段 5：龍眼、打烊後、客人模式
    get catSpot() { return 'sill'; }, // 美術評分修正 f：固定睡窗台（Q64）
    get catOnSeat() { return catOnSeat; },
    get catOnSill() { return catAtHome; },
    get brewKit() { return grinder.visible || brewer.visible || kettle.visible; }, // 美術評分修正 d：吧台上的立體沖煮器具有沒有出來 // 美術評分修正 d：老闆坐窗邊座時睡在窗台上
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
    say(text, ms = 6000) { say(text, ms); }, // 美術評分修正 c：讓德叔說一句，測試泡泡的位置
    // 承峰 11/3 回饋：完成任務的小紙條（現在顯示的、出現過的）、等客人的狀態；note() 直接放一張紙條（截圖用）
    get stageNote() { return stageEl.classList.contains('show') ? stageEl.textContent : null; },
    get stageLog() { return stageLog.map((n) => ({ ...n })); },
    get door() { return { open: Math.round(doorMotion.open * 100) / 100, visible: frontWall.visible && door.visible, stub: frontStub.visible }; },
    note(id = 'first-coffee') { const t = taskById(id); if (t) stageNote([t]); return !!t; },
    get waitHint() { return { line: waiting.line, approach: !!waiting.approach, next: nextArrivalMs(), hint: $('hint').hidden ? '' : $('hint').textContent, breathe: $('hint').classList.contains('breathe') }; },
    // 承峰 11/3 回饋：坐著時直接轉頭到某個角度（截圖用；和手指拖曳一樣受座位的轉頭範圍限制）
    look(yaw = 0, pitch = 0) { if (state.mode !== 'seat') return false; focusP = null; lookTok++; cam.yaw = THREE.MathUtils.clamp(yaw, ...yawRange()); cam.pitch = THREE.MathUtils.clamp(pitch, -0.35, 0.35); return true; },
    // 美術評分修正 c：鏡頭停好了（沒有在移動、轉向，推近也到了），全流程截圖等這個再拍
    get camStill() {
      const want = state.mode === 'overview' ? 50 : state.closeup ? closeView().fov : state.focus ? focusFov : seatFov();
      return !tween && (!turnTok || turnTok !== lookTok) && Math.abs(camera.fov - want) < 1;
    },
    // 美術評分修正 c：桌子（桌面、桌腳）占整個畫面多少（在格點上打射線，第一個碰到的是桌子就算）
    tableShare() {
      const ray = new THREE.Raycaster(), n = new THREE.Vector2();
      const H = app.clientHeight, bottom = H;
      const objs = []; scene.traverseVisible((o) => { if (o.isMesh) objs.push(o); });
      let hit = 0, all = 0, low = 0;
      for (let y = 0; y < 60; y++) for (let x = 0; x < 30; x++) {
        const py = ((y + 0.5) / 60) * H; if (py > bottom) continue;
        n.set(((x + 0.5) / 30) * 2 - 1, 1 - (py / H) * 2);
        ray.setFromCamera(n, camera);
        const h = ray.intersectObjects(objs, false).find((i) => !i.object.material?.transparent); // 紙片與影子不算（近似）
        all++;
        if (h?.object.userData.table) { hit++; if (x < 15 && py > H / 2) low++; }
      }
      return { share: Math.round((hit / all) * 100), lowerLeft: Math.round((low / all) * 100) };
    },
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
