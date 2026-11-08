// 入口：串起一天的循環（開店前佈置 → 營業 → 打烊看日誌 → 調整），以及序章的開場四幕。
// 邏輯在 grid／sim／menu／chapters／journal；畫面在 view/。
import {
  CORNERS, DECOR, W, H, placeProblem, validate, remaining, size, seatCells, BAR_ITEM, REASONS, cornersOf, footprint,
  bestPlacementAt, placeableCells, playerCorners, pieceCells,
} from './grid.js';
import { simulateDay, catSpot, GUESTS, ACTIONS, beatsDeshu } from './sim.js';
import { signatureRecipe, signatureIsPlayers } from './menu.js';
import { CHAPTERS, LAST_CHAPTER, START_TEMP, chapter, unlocks, goalDone } from './chapters.js';
import { buildJournal } from './journal.js';
import { newSave, loadSave, writeSave, clearSave } from './save.js';
import { runOpening } from './opening.js';
import { DESHU_ENTER, FIRST_CUP } from './letters.js';
import { JOURNAL_TITLE, CHAPTER_LINES, HINTS, PROTO_END } from './lines/journal.js';
import { ShopView } from './view/shop3d.js';
import { openSeatView } from './view/seat3d.js';
import { openMenuSheet } from './view/menuSheet.js';
import { say, hideSay, toast, esc } from './view/ui.js';

const $ = (id) => document.getElementById(id);

/* ---------- 開發用捷徑：?ch=1|2 跳章、?speed=16 超快轉、?skipOpening=1 略過開場、?reset=1 清存檔 ---------- */
const params = new URLSearchParams(location.search);
const SPEED = Math.max(0.25, Number(params.get('speed')) || 1);
const JUMP = params.has('ch') ? Math.max(1, Math.min(LAST_CHAPTER, Number(params.get('ch')) || 1)) : null;
if (params.get('reset') === '1') clearSave();

let save;
if (JUMP) {
  save = newSave(JUMP);
} else {
  save = loadSave() || newSave(0);
  if (params.get('skipOpening') === '1' && save.chapter === 0) {
    save.chapter = 1;
    save.temp = START_TEMP;
  }
}

const state = {
  mode: 'setup', // opening | intro | setup | business | journal | seat | ending
  selected: null, // 點選中的角落／擺飾 uid
  spot: null, // 點到的空地 { x, y }：下方列出這裡放得下的整組擺法
  armed: null, // 點了下方角落列的某一張（沒拖）：{ kind, type, cells }，接著點店裡淡綠色的格子就放
  dragging: null,
  validation: validate(save.layout),
  result: null,
  simT: 0,
  rate: 1,
};

const shop = new ShopView($('stage'));
let uidSeq = Date.now() % 100000;
const newUid = (p) => `${p}${(uidSeq++).toString(36)}`;

/* ---------- 版面配置 ---------- */
function fit() {
  const st = $('stage');
  shop.fit(st.clientWidth, st.clientHeight);
  render();
}
window.addEventListener('resize', fit);

