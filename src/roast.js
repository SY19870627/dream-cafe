// 烘豆（承峰 11/6：「我希望你直接完成這兩項 烘豆……」，D217；提案 docs/一天的份量提案.md 第三節第 3 點的最小可玩版）：
// - 打烊後（喝完最後一杯）老闆點店門口右手邊那一角的落地烘豆機（承峰 11/7，ROASTER），德叔問這次烘淺一點、深一點，還是剛好（安全的「剛好」放最下面）。
// - 德叔倒生豆、搖滾筒、一爆、下豆、倒進竹篩冷卻：全部用動作呈現（main.js），泡泡只說話、不描述步驟。
// - 烘焙度是「東山的豆」的一個屬性，不是新的品項：黑板還是同一行「東山 日曬」、熟客最愛三段的答案不變（drink 還是 dongshan）、
//   試咖啡的參數／紀錄／定案（tasting.js）不碰；菜單本那一頁多一句「架上這一批」，德叔之後沖東山的豆時說一次是哪一批。
// - 一批不計數量、沒有庫存、不會用完、不過期，下次烘了才換；不做養豆（Q102 未定）、不顯示「今天烘了沒」、不催、不加溫度、不進任務。
// 存檔第 11 版 save.roast。台詞都是自行補寫的（每一句都標了待定）。純邏輯，不依賴 Three.js 或 DOM。

export const LEVELS = ['light', 'medium', 'dark'];
export const ROAST_BEAN = 'dongshan'; // 最小版只有東山的生豆（窗外那片山）

// 選項的順序：淺一點、深一點、剛好（安全的「剛好」放最下面）
export const CHOICE_ORDER = ['light', 'dark', 'medium'];

export const ROAST = {
  ask: '烘一批東山的豆吧。這次要烘淺一點、深一點，還是剛好？', // 【待定】德叔問
  options: { light: '淺一點', dark: '深一點', medium: '剛好' }, // 【待定】
  start: '好。慢慢來。', // 【待定】選完德叔說（之後的步驟只用動作）
  done: { // 【待定】冷卻完德叔說一句（描述，不評老闆選得對不對）
    light: '淺的。沖起來會亮一點，像早上的山。',
    medium: '剛好。和平常一樣，穩。',
    dark: '深的。苦一點，也厚一點，像傍晚。',
  },
  brew: { // 【待定】之後沖東山的豆時，德叔說一次是哪一批（端上桌那一句換成這句）
    light: '東山的豆，這一批烘得淺。亮一點。',
    medium: '東山的豆，這一批烘得剛好。',
    dark: '東山的豆，這一批烘得深。厚一點。',
  },
  levelName: { light: '淺焙', medium: '中焙', dark: '深焙' }, // 【待定】菜單本的字
  note: (level, day) => `架上這一批：${ROAST.levelName[level] || ''}・第 ${day} 天烘的`, // 【待定】菜單本「東山的豆」那一頁多的一句
  notYet: '烘豆有煙，也有聲音。打烊以後再烘。', // 【待定】開店時點烘豆機
  busy: '這一批還在烘。', // 【待定】正在烘時又點烘豆機
};

// 烘豆機放哪裡（承峰 11/7：「咖啡烘焙機應該很大一台，不要放吧台了，改在咖啡廳右下角一大台」）：
// 店裡的座標和 main.js 一樣（x −3～3 左牆到右牆、z −4～4 後牆到前牆，門口在前牆 x 0.15、寬 0.92）。
// 俯瞰畫面的右下角＝店門口右手邊那一角的地板：落地式大台，佔地 w × d 公尺（中心 x, z；x 2.05～2.95、z 3.075～3.825），離右牆 5 公分、離前牆約 18 公分；
// 佔地是硬的碰撞物（roasterBox()，main.js 的 navBlockers()）。spot：德叔烘豆時站的地方（機器左邊、冷卻盤旁，面向鏡頭時在機器的左手邊）
export const ROASTER = { x: 2.5, z: 3.45, w: 0.9, d: 0.75, spot: { x: 1.8, z: 3.5 } };
export const roasterBox = () => ({ id: 'roaster', x0: ROASTER.x - ROASTER.w / 2, x1: ROASTER.x + ROASTER.w / 2, z0: ROASTER.z - ROASTER.d / 2, z1: ROASTER.z + ROASTER.d / 2 });
// 一點到烘豆機佔地的距離（公尺；在裡面是 0）：新擺出來的擺飾、熟客躲的角落要離它夠遠
export function roasterGap(x, z) {
  const b = roasterBox();
  return Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
}
// 烘豆機的圖（art.js 的 roaster()；畫師交的 assets/art/prop_roaster_large.webp 照這個規格）：
// size：畫布代表幾公尺（寬, 高；art.js 的 ROOM_SPEC，每公尺像素＝圖寬÷寬），四周透明留白會裁掉；w × h：機器畫到的範圍（含煙囪），底邊就是地面。
// 對齊畫師 11/7 交進來的那張（1200 × 2048 像素，每公尺約 1090 像素，底部置中）：畫到的範圍約 x 152～1045、y 82～2006 像素（可見高約 1924 像素），約 0.82 × 1.76 公尺；
// foot：畫師給的落地點（y 2006，用圖高的比例記，換尺寸也對得上）；它下面零星的小雜點（量到最底約 2045）不算地面，裁切時切掉（art.js 的 ROOM_FOOT）。
// 綠色鐵櫃底座、左前方的黃銅冷卻盤、中間的滾筒與正面的端蓋、頂上的黃銅入豆漏斗、右後方的煙囪（頂端彎向右邊）、底座正面左下的圓形小窗。
// 下面幾個點：u 從畫到的範圍的中線往右、v 從地面往上（公尺）；main.js 照圖實際畫到的寬高等比例換算，放火光、竹篩、生豆、煙
// flame：底座的圓形小窗（爐火的光） tray：冷卻盤的盤面中心（竹篩，半徑 trayR） hopper：入豆漏斗的口（生豆落進去） smoke：煙囪口（淡灰的煙） tap：點擊測試用的一點（底座中間）
// （像素是從那張圖目測換算的，要截圖確認對得上）
export const ROASTER_ART = {
  size: [1.1, 1.88], w: 0.82, h: 1.76, foot: 2006 / 2048,
  // 地面從 2045 改到 2006（往上 39 像素），v 照美術需求清單的像素重算（(2006 − y) ÷ 1090.9），在圖上還是同一個像素
  flame: [-0.225, 0.299], tray: [-0.163, 0.725], trayR: 0.21, hopper: [-0.06, 1.468], smoke: [0.395, 1.706], tap: [0.094, 0.464],
};

