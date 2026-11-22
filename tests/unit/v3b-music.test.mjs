// 背景音樂（承峰 2026-11-22 22:21「現在把音樂接進遊戲」，白天曲用「夏空へ」）：曲目表、每一幕的音樂、幕內切點、聲音設定。 // 【待定】
// 只測純資料與純函式（story/music.js、story/audio-pref.js），不開瀏覽器、不出聲。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as S from '../../src/story/state.js';
import * as OP from '../../src/lines/opening.js';
import { load, persist, SAVE_KEY } from '../../src/story/save.js';
import { TRACKS, ACT_MUSIC, TITLE_CUES, LINE_CUES, cueLine, musicAt, unlistedActs } from '../../src/story/music.js';
import { AUDIO_KEY, loadAudioPref, saveAudioPref, defaultAudioPref } from '../../src/story/audio-pref.js';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const SRC = JSON.parse(read('src/story/final-source.json'));
const fakeStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
};

test('曲目表：四首都有作者、來源網址、授權說明、下載日期 2026-11-22', () => {
  assert.deepEqual(Object.keys(TRACKS).sort(), ['cafe', 'city', 'day', 'night']);
  const expect = { city: ['窓辺のドロップス', 'すもち'], day: ['夏空へ', 'ハヤシユウ'], cafe: ['Chill Out Lounge', 'のる'], night: ['Sweet Dreams', 'のる'] };
  for (const [k, t] of Object.entries(TRACKS)) {
    assert.deepEqual([t.title, t.author], expect[k], k);
    assert.match(t.url, /^https:\/\/dova-s\.jp\/bgm\/play\d+\.html$/, k);
    assert.ok(t.license && t.license.length > 10, `${k} 沒有授權說明`);
    assert.equal(t.downloaded, '2026-11-22', k);
    assert.equal(typeof t.loop, 'boolean');
  }
  assert.equal(TRACKS.city.loop, false, 'city 沒有官方循環版：自己交叉淡化');
  assert.equal(TRACKS.day.loop, false);
  assert.equal(TRACKS.cafe.loop, true);
  assert.equal(TRACKS.night.loop, true);
  // CREDITS.md 也列了同樣的四個來源
  const credits = read('assets/audio/CREDITS.md');
  for (const t of Object.values(TRACKS)) { assert.ok(credits.includes(t.url), t.url); assert.ok(credits.includes(t.title)); }
});

test('幕對照表涵蓋每一幕（開場、第一天起、待續）；曲目代號都查得到；無音樂的幕明確是 null', () => {
  assert.deepEqual(unlistedActs(), []);
  assert.deepEqual(Object.keys(ACT_MUSIC), S.OPENING_ACTS, '跟幕的順序一一對應，沒有多的');
  for (const a of S.OPENING_ACTS) {
    const v = ACT_MUSIC[a];
    assert.ok(v === null || (TRACKS[v.track] && v.level > 0 && v.level <= 1), `${a}：${JSON.stringify(v)}`);
  }
  for (const v of [...Object.values(TITLE_CUES), ...Object.values(LINE_CUES).flat().map((c) => c.music)]) assert.ok(TRACKS[v.track]);
  // 不放音樂的幕
  for (const a of ['office', 'road', 'depart', 'ride', 'fork', 'temple', 'return', 't1card', 'd1wake', 't0card', 'resend']) assert.equal(ACT_MUSIC[a], null, a);
  const at = (a) => ACT_MUSIC[a] && `${ACT_MUSIC[a].track}@${ACT_MUSIC[a].level}`;
  assert.deepEqual(['title', 't4card', 'mailbox', 'letter', 't2card', 'eve'].map(at), Array(6).fill('city@1'));
  assert.deepEqual(['deshu', 'sit', 'coffee'].map(at), Array(3).fill('cafe@1'));
  assert.equal(at('stay'), 'cafe@0.6');
  assert.equal(at('room'), 'night@1');
  assert.equal(at('d1shop'), 'day@1');
  assert.deepEqual(['d1town', 'd1home'].map(at), ['city@1', 'city@1']);
  assert.deepEqual(['d1bank', 'd1store'].map(at), ['city@0.5', 'city@0.5']);
  assert.deepEqual(['d2card', 'd2cafe', 'd5card', 'd5cafe', 'd5village'].map(at), Array(5).fill('day@1'));
  assert.equal(at('d5thanks'), 'day@0.7');
  assert.equal(at('d5brew'), 'cafe@1');
  assert.equal(at(S.END_ACT), 'night@0.5', '待續不靜音');
});

