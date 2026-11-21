// v3b 第一天～研發咖啡（劇本 v5.6，docs/劇本.md；承峰 2026-11-21 定稿）：第一晚 A 版自白（開場）、正文逐字對稿、章名與字卡、
// 新說話人名牌、德叔挽留 A 案、字出來之前要先做的互動（小圖點一下、錢包、抽屜、提款機、海報、鑰匙、花斑貓、空罐子、停一拍）、
// 可選互動、不再睡護龍、舊存檔相容（v4.5 的幕名接到新位置）、素材對照表（art-map.js）。
// 只測純邏輯與靜態檔案，不開瀏覽器；閱讀框（view/reader.js）用最小的假 DOM 測點擊與按鍵。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as OP from '../../src/lines/opening.js';
import * as D from '../../src/lines/days.js';
import * as S from '../../src/story/state.js';
import { load, persist, SAVE_KEY, OTHER_KEYS } from '../../src/story/save.js';
import { PLACES, DAY_ART, YIJUN_CARD, yijunCardFor, placesOf, HOT_IDS, MINI_SLOTS, miniHtml, cueOf, LINE_CUES, CHAR_SLOTS } from '../../src/view/days.js';
import { ART_MAP, OVERLAY_TEXT, ART_MAP_FILES, artUrl, refOf, srcOf } from '../../src/view/art-map.js';
import { nameOf } from '../../src/view/reader.js';
import { step, walk } from './walk.mjs';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const code = (p) => read(p).replace(/\/\/.*$/gm, '');
const SRC = JSON.parse(read('src/story/final-source.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const reload = (s) => S.normalize(clone(s), SRC);
const MARKS = /【(待定|待確認|新增互動)】|【小圖/;
// 讀 WebP 檔頭的寬高（VP8／VP8L／VP8X）
const webpSize = (buf) => {
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  throw new Error(`不認得的 WebP：${kind}`);
};
const fakeStorage = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const at = (act, line = 0, extra = {}) => ({ v: 1, phase: 'opening', opening: { act, line, ...extra } });
const dayLines = () => D.DAY_ACTS.flatMap((a) => D.DAY_LINES[a]);
const find = (t) => { for (const a of D.DAY_ACTS) { const i = D.DAY_LINES[a].findIndex((b) => b.text === t); if (i >= 0) return { act: a, i, b: D.DAY_LINES[a][i] }; } return null; };
const SCRIPT = read('docs/劇本.md').replace(/\r\n/g, '\n');
const BODY = SCRIPT.slice(SCRIPT.indexOf('# 第一天　最底下那個抽屜'));

/* ---------- 第一晚（開場）：不動 ---------- */
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

/* ---------- 字 ---------- */
test('劇本 v5.6 正文逐字：第一天起每一句對白／旁白照順序與 docs/劇本.md 相同（舞台指示、小圖、字卡、標題不是字）', () => {
  const names = Object.keys(D.SCRIPT_SPEAKERS).sort((a, b) => b.length - a.length);
  const re = new RegExp(`^(${names.join('|')})：「(.*)」$`);
  const spoken = [];
  for (const raw of BODY.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('---') || line.startsWith('（') || line.startsWith('【') || line.startsWith('>')) continue;
    const m = line.match(re);
    spoken.push(m ? { who: D.SCRIPT_SPEAKERS[m[1]], text: m[2] } : { who: undefined, text: line });
  }
  const mine = dayLines().map((b) => ({ who: b.who, text: b.text }));
  assert.equal(mine.length, spoken.length, '句數');
  assert.deepEqual(mine, spoken);
  assert.equal(mine.at(-1).text, '好，我帶去公司。', '寫到她說要帶咖啡去公司為止（公司那場不寫）');
  for (const b of dayLines()) {
    assert.ok(!MARKS.test(b.text), `還有標記：${b.text}`);
    assert.ok(!/^（/.test(b.text) && !/）$/.test(b.text), `舞台指示變成字：${b.text}`);
    assert.equal(b.text, b.text.trim());
  }
});

test('章名與字卡：第一天用劇本標題原文；「第二天」字卡在超商下決心之後、回咖啡館之前；「三天後」用標題原文', () => {
  assert.deepEqual(D.DAY_TITLES, { d1wake: '第一天　最底下那個抽屜' });
  assert.ok(SCRIPT.includes(`# ${D.DAY_TITLES.d1wake}`));
  assert.equal(D.DAY_CARDS.d2card, '第二天');
  assert.ok(BODY.includes('（字卡：第二天）'));
  assert.equal(D.DAY_CARDS.d5card, '三天後');
  assert.ok(BODY.includes('\n# 三天後\n'));
  const all = [...Object.values(D.DAY_TITLES), ...Object.values(D.DAY_CARDS)];
  for (const t of ['第二天　洗把臉', '第三天　第十二頁', '第四天　還剩十七張']) assert.ok(!all.includes(t), `舊章名：${t}`);
  // 順序：超商（明天就回去找德叔吧）→ 字卡第二天 → 回咖啡館
  const acts = S.OPENING_ACTS;
  assert.equal(acts.indexOf('d2card'), acts.indexOf('d1store') + 1);
  assert.equal(acts.indexOf('d2cafe'), acts.indexOf('d2card') + 1);
  assert.equal(D.DAY_LINES.d1store.at(-1).text, '明天就回去找德叔吧。');
  assert.equal(D.DAY_LINES.d2cafe[0].text, '戶頭裡有十六萬，我才敢回來這裡。');
  assert.equal(S.lineCount('d2card'), 0, '字卡沒有句子');
  assert.equal(D.DAY_ACT_VIEW.d2card, 'card');
  // 畫面：字卡用 .op-card；main.js 的 card 幕淡出後進下一幕
  assert.match(code('src/view/days.js'), /stage\('day daycard', `<div class="op-card"><p>\$\{esc\(DAY_CARDS\[act\] \|\| ''\)\}<\/p><\/div>`\)/);
  assert.match(code('src/main.js'), /if \(DAY_ACT_VIEW\[act\] === 'card'\) return dayCard\(act\);/);
});

test('德叔挽留 A 案逐字；她說「那我……下次再來。」；這是唯一一次在護龍醒來', () => {
  const shop = D.DAY_LINES.d1shop.map((b) => [b.who, b.text]);
  const has = (who, text) => assert.ok(shop.some(([w, t]) => w === who && t === text), `${who}：${text}`);
  has('deshu', '這麼快就決定了阿？');
  has('deshu', '要不要再考慮幾天？回來這裡喝幾杯咖啡，喝完再決定也不會太慢阿。');
  has('deshu', '這裡隨時都歡迎妳。');
  has('me', '那我……下次再來。');
  assert.equal(D.DAY_ACT_VIEW.d1shop, 'shop');
  // 只有第一天早上在護龍：之後不再起床、睡覺、睡護龍
  const rooms = D.DAY_ACTS.filter((a) => D.DAY_ACT_VIEW[a] === 'still').flatMap((a) => placesOf(D.DAY_LINES[a]));
  assert.deepEqual(rooms.filter((p) => p === 'roomMorning' || p === 'basin'), ['roomMorning', 'basin']);
  for (const p of ['roomNight', 'bed', 'courtyard']) assert.ok(!rooms.includes(p), `不再睡護龍：${p}`);
  for (const a of D.DAY_ACTS) assert.equal(S.isNightAct(a), false, `${a} 沒有睡前自白`);
  for (const a of D.DAY_ACTS) assert.equal(S.monoLines(a).length, 0);
});

test('不再有 v4.5 的雀斑消失、公司會議、相機、存摺放上吧台、定存等情節', () => {
  for (const old of ['d1cafe', 'd1night', 'd2wake', 'd2shop', 'd2town', 'd2night', 'd3wake', 'd3town', 'd3night', 'd4wake', 'd4town', 'd4cafe', 'd4night']) {
    assert.ok(!D.DAY_ACTS.includes(old), `舊幕 ${old}`);
  }
  const all = dayLines().map((b) => b.text).join('\n');
  for (const w of ['定存', '把存摺放上吧台', '計數窗', '會議室', '第十二頁', '雀斑怎麼不見', '底片', '宜蓁', '協理']) assert.ok(!all.includes(w), w);
  assert.equal(D.PASSBOOK_CHOICES, undefined, '存摺兩個按鈕拿掉');
  assert.ok(!dayLines().some((b) => b.branch || b.gate || b.sleep || b.mono), '沒有分支、關卡、睡著、自白');
});

test('說話的人：房東、坤伯、店長、店員都有名牌與半身立繪（v5.6 定版，依台詞切差分）；開場的德叔、我照舊', () => {
  assert.deepEqual(D.DAY_SPEAKERS, { landlord: '房東', kunbo: '坤伯', storeManager: '店長', clerk: '店員' });
  for (const [who, name] of [['landlord', '房東'], ['kunbo', '坤伯'], ['storeManager', '店長'], ['clerk', '店員'], ['deshu', '德叔'], ['me', '我']]) assert.equal(nameOf(who), name);
  const known = new Set(['deshu', 'me', ...Object.keys(D.DAY_SPEAKERS)]);
  for (const b of dayLines()) assert.ok(b.who === undefined || known.has(b.who), b.who);
  for (const w of ['landlord', 'kunbo', 'storeManager', 'clerk']) assert.ok(dayLines().some((b) => b.who === w), `${w} 有開口`);
  // 新角色每一句都出半身立繪（底卡或差分），圖在 assets/art-v56/A
  const half = { landlord: 'char_v56_landlord_half', kunbo: 'char_v56_kunbo_half', storeManager: 'char_v56_store_manager_half', clerk: 'char_v56_store_clerk_half' };
  for (const b of dayLines().filter((x) => half[x.who])) {
    const c = cueOf(b);
    assert.ok(c, `${b.who}：${b.text} 有立繪`);
    assert.equal(c.place, 'half');
    assert.ok(c.src.startsWith(`art-v56/A/${c.variant ? 'variants/' : ''}${half[b.who]}_`), `${b.text} → ${c.src}`);
    assert.ok(existsSync(root(artUrl(c.src))), `缺 ${artUrl(c.src)}`);
  }
  // 差分：每一句對到劇本原文、差分都在對照表上；沒對上的句子用底卡
  const texts = new Set(dayLines().map((b) => b.text));
  for (const [t, [who, v]] of Object.entries(LINE_CUES)) {
    assert.ok(texts.has(t), `差分對不到句子：${t}`);
    assert.ok(ART_MAP[CHAR_SLOTS[who]].variants[v], `${who} 沒有差分 ${v}`);
  }
  const cue = (t) => cueOf(find(t).b);
  assert.equal(cue('這個昨天就過期了，你是沒在看喔？').src, 'art-v56/A/variants/char_v56_store_manager_half_scold_bento', '店長罵過期便當');
  assert.equal(cue('對不起。').src, 'art-v56/A/variants/char_v56_store_clerk_half_sorry_bow', '店員道歉');
  assert.equal(cue('店員低著頭，手上還拿著那個過期的便當。').src, 'art-v56/A/variants/char_v56_store_clerk_half_downcast', '旁白：店員低著頭');
  assert.equal(cue('現在年輕人齁，動不動就請假……').variant, 'nag');
  assert.equal(cue('去吧，看到我就想跑。').variant, 'shoo');
  assert.equal(cue('記得下禮拜要交房租。').variant, 'remind_rent');
  assert.equal(cue('妳怎麼沒去上班？').src, 'art-v56/A/char_v56_landlord_half_v2', '沒對上的句子用底卡');
  assert.equal(cue('蛤？').variant, 'squint_bottle');
  assert.equal(cue('……我老花眼鏡放在屋裡啦。').variant, 'sheepish');
  assert.equal(cue('來，這顆給妳。').variant, 'offer_longan');
  assert.equal(cue('花斑貓跳上椅子，用手去撥袋子裡的龍眼乾。').src, 'art-v56/A/variants/cat_huaban_paw', '花斑貓撥龍眼乾');
  assert.equal(cueOf({ who: 'me', text: '好，我記得。' }), null, '我、旁白沒有立繪');
  assert.equal(cueOf({ who: 'deshu', text: '這裡隨時都歡迎妳。' }), null, '德叔照舊由店內流程處理');
  const main = code('src/main.js');
  assert.match(main, /const cue = cueOf\(b\);[^\n]*\n\s*reader\.portrait\(cue \? cue\.src : null, cue\?\.place, cue\?\.alt\);/, '背景圖的畫面：新角色出半身立繪');
  assert.match(main, /const portrait = day \? b\.who === 'deshu' : lk\.portrait;/, '店裡：德叔說話出德叔立繪');
  assert.match(main, /const cue = day && !portrait \? cueOf\(b\) : null;/, '店裡：坤伯說話出坤伯半身');
  assert.match(read('src/view/reader.js'), /src="\$\{artUrl\(src\)\}"/, '立繪網址由對照表產生（可載入 assets/art-v56/）');
  assert.match(main, /const face = b\.face === 'smile' \? 'char_deshu_smile' : PORTRAITS\.deshu\.src;/, '德叔微笑那兩句');
  assert.deepEqual(dayLines().filter((b) => b.face).map((b) => b.text), ['我相信妳一定可以的。', '如果包含找龍眼玩的貓客人，我們這三天總共來了三位客人。']);
  // 不拿阿哲的阿公、龍眼貓充數（對照表註解可以提到禁止使用的檔名，但不能當 src／planned）
  const src = ['src/main.js', 'src/view/days.js', 'src/view/art-map.js', 'src/lines/days.js'].map(code).join('\n');
  assert.doesNotMatch(src, /(?:src|planned)\s*:\s*['"']char_grandpa/);
  assert.doesNotMatch(code('src/view/days.js'), /cat_longan/);
});

/* ---------- 互動 ---------- */
test('字出來之前要先做的互動（tap）照劇本的順序；可選互動只有水龍頭、信箱', () => {
  const taps = dayLines().flatMap(D.tapsOf);
  assert.deepEqual(taps, ['mini', 'wallet', 'deskDrawer', 'mini', 'atm', 'poster', 'pause', 'keyBar', 'mini', 'calico', 'can', 'mini', 'mini']);
  const tapAt = (t) => find(t).b.tap;
  assert.equal(tapAt('繳完房租，剩下五千塊錢。'), 'wallet', '點桌上的錢包');
  assert.equal(tapAt('印章還在。'), 'deskDrawer', '點抽屜');
  assert.equal(tapAt('每一行都是一萬。'), 'atm', '提款機放存摺');
  assert.equal(tapAt('領這種餓不死、穿不暖的薪水，還要被這樣罵。'), 'poster', '點徵人海報');
  assert.equal(tapAt('……可是如果不去，我大概會一直想這件事。'), 'pause', '停一拍，點一下才繼續');
  assert.equal(tapAt('德叔，鑰匙我帶來了。'), 'keyBar', '鑰匙放到吧台');
  assert.equal(tapAt('貓走進一戶人家的院子，院子旁邊種了好幾棵龍眼樹。'), 'calico', '點花斑貓跟著走');
  assert.deepEqual(tapAt('坤伯，這上面寫的是農藥。'), ['can', 'mini'], '點空罐子 → 標籤小圖點一下');
  // 可選（不點也能翻頁）
  const opt = dayLines().filter((b) => b.optional);
  assert.deepEqual(opt.map((b) => b.optional), ['faucet', 'mailbox']);
  assert.equal(opt[0].text, '鼻梁和臉頰上的雀斑還是一樣多，從國中照鏡子發現後，就沒消退過。');
  assert.equal(opt[1].text, '信箱是空的，連傳單都沒有。');
  for (const b of opt) assert.ok(!b.gate && !b.tap, `${b.optional} 不能擋住劇情`);
  // 每個熱點都有元素
  for (const n of ['faucet', 'mailbox', 'wallet', 'deskDrawer', 'poster', 'calico', 'can']) assert.ok(HOT_IDS[n], n);
  for (const id of Object.values(HOT_IDS)) assert.match(read('src/view/days.js'), new RegExp(`id="${id}"`), id);
});

test('小圖五張：先疊上來（背景不切換）、點一下才出句子、講完收掉', () => {
  const minis = [];
  for (const act of D.DAY_ACTS) {
    const lines = D.DAY_LINES[act];
    lines.forEach((b, i) => {
      if (!D.tapsOf(b).includes('mini')) return;
      const lk = OP.sceneAt(lines, i);
      assert.ok(lk.mini, `${act} 第 ${i} 句有小圖`);
      if (i > 0) assert.equal(lk.place, OP.sceneAt(lines, i - 1).place, `${act} 第 ${i} 句：背景不切換`);
      assert.ok(!OP.sceneAt(lines, Math.max(0, i - 1)).mini || i === 0, '前一句還沒有這張小圖');
      // 講完收掉：之後同一幕有一句 mini 變回 null，不然就是這一幕結束（換幕時整層收起來）
      const off = lines.findIndex((x, j) => j > i && x.set && 'mini' in x.set && x.set.mini === null);
      assert.ok(off > i || OP.sceneAt(lines, lines.length - 1).mini === lk.mini, `${act}：${lk.mini} 會收掉`);
      minis.push(lk.mini);
    });
    assert.ok(!OP.sceneAt(lines, 0).mini, `${act} 開頭沒有殘留的小圖`);
  }
  assert.deepEqual(minis, ['stain', 'passbook', 'hat', 'label', 'longan']);
  assert.deepEqual(Object.keys(MINI_SLOTS).sort(), ['hat', 'label', 'longan', 'passbook', 'stain']);
  // 水痕：點一下才出下面兩句，兩句講完收掉
  const w = find('窗戶下面那塊水痕好像又比上個月大了一點。');
  assert.equal(OP.sceneAt(D.DAY_LINES.d1home, w.i + 1).mini, 'stain');
  assert.equal(OP.sceneAt(D.DAY_LINES.d1home, w.i + 2).mini, null);
  // 畫面：在既有 #op-prop 上加 .pp-mini（不拆既有特寫卡）；點一下才 resolve；字出來之前先做 tap
  const view = code('src/view/days.js');
  assert.match(read('index.html'), /<section id="op-prop" hidden><div class="pp-card"><\/div><div class="pp-mini"><\/div>/);
  assert.match(view, /peek\(\) \{/);
  assert.match(view, /const hit = button\('pp-peek', '下一句'\);/);
  const main = code('src/main.js');
  assert.match(main, /for \(const t of tapsOf\(b\)\) \{[\s\S]*?reader\.hideBox\(\);[\s\S]*?const ok = t === 'pause' \? await reader\.next\(\) : await tap\?\.\(t, b\);[\s\S]*?\}\s*props\.clear\(\);\s*props\.show\(lk\);/, '小圖／互動做完才出字');
  assert.match(main, /if \(name === 'mini'\) return props\.peek\(\);/);
  // 物件小圖不畫手；暫代不拿無關道具（不用 longanBag／longanJar、不用舊 CSS 咖啡豆罐冒充標籤）
  for (const k of Object.keys(MINI_SLOTS)) {
    const html = miniHtml(k);
    assert.ok(html.length > 0, k);
    assert.doesNotMatch(html, /hand|pp-can|longanBag|longanJar/, k);
  }
  assert.match(miniHtml('label'), /農藥/, '空罐子的標籤由程式疊「農藥」');
  // 既有特寫卡沒拆
  const css = read('index.html');
  for (const c of ['.pp-passbook {', '.pp-can {', '.pp-card.badge img', '.pp-bag {', '.pp-camera {']) assert.ok(css.includes(c), `既有特寫卡 ${c}`);
});

test('程式疊字：徵人海報「誠徵門市人員」（劇本沒寫薪資數字，不疊薪水）、空罐子「農藥」、紙袋「提神醒腦，過目不忘」', () => {
  assert.equal(OVERLAY_TEXT.poster, '誠徵門市人員');
  assert.doesNotMatch(OVERLAY_TEXT.poster, /\d|元|薪/);
  assert.ok(BODY.includes('上面寫「誠徵門市人員」和薪水'));
  assert.equal(OVERLAY_TEXT.label, '農藥');
  assert.equal(OVERLAY_TEXT.paperbag, '提神醒腦，過目不忘');
  assert.equal(find('「提神醒腦，過目不忘」').b.set.prop, 'paperbag');
  assert.equal(find('領這種餓不死、穿不暖的薪水，還要被這樣罵。').b.set.prop, 'poster');
  const view = read('src/view/days.js');
  assert.match(view, /poster: \(\) => `<div class="pp-poster"><span class="pp-overlay">\$\{esc\(OVERLAY_TEXT\.poster\)\}<\/span><\/div>`/);
  assert.match(view, /<div class="dy-poster" id="dy-poster"><span>\$\{esc\(OVERLAY_TEXT\.poster\)\}<\/span><\/div>/);
});

/* ---------- 流程 ---------- */
test('第一晚睡著後進第一天；一路照順序走完到研發咖啡，之後才待續；每一句都讀到', () => {
  const order = [];
  const { s, seen } = walk(S.newStoryState(), {
    stop: S.isOpeningEnd,
    each: (st) => { if (order.at(-1) !== st.opening.act) order.push(st.opening.act); },
  });
  assert.deepEqual(order, S.OPENING_ACTS, '每一幕都走過一次，順序照列表');
  assert.equal(s.opening.act, S.END_ACT);
  assert.equal(S.nextActOf('room'), 'd1wake');
  assert.equal(S.nextActOf('d5brew'), S.END_ACT, '研發咖啡之後是待續（公司那場不寫）');
  assert.equal(S.nextActOf(S.END_ACT), null);
  for (const b of dayLines()) assert.ok(seen.includes(b), `沒讀到：${b.text}`);
  assert.deepEqual(D.DAY_ACTS, ['d1wake', 'd1shop', 'd1town', 'd1home', 'd1bank', 'd1store', 'd2card', 'd2cafe', 'd5card', 'd5cafe', 'd5village', 'd5thanks', 'd5brew']);
  const main = code('src/main.js');
  assert.doesNotMatch(main, /finishOpening|choosePassbook/);
  assert.equal((main.match(/if \(done === 'slept'\) return fallAsleep\(\);/g) || []).length, 1, '只有第一晚（開場 room）會睡著');
  assert.match(main, /if \(act === S\.END_ACT\) return openingScene\('end'\);/);
  assert.doesNotMatch(read('src/lines/company.js'), /DAY_LINES|days\.js/, '公司那場不在這次範圍');
});

test('每一幕、每一句存檔讀回都在同一處（第一晚到研發咖啡）', () => {
  let n = 0;
  walk(S.normalize(at('room'), SRC), {
    stop: S.isOpeningEnd,
    each: (st) => {
      const r = reload(st);
      assert.equal(r.opening.act, st.opening.act);
      assert.equal(r.opening.line, st.opening.line, `${st.opening.act} 第 ${st.opening.line} 句`);
      n++;
    },
  });
  assert.ok(n > 150);
  // 字出來之前的互動不進存檔：讀回停在那一句就要重做（畫面處理）；句子進度照樣能往前
  const w = find('繳完房租，剩下五千塊錢。');
  const s = S.normalize(at(w.act, w.i), SRC);
  assert.equal(S.setOpeningLine(s, w.i + 1), true);
});

test('第一晚睡著自動存檔接到第一天早上；跳過自白只在第一晚', () => {
  const st = fakeStorage();
  const s = S.normalize(at('room', 0), SRC);
  while (!S.ACT_LINES.room[s.opening.line].sleep) step(s);
  assert.equal(S.sleepThrough(s), true);
  persist(s, st);
  const back = load(SRC, st);
  assert.equal(back.opening.act, 'd1wake');
  assert.equal(back.opening.line, 0);
  assert.deepEqual([...st.m.keys()], [SAVE_KEY]);
  for (const k of OTHER_KEYS) assert.equal(st.m.has(k), false);
  for (const i of S.monoLines('room')) assert.equal(S.skipMonologue(S.normalize(at('room', i), SRC)), true);
  assert.equal(S.skipMonologue(S.normalize(at('room', 1), SRC)), false, '點床那一句還不是自白');
  for (const a of D.DAY_ACTS) assert.equal(S.skipMonologue(S.normalize(at(a, 0), SRC)), false, a);
  assert.equal(S.skipMonologue(S.normalize(at(S.END_ACT), SRC)), false);
  const main = code('src/main.js');
  assert.match(main, /if \(b\.sleep && S\.sleepThrough\(state\)\) save\(\);/);
  assert.match(main, /if \(ok === 'skip'\) \{\s*if \(S\.skipMonologue\(state\)\) save\(\);\s*return 'slept';/);
  assert.match(main, /if \(!S\.setOpeningLine\(state, n\)\) return false;\s*save\(\);/);
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
    r.show({ text: '我是被雞叫醒的。' });
    r.skip(false);
    assert.equal(skip.hidden, true);
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
    box.dispatch('click');
    assert.equal(await p, true);
    r.show({ text: '被子真的有曬過，德叔沒有騙我。', mono: true });
    r.skip(true);
    tick(f.SKIP_ARM_MS);
    p = r.next();
    key('Enter', skip);
    assert.equal(await p, true, 'Enter 只翻一句');
    r.show({ text: '可是他說老老闆交代過，要留一個房間讓我睡。', mono: true });
    tick(f.TAP_GUARD_MS + 10);
    p = r.next();
    key(' ', skip);
    assert.equal(await p, true, 'Space 只翻一句');
    r.show({ text: '老老闆怎麼會知道我今天晚上回不去？', mono: true });
    tick(f.TAP_GUARD_MS + 10);
    p = r.next();
    skip.dispatch('click');
    assert.equal(await p, 'skip');
    r.skip(false);
    assert.equal(skip.hidden, true);
    r.hide();
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
  assert.match(code('src/main.js'), /reader\.skip\(!!b\.mono\);/, '只在自白（mono）的句子出現');
});

/* ---------- 舊存檔相容 ---------- */
test('舊存檔：v4.5 的第一～四天幕名接到新流程（不卡住）；舊待續 end 接到第一天早上；舊的存摺選擇不保留', () => {
  for (const [old, want] of Object.entries(S.LEGACY_ACTS)) {
    const r = S.playable(S.normalize(at(old, 5, { passbook: 'show', fork: 'left' }), SRC));
    assert.equal(r.opening.act, want, old);
    assert.ok(S.OPENING_ACTS.includes(r.opening.act));
    assert.equal(r.opening.line, 0, `${old} 從第 0 句`);
    assert.equal(r.opening.fork, 'left', '前面的岔路留著');
    assert.ok(!('passbook' in r.opening), '存摺選擇不保留');
    walk(r, { stop: S.isOpeningEnd }); // 接得上、走得到待續
  }
  assert.equal(S.LEGACY_ACTS.d1cafe, 'd1store');
  assert.equal(S.LEGACY_ACTS.d4night, 'd2card');
  // 舊待續（第一晚已結束）：不卡在待續、不重開，接到第一天早上
  for (const raw of [at('end', 0), at('end', 7), { ...at('end', 0), opening: { act: 'end', resignation: 'fire', fork: 'left', deshuLine: 3 } }]) {
    const r = S.playable(S.normalize(raw, SRC));
    assert.equal(r.opening.act, 'd1wake');
    assert.equal(r.opening.line, 0);
    assert.equal(S.isOpeningEnd(r), false);
  }
  // 沿用的幕名（d1wake、d1shop、d1town）：句子進度夾在新的句數之內
  let r = S.normalize(at('d1town', 999), SRC);
  assert.equal(r.opening.line, D.DAY_LINES.d1town.length - 1);
  r = S.normalize(at('d2card', 3), SRC);
  assert.equal(r.opening.line, 0, '字卡沒有句子');
  // 開場中途：原幕原句
  r = S.playable(S.normalize(at('deshu', 12), SRC));
  assert.equal(r.opening.act, 'deshu');
  assert.equal(r.opening.line, 12);
  // fake localStorage：舊檔存進去、讀回接得上
  const st = fakeStorage();
  st.setItem(SAVE_KEY, JSON.stringify(at('d3town', 40)));
  assert.equal(S.playable(load(SRC, st)).opening.act, 'd2card');
  assert.deepEqual(S.normalize({ v: 2, phase: 'opening', opening: { act: 'd2cafe' } }, SRC), S.newStoryState(), '版本不是 1 才重來');
  assert.equal(S.SCHEMA, 1);
  const old = S.enterStory(S.newStoryState());
  assert.deepEqual(S.playable(reload(old)), S.newStoryState(), '舊三天故事：回到開場開頭');
});

/* ---------- 美術 ---------- */
test('素材對照表（art-map.js）：每個 slot 有用途、預定鍵、狀態；ready 的圖都在（assets/art 或 assets/art-v56）；暫代都寫明方式；不拿龍眼貓／阿公充數', () => {
  const files = new Set(readdirSync(root('assets/art')));
  const has = (ref) => existsSync(root(artUrl(ref)));
  for (const [id, s] of Object.entries(ART_MAP)) {
    assert.ok(s.use, `${id} 用途`);
    assert.ok('planned' in s, `${id} 預定鍵`);
    assert.ok(['ready', 'temp', 'none'].includes(s.status), `${id} 狀態`);
    if (s.src) assert.ok(has(refOf(id)), `${id}：缺 ${artUrl(refOf(id))}`);
    for (const v of Object.keys(s.variants || {})) assert.ok(has(refOf(id, v)), `${id}／${v}：缺 ${artUrl(refOf(id, v))}`);
    if (s.status !== 'ready') assert.ok(s.temp, `${id} 暫代方式`);
    if (s.dir) assert.ok(s.dir.startsWith('art-v56/'), `${id}：新圖只放 assets/art-v56/`);
  }
  for (const n of ART_MAP_FILES) assert.ok(has(n), n);
  assert.equal(artUrl('scene_county_road'), 'assets/art/scene_county_road.webp', '舊圖仍在 assets/art/');
  assert.equal(artUrl('art-v56/B/bg_v56_store_interior_portrait'), 'assets/art-v56/B/bg_v56_store_interior_portrait.webp');
  // v5.6 定版背景：只用直式 1170×2532（_portrait；村子路用 _portrait_v2），拿掉 CSS 中性底
  const BG = { bg_stairs: 'bg_v56_stairwell_portrait', bg_home: 'bg_v56_rental_room_day_portrait', bg_atm: 'bg_v56_bank_atm_portrait',
    bg_store: 'bg_v56_store_interior_portrait', bg_village: 'bg_v56_village_lane_portrait_v2', bg_kunyard: 'bg_v56_kunbo_yard_portrait' };
  for (const [id, f] of Object.entries(BG)) {
    assert.equal(ART_MAP[id].status, 'ready', id);
    assert.equal(srcOf(id), `art-v56/B/${f}`, id);
    assert.deepEqual(webpSize(readFileSync(root(artUrl(srcOf(id))))), [1170, 2532], `${f} 是直式 1170×2532`);
  }
  for (const k of ['stairs', 'home', 'atm', 'store', 'village', 'kunyard']) assert.ok(PLACES[k].src, `${k} 不再是 CSS 中性底`);
  assert.doesNotMatch(read('index.html'), /\.dy-css-(stairs|atm|store|village|kunyard)/, 'CSS 中性底拿掉');
  // 角色：A 組底卡用 *_v2，差分在 variants/
  const CH = { ch_landlord: ['char_v56_landlord_half_v2', ['nag', 'remind_rent', 'shoo']], ch_kunbo: ['char_v56_kunbo_half_v2', ['squint_bottle', 'sheepish', 'offer_longan']],
    ch_store_manager: ['char_v56_store_manager_half_v2', ['scold_bento', 'exasperated']], ch_clerk: ['char_v56_store_clerk_half_v2', ['downcast', 'sorry_bow']],
    ch_calico: ['cat_huaban_sit_v2', ['jump', 'walk', 'paw']] };
  for (const [id, [base, vs]] of Object.entries(CH)) {
    assert.equal(ART_MAP[id].status, 'ready', id);
    assert.equal(srcOf(id), `art-v56/A/${base}`, id);
    assert.deepEqual(Object.keys(ART_MAP[id].variants).sort(), [...vs].sort(), `${id} 差分`);
    for (const v of vs) assert.match(refOf(id, v), /^art-v56\/A\/variants\//);
    assert.equal(refOf(id, 'nope'), srcOf(id), '沒有的差分用底卡');
  }
  assert.match(srcOf('ch_calico'), /cat_huaban/, '花斑貓用 cat_huaban');
  for (const id of ['ch_calico', 'ch_kunbo']) for (const v of [null, ...Object.keys(ART_MAP[id].variants)]) assert.doesNotMatch(refOf(id, v), /cat_longan|char_grandpa/, `${id} 不拿龍眼貓／阿公充數`);
  // 小圖：C 組 prop_v56_*_v2
  const MINI = { mini_stain: 'prop_v56_water_stain_v2', mini_passbook: 'prop_v56_passbook_drawer_v2', mini_hat: 'prop_v56_douli_v2', mini_label: 'prop_v56_empty_can_label_v2', mini_longan: 'prop_v56_dried_longan_v2' };
  for (const [id, f] of Object.entries(MINI)) { assert.equal(ART_MAP[id].status, 'ready', id); assert.equal(srcOf(id), `art-v56/C/${f}`); }
  for (const k of Object.values(MINI_SLOTS)) assert.ok(ART_MAP[k], k);
  assert.match(ART_MAP.mini_label.use, /農藥/);
  assert.deepEqual(webpSize(readFileSync(root(artUrl(srcOf('mini_label'))))), [1024, 1024], '空罐子小圖是正方形（疊字座標以 1024×1024 量）');
  assert.match(miniHtml('label'), /assets\/art-v56\/C\/prop_v56_empty_can_label_v2\.webp[\s\S]*mn-on-art[^>]*>農藥</, '標籤留白處由程式疊「農藥」');
  assert.match(read('index.html'), /\.pp-mini\.mini-label \.mn-on-art \{ left: 48\.6%; top: 68%;/);
  // 超商海報：疊在後牆留白框（原圖 x 345–1037、y 567–857）
  assert.match(read('index.html'), /\.dy-poster \{ position: absolute; left: 29\.5%; top: 22\.4%; width: 59\.1%; height: 11\.5%;/);
  // 花斑貓：村子路跳下（jump）→ 坐（sit）→ 點了走（walk）
  const view = code('src/view/days.js');
  assert.match(view, /cat\.dataset\.pose = 'jump'/);
  assert.match(view, /cat\.dataset\.pose = 'walk'/);
  // 預載包含新圖
  for (const r of ART_MAP_FILES.filter((x) => x.startsWith('art-v56/'))) assert.ok(DAY_ART.includes(r), `沒有預載 ${r}`);
  // 已有的直接用
  for (const [id, src] of [['bg_office', 'scene_office_night'], ['bg_mailbox', 'scene_mailboxes'], ['bg_road', 'scene_county_road'], ['bg_courtyard_night', 'scene_v3b_courtyard_night_v2'], ['bg_room_night', 'scene_v3b_room_night'], ['bg_bed_pov', 'scene_v3b_bed_pov_night']]) {
    assert.equal(ART_MAP[id].src, src);
    assert.equal(ART_MAP[id].status, 'ready');
  }
  // 場景都從對照表來
  for (const [k, p] of Object.entries(PLACES)) {
    assert.ok(ART_MAP[p.slot], `${k} 對到 ${p.slot}`);
    assert.equal(p.src, srcOf(p.slot), k);
  }
  for (const act of D.DAY_ACTS.filter((a) => D.DAY_ACT_VIEW[a] === 'still')) for (const k of placesOf(D.DAY_LINES[act])) assert.ok(PLACES[k], `${act}：${k}`);
  for (const n of DAY_ART) assert.ok(n.includes('/') ? has(n) : files.has(`${n}.webp`), `缺 ${artUrl(n)}`);
  assert.match(read('src/main.js'), /preload\(\[\.\.\.new Set\(\[\.\.\.allArt\(\), \.\.\.DAY_ART\]\)\]\)/);
  // 洗臉：鏡子裡是帶缺點的角色卡
  assert.equal(YIJUN_CARD.flawed, 'char_v3b_yijun_card_flawed_v4');
  assert.equal(yijunCardFor('d1wake'), YIJUN_CARD.flawed);
  assert.match(read('src/view/days.js'), /class="dy-face"/);
  // 不以程式畫人形；音效都有定義、沒有外部音檔
  assert.doesNotMatch(code('src/view/days.js') + code('src/main.js'), /drawShape|granny|junior/);
  const audio = read('src/view/audio.js');
  for (const b of dayLines()) for (const n of b.sfx || []) assert.ok(audio.includes(`case '${n}':`), `沒有音效 ${n}`);
  assert.doesNotMatch(read('src/view/days.js'), /\.(mp3|ogg|wav|m4a)\b/);
  assert.ok(!existsSync(root('assets/art/art-map.js')));
});
