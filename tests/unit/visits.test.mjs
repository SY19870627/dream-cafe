// 熟客的來訪段落（src/visits.js，文本與關係鋪陳；依 fable 審稿 _agent/fable-relationship-review.md）：
// 窗口（過期跳過、不倒播）、每位熟客一天一段／全店一天兩段、原場景的台詞是擴寫的子序列、第一杯在擴寫之後才開放、
// 離線里程碑的接回與第一杯、點熟客時一天只問一次、存檔 12 → 13（舊存檔不沒收照片）、文字
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as VS from '../../src/visits.js';
import * as S from '../../src/story.js';
import * as FV from '../../src/favorites.js';
import * as MN from '../../src/menu.js';
import * as TS from '../../src/tasting.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';

const T0 = new Date(2026, 10, 7, 9, 0).getTime();
const newSave = () => { const s = defaultSave(T0); giveStarters(s); s.flags.seenOpening = true; return s; };
const reach = (s, who, n, day = 2) => { for (const m of S.MILESTONES.filter((x) => x.who === who && x.n <= n)) S.complete(s, m, day); };
const ids = (who) => VS.SEGMENTS.filter((x) => x.who === who).map((x) => x.id);
// a 是不是 b 的子序列
const isSub = (a, b) => { let i = 0; for (const x of b) if (i < a.length && x === a[i]) i++; return i === a.length; };

test('存檔第 13 版：新存檔有 rel（演過的段落、看過擴寫版的里程碑、今天的份量、今天問過沒）', () => {
  assert.ok(SAVE_VERSION >= 13); // 第 14 版（選項存 id）見 script.test.mjs
  const s = newSave();
  assert.deepEqual(s.rel, { done: [], seen: [], today: { day: 0, slots: [] }, offered: { yuan: 0, zhe: 0, kevin: 0 }, invited: [] });
});

test('段落清單：予安到 yuan3、阿哲到 zhe2、凱文到 kevin3；擴寫各對一個里程碑；接回只給 yuan2、zhe2、kevin3（yuan3 只有補第一杯的短接回）', () => {
  assert.deepEqual(ids('yuan'), ['yuan-v1', 'yuan-v2', 'yuan-v3', 'yuan-r2', 'yuan-v4', 'yuan-v5', 'yuan-v6', 'yuan-r3']);
  assert.deepEqual(ids('zhe'), ['zhe-v1', 'zhe-v2', 'zhe-v3', 'zhe-v4', 'zhe-r2']);
  assert.deepEqual(ids('kevin'), ['kevin-v1', 'kevin-v2', 'kevin-v3', 'kevin-v5', 'kevin-v6', 'kevin-v7', 'kevin-r3']);
  const withs = VS.SEGMENTS.filter((x) => x.kind === 'with').map((x) => x.with);
  assert.deepEqual(withs, ['yuan1', 'yuan2', 'yuan3', 'zhe1', 'zhe2', 'kevin1', 'kevin3']);
  assert.ok(!withs.includes('kevin2'), 'kevin2（被罵）原句照舊，不加句');
  assert.deepEqual(VS.SEGMENTS.filter((x) => x.kind === 'reconnect').map((x) => x.of), ['yuan2', 'yuan3', 'zhe2', 'kevin3']);
  assert.deepEqual(VS.SEGMENTS.filter((x) => x.uninvited).map((x) => x.id), ['yuan-r3'], '只補第一杯的接回只有 yuan3');
  // 第一杯只在 yuan3／zhe2／kevin3 的擴寫、zhe2、kevin3 的接回與 yuan3 補第一杯的接回
  assert.deepEqual(VS.SEGMENTS.filter((x) => VS.inviteOf(x)).map((x) => x.id), ['yuan-v6', 'yuan-r3', 'zhe-v4', 'zhe-r2', 'kevin-v7', 'kevin-r3']);
  for (const w of VS.REL_IDS) {
    const opens = FV.STAGES[w][0].after;
    const inv = VS.SEGMENTS.find((x) => x.who === w && x.kind === 'with' && x.invite);
    assert.equal(inv.with, `${w}${opens}`, `${w} 第一杯和最愛第一段開放的里程碑是同一個`);
  }
});

test('原場景的台詞序列是擴寫版的子序列（每一句、順序不變）；原場景的動作也都在', () => {
  for (const seg of VS.SEGMENTS.filter((x) => x.kind === 'with')) {
    const m = S.milestoneById(seg.with);
    const orig = VS.sayTexts(m.scene), full = VS.sayTexts(seg.steps);
    assert.ok(orig.length > 0, seg.with);
    assert.ok(isSub(orig, full), `${seg.with} 的原句照順序都在 ${seg.id} 裡：${orig.join('／')}`);
    // 說話者也一樣（原場景的 say 整步都在擴寫的最上層）
    const says = m.scene.filter((x) => x.do === 'say').map((x) => JSON.stringify(x));
    assert.ok(isSub(says, seg.steps.map((x) => JSON.stringify(x))), `${seg.with} 的說話者不變`);
    const acts = m.scene.filter((x) => x.do !== 'wait' && x.do !== 'say').map((x) => JSON.stringify(x));
    const top = seg.steps.map((x) => JSON.stringify(x));
    assert.ok(isSub(acts, top), `${seg.with} 的動作（${acts.join('、')}）都在擴寫裡`);
  }
  // 原場景與里程碑資料一字不改（條件、順序、present）
  assert.deepEqual(S.MILESTONES.map((m) => m.id).slice(0, 3), ['yuan1', 'yuan2', 'yuan3']);
  assert.equal(S.milestoneById('yuan3').present, true);
  assert.equal(S.milestoneById('zhe2').present, false);
  assert.equal(S.milestoneById('kevin3').present, false);
});

