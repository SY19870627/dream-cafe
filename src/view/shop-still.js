// 店內 2D 定景（取代已拔掉的店內環景；承峰 2026-11-21 20:48「把 3D 拿掉，查看店內景象的功能也拔除」，23:14 點頭的做法）。
// 一張整張直式靜照（1170×2532）＋疊上去的德叔（不說話時）、龍眼、桌上的杯子、點椅子坐下的那張椅子、吧台檯面。
// 背景圖只從 art-map.js 的常數來（換圖只改那裡的 src）：
//   進門／站在店裡（deshu、sit、stay、晚上回來）＝SHOP_STILL_NIGHT → scene_shop_interior_night_lit_v2（承峰 2026-11-21 23:47 定版）
//   第一天起早上的店裡＝SHOP_STILL_DAY → art-v59/scene_shop_interior_day_v1（承峰 2026-11-22 17:20 接進遊戲；與 v2 同構圖，位置共用）
//   坤伯答謝開頭（傍晚、還沒入夜）＝SHOP_STILL_DUSK → art-v59/scene_shop_interior_dusk_v1（承峰 2026-11-22 19:16 接進遊戲；同構圖）；
//     天暗下來那句交叉淡化到 SHOP_STILL_NIGHT，之後停在夜景
//   點了椅子、坐下喝咖啡（coffee，opts.seated）＝SHOP_STILL_SEATED → scene_v3b_shop_window_night_seated（靠窗特寫）
// 兩張的構圖不同，位置分兩套：*_STAND／SHOP_CHAIR／SHOP_BAR 對準 v2；SHOP_WINDOW／SHOP_CUP／CAT_2D.feetSeated／CAT_2D.across 對準靠窗特寫。
// 位置都是 .op-art 的百分比（相對 1170×2532 整張圖）。
// 沒有 canvas、沒有動畫迴圈：換動作用計時器換圖，摸頭與喝一口用 CSS 動畫。
import { makeStage } from './days.js';
import { srcOf, artUrl, SHOP_STILL_NIGHT, SHOP_STILL_SEATED, SHOP_STILL_DAY, SHOP_STILL_DUSK } from './art-map.js';

const art = (ref) => artUrl(ref);

