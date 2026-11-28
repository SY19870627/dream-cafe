// 畫師美術（assets/art/*.webp；v5.6 定版圖在 assets/art-v56/）：只讀取、照原檔顯示，不修改、不重新壓縮。
import { debugOn, onGithack, directAssetUrl } from '../debug/flag.js';
import { artUrl, srcOf, cutRefOf, SHOP_STILL_NIGHT, SHOP_STILL_SEATED, SHOP_STILL_DAY, SHOP_STILL_DUSK } from './art-map.js';
import { SHOP_CUT_READY } from './shop-cut-ready.js';
const cache = new Map();
// 只有 ?debug=1：圖用 CORS 載入（raw.githack 會把圖轉到 raw.githubusercontent.com，不加的話畫布會被汙染、回報截不了圖）。
// 一般玩家不加，載入方式和以前一樣。
const CORS = (() => { try { return debugOn(globalThis.location?.search); } catch { return false; } })();
const HREF = (() => { try { return String(globalThis.location?.href || ''); } catch { return ''; } })();

// 圖的網址：一般玩家是 assets/art/<名字>.webp（和以前一樣）；名字帶資料夾（art-v56/B/…）的是 assets/art-v56/…（見 art-map.js 的 artUrl）；
// debug 模式又在 raw.githack 上時，直接用 raw.githubusercontent 的直連網址（帶 cors=1），不走 githack 的 301，
// 和頁面 CSS 非 CORS 載入的那一份也不共用快取（見 debug/flag.js 的 directAssetUrl）
export function artSrc(name, pageHref = HREF, cors = CORS) {
  const rel = artUrl(name);
  return cors && onGithack(pageHref) ? directAssetUrl(rel, pageHref) : rel;
}

export function img(name) {
  if (cache.has(name)) return cache.get(name);
  const im = new Image();
  im.decoding = 'async';
  if (CORS) im.crossOrigin = 'anonymous';
  im.src = artSrc(name);
  cache.set(name, im);
  return im;
}
export const ready = (im) => im && im.complete && im.naturalWidth > 0;

// 先載入會用到的圖
export function preload(names) {
  return Promise.all(names.map((n) => new Promise((r) => {
    const im = img(n);
    if (ready(im)) r();
    else { im.onload = r; im.onerror = r; }
  })));
}

// 背景預載：閒置時（requestIdleCallback，沒有就 setTimeout）一小批一小批載，不跟眼前的畫面搶。全部載完（或載不到）就 resolve。
export function preloadIdle(names, { batch = 3, idle } = {}) {
  const wait = idle || ((fn) => (globalThis.requestIdleCallback ? globalThis.requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 120)));
  const list = [...new Set(names)];
  return new Promise((done) => {
    let i = 0;
    const step = () => {
      if (i >= list.length) return done();
      const part = list.slice(i, i + batch);
      i += batch;
      preload(part).then(() => wait(step));
    };
    wait(step);
  });
}
// 先開始載（不等）：換幕前叫一下，還沒輪到背景預載的圖馬上開始抓
export function warm(names) {
  for (const n of names) img(n);
}

// 店內 2D 定景（view/shop-still.js）：店內靜照（art-map.js 的 SHOP_STILL_NIGHT／SHOP_STILL_SEATED／SHOP_STILL_DAY）、德叔、龍眼、杯子、摸頭的手。
// 店內環景的貼圖（吧台、牆與地板材質、吊燈、書架、收音機……）已不引用、不預載（檔案留在 assets/art）。
export const SHOP_ART = [...new Set([
  srcOf(SHOP_STILL_NIGHT), srcOf(SHOP_STILL_SEATED), srcOf(SHOP_STILL_DAY), srcOf(SHOP_STILL_DUSK),
  'char_deshu_stand', 'char_deshu_brew', 'char_deshu_serve', 'char_deshu_broom', 'cat_longan_sleep', 'cat_longan_sit', 'cat_longan_walk', 'prop_cup',
  'char_v3b_yijun_hand_v2', 'cat_longan_headbump_v2', 'cat_longan_knead_v2', 'cat_longan_ears_turn_v2', 'cat_longan_ears_back_v2', 'cat_longan_lick_paw_v2',
  // 家具切片（裁好的小圖，不是整張透明層）：只預載已經到位的（shop-cut-ready.js），沒到的不發請求
  ...Object.entries(SHOP_CUT_READY).flatMap(([light, ids]) => Object.keys(ids).map((id) => cutRefOf(id, light))),
].filter(Boolean))];
// 開場（v3.8）：辦公室、鑰匙（房間枕頭旁）；
// 三合院外觀（傍晚／晚上）、機車（未發動／發動／車燈／路面光錐）、庭埕（晚上）、護龍房間（畫師 v3b 原圖）。
// 夜路上的鐵皮工寮與土地公廟原圖（prop_v3b_iron_shed_night_v2／prop_v3b_tudigong_night_v2）已改成分鏡格（art-v56/S，背景預載），
// 檔案留著、不再引用也不再預載；三合院的去背門（art-v56/C）也走 art-v56 的背景預載（開機不等 art-v56）
export const OPENING_ART = [
  'scene_office_night', 'key', 'cat_longan_walk',
  'scene_v3b_sanheyuan_dusk_v2', 'scene_v3b_sanheyuan_night_v2', 'prop_v3b_scooter_off_v2', 'prop_v3b_scooter_on_v2', 'prop_v3b_scooter_beam_v2',
  'scene_v3b_courtyard_night_v2', 'scene_v3b_room_night',
  // 第二批（v3b 項目 8–15）：點貓的手與頂頭、貓的各種動作、德叔拿掃把、信封滑出鑰匙、躺下的視角
  'char_v3b_yijun_hand_v2', 'cat_longan_headbump_v2', 'cat_longan_stretch_v3b_v2', 'cat_longan_knead_v2', 'cat_longan_ears_turn_v2',
  'cat_longan_ears_back_v2', 'cat_longan_lick_paw_v2', 'cat_longan_sleep_flip_v2', 'char_deshu_broom',
  'prop_v3b_envelope_key_v2', 'scene_v3b_bed_pov_night',
  // 第三批（_v2 重畫）：上面已換成 _v2 檔名；新增發動後路面的光錐（疊在機車下層）
  'prop_v3b_scooter_road_light_v2',
];
