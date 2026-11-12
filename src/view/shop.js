// 店裡（畫師美術）組成 Pano 吃的 { background, items, foreground, tint }。從 scenes.js 拆出來，v3b 執行畫面只載入這支（不帶 v3a 夢想場景）。
import { img, ready } from './art.js';
import { FOV } from './pano.js';

export const HORIZON = 0.62;

// 色溫：同一間店，早上與傍晚只換色溫
export const TONE = {
  morning: 'rgba(255,214,150,.07)',
  dusk: 'rgba(120,60,20,.28)',
};

const patterns = new Map();
function pattern(g, name) {
  if (patterns.has(name)) return patterns.get(name);
  const im = img(name);
  if (!ready(im)) return null;
  const p = g.createPattern(im, 'repeat');
  patterns.set(name, p);
  return p;
}

// 店裡的牆與地板：灰泥牆、木地板（畫師的材質圖），跟著轉頭捲動
function shopBackground(g, W, H, yaw) {
  const ppd = W / FOV;
  const off = -yaw * ppd * 0.85;
  const hy = H * HORIZON;
  const wall = pattern(g, 'tex_wall_plaster');
  g.save();
  g.fillStyle = '#d8c7a8';
  g.fillRect(0, 0, W, hy);
  if (wall) {
    g.translate(off % 256, 0);
    g.scale(0.25, 0.25);
    g.fillStyle = wall;
    g.fillRect(-2048, 0, (W + 4096) * 4, hy * 4);
  }
  g.restore();
  g.fillStyle = 'rgba(80,50,30,.25)'; // 牆腳
  g.fillRect(0, hy - 18, W, 18);
  const floor = pattern(g, 'tex_floor_wood');
  g.save();
  g.fillStyle = '#8a6545';
  g.fillRect(0, hy, W, H - hy);
  if (floor) {
    g.beginPath();
    g.rect(0, hy, W, H - hy);
    g.clip();
    g.translate((off * 1.3) % 512, hy);
    g.scale(0.25, 0.25);
    g.fillStyle = floor;
    g.fillRect(-4096, 0, (W + 8192) * 4, (H - hy) * 4);
  }
  g.restore();
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(40,25,15,.35)');
  shade.addColorStop(0.3, 'rgba(40,25,15,0)');
  shade.addColorStop(1, 'rgba(40,25,15,.25)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
}

// 有材質的長方形（吧台正面、桌面）
const texRect = (name, base) => (g, w, h) => {
  const im = img(name);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  if (ready(im)) g.drawImage(im, 0, 0, w, h);
};

// 吧台上那組磨豆機／濾杯架／細口壺（見 shopScene）
export const KETTLE = { angle: 18, depth: 0.44, y: 0.645, h: 0.15, img: 'kettleSet' };

// 靠窗那張桌（畫師原圖 prop_v3b_window_table，1024×768）：桌面是上半的四邊形（原圖像素量的，桌面上緣的亮邊，不含桌緣厚度）。
// 前左、後左、後右、前右；椅子在桌子左邊
export const WINDOW_TABLE = {
  img: 'prop_v3b_window_table', size: [1024, 768],
  top: [[48, 141], [325, 26], [987, 91], [813, 240]],
};
// 桌上的杯子（prop_cup，600×420）：跟著桌子走，用桌子原圖像素定位。x、y：杯底中心；h：杯子（含杯盤）高。
// 「龍眼剛才那個位子的右手邊」：椅子在桌子左側，杯子放在桌面前緣、偏左的中段（不在椅背後面）
export const TABLE_CUP = { img: 'prop_cup', size: [600, 420], at: { x: 500, y: 186, h: 115 } };

// 坐下後的閱讀框：畫師原圖「坐下看得到窗」的店內夜景（1170×2532）；窗外的天色從傍晚暗到晚上（原圖是晚上，傍晚時窗裡疊一層暮色）。
// 原圖往上移一點，桌子與對面那張椅子落在閱讀框上方。座標都用原圖像素。
// shift：原圖往上移多少（佔原圖高）。0.06：吊燈燈罩（約 y140–325）整個留在畫面裡、只裁到吊鍊，杯子與對面椅面仍在閱讀框上方
export const SEATED = { src: 'scene_v3b_shop_window_night_seated', w: 1170, h: 2532, shift: 0.06,
  window: { x: 300, y: 355, w: 685, h: 780 }, // 窗玻璃
  cup: { x: 455, y: 1835, h: 150 }, // 我右手邊的杯子（杯底中心），把手朝右
  across: { x: 715, y: 1860, w: 330 }, // 對面那張椅子的椅面（貓的腳線、寬）
  keep: { top: 355, bottom: 1890 }, // 畫面再寬也要留在畫面裡的垂直範圍：窗頂～桌面、杯子、對面椅面
};
// 畫面很寬（#app 沒有 letterbox）時，照寬度 cover 會把下面的桌子與杯子裁掉：先把原圖往上移，桌面（keep）仍放不下就縮小、兩側留暗色
export function seatFit(W, H) {
  let s = W / SEATED.w;
  if (SEATED.h * s * (1 - SEATED.shift) < H) s = H / (SEATED.h * (1 - SEATED.shift));
  let oy = -SEATED.shift * SEATED.h * s;
  const { top, bottom } = SEATED.keep;
  if (oy + bottom * s > H) {
    oy = H - bottom * s;
    if (oy + top * s < 0) { s = H / (bottom - top); oy = -top * s; }
  }
  return { s, ox: (W - SEATED.w * s) / 2, oy };
}
// 龍眼：每天自己靠近一點（窗台睡 → 吧台前 → 桌邊）
export const CAT_BY_DAY = [
  { angle: 70, depth: 0.32, y: 0.47, h: 0.07, img: 'cat_longan_sleep' }, // 第 0 天（開場）：窗台
  { angle: 70, depth: 0.32, y: 0.47, h: 0.07, img: 'cat_longan_sleep' },
  { angle: 52, depth: 0.45, y: 0.8, h: 0.08, img: 'cat_longan_sit' },
  { angle: 38, depth: 0.55, y: 0.86, h: 0.09, img: 'cat_longan_sleep' },
  { angle: 28, depth: 0.66, y: 0.9, h: 0.1, img: 'cat_longan_sit' },
  { angle: 18, depth: 0.78, y: 0.95, h: 0.11, img: 'cat_longan_sleep' },
];

// mode：'enter' 剛推門、'sit' 等玩家點椅子、'seated' 坐著；deshu：德叔的姿勢（null＝不在畫面上，v3b 立繪放大時用，避免同時兩個德叔）；
// takeaways：已上架的夢想 id；tone：色溫；cat：指定龍眼的位置（v3b，沒給就照 CAT_BY_DAY）；extra：另外加的物件（v3b 桌上的杯子）
// getDream：查帶回物的名字與形狀（v3a 由 scenes.js 傳入；v3b 沒有帶回物，不載入夢想資料）
export function shopScene({ mode = 'seated', deshu = 'stand', day = 0, takeaways = [], tone = 'morning', cat: catSpot = null, extra = [], getDream = () => null }) {
  const seated = mode === 'seated';
  const items = [
    { id: 'backbar', angle: 0, depth: 0.18, y: 0.6, h: 0.32, img: 'backbar' },
    { id: 'lamp', angle: -4, depth: 0.42, y: 0.2, h: 0.2, img: 'pendant_lamp' },
    ...(deshu ? [{ id: 'deshu', angle: -8, depth: 0.32, y: 0.74, h: 0.46, img: `char_deshu_${deshu}` }] : []),
    { id: 'counter', angle: 0, depth: 0.42, y: 0.8, h: 0.17, aspect: 3.4, draw: texRect('tex_counter_front', '#6b4a30') },
    // 吧台上的手搖磨豆機＋濾杯架＋細口壺（一張圖 kettleSet，1050×675，上方約 36% 透明）。底邊坐在吧台面上；h 依德叔與吧台調過（原本 0.055 像桌上的玩具）
    { id: 'kettle', ...KETTLE },
    { id: 'window', angle: 72, depth: 0.28, y: 0.56, h: 0.3, img: 'window_day_clear' },
    { id: 'bookshelf', angle: -72, depth: 0.3, y: 0.76, h: 0.44, img: 'bookshelf' },
    { id: 'radio', angle: -118, depth: 0.42, y: 0.8, h: 0.24, img: 'radio' },
    { id: 'plant', angle: 122, depth: 0.45, y: 0.84, h: 0.28, img: 'plant' },
    { id: 'door', angle: 180, depth: 0.35, y: 0.8, h: 0.48, shape: 'door' },
    { id: 'shelf', angle: -37, depth: 0.46, y: 0.5, h: 0.03, shape: 'plank', aspect: 8 },
  ];
  // 帶回來的東西上架（粗稿形狀；點了會出它的名字）
  takeaways.forEach((id, i) => {
    const d = getDream(id);
    if (!d) return;
    items.push({ id: `take-${id}`, angle: -52 + i * 7.5, depth: 0.47, y: 0.495, h: 0.05, shape: d.takeaway.shape, hit: true, label: d.takeaway.name, takeaway: id });
  });
  const cat = catSpot || CAT_BY_DAY[Math.max(0, Math.min(5, day))];
  items.push({ id: 'longan', ...cat });
  items.push(...extra);
  if (mode === 'sit') items.push({ id: 'seat', angle: 16, depth: 0.78, y: 0.98, h: 0.34, img: 'chair', hit: true, glow: true, label: '椅子' });
  return {
    background: shopBackground,
    items,
    foreground: seated ? (g, W, H) => {
      // 坐下來：桌面在畫面下緣
      const top = H * 0.86;
      const tex = pattern(g, 'tex_wood_top');
      g.fillStyle = '#7a5638';
      g.fillRect(0, top, W, H - top);
      if (tex) { g.save(); g.beginPath(); g.rect(0, top, W, H - top); g.clip(); g.scale(0.3, 0.3); g.fillStyle = tex; g.fillRect(0, top / 0.3, W / 0.3, (H - top) / 0.3); g.restore(); }
      g.fillStyle = 'rgba(255,240,210,.25)';
      g.fillRect(0, top, W, 3);
    } : null,
    tint: TONE[tone],
  };
}
