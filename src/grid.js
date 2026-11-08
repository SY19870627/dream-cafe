// 店面格子：佔地、合法性、路通不通（BFS）、角落的位置限制。
// 純邏輯，不碰 DOM／Three.js，用 node --test 測試。
//
// 座標：x 由左到右 0..6，y 由裡（吧台那面牆）到外（門）0..8；一格約 60 公分。
// 固定不能動：門（下方正中）、吧台與德叔的工作區（右上）、左側的窗、兩個插座、吧台前的三張高腳椅。

export const W = 7;
export const H = 9;

export const DOOR = { x: 3, y: 8 }; // 門內側那一格：要空著，也是客人進門的起點
export const WINDOW_ROWS = [1, 2, 3, 4, 5]; // 左牆（x = 0）開窗的那幾列
export const OUTLETS = [{ x: 6, y: 6 }, { x: 0, y: 7 }]; // 插座所在的牆邊那一格
export const BAR_CELLS = cellsOf(4, 0, 3, 2); // 吧台＋德叔的工作區
export const STOOL_CELLS = cellsOf(4, 2, 3, 1); // 吧台座（三張高腳椅）
export const BAR_FRONT = cellsOf(4, 3, 3, 1); // 吧台前 1 格要空著；客人從這裡上高腳椅
export const KEEP_CLEAR = [DOOR, ...BAR_FRONT];

// 角落。cells／seats 都是「沒轉向」時、相對左上角的格子
// need：位置限制（window 靠窗、outlet 靠插座、wall 靠牆）
export const CORNERS = {
  bar: {
    name: '吧台座', fixed: true, w: 3, h: 1, at: { x: 4, y: 2 },
    seats: [[0, 0], [1, 0], [2, 0]],
    styles: [{ id: 'stool', name: '高腳椅', color: '#8a6a4a' }],
  },
  window: {
    name: '窗邊雙人座', w: 2, h: 2, need: 'window', stock: 2,
    // 小桌＋兩張椅子＋小書架＋置包桌：椅子在對角，桌子與書架在另外兩格
    seats: [[0, 0], [1, 1]],
    pieces: { table: [1, 0], shelf: [0, 1] },
    styles: [
      { id: 'wood', name: '原木', color: '#b98a5a', chair: 'chair' },
      { id: 'rattan', name: '藤編', color: '#d4b47a', chair: 'rattanChair' },
    ],
  },
  worktable: {
    name: '工作桌', w: 3, h: 2, need: 'outlet', stock: 1,
    // 長桌佔第一排三格，兩張椅子在第二排的兩端，中間留給置物
    seats: [[0, 1], [2, 1]],
    pieces: { table: [1, 0] },
    styles: [
      { id: 'wood', name: '原木', color: '#a87b52', chair: 'chair' },
      { id: 'iron', name: '鐵件', color: '#6d7177', chair: 'stool' },
    ],
  },
};

// 小擺飾：1 格，可以自由放；貓窩決定龍眼睡哪裡
export const DECOR = {
  plant: { name: '盆栽', art: 'plant', stock: 2 },
  frame: { name: '相框', art: 'framedNapkin', stock: 1 },
  lamp: { name: '小燈', art: 'floorLamp_on', stock: 2 },
  catbed: { name: '貓窩', art: 'catCushion', stock: 1 },
};

export const REASONS = {
  out: '超出店面了',
  fixed: '那裡是吧台',
  clear: '門口和吧台前要留空',
  overlap: '跟別的東西疊在一起',
  window: '窗邊雙人座要靠窗',
  outlet: '工作桌要靠插座',
  wall: '要靠牆',
};

function cellsOf(x, y, w, h) {
  const out = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push({ x: x + i, y: y + j });
  return out;
}

const key = (c) => `${c.x},${c.y}`;
const inside = (c) => c.x >= 0 && c.y >= 0 && c.x < W && c.y < H;
const FIXED = new Set([...BAR_CELLS, ...STOOL_CELLS].map(key));
const CLEAR = new Set(KEEP_CLEAR.map(key));

// 轉向後的尺寸（rot 0..3，每次 90 度）
export function size(item) {
  if (item.kind === 'decor') return { w: 1, h: 1 };
  const c = CORNERS[item.type];
  return item.rot % 2 ? { w: c.h, h: c.w } : { w: c.w, h: c.h };
}

// 沒轉向時的相對格子 → 轉向後的相對格子（順時針）
export function rotateCell([cx, cy], rot, w, h) {
  switch (((rot % 4) + 4) % 4) {
    case 1: return [h - 1 - cy, cx];
    case 2: return [w - 1 - cx, h - 1 - cy];
    case 3: return [cy, w - 1 - cx];
    default: return [cx, cy];
  }
}

export function footprint(item) {
  const { w, h } = size(item);
  return cellsOf(item.x, item.y, w, h);
}

// 角落裡每個座位的絕對格子
export function seatCells(item) {
  const c = CORNERS[item.type];
  if (!c) return [];
  return c.seats.map((s) => {
    const [dx, dy] = rotateCell(s, item.rot || 0, c.w, c.h);
    return { x: item.x + dx, y: item.y + dy };
  });
}

export function pieceCell(item, piece) {
  const c = CORNERS[item.type];
  const p = c?.pieces?.[piece];
  if (!p) return null;
  const [dx, dy] = rotateCell(p, item.rot || 0, c.w, c.h);
  return { x: item.x + dx, y: item.y + dy };
}

// 吧台座是固定的角落，不放進 layout，但模擬與畫面都當成一個角落
export const BAR_ITEM = Object.freeze({ uid: 'bar', kind: 'corner', type: 'bar', x: 4, y: 2, rot: 0, style: 'stool', fixed: true });

