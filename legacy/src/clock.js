// 遊戲時間：現實一天＝遊戲一天（劇本「節奏設定」）。
// 純邏輯，不依賴 Three.js 或 DOM，用 node --test 測試。

const DAY_MS = 24 * 60 * 60 * 1000;

// 本地日曆日的序號：同一天（本地時間）的任何時刻都得到同一個整數
export function dayIndex(ts) {
  const d = new Date(ts);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

// 開店第 N 天：從第一次開店那天算第 1 天，玩家沒上線的日子也算（決定 D7）
export function daysOpen(openedAt, now) {
  if (!openedAt) return 1;
  return Math.max(1, dayIndex(now) - dayIndex(openedAt) + 1);
}

// 兩個時刻之間跨過幾個本地日曆日（之後離線營業日誌會用到）
export function daysBetween(from, to) {
  return Math.max(0, dayIndex(to) - dayIndex(from));
}

// 開發者模式「跳到明天」：直接往後推 24 小時（本地日曆日一定 +1，台灣沒有日光節約時間）
export const JUMP_DAY_MS = DAY_MS;

// 「11 月 1 日」
export function dateLabel(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}
