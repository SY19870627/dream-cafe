// 除錯模式開關：只有網址帶 ?debug=1 才開。main.js 只靜態載入這一個檔（很小、純函式）；
// 其他除錯模組（面板、截圖、回報、佇列）一律在開關為真時才用動態 import() 載入，一般玩家完全不會下載、不碰 DOM、不發請求。
export function debugOn(search) {
  try {
    return new URLSearchParams(String(search ?? '')).get('debug') === '1';
  } catch {
    return false;
  }
}
