// 除錯核心（src/debug/core/，兩個遊戲共用）：不含 dream-cafe 專屬的東西、MANIFEST 一致、在 Node 用假的 storage／fetch 跑得動、有型別宣告。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../../src/debug/core/index.js';
import { checkManifest, buildManifest, listCoreFiles, hashContent } from '../../src/debug/core/manifest-check.js';
import * as flag from '../../src/debug/flag.js';
import * as report from '../../src/debug/report.js';
import * as queue from '../../src/debug/queue.js';
import * as stamp from '../../src/debug/stamp.js';
import { saveKeysToClear } from '../../src/debug/reset.js';

const CORE = fileURLToPath(new URL('../../src/debug/core/', import.meta.url));
const read = (f) => readFileSync(join(CORE, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, m };
};

/* ---------- 與遊戲無關 ---------- */
test('核心不含 dream-cafe 專屬的字（遊戲名、存檔鍵、幕名、網址、檔名、角色）', () => {
  const banned = [/dream[-_.]?cafe/i, /夢想咖啡/, /\bd\d(wake|shop|town|cafe|night)\b/, /\bopening\b/, /githack/i, /githubusercontent/i, /SY19870627/i,
    /art\.js/, /state\.js/, /reader\.js/, /\.\.\/version\.js/, /BUILD_TIME\b/, /#app\b/, /feat\/v3b/, /店內 360/, /德叔/, /宜蓁/, /v3b/, /三合院/, /存摺/, /岔路/, /taiwan-procession/i];
  const files = listCoreFiles(CORE).concat('MANIFEST.json');
  assert.ok(files.length >= 12);
  for (const f of files) {
    const src = read(f);
    for (const re of banned) assert.doesNotMatch(src, re, `${f} 不能有 ${re}`);
  }
});

test('核心的純邏輯檔不碰 DOM／storage／fetch／navigator；瀏覽器檔不 import node: 模組；index.js 不載入 manifest-check', () => {
  for (const f of ['version.js', 'flag.js', 'stamp.js', 'report.js', 'queue.js', 'reset.js']) {
    const src = code(f);
    assert.doesNotMatch(src, /\b(document|window|localStorage|navigator|location)\b/, f);
    assert.doesNotMatch(src, /(?<![.\w])fetch\(/, f);
  }
  for (const f of ['version.js', 'flag.js', 'stamp.js', 'report.js', 'queue.js', 'reset.js', 'capture.js', 'ui.js', 'index.js']) {
    assert.doesNotMatch(code(f), /from\s+['"]node:/, f);
    for (const m of code(f).matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.match(m[1], /^\.\/[\w-]+\.js$/, `${f} 只 import 核心自己的檔：${m[1]}`);
  }
  assert.doesNotMatch(code('index.js'), /manifest-check/);
});

/* ---------- MANIFEST ---------- */
test('MANIFEST.json 和實際檔案一致（改了核心要跑 npm run debug-core:manifest）', () => {
  const r = checkManifest(CORE);
  assert.deepEqual({ missing: r.missing, extra: r.extra, changed: r.changed, versionMismatch: r.versionMismatch }, { missing: [], extra: [], changed: [], versionMismatch: false },
    '核心改過但 MANIFEST 沒更新：node scripts/sync-debug-core.mjs');
  assert.equal(r.ok, true);
  assert.equal(r.manifest.coreVersion, core.CORE_VERSION);
  assert.match(r.manifest.sourceCommit, /^[0-9a-f]{7,40}$/);
  assert.deepEqual(Object.keys(r.manifest.files), listCoreFiles(CORE));
  for (const f of ['index.js', 'index.d.ts', 'README.md', 'version.js', 'ui.js', 'capture.js', 'manifest-check.js']) assert.ok(f in r.manifest.files, f);
});

test('MANIFEST 比對：只改一邊、多一個檔、少一個檔都抓得到；CRLF 不算不同', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dbg-core-'));
  try {
    cpSync(CORE, dir, { recursive: true });
    writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify(buildManifest(dir, { sourceCommit: 'abc1234' })));
    assert.equal(checkManifest(dir).ok, true);
    writeFileSync(join(dir, 'queue.js'), read('queue.js').replace(/\n/g, '\r\n')); // 換行不同、內容一樣
    assert.equal(checkManifest(dir).ok, true);
    writeFileSync(join(dir, 'queue.js'), `${read('queue.js')}\n// 只改一邊\n`);
    assert.deepEqual(checkManifest(dir).changed, ['queue.js']);
    writeFileSync(join(dir, 'extra.js'), '');
    assert.deepEqual(checkManifest(dir).extra, ['extra.js']);
    rmSync(join(dir, 'flag.js'));
    assert.deepEqual(checkManifest(dir).missing, ['flag.js']);
    assert.equal(checkManifest(dir).ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(hashContent('a\r\nb'), hashContent('a\nb'));
  assert.equal(hashContent(new TextEncoder().encode('a\nb')), hashContent('a\nb'));
});

test('同步腳本：package.json 有指令；腳本只讀正本、寫 MANIFEST', () => {
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));
  assert.equal(pkg.scripts['debug-core:manifest'], 'node scripts/sync-debug-core.mjs');
  const script = readFileSync(fileURLToPath(new URL('../../scripts/sync-debug-core.mjs', import.meta.url)), 'utf8');
  assert.match(script, /buildManifest\(SRC/);
  assert.match(script, /copyFileSync/);
  assert.match(script, /rev-parse/);
});

/* ---------- 型別 ---------- */
test('index.d.ts 存在，index.js 匯出的每個名字都有宣告', () => {
  assert.ok(existsSync(join(CORE, 'index.d.ts')));
  assert.ok(existsSync(join(CORE, 'manifest-check.d.ts')));
  const dts = read('index.d.ts');
  for (const name of Object.keys(core)) assert.match(dts, new RegExp(`export declare (const|function) ${name}\\b`), name);
  assert.match(dts, /export interface DebugOptions/);
  for (const k of ['game', 'endpoint', 'storageKeys', 'isGameSaveKey', 'position', 'jumpGroups', 'jump', 'setTimeScale', 'version', 'capture']) assert.match(dts, new RegExp(`\\n  ${k}\\??:`), k);
  for (const k of ['display', 'latest', 'reloadUrl', 'autoPin']) assert.match(dts, new RegExp(`\\n  ${k}\\??\\(`), k);
  for (const k of ['html2canvasSrc', 'assetUrl', 'snapshot', 'root']) assert.match(dts, new RegExp(`\\n  ${k}\\??:`), k);
  assert.doesNotMatch(dts, /\bany\b/, 'd.ts 不用 any（strict 也乾淨）');
  assert.match(read('README.md'), /## 設定欄位/);
  assert.match(read('README.md'), /sync-debug-core\.mjs/);
});

/* ---------- 在 Node 跑：佇列與 payload ---------- */
test('核心在 Node 跑佇列：佇列鍵由設定給、沒網址存佇列、重送帶 key 與 owner、匯出不含 owner', async () => {
  const q = core.createQueue('game-x.debug.queue');
  const storage = mem();
  const payload = core.buildPayload({ position: { day: 'D1', scene: 's1', line: 2, speaker: '甲', text: '你好' }, game: 'game-x', version: 'v1', now: new Date('2026-11-14T00:00:00Z'), owner: 'OWN', comment: 'c', category: '畫面' });
  assert.equal(await q.submit(payload, { storage, endpoint: '' }), 'queued');
  assert.deepEqual([...storage.m.keys()], ['game-x.debug.queue']);
  assert.ok(!storage.m.get('game-x.debug.queue').includes('OWN'));
  assert.ok(!core.exportText(q.readQueue(storage)).includes('OWN'));
  const bodies = [];
  const fetch = async (url, init) => { bodies.push({ url, init, body: JSON.parse(init.body) }); return {}; };
  assert.deepEqual(await q.flush({ storage, endpoint: 'https://example.invalid/x', key: 'K', fetch, owner: 'OWN', online: true }), { sent: 1, left: 0 });
  assert.equal(bodies[0].url, 'https://example.invalid/x');
  assert.equal(bodies[0].init.mode, 'no-cors');
  assert.equal(bodies[0].body.key, 'K');
  assert.equal(bodies[0].body.owner, 'OWN');
  assert.equal(bodies[0].body.game, 'game-x');
  assert.equal(storage.getItem('game-x.debug.queue'), null);
  assert.equal(await q.submit(payload, { storage, endpoint: 'https://example.invalid/x', fetch, online: false }), 'queued'); // 離線
  assert.equal(bodies.length, 1);
  assert.throws(() => core.createQueue(''));
});

test('核心 payload：欄位與順序固定；分類、意見 1000 字、截圖只收 data:image；複製文字用 game 當標題', () => {
  const p = core.buildPayload({ position: { day: '第2天', scene: 'town', line: 3, speaker: '乙', text: '早' }, game: 'game-x', version: '2026-11-14 20:14:11（70638dd）', now: 0, category: '亂寫', comment: ` ${'字'.repeat(1200)} `, screenshot: 'http://x/a.png', device: '手機' });
  assert.deepEqual(Object.keys(p), ['time', 'version', 'day', 'scene', 'line', 'speaker', 'text', 'category', 'comment', 'screenshot', 'device', 'game', 'owner']);
  assert.equal(p.category, '');
  assert.equal(p.comment.length, core.COMMENT_MAX);
  assert.equal(p.screenshot, '');
  assert.equal(p.time, '1970-01-01T00:00:00.000Z');
  assert.deepEqual(core.CATEGORIES, ['台詞', '畫面', '圖', '操作', '其他']);
  assert.equal(core.buildPayload({ position: { line: 1.5 } }).line, 0);
  const t = core.reportText(p);
  assert.match(t, /^【game-x 回報】第2天｜town 第 3 句｜版本 2026-11-14 20:14:11（70638dd）\n乙：早\n分類：未選/);
  assert.ok(!t.includes('owner'));
  assert.deepEqual(core.textShotLines({ position: p, label: '鎮上', version: p.version }).slice(0, 3), ['第2天｜town（鎮上）｜第 3 句', '', '乙：早']);
});

test('核心：清除存檔的鍵篩選、本人識別碼存取、重新載入網址、版本字串拆回來', () => {
  const rule = { isGameSaveKey: (k) => k.startsWith('g.'), keepKeys: ['g.keep'], keepPrefixes: ['g.debug.'] };
  assert.deepEqual(core.keysToClear(['g.save', 'g.keep', 'g.debug.owner', 'other', null, 'g.slot2'], rule), ['g.save', 'g.slot2']);
  assert.deepEqual(core.keysToClear(['g.save'], { isGameSaveKey: () => false }), []);
  const s = mem();
  s.setItem('a', '1'); s.setItem('b', '2');
  assert.deepEqual(core.storageKeys(s), ['a', 'b']);
  assert.deepEqual(core.storageKeys(null), []);
  const own = core.ownerStore(s, 'g.debug.owner');
  assert.equal(own.read(), '');
  assert.equal(own.write('   '), false);
  assert.equal(own.write('  tok  '), true);
  assert.equal(s.getItem('g.debug.owner'), 'tok');
  own.clear();
  assert.equal(own.read(), '');
  assert.equal(core.ownerStore(null, 'k').read(), '');
  const u = new URL(core.bustUrl('http://127.0.0.1/index.html?debug=1', 5));
  assert.equal(u.searchParams.get('debug'), '1');
  assert.equal(u.searchParams.get('_r'), '5');
  for (const [t, h] of [['2026-11-14 20:14:11', '70638dd'], ['', 'local'], ['2026-11-14 20:14:11', '未釘']]) {
    assert.deepEqual(core.splitVersion(core.formatVersion(t, h)), core.versionParts(t, h));
  }
  assert.equal(core.CORE_VERSION, '1.0.0');
});

/* ---------- dream-cafe 改用核心 ---------- */
test('dream-cafe 的除錯檔用的是核心的同一份函式；flag.js 的 debugOn 與核心結果一樣', () => {
  for (const name of ['wrapText', 'charUnits', 'firstOk', 'shotErrorText', 'deviceSummary', 'plainText', 'shotFits', 'shotScale']) assert.equal(report[name], core[name], name);
  for (const name of ['CATEGORIES', 'COMMENT_MAX', 'SHOT_REV', 'SHOT_MAX_BASE64']) assert.equal(report[name], core[name], name);
  for (const name of ['post', 'exportText', 'withoutOwner', 'RETRY_MS']) assert.equal(queue[name], core[name], name);
  for (const name of ['taipeiStamp', 'formatVersion', 'versionParts', 'BUILD_TIME_RE']) assert.equal(stamp[name], core[name], name);
  for (const s of ['', '?debug=1', '?v=1&debug=1', '?debug=0', '?debug=true', '?debug', undefined, null, '?debug=1&debug=2', '%%%']) assert.equal(flag.debugOn(s), core.debugOn(s), String(s));
  assert.deepEqual(saveKeysToClear(['dream-cafe.v3b', 'dream-cafe.debug.queue', 'dream-cafe.debug.fast', 'dream-cafe.debug.owner', 'x']), ['dream-cafe.v3b']);
  // 轉接層：設定都由 ui.js 傳進核心
  const ui = readFileSync(fileURLToPath(new URL('../../src/debug/ui.js', import.meta.url)), 'utf8');
  assert.match(ui, /import \{ startDebug \} from '\.\/core\/ui\.js';/);
  assert.match(ui, /storageKeys: \{ queue: QUEUE_KEY, fast: FAST_KEY, owner: OWNER_KEY \}/);
  assert.match(ui, /game: GAME,/);
  assert.ok(readdirSync(CORE).includes('MANIFEST.json'));
});
