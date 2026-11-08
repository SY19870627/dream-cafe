// 營業模擬：誰來、坐哪、點什麼、做什麼。純邏輯，不開畫面就能跑完一天。
// 固定亂數種子：同樣的佈置＋菜單＋同一天，永遠得到同樣的結果（種子由這三樣算出來）。
import {
  DOOR, WINDOW_ROWS, CORNERS, cornersOf, seatCells, walkMap, nearestEntrance, pathTo, layoutKey, itemKey, nearItem, itemsNear, blockedSet, cornerOpts,
} from './grid.js';
import { menuItems, matchScore, keysOf, weirdness, menuKey, DESHU_CUP } from './menu.js';

export const DAY_LEN = 90; // 營業約 90 秒（1×）
const WALK = 0.45; // 走一格幾秒

// 一般客人（規格書「客人與熟客」）。likes：會被哪個角落吸引；taste：口味關鍵字
export const GUESTS = {
  resident: { name: '小鎮居民', short: '居', color: '#8c6b4f', likes: 'bar', taste: ['熱', '不加'] },
  solo: { name: '獨坐的人', short: '獨', color: '#5f7f8f', likes: 'window', taste: ['手沖', '果酸'] },
  laptop: { name: '帶筆電的人', short: '筆', color: '#6c6f9a', likes: 'worktable', taste: ['冰', '清爽'] },
  pair: { name: '結伴來的人', short: '伴', color: '#b0705d', likes: 'record', size: 2, taste: ['甜', '奶香'] },
  catlover: { name: '愛貓的人', short: '貓', color: '#c58b3a', likes: 'catbed', taste: [] },
  tourist: { name: '觀光客', short: '觀', color: '#5d8a62', likes: null, taste: ['在地'] },
};

// 這杯比德叔那杯更合哪幾種客人的口味（第 2 章的提示用）
export const beatsDeshu = (recipe) => Object.keys(GUESTS).filter((t) => matchScore(recipe, GUESTS[t].taste) > matchScore(DESHU_CUP, GUESTS[t].taste));

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const daySeed = (layout, menu, day) => hashString(`${layoutKey(layout)}#${menuKey(menu)}#${day}`);

function pickWeighted(rng, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

// 龍眼睡哪裡：有貓窩就睡貓窩；再來是貓跳台旁邊；沒有就挑窗邊曬得到太陽的地板，再不然睡吧台旁邊
export function catSpot(layout) {
  const bed = layout.items.find((i) => i.kind === 'decor' && i.type === 'catbed');
  if (bed) return { x: bed.x, y: bed.y, place: 'catbed' };
  const tree = layout.items.find((i) => i.kind === 'decor' && i.type === 'cattree');
  if (tree) return { x: tree.x, y: tree.y, place: 'cattree' };
  const blocked = blockedSet(layout);
  for (const y of WINDOW_ROWS) if (!blocked.has(`0,${y}`)) return { x: 0, y, place: 'window' };
  for (const c of [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 0 }]) if (!blocked.has(`${c.x},${c.y}`)) return { ...c, place: 'bar' };
  return { x: DOOR.x, y: DOOR.y, place: 'door' };
}

// 每種角落最吸引哪種客人
export const FAN = { bar: 'resident', window: 'solo', worktable: 'laptop', record: 'pair' };

const isCatPlace = (cat) => cat.place === 'catbed' || cat.place === 'cattree';

