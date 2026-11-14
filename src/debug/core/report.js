// 回報的內容（純邏輯）：不碰 DOM、localStorage、fetch、navigator。要的東西都從參數傳進來，才能在 Node 測試。
// 遊戲相關的（第幾天、場景、說話的人怎麼算）由遊戲在 position() 裡算好傳進來，這裡只負責組成固定的形狀。

/** 分類（可以不選＝空字串）。收件端照這幾個字分。 */
export const CATEGORIES = ['台詞', '畫面', '圖', '操作', '其他'];
/** 意見最多幾個字（收件端也是 1000）。 */
export const COMMENT_MAX = 1000;
/** 截圖寬度上限（px）。 */
export const SHOT_MAX_WIDTH = 720;
/** JPEG 品質。 */
export const SHOT_QUALITY = 0.7;
/** 截圖 base64 超過這個長度就再壓／縮；縮到最小還超過就不附截圖。 */
export const SHOT_MAX_BASE64 = 200 * 1024;
/** 截圖程式的版本：每次改截圖邏輯就加一。失敗訊息、面板都會顯示，一眼分得出瀏覽器跑的是不是舊檔。 */
export const SHOT_REV = 2;
/** 這一句沒有台詞時顯示的字。 */
export const NO_LINE = '（這一幕沒有台詞）';

/**
 * @typedef {object} Position 回報框「自動帶入」的位置
 * @property {string | number} [day] 第幾天（顯示用，例如「第2天」）
 * @property {string} [scene] 場景／關卡的代號
 * @property {number} [line] 第幾句（0 起算）
 * @property {string} [speaker] 說話的人（沒有就空字串）
 * @property {string} [text] 這一句的純文字
 */

/**
 * @typedef {object} Payload 送出、存佇列都是這個形狀（欄位順序固定）
 * @property {string} time ISO 時間
 * @property {string} version 版本（純文字）
 * @property {string | number} day
 * @property {string} scene
 * @property {number} line
 * @property {string} speaker
 * @property {string} text
 * @property {string} category
 * @property {string} comment
 * @property {string} screenshot data URL 或空字串
 * @property {string} device
 * @property {string} game
 * @property {string} owner 本人識別碼：只在送出時帶上；複製文字、佇列、匯出都不含
 */

/**
 * 台詞純文字：拿掉 HTML 標籤、還原常見實體、收掉多餘空白。
 * @param {unknown} html
 * @returns {string}
 */
export function plainText(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 裝置摘要：手機／平板／電腦、作業系統、瀏覽器、螢幕大小、devicePixelRatio、直向／橫向。
 * @param {{ ua?: string, maxTouchPoints?: number, screenW?: number, screenH?: number, viewW?: number, viewH?: number, dpr?: number }} [info]
 * @returns {string}
 */
export function deviceSummary(info = {}) {
  const ua = String(info.ua || '');
  const touch = Number(info.maxTouchPoints) || 0;
  let os = '其他';
  let kind = '電腦';
  if (/iPhone|iPod/.test(ua)) { os = 'iOS'; kind = '手機'; }
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) { os = 'iOS'; kind = '平板'; } // iPadOS 13 起 UA 長得像 Mac
  else if (/Android/.test(ua)) { os = 'Android'; kind = /Mobile/.test(ua) ? '手機' : '平板'; }
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Line\//.test(ua) ? 'LINE'
    : /FBAN|FBAV/.test(ua) ? 'Facebook' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) ? 'Safari' : '其他瀏覽器';
  const sw = Math.round(Number(info.screenW) || 0);
  const sh = Math.round(Number(info.screenH) || 0);
  const vw = Math.round(Number(info.viewW) || 0);
  const vh = Math.round(Number(info.viewH) || 0);
  const dpr = Math.round((Number(info.dpr) || 1) * 100) / 100;
  const w = vw || sw;
  const h = vh || sh;
  const orient = w && h ? (w > h ? '橫向' : '直向') : '方向不明';
  return `${kind} ${os} ${browser}｜螢幕 ${sw}×${sh}｜視窗 ${vw}×${vh}｜DPR ${dpr}｜${orient}`;
}

