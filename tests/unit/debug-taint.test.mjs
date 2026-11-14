// 回報截圖被「汙染」（Tainted canvas）的修正：直連網址、文字截圖的換行、三段退路、截圖程式版本、art.js 的圖網址
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { directAssetUrl, directCssUrls, wrapText, charUnits, firstOk, shotErrorText, textShotLines, SHOT_REV } from '../../src/debug/report.js';
import * as flag from '../../src/debug/flag.js';
import * as report from '../../src/debug/report.js';

const SHA = 'b149bbf' + 'c'.repeat(33);
const PAGE = 'https://raw.githack.com/SY19870627/dream-cafe/b149bbf/index.html?debug=1';
const BR_PAGE = 'https://raw.githack.com/SY19870627/dream-cafe/feat/v3b-acts1-4/index.html?debug=1&v=60451c7';
const GH = 'https://raw.githubusercontent.com/SY19870627/dream-cafe';
const units = (s) => [...s].reduce((n, ch) => n + charUnits(ch), 0);

/* ---------- directAssetUrl ---------- */
test('directAssetUrl：搬到 flag.js，report.js re-export 的是同一個函式', () => {
  assert.equal(report.directAssetUrl, flag.directAssetUrl);
  assert.deepEqual(flag.GITHACK_HOSTS, ['raw.githack.com', 'rawcdn.githack.com']);
});

test('directAssetUrl：raw.githack 的圖換成 raw.githubusercontent（同路徑）並帶 cors=1', () => {
  assert.equal(directAssetUrl('https://raw.githack.com/SY19870627/dream-cafe/b149bbf/assets/art/key.webp', PAGE), `${GH}/b149bbf/assets/art/key.webp?cors=1`);
  assert.equal(directAssetUrl('assets/art/key.webp', PAGE), `${GH}/b149bbf/assets/art/key.webp?cors=1`);
});

test('directAssetUrl：原本有 query 時合併，不重複、不弄丟', () => {
  assert.equal(directAssetUrl('assets/art/key.webp?x=1&y=2', PAGE), `${GH}/b149bbf/assets/art/key.webp?x=1&y=2&cors=1`);
  assert.equal(directAssetUrl('assets/art/key.webp?cors=0', PAGE), `${GH}/b149bbf/assets/art/key.webp?cors=1`);
  // 換過的再換一次不變（已經是 githubusercontent）
  const once = directAssetUrl('assets/art/key.webp', PAGE);
  assert.equal(directAssetUrl(once, PAGE), once);
});

test('directAssetUrl：分支名含斜線、40 碼 commit 路徑都對', () => {
  assert.equal(directAssetUrl('assets/art/scene_office_night.webp', BR_PAGE), `${GH}/feat/v3b-acts1-4/assets/art/scene_office_night.webp?cors=1`);
  const pinned = `https://raw.githack.com/SY19870627/dream-cafe/${SHA}/index.html?debug=1&v=b149bbf`;
  assert.equal(directAssetUrl('assets/art/key.webp', pinned), `${GH}/${SHA}/assets/art/key.webp?cors=1`);
});

test('directAssetUrl：rawcdn.githack.com 也換（頁面與圖任一個是 rawcdn 都算）', () => {
  const cdn = `https://rawcdn.githack.com/SY19870627/dream-cafe/${SHA}/index.html?debug=1`;
  assert.equal(directAssetUrl('assets/art/key.webp', cdn), `${GH}/${SHA}/assets/art/key.webp?cors=1`);
  assert.equal(directAssetUrl(`https://rawcdn.githack.com/SY19870627/dream-cafe/${SHA}/assets/art/key.webp`, PAGE), `${GH}/${SHA}/assets/art/key.webp?cors=1`);
});

