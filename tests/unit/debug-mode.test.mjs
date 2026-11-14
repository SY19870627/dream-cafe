// 除錯模式（?debug=1）：開關、回報內容、離線佇列、跳關、裝置摘要。只測純邏輯與靜態檔案，不開瀏覽器。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { debugOn } from '../../src/debug/flag.js';
import { buildPayload, reportText, dayLabel, deviceSummary, dayOf, plainText, runningVersion, shotFits, shotScale, lineInfo, CATEGORIES, SHOT_MAX_BASE64 } from '../../src/debug/report.js';
import { readQueue, writeQueue, submit, flush, post, exportText, QUEUE_KEY } from '../../src/debug/queue.js';
import { jumpGroups, actLabel } from '../../src/debug/jump.js';
import * as S from '../../src/story/state.js';
import { BUILD_TIME } from '../../src/version.js';
import { taipeiStamp, formatVersion, versionParts, versionSource, BUILD_TIME_RE } from '../../src/debug/stamp.js';
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
  for (const f of ['flag.js', 'report.js', 'queue.js', 'jump.js', 'config.js', 'reset.js', 'stamp.js']) {
    const src = code(`src/debug/${f}`);
    assert.doesNotMatch(src, /\b(document|window|localStorage|navigator|location)\b/, f);
    assert.doesNotMatch(src, /(?<![.\w])fetch\(/, `${f} 不直接呼叫全域 fetch`);
  }
  assert.deepEqual(readdirSync(root('src/debug')).sort(), ['config.js', 'flag.js', 'jump.js', 'queue.js', 'report.js', 'reset.js', 'stamp.js', 'ui.js']);
  assert.match(code('src/debug/ui.js'), /vendor\/html2canvas\.min\.js/);
  assert.match(read('vendor/html2canvas.min.js').slice(0, 200), /html2canvas 1\.4\.1/);
  // ui.js 的樣式都是 .dbg- 開頭
  const css = /const CSS = `([\s\S]*?)`;/.exec(read('src/debug/ui.js'))[1];
  for (const m of css.matchAll(/(^|[\s,}])\.([a-zA-Z][\w-]*)/g)) assert.ok(m[2].startsWith('dbg-'), `.${m[2]} 要用 .dbg- 開頭`);
});

test('設定檔：回報網址是 Apps Script 網頁應用程式（或留空）、密語已填；除錯檔只用 BUILD_TIME、沒有寫死的 commit 短碼', () => {
  assert.ok(REPORT_ENDPOINT === '' || /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(REPORT_ENDPOINT));
  assert.ok(typeof REPORT_KEY === 'string' && REPORT_KEY.length >= 8 && (REPORT_ENDPOINT === '' || REPORT_KEY !== 'REPLACE_ME'));
  for (const f of readdirSync(root('src/debug'))) {
    const src = code(`src/debug/${f}`);
    assert.doesNotMatch(src, /\bBUILD\b/, `${f} 不再用寫死的版本代號`);
    assert.doesNotMatch(src, /c155aaa/, f);
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*version\.js['"]/g)) {
      assert.deepEqual(m[1].split(',').map((x) => x.trim()).filter(Boolean), ['BUILD_TIME'], `${f} 從 version.js 只拿 BUILD_TIME`);
    }
  }
  assert.match(code('src/debug/ui.js'), /import \{ BUILD_TIME \} from '\.\.\/version\.js';/);
});

test('src/version.js：只有 BUILD_TIME（台北時間 YYYY-MM-DD HH:mm:ss）、註解說明自動寫入；內容就是 stamp 腳本寫的樣子', () => {
  assert.match(BUILD_TIME, BUILD_TIME_RE);
  const [y, mo, d, h, mi, s] = BUILD_TIME.split(/[- :]/).map(Number);
  assert.ok(y >= 2026 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h <= 23 && mi <= 59 && s <= 59, BUILD_TIME);
  const src = read('src/version.js').replace(/\r\n/g, '\n');
  assert.equal(src, versionSource(BUILD_TIME));
  assert.match(src, /pre-commit/);
  assert.match(src, /不要手改/);
  assert.doesNotMatch(src, /\bBUILD\b|c155aaa/);
});

test('pre-commit：.githooks/pre-commit 跑 stamp 腳本再 git add src/version.js；package.json 有 version:stamp', () => {
  const hook = read('.githooks/pre-commit').replace(/\r\n/g, '\n');
  assert.match(hook, /^#!\/bin\/sh\n/);
  assert.match(hook, /^node scripts\/stamp-version\.mjs && git add src\/version\.js$/m);
  assert.match(hook, /git config core\.hooksPath \.githooks/); // 啟用方式寫在註解裡
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['version:stamp'], 'node scripts/stamp-version.mjs');
  assert.equal(pkg.scripts['hooks:install'], 'git config core.hooksPath .githooks');
  const script = code('scripts/stamp-version.mjs');
  assert.match(script, /taipeiStamp\(new Date\(\)\)/);
  assert.match(script, /versionSource\(stamp\)/);
  assert.match(script, /src\/version\.js/);
});

