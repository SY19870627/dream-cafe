// v3b 入口：開場第一幕到第四幕（劇本 v3.8／v3.9）→ 第一晚自白 → 第一～四天（劇本 v4.4）→ 第四天睡著後待續。
// 每晚自白結束、睡著時自動存檔（讀檔從隔天早上接著）；只有睡前自白期間才有獨立的「跳過自白」按鈕，點一下跳完整段（見 view/reader.js 的 skip）。其他地方不能跳過。
// 三天 AVG 閱讀（story/script.js、final-source.json、下面的「故事閱讀」）保留不刪，但只有 phase === 'story' 才會畫，執行畫面不會走到。
// 沒有泡咖啡操作、機關、佈置模式、溫度計、倒數、自動跨天：每一句都由玩家點（或 Enter／Space）推進。
// 劇本規則在 story/script.js、讀到哪一頁與選項在 story/state.js（純邏輯，有單元測試）；美術代號只查 story/manifest.js。
import * as S from './story/state.js';
import { load, persist as saveTo, resetFromUrl } from './story/save.js';
import { BACKGROUNDS, PORTRAITS, FOCUS, OLD_LADY, artUrl } from './story/manifest.js';
import { showOpening, showScene } from './view/opening.js';
import { showDay, showCard, createProps, PLACES, HOT_LABELS, cueOf, sbHintTop } from './view/days.js';
import { showShop, resetPet } from './view/shop-still.js';
import { createReader } from './view/reader.js';
import { GATE_HINTS, tapHint, isStoryboard } from './view/hints.js';
import { unlock, play, setAmbient, setEngine, setMusic, setMuted, isMuted, setHidden } from './view/audio.js';
import { musicAt } from './story/music.js'; // 【待定】每一幕／每一句的音樂（曲目表與路徑只在那個檔）
import { loadAudioPref, saveAudioPref } from './story/audio-pref.js'; // 【待定】靜音選擇（獨立鍵 dream-cafe.audio，不寫進存檔）
import { preload, preloadIdle, warm } from './view/art.js';
import { BOOT_ART, LATER_ART, actArt } from './view/boot-art.js';
import { sceneAt, OPENING_CARDS } from './lines/opening.js';
import { DAY_ACT_VIEW, DAY_TITLES, SHOP_STILL_ACTS, tapsOf } from './lines/days.js';
import { debugOn } from './debug/flag.js'; // 只有這個除錯檔是靜態載入；面板本身在 ?debug=1 時才動態 import()

const $ = (id) => document.getElementById(id);
let timeScale = 1; // 等待時間的倍率：平常是 1；只有 ?debug=1 面板的「快轉」會改成 1/5（CSS 動畫／轉場由面板調倍速）
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * timeScale));
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
// 劇本字原樣顯示；開頭的稿件標記（【待定】等）不顯示（只用在保留的三天 AVG 模組；可玩流程的字已經去掉標記）
const fmt = (t) => esc(String(t).replace(/^(【(待定|待確認|新增互動)】)+/, ''));

let source = null;
let state = null;
const save = () => saveTo(state);

let token = 0; // 換畫面時讓上一段還在等的流程作廢
let logOpen = false;
let renderedId = null; // 閱讀框裡「玩家眼前那一頁」的 id；沒有顯示閱讀頁時是 null（淡入淡出中、開場）
const gate = S.createGate();
const shown = { bg: null, portrait: null, focus: null }; // 目前畫面上的東西（沒變就不重建，避免閃）

addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });
for (const ev of ['pointerup', 'touchend', 'click']) addEventListener(ev, unlock, { capture: true }); // 【待定】iOS 有時只認 touchend／click 這類手勢
document.addEventListener('visibilitychange', () => setHidden(document.hidden)); // 【待定】切走分頁暫停、回來恢復（靜音中不恢復音樂）
// 這一幕第 line 句的音樂（titled：章名卡已出現）
const music = (act, line, opt) => setMusic(musicAt(act, line, opt)); // 【待定】

