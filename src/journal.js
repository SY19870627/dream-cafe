// 德叔的營業日誌：玩家登入時，用和上次離開的時間差結算（劇本「德叔的營業日誌」）。
// 每天 2～4 條，由「每日片段池＋可離線的熟客里程碑＋龍眼換位子」組成；
// 離開很多天時只展開最近 3 天，其餘一句帶過。同一天永遠寫出同樣的內容（以存檔與日期為亂數種子）。
// 熟客里程碑由呼叫端的 story(day, ctx) 提供（main.js 接上 story.js 的里程碑引擎）；「在場」里程碑到期時只寫提示句。
// 純邏輯，不依賴 Three.js 或 DOM。
import { dayIndex, daysOpen, dateLabel } from './clock.js';
import { weatherOn, hash01 } from './weather.js';
import { bookCount, placedItems } from './catalog.js';
import { CAT_SPOTS, catJournalLine } from './cat.js';
import { KEEPER_JOURNAL } from './farewell.js';

export const SHOW_DAYS = 3; // 展開最近幾天
export const KEEP_PAGES = 10; // 存檔裡留幾頁，給記事本重讀
const NUM = ['零', '一', '兩', '三', '四', '五', '六'];

// 每天固定的一句：今天來了幾位（劇本「每日客人 3～5 位」）
// tail：句尾可以接的半句；need 為 true 才會選到
const VISITOR_TAILS = [
  { text: '冰美式先生還是沒喘過氣。', need: (c) => c.met.kevin && c.day >= 4 && !c.met.kevinFree }, // 劇本範例句
  { text: '都坐得很久。' }, // 【待定】
  { text: '有兩位是騎機車上山的。' }, // 【待定】
  { text: '有一位點了第二杯，說不趕。' }, // 【待定】
];

// 每日片段池。w：權重；need：條件（熟客見過了沒、店裡擺了什麼）
export const POOL = [
  // 劇本範例句
  { id: 'zhe-orange', text: '阿哲送了一籃橙子來，說阿公叫他送的。他又說了一次他是被逼來的。', need: (c) => c.met.zhe && c.day >= 2 },
  { id: 'yuan-wrote', text: '予安小姐今天寫了很久，沒刪。', need: (c) => c.met.yuan && c.day >= 3 },
  { id: 'shop-name', text: '有一位路過的客人問這間店叫什麼。我說老闆還沒決定。' },
  { id: 'kevin-again', text: '冰美式先生今天也來了。他沒喘過氣。', need: (c) => c.met.kevin && c.day >= 4 && !c.met.kevinFree },
  // 【待定】以下是自行補寫的片段
  { id: 'fog', text: '傍晚山那邊起霧，店裡的燈看起來比較亮。' },
  { id: 'kettle', text: '水壺今天燒了十一次。豆子剩一半，明天再磨。' },
  { id: 'steps', text: '門口的台階有人坐著等雨停，沒進來。我端了一杯水出去。', need: (c) => c.rain },
  { id: 'motorbike', text: '175 縣道上有人騎車停下來問路。問完，又進來坐了一下。' },
  { id: 'longan-smell', text: '下午有人在烤龍眼乾，整條路都是那個味道。' },
  { id: 'menu-board', text: '黑板上那句「不限時，慢慢等」，有位客人拍了照。', need: (c) => c.placed.has('menu-board') },
  { id: 'lamp', text: '落地燈晚上很好看。有位客人說，像家裡。', need: (c) => c.placed.has('floor-lamp') },
  { id: 'radio', text: '收音機放了一整天的老歌。沒人轉台。', need: (c) => c.placed.has('radio') },
  { id: 'record', text: '黑膠今天轉了三張。第二張是老闆上次放的那張。', need: (c) => c.placed.has('record-player') },
  { id: 'books', text: '書櫃前站了一位客人，看了一個下午。我也沒問。', need: (c) => c.books >= 1 },
  { id: 'jar', text: '龍眼乾罐子少了一半。有人一邊喝一邊吃。', need: (c) => c.placed.has('longan-jar') },
  { id: 'rocking', text: '藤編搖椅一直在晃。坐上去的人，都不太想起來。', need: (c) => c.placed.has('rattan-chair') },
  // 離開東山之後，日誌由凱文寫（farewell.js 的 KEEPER_JOURNAL，【待定】）；德叔口吻的「我說老闆還沒決定」那類句子照用
  ...KEEPER_JOURNAL.map((text, i) => ({ id: 'keeper' + i, text, w: 2, need: (c) => c.keeper })),
];

// 龍眼換位子：睡覺的地方由 cat.js 依店裡的擺飾決定（店裡畫面的龍眼也睡在同一個地方），換了地方的那天寫一句
export { CAT_SPOTS };

// 下雨的那天（劇本範例句）
const RAIN_LINE = '下午下了一場雨，窗邊那張桌子沒人坐。我替老闆坐了一下。';

// 離開很多天時，前面的日子一句帶過 【待定】
function summaryLine(a, b, visitors) {
  return a === b
    ? `第 ${a} 天，店照常開著，來了 ${visitors} 位客人。`
    : `第 ${a}～${b} 天，店照常開著，一共來了 ${visitors} 位客人。龍眼每天都在。`;
}