/**
 * 組出一筆回報（送出與存佇列都用這個形狀）。
 * @param {{ position?: Position | null, game?: string, version?: string, now?: Date | number | string, category?: string, comment?: string, screenshot?: string, device?: string, owner?: string }} [ctx]
 * @returns {Payload}
 */
export function buildPayload(ctx = {}) {
  const pos = ctx.position || {};
  const now = ctx.now instanceof Date ? ctx.now : new Date(ctx.now ?? Date.now());
  const shot = typeof ctx.screenshot === 'string' && ctx.screenshot.startsWith('data:image/') ? ctx.screenshot : '';
  return {
    time: now.toISOString(),
    version: String(ctx.version ?? ''),
    day: pos.day ?? '',
    scene: String(pos.scene || ''),
    line: Number.isInteger(pos.line) ? /** @type {number} */ (pos.line) : 0,
    speaker: String(pos.speaker ?? ''),
    text: String(pos.text ?? ''),
    category: CATEGORIES.includes(String(ctx.category)) ? String(ctx.category) : '',
    comment: String(ctx.comment ?? '').trim().slice(0, COMMENT_MAX),
    screenshot: shot,
    device: String(ctx.device || ''),
    game: String(ctx.game || ''),
    owner: String(ctx.owner || ''),
  };
}

/**
 * 「複製文字」用：一筆回報整理成純文字（不含截圖、不含本人識別碼），可以直接貼在聊天裡。
 * @param {Partial<Payload>} p
 * @returns {string}
 */
export function reportText(p) {
  return [
    `【${p.game} 回報】${p.day}｜${p.scene} 第 ${p.line} 句｜版本 ${p.version}`,
    `${p.speaker ? `${p.speaker}：` : ''}${p.text || NO_LINE}`,
    `分類：${p.category || '未選'}`,
    `意見：${p.comment || '（沒寫）'}`,
    `裝置：${p.device}`,
    `時間：${p.time}`,
  ].join('\n');
}

/**
 * CSS 字串（例如 background-image）裡的每個 url(...) 都用 fn 換掉，換完一律加雙引號。
 * @param {unknown} css
 * @param {(url: string) => string} fn
 * @returns {string}
 */