test('窗口：還沒到不演；里程碑之間照順序；下一個里程碑發生了就跳過（不補演、不倒播）', () => {
  const s = newSave();
  assert.equal(VS.dueVisit(s, 'yuan', 2), null, '還沒見過予安');
  reach(s, 'yuan', 1, 2);
  assert.equal(VS.dueVisit(s, 'yuan', 2), null, '里程碑當天：那一段已經用掉（lastMilestoneDay）');
  assert.equal(VS.dueVisit(s, 'yuan', 3).id, 'yuan-v2');
  assert.ok(s.rel.done.includes('yuan-v1'), 'yuan1 已經發生（這裡沒演到擴寫版）：第 1 次跳過');
  VS.markPlayed(s, VS.segmentById('yuan-v2'), 3);
  assert.equal(VS.dueVisit(s, 'yuan', 4), null, 'yuan2 之前沒有別的段落了');
  // 予安第 4、5 次：yuan2 之後、yuan3 之前；yuan3 先發生就作廢
  reach(s, 'yuan', 2, 5);
  s.rel.seen.push('yuan2'); // 當作老闆坐著看過擴寫版：不演接回
  assert.equal(VS.dueVisit(s, 'yuan', 6).id, 'yuan-v4');
  VS.markPlayed(s, VS.segmentById('yuan-v4'), 6);
  assert.equal(VS.dueVisit(s, 'yuan', 6), null, '一天一段');
  assert.equal(VS.dueVisit(s, 'yuan', 7).id, 'yuan-v5');
  reach(s, 'yuan', 3, 7);
  // yuan3 離線發生（沒演到 yuan-v6、沒問到第一杯）：第 4、5 次都過期，只剩補第一杯的接回
  const r3 = VS.dueVisit(s, 'yuan', 8);
  assert.equal(r3.id, 'yuan-r3', 'yuan3 發生了：第 5 次作廢，下一段是補第一杯的接回');
  assert.ok(s.rel.done.includes('yuan-v4') && s.rel.done.includes('yuan-v5'), '第 4、5 次都過期');
  assert.equal(VS.windowOf(s, VS.segmentById('yuan-v5')), 'closed');
  assert.ok(VS.inviteOf(r3), '接回補問第一杯');
  VS.markPlayed(s, r3, 8);
  assert.equal(VS.dueVisit(s, 'yuan', 9), null, '補問只一次，yuan3 之後沒有別的段落了');
  // 凱文第 6 次「下次我帶點東西給龍眼」不會排在 kevin3 之後（fable 第二節 5）
  const k = newSave();
  reach(k, 'kevin', 2, 8);
  assert.equal(VS.dueVisit(k, 'kevin', 9).id, 'kevin-v5', 'kevin2 之前的第 2、3 次已經過了：跳過');
  assert.ok(k.rel.done.includes('kevin-v2') && k.rel.done.includes('kevin-v3'));
  reach(k, 'kevin', 3, 10);
  const next = VS.dueVisit(k, 'kevin', 11);
  assert.equal(next.id, 'kevin-r3', 'kevin3 之後只剩接回');
  assert.ok(k.rel.done.includes('kevin-v6'), '第 6 次作廢');
});

test('里程碑優先：這位熟客今天還有里程碑要演，就不演來訪段落', () => {
  const s = newSave();
  reach(s, 'zhe', 1, 1);
  assert.equal(VS.dueVisit(s, 'zhe', 2, { milestoneDue: true }), null);
  assert.equal(VS.dueVisit(s, 'zhe', 2).id, 'zhe-v2');
});

test('一天的份量：每位熟客一天最多一段；全店一天最多兩段（在場的里程碑含同日擴寫算一段）；先留給今天還要演的里程碑', () => {
  const s = newSave();
  reach(s, 'yuan', 1, 2); reach(s, 'zhe', 1, 1); reach(s, 'kevin', 1, 3);
  const d = 5;
  VS.noteMilestone(s, 'kevin', d); // 凱文今天演了一個里程碑（含擴寫，只算一段）
  VS.noteMilestone(s, 'kevin', d);
  assert.deepEqual(VS.slotsToday(s, d), ['kevin']);
  assert.equal(VS.dueVisit(s, 'kevin', d), null, '凱文今天用掉了');
  const y = VS.dueVisit(s, 'yuan', d);
  assert.equal(y.id, 'yuan-v2');
  VS.markPlayed(s, y, d);
  assert.deepEqual(VS.slotsToday(s, d), ['kevin', 'yuan']);
  assert.equal(VS.dueVisit(s, 'zhe', d), null, '全店兩段滿了：阿哲今天只有搭話');
  // 隔天重算
  assert.equal(VS.dueVisit(s, 'zhe', d + 1).id, 'zhe-v2');
  // reserved：別的熟客今天還有里程碑要演，先留位子
  const t = newSave();
  reach(t, 'yuan', 1, 2); reach(t, 'zhe', 1, 1);
  VS.noteMilestone(t, 'kevin', 6);
  assert.equal(VS.dueVisit(t, 'zhe', 6, { reserved: 1 }), null, '凱文一段＋留給予安的里程碑一段＝兩段');
  assert.equal(VS.dueVisit(t, 'zhe', 6, { reserved: 0 }).id, 'zhe-v2');
  assert.equal(VS.DAY_CAP, 2);
});

