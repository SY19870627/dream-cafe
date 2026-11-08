// 同一間店的 3D 場景：房間（木地板、石灰牆＋紅磚腰牆、左牆的窗、吧台、德叔、吊燈、溫度計）＋玩家擺的角落與擺飾＋龍眼。
// 俯視店面（shop3d.js）與座位視角（seat3d.js）都用這裡蓋出來的東西，兩邊是同一間店、同一套紙片。
// 房間、材質、燈光的做法參考第一版 legacy/src/main.js（addWall、addWindow、table、吊燈、hemi＋sun）。
//
// 座標：1 格 = CELL 公尺。格子 (x, y) 的中心 → 世界 (cx(x), ·, cz(y))；x 往右、y 往門口（+z）。
import * as THREE from 'three';
import {
  W, H, DOOR, WINDOW_ROWS, OUTLETS, BAR_CELLS, STOOL_CELLS, CORNERS, DECOR, TUNE, BAR_ITEM, seatCells, pieceCell, footprint, size,
  tableLine, cornerOpts, cornerWallSpot, flushSide, physicalSideOf, wallSideOf,
} from '../grid.js';
import { paper, loadTex, loadPaper, overlay } from './art3d.js';

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
const CHAIR_FIT = { chair: CELL * 0.9, rattanChair: CELL * 0.9, stool: CELL * 0.75, sofa: CELL * 0.98 };
const TABLE_TINT = { wood: '#ffffff', rattan: '#f2dfb8', iron: '#b7b2aa' };
const TABLE_PLAIN = { marble: '#ece8e1', white: '#f3eee6' }; // 不用木紋的桌面
const LEG_COLOR = { wood: '#6b4a33', rattan: '#8a6a45', marble: '#3a3330', iron: '#2f3236', white: '#d8d2c8' };
const PULL = 0.45; // 椅子從格子中心往桌子拉近的比例（一格 75 公分 → 拉近約 34 公分，椅面塞進桌緣底下一點）
const MAX_YAW = 0.6; // 椅子朝桌子最多偏轉多少（再多從俯視看就太窄）
const TOP_ART = { coaster: ['prop_coaster_menu', 0.1], succulent: ['succulent', 0.2], book: ['bookStack', 0.13] };
const CHAIR_BACK = { chair: 'chair_wood_back', rattanChair: 'chair_rattan_back', stool: 'stool_back', sofa: 'sofa_single_back' }; // 背對鏡頭時換的圖
// 椅面離地幾公尺（照畫師的圖、乘上 CHAIR_FIT 縮過以後的大小目測）：坐下的客人屁股要落在這裡（shop3d.js 的 sitLift）
// 木椅 0.42、藤搖椅 0.33（坐墊低）、圓凳／高腳椅 0.64、單人沙發 0.32
export const SEAT_H = { chair: 0.42, rattanChair: 0.33, stool: 0.64, sofa: 0.32 };

// 大理石桌面：畫師的圖還沒確認能無縫拼接，不重複貼——整張只用一次，長桌取中間一條（不拉長、不出接縫），再帶一點點暖色
function marbleMat(w, d) {
  const rep = w >= d ? [1, d / w] : [w / d, 1];
  return lambert({ map: loadTex('tex_marble_top', rep.map((v) => Math.round(v * 100) / 100)), color: '#fbf8f3' });
}

function topMat(table, w, d) {
  if (table === 'marble') return marbleMat(w, d);
  if (TABLE_PLAIN[table]) return lambert({ color: TABLE_PLAIN[table] });
  return lambert({ map: loadTex('tex_wood_top', [w, d]), color: TABLE_TINT[table] || '#ffffff' });
}

// 圓桌（第一版 table()）：桌面＋一根桌腳；low：唱片角的矮茶几。回傳 { g, h：桌面高度 }
function roundTable(table, low) {
  const g = new THREE.Group();
  const h = low ? 0.45 : 0.74;
  const r = low ? 0.3 : 0.32;
  const face = topMat(table, 0.7, 0.7);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 28), [lambert({ color: table === 'marble' ? '#cfc8bd' : '#8a5a3b' }), face, face]);
  top.position.y = h;
  const legMat = lambert({ color: LEG_COLOR[table] || '#3a3330' });
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 10), legMat);
  leg.position.y = h / 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 20), legMat);
  foot.position.y = 0.015;
  g.add(top, leg, foot);
  return { g, h: h + 0.02 };
}

