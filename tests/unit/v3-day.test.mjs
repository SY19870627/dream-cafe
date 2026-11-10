// v3.0 驗證版：五天流程、菜單、固定順序、防重複、重新整理恢復、公司線只一次、沒有第六天。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../../src/day.js';
import { MENU } from '../../src/lines/shop.js';
import { DREAM_ORDER } from '../../src/dreams/index.js';
import { SAVE_KEY } from '../../src/save.js';

// 開場走完
function afterOpening() {
  const s = D.newState();
  for (const act of D.OPENING_ACTS.slice(1)) assert.equal(D.setOpeningAct(s, act), true, act);
  assert.equal(D.finishOpening(s), true);
  return s;
}
// 走完一杯（不含公司）
function oneCup(s, item = 'dongshan') {
  assert.equal(D.order(s, item, 1000), true);
  assert.equal(D.brewDone(s), true);
  assert.equal(D.drink(s), true);
  assert.equal(D.openNotebook(s), true);
  assert.equal(D.leaveDream(s), true);
  assert.equal(D.placeTakeaway(s), true);
}
function doCompany(s) {
  for (const st of D.COMPANY_STEPS.slice(1)) assert.equal(D.companyStep(s, st), true, st);
  assert.equal(D.finishCompany(s), true);
}
// 重新整理：存成 JSON 再讀回來
const reload = (s) => D.normalize(JSON.parse(JSON.stringify(s)));

test('新存檔從第 0 天開場開始，開場只能往前', () => {
  const s = D.newState();
  assert.equal(s.day, 0);
  assert.equal(s.phase, 'opening');
  assert.equal(s.opening.act, 'office');
  assert.equal(D.finishOpening(s), false, '還沒到「先坐。」不能結束開場');
  assert.equal(D.setOpeningAct(s, 'mailbox'), true);
  assert.equal(D.setOpeningAct(s, 'title'), false, '不能倒退');
  assert.equal(D.order(s, 'dongshan'), false, '開場中不能點餐');
});

test('五天的狀態轉移：每天 order → brew → drink → notebook → dream → return，第 3 天開頭送一次咖啡，第 5 天後停在 rest', () => {
  const s = afterOpening();
  assert.equal(s.day, 1);
  assert.equal(s.phase, 'order');
  const phasesSeen = [];
  for (let day = 1; day <= 5; day++) {
    if (s.phase === 'company') { phasesSeen.push('company'); doCompany(s); }
    assert.equal(s.day, day);
    assert.equal(s.phase, 'order');
    assert.equal(D.order(s, MENU[day % 3].id, 1000), true);
    assert.equal(s.phase, 'brew');
    assert.equal(s.brewStartedAt, 1000);
    assert.equal(D.brewDone(s), true);
    assert.equal(s.phase, 'drink');
    assert.equal(D.drink(s), true);
    assert.equal(s.phase, 'notebook');
    assert.equal(D.openNotebook(s), true);
    assert.equal(s.phase, 'dream');
    assert.equal(s.dreamsOpened.at(-1), DREAM_ORDER[day - 1]);
    assert.equal(D.leaveDream(s), true);
    assert.equal(s.phase, 'return');
    assert.equal(D.placeTakeaway(s), true);
  }
  assert.deepEqual(phasesSeen, ['company']);
  assert.equal(s.phase, 'rest');
  assert.equal(s.day, 5);
  assert.deepEqual(s.dreamsOpened, DREAM_ORDER);
  assert.deepEqual(s.takeaways, DREAM_ORDER);
  assert.equal(s.company.done, true);
});

test('公司線只插在第 3 天開頭一次', () => {
  const s = afterOpening();
  oneCup(s);
  assert.equal(s.day, 2);
  assert.equal(s.phase, 'order');
  oneCup(s);
  assert.equal(s.day, 3);
  assert.equal(s.phase, 'company');
  assert.equal(D.order(s, 'dongshan'), false, '送咖啡還沒結束不能點餐');
  assert.equal(D.finishCompany(s), false, '還沒走到最後一步');
  assert.equal(D.companyStep(s, 'sleeve'), true);
  assert.equal(D.companyStep(s, 'talk'), false, '步驟不能倒退');
  assert.equal(D.companyStep(s, 'laugh'), true);
  assert.equal(D.finishCompany(s), true);
  assert.equal(D.finishCompany(s), false, '不能再結束一次');
  assert.equal(s.phase, 'order');
  oneCup(s);
  assert.equal(s.day, 4);
  assert.equal(s.phase, 'order', '第 4 天不再送');
  oneCup(s);
  assert.equal(s.phase, 'order');
  // 重新整理也不會再送一次
  const r = reload(s);
  r.phase = 'company';
  assert.equal(D.normalize(JSON.parse(JSON.stringify(r))).phase, 'order');
});

