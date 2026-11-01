// 我單方面辭退老闆後，開了一間夢想中的咖啡店 — 2.5D 紙片原型
// 3D 房間 + 2D 紙片（billboard）擺飾與人物，驗證手機直立的顧客視角。
import * as THREE from 'three';
import * as A from './art.js';

const PPM = A.SIZES.PPM;
const $ = (id) => document.getElementById(id);

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
    cup: new THREE.Vector3(-2.05, tA.h + 0.02, -0.4), serve: new THREE.Vector3(-1.55, 0, -0.9),
    prop: paper(A.chair(), -1.9, 0.15, { name: 'chair' }),
  },
  {
    id: 'bar', name: '吧台座',
    eye: new THREE.Vector3(0.75, 1.42, -0.9), look: new THREE.Vector3(2.6, 1.4, -1.6),
    cup: new THREE.Vector3(1.75, 1.06, -1.0), serve: null,
    prop: paper(A.stool(), 1.3, -1.0, { name: 'stool' }),
  },
  {
    id: 'sofa', name: '角落沙發',
    eye: new THREE.Vector3(-2.05, 1.0, 3.25), look: new THREE.Vector3(1.0, 1.15, -2.4),
    cup: new THREE.Vector3(-1.35, tC.h + 0.02, 2.3), serve: new THREE.Vector3(-0.8, 0, 2.0),
    prop: paper(A.sofa(), -2.1, 3.3, { base: Math.PI * 0.85, clamp: 0.7, name: 'sofa' }),
  },
];
paper(A.stool(), 1.3, -2.1);
paper(A.stool(), 1.3, -2.9);

// 吧台上的手沖架
const kettle = paper(A.kettleSet(), 1.95, -2.3, { y: 1.06, shadow: false, base: -Math.PI / 2, clamp: 1.2 });

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
const state = { temp: 20, tasks: new Set(), sat: new Set(), speed: 1, night: false, mode: 'overview', seat: null, placing: false, selected: null };
function drawThermo() {
  thermoMat.map?.dispose();
  thermoMat.map = A.tex(A.thermometer(state.temp));
  thermoMat.needsUpdate = true;
  $('temp').textContent = state.temp.toFixed(1) + '°C';
}
drawThermo();

function task(id, label, dT) {
  if (state.tasks.has(id)) return;
  state.tasks.add(id);
  state.temp += dT;
  drawThermo();
  toast(`溫度任務：${label}　+${dT}°C`);
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- 德叔的動作 ---------- */
const bubble = $('bubble');
let bubbleTimer;
function say(text, ms = 3500) {
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  if (ms) bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}

const wait = (sec) => new Promise((r) => {
  let t = 0;
  waiters.push((dt) => { t += dt * state.speed; if (t >= sec) { r(); return true; } return false; });
});
const waiters = [];

function walk(p, to, speed = 0.7) {
  return new Promise((r) => {
    waiters.push((dt) => {
      const d = new THREE.Vector3(to.x - p.position.x, 0, to.z - p.position.z);
      const step = speed * dt * state.speed;
      if (d.length() <= step) { p.position.x = to.x; p.position.z = to.z; r(); return true; }
      d.setLength(step);
      p.position.add(d);
      p.userData.mesh.position.y = Math.abs(Math.sin(performance.now() / 160)) * 0.03; // 走路時輕微起伏
      return false;
    });
  });
}

let brewing = false;
const cups = [];
async function brew(seat) {
  if (brewing) return;
  brewing = true;
  $('brew').disabled = true;
  const steamPos = new THREE.Vector3(2.12, 1.3, -2.3);
  const steps = [
    ['先溫杯。', 5],
    ['磨豆，中細。', 7],
    ['悶蒸三十秒……不急。', 7],
    ['慢慢注水。', 12],
  ];
  for (const [text, sec] of steps) {
    say(text, 0);
    if (text.includes('注水')) setPaper(deshu, deshuCanvas.pour);
    const steam = setInterval(() => { if (text.includes('注水') || text.includes('悶蒸')) emitSteam(steamPos); }, 260 / state.speed);
    await wait(sec);
    clearInterval(steam);
  }
  setPaper(deshu, deshuCanvas.idle);

  if (seat.serve) {
    say('好了，我端過去。', 2500);
    const path = [new THREE.Vector3(2.6, 0, 0.6), new THREE.Vector3(1.3, 0, 0.8), seat.serve];
    for (const pt of path) await walk(deshu, pt);
    placeCup(seat);
    say('東山的豆，就是窗外那片山。', 4500);
    await wait(2.5);
    for (const pt of [new THREE.Vector3(1.3, 0, 0.8), new THREE.Vector3(2.6, 0, 0.6), HOME]) await walk(deshu, pt);
    deshu.userData.mesh.position.y = 0;
  } else {
    placeCup(seat);
    say('東山的豆，就是窗外那片山。', 4500);
  }
  task('first-coffee', '第一次坐下喝德叔的咖啡', 0.5);
  brewing = false;
  $('brew').disabled = false;
}

function placeCup(seat) {
  const c = paper(A.cup(), seat.cup.x, seat.cup.z, { y: seat.cup.y, shadow: false });
  c.userData.steamAt = new THREE.Vector3(seat.cup.x, seat.cup.y + 0.14, seat.cup.z);
  c.userData.age = 0;
  cups.push(c);
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
const cam = { pos: OVER.pos.clone(), look: OVER.look.clone(), yaw: 0, pitch: 0 };
let tween = null;
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
  const targetFov = state.mode === 'overview' ? 50 : 72;
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
  if (state.sat.size === SEATS.length) task('all-seats', '每個座位都坐過一次', 1);
}

function stand() {
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
  $('place').style.display = over ? '' : 'none';
  $('place').textContent = state.placing ? '完成佈置' : '佈置';
  $('hint').textContent = over
    ? (state.placing ? (state.selected ? `已選：${state.selected.userData.name}，點地板放到那裡` : '點一件擺飾，再點地板移動它') : '點座位坐下，用客人的角度看看這間店')
    : '左右拖曳可以環顧四周';
}

$('stand').onclick = stand;
$('brew').onclick = () => state.seat && brew(state.seat);
$('night').onclick = () => { state.night = !state.night; applyLight(); };
$('place').onclick = () => {
  state.placing = !state.placing;
  select(null);
  updateUI();
};
$('speed').onclick = () => {
  state.speed = state.speed === 1 ? 4 : 1;
  $('speed').textContent = state.speed === 1 ? '正常速度' : '快轉 ×4';
};

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
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: cam.yaw, pitch: cam.pitch };
});
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
  down = null;
  if (moved > 10 || !state.placing || state.mode !== 'overview') return;
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
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
      task('first-decor', '第一次調整店裡的擺設', 0.5);
      select(null);
    }
  }
});

/* ---------- 主迴圈 ---------- */
let last = performance.now();
const tmp = new THREE.Vector3();
function project(pos, el, yOff = 0) {
  tmp.copy(pos); tmp.y += yOff;
  tmp.project(camera);
  const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15;
  el.style.opacity = visible ? '' : '0';
  el.style.transform = `translate(-50%,-100%) translate(${((tmp.x + 1) / 2) * app.clientWidth}px, ${((1 - tmp.y) / 2) * app.clientHeight}px)`;
}

let steamAcc = 0;
function loop() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i](dt)) waiters.splice(i, 1);
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
  }
  updateSteam(dt);
  lampLight.position.set(lamp.position.x, 1.5, lamp.position.z);
  project(deshu.position, bubble, 2.0);
  SEATS.forEach((s, i) => project(s.prop.position, labels[i], 1.1));
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
