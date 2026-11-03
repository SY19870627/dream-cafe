// 黑板菜單（src/menu.js，D185～D188）的單元測試：解鎖、寫上與擦掉、黑板的行數、德叔照黑板沖、熟客的反應、存檔 6 → 7 升級
import test from 'node:test';
import assert from 'node:assert/strict';
import * as MN from '../../src/menu.js';
import * as S from '../../src/story.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';
import { TASKS } from '../../src/tasks.js';

const DAY = 864e5;
const T0 = new Date(2026, 10, 1, 21, 30).getTime();
const newSave = () => { const s = defaultSave(T0); giveStarters(s); s.flags.seenOpening = true; return s; };

test('新存檔：菜單本只有東山的豆，黑板上寫著東山的豆；還沒解鎖的品項看不到', () => {
  const s = newSave();
  assert.equal(SAVE_VERSION, 7);
  assert.deepEqual(MN.bookItems(s), ['dongshan']);
  assert.deepEqual(s.menu.board, ['dongshan']);
  assert.equal(s.menu.night, null);
  assert.deepEqual(MN.boardLines(s).map((l) => l.text), ['東山 日曬'], '黑板上只寫點得到的東西（沒有「阿里山 水洗」）');
  assert.equal(MN.boardHead(s), '今日手沖');
  assert.deepEqual(MN.boardDrinks(s), ['dongshan']);
  assert.equal(MN.write(s, 'black'), false, '沒解鎖的不能寫上黑板');
});

test('存檔欄位照選項 B 設計：每一樣記著哪天、從哪段劇情、哪一站、看過沒、第一次寫上黑板是哪天', () => {
  const s = newSave();
  const got = MN.unlock(s, 'iced', 3, T0 + 2 * DAY);
  assert.deepEqual(got, { id: 'iced', boarded: false }, '冰美式不會自己寫上黑板');
  const it = s.menu.items.iced;
  for (const k of ['day', 't', 'from', 'station', 'seen', 'told', 'boardedDay', 'noticed', 'missed']) assert.ok(k in it, k);
  assert.equal(it.from, 'kevin1');
  assert.equal(it.station, 'dongshan');
  assert.equal(it.boardedDay, 0);
  assert.equal(MN.unlock(s, 'iced', 4), null, '同一樣只解鎖一次');
  for (const id of MN.ITEM_IDS) { const i = MN.ITEMS[id]; assert.ok(i.name && i.chalk && i.desc && i.kind && i.from && i.who && i.station, id); }
});

test('寫上、擦掉：免費、馬上生效、隨時改回；黑板最多 4 行；最後一杯喝的擦不掉', () => {
  const s = newSave();
  for (const id of MN.ITEM_IDS) MN.unlock(s, id, 5, 0, { board: false });
  assert.ok(MN.write(s, 'black', 5));
  assert.equal(s.menu.items.black.boardedDay, 5);
  assert.ok(MN.erase(s, 'black'));
  assert.ok(MN.write(s, 'black', 7), '擦掉了也可以再寫回去');
  assert.equal(s.menu.items.black.boardedDay, 5, '第一次寫上去的那天不變');
  assert.ok(MN.write(s, 'cocoa') && MN.write(s, 'longan'));
  assert.equal(s.menu.board.length, MN.BOARD_MAX);
  assert.ok(MN.boardFull(s));
  assert.equal(MN.write(s, 'iced'), false, '寫滿了');
  assert.ok(MN.replace(s, 'cocoa', 'iced'), '寫滿時換掉一行');
  assert.deepEqual(s.menu.board, ['dongshan', 'black', 'iced', 'longan'], '換上來的寫在同一行');
  assert.equal(s.fund.ledger.length, 0, '不花錢');
  // 擦到只剩一杯喝的
  assert.ok(MN.erase(s, 'black') && MN.erase(s, 'iced'));
  assert.equal(MN.canErase(s, 'dongshan'), false, '黑板上最後一杯喝的不能擦（德叔要有東西沖）');
  assert.equal(MN.erase(s, 'dongshan'), false);
  assert.ok(MN.canErase(s, 'longan'), '點心可以擦');
  assert.equal(MN.replace(s, 'dongshan', 'longan'), false, '最後一杯喝的不能換成點心');
  assert.ok(MN.replace(s, 'dongshan', 'cocoa'), '換成另一杯喝的可以');
  assert.deepEqual(MN.boardDrinks(s), ['cocoa']);
});

