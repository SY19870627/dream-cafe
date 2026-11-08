import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDay, daySeed, mulberry32 } from '../../src/sim.js';
import { emptyLayout, seatCells, BAR_ITEM } from '../../src/grid.js';
import { initialMenu, makeRecipe, setSlot, setSignature } from '../../src/menu.js';
import { goalDone } from '../../src/chapters.js';
import { validate } from '../../src/grid.js';
import { buildJournal } from '../../src/journal.js';

const shop = () => ({
  items: [
    { uid: 'w1', kind: 'corner', type: 'window', x: 0, y: 1, rot: 0, style: 'wood' },
    { uid: 'k1', kind: 'corner', type: 'worktable', x: 5, y: 5, rot: 1, style: 'iron' },
    { uid: 'p1', kind: 'decor', type: 'plant', x: 2, y: 1, rot: 0 },
    { uid: 'c1', kind: 'decor', type: 'catbed', x: 0, y: 4, rot: 0 },
  ],
});

test('亂數產生器：同種子同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('同樣的佈置、菜單、天數 → 同樣的結果', () => {
  const r1 = simulateDay({ layout: shop(), menu: initialMenu(), day: 3 });
  const r2 = simulateDay({ layout: shop(), menu: initialMenu(), day: 3 });
  assert.deepEqual(r1, r2);
  // uid、擺放順序不同也一樣
  const l = shop();
  l.items.reverse();
  l.items.forEach((it, i) => { it.uid = `z${i}`; });
  const r3 = simulateDay({ layout: l, menu: initialMenu(), day: 3 });
  assert.equal(r3.seed, r1.seed);
  assert.deepEqual(r3.guests.map((g) => [g.type, g.cornerType, g.seatIndex, g.order]), r1.guests.map((g) => [g.type, g.cornerType, g.seatIndex, g.order]));
});

test('換佈置會換種子', () => {
  const a = daySeed(shop(), initialMenu(), 1);
  const l = shop();
  l.items[2].x = 3;
  assert.notEqual(a, daySeed(l, initialMenu(), 1));
});

test('空店也有客人來，全部坐吧台', () => {
  const r = simulateDay({ layout: emptyLayout(), menu: initialMenu(), day: 1 });
  assert.ok(r.guests.length >= 3);
  for (const g of r.guests) assert.equal(g.corner, 'bar');
});

test('每位客人都有位子、點菜單上的東西，同一個位子不會同時坐兩個人', () => {
  for (let day = 1; day <= 20; day++) {
    const r = simulateDay({ layout: shop(), menu: initialMenu(), day });
    for (const g of r.guests) {
      assert.ok(g.sitAt > g.arrive && g.leaveAt > g.sitAt && g.exitAt > g.leaveAt);
      assert.equal(g.order, 0);
      assert.ok(g.path.length >= 1);
    }
    const bySeat = new Map();
    for (const g of r.guests) {
      const k = `${g.corner}:${g.seatIndex}`;
      for (const o of bySeat.get(k) || []) assert.ok(g.sitAt >= o.leaveAt || o.sitAt >= g.leaveAt, `第 ${day} 天 ${k} 重疊`);
      bySeat.set(k, [...(bySeat.get(k) || []), g]);
    }
  }
});

test('擺了窗邊座與工作桌，會有喜歡它們的客人坐進去', () => {
  let window = 0;
  let laptop = 0;
  for (let day = 1; day <= 10; day++) {
    const r = simulateDay({ layout: shop(), menu: initialMenu(), day });
    window += r.guests.filter((g) => g.type === 'solo' && g.cornerType === 'window').length;
    laptop += r.guests.filter((g) => g.type === 'laptop' && g.cornerType === 'worktable').length;
  }
  assert.ok(window > 0);
  assert.ok(laptop > 0);
});

test('貓窩決定龍眼睡哪裡', () => {
  assert.equal(simulateDay({ layout: shop(), menu: initialMenu() }).cat.place, 'catbed');
  assert.equal(simulateDay({ layout: emptyLayout(), menu: initialMenu() }).cat.place, 'window');
});

test('第 2 章：玩家設計、對口味的招牌，大多數日子能被 3 位以上點到', () => {
  let menu = setSlot(initialMenu(), 1, makeRecipe('dongshan', 'pour', 'none', '窗外的山'));
  menu = setSignature(menu, 1);
  let hit = 0;
  for (let day = 1; day <= 10; day++) {
    const r = simulateDay({ layout: shop(), menu, day });
    if (goalDone(2, { layout: shop(), validation: validate(shop()), result: r, menu })) hit++;
  }
  assert.ok(hit >= 6, `只有 ${hit}/10 天達成`);
  // 德叔那杯當招牌不算
  const r = simulateDay({ layout: shop(), menu: initialMenu(), day: 1 });
  assert.equal(goalDone(2, { layout: shop(), validation: validate(shop()), result: r, menu: initialMenu() }), false);
});

test('日誌：寫出誰坐哪、龍眼睡哪', () => {
  const r = simulateDay({ layout: shop(), menu: initialMenu(), day: 2 });
  const lines = buildJournal({ chapter: 1, layout: shop(), menu: initialMenu(), result: r, goalMet: true });
  assert.ok(lines.length >= 3);
  assert.ok(lines.some((l) => l.includes('龍眼')));
  assert.ok(lines.every((l) => !l.includes('{')));
});

test('吧台座是固定角落：三張高腳椅', () => {
  assert.equal(seatCells(BAR_ITEM).length, 3);
});
