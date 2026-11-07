// 承峰 11/3 試玩回饋：等客人的提示（D179）、完成任務的小紙條（D180）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../src/story.js';
import { TASKS, stageNoteText } from '../../src/tasks.js';

test('熟客場景的提示仍是作者的原文（D219「營業中」）', () => {
  assert.equal(S.SCENE_HINT, '營業中');
});

test('有人快走到門口：不管多久沒人說話，都先說「好像有人往這邊走來了」', () => {
  assert.equal(S.waitHint({ approaching: true, nextMs: 3000, idleMs: 0 }), S.WAIT_HINT.approach);
  assert.equal(S.waitHint({ approaching: true, here: true, idleMs: 0 }), S.WAIT_HINT.approach);
});

test('剛坐下、剛有人說完話：照舊顯示操作說明', () => {
  assert.equal(S.waitHint({ nextMs: 30000, idleMs: S.WAIT_IDLE_MS - 1 }), '');
  assert.equal(S.waitHint({ nextMs: null, idleMs: 0 }), '');
});

test('一陣子沒人說話：依下一位客人什麼時候來換句子', () => {
  const idle = S.WAIT_IDLE_MS;
  assert.equal(S.waitHint({ nextMs: 30000, idleMs: idle }), S.WAIT_HINT.soon);
  assert.equal(S.waitHint({ nextMs: 30000, idleMs: idle, here: true }), S.WAIT_HINT.soon);
  assert.equal(S.waitHint({ nextMs: S.WAIT_SOON_MS + 1, idleMs: idle }), S.WAIT_HINT.later);
  assert.equal(S.waitHint({ nextMs: null, idleMs: idle }), S.WAIT_HINT.quiet);
});

test('店裡有熟客、下一位還要很久：照舊顯示「點人物可以搭話」', () => {
  assert.equal(S.waitHint({ nextMs: null, idleMs: S.WAIT_IDLE_MS, here: true }), '');
  assert.equal(S.waitHint({ nextMs: S.WAIT_SOON_MS * 3, idleMs: S.WAIT_IDLE_MS, here: true }), '');
});

test('等待的句子不催促、不報時間，用全形標點', () => {
  for (const t of Object.values(S.WAIT_HINT)) {
    assert.doesNotMatch(t, /快點|趕快|馬上|請等待|載入|秒|分鐘|\d/);
    assert.doesNotMatch(t, /\.\.\./);
  }
  assert.ok(S.allLines().includes(S.WAIT_HINT.approach), '校稿清單裡有等待的句子');
});

test('完成任務的小紙條：每個任務都有名稱與升了幾度，和記事本同一個名稱', () => {
  for (const t of TASKS) {
    const n = stageNoteText(t);
    assert.equal(n.title, t.name);
    assert.equal(n.sub, `店裡暖了一點 +${t.temp}°C`);
    assert.doesNotMatch(n.title + n.sub, /KPI|不划算|任務完成|達成/);
  }
});
