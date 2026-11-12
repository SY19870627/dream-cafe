// v3b 入口：開場第一幕到第四幕（劇本 v3.8）→ 待續。第一天起正在重寫，可玩流程不進入三天故事。
// 三天 AVG 閱讀（story/script.js、final-source.json、下面的「故事閱讀」）保留不刪，但只有 phase === 'story' 才會畫，執行畫面不會走到。
// 沒有泡咖啡操作、機關、佈置模式、溫度計、倒數、自動跨天：每一句都由玩家點（或 Enter／Space）推進。
// 劇本規則在 story/script.js、讀到哪一頁與選項在 story/state.js（純邏輯，有單元測試）；美術代號只查 story/manifest.js。
import * as S from './story/state.js';
import { load, persist as saveTo } from './story/save.js';
import { BACKGROUNDS, PORTRAITS, FOCUS, OLD_LADY, STORY_YAW, CAT_SPOTS, CUP, artUrl, allArt } from './story/manifest.js';
import { Pano } from './view/pano.js';
import { shopScene, TONE } from './view/shop.js';
import { showOpening, showScene } from './view/opening.js';
import { createReader } from './view/reader.js';
import { unlock, play, setAmbient, setEngine } from './view/audio.js';
import { preload, img, ready } from './view/art.js';
import { OPENING_LINES, sceneAt } from './lines/opening.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
// 劇本字原樣顯示；開頭的【待定】標記用小字淡色（字還在，只是不搶眼）
const TAG = '【待定】';
const fmt = (t) => (t.startsWith(TAG) ? `<span class="st-tag">${TAG}</span>${esc(t.slice(TAG.length))}` : esc(t));

let source = null;
let state = null;
const save = () => saveTo(state);

let token = 0; // 換畫面時讓上一段還在等的流程作廢
let onTap = null;
let mode = 'read'; // read 閱讀（固定鏡頭）／ look 店內環視
let logOpen = false;
let renderedId = null; // 閱讀框裡「玩家眼前那一頁」的 id；沒有顯示閱讀頁時是 null（淡入淡出中、環視、開場）
const gate = S.createGate();
const shown = { bg: null, portrait: null, focus: null }; // 目前畫面上的東西（沒變就不重建，避免閃）
const pano = new Pano($('pano'), { onTap: (it) => onTap?.(it) });

addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });

function fadeThen(fn, color = '#1a1612', ms = 650) {
  const f = $('fade');
  f.style.background = color;
  f.style.transitionDuration = `${Math.max(600, ms)}ms`;
  f.classList.add('on');
  return sleep(ms).then(() => { fn(); return sleep(80); }).then(() => f.classList.remove('on'));
}

function reset() {
  token++;
  onTap = null;
  renderedId = null;
  sceneCtl?.stop();
  sceneCtl = null;
  cloth(false);
  reader.hide();
  $('opening').hidden = true;
  $('story').hidden = true;
  $('look').hidden = true;
  $('pano').hidden = false;
  $('pano').classList.remove('reading');
  pano.enabled = true;
}

function go() {
  reset();
  if (state.phase === 'opening') return opening();
  mode = S.isEnd(state) ? 'look' : 'read';
  render({ forward: false });
}

/* ---------- 開場（劇本 v3.8 第一幕～第四幕；每一幕、每一句都存檔，只往前） ---------- */
// 第一幕～第二幕：DOM 畫面整幕自己處理（view/opening.js 的 showOpening）
// 第三幕～第四幕：閱讀框一句一句（view/reader.js），畫面是店內 360（pano）或 DOM 畫面（view/opening.js 的 showScene）
// 開場在「待續」結束：不接第一天，也不會進三天故事。
const reader = createReader($('op-read'), $('app'));
const DOM_ACTS = ['office', 'title', 'mailbox', 'letter'];
const SHOP_ACTS = ['deshu', 'sit', 'coffee', 'stay'];
const NEXT_ACT = { road: 'deshu', deshu: 'sit', sit: 'coffee', coffee: 'depart', depart: 'ride', ride: 'fork', fork: 'temple', temple: 'return', return: 'stay', stay: 'room' };
let sceneCtl = null; // 目前的 DOM 畫面（換畫面時停掉動畫與計時器）
let clothTimer = 0; // 布擦杯子，一下一下