// main.js 的 liveScene() 照這個判斷：S.liveNext() 再看 VS.milestoneRoom()（在場的里程碑也算一天的份量）
const liveScene = (s, w, d) => { const m = S.liveNext(s, w, d); return m && VS.milestoneRoom(s, w, d) ? m : null; };
// 這位熟客今天走進店裡了（S.arrive() 之後的樣子）：來店次數、今天來過、今天結算過
const here = (s, w, d, visits) => { const r = s.regulars[w]; r.visits = visits; r.lastVisit = d; r.settled = d; };

test('在場的里程碑也算份量：全店兩段滿了，第三個里程碑今天不開始演（不記完成、不給獎勵、不跳過），隔天有份量照樣演、擴寫還在', () => {
  const s = newSave();
  reach(s, 'yuan', 1, 2);
  const d = 5;
  here(s, 'yuan', d, 3);
  for (const w of ['zhe', 'kevin']) s.regulars[w].settled = d;
  assert.equal(S.liveNext(s, 'yuan', d).id, 'yuan2', '條件達成（里程碑的條件不動）');
  VS.noteMilestone(s, 'zhe', d); VS.noteMilestone(s, 'kevin', d); // 阿哲、凱文今天各演了一段
  assert.equal(VS.milestoneRoom(s, 'yuan', d), false);
  assert.equal(liveScene(s, 'yuan', d), null, '滿了：今天不演第三段');
  assert.equal(VS.expansionFor(s, 'yuan2', d), null, '只有開發者不看份量直接演時，才會在滿了的時候演原場景');
  assert.equal(VS.expansionFor(s, 'yuan2').id, 'yuan-v3', '不給 day（不看份量）時還是那一段');
  // 不記完成、不給獎勵、不跳過：yuan2 還是下一個、紙巾沒進倉庫、擴寫與接回都沒作廢
  VS.expire(s);
  assert.equal(S.nextMilestone(s, 'yuan').id, 'yuan2');
  assert.ok(!S.hasMilestone(s, 'yuan', 2));
  assert.ok(!s.owned.some((o) => o.item === S.milestoneById('yuan2').gift), '獎勵沒有先給');
  assert.ok(!s.rel.done.includes('yuan-v3') && !s.rel.done.includes('yuan-r2'));
  // 她今天來過了：同一天的結算不會在日誌裡偷偷完成
  assert.deepEqual(S.settleThrough(s, d).filter((e) => e.id === 'yuan2'), []);
  assert.ok(!S.hasMilestone(s, 'yuan', 2));
  // 隔天老闆在店裡：有份量，里程碑照樣演，擴寫還在
  here(s, 'yuan', d + 1, 4);
  assert.equal(liveScene(s, 'yuan', d + 1).id, 'yuan2');
  assert.equal(VS.expansionFor(s, 'yuan2', d + 1).id, 'yuan-v3');
});

test('在場的里程碑（yuan3）份量滿了也等：隔天一定來、有份量就演擴寫與結尾的第一杯；老闆不在的日子照舊只寫「想等老闆在」', () => {
  const s = newSave();
  reach(s, 'yuan', 2, 4);
  const d = 9;
  here(s, 'yuan', d, 6);
  for (const w of ['zhe', 'kevin']) s.regulars[w].settled = d;
  VS.noteMilestone(s, 'zhe', d); VS.noteMilestone(s, 'kevin', d);
  assert.equal(S.liveNext(s, 'yuan', d).id, 'yuan3');
  assert.equal(liveScene(s, 'yuan', d), null);
  assert.notEqual(s.story.lastPresentDay, d, '「在場的里程碑全店一天一個」也沒用掉');
  const off = JSON.parse(JSON.stringify(s));
  // 隔天老闆在店裡：有話想等老闆在的人一定來，有份量就演擴寫，結尾的第一杯還在
  assert.equal(S.planToday(s, d + 1).find((x) => x.who === 'yuan')?.milestone, 'yuan3');
  here(s, 'yuan', d + 1, 7);
  assert.equal(liveScene(s, 'yuan', d + 1).id, 'yuan3');
  const ex = VS.expansionFor(s, 'yuan3', d + 1);
  assert.equal(ex.id, 'yuan-v6');
  assert.ok(VS.inviteOf(ex), '結尾的第一杯沒有因為份量消失');
  // 另一條路：之後老闆都不在，在場的里程碑不在日誌裡發生，只寫一次「想等老闆在」
  const ev = S.settleThrough(off, d + 4).filter((e) => e.id === 'yuan3');
  assert.ok(!S.hasMilestone(off, 'yuan', 3));
  assert.ok(ev.length <= 1 && ev.every((e) => e.kind === 'waiting'));
});

