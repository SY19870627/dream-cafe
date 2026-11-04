// 幫熟客找到最愛的咖啡、相簿（src/favorites.js，承峰 11/4 Q75～Q78，方案二）：階段開放、端對／端錯、一天一杯、錯兩次的提示、
// 找到最愛的溫度、相簿的空格、存檔 7 → 8 升級
import test from 'node:test';
import assert from 'node:assert/strict';
import * as FV from '../../src/favorites.js';
import * as MN from '../../src/menu.js';
import * as S from '../../src/story.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';
import { TASKS, temperature, completeTasks, FAVORITE_TEMP, GOAL_TEMP, stageNoteText, STAGE_NOTE_FULL } from '../../src/tasks.js';
import * as F from '../../src/farewell.js';

const T0 = new Date(2026, 10, 4, 9, 0).getTime();
const newSave = () => { const s = defaultSave(T0); giveStarters(s); s.flags.seenOpening = true; return s; };
// 讓某位熟客的里程碑發生（照順序），品項跟著解鎖
const reach = (s, who, n, day = 2) => { for (const m of S.MILESTONES.filter((x) => x.who === who && x.n <= n)) S.complete(s, m, day); };
// 一次走完一位熟客的三段（每段換一天）
function finish(s, who, start = 10) {
  reach(s, who, 6, start);
  for (const id of MN.ITEM_IDS) MN.unlock(s, id, start, 0, { board: false });
  for (let k = 0; FV.current(s, who); k++) {
    const st = FV.current(s, who);
    const drink = who === 'zhe' && st.n === 1 ? 'dongshan' : who === 'kevin' && st.n === 3 ? FV.lastBeanOf(s) : { yuan: ['black', 'cocoa', 'black'], zhe: [null, 'dongshan', 'zhe-beans'], kevin: ['iced', 'dongshan', null] }[who][st.n - 1];
    const r = FV.serve(s, who, drink, start + k + 1, 0, true);
    assert.ok(r?.right, `${who} 第 ${st.n} 段`);
  }
}

test('存檔第 8 版：新存檔有 favorites（三位都從第 0 段開始）、photos 空的、stats.lastBean', () => {
  const s = newSave();
  assert.equal(SAVE_VERSION, 8);
  for (const w of FV.FAV_IDS) assert.deepEqual(s.favorites[w], { stage: 0, misses: 0, servedDay: 0, told: 0 });
  assert.deepEqual(s.photos, []);
  assert.equal(s.stats.lastBean, '');
  assert.equal(FV.PHOTOS.length, 9, '每人三段、九張照片（Q75）');
  assert.deepEqual(FV.PHOTOS.map((p) => p.file).slice(0, 3), ['photo_yuan_1', 'photo_yuan_2', 'photo_yuan_3']);
});

test('階段開放：每段跟在一個里程碑後面、照順序；還沒開放時不能端', () => {
  const s = newSave();
  for (const w of FV.FAV_IDS) assert.equal(FV.isOpen(s, w), false, `${w} 見面之前沒有開放`);
  reach(s, 'yuan', 1);
  assert.equal(FV.isOpen(s, 'yuan'), true, '予安第一幕之後開放第一段');
  assert.equal(FV.current(s, 'yuan').n, 1);
  assert.ok(FV.serve(s, 'yuan', 'black', 2).right);
  assert.equal(FV.isOpen(s, 'yuan'), false, '第二段要等第四幕（退稿）');
  assert.equal(FV.serve(s, 'yuan', 'cocoa', 3), null, '沒開放：不能端');
  reach(s, 'yuan', 4, 8);
  assert.equal(FV.isOpen(s, 'yuan'), true);
  assert.equal(FV.current(s, 'yuan').n, 2);
  // 每段的開放條件（提案第三節的表）
  assert.deepEqual(FV.FAV_IDS.map((w) => FV.STAGES[w].map((x) => x.after)), [[1, 4, 5], [1, 4, 6], [1, 5, 6]]);
});

test('端對：熟客說那一句、拿到照片、進到下一段；第一張照片 first 為 true', () => {
  const s = newSave();
  reach(s, 'kevin', 1, 3);
  const r = FV.serve(s, 'kevin', 'iced', 3, 123);
  assert.equal(r.right, true);
  assert.equal(r.line, FV.STAGES.kevin[0].ok);
  assert.equal(r.photo, 'kevin-1');
  assert.equal(r.first, true);
  assert.equal(r.favorite, false);
  assert.deepEqual(s.photos, [{ id: 'kevin-1', day: 3, t: 123, item: 'iced', snack: false }]);
  assert.equal(s.favorites.kevin.stage, 1);
  reach(s, 'yuan', 1);
  const r2 = FV.serve(s, 'yuan', 'black', 3);
  assert.equal(r2.first, false, '第二張以後不是 first');
});

