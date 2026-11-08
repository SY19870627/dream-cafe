// 同一間店的 3D 場景：房間（木地板、石灰牆＋紅磚腰牆、左牆的窗、吧台、德叔、吊燈、溫度計）＋玩家擺的角落與擺飾＋龍眼。
// 俯視店面（shop3d.js）與座位視角（seat3d.js）都用這裡蓋出來的東西，兩邊是同一間店、同一套紙片。
// 房間、材質、燈光的做法參考第一版 legacy/src/main.js（addWall、addWindow、table、吊燈、hemi＋sun）。
//
// 座標：1 格 = CELL 公尺。格子 (x, y) 的中心 → 世界 (cx(x), ·, cz(y))；x 往右、y 往門口（+z）。
import * as THREE from 'three';
import {
  W, H, DOOR, WINDOW_ROWS, OUTLETS, BAR_CELLS, STOOL_CELLS, CORNERS, DECOR, BAR_ITEM, seatCells, pieceCell, footprint,
} from '../grid.js';
import { paper, loadTex } from './art3d.js';

// 規格書一格約 60 公分；畫面上放大到 75 公分，紙片人物才不會一個人蓋掉三格（邏輯不受影響）
export const CELL = 0.75;
export const RW = W * CELL; // 房間寬
export const RD = H * CELL; // 房間深
export const WALL_H = 2.7;
const WAINSCOT = 1.0;
export const cx = (x) => (x + 0.5) * CELL - RW / 2;
export const cz = (y) => (y + 0.5) * CELL - RD / 2;
export const toCell = (wx, wz) => ({ fx: (wx + RW / 2) / CELL, fy: (wz + RD / 2) / CELL });

export function styleOf(item) {
  const c = CORNERS[item.type];
  return c.styles.find((s) => s.id === item.style) || c.styles[0];
}

const lambert = (opts) => new THREE.MeshLambertMaterial(opts);