test('可離線的里程碑份量滿了：老闆在的那天不演；之後老闆不在的日子照舊在營業日誌發生（一字不改），之後的接回一樣問第一杯', () => {
  const s = newSave();
  reach(s, 'kevin', 2, 8);
  const d = 10;
  here(s, 'kevin', d, 7);
  for (const w of ['yuan', 'zhe']) s.regulars[w].settled = d;
  VS.noteMilestone(s, 'yuan', d); VS.noteMilestone(s, 'zhe', d);
  assert.equal(S.liveNext(s, 'kevin', d).id, 'kevin3');
  assert.equal(liveScene(s, 'kevin', d), null);
  const k3 = S.settleThrough(s, d + 3).filter((e) => e.id === 'kevin3');
  assert.ok(k3.length && k3.every((e) => e.kind === 'milestone' && e.day > d), '老闆不在的日子照舊寫進日誌（不是老闆在的那天）');
  assert.deepEqual(k3.map((e) => e.line), S.milestoneById('kevin3').journal, '日誌一字不改');
  const r = VS.dueVisit(s, 'kevin', d + 4);
  assert.equal(r.id, 'kevin-r3', '之後見到他：接回');
  assert.ok(VS.inviteOf(r));
});

test('這位熟客今天已經演過一段來訪：當天的里程碑也不開始演，隔天有份量再和擴寫一起演；只有別的熟客一段時剛好兩段', () => {
  const t = newSave();
  reach(t, 'zhe', 1, 1);
  VS.markPlayed(t, VS.dueVisit(t, 'zhe', 3), 3);
  here(t, 'zhe', 3, 4);
  assert.equal(S.liveNext(t, 'zhe', 3).id, 'zhe2');
  assert.equal(liveScene(t, 'zhe', 3), null, '阿哲今天已經一段');
  assert.equal(VS.expansionFor(t, 'zhe2', 3), null);
  here(t, 'zhe', 4, 5);
  assert.equal(liveScene(t, 'zhe', 4).id, 'zhe2');
  assert.equal(VS.expansionFor(t, 'zhe2', 4).id, 'zhe-v4', '隔天有位子：擴寫和第一杯一起演');
  // 只有一段（別的熟客）時還可以演：剛好兩段
  const u = newSave();
  reach(u, 'kevin', 2, 3);
  VS.noteMilestone(u, 'yuan', 6);
  assert.equal(VS.expansionFor(u, 'kevin3', 6).id, 'kevin-v7');
  VS.markPlayed(u, VS.expansionFor(u, 'kevin3', 6), 6);
  assert.deepEqual(VS.slotsToday(u, 6), ['yuan', 'kevin']);
});

test('擴寫末尾的第一杯：同一天里程碑與擴寫都記進份量之後，邀請不受份量擋（只看一天一杯）', () => {
  const s = newSave();
  reach(s, 'yuan', 2, 4);
  MN.write(s, 'black', 4);
  const d = 9;
  VS.noteMilestone(s, 'zhe', d);
  const ex = VS.expansionFor(s, 'yuan3', d);
  assert.equal(ex.id, 'yuan-v6');
  // runScene() 的順序：complete → noteMilestone → markPlayed → expire → runInvite
  S.complete(s, S.milestoneById('yuan3'), d);
  VS.noteMilestone(s, 'yuan', d); VS.markPlayed(s, ex, d); VS.expire(s);
  assert.equal(VS.roomToday(s, 'zhe', d), false, '份量滿了');
  assert.equal(VS.inviteReady(s, 'yuan', d), true, '邀請照樣問');
  assert.ok(FV.serve(s, 'yuan', VS.inviteDrink(s, VS.inviteOf(ex)), d, 0, false).right);
});

