// 劇本獨立檔（D224，承峰 11/7：「把需要頻繁對話的程式設計，把劇情獨立出來一個檔案管理」）：
// vendor/yaml-lite.js 的解析、src/script.js 的編譯（說話者、旁白、選項 id、條件字串）、劇本檔的結構、
// 客人註冊表、存檔 13 → 14（選項 index → id）、旁白的泡泡樣式、npm run script:view。
// 只檢查結構與【原句】；【待定】的句子之後由 fable 整段重寫，不逐字比對。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, YamlError } from '../../vendor/yaml-lite.js';
import * as SC from '../../src/script.js';
import * as VS from '../../src/visits.js';
import * as S from '../../src/story.js';
import * as F from '../../src/farewell.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION, choiceTable } from '../../src/save.js';
import { renderView } from '../script-view.mjs';

const T0 = new Date(2026, 10, 7, 9, 0).getTime();
const newSave = () => { const s = defaultSave(T0); giveStarters(s); s.flags.seenOpening = true; return s; };
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('yaml-lite：mapping、sequence、sequence 裡的 mapping、flow、引號、數字與布林、註解、區塊字串', () => {
  const doc = parse([
    '# 註解',
    'a: 1',
    'b: 1.5',
    'c: true',
    'd: ~',
    'e: 中文，句子。 # 行尾註解',
    "f: 'a: b # 不是註解'",
    'g: "雙引號\\n換行"',
    'list:',
    '  - x',
    '  - k: v',
    '    k2: [1, two, { z: 3 }]',
    '  -',
    '    deep: yes',
    'same:',
    '- 同一欄的清單',
    'block: |',
    '  第一行',
    '  第二行',
    'flow: { do: serve, who: 予安, kind: hot }',
    'conds: [flag:metYuan, milestone:yuan2]',
  ].join('\n'));
  assert.deepEqual(doc, {
    a: 1, b: 1.5, c: true, d: null, e: '中文，句子。', f: 'a: b # 不是註解', g: '雙引號\n換行',
    list: ['x', { k: 'v', k2: [1, 'two', { z: 3 }] }, { deep: 'yes' }],
    same: ['同一欄的清單'], block: '第一行\n第二行', flow: { do: 'serve', who: '予安', kind: 'hot' },
    conds: ['flag:metYuan', 'milestone:yuan2'],
  });
  // 看不懂的寫法：丟出含行號的錯誤
  assert.throws(() => parse('a: 1\n  b: 2'), YamlError);
  assert.throws(() => parse('a: 1\na: 2'), /第 2 行/);
  assert.throws(() => parse('a: !tag x'), YamlError);
  assert.throws(() => parse('\ta: 1'), /Tab/);
});

test('編譯：說話者、旁白、只帶對象的步驟、原樣步驟、when 的 not、choice 的 id 與 then 變成 branch', () => {
  const C = SC.compiler(SC.SCRIPT.shared);
  const steps = C.steps([
    { 德叔: '嗯。' },
    { 旁白: '窗外下著雨。' },
    { 主管: '你有沒有在聽？', name: '視訊裡的主管' },
    { look: '窗外' }, { glance: '德叔' }, 'deshuHome', { wait: 2 },
    { do: 'serve', who: '予安', kind: 'hot' },
    { do: 'laugh', who: ['阿哲', '阿公'] },
    { when: 'not met', steps: [{ 予安: '你好。' }] },
    { choice: 'k', options: [{ a: '甲', then: [{ 德叔: 'A' }] }, { b: '乙' }] },
  ], 'test');
  assert.deepEqual(steps, [
    { do: 'say', who: 'deshu', text: '嗯。' },
    { do: 'narrate', text: '窗外下著雨。' },
    { do: 'say', who: 'boss', text: '你有沒有在聽？', name: '視訊裡的主管' },
    { do: 'look', who: 'window' }, { do: 'glance', who: 'deshu' }, { do: 'deshuHome' }, { do: 'wait', sec: 2 },
    { do: 'serve', who: 'yuan', kind: 'hot' },
    { do: 'laugh', who: ['zhe', 'grandpa'] },
    { do: 'when', if: '!met', steps: [{ do: 'say', who: 'yuan', text: '你好。' }] },
    { do: 'choice', key: 'k', options: [{ id: 'a', text: '甲' }, { id: 'b', text: '乙' }] },
    { do: 'branch', key: 'k', cases: { a: [{ do: 'say', who: 'deshu', text: 'A' }], b: [] } },
  ]);
  // 打錯字會在載入時就擋下來（不會到了遊戲裡才默默跳過）
  assert.throws(() => C.steps([{ 德书: '錯字' }], 't'), /不認得的步驟/);
  assert.throws(() => C.steps([{ look: '火星' }], 't'), /不認得的人或地方/);
  assert.throws(() => C.steps([{ 德叔: '嗯。', tag: '定稿' }], 't'), /tag 只能是/);
  assert.throws(() => C.steps([{ choice: 'x', options: [{ 1: '數字 id' }] }], 't'), /英文小寫開頭/);
  assert.throws(() => C.steps([{ choice: 'y', options: [{ a: '一' }, { a: '二' }] }], 't'), /重複/);
  assert.throws(() => C.steps([{ do: 'when', if: 'met', steps: [] }], 't'), /請用/);
  assert.throws(() => C.steps([{ choice: 'z', options: [{ a: '一' }] }, { choice: 'z', options: [{ a: '一' }] }], 't'), /用過了/);
});

