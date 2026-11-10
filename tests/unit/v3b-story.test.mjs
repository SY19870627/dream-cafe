// v3b 三天故事：劇本原字與 ID、四種選擇組合走到 end、when 回收、刷新／連點／重選／壞檔／存檔隔離、回顧、美術對照表。
// 只測純邏輯與靜態檔案，不開瀏覽器。劇本來源用 tests/fixtures/v3b/（tracked），不依賴 _agent/。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as OP from '../../src/lines/opening.js';
import { sequence, listChoices, allNodeIds, allTexts, allStages, SPEAKERS, END_ID, MERGE_MARK, ACT4_PAGES } from '../../src/story/script.js';
import * as S from '../../src/story/state.js';
import { load, persist, SAVE_KEY, OTHER_KEYS } from '../../src/story/save.js';
import { BACKGROUNDS, PORTRAITS, FOCUS, OLD_LADY, CAT_SPOTS, allArt } from '../../src/story/manifest.js';
import { NODE_DIRECTION, SCENE_DIRECTION } from '../../src/story/direction.js';
import { OPENING_ACTS as V3A_ACTS } from '../../src/day.js';
import { SAVE_KEY as V3A_KEY } from '../../src/save.js';
import { shopScene } from '../../src/view/shop.js';
import { shopScene as v3aShop } from '../../src/view/scenes.js';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const lf = (buf) => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
const SOURCE_SHA = 'ea0b3c1b2feb08f2cf48a4ffd0b832102794cd68653b92fcf0da1be855511638';
const SRC = JSON.parse(read('src/story/final-source.json'));
const COMBOS = [
  { share_tv: 'location', note_share: 'note' },
  { share_tv: 'location', note_share: 'warm' },
  { share_tv: 'tv', note_share: 'note' },
  { share_tv: 'tv', note_share: 'warm' },
];
const clone = (x) => JSON.parse(JSON.stringify(x));
const reload = (s) => S.normalize(clone(s), SRC);

// 開場走完（坐下）
function afterOpening() {
  const s = S.newStoryState();
  for (const act of S.OPENING_ACTS.slice(1)) assert.equal(S.setOpeningAct(s, act), true, act);
  assert.equal(S.finishOpening(s), true);
  return s;
}
// 照 combo 一路讀到 end；每一步都可回呼（看狀態）
function playThrough(combo, each = () => {}) {
  const s = afterOpening();
  let guard = 0;
  while (!S.isEnd(s)) {
    assert.ok(guard++ < 500, '走不到 end');
    const p = S.currentPage(SRC, s);
    assert.ok(p, `找不到目前頁 ${s.at}`);
    each(s, p);
    if (p.kind === 'choice') assert.equal(S.choose(SRC, s, p.id, combo[p.key]), true, p.id);
    else assert.equal(S.advance(SRC, s, p.id), true, p.id);
  }
  each(s, S.currentPage(SRC, s));
  return s;
}
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  const log = [];
  return {
    log,
    map: m,
    getItem(k) { log.push(['get', k]); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { log.push(['set', k]); m.set(k, String(v)); },
    removeItem(k) { log.push(['remove', k]); m.delete(k); },
    clear() { log.push(['clear']); m.clear(); },
  };
}

/* ---------- 劇本原字 ---------- */
test('劇本檔與 tracked fixture 逐字相同，sha256 等於指定值（換行正規化後）', () => {
  const mine = readFileSync(root('src/story/final-source.json'));
  const fix = readFileSync(root('tests/fixtures/v3b/final-source.json'));
  assert.equal(sha(lf(mine)), SOURCE_SHA);
  assert.equal(sha(lf(fix)), SOURCE_SHA);
  assert.match(read('tests/fixtures/v3b/final-source.sha256'), new RegExp(`^${SOURCE_SHA}\\s`));
  assert.deepEqual(JSON.parse(mine.toString('utf8')), JSON.parse(fix.toString('utf8')));
});

test('本機有 _agent 原稿時：與原稿位元組相同（沒有就略過，不影響可攜性）', (t) => {
  const p = root('_agent/v3b/development/input/final-source.json');
  if (!existsSync(p)) { t.skip('沒有 _agent 原稿'); return; }
  assert.equal(sha(lf(readFileSync(p))), sha(lf(readFileSync(root('src/story/final-source.json')))));
});

