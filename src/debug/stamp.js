// 版本字串（純邏輯）：不碰 DOM、storage、fetch。scripts/stamp-version.mjs（pre-commit）與除錯面板共用。
// 版本＝「這份程式 commit 的台北時間（commit 短碼）」，例如「2026-11-14 20:05:31（b00eb97）」。

// BUILD_TIME 的格式：YYYY-MM-DD HH:mm:ss
export const BUILD_TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// 台北時間（Asia/Taipei，UTC+8、沒有日光節約）的「YYYY-MM-DD HH:mm:ss」；不看系統時區
export function taipeiStamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new RangeError('時間不對');
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)) parts[p.type] = p.value;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

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

// 版本拆成兩段：time（commit 時間，可能是空字串）與 hash（runningVersion 的結果：commit 短碼／未釘／local）
export function versionParts(buildTime, running) {
  const time = BUILD_TIME_RE.test(String(buildTime ?? '')) ? String(buildTime) : '';
  return { time, hash: String(running || 'local') };
}

// 版本的純文字：「日期 時間（running）」；沒有 commit 時間就只回 running。
// 面板、回報框、文字截圖、送出的回報（試算表「版本」欄）都用這一個函式。
export function formatVersion(buildTime, running) {
  const { time, hash } = versionParts(buildTime, running);
  return time ? `${time}（${hash}）` : hash;
}
