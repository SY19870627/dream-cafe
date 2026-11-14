// 畫師美術（assets/art/*.webp）：只讀取、照原檔顯示，不修改、不重新壓縮。
import { debugOn, onGithack, directAssetUrl } from '../debug/flag.js';
const cache = new Map();
// 只有 ?debug=1：圖用 CORS 載入（raw.githack 會把圖轉到 raw.githubusercontent.com，不加的話店內 360 的畫布會被汙染、回報截不了圖）。
// 一般玩家不加，載入方式和以前一樣。
const CORS = (() => { try { return debugOn(globalThis.location?.search); } catch { return false; } })();
const HREF = (() => { try { return String(globalThis.location?.href || ''); } catch { return ''; } })();

// 圖的網址：一般玩家一律是 assets/art/<名字>.webp（和以前一樣）；
// debug 模式又在 raw.githack 上時，直接用 raw.githubusercontent 的直連網址（帶 cors=1），不走 githack 的 301，
// 和頁面 CSS 非 CORS 載入的那一份也不共用快取（見 debug/flag.js 的 directAssetUrl）
export function artSrc(name, pageHref = HREF, cors = CORS) {
  const rel = `assets/art/${name}.webp`;
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

export const SHOP_ART = [
  'char_deshu_stand', 'char_deshu_brew', 'char_deshu_serve', 'cat_longan_sleep', 'cat_longan_sit', 'backbar',
  'window_day_clear', 'chair', 'prop_cup', 'pendant_lamp', 'kettleSet', 'plant', 'radio', 'bookshelf', 'tex_counter_front',
  'tex_wall_plaster', 'tex_floor_wood', 'tex_wood_top',
];
// 開場（v3.8）：辦公室、信箱、鑰匙（房間枕頭旁）、店裡的貓與晚上的窗；
// 三合院外觀（傍晚／晚上）、機車（未發動／發動／車燈／路面光錐）、夜路上車燈照到的鐵皮工寮與土地公廟、庭埕（晚上）、護龍房間（畫師 v3b 原圖）
export const OPENING_ART = [
  'scene_office_night', 'scene_mailboxes', 'key', 'cat_longan_walk', 'window_night_clear',
  'scene_v3b_sanheyuan_dusk_v2', 'scene_v3b_sanheyuan_night_v2', 'prop_v3b_scooter_off_v2', 'prop_v3b_scooter_on_v2', 'prop_v3b_scooter_beam_v2',
  'prop_v3b_iron_shed_night_v2', 'prop_v3b_tudigong_night_v2', 'scene_v3b_courtyard_night_v2', 'scene_v3b_room_night',
  // 第二批（v3b 項目 8–15）：點貓的手與頂頭、貓的各種動作、德叔拿掃把、靠窗木桌、信封滑出鑰匙、躺下的視角、坐下看得到窗的夜景
  'char_v3b_yijun_hand_v2', 'cat_longan_headbump_v2', 'cat_longan_stretch_v3b_v2', 'cat_longan_knead_v2', 'cat_longan_ears_turn_v2',
  'cat_longan_ears_back_v2', 'cat_longan_lick_paw_v2', 'cat_longan_sleep_flip_v2', 'char_deshu_broom', 'prop_v3b_window_table',
  'prop_v3b_envelope_key_v2', 'scene_v3b_bed_pov_night', 'scene_v3b_shop_window_night_seated',
  // 第三批（_v2 重畫）：上面已換成 _v2 檔名；新增發動後路面的光錐（疊在機車下層）
  'prop_v3b_scooter_road_light_v2',
];