test('三天各 5 場、節點 ID 全部唯一、兩個選項 key 與值照規格', () => {
  assert.deepEqual(SRC.days.map((d) => d.day), [1, 2, 3]);
  for (const d of SRC.days) assert.equal(d.scenes.length, 5);
  const ids = allNodeIds(SRC);
  assert.equal(new Set(ids).size, ids.length, '節點 ID 唯一');
  const sceneIds = SRC.days.flatMap((d) => d.scenes.map((s) => s.id));
  assert.equal(new Set([...ids, ...sceneIds]).size, ids.length + sceneIds.length, '場景 ID 也不和節點撞名');
  const ch = listChoices(SRC);
  assert.deepEqual(ch.map((c) => [c.key, c.values]), [['share_tv', ['location', 'tv']], ['note_share', ['note', 'warm']]]);
  // when 只用這兩個 key、值也合法
  const walk = (nodes, out) => { for (const n of nodes) { if (n.when) out.push(n.when); if (n.type === 'choice') for (const o of n.options) walk(o.nodes, out); } return out; };
  const whens = SRC.days.flatMap((d) => d.scenes.flatMap((s) => walk(s.nodes, [])));
  assert.ok(whens.length > 0);
  for (const w of whens) assert.ok(ch.find((c) => c.key === w.key)?.values.includes(w.value), JSON.stringify(w));
});

test('title／text／label 全部保留【待定】；說話者都有名字', () => {
  for (const t of allTexts(SRC)) assert.ok(t.startsWith('【待定】'), t);
  const walk = (nodes) => { for (const n of nodes) { if (n.type === 'line') assert.ok(n.speaker in SPEAKERS, n.id); if (n.type === 'choice') for (const o of n.options) walk(o.nodes); } };
  for (const d of SRC.days) for (const s of d.scenes) walk(s.nodes);
});

test('頁面上的字全部逐字來自劇本（或開場原文），stage 不會變成玩家看得到的字', () => {
  const texts = new Set([...allTexts(SRC), OP.ACT4_CUP, OP.ACT4_EMPTY]);
  const stages = allStages(SRC);
  assert.ok(stages.length > 50);
  for (const combo of COMBOS) {
    for (const p of sequence(SRC, combo)) {
      assert.ok(!('stage' in p), p.id);
      const shown = [p.text, p.sceneTitle, ...(p.lines || []).map((l) => l.text), ...(p.options || []).map((o) => o.label)].filter(Boolean);
      for (const t of shown) {
        assert.ok(texts.has(t), `不是劇本原字：${t}`);
        for (const st of stages) assert.ok(!t.includes(st), `stage 進了畫面：${st}`);
      }
      for (const l of p.lines || []) assert.deepEqual(Object.keys(l).sort(), ['id', 'name', 'speaker', 'text']);
    }
  }
  // 每一個劇本 line 節點在某個組合裡都會出現一次（沒有漏字）
  const seen = new Set();
  for (const combo of COMBOS) for (const p of sequence(SRC, combo)) for (const l of p.lines || []) seen.add(l.id);
  const lines = []; const walk = (nodes) => { for (const n of nodes) { if (n.type === 'line') lines.push(n.id); else for (const o of n.options) walk(o.nodes); } };
  for (const d of SRC.days) for (const s of d.scenes) walk(s.nodes);
  for (const id of lines) assert.ok(seen.has(id), `沒出現：${id}`);
});

test('開場第四幕兩句原文接在坐下之後、第一天章名之前', () => {
  assert.deepEqual(ACT4_PAGES.map((p) => p.text), [OP.ACT4_CUP, OP.ACT4_EMPTY]);
  const s = afterOpening();
  assert.equal(s.at, S.FIRST_PAGE);
  const pages = sequence(SRC, {});
  assert.deepEqual(pages.slice(0, 3).map((p) => p.id), ['op-act4-1', 'op-act4-2', 'd1-title']);
  assert.equal(pages[2].text, SRC.days[0].title);
});

