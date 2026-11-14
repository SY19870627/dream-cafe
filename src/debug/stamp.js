// 版本字串（純邏輯）：不碰 DOM、storage、fetch。scripts/stamp-version.mjs（pre-commit）與除錯面板共用。
// 版本＝「這份程式 commit 的台北時間（commit 短碼）」，例如「2026-11-14 20:05:31（b00eb97）」。
// 台北時間與版本字串的做法在除錯核心（./core/stamp.js）；這裡只多 src/version.js 的檔案內容（dream-cafe 自己的）。
import { BUILD_TIME_RE } from './core/stamp.js';

export { BUILD_TIME_RE, taipeiStamp, versionParts, formatVersion } from './core/stamp.js';

// src/version.js 的完整內容（stamp 腳本寫入用；檔案註解也在這裡，改註解改這裡）
export function versionSource(stamp) {
  if (!BUILD_TIME_RE.test(String(stamp))) throw new RangeError(`BUILD_TIME 格式不對：${stamp}`);
  return [
    '// 這份程式 commit 的時間（台北時間）。除錯面板與回報的版本是「這個時間（commit 短碼）」。',
    '// 由 .githooks/pre-commit 執行 scripts/stamp-version.mjs 自動寫入，不要手改。',
    `export const BUILD_TIME = '${stamp}';`,
    '',
  ].join('\n');
}
