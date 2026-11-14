import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPayload, reportText, COMMENT_MAX, GAME } from '../../src/debug/report.js';
import { submit, enqueue, readQueue, exportText, flush, post } from '../../src/debug/queue.js';
import { saveKeysToClear } from '../../src/debug/reset.js';

const TOKEN = 'secret-owner-token-123';
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const base = { state: { opening: { act: 'd1wake', line: 1 } }, beat: { who: 'deshu', text: '早' }, nameOf: () => '德叔', comment: '意見', device: '手機' };

test('payload：一定有 game=dream-cafe 和 owner（沒設定是空字串）', () => {
  assert.equal(GAME, 'dream-cafe');
  const p = buildPayload({ ...base, owner: TOKEN });
  assert.equal(p.game, 'dream-cafe');
  assert.equal(p.owner, TOKEN);
  assert.equal(buildPayload(base).owner, '');
});

test('意見最多 1000 字', () => {
  assert.equal(COMMENT_MAX, 1000);
  assert.equal(buildPayload({ ...base, comment: 'x'.repeat(1500) }).comment.length, 1000);
});

test('識別碼不出現在複製文字、佇列、匯出；送出時才帶上', async () => {
  const p = buildPayload({ ...base, owner: TOKEN });
  assert.ok(!reportText(p).includes(TOKEN));
  const storage = mem();
  // 沒有網址 → 進佇列，佇列裡沒有識別碼
  assert.equal(await submit(p, { storage, endpoint: '', owner: TOKEN }), 'queued');
  assert.ok(![...storage.m.values()].join('').includes(TOKEN));
  assert.ok(!exportText(readQueue(storage)).includes(TOKEN));
  assert.ok(!exportText([p]).includes(TOKEN));
  // 重送時從這台裝置的設定補上
  const bodies = [];
  const fetch = async (_u, o) => { bodies.push(JSON.parse(o.body)); return {}; };
  const r = await flush({ storage, endpoint: 'https://x/exec', key: 'k', fetch, owner: TOKEN });
  assert.equal(r.sent, 1);
  assert.equal(bodies[0].owner, TOKEN);
  assert.equal(bodies[0].game, 'dream-cafe');
  // 直接送出：payload 的 owner 帶上
  await post(p, { endpoint: 'https://x/exec', key: 'k', fetch });
  assert.equal(bodies[1].owner, TOKEN);
});

test('識別碼的鍵不會被「清除存檔重來」刪掉；ui.js 不 console 輸出識別碼', () => {
  assert.deepEqual(saveKeysToClear(['dream-cafe.debug.owner', 'dream-cafe.v3b']), ['dream-cafe.v3b']);
  const ui = readFileSync(new URL('../../src/debug/ui.js', import.meta.url), 'utf8');
  const coreUi = readFileSync(new URL('../../src/debug/core/ui.js', import.meta.url), 'utf8'); // 輸入框在除錯核心
  assert.match(ui, /OWNER_KEY = 'dream-cafe\.debug\.owner'/);
  assert.match(ui, /owner: OWNER_KEY/);
  for (const src of [ui, coreUi]) assert.doesNotMatch(src, /console\.\w+\([^)]*[Oo]wner/);
  assert.match(coreUi, /type = 'password'/);
});
