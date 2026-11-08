// 純邏輯單元測試：node --test（npm test 會先跑這些，再跑冒煙測試）
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayIndex, daysOpen, daysBetween, JUMP_DAY_MS } from '../../src/clock.js';
import { TASKS, temperature, completeTasks, pending, BASE_TEMP, GOAL_TEMP, isDone } from '../../src/tasks.js';
import { CATALOG, STARTER_ITEMS, balance, commitLayout, bookCount, itemById, placedItems } from '../../src/catalog.js';
import { createStore, defaultSave as blankSave, giveStarters, migrate, SAVE_KEY, SAVE_VERSION } from '../../src/save.js';
import { RESIGNATIONS, LETTERS, LAWYER_LETTER, dueLetter, markRead, hasRead } from '../../src/letters.js';
import { writeJournal, keepPage, dayLines, KEEP_PAGES, ALL_TEXTS } from '../../src/journal.js';
import { weatherOn } from '../../src/weather.js';

const T0 = new Date(2026, 10, 1, 21, 30).getTime(); // 本地時間 11/1 21:30

// 模擬 localStorage
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    map: m,
  };
}
function defaultSave(now) {
  const s = blankSave(now);
  giveStarters(s);
  s.flags.seenOpening = true;
  return s;
}
const ctx = (save, now = T0) => ({ daysOpen: daysOpen(save.createdAt, now) });

test('開店天數以本地日曆日計，跨午夜就是新的一天', () => {
  const late = new Date(2026, 10, 1, 23, 59).getTime();
  const early = new Date(2026, 10, 2, 0, 1).getTime();
  assert.equal(dayIndex(late) + 1, dayIndex(early));
  assert.equal(daysOpen(T0, T0), 1);
  assert.equal(daysOpen(T0, late), 1);
  assert.equal(daysOpen(T0, early), 2);
  assert.equal(daysOpen(T0, T0 + 6 * JUMP_DAY_MS), 7);
  assert.equal(daysOpen(T0, T0 - JUMP_DAY_MS), 1, '時間倒退也不會小於第 1 天');
  assert.equal(daysBetween(T0, new Date(2026, 11, 1, 8).getTime()), 30, '跨月');
});