function cloth(on) {
  if (!on) { clearInterval(clothTimer); clothTimer = 0; return; }
  if (clothTimer) return;
  play('cloth');
  clothTimer = setInterval(() => play('cloth'), 900);
}

function opening() {
  const act = state.opening.act;
  if (SHOP_ACTS.includes(act)) return openingShop(act);
  $('pano').hidden = true;
  if (DOM_ACTS.includes(act)) {
    setAmbient(act === 'office' ? 'hum' : null);
    showOpening($('opening'), act, {
      state,
      persist: save,
      go: (a) => { if (S.setOpeningAct(state, a)) { save(); go(); } },
    });
    return;
  }
  return openingScene(act);
}

// 換到下一幕（淡出淡入）
function nextAct(from, color, ms) {
  if (!S.setOpeningAct(state, NEXT_ACT[from])) return;
  save();
  fadeThen(go, color, ms);
}

// 一幕裡的句子：從存檔那一句接著；每一句說完點一下才出下一句（不點就停在這一句）
// look(i, 畫面樣子, 句子)：把畫面擺成第 i 句的樣子；gate(name)：互動關卡；optional(name)：可選互動的熱點
async function runLines(act, { look, gate, optional }) {
  const my = token;
  const lines = OPENING_LINES[act];
  for (let i = state.opening.line; i < lines.length; i++) {
    const b = lines[i];
    look(i, sceneAt(lines, i), b);
    for (const n of b.sfx || []) play(n);
    if (b.wait) { // 先聽聲音，字晚一點出來
      reader.hideBox();
      reader.passive();
      await sleep(b.wait);
      if (my !== token) return false;
    }
    reader.show(b);
    let ok;
    if (b.gate) {
      reader.clearHot();
      reader.passive();
      ok = await gate(b.gate, b);
    } else {
      reader.hot(b.optional ? optional(b.optional, b) : []);
      ok = await reader.next();
    }
    reader.clearHot();
    if (!ok || my !== token) return false;
    if (i + 1 < lines.length) { S.setOpeningLine(state, i + 1); save(); }
  }
  return true;
}

// 熱點範圍：DOM 元素
const elRect = (el) => (base) => {
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height } : null;
};

/* ---------- 三合院外、黑路、岔路、廟、庭埕與房間、待續 ---------- */
async function openingScene(act) {
  const my = token;
  const ctl = showScene($('opening'), act, {
    state,
    chooseFork: (side) => { const ok = S.chooseFork(state, side); if (ok) save(); return ok; },
    restart,
  });
  sceneCtl = ctl;
  if (act === 'end') { setAmbient(null); reader.hide(); return; }
  if (act === 'ride' || act === 'fork' || act === 'temple') { setAmbient('engine'); setEngine(0); }
  else if (act === 'room') setAmbient('room');
  else setAmbient('wind', act === 'road' ? 0.6 : 0.45);

  if (act === 'depart') { // 點機車「發動」：引擎聲、車燈亮、轉到路上（不點就留在三合院外）
    reader.hide();
    const ok = await ctl.gate('start');
    if (!ok || my !== token) return;
    return nextAct('depart', '#000', 900);
  }
  if (act === 'road' && state.opening.line === 0) { // 傍晚，東山。（機車引擎聲，熄火）
    reader.hide();
    const ok = await ctl.intro();
    if (!ok || my !== token) return;
  }
  const done = await runLines(act, {
    look: (i, lk) => ctl.beat(i, lk),
    gate: (name) => ctl.gate(name),
    optional: (name) => (name === 'bed' ? [{
      id: 'bed', label: '床', rect: elRect(ctl.hot('bed')),
      onTap: () => ctl.lieDown().then(() => { if (my === token) reader.advance(); }), // 玩家點床：躺下去，翻到下一句
    }] : []),
  });
  if (!done || my !== token) return;
  if (act === 'room') { // 淡出。開場到此結束（待續）
    if (!S.finishOpening(state)) return;
    save();
    reader.hide();
    return fadeThen(go, '#0d0b0a', 1600);
  }
  if (act === 'ride') { S.setOpeningAct(state, 'fork'); save(); return go(); } // 同一條路接著騎到岔路
  nextAct(act, act === 'road' || act === 'return' ? '#f3dfb8' : '#000', act === 'temple' ? 1100 : 650);
}