test('「同框累加」的句子併進上一頁，不自成一頁', () => {
  const pages = sequence(SRC, COMBOS[3]);
  const merged = new Map();
  for (const p of pages) for (const l of (p.lines || []).slice(1)) merged.set(l.id, p.id);
  assert.equal(merged.get('d1-s1-07'), 'd1-s1-06');
  assert.equal(merged.get('d1-s3-03'), 'd1-s3-02');
  assert.equal(merged.get('d2-s5-warm-03'), 'd2-s5-warm-01', '三句同框');
  const walk = (nodes, out) => { for (const n of nodes) { if (n.stage?.includes(MERGE_MARK)) out.push(n.id); if (n.type === 'choice') for (const o of n.options) walk(o.nodes, out); } return out; };
  const marks = SRC.days.flatMap((d) => d.scenes.flatMap((s) => walk(s.nodes, [])));
  for (const c of COMBOS) {
    const ids = new Set(sequence(SRC, c).map((p) => p.id));
    for (const id of marks) assert.ok(!ids.has(id), `${id} 不該是獨立一頁`);
  }
});

/* ---------- 四種組合 ---------- */
test('四種選擇組合都從開場走到 end；沒有第四天、沒有計分欄位', () => {
  for (const combo of COMBOS) {
    let choicesSeen = 0;
    const s = playThrough(combo, (st, p) => { if (p.kind === 'choice') choicesSeen++; });
    assert.equal(choicesSeen, 2);
    assert.deepEqual(s.choices, combo);
    assert.equal(s.at, END_ID);
    assert.deepEqual(Object.keys(s).sort(), ['at', 'choices', 'opening', 'phase', 'v']);
    const pages = sequence(SRC, combo);
    assert.equal(pages.at(-1).id, END_ID);
    assert.equal(pages.at(-2).id, 'd3-s5-18');
    assert.deepEqual([...new Set(pages.map((p) => p.day))], [0, 1, 2, 3]);
    assert.equal(S.advance(SRC, s, END_ID), false, 'end 之後沒有下一頁');
  }
});

test('when 回收：第三天依第一、二天的選擇出現不同的句子，另一支不出現', () => {
  const ids = (combo) => new Set(sequence(SRC, combo).flatMap((p) => (p.lines || []).map((l) => l.id)));
  const note = ids(COMBOS[0]);
  const warm = ids(COMBOS[1]);
  for (const id of ['d3-s1-03', 'd3-s1-04', 'd3-s1-05']) { assert.ok(note.has(id)); assert.ok(!warm.has(id)); }
  for (const id of ['d3-s1-06', 'd3-s1-07', 'd3-s1-08']) { assert.ok(warm.has(id)); assert.ok(!note.has(id)); }
  const loc = ids(COMBOS[0]);
  const tv = ids(COMBOS[2]);
  for (const id of ['d3-s3-02', 'd3-s3-03', 'd3-s3-04', 'd3-s3-05']) { assert.ok(tv.has(id)); assert.ok(!loc.has(id)); }
  for (const id of ['d3-s3-06', 'd3-s3-07', 'd3-s3-08']) { assert.ok(loc.has(id)); assert.ok(!tv.has(id)); }
  // 選項分支本身也只出現選了的那一支
  assert.ok(loc.has('d1-s3-loc-01') && !loc.has('d1-s3-tv-01'));
  assert.ok(tv.has('d1-s3-tv-01') && !tv.has('d1-s3-loc-01'));
  // 兩線之後的共同部分一樣（沒有獎懲：頁數差只在分支與回收）
  const common = (c) => sequence(SRC, c).filter((p) => p.kind === 'line' && !/-(loc|tv|note|warm)-/.test(p.id)).map((p) => p.id).filter((id) => !/^d3-s1-0[3-8]$|^d3-s3-0[2-8]$/.test(id));
  for (const c of COMBOS.slice(1)) assert.deepEqual(common(c), common(COMBOS[0]));
});

test('還沒選的 when 一律不符：選項之前的頁不受未來答案影響', () => {
  const pages = sequence(SRC, {});
  assert.equal(pages.at(-1).id, 'd1-s3-05');
  assert.equal(pages.at(-1).kind, 'choice');
  assert.equal(pages.at(-1).chosen, null);
});

