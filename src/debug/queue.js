// 回報的送出與離線佇列（純邏輯）：storage、fetch、是否連線都從參數傳進來，才能在 Node 測試。
// 做法在除錯核心（./core/queue.js）；這裡只定 dream-cafe 的佇列鍵，並把綁好鍵的函式照原本的名字匯出。
import { createQueue } from './core/queue.js';

export const QUEUE_KEY = 'dream-cafe.debug.queue';
export { RETRY_MS, withoutOwner, post, exportText } from './core/queue.js';

const queue = createQueue(QUEUE_KEY);
export const { readQueue, writeQueue, enqueue, submit, flush } = queue;
