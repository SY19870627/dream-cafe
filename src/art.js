// 美術：原型階段全部用 Canvas 程式繪製；接正式美術後，人物與龍眼改用 assets/art/ 的手繪圖（見「正式美術」一節），
// 圖載入失敗就退回這裡的 Canvas 繪圖。之後換其他手繪插畫時，一樣只要讓同名函式回傳圖片即可。
import * as THREE from 'three';

const PPM = 200; // 每公尺像素數
// 人物與桌上的小東西會被推近看（座位視角、看德叔沖、對話時的推近）：200 不夠，特寫會糊、有像素感（美術評分修正 b）。
// 改用 2～3 倍：依裝置像素比，桌機 400、手機 600；圖的內容與大小（公尺）不變，只是畫得更細
const HI = Math.round(PPM * Math.min(3, Math.max(2, (globalThis.devicePixelRatio || 1) * 1.5)));

// ppm：這張圖每公尺幾個像素（記在 c.ppm，main.js 用它把像素換回公尺）
function canvas(wm, hm, ppm = PPM) {
  const c = document.createElement('canvas');
  c.width = Math.round(wm * ppm);
  c.height = Math.round(hm * ppm);
  c.ppm = ppm;
  const g = c.getContext('2d');
  g.scale(ppm, ppm); // 之後一律用公尺為單位繪製
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return { c, g };
}

export function tex(c, repeat) {
  // 手繪圖（c.art）用補過邊色的 ImageData 上傳（見 artPixels()），透明邊緣縮小時才不會混進黑色
  const t = c.art ? new THREE.Texture(artPixels(c)) : new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; // 斜著看的地板、桌面比較不糊（超過顯示卡上限時 Three.js 會自己壓到上限）
  // 縮小時用 mipmap 三線性過濾：人物離遠了不會閃爍、出現鋸齒（美術評分修正 b）
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/* ---------- 正式美術：assets/art/ 的手繪圖（接正式美術第一批：角色與龍眼） ---------- */
// 開店前先把圖載進來（這個模組用 top-level await 等它，main.js 一開始就同步拿得到圖）。
// 任何一張載入失敗（404、解碼錯誤、離線、逾時）那張就退回原本的 Canvas 繪圖，遊戲照常進行。
// h：圖裡畫到的部分（頭頂到腳底，含帽子）是幾公尺，照原本 Canvas 紙片的身高；同一個人的站姿共用一個高度。
// ax：紙片原點（腳底中心／坐姿的臀部）在圖寬的哪裡，預設正中間；圖會以它為中線左右對稱地裁切。
// hip：坐姿臀部底下在圖高的哪裡（從上緣量的比例），用來在底下放椅子或高腳椅（畫師的坐姿多半沒有畫椅子）。
// facing：圖裡面朝哪邊（走路的龍眼面向左，往畫面右邊走時鏡像）。
const ART_SPEC = {
  char_deshu_stand: { h: 1.67 }, char_deshu_brew: { h: 1.67 }, char_deshu_serve: { h: 1.67, cup: [-0.14, 1.03] },
  char_deshu_smile: { h: 1.67 }, char_deshu_thermo: { h: 1.67 }, char_deshu_sit: { h: 1.3 },
  char_kevin_stand: { h: 1.61 }, char_kevin_bar: { h: 1.61 }, char_kevin_sit: { h: 1.28, ax: 0.78, hip: 0.6 },
  // 美術評分修正 d2：凱文坐在吧台高腳椅上（圖裡自己畫了高腳椅，和 stool.webp 同視角）。底邊是最前面那支椅腳，
  // 椅面中心（臀部壓著的地方，原圖約 x 670、y 1105）到地面照 stool.webp 的 0.66 公尺，換算整張畫到的高度約 1.41 公尺；
  // ax 對到椅面中心，紙片原點就是高腳椅的位置（和原本在他底下畫一張高腳椅時一樣）
  char_kevin_barstool: { h: 1.41, ax: 0.654 },
  char_yuan_sit: { h: 1.22, ax: 0.8, hip: 0.63 }, char_yuan_stand: { h: 1.56 },
  char_zhe_stand: { h: 1.62 }, char_zhe_wet: { h: 1.62 },
  char_grandpa_stand: { h: 1.5 }, char_grandpa_sit: { h: 1.2 },
  cat_longan_sit: { h: 0.4 }, cat_longan_walk: { h: 0.34, facing: 'left' }, cat_longan_sleep: { h: 0.28 },
};
// 手機（觸控、記憶體 4GB 以下）用 1024 高的版本：載入時用 canvas 縮一半，記憶體約四分之一；其他用原圖 2048 高
const ART_LOW = (() => {
  try { return globalThis.matchMedia?.('(pointer: coarse)').matches || (navigator.deviceMemory || 8) <= 4; } catch { return true; }
})();
const ART_MAX = ART_LOW ? 1024 : 2048;
const ART_TIMEOUT = 15000; // 網路太慢就不等了：還沒到的圖用 Canvas 畫
const ART = new Map(); // 檔名 → { c：裁好、縮好的圖（底邊就是腳底），ppm，hip（公尺），spec }
let artClosed = false;

// 接正式美術第二批（art2a）：店內空間、家具與小道具。size：交付規格裡畫布代表幾公尺（寬, 高），每公尺像素＝圖寬÷寬
// （家具 1000、前景的椅子與高腳椅 1500、桌上小物 3000）。
// 透明的家具與小道具依透明度裁掉四周留白（畫師：藤椅、黑板立牌、碗櫥上方，貓跳台、貓軟墊左右有留白，都沒有拉伸）：
// 比例照每公尺像素、不拉伸，底邊就是接地點，左右以畫到的範圍置中。
// keep：掛在牆上、或程式要在固定位置疊字的圖（畫布外框就是物件外框），整張用、不裁。opaque：不透明的材質與窗景。
const ROOM_SPEC = {
  tex_floor_wood: { size: [2, 2], opaque: true }, tex_wall_plaster: { size: [1, 1], opaque: true },
  tex_wall_wainscot: { size: [1, 1], opaque: true }, tex_ceiling_beam: { size: [1, 1], opaque: true },
  tex_wood_top: { size: [1, 1], opaque: true }, tex_counter_front: { size: [1.7, 1], opaque: true },
  window_day_clear: { size: [1.6, 1.3], opaque: true }, window_day_rain: { size: [1.6, 1.3], opaque: true },
  window_day_typhoon: { size: [1.6, 1.3], opaque: true }, window_night_clear: { size: [1.6, 1.3], opaque: true },
  window_night_rain: { size: [1.6, 1.3], opaque: true }, window_night_typhoon: { size: [1.6, 1.3], opaque: true },
  window_frame: { size: [1.6, 1.3], keep: true }, backbar: { size: [2.8, 1.8], keep: true },
  thermometer_frame: { size: [0.36, 0.9], keep: true }, pendant_lamp: { size: [0.36, 0.9], keep: true },
  noticeBoard: { size: [0.6, 1.25], keep: true },
  stool: { size: [0.45, 0.8] }, chair: { size: [0.5, 0.95] }, sofa: { size: [1.5, 0.9] }, bookWall: { size: [1.9, 2.5] },
  bookshelf: { size: [1, 1.9] }, plant: { size: [0.8, 1.4] }, cabinet: { size: [0.9, 1.6] }, rattanChair: { size: [0.8, 1.2] },
  easel: { size: [0.7, 1.5] }, radio: { size: [0.55, 0.95] }, recordPlayer: { size: [0.7, 0.85] }, catTree: { size: [0.8, 1.7] },
  menuBoard: { size: [0.6, 1] }, coffeeSack: { size: [0.6, 0.75] }, catCushion: { size: [0.7, 0.3] },
  succulent: { size: [0.5, 1] }, bookStack: { size: [0.5, 0.5] }, longanJar: { size: [0.5, 0.95] },
  floorLamp_on: { size: [0.6, 1.7] }, floorLamp_off: { size: [0.6, 1.7] },
  prop_cup: { size: [0.2, 0.14] }, prop_cup_daily: { size: [0.2, 0.14] }, prop_coaster_menu: { size: [0.2, 0.2] }, key: { size: [0.22, 0.12] },
  longanBag: { size: [0.22, 0.2] }, kettleSet: { size: [0.7, 0.45] }, napkin: { size: [0.5, 0.95] },
  yuanBook: { size: [0.5, 0.95] }, framedNapkin: { size: [0.5, 0.95] }, beanBag: { size: [0.5, 0.95] },
  envelope: { size: [0.26, 0.18] }, // art2b：老先生的信封（德叔放在吧台上），每公尺 3000 像素
};
// art2b：開場、地圖與介面的圖不進 3D 場景，只給 DOM 用（<img>、SVG 的 <image>、CSS 的 background／border-image）：
// 下載後先解碼一次確認是好的圖（解完馬上釋放），留下壓縮過的檔案（object URL），用到的時候瀏覽器才解碼，
// 手機不用一直抱著四張 1170×2532 的點陣圖。沒有載到就是 null，用的地方退回原本的 Canvas 繪圖或 CSS 的純色
const UI_ART = ['scene_office_night', 'scene_mailboxes', 'scene_county_road', 'map_taiwan', 'ui_paper_lined', 'ui_bubble_9slice'];
const UI = new Map(); // 檔名 → object URL
let ICONS = null; // ui_icons.svg 的內容（四個 <symbol>）
const ROOM = new Map(); // 檔名 → canvas（c.ppm；透明的圖另有 c.art 與 c.src：裁切前的原圖座標怎麼換到這張）
// 解碼一張店內的圖：透明的裁掉留白；手機和人物一樣縮到長邊 1024（桌機 2048），每公尺像素跟著縮
async function decodeRoom(name, blob) {
  const spec = ROOM_SPEC[name];
  const bmp = await createImageBitmap(blob);
  try {
    const W = bmp.width, H = bmp.height;
    let x0 = 0, y0 = 0, x1 = W, y1 = H;
    if (!spec.opaque && !spec.keep) {
      const q = W * H > 600000 ? 4 : 2, mw = Math.ceil(W / q), mh = Math.ceil(H / q);
      const m = document.createElement('canvas'); m.width = mw; m.height = mh;
      const mg = m.getContext('2d', { willReadFrequently: true });
      mg.drawImage(bmp, 0, 0, mw, mh);
      const d = mg.getImageData(0, 0, mw, mh).data;
      let top = mh, bottom = -1, left = mw, right = -1;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
        if (d[(y * mw + x) * 4 + 3] <= 24) continue;
        if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x;
      }
      if (bottom < 0) throw new Error(`${name}: 整張是透明的`);
      x0 = Math.max(0, left * q - 4); y0 = Math.max(0, top * q - 4);
      x1 = Math.min(W, (right + 1) * q + 4); y1 = Math.min(H, (bottom + 1) * q);
    }
    const s = Math.min(1, ART_MAX / Math.max(W, H));
    const c = document.createElement('canvas');
    c.width = Math.round((x1 - x0) * s);
    c.height = Math.round((y1 - y0) * s);
    const g = c.getContext('2d', { willReadFrequently: !spec.opaque });
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    c.ppm = (W / spec.size[0]) * s;
    if (!spec.opaque) { c.art = name; c.src = { x: x0, y: y0, s, w: W, h: H }; }
    return c;
  } finally {
    bmp.close?.();
  }
}

