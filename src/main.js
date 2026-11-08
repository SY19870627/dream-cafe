// 入口：串起一天的循環（開店前佈置 → 營業 → 打烊看日誌 → 調整），以及序章的開場四幕。
// 邏輯在 grid／sim／menu／chapters／journal；畫面在 view/。
import {
  CORNERS, DECOR, W, H, placeProblem, validate, remaining, size, seatCells, BAR_ITEM, REASONS, cornersOf,
} from './grid.js';
import { simulateDay, catSpot, GUESTS, ACTIONS } from './sim.js';
import { CHAPTERS, LAST_CHAPTER, START_TEMP, chapter, unlocks, goalDone } from './chapters.js';
import { buildJournal } from './journal.js';
import { newSave, loadSave, writeSave, clearSave } from './save.js';
import { runOpening } from './opening.js';
import { DESHU_ENTER, FIRST_CUP } from './letters.js';
import { JOURNAL_TITLE, CHAPTER_LINES, HINTS, PROTO_END } from './lines/journal.js';
import { ShopView } from './view/shop.js';
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
  selected: null,
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
  shop.fit(st.clientWidth - 20, st.clientHeight - 20); // 扣掉店面的外框
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
  shop.render({
    layout: save.layout,
    validation: state.validation,
    selected: state.selected,
    mode: ['business', 'intro', 'opening'].includes(state.mode) ? 'business' : 'setup', // 開場裡也不畫格線
    cat: state.mode === 'business' && state.result ? state.result.cat : catSpot(save.layout),
  });
  const setup = state.mode === 'setup';
  $('tray').hidden = !setup || !!state.selected;
  $('sel').hidden = !setup || !state.selected;
  $('speed').hidden = state.mode !== 'business';
  $('actions').hidden = !setup;
  if (setup) {
    renderTray();
    renderSel();
    $('btn-open').disabled = !state.validation.ok;
    $('btn-menu').classList.toggle('ping', unlocks(save.chapter).design && save.menu.slots.every((r) => !r || r.by !== 'player'));
    const [text, bad] = setupStatus();
    status(text, bad);
  }
}

function status(text, bad = false) {
  $('status').textContent = text || '';
  $('status').classList.toggle('bad', bad);
}

function setupStatus() {
  const v = state.validation;
  if (!v.barOk) return [HINTS.blockedBar, true];
  if (v.unreachable.length) return [HINTS.blockedCorner, true];
  if (v.stuck.length) return [HINTS.stuck, false];
  if (save.chapter === 1 && !save.layout.items.some((i) => i.kind === 'corner')) return [HINTS.ch1, false];
  if (save.chapter === 2 && !save.menu.slots.some((r) => r?.by === 'player')) return [HINTS.ch2, false];
  if (save.layout.items.length && save.day <= 2) return [HINTS.tap, false];
  return [HINTS.ready, false];
}

/* ---------- 下方角落列 ---------- */
function renderTray() {
  const u = unlocks(save.chapter);
  const chips = [];
  for (const type of u.corners) {
    const c = CORNERS[type];
    const left = remaining(save.layout, 'corner', type);
    chips.push(`<button type="button" class="chip corner" data-kind="corner" data-type="${type}" ${left <= 0 ? 'disabled' : ''}>
      <span class="sw" style="background:${c.styles[0].color}"></span><b>${c.name}</b><small>${c.w}×${c.h}・剩 ${left}</small></button>`);
  }
  for (const type of u.decor) {
    const d = DECOR[type];
    const left = remaining(save.layout, 'decor', type);
    chips.push(`<button type="button" class="chip decor" data-kind="decor" data-type="${type}" ${left <= 0 ? 'disabled' : ''}>
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
  const it = findItem(state.selected);
  if (!it) { $('sel').innerHTML = ''; return; }
  const name = it.kind === 'corner' ? CORNERS[it.type].name : DECOR[it.type].name;
  let btns = '';
  if (it.kind === 'corner' && !it.fixed) {
    btns += '<button type="button" data-a="rot">轉 90°</button>';
    if (CORNERS[it.type].styles.length > 1) btns += '<button type="button" data-a="style">換款式</button>';
  }
  if (it.kind === 'corner') btns += '<button type="button" data-a="sit">坐下來看看</button>';
  if (!it.fixed) btns += '<button type="button" data-a="stow">收起</button>';
  btns += '<button type="button" data-a="done" class="primary">好</button>';
  $('sel').innerHTML = `<p class="sel-name">${esc(name)}</p><div class="sel-btns">${btns}</div>`;
  for (const b of $('sel').querySelectorAll('button')) b.onclick = () => selAction(b.dataset.a, it);
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
      if (!p) { replaceItem(cand); render(); return; }
      firstReason ||= p;
    }
    toast(`轉不過去：${REASONS[firstReason] || ''}`);
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
  if (drag.fromUid) shop.el.querySelector(`[data-uid="${drag.fromUid}"]`)?.classList.add('dragging');
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
    // 點一下：選取已放的東西
    if (d.fromUid) state.selected = d.fromUid;
    render();
    return;
  }
  const inside = !!shop.pointToCell(e.clientX, e.clientY);
  if (inside && d.cand && d.ok) {
    if (d.fromUid) replaceItem({ ...d.item, ...d.cand, uid: d.fromUid });
    else {
      const uid = newUid(d.item.kind === 'corner' ? 'c' : 'd');
      save.layout = { items: [...save.layout.items, { ...d.cand, uid }] };
      if (d.item.kind === 'corner') state.selected = null;
    }
  } else if (!inside && d.fromUid) {
    save.layout = { items: save.layout.items.filter((i) => i.uid !== d.fromUid) }; // 拖回下方就收起來
    if (state.selected === d.fromUid) state.selected = null;
  } else if (inside && d.cand && !d.ok) {
    toast('放不下，那裡不行。');
  }
  render();
}

// 在店面上按下：已放的東西可以拖、可以點
$('stage').addEventListener('pointerdown', (e) => {
  if (state.mode === 'intro') {
    const stool = e.target.closest('[data-uid="bar"], .sh-bar');
    if (stool && introSit) introSit();
    return;
  }
  if (state.mode !== 'setup') return;
  const el = e.target.closest('.it');
  if (!el) {
    if (state.selected) { state.selected = null; render(); }
    return;
  }
  const uid = el.dataset.uid;
  if (uid === 'bar') { state.selected = 'bar'; render(); return; }
  const it = findItem(uid);
  if (!it) return;
  const p = shop.pointToCell(e.clientX, e.clientY);
  startDrag(e, {
    item: { ...it }, fromUid: uid,
    grab: { dx: p.fx - it.x, dy: p.fy - it.y },
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
  shop.el.querySelector('[data-uid="bar"]')?.classList.add('pulse');
  await new Promise((res) => { introSit = res; });
  introSit = null;
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
window.__cafe = { save: () => save, state, W, H, cornersOf };