/* ---------- 店裡（推門之後、坐下、喝咖啡、晚上回來） ---------- */
// 龍眼在店裡的位置（開場）：貓圖沿用 sleep／sit／walk
const OP_CAT = {
  doorway: { angle: 6, depth: 0.9, y: 0.99, h: 0.11, img: 'cat_longan_walk' },
  chair: { angle: 38, depth: 0.64, y: 0.765, h: 0.075, img: 'cat_longan_sleep' },
  shoes: { angle: 25, depth: 0.82, y: 0.97, h: 0.1, img: 'cat_longan_walk', flip: true },
  rub: { angle: 21, depth: 0.86, y: 0.985, h: 0.11, img: 'cat_longan_walk' },
  feet: { angle: 21, depth: 0.86, y: 0.985, h: 0.105, img: 'cat_longan_sit' },
  feetSeated: { angle: -30, depth: 0.7, y: 0.95, h: 0.09, img: 'cat_longan_sit' },
  across: { angle: 7, depth: 0.58, y: 0.73, h: 0.075, img: 'cat_longan_sleep' }, // 對面那張椅子的椅面上
};
const DESHU_AT = { // 德叔在店面裡的樣子（立繪出來時店面裡不畫，不會同時兩個德叔）
  stand: { pose: 'stand' },
  brew: { pose: 'brew' },
  serveTable: { pose: 'serve', angle: 58, depth: 0.42, y: 0.86, h: 0.46 }, // 站在靠窗那張桌子後面
};
const CAT_ASPECT = 512 / 384;
const pet = { at: 0 }; // 摸頭（頭頂上來）
const sip = { at: 0 }; // 拿起杯子喝一口

// 靠窗那張桌子（沒有桌子原圖：用桌面材質畫）
const drawTable = (g, w, h) => {
  const top = img('tex_wood_top');
  g.fillStyle = '#4a3020';
  g.fillRect(w * 0.08, h * 0.16, w * 0.06, h * 0.84);
  g.fillRect(w * 0.86, h * 0.16, w * 0.06, h * 0.84);
  g.fillStyle = '#7a5638';
  g.fillRect(0, 0, w, h * 0.18);
  if (ready(top)) { g.save(); g.globalAlpha = 0.85; g.drawImage(top, 0, 0, w, h * 0.18); g.restore(); }
  g.fillStyle = 'rgba(255,240,210,.25)';
  g.fillRect(0, 0, w, 2);
};
// 貓：畫成可以動（摸頭時頭頂上來一下）
const drawCat = (spot) => (g, w, h) => {
  const im = img(spot.img);
  if (!ready(im)) return;
  const k = pet.at ? Math.max(0, 1 - (performance.now() - pet.at) / 1600) : 0;
  const lift = Math.sin(k * Math.PI * 3) * 0.06 * k;
  g.save();
  if (spot.flip) { g.translate(w, 0); g.scale(-1, 1); }
  g.translate(w / 2, h);
  g.rotate(-lift);
  g.scale(1 + k * 0.04, 1 + k * 0.06);
  g.drawImage(im, -w / 2, -h, w, h);
  g.restore();
};

