// 回報問題的內容（純邏輯）：不碰 DOM、localStorage、fetch、navigator。要的東西都從參數傳進來，才能在 Node 測試。
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

// 版本：網址 ?v= 優先，沒有就用 src/version.js 的 BUILD
export function versionOf(search, build) {
  try {
    const v = new URLSearchParams(String(search ?? '')).get('v');
    if (v) return v.slice(0, 40);
  } catch { /* 網址壞了就用 BUILD */ }
  return String(build || '');
}

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
// ctx：{ state, beat, nameOf, now: Date, search, build, device, category, comment, screenshot }
export function buildPayload(ctx = {}) {
  const op = ctx.state?.opening || {};
  const { speaker, text } = lineInfo(ctx.beat, ctx.nameOf);
  const now = ctx.now instanceof Date ? ctx.now : new Date(ctx.now ?? Date.now());
  const shot = typeof ctx.screenshot === 'string' && ctx.screenshot.startsWith('data:image/') ? ctx.screenshot : '';
  return {
    time: now.toISOString(),
    version: versionOf(ctx.search, ctx.build),
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

// raw.githack 會把圖片（.webp 等）301 轉到 raw.githubusercontent.com：網址看起來同網域，其實圖是別的網域來的，
// html2canvas 以為同網域就不加 crossOrigin，畫進去整張畫布就被「汙染」、不能輸出。截圖時把這類網址直接換成 githubusercontent
// （那邊有 Access-Control-Allow-Origin: *），html2canvas 就會用 CORS 載入。頁面本身、js、css、json 不換。
export const GITHACK_HOST = 'raw.githack.com';
export const DIRECT_HOST = 'https://raw.githubusercontent.com';
export function directAssetUrl(url, pageHref) {
  try {
    const page = new URL(pageHref);
    const u = new URL(url, pageHref);
    if (page.hostname !== GITHACK_HOST || u.hostname !== GITHACK_HOST) return url;
    if (/\.(html?|m?js|css|json)$/i.test(u.pathname) || u.pathname.endsWith('/')) return url;
    return DIRECT_HOST + u.pathname;
  } catch {
    return url;
  }
}
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
