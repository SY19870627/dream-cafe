// v3b 第一～四天（劇本 v4.4，作者 2026-11-14 核准接進遊戲）：第一晚 A 版自白、四天正文與睡前自白逐字對稿、
// 每晚睡著自動存檔（讀回是隔天早上；第四天是待續）、跳過自白（獨立按鈕、不誤觸）、關卡與可選互動、舊存檔相容、用到的美術都在。
// 只測純邏輯與靜態檔案，不開瀏覽器；閱讀框（view/reader.js）用最小的假 DOM 測點擊與按鍵。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as OP from '../../src/lines/opening.js';
import * as D from '../../src/lines/days.js';
import * as S from '../../src/story/state.js';
import { load, persist, SAVE_KEY, OTHER_KEYS } from '../../src/story/save.js';
import { PLACES, DAY_ART, YIJUN_CARD, yijunCardFor, placesOf, FILM_START, FILM_END, TAPE_TIMES, REWIND_TURNS } from '../../src/view/days.js';
import { step, walk } from './walk.mjs';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const code = (p) => read(p).replace(/\/\/.*$/gm, '');
const SRC = JSON.parse(read('src/story/final-source.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const reload = (s) => S.normalize(clone(s), SRC);
const MARKS = /【(待定|待確認|新增互動)】/;
const fakeStorage = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const at = (act, line = 0, extra = {}) => ({ v: 1, phase: 'opening', opening: { act, line, ...extra } });
const dayLines = () => D.DAY_ACTS.flatMap((a) => D.DAY_LINES[a]);
const NIGHTS = ['room', 'd1night', 'd2night', 'd3night', 'd4night'];
const MORNING_AFTER = { room: 'd1wake', d1night: 'd2wake', d2night: 'd3wake', d3night: 'd4wake', d4night: S.END_ACT };

/* ---------- 字 ---------- */
test('第一晚 A 版自白：逐字、接在放鑰匙（可點床）之後、最後一句仍是睡著句；自白期間是躺下視角', () => {
  const room = OP.OPENING_LINES.room;
  assert.deepEqual(room.map((b) => b.text), [
    '我穿過庭埕。龍眼跟到一半就坐下來，沒有再跟。',
    '房間不大。我把鑰匙從口袋拿出來，放在枕頭旁邊。',
    '外面有蟲在叫，遠一點的地方有狗叫了幾聲，又停了。',
    '被子真的有曬過，德叔沒有騙我。',
    '可是他說老老闆交代過，要留一個房間讓我睡。',
    '老老闆怎麼會知道我今天晚上回不去？',
    '我連老老闆是誰都還沒搞清楚，就先睡在他留給我的房間裡了。',
    '今天下班前我才跟公司說我不做了，現在躺在這裡，覺得那好像是好幾天以前的事。',
    '德叔說他早上再過來，等他來了，我要先問他老老闆的事。',
    '我本來只想躺一下，燈還沒關就睡著了。',
  ]);
  assert.equal(room[1].optional, 'bed', '點床仍是可選');
  assert.deepEqual(S.monoLines('room'), [2, 3, 4, 5, 6, 7, 8, 9], '第 2 句起是本段自白');
  assert.deepEqual(room.map((b) => !!b.sleep), [false, false, false, false, false, false, false, false, false, true]);
  for (let i = 2; i < room.length; i++) assert.equal(OP.sceneAt(room, i).lying, true, `第 ${i} 句是躺下視角`);
  assert.ok(!OP.sceneAt(room, 1).lying);
  for (const b of room) assert.ok(!MARKS.test(b.text) && !b.who, '旁白、沒有標記');
});

test('稿件標記與括弧指示都不在畫面字裡（第一～四天的對白、旁白、章名、按鈕）', () => {
  const texts = [...dayLines().map((b) => b.text), ...Object.values(D.DAY_TITLES), ...D.PASSBOOK_CHOICES.map((c) => c.text)];
  assert.ok(texts.length > 300);
  for (const t of texts) {
    assert.ok(!MARKS.test(t), `還有標記：${t}`);
    assert.ok(!/^[（(]/.test(t) && !/[）)]$/.test(t), `舞台指示變成字：${t}`);
    assert.equal(t, t.trim());
  }
  assert.deepEqual(D.PASSBOOK_CHOICES.map((c) => c.text), ['把存摺放上吧台', '收著']);
  assert.deepEqual(Object.values(D.DAY_TITLES), ['第一天　最底下那個抽屜', '第二天　洗把臉', '第三天　第十二頁', '第四天　還剩十七張']);
  // 可玩流程不畫【待定】：閱讀框直接放字；三天模組的 fmt 也只去掉標記
  assert.doesNotMatch(code('src/view/reader.js') + code('src/view/days.js'), /【待定】|st-tag/);
  assert.match(read('src/main.js'), /const fmt = \(t\) => esc\(String\(t\)\.replace\(\/\^\(【\(待定\|待確認\|新增互動\)】\)\+\/, ''\)\);/);
});

test('作者親寫句一字不改（「甚麼」不是「什麼」，沒有【待定】）', () => {
  const all = [...Object.values(OP.OPENING_LINES).flat(), ...dayLines()].map((b) => [b.who, b.text]);
  const has = (who, text) => assert.ok(all.some(([w, t]) => w === who && t === text), `${who}：${text}`);
  has('deshu', '這邊比較偏僻，導航可能會不太準。');
  has('deshu', '老老闆交代過，要留一個房間讓妳睡。');
  has('me', '留給我？');
  has('deshu', '右邊護龍第一間整理好了，被子下午曬過。');
  has('me', '兩聲。我聽到了喔。');
  has('deshu', '看妳的氣色變好，最近是不是遇到甚麼好事了。');
  has(undefined, '鼻梁和臉頰上的雀斑還是一樣多，從國中就跟著我了。');
  has(undefined, '鼻梁跟臉頰上的雀斑，早上洗臉的時候全部不見了，連跟了我好幾年的黑眼圈也沒了。');
  has(undefined, '雀斑怎麼可能睡一覺就不見？');
  assert.ok(!all.some(([, t]) => t === '看妳的氣色變好，最近是不是遇到什麼好事了。'), '不能改成「什麼」');
});

test('有 _agent 稿件時：第一～四天與各晚自白的對白／旁白照順序與劇本 v4.5 逐字相同（沒有就略過）', (t) => {
  const p = root('_agent/v3b/script-v4.5.md');
  if (!existsSync(p)) { t.skip('沒有 _agent 稿件'); return; }
  const md = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const body = md.slice(md.indexOf('# 【待定】第一天'));
  const strip = (x) => x.replace(/^(【(待定|待確認|新增互動)】)+/, '');
  const names = Object.keys(D.SCRIPT_SPEAKERS).sort((a, b) => b.length - a.length).map((n) => n.replace(/[（）]/g, (c) => `\\${c}`));
  const re = new RegExp(`^(${names.join('|')})：「(.*)」$`);
  const spoken = [];
  const titles = [];
  const systems = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('---') || line.startsWith('**')) continue;
    if (line.startsWith('# ')) { titles.push(strip(line.slice(2))); continue; }
    if (line.startsWith('（')) { if (line.includes('系統：自白結束')) systems.push(spoken.length); continue; }
    const m = strip(line).match(re);
    spoken.push(m ? { who: D.SCRIPT_SPEAKERS[m[1]], text: m[2] } : { who: undefined, text: strip(line) });
  }
  const mine = dayLines().map((b) => ({ who: b.who, text: b.text }));
  assert.equal(mine.length, spoken.length);
  assert.deepEqual(mine, spoken);
  assert.deepEqual(titles, Object.values(D.DAY_TITLES));
  // 每晚「自白結束、睡著時自動存檔」那行之後到這一天結束的句子，就是本段自白（mono），最後一句是睡著（sleep）
  const ends = D.DAY_ACTS.map((a) => D.DAY_ACTS.slice(0, D.DAY_ACTS.indexOf(a) + 1).reduce((n, x) => n + D.DAY_LINES[x].length, 0));
  const nights = ['d1night', 'd2night', 'd3night', 'd4night'];
  assert.equal(systems.length, 4);
  nights.forEach((act, k) => {
    const end = ends[D.DAY_ACTS.indexOf(act)];
    const lines = D.DAY_LINES[act];
    const first = end - lines.length;
    const monoFromScript = Array.from({ length: end - systems[k] }, (_, j) => systems[k] - first + j);
    assert.deepEqual(S.monoLines(act), monoFromScript, `${act} 的自白範圍`);
    assert.ok(lines.at(-1).sleep);
  });
  // 第一晚 A 版（稿在開場段）：系統行之後到淡出那句是自白
  const open = md.slice(md.indexOf('（【待定】系統：自白結束'), md.indexOf('# 【待定】第一天')).split('\n').map((x) => x.trim())
    .filter((x) => x && !x.startsWith('（') && !x.startsWith('---')).map(strip);
  assert.deepEqual(S.monoLines('room').map((i) => OP.OPENING_LINES.room[i].text), open);
});