/* ---------- 連點、重選 ---------- */
test('連點：用舊的頁 id 推頁不會多推；選項頁不能用推頁略過；end 不能推', () => {
  const s = afterOpening();
  const first = s.at;
  assert.equal(S.advance(SRC, s, first), true);
  assert.equal(S.advance(SRC, s, first), false, '同一頁的第二下作廢');
  assert.equal(S.advance(SRC, s, 'd2-s1-01'), false, '不是眼前這一頁');
  while (S.currentPage(SRC, s).kind !== 'choice') S.advance(SRC, s, s.at);
  const at = s.at;
  assert.equal(S.advance(SRC, s, at), false);
  assert.equal(s.at, at);
  assert.equal(S.choose(SRC, s, at, 'nope'), false, '不存在的選項');
  assert.equal(S.choose(SRC, s, 'd2-s5-14', 'note'), false, '不是眼前的選項');
  assert.equal(S.choose(SRC, s, at, 'tv'), true);
  assert.equal(S.choose(SRC, s, at, 'location'), false, '同一個選項只能選一次（連點第二下）');
  assert.equal(s.choices.share_tv, 'tv');
  assert.equal(s.at, 'd1-s3-tv-01');
});

test('選後不能重選：即使把游標硬改回選項頁，讀檔也照已選的那一支往下', () => {
  const s = afterOpening();
  while (S.currentPage(SRC, s).kind !== 'choice') S.advance(SRC, s, s.at);
  S.choose(SRC, s, 'd1-s3-05', 'location');
  const raw = clone(s);
  raw.at = 'd1-s3-05';
  const r = S.normalize(raw, SRC);
  assert.equal(r.choices.share_tv, 'location');
  assert.equal(r.at, 'd1-s3-loc-01');
  assert.equal(S.choose(SRC, r, 'd1-s3-05', 'tv'), false);
});

test('連點防護（畫面用）：選項出現後一小段時間不收點；推頁之間留一點間隔，但不強制等待', () => {
  const g = S.createGate();
  g.arm(1000);
  assert.equal(g.canChoose(1000 + S.CHOICE_ARM_MS - 1), false);
  assert.equal(g.canChoose(1000 + S.CHOICE_ARM_MS), true);
  assert.ok(S.CHOICE_ARM_MS <= 600 && S.ADVANCE_GAP_MS <= 200, '只擋誤觸，不是強制等待');
  assert.equal(g.canAdvance(5000), true);
  assert.equal(g.canAdvance(5000 + 10), false);
  assert.equal(g.canAdvance(5000 + 10 + S.ADVANCE_GAP_MS), true);
});

/* ---------- 刷新續讀 ---------- */
test('刷新：四種組合的每一頁（選前、選項頁、分支中、選後、換場、end）存檔讀回都在同一頁、答案不變', () => {
  for (const combo of COMBOS) {
    let prevScene = null;
    let sceneChanges = 0;
    playThrough(combo, (s, p) => {
      if (p.scene !== prevScene) { sceneChanges++; prevScene = p.scene; }
      const r = reload(s);
      assert.equal(r.at, s.at, `${p.id}`);
      assert.deepEqual(r.choices, s.choices);
      assert.equal(r.phase, 'story');
    });
    assert.ok(sceneChanges >= 16);
  }
});

test('刷新：開場每一幕、推門後德叔第幾句都接著原本的地方', () => {
  const s = S.newStoryState();
  for (const act of S.OPENING_ACTS.slice(1)) {
    S.setOpeningAct(s, act);
    assert.equal(reload(s).opening.act, act);
  }
  const d = S.newStoryState();
  for (const act of ['title', 'mailbox', 'letter', 'road', 'deshu']) S.setOpeningAct(d, act);
  assert.equal(S.setDeshuLine(d, 2), true);
  assert.equal(S.setDeshuLine(d, 1), false, '只往前');
  assert.equal(reload(d).opening.deshuLine, 2);
  assert.equal(S.setOpeningAct(d, 'office'), false, '開場只往前');
  assert.deepEqual(S.OPENING_ACTS, V3A_ACTS, '開場各幕與 v3a 相同');
});

