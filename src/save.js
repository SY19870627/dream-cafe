// 存檔：localStorage，每天結算後存一次。雛形不做存檔遷移，格式不對就當新遊戲。
import { emptyLayout } from './grid.js';
import { initialMenu } from './menu.js';
import { START_TEMP, tempAtStart } from './chapters.js';

export const SAVE_KEY = 'dream-cafe-v2-proto';
const VERSION = 1;

export function newSave(chapter = 0) {
  return {
    v: VERSION,
    chapter, // 0 = 序章（開場還沒看完）
    day: 1,
    temp: chapter > 0 ? tempAtStart(chapter) : START_TEMP,
    layout: emptyLayout(),
    menu: initialMenu(),
    player: { name: '', resignation: '' },
    sat: {}, // 「坐下來看看」坐過幾次：{ 'uid:座位': 次數 }
    finished: false, // 第 2 章達成（雛形片尾）
    lastJournal: null,
  };
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const s = JSON.parse(storage?.getItem(SAVE_KEY) || 'null');
    if (!s || s.v !== VERSION) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSave(save, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 私密瀏覽或容量滿了：雛形不處理
  }
}

export function clearSave(storage = globalThis.localStorage) {
  try { storage?.removeItem(SAVE_KEY); } catch { /* 同上 */ }
}