test('端錯：熟客照喝、說一句溫和的話；不拿照片、不扣東西、段落不變', () => {
  const s = newSave();
  reach(s, 'yuan', 1);
  const before = JSON.stringify({ fund: s.fund, tasks: s.tasks, menu: s.menu });
  const r = FV.serve(s, 'yuan', 'dongshan', 2);
  assert.equal(r.right, false);
  assert.ok(FV.MISS.yuan.includes(r.line));
  assert.equal(r.photo, null);
  assert.equal(r.hint, '', '第一次端錯沒有德叔的提示');
  assert.equal(s.favorites.yuan.stage, 0);
  assert.equal(s.favorites.yuan.misses, 1);
  assert.deepEqual(s.photos, []);
  assert.equal(JSON.stringify({ fund: s.fund, tasks: s.tasks, menu: s.menu }), before, '基金、任務、菜單都不變');
  for (const t of FV.MISS.yuan.concat(FV.MISS.zhe, FV.MISS.kevin)) assert.doesNotMatch(t, /端錯|猜錯|失敗|可惜|再試/);
});

test('一天一位熟客只收一杯（Q80 預設）：今天收過了就不能再端，明天可以；別的熟客不受影響', () => {
  const s = newSave();
  reach(s, 'yuan', 1); reach(s, 'kevin', 1, 3);
  assert.ok(FV.serve(s, 'yuan', 'iced', 5));
  assert.equal(FV.canServe(s, 'yuan', 5), false);
  assert.equal(FV.serve(s, 'yuan', 'black', 5), null, '同一天第二杯不收');
  assert.equal(FV.canServe(s, 'kevin', 5), true, '凱文今天還沒收過');
  assert.equal(FV.canServe(s, 'yuan', 6), true, '隔天可以');
  assert.ok(FV.serve(s, 'yuan', 'black', 6).right);
});

test('同一段錯兩次：德叔說一句更靠近的話；之後每次端錯都說；端對以後 misses 歸零', () => {
  const s = newSave();
  reach(s, 'yuan', 1);
  assert.equal(FV.serve(s, 'yuan', 'dongshan', 2).hint, '');
  const r = FV.serve(s, 'yuan', 'dongshan', 3);
  assert.equal(r.hint, FV.STAGES.yuan[0].hint);
  assert.equal(FV.serve(s, 'yuan', 'dongshan', 4).hint, FV.STAGES.yuan[0].hint);
  assert.ok(FV.serve(s, 'yuan', 'black', 5).right);
  assert.equal(s.favorites.yuan.misses, 0);
  // 凱文第三段的提示寫出老闆上一杯的名字
  const k = newSave();
  reach(k, 'kevin', 6, 15);
  k.favorites.kevin.stage = 2;
  k.stats.lastBean = 'cocoa';
  FV.serve(k, 'kevin', 'dongshan', 16);
  assert.match(FV.serve(k, 'kevin', 'dongshan', 17).hint, /熱可可/);
});

test('三杯最愛（Q79 預設）：予安黑咖啡要配龍眼乾、阿哲的豆、凱文是老闆最近一次喝的那杯', () => {
  const s = newSave();
  reach(s, 'yuan', 5, 16);
  s.favorites.yuan.stage = 2;
  assert.equal(FV.isRight(s, 'yuan', 'black', false), false, '黑板上沒有龍眼乾：只有黑咖啡不算');
  assert.equal(FV.isRight(s, 'yuan', 'black', true), true);
  assert.equal(FV.isRight(s, 'yuan', 'cocoa', true), false);
  // 阿哲第一段：任何喝的＋龍眼乾
  const z = newSave();
  reach(z, 'zhe', 1, 1);
  assert.equal(FV.isRight(z, 'zhe', 'dongshan', false), false);
  assert.equal(FV.isRight(z, 'zhe', 'dongshan', true), true);
  assert.equal(MN.onBoard(z, 'longan'), true, '阿哲第一幕龍眼乾自己寫上黑板：第一段幾乎一端就對（教玩家可以端一杯）');
  // 凱文第三段：老闆最近一次喝的那杯；沒有紀錄就是東山的豆
  const k = newSave();
  reach(k, 'kevin', 6, 15);
  k.favorites.kevin.stage = 2;
  assert.equal(FV.lastBeanOf(k), 'dongshan');
  assert.equal(FV.isRight(k, 'kevin', 'dongshan'), true);
  k.diary.push({ day: 14, t: 0, bean: 'black', text: '' });
  assert.equal(FV.lastBeanOf(k), 'black', '沒有 lastBean 時看咖啡日記最後一篇');
  k.stats.lastBean = 'iced';
  assert.equal(FV.isRight(k, 'kevin', 'iced'), true);
  assert.equal(FV.isRight(k, 'kevin', 'dongshan'), false);
});

