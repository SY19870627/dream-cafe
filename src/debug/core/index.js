// 除錯核心的總入口：兩個遊戲共用（純 ES module，不用打包；TypeScript 用 index.d.ts）。
// 只 import 這個檔不會碰 DOM：DOM 只在呼叫 startDebug()／capture()／copyText() 時才用到。
export { CORE_VERSION } from './version.js';
export { debugOn } from './flag.js';
export { BUILD_TIME_RE, taipeiStamp, versionParts, formatVersion, splitVersion } from './stamp.js';
export {
  CATEGORIES, COMMENT_MAX, SHOT_MAX_WIDTH, SHOT_QUALITY, SHOT_MAX_BASE64, SHOT_REV, NO_LINE,
  plainText, deviceSummary, buildPayload, reportText, rewriteCssUrls, shotFits, shotScale, charUnits, wrapText, firstOk, shotErrorText, textShotLines,
} from './report.js';
export { RETRY_MS, withoutOwner, post, exportText, createQueue } from './queue.js';
export { keysToClear, storageKeys, bustUrl, ownerStore } from './reset.js';
export { capture, loadHtml2canvas, toJpeg, taintCheck } from './capture.js';
export { startDebug, copyText, clearCaches, DEFAULT_TEXT } from './ui.js';
