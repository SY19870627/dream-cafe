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

// 角落選取後可以個別調的東西（桌、椅、張數、桌上、燈、牆上／旁邊、陳列）。
// 每個角落在 tune 裡列出自己能選哪些、第一個是預設；存在 layout item 的 opts（例如 { table, chair, seats, top, lamp, wall }），
// 缺欄位（舊存檔）就用款式（style）或預設補上。art／color 是選項卡片上的小圖。
export const TUNE = {
  table: {
    label: '桌子',
    opts: {
      wood: { name: '原木', color: '#b98a5a' }, marble: { name: '白石', color: '#e6e1d8' }, rattan: { name: '藤面', color: '#d4b47a' },
      iron: { name: '鐵件', color: '#6d7177' }, white: { name: '白漆', color: '#f4efe6' },
    },
  },
  chair: {
    label: '椅子',
    opts: { chair: { name: '木椅', art: 'chair' }, rattanChair: { name: '藤椅', art: 'rattanChair' }, stool: { name: '圓凳', art: 'stool' }, sofa: { name: '沙發', art: 'sofa_single' } },
  },
  seats: { label: '張數', opts: { 1: { name: '一張' }, 2: { name: '兩張' } } },
  top: {
    label: '桌上',
    opts: { none: { name: '空著' }, coaster: { name: '杯墊', art: 'prop_coaster_menu' }, succulent: { name: '小盆栽', art: 'succulent' }, book: { name: '書', art: 'bookStack' } },
  },
  lamp: { label: '燈', opts: { off: { name: '不放', art: 'floorLamp_off' }, on: { name: '檯燈', art: 'floorLamp_on' } } },
  wall: {
    label: '牆上',
    opts: {
      none: { name: '不放' }, shelf: { name: '小書架', art: 'bookshelf_low' }, plant: { name: '盆栽', art: 'plant' },
      board: { name: '留言板', art: 'noticeBoard' }, map: { name: '台灣地圖', art: 'map_taiwan' },
    },
  },
  goods: { label: '陳列', opts: { beans: { name: '咖啡豆', art: 'goods_beans' }, cups: { name: '杯具', art: 'goods_cups' }, craft: { name: '文創小物', art: 'goods_craft' } } },
};