test('每一幕的結構：說話的人都有名牌、自白只在每晚最後、每晚剛好一句睡著、分支只在第一天晚上', () => {
  const known = new Set(['deshu', 'me', ...Object.keys(D.DAY_SPEAKERS)]);
  for (const b of dayLines()) assert.ok(b.who === undefined || known.has(b.who), b.who);
  for (const act of D.DAY_ACTS) {
    const lines = D.DAY_LINES[act];
    const night = act.endsWith('night');
    assert.equal(lines.filter((b) => b.sleep).length, night ? 1 : 0, act);
    if (night) {
      const mono = S.monoLines(act);
      assert.deepEqual(mono, mono.map((_, k) => mono[0] + k), `${act} 自白連續`);
      assert.equal(mono.at(-1), lines.length - 1, `${act} 自白到最後一句`);
      for (const i of mono) assert.equal(OP.sceneAt(lines, i).place, 'bed', `${act} 第 ${i} 句躺著`);
    } else assert.equal(S.monoLines(act).length, 0, `${act} 沒有自白`);
    assert.ok(lines.length > 0);
  }
  const br = dayLines().filter((b) => b.branch);
  assert.deepEqual([...new Set(br.map((b) => b.branch))], ['show', 'keep']);
  assert.ok(D.DAY_LINES.d1cafe.every((b) => !b.branch || b.branch === 'show' || b.branch === 'keep'));
  assert.deepEqual(S.CHOICE, { act: 'd1cafe', line: 4 });
});

