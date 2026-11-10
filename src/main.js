// v3b 三天故事驗證版入口：開場（第一版原字、原流程）→ 第四幕兩句 → 第一～三天 15 場 AVG 閱讀 → 停在店裡可環視。
// 沒有泡咖啡、機關、倒數、喝完解鎖、自動派物、自動跨天：每一頁都由玩家點（或 Enter／Space）推進。
// 劇本規則在 story/script.js、讀到哪一頁與選項在 story/state.js（純邏輯，有單元測試）；美術代號只查 story/manifest.js。
import * as S from './story/state.js';
import { load, persist as saveTo } from './story/save.js';
import { BACKGROUNDS, PORTRAITS, FOCUS, OLD_LADY, STORY_YAW, CAT_SPOTS, CUP, artUrl, allArt } from './story/manifest.js';
import { Pano } from './view/pano.js';
import { shopScene } from './view/shop.js';
import { showOpening } from './view/opening.js';
import { unlock, play, setAmbient } from './view/audio.js';
import { preload, img, ready } from './view/art.js';
import { DESHU_ENTER, SIT } from './lines/opening.js';

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

/* ---------- 開場推門後：沿用 v3a 的說話框 ---------- */
const WHO = { deshu: '德叔' };
function say(who, text) {
  const el = $('say');
  el.innerHTML = `${WHO[who] ? `<span class="who">${WHO[who]}</span>` : ''}<span class="text">${esc(text)}</span>`;
  el.hidden = false;
}
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

function fadeThen(fn, color = '#1a1612') {
  const f = $('fade');
  f.style.background = color;
  f.classList.add('on');
  return sleep(650).then(() => { fn(); return sleep(80); }).then(() => f.classList.remove('on'));
}

function reset() {
  token++;
  onTap = null;
  renderedId = null;
  $('say').hidden = true;
  $('next').hidden = true;
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

/* ---------- 開場（第一版原字、原流程；每一幕存檔） ---------- */
function opening() {
  const act = state.opening.act;
  if (act === 'deshu' || act === 'sit') return openingShop(act);
  $('pano').hidden = true;
  setAmbient(act === 'office' ? 'hum' : null);
  showOpening($('opening'), act, {
    state,
    persist: save,
    go: (a) => { if (S.setOpeningAct(state, a)) { save(); go(); } },
    enterShop: () => {
      if (!S.setOpeningAct(state, 'deshu')) return;
      save();
      fadeThen(go, '#f3dfb8');
    },
  });
}

// 推門之後：德叔的三句（點下一句）→「先坐。」→ 點椅子坐下 → 第四幕兩句（閱讀框）
async function openingShop(act) {
  const my = token;
  setAmbient('shop');
  pano.setScene(shopScene({ mode: act === 'deshu' ? 'enter' : 'sit', day: 0 }), { yaw: act === 'deshu' ? 0 : pano.yaw });
  if (act === 'deshu') {
    for (let i = state.opening.deshuLine; i < DESHU_ENTER.length; i++) {
      say('deshu', DESHU_ENTER[i]);
      const ok = await waitTap();
      if (!ok || my !== token) return;
      S.setDeshuLine(state, i + 1);
      save();
    }
    S.setOpeningAct(state, 'sit');
    save();
    return go();
  }
  say('deshu', SIT);
  onTap = (it) => {
    if (it?.id !== 'seat') return;
    if (!S.finishOpening(state)) return;
    save();
    play('place');
    fadeThen(go, '#3a2a20');
  };
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
  if (!state || state.phase !== 'story') return; // 開場（含簽名輸入框）不攔
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
    state = load(source);
    save();
    return preload(allArt());
  })
  .then(() => {
    $('boot').remove();
    go();
  });