/* ---------- 畫面更新 ---------- */
function render() {
  state.validation = validate(save.layout);
  const ch = chapter(save.chapter) || CHAPTERS[1];
  const shown = save.chapter === 0 ? '序章' : `第 ${ch.id} 章　${ch.title}`;
  $('ch-title').textContent = state.mode === 'intro' || state.mode === 'opening' ? '序章' : `${shown}・第 ${save.day} 天`;
  $('temp').textContent = `${save.temp.toFixed(1)}°C`;
  $('thermo-fill').style.height = `${Math.min(100, Math.max(6, (save.temp - 19.5) * 12))}%`;
  $('goal').textContent = save.chapter >= 1 && ch.goal && !save.finished ? `這一章：${ch.goal}` : '';
  const setup = state.mode === 'setup';
  if (!setup) { state.spot = null; state.armed = null; }
  if (state.armed) state.armed.cells = placeableCells(save.layout, state.armed.kind, state.armed.type);
  shop.render({
    layout: save.layout,
    validation: state.validation,
    selected: state.selected,
    spot: state.spot,
    hint: state.armed?.cells,
    dragging: state.dragging,
    mode: ['business', 'intro', 'opening'].includes(state.mode) ? 'business' : 'setup', // 開場裡也不畫格線
    cat: state.mode === 'business' && state.result ? state.result.cat : catSpot(save.layout),
  });
  const picking = !!(state.selected || state.spot);
  $('tray').hidden = !setup || picking;
  $('sel').hidden = !setup || !picking;
  $('speed').hidden = state.mode !== 'business';
  $('actions').hidden = !setup;
  if (setup) {
    renderTray();
    renderSel();
    $('btn-open').disabled = !canOpen();
    $('btn-menu').classList.toggle('ping', unlocks(save.chapter).design && save.menu.slots.every((r) => !r || r.by !== 'player'));
    const [text, bad] = setupStatus();
    status(text, bad);
  }
}

function status(text, bad = false) {
  $('status').textContent = text || '';
  $('status').classList.toggle('bad', bad);
}

// 路要通；第 1 章還要至少擺一組自己的角落（空店開了也一無所獲）
function canOpen() {
  if (!state.validation.ok) return false;
  if (save.chapter === 1 && !playerCorners(save.layout).length) return false;
  return true;
}

function setupStatus() {
  const v = state.validation;
  if (state.armed) {
    const name = state.armed.kind === 'corner' ? CORNERS[state.armed.type].name : DECOR[state.armed.type].name;
    return [state.armed.cells.length ? HINTS.armed.replace('{name}', name) : HINTS.armedNone.replace('{name}', name), !state.armed.cells.length];
  }
  if (!v.barOk) return [HINTS.blockedBar, true];
  if (v.unreachable.length) return [HINTS.blockedCorner, true];
  if (v.stuck.length) return [HINTS.stuck, false];
  if (save.chapter === 1 && !save.layout.items.some((i) => i.kind === 'corner')) return [HINTS.ch1, false];
  if (save.chapter === 2 && !save.menu.slots.some((r) => r?.by === 'player')) return [HINTS.ch2, false];
  if (save.chapter === 2 && signatureIsPlayers(save.menu) && !beatsDeshu(signatureRecipe(save.menu)).length) return [HINTS.sigLikeDeshu, false];
  if (state.spot) return [HINTS.pickHere, false];
  if (save.day <= 2) return [HINTS.pickCorner, false];
  return [HINTS.ready, false];
}

/* ---------- 點店裡的空地：這裡放得下的整組擺法 ---------- */
// 每種還有庫存的角落：找一個蓋住這一格、合法、最好路也通的擺法（轉向、往旁邊挪都試），每個款式一張卡；
// 擺飾只看這一格。放不下的寫原因。
function optionsAt(cell) {
  const u = unlocks(save.chapter);
  const out = [];
  for (const type of u.corners) {
    const c = CORNERS[type];
    if (remaining(save.layout, 'corner', type) <= 0) continue;
    const best = bestPlacementAt(save.layout, 'corner', type, cell);
    if (!best.item) { out.push({ kind: 'corner', type, name: c.name, reason: REASONS[best.reason] || '' }); continue; }
    for (const st of c.styles) {
      out.push({ kind: 'corner', type, name: `${c.name}・${st.name}`, art: st.chair || 'stool', item: { ...best.item, style: st.id } });
    }
  }
  for (const type of u.decor) {
    if (remaining(save.layout, 'decor', type) <= 0) continue;
    const best = bestPlacementAt(save.layout, 'decor', type, cell);
    out.push(best.item ? { kind: 'decor', type, name: DECOR[type].name, art: DECOR[type].art, item: best.item } : { kind: 'decor', type, name: DECOR[type].name, reason: REASONS[best.reason] });
  }
  return out;
}