test('任務表：20 個、溫度合計 +17°C、撥款合計 38,500 元，編號與 id 不重複', () => {
  assert.equal(TASKS.length, 20);
  assert.deepEqual(TASKS.map((t) => t.no), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(new Set(TASKS.map((t) => t.id)).size, 20);
  assert.equal(TASKS.reduce((s, t) => s + t.temp, 0), GOAL_TEMP - BASE_TEMP);
  assert.equal(TASKS.reduce((s, t) => s + t.fund, 0), 38500);
});

test('新存檔：20°C、基金 0 元、倉庫裡有三件初始擺飾', () => {
  const s = defaultSave(T0);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(temperature(s), 20);
  assert.equal(balance(s), 0);
  assert.deepEqual(s.owned.map((o) => o.item), STARTER_ITEMS);
  assert.ok(s.owned.every((o) => !o.placed));
  assert.deepEqual(pending(s, ctx(s)), [], '新存檔不會一開始就完成任務');
});

test('第一杯、坐遍座位：完成一次就好，溫度與基金一起增加', () => {
  const s = defaultSave(T0);
  s.stats.cups = 1;
  assert.deepEqual(completeTasks(s, ctx(s), T0).map((t) => t.id), ['first-coffee']);
  assert.equal(temperature(s), 20.5);
  assert.equal(balance(s), 500);
  s.stats.cups = 2;
  assert.deepEqual(completeTasks(s, ctx(s), T0), [], '第二杯不會再完成一次');
  s.seatsSat = ['window', 'bar'];
  assert.deepEqual(completeTasks(s, ctx(s), T0), []);
  s.seatsSat.push('sofa');
  assert.deepEqual(completeTasks(s, ctx(s), T0).map((t) => t.id), ['all-seats']);
  assert.equal(temperature(s), 21.5);
  assert.equal(balance(s), 1500);
});

test('開店滿 3 天、7 天：跳天數後依序完成，同時到期也各撥一次', () => {
  const s = defaultSave(T0);
  assert.deepEqual(completeTasks(s, ctx(s, T0 + JUMP_DAY_MS), T0), []);
  assert.deepEqual(completeTasks(s, ctx(s, T0 + 2 * JUMP_DAY_MS), T0).map((t) => t.id), ['open-3-days']);
  const s2 = defaultSave(T0);
  const done = completeTasks(s2, ctx(s2, T0 + 10 * JUMP_DAY_MS), T0).map((t) => t.id);
  assert.deepEqual(done, ['open-3-days', 'open-7-days']);
  assert.equal(temperature(s2), 21.5);
  assert.equal(balance(s2), 3000);
  assert.equal(s2.tasks.find((d) => d.id === 'open-7-days').day, 11);
});

test('熟客、龍眼、客人模式的任務：等之後的階段寫入里程碑或旗標才完成', () => {
  const s = defaultSave(T0);
  s.regulars.zhe.milestones.push(1);
  s.regulars.yuan.milestones.push(2, 3);
  s.flags.guestVisit = true;
  assert.deepEqual(completeTasks(s, ctx(s), T0).map((t) => t.no), [5, 6, 11, 17]);
});

test('全部任務完成時剛好 37°C', () => {
  const s = defaultSave(T0);
  for (const t of TASKS) s.tasks.push({ id: t.id, t: T0, day: 1 });
  assert.equal(temperature(s), 37);
});

test('買擺飾：試擺按確定才扣錢，基金不夠的退回型錄，餘額不會變負', () => {
  const s = defaultSave(T0);
  s.fund.ledger.push({ t: T0, kind: 'grant', ref: 'first-coffee', amount: 500 }, { t: T0, kind: 'grant', ref: 'first-decor', amount: 500 });
  const layout = s.owned.map((o) => ({ uid: o.uid, item: o.item, placed: o.uid === 1, x: 1, z: 1 }));
  layout.push({ item: 'longan-jar', trial: true, x: 0, z: 0 }); // 300
  layout.push({ item: 'radio', trial: true, x: 0.5, z: 0 }); // 800：剩 700，不夠，退回
  layout.push({ item: 'succulent', trial: true, x: -0.5, z: 0 }); // 300：剩 700，夠
  const r = commitLayout(s, layout, T0);
  assert.deepEqual(r.bought, ['longan-jar', 'succulent']);
  assert.deepEqual(r.returned, ['radio']);
  assert.equal(r.spent, 600);
  assert.equal(balance(s), 400);
  assert.equal(placedItems(s).length, 3);
  assert.equal(s.owned.length, 5);
  assert.equal(new Set(s.owned.map((o) => o.uid)).size, 5, 'uid 不重複');
  assert.equal(s.fund.ledger.filter((e) => e.kind === 'buy').reduce((a, e) => a - e.amount, 0), 600);
});

test('移動與收回倉庫永遠免費；第一件擺飾、十件擺飾、書牆的判定', () => {
  const s = defaultSave(T0);
  s.fund.ledger.push({ t: T0, kind: 'dev', ref: 'test', amount: 50000 });
  const layout = s.owned.map((o) => ({ uid: o.uid, item: o.item, placed: true, x: 0, z: 0 }));
  commitLayout(s, layout, T0);
  assert.equal(balance(s), 50000, '擺放不花錢');
  assert.deepEqual(completeTasks(s, ctx(s), T0).map((t) => t.id), ['first-decor']);
  const more = s.owned.map((o) => ({ uid: o.uid, item: o.item, placed: true, x: o.x, z: o.z }));
  for (const item of ['bookshelf', 'bookshelf', 'longan-jar', 'radio', 'easel', 'coffee-sack']) more.push({ item, trial: true, x: 0, z: 0 });
  commitLayout(s, more, T0);
  assert.equal(placedItems(s).length, 9);
  assert.equal(bookCount(s.owned), 2);
  assert.deepEqual(completeTasks(s, ctx(s), T0), []);
  const last = s.owned.map((o) => ({ uid: o.uid, item: o.item, placed: true, x: o.x, z: o.z }));
  last.push({ item: 'bookshelf', trial: true, x: 0, z: 0 });
  commitLayout(s, last, T0);
  assert.deepEqual(completeTasks(s, ctx(s), T0).map((t) => t.id), ['ten-decor', 'book-wall']);
  // 收回倉庫
  const stored = s.owned.map((o) => ({ uid: o.uid, item: o.item, placed: false, x: o.x, z: o.z }));
  const before = balance(s);
  commitLayout(s, stored, T0);
  assert.equal(placedItems(s).length, 0);
  assert.equal(balance(s), before);
  assert.ok(isDone(s, 'ten-decor'), '收起來也不會把完成的任務拿走');
});

test('型錄價格落在劇本範圍：小擺飾 300～800、家具 1,500～5,000、大件約 1 萬', () => {
  for (const i of CATALOG) {
    if (i.cat === 'small') assert.ok(i.price >= 300 && i.price <= 800, i.name);
    else if (i.cat === 'furniture') assert.ok(i.price >= 1500 && i.price <= 5000, i.name);
    else assert.ok(i.price >= 8000 && i.price <= 12000, i.name);
  }
  assert.ok(CATALOG.length >= 10, '至少要能擺滿 10 件');
  assert.ok(STARTER_ITEMS.every((id) => itemById(id)));
  assert.ok(CATALOG.some((i) => (i.books || 0) >= 1), '有能組成書牆的東西');
});

test('存檔：寫入後重新讀取，進度都在', () => {
  const st = memStorage();
  const a = createStore(st, T0);
  const s = a.load();
  assert.equal(a.status, 'new');
  s.stats.cups = 1;
  completeTasks(s, ctx(s), T0);
  s.seatsSat.push('window');
  assert.ok(a.write(s));
  const b = createStore(st, T0 + 1000);
  const s2 = b.load();
  assert.equal(b.status, 'loaded');
  assert.equal(temperature(s2), 20.5);
  assert.equal(balance(s2), 500);
  assert.deepEqual(s2.seatsSat, ['window']);
  assert.equal(s2.createdAt, T0);
});

test('存檔：舊格式補齊欄位、壞掉的存檔另外備份、比遊戲新的版本不認得', () => {
  const old = migrate({ createdAt: T0, tasks: [{ id: 'first-coffee', t: T0 }], owned: [{ uid: 7, item: 'plant', placed: true, x: 1, z: 1 }] }, T0 + 5);
  assert.equal(old.version, SAVE_VERSION);
  assert.equal(old.createdAt, T0);
  assert.deepEqual(old.owned.map((o) => o.uid), [7], '補欄位時不會塞進初始擺飾');
  assert.ok(old.flags.seenOpening && old.flags.starterGiven, '第 1 版的存檔不再播開場、不再送初始擺飾');
  assert.equal(old.player.name, '');
  assert.equal(old.nextUid, 8);
  assert.equal(old.stats.cups, 0);
  assert.ok(old.regulars.kevin);
  assert.equal(migrate({ version: SAVE_VERSION + 1 }, T0), null);
  assert.equal(migrate('壞掉', T0), null);

  const st = memStorage({ [SAVE_KEY]: '{壞掉的 JSON' });
  const store = createStore(st, T0);
  const s = store.load();
  assert.equal(store.status, 'reset');
  assert.equal(temperature(s), 20);
  assert.equal(st.map.get(SAVE_KEY + '.broken'), '{壞掉的 JSON');
});

test('存檔：私密模式（讀寫都丟錯）照常遊戲，只是不存', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const store = createStore(bad, T0);
  assert.equal(store.available, false);
  const s = store.load();
  assert.equal(store.status, 'memory');
  assert.equal(temperature(s), 20);
  assert.equal(store.write(s), false);
  const none = createStore(null, T0);
  assert.equal(none.load().version, SAVE_VERSION);
});