// 角落。cells／seats 都是「沒轉向」時、相對左上角的格子
// need：位置限制（window 靠窗、outlet 靠插座、wall 靠牆、flush 整排貼牆）
// tune：選取後能個別調的項目（見 TUNE）；tuneLabel：這個角落裡該項目換個叫法；styles：整組款式（放下時挑，等於一組預設的 tune）
export const CORNERS = {
  bar: {
    name: '吧台座', fixed: true, w: 3, h: 1, at: { x: 4, y: 2 },
    seats: [[0, 0], [1, 0], [2, 0]],
    styles: [{ id: 'stool', name: '高腳椅', color: '#8a6a4a' }],
  },
  window: {
    name: '窗邊雙人座', w: 2, h: 2, need: 'window', stock: 2,
    // 小桌＋兩張椅子＋小書架＋置包桌：椅子在對角，桌子與書架在另外兩格；張數選一張時，第二張椅子那格空著放包
    seats: [[0, 0], [1, 1]],
    pieces: { table: [1, 0], shelf: [0, 1] },
    styles: [
      { id: 'wood', name: '原木', color: '#b98a5a', chair: 'chair', table: 'wood' },
      { id: 'rattan', name: '藤編', color: '#d4b47a', chair: 'rattanChair', table: 'rattan' },
    ],
    tune: {
      table: ['wood', 'marble', 'rattan'], chair: ['chair', 'rattanChair', 'stool'], seats: [2, 1],
      top: ['none', 'coaster', 'succulent', 'book'], lamp: ['off', 'on'], wall: ['shelf', 'plant', 'none'],
    },
    tuneLabel: { wall: '旁邊' },
  },
  worktable: {
    name: '工作桌', w: 3, h: 2, need: 'outlet', stock: 1, longTable: true,
    // 長桌佔第一排三格，兩張椅子在第二排的兩端，中間留給置物
    seats: [[0, 1], [2, 1]],
    pieces: { table: [1, 0] },
    styles: [
      { id: 'wood', name: '原木', color: '#a87b52', chair: 'chair', table: 'wood' },
      { id: 'iron', name: '鐵件', color: '#6d7177', chair: 'stool', table: 'iron' },
    ],
    tune: {
      table: ['wood', 'iron', 'white'], chair: ['chair', 'stool', 'rattanChair'], seats: [2, 1],
      top: ['none', 'coaster', 'succulent', 'book'], lamp: ['on', 'off'], wall: ['none', 'board', 'map'],
    },
  },
  // 唱片角：靠牆，沙發兩個位子在後排，前排一張矮桌、一台唱盤放在矮櫃上（結伴來的人喜歡）
  record: {
    name: '唱片角', w: 2, h: 2, need: 'wall', stock: 1, art: 'recordPlayer', lowTable: true,
    seats: [[0, 0], [1, 0]],
    pieces: { table: [0, 1], player: [1, 1] },
    styles: [{ id: 'wood', name: '原木', color: '#8a5a3b', chair: 'sofa', table: 'wood' }],
    tune: {
      table: ['wood', 'marble'], chair: ['sofa', 'rattanChair', 'chair'], seats: [2, 1],
      top: ['none', 'coaster', 'succulent', 'book'], lamp: ['on', 'off'], wall: ['none', 'board', 'map'],
    },
  },
  // 整面牆的商品展示櫃：1×3、整排貼著牆（窗前、吧台除外），沒有座位；客人會停下來看（觀光客、街坊）
  showcase: {
    name: '商品展示櫃', w: 3, h: 1, need: 'flush', stock: 1, art: 'showcase_wood', tall: true,
    seats: [],
    styles: [
      { id: 'wood', name: '原木櫃', color: '#a87b52', table: 'wood' },
      { id: 'white', name: '白櫃', color: '#f1ece3', table: 'white' },
    ],
    tune: { table: ['wood', 'white'], goods: ['beans', 'cups', 'craft'] },
    tuneLabel: { table: '櫃子' },
  },
};

// 擺飾：預設 1 格、自由放；w／h 可以更大。貓窩、貓跳台決定龍眼待哪裡。
// layer：'wall' 掛在牆上（只能放牆邊那一圈、不擋路，可以掛在別的東西上方）；'rug' 鋪在地上（不擋路，桌椅可以壓在上面）
// need：'wall' 要靠牆
export const DECOR = {
  plant: { name: '盆栽', art: 'plant', stock: 2 },
  frame: { name: '相框', art: 'framedNapkin', stock: 1 },
  lamp: { name: '小燈', art: 'floorLamp_on', stock: 2 },
  catbed: { name: '貓窩', art: 'catCushion', stock: 1 },
  cattree: { name: '貓跳台', art: 'catTree', stock: 1, need: 'wall' },
  rug: { name: '地毯', art: 'rug_tile', color: '#b5523b', w: 2, h: 2, layer: 'rug', stock: 1 },
  greenwall: { name: '綠植牆', art: 'wall_shelf_plants', layer: 'wall', stock: 2 },
  board: { name: '留言板', art: 'noticeBoard', layer: 'wall', stock: 1 },
  map: { name: '台灣地圖', art: 'map_taiwan', layer: 'wall', stock: 1 },
  bookwall: { name: '書牆', art: 'bookWall', layer: 'wall', stock: 1 },
};

export const REASONS = {
  out: '超出店面了',
  fixed: '那裡是吧台',
  clear: '門口和吧台前要留空',
  overlap: '跟別的東西疊在一起',
  window: '窗邊雙人座要靠窗',
  outlet: '工作桌要靠插座',
  wall: '要靠牆',
  flush: '展示櫃要整排貼著牆（窗前、吧台那面不行）',
  wallonly: '要掛在牆上（窗戶和吧台那面不行）',
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
  if (item.kind === 'decor') { const d = DECOR[item.type]; return { w: d?.w || 1, h: d?.h || 1 }; }
  const c = CORNERS[item.type];
  return item.rot % 2 ? { w: c.h, h: c.w } : { w: c.w, h: c.h };
}