/* ---------- 靜音鍵（右上角；全部靜音：音樂、音效、環境聲） ---------- */
const muteBtn = $('mute'); // 【待定】
const showMute = () => { const m = isMuted(); muteBtn.classList.toggle('off', m); muteBtn.setAttribute('aria-pressed', String(!m)); }; // 【待定】aria-pressed＝聲音開著
setMuted(loadAudioPref().muted); // 【待定】
showMute(); // 【待定】
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'keydown']) muteBtn.addEventListener(ev, (e) => e.stopPropagation()); // 【待定】不讓這一下變成翻頁
muteBtn.addEventListener('click', (e) => { // 【待定】
  e.preventDefault(); // 【待定】
  e.stopPropagation(); // 【待定】
  setMuted(!isMuted()); // 【待定】
  saveAudioPref({ muted: isMuted() }); // 【待定】
  showMute(); // 【待定】
  muteBtn.blur(); // 【待定】焦點離開：之後按 Enter 不會又切換靜音
}); // 【待定】

function fadeThen(fn, color = '#1a1612', ms = 650) {
  const f = $('fade');
  f.style.background = color;
  f.style.transitionDuration = `${Math.max(600, ms)}ms`;
  f.classList.add('on');
  return sleep(ms).then(() => { fn(); return sleep(80); }).then(() => f.classList.remove('on'));
}

// 換畫面：清掉上一個畫面的 UI 與流程（跟網址 ?reset=1 清存檔無關，那個在開機的 resetFromUrl）
function reset() {
  token++;
  renderedId = null;
  sceneCtl?.stop();
  sceneCtl = null;
  cloth(false);
  reader.hide();
  props.hide();
  $('op-read').classList.remove('nobox');
  $('app').classList.remove('focusing');
  $('opening').hidden = true;
  $('story').hidden = true;
}

function go() {
  reset();
  if (state.phase === 'opening') return opening();
  render({ forward: false });
}

/* ---------- 開場（劇本 v3.8 第一幕～第四幕）與第一～四天（劇本 v4.4）；每一幕、每一句都存檔，只往前 ---------- */
// 第一幕～第二幕：DOM 畫面整幕自己處理（view/opening.js 的 showOpening）
// 第三幕～第一晚：閱讀框一句一句（view/reader.js），畫面是店內 2D 定景（view/shop-still.js）或 DOM 畫面（view/opening.js 的 showScene）
// 第一～四天：同一套閱讀框；店裡用店內 2D 定景，其他地方用整張背景圖（view/days.js 的 showDay），特寫與關卡在 #op-prop
// 店內環景（canvas 2.5D）與「看看店裡」已拔掉（承峰 2026-11-21 20:48）
// 每晚自白最後一句（睡著）一出現就存成隔天早上；第四天睡著後是「待續」。不會進三天故事。
const reader = createReader($('op-read'), $('app'));
const props = createProps($('op-prop'), $('app'));
// DOM 畫面整幕自己處理的幕：開場（辦公室、標題、收到信、信、特休前一晚）與接回場（resend，開場同一間辦公室）
const DOM_ACTS = ['office', 'title', 'mailbox', 'letter', 'eve', 'resend'];
// 開機讀檔後第一次進畫面：讀檔落在倒數字卡或其後，先重出這一段最近的字卡（S.resumeCardOf），再回原句。開場（還沒有字卡）不出。
// 跳關（除錯面板）、換幕都不再出（只有開機這一次）。
let resumeCard = true;
const SHOP_ACTS = ['deshu', 'sit', 'coffee', 'stay'];
let sceneCtl = null; // 目前的 DOM 畫面（換畫面時停掉動畫與計時器）
let clothTimer = 0; // 布擦杯子：擦一兩下就停（承峰 2026-11-23 22:07 v510 第 4 項：不循環）
let clothOn = false;

function cloth(on) {
  if (!on) { clearTimeout(clothTimer); clothTimer = 0; clothOn = false; return; }
  if (clothOn) return;
  clothOn = true;
  play('cloth');
  clothTimer = setTimeout(() => { clothTimer = 0; play('cloth'); }, 900); // 再一下就停
}