function openingShopScene(act, look) {
  const seated = act === 'coffee';
  const d = look.deshu ? DESHU_AT[look.deshu] : null;
  const sc = shopScene({ mode: seated ? 'seated' : 'enter', deshu: d && !d.angle ? d.pose : null, day: 0, tone: 'dusk' });
  const night = look.night || 0;
  const items = sc.items.filter((it) => it.id !== 'longan');
  const win = items.find((it) => it.id === 'window');
  if (win && night >= 0.5) win.img = 'window_night_clear';
  if (!seated) {
    items.push({ id: 'chairA', angle: 38, depth: 0.63, y: 0.9, h: 0.3, img: 'chair', ...(act === 'sit' ? { hit: true, glow: true, label: '椅子', showLabel: true } : {}) });
    items.push({ id: 'wintable', angle: 52, depth: 0.6, y: 0.88, h: 0.17, aspect: 1.5, draw: drawTable });
    if (look.cup) items.push({ id: 'cup', angle: 47.5, depth: 0.61, y: 0.715, h: 0.045, img: 'prop_cup' });
  } else {
    items.push({ id: 'chairB', angle: 7, depth: 0.56, y: 0.84, h: 0.27, img: 'chair' });
  }
  if (d?.angle) items.push({ id: 'deshu-out', angle: d.angle, depth: d.depth, y: d.y, h: d.h, img: `char_deshu_${d.pose}` });
  const spot = OP_CAT[look.cat];
  if (spot) items.push({ id: 'longan', angle: spot.angle, depth: spot.depth, y: spot.y, h: spot.h, aspect: CAT_ASPECT, draw: drawCat(spot) });
  sc.items = items;
  // 天色：傍晚 → 晚上（窗外暗下來）
  // 傍晚的暖橘 → 晚上：外面暗了，店裡只剩燈（暖、暗一點，不變灰）
  sc.tint = night > 0 ? `rgba(${Math.round(120 - 70 * night)},${Math.round(60 - 30 * night)},${Math.round(20 + 8 * night)},${(0.28 + 0.14 * night).toFixed(3)})` : TONE.dusk;
  if (seated) { // 坐下：桌面在畫面下緣，杯子在右手邊（點了拿起來喝一口）
    const table = sc.foreground;
    sc.foreground = (g, W, H, t) => {
      table?.(g, W, H, t);
      const cup = img(CUP.src);
      if (!ready(cup)) return;
      const k = sip.at ? Math.min(1, (performance.now() - sip.at) / 1500) : 1;
      const up = Math.sin(k * Math.PI);
      const h = H * 0.085 * (1 + up * 0.35);
      const w = (h * cup.naturalWidth) / cup.naturalHeight;
      g.drawImage(cup, W * 0.86 - w / 2 - up * W * 0.12, H * 0.935 - h - up * H * 0.12, w, h);
    };
  }
  return sc;
}
const cupRect = () => {
  const W = pano.W;
  const H = pano.H;
  const h = H * 0.085;
  const w = h * (600 / 420);
  return { x: W * 0.86 - w / 2, y: H * 0.935 - h, w, h };
};

async function openingShop(act) {
  const my = token;
  setAmbient('shop', act === 'stay' ? 0.7 : 1);
  $('opening').hidden = true;
  const show = (lk, { yaw } = {}) => {
    pano.setScene(openingShopScene(act, lk), yaw != null ? { yaw } : {});
    pano.scene.locked = act !== 'sit';
    pano.enabled = act === 'sit';
  };
  if (act === 'sit') { // 店內 360：標「椅子」的熱點會發光；可拖曳轉視角；點椅子坐下，點其他地方不會坐下
    reader.hide();
    $('pano').classList.remove('reading');
    show({ deshu: 'stand', cat: 'feet', cup: true }, { yaw: 24 });
    onTap = (it) => {
      if (it?.id !== 'chairA') return;
      onTap = null;
      play('place');
      nextAct('sit', '#3a2a20');
    };
    return;
  }
  $('pano').classList.add('reading');
  let first = true;
  const done = await runLines(act, {
    look: (i, lk) => {
      const yaw = act === 'coffee' ? STORY_YAW : (lk.yaw ?? 0);
      show(lk, first ? { yaw } : {});
      if (!first) pano.turnTo(yaw, 900);
      first = false;
      reader.portrait(lk.portrait ? PORTRAITS.deshu.src : null);
      cloth(!!lk.cloth);
    },
    gate: async () => false,
    optional: (name) => {
      if (name === 'cat') {
        return [{ id: 'cat', label: '龍眼', rect: () => { const it = pano.scene?.items.find((x) => x.id === 'longan'); return it ? pano.project(it) : null; },
          onTap: () => { pet.at = performance.now(); play('purr'); } }];
      }
      if (name === 'cup') {
        return [{ id: 'cup', label: '杯子', rect: cupRect,
          onTap: () => { sip.at = performance.now(); setTimeout(() => play('sip'), 350); setTimeout(() => play('place'), 1400); } }];
      }
      return [];
    },
  });
  cloth(false);
  if (!done || my !== token) return;
  reader.hide();
  nextAct(act, act === 'stay' ? '#0d0b0a' : act === 'coffee' ? '#000' : '#3a2a20', act === 'stay' ? 900 : 650);
}