test('taipeiStamp：台北時間（UTC+8），不看系統時區；跨日、跨月、跨年', () => {
  assert.equal(taipeiStamp(new Date('2026-11-14T12:05:31Z')), '2026-11-14 20:05:31');
  assert.equal(taipeiStamp(new Date('2026-11-14T15:59:59Z')), '2026-11-14 23:59:59');
  assert.equal(taipeiStamp(new Date('2026-11-14T16:00:00Z')), '2026-11-15 00:00:00'); // 跨日
  assert.equal(taipeiStamp(new Date('2026-11-30T16:00:01Z')), '2026-12-01 00:00:01'); // 跨月
  assert.equal(taipeiStamp(new Date('2026-12-31T20:30:00Z')), '2027-01-01 04:30:00'); // 跨年
  assert.equal(taipeiStamp(new Date('2026-07-01T00:00:00Z')), '2026-07-01 08:00:00'); // 夏天也是 +8（沒有日光節約）
  assert.equal(taipeiStamp(Date.UTC(2026, 0, 2, 3, 4, 5)), '2026-01-02 11:04:05'); // 給毫秒數也行
  assert.match(taipeiStamp(), BUILD_TIME_RE);
  assert.throws(() => taipeiStamp(new Date('壞掉')), RangeError);
  assert.throws(() => versionSource('2026/11/14'), RangeError);
});

test('formatVersion：「日期 時間（running）」；沒有 commit 時間就只回 running', () => {
  assert.equal(formatVersion('2026-11-14 20:05:31', 'b00eb97'), '2026-11-14 20:05:31（b00eb97）');
  assert.equal(formatVersion('2026-11-14 20:05:31', '未釘'), '2026-11-14 20:05:31（未釘）');
  assert.equal(formatVersion('2026-11-14 20:05:31', 'local'), '2026-11-14 20:05:31（local）');
  assert.equal(formatVersion('', 'b00eb97'), 'b00eb97');
  assert.equal(formatVersion(undefined, '未釘'), '未釘');
  assert.equal(formatVersion('亂寫', 'local'), 'local'); // 格式不對當作沒有
  assert.equal(formatVersion('2026-11-14 20:05:31', ''), '2026-11-14 20:05:31（local）');
  assert.deepEqual(versionParts('2026-11-14 20:05:31', 'b00eb97'), { time: '2026-11-14 20:05:31', hash: 'b00eb97' });
  assert.deepEqual(versionParts('', 'local'), { time: '', hash: 'local' });
});