export function emptyLayout() {
  return { items: [] };
}

export const cornersOf = (layout) => [BAR_ITEM, ...layout.items.filter((i) => i.kind === 'corner')];
export const playerCorners = (layout) => layout.items.filter((i) => i.kind === 'corner');

const touchesWindow = (cells) => cells.some((c) => c.x === 0 && WINDOW_ROWS.includes(c.y));
const touchesOutlet = (cells) => cells.some((c) => OUTLETS.some((o) => o.x === c.x && o.y === c.y));
const touchesWall = (cells) => cells.some((c) => c.x === 0 || c.x === W - 1 || c.y === 0);

// 單一物件放在這裡合不合法（規則 1～3）；ignoreUid：移動中的那件自己不算重疊
// 回傳 null 代表可以放，否則回傳原因代碼（見 REASONS）
export function placeProblem(layout, item, ignoreUid = item.uid) {
  const cells = footprint(item);
  if (!cells.every(inside)) return 'out';
  if (cells.some((c) => FIXED.has(key(c)))) return 'fixed';
  if (cells.some((c) => CLEAR.has(key(c)))) return 'clear';
  const taken = new Set();
  for (const other of layout.items) if (other.uid !== ignoreUid) for (const c of footprint(other)) taken.add(key(c));
  if (cells.some((c) => taken.has(key(c)))) return 'overlap';
  const need = item.kind === 'corner' ? CORNERS[item.type].need : null;
  if (need === 'window' && !touchesWindow(cells)) return 'window';
  if (need === 'outlet' && !touchesOutlet(cells)) return 'outlet';
  if (need === 'wall' && !touchesWall(cells)) return 'wall';
  return null;
}

// 走不過去的格子：固定物＋所有已放的東西
export function blockedSet(layout) {
  const s = new Set(FIXED);
  for (const it of layout.items) for (const c of footprint(it)) s.add(key(c));
  return s;
}

// 從門口 BFS：回傳 { dist: Map(key → 步數), prev: Map(key → 上一格 key) }
export function walkMap(layout, start = DOOR) {
  const blocked = blockedSet(layout);
  const dist = new Map();
  const prev = new Map();
  if (blocked.has(key(start))) return { dist, prev, blocked };
  dist.set(key(start), 0);
  const q = [start];
  while (q.length) {
    const c = q.shift();
    const d = dist.get(key(c));
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = key(n);
      if (!inside(n) || blocked.has(k) || dist.has(k)) continue;
      dist.set(k, d + 1);
      prev.set(k, key(c));
      q.push(n);
    }
  }
  return { dist, prev, blocked };
}

// 角落的入口：緊鄰佔地、可以站人的格子
export function entranceCells(layout, item, blocked = blockedSet(layout)) {
  if (item.type === 'bar') return BAR_FRONT.slice();
  const own = new Set(footprint(item).map(key));
  const out = [];
  const seen = new Set();
  for (const c of footprint(item)) {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = key(n);
      if (!inside(n) || own.has(k) || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

// 從門口走到某一格的路（含頭尾）；走不到回傳 null
export function pathTo(map, target) {
  let k = key(target);
  if (!map.dist.has(k)) return null;
  const out = [];
  while (k) {
    const [x, y] = k.split(',').map(Number);
    out.push({ x, y });
    k = map.prev.get(k);
  }
  return out.reverse();
}

// 這個角落最近的可到達入口；走不到回傳 null
export function nearestEntrance(layout, item, map = walkMap(layout)) {
  let best = null;
  for (const c of entranceCells(layout, item, map.blocked)) {
    const d = map.dist.get(key(c));
    if (d === undefined) continue;
    if (!best || d < best.d) best = { cell: c, d };
  }
  return best ? best.cell : null;
}

// 整間店能不能開（規則 1～4）
// ok：能開店；problems：各物件的問題；stuck：堵住、走不到的空格；unreachable：走不到入口的角落 uid
export function validate(layout) {
  const problems = [];
  for (const it of layout.items) {
    const p = placeProblem(layout, it);
    if (p) problems.push({ uid: it.uid, reason: p });
  }
  const map = walkMap(layout);
  const stuck = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = `${x},${y}`;
    if (!map.blocked.has(k) && !map.dist.has(k)) stuck.push({ x, y });
  }
  const barOk = BAR_FRONT.some((c) => map.dist.has(key(c)));
  const unreachable = playerCorners(layout).filter((it) => !nearestEntrance(layout, it, map)).map((it) => it.uid);
  return { ok: problems.length === 0 && barOk && unreachable.length === 0, problems, stuck, barOk, unreachable, map };
}

// 庫存：每種角落／擺飾還能拿幾個出來
export function remaining(layout, kind, type, stockOverride) {
  const def = kind === 'corner' ? CORNERS[type] : DECOR[type];
  const stock = stockOverride ?? def.stock ?? 1;
  return stock - layout.items.filter((i) => i.kind === kind && i.type === type).length;
}

// 版面的穩定字串（模擬的種子與存檔用）：與 uid、擺放順序無關
export function layoutKey(layout) {
  return layout.items
    .map((i) => `${i.kind}:${i.type}:${i.x},${i.y}:${i.rot || 0}:${i.style || ''}`)
    .sort()
    .join('|');
}

// 兩格是否相鄰（含斜角）；擺飾「布置在角落旁邊」用
export function nearItem(cell, item) {
  return footprint(item).some((c) => Math.abs(c.x - cell.x) <= 1 && Math.abs(c.y - cell.y) <= 1);
}