test('德叔照黑板沖：喝的東西照黑板的順序、點心附一小碟；換黑板只換哪一杯在最上面', () => {
  const s = newSave();
  for (const id of MN.ITEM_IDS) MN.unlock(s, id, 5, 0, { board: false });
  assert.equal(MN.withSnack(s), false);
  MN.write(s, 'longan'); MN.write(s, 'iced');
  assert.equal(MN.withSnack(s), true, '龍眼乾寫在黑板上：每一杯旁邊一小碟');
  assert.deepEqual(MN.boardDrinks(s), ['dongshan', 'iced']);
  assert.deepEqual(MN.boardDrinks(s, 1), ['iced', 'dongshan'], '德叔換黑板：換一杯到最上面');
  assert.deepEqual(MN.boardLines(s, 1).map((l) => l.text), ['冰美式', '東山 日曬', '窯烤龍眼乾'], '黑板上的字和點得到的一樣，點心寫在後面');
  assert.equal(MN.boardHead(s), '今日', '混著點心時標題寫「今日」');
  assert.equal(MN.askFor(MN.boardDrinks(s)), '今天想喝哪一支豆子？', '都是咖啡時照舊問豆子');
  MN.write(s, 'cocoa');
  assert.equal(MN.askFor(MN.boardDrinks(s)), MN.ASK.drink);
  MN.erase(s, 'longan');
  assert.equal(MN.withSnack(s), false, '擦掉龍眼乾就不附');
  assert.ok(MN.ITEMS.iced.cup === 'iced' && MN.ITEMS.cocoa.cup === 'cocoa');
});

test('品項靠劇情解鎖：龍眼乾（阿哲第一幕，直接寫上黑板）、黑咖啡、冰美式、熱可可（收進菜單本）、阿哲的豆', () => {
  const s = newSave();
  const got = S.complete(s, S.milestoneById('zhe1'), 1);
  assert.deepEqual(got, [{ id: 'longan', boarded: true }]);
  assert.deepEqual(s.menu.items.longan.noticed, ['zhe'], '阿哲在劇情裡看過了，不再補一句');
  assert.deepEqual(S.complete(s, S.milestoneById('yuan1'), 2), [{ id: 'black', boarded: false }]);
  assert.deepEqual(S.complete(s, S.milestoneById('kevin1'), 3), [{ id: 'iced', boarded: false }]);
  assert.deepEqual(S.complete(s, S.milestoneById('zhe2'), 4), [], '沒有品項的里程碑');
  assert.deepEqual(MN.pendingTell(s).map((x) => x.id), ['longan', 'black', 'iced'], '德叔之後安靜時各提一次');
  MN.markTold(s, 'longan');
  assert.deepEqual(MN.pendingTell(s).map((x) => x.id), ['black', 'iced']);
  // 品項的解鎖只寫在 menu.js（ITEMS[].from），每一個 from 都是真的里程碑
  for (const id of MN.ITEM_IDS) { const f = MN.ITEMS[id].from; assert.ok(f === 'start' || S.milestoneById(f), `${id} 的 ${f}`); }
});

test('任務 #19（Q73 暫定）：阿哲第六幕照舊完成任務；老闆不在時黑板寫得下就寫上去，寫滿了收進菜單本、日誌寫一句', () => {
  const t19 = TASKS.find((t) => t.id === 'zhe-beans');
  assert.ok(t19 && t19.no === 19);
  // 黑板寫得下
  const a = newSave();
  S.complete(a, S.milestoneById('zhe1'), 1);
  assert.deepEqual(S.complete(a, S.milestoneById('zhe6'), 19), [{ id: 'zhe-beans', boarded: true }]);
  assert.ok(t19.when(a, { daysOpen: 19 }), '任務完成條件不看黑板');
  // 黑板寫滿了：只收進菜單本，任務照樣完成
  const b = newSave();
  for (const id of ['longan', 'black', 'iced', 'cocoa']) MN.unlock(b, id, 5, 0, { board: false });
  ['longan', 'black', 'iced'].forEach((id) => MN.write(b, id));
  assert.deepEqual(S.complete(b, S.milestoneById('zhe6'), 19), [{ id: 'zhe-beans', boarded: false }]);
  assert.ok(!MN.onBoard(b, 'zhe-beans') && MN.unlocked(b, 'zhe-beans'));
  assert.ok(t19.when(b, { daysOpen: 19 }), '沒寫上黑板也算完成（不卡 37°C）');
  assert.equal(MN.tellLine(b, 'zhe-beans'), MN.ITEMS['zhe-beans'].got);
  // 老闆在店裡（main.js 的 zheBeansAsk）：先收進菜單本、不自動寫，選「之後再說」也一樣完成
  const c = newSave();
  MN.unlock(c, 'zhe-beans', 19, 0, { board: false });
  assert.deepEqual(S.complete(c, S.milestoneById('zhe6'), 19), [], '已經收進菜單本：complete 不會再自己寫上黑板');
  assert.ok(!MN.onBoard(c, 'zhe-beans') && t19.when(c, { daysOpen: 19 }));
  assert.equal(MN.ZHE6.options.length, 2);
});

test('營業日誌：老闆不在的日子收進菜單本的東西，德叔在日誌寫一句', () => {
  const s = newSave();
  s.stats.cups = 1;
  const ev = S.settleThrough(s, 4);
  const menu = ev.filter((e) => e.kind === 'menu');
  assert.ok(menu.some((e) => e.id === 'black' && e.line === MN.ITEMS.black.got), JSON.stringify(menu));
  assert.ok(menu.every((e) => s.menu.items[e.id].told), '寫進日誌的，之後在店裡不再說');
});

