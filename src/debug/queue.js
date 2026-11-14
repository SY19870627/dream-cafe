// 回報的送出與離線佇列（純邏輯）：storage、fetch、是否連線都從參數傳進來，才能在 Node 測試。
// 送不出去（沒設網址、離線、fetch 丟錯）就存進 storage 的佇列；之後重送（啟動時、每 30 秒、重新連線時）。
// 送出用 no-cors + text/plain：不觸發 CORS 預檢；回應是 opaque、讀不到內容，所以「fetch 沒丟錯」就算送出。
export const QUEUE_KEY = 'dream-cafe.debug.queue';
export const RETRY_MS = 30000;

export function readQueue(storage) {
  if (!storage) return [];
  try {
    const list = JSON.parse(storage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x) => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
}

// 寫回佇列；容量不夠時先從最舊的開始拿掉截圖，再不夠就丟最舊的。回傳實際存下來的那份（或 null：storage 不能用）
export function writeQueue(storage, list) {
  if (!storage) return null;
  let items = list.map((x) => ({ ...x }));
  for (;;) {
    try {
      if (items.length) storage.setItem(QUEUE_KEY, JSON.stringify(items));
      else storage.removeItem(QUEUE_KEY);
      return items;
    } catch {
      const withShot = items.findIndex((x) => x.screenshot);
      if (withShot >= 0) items[withShot] = { ...items[withShot], screenshot: '' };
      else if (items.length) items = items.slice(1);
      else return null;
    }
  }
}

export function enqueue(storage, payload) {
  return writeQueue(storage, [...readQueue(storage), payload]);
}

// 只送一筆：沒有網址或離線就不送（回傳 false）；fetch 丟錯回傳 false；其他回傳 true
export async function post(payload, { endpoint, key, fetch: f, online = true } = {}) {
  if (!endpoint || online === false || typeof f !== 'function') return false;
  try {
    await f(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key, ...payload }),
    });
    return true;
  } catch {
    return false;
  }
}

// 送出一筆：送成功回傳 'sent'；送不出去存進佇列回傳 'queued'
export async function submit(payload, deps = {}) {
  if (await post(payload, deps)) return 'sent';
  enqueue(deps.storage, payload);
  return 'queued';
}

// 重送佇列：照順序送，送成功的拿掉；中途有一筆送不出去就停（多半是又斷線了），剩下的留著。
// 送的時候佇列可能又多了新的（使用者剛好又回報）：寫回時以「目前 storage 裡的」扣掉送成功的。
export async function flush(deps = {}) {
  const { storage } = deps;
  const list = readQueue(storage);
  if (!list.length || !deps.endpoint || deps.online === false) return { sent: 0, left: list.length };
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

// 匯出佇列（複製到剪貼簿用）：JSON 文字
export function exportText(list) {
  return JSON.stringify(list, null, 2);
}