/* ---------- 流程 ---------- */
test('第一晚睡著後進第一天（不停在待續）；一路照順序走完四天，第四天睡著後才待續', () => {
  const order = [];
  const { s } = walk(S.newStoryState(), {
    stop: S.isOpeningEnd,
    each: (st) => { if (order.at(-1) !== st.opening.act) order.push(st.opening.act); },
  });
  assert.deepEqual(order, S.OPENING_ACTS, '每一幕都走過一次，順序照列表');
  assert.equal(s.opening.act, S.END_ACT);
  assert.equal(S.nextActOf('room'), 'd1wake');
  for (const n of NIGHTS) assert.equal(S.nextActOf(n), MORNING_AFTER[n]);
  assert.equal(S.nextActOf(S.END_ACT), null, '待續之後沒有下一幕');
  // 在第四天睡著以前都不是待續
  const s2 = S.normalize(at('d4night', 0), SRC);
  assert.equal(S.isOpeningEnd(s2), false);
  // 執行畫面：待續才畫「待續」；第一晚的 room 讀完是睡著，不再呼叫舊的 finishOpening
  const main = code('src/main.js');
  assert.doesNotMatch(main, /finishOpening/);
  assert.equal((main.match(/if \(done === 'slept'\) return fallAsleep\(\);/g) || []).length, 2, '第一晚（開場 room）與第一～四天每晚都是睡著後淡出');
});

test('兩個存摺按鈕都走得完、各自只播自己那一支，再合流到第 1 杯；每一句都讀到', () => {
  const seenShow = walk(S.normalize(at('d1cafe', 0), SRC), { passbook: 'show', stop: (s) => s.opening.act !== 'd1cafe' }).seen.map((b) => b.text);
  const seenKeep = walk(S.normalize(at('d1cafe', 0), SRC), { passbook: 'keep', stop: (s) => s.opening.act !== 'd1cafe' }).seen.map((b) => b.text);
  const L = D.DAY_LINES.d1cafe;
  const only = (br) => L.filter((b) => b.branch === br).map((b) => b.text);
  for (const t of only('show')) { assert.ok(seenShow.includes(t)); assert.ok(!seenKeep.includes(t)); }
  for (const t of only('keep')) { assert.ok(seenKeep.includes(t)); assert.ok(!seenShow.includes(t)); }
  const merge = '是早上那個杯子。他放下來的時候，把手朝右。';
  assert.ok(seenShow.includes(merge) && seenKeep.includes(merge));
  assert.equal(seenShow.at(-1), seenKeep.at(-1));
  // 全部句子：兩種走法合起來，第一～四天每一句都出現
  const all = new Set([...walk(S.normalize(at('d1wake'), SRC), { passbook: 'show', stop: S.isOpeningEnd }).seen,
    ...walk(S.normalize(at('d1wake'), SRC), { passbook: 'keep', stop: S.isOpeningEnd }).seen]);
  for (const b of dayLines()) assert.ok(all.has(b), `沒讀到：${b.text}`);
});

