// 純邏輯單元測試：node --test（npm test 會先跑這些，再跑冒煙測試）
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayIndex, daysOpen, daysBetween, JUMP_DAY_MS } from '../../src/clock.js';
import { TASKS, temperature, completeTasks, pending, BASE_TEMP, GOAL_TEMP, isDone } from '../../src/tasks.js';
import { CATALOG, STARTER_ITEMS, balance, commitLayout, bookCount, itemById, placedItems } from '../../src/catalog.js';
import { createStore, defaultSave, migrate, SAVE_KEY, SAVE_VERSION } from '../../src/save.js';

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
