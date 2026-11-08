// 東山的天氣：依季節隨機（決定 D10），同一天永遠得到同一個結果。
// 用在德叔的營業日誌（「下午下了一場雨」）與店裡的雨天（窗外下雨、風雨聲）；颱風夜由阿哲的里程碑指定。
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

// 保底雨天（決定 D105）：溫度任務「在雨天坐窗邊喝一杯」要碰到雨天，冬天的雨很少（8%），
// 其他事都做完的玩家可能在 36.5°C 等上好幾個禮拜。所以這個任務還沒完成時，從開店第 12 天起，
// 距離上一次保底雨天滿 5 天，老闆在店裡的那一天就下雨（德叔會提一句窗邊）。
export const RAIN_FLOOR_DAY = 12;
export const RAIN_FLOOR_GAP = 5;
export function rainFloorDue({ day, done, last = 0 }) {
  return !done && day >= RAIN_FLOOR_DAY && day - (Number(last) || 0) >= RAIN_FLOOR_GAP;
}
// 下雨的日子、還沒在雨天坐過窗邊時，德叔進門後說的一句（不是任務提示，是他自己喜歡的位子）
export const RAIN_HINT = '下雨了。窗邊那張桌子，聽得到雨打在雨遮上。'; // 【待定】