// 0～1 的偽亂數序列（mulberry32）
function rand(seed) {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => {
  const total = list.reduce((s, x) => s + (x.w || 1), 0);
  let k = r() * total;
  for (const x of list) if ((k -= x.w || 1) < 0) return x;
  return list[list.length - 1];
};

// 熟客「見過了沒」的預設值（劇本第一個里程碑的天數：阿哲第 1 天、予安第 2 天、凱文第 3 天）；
// 遊戲裡由 story.js 的 metOn() 依真正發生過的里程碑提供
export const defaultMet = (day) => ({ zhe: day >= 1, yuan: day >= 2, kevin: day >= 3 });

const seedOf = (save) => (Number(save.createdAt) || 0) % 2147483647;

// 某一天的情境
function dayCtx(save, ts, opts) {
  const day = daysOpen(save.createdAt, ts);
  const d = new Date(ts);
  const placed = new Set(placedItems(save).map((o) => o.item));
  return {
    day, ts, idx: dayIndex(ts),
    rain: weatherOn(dayIndex(ts), d.getMonth(), seedOf(save)) === 'rain',
    placed, books: bookCount(save.owned),
    met: (opts.met || defaultMet)(day),
    keeper: !!opts.keeper, // 離開東山之後：凱文顧店
  };
}

const visitorsOn = (save, idx) => 3 + Math.floor(hash01(seedOf(save), idx, 11) * 3);

// 寫一天的日誌：2～4 條。used：同一頁裡已經用過的片段，避免連續幾天都寫一樣的話
export function dayLines(save, c, events = [], used = new Set()) {
  const r = rand(hash01(seedOf(save), c.idx, 23));
  const n = visitorsOn(save, c.idx);
  const tails = VISITOR_TAILS.filter((t) => !t.need || t.need(c));
  const tail = r() < 0.45 && tails.length ? pick(r, tails).text : '';
  const lines = [`今天來了${NUM[n]}位。${tail}`];
  for (const e of events) lines.push(e.line); // 熟客里程碑與「想等老闆在」的提示，一定寫進去
  const target = Math.max(2 + Math.floor(r() * 3), Math.min(lines.length, 4));
  if (lines.length < target && c.rain && r() < 0.85) lines.push(RAIN_LINE);
  const cat = catJournalLine(seedOf(save), c);
  if (lines.length < target && cat && !used.has('cat:' + cat.id)) { used.add('cat:' + cat.id); lines.push(cat.text); }
  while (lines.length < target) {
    const pool = POOL.filter((p) => (!p.need || p.need(c)) && !used.has(p.id));
    if (!pool.length) break;
    const p = pick(r, pool);
    used.add(p.id);
    lines.push(p.text);
  }
  return { lines, visitors: n };
}

// 結算 from（上次離開）到 to（現在）之間老闆不在的日子。沒有跨日就回傳 null（同一天回來不寫日誌）。
// opts.story(day, ctx)：回傳那天發生的熟客事件 [{ line, kind: 'milestone' | 'waiting' }]
// opts.met(day)：熟客見過了沒（預設 defaultMet）；opts.keeper：離開東山之後，凱文寫的日誌
export function writeJournal(save, from, to, opts = {}) {
  const first = dayIndex(from) + 1, last = dayIndex(to);
  if (!(last >= first)) return null;
  const base = new Date(from);
  const tsOf = (k) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + k, 12).getTime();
  const total = last - first + 1;
  const older = Math.max(0, total - SHOW_DAYS);
  const page = { t: to, days: [], summary: null, notes: [] };
  // 一句帶過的日子：只算客人數，熟客事件仍記下來（不會漏掉）
  if (older) {
    let visitors = 0;
    for (let k = 1; k <= older; k++) {
      const ts = tsOf(k);
      visitors += visitorsOn(save, dayIndex(ts));
      if (opts.story) for (const e of opts.story(daysOpen(save.createdAt, ts), dayCtx(save, ts, opts)) || []) page.notes.push(e.line);
    }
    page.summary = summaryLine(daysOpen(save.createdAt, tsOf(1)), daysOpen(save.createdAt, tsOf(older)), visitors);
  }
  const used = new Set();
  for (let k = older + 1; k <= total; k++) {
    const c = dayCtx(save, tsOf(k), opts);
    const events = opts.story ? opts.story(c.day, c) || [] : [];
    const { lines } = dayLines(save, c, events, used);
    page.days.push({ day: c.day, date: dateLabel(c.ts), rain: c.rain, lines });
  }
  return page;
}

// 把一頁日誌收進存檔（只留最近幾頁）
export function keepPage(save, page) {
  if (!page) return;
  save.journal.push(page);
  if (save.journal.length > KEEP_PAGES) save.journal.splice(0, save.journal.length - KEEP_PAGES);
}

// 測試用：日誌裡所有寫得出來的句子
export const ALL_TEXTS = [...VISITOR_TAILS.map((t) => t.text), ...POOL.map((p) => p.text), ...CAT_SPOTS.flatMap((s) => [s.journal, s.journalAlt, s.first].filter(Boolean)), RAIN_LINE];