// 店裡吸引各種客人的權重
export function guestWeights(layout, menu) {
  const corners = cornersOf(layout).filter((c) => seatCells(c).length); // 有座位的（展示櫃另外算）
  const decor = layout.items.filter((i) => i.kind === 'decor');
  const has = (t) => corners.some((c) => c.type === t);
  const hasDecor = (t) => decor.some((d) => d.type === t);
  const sig = menu.signature != null ? menu.slots[menu.signature] : null;
  const w = {
    resident: 2.2,
    solo: 0.5 + (has('window') ? 2.4 : 0),
    laptop: 0.3 + (has('worktable') ? 2.4 : 0),
    pair: 0.8 + (corners.some((c) => c.type !== 'bar') ? 0.6 : 0) + (has('record') ? 1.2 : 0),
    catlover: (hasDecor('catbed') ? 1.4 : 0) + (hasDecor('cattree') ? 1.0 : 0),
    tourist: 0.4 + (sig && keysOf(sig).has('在地') ? 1.2 : 0) + (hasDecor('frame') ? 0.4 : 0) + (hasDecor('map') ? 0.5 : 0),
  };
  // 展示櫃：外地人進門會先看櫃子，街坊會來問豆子；擺什麼也有差
  for (const s of layout.items) {
    if (s.kind !== 'corner' || s.type !== 'showcase') continue;
    w.tourist += 0.9;
    w.resident += 0.3;
    const g = cornerOpts(s).goods;
    if (g === 'beans') w.resident += 0.3;
    if (g === 'craft') w.tourist += 0.4;
    if (g === 'cups') w.pair += 0.3;
  }
  // 牆上、地上的：留言板街坊會看、書牆和綠植是給自己來的人的
  if (hasDecor('board')) w.resident += 0.3;
  if (hasDecor('bookwall')) w.solo += 0.4;
  if (hasDecor('greenwall')) w.solo += 0.3;
  // 角落細調
  for (const c of corners) tuneWeights(c, w);
  // 擺飾布置在角落旁邊：那個角落更吸引它的客人（地毯鋪在角落底下也算）
  for (const d of decor) {
    if (d.type === 'catbed' || d.type === 'cattree') continue;
    for (const c of corners) if (FAN[c.type] && itemsNear(d, c)) w[FAN[c.type]] += 0.4;
  }
  return w;
}

// 細調對客人的影響：跟這種角落的第一個款式比，有差才加減（沒調過的舊佈置權重不變）
function tuneWeights(c, w) {
  if (!CORNERS[c.type].tune) return;
  const o = cornerOpts(c);
  const base = cornerOpts({ type: c.type });
  const fan = FAN[c.type];
  if (o.lamp !== base.lamp && fan) w[fan] += o.lamp === 'on' ? 0.3 : -0.3; // 有一盞燈，坐得久
  if (o.top === 'book') w.solo += 0.3;
  if (o.top === 'succulent') w.solo += 0.15;
  if (o.top === 'coaster') w.tourist += 0.15;
  if (o.seats === 1 && c.type === 'window') w.solo += 0.5; // 一個人的位子
  if (o.wall === 'plant') w.solo += 0.2;
  if (o.wall === 'board') w.resident += 0.2;
  if (o.wall === 'map') w.tourist += 0.3;
  if (o.chair !== base.chair && o.chair === 'rattanChair') w.tourist += 0.15;
  if (o.chair !== base.chair && o.chair === 'sofa') w.pair += 0.2;
}

// 客人為什麼坐這裡（點客人時看得到）：不用亂數，照角落、細調、旁邊擺了什麼說
const LIKE_WHY = {
  resident: '習慣坐吧台跟德叔講話', solo: '想坐窗邊', laptop: '要插座開筆電', pair: '想一起聽唱片', catlover: '龍眼就在旁邊',
};
function whyHere(type, corner, { liked, waited, decor, cat, showcases }) {
  const bits = [];
  if (liked) bits.push(LIKE_WHY[type]);
  else if (GUESTS[type].size > 1 && corner.type !== 'bar') bits.push('兩個人想要自己的一張桌子');
  const o = cornerOpts(corner);
  if (o.seats === 1 && type === 'solo') bits.push('一個人的位子剛好');
  if (o.lamp === 'on' && corner.type !== 'worktable') bits.push('桌上有一盞燈');
  if (o.top === 'book') bits.push('桌上有書');
  if (o.top === 'succulent') bits.push('桌上有小盆栽');
  if (o.wall === 'map' && type === 'tourist') bits.push('牆上有台灣地圖');
  const near = (t) => decor.some((d) => d.type === t && itemsNear(d, corner));
  if (showcases.some((s) => itemsNear(s, corner))) bits.push('旁邊就是展示櫃');
  if (near('rug')) bits.push('腳下有地毯');
  if (near('greenwall') || near('plant') || o.wall === 'plant') bits.push('旁邊有綠植');
  if (near('lamp')) bits.push('旁邊有燈');
  if (type !== 'catlover' && isCatPlace(cat) && nearItem(cat, corner)) bits.push('龍眼在旁邊');
  if (!bits.length) bits.push(waited ? '等到這個位子空出來' : '剛好這裡有空位');
  return bits.slice(0, 2).join('、');
}

