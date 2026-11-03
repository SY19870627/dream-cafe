// 存檔：localStorage 單一鍵 dream-cafe.save，內容是帶版本號的 JSON（決定 D6）。
// 讀寫失敗（私密模式、儲存空間被關掉）時照常遊戲，只是不存。
// 純邏輯，不依賴 Three.js；storage 可以注入，方便用 node --test 測試。
import { STARTER_ITEMS } from './catalog.js';
import { daysOpen } from './clock.js';
import { blankFarewell } from './farewell.js';
import { blankMenu, migrateMenu } from './menu.js';
import { blankFavorites, lastBeanOf } from './favorites.js';

export const SAVE_KEY = 'dream-cafe.save';
export const SAVE_VERSION = 8; // 2：階段 3 加入開場、玩家資料、營業日誌；初始擺飾改由開場第四幕送出
// 3：階段 4 加入熟客故事線（來店次數、里程碑、結算到哪一天）、菜單、颱風那天
// 4：階段 5 加入打烊（closing）、「今天的一杯」咖啡日記（diary）、龍眼（cat）
// 5：階段 6 加入徵店長與告別（farewell）
// 6：承峰 11/3 第二輪回饋加入店裡的小事（moments）：前三天的小段落演過哪些、哪些擺飾已經有過第一次擺出來的反應
// 7：承峰 11/3「菜單做 A，存檔照 B 設計」：menu 從 id 陣列改成 { items 解鎖過的品項與來歷, board 黑板上寫的, night }（menu.js）
// 8：承峰 11/4「做每人三段的版本」：熟客最愛的咖啡（favorites）與相簿（photos），stats.lastBean 老闆最近一次喝的那杯（favorites.js）

const regular = () => ({ visits: 0, milestones: [], on: {}, settled: 0, lastVisit: 0, lastMilestoneDay: 0 });

export function defaultSave(now) {
  const save = {
    version: SAVE_VERSION,
    createdAt: now, // 第一次開店的時刻，「開店第 N 天」從這天起算
    lastSeen: now, // 最後一次在店裡的時刻（離線營業日誌從這裡算起）
    tasks: [], // [{ id, t, day }]：已完成的溫度任務；溫度由此算出
    fund: { ledger: [] }, // 溫度基金帳本：[{ t, kind: 'grant' | 'buy' | 'dev', ref, amount }]
    owned: [], // [{ uid, item, placed, x, z }]：擁有的擺飾；placed=false 表示收在倉庫
    nextUid: 1,
    seatsSat: [], // 坐過的座位
    // lastBean：老闆最近一次喝的那杯（請德叔沖一杯、最後一杯、客人模式；凱文第三段的答案，第 8 版）
    stats: { cups: 0, rainyWindowCups: 0, lastBean: '' },
    // 熟客（story.js）：visits 來店次數、milestones 已發生的里程碑、on 每個里程碑發生在開店第幾天、
    // settled 來店結算到第幾天、lastVisit 最後一次來是第幾天、lastMilestoneDay 最後一個里程碑是第幾天
    regulars: {
      yuan: regular(),
      zhe: regular(),
      kevin: regular(),
    },
    // 故事的其他狀態：lastPresentDay「在場」里程碑最後演在第幾天、hinted 日誌已經寫過「想等老闆在」的里程碑、
    // typhoonDay 颱風夜是第幾天、answers 玩家在對話裡選的回答
    // rainFloorDay：最後一次保底雨天是第幾天（weather.js，階段 7）
    story: { lastPresentDay: 0, hinted: [], typhoonDay: 0, answers: {}, rainFloorDay: 0 },
    // 黑板菜單（menu.js）：items 解鎖過的品項（哪天、從哪段劇情來、看過沒、第一次寫上黑板是哪天……），board 黑板上寫的（由上往下），
    // night 選項 B 的下班後那一面（null＝同一面）
    menu: blankMenu(now),
    flags: {}, // seenOpening、openingAct、metYuan、starterGiven、catOnChair、guestVisit、guestOffered（德叔哪一天問過要不要從門口進來）……
    // 打烊（afterhours.js）：哪一天打烊、喝了最後一杯沒、最後一杯的豆子、關掉的燈、按了「明天見」沒
    closing: { day: 0, lastCup: false, bean: '', lightsOff: [], done: false },
    diary: [], // 「今天的一杯」咖啡日記：[{ day, t, bean, text }]
    // 龍眼（cat.js）：tryId／tryDay 剛擺了新的貓窩、當天去試睡；seen 睡過的擺飾；refused 走開過了沒；chairs 跳上椅子幾次
    cat: { tryId: '', tryDay: 0, seen: [], refused: false, chairs: 0 },
    // 徵店長與告別（farewell.js）：step 演完第幾段、on 每一段在第幾天、notice 貼出去的啟事、departed 離開東山了沒……
    farewell: blankFarewell(),
    // 店裡的小事（moments.js）：early 演過的前三天小段落、decor 已經有過第一次擺出來的反應的擺飾（品項 id）
    moments: { early: [], decor: [] },
    // 熟客最愛的咖啡（favorites.js，第 8 版）：stage 找到第幾段了（0～3）、misses 這一段端錯幾次（德叔更靠近的那句）、
    // servedDay 哪一天收過老闆請的那杯（一天一杯）、told 德叔說過第幾段的線索
    favorites: blankFavorites(),
    photos: [], // 相簿：[{ id: 'yuan-1', day, t, item 端過去的那杯, snack 附了龍眼乾沒 }]，照拿到的順序
    letters: [], // 讀過的老先生的信：[{ id, t, day }]
    journal: [], // 最近幾頁德叔的營業日誌（記事本可以重讀），見 journal.js
    player: { name: '', resignation: '' }, // 開場第一幕：辭呈署名（可留空）與選的結尾（之後凱文的里程碑會用到）
    // 下班時間（決定 D11）；sound：店裡的聲音（磨豆、注水、門鈴、窗外、風雨；階段 4 起只有風雨聲）；music：背景音樂；volume：0 小／1 中／2 大
    settings: { offWork: '18:00', sound: true, music: true, volume: 0 },
    dev: { offsetMs: 0 }, // 開發者模式跳天數用的時間偏移；一般模式不採用
  };
  // 德叔送的三件初始擺飾，等開場第四幕（或略過開場）時才由 giveStarters() 放進倉庫
  return save;
}