// 'solid' 擋路的家具／'wall' 掛牆上的／'rug' 地毯
export const layerOf = (item) => (item.kind === 'decor' && DECOR[item.type]?.layer) || 'solid';

// 兩件東西佔同一格算不算撞到：同一層才算；掛牆上的另外不能掛在高的展示櫃那幾格
const isTall = (it) => it.kind === 'corner' && !!CORNERS[it.type]?.tall;
function collides(a, b) {
  const la = layerOf(a);
  const lb = layerOf(b);
  if (la === lb) return true;
  return (la === 'wall' && isTall(b)) || (lb === 'wall' && isTall(a));
}

// 角落款式＋細調，補齊成完整的 opts（舊存檔缺欄位、或選項不在清單裡，就用款式的或清單第一個）
export function cornerOpts(item) {
  const c = CORNERS[item.type];
  if (!c?.tune) return {};
  const st = c.styles.find((s) => s.id === item.style) || c.styles[0];
  const o = item.opts || {};
  const out = {};
  for (const [k, list] of Object.entries(c.tune)) {
    const v = k === 'seats' && o[k] != null ? Number(o[k]) : o[k];
    out[k] = list.includes(v) ? v : (list.includes(st[k]) ? st[k] : list[0]);
  }
  return out;
}

// 選項的名字（細調列、名牌用）
export const tuneLabel = (type, k) => CORNERS[type]?.tuneLabel?.[k] || TUNE[k].label;
export const tuneName = (k, v) => TUNE[k]?.opts[v]?.name || String(v);