// 一趟多久（遊戲時間，秒；開發者模式的倍率、按住畫面都會縮短）：實際 10～15 分鐘，壓縮成 1 分半到 2 分鐘（推測，要實測）
// 深一點烘得久一點；一爆在 roast 的 crack 比例那一刻
export const TIMING = {
  pour: 4, // 倒生豆
  roast: { light: 62, medium: 72, dark: 84 }, // 搖滾筒、火光、煙
  crack: 0.62, // 一爆：roast 走到這個比例時
  drop: 3, // 下豆
  cool: 14, // 竹篩冷卻、搖一搖
};
export const roastSeconds = (level) => TIMING.pour + (TIMING.roast[level] || TIMING.roast.medium) + TIMING.drop + TIMING.cool;

// 豆子的顏色（程式畫的小點）：生豆淡綠 → 淺褐 → 中褐 → 深褐
export const BEAN_COLOR = { green: '#a7b27c', light: '#b5793f', medium: '#7d4a26', dark: '#432616' };
// 烘到 k（0～1）時，豆子是什麼顏色：從生豆的淡綠慢慢走到這一批的顏色
export function beanColorAt(level, k) {
  const a = hex(BEAN_COLOR.green), b = hex(BEAN_COLOR[level] || BEAN_COLOR.medium);
  const t = Math.max(0, Math.min(1, k));
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }

// 存檔 save.roast（第 11 版）：batch＝現在架上的那一批 { bean, level, day, t, told 德叔沖的時候說過了沒 }；null＝還沒烘過（照德叔平常的）
export const blankRoast = () => ({ batch: null });
const R = (save) => {
  if (!save.roast || typeof save.roast !== 'object') save.roast = blankRoast();
  if (save.roast.batch && !LEVELS.includes(save.roast.batch.level)) save.roast.batch = null;
  return save.roast;
};

// 烘好一批：換掉架上那一批（不累積、不計數）。回傳這一批
export function roastBatch(save, level, day = 1, t = 0) {
  if (!LEVELS.includes(level)) return null;
  const batch = { bean: ROAST_BEAN, level, day, t, told: false };
  R(save).batch = batch;
  return batch;
}
export const batchOf = (save) => R(save).batch;
export const levelOf = (save, bean = ROAST_BEAN) => (batchOf(save)?.bean === bean ? batchOf(save).level : '');

// 菜單本那一頁多的一句（只有東山的豆、而且烘過才有）
export function roastNote(save, id) {
  const b = batchOf(save);
  return b && b.bean === id ? ROAST.note(b.level, b.day) : '';
}

// 沖這一杯時，德叔要不要說一次是哪一批（沒說過、沖的就是那支豆）：回傳那一句或空字串
export function brewLine(save, bean) {
  const b = batchOf(save);
  return b && !b.told && b.bean === bean ? ROAST.brew[b.level] : '';
}
export function markBrewTold(save) { const b = batchOf(save); if (b) b.told = true; }

// 選項（照 CHOICE_ORDER）：[{ level, text }]
export const roastChoices = () => CHOICE_ORDER.map((level) => ({ level, text: ROAST.options[level] }));

// 測試與校稿用：這個檔案裡所有玩家看得到的字
export function allRoastLines() {
  return [ROAST.ask, ...Object.values(ROAST.options), ROAST.start, ...Object.values(ROAST.done), ...Object.values(ROAST.brew),
    ...Object.values(ROAST.levelName), ROAST.note('light', 3), ROAST.notYet, ROAST.busy];
}
