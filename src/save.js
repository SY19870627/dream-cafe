// 存檔：localStorage 單一鍵 dream-cafe.save，內容是帶版本號的 JSON（決定 D6）。
// 讀寫失敗（私密模式、儲存空間被關掉）時照常遊戲，只是不存。
// 純邏輯，不依賴 Three.js；storage 可以注入，方便用 node --test 測試。
import { STARTER_ITEMS } from './catalog.js';
import { daysOpen } from './clock.js';

export const SAVE_KEY = 'dream-cafe.save';
export const SAVE_VERSION = 4; // 2：階段 3 加入開場、玩家資料、營業日誌；初始擺飾改由開場第四幕送出
// 3：階段 4 加入熟客故事線（來店次數、里程碑、結算到哪一天）、菜單、颱風那天
// 4：階段 5 加入打烊（closing）、「今天的一杯」咖啡日記（diary）、龍眼（cat）

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
    stats: { cups: 0, rainyWindowCups: 0 },
    // 熟客（story.js）：visits 來店次數、milestones 已發生的里程碑、on 每個里程碑發生在開店第幾天、
    // settled 來店結算到第幾天、lastVisit 最後一次來是第幾天、lastMilestoneDay 最後一個里程碑是第幾天
    regulars: {
      yuan: regular(),
      zhe: regular(),
      kevin: regular(),
    },
    // 故事的其他狀態：lastPresentDay「在場」里程碑最後演在第幾天、hinted 日誌已經寫過「想等老闆在」的里程碑、
    // typhoonDay 颱風夜是第幾天、answers 玩家在對話裡選的回答
    story: { lastPresentDay: 0, hinted: [], typhoonDay: 0, answers: {} },
    menu: ['dongshan'], // 菜單上的東西（story.js 的 MENU）
    flags: {}, // seenOpening、openingAct、metYuan、starterGiven、catOnChair、guestVisit、guestOffered（德叔哪一天問過要不要從門口進來）……
    // 打烊（afterhours.js）：哪一天打烊、喝了最後一杯沒、最後一杯的豆子、關掉的燈、按了「明天見」沒
    closing: { day: 0, lastCup: false, bean: '', lightsOff: [], done: false },
    diary: [], // 「今天的一杯」咖啡日記：[{ day, t, bean, text }]
    // 龍眼（cat.js）：tryId／tryDay 剛擺了新的貓窩、當天去試睡；seen 睡過的擺飾；refused 走開過了沒；chairs 跳上椅子幾次
    cat: { tryId: '', tryDay: 0, seen: [], refused: false, chairs: 0 },
    letters: [], // 讀過的老先生的信：[{ id, t, day }]
    journal: [], // 最近幾頁德叔的營業日誌（記事本可以重讀），見 journal.js
    player: { name: '', resignation: '' }, // 開場第一幕：辭呈署名（可留空）與選的結尾（之後凱文的里程碑會用到）
    settings: { offWork: '18:00', sound: true }, // 下班時間（決定 D11）；sound：店裡的風雨聲
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
  const save = fill(data, defaultSave(now));
  // 第 1 版的存檔是開場做出來之前開的店：不再播開場，初始擺飾也已經送過了
  if (v < 2) { save.flags.seenOpening = true; save.flags.starterGiven = true; }
  // 第 3 版以前沒有熟客故事線：過去的日子不補算，熟客從今天開始來（不會一次湧出一大疊里程碑）
  if (v < 3) for (const r of Object.values(save.regulars)) r.settled = Math.max(r.settled, daysOpen(save.createdAt, now) - 1);
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