test('yuan3 演過、結尾的第一杯沒問到：之後第一次見到她時補問（yuan-r3：沿用 yuan-v6 結尾，不另寫句子、不重演 yuan3）', () => {
  // 照常：擴寫演完、問到了（runInvite() 選了選項）→ 不補
  const s = newSave();
  reach(s, 'yuan', 2, 4);
  const d = 9;
  const ex = VS.expansionFor(s, 'yuan3', d);
  S.complete(s, S.milestoneById('yuan3'), d);
  VS.noteMilestone(s, 'yuan', d); VS.markPlayed(s, ex, d); VS.expire(s);
  assert.ok(!s.rel.done.includes('yuan-r3'), 'runInvite() 之前的 expire() 不會先把補問作廢');
  VS.markInvited(s, 'yuan'); VS.expire(s);
  assert.ok(VS.invited(s, 'yuan') && s.rel.done.includes('yuan-r3'));
  assert.equal(VS.dueVisit(s, 'yuan', d + 1), null);
  // 中斷：yuan3 已經記進存檔，選項出來前重新整理（沒問到）
  const o = newSave();
  reach(o, 'yuan', 2, 4);
  S.complete(o, S.milestoneById('yuan3'), d);
  VS.noteMilestone(o, 'yuan', d); VS.markPlayed(o, VS.segmentById('yuan-v6'), d); VS.expire(o);
  assert.equal(VS.dueVisit(o, 'yuan', d), null, '當天不補（她今天的一段已經用掉）');
  const r = VS.dueVisit(o, 'yuan', d + 1);
  assert.equal(r.id, 'yuan-r3');
  assert.equal(VS.inviteOf(r), VS.inviteOf(VS.segmentById('yuan-v6')), '同一組選項與分支（fable 審過）');
  assert.deepEqual(VS.sayTexts(r.steps), [], '沒有新句、不重演 yuan3 的台詞');
  assert.equal(VS.inviteReady(o, 'yuan', d + 1), true);
  VS.markPlayed(o, r, d + 1);
  assert.equal(VS.dueVisit(o, 'yuan', d + 2), null, '只補一次');
  // 第一段已經找到（點她請過了）、或 yuan4 先發生：不補
  const f = newSave();
  reach(f, 'yuan', 3, 9);
  MN.write(f, 'black', 9);
  assert.ok(FV.serve(f, 'yuan', 'black', 9, 0, false).right);
  assert.equal(VS.dueVisit(f, 'yuan', 10), null);
  assert.ok(f.rel.done.includes('yuan-r3'));
  const g = newSave();
  reach(g, 'yuan', 4, 9);
  assert.equal(VS.dueVisit(g, 'yuan', 10), null);
  assert.ok(g.rel.done.includes('yuan-r3'));
  // 第 13 版剛加上 rel 時沒有 invited：讀的時候補上
  const h = newSave();
  delete h.rel.invited;
  assert.equal(VS.invited(h, 'yuan'), false);
  assert.deepEqual(h.rel.invited, []);
});

test('老存檔（12 → 13）：舊里程碑的擴寫與接回不重播；第一段開放了就可以照平常點熟客請（一天一次）', () => {
  const old = newSave();
  reach(old, 'zhe', 2, 4); reach(old, 'yuan', 3, 4);
  old.version = 12;
  delete old.rel;
  const s = migrate(JSON.parse(JSON.stringify(old)), T0);
  for (const id of ['zhe-v4', 'zhe-r2', 'yuan-v3', 'yuan-r2', 'yuan-v6', 'yuan-r3']) assert.ok(s.rel.done.includes(id), `${id} 不重播`);
  assert.equal(VS.expansionFor(s, 'yuan3', 6), null);
  assert.equal(VS.dueVisit(s, 'zhe', 6), null);
  assert.equal(VS.dueVisit(s, 'yuan', 6), null);
  for (const w of ['zhe', 'yuan']) {
    assert.equal(VS.offerable(s, w, 6), true, `${w} 今天可以問`);
    assert.equal(FV.canServe(s, w, 6), true, `${w} 第一段開放`);
  }
});

test('里程碑當天的擴寫：演過就記成老闆看過（不演接回）；離線發生就不演擴寫、之後演接回', () => {
  const s = newSave();
  assert.equal(VS.expansionFor(s, 'yuan2').id, 'yuan-v3');
  reach(s, 'yuan', 1, 2);
  VS.markPlayed(s, VS.expansionFor(s, 'yuan1'), 2);
  assert.ok(s.rel.seen.includes('yuan1'));
  VS.markPlayed(s, VS.segmentById('yuan-v2'), 3);
  // yuan2 在擴寫版演完（坐著）
  S.complete(s, S.milestoneById('yuan2'), 4);
  VS.markPlayed(s, VS.segmentById('yuan-v3'), 4);
  assert.equal(VS.expansionFor(s, 'yuan2'), null);
  assert.equal(VS.dueVisit(s, 'yuan', 5).id, 'yuan-v4', '看過擴寫版：沒有接回，直接第 4 次');
  assert.ok(s.rel.done.includes('yuan-r2'));
  // 另一個存檔：yuan2 在老闆不在的日子發生（營業日誌）
  const o = newSave();
  reach(o, 'yuan', 1, 2);
  VS.markPlayed(o, VS.segmentById('yuan-v2'), 3);
  o.regulars.yuan.visits = 2; o.regulars.yuan.lastVisit = 3; o.regulars.yuan.settled = 3;
  for (const w of ['zhe', 'kevin']) o.regulars[w].settled = 3;
  const ev = S.settleThrough(o, 6);
  assert.ok(ev.some((e) => e.id === 'yuan2'), '離線時照舊寫進日誌');
  assert.equal(VS.dueVisit(o, 'yuan', 7).id, 'yuan-r2', '之後第一次見到她：接回（取代第 3 次）');
  assert.ok(o.rel.done.includes('yuan-v3'), '擴寫版作廢（不倒播）');
  VS.markPlayed(o, VS.segmentById('yuan-r2'), 7);
  assert.equal(VS.dueVisit(o, 'yuan', 8).id, 'yuan-v4');
});

