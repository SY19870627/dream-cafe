// v3b 唯一美術對照表：劇本裡的 background／portrait／focus 代號 → 畫師原圖（assets/art/，只讀不改、不重新壓縮）。
// status：
//   ready —— 有原圖，src 是檔名（不含副檔名），單元測試會確認檔案存在，所以畫面不會去要不存在的圖（不 404）。
//   none  —— 沒有原圖：用 fallback 寫的方式表現（背景局部放大、中性的 CSS 形狀），不另外畫人形、不生圖。
// 交新圖時只改這裡：把該格改成 status:'ready', src:'檔名'。
import { SHOP_ART, OPENING_ART } from '../view/art.js';
import { srcOf, SHOP_STILL_NIGHT, SHOP_STILL_DAY } from '../view/art-map.js';

export const ART_DIR = 'assets/art/';
export const artUrl = (name) => `${ART_DIR}${name}.webp`;

// 背景：都是整張直式背景（1170×2532，下方約 30% 會被閱讀框蓋住）。
// 店內環景已拔掉（承峰 2026-11-21 20:48）：店內也是靜照（kind: 'still'），用 art-map.js 的店內定景（SHOP_STILL_DAY／SHOP_STILL_NIGHT；早上暫用晚上的定版圖）
export const BACKGROUNDS = {
  shopMorning: { status: 'ready', kind: 'still', src: srcOf(SHOP_STILL_DAY), tone: 'morning', ambient: 'shop', base: '#2a1d16' },
  shopEvening: { status: 'ready', kind: 'still', src: srcOf(SHOP_STILL_NIGHT), tone: 'dusk', ambient: 'shop', base: '#2a1d16' },
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

// 三天 AVG 劇本方向（story/direction.js）裡龍眼位置的名字。店內環景拔掉後不再畫（店內是靜照），只留名字與貓圖給劇本方向檢查
export const CAT_SPOTS = {
  shelfSleep: { img: 'cat_longan_sleep' },
  shelfSit: { img: 'cat_longan_sit' },
  floor: { img: 'cat_longan_sit' },
  table: { img: 'cat_longan_sit' }, // 第三天回店：窗台、她的位子旁邊（sit）
};

// 店內 2D 定景用到的圖（view/shop-still.js：店內佔位靜照、德叔、龍眼、杯子、摸頭的手）；開場用到的原圖（view/opening.js）。
// 店內環景的貼圖（吧台、牆、地板材質、吊燈、書架……）不再預載（檔案留在 assets/art，只是不再引用）。
export const SHOP_STILL_IMAGES = [...SHOP_ART];
export const OPENING_SCENES = [...OPENING_ART];

// 這一版執行畫面實際會顯示的「開場＋店內」檔名（不重複）。
// 上面 BACKGROUNDS／PORTRAITS／FOCUS／OLD_LADY 的舊三天 AVG 圖（雨房、山屋、公司大廳、阿桂、宜蓁、四張 prop_v3_*、遠處的老太太）
// 只有 phase === 'story' 才會畫，執行畫面不會進去，所以不算進來、開機也不等（對照表與檔案都留著，三天模組測試還在用）。
// scene_county_road（第一天下山）由 view/days.js 的 DAY_ART 在背景預載，不在這裡。
export function allArt() {
  return [...new Set([...SHOP_STILL_IMAGES, ...OPENING_SCENES])];
}
