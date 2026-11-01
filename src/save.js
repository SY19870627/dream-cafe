// 存檔：localStorage 單一鍵 dream-cafe.save，內容是帶版本號的 JSON（決定 D6）。
// 讀寫失敗（私密模式、儲存空間被關掉）時照常遊戲，只是不存。
// 純邏輯，不依賴 Three.js；storage 可以注入，方便用 node --test 測試。
import { STARTER_ITEMS } from './catalog.js';

export const SAVE_KEY = 'dream-cafe.save';
export const SAVE_VERSION = 2; // 2：階段 3 加入開場、玩家資料、營業日誌；初始擺飾改由開場第四幕送出

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
    regulars: { // 熟客來店次數與里程碑（階段 4 使用）
      yuan: { visits: 0, milestones: [] },
      zhe: { visits: 0, milestones: [] },
      kevin: { visits: 0, milestones: [] },
    },
    flags: {}, // seenOpening、openingAct、metYuan、starterGiven、catOnChair、guestVisit……
    letters: [], // 讀過的老先生的信：[{ id, t, day }]
    journal: [], // 最近幾頁德叔的營業日誌（記事本可以重讀），見 journal.js
    player: { name: '', resignation: '' }, // 開場第一幕：辭呈署名（可留空）與選的結尾（之後凱文的里程碑會用到）
    settings: { offWork: '18:00' }, // 下班時間（決定 D11，階段 3 起使用）
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
