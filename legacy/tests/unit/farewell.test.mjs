// 階段 6 的純邏輯：徵店長與告別（src/farewell.js）、第二封信（src/letters.js）、存檔第 5 版、凱文寫的營業日誌
import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../../src/farewell.js';
import * as S from '../../src/story.js';
import { LETTERS, dueLetter, markRead, letterById } from '../../src/letters.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';
import { TASKS, temperature } from '../../src/tasks.js';
import { itemById, CATALOG } from '../../src/catalog.js';
import { writeJournal } from '../../src/journal.js';

const DAY = 864e5;
const T0 = new Date(2026, 10, 1, 21, 30).getTime();
function newSave() {
  const s = defaultSave(T0);
  giveStarters(s);
  s.flags.seenOpening = true;
  return s;
}
// 三條線走完、20 個任務完成（37°C）
function warmSave(day = 20) {
  const s = newSave();
  for (const m of S.MILESTONES) S.complete(s, m, day - 1);
  for (const t of TASKS) s.tasks.push({ id: t.id, t: T0, day: day - 1 });
  return s;
}

test('告別從 37°C 開始，而且要凱文先說了想留在東山（凱文里程碑 6）', () => {
  const s = newSave();
  assert.equal(F.segmentDue(s, 20, 36.5), null, '36.5°C 還不會開始');
  assert.equal(F.segmentDue(s, 20, 37), null, '凱文還沒說想留在東山');
  const w = warmSave();
  assert.equal(temperature(w), 37);
  assert.equal(F.segmentDue(w, 20)?.id, 'breathe');
  assert.ok(F.segment(1).needClosing && F.segment(1).hint, '第 1 段在打烊後；還沒打烊時德叔提一次');
});

test('七段照順序，一段只記一次；啟事隔天凱文來面試、阿哲隔天告別、最後一晚的隔天才離開東山', () => {
  const s = warmSave();
  const order = [];
  const run = (day) => { const seg = F.segmentDue(s, day); if (seg) { assert.ok(F.complete(s, seg.n, day)); order.push(`${seg.id}@${day}`); } return seg; };
  run(20); // 店會自己呼吸了
  assert.equal(F.complete(s, 1, 20), false, '同一段不會記兩次');
  assert.equal(F.complete(s, 3, 20), false, '不能跳段');
  F.postNotice(s, 1);
  assert.equal(F.noticeText(s), '徵一個不趕時間的人。');
  run(20); // 貼啟事（緊接著）
  assert.ok(F.noticeUp(s), '啟事貼在門口');
  assert.equal(F.segmentDue(s, 20), null, '凱文要隔天才來');
  assert.ok(F.segment(3).entrance && F.segment(3).who === 'kevin');
  run(21); // 面試
  assert.ok(!F.noticeUp(s), '面試之後啟事收起來');
  run(21); // 予安的告別（同一天）
  assert.equal(F.segmentDue(s, 21), null, '阿哲隔天才告別');
  run(22); run(22); // 阿哲、凱文的交接
  assert.ok(F.segmentDue(s, 22)?.lastNight, '最後一晚在交接那天打烊後');
  run(22);
  assert.deepEqual(order, ['breathe@20', 'notice@20', 'interview@21', 'yuan@21', 'zhe@22', 'handover@22', 'lastNight@22']);
  assert.equal(F.segmentDue(s, 23), null, '七段都演完了');
  assert.ok(!F.departureDue(s, 22) && F.departureDue(s, 23), '最後一晚的隔天：離開東山的早上');
  assert.ok(s.owned.some((o) => o.item === 'framed-napkin') && s.owned.some((o) => o.item === 'zhe-bean-bag'), '裱框的紙巾、一包阿哲的豆收進倉庫');
  assert.ok(itemById('framed-napkin').carry && itemById('zhe-bean-bag').carry, '兩件都可以帶去下一站');
  assert.ok(!CATALOG.some((i) => i.id === 'framed-napkin' || i.id === 'zhe-bean-bag'), '不在型錄上賣');
  assert.ok(F.depart(s, T0) && !F.depart(s, T0) && F.departed(s) && !F.departureDue(s, 24), '離開東山只記一次');
});