// 從開頭再看一次（只重設 v3b 自己的存檔；不碰 v3a 與第一版的鍵）
function restart() {
  state = S.newStoryState();
  save();
  fadeThen(go, '#15171c');
}

/* ---------- 故事閱讀 ---------- */
// 店內故事鏡頭：固定朝吧台；立繪是德叔時，店面裡的德叔不畫（不會同時兩個德叔）；杯子已在桌上
function storyShop(page, bg) {
  const spot = CAT_SPOTS[page.cat] || CAT_SPOTS.shelfSleep;
  const onTable = page.cat === 'table';
  const sc = shopScene({
    mode: 'seated',
    deshu: page.portrait === 'deshu' ? null : 'stand',
    day: 1,
    tone: bg.tone,
    cat: onTable ? { ...spot, hidden: true } : spot,
  });
  const table = sc.foreground;
  sc.foreground = (g, W, H, t) => {
    table?.(g, W, H, t);
    const cup = img(CUP.src);
    if (ready(cup)) {
      const h = H * 0.085;
      const w = (h * cup.naturalWidth) / cup.naturalHeight;
      g.drawImage(cup, W * 0.86 - w / 2, H * 0.935 - h, w, h);
    }
    if (onTable) { // 龍眼在她位子旁邊（桌面上）
      const cat = img(spot.img);
      if (ready(cat)) {
        const h = H * spot.h;
        const w = (h * cat.naturalWidth) / cat.naturalHeight;
        g.drawImage(cat, W * 0.2 - w / 2, H * 0.95 - h, w, h);
      }
    }
  };
  return sc;
}

function renderBackground(page) {
  const bg = BACKGROUNDS[page.background] || BACKGROUNDS.shopMorning;
  const holder = $('st-bg');
  if (bg.kind === 'pano') {
    holder.hidden = true;
    holder.innerHTML = '';
    shown.bg = null;
    $('pano').hidden = false;
    $('pano').classList.toggle('reading', mode === 'read');
    const sc = storyShop(page, bg);
    sc.locked = mode === 'read';
    pano.enabled = mode !== 'read';
    pano.setScene(sc, mode === 'read' ? { yaw: STORY_YAW } : {});
    return bg;
  }
  $('pano').hidden = true;
  holder.hidden = false;
  if (shown.bg !== page.background) {
    shown.bg = page.background;
    const lady = OLD_LADY.places[page.background];
    holder.innerHTML = `<div class="st-bg-in enter" style="background:${bg.base}">
      <img class="st-bg-img" src="${artUrl(bg.src)}" alt="">
      ${lady ? `<img class="st-lady" src="${artUrl(OLD_LADY.src)}" alt="" aria-hidden="true" style="left:${lady.x * 100}%;top:${(lady.y - lady.h) * 100}%;height:${lady.h * 100}%">` : ''}
    </div>`;
    for (const im of holder.querySelectorAll('img')) im.onerror = () => im.remove(); // 缺圖：留底色，不擋閱讀
  }
  // 特寫是背景局部：放大背景的那一塊
  const f = FOCUS[page.focus];
  const z = f?.kind === 'zoom' ? f.zoom[page.background] : null;
  const inner = holder.firstElementChild;
  inner.style.transformOrigin = z ? `${z.x * 100}% ${z.y * 100}%` : '50% 50%';
  inner.style.transform = z ? `scale(${z.scale})` : '';
  return bg;
}

