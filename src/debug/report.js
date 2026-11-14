// 回報問題的內容（純邏輯）：不碰 DOM、localStorage、fetch、navigator。要的東西都從參數傳進來，才能在 Node 測試。
import { directAssetUrl, GITHACK_HOSTS, DIRECT_HOST } from './flag.js';
import { runningVersion } from './reset.js';
import { formatVersion } from './stamp.js';
export const CATEGORIES = ['台詞', '畫面', '圖', '操作', '其他']; // 可以不選（空字串）
export const GAME = 'dream-cafe'; // 收件端用這個分遊戲（白名單 dream-cafe、taiwan-procession）
export const COMMENT_MAX = 1000; // 意見最多幾個字（收件端也是 1000）
export const SHOT_MAX_WIDTH = 720; // 截圖寬度上限（px）
export const SHOT_QUALITY = 0.7; // JPEG 品質
export const SHOT_MAX_BASE64 = 200 * 1024; // base64 超過這個長度就再壓／縮；縮到最小還超過就不附截圖

// 第幾天：dNxxx → N；開場（含第一晚）→ 0；第四天睡著後的待續 → 4
export function dayOf(act) {
  const m = /^d(\d+)/.exec(String(act || ''));
  if (m) return Number(m[1]);
  return act === 'tbc' ? 4 : 0;
}

// 「天」欄的字：開場（含第一晚）→「開場」；第一～四天 →「第N天」；第四天睡著後 →「待續」
export function dayLabel(act) {
  if (act === 'tbc') return '待續';
  const n = dayOf(act);
  return n ? `第${n}天` : '開場';
}