/* ---------- 房間（固定的部分） ---------- */
// opt：{ front：前牆整面（座位視角）或只有一道矮檯（俯視）, ceiling }
export function buildRoom(opt = {}) {
  const room = new THREE.Group();
  const papers = [];
  const add = (o) => { room.add(o); return o; };

  // 地板：一張 2×2 公尺
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), lambert({ map: loadTex('tex_floor_wood', [RW / 2, RD / 2]) })));
  floor.rotation.x = -Math.PI / 2;
  floor.userData.floor = true;

  // 牆：上半石灰牆、下半 1 公尺高的紅磚腰牆
  const wall = (w, x, z, ry, h = WALL_H) => {
    const g = new THREE.Group();
    const up = new THREE.Mesh(new THREE.PlaneGeometry(w, h - WAINSCOT), lambert({ map: loadTex('tex_wall_plaster', [w, h - WAINSCOT]) }));
    up.position.y = (h + WAINSCOT) / 2;
    const low = new THREE.Mesh(new THREE.PlaneGeometry(w, WAINSCOT), lambert({ map: loadTex('tex_wall_wainscot', [w, 1]) }));
    low.position.y = WAINSCOT / 2;
    g.add(up, low);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    return add(g);
  };
  wall(RW, 0, -RD / 2, 0); // 後牆（吧台那面）
  wall(RD, -RW / 2, 0, Math.PI / 2); // 左牆（窗）
  wall(RD, RW / 2, 0, -Math.PI / 2); // 右牆
  if (opt.front) {
    // 前牆：門的兩側各一段，門上一段
    const dl = cx(DOOR.x) - CELL / 2;
    const dr = cx(DOOR.x) + CELL / 2;
    const lw = dl + RW / 2;
    const rw = RW / 2 - dr;
    wall(lw, -RW / 2 + lw / 2, RD / 2, Math.PI);
    wall(rw, dr + rw / 2, RD / 2, Math.PI);
    const top = add(new THREE.Mesh(new THREE.PlaneGeometry(CELL, WALL_H - 2.1), lambert({ map: loadTex('tex_wall_plaster', [CELL, 0.6]) })));
    top.position.set(cx(DOOR.x), 2.1 + (WALL_H - 2.1) / 2, RD / 2);
    top.rotation.y = Math.PI;
    const outside = add(new THREE.Mesh(new THREE.PlaneGeometry(CELL, 2.1), new THREE.MeshBasicMaterial({ map: loadTex('window_day_clear') })));
    outside.position.set(cx(DOOR.x), 1.05, RD / 2 + 0.01);
    outside.rotation.y = Math.PI;
  } else {
    // 俯視：前面只有一道矮矮的木檯（鏡頭從這一側看進去），門口留缺口
    const ledgeMat = lambert({ map: loadTex('tex_counter_front', [1, 0.2]) });
    for (const [x0, x1] of [[-RW / 2, cx(DOOR.x) - CELL / 2], [cx(DOOR.x) + CELL / 2, RW / 2]]) {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.22, 0.12), ledgeMat));
      m.position.set((x0 + x1) / 2, 0.11, RD / 2 + 0.06);
    }
  }
  // 門口：門墊＋磨石子門檻
  const mat = add(new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.6), lambert({ color: '#7a5a3c' })));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(cx(DOOR.x), 0.008, RD / 2 - CELL * 0.35);
  const sill = add(new THREE.Mesh(new THREE.BoxGeometry(CELL * 1.1, 0.03, 0.14), lambert({ color: '#a8977f' })));
  sill.position.set(cx(DOOR.x), 0.015, RD / 2);

  if (opt.ceiling) {
    const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), lambert({ map: loadTex('tex_ceiling_beam', [RW, RD]) })));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
  }

  // 左牆的窗（第 1～5 列）：窗景自己發亮，窗框受店裡的光
  const z0 = cz(WINDOW_ROWS[0]) - CELL / 2;
  const z1 = cz(WINDOW_ROWS[WINDOW_ROWS.length - 1]) + CELL / 2;
  const n = 2;
  const ww = Math.min(1.6, (z1 - z0) / n - 0.1);
  for (let i = 0; i < n; i++) {
    const zc = z0 + ((i + 0.5) * (z1 - z0)) / n;
    const v = add(new THREE.Mesh(new THREE.PlaneGeometry(ww, 1.3), new THREE.MeshBasicMaterial({ map: loadTex('window_day_clear') })));
    v.position.set(-RW / 2 + 0.02, 1.65, zc);
    v.rotation.y = Math.PI / 2;
    const f = paper('window_frame', { shadow: false, scale: ww / 1.6 });
    f.userData.wall = true;
    f.position.set(-RW / 2 + 0.04, 1.0, zc);
    f.rotation.y = Math.PI / 2;
    add(f);
    // 窗台照進來的一塊光
    const sun = add(new THREE.Mesh(new THREE.PlaneGeometry(1.0, ww), new THREE.MeshBasicMaterial({ color: '#fff1c8', transparent: true, opacity: 0.16, depthWrite: false })));
    sun.rotation.x = -Math.PI / 2;
    sun.position.set(-RW / 2 + 0.55, 0.007, zc + 0.2);
  }

  // 插座：牆上的小白盒
  for (const o of OUTLETS) {
    const box = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.03), lambert({ color: '#f4f1ea' })));
    const onLeft = o.x === 0;
    box.position.set(onLeft ? -RW / 2 + 0.015 : RW / 2 - 0.015, 0.35, cz(o.y));
    box.rotation.y = onLeft ? Math.PI / 2 : -Math.PI / 2;
  }

  /* 吧台與德叔的工作區（右上 3×2） */
  const bx0 = Math.min(...BAR_CELLS.map((c) => c.x));
  const bx1 = Math.max(...BAR_CELLS.map((c) => c.x));
  const barX = (cx(bx0) + cx(bx1)) / 2;
  const barW = (bx1 - bx0 + 1) * CELL;
  const counterZ = cz(1) + CELL * 0.18; // 吧台檯子在第二排，靠近客人那一側
  const front = lambert({ map: loadTex('tex_counter_front', [barW / 1.7, 1]) });
  const side = lambert({ map: loadTex('tex_counter_front', [0.6 / 1.7, 1]) });
  const counter = add(new THREE.Mesh(new THREE.BoxGeometry(barW - 0.1, 1.0, 0.6), [side, side, side, side, front, front]));
  counter.position.set(barX, 0.5, counterZ);
  counter.userData.uid = 'bar';
  const top = add(new THREE.Mesh(new THREE.BoxGeometry(barW, 0.06, 0.7), lambert({ map: loadTex('tex_wood_top', [barW, 0.7]) })));
  top.position.set(barX, 1.03, counterZ);
  top.userData.uid = 'bar';
  // 吧台後方的層架（貼後牆）＋底下的矮櫃
  const back = paper('backbar', { shadow: false, scale: barW / 2.8 });
  back.userData.wall = true;
  back.position.set(barX, 0.55, -RD / 2 + 0.03);
  add(back);
  const base = add(new THREE.Mesh(new THREE.BoxGeometry(barW, 0.55, 0.22), lambert({ map: loadTex('tex_counter_front', [barW / 1.7, 0.55]) })));
  base.position.set(barX, 0.275, -RD / 2 + 0.11);
  // 吧台上：手沖壺組、龍眼乾罐
  const kettle = paper('kettleSet', { shadow: false, lift: 1.06, scale: 0.8 });
  kettle.position.set(barX + 0.45, 0, counterZ - 0.05);
  add(kettle); papers.push(kettle);
  const jar = paper('longanJar', { shadow: false, lift: 1.06, scale: 0.4 });
  jar.position.set(barX - 0.65, 0, counterZ - 0.05);
  add(jar); papers.push(jar);
  // 德叔：站在吧台後面
  const deshu = paper('char_deshu_stand', { uid: 'bar' });
  deshu.position.set(barX + 0.15, 0, cz(0) + 0.05);
  add(deshu); papers.push(deshu);
  // 吊燈兩盞（吧台正上方）＋暖光
  for (const dx of [-barW / 3, barW / 3]) {
    const p = paper('pendant_lamp', { shadow: false, lift: 1.55 });
    p.position.set(barX + dx, 0, counterZ);
    add(p); papers.push(p);
    const light = new THREE.PointLight('#ffb46b', 4.5, 0, 1.6);
    light.position.set(barX + dx, 2.0, counterZ);
    add(light);
  }
  // 牆上的老溫度計（後牆，吧台左邊）與菜單黑板
  const thermo = paper('thermometer_frame', { shadow: false, lift: 1.1, scale: 0.8 });
  thermo.userData.wall = true;
  thermo.position.set(cx(bx0) - CELL * 0.9, 0, -RD / 2 + 0.03);
  add(thermo);
  const board = paper('menuBoard', { shadow: false, lift: 1.0, scale: 0.9 });
  board.userData.wall = true;
  board.position.set(cx(1), 0, -RD / 2 + 0.03);
  add(board);

  /* 光線（第一版的 hemi＋sun，外加一盞整體的暖光） */
  add(new THREE.HemisphereLight('#dfe8ff', '#a8865f', 1.5));
  const sun = new THREE.DirectionalLight('#fff1dc', 1.8);
  sun.position.set(-6, 5, -1.5);
  add(sun);
  const warm = new THREE.PointLight('#ffc98f', 3.0, 0, 1.2);
  warm.position.set(0, 2.4, 0.5);
  add(warm);

  return { room, papers };
}

