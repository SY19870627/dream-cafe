// 第一天到研發咖啡的 DOM 畫面（劇本 v5.8；房東之後的畫面沿用 v5.6）：
//   showDay()：整張背景圖的畫面（護龍早上、洗臉、下山、信箱、樓梯間、租屋房間、提款機、超商、村子路、坤伯院子）。
//     字由閱讀框（view/reader.js）一句一句出；這裡只負責「第 i 句時長什麼樣子」與可點的位置
//     （可選：水龍頭；可點可不點、不點就不出那一句：信箱；字出來之前要先點的：錢包、抽屜、徵人海報、花斑貓、空罐子）。
//   showCard()：只有一張字卡的幕（「第二天」「三天後」）；店裡開始的一天的章名卡。
//   createProps().gate('keyGive')：第一天早上把鑰匙拖向德叔（沒有接，回到手上）。
//   createProps()：疊在閱讀框上面的一層（#op-prop）：特寫卡（pp-card）、小圖（pp-mini：先疊上來，點一下才出句子）、要點的東西。店內 2D 定景與整張背景圖都用這一層。
// 美術：畫師原圖只讀不改（不重新壓縮、不縮圖）。圖從哪裡來、哪些是暫代，只查 view/art-map.js（換圖只改那裡）。
//   v5.6 新圖在 assets/art-v56/，舊圖仍在 assets/art/；網址一律由 art-map.js 的 artUrl() 產生。
//   房東、坤伯、店長、店員是半身立繪（依台詞切差分，見 LINE_CUES）；花斑貓只用 cat_huaban_*，不用龍眼貓圖；物件小圖不畫手。
import { DAY_TITLES, DAY_CARDS } from '../lines/days.js';
import { OVERLAY_TEXT, srcOf, refOf, artUrl, ART_MAP_FILES, SHOP_STILL_NIGHT } from './art-map.js';
import { play } from './audio.js';
import { MUST_HINTS } from './hints.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const art = (ref) => artUrl(ref); // 舊圖檔名 → assets/art/；art-v56/… → assets/art-v56/…

// 場景 → 對照表的哪一格（src 從 art-map 來；null＝CSS 中性底 .dy-css）
//   tone：morning 早上／dusk 傍晚（只在顯示時疊一層光，不改原圖）；fit：mbox＝信箱這一幕專用的橫式圖框（1950/1200，整張放進框裡）
const placeOf = (slot, extra = {}) => ({ slot, src: srcOf(slot), ...extra });
export const PLACES = {
  roomMorning: placeOf('bg_room_morning', { ambient: 'room' }), // 護龍早上定版背景，不再疊早晨色調
  basin: placeOf('bg_basin', { tone: 'morning', ambient: 'room', basin: true }), // 暫代：CSS 洗手台與鏡子
  road: placeOf('bg_road', { ambient: 'wind' }), // 下山、省道
  mailbox: placeOf('bg_mailbox', { ambient: 'wind', fit: 'mbox' }), // 租屋處信箱：定版空信箱 scene_mailboxes_empty（橫圖，門都關著、沒信封；不再用帶信封的 scene_mailboxes.webp）
  stairs: placeOf('bg_stairs', { ambient: 'room' }), // v5.6 定版：樓梯間
  home: placeOf('bg_home', { ambient: 'room', home: true }), // v5.6 定版：八月的租屋房間
  atm: placeOf('bg_atm', { ambient: 'wind' }), // v5.6 定版：銀行外的提款機
  store: placeOf('bg_store', { ambient: 'lobby', store: true }), // 定版：超商（bg_v56_store_interior_seating_portrait；徵人海報是座位區後牆上那張有框的空白海報，程式疊字）
  village: placeOf('bg_village', { ambient: 'wind', village: true }), // v5.6 定版：村子路（_portrait_v2）
  kunyard: placeOf('bg_kunyard', { ambient: 'wind', yard: true }), // v5.6 定版：坤伯院子
  // 店內 2D 定景（畫面由 view/shop-still.js 畫，德叔、龍眼、杯子疊在上面；這裡只登記背景給預載與對照）
  shop: placeOf(SHOP_STILL_NIGHT, { ambient: 'shop' }),
};

