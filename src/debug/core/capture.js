// 回報截圖（碰 DOM，只在瀏覽器用）：html2canvas 三段退路＋可選的「遊戲畫面快照」掛勾。
// html2canvas 是把 DOM 複製一份再畫，只改那份複製品，不碰遊戲畫面。
import { SHOT_MAX_WIDTH, SHOT_QUALITY, shotFits, shotScale, firstOk, shotErrorText, textShotLines } from './report.js';

/** @type {Map<string, Promise<any>>} 同一個網址只載入一次 */
const h2cLoading = new Map();

/**
 * 載入 html2canvas（UMD，掛在 window.html2canvas）；已經有了就直接用。
 * @param {string} src 檔案網址（相對於頁面）
 * @returns {Promise<any>}
 */
export function loadHtml2canvas(src) {
  const w = /** @type {any} */ (window);
  if (w.html2canvas) return Promise.resolve(w.html2canvas);
  if (!h2cLoading.has(src)) {
    h2cLoading.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => (w.html2canvas ? resolve(w.html2canvas) : reject(new Error('html2canvas 沒有載入')));
      s.onerror = () => { h2cLoading.delete(src); reject(new Error('html2canvas 載入失敗')); };
      document.head.appendChild(s);
    }));
  }
  return /** @type {Promise<any>} */ (h2cLoading.get(src));
}

/**
 * 畫布縮成一半（JPEG 壓到最低還太大時用）。
 * @param {HTMLCanvasElement} c
 */
function halve(c) {
  const d = document.createElement('canvas');
  d.width = Math.max(1, Math.round(c.width / 2));
  d.height = Math.max(1, Math.round(c.height / 2));
  /** @type {CanvasRenderingContext2D} */ (d.getContext('2d')).drawImage(c, 0, 0, d.width, d.height);
  return d;
}

/**
 * 畫布壓成 JPEG data URL（寬度不超過上限、base64 不超過 200KB）；怎麼壓都太大回空字串。
 * 畫布被汙染時 toDataURL 會丟錯（讓上一層換下一段）。
 * @param {HTMLCanvasElement} canvas
 * @returns {string}
 */
export function toJpeg(canvas) {
  let c = canvas;
  if (c.width > SHOT_MAX_WIDTH) { // 保險：倍率算過了，仍確認寬度不超過上限
    const d = document.createElement('canvas');
    d.width = SHOT_MAX_WIDTH;
    d.height = Math.max(1, Math.round((c.height * SHOT_MAX_WIDTH) / c.width));
    /** @type {CanvasRenderingContext2D} */ (d.getContext('2d')).drawImage(c, 0, 0, d.width, d.height);
    c = d;
  }
  for (let i = 0; i < 4; i++) {
    for (const q of [SHOT_QUALITY, 0.5, 0.35]) {
      const url = c.toDataURL('image/jpeg', q);
      if (shotFits(url)) return url;
    }
    c = halve(c);
  }
  return '';
}

/**
 * 修 html2canvas 的複製品（只改複製品）：
 * 0. 有給 assetUrl：<img> 與 CSS 背景圖的網址都換成它回傳的（例如換成有 CORS 的直連網址）
 * 1. 複製品裡的 CSS 動畫會從頭播（字還是透明的）→ 停掉動畫與轉場，直接用最後的樣子
 * 2. overflow:hidden 又用 transform 位移的框：html2canvas 用沒位移的位置裁切，畫面只剩一半 → 純位移改成 left／top
 * 3. html2canvas 1.4.1 不支援 object-fit → 有 cover／contain 的 <img> 換成 background-size 等效的 <div>
 * @param {Document} doc 複製出來的文件
 * @param {string} sel 要截的元素在複製品裡的選擇器
 * @param {((url: string) => string) | undefined} assetUrl
 */
