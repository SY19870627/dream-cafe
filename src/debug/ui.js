// 除錯面板（只有網址帶 ?debug=1 時由 main.js 動態 import）：跳關、快轉、回報問題（截圖＋自動帶入目前位置）、離線佇列。
// 這裡是唯一碰 DOM／localStorage／fetch／navigator 的除錯檔；內容怎麼組、怎麼送、怎麼排隊都在 report.js／queue.js／jump.js（純邏輯）。
// 樣式用 <style> 注入，class 一律 .dbg- 開頭，不動 index.html。
// 面板上的點擊、拖曳、按鍵一律在這裡擋掉，不會穿到遊戲（不會翻句、不會轉店內鏡頭）。
import { nameOf } from '../view/reader.js';
import { BUILD } from '../version.js';
import { REPORT_ENDPOINT, REPORT_KEY } from './config.js';
import { COMMENT_MAX, CATEGORIES, buildPayload, reportText, deviceSummary, shotFits, shotScale, SHOT_MAX_WIDTH, SHOT_QUALITY } from './report.js';
import { readQueue, submit, flush, exportText, RETRY_MS } from './queue.js';
import { jumpGroups, actLabel } from './jump.js';
import { saveKeysToClear, shaOf, reloadUrl, currentVersion, LATEST_API } from './reset.js';

const FAST_KEY = 'dream-cafe.debug.fast';
const OWNER_KEY = 'dream-cafe.debug.owner'; // 本人識別碼：只存在這台裝置；不顯示、不記錄、不放進複製的文字；「清除存檔重來」不會刪
const FAST_RATE = 5; // 快轉：等待時間變 1/5，CSS 動畫／轉場 5 倍速
const H2C_SRC = 'vendor/html2canvas.min.js';

const CSS = `
.dbg-root { position: absolute; inset: 0; z-index: 60; pointer-events: none; font-size: 15px; line-height: 1.5; color: #2b2119;
  -webkit-user-select: text; user-select: text; }
.dbg-root * { box-sizing: border-box; }
.dbg-fab { position: absolute; left: 6px; top: 46%; width: 44px; height: 44px; min-width: 44px; min-height: 44px; padding: 0; border-radius: 22px;
  pointer-events: auto; background: rgba(30,22,16,.55); color: #f6efe2; box-shadow: 0 2px 8px rgba(0,0,0,.35); font-size: 13px; font-weight: 700; opacity: .75; }
.dbg-rep { position: absolute; left: 6px; top: calc(46% + 54px); min-width: 44px; height: 44px; min-height: 44px; padding: 0 10px; border-radius: 22px;
  pointer-events: auto; background: rgba(122,86,56,.8); color: #fbf5e8; box-shadow: 0 2px 8px rgba(0,0,0,.35); font-size: 14px; font-weight: 700; opacity: .85; }
.dbg-fab:hover, .dbg-fab:focus-visible { opacity: 1; }
.dbg-fab.dbg-fast { background: rgba(170,70,30,.75); }
.dbg-badge { position: absolute; right: -4px; top: -4px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: #d9482b; color: #fff;
  font-size: 12px; line-height: 20px; text-align: center; }
.dbg-sheet { position: absolute; left: 8px; right: 8px; top: calc(8px + env(safe-area-inset-top)); bottom: 8px; overflow-y: auto; pointer-events: auto;
  padding: 14px 14px 18px; border-radius: 12px; background: rgba(251,247,238,.97); box-shadow: 0 10px 30px rgba(0,0,0,.5); touch-action: pan-y; }
.dbg-sheet h3 { margin: 14px 0 6px; font-size: 14px; letter-spacing: 1px; color: #7a5638; }
.dbg-sheet h3:first-of-type { margin-top: 0; }
.dbg-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dbg-row > * { flex: none; }
.dbg-grow { flex: 1 1 auto !important; min-width: 0; }
.dbg-sheet button { min-height: 44px; min-width: 44px; padding: 8px 14px; border-radius: 10px; font-size: 15px; background: #efe4cf; color: #2b2119; box-shadow: none; border: 1px solid #c9b48f; }
.dbg-sheet button.dbg-primary { background: #7a5638; color: #fbf5e8; border-color: #7a5638; }
.dbg-sheet button:disabled { opacity: .5; }
.dbg-sheet select, .dbg-sheet input, .dbg-sheet textarea { min-height: 44px; font: inherit; font-size: 16px; padding: 8px 10px; border-radius: 8px; border: 1px solid #c9b48f; background: #fff; color: #2b2119; }
.dbg-sheet textarea { width: 100%; min-height: 110px; resize: vertical; }
.dbg-line { width: 88px; }
.dbg-close { position: sticky; top: 0; float: right; margin: -6px -6px 0 0; }
.dbg-info { margin: 0; padding: 8px 10px; border-radius: 8px; background: #f1e8d6; font-size: 13px; white-space: pre-wrap; word-break: break-all; }
.dbg-shot { display: block; max-width: 100%; max-height: 220px; margin: 6px 0; border: 1px solid #c9b48f; border-radius: 6px; }
.dbg-msg { min-height: 1.5em; margin: 8px 0 0; font-size: 13px; color: #7a5638; }
.dbg-msg.dbg-err { color: #b3261e; }
.dbg-hint { margin: 4px 0 0; font-size: 12px; color: #8a7660; }
`;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const btn = (text, cls = '') => { const b = el('button', cls, text); b.type = 'button'; return b; };