function opening() {
  const act = state.opening.act;
  if (resumeCard) { // 開機讀檔：先重出這一段最近的字卡（字卡淡出後再進原本那一幕、原本那一句）
    resumeCard = false;
    const card = S.resumeCardOf(state);
    if (card) return replayCard(card);
  }
  music(act, state.opening.line); // 【待定】進幕那一刻的音樂（讀檔落在幕中間也對得上：幕內切點照句子算）
  if (act === S.END_ACT) return openingScene('end'); // 研發咖啡之後（帶咖啡去公司之前）：待續
  if (DAY_ACT_VIEW[act] === 'card') return dayCard(act);
  if (OPENING_CARDS[act]) return dayCard(act, OPENING_CARDS[act]); // 開場的倒數字卡（前 4 天、前 2 天）
  if (SHOP_ACTS.includes(act) || SHOP_STILL_ACTS.includes(act)) return openingShop(act); // 店內 2D 定景（第一天起的店裡也是 still，背景是店內靜照）
  if (DAY_ACT_VIEW[act] === 'still') return dayScene(act);
  if (DOM_ACTS.includes(act)) {
    setAmbient(act === 'office' || act === 'resend' ? 'hum' : null);
    showOpening($('opening'), act, {
      state,
      persist: save,
      // 換幕：先存檔；fade＝淡出淡入（信讀完、接回場按「下班」）
      go: (a, opt = {}) => { if (S.setOpeningAct(state, a)) { save(); if (opt.fade) fadeThen(go, '#0d0b0a', 900); else go(); } },
    });
    return;
  }
  return openingScene(act);
}

// 讀檔時重出的字卡：只是看，不改存檔；淡出後回到存檔那一幕
async function replayCard(card) {
  const my = token;
  reader.hide();
  props.hide();
  setAmbient(null);
  music(card, 0); // 【待定】字卡播「下一幕開場那一刻」的音樂狀態（尚未解鎖就先記著，第一次點擊後 2.5 秒淡入）
  const ctl = showCard($('opening'), card, S.CARD_TEXTS[card]);
  sceneCtl = ctl;
  const ok = await ctl.intro();
  if (!ok || my !== token) return;
  fadeThen(go, '#0d0b0a', 650);
}

// 換到下一幕（淡出淡入）
function nextAct(from, color, ms) {
  if (!S.setOpeningAct(state, S.nextActOf(from))) return;
  save();
  fadeThen(go, color, ms);
}
// 睡著（自白讀完，或點了「跳過自白」直接睡）：存檔已經在 runLines 做了（隔天早上／待續），這裡只淡出再進下一幕
function fallAsleep() {
  reader.hide();
  props.hide();
  return fadeThen(go, '#0d0b0a', 1600);
}

// 「字出來之前要先做的互動」時畫面的樣子：還是上一句的地方、特寫卡與花斑貓，小圖不疊（小圖那一步才疊上來）
function preLook(lines, i) {
  const lk = sceneAt(lines, i);
  if (i <= 0) return { ...lk, prop: null, mini: null };
  const pv = sceneAt(lines, i - 1);
  return { ...lk, place: pv.place ?? lk.place, prop: pv.prop ?? null, calico: pv.calico ?? null, mini: null };
}

