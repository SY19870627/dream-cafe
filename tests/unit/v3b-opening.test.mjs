// v3b 開場（劇本 v3.8 第一幕～第四幕）：字與劇本逐字相同（拿掉稿件標記）、各幕各句只往前、存檔恢復、壞檔、
// 互動關卡（推門／點椅子／發動／按住騎／左右岔路／掉頭回去／再推門）、可選互動略過也能走完、待續且不進第一天。
// 只測純邏輯與靜態檔案，不開瀏覽器。劇本字在 src/lines/opening.js（tracked）；有 _agent 稿件時另外逐句對稿，沒有就略過。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as OP from '../../src/lines/opening.js';
import * as S from '../../src/story/state.js';
import { load, persist, SAVE_KEY } from '../../src/story/save.js';
import { OPENING_ART, SHOP_ART } from '../../src/view/art.js';
import { doorView, DOOR_FADE_MS } from '../../src/view/opening.js';
import { PORTRAIT_PLACE } from '../../src/view/reader.js';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const SRC = JSON.parse(read('src/story/final-source.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const reload = (s) => S.normalize(clone(s), SRC);
const code = (p) => read(p).replace(/\/\/.*$/gm, ''); // 只看程式，不看註解
const L = OP.OPENING_LINES;
const allLines = () => Object.values(L).flat();
const MARKS = /【(待定|待確認|新增互動)】/;

// 下一幕（與 main.js 的 NEXT_ACT 相同；坐下之前的幕在 view/opening.js 自己換）
const NEXT = { office: 'title', title: 'mailbox', mailbox: 'letter', letter: 'road', road: 'deshu', deshu: 'sit', sit: 'coffee', coffee: 'depart', depart: 'ride', ride: 'fork', fork: 'temple', temple: 'return', return: 'stay', stay: 'room' };

// 照玩家的方式從頭走到待續：每一句「點一下」或「做完關卡」才往下；可選互動一律不做。回傳讀到的句子。
function playOpening({ side = 'left', each = () => {} } = {}) {
  const s = S.newStoryState();
  const seen = [];
  let guard = 0;
  while (!S.isOpeningEnd(s)) {
    assert.ok(guard++ < 400, '走不到待續');
    const act = s.opening.act;
    each(s);
    const lines = L[act] || [];
    if (lines.length) {
      const b = lines[s.opening.line];
      seen.push(b.text);
      if (b.gate === 'fork') assert.equal(S.chooseFork(s, side), true);
      if (s.opening.line + 1 < lines.length) { assert.equal(S.setOpeningLine(s, s.opening.line + 1), true, `${act} ${s.opening.line}`); continue; }
    }
    if (act === 'room') assert.equal(S.finishOpening(s), true);
    else assert.equal(S.setOpeningAct(s, NEXT[act]), true, act);
  }
  each(s);
  return { s, seen };
}

/* ---------- 字 ---------- */
test('稿件標記【待定】【待確認】【新增互動】都已拿掉；括弧舞台指示不是字', () => {
  const texts = [
    ...allLines().map((b) => b.text), OP.MAILBOX.caption, OP.MAILBOX.tap, OP.MAILBOX.shaken, OP.MAILBOX.boxLabel, OP.MAILBOX.next,
    OP.LETTER.title, OP.LETTER.greeting, ...OP.LETTER.paragraphs, OP.LETTER.closing, OP.LETTER.signature, OP.LETTER.attachment, OP.LETTER.after,
    OP.ROAD.card, OP.ROAD.door, OP.DEPART.start, OP.TEMPLE.back, OP.OFFICE.signature, OP.OFFICE.question,
  ];
  for (const t of texts) {
    assert.ok(!MARKS.test(t), `還有標記：${t}`);
    assert.ok(!/^[（(]/.test(t) && !/[）)]$/.test(t), `舞台指示變成字：${t}`);
    assert.equal(t, t.trim());
  }
  // 【待定】句去標記後正文照出
  const flat = allLines().map((b) => b.text);
  assert.ok(flat.includes('龍眼的耳朵往後壓了一下，沒有走。'));
  assert.ok(flat.includes('椅子是木頭的，坐下去才知道腿有多痠。'));
  assert.ok(flat.includes('還沒打烊，位子自己挑。'));
  assert.equal(flat.at(-1), '我本來只想躺一下，燈還沒關就睡著了。', '開場最後一句');
  // 舊第四幕兩句、第一版德叔三句不在可玩開場
  for (const old of [OP.ACT4_CUP, OP.ACT4_EMPTY, OP.SIT, ...OP.DESHU_ENTER]) assert.ok(!flat.includes(old), old);
});

test('署名固定「陳怡君　敬上」，沒有輸入框（刪掉「可以不寫」的簽名欄）', () => {
  assert.equal(OP.OFFICE.signature, '陳怡君　敬上');
  assert.ok(!('signPlaceholder' in OP.OFFICE));
  const view = read('src/view/opening.js');
  assert.doesNotMatch(view, /<input|op-name|可以不寫|placeholder/);
  assert.match(view, /<p class="op-sign">\$\{esc\(OFFICE\.signature\)\}<\/p>/);
  assert.doesNotMatch(read('index.html'), /op-sign input/);
  // 送出要先選結尾：按鈕一開始 disabled，選了才解除；點擊時沒選就不做事
  assert.match(view, /id="op-send" class="primary" disabled/);
  assert.match(view, /if \(!choice \|\| send\.disabled\) return;/);
  assert.equal(OP.OFFICE.clock, '16:49');
  assert.equal(OP.OFFICE.clockAfter, '16:50');
  assert.deepEqual(OP.RESIGNATIONS.map((r) => r.text), ['謝謝這些年的照顧。', '我要去追一個夢了。', '從今天起，我單方面辭退您。']);
});

test('第二幕：信箱旁白、只能點一次的「拿出信封」、新信全文（標題「信」、署名東山老屋　屋主）', () => {
  assert.equal(OP.MAILBOX.caption, '我回到租屋處。信箱裡有一個牛皮紙信封。');
  assert.equal(OP.MAILBOX.boxLabel, '拿出信封');
  assert.equal(OP.LETTER.title, '信');
  assert.equal(OP.LETTER.greeting, '怡君：');
  assert.deepEqual(OP.LETTER.paragraphs, [
    '妳沒見過我，突然收到這種信，一定覺得奇怪。不想理它，放著也沒關係。',
    '我在台南東山有一間老三合院，住了很多年。正廳是一間咖啡館，現在還開著。',
    '我年紀大了，現在不住那裡。店想交給妳經營，屋子也一起留給妳。那間屋子冬天曬得到太陽，坐起來是暖的。',
    '若妳尚未辭職，請先辭職。這句不算條件，是我雞婆。',
    '那邊有人在等妳。妳哪一天去，他都在。',
    '到了東山，找院子裡種一棵老龍眼樹、門上掛風鈴的那間三合院就是。鑰匙放在信封裡，屋子是妳的，鑰匙就是這個意思。門平常沒有鎖，到了用推的就好。',
  ]);
  assert.equal(OP.LETTER.closing, '祝　平安');
  assert.equal(OP.LETTER.signature, '東山老屋　屋主');
  assert.equal(OP.LETTER.attachment, '附件：鑰匙一把');
  assert.equal(OP.LETTER.after, '辭了。今天下午四點五十分。');
  const view = read('src/view/opening.js');
  assert.doesNotMatch(view, /LAWYER_LETTER|律師信|溫度基金/);
  assert.match(view, /if \(btn\.disabled\) return; \/\/ 只能點一次/);
  assert.match(view, /<span class="op-box-label">\$\{MAILBOX\.boxLabel\}<\/span>/, '「拿出信封」看得到');
  // 可選：點附件看鑰匙滑出（不點也能出發）
  assert.match(view, /id="op-attach"/);
  assert.match(view, /el\.querySelector\('#op-next'\)\.onclick = \(\) => api\.go\('road'\);/);
});

test('有 _agent 稿件時：開場每一句（旁白、對白）照順序與劇本 v3.8 逐字相同（沒有就略過）', (t) => {
  const p = root('_agent/v3b/script-v3.8-acts1-4.md');
  if (!existsSync(p)) { t.skip('沒有 _agent 稿件'); return; }
  const md = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const body = md.slice(md.indexOf('# 【待定】開場'));
  const strip = (x) => x.replace(/^(【(待定|待確認|新增互動)】)+/, '');
  const spoken = [];
  const quoted = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('---') || line.startsWith('（') || line.startsWith('**')) continue;
    if (line.startsWith('>')) { const q = strip(line.replace(/^>\s*/, '')); if (q && !q.startsWith('（')) quoted.push(q); continue; }
    const m = strip(line).match(/^(德叔|我)(（只有聲音）)?：「(.*)」$/);
    spoken.push(m ? { who: m[1] === '德叔' ? 'deshu' : 'me', text: m[3] } : { who: undefined, text: strip(line) });
  }
  const mine = [
    { text: OP.MAILBOX.caption }, { text: OP.MAILBOX.shaken }, { text: OP.LETTER.after },
    ...['road', 'deshu', 'coffee', 'ride', 'fork', 'temple', 'return', 'stay', 'room'].flatMap((a) => L[a]),
  ].map((b) => ({ who: b.who, text: b.text }));
  assert.deepEqual(mine, spoken);
  // 信、郵件、標題、結尾按鈕（引用區塊）
  for (const q of [...OP.RESIGNATION_MAIL.body, ...OP.RESIGNATIONS.map((r) => r.text), ...OP.TITLE.lines, OP.TITLE.sub,
    OP.LETTER.greeting, ...OP.LETTER.paragraphs, OP.LETTER.closing, OP.LETTER.signature]) assert.ok(quoted.includes(q), `稿件引用找不到：${q}`);
  assert.ok(quoted.includes(`署名　${OP.OFFICE.signature}`));
  for (const s of [OP.ROAD.card, OP.ROAD.door, OP.DEPART.start, OP.TEMPLE.back, OP.MAILBOX.tap, OP.MAILBOX.boxLabel, OP.MAILBOX.next, OP.LETTER.attachment, OP.LETTER.title, OP.TITLE.next]) {
    assert.ok(body.includes(`「${s}」`), `稿件找不到「${s}」`);
  }
});