// 放下一件：角落、擺飾都保持選取（看得到琥珀色佔地與名牌），整組閃一下
function placeNew(item) {
  const uid = newUid(item.kind === 'corner' ? 'c' : 'd');
  save.layout = { items: [...save.layout.items, { ...item, uid }] };
  state.spot = null;
  state.armed = null;
  state.selected = uid;
  shop.flash();
  render();
}

function placeOption(o) {
  placeNew(o.item);
}

/* ---------- 點了下方角落列（沒拖）：準備擺這種，店裡放得下的格子淡淡標出來 ---------- */
function armTray(kind, type) {
  if (state.armed && state.armed.kind === kind && state.armed.type === type) { state.armed = null; render(); return; }
  state.armed = { kind, type, cells: [] };
  state.selected = null;
  state.spot = null;
  render();
  const name = kind === 'corner' ? CORNERS[type].name : DECOR[type].name;
  toast(state.armed?.cells.length ? HINTS.armed.replace('{name}', name) : HINTS.armedNone.replace('{name}', name), 2600);
}

// 準備擺的狀態下點了店裡的一格
function placeArmed(cell) {
  const a = state.armed;
  const best = bestPlacementAt(save.layout, a.kind, a.type, cell);
  if (!best.item) { toast(`這裡放不下：${REASONS[best.reason] || ''}。點淡綠色的格子。`, 2400); return; }
  placeNew(best.item);
}

/* ---------- 下方角落列 ---------- */
const armedIs = (kind, type) => !!state.armed && state.armed.kind === kind && state.armed.type === type;

function renderTray() {
  const u = unlocks(save.chapter);
  const chips = [];
  for (const type of u.corners) {
    const c = CORNERS[type];
    const left = remaining(save.layout, 'corner', type);
    chips.push(`<button type="button" class="chip corner${armedIs('corner', type) ? ' on' : ''}" data-kind="corner" data-type="${type}" ${left <= 0 ? 'disabled' : ''}>
      <img src="./assets/art/${c.styles[0].chair || 'stool'}.webp" alt="" draggable="false"><b>${c.name}</b><small>${c.w}×${c.h}・剩 ${left}</small></button>`);
  }
  for (const type of u.decor) {
    const d = DECOR[type];
    const left = remaining(save.layout, 'decor', type);
    chips.push(`<button type="button" class="chip decor${armedIs('decor', type) ? ' on' : ''}" data-kind="decor" data-type="${type}" ${left <= 0 ? 'disabled' : ''}>
      <img src="./assets/art/${d.art}.webp" alt="" draggable="false"><b>${d.name}</b><small>剩 ${left}</small></button>`);
  }
  $('tray').innerHTML = chips.join('') || '<p class="note">還沒有可以擺的東西。</p>';
  for (const b of $('tray').querySelectorAll('.chip')) {
    b.onpointerdown = (e) => {
      if (b.disabled) return;
      const kind = b.dataset.kind;
      const type = b.dataset.type;
      const item = { kind, type, x: 0, y: 0, rot: 0, style: kind === 'corner' ? CORNERS[type].styles[0].id : undefined };
      const s = size(item);
      startDrag(e, { item, fromUid: null, grab: { dx: s.w / 2, dy: s.h / 2 }, label: kind === 'corner' ? CORNERS[type].name : DECOR[type].name });
    };
  }
}