/* ---------- 睡著自動存檔 ---------- */
test('每晚睡著自動存檔：睡著那一句一出現就存成隔天早上（第四天是待續），讀回不在自白中間、不重播自白', () => {
  for (const night of NIGHTS) {
    const st = fakeStorage();
    const s = S.normalize(at(night, 0), SRC);
    // 照玩家讀到睡著那一句（main.js 的 runLines：顯示 sleep 那一句時 sleepThrough + 存檔）
    while (!S.ACT_LINES[night][s.opening.line].sleep) step(s);
    persist(s, st); // 睡著之前一句一句都有存（停在自白中間時讀回就是那一句）
    assert.equal(load(SRC, st).opening.act, night);
    assert.equal(S.sleepThrough(s), true);
    persist(s, st);
    const back = load(SRC, st);
    assert.equal(back.opening.act, MORNING_AFTER[night], `${night} 讀回`);
    assert.equal(back.opening.line, 0);
    assert.equal(S.inMonologue(back), false, '不在自白裡');
    if (night === 'd4night') assert.equal(S.isOpeningEnd(back), true, '第四天之後是待續');
    assert.deepEqual([...st.m.keys()], [SAVE_KEY]);
    for (const k of OTHER_KEYS) assert.equal(st.m.has(k), false);
  }
  // 執行畫面：睡著那一句一出現就存（不是等淡出之後），點了跳過也存
  const main = code('src/main.js');
  assert.match(main, /if \(b\.sleep && S\.sleepThrough\(state\)\) save\(\);/);
  assert.match(main, /if \(ok === 'skip'\) \{\s*if \(S\.skipMonologue\(state\)\) save\(\);\s*return 'slept';/);
  assert.match(main, /if \(b\.sleep\) return 'slept';/, '睡著那一句點完不再往同一幕找下一句');
  // 開場每一句都存：維持（翻到下一句就 setOpeningLine + save）
  assert.match(main, /if \(!S\.setOpeningLine\(state, n\)\) return false;\s*save\(\);/);
});

/* ---------- 跳過自白（純邏輯） ---------- */
test('跳過自白：自白裡任何一句都能一次跳完並睡著；不在自白裡（含白天、自白前的那兩句）不能跳', () => {
  for (const night of NIGHTS) {
    for (const i of S.monoLines(night)) {
      const s = S.normalize(at(night, i), SRC);
      assert.equal(S.inMonologue(s), true);
      const st = fakeStorage();
      assert.equal(S.skipMonologue(s), true, `${night} 第 ${i} 句`);
      persist(s, st);
      const back = load(SRC, st);
      assert.equal(back.opening.act, MORNING_AFTER[night]);
      assert.equal(back.opening.line, 0);
    }
  }
  assert.equal(S.skipMonologue(S.normalize(at('room', 1), SRC)), false, '點床那一句還不是自白');
  assert.equal(S.skipMonologue(S.normalize(at('d1night', 0), SRC)), false);
  assert.equal(S.skipMonologue(S.normalize(at('d4night', 2), SRC)), false, '「我關了燈，躺下來。」還不是自白');
  assert.equal(S.skipMonologue(S.normalize(at('d2shop', 3), SRC)), false);
  assert.equal(S.skipMonologue(S.normalize(at(S.END_ACT), SRC)), false);
});

/* ---------- 跳過自白（閱讀框：假 DOM） ---------- */
class El {
  constructor(cls = '', parent = null) {
    this.className = cls; this.parent = parent; this.hidden = false; this.listeners = {}; this.dataset = {}; this.style = {};
    this.innerHTML = ''; this.textContent = ''; this.disabled = false; this.kids = {};
    const set = () => new Set(this.className.split(/\s+/).filter(Boolean));
    this.classList = {
      add: (...c) => { const s = set(); c.forEach((x) => s.add(x)); this.className = [...s].join(' '); },
      remove: (...c) => { const s = set(); c.forEach((x) => s.delete(x)); this.className = [...s].join(' '); },
      contains: (c) => set().has(c),
      toggle: (c, on) => { const has = set().has(c); if (on ?? !has) this.classList.add(c); else this.classList.remove(c); },
    };
  }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  querySelector(sel) { return this.kids[sel] || null; }
  closest(sel) {
    const want = sel.split(',').map((x) => x.trim());
    for (let e = this; e; e = e.parent) {
      for (const w of want) {
        if (w.startsWith('.') && e.classList.contains(w.slice(1))) return e;
        if (!w.startsWith('.') && !w.startsWith('[') && e.tag === w) return e;
      }
    }
    return null;
  }
  blur() {}
  get offsetWidth() { return 0; }
  dispatch(type, extra = {}) {
    let stopped = false;
    const ev = { type, target: this, stopPropagation() { stopped = true; }, preventDefault() {}, ...extra };
    for (let e = this; e && !stopped; e = e.parent) for (const f of e.listeners[type] || []) f(ev);
  }
}
async function fakeReader() {
  const winKeys = [];
  globalThis.addEventListener ??= (t, f) => { if (t === 'keydown') winKeys.push(f); };
  globalThis.requestAnimationFrame ??= () => 0;
  globalThis.cancelAnimationFrame ??= () => {};
  let now = 1000;
  const realNow = performance.now.bind(performance);
  performance.now = () => now;
  const { createReader, SKIP_ARM_MS, TAP_GUARD_MS, SKIP_LABEL } = await import('../../src/view/reader.js');
  const root = new El('');
  const app = new El('');
  app.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 });
  root.kids['.opr-box'] = new El('st-box opr-box', root);
  root.kids['.opr-portrait'] = new El('opr-portrait', root);
  root.kids['.opr-hot'] = new El('opr-hot', root);
  const skip = new El('opr-skip', root);
  skip.tag = 'button';
  skip.hidden = true;
  root.kids['.opr-skip'] = skip;
  const r = createReader(root, app);
  const key = (k, target) => { for (const f of winKeys) f({ key: k, target, preventDefault() {} }); };
  return { r, root, skip, box: root.kids['.opr-box'], key, tick: (ms) => { now += ms; }, restore: () => { performance.now = realNow; }, SKIP_ARM_MS, TAP_GUARD_MS, SKIP_LABEL };
}

