// 店貓龍眼（劇本：三合院本來就有的橘貓）：
// - 睡覺的地方依店裡的擺飾換（有書櫃就睡書架上、有軟墊就睡軟墊……），營業日誌會寫牠換到哪裡；
// - 點太多次會走開（動物可以拒絕互動）；
// - 老闆坐過的椅子還熱著時，會跳上去（溫度任務 #7）。
// 純邏輯，不依賴 Three.js 或 DOM；畫面上的位置由 main.js 依 id 對到店裡的擺飾。
import { hash01 } from './weather.js';

// items：要店裡擺著這些東西才會選；w：權重（擺飾的位置比較常選）
// journal：營業日誌裡「換位子」那天的句子；first：第一次在店裡睡上去時德叔說的話
export const CAT_SPOTS = [
  { id: 'bookshelf', items: ['bookshelf', 'book-wall'], w: 3,
    journal: '龍眼把睡覺的地方改到書架上了。大概是喜歡予安小姐的書。', // 劇本範例句
    journalAlt: '龍眼把睡覺的地方改到書架上了。那裡看得到整間店。', // 【待定】還沒見過予安的時候
    first: '龍眼上了書架。那裡看得到整間店。' }, // 【待定】
  { id: 'cushion', items: ['cat-cushion'], w: 3,
    journal: '龍眼今天睡在新的軟墊上，睡到客人都走了才醒。', // 【待定】
    first: '軟墊，他收下了。' }, // 【待定】
  { id: 'cat-tree', items: ['cat-tree'], w: 3,
    journal: '龍眼在貓跳台最上面，看了一下午的窗外。', // 【待定】
    first: '最上面那層，他已經上去了。' }, // 【待定】
  { id: 'rattan', items: ['rattan-chair'], w: 2,
    journal: '藤編搖椅被龍眼佔走了。有客人想坐，他沒讓。', // 【待定】
    first: '搖椅，龍眼先坐了。' }, // 【待定】
  { id: 'sofa', w: 1, journal: '龍眼把睡覺的地方換到角落沙發。' }, // 【待定】
  { id: 'step', w: 1, journal: '龍眼今天睡在門口的台階上，跟老闆第一次來那天一樣。' }, // 【待定】
  { id: 'sill', w: 1, journal: '龍眼睡在窗台下面，有太陽的那一塊。' }, // 【待定】
];
const BY_ID = new Map(CAT_SPOTS.map((s) => [s.id, s]));
export const catSpotById = (id) => BY_ID.get(id) || null;

export const KEEP_CHANCE = 0.55; // 隔天還睡同一個地方的機率（不會每天都換）

// 店裡擺著的東西（Set）能讓龍眼睡的地方
export function availableSpots(placed) {
  return CAT_SPOTS.filter((s) => !s.items || s.items.some((i) => placed.has(i)));
}

function pick(list, r) {
  const total = list.reduce((s, x) => s + x.w, 0);
  let k = r * total;
  for (const x of list) if ((k -= x.w) < 0) return x;
  return list[list.length - 1];
}

// 某一天龍眼睡哪裡（同一份存檔、同樣的擺飾，永遠得到同樣的結果）：
// 第 1 天先挑一個，之後每天有 KEEP_CHANCE 的機率不換
export function catSpotFor(placed, seed, day) {
  const avail = availableSpots(placed);
  let cur = pick(avail, hash01(seed, 1, 41));
  for (let d = 2; d <= day; d++) if (hash01(seed, d, 43) >= KEEP_CHANCE) cur = pick(avail, hash01(seed, d, 41));
  return cur;
}

const seedOf = (save) => (Number(save.createdAt) || 0) % 2147483647;
export const placedSet = (save) => new Set(save.owned.filter((o) => o.placed).map((o) => o.item));

// 老闆在店裡的這天龍眼睡哪裡：剛擺了新的貓窩（軟墊、貓跳台……），當天先去試睡
export function catSpotOn(save, day) {
  const placed = placedSet(save);
  const t = save.cat?.tryDay === day && catSpotById(save.cat.tryId);
  if (t && availableSpots(placed).includes(t)) return t;
  return catSpotFor(placed, seedOf(save), day);
}

// 佈置之後：多出來的、龍眼還沒睡過的地方，今天就去試睡。回傳那個地方（沒有就 null）
export function tryNewSpot(save, before, day) {
  const after = placedSet(save);
  const fresh = availableSpots(after).filter((s) => s.items && !availableSpots(before).includes(s) && !save.cat.seen.includes(s.id));
  if (!fresh.length) return null;
  const s = fresh.sort((a, b) => b.w - a.w)[0];
  save.cat.tryId = s.id;
  save.cat.tryDay = day;
  return s;
}

// 營業日誌：這天龍眼換了地方，就寫一句（c：journal.js 的情境，含 placed 與 met）
export function catJournalLine(seed, c) {
  const today = catSpotFor(c.placed, seed, c.day);
  if (c.day <= 1 || catSpotFor(c.placed, seed, c.day - 1) === today) return null;
  return { id: today.id, text: today.journalAlt && !c.met.yuan ? today.journalAlt : today.journal };
}

// 點龍眼：短時間內點太多次，他就走開，一陣子不理人（動物可以拒絕互動）
// mood：{ taps: [時刻], awayUntil }；t：毫秒。回傳 'purr'（給摸）、'refuse'（這次走開）、'ignore'（走開了，不理）
export const PET = { window: 15000, limit: 4, away: 45000 };
export function petCat(mood, t) {
  if (t < (mood.awayUntil || 0)) return 'ignore';
  mood.taps = (mood.taps || []).filter((x) => t - x < PET.window);
  mood.taps.push(t);
  if (mood.taps.length >= PET.limit) {
    mood.taps = [];
    mood.awayUntil = t + PET.away;
    return 'refuse';
  }
  return 'purr';
}

// 老闆站起來時，龍眼會不會跳上那張還熱著的椅子：要坐夠久；第一次一定會，之後偶爾
export const WARM_SEC = 12;
export function jumpsOnChair(save, satSec, r) {
  if (satSec < WARM_SEC) return false;
  return !save.flags.catOnChair || r < 0.35;
}

// 點龍眼時他說的（呼嚕聲也算他的話）
export const PURR = ['（呼嚕呼嚕）', '喵。', '（呼嚕……）']; // 前兩句是原型就有的，第三句【待定】
export const CAT_LINES = {
  refuseFirst: '他今天的份，摸完了。', // 【待定】龍眼第一次走開時德叔說的
};
