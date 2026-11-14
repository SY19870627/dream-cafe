// 除錯模式開關：只有網址帶 ?debug=1 才開。main.js 只靜態載入這一個檔（很小、純函式）；
// 其他除錯模組（面板、截圖、回報、佇列）一律在開關為真時才用動態 import() 載入，一般玩家完全不會下載、不碰 DOM、不發請求。
export function debugOn(search) {
  try {
    return new URLSearchParams(String(search ?? '')).get('debug') === '1';
  } catch {
    return false;
  }
}

// raw.githack 會把圖片（.webp 等）301 轉到 raw.githubusercontent.com：網址看起來同網域，其實圖是別的網域來的，
// html2canvas 以為同網域就不加 crossOrigin，畫進去整張畫布就被「汙染」、不能輸出。截圖（與 debug 模式的 art.js）把這類網址
// 直接換成 githubusercontent（那邊有 Access-Control-Allow-Origin: *），用 CORS 載入。頁面本身、js、css、json 不換。
// 換過的網址多帶 cors=1：和頁面 CSS 用非 CORS 載入、已經進了瀏覽器快取的那一份是不同的快取項目，不會被拿來重用。
// 放在這個檔（純函式、main.js 本來就會載入）是因為 art.js 也要用；report.js 再 re-export 給截圖用。
export const GITHACK_HOSTS = ['raw.githack.com', 'rawcdn.githack.com'];
export const DIRECT_HOST = 'https://raw.githubusercontent.com';
export const CORS_PARAM = 'cors';

// 頁面是不是在 raw.githack（或 rawcdn.githack）上
export function onGithack(pageHref) {
  try {
    return GITHACK_HOSTS.includes(new URL(pageHref).hostname);
  } catch {
    return false;
  }
}

export function directAssetUrl(url, pageHref) {
  try {
    const page = new URL(pageHref);
    const u = new URL(url, pageHref);
    if (!GITHACK_HOSTS.includes(page.hostname) || !GITHACK_HOSTS.includes(u.hostname)) return url;
    if (/\.(html?|m?js|css|json)$/i.test(u.pathname) || u.pathname.endsWith('/')) return url;
    const q = new URLSearchParams(u.search);
    q.set(CORS_PARAM, '1');
    return `${DIRECT_HOST}${u.pathname}?${q}`;
  } catch {
    return url;
  }
}
