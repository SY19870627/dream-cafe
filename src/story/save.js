// v3b 存檔：localStorage 獨立鍵 dream-cafe.v3b。不讀、不寫、不刪 v3a（dream-cafe.v3a）與第一版（dream-cafe.save）的鍵。
// storage 可以傳入（測試用假的 localStorage）；讀回來一律先過 normalize()。
import { newStoryState, normalize } from './state.js';

export const SAVE_KEY = 'dream-cafe.v3b';
export const OTHER_KEYS = ['dream-cafe.v3a', 'dream-cafe.save'];

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function load(source, storage = defaultStorage()) {
  if (!storage) return newStoryState();
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? normalize(JSON.parse(raw), source) : newStoryState();
  } catch {
    return newStoryState();
  }
}

export function persist(state, storage = defaultStorage()) {
  if (!storage) return false;
  try { storage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

/* ---------- 網址 ?reset=1：開機時（load 之前）清掉 v3b 存檔，從頭開始 ---------- */
// 只清 dream-cafe.v3b（不碰 v3a、第一版、除錯回報佇列）。清完把 reset 從網址拿掉（其他參數如 debug=1 留著），
// 不然把帶 reset 的網址存成書籤，每次重整都會清檔。
// （跟 main.js 裡換畫面清 UI 的 reset() 無關。）
const params = (search) => { try { return new URLSearchParams(String(search ?? '')); } catch { return new URLSearchParams(); } };
// 網址要不要清檔：reset 參數剛好是 '1'
export const wantsReset = (search) => params(search).get('reset') === '1';
// 拿掉 reset 之後的 search 字串（含開頭的 ?；沒有參數了就是空字串）
export function searchWithoutReset(search) {
  const p = params(search);
  p.delete('reset');
  const s = p.toString();
  return s ? `?${s}` : '';
}
// 開機呼叫：有 ?reset=1 就清檔並改網址（history.replaceState，不重新載入）。回傳有沒有清。
// 沒有 location／storage／history（Node 測試）時不丟錯。
export function resetFromUrl(loc = globalThis.location, storage = defaultStorage(), hist = globalThis.history) {
  const search = loc?.search;
  if (!wantsReset(search)) return false;
  try { storage?.removeItem(SAVE_KEY); } catch { /* 存不了就算了 */ }
  try { hist?.replaceState?.(hist.state ?? null, '', `${loc.pathname ?? ''}${searchWithoutReset(search)}${loc.hash ?? ''}`); } catch { /* 改不了網址也不擋開機 */ }
  return true;
}
