// 開機與效能（承峰 2026-11-21「四項照建議修」）：
//   1-A 網址 ?reset=1 在 load() 之前清 dream-cafe.v3b，清完把 reset 從網址拿掉（其他參數留著）
//   2-A 店內環景已拔掉（承峰 2026-11-21 20:48）：沒有常駐的 rAF 迴圈
//   2-B 分段預載：開機只等開場＋店內的圖；第一天以後與 art-v56 在背景載；allArt() 不含不會顯示的舊三天 AVG 圖
// 只測純邏輯與靜態檔案，不開瀏覽器。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const code = (p) => read(p).replace(/\/\/.*$/gm, '');

globalThis.addEventListener ??= () => {};
globalThis.Image ??= class { constructor() { this.complete = false; this.naturalWidth = 0; } };

const { SAVE_KEY, OTHER_KEYS, load, persist, wantsReset, searchWithoutReset, resetFromUrl } = await import('../../src/story/save.js');
const S = await import('../../src/story/state.js');
const { allArt, BACKGROUNDS, PORTRAITS, FOCUS, OLD_LADY } = await import('../../src/story/manifest.js');
const { OPENING_ART, SHOP_ART } = await import('../../src/view/art.js');
const { DAY_ART, PLACES } = await import('../../src/view/days.js');
const { ART_MAP_FILES, artUrl } = await import('../../src/view/art-map.js');
const { BOOT_ART, LATER_ART, actArt } = await import('../../src/view/boot-art.js');
const D = await import('../../src/lines/days.js');

const SRC = JSON.parse(read('src/story/final-source.json'));
const fakeStorage = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

/* ---------- 1-A ?reset=1 ---------- */
test('?reset=1：要不要清檔、清完後的 search（reset 拿掉、其他參數留著）', () => {
  assert.equal(wantsReset('?reset=1'), true);
  assert.equal(wantsReset('?debug=1&reset=1'), true);
  assert.equal(wantsReset('?reset=0'), false);
  assert.equal(wantsReset('?reset=true'), false);
  assert.equal(wantsReset(''), false);
  assert.equal(wantsReset(undefined), false);
  assert.equal(searchWithoutReset('?reset=1'), '');
  assert.equal(searchWithoutReset('?debug=1&reset=1'), '?debug=1');
  assert.equal(searchWithoutReset('?reset=1&debug=1&v=abc'), '?debug=1&v=abc');
  assert.equal(searchWithoutReset('?debug=1'), '?debug=1');
});

test('?reset=1：load 之前清 dream-cafe.v3b（不碰其他鍵），網址換成沒有 reset 的；沒有 reset 不清', () => {
  const saved = { v: 1, phase: 'opening', opening: { act: 'd1town', line: 4 } };
  const st = fakeStorage();
  st.setItem(SAVE_KEY, JSON.stringify(saved));
  for (const k of OTHER_KEYS) st.setItem(k, 'keep');
  st.setItem('dream-cafe.debug.queue', 'keep');
  const calls = [];
  const hist = { state: { a: 1 }, replaceState: (...a) => calls.push(a) };
  const loc = { pathname: '/dream-cafe/index.html', search: '?debug=1&reset=1', hash: '#x' };
  assert.equal(resetFromUrl(loc, st, hist), true);
  assert.equal(st.getItem(SAVE_KEY), null, '存檔清掉');
  for (const k of [...OTHER_KEYS, 'dream-cafe.debug.queue']) assert.equal(st.getItem(k), 'keep', `${k} 不動`);
  assert.deepEqual(calls, [[{ a: 1 }, '', '/dream-cafe/index.html?debug=1#x']]);
  assert.deepEqual(S.playable(load(SRC, st)), S.newStoryState(), '清完讀檔是從頭開始');

  // 沒有 reset：不清、不改網址
  const st2 = fakeStorage();
  st2.setItem(SAVE_KEY, JSON.stringify(saved));
  const calls2 = [];
  assert.equal(resetFromUrl({ pathname: '/', search: '?debug=1', hash: '' }, st2, { replaceState: (...a) => calls2.push(a) }), false);
  assert.equal(S.playable(load(SRC, st2)).opening.act, 'd1town');
  assert.equal(calls2.length, 0);
});

test('?reset=1：沒有 window／storage／history（Node）時不丟錯', () => {
  assert.doesNotThrow(() => resetFromUrl());
  assert.doesNotThrow(() => resetFromUrl(undefined, null, undefined));
  assert.doesNotThrow(() => resetFromUrl({ search: '?reset=1' }, null, undefined));
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => resetFromUrl({ pathname: '/', search: '?reset=1', hash: '' }, bad, { replaceState() { throw new Error('x'); } }));
  assert.equal(persist(S.newStoryState(), null), false);
});

