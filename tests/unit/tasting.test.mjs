// 試咖啡與測試紀錄（承峰 11/5：「先做試咖啡」「每日菜單就是黑板，沿用昨天，有新紀錄時德叔提一次」，D206、D207；src/tasting.js）、
// 存檔第 9 版的遷移
import test from 'node:test';
import assert from 'node:assert/strict';
import * as TS from '../../src/tasting.js';
import * as MN from '../../src/menu.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';
import { temperature } from '../../src/tasks.js';

const T0 = new Date(2026, 10, 1, 21, 30).getTime();
const newSave = () => { const s = defaultSave(T0); giveStarters(s); s.flags.seenOpening = true; return s; };
const reach = (s, who, n) => { for (let i = 1; i <= n; i++) if (!s.regulars[who].milestones.includes(i)) s.regulars[who].milestones.push(i); };

test('存檔第 9 版：新存檔有 tasting（紀錄是空的）', () => {
  assert.equal(SAVE_VERSION, 9);
  const s = newSave();
  assert.deepEqual(s.tasting, { trials: {}, records: [], nextId: 1 });
});

test('第 8 版的舊存檔升上來：紀錄是空的，黑板、菜單本、熟客最愛、照片、溫度照舊', () => {
  const old = newSave();
  reach(old, 'yuan', 5); reach(old, 'zhe', 6);
  MN.unlock(old, 'black', 3); MN.write(old, 'black', 3);
  old.favorites.yuan = { stage: 2, misses: 1, servedDay: 9, told: 2 };
  old.photos.push({ id: 'yuan-1', day: 5, t: 0, item: 'black', snack: false });
  old.version = 8;
  delete old.tasting;
  const before = JSON.parse(JSON.stringify(old));
  const s = migrate(JSON.parse(JSON.stringify(old)), T0);
  assert.equal(s.version, 9);
  assert.deepEqual(s.tasting, { trials: {}, records: [], nextId: 1 });
  assert.deepEqual(s.menu, before.menu);
  assert.deepEqual(s.favorites, before.favorites);
  assert.deepEqual(s.photos, before.photos);
  assert.equal(temperature(s), temperature(before));
  // 開放配方的里程碑已經走過：德叔之後照樣提一次
  assert.equal(TS.pendingOffer(s), 'kiln');
  // 第 9 版的存檔再讀一次，紀錄留著
  TS.addRecord(s, 'kiln', 10, 0);
  const again = migrate(JSON.parse(JSON.stringify(s)), T0);
  assert.equal(again.tasting.records.length, 1);
});

test('配方只從劇情長出來：予安第三幕之後龍眼窯特調、阿哲第五幕之後阿哲的新法', () => {
  const s = newSave();
  assert.deepEqual(TS.openRecipes(s), []);
  assert.equal(TS.pendingOffer(s), null);
  reach(s, 'yuan', 3);
  assert.deepEqual(TS.openRecipes(s), ['kiln']);
  reach(s, 'zhe', 5);
  assert.deepEqual(TS.openRecipes(s), ['kiln', 'zhe-new']);
  for (const id of TS.RECIPE_IDS) {
    const it = MN.ITEMS[TS.RECIPES[id].item];
    assert.ok(it && MN.isDrink(TS.RECIPES[id].item), id);
    assert.equal(it.from, `trial:${id}`);
  }
  // 德叔提一次；提過的配方坐著點德叔可以再試
  assert.deepEqual(TS.againRecipes(s), []);
  TS.markOffered(s, 'kiln', 6);
  assert.equal(TS.pendingOffer(s), 'zhe-new');
  assert.deepEqual(TS.againRecipes(s), ['kiln']);
  TS.markOffered(s, 'kiln', 9);
  assert.equal(s.tasting.trials.kiln.offered, 6, '第一次提的那天不變');
});

test('試做完自動一張紀錄：欄位全部由程式產生，風味是描述（固定的），不碰溫度與熟客最愛', () => {
  const s = newSave();
  reach(s, 'yuan', 3);
  const temp = temperature(s);
  const fav = JSON.parse(JSON.stringify(s.favorites));
  const r = TS.addRecord(s, 'kiln', 7, 123, 'night');
  assert.equal(r.id, 1);
  assert.equal(r.src, 'trial');
  assert.equal(r.settled, 0);
  assert.equal(r.liked, false);
  assert.deepEqual(r.cups[0].flavor, TS.RECIPES.kiln.flavor);
  const L = TS.recordLines(r);
  assert.equal(L.name, '龍眼窯特調');
  assert.ok(L.head.includes('第 7 天') && L.head.includes('下班後'));
  assert.ok(L.flavor.includes('酸') && L.flavor.includes('甜') && L.flavor.includes('苦'));
  assert.ok(!/分|星|最佳|失敗/.test(Object.values(L).join('')), '不是分數');
  assert.equal(L.settled, '');
  assert.equal(s.tasting.trials.kiln.tried, 7);
  // 同一杯每次一樣
  assert.deepEqual(TS.addRecord(s, 'kiln', 8).cups[0].flavor, r.cups[0].flavor);
  assert.equal(temperature(s), temp);
  assert.deepEqual(s.favorites, fav);
  assert.ok(!MN.unlocked(s, 'kiln'), '還沒定案，不在菜單本');
  assert.equal(TS.toggleLike(s, 1), true);
  assert.equal(TS.toggleLike(s, 1), false);
  // 新的在上面
  assert.deepEqual(TS.recordsNewest(s).map((x) => x.id), [2, 1]);
});