test('第一杯：最愛第一段在擴寫的里程碑記進存檔之後才開放，結尾自然問一次；舊存檔已經找過第一段就不問', () => {
  const s = newSave();
  reach(s, 'yuan', 2, 4);
  MN.write(s, 'black', 4); // 黑咖啡是 yuan1 解鎖、不會自己寫上黑板（老闆寫上去的）
  assert.equal(VS.inviteReady(s, 'yuan', 9), false, 'yuan3 之前不能請');
  S.complete(s, S.milestoneById('yuan3'), 9); // runScene()：演完擴寫才 complete，再問
  assert.equal(VS.inviteReady(s, 'yuan', 9), true);
  const inv = VS.inviteOf(VS.segmentById('yuan-v6'));
  assert.deepEqual(inv.options.map((o) => o.id), ['treat', 'later'], '選項有穩定 id，treat＝我請（存檔第 14 版）');
  assert.equal(VS.inviteDrink(s, inv), 'black', '黑板上有黑咖啡：直接端');
  const r = FV.serve(s, 'yuan', VS.inviteDrink(s, inv), 9, 0, false);
  assert.ok(r.right && r.photo === 'yuan-1', '端對：第一張照片');
  assert.equal(VS.inviteReady(s, 'yuan', 10), false, '第一段找到了：之後的接回不再問');
  // 黑板上沒有那一杯：德叔說黑板上沒有（missing），接著老闆選杯
  const b = newSave();
  reach(b, 'kevin', 3, 9);
  MN.erase(b, 'iced');
  assert.equal(VS.inviteDrink(b, VS.inviteOf(VS.segmentById('kevin-v7'))), null);
  assert.ok(VS.inviteOf(VS.segmentById('kevin-v7')).missing.length);
  // 阿哲：喝的不限，黑板上要有龍眼乾
  const z = newSave();
  reach(z, 'zhe', 2, 4);
  const zi = VS.inviteOf(VS.segmentById('zhe-v4'));
  assert.equal(VS.inviteDrink(z, zi), 'dongshan');
  assert.ok(FV.isRight(z, 'zhe', 'dongshan'), '龍眼乾在黑板上：端對');
  MN.erase(z, 'longan');
  assert.equal(VS.inviteDrink(z, zi), null, '老闆擦掉了龍眼乾：問要端哪一杯');
  // 今天已經收過一杯（一天一杯）就不問
  const t = newSave();
  reach(t, 'kevin', 3, 9);
  FV.serve(t, 'kevin', 'dongshan', 9);
  assert.equal(VS.inviteReady(t, 'kevin', 9), false);
});

test('離線里程碑接回首杯：zhe2、kevin3 在老闆不在時發生，之後的接回結尾一樣自然邀請；窗口過了就跳過', () => {
  const s = newSave();
  reach(s, 'zhe', 2, 4); // 離線（沒有擴寫版）
  const r = VS.dueVisit(s, 'zhe', 6);
  assert.equal(r.id, 'zhe-r2');
  assert.equal(VS.inviteOf(r), VS.inviteOf(VS.segmentById('zhe-v4')), '同一組選項與分支');
  assert.equal(VS.inviteReady(s, 'zhe', 6), true);
  VS.markPlayed(s, r, 6);
  assert.ok(s.rel.seen.includes('zhe2'));
  assert.equal(VS.dueVisit(s, 'zhe', 7), null);
  // 窗口：zhe3（颱風夜）先發生，接回作廢
  const t = newSave();
  reach(t, 'zhe', 3, 8);
  assert.equal(VS.dueVisit(t, 'zhe', 9), null);
  assert.ok(t.rel.done.includes('zhe-r2'));
  // 凱文：kevin3 離線、kevin4 之前接回
  const k = newSave();
  reach(k, 'kevin', 3, 9);
  VS.expire(k);
  assert.equal(VS.dueVisit(k, 'kevin', 10).id, 'kevin-r3');
  reach(k, 'kevin', 4, 11);
  assert.equal(VS.dueVisit(k, 'kevin', 12), null);
});

test('點熟客時「請德叔端一杯」：每位熟客一天只問一次；換一天重來；開發者重設', () => {
  const s = newSave();
  assert.equal(VS.offerable(s, 'yuan', 9), true);
  VS.markOffered(s, 'yuan', 9);
  assert.equal(VS.offerable(s, 'yuan', 9), false);
  assert.equal(VS.offerable(s, 'zhe', 9), true, '別的熟客不受影響');
  assert.equal(VS.offerable(s, 'yuan', 10), true);
  VS.resetOffered(s, 'yuan');
  assert.equal(VS.offerable(s, 'yuan', 9), true);
});

test('予安的名字：說出名字以前泡泡是「窗邊的小姐」；第 2 次選了點頭，名字留到下次點她；窗口過了也照舊', () => {
  const s = newSave();
  reach(s, 'yuan', 1, 2);
  assert.equal(VS.yuanStranger(s), true);
  assert.equal(VS.yuanIntroReady(s), false, '第 2 次之前點她只說 TALK');
  s.rel.done.push('yuan-v2'); // 選了「（點點頭）」：metYuan 還是 false
  assert.equal(VS.yuanIntroReady(s), true);
  s.flags.metYuan = true;
  assert.equal(VS.yuanStranger(s), false);
  const t = newSave();
  reach(t, 'yuan', 2, 4);
  assert.equal(VS.yuanStranger(t), false, 'yuan2 以後日誌已經叫她予安小姐');
  assert.equal(VS.yuanIntroReady(t), true);
  // 第 2 次選「你好，慢慢坐」：原句「我叫予安」說出來並記 metYuan（舊存檔已經聽過就跳過）
  const v2 = JSON.stringify(VS.segmentById('yuan-v2').steps);
  assert.match(v2, /我叫予安，常坐在這裡寫稿/);
  assert.match(v2, /"flag":"metYuan"/);
  assert.equal(VS.condOk({ flags: {} }, '!met'), true);
  assert.equal(VS.condOk({ flags: { metYuan: true } }, '!met'), false);
});