/* ---------- 進門／站著：對準 scene_shop_interior_night_lit_v2 ---------- */
// 點椅子坐下的目標：對準 v2 左側靠窗那張桌的椅子（承峰 2026-11-22 17:15「坐下那一幕移到靠窗那張」）
// （約 x 199–491、y 1089–1620，含靠背與椅座，方便點；椅座約 y 1310–1430）
export const SHOP_CHAIR = { left: 17, top: 43, width: 25, height: 21 };
// v2 左側那扇窗的玻璃（約 x 25–355、y 470–955）：傍晚在窗裡疊一層天色（原圖窗外是晚上；早上用白天圖，不疊）
export const SHOP_WINDOW_STAND = { left: 2.1, top: 18.6, width: 28.2, height: 19.2 };
// v2 右側吧台的檯面（一排白杯子與磨豆機那條檯面，約 x 440–1170、y 880–1015）：第二天「把鑰匙放到吧台」的放置目標
export const SHOP_BAR = { left: 37.6, top: 34.8, width: 62.4, height: 5.3 };
// 吧台檯面的高度（約 y 965）：德叔站在吧台後面時，這條線以下被吧台擋住（clip）
const BAR_TOP = 38.1;
// 桌上的杯子（prop_cup，站著看）：左側靠窗桌面上、白色馬克杯盆栽的右手邊（盆栽右緣約 x 11%），
// 整杯含把手都在桌面內側、不懸在桌緣（承峰 2026-11-24 21:24）；杯底中心約 x 240、y 1220；把手朝右
export const SHOP_CUP_STAND = { x: 20.5, y: 48.2, h: 3.6 };
// 德叔不說話時站在畫面裡的樣子（立繪出來時這裡不畫，不會同時兩個德叔）：腳底中心 x、腳底 y、身高（佔原圖高）
// clip：這條 y 以下被吧台擋住（站在吧台後面；腳底在吧台後的地板約 y 1300）
export const DESHU_2D = {
  stand: { img: 'char_deshu_stand', x: 85.5, y: 51.3, h: 24, clip: BAR_TOP }, // 吧台後面、磨豆機旁
  brew: { img: 'char_deshu_brew', x: 85.5, y: 51.3, h: 24, clip: BAR_TOP },
  broom: { img: 'char_deshu_broom', x: 38, y: 70, h: 41 }, // 晚上回來：拿著掃把，站在兩張桌子之間的地上
  // 端杯子：剛把杯子放在左側靠窗桌（SHOP_CUP_STAND），人站在靠窗桌那張椅子的右手邊走道上（兩桌之間、緊貼左桌）。
  // h40 時立繪最左緣（左手）約 x 51% − 134px ≈ 463px，在左椅椅背／椅座右緣（約 450px）右邊，不疊在椅子上；
  // 手上那杯約 x 497–566px、y ~1080，離桌上杯子（約 x 176–306、杯底 y 1220）很遠；腳底 y 67% 與靠窗桌前腳同一層地板。
  serveTable: { img: 'char_deshu_serve', x: 51, y: 67, h: 40 },
};
// 龍眼：x＝貓圖中心、y＝腳線、w＝貓圖寬（佔原圖寬；貓圖都是 512×384、腳線對齊）。閱讀框蓋住原圖約 78% 以下，地上的位置放在框的上緣。
// seq：照劇本換動作（每一步的原圖、停多久；dy 是貓圖高的比例、s 是放大）
// 除了 feetSeated／across（坐下以後，對準靠窗特寫）之外都對準 v2：「那張椅子」＝吧台前中間那張紅墊椅（椅面約 x 665–930、y 1390）
export const KNEAD_ON_SLEEP_LINE = -(349 - 339) / 384; // knead_v2 腳底 y349、sleep 底線 y339：踩奶時往上移 10px
export const CAT_2D = {
  doorway: { x: 22, y: 76, w: 28, img: 'cat_longan_walk' }, // 剛進門：從鏡頭左下的地板走進來
  chair: { x: 63, y: 55, w: 22, img: 'cat_longan_sleep', seq: [ // 跳上吧台前那張椅子踩兩圈 → 趴下 → 耳朵轉過來
    { img: 'cat_longan_knead_v2', ms: 2200, dy: KNEAD_ON_SLEEP_LINE, bob: true },
    { img: 'cat_longan_sleep', ms: 1600 },
    { img: 'cat_longan_ears_turn_v2', s: 1.05 },
  ] },
  shoes: { x: 55, y: 77, w: 30, img: 'cat_longan_walk', flip: true }, // 走過來聞我的鞋（鏡頭前的地板）
  rub: { x: 48, y: 77.5, w: 32, img: 'cat_longan_walk' }, // 在我小腿上蹭（可以摸）
  feet: { x: 48, y: 77.5, w: 30, img: 'cat_longan_sit', lick: true }, // 蹭完坐在腳邊；沒摸就舔前腳（在椅子熱區下方，不擋）
  earsBack: { x: 48, y: 77.5, w: 30, img: 'cat_longan_sit', seq: [{ img: 'cat_longan_ears_back_v2', ms: 1800 }, { img: 'cat_longan_sit' }] }, // 磨豆機響：耳朵往後壓
  across: { x: 59, y: 73.5, w: 28, img: 'cat_longan_sleep', seq: [ // 坐下以後（靠窗特寫）：跳上對面那張椅子，踩兩圈，趴下
    { img: 'cat_longan_knead_v2', ms: 2400, dy: KNEAD_ON_SLEEP_LINE, bob: true },
    { img: 'cat_longan_sleep' },
  ] },
  // 坐下以後（靠窗特寫）、跳上對面椅子之前：坐在我腳邊——桌子左下、桌腳前那塊地板（原圖約 x 80–390、腳線 y 1962），
  // 在杯子（SHOP_CUP，x 38.9）左邊、不擋點杯子的熱點；沒摸就舔前腳
  feetSeated: { x: 20, y: 77.5, w: 26, img: 'cat_longan_sit', lick: true },
  nap: { x: 78, y: 51.1, w: 22, img: 'cat_longan_sleep' }, // 第一天起／坤伯答謝：趴在右側桌面上（承峰 2026-11-24 21:24）
};