/* ---------- 角落、擺飾、龍眼（隨佈置改變的部分） ---------- */
const CHAIR_ART = { chair: 'chair', rattanChair: 'rattanChair', stool: 'stool' };

// 圓桌（第一版 table()）：木頭桌面＋一根桌腳
function roundTable(st) {
  const g = new THREE.Group();
  const face = lambert({ map: loadTex('tex_wood_top', [0.7, 0.7]), color: st.id === 'rattan' ? '#f2dfb8' : '#ffffff' });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 28), [lambert({ color: '#8a5a3b' }), face, face]);
  top.position.y = 0.74;
  const legMat = lambert({ color: '#3a3330' });
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.74, 10), legMat);
  leg.position.y = 0.37;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 20), legMat);
  foot.position.y = 0.015;
  g.add(top, leg, foot);
  return g;
}

// 長桌（工作桌）：一整排三格；鐵件款桌面偏灰、桌腳是黑鐵
function longTable(len, alongX, st) {
  const g = new THREE.Group();
  const iron = st.id === 'iron';
  const w = alongX ? len : 0.62;
  const d = alongX ? 0.62 : len;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), lambert({ map: loadTex('tex_wood_top', [w, d]), color: iron ? '#b7b2aa' : '#ffffff' }));
  top.position.y = 0.74;
  g.add(top);
  const legMat = lambert({ color: iron ? '#2f3236' : '#6b4a33' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), legMat);
    leg.position.set(sx * (w / 2 - 0.06), 0.36, sz * (d / 2 - 0.06));
    g.add(leg);
  }
  return g;
}

