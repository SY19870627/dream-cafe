// 回報的送出與離線佇列（純邏輯）：storage、fetch、是否連線都從參數傳進來，才能在 Node 測試。
// 送不出去（沒設網址、離線、fetch 丟錯）就存進 storage 的佇列；之後重送（啟動時、每 30 秒、重新連線時）。
// 送出用 no-cors + text/plain：不觸發 CORS 預檢；回應是 opaque、讀不到內容，所以「fetch 沒丟錯」就算送出。

/** 自動重送的間隔（毫秒）。 */
export const RETRY_MS = 30000;

/**
 * @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void, removeItem(key: string): void }} StorageLike
 * 和 localStorage 一樣的介面（測試可以用 Map 做一個假的）
 */

/**
 * @typedef {object} SendDeps 送出要用的東西
 * @property {string} [endpoint] 收件網址；空字串＝還沒設定，只存佇列
 * @property {string} [key] 收件端的密語（放在 body 的 key 欄）
 * @property {string} [owner] 本人識別碼（送出那一刻才補上）
 * @property {(url: string, init: any) => Promise<unknown>} [fetch]
 * @property {StorageLike | null} [storage]
 * @property {boolean} [online] false＝離線，不送
 */

/**
 * 本人識別碼不存進佇列、不匯出：拿掉 owner 欄。
 * @template {Record<string, any>} T
 * @param {T | null | undefined} x
 * @returns {Omit<T, 'owner'>}
 */
export const withoutOwner = (x) => { const { owner, ...rest } = /** @type {any} */ (x || {}); return rest; };

/**
 * 只送一筆：沒有網址或離線就不送（回傳 false）；fetch 丟錯回傳 false；其他回傳 true。
 * @param {Record<string, any>} payload
 * @param {SendDeps} [deps]
 * @returns {Promise<boolean>}
 */
export async function post(payload, deps = {}) {
  const { endpoint, key, fetch: f, online = true } = deps;
  if (!endpoint || online === false || typeof f !== 'function') return false;
  try {
    await f(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key, ...payload, owner: payload.owner || deps.owner || '' }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 匯出佇列（複製到剪貼簿用）：JSON 文字，不含本人識別碼。
 * @param {Array<Record<string, any>>} list
 * @returns {string}
 */
export function exportText(list) {
  return JSON.stringify(list.map(withoutOwner), null, 2);
}

/**
 * 做一組綁定在 storage 鍵 queueKey 上的佇列函式。
 * @param {string} queueKey 佇列存在 storage 的哪個鍵
 */
export function createQueue(queueKey) {
  if (!queueKey) throw new Error('createQueue 要給佇列的 storage 鍵');

  /**
   * 讀佇列；壞掉或沒有就是空陣列。
   * @param {StorageLike | null | undefined} storage
   * @returns {Array<Record<string, any>>}
   */
  function readQueue(storage) {
    if (!storage) return [];
    try {
      const list = JSON.parse(storage.getItem(queueKey) || '[]');
      return Array.isArray(list) ? list.filter((x) => x && typeof x === 'object') : [];
    } catch {
      return [];
    }
  }

  /**
   * 寫回佇列；容量不夠時先從最舊的開始拿掉截圖，再不夠就丟最舊的。回傳實際存下來的那份（或 null：storage 不能用）。
   * @param {StorageLike | null | undefined} storage
   * @param {Array<Record<string, any>>} list
   * @returns {Array<Record<string, any>> | null}
   */
  function writeQueue(storage, list) {
    if (!storage) return null;
    let items = list.map((x) => ({ ...x }));
    for (;;) {
      try {
        if (items.length) storage.setItem(queueKey, JSON.stringify(items));
        else storage.removeItem(queueKey);
        return items;
      } catch {
        const withShot = items.findIndex((x) => x.screenshot);
        if (withShot >= 0) items[withShot] = { ...items[withShot], screenshot: '' };
        else if (items.length) items = items.slice(1);
        else return null;
      }
    }
  }

  /**
   * 加一筆到佇列尾端（不含本人識別碼）。
   * @param {StorageLike | null | undefined} storage
   * @param {Record<string, any>} payload
   */
  function enqueue(storage, payload) {
    return writeQueue(storage, [...readQueue(storage), withoutOwner(payload)]);
  }

  /**
   * 送出一筆：送成功回傳 'sent'；送不出去存進佇列回傳 'queued'。
   * @param {Record<string, any>} payload
   * @param {SendDeps} [deps]
   * @returns {Promise<'sent' | 'queued'>}
   */
  async function submit(payload, deps = {}) {
    if (await post(payload, deps)) return 'sent';
    enqueue(deps.storage, payload);
    return 'queued';
  }

  /**
   * 重送佇列：照順序送，送成功的拿掉；中途有一筆送不出去就停（多半是又斷線了），剩下的留著。
   * 送的時候佇列可能又多了新的（使用者剛好又回報）：寫回時以「目前 storage 裡的」扣掉送成功的。
   * @param {SendDeps} [deps]
   * @returns {Promise<{ sent: number, left: number }>}
   */
  async function flush(deps = {}) {
    const { storage } = deps;
    const list = readQueue(storage);
    if (!list.length || !deps.endpoint || deps.online === false) return { sent: 0, left: list.length };
    /** @param {Record<string, any>} x */
    const keyOf = (x) => `${x.time}|${x.scene}|${x.line}|${x.comment}`;
    const done = new Set();
    for (const item of list) {
      if (!(await post(item, deps))) break;
      done.add(keyOf(item));
    }
    const rest = readQueue(storage).filter((x) => !done.has(keyOf(x)));
    writeQueue(storage, rest);
    return { sent: done.size, left: rest.length };
  }

  return { key: queueKey, readQueue, writeQueue, enqueue, submit, flush };
}
