// 「重新載入最新版」「清除存檔重來」的純邏輯（不碰 DOM、localStorage、fetch，才能在 Node 測試）。
//
// 為什麼換到「釘在 commit 的網址」：
// index.html 用相對路徑載入 src/main.js，main.js 再 import 其他檔，這些網址都沒有帶版本。
// 只在網址後面改 ?v=，瀏覽器只會重抓 index.html，底下的 js 可能還是舊的（手機 Chrome／Safari 都會這樣）。
// raw.githack 的網址可以把分支名換成 commit 編號：https://raw.githack.com/SY19870627/dream-cafe/<commit>/index.html
// 換了 commit，所有檔案（index.html、js、圖）的網址整串都變新的，瀏覽器的快取裡一定沒有，只能重抓；
// 同一個 commit 的內容永遠不變，也不會抓到半新半舊。存檔在 localStorage，是跟著網域（raw.githack.com）走，換路徑不會不見。
export const REPO_PREFIX = '/SY19870627/dream-cafe/';
export const BRANCH = 'feat/v3b-acts1-4';
export const LATEST_API = `https://api.github.com/repos/SY19870627/dream-cafe/commits/${BRANCH}`;
export const GITHACK_HOSTS = ['raw.githack.com', 'rawcdn.githack.com'];

// 遊戲進度的鍵：dream-cafe. 開頭、但不是 dream-cafe.debug.（回報佇列、快轉設定）的都算
export function saveKeysToClear(keys) {
  return [...keys].filter((k) => typeof k === 'string' && k.startsWith('dream-cafe.') && !k.startsWith('dream-cafe.debug.'));
}

// GitHub API 回來的 JSON → 完整 commit 編號（40 碼）；不像就回 ''
export function shaOf(json) {
  const sha = json && typeof json.sha === 'string' ? json.sha.trim() : '';
  return /^[0-9a-f]{40}$/i.test(sha) ? sha.toLowerCase() : '';
}

// 網址裡目前釘的版本：raw.githack 路徑裡的 ref（分支名或 commit）與檔名
export function githackRef(url) {
  const u = new URL(url);
  if (!GITHACK_HOSTS.includes(u.hostname) || !u.pathname.startsWith(REPO_PREFIX)) return null;
  const m = /^(.*?)\/([^/]*\.html)?$/.exec(u.pathname.slice(REPO_PREFIX.length));
  return m && m[1] ? { ref: decodeURIComponent(m[1]), file: m[2] || 'index.html' } : null;
}

// 要跳去的網址：
// - 拿得到最新 commit、又是 raw.githack：路徑換成那個 commit（所有檔案都是新網址），v＝短碼
// - 拿不到（API 失敗）或不是 raw.githack（例如本機測試）：路徑不動，v＝短碼或時間
// 其他參數（debug=1 等）照留，另外加 _r＝時間，連 index.html 本身也不會吃快取
export function reloadUrl(url, sha, now = Date.now()) {
  const u = new URL(url);
  const gh = githackRef(url);
  if (sha && gh) u.pathname = `${REPO_PREFIX}${sha}/${gh.file}`;
  u.searchParams.set('v', sha ? sha.slice(0, 7) : String(now));
  u.searchParams.set('_r', String(now));
  return u.toString();
}

// debug 模式開機時要不要先查最新 commit：只有在 raw.githack 的「分支網址」（ref 不是 40 碼 commit）才要。
// 已經釘在 commit 的網址不查、不轉（就算不是最新也只顯示提示，不自動跳）。
export const isFullSha = (s) => /^[0-9a-f]{40}$/i.test(String(s || ''));
export function onBranch(url) {
  try {
    const gh = githackRef(url);
    return !!gh && !isFullSha(gh.ref);
  } catch {
    return false;
  }
}
// 拿到最新 commit 後要不要轉去釘 commit 的網址：分支網址＋查到 40 碼 sha 才轉；
// 轉完的網址（reloadUrl）已經釘了 commit，再判一次一定是 false，不會一直轉。
export function shouldPin(url, sha) {
  return isFullSha(sha) && onBranch(url);
}

// 面板上顯示的「目前版本」：網址釘了 commit 就用 commit 短碼，否則 ?v=，再沒有就用 BUILD
export function currentVersion(url, build = '') {
  const gh = (() => { try { return githackRef(url); } catch { return null; } })();
  if (gh && /^[0-9a-f]{7,40}$/i.test(gh.ref)) return gh.ref.slice(0, 7);
  let v = '';
  try { v = new URL(url).searchParams.get('v') || ''; } catch { v = ''; }
  return v || String(build || '');
}