// 一個角落的家具。回傳 { group, papers, chairs：[座位 index → 紙片], lamps：[世界座標] }
export function buildCorner(it) {
  const group = new THREE.Group();
  const papers = [];
  const chairs = [];
  const lamps = [];
  const st = styleOf(it);
  const uid = it.uid;
  const tag = (o) => { o.traverse((m) => { m.userData.uid = uid; }); return o; };
  const table = pieceCell(it, 'table');
  let tableC = null;
  if (table) {
    if (it.type === 'worktable') {
      const fp = footprint(it);
      const line = it.rot % 2 ? fp.filter((q) => q.x === table.x) : fp.filter((q) => q.y === table.y);
      const xs = line.map((q) => q.x);
      const ys = line.map((q) => q.y);
      tableC = { x: (cx(Math.min(...xs)) + cx(Math.max(...xs))) / 2, z: (cz(Math.min(...ys)) + cz(Math.max(...ys))) / 2 };
      const t = longTable(line.length * CELL - 0.12, !(it.rot % 2), st);
      t.position.set(tableC.x, 0, tableC.z);
      group.add(tag(t));
      // 檯燈：落地燈的圖縮小，放在桌上
      const lamp = paper('floorLamp_on', { shadow: false, lift: 0.76, maxH: 0.55, uid });
      lamp.position.set(cx(table.x), 0, cz(table.y) - 0.1);
      group.add(lamp); papers.push(lamp);
      lamps.push(new THREE.Vector3(cx(table.x), 1.15, cz(table.y)));
    } else {
      tableC = { x: cx(table.x), z: cz(table.y) };
      const t = roundTable(st);
      t.position.set(tableC.x, 0, tableC.z);
      group.add(tag(t));
    }
  }
  const chairArt = CHAIR_ART[st.chair] || 'stool';
  seatCells(it).forEach((s, i) => {
    const pos = { x: cx(s.x), z: cz(s.y) };
    // 椅子的圖是 3/4 側面、面向畫面左邊：桌子在右邊就左右翻，看起來是朝著桌子坐
    const flip = tableC ? tableC.x > pos.x + 0.05 : false;
    const p = paper(chairArt, { uid, flip, fit: CELL * 0.9 });
    p.position.set(pos.x, 0, pos.z);
    group.add(p); papers.push(p);
    chairs[i] = p;
  });
  const shelf = pieceCell(it, 'shelf');
  if (shelf) {
    const p = paper('bookshelf', { uid, fit: CELL * 0.92 });
    p.position.set(cx(shelf.x), 0, cz(shelf.y) - 0.15);
    group.add(p); papers.push(p);
  }
  return { group, papers, chairs, lamps, tableC };
}

const DECOR_OPT = {
  plant: { fit: CELL * 0.85 },
  frame: { fit: CELL * 0.6 },
  lamp: { fit: CELL * 0.7 },
  catbed: { fit: CELL * 0.95 },
};

export function buildDecor(d) {
  const p = paper(DECOR[d.type].art, { uid: d.uid, ...DECOR_OPT[d.type] });
  p.position.set(cx(d.x), 0, cz(d.y));
  const lamps = d.type === 'lamp' ? [new THREE.Vector3(cx(d.x), 1.3, cz(d.y))] : [];
  return { group: p, papers: [p], lamps };
}

// 整組佈置＋龍眼：回傳 { group, papers, chairsOf：uid → 椅子紙片陣列 }
// opt.catScale：俯視時龍眼放大一點（第一版 OVER_BIG 的意思）
export function buildLayout(layout, cat, opt = {}) {
  const group = new THREE.Group();
  const papers = [];
  const chairsOf = new Map();
  const lampPos = [];
  for (const it of [BAR_ITEM, ...layout.items]) {
    if (it.kind === 'decor') {
      const d = buildDecor(it);
      group.add(d.group); papers.push(...d.papers); lampPos.push(...d.lamps);
      continue;
    }
    if (it.type === 'bar') {
      // 吧台座：三張高腳椅
      const chairs = STOOL_CELLS.map((s) => {
        const p = paper('stool', { uid: 'bar', fit: CELL * 0.75 });
        p.position.set(cx(s.x), 0, cz(s.y) - 0.1);
        group.add(p); papers.push(p);
        return p;
      });
      chairsOf.set('bar', chairs);
      continue;
    }
    const c = buildCorner(it);
    group.add(c.group); papers.push(...c.papers); lampPos.push(...c.lamps);
    chairsOf.set(it.uid, c.chairs);
  }
  // 小燈、檯燈：真的會亮（暖光），最多四盞
  for (const p of lampPos.slice(0, 4)) {
    const l = new THREE.PointLight('#ffcf94', 1.6, 2.6, 1.4);
    l.position.copy(p);
    group.add(l);
  }
  if (cat) {
    const k = opt.catScale || 1;
    const p = paper('cat_longan_sleep', { scale: k, lift: cat.place === 'catbed' ? 0.08 : 0, shadow: cat.place !== 'catbed' });
    p.position.set(cx(cat.x), 0, cz(cat.y) + 0.06);
    group.add(p); papers.push(p);
  }
  return { group, papers, chairsOf };
}

// 丟掉一組東西的幾何與材質（貼圖是共用快取，不丟）
export function disposeGroup(g) {
  g.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose();
  });
}