test('溫度（Q78）：只有第三段（最愛）每位 +0.5°C；前兩段不加；和任務加起來最多 37°C', () => {
  const s = newSave();
  reach(s, 'yuan', 1);
  FV.serve(s, 'yuan', 'black', 2);
  assert.equal(temperature(s), 20, '第一段不加溫度');
  finish(s, 'yuan');
  assert.equal(s.favorites.yuan.stage, 3);
  assert.equal(temperature(s), 20 + FAVORITE_TEMP);
  finish(s, 'zhe'); finish(s, 'kevin');
  assert.equal(FV.favoritesFound(s), 3);
  assert.equal(temperature(s), 21.5, '三位最多 +1.5°C');
  // 任務全部完成：還是 37°C（上限不變）
  s.tasks = TASKS.map((t) => ({ id: t.id, t: 0, day: 30 }));
  assert.equal(temperature(s), GOAL_TEMP);
  // 沒有找最愛的存檔：和以前一樣（20 個任務合計 +17°C）
  const plain = newSave();
  plain.tasks = TASKS.map((t) => ({ id: t.id, t: 0, day: 30 }));
  assert.equal(temperature(plain), 37);
  assert.equal(TASKS.reduce((a, t) => a + t.temp, 0), 17, '任務的度數沒有改');
});

test('溫度門檻：找到最愛的玩家早一點到 37°C，告別一樣要凱文第六幕；紙條寫實際升了多少', () => {
  const s = newSave();
  finish(s, 'yuan'); finish(s, 'zhe'); finish(s, 'kevin');
  // 差 1.5°C 的任務還沒完成，37°C 已經到了
  const left = ['guest-visit', 'rain-window'];
  s.tasks = TASKS.filter((t) => !left.includes(t.id)).map((t) => ({ id: t.id, t: 0, day: 20 }));
  assert.equal(temperature(s), 37);
  assert.ok(F.segmentDue(s, 21, temperature(s)), '37°C＋凱文第六幕：告別第一段可以開始');
  // 之後完成的任務：溫度不再升，紙條不寫 +1°C
  assert.equal(stageNoteText(TASKS.find((t) => t.id === 'guest-visit'), 0).sub, STAGE_NOTE_FULL);
  assert.match(stageNoteText(TASKS[0]).sub, /\+0\.5°C/);
  s.flags.guestVisit = true;
  const done = completeTasks(s, { daysOpen: 22 }, 0);
  assert.deepEqual(done.map((t) => t.id), ['guest-visit']);
  assert.equal(temperature(s), 37);
  // 劇情的溫度門檻（予安念稿 30、凱文沒帶筆電 31、阿哲的豆 33）：最愛都開在這些里程碑之後，不會提前觸發它們
  for (const w of FV.FAV_IDS) for (const st of FV.STAGES[w].filter((x) => x.favorite)) {
    const m = S.MILESTONES.find((x) => x.who === w && x.n === st.after);
    assert.ok(m, `${w} 最愛跟在第 ${st.after} 幕之後`);
  }
});

test('線索：開放的段落，搭話的句子與德叔的一句；德叔每段只說一次', () => {
  const s = newSave();
  assert.deepEqual(FV.clueLines(s, 'yuan'), []);
  reach(s, 'yuan', 1);
  assert.ok(FV.clueLines(s, 'yuan').includes('再一杯黑咖啡，我就寫得出來。'), '現有的句子照抄');
  assert.ok(S.TALK.yuan[0].lines.includes('再一杯黑咖啡，我就寫得出來。'), '現有的台詞沒有改');
  assert.equal(FV.pendingClue(s, []), null, '予安不在店裡');
  const c = FV.pendingClue(s, ['yuan']);
  assert.deepEqual(c, { who: 'yuan', n: 1, line: FV.STAGES.yuan[0].deshu });
  FV.markClue(s, 'yuan', 1);
  assert.equal(FV.pendingClue(s, ['yuan']), null);
  FV.serve(s, 'yuan', 'black', 2);
  reach(s, 'yuan', 4, 8);
  assert.equal(FV.pendingClue(s, ['yuan']).n, 2, '下一段開放：德叔說下一段的線索');
});