test('菜單三樣選一，沒有的品項不能點', () => {
  assert.equal(MENU.length, 3);
  assert.equal(new Set(MENU.map((m) => m.id)).size, 3);
  for (const m of MENU) assert.ok(m.name.length > 0);
  const s = afterOpening();
  assert.equal(D.order(s, 'latte'), false);
  assert.equal(s.phase, 'order');
  assert.equal(D.order(s, 'iced'), true);
  assert.equal(s.orders[1], 'iced');
});

test('沒有第六天：第 5 天放好帶回物之後什麼都不能再開始', () => {
  const s = afterOpening();
  for (let d = 1; d <= 5; d++) { if (s.phase === 'company') doCompany(s); oneCup(s); }
  assert.equal(s.phase, 'rest');
  assert.equal(s.day, D.LAST_DAY);
  assert.equal(D.order(s, 'dongshan'), false);
  assert.equal(D.placeTakeaway(s), false);
  assert.equal(D.openNotebook(s), false);
  assert.equal(D.dreamForDay(6), null);
  assert.equal(D.dreamForDay(0), null);
  // 存檔裡寫第 6 天：當作壞檔，從頭開始（不會出現第六天）
  const bad = { ...JSON.parse(JSON.stringify(s)), day: 6, phase: 'order' };
  assert.equal(D.normalize(bad).day, 0);
});

test('防重複：連點同一步只算一次', () => {
  const s = afterOpening();
  assert.equal(D.order(s, 'dongshan'), true);
  assert.equal(D.order(s, 'black'), false);
  assert.equal(s.orders[1], 'dongshan');
  assert.equal(D.brewDone(s), true);
  assert.equal(D.brewDone(s), false);
  assert.equal(D.drink(s), true);
  assert.equal(D.drink(s), false);
  assert.equal(D.openNotebook(s), true);
  assert.equal(D.openNotebook(s), false);
  assert.deepEqual(s.dreamsOpened, [DREAM_ORDER[0]]);
  assert.equal(D.tapObject(s, 'tv'), true);
  D.tapObject(s, 'tv');
  assert.deepEqual(s.tapped[DREAM_ORDER[0]], ['tv']);
  assert.equal(D.leaveDream(s), true);
  assert.equal(D.leaveDream(s), false);
  assert.equal(D.placeTakeaway(s), true);
  assert.equal(D.placeTakeaway(s), false, '已經是第 2 天的 order，不能再放一次');
  assert.deepEqual(s.takeaways, [DREAM_ORDER[0]]);
  assert.equal(s.day, 2);
});

test('夢想互動：每條最多一次、只在夢想裡、不做也能回店、重新整理後不會再派發', () => {
  const s = afterOpening();
  assert.equal(D.interact(s), false, '點餐時不能互動');
  D.order(s, 'dongshan'); D.brewDone(s); D.drink(s); D.openNotebook(s);
  assert.equal(D.interact(s), true);
  assert.equal(D.interact(s), false, '同一條只算一次');
  assert.deepEqual(s.interacted, [DREAM_ORDER[0]]);
  const r = reload(s);
  assert.deepEqual(r.interacted, [DREAM_ORDER[0]], '重新整理後記得做過');
  assert.equal(D.interact(r), false, '讀回來也不能再做一次');
  D.leaveDream(s); D.placeTakeaway(s);
  assert.deepEqual(s.takeaways, [DREAM_ORDER[0]], '帶回物還是只有一樣');
  // 第 2 天不做互動直接回店
  D.order(s, 'dongshan'); D.brewDone(s); D.drink(s); D.openNotebook(s);
  assert.equal(D.leaveDream(s), true);
  assert.deepEqual(s.interacted, [DREAM_ORDER[0]]);
  // 竄改：未來天數的互動不採信
  const raw = JSON.parse(JSON.stringify(s));
  raw.interacted = [DREAM_ORDER[4], DREAM_ORDER[0]];
  assert.deepEqual(D.normalize(raw).interacted, [DREAM_ORDER[0]]);
});