/* ---------- 推進、存檔恢復 ---------- */
test('開場只往前：各幕順序、換幕從第 0 句開始、句子不能跳過最後一句也不能往回', () => {
  assert.deepEqual(S.OPENING_ACTS, ['office', 'title', 'mailbox', 'letter', 'road', 'deshu', 'sit', 'coffee', 'depart', 'ride', 'fork', 'temple', 'return', 'stay', 'room', 'end']);
  const s = S.newStoryState();
  assert.equal(S.setOpeningLine(s, 1), false, '辦公室沒有句子');
  for (const a of ['title', 'mailbox', 'letter', 'road', 'deshu']) assert.equal(S.setOpeningAct(s, a), true);
  assert.equal(S.setOpeningLine(s, 3), true);
  assert.equal(S.setOpeningLine(s, 2), false, '只往前');
  assert.equal(S.setOpeningLine(s, 3), false, '連點同一句不會多推');
  assert.equal(S.setOpeningLine(s, L.deshu.length), false, '不能超過這一幕');
  assert.equal(S.setOpeningLine(s, 1.5), false);
  assert.equal(S.setDeshuLine(s, 20), true, '舊名字仍可用，且能記住超過 3 句');
  assert.equal(s.opening.line, 20);
  assert.equal(S.setOpeningAct(s, 'road'), false, '不能回到前一幕');
  assert.equal(S.setOpeningAct(s, 'sit'), true);
  assert.equal(s.opening.line, 0);
  assert.equal(S.finishOpening(s), false, '還沒到最後一句不能結束');
});

test('從頭走到待續：每一幕、每一句存檔讀回都在同一處；長對話（德叔 32 句）也記得住', () => {
  let n = 0;
  const { s, seen } = playOpening({
    each: (st) => {
      const r = reload(st);
      assert.equal(r.opening.act, st.opening.act);
      assert.equal(r.opening.line, st.opening.line, `${st.opening.act} 第 ${st.opening.line} 句`);
      assert.equal(r.phase, 'opening');
      n++;
    },
  });
  assert.ok(n > 60);
  assert.ok(L.deshu.length > 30);
  assert.equal(s.opening.act, 'end');
  assert.equal(seen.length, allLines().length, '每一句都出現一次');
  // 存進 localStorage 再讀回（fake storage）
  const m = new Map();
  const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  const mid = S.newStoryState();
  for (const a of ['title', 'mailbox', 'letter', 'road', 'deshu']) S.setOpeningAct(mid, a);
  S.setOpeningLine(mid, 27);
  persist(mid, st);
  assert.deepEqual([...m.keys()], [SAVE_KEY]);
  const back = load(SRC, st);
  assert.equal(back.opening.act, 'deshu');
  assert.equal(back.opening.line, 27);
});