test('?reset=1：main.js 開機順序是 reset → load → playable → save → 預載開場圖；跟換畫面的 reset() 不同名', () => {
  const main = code('src/main.js');
  const boot = main.slice(main.indexOf("fetch('src/story/final-source.json')"));
  const i = (s) => { const k = boot.indexOf(s); assert.ok(k >= 0, `開機有 ${s}`); return k; };
  assert.ok(i('resetFromUrl()') < i('S.playable(load(source))'));
  assert.ok(i('S.playable(load(source))') < i('save();'));
  assert.ok(i('save();') < i('preload(BOOT_ART)'));
  assert.ok(i('preload(BOOT_ART)') < i("$('boot').remove()"));
  assert.ok(i("$('boot').remove()") < i('preloadIdle(LATER_ART)'));
  assert.match(main, /^function reset\(\) \{/m, '換畫面的 reset() 還在');
  assert.doesNotMatch(main, /function resetFromUrl/, '不在 main.js 另外定義');
});

/* ---------- 2-A 店內環景已拔掉（承峰 2026-11-21 20:48）：沒有常駐的動畫迴圈 ---------- */
test('店內環景（canvas 2.5D）已拔掉：沒有 Pano、沒有 #pano；店內 2D 定景不排 rAF；換畫面時停掉店內的計時器', () => {
  for (const f of ['src/view/pano.js', 'src/view/scenes.js', 'src/view/shop.js']) assert.ok(!existsSync(root(f)), `${f} 應該刪掉`);
  const main = code('src/main.js');
  assert.doesNotMatch(main, /Pano|pano|requestAnimationFrame/);
  assert.doesNotMatch(read('index.html'), /id="pano"|#pano/);
  assert.doesNotMatch(code('src/view/shop-still.js'), /requestAnimationFrame|getContext/);
  assert.match(code('src/view/shop-still.js'), /stop\(\) \{ clearTimers\(\); clearTimeout\(petTimer\); \}/);
  // 換畫面（reset）：停掉目前畫面（店內 2D 定景也是 sceneCtl）
  const reset = main.match(/function reset\(\) \{([\s\S]*?)\n\}/)[1];
  assert.match(reset, /sceneCtl\?\.stop\(\);/);
  assert.match(main, /const shop = showShop\(\$\('opening'\), act, \{ seated: act === 'coffee' \}\);[^\n]*\n\s*sceneCtl = shop;/);
  assert.doesNotMatch(read('package.json'), /"three"/, '沒有 three.js');
});

/* ---------- 2-B 分段預載 ---------- */
const OLD_AVG = ['scene_v3_rain_room', 'scene_v3_mountain_hut', 'scene_v3_office_lobby', 'char_v3_agui_half', 'char_v3_junior_half',
  'prop_v3_old_notebook', 'prop_v3_id_badge', 'prop_v3_handover_folder', 'prop_v3_cloth_bag', 'char_v3_old_lady_far'];

test('開機預載：只等開場＋店內的圖；不含舊三天 AVG、不含 art-v56 與第一天以後的背景', () => {
  for (const n of [...OPENING_ART, ...SHOP_ART]) assert.ok(BOOT_ART.includes(n), `開機要等 ${n}`);
  assert.equal(new Set(BOOT_ART).size, BOOT_ART.length);
  for (const n of OLD_AVG) {
    assert.ok(!BOOT_ART.includes(n), `開機不等 ${n}`);
    assert.ok(!allArt().includes(n), `allArt 不含 ${n}`);
    assert.ok(existsSync(root(`assets/art/${n}.webp`)), `${n}.webp 檔案留著`);
  }
  // 對照表仍接著舊圖（三天模組還在）
  assert.equal(BACKGROUNDS.rainRoom.src, 'scene_v3_rain_room');
  assert.equal(PORTRAITS.gui.src, 'char_v3_agui_half');
  assert.equal(FOCUS.notebook.src, 'prop_v3_old_notebook');
  assert.equal(OLD_LADY.src, 'char_v3_old_lady_far');
  // art-v56 與第一天以後的背景：不在開機清單，在背景清單
  const v56 = ART_MAP_FILES.filter((x) => x.startsWith('art-v56/'));
  assert.ok(v56.length > 0);
  for (const r of v56) {
    assert.ok(!BOOT_ART.includes(r), `開機不等 ${r}`);
    assert.ok(LATER_ART.includes(r), `${r} 在背景預載`);
    assert.ok(existsSync(root(artUrl(r))), `${r} 檔案在`);
  }
  for (const p of Object.values(PLACES)) if (p.src) assert.ok(!BOOT_ART.includes(p.src) || OPENING_ART.includes(p.src) || SHOP_ART.includes(p.src), `開機不等第一天的背景 ${p.src}`);
  // 店內環景的貼圖不再預載（檔案留著）
  for (const n of ['backbar', 'tex_wall_plaster', 'tex_floor_wood', 'tex_counter_front', 'tex_wood_top', 'pendant_lamp', 'kettleSet', 'bookshelf', 'radio', 'window_day_clear', 'chair']) {
    assert.ok(!BOOT_ART.includes(n) && !LATER_ART.includes(n), `${n} 不再預載`);
    assert.ok(existsSync(root(`assets/art/${n}.webp`)), `${n}.webp 檔案留著`);
  }
  // 第一天下山的縣道還是會載（背景清單），只是開機不等
  assert.ok(DAY_ART.includes('scene_county_road') && LATER_ART.includes('scene_county_road'));
  assert.ok(!BOOT_ART.includes('scene_county_road'));
  assert.ok(existsSync(root('assets/art/scene_county_road.webp')));
  // DAY_ART 每一張都在背景清單或開機清單
  for (const n of DAY_ART) assert.ok(LATER_ART.includes(n) || BOOT_ART.includes(n), n);
  // 換幕前補那一幕的背景
  assert.deepEqual(actArt(D.DAY_LINES.d1town).length > 0, true);
  for (const n of actArt(D.DAY_LINES.d1town)) assert.ok(DAY_ART.includes(n));
  assert.deepEqual(actArt(undefined), []);
  const main = code('src/main.js');
  assert.match(main, /preload\(BOOT_ART\)/);
  assert.doesNotMatch(main, /preload\([^)]*DAY_ART/, '開機不再一次等全部 DAY_ART');
  assert.match(main, /warm\(actArt\(lines\)\)/);
});

test('preloadIdle：一小批一小批、閒置時載，全部載完 resolve', async () => {
  const { preloadIdle } = await import('../../src/view/art.js');
  const q = [];
  const p = preloadIdle([], { idle: (fn) => q.push(fn) });
  while (q.length) q.shift()();
  await p;
});
