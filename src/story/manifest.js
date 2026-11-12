// v3b 唯一美術對照表：劇本裡的 background／portrait／focus 代號 → 畫師原圖（assets/art/，只讀不改、不重新壓縮）。
// status：
//   ready —— 有原圖，src 是檔名（不含副檔名），單元測試會確認檔案存在，所以畫面不會去要不存在的圖（不 404）。
//   none  —— 沒有原圖：用 fallback 寫的方式表現（背景局部放大、中性的 CSS 形狀），不另外畫人形、不生圖。
// 交新圖時只改這裡：把該格改成 status:'ready', src:'檔名'。
import { SHOP_ART, OPENING_ART } from '../view/art.js';

export const ART_DIR = 'assets/art/';
export const artUrl = (name) => `${ART_DIR}${name}.webp`;

// 背景：店內用 360 店面（畫師材質與家具），外出用整張直式背景（1170×2532，下方約 30% 會被閱讀框蓋住）
export const BACKGROUNDS = {
  shopMorning: { status: 'ready', kind: 'pano', tone: 'morning', ambient: 'shop' },
  shopEvening: { status: 'ready', kind: 'pano', tone: 'dusk', ambient: 'shop' },
  rainRoom: { status: 'ready', kind: 'image', src: 'scene_v3_rain_room', ambient: 'rain', base: '#3a2c22' },
  hut: { status: 'ready', kind: 'image', src: 'scene_v3_mountain_hut', ambient: 'heater', base: '#3b2b20' },
  road: { status: 'ready', kind: 'image', src: 'scene_county_road', ambient: 'wind', base: '#1f1a22' },
  companyLobby: { status: 'ready', kind: 'image', src: 'scene_v3_office_lobby', ambient: 'lobby', base: '#9fb2c8' },
};

// 立繪：一次只放一個人，放大成半身；圖的下緣一律藏在閱讀框後面（不浮空、不露出切口）。
// 尺寸都是佔畫面高的比例：height＝圖高；top＝圖頂端的位置，或 bottom＝圖底端離畫面底部的距離（要小於閱讀框高度）。
// 德叔是全身圖：放大到 1.3 倍畫面高，腰以下落在閱讀框後面與畫面外。
export const PORTRAITS = {
  none: null,
  deshu: { status: 'ready', src: 'char_deshu_stand', name: '德叔', height: 1.3, top: 0.07 },
  gui: { status: 'ready', src: 'char_v3_agui_half', name: '阿桂', height: 0.7, bottom: 0.14 },
  junior: { status: 'ready', src: 'char_v3_junior_half', name: '宜蓁', height: 0.7, bottom: 0.14 },
};

// 特寫：prop＝物件原圖；zoom＝把目前背景的局部放大（x、y 是放大中心在背景上的比例位置）；phone＝中性的手機外形（不畫訊息）
export const FOCUS = {
  none: null,
  notebook: { status: 'ready', kind: 'prop', src: 'prop_v3_old_notebook' },
  badge: { status: 'ready', kind: 'prop', src: 'prop_v3_id_badge' },
  handover: { status: 'ready', kind: 'prop', src: 'prop_v3_handover_folder' },
  bag: { status: 'ready', kind: 'prop', src: 'prop_v3_cloth_bag' },
  phone: { status: 'none', kind: 'phone', fallback: '中性手機外形（CSS），不顯示訊息內容' },
  quilt: { status: 'none', kind: 'zoom', zoom: { rainRoom: { x: 0.3, y: 0.52, scale: 1.8 } }, fallback: '雨房背景局部放大（被子）' },
  basin: { status: 'none', kind: 'zoom', zoom: { rainRoom: { x: 0.7, y: 0.55, scale: 2 } }, fallback: '雨房背景局部放大（鋁盆）' },
  cloth: { status: 'none', kind: 'zoom', zoom: { hut: { x: 0.72, y: 0.46, scale: 1.8 } }, fallback: '山屋背景局部放大（布旗）；店內沒有圖，維持原背景' },
  thermos: { status: 'none', kind: 'zoom', zoom: { hut: { x: 0.24, y: 0.36, scale: 1.8 } }, fallback: '山屋背景局部放大（爐上的水壺，不是熱水瓶）' },
};

// 老太太：每個外出背景的遠處，小、不可點、不標示、不特寫，各天大小相同（不逐日逼近）。
// x：腳底中心、y：腳底（佔背景的比例）；h：身高佔背景高的比例。
export const OLD_LADY = {
  status: 'ready',
  src: 'char_v3_old_lady_far',
  places: {
    rainRoom: { x: 0.64, y: 0.318, h: 0.03 }, // 窗外對面的屋簷下
    hut: { x: 0.12, y: 0.245, h: 0.028 }, // 窗外的碎石路邊
    road: { x: 0.21, y: 0.665, h: 0.032 }, // 店外牆邊的小板凳（開場那張縣道店面）
    companyLobby: { x: 0.37, y: 0.465, h: 0.03 }, // 最裡面那組沙發旁
  },
};

// 店內故事鏡頭：固定朝吧台；龍眼的位置（貓圖沿用 sleep／sit）
export const STORY_YAW = -6;
export const CAT_SPOTS = {
  shelfSleep: { angle: -33, depth: 0.46, y: 0.5, h: 0.07, img: 'cat_longan_sleep' },
  shelfSit: { angle: -33, depth: 0.46, y: 0.5, h: 0.08, img: 'cat_longan_sit' },
  floor: { angle: 14, depth: 0.6, y: 0.88, h: 0.09, img: 'cat_longan_sit' },
  table: { angle: 22, depth: 0.82, y: 0.97, h: 0.1, img: 'cat_longan_sit' }, // 第三天回店：窗台、她的位子旁邊（sit）
};
// 桌上的杯子：已經在桌上的生活道具（不做沖煮、不點喝）
export const CUP = { status: 'ready', src: 'prop_cup' };

// 店內 360 用到的畫師圖（scenes.js 的 shopScene 依名字取用）；開場用到的原圖（view/opening.js）
export const PANO_ART = [...SHOP_ART];
export const OPENING_SCENES = [...OPENING_ART];

// 這一版實際會載入的全部檔名（不重複）
export function allArt() {
  const out = new Set([...PANO_ART, ...OPENING_SCENES]);
  for (const b of Object.values(BACKGROUNDS)) if (b.src) out.add(b.src);
  for (const p of Object.values(PORTRAITS)) if (p?.src) out.add(p.src);
  for (const f of Object.values(FOCUS)) if (f?.src) out.add(f.src);
  out.add(OLD_LADY.src);
  out.add(CUP.src);
  for (const c of Object.values(CAT_SPOTS)) out.add(c.img);
  return [...out];
}
