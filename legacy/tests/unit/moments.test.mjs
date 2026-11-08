// 承峰 11/3 第二輪回饋：店裡的小事（src/moments.js）——前三天的小段落（D181）、店內小事件（D182）、擺飾第一次擺出來的反應（D183）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as MO from '../../src/moments.js';
import { CATALOG, GIFTS } from '../../src/catalog.js';
import { defaultSave, migrate, SAVE_VERSION } from '../../src/save.js';

const T0 = new Date(2026, 10, 3, 19, 0).getTime();
const ctx = (o = {}) => ({ day: 1, here: [], seated: [], expecting: [], met: { yuan: false, zhe: false }, ...o });

test('前三天：第 1 天阿哲來過、走了以後，予安在門口探頭看一眼（她第一次來之前）', () => {
  assert.equal(MO.earlyDue(ctx({ expecting: ['zhe'] })), null, '阿哲還沒來');
  assert.equal(MO.earlyDue(ctx({ met: { zhe: true, yuan: false }, here: ['zhe'] })), null, '阿哲還在店裡');
  assert.equal(MO.earlyDue(ctx({ met: { zhe: true, yuan: false } }))?.id, 'd1-peek');
  assert.equal(MO.earlyDue(ctx({ met: { zhe: true, yuan: false } }), ['d1-peek']), null, '一段只演一次');
  assert.equal(MO.earlyDue(ctx({ day: 2, met: { zhe: true, yuan: false } }))?.id ?? null, null, '錯過第 1 天就不補');
});

test('前三天：第 2～3 天予安坐在窗邊時，德叔替她續一杯；第 3～4 天門口有人停了一下', () => {
  const met = { zhe: true, yuan: true };
  assert.equal(MO.earlyDue(ctx({ day: 2, met, here: ['yuan'], seated: ['yuan'] }))?.id, 'd2-refill');
  assert.equal(MO.earlyDue(ctx({ day: 2, met, here: ['yuan'], seated: [] })), null, '予安還沒坐定');
  assert.equal(MO.earlyDue(ctx({ day: 3, met }), ['d2-refill'])?.id, 'd3-passerby');
  assert.equal(MO.earlyDue(ctx({ day: 5, met })), null, '第 5 天以後沒有前三天的段落');
  for (const e of MO.EARLY) assert.ok(e.days[1] <= 4 && e.line[0] === '德叔' && e.line[1]);
});

test('店內小事件：德叔的事要德叔在吧台閒著；凱文顧店時沒有德叔的事；龍眼的事要他睡在窗台上', () => {
  const base = { placed: new Set(), night: false, weather: 'clear', keeper: false, deshuFree: true, catFree: true, recent: [] };
  const ids = (c) => MO.idleCandidates(c).map((e) => e.id);
  assert.ok(ids(base).includes('deshu-wipe') && ids(base).includes('cat-stretch') && ids(base).includes('window-birds'));
  assert.ok(!ids(base).includes('deshu-water'), '沒擺盆栽就不澆花');
  assert.ok(ids({ ...base, placed: new Set(['succulent']) }).includes('deshu-water'));
  assert.ok(!ids({ ...base, keeper: true }).some((id) => id.startsWith('deshu')));
  assert.ok(!ids({ ...base, deshuFree: false }).some((id) => id.startsWith('deshu')));
  assert.ok(!ids({ ...base, catFree: false }).some((id) => id.startsWith('cat')));
  assert.ok(!ids({ ...base, night: true }).includes('window-birds') && !ids({ ...base, weather: 'rain' }).includes('window-birds'));
  assert.ok(!ids({ ...base, recent: ['deshu-wipe'] }).includes('deshu-wipe'), '最近演過的不馬上重複');
});