export function rewriteCssUrls(css, fn) {
  return String(css || '').replace(/url\((["']?)([^"')]+)\1\)/g, (all, q, u) => `url("${fn(u)}")`);
}

/**
 * 截圖 data URL 的 base64 部分有沒有在上限內。
 * @param {unknown} dataUrl
 * @param {number} [max=SHOT_MAX_BASE64]
 * @returns {boolean}
 */
export function shotFits(dataUrl, max = SHOT_MAX_BASE64) {
  const s = String(dataUrl || '');
  const i = s.indexOf(',');
  return (i >= 0 ? s.length - i - 1 : s.length) <= max;
}

/**
 * 截圖要用多大的倍率：輸出寬度不超過 maxWidth，也不超過裝置原本的解析度。
 * @param {number} width 要截的元素寬度（CSS px）
 * @param {number} [dpr=1]
 * @param {number} [maxWidth=SHOT_MAX_WIDTH]
 * @returns {number}
 */
export function shotScale(width, dpr = 1, maxWidth = SHOT_MAX_WIDTH) {
  const w = Number(width) || 0;
  if (w <= 0) return 1;
  return Math.max(0.1, Math.min(Number(dpr) || 1, maxWidth / w));
}

/**
 * 一個字佔幾格：全形（中日韓文字、全形標點）算 2，半形算 1。
 * @param {string} ch
 * @returns {number}
 */
export function charUnits(ch) {
  const c = String(ch).codePointAt(0) || 0;
  if (c > 0xffff) return 2; // 表情符號、罕用字
  return (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3)
    || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) ? 2 : 1;
}

/**
 * 換行：每行最多 maxUnits 格（全形 2、半形 1）；原本的換行照留；沒有空白的長字串硬切。
 * maxLines：最多幾行，超過的話最後一行結尾換成「…」。空字串回 ['']。
 * @param {unknown} text
 * @param {number} maxUnits
 * @param {number} [maxLines=Infinity]
 * @returns {string[]}
 */
export function wrapText(text, maxUnits, maxLines = Infinity) {
  const max = Math.max(2, Math.floor(Number(maxUnits) || 0));
  /** @type {string[]} */
  const out = [];
  for (const para of String(text ?? '').split(/\r?\n/)) {
    let line = '';
    let n = 0;
    for (const ch of para) {
      const k = charUnits(ch);
      if (n + k > max) { out.push(line); line = ''; n = 0; }
      if (!line && ch === ' ') continue; // 行首的空白不留
      line += ch;
      n += k;
    }
    out.push(line);
  }
  const lim = Math.max(1, Math.floor(Number(maxLines) || 0) || Infinity);
  if (out.length <= lim) return out;
  const kept = out.slice(0, lim);
  const last = [...kept[lim - 1]];
  while (last.length && last.reduce((s, ch) => s + charUnits(ch), 0) + charUnits('…') > max) last.pop();
  kept[lim - 1] = `${last.join('')}…`;
  return kept;
}

/**
 * 依序試每一段（同步或 async 函式都可以），回傳第一個成功的；每一段的錯誤都記下來（不丟錯）。
 * @template T
 * @param {Array<() => T | Promise<T>>} tries
 * @returns {Promise<{ ok: boolean, value: T | undefined, index: number, errors: Array<{ index: number, message: string }> }>}
 */
export async function firstOk(tries) {
  /** @type {Array<{ index: number, message: string }>} */
  const errors = [];
  for (let i = 0; i < tries.length; i++) {
    try {
      return { ok: true, value: await tries[i](), index: i, errors };
    } catch (e) {
      errors.push({ index: i, message: String(/** @type {any} */ (e)?.message || e || '不明錯誤') });
    }
  }
  return { ok: false, value: undefined, index: -1, errors };
}

/**
 * 截圖各段的錯誤整理成一句：「截圖程式第 N 版；第 1 段：…；第 2 段：…」（每段錯誤最多 160 字）。
 * @param {Array<{ index: number, message: string }>} [errors]
 * @param {number} [rev=SHOT_REV]
 * @returns {string}
 */
export function shotErrorText(errors = [], rev = SHOT_REV) {
  return [`截圖程式第 ${rev} 版`, ...errors.map((e) => `第 ${e.index + 1} 段：${String(e.message).slice(0, 160)}`)].join('；');
}

/**
 * 文字截圖（最後一段退路，不用 html2canvas）要畫的每一行。
 * @param {{ position?: Position | null, label?: string, version?: string, maxUnits?: number }} [ctx] label：場景的中文名（可不給）
 * @returns {string[]}
 */
export function textShotLines(ctx = {}) {
  const pos = ctx.position || {};
  const max = ctx.maxUnits || 56;
  const line = Number.isInteger(pos.line) ? pos.line : 0;
  const head = `${pos.day ?? ''}｜${pos.scene || ''}${ctx.label ? `（${ctx.label}）` : ''}｜第 ${line} 句`;
  return [
    ...wrapText(head, max, 2),
    '',
    ...wrapText(`${pos.speaker ? `${pos.speaker}：` : ''}${pos.text || NO_LINE}`, max, 12),
    '',
    ...wrapText(`版本 ${ctx.version || ''}｜截圖程式第 ${SHOT_REV} 版`, max, 2),
    '（畫面截不下來，只有文字）',
  ];
}