// 長桌（工作桌）：一整排三格
function longTable(len, alongX, table) {
  const g = new THREE.Group();
  const w = alongX ? len : 0.62;
  const d = alongX ? 0.62 : len;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), topMat(table, w, d));
  top.position.y = 0.74;
  g.add(top);
  const legMat = lambert({ color: LEG_COLOR[table] || '#6b4a33' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), legMat);
    leg.position.set(sx * (w / 2 - 0.06), 0.36, sz * (d / 2 - 0.06));
    g.add(leg);
  }
  return g;
}

// 角落每個座位的椅子（也是坐下的客人）放在哪、朝哪：從格子中心往最近的桌格拉近 PULL，
// 椅子的圖是 3/4 側面、面向畫面左邊：桌子在右邊就左右翻；桌子在前後時再偏轉 yawOff（最多 MAX_YAW），看起來是朝著桌子坐
// 回傳 [{ x, z, flip, yawOff }]（世界座標）
export function seatSpots(it) {
  if (it.type === 'bar') return STOOL_CELLS.map((s) => ({ x: cx(s.x), z: cz(s.y) - 0.16, flip: false, yawOff: 0 })); // 高腳椅貼近吧台
  const tables = tableLine(it).map((q) => ({ x: cx(q.x), z: cz(q.y) }));
  const midX = tables.reduce((a, q) => a + q.x, 0) / (tables.length || 1);
  return seatCells(it).map((s) => {
    const x0 = cx(s.x);
    const z0 = cz(s.y);
    if (!tables.length) return { x: x0, z: z0, flip: false, yawOff: 0 };
    const t = tables.reduce((a, b) => (Math.hypot(b.x - x0, b.z - z0) < Math.hypot(a.x - x0, a.z - z0) ? b : a));
    const dx = t.x - x0;
    const dz = t.z - z0;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    // 桌子正前／正後方：看整張桌子的中間在哪邊（工作桌兩頭的椅子朝內）
    const flip = Math.abs(ux) > 0.05 ? ux > 0 : midX > x0 + 0.05;
    // rotation.y = θ 時，沒翻的圖面向 (-cosθ, sinθ)、翻過的面向 (cosθ, -sinθ)
    const raw = flip ? Math.atan2(-uz, ux) : Math.atan2(uz, -ux);
    return { x: x0 + dx * PULL, z: z0 + dz * PULL, flip, yawOff: Math.max(-MAX_YAW, Math.min(MAX_YAW, raw)), face: [ux, uz] };
  });
}

// 掛在牆上的紙片。side：back（後牆，貼平不轉）／left、right（側牆，俯視時斜斜朝鏡頭，見 faceCamera 的 wallFace）
// along：沿著牆的位置（後牆是 x，側牆是 z）
function wallPaper(name, side, along, opt) {
  const p = paper(name, { shadow: false, ...opt });
  if (side === 'back') {
    p.userData.wall = true;
    p.position.set(along, 0, -RD / 2 + 0.05);
  } else {
    const x = side === 'left' ? -RW / 2 : RW / 2;
    p.userData.wallFace = { side, x, z: along, hung: !!opt.lift };
    p.position.set(x, 0, along);
  }
  return p;
}

