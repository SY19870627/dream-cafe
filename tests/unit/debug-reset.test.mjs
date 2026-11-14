import test from 'node:test';
import assert from 'node:assert/strict';
import { saveKeysToClear, shaOf, githackRef, reloadUrl, runningVersion, moduleRef, shouldPin, onBranch, isFullSha } from '../../src/debug/reset.js';
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

test('shouldPin：分支網址＋查到 sha 才轉；已釘 commit、沒 sha、非 githack 都不轉', () => {
  assert.equal(onBranch(BR), true);
  assert.equal(shouldPin(BR, SHA), true);
  assert.equal(shouldPin(BR.replace('raw.githack.com', 'rawcdn.githack.com'), SHA), true);
  const pinned = `https://raw.githack.com/SY19870627/dream-cafe/${SHA}/index.html?debug=1&v=0232a35`;
  assert.equal(onBranch(pinned), false);
  assert.equal(shouldPin(pinned, SHA), false);
  assert.equal(shouldPin(pinned, 'f'.repeat(40)), false, '已釘舊 commit 也不自動跳');
  assert.equal(shouldPin(BR, ''), false);
  assert.equal(shouldPin(BR, 'abc1234'), false, '短碼不算');
  assert.equal(shouldPin(BR, undefined), false);
  assert.equal(shouldPin('http://127.0.0.1:8080/index.html?debug=1', SHA), false);
  assert.equal(onBranch('http://127.0.0.1:8080/index.html?debug=1'), false);
  assert.equal(shouldPin('not a url', SHA), false);
  assert.equal(isFullSha(SHA), true);
  assert.equal(isFullSha('0232a35'), false);
});

test('shouldPin：轉完的網址再判一次不會再轉（防迴圈），debug=1 還在', () => {
  for (const start of [BR, 'https://raw.githack.com/SY19870627/dream-cafe/feat/v3b-acts1-4/', 'https://rawcdn.githack.com/SY19870627/dream-cafe/main/index.html?debug=1']) {
    assert.equal(shouldPin(start, SHA), true, start);
    const next = reloadUrl(start, SHA, 42);
    assert.equal(shouldPin(next, SHA), false, next);
    assert.equal(onBranch(next), false, next);
    // 第二次再轉一次（例如 API 又回了別的 sha）也不會轉
    assert.equal(shouldPin(next, 'e'.repeat(40)), false);
  }
  assert.equal(new URL(reloadUrl(BR, SHA, 42)).searchParams.get('debug'), '1');
});

test('runningVersion：看模組網址判斷實際在跑的程式', () => {
  const GH = 'https://raw.githack.com/SY19870627/dream-cafe/';
  const CDN = 'https://rawcdn.githack.com/SY19870627/dream-cafe/';
  // 釘 40 碼 commit：取前 7 碼，頁面的 ?v= 不管（就算是錯的）
  assert.equal(runningVersion(`${GH}${SHA}/src/debug/ui.js`, `${GH}${SHA}/index.html?debug=1&v=zzz`), '0232a35');
  assert.equal(runningVersion(`${CDN}${SHA.toUpperCase()}/src/debug/ui.js`, `${CDN}${SHA}/index.html?debug=1`), '0232a35');
  // 釘短碼（7 碼以上 16 進位）
  assert.equal(runningVersion(`${GH}b00eb97/src/debug/ui.js`, `${GH}b00eb97/index.html?debug=1`), 'b00eb97');
  assert.equal(runningVersion(`${GH}b00eb97c1/src/debug/ui.js`, `${GH}b00eb97c1/`), 'b00eb97');
  // 分支（名字有斜線），有沒有 v 都一樣：「未釘」
  assert.equal(runningVersion(`${GH}feat/v3b-acts1-4/src/debug/ui.js`, BR), '未釘');
  assert.equal(runningVersion(`${GH}feat/v3b-acts1-4/src/debug/ui.js`, `${GH}feat/v3b-acts1-4/index.html?debug=1`), '未釘');
  assert.equal(runningVersion(`${GH}main/src/debug/ui.js`, `${GH}main/`), '未釘');
  // 頁面釘了 commit、模組卻從分支載入（不會發生，但以模組為準）
  assert.equal(runningVersion(`${GH}feat/v3b-acts1-4/src/debug/ui.js`, `${GH}${SHA}/index.html`), '未釘');
  // 本機：一律 'local'（?v= 不算版本）
  assert.equal(runningVersion('http://127.0.0.1:8080/src/debug/ui.js', 'http://127.0.0.1:8080/index.html?debug=1&v=r42'), 'local');
  assert.equal(runningVersion('http://127.0.0.1:8080/src/debug/ui.js', 'http://127.0.0.1:8080/index.html?debug=1'), 'local');
  assert.equal(runningVersion('file:///D:/Git/dream-cafe/src/debug/ui.js', 'file:///D:/Git/dream-cafe/index.html'), 'local');
  // 別人的 repo、壞網址、沒給
  assert.equal(runningVersion('https://raw.githack.com/someone/else/main/src/debug/ui.js', 'https://raw.githack.com/someone/else/main/index.html'), 'local');
  assert.equal(runningVersion('不是網址', '也不是'), 'local');
  assert.equal(runningVersion(undefined, undefined), 'local');
  // 沒有模組網址就退回頁面網址判斷
  assert.equal(runningVersion('', `${GH}${SHA}/index.html`), '0232a35');
  // 絕不會冒出寫死的版本
  for (const v of [runningVersion('', ''), runningVersion(`${GH}main/src/debug/ui.js`, '')]) assert.doesNotMatch(v, /c155aaa/);
});

test('moduleRef：模組與頁面網址都拆得出 ref', () => {
  assert.equal(moduleRef('https://raw.githack.com/SY19870627/dream-cafe/feat/v3b-acts1-4/src/debug/ui.js'), 'feat/v3b-acts1-4');
  assert.equal(moduleRef(`https://raw.githack.com/SY19870627/dream-cafe/${SHA}/src/debug/ui.js?x=1`), SHA);
  assert.equal(moduleRef('https://raw.githack.com/SY19870627/dream-cafe/feat/v3b-acts1-4/index.html'), 'feat/v3b-acts1-4');
  assert.equal(moduleRef('https://raw.githack.com/SY19870627/dream-cafe/main/'), 'main');
  assert.equal(moduleRef('http://127.0.0.1/src/debug/ui.js'), null);
});