/* ---------- 新角色的半身立繪與差分（房東、坤伯、店長、店員、花斑貓） ---------- */
// 說話的人 → 對照表的哪一格
export const CHAR_SLOTS = { landlord: 'ch_landlord', kunbo: 'ch_kunbo', storeManager: 'ch_store_manager', clerk: 'ch_clerk', calico: 'ch_calico' };
const CHAR_ALT = { landlord: '房東', kunbo: '坤伯', storeManager: '店長', clerk: '店員', calico: '花斑貓' };
// 依台詞／動作切差分：句子原文 → [誰, 差分]。新角色自己開口但沒列在這裡的句子用底卡；
// 別人講話或旁白時列在這裡的，也把那個角色帶出來（例如旁白「店員低著頭……」）。
export const LINE_CUES = {
  // 樓梯間：房東碎唸、趕人、提醒房租
  '現在年輕人齁，動不動就請假……': ['landlord', 'nag'],
  '我們以前齁，發燒也照樣去上班。': ['landlord', 'nag'],
  '去吧，看到我就想跑。': ['landlord', 'shoo'],
  '被他說中了。我有點不好意思，只好點點頭。': ['landlord', 'shoo'],
  '記得下禮拜要交房租。': ['landlord', 'remind_rent'],
  // 超商：店長罵過期便當、受不了；店員道歉、低頭
  '這個昨天就過期了，你是沒在看喔？': ['storeManager', 'scold_bento'],
  '客人拿到櫃檯才發現，你要我怎麼跟人家講？': ['storeManager', 'scold_bento'],
  '講幾遍了，上架前先看日期，你到底有沒有在聽？': ['storeManager', 'exasperated'],
  '對不起。': ['clerk', 'sorry_bow'],
  '對不起有用的話，我還要請你來幹嘛？': ['storeManager', 'exasperated'],
  '店員低著頭，手上還拿著那個過期的便當。': ['clerk', 'downcast'],
  // 坤伯院子：瞇眼看罐子、不好意思
  '蛤？': ['kunbo', 'squint_bottle'],
  '旁邊這罐才是肥料，還沒開。': ['kunbo', 'squint_bottle'], // （畫面：坤伯把罐子拿過去，拿得很遠，瞇著眼睛看。）
  '……我老花眼鏡放在屋裡啦。': ['kunbo', 'sheepish'],
  '兩罐長得一模一樣，誰分得出來。': ['kunbo', 'sheepish'],
  '這桶我本來就還沒有要用啊。': ['kunbo', 'sheepish'],
  // 傍晚咖啡館：坤伯掏龍眼乾；花斑貓撥袋子裡的龍眼乾
  '這個給妳們啦，我自己焙的龍眼乾。': ['kunbo', 'offer_longan'],
  '早上那個齁……不要跟別人講捏。': ['kunbo', 'sheepish'],
  '來，這顆給妳。': ['kunbo', 'offer_longan'],
  '德叔，你也吃啦，站在那邊幹嘛。': ['kunbo', 'offer_longan'],
  '花斑貓跳上椅子，用手去撥袋子裡的龍眼乾。': ['calico', 'paw'],
  '一顆龍眼乾滾到桌上，牠自己嚇了一跳。': ['calico', 'paw'],
};
// 這一句要出誰的立繪：{ who, variant, src（參照）, alt, place } 或 null（德叔、我、旁白另外處理）
export function cueOf(b) {
  if (!b) return null;
  const hit = Object.prototype.hasOwnProperty.call(LINE_CUES, b.text) ? LINE_CUES[b.text] : null;
  const who = hit ? hit[0] : b.who;
  const slot = CHAR_SLOTS[who];
  if (!slot) return null;
  const variant = hit ? hit[1] : null;
  return { who, variant, src: refOf(slot, variant), alt: CHAR_ALT[who], place: who === 'calico' ? 'cat' : 'half' };
}
const CALICO = { sit: refOf('ch_calico'), jump: refOf('ch_calico', 'jump'), walk: refOf('ch_calico', 'walk') };
// 花斑貓的三個姿勢疊在一起，由 data-pose 決定顯示哪一張（sit 底卡／jump 跳下／walk 往前走）
const calicoImgs = () => Object.entries(CALICO).map(([pose, ref]) => `<img class="cv-${pose}" src="${art(ref)}" alt="" aria-hidden="true">`).join('');
// 怡君角色卡：缺點版用 flawed_v4（承峰 2026-11-14 17:02 換進遊戲）；第一天洗臉，鏡子裡是帶缺點的角色卡
export const YIJUN_CARD = {
  base: 'char_v3b_yijun_card_v2',
  flawed: 'char_v3b_yijun_card_flawed_v4',
  better: 'char_v3b_yijun_card_better_v2',
  bites: 'char_v3b_yijun_card_bites',
};
export function yijunCardFor(act) {
  if (act === 'd1wake') return YIJUN_CARD.flawed;
  return YIJUN_CARD.base;
}
// 預載：場景、鏡子裡的角色卡、鑰匙、德叔微笑，加上 v5.6 定版圖（半身＋差分、花斑貓、小圖）
export const DAY_ART = [...new Set([...Object.values(PLACES).map((p) => p.src).filter(Boolean), YIJUN_CARD.flawed, 'key', 'char_deshu_smile',
  ...ART_MAP_FILES.filter((r) => r.startsWith('art-v56/'))])];

// 這一幕會用到哪些場景（照出現順序）
export function placesOf(lines) {
  const out = [];
  for (const b of lines) if (b.set?.place && !out.includes(b.set.place)) out.push(b.set.place);
  return out;
}

