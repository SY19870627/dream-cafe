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
// 開場（v3.8）：辦公室、信箱、三合院外觀（暫用 scene_county_road 當佔位）、信封與鑰匙、店裡的貓與晚上的窗、護龍房間的櫃子
export const OPENING_ART = ['scene_office_night', 'scene_mailboxes', 'scene_county_road', 'envelope', 'key', 'cat_longan_walk', 'window_night_clear', 'cabinet'];