test('劇本檔：四個檔、段落與里程碑都在、每段有 id／who／kind、第一杯的選項有 treat', () => {
  assert.deepEqual(SC.FILES, ['_shared', 'yuan', 'zhe', 'kevin']);
  for (const f of SC.FILES) assert.ok(read(`scripts/${f}.yaml`).length > 100, f);
  assert.equal(VS.SEGMENTS, SC.SCRIPT.segments);
  assert.deepEqual(VS.SEGMENTS.map((s) => s.id), ['yuan-v1', 'yuan-v2', 'yuan-v3', 'yuan-r2', 'yuan-v4', 'yuan-v5', 'yuan-v6', 'yuan-r3',
    'zhe-v1', 'zhe-v2', 'zhe-v3', 'zhe-v4', 'zhe-r2', 'kevin-v1', 'kevin-v2', 'kevin-v3', 'kevin-v5', 'kevin-v6', 'kevin-v7', 'kevin-r3']);
  for (const s of VS.SEGMENTS) {
    assert.ok(['with', 'visit', 'reconnect'].includes(s.kind), s.id);
    assert.equal(SC.SCRIPT.file[s.id], s.who, `${s.id} 在 scripts/${s.who}.yaml`);
    assert.ok(s.steps.length > 0, s.id);
    const inv = VS.inviteOf(s);
    if (inv) {
      assert.deepEqual(inv.options.map((o) => o.id).sort(), ['treat', inv.options.find((o) => o.id !== 'treat').id].sort(), `${s.id} 的第一杯兩個選項，其中一個是 treat`);
      assert.ok(Array.isArray(inv.yes) && Array.isArray(inv.no) && Array.isArray(inv.missing) && inv.drink, s.id);
    }
  }
  // 18 個里程碑都從劇本檔拿到台詞，條件仍是 story.js 的函式（劇本檔裡沒有程式）
  assert.equal(S.MILESTONES.length, 18);
  for (const m of S.MILESTONES) {
    assert.equal(SC.SCRIPT.file[m.id], m.who);
    assert.equal(typeof m.when, 'function');
    assert.ok(m.scene.length > 0);
  }
  for (const f of SC.FILES) assert.doesNotMatch(read(`scripts/${f}.yaml`), /=>|function\s*\(/, `${f}.yaml 沒有程式碼`);
});

test('條件一律是字串：when 的條件都認得；別名在 _shared.yaml', () => {
  const conds = [];
  const walk = (list) => { for (const s of list || []) { if (s.do === 'when') { assert.equal(typeof s.if, 'string'); conds.push(s.if); } walk(s.steps); Object.values(s.cases || {}).forEach(walk); } };
  for (const s of VS.SEGMENTS) walk(s.steps);
  for (const m of S.MILESTONES) walk(m.scene);
  const known = /^!?(catSill|peeked|met|(flag|early|seg|milestone):[\w-]+)$/;
  for (const c of conds) assert.match(c, known);
  assert.deepEqual(SC.SCRIPT.conds, { peeked: 'early:d1-peek', met: 'flag:metYuan' });
  const s = newSave();
  assert.equal(VS.condOk(s, 'met'), false);
  assert.equal(VS.condOk(s, 'not met'), true);
  s.flags.metYuan = true;
  assert.equal(VS.condOk(s, 'flag:metYuan'), true);
  assert.equal(VS.condOk(s, '!met'), false);
  s.moments.early.push('d1-peek');
  assert.equal(VS.condOk(s, 'peeked'), true);
  assert.equal(VS.condOk(s, 'milestone:yuan1'), false);
  S.complete(s, S.milestoneById('yuan1'), 2);
  assert.equal(VS.condOk(s, 'milestone:yuan1'), true);
  assert.equal(VS.condOk(s, 'seg:yuan-v2'), false);
  s.rel.done.push('yuan-v2');
  assert.equal(VS.condOk(s, 'seg:yuan-v2'), true);
});

test('客人註冊表：名字、第一次來、來店機率從 _shared.yaml 來；說出名字以前的稱呼與自我介紹是資料', () => {
  assert.deepEqual(S.REGULAR_IDS, ['yuan', 'zhe', 'kevin']);
  assert.deepEqual(Object.fromEntries(S.REGULAR_IDS.map((w) => [w, [S.REGULARS[w].short, S.REGULARS[w].first, S.REGULARS[w].rate, S.REGULARS[w].salt]])),
    { yuan: ['予安', 2, 0.85, 101], zhe: ['阿哲', 1, 0.6, 202], kevin: ['凱文', 3, 0.9, 303] });
  const s = newSave();
  assert.equal(VS.strangerName(s, 'yuan'), '窗邊的小姐');
  assert.equal(VS.strangerName(s, 'yuan', { visits: false }), null, '&visits=0 照舊叫名字');
  assert.equal(VS.strangerName(s, 'kevin'), '冰美式先生');
  assert.equal(VS.strangerName(s, 'kevin', { visits: false }), '冰美式先生', '凱文的稱呼不看來訪段落');
  assert.equal(VS.strangerName(s, 'zhe'), null);
  S.complete(s, S.milestoneById('kevin1'), 3); S.complete(s, S.milestoneById('kevin2'), 4);
  assert.equal(VS.strangerName(s, 'kevin'), null, '主管叫出他的名字以後');
  // 自我介紹：第 2 次來訪演過（或 yuan2 以後）才說；說過就不再說
  const t = newSave();
  assert.equal(VS.introLine(t, 'yuan'), null);
  assert.equal(VS.introLine(t, 'yuan', { visits: false }), '……啊，你好。我叫予安，常坐在這裡寫稿。');
  t.rel.done.push('yuan-v2');
  assert.equal(VS.introLine(t, 'yuan'), '……啊，你好。我叫予安，常坐在這裡寫稿。');
  t.flags[VS.introFlag('yuan')] = true;
  assert.equal(VS.introLine(t, 'yuan'), null);
  assert.equal(VS.yuanStranger(t), false);
  assert.equal(VS.introLine(t, 'zhe'), null);
  // main.js 不再寫死予安、凱文的稱呼與自我介紹
  const main = read('src/main.js');
  assert.doesNotMatch(main, /'冰美式先生'|我叫予安/);
  assert.match(main, /VS\.strangerName\(/);
  assert.match(main, /VS\.introLine\(/);
});

test('選項穩定 id：每個 choice 的選項是 { id, text }，id 不重複；branch 的分支用 id 對應', () => {
  const table = choiceTable();
  for (const [key, ids] of Object.entries(table)) {
    assert.ok(ids.length >= 1, key);
    assert.equal(new Set(ids).size, ids.length, `${key} 的 id 不重複`);
    for (const id of ids) assert.match(id, /^[a-z][a-zA-Z0-9_-]*$/, `${key}.${id}`);
  }
  assert.deepEqual(table.kevinQuit, ['finished', 'key', 'myshop']);
  assert.deepEqual(table.notice, F.NOTICES.map((n) => n.id), '啟事的選項 id 就是啟事的 id');
  assert.deepEqual(table.kevinBack, ['often', 'regular']);
  assert.ok(table.listen && table.vYuan1Note && table.vKevin6Cam);
  // 每個有分支的選項：分支的 key 和選項的 id 一一對上
  const walk = (list) => {
    for (const [i, s] of (list || []).entries()) {
      if (s.do === 'branch') {
        const ch = list.slice(0, i).reverse().find((x) => x.do === 'choice' && x.key === s.key);
        if (ch) assert.deepEqual(Object.keys(s.cases), ch.options.map((o) => o.id), s.key);
        else assert.ok(table[s.key], `${s.key} 的分支對得到某個 choice`);
        for (const k of Object.keys(s.cases)) assert.ok(table[s.key].includes(k), `${s.key}.${k}`);
      }
      walk(s.steps); Object.values(s.cases || {}).forEach(walk);
    }
  };
  for (const s of VS.SEGMENTS) walk(s.steps);
  for (const m of S.MILESTONES) walk(m.scene);
  for (const s of F.SEGMENTS) walk(s.scene);
  // 啟事：用 id 貼；舊的數字 index 也認得
  const s = newSave();
  assert.equal(F.postNotice(s, 'slow').id, 'slow');
  assert.equal(F.postNotice(s, 2).id, 'turnover');
  assert.equal(F.postNotice(s, 'nope').id, 'cat', '對不上就是第一張');
});

test('存檔 13 → 14：story.answers 的數字 index 換成選項 id；對不上的拿掉；新存檔是第 14 版', () => {
  assert.equal(SAVE_VERSION, 14);
  assert.equal(newSave().version, 14);
  const old = newSave();
  old.version = 13;
  old.story.answers = { kevinQuit: 2, notice: 1, kevinBack: 0, vYuan1Note: 1, listen: 0, vZhe2Mud: 5, gone: 0, already: 'x' };
  const s = migrate(JSON.parse(JSON.stringify(old)), T0);
  assert.equal(s.version, 14);
  assert.deepEqual(s.story.answers, { kevinQuit: 'myshop', notice: 'slow', kevinBack: 'often', vYuan1Note: 'quiet', listen: 'listen', already: 'x' });
  // 第 14 版的存檔不再動
  const again = migrate(JSON.parse(JSON.stringify(s)), T0);
  assert.deepEqual(again.story.answers, s.story.answers);
});

test('旁白（narrate）：新步驟、泡泡樣式和台詞不同（沒有名字、沒有尾巴、置中斜體）、示範只有一兩處而且是【待定】', () => {
  const html = read('index.html');
  assert.match(html, /#bubble\.narrate[^{]*\{[^}]*font-style: italic[^}]*text-align: center/);
  assert.match(html, /#bubble\.narrate::after \{ display: none; \}/);
  const main = read('src/main.js');
  assert.match(main, /case 'narrate':/);
  assert.match(main, /function narrate\(/);
  assert.match(main, /speaker === 'narrate'/);
  // 示範旁白：只有一兩處，都沒有標原句或劇本（＝【待定】）
  const meta = SC.build(SC.TEXTS, { meta: true });
  const found = [];
  const walk = (list) => { for (const s of list || []) { if (s.do === 'narrate') found.push(s); walk(s.steps); Object.values(s.cases || {}).forEach(walk); } };
  for (const s of meta.segments) walk(s.steps);
  for (const m of Object.values(meta.milestones)) walk(m.scene);
  assert.ok(found.length >= 1 && found.length <= 2, `示範旁白 ${found.length} 處`);
  for (const n of found) assert.equal(n.tag, '待定');
  // 旁白不算說出口的話（子序列檢查不受影響），但算玩家看得到的字
  for (const n of found) assert.ok(S.allLines().includes(n.text));
});

test('【原句】與【劇本】：標了的句子在搬家前的來源裡（里程碑原場景、TALK、劇本原文、日誌）', () => {
  const meta = SC.build(SC.TEXTS, { meta: true });
  const tagged = [];
  const walk = (list) => { for (const s of list || []) { if (s.tag && s.tag !== '待定') tagged.push(s); walk(s.steps); Object.values(s.cases || {}).forEach(walk); } };
  for (const s of meta.segments) { walk(s.steps); if (s.invite && typeof s.invite === 'object') { walk(s.invite.yes); walk(s.invite.no); walk(s.invite.missing); } }
  assert.ok(tagged.length >= 25, `段落裡標了原句的有 ${tagged.length} 句`);
  const sources = new Set([
    ...S.MILESTONES.flatMap((m) => VS.sayTexts(m.scene)),
    ...Object.values(S.TALK).flatMap((l) => l.flatMap((t) => t.lines)),
    SC.SCRIPT.regulars.yuan.intro.text,
  ]);
  for (const s of tagged) assert.ok(sources.has(s.text), `原句找得到來源：${s.text}`);
});

test('npm run script:view：產生 docs/劇本對照.md，列出每一段、說話者、分支、條件與【待定】', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['script:view'], 'node tests/script-view.mjs');
  const md = renderView(SC.build(SC.TEXTS, { meta: true }));
  for (const s of VS.SEGMENTS) assert.ok(md.includes(s.id), s.id);
  for (const m of S.MILESTONES) assert.ok(md.includes(m.id), m.id);
  assert.match(md, /【待定】/);
  assert.match(md, /【原句】/);
  assert.match(md, /旁白/);
  assert.match(md, /條件：龍眼在窗台上/);
  assert.match(md, /選項 vYuan1Note/);
});

test('載入不需要打包：script.js 用 fetch／fs 讀 scripts/，yaml-lite 在 vendor/，importmap 有這兩個模組', () => {
  const src = read('src/script.js');
  assert.match(src, /import \{ parse \} from '\.\.\/vendor\/yaml-lite\.js'/);
  assert.match(src, /await fetch\(/);
  assert.match(src, /\?v=\$\{GAME_VERSION\}/, 'scripts/ 也帶版本號，換版時不吃到舊快取');
  const html = read('index.html');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  assert.ok(map['./src/script.js']);
  assert.ok(map['./vendor/yaml-lite.js']);
  assert.doesNotMatch(read('vendor/yaml-lite.js'), /^import /m, 'yaml-lite 不依賴其他套件');
  assert.ok(read('.nojekyll') !== null, 'GitHub Pages 不跑 Jekyll（scripts/_shared.yaml 底線開頭的檔案才會被放上去）');
});