test('directAssetUrl：非 githack 頁面、js／css／json／html、目錄、data:、blob: 都原樣返回', () => {
  assert.equal(directAssetUrl('http://127.0.0.1:8080/assets/art/key.webp', 'http://127.0.0.1:8080/index.html'), 'http://127.0.0.1:8080/assets/art/key.webp');
  assert.equal(directAssetUrl('assets/art/key.webp', 'http://127.0.0.1:8080/index.html?debug=1'), 'assets/art/key.webp');
  for (const f of ['src/main.js', 'src/a.mjs', 'style.css', 'src/story/final-source.json', 'index.html', 'a.htm', 'assets/']) {
    const u = `https://raw.githack.com/SY19870627/dream-cafe/b149bbf/${f}`;
    assert.equal(directAssetUrl(u, PAGE), u, f);
  }
  assert.equal(directAssetUrl('data:image/png;base64,AAAA', PAGE), 'data:image/png;base64,AAAA');
  assert.equal(directAssetUrl('blob:https://raw.githack.com/1234-5678', PAGE), 'blob:https://raw.githack.com/1234-5678');
  assert.equal(directAssetUrl('assets/art/key.webp', 'not a url'), 'assets/art/key.webp');
});

/* ---------- directCssUrls ---------- */
test('directCssUrls：多層背景、有無引號、none', () => {
  const css = 'url("https://raw.githack.com/SY19870627/dream-cafe/x/assets/art/scene_office_night.webp"), linear-gradient(#000, #111)';
  assert.equal(directCssUrls(css, PAGE), `url("${GH}/x/assets/art/scene_office_night.webp?cors=1"), linear-gradient(#000, #111)`);
  assert.equal(directCssUrls("url('assets/art/a.webp'), url(assets/art/b.webp)", PAGE), `url("${GH}/b149bbf/assets/art/a.webp?cors=1"), url("${GH}/b149bbf/assets/art/b.webp?cors=1")`);
  assert.equal(directCssUrls('none', PAGE), 'none');
  assert.equal(directCssUrls('', PAGE), '');
  assert.equal(directCssUrls(undefined, PAGE), '');
});

/* ---------- wrapText ---------- */
test('wrapText：全形算 2、半形算 1，混排照格數換行', () => {
  assert.equal(charUnits('我'), 2);
  assert.equal(charUnits('，'), 2);
  assert.equal(charUnits('a'), 1);
  assert.equal(charUnits(' '), 1);
  assert.deepEqual(wrapText('我是ab你好', 6), ['我是ab', '你好']);
  assert.deepEqual(wrapText('abcdef', 4), ['abcd', 'ef']);
  for (const l of wrapText('德叔：「早啊，今天的咖啡是 Geisha，喝喝看。」'.repeat(3), 20)) assert.ok(units(l) <= 20, l);
});

test('wrapText：超長沒有空白的字串硬切；原本的換行照留；空字串', () => {
  const long = '我'.repeat(100);
  const out = wrapText(long, 10);
  assert.equal(out.length, 20);
  assert.ok(out.every((l) => l === '我'.repeat(5)));
  assert.deepEqual(wrapText('a'.repeat(25), 10), ['a'.repeat(10), 'a'.repeat(10), 'a'.repeat(5)]);
  assert.deepEqual(wrapText('上\n下', 10), ['上', '下']);
  assert.deepEqual(wrapText('', 10), ['']);
  assert.deepEqual(wrapText(null, 10), ['']);
});

test('wrapText：行數上限，超過的最後一行以「…」結尾且不超過格數', () => {
  const out = wrapText('我'.repeat(100), 10, 3);
  assert.equal(out.length, 3);
  assert.ok(out[2].endsWith('…'));
  assert.ok(units(out[2]) <= 10);
  assert.deepEqual(wrapText('短', 10, 3), ['短']);
});

/* ---------- 截圖程式版本、錯誤訊息、文字截圖 ---------- */
test('SHOT_REV 是正整數（至少 2）；錯誤訊息帶版本與每一段', () => {
  assert.ok(Number.isInteger(SHOT_REV) && SHOT_REV >= 2);
  const t = shotErrorText([{ index: 0, message: 'Tainted canvases may not be exported.' }, { index: 1, message: 'x' }]);
  assert.equal(t, `截圖程式第 ${SHOT_REV} 版；第 1 段：Tainted canvases may not be exported.；第 2 段：x`);
  assert.equal(shotErrorText([]), `截圖程式第 ${SHOT_REV} 版`);
});