function renderPortrait(page) {
  const p = PORTRAITS[page.portrait];
  const key = p ? page.portrait : null;
  if (shown.portrait === key) return;
  shown.portrait = key;
  const box = $('st-portrait');
  if (!p) { box.innerHTML = ''; return; }
  const pos = p.top != null ? `top:${p.top * 100}%` : `bottom:${p.bottom * 100}%`;
  box.innerHTML = `<img class="enter" src="${artUrl(p.src)}" alt="${esc(p.name)}" style="height:${p.height * 100}%;${pos}">`;
  box.querySelector('img').onerror = (e) => e.target.remove();
}

function renderFocus(page) {
  const f = FOCUS[page.focus];
  const withPortrait = !!PORTRAITS[page.portrait];
  const key = f && f.kind !== 'zoom' ? `${page.focus}|${page.phone}|${withPortrait}` : null;
  if (shown.focus === key) return;
  shown.focus = key;
  const el = $('st-focus');
  if (!key) { el.innerHTML = ''; return; }
  el.style.top = withPortrait ? '40%' : '20%';
  if (f.kind === 'prop') {
    const w = withPortrait ? 'min(46vw, 190px)' : 'min(62vw, 250px)';
    el.innerHTML = `<div class="st-card" style="width:${w};height:${w}"><img src="${artUrl(f.src)}" alt=""></div>`;
    el.querySelector('img').onerror = (e) => e.target.parentElement.remove();
  } else if (f.kind === 'phone') {
    const h = withPortrait ? 'min(22vh, 170px)' : 'min(26vh, 210px)';
    el.innerHTML = `<div class="st-phone${page.phone === 'off' ? ' off' : ''}" style="height:${h}" aria-hidden="true"></div>`;
  }
}

function renderText(page, pages) {
  const box = $('st-box');
  const choices = $('st-choices');
  choices.hidden = true;
  choices.innerHTML = '';
  box.hidden = false;
  box.classList.remove('dim');
  const linesHtml = (lines) => lines.map((l, i) => {
    const name = l.speaker !== 'narrator' && (i === 0 || lines[i - 1].speaker !== l.speaker);
    return `<p class="st-line ${l.speaker}">${name ? `<span class="st-name">${esc(l.name)}</span>` : ''}<span class="st-text">${fmt(l.text)}</span></p>`;
  }).join('');

  if (page.kind === 'title') { // 章名：放在閱讀框正中
    box.innerHTML = `<p class="st-daytitle">${fmt(page.text)}</p><span class="st-more" aria-hidden="true">▾</span>`;
    return;
  }
  if (page.kind === 'line') {
    box.innerHTML = `${linesHtml(page.lines)}<span class="st-more" aria-hidden="true">▾</span>`;
    box.scrollTop = 0;
    return;
  }
  if (page.kind === 'choice') {
    // 框裡留著問題前那一頁的字（淡一點），選項在框的上方
    const i = pages.findIndex((p) => p.id === page.id);
    const prev = pages.slice(0, i).reverse().find((p) => p.kind === 'line');
    box.innerHTML = prev ? linesHtml(prev.lines) : '';
    box.classList.add('dim');
    choices.hidden = false;
    choices.innerHTML = page.options.map((o) => `<button type="button" data-v="${esc(o.value)}">${fmt(o.label)}</button>`).join('');
    choices.style.bottom = `${box.offsetHeight + 16}px`;
    gate.arm(performance.now());
    for (const b of choices.querySelectorAll('button')) {
      b.onclick = (e) => {
        e.stopPropagation();
        if (!gate.canChoose(performance.now()) || renderedId !== page.id || logOpen) return;
        if (!S.choose(source, state, page.id, b.dataset.v)) return;
        for (const o of choices.querySelectorAll('button')) o.disabled = true;
        save();
        play('tap');
        render({ forward: true });
      };
    }
  }
}