test('版本一致：面板「目前位置」、「版本與重來」、回報框、文字截圖、送出的回報都用 formatVersion(BUILD_TIME, runningVersion)', () => {
  const ui = code('src/debug/ui.js');
  assert.match(ui, /const MODULE_URL = import\.meta\.url;/);
  assert.match(ui, /const running = \(\) => runningVersion\(MODULE_URL, location\.href\);/);
  assert.match(ui, /const version = \(\) => formatVersion\(BUILD_TIME, running\(\)\);/);
  assert.match(ui, /versionParts\(BUILD_TIME, running\(\)\)/); // 面板小字用同一組輸入拆開
  assert.match(ui, /el\('small', 'dbg-ver-hash', `（\$\{hash\}）`\)/);
  assert.match(read('src/debug/ui.js'), /\.dbg-ver-hash \{[^}]*font-size: 11px/);
  assert.doesNotMatch(ui, /currentVersion|versionOf/);
  assert.match(ui, /version: version\(\), maxUnits/); // 文字截圖
  assert.match(ui, /第 \$\{s\?\.opening\?\.line\} 句\\n版本 `, `｜截圖程式/); // 目前位置
  assert.equal((ui.match(/infoWithVersion\(ver, '目前版本 '|infoWithVersion\(el\('p', 'dbg-info'\), '目前版本 '/g) || []).length, 2); // 版本與重來（查詢前後）
  assert.match(ui, /\\n版本 `,\s*`｜截圖程式第 \$\{SHOT_REV\} 版\$\{pinNote \? `｜/); // 自動帶入
  assert.match(ui, /buildTime: BUILD_TIME, moduleUrl: MODULE_URL, pageUrl: location\.href/); // 回報框與送出的回報（buildPayload）
  assert.match(code('src/debug/report.js'), /version: formatVersion\(ctx\.buildTime, runningVersion\(ctx\.moduleUrl, ctx\.pageUrl\)\)/);
  // 自動釘 commit：查對的分支、no-store、8 秒逾時、失敗隔 1.5 秒重試一次
  assert.match(ui, /fetch\(LATEST_API, \{ cache: 'no-store'/);
  assert.match(ui, /LATEST_TIMEOUT_MS = 8000/);
  assert.match(ui, /LATEST_RETRY_MS = 1500/);
  assert.match(ui, /async function latestCommit\(\) \{\s*const sha = await latestOnce\(\);\s*if \(sha\) return sha;\s*await new Promise\(\(ok\) => setTimeout\(ok, LATEST_RETRY_MS\)\);\s*return latestOnce\(\);/);
});

/* ---------- 回報內容 ---------- */
test('payload：從進度、這一句、裝置組出所有欄位；說話的人用 nameOf、台詞是純文字', () => {
  const state = S.jumpState(S.newStoryState(), 'd2town', 3);
  const beat = { who: 'yizhen', text: '<b>妳</b>還好嗎&amp;' };
  const nameOf = (w) => ({ yizhen: '宜蓁' }[w] || '');
  const p = buildPayload({ state, beat, nameOf, now: new Date('2026-11-14T01:02:03Z'), buildTime: '2026-11-14 20:05:31', moduleUrl: `https://raw.githack.com/SY19870627/dream-cafe/abc1234${'0'.repeat(33)}/src/debug/ui.js`, pageUrl: 'https://raw.githack.com/SY19870627/dream-cafe/abc1234/index.html?debug=1', device: '手機 iOS', category: '台詞', comment: '  這裡少一個字  ', screenshot: 'data:image/jpeg;base64,AAAA' });
  assert.deepEqual(Object.keys(p).sort(), ['category', 'comment', 'day', 'device', 'game', 'line', 'owner', 'scene', 'screenshot', 'speaker', 'text', 'time', 'version'].sort());
  assert.equal(p.time, '2026-11-14T01:02:03.000Z');
  assert.equal(p.version, '2026-11-14 20:05:31（abc1234）');
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

test('payload：版本是「commit 時間（runningVersion）」的純文字（不再退回寫死的版本）；旁白、沒有句子、沒有截圖、未知類別', () => {
  const state = S.newStoryState();
  const T = '2026-11-14 20:05:31';
  const cases = [
    ['http://127.0.0.1:8080/src/debug/ui.js', 'http://127.0.0.1:8080/index.html?v=r42&debug=1', `${T}（local）`],
    ['http://127.0.0.1:8080/src/debug/ui.js', 'http://127.0.0.1:8080/index.html?debug=1', `${T}（local）`],
    ['https://raw.githack.com/SY19870627/dream-cafe/feat/v3b-acts1-4/src/debug/ui.js', 'https://raw.githack.com/SY19870627/dream-cafe/feat/v3b-acts1-4/index.html?debug=1&v=b00eb97', `${T}（未釘）`],
    [`https://raw.githack.com/SY19870627/dream-cafe/${'b00eb97'.padEnd(40, 'f')}/src/debug/ui.js`, `https://raw.githack.com/SY19870627/dream-cafe/${'b00eb97'.padEnd(40, 'f')}/index.html?debug=1`, `${T}（b00eb97）`],
  ];
  for (const [moduleUrl, pageUrl, want] of cases) {
    const v = buildPayload({ state, buildTime: T, moduleUrl, pageUrl }).version;
    assert.equal(v, want);
    assert.equal(v, formatVersion(T, runningVersion(moduleUrl, pageUrl)));
    assert.doesNotMatch(v, /<|small/); // 送出的是純文字
  }
  assert.equal(buildPayload({ state, moduleUrl: cases[3][0], pageUrl: cases[3][1] }).version, 'b00eb97'); // 沒有 commit 時間就只有短碼
  assert.equal(buildPayload({ state, buildTime: BUILD_TIME }).version, `${BUILD_TIME}（local）`);
  assert.equal(buildPayload({ state }).version, 'local'); // 什麼都沒給也不會冒出寫死的版本
  const p = buildPayload({ state, beat: { text: '雞叫了。' }, buildTime: T, moduleUrl: cases[0][0], pageUrl: cases[0][1], category: '亂寫', screenshot: 'not-a-data-url' });
  assert.equal(p.version, `${T}（local）`);
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
  const p = buildPayload({ state: { opening: { act: 'd2town', line: 3 } }, beat: { who: 'deshu', text: '<b>早</b>啊' }, nameOf: () => '德叔', buildTime: '2026-11-14 20:05:31', moduleUrl: 'http://127.0.0.1/src/debug/ui.js', pageUrl: 'http://127.0.0.1/index.html?v=abc', category: '台詞', comment: '太長', device: '手機', screenshot: 'data:image/jpeg;base64,AAAA' });
  const t = reportText(p);
  for (const s of ['第2天', 'd2town 第 3 句', '版本 2026-11-14 20:05:31（local）', '德叔：早啊', '分類：台詞', '意見：太長', '裝置：手機']) assert.ok(t.includes(s), s);
  assert.ok(!t.includes('base64'));
});