test('相簿（Q77）：見過的熟客一頁三格，拿到的照片＋空格（空格不寫內容）；三段都找到寫他的最愛', () => {
  const s = newSave();
  assert.deepEqual(FV.album(s), [], '還沒見過熟客：沒有頁');
  reach(s, 'yuan', 1); reach(s, 'zhe', 1, 1);
  FV.serve(s, 'yuan', 'black', 2);
  const a = FV.album(s);
  assert.deepEqual(a.map((p) => p.who), ['yuan', 'zhe'], '凱文還沒來過：不列');
  assert.equal(a[0].slots.length, 3);
  assert.ok(a[0].slots[0].got && a[0].slots[0].caption);
  assert.deepEqual(a[0].slots.slice(1).map((x) => [x.got, x.caption]), [[null, ''], [null, '']], '空格沒有說明');
  assert.equal(a[0].favorite, '');
  finish(s, 'kevin');
  const k = FV.album(s).find((p) => p.who === 'kevin');
  assert.ok(k.slots.every((x) => x.got));
  assert.match(k.favorite, /^凱文：老闆的那杯（.+）。$/);
});

test('存檔 7 → 8 升級：補上 favorites、photos，熟客從第一段開始；lastBean 從咖啡日記補；溫度不變', () => {
  const old = newSave();
  reach(old, 'yuan', 5, 16); reach(old, 'kevin', 6, 15);
  old.tasks = TASKS.slice(0, 15).map((t) => ({ id: t.id, t: 0, day: 15 }));
  old.diary.push({ day: 15, t: 0, bean: 'cocoa', text: '' });
  const tBefore = temperature(old);
  old.version = 7;
  delete old.favorites; delete old.photos; delete old.stats.lastBean;
  const s = migrate(JSON.parse(JSON.stringify(old)), T0);
  assert.equal(s.version, 8);
  for (const w of FV.FAV_IDS) assert.deepEqual(s.favorites[w], { stage: 0, misses: 0, servedDay: 0, told: 0 }, '不自動送照片');
  assert.deepEqual(s.photos, []);
  assert.equal(s.stats.lastBean, 'cocoa');
  assert.equal(temperature(s), tBefore);
  assert.equal(FV.isOpen(s, 'yuan'), true, '走得很遠的熟客：第一段已經開放');
  assert.equal(FV.current(s, 'yuan').n, 1);
  // 沒有咖啡日記、沒有最後一杯：lastBean 留空（用的時候當作東山的豆）
  const bare = migrate({ version: 7, createdAt: T0, lastSeen: T0, flags: { seenOpening: true } }, T0);
  assert.equal(bare.stats.lastBean, '');
  assert.equal(FV.lastBeanOf(bare), 'dongshan');
  // 更舊的存檔一路升上來也有新欄位
  const v2 = migrate({ version: 2, createdAt: T0, lastSeen: T0, flags: { seenOpening: true } }, T0);
  assert.deepEqual(v2.photos, []);
  assert.ok(v2.favorites.kevin);
});

test('文字：沒有成就、完成度、收集、催促的字眼；每段都有線索、端對、說明、提示', () => {
  for (const t of FV.allFavoriteLines()) {
    assert.ok(t && t.trim(), '沒有空字串');
    assert.doesNotMatch(t, /KPI|不划算|成就|完成度|收集|達成|獲得|解鎖|任務|快點|趕快|失敗|\d+\/\d+|%/);
  }
  for (const w of FV.FAV_IDS) for (const st of FV.STAGES[w]) assert.ok(st.talk.length && st.deshu && st.ok && st.caption && st.hint, `${w} ${st.n}`);
});

// 承峰 11/4：「坐吧台時可以請凱文喝一杯」（D199）。離開東山之後凱文在吧台後面顧店，他沒找完的段落照同樣的規則完成
const departed = (s, day = 30) => { for (const w of FV.FAV_IDS) reach(s, w, 6, day - 10); Object.assign(s.farewell, { step: 7, departed: true, mapSeen: true }); };