test('待續且不進入第一天：end 之後沒有下一幕、phase 一直是 opening；舊存檔停在三天故事也回到開場開頭', () => {
  const { s } = playOpening();
  assert.equal(S.isOpeningEnd(s), true);
  assert.equal(s.phase, 'opening');
  assert.equal(s.at, null);
  for (const a of S.OPENING_ACTS) assert.equal(S.setOpeningAct(s, a), false, `end 之後不能到 ${a}`);
  assert.equal(S.finishOpening(s), false);
  assert.equal(reload(s).opening.act, 'end');
  // 舊版（第一輪）坐下後就進三天故事；那種存檔在執行畫面一律回到開場開頭
  const old = S.enterStory(S.newStoryState());
  assert.equal(old.phase, 'story');
  assert.deepEqual(S.playable(reload(old)), S.newStoryState());
  assert.equal(S.playable(s), s);
  // 執行畫面不呼叫三天故事入口、不把 phase 改成 story、不接第一天標題
  const main = code('src/main.js');
  assert.doesNotMatch(main, /enterStory|phase = 'story'|d1-title/);
  assert.match(main, /state = S\.playable\(load\(source\)\);/);
  const view = read('src/view/opening.js');
  assert.match(view, /<p class="op-end-title">待續<\/p>/);
  assert.doesNotMatch(view + main, /第一天/);
});

test('壞檔：不認得的幕回開頭、句子進度夾在這一幕之內、岔路的值不合法就丟掉、第一輪存檔的 deshuLine 接得上', () => {
  const fresh = S.newStoryState();
  for (const bad of [null, 'x', 42, [], { v: 99 }]) assert.deepEqual(S.normalize(bad, SRC), fresh);
  let r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'nope', line: 5 } }, SRC);
  assert.equal(r.opening.act, 'office');
  assert.equal(r.opening.line, 0);
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'deshu', line: 999 } }, SRC);
  assert.equal(r.opening.line, L.deshu.length - 1, '超過就停在這一幕最後一句');
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'coffee', line: -3 } }, SRC);
  assert.equal(r.opening.line, 0);
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'stay', line: 'abc' } }, SRC);
  assert.equal(r.opening.line, 0);
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'deshu', deshuLine: 2 } }, SRC);
  assert.equal(r.opening.line, 2, '第一輪存檔（deshuLine）');
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'temple', fork: 'up' } }, SRC);
  assert.equal(r.opening.fork, null);
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'ride', fork: 'left' } }, SRC);
  assert.equal(r.opening.fork, null, '還沒到岔路就不可能選過');
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'temple', fork: 'right', line: 2 } }, SRC);
  assert.equal(r.opening.fork, 'right');
  r = S.normalize({ v: 1, phase: 'opening', opening: { act: 'done' } }, SRC);
  assert.equal(r.opening.act, 'sit', '舊的 done 回到最近的合法幕');
  // 讀回來的壞檔照樣能一路走到待續（不會卡住）
  for (const act of S.OPENING_ACTS) {
    const s = S.normalize({ v: 1, phase: 'opening', opening: { act, line: 99 } }, SRC);
    let guard = 0;
    while (!S.isOpeningEnd(s)) {
      assert.ok(guard++ < 200, `${act} 卡住`);
      const lines = L[s.opening.act] || [];
      if (lines[s.opening.line]?.gate === 'fork') S.chooseFork(s, 'right');
      if (s.opening.line + 1 < lines.length) S.setOpeningLine(s, s.opening.line + 1);
      else if (s.opening.act === 'room') S.finishOpening(s);
      else S.setOpeningAct(s, NEXT[s.opening.act]);
    }
  }
});

