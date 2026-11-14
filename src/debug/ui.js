// 除錯面板（只有網址帶 ?debug=1 時由 main.js 動態 import）：dream-cafe 和除錯核心之間的轉接層（adapter）。
// 面板、回報框、截圖、佇列、快轉的做法都在 ./core/（兩個遊戲共用，不含 dream-cafe 的東西）；
// 這裡只組 dream-cafe 自己的設定：幕名與跳關（jump.js、state.js 的 jumpState）、存檔鍵、raw.githack 的版本判斷與自動釘 commit、
// 圖的直連網址（githubusercontent＋cors=1）。
import { nameOf } from '../view/reader.js';
import { BUILD_TIME } from '../version.js';
import { REPORT_ENDPOINT, REPORT_KEY } from './config.js';
import { formatVersion, versionParts } from './stamp.js';
import { directAssetUrl, positionOf, GAME } from './report.js';
import { QUEUE_KEY } from './queue.js';
import { jumpGroups, actLabel } from './jump.js';
import { shaOf, reloadUrl, runningVersion, onBranch, shouldPin, LATEST_API, CLEAR_RULE } from './reset.js';
import { startDebug } from './core/ui.js';

const FAST_KEY = 'dream-cafe.debug.fast';
const OWNER_KEY = 'dream-cafe.debug.owner'; // 本人識別碼：只存在這台裝置；不顯示、不記錄、不放進複製的文字；「清除存檔重來」不會刪
const FAST_RATE = 5; // 快轉：等待時間變 1/5，CSS 動畫／轉場 5 倍速
const H2C_SRC = 'vendor/html2canvas.min.js';
// 這個模組自己的網址：判斷實際在跑的是哪個 commit（頁面網址可能沒帶 v=，或分支網址還沒釘成 commit）
const MODULE_URL = import.meta.url;
// 版本＝「commit 時間（實際在跑的 commit 短碼）」：面板「目前位置」、「版本與重來」、回報框「自動帶入」、文字截圖、
// 送出的回報都用 formatVersion(BUILD_TIME, runningVersion(...))，顯示的版本一定一致
const running = () => runningVersion(MODULE_URL, location.href);
const version = () => formatVersion(BUILD_TIME, running());

// 最新 commit（GitHub 公開 API，不用登入；每小時 60 次上限）；查不到回 ''
// LATEST_API 查的是分支 feat/v3b-acts1-4 的最新 commit；每次最多等 8 秒，失敗隔 1.5 秒再試一次
const LATEST_TIMEOUT_MS = 8000;
const LATEST_RETRY_MS = 1500;
async function latestOnce() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), LATEST_TIMEOUT_MS);
  try {
    const res = await fetch(LATEST_API, { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
    return res.ok ? shaOf(await res.json()) : '';
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}
async function latestCommit() {
  const sha = await latestOnce();
  if (sha) return sha;
  await new Promise((ok) => setTimeout(ok, LATEST_RETRY_MS));
  return latestOnce();
}

// 開機先確定跑的是最新、釘在 commit 的版本：
// 模組網址不帶版本，在 raw.githack 的分支網址上，瀏覽器（或 CDN）可能還在給舊的 js（只改 ?v= 沒用，見 reset.js 開頭）。
// 分支網址就查最新 commit，查到就換成釘 commit 的網址（所有檔案都是新網址，一定重抓）；回傳 true＝正在換頁，不用再畫面板。
// 已釘 commit 不轉；查不到（API 失敗、超過次數）也不轉，面板顯示「可能不是最新版」。
let pinNote = '';
async function pinLatest() {
  if (!onBranch(location.href)) return false;
  const sha = await latestCommit();
  if (!shouldPin(location.href, sha)) {
    pinNote = '查不到最新 commit，現在跑的可能不是最新版（可以按「重新載入最新版」）';
    return false;
  }
  location.replace(reloadUrl(location.href, sha));
  return true;
}

/**
 * hooks：{ app, getState(), beat(), jump(act, line) → boolean, setTimeScale(k) }
 * 在分支網址上會先換到釘 commit 的網址（回傳 null，不畫面板）
 */
export async function start(hooks) {
  if (await pinLatest()) return null;
  return startDebug({
    app: hooks.app,
    game: GAME,
    endpoint: REPORT_ENDPOINT,
    key: REPORT_KEY,
    storageKeys: { queue: QUEUE_KEY, fast: FAST_KEY, owner: OWNER_KEY },
    isGameSaveKey: CLEAR_RULE.isGameSaveKey, // dream-cafe.v3b 等；dream-cafe.debug.* 不刪
    keepPrefixes: CLEAR_RULE.keepPrefixes,
    position: () => positionOf(hooks.getState(), hooks.beat(), nameOf),
    sceneLabel: actLabel,
    jumpGroups: () => jumpGroups().map((g) => ({ name: g.name, items: g.items.map((it) => ({ scene: it.act, label: it.label, lines: it.lines })) })),
    jump: (act, line) => hooks.jump(act, line),
    setTimeScale: (k) => hooks.setTimeScale?.(k),
    fastRate: FAST_RATE,
    version: {
      display: version,
      parts: () => versionParts(BUILD_TIME, running()), // 面板小字用同一組輸入拆開
      note: () => pinNote,
      latest: async () => { const sha = await latestCommit(); return sha ? { id: sha, label: sha.slice(0, 7) } : null; },
      reloadUrl: (latest) => reloadUrl(location.href, latest?.id || ''),
    },
    capture: {
      html2canvasSrc: H2C_SRC,
      // 轉到別的網域的圖：網址直接換成真正的來源，讓 html2canvas 用 CORS 載入（見 flag.js 的 directAssetUrl）
      assetUrl: (url) => directAssetUrl(url, location.href),
      background: '#1a1612',
    },
    text: {
      sceneAria: '幕',
      jumpHint: '跳關會覆蓋這台裝置的存檔；岔路、存摺選擇自動補上，停在關卡那一句要重做。',
      jumpFail: '跳不過去（幕名不對）',
      shotLost: '截圖少了店內 360 畫面（瀏覽器不讓讀取）',
    },
  });
}
