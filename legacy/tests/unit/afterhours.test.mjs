// 階段 5 的純邏輯：龍眼（src/cat.js）、打烊後與咖啡日記、客人模式（src/afterhours.js）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/cat.js';
import * as H from '../../src/afterhours.js';
import * as S from '../../src/story.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';
import { writeJournal } from '../../src/journal.js';
import { TASKS, completeTasks } from '../../src/tasks.js';

const DAY = 864e5;
const T0 = new Date(2026, 10, 1, 21, 30).getTime();
function newSave() {
  const s = defaultSave(T0);
  giveStarters(s);
  s.flags.seenOpening = true;
  return s;
}
const place = (s, item) => s.owned.push({ uid: s.nextUid++, item, placed: true, x: 0, z: 0 });

test('龍眼（老闆不在的日子，營業日誌用）睡哪裡：依擺飾決定，同一天結果固定；有書櫃、軟墊時常睡那裡，不會每天都換', () => {
  const spotOn = (s, d) => C.catSpotFor(C.placedSet(s), (Number(s.createdAt) || 0) % 2147483647, d);
  const s = newSave();
  const base = new Set(C.availableSpots(C.placedSet(s)).map((x) => x.id));
  assert.deepEqual([...base].sort(), ['sill', 'sofa', 'step'], '沒有貓窩時：沙發、台階、窗台下');
  place(s, 'bookshelf');
  place(s, 'cat-cushion');
  const ids = [];
  for (let d = 1; d <= 60; d++) ids.push(spotOn(s, d).id);
  assert.deepEqual(ids, Array.from({ length: 60 }, (_, k) => spotOn(s, k + 1).id), '同一天永遠一樣');
  const fav = ids.filter((id) => id === 'bookshelf' || id === 'cushion').length;
  assert.ok(fav > 30, `書櫃與軟墊比較常選（${fav}/60）`);
  const changes = ids.filter((id, k) => k && id !== ids[k - 1]).length;
  assert.ok(changes > 5 && changes < 45, `會換，但不是每天換（換了 ${changes} 次）`);
  // 擺飾收起來，那個地方就不會再選
  s.owned.forEach((o) => { if (o.item === 'bookshelf') o.placed = false; });
  for (let d = 1; d <= 30; d++) assert.notEqual(spotOn(s, d).id, 'bookshelf');
});

test('龍眼：營業日誌只在換地方的那天寫一句', () => {
  const s = newSave();
  place(s, 'cat-tree');
  // 日誌：換了地方的那天才寫
  const page = writeJournal(s, T0, T0 + 20 * DAY);
  const texts = C.CAT_SPOTS.flatMap((x) => [x.journal, x.journalAlt]);
  for (const d of page.days) {
    const line = d.lines.find((l) => texts.includes(l));
    const seed = (Number(s.createdAt) || 0) % 2147483647;
    const placed = C.placedSet(s);
    const moved = C.catSpotFor(placed, seed, d.day).id !== C.catSpotFor(placed, seed, d.day - 1).id;
    if (line) assert.ok(moved, `第 ${d.day} 天沒換地方卻寫了「${line}」`);
  }
  // 沒見過予安時，書架那句不提她的書
  const c = { day: 3, placed: new Set(['bookshelf']), met: { yuan: false } };
  const spot = C.CAT_SPOTS.find((x) => x.id === 'bookshelf');
  assert.ok(!spot.journalAlt.includes('予安'));
  assert.ok(C.catJournalLine(1, { ...c, day: 1 }) === null, '第 1 天不寫換位子');
});

test('龍眼可以拒絕互動：短時間點太多次就走開，一陣子不理人', () => {
  const mood = { taps: [], awayUntil: 0 };
  const t = 1000;
  assert.equal(C.petCat(mood, t), 'purr');
  assert.equal(C.petCat(mood, t + 500), 'purr');
  assert.equal(C.petCat(mood, t + 900), 'purr');
  assert.equal(C.petCat(mood, t + 1300), 'refuse', `第 ${C.PET.limit} 次就走開`);
  assert.equal(C.petCat(mood, t + 5000), 'ignore');
  assert.equal(C.petCat(mood, t + 1300 + C.PET.away + 1), 'purr', '過一陣子又給摸');
  // 慢慢摸不會走開
  const calm = { taps: [], awayUntil: 0 };
  for (let k = 0; k < 20; k++) assert.equal(C.petCat(calm, k * C.PET.window), 'purr');
});

test('龍眼跳上老闆的椅子：要坐夠久；第一次一定會（溫度任務 #7），之後偶爾', () => {
  const s = newSave();
  assert.equal(C.jumpsOnChair(s, 3, 0), false, '剛坐下就站起來，椅子還不熱');
  assert.equal(C.jumpsOnChair(s, C.WARM_SEC, 0.99), true, '第一次一定跳');
  s.flags.catOnChair = true;
  assert.equal(C.jumpsOnChair(s, 60, 0.99), false);
  assert.equal(C.jumpsOnChair(s, 60, 0.1), true);
  assert.equal(completeTasks(s, { daysOpen: 1 }, T0).some((x) => x.id === 'cat-chair'), true);
  assert.ok(TASKS.find((x) => x.id === 'cat-chair').line, '由德叔一句話帶出');
});

