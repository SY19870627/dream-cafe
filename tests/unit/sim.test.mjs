import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDay, daySeed, mulberry32, GUESTS, beatsDeshu, guestWeights, catSpot } from '../../src/sim.js';
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

/* ---------- 擺設大改：新擺設與細調接上客人偏好 ---------- */
const win = (opts) => ({ uid: 'w1', kind: 'corner', type: 'window', x: 0, y: 1, rot: 0, style: 'wood', ...(opts ? { opts } : {}) });
const showcase = { uid: 's1', kind: 'corner', type: 'showcase', x: 0, y: 0, rot: 0, style: 'wood' }; // 後牆，緊挨著窗邊座
const record = { uid: 'r1', kind: 'corner', type: 'record', x: 5, y: 5, rot: 0, style: 'wood' };
const days = (layout, n = 20, menu = initialMenu()) => Array.from({ length: n }, (_, i) => simulateDay({ layout, menu, day: i + 1 }));

test('展示櫃：觀光客、街坊變多，有人停在櫃子前面看；只擺展示櫃不算第 1 章', () => {
  const base = guestWeights({ items: [win()] }, initialMenu());
  const w = guestWeights({ items: [win(), showcase] }, initialMenu());
  assert.ok(w.tourist > base.tourist + 0.5);
  assert.ok(w.resident > base.resident);
  const browse = days({ items: [win(), showcase] }).flatMap((r) => r.guests).filter((g) => g.action === 'browse');
  assert.ok(browse.length > 0);
  assert.ok(days({ items: [win(), showcase] }, 5).flatMap((r) => r.guests).every((g) => g.corner !== 's1')); // 展示櫃沒有座位
  const only = { items: [showcase] };
  const r = simulateDay({ layout: only, menu: initialMenu(), day: 1 });
  assert.equal(goalDone(1, { layout: only, validation: validate(only), result: r, menu: initialMenu() }), false);
  const lines = buildJournal({ chapter: 1, layout: only, menu: initialMenu(), result: r, goalMet: false });
  assert.ok(lines.some((l) => l.includes('櫃子')));
  assert.ok(lines.every((l) => !l.includes('{')));
});

test('唱片角：結伴來的人比較多、會挑唱片角坐', () => {
  const base = guestWeights({ items: [win()] }, initialMenu());
  const w = guestWeights({ items: [win(), record] }, initialMenu());
  assert.ok(w.pair > base.pair + 1);
  const gs = days({ items: [win(), record] }).flatMap((r) => r.guests);
  const pairs = gs.filter((g) => g.type === 'pair');
  assert.ok(pairs.length > 0);
  assert.ok(pairs.filter((g) => g.cornerType === 'record').length >= pairs.length / 2);
  assert.ok(gs.some((g) => g.cornerType === 'record' && g.action === 'music'));
  assert.ok(pairs.some((g) => g.cornerType === 'record' && g.why.includes('唱片')));
});

test('細調：窗邊座放燈、放書、改成一張椅子，自己來的人變多；一張椅子結伴的就坐不進去', () => {
  const base = guestWeights({ items: [win()] }, initialMenu());
  const tuned = guestWeights({ items: [win({ lamp: 'on', top: 'book', seats: 1 })] }, initialMenu());
  assert.ok(tuned.solo > base.solo + 1);
  for (const r of days({ items: [win({ seats: 1 })] })) {
    for (const g of r.guests) {
      if (g.corner === 'w1') assert.equal(g.seatIndex, 0);
      if (g.corner === 'w1') assert.notEqual(g.type, 'pair');
    }
  }
  // 工作桌把燈拿掉：帶筆電的少一點
  const k = { uid: 'k1', kind: 'corner', type: 'worktable', x: 5, y: 5, rot: 1, style: 'wood' };
  assert.ok(guestWeights({ items: [{ ...k, opts: { lamp: 'off' } }] }, initialMenu()).laptop < guestWeights({ items: [k] }, initialMenu()).laptop);
});

test('細調全是預設值：跟沒調過的舊佈置同一天結果一樣', () => {
  const a = simulateDay({ layout: shop(), menu: initialMenu(), day: 4 });
  const l = shop();
  l.items[0] = { ...l.items[0], opts: { table: 'wood', chair: 'chair', seats: 2, top: 'none', lamp: 'off', wall: 'shelf' } };
  const b = simulateDay({ layout: l, menu: initialMenu(), day: 4 });
  assert.equal(a.seed, b.seed);
  assert.deepEqual(a.guests.map((g) => [g.type, g.corner, g.seatIndex, g.action]), b.guests.map((g) => [g.type, g.corner, g.seatIndex, g.action]));
});

test('每位客人都說得出為什麼坐這裡', () => {
  for (const r of days({ items: [win({ lamp: 'on' }), showcase, record, { uid: 'g1', kind: 'decor', type: 'greenwall', x: 0, y: 7, rot: 0 }] }, 10)) {
    for (const g of r.guests) assert.ok(typeof g.why === 'string' && g.why.length > 0, `${g.type} 沒有理由`);
  }
  const gs = days({ items: [win()] }).flatMap((r) => r.guests);
  assert.ok(gs.some((g) => g.type === 'solo' && g.corner === 'w1' && g.why.includes('窗邊')));
});

test('貓跳台：龍眼待在貓跳台、找貓的人會來；地毯、綠植牆、書牆不擋路也有人喜歡', () => {
  const tree = { uid: 't1', kind: 'decor', type: 'cattree', x: 0, y: 6, rot: 0 };
  const l = { items: [win(), tree] };
  assert.equal(catSpot(l).place, 'cattree');
  assert.ok(guestWeights(l, initialMenu()).catlover > 0);
  const lines = buildJournal({ chapter: 1, layout: l, menu: initialMenu(), result: simulateDay({ layout: l, menu: initialMenu() }), goalMet: true });
  assert.ok(lines.some((x) => x.includes('貓跳台')));
  const deco = { items: [win(), { uid: 'rg', kind: 'decor', type: 'rug', x: 1, y: 3, rot: 0 }, { uid: 'bw', kind: 'decor', type: 'bookwall', x: 2, y: 0, rot: 0 }] };
  assert.ok(guestWeights(deco, initialMenu()).solo > guestWeights({ items: [win()] }, initialMenu()).solo);
  assert.equal(validate(deco).ok, true);
});