let h2cLoading = null;
function loadHtml2canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (!h2cLoading) {
    h2cLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = H2C_SRC;
      s.onload = () => (window.html2canvas ? resolve(window.html2canvas) : reject(new Error('html2canvas 沒有載入')));
      s.onerror = () => { h2cLoading = null; reject(new Error('html2canvas 載入失敗')); };
      document.head.appendChild(s);
    });
  }
  return h2cLoading;
}

// 畫布縮成一半（JPEG 壓到最低還太大時用）
function halve(c) {
  const d = document.createElement('canvas');
  d.width = Math.max(1, Math.round(c.width / 2));
  d.height = Math.max(1, Math.round(c.height / 2));
  d.getContext('2d').drawImage(c, 0, 0, d.width, d.height);
  return d;
}
function toJpeg(canvas) {
  let c = canvas;
  if (c.width > SHOT_MAX_WIDTH) { // 保險：倍率算過了，仍確認寬度不超過上限
    const d = document.createElement('canvas');
    d.width = SHOT_MAX_WIDTH;
    d.height = Math.max(1, Math.round((c.height * SHOT_MAX_WIDTH) / c.width));
    d.getContext('2d').drawImage(c, 0, 0, d.width, d.height);
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

// html2canvas 是把 DOM 複製一份再畫，只改那份複製品，不碰遊戲畫面：
// 1. 複製品裡的 CSS 動畫會從頭播（字還是透明的）→ 停掉動畫與轉場，直接用最後的樣子
// 2. html2canvas 1.4.1 不支援 object-fit → 有 cover／contain 的 <img> 換成 background-size 等效的 <div>
function fixClone(doc) {
  const st = doc.createElement('style');
  st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
  doc.head.appendChild(st);
  const win = doc.defaultView;
  // 3. overflow:hidden 又用 transform 位移的框（例如 .op-art 的 translateX(-50%)）：html2canvas 用沒位移的位置裁切，
  //    畫面只剩一半 → 純位移改成 left／top
  for (const node of [...doc.querySelectorAll('#app *')]) {
    const cs = win.getComputedStyle(node);
    if (cs.overflow === 'visible' || cs.position !== 'absolute') continue;
    const m = /^matrix\(1, 0, 0, 1, (-?[\d.]+), (-?[\d.]+)\)$/.exec(cs.transform);
    if (!m) continue;
    node.style.left = `${parseFloat(cs.left) + Number(m[1])}px`;
    node.style.top = `${parseFloat(cs.top) + Number(m[2])}px`;
    node.style.transform = 'none';
  }
  for (const im of [...doc.querySelectorAll('#app img')]) {
    const cs = win.getComputedStyle(im);
    const fit = cs.objectFit;
    if (fit !== 'cover' && fit !== 'contain') continue;
    const d = doc.createElement('div');
    d.className = im.className;
    d.setAttribute('style', im.getAttribute('style') || '');
    d.style.backgroundImage = `url("${im.currentSrc || im.src}")`;
    d.style.backgroundSize = fit;
    d.style.backgroundPosition = cs.objectPosition;
    d.style.backgroundRepeat = 'no-repeat';
    if (cs.position === 'static') d.style.display = 'block';
    if (!d.style.width && cs.width) d.style.width = cs.width;
    if (!d.style.height && cs.height) d.style.height = cs.height;
    im.replaceWith(d);
  }
}

// 截 #app（除錯介面不入鏡）
async function capture(app, root) {
  const h2c = await loadHtml2canvas();
  const w = app.getBoundingClientRect().width || app.clientWidth;
  const canvas = await h2c(app, {
    scale: shotScale(w, window.devicePixelRatio || 1),
    backgroundColor: '#1a1612',
    logging: false,
    useCORS: true,
    ignoreElements: (node) => node === root,
    onclone: fixClone,
  });
  return toJpeg(canvas);
}

function device() {
  return deviceSummary({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    screenW: screen.width,
    screenH: screen.height,
    viewW: innerWidth,
    viewH: innerHeight,
    dpr: devicePixelRatio,
  });
}

function storage() {
  try { return localStorage; } catch { return null; }
}

// 剪貼簿：navigator.clipboard 不能用（非 https、權限）就退回 textarea + execCommand
// 最新 commit（GitHub 公開 API，不用登入；每小時 60 次上限）；查不到回 ''
async function latestCommit() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(LATEST_API, { cache: 'no-store', signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
    clearTimeout(t);
    return res.ok ? shaOf(await res.json()) : '';
  } catch {
    return '';
  }
}

// 清 Cache Storage 與 service worker（這個遊戲目前沒用，有的話才清）
async function clearCaches() {
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch { /* 沒有就算了 */ }
  try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch { /* 沒有就算了 */ }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* 退回舊方法 */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/**
 * hooks：{ app, getState(), beat(), jump(act, line) → boolean, setTimeScale(k) }
 */
export function start(hooks) {
  const { app } = hooks;
  const store = storage();
  const readOwner = () => { try { return store?.getItem(OWNER_KEY) || ''; } catch { return ''; } };
  const deps = () => ({ owner: readOwner(), endpoint: REPORT_ENDPOINT, key: REPORT_KEY, fetch: window.fetch.bind(window), storage: store, online: navigator.onLine !== false });

  const style = el('style');
  style.dataset.dbg = '';
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = el('div', 'dbg-root');
  const fab = btn('DBG', 'dbg-fab');
  fab.setAttribute('aria-label', '除錯面板');
  const badge = el('span', 'dbg-badge');
  badge.hidden = true;
  fab.appendChild(badge);
  root.appendChild(fab);
  // 回報鈕：和除錯面板分開，一按就截圖、跳出回報框（打字、送出，三步）
  const repFab = btn('回報', 'dbg-rep');
  repFab.setAttribute('aria-label', '回報問題');
  root.appendChild(repFab);
  app.appendChild(root);

  // 面板上的操作不穿到遊戲：指標、觸控、點擊在 root 擋掉冒泡；按鍵在 window 捕獲階段擋（閱讀框的 Enter／Space 掛在 window 上）
  for (const type of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'contextmenu']) {
    root.addEventListener(type, (e) => e.stopPropagation());
  }
  // 面板開著時，焦點不在面板上（例如落在 body）的按鍵也擋掉：不會在背後翻句；Esc 關面板
  const blockKey = (e) => {
    if (!sheet && !root.contains(e.target)) return;
    e.stopPropagation();
    if (sheet && e.type === 'keydown' && e.key === 'Escape') { e.preventDefault(); close(); }
  };
  addEventListener('keydown', blockKey, { capture: true });
  addEventListener('keyup', blockKey, { capture: true });

  /* ---------- 快轉 ---------- */
  let fast = false;
  let rateRaf = 0;
  // 把 #app 裡正在跑的 CSS 動畫／轉場改成快轉倍率（新出現的下一格就補上，含還在延遲中的）
  const syncRates = () => {
    const rate = fast ? FAST_RATE : 1;
    for (const a of document.getAnimations?.() || []) {
      const t = a.effect?.target;
      if (t && app.contains(t) && !root.contains(t) && a.playbackRate !== rate) a.playbackRate = rate;
    }
  };
  const rateLoop = () => { syncRates(); rateRaf = fast ? requestAnimationFrame(rateLoop) : 0; };
  function setFast(on) {
    fast = !!on;
    hooks.setTimeScale?.(fast ? 1 / FAST_RATE : 1);
    app.classList.toggle('dbg-fast', fast);
    app.style.setProperty('--dbg-time-scale', String(fast ? 1 / FAST_RATE : 1));
    fab.classList.toggle('dbg-fast', fast);
    fab.firstChild.textContent = fast ? `×${FAST_RATE}` : 'DBG';
    try { store?.setItem(FAST_KEY, fast ? '1' : '0'); } catch { /* 存不了就算了 */ }
    cancelAnimationFrame(rateRaf);
    rateRaf = 0;
    if (fast) rateLoop();
    else syncRates();
    renderFast?.();
  }

  /* ---------- 佇列 ---------- */
  let flushing = false;
  const refreshBadge = () => {
    const n = readQueue(store).length;
    badge.hidden = !n;
    badge.textContent = String(n);
    renderQueue?.();
    return n;
  };
  async function retry() {
    if (flushing) return null;
    flushing = true;
    try { return await flush(deps()); } finally { flushing = false; refreshBadge(); }
  }

  /* ---------- 面板 ---------- */
  let sheet = null;
  let renderFast = null;
  let renderQueue = null;
  const close = () => {
    sheet?.remove();
    sheet = null;
    renderFast = null;
    renderQueue = null;
    fab.hidden = false;
    repFab.hidden = false;
    fab.focus?.();
  };

  function openMenu() {
    close();
    fab.hidden = true;
    repFab.hidden = true;
    sheet = el('div', 'dbg-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', '除錯面板');
    const x = btn('關閉', 'dbg-close');
    x.onclick = close;
    sheet.appendChild(x);

    const s = hooks.getState();
    const msg = el('p', 'dbg-msg');

    // 目前位置
    sheet.appendChild(el('h3', '', '目前位置'));
    sheet.appendChild(el('p', 'dbg-info', `${s?.opening?.act}　${actLabel(s?.opening?.act)}　第 ${s?.opening?.line} 句\n版本 ${currentVersion(location.href, BUILD)}`));

    // 跳關
    sheet.appendChild(el('h3', '', '跳到'));
    const sel = el('select', 'dbg-grow');
    sel.setAttribute('aria-label', '幕');
    for (const g of jumpGroups()) {
      const og = el('optgroup');
      og.label = g.name;
      for (const it of g.items) {
        const o = el('option', '', `${it.label}（${it.lines} 句）`);
        o.value = it.act;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    sel.value = s?.opening?.act || 'office';
    const line = el('input', 'dbg-line');
    line.type = 'number';
    line.min = '0';
    line.value = '0';
    line.inputMode = 'numeric';
    line.setAttribute('aria-label', '第幾句（0 起算）');
    const go = btn('跳', 'dbg-primary');
    const r1 = el('div', 'dbg-row');
    r1.append(sel);
    const r2 = el('div', 'dbg-row');
    r2.append(el('span', '', '第'), line, el('span', '', '句（0 起算）'), go);
    r2.style.marginTop = '8px';
    sheet.append(r1, r2, el('p', 'dbg-hint', '跳關會覆蓋這台裝置的存檔；岔路、存摺選擇自動補上，停在關卡那一句要重做。'));
    go.onclick = () => {
      const ok = hooks.jump(sel.value, Number(line.value) || 0);
      if (ok) close();
      else { msg.className = 'dbg-msg dbg-err'; msg.textContent = '跳不過去（幕名不對）'; }
    };

    // 快轉
    sheet.appendChild(el('h3', '', '速度'));
    const fastBtn = btn('');
    fastBtn.onclick = () => setFast(!fast);
    renderFast = () => { fastBtn.textContent = fast ? `快轉中（×${FAST_RATE}）：點一下恢復正常` : `正常速度：點一下快轉 ×${FAST_RATE}`; };
    renderFast();
    sheet.appendChild(fastBtn);

    // 回報
    sheet.appendChild(el('h3', '', '回報問題'));
    const rep = btn('回報這一句（含截圖）', 'dbg-primary dbg-rep-in');
    rep.onclick = () => openReport();
    sheet.appendChild(rep);

    // 佇列
    sheet.appendChild(el('h3', '', '還沒送出的回報'));
    const qInfo = el('p', 'dbg-info');
    const resend = btn('重送');
    const copy = btn('複製全部（JSON）');
    const r3 = el('div', 'dbg-row');
    r3.append(resend, copy);
    sheet.append(qInfo, r3);
    renderQueue = () => {
      const n = readQueue(store).length;
      qInfo.textContent = `${n} 筆${REPORT_ENDPOINT ? '' : '（還沒設定回報網址，只會存在這台裝置）'}${navigator.onLine === false ? '｜目前離線' : ''}`;
      resend.disabled = !n || !REPORT_ENDPOINT;
      copy.disabled = !n;
    };
    renderQueue();
    resend.onclick = async () => {
      msg.className = 'dbg-msg';
      msg.textContent = '重送中…';
      const r = await retry();
      msg.textContent = r ? `送出 ${r.sent} 筆，剩 ${r.left} 筆` : '正在重送，請稍候';
    };
    copy.onclick = async () => {
      const ok = await copyText(exportText(readQueue(store)));
      msg.className = ok ? 'dbg-msg' : 'dbg-msg dbg-err';
      msg.textContent = ok ? '已複製到剪貼簿' : '複製失敗（瀏覽器不允許）';
    };

    // 本人識別碼：讓收件端分得出是不是本人送的；只顯示有沒有設定，不顯示內容
    sheet.appendChild(el('h3', '', '本人識別碼'));
    const ownStat = el('p', 'dbg-info');
    const renderOwner = () => { ownStat.textContent = readOwner() ? '已設定' : '未設定'; };
    renderOwner();
    const ownIn = el('input', 'dbg-grow');
    ownIn.type = 'password';
    ownIn.autocomplete = 'off';
    ownIn.placeholder = '輸入識別碼';
    ownIn.setAttribute('aria-label', '本人識別碼');
    const ownSave = btn('儲存', 'dbg-primary');
    const ownClear = btn('清除');
    const r5 = el('div', 'dbg-row');
    r5.style.marginTop = '8px';
    r5.append(ownIn, ownSave, ownClear);
    sheet.append(ownStat, r5, el('p', 'dbg-hint', '只存在這台裝置，回報送出時才帶上；不會出現在複製的文字或截圖裡。'));
    ownSave.onclick = () => {
      const v = ownIn.value.trim();
      ownIn.value = '';
      if (!v) return;
      try { store?.setItem(OWNER_KEY, v); } catch { /* 存不了就算了 */ }
      renderOwner();
    };
    ownClear.onclick = () => { ownIn.value = ''; try { store?.removeItem(OWNER_KEY); } catch { /* 沒有就算了 */ } renderOwner(); };

    // 版本與快取：重新載入最新版（換到最新 commit 的網址，所有檔案重抓）、清除存檔重來；都不動還沒送出的回報
    sheet.appendChild(el('h3', '', '版本與重來'));
    const ver = el('p', 'dbg-info', `目前版本 ${currentVersion(location.href, BUILD)}\n最新版本 查詢中…`);
    sheet.appendChild(ver);
    let latestSha = '';
    latestCommit().then((sha) => {
      latestSha = sha;
      if (sheet && ver.isConnected) ver.textContent = `目前版本 ${currentVersion(location.href, BUILD)}\n最新版本 ${sha ? sha.slice(0, 7) : '查不到（還是可以重新載入）'}`;
    });
    const reload = btn('重新載入最新版', 'dbg-primary');
    const wipe = btn('清除存檔重來');
    const r4 = el('div', 'dbg-row');
    r4.append(reload, wipe);
    sheet.append(r4, el('p', 'dbg-hint', '重新載入會清掉這個網頁的快取，換成最新版的檔案；存檔和還沒送出的回報都會留著。清除存檔只刪遊戲進度，回報和測試設定不動。'));
    reload.onclick = async () => {
      reload.disabled = true;
      msg.className = 'dbg-msg';
      msg.textContent = '正在找最新版…';
      const sha = latestSha || await latestCommit();
      await clearCaches();
      location.replace(reloadUrl(location.href, sha));
    };
    wipe.onclick = () => {
      if (!confirm('確定要清除存檔、從頭開始嗎？（還沒送出的回報不會刪）')) return;
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
        for (const k of saveKeysToClear(keys)) localStorage.removeItem(k);
      } catch { /* 存不了就算了 */ }
      location.reload();
    };

    sheet.appendChild(msg);
    root.appendChild(sheet);
    x.focus();
  }

  // 回報表單：先截圖（面板還沒打開時的畫面）、記下目前位置，再開表單讓人寫
  async function openReport() {
    close();
    fab.hidden = true;
    repFab.hidden = true;
    const s = hooks.getState();
    const snap = { state: JSON.parse(JSON.stringify(s)), beat: hooks.beat() }; // 截圖這一刻的位置（寫字的時候遊戲不會動，但保險）
    let shot = '';
    let shotErr = '';
    try { shot = await capture(app, root); } catch (e) { shotErr = String(e?.message || e); }

    sheet = el('div', 'dbg-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', '回報問題');
    const x = btn('取消', 'dbg-close');
    x.onclick = close;
    sheet.appendChild(x);

    const base = { ...snap, nameOf, search: location.search, build: BUILD, device: device() };
    const preview = buildPayload({ ...base, screenshot: shot });
    sheet.appendChild(el('h3', '', '自動帶入'));
    sheet.appendChild(el('p', 'dbg-info',
      `${preview.day}｜${preview.scene}（${actLabel(preview.scene)}）｜第 ${preview.line} 句\n`
      + `${preview.speaker ? `${preview.speaker}：` : ''}${preview.text || '（這一幕沒有台詞）'}\n`
      + `版本 ${preview.version}\n${preview.device}`));
    if (shot) {
      const im = el('img', 'dbg-shot');
      im.src = shot;
      im.alt = '截圖';
      sheet.appendChild(im);
    } else {
      sheet.appendChild(el('p', 'dbg-hint', `沒有截圖${shotErr ? `（${shotErr}）` : '（壓不到 200KB 以內）'}`));
    }

    sheet.appendChild(el('h3', '', '分類（可不選）'));
    const cat = el('select', 'dbg-grow');
    cat.setAttribute('aria-label', '分類');
    { const o = el('option', '', '（不選）'); o.value = ''; cat.appendChild(o); }
    for (const c of CATEGORIES) { const o = el('option', '', c); o.value = c; cat.appendChild(o); }
    sheet.appendChild(cat);

    sheet.appendChild(el('h3', '', '意見'));
    const ta = el('textarea');
    ta.placeholder = '這裡怎麼了、想改成什麼';
    ta.setAttribute('aria-label', '說明');
    ta.maxLength = COMMENT_MAX;
    sheet.appendChild(ta);
    const count = el('p', 'dbg-hint');
    const renderCount = () => { count.textContent = `${ta.value.length}／${COMMENT_MAX} 字`; };
    ta.addEventListener('input', renderCount);
    renderCount();
    sheet.appendChild(count);

    const keep = el('label', 'dbg-row');
    const keepShot = el('input');
    keepShot.type = 'checkbox';
    keepShot.checked = !!shot;
    keepShot.disabled = !shot;
    keep.append(keepShot, el('span', '', '附上截圖'));
    keep.style.marginTop = '8px';
    sheet.appendChild(keep);

    const send = btn('送出', 'dbg-primary');
    const copyOne = btn('複製文字');
    const r = el('div', 'dbg-row');
    r.style.marginTop = '10px';
    r.append(send, copyOne);
    const msg = el('p', 'dbg-msg');
    sheet.append(r, msg);
    root.appendChild(sheet);
    ta.focus();

    copyOne.onclick = async () => {
      const payload = buildPayload({ ...base, now: new Date(), category: cat.value, comment: ta.value, screenshot: '' });
      const ok = await copyText(reportText(payload));
      msg.className = ok ? 'dbg-msg' : 'dbg-msg dbg-err';
      msg.textContent = ok ? '已複製文字，可以直接貼到聊天裡' : '複製失敗（瀏覽器不允許）';
    };

    send.onclick = async () => {
      send.disabled = true;
      msg.className = 'dbg-msg';
      msg.textContent = '送出中…';
      const payload = buildPayload({ ...base, now: new Date(), category: cat.value, comment: ta.value, screenshot: keepShot.checked ? shot : '', owner: readOwner() });
      const res = await submit(payload, deps());
      refreshBadge();
      if (res === 'sent') {
        msg.textContent = '已送出';
        setTimeout(close, 900);
      } else {
        msg.textContent = REPORT_ENDPOINT ? '送不出去，先存在這台裝置，連上網路會自動重送。' : '還沒設定回報網址，先存在這台裝置（面板裡可以複製）。';
        setTimeout(close, 1800);
      }
    };
  }

  fab.onclick = () => openMenu();
  repFab.onclick = () => openReport();

  /* ---------- 開機 ---------- */
  let saved = null;
  try { saved = store?.getItem(FAST_KEY); } catch { saved = null; }
  if (saved === '1') setFast(true);
  refreshBadge();
  retry();
  setInterval(retry, RETRY_MS);
  addEventListener('online', () => { retry(); });
  addEventListener('offline', () => renderQueue?.());

  return { root, setFast, retry };
}