/* ---------- 壞檔 ---------- */
test('壞檔防護：格式不對從頭；游標壞了回劇本開頭；不合法的答案丟掉；走錯分支的游標不採用', () => {
  const fresh = S.newStoryState();
  for (const bad of [null, 'x', 42, [], { v: 99 }, { v: '1' }, { version: 3, flags: {} }]) assert.deepEqual(S.normalize(bad, SRC), fresh);
  // v3a 存檔的樣子：不認、不遷移
  assert.deepEqual(S.normalize({ v: 1, day: 2, phase: 'order', orders: {} }, SRC), fresh);
  // 游標不存在
  let r = S.normalize({ v: 1, phase: 'story', at: 'nope', choices: { share_tv: 'tv' } }, SRC);
  assert.equal(r.at, S.FIRST_PAGE);
  assert.deepEqual(r.choices, {});
  // 答案值不合法、key 不認得
  r = S.normalize({ v: 1, phase: 'story', at: 'd2-s1-01', choices: { share_tv: 'yes', hack: 'x' } }, SRC);
  assert.deepEqual(r.choices, {});
  assert.equal(r.at, S.FIRST_PAGE, '第一天的選項沒有合法答案 → 第二天的頁不存在 → 回到劇本開頭');
  // 選 location 卻停在 tv 分支的頁
  r = S.normalize({ v: 1, phase: 'story', at: 'd1-s3-tv-03', choices: { share_tv: 'location' } }, SRC);
  assert.equal(r.at, S.FIRST_PAGE);
  // 游標還在第一天，卻已經有第二天的答案：丟掉未來的答案
  r = S.normalize({ v: 1, phase: 'story', at: 'd1-s1-05', choices: { share_tv: 'tv', note_share: 'warm' } }, SRC);
  assert.equal(r.at, 'd1-s1-05');
  assert.deepEqual(r.choices, {});
  // 開場欄位亂填
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'zzz', name: 'x'.repeat(50), deshuLine: 99 } }, SRC);
  assert.equal(r.opening.act, 'office');
  assert.equal(r.opening.name.length, 12);
  assert.equal(r.opening.deshuLine, 3);
});

/* ---------- 存檔隔離 ---------- */
test('存檔鍵 dream-cafe.v3b：不讀、不寫、不刪 v3a 與第一版的鍵', () => {
  assert.equal(SAVE_KEY, 'dream-cafe.v3b');
  assert.equal(V3A_KEY, 'dream-cafe.v3a', 'v3a 鍵保留原樣');
  assert.ok(OTHER_KEYS.includes(V3A_KEY));
  const v3a = JSON.stringify({ v: 1, day: 3, phase: 'dream' });
  const st = fakeStorage({ 'dream-cafe.v3a': v3a, 'dream-cafe.save': '{"version":3}' });
  const s = load(SRC, st);
  assert.deepEqual(s, S.newStoryState(), '沒有 v3b 存檔就從頭，不讀 v3a');
  S.setOpeningAct(s, 'title');
  assert.equal(persist(s, st), true);
  assert.deepEqual(st.log.map((x) => x[1]).filter(Boolean), [SAVE_KEY, SAVE_KEY]);
  assert.ok(!st.log.some((x) => x[0] === 'remove' || x[0] === 'clear'));
  assert.equal(st.map.get('dream-cafe.v3a'), v3a);
  assert.equal(st.map.get('dream-cafe.save'), '{"version":3}');
  assert.equal(load(SRC, st).opening.act, 'title');
});

test('存檔讀不到、JSON 壞掉、storage 丟錯：都從頭開始，不會卡住', () => {
  assert.deepEqual(load(SRC, null), S.newStoryState());
  assert.deepEqual(load(SRC, fakeStorage({ [SAVE_KEY]: '{bad json' })), S.newStoryState());
  const boom = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(load(SRC, boom), S.newStoryState());
  assert.equal(persist(S.newStoryState(), boom), false);
});