// 跑完一天。回傳 { seed, dayLen, guests, cat, stats }
export function simulateDay({ layout: raw, menu, day = 1, seed }) {
  const s = seed ?? daySeed(raw, menu, day);
  // 擺放順序、uid 不影響結果：先排成固定順序
  const layout = { items: [...raw.items].sort((a, b) => (itemKey(a) < itemKey(b) ? -1 : itemKey(a) > itemKey(b) ? 1 : 0)) };
  const rng = mulberry32(s);
  const map = walkMap(layout);
  const decor = layout.items.filter((i) => i.kind === 'decor');
  const showcases = layout.items.filter((i) => i.kind === 'corner' && i.type === 'showcase');
  const cat = catSpot(layout);

  // 開得了的角落與座位（走不到入口的角落不算）
  const seats = [];
  for (const c of cornersOf(layout)) {
    const entrance = nearestEntrance(layout, c, map);
    if (!entrance) continue;
    const path = pathTo(map, entrance);
    seatCells(c).forEach((cell, i) => seats.push({ corner: c, index: i, cell, entrance, path, freeAt: 0 }));
  }
  const items = menuItems(menu);
  const weights = guestWeights(layout, menu);
  const playerCornerCount = layout.items.filter((i) => i.kind === 'corner').length;
  const groups = Math.min(9, 4 + playerCornerCount + Math.floor(decor.length / 2));

  // 到店時間：平均撒在前 60 秒
  const arrivals = [];
  for (let g = 0; g < groups; g++) arrivals.push(3 + (g + rng() * 0.9) * (58 / groups));
  arrivals.sort((a, b) => a - b);

  const guests = [];
  let gid = 0;
  arrivals.forEach((arrive, groupId) => {
    const type = pickWeighted(rng, Object.entries(weights).filter(([, w]) => w > 0));
    const def = GUESTS[type];
    const size = def.size || 1;
    const placed = chooseSeats({ seats, type, size, arrive, rng, cat, decor });
    if (!placed) return;
    for (const seat of placed.seats) {
      const startWalk = placed.at;
      const walk = Math.max(1, seat.path.length) * WALK;
      const sitAt = startWalk + walk;
      const stay = 16 + rng() * 14;
      const leaveAt = sitAt + stay;
      seat.freeAt = leaveAt + 0.5;
      const order = chooseOrder(items, def.taste, menu.signature, rng);
      // 這杯比德叔那杯更合他的口味：第 2 章「德叔那杯給不了的」才算數（抄一杯一樣的不算）
      const fit = order ? matchScore(order.recipe, def.taste) > matchScore(DESHU_CUP, def.taste) : false;
      const liked = likedCorner(type, seat.corner, cat);
      const waited = startWalk - arrive > 0.5;
      guests.push({
        gid: gid++, groupId, type, size,
        corner: seat.corner.uid, cornerType: seat.corner.type, seatIndex: seat.index,
        seat: seat.cell, path: seat.path,
        arrive, startWalk, sitAt, leaveAt, exitAt: leaveAt + walk,
        waited,
        liked,
        order: order?.slot ?? null,
        orderName: order?.recipe.name ?? null,
        signature: order ? order.slot === menu.signature : false,
        fit,
        weird: order ? !!weirdness(order.recipe) : false,
        action: chooseAction(type, seat, decor, cat, rng, showcases),
        why: whyHere(type, seat.corner, { liked, waited, decor, cat, showcases }),
      });
    }
  });

  const dayLen = Math.max(DAY_LEN, ...guests.map((g) => g.exitAt + 1));
  return { seed: s, day, dayLen, guests, cat, stats: summarize(guests, menu) };
}

function likedCorner(type, corner, cat) {
  const likes = GUESTS[type].likes;
  if (!likes) return false;
  if (likes === 'catbed') return isCatPlace(cat) && nearItem(cat, corner);
  return corner.type === likes;
}

// 找位子：先找喜歡的角落，再隨便坐；都滿了就在門口等最早空出來的位子
function chooseSeats({ seats, type, size, arrive, rng, cat }) {
  if (!seats.length) return null;
  const likes = GUESTS[type].likes;
  const byCorner = new Map();
  for (const s of seats) {
    if (!byCorner.has(s.corner.uid)) byCorner.set(s.corner.uid, []);
    byCorner.get(s.corner.uid).push(s);
  }
  const corners = [...byCorner.values()].filter((list) => list.length >= size);
  if (!corners.length) return null;
  const pref = (list) => {
    const c = list[0].corner;
    if (likes === 'catbed') return isCatPlace(cat) && nearItem(cat, c) ? 2 : 0;
    if (likes && c.type === likes) return 2;
    if (size > 1 && c.type !== 'bar') return 1; // 結伴的人想要一張自己的桌子（沒有唱片角也行）
    return 0;
  };
  // 每個角落最早什麼時候能坐下 size 個人
  const options = corners.map((list) => {
    const free = list.slice().sort((a, b) => a.freeAt - b.freeAt).slice(0, size);
    return { list, free, at: Math.max(arrive, ...free.map((s) => s.freeAt)), pref: pref(list), r: rng() };
  });
  // 現在就有位子：喜歡的角落優先；都滿了：等最早空出來的
  const now = options.filter((o) => o.at <= arrive);
  const best = now.length
    ? now.sort((a, b) => b.pref - a.pref || a.r - b.r)[0]
    : options.sort((a, b) => a.at - b.at || b.pref - a.pref || a.r - b.r)[0];
  return { seats: best.free, at: best.at };
}