// 一個角落的家具。回傳 { group, papers, chairs：[座位 index → 紙片], lamps：[世界座標], spots：seatSpots, occluders：會擋住後面的高紙片 }
export function buildCorner(it) {
  const group = new THREE.Group();
  const papers = [];
  const chairs = [];
  const lamps = [];
  const occluders = [];
  const c = CORNERS[it.type];
  const o = cornerOpts(it);
  const uid = it.uid;
  const tag = (m) => { m.traverse((q) => { q.userData.uid = uid; }); return m; };
  const add = (p, x, z, occ = false) => {
    if (x !== undefined) p.position.set(x, 0, z);
    group.add(p);
    papers.push(p);
    if (occ) occluders.push(p);
    return p;
  };
  if (it.type === 'showcase') {
    buildShowcase(it, o, { group, add, tag, uid });
    return { group, papers, chairs, lamps, spots: [], occluders };
  }

  // 桌子＋桌上的燈與小物
  const line = tableLine(it);
  if (line.length) {
    const xs = line.map((q) => cx(q.x));
    const zs = line.map((q) => cz(q.y));
    const tc = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
    let topY;
    if (c.longTable) {
      const t = longTable(line.length * CELL - 0.12, !(it.rot % 2), o.table);
      t.position.set(tc.x, 0, tc.z);
      group.add(tag(t));
      topY = 0.77;
    } else {
      const { g, h } = roundTable(o.table, c.lowTable);
      g.position.set(tc.x, 0, tc.z);
      group.add(tag(g));
      topY = h;
    }
    // 沿著桌子的方向：燈放一頭、小物放另一頭
    const ax = c.longTable && it.rot % 2 ? 0 : 1;
    const az = 1 - ax;
    const reach = c.longTable ? 0.35 : 0.11;
    if (o.lamp === 'on') {
      const lx = tc.x - ax * reach;
      const lz = tc.z - az * reach - 0.08;
      add(paper('floorLamp_on', { shadow: false, lift: topY, maxH: c.longTable ? 0.55 : 0.42, uid }), lx, lz);
      lamps.push(new THREE.Vector3(lx, topY + 0.4, lz));
    }
    const top = TOP_ART[o.top];
    if (top) add(paper(top[0], { shadow: false, lift: topY, height: top[1], fit: 0.24, uid }), tc.x + ax * reach, tc.z + az * reach + 0.02);
  }

  // 椅子：往桌子拉近、朝著桌子；背對鏡頭時換椅背圖（faceCamera 裡切換）
  const spots = seatSpots(it);
  const chairArt = TUNE.chair.opts[o.chair]?.art || 'stool';
  spots.forEach((s, i) => {
    s.seatH = SEAT_H[o.chair] ?? SEAT_H.stool;
    const fit = CHAIR_FIT[o.chair] || CELL * 0.9;
    const p = paper(chairArt, { uid, flip: s.flip, fit });
    p.userData.yawOff = s.yawOff;
    if (CHAIR_BACK[o.chair] && s.face) p.userData.chair = { side: chairArt, back: CHAIR_BACK[o.chair], flip: s.flip, yawOff: s.yawOff, face: s.face, fit };
    add(p, s.x, s.z);
    chairs[i] = p;
  });

  // 窗邊座的矮書架／盆栽：貼著牆放（窗也是牆），不再整張對著鏡頭擋住後面的椅子；不貼牆時（轉到裡側）才立著。
  // 書架用畫師的矮書架圖（bookshelf_low），不再把高書架縮小
  const shelf = pieceCell(it, 'shelf');
  if (shelf && o.wall !== 'none') {
    const isShelf = o.wall !== 'plant';
    const art = isShelf ? 'bookshelf_low' : 'plant';
    const opt = isShelf ? { uid, height: 0.7, fit: CELL * 0.95 } : { uid, height: 0.85, fit: CELL * 0.8 };
    const side = physicalSideOf(shelf);
    if (side === 'left' || side === 'right') {
      const p = paper(art, opt);
      p.userData.wallFace = { side, x: side === 'left' ? -RW / 2 : RW / 2, z: cz(shelf.y) };
      add(p, p.userData.wallFace.x, cz(shelf.y), true);
    } else if (side === 'back' && isShelf) {
      const p = paper(art, opt);
      p.userData.wall = true;
      add(p, cx(shelf.x), -RD / 2 + 0.12, true);
    } else {
      add(paper(art, opt), cx(shelf.x), cz(shelf.y) - 0.15, true);
    }
  }

  // 唱片角：畫師的矮櫃（low_cabinet）＋唱盤疊在櫃面上（跟著矮櫃一起轉、一起仰）
  const player = pieceCell(it, 'player');
  if (player) {
    const cab = paper('low_cabinet', {
      uid, fit: CELL * 0.95, height: 0.42,
      onReady: (g) => overlay(g, 'recordPlayer', { u: 0.02, v: 0.86, w: 0.5, z: 0.02, uid }),
    });
    add(cab, cx(player.x), cz(player.y));
  }

  // 牆上：留言板／台灣地圖，掛在這組靠的那面牆
  if (o.wall === 'board' || o.wall === 'map') {
    const spot = cornerWallSpot(it);
    if (spot) {
      const along = spot.cells.reduce((a, q) => a + (spot.side === 'back' ? cx(q.x) : cz(q.y)), 0) / spot.cells.length;
      add(wallPaper(o.wall === 'board' ? 'noticeBoard' : 'map_taiwan', spot.side, along, { uid, lift: 1.2, height: 0.6, fit: 0.9 }));
    }
  }
  return { group, papers, chairs, lamps, spots, occluders };
}

