// 「坐下來看看」：從選定的座位看出去的 3D 畫面（Three.js，簡化版）。
// 家具是固定朝向（面向門口）的紙片；轉 90 度先用左右翻轉代替（規格書：是否穿幫需要實測）。
// 1 單位 = 1 格（約 60 公分）。格子 (x, y) 的中心 → 世界座標 (x - 3, ·, y - 4)。
import * as THREE from 'three';
import { W, H, WINDOW_ROWS, BAR_CELLS, DECOR, BAR_ITEM, seatCells, pieceCell, footprint, size } from '../grid.js';
import { styleOf } from './shop.js';

const ART = './assets/art/';
const toWorld = (x, y) => new THREE.Vector3(x + 0.5 - W / 2, 0, y + 0.5 - H / 2);

// 紙片的高度（單位：格）
const HEIGHT = {
  chair: 1.5, rattanChair: 1.6, stool: 1.3, bookshelf: 2.6, plant: 1.6, framedNapkin: 0.9, floorLamp_on: 2.8,
  catCushion: 0.55, cat_longan_sleep: 0.6, char_deshu_stand: 2.9, backbar: 2.6,
};

export function openSeatView(root, { layout, item, seatIndex = 0, cat, onClose }) {
  root.hidden = false;
  root.innerHTML = `
    <canvas class="s3-canvas"></canvas>
    <div class="s3-ui">
      <p class="s3-hint">左右滑動轉頭</p>
      <div class="s3-btns">
        ${seatCells(item).length > 1 ? '<button type="button" class="s3-swap">換個位子</button>' : ''}
        <button type="button" class="s3-up primary">站起來</button>
      </div>
    </div>`;
  const canvas = root.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b2420');
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 60);
  const loader = new THREE.TextureLoader();
  const disposables = [];

  const tex = (name, repeat) => {
    const t = loader.load(`${ART}${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    disposables.push(t);
    return t;
  };
  const mat = (opts) => {
    const m = new THREE.MeshBasicMaterial(opts);
    disposables.push(m);
    return m;
  };
  const plane = (w, h, material) => {
    const g = new THREE.PlaneGeometry(w, h);
    disposables.push(g);
    return new THREE.Mesh(g, material);
  };
  const boxMesh = (w, h, d, material) => {
    const g = new THREE.BoxGeometry(w, h, d);
    disposables.push(g);
    return new THREE.Mesh(g, material);
  };

  // 固定朝向的紙片：等圖載好再依長寬比調寬度；flip 代替轉 90 度
  function paper(name, pos, { h = HEIGHT[name] || 1.5, lift = 0, flip = false } = {}) {
    const t = loader.load(`${ART}${name}.webp`, (tt) => {
      const a = tt.image.width / tt.image.height || 1;
      mesh.scale.set(h * a * (flip ? -1 : 1), h, 1);
    });
    t.colorSpace = THREE.SRGBColorSpace;
    disposables.push(t);
    const mesh = plane(1, 1, mat({ map: t, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide }));
    mesh.scale.set(h * (flip ? -1 : 1), h, 1);
    mesh.position.set(pos.x, lift + h / 2, pos.z);
    scene.add(mesh);
    return mesh;
  }

  /* 店面：地板、牆、窗、門 */
  const floor = plane(W, H, mat({ map: tex('tex_floor_wood', [W / 2, H / 2]) }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const WALL_H = 5;
  const wallMat = mat({ map: tex('tex_wall_plaster', [2, 1]) });
  const walls = [
    { w: W, x: 0, z: -H / 2, ry: 0 },
    { w: W, x: 0, z: H / 2, ry: Math.PI },
    { w: H, x: -W / 2, z: 0, ry: Math.PI / 2 },
    { w: H, x: W / 2, z: 0, ry: -Math.PI / 2 },
  ];
  for (const wl of walls) {
    const m = plane(wl.w, WALL_H, wallMat);
    m.position.set(wl.x, WALL_H / 2, wl.z);
    m.rotation.y = wl.ry;
    scene.add(m);
  }
  const ceil = plane(W, H, mat({ map: tex('tex_ceiling_beam', [1, 2]) }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = WALL_H;
  scene.add(ceil);
  // 左牆的窗
  const winZ = (WINDOW_ROWS[0] + WINDOW_ROWS[WINDOW_ROWS.length - 1] + 1) / 2 - H / 2;
  const win = plane(WINDOW_ROWS.length, 2.6, mat({ map: tex('window_day_clear') }));
  win.position.set(-W / 2 + 0.02, 2.6, winZ);
  win.rotation.y = Math.PI / 2;
  scene.add(win);
  const frame = plane(WINDOW_ROWS.length + 0.3, 2.9, mat({ map: tex('window_frame'), transparent: true, alphaTest: 0.05 }));
  frame.position.set(-W / 2 + 0.04, 2.6, winZ);
  frame.rotation.y = Math.PI / 2;
  scene.add(frame);
  // 門
  const door = plane(1.4, 3.6, mat({ color: '#4a3527' }));
  door.position.set(0, 1.8, H / 2 - 0.02);
  door.rotation.y = Math.PI;
  scene.add(door);
  // 菜單板與溫度計
  const menu = plane(1.6, 2.0, mat({ map: tex('menuBoard'), transparent: true, alphaTest: 0.05 }));
  menu.position.set(-1.5, 2.8, -H / 2 + 0.03);
  scene.add(menu);
  const thermo = plane(0.5, 1.4, mat({ map: tex('thermometer_frame'), transparent: true, alphaTest: 0.05 }));
  thermo.position.set(W / 2 - 0.03, 2.8, -0.5);
  thermo.rotation.y = -Math.PI / 2;
  scene.add(thermo);

  /* 吧台與德叔 */
  const bx = Math.min(...BAR_CELLS.map((c) => c.x));
  const barCenter = toWorld(bx + 1, 1);
  const counter = boxMesh(3, 1.8, 0.8, [
    mat({ map: tex('tex_counter_front') }), mat({ map: tex('tex_counter_front') }), mat({ map: tex('tex_wood_top') }),
    mat({ color: '#3a2a20' }), mat({ map: tex('tex_counter_front') }), mat({ map: tex('tex_counter_front') }),
  ]);
  counter.position.set(barCenter.x, 0.9, barCenter.z + 0.1);
  scene.add(counter);
  const back = toWorld(bx + 1, 0);
  paper('backbar', { x: back.x, z: -H / 2 + 0.05 }, { lift: 0.4 });
  paper('char_deshu_stand', { x: back.x + 0.3, z: back.z + 0.1 });

  /* 角落與擺飾 */
  const ownChairs = [];
  const corners = [BAR_ITEM, ...layout.items.filter((i) => i.kind === 'corner')];
  for (const it of corners) {
    const st = styleOf(it);
    const flip = (it.rot || 0) % 2 === 1;
    const chair = st.chair || 'stool';
    seatCells(it).forEach((s, i) => {
      const m = paper(chair, toWorld(s.x, s.y), { flip });
      if (it.uid === item.uid) ownChairs[i] = m; // 自己坐的那張椅子不畫（鏡頭就在椅子上）
    });
    const t = pieceCell(it, 'table');
    if (t) {
      const fp = footprint(it);
      const sz = size(it);
      let w = 0.9; let d = 0.9; let c = toWorld(t.x, t.y);
      if (it.type === 'worktable') {
        const line = it.rot % 2 ? fp.filter((q) => q.x === t.x) : fp.filter((q) => q.y === t.y);
        const xs = line.map((q) => q.x); const ys = line.map((q) => q.y);
        c = toWorld((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
        w = it.rot % 2 ? 0.9 : sz.w - 0.2;
        d = it.rot % 2 ? sz.h - 0.2 : 0.9;
      }
      const top = boxMesh(w, 0.12, d, mat({ map: tex('tex_wood_top'), color: st.id === 'iron' ? '#9a9da2' : '#ffffff' }));
      top.position.set(c.x, 1.25, c.z);
      scene.add(top);
      const leg = boxMesh(0.12, 1.2, 0.12, mat({ color: st.id === 'iron' ? '#2f3236' : '#6b4a33' }));
      leg.position.set(c.x, 0.6, c.z);
      scene.add(leg);
      if (it.type === 'worktable') paper('floorLamp_on', { x: c.x, z: c.z }, { h: 0.9, lift: 1.31 });
    }
    const sh = pieceCell(it, 'shelf');
    if (sh) paper('bookshelf', toWorld(sh.x, sh.y), { flip });
  }
  for (const d of layout.items.filter((i) => i.kind === 'decor')) {
    const name = DECOR[d.type].art;
    paper(name, toWorld(d.x, d.y), { lift: d.type === 'frame' ? 1.0 : 0 });
  }
  if (cat) paper('cat_longan_sleep', toWorld(cat.x, cat.y), { lift: cat.place === 'catbed' ? 0.25 : 0 });

  /* 鏡頭：坐在座位上，先看向角落的中心（吧台座看吧台） */
  let seat = seatIndex;
  let yaw = 0;
  const pitch = -0.08;
  function placeCamera() {
    const s = seatCells(item)[seat] || seatCells(item)[0];
    ownChairs.forEach((m, i) => { m.visible = i !== seat; });
    const p = toWorld(s.x, s.y);
    camera.position.set(p.x, 2.0, p.z);
    let target;
    if (item.type === 'bar') target = toWorld(s.x, 0);
    else {
      const fp = footprint(item);
      const cx = fp.reduce((a, q) => a + q.x, 0) / fp.length;
      const cy = fp.reduce((a, q) => a + q.y, 0) / fp.length;
      target = toWorld(cx, cy);
      if (target.distanceTo(p) < 0.3) target = new THREE.Vector3(0, 0, 0);
    }
    yaw = Math.atan2(-(target.x - p.x), -(target.z - p.z));
  }
  placeCamera();

  function resize() {
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let alive = true;
  function loop() {
    if (!alive) return;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  // 左右滑轉頭
  let dragX = null;
  canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    yaw += (e.clientX - dragX) * 0.006;
    dragX = e.clientX;
  });
  canvas.addEventListener('pointerup', () => { dragX = null; });
  canvas.addEventListener('pointercancel', () => { dragX = null; });

  const swap = root.querySelector('.s3-swap');
  if (swap) swap.onclick = () => {
    seat = (seat + 1) % seatCells(item).length;
    placeCamera();
    ctl.onSeat?.(seat);
  };

  function close() {
    if (!alive) return;
    alive = false;
    window.removeEventListener('resize', resize);
    for (const d of disposables) d.dispose?.();
    renderer.dispose();
    root.innerHTML = '';
    root.hidden = true;
    onClose?.(seat);
  }
  root.querySelector('.s3-up').onclick = close;

  const ctl = { close, get seat() { return seat; }, onSeat: null, setUpLabel(t) { root.querySelector('.s3-up').textContent = t; }, hideUp(v) { root.querySelector('.s3-up').hidden = v; } };
  return ctl;
}