// 分鏡格的提示字（承峰 2026-11-25：桌機貓靠近時提示壓在地上的龍眼上）：不放在閱讀框上緣，改貼著分鏡格——
// 單格放在格子正上方（格子下面常有坤伯等半身立繪、地上的貓）；直排（上方沒空間）放在最後一個亮著的格子正下方。
// 位置算法在 view/days.js 的 sbHintTop；#op-prop 與 #op-read 都鋪滿 #app，座標相同。
function sbHint(on) {
  const read = $('op-read');
  const y = on ? sbHintTop(document.querySelector('#op-prop .pp-mini.on.sb')) : null;
  read.classList.toggle('sb-hint', y != null);
  if (y != null) read.style.setProperty('--sb-hint-top', `${y}px`);
}
// 分鏡格自動亮起（刷存摺第 1 格：存摺插進機器）之後，停多久才亮下一格、出字
const PANEL_AUTO_MS = 1500;
// 一幕裡的句子：從存檔那一句接著；每一句說完點一下才出下一句（不點就停在這一句）
// look(i, 畫面樣子, 句子)：把畫面擺成第 i 句的樣子；gate(name)：互動關卡；optional(name)：可選互動的熱點；
// tap(name)：這一句的字出來之前要先做的互動（lines/days.js 的 tap：小圖點一下、點錢包、點抽屜……），做完 resolve(true)。pause（停一拍）由這裡處理。
// 回傳 true＝這一幕讀完；'slept'＝睡著了（自白最後一句，或點了「跳過自白」），已經存成下一幕；false＝換畫面了
async function runLines(act, { look, gate, optional, tap }) {
  const my = token;
  const lines = S.ACT_LINES[act];
  let i = state.opening.line;
  while (i >= 0 && i < lines.length) {
    const b = lines[i];
    const lk = sceneAt(lines, i);
    if (b.ifTap) { // 可點可不點（信箱）：熱點發光；點了才出這一句，點畫面其他地方就不出這一句，直接接下一句
      props.clear();
      props.show(lk);
      look(i, lk, b);
      reader.skip(false);
      reader.hideBox();
      const tapped = await new Promise((res) => {
        reader.hot((optional?.(b.ifTap, b) || []).map((h) => ({ ...h, onTap: () => { h.onTap(); res('tap'); reader.cancel(); } })));
        reader.next().then((v) => res(v ? 'skip' : false));
      });
      reader.clearHot();
      if (my !== token || !tapped) return false;
      if (tapped === 'tap') { await sleep(650); if (my !== token) return false; }
      else { // 不點：這一句不出，直接接下一句（存檔照樣往前）
        const n = S.nextLine(state);
        if (n < 0) return true;
        if (!S.setOpeningLine(state, n)) return false;
        save();
        i = n;
        continue;
      }
    }
    for (const t of tapsOf(b)) { // 字先不出來：先做完這些（讀檔回到這一句要重做）
      // panel／panelAuto：只在這一句字出來之前亮的分鏡格（b.panel）；畫面停在上一句的樣子（第一句就用這一句的），不帶這一句的說話人立繪
      const panel = t === 'panel' || t === 'panelAuto';
      const shown = t === 'mini' ? lk : panel ? { ...(i > 0 ? sceneAt(lines, i - 1) : lk), mini: b.panel } : preLook(lines, i);
      props.clear();
      props.show(shown);
      look(i, shown, panel ? {} : b);
      reader.clearHot();
      reader.skip(false);
      reader.hideBox();
      reader.passive();
      reader.hint(tapHint(t, shown)); // 提示字（通用提示規則，必做不加「也可以直接翻頁」）；有熱點的會由 reader.hot 再設一次同一句
      sbHint(t === 'panel' || (t === 'mini' && isStoryboard(shown.mini))); // 分鏡格的「點一下繼續」放在格子正下方，不壓到地上的貓、立繪
      const ok = t === 'pause' ? await reader.next()
        : t === 'panel' ? await props.peek() // 點一下收起，才出這一句
          : t === 'panelAuto' ? (await sleep(PANEL_AUTO_MS), my === token) // 自己亮、不佔點擊（刷存摺第 1 格），停一下接下一格
            : await tap?.(t, b);
      sbHint(false);
      reader.clearHot();
      if (my !== token || !ok) return false;
    }
    props.clear();
    props.show(lk);
    look(i, lk, b);
    music(act, i, { titled: true }); // 【待定】幕內切點（d1store 下決心那句升回 100%、d5thanks 入夜那句換 cafe）：跟畫面同一拍
    for (const n of b.sfx || []) play(n);
    if (b.wait) { // 先聽聲音，字晚一點出來
      reader.hideBox();
      reader.passive();
      await sleep(b.wait);
      if (my !== token) return false;
    }
    reader.show(b);
    reader.skip(!!b.mono); // 只有睡前自白（mono）才顯示「跳過自白」，與翻一句分開
    if (b.sleep && S.sleepThrough(state)) save(); // 睡著：這一句一出現就自動存檔成隔天早上（第四天是待續）
    let ok;
    if (b.gate) {
      reader.clearHot();
      reader.passive();
      reader.hint(GATE_HINTS[b.gate]); // 把門推開／按住畫面，往前騎／點左邊或右邊的路（鑰匙拿給德叔的提示由 props.gate 自己畫）
      ok = await gate(b.gate, b);
      if (ok && my === token) S.passGate(state, b.gate); // 岔路在 gate 裡已經記下選擇
    } else {
      reader.hot(b.optional ? optional(b.optional, b) : []);
      ok = await reader.next();
    }
    reader.clearHot();
    if (my !== token) return false;
    if (ok === 'skip') { // 點了「跳過自白」：剩下的自白不再一句一句出，直接睡著並存檔
      if (S.skipMonologue(state)) save();
      return 'slept';
    }
    if (!ok) return false;
    if (b.sleep) return 'slept';
    const n = S.nextLine(state);
    if (n < 0) return true;
    if (!S.setOpeningLine(state, n)) return false;
    save();
    i = n;
  }
  return true;
}

