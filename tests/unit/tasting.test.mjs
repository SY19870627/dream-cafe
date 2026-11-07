// 試咖啡參數微調（承峰 11/5 夜：粉水／水溫／研磨／技法 → 登錄 → 定案寫 brewProfile；存檔第 10 版）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as TS from '../../src/tasting.js';
import * as MN from '../../src/menu.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';
import { temperature } from '../../src/tasks.js';

const T0 = new Date(2026, 10, 1, 21, 30).getTime();
const newSave = () => { const s = defaultSave(T0); giveStarters(s); s.flags.seenOpening = true; return s; };
const reach = (s, who, n) => { for (let i = 1; i <= n; i++) if (!s.regulars[who].milestones.includes(i)) s.regulars[who].milestones.push(i); };

test('存檔第 10 版：新存檔有 tasting（紀錄是空的）', () => {
  assert.ok(SAVE_VERSION >= 10); // 第 11 版（烘豆）見 roast.test.mjs
  const s = newSave();
  assert.deepEqual(s.tasting, { trials: {}, records: [], nextId: 1, guided: false, offerHint: false });
  assert.equal(s.menu.items.dongshan.brewProfile, null);
});

test('第 8／9 版舊存檔升上來：補 tasting、legacy 參數、已定案寫 brewProfile', () => {
  const old = newSave();
  reach(old, 'yuan', 5); reach(old, 'zhe', 6);
  MN.unlock(old, 'black', 3); MN.write(old, 'black', 3);
  old.favorites.yuan = { stage: 2, misses: 1, servedDay: 9, told: 2 };
  old.photos.push({ id: 'yuan-1', day: 5, t: 0, item: 'black', snack: false });
  old.version = 8;
  delete old.tasting;
  const before = JSON.parse(JSON.stringify(old));
  const s = migrate(JSON.parse(JSON.stringify(old)), T0);
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(s.tasting, { trials: {}, records: [], nextId: 1, guided: false, offerHint: false });
  assert.deepEqual(s.menu.board, before.menu.board);
  assert.deepEqual(s.favorites, before.favorites);
  assert.equal(temperature(s), temperature(before));
  assert.equal(TS.pendingOffer(s), 'kiln');

  // 模擬第 9 版紀錄（無 params）→ legacy + 定案後有 brewProfile
  const v9 = newSave();
  reach(v9, 'yuan', 3);
  v9.version = 9;
  v9.tasting = { trials: { kiln: { offered: 7, tried: 7 } }, records: [{
    id: 1, day: 7, t: 0, part: 'day', src: 'trial', recipe: 'kiln',
    cups: [{ item: 'kiln', flavor: { acid: 2, sweet: 3, bitter: 1 }, line: '舊句' }],
    liked: false, settled: 7, told: true,
  }], nextId: 2, guided: true, offerHint: true };
  MN.unlock(v9, 'kiln', 7, 0, { from: 'trial:kiln', board: true });
  delete v9.menu.items.kiln.brewProfile;
  const m = migrate(JSON.parse(JSON.stringify(v9)), T0);
  assert.equal(m.version, SAVE_VERSION);
  assert.equal(m.tasting.records[0].legacy, true);
  assert.ok(m.tasting.records[0].params.ratio);
  assert.ok(m.menu.items.kiln.brewProfile.ratio);
});

test('配方只從劇情長出來：予安第三幕之後龍眼窯、阿哲第五幕之後阿哲的新法；帶預設參數', () => {
  const s = newSave();
  assert.deepEqual(TS.openRecipes(s), []);
  reach(s, 'yuan', 3);
  assert.deepEqual(TS.openRecipes(s), ['kiln']);
  assert.deepEqual(TS.defaultParamsFor('kiln', 'kiln'), TS.normalizeParams(TS.RECIPES.kiln.params, 'kiln'));
  reach(s, 'zhe', 5);
  assert.deepEqual(TS.openRecipes(s), ['kiln', 'zhe-new']);
  for (const id of TS.RECIPE_IDS) {
    assert.ok(MN.isDrink(TS.RECIPES[id].item), id);
    assert.equal(MN.ITEMS[TS.RECIPES[id].item].from, `trial:${id}`);
  }
  TS.markOffered(s, 'kiln', 6);
  assert.equal(TS.pendingOffer(s), 'zhe-new');
  assert.deepEqual(TS.againRecipes(s), ['kiln']);
});

