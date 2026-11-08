// 章節目標與解鎖（資料）。雛形只做序章～第 2 章。
// 目標檢查是純函式：ctx = { layout, validation, result, menu }
import { playerCorners } from './grid.js';
import { signatureIsPlayers } from './menu.js';

export const START_TEMP = 20.5; // 開場第一杯之後牆上的老溫度計
export const LAST_CHAPTER = 2; // 雛形到第 2 章為止

export const CHAPTERS = [
  { id: 0, title: '序章', goal: null },
  {
    id: 1, title: '空店', goal: '擺出一間路是通的店，開第一天',
    unlock: { corners: ['window'], decor: ['plant', 'frame', 'lamp', 'catbed'], design: false },
    temp: 22.0,
    done: ({ validation, layout }) => validation.ok && playerCorners(layout).length >= 1,
  },
  {
    id: 2, title: '第一杯', goal: '自己設計的招牌被 3 位客人點',
    // 規格書的工作桌在第 5 章解鎖；雛形要試三組角落，先在第 2 章給
    unlock: { corners: ['worktable'], decor: [], design: true },
    temp: 23.5,
    done: ({ menu, result }) => signatureIsPlayers(menu) && result.stats.signatureOrders >= 3,
  },
];

export const chapter = (id) => CHAPTERS[id] || null;

// 到這一章為止解鎖的東西（累計）
export function unlocks(id) {
  const out = { corners: new Set(), decor: new Set(), design: false };
  for (const c of CHAPTERS) {
    if (c.id > id || !c.unlock) continue;
    c.unlock.corners.forEach((x) => out.corners.add(x));
    c.unlock.decor.forEach((x) => out.decor.add(x));
    out.design ||= c.unlock.design;
  }
  return out;
}

export function goalDone(id, ctx) {
  const c = chapter(id);
  return !!(c?.done && c.done(ctx));
}

// 跳章（?ch=）時的溫度：前面每章都算完成
export function tempAtStart(id) {
  let t = START_TEMP;
  for (const c of CHAPTERS) if (c.id > 0 && c.id < id && c.temp) t = c.temp;
  return t;
}