// 台詞純文字：拿掉 HTML 標籤、還原常見實體、收掉多餘空白
export function plainText(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// 版本：「commit 時間（實際在跑的 commit 短碼）」——formatVersion（stamp.js）＋ runningVersion（reset.js），面板也用同一組
export { runningVersion, formatVersion };

// 裝置摘要：手機／平板／電腦、作業系統、螢幕大小、devicePixelRatio、直向／橫向
// info：{ ua, maxTouchPoints, screenW, screenH, viewW, viewH, dpr }
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

// 眼前那一句：說話的人（沒有名牌是旁白；這一幕沒有句子是空字串）與純文字台詞
export function lineInfo(beat, nameOf = () => '') {
  if (!beat) return { speaker: '', text: '' };
  const speaker = beat.who ? (nameOf(beat.who) || beat.who) : '旁白';
  return { speaker, text: plainText(beat.text) };
}

// 組出一筆回報（送出與存佇列都用這個形狀）
// ctx：{ state, beat, nameOf, now: Date, buildTime（src/version.js 的 BUILD_TIME）, moduleUrl（除錯模組的 import.meta.url）, pageUrl（location.href）, device, category, comment, screenshot }
export function buildPayload(ctx = {}) {
  const op = ctx.state?.opening || {};
  const { speaker, text } = lineInfo(ctx.beat, ctx.nameOf);
  const now = ctx.now instanceof Date ? ctx.now : new Date(ctx.now ?? Date.now());
  const shot = typeof ctx.screenshot === 'string' && ctx.screenshot.startsWith('data:image/') ? ctx.screenshot : '';
  return {
    time: now.toISOString(),
    version: formatVersion(ctx.buildTime, runningVersion(ctx.moduleUrl, ctx.pageUrl)),
    day: dayLabel(op.act),
    scene: String(op.act || ''),
    line: Number.isInteger(op.line) ? op.line : 0,
    speaker,
    text,
    category: CATEGORIES.includes(ctx.category) ? ctx.category : '',
    comment: String(ctx.comment ?? '').trim().slice(0, COMMENT_MAX),
    screenshot: shot,
    device: String(ctx.device || ''),
    game: GAME,
    owner: String(ctx.owner || ''), // 本人識別碼：只在送出時帶上；複製文字、佇列、匯出都不含
  };
}

// 截圖程式的版本：每次改截圖邏輯就加一。失敗訊息、面板都會顯示，一眼分得出瀏覽器跑的是不是舊檔。
export const SHOT_REV = 2;

// raw.githack 的圖換成 raw.githubusercontent 直連（說明在 flag.js）；這裡 re-export 給截圖用
export { directAssetUrl, GITHACK_HOSTS, DIRECT_HOST };
// CSS background-image 字串裡的 url(...) 都換掉
export function directCssUrls(css, pageHref) {
  return String(css || '').replace(/url\((["']?)([^"')]+)\1\)/g, (all, q, u) => `url("${directAssetUrl(u, pageHref)}")`);
}

// 截圖 data URL 的 base64 部分有沒有在上限內
export function shotFits(dataUrl, max = SHOT_MAX_BASE64) {
  const s = String(dataUrl || '');
  const i = s.indexOf(',');
  return (i >= 0 ? s.length - i - 1 : s.length) <= max;
}

// 截圖要用多大的倍率：輸出寬度不超過 SHOT_MAX_WIDTH，也不超過裝置原本的解析度
export function shotScale(width, dpr = 1, maxWidth = SHOT_MAX_WIDTH) {
  const w = Number(width) || 0;
  if (w <= 0) return 1;
  return Math.max(0.1, Math.min(Number(dpr) || 1, maxWidth / w));
}

// 一個字佔幾格：全形（中日韓文字、全形標點）算 2，半形算 1
export function charUnits(ch) {
  const c = String(ch).codePointAt(0) || 0;
  if (c > 0xffff) return 2; // 表情符號、罕用字
  return (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3)
    || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) ? 2 : 1;
}

// 換行：每行最多 maxUnits 格（全形 2、半形 1）；原本的換行照留；沒有空白的長字串硬切。
// maxLines：最多幾行，超過的話最後一行結尾換成「…」。空字串回 ['']
export function wrapText(text, maxUnits, maxLines = Infinity) {
  const max = Math.max(2, Math.floor(Number(maxUnits) || 0));
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
  let last = [...kept[lim - 1]];
  while (last.length && last.reduce((s, ch) => s + charUnits(ch), 0) + charUnits('…') > max) last.pop();
  kept[lim - 1] = `${last.join('')}…`;
  return kept;
}

// 依序試每一段（同步或 async 函式都可以），回傳第一個成功的；每一段的錯誤都記下來。
// 回傳 { ok, value, index（第幾段成功，0 起算；都失敗是 -1）, errors: [{ index, message }] }
export async function firstOk(tries) {
  const errors = [];
  for (let i = 0; i < tries.length; i++) {
    try {
      return { ok: true, value: await tries[i](), index: i, errors };
    } catch (e) {
      errors.push({ index: i, message: String(e?.message || e || '不明錯誤') });
    }
  }
  return { ok: false, value: undefined, index: -1, errors };
}

// 截圖各段的錯誤整理成一句：「截圖程式第 N 版；第 1 段：…；第 2 段：…」（每段錯誤最多 160 字）
export function shotErrorText(errors = [], rev = SHOT_REV) {
  return [`截圖程式第 ${rev} 版`, ...errors.map((e) => `第 ${e.index + 1} 段：${String(e.message).slice(0, 160)}`)].join('；');
}

// 文字截圖（最後一段退路，不用 html2canvas）要畫的每一行
// ctx：{ state, beat, nameOf, label（幕的中文名）, version, maxUnits }
export function textShotLines(ctx = {}) {
  const op = ctx.state?.opening || {};
  const { speaker, text } = lineInfo(ctx.beat, ctx.nameOf);
  const max = ctx.maxUnits || 56;
  const head = `${dayLabel(op.act)}｜${op.act || ''}${ctx.label ? `（${ctx.label}）` : ''}｜第 ${Number.isInteger(op.line) ? op.line : 0} 句`;
  return [
    ...wrapText(head, max, 2),
    '',
    ...wrapText(`${speaker ? `${speaker}：` : ''}${text || '（這一幕沒有台詞）'}`, max, 12),
    '',
    ...wrapText(`版本 ${ctx.version || ''}｜截圖程式第 ${SHOT_REV} 版`, max, 2),
    '（畫面截不下來，只有文字）',
  ];
}

// 「複製文字」用：一筆回報整理成純文字（不含截圖），可以直接貼在聊天裡
export function reportText(p) {
  return [
    `【dream-cafe 回報】${p.day}｜${p.scene} 第 ${p.line} 句｜版本 ${p.version}`,
    `${p.speaker ? `${p.speaker}：` : ''}${p.text || '（這一幕沒有台詞）'}`,
    `分類：${p.category || '未選'}`,
    `意見：${p.comment || '（沒寫）'}`,
    `裝置：${p.device}`,
    `時間：${p.time}`,
  ].join('\n');
}