test('店內小事件：挑得出來、偶爾才說話；什麼都做不了時回傳 null', () => {
  const c = { placed: new Set(['plant']), night: false, weather: 'clear', keeper: false, deshuFree: true, catFree: true, recent: [] };
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(MO.pickIdle(c, i / 200).id);
  assert.equal(seen.size, MO.idleCandidates(c).length, '每一件都挑得到');
  assert.equal(MO.pickIdle({ ...c, keeper: true, catFree: false, night: true }, 0.5)?.who, 'window');
  const wipe = MO.idleById('deshu-wipe');
  assert.equal(MO.idleLine(wipe, 0.9), '', '多半不說話');
  assert.equal(MO.idleLine(wipe, 0.1), wipe.lines[0]);
  assert.equal(MO.idleLine(MO.idleById('cat-tail'), 0), '', '龍眼的小動作不說話');
  // 間隔 1～3 分鐘
  assert.equal(MO.IDLE_GAP.min, 60000);
  assert.equal(MO.IDLE_GAP.max, 180000);
});

test('擺飾的反應：型錄 16 件＋熟客禮物 4 件都有；熟客在才由熟客說，不然德叔或龍眼', () => {
  for (const item of [...CATALOG, ...GIFTS]) {
    const r = MO.decorReaction(item.id);
    assert.ok(r && r.line && ['deshu', 'cat'].includes(r.who), `${item.id} 沒有熟客在時也有反應`);
  }
  assert.equal(MO.decorReaction('book-stack', ['yuan']).who, 'yuan');
  assert.equal(MO.decorReaction('book-stack', ['zhe']).who, 'deshu');
  assert.equal(MO.decorReaction('cat-tree').who, 'cat');
  assert.equal(MO.decorReaction('plant', [], true), null, '凱文顧店：沒有德叔的反應');
  assert.equal(MO.decorReaction('radio', ['kevin'], true).who, 'kevin');
});

test('擺飾的反應：一件一次，存檔記住；舊存檔已經擺著的不補', () => {
  const s = defaultSave(T0);
  s.owned.push({ uid: 1, item: 'plant', placed: true, x: 0, z: 0 }, { uid: 2, item: 'radio', placed: false, x: 0, z: 0 },
    { uid: 3, item: 'menu-board', placed: true, x: 0, z: 0 }, { uid: 4, item: 'plant', placed: true, x: 1, z: 0 });
  assert.deepEqual(MO.pendingDecor(s), ['plant', 'menu-board'], '收在倉庫的不算、同一種只算一次');
  MO.markDecor(s, 'plant');
  assert.deepEqual(MO.pendingDecor(s), ['menu-board']);
  MO.markEarly(s, 'd1-peek'); MO.markEarly(s, 'd1-peek');
  assert.deepEqual(s.moments.early, ['d1-peek']);
  // 第 5 版的存檔：沒有 moments；已經擺著的東西當作反應過了，倉庫裡的之後擺出來才反應
  const old = JSON.parse(JSON.stringify(defaultSave(T0)));
  old.version = 5;
  delete old.moments;
  old.owned = [{ uid: 1, item: 'plant', placed: true, x: 0, z: 0 }, { uid: 2, item: 'radio', placed: false, x: 0, z: 0 }];
  const m = migrate(old, T0);
  assert.equal(m.version, SAVE_VERSION);
  assert.ok(SAVE_VERSION >= 6); // 第 7 版（黑板菜單）見 menu.test.mjs
  assert.deepEqual(m.moments, { early: [], decor: ['plant'] });
  m.owned[1].placed = true;
  assert.deepEqual(MO.pendingDecor(m), ['radio']);
});

test('新的字：不催促、不報時間、全形標點；龍眼不離開窗台的設定不被台詞打破', () => {
  const all = MO.allMomentLines();
  assert.ok(all.length >= 30);
  for (const t of all) {
    assert.doesNotMatch(t, /KPI|不划算|划算|快點|趕快|任務|簽到|打卡|加班|\d+ ?(秒|分鐘)/);
    assert.doesNotMatch(t, /\.\.\.|[一-鿿][,?!]/);
    assert.doesNotMatch(t.replace(/……/g, ''), /…/);
  }
  assert.equal(MO.BOARD_BEANS, undefined, '黑板上不再寫點不到的裝飾豆子（Q74 暫定，D188）');
});