test('參數四項：粉水比、水溫、研磨、技法；冰飲技法另開、隱藏 °C', () => {
  assert.deepEqual(TS.RATIOS, ['1:18', '1:16', '1:15', '1:14', '1:12']);
  assert.deepEqual(TS.TEMPS, [88, 90, 92, 94, 96]);
  assert.ok(TS.GRINDS.includes('med'));
  assert.deepEqual(TS.techniquesFor('dongshan'), TS.TECH_HOT);
  assert.deepEqual(TS.techniquesFor('iced'), TS.TECH_ICE);
  const ice = TS.normalizeParams({ ratio: '1:15', temp: 92, grind: 'med', technique: 'pulse' }, 'iced');
  assert.equal(ice.temp, 0);
  assert.equal(ice.technique, 'ice-pour');
  assert.equal(TS.labelParam('temp', 0, 'iced'), TS.TASTE.tempIce);
  const hot = TS.normalizeParams({ technique: 'ice-chill' }, 'dongshan');
  assert.equal(hot.technique, 'pulse');
});

test('登錄寫測試紀錄：參數＋口感＋目標品項；不碰溫度、菜單本、黑板', () => {
  const s = newSave();
  reach(s, 'yuan', 3);
  const temp = temperature(s);
  const r = TS.addTuneRecord(s, { item: 'kiln', recipe: 'kiln', params: { ratio: '1:12', temp: 96, grind: 'fine', technique: 'one-pour' }, day: 7, t: 123, part: 'night' });
  assert.equal(r.id, 1);
  assert.equal(r.src, 'tune');
  assert.equal(r.item, 'kiln');
  assert.equal(r.settled, 0);
  assert.deepEqual(r.params.ratio, '1:12');
  assert.ok(r.flavor.acid >= 1 && r.flavor.acid <= 3);
  assert.ok(r.line.length > 0);
  const L = TS.recordLines(r);
  assert.equal(L.name, '龍眼窯特調');
  assert.ok(L.bean.includes('粉水') && L.bean.includes('研磨') && L.bean.includes('技法'));
  assert.ok(!/分|星|最佳|失敗/.test(Object.values(L).join('')));
  assert.equal(temperature(s), temp);
  assert.ok(!MN.unlocked(s, 'kiln'));
  assert.equal(TS.toggleLike(s, 1), true);
});

test('定案：寫入 brewProfile；新品收進菜單本並寫上黑板；已在黑板只換沖法', () => {
  const s = newSave();
  const r = TS.addTuneRecord(s, { item: 'kiln', recipe: 'kiln', params: TS.RECIPES.kiln.params, day: 7 });
  assert.equal(TS.settle(s, r.id, 8), 'done');
  assert.ok(MN.unlocked(s, 'kiln') && MN.onBoard(s, 'kiln'));
  assert.deepEqual(s.menu.items.kiln.brewProfile, TS.normalizeParams(TS.RECIPES.kiln.params, 'kiln'));
  assert.ok(TS.recordLines(r).settled.includes('沖法換成這一版'));

  // 已在黑板的東山：只更新沖法
  const r2 = TS.addTuneRecord(s, { item: 'dongshan', params: { ratio: '1:12', temp: 88, grind: 'coarse', technique: 'one-pour' }, day: 9 });
  assert.equal(TS.settle(s, r2.id, 9), 'profile');
  assert.deepEqual(s.menu.items.dongshan.brewProfile.ratio, '1:12');
  assert.ok(MN.onBoard(s, 'dongshan'));
  assert.ok(!MN.brewProfileNote(s, 'dongshan').includes('失敗'));
  assert.ok(MN.brewProfileNote(s, 'dongshan').includes('店內沖法'));
});