test('跳過自白的按鈕：與翻一句分開；點正文只翻一句；剛出現時不收點；點了一次跳完；Enter／Space 只翻一句', async () => {
  const f = await fakeReader();
  try {
    const { r, skip, box, key, tick } = f;
    assert.equal(f.SKIP_LABEL, '跳過自白');
    assert.ok(f.SKIP_ARM_MS >= 3 * f.TAP_GUARD_MS, '防誤觸時間比一句的連點防護長');
    const mono = { text: '外面有蟲在叫，遠一點的地方有狗叫了幾聲，又停了。', mono: true };
    // 白天的句子：沒有跳過按鈕
    r.show({ text: '我是被雞叫醒的。' });
    r.skip(false);
    assert.equal(skip.hidden, true);
    // 進入自白：按鈕出現，但剛出現（進入自白的那一下、翻到第一句的那一下）點了不算
    r.show(mono);
    r.skip(true);
    assert.equal(skip.hidden, false);
    let p = r.next();
    let got = null;
    p.then((v) => { got = v; });
    tick(f.TAP_GUARD_MS + 10);
    skip.dispatch('click');
    await Promise.resolve();
    assert.equal(got, null, '剛出現就點：不跳過，也不會變成翻一句');
    assert.equal(r.waiting, true);
    // 點正文：只翻一句（回傳 true，不是 skip）
    box.dispatch('click');
    assert.equal(await p, true);
    // 下一句自白：按鈕還在、同一段自白不重新計時；點正文仍只翻一句
    r.show({ text: '被子真的有曬過，德叔沒有騙我。', mono: true });
    r.skip(true);
    tick(f.SKIP_ARM_MS);
    p = r.next();
    // Enter／Space：只翻一句；焦點停在跳過按鈕上也一樣
    key('Enter', skip);
    assert.equal(await p, true, 'Enter 只翻一句');
    r.show({ text: '可是他說老老闆交代過，要留一個房間讓我睡。', mono: true });
    tick(f.TAP_GUARD_MS + 10);
    p = r.next();
    key(' ', skip);
    assert.equal(await p, true, 'Space 只翻一句');
    // 點跳過按鈕（已過防誤觸時間）：一次跳完（回傳 skip）
    r.show({ text: '老老闆怎麼會知道我今天晚上回不去？', mono: true });
    tick(f.TAP_GUARD_MS + 10);
    p = r.next();
    skip.dispatch('click');
    assert.equal(await p, 'skip');
    // 離開自白：按鈕收起來；再進下一晚的自白重新計時
    r.skip(false);
    assert.equal(skip.hidden, true);
    r.show(mono);
    r.skip(true);
    p = r.next();
    got = null;
    p.then((v) => { got = v; });
    tick(f.TAP_GUARD_MS + 10);
    skip.dispatch('click');
    await Promise.resolve();
    assert.equal(got, null, '下一晚剛出現時一樣不收點');
    r.hide();
    assert.equal(await p, false);
    assert.equal(skip.hidden, true, '收起閱讀框時按鈕也收起來');
  } finally { f.restore(); }
});

