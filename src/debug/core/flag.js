// 除錯模式開關（純函式，不碰 DOM、不發請求）。
// 建議用法：遊戲主程式只靜態載入「開關」這一小段，開關為真時才用動態 import() 載入核心其他部分，
// 一般玩家完全不會下載除錯程式。

/**
 * 網址的查詢字串裡有沒有 `<param>=<value>`（預設 `debug=1`）。只認完全相同的值（`debug=0`、`debug=true`、`debug` 都是 false）。
 * @param {string | null | undefined} search 例如 `location.search`
 * @param {string} [param='debug'] 參數名
 * @param {string} [value='1'] 要的值
 * @returns {boolean}
 */
export function debugOn(search, param = 'debug', value = '1') {
  try {
    return new URLSearchParams(String(search ?? '')).get(param) === value;
  } catch {
    return false;
  }
}