test('幕內切點：d1wake 章名才進 day、d1store 下決心那句升回 100%、d5thanks 入夜那句換 cafe（句子原文沒改）', () => {
  // d1wake：開場先靜，章名卡出現時才進 day；讀檔已過章名（line > 0）直接是 day
  assert.equal(musicAt('d1wake', 0), null);
  assert.deepEqual(musicAt('d1wake', 0, { titled: true }), { track: 'day', level: 1 });
  assert.deepEqual(musicAt('d1wake', 3), { track: 'day', level: 1 });
  assert.ok(S.ACT_LINES.d1wake[0].text === '我是被雞叫醒的。');
  // d2cafe 也有章名卡，但音樂已經在播：不重切
  assert.equal(TITLE_CUES.d2cafe, undefined);
  assert.deepEqual(musicAt('d2cafe', 0, { titled: true }), { track: 'day', level: 1 });

  const k = cueLine('d1store', '不然……先試試看好了。');
  assert.ok(k > 0, 'd1store 找不到「不然……先試試看好了。」');
  assert.equal(S.ACT_LINES.d1store[k].who, 'me');
  assert.deepEqual(musicAt('d1store', 0), { track: 'city', level: 0.5 }, '黑底走路旁白也是 city 50%');
  assert.deepEqual(musicAt('d1store', k - 1), { track: 'city', level: 0.5 });
  assert.deepEqual(musicAt('d1store', k), { track: 'city', level: 1 });
  assert.equal(S.ACT_LINES.d1store[k + 1].text, '先當實習的老闆試試看，不適合再說。');
  assert.deepEqual(musicAt('d1store', k + 1), { track: 'city', level: 1 });

  const n = cueLine('d5thanks', '外面天色慢慢暗下來。店裡很安靜，只有剝殼的聲音。');
  assert.ok(n > 0);
  assert.deepEqual(S.ACT_LINES.d5thanks[n].set, { night: 1 }, '同一句觸發畫面入夜');
  assert.deepEqual(musicAt('d5thanks', 0), { track: 'day', level: 0.7 }, '一進答謝不換 cafe');
  assert.deepEqual(musicAt('d5thanks', n - 1), { track: 'day', level: 0.7 });
  assert.deepEqual(musicAt('d5thanks', n), { track: 'cafe', level: 1 });
  assert.deepEqual(musicAt('d5thanks', S.ACT_LINES.d5thanks.length - 1), { track: 'cafe', level: 1 });
  // 切點只有這三處
  assert.deepEqual(Object.keys(TITLE_CUES), ['d1wake']);
  assert.deepEqual(Object.keys(LINE_CUES).sort(), ['d1store', 'd5thanks']);
  for (const [a, cs] of Object.entries(LINE_CUES)) for (const c of cs) assert.ok(cueLine(a, c.text) >= 0, `${a} 找不到切點句：${c.text}`);
});

test('讀檔重播字卡：字卡的音樂就是下一幕開場那一刻的音樂', () => {
  for (const a of S.OPENING_ACTS) {
    if (!S.isCardAct(a)) continue;
    const next = S.nextActOf(a);
    assert.deepEqual(musicAt(a, 0), musicAt(next, 0), `${a} → ${next}`);
  }
});

test('聲音設定：獨立鍵 dream-cafe.audio；讀寫、壞資料回預設；不寫進存檔', () => {
  assert.equal(AUDIO_KEY, 'dream-cafe.audio');
  assert.notEqual(AUDIO_KEY, SAVE_KEY);
  assert.deepEqual(defaultAudioPref(), { v: 1, muted: false });
  const st = fakeStorage();
  assert.deepEqual(loadAudioPref(st), { v: 1, muted: false }, '沒存過是預設');
  assert.equal(saveAudioPref({ muted: true }, st), true);
  assert.deepEqual(JSON.parse(st.map.get(AUDIO_KEY)), { v: 1, muted: true });
  assert.deepEqual(loadAudioPref(st), { v: 1, muted: true });
  saveAudioPref({ muted: false }, st);
  assert.deepEqual(loadAudioPref(st), { v: 1, muted: false });
  assert.deepEqual([...st.map.keys()], [AUDIO_KEY], '只寫自己的鍵');
  for (const bad of ['{', 'null', '1', '"x"', '[]', '{"v":2,"muted":true}', '{"v":1,"muted":"yes"}', '{"muted":true}']) {
    assert.deepEqual(loadAudioPref(fakeStorage({ [AUDIO_KEY]: bad })), { v: 1, muted: false }, bad);
  }
  assert.deepEqual(loadAudioPref(null), { v: 1, muted: false });
  assert.equal(saveAudioPref({ muted: true }, null), false);
  const throws = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.deepEqual(loadAudioPref(throws), { v: 1, muted: false });
  assert.equal(saveAudioPref({ muted: true }, throws), false);
  // 存檔物件不多欄位；存檔鍵與聲音鍵互不干擾
  const s2 = fakeStorage();
  const state = S.newStoryState();
  const keys = Object.keys(JSON.parse(JSON.stringify(state))).sort();
  persist(state, s2);
  saveAudioPref({ muted: true }, s2);
  assert.deepEqual(Object.keys(JSON.parse(s2.map.get(SAVE_KEY))).sort(), keys);
  assert.ok(!('muted' in JSON.parse(s2.map.get(SAVE_KEY))));
  assert.equal(load(SRC, s2).opening.act, 'office', '存檔照常讀回');
  assert.deepEqual(loadAudioPref(s2), { v: 1, muted: true });
});