test('紀錄最多留 30 張：從最舊、沒定案的開始刪，定案過的不刪', () => {
  const s = newSave();
  TS.addRecord(s, 'kiln', 1);
  TS.settle(s, 1, 1);
  for (let i = 0; i < 40; i++) TS.addRecord(s, 'kiln', 2 + i);
  assert.equal(s.tasting.records.length, TS.RECORDS_KEEP);
  assert.ok(TS.recordById(s, 1), '定案過的那張留著');
});

test('定案：收進菜單本並寫上黑板（每日菜單就是黑板）', () => {
  const s = newSave();
  const r = TS.addRecord(s, 'kiln', 7);
  assert.equal(TS.settle(s, r.id, 8), 'done');
  assert.ok(MN.unlocked(s, 'kiln') && MN.onBoard(s, 'kiln'));
  assert.equal(s.menu.items.kiln.from, 'trial:kiln');
  assert.equal(s.menu.items.kiln.told, true, '老闆自己定的，德叔不再提');
  assert.deepEqual(MN.pendingTell(s), []);
  assert.equal(r.settled, 8);
  assert.ok(TS.recordLines(r).settled.includes('第 8 天'));
  assert.ok(MN.boardDrinks(s).includes('kiln'), '德叔照黑板沖');
  // 擦掉以後再定案：照樣寫回黑板
  MN.erase(s, 'kiln');
  const r2 = TS.addRecord(s, 'kiln', 9);
  assert.equal(TS.settle(s, r2.id, 9), 'done');
  assert.ok(MN.onBoard(s, 'kiln'));
});

test('定案時黑板寫滿：走現有的換一行；「先不寫」把剛收進菜單本的拿掉；最後一杯喝的規則照舊', () => {
  const s = newSave();
  for (const id of ['black', 'iced', 'longan']) MN.unlock(s, id, 3, 0, { board: false });
  for (const id of ['black', 'iced', 'longan']) MN.write(s, id, 3);
  assert.ok(MN.boardFull(s));
  const r = TS.addRecord(s, 'zhe-new', 7);
  assert.equal(TS.settle(s, r.id, 7), 'full');
  assert.ok(MN.unlocked(s, 'zhe-new') && !MN.onBoard(s, 'zhe-new'), '換一行要先收進菜單本');
  assert.equal(r.settled, 0);
  assert.equal(TS.cancelSettle(s, r.id), true);
  assert.ok(!MN.unlocked(s, 'zhe-new'), '先不寫：不出現在菜單本');
  // 再按一次定案，選擦掉冰美式
  assert.equal(TS.settle(s, r.id, 7), 'full');
  assert.equal(TS.settle(s, r.id, 7, 0, 'iced'), 'done');
  assert.deepEqual(s.menu.board, ['dongshan', 'black', 'zhe-new', 'longan']);
  assert.equal(TS.cancelSettle(s, r.id), false, '定案過的不拿掉');
  // 最後一杯喝的擦不掉（menu.js 的規則不變）
  for (const id of ['black', 'zhe-new']) MN.erase(s, id);
  assert.equal(MN.canErase(s, 'dongshan'), false);
});

test('德叔提一次：還沒定案、不是今天做的紀錄，隔天提一次；一張最多一次，也不一張一張催', () => {
  const s = newSave();
  const a = TS.addRecord(s, 'kiln', 7);
  assert.equal(TS.pendingHint(s, 7), null, '當天不提（端上桌時已經說過記在紀錄了）');
  assert.equal(TS.pendingHint(s, 8)?.id, a.id);
  TS.addRecord(s, 'zhe-new', 7);
  assert.equal(TS.pendingHint(s, 8).recipe, 'zhe-new', '提最新的那張');
  TS.markHinted(s, 8);
  assert.equal(TS.pendingHint(s, 8), null);
  assert.equal(TS.pendingHint(s, 30), null, '過了很多天也不再提');
  // 今天做的那張不算提過，明天才提
  const c = TS.addRecord(s, 'kiln', 8);
  TS.markHinted(s, 8);
  assert.equal(TS.pendingHint(s, 9)?.id, c.id);
  // 定案過的不提
  TS.settle(s, c.id, 9);
  assert.equal(TS.pendingHint(s, 10), null);
  // 已經在黑板上（例如從菜單本寫上去）的也不提
  const d = TS.addRecord(s, 'kiln', 10);
  assert.equal(TS.pendingHint(s, 11), null);
  assert.equal(d.told, false);
});

test('文字：試咖啡的字都有，沒有分數、評分、催促的詞', () => {
  const all = TS.allTastingLines();
  assert.ok(all.length > 20);
  for (const t of all) {
    assert.equal(typeof t, 'string');
    assert.ok(t.length > 0);
    assert.ok(!/分數|評分|星等|失敗|趕快|今天還沒/.test(t), t);
  }
});
