// 熟客故事線（src/story.js）的單元測試：里程碑判定、離線結算、在場、溫度門檻不卡住
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../src/story.js';
import { defaultSave, giveStarters, migrate } from '../../src/save.js';
import { completeTasks, temperature, TASKS, isDone } from '../../src/tasks.js';
import { writeJournal } from '../../src/journal.js';
import { itemById, CATALOG } from '../../src/catalog.js';

const DAY = 864e5;
const T0 = new Date(2026, 10, 1, 21, 30).getTime();

function newSave() {
  const s = defaultSave(T0);
  giveStarters(s);
  s.flags.seenOpening = true;
  return s;
}
// 第一天老闆做完的事：喝第一杯、擺一件、坐遍三個座位（之後不再佈置，讓溫度門檻只靠保底）
function firstDay(s) {
  s.stats.cups = 1;
  s.owned[0].placed = true;
  s.seatsSat = ['window', 'bar', 'sofa'];
}

// 老闆每天都來店裡：模擬 main.js 的 startDay → 熟客走進來 → 演出可以演的里程碑
function liveDay(s, day, { seated = true } = {}) {
  S.settleThrough(s, day - 1);
  const played = [];
  for (const p of S.planToday(s, day)) S.arrive(s, p.who, day);
  for (let k = 0; k < 6; k++) {
    for (const who of S.REGULAR_IDS) {
      const m = S.liveNext(s, who, day);
      if (!m || (m.needSeat && !seated)) continue;
      S.complete(s, m, day);
      played.push(m.id);
    }
    completeTasks(s, { daysOpen: day }, T0 + (day - 1) * DAY);
  }
  return played;
}
const count = (s) => S.REGULAR_IDS.reduce((n, w) => n + s.regulars[w].milestones.length, 0);

test('里程碑表：三位熟客各 6 個、編號連續；對應的溫度任務都存在', () => {
  for (const w of S.REGULAR_IDS) {
    assert.deepEqual(S.MILESTONES.filter((m) => m.who === w).map((m) => m.n), [1, 2, 3, 4, 5, 6]);
  }
  const taskIds = new Set(TASKS.map((t) => t.id));
  for (const m of S.MILESTONES) {
    if (m.task) assert.ok(taskIds.has(m.task), m.id);
    if (m.present) assert.ok(m.waiting && !m.journal, `${m.id}：在場里程碑只有提示句`);
    else assert.ok(m.journal?.length && !m.waiting, `${m.id}：可離線的里程碑有日誌`);
    assert.ok(m.scene.length > 0, m.id);
  }
  // 劇本標「在場」的：予安 3～6、阿哲 3 與 5、凱文 2、4、6
  assert.deepEqual(S.MILESTONES.filter((m) => m.present).map((m) => m.id),
    ['yuan3', 'yuan4', 'yuan5', 'yuan6', 'zhe3', 'zhe5', 'kevin2', 'kevin4', 'kevin6']);
});

test('劇本的關鍵台詞都在', () => {
  const all = S.allLines().join('\n');
  for (const line of ['她把同一句話刪了三次。', '奇怪，寫在紙巾上反而寫得出來。', '窯熄了以後，阿公就很少說話了。我想把那個煙寫回來。',
    '我是不是該回台北上班了。', '喝完再想。', '那三天，是他一年裡最清醒的時候。', '給一間讓人敢慢下來的店。',
    '我阿公說新店開張要送東西。我是被逼來的。', '你阿公曬的豆，我年輕時喝過。', '蛤？', '阿公種了四十年的樹，一個晚上就……',
    '這是阮的豆仔。', '兩種都好。你阿公的是以前，你的是以後。', '你確定要寫我的名字？……好啦，寫大一點。',
    '……謝謝。我是說貓。', '我在台北租的地方不能養。這裡可以嗎？', '你當初怎麼敢辭職的？', '你真的這樣寫？',
    '今天不用開會。以後都不用了。', '我會寫程式，會開會，會被罵。就是不會生活。', '凱文先生今天好像有話想說，但想等老闆在。']) {
    assert.ok(all.includes(line), line);
  }
  assert.ok(!/不划算|KPI|業績|打卡/.test(all), '沒有上班或「不划算」的字眼');
});