test('跳過自白的版面：右上角、至少 44px、在閱讀框外；按鈕只在 #op-read 裡一個', () => {
  const html = read('index.html');
  assert.match(html, /<button type="button" class="opr-skip" hidden><\/button><\/section>/);
  const css = html.match(/#op-read \.opr-skip \{([^}]*)\}/)[1];
  assert.match(css, /top: calc\(12px/);
  assert.match(css, /right: 12px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /pointer-events: auto/);
  assert.doesNotMatch(css, /bottom:/, '不靠近下方的閱讀框');
  const reader = read('src/view/reader.js');
  assert.match(reader, /if \(!pending \|\| e\.target\.closest\('\.opr-hotspot, \.opr-skip'\)\) return;/, '點按鈕不會順便翻一句');
  assert.match(reader, /if \(skipBtn\.hidden \|\| !pending \|\| performance\.now\(\) < skipArmed\) return;/);
  assert.match(code('src/main.js'), /reader\.skip\(!!b\.mono\);/, '只在自白（mono）的句子出現');
});

/* ---------- 關卡與可選互動 ---------- */
test('關卡（無不做選項）不做不能往下：存摺拖到櫃檯、識別證放到櫃檯、撕膠帶、倒片、存摺兩個按鈕', () => {
  const gates = dayLines().filter((b) => b.gate).map((b) => b.gate);
  assert.deepEqual(gates, ['passbook', 'choice', 'badge', 'tape', 'rewind']);
  for (const act of D.DAY_ACTS) {
    const lines = D.DAY_LINES[act];
    lines.forEach((b, i) => {
      if (!b.gate) return;
      assert.ok(i < lines.length - 1, `${act} 的關卡不在最後一句（翻不到下一句就走不到下一幕）`);
      assert.ok(!b.optional && !b.mono, `${act} 關卡句不是可選也不是自白`);
      const s = S.normalize(at(act, i), SRC);
      assert.equal(S.setOpeningLine(s, i + 1), false, `${act}：${b.gate} 沒做不能翻`);
      assert.equal(S.setOpeningLine(s, lines.length - 1), false, `${act}：也不能一次跳過去`);
      assert.equal(S.passGate(s, 'door'), false, '別的關卡名不算');
      if (b.gate === 'choice') {
        assert.equal(S.passGate(s, 'choice'), false, '兩個按鈕要用 choosePassbook');
        assert.equal(S.choosePassbook(s, 'maybe'), false);
        assert.equal(S.choosePassbook(s, 'keep'), true);
        assert.equal(S.choosePassbook(s, 'show'), false, '只選一次');
        assert.equal(S.setOpeningLine(s, S.nextLine(s)), true);
        assert.equal(S.beatAt(s).branch, 'keep');
      } else {
        assert.equal(S.passGate(s, b.gate), true);
        assert.equal(S.setOpeningLine(s, i + 1), true, `${act}：${b.gate} 做完可以翻`);
      }
      // 讀檔回到關卡那一句：要重做（做完的狀態不進存檔）
      const r = S.normalize(at(act, i), SRC);
      assert.equal(S.setOpeningLine(r, i + 1), false);
    });
  }
  // 畫面：關卡用 props.gate，做完才 resolve(true)；存摺按鈕剛出現時不收點
  const view = read('src/view/days.js');
  assert.match(view, /if \(name === 'passbook' \|\| name === 'badge'\)/);
  assert.match(view, /if \(n >= TAPE_TIMES\)/);
  assert.equal(TAPE_TIMES, 3);
  assert.match(view, /if \(turned >= REWIND_TURNS \* 360\)/);
  assert.ok(REWIND_TURNS >= 1);
  assert.match(view, /if \(performance\.now\(\) < armed \|\| settled\) return;/);
  assert.match(code('src/main.js'), /if \(ok && my === token\) S\.passGate\(state, b\.gate\);/);
});

test('可選互動（寫「不點也能／劇情照走／不拍也可以」的）不是關卡：不做也能一句一句走完', () => {
  const opt = dayLines().filter((b) => b.optional).map((b) => b.optional);
  assert.deepEqual([...new Set(opt)].sort(), ['clothes', 'cup', 'drawer', 'faucet', 'focus', 'gateCard', 'keyGive', 'lever', 'mailbox', 'reply', 'report', 'shutter', 'stroke', 'switch'].sort());
  for (const b of dayLines().filter((x) => x.optional)) assert.ok(!b.gate, `${b.optional} 不能擋住劇情`);
  // walk() 從不做可選互動，照樣走到待續
  const { seen } = walk(S.normalize(at('d1wake'), SRC), { stop: S.isOpeningEnd });
  for (const b of dayLines().filter((x) => x.optional)) assert.ok(seen.includes(b), b.text);
  // 快門可以拍幾張都不影響後面的字；計數窗 19 → 最多 36（後面還有十七張）
  assert.equal(FILM_START, 19);
  assert.equal(FILM_END - FILM_START, 17);
  // 可選互動的熱點至少 44px（沿用閱讀框的熱點）；拖曳的東西 96px
  assert.match(read('src/view/reader.js'), /const w = Math\.max\(44, r\.w\);\s*const hh = Math\.max\(44, r\.h\);/);
  const css = read('index.html');
  assert.match(css, /\.pp-drag \{[^}]*width: 96px; height: 96px;/);
  assert.match(css, /\.pp-shutter \{[^}]*width: 64px; height: 64px;/);
  assert.match(css, /\.pp-choices button \{ min-height: 56px;/);
});

/* ---------- 舊存檔相容 ---------- */
test('舊存檔：v1 停在開場中途照原幕原句；room 第 2 句落到自白第一句（躺下）；舊待續 end 接到第一天早上', () => {
  // 開場中途（舊檔沒有 passbook 欄位）：原幕原句，可繼續往下並看到新的第一晚自白
  let r = S.playable(S.normalize(at('deshu', 12), SRC));
  assert.equal(r.opening.act, 'deshu');
  assert.equal(r.opening.line, 12);
  assert.equal(r.opening.passbook, null, '補預設');
  assert.equal(r.v, 1);
  const seen = walk(r, { stop: (s) => s.opening.act === 'd1wake' }).seen.map((b) => b.text);
  assert.ok(seen.includes('外面有蟲在叫，遠一點的地方有狗叫了幾聲，又停了。'));
  // room 第 2 句（舊的睡著句）→ 自白第一句，躺下視角
  r = S.playable(S.normalize(at('room', 2), SRC));
  assert.equal(r.opening.act, 'room');
  assert.equal(r.opening.line, 2);
  assert.equal(S.beatAt(r).text, '外面有蟲在叫，遠一點的地方有狗叫了幾聲，又停了。');
  assert.equal(OP.sceneAt(OP.OPENING_LINES.room, 2).lying, true);
  assert.equal(S.inMonologue(r), true);
  // 舊待續（第一晚已結束）：不卡在待續、不重開，接到第一天早上
  for (const raw of [at('end', 0), at('end', 7), { ...at('end', 0), opening: { act: 'end', resignation: 'fire', fork: 'left', deshuLine: 3 } }]) {
    r = S.playable(S.normalize(raw, SRC));
    assert.equal(r.phase, 'opening');
    assert.equal(r.opening.act, 'd1wake');
    assert.equal(r.opening.line, 0);
    assert.equal(S.isOpeningEnd(r), false);
  }
  r = S.normalize({ ...at('end'), opening: { act: 'end', resignation: 'fire', fork: 'left' } }, SRC);
  assert.equal(r.opening.resignation, 'fire', '前面的選擇留著');
  assert.equal(r.opening.fork, 'left');
  // fake localStorage：舊檔存進去、讀回接得上
  const st = fakeStorage();
  st.setItem(SAVE_KEY, JSON.stringify(at('end', 0)));
  assert.equal(S.playable(load(SRC, st)).opening.act, 'd1wake');
});

test('舊存檔：deshuLine 別名、壞檔夾範圍、還沒到岔路丟 fork、三天故事 phase story 打回開場開頭、版本不是 1 才重來', () => {
  let r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'deshu', deshuLine: 4 } }, SRC);
  assert.equal(r.opening.line, 4);
  r = S.normalize(at('d3town', 999), SRC);
  assert.equal(r.opening.line, D.DAY_LINES.d3town.length - 1);
  r = S.normalize(at('d2cafe', -5), SRC);
  assert.equal(r.opening.line, 0);
  r = S.normalize(at('ride', 0, { fork: 'left' }), SRC);
  assert.equal(r.opening.fork, null);
  r = S.normalize(at('d2wake', 0, { fork: 'right' }), SRC);
  assert.equal(r.opening.fork, 'right', '過了岔路的選擇留著');
  r = S.normalize(at('nope', 3), SRC);
  assert.equal(r.opening.act, 'office');
  const old = S.enterStory(S.newStoryState());
  assert.deepEqual(S.playable(reload(old)), S.newStoryState(), '舊三天故事：回到開場開頭');
  assert.deepEqual(S.normalize({ v: 2, phase: 'opening', opening: { act: 'd2wake' } }, SRC), S.newStoryState());
  assert.equal(S.SCHEMA, 1, '加了第一～四天仍是 v1');
});

