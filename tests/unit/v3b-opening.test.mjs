// v3b 開場（劇本 v5.8 第一幕～第四幕，2026-11-21 19:44 定稿；開場是 v5.7 原字）：字與劇本逐字相同（拿掉稿件標記）、劇本沒有的字不上畫面、各幕各句只往前、存檔恢復、壞檔、
// 互動關卡（推門／點椅子／發動／按住騎／左右岔路／掉頭回去／再推門）、可選互動略過也能走完、第一晚自白睡著後進第一天。
// 第一天起、睡著自動存檔、跳過自白、舊存檔相容在 v3b-days.test.mjs。
// 只測純邏輯與靜態檔案，不開瀏覽器。劇本字在 src/lines/opening.js；逐句對 _agent/v3b/script-v5.8.md（本機未追蹤；沒有就跳過那幾項，
// 補回的句子另外寫死在下面）。docs/劇本.md 仍是 v5.6，開場已不再對它。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as OP from '../../src/lines/opening.js';
import * as D from '../../src/lines/days.js';
import * as S from '../../src/story/state.js';
import { load, persist, SAVE_KEY } from '../../src/story/save.js';
import { OPENING_ART, SHOP_ART } from '../../src/view/art.js';
import { doorView, DOOR_FADE_MS } from '../../src/view/opening.js';
import { PORTRAIT_PLACE } from '../../src/view/reader.js';
import { SHOP_CHAIR, SHOP_CUP, SHOP_WINDOW, SHOP_WINDOW_STAND, SHOP_CUP_STAND, SHOP_BAR, CAT_2D, DESHU_2D, KNEAD_ON_SLEEP_LINE, PET_MS, skyOf, stillOf, layoutOf, cupShown, fadesBetween, BG_FADE_MS } from '../../src/view/shop-still.js';
import { ART_MAP, srcOf, SHOP_STILL_NIGHT, SHOP_STILL_SEATED, SHOP_STILL_DAY, SHOP_STILL_DUSK } from '../../src/view/art-map.js';
import { walk } from './walk.mjs';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const SRC = JSON.parse(read('src/story/final-source.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const reload = (s) => S.normalize(clone(s), SRC);
const code = (p) => read(p).replace(/\/\/.*$/gm, ''); // 只看程式，不看註解
const L = OP.OPENING_LINES;
const allLines = () => Object.values(L).flat();
const MARKS = /【(待定|待確認|新增互動|不演出|已定|註)】/;
// 劇本 v5.9（字卡倒數版，本機未追蹤）。變數名沿用 V57（第一幕、第三幕、第四幕仍是 v5.7 原字）
const V57_PATH = '_agent/v3b/script-v5.9.md';
const HAS57 = existsSync(root(V57_PATH));
const NO57 = HAS57 ? false : `沒有 ${V57_PATH}（劇本 v5.9，本機未追蹤）`;
const V57 = HAS57 ? read(V57_PATH).replace(/\r\n/g, '\n') : '';
// 開場畫面上的字（DOM 幕自己出的旁白：收到信、信後旁白、特休前一晚）
const DOM_TEXTS = () => [...OP.ROOM_LETTER.lines, OP.ROOM_LETTER.pulled, ...OP.LETTER.afterLines, ...OP.EVE.lines];

// 照玩家的方式從頭走完開場（到第一晚睡著）：每一句「點一下」或「做完關卡」才往下；可選互動一律不做。回傳讀到的句子。
// 第一晚睡著後就是第一天早上（d1wake），不再停在待續。
function playOpening({ side = 'left', each = () => {} } = {}) {
  const { s, seen } = walk(S.newStoryState(), { side, each, stop: (st) => st.opening.act === 'd1wake' });
  return { s, seen: seen.map((b) => b.text) };
}

/* ---------- 字 ---------- */
test('稿件標記【待定】【待確認】【新增互動】都已拿掉；括弧舞台指示不是字', () => {
  const texts = [
    ...allLines().map((b) => b.text), OP.EVE.next, ...DOM_TEXTS(), OP.ROOM_LETTER.hint, OP.TITLE.next, OP.TEMPLE.back, OP.ROAD.card, ...Object.values(OP.COUNTDOWN),
    OP.LETTER.title, OP.LETTER.greeting, ...OP.LETTER.paragraphs, OP.LETTER.closing, OP.LETTER.signature,
    OP.ROAD.door, OP.DEPART.start, OP.OFFICE.form, OP.OFFICE.applicant, OP.OFFICE.to, OP.OFFICE.reasonLabel, OP.OFFICE.note, OP.OFFICE.leave, OP.OFFICE.keys, OP.RESIGNATION.text,
  ];
  for (const t of texts) {
    assert.ok(!MARKS.test(t), `還有標記：${t}`);
    assert.ok(!/^[（(]/.test(t) && !/[）)]$/.test(t), `舞台指示變成字：${t}`);
    assert.equal(t, t.trim());
  }
  // 【待定】句去標記後正文照出
  const flat = allLines().map((b) => b.text);
  assert.ok(flat.includes('龍眼的耳朵往後壓了一下，沒有走。'));
  assert.ok(flat.includes('還沒打烊，位子自己挑。'));
  assert.equal(flat.at(-1), '我本來只想躺一下，燈還沒關就睡著了。', '開場最後一句（第一晚自白的最後一句，仍是睡著句）');
  // 舊第四幕兩句、第一版德叔三句不在可玩開場
  for (const old of [OP.ACT4_CUP, OP.ACT4_EMPTY, OP.SIT, ...OP.DESHU_ENTER]) assert.ok(!flat.includes(old), old);
});

test('離職申請單（v5.7）：離職申請單、申請人：陳怡君（沒有輸入框）、送簽對象：經理、離職事由、說明、特休；沒有收件人、主旨、郵件內文', () => {
  assert.equal(OP.OFFICE.form, '離職申請單');
  assert.equal(OP.OFFICE.applicantLabel + OP.OFFICE.applicant, '申請人：陳怡君');
  assert.equal(OP.OFFICE.toLabel + OP.OFFICE.to, '送簽對象：經理');
  assert.equal(OP.OFFICE.note, '說明：這件事我想了很久，今天決定說出來。');
  assert.equal(OP.OFFICE.leave, '我還有特休沒休完，會先把特休休完，離職日就是假休完的那一天。');
  assert.equal(OP.OFFICE.keys, '喀噠、喀噠……', '打字聲字樣');
  assert.ok(!('signPlaceholder' in OP.OFFICE) && !('signature' in OP.OFFICE) && !('subject' in OP.OFFICE));
  assert.ok(!('RESIGNATION_MAIL' in OP), '郵件（經理您好、主旨辭呈、交接）拿掉');
  const view = read('src/view/opening.js');
  assert.doesNotMatch(view, /<input|\bop-name\b|可以不寫|placeholder|op-mail-head/);
  assert.match(view, /<p class="op-note">\$\{esc\(OFFICE\.note\)\}<\/p>/);
  assert.match(view, /<p class="op-sign">\$\{esc\(OFFICE\.applicantLabel\)\}\$\{esc\(OFFICE\.applicant\)\}<\/p>/);
  assert.match(view, /<div class="op-keys" aria-hidden="true" hidden>\$\{esc\(OFFICE\.keys\)\}<\/div>/, '打字時才出現');
  // 順序：離職申請單 → 申請人 → 送簽對象 → 事由欄 → 說明 → 特休 → 送出
  const office = view.slice(view.indexOf("if (act === 'office')"), view.indexOf("if (act === 'title')"));
  const order = ['OFFICE.form', 'OFFICE.applicant)', 'OFFICE.to)', 'id="op-reason"', 'OFFICE.note', 'OFFICE.leave', 'id="op-send"'].map((k) => office.indexOf(k));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), `表單順序 ${order}`);
  assert.doesNotMatch(read('index.html'), /op-sign input/);
  // 送出要先點過事由欄：按鈕一開始 disabled，點了事由欄才解除；點擊時沒點過就不做事
  assert.match(view, /id="op-send" class="primary" disabled/);
  assert.match(view, /if \(!choice \|\| send\.disabled\) return;/);
  assert.equal(OP.OFFICE.clock, '16:49');
  assert.equal(OP.OFFICE.clockAfter, '16:50');
});

