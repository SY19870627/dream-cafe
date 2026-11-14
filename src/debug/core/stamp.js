// 版本字串（純邏輯）：不碰 DOM、storage、fetch。
// 建議的版本格式＝「這份程式 commit 的台北時間（commit 短碼）」，例如「2026-11-14 20:05:31（b00eb97）」。

/** commit 時間的格式：YYYY-MM-DD HH:mm:ss */
export const BUILD_TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * 台北時間（Asia/Taipei，UTC+8、沒有日光節約）的「YYYY-MM-DD HH:mm:ss」；不看系統時區。
 * @param {Date | number | string} [date=new Date()]
 * @returns {string}
 * @throws {RangeError} 時間不對
 */
export function taipeiStamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new RangeError('時間不對');
  /** @type {Record<string, string>} */
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)) parts[p.type] = p.value;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * 版本拆成兩段：time（commit 時間，格式不對就是空字串）與 hash（實際在跑的版本：commit 短碼、「未釘」、local…）。
 * @param {unknown} buildTime
 * @param {unknown} running
 * @returns {{ time: string, hash: string }}
 */
export function versionParts(buildTime, running) {
  const time = BUILD_TIME_RE.test(String(buildTime ?? '')) ? String(buildTime) : '';
  return { time, hash: String(running || 'local') };
}

/**
 * 版本的純文字：「日期 時間（running）」；沒有 commit 時間就只回 running。
 * @param {unknown} buildTime
 * @param {unknown} running
 * @returns {string}
 */
export function formatVersion(buildTime, running) {
  const { time, hash } = versionParts(buildTime, running);
  return time ? `${time}（${hash}）` : hash;
}

/**
 * formatVersion 的反過來：顯示用的版本字串拆回 { time, hash }（面板把括號部分畫成小字用）。
 * 結尾不是「（…）」就整串當 hash。
 * @param {unknown} display
 * @returns {{ time: string, hash: string }}
 */
export function splitVersion(display) {
  const s = String(display ?? '');
  const m = /^(.*)（([^（）]*)）$/.exec(s);
  return m && m[1] ? { time: m[1], hash: m[2] } : { time: '', hash: s };
}