/* ---------- 坐下喝咖啡：對準 scene_v3b_shop_window_night_seated（靠窗特寫，原樣沿用） ---------- */
// 窗玻璃（原圖 x 300–985、y 355–1135）
export const SHOP_WINDOW = { left: 25.6, top: 14, width: 58.5, height: 30.8 };
// 桌上的杯子（prop_cup）：杯底中心 x、杯底 y、杯高（佔原圖高）；我右手邊、把手朝右
export const SHOP_CUP = { x: 38.9, y: 72.5, h: 5.9 };
// 點貓：怡君的手從上方伸進來摸頭，龍眼把頭頂上來（headbump_v2）。手（char_v3b_yijun_hand_v2，800×600）與貓圖同比例，
// 指尖 (332,147) 對準頭頂 (205,58)：在貓框裡的位置用貓圖 512×384 的比例算（見 index.html 的 .sh-hand）
export const PET_MS = 2800;
// 預載清單在 view/art.js 的 SHOP_ART（開機要等）；這裡用到的圖都要在那裡（有單元測試）

let petted = false; // 這次開著的頁面裡摸過龍眼了（摸過就不再舔前腳）
export function resetPet() { petted = false; }

const pct = (n) => `${n}%`;
// 第 i 句的天色：morning 早上（用白天正式圖 SHOP_STILL_DAY，光線與窗外已畫好，不疊：alpha 0）／
// dusk 傍晚還沒入夜（用傍晚正式圖 SHOP_STILL_DUSK，窗外傍晚已畫好，不疊：alpha 0）／
// 晚上（night 1：夜景定版圖原圖的夜色，不再壓暗）。沒寫 tone 也沒入夜的句子照舊在夜圖窗上疊傍晚天色
export function skyOf(look = {}) {
  const night = look.night || 0;
  if ((look.tone === 'morning' || look.tone === 'dusk') && !night) return { kind: look.tone, alpha: 0 };
  const alpha = Math.max(0, 1 - night) * 0.9;
  return { kind: 'dusk', alpha: Number(alpha.toFixed(3)) };
}
// 這一句用哪一張：坐下喝咖啡＝靠窗特寫；入夜（night 為真）＝夜景定版圖；早上＝白天圖；傍晚還沒入夜＝傍晚圖
export const stillOf = (look = {}, seated = false) => {
  if (seated) return SHOP_STILL_SEATED;
  if (look.night) return SHOP_STILL_NIGHT;
  if (look.tone === 'morning') return SHOP_STILL_DAY;
  if (look.tone === 'dusk') return SHOP_STILL_DUSK;
  return SHOP_STILL_NIGHT;
};
// 換底圖要不要交叉淡化：只有同一幕裡從傍晚圖換成夜景（坤伯答謝「外面天色慢慢暗下來」）才淡；
// 進幕、跳關、第一次 beat（from 是 null）直接到這一句的圖，不從 showShop 初始的夜圖淡過去
export const fadesBetween = (from, to) => from === SHOP_STILL_DUSK && to === SHOP_STILL_NIGHT;
export const BG_FADE_MS = 1200; // 與 .sh-sky 的 1.2s 一致（index.html 的 .sh-bg-old）
// 這一張的窗與杯子位置（進門／站著＝v2；坐下＝靠窗特寫）
export const layoutOf = (seated = false) => (seated
  ? { window: SHOP_WINDOW, cup: SHOP_CUP }
  : { window: SHOP_WINDOW_STAND, cup: SHOP_CUP_STAND });
