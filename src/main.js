// v3.0 驗證版入口：讀存檔 → 依 phase 進畫面。流程規則在 day.js，這裡只接畫面與手勢。
// 第 0 天開場 → 第 1～5 天（點餐 → 機關 → 喝 → 筆記本 → 夢想 → 回店）→ 第 3 天開頭送一次咖啡 → 第 5 天之後停在店裡（不寫結局）。
import * as D from './day.js';
import { load, persist as saveState } from './save.js';
import { Pano } from './view/pano.js';
import { shopScene, dreamScene } from './view/scenes.js';
import { showOpening } from './view/opening.js';
import { runCompany, animate } from './view/company.js';
import { drawMachine, DURATION, DESIGN, SOUND_EVENTS } from './machine.js';
import { unlock, play, setAmbient, setAmbientLevel } from './view/audio.js';
import { preload, SHOP_ART, OPENING_ART } from './view/art.js';
import { drawShape, ASPECT } from './view/draft.js';
import { DESHU_ENTER, SIT } from './lines/opening.js';
import { MENU, deshuLines } from './lines/shop.js';
import { getDream } from './dreams/index.js';
import { recognize, applyDone, ambientLevel } from './dreams/interact.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const state = load();
const persist = () => saveState(state);
persist();

let token = 0; // 換畫面時讓上一段還在等的流程作廢
let onTap = null;
let onGesture = null;
const pano = new Pano($('pano'), { onTap: (it) => onTap?.(it), onGesture: (it, info) => onGesture?.(it, info) });
const INTERACT_SOUND = { 'rain-quilt-tv': 'page', 'hut-heater-hands': 'tap', 'watch-dog-eat-play': 'domino', 'read-in-cafe': 'page', 'door-coffee-smell': 'door' };

addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });

/* ---------- 小工具：說話、物件那一行字、托盤、淡入淡出 ---------- */
const WHO = { deshu: '德叔', colleague: '同事', me: '' }; // 沒有旁白：舞台動作不經過這裡
function say(who, text) {
  const el = $('say');
  el.className = `say say-${who}`;
  el.innerHTML = `${WHO[who] ? `<span class="who">${WHO[who]}</span>` : ''}<span class="text">${esc(text)}</span>`;
  el.hidden = false;
}
const hideSay = () => { $('say').hidden = true; };

// 等玩家點一下（下一句）：整個畫面都可以點
function waitTap() {
  const my = token;
  const btn = $('next');
  btn.hidden = false;
  return new Promise((res) => {
    btn.onclick = () => {
      btn.hidden = true;
      btn.onclick = null;
      play('tap');
      res(my === token);
    };
  });
}

let lineTimer = 0;
let lineSeq = 0;
// 物件的一行字；delay：像記憶的那個停一拍才出字
async function showLine(text, delay = 0) {
  const my = ++lineSeq;
  const el = $('line');
  el.hidden = true;
  clearTimeout(lineTimer);
  if (delay) { play('memory'); await sleep(delay); }
  if (my !== lineSeq) return;
  el.textContent = text;
  el.hidden = false;
  el.classList.remove('in');
  void el.offsetWidth;
  el.classList.add('in');
  lineTimer = setTimeout(() => { if (my === lineSeq) el.hidden = true; }, 7000);
}

const tray = (html) => { const t = $('tray'); t.innerHTML = html; return t; };

function fadeThen(fn, color = '#1a1612') {
  const f = $('fade');
  f.style.background = color;
  f.classList.add('on');
  return sleep(650).then(() => { fn(); return sleep(80); }).then(() => f.classList.remove('on'));
}

function reset() {
  token++;
  onTap = null;
  onGesture = null;
  lineSeq++;
  hideSay();
  $('line').hidden = true;
  $('next').hidden = true;
  $('page').hidden = true;
  $('fx').hidden = true;
  $('opening').hidden = true;
  $('pano').hidden = false;
  tray('');
  pano.enabled = true;
}

// 粗稿形狀畫成一張小圖（帶回物）
function shapeCanvas(shape, h = 96) {
  const c = document.createElement('canvas');
  const w = Math.round(h * (ASPECT[shape] || 1));
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = (w + 16) * dpr;
  c.height = (h + 16) * dpr;
  c.style.width = `${w + 16}px`;
  c.style.height = `${h + 16}px`;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(8, 8);
  drawShape(g, shape, w, h, 0, {});
  return c;
}

/* ---------- 依 phase 進畫面 ---------- */
function go() {
  reset();
  const my = token;
  const alive = () => my === token;
  const p = state.phase;
  if (p === 'opening') return opening(alive);
  if (p === 'company') return company(alive);
  if (p === 'brew') return brew(alive);
  if (p === 'dream') return dream();
  shop(p);
}