// 商品展示櫃：畫師的三階層架整張圖（showcase_wood／showcase_white）貼著牆立著，
// 每一階疊一排陳列（goods_beans／goods_cups／goods_craft，一張就是一整排），上方一塊小黑板。
// TIERS：每一階踏面在層架圖裡的位置（u 中心、v 底邊、w 寬，都是佔整張圖的比例；照畫師的圖量的，兩款櫃子同一個構圖）。
// 越下面一階越靠前（z 大），前面那排蓋住後面那排的底
// w 取踏面寬的六成左右：豆袋約 0.25～0.3 公尺高，跟一階的落差（約 0.27 公尺）差不多；中間那排左右翻，三排才不會一模一樣
const TIERS = [{ u: 0.08, v: 0.93, w: 0.5, z: 0.01 }, { u: 0.02, v: 0.69, w: 0.53, z: 0.02, flip: true }, { u: -0.05, v: 0.44, w: 0.56, z: 0.03 }];
const SHOWCASE_H = 1.15; // 層架高度（公尺）
const SHOWCASE_SIDE_TILT = 1.15; // 貼側牆時俯視偏多一點：一整面寬 1.8 公尺，照一般的 0.5 會伸到房間中間

function buildShowcase(it, o, { add, uid }) {
  const side = flushSide(it) || 'back';
  const fp = footprint(it);
  const mx = fp.reduce((a, q) => a + cx(q.x), 0) / fp.length;
  const mz = fp.reduce((a, q) => a + cz(q.y), 0) / fp.length;
  const len = fp.length * CELL - 0.08;
  const goods = TUNE.goods.opts[o.goods]?.art || 'goods_beans';
  const p = paper(o.table === 'white' ? 'showcase_white' : 'showcase_wood', {
    uid, height: SHOWCASE_H, fit: len,
    onReady: (g) => { for (const t of TIERS) overlay(g, goods, { ...t, uid }); },
  });
  if (side === 'back') {
    p.userData.wall = true;
    add(p, mx, -RD / 2 + 0.1);
  } else {
    const x = side === 'left' ? -RW / 2 : RW / 2;
    p.userData.wallFace = { side, x, z: mz, tilt: SHOWCASE_SIDE_TILT };
    add(p, x, mz);
  }
  // 層架上方一塊小黑板（菜單黑板的圖縮小）；最上一排陳列會高出層架一點，黑板再往上讓開
  add(wallPaper('menuBoard', side, side === 'back' ? mx : mz, { uid, lift: SHOWCASE_H + 0.25, height: 0.34 }));
}

const DECOR_OPT = {
  plant: { fit: CELL * 0.8, maxH: 1.0 },
  frame: { fit: CELL * 0.6 },
  lamp: { fit: CELL * 0.6, maxH: 1.3 },
  catbed: { fit: CELL * 0.95 },
  cattree: { height: 1.2, fit: CELL * 0.95 },
};
const OCCLUDE = new Set(['plant', 'lamp', 'frame', 'cattree']); // 俯視時可能擋住後面椅子、客人的

// 擺飾。回傳 { group, papers, lamps, occluders }
export function buildDecor(d) {
  const def = DECOR[d.type];
  if (d.type === 'rug') return buildRug(d);
  if (def.layer === 'wall') return buildWallDecor(d);
  const p = paper(def.art, { uid: d.uid, ...DECOR_OPT[d.type] });
  p.position.set(cx(d.x), 0, cz(d.y));
  const lamps = d.type === 'lamp' ? [new THREE.Vector3(cx(d.x), 1.2, cz(d.y))] : [];
  return { group: p, papers: [p], lamps, occluders: OCCLUDE.has(d.type) ? [p] : [] };
}