function render({ forward }) {
  const pages = S.pagesOf(source, state);
  let page = pages.find((p) => p.id === state.at);
  if (!page) { // 理論上 normalize 已經擋掉；保險起見回到劇本開頭
    state.at = S.FIRST_PAGE;
    save();
    page = pages.find((p) => p.id === state.at);
  }
  if (page.kind === 'end') mode = 'look';
  const bg = renderBackground(page);
  setAmbient(bg.ambient, page.ambientLevel);
  if (forward) for (const name of page.sfx) play(name);
  if (mode === 'look') {
    renderedId = null;
    $('story').hidden = true;
    $('look').hidden = false;
    $('look-back').hidden = page.kind === 'end';
    return;
  }
  $('look').hidden = true;
  $('story').hidden = false;
  renderPortrait(page);
  renderFocus(page);
  $('st-scene').innerHTML = page.sceneTitle ? fmt(page.sceneTitle) : '';
  $('st-look').hidden = bg.kind !== 'pano';
  renderText(page, pages);
  renderedId = page.id;
}

// 推頁一律用畫面上正在顯示的那一頁 id：還沒畫出來（例如開場淡出中按 Enter）或已換頁的舊點擊都不會多推
function tryAdvance() {
  if (state.phase !== 'story' || logOpen || mode !== 'read' || !renderedId || $('story').hidden) return;
  const page = S.currentPage(source, state);
  if (!page || page.id !== renderedId || (page.kind !== 'line' && page.kind !== 'title')) return;
  if (!gate.canAdvance(performance.now())) return;
  if (!S.advance(source, state, renderedId)) return;
  save();
  render({ forward: true });
}

$('story').addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  tryAdvance();
});
addEventListener('keydown', (e) => {
  if (!state || state.phase !== 'story') return; // 開場有自己的閱讀框（view/reader.js），這裡不攔
  if (logOpen) {
    if (e.key === 'Escape') closeLog();
    return;
  }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.target.closest?.('button, input, textarea, select, a, [contenteditable]')) return;
  e.preventDefault();
  tryAdvance();
});

/* ---------- 環視（只在店內；回來還是原來那一頁） ---------- */
function enterLook() {
  document.activeElement?.blur?.(); // 按鈕收起後焦點不留在看不見的按鈕上（之後的 Enter／Space 才會推頁）
  mode = 'look';
  render({ forward: false });
  pano.resize();
}
function exitLook() {
  if (S.isEnd(state)) return;
  document.activeElement?.blur?.();
  mode = 'read';
  render({ forward: false });
}
$('st-look').onclick = (e) => { e.stopPropagation(); enterLook(); };
$('look-back').onclick = exitLook;

/* ---------- 回顧（只列讀過的頁與選過的答案；蓋住畫面，點不穿） ---------- */
function openLog() {
  const items = S.history(source, state);
  $('log-list').innerHTML = items.map((h) => {
    if (h.kind === 'title') return `<p class="log-day">${fmt(h.text)}</p>`;
    if (h.kind === 'choice') return `<p class="log-item log-choice">▸ ${fmt(h.text)}</p>`;
    return `<p class="log-item">${h.name ? `<span class="st-name">${esc(h.name)}</span>` : ''}${fmt(h.text)}</p>`;
  }).join('');
  logOpen = true;
  $('log').hidden = false;
  const list = $('log-list');
  list.scrollTop = list.scrollHeight;
}
function closeLog() {
  logOpen = false;
  $('log').hidden = true;
  document.activeElement?.blur?.();
  if (S.currentPage(source, state)?.kind === 'choice') gate.arm(performance.now()); // 回到選項頁：剛關掉的那一下不會落在選項上
}
$('st-log').onclick = (e) => { e.stopPropagation(); openLog(); };
$('look-log').onclick = openLog;
$('log-close').onclick = closeLog;
$('log').addEventListener('click', (e) => e.stopPropagation());
$('log').addEventListener('pointerdown', (e) => e.stopPropagation());

/* ---------- 開機 ---------- */
fetch('src/story/final-source.json')
  .then((r) => r.json())
  .then((json) => {
    source = json;
    state = S.playable(load(source)); // 舊版存到三天故事裡的存檔：回到開場開頭（不接著播第一天）
    save();
    return preload(allArt());
  })
  .then(() => {
    $('boot').remove();
    go();
  });