test('存摺選擇的存檔：還沒走到按鈕就不算選過；停在沒選到的那一支裡回到按鈕重選；選過的留著', () => {
  const c = S.CHOICE;
  let r = S.normalize(at('d1town', 3, { passbook: 'show' }), SRC);
  assert.equal(r.opening.passbook, null);
  r = S.normalize(at(c.act, c.line, { passbook: 'show' }), SRC);
  assert.equal(r.opening.passbook, null, '停在按鈕那一句：還沒選');
  const keepLine = D.DAY_LINES.d1cafe.findIndex((b) => b.branch === 'keep');
  r = S.normalize(at(c.act, keepLine, { passbook: 'show' }), SRC);
  assert.equal(r.opening.line, c.line, '走錯支：回到按鈕');
  assert.equal(r.opening.passbook, null);
  r = S.normalize(at(c.act, keepLine, { passbook: 'keep' }), SRC);
  assert.equal(r.opening.line, keepLine);
  assert.equal(r.opening.passbook, 'keep');
  r = S.normalize(at('d3wake', 2, { passbook: 'zzz' }), SRC);
  assert.equal(r.opening.passbook, null);
  r = S.normalize(at('d3wake', 2, { passbook: 'keep' }), SRC);
  assert.equal(r.opening.passbook, 'keep');
});