async function fetchArt(name) {
  const res = await fetch(new URL(`../assets/art/${name}.webp`, import.meta.url));
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.blob();
}
// 解碼一張圖：量出畫到的範圍、以 ax 為中線裁切、依裝置縮小，解碼完的原圖馬上釋放（一次只解一張，記憶體不會一下子衝高）
async function decodeArt(name, blob) {
  const spec = ART_SPEC[name];
  const bmp = await createImageBitmap(blob);
  try {
    const W = bmp.width, H = bmp.height;
    const q = 4, mw = Math.ceil(W / q), mh = Math.ceil(H / q); // 縮成 1/4 量範圍就夠準（差不到半公分）
    const m = document.createElement('canvas'); m.width = mw; m.height = mh;
    const mg = m.getContext('2d', { willReadFrequently: true });
    mg.drawImage(bmp, 0, 0, mw, mh);
    const d = mg.getImageData(0, 0, mw, mh).data;
    let top = mh, bottom = -1, left = mw, right = -1;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      if (d[(y * mw + x) * 4 + 3] <= 24) continue;
      if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x;
    }
    if (bottom < 0) throw new Error(`${name}: 整張是透明的`);
    const figTop = top * q, sole = Math.min(H, (bottom + 1) * q); // 原圖像素：頭頂、腳底
    const axPx = (spec.ax ?? 0.5) * W;
    const half = Math.max(axPx - left * q, (right + 1) * q - axPx) + 4;
    const pad = 4;
    const s = Math.max(W, H) > 1024 ? Math.min(1, ART_MAX / Math.max(W, H)) : 1; // 龍眼的圖本來就小（512），不縮
    const c = document.createElement('canvas');
    c.width = Math.round(2 * half * s);
    c.height = Math.round((sole - figTop + pad) * s);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, W, H, (half - axPx) * s, (pad - figTop) * s, W * s, H * s);
    const ppm = ((sole - figTop) * s) / spec.h;
    const hip = spec.hip ? ((sole - spec.hip * H) * s) / ppm : 0;
    return { c, ppm, hip, spec };
  } finally {
    bmp.close?.();
  }
}
async function loadArt() {
  if (typeof document === 'undefined' || typeof fetch !== 'function' || typeof createImageBitmap !== 'function') return;
  const names = [...Object.keys(ART_SPEC), ...Object.keys(ROOM_SPEC), ...UI_ART];
  const blobs = names.map((n) => fetchArt(n).catch(() => null)); // 同時下載
  const icons = fetchIcons().catch(() => null);
  for (let i = 0; i < names.length; i++) {
    const blob = await blobs[i];
    if (!blob || artClosed) continue;
    try {
      const n = names[i];
      if (ART_SPEC[n]) { const a = await decodeArt(n, blob); if (!artClosed) ART.set(n, a); }
      else if (ROOM_SPEC[n]) { const c = await decodeRoom(n, blob); if (!artClosed) ROOM.set(n, c); }
      else {
        const bmp = await createImageBitmap(blob); // 解得開才算數（壞掉的檔案、404 的網頁都不行）
        bmp.close?.();
        if (!artClosed) UI.set(n, URL.createObjectURL(blob));
      }
    } catch { /* 解碼失敗：這張用 Canvas 畫 */ }
  }
  const svg = await icons;
  if (svg && !artClosed) ICONS = svg;
}
// 介面圖示：只收 <symbol>，四個都在才用（少一個就整組用原本的文字）
const ICON_IDS = ['icon-menu', 'icon-fastforward', 'icon-light', 'icon-temperature'];
async function fetchIcons() {
  const res = await fetch(new URL('../assets/art/ui_icons.svg', import.meta.url));
  if (!res.ok) throw new Error(`ui_icons: ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const syms = [...doc.querySelectorAll('symbol')].filter((n) => ICON_IDS.includes(n.id));
  if (syms.length !== ICON_IDS.length) throw new Error('ui_icons: 圖示不齊');
  return syms.map((n) => { n.querySelectorAll('script').forEach((x) => x.remove()); return new XMLSerializer().serializeToString(n); }).join('');
}
try {
  await Promise.race([loadArt(), new Promise((r) => setTimeout(r, ART_TIMEOUT))]);
} catch { /* 任何意外都當作沒有圖 */ }
artClosed = true; // 逾時之後才到的圖不用：同一場遊戲裡，人物不會中途換畫風

export const artLoaded = (name) => ART.has(name) || ROOM.has(name) || UI.has(name);
export const artNames = () => [...ART.keys(), ...ROOM.keys(), ...UI.keys()];
export const uiArtNames = () => [...UI.keys()];
// art2b：開場、地圖與介面的圖（object URL；沒有載到是 null）與介面圖示（四個 <symbol> 的字串；沒有載到是 null）
export const artUrl = (name) => UI.get(name) || null;
export const iconSymbols = () => ICONS;
export const roomArtNames = () => [...ROOM.keys()];
// 店內的手繪圖（沒有載到就是 null）：同一張 canvas 共用，要疊字的（黑板、溫度計、徵才啟事）另外複製一張再畫
const room = (name) => ROOM.get(name) || null;

// 坐姿底下的椅子（seat：'chair' 一般椅子，照臀部高度縮放；'stool' 吧台的高腳椅，人往上抬到椅面、腳踩在橫桿附近）。
// 接正式美術第二批：椅子與高腳椅換成手繪圖（和予安、凱文一樣是 3/4 側面、面向畫面左邊）。
// sit：坐的地方在原圖的哪個像素（椅面靠後、臀部壓著的那一點），對到人物的臀部；椅子照實際大小，不縮放
const SEATS_ART = {
  chair: { w: 0.5, h: 0.95, top: 0.45, draw: (g) => drawChair(g), art: 'chair', sit: [400, 770] },
  stool: { w: 0.45, h: 0.8, top: 0.73, draw: (g) => drawStool(g), art: 'stool', sit: [345, 205] },
};
// 手繪的椅子放在手繪人物底下：回傳合成好的 canvas（原點仍是臀部的中線）；沒有椅子的圖就回傳 null，改用 Canvas 畫的椅子
function seatUnder(a, seat) {
  const S = SEATS_ART[seat], C = room(S.art);
  if (!C || !a.hip) return null;
  const f = a.ppm / C.ppm; // 椅子的像素換成人物的像素
  const hx = a.c.width / 2, hy = a.c.height - a.hip * a.ppm; // 臀部（人物圖裡）
  const sx = (S.sit[0] - C.src.x) * C.src.s * f, sy = (S.sit[1] - C.src.y) * C.src.s * f; // 坐的地方（椅子圖裡，換成人物像素）
  const cl = hx - sx, ct = hy - sy, cw = C.width * f, ch = C.height * f; // 椅子在人物圖座標的位置
  const top = Math.min(0, ct), bottom = Math.max(a.c.height, ct + ch);
  const half = Math.max(hx, a.c.width - hx, hx - cl, cl + cw - hx);
  const c = document.createElement('canvas');
  c.width = Math.ceil(2 * half);
  c.height = Math.ceil(bottom - top);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  const ox = half - hx, oy = -top;
  g.drawImage(C, cl + ox, ct + oy, cw, ch);
  g.drawImage(a.c, ox, oy);
  return c;
}
const built = new Map();
// 取一張手繪圖（沒有載到就回傳 null，呼叫的函式改用 Canvas 畫）。seat：在臀部底下畫椅子
function art(name, seat = null) {
  const a = ART.get(name);
  if (!a) return null;
  // 坐姿：椅子畫在臀部底下；站姿只有吧台的高腳椅（站在自己的位子旁邊，椅子在他身旁）
  const key = seat && (a.hip || seat === 'stool') ? `${name}:${seat}` : name;
  if (built.has(key)) return built.get(key);
  let c = a.c;
  const drawn = key !== name ? seatUnder(a, seat) : null;
  if (drawn) c = drawn;
  else if (key !== name) {
    const S = SEATS_ART[seat];
    const C = a.hip ? null : room(S.art); // 站在高腳椅旁邊：有手繪的高腳椅就用它（照實際大小）
    const k = seat === 'stool' || !a.hip ? 1 : a.hip / S.top; // 一般椅子：椅面剛好在臀部底下
    const lift = a.hip && seat === 'stool' ? Math.max(0, S.top - a.hip) : 0;
    const sw = (C ? C.width / C.ppm : S.w) * k * a.ppm, sh = (C ? C.height / C.ppm : S.h) * k * a.ppm, lp = Math.round(lift * a.ppm);
    const side = a.hip ? 0 : 0.3 * a.ppm; // 站著：高腳椅在他右手邊（畫面右邊）0.3 公尺
    c = document.createElement('canvas');
    c.width = Math.max(a.c.width, Math.ceil(2 * (side + sw / 2)) + 2);
    c.height = Math.max(a.c.height + lp, Math.ceil(sh));
    const g = c.getContext('2d', { willReadFrequently: true });
    g.save();
    g.translate((c.width - sw) / 2 + side, c.height - sh);
    if (C) g.drawImage(C, 0, 0, sw, sh);
    else {
      g.scale(a.ppm * k, a.ppm * k);
      g.lineJoin = 'round'; g.lineCap = 'round';
      S.draw(g);
    }
    g.restore();
    g.drawImage(a.c, (c.width - a.c.width) / 2, c.height - lp - a.c.height);
  }
  c.art = name;
  c.ppm = a.ppm;
  c.facing = a.spec.facing || null;
  c.cupAt = a.spec.cup || null; // 圖裡手上已經端著杯子：[x, y] 公尺（main.js 把立體的杯子藏起來，放下時從這裡出發）
  built.set(key, c);
  return c;
}

// 上傳到 GPU 的像素：canvas 存的是預乘過的顏色，完全透明的地方顏色是黑的，縮小（mipmap）時邊緣會混出一圈黑邊。
// 這裡把邊緣的顏色往外補（畫幾張往外偏移的圖疊在後面），再把透明度換回原本的，用不預乘的 ImageData 上傳。
// 每張圖只做一次；顏色空間照舊是 sRGB。
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function artPixels(c) {
  if (c.pixels) return c.pixels;
  const w = c.width, h = c.height;
  const src = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
  const b = document.createElement('canvas'); b.width = w; b.height = h;
  const g = b.getContext('2d', { willReadFrequently: true });
  for (const r of [12, 6, 3, 1]) for (const [dx, dy] of DIRS) g.drawImage(c, dx * r, dy * r);
  g.drawImage(c, 0, 0);
  const bd = g.getImageData(0, 0, w, h).data, sd = src.data;
  for (let i = 0; i < sd.length; i += 4) {
    if (sd[i + 3] >= 48 || bd[i + 3] === 0) continue; // 夠不透明的邊緣保留自己的顏色（太透明的預乘回來誤差大，改用補的）
    sd[i] = bd[i]; sd[i + 1] = bd[i + 1]; sd[i + 2] = bd[i + 2];
  }
  b.width = b.height = 0;
  src.ppm = c.ppm;
  src.canvas = c; // main.js 量透明度（drawnHalf、inkTop）時用回 canvas
  c.pixels = src;
  return src;
}

const INK = '#3b2a20';
function outline(g, w = 0.018) {
  g.strokeStyle = INK;
  g.lineWidth = w;
  g.stroke();
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function ell(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

// 簡單的偽亂數，讓每次畫出來都一樣
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/* ---------- 建築材質 ---------- */
// 接正式美術第二批：地板、牆、天花板、吧台與桌面改用手繪的無縫材質（每張代表幾公尺見 ROOM_SPEC，main.js 依公尺設定 repeat）；
// 沒有載到就用下面的 Canvas 版本（大小一樣，repeat 不用改）

// 地板：一張 2×2 公尺
export function woodFloor() {
  const a = room('tex_floor_wood');
  if (a) return a;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const r = rng(7);
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    let x = -r() * 200;
    while (x < 512) {
      const len = 160 + r() * 220;
      const tone = 150 + r() * 30;
      g.fillStyle = `rgb(${tone + 20},${tone - 25},${tone - 70})`;
      g.fillRect(x, i * 64, len, 64);
      g.strokeStyle = 'rgba(70,40,20,0.45)';
      g.lineWidth = 3;
      g.strokeRect(x, i * 64, len, 64);
      g.strokeStyle = 'rgba(90,55,30,0.18)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        const yy = i * 64 + 12 + r() * 40;
        g.moveTo(x + 5, yy);
        g.bezierCurveTo(x + len * 0.3, yy + 6, x + len * 0.6, yy - 6, x + len - 5, yy);
        g.stroke();
      }
      x += len;
    }
  }
  return c;
}

// 牆（三合院的感覺）：上半石灰白牆、下半 1 公尺高的紅磚腰牆，各一張 1×1 公尺的材質，main.js 分成上下兩片平鋪
export function wallPlaster() {
  const a = room('tex_wall_plaster');
  if (a) return a;
  const { c, g } = canvas(1, 1, 256);
  g.fillStyle = '#efe6d6';
  g.fillRect(0, 0, 1, 1);
  const r = rng(11);
  g.fillStyle = 'rgba(160,140,110,0.08)';
  for (let i = 0; i < 60; i++) g.fillRect(r() * 0.94, r() * 0.97, 0.06, 0.03);
  return c;
}
export function wallWainscot() {
  const a = room('tex_wall_wainscot');
  if (a) return a;
  const { c, g } = canvas(1, 1, 256);
  g.fillStyle = '#a24a33';
  g.fillRect(0, 0, 1, 1);
  const r = rng(13);
  const top = 0.06, bh = (1 - top) / 10, bw = 0.25; // 磚寬 0.25 公尺：左右剛好接得起來
  for (let row = 0; row < 10; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -off; x < 1; x += bw) {
      const t = r();
      g.fillStyle = t < 0.3 ? '#9a4430' : t < 0.6 ? '#ad5239' : '#a34b34';
      g.fillRect(x + 0.008, top + row * bh + 0.008, bw - 0.016, bh - 0.016);
    }
  }
  g.fillStyle = '#6e4a32';
  g.fillRect(0, 0, 1, top); // 腰帶木條
  return c;
}

// 天花板：一張 1×1 公尺，木板加一道橫樑
export function ceiling() {
  const a = room('tex_ceiling_beam');
  if (a) return a;
  const { c, g } = canvas(1, 1, 128);
  g.fillStyle = '#5a3d2b';
  g.fillRect(0, 0, 1, 1);
  g.fillStyle = '#3f2a1d';
  g.fillRect(0.42, 0, 0.16, 1);
  return c;
}

// 吧台檯面與圓桌：一張 1×1 公尺的木頭檯面
// 美術評分修正 f：手繪的檯面上畫了四圈杯印（米色的細線），貼到吧台上很淡，看起來像畫壞的圓圈（評審：沖煮視角吧台上的圓形殘痕）。
// 是杯印，所以照原圖的位置描一圈咖啡色、裡面淡淡一層，看得出是杯子放過的痕跡；切在圖邊緣的兩圈連另一邊一起描，接縫兩邊接得起來
const CUP_RINGS = [[0.175, 0.19, 0.07, 0.085], [0.75, 0.04, 0.065, 0.06], [0.73, 0.75, 0.075, 0.09], [0.26, 0.96, 0.065, 0.07]];
export function woodTop() {
  const a = room('tex_wood_top');
  if (a) {
    const { c, g } = overlay(a);
    for (const [x, y, rx, ry] of CUP_RINGS) for (const dy of [-1, 0, 1]) {
      if (y + dy - ry > 1 || y + dy + ry < 0) continue;
      g.beginPath();
      g.ellipse(x, y + dy, rx, ry, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(96,52,24,0.07)';
      g.fill();
      g.strokeStyle = 'rgba(96,52,24,0.36)';
      g.lineWidth = 0.006;
      g.stroke();
    }
    return c;
  }
  const { c, g } = canvas(1, 1, 128);
  g.fillStyle = '#5e3c28';
  g.fillRect(0, 0, 1, 1);
  return c;
}
// 吧台正面：一張 1.7×1 公尺（左右接得起來），3.4 公尺長的吧台重複兩次
export function counterFront() {
  const a = room('tex_counter_front');
  if (a) return a;
  const { c, g } = canvas(1.7, 1, 128);
  g.fillStyle = '#8a5a3b';
  g.fillRect(0, 0, 1.7, 1);
  return c;
}

// weather：'clear'、'rain'（灰藍的雨天）、'typhoon'（颱風夜：暗、樹被吹彎）。窗框另外一張（windowFrame()），雨絲由 main.js 疊上去
export function windowView(night, weather = 'clear') {
  return room(`window_${night ? 'night' : 'day'}_${weather}`) || drawWindowView(night, weather);
}
function drawWindowView(night, weather) {
  const { c, g } = canvas(1.6, 1.3);
  const sky = g.createLinearGradient(0, 0, 0, 1.3);
  const wet = weather !== 'clear';
  if (weather === 'typhoon') {
    sky.addColorStop(0, '#141b22');
    sky.addColorStop(1, '#33403f');
  } else if (weather === 'rain') {
    sky.addColorStop(0, night ? '#151b2a' : '#8d99a6');
    sky.addColorStop(1, night ? '#2b3445' : '#c4c9c8');
  } else if (night) {
    sky.addColorStop(0, '#0f1a33');
    sky.addColorStop(1, '#2a3555');
  } else {
    sky.addColorStop(0, '#9fd0f0');
    sky.addColorStop(1, '#f6e7c6');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 1.6, 1.3);
  const r = rng(3);
  if (night && !wet) {
    g.fillStyle = '#fff8dc';
    for (let i = 0; i < 40; i++) g.fillRect(r() * 1.6, r() * 0.7, 0.008, 0.008);
    ell(g, 1.25, 0.25, 0.08, 0.08);
    g.fillStyle = '#fbf0c8';
    g.fill();
  }
  // 遠山
  g.beginPath();
  g.moveTo(0, 0.85);
  for (let x = 0; x <= 1.6; x += 0.1) g.lineTo(x, 0.7 + Math.sin(x * 3.1) * 0.08 + Math.sin(x * 7) * 0.03);
  g.lineTo(1.6, 1.3); g.lineTo(0, 1.3);
  g.fillStyle = weather === 'typhoon' ? '#1c2525' : night ? '#1b2440' : wet ? '#7d9283' : '#8fb38a';
  g.fill();
  // 近處龍眼樹（颱風夜被風吹彎）
  g.fillStyle = weather === 'typhoon' ? '#101716' : night ? '#121a2c' : wet ? '#45624a' : '#4f7d4a';
  for (const [x, y, s] of [[0.2, 0.95, 0.28], [0.55, 1.05, 0.22], [1.3, 1.0, 0.3]]) {
    if (weather === 'typhoon') { g.beginPath(); g.ellipse(x + s * 0.35, y - s * 0.1, s * 1.15, s * 0.55, -0.35, 0, Math.PI * 2); g.fill(); }
    else { ell(g, x, y, s, s * 0.8); g.fill(); }
  }
  // 雨絲
  if (wet) {
    const heavy = weather === 'typhoon';
    g.strokeStyle = heavy ? 'rgba(200,215,220,0.5)' : 'rgba(230,236,240,0.45)';
    g.lineWidth = 0.006;
    for (let i = 0; i < (heavy ? 140 : 60); i++) {
      const x = r() * 1.7, y = r() * 1.3, l = heavy ? 0.12 : 0.07;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - (heavy ? 0.06 : 0.01), y + l); g.stroke();
    }
  }
  return c;
}
// 窗框（透明，1.6×1.3 公尺，六種窗景共用），貼在窗景與雨絲前面
export function windowFrame() {
  const a = room('window_frame');
  if (a) return a;
  const { c, g } = canvas(1.6, 1.3);
  g.strokeStyle = '#4a3122';
  g.lineWidth = 0.07;
  g.strokeRect(0.035, 0.035, 1.53, 1.23);
  g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(0.8, 0); g.lineTo(0.8, 1.3); g.moveTo(0, 0.65); g.lineTo(1.6, 0.65); g.stroke();
  return c;
}

// 菜單黑板的字（公尺；黑板在 x 0.95～1.85）
// 美術評分修正 e：整段字往下移到黑板的下半（原本「今日手沖」在黑板上緣，德叔站在吧台後時正好在他的頭旁邊）
// 美術評分修正 f：整段字收進黑板的下緣（德叔肩膀以下的高度）、中線往右移到 1.47、字小一點。
// 量過：看德叔沖的近景，德叔的臉在黑板 y 1.36 左右，肩膀以下擋住 x 約 1.10～1.66；颱風夜德叔站在黑板前，
// 手機約擋住 1.26～1.78、桌機約 1.29～1.62。原本「今日手沖」在臉的高度，兩個畫面都有一兩個字露在他的頭旁邊
function menuText(g, menu) {
  const cx = 1.47; // 字的中線（公尺）
  const line = (text, y, size, color = '#f2ead8', bold = '') => {
    g.fillStyle = color;
    g.font = `${bold}${size}px "PingFang TC","Noto Sans TC",sans-serif`;
    g.fillText(text, cx, y);
  };
  g.textAlign = 'center';
  if (menu.includes('zhe-beans')) {
    line('今日手沖', 1.47, 0.064);
    line('東山 日曬', 1.53, 0.05);
    line('阿里山 水洗', 1.585, 0.05);
    line('阿哲的豆', 1.643, 0.058, '#ffd27a', 'bold '); // 「好啦，寫大一點。」
  } else {
    line('今日手沖', 1.49, 0.07);
    line('東山 日曬', 1.565, 0.055);
    line('阿里山 水洗', 1.635, 0.055);
  }
}
// 程式在手繪圖上疊東西：複製一張同樣大小的 canvas，座標用公尺（原點是圖的左上角）
function overlay(a) {
  const c = document.createElement('canvas');
  c.width = a.width; c.height = a.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(a, 0, 0);
  g.scale(a.ppm, a.ppm);
  g.lineJoin = 'round'; g.lineCap = 'round';
  c.ppm = a.ppm; c.art = a.art;
  return { c, g };
}

// menu：菜單上的東西（阿哲的豆上架後，小黑板多一行）
export function backBar(wm, hm, menu = []) {
  // 手繪的層架：黑板（x 0.95～1.85、y 1.15～1.65 公尺）留空，菜單的字由程式寫
  const a = room('backbar');
  if (a) {
    const { c, g } = overlay(a);
    menuText(g, menu);
    return c;
  }
  // 吧台後方牆上的層架與罐子
  const { c, g } = canvas(wm, hm);
  const r = rng(5);
  for (let i = 0; i < 2; i++) {
    const y = 0.45 + i * 0.5;
    g.fillStyle = '#6b4630';
    g.fillRect(0.1, y, wm - 0.2, 0.05);
    for (let x = 0.2; x < wm - 0.3; x += 0.22 + r() * 0.1) {
      const h = 0.14 + r() * 0.12;
      rr(g, x, y - h, 0.12, h, 0.02);
      g.fillStyle = ['#c9a77c', '#7b5a43', '#d9c6a3', '#5e7b6a'][Math.floor(r() * 4)];
      g.fill();
      outline(g, 0.01);
    }
  }
  // 小黑板
  rr(g, wm / 2 - 0.45, 1.15, 0.9, 0.5, 0.03);
  g.fillStyle = '#2f3a33'; g.fill(); outline(g, 0.02);
  menuText(g, menu);
  return c;
}

// 老溫度計。手繪的木框已經畫了「溫度」與 20～37°C 的刻度（20°C 在 0.7 公尺、37°C 在 0.16 公尺），玻璃管、水銀與數字由程式畫
export function thermometer(temp) {
  const a = room('thermometer_frame');
  let c, g;
  if (a) ({ c, g } = overlay(a));
  else {
    ({ c, g } = canvas(0.36, 0.9));
    rr(g, 0.03, 0.02, 0.3, 0.86, 0.05);
    g.fillStyle = '#e8d7b5'; g.fill(); outline(g, 0.015);
    g.fillStyle = INK;
    g.font = 'bold 0.05px "PingFang TC","Noto Sans TC",sans-serif';
    g.textAlign = 'center';
    g.fillText('溫度', 0.18, 0.1);
  }
  rr(g, 0.165, 0.14, 0.03, 0.58, 0.015);
  g.fillStyle = a ? 'rgba(255,255,255,0.75)' : '#fff'; g.fill(); outline(g, 0.006);
  const t = Math.max(20, Math.min(37, temp));
  const top = 0.7 - ((t - 20) / 17) * 0.54;
  g.fillStyle = '#c4382c';
  g.fillRect(0.171, top, 0.018, 0.74 - top);
  ell(g, 0.18, 0.76, 0.04, 0.04); g.fill(); outline(g, 0.008);
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.font = `${a ? 'bold ' : ''}0.045px "PingFang TC","Noto Sans TC",sans-serif`;
  g.fillText(t.toFixed(1) + '°', 0.18, 0.86);
  return c;
}

/* ---------- 紙片人物與擺飾（底部置中為原點） ---------- */

// 德叔：idle 站著、pour 沖煮（brew）、serve 端杯子、smile 笑（只有眼角在動）、thermo 拿著老溫度計、sit 坐著（目前沒有用到）；
// wipe／wipe2（打烊後擦琺瑯杯）沒有對應的手繪圖，用手上捧著杯子的 serve
const DESHU_ART = { idle: 'stand', pour: 'brew', wipe: 'serve', wipe2: 'serve', serve: 'serve', smile: 'smile', thermo: 'thermo', sit: 'sit' };
export function deshu(pose) {
  return art(`char_deshu_${DESHU_ART[pose] || 'stand'}`) || drawDeshu(pose);
}
function drawDeshu(pose) {
  // 德叔：白襯衫、深咖啡背心、灰白頭髮
  const W = 0.9, H = 1.8;
  const { c, g } = canvas(W, H, HI);
  const cx = W / 2;
  // 褲子
  rr(g, cx - 0.17, 1.05, 0.15, 0.73, 0.04); g.fillStyle = '#3d3a3a'; g.fill(); outline(g);
  rr(g, cx + 0.02, 1.05, 0.15, 0.73, 0.04); g.fill(); outline(g);
  // 身體
  rr(g, cx - 0.22, 0.48, 0.44, 0.65, 0.1); g.fillStyle = '#f7f4ee'; g.fill(); outline(g);
  g.beginPath();
  g.moveTo(cx - 0.2, 0.55); g.lineTo(cx - 0.06, 0.55); g.lineTo(cx, 0.72); g.lineTo(cx + 0.06, 0.55);
  g.lineTo(cx + 0.2, 0.55); g.lineTo(cx + 0.2, 1.1); g.lineTo(cx - 0.2, 1.1); g.closePath();
  g.fillStyle = '#5b3a29'; g.fill(); outline(g);
  g.fillStyle = '#d8c6a8';
  for (const y of [0.78, 0.88, 0.98]) { ell(g, cx, y, 0.012, 0.012); g.fill(); }
  // 手臂
  g.fillStyle = '#f7f4ee';
  const wiping = pose === 'wipe' || pose === 'wipe2';
  if (wiping) {
    // 擦琺瑯杯：兩隻手在胸前，一手拿杯、一手拿布（wipe2 是布擦到另一邊）
    rr(g, cx - 0.31, 0.52, 0.11, 0.3, 0.05); g.fill(); outline(g);
    rr(g, cx + 0.2, 0.52, 0.11, 0.3, 0.05); g.fill(); outline(g);
    g.save(); g.translate(cx - 0.27, 0.8); g.rotate(-0.85);
    rr(g, 0, -0.05, 0.22, 0.1, 0.05); g.fill(); outline(g); g.restore();
    g.save(); g.translate(cx + 0.27, 0.8); g.rotate(Math.PI + 0.85);
    rr(g, 0, -0.05, 0.22, 0.1, 0.05); g.fill(); outline(g); g.restore();
    enamelCup(g, cx - 0.07, 0.5);
    const off = pose === 'wipe2' ? -0.05 : 0.03;
    g.beginPath(); g.moveTo(cx + off, 0.52); g.quadraticCurveTo(cx + off + 0.08, 0.49, cx + off + 0.13, 0.54);
    g.lineTo(cx + off + 0.12, 0.66); g.quadraticCurveTo(cx + off + 0.05, 0.69, cx + off - 0.01, 0.64); g.closePath();
    g.fillStyle = '#e6dcc4'; g.fill(); outline(g, 0.012);
    g.fillStyle = '#e9c3a0';
    ell(g, cx - 0.1, 0.64, 0.045, 0.045); g.fill(); outline(g, 0.012);
    ell(g, cx + off + 0.08, 0.6, 0.045, 0.045); g.fill(); outline(g, 0.012);
  } else {
    rr(g, cx - 0.31, 0.52, 0.11, 0.42, 0.05); g.fill(); outline(g);
  }
  if (wiping) {
    // 手已經畫在胸前
  } else if (pose === 'pour') {
    g.save(); g.translate(cx + 0.2, 0.56); g.rotate(-1.0);
    rr(g, 0, -0.05, 0.4, 0.11, 0.05); g.fill(); outline(g);
    g.restore();
    g.fillStyle = '#e9c3a0';
    ell(g, cx + 0.43, 0.23, 0.05, 0.05); g.fill(); outline(g, 0.012);
  } else {
    rr(g, cx + 0.2, 0.52, 0.11, 0.42, 0.05); g.fill(); outline(g);
  }
  // 手
  g.fillStyle = '#e9c3a0';
  if (!wiping) { ell(g, cx - 0.255, 0.96, 0.05, 0.05); g.fill(); outline(g, 0.012); }
  if (pose !== 'pour' && !wiping) { ell(g, cx + 0.255, 0.96, 0.05, 0.05); g.fill(); outline(g, 0.012); }
  // 頭
  ell(g, cx, 0.3, 0.15, 0.17); g.fillStyle = '#e9c3a0'; g.fill(); outline(g);
  g.beginPath();
  g.ellipse(cx, 0.22, 0.16, 0.11, 0, Math.PI, Math.PI * 2);
  g.fillStyle = '#c9c6c0'; g.fill(); outline(g);
  // 臉
  g.strokeStyle = INK; g.lineWidth = 0.014;
  g.beginPath(); g.moveTo(cx - 0.08, 0.31); g.lineTo(cx - 0.035, 0.31); g.stroke();
  g.beginPath(); g.moveTo(cx + 0.035, 0.31); g.lineTo(cx + 0.08, 0.31); g.stroke();
  g.beginPath(); g.moveTo(cx - 0.05, 0.39); g.quadraticCurveTo(cx, 0.405, cx + 0.05, 0.39);
  g.strokeStyle = '#8a8580'; g.lineWidth = 0.022; g.stroke();
  return c;
}

// 那個舊的琺瑯杯：白底、綠杯緣（Q59：和 prop_cup 一樣白杯綠邊），有一點掉漆（x, y 是杯子左上角）
function enamelCup(g, x, y) {
  rr(g, x, y, 0.13, 0.12, 0.02); g.fillStyle = '#f4f2ec'; g.fill(); outline(g, 0.012);
  g.fillStyle = '#3d6b4f'; g.fillRect(x + 0.005, y, 0.12, 0.018);
  g.beginPath(); g.arc(x + 0.135, y + 0.06, 0.03, -1.3, 1.3); g.strokeStyle = '#3d6b4f'; g.lineWidth = 0.014; g.stroke();
  g.fillStyle = '#4a4440'; ell(g, x + 0.03, y + 0.09, 0.008, 0.006); g.fill(); // 掉漆的一小塊
}

// 龍眼：sleep 睡覺、sit 坐著、walk 走路（Canvas 版沒有走路的圖，用坐著的）
export function cat(pose) {
  return art(`cat_longan_${pose === 'sleep' || pose === 'walk' ? pose : 'sit'}`) || drawCat(pose);
}
function drawCat(pose) {
  // 龍眼：橘貓
  const { c, g } = canvas(0.6, 0.45, HI);
  const o = '#e8913a';
  if (pose === 'sleep') {
    ell(g, 0.3, 0.33, 0.24, 0.1); g.fillStyle = o; g.fill(); outline(g, 0.012);
    ell(g, 0.12, 0.3, 0.09, 0.08); g.fill(); outline(g, 0.012);
    g.beginPath(); g.moveTo(0.06, 0.25); g.lineTo(0.07, 0.19); g.lineTo(0.11, 0.23); g.fill(); outline(g, 0.01);
    g.beginPath(); g.moveTo(0.14, 0.23); g.lineTo(0.18, 0.19); g.lineTo(0.19, 0.25); g.fill(); outline(g, 0.01);
    g.strokeStyle = INK; g.lineWidth = 0.008;
    g.beginPath(); g.moveTo(0.08, 0.3); g.quadraticCurveTo(0.1, 0.31, 0.11, 0.3); g.stroke();
    g.beginPath(); g.moveTo(0.48, 0.38); g.quadraticCurveTo(0.58, 0.4, 0.5, 0.42); g.strokeStyle = o; g.lineWidth = 0.04; g.stroke();
    g.strokeStyle = '#c96f22'; g.lineWidth = 0.012;
    for (const x of [0.28, 0.35, 0.42]) { g.beginPath(); g.moveTo(x, 0.24); g.lineTo(x - 0.02, 0.3); g.stroke(); }
  } else {
    ell(g, 0.3, 0.32, 0.13, 0.12); g.fillStyle = o; g.fill(); outline(g, 0.012);
    ell(g, 0.3, 0.15, 0.1, 0.09); g.fill(); outline(g, 0.012);
    g.beginPath(); g.moveTo(0.21, 0.11); g.lineTo(0.22, 0.03); g.lineTo(0.27, 0.08); g.fill(); outline(g, 0.01);
    g.beginPath(); g.moveTo(0.33, 0.08); g.lineTo(0.38, 0.03); g.lineTo(0.39, 0.11); g.fill(); outline(g, 0.01);
    g.fillStyle = INK;
    ell(g, 0.265, 0.15, 0.012, 0.016); g.fill();
    ell(g, 0.335, 0.15, 0.012, 0.016); g.fill();
    g.beginPath(); g.moveTo(0.42, 0.4); g.quadraticCurveTo(0.55, 0.38, 0.5, 0.25); g.strokeStyle = o; g.lineWidth = 0.04; g.stroke();
  }
  return c;
}

// 予安：坐著寫稿的作家。pose：'type'（看筆電）、'napkin'（借了筆在紙巾上寫字）、'read'（念稿子）、'book'（拿著剛印好的書）
// 手繪圖只有坐著開筆電（sit）與站著抱一本書（stand）：念稿、借筆用坐著的；拿書、拿裱框的紙巾、走路用站著的。
// 接正式美術第二批：坐著時，手繪的椅子（同樣 3/4 側面）畫進她的圖裡、椅面對準臀部；她不在或站起來時，店裡那張空椅子（main.js 的 yuanChair）才出現
export function yuan(pose = 'type') {
  const stand = pose === 'book' || pose === 'frame' || pose === 'stand';
  return art(`char_yuan_${stand ? 'stand' : 'sit'}`, stand ? null : 'chair') || drawYuan(pose);
}
function drawYuan(pose) {
  const { c, g } = canvas(0.8, 1.35, HI);
  const cx = 0.4;
  rr(g, cx - 0.18, 0.5, 0.36, 0.5, 0.1); g.fillStyle = '#7c8f9e'; g.fill(); outline(g);
  rr(g, cx - 0.2, 0.95, 0.4, 0.14, 0.05); g.fillStyle = '#d9cbb3'; g.fill(); outline(g);
  rr(g, cx - 0.15, 1.05, 0.11, 0.28, 0.04); g.fillStyle = '#4b4a52'; g.fill(); outline(g);
  rr(g, cx + 0.04, 1.05, 0.11, 0.28, 0.04); g.fill(); outline(g);
  ell(g, cx, 0.32, 0.13, 0.15); g.fillStyle = '#efc9a6'; g.fill(); outline(g);
  g.beginPath(); g.ellipse(cx, 0.3, 0.16, 0.19, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fillStyle = '#2d2420'; g.fill();
  rr(g, cx - 0.16, 0.25, 0.07, 0.3, 0.03); g.fill();
  rr(g, cx + 0.09, 0.25, 0.07, 0.3, 0.03); g.fill();
  g.strokeStyle = INK; g.lineWidth = 0.012;
  g.beginPath(); g.moveTo(cx - 0.06, 0.34); g.lineTo(cx - 0.02, 0.35); g.stroke();
  g.beginPath(); g.moveTo(cx + 0.02, 0.35); g.lineTo(cx + 0.06, 0.34); g.stroke();
  const hand = (x, y) => { ell(g, x, y, 0.04, 0.04); g.fillStyle = '#efc9a6'; g.fill(); outline(g, 0.01); };
  if (pose === 'napkin') {
    // 紙巾在腿上，一手拿筆
    g.save(); g.translate(cx + 0.02, 0.86); g.rotate(-0.12);
    rr(g, -0.12, -0.06, 0.24, 0.13, 0.01); g.fillStyle = '#fbfaf5'; g.fill(); outline(g, 0.01);
    g.strokeStyle = 'rgba(40,40,60,.6)'; g.lineWidth = 0.006;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-0.1, -0.035 + k * 0.028); g.lineTo(0.06 + (k % 2) * 0.04, -0.035 + k * 0.028); g.stroke(); }
    g.restore();
    hand(cx - 0.1, 0.86);
    g.strokeStyle = '#2e4b7a'; g.lineWidth = 0.014; g.beginPath(); g.moveTo(cx + 0.1, 0.84); g.lineTo(cx + 0.16, 0.74); g.stroke();
    hand(cx + 0.1, 0.86);
  } else if (pose === 'read') {
    // 雙手拿著幾張稿紙
    g.save(); g.translate(cx, 0.68); g.rotate(0.05);
    rr(g, -0.13, -0.1, 0.26, 0.2, 0.01); g.fillStyle = '#fbf6e8'; g.fill(); outline(g, 0.01);
    g.strokeStyle = 'rgba(60,40,30,.5)'; g.lineWidth = 0.006;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-0.1, -0.06 + k * 0.03); g.lineTo(0.1, -0.06 + k * 0.03); g.stroke(); }
    g.restore();
    hand(cx - 0.13, 0.72); hand(cx + 0.13, 0.72);
  } else if (pose === 'book') {
    // 拿著剛印好的書，封面朝外
    rr(g, cx - 0.12, 0.6, 0.24, 0.3, 0.015); g.fillStyle = '#c2683f'; g.fill(); outline(g, 0.012);
    rr(g, cx - 0.08, 0.66, 0.16, 0.05, 0.01); g.fillStyle = '#f3e7cf'; g.fill();
    ell(g, cx, 0.8, 0.05, 0.035); g.fillStyle = 'rgba(255,240,210,.7)'; g.fill(); // 封面上的一縷煙
    hand(cx - 0.13, 0.8); hand(cx + 0.13, 0.8);
  } else if (pose === 'frame') {
    // 拿著裱了框的紙巾（告別那天）
    rr(g, cx - 0.15, 0.58, 0.3, 0.26, 0.01); g.fillStyle = '#7a5532'; g.fill(); outline(g, 0.012);
    rr(g, cx - 0.12, 0.61, 0.24, 0.2, 0.005); g.fillStyle = '#fbfaf5'; g.fill();
    g.strokeStyle = 'rgba(40,45,70,.6)'; g.lineWidth = 0.005;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(cx - 0.1, 0.64 + k * 0.032); g.lineTo(cx + 0.04 + (k % 2) * 0.05, 0.64 + k * 0.032); g.stroke(); }
    hand(cx - 0.15, 0.78); hand(cx + 0.15, 0.78);
  }
  return c;
}

export function chair() {
  const a = room('chair'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.5, 0.95);
  drawChair(g);
  return c;
}
// 椅子本體（公尺，0.5×0.95，椅面上緣離地 0.45）：手繪的坐姿底下也用它
function drawChair(g) {
  g.fillStyle = '#8a5a3b';
  rr(g, 0.06, 0.02, 0.38, 0.08, 0.03); g.fill(); outline(g);
  rr(g, 0.06, 0.02, 0.05, 0.55, 0.02); g.fill(); outline(g);
  rr(g, 0.39, 0.02, 0.05, 0.55, 0.02); g.fill(); outline(g);
  for (const y of [0.2, 0.32]) { rr(g, 0.1, y, 0.3, 0.04, 0.02); g.fill(); outline(g, 0.012); }
  rr(g, 0.03, 0.5, 0.44, 0.08, 0.03); g.fillStyle = '#a06b46'; g.fill(); outline(g);
  g.fillStyle = '#8a5a3b';
  rr(g, 0.06, 0.56, 0.05, 0.38, 0.02); g.fill(); outline(g);
  rr(g, 0.39, 0.56, 0.05, 0.38, 0.02); g.fill(); outline(g);
}

export function stool() {
  const a = room('stool'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.45, 0.8);
  drawStool(g);
  return c;
}
// 高腳椅本體（公尺，0.45×0.8，椅面約離地 0.73，腳踏橫桿約 0.28）
function drawStool(g) {
  ell(g, 0.225, 0.08, 0.18, 0.06); g.fillStyle = '#a06b46'; g.fill(); outline(g);
  g.fillStyle = '#4a4744';
  rr(g, 0.08, 0.1, 0.04, 0.69, 0.02); g.fill(); outline(g, 0.012);
  rr(g, 0.33, 0.1, 0.04, 0.69, 0.02); g.fill(); outline(g, 0.012);
  rr(g, 0.1, 0.5, 0.25, 0.03, 0.01); g.fill(); outline(g, 0.012);
}

export function sofa() {
  const a = room('sofa'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(1.5, 0.9);
  rr(g, 0.1, 0.05, 1.3, 0.5, 0.12); g.fillStyle = '#5f7b6a'; g.fill(); outline(g);
  rr(g, 0.02, 0.35, 0.22, 0.45, 0.08); g.fill(); outline(g);
  rr(g, 1.26, 0.35, 0.22, 0.45, 0.08); g.fill(); outline(g);
  rr(g, 0.2, 0.45, 1.1, 0.25, 0.08); g.fillStyle = '#6f8d7a'; g.fill(); outline(g);
  rr(g, 0.2, 0.62, 1.1, 0.18, 0.05); g.fillStyle = '#4f6858'; g.fill(); outline(g);
  rr(g, 0.3, 0.2, 0.3, 0.25, 0.08); g.fillStyle = '#e6c46e'; g.fill(); outline(g, 0.012);
  g.fillStyle = '#3b2a20';
  rr(g, 0.15, 0.8, 0.06, 0.1, 0.02); g.fill();
  rr(g, 1.29, 0.8, 0.06, 0.1, 0.02); g.fill();
  return c;
}

export function plant() {
  const a = room('plant'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.8, 1.4);
  const r = rng(9);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
    const L = 0.25 + r() * 0.3;
    const x = 0.4 + Math.cos(a) * L, y = 0.75 + Math.sin(a) * L;
    g.beginPath(); g.moveTo(0.4, 1.0); g.quadraticCurveTo(0.4, y + 0.2, x, y);
    g.strokeStyle = '#4c6a3a'; g.lineWidth = 0.02; g.stroke();
    g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
    ell(g, 0, 0, 0.08, 0.15);
    g.fillStyle = i % 2 ? '#5f8f4a' : '#4f7d3e'; g.fill(); outline(g, 0.012);
    g.restore();
  }
  g.beginPath(); g.moveTo(0.22, 1.0); g.lineTo(0.58, 1.0); g.lineTo(0.53, 1.38); g.lineTo(0.27, 1.38); g.closePath();
  g.fillStyle = '#c2734a'; g.fill(); outline(g);
  return c;
}

export function bookshelf() {
  const a = room('bookshelf'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(1.0, 1.9);
  rr(g, 0.02, 0.02, 0.96, 1.86, 0.03); g.fillStyle = '#7a5038'; g.fill(); outline(g);
  const r = rng(21);
  for (let s = 0; s < 4; s++) {
    const y0 = 0.1 + s * 0.44;
    g.fillStyle = '#4a2f21';
    g.fillRect(0.08, y0, 0.84, 0.36);
    let x = 0.1;
    while (x < 0.86) {
      const w = 0.04 + r() * 0.04, h = 0.24 + r() * 0.1;
      g.fillStyle = ['#b5523b', '#e2c27a', '#5c7f8c', '#8b9a5b', '#e9e0cf', '#6b4a7a'][Math.floor(r() * 6)];
      g.fillRect(x, y0 + 0.36 - h, w, h);
      x += w + 0.008;
    }
  }
  return c;
}

export function recordPlayer() {
  const a = room('recordPlayer'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.7, 0.85);
  rr(g, 0.05, 0.3, 0.6, 0.52, 0.03); g.fillStyle = '#8c5d3f'; g.fill(); outline(g);
  rr(g, 0.1, 0.38, 0.5, 0.18, 0.02); g.fillStyle = '#6b452f'; g.fill(); outline(g, 0.012);
  rr(g, 0.02, 0.18, 0.66, 0.13, 0.03); g.fillStyle = '#3a2a22'; g.fill(); outline(g);
  ell(g, 0.32, 0.22, 0.2, 0.05); g.fillStyle = '#151515'; g.fill();
  ell(g, 0.32, 0.22, 0.05, 0.015); g.fillStyle = '#c4382c'; g.fill();
  g.beginPath(); g.moveTo(0.58, 0.2); g.lineTo(0.45, 0.14); g.lineTo(0.38, 0.2); outline(g, 0.012);
  return c;
}

export function floorLamp(on) {
  const a = room(on ? 'floorLamp_on' : 'floorLamp_off');
  if (a) return a;
  const { c, g } = canvas(0.6, 1.7);
  if (on) {
    const grd = g.createRadialGradient(0.3, 0.25, 0.02, 0.3, 0.25, 0.3);
    grd.addColorStop(0, 'rgba(255,214,150,0.9)');
    grd.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 0.6, 0.6);
  }
  g.beginPath(); g.moveTo(0.16, 0.38); g.lineTo(0.44, 0.38); g.lineTo(0.38, 0.12); g.lineTo(0.22, 0.12); g.closePath();
  g.fillStyle = on ? '#ffe2b0' : '#efe1c4'; g.fill(); outline(g);
  rr(g, 0.285, 0.38, 0.03, 1.22, 0.01); g.fillStyle = '#3a3330'; g.fill();
  ell(g, 0.3, 1.62, 0.13, 0.04); g.fill(); outline(g, 0.012);
  return c;
}

export function menuBoard() {
  const a = room('menuBoard'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.6, 1.0);
  g.strokeStyle = '#6b452f'; g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(0.1, 0.98); g.lineTo(0.18, 0.05); g.moveTo(0.5, 0.98); g.lineTo(0.42, 0.05); g.stroke();
  rr(g, 0.08, 0.05, 0.44, 0.62, 0.03); g.fillStyle = '#2f3a33'; g.fill(); outline(g);
  g.fillStyle = '#f2ead8';
  g.font = '0.06px "PingFang TC","Noto Sans TC",sans-serif';
  g.textAlign = 'center';
  g.fillText('營業中', 0.3, 0.17);
  g.font = '0.045px "PingFang TC","Noto Sans TC",sans-serif';
  g.fillText('不限時', 0.3, 0.3);
  g.fillText('慢慢等', 0.3, 0.4);
  g.fillText('咖啡也在等你', 0.3, 0.5);
  return c;
}

/* ---------- 德叔的型錄：階段 2 新增的擺飾（之後換手繪只改這些同名函式） ---------- */

// 小邊桌（小擺飾放在上面，免得直接擺在地上）
function sideTable(g, cx, top, w = 0.4, h = 0.55) {
  rr(g, cx - w / 2, top, w, 0.05, 0.02); g.fillStyle = '#8a5a3b'; g.fill(); outline(g);
  g.fillStyle = '#6b452f';
  rr(g, cx - w / 2 + 0.04, top + 0.05, 0.035, h - 0.05, 0.01); g.fill(); outline(g, 0.012);
  rr(g, cx + w / 2 - 0.075, top + 0.05, 0.035, h - 0.05, 0.01); g.fill(); outline(g, 0.012);
}

export function longanJar() {
  const a = room('longanJar'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 龍眼乾玻璃罐，放在小邊桌上
  const { c, g } = canvas(0.5, 0.95);
  sideTable(g, 0.25, 0.4);
  rr(g, 0.13, 0.13, 0.24, 0.27, 0.05); g.fillStyle = 'rgba(214,236,242,0.75)'; g.fill(); outline(g, 0.012);
  const r = rng(31);
  for (let i = 0; i < 16; i++) { ell(g, 0.16 + r() * 0.18, 0.22 + r() * 0.15, 0.025, 0.022); g.fillStyle = i % 2 ? '#8a4e22' : '#6e3b18'; g.fill(); }
  rr(g, 0.15, 0.08, 0.2, 0.06, 0.02); g.fillStyle = '#c4382c'; g.fill(); outline(g, 0.012);
  rr(g, 0.17, 0.27, 0.16, 0.07, 0.01); g.fillStyle = '#f2ead8'; g.fill();
  g.fillStyle = INK; g.font = '0.04px "PingFang TC","Noto Sans TC",sans-serif'; g.textAlign = 'center';
  g.fillText('龍眼乾', 0.25, 0.325);
  return c;
}

export function succulent() {
  const a = room('succulent'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 小花架上的三盆多肉
  const { c, g } = canvas(0.5, 1.0);
  g.strokeStyle = '#6b452f'; g.lineWidth = 0.03;
  g.beginPath(); g.moveTo(0.12, 0.98); g.lineTo(0.16, 0.35); g.moveTo(0.38, 0.98); g.lineTo(0.34, 0.35); g.stroke();
  for (const y of [0.35, 0.68]) { rr(g, 0.08, y, 0.34, 0.04, 0.01); g.fillStyle = '#8a5a3b'; g.fill(); outline(g, 0.012); }
  const pot = (x, y, s) => {
    for (let i = 0; i < 5; i++) {
      g.save(); g.translate(x, y); g.rotate(-1 + i * 0.5);
      ell(g, 0, -0.035 * s, 0.022 * s, 0.045 * s); g.fillStyle = i % 2 ? '#7fae7a' : '#6a9a68'; g.fill(); outline(g, 0.008);
      g.restore();
    }
    g.beginPath(); g.moveTo(x - 0.05 * s, y); g.lineTo(x + 0.05 * s, y); g.lineTo(x + 0.04 * s, y + 0.07 * s); g.lineTo(x - 0.04 * s, y + 0.07 * s); g.closePath();
    g.fillStyle = '#c2734a'; g.fill(); outline(g, 0.01);
  };
  pot(0.17, 0.28, 1); pot(0.33, 0.28, 0.9); pot(0.25, 0.61, 1.1);
  return c;
}

export function bookStack() {
  const a = room('bookStack'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 地上的一疊舊書
  const { c, g } = canvas(0.5, 0.5);
  const r = rng(41);
  let y = 0.48;
  for (let i = 0; i < 7; i++) {
    const h = 0.045 + r() * 0.025, w = 0.3 + r() * 0.12, x = 0.25 - w / 2 + (r() - 0.5) * 0.05;
    y -= h;
    rr(g, x, y, w, h, 0.008);
    g.fillStyle = ['#b5523b', '#e2c27a', '#5c7f8c', '#8b9a5b', '#e9e0cf', '#6b4a7a'][i % 6]; g.fill(); outline(g, 0.01);
  }
  return c;
}

export function coffeeSack() {
  const a = room('coffeeSack'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 印著「東山」的生豆麻布袋
  const { c, g } = canvas(0.6, 0.75);
  g.beginPath();
  g.moveTo(0.12, 0.12); g.quadraticCurveTo(0.3, 0.02, 0.48, 0.12);
  g.quadraticCurveTo(0.6, 0.45, 0.54, 0.72); g.lineTo(0.06, 0.72); g.quadraticCurveTo(0, 0.45, 0.12, 0.12);
  g.fillStyle = '#c9a77c'; g.fill(); outline(g);
  g.strokeStyle = 'rgba(110,80,50,0.35)'; g.lineWidth = 0.006;
  for (let x = 0.1; x < 0.55; x += 0.035) { g.beginPath(); g.moveTo(x, 0.15); g.lineTo(x, 0.7); g.stroke(); }
  ell(g, 0.3, 0.12, 0.13, 0.04); g.fillStyle = '#6b4428'; g.fill(); outline(g, 0.01);
  g.fillStyle = '#7a3a24'; g.font = 'bold 0.1px "PingFang TC","Noto Sans TC",sans-serif'; g.textAlign = 'center';
  g.fillText('東山', 0.3, 0.46);
  g.font = '0.04px "PingFang TC","Noto Sans TC",sans-serif';
  g.fillText('TAINAN COFFEE', 0.3, 0.55);
  return c;
}

export function catCushion() {
  const a = room('catCushion'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 窗邊的貓咪軟墊
  const { c, g } = canvas(0.7, 0.3);
  ell(g, 0.35, 0.19, 0.32, 0.1); g.fillStyle = '#d98f6a'; g.fill(); outline(g);
  ell(g, 0.35, 0.16, 0.24, 0.06); g.fillStyle = '#f0c49a'; g.fill(); outline(g, 0.012);
  g.fillStyle = '#d98f6a';
  for (const x of [0.25, 0.35, 0.45]) { ell(g, x, 0.16, 0.018, 0.014); g.fill(); }
  return c;
}

export function easel() {
  const a = room('easel'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 畫架：畫的是窗外那片山（畫得不太像）
  const { c, g } = canvas(0.7, 1.5);
  g.strokeStyle = '#8a5a3b'; g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(0.12, 1.48); g.lineTo(0.33, 0.05); g.lineTo(0.58, 1.48); g.moveTo(0.35, 0.3); g.lineTo(0.42, 1.4); g.stroke();
  rr(g, 0.08, 0.2, 0.54, 0.44, 0.01); g.fillStyle = '#f6f0e2'; g.fill(); outline(g);
  g.beginPath(); g.moveTo(0.1, 0.5);
  for (let x = 0.1; x <= 0.6; x += 0.05) g.lineTo(x, 0.42 + Math.sin(x * 12) * 0.04);
  g.lineTo(0.6, 0.62); g.lineTo(0.1, 0.62); g.closePath(); g.fillStyle = '#8fb38a'; g.fill();
  ell(g, 0.5, 0.3, 0.04, 0.04); g.fillStyle = '#f2b45a'; g.fill();
  g.fillStyle = '#4f7d4a'; ell(g, 0.2, 0.56, 0.06, 0.05); g.fill();
  rr(g, 0.07, 0.64, 0.56, 0.04, 0.01); g.fillStyle = '#6b452f'; g.fill(); outline(g, 0.012);
  return c;
}

export function radio() {
  const a = room('radio'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 老收音機，放在小邊桌上
  const { c, g } = canvas(0.55, 0.95);
  sideTable(g, 0.275, 0.4, 0.45);
  rr(g, 0.07, 0.12, 0.41, 0.28, 0.06); g.fillStyle = '#9b6a44'; g.fill(); outline(g);
  rr(g, 0.1, 0.16, 0.2, 0.2, 0.03); g.fillStyle = '#e6d3ae'; g.fill(); outline(g, 0.012);
  g.strokeStyle = 'rgba(80,50,30,0.5)'; g.lineWidth = 0.008;
  for (let y = 0.19; y < 0.35; y += 0.025) { g.beginPath(); g.moveTo(0.11, y); g.lineTo(0.29, y); g.stroke(); }
  for (const y of [0.2, 0.31]) { ell(g, 0.39, y, 0.035, 0.035); g.fillStyle = '#4a3326'; g.fill(); outline(g, 0.01); }
  g.beginPath(); g.moveTo(0.4, 0.12); g.lineTo(0.48, 0.0); outline(g, 0.012);
  return c;
}

export function cabinet() {
  const a = room('cabinet'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 老碗櫥：玻璃門後面放著不成套的杯子
  const { c, g } = canvas(0.9, 1.6);
  rr(g, 0.04, 0.04, 0.82, 1.52, 0.03); g.fillStyle = '#7a5038'; g.fill(); outline(g);
  for (const [y, h] of [[0.12, 0.42], [0.6, 0.42]]) {
    rr(g, 0.1, y, 0.7, h, 0.02); g.fillStyle = 'rgba(214,236,242,0.55)'; g.fill(); outline(g, 0.012);
    g.beginPath(); g.moveTo(0.45, y); g.lineTo(0.45, y + h); outline(g, 0.012);
  }
  const r = rng(51);
  for (const y of [0.5, 0.98]) {
    for (let x = 0.16; x < 0.75; x += 0.13) {
      rr(g, x, y - 0.08 - r() * 0.03, 0.08, 0.08, 0.015);
      g.fillStyle = ['#f4f1ea', '#c4382c', '#5c7f8c', '#e2c27a'][Math.floor(r() * 4)]; g.fill(); outline(g, 0.008);
    }
  }
  for (const y of [1.1, 1.3]) { rr(g, 0.1, y, 0.7, 0.17, 0.02); g.fillStyle = '#8a5a3b'; g.fill(); outline(g, 0.012); ell(g, 0.45, y + 0.085, 0.018, 0.018); g.fillStyle = '#d8c6a8'; g.fill(); }
  return c;
}

export function catTree() {
  const a = room('catTree'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 貓跳台：最上面那層是給龍眼看窗外的
  const { c, g } = canvas(0.8, 1.7);
  g.fillStyle = '#d9c6a3';
  rr(g, 0.33, 0.25, 0.1, 1.38, 0.03); g.fill(); outline(g);
  rr(g, 0.15, 0.85, 0.08, 0.75, 0.03); g.fill(); outline(g);
  g.strokeStyle = 'rgba(110,80,50,0.4)'; g.lineWidth = 0.008;
  for (let y = 0.3; y < 1.6; y += 0.04) { g.beginPath(); g.moveTo(0.33, y); g.lineTo(0.43, y + 0.02); g.stroke(); }
  for (const [x, y, w] of [[0.18, 0.18, 0.5], [0.05, 0.78, 0.4], [0.35, 1.1, 0.4]]) { rr(g, x, y, w, 0.08, 0.04); g.fillStyle = '#b5866a'; g.fill(); outline(g); }
  rr(g, 0.05, 1.58, 0.7, 0.1, 0.04); g.fillStyle = '#8a5a3b'; g.fill(); outline(g);
  ell(g, 0.6, 1.26, 0.04, 0.04); g.fillStyle = '#c4382c'; g.fill(); outline(g, 0.01);
  g.beginPath(); g.moveTo(0.6, 1.18); g.lineTo(0.6, 1.22); outline(g, 0.008);
  return c;
}

export function rattanChair() {
  const a = room('rattanChair'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 藤編搖椅
  const { c, g } = canvas(0.8, 1.2);
  rr(g, 0.14, 0.05, 0.52, 0.65, 0.18); g.fillStyle = '#d2a868'; g.fill(); outline(g);
  g.strokeStyle = 'rgba(120,80,30,0.45)'; g.lineWidth = 0.008;
  for (let x = 0.2; x < 0.62; x += 0.04) { g.beginPath(); g.moveTo(x, 0.1); g.lineTo(x, 0.66); g.stroke(); }
  for (let y = 0.12; y < 0.66; y += 0.05) { g.beginPath(); g.moveTo(0.16, y); g.lineTo(0.64, y); g.stroke(); }
  rr(g, 0.1, 0.62, 0.6, 0.14, 0.06); g.fillStyle = '#c99a58'; g.fill(); outline(g);
  rr(g, 0.16, 0.6, 0.48, 0.1, 0.05); g.fillStyle = '#e8d7b5'; g.fill(); outline(g, 0.012);
  g.strokeStyle = '#a77a3e'; g.lineWidth = 0.03;
  g.beginPath(); g.moveTo(0.16, 0.76); g.lineTo(0.12, 1.08); g.moveTo(0.64, 0.76); g.lineTo(0.68, 1.08); g.stroke();
  g.beginPath(); g.moveTo(0.02, 1.06); g.quadraticCurveTo(0.4, 1.2, 0.78, 1.06); g.lineWidth = 0.035; g.stroke();
  return c;
}

export function bookWall() {
  const a = room('bookWall'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 整面書牆：從地板到天花板
  const W = 1.9, H = 2.5; // 寬 1.9 公尺：後牆的窗戶與老溫度計之間剛好放得下
  const { c, g } = canvas(W, H);
  rr(g, 0.02, 0.02, W - 0.04, H - 0.04, 0.03); g.fillStyle = '#6e4632'; g.fill(); outline(g);
  const r = rng(61);
  const rows = 6, rowH = (H - 0.14) / rows;
  for (let s = 0; s < rows; s++) {
    const y0 = 0.08 + s * rowH;
    g.fillStyle = '#41291d';
    g.fillRect(0.08, y0, W - 0.16, rowH - 0.06);
    let x = 0.1;
    while (x < W - 0.14) {
      const w = 0.035 + r() * 0.045, h = rowH * (0.55 + r() * 0.3);
      if (r() < 0.06) { x += 0.12; continue; } // 偶爾空一格，放一個小東西的位置
      g.fillStyle = ['#b5523b', '#e2c27a', '#5c7f8c', '#8b9a5b', '#e9e0cf', '#6b4a7a', '#a77a3e'][Math.floor(r() * 7)];
      g.fillRect(x, y0 + rowH - 0.06 - h, w, h);
      x += w + 0.006;
    }
  }
  // 中間的梯子
  g.strokeStyle = '#a77a3e'; g.lineWidth = 0.035;
  const L = W - 0.75;
  g.beginPath(); g.moveTo(L, 0.3); g.lineTo(L + 0.2, H - 0.05); g.moveTo(L + 0.25, 0.3); g.lineTo(L + 0.45, H - 0.05); g.stroke();
  g.lineWidth = 0.025;
  for (let k = 0; k < 7; k++) { const t = k / 7; g.beginPath(); g.moveTo(L + 0.02 + t * 0.2, 0.5 + t * 1.9); g.lineTo(L + 0.27 + t * 0.2, 0.5 + t * 1.9); g.stroke(); }
  return c;
}

export function kettleSet() {
  const a = room('kettleSet'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  // 吧台上的手沖架與磨豆機
  const { c, g } = canvas(0.7, 0.45, HI);
  rr(g, 0.05, 0.05, 0.16, 0.38, 0.03); g.fillStyle = '#5a4a40'; g.fill(); outline(g, 0.012);
  ell(g, 0.13, 0.06, 0.07, 0.03); g.fillStyle = '#7b6455'; g.fill(); outline(g, 0.012);
  g.beginPath(); g.moveTo(0.32, 0.22); g.lineTo(0.48, 0.22); g.lineTo(0.42, 0.3); g.lineTo(0.38, 0.3); g.closePath();
  g.fillStyle = '#f1efe9'; g.fill(); outline(g, 0.012);
  rr(g, 0.33, 0.3, 0.14, 0.13, 0.03); g.fillStyle = 'rgba(200,220,230,0.8)'; g.fill(); outline(g, 0.012);
  rr(g, 0.52, 0.28, 0.13, 0.15, 0.03); g.fillStyle = '#c8ccd0'; g.fill(); outline(g, 0.012);
  return c;
}

// 吊燈（手繪，0.36×0.9 公尺：電線＋燈罩，燈罩下緣就是圖的底邊）；沒有載到回傳 null，main.js 用原本的立體圓錐。
// glow：夜裡自己發亮的部分，只留燈罩那一段（下面 32%），電線與黃銅燈頭不發亮
export function pendantLamp() {
  const a = room('pendant_lamp');
  if (!a) return null;
  a.glow ??= glowOnly(a, 0.68, 1);
  return a;
}
// 燈自己發亮的部分：只留圖的 y0～y1（圖高的比例）那一段，其他透明（當 emissiveMap 用：燈罩亮、燈桿與電線不亮）
export function glowOnly(a, y0, y1) {
  const c = document.createElement('canvas');
  c.width = a.width; c.height = a.height;
  const g = c.getContext('2d');
  const t = Math.round(a.height * y0), b = Math.round(a.height * y1);
  g.drawImage(a, 0, t, a.width, b - t, 0, t, a.width, b - t);
  c.ppm = a.ppm; c.art = a.art;
  return c;
}

// 桌上的杯墊（手寫菜單卡；窗邊座桌上的焦點）。只有手繪圖，沒有載到就不放
export const coaster = () => room('prop_coaster_menu');

// 琺瑯杯（手繪：白底綠邊，裡面有咖啡）：德叔自己的杯子。Canvas 版是一般的白瓷杯
export function cup() {
  const a = room('prop_cup');
  if (a) return a;
  const { c, g } = canvas(0.2, 0.14, HI);
  ell(g, 0.1, 0.125, 0.09, 0.015); g.fillStyle = '#e8e2d6'; g.fill(); outline(g, 0.008);
  rr(g, 0.045, 0.03, 0.11, 0.09, 0.025); g.fillStyle = '#f6f2ea'; g.fill(); outline(g, 0.008);
  ell(g, 0.1, 0.035, 0.055, 0.012); g.fillStyle = '#5b3420'; g.fill();
  g.beginPath(); g.arc(0.165, 0.07, 0.022, -1.4, 1.4); outline(g, 0.01);
  return c;
}

// 美術評分修正 e：平常的杯子（手繪 prop_cup_daily：米白陶瓷馬克杯、杯緣一圈細的赭黃色線，Q63）。給老闆、熟客與一次客人；
// 琺瑯杯只留給德叔自己的場景。Canvas 版：米白杯身、赭黃杯緣線
export function cupDaily() {
  const a = room('prop_cup_daily');
  if (a) return a;
  const { c, g } = canvas(0.2, 0.14, HI);
  ell(g, 0.1, 0.125, 0.09, 0.015); g.fillStyle = '#e6dcc6'; g.fill(); outline(g, 0.008);
  rr(g, 0.045, 0.03, 0.11, 0.09, 0.025); g.fillStyle = '#f0e6cf'; g.fill(); outline(g, 0.008);
  ell(g, 0.1, 0.035, 0.057, 0.014); g.strokeStyle = '#c8952f'; g.lineWidth = 0.006; g.stroke();
  ell(g, 0.1, 0.035, 0.05, 0.011); g.fillStyle = '#5b3420'; g.fill();
  g.beginPath(); g.arc(0.165, 0.07, 0.022, -1.4, 1.4); outline(g, 0.01);
  return c;
}

export function puff() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export function blob() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(40,25,15,0.45)');
  grd.addColorStop(1, 'rgba(40,25,15,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

// 門口的腳踏墊（承峰 11/3 試玩回饋，D178）：還沒有手繪圖，程式畫一張椰纖墊：深色滾邊、纖維的細紋
export function doorMat() {
  const { c, g } = canvas(0.8, 0.5);
  g.fillStyle = '#4a3324';
  g.fillRect(0, 0, 0.8, 0.5);
  g.fillStyle = '#9a7448';
  g.fillRect(0.04, 0.04, 0.72, 0.42);
  const r = rng(11);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(70,45,25,0.25)' : 'rgba(210,175,120,0.25)';
    g.fillRect(0.04 + r() * 0.71, 0.04 + r() * 0.41, 0.004, 0.012);
  }
  return c;
}

// 溫度上升時溫度計後面的暖光（白色徑向漸層，顏色由材質決定）
export function glow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/* ---------- 開場與信 ---------- */

// 老先生的信封（德叔從吧台抽屜拿出來，放在吧台上）
export function envelope() {
  const a = room('envelope'); // 手繪圖（art2b）：牛皮紙信封、紅色封蠟與郵票；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.26, 0.18, HI);
  rr(g, 0.01, 0.01, 0.24, 0.16, 0.012); g.fillStyle = '#f3e7cf'; g.fill(); outline(g, 0.01);
  g.beginPath(); g.moveTo(0.015, 0.02); g.lineTo(0.13, 0.1); g.lineTo(0.245, 0.02);
  g.strokeStyle = '#b8a07a'; g.lineWidth = 0.008; g.stroke();
  g.fillStyle = '#b5452f'; ell(g, 0.13, 0.1, 0.018, 0.018); g.fill(); // 封蠟
  return c;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, text = '') {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}
// 一張手繪圖鋪滿的 SVG（cover：preserveAspectRatio slice），程式要疊的字與標記畫在同一個座標系（原圖像素）裡
function artSvg(url, w, h, label, fit = 'xMidYMid slice') {
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: fit, role: 'img', 'aria-label': label });
  svg.appendChild(svgEl('image', { href: url, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none' }));
  return svg;
}

// 第二幕：租屋處樓下的信箱，一格露出牛皮紙信封。回傳一個 DOM 元素（opening.js 直接放進按鈕裡）：
// 有手繪圖（art2b：scene_mailboxes，1950×1200）就是 <img>，沒有就是下面 Canvas 畫的 <canvas>
export function mailboxes(label = '') {
  const url = artUrl('scene_mailboxes');
  if (url) {
    const img = document.createElement('img');
    img.src = url; img.alt = label; img.width = 1950; img.height = 1200;
    img.dataset.art = 'scene_mailboxes';
    return img;
  }
  const c = drawMailboxes();
  c.setAttribute('role', 'img'); c.setAttribute('aria-label', label);
  return c;
}
function drawMailboxes() {
  const W = 3.9, H = 2.4; // 美術評分修正 a：下方原本有一條很寬的深色地板，裁掉只留一道邊
  const { c, g } = canvas(W, H);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#3a3f4a'); bg.addColorStop(1, '#262a31');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 樓梯間的日光燈
  g.fillStyle = 'rgba(235,240,230,.9)'; rr(g, W / 2 - 0.6, 0.12, 1.2, 0.08, 0.04); g.fill();
  const light = g.createRadialGradient(W / 2, 0.2, 0.1, W / 2, 0.6, 2.4);
  light.addColorStop(0, 'rgba(220,230,215,.28)'); light.addColorStop(1, 'rgba(220,230,215,0)');
  g.fillStyle = light; g.fillRect(0, 0, W, H);
  // 一整排鐵信箱
  const cols = 4, rows = 3, bw = 0.78, bh = 0.52, x0 = (W - cols * bw) / 2, y0 = 0.62;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = x0 + i * bw, y = y0 + j * bh;
    rr(g, x + 0.03, y + 0.03, bw - 0.06, bh - 0.06, 0.03); g.fillStyle = '#9aa3a8'; g.fill(); outline(g, 0.016);
    g.fillStyle = '#4b5257'; g.fillRect(x + 0.15, y + 0.12, bw - 0.3, 0.035);
    g.fillStyle = '#e9e5da'; g.fillRect(x + 0.2, y + 0.25, 0.22, 0.09);
    g.fillStyle = '#6a7378'; ell(g, x + bw - 0.15, y + bh - 0.14, 0.025, 0.025); g.fill();
  }
  // 自己那一格（第二排第三格）露出牛皮紙信封
  const mx = x0 + 2 * bw, my = y0 + bh;
  g.save(); g.translate(mx + 0.17, my + 0.06); g.rotate(-0.12);
  rr(g, 0, 0, 0.44, 0.3, 0.02); g.fillStyle = '#c7955a'; g.fill(); outline(g, 0.014);
  g.beginPath(); g.moveTo(0, 0.02); g.lineTo(0.22, 0.14); g.lineTo(0.44, 0.02); g.strokeStyle = '#8c6236'; g.lineWidth = 0.012; g.stroke();
  g.restore();
  // 地板
  g.fillStyle = '#1d2026'; g.fillRect(0, y0 + rows * bh + 0.1, W, H);
  return c;
}

// 第三幕：傍晚的 175 縣道，兩旁是龍眼樹，三合院正廳的窗亮著一盞燈，台階上睡著一隻橘貓。回傳一個 DOM 元素：
// 有手繪圖（art2b：scene_county_road，1170×2532）就是鋪滿畫面的 SVG，路牌上的「175」由程式寫（畫師留白）；沒有就是 Canvas
const ROAD_SIGN = { x: 1028, y: 1604, w: 118, h: 86 }; // 路牌空白板面的中心與大小（原圖像素，從圖上量的）
export function countyRoad(label = '') {
  const url = artUrl('scene_county_road');
  if (url) {
    const svg = artSvg(url, 1170, 2532, label);
    svg.dataset.art = 'scene_county_road';
    svg.appendChild(svgEl('text', { x: ROAD_SIGN.x, y: ROAD_SIGN.y + 21, 'text-anchor': 'middle', 'font-size': 60, 'font-weight': 700, fill: '#2f5d8a',
      'font-family': '"PingFang TC","Noto Sans TC",sans-serif', 'letter-spacing': 1 }, '175'));
    return svg;
  }
  const c = drawCountyRoad();
  c.setAttribute('role', 'img'); c.setAttribute('aria-label', label);
  return c;
}
function drawCountyRoad() {
  // 直立的畫面：上面多留天空，下面多留路（手機直立時用 cover 填滿，左右只會切掉一點）
  const W = 3.9, TOPPAD = 1.5, H = 4.2 + TOPPAD + 1.0;
  const { c, g } = canvas(W, H);
  const sky = g.createLinearGradient(0, 0, 0, TOPPAD + 2.2);
  sky.addColorStop(0, '#3c4170'); sky.addColorStop(0.5, '#a9778a'); sky.addColorStop(0.8, '#e09a7a'); sky.addColorStop(1, '#f4c98e');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const rs = rng(5);
  g.fillStyle = 'rgba(255,248,220,.8)';
  for (let i = 0; i < 18; i++) g.fillRect(rs() * W, rs() * TOPPAD * 0.8, 0.012, 0.012); // 第一顆星
  ell(g, 0.9, 0.75, 0.09, 0.09); g.fillStyle = 'rgba(251,240,200,.85)'; g.fill(); // 月亮
  g.translate(0, TOPPAD);
  // 遠山兩層
  for (const [base, amp, col, k] of [[1.35, 0.22, '#8a7c97', 2.1], [1.62, 0.16, '#6f6a7f', 3.3]]) {
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 0.01; x += 0.1) g.lineTo(x, base - Math.sin(x * k) * amp - Math.sin(x * 7.3) * 0.04);
    g.lineTo(W, H); g.closePath(); g.fillStyle = col; g.fill();
  }
  // 地面
  g.fillStyle = '#5d6b48'; g.fillRect(0, 2.05, W, H);
  // 三合院：正廳與左右護龍，紅磚、燕尾屋脊
  rr(g, 0.95, 1.95, 2.0, 0.85, 0.02); g.fillStyle = '#b4553b'; g.fill(); outline(g, 0.02); // 正廳
  g.fillStyle = '#9c4630';
  for (let j = 0; j < 8; j++) for (let x = 0.98 + (j % 2) * 0.08; x < 2.85; x += 0.16) g.fillRect(x, 2.05 + j * 0.1, 0.13, 0.012);
  g.beginPath(); g.moveTo(0.82, 1.98); g.quadraticCurveTo(1.95, 1.84, 3.08, 1.98); g.lineTo(3.16, 1.86); g.lineTo(3.02, 1.92);
  g.quadraticCurveTo(1.95, 1.62, 0.88, 1.92); g.lineTo(0.74, 1.86); g.closePath();
  g.fillStyle = '#5a3a2e'; g.fill(); outline(g, 0.02);
  for (const x of [0.15, 3.0]) { // 護龍
    rr(g, x, 2.3, 0.75, 0.6, 0.02); g.fillStyle = '#a24c34'; g.fill(); outline(g, 0.02);
    g.beginPath(); g.moveTo(x - 0.06, 2.32); g.lineTo(x + 0.375, 2.18); g.lineTo(x + 0.81, 2.32); g.closePath(); g.fillStyle = '#4e342a'; g.fill(); outline(g, 0.016);
  }
  // 亮著的窗：暖光
  const glow = g.createRadialGradient(1.45, 2.32, 0.02, 1.45, 2.32, 0.7);
  glow.addColorStop(0, 'rgba(255,214,140,.75)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
  g.fillStyle = glow; g.fillRect(0.7, 1.7, 1.5, 1.3);
  rr(g, 1.25, 2.16, 0.4, 0.32, 0.02); g.fillStyle = '#ffd68a'; g.fill(); outline(g, 0.018);
  g.strokeStyle = '#5a3a2e'; g.lineWidth = 0.02;
  g.beginPath(); g.moveTo(1.45, 2.16); g.lineTo(1.45, 2.48); g.moveTo(1.25, 2.32); g.lineTo(1.65, 2.32); g.stroke();
  // 門（關著）與台階
  rr(g, 2.05, 2.15, 0.48, 0.65, 0.02); g.fillStyle = '#6d4430'; g.fill(); outline(g, 0.018);
  g.fillStyle = '#d9c09a'; g.fillRect(2.27, 2.15, 0.03, 0.65);
  g.fillStyle = '#9b8f80'; g.fillRect(1.85, 2.8, 0.9, 0.08); g.fillRect(1.78, 2.88, 1.04, 0.08);
  // 台階上睡著的橘貓
  g.drawImage(cat('sleep'), 1.95, 2.66, 0.3, 0.225);
  // 路：從畫面下方彎進來
  const B = H - TOPPAD;
  g.beginPath(); g.moveTo(0.1, B); g.quadraticCurveTo(1.6, 3.4, 1.9, 2.98); g.lineTo(2.7, 2.98); g.quadraticCurveTo(2.6, 3.5, 3.9, B); g.closePath();
  g.fillStyle = '#6c6a66'; g.fill();
  g.strokeStyle = '#efe4c6'; g.lineWidth = 0.025; g.setLineDash([0.12, 0.12]);
  g.beginPath(); g.moveTo(2.0, B); g.quadraticCurveTo(2.1, 3.5, 2.3, 2.98); g.stroke(); g.setLineDash([]);
  // 兩旁的龍眼樹
  const r = rng(11);
  for (const [x, y, s] of [[0.35, 2.75, 0.5], [0.5, 3.35, 0.65], [0.15, 4.1, 0.8], [0.3, 4.9, 0.8], [3.55, 2.7, 0.5], [3.4, 3.3, 0.65], [3.75, 4.1, 0.85], [3.6, 4.9, 0.8]]) {
    g.fillStyle = '#4a3528'; g.fillRect(x - 0.04, y, 0.08, s * 0.7);
    for (let k = 0; k < 6; k++) { ell(g, x + (r() - 0.5) * s, y - r() * s * 0.5, s * (0.35 + r() * 0.2), s * (0.28 + r() * 0.15)); g.fillStyle = ['#3f5f3a', '#4d6e40', '#35502f'][k % 3]; g.fill(); }
    g.fillStyle = '#c99a4c';
    for (let k = 0; k < 5; k++) { ell(g, x + (r() - 0.5) * s, y - r() * s * 0.4, 0.025, 0.025); g.fill(); } // 一串串龍眼
  }
  // 路牌：175
  g.fillStyle = '#7a7a7a'; g.fillRect(2.98, 2.55, 0.03, 0.55);
  rr(g, 2.84, 2.36, 0.32, 0.24, 0.03); g.fillStyle = '#f2f2ee'; g.fill(); outline(g, 0.014);
  g.fillStyle = '#2f5d8a'; g.font = 'bold 0.12px "PingFang TC","Noto Sans TC",sans-serif'; g.textAlign = 'center'; g.fillText('175', 3.0, 2.52);
  return c;
}

/* ---------- 階段 4：熟客（之後換手繪只改這些同名函式） ---------- */

const SKIN = '#e9c3a0';
function face(g, cx, y, opt = {}) {
  g.strokeStyle = INK; g.lineWidth = 0.013;
  g.fillStyle = INK; ell(g, cx - 0.05, y, 0.012, 0.016); g.fill(); ell(g, cx + 0.05, y, 0.012, 0.016); g.fill();
  if (opt.smile) { g.beginPath(); g.moveTo(cx - 0.035, y + 0.07); g.quadraticCurveTo(cx, y + 0.1, cx + 0.035, y + 0.07); g.stroke(); }
}

// 阿哲：返鄉青農，站著。pose：'stand'（帽子、工作服、沾泥的雨鞋）、'muddy'（颱風夜全身是泥）、'towel'（披著德叔給的毛巾）
// 手繪圖：stand、wet（颱風夜全身濕透）；披毛巾（towel）沒有對應的圖，用 wet
export function zhe(pose = 'stand') {
  return art(`char_zhe_${pose === 'stand' ? 'stand' : 'wet'}`) || drawZhe(pose);
}
function drawZhe(pose) {
  const W = 0.9, H = 1.75;
  const { c, g } = canvas(W, H, HI);
  const cx = W / 2;
  const muddy = pose !== 'stand';
  // 褲子與雨鞋
  rr(g, cx - 0.16, 1.0, 0.14, 0.58, 0.04); g.fillStyle = '#41506a'; g.fill(); outline(g);
  rr(g, cx + 0.02, 1.0, 0.14, 0.58, 0.04); g.fill(); outline(g);
  rr(g, cx - 0.18, 1.5, 0.17, 0.23, 0.04); g.fillStyle = '#2f3b33'; g.fill(); outline(g);
  rr(g, cx + 0.01, 1.5, 0.17, 0.23, 0.04); g.fill(); outline(g);
  g.fillStyle = '#7a5532'; // 鞋子上總是泥
  for (const [x, y, r] of [[cx - 0.12, 1.66, 0.04], [cx + 0.1, 1.69, 0.05], [cx - 0.05, 1.7, 0.03]]) { ell(g, x, y, r, r * 0.7); g.fill(); }
  // 上衣：捲起袖子的工作襯衫
  rr(g, cx - 0.21, 0.46, 0.42, 0.62, 0.1); g.fillStyle = muddy ? '#4f6a45' : '#6b8f5a'; g.fill(); outline(g);
  rr(g, cx - 0.3, 0.5, 0.1, 0.36, 0.05); g.fill(); outline(g);
  rr(g, cx + 0.2, 0.5, 0.1, 0.36, 0.05); g.fill(); outline(g);
  g.fillStyle = SKIN;
  rr(g, cx - 0.29, 0.8, 0.08, 0.14, 0.04); g.fill(); outline(g, 0.012);
  rr(g, cx + 0.21, 0.8, 0.08, 0.14, 0.04); g.fill(); outline(g, 0.012);
  // 頭
  ell(g, cx, 0.3, 0.14, 0.16); g.fillStyle = SKIN; g.fill(); outline(g);
  if (pose === 'stand') {
    g.beginPath(); g.ellipse(cx, 0.2, 0.15, 0.09, 0, Math.PI, Math.PI * 2); g.fillStyle = '#c9a34a'; g.fill(); outline(g); // 帽子
    rr(g, cx - 0.02, 0.17, 0.2, 0.045, 0.02); g.fill(); outline(g, 0.012);
    face(g, cx, 0.31, { smile: true });
  } else {
    // 濕透的頭髮貼在額頭上
    g.beginPath(); g.ellipse(cx, 0.24, 0.155, 0.1, 0, Math.PI, Math.PI * 2); g.fillStyle = '#1e1a18'; g.fill();
    for (const x of [-0.08, -0.02, 0.05]) { rr(g, cx + x, 0.22, 0.035, 0.08, 0.015); g.fill(); }
    face(g, cx, 0.33);
    g.fillStyle = 'rgba(110,75,40,.85)'; // 泥
    const r = rng(41);
    for (let k = 0; k < 14; k++) { ell(g, cx - 0.2 + r() * 0.4, 0.5 + r() * 1.1, 0.02 + r() * 0.03, 0.015 + r() * 0.02); g.fill(); }
    ell(g, cx + 0.07, 0.4, 0.03, 0.015); g.fill();
    g.fillStyle = 'rgba(190,215,235,.7)'; // 雨水
    for (let k = 0; k < 6; k++) { ell(g, cx - 0.25 + r() * 0.5, 0.3 + r() * 0.5, 0.008, 0.016); g.fill(); }
  }
  if (pose === 'towel') {
    g.beginPath(); g.moveTo(cx - 0.2, 0.18); g.quadraticCurveTo(cx, 0.05, cx + 0.2, 0.18); g.lineTo(cx + 0.22, 0.75); g.lineTo(cx + 0.12, 0.75);
    g.lineTo(cx + 0.1, 0.42); g.quadraticCurveTo(cx, 0.48, cx - 0.1, 0.42); g.lineTo(cx - 0.12, 0.75); g.lineTo(cx - 0.22, 0.75); g.closePath();
    g.fillStyle = '#f4efe2'; g.fill(); outline(g, 0.014);
    g.strokeStyle = '#c9b48d'; g.lineWidth = 0.01;
    g.beginPath(); g.moveTo(cx - 0.21, 0.68); g.lineTo(cx - 0.13, 0.68); g.moveTo(cx + 0.13, 0.68); g.lineTo(cx + 0.21, 0.68); g.stroke();
  }
  return c;
}

// 凱文：遠距工作的工程師。pose：'walk'（背著電腦包走進來）、'sit'（坐著開筆電、戴耳機）、
// 'closed'（被罵之後把筆電闔上）、'hide'（躲到角落，抱著膝蓋）、'free'（沒帶筆電，捧著一杯熱的）、
// 'shirt'（來面試那天，穿著一件燙過的襯衫，站著）、'apron'（當了店長，繫著圍裙，站著）
// 手繪圖：sit（坐著開筆電、戴耳機；闔上筆電那一下也用它）、stand（走路、面試那天；沒帶筆電的日子 free 與躲到角落 hide
// 也用站著的，因為坐著的圖一定開著筆電，和「以後都不用開會了」對不上）、bar（繫圍裙：當了店長）。
// seat 是 main.js 依他在哪裡決定的（'stool' 吧台的高腳椅、其他 'chair'）：坐著的畫在他底下；free 在吧台時，高腳椅畫在他旁邊。
// 美術評分修正 d2：坐在吧台高腳椅上有自己的圖（char_kevin_barstool，高腳椅畫在圖裡）；沒有載到就照舊在坐姿底下畫一張
export function kevin(pose = 'sit', seat = 'chair') {
  const name = pose === 'sit' || pose === 'closed' ? 'sit' : pose === 'apron' ? 'bar' : 'stand';
  if (name === 'sit' && seat === 'stool') { const b = art('char_kevin_barstool'); if (b) return b; }
  return art(`char_kevin_${name}`, name === 'sit' || pose === 'free' ? seat : null) || drawKevin(pose);
}
function drawKevin(pose) {
  if (pose === 'shirt' || pose === 'apron') return kevinStand(pose);
  const standing = pose === 'walk';
  const W = 0.8, H = standing ? 1.78 : 1.4;
  const { c, g } = canvas(W, H, HI);
  const cx = W / 2;
  const shirt = '#d7dde6';
  if (standing) {
    rr(g, cx - 0.15, 1.0, 0.13, 0.74, 0.04); g.fillStyle = '#343a46'; g.fill(); outline(g);
    rr(g, cx + 0.02, 1.0, 0.13, 0.74, 0.04); g.fill(); outline(g);
    rr(g, cx - 0.26, 0.55, 0.12, 0.38, 0.04); g.fillStyle = '#3f4a5c'; g.fill(); outline(g); // 電腦包
    rr(g, cx - 0.19, 0.48, 0.38, 0.6, 0.1); g.fillStyle = shirt; g.fill(); outline(g);
    rr(g, cx + 0.17, 0.52, 0.09, 0.42, 0.04); g.fill(); outline(g);
    ell(g, cx + 0.215, 0.97, 0.04, 0.04); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
    g.strokeStyle = '#3f4a5c'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(cx - 0.12, 0.5); g.lineTo(cx + 0.1, 1.0); g.stroke();
  } else {
    // 坐在高腳椅上
    g.fillStyle = '#4a4744';
    rr(g, cx - 0.16, 1.05, 0.035, 0.34, 0.01); g.fill(); rr(g, cx + 0.125, 1.05, 0.035, 0.34, 0.01); g.fill();
    ell(g, cx, 1.05, 0.2, 0.05); g.fillStyle = '#a06b46'; g.fill(); outline(g);
    const hide = pose === 'hide';
    rr(g, cx - 0.18, hide ? 0.58 : 0.5, 0.36, 0.5, 0.1); g.fillStyle = shirt; g.fill(); outline(g);
    rr(g, cx - 0.19, 0.92, 0.38, 0.13, 0.05); g.fillStyle = '#343a46'; g.fill(); outline(g);
    rr(g, cx - 0.15, 1.0, 0.11, 0.3, 0.04); g.fill(); outline(g);
    rr(g, cx + 0.04, 1.0, 0.11, 0.3, 0.04); g.fill(); outline(g);
    if (hide) { rr(g, cx - 0.17, 0.72, 0.34, 0.26, 0.1); g.fillStyle = '#343a46'; g.fill(); outline(g); } // 膝蓋抱起來
  }
  // 頭
  const hy = standing ? 0.3 : pose === 'hide' ? 0.42 : 0.33;
  ell(g, cx, hy, 0.13, 0.15); g.fillStyle = SKIN; g.fill(); outline(g);
  g.beginPath(); g.ellipse(cx, hy - 0.06, 0.145, 0.1, 0, Math.PI, Math.PI * 2); g.fillStyle = '#26221f'; g.fill();
  rr(g, cx - 0.06, hy - 0.08, 0.17, 0.05, 0.02); g.fill();
  // 眼鏡
  g.strokeStyle = INK; g.lineWidth = 0.01;
  g.beginPath(); g.roundRect(cx - 0.09, hy - 0.005, 0.07, 0.045, 0.01); g.roundRect(cx + 0.02, hy - 0.005, 0.07, 0.045, 0.01); g.stroke();
  g.beginPath(); g.moveTo(cx - 0.02, hy + 0.015); g.lineTo(cx + 0.02, hy + 0.015); g.stroke();
  const down = pose === 'closed' || pose === 'hide';
  g.beginPath();
  if (down) { g.moveTo(cx - 0.03, hy + 0.09); g.quadraticCurveTo(cx, hy + 0.08, cx + 0.03, hy + 0.09); }
  else { g.moveTo(cx - 0.03, hy + 0.08); g.quadraticCurveTo(cx, pose === 'free' ? hy + 0.1 : hy + 0.085, cx + 0.03, hy + 0.08); }
  g.stroke();
  // 耳機：開會時戴著，被罵之後掛在脖子上，沒帶筆電的日子沒有
  if (pose === 'sit') {
    g.beginPath(); g.arc(cx, hy, 0.16, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = '#222'; g.lineWidth = 0.025; g.stroke();
    rr(g, cx - 0.18, hy - 0.03, 0.05, 0.08, 0.02); g.fillStyle = '#222'; g.fill(); rr(g, cx + 0.13, hy - 0.03, 0.05, 0.08, 0.02); g.fill();
  } else if (down) {
    g.beginPath(); g.arc(cx, hy + 0.2, 0.12, Math.PI * 0.1, Math.PI * 0.9); g.strokeStyle = '#222'; g.lineWidth = 0.022; g.stroke();
  }
  if (!standing) {
    if (pose === 'sit' || pose === 'closed') {
      // 筆電（開著發藍光／闔上）
      if (pose === 'sit') {
        g.beginPath(); g.moveTo(cx - 0.17, 0.82); g.lineTo(cx - 0.13, 0.6); g.lineTo(cx + 0.13, 0.6); g.lineTo(cx + 0.17, 0.82); g.closePath();
        g.fillStyle = '#9aa3ad'; g.fill(); outline(g, 0.012);
        g.fillStyle = 'rgba(140,190,255,.55)'; g.beginPath(); g.moveTo(cx - 0.14, 0.8); g.lineTo(cx - 0.11, 0.63); g.lineTo(cx + 0.11, 0.63); g.lineTo(cx + 0.14, 0.8); g.closePath(); g.fill();
      }
      rr(g, cx - 0.2, 0.82, 0.4, 0.05, 0.015); g.fillStyle = '#7f8892'; g.fill(); outline(g, 0.012);
      ell(g, cx - 0.17, 0.83, 0.04, 0.035); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
      ell(g, cx + 0.17, 0.83, 0.04, 0.035); g.fill(); outline(g, 0.01);
    } else if (pose === 'free') {
      // 捧著一杯熱的
      rr(g, cx - 0.06, 0.7, 0.12, 0.11, 0.025); g.fillStyle = '#f4f1ea'; g.fill(); outline(g, 0.012);
      ell(g, cx - 0.1, 0.77, 0.04, 0.035); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
      ell(g, cx + 0.1, 0.77, 0.04, 0.035); g.fill(); outline(g, 0.01);
    }
  }
  return c;
}

// 凱文的頭：短黑髮、眼鏡；smile 時嘴角往上
function kevinHead(g, cx, hy, smile) {
  ell(g, cx, hy, 0.13, 0.15); g.fillStyle = SKIN; g.fill(); outline(g);
  g.beginPath(); g.ellipse(cx, hy - 0.06, 0.145, 0.1, 0, Math.PI, Math.PI * 2); g.fillStyle = '#26221f'; g.fill();
  rr(g, cx - 0.06, hy - 0.08, 0.17, 0.05, 0.02); g.fill();
  g.strokeStyle = INK; g.lineWidth = 0.01;
  g.beginPath(); g.roundRect(cx - 0.09, hy - 0.005, 0.07, 0.045, 0.01); g.roundRect(cx + 0.02, hy - 0.005, 0.07, 0.045, 0.01); g.stroke();
  g.beginPath(); g.moveTo(cx - 0.02, hy + 0.015); g.lineTo(cx + 0.02, hy + 0.015); g.stroke();
  g.beginPath(); g.moveTo(cx - 0.03, hy + 0.08); g.quadraticCurveTo(cx, smile ? hy + 0.105 : hy + 0.085, cx + 0.03, hy + 0.08); g.stroke();
}

// 凱文站著：'shirt' 燙過的白襯衫（面試那天）、'apron' 繫著深色圍裙（當了店長）
function kevinStand(pose) {
  const W = 0.8, H = 1.78;
  const { c, g } = canvas(W, H, HI);
  const cx = W / 2;
  rr(g, cx - 0.15, 1.0, 0.13, 0.74, 0.04); g.fillStyle = '#343a46'; g.fill(); outline(g);
  rr(g, cx + 0.02, 1.0, 0.13, 0.74, 0.04); g.fill(); outline(g);
  rr(g, cx - 0.19, 0.48, 0.38, 0.6, 0.1); g.fillStyle = '#fbfbf8'; g.fill(); outline(g);
  // 領子與燙出來的摺線
  g.beginPath(); g.moveTo(cx - 0.08, 0.48); g.lineTo(cx, 0.56); g.lineTo(cx + 0.08, 0.48); g.strokeStyle = INK; g.lineWidth = 0.012; g.stroke();
  g.strokeStyle = 'rgba(120,130,150,.45)'; g.lineWidth = 0.008;
  g.beginPath(); g.moveTo(cx - 0.1, 0.6); g.lineTo(cx - 0.1, 1.02); g.moveTo(cx + 0.1, 0.6); g.lineTo(cx + 0.1, 1.02); g.stroke();
  g.fillStyle = '#b9c0cc'; for (const y of [0.64, 0.76, 0.88]) { ell(g, cx, y, 0.009, 0.009); g.fill(); }
  if (pose === 'apron') {
    g.beginPath(); g.moveTo(cx - 0.15, 0.62); g.lineTo(cx + 0.15, 0.62); g.lineTo(cx + 0.19, 1.3); g.lineTo(cx - 0.19, 1.3); g.closePath();
    g.fillStyle = '#4a3a2e'; g.fill(); outline(g, 0.014);
    g.strokeStyle = '#4a3a2e'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(cx - 0.13, 0.62); g.lineTo(cx - 0.06, 0.48); g.moveTo(cx + 0.13, 0.62); g.lineTo(cx + 0.06, 0.48); g.stroke();
    rr(g, cx - 0.08, 0.86, 0.16, 0.1, 0.02); g.strokeStyle = '#7a6656'; g.lineWidth = 0.01; g.stroke(); // 口袋
  }
  g.fillStyle = '#fbfbf8';
  rr(g, cx - 0.27, 0.52, 0.09, 0.42, 0.04); g.fill(); outline(g);
  rr(g, cx + 0.18, 0.52, 0.09, 0.42, 0.04); g.fill(); outline(g);
  g.fillStyle = SKIN;
  ell(g, cx - 0.225, 0.97, 0.04, 0.04); g.fill(); outline(g, 0.01);
  ell(g, cx + 0.225, 0.97, 0.04, 0.04); g.fill(); outline(g, 0.01);
  kevinHead(g, cx, 0.3, pose === 'apron');
  return c;
}

// 離開東山之後，凱文顧店：站在吧台後面，姿勢和德叔一樣（idle、pour 沖煮、wipe／wipe2 打烊後擦杯子），
// 尺寸和德叔相同，沖煮、端杯、打烊的演出都照用
export function kevinBar(pose = 'idle') {
  return art('char_kevin_bar') || drawKevinBar(pose); // 手繪圖只有一張（擦著一個玻璃杯），每個動作都用它
}
function drawKevinBar(pose) {
  const W = 0.9, H = 1.8;
  const { c, g } = canvas(W, H, HI);
  const cx = W / 2;
  rr(g, cx - 0.16, 1.05, 0.14, 0.73, 0.04); g.fillStyle = '#343a46'; g.fill(); outline(g);
  rr(g, cx + 0.02, 1.05, 0.14, 0.73, 0.04); g.fill(); outline(g);
  rr(g, cx - 0.21, 0.5, 0.42, 0.63, 0.1); g.fillStyle = '#fbfbf8'; g.fill(); outline(g);
  g.beginPath(); g.moveTo(cx - 0.17, 0.64); g.lineTo(cx + 0.17, 0.64); g.lineTo(cx + 0.21, 1.34); g.lineTo(cx - 0.21, 1.34); g.closePath();
  g.fillStyle = '#4a3a2e'; g.fill(); outline(g, 0.014);
  g.strokeStyle = '#4a3a2e'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(cx - 0.15, 0.64); g.lineTo(cx - 0.07, 0.5); g.moveTo(cx + 0.15, 0.64); g.lineTo(cx + 0.07, 0.5); g.stroke();
  g.fillStyle = '#fbfbf8';
  const wiping = pose === 'wipe' || pose === 'wipe2';
  if (wiping) {
    // 擦一個玻璃杯（琺瑯杯跟著德叔去下一站了）
    g.save(); g.translate(cx - 0.27, 0.82); g.rotate(-0.85); rr(g, 0, -0.05, 0.22, 0.1, 0.05); g.fill(); outline(g); g.restore();
    g.save(); g.translate(cx + 0.27, 0.82); g.rotate(Math.PI + 0.85); rr(g, 0, -0.05, 0.22, 0.1, 0.05); g.fill(); outline(g); g.restore();
    rr(g, cx - 0.12, 0.52, 0.11, 0.13, 0.015); g.fillStyle = 'rgba(214,236,242,.85)'; g.fill(); outline(g, 0.012);
    const off = pose === 'wipe2' ? -0.05 : 0.03;
    g.beginPath(); g.moveTo(cx + off, 0.54); g.quadraticCurveTo(cx + off + 0.08, 0.51, cx + off + 0.13, 0.56);
    g.lineTo(cx + off + 0.12, 0.68); g.quadraticCurveTo(cx + off + 0.05, 0.71, cx + off - 0.01, 0.66); g.closePath();
    g.fillStyle = '#e6dcc4'; g.fill(); outline(g, 0.012);
    g.fillStyle = SKIN;
    ell(g, cx - 0.12, 0.66, 0.045, 0.045); g.fill(); outline(g, 0.012);
    ell(g, cx + off + 0.08, 0.62, 0.045, 0.045); g.fill(); outline(g, 0.012);
  } else {
    rr(g, cx - 0.3, 0.54, 0.1, 0.42, 0.05); g.fill(); outline(g);
    g.fillStyle = SKIN; ell(g, cx - 0.25, 0.98, 0.045, 0.045); g.fill(); outline(g, 0.012);
    g.fillStyle = '#fbfbf8';
    if (pose === 'pour') {
      g.save(); g.translate(cx + 0.2, 0.58); g.rotate(-1.0); rr(g, 0, -0.05, 0.4, 0.1, 0.05); g.fill(); outline(g); g.restore();
      g.fillStyle = SKIN; ell(g, cx + 0.43, 0.25, 0.045, 0.045); g.fill(); outline(g, 0.012);
    } else {
      rr(g, cx + 0.2, 0.54, 0.1, 0.42, 0.05); g.fill(); outline(g);
      g.fillStyle = SKIN; ell(g, cx + 0.25, 0.98, 0.045, 0.045); g.fill(); outline(g, 0.012);
    }
  }
  kevinHead(g, cx, 0.32, true);
  return c;
}

// 阿哲的阿公：種了四十年龍眼的老農。pose：'stand'（拄著拐杖走進來）、'sit'（坐在角落的板凳上）
export function grandpa(pose = 'stand') {
  return art(`char_grandpa_${pose === 'sit' ? 'sit' : 'stand'}`) || drawGrandpa(pose); // 坐著的圖自己帶了矮板凳
}
function drawGrandpa(pose) {
  const sit = pose === 'sit';
  const W = 0.8, H = sit ? 1.3 : 1.62;
  const { c, g } = canvas(W, H, HI);
  const cx = W / 2;
  if (sit) {
    rr(g, cx - 0.24, 1.0, 0.48, 0.06, 0.02); g.fillStyle = '#8a5a3b'; g.fill(); outline(g); // 板凳
    g.fillStyle = '#6b452f'; rr(g, cx - 0.2, 1.06, 0.04, 0.23, 0.01); g.fill(); rr(g, cx + 0.16, 1.06, 0.04, 0.23, 0.01); g.fill();
    rr(g, cx - 0.17, 0.48, 0.34, 0.54, 0.1); g.fillStyle = '#e7e1d2'; g.fill(); outline(g);
    rr(g, cx - 0.18, 0.92, 0.36, 0.12, 0.05); g.fillStyle = '#4b4238'; g.fill(); outline(g);
    rr(g, cx - 0.14, 1.0, 0.1, 0.26, 0.04); g.fill(); outline(g); rr(g, cx + 0.04, 1.0, 0.1, 0.26, 0.04); g.fill(); outline(g);
    ell(g, cx - 0.1, 0.86, 0.04, 0.035); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
    ell(g, cx + 0.1, 0.86, 0.04, 0.035); g.fill(); outline(g, 0.01);
  } else {
    rr(g, cx - 0.14, 0.98, 0.12, 0.6, 0.04); g.fillStyle = '#4b4238'; g.fill(); outline(g);
    rr(g, cx + 0.02, 0.98, 0.12, 0.6, 0.04); g.fill(); outline(g);
    rr(g, cx - 0.18, 0.46, 0.36, 0.58, 0.1); g.fillStyle = '#e7e1d2'; g.fill(); outline(g);
    g.strokeStyle = '#7a5532'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(cx + 0.26, 0.82); g.lineTo(cx + 0.3, 1.6); g.stroke(); // 拐杖
    ell(g, cx + 0.25, 0.83, 0.04, 0.04); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
  }
  const hy = sit ? 0.32 : 0.3;
  ell(g, cx, hy, 0.13, 0.15); g.fillStyle = '#dcb38f'; g.fill(); outline(g);
  // 斗笠
  g.beginPath(); g.moveTo(cx - 0.24, hy - 0.06); g.lineTo(cx, hy - 0.22); g.lineTo(cx + 0.24, hy - 0.06); g.closePath();
  g.fillStyle = '#d8b874'; g.fill(); outline(g, 0.014);
  g.strokeStyle = INK; g.lineWidth = 0.012;
  g.beginPath(); g.moveTo(cx - 0.07, hy + 0.01); g.lineTo(cx - 0.03, hy + 0.01); g.moveTo(cx + 0.03, hy + 0.01); g.lineTo(cx + 0.07, hy + 0.01); g.stroke();
  g.beginPath(); g.moveTo(cx - 0.05, hy + 0.08); g.quadraticCurveTo(cx, hy + 0.1, cx + 0.05, hy + 0.08); g.stroke();
  g.strokeStyle = 'rgba(80,60,40,.4)'; g.beginPath(); g.moveTo(cx - 0.09, hy + 0.05); g.lineTo(cx - 0.06, hy + 0.06); g.moveTo(cx + 0.06, hy + 0.06); g.lineTo(cx + 0.09, hy + 0.05); g.stroke(); // 皺紋
  return c;
}

// 熟客送的擺飾：寫滿字的紙巾（放在小邊桌上，用一塊小石頭壓著）
export function napkin() {
  const a = room('napkin'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.5, 0.95);
  sideTable(g, 0.25, 0.4);
  g.save(); g.translate(0.25, 0.3); g.rotate(-0.08);
  rr(g, -0.16, -0.13, 0.32, 0.24, 0.01); g.fillStyle = '#fbfaf5'; g.fill(); outline(g, 0.01);
  g.strokeStyle = 'rgba(40,45,70,.65)'; g.lineWidth = 0.006;
  const r = rng(53);
  for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(-0.14, -0.1 + k * 0.03); g.lineTo(-0.02 + r() * 0.15, -0.1 + k * 0.03); g.stroke(); }
  g.restore();
  ell(g, 0.36, 0.37, 0.05, 0.03); g.fillStyle = '#8f8a80'; g.fill(); outline(g, 0.01);
  return c;
}

// 予安的書：立在小書架上，封面朝外
export function yuanBook() {
  const a = room('yuanBook'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.5, 0.95);
  sideTable(g, 0.25, 0.4);
  rr(g, 0.13, 0.08, 0.24, 0.32, 0.015); g.fillStyle = '#c2683f'; g.fill(); outline(g, 0.012);
  rr(g, 0.17, 0.13, 0.16, 0.05, 0.01); g.fillStyle = '#f3e7cf'; g.fill();
  g.strokeStyle = 'rgba(255,240,210,.85)'; g.lineWidth = 0.012;
  g.beginPath(); g.moveTo(0.22, 0.36); g.quadraticCurveTo(0.3, 0.3, 0.24, 0.25); g.quadraticCurveTo(0.2, 0.21, 0.28, 0.2); g.stroke(); // 封面上的龍眼窯煙
  return c;
}

/* ---------- 階段 6：告別（之後換手繪只改這些同名函式） ---------- */

// 裱框的紙巾：予安告別時送的，立在小邊桌上
export function framedNapkin() {
  const a = room('framedNapkin'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.5, 0.95);
  sideTable(g, 0.25, 0.42);
  rr(g, 0.08, 0.06, 0.34, 0.36, 0.012); g.fillStyle = '#7a5532'; g.fill(); outline(g, 0.012);
  rr(g, 0.12, 0.1, 0.26, 0.28, 0.006); g.fillStyle = '#f1e9d6'; g.fill();
  g.save(); g.translate(0.25, 0.24); g.rotate(-0.06);
  rr(g, -0.1, -0.08, 0.2, 0.16, 0.005); g.fillStyle = '#fbfaf5'; g.fill(); outline(g, 0.006);
  g.strokeStyle = 'rgba(40,45,70,.6)'; g.lineWidth = 0.005;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-0.08, -0.055 + k * 0.027); g.lineTo(0.02 + (k % 2) * 0.05, -0.055 + k * 0.027); g.stroke(); }
  g.restore();
  return c;
}

// 一包阿哲的豆：牛皮紙袋，手寫的大字
export function beanBag() {
  const a = room('beanBag'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.5, 0.95);
  sideTable(g, 0.25, 0.42);
  g.beginPath(); g.moveTo(0.11, 0.42); g.lineTo(0.13, 0.12); g.lineTo(0.37, 0.12); g.lineTo(0.39, 0.42); g.closePath();
  g.fillStyle = '#c9a265'; g.fill(); outline(g, 0.012);
  g.beginPath(); g.moveTo(0.13, 0.12); g.lineTo(0.16, 0.07); g.lineTo(0.34, 0.07); g.lineTo(0.37, 0.12); g.fillStyle = '#b38c52'; g.fill(); outline(g, 0.01);
  g.fillStyle = INK;
  g.font = 'bold 0.075px "PingFang TC","Noto Sans TC",sans-serif';
  g.textAlign = 'center';
  g.fillText('阿哲', 0.25, 0.25);
  g.fillText('的豆', 0.25, 0.34);
  return c;
}

// 門口的徵才啟事：貼在一塊小立牌上（text：老闆選的那一句）
// 手繪圖的紙面是空白的（中心 0.3, 0.35 公尺、0.42×0.52、轉 −0.03 弧度），字由程式疊上去
export function noticeBoard(text = '') {
  const a = room('noticeBoard');
  let c, g;
  if (a) {
    ({ c, g } = overlay(a));
    g.save(); g.translate(0.3, 0.35); g.rotate(-0.03);
  } else {
    ({ c, g } = canvas(0.6, 1.25));
    g.fillStyle = '#6b452f';
    rr(g, 0.27, 0.6, 0.06, 0.63, 0.01); g.fill(); outline(g, 0.012);
    rr(g, 0.14, 1.18, 0.32, 0.05, 0.02); g.fill(); outline(g, 0.012);
    rr(g, 0.04, 0.04, 0.52, 0.62, 0.02); g.fillStyle = '#8a5a3b'; g.fill(); outline(g, 0.014);
    g.save(); g.translate(0.3, 0.35); g.rotate(-0.03);
    rr(g, -0.21, -0.26, 0.42, 0.52, 0.006); g.fillStyle = '#fbf8f0'; g.fill(); outline(g, 0.008);
    g.fillStyle = 'rgba(220,200,150,.8)'; g.fillRect(-0.06, -0.29, 0.12, 0.05); // 膠帶
  }
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.font = 'bold 0.062px "PingFang TC","Noto Sans TC",sans-serif';
  g.fillText('徵', 0, -0.15);
  g.font = '0.04px "Kaiti TC","STKaiti","DFKai-SB","KaiTi",serif';
  const chars = [...text.replace(/[。，]/g, ' ').trim()];
  const lines = [];
  for (let i = 0; i < chars.length; i += 8) lines.push(chars.slice(i, i + 8).join(''));
  lines.slice(0, 4).forEach((l, i) => g.fillText(l.trim(), 0, -0.06 + i * 0.07));
  g.restore();
  return c;
}

// 吧台的鑰匙：一把舊的黃銅鑰匙，綁著紅繩
export function key() {
  const a = room('key'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.22, 0.12, HI);
  ell(g, 0.05, 0.06, 0.035, 0.035); g.fillStyle = '#c9a24a'; g.fill(); outline(g, 0.008);
  ell(g, 0.05, 0.06, 0.013, 0.013); g.fillStyle = '#6b4b20'; g.fill();
  rr(g, 0.08, 0.05, 0.12, 0.02, 0.006); g.fillStyle = '#c9a24a'; g.fill(); outline(g, 0.006);
  g.fillRect(0.16, 0.07, 0.015, 0.025); g.fillRect(0.185, 0.07, 0.012, 0.018);
  g.strokeStyle = '#c4382c'; g.lineWidth = 0.008; g.beginPath(); g.moveTo(0.03, 0.03); g.quadraticCurveTo(0.0, 0.0, 0.02, 0.1); g.stroke();
  return c;
}

// 你的咖啡地圖：台灣，只亮著東山一盞燈；花蓮舞鶴是下一站（待續）
const TAIWAN = [[121.54, 25.3], [121.75, 25.15], [122.0, 25.01], [121.85, 24.85], [121.87, 24.58], [121.62, 23.98], [121.52, 23.6],
  [121.38, 23.1], [121.15, 22.75], [120.9, 22.33], [120.85, 21.9], [120.73, 21.93], [120.62, 22.25], [120.45, 22.46],
  [120.27, 22.62], [120.15, 23.0], [120.05, 23.15], [120.15, 23.38], [120.18, 23.7], [120.4, 24.08], [120.5, 24.28],
  [120.68, 24.5], [120.9, 24.82], [121.05, 25.05], [121.4, 25.17]];
// 回傳一個 DOM 元素：有手繪圖（art2b：map_taiwan，1040×1720，和程式同一個投影、放大兩倍）就是 SVG，
// 東山的燈、舞鶴的虛線圈與地名由程式畫在圖上（畫師沒有畫標記）；沒有就是下面 Canvas 畫的整張地圖
export function coffeeMap(label = '') {
  const url = artUrl('map_taiwan');
  if (!url) {
    const c = drawCoffeeMap();
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', label);
    return c;
  }
  const k = 2, P = ([lon, lat]) => [(lon - 119.79) * 421.8, (25.47 - lat) * 460]; // 東山 ≈ (266, 998)、舞鶴 ≈ (679, 906)
  const font = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  const svg = artSvg(url, 1040, 1720, label, 'xMidYMid meet');
  svg.dataset.art = 'map_taiwan';
  svg.setAttribute('width', 1040); svg.setAttribute('height', 1720);
  const defs = svgEl('defs');
  const grad = svgEl('radialGradient', { id: 'map-glow' });
  for (const [o, c] of [[0, 'rgba(255,214,140,.95)'], [0.35, 'rgba(255,170,80,.45)'], [1, 'rgba(255,170,80,0)']]) grad.appendChild(svgEl('stop', { offset: o, 'stop-color': c }));
  defs.appendChild(grad); svg.appendChild(defs);
  const [dx, dy] = P([120.42, 23.3]), [wx, wy] = P([121.4, 23.5]);
  // 下一站：還沒點亮的燈，虛線圈
  svg.appendChild(svgEl('circle', { cx: wx, cy: wy, r: 14 * k, fill: 'none', stroke: 'rgba(59,42,32,.55)', 'stroke-width': 2.5 * k, 'stroke-dasharray': `${6 * k} ${6 * k}` }));
  svg.appendChild(svgEl('circle', { cx: wx, cy: wy, r: 5 * k, fill: 'rgba(59,42,32,.35)' }));
  // 東山：亮著的一盞燈
  svg.appendChild(svgEl('circle', { cx: dx, cy: dy, r: 70 * k, fill: 'url(#map-glow)' }));
  svg.appendChild(svgEl('circle', { cx: dx, cy: dy, r: 9 * k, fill: '#c4382c', stroke: INK, 'stroke-width': 2.5 * k }));
  // 地名：紙色描邊，壓在海浪紋和山上也看得清楚
  const name = (x, y, t, size, anchor, fill, weight = 400) => svg.appendChild(svgEl('text', { x, y, 'text-anchor': anchor, 'font-size': size * k, 'font-weight': weight,
    fill, stroke: 'rgba(246,236,210,.92)', 'stroke-width': 5 * k, 'paint-order': 'stroke', 'stroke-linejoin': 'round', 'font-family': font }, t));
  name(dx - 20 * k, dy + 10 * k, '東山', 30, 'end', INK, 700);
  name(wx + 22 * k, wy - 2 * k, '舞鶴', 26, 'start', 'rgba(59,42,32,.75)');
  name(wx + 22 * k, wy + 24 * k, '待續', 20, 'start', 'rgba(59,42,32,.75)');
  // 美術評分修正 e：細框畫在 SVG 裡、和圖一樣大（原本框是元素的外框，桌機的框比圖寬，左右各空約 30px）
  svg.appendChild(svgEl('rect', { x: 1, y: 1, width: 1038, height: 1718, rx: 18, fill: 'none', stroke: 'rgba(59,42,32,.22)', 'stroke-width': 2 }));
  return svg;
}
function drawCoffeeMap() {
  const W = 520, H = 860;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const k = 230, x0 = 119.79, y0 = 25.47;
  const P = ([lon, lat]) => [(lon - x0) * k * 0.917, (y0 - lat) * k];
  const font = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  // 紙與海
  g.fillStyle = '#f3ead6'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(120,150,170,.2)'; g.lineWidth = 2;
  for (let y = 40; y < H; y += 46) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y - 8, W * 0.6, y + 8, W, y); g.stroke(); }
  // 島
  g.beginPath();
  TAIWAN.forEach((p, i) => { const [x, y] = P(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.closePath();
  g.fillStyle = '#e6d6b4'; g.fill();
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  // 中央山脈（淡淡的兩道）
  g.strokeStyle = 'rgba(110,90,60,.28)'; g.lineWidth = 3;
  for (const [a, b] of [[[121.3, 24.6], [120.95, 23.2]], [[121.15, 24.2], [120.85, 22.6]]]) { g.beginPath(); g.moveTo(...P(a)); g.lineTo(...P(b)); g.stroke(); }
  const dong = P([120.42, 23.3]), wuhe = P([121.4, 23.5]);
  // 下一站：還沒點亮的燈，虛線圈
  g.setLineDash([6, 6]); g.strokeStyle = 'rgba(59,42,32,.55)'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(wuhe[0], wuhe[1], 14, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(59,42,32,.35)'; g.beginPath(); g.arc(wuhe[0], wuhe[1], 5, 0, Math.PI * 2); g.fill();
  // 東山：亮著的一盞燈
  const glow = g.createRadialGradient(dong[0], dong[1], 2, dong[0], dong[1], 70);
  glow.addColorStop(0, 'rgba(255,214,140,.95)'); glow.addColorStop(0.35, 'rgba(255,170,80,.45)'); glow.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(dong[0], dong[1], 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c4382c'; g.beginPath(); g.arc(dong[0], dong[1], 9, 0, Math.PI * 2); g.fill();
  g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
  // 地名
  g.fillStyle = INK; g.textAlign = 'right';
  g.font = `bold 30px ${font}`;
  g.fillText('東山', dong[0] - 20, dong[1] + 10);
  g.textAlign = 'left'; g.fillStyle = 'rgba(59,42,32,.62)';
  g.font = `26px ${font}`;
  g.fillText('舞鶴', wuhe[0] + 22, wuhe[1] - 2);
  g.font = `20px ${font}`;
  g.fillText('待續', wuhe[0] + 22, wuhe[1] + 24);
  return c;
}

// 吧台上的那袋龍眼乾（阿哲的阿公送的）
export function longanBag() {
  const a = room('longanBag'); // 手繪圖（art2a）；沒有載到就用下面的 Canvas 繪圖
  if (a) return a;
  const { c, g } = canvas(0.22, 0.2, HI);
  g.beginPath(); g.moveTo(0.03, 0.19); g.lineTo(0.05, 0.05); g.lineTo(0.17, 0.05); g.lineTo(0.19, 0.19); g.closePath();
  g.fillStyle = '#d8b874'; g.fill(); outline(g, 0.01);
  g.beginPath(); g.moveTo(0.05, 0.05); g.lineTo(0.08, 0.02); g.lineTo(0.14, 0.02); g.lineTo(0.17, 0.05); g.fillStyle = '#c9a35e'; g.fill(); outline(g, 0.008);
  g.fillStyle = '#c4382c'; g.fillRect(0.07, 0.1, 0.08, 0.05);
  return c;
}

// 雨絲（貼在窗戶前面，往下捲動）
export function rain(heavy) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const r = rng(heavy ? 71 : 73);
  g.strokeStyle = heavy ? 'rgba(220,230,240,0.55)' : 'rgba(235,240,245,0.45)';
  g.lineWidth = 1.2;
  for (let i = 0; i < (heavy ? 90 : 40); i++) {
    const x = r() * 128, y = r() * 256, l = heavy ? 22 : 14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - (heavy ? 7 : 1.5), y + l); g.stroke();
  }
  return c;
}

// 音符（德叔把音樂調小時，音符縮小、淡掉）
export function note() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#3b2a20';
  g.font = 'bold 46px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♪', 32, 34);
  return c;
}

export const SIZES = { PPM, HI };
// 一張圖每公尺幾個像素（程式畫的圖記在 c.ppm；之後換成手繪圖檔時沒有這個欄位，用預設的 PPM）
export const ppmOf = (c) => c?.ppm || PPM;