/* ---------- 點一下已放的東西：轉向、換款式、坐下來、收起 ---------- */
function renderSel() {
  if (state.spot) { renderSpot(); return; }
  const it = findItem(state.selected);
  if (!it) { $('sel').innerHTML = ''; return; }
  const name = it.kind === 'corner' ? CORNERS[it.type].name : DECOR[it.type].name;
  let styles = '';
  if (it.kind === 'corner' && !it.fixed && CORNERS[it.type].styles.length > 1) {
    // 款式：整組換掉（佔地不變），點了店裡馬上換；跟名字擠在同一列，店面才不會被壓矮
    styles = CORNERS[it.type].styles.map((s) => `<button type="button" class="opt mini ${s.id === it.style ? 'on' : ''}" data-style="${s.id}">
      <img src="./assets/art/${s.chair || 'stool'}.webp" alt="" draggable="false"><b>${esc(s.name)}</b></button>`).join('');
  }
  let btns = '';
  if (it.kind === 'corner' && !it.fixed) btns += '<button type="button" data-a="rot">轉 90°</button>';
  if (it.kind === 'corner') btns += '<button type="button" data-a="sit">坐下來看看</button>';
  if (!it.fixed) btns += '<button type="button" data-a="stow">收起</button>';
  btns += '<button type="button" data-a="done" class="primary">好</button>';
  $('sel').innerHTML = `<div class="sel-head"><b class="sel-name">${esc(name)}</b>${styles}</div><div class="sel-btns">${btns}</div>`;
  for (const b of $('sel').querySelectorAll('[data-a]')) b.onclick = () => selAction(b.dataset.a, it);
  for (const b of $('sel').querySelectorAll('[data-style]')) b.onclick = () => { replaceItem({ ...it, style: b.dataset.style }); render(); };
}

function renderSpot() {
  const opts = optionsAt(state.spot);
  const can = opts.filter((o) => o.item);
  const cant = opts.filter((o) => !o.item);
  const cards = can.map((o, i) => `<button type="button" class="opt" data-o="${i}">
    <img src="./assets/art/${o.art}.webp" alt="" draggable="false"><b>${esc(o.name)}</b></button>`).join('');
  const why = cant.length ? `<p class="note">${cant.map((o) => `${esc(o.name)}：${esc(o.reason)}`).join('　')}</p>` : '';
  $('sel').innerHTML = `<div class="opt-row scroll">${cards || '<p class="note">這一格放不下東西。</p>'}</div>${why}
    <div class="sel-btns"><button type="button" data-a="cancel">算了</button></div>`;
  for (const b of $('sel').querySelectorAll('[data-o]')) b.onclick = () => placeOption(can[Number(b.dataset.o)]);
  $('sel').querySelector('[data-a="cancel"]').onclick = () => { state.spot = null; render(); };
}

function findItem(uid) {
  if (!uid) return null;
  if (uid === 'bar') return BAR_ITEM;
  return save.layout.items.find((i) => i.uid === uid) || null;
}

function replaceItem(next) {
  save.layout = { items: save.layout.items.map((i) => (i.uid === next.uid ? next : i)) };
}

function selAction(a, it) {
  if (a === 'done') { state.selected = null; render(); return; }
  if (a === 'stow') {
    save.layout = { items: save.layout.items.filter((i) => i.uid !== it.uid) };
    state.selected = null;
    render();
    return;
  }
  if (a === 'style') {
    const styles = CORNERS[it.type].styles;
    const i = styles.findIndex((s) => s.id === it.style);
    replaceItem({ ...it, style: styles[(i + 1) % styles.length].id });
    render();
    return;
  }
  if (a === 'rot') {
    // 原地轉不過去，就試著往旁邊挪一兩格
    const rot = ((it.rot || 0) + 1) % 4;
    let firstReason = null;
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1], [1, 1], [-1, 1], [1, -1], [-2, 0], [0, -2]]) {
      const cand = { ...it, rot, x: it.x + dx, y: it.y + dy };
      const p = placeProblem(save.layout, cand);
      if (!p) {
        replaceItem(cand);
        shop.flash();
        render();
        toast(dx || dy ? '已轉向（往旁邊挪了一點才轉得過去）' : '已轉向', 1600);
        return;
      }
      firstReason ||= p;
    }
    toast(`轉不過去：${REASONS[firstReason] || '旁邊太擠'}。先拖到空一點的地方再轉。`, 2600);
    return;
  }
  if (a === 'sit') sitDown(it, 0);
}

