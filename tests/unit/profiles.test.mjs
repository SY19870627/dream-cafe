// 人物誌分段揭露（承峰 11/6：「我希望你直接完成這兩項 ……人物誌分段揭露……」，D218；D209 放記事本和相簿；存檔第 12 版）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as PR from '../../src/profiles.js';
import { REGULARS } from '../../src/story.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';
import { temperature } from '../../src/tasks.js';

const T0 = new Date(2026, 10, 6, 21, 30).getTime();
const blank = () => { const s = defaultSave(T0); giveStarters(s); return s; };
const newSave = () => { const s = blank(); s.flags.seenOpening = true; return s; };
const reach = (s, who, n) => { for (let i = 1; i <= n; i++) if (!s.regulars[who].milestones.includes(i)) s.regulars[who].milestones.push(i); };
const texts = (s, who) => (PR.profilePage(s, who)?.segs || []).map((x) => x.n);

test('存檔第 12 版：新存檔有 profiles（還沒寫進任何一段）', () => {
  assert.ok(SAVE_VERSION >= 12);
  const s = blank();
  assert.deepEqual(s.profiles, { got: {} });
  assert.deepEqual(PR.syncProfiles(s, 1), []); // 開場還沒看完：什麼都不寫
  assert.deepEqual(PR.openPages(s), []);
});

test('看過開場：德叔、龍眼、老先生開頁；熟客見過才開頁', () => {
  const s = newSave();
  const added = PR.syncProfiles(s, 1);
  assert.deepEqual(added.map((x) => x.who).sort(), ['deshu', 'longan', 'oldman']);
  assert.deepEqual(PR.openPages(s), ['deshu', 'longan', 'oldman']);
  reach(s, 'zhe', 1);
  PR.syncProfiles(s, 2);
  assert.ok(PR.pageOpen(s, 'zhe'));
  assert.equal(PR.profilePage(s, 'zhe').segs[0].text, REGULARS.zhe.about, '第一段照抄記事本原本那一行');
  assert.equal(PR.profilePage(s, 'zhe').segs[0].day, 2);
  assert.equal(PR.profilePage(s, 'yuan'), null);
  assert.equal(PR.syncProfiles(s, 3).length, 0, '同一段只寫一次');
});

test('予安：照分段揭露表，里程碑、照片、告別一段一段寫進去；沒寫進去的不出現', () => {
  const s = newSave();
  reach(s, 'yuan', 3);
  PR.syncProfiles(s, 5);
  assert.deepEqual(texts(s, 'yuan'), [1, 3], '照片 yuan-1 還沒拿到：第 2 段不出現（也不留空格）');
  s.photos.push({ id: 'yuan-1', day: 6, t: 0, item: 'black', snack: false });
  PR.syncProfiles(s, 6);
  assert.deepEqual(texts(s, 'yuan'), [1, 2, 3]);
  assert.equal(PR.profilePage(s, 'yuan').segs[1].photo, 'yuan-1');
  s.photos.push({ id: 'yuan-2', day: 9, t: 0, item: 'cocoa', snack: false }, { id: 'yuan-3', day: 12, t: 0, item: 'black', snack: true });
  s.farewell.step = 4;
  PR.syncProfiles(s, 20);
  assert.deepEqual(texts(s, 'yuan'), [1, 2, 3, 4, 5, 6]);
});

test('凱文：kevin2 以前叫「冰美式先生」；第 2 段要名字和照片都有；店長的事等交鑰匙', () => {
  const s = newSave();
  reach(s, 'kevin', 1);
  s.photos.push({ id: 'kevin-1', day: 4, t: 0, item: 'iced', snack: false });
  PR.syncProfiles(s, 4);
  assert.equal(PR.profileName(s, 'kevin'), '冰美式先生');
  assert.deepEqual(texts(s, 'kevin'), [1]);
  assert.ok(!PR.profilePage(s, 'kevin').segs.some((x) => /凱文/.test(x.text)), '名字還沒出現');
  reach(s, 'kevin', 2);
  PR.syncProfiles(s, 5);
  assert.match(PR.profileName(s, 'kevin'), /凱文/);
  assert.deepEqual(texts(s, 'kevin'), [1, 2]);
  reach(s, 'kevin', 6);
  s.photos.push({ id: 'kevin-3', day: 20, t: 0, item: 'dongshan', snack: false });
  PR.syncProfiles(s, 20);
  assert.ok(!texts(s, 'kevin').includes(6));
  s.farewell.step = 6;
  PR.syncProfiles(s, 25);
  assert.ok(texts(s, 'kevin').includes(6));
});

test('德叔：學徒的秘密第一站不寫；老先生以已故為準、只指向信', () => {
  const s = newSave();
  s.letters.push({ id: 'first', t: 0, day: 3 }, { id: 'second', t: 0, day: 40 });
  reach(s, 'zhe', 2);
  s.tasks.push({ id: 'open-7-days', t: 0, day: 7 });
  s.farewell.step = 7;
  PR.syncProfiles(s, 40);
  assert.deepEqual(texts(s, 'deshu'), [1, 2, 3, 4, 5]);
  for (const seg of PR.profilePage(s, 'deshu').segs) assert.doesNotMatch(seg.text, /學徒/);
  const old = PR.profilePage(s, 'oldman');
  assert.deepEqual(old.segs.map((x) => x.letter), ['lawyer', 'first', 'second']);
  for (const seg of old.segs) assert.doesNotMatch(seg.text, /還在|現在在|坐在角落/);
  assert.match(old.segs[0].text, /過世/);
});

test('阿公（阿哲的阿公）：zhe4 才開頁；龍眼：任務 cat-chair、kevin3', () => {
  const s = newSave();
  reach(s, 'zhe', 3);
  PR.syncProfiles(s, 8);
  assert.ok(!PR.pageOpen(s, 'grandpa'), '只出現在阿哲的話裡時不開頁');
  reach(s, 'zhe', 5);
  s.tasks.push({ id: 'cat-chair', t: 0, day: 8 });
  reach(s, 'kevin', 3);
  PR.syncProfiles(s, 12);
  assert.deepEqual(texts(s, 'grandpa'), [1, 3]);
  assert.deepEqual(texts(s, 'longan'), [1, 3, 4]);
});

test('第 11 版舊存檔升上來：已經發生過的段落補進去（第 0 天，不顯示日期），其他都不變', () => {
  const old = newSave();
  reach(old, 'yuan', 3);
  old.letters.push({ id: 'first', t: 0, day: 3 });
  old.version = 11;
  delete old.profiles;
  const before = JSON.parse(JSON.stringify(old));
  const s = migrate(JSON.parse(JSON.stringify(old)), T0);
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(texts(s, 'yuan'), [1, 3]);
  assert.ok(PR.profilePage(s, 'yuan').segs.every((x) => x.day === 0));
  assert.deepEqual(texts(s, 'deshu'), [1, 2]);
  for (const k of ['menu', 'tasting', 'favorites', 'photos', 'roast', 'regulars']) assert.deepEqual(s[k], before[k], k);
  assert.equal(temperature(s), temperature(before));
});

test('文字：不計數、不催促、不像任務', () => {
  const all = PR.allProfileLines();
  assert.ok(all.length > 30);
  for (const t of all) {
    assert.equal(typeof t, 'string');
    assert.ok(t.length > 0);
    assert.doesNotMatch(t, /KPI|不划算|解鎖|收集|完成度|達成|任務|快點|趕快|還有.段|\d+\/\d+|%/, t);
  }
});