export function makeStage(root) {
  root.hidden = false;
  const token = (root._token = (root._token || 0) + 1);
  const alive = () => root._token === token;
  const stage = (name, html) => {
    for (const old of root.querySelectorAll('.op-stage')) { old.classList.remove('on'); setTimeout(() => old.remove(), 700); }
    const el = document.createElement('section');
    el.className = `op-stage op-${name}`;
    el.innerHTML = html;
    root.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    return el;
  };
  return { alive, stage };
}

// 第一天的空信箱：定版圖 scene_mailboxes_empty（1950×1200 橫圖，8 欄 × 6 列，門都關著、沒有信封）。
// 這一幕的圖框是 1950/1200（.dy-place.mbox，整張圖放進框裡、不裁），所以百分比＝相對「原圖」的位置。
// 可點的是中間偏右、第 3 列（由上往下、從 0 算）第 6 欄那一格：原圖約 x 1183–1375、y 620–738。
// 點了這一格的門往外打開，裡面是深色的空格口（不長信封、不出單子）。熱點比格子各邊多 MAILBOX_PAD，方便點。
export const MAILBOX_HOT_CELL = { left: 60.7, top: 51.7, width: 9.8, height: 9.8 };
export const MAILBOX_PAD = 1;
const pct = (n) => `${+n.toFixed(2)}%`;
function mailboxSlot() {
  const c = MAILBOX_HOT_CELL, p = MAILBOX_PAD;
  const w = c.width + 2 * p, h = c.height + 2 * p;
  const hit = `left:${pct(c.left - p)};top:${pct(c.top - p)};width:${pct(w)};height:${pct(h)}`;
  const hole = `left:${pct((p / w) * 100)};top:${pct((p / h) * 100)};width:${pct((c.width / w) * 100)};height:${pct((c.height / h) * 100)}`;
  return `<div class="dy-mailslot" id="dy-mailslot" style="${hit}"><span class="dy-mb-hole" style="${hole}" aria-hidden="true"><span class="dy-mb-door"></span></span></div>`;
}

function placeHtml(key, act) {
  const p = PLACES[key];
  return `<div class="dy-place${p.tone ? ` ${p.tone}` : ''}${p.fit ? ` ${p.fit}` : ''}" data-place="${key}" data-slot="${p.slot}"><div class="op-art">
    ${p.src ? `<img class="op-art-img" src="${art(p.src)}" alt="">` : `<div class="dy-css dy-css-${key}" aria-hidden="true"></div>`}
    ${p.basin ? `<div class="dy-basin" aria-hidden="true"><div class="dy-mirror"><img class="dy-face" src="${art(yijunCardFor(act))}" alt="" aria-hidden="true"><span class="dy-fog"></span></div><div class="dy-sink"></div></div>
      <div class="dy-faucet" id="dy-faucet"></div><span class="dy-water" aria-hidden="true"></span>` : ''}
    ${key === 'mailbox' ? mailboxSlot() : ''}
    ${p.home ? '<span class="dy-stainspot" aria-hidden="true"></span><div class="dy-wallet" id="dy-wallet"><i></i><i></i></div><div class="dy-ddrawer" id="dy-ddrawer"><span class="dy-seal" aria-hidden="true"></span><span class="dy-book" aria-hidden="true"></span></div>' : ''}
    ${p.store ? `<div class="dy-poster" id="dy-poster"><span class="pp-overlay">${esc(OVERLAY_TEXT.poster)}</span></div>` : ''}
    ${p.village ? `<div class="dy-calico on-wall" id="dy-calico" aria-label="花斑貓" data-pose="sit">${calicoImgs()}</div>` : ''}
    ${p.yard ? `<div class="dy-emptycan" id="dy-emptycan"></div><div class="dy-fullcan" aria-hidden="true"></div><div class="dy-calico in-yard" aria-hidden="true" data-pose="sit">${calicoImgs()}</div>` : ''}
  </div></div>`;
}

/* ====================== 只有一張字卡的幕（「第二天」「三天後」）；店裡開始的一天的章名卡（第二天　回咖啡館）也用這個 ====================== */
// 回傳 { intro() → 卡片淡出後 true（換畫面了 false）, stop() }
export const CARD_MS = 1900;
export function showCard(root, act, text = DAY_CARDS[act] || '') {
  const { alive, stage } = makeStage(root);
  const el = stage('day daycard', `<div class="op-card"><p>${esc(text)}</p></div>`);
  el.dataset.act = act;
  if ([...text].length > 8) el.classList.add('long'); // 倒數字卡（我單方面辭退老闆前 N 天）比較長：字小一點、字距收一點，必要時換行，字不改
  return {
    async intro() {
      await sleep(CARD_MS);
      if (!alive()) return false;
      el.querySelector('.op-card').classList.add('out');
      await sleep(800);
      return alive();
    },
    stop() {},
  };
}

