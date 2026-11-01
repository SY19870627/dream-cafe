// 東山的天氣：依季節隨機（決定 D10），同一天永遠得到同一個結果。
// 目前只用在德叔的營業日誌（「下午下了一場雨」）；店裡的雨天畫面、颱風夜在之後的階段加入。
// 純邏輯，不依賴 Three.js 或 DOM。

// 簡單的整數雜湊 → 0～1，讓「某天、某個用途」的亂數固定下來
export function hash01(...nums) {
  let h = 2166136261;
  for (const n of nums) {
    h ^= Math.floor(n) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

// 台南的雨：五月梅雨到九月颱風季下午常下雨，其他月份偶爾（推測值，試玩再調）
const RAIN_CHANCE = [0.08, 0.08, 0.1, 0.15, 0.35, 0.45, 0.4, 0.5, 0.35, 0.12, 0.08, 0.08];

// day：本地日曆日序號（clock.js 的 dayIndex）；month：0～11；seed：每份存檔不同
export function weatherOn(day, month, seed = 0) {
  return hash01(day, seed, 77) < RAIN_CHANCE[month] ? 'rain' : 'clear';
}
