import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDay, daySeed, mulberry32, GUESTS, beatsDeshu } from '../../src/sim.js';
import { emptyLayout, seatCells, BAR_ITEM } from '../../src/grid.js';
import { initialMenu, makeRecipe, setSlot, setSignature, matchScore, DESHU_CUP } from '../../src/menu.js';
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

const sigMenu = (bean, brew, add, name) => setSignature(setSlot(initialMenu(), 1, makeRecipe(bean, brew, add, name)), 1);
const ch2Hits = (menu, days = 10) => {
  let hit = 0;
  for (let day = 1; day <= days; day++) {
    const r = simulateDay({ layout: shop(), menu, day });
    if (goalDone(2, { layout: shop(), validation: validate(shop()), result: r, menu })) hit++;
  }
  return hit;
};

test('點餐看口味：招牌沒有盲目加分，客人一定點菜單上最合口味的那幾杯之一', () => {
  // 招牌只在口味一樣合時稍微佔便宜；差一個口味，招牌加分＋亂數也翻不過去
  const menu = sigMenu('gukeng', 'cold', 'milk', '不合街坊的');
  for (let day = 1; day <= 10; day++) {
    const r = simulateDay({ layout: shop(), menu, day });
    for (const g of r.guests) {
      const taste = GUESTS[g.type].taste;
      const best = Math.max(...menu.slots.filter(Boolean).map((x) => matchScore(x, taste)));
      assert.equal(matchScore(menu.slots[g.order], taste), best, `第 ${day} 天 ${g.type} 點了不合口味的「${g.orderName}」`);
    }
  }
});

test('第 2 章：抄一杯跟德叔一樣的當招牌，永遠不算', () => {
  // 舊版：招牌 +0.9，這樣 10 天裡大多數日子第一天就過關
  assert.equal(ch2Hits(sigMenu('dongshan', 'pour', 'none', '窗外的山')), 0);
  // 德叔那杯當招牌也不算
  const r = simulateDay({ layout: shop(), menu: initialMenu(), day: 1 });
  assert.equal(goalDone(2, { layout: shop(), validation: validate(shop()), result: r, menu: initialMenu() }), false);
});

test('第 2 章：配給德叔照顧不到的客人（筆電、結伴、觀光）的招牌，幾天內能過關', () => {
  // 冰滴＋龍眼蜜：帶筆電的（冰、清爽）、結伴的（甜）、觀光客（在地）都比德叔那杯合
  const hit = ch2Hits(sigMenu('dongshan', 'cold', 'honey', '冰的蜜'));
  assert.ok(hit >= 3, `只有 ${hit}/10 天達成`);
});

test('哪幾種客人覺得這杯比德叔那杯合', () => {
  assert.deepEqual(beatsDeshu(DESHU_CUP), []);
  assert.deepEqual(beatsDeshu(makeRecipe('dongshan', 'pour', 'none')), []);
  const t = beatsDeshu(makeRecipe('dongshan', 'cold', 'honey'));
  for (const k of ['laptop', 'pair', 'tourist']) assert.ok(t.includes(k), k);
  assert.ok(!t.includes('resident') && !t.includes('solo'));
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
