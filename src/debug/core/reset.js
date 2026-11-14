// 「清除存檔重來」「重新載入最新版」「本人識別碼」的純邏輯（不碰 DOM；storage 從參數傳進來，才能在 Node 測試）。

/**
 * @typedef {object} ClearRule 清除存檔要刪哪些鍵
 * @property {(key: string) => boolean} isGameSaveKey 這個鍵是不是遊戲存檔（是才刪）
 * @property {string[]} [keepKeys] 絕不刪的鍵（完全相同）
 * @property {string[]} [keepPrefixes] 絕不刪的鍵的開頭
 */

/**
 * 從所有 storage 鍵裡挑出要刪的：是遊戲存檔、又不在「絕不刪」名單裡的。
 * @param {Iterable<unknown>} keys
 * @param {ClearRule} rule
 * @returns {string[]}
 */
export function keysToClear(keys, rule) {
  const keep = new Set(rule.keepKeys || []);
  const prefixes = rule.keepPrefixes || [];
  return [...keys].filter((k) => typeof k === 'string'
    && !keep.has(k) && !prefixes.some((p) => p && k.startsWith(p))
    && !!rule.isGameSaveKey(k));
}

/**
 * 把 storage 裡所有的鍵列出來（localStorage 的 length／key(i)）。
 * @param {{ length: number, key(i: number): string | null } | null | undefined} storage
 * @returns {string[]}
 */
export function storageKeys(storage) {
  /** @type {string[]} */
  const keys = [];
  if (!storage) return keys;
  for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k != null) keys.push(k); }
  return keys;
}

/**
 * 沒給 version.reloadUrl 時的「重新載入最新版」網址：路徑不動，其他參數（debug=1 等）照留，
 * 加 _r＝時間，連頁面本身也不會吃快取。
 * @param {string} url
 * @param {number} [now=Date.now()]
 * @returns {string}
 */
export function bustUrl(url, now = Date.now()) {
  const u = new URL(url);
  u.searchParams.set('_r', String(now));
  return u.toString();
}

/**
 * 本人識別碼的存取（只存在這台裝置；不顯示、不記錄）。
 * @param {{ getItem(k: string): string | null, setItem(k: string, v: string): void, removeItem(k: string): void } | null | undefined} storage
 * @param {string} key
 */
export function ownerStore(storage, key) {
  return {
    /** @returns {string} 沒設定是空字串 */
    read() { try { return storage?.getItem(key) || ''; } catch { return ''; } },
    /** @param {string} v 前後空白會去掉；空字串不存 @returns {boolean} 有沒有存 */
    write(v) {
      const s = String(v ?? '').trim();
      if (!s) return false;
      try { storage?.setItem(key, s); return true; } catch { return false; }
    },
    clear() { try { storage?.removeItem(key); } catch { /* 沒有就算了 */ } },
  };
}