/* ====================== 整張背景圖的畫面 ====================== */
// root：#opening；act：目前這一幕；api：{ state, lines, resumed }
// 回傳 { intro(), beat(i, look), hot(name) → 可點的元素, effect(name), stop() }
export const HOT_IDS = { faucet: 'dy-faucet', mailbox: 'dy-mailslot', wallet: 'dy-wallet', deskDrawer: 'dy-ddrawer', poster: 'dy-poster', calico: 'dy-calico', can: 'dy-emptycan' };
export const HOT_LABELS = { faucet: '水龍頭', mailbox: '信箱', wallet: '錢包', deskDrawer: '抽屜', poster: '徵人海報', calico: '花斑貓', can: '空罐子' };
export function showDay(root, act, api) {
  const { alive, stage } = makeStage(root);
  const keys = placesOf(api.lines);
  const title = DAY_TITLES[act];
  const el = stage('day', `${keys.map((k) => placeHtml(k, act)).join('')}
    ${title ? `<div class="op-card" ${api.state.opening.line === 0 ? '' : 'hidden'}><p>${esc(title)}</p></div>` : ''}`);
  el.dataset.act = act;
  for (const im of el.querySelectorAll('img')) im.onerror = () => im.remove(); // 缺圖：留底色，不擋閱讀
  const ctl = {
    ambient: PLACES[keys[0]]?.ambient || 'room',
    async intro() { // 每天第一句前：章名卡
      const card = el.querySelector('.op-card');
      if (!card || card.hidden) return true;
      await sleep(1900);
      if (!alive()) return false;
      card.classList.add('out');
      await sleep(800);
      card.hidden = true;
      return alive();
    },
    beat(i, look) {
      for (const p of el.querySelectorAll('.dy-place')) p.classList.toggle('on', p.dataset.place === look.place);
      el.classList.toggle('calico-yard', look.calico === 'yard');
      // 花斑貓從圍牆上跳下來（jump），落地坐著（sit）；點了往前走（walk，見 effect）
      const wall = look.calico === 'wall';
      if (wall && !el.classList.contains('calico-wall')) {
        const cat = el.querySelector('.dy-calico.on-wall');
        if (cat && !el.classList.contains('calico-go')) { cat.dataset.pose = 'jump'; setTimeout(() => { if (cat.dataset.pose === 'jump') cat.dataset.pose = 'sit'; }, 900); }
      }
      el.classList.toggle('calico-wall', wall);
      el.classList.toggle('mini-stain', look.mini === 'stain'); // 水痕小圖疊上來時，原圖上那一段（y 1110–1640）亮一下
      el.classList.toggle('can-taken', !!look.canTaken);
      el.classList.toggle('bucket-moved', !!look.bucketMoved);
      ctl.ambient = PLACES[look.place]?.ambient || ctl.ambient;
    },
    hot(name) {
      const id = HOT_IDS[name];
      const on = el.querySelector('.dy-place.on');
      return id && on ? on.querySelector(`#${id}`) : null;
    },
    // 互動做了以後的樣子（可選的與字出來之前要先點的都在這裡）
    effect(name) {
      const on = el.querySelector('.dy-place.on');
      if (name === 'faucet') { play('water'); on?.classList.add('washing'); return true; } // 出水聲，低頭洗臉，抬頭時鏡子裡是帶缺點的角色卡
      if (name === 'mailbox') { play('door'); on?.classList.add('open'); return true; } // 鐵片門打開，裡面是空的
      if (name === 'wallet') { play('place'); setTimeout(() => play('buzz'), 700); on?.classList.add('counted'); return true; } // 把錢倒出來數，再看手機裡的戶頭餘額
      if (name === 'deskDrawer') { play('creak'); on?.classList.add('open'); return true; } // 拉開：印章在最裡面，旁邊有一本存摺
      if (name === 'poster') { play('page'); return true; } // 畫面拉近（特寫卡由 props 疊上來）
      if (name === 'calico') { // 貓往前走，她跟在後面
        play('hop');
        const cat = el.querySelector('.dy-calico.on-wall');
        if (cat) cat.dataset.pose = 'walk';
        el.classList.add('calico-go');
        return true;
      }
      if (name === 'can') { play('place'); el.classList.add('can-up'); return true; } // 拿起來，把標籤轉到正面
      return true;
    },
    stop() {},
  };
  return ctl;
}