test('第一次來：阿哲第 1 天、予安第 2 天、凱文第 3 天；之前不會來', () => {
  const s = newSave();
  assert.deepEqual(S.planToday(s, 1).map((p) => p.who), ['zhe']);
  S.arrive(s, 'zhe', 1);
  assert.equal(S.liveNext(s, 'zhe', 1).id, 'zhe1');
  S.complete(s, S.milestoneById('zhe1'), 1);
  assert.deepEqual(s.menu, ['dongshan', 'longan'], '解鎖食材：窯烤龍眼乾');
  assert.equal(S.liveNext(s, 'zhe', 1), null, '一天一個里程碑');
  assert.ok(S.planToday(s, 2).some((p) => p.who === 'yuan'));
  assert.ok(!S.planToday(s, 2).some((p) => p.who === 'kevin'));
  assert.ok(S.planToday(s, 3).some((p) => p.who === 'kevin'));
  assert.equal(S.arrive(s, 'zhe', 1), false, '同一天只記一次來店');
});

test('老闆不在：可離線的里程碑寫進日誌，「在場」里程碑只寫一次提示、不會發生', () => {
  const s = newSave();
  firstDay(s);
  completeTasks(s, { daysOpen: 1 }, T0);
  const ev = S.settleThrough(s, 30);
  const ms = ev.filter((e) => e.kind === 'milestone').map((e) => e.id);
  for (const m of S.MILESTONES.filter((x) => x.present)) assert.ok(!ms.includes(m.id), `${m.id} 不會離線發生`);
  assert.ok(ms.includes('zhe1') && ms.includes('yuan1') && ms.includes('yuan2') && ms.includes('kevin1') && ms.includes('zhe2'));
  const hints = ev.filter((e) => e.kind === 'waiting').map((e) => e.id);
  assert.equal(new Set(hints).size, hints.length, '提示句每個里程碑只寫一次');
  assert.ok(hints.includes('yuan3') && hints.includes('kevin2') && hints.includes('zhe3'));
  // 前一個在場里程碑沒發生，後面的也不會發生（予安停在 2、凱文停在 1、阿哲停在 2）
  assert.deepEqual(s.regulars.yuan.milestones, [1, 2]);
  assert.deepEqual(s.regulars.kevin.milestones, [1]);
  assert.deepEqual(s.regulars.zhe.milestones, [1, 2]);
  assert.ok(s.owned.some((o) => o.item === 'napkin' && !o.placed), '寫滿字的紙巾收進倉庫');
  // 每位熟客一天最多一個里程碑
  const perDay = new Map();
  for (const e of ev.filter((x) => x.kind === 'milestone')) {
    const k = `${e.day}:${S.milestoneById(e.id).who}`;
    perDay.set(k, (perDay.get(k) || new Set()).add(e.id));
  }
  assert.ok([...perDay.values()].every((ids) => ids.size === 1));
  // 回到店裡：等著的人今天一定來，演出在場里程碑
  const played = liveDay(s, 31);
  assert.equal(played.filter((id) => S.milestoneById(id).present).length, 1, '「在場」里程碑一天一個');
});

test('老闆每天都來：快轉天數走完三條線，每個里程碑都發生一次、不重複，溫度門檻不會卡住', () => {
  const s = newSave();
  firstDay(s);
  const seen = [];
  let lastDay = 0;
  for (let day = 1; day <= 30 && count(s) < 18; day++) {
    const played = liveDay(s, day);
    assert.ok(played.filter((id) => S.milestoneById(id).present).length <= 1, `第 ${day} 天最多一個在場里程碑`);
    seen.push(...played);
    lastDay = day;
  }
  assert.equal(count(s), 18, `三條線都走完（到第 ${lastDay} 天）`);
  assert.equal(new Set(seen).size, 18, '每個里程碑只發生一次');
  assert.ok(lastDay <= 24, `大約三週走完（第 ${lastDay} 天）`);
  for (const w of S.REGULAR_IDS) {
    const on = s.regulars[w].on;
    for (let n = 2; n <= 6; n++) assert.ok(on[n] >= on[n - 1], `${w} 的里程碑照順序`);
  }
  // 劇本的觸發條件
  const on = (w, n) => s.regulars[w].on[n];
  assert.equal(on('zhe', 1), 1); assert.equal(on('yuan', 1), 2); assert.equal(on('kevin', 1), 3);
  assert.ok(on('yuan', 4) >= S.WEEK2 && on('zhe', 3) >= S.WEEK2 && on('kevin', 4) >= S.WEEK2, '退稿、颱風夜、凱文的問題在第 2 週');
  assert.ok(on('yuan', 6) >= S.WEEK3 && on('kevin', 6) >= S.WEEK3, '予安出書、凱文想留下在第 3 週');
  assert.ok(on('zhe', 4) >= on('zhe', 3) + 3, '颱風後 3 天，阿哲和阿公一起來');
  assert.equal(s.story.typhoonDay, on('zhe', 3));
  // 熟客的溫度任務全部完成；寫滿字的紙巾、予安的書收進倉庫；阿哲的豆上架
  for (const id of ['zhe-longan', 'yuan-pen', 'kevin-scolded', 'yuan-kiln', 'typhoon', 'kevin-no-laptop', 'zhe-grandpa', 'yuan-reading', 'zhe-beans', 'yuan-book']) {
    assert.ok(isDone(s, id), id);
  }
  assert.ok(s.owned.some((o) => o.item === 'napkin') && s.owned.some((o) => o.item === 'yuan-book'));
  assert.deepEqual(s.menu, ['dongshan', 'longan', 'zhe-beans']);
  assert.ok(temperature(s) >= 30, `溫度 ${temperature(s)}°C`);
});

