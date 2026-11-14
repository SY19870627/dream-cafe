// 除錯模式（?debug=1）：開關、回報內容、離線佇列、跳關、裝置摘要。只測純邏輯與靜態檔案，不開瀏覽器。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { debugOn } from '../../src/debug/flag.js';
import { buildPayload, reportText, dayLabel, deviceSummary, dayOf, plainText, versionOf, shotFits, shotScale, lineInfo, CATEGORIES, SHOT_MAX_BASE64 } from '../../src/debug/report.js';
import { readQueue, writeQueue, submit, flush, post, exportText, QUEUE_KEY } from '../../src/debug/queue.js';
import { jumpGroups, actLabel } from '../../src/debug/jump.js';
import * as S from '../../src/story/state.js';
import { BUILD } from '../../src/version.js';
import { REPORT_ENDPOINT, REPORT_KEY } from '../../src/debug/config.js';
import { CHOICE } from '../../src/story/state.js';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // 只看程式，不看註解

// 假的 localStorage（可以設容量上限）
function fakeStorage(limit = Infinity) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (String(v).length > limit) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    get size() { return m.size; },
  };
}
const okFetch = () => { const calls = []; const f = async (url, opt) => { calls.push({ url, opt }); return { type: 'opaque' }; }; f.calls = calls; return f; };
const badFetch = async () => { throw new TypeError('Failed to fetch'); };
const sample = (over = {}) => ({ time: '2026-11-14T08:00:00.000Z', version: 'x', day: 1, scene: 'd1wake', line: 2, speaker: '我', text: 't', category: '其他', comment: 'c', screenshot: '', device: 'd', ...over });

/* ---------- 開關 ---------- */
test('flag：沒帶 debug=1 是 false；debug=1 是 true；debug=0 或其他值是 false', () => {
  assert.equal(debugOn(''), false);
  assert.equal(debugOn('?v=abc'), false);
  assert.equal(debugOn(undefined), false);
  assert.equal(debugOn('?debug=1'), true);
  assert.equal(debugOn('?v=abc&debug=1'), true);
  assert.equal(debugOn('?debug=0'), false);
  assert.equal(debugOn('?debug=true'), false);
  assert.equal(debugOn('?debug'), false);
});

