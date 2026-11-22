// 聲音設定（目前只有「全部靜音」）：localStorage 獨立鍵 dream-cafe.audio，不寫進存檔 dream-cafe.v3b。 // 【待定】
// 作法比照 story/save.js：storage 可以傳入（測試用假的 localStorage）；壞資料一律回預設。 // 【待定】
export const AUDIO_KEY = 'dream-cafe.audio'; // 【待定】
export const AUDIO_VERSION = 1; // 【待定】
export const defaultAudioPref = () => ({ v: AUDIO_VERSION, muted: false }); // 【待定】

function defaultStorage() { // 【待定】
  try { return globalThis.localStorage || null; } catch { return null; } // 【待定】
} // 【待定】

export function normalizeAudioPref(raw) { // 【待定】
  if (!raw || typeof raw !== 'object' || raw.v !== AUDIO_VERSION || typeof raw.muted !== 'boolean') return defaultAudioPref(); // 【待定】
  return { v: AUDIO_VERSION, muted: raw.muted }; // 【待定】
} // 【待定】

export function loadAudioPref(storage = defaultStorage()) { // 【待定】
  if (!storage) return defaultAudioPref(); // 【待定】
  try { // 【待定】
    const raw = storage.getItem(AUDIO_KEY); // 【待定】
    return raw ? normalizeAudioPref(JSON.parse(raw)) : defaultAudioPref(); // 【待定】
  } catch { // 【待定】
    return defaultAudioPref(); // 【待定】
  } // 【待定】
} // 【待定】

export function saveAudioPref(pref, storage = defaultStorage()) { // 【待定】
  if (!storage) return false; // 【待定】
  try { storage.setItem(AUDIO_KEY, JSON.stringify(normalizeAudioPref({ v: AUDIO_VERSION, muted: !!pref?.muted }))); return true; } catch { return false; } // 【待定】
} // 【待定】
