// 第一站的 20 個溫度任務（劇本「溫度任務清單」）：溫度合計 +17°C（20 → 37°C），基金合計撥款 38,500 元。
// 任務完成不跳清單，由德叔或客人的一句話（line）或一個動作帶出。
// 判定條件全部由存檔狀態推得（when(save, ctx)），同一個任務只會完成一次。
// 純邏輯，不依賴 Three.js 或 DOM。
import { placedItems, bookCount } from './catalog.js';

export const BASE_TEMP = 20;
export const GOAL_TEMP = 37;
export const SEAT_IDS = ['window', 'bar', 'sofa'];

const milestone = (who, n) => (s) => (s.regulars[who]?.milestones || []).includes(n);
const flag = (name) => (s) => !!s.flags[name];

// line：完成時說話的人與台詞；null 表示由別的動作帶出，或要等之後的階段（熟客、龍眼、客人模式）演出時再說。
export const TASKS = [
  { no: 1, id: 'first-coffee', name: '第一次坐下喝德叔的咖啡', type: '體驗', temp: 0.5, fund: 500,
    when: (s) => s.stats.cups >= 1, line: null }, // 劇本：德叔看了一眼溫度計，沒說話（用動作呈現）
  { no: 2, id: 'first-decor', name: '擺上第一件擺飾', type: '佈置', temp: 0.5, fund: 500,
    when: (s) => placedItems(s).length >= 1, line: ['德叔', '這個放這裡，從吧台看過去剛好。'] },
  { no: 3, id: 'all-seats', name: '每個座位都坐過一次', type: '體驗', temp: 1, fund: 1000,
    when: (s) => SEAT_IDS.every((id) => s.seatsSat.includes(id)),
    line: ['德叔', '每張椅子，都認得老闆了。'] }, // 【待定】
  { no: 4, id: 'open-3-days', name: '開店滿 3 天', type: '營業時長', temp: 0.5, fund: 1000,
    when: (s, c) => c.daysOpen >= 3, line: ['德叔', '第三天了。門口的台階，開始有人坐過的溫度。'] }, // 【待定】
  { no: 5, id: 'zhe-longan', name: '阿哲的龍眼乾', type: '熟客', temp: 0.5, fund: 1000, when: milestone('zhe', 1), line: null },
  { no: 6, id: 'yuan-pen', name: '予安借筆', type: '熟客', temp: 1, fund: 1500, when: milestone('yuan', 2), line: null },
  { no: 7, id: 'cat-chair', name: '龍眼第一次跳上你坐的椅子', type: '動物', temp: 0.5, fund: 1500, when: flag('catOnChair'), line: null },
  { no: 8, id: 'ten-decor', name: '擺滿 10 件擺飾', type: '佈置', temp: 1, fund: 2000,
    when: (s) => placedItems(s).length >= 10, line: ['德叔', '十件了。現在走進來，會先看見老闆的樣子。'] }, // 【待定】
  { no: 9, id: 'kevin-scolded', name: '凱文被罵，龍眼陪他', type: '熟客', temp: 1, fund: 2000, when: milestone('kevin', 2), line: null },
  { no: 10, id: 'open-7-days', name: '開店滿 7 天', type: '營業時長', temp: 1, fund: 2000,
    when: (s, c) => c.daysOpen >= 7, line: ['德叔', '一個禮拜了。龍眼現在會在門口等老闆，雖然他不會承認。'] }, // 【待定】
  { no: 11, id: 'yuan-kiln', name: '予安說出龍眼窯', type: '熟客', temp: 1, fund: 2000, when: milestone('yuan', 3), line: null },
  { no: 12, id: 'typhoon', name: '颱風夜（阿哲）', type: '熟客', temp: 1, fund: 2500, when: milestone('zhe', 3), line: null },
  { no: 13, id: 'rain-window', name: '在雨天坐窗邊喝一杯', type: '體驗', temp: 0.5, fund: 1500,
    when: (s) => s.stats.rainyWindowCups >= 1, line: ['德叔', '下雨的時候，窗邊那張桌子最好。'] }, // 【待定】天氣在之後的階段加入
  { no: 14, id: 'book-wall', name: '第一面書牆', type: '佈置', temp: 1, fund: 2500,
    when: (s) => bookCount(s.owned) >= 3, line: ['德叔', '有書的牆，連安靜都比較好聽。'] }, // 【待定】
  { no: 15, id: 'kevin-no-laptop', name: '凱文第一次沒帶筆電', type: '熟客', temp: 1, fund: 2500, when: milestone('kevin', 5), line: null },
  { no: 16, id: 'zhe-grandpa', name: '阿哲和阿公一起來', type: '熟客', temp: 1, fund: 3000, when: milestone('zhe', 4), line: null },
  { no: 17, id: 'guest-visit', name: '以客人身份推門進店', type: '體驗', temp: 1, fund: 2500, when: flag('guestVisit'), line: null },
  { no: 18, id: 'yuan-reading', name: '予安念稿', type: '熟客', temp: 1, fund: 3000, when: milestone('yuan', 5), line: null },
  { no: 19, id: 'zhe-beans', name: '菜單上架「阿哲的豆」', type: '菜單與在地', temp: 1, fund: 3000, when: milestone('zhe', 6), line: null },
  { no: 20, id: 'yuan-book', name: '予安出書', type: '熟客', temp: 1, fund: 3000, when: milestone('yuan', 6), line: null },
];

const BY_ID = new Map(TASKS.map((t) => [t.id, t]));
export const taskById = (id) => BY_ID.get(id);

// 溫度＝20°C＋已完成任務的溫度（存檔只記完成了哪些任務，溫度永遠由此算出，不會對不上）
export function temperature(save) {
  const t = save.tasks.reduce((s, d) => s + (BY_ID.get(d.id)?.temp || 0), BASE_TEMP);
  return Math.round(t * 10) / 10;
}

export const isDone = (save, id) => save.tasks.some((d) => d.id === id);

// 找出條件已達成、但還沒完成的任務
export function pending(save, ctx) {
  return TASKS.filter((t) => !isDone(save, t.id) && t.when(save, ctx));
}

// 完成所有達成條件的任務：記進存檔，並由溫度基金撥款。回傳這次完成的任務（依編號）。
export function completeTasks(save, ctx, now) {
  const done = pending(save, ctx);
  for (const t of done) {
    save.tasks.push({ id: t.id, t: now, day: ctx.daysOpen });
    save.fund.ledger.push({ t: now, kind: 'grant', ref: t.id, amount: t.fund });
  }
  return done;
}