test('textShotLines：第幾天｜幕｜第幾句、說話的人：台詞、版本、只有文字的說明', () => {
  const lines = textShotLines({ state: { opening: { act: 'd2town', line: 3 } }, beat: { who: 'deshu', text: '<b>早</b>啊' }, nameOf: () => '德叔', label: '鎮上', version: 'abc1234', maxUnits: 56 });
  assert.equal(lines[0], '第2天｜d2town（鎮上）｜第 3 句');
  assert.ok(lines.includes('德叔：早啊'));
  assert.ok(lines.some((l) => l.includes('版本 abc1234') && l.includes(`截圖程式第 ${SHOT_REV} 版`)));
  assert.equal(lines.at(-1), '（畫面截不下來，只有文字）');
  const empty = textShotLines({ state: { opening: { act: 'office', line: 0 } }, beat: null });
  assert.ok(empty.includes('（這一幕沒有台詞）'));
  const long = textShotLines({ state: { opening: { act: 'd1wake', line: 1 } }, beat: { text: '字'.repeat(2000) }, maxUnits: 40 });
  assert.ok(long.length < 25 && long.every((l) => units(l) <= 40));
});

/* ---------- 三段退路（firstOk） ---------- */
test('firstOk：第一段成功就停，不跑後面', async () => {
  let ran = 0;
  const r = await firstOk([() => 'a', () => { ran++; return 'b'; }]);
  assert.deepEqual(r, { ok: true, value: 'a', index: 0, errors: [] });
  assert.equal(ran, 0);
});