function opening(alive) {
  const act = state.opening.act;
  if (act === 'deshu' || act === 'sit') return openingShop(act, alive);
  $('pano').hidden = true;
  setAmbient(act === 'office' ? 'hum' : null);
  showOpening($('opening'), act, {
    state,
    persist,
    go: (a) => { if (D.setOpeningAct(state, a)) { persist(); go(); } },
    enterShop: () => {
      if (!D.setOpeningAct(state, 'deshu')) return;
      persist();
      fadeThen(go, '#f3dfb8');
    },
  });
}

// 推門之後：德叔的三句（點下一句）→「先坐。」→ 點椅子坐下 → 第 1 天
async function openingShop(act, alive) {
  setAmbient('shop');
  pano.setScene(shopScene({ mode: act === 'deshu' ? 'enter' : 'sit', day: 0 }), { yaw: act === 'deshu' ? 0 : pano.yaw });
  if (act === 'deshu') {
    for (let i = state.opening.deshuLine; i < DESHU_ENTER.length; i++) {
      say('deshu', DESHU_ENTER[i]);
      const ok = await waitTap();
      if (!ok || !alive()) return;
      state.opening.deshuLine = i + 1;
      persist();
    }
    D.setOpeningAct(state, 'sit');
    persist();
    return go();
  }
  say('deshu', SIT);
  onTap = (it) => {
    if (it?.id !== 'seat') return;
    if (!D.finishOpening(state)) return;
    persist();
    play('place');
    fadeThen(go, '#3a2a20');
  };
}

// 德叔說一串話：一次一句，自動換句（不需要點），最後一句留著
// 回傳 true：最後一句已經說出來了；false：畫面換掉了，沒說完
async function deshuSays(lines) {
  const my = token;
  for (let i = 0; i < lines.length; i++) {
    say('deshu', lines[i]);
    if (i < lines.length - 1) {
      await sleep(4200);
      if (my !== token) return false;
    }
  }
  return true;
}

// 桌上的杯子：點一下喝
function serveCup() {
  const t = tray('<button class="cup" aria-label="喝"><img src="assets/art/prop_cup.webp" alt=""></button>');
  t.querySelector('.cup').onclick = async (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true;
    play('sip');
    btn.classList.add('sip');
    const my = token;
    await sleep(1500);
    if (my !== token || !D.drink(state)) return;
    persist();
    go();
  };
}

// 店裡（坐著）：order／drink／notebook／return／rest
function shop(p) {
  const dusk = p === 'return' || p === 'rest';
  const takeaways = p === 'return' ? state.takeaways.filter((id) => id !== D.dreamForDay(state.day)) : state.takeaways;
  const deshu = p === 'drink' ? 'serve' : 'stand';
  pano.setScene(shopScene({ mode: 'seated', deshu, day: state.day, takeaways, tone: dusk ? 'dusk' : 'morning' }));
  setAmbient('shop');
  // 架上帶回來的東西：點了出它的名字
  onTap = (it) => { if (it?.takeaway) showLine(it.label); };

  if (p === 'order') {
    const t = tray(`<div class="menu" role="group" aria-label="菜單">${MENU.map((m) => `<button data-id="${m.id}">${esc(m.name)}</button>`).join('')}</div>`);
    for (const b of t.querySelectorAll('button')) {
      b.onclick = () => {
        if (!D.order(state, b.dataset.id)) return;
        persist();
        play('tap');
        fadeThen(go, '#2a1d16');
      };
    }
  }
  const said = deshuSays(deshuLines(p, state.day));
  if (p === 'drink') {
    // 杯子跟著最後一句（「今天的，請慢用。」）一起放上桌：第 1 天先說完「東山的豆……」才能喝，不會漏掉供餐那句
    said.then((ok) => { if (ok) serveCup(); });
  } else if (p === 'notebook') {
    const t = tray('<button class="notebook" aria-label="筆記本"><span></span></button>');
    t.querySelector('.notebook').onclick = async (e) => {
      if (e.currentTarget.disabled) return;
      e.currentTarget.disabled = true;
      if (!D.openNotebook(state)) return;
      persist();
      play('page');
      const d = getDream(D.dreamForDay(state.day));
      const page = $('page');
      page.innerHTML = `<div class="page-paper"><p>${esc(d.title)}</p></div>`;
      page.hidden = false;
      const my = token;
      await sleep(2600);
      if (my === token) fadeThen(go, '#f4ecd8');
    };
  } else if (p === 'return') {
    // 回店：帶回來的東西在桌上停一下（看得到、截得到），然後自己放上架。不需要玩家點
    const d = getDream(D.dreamForDay(state.day));
    const t = tray('<div class="takeaway" role="img"></div>');
    const card = t.querySelector('.takeaway');
    card.setAttribute('aria-label', d.takeaway.name);
    card.appendChild(shapeCanvas(d.takeaway.shape, 72));
    card.insertAdjacentHTML('beforeend', `<span>${esc(d.takeaway.name)}</span>`);
    const my = token;
    setTimeout(() => {
      if (my !== token || !D.placeTakeaway(state)) return;
      persist();
      play('place');
      card.classList.add('placed');
      // 放上架之後先在傍晚的店裡看到它在架上，再淡到隔天
      setTimeout(() => {
        if (my !== token) return;
        pano.setScene(shopScene({ mode: 'seated', day: state.phase === 'rest' ? state.day : state.day - 1, takeaways: state.takeaways, tone: 'dusk' }));
        if (state.phase === 'rest') return;
        setTimeout(() => { if (my === token) fadeThen(go, '#f3dfb8'); }, 1800);
      }, 500);
    }, D.RETURN_SHOW_MS);
  }
  // rest：五天結束，停在店裡。沒有結局台詞、沒有按鈕
}