test('告別那天需要誰，誰就會來；面試那天凱文自己走進來', () => {
  const s = warmSave();
  F.complete(s, 1, 20); F.complete(s, 2, 20);
  assert.deepEqual([...F.needsToday(s, 21)], ['yuan'], '面試（凱文自己走進來）之後是予安的告別');
  F.complete(s, 3, 21); F.complete(s, 4, 21);
  assert.deepEqual([...F.needsToday(s, 22)].sort(), ['kevin', 'zhe'], '阿哲的告別與凱文的交接');
  F.complete(s, 5, 22); F.complete(s, 6, 22);
  assert.deepEqual([...F.needsToday(s, 22)], ['kevin'], '最後一晚凱文留下來');
});

test('最後一晚德叔叫老闆的名字；沒留名字時說「……謝謝你，老闆。」', () => {
  assert.equal(F.nameLine('小林'), '小林，這一杯，是你的。');
  assert.ok(F.nameLine('').endsWith('……謝謝你，老闆。'));
  assert.ok(F.nameLine('  ').endsWith('……謝謝你，老闆。'));
  assert.ok(F.segment(7).scene.some((st) => st.do === 'name') && F.segment(7).scene.some((st) => st.do === 'cat' && st.who === 'kevin' && st.lap), '龍眼睡在凱文的腿上');
});

test('第二封信：離開東山的早上才交，劇本原文；讀過就不再交', () => {
  const s = warmSave();
  markRead(s, 'first', T0, 2);
  for (let n = 1; n <= 7; n++) F.complete(s, n, 22);
  assert.equal(dueLetter(s, { daysOpen: 22, temp: 37 }), null, '最後一晚當天還不交');
  const l = dueLetter(s, { daysOpen: 23, temp: 37 });
  assert.equal(l?.id, 'second');
  assert.equal(letterById('second'), LETTERS[1]);
  assert.ok(l.paragraphs.join('').includes('之後每一個明天，都是公休。') && l.paragraphs.join('').includes('它比我還老，也比我會等。'));
  markRead(s, 'second', T0, 23);
  assert.equal(dueLetter(s, { daysOpen: 23, temp: 37 }), null);
});

test('存檔第 5 版：舊存檔補上告別的預設值', () => {
  assert.ok(SAVE_VERSION >= 5); // 第 6 版（店裡的小事）見 moments.test.mjs
  const old = JSON.parse(JSON.stringify(newSave()));
  old.version = 4;
  delete old.farewell;
  const s = migrate(old, T0 + DAY);
  assert.deepEqual(s.farewell, F.blankFarewell());
  assert.equal(s.version, SAVE_VERSION);
});

test('離開東山之後，營業日誌由凱文寫（多出凱文的句子）；台詞裡沒有「不划算」「KPI」', () => {
  const s = warmSave(5);
  let keeperLines = 0;
  for (let k = 0; k < 12; k++) {
    const page = writeJournal(s, T0 + k * 4 * DAY, T0 + (k * 4 + 3) * DAY, { keeper: true });
    keeperLines += page.days.flatMap((d) => d.lines).filter((t) => F.KEEPER_JOURNAL.includes(t)).length;
  }
  assert.ok(keeperLines > 0, '凱文的日誌句子會出現');
  const plain = writeJournal(s, T0, T0 + 40 * DAY);
  assert.ok(!plain.days.flatMap((d) => d.lines).some((t) => F.KEEPER_JOURNAL.includes(t)), '德叔的日誌沒有凱文的句子');
  const all = F.allFarewellLines().join('');
  assert.ok(!/不划算|KPI|划算/.test(all));
  assert.ok(F.allFarewellLines().every((t) => typeof t === 'string' && t.length > 0));
});
