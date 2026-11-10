// v3 存檔：localStorage 獨立鍵，跟第一版（dream-cafe.save）分開，不讀也不遷移舊存檔。
// 內容就是 day.js 的狀態（JSON），讀回來先過 normalize()。
import { newState, normalize } from './day.js';

export const SAVE_KEY = 'dream-cafe.v3a';

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function load() {
  const st = storage();
  if (!st) return newState();
  try {
    const raw = st.getItem(SAVE_KEY);
    return raw ? normalize(JSON.parse(raw)) : newState();
  } catch {
    return newState();
  }
}

export function persist(state) {
  const st = storage();
  if (!st) return false;
  try { st.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
