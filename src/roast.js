// 烘豆（承峰 11/6：「我希望你直接完成這兩項 烘豆……」，D217；提案 docs/一天的份量提案.md 第三節第 3 點的最小可玩版）：
// - 打烊後（喝完最後一杯）老闆點吧台最裡端的烘豆機，德叔問這次烘淺一點、深一點，還是剛好（安全的「剛好」放最下面）。
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