/* ---------- 階段 3：開場、老先生的信、營業日誌 ---------- */

test('新存檔：還沒看開場、倉庫是空的；初始擺飾由開場第四幕送出，只送一次', () => {
  const s = blankSave(T0);
  assert.equal(s.flags.seenOpening, undefined);
  assert.equal(s.owned.length, 0);
  assert.ok(giveStarters(s));
  assert.deepEqual(s.owned.map((o) => o.item), STARTER_ITEMS);
  assert.equal(giveStarters(s), false);
  assert.equal(s.owned.length, 3);
  // 玩家資料存得回來（fill 不會把字串蓋掉）
  s.player.name = '小明';
  s.player.resignation = 'fire';
  const back = migrate(JSON.parse(JSON.stringify(s)), T0);
  assert.equal(back.player.name, '小明');
  assert.equal(back.player.resignation, 'fire');
  assert.equal(back.flags.seenOpening, undefined, '第 2 版的新存檔不會被當成看過開場');
});

test('開場文字：三種辭呈結尾、律師信有「若您尚未辭職」', () => {
  assert.deepEqual(RESIGNATIONS.map((r) => r.id), ['thanks', 'dream', 'fire']);
  assert.ok(RESIGNATIONS.find((r) => r.id === 'fire').text.includes('單方面辭退'));
  assert.ok(LAWYER_LETTER.paragraphs.join('').includes('若您尚未辭職，請先辭職'));
});

test('第一封信：看完開場後，開店第 2 天或溫度 22°C 才交出來，只交一次', () => {
  const s = defaultSave(T0);
  assert.equal(dueLetter(s, { daysOpen: 1, temp: 21.5 }), null);
  assert.equal(dueLetter(s, { daysOpen: 2, temp: 20 })?.id, 'first');
  assert.equal(dueLetter(s, { daysOpen: 1, temp: 22 })?.id, 'first');
  const first = LETTERS[0];
  assert.equal(first.give({ daysOpen: 2, temp: 20 }), '這封，他交代第二天給你。');
  assert.ok(first.paragraphs.join('').includes('德昌'));
  const blank = blankSave(T0);
  assert.equal(dueLetter(blank, { daysOpen: 5, temp: 30 }), null, '開場還沒看完不交信');
  assert.ok(markRead(s, 'first', T0, 2));
  assert.equal(markRead(s, 'first', T0, 3), false);
  assert.ok(hasRead(s, 'first'));
  assert.equal(dueLetter(s, { daysOpen: 9, temp: 30 }), null, '讀過就不再交');
});

