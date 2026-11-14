// 第一天到第四天的 DOM 畫面（劇本 v4.5）：
//   showDay()：整張背景圖的畫面（護龍早上、洗手台、租屋處、信箱、銀行、辦公大樓、郵局、省道、阿桂的攤子、果園、店門口、庭埕、房間、躺下）。
//     字由閱讀框（view/reader.js）一句一句出；這裡只負責「第 i 句時長什麼樣子」與可點的位置（水龍頭、電燈開關、信箱、抽屜、衣服、報告）。
//   createProps()：疊在閱讀框上面的一層（#op-prop）：特寫卡（存摺、識別證、相機……）、要拖的東西、關卡、兩個按鈕。店內 360 與整張背景圖都用這一層。
// 美術：畫師原圖只讀不改（不重新壓縮、不縮圖）。沒有對應原圖的場景先用最接近的圖（見 docs/v3b-缺圖清單.md），缺的道具用簡單的 CSS 形狀；不以程式畫人形。鏡子裡放怡君角色卡原圖。
import { DAY_TITLES, PASSBOOK_CHOICES } from '../lines/days.js';
import { OLD_LADY } from '../story/manifest.js';
import { play } from './audio.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const art = (name) => `assets/art/${name}.webp`;

// 場景 → 用哪張原圖（fallback 標 *，記在 docs/v3b-缺圖清單.md）
//   tone：morning 早上／dusk 傍晚（只在顯示時疊一層光，不改原圖）；fit：wide＝橫式原圖（信箱）
//   lady：老太太遠景（小、不可點、不標示），座標沿用 story/manifest.js 的 OLD_LADY
export const PLACES = {
  roomMorning: { src: 'scene_v3b_room_night', tone: 'morning', ambient: 'room' }, // * 護龍早上
  basin: { src: 'scene_v3b_room_night', tone: 'morning', ambient: 'room', basin: true }, // * 洗手台與舊鏡子（CSS）
  roomNight: { src: 'scene_v3b_room_night', ambient: 'room' },
  bed: { src: 'scene_v3b_bed_pov_night', ambient: 'room' },
  courtyard: { src: 'scene_v3b_courtyard_night_v2', ambient: 'wind' },
  road: { src: 'scene_county_road', ambient: 'wind' }, // * 下山、省道
  street: { src: 'scene_county_road', ambient: 'wind' }, // * 郵局門口、超商門口
  mailbox: { src: 'scene_mailboxes', fit: 'wide', ambient: 'wind' }, // 租屋處信箱（沿用開場第二幕）
  home: { src: 'scene_v3_rain_room', ambient: 'room', home: true }, // * 租屋處房間
  homeDusk: { src: 'scene_v3_rain_room', tone: 'dusk', ambient: 'room' }, // * 租屋處房間（傍晚）
  bank: { src: 'scene_v3_office_lobby', ambient: 'lobby', lady: 'companyLobby' }, // * 銀行大廳
  lobby: { src: 'scene_v3_office_lobby', ambient: 'lobby', lady: 'companyLobby' }, // 辦公大樓一樓大廳
  meeting: { src: 'scene_v3_office_lobby', ambient: 'lobby', lady: 'companyLobby', report: true }, // * 會議室
  elevator: { src: 'scene_v3_office_lobby', ambient: 'lobby' }, // * 電梯口
  post: { src: 'scene_v3_office_lobby', ambient: 'lobby' }, // * 郵局櫃檯
  stall: { src: 'scene_county_road', tone: 'dusk', ambient: 'wind' }, // * 阿桂的水果攤
  orchard: { src: 'scene_county_road', tone: 'dusk', ambient: 'wind', lady: 'road' }, // * 果園、水塔
  shopDusk: { src: 'scene_v3b_sanheyuan_dusk_v2', ambient: 'wind', lit: true }, // 咖啡店外（傍晚，門裡的燈亮著）
};
// 怡君角色卡：缺點版用 flawed_v4（承峰 2026-11-14 17:02 換進遊戲）
export const YIJUN_CARD = {
  base: 'char_v3b_yijun_card_v2',
  flawed: 'char_v3b_yijun_card_flawed_v4',
  better: 'char_v3b_yijun_card_better_v2',
  bites: 'char_v3b_yijun_card_bites',
};
export function yijunCardFor(act) {
  if (act === 'd1wake') return YIJUN_CARD.flawed;
  if (act === 'd4wake') return YIJUN_CARD.bites;
  return YIJUN_CARD.better; // 第二天、第三天：雀斑與黑眼圈都沒了，氣色較好
}
export const DAY_ART = [...new Set([...Object.values(PLACES).map((p) => p.src), ...Object.values(YIJUN_CARD), 'prop_v3_id_badge', 'key', OLD_LADY.src])];

// 這一幕會用到哪些場景（照出現順序）
export function placesOf(lines) {
  const out = [];
  for (const b of lines) if (b.set?.place && !out.includes(b.set.place)) out.push(b.set.place);
  return out;
}