// 點餐：看口味。招牌只在口味一樣合的時候稍微佔便宜（德叔會推薦黑板上那杯），
// 不會讓不合口味的客人盲目點它；第 2 章因此要真的配出「來店的人想喝的」那一杯。
const SIG_NUDGE = 0.15;
const ORDER_NOISE = 0.5;
function chooseOrder(items, taste, signature, rng) {
  if (!items.length) return null;
  let best = null;
  for (const it of items) {
    const score = matchScore(it.recipe, taste) + (it.slot === signature ? SIG_NUDGE : 0) + rng() * ORDER_NOISE;
    if (!best || score > best.score) best = { ...it, score };
  }
  return best;
}

// 一般客人不說話，只用動作反應
export const ACTIONS = {
  book: { text: '拿書架上的書下來看', icon: '📖' },
  laptop: { text: '打開筆電', icon: '💻' },
  photo: { text: '拍照', icon: '📷' },
  cat: { text: '摸貓', icon: '🐈' },
  window: { text: '看窗外', icon: '🌿' },
  chat: { text: '小聲聊天', icon: '💬' },
  music: { text: '換了一張唱片', icon: '🎵' },
  browse: { text: '站在展示櫃前面看了很久', icon: '🫘' },
  plant: { text: '摸了摸葉子', icon: '🪴' },
  idle: { text: '坐著發呆', icon: '…' },
};

// （新擺設、細調的選項都接在原本的後面、只在擺了那些東西時才加：舊佈置抽到的動作不變）
function chooseAction(type, seat, decor, cat, rng, showcases = []) {
  const c = seat.corner;
  const near = (t) => decor.some((d) => d.type === t && itemsNear(d, c));
  const o = cornerOpts(c);
  const opts = [];
  if (type === 'laptop' && c.type === 'worktable') opts.push('laptop', 'laptop');
  if (type === 'catlover' || (cat.place === 'catbed' && nearItem(cat, c))) opts.push('cat');
  if (type === 'catlover') opts.push('cat');
  if (c.type === 'window') opts.push('book', 'window');
  if (near('frame') || type === 'tourist') opts.push('photo');
  if (near('lamp') && type === 'solo') opts.push('book');
  if (type === 'pair') opts.push('chat', 'chat');
  if (cat.place === 'cattree' && nearItem(cat, c)) opts.push('cat');
  if (c.type === 'record') opts.push('music', 'music');
  if (showcases.length && (type === 'tourist' || showcases.some((s) => itemsNear(s, c)))) opts.push('browse');
  if (o.top === 'book' || (o.lamp === 'on' && type === 'solo' && c.type !== 'worktable')) opts.push('book');
  if (type === 'solo' && (near('greenwall') || o.wall === 'plant')) opts.push('plant');
  opts.push('idle');
  return opts[Math.floor(rng() * opts.length)];
}

function summarize(guests, menu) {
  const byCorner = {};
  const orders = {};
  for (const g of guests) {
    (byCorner[g.corner] ||= []).push(g.gid);
    if (g.order != null) orders[g.order] = (orders[g.order] || 0) + 1;
  }
  return {
    byCorner,
    orders,
    signatureOrders: guests.filter((g) => g.signature).length,
    signatureFits: guests.filter((g) => g.signature && g.fit).length, // 招牌被「德叔那杯給不了」的客人點
    weirdOrders: guests.filter((g) => g.weird).length,
    waited: guests.filter((g) => g.waited).length,
    liked: guests.filter((g) => g.liked).length,
    types: guests.reduce((m, g) => ((m[g.type] = (m[g.type] || 0) + 1), m), {}),
  };
}