test('靜音鍵與音樂接線：右上角 44px、在 #log 與 #fade 之間；main.js 掛在換幕與換句的既有入口；路徑只在曲目表', () => {
  const html = read('index.html');
  assert.match(html, /<button type="button" id="mute" aria-pressed="true" aria-label="聲音">/);
  const css = html.match(/#mute \{([^}]*)\}/)[1];
  assert.match(css, /width: 44px; height: 44px/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /z-index: 26/);
  assert.doesNotMatch(html, /<a [^>]*download|<audio|assets\/audio/, '畫面上沒有音檔連結或 <audio>');
  const main = read('src/main.js');
  for (const ev of ['pointerdown', 'keydown', 'pointerup', 'touchend', 'click']) assert.ok(main.includes(`'${ev}'`), ev);
  assert.match(main, /visibilitychange/);
  assert.match(main, /music\(act, state\.opening\.line\)/, '進幕');
  assert.match(main, /music\(act, i, \{ titled: true \}\)/, '換句');
  assert.match(main, /music\(card, 0\)/, '讀檔重播字卡');
  assert.match(main, /saveAudioPref\(/);
  assert.doesNotMatch(main, /assets\/audio/);
  const audio = read('src/view/audio.js');
  assert.match(audio, /export function setMusic\(/);
  assert.match(audio, /export function setMuted\(/);
  assert.match(audio, /'interrupted'/);
  assert.match(audio, /out: 1\.5, in: 2, first: 2\.5, level: 1, mute: 0\.15/);
  assert.match(audio, /master\.gain\.value = muted \? 0 : MASTER/);
  assert.match(audio, /const MASTER = 0\.6;/);
  assert.match(audio, /const MUSIC_BUS = 0\.4;/);
});

test('標題署名：同一塊 .op-credit 裡分行列製作人員與四首曲子（作者一首一行），保留三個連結；沒有【待定】', () => {
  const MARKS = /【(待定|待確認|新增互動)】/;
  const all = [...OP.TITLE.staff, OP.TITLE.music.label, ...OP.TITLE.music.lines, OP.TITLE.music.source, OP.TITLE.music.note];
  for (const t of all) assert.ok(!MARKS.test(t), t);
  assert.deepEqual(OP.TITLE.music.lines, Object.values(TRACKS).map((t) => `${t.title} — ${t.author}`));
  assert.equal(OP.TITLE.links.length, 3);
  assert.ok(!OP.TITLE.music.lines.some((l) => /すもち、のる|のる、/.test(l)));
  const view = read('src/view/opening.js');
  assert.match(view, /class="op-credit"/);
  assert.match(view, /TITLE\.music\.lines/);
  // 【待定】承峰 11/22 22:52：第一行只有「製作：SY」，三個連結（順序不變）在下一行；音檔提醒小字仍在最下面
  assert.equal(OP.TITLE.credit, '製作：SY'); // 【待定】
  assert.deepEqual(OP.TITLE.links.map((l) => l.text), ['GitHub', 'Threads', '方格子']); // 【待定】
  assert.match(view, /<div class="op-credit-row">\$\{esc\(TITLE\.credit\)\}<\/div>\s*<div class="op-credit-row">\$\{TITLE\.links\.map\(/); // 【待定】
  assert.doesNotMatch(view, /TITLE\.credit\}・/); // 【待定】
  assert.equal(OP.TITLE.music.note, '請勿將遊戲內音檔另行下載或改作他用'); // 【待定】
  assert.match(view, /<p class="op-credit-note">\$\{esc\(TITLE\.music\.note\)\}<\/p><\/div>\s*<\/div>`/); // 【待定】
});