// 熱點範圍：DOM 元素
const elRect = (el) => (base) => {
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height } : null;
};

/* ---------- 三合院外、黑路、岔路、廟、庭埕與房間、待續 ---------- */
// 房間這一幕第 i 句的環境聲：開頭是房間底噪（room）；「外面有蟲在叫」那一句起換成句子上的 ambient（小聲蟲鳴）。讀檔落在後面的句子也對得上。
function roomAmbient(i) {
  let amb = ['room', 1];
  for (const b of (S.ACT_LINES.room || []).slice(0, Math.max(0, i) + 1)) if (b.ambient) amb = b.ambient;
  return amb;
}

async function openingScene(act) {
  const my = token;
  const ctl = showScene($('opening'), act, {
    state,
    chooseFork: (side) => { const ok = S.chooseFork(state, side); if (ok) save(); return ok; },
    restart,
  });
  sceneCtl = ctl;
  if (act === 'end') { setAmbient(null); reader.hide(); props.hide(); return; }
  if (act === 'ride' || act === 'fork' || act === 'temple') { setAmbient('engine'); setEngine(0); }
  else if (act === 'room') setAmbient(...roomAmbient(state.opening.line));
  else if (act === 'road' || act === 'depart') setAmbient('insects', 0.6); // 三合院外（熄火後、發動前）：夏夜蟲鳴（承峰 2026-11-23 22:07 v510 第 5 項，不再用風聲）
  else setAmbient('wind', 0.45);

  if (act === 'depart') { // 點機車「發動」：引擎聲、車燈亮、轉到路上（不點就留在三合院外）
    reader.hide();
    const ok = await ctl.gate('start');
    if (!ok || my !== token) return;
    return nextAct('depart', '#000', 900);
  }
  if (act === 'road' && state.opening.line === 0) { // （機車引擎聲，熄火）只有聲音，沒有轉場字
    reader.hide();
    const ok = await ctl.intro();
    if (!ok || my !== token) return;
  }
  const done = await runLines(act, {
    look: (i, lk) => { ctl.beat(i, lk); if (act === 'room') setAmbient(...roomAmbient(i)); },
    gate: (name) => ctl.gate(name),
    optional: (name) => (name === 'bed' ? [{
      id: 'bed', label: '床', rect: elRect(ctl.hot('bed')),
      onTap: () => ctl.lieDown().then(() => { if (my === token) reader.advance(); }), // 玩家點床：躺下去，翻到下一句
    }] : []),
  });
  if (!done || my !== token) return;
  if (done === 'slept') return fallAsleep(); // 第一晚睡著：淡出，直接進第一天早上（已存檔）
  if (act === 'ride') { S.setOpeningAct(state, 'fork'); save(); return go(); } // 同一條路接著騎到岔路
  nextAct(act, act === 'road' || act === 'return' ? '#f3dfb8' : '#000', act === 'temple' ? 1100 : 650);
}