test('溫度門檻：溫度夠了就發生，不夠時到保底那天也會發生', () => {
  const s = newSave();
  s.regulars.yuan.milestones = [1, 2, 3, 4];
  s.regulars.yuan.on = { 1: 2, 2: 4, 3: 7, 4: 8 };
  const m = S.milestoneById('yuan5');
  assert.equal(S.isDue(s, m, 10), false, '20°C、第 10 天：還沒');
  assert.equal(S.isDue(s, m, S.FALLBACK_DAY.yuan5), true, '保底那天');
  // 溫度夠了：塞幾個完成的任務
  for (const id of ['first-coffee', 'first-decor', 'all-seats', 'open-3-days', 'zhe-longan', 'yuan-pen', 'ten-decor', 'kevin-scolded', 'open-7-days', 'yuan-kiln', 'typhoon', 'book-wall', 'zhe-grandpa']) s.tasks.push({ id, t: T0, day: 9 });
  assert.ok(temperature(s) >= 30);
  assert.equal(S.isDue(s, m, 10), true, '溫度 ≥ 30°C 就發生');
});

test('凱文下午五點才來；里程碑 4 的回答與「單方面辭退」', () => {
  assert.equal(S.kevinWaitMs(new Date(2026, 10, 3, 16, 0)), 3600e3);
  assert.equal(S.kevinWaitMs(new Date(2026, 10, 3, 18, 30)), 0);
  const k4 = S.milestoneById('kevin4');
  const choice = k4.scene.find((x) => x.do === 'choice');
  const branch = k4.scene.find((x) => x.do === 'branch');
  assert.equal(choice.options.length, 3, '三選一');
  assert.equal(branch.cases.length, 3);
  assert.ok(k4.scene.find((x) => x.do === 'ifFire').steps.some((x) => x.text === '你真的這樣寫？'));
  assert.ok(k4.needSeat, '要老闆坐著，他才坐到對面');
});

test('營業日誌接上里程碑：熟客見過了才寫他的句子；颱風隔天多一句', () => {
  const s = newSave();
  firstDay(s);
  const page = writeJournal(s, T0, T0 + 5 * DAY, {
    story: (day) => S.settleThrough(s, day).map((e) => ({ line: e.line, kind: e.kind })),
    met: (day) => S.metOn(s, day),
  });
  const text = JSON.stringify(page);
  assert.ok(text.includes('她把同一句話刪了三次。'), '予安第一次來');
  assert.ok(text.includes('我是被逼來的'), '阿哲送龍眼乾');
  assert.ok(S.metOn(s, 3).kevin && !S.metOn(s, 2).kevin);
  // 颱風隔天
  const t = newSave();
  t.story.typhoonDay = 9;
  for (const w of S.REGULAR_IDS) t.regulars[w].settled = 8;
  assert.ok(S.settleThrough(t, 10).some((e) => e.line === S.AFTER_TYPHOON));
});

test('存檔第 3 版：舊存檔不補算過去的日子，熟客從今天開始來；送的擺飾不在型錄上賣', () => {
  const old = { version: 2, createdAt: T0, lastSeen: T0 + 9 * DAY, tasks: [], fund: { ledger: [] }, owned: [], nextUid: 1, seatsSat: [], stats: { cups: 1, rainyWindowCups: 0 },
    regulars: { yuan: { visits: 0, milestones: [] }, zhe: { visits: 0, milestones: [] }, kevin: { visits: 0, milestones: [] } }, flags: { seenOpening: true } };
  const s = migrate(old, T0 + 9 * DAY);
  assert.equal(s.version, 3);
  assert.deepEqual(s.menu, ['dongshan']);
  assert.ok(S.REGULAR_IDS.every((w) => s.regulars[w].settled === 9 && s.regulars[w].on && s.regulars[w].visits === 0));
  assert.deepEqual(S.settleThrough(s, 9), [], '不會一次湧出一大疊');
  assert.ok(S.planToday(s, 10).length === 3, '今天三位都會來（第一次）');
  assert.ok(itemById('napkin') && itemById('yuan-book') && !CATALOG.some((i) => i.gift), '送的擺飾不在型錄上');
});
