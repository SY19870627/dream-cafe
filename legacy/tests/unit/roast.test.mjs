// 烘豆（承峰 11/6：「我希望你直接完成這兩項 烘豆……」，D217；存檔第 11 版）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as RO from '../../src/roast.js';
import * as MN from '../../src/menu.js';
import * as FV from '../../src/favorites.js';
import * as TS from '../../src/tasting.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';
import { temperature } from '../../src/tasks.js';

const T0 = new Date(2026, 10, 6, 21, 30).getTime();
const newSave = () => { const s = defaultSave(T0); giveStarters(s); s.flags.seenOpening = true; return s; };

test('存檔第 11 版：新存檔有 roast，架上還沒有這一批', () => {
  assert.ok(SAVE_VERSION >= 11);
  const s = newSave();
  assert.deepEqual(s.roast, { batch: null });
  assert.equal(RO.levelOf(s), '');
  assert.equal(RO.roastNote(s, 'dongshan'), '');
  assert.equal(RO.brewLine(s, 'dongshan'), '');
});

test('第 10 版舊存檔升上來：補 roast（null），黑板、菜單本、試咖啡、熟客最愛、溫度都不變', () => {
  const old = newSave();
  MN.unlock(old, 'black', 3); MN.write(old, 'black', 3);
  TS.addTuneRecord(old, { item: 'dongshan', params: TS.DEFAULT_PARAMS, day: 2 });
  old.favorites.zhe = { stage: 1, misses: 0, servedDay: 0, told: 1 };
  old.version = 10;
  delete old.roast;
  const before = JSON.parse(JSON.stringify(old));
  const s = migrate(JSON.parse(JSON.stringify(old)), T0);
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(s.roast, { batch: null });
  assert.deepEqual(s.menu, before.menu);
  assert.deepEqual(s.tasting, before.tasting);
  assert.deepEqual(s.favorites, before.favorites);
  assert.equal(temperature(s), temperature(before));
  // 已經是第 11 版、架上有一批的存檔：讀進來照舊
  RO.roastBatch(s, 'dark', 4, 9);
  const again = migrate(JSON.parse(JSON.stringify(s)), T0);
  assert.equal(again.roast.batch.level, 'dark');
  assert.equal(again.roast.batch.day, 4);
});

test('選項：淺一點、深一點，安全的「剛好」放最下面', () => {
  const c = RO.roastChoices();
  assert.deepEqual(c.map((x) => x.level), ['light', 'dark', 'medium']);
  assert.equal(c[c.length - 1].text, RO.ROAST.options.medium);
});

test('烘一批：換掉架上那一批（不累積、不計數），只有東山的豆', () => {
  const s = newSave();
  const b = RO.roastBatch(s, 'light', 3, 100);
  assert.deepEqual(b, { bean: 'dongshan', level: 'light', day: 3, t: 100, told: false });
  RO.roastBatch(s, 'dark', 5, 200);
  assert.equal(s.roast.batch.level, 'dark');
  assert.ok(!Array.isArray(s.roast.batch) && Object.keys(s.roast).length === 1, '只有「現在架上是哪一批」，沒有庫存');
  assert.equal(RO.roastBatch(s, 'burnt', 6), null);
  assert.equal(s.roast.batch.level, 'dark');
  assert.equal(RO.levelOf(s, 'black'), '');
});

test('菜單本：只有東山的豆那一頁多一句；黑板、品項、boardDrinks 不變', () => {
  const s = newSave();
  const board = [...s.menu.board], items = JSON.stringify(s.menu.items);
  RO.roastBatch(s, 'light', 3);
  assert.match(RO.roastNote(s, 'dongshan'), /淺焙/);
  assert.match(RO.roastNote(s, 'dongshan'), /第 3 天/);
  assert.equal(RO.roastNote(s, 'black'), '');
  assert.deepEqual(s.menu.board, board);
  assert.equal(JSON.stringify(s.menu.items), items);
  assert.deepEqual(MN.boardDrinks(s), ['dongshan']);
  assert.equal(MN.boardLines(s)[0].text, '東山 日曬');
});

test('德叔沖東山的豆時說一次是哪一批；說過就不再說；換了新的一批再說一次', () => {
  const s = newSave();
  RO.roastBatch(s, 'medium', 2);
  assert.equal(RO.brewLine(s, 'black'), '');
  assert.equal(RO.brewLine(s, 'dongshan'), RO.ROAST.brew.medium);
  RO.markBrewTold(s);
  assert.equal(RO.brewLine(s, 'dongshan'), '');
  RO.roastBatch(s, 'dark', 3);
  assert.equal(RO.brewLine(s, 'dongshan'), RO.ROAST.brew.dark);
});

test('熟客最愛：烘焙度不是答案（東山的豆照樣算對）', () => {
  const s = newSave();
  for (let i = 1; i <= 4; i++) s.regulars.zhe.milestones.push(i);
  s.favorites.zhe.stage = 1;
  RO.roastBatch(s, 'dark', 9);
  assert.ok(FV.isRight(s, 'zhe', 'dongshan', false));
});

test('時間與顏色：1 分半到 2 分鐘；豆子從淡綠走到這一批的顏色', () => {
  for (const l of RO.LEVELS) {
    const sec = RO.roastSeconds(l);
    assert.ok(sec >= 80 && sec <= 120, `${l} ${sec}`);
  }
  assert.ok(RO.roastSeconds('dark') > RO.roastSeconds('light'));
  assert.equal(RO.beanColorAt('dark', 0), RO.BEAN_COLOR.green);
  assert.equal(RO.beanColorAt('dark', 1), RO.BEAN_COLOR.dark);
  assert.match(RO.beanColorAt('light', 0.5), /^#[0-9a-f]{6}$/);
});

test('文字：沒有數量、庫存、催促、評分', () => {
  const all = RO.allRoastLines();
  assert.ok(all.length > 10);
  for (const t of all) {
    assert.equal(typeof t, 'string');
    assert.ok(t.length > 0);
    assert.doesNotMatch(t, /KPI|不划算|庫存|存量|剩下|用完|過期|快點|趕快|今天還沒|分數|評分|失敗|烤焦|簽到/);
  }
});