/* ---------- 回顧 ---------- */
test('回顧：只列讀過的頁與選過的答案，不重複、不出現另一支、不含未來', () => {
  for (const combo of COMBOS) {
    playThrough(combo, (s, p) => {
      const h = S.history(SRC, s);
      const ids = h.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length, `${p.id} 回顧不重複`);
      const pages = sequence(SRC, s.choices);
      const i = pages.findIndex((x) => x.id === s.at);
      const read = new Set(pages.slice(0, i + 1).flatMap((x) => (x.lines ? x.lines.map((l) => l.id) : [x.id])));
      for (const id of ids) assert.ok(read.has(id), `${id} 還沒讀到卻出現在回顧`);
      for (const x of h) if (x.kind === 'choice') {
        const c = pages.find((pp) => pp.id === x.id);
        assert.equal(x.text, c.options.find((o) => o.value === c.chosen).label, '只列選了的那一句');
        for (const o of c.options) if (o.value !== c.chosen) assert.ok(!h.some((y) => y.text === o.label));
      }
      if (p.kind === 'choice') assert.ok(!ids.includes(p.id), '還沒選的選項不列');
      const other = combo.share_tv === 'tv' ? 'd1-s3-loc-' : 'd1-s3-tv-';
      assert.ok(!ids.some((id) => id.startsWith(other)), '另一支不洩漏');
    });
  }
});

test('回顧與環視不改進度：讀 history／currentPage 前後狀態相同（關掉後回到原頁、不重選）', () => {
  const s = afterOpening();
  while (S.currentPage(SRC, s).kind !== 'choice') S.advance(SRC, s, s.at);
  const before = clone(s);
  S.history(SRC, s);
  S.currentPage(SRC, s);
  S.pagesOf(SRC, s);
  assert.deepEqual(s, before);
  assert.equal(S.currentPage(SRC, s).chosen, null, '回來還是同一個未選的選項頁');
  S.choose(SRC, s, s.at, 'tv');
  const after = clone(s);
  S.history(SRC, s);
  assert.deepEqual(s, after);
});

/* ---------- 演出表與美術 ---------- */
test('演出表只指向劇本裡真的有的節點與場景；音效都有定義', () => {
  const ids = new Set(allNodeIds(SRC));
  for (const id of Object.keys(NODE_DIRECTION)) assert.ok(ids.has(id), id);
  const scenes = new Set(['op-act4', ...SRC.days.flatMap((d) => d.scenes.map((s) => s.id))]);
  for (const id of Object.keys(SCENE_DIRECTION)) assert.ok(scenes.has(id), id);
  const audio = read('src/view/audio.js');
  for (const d of Object.values(NODE_DIRECTION)) {
    for (const n of d.sfx || []) assert.ok(audio.includes(`case '${n}':`), n);
    if (d.portrait) assert.ok(d.portrait in PORTRAITS);
    if (d.cat) assert.ok(d.cat in CAT_SPOTS);
  }
  for (const d of Object.values(SCENE_DIRECTION)) if (d.cat) assert.ok(d.cat in CAT_SPOTS);
});

test('美術對照表：劇本的每個 background／portrait／focus 都查得到；ready 的檔案都在 assets/art（不 404）', () => {
  const walk = (nodes, f) => { for (const n of nodes) { if (n.focus) f.add(n.focus); if (n.type === 'choice') for (const o of n.options) walk(o.nodes, f); } };
  const focus = new Set();
  for (const d of SRC.days) for (const s of d.scenes) {
    assert.ok(s.background in BACKGROUNDS, s.background);
    assert.ok(s.portrait in PORTRAITS, s.portrait);
    walk(s.nodes, focus);
  }
  for (const f of focus) assert.ok(f in FOCUS, f);
  const files = new Set(readdirSync(root('assets/art')));
  for (const name of allArt()) assert.ok(files.has(`${name}.webp`), `缺 ${name}.webp`);
  for (const group of [BACKGROUNDS, PORTRAITS, FOCUS]) {
    for (const [k, v] of Object.entries(group)) {
      if (!v) continue;
      assert.ok(['ready', 'none'].includes(v.status), k);
      if (v.status === 'ready' && v.kind !== 'pano') assert.ok(files.has(`${v.src}.webp`), k);
      if (v.status === 'none') assert.ok(!v.src && v.fallback, `${k}：沒有圖就不能要圖，要寫 fallback`);
    }
  }
});