/* ---------- 店裡（推門之後、點椅子坐下、喝咖啡、晚上回來；第一天起的店裡）：店內 2D 定景（view/shop-still.js） ---------- */
// 店內環景與「看看店裡／回座位」已拔掉（承峰 2026-11-21 20:48）：背景是一張靜照（進門／站著用店內定版圖 SHOP_STILL_NIGHT／SHOP_STILL_DAY；點椅子坐下後 coffee 用靠窗特寫 SHOP_STILL_SEATED，見 art-map.js），
// 德叔不說話時、龍眼、桌上的杯子疊在上面；點椅子、摸龍眼、點杯子都是 2D 熱點（熱點跟著畫面上的元素走，不再算環景投影）。
// 德叔立繪、閱讀框、音效照舊：開場依 set.portrait；第一天起德叔開口的那一句出立繪（坤伯、花斑貓依台詞出半身／貓圖）。
async function openingShop(act) {
  const my = token;
  const day = !!DAY_ACT_VIEW[act];
  setAmbient(null); // 店裡安靜：不再循環 shop 底噪，只在德叔磨豆那一句播一次 grind（約 5 秒，承峰 2026-11-23 22:07 v510 第 6 項）
  if (day && state.opening.line === 0 && DAY_TITLES[act]) { // 店裡開始的一天（第二天　回咖啡館）：先出章名卡
    reader.hide();
    const card = showCard($('opening'), act, DAY_TITLES[act]);
    sceneCtl = card;
    const ok = await card.intro();
    if (!ok || my !== token) return;
  }
  const shop = showShop($('opening'), act, { seated: act === 'coffee' }); // 坐下喝咖啡：德叔不在畫面裡（說話時出立繪，站右手邊）
  sceneCtl = shop;
  if (act === 'sit') {
    // 點椅子坐下（必做，承峰 23:14「保留，改在 2D 圖上點」）：那張看得到的椅子發光加箭頭，提示字「點椅子坐下」。
    // 點了才坐下（進 coffee）；不點就留在進門定景，點其他地方不會坐下。不自動坐下，也不轉鏡頭。
    reader.hide();
    shop.beat({ deshu: 'stand', cat: 'feet', cup: true, night: 1 });
    $('op-read').classList.add('nobox'); // 沒有閱讀框：提示字放低一點，不蓋在椅子上
    reader.passive();
    reader.hideBox();
    reader.hot([{ id: 'chair', label: '椅子', need: true, rect: elRect(shop.hot('chair')),
      onTap: () => {
        if (my !== token) return;
        reader.clearHot();
        play('place');
        nextAct('sit', '#3a2a20');
      } }]);
    return;
  }
  const done = await runLines(act, {
    look: (i, lk, b) => {
      // 第一～四天：德叔說話時（與把鑰匙遞給他的那一下）出立繪，畫面裡的德叔不畫（不會同時兩個德叔）
      const portrait = day ? (b.who === 'deshu' || b.gate === 'keyGive') : lk.portrait;
      shop.beat(portrait ? { ...lk, deshu: null } : lk);
      // 晚上回來：德叔拿著掃把；坐下喝咖啡時德叔站到右手邊（aside），不擋住桌上的杯子；劇本寫德叔微笑的那一句用微笑的立繪
      const face = b.face === 'smile' ? 'char_deshu_smile' : PORTRAITS.deshu.src;
      const cue = day && !portrait ? cueOf(b) : null; // 第一～四天：坤伯說話出半身立繪（依台詞切差分）；花斑貓撥龍眼乾
      if (cue) reader.portrait(cue.src, cue.place, cue.alt);
      else reader.portrait(portrait ? (act === 'stay' ? 'char_deshu_broom' : face) : null, act === 'coffee' ? 'aside' : 'center');
      cloth(!!lk.cloth);
    },
    gate: (name) => dayGate(name), // 第一天早上把鑰匙拖向德叔（立繪）或吧台方位
    tap: (name) => { // 店裡：小圖點一下（斗笠、龍眼乾）、點包包裡的鑰匙放到吧台
      if (name === 'mini') return props.peek();
      if (name === 'keyBar') return props.tapItem('keyBar', { target: shop.hot('bar') }); // 放置目標框在店內定版圖的吧台檯面上
      return Promise.resolve(true);
    },
    optional: (name) => {
      if (name === 'cat') { // 摸摸龍眼：手入鏡摸頭、頭頂上來、呼嚕
        return [{ id: 'cat', label: '龍眼', rect: elRect(shop.hot('cat')), onTap: () => { shop.pet(); play('purr'); } }];
      }
      if (name === 'cup') { // 點杯子喝一口
        return [{ id: 'cup', label: '杯子', rect: elRect(shop.hot('cup')),
          onTap: () => { shop.sip(); setTimeout(() => play('sip'), 350); setTimeout(() => play('place'), 1400); } }];
      }
      return [];
    },
  });
  cloth(false);
  if (!done || my !== token) return;
  const last = S.ACT_LINES[act].at(-1);
  if (last?.linger) { // 最後一句之後停一拍再淡出（德叔的微笑）：先存成下一幕（字卡出現前自動存檔），字收起來、立繪留著
    if (!S.setOpeningAct(state, S.nextActOf(act))) return;
    save();
    reader.hideBox();
    reader.passive();
    await sleep(last.linger);
    if (my !== token) return;
    reader.hide();
    props.hide();
    return fadeThen(go, '#0d0b0a', 1100);
  }
  reader.hide();
  if (day) { props.hide(); return nextAct(act, '#1a1612', 750); }
  nextAct(act, act === 'stay' ? '#0d0b0a' : act === 'coffee' ? '#000' : '#3a2a20', act === 'stay' ? 900 : 650);
}