// 德叔送的三件初始擺飾，收進倉庫；只送一次。回傳這次有沒有送。
export function giveStarters(save) {
  if (save.flags.starterGiven) return false;
  for (const item of STARTER_ITEMS) save.owned.push({ uid: save.nextUid++, item, placed: false, x: 0, z: 0 });
  save.flags.starterGiven = true;
  return true;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// 用預設值補齊缺少的欄位（之後加欄位時，舊存檔也讀得進來）
function fill(target, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in target) || target[k] === null || typeof target[k] !== typeof v || Array.isArray(v) !== Array.isArray(target[k])) target[k] = v;
    else if (isObj(v)) fill(target[k], v);
  }
  return target;
}

// 舊版本存檔升級到目前版本。目前只有第 1 版；之後改格式時在這裡一版一版往上升。
export function migrate(data, now) {
  if (!isObj(data)) return null;
  const v = Number(data.version) || 0;
  if (v > SAVE_VERSION) return null; // 比遊戲還新的存檔：不認得，不去動它
  // 第 7 版以前 menu 是 id 陣列（菜單上的東西）：先換成新的格式，不然 fill() 會把它當成型別不對直接蓋掉
  if (v < 7) {
    const ms = {};
    for (const w of ['yuan', 'zhe', 'kevin']) ms[w] = Array.isArray(data.regulars?.[w]?.milestones) ? data.regulars[w].milestones : [];
    data.menu = migrateMenu(data.menu, ms, Number(data.createdAt) ? daysOpen(data.createdAt, now) : 1, now);
  }
  const save = fill(data, defaultSave(now));
  // 第 1 版的存檔是開場做出來之前開的店：不再播開場，初始擺飾也已經送過了
  if (v < 2) { save.flags.seenOpening = true; save.flags.starterGiven = true; }
  // 第 3 版以前沒有熟客故事線：過去的日子不補算，熟客從今天開始來（不會一次湧出一大疊里程碑）
  if (v < 3) for (const r of Object.values(save.regulars)) r.settled = Math.max(r.settled, daysOpen(save.createdAt, now) - 1);
  // 第 6 版以前：已經擺在店裡的東西不再補一次「第一次擺出來」的反應（只對之後新擺出來的反應）
  if (v < 6) for (const o of save.owned) if (o.placed && !save.moments.decor.includes(o.item)) save.moments.decor.push(o.item);
  // 第 8 版以前沒有熟客最愛的咖啡：每位熟客都從第一段開始找（不自動送照片、溫度不變），已經開放的段落線索照順序出現；
  // 老闆最近一次喝的那杯，從咖啡日記最後一篇、最後一杯補（都沒有就是空的，用的時候當作東山的豆）
  if (v < 8 && !save.stats.lastBean) { const b = lastBeanOf(save); save.stats.lastBean = b === 'dongshan' && !save.diary.length && !save.closing.bean ? '' : b; }
  save.version = SAVE_VERSION;
  save.nextUid = Math.max(save.nextUid, ...save.owned.map((o) => (Number(o.uid) || 0) + 1), 1);
  return save;
}

// 取得 localStorage；有些瀏覽器在私密模式或關掉儲存時，連讀取這個屬性都會丟錯
function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// 建立存檔物件：load() 讀出（或新建）存檔，write() 寫回。
// 回傳的 available=false 代表這台裝置存不了檔，遊戲照常進行。
export function createStore(storage = defaultStorage(), now = Date.now()) {
  let available = !!storage;
  let status = 'new'; // 'new'：新存檔；'loaded'：讀到舊存檔；'reset'：存檔壞了重來；'memory'：存不了檔
  if (available) {
    try { storage.setItem(SAVE_KEY + '.probe', '1'); storage.removeItem(SAVE_KEY + '.probe'); } catch { available = false; }
  }

  function load() {
    if (!available) { status = 'memory'; return defaultSave(now); }
    let raw = null;
    try { raw = storage.getItem(SAVE_KEY); } catch { available = false; status = 'memory'; return defaultSave(now); }
    if (raw == null) { status = 'new'; return defaultSave(now); }
    let data = null;
    try { data = JSON.parse(raw); } catch { data = null; }
    const save = migrate(data, now);
    if (save) { status = 'loaded'; return save; }
    // 讀不懂的存檔另外備份一份再重來，不直接蓋掉
    try { storage.setItem(SAVE_KEY + '.broken', raw); } catch { /* 備份失敗也照常遊戲 */ }
    status = 'reset';
    return defaultSave(now);
  }

  function write(save) {
    if (!available) return false;
    try { storage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
  }

  function clear() {
    if (!available) return;
    try { storage.removeItem(SAVE_KEY); } catch { /* 忽略 */ }
  }

  return { load, write, clear, get available() { return available; }, get status() { return status; } };
}