/* ---------- 拖放 ---------- */
let drag = null;
function startDrag(e, src) {
  e.preventDefault();
  drag = { ...src, x0: e.clientX, y0: e.clientY, moved: false, pointerType: e.pointerType, cand: null, ok: false };
  const fl = $('drag-chip');
  fl.textContent = src.label;
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragCancel);
}

function onDragMove(e) {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
  drag.moved = true;
  const lift = drag.pointerType === 'touch' && !drag.fromUid ? 0.9 : 0; // 從角落列拖出來時手指會擋住：影子往上提一點
  const p = shop.pointToCell(e.clientX, e.clientY);
  const fl = $('drag-chip');
  if (drag.fromUid && state.dragging !== drag.fromUid) { state.dragging = drag.fromUid; state.selected = null; render(); }
  if (!p) {
    drag.cand = null;
    shop.hideGhost();
    fl.hidden = false;
    fl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    status(drag.fromUid ? '放開就收起來。' : '拖到店裡。');
    return;
  }
  fl.hidden = true;
  const cand = { ...drag.item, x: Math.round(p.fx - drag.grab.dx), y: Math.round(p.fy - lift - drag.grab.dy) };
  const problem = placeProblem(save.layout, { ...cand, uid: drag.fromUid || '__new' }, drag.fromUid || '__new');
  drag.cand = cand;
  drag.ok = !problem;
  shop.showGhost(cand, !problem);
  if (problem) status(`放不下：${REASONS[problem]}`, true);
  else status('放開就放在這裡。');
}

function endDragListeners() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragCancel);
  $('drag-chip').hidden = true;
  state.dragging = null;
  shop.hideGhost();
}

function onDragCancel() {
  endDragListeners();
  drag = null;
  render();
}

function onDragEnd(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  endDragListeners();
  if (!d.moved) {
    // 點一下：選取已放的東西；點下方角落列的卡片＝準備擺這種（店裡放得下的格子標出來）
    if (d.fromUid) { state.selected = d.fromUid; state.spot = null; state.armed = null; render(); } else armTray(d.item.kind, d.item.type);
    return;
  }
  const inside = !!shop.pointToCell(e.clientX, e.clientY);
  if (inside && d.cand && d.ok) {
    if (d.fromUid) {
      replaceItem({ ...d.item, ...d.cand, uid: d.fromUid });
      state.selected = d.fromUid; // 搬完保持選取，看得到搬到哪
      shop.flash();
    } else {
      placeNew(d.cand);
      return;
    }
  } else if (!inside && d.fromUid) {
    save.layout = { items: save.layout.items.filter((i) => i.uid !== d.fromUid) }; // 拖回下方就收起來
    if (state.selected === d.fromUid) state.selected = null;
  } else if (inside && d.cand && !d.ok) {
    toast('放不下，那裡不行。');
  }
  render();
}

// 在店面上按下：點已放的東西選它（也可以拖著搬）；點空地列出這裡放得下的整組擺法
$('stage').addEventListener('pointerdown', (e) => {
  if (e.target.closest('.guest')) return; // 營業中點客人：交給客人自己的按鈕
  const hit = shop.pick(e.clientX, e.clientY, save.layout);
  if (state.mode === 'intro') {
    // 「先坐。」：點吧台那一帶（吧台、高腳椅、吧台前）都算
    if (introSit && hit?.cell && hit.cell.x >= 3 && hit.cell.y <= 3) introSit();
    else if (introSit && hit?.uid === 'bar') introSit();
    return;
  }
  if (state.mode !== 'setup' || !hit) return;
  if (hit.uid === 'bar') { state.selected = 'bar'; state.spot = null; state.armed = null; render(); return; }
  const it = hit.uid ? findItem(hit.uid) : null;
  if (!it) {
    if (!hit.cell) return;
    // 空地：放開時沒有拖動才算點
    const x0 = e.clientX;
    const y0 = e.clientY;
    const up = (ev) => {
      window.removeEventListener('pointerup', up);
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) return;
      if (state.armed) { placeArmed(hit.cell); return; }
      state.selected = null;
      state.spot = state.spot && state.spot.x === hit.cell.x && state.spot.y === hit.cell.y ? null : hit.cell;
      render();
    };
    window.addEventListener('pointerup', up);
    return;
  }
  const p = shop.pointToCell(e.clientX, e.clientY, true) || { fx: it.x + 0.5, fy: it.y + 0.5 };
  const s = size(it);
  startDrag(e, {
    item: { ...it }, fromUid: it.uid,
    grab: { dx: Math.min(s.w - 0.01, Math.max(0, p.fx - it.x)), dy: Math.min(s.h - 0.01, Math.max(0, p.fy - it.y)) },
    label: it.kind === 'corner' ? CORNERS[it.type].name : DECOR[it.type].name,
  });
});