/* ---------- 字卡（倒數字卡、「第二天」「三天後」）：只有一張卡，淡出後進下一幕 ---------- */
async function dayCard(act, text) {
  const my = token;
  reader.hide();
  props.hide();
  setAmbient(null);
  const ctl = showCard($('opening'), act, text);
  sceneCtl = ctl;
  const ok = await ctl.intro();
  if (!ok || my !== token) return;
  nextAct(act, '#0d0b0a', 650);
}

/* ---------- 第一天起：整張背景圖的畫面（view/days.js） ---------- */
async function dayScene(act) {
  const my = token;
  const lines = S.ACT_LINES[act];
  warm(actArt(lines)); // 這一幕的背景如果背景預載還沒輪到，現在先開始抓
  const ctl = showDay($('opening'), act, { state, lines });
  sceneCtl = ctl;
  let ambient = null;
  if (state.opening.line === 0 && DAY_TITLES[act]) { // 每天開頭：章名卡
    reader.hide();
    setAmbient('room');
    music(act, 0, { titled: true }); // 【待定】章名卡出現時：d1wake 的 day 2 秒淡入（開場先靜）
    const ok = await ctl.intro();
    if (!ok || my !== token) return;
  }
  let current = {};
  const done = await runLines(act, {
    look: (i, lk, b) => {
      current = lk;
      ctl.beat(i, lk);
      const amb = PLACES[lk.place]?.ambient || 'room';
      if (amb !== ambient) { ambient = amb; setAmbient(amb === 'quiet' ? null : amb, amb === 'room' ? 1 : 0.6); } // 'quiet'（信箱）：不放環境聲
      const cue = cueOf(b); // 房東、店長、店員、坤伯：半身立繪，依台詞切差分（沒對上的句子用底卡）
      reader.portrait(cue ? cue.src : null, cue?.place, cue?.alt);
    },
    gate: (name) => dayGate(name),
    // 字出來之前要先做的：小圖、分鏡格點一下；點徵人海報、花斑貓、空罐子（場景上的熱點）
    tap: (name) => {
      if (name === 'mini') return props.peek();
      const el = ctl.hot(name);
      if (!el) return Promise.resolve(true); // 找不到熱點也不卡住
      return new Promise((res) => reader.hot([{ id: name, label: HOT_LABELS[name] || name, need: true, rect: elRect(el),
        onTap: () => { ctl.effect(name); if (name === 'poster') props.show({ ...current, prop: 'poster' }); setTimeout(() => res(my === token), 650); } }]));
    },
    optional: (name) => { // 可選（不做也能翻頁）：水龍頭、信箱
      const label = HOT_LABELS[name];
      const el = label ? ctl.hot(name) : null;
      if (!el) return [];
      return [{ id: name, label, rect: elRect(el), onTap: () => ctl.effect(name) }];
    },
  });
  if (!done || my !== token) return;
  reader.hide();
  props.hide();
  nextAct(act, act === 'd1bank' ? '#000' : '#1a1612', 750); // v5.9：提款機淡出到黑底，超商那一幕前三句在黑底上
}