test('定案時黑板寫滿：換一行；先不寫拿掉菜單本', () => {
  const s = newSave();
  for (const id of ['black', 'iced', 'longan']) MN.unlock(s, id, 3, 0, { board: false });
  for (const id of ['black', 'iced', 'longan']) MN.write(s, id, 3);
  assert.ok(MN.boardFull(s));
  const r = TS.addTuneRecord(s, { item: 'zhe-new', recipe: 'zhe-new', params: TS.RECIPES['zhe-new'].params, day: 7 });
  assert.equal(TS.settle(s, r.id, 7), 'full');
  assert.ok(MN.unlocked(s, 'zhe-new') && !MN.onBoard(s, 'zhe-new'));
  assert.equal(TS.cancelSettle(s, r.id), true);
  assert.ok(!MN.unlocked(s, 'zhe-new'));
  assert.equal(TS.settle(s, r.id, 7), 'full');
  assert.equal(TS.settle(s, r.id, 7, 0, 'iced'), 'done');
  assert.deepEqual(s.menu.board, ['dongshan', 'black', 'zhe-new', 'longan']);
  assert.ok(s.menu.items['zhe-new'].brewProfile);
});

test('德叔提一次：未定案紀錄隔天提；一張最多一次', () => {
  const s = newSave();
  const a = TS.addTuneRecord(s, { item: 'dongshan', params: TS.DEFAULT_PARAMS, day: 7 });
  assert.equal(TS.pendingHint(s, 7), null);
  assert.equal(TS.pendingHint(s, 8)?.id, a.id);
  TS.markHinted(s, 8);
  assert.equal(TS.pendingHint(s, 8), null);
  const c = TS.addTuneRecord(s, { item: 'dongshan', params: TS.DEFAULT_PARAMS, day: 8 });
  TS.markHinted(s, 8);
  assert.equal(TS.pendingHint(s, 9)?.id, c.id);
  TS.settle(s, c.id, 9);
  assert.equal(TS.pendingHint(s, 10), null);
});

test('口感由參數算出：無分數；預設參數用 defaultLine', () => {
  const f = TS.flavorFromParams({ ratio: '1:12', temp: 96, grind: 'fine', technique: 'one-pour' }, 'dongshan');
  assert.ok(f.acid >= 1 && f.bitter >= 1);
  assert.equal(TS.lineFromParams(TS.DEFAULT_PARAMS, 'dongshan'), TS.TASTE.defaultLine);
  assert.ok(TS.lineFromParams({ ratio: '1:18', temp: 88, grind: 'coarse', technique: 'pulse' }, 'dongshan').length > 2);
});

test('文字：沒有分數、評分、催促；四句教學改寫為參數微調', () => {
  const all = TS.allTastingLines();
  assert.ok(all.length > 20);
  for (const t of all) {
    assert.equal(typeof t, 'string');
    assert.ok(t.length > 0);
    assert.ok(!/分數|評分|星等|失敗|趕快|今天還沒/.test(t), t);
  }
  assert.match(TS.TASTE.guide, /吧台/);
  assert.match(TS.TASTE.offerHint, /撥一撥|沒有錯/);
  assert.match(TS.TASTE.later, /叫我一聲/);
  assert.match(TS.TASTE.recordsHelp, /粉水比|定成/);
  const s = newSave();
  TS.markGuided(s); TS.markOfferHint(s);
  assert.equal(s.tasting.guided && s.tasting.offerHint, true);
});

test('可登錄品項含菜單本飲料與試作中劇情品', () => {
  const s = newSave();
  reach(s, 'yuan', 3);
  const ids = TS.tuneItems(s).map((x) => x.id);
  assert.ok(ids.includes('dongshan'));
  assert.ok(ids.includes('kiln'));
  assert.ok(TS.tuneItems(s).find((x) => x.id === 'kiln').draft);
});

test('紀錄最多留 30 張：定案過的不刪', () => {
  const s = newSave();
  TS.addTuneRecord(s, { item: 'dongshan', params: TS.DEFAULT_PARAMS, day: 1 });
  TS.settle(s, 1, 1);
  for (let i = 0; i < 40; i++) TS.addTuneRecord(s, { item: 'dongshan', params: TS.DEFAULT_PARAMS, day: 2 + i });
  assert.equal(s.tasting.records.length, TS.RECORDS_KEEP);
  assert.ok(TS.recordById(s, 1));
});