// 桌上的杯子看不看得到：坐下喝咖啡（靠窗特寫）預設一定在桌上（與舊環景的 seatedScene 一樣，不靠句子寫 cup: true；
// 句子漏寫也不會藏起來，點杯子喝一口的熱點才量得到）；只有明寫 cup: false 才藏。站著時照句子的 cup。
export const cupShown = (look = {}, seated = false) => (seated ? look.cup !== false : !!look.cup);

// root：#opening；opts.seated：坐下喝咖啡（背景換成靠窗特寫；德叔不在畫面裡，只有說話時出立繪）
// 回傳 { beat(look), hot(name) → 元素, pet(), sip(), stop() }
export function showShop(root, act, opts = {}) {
  const { stage } = makeStage(root);
  const seated = !!opts.seated;
  const c = SHOP_CHAIR;
  const b = SHOP_BAR;
  const { window: w, cup: cp } = layoutOf(seated);
  // 椅子與吧台的熱區只在 v2（站著）上有：坐下特寫不放
  const standOnly = seated ? '' : `
      <div class="sh-chair" id="sh-chair" style="left:${pct(c.left)};top:${pct(c.top)};width:${pct(c.width)};height:${pct(c.height)}"></div>
      <div class="sh-bar" id="sh-bar" style="left:${pct(b.left)};top:${pct(b.top)};width:${pct(b.width)};height:${pct(b.height)}"></div>`;
  const el = stage('shop', `<div class="op-art"><div class="sh-cam">
      <img class="op-art-img sh-bg" src="${art(srcOf(stillOf({ night: 1 }, seated)))}" alt="">
      <span class="sh-sky" aria-hidden="true" style="left:${pct(w.left)};top:${pct(w.top)};width:${pct(w.width)};height:${pct(w.height)}"></span>
      <img class="sh-deshu" alt="" aria-hidden="true" hidden>${standOnly}
      <img class="sh-cup" src="${art('prop_cup')}" alt="" hidden style="left:${pct(cp.x)};top:${pct(cp.y - cp.h)};height:${pct(cp.h)}">
      <div class="sh-cat" hidden><img class="sh-cat-img" alt="" aria-hidden="true"><img class="sh-hand" src="${art('char_v3b_yijun_hand_v2')}" alt="" aria-hidden="true"></div>
    </div></div>`);
  el.dataset.act = act;
  el.dataset.view = seated ? 'seated' : 'stand';
  for (const im of el.querySelectorAll('img')) im.addEventListener('error', () => { im.style.visibility = 'hidden'; }); // 缺圖：留底色，不擋閱讀
  const bg = el.querySelector('.sh-bg');
  const sky = el.querySelector('.sh-sky');
  const deshu = el.querySelector('.sh-deshu');
  const cup = el.querySelector('.sh-cup');
  const cat = el.querySelector('.sh-cat');
  const catImg = cat.querySelector('.sh-cat-img');
  const hand = cat.querySelector('.sh-hand');
  let timers = [];
  let catKey;
  let spot = null;
  let petTimer = 0;
  let shown = null; // 上一次 beat 用的定景（null＝這一幕還沒 beat：第一次直接換，不淡）
  let fadeTimer = 0;
  let oldBg = null; // 交叉淡化時疊在上面、正在淡掉的舊底圖
  const dropOld = () => { clearTimeout(fadeTimer); if (oldBg) oldBg.remove(); oldBg = null; };
  // 舊底圖複製一張疊在新圖上面（窗的天色、德叔、貓都在它上面），再把它淡掉：兩張圖疊著淡，不是瞬間切
  const crossFade = (fromSrc) => {
    dropOld();
    oldBg = bg.cloneNode(false);
    oldBg.classList.remove('sh-bg');
    oldBg.classList.add('sh-bg-old');
    oldBg.src = fromSrc;
    bg.after(oldBg);
    void oldBg.offsetWidth;
    oldBg.style.opacity = '0';
    fadeTimer = setTimeout(dropOld, BG_FADE_MS + 100);
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const step = (st) => {
    const src = art(st.img);
    if (catImg.getAttribute('src') !== src) catImg.src = src;
    catImg.style.transform = `translateY(${((st.dy || 0) * 100).toFixed(2)}%) scale(${st.s || 1})`;
    cat.classList.toggle('bob', !!st.bob);
  };
  const rest = () => step({ img: spot.lick && !petted ? 'cat_longan_lick_paw_v2' : spot.img });
  const setCat = (key) => {
    if (key === catKey) return;
    catKey = key;
    clearTimers();
    spot = CAT_2D[key] || null;
    if (!spot) { cat.hidden = true; return; }
    cat.hidden = false;
    Object.assign(cat.style, { left: pct(spot.x - spot.w / 2), width: pct(spot.w), top: `calc(${pct(spot.y)} - ${spot.w} * var(--cat-h))` });
    cat.classList.toggle('flip', !!spot.flip);
    if (!spot.seq) { rest(); return; }
    let t = 0;
    for (const st of spot.seq) {
      const at = t;
      if (at === 0) step(st);
      else timers.push(setTimeout(() => step(st), at));
      if (st.ms == null) break;
      t += st.ms;
    }
  };
  const ctl = {
    beat(look = {}) {
      const id = stillOf(look, seated);
      const ref = srcOf(id);
      if (ref && bg.getAttribute('src') !== art(ref)) {
        if (fadesBetween(shown, id)) crossFade(bg.getAttribute('src'));
        else dropOld();
        bg.src = art(ref);
      }
      shown = id;
      el.dataset.frame = look.frame || 'counter';
      const s = skyOf(look);
      sky.dataset.kind = s.kind;
      sky.style.opacity = String(s.alpha);
      const d = !seated && look.deshu ? DESHU_2D[look.deshu] : null;
      deshu.hidden = !d;
      if (d) {
        if (deshu.getAttribute('src') !== art(d.img)) deshu.src = art(d.img);
        // 站在吧台後面：吧台檯面以下切掉（被吧台擋住）
        const clip = d.clip != null ? `inset(0 0 ${(((d.y - d.clip) / d.h) * 100).toFixed(1)}% 0)` : '';
        Object.assign(deshu.style, { left: pct(d.x), top: pct(d.y - d.h), height: pct(d.h), clipPath: clip });
      }
      cup.hidden = !cupShown(look, seated);
      setCat(look.cat || null);
    },
    // 熱點目標元素（藏起來時量不到大小，熱點自己不出現；見 main.js 的 elRect）
    hot(name) {
      if (name === 'chair') return el.querySelector('#sh-chair');
      if (name === 'bar') return el.querySelector('#sh-bar'); // 吧台檯面（第二天把鑰匙放到吧台的放置目標）
      if (name === 'cat') return cat;
      if (name === 'cup') return cup;
      return null;
    },
    // 點貓：手入鏡摸頭、頭頂上來（摸完坐著，不再舔前腳）
    pet() {
      if (!spot) return;
      petted = true;
      clearTimers();
      step({ img: 'cat_longan_headbump_v2' });
      hand.classList.remove('go');
      void hand.offsetWidth;
      hand.classList.add('go');
      clearTimeout(petTimer);
      petTimer = setTimeout(() => { hand.classList.remove('go'); if (spot) rest(); }, PET_MS);
    },
    // 拿起杯子喝一口
    sip() {
      cup.classList.remove('sip');
      void cup.offsetWidth;
      cup.classList.add('sip');
    },
    stop() { clearTimers(); clearTimeout(petTimer); dropOld(); },
  };
  return ctl;
}