function fixClone(doc, sel, assetUrl) {
  const st = doc.createElement('style');
  st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
  doc.head.appendChild(st);
  const win = /** @type {Window} */ (doc.defaultView);
  const fix = (/** @type {string} */ u) => (assetUrl ? assetUrl(u) : u);
  if (assetUrl) {
    for (const im of /** @type {HTMLImageElement[]} */ ([...doc.querySelectorAll(`${sel} img`)])) {
      const src = im.currentSrc || im.src;
      const to = assetUrl(src);
      if (to !== src) { im.removeAttribute('srcset'); im.src = to; }
    }
    for (const node of /** @type {HTMLElement[]} */ ([doc.querySelector(sel), ...doc.querySelectorAll(`${sel} *`)])) {
      if (!node) continue;
      const bg = win.getComputedStyle(node).backgroundImage;
      if (bg && bg.includes('url(')) {
        const to = bg.replace(/url\((["']?)([^"')]+)\1\)/g, (all, q, u) => `url("${assetUrl(u)}")`);
        if (to !== bg) node.style.backgroundImage = to;
      }
    }
  }
  for (const node of /** @type {HTMLElement[]} */ ([...doc.querySelectorAll(`${sel} *`)])) {
    const cs = win.getComputedStyle(node);
    if (cs.overflow === 'visible' || cs.position !== 'absolute') continue;
    const m = /^matrix\(1, 0, 0, 1, (-?[\d.]+), (-?[\d.]+)\)$/.exec(cs.transform);
    if (!m) continue;
    node.style.left = `${parseFloat(cs.left) + Number(m[1])}px`;
    node.style.top = `${parseFloat(cs.top) + Number(m[2])}px`;
    node.style.transform = 'none';
  }
  for (const im of /** @type {HTMLImageElement[]} */ ([...doc.querySelectorAll(`${sel} img`)])) {
    const cs = win.getComputedStyle(im);
    const fit = cs.objectFit;
    if (fit !== 'cover' && fit !== 'contain') continue;
    const d = doc.createElement('div');
    d.className = im.className;
    d.setAttribute('style', im.getAttribute('style') || '');
    d.style.backgroundImage = `url("${fix(im.src || im.currentSrc)}")`;
    d.style.backgroundSize = fit;
    d.style.backgroundPosition = cs.objectPosition;
    d.style.backgroundRepeat = 'no-repeat';
    if (cs.position === 'static') d.style.display = 'block';
    if (!d.style.width && cs.width) d.style.width = cs.width;
    if (!d.style.height && cs.height) d.style.height = cs.height;
    im.replaceWith(d);
  }
}

/**
 * 畫布是不是被汙染（讀不出來）：讀一個像素就知道（不用整張 toDataURL，快很多）；拿不到 2D context（例如 WebGL）視為沒汙染。
 * 結果記在 memo 裡，同一次截圖每張畫布只檢查一次（html2canvas 的 ignoreElements 會對每個節點各問一次）。
 * @param {Map<Element, boolean>} memo
 * @returns {(node: Element) => boolean}
 */
export function taintCheck(memo) {
  return (node) => {
    if (!node || node.tagName !== 'CANVAS') return false;
    if (memo.has(node)) return /** @type {boolean} */ (memo.get(node));
    let bad = false;
    const c = /** @type {HTMLCanvasElement} */ (node);
    try {
      const g = c.getContext('2d');
      if (g && c.width > 0 && c.height > 0) g.getImageData(0, 0, 1, 1);
    } catch { bad = true; }
    memo.set(node, bad);
    return bad;
  };
}
// 畫面上看得到（自己與上層都沒有 hidden、有大小）
const visible = (/** @type {Element} */ node) => !node.closest('[hidden]') && node.getClientRects().length > 0;

/**
 * 最後一段退路：不用 html2canvas，自己畫一張 720 寬的文字截圖（第幾天｜場景｜第幾句、說話的人：台詞、版本）。
 * 這張畫布從來沒畫過圖，toDataURL 一定成功。
 * @param {{ position?: any, label?: string, version?: string }} info
 */
function textShot(info) {
  const W = SHOT_MAX_WIDTH;
  const PAD = 28;
  const SIZE = 22;
  const LH = 34;
  const lines = textShotLines({ ...info, maxUnits: Math.floor(((W - PAD * 2) / SIZE) * 2) - 2 });
  const c = document.createElement('canvas');
  c.width = W;
  c.height = PAD * 2 + lines.length * LH;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = '#1a1612';
  g.fillRect(0, 0, c.width, c.height);
  g.font = `${SIZE}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
  g.textBaseline = 'top';
  lines.forEach((t, i) => {
    g.fillStyle = i === lines.length - 1 ? '#c9a77c' : '#f6efe2';
    g.fillText(t, PAD, PAD + i * LH + (LH - SIZE) / 2);
  });
  return c;
}

/**
 * 快照掛勾回傳的東西轉成可以 drawImage 的圖。
 * @param {unknown} x 畫布、圖片、ImageBitmap 或 data URL
 * @returns {Promise<CanvasImageSource | null>}
 */
async function asImage(x) {
  if (!x) return null;
  if (typeof x === 'string') {
    const im = new Image();
    im.src = x;
    await im.decode();
    return im;
  }
  if (x instanceof HTMLImageElement && !x.complete) await x.decode();
  return /** @type {CanvasImageSource} */ (x);
}

/**
 * @typedef {object} CaptureOptions
 * @property {HTMLElement} target 要截的元素
 * @property {HTMLElement} [debugRoot] 除錯介面（一律不入鏡）
 * @property {string} html2canvasSrc html2canvas 的網址
 * @property {(url: string) => string} [assetUrl] 圖片網址改寫
 * @property {string} [background] 背景色
 * @property {(node: Element) => boolean} [ignore] 另外不入鏡的元素
 * @property {() => unknown} [snapshot] 遊戲畫面快照（回傳畫布／圖片／ImageBitmap／data URL，或 Promise）
 * @property {'overlay' | 'only'} [snapshotMode] overlay＝快照放進遊戲畫布、其他 DOM 照常截（預設）；only＝截圖就是快照本身
 * @property {() => Element | null | undefined} [snapshotElement] 快照放在哪個元素（預設：畫面上最大的畫布）
 * @property {string} [lostNote] 有畫布被汙染、第一段跳過它時的提示
 * @property {{ position?: any, label?: string, version?: string }} text 文字截圖的內容
 */

/**
 * 截圖，三段，前一段失敗才試下一段：
 * 1. 完整的畫面（被汙染、讀不出來的畫布不入鏡）；有快照掛勾時把快照放進遊戲畫布（或只用快照），快照失敗退回完整的畫面
 * 2. 只留文字與色塊（不放任何圖：<img>、畫布、CSS 背景圖都拿掉）
 * 3. 文字截圖（textShot，保證成功）
 * 回傳 { url, note }；note＝這張截圖少了什麼（給回報框顯示）。三段都失敗才丟錯（錯誤訊息帶截圖程式版本與每一段的錯）。
 * @param {CaptureOptions} o
 * @returns {Promise<{ url: string, note: string }>}
 */
export async function capture(o) {
  const app = o.target;
  const root = o.debugRoot;
  const extra = o.ignore || (() => false);
  let marked = false;
  if (!app.id) { app.setAttribute('data-dbg-capture', ''); marked = true; }
  const esc = globalThis.CSS?.escape || ((/** @type {string} */ s) => s);
  const sel = app.id ? `#${esc(app.id)}` : '[data-dbg-capture]';
  const memo = new Map();
  const isTainted = taintCheck(memo);
  const skip = (/** @type {Element} */ node) => node === root || extra(node);
  // 截圖前先看畫面上的畫布：有被汙染的就先記下來，第一段會跳過它
  let lost = false;
  for (const c of app.querySelectorAll('canvas')) if (!root?.contains(c) && visible(c) && isTainted(c)) lost = true;
  const background = o.background ?? '#1a1612';
  const scaleOf = () => shotScale(app.getBoundingClientRect().width || app.clientWidth, window.devicePixelRatio || 1);
  /** @param {Record<string, any>} opt */
  const render = async (opt) => {
    const h2c = await loadHtml2canvas(o.html2canvasSrc);
    return h2c(app, { scale: scaleOf(), backgroundColor: background, logging: false, useCORS: true, imageTimeout: 8000, ...opt });
  };
  /** @param {Record<string, any>} opt */
  const shoot = async (opt) => {
    const url = toJpeg(await render(opt));
    if (!url) throw new Error('壓不到 200KB 以內');
    return url;
  };
  const full = async () => ({
    url: await shoot({ ignoreElements: (/** @type {Element} */ node) => skip(node) || isTainted(node), onclone: (/** @type {Document} */ doc) => fixClone(doc, sel, o.assetUrl) }),
    note: lost ? (o.lostNote || '截圖少了部分畫面（瀏覽器不讓讀取）') : '',
  });
  // 有快照掛勾（WebGL 畫布 html2canvas 讀不到內容）：
  // overlay＝照常截整個畫面，只是在 html2canvas 的複製品裡把快照畫進那張畫布（前後層次、背景都和畫面一樣）；
  // only＝只用快照。
  const withSnapshot = async () => {
    const snap = await asImage(await /** @type {() => unknown} */ (o.snapshot)());
    if (!snap) throw new Error('遊戲畫面快照拿不到');
    if (o.snapshotMode === 'only') {
      const s = /** @type {any} */ (snap);
      const c = document.createElement('canvas');
      c.width = Math.max(1, s.naturalWidth || s.width || 1);
      c.height = Math.max(1, s.naturalHeight || s.height || 1);
      /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(snap, 0, 0, c.width, c.height);
      const url = toJpeg(c);
      if (!url) throw new Error('壓不到 200KB 以內');
      return { url, note: '' };
    }
    let at = o.snapshotElement?.();
    if (!at) {
      let best = 0;
      for (const c of app.querySelectorAll('canvas')) {
        if (root?.contains(c) || !visible(c)) continue;
        const r = c.getBoundingClientRect();
        if (r.width * r.height > best) { best = r.width * r.height; at = c; }
      }
    }
    if (!at) throw new Error('找不到要放快照的畫布');
    const mark = 'data-dbg-snapshot';
    at.setAttribute(mark, '');
    try {
      return {
        url: await shoot({
          ignoreElements: (/** @type {Element} */ node) => skip(node) || (node !== at && isTainted(node)),
          onclone: (/** @type {Document} */ doc) => {
            fixClone(doc, sel, o.assetUrl);
            const cl = /** @type {HTMLElement | null} */ (doc.querySelector(`[${mark}]`));
            if (!cl) return;
            const g = cl.tagName === 'CANVAS' ? /** @type {HTMLCanvasElement} */ (cl).getContext('2d') : null;
            if (g) {
              const cv = /** @type {HTMLCanvasElement} */ (cl);
              g.clearRect(0, 0, cv.width, cv.height);
              g.drawImage(snap, 0, 0, cv.width, cv.height);
            } else {
              // 不是畫布（或拿不到 2D）：快照當成背景圖鋪滿
              const c = document.createElement('canvas');
              const s = /** @type {any} */ (snap);
              c.width = Math.max(1, s.naturalWidth || s.width || 1);
              c.height = Math.max(1, s.naturalHeight || s.height || 1);
              /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(snap, 0, 0);
              cl.style.setProperty('background', `url("${c.toDataURL()}") 0 0 / 100% 100% no-repeat`, 'important');
            }
          },
        }),
        note: lost ? (o.lostNote || '截圖少了部分畫面（瀏覽器不讓讀取）') : '',
      };
    } finally {
      at.removeAttribute(mark);
    }
  };
  const tries = [
    o.snapshot ? async () => { try { return await withSnapshot(); } catch { return full(); } } : full,
    async () => ({
      url: await shoot({
        ignoreElements: (/** @type {Element} */ node) => skip(node) || node.tagName === 'CANVAS' || node.tagName === 'IMG',
        onclone: (/** @type {Document} */ doc) => {
          fixClone(doc, sel, o.assetUrl);
          for (const n of /** @type {NodeListOf<HTMLElement>} */ (doc.querySelectorAll(`${sel}, ${sel} *`))) n.style.setProperty('background-image', 'none', 'important');
        },
      }),
      note: '截圖只有文字、沒有圖（瀏覽器不讓讀取圖片）',
    }),
    async () => {
      const url = toJpeg(textShot(o.text));
      if (!url) throw new Error('文字截圖壓不到 200KB 以內');
      return { url, note: '畫面截不下來，只有文字' };
    },
  ];
  try {
    const r = await firstOk(tries);
    if (!r.ok || !r.value) throw new Error(shotErrorText(r.errors));
    // 前面的段落失敗過：錯誤也附在提示裡，方便查是哪裡不行
    return { url: r.value.url, note: r.errors.length ? `${r.value.note}（${shotErrorText(r.errors)}）` : r.value.note };
  } finally {
    if (marked) app.removeAttribute('data-dbg-capture');
  }
}