// 機關：玩家只看、不操作；重新整理從經過的秒數接著播
async function brew(alive) {
  const fx = $('fx');
  fx.hidden = false;
  $('pano').hidden = true;
  setAmbient(null);
  tray('<img class="deshu-brew" src="assets/art/char_deshu_brew.webp" alt="德叔">');
  const offset = Math.max(0, Math.min(DURATION, (Date.now() - (state.brewStartedAt || Date.now())) / 1000));
  const timers = SOUND_EVENTS.filter((e) => e.t >= offset).map((e) => setTimeout(() => alive() && play(e.name), (e.t - offset) * 1000));
  await animate(fx, (g, W, H, t) => {
    const s = Math.min(W / DESIGN.w, (H * 0.72) / DESIGN.h);
    g.fillStyle = '#2a1d16';
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate((W - DESIGN.w * s) / 2, 0);
    g.scale(s, s);
    drawMachine(g, Math.min(DURATION, offset + t));
    g.restore();
  }, (DURATION - offset) * 1000);
  timers.forEach(clearTimeout);
  if (!alive() || !D.brewDone(state)) return;
  persist();
  fadeThen(go, '#2a1d16');
}

// 夢想場景：360 環視，3～4 個物件各一行字；出口是場景裡的一扇門
function dream() {
  const id = D.dreamForDay(state.day);
  const { dream: d, scene } = dreamScene(id, { interacted: state.interacted.includes(id) });
  pano.setScene(scene, { yaw: 0 });
  setAmbient(d.ambient, ambientLevel(id, state.interacted.includes(id)));
  // 那一個互動：手指在那個物件上拖曳；手勢對了才算，一條夢想只算一次；做不做都可以從出口回店
  onGesture = (it, info) => {
    if (!recognize(it.gesture, info) || !D.interact(state)) return;
    persist();
    applyDone(id, scene.items);
    play(INTERACT_SOUND[id] || 'tap');
    if (id === 'door-coffee-smell') setAmbientLevel(ambientLevel(id, true));
  };
  let grindTimer = d.ambient === 'grinder' ? setInterval(() => play('grind'), 9000) : 0;
  onTap = (it) => {
    if (!it) return;
    if (it.kind === 'object') {
      D.tapObject(state, it.id);
      persist();
      showLine(it.line, it.memory ? 1300 : 0);
    } else if (it.kind === 'exit') {
      if (!D.leaveDream(state)) return;
      clearInterval(grindTimer);
      grindTimer = 0;
      persist();
      play('door');
      play('bell');
      fadeThen(go, '#f3dfb8');
    }
  };
}

// 送咖啡回公司（第 3 天開頭，只一次）
function company(alive) {
  $('fx').hidden = false;
  $('pano').hidden = true;
  runCompany({
    state,
    alive,
    fx: $('fx'),
    say,
    hideSay,
    waitTap,
    step: (s) => { if (D.companyStep(state, s)) persist(); },
    line: (n) => { if (D.companyLine(state, n)) persist(); },
    finish: () => { if (D.finishCompany(state)) { persist(); fadeThen(go, '#f3dfb8'); } },
  });
}

preload([...SHOP_ART, ...OPENING_ART]).then(() => {
  $('boot').remove();
  go();
});