test('回店之後不需要再點：return 只差 placeTakeaway 一步，由畫面自己呼叫', () => {
  const s = afterOpening();
  D.order(s, 'dongshan'); D.brewDone(s); D.drink(s); D.openNotebook(s); D.leaveDream(s);
  assert.equal(s.phase, 'return');
  assert.equal(D.placeTakeaway(s), true);
  assert.equal(s.phase, 'order');
  assert.ok(D.RETURN_SHOW_MS > 0);
});

test('不要求點完所有物件才能回店', () => {
  const s = afterOpening();
  D.order(s, 'dongshan'); D.brewDone(s); D.drink(s); D.openNotebook(s);
  assert.equal(D.leaveDream(s), true);
});

test('重新整理：每個 phase 存檔讀回來都在同一步，不會重複派發夢想或帶回物', () => {
  const s = afterOpening();
  const check = () => {
    const r = reload(s);
    assert.equal(r.phase, s.phase);
    assert.equal(r.day, s.day);
    assert.deepEqual(r.dreamsOpened, s.dreamsOpened);
    assert.deepEqual(r.takeaways, s.takeaways);
    assert.deepEqual(r.interacted, s.interacted);
    assert.deepEqual(r.company, s.company);
    assert.deepEqual(r.opening, s.opening);
    return r;
  };
  for (let d = 1; d <= 5; d++) {
    if (s.phase === 'company') {
      check();
      for (const st of D.COMPANY_STEPS.slice(1)) { D.companyStep(s, st); check(); }
      D.finishCompany(s);
    }
    check();
    D.order(s, 'black', 5000);
    const r = check();
    assert.equal(r.brewStartedAt, 5000, '機關從原本開始的時間接著播');
    D.brewDone(s); check();
    D.drink(s); check();
    D.openNotebook(s);
    const rr = check();
    assert.equal(D.openNotebook(rr), false, '讀回來不會再翻一次');
    D.leaveDream(s); check();
    D.placeTakeaway(s); check();
  }
  assert.equal(check().phase, 'rest');
});

test('重新整理：開場每一幕都接著原本那一幕', () => {
  const s = D.newState();
  for (const act of D.OPENING_ACTS.slice(1)) {
    D.setOpeningAct(s, act);
    if (act === 'deshu') s.opening.deshuLine = 2;
    const r = reload(s);
    assert.equal(r.phase, 'opening');
    assert.equal(r.opening.act, act);
  }
  assert.equal(reload(s).opening.deshuLine, 2);
});

test('讀檔檢查：壞檔、舊版存檔一律從頭開始（不遷移）', () => {
  assert.deepEqual(D.normalize(null), D.newState());
  assert.deepEqual(D.normalize('x'), D.newState());
  assert.deepEqual(D.normalize({ v: 99, day: 2, phase: 'order' }), D.newState());
  // 第一版存檔的樣子
  assert.deepEqual(D.normalize({ version: 3, flags: { seenOpening: true }, stats: { cups: 9 } }), D.newState());
  assert.deepEqual(D.normalize({ v: 1, day: 2, phase: 'opening' }), D.newState(), '第 2 天不會是開場');
  // 夢想清單被竄改：只留第 1～day 天、照固定順序
  const s = afterOpening();
  oneCup(s);
  const raw = JSON.parse(JSON.stringify(s));
  raw.dreamsOpened = [DREAM_ORDER[4], DREAM_ORDER[0], 'nope'];
  raw.takeaways = [DREAM_ORDER[3], DREAM_ORDER[0], DREAM_ORDER[0]];
  const r = D.normalize(raw);
  assert.deepEqual(r.dreamsOpened, [DREAM_ORDER[0]]);
  assert.deepEqual(r.takeaways, [DREAM_ORDER[0]]);
});

test('v3 存檔用獨立的 localStorage 鍵，不碰第一版的 dream-cafe.save', () => {
  assert.equal(SAVE_KEY, 'dream-cafe.v3a');
  assert.notEqual(SAVE_KEY, 'dream-cafe.save');
});