// 第一天起的關卡（lines/days.js 目前沒有 gate；互動都是「字出來之前要先做的」tap）：保留給 props.gate 的拖曳類關卡
async function dayGate(name) {
  const r = await props.gate(name);
  return r === true;
}

// 從開頭再看一次（只重設 v3b 自己的存檔；不碰 v3a 與第一版的鍵）
function restart() {
  resetPet();
  state = S.newStoryState();
  save();
  fadeThen(go, '#15171c');
}

/* ---------- 故事閱讀（三天 AVG 模組；執行畫面不會進來，phase === 'story' 才畫） ---------- */
// 店內背景也是整張靜照（BACKGROUNDS 的 shopMorning／shopEvening 是 kind: 'still'，不再進環景）
function renderBackground(page) {
  const bg = BACKGROUNDS[page.background] || BACKGROUNDS.shopMorning;
  const holder = $('st-bg');
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
  const bg = renderBackground(page);
  setAmbient(bg.ambient, page.ambientLevel);
  if (forward) for (const name of page.sfx) play(name);
  $('story').hidden = false;
  renderPortrait(page);
  renderFocus(page);
  $('st-scene').innerHTML = page.sceneTitle ? fmt(page.sceneTitle) : '';
  if (page.kind === 'end') { // 結尾：只留背景與回顧（環視已拔掉）
    $('st-box').hidden = true;
    $('st-choices').hidden = true;
    renderedId = null;
    return;
  }
  renderText(page, pages);
  renderedId = page.id;
}

// 推頁一律用畫面上正在顯示的那一頁 id：還沒畫出來（例如開場淡出中按 Enter）或已換頁的舊點擊都不會多推
function tryAdvance() {
  if (state.phase !== 'story' || logOpen || !renderedId || $('story').hidden) return;
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
$('log-close').onclick = closeLog;
$('log').addEventListener('click', (e) => e.stopPropagation());
$('log').addEventListener('pointerdown', (e) => e.stopPropagation());

/* ---------- 開機 ---------- */
// 順序：網址 ?reset=1 →（要的話）清存檔 → load() → playable() → save() → 只等開場＋店內的圖 → 開機畫面 → 背景載第一天以後的圖
fetch('src/story/final-source.json')
  .then((r) => r.json())
  .then((json) => {
    source = json;
    resetFromUrl(); // ?reset=1：清 dream-cafe.v3b、把 reset 從網址拿掉（debug=1 等其他參數留著）
    state = S.playable(load(source)); // 舊版存到三天故事裡的存檔：回到開場開頭（不接著播第一天）
    save();
    return preload(BOOT_ART);
  })
  .then(() => {
    $('boot').remove();
    go();
    if (debugOn(location.search)) startDebug();
    preloadIdle(LATER_ART); // 第一天以後的圖：閒置時在背景載（換幕前 dayScene 還會再補那一幕的背景）
  });

/* ---------- 除錯（網址帶 ?debug=1 才有；沒帶時不載入、不碰 DOM、不發請求） ---------- */
// 跳關：換成 jumpState 給的新狀態（覆蓋這台裝置的存檔），整個畫面重來
function debugJump(act, line) {
  const s = S.jumpState(state, act, line);
  if (!s) return false;
  state = s;
  resetPet();
  save();
  $('fade').classList.remove('on');
  go();
  return true;
}
function startDebug() {
  import('./debug/ui.js')
    .then((m) => m.start({
      app: $('app'),
      getState: () => state,
      beat: () => S.beatAt(state),
      jump: debugJump,
      setTimeScale: (k) => { timeScale = k > 0 ? k : 1; },
    }))
    .catch((e) => console.warn('除錯面板載入失敗', e));
}
