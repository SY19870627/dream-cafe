// 階段 7 的純邏輯：保底雨天（src/weather.js）、聲音設定的存檔預設值、src/audio.js 在沒有 WebAudio 時不出錯、
// 文字校對（玩家看得到的字裡沒有「不划算」「KPI」這類上班的詞、中文裡沒有半形的 ...）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rainFloorDue, RAIN_FLOOR_DAY, RAIN_FLOOR_GAP, RAIN_HINT } from '../../src/weather.js';
import { defaultSave, migrate, giveStarters } from '../../src/save.js';
import { writeJournal } from '../../src/journal.js';
import { createAudio, VOLUMES, VOLUME_NAMES } from '../../src/audio.js';

const T0 = new Date(2026, 10, 1, 21, 30).getTime();
const DAY = 864e5;

test('保底雨天：任務還沒完成、第 12 天起、距離上一次滿 5 天才下', () => {
  assert.equal(rainFloorDue({ day: RAIN_FLOOR_DAY - 1, done: false }), false, '第 11 天還不保底');
  assert.equal(rainFloorDue({ day: RAIN_FLOOR_DAY, done: false }), true, '第 12 天保底');
  assert.equal(rainFloorDue({ day: 20, done: true }), false, '在雨天坐過窗邊就不再保底');
  assert.equal(rainFloorDue({ day: 14, done: false, last: 12 }), false, '上一次保底才過 2 天');
  assert.equal(rainFloorDue({ day: 12 + RAIN_FLOOR_GAP, done: false, last: 12 }), true, '滿 5 天再保底一次');
  assert.ok(RAIN_HINT.includes('窗邊') && !RAIN_HINT.includes('任務'), '德叔提一句窗邊，不提任務');
});

test('保底雨天那一天，德叔的日誌也寫下雨', () => {
  const s = defaultSave(T0);
  giveStarters(s);
  s.flags.seenOpening = true;
  // 第 2～4 天的日誌：把第 3 天記成保底雨天
  s.story.rainFloorDay = 3;
  const page = writeJournal(s, T0, T0 + 3 * DAY);
  const d3 = page.days.find((d) => d.day === 3);
  assert.ok(d3 && d3.rain, '第 3 天記成下雨');
});

test('聲音設定：新存檔音樂與店裡的聲音預設開、音量小；舊存檔補上預設值', () => {
  const s = defaultSave(T0);
  assert.equal(s.settings.music, true);
  assert.equal(s.settings.sound, true);
  assert.equal(s.settings.volume, 0);
  assert.equal(VOLUME_NAMES[s.settings.volume], '小');
  assert.ok(VOLUMES[0] < VOLUMES[1] && VOLUMES[1] < VOLUMES[2] && VOLUMES[2] <= 1, '小 < 中 < 大，最大不超過 1');
  const old = { version: 5, createdAt: T0, settings: { offWork: '18:00', sound: false } };
  const m = migrate(old, T0);
  assert.equal(m.settings.sound, false, '關掉過的風雨聲保持關掉');
  assert.equal(m.settings.music, true, '舊存檔補上音樂開');
  assert.equal(m.settings.volume, 0, '舊存檔補上音量小');
  assert.equal(m.story.rainFloorDay, 0, '舊存檔補上保底雨天');
});

test('聲音：沒有 WebAudio 的環境，所有動作都是空動作、不丟錯', () => {
  const a = createAudio({ AudioContextClass: undefined });
  a.unlock();
  a.set({ music: true, sfx: true, weather: 'typhoon', inShop: true });
  a.play('bell');
  a.start('grind');
  a.stop('grind');
  a.duck();
  a.pause();
  a.resume();
  assert.equal(a.state.ctx, 'none');
  assert.equal(a.state.started, false);
  assert.equal(a.peak(), 0);
});

// 文字校對：把原始碼裡含中文的字串（不含註解）挑出來檢查
const SRC = ['afterhours', 'cat', 'catalog', 'farewell', 'journal', 'letters', 'main', 'menu', 'moments', 'opening', 'story', 'tasks', 'tasting', 'weather']
  .map((f) => new URL(`../../src/${f}.js`, import.meta.url));
function strings(file) {
  const src = readFileSync(file, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
  const out = [];
  const re = /(['`"])((?:\\.|(?!\1)[^\\\n])*?)\1/g; // 只看同一行裡的字串
  let m;
  while ((m = re.exec(src))) if (/[一-鿿]/.test(m[2])) out.push(m[2]);
  return out;
}
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<!--[\s\S]*?-->/g, '');
const ALL = [...SRC.flatMap(strings), html];

test('文字校對：玩家看得到的字裡沒有上班、催促、不划算的詞', () => {
  // 劇本原文裡「不在考核之列」「不用把菜單改得划算」「翻桌率不重要」是否定的說法，可以
  const BANNED = ['KPI', '不划算', '划不來', '餘額不足', '業績', '簽到', '體力', '限時活動', '每日任務', '效率', '打卡', '加班', '趕快'];
  for (const w of BANNED) {
    const hit = ALL.filter((t) => t.includes(w));
    assert.deepEqual(hit.map((t) => t.slice(0, 40)), [], `不應出現「${w}」`);
  }
});

test('文字校對：中文句子用全形標點（……、，、？），德叔叫玩家「老闆」', () => {
  const hits = ALL.filter((t) => t !== html).filter((t) => /\.\.\./.test(t) || /[一-鿿][,?!;](?=\s|$|[一-鿿])/.test(t));
  assert.deepEqual(hits.map((t) => t.slice(0, 40)), []);
  // 單一個「…」也要寫成「……」
  const single = ALL.filter((t) => t !== html).filter((t) => /…/.test(t.replace(/……/g, '')));
  assert.deepEqual(single.map((t) => t.slice(0, 40)), []);
  // 德叔不會用「店長」「老大」「你這個」稱呼玩家
  const story = readFileSync(new URL('../../src/story.js', import.meta.url), 'utf8') + readFileSync(new URL('../../src/farewell.js', import.meta.url), 'utf8');
  const deshu = [...story.matchAll(/say\('deshu', '([^']*)'/g)].map((m) => m[1]);
  assert.ok(deshu.length > 15, '找得到德叔的台詞');
  assert.deepEqual(deshu.filter((l) => /老大|你這個|喂/.test(l)), []);
});