test('第一幕：離職事由固定「從今天起，我單方面辭退您。」（正體「辭」），不再三選一；先點事由欄才能送出；標題按「下班」進房間', () => {
  assert.equal(OP.RESIGNATION.text, '從今天起，我單方面辭退您。');
  assert.ok(OP.RESIGNATION.text.includes('辭') && !OP.RESIGNATION.text.includes('辞'), '用正體「辭」');
  assert.deepEqual(OP.RESIGNATIONS.map((r) => r.text), ['從今天起，我單方面辭退您。'], '只剩一句');
  assert.equal(OP.OFFICE.reasonLabel, '離職事由：');
  assert.ok(!('question' in OP.OFFICE), '「結尾要寫哪一句？」拿掉');
  const view = code('src/view/opening.js');
  assert.doesNotMatch(view, /op-choices|RESIGNATIONS\.map/, '沒有三選一的按鈕');
  assert.match(view, /<button type="button" class="op-ending op-reason" id="op-reason"/);
  assert.match(view, /reason\.onclick = \(\) => \{[\s\S]*?choice = RESIGNATION\.id;[\s\S]*?typeOut\(RESIGNATION\.text\);\s*send\.disabled = false;/, '點事由欄才填字、才能送出');
  assert.match(view, /target\.textContent = RESIGNATION\.text;/);
  assert.doesNotMatch(read('index.html'), /\.op-choices/);
  // 標題畫面維持劇本原文；按「下班」先出字卡「我單方面辭退老闆前 4 天」（幕 id t4card），字卡之後才進租屋處房間（mailbox）
  assert.deepEqual(OP.TITLE.lines, ['我單方面辭退老闆後，', '開了一間夢想中的咖啡店']);
  assert.equal(OP.TITLE.sub, '試玩版・台南東山');
  assert.equal(OP.TITLE.next, '下班');
  assert.match(view, /<button type="button" id="op-next" class="primary">\$\{TITLE\.next\}<\/button>/);
  assert.match(view, /el\.querySelector\('#op-next'\)\.onclick = \(\) => api\.go\('t4card'\);/, '按「下班」先出字卡「前 4 天」');
  assert.equal(S.nextActOf('title'), 't4card');
  assert.equal(S.nextActOf('t4card'), 'mailbox');
  assert.doesNotMatch(view, /op-title-btn/, '標題本身不再是按鈕');
  if (HAS57) {
    const act1 = V57.slice(V57.indexOf('## 第一幕'), V57.indexOf('## 標題畫面'));
    assert.ok(act1.includes(`${OP.OFFICE.reasonLabel}${OP.RESIGNATION.text}`));
    assert.ok(act1.includes('申請人固定是陳怡君，沒有輸入框'));
    const title = V57.slice(V57.indexOf('## 標題畫面'), V57.indexOf('## 【待定】第二幕'));
    for (const l of OP.TITLE.lines) assert.ok(title.includes(`> ${l}`), l);
    assert.ok(title.includes('按「下班」'));
  }
});

test('第二幕「收到信」（v5.9，第一次收到）：房間旁白三句、操作提示、點信封（只能點一次）、信的全文（含「我年紀大了」那段）、信後旁白四句、讀完淡出（沒有「出發去東山」）', () => {
  assert.deepEqual(OP.ROOM_LETTER.lines, ['我下班回到租屋處，進了房間，把包包放在床上。', '今天我收到一封信。牛皮紙信封，拿起來裡面有東西在響。', '我在摺疊桌前坐下來，把信封放在桌上。']);
  assert.equal(OP.ROOM_LETTER.hint, '點信封，把信拿出來。');
  assert.equal(OP.ROOM_LETTER.pulled, '我把信抽出來，從頭看起。');
  assert.equal(OP.LETTER.title, '信');
  assert.equal(OP.LETTER.greeting, '怡君：');
  assert.deepEqual(OP.LETTER.paragraphs, [
    '妳沒見過我，突然收到這種信，一定覺得奇怪。不想理它，放著也沒關係。',
    '我在台南東山有一間老三合院，住了很多年。正廳是一間咖啡館，現在還開著。',
    '我年紀大了，現在不住那裡。店想交給妳經營，屋子也一起留給妳。那間屋子冬天曬得到太陽，住下來很舒服，而咖啡館坐起來也是暖的。',
    '我沒有要強迫妳辭職，只是咖啡館比較遠，擔心妳應付不來。',
    '那邊有人在等妳。妳哪一天去，他都在。',
    '到了東山，找院子裡種一棵老龍眼樹、門上掛風鈴的那間三合院就是。鑰匙放在信封裡，屋子是妳的，鑰匙就是這個意思。門平常沒有鎖，到了用推的就好。',
  ]);
  assert.equal(OP.LETTER.closing, '祝　平安');
  assert.equal(OP.LETTER.signature, '東山老屋　屋主');
  assert.deepEqual(OP.LETTER.afterLines, [
    '信裡說，台南東山有一間老三合院，正廳是咖啡館，屋子和店都想交給我。',
    '寫信的人我沒見過，東山我也沒去過。',
    '辭職這件事，我沒有想過。',
    '我把信摺好，和信封一起放在摺疊桌上。鑰匙留在信封裡。',
  ]);
  for (const w of ['收起來', '又把信拿出來', '其實我已經辭職了...']) assert.ok(!OP.LETTER.afterLines.some((t) => t.includes(w)), `信後旁白不該有：${w}`);
  assert.ok(!('next' in OP.LETTER) && !('after' in OP.LETTER), '信件畫面沒有「出發去東山」、沒有「其實我已經辭職了...」');
  assert.ok(!('attachment' in OP.LETTER), '「附件：鑰匙一把」拿掉');
  assert.ok(!('MAILBOX' in OP), '舊的信箱一幕（點信箱、搖起來、拿出信封）拿掉');
  const view = read('src/view/opening.js');
  assert.doesNotMatch(view, /LAWYER_LETTER|律師信|溫度基金|MAILBOX|op-box-btn|scene_mailboxes/);
  // 房間：點信封只能點一次；點了鑰匙響、旁白換句、提示消失，約一秒多後自動進入信件畫面
  const room = view.slice(view.indexOf("if (act === 'mailbox')"), view.indexOf("if (act === 'letter')"));
  assert.match(room, /id="op-env"[^>]*disabled/, '旁白讀完才能點信封');
  assert.match(room, /if \(env\.disabled\) return;\s*env\.disabled = true;/);
  assert.match(room, /play\('keys'\);\s*cap\.textContent = R\.pulled;\s*hint\.remove\(\);\s*await sleep\(1300\);\s*if \(alive\(\)\) api\.go\('letter'\);/);
  assert.match(room, /<p class="op-hint" id="op-hint" hidden>\$\{esc\(R\.hint\)\}<\/p>/);
  // 信：信後旁白一句一句點，最後一句再點一下就淡出 → 字卡「我單方面辭退老闆前 2 天」（信件畫面沒有 #op-next）
  const letter = view.slice(view.indexOf("if (act === 'letter')"), view.indexOf("if (act === 'eve')"));
  assert.doesNotMatch(letter, /op-next|L\.next|api\.go\('road'\)/, '信件畫面沒有「出發去東山」');
  assert.match(letter, /if \(k >= L\.afterLines\.length - 1\) \{\s*if \(leaving\) return;\s*leaving = true;\s*play\('tap'\);\s*api\.go\('t2card', \{ fade: true \}\);/);
  assert.match(view, /<button type="button" class="op-attach" id="op-attach" aria-label="\$\{L\.keyLabel\}"><svg[^`]*?<\/svg><\/button>/);
  assert.ok(S.OPENING_ACTS.includes('mailbox'), '幕 id 沿用，舊存檔不會壞');
  const s = S.newStoryState();
  assert.equal(S.setOpeningAct(s, 'title'), true);
  assert.equal(S.setOpeningAct(s, 'mailbox'), true);
  assert.equal(S.setOpeningAct(s, 'letter'), true);
  assert.equal(S.nextActOf('letter'), 't2card');
  assert.equal(S.nextActOf('t2card'), 'eve');
  assert.equal(S.nextActOf('eve'), 'road');
});

test('特休前一晚（v5.9，字卡「前 2 天」之後）：旁白五句、最後一句才出「出發去東山」→ 夜裡，東山；信封擺在桌上不能點', () => {
  assert.deepEqual(OP.EVE.lines, [
    '那封信一直擺在摺疊桌上。',
    '今天人資來問我，特休一天都沒請，要不要先放幾天。',
    '我說，去年的也是，一天都沒請，全部放著沒用。我先請了明天一天。',
    '明天不用上班。我想去看一眼，那間咖啡館是不是真的在那裡。',
    '我把鑰匙從信封裡拿出來，放進外套口袋。信留在桌上。',
  ]);
  assert.equal(OP.EVE.next, '出發去東山', '按鈕字原字，位置改到特休前一晚');
  const view = code('src/view/opening.js');
  const eve = view.slice(view.indexOf("if (act === 'eve')"));
  assert.match(eve, /<button type="button" id="op-next" class="primary op-eve-next" hidden>\$\{E\.next\}<\/button>/);
  assert.match(eve, /if \(k === E\.lines\.length - 1\) \{ box\.classList\.add\('done'\); next\.hidden = false; \}/);
  assert.match(eve, /api\.go\('road'\);/);
  assert.match(eve, /<span class="op-env" aria-hidden="true">/, '信封只是擺著（不是按鈕）');
  assert.equal(S.lineCount('eve'), 0, 'DOM 畫面自己出字');
});

test('倒數字卡（承峰 02:07／02:09 定的用語）：前 4／2／1 天、歸零卡；數字前半形空格、當天與 16:49 之間全形空格；親寫句與標題不動', () => {
  assert.deepEqual(OP.COUNTDOWN, {
    t4card: '我單方面辭退老闆前 4 天',
    t2card: '我單方面辭退老闆前 2 天',
    t1card: '我單方面辭退老闆前 1 天',
    t0card: '我單方面辭退老闆當天　16:49',
  });
  for (const n of [4, 2, 1]) assert.ok(Object.values(OP.COUNTDOWN).includes(`我單方面辭退老闆前 ${n} 天`), `前 ${n} 天（半形空格）`);
  assert.ok(OP.COUNTDOWN.t0card.includes('當天　16:49'), '全形空格');
  assert.ok(!Object.values(OP.COUNTDOWN).some((t) => t.includes('辭職前')), '不用 v4 的「辭職前 N 天」');
  assert.deepEqual(OP.OPENING_CARDS, { t4card: OP.COUNTDOWN.t4card, t2card: OP.COUNTDOWN.t2card });
  assert.equal(OP.RESIGNATION.text, '從今天起，我單方面辭退您。');
  assert.deepEqual(OP.TITLE.lines, ['我單方面辭退老闆後，', '開了一間夢想中的咖啡店']);
  // 字卡的幕沒有句子；開場的兩張由 main.js 用同一個 dayCard（showCard）演
  for (const a of ['t4card', 't2card', 't1card', 't0card']) {
    assert.equal(S.lineCount(a), 0, a);
    assert.equal(S.CARD_TEXTS[a], OP.COUNTDOWN[a], a);
  }
  const main = code('src/main.js');
  assert.match(main, /if \(OPENING_CARDS\[act\]\) return dayCard\(act, OPENING_CARDS\[act\]\);/);
  // 版面：長字卡字小一點、可以換行（字不改）
  assert.match(code('src/view/days.js'), /if \(\[\.\.\.text\]\.length > 8\) el\.classList\.add\('long'\);/);
  assert.match(read('index.html'), /\.op-day\.daycard\.long \.op-card p \{[^}]*max-width: calc\(100% - 48px\);/);
  if (HAS57) for (const t of Object.values(OP.COUNTDOWN)) assert.ok(V57.includes(`字卡：${t}）`), `劇本沒有字卡：${t}`);
});

test('玩家場次順序（v5.9 寫死）與讀檔時重出最近的字卡（開場不出、字卡本身不出、待續不出）', () => {
  const A = S.OPENING_ACTS;
  const order = ['office', 'title', 't4card', 'mailbox', 'letter', 't2card', 'eve', 'road', 'room', 't1card', 'd1wake', 'd1store', 't0card', 'resend', 'd2card', 'd2cafe', 'd5card', 'd5brew', S.END_ACT];
  for (let i = 1; i < order.length; i++) assert.ok(A.indexOf(order[i - 1]) < A.indexOf(order[i]), `${order[i - 1]} → ${order[i]}`);
  assert.equal(S.nextActOf('room'), 't1card');
  assert.equal(S.nextActOf('t1card'), 'd1wake');
  assert.equal(S.nextActOf('d1store'), 't0card');
  assert.equal(S.nextActOf('t0card'), 'resend');
  assert.equal(S.nextActOf('resend'), 'd2card');
  const at = (act, line = 0) => S.jumpState(S.newStoryState(), act, line);
  assert.equal(S.resumeCardOf(at('office')), null);
  assert.equal(S.resumeCardOf(at('title')), null);
  assert.equal(S.resumeCardOf(at('t4card')), null, '字卡本身會演，不另外重出');
  assert.equal(S.resumeCardOf(at('mailbox')), 't4card');
  assert.equal(S.resumeCardOf(at('letter')), 't4card');
  assert.equal(S.resumeCardOf(at('eve')), 't2card');
  assert.equal(S.resumeCardOf(at('deshu', 12)), 't2card');
  assert.equal(S.resumeCardOf(at('room', 5)), 't2card');
  assert.equal(S.resumeCardOf(at('d1wake', 3)), 't1card');
  assert.equal(S.resumeCardOf(at('d1store', 9)), 't1card');
  assert.equal(S.resumeCardOf(at('resend')), 't0card');
  assert.equal(S.resumeCardOf(at('d2cafe', 4)), 'd2card');
  assert.equal(S.resumeCardOf(at('d5brew', 2)), 'd5card');
  assert.equal(S.resumeCardOf(at(S.END_ACT)), null);
  const main = code('src/main.js');
  assert.match(main, /if \(resumeCard\) \{[\s\S]*?resumeCard = false;\s*const card = S\.resumeCardOf\(state\);\s*if \(card\) return replayCard\(card\);/);
  assert.match(main, /async function replayCard\(card\) \{[\s\S]*?showCard\(\$\('opening'\), card, S\.CARD_TEXTS\[card\]\)[\s\S]*?fadeThen\(go,/);
  assert.doesNotMatch(main.slice(main.indexOf('async function replayCard'), main.indexOf('function nextAct(')), /save\(\)|setOpeningAct/, '重出字卡不改存檔');
  assert.ok(main.indexOf('async function replayCard') < main.indexOf('function nextAct('));
});

test('接回場（resend，歸零字卡之後）：同一張已填好的單、不能點事由／送出、自動送出用開場同一份 sendFx、四拍（送出去了／我想起信上的那一句／信上原句用信的字體／其實我已經辭職了...）、「下班」去字卡「第二天」', () => {
  assert.deepEqual(D.RESEND.lines, ['送出去了。', '我想起信上的那一句。', '我沒有要強迫妳辭職，只是咖啡館比較遠，擔心妳應付不來。', '其實我已經辭職了...']);
  assert.equal(D.RESEND.lines[2], OP.LETTER.paragraphs[3], '信上原句：親寫原字');
  assert.equal(D.RESEND.quoteAt, 2, '信的字體只用在信上原句那一拍');
  assert.equal(D.RESEND.next, '下班');
  assert.equal(D.DAY_ACT_VIEW.resend, 'office');
  assert.equal(S.lineCount('resend'), 0, '沒有閱讀框的句子：讀檔落在中間從開頭重播');
  const view = code('src/view/opening.js');
  const resend = view.slice(view.indexOf("if (act === 'resend')"), view.indexOf("if (act === 'title')"));
  const office = view.slice(view.indexOf("if (act === 'office')"), view.indexOf("if (act === 'resend')"));
  // 同一張單：事由（親寫句）已填好、按鈕 disabled；沒有事由的點擊處理、送出的點擊處理
  assert.match(resend, /class="op-ending op-reason filled" id="op-reason" aria-pressed="true" disabled><span class="op-reason-label">\$\{esc\(OFFICE\.reasonLabel\)\}<\/span><span class="op-ending-text">\$\{esc\(RESIGNATION\.text\)\}<\/span>/);
  assert.match(resend, /<button type="button" id="op-send" class="primary" disabled>\$\{OFFICE\.send\}<\/button>/);
  assert.match(resend, /<p class="op-note">\$\{esc\(OFFICE\.note\)\}<\/p>/);
  assert.doesNotMatch(resend, /reason\.onclick|send\.onclick|opening\.resignation|choice/, '不依賴開場有沒有點過事由');
  // 自動送出：跟開場同一個 sendFx（送出音效、時鐘翻頁）
  assert.match(resend, /if \(!\(await sendFx\(el, alive\)\)\) return;/);
  assert.match(office, /if \(await sendFx\(el, alive\)\) api\.go\('title'\);/);
  assert.equal((view.match(/play\('send'\)/g) || []).length, 1, '送出音效只有 sendFx 一處');
  assert.match(view, /export async function sendFx\(el, alive\) \{\s*play\('send'\);\s*const clock = el\.querySelector\('\.op-clock'\);\s*clock\.classList\.add\('flip'\);[\s\S]*?clock\.textContent = OFFICE\.clockAfter;/);
  // 兩顆「下班」：標題 → t4card；接回場 → d2card（分開處理）
  assert.match(resend, /next\.onclick = \(\) => \{ if \(next\.disabled\) return; next\.disabled = true; api\.go\('d2card', \{ fade: true \}\); \};/);
  assert.match(resend, />\$\{R\.next\}<\/button>/);
  assert.match(resend, /if \(k === R\.lines\.length - 1\) \{ after\.classList\.add\('done'\); next\.hidden = false; \}/);
  assert.match(resend, /after\.classList\.toggle\('quote', k === R\.quoteAt\);/, '信的字體跟著 RESEND.quoteAt，不寫死第幾句');
  // 跳關進接回場（沒玩過開場、resignation 是 null）照樣是 resend 第 0 句
  const j = S.jumpState(S.newStoryState(), 'resend', 5);
  assert.equal(j.opening.act, 'resend');
  assert.equal(j.opening.resignation, null);
  assert.equal(j.opening.line, 0);
  assert.match(code('src/main.js'), /const DOM_ACTS = \['office', 'title', 'mailbox', 'letter', 'eve', 'resend'\];/);
});

test('存檔版本 2：版本 1 的存檔不打回開頭；停在原「第二天」開頭對到歸零字卡之前；其他幕原幕原句', () => {
  assert.equal(S.SCHEMA, 2);
  const v1 = (act, line, extra = {}) => S.playable(S.normalize({ v: 1, phase: 'opening', opening: { act, line, fork: 'left', ...extra } }, SRC));
  assert.equal(v1('d2card', 0).opening.act, 't0card');
  assert.equal(v1('d2cafe', 0).opening.act, 't0card', '第二天回咖啡館第 0 句＝第二天開頭');
  assert.equal(v1('d2cafe', 5).opening.act, 'd2cafe');
  assert.equal(v1('d2cafe', 5).opening.line, 5);
  assert.equal(v1('deshu', 12).opening.line, 12);
  assert.equal(v1('mailbox', 0).opening.act, 'mailbox');
  assert.equal(v1('letter', 0).opening.act, 'letter');
  assert.equal(v1('d1store', 3).opening.act, 'd1store');
  // 版本 2（新存檔）的 d2card、d2cafe 第 0 句照原樣
  assert.equal(S.normalize({ v: 2, phase: 'opening', opening: { act: 'd2card', line: 0 } }, SRC).opening.act, 'd2card');
  assert.equal(S.normalize({ v: 2, phase: 'opening', opening: { act: 'd2cafe', line: 0 } }, SRC).opening.act, 'd2cafe');
  assert.deepEqual(S.normalize({ v: 3, phase: 'opening', opening: { act: 'deshu' } }, SRC), S.newStoryState(), '1、2 以外的版本從頭');
  assert.equal(S.newStoryState().v, 2);
});

// 劇本 v5.9「# 開場」到「# 最底下那個抽屜」：旁白／對白（照順序）、引用區塊（表單、標題、信）、互動裡的按鈕字
function scriptOpening() {
  const md = V57;
  const body = md.slice(md.indexOf('\n# 開場\n'), md.indexOf('\n# 最底下那個抽屜\n'));
  const strip = (x) => x.replace(/^(【(待定|待確認|新增互動)】)+/, '');
  const spoken = [];
  const quoted = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('---') || line.startsWith('（') || line.startsWith('**')) continue;
    if (line.startsWith('>')) { const q = strip(line.replace(/^>\s*/, '')); if (q && !q.startsWith('（')) quoted.push(q); continue; } // 空白引用行不是字
    const m = strip(line).match(/^(德叔|我)(（只有聲音）)?：「(.*)」$/);
    spoken.push(m ? { who: m[1] === '德叔' ? 'deshu' : 'me', text: m[3] } : { who: undefined, text: strip(line) });
  }
  return { body, spoken, quoted };
}

test('開場每一句（收到信、信後旁白、特休前一晚、第三幕到第一晚自白）照順序與劇本 v5.9 逐字相同；引用區塊與畫面字也相同', { skip: NO57 }, () => {
  const { body, spoken, quoted } = scriptOpening();
  const mine = [
    ...DOM_TEXTS().map((text) => ({ text })),
    ...['road', 'deshu', 'coffee', 'ride', 'fork', 'temple', 'return', 'stay', 'room'].flatMap((a) => L[a]),
  ].map((b) => ({ who: b.who, text: b.text }));
  assert.deepEqual(mine, spoken);
  assert.equal(spoken.at(-1).text, '我本來只想躺一下，燈還沒關就睡著了。');
  // 表單、標題、信（引用區塊，照順序）
  assert.deepEqual(quoted, [
    OP.OFFICE.form, OP.OFFICE.applicantLabel + OP.OFFICE.applicant, OP.OFFICE.toLabel + OP.OFFICE.to,
    `${OP.OFFICE.reasonLabel}${OP.RESIGNATION.text}`, OP.OFFICE.note, OP.OFFICE.leave,
    ...OP.TITLE.lines, OP.TITLE.sub,
    OP.LETTER.greeting, ...OP.LETTER.paragraphs, OP.LETTER.closing, OP.LETTER.signature,
  ]);
  // 申請人、開發者列、按鈕字、操作提示、打字聲字樣、轉場字、提示字（劇本的互動與舞台指示裡寫明的字）
  assert.ok(body.includes(`申請人固定是${OP.OFFICE.applicant}`));
  assert.ok(body.includes(`${OP.TITLE.credit}・${OP.TITLE.links.map((l) => l.text).join('・')}`));
  for (const s of [OP.OFFICE.send, OP.OFFICE.keys, OP.TITLE.next, OP.ROOM_LETTER.hint, OP.LETTER.title, OP.EVE.next, OP.ROAD.card, OP.ROAD.door, OP.DEPART.start, OP.TEMPLE.back, '摸摸龍眼', '點床躺下']) {
    assert.ok(body.includes(`「${s}」`), `劇本找不到「${s}」`);
  }
  // 開場裡的兩張倒數字卡（舞台指示裡寫明卡上的字）
  for (const c of Object.values(OP.OPENING_CARDS)) assert.ok(body.includes(`字卡：${c}）`), `劇本開場找不到字卡：${c}`);
  // 「出發去東山」在特休前一晚，不在信的那一段
  // （篇首「玩家場次順序」與信後舞台指示「這裡沒有「出發去東山」」也會提到這四個字，所以分節看）
  const eveAt = body.indexOf('## 【待定】特休前一晚');
  assert.ok(eveAt > 0, '劇本開場找不到「## 【待定】特休前一晚」');
  assert.ok(body.indexOf('按「出發去東山」', eveAt) > eveAt, '特休前一晚的互動指示裡要有按「出發去東山」');
  const letterSec = body.slice(body.indexOf('## 【待定】第二幕'), eveAt);
  assert.doesNotMatch(letterSec, /按「出發去東山」/, '信的那一節不該有「出發去東山」按鈕');
  for (const l of letterSec.split('\n').filter((x) => x.includes('「出發去東山」'))) assert.match(l, /沒有「出發去東山」/, `信的那一節只能寫「沒有「出發去東山」」：${l}`);
});

test('v5.7 開場補回的句子（不靠劇本檔也照測）：德叔倒粉、椅子是木頭的、來的時候天就已經黑了、門閂、兩句自白', () => {
  const has = (act, who, text) => assert.ok(L[act].some((b) => b.who === who && b.text === text), `${act}：${text}`);
  has('deshu', undefined, '德叔問完沒有等我回答，就把磨好的咖啡粉倒進濾杯。');
  assert.equal(L.deshu.findIndex((b) => b.text.startsWith('德叔問完')), L.deshu.findIndex((b) => b.text === '老闆要不要試一下咖啡？') + 1);
  assert.equal(L.coffee[0].text, '椅子是木頭的，機車騎一個多小時，我屁股麻到現在。');
  assert.equal(L.coffee[1].text, '這個杯子沒有人用，以後就是妳的。');
  assert.deepEqual(L.ride.map((b) => b.text), [
    '過了第一個彎，後照鏡裡就看不到那盞燈了。',
    '車燈只照得到前面一小塊柏油，兩邊是果園還是水溝，我看不出來。',
    '來的時候天就已經黑了，我是跟著導航騎上來的，沒在記路。',
    '現在手機夾在龍頭上，導航一直轉圈圈，訊號剩一格。',
  ]);
  assert.equal(L.stay.at(-1).text, '我也住在這間三合院，晚上有什麼事，妳喊一聲我就聽得到。門平常沒在鎖，妳要鎖的話，裡面有門閂。');
  assert.equal(OP.ROAD.card, '夜裡，東山。');
  assert.equal(OP.TEMPLE.back, '掉頭回去');
});

test('劇本沒有的字不上畫面：舊信箱、舊信、舊郵件、「傍晚，東山。」與舊稿的句子都拿掉；按鈕字、轉場字、提示字照劇本', () => {
  const shown = JSON.stringify({ RESIGNATION: OP.RESIGNATION, OFFICE: OP.OFFICE, TITLE: OP.TITLE, ROOM: { ...OP.ROOM_LETTER, envLabel: undefined }, LETTER: { ...OP.LETTER, keyLabel: undefined }, ROAD: OP.ROAD, DEPART: OP.DEPART, TEMPLE: OP.TEMPLE, L });
  const view = code('src/view/opening.js');
  const old = [
    '經理您好', '辭呈', '我會在月底前把手上的工作交接完畢', '陳怡君　敬上', '收件人：', '主旨：',
    '點信箱，把信封拿出來。', '搖起來，有鑰匙的聲音。', '拿出信封', '若妳尚未辭職', '辭了。今天下午四點五十分。', '附件：鑰匙一把',
    '傍晚，東山。', '嗯。信是老老闆寫的。', '擦過去', '而妳是老闆。', '不用麻煩了。', '磨豆機響了，我後面的話沒講。',
    '椅子是木頭的，坐下去才知道腿有多痠。', '公司那台機器的咖啡', '下去那段沒有路燈，騎慢一點。', '來的時候天還亮，我是跟著導航騎上來的，沒在記路。',
    '找不到路下去', '被子', '我回去了，早上再過來。', '德叔說他早上再過來',
  ];
  for (const o of old) {
    assert.ok(!shown.includes(o), `開場字還有：${o}`);
    assert.ok(!view.includes(o), `開場畫面還有：${o}`);
  }
  // 畫面上每一串字都在劇本開場裡出現過（螢幕閱讀器用的 aria-label 除外）
  if (HAS57) {
    const { body } = scriptOpening();
    for (const t of [...allLines().map((b) => b.text), ...DOM_TEXTS(), OP.ROOM_LETTER.hint, OP.EVE.next, OP.LETTER.title, ...Object.values(OP.OPENING_CARDS), ...OP.LETTER.paragraphs, OP.OFFICE.form, OP.OFFICE.note, OP.OFFICE.leave, OP.OFFICE.keys,
      OP.OFFICE.applicantLabel + OP.OFFICE.applicant, OP.OFFICE.toLabel + OP.OFFICE.to, OP.OFFICE.reasonLabel + OP.RESIGNATION.text, OP.OFFICE.send, OP.OFFICE.clock, OP.OFFICE.clockAfter,
      ...OP.TITLE.lines, OP.TITLE.sub, OP.TITLE.next, OP.TITLE.credit, ...OP.TITLE.links.map((l) => l.text), OP.ROAD.card, OP.ROAD.door, OP.DEPART.start, OP.TEMPLE.back]) {
      assert.ok(body.includes(t), `劇本開場沒有：${t}`);
    }
  }
  // 掉頭：按鈕字「掉頭回去」；三合院外有轉場字卡「夜裡，東山。」（只在第一次到、第 0 句）
  assert.match(view, /id="op-turnback" hidden>\$\{esc\(TEMPLE\.back\)\}<\/button>/);
  assert.match(view, /\$\{act === 'road' \? `<div class="op-card" \$\{introOn \? '' : 'hidden'\}><p>\$\{esc\(ROAD\.card\)\}<\/p><\/div>` : ''\}/);
});

/* ---------- 推進、存檔恢復 ---------- */
test('開場只往前：各幕順序、換幕從第 0 句開始、句子不能跳過最後一句也不能往回', () => {
  assert.deepEqual(S.OPENING_ACTS.slice(0, 20), ['office', 'title', 't4card', 'mailbox', 'letter', 't2card', 'eve', 'road', 'deshu', 'sit', 'coffee', 'depart', 'ride', 'fork', 'temple', 'return', 'stay', 'room', 't1card', 'd1wake'], '開場之後：字卡「前 1 天」→ 第一天早上');
  assert.equal(S.OPENING_ACTS.at(-1), S.END_ACT, '待續在第四天之後');
  assert.ok(!S.OPENING_ACTS.includes('end'), '舊的 end（第一晚後的待續）不在列表裡');
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
  assert.equal(S.sleepThrough(s), false, '不在自白裡不能睡著');
});

test('從頭走完開場（到第一晚睡著）：每一幕、每一句存檔讀回都在同一處；長對話（德叔 32 句）也記得住', () => {
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
  assert.equal(s.opening.act, 'd1wake', '第一晚睡著後直接是第一天早上');
  assert.equal(s.opening.line, 0);
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

test('第一晚睡著後進第一天（不停在待續）：phase 一直是 opening；舊存檔停在三天故事也回到開場開頭', () => {
  const { s } = playOpening();
  assert.equal(S.isOpeningEnd(s), false, '第一晚之後不是待續');
  assert.equal(s.opening.act, 'd1wake');
  assert.equal(s.phase, 'opening');
  assert.equal(s.at, null);
  for (const a of S.OPENING_ACTS.slice(0, S.OPENING_ACTS.indexOf('d1wake') + 1)) assert.equal(S.setOpeningAct(s, a), false, `不能回到 ${a}`);
  assert.equal(reload(s).opening.act, 'd1wake');
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
  assert.match(view, /<p class="op-end-title">待續<\/p>/, '待續畫面還在（第四天之後才用）');
  assert.match(main, /if \(act === S\.END_ACT\) return openingScene\('end'\);/);
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
    walk(s, { side: 'right', stop: S.isOpeningEnd });
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
  assert.equal(OP.TEMPLE.back, '掉頭回去', '劇本 v5.8：按「掉頭回去」');
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
  assert.match(view, /id="op-turnback" hidden>\$\{esc\(TEMPLE\.back\)\}<\/button>/);
  // 店內（2D 定景）：點椅子才坐下（椅子是唯一的熱點，點其他地方不會坐下）；不自動坐下、不轉鏡頭
  const main = code('src/main.js');
  const sit = main.slice(main.indexOf("if (act === 'sit') {"), main.indexOf('const done = await runLines(act, {', main.indexOf("if (act === 'sit') {")));
  assert.match(sit, /reader\.hot\(\[\{ id: 'chair', label: '椅子', need: true, rect: elRect\(shop\.hot\('chair'\)\),/);
  assert.match(sit, /play\('place'\);\s*nextAct\('sit'/);
  assert.equal((sit.match(/nextAct\(/g) || []).length, 1, '只有點椅子會坐下');
  assert.doesNotMatch(sit, /setTimeout|turnTo|yaw/, '不自動坐下、不轉鏡頭');
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
  assert.equal(at('deshu', brew).frame, 'side', '畫面推近我和龍眼（靠窗那一側）');
  const serve = brew + 1;
  // char_deshu_serve 立繪手上就端著那一杯：端杯那句桌上還沒有杯子（不會同時兩個杯子）；放下之後（下一句）才出現、place 在那句
  assert.equal(at('deshu', serve).deshu, 'serveTable');
  assert.equal(at('deshu', serve).cup, false, '德叔還端在手上，桌上沒有杯子');
  assert.ok(!(L.deshu[serve].sfx || []).includes('place'), '桌上還空著，不放 place');
  assert.equal(at('deshu', serve + 1).cup, true, '德叔把杯子放在靠窗那張桌');
  assert.equal(at('deshu', serve + 1).deshu, null, '沒有桌旁空手立繪：放下後 2D 德叔退場');
  assert.equal(at('deshu', serve + 1).portrait, true);
  assert.deepEqual(L.deshu[serve + 1].sfx, ['place']);
  assert.equal(L.deshu.at(-1).text, '泡好了。坐下喝看看。');
  assert.equal(serve + 1, L.deshu.length - 1);
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
  const main = read('src/main.js') + read('src/view/shop-still.js');
  const used = new Set([...OPENING_ART, ...SHOP_ART]);
  for (const m of (view + main).matchAll(/art\('([\w]+)'\)|img: '([\w]+)'|img\('([\w]+)'\)|src: '([\w]+)'/g)) used.add(m[1] || m[2] || m[3] || m[4]);
  for (const pose of ['stand', 'brew', 'serve', 'broom']) used.add(`char_deshu_${pose}`);
  // 舊圖在 assets/art/；有斜線的參照（例：白天店內圖 art-v59/…）照 artUrl 在 assets/ 底下
  for (const n of used) assert.ok(n.includes('/') ? existsSync(root(`assets/${n}.webp`)) : files.has(`${n}.webp`), `缺 ${n}.webp`);
  for (const n of ['key', 'cat_longan_walk', 'cat_longan_sleep', 'cat_longan_sit']) assert.ok(OPENING_ART.includes(n) || SHOP_ART.includes(n), `${n} 沒有預載`);
  // 店內 2D 定景用到的圖都開機預載；店內環景的貼圖不再預載
  const shopImgs = [srcOf(SHOP_STILL_NIGHT), srcOf(SHOP_STILL_SEATED), srcOf(SHOP_STILL_DAY), 'prop_cup', 'char_v3b_yijun_hand_v2', 'cat_longan_headbump_v2', 'cat_longan_lick_paw_v2',
    ...Object.values(DESHU_2D).map((d) => d.img), ...Object.values(CAT_2D).flatMap((c) => [c.img, ...(c.seq || []).map((s) => s.img)])];
  for (const n of shopImgs) assert.ok(SHOP_ART.includes(n), `店內 2D 定景的 ${n} 沒有預載`);
  for (const n of ['backbar', 'tex_wall_plaster', 'tex_floor_wood', 'tex_counter_front', 'tex_wood_top', 'pendant_lamp', 'kettleSet', 'bookshelf', 'radio', 'window_day_clear', 'window_night_clear', 'chair', 'prop_v3b_window_table', 'scene_mailboxes']) {
    assert.ok(!SHOP_ART.includes(n) && !OPENING_ART.includes(n), `${n} 不再預載`);
  }
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
    // 劇本 v5.7「夜裡，東山。」：三合院外都是晚上，傍晚原圖不再接（檔案留著、不刪）
    if (n === 'scene_v3b_sanheyuan_dusk_v2') assert.ok(!prog.includes(`'${n}'`), '傍晚原圖不再用');
    else assert.ok(view.includes(`'${n}'`), `${n} 沒接進開場`);
  }
  // 七類佔位都拿掉
  assert.doesNotMatch(view, /佔位/);
  for (const ph of ['三合院外觀（傍晚）', '三合院外觀（晚上）', '鐵皮工寮\'', '土地公廟\'', '庭埕（晚上）', '護龍的房間']) assert.ok(!view.includes(`'${ph}`), `還有佔位：${ph}`);
  assert.doesNotMatch(read('index.html'), /\.op-ph\b|op-yn-roof|op-yn-floor|op-rm-wall|op-rm-window|op-rm-lamp|op-rm-cabinet|\.quilt/, '自繪的屋頂地板、牆窗櫃燈被子都拿掉');
  // 三合院外：劇本 v5.7 三幕都是晚上；不再拿縣道圖當三合院、不再壓暗夜景
  assert.match(prog, /<img class="op-art-img" src="\$\{art\('scene_v3b_sanheyuan_night_v2'\)\}" alt="">/);
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

test('v3b 第二批原圖：13 張都在、原圖尺寸沒動、有預載、都接進開場（靠窗木桌只給已拔掉的環景用：檔案留著、不再引用）', () => {
  const both = read('src/view/opening.js') + read('src/main.js') + read('src/view/shop-still.js') + read('src/view/art.js');
  for (const [n, size] of Object.entries(V3B_ART2)) {
    assert.ok(existsSync(root(`assets/art/${n}.webp`)), `缺 ${n}.webp`);
    assert.deepEqual(webpSize(readFileSync(root(`assets/art/${n}.webp`))), size, `${n} 尺寸不對（原圖不可縮放）`);
    if (n === 'prop_v3b_window_table') { assert.ok(!both.includes(`'${n}'`), '靠窗木桌（環景用）不再引用'); continue; }
    if (n === 'scene_v3b_shop_window_night_seated') { // 坐下喝咖啡的靠窗特寫：從 art-map.js 來，開機預載
      assert.equal(srcOf(SHOP_STILL_SEATED), n);
      assert.ok(SHOP_ART.includes(n), `${n} 沒有預載`);
      continue;
    }
    assert.ok(OPENING_ART.includes(n) || SHOP_ART.includes(n), `${n} 沒有預載`);
    assert.ok(both.includes(`'${n}'`), `${n} 沒接進開場`);
  }
});

test('第二批接線：點貓（手＋頂頭）、伸懶腰、踩兩圈、耳朵、舔前腳、換邊睡、掃把、靠窗木桌、鑰匙特寫、躺下視角、坐下窗景', () => {
  const view = code('src/view/opening.js');
  const main = code('src/main.js');
  const shop = code('src/view/shop-still.js');
  const css = read('index.html');
  const at = (act, i) => OP.sceneAt(L[act], i);
  const idx = (act, t) => L[act].findIndex((b) => b.text === t);
  // 8. 點貓：怡君的手入鏡摸頭 + 龍眼頂頭（疊在貓的位置），呼嚕；不點照走（optional 不是 gate）
  assert.match(shop, /step\(\{ img: 'cat_longan_headbump_v2' \}\);/);
  assert.match(shop, /class="sh-hand" src="\$\{art\('char_v3b_yijun_hand_v2'\)\}"/);
  assert.match(main, /rect: elRect\(shop\.hot\('cat'\)\), onTap: \(\) => \{ shop\.pet\(\); play\('purr'\); \}/);
  assert.equal(L.deshu[idx('deshu', '然後他整個身體靠上來，從頭到尾巴在我小腿上蹭過去，掉頭再蹭一次。')].optional, 'cat');
  // 9. 台階上伸懶腰再鑽進去
  assert.match(view, /class="op-step-cat stretch" src="\$\{art\('cat_longan_stretch_v3b_v2'\)\}"/);
  assert.match(css, /\.op-yard\.lit \.op-step-cat\.stretch \{ animation: catstretch/);
  //    跳上靠窗那張椅子：踩兩圈（knead）→ 趴下（sleep）→ 耳朵轉過來（ears_turn）
  assert.equal(at('deshu', idx('deshu', '我往裡面走了一步。')).cat, 'chair');
  assert.deepEqual(CAT_2D.chair.seq.map((s) => s.img), ['cat_longan_knead_v2', 'cat_longan_sleep', 'cat_longan_ears_turn_v2']);
  //    龍眼跳上對面那張椅子：踩兩圈 → 趴下
  assert.equal(at('coffee', idx('coffee', '龍眼跳上對面那張椅子，踩兩圈，趴下。')).cat, 'across');
  assert.deepEqual(CAT_2D.across.seq.map((s) => s.img), ['cat_longan_knead_v2', 'cat_longan_sleep']);
  //    磨豆機響：耳朵往後壓（ears_back），沒有走
  assert.equal(at('deshu', idx('deshu', '龍眼的耳朵往後壓了一下，沒有走。')).cat, 'earsBack');
  assert.deepEqual(CAT_2D.earsBack.seq.map((s) => s.img), ['cat_longan_ears_back_v2', 'cat_longan_sit']);
  //    不點貓：坐在腳邊舔前腳
  assert.equal(at('deshu', idx('deshu', '那隻貓叫龍眼，是這間三合院的主人，而妳是新老闆。')).cat, 'feet');
  assert.match(shop, /spot\.lick && !petted \? 'cat_longan_lick_paw_v2'/);
  // 劇本會用到的貓位置都有 2D 位置
  for (const b of allLines()) if (b.set?.cat) assert.ok(CAT_2D[b.set.cat], `貓位置 ${b.set.cat}`);
  //    坐下以後、跳上對面椅子之前：坐在腳邊（靠窗特寫上的位置），不在杯子上
  assert.equal(at('coffee', 0).cat, 'feetSeated');
  assert.equal(CAT_2D.feetSeated.img, 'cat_longan_sit');
  assert.ok(CAT_2D.feetSeated.x + CAT_2D.feetSeated.w / 2 < SHOP_CUP.x - 2, '腳邊的貓不擋杯子');
  // 10. 傍晚台階用 sleep；回來換了一邊睡用 sleep_flip，不再 CSS 翻轉舊 sleep
  assert.match(view, /act === 'road' \? `<img class="op-step-cat" src="\$\{art\('cat_longan_sleep'\)\}"/);
  assert.match(view, /act === 'return' \? `<img class="op-step-cat" src="\$\{art\('cat_longan_sleep_flip_v2'\)\}"/);
  assert.doesNotMatch(view, /op-step-cat\$\{|' flip'/);
  assert.doesNotMatch(css, /\.op-step-cat\.flip|scaleX\(-1\)/);
  // 11. 晚上回店：德叔拿著掃把（店裡與立繪都是 broom）
  assert.equal(at('stay', 0).deshu, 'broom');
  assert.equal(DESHU_2D.broom.img, 'char_deshu_broom');
  assert.match(main, /act === 'stay' \? 'char_deshu_broom' : face/);
  // 12. 桌上的杯子：店內 2D 定景的佔位圖本身有桌子，杯子仍是 prop_cup 疊在桌面上（不再疊環景用的靠窗木桌）
  assert.doesNotMatch(main + shop, /drawTable|tex_wood_top|prop_v3b_window_table/);
  assert.match(shop, /class="sh-cup" src="\$\{art\('prop_cup'\)\}"/);
  // 13. 附件：鑰匙從信封滑出的特寫用原圖（不改蜡封）
  assert.match(view, /<img class="envkey" src="\$\{art\('prop_v3b_envelope_key_v2'\)\}"/);
  assert.doesNotMatch(view, /art\('envelope'\)/);
  // 14. 點床：切到躺在床上的視角（燈一直亮），床板聲；最後一句（不點床）也是這張，但不擋翻頁
  assert.match(view, /class="op-bedpov"><div class="op-art"><img class="op-art-img" src="\$\{art\('scene_v3b_bed_pov_night'\)\}"/);
  assert.match(css, /\.op-room-act\.lying \.op-bedpov \{ opacity: 1; \}/);
  assert.doesNotMatch(css, /\.op-room-act\.lying \.op-room \{[^}]*rotate/, '不再用整張房間微傾當躺下');
  assert.ok(!L.room.some((b) => b.gate), '點床不是關卡');
  // 15. 進門／站著是店內定版圖 v2；點了椅子坐下（coffee）才切到靠窗特寫；窗外從傍晚暗到晚上（sh-sky 疊在各自那張的窗玻璃上）
  assert.equal(srcOf(SHOP_STILL_NIGHT), 'scene_shop_interior_night_lit_v2');
  assert.equal(srcOf(SHOP_STILL_SEATED), 'scene_v3b_shop_window_night_seated');
  assert.equal(stillOf({ night: 1 }, true), SHOP_STILL_SEATED);
  assert.equal(stillOf({ tone: 'morning' }, true), SHOP_STILL_SEATED);
  assert.deepEqual(layoutOf(true), { window: SHOP_WINDOW, cup: SHOP_CUP }, '坐下特寫仍用原來的窗與杯子位置');
  assert.deepEqual(layoutOf(false), { window: SHOP_WINDOW_STAND, cup: SHOP_CUP_STAND });
  //    坐下喝咖啡：杯子預設在桌上（句子沒寫 cup: true 也看得到，點杯子的熱點才量得到）；明寫 cup: false 才藏。站著照句子。
  assert.equal(cupShown({}, true), true);
  assert.equal(cupShown({ cup: false }, true), false);
  assert.equal(cupShown({}, false), false);
  assert.equal(cupShown({ cup: true }, false), true);
  assert.match(shop, /cup\.hidden = !cupShown\(look, seated\);/);
  for (const b of L.coffee) if (b.optional === 'cup') assert.ok(cupShown(at('coffee', L.coffee.indexOf(b)), true), '點杯子那句杯子看得到');
  assert.match(shop, /const seated = !!opts\.seated;/);
  assert.match(shop, /const id = stillOf\(look, seated\);\s*const ref = srcOf\(id\);/);
  assert.deepEqual(skyOf({ night: 1 }), { kind: 'dusk', alpha: 0 }, '晚上：原圖的夜色，不再疊壓暗濾鏡');
  // 傍晚還沒入夜用傍晚正式圖（窗外傍晚已畫好）：不再疊天色濾鏡（承峰 2026-11-22 19:16）
  assert.deepEqual(skyOf({ tone: 'dusk', night: 0 }), { kind: 'dusk', alpha: 0 });
  assert.deepEqual(skyOf({ tone: 'dusk' }), { kind: 'dusk', alpha: 0 }, '傍晚用傍晚圖，不疊天色');
  assert.deepEqual(skyOf({ tone: 'dusk', night: 1 }), { kind: 'dusk', alpha: 0 });
  // 早上用白天正式圖（光線與窗外白天已畫好）：不再疊天色濾鏡
  assert.deepEqual(skyOf({ tone: 'morning' }), { kind: 'morning', alpha: 0 }, '早上不疊天色');
  assert.equal(stillOf({ tone: 'morning' }), SHOP_STILL_DAY);
  assert.equal(stillOf({ tone: 'dusk' }), SHOP_STILL_DUSK, '傍晚還沒入夜用傍晚圖');
  assert.equal(stillOf({ tone: 'dusk', night: 0 }), SHOP_STILL_DUSK);
  assert.equal(stillOf({ tone: 'dusk', night: 1 }), SHOP_STILL_NIGHT, '入夜用夜景定版');
  assert.equal(stillOf({ night: 1 }), SHOP_STILL_NIGHT);
  assert.equal(stillOf({ tone: 'dusk' }, true), SHOP_STILL_SEATED);
  // 坤伯答謝：開頭傍晚圖、窗上不疊；「外面天色慢慢暗下來」起夜景定版、不疊；研發咖啡開頭是夜景
  {
    const T = D.DAY_LINES.d5thanks;
    const dark = T.findIndex((b) => b.text === '外面天色慢慢暗下來。店裡很安靜，只有剝殼的聲音。');
    assert.ok(dark > 0);
    assert.equal(OP.sceneAt(T, 0).tone, 'dusk');
    for (let i = 0; i < T.length; i++) {
      const lk = OP.sceneAt(T, i);
      assert.equal(stillOf(lk), i < dark ? SHOP_STILL_DUSK : SHOP_STILL_NIGHT, `d5thanks 第 ${i} 句`);
      assert.equal(skyOf(lk).alpha, 0, `d5thanks 第 ${i} 句窗上不疊天色`);
    }
    assert.equal(OP.sceneAt(T, dark).night, 1, '天暗那句入夜（與 d5brew 開頭一致）');
    assert.equal(stillOf(OP.sceneAt(D.DAY_LINES.d5brew, 0)), SHOP_STILL_NIGHT, '研發咖啡仍用夜景定版');
    // 交叉淡化只在同一幕傍晚 → 夜景；進幕／跳關（還沒 beat：null）直接到這句的圖，不從初始夜圖淡過去
    assert.equal(fadesBetween(SHOP_STILL_DUSK, SHOP_STILL_NIGHT), true);
    assert.equal(fadesBetween(null, SHOP_STILL_DUSK), false);
    assert.equal(fadesBetween(null, SHOP_STILL_NIGHT), false);
    assert.equal(fadesBetween(SHOP_STILL_NIGHT, SHOP_STILL_DUSK), false);
    assert.equal(fadesBetween(SHOP_STILL_DAY, SHOP_STILL_NIGHT), false);
    assert.ok(BG_FADE_MS >= 1000 && BG_FADE_MS <= 1200);
    assert.match(shop, /if \(fadesBetween\(shown, id\)\) crossFade\(/);
    assert.match(read('index.html'), /\.sh-bg-old \{[^}]*transition: opacity 1\.2s/);
  }
  assert.match(main, /showShop\(\$\('opening'\), act, \{ seated: act === 'coffee' \}\)/);
  // 劇本 v5.7：坐下後窗外已經是黑的（夜裡到東山）；店裡站著那一段窗外也是夜色
  for (let i = 0; i < L.coffee.length; i++) assert.equal(at('coffee', i).night, 1, `coffee 第 ${i} 句窗外是黑的`);
  assert.equal(at('deshu', 0).night, 1);
  // 點椅子：2D 定景上那張看得到的椅子（不再是環景）
  assert.match(main, /if \(act === 'sit'\) \{[\s\S]*?shop\.beat\(\{ deshu: 'stand', cat: 'feet', cup: true, night: 1 \}\);/);
  // 不再疊壓暗的夜色濾鏡（承峰 v5.8 回報第 2 項「這裡怎麼沒開燈」）
  assert.doesNotMatch(main + shop, /rgba\(\$\{Math\.round\(120 - 70 \* night\)\}/);
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

test('點貓的手（_v2）從上方伸進來、指尖落在頭頂（2D：CSS 疊在貓框裡）；踩奶（knead_v2）沒有凳子、有小小的上下 bob', () => {
  const css = read('index.html');
  // 手（800×600）與貓圖（512×384）同比例：指尖 (332,147) 對準頂頭圖的頭頂 (205,58)
  const m = css.match(/\.sh-hand \{ position: absolute; left: (-?[\d.]+)%; top: (-?[\d.]+)%; width: ([\d.]+)%;/);
  assert.ok(m, '找不到 .sh-hand 位置');
  const [left, top, width] = m.slice(1).map(Number);
  assert.ok(Math.abs(left - ((205 - 332) / 512) * 100) < 0.1, `left ${left}`);
  assert.ok(Math.abs(top - ((58 - 147) / 384) * 100) < 0.1, `top ${top}`);
  assert.ok(Math.abs(width - (800 / 512) * 100) < 0.01, `width ${width}`);
  assert.match(css, /\.sh-hand \{[^}]*mask-image: linear-gradient\(transparent, #000 8%\)/, '袖口淡掉');
  assert.match(css, /@keyframes pethand \{ 0% \{ opacity: 0; transform: translateY\(-32%\); \}/, '從上方進出');
  assert.equal(PET_MS, 2800);
  assert.match(css, /\.sh-hand\.go \{ animation: pethand 2\.8s/);
  // 踩奶：無凳；腳底 y349 踩在椅面（sleep 的底線 y339）；小小上下 bob
  assert.equal(KNEAD_ON_SLEEP_LINE, -(349 - 339) / 384);
  assert.deepEqual(CAT_2D.chair.seq[0], { img: 'cat_longan_knead_v2', ms: 2200, dy: KNEAD_ON_SLEEP_LINE, bob: true });
  assert.equal(CAT_2D.across.seq[0].bob, true, '坐下後對面的椅子也有 bob');
  assert.match(css, /@keyframes catbob \{ from \{ translate: 0 0; \} to \{ translate: 0 -1\.8%; \} \}/);
  assert.doesNotMatch(read('src/view/shop-still.js'), /圓凳/);
});

test('店內 2D 定景：定版圖 v2 上的椅子（點椅子坐下的目標）、吧台、窗、杯子、德叔、龍眼都在圖內；坐下時德叔說話站右手邊', () => {
  assert.equal(ART_MAP[SHOP_STILL_NIGHT].status, 'ready');
  assert.equal(ART_MAP[SHOP_STILL_SEATED].status, 'ready');
  assert.equal(ART_MAP[SHOP_STILL_DAY].status, 'ready', '早上用白天正式圖（承峰 2026-11-22 17:20）');
  assert.ok(!('temp' in ART_MAP[SHOP_STILL_DAY]), '白天圖不再寫暫代');
  for (const r of [SHOP_CHAIR, SHOP_WINDOW, SHOP_WINDOW_STAND, SHOP_BAR]) {
    assert.ok(r.left >= 0 && r.top >= 0 && r.left + r.width <= 100 + 1e-9 && r.top + r.height <= 100, JSON.stringify(r));
  }
  // 椅子：對準 v2 左側靠窗那張桌的椅子（承峰 17:15「坐下那一幕移到靠窗那張」；約 x 199–491、y 1089–1620；椅座約 y 1310–1430 在熱區裡）
  assert.deepEqual(SHOP_CHAIR, { left: 17, top: 43, width: 25, height: 21 });
  assert.ok(SHOP_CHAIR.top <= (1310 / 2532) * 100 && SHOP_CHAIR.top + SHOP_CHAIR.height >= (1430 / 2532) * 100, '椅座（y）在熱區裡');
  assert.ok(SHOP_CHAIR.left <= (199 / 1170) * 100 + 0.5 && SHOP_CHAIR.left + SHOP_CHAIR.width >= (491 / 1170) * 100 - 0.5, '椅子（x）在熱區裡');
  assert.ok(SHOP_CHAIR.left + SHOP_CHAIR.width < SHOP_BAR.left + 10 && SHOP_CHAIR.left < 35, '是左側靠窗那張，不是右側桌');
  assert.match(read('src/view/shop-still.js'), /點椅子坐下的目標：對準 v2 左側靠窗那張桌的椅子/);
  assert.doesNotMatch(read('src/view/shop-still.js'), /最靠近鏡頭、右側桌前/);
  // 杯子（站著看）：靠窗桌面上、白色馬克杯盆栽（右緣約 x 11%）的右手邊，不重疊；杯底中心約 (257, 1258)，杯高 3.6
  assert.deepEqual(SHOP_CUP_STAND, { x: 22.0, y: 49.7, h: 3.6 });
  assert.ok(Math.abs(SHOP_CUP_STAND.x - (257 / 1170) * 100) < 0.5 && Math.abs(SHOP_CUP_STAND.y - (1258 / 2532) * 100) < 0.5);
  {
    // prop_cup 600×420、杯高 h（佔原圖高）：杯寬（佔原圖寬）＝h × 2532/1170 × 600/420；translateX(-50%) → 左緣 x − 寬/2
    const w = SHOP_CUP_STAND.h * (2532 / 1170) * (600 / 420);
    assert.ok(SHOP_CUP_STAND.x - w / 2 > 11 + 1, `杯子左緣 ${(SHOP_CUP_STAND.x - w / 2).toFixed(1)}% 離盆栽（右緣約 11%）有空隙`);
    assert.ok(SHOP_CUP_STAND.x + w / 2 < (491 / 1170) * 100, '杯子在靠窗桌上');
  }
  assert.deepEqual(webpSize(readFileSync(root('assets/art/scene_shop_interior_night_lit_v2.webp'))), [1170, 2532], '定版圖原尺寸');
  assert.equal(srcOf(SHOP_STILL_DAY), 'art-v59/scene_shop_interior_day_v1');
  assert.deepEqual(webpSize(readFileSync(root('assets/art-v59/scene_shop_interior_day_v1.webp'))), [1170, 2532], '白天店內圖原尺寸');
  assert.equal(srcOf(SHOP_STILL_DUSK), 'art-v59/scene_shop_interior_dusk_v1');
  assert.deepEqual(webpSize(readFileSync(root('assets/art-v59/scene_shop_interior_dusk_v1.webp'))), [1170, 2532], '傍晚店內圖原尺寸');
  assert.ok(SHOP_ART.includes('scene_shop_interior_night_lit_v2') && SHOP_ART.includes('scene_v3b_shop_window_night_seated') && SHOP_ART.includes('art-v59/scene_shop_interior_day_v1')
    && SHOP_ART.includes('art-v59/scene_shop_interior_dusk_v1'), '四張店內圖都開機預載');
  // 吧台檯面（一排杯子與磨豆機，約 y 880–1015）；德叔站在吧台後面，檯面以下被擋住
  assert.ok(Math.abs(SHOP_BAR.top - (880 / 2532) * 100) < 1 && Math.abs(SHOP_BAR.top + SHOP_BAR.height - (1015 / 2532) * 100) < 1);
  for (const k of ['stand', 'brew']) {
    assert.ok(DESHU_2D[k].x > SHOP_BAR.left && DESHU_2D[k].x < SHOP_BAR.left + SHOP_BAR.width, `德叔 ${k} 在吧台那一側`);
    assert.ok(DESHU_2D[k].clip > SHOP_BAR.top && DESHU_2D[k].clip < SHOP_BAR.top + SHOP_BAR.height, `德叔 ${k} 吧台檯面以下切掉`);
  }
  // 第二天把鑰匙放到吧台：放置目標框在吧台檯面上
  assert.match(code('src/main.js'), /props\.tapItem\('keyBar', \{ target: shop\.hot\('bar'\) \}\)/);
  assert.match(code('src/view/shop-still.js'), /if \(name === 'bar'\) return el\.querySelector\('#sh-bar'\);/);
  // v2 的窗在左側
  assert.ok(SHOP_WINDOW_STAND.left + SHOP_WINDOW_STAND.width < 35, 'v2 左側那扇窗');
  assert.ok(SHOP_CUP.y <= 78 && SHOP_CUP_STAND.y <= 78, '杯子在閱讀框上方');
  for (const [k, c] of Object.entries(CAT_2D)) assert.ok(c.y <= 78 && c.x - c.w / 2 >= 0 && c.x + c.w / 2 <= 100, `貓 ${k}`);
  for (const [k, d] of Object.entries(DESHU_2D)) assert.ok(d.y - d.h >= 0 && d.y <= 78, `德叔 ${k}`);
  const main = code('src/main.js');
  assert.match(main, /reader\.portrait\([^\n]*, act === 'coffee' \? 'aside' : 'center'\);/);
  assert.match(PORTRAIT_PLACE.aside, /left:\s*7\d%/);
  assert.equal(PORTRAIT_PLACE.center, 'height:130%;top:7%', '其他幕的立繪照舊');
  // 沒有 canvas、沒有動畫迴圈
  const shop = code('src/view/shop-still.js');
  assert.doesNotMatch(shop, /requestAnimationFrame|getContext|<canvas/);
});

test('不改既有的 assets/art 原圖（git 有追蹤的檔沒有被改動或刪除）', (t) => {
  let out;
  try { out = execFileSync('git', ['status', '--porcelain', '--', 'assets/art'], { cwd: root('.'), encoding: 'utf8' }); } catch { t.skip('沒有 git'); return; }
  const changed = out.split('\n').filter((l) => l && !l.startsWith('??'));
  assert.deepEqual(changed, [], `既有原圖被改動：${changed.join(', ')}`);
});

/* ---------- v3.9 留宿對白 ---------- */
// （吧台磨豆機比例、杯子跟著靠窗木桌、坐下窗景 seatFit：都是店內環景的版面，環景拔掉後一起拿掉）

test('劇本 v5.7 留宿：德叔先說導航不準、老老闆交代留房間、他也住在三合院（門閂）；我不再自己開口借住；德叔不說「早上再過來」', () => {
  assert.deepEqual(L.stay.map((b) => [b.who, b.text]), [
    [undefined, '德叔還在，拿著掃把。我剛才坐的那張椅子還沒收。'],
    ['me', '我繞了半個多小時，找不到回去的路。'],
    ['deshu', '這邊比較偏僻，導航可能會不太準。'],
    ['deshu', '老老闆交代過，要留一個房間讓妳睡。'],
    ['me', '留給我？'],
    ['deshu', '右邊護龍第一間整理好了，棉被下午曬過。'],
    ['me', '我什麼都沒帶。'],
    ['deshu', '櫃子裡有毛巾。'],
    ['deshu', '我也住在這間三合院，晚上有什麼事，妳喊一聲我就聽得到。門平常沒在鎖，妳要鎖的話，裡面有門閂。'],
  ]);
  assert.deepEqual(L.stay[2].set, { portrait: true, deshu: null }, '立繪在「導航」那句出來');
  assert.equal(L.stay[3].set, undefined);
  assert.equal(L.stay[4].set, undefined);
  const all = allLines().map((b) => b.text).join('\n');
  assert.ok(!all.includes('晚上是這樣。'));
  assert.ok(!all.includes('我今天可以住這裡嗎？一晚就好。'));
  assert.ok(!MARKS.test(L.stay.map((b) => b.text).join('')));
});