test('新到的十張 v3 美術都接進對照表；外出背景沿用 county_road；有圖就不畫灰色人形', () => {
  const art = new Set(allArt());
  for (const n of ['scene_v3_rain_room', 'scene_v3_mountain_hut', 'scene_v3_office_lobby', 'char_v3_agui_half', 'char_v3_junior_half', 'char_v3_old_lady_far',
    'prop_v3_old_notebook', 'prop_v3_id_badge', 'prop_v3_handover_folder', 'prop_v3_cloth_bag', 'scene_county_road']) assert.ok(art.has(n), n);
  assert.equal(BACKGROUNDS.rainRoom.src, 'scene_v3_rain_room');
  assert.equal(BACKGROUNDS.hut.src, 'scene_v3_mountain_hut');
  assert.equal(BACKGROUNDS.companyLobby.src, 'scene_v3_office_lobby');
  assert.equal(BACKGROUNDS.road.src, 'scene_county_road');
  assert.equal(PORTRAITS.gui.src, 'char_v3_agui_half');
  assert.equal(PORTRAITS.junior.src, 'char_v3_junior_half');
  assert.ok(!('manager' in PORTRAITS) && !('me' in PORTRAITS), '主管只有台詞、主角不出立繪');
  assert.equal(FOCUS.notebook.src, 'prop_v3_old_notebook');
  assert.equal(FOCUS.badge.src, 'prop_v3_id_badge');
  assert.equal(FOCUS.handover.src, 'prop_v3_handover_folder');
  assert.equal(FOCUS.bag.src, 'prop_v3_cloth_bag');
  assert.deepEqual(['shopMorning', 'shopEvening'].map((k) => BACKGROUNDS[k].kind), ['pano', 'pano'], '店內沿用畫師店面');
  assert.equal(PORTRAITS.deshu.src, 'char_deshu_stand');
  const main = read('src/main.js');
  assert.doesNotMatch(main, /drawShape|granny|grannySit/, '執行畫面不畫粗稿人形');
});

test('老太太：每個外出背景都在遠處、大小相同不逐日逼近、不可點、不標示', () => {
  const outings = Object.entries(BACKGROUNDS).filter(([, b]) => b.kind === 'image').map(([k]) => k);
  assert.deepEqual(Object.keys(OLD_LADY.places).sort(), outings.sort());
  const hs = Object.values(OLD_LADY.places).map((p) => p.h);
  for (const h of hs) assert.ok(h <= 0.05, '遠景');
  assert.ok(Math.max(...hs) - Math.min(...hs) <= 0.01, '不逐日變大');
  const main = read('src/main.js');
  const tag = main.match(/<img class="st-lady"[^>]*>/)[0];
  assert.match(tag, /alt="" aria-hidden="true"/);
  assert.match(read('index.html'), /\.st-lady \{[^}]*pointer-events: none;/);
});

test('店內故事鏡頭：德叔立繪放大時店面裡的德叔不畫（不會同時兩個德叔）；龍眼沿用 sleep／sit', () => {
  const withDeshu = shopScene({ mode: 'seated', deshu: null, day: 1 });
  assert.ok(!withDeshu.items.some((it) => it.id === 'deshu'));
  assert.ok(v3aShop({ mode: 'seated', day: 1 }).items.some((it) => it.id === 'deshu'), 'v3a 預設不變');
  for (const c of Object.values(CAT_SPOTS)) assert.match(c.img, /^cat_longan_(sleep|sit)$/);
  const main = read('src/main.js');
  assert.match(main, /deshu: page\.portrait === 'deshu' \? null : 'stand'/);
});

/* ---------- 執行畫面（原始碼層面的界線） ---------- */
test('執行畫面不再載入泡咖啡、機關、送咖啡、夢想 360 的模組', () => {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^import[^'"]*['"](\.[^'"]+)['"]/gm)) visit(resolve(dirname(file), m[1]));
  };
  visit(root('src/main.js'));
  const rel = [...seen].map((f) => f.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'));
  for (const bad of ['src/machine.js', 'src/day.js', 'src/view/company.js', 'src/dreams/index.js', 'src/dreams/interact.js', 'src/lines/shop.js', 'src/save.js']) {
    assert.ok(!rel.includes(bad), `不應載入 ${bad}`);
  }
  assert.ok(rel.includes('src/story/state.js') && rel.includes('src/view/opening.js'));
  const code = read('src/main.js').replace(/\/\/.*$/gm, ''); // 只看程式，不看註解
  assert.doesNotMatch(code, /DURATION|brewStartedAt|countdown|倒數/);
});