test('每一幕、每一句存檔讀回都在同一處（四天全程；兩種存摺選擇）', () => {
  for (const passbook of ['show', 'keep']) {
    let n = 0;
    walk(S.normalize(at('room'), SRC), {
      passbook,
      stop: S.isOpeningEnd,
      each: (st) => {
        const r = reload(st);
        assert.equal(r.opening.act, st.opening.act);
        assert.equal(r.opening.line, st.opening.line, `${st.opening.act} 第 ${st.opening.line} 句`);
        assert.equal(r.opening.passbook, st.opening.passbook, `${st.opening.act} 第 ${st.opening.line} 句的存摺`);
        n++;
      },
    });
    assert.ok(n > 300);
  }
});

/* ---------- 美術 ---------- */
test('美術：第一～四天用到的原圖都在 assets/art、有預載；不去要不存在的圖；庭埕夜景與房間用既有原圖', () => {
  const files = new Set(readdirSync(root('assets/art')));
  for (const n of DAY_ART) assert.ok(files.has(`${n}.webp`), `缺 ${n}.webp`);
  for (const p of Object.values(PLACES)) assert.ok(files.has(`${p.src}.webp`), p.src);
  const view = read('src/view/days.js');
  for (const m of view.matchAll(/art\('([\w]+)'\)|src: '([\w]+)'/g)) assert.ok(files.has(`${m[1] || m[2]}.webp`), `缺 ${m[1] || m[2]}.webp`);
  // 用到的場景都有定義
  for (const act of D.DAY_ACTS.filter((a) => D.DAY_ACT_VIEW[a] === 'still')) for (const k of placesOf(D.DAY_LINES[act])) assert.ok(PLACES[k], `${act}：${k}`);
  assert.equal(PLACES.roomNight.src, 'scene_v3b_room_night');
  assert.equal(PLACES.bed.src, 'scene_v3b_bed_pov_night');
  assert.equal(PLACES.courtyard.src, 'scene_v3b_courtyard_night_v2');
  // 第四天回房間：庭埕 → 房間 → 躺下
  assert.deepEqual(placesOf(D.DAY_LINES.d4night), ['courtyard', 'roomNight', 'bed']);
  // 老太太：遠景、不可點、不標示
  const css = read('index.html');
  assert.match(css, /\.dy-lady \{[^}]*pointer-events: none;/);
  assert.match(view, /<img class="dy-lady" src="\$\{art\(OLD_LADY\.src\)\}" alt="" aria-hidden="true"/);
  for (const k of ['bank', 'lobby', 'meeting', 'orchard']) assert.ok(PLACES[k].lady, k);
  // 執行畫面預載
  assert.match(read('src/main.js'), /preload\(\[\.\.\.new Set\(\[\.\.\.allArt\(\), \.\.\.DAY_ART\]\)\]\)/);
  assert.equal(YIJUN_CARD.base, 'char_v3b_yijun_card_v2');
  assert.equal(YIJUN_CARD.flawed, 'char_v3b_yijun_card_flawed_v2'); // v3 尚未到
  assert.equal(YIJUN_CARD.better, 'char_v3b_yijun_card_better_v2');
  assert.equal(YIJUN_CARD.bites, 'char_v3b_yijun_card_bites');
  assert.equal(yijunCardFor('d1wake'), YIJUN_CARD.flawed);
  assert.equal(yijunCardFor('d2wake'), YIJUN_CARD.better);
  assert.equal(yijunCardFor('d3wake'), YIJUN_CARD.better);
  assert.equal(yijunCardFor('d4wake'), YIJUN_CARD.bites);
  assert.match(read('src/view/days.js'), /class="dy-face"/);
  assert.match(read('index.html'), /\.dy-face \{/);
  // 不以程式畫人形；鏡子裡的怡君用角色卡原圖。立繪只用畫師原圖（德叔、阿桂、怡君角色卡）；宜蓁沒有對應立繪（char_v3_junior_half 不是她），不拿來用
  assert.doesNotMatch(code('src/view/days.js') + code('src/main.js'), /drawShape|granny|junior/);
  // 不加外部音檔；新音效都有定義
  const audio = read('src/view/audio.js');
  const sfx = new Set(['shutter', 'tape', 'rewind', 'copier', 'beep', 'water', 'buzz', 'ding', 'page']);
  for (const b of dayLines()) for (const n of b.sfx || []) sfx.add(n);
  for (const n of sfx) assert.ok(audio.includes(`case '${n}':`), `沒有音效 ${n}`);
  assert.doesNotMatch(read('src/view/days.js'), /\.(mp3|ogg|wav|m4a)\b/);
});

test('缺圖清單：docs/v3b-缺圖清單.md 列出 fallback 場景與道具', () => {
  const doc = read('docs/v3b-缺圖清單.md');
  for (const w of ['角色卡', '租屋處房間', '銀行', '會議室', '郵局', '阿桂', '果園', '相機', '洗手台', '宜蓁']) assert.ok(doc.includes(w), w);
  for (const p of Object.values(PLACES)) assert.ok(doc.includes(p.src), `清單沒寫到 fallback ${p.src}`);
});