function makeStage(root) {
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

function placeHtml(key, act) {
  const p = PLACES[key];
  const lady = p.lady ? OLD_LADY.places[p.lady] : null;
  return `<div class="dy-place${p.tone ? ` ${p.tone}` : ''}${p.fit ? ` ${p.fit}` : ''}${p.lit ? ' lit' : ''}" data-place="${key}"><div class="op-art">
    <img class="op-art-img" src="${art(p.src)}" alt="">
    ${lady ? `<img class="dy-lady" src="${art(OLD_LADY.src)}" alt="" aria-hidden="true" style="left:${lady.x * 100}%;top:${(lady.y - lady.h) * 100}%;height:${lady.h * 100}%">` : ''}
    ${key === 'roomNight' ? `<img class="op-rm-key dy-key" src="${art('key')}" alt=""><span class="dy-can on-pillow" aria-hidden="true"></span>` : ''}
    ${key === 'bed' ? '<span class="dy-dark" aria-hidden="true"></span>' : ''}
    ${p.basin ? `<div class="dy-basin" aria-hidden="true"><div class="dy-mirror"><img class="dy-face" src="${art(yijunCardFor(act))}" alt="" aria-hidden="true"><span class="dy-fog"></span></div><div class="dy-sink"></div></div>
      <div class="dy-faucet" id="dy-faucet"></div><div class="dy-switch" id="dy-switch"></div><span class="dy-water" aria-hidden="true"></span>` : ''}
    ${key === 'mailbox' ? '<div class="dy-mailslot" id="dy-mailslot"><span class="dy-slip" aria-hidden="true"></span></div>' : ''}
    ${p.home ? '<div class="dy-drawer" id="dy-drawer"><span class="dy-clothes" aria-hidden="true"><i></i><i></i><i></i></span></div>' : ''}
    ${p.report ? '<div class="dy-report" id="dy-report"></div>' : ''}
    ${p.lit ? '<div class="op-glow door"></div>' : ''}
  </div></div>`;
}

/* ====================== 整張背景圖的畫面 ====================== */
// root：#opening；act：目前這一幕；api：{ state, lines, resumed }
// 回傳 { intro(), beat(i, look), hot(name) → 可點的元素, effect(name), stop() }
export function showDay(root, act, api) {
  const { alive, stage } = makeStage(root);
  const keys = placesOf(api.lines);
  const title = DAY_TITLES[act];
  const el = stage('day', `${keys.map((k) => placeHtml(k, act)).join('')}
    ${title ? `<div class="op-card" ${api.state.opening.line === 0 ? '' : 'hidden'}><p>${esc(title)}</p></div>` : ''}`);
  el.dataset.act = act;
  for (const im of el.querySelectorAll('img')) im.onerror = () => im.remove(); // 缺圖：留底色，不擋閱讀
  let drawer = 0;
  let clothes = 0;
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
      el.classList.toggle('light', !!look.light);
      el.classList.toggle('key', !!look.key);
      el.classList.toggle('can', !!look.can);
      el.classList.toggle('dark', !!look.dark);
      ctl.ambient = PLACES[look.place]?.ambient || ctl.ambient;
    },
    hot(name) {
      const id = { faucet: 'dy-faucet', switch: 'dy-switch', mailbox: 'dy-mailslot', drawer: 'dy-drawer', clothes: 'dy-drawer', report: 'dy-report' }[name];
      const on = el.querySelector('.dy-place.on');
      return id && on ? on.querySelector(`#${id}`) : null;
    },
    // 可選互動做了以後的樣子；回傳 true 表示這個互動做完了（熱點收起來）
    effect(name) {
      const on = el.querySelector('.dy-place.on');
      if (name === 'faucet') { play('water'); on?.classList.add('washing'); return true; } // 出水聲，低頭洗臉，鏡子起霧又清楚
      if (name === 'switch') { play('tick'); setTimeout(() => play('tick'), 260); el.classList.add('flicker', 'light'); return true; } // 日光燈閃兩下亮起來
      if (name === 'mailbox') { play('door'); on?.classList.add('open'); return true; } // 鐵片門打開（第四天裡面有粉紅色的單子）
      if (name === 'drawer') { // 卡住，要再點一次才拉得開
        drawer++;
        play('creak');
        on?.classList.toggle('stuck', drawer === 1);
        if (drawer >= 2) { on?.classList.add('open'); return true; }
        return false;
      }
      if (name === 'clothes') { // 一件一件撥開，底下露出資料袋
        if (!on?.classList.contains('open')) { on?.classList.add('open'); play('creak'); }
        clothes++;
        play('cloth');
        on?.classList.add(`moved${Math.min(3, clothes)}`);
        if (clothes >= 3) { on?.classList.add('bag'); return true; }
        return false;
      }
      if (name === 'report') { play('page'); return true; }
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
};
export const FILM_START = 19; // 計數窗停在 19
export const FILM_END = 36; // 後面還有十七張
export const REWIND_TURNS = 2; // 倒片：畫兩圈（可以慢慢轉）
export const TAPE_TIMES = 3; // 撕膠帶：點三次

export function createProps(layer, app) {
  let kind = null;
  let film = FILM_START;
  let cleanups = [];
  const card = layer.querySelector('.pp-card');
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
        if (name === 'choice') { // 〔把存摺放上吧台〕〔收著〕：兩邊都進到第 1 杯（剛出現的一小段時間不收點，避免翻頁的連點落在按鈕上）
          const wrap = document.createElement('div');
          wrap.className = 'pp-choices';
          const armed = performance.now() + CHOICE_ARM_MS;
          for (const c of PASSBOOK_CHOICES) {
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.id = c.id;
            b.textContent = c.text;
            b.onclick = (e) => {
              e.stopPropagation();
              if (performance.now() < armed || settled) return;
              for (const o of wrap.querySelectorAll('button')) o.disabled = true;
              play('tap');
              resolve(c.id);
              settled = true;
            };
            wrap.appendChild(b);
          }
          extra.appendChild(wrap);
          return;
        }
        finish(false);
      });
    },
    clear() { clean(); },
    hide() { clean(); kind = null; card.className = 'pp-card'; card.innerHTML = ''; layer.classList.remove('counter'); layer.hidden = true; app.classList.remove('focusing'); },
  };
  return api;
}
export const CHOICE_ARM_MS = 400;
