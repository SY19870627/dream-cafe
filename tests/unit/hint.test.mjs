// 熟客場景的提示「這裡唯一要做的事情就是放鬆」：颱風夜（noHint）不顯示，其他場景照舊（作者 2026-11-02）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../src/story.js';

test('颱風夜（阿哲第三幕）不顯示場景提示', () => {
  assert.equal(S.sceneHint(S.milestoneById('zhe3')), '');
});

test('一般熟客劇情照舊顯示場景提示', () => {
  for (const id of ['kevin2', 'zhe1', 'zhe4', 'yuan1']) assert.equal(S.sceneHint(S.milestoneById(id)), '這裡唯一要做的事情就是放鬆', id);
});

test('不顯示提示的劇情只有颱風夜', () => {
  assert.deepEqual(S.MILESTONES.filter((m) => m.noHint).map((m) => m.id), ['zhe3']);
});

test('沒有場景時沒有提示', () => {
  assert.equal(S.sceneHint(null), '');
});