// 名牌：角落・桌子（或櫃子）的樣子
export function cornerLabel(item) {
  const c = CORNERS[item.type];
  if (!c.tune?.table) return `${c.name}・${(c.styles.find((s) => s.id === item.style) || c.styles[0]).name}`;
  return `${c.name}・${tuneName('table', cornerOpts(item).table)}`;
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
  const n = c.tune?.seats ? cornerOpts(item).seats : c.seats.length; // 細調成一張：只留第一張
  return c.seats.slice(0, n).map((s) => {
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

// 長桌那一整排的格子（工作桌：沒轉向時是第一排三格）
export function tableLine(item) {
  const table = pieceCell(item, 'table');
  if (!table) return [];
  if (!CORNERS[item.type].longTable) return [table];
  return footprint(item).filter((q) => (item.rot % 2 ? q.x === table.x : q.y === table.y));
}

// 角落每一格放的是什麼（seat／table／shelf／plant／player／goods，空的那格不列）；選取時畫在地上，轉向後一眼看得出換了邊
export function pieceCells(item) {
  const c = CORNERS[item.type];
  if (!c || item.kind === 'decor') return [];
  const o = cornerOpts(item);
  const out = seatCells(item).map((s) => ({ ...s, piece: 'seat' }));
  for (const q of tableLine(item)) out.push({ ...q, piece: 'table' });
  const shelf = pieceCell(item, 'shelf');
  if (shelf && (o.wall ?? 'shelf') !== 'none') out.push({ ...shelf, piece: o.wall === 'plant' ? 'plant' : 'shelf' });
  const player = pieceCell(item, 'player');
  if (player) out.push({ ...player, piece: 'player' });
  if (c.tune?.goods) for (const q of footprint(item)) out.push({ ...q, piece: 'goods' });
  return out;
}

// 牆邊的格子靠哪一面牆：後牆（吧台那面除外）優先，左牆的窗那幾列不算（前面沒有牆）
export function wallSideOf(cell) {
  if (FIXED.has(key(cell))) return null;
  if (cell.y === 0) return 'back';
  if (cell.x === 0 && !WINDOW_ROWS.includes(cell.y)) return 'left';
  if (cell.x === W - 1) return 'right';
  return null;
}

// 這格實際貼著哪面牆（窗也算牆；角落附屬的書架貼牆放用）
export function physicalSideOf(cell) {
  if (cell.y === 0) return 'back';
  if (cell.x === 0) return 'left';
  if (cell.x === W - 1) return 'right';
  return null;
}

// 整排都貼著同一面牆：回傳那面牆，否則 null（展示櫃）
export function flushSide(item) {
  const sides = footprint(item).map(wallSideOf);
  return sides[0] && sides.every((s) => s === sides[0]) ? sides[0] : null;
}

// 角落的牆位（細調「牆上」掛在這裡）：佔地碰到最多格的那面牆，回傳 { side, cells }；沒靠牆回傳 null
export function cornerWallSpot(item) {
  const by = {};
  for (const c of footprint(item)) {
    const s = wallSideOf(c);
    if (s) (by[s] ||= []).push(c);
  }
  let best = null;
  for (const s of ['back', 'left', 'right']) if (by[s] && (!best || by[s].length > best.cells.length)) best = { side: s, cells: by[s] };
  return best;
}

// 吧台座是固定的角落，不放進 layout，但模擬與畫面都當成一個角落
export const BAR_ITEM = Object.freeze({ uid: 'bar', kind: 'corner', type: 'bar', x: 4, y: 2, rot: 0, style: 'stool', fixed: true });

export function emptyLayout() {
  return { items: [] };
}

export const cornersOf = (layout) => [BAR_ITEM, ...layout.items.filter((i) => i.kind === 'corner')];
export const playerCorners = (layout) => layout.items.filter((i) => i.kind === 'corner');
// 有座位的角落（展示櫃不算）：第 1 章「擺出一組」、模擬的座位都看這個
export const seatingCorners = (layout) => playerCorners(layout).filter((i) => seatCells(i).length > 0);

const touchesWindow = (cells) => cells.some((c) => c.x === 0 && WINDOW_ROWS.includes(c.y));
const touchesOutlet = (cells) => cells.some((c) => OUTLETS.some((o) => o.x === c.x && o.y === c.y));
const touchesWall = (cells) => cells.some((c) => c.x === 0 || c.x === W - 1 || c.y === 0);

// 單一物件放在這裡合不合法（規則 1～3）；ignoreUid：移動中的那件自己不算重疊
// 回傳 null 代表可以放，否則回傳原因代碼（見 REASONS）
// 掛牆上的不擋路，不用避開門口與吧台前；地毯也不擋路
export function placeProblem(layout, item, ignoreUid = item.uid) {
  const cells = footprint(item);
  if (!cells.every(inside)) return 'out';
  if (cells.some((c) => FIXED.has(key(c)))) return 'fixed';
  const layer = layerOf(item);
  if (layer === 'wall' && !cells.every(wallSideOf)) return 'wallonly';
  if (layer === 'solid' && cells.some((c) => CLEAR.has(key(c)))) return 'clear';
  const taken = new Set();
  for (const other of layout.items) if (other.uid !== ignoreUid && collides(item, other)) for (const c of footprint(other)) taken.add(key(c));
  if (cells.some((c) => taken.has(key(c)))) return 'overlap';
  const need = item.kind === 'corner' ? CORNERS[item.type].need : DECOR[item.type]?.need;
  if (need === 'window' && !touchesWindow(cells)) return 'window';
  if (need === 'outlet' && !touchesOutlet(cells)) return 'outlet';
  if (need === 'wall' && !touchesWall(cells)) return 'wall';
  if (need === 'flush' && !flushSide(item)) return 'flush';
  return null;
}

// 走不過去的格子：固定物＋所有已放、會擋路的東西（掛牆上的、地毯不算）
export function blockedSet(layout) {
  const s = new Set(FIXED);
  for (const it of layout.items) if (layerOf(it) === 'solid') for (const c of footprint(it)) s.add(key(c));
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

// 點了某一格：這種角落／擺飾蓋住這一格、最好的擺法（轉向、往旁邊挪都試；路通的優先、不轉的優先、離這一格近的優先）
// 回傳 { item } 或 { reason }（放不下的原因代碼）
// 擺飾不轉向（地毯 2×2 一樣會往旁邊挪著試）
export function bestPlacementAt(layout, kind, type, cell, style) {
  let best = null;
  let firstReason = null;
  for (let rot = 0; rot < (kind === 'corner' ? 4 : 1); rot++) {
    const s = size({ kind, type, rot });
    for (let x = cell.x - s.w + 1; x <= cell.x; x++) for (let y = cell.y - s.h + 1; y <= cell.y; y++) {
      const cand = kind === 'corner'
        ? { kind, type, x, y, rot, style: style || CORNERS[type].styles[0].id, uid: '__new' }
        : { kind, type, x, y, rot: 0, uid: '__new' };
      const p = placeProblem(layout, cand, '__new');
      if (p) { firstReason ||= p; continue; }
      const ok = validate({ items: [...layout.items, cand] }).ok;
      const fx = x + s.w / 2 - 0.5 - cell.x;
      const fy = y + s.h / 2 - 0.5 - cell.y;
      const score = (ok ? 0 : 10) + (rot ? 0.5 : 0) + Math.hypot(fx, fy) * 0.1;
      if (!best || score < best.score) best = { item: cand, score };
    }
  }
  return best ? { item: best.item } : { reason: firstReason || 'out' };
}

// 這種角落／擺飾在店裡哪些空格放得下（點下方角落列時，把這些格子淡淡標出來）
// （跟 bestPlacementAt 同一套規則：只要有一個合法擺法蓋住這一格就算；這裡不跑 BFS，每次畫面更新都算得起）
export function placeableCells(layout, kind, type) {
  const ok = new Set();
  for (let rot = 0; rot < (kind === 'corner' ? 4 : 1); rot++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cand = { kind, type, x, y, rot, uid: '__new' };
      if (!placeProblem(layout, cand, '__new')) for (const c of footprint(cand)) ok.add(key(c));
    }
  }
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ok.has(`${x},${y}`)) out.push({ x, y });
  return out;
}

// 庫存：每種角落／擺飾還能拿幾個出來
export function remaining(layout, kind, type, stockOverride) {
  const def = kind === 'corner' ? CORNERS[type] : DECOR[type];
  const stock = stockOverride ?? def.stock ?? 1;
  return stock - layout.items.filter((i) => i.kind === kind && i.type === type).length;
}

// 細調裡跟款式預設不一樣的那幾項（沒調過就是空字串：舊存檔、舊測試的種子不變）
function optsKey(item) {
  if (!item.opts || !CORNERS[item.type]?.tune) return '';
  const o = cornerOpts(item);
  const d = cornerOpts({ ...item, opts: undefined });
  const diff = Object.keys(o).filter((k) => o[k] !== d[k]).map((k) => `${k}=${o[k]}`);
  return diff.length ? `:${diff.join(',')}` : '';
}

// 一件東西的穩定字串
export const itemKey = (i) => `${i.kind}:${i.type}:${i.x},${i.y}:${i.rot || 0}:${i.style || ''}${optsKey(i)}`;

// 版面的穩定字串（模擬的種子與存檔用）：與 uid、擺放順序無關
export function layoutKey(layout) {
  return layout.items.map(itemKey).sort().join('|');
}

// 兩格是否相鄰（含斜角）；擺飾「布置在角落旁邊」用
export function nearItem(cell, item) {
  return footprint(item).some((c) => Math.abs(c.x - cell.x) <= 1 && Math.abs(c.y - cell.y) <= 1);
}

// 兩件東西挨在一起（含斜角、含疊在一起，例如角落壓在地毯上）
export const itemsNear = (a, b) => footprint(a).some((c) => nearItem(c, b));
