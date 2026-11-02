// 熟客場景的提示「什麼都不用做，在這裡就好」：每個熟客場景都顯示，颱風夜也是（作者 2026-11-02，D177）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../src/story.js';

test('場景提示是作者的原文', () => {
  assert.equal(S.SCENE_HINT, '什麼都不用做，在這裡就好');
});

test('颱風夜（阿哲第三幕）也顯示場景提示', () => {
  assert.equal(S.sceneHint(S.milestoneById('zhe3')), S.SCENE_HINT);
});

test('一般熟客劇情顯示場景提示', () => {
  for (const id of ['kevin2', 'zhe1', 'zhe4', 'yuan1']) assert.equal(S.sceneHint(S.milestoneById(id)), S.SCENE_HINT, id);
});

test('目前沒有劇情隱藏提示', () => {
  assert.deepEqual(S.MILESTONES.filter((m) => m.noHint).map((m) => m.id), []);
});

test('沒有場景時沒有提示', () => {
  assert.equal(S.sceneHint(null), '');
});