/* ====================== 疊在閱讀框上面的一層（#op-prop） ====================== */
// 特寫卡（CSS 形狀或原圖）：存摺、資料袋、識別證、手機、報告、紙箱、相機、便條、咖啡豆罐
const CARD = {
  badge: () => `<img src="${art('prop_v3_id_badge')}" alt="">`,
  bag: () => '<div class="pp-bag"><span>重要　不要丟</span></div>',
  passbook: () => '<div class="pp-passbook"><i></i><i></i><i></i></div>',
  printing: () => '<div class="pp-passbook printing"><i></i><i></i><i></i><i></i><i></i><i></i></div>',
  phone: () => '<div class="pp-phone"><div class="pp-input" id="pp-input"><span class="pp-typed"></span></div></div>',
  report: () => '<div class="pp-report"><span class="pp-cell"></span></div>',
  box: () => '<div class="pp-box"><i class="t1"></i><i class="t2"></i><i class="t3"></i></div>',
  camera: () => '<div class="pp-camera"><span class="pp-counter" id="pp-counter"></span><span class="pp-lever" id="pp-lever"></span><span class="pp-crank" id="pp-crank"><i></i></span><span class="pp-lens"></span></div>',
  note: () => '<div class="pp-note"><i></i><i></i><i></i></div>',
  can: () => '<div class="pp-can"></div>',
  // 劇本 v5.6：徵人海報、測試品的紙袋（暫代 CSS；字由程式疊，見 art-map.js 的 OVERLAY_TEXT）
  poster: () => `<div class="pp-poster"><span class="pp-overlay">${esc(OVERLAY_TEXT.poster)}</span></div>`,
  paperbag: () => `<div class="pp-paperbag"><span class="pp-overlay">${esc(OVERLAY_TEXT.paperbag)}</span></div>`,
};
export const KEY_HINT = MUST_HINTS.keyGive; // 劇本 v5.8：引導照「通用提示規則」，提示字「把鑰匙拿給德叔」（字在 view/hints.js）
// 小圖（pp-mini）：疊在原場景上（背景不切換）；先疊上來，點一下才出下面的句子，講完收掉。不畫手。
// 每一張對到 art-map.js 的 mini_* slot：有正式圖（status ready）就放原圖，沒有就用暫代的 CSS 形狀。
export const MINI_SLOTS = { stain: 'mini_stain', passbook: 'mini_passbook', hat: 'mini_hat', label: 'mini_label', longan: 'mini_longan' };
const MINI_CSS = {
  stain: () => '<div class="mn-stain"><i></i></div>',
  passbook: () => '<div class="pp-passbook mn-passbook"><i></i><i></i><i></i></div>',
  hat: () => '<div class="mn-hat"><i></i></div>',
  label: () => `<div class="mn-label"><span class="mn-tag"><span class="pp-overlay">${esc(OVERLAY_TEXT.label)}</span></span></div>`,
  longan: () => '<div class="mn-longan"><i></i><i></i></div>',
};
export function miniHtml(kind) {
  const src = srcOf(MINI_SLOTS[kind]);
  // 空罐子：標籤留白（原圖 1024×1024 的 x 285–712、y 533–862），「農藥」由程式疊在留白中央（.mn-on-art）
  const overlay = kind === 'label' ? `<span class="pp-overlay mn-on-art">${esc(OVERLAY_TEXT.label)}</span>` : '';
  if (src) return `<img src="${art(src)}" alt="">${overlay}`; // 正式圖：字一樣由程式疊
  return MINI_CSS[kind] ? MINI_CSS[kind]() : '';
}
export const FILM_START = 19; // 計數窗停在 19
export const FILM_END = 36; // 後面還有十七張
export const REWIND_TURNS = 2; // 倒片：畫兩圈（可以慢慢轉）
export const TAPE_TIMES = 3; // 撕膠帶：點三次