test('熟客看到黑板：自己的東西第一次寫上去說一句；平常點的被擦掉說一句中性的話；各一次', () => {
  const s = newSave();
  for (const id of MN.ITEM_IDS) MN.unlock(s, id, 5, 0, { board: false });
  const h = () => false;
  assert.equal(MN.boardReaction(s, ['yuan'], h), null, '沒寫上黑板過、也沒擦掉過：不說');
  MN.write(s, 'black');
  assert.equal(MN.boardReaction(s, [], h), null, '她不在店裡');
  const r = MN.boardReaction(s, ['yuan'], h);
  assert.deepEqual([r.item, r.who, r.kind], ['black', 'yuan', 'on']);
  MN.markReaction(s, r);
  assert.equal(MN.boardReaction(s, ['yuan'], h), null, '說過了');
  MN.erase(s, 'black');
  const off = MN.boardReaction(s, ['yuan'], h);
  assert.deepEqual([off.kind, off.line], ['off', MN.BOARD_REACT[0].off]);
  MN.markReaction(s, off);
  assert.equal(MN.boardReaction(s, ['yuan'], h), null);
  // 凱文第五幕以後改喝熱的：冰美式被擦掉不說
  MN.write(s, 'iced'); MN.markReaction(s, MN.boardReaction(s, ['kevin'], h)); MN.erase(s, 'iced');
  assert.equal(MN.boardReaction(s, ['kevin'], (w, n) => w === 'kevin' && n === 5), null);
  assert.equal(MN.boardReaction(s, ['kevin'], h).kind, 'off');
  // 反應只有好的或中性的
  for (const x of MN.BOARD_REACT) for (const t of [x.on, x.off].filter(Boolean)) assert.doesNotMatch(t, /生氣|不來了|失望|可惜|討厭/);
});

test('存檔 6 → 7：舊的菜單（id 陣列）全部當作解鎖過、寫在黑板上；劇情發生過的品項補進菜單本（不寫上黑板）', () => {
  const s = newSave();
  s.version = 6;
  s.menu = ['dongshan', 'longan', 'zhe-beans'];
  s.regulars.yuan.milestones = [1, 2, 3, 4];
  s.regulars.kevin.milestones = [1, 2];
  s.regulars.zhe.milestones = [1, 2, 3, 4, 5, 6];
  delete s.moments; // 順便確認更舊的欄位也補得回來
  const m = migrate(JSON.parse(JSON.stringify(s)), T0 + 20 * DAY);
  assert.equal(m.version, SAVE_VERSION);
  assert.deepEqual(m.menu.board, ['dongshan', 'longan', 'zhe-beans'], '原本菜單上的東西都寫在黑板上');
  assert.deepEqual(MN.bookItems(m), ['dongshan', 'longan', 'black', 'iced', 'cocoa', 'zhe-beans']);
  assert.ok(['dongshan', 'longan', 'zhe-beans'].every((id) => m.menu.items[id].told && m.menu.items[id].seen && m.menu.items[id].boardedDay > 0));
  assert.ok(['black', 'iced', 'cocoa'].every((id) => !m.menu.items[id].told && m.menu.items[id].boardedDay === 0), '補進菜單本的，德叔之後提一次');
  assert.deepEqual(m.menu.items['zhe-beans'].noticed, ['zhe'], '阿哲看過自己的豆寫上黑板了');
  assert.equal(m.menu.night, null);
  assert.ok(m.moments && Array.isArray(m.moments.decor));
  // 只有東山的豆的舊存檔、第 3 版以前沒有 menu 的存檔
  const one = migrate({ version: 6, createdAt: T0, lastSeen: T0, menu: ['dongshan'], flags: { seenOpening: true } }, T0);
  assert.deepEqual(one.menu.board, ['dongshan']);
  assert.deepEqual(MN.bookItems(one), ['dongshan']);
  const v2 = migrate({ version: 2, createdAt: T0, lastSeen: T0, flags: { seenOpening: true } }, T0);
  assert.deepEqual(v2.menu.board, ['dongshan']);
  // 壞掉的 menu（不認得的 id）不會讓遊戲壞掉
  const bad = migrate({ version: 6, createdAt: T0, lastSeen: T0, menu: ['nope', 'longan'] }, T0);
  assert.deepEqual(bad.menu.board, ['dongshan', 'longan']);
  // 第 7 版的存檔讀進來不變
  const again = migrate(JSON.parse(JSON.stringify(m)), T0 + 21 * DAY);
  assert.deepEqual(again.menu, m.menu);
});

test('新的字：不催促、沒有數字的營收銷量、全形標點', () => {
  const all = MN.allMenuLines();
  assert.ok(all.length >= 40);
  for (const t of all) {
    assert.doesNotMatch(t, /KPI|不划算|划算|營收|銷量|排行|賣得|熱賣|人氣|快點|趕快|任務|元/);
    assert.doesNotMatch(t, /\.\.\.|[一-鿿][,?!]/);
    assert.doesNotMatch(t.replace(/……/g, ''), /…/);
  }
});
