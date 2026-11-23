// 音樂跨網域被靜音（預覽站 raw.githack.com 的音檔 301 到 raw.githubusercontent.com）：
// makeSlot() 建立 <audio> 後必須先設 crossOrigin = 'anonymous'，才能接 MediaElementSource、才能設 src／load()。 // 【待定】
// 只讀原始碼，不開瀏覽器、不出聲。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../../src/view/audio.js', import.meta.url)), 'utf8');

test('makeSlot：建立 audio 元素後、載入與接 MediaElementSource 之前就設 crossOrigin = anonymous', () => {
  const m = src.match(/function makeSlot\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, '找不到 makeSlot()');
  const body = m[0];
  const create = body.indexOf("document.createElement('audio')");
  const cors = body.search(/el\.crossOrigin\s*=\s*'anonymous'/);
  const source = body.indexOf('createMediaElementSource');
  assert.ok(create >= 0, 'makeSlot 沒有建立 audio 元素');
  assert.ok(cors > create, 'crossOrigin 要在建立 audio 之後設');
  assert.ok(source > cors, 'crossOrigin 要在 createMediaElementSource 之前設');
  const before = body.slice(0, cors);
  assert.doesNotMatch(before, /\.src\s*=|\.load\(\)/, 'crossOrigin 之前不能先設 src 或 load()');
});

test('audio.js 其它地方不會把 crossOrigin 改掉或拿掉', () => {
  const sets = src.match(/crossOrigin\s*=/g) || [];
  assert.equal(sets.length, 1, 'crossOrigin 只應在 makeSlot 設一次');
  assert.doesNotMatch(src, /removeAttribute\(\s*'crossorigin'\s*\)/i);
});