/* ---------- 互動 ---------- */
test('互動關卡：推門（第一次與回來）、按住騎、岔路、掉頭回去；發動與點椅子是沒有句子的幕', () => {
  const gates = Object.fromEntries(Object.entries(L).map(([a, ls]) => [a, ls.map((b) => b.gate || null)]));
  assert.deepEqual(gates.road, [null, 'door', null], '兩句旁白後推門，推開才出「門一開……」');
  assert.deepEqual(gates.return, ['door'], '回來再推一次門');
  assert.deepEqual(gates.ride, ['hold', 'hold', 'hold', 'hold']);
  assert.deepEqual(gates.fork, ['fork']);
  assert.deepEqual(gates.temple, [null, null, null, null, 'turnback']);
  assert.equal(S.lineCount('depart'), 0);
  assert.equal(S.lineCount('sit'), 0);
  assert.equal(L.road[2].text, '門一開，台階上的橘貓瞇著眼醒來，伸一個懶腰後，從我腳邊鑽進去。');
  assert.equal(OP.ROAD.door, '推門進去');
  assert.equal(OP.DEPART.start, '發動');
  assert.equal(OP.TEMPLE.back, '掉頭回去');
  const view = read('src/view/opening.js');
  // 推門：拖夠才開（同一個 pushDoor，第一次與回來都用它）；只點一下會晃一下回來；不用鑰匙
  assert.match(view, /if \(k >= 0\.75\) \{ start = null; panel\.style\.transition = ''; open\(\); \}/);
  assert.match(view, /door\.classList\.add\('nudge'\); \/\/ 推不夠：門晃一下回來/);
  assert.equal((view.match(/pushDoor\(el\.querySelector\('#op-door'\)/g) || []).length, 1, 'road 與 return 共用同一段推門');
  assert.match(view, /if \(act === 'road' \|\| act === 'depart' \|\| act === 'return'\)/);
  // 按住騎：按著才累積，放開就停、引擎怠速
  assert.match(view, /if \(hold\.down\) \{ held \+= now - hold\.last; hold\.last = now; \}/);
  assert.match(view, /road\.go\(false\); \/\/ 放開就停在原地\s*setEngine\(0\); \/\/ 引擎怠速/);
  assert.match(view, /if \(held >= HOLD_MS\)/);
  assert.match(view, /aria-label="左邊的路"/);
  assert.match(view, /aria-label="右邊的路"/);
  assert.match(view, /\$\{DEPART\.start\}<\/button>/);
  assert.match(view, /\$\{TEMPLE\.back\}<\/button>/);
  // 店內：點椅子才坐下，點其他地方不會坐下
  const main = code('src/main.js');
  assert.match(main, /if \(it\?\.id !== 'chairA'\) return;/);
  assert.match(main, /label: '椅子', showLabel: true/);
  assert.match(main, /play\('place'\);\s*nextAct\('sit'/);
});

test('岔路：左右只能選一次，選哪一邊後面的字都一樣', () => {
  const a = playOpening({ side: 'left' });
  const b = playOpening({ side: 'right' });
  assert.deepEqual(a.seen, b.seen);
  assert.equal(a.s.opening.fork, 'left');
  assert.equal(b.s.opening.fork, 'right');
  const s = S.newStoryState();
  assert.equal(S.chooseFork(s, 'left'), false, '不在岔路不能選');
  for (const x of S.OPENING_ACTS.slice(1, S.OPENING_ACTS.indexOf('fork') + 1)) S.setOpeningAct(s, x);
  assert.equal(S.chooseFork(s, 'up'), false);
  assert.equal(S.chooseFork(s, 'right'), true);
  assert.equal(S.chooseFork(s, 'left'), false, '只能選一次');
});

test('可選互動（點貓、點杯子、點床、點附件）不是關卡：不做也能一句一句走完', () => {
  const opt = allLines().filter((b) => b.optional);
  assert.deepEqual(opt.map((b) => b.optional), ['cat', 'cup', 'bed']);
  for (const b of opt) assert.ok(!b.gate, `${b.optional} 不能擋住劇情`);
  const { seen } = playOpening(); // playOpening 從不做可選互動
  for (const b of opt) assert.ok(seen.includes(b.text));
  assert.ok(seen.includes('燙。我吹了兩下才喝。'), '不點杯子第一口旁白照出');
  const main = code('src/main.js');
  assert.match(main, /reader\.hot\(b\.optional \? optional\(b\.optional, b\) : \[\]\);\s*ok = await reader\.next\(\);/, '可選互動時照樣等點一下');
  assert.match(main, /play\('purr'\)/);
  assert.match(main, /ctl\.lieDown\(\)\.then\(\(\) => \{ if \(my === token\) reader\.advance\(\); \}\)/, '點床：躺下去後翻到下一句');
  // 熱點與按鈕至少 44px
  assert.match(read('src/view/reader.js'), /const w = Math\.max\(44, r\.w\);\s*const hh = Math\.max\(44, r\.h\);/);
  assert.match(read('index.html'), /button \{[^}]*min-height: 44px; min-width: 44px;/);
});

test('每一句說完點一下才出下一句：閱讀框不自動翻頁、一句剛出來的連點不跳句', () => {
  const reader = read('src/view/reader.js');
  assert.match(reader, /if \(performance\.now\(\) - shownAt < TAP_GUARD_MS\) return;/);
  assert.doesNotMatch(code('src/view/reader.js'), /setTimeout|setInterval/);
  const main = code('src/main.js');
  for (const m of main.matchAll(/setTimeout\(([^;]*)/g)) assert.doesNotMatch(m[1], /advance|setOpeningLine|nextAct/, '計時器不推句');
  // 名牌：德叔標「德叔」、怡君自己開口標「我」、旁白沒有名牌
  assert.deepEqual(OP.SPEAKER_NAMES, { deshu: '德叔', me: '我' });
  for (const b of allLines()) assert.ok(b.who === undefined || b.who in OP.SPEAKER_NAMES);
  assert.equal(L.deshu[1].who, 'deshu');
  assert.equal(L.deshu[1].voice, true, '德叔第一句只有聲音');
});

test('演出：德叔第一句只有聲音（先不出立繪、擦杯子聲）→ 立繪出現、擦杯子聲停；沖煮只聽水聲不能操作', () => {
  const at = (act, i) => OP.sceneAt(L[act], i);
  assert.equal(at('deshu', 0).portrait, false);
  assert.equal(at('deshu', 0).cloth, true);
  assert.equal(at('deshu', 1).portrait, false, '「還沒打烊」只有聲音');
  assert.equal(at('deshu', 2).portrait, true);
  assert.equal(at('deshu', 2).cloth, false);
  const brew = L.deshu.findIndex((b) => b.text === '香味一路到門口。');
  assert.deepEqual(L.deshu[brew].sfx, ['boil', 'thinPour']);
  assert.equal(at('deshu', brew).portrait, false, '畫面留在我和龍眼');
  assert.equal(at('deshu', brew).yaw, 40, '鏡頭轉向我和龍眼，德叔只剩肩膀');
  const serve = brew + 1;
  assert.equal(at('deshu', serve).cup, true, '德叔把杯子放在靠窗那張桌');
  assert.equal(L.deshu.at(-1).text, '泡好了。坐下喝看看。');
  assert.equal(at('coffee', L.coffee.length - 1).night, 1, '窗外暗下來');
  assert.ok(at('room', 2).lying);
});

test('不出現佈置模式、溫度計、沖煮操作介面；畫面不要求鑰匙開門', () => {
  const src = ['src/main.js', 'src/view/opening.js', 'src/view/reader.js', 'src/lines/opening.js'].map(code).join('\n');
  assert.doesNotMatch(src, /佈置|溫度計|thermo|machine|brewDone|drawMachine|decor/);
  assert.doesNotMatch(code('src/view/opening.js'), /需要鑰匙|上鎖|locked/);
});

test('音效全部用 WebAudio 合成且都有定義；沒有外部音檔', () => {
  const audio = read('src/view/audio.js');
  const names = new Set(['engineStart', 'engineOff', 'rev', 'dog', 'purr', 'creak', 'cloth', 'boil', 'thinPour', 'keys', 'door', 'bell', 'place', 'sip', 'tap', 'key', 'send', 'grind']);
  for (const b of allLines()) for (const n of b.sfx || []) names.add(n);
  for (const n of names) assert.ok(audio.includes(`case '${n}':`), `沒有音效 ${n}`);
  assert.match(audio, /name === 'engine'/);
  assert.match(audio, /export function setEngine\(/);
  assert.ok(!existsSync(root('assets/audio')));
  for (const f of ['src/main.js', 'src/view/opening.js']) assert.doesNotMatch(read(f), /\.(mp3|ogg|wav|m4a)\b/);
});

test('美術：用到的原圖都在 assets/art 且有預載；不再疊「175」', () => {
  const files = new Set(readdirSync(root('assets/art')));
  const view = read('src/view/opening.js');
  const main = read('src/main.js');
  const used = new Set([...OPENING_ART, ...SHOP_ART]);
  for (const m of (view + main).matchAll(/art\('([\w]+)'\)|img: '([\w]+)'|img\('([\w]+)'\)|src: '([\w]+)'/g)) used.add(m[1] || m[2] || m[3] || m[4]);
  for (const pose of ['stand', 'brew', 'serve', 'broom']) used.add(`char_deshu_${pose}`);
  for (const n of used) assert.ok(files.has(`${n}.webp`), `缺 ${n}.webp`);
  for (const n of ['key', 'cat_longan_walk', 'window_night_clear', 'cat_longan_sleep', 'cat_longan_sit']) assert.ok(OPENING_ART.includes(n) || SHOP_ART.includes(n), `${n} 沒有預載`);
  assert.doesNotMatch(view, />175</, '三合院外不再疊 175');
});

// 畫師 v3b 第一批原圖（開場第一～四幕）：檔名 → 原圖尺寸（只讀，不縮圖、不重新壓縮）
const V3B_ART = {
  scene_v3b_sanheyuan_dusk_v2: [1170, 2532], scene_v3b_sanheyuan_night_v2: [1170, 2532],
  prop_v3b_scooter_off_v2: [800, 520], prop_v3b_scooter_on_v2: [800, 520], prop_v3b_scooter_beam_v2: [800, 520],
  scene_v3b_room_night: [1170, 2532], scene_v3b_courtyard_night_v2: [1170, 2532],
  prop_v3b_iron_shed_night_v2: [1024, 768], prop_v3b_tudigong_night_v2: [1024, 1024],
};
// 讀 WebP 檔頭的寬高（VP8／VP8L／VP8X）
function webpSize(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  throw new Error(`不認得的 WebP：${kind}`);
}

test('v3b 原圖接進開場：七類畫面都用原圖、有預載、原圖尺寸沒動；不再有「佔位：…」', () => {
  const view = read('src/view/opening.js');
  const prog = code('src/view/opening.js');
  for (const [n, size] of Object.entries(V3B_ART)) {
    assert.ok(existsSync(root(`assets/art/${n}.webp`)), `缺 ${n}.webp`);
    assert.deepEqual(webpSize(readFileSync(root(`assets/art/${n}.webp`))), size, `${n} 尺寸不對（原圖不可縮放）`);
    assert.ok(OPENING_ART.includes(n), `${n} 沒有預載`);
    assert.ok(view.includes(`'${n}'`), `${n} 沒接進開場`);
  }
  // 七類佔位都拿掉
  assert.doesNotMatch(view, /佔位/);
  for (const ph of ['三合院外觀（傍晚）', '三合院外觀（晚上）', '鐵皮工寮\'', '土地公廟\'', '庭埕（晚上）', '護龍的房間']) assert.ok(!view.includes(`'${ph}`), `還有佔位：${ph}`);
  assert.doesNotMatch(read('index.html'), /\.op-ph\b|op-yn-roof|op-yn-floor|op-rm-wall|op-rm-window|op-rm-lamp|op-rm-cabinet|\.quilt/, '自繪的屋頂地板、牆窗櫃燈被子都拿掉');
  // 三合院外：傍晚 dusk、晚上 night；不再拿縣道圖當三合院、不再壓暗夜景
  assert.match(prog, /art\(night \? 'scene_v3b_sanheyuan_night_v2' : 'scene_v3b_sanheyuan_dusk_v2'\)/);
  assert.doesNotMatch(prog, /scene_county_road|cabinet|scooterSvg|<svg class="op-scooter"/);
  assert.ok(!OPENING_ART.includes('scene_county_road') && !OPENING_ART.includes('cabinet'), '開場不再預載佔位用的縣道圖與櫃子');
  const css = read('index.html');
  assert.doesNotMatch(css, /\.op-yard\.night[^{]*\.op-art-img\s*\{[^}]*filter/, '夜景原圖不再套壓暗濾鏡');
  assert.match(css, /\.op-art-img \{[^}]*transform-origin: 58\.5% 63\.3%/, '推近對準新門中心');
  // 機車：三張原圖都在三合院外；off 每一幕都有（停在原位），發動才有 on 與 beam
  assert.match(prog, /<img class="off" src="\$\{art\('prop_v3b_scooter_off_v2'\)\}"/);
  assert.match(prog, /act === 'depart' \? `<img class="on" src="\$\{art\('prop_v3b_scooter_on_v2'\)\}" alt=""><img class="beam" src="\$\{art\('prop_v3b_scooter_beam_v2'\)\}"/);
  assert.match(css, /\.op-yard\.beam \.op-scooter \.on, \.op-yard\.beam \.op-scooter \.beam \{ opacity: 1; \}/);
  // 夜路：工寮與廟畫原圖（車燈照到才淡入），沒有 canvas 剪影
  assert.match(prog, /hut: \{ src: 'prop_v3b_iron_shed_night_v2'/);
  assert.match(prog, /temple: \{ src: 'prop_v3b_tudigong_night_v2'/);
  assert.match(prog, /g\.drawImage\(lit,/);
  assert.doesNotMatch(prog, /燕尾|波浪鐵皮/);
  // 庭埕、房間：原圖當背景；龍眼疊在庭埕；鑰匙疊在枕頭旁；床仍是可點熱點（至少 44px）
  assert.match(prog, /art\('scene_v3b_courtyard_night_v2'\)[\s\S]*class="op-yn-cat" src="\$\{art\('cat_longan_sit'\)\}"/);
  assert.match(prog, /art\('scene_v3b_room_night'\)[\s\S]*class="op-rm-key" src="\$\{art\('key'\)\}"[\s\S]*id="op-bed"/);
  assert.match(css, /\.op-rm-bed \{[^}]*min-width: 44px; min-height: 44px;/);
  assert.match(prog, /ctl\.lieDown = \(\) => \{ el\.classList\.add\('lying'\); play\('creak'\);/);
});

test('推門疊圖對齊畫師給的門板座標 (594,1484)–(776,1720)／1170×2532；熱區至少 44px', () => {
  const css = read('index.html');
  const m = css.match(/\.op-door-wrap \{ position: absolute; left: ([\d.]+)%; top: ([\d.]+)%; width: ([\d.]+)%; height: ([\d.]+)%;/);
  assert.ok(m, '找不到門板位置');
  const [left, top, width, height] = m.slice(1).map(Number);
  const near = (a, b) => Math.abs(a - b) < 0.01;
  assert.ok(near(left, (594 / 1170) * 100), `left ${left}`);
  assert.ok(near(top, (1484 / 2532) * 100), `top ${top}`);
  assert.ok(near(width, (182 / 1170) * 100), `width ${width}`);
  assert.ok(near(height, (236 / 2532) * 100), `height ${height}`);
  assert.ok(near(top + height, (1720 / 2532) * 100), '門底對在 y=1720');
  assert.match(css, /\.op-yard \.op-door \{[^}]*min-width: 44px; min-height: 44px;/);
});

// 畫師 v3b 第二批原圖（項目 8–15）：檔名 → 原圖尺寸
const V3B_ART2 = {
  char_v3b_yijun_hand_v2: [800, 600], cat_longan_headbump_v2: [512, 384], cat_longan_stretch_v3b_v2: [512, 384], cat_longan_knead_v2: [512, 384],
  cat_longan_ears_turn_v2: [512, 384], cat_longan_ears_back_v2: [512, 384], cat_longan_lick_paw_v2: [512, 384], cat_longan_sleep_flip_v2: [512, 384],
  char_deshu_broom: [1024, 2048], prop_v3b_window_table: [1024, 768], prop_v3b_envelope_key_v2: [1024, 640],
  scene_v3b_bed_pov_night: [1170, 2532], scene_v3b_shop_window_night_seated: [1170, 2532],
};

test('v3b 第二批原圖：13 張都在、原圖尺寸沒動、有預載、都接進開場', () => {
  const both = read('src/view/opening.js') + read('src/main.js');
  for (const [n, size] of Object.entries(V3B_ART2)) {
    assert.ok(existsSync(root(`assets/art/${n}.webp`)), `缺 ${n}.webp`);
    assert.deepEqual(webpSize(readFileSync(root(`assets/art/${n}.webp`))), size, `${n} 尺寸不對（原圖不可縮放）`);
    assert.ok(OPENING_ART.includes(n), `${n} 沒有預載`);
    assert.ok(both.includes(`'${n}'`), `${n} 沒接進開場`);
  }
});

test('第二批接線：點貓（手＋頂頭）、伸懶腰、踩兩圈、耳朵、舔前腳、換邊睡、掃把、靠窗木桌、鑰匙特寫、躺下視角、坐下窗景', () => {
  const view = code('src/view/opening.js');
  const main = code('src/main.js');
  const css = read('index.html');
  const at = (act, i) => OP.sceneAt(L[act], i);
  const idx = (act, t) => L[act].findIndex((b) => b.text === t);
  // 8. 點貓：怡君的手入鏡摸頭 + 龍眼頂頭（疊在貓的位置），呼嚕；不點照走（optional 不是 gate）
  assert.match(main, /petting \? \{ img: 'cat_longan_headbump_v2' \}/);
  assert.match(main, /const HAND = \{ src: 'char_v3b_yijun_hand_v2'/);
  assert.match(main, /onTap: \(\) => \{ pet\.at = performance\.now\(\); pet\.done = true; play\('purr'\); \}/);
  assert.equal(L.deshu[idx('deshu', '然後他整個身體靠上來，從頭到尾巴在我小腿上擦過去，掉頭再擦一次。')].optional, 'cat');
  // 9. 台階上伸懶腰再鑽進去
  assert.match(view, /class="op-step-cat stretch" src="\$\{art\('cat_longan_stretch_v3b_v2'\)\}"/);
  assert.match(css, /\.op-yard\.lit \.op-step-cat\.stretch \{ animation: catstretch/);
  //    跳上靠窗那張椅子：踩兩圈（knead）→ 趴下（sleep）→ 耳朵轉過來（ears_turn）
  assert.equal(at('deshu', idx('deshu', '我往裡面走了一步。')).cat, 'chair');
  assert.match(main, /chair: \{[^\n]*seq: \[\s*\{ img: 'cat_longan_knead_v2'[^\n]*\n\s*\{ img: 'cat_longan_sleep'[^\n]*\n\s*\{ img: 'cat_longan_ears_turn_v2'/);
  //    龍眼跳上對面那張椅子：踩兩圈 → 趴下
  assert.equal(at('coffee', idx('coffee', '龍眼跳上對面那張椅子，踩兩圈，趴下。')).cat, 'across');
  assert.match(main, /const ACROSS_SEQ = \[\{ img: 'cat_longan_knead_v2'[^\]]*\{ img: 'cat_longan_sleep'/);
  //    磨豆機響：耳朵往後壓（ears_back），沒有走
  assert.equal(at('deshu', idx('deshu', '龍眼的耳朵往後壓了一下，沒有走。')).cat, 'earsBack');
  assert.match(main, /earsBack: \{[^\n]*seq: \[\{ img: 'cat_longan_ears_back_v2'/);
  //    不點貓：坐在腳邊舔前腳
  assert.equal(at('deshu', idx('deshu', '那隻貓叫龍眼，是這間三合院的主人，而妳是老闆。')).cat, 'feet');
  assert.match(main, /spot\.lick && !pet\.done \? 'cat_longan_lick_paw_v2'/);
  // 10. 傍晚台階用 sleep；回來換了一邊睡用 sleep_flip，不再 CSS 翻轉舊 sleep
  assert.match(view, /act === 'road' \? `<img class="op-step-cat" src="\$\{art\('cat_longan_sleep'\)\}"/);
  assert.match(view, /act === 'return' \? `<img class="op-step-cat" src="\$\{art\('cat_longan_sleep_flip_v2'\)\}"/);
  assert.doesNotMatch(view, /op-step-cat\$\{|' flip'/);
  assert.doesNotMatch(css, /\.op-step-cat\.flip|scaleX\(-1\)/);
  // 11. 晚上回店：德叔拿著掃把（店裡與立繪都是 broom）
  assert.equal(at('stay', 0).deshu, 'broom');
  assert.match(main, /broom: \{ pose: 'broom' \}/);
  assert.match(main, /act === 'stay' \? 'char_deshu_broom' : PORTRAITS\.deshu\.src/);
  // 12. 靠窗那張桌：畫師原圖取代程式畫的木桌；杯子仍是 prop_cup
  assert.match(main, /id: 'wintable'[^\n]*img: 'prop_v3b_window_table'/);
  assert.doesNotMatch(main, /drawTable|tex_wood_top/);
  assert.match(main, /id: 'cup'[^\n]*img: 'prop_cup'/);
  // 13. 附件：鑰匙從信封滑出的特寫用原圖（不改蜡封）
  assert.match(view, /<img class="envkey" src="\$\{art\('prop_v3b_envelope_key_v2'\)\}"/);
  assert.doesNotMatch(view, /art\('envelope'\)/);
  // 14. 點床：切到躺在床上的視角（燈一直亮），床板聲；最後一句（不點床）也是這張，但不擋翻頁
  assert.match(view, /class="op-bedpov"><div class="op-art"><img class="op-art-img" src="\$\{art\('scene_v3b_bed_pov_night'\)\}"/);
  assert.match(css, /\.op-room-act\.lying \.op-bedpov \{ opacity: 1; \}/);
  assert.doesNotMatch(css, /\.op-room-act\.lying \.op-room \{[^}]*rotate/, '不再用整張房間微傾當躺下');
  assert.ok(!L.room.some((b) => b.gate), '點床不是關卡');
  // 15. 坐下後的閱讀框：背景是看得到窗的店內夜景；窗外從傍晚暗到晚上
  assert.match(main, /if \(act === 'coffee'\) return seatedScene\(look\);/);
  assert.match(main, /src: 'scene_v3b_shop_window_night_seated'/);
  assert.match(main, /const dusk = Math\.max\(0, 1 - night\)/);
  assert.ok(at('coffee', 0).night < at('coffee', L.coffee.length - 1).night);
  // 點椅子之前的店內 360 照舊
  assert.match(main, /if \(act === 'sit'\) \{[\s\S]*?show\(\{ deshu: 'stand', cat: 'feet', cup: true \}, \{ yaw: 24 \}\);/);
});

// 畫師第三批（_v2 重畫，assets/art/previews/manifest_v3b_3.json）：舊檔名 → 尺寸。舊檔（無 _v2）只讀留下，程式不再引用
const V3B_ART3 = {
  scene_v3b_sanheyuan_dusk: [1170, 2532], scene_v3b_sanheyuan_night: [1170, 2532], scene_v3b_courtyard_night: [1170, 2532],
  prop_v3b_scooter_off: [800, 520], prop_v3b_scooter_on: [800, 520], prop_v3b_scooter_beam: [800, 520],
  prop_v3b_iron_shed_night: [1024, 768], prop_v3b_tudigong_night: [1024, 1024], prop_v3b_envelope_key: [1024, 640],
  char_v3b_yijun_hand: [800, 600], cat_longan_knead: [512, 384], cat_longan_headbump: [512, 384], cat_longan_stretch_v3b: [512, 384],
  cat_longan_ears_turn: [512, 384], cat_longan_ears_back: [512, 384], cat_longan_lick_paw: [512, 384], cat_longan_sleep_flip: [512, 384],
};

test('第三批 _v2：18 張都在、原圖尺寸沒動、有預載；程式只用 _v2，舊檔還在（沒刪）', () => {
  const both = code('src/view/opening.js') + code('src/main.js') + code('src/view/art.js');
  for (const [old, size] of Object.entries(V3B_ART3)) {
    const n = `${old}_v2`;
    assert.ok(existsSync(root(`assets/art/${n}.webp`)), `缺 ${n}.webp`);
    assert.deepEqual(webpSize(readFileSync(root(`assets/art/${n}.webp`))), size, `${n} 尺寸不對`);
    assert.ok(OPENING_ART.includes(n), `${n} 沒有預載`);
    assert.ok(!OPENING_ART.includes(old), `還在預載舊圖 ${old}`);
    assert.ok(both.includes(`'${n}'`), `${n} 沒接進開場`);
    assert.ok(!both.includes(`'${old}'`), `程式還在用舊圖 ${old}`);
    assert.ok(existsSync(root(`assets/art/${old}.webp`)), `舊圖 ${old}.webp 不可刪`);
  }
  assert.deepEqual(webpSize(readFileSync(root('assets/art/prop_v3b_scooter_road_light_v2.webp'))), [1400, 720]);
  assert.ok(OPENING_ART.includes('prop_v3b_scooter_road_light_v2'), '路面光錐沒有預載');
  assert.equal(Object.keys(V3B_ART3).length + 1, 18);
});

test('路面光錐：與機車同比例、錨點 (1330,110) 對準前輪著地點 (232,493)、疊在車下層、發動才淡入', () => {
  const view = code('src/view/opening.js');
  const css = read('index.html');
  // 只在發動那一幕，放在 .op-scooter 前面（同 z-index、DOM 在前 → 在車圖下層）
  assert.match(view, /\$\{act === 'depart' \? `<img class="op-road-light" src="\$\{art\('prop_v3b_scooter_road_light_v2'\)\}"[^`]*` : ''\}\s*<div class="op-scooter"/);
  // 機車位置是變數，光錐用同一組變數算
  const v = css.match(/\.op-yard \{ --sc-l: ([\d.]+)%; --sc-t: ([\d.]+)%; --sc-w: ([\d.]+)%; \}/);
  assert.ok(v, '機車位置變數');
  const [l, t, w] = v.slice(1).map(Number);
  assert.match(css, /\.op-scooter \{ position: absolute; left: var\(--sc-l\); top: var\(--sc-t\); width: var\(--sc-w\); aspect-ratio: 800 \/ 520; z-index: 1;/);
  const rl = css.match(/\.op-road-light \{([^}]*)\}/)[1];
  // 公式：left = 機車left + (232−1330)×scale；top = 機車top + (493−110)×scale；寬 = 1400×scale（scale = 機車寬／800）
  assert.equal(232 - 1330, -1098);
  assert.equal(493 - 110, 383);
  assert.match(rl, /left: calc\(var\(--sc-l\) - var\(--sc-w\) \* 1098 \/ 800\)/);
  assert.match(rl, /top: calc\(var\(--sc-t\) \+ var\(--sc-w\) \* 383 \/ 800 \* 1170 \/ 2532\)/, 'top 的 % 相對畫高，要把寬度 % 換算');
  assert.match(rl, /width: calc\(var\(--sc-w\) \* 1400 \/ 800\); aspect-ratio: 1400 \/ 720; z-index: 1;/);
  assert.match(rl, /mix-blend-mode: (screen|lighter|plus-lighter)/);
  assert.match(rl, /opacity: 0;/, '沒發動前看不到');
  assert.doesNotMatch(rl, /scaleX\(-1\)/, '車頭朝左，不翻轉');
  const on = Number(css.match(/\.op-yard\.beam \.op-road-light \{ opacity: ([\d.]+); \}/)[1]);
  assert.ok(on >= 0.6 && on <= 0.9, `發動後不透明度 ${on}`);
  // 換成畫面像素（390×844，原圖 1170×2532 剛好滿版）：光錐頂點落在前輪著地點
  const W = 390, H = 844, sc = ((w / 100) * W) / 800;
  const car = { x: (l / 100) * W, y: (t / 100) * H };
  const light = { x: car.x - 1098 * sc, y: car.y + ((w * 383 / 800 * 1170 / 2532) / 100) * H };
  assert.ok(Math.abs(light.x + 1330 * sc - (car.x + 232 * sc)) < 0.01);
  assert.ok(Math.abs(light.y + 110 * sc - (car.y + 493 * sc)) < 0.01);
  // 機車：車身（原圖 x155–644）不擋門（門右緣 776/1170）、390 寬不被右緣裁掉
  assert.ok(l + (w * 155) / 800 >= (776 / 1170) * 100, '車身擋到門');
  assert.ok(l + (w * 644) / 800 <= 96, '車身太貼右緣');
});

test('門推開後假門板淡出藏起來；存檔停在「門一開……」讀回直接是開著的門（不再閃關著的「推門進去」）', () => {
  const view = code('src/view/opening.js');
  const css = read('index.html');
  const open = L.road.findIndex((b) => b.text.startsWith('門一開'));
  // 純邏輯：每一句時門的樣子
  assert.deepEqual(doorView('road', OP.sceneAt(L.road, 0), false), { lit: false, door: 'none' });
  assert.deepEqual(doorView('road', OP.sceneAt(L.road, 1), true), { lit: false, door: 'closed' }, '推門關卡：可推的門');
  assert.deepEqual(doorView('road', OP.sceneAt(L.road, open), false), { lit: true, door: 'gone' }, '重新整理讀回：門已開');
  assert.deepEqual(doorView('road', OP.sceneAt(L.road, open), true), { lit: true, door: 'gone' }, '剛推開：門已開');
  assert.deepEqual(doorView('depart', {}, true), { lit: false, door: 'none' });
  assert.ok(!L.road[open].gate, '「門一開……」不是推門關卡，讀回時不會再叫 pushDoor（不會 set(0) 關門）');
  // 畫面：beat 依 doorView；門開了就藏假門板（讀回直接藏、剛推開淡出）
  assert.match(view, /const v = doorView\(act, look, ctl\.atDoor\);\s*el\.classList\.toggle\('lit', v\.lit\);\s*if \(v\.door === 'gone'\) hideDoor\(false\);\s*else doorWrap\.hidden = v\.door !== 'closed';/);
  assert.match(view, /el\.classList\.add\('lit'\);\s*hideDoor\(true\);/, '推開後淡出假門板');
  assert.match(view, /doorWrap\.classList\.add\('gone'\);\s*if \(fade\) later\(\(\) => \{ doorWrap\.hidden = true; \}, DOOR_FADE_MS\);\s*else doorWrap\.hidden = true;/);
  assert.doesNotMatch(view, /el\.querySelector\('#op-door'\)\.classList\.add\('open'\)/, 'beat 不再只加 .open（.open 不會轉開門板）');
  assert.match(view, /<div class="op-door-wrap" hidden>/, '一開始就藏著，讀回不會先閃一下');
  const gone = css.match(/\.op-door-wrap\.gone \{([^}]*)\}/);
  assert.ok(gone, '.op-door-wrap.gone');
  assert.match(gone[1], /opacity: 0;/);
  assert.match(gone[1], /pointer-events: none;/);
  assert.equal(Number(gone[1].match(/transition: opacity ([\d.]+)s/)[1]) * 1000, DOOR_FADE_MS);
});

test('點貓的手（_v2）從上方伸進來、指尖落在頭頂；踩奶（knead_v2）沒有凳子、有小小的上下 bob', () => {
  const main = code('src/main.js');
  // 手：內容框 (330,0)–(504,152)、指尖 (332,147)；與貓圖同比例
  assert.match(main, /const HAND = \{ src: 'char_v3b_yijun_hand_v2', w: 800, h: 600, tip: \[332, 147\], box: \[330, 0, 504, 152\] \};/);
  const [hx, hy] = main.match(/const HEAD_TOP = \[(\d+), (\d+)\];/).slice(1).map(Number);
  assert.ok(hx > 132 && hx < 379 && hy >= 23 && hy < 120, '頭頂在 headbump_v2 內容框上緣附近');
  assert.match(main, /const hx = \(HEAD_TOP\[0\] - HAND\.tip\[0\]\) \* u \+ stroke \* 6 \* u;/, '水平只有摸頭的小晃動，不從旁邊進來');
  assert.match(main, /const hy = \(HEAD_TOP\[1\] - HAND\.tip\[1\]\) \* u - away \* \(HAND\.box\[3\] \+ 40\) \* u/, '從上方進出');
  assert.match(main, /const u = w \/ 512;/);
  assert.match(main, /g\.drawImage\(hand, hx, hy, HAND\.w \* u, HAND\.h \* u\);/, '手與貓同比例（約一個貓頭大）');
  assert.doesNotMatch(main, /hw \* 0\.2|hh \* 0\.78|const hw = w \* 1\.05/, '不再用舊圖指尖 (0.2, 0.78)、手不再是貓頭兩倍');
  // 踩奶：無凳；腳底 y349 踩在椅面；正弦小 bob
  assert.doesNotMatch(read('src/main.js'), /圓凳/);
  assert.match(main, /\{ img: 'cat_longan_knead_v2', ms: 2200, dy: KNEAD_ON_SLEEP_LINE, bob: true \}/);
  assert.match(main, /const KNEAD_ON_SLEEP_LINE = -\(349 - 339\) \/ 384;/);
  assert.match(main, /const ACROSS_SEQ = \[\{ img: 'cat_longan_knead_v2', ms: 2400, dy: \(384 - 349\) \/ 384, bob: true \}/);
  const amp = Number(main.match(/const KNEAD_BOB = \{ amp: ([\d.]+), hz: ([\d.]+) \};/)[1]);
  assert.ok(amp > 0 && amp <= 0.03, `bob 幅度小：${amp}`);
  assert.match(main, /const kneadBob = \(now\) => Math\.sin\(/);
  assert.equal((main.match(/st\.bob \? kneadBob\(/g) || []).length, 2, '店裡的椅子與坐下窗景對面的椅子都有 bob');
});

test('坐下窗景：吊燈燈罩不被裁；德叔說話時站到右手邊、不擋杯子', () => {
  const main = code('src/main.js');
  const shift = Number(main.match(/const SEATED = \{[^\n]*shift: ([\d.]+),/)[1]);
  assert.ok(shift * 2532 <= 160, '往上移不超過燈罩頂');
  assert.match(main, /reader\.portrait\([^\n]*, act === 'coffee' \? 'aside' : 'center'\);/);
  assert.match(PORTRAIT_PLACE.aside, /left:\s*7\d%/);
  assert.equal(PORTRAIT_PLACE.center, 'height:130%;top:7%', '其他幕的立繪照舊');
});

test('不改既有的 assets/art 原圖（git 有追蹤的檔沒有被改動或刪除）', (t) => {
  let out;
  try { out = execFileSync('git', ['status', '--porcelain', '--', 'assets/art'], { cwd: root('.'), encoding: 'utf8' }); } catch { t.skip('沒有 git'); return; }
  const changed = out.split('\n').filter((l) => l && !l.startsWith('??'));
  assert.deepEqual(changed, [], `既有原圖被改動：${changed.join(', ')}`);
});