test('firstOk：html2canvas 兩段都丟 Tainted → 走到最後一段（文字截圖）並回傳結果與錯誤清單', async () => {
  const TAINT = "Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.";
  // 假的 html2canvas：回傳一張「被汙染」的畫布，toJpeg 呼叫 toDataURL 就丟錯
  const fakeH2c = async () => ({ width: 720, height: 1280, toDataURL() { throw new DOMException(TAINT, 'SecurityError'); } });
  const toJpeg = (c) => c.toDataURL('image/jpeg', 0.7);
  const textShot = () => ({ width: 720, height: 400, toDataURL: () => 'data:image/jpeg;base64,TEXT' });
  const r = await firstOk([
    async () => ({ url: toJpeg(await fakeH2c()), note: '' }),
    async () => ({ url: toJpeg(await fakeH2c()), note: '截圖只有文字、沒有圖（瀏覽器不讓讀取圖片）' }),
    async () => ({ url: toJpeg(textShot()), note: '畫面截不下來，只有文字' }),
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.index, 2);
  assert.equal(r.value.url, 'data:image/jpeg;base64,TEXT');
  assert.deepEqual(r.errors.map((e) => e.index), [0, 1]);
  assert.ok(r.errors.every((e) => e.message === TAINT));
  assert.match(shotErrorText(r.errors), /^截圖程式第 \d+ 版；第 1 段：Failed to execute 'toDataURL'.*；第 2 段：/);
});

test('firstOk：全部失敗回傳 ok=false 與每一段的錯誤（不丟錯）；非 Error 的丟值也記得', async () => {
  const r = await firstOk([() => { throw new Error('一'); }, async () => { throw '二'; }, () => { throw null; }]);
  assert.equal(r.ok, false);
  assert.equal(r.index, -1);
  assert.deepEqual(r.errors.map((e) => e.message), ['一', '二', '不明錯誤']);
  assert.deepEqual(await firstOk([]), { ok: false, value: undefined, index: -1, errors: [] });
});

test('ui.js：截圖三段（完整、不放圖、文字截圖）、汙染檢查用 getImageData 並快取、背景用 important 拿掉', () => {
  // 截圖的做法搬到除錯核心（core/capture.js）；面板文字在 core/ui.js；自動釘 commit 留在 dream-cafe 的 ui.js
  const ui = readFileSync(new URL('../../src/debug/ui.js', import.meta.url), 'utf8');
  const cap = readFileSync(new URL('../../src/debug/core/capture.js', import.meta.url), 'utf8');
  const coreUi = readFileSync(new URL('../../src/debug/core/ui.js', import.meta.url), 'utf8');
  assert.match(cap, /getImageData\(0, 0, 1, 1\)/);
  for (const src of [ui, cap, coreUi]) assert.doesNotMatch(src, /toDataURL\('image\/png'\)/);
  assert.match(cap, /memo\.has\(node\)/);
  assert.match(cap, /setProperty\('background-image', 'none', 'important'\)/);
  assert.match(cap, /await firstOk\(tries\)/);
  assert.match(cap, /function textShot\(info\)/);
  assert.match(coreUi, /截圖程式第 \$\{SHOT_REV\} 版/);
  assert.match(ui, /assetUrl: \(url\) => directAssetUrl\(url, location\.href\)/);
  assert.match(ui, /if \(await pinLatest\(\)\) return null;/);
});

/* ---------- art.js ---------- */
test('art.js：artSrc 沒有 debug 時永遠是 assets/art/x.webp；debug＋githack 是直連加 cors=1', async () => {
  const { artSrc } = await import('../../src/view/art.js');
  assert.equal(artSrc('key', PAGE, false), 'assets/art/key.webp');
  assert.equal(artSrc('key', 'http://127.0.0.1:8080/index.html?debug=1', true), 'assets/art/key.webp');
  assert.equal(artSrc('key', BR_PAGE, true), `${GH}/feat/v3b-acts1-4/assets/art/key.webp?cors=1`);
});

// 用假的 location 與 Image 重新載入 art.js（網址加 ?case= 讓模組重新執行一次）
async function loadArt(href, tag) {
  const prevLoc = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const prevImg = globalThis.Image;
  const u = new URL(href);
  Object.defineProperty(globalThis, 'location', { value: { href, search: u.search }, configurable: true, writable: true });
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } };
  try {
    const m = await import(`../../src/view/art.js?case=${tag}`);
    return m.img('scene_office_night');
  } finally {
    if (prevLoc) Object.defineProperty(globalThis, 'location', prevLoc); else delete globalThis.location;
    if (prevImg) globalThis.Image = prevImg; else delete globalThis.Image;
  }
}

test('art.js：沒有 ?debug=1（就算在 githack）→ src 不變、不設 crossOrigin', async () => {
  const a = await loadArt('https://raw.githack.com/SY19870627/dream-cafe/feat/v3b-acts1-4/index.html?v=60451c7', 'plain-gh');
  assert.equal(a.src, 'assets/art/scene_office_night.webp');
  assert.equal('crossOrigin' in a, false);
  const b = await loadArt('http://127.0.0.1:8080/index.html', 'plain-local');
  assert.equal(b.src, 'assets/art/scene_office_night.webp');
  assert.equal('crossOrigin' in b, false);
});

test('art.js：?debug=1 在 githack → 直連網址加 cors=1、crossOrigin=anonymous；本機 debug 只加 crossOrigin', async () => {
  const a = await loadArt(BR_PAGE, 'debug-gh');
  assert.equal(a.src, `${GH}/feat/v3b-acts1-4/assets/art/scene_office_night.webp?cors=1`);
  assert.equal(a.crossOrigin, 'anonymous');
  const b = await loadArt('http://127.0.0.1:8080/index.html?debug=1', 'debug-local');
  assert.equal(b.src, 'assets/art/scene_office_night.webp');
  assert.equal(b.crossOrigin, 'anonymous');
});

test('art.js 只有 debug 模式才用 CORS 載圖', () => {
  const src = readFileSync(new URL('../../src/view/art.js', import.meta.url), 'utf8');
  assert.match(src, /if \(CORS\) im\.crossOrigin = 'anonymous'/);
  assert.match(src, /debugOn\(globalThis\.location\?\.search\)/);
});
