// 除錯面板（DBG）與回報框（碰 DOM／localStorage／fetch／navigator，只在瀏覽器用）：
// 跳關、快轉、回報問題（截圖＋自動帶入目前位置）、離線佇列、本人識別碼、版本與重來。
// 遊戲相關的東西（位置怎麼算、怎麼跳關、版本怎麼判斷、存檔鍵）一律由 startDebug 的 options 傳進來。
// 樣式用 <style> 注入，class 一律 .dbg- 開頭，不動遊戲的 HTML。
// 面板上的點擊、拖曳、按鍵一律在這裡擋掉，不會穿到遊戲。
import { COMMENT_MAX, CATEGORIES, NO_LINE, SHOT_REV, buildPayload, reportText, deviceSummary, shotErrorText } from './report.js';
import { createQueue, exportText, RETRY_MS } from './queue.js';
import { keysToClear, storageKeys, bustUrl, ownerStore } from './reset.js';
import { splitVersion } from './stamp.js';
import { capture } from './capture.js';

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
.dbg-ver-hash { font-size: 11px; color: #8a7660; }
`;

/** 可以換掉的字（遊戲自己的說法）；沒給就用這裡的預設。 */
export const DEFAULT_TEXT = {
  sceneAria: '場景',
  jumpHint: '跳關會覆蓋這台裝置的存檔。',
  jumpFail: '跳不過去（場景名稱不對）',
  shotLost: '截圖少了部分畫面（瀏覽器不讓讀取）',
};

/**
 * @param {string} tag
 * @param {string} [cls]
 * @param {string | null} [text]
 * @returns {any}
 */
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
/** @param {string} text @param {string} [cls] @returns {HTMLButtonElement} */
const btn = (text, cls = '') => { const b = el('button', cls, text); b.type = 'button'; return b; };

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

/** 清 Cache Storage 與 service worker（有的話才清；PWA／Vite 外掛的 service worker 也會清掉） */
export async function clearCaches() {
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch { /* 沒有就算了 */ }
  try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch { /* 沒有就算了 */ }
}

/**
 * 複製到剪貼簿：navigator.clipboard 不能用（非 https、權限）就退回 textarea + execCommand。
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
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
 * 最新版本的資訊整理成 { id, label }（掛勾可以回字串或物件）。
 * @param {unknown} x
 * @returns {{ id: string, label: string } | null}
 */
function latestInfo(x) {
  if (!x) return null;
  if (typeof x === 'string') return { id: x, label: x };
  const o = /** @type {any} */ (x);
  const id = String(o.id ?? '');
  return id ? { id, label: String(o.label ?? id) } : null;
}

/**
 * 開除錯面板。設定欄位見 core/README.md 與 core/index.d.ts。
 * version.autoPin 回傳 true（正在換頁）時不畫面板，回傳 null。
 * @param {any} options
 * @returns {Promise<{ root: HTMLElement, setFast(on: boolean): void, retry(): Promise<{ sent: number, left: number } | null>, close(): void } | null>}
 */
export async function startDebug(options) {
  const o = options || {};
  const ver = o.version || {};
  if (ver.autoPin && await ver.autoPin()) return null;
  const app = /** @type {HTMLElement} */ (o.app);
  if (!app) throw new Error('startDebug 要給 app（面板掛在哪個元素）');
  if (!o.game) throw new Error('startDebug 要給 game（遊戲代號）');
  const keys = o.storageKeys || {};
  if (!keys.queue || !keys.fast || !keys.owner) throw new Error('startDebug 要給 storageKeys.queue／fast／owner');
  const T = { ...DEFAULT_TEXT, ...(o.text || {}) };
  const FAST_RATE = o.fastRate || 5; // 快轉：等待時間變 1/5，CSS 動畫／轉場 5 倍速
  const cap = o.capture || {};
  if (!cap.html2canvasSrc) throw new Error('startDebug 要給 capture.html2canvasSrc（html2canvas 的網址）');
  const target = cap.root || app;
  const store = o.storage === undefined ? storage() : o.storage;
  const queue = createQueue(keys.queue);
  const owner = ownerStore(store, keys.owner);
  const endpoint = () => String((typeof o.endpoint === 'function' ? o.endpoint() : o.endpoint) || '');
  const deps = () => ({ owner: owner.read(), endpoint: endpoint(), key: o.key, fetch: window.fetch.bind(window), storage: store, online: navigator.onLine !== false });
  const version = () => String(ver.display ? ver.display() : '');
  const note = () => String(ver.note?.() || '');
  /** @param {string} scene */
  const label = (scene) => (o.sceneLabel ? String(o.sceneLabel(scene) ?? '') : '');
  const position = () => ({ ...(o.position?.() || {}) });

  // 面板上的版本：日期時間照常大小，括號部分用小字；合起來的文字和 version() 一模一樣
  function versionNodes() {
    const { time, hash } = ver.parts ? ver.parts() : splitVersion(version());
    return time ? [time, el('small', 'dbg-ver-hash', `（${hash}）`)] : [hash];
  }
  // 填一段 .dbg-info：前面的字＋版本＋後面的字
  /** @param {HTMLElement} p @param {string} before @param {string} [after] */
  function infoWithVersion(p, before, after = '') {
    p.replaceChildren(before, ...versionNodes(), after);
    return p;
  }

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

  // 面板上的操作不穿到遊戲：指標、觸控、點擊在 root 擋掉冒泡；按鍵在 window 捕獲階段擋
  for (const type of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'contextmenu']) {
    root.addEventListener(type, (/** @type {Event} */ e) => e.stopPropagation());
  }
  // 面板開著時，焦點不在面板上（例如落在 body）的按鍵也擋掉：不會在背後操作遊戲；Esc 關面板
  const blockKey = (/** @type {KeyboardEvent} */ e) => {
    if (!sheet && !root.contains(e.target)) return;
    e.stopPropagation();
    if (sheet && e.type === 'keydown' && e.key === 'Escape') { e.preventDefault(); close(); }
  };
  addEventListener('keydown', blockKey, { capture: true });
  addEventListener('keyup', blockKey, { capture: true });

  /* ---------- 快轉 ---------- */
  let fast = false;
  let rateRaf = 0;
  // 把 app 裡正在跑的 CSS 動畫／轉場改成快轉倍率（新出現的下一格就補上，含還在延遲中的）
  const syncRates = () => {
    const rate = fast ? FAST_RATE : 1;
    for (const a of document.getAnimations?.() || []) {
      const t = /** @type {any} */ (a.effect)?.target;
      if (t && app.contains(t) && !root.contains(t) && a.playbackRate !== rate) a.playbackRate = rate;
    }
  };
  const rateLoop = () => { syncRates(); rateRaf = fast ? requestAnimationFrame(rateLoop) : 0; };
  /** @param {boolean} on */
  function setFast(on) {
    fast = !!on;
    o.setTimeScale?.(fast ? 1 / FAST_RATE : 1);
    app.classList.toggle('dbg-fast', fast);
    app.style.setProperty('--dbg-time-scale', String(fast ? 1 / FAST_RATE : 1));
    fab.classList.toggle('dbg-fast', fast);
    /** @type {ChildNode} */ (fab.firstChild).textContent = fast ? `×${FAST_RATE}` : 'DBG';
    try { store?.setItem(keys.fast, fast ? '1' : '0'); } catch { /* 存不了就算了 */ }
    cancelAnimationFrame(rateRaf);
    rateRaf = 0;
    if (fast) rateLoop();
    else syncRates();
    renderFast?.();
  }

  /* ---------- 佇列 ---------- */
  let flushing = false;
  const refreshBadge = () => {
    const n = queue.readQueue(store).length;
    badge.hidden = !n;
    badge.textContent = String(n);
    renderQueue?.();
    return n;
  };
  async function retry() {
    if (flushing) return null;
    flushing = true;
    try { return await queue.flush(deps()); } finally { flushing = false; refreshBadge(); }
  }

  /* ---------- 面板 ---------- */
  /** @type {HTMLElement | null} */
  let sheet = null;
  /** @type {null | (() => void)} */
  let renderFast = null;
  /** @type {null | (() => void)} */
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
    const sh = el('div', 'dbg-sheet');
    sheet = sh;
    sh.setAttribute('role', 'dialog');
    sh.setAttribute('aria-label', '除錯面板');
    const x = btn('關閉', 'dbg-close');
    x.onclick = close;
    sh.appendChild(x);

    const pos = position();
    const msg = el('p', 'dbg-msg');
    const n = note();

    // 目前位置
    sh.appendChild(el('h3', '', '目前位置'));
    sh.appendChild(infoWithVersion(el('p', 'dbg-info'), `${pos.scene}${o.sceneLabel ? `　${label(pos.scene)}` : ''}　第 ${pos.line} 句\n版本 `, `｜截圖程式第 ${SHOT_REV} 版${n ? `\n${n}` : ''}`));

    // 跳關（有給 jumpGroups 與 jump 才有）
    const groups = o.jumpGroups && o.jump ? (o.jumpGroups() || []) : [];
    if (groups.length) {
      sh.appendChild(el('h3', '', '跳到'));
      const sel = el('select', 'dbg-grow');
      sel.setAttribute('aria-label', T.sceneAria);
      let first = '';
      for (const g of groups) {
        const og = el('optgroup');
        og.label = g.name;
        for (const it of g.items || []) {
          const op = el('option', '', it.lines == null ? String(it.label) : `${it.label}（${it.lines} 句）`);
          op.value = String(it.scene);
          if (!first) first = op.value;
          og.appendChild(op);
        }
        sel.appendChild(og);
      }
      sel.value = pos.scene || first;
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
      sh.append(r1, r2, el('p', 'dbg-hint', T.jumpHint));
      go.onclick = async () => {
        const ok = await o.jump(sel.value, Number(line.value) || 0);
        if (ok) close();
        else { msg.className = 'dbg-msg dbg-err'; msg.textContent = T.jumpFail; }
      };
    }

    // 快轉
    sh.appendChild(el('h3', '', '速度'));
    const fastBtn = btn('');
    fastBtn.onclick = () => setFast(!fast);
    renderFast = () => { fastBtn.textContent = fast ? `快轉中（×${FAST_RATE}）：點一下恢復正常` : `正常速度：點一下快轉 ×${FAST_RATE}`; };
    renderFast();
    sh.appendChild(fastBtn);

    // 回報
    sh.appendChild(el('h3', '', '回報問題'));
    const rep = btn('回報這一句（含截圖）', 'dbg-primary dbg-rep-in');
    rep.onclick = () => openReport();
    sh.appendChild(rep);

    // 佇列
    sh.appendChild(el('h3', '', '還沒送出的回報'));
    const qInfo = el('p', 'dbg-info');
    const resend = btn('重送');
    const copy = btn('複製全部（JSON）');
    const r3 = el('div', 'dbg-row');
    r3.append(resend, copy);
    sh.append(qInfo, r3);
    renderQueue = () => {
      const cnt = queue.readQueue(store).length;
      qInfo.textContent = `${cnt} 筆${endpoint() ? '' : '（還沒設定回報網址，只會存在這台裝置）'}${navigator.onLine === false ? '｜目前離線' : ''}`;
      resend.disabled = !cnt || !endpoint();
      copy.disabled = !cnt;
    };
    renderQueue();
    resend.onclick = async () => {
      msg.className = 'dbg-msg';
      msg.textContent = '重送中…';
      const r = await retry();
      msg.textContent = r ? `送出 ${r.sent} 筆，剩 ${r.left} 筆` : '正在重送，請稍候';
    };
    copy.onclick = async () => {
      const ok = await copyText(exportText(queue.readQueue(store)));
      msg.className = ok ? 'dbg-msg' : 'dbg-msg dbg-err';
      msg.textContent = ok ? '已複製到剪貼簿' : '複製失敗（瀏覽器不允許）';
    };

    // 本人識別碼：讓收件端分得出是不是本人送的；只顯示有沒有設定，不顯示內容
    sh.appendChild(el('h3', '', '本人識別碼'));
    const ownStat = el('p', 'dbg-info');
    const renderOwner = () => { ownStat.textContent = owner.read() ? '已設定' : '未設定'; };
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
    sh.append(ownStat, r5, el('p', 'dbg-hint', '只存在這台裝置，回報送出時才帶上；不會出現在複製的文字或截圖裡。'));
    ownSave.onclick = () => {
      const v = ownIn.value;
      ownIn.value = '';
      if (!owner.write(v)) return;
      renderOwner();
    };
    ownClear.onclick = () => { ownIn.value = ''; owner.clear(); renderOwner(); };

    // 版本與快取：重新載入最新版（清快取、換到最新版的網址）、清除存檔重來；都不動還沒送出的回報
    sh.appendChild(el('h3', '', '版本與重來'));
    const verInfo = ver.latest ? infoWithVersion(el('p', 'dbg-info'), '目前版本 ', '\n最新版本 查詢中…') : infoWithVersion(el('p', 'dbg-info'), '目前版本 ');
    sh.appendChild(verInfo);
    /** @type {{ id: string, label: string } | null} */
    let latest = null;
    const askLatest = async () => { try { return latestInfo(await ver.latest()); } catch { return null; } };
    if (ver.latest) {
      askLatest().then((v) => {
        latest = v;
        if (sheet === sh && verInfo.isConnected) infoWithVersion(verInfo, '目前版本 ', `\n最新版本 ${v ? v.label : '查不到（還是可以重新載入）'}`);
      });
    }
    const reload = btn('重新載入最新版', 'dbg-primary');
    const wipe = btn('清除存檔重來');
    const r4 = el('div', 'dbg-row');
    r4.append(reload, wipe);
    sh.append(r4, el('p', 'dbg-hint', '重新載入會清掉這個網頁的快取，換成最新版的檔案；存檔和還沒送出的回報都會留著。清除存檔只刪遊戲進度，回報和測試設定不動。'));
    reload.onclick = async () => {
      reload.disabled = true;
      msg.className = 'dbg-msg';
      msg.textContent = '正在找最新版…';
      const v = latest || (ver.latest ? await askLatest() : null);
      await clearCaches();
      location.replace(ver.reloadUrl ? ver.reloadUrl(v) : bustUrl(location.href));
    };
    wipe.onclick = () => {
      if (!confirm('確定要清除存檔、從頭開始嗎？（還沒送出的回報不會刪）')) return;
      try {
        const rule = { isGameSaveKey: o.isGameSaveKey || (() => false), keepKeys: [keys.queue, keys.fast, keys.owner, ...(o.keepKeys || [])], keepPrefixes: o.keepPrefixes || [] };
        for (const k of keysToClear(storageKeys(store), rule)) store?.removeItem(k);
      } catch { /* 存不了就算了 */ }
      location.reload();
    };

    sh.appendChild(msg);
    root.appendChild(sh);
    x.focus();
  }

  // 回報表單：先截圖（面板還沒打開時的畫面）、記下目前位置，再開表單讓人寫
  async function openReport() {
    close();
    fab.hidden = true;
    repFab.hidden = true;
    const pos = position(); // 截圖這一刻的位置
    const lbl = label(pos.scene);
    let shot = '';
    let shotErr = '';
    let captureNote = ''; // 這次截圖少了什麼
    try {
      ({ url: shot, note: captureNote } = await capture({
        target, debugRoot: root, html2canvasSrc: cap.html2canvasSrc, assetUrl: cap.assetUrl, background: cap.background,
        ignore: cap.ignore, snapshot: cap.snapshot, snapshotMode: cap.snapshotMode, snapshotElement: cap.snapshotElement, lostNote: T.shotLost,
        text: { position: pos, label: lbl, version: version() },
      }));
    } catch (e) { shotErr = String(/** @type {any} */ (e)?.message || e); }

    const sh = el('div', 'dbg-sheet');
    sheet = sh;
    sh.setAttribute('role', 'dialog');
    sh.setAttribute('aria-label', '回報問題');
    const x = btn('取消', 'dbg-close');
    x.onclick = close;
    sh.appendChild(x);

    const base = { position: pos, game: o.game, device: device() };
    const preview = buildPayload({ ...base, version: version(), screenshot: shot });
    const n = note();
    sh.appendChild(el('h3', '', '自動帶入'));
    // 送出的 version（純文字）＝ version()；畫面上括號部分用小字
    sh.appendChild(infoWithVersion(el('p', 'dbg-info'),
      `${preview.day}｜${preview.scene}${o.sceneLabel ? `（${lbl}）` : ''}｜第 ${preview.line} 句\n`
      + `${preview.speaker ? `${preview.speaker}：` : ''}${preview.text || NO_LINE}\n版本 `,
      `｜截圖程式第 ${SHOT_REV} 版${n ? `｜${n}` : ''}\n${preview.device}`));
    if (shot && captureNote) sh.appendChild(el('p', 'dbg-hint', captureNote));
    if (shot) {
      const im = el('img', 'dbg-shot');
      im.src = shot;
      im.alt = '截圖';
      sh.appendChild(im);
    } else {
      sh.appendChild(el('p', 'dbg-hint', `沒有截圖（${shotErr || shotErrorText([])}）`));
    }

    sh.appendChild(el('h3', '', '分類（可不選）'));
    const cat = el('select', 'dbg-grow');
    cat.setAttribute('aria-label', '分類');
    { const op = el('option', '', '（不選）'); op.value = ''; cat.appendChild(op); }
    for (const c of CATEGORIES) { const op = el('option', '', c); op.value = c; cat.appendChild(op); }
    sh.appendChild(cat);

    sh.appendChild(el('h3', '', '意見'));
    const ta = el('textarea');
    ta.placeholder = '這裡怎麼了、想改成什麼';
    ta.setAttribute('aria-label', '說明');
    ta.maxLength = COMMENT_MAX;
    sh.appendChild(ta);
    const count = el('p', 'dbg-hint');
    const renderCount = () => { count.textContent = `${ta.value.length}／${COMMENT_MAX} 字`; };
    ta.addEventListener('input', renderCount);
    renderCount();
    sh.appendChild(count);

    const keep = el('label', 'dbg-row');
    const keepShot = el('input');
    keepShot.type = 'checkbox';
    keepShot.checked = !!shot;
    keepShot.disabled = !shot;
    keep.append(keepShot, el('span', '', '附上截圖'));
    keep.style.marginTop = '8px';
    sh.appendChild(keep);

    const send = btn('送出', 'dbg-primary');
    const copyOne = btn('複製文字');
    const r = el('div', 'dbg-row');
    r.style.marginTop = '10px';
    r.append(send, copyOne);
    const msg = el('p', 'dbg-msg');
    sh.append(r, msg);
    root.appendChild(sh);
    ta.focus();

    copyOne.onclick = async () => {
      const payload = buildPayload({ ...base, version: version(), now: new Date(), category: cat.value, comment: ta.value, screenshot: '' });
      const ok = await copyText(reportText(payload));
      msg.className = ok ? 'dbg-msg' : 'dbg-msg dbg-err';
      msg.textContent = ok ? '已複製文字，可以直接貼到聊天裡' : '複製失敗（瀏覽器不允許）';
    };

    send.onclick = async () => {
      send.disabled = true;
      msg.className = 'dbg-msg';
      msg.textContent = '送出中…';
      const payload = buildPayload({ ...base, version: version(), now: new Date(), category: cat.value, comment: ta.value, screenshot: keepShot.checked ? shot : '', owner: owner.read() });
      const res = await queue.submit(payload, deps());
      refreshBadge();
      if (res === 'sent') {
        msg.textContent = '已送出';
        setTimeout(close, 900);
      } else {
        msg.textContent = endpoint() ? '送不出去，先存在這台裝置，連上網路會自動重送。' : '還沒設定回報網址，先存在這台裝置（面板裡可以複製）。';
        setTimeout(close, 1800);
      }
    };
  }

  fab.onclick = () => openMenu();
  repFab.onclick = () => openReport();

  /* ---------- 開機 ---------- */
  let saved = null;
  try { saved = store?.getItem(keys.fast); } catch { saved = null; }
  if (saved === '1') setFast(true);
  refreshBadge();
  retry();
  setInterval(retry, o.retryMs || RETRY_MS);
  addEventListener('online', () => { retry(); });
  addEventListener('offline', () => renderQueue?.());

  return { root, setFast, retry, close };
}
