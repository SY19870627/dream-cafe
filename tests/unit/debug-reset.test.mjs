import test from 'node:test';
import assert from 'node:assert/strict';
import { saveKeysToClear, shaOf, githackRef, reloadUrl, currentVersion } from '../../src/debug/reset.js';
import { SAVE_KEY, OTHER_KEYS } from '../../src/story/save.js';
import { QUEUE_KEY } from '../../src/debug/queue.js';

const SHA = '0232a35' + 'a'.repeat(33);
const BR = 'https://raw.githack.com/SY19870627/dream-cafe/feat/v3b-acts1-4/index.html?debug=1&v=c155aaa';

test('清除存檔：只刪遊戲進度，回報佇列、快轉設定、別的網站資料都不動', () => {
  const keys = [SAVE_KEY, ...OTHER_KEYS, QUEUE_KEY, 'dream-cafe.debug.fast', 'other-app', null];
  assert.deepEqual(saveKeysToClear(keys), [SAVE_KEY, ...OTHER_KEYS]);
  assert.ok(!saveKeysToClear(keys).includes(QUEUE_KEY));
});

test('shaOf：只收 40 碼 commit', () => {
  assert.equal(shaOf({ sha: SHA.toUpperCase() }), SHA);
  assert.equal(shaOf({ sha: 'abc' }), '');
  assert.equal(shaOf(null), '');
});

test('githackRef：分支名含斜線也拆得對；不是 githack 回 null', () => {
  assert.deepEqual(githackRef(BR), { ref: 'feat/v3b-acts1-4', file: 'index.html' });
  assert.deepEqual(githackRef(`https://raw.githack.com/SY19870627/dream-cafe/${SHA}/`), { ref: SHA, file: 'index.html' });
  assert.equal(githackRef('http://127.0.0.1:8080/index.html?debug=1'), null);
});

test('reloadUrl：拿到 commit → 路徑換成 commit、v＝短碼、debug=1 留著、加 _r', () => {
  const u = new URL(reloadUrl(BR, SHA, 123));
  assert.equal(u.pathname, `/SY19870627/dream-cafe/${SHA}/index.html`);
  assert.equal(u.searchParams.get('v'), '0232a35');
  assert.equal(u.searchParams.get('debug'), '1');
  assert.equal(u.searchParams.get('_r'), '123');
  // 已經釘在舊 commit 的網址也換成新的
  const old = reloadUrl(`https://raw.githack.com/SY19870627/dream-cafe/${'b'.repeat(40)}/index.html?debug=1`, SHA, 1);
  assert.ok(old.includes(`/${SHA}/index.html`));
});

test('reloadUrl：查不到 commit 或本機 → 路徑不動，v＝時間', () => {
  const u = new URL(reloadUrl(BR, '', 999));
  assert.equal(u.pathname, '/SY19870627/dream-cafe/feat/v3b-acts1-4/index.html');
  assert.equal(u.searchParams.get('v'), '999');
  const l = new URL(reloadUrl('http://127.0.0.1:8080/index.html?debug=1', SHA, 5));
  assert.equal(l.pathname, '/index.html');
  assert.equal(l.searchParams.get('v'), '0232a35');
});

test('currentVersion：釘 commit 的路徑優先，其次 ?v=，再來 BUILD', () => {
  assert.equal(currentVersion(`https://raw.githack.com/SY19870627/dream-cafe/${SHA}/index.html?v=zzz`, 'b'), '0232a35');
  assert.equal(currentVersion(BR, 'b'), 'c155aaa');
  assert.equal(currentVersion('http://127.0.0.1/index.html', 'b'), 'b');
});