test('營業日誌：同一天回來不寫；隔天回來寫一天，每天 2～4 條', () => {
  const s = defaultSave(T0);
  assert.equal(writeJournal(s, T0, T0 + 3600e3), null);
  const next = new Date(2026, 10, 2, 20, 0).getTime();
  const page = writeJournal(s, T0, next);
  assert.equal(page.days.length, 1);
  assert.equal(page.days[0].day, 2);
  assert.equal(page.summary, null);
  assert.ok(page.days[0].lines.length >= 2 && page.days[0].lines.length <= 4);
  assert.match(page.days[0].lines[0], /^今天來了[三四五]位。/);
  assert.deepEqual(writeJournal(s, T0, next), page, '同一天永遠寫出一樣的內容');
});

test('營業日誌：離開很多天，只展開最近 3 天，其餘一句帶過', () => {
  const s = defaultSave(T0);
  const later = new Date(2026, 10, 11, 21, 0).getTime(); // 第 11 天
  const page = writeJournal(s, T0, later);
  assert.deepEqual(page.days.map((d) => d.day), [9, 10, 11]);
  assert.match(page.summary, /^第 2～8 天，店照常開著，一共來了 \d+ 位客人。/);
  const n = Number(page.summary.match(/來了 (\d+) 位/)[1]);
  assert.ok(n >= 7 * 3 && n <= 7 * 5, '每天 3～5 位');
  for (const d of page.days) assert.ok(d.lines.length >= 2 && d.lines.length <= 4, `第 ${d.day} 天 ${d.lines.length} 條`);
  const all = page.days.flatMap((d) => d.lines.slice(1));
  assert.equal(new Set(all).size, all.length, '同一頁裡片段不重複');
  // 一年沒來也只有 3 天展開
  const year = writeJournal(s, T0, T0 + 400 * 864e5);
  assert.equal(year.days.length, 3);
});

test('營業日誌：熟客里程碑與「想等老闆在」的提示一定寫進去；擺飾會影響片段', () => {
  const s = defaultSave(T0);
  const story = (day) => (day === 3 ? [{ kind: 'waiting', line: '凱文先生今天好像有話想說，但想等老闆在。' }]
    : day === 2 ? [{ kind: 'milestone', line: '她把同一句話刪了三次。' }] : []);
  const page = writeJournal(s, T0, new Date(2026, 10, 3, 19).getTime(), { story });
  assert.ok(page.days[0].lines.includes('她把同一句話刪了三次。'));
  assert.ok(page.days[1].lines.includes('凱文先生今天好像有話想說，但想等老闆在。'));
  // 一句帶過的日子，熟客事件仍記在 notes
  const long = writeJournal(s, T0, new Date(2026, 10, 9, 19).getTime(), { story });
  assert.deepEqual(long.notes, ['她把同一句話刪了三次。', '凱文先生今天好像有話想說，但想等老闆在。']);
  // 第 1～2 天還沒見過凱文，不會寫到冰美式先生
  for (let k = 0; k < 40; k++) {
    const ts = T0 + k * 3600e3 * 7;
    const c = { day: 2, ts, idx: 20000 + k, rain: false, placed: new Set(), books: 0, met: { zhe: true, yuan: true, kevin: false } };
    assert.ok(!dayLines(s, c).lines.join('').includes('冰美式'));
  }
  // 沒有書櫃就不會寫「書架上」
  const c = { day: 5, ts: T0, idx: 20500, rain: false, placed: new Set(), books: 0, met: { zhe: true, yuan: true, kevin: true } };
  for (let k = 0; k < 60; k++) assert.ok(!dayLines(s, { ...c, idx: 20500 + k }).lines.join('').includes('書架'));
});

test('營業日誌：只留最近幾頁；句子裡沒有上班或「不划算」的字眼', () => {
  const s = defaultSave(T0);
  for (let k = 1; k <= KEEP_PAGES + 4; k++) keepPage(s, { t: k, days: [], summary: null, notes: [] });
  assert.equal(s.journal.length, KEEP_PAGES);
  assert.equal(s.journal[0].t, 5);
  for (const t of ALL_TEXTS) assert.doesNotMatch(t, /不划算|划不來|KPI|業績|餘額|不足|打卡/);
});

test('天氣：同一天結果固定，夏天比冬天常下雨', () => {
  assert.equal(weatherOn(20400, 6, 1), weatherOn(20400, 6, 1));
  let summer = 0, winter = 0;
  for (let d = 0; d < 2000; d++) { if (weatherOn(d, 7, 3) === 'rain') summer++; if (weatherOn(d, 0, 3) === 'rain') winter++; }
  assert.ok(summer > winter * 2, `${summer} vs ${winter}`);
});