test('只在特定狀態下演：龍眼在窗台的句子、第一天門口那位小姐演過沒；第二杯在段落裡演過，前三天的小段落不再演', () => {
  const sill = VS.SEGMENTS.flatMap((x) => x.steps.filter((st) => st.do === 'when' && st.if === 'catSill').map(() => x.id));
  assert.deepEqual(sill, ['yuan-v1', 'yuan-v4', 'kevin-v3', 'kevin-v6']);
  assert.equal(VS.condOk({}, 'catSill', { catSill: true }), true);
  assert.equal(VS.condOk({}, 'catSill', {}), false);
  assert.equal(VS.condOk({ moments: { early: ['d1-peek'] } }, 'peeked'), true);
  assert.equal(VS.condOk({ moments: { early: [] } }, '!peeked'), true);
  assert.match(JSON.stringify(VS.segmentById('yuan-v2').steps), /"early":"d2-refill"/);
});

test('存檔 12 → 13：舊存檔已經發生的里程碑不補演擴寫與接回；照片、最愛的段落、metYuan 都不動（不沒收照片）', () => {
  const old = newSave();
  reach(old, 'yuan', 2, 4); reach(old, 'zhe', 2, 4); reach(old, 'kevin', 1, 3);
  old.favorites.yuan = { stage: 1, misses: 0, servedDay: 3, told: 1 }; // 舊規則（第一次見面就開放）找到的第一段
  old.favorites.zhe = { stage: 0, misses: 1, servedDay: 3, told: 1 };
  old.photos.push({ id: 'yuan-1', day: 3, t: 0, item: 'black', snack: false });
  old.flags.metYuan = true;
  old.version = 12;
  delete old.rel;
  const s = migrate(JSON.parse(JSON.stringify(old)), T0);
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(s.photos.map((p) => p.id), ['yuan-1'], '照片不收回');
  assert.equal(s.favorites.yuan.stage, 1, '找到的段落不收回');
  assert.equal(FV.current(s, 'yuan').n, 2);
  assert.equal(s.favorites.zhe.stage, 0);
  assert.equal(FV.isOpen(s, 'zhe'), true, 'zhe2 已經發生：第一段照新規則開放');
  assert.equal(s.flags.metYuan, true);
  for (const id of ['yuan-v1', 'yuan-v2', 'yuan-v3', 'yuan-r2', 'zhe-v1', 'zhe-v2', 'zhe-v3', 'zhe-v4', 'zhe-r2', 'kevin-v1']) assert.ok(s.rel.done.includes(id), `${id} 不補演`);
  assert.equal(VS.dueVisit(s, 'yuan', 6).id, 'yuan-v4', '之後的段落照常');
  assert.equal(VS.dueVisit(s, 'kevin', 6).id, 'kevin-v2');
  assert.equal(VS.dueVisit(s, 'zhe', 6), null, '阿哲 zhe2 之後沒有新段落（舊的事不倒播）');
});

// 文字的檢查只看規則（不該出現的字、秘密、原句在不在），不逐字比對【待定】的句子：承峰 11/7 全部退件，之後由 fable 整段重寫（D224）
test('文字：沒有不該出現的字；不洩秘密；【原句】都在；進校稿清單', () => {
  const all = VS.allVisitLines();
  for (const t of all) {
    assert.ok(t && t.trim());
    assert.doesNotMatch(t, /KPI|不划算|快點|趕快|獲得|解鎖|任務|\.\.\./);
  }
  const joined = all.join('\n');
  // 不洩秘密：老先生、學徒、店長都沒提
  assert.doesNotMatch(joined, /老先生|學徒|店長|師父/);
  // 標了原句的、原場景搬進擴寫的句子都還在
  for (const t of ['窗邊那位小姐，從開門就坐在那裡。', '我阿公以前也在這條路上烤龍眼。', '窗外那片山，今天的顏色很好看。', '這裡的網路比台北的辦公室穩。',
    '……啊，你好。我叫予安，常坐在這裡寫稿。']) assert.ok(joined.includes(t), `原句：${t}`);
  // 進 story.js 的 allLines()（校稿、測試）
  const story = S.allLines();
  for (const t of all) assert.ok(story.includes(t), `allLines 少了：${t}`);
});