test('打烊：一天一次；關燈的開關；存檔第 4 版補上打烊、日記、龍眼', () => {
  const s = newSave();
  assert.equal(H.closedOn(s, 3), false);
  H.startClosing(s, 3);
  assert.ok(H.closedOn(s, 3) && !H.closedOn(s, 4));
  assert.equal(H.toggleLight(s, 'p0'), true, '關掉');
  assert.deepEqual(s.closing.lightsOff, ['p0']);
  assert.equal(H.toggleLight(s, 'p0'), false, '再按一次打開');
  H.toggleLight(s, 'l3');
  H.startClosing(s, 3);
  assert.deepEqual(s.closing.lightsOff, ['l3'], '同一天再按打烊不會重來');
  H.startClosing(s, 4);
  assert.deepEqual(s.closing.lightsOff, [], '隔天是新的一晚');
  const old = migrate({ version: 3, createdAt: T0, lastSeen: T0, flags: { seenOpening: true } }, T0);
  assert.equal(old.version, SAVE_VERSION);
  assert.deepEqual(old.diary, []);
  assert.equal(old.closing.day, 0);
  assert.deepEqual(old.cat.seen, []);
});

test('「今天的一杯」：一天一篇、改寫取代、空白不寫、最多 40 字', () => {
  const s = newSave();
  assert.equal(H.writeDiary(s, { day: 2, t: T0, bean: 'dongshan', text: '   ' }), null);
  assert.equal(s.diary.length, 0);
  H.writeDiary(s, { day: 2, t: T0, bean: 'dongshan', text: '今天的雨聲很好聽。' });
  H.writeDiary(s, { day: 2, t: T0, bean: 'zhe-beans', text: '改一下：今天的山很清楚。' });
  assert.equal(s.diary.length, 1);
  assert.equal(H.diaryOn(s, 2).text, '改一下：今天的山很清楚。');
  H.writeDiary(s, { day: 1, t: T0, text: 'x'.repeat(100) });
  assert.equal([...H.diaryOn(s, 1).text].length, H.DIARY_MAX);
  assert.deepEqual(s.diary.map((e) => e.day), [1, 2], '依日子排好');
  H.writeDiary(s, { day: 2, t: T0, text: '' });
  assert.equal(H.diaryOn(s, 2), null, '清空就刪掉那一篇');
});

test('客人模式：溫度 ≥ 28°C 才邀請，一天問一次，當過客人就不再問；任務 #17', () => {
  const s = newSave();
  assert.equal(H.guestDue(s, 27.5, 9), false);
  assert.equal(H.guestDue(s, 28, 9), true);
  s.flags.guestOffered = 9;
  assert.equal(H.guestDue(s, 30, 9), false, '說了「下次吧」，今天不再問');
  assert.equal(H.guestDue(s, 30, 10), true, '隔天再問');
  s.flags.guestVisit = true;
  assert.equal(H.guestDue(s, 30, 11), false);
  assert.ok(completeTasks(s, { daysOpen: 11 }, T0).some((x) => x.id === 'guest-visit'));
});

test('客人模式的對話：依擺飾說不同的話，最後聊到老闆；予安的紙巾要她在場才說', () => {
  const s = newSave();
  const empty = H.guestTalk(s, ['yuan', 'zhe'], 9);
  assert.ok(empty.some((l) => l.text.includes('東西不多')), '店裡空空的');
  assert.equal(empty[empty.length - 1].text, H.GUEST_LAST[1][1], '最後一句聊老闆');
  assert.ok(empty.every((l) => l.who === 'yuan' || l.who === 'zhe'));
  for (const item of ['bookshelf', 'record-player', 'napkin', 'floor-lamp']) place(s, item);
  const texts = new Set();
  for (let d = 1; d <= 30; d++) for (const l of H.guestTalk(s, ['yuan', 'kevin'], d)) texts.add(l.who + ':' + l.text);
  const all = [...texts].join('\n');
  assert.ok(/書|唱機|紙巾|落地燈/.test(all), '聊到店裡擺的東西');
  assert.ok(all.includes('yuan:……那是我寫的'), '紙巾那段由予安自己說');
  const noYuan = H.guestTalk(s, ['zhe', 'kevin'], 3).map((l) => l.text).join('');
  assert.ok(!noYuan.includes('那是我寫的'), '予安不在就不說');
  for (const t of H.GUEST_TALKS) assert.equal(t.lines.length, 2, `${t.id} 一來一往`);
});

test('予安念稿改由打烊觸發；新的句子裡沒有上班或「不划算」的字眼', () => {
  const m = S.milestoneById('yuan5');
  assert.ok(m.needClosing && m.needClosingHint);
  assert.ok(!m.scene.some((x) => x.do === 'closing'), '不再自己演打烊');
  assert.equal(m.scene[m.scene.length - 1].do, 'leave', '念完稿，她回家');
  const all = [...H.allAfterLines(), ...C.CAT_SPOTS.flatMap((x) => [x.journal, x.journalAlt]), ...C.PURR, ...Object.values(C.CAT_LINES)].filter(Boolean);
  for (const t of all) assert.doesNotMatch(t, /不划算|划不來|KPI|業績|餘額|不足|打卡|加班/);
  assert.ok(H.CLOSING.lastCup === '最後一杯，是老闆的。' && H.GUEST.welcome === '歡迎。不急，先坐。', '劇本原文');
});
