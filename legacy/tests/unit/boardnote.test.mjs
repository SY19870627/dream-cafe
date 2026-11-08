// 黑板上的便條（承峰 11/7：「便條紙直接貼上黑板好了」）：tasting.js 的 BOARD_NOTE 與存檔旗標、main.js／index.html 的接法
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as TS from '../../src/tasting.js';
import { defaultSave, giveStarters, migrate, SAVE_VERSION } from '../../src/save.js';

const T0 = new Date(2026, 10, 7, 21, 30).getTime();
const newSave = () => { const s = defaultSave(T0); giveStarters(s); s.flags.seenOpening = true; return s; };
const src = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const main = src('main.js');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('便條的字：德叔的口吻，說試咖啡先坐吧台座（研磨、粉水比、水溫、技法）與烘豆等打烊喝完最後一杯點烘豆機', () => {
  const N = TS.BOARD_NOTE;
  const body = N.lines.join('');
  assert.match(body, /吧台座/);
  for (const w of ['研磨', '粉水比', '水溫', '技法']) assert.ok(body.includes(w), `便條要提到${w}`);
  assert.match(body, /打烊/);
  assert.match(body, /最後一杯/);
  assert.match(body, /烘豆機/);
  assert.match(body, /門口右手邊角落那台大的/);
  assert.doesNotMatch(body, /後牆/, '烘豆機已搬到店門口右手邊那一角');
  assert.equal(N.lines[0], '老闆：', '德叔叫玩家「老闆」');
  assert.ok(N.lines.some((l) => /配方/.test(l) && /故事/.test(l)), '便條說新的配方跟著故事開放（不提前解鎖）');
  assert.match(N.barHint, /便條/);
  assert.match(N.closeHint, /便條/);
  assert.match(N.closeHint, /烘豆/);
  assert.match(N.needBar, /吧台/);
  for (const t of [N.title, N.sub, ...N.lines, N.sign, N.close, N.barHint, N.closeHint, N.needBar]) {
    assert.equal(typeof t, 'string');
    assert.ok(t.length > 0);
    assert.doesNotMatch(t, /KPI|不划算|任務|分數|評分|失敗|趕快|快點|今天還沒|\.\.\./, t);
  }
  // 試咖啡的文字清單（文字校對用）包含便條
  const all = TS.allTastingLines();
  for (const l of N.lines) assert.ok(all.includes(l));
});

test('便條的新字全部標【待定】', () => {
  const lines = src('tasting.js').split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('export const BOARD_NOTE'));
  const end = lines.findIndex((l, i) => i > start && l.startsWith('};'));
  assert.ok(start > 0 && end > start);
  const withText = lines.slice(start + 1, end).filter((l) => /'[^']*[一-鿿][^']*'/.test(l));
  assert.equal(withText.length, 12);
  for (const l of withText) assert.ok(l.includes('// 【待定】'), l.trim());
});

test('提示各一次：第一次坐吧台座、第一次打烊；記在存檔 flags，不升存檔版本', () => {
  const s = newSave();
  assert.equal(TS.noteHintDue(s, 'bar'), true);
  assert.equal(TS.noteHintDue(s, 'close'), true);
  assert.equal(TS.noteHintDue(s, 'nope'), false);
  assert.deepEqual(Object.keys(TS.NOTE_FLAG).sort(), ['bar', 'close'], '只有兩次提示的旗標，沒有「讀過便條」');
  TS.markNote(s, 'bar');
  assert.equal(TS.noteHintDue(s, 'bar'), false);
  assert.equal(TS.noteHintDue(s, 'close'), true, '兩句各自記');
  TS.markNote(s, 'close');
  assert.equal(TS.noteHintDue(s, 'close'), false);
  assert.equal(s.flags.noteBarHint && s.flags.noteCloseHint, true);
  // 存檔讀回來還記得；存檔版本照舊
  const back = migrate(JSON.parse(JSON.stringify(s)), T0);
  assert.equal(back.version, SAVE_VERSION);
  assert.equal(TS.noteHintDue(back, 'bar'), false);
  assert.equal(TS.noteHintDue(back, 'close'), false);
  // 沒有 flags 的存檔也不丟錯
  const bare = { tasting: TS.blankTasting() };
  assert.equal(TS.noteHintDue(bare, 'bar'), true);
  TS.markNote(bare, 'bar');
  assert.equal(bare.flags.noteBarHint, true);
});

test('讀便條不解鎖：「一起試一杯」照原本的規則，配方照劇情開放或德叔引導過', () => {
  const s = newSave();
  assert.equal(TS.tastingOpen(s), false, '新存檔：還沒有入口');
  TS.markNote(s, 'read');
  TS.markNote(s, 'bar');
  TS.markNote(s, 'close');
  assert.equal(TS.tastingOpen(s), false, '讀過便條、提示過也不會提前開');
  assert.equal(s.flags.noteRead, undefined);
  const g = newSave();
  TS.markGuided(g);
  assert.equal(TS.tastingOpen(g), true);
  const r = newSave();
  r.regulars.yuan.milestones.push(1, 2, 3);
  assert.equal(TS.tastingOpen(r), true, '龍眼窯配方開放');
  // 和原本 trialAgainable 的條件一樣（guided、againRecipes、openRecipes）
  for (const x of [s, g, r]) assert.equal(TS.tastingOpen(x), !!x.tasting?.guided || TS.againRecipes(x).length > 0 || TS.openRecipes(x).length > 0);
});

test('main.js：打開便條只是讀，不寫解鎖旗標；兩次提示在開發者模式也走同樣的條件', () => {
  const fn = main.slice(main.indexOf('function openNote(open)'), main.indexOf("$('note-close').onclick"));
  assert.doesNotMatch(fn, /markNote|persist\(\)/, '打開便條不記任何東西');
  assert.doesNotMatch(main, /noteRead/);
  assert.doesNotMatch(main, /NOTE_HINT_ON|notehint/, '開發者模式不另外關掉提示');
  assert.match(main, /const trialAgainable = \(\) => trialOfferable\(\) && !moments\.busy && TS\.tastingOpen\(save\)/);
});

test('main.js：便條是程式畫的紙片貼在黑板上，點它打開可重讀的面板；不做箭頭、發光，不新增記事本頁面', () => {
  const art = src('art.js');
  assert.match(art, /export const NOTE = \{/);
  assert.match(art, /export function boardNote\(\)/);
  const fn = art.slice(art.indexOf('export function boardNote()'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.doesNotMatch(body, /fillText|strokeText/, '圖上不寫字');
  assert.match(main, /A\.boardNote\(\)/);
  assert.match(main, /tapNote\(ray\) \|\| tapBoard\(ray\)/, '點便條比點黑板先判斷');
  assert.match(main, /function openNote\(open\)/);
  assert.match(main, /TS\.BOARD_NOTE\.needBar/);
  assert.match(main, /\$\('tune'\), \$\('note'\)\]\.some/, '便條面板算在 overlayOpen()');
  assert.match(html, /<div id="note" class="overlay" hidden role="dialog"/);
  assert.doesNotMatch(main, /noteArrow|noteGlow/);
  // 記事本沒有便條的頁面
  const nb = main.slice(main.indexOf('function openNotebook('), main.indexOf('function openNotebook(') + 4000);
  assert.doesNotMatch(nb, /BOARD_NOTE|openNote\(/);
});