test('結構：yuan-v4 先轉到窗外停一拍，老闆才開口；第一杯的 missing 每組兩步；煙的轉述不搶照片那一句', () => {
  const v4 = VS.segmentById('yuan-v4').steps;
  const pi = v4.findIndex((x) => x.do === 'say' && x.who === 'player');
  assert.ok(pi > 1, '老闆在 yuan-v4 有開口');
  assert.deepEqual(v4[pi - 2], { do: 'look', who: 'window' });
  assert.deepEqual(v4[pi - 1], { do: 'wait', sec: 4 });
  for (const id of ['yuan-v6', 'yuan-r3', 'zhe-v4', 'zhe-r2', 'kevin-v7', 'kevin-r3']) {
    const inv = VS.inviteOf(VS.segmentById(id));
    assert.ok(inv.missing.length >= 1 && inv.yes.length >= 1 && inv.no.length >= 1, `${id} 的第一杯有 yes／no／missing`);
  }
  // 議題 A：「煙是甜的」第一次由她本人在照片 yuan-3 說，德叔的兩句轉述不搶（只看玩家看得到的字）
  assert.equal(FV.STAGES.yuan[2].said, '煙是甜的。');
  const shown = [JSON.stringify(MN.ITEMS), JSON.stringify(TS.RECIPES), ...MN.allMenuLines(), ...TS.allTastingLines()].join('\n');
  assert.ok(!/煙是甜的/.test(shown), '轉述不說「煙是甜的」');
});

test('結構：接回共用第一杯；「我是說」只在凱文身上；每一段熟客自己都有話', () => {
  const seg = (id) => VS.segmentById(id);
  const inv = (id) => VS.inviteOf(seg(id));
  // 每一句說出口的話和說話的人（branch 的每個分支、when 的步驟、結尾第一杯的 yes／no／missing 都算）
  const says = (s) => {
    const out = [];
    const walk = (list) => { for (const x of list || []) { if (x.do === 'say') out.push(x); if (x.steps) walk(x.steps); if (x.cases) Object.values(x.cases).forEach(walk); } };
    walk(s.steps);
    if (s.invite && typeof s.invite === 'object') { walk(s.invite.yes); walk(s.invite.no); walk(s.invite.missing); }
    return out;
  };
  const allSays = VS.SEGMENTS.flatMap(says);
  // 共用：接回的第一杯和擴寫的是同一組
  assert.equal(inv('yuan-r3'), inv('yuan-v6'), 'yuan-r3 共用同一組');
  assert.equal(inv('zhe-r2'), inv('zhe-v4'));
  assert.equal(inv('kevin-r3'), inv('kevin-v7'));
  // 「我是說」是凱文的口頭禪：段落裡說這句的都是凱文
  assert.ok(allSays.filter((x) => x.text.includes('我是說')).every((x) => x.who === 'kevin'));
  // zhe-v3 停在阿哲身上（最後一步是他的分支）
  const z3 = seg('zhe-v3').steps;
  assert.equal(z3.at(-1).do, 'branch');
  // 龍眼翻身只在窗台上演（不離開窗台）
  const y4sill = seg('yuan-v4').steps.find((x) => x.do === 'when' && x.if === 'catSill');
  assert.equal(y4sill.steps[0].do, 'catMove');
  // 減密度不減關係：每一段（只補第一杯的 yuan-r3 除外）熟客自己都還有話
  for (const s of VS.SEGMENTS) if (!s.uninvited) assert.ok(says(s).some((x) => x.who === s.who), `${s.id} 熟客還有話`);
});

test('選項：括號開頭的是動作（不出老闆的泡泡）；每個 choice 都有對應的 branch 或只有一個選項', () => {
  for (const seg of VS.SEGMENTS) {
    const steps = seg.steps;
    for (const [i, st] of steps.entries()) {
      if (st.do !== 'choice') continue;
      assert.ok(st.speak, `${seg.id} ${st.key}`);
      const ids = st.options.map((o) => o.id);
      assert.equal(new Set(ids).size, ids.length, `${seg.id} ${st.key} 選項 id 不重複`);
      if (st.options.length > 1) assert.ok(steps.slice(i + 1).some((x) => x.do === 'branch' && x.key === st.key && JSON.stringify(Object.keys(x.cases)) === JSON.stringify(ids)), `${seg.id} ${st.key} 每個選項 id 都有分支`);
      for (const o of st.options) assert.ok(o.text.length <= 16, `${o.text} 放得進選項按鈕`);
    }
  }
  assert.equal(VS.SEAT_HINT, '先坐。', '站著時德叔提一次：開場原句');
});

test('等來訪段落的倒數提示：「等待新的故事發生（N 秒）」，N 無條件進位、最少 1 秒（承峰 11/8）', async () => {
  const { SCRIPT } = await import('../../src/script.js');
  assert.equal(SCRIPT.lines.visitWait, '等待新的故事發生');
  assert.equal(VS.VISIT_WAIT, '等待新的故事發生');
  assert.equal(VS.VISIT_QUIET_MS, 8000);
  assert.equal(VS.visitWaitHint(false, 8000), null, '沒有待演的段落：照舊的提示');
  assert.equal(VS.visitWaitHint(true, 8000), '等待新的故事發生（8 秒）');
  assert.equal(VS.visitWaitHint(true, 8001), '等待新的故事發生（9 秒）');
  assert.equal(VS.visitWaitHint(true, 1), '等待新的故事發生（1 秒）');
  assert.equal(VS.visitWaitHint(true, 0), '等待新的故事發生（1 秒）');
  assert.equal(VS.visitWaitHint(true, -500), '等待新的故事發生（1 秒）', '時間到了還在等：1 秒');
});