test('鍵盤：Enter／Space 只在故事頁推進，開場（簽名輸入框）不攔；按鈕、輸入框上的按鍵交還瀏覽器', () => {
  const main = read('src/main.js');
  const kd = main.slice(main.indexOf("addEventListener('keydown', (e) => {"), main.indexOf('/* ---------- 環視'));
  assert.match(kd, /if \(!state \|\| state\.phase !== 'story'\) return;/);
  assert.match(kd, /e\.key !== 'Enter' && e\.key !== ' '/);
  assert.match(kd, /closest\?\.\('button, input, textarea/);
  assert.match(kd, /if \(logOpen\)/, '回顧開著時不推頁');
});

test('執行畫面接線：main.js 用到的每個 DOM id 都在 index.html；推頁／選擇只認畫面上正在顯示的那一頁', () => {
  const main = read('src/main.js');
  const html = read('index.html');
  const ids = [...new Set([...main.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]))];
  assert.ok(ids.length > 15);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `index.html 缺 #${id}`);
  const adv = main.slice(main.indexOf('function tryAdvance()'), main.indexOf("$('story').addEventListener"));
  assert.match(adv, /!renderedId \|\| \$\('story'\)\.hidden\) return;/, '還沒畫出來（淡出中）不推頁');
  assert.match(adv, /page\.id !== renderedId/);
  assert.match(adv, /S\.advance\(source, state, renderedId\)/);
  assert.match(main, /renderText\(page, pages\);\s*renderedId = page\.id;/, '畫完才記眼前這一頁');
  assert.match(main, /function reset\(\) \{[^}]*renderedId = null;/, '換畫面先清掉');
  assert.match(main, /canChoose\(performance\.now\(\)\) \|\| renderedId !== page\.id \|\| logOpen\) return;/);
  // 回顧／環視按鈕自己擋掉冒泡，不會順便推頁；回顧層在 #story 外面（點不穿）
  assert.match(main, /\$\('st-look'\)\.onclick = \(e\) => \{ e\.stopPropagation\(\);/);
  assert.match(main, /\$\('st-log'\)\.onclick = \(e\) => \{ e\.stopPropagation\(\);/);
  const story = html.slice(html.indexOf('<section id="story"'), html.indexOf('</section>', html.indexOf('<section id="story"')));
  assert.ok(!story.includes('id="log"') && !story.includes('id="look"'));
});

test('版面：閱讀框約 28–34%、字 18–20px、行高 1.6、按鈕至少 44px；回顧蓋住整個畫面', () => {
  const html = read('index.html');
  const boxH = Number(html.match(/--box-h: (\d+)%/)[1]);
  assert.ok(boxH >= 28 && boxH <= 34, `閱讀框 ${boxH}%`);
  const box = html.match(/\.st-box \{[^}]*\}/)[0];
  const fs = Number(box.match(/font-size: (\d+)px/)[1]);
  assert.ok(fs >= 18 && fs <= 20);
  assert.match(box, /line-height: 1\.6/);
  assert.match(box, /max-height: 6\d%; overflow-y: auto/, '字多擴框（可捲，不裁字）');
  assert.match(html, /button \{[^}]*min-height: 44px; min-width: 44px;/);
  assert.match(html, /\.st-choices button \{[^}]*min-height: 56px/);
  assert.match(html, /#log \{ position: absolute; inset: 0; z-index: 25;/);
  assert.doesNotMatch(html + read('src/main.js'), /任務|分數|收集|還差/);
});

test('檢核紀錄（20 條）以 tracked 檔保存，不依賴 _agent', () => {
  const dir = 'src/story/checks/';
  for (const f of ['day1-check.md', 'day23-check.md', 'fable-final-polish.md', 'checklist-spec-full.md']) assert.ok(existsSync(root(dir + f)), f);
  const list = read(`${dir}checklist-spec-full.md`).split(/\r?\n/).filter((l) => /^\d+\. /.test(l));
  assert.equal(list.length, 20);
  for (const f of ['day1-check.md', 'day23-check.md']) assert.match(read(dir + f), /20 條/);
});
