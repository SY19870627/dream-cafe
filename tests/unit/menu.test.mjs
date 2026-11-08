import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEANS, BREWS, ADDS, tagsOf, keysOf, makeRecipe, weirdness, initialMenu, setSlot, setSignature, signatureIsPlayers, menuItems, matchScore, MENU_SLOTS,
} from '../../src/menu.js';

test('雛形的選項：2 種豆、2 種沖法、3 種加一味', () => {
  assert.deepEqual(Object.values(BEANS).map((b) => b.name), ['東山日曬', '古坑水洗']);
  assert.deepEqual(Object.values(BREWS).map((b) => b.name), ['手沖', '冰滴']);
  assert.deepEqual(Object.values(ADDS).map((b) => b.name), ['不加', '鮮奶', '龍眼蜜']);
});

test('標籤：豆子＋沖法＋加一味', () => {
  assert.deepEqual(tagsOf(makeRecipe('dongshan', 'pour', 'none')), ['果酸', '乾淨']);
  assert.deepEqual(tagsOf(makeRecipe('gukeng', 'cold', 'honey')), ['堅果', '清爽', '甜', '在地']);
  assert.deepEqual(tagsOf(makeRecipe('gukeng', 'pour', 'milk')), ['堅果', '乾淨', '奶香']);
});

test('比對關鍵字含冷熱、沖法、不加', () => {
  const k = keysOf(makeRecipe('dongshan', 'pour', 'none'));
  for (const t of ['果酸', '乾淨', '手沖', '熱', '不加']) assert.ok(k.has(t), t);
  assert.ok(keysOf(makeRecipe('gukeng', 'cold', 'milk')).has('冰'));
  assert.equal(matchScore(makeRecipe('dongshan', 'pour', 'none'), ['熱', '不加']), 2);
  assert.equal(matchScore(makeRecipe('gukeng', 'cold', 'honey'), ['熱', '不加']), 0);
});

test('怪怪的組合照樣能做', () => {
  const r = makeRecipe('dongshan', 'cold', 'milk');
  assert.ok(weirdness(r));
  assert.equal(weirdness(makeRecipe('gukeng', 'cold', 'milk')), null);
});

test('取名：沒取就用預設名，最多 10 字', () => {
  assert.equal(makeRecipe('gukeng', 'cold', 'honey').name, '古坑冰滴加龍眼蜜');
  assert.equal(makeRecipe('dongshan', 'pour', 'none', '  山  ').name, '山');
  assert.equal(makeRecipe('dongshan', 'pour', 'none', '一二三四五六七八九十十一').name.length, 10);
  assert.throws(() => makeRecipe('alishan', 'pour', 'none'));
});

test('菜單板 3 格；招牌一開始是德叔那杯，換成自己的才算', () => {
  let m = initialMenu();
  assert.equal(m.slots.length, MENU_SLOTS);
  assert.equal(signatureIsPlayers(m), false);
  m = setSlot(m, 1, makeRecipe('gukeng', 'cold', 'none'));
  assert.equal(menuItems(m).length, 2);
  m = setSignature(m, 1);
  assert.equal(signatureIsPlayers(m), true);
  m = setSlot(m, 1, null); // 拿掉招牌那格：招牌回到第一個還有東西的格子
  assert.equal(m.signature, 0);
  assert.equal(setSignature(m, 2).signature, 0); // 空格不能當招牌
});
