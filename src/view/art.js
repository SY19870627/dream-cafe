// 畫師美術（assets/art/*.webp）：只讀取、照原檔顯示，不修改、不重新壓縮。
const cache = new Map();

export function img(name) {
  if (cache.has(name)) return cache.get(name);
  const im = new Image();
  im.decoding = 'async';
  im.src = `assets/art/${name}.webp`;
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
// 開場（v3.8）：辦公室、信箱、信封與鑰匙、店裡的貓與晚上的窗；
// 三合院外觀（傍晚／晚上）、機車（未發動／發動／車燈）、夜路上車燈照到的鐵皮工寮與土地公廟、庭埕（晚上）、護龍房間（畫師 v3b 原圖）
export const OPENING_ART = [
  'scene_office_night', 'scene_mailboxes', 'envelope', 'key', 'cat_longan_walk', 'window_night_clear',
  'scene_v3b_sanheyuan_dusk', 'scene_v3b_sanheyuan_night', 'prop_v3b_scooter_off', 'prop_v3b_scooter_on', 'prop_v3b_scooter_beam',
  'prop_v3b_iron_shed_night', 'prop_v3b_tudigong_night', 'scene_v3b_courtyard_night', 'scene_v3b_room_night',
];