/* ---------- 坐下來看看 ---------- */
function sitDown(item, seatIndex, opts = {}) {
  const prev = state.mode;
  state.mode = 'seat';
  const countSit = (i) => { const k = `${item.uid}:${i}`; save.sat[k] = (save.sat[k] || 0) + 1; };
  countSit(seatIndex);
  const ctl = openSeatView($('seat'), {
    layout: save.layout, item, seatIndex, cat: catSpot(save.layout),
    onClose: () => {
      state.mode = opts.returnMode || (prev === 'seat' ? 'setup' : prev);
      opts.onClose?.();
      render();
    },
  });
  ctl.onSeat = countSit;
  return ctl;
}

/* ---------- 菜單 ---------- */
$('btn-menu').onclick = () => {
  openMenuSheet($('sheet'), {
    getMenu: () => save.menu,
    setMenu: (m) => { save.menu = m; },
    canDesign: unlocks(save.chapter).design,
    onClose: render,
  });
};

/* ---------- 營業 ---------- */
$('btn-open').onclick = () => {
  if (!state.validation.ok) { toast('路不通，不能開店。'); return; }
  if (!canOpen()) { toast(HINTS.ch1); return; }
  startBusiness();
};

function startBusiness() {
  hideSay();
  state.selected = null;
  state.mode = 'business';
  state.result = simulateDay({ layout: save.layout, menu: save.menu, day: save.day });
  state.simT = 0;
  shop.clearGuests();
  setRate(state.rate);
  render();
  status('營業中。點客人看他點了什麼。');
  let last = performance.now();
  const tick = (now) => {
    if (state.mode !== 'business') return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    state.simT += dt * state.rate * SPEED;
    const r = state.result;
    shop.renderGuests(r.guests, state.simT, tapGuest);
    const k = Math.min(1, state.simT / r.dayLen);
    $('clock').textContent = clockText(k);
    $('progress').style.width = `${k * 100}%`;
    if (state.simT >= r.dayLen) { endDay(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const clockText = (k) => {
  const m = Math.round(10 * 60 + k * 8 * 60); // 10:00 開門，18:00 打烊
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

function setRate(r) {
  state.rate = r;
  for (const b of $('speed').querySelectorAll('[data-rate]')) b.classList.toggle('on', Number(b.dataset.rate) === r);
}
for (const b of document.querySelectorAll('#speed [data-rate]')) b.onclick = () => setRate(Number(b.dataset.rate));
$('btn-skipday').onclick = () => { if (state.mode === 'business') state.simT = state.result.dayLen; };

function tapGuest(g) {
  const sig = g.signature ? '（招牌）' : '';
  const act = ACTIONS[g.action]?.text || '';
  toast(`${GUESTS[g.type].name}：點了「${g.orderName || '水'}」${sig}${act ? `，${act}` : ''}`, 2600);
}

/* ---------- 打烊：德叔的營業日誌 ---------- */
function endDay() {
  const r = state.result;
  const ch = save.chapter;
  const ctx = { layout: save.layout, validation: state.validation, result: r, menu: save.menu };
  const met = goalDone(ch, ctx);
  const lines = buildJournal({ day: save.day, chapter: ch, layout: save.layout, menu: save.menu, result: r, goalMet: met });
  const day = save.day;
  const before = save.temp;
  save.day += 1;
  if (met) {
    save.temp = Math.max(save.temp, chapter(ch).temp);
    if (ch >= LAST_CHAPTER) save.finished = true;
    else save.chapter = ch + 1;
  }
  save.lastJournal = { day, lines };
  writeSave(save); // 每天結算後存一次
  shop.clearGuests();
  state.mode = 'journal';
  render();
  showJournal({ day, lines, met, ch, before, after: save.temp });
}

function showJournal({ day, lines, met, ch, before, after }) {
  const el = $('journal');
  el.hidden = false;
  const done = met ? `<div class="jr-goal"><p>第 ${ch} 章「${esc(chapter(ch).title)}」完成</p><div class="jr-thermo"><span class="from">${before.toFixed(1)}°C</span> → <b>${after.toFixed(1)}°C</b></div></div>` : '';
  let buttons;
  if (met && save.finished) buttons = '<button type="button" class="primary" data-j="end">打烊</button>';
  else if (met) buttons = '<button type="button" class="primary" data-j="next">下一章</button>';
  else buttons = '<button type="button" data-j="adjust">調整</button><button type="button" class="primary" data-j="again">開下一天</button>';
  el.innerHTML = `<div class="jr-paper">
    <h2>${JOURNAL_TITLE}</h2><p class="jr-day">第 ${day} 天</p>
    <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    ${done}
    <div class="jr-btns">${buttons}</div></div>`;
  if (met) requestAnimationFrame(() => {
    $('temp').textContent = `${after.toFixed(1)}°C`;
    document.getElementById('thermo').classList.add('rise');
    setTimeout(() => document.getElementById('thermo').classList.remove('rise'), 1600);
  });
  for (const b of el.querySelectorAll('[data-j]')) b.onclick = () => {
    el.hidden = true;
    const a = b.dataset.j;
    if (a === 'end') { showEnding(); return; }
    state.mode = 'setup';
    render();
    if (a === 'again') startBusiness();
    if (a === 'next') chapterIntro();
  };
}

async function chapterIntro() {
  const lines = CHAPTER_LINES[save.chapter];
  if (!lines) return;
  for (const l of lines) {
    if (state.mode !== 'setup') return;
    if (!(await say(l, { ms: 4200, speed: SPEED }))) return;
  }
  hideSay();
}

/* ---------- 雛形片尾 ---------- */
function showEnding() {
  state.mode = 'ending';
  render();
  const el = $('journal');
  el.hidden = false;
  el.innerHTML = `<div class="jr-paper ending">
    <h2>第 2 章完</h2>
    ${PROTO_END.map((l) => `<p>${esc(l)}</p>`).join('')}
    <p class="jr-thermo"><b>${save.temp.toFixed(1)}°C</b></p>
    <div class="jr-btns">
      <button type="button" data-e="look" class="primary">從最常坐的位子看一眼</button>
      <button type="button" data-e="keep">回到店裡</button>
      <button type="button" data-e="restart">重新開始</button>
    </div></div>`;
  el.querySelector('[data-e="look"]').onclick = () => {
    el.hidden = true;
    const [uid, seat] = favoriteSeat();
    sitDown(findItem(uid) || BAR_ITEM, seat, { returnMode: 'ending', onClose: showEnding });
  };
  el.querySelector('[data-e="keep"]').onclick = () => { el.hidden = true; state.mode = 'setup'; render(); };
  el.querySelector('[data-e="restart"]').onclick = restart;
}

// 片尾鏡頭：「坐下來看看」最多次的位子（還在店裡的）
function favoriteSeat() {
  let best = ['bar', 1];
  let n = 0;
  for (const [k, v] of Object.entries(save.sat)) {
    const [uid, i] = k.split(':');
    const it = findItem(uid);
    if (it && v > n && seatCells(it)[Number(i)]) { best = [uid, Number(i)]; n = v; }
  }
  return best;
}

function restart() {
  clearSave();
  location.href = location.pathname;
}
$('btn-more').onclick = () => {
  if (confirm('清掉存檔，從開場重新開始？')) restart();
};

/* ---------- 序章：開場四幕 ---------- */
let introSit = null;
let introToken = 0;

async function playOpening() {
  state.mode = 'opening';
  $('app').classList.add('in-opening');
  render();
  const r = await runOpening({ root: $('opening'), speed: SPEED });
  save.player = { name: r.name || '', resignation: r.resignation || '' };
  $('app').classList.remove('in-opening');
  await shopIntro();
}

// 第三幕後半＋第四幕：推門進店 → 德叔三句 → 「先坐。」→ 第一杯 → 店是空的 → 溫度計 20.5°C
async function shopIntro() {
  const my = ++introToken;
  const alive = () => my === introToken;
  state.mode = 'intro';
  save.temp = 20.0;
  $('intro-skip').hidden = false;
  render();
  status('');
  for (const line of DESHU_ENTER) {
    await say(line, { ms: 4300, speed: SPEED });
    if (!alive()) return;
  }
  // 「先坐。」：點吧台前的高腳椅
  say(FIRST_CUP.sit, { ms: 600000 });
  status(HINTS.sitFirst);
  shop.setPulse('bar');
  render();
  await new Promise((res) => { introSit = res; });
  introSit = null;
  shop.setPulse(null);
  if (!alive()) return;
  hideSay();
  const seat = sitDown(BAR_ITEM, 1, { returnMode: 'intro' });
  seat.hideUp(true);
  await say(FIRST_CUP.brewing, { who: '', ms: 7000, speed: SPEED });
  if (!alive()) return;
  $('seat').insertAdjacentHTML('beforeend', '<img class="s3-cup" src="./assets/art/prop_cup.webp" alt="一杯咖啡">');
  await say(FIRST_CUP.served, { ms: 4800, speed: SPEED });
  if (!alive()) return;
  await say(FIRST_CUP.empty, { ms: 5000, speed: SPEED });
  if (!alive()) return;
  save.temp = START_TEMP;
  render();
  $('thermo').classList.add('rise');
  await say(FIRST_CUP.glance, { who: '', ms: 3800, speed: SPEED });
  if (!alive()) return;
  hideSay();
  seat.setUpLabel('站起來，開始佈置');
  seat.hideUp(false);
  await new Promise((res) => { introSit = null; seatCloseWait = res; });
  if (!alive()) return;
  finishOpening();
}
let seatCloseWait = null;

function finishOpening() {
  introToken++;
  introSit = null;
  shop.setPulse(null);
  hideSay();
  $('intro-skip').hidden = true;
  $('thermo').classList.remove('rise');
  if (!$('seat').hidden) { seatCloseWait = null; $('seat').querySelector('.s3-up')?.click(); }
  save.chapter = 1;
  save.temp = START_TEMP;
  writeSave(save);
  state.mode = 'setup';
  render();
}

$('intro-skip').onclick = finishOpening;
// 開場裡坐下後按「站起來」：交給 shopIntro 接著走
new MutationObserver(() => {
  if ($('seat').hidden && seatCloseWait) { const f = seatCloseWait; seatCloseWait = null; f(); }
}).observe($('seat'), { attributes: true, attributeFilter: ['hidden'] });

/* ---------- 開始 ---------- */
fit();
if (save.chapter === 0) playOpening();
else {
  state.mode = 'setup';
  render();
  if (JUMP === 2) chapterIntro();
}

// 除錯與自動化截圖用（不影響遊戲）
window.__cafe = { save: () => save, state, W, H, cornersOf, shop, footprint, pieceCells };