test('main.js 只靜態載入 debug/flag.js；面板用動態 import()，且只在 debugOn 為真時', () => {
  const src = code('src/main.js');
  const statics = [...src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  const dbg = statics.filter((p) => p.includes('debug/'));
  assert.deepEqual(dbg, ['./debug/flag.js']);
  assert.ok(!statics.some((p) => p.includes('version.js')), 'version.js 不用在一般玩家載入');
  const dyn = [...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(dyn, ['./debug/ui.js']);
  assert.match(src, /if\s*\(\s*debugOn\(location\.search\)\s*\)\s*startDebug\(\)/);
  // flag.js 本身不碰 DOM、不發請求
  assert.doesNotMatch(code('src/debug/flag.js'), /document|window|fetch|localStorage|navigator|import /);
});

test('純邏輯除錯檔不碰 DOM／storage／fetch／navigator（只有 ui.js 碰）', () => {
  for (const f of ['flag.js', 'report.js', 'queue.js', 'jump.js', 'config.js', 'reset.js']) {
    const src = code(`src/debug/${f}`);
    assert.doesNotMatch(src, /\b(document|window|localStorage|navigator|location)\b/, f);
    assert.doesNotMatch(src, /(?<![.\w])fetch\(/, `${f} 不直接呼叫全域 fetch`);
  }
  assert.deepEqual(readdirSync(root('src/debug')).sort(), ['config.js', 'flag.js', 'jump.js', 'queue.js', 'report.js', 'reset.js', 'ui.js']);
  assert.match(code('src/debug/ui.js'), /vendor\/html2canvas\.min\.js/);
  assert.match(read('vendor/html2canvas.min.js').slice(0, 200), /html2canvas 1\.4\.1/);
  // ui.js 的樣式都是 .dbg- 開頭
  const css = /const CSS = `([\s\S]*?)`;/.exec(read('src/debug/ui.js'))[1];
  for (const m of css.matchAll(/(^|[\s,}])\.([a-zA-Z][\w-]*)/g)) assert.ok(m[2].startsWith('dbg-'), `.${m[2]} 要用 .dbg- 開頭`);
});

test('設定檔：預設沒有回報網址、密語是 REPLACE_ME；版本有 BUILD', () => {
  assert.equal(REPORT_ENDPOINT, '');
  assert.equal(REPORT_KEY, 'REPLACE_ME');
  assert.equal(BUILD, 'c155aaa');
});

/* ---------- 回報內容 ---------- */
test('payload：從進度、這一句、裝置組出所有欄位；說話的人用 nameOf、台詞是純文字', () => {
  const state = S.jumpState(S.newStoryState(), 'd2town', 3);
  const beat = { who: 'yizhen', text: '<b>妳</b>還好嗎&amp;' };
  const nameOf = (w) => ({ yizhen: '宜蓁' }[w] || '');
  const p = buildPayload({ state, beat, nameOf, now: new Date('2026-11-14T01:02:03Z'), search: '', build: 'abc1234', device: '手機 iOS', category: '台詞', comment: '  這裡少一個字  ', screenshot: 'data:image/jpeg;base64,AAAA' });
  assert.deepEqual(Object.keys(p).sort(), ['category', 'comment', 'day', 'device', 'line', 'scene', 'screenshot', 'speaker', 'text', 'time', 'version'].sort());
  assert.equal(p.time, '2026-11-14T01:02:03.000Z');
  assert.equal(p.version, 'abc1234');
  assert.equal(p.day, '第2天');
  assert.equal(p.scene, 'd2town');
  assert.equal(p.line, 3);
  assert.equal(p.speaker, '宜蓁');
  assert.equal(p.text, '妳還好嗎&');
  assert.equal(p.category, '台詞');
  assert.equal(p.comment, '這裡少一個字');
  assert.equal(p.screenshot, 'data:image/jpeg;base64,AAAA');
  assert.equal(p.device, '手機 iOS');
});

test('payload：版本以網址 ?v= 優先；旁白、沒有句子、沒有截圖、未知類別', () => {
  assert.equal(versionOf('?v=r42&debug=1', 'c155aaa'), 'r42');
  assert.equal(versionOf('?debug=1', 'c155aaa'), 'c155aaa');
  assert.equal(versionOf('', 'c155aaa'), 'c155aaa');
  const state = S.newStoryState();
  const p = buildPayload({ state, beat: { text: '雞叫了。' }, search: '?v=r42', build: 'c155aaa', category: '亂寫', screenshot: 'not-a-data-url' });
  assert.equal(p.version, 'r42');
  assert.equal(p.speaker, '旁白');
  assert.equal(p.day, '開場');
  assert.equal(p.scene, 'office');
  assert.equal(p.screenshot, '');
  assert.equal(p.category, '');
  assert.deepEqual(lineInfo(null), { speaker: '', text: '' });
  assert.equal(dayOf('d4night'), 4);
  assert.equal(dayOf('room'), 0);
  assert.equal(dayOf('tbc'), 4);
  assert.equal(plainText('<span class="st-aside">她笑</span>  了\n'), '她笑 了');
});

test('截圖：寬度上限 720、base64 上限 200KB', () => {
  assert.equal(shotScale(360, 3), 2);
  assert.equal(shotScale(400, 1), 1);
  assert.equal(shotScale(1440, 2), 0.5);
  assert.equal(shotFits('data:image/jpeg;base64,' + 'A'.repeat(SHOT_MAX_BASE64)), true);
  assert.equal(shotFits('data:image/jpeg;base64,' + 'A'.repeat(SHOT_MAX_BASE64 + 1)), false);
});

/* ---------- 佇列 ---------- */
test('佇列：沒設網址 → 存進佇列、不呼叫 fetch', async () => {
  const storage = fakeStorage();
  const f = okFetch();
  assert.equal(await submit(sample(), { endpoint: '', key: 'k', fetch: f, storage, online: true }), 'queued');
  assert.equal(f.calls.length, 0);
  assert.equal(readQueue(storage).length, 1);
});

test('佇列：離線 → 存進佇列、不呼叫 fetch；fetch 丟錯 → 存進佇列', async () => {
  const storage = fakeStorage();
  const f = okFetch();
  assert.equal(await submit(sample({ comment: 'a' }), { endpoint: 'https://x', key: 'k', fetch: f, storage, online: false }), 'queued');
  assert.equal(f.calls.length, 0);
  assert.equal(await submit(sample({ comment: 'b' }), { endpoint: 'https://x', key: 'k', fetch: badFetch, storage, online: true }), 'queued');
  assert.deepEqual(readQueue(storage).map((x) => x.comment), ['a', 'b']);
});

test('佇列：送成功不進佇列；送法是 no-cors POST、text/plain、body 帶 key', async () => {
  const storage = fakeStorage();
  const f = okFetch();
  assert.equal(await submit(sample(), { endpoint: 'https://x/exec', key: 'secret', fetch: f, storage, online: true }), 'sent');
  assert.equal(readQueue(storage).length, 0);
  assert.equal(f.calls.length, 1);
  const { url, opt } = f.calls[0];
  assert.equal(url, 'https://x/exec');
  assert.equal(opt.method, 'POST');
  assert.equal(opt.mode, 'no-cors');
  assert.equal(opt.headers['Content-Type'], 'text/plain;charset=utf-8');
  const body = JSON.parse(opt.body);
  assert.equal(body.key, 'secret');
  assert.equal(body.scene, 'd1wake');
  assert.equal(await post(sample(), { endpoint: 'https://x', fetch: undefined }), false);
});

test('佇列：重送照順序、送成功的拿掉；中途失敗就停、剩下的留著；沒網址或離線不送', async () => {
  const storage = fakeStorage();
  writeQueue(storage, [sample({ comment: '1' }), sample({ comment: '2' }), sample({ comment: '3' })]);
  assert.deepEqual(await flush({ endpoint: '', fetch: okFetch(), storage }), { sent: 0, left: 3 });
  assert.deepEqual(await flush({ endpoint: 'https://x', fetch: okFetch(), storage, online: false }), { sent: 0, left: 3 });
  let n = 0;
  const flaky = async () => { if (++n === 2) throw new TypeError('offline'); return {}; };
  assert.deepEqual(await flush({ endpoint: 'https://x', fetch: flaky, storage, online: true }), { sent: 1, left: 2 });
  assert.deepEqual(readQueue(storage).map((x) => x.comment), ['2', '3']);
  const f = okFetch();
  assert.deepEqual(await flush({ endpoint: 'https://x', fetch: f, storage, online: true }), { sent: 2, left: 0 });
  assert.deepEqual(f.calls.map((c) => JSON.parse(c.opt.body).comment), ['2', '3']);
  assert.equal(storage.getItem(QUEUE_KEY), null);
});

test('佇列：容量不夠先拿掉最舊的截圖，再不夠丟最舊的；壞掉的佇列讀成空的；匯出是 JSON', () => {
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(500);
  const storage = fakeStorage(900);
  const kept = writeQueue(storage, [sample({ comment: 'old', screenshot: big }), sample({ comment: 'new', screenshot: big })]);
  assert.deepEqual(kept.map((x) => [x.comment, !!x.screenshot]), [['old', false], ['new', true]]);
  const tiny = fakeStorage(300);
  const k2 = writeQueue(tiny, [sample({ comment: 'a' }), sample({ comment: 'b' })]);
  assert.deepEqual(k2.map((x) => x.comment), ['b']);
  const broken = fakeStorage();
  broken.setItem(QUEUE_KEY, '{nope');
  assert.deepEqual(readQueue(broken), []);
  assert.deepEqual(readQueue(null), []);
  assert.deepEqual(JSON.parse(exportText([sample()])), [sample()]);
});

/* ---------- 跳關 ---------- */
test('jumpState：每一幕都跳得到，結果與讀檔（normalize）一致、不改原本的進度', () => {
  const base = S.newStoryState();
  const before = JSON.stringify(base);
  for (const act of S.OPENING_ACTS) {
    for (const line of [0, S.lineCount(act) - 1, 9999, -3]) {
      const s = S.jumpState(base, act, line);
      assert.ok(s, act);
      assert.equal(s.phase, 'opening');
      assert.equal(s.opening.act, act);
      assert.ok(s.opening.line >= 0 && s.opening.line <= Math.max(0, S.lineCount(act) - 1), `${act} ${line}`);
      assert.deepEqual(S.normalize(JSON.parse(JSON.stringify(s))), s, `${act} ${line} 跟讀檔一致`);
    }
  }
  assert.equal(JSON.stringify(base), before);
  assert.equal(S.jumpState(base, 'nope', 0), null);
  assert.equal(S.jumpState(base, 'done', 0), null);
});

test('jumpState：過了岔路補左右、過了存摺補選擇、跳進分支照那一支；停在關卡那一句要重做', () => {
  const s0 = S.newStoryState();
  assert.equal(S.jumpState(s0, 'fork', 0).opening.fork, null);
  assert.equal(S.jumpState(s0, 'temple', 0).opening.fork, 'left');
  assert.equal(S.jumpState({ ...s0, opening: { ...s0.opening, fork: 'right' } }, 'd1wake', 0).opening.fork, 'right');
  assert.equal(S.jumpState(s0, CHOICE.act, CHOICE.line).opening.passbook, null);
  assert.equal(S.jumpState(s0, 'd2wake', 0).opening.passbook, S.PASSBOOK_SIDES[0]);
  const lines = S.ACT_LINES[CHOICE.act];
  for (const side of S.PASSBOOK_SIDES) {
    const i = lines.findIndex((b) => b.branch === side);
    if (i < 0) continue;
    const s = S.jumpState(s0, CHOICE.act, i);
    assert.equal(s.opening.line, i);
    assert.equal(s.opening.passbook, side);
  }
  // 停在有關卡的那一句：不能直接翻過去
  for (const act of S.OPENING_ACTS) {
    const i = (S.ACT_LINES[act] || []).findIndex((b) => b.gate && b.gate !== 'fork' && b.gate !== 'choice');
    if (i < 0 || i + 1 >= S.lineCount(act)) continue;
    const s = S.jumpState(s0, act, i);
    assert.equal(S.setOpeningLine(s, S.nextLine(s)), false, `${act} 第 ${i} 句的關卡要重做`);
    break;
  }
});

test('跳關選單：列出 OPENING_ACTS 每一幕（照順序），每天第一幕帶章名', () => {
  const items = jumpGroups().flatMap((g) => g.items);
  assert.deepEqual(items.map((x) => x.act), S.OPENING_ACTS);
  assert.deepEqual(jumpGroups().map((g) => g.name), ['開場', '第1天', '第2天', '第3天', '第4天', '待續']);
  assert.match(actLabel('d1wake'), /第一天　最底下那個抽屜/);
  assert.match(actLabel('d2shop'), /店裡（店內 360）/);
  for (const it of items) assert.equal(it.lines, S.lineCount(it.act));
});

/* ---------- 裝置 ---------- */
test('裝置摘要：手機／平板／電腦、iOS／Android／Windows／Mac、螢幕、DPR、直橫', () => {
  const iphone = deviceSummary({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', maxTouchPoints: 5, screenW: 390, screenH: 844, viewW: 390, viewH: 664, dpr: 3 });
  assert.match(iphone, /^手機 iOS Safari/);
  assert.match(iphone, /螢幕 390×844/);
  assert.match(iphone, /DPR 3/);
  assert.match(iphone, /直向/);
  const ipad = deviceSummary({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', maxTouchPoints: 5, screenW: 1024, screenH: 1366, viewW: 1366, viewH: 1024, dpr: 2 });
  assert.match(ipad, /^平板 iOS/);
  assert.match(ipad, /橫向/);
  const mac = deviceSummary({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', maxTouchPoints: 0, screenW: 1512, screenH: 982, viewW: 1512, viewH: 860, dpr: 2 });
  assert.match(mac, /^電腦 Mac Chrome/);
  const android = deviceSummary({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36', maxTouchPoints: 5, screenW: 412, screenH: 915, viewW: 412, viewH: 800, dpr: 2.625 });
  assert.match(android, /^手機 Android Chrome/);
  assert.match(android, /DPR 2\.63/);
  const tab = deviceSummary({ ua: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', maxTouchPoints: 5, screenW: 800, screenH: 1280, dpr: 2 });
  assert.match(tab, /^平板 Android/);
  const win = deviceSummary({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0', screenW: 1920, screenH: 1080, viewW: 1920, viewH: 960, dpr: 1.25 });
  assert.match(win, /^電腦 Windows Edge/);
  assert.match(win, /橫向/);
  assert.match(deviceSummary({}), /方向不明/);
});

/* ---------- Apps Script ---------- */
test('Code.gs：密語、試算表、分頁、資料夾、欄位、鎖、台北時間、每格 5000 字', () => {
  const gs = read('tools/report-endpoint/Code.gs');
  assert.match(gs, /var REPORT_KEY = 'REPLACE_ME';/);
  assert.match(gs, /var SPREADSHEET_ID = '';/);
  assert.match(gs, /getActiveSpreadsheet\(\)/);
  assert.match(gs, /function doPost\(e\)/);
  assert.match(gs, /function doGet\(/);
  assert.match(gs, /JSON\.parse\(/);
  assert.match(gs, /'forbidden'/);
  assert.match(gs, /LockService/);
  assert.match(gs, /'Asia\/Taipei', 'yyyy-MM-dd HH:mm:ss'/);
  assert.match(gs, /CELL_MAX = 5000/);
  assert.match(gs, /ANYONE_WITH_LINK/);
  assert.match(read('tools/report-endpoint/部署說明.md'), /管理部署作業/);
});

test('回報：分類照設計（台詞、畫面、圖、操作、其他），不選是空字串；天的字', () => {
  assert.deepEqual(CATEGORIES, ['台詞', '畫面', '圖', '操作', '其他']);
  assert.equal(buildPayload({ state: { opening: { act: 'd1wake', line: 0 } } }).category, '');
  assert.equal(dayLabel('office'), '開場');
  assert.equal(dayLabel('d3town'), '第3天');
  assert.equal(dayLabel('tbc'), '待續');
});

test('複製文字：位置、原文、分類、意見、裝置都在，沒有截圖', () => {
  const p = buildPayload({ state: { opening: { act: 'd2town', line: 3 } }, beat: { who: 'deshu', text: '<b>早</b>啊' }, nameOf: () => '德叔', search: '?v=abc', category: '台詞', comment: '太長', device: '手機', screenshot: 'data:image/jpeg;base64,AAAA' });
  const t = reportText(p);
  for (const s of ['第2天', 'd2town 第 3 句', '版本 abc', '德叔：早啊', '分類：台詞', '意見：太長', '裝置：手機']) assert.ok(t.includes(s), s);
  assert.ok(!t.includes('base64'));
});
