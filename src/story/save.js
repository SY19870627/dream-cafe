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