export function createProps(layer, app) {
  let kind = null;
  let mini = null;
  let film = FILM_START;
  let cleanups = [];
  const card = layer.querySelector('.pp-card');
  const miniEl = layer.querySelector('.pp-mini');
  const extra = layer.querySelector('.pp-extra');
  const flash = layer.querySelector('.pp-flash');
  const base = () => app.getBoundingClientRect();
  const filmHud = layer.querySelector('.pp-film');
  const counter = () => { // 計數窗：相機特寫卡上，與騎車時右上角的小窗
    const c = card.querySelector('#pp-counter');
    if (c) c.textContent = String(film);
    filmHud.textContent = String(film);
  };
  const clean = () => { cleanups.forEach((f) => f()); cleanups = []; extra.innerHTML = ''; };
  const button = (cls, label, html = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('aria-label', label);
    b.innerHTML = html;
    extra.appendChild(b);
    return b;
  };
  // 拖曳：放開時在 target(rect) 裡面就成功；否則彈回原位。鍵盤 Enter／Space 直接算放上去。
  const draggable = (el, { target, onDrop, onMiss }) => {
    let start = null;
    el.style.touchAction = 'none';
    const back = () => { el.style.transition = 'transform .35s ease'; el.style.transform = ''; };
    el.onpointerdown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture?.(e.pointerId);
      start = { x: e.clientX, y: e.clientY };
      el.style.transition = 'none';
      el.classList.add('held');
    };
    el.onpointermove = (e) => {
      if (!start) return;
      el.style.transform = `translate(${e.clientX - start.x}px, ${e.clientY - start.y}px)`;
    };
    const up = (e) => {
      if (!start) return;
      start = null;
      el.classList.remove('held');
      const r = el.getBoundingClientRect();
      const t = target();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (t && cx >= t.left && cx <= t.right && cy >= t.top && cy <= t.bottom) { if (onDrop(el) === false) back(); }
      else { back(); onMiss?.(el); }
      e.stopPropagation();
    };
    el.onpointerup = up;
    el.onpointercancel = up;
    el.onclick = (e) => e.stopPropagation();
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (onDrop(el) === false) back(); } };
  };
  const zone = (cls) => { const z = document.createElement('div'); z.className = `pp-zone ${cls}`; extra.appendChild(z); return z; };

  const api = {
    // 這一句的特寫卡（look.prop）；相機計數窗（look.counter）
    show(look) {
      if (look.film) film = Math.max(film, Math.min(FILM_END, look.film)); // 稿上寫了快到底／扳不動：計數窗至少到那裡
      const k = look.prop || null;
      if (k !== kind) {
        kind = k;
        card.className = `pp-card${k ? ` on ${k}` : ''}`;
        card.innerHTML = k && CARD[k] ? CARD[k]() : '';
      }
      const m = look.mini || null; // 小圖：疊上來／收掉（背景不動）
      if (m !== mini && miniEl) {
        mini = m;
        miniEl.className = `pp-mini${m ? ` on mini-${m}` : ''}`;
        miniEl.dataset.kind = m || '';
        miniEl.innerHTML = m ? miniHtml(m) : '';
      }
      layer.classList.toggle('counter', !!look.counter);
      counter();
      layer.hidden = false;
    },
    get film() { return film; },
    // 快門：快門聲、畫面閃一下白、計數窗跳一格（到底就扳不動）
    shoot() {
      if (film >= FILM_END) { play('tick'); return false; }
      film++;
      play('shutter');
      flash.classList.remove('go');
      void flash.offsetWidth;
      flash.classList.add('go');
      counter();
      return true;
    },
    // 可選互動（拖曳類與疊在卡上的）：掛上去，換句時自動拿掉。回傳 true＝有掛東西
    optional(name, ctx = {}) {
      if (name === 'keyGive' || name === 'gateCard') { // 鑰匙遞給德叔／識別證刷閘門：放開都回到手上
        const isKey = name === 'keyGive';
        const el = button(`pp-drag ${isKey ? 'key' : 'badge'}`, isKey ? '鑰匙' : '識別證', `<img src="${art(isKey ? 'key' : 'prop_v3_id_badge')}" alt="">`);
        const z = zone(isKey ? 'to-deshu' : 'to-gate');
        draggable(el, {
          target: () => z.getBoundingClientRect(),
          onDrop: () => {
            if (isKey) play('keys'); // 德叔兩手都在豆子裡，沒有接
            else { play('beep'); z.classList.remove('red'); void z.offsetWidth; z.classList.add('red'); } // 嗶一聲長音，紅燈，閘門不開
            return false; // 一樣回到手上
          },
          onMiss: () => isKey && play('keys'),
        });
        return true;
      }
      if (name === 'reply') { // 點輸入框：打字「我兩點到」送出
        const box = card.querySelector('#pp-input');
        if (!box) return false;
        box.classList.add('live');
        box.onclick = async (e) => {
          e.stopPropagation();
          if (box.classList.contains('sent')) return;
          box.classList.add('sent');
          const t = box.querySelector('.pp-typed');
          for (const ch of '我兩點到') { t.textContent += ch; play('key'); await sleep(110); }
          play('send');
        };
        cleanups.push(() => { box.classList.remove('live'); box.onclick = null; });
        return true;
      }
      if (name === 'lever') { // 過片扳手：喀、喀兩聲，扳手彈回
        const lv = card.querySelector('#pp-lever');
        if (!lv) return false;
        lv.classList.add('live');
        lv.onclick = (e) => {
          e.stopPropagation();
          play('key');
          setTimeout(() => play('key'), 180);
          lv.classList.remove('flick');
          void lv.offsetWidth;
          lv.classList.add('flick');
        };
        cleanups.push(() => { lv.classList.remove('live'); lv.onclick = null; });
        return true;
      }
      if (name === 'shutter' || name === 'focus') { // 快門（可拍幾張都行）；對焦環左右拖曳，對清楚再拍
        layer.classList.add('counter');
        counter();
        const sh = button('pp-shutter', '快門');
        sh.onclick = (e) => { e.stopPropagation(); api.shoot(); };
        if (name === 'focus') {
          const ring = button('pp-focus', '對焦環', '<i></i>');
          let blur = 6;
          const set = () => { app.style.setProperty('--focus-blur', `${blur}px`); ring.style.setProperty('--turn', `${(6 - blur) * 30}deg`); };
          app.classList.add('focusing');
          set();
          let sx = null;
          ring.style.touchAction = 'none';
          ring.onpointerdown = (e) => { e.stopPropagation(); ring.setPointerCapture?.(e.pointerId); sx = e.clientX; };
          ring.onpointermove = (e) => { if (sx == null) return; blur = Math.max(0, Math.min(8, blur - (e.clientX - sx) / 18)); sx = e.clientX; set(); };
          ring.onpointerup = () => { sx = null; };
          ring.onclick = (e) => e.stopPropagation();
          ring.onkeydown = (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); blur = Math.max(0, Math.min(8, blur + (e.key === 'ArrowRight' ? -1 : 1))); set(); } };
          cleanups.push(() => app.classList.remove('focusing'));
        }
        return true;
      }
      if (name === 'stroke') { // 按住龍眼的頭，從頭順著背拖到尾巴（ctx.rect：龍眼在畫面上的位置）
        const pad = button('pp-stroke', '龍眼');
        let from = null;
        let done = false;
        const place = () => {
          const r = ctx.rect?.(base());
          if (!r) { pad.hidden = true; return; }
          pad.hidden = false;
          const w = Math.max(88, r.w * 1.2);
          const h = Math.max(44, r.h * 0.6);
          Object.assign(pad.style, { left: `${r.x + r.w / 2 - w / 2}px`, top: `${r.y + r.h * 0.2}px`, width: `${w}px`, height: `${h}px` });
        };
        place();
        const id = setInterval(place, 200);
        pad.style.touchAction = 'none';
        pad.onpointerdown = (e) => { e.stopPropagation(); pad.setPointerCapture?.(e.pointerId); from = e.clientX; pad.style.setProperty('--k', '0'); };
        pad.onpointermove = (e) => {
          if (from == null || done) return;
          const k = Math.min(1, Math.abs(e.clientX - from) / pad.offsetWidth);
          pad.style.setProperty('--k', k.toFixed(2)); // 手拖到哪，他的背就拱到哪
          if (k >= 0.8) { done = true; play('purr'); ctx.onDone?.(); pad.classList.add('done'); } // 拖到尾巴：尾巴從掌心滑出去
        };
        pad.onpointerup = () => { from = null; };
        pad.onclick = (e) => e.stopPropagation();
        pad.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !done) { e.preventDefault(); done = true; play('purr'); ctx.onDone?.(); pad.classList.add('done'); } };
        cleanups.push(() => clearInterval(id));
        return true;
      }
      return false;
    },
    // 關卡：做完才 resolve(true)；換畫面時 cancel 讓它 resolve(false)
    gate(name) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => { if (settled) return; settled = true; resolve(ok); };
        cleanups.push(() => finish(false));
        if (name === 'passbook' || name === 'badge') { // 存摺拖到櫃檯／識別證放到櫃檯（無不做選項）
          const isBook = name === 'passbook';
          const el = button(`pp-drag ${isBook ? 'book' : 'badge'}`, isBook ? '存摺' : '識別證', isBook ? '<div class="pp-passbook"><i></i><i></i><i></i></div>' : `<img src="${art('prop_v3_id_badge')}" alt="">`);
          const z = zone('counter-top');
          draggable(el, {
            target: () => z.getBoundingClientRect(),
            onDrop: async () => {
              el.disabled = true;
              el.classList.add('placed');
              z.classList.add('ok');
              if (isBook) { play('copier'); await sleep(1200); play('copier'); await sleep(900); } // 印表機一行一行刷，持續很久
              else { play('place'); await sleep(500); } // 塑膠卡碰到大理石檯面的一聲
              finish(true);
              return true;
            },
          });
          return;
        }
        if (name === 'keyGive') { // 第一天早上：把鑰匙拖向德叔：他兩手都在豆子裡，沒有接，鑰匙回到手上；拖向吧台：檯面被竹篩佔滿，放不下去，一樣回到手上
          const hint = document.createElement('p'); // 引導（通用提示規則）：鑰匙發光，箭頭指向德叔，提示字「把鑰匙拿給德叔」
          hint.className = 'pp-hint';
          hint.textContent = KEY_HINT;
          extra.appendChild(hint);
          const el = button('pp-drag key', '鑰匙', `<img src="${art('key')}" alt="">`);
          const toDeshu = zone('to-deshu');
          const toBar = zone('to-bar');
          const inside = (r, z) => { const t = z.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2; return cx >= t.left && cx <= t.right && cy >= t.top && cy <= t.bottom; };
          const back = () => { play('keys'); hint.remove(); setTimeout(() => finish(true), 700); return false; }; // 回到手上，再出下一句
          draggable(el, {
            target: () => { // 德叔或吧台都算拖過去了
              const r = el.getBoundingClientRect();
              return inside(r, toBar) ? toBar.getBoundingClientRect() : toDeshu.getBoundingClientRect();
            },
            onDrop: () => { el.disabled = true; return back(); },
          });
          return;
        }
        if (name === 'tape') { // 點紙箱上的膠帶，要點三次才撕完
          const box = card.querySelector('.pp-box');
          let n = 0;
          const hit = button('pp-tape', '膠帶');
          hit.onclick = (e) => {
            e.stopPropagation();
            if (n >= TAPE_TIMES) return;
            n++;
            play('tape');
            box?.classList.add(`torn${n}`);
            if (n >= TAPE_TIMES) { hit.disabled = true; setTimeout(() => finish(true), 600); }
          };
          return;
        }
        if (name === 'rewind') { // 按住退片鈕，畫圈轉倒片搖桿；轉到最後忽然變輕，空轉
          const crank = button('pp-rewind', '倒片搖桿', '<i></i>');
          let turned = 0;
          let last = null;
          let lastSound = 0;
          const center = () => { const r = crank.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
          const add = (deg) => {
            turned += Math.abs(deg);
            crank.style.setProperty('--a', `${turned}deg`);
            const now = performance.now();
            if (now - lastSound > 260) { lastSound = now; play('rewind'); }
            if (turned >= REWIND_TURNS * 360) { crank.disabled = true; crank.classList.add('free'); play('tick'); setTimeout(() => finish(true), 500); }
          };
          crank.style.touchAction = 'none';
          crank.onpointerdown = (e) => { e.stopPropagation(); crank.setPointerCapture?.(e.pointerId); const [cx, cy] = center(); last = Math.atan2(e.clientY - cy, e.clientX - cx); };
          crank.onpointermove = (e) => {
            if (last == null || crank.disabled) return;
            const [cx, cy] = center();
            const a = Math.atan2(e.clientY - cy, e.clientX - cx);
            let d = ((a - last) * 180) / Math.PI;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            last = a;
            add(Math.min(40, Math.abs(d)));
          };
          crank.onpointerup = () => { last = null; };
          crank.onclick = (e) => e.stopPropagation();
          crank.onkeydown = (e) => { if (['Enter', ' ', 'ArrowRight', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); add(90); } };
          return;
        }
        finish(false);
      });
    },
    // 小圖已經疊上來：玩家點一下（畫面任何地方，或 Enter／Space）才 resolve(true)；換句、換畫面時 resolve(false)。
    // 剛疊上來的一小段時間（PEEK_ARM_MS）不收點：翻到這一句的那一下不會直接把小圖點掉。
    peek() {
      return new Promise((resolve) => {
        let settled = false;
        const armed = performance.now() + PEEK_ARM_MS;
        const finish = (ok) => { if (settled) return; settled = true; removeEventListener('keydown', key); resolve(ok); };
        const hit = button('pp-peek', '下一句');
        miniEl?.classList.add('ask');
        const go = () => { if (performance.now() < armed) return; play('tap'); miniEl?.classList.remove('ask'); finish(true); };
        hit.onclick = (e) => { e.stopPropagation(); go(); };
        const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
        addEventListener('keydown', key);
        cleanups.push(() => { miniEl?.classList.remove('ask'); finish(false); });
      });
    },
    // 字出來之前要點的東西（疊在 #op-prop 上的按鈕）：atm＝點存摺放進提款機、keyBar＝點包包裡的鑰匙放到吧台上。點了 resolve(true)
    // opts.target：店內定景上的吧台檯面元素（shop-still.js 的 hot('bar')）；有的話虛線框就框在畫面上真正的吧台上
    tapItem(name, opts = {}) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => { if (settled) return; settled = true; resolve(ok); };
        const isBook = name === 'atm';
        const el = button(`pp-drag pp-tapitem ${isBook ? 'book' : 'key'}`, isBook ? '存摺' : '鑰匙',
          isBook ? '<div class="pp-passbook"><i></i><i></i><i></i></div>' : `<img src="${art('key')}" alt="">`);
        el.dataset.id = name;
        // 鑰匙放到吧台：虛線框「吧台」框在店內定版圖（v2）右側吧台的檯面上（一排杯子與磨豆機）；點鑰匙或把鑰匙拖進框裡都算。
        // 量不到吧台（例如不在店內定景）才退回 CSS 的預設位置
        const bar = isBook ? null : zone('bar-drop');
        if (bar) bar.dataset.label = '吧台';
        const t = bar && opts.target?.getBoundingClientRect();
        if (t && t.width) {
          const b0 = base(); // #op-prop 鋪滿 app
          const h = Math.max(44, t.height); // 檯面很薄：框至少 44 高，置中在檯面上
          Object.assign(bar.style, { left: `${Math.round(t.left - b0.left)}px`, top: `${Math.round(t.top - b0.top + t.height / 2 - h / 2)}px`,
            width: `${Math.round(t.width)}px`, height: `${Math.round(h)}px` });
          bar.classList.add('on-bar');
        }
        const place = async () => {
          if (el.disabled) return;
          el.disabled = true;
          el.classList.add('placed');
          bar?.classList.add('ok');
          if (isBook) play('place'); else play('keys'); // 存摺放進機器／鑰匙放到吧台上
          await sleep(500);
          finish(true);
        };
        if (bar) draggable(el, { target: () => bar.getBoundingClientRect(), onDrop: () => { place(); return true; } });
        el.onclick = (e) => { e.stopPropagation(); place(); };
        cleanups.push(() => finish(false));
      });
    },
    clear() { clean(); },
    hide() {
      clean(); kind = null; mini = null; card.className = 'pp-card'; card.innerHTML = '';
      if (miniEl) { miniEl.className = 'pp-mini'; miniEl.innerHTML = ''; miniEl.dataset.kind = ''; }
      layer.classList.remove('counter'); layer.hidden = true; app.classList.remove('focusing');
    },
  };
  return api;
}
export const PEEK_ARM_MS = 300;
