// 回報問題的內容（純邏輯）：不碰 DOM、localStorage、fetch、navigator。要的東西都從參數傳進來，才能在 Node 測試。
// 通用的部分在除錯核心（./core/report.js）；這裡只放 dream-cafe 自己的：第幾天怎麼算、說話的人、版本怎麼判斷、圖的直連網址。
import { directAssetUrl, GITHACK_HOSTS, DIRECT_HOST } from './flag.js';
import { runningVersion } from './reset.js';
import { formatVersion } from './stamp.js';
import * as core from './core/report.js';

export {
  CATEGORIES, COMMENT_MAX, SHOT_MAX_WIDTH, SHOT_QUALITY, SHOT_MAX_BASE64, SHOT_REV,
  plainText, deviceSummary, shotFits, shotScale, charUnits, wrapText, firstOk, shotErrorText,
} from './core/report.js';
const { plainText } = core;
export const GAME = 'dream-cafe'; // 收件端用這個分遊戲（白名單 dream-cafe、taiwan-procession）

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

// 版本：「commit 時間（實際在跑的 commit 短碼）」——formatVersion（stamp.js）＋ runningVersion（reset.js），面板也用同一組
export { runningVersion, formatVersion };

// 眼前那一句：說話的人（沒有名牌是旁白；這一幕沒有句子是空字串）與純文字台詞
export function lineInfo(beat, nameOf = () => '') {
  if (!beat) return { speaker: '', text: '' };
  const speaker = beat.who ? (nameOf(beat.who) || beat.who) : '旁白';
  return { speaker, text: plainText(beat.text) };
}

// 進度＋這一句 → 核心要的位置 { day, scene, line, speaker, text }（回報框、文字截圖、送出的回報都用這個）
export function positionOf(state, beat, nameOf) {
  const op = state?.opening || {};
  const { speaker, text } = lineInfo(beat, nameOf);
  return { day: dayLabel(op.act), scene: String(op.act || ''), line: op.line, speaker, text };
}

// 組出一筆回報（送出與存佇列都用這個形狀）
// ctx：{ state, beat, nameOf, now: Date, buildTime（src/version.js 的 BUILD_TIME）, moduleUrl（除錯模組的 import.meta.url）, pageUrl（location.href）, device, category, comment, screenshot, owner }
export function buildPayload(ctx = {}) {
  return core.buildPayload({
    ...ctx,
    position: positionOf(ctx.state, ctx.beat, ctx.nameOf),
    game: GAME,
    version: formatVersion(ctx.buildTime, runningVersion(ctx.moduleUrl, ctx.pageUrl)),
  });
}

// raw.githack 的圖換成 raw.githubusercontent 直連（說明在 flag.js）；這裡 re-export 給截圖用
export { directAssetUrl, GITHACK_HOSTS, DIRECT_HOST };
// CSS background-image 字串裡的 url(...) 都換掉
export function directCssUrls(css, pageHref) {
  return core.rewriteCssUrls(css, (u) => directAssetUrl(u, pageHref));
}

// 文字截圖（最後一段退路，不用 html2canvas）要畫的每一行
// ctx：{ state, beat, nameOf, label（幕的中文名）, version, maxUnits }
export function textShotLines(ctx = {}) {
  return core.textShotLines({ position: positionOf(ctx.state, ctx.beat, ctx.nameOf), label: ctx.label, version: ctx.version, maxUnits: ctx.maxUnits });
}

// 「複製文字」用：一筆回報整理成純文字（不含截圖），可以直接貼在聊天裡
export function reportText(p) {
  return core.reportText({ game: GAME, ...p });
}
