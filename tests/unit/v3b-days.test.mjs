// v3b 第一天～研發咖啡（劇本 v5.8，承峰 2026-11-21 19:44 定稿）：第一晚自白（開場）、正文逐字對稿、章名與字卡、
// 新說話人名牌、還鑰匙（騰不出空間／下次拿來；把鑰匙拖向德叔）、信箱可點可不點（不點仍接到房東）、房東只提醒下禮拜交房租、
// 壓歲錢十六萬、超商下決心、字卡「第二天」、實習老闆、微笑停一拍後字卡「三天後」（字卡前自動存檔）、
// 字出來之前要先做的互動（小圖點一下、錢包、抽屜、提款機、海報、鑰匙、花斑貓、空罐子、停一拍）、可選互動、不再睡護龍、
// 作廢情節不在遊戲裡（定存、當天催租付清、存摺放上吧台、人資訊息、濾掛包、第二天的銀杏龍眼、親寫鑰匙句）、
// 舊存檔相容（v4.5 與 v5.7 未提交版的幕名接到新位置）、素材對照表（art-map.js）。
// 只測純邏輯與靜態檔案，不開瀏覽器；閱讀框（view/reader.js）用最小的假 DOM 測點擊與按鍵。
// 劇本 v5.8 定稿在 _agent/v3b/script-v5.8.md（本機未追蹤）；沒有這個檔時，逐字對稿那幾項跳過，其他照測（重要句子另外寫死在下面）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as OP from '../../src/lines/opening.js';
import * as D from '../../src/lines/days.js';
import * as S from '../../src/story/state.js';
import { load, persist, SAVE_KEY, OTHER_KEYS } from '../../src/story/save.js';
import { PLACES, DAY_ART, YIJUN_CARD, yijunCardFor, placesOf, HOT_IDS, MINI_SLOTS, miniHtml, cueOf, LINE_CUES, CHAR_SLOTS, KEY_HINT, MAILBOX_HOT_CELL, MAILBOX_PAD } from '../../src/view/days.js';
import { ART_MAP, OVERLAY_TEXT, ART_MAP_FILES, artUrl, refOf, srcOf } from '../../src/view/art-map.js';
import { nameOf } from '../../src/view/reader.js';
import { step, walk } from './walk.mjs';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const code = (p) => read(p).replace(/\/\/.*$/gm, '');
const SRC = JSON.parse(read('src/story/final-source.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const reload = (s) => S.normalize(clone(s), SRC);
const MARKS = /【(待定|待確認|新增互動|不演出|已定|註)】|【小圖/;
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
// 劇本 v5.9（字卡倒數版；變數名沿用 V58）
const V58_PATH = '_agent/v3b/script-v5.9.md';
const HAS58 = existsSync(root(V58_PATH));
const V58 = HAS58 ? read(V58_PATH).replace(/\r\n/g, '\n') : '';
const NO58 = HAS58 ? false : `沒有 ${V58_PATH}（劇本 v5.9，本機未追蹤）`;
const BODY = V58.slice(V58.indexOf('\n# 最底下那個抽屜\n'));
// 畫面上照順序出現的句子：每一幕的閱讀框句子；接回場（resend）是 DOM 畫面自己出的四拍（送出去了／我想起信上的那一句／信上原句／其實我已經辭職了...）
const shownLines = () => D.DAY_ACTS.flatMap((a) => (a === 'resend' ? D.RESEND.lines.map((text) => ({ text })) : D.DAY_LINES[a]));
const STRIP = (x) => x.replace(/^(【(待定|待確認|新增互動)】)+/, '');
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 劇本正文的對白／旁白（照順序）：跳過標題、舞台指示（……）、引用、【小圖】
function spokenOf(body) {
  const names = Object.keys(D.SCRIPT_SPEAKERS).sort((a, b) => b.length - a.length).map(reEsc);
  const re = new RegExp(`^(${names.join('|')})：「(.*)」$`);
  const out = [];
  for (const raw of body.split('\n')) {
    const line = STRIP(raw.trim());
    if (!line || line.startsWith('#') || line.startsWith('---') || line.startsWith('（') || line.startsWith('【') || line.startsWith('>') || line.startsWith('**')) continue;
    const m = line.match(re);
    out.push(m ? { who: D.SCRIPT_SPEAKERS[m[1]], text: m[2] } : { who: undefined, text: line });
  }
  return out;
}

/* ---------- 第一晚（開場） ---------- */
test('第一晚自白（v5.8）：逐字、接在放鑰匙（可點床）之後、最後一句仍是睡著句；自白期間是躺下視角', () => {
  const room = OP.OPENING_LINES.room;
  assert.deepEqual(room.map((b) => b.text), [
    '我穿過庭埕。龍眼跟到一半就坐下來，沒有再跟。',
    '房間不大。我把鑰匙從口袋拿出來，放在枕頭旁邊。',
    '外面有蟲在叫，遠一點的地方有狗叫了幾聲，又停了。',
    '棉被真的有曬過，德叔沒有騙我。',
    '蓋起來暖暖的，跟我在市區拿去投幣烘衣機、剛烘好拿出來的棉被一樣暖。',
    '可是他說老老闆交代過，要留一個房間讓我睡。',
    '老老闆怎麼會知道我今天晚上回不去？',
    '我連老老闆是誰都還沒搞清楚，就先睡在他留給我的房間裡了。',
    '今天下班前我還坐在公司，現在躺在這裡，覺得那好像是好幾天以前的事。',
    '明天早上看到德叔，我要先問他老老闆的事。',
    '我本來只想躺一下，燈還沒關就睡著了。',
  ]);
  assert.equal(room[1].optional, 'bed', '點床仍是可選');
  assert.deepEqual(S.monoLines('room'), [2, 3, 4, 5, 6, 7, 8, 9, 10], '第 2 句起是本段自白');
  assert.deepEqual(room.map((b) => !!b.sleep), [...Array(10).fill(false), true]);
  for (let i = 2; i < room.length; i++) assert.equal(OP.sceneAt(room, i).lying, true, `第 ${i} 句是躺下視角`);
  assert.ok(!OP.sceneAt(room, 1).lying);
  for (const b of room) assert.ok(!MARKS.test(b.text) && !b.who, '旁白、沒有標記');
});

/* ---------- 字 ---------- */
test('劇本 v5.9 正文逐字：「最底下那個抽屜」起每一句對白／旁白（含接回場四拍）照順序與 _agent/v3b/script-v5.9.md 相同（舞台指示、小圖、字卡、標題、【待定】標記不是字）', { skip: NO58 }, () => {
  const spoken = spokenOf(BODY);
  const mine = shownLines().map((b) => ({ who: b.who, text: b.text }));
  assert.equal(mine.length, spoken.length, '句數');
  assert.deepEqual(mine, spoken);
  assert.equal(mine.at(-1).text, '好，我帶去公司。', '寫到她說要帶咖啡去公司為止（公司那場不寫）');
});

test('字的規則：沒有標記、沒有舞台指示、前後沒有空白；說話人只有劇本有的', () => {
  for (const b of dayLines()) {
    assert.ok(!MARKS.test(b.text), `還有標記：${b.text}`);
    assert.ok(!/^（/.test(b.text) && !/）$/.test(b.text), `舞台指示變成字：${b.text}`);
    assert.equal(b.text, b.text.trim());
  }
  const shown = [...Object.values(D.DAY_TITLES), ...Object.values(D.DAY_CARDS), KEY_HINT, ...D.RESEND.lines, D.RESEND.next].join('\n');
  assert.ok(!MARKS.test(shown), '章名、字卡、提示字、接回場沒有【待定】');
});

test('章名與字卡（v5.9）：「最底下那個抽屜」（拿掉第一天）、「第二天　回咖啡館」；倒數字卡「前 1 天」在章名前、歸零卡在超商之後；字卡「第二天」在接回場之後、「三天後」在「我相信妳一定可以的。」之後', () => {
  assert.deepEqual(D.DAY_TITLES, { d1wake: '最底下那個抽屜', d2cafe: '第二天　回咖啡館' });
  assert.deepEqual(D.DAY_CARDS, { t1card: '我單方面辭退老闆前 1 天', t0card: '我單方面辭退老闆當天　16:49', d2card: '第二天', d5card: '三天後' });
  if (HAS58) {
    assert.ok(V58.includes(`\n# ${D.DAY_TITLES.d1wake}\n`));
    assert.ok(V58.includes(`\n# ${D.DAY_TITLES.d2cafe}\n`));
    assert.ok(!V58.includes('\n# 第一天'), '章名拿掉「第一天」');
    assert.ok(V58.includes(`（【待定】字卡：${D.DAY_CARDS.t1card}）\n\n---\n\n# ${D.DAY_TITLES.d1wake}\n`), '字卡「前 1 天」接章名');
    assert.ok(BODY.includes(`（【待定】字卡：${D.DAY_CARDS.t0card}）`));
    assert.ok(BODY.includes('（字卡：第二天）'));
    assert.ok(BODY.includes('（【待定】字卡：三天後）'));
    assert.ok(BODY.includes(`按「${D.RESEND.next}」`));
  }
  const all = [...Object.values(D.DAY_TITLES), ...Object.values(D.DAY_CARDS)];
  for (const t of ['第二天　洗把臉', '第三天　第十二頁', '第四天　還剩十七張', '第二天　人資的訊息', '隔天早上', '第一天　最底下那個抽屜']) assert.ok(!all.includes(t), `舊章名：${t}`);
  // 順序：第一晚 → 字卡前 1 天 → 最底下那個抽屜 … 超商 → 歸零卡 → 接回場 → 字卡第二天 → 回咖啡館 → 字卡三天後 → 三天後
  const acts = S.OPENING_ACTS;
  assert.equal(acts.indexOf('t1card'), acts.indexOf('room') + 1);
  assert.equal(acts.indexOf('d1wake'), acts.indexOf('t1card') + 1);
  assert.equal(acts.indexOf('t0card'), acts.indexOf('d1store') + 1);
  assert.equal(acts.indexOf('resend'), acts.indexOf('t0card') + 1);
  assert.equal(acts.indexOf('d2card'), acts.indexOf('resend') + 1);
  assert.equal(acts.indexOf('d2cafe'), acts.indexOf('d2card') + 1);
  assert.equal(acts.indexOf('d5card'), acts.indexOf('d2cafe') + 1, '「我相信妳一定可以的。」之後直接是字卡「三天後」（不加回住處、不加隔天早上）');
  assert.equal(acts.indexOf('d5cafe'), acts.indexOf('d5card') + 1);
  // 超商結尾兩句（承峰 02:07「超商結尾兩句都用」），取代「明天就回去找德叔吧。」
  assert.deepEqual(D.DAY_LINES.d1store.slice(-2).map((b) => [b.who, b.text]), [
    ['me', '公司那邊，不管適不適合，我都不做了。'],
    ['me', '明天先回去上班，把離職單送出去。再回來找德叔。'],
  ]);
  assert.ok(!dayLines().some((b) => b.text === '明天就回去找德叔吧。'));
  for (const a of ['t1card', 't0card', 'resend']) assert.equal(S.lineCount(a), 0, a);
  assert.equal(D.DAY_ACT_VIEW.t1card, 'card');
  assert.equal(D.DAY_ACT_VIEW.t0card, 'card');
  assert.equal(D.DAY_LINES.d2cafe[0].text, '戶頭裡有十六萬，我才敢回來這裡。');
  assert.equal(D.DAY_LINES.d2cafe.at(-1).text, '我相信妳一定可以的。');
  assert.equal(D.DAY_LINES.d5cafe[0].text, '德叔……我們這三天有幾位客人？');
  assert.equal(S.lineCount('d2card'), 0, '字卡沒有句子');
  assert.equal(S.lineCount('d5card'), 0, '字卡沒有句子');
  assert.equal(D.DAY_ACT_VIEW.d2card, 'card');
  assert.equal(D.DAY_ACT_VIEW.d5card, 'card');
  // 畫面：字卡用 .op-card（字只放 DAY_CARDS 的字）；main.js 的 card 幕淡出後進下一幕；店裡開始的第二天先出章名卡
  assert.match(code('src/view/days.js'), /export function showCard\(root, act, text = DAY_CARDS\[act\] \|\| ''\) \{/);
  assert.match(code('src/view/days.js'), /stage\('day daycard', `<div class="op-card"><p>\$\{esc\(text\)\}<\/p><\/div>`\)/);
  assert.match(code('src/main.js'), /if \(DAY_ACT_VIEW\[act\] === 'card'\) return dayCard\(act\);/);
  assert.match(code('src/main.js'), /if \(day && state\.opening\.line === 0 && DAY_TITLES\[act\]\) \{[\s\S]*?showCard\(\$\('opening'\), act, DAY_TITLES\[act\]\)/);
});

test('字卡出現前自動存檔：超商最後一句 → 存成字卡「第二天」；德叔微笑停一拍之前先存成字卡「三天後」', () => {
  const main = code('src/main.js');
  // 一般換幕（超商 → 字卡第二天）：先換幕、存檔，才淡出
  assert.match(main, /function nextAct\(from, color, ms\) \{\s*if \(!S\.setOpeningAct\(state, S\.nextActOf\(from\)\)\) return;\s*save\(\);\s*fadeThen\(go, color, ms\);/);
  // 第二天最後一句：linger（微笑停一拍）。停之前先換幕、存檔；字收起來、立繪留著
  const last = D.DAY_LINES.d2cafe.at(-1);
  assert.equal(last.face, 'smile', '（畫面：德叔露出微笑。）');
  assert.ok(last.linger >= 800 && last.linger <= 2500, `停一拍 ${last.linger}ms`);
  assert.deepEqual(dayLines().filter((b) => b.linger).map((b) => b.text), ['我相信妳一定可以的。']);
  assert.match(main, /if \(last\?\.linger\) \{[\s\S]*?if \(!S\.setOpeningAct\(state, S\.nextActOf\(act\)\)\) return;\s*save\(\);\s*reader\.hideBox\(\);[\s\S]*?await sleep\(last\.linger\);/);
  // 存檔讀回：停在字卡（三天後）
  const s = S.normalize(at('d2cafe', D.DAY_LINES.d2cafe.length - 1), SRC);
  assert.equal(S.setOpeningAct(s, S.nextActOf('d2cafe')), true);
  const st = fakeStorage();
  persist(s, st);
  assert.equal(load(SRC, st).opening.act, 'd5card');
  const t = S.normalize(at('d1store', D.DAY_LINES.d1store.length - 1), SRC);
  assert.equal(S.setOpeningAct(t, S.nextActOf('d1store')), true);
  persist(t, st);
  assert.equal(load(SRC, st).opening.act, 't0card', '超商之後：歸零字卡');
  // 接回場按「下班」→ 存成字卡「第二天」（view 的 api.go 先存檔才淡出）
  const u = load(SRC, st);
  assert.equal(S.setOpeningAct(u, 'resend'), true);
  assert.equal(S.setOpeningAct(u, S.nextActOf('resend')), true);
  persist(u, st);
  assert.equal(load(SRC, st).opening.act, 'd2card');
  assert.match(main, /go: \(a, opt = \{\}\) => \{ if \(S\.setOpeningAct\(state, a\)\) \{ save\(\); if \(opt\.fade\) fadeThen\(go, '#0d0b0a', 900\); else go\(\); \} \},/);
});

/* ---------- 第一天 ---------- */
test('第一天早上（v5.8 補回）：水很冰、銅色的水龍頭；店裡：杯子收在架子上、德叔「不會啦……」、把鑰匙拖向德叔（沒有接）', () => {
  assert.deepEqual(D.DAY_LINES.d1wake.map((b) => b.text), [
    '我是被雞叫醒的。',
    '雖然臨時在外面過夜，但這是我這半年睡得最好的一次。',
    '手機還有百分之十一。充電器在租屋處，我昨天出門的時候沒想過會在外面過夜。',
    '水很冰。',
    '我關掉銅色的水龍頭抬起頭，木頭框的鏡子剛好照到我整張臉。',
    '鼻梁和臉頰上的雀斑還是一樣多，從國中照鏡子發現後，就沒消退過。',
    '黑眼圈好明顯，也是去年的某天發現後，就一直掛在上面。',
    '衣服是昨天那套。我聞了一下袖口，還好。',
  ]);
  assert.equal(find('水很冰。').b.optional, 'faucet', '點水龍頭可選');
  assert.equal(find('水很冰。').b.set.place, 'basin');
  const shop = D.DAY_LINES.d1shop.map((b) => [b.who, b.text]);
  assert.deepEqual(shop.slice(0, 3).map(([, t]) => t), ['我昨天喝的那個杯子洗好了，收在德叔背後的架子上。', '別的杯子都是疊在一起的，只有那個自己放一格，把手朝右。', '德叔站在吧台後面挑豆，壞的丟鐵碗，頭沒抬。']);
  assert.ok(shop.some(([w, t]) => w === 'deshu' && t === '不會啦，有睡好就好。那間本來就是留給妳的，不用跟我客氣。'));
});

test('還鑰匙（v5.8）：「不好意思阿，我手騰不出空間來，妳先留著吧。」「那我……下次拿來。」；不用 v5.6 的挽留三句與「下次再來。」', () => {
  const shop = D.DAY_LINES.d1shop;
  const idx = (t) => shop.findIndex((b) => b.text === t);
  const give = idx('我從口袋拿出鑰匙，遞過去。');
  assert.equal(shop[give].gate, 'keyGive', '把鑰匙拖向德叔（關卡：拖過去才出下一句）');
  assert.deepEqual([shop[give + 1].who, shop[give + 1].text], ['deshu', '不好意思阿，我手騰不出空間來，妳先留著吧。']);
  assert.equal(shop[give + 2].text, '他兩隻手都是豆子的銀皮。吧台上也沒有一塊空的地方。');
  assert.equal(shop[give + 3].text, '我拿著鑰匙站了一下。');
  assert.deepEqual([shop[give + 4].who, shop[give + 4].text], ['me', '那我……下次拿來。']);
  assert.equal(shop[give + 5].text, '鄉下的路碎石比較多，妳回去小心騎車阿。');
  assert.equal(shop.at(-1).text, '我把鑰匙放回口袋。');
  const all = dayLines().map((b) => b.text);
  for (const old of ['這麼快就決定了阿？', '要不要再考慮幾天？回來這裡喝幾杯咖啡，喝完再決定也不會太慢阿。', '這裡隨時都歡迎妳。', '那我……下次再來。', '德叔看了一眼鑰匙，沒有伸手。']) {
    assert.ok(!all.includes(old), `v5.6 挽留：${old}`);
  }
  assert.equal(D.DAY_ACT_VIEW.d1shop, 'still', '店內環景已拔掉：店裡也是 2D 定景');
  assert.ok(D.SHOP_STILL_ACTS.includes('d1shop'));
  // 畫面：拖向德叔或吧台都回到手上，再出下一句；提示字「把鑰匙拿給德叔」
  assert.equal(KEY_HINT, '把鑰匙拿給德叔');
  if (HAS58) assert.ok(BODY.includes(`提示字「${KEY_HINT}」`));
  const view = code('src/view/days.js');
  assert.match(view, /if \(name === 'keyGive'\) \{[\s\S]*?hint\.textContent = KEY_HINT;[\s\S]*?zone\('to-deshu'\)[\s\S]*?zone\('to-bar'\)/);
  // 關卡：沒拖過去翻不到下一句；拖過去（passGate）才能往下
  const s = S.normalize(at('d1shop', give), SRC);
  assert.equal(S.setOpeningLine(s, give + 1), false, '沒拖鑰匙不能翻頁');
  assert.equal(S.passGate(s, 'keyGive'), true);
  assert.equal(S.setOpeningLine(s, give + 1), true);
});

test('信箱、房東：信箱可點可不點；不點也接到樓梯間拖鞋聲與房東整段（「記得下禮拜要交房租。」不省略），不從信箱直接進房間', () => {
  const town = D.DAY_LINES.d1town;
  const box = town.findIndex((b) => b.text === '信箱是空的，連傳單都沒有。');
  assert.ok(box > 0);
  assert.equal(town[box].ifTap, 'mailbox', '點了信箱才出這一句；不點就跳過這一句');
  assert.equal(town[box].set.place, 'mailbox', '不點也先看到信箱畫面');
  assert.ok(!town[box].optional && !town[box].gate && !town[box].tap);
  // 信箱之後還在同一幕：拖鞋聲 → 房東整段 → 「好，我記得。」，才換到房間
  const after = town.slice(box + 1).map((b) => [b.who, b.text]);
  assert.deepEqual(after, [
    [undefined, '聽到這個拖鞋聲，我就知道是房東。'],
    [undefined, '要是早一分鐘上樓就好了。今天真的沒有力氣站著聽他講話。'],
    ['landlord', '妳怎麼沒去上班？'],
    ['landlord', '現在年輕人齁，動不動就請假……'],
    ['landlord', '我們以前齁，發燒也照樣去上班。'],
    ['me', '剛好有點事情要辦，我先去忙了。'],
    ['landlord', '去吧，看到我就想跑。'],
    [undefined, '被他說中了。我有點不好意思，只好點點頭。'],
    ['landlord', '記得下禮拜要交房租。'],
    ['me', '好，我記得。'],
  ]);
  assert.equal(town[box + 1].set.place, 'stairs');
  assert.equal(S.nextActOf('d1town'), 'd1home');
  // 不點信箱：從信箱那一句直接翻到拖鞋聲（同一幕），一路讀到「記得下禮拜要交房租。」才進房間
  const s = S.normalize(at('d1town', box), SRC);
  assert.equal(S.setOpeningLine(s, box + 1), true);
  const seen = [];
  while (s.opening.act === 'd1town') seen.push(step(s).text);
  assert.ok(seen.includes('記得下禮拜要交房租。'));
  assert.ok(!seen.includes('信箱是空的，連傳單都沒有。'));
  assert.equal(s.opening.act, 'd1home');
  // 畫面：ifTap 的熱點點了才出字；點畫面其他地方就不出這一句、存檔往前接下一句
  const main = code('src/main.js');
  assert.match(main, /if \(b\.ifTap\) \{[\s\S]*?reader\.hot\(\(optional\?\.\(b\.ifTap, b\)[\s\S]*?reader\.next\(\)\.then\(\(v\) => res\(v \? 'skip' : false\)\);[\s\S]*?const n = S\.nextLine\(state\);[\s\S]*?if \(!S\.setOpeningLine\(state, n\)\) return false;\s*save\(\);\s*i = n;\s*continue;/);
  assert.ok(HOT_IDS.mailbox, '信箱有熱點');
});

test('房東只提醒下禮拜交房租；錢是爸開的戶頭、壓歲錢、活存十六萬、提款機補刷；超商下決心「先當實習的老闆」', () => {
  const all = dayLines().map((b) => b.text);
  for (const t of ['這本是……爸幫我開的戶頭。', '裡面存了幾年的壓歲錢，現在只好拿出來用了。', '先去補刷，看看還有多少。', '每一行都是一萬。', '裡面居然有十六萬！', '爸從來沒跟我講過有這麼多。',
    '……可是如果不去，我大概會一直想這件事。', '不然……先試試看好了。', '先當實習的老闆試試看，不適合再說。', '公司那邊，不管適不適合，我都不做了。']) assert.ok(all.includes(t), t);
  // v5.9 三處改句（印章、提款機、超商）
  assert.deepEqual(['……先找看看印章還在嗎。哪天真的要辦離職手續，會用到。', '太好了，就算真的辭職，也不用急著馬上找工作了。', '就算辭職再找一份工作，大概還是這樣吧。'].map((t) => [find(t)?.act, find(t)?.b.who]),
    [['d1home', 'me'], ['d1bank', 'me'], ['d1store', 'me']]);
  for (const old of ['對了，先找看看印章還在嗎，辦離職手續的時候會用到。', '太好了，不用急著馬上找工作了。', '就算再找一份工作，大概還是這樣吧。']) assert.ok(!all.includes(old), `v5.8 舊句：${old}`);
  assert.equal(find('每一行都是一萬。').act, 'd1bank');
  assert.equal(find('每一行都是一萬。').b.tap, 'panelAuto', '提款機：刷存摺分鏡第 1 格進場景自動亮（不佔點擊），原本點存摺放進機器拿掉');
  assert.equal(find('每一行都是一萬。').b.panel, 'sb-atm-1');
  assert.equal(find('……可是如果不去，我大概會一直想這件事。').b.tap, 'pause', '超商：停一拍，點一下才繼續');
  // 房東：沒有當天催繳、沒有當天付清
  for (const w of ['這個月的房租，妳什麼時候要給我', '今天一定拿給您', '這個月的房租，您點一下。', '下個月不要再讓我來討。', '有錢就早點拿出來嘛']) assert.ok(!all.some((t) => t.includes(w)), w);
});

test('承峰 2026-11-22 17:15 核准的三處補句：超商轉場（黑底三句＋進門一句）、斗笠鋪陳、坤伯離開；原句一字不改', () => {
  // 3a. 超商轉場：提款機淡出到黑底，三句在黑底上；第四句淡入超商、進門音效
  const store = D.DAY_LINES.d1store;
  assert.deepEqual(store.slice(0, 5).map((b) => [b.who, b.text]), [
    [undefined, '我離開提款機，往回家的方向走。'],
    [undefined, '外面很熱，走沒多久就一身汗。'],
    [undefined, '前面有一間超商。進去吹個冷氣，順便買瓶水好了。'],
    [undefined, '我才剛走進去，就聽到店裡有人講話很大聲。'],
    ['storeManager', '這個昨天就過期了，你是沒在看喔？'],
  ]);
  assert.equal(store[0].set.place, 'black', '前三句在黑底');
  for (let i = 0; i < 3; i++) assert.equal(OP.sceneAt(store, i).place, 'black', `第 ${i} 句黑底`);
  assert.equal(store[3].set.place, 'store', '第四句淡入超商');
  assert.deepEqual(store[3].sfx, ['chime'], '進門音效移到第四句（超商的進門鈴錄音，不是電梯的 ding）');
  assert.ok(!store[4].sfx && !store[4].set, '店長那句不再帶進門音效、不再換場景');
  for (let i = 3; i < store.length; i++) assert.equal(OP.sceneAt(store, i).place, 'store');
  assert.deepEqual(placesOf(store), ['black', 'store']);
  assert.equal(PLACES.black.src, null, '黑底不用圖');
  assert.equal(ART_MAP[PLACES.black.slot].status, 'none');
  const html = read('index.html');
  assert.match(html, /\.dy-place\[data-place="black"\], \.dy-css\.dy-css-black \{ background: #000; \}/, '黑底是純黑，不是淺色的 .dy-css 底');
  assert.match(html, /\.dy-place \{ position: absolute; inset: 0; opacity: 0; transition: opacity \.9s; \}/, '黑底切到超商有淡入');
  assert.match(code('src/main.js'), /nextAct\(act, act === 'd1bank' \? '#000' : '#1a1612', 750\);/, '提款機 → 超商淡出到黑');
  // 3b. 斗笠鋪陳：德叔「妳等一下。」→ 旁白 → 斗笠小圖與德叔原句
  const cafe = D.DAY_LINES.d5cafe;
  const ask = cafe.findIndex((b) => b.text === '德叔，我去附近問問看，大家為什麼不來喝咖啡。');
  assert.deepEqual(cafe.slice(ask, ask + 4).map((b) => [b.who, b.text]), [
    ['me', '德叔，我去附近問問看，大家為什麼不來喝咖啡。'],
    ['deshu', '妳等一下。'],
    [undefined, '德叔走到門邊，拿了一樣東西回來。'],
    ['deshu', '太陽很大，這頂妳戴著。'],
  ]);
  assert.deepEqual(cafe[ask + 3].set, { mini: 'hat' });
  assert.equal(cafe[ask + 3].tap, 'mini', '斗笠小圖仍要點一下');
  assert.ok(!cafe[ask + 1].set && !cafe[ask + 2].set, '鋪陳兩句不先疊斗笠');
  // 3c. 坤伯離開：「五告讚。」→ 手按肚子 → 「……歹勢，我先來走。」→ 門沒關好（門與風鈴）→ 我「德叔，這一杯其實……」
  const brew = D.DAY_LINES.d5brew;
  const good = brew.findIndex((b) => b.text === '五告讚。');
  assert.deepEqual(brew.slice(good, good + 5).map((b) => [b.who, b.text]), [
    ['kunbo', '五告讚。'],
    [undefined, '話才講完，坤伯的手就按到肚子上。'],
    ['kunbo', '……歹勢，我先來走。'],
    [undefined, '他走得很快，門都沒關好。'],
    ['me', '德叔，這一杯其實……'],
  ]);
  assert.deepEqual(brew[good + 3].sfx, ['door', 'bell'], '推門出去：門與風鈴');
  assert.deepEqual(brew.slice(good + 5, good + 8).map((b) => [b.who, b.text]), [
    ['deshu', '用了坤伯的龍眼乾加上我調配的比例，在這個村里敢說難喝，大概會被趕出村吧。'],
    ['me', '……那我不敢說了。'],
    ['deshu', '我再調調看阿。'],
  ]);
  // 新句旁邊用註解標【待定】，字裡不帶
  const src = read('src/lines/days.js');
  for (const t of ['我離開提款機，往回家的方向走。', '外面很熱，走沒多久就一身汗。', '前面有一間超商。進去吹個冷氣，順便買瓶水好了。', '我才剛走進去，就聽到店裡有人講話很大聲。',
    '妳等一下。', '德叔走到門邊，拿了一樣東西回來。', '話才講完，坤伯的手就按到肚子上。', '……歹勢，我先來走。', '他走得很快，門都沒關好。']) {
    assert.match(src, new RegExp(`text: '${reEsc(t)}'[^\\n]*// 【待定】`), `${t} 旁標【待定】`);
  }
});

test('第二天回咖啡館：鑰匙放到吧台、確認沒找錯人、實習老闆、「我相信妳一定可以的。」；不加人資、濾掛包、銀杏龍眼、親寫鑰匙句、請假日期', () => {
  assert.deepEqual(D.DAY_LINES.d2cafe.map((b) => [b.who, b.text]), [
    [undefined, '戶頭裡有十六萬，我才敢回來這裡。'],
    [undefined, '德叔在吧台後面擦杯子，今天吧台上是空的。'],
    ['me', '德叔，鑰匙我帶來了。'],
    ['me', '我想再確認一次，真的沒有找錯人嗎？'],
    ['me', '我不會泡咖啡，也沒有開過店。'],
    ['deshu', '突然要讓妳當老闆，想必壓力很大吧。'],
    ['deshu', '造成妳的困擾，我很抱歉阿。'],
    ['deshu', '不過這件事情是肯定的，就是妳要來繼承這家咖啡館。'],
    ['me', '那……我有一個想法。'],
    ['me', '我想先當實習老闆。'],
    ['me', '店裡怎麼顧、咖啡怎麼泡，我先把這兩樣學起來。'],
    ['me', '如果做了之後覺得自己不適合，我就不繼承。'],
    ['me', '這樣可以嗎？'],
    ['deshu', '我相信妳一定可以的。'],
  ]);
  assert.equal(find('德叔，鑰匙我帶來了。').b.tap, 'keyBar', '點包包裡的鑰匙，放到吧台上');
  const before5 = D.DAY_ACTS.slice(0, D.DAY_ACTS.indexOf('d5card')).flatMap((a) => D.DAY_LINES[a]).map((b) => b.text).join('\n');
  for (const w of ['銀杏', '濾掛', '人資', '特休', '第幾天', '離職日', '妳是這裡的老闆，鑰匙就交給老闆了']) assert.ok(!before5.includes(w), `三天後之前不該有：${w}`);
  const all = dayLines().map((b) => b.text).join('\n');
  assert.ok(!all.includes('妳是這裡的老闆，鑰匙就交給老闆了，有需要妳隨時可以回來。'), '親寫鑰匙句先不出現');
  // 銀杏龍眼在三天後之後由她提出
  assert.equal(find('就叫銀杏龍眼咖啡。').act, 'd5thanks');
});

test('不再有作廢情節：v4.5（雀斑消失、公司會議、相機）與 v5.7（定存、當天催租付清、再上山存摺放上吧台、人資訊息、濾掛包、騎回租屋處、隔天早上）', () => {
  for (const old of ['d1cafe', 'd1night', 'd2wake', 'd2shop', 'd2town', 'd2night', 'd3wake', 'd3town', 'd3night', 'd4wake', 'd4town', 'd4cafe', 'd4night',
    'd1rent', 'd1dusk', 'd1back', 'd1ride', 'd2home', 'd2back', 'd2ride', 'd3card', 'd3morn']) {
    assert.ok(!D.DAY_ACTS.includes(old), `舊幕 ${old}`);
  }
  const all = dayLines().map((b) => b.text).join('\n');
  for (const w of ['定存', '把存摺放上吧台', '我把存摺拿出來，放在吧台上。', '行員', '資料袋', '樟腦丸', '濾掛', '識別證', '隔天早上，我九點多就到了。', '後來每天都是這樣。',
    '計數窗', '會議室', '第十二頁', '雀斑怎麼不見', '底片', '宜蓁', '協理']) assert.ok(!all.includes(w), w);
  assert.equal(D.PASSBOOK_CHOICES, undefined, '存摺兩個按鈕拿掉');
  assert.ok(!dayLines().some((b) => b.branch || b.sleep || b.mono), '沒有分支、睡著、自白');
  assert.deepEqual(dayLines().filter((b) => b.gate).map((b) => b.gate), ['keyGive'], '關卡只有把鑰匙拖向德叔');
  for (const k of Object.keys(D.DAY_SPEAKERS)) assert.ok(['landlord', 'kunbo', 'storeManager', 'clerk'].includes(k), `多出來的說話人：${k}`);
  // view 不再有 v5.7 的衣櫃、手機、銀行大廳、濾掛包
  const view = code('src/view/days.js');
  assert.doesNotMatch(view, /wardrobe|dy-reply|REPLY_TEXT|dripbag|bagopen|home57|homeDusk|bank:/);
  assert.doesNotMatch(read('index.html'), /\.dy-wardrobe|\.dy-phone|\.pp-dripbag|\.op-ridehome|\.dy-css-bank/);
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
  assert.equal(cueOf({ who: 'deshu', text: '不好意思阿，我手騰不出空間來，妳先留著吧。' }), null, '德叔照舊由店內流程處理');
  assert.equal(cueOf({ who: undefined, text: 'constructor' }), null, '原型上的名字不會被當成台詞差分');
  const main = code('src/main.js');
  assert.match(main, /const cue = cueOf\(b\);[^\n]*\n\s*reader\.portrait\(cue \? cue\.src : null, cue\?\.place, cue\?\.alt\);/, '背景圖的畫面：新角色出半身立繪');
  assert.match(main, /const portrait = day \? \(b\.who === 'deshu' \|\| b\.gate === 'keyGive'\) : lk\.portrait;/, '店裡：德叔說話（與把鑰匙遞給他）出德叔立繪');
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
test('字出來之前要先做的互動（tap）照劇本的順序；可選互動只有水龍頭；信箱可點可不點', () => {
  const taps = dayLines().flatMap(D.tapsOf);
  // 數錢、開抽屜、刷存摺、花斑貓、研發咖啡開頭、紙袋改成分鏡格（承峰 2026-11-24／25）：mini＝格先出點一下才出句；panel＝只在字出來前亮一下；panelAuto＝自動亮
  assert.deepEqual(taps, ['mini', 'mini', 'mini', 'mini', 'panelAuto', 'poster', 'pause', 'keyBar', 'mini', 'calico', 'can', 'mini', 'mini', 'mini', 'panel', 'mini']);
  const tapAt = (t) => find(t).b.tap;
  assert.equal(tapAt('繳完房租，剩下五千塊錢。'), 'mini', '數錢分鏡格');
  assert.equal(tapAt('印章還在。'), 'mini', '開抽屜分鏡格');
  assert.equal(tapAt('每一行都是一萬。'), 'panelAuto', '刷存摺第 1 格自動亮');
  assert.equal(tapAt('領這種餓不死、穿不暖的薪水，還要被這樣罵。'), 'poster', '點徵人海報');
  assert.equal(tapAt('……可是如果不去，我大概會一直想這件事。'), 'pause', '停一拍，點一下才繼續');
  assert.equal(tapAt('德叔，鑰匙我帶來了。'), 'keyBar', '鑰匙放到吧台');
  assert.equal(tapAt('貓走進一戶人家的院子，院子旁邊種了好幾棵龍眼樹。'), 'calico', '點花斑貓跟著走');
  assert.deepEqual(tapAt('坤伯，這上面寫的是農藥。'), ['can', 'mini'], '點空罐子 → 標籤小圖點一下');
  // 可選（不點也能翻頁）
  const opt = dayLines().filter((b) => b.optional);
  assert.deepEqual(opt.map((b) => b.optional), ['faucet']);
  assert.equal(opt[0].text, '水很冰。');
  for (const b of opt) assert.ok(!b.gate && !b.tap, `${b.optional} 不能擋住劇情`);
  assert.deepEqual(dayLines().filter((b) => b.ifTap).map((b) => [b.ifTap, b.text]), [['mailbox', '信箱是空的，連傳單都沒有。']]);
  // 每個熱點都有元素
  for (const n of ['faucet', 'mailbox', 'poster', 'calico', 'can']) assert.ok(HOT_IDS[n], n);
  for (const n of ['wallet', 'deskDrawer', 'atm']) assert.ok(!HOT_IDS[n], `${n} 的程式動作已改成分鏡格`);
  for (const id of Object.values(HOT_IDS)) assert.match(read('src/view/days.js'), new RegExp(`id="${id}"`), id);
});

test('小圖五張：先疊上來（背景不切換）、點一下才出句子、講完收掉', () => {
  const minis = [];
  for (const act of D.DAY_ACTS) {
    const lines = D.DAY_LINES[act];
    lines.forEach((b, i) => {
      if (!D.tapsOf(b).includes('mini')) return;
      const lk = OP.sceneAt(lines, i);
      if (String(lk.mini).startsWith('sb-')) return; // 分鏡格另有測試
      assert.ok(lk.mini, `${act} 第 ${i} 句有小圖`);
      if (i > 0) assert.equal(lk.place, OP.sceneAt(lines, i - 1).place, `${act} 第 ${i} 句：背景不切換`);
      const prevMini = OP.sceneAt(lines, Math.max(0, i - 1)).mini;
      assert.ok(!prevMini || String(prevMini).startsWith('sb-') || i === 0, '前一句還沒有這張小圖（分鏡格講完直接換成小圖可以）');
      const off = lines.findIndex((x, j) => j > i && x.set && 'mini' in x.set && x.set.mini === null);
      assert.ok(off > i || OP.sceneAt(lines, lines.length - 1).mini === lk.mini, `${act}：${lk.mini} 會收掉`);
      minis.push(lk.mini);
    });
    assert.ok(!OP.sceneAt(lines, 0).mini || (act === 'd1bank' && OP.sceneAt(lines, 0).mini === 'sb-atm-2'), `${act} 開頭沒有殘留的小圖（提款機一進場就是刷存摺分鏡格）`);
  }
  assert.deepEqual(minis, ['stain', 'passbook', 'hat', 'label', 'longan']);
  assert.deepEqual(Object.keys(MINI_SLOTS).sort(), ['hat', 'label', 'longan', 'passbook', 'stain']);
  // 水痕：點一下才出下面兩句，兩句講完收掉
  const w = find('窗戶下面那塊水痕好像又比上個月大了一點。');
  assert.equal(OP.sceneAt(D.DAY_LINES.d1home, w.i + 1).mini, 'stain');
  assert.equal(OP.sceneAt(D.DAY_LINES.d1home, w.i + 2).mini, 'sb-wallet', '兩句講完水痕收掉，直接換成數錢分鏡格');
  const view = code('src/view/days.js');
  assert.match(read('index.html'), /<section id="op-prop" hidden><div class="pp-card"><\/div><div class="pp-mini"><\/div>/);
  assert.match(view, /peek\(\) \{/);
  assert.match(view, /const hit = button\('pp-peek', '下一句'\);/);
  const main = code('src/main.js');
  assert.match(main, /for \(const t of tapsOf\(b\)\) \{[\s\S]*?reader\.hideBox\(\);[\s\S]*?const ok = t === 'pause' \? await reader\.next\(\)[\s\S]*?: await tap\?\.\(t, b\);[\s\S]*?\}\s*props\.clear\(\);\s*props\.show\(lk\);/, '小圖／互動做完才出字');
  assert.match(main, /if \(name === 'mini'\) return props\.peek\(\);/);
  for (const k of Object.keys(MINI_SLOTS)) {
    const html = miniHtml(k);
    assert.ok(html.length > 0, k);
    assert.doesNotMatch(html, /hand|pp-can|longanBag|longanJar/, k);
  }
  assert.match(miniHtml('label'), /農藥/, '空罐子的標籤由程式疊「農藥」');
  const css = read('index.html');
  for (const c of ['.pp-passbook {', '.pp-can {', '.pp-card.badge img', '.pp-bag {', '.pp-camera {']) assert.ok(css.includes(c), `既有特寫卡 ${c}`);
});

test('分鏡格八組（承峰 2026-11-24 提案、11-25 定版）：掛在提案定的句子、一場最多一組、一次最多連亮 2 格（刷存摺 3 格例外）、講完收掉', async () => {
  const V = await import('../../src/view/days.js');
  const H = await import('../../src/view/hints.js');
  assert.deepEqual(Object.keys(V.STORYBOARDS).sort(), ['atm', 'brew', 'calico', 'cat', 'drawer', 'envelope', 'paperbag', 'wallet']);
  const FILES = { envelope: 'sb_envelope_open_v1', wallet: 'sb_wallet_count_v1', drawer: 'sb_drawer_seal_v2', atm: 'sb_atm_passbook_strip_v2',
    calico: 'sb_calico_paw_v1', brew: 'sb_brew_cups_v2', paperbag: 'sb_paperbag_writing_v2', cat: 'sb_cat_approach_strip_v1' };
  for (const [k, f] of Object.entries(FILES)) {
    const sb = V.STORYBOARDS[k];
    assert.equal(srcOf(sb.slot), `art-v56/S/${f}`, k);
    assert.equal(ART_MAP[sb.slot].status, 'ready', k);
    const n = sb.panels;
    assert.deepEqual(webpSize(readFileSync(root(artUrl(srcOf(sb.slot))))), [2048, n * 1536 + (n - 1) * 64], `${k}：每格 2048×1536、直排格距 64`);
  }
  // 淘汰的版本不進遊戲
  for (const old of ['sb_drawer_seal_v1', 'sb_paperbag_writing_v1', 'sb_brew_cups_strip_v1', 'sb_brew_cups_strip_v2', 'sb_atm_passbook_strip_v1']) {
    assert.ok(!existsSync(root(`assets/art-v56/S/${old}.webp`)), `${old} 不該進遊戲`);
    assert.ok(!ART_MAP_FILES.some((r) => r.endsWith(old)), old);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(V.STORYBOARDS).map(([k, v]) => [k, v.panels])), { envelope: 1, wallet: 1, drawer: 1, atm: 3, calico: 1, brew: 1, paperbag: 1, cat: 2 });
  assert.deepEqual(V.parseSb('sb-atm-2'), { name: 'atm', lit: 2 });
  assert.deepEqual(V.parseSb('sb-wallet'), { name: 'wallet', lit: 1 });
  assert.equal(V.parseSb('stain'), null);
  // 掛在哪一句（照提案的【分鏡｜待定】位置）：mini＝格先出、點一下才出這句；panel＝只在這句字出來前亮；panelAuto＝自動亮
  const all = [...D.DAY_ACTS.flatMap((act) => D.DAY_LINES[act].map((b, i) => ({ act, i, b, lines: D.DAY_LINES[act] }))),
    ...Object.entries(OP.OPENING_LINES).flatMap(([act, ls]) => ls.map((b, i) => ({ act, i, b, lines: ls })))];
  const at = (t) => all.find((x) => x.b.text === t);
  const hang = [
    ['繳完房租，剩下五千塊錢。', 'mini', 'sb-wallet'],
    ['印章還在。', 'mini', 'sb-drawer'],
    ['每一行都是一萬。', 'panelAuto', 'sb-atm-1'],
    ['欸，這個不是給你吃的啦。', 'mini', 'sb-calico'],
    ['第一版好了，妳喝喝看。', 'panel', 'sb-brew'],
    ['好，我帶去公司。', 'mini', 'sb-paperbag'],
    ['然後他整個身體靠上來，從頭到尾巴在我小腿上蹭過去，掉頭再蹭一次。', 'mini', 'sb-cat-1'],
    ['那隻貓叫龍眼，是這間三合院的主人，而妳是新老闆。', 'panel', 'sb-cat-2'],
  ];
  for (const [t, tap, sb] of hang) {
    const x = at(t);
    assert.ok(x, t);
    assert.equal(x.b.tap, tap, t);
    assert.equal(tap === 'mini' ? OP.sceneAt(x.lines, x.i).mini : x.b.panel, sb, t);
    if (tap === 'panel') assert.ok(!OP.sceneAt(x.lines, x.i).mini, `${t}：亮完收起才出字`);
  }
  assert.equal(at('每一行都是一萬。').act, 'd1bank');
  assert.equal(at('第一版好了，妳喝喝看。').act, 'd5brew');
  // 刷存摺：第 2 格跟「每一行都是一萬。」等三句，第 3 格跟「裡面居然有十六萬！」，吐一口氣那句收掉
  const bank = D.DAY_LINES.d1bank;
  assert.deepEqual(bank.map((b, i) => OP.sceneAt(bank, i).mini), ['sb-atm-2', 'sb-atm-2', 'sb-atm-2', 'sb-atm-3', 'sb-atm-3', 'sb-atm-3', null]);
  // 研發咖啡：只在開頭亮一次（承峰拿掉第 2 格，「越排越多」只靠文字）
  const brew = D.DAY_LINES.d5brew;
  assert.equal(brew.filter((b) => b.panel || String(b.set?.mini || '').startsWith('sb-brew')).length, 1);
  // 一場最多一組；一次最多連亮 2 格（刷存摺例外）
  const acts = new Map();
  for (const x of all) {
    const m = [x.b.panel, x.b.set?.mini].filter((v) => String(v || '').startsWith('sb-'));
    for (const v of m) { const set = acts.get(x.act) || new Set(); set.add(V.parseSb(v).name); acts.set(x.act, set); }
  }
  // 例外（都是承峰定的位置）：房間盤點（d1home）數錢格與抽屜格兩組都留（2026-11-24「開抽屜格留」，提案「這場每處只留 1 格」）；
  // 研發咖啡（d5brew）開頭咖啡五杯與段末紙袋，一頭一尾、中間隔了整段戲（紙袋 11-24 21:36 定、咖啡 21:53 定）
  const TWO = { d1home: ['drawer', 'wallet'], d5brew: ['brew', 'paperbag'] };
  for (const [act, set] of acts) assert.deepEqual([...set].sort(), TWO[act] || [...set].slice(0, 1), `${act} 一場最多一組分鏡：${[...set]}`);
  for (const [k, v] of Object.entries(V.STORYBOARDS)) assert.ok(v.panels <= 2 || k === 'atm', `${k} 一次最多連亮 2 格`);
  // 講完收掉：每一組在幕內會收掉，或換成下一張小圖
  for (const x of all) {
    if (x.b.tap !== 'mini' || !String(OP.sceneAt(x.lines, x.i).mini).startsWith('sb-')) continue;
    const later = x.lines.slice(x.i + 1).find((b) => b.set && 'mini' in b.set);
    assert.ok(later || x.i === x.lines.length - 1, `${x.b.text}：分鏡格會收掉（幕的最後一句：換幕時 props.hide() 收掉）`);
  }
  // 原本的程式動作拿掉：CSS 錢包、抽屜、存摺一行一行印、CSS 紙袋、點存摺放進提款機
  const view = code('src/view/days.js');
  for (const w of ['dy-wallet', 'dy-ddrawer', "printing:", "paperbag: () =>", "name === 'atm'", "isBook ? 'book' : 'key'"]) assert.ok(!view.includes(w), `view/days.js 還有 ${w}`);
  const css = read('index.html');
  for (const w of ['.dy-wallet', '.dy-ddrawer', '.pp-passbook.printing', '.pp-paperbag', '.op-env.pulled']) assert.ok(!css.includes(w), `index.html 還有 ${w}`);
  assert.doesNotMatch(code('src/main.js'), /props\.tapItem\('atm'\)/);
  // 顯示：橫式 4:3、寬度同小圖、直排太高時依畫面高度縮
  assert.match(css, /\.pp-mini\.sb \{[^}]*width: min\(64vw, 250px, calc\(54dvh \/ var\(--r, \.75\)\)\);/);
  assert.match(css, /\.pp-mini\.sb > \.sb-cell \{[^}]*aspect-ratio: 4 \/ 3;/);
  assert.match(V.storyboardHtml('atm', 1), /class="sb-cell lit" data-panel="1"[\s\S]*class="sb-cell" data-panel="2"[\s\S]*class="sb-cell" data-panel="3"/);
  // 提示字：分鏡格沿用「點一下繼續」，不另寫新字；自動亮的不出提示
  assert.equal(H.tapHint('mini', { mini: 'sb-wallet' }), '點一下繼續');
  assert.equal(H.tapHint('panel'), '點一下繼續');
  assert.equal(H.tapHint('panelAuto'), null);
});

test('程式疊字：徵人海報「誠徵門市人員」（劇本沒寫薪資數字，不疊薪水）、空罐子「農藥」、紙袋「提神醒腦，過目不忘」', () => {
  assert.equal(OVERLAY_TEXT.poster, '誠徵門市人員');
  assert.doesNotMatch(OVERLAY_TEXT.poster, /\d|元|薪/);
  if (HAS58) assert.ok(BODY.includes('上面寫「誠徵門市人員」和薪水'));
  assert.equal(OVERLAY_TEXT.label, '農藥');
  // 紙袋改成分鏡格（字畫進圖，承峰 2026-11-25 定版 v2：兩行、不加標點），程式不再疊字、不再有 CSS 紙袋
  assert.ok(!('paperbag' in OVERLAY_TEXT), '紙袋不再由程式疊字');
  assert.ok(!find('「提神醒腦，過目不忘」').b.set, '「提神醒腦，過目不忘」這句不再疊 CSS 紙袋');
  assert.equal(find('好，我帶去公司。').b.set.mini, 'sb-paperbag');
  assert.equal(find('領這種餓不死、穿不暖的薪水，還要被這樣罵。').b.set.prop, 'poster');
  const view = read('src/view/days.js');
  assert.match(view, /poster: \(\) => `<div class="pp-poster"><span class="pp-overlay">\$\{esc\(OVERLAY_TEXT\.poster\)\}<\/span><\/div>`/);
  // 場景上的海報：底圖座位區後牆上那張有框的空白海報（熱點對準外框）；字仍是程式疊「誠徵門市人員」
  assert.match(view, /<div class="dy-poster" id="dy-poster"><span class="pp-overlay">\$\{esc\(OVERLAY_TEXT\.poster\)\}<\/span><\/div>/);
});

test('店內環景與「看看店裡／回座位」已拔掉（承峰 2026-11-21 20:48）：沒有按鈕、沒有環景；點椅子坐下改在 2D 定景上點', () => {
  const main = code('src/main.js');
  const html = read('index.html');
  for (const w of ['看看店裡', '回座位', '點「看看店裡」，可以四處看看。', 'SHOP_LOOK', 'shopLookOn', 'enterShopLook', 'exitShopLook', 'SIT_YAW', 'turnTo', 'Pano', 'pano', 'enterLook']) {
    assert.ok(!main.includes(w), `main.js 還有 ${w}`);
  }
  for (const id of ['id="pano"', 'id="shop-look"', 'id="shop-back"', 'id="shop-look-hint"', 'id="look"', 'id="st-look"', '左右拖曳看看店裡', '#pano', '.shop-look', '.shop-back']) {
    assert.ok(!html.includes(id), `index.html 還有 ${id}`);
  }
  for (const f of ['src/view/pano.js', 'src/view/scenes.js', 'src/view/shop.js']) assert.ok(!existsSync(root(f)), `${f} 應該刪掉`);
  // 店裡的幕都是 2D 定景（still）；第一天起的店裡第一句 place 是 shop
  for (const a of ['d1shop', 'd2cafe', 'd5cafe', 'd5thanks', 'd5brew']) {
    assert.equal(D.DAY_ACT_VIEW[a], 'still', a);
    assert.equal(D.DAY_LINES[a][0].set.place, 'shop', a);
  }
  assert.deepEqual(D.SHOP_STILL_ACTS, ['d1shop', 'd2cafe', 'd5cafe', 'd5thanks', 'd5brew']);
  assert.ok(!Object.values(D.DAY_ACT_VIEW).includes('shop'));
  for (const b of [...dayLines(), ...Object.values(OP.OPENING_LINES).flat()]) assert.ok(!b.set || !('yaw' in b.set), `還有環景角度：${b.text}`);
  // 點椅子坐下：2D 熱點（必做，不加「也可以直接翻頁」），點了才進坐下喝咖啡；不自動坐下、不轉鏡頭
  if (HAS58) assert.ok(V58.includes('「點椅子坐下」'));
  assert.match(main, /if \(act === 'sit'\) \{[\s\S]*?reader\.hot\(\[\{ id: 'chair', label: '椅子', need: true, rect: elRect\(shop\.hot\('chair'\)\),[\s\S]*?nextAct\('sit', '#3a2a20'\);/);
});

test('點擊提示字（通用提示規則，承峰 23:14 照建議稿補齊）：必做不加小字；可選加「（也可以直接翻頁）」；字集中在 view/hints.js', async () => {
  const H = await import('../../src/view/hints.js');
  assert.deepEqual(H.MUST_HINTS, {
    door: '把門推開', hold: '按住畫面，往前騎', fork: '點左邊或右邊的路', chair: '點椅子坐下', keyGive: '把鑰匙拿給德叔', keyBar: '把鑰匙放到吧台',
    poster: '點座位區的徵人海報', pause: '點一下繼續',
    calico: '點花斑貓，跟著走', can: '點地上的空罐子',
  });
  assert.deepEqual(H.MINI_HINTS, { stain: '點窗戶下面的水痕', passbook: '點存摺', hat: '點斗笠', label: '點標籤', longan: '點龍眼乾' });
  assert.deepEqual(H.OPTIONAL_HINTS, {
    cat: '摸摸龍眼（也可以直接翻頁）', bed: '點床躺下（也可以直接翻頁）', cup: '點杯子喝一口（也可以直接翻頁）',
    faucet: '點水龍頭洗臉（也可以直接翻頁）', mailbox: '點信箱看看（也可以直接上樓）',
  });
  assert.equal(H.POSTER_HINT, '點座位區的徵人海報', '定版超商圖有座位區，海報在座位區後牆上');
  assert.equal(KEY_HINT, H.MUST_HINTS.keyGive);
  for (const t of [...Object.values(H.MUST_HINTS), ...Object.values(H.MINI_HINTS)]) assert.doesNotMatch(t, /也可以直接/, `必做不加小字：${t}`);
  assert.deepEqual(H.splitHint('摸摸龍眼（也可以直接翻頁）'), ['摸摸龍眼', '（也可以直接翻頁）']);
  assert.deepEqual(H.splitHint('點一下繼續'), ['點一下繼續', '']);
  // 每個 tap、gate、可選互動都有提示字（keyGive 由 props.gate 自己畫）
  for (const b of dayLines()) {
    for (const t of D.tapsOf(b)) if (t !== 'panelAuto') assert.ok(H.tapHint(t, OP.sceneAt(D.DAY_LINES[find(b.text).act], find(b.text).i)), `${t}：${b.text}`); // panelAuto 自動亮、不用點，沒有提示
    if (b.optional) assert.ok(H.HOT_HINTS[b.optional], b.optional);
    if (b.ifTap) assert.ok(H.HOT_HINTS[b.ifTap], b.ifTap);
  }
  for (const b of Object.values(OP.OPENING_LINES).flat()) {
    if (b.gate && b.gate !== 'turnback') assert.ok(H.GATE_HINTS[b.gate], b.gate);
    if (b.optional) assert.ok(H.HOT_HINTS[b.optional], b.optional);
  }
  const { HOT_HINTS } = await import('../../src/view/reader.js');
  assert.equal(HOT_HINTS, H.HOT_HINTS, '閱讀框用同一份');
  const main = code('src/main.js');
  assert.match(main, /reader\.hint\(tapHint\(t, shown\)\);/);
  assert.match(main, /reader\.hint\(GATE_HINTS\[b\.gate\]\);/);
  assert.match(read('index.html'), /#op-read \.opr-hint small \{/);
  assert.match(read('index.html'), /\.opr-hotspot::after \{ content: "▼";/, '熱點有箭頭');
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
  assert.equal(S.nextActOf('room'), 't1card', '第一晚睡著 → 字卡「我單方面辭退老闆前 1 天」');
  assert.equal(S.nextActOf('t1card'), 'd1wake');
  assert.equal(S.nextActOf('d5brew'), S.END_ACT, '研發咖啡之後是待續（公司那場不寫）');
  assert.equal(S.nextActOf(S.END_ACT), null);
  for (const b of dayLines()) assert.ok(seen.includes(b), `沒讀到：${b.text}`);
  assert.deepEqual(D.DAY_ACTS, ['t1card', 'd1wake', 'd1shop', 'd1town', 'd1home', 'd1bank', 'd1store', 't0card', 'resend', 'd2card', 'd2cafe', 'd5card', 'd5cafe', 'd5village', 'd5thanks', 'd5brew']);
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
  assert.equal(back.opening.act, 't1card', '睡著存成字卡「前 1 天」（字卡之後是第一天早上）');
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
    r.show({ text: '棉被真的有曬過，德叔沒有騙我。', mono: true });
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
  assert.match(css, /right: 58px/, '右上角讓出靜音鍵（#mute，44px）的位置'); // 【待定】
  assert.match(css, /min-height: 44px/);
  assert.match(css, /pointer-events: auto/);
  assert.doesNotMatch(css, /bottom:/, '不靠近下方的閱讀框');
  const reader = read('src/view/reader.js');
  assert.match(reader, /if \(!pending \|\| e\.target\.closest\('\.opr-hotspot, \.opr-skip'\)\) return;/, '點按鈕不會順便翻一句');
  assert.match(code('src/main.js'), /reader\.skip\(!!b\.mono\);/, '只在自白（mono）的句子出現');
});

/* ---------- 舊存檔相容 ---------- */
test('舊存檔：v4.5 與 v5.7（未提交版）的幕名接到新流程（不卡住）；舊待續 end 接到第一天早上；舊的存摺選擇不保留', () => {
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
  assert.equal(S.LEGACY_ACTS.d1night, 'd1store', '同一天超商，不回辦公室');
  assert.equal(S.LEGACY_ACTS.d4night, 'd1wake');
  for (const old of ['d2wake', 'd2shop', 'd2town', 'd2night', 'd3wake', 'd3shop', 'd3town', 'd3cafe', 'd3night', 'd4wake', 'd4shop', 'd4town', 'd4cafe', 'd4night']) {
    assert.equal(S.LEGACY_ACTS[old], 'd1wake', `${old} 從第一天早上重走`);
  }
  // v5.7（中途停下、未提交）的幕：照劇情位置接到 v5.8 最近的下一幕
  assert.deepEqual(
    Object.fromEntries(['d1rent', 'd1dusk', 'd1back', 'd1ride', 'd2home', 'd2back', 'd2ride', 'd3card', 'd3morn'].map((k) => [k, S.LEGACY_ACTS[k]])),
    { d1rent: 'd1store', d1dusk: 'd1store', d1back: 'd1store', d1ride: 't0card', d2home: 't0card', d2back: 'd2cafe', d2ride: 'd5card', d3card: 'd5card', d3morn: 'd5card' },
  );
  assert.ok(!('d2cafe' in S.LEGACY_ACTS), 'd2cafe 跟新版同名，不放在對照表');
  // d2cafe 同名：新版存檔（沒有 passbook）照原樣；v4.5 舊檔（有 passbook，就算是 null）接到第一天早上
  const fresh = S.playable(S.normalize(at('d2cafe', 3, { fork: 'right', resignation: 'fire' }), SRC));
  assert.equal(fresh.opening.act, 'd2cafe', '新版「第二天・回咖啡館」不被誤傷');
  assert.equal(fresh.opening.line, 3);
  assert.equal(S.isLegacyD2cafe(at('d2cafe', 3)), false);
  for (const passbook of ['show', 'hide', null]) {
    const raw = at('d2cafe', 7, { passbook, fork: 'left' });
    assert.equal(S.isLegacyD2cafe(raw), true);
    const o = S.playable(S.normalize(raw, SRC));
    assert.equal(o.opening.act, 't1card', `舊 d2cafe（passbook=${passbook}）：第一晚之後（字卡「前 1 天」→ 第一天早上）`);
    assert.equal(o.opening.line, 0);
    assert.equal(o.opening.fork, 'left');
    assert.ok(!('passbook' in o.opening));
    walk(o, { stop: S.isOpeningEnd });
  }
  assert.equal(reload(fresh).opening.act, 'd2cafe');
  // 舊待續（第一晚已結束）：不卡在待續、不重開，接到第一晚之後（字卡「前 1 天」→ 第一天早上）
  for (const raw of [at('end', 0), at('end', 7), { ...at('end', 0), opening: { act: 'end', resignation: 'fire', fork: 'left', deshuLine: 3 } }]) {
    const r = S.playable(S.normalize(raw, SRC));
    assert.equal(r.opening.act, 't1card');
    assert.equal(r.opening.line, 0);
    assert.equal(S.isOpeningEnd(r), false);
  }
  // 沿用的幕名：句子進度夾在新的句數之內（v5.6 存檔停在 d1shop 後段、d1town 信箱之後，照樣讀得回來、走得完）
  let r = S.normalize(at('d1town', 999), SRC);
  assert.equal(r.opening.line, D.DAY_LINES.d1town.length - 1);
  r = S.normalize(at('d2card', 3), SRC);
  assert.equal(r.opening.line, 0, '字卡沒有句子');
  for (const [act, line] of [['d1shop', 14], ['d1wake', 5], ['d1town', 2], ['coffee', 12], ['ride', 2], ['stay', 7], ['room', 8], ['mailbox', 0], ['letter', 0]]) {
    const o = S.playable(S.normalize(at(act, line, { fork: 'left' }), SRC));
    assert.equal(o.opening.act, act);
    walk(o, { stop: S.isOpeningEnd });
  }
  // 開場中途：原幕原句
  r = S.playable(S.normalize(at('deshu', 12), SRC));
  assert.equal(r.opening.act, 'deshu');
  assert.equal(r.opening.line, 12);
  // fake localStorage：舊檔存進去、讀回接得上
  const st = fakeStorage();
  st.setItem(SAVE_KEY, JSON.stringify(at('d3town', 40)));
  assert.equal(S.playable(load(SRC, st)).opening.act, 'd1wake');
  st.setItem(SAVE_KEY, JSON.stringify(at('d2back', 9)));
  assert.equal(S.playable(load(SRC, st)).opening.act, 'd2cafe', 'v5.7 第二天回店 → v5.8 第二天回咖啡館');
  assert.equal(S.playable(S.normalize(at('d2card', 0), SRC)).opening.act, 't0card', '版本 1 停在原「第二天」開頭：對到歸零字卡之前，補看接回場');
  assert.equal(S.playable(S.normalize({ ...at('d2card', 0), v: 2 }, SRC)).opening.act, 'd2card', '版本 2 的字卡「第二天」照原樣');
  assert.deepEqual(S.playable(S.normalize({ ...at('d3town', 4), phase: 'story' }, SRC)), S.newStoryState());
  assert.deepEqual(S.normalize({ v: 99, phase: 'opening', opening: { act: 'd2cafe' } }, SRC), S.newStoryState(), '版本不是 1、2 才重來');
  assert.equal(S.SCHEMA, 2);
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
    // 新圖只放 assets/art-v56/；例外：白天店內圖 bg_shop_day（承峰 2026-11-22 17:20）、傍晚店內圖 bg_shop_dusk（19:16）在 assets/art-v59/
    if (s.dir) assert.ok(s.dir.startsWith('art-v56/') || (['bg_shop_day', 'bg_shop_dusk'].includes(id) && s.dir === 'art-v59'), `${id}：新圖只放 assets/art-v56/（白天／傍晚店內圖在 art-v59）`);
  }
  for (const n of ART_MAP_FILES) assert.ok(has(n), n);
  assert.equal(artUrl('scene_county_road'), 'assets/art/scene_county_road.webp', '舊圖仍在 assets/art/');
  assert.equal(artUrl('art-v56/B/bg_v56_store_interior_seating_portrait'), 'assets/art-v56/B/bg_v56_store_interior_seating_portrait.webp');
  const BG = { bg_room_morning: 'bg_v56_hulong_morning_portrait', bg_stairs: 'bg_v56_stairwell_portrait', bg_home: 'bg_v56_rental_room_day_portrait', bg_atm: 'bg_v56_bank_atm_portrait',
    bg_store: 'bg_v56_store_interior_seating_portrait', bg_village: 'bg_v56_village_lane_portrait_v2', bg_kunyard: 'bg_v56_kunbo_yard_portrait' };
  for (const [id, f] of Object.entries(BG)) {
    assert.equal(ART_MAP[id].status, 'ready', id);
    assert.equal(srcOf(id), `art-v56/B/${f}`, id);
    assert.deepEqual(webpSize(readFileSync(root(artUrl(srcOf(id))))), [1170, 2532], `${f} 是直式 1170×2532`);
  }
  // v5.8 第二幕的房間：暫代第一天的房間原圖（劇本：畫面同第一天的房間）；信封 CSS
  assert.equal(ART_MAP.bg_letter_room.status, 'temp');
  assert.equal(srcOf('bg_letter_room'), srcOf('bg_home'));
  assert.match(read('src/view/opening.js'), /artUrl\(srcOf\('bg_letter_room'\)\)/);
  assert.equal(ART_MAP.pp_envelope.status, 'temp');
  for (const k of ['stairs', 'home', 'atm', 'store', 'village', 'kunyard']) assert.ok(PLACES[k].src, `${k} 不再是 CSS 中性底`);
  assert.doesNotMatch(read('index.html'), /\.dy-css-(stairs|atm|store|village|kunyard)/, 'CSS 中性底拿掉');
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
  const MINI = { mini_stain: 'prop_v56_water_stain_v2', mini_passbook: 'prop_v56_passbook_drawer_v2', mini_hat: 'prop_v56_douli_v2', mini_label: 'prop_v56_empty_can_label_v2', mini_longan: 'prop_v56_dried_longan_v2' };
  for (const [id, f] of Object.entries(MINI)) { assert.equal(ART_MAP[id].status, 'ready', id); assert.equal(srcOf(id), `art-v56/C/${f}`); }
  for (const k of Object.values(MINI_SLOTS)) assert.ok(ART_MAP[k], k);
  assert.match(ART_MAP.mini_label.use, /農藥/);
  assert.deepEqual(webpSize(readFileSync(root(artUrl(srcOf('mini_label'))))), [1024, 1024], '空罐子小圖是正方形（疊字座標以 1024×1024 量）');
  assert.match(miniHtml('label'), /assets\/art-v56\/C\/prop_v56_empty_can_label_v2\.webp[\s\S]*mn-on-art[^>]*>農藥</, '標籤留白處由程式疊「農藥」');
  assert.match(read('index.html'), /\.pp-mini\.mini-label \.mn-on-art \{ left: 48\.6%; top: 68%;/);
  // 超商定版圖（承峰 2026-11-22「超商圖定版」）：bg_store 改指 _seating_；舊圖原樣留在磁碟、不再引用
  assert.deepEqual(webpSize(readFileSync(root('assets/art-v56/B/bg_v56_store_interior_seating_portrait.webp'))), [1170, 2532]);
  assert.ok(existsSync(root('assets/art-v56/B/bg_v56_store_interior_portrait.webp')), '舊超商圖留在磁碟（不刪）');
  assert.ok(!DAY_ART.includes('bg_v56_store_interior_portrait') && !DAY_ART.some((s) => s.endsWith('/bg_v56_store_interior_portrait')), '不再預載舊超商圖');
  assert.doesNotMatch(read('src/view/art-map.js'), /src: 'bg_v56_store_interior_portrait'/);
  // 徵人海報：熱點對準座位區後牆海報外框（原圖 x348–646、y569–977），字疊在紙面（x358–638、y580–967）；不再疊 CSS 白紙／膠帶／旋轉
  const html = read('index.html');
  assert.match(html, /\.dy-poster \{ position: absolute; left: 29\.744%; top: 22\.472%; width: 25\.47%; height: 16\.114%;/);
  assert.match(html, /\.dy-poster \.pp-overlay \{ position: absolute; left: 3\.356%; top: 2\.696%; right: 2\.685%; bottom: 2\.451%;/);
  assert.doesNotMatch(html, /\.dy-poster::before/, '不再有膠帶');
  assert.doesNotMatch(html, /\.dy-poster \{[^}]*(background|rotate)/, '不再疊白紙、不旋轉');
  assert.doesNotMatch(html, /left: 88\.6%; top: 23%; width: 9\.6%; height: 9\.2%/, '舊右側牆小白紙的位置拿掉');
  assert.doesNotMatch(html, /left: 29\.5%; top: 22\.4%; width: 59\.1%/);
  // 第一天的空信箱：定版圖 scene_mailboxes_empty（1950×1200 橫圖，門都關著、沒信封）；不再引用帶信封的 scene_mailboxes.webp（檔案原樣留著）
  assert.equal(ART_MAP.bg_mailbox.status, 'ready');
  assert.equal(ART_MAP.bg_mailbox.src, 'scene_mailboxes_empty');
  assert.equal(ART_MAP.bg_mailbox.dir, undefined, '放在 assets/art/');
  assert.equal(PLACES.mailbox.src, 'scene_mailboxes_empty');
  assert.equal(PLACES.mailbox.fit, 'mbox', '信箱這一幕用專用橫式圖框');
  assert.equal(artUrl(PLACES.mailbox.src), 'assets/art/scene_mailboxes_empty.webp');
  assert.deepEqual(webpSize(readFileSync(root('assets/art/scene_mailboxes_empty.webp'))), [1950, 1200]);
  assert.equal(readFileSync(root('assets/art/scene_mailboxes.webp')).length, 172384, '舊的帶信封圖原樣留著（不覆寫）');
  assert.ok(DAY_ART.includes('scene_mailboxes_empty') && !DAY_ART.includes('scene_mailboxes'), '預載新圖、不預載舊圖');
  assert.ok(!ART_MAP_FILES.includes('scene_mailboxes'), '對照表不再引用 scene_mailboxes.webp');
  const srcAll = ['src/view/days.js', 'src/view/art-map.js', 'src/view/hints.js', 'src/lines/days.js', 'src/main.js', 'index.html'].map(code).join('\n'); // 去掉 // 註解（註解裡會寫「不再用 scene_mailboxes.webp」）
  assert.doesNotMatch(srcAll, /scene_mailboxes(?!_empty)['"`.]/, '程式與樣式都不引用 scene_mailboxes.webp');
  assert.doesNotMatch(read('src/view/days.js') + read('index.html'), /dy-slip|dy-mbwall|dy-css-mailbox/, '打開後不出信封、不出單子；CSS 信箱牆拿掉了');
  // 橫式圖框：1950/1200、整張放進框裡（contain），熱點百分比相對原圖
  assert.match(read('index.html'), /\.dy-place\.mbox \.op-art \{[^}]*aspect-ratio: 1950 \/ 1200;/);
  assert.match(read('index.html'), /\.dy-place\.mbox \.op-art-img \{ object-fit: contain; \}/);
  // 可點的那一格：中間偏右、第 3 列（從 0 算）第 6 欄，原圖約 x 1183–1375、y 620–738
  assert.deepEqual(MAILBOX_HOT_CELL, { left: 60.7, top: 51.7, width: 9.8, height: 9.8 });
  assert.ok(Math.abs(MAILBOX_HOT_CELL.left - (1183 / 1950) * 100) < 0.5 && Math.abs(MAILBOX_HOT_CELL.top - (620 / 1200) * 100) < 0.5);
  assert.ok(Math.abs(MAILBOX_HOT_CELL.width - (192 / 1950) * 100) < 0.5 && Math.abs(MAILBOX_HOT_CELL.height - (118 / 1200) * 100) < 0.5);
  assert.ok(MAILBOX_PAD > 0 && MAILBOX_PAD <= 2, '熱點比格子略大，方便點');
  assert.match(read('src/view/days.js'), /<div class="dy-mailslot" id="dy-mailslot" style="\$\{hit\}"><span class="dy-mb-hole" style="\$\{hole\}" aria-hidden="true"><span class="dy-mb-door"><\/span><\/span><\/div>/);
  assert.match(read('index.html'), /\.dy-place\.open \.dy-mb-hole \{ opacity: 1; \}/, '打開後是深色空格口');
  assert.match(read('index.html'), /\.dy-place\.open \.dy-mb-door \{ transform: rotateY\(-72deg\); \}/);
  // 店內 2D 定景：進門／站著用定版圖 scene_shop_interior_night_lit_v2（承峰 2026-11-21 23:47「店內圖定版」）；
  // 早上用白天正式圖 art-v59/scene_shop_interior_day_v1（承峰 2026-11-22 17:20）；坐下喝咖啡用靠窗特寫（換圖只改 art-map.js 的 src）
  assert.equal(ART_MAP.bg_shop_night.src, 'scene_shop_interior_night_lit_v2');
  assert.equal(ART_MAP.bg_shop_night.status, 'ready');
  assert.ok(!/佔位|重畫中/.test(JSON.stringify(ART_MAP.bg_shop_night)), '定版圖不再寫佔位／重畫中');
  assert.equal(ART_MAP.bg_shop_day.status, 'ready');
  assert.equal(ART_MAP.bg_shop_day.dir, 'art-v59');
  assert.equal(ART_MAP.bg_shop_day.src, 'scene_shop_interior_day_v1', '早上不再用夜景');
  assert.ok(!('temp' in ART_MAP.bg_shop_day) && !/早上正式圖未到/.test(JSON.stringify(ART_MAP.bg_shop_day)), '不再寫暫代');
  assert.equal(srcOf('bg_shop_day'), 'art-v59/scene_shop_interior_day_v1');
  assert.equal(artUrl(srcOf('bg_shop_day')), 'assets/art-v59/scene_shop_interior_day_v1.webp');
  assert.deepEqual(webpSize(readFileSync(root('assets/art-v59/scene_shop_interior_day_v1.webp'))), [1170, 2532], '白天店內圖是直式 1170×2532');
  // 傍晚店內正式圖 art-v59/scene_shop_interior_dusk_v1（承峰 2026-11-22 19:16「傍晚店內圖可以，接進遊戲」）：坤伯答謝開頭
  assert.equal(ART_MAP.bg_shop_dusk.status, 'ready');
  assert.equal(ART_MAP.bg_shop_dusk.dir, 'art-v59');
  assert.equal(ART_MAP.bg_shop_dusk.src, 'scene_shop_interior_dusk_v1');
  assert.ok(!('temp' in ART_MAP.bg_shop_dusk));
  assert.equal(srcOf('bg_shop_dusk'), 'art-v59/scene_shop_interior_dusk_v1');
  assert.equal(artUrl(srcOf('bg_shop_dusk')), 'assets/art-v59/scene_shop_interior_dusk_v1.webp');
  assert.deepEqual(webpSize(readFileSync(root('assets/art-v59/scene_shop_interior_dusk_v1.webp'))), [1170, 2532], '傍晚店內圖是直式 1170×2532');
  assert.match(ART_MAP.bg_shop_night.use, /答謝天暗之後/);
  assert.equal(ART_MAP.bg_shop_seated.src, 'scene_v3b_shop_window_night_seated', '坐下喝咖啡仍用靠窗特寫');
  // 夜景只接 v2 這一張（art-1121 的第一版店內圖不進專案）；白天、傍晚圖在 art-v59，不進 assets/art
  assert.deepEqual(ART_MAP_FILES.filter((r) => /scene_shop_interior/.test(r)).sort(), ['art-v59/scene_shop_interior_day_v1', 'art-v59/scene_shop_interior_dusk_v1', 'scene_shop_interior_night_lit_v2']);
  assert.deepEqual(readdirSync(root('assets/art')).filter((f) => /^scene_shop_interior/.test(f)), ['scene_shop_interior_night_lit_v2.webp'], '只有定版 v2 在 assets/art/');
  assert.ok(!('ui_shop_look' in ART_MAP) && !('bg_shop' in ART_MAP), '環景與「看看店裡」的格子拿掉');
  const view = code('src/view/days.js');
  assert.match(view, /cat\.dataset\.pose = 'jump'/);
  assert.match(view, /cat\.dataset\.pose = 'walk'/);
  for (const r of ART_MAP_FILES.filter((x) => x.startsWith('art-v56/'))) assert.ok(DAY_ART.includes(r), `沒有預載 ${r}`);
  for (const [id, src] of [['bg_office', 'scene_office_night'], ['bg_road', 'scene_county_road'], ['bg_courtyard_night', 'scene_v3b_courtyard_night_v2'], ['bg_room_night', 'scene_v3b_room_night'], ['bg_bed_pov', 'scene_v3b_bed_pov_night']]) {
    assert.equal(ART_MAP[id].src, src);
    assert.equal(ART_MAP[id].status, 'ready');
  }
  for (const [k, p] of Object.entries(PLACES)) {
    assert.ok(ART_MAP[p.slot], `${k} 對到 ${p.slot}`);
    assert.equal(p.src, srcOf(p.slot), k);
  }
  for (const act of D.DAY_ACTS.filter((a) => D.DAY_ACT_VIEW[a] === 'still')) for (const k of placesOf(D.DAY_LINES[act])) assert.ok(PLACES[k], `${act}：${k}`);
  for (const n of DAY_ART) assert.ok(n.includes('/') ? has(n) : files.has(`${n}.webp`), `缺 ${artUrl(n)}`);
  assert.equal(YIJUN_CARD.flawed, 'char_v3b_yijun_card_flawed_v4');
  assert.equal(yijunCardFor('d1wake'), YIJUN_CARD.flawed);
  assert.match(read('src/view/days.js'), /class="dy-face"/);
  assert.doesNotMatch(code('src/view/days.js') + code('src/main.js'), /drawShape|granny|junior/);
  const audio = read('src/view/audio.js');
  for (const b of dayLines()) for (const n of b.sfx || []) assert.ok(audio.includes(`case '${n}':`), `沒有音效 ${n}`);
  assert.doesNotMatch(read('src/view/days.js'), /\.(mp3|ogg|wav|m4a)\b/);
  assert.ok(!existsSync(root('assets/art/art-map.js')));
});