// 地毯：畫師的方形整張地毯圖（rug_tile_square，約 496×496，不是可拼接的磚），裁掉留白後整張鋪一次、不重複。
// 佔地 2×2 的正方形：照圖的比例塞進去（圖幾乎是正方形，前後左右都貼滿，只留四周 8 公分）。
// 舊的 rug_tile.webp（橫長 1.64:1，前後會空一大條）留著沒刪
function buildRug(d) {
  const s = size(d);
  const W = s.w * CELL - 0.16;
  const D = s.h * CELL - 0.16;
  const mat = lambert({ transparent: true, alphaTest: 0.35 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx(d.x) + ((s.w - 1) * CELL) / 2, 0.004, cz(d.y) + ((s.h - 1) * CELL) / 2);
  m.userData.uid = d.uid;
  m.visible = false;
  loadPaper('rug_tile_square').then((a) => {
    if (!a) return;
    const k = Math.min(W / a.w, D / a.h);
    m.scale.set(a.w * k, a.h * k, 1);
    mat.map = a.tex;
    mat.needsUpdate = true;
    m.visible = true;
  });
  return { group: m, papers: [], lamps: [], occluders: [] };
}

// 掛牆上的：留言板、台灣地圖、書牆、綠植牆（畫師的兩層木板＋盆栽整張圖）
const WALL_ART = {
  board: { art: 'noticeBoard', height: 0.62, lift: 1.15 },
  map: { art: 'map_taiwan', height: 0.72, lift: 1.08 },
  bookwall: { art: 'bookWall', height: 0.9, lift: 0.95 },
  greenwall: { art: 'wall_shelf_plants', height: 0.75, lift: 0.9 },
};
function buildWallDecor(d) {
  const side = wallSideOf(d) || 'back';
  const along = side === 'back' ? cx(d.x) : cz(d.y);
  const group = new THREE.Group();
  const papers = [];
  const a = WALL_ART[d.type];
  const p = wallPaper(a.art, side, along, { uid: d.uid, height: a.height, lift: a.lift, fit: CELL * 1.1 });
  group.add(p); papers.push(p);
  return { group, papers, lamps: [], occluders: [] };
}

// 整組佈置＋龍眼：回傳 { group, papers, chairsOf：uid → 椅子紙片陣列, spotsOf：uid → seatSpots, occluders }
// opt.catScale：俯視時龍眼放大一點（第一版 OVER_BIG 的意思）
export function buildLayout(layout, cat, opt = {}) {
  const group = new THREE.Group();
  const papers = [];
  const chairsOf = new Map();
  const spotsOf = new Map();
  const occluders = [];
  const lampPos = [];
  for (const it of [BAR_ITEM, ...layout.items]) {
    if (it.kind === 'decor') {
      const d = buildDecor(it);
      group.add(d.group); papers.push(...d.papers); lampPos.push(...d.lamps); occluders.push(...d.occluders);
      continue;
    }
    if (it.type === 'bar') {
      // 吧台座：三張高腳椅，貼近吧台
      const spots = seatSpots(BAR_ITEM).map((s) => ({ ...s, seatH: SEAT_H.stool }));
      const chairs = spots.map((s) => {
        const p = paper('stool', { uid: 'bar', fit: CELL * 0.75 });
        p.position.set(s.x, 0, s.z);
        group.add(p); papers.push(p);
        return p;
      });
      chairsOf.set('bar', chairs);
      spotsOf.set('bar', spots);
      continue;
    }
    const c = buildCorner(it);
    group.add(c.group); papers.push(...c.papers); lampPos.push(...c.lamps); occluders.push(...c.occluders);
    chairsOf.set(it.uid, c.chairs);
    spotsOf.set(it.uid, c.spots);
  }
  // 小燈、檯燈：真的會亮（暖光），最多四盞
  for (const p of lampPos.slice(0, 4)) {
    const l = new THREE.PointLight('#ffcf94', 1.6, 2.6, 1.4);
    l.position.copy(p);
    group.add(l);
  }
  if (cat) {
    const k = opt.catScale || 1;
    const p = cat.place === 'cattree'
      ? paper('cat_longan_sit', { scale: k })
      : paper('cat_longan_sleep', { scale: k, lift: cat.place === 'catbed' ? 0.08 : 0, shadow: cat.place !== 'catbed' });
    p.position.set(cx(cat.x) + (cat.place === 'cattree' ? 0.2 : 0), 0, cz(cat.y) + (cat.place === 'cattree' ? 0.14 : 0.06));
    group.add(p); papers.push(p);
  }
  return { group, papers, chairsOf, spotsOf, occluders };
}

// 丟掉一組東西的幾何與材質（貼圖是共用快取，不丟）
export function disposeGroup(g) {
  g.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose();
  });
}