test('吧台請凱文喝一杯：凱文顧店以後，他停在哪一段就從哪一段接著找；開放條件、順序、答案和原本一樣', () => {
  const s = newSave();
  departed(s);
  assert.ok(F.departed(s));
  assert.equal(FV.current(s, 'kevin').n, 1, '凱文還沒找過：從第一段開始');
  assert.equal(FV.isOpen(s, 'kevin'), true, '凱文的里程碑都發生過了：段落開放');
  const r1 = FV.serve(s, 'kevin', 'iced', 30, 0, false, true);
  assert.ok(r1.right && r1.photo === 'kevin-1' && r1.line === FV.STAGES.kevin[0].ok, '第一段：冰美式');
  assert.ok(FV.serve(s, 'kevin', 'dongshan', 31, 0, false, true).right, '第二段：東山的豆');
  s.stats.lastBean = 'black'; // 凱文沖給老闆的那杯也記在 lastBean（main.js 的 brew()）
  assert.equal(FV.isRight(s, 'kevin', 'dongshan'), false);
  const t0 = temperature(s);
  const r3 = FV.serve(s, 'kevin', 'black', 32, 0, false, true);
  assert.ok(r3.right && r3.favorite, '第三段：老闆最近一次喝的那杯（最愛）');
  assert.equal(temperature(s), Math.min(GOAL_TEMP, t0 + FAVORITE_TEMP), '最愛 +0.5°C（上限 37°C）');
  assert.equal(FV.current(s, 'kevin'), null, '三段都找到了');
  assert.equal(FV.canServe(s, 'kevin', 33), false, '找完以後不再出現');
  assert.deepEqual(s.photos.map((p) => p.id), ['kevin-1', 'kevin-2', 'kevin-3']);
});

test('吧台請凱文喝一杯：一天一杯；錯兩次以後的提示由凱文自己說（轉述德叔）；最愛加溫度到 37°C 為止', () => {
  const s = newSave();
  departed(s);
  assert.ok(FV.serve(s, 'kevin', 'black', 30, 0, false, true));
  assert.equal(FV.serve(s, 'kevin', 'iced', 30, 0, false, true), null, '同一天第二杯不收');
  const r = FV.serve(s, 'kevin', 'black', 31, 0, false, true);
  assert.equal(r.right, false);
  assert.equal(r.hint, FV.KEEPER_FAV.hint[0], '錯兩次：凱文自己的那句');
  assert.notEqual(r.hint, FV.STAGES.kevin[0].hint, '不是德叔的那句（德叔不在店裡）');
  assert.ok(FV.MISS.kevin.includes(r.line), '端錯的話和原本一樣');
  assert.ok(FV.serve(s, 'kevin', 'iced', 32, 0, false, true).right);
  assert.equal(s.favorites.kevin.misses, 0);
  // 第三段的提示寫出老闆上一杯的名字
  FV.serve(s, 'kevin', 'dongshan', 33, 0, false, true);
  s.stats.lastBean = 'cocoa';
  FV.serve(s, 'kevin', 'black', 34, 0, false, true);
  assert.match(FV.serve(s, 'kevin', 'black', 35, 0, false, true).hint, /熱可可/);
  // 任務都完成（37°C）時找到最愛：溫度不超過 37°C
  s.tasks = TASKS.map((t) => ({ id: t.id, t: 0, day: 30 }));
  assert.ok(FV.serve(s, 'kevin', 'cocoa', 36, 0, false, true).favorite);
  assert.equal(temperature(s), GOAL_TEMP);
});

test('吧台請凱文喝一杯：凱文顧店時的線索（段落開放才有、照段落）；文字都標了，沒有不該出現的字', () => {
  const s = newSave();
  assert.deepEqual(FV.keeperClueLines(s), []);
  departed(s);
  assert.deepEqual(FV.keeperClueLines(s), FV.KEEPER_FAV.clue[0]);
  FV.serve(s, 'kevin', 'iced', 30, 0, false, true);
  assert.deepEqual(FV.keeperClueLines(s), FV.KEEPER_FAV.clue[1]);
  assert.equal(FV.KEEPER_FAV.clue.length, FV.STAGE_COUNT);
  assert.equal(FV.KEEPER_FAV.hint.length, FV.STAGE_COUNT);
  assert.ok(FV.allFavoriteLines().includes(FV.KEEPER_FAV.offer));
  assert.equal(FV.KEEPER_FAV.offer, '請凱文喝一杯');
});

test('照片佔位圖的字（承峰 11/4：「照片待畫」改成「回憶等待觸發」，D198）', () => {
  assert.equal(FV.PHOTO_PLACEHOLDER, '回憶等待觸發');
});
