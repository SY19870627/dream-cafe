// 遊戲版本號（承峰 11/7）：唯一的常數在 src/version.js，畫面角落顯示它，index.html 載入 JS 的 ?v= 跟著它
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GAME_VERSION, GAME_VERSION_DATE, versionLabel } from '../../src/version.js';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const MODULES = readdirSync(new URL('../../src/', import.meta.url)).filter((f) => f.endsWith('.js') && f !== 'main.js').sort();

test('版本號是 0.x.y，日期是真的日期', () => {
  assert.match(GAME_VERSION, /^0\.\d+\.\d+$/);
  assert.match(GAME_VERSION_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(GAME_VERSION_DATE + 'T00:00:00Z').toISOString().slice(0, 10), GAME_VERSION_DATE);
});

test('畫面上的字從常數來：v 加版本號與日期，短到放得進角落', () => {
  const label = versionLabel();
  assert.ok(label.startsWith('v' + GAME_VERSION));
  assert.ok(label.includes(GAME_VERSION_DATE));
  assert.ok(label.length <= 24);
});

test('main.js 用 versionLabel() 填 #version，index.html 有這個元素、點不到、字小', () => {
  assert.match(main, /import \{ versionLabel \} from '\.\/version\.js'/);
  assert.match(main, /textContent = versionLabel\(\)/);
  assert.match(html, /<div id="version"[^>]*><\/div>/);
  const css = html.match(/#version \{([^}]*)\}/);
  assert.ok(css, '#version 要有樣式');
  assert.match(css[1], /pointer-events: none/);
  assert.ok(Number(css[1].match(/font-size: (\d+)px/)[1]) <= 11);
  // 版本號沒有寫死在 index.html 的畫面文字裡（只出現在 ?v= 參數）
  assert.ok(!html.replace(/\?v=[\d.]+/g, '').includes(GAME_VERSION));
});

test('快取：main.js 的 <script> 帶 ?v=版本號', () => {
  const tags = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tags, [`./src/main.js?v=${GAME_VERSION}`]);
});

test('快取：importmap 把 src/ 每個子模組對到帶同一個 ?v= 的網址', () => {
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  assert.equal(map.three, './vendor/three.module.min.js');
  for (const f of MODULES) assert.equal(map[`./src/${f}`], `./src/${f}?v=${GAME_VERSION}`, `importmap 少了 src/${f} 或版本不對`);
  // 沒有對到已經不存在的檔案
  const keys = Object.keys(map).filter((k) => k.startsWith('./src/'));
  assert.deepEqual(keys.map((k) => k.slice(6)).sort(), MODULES);
  // 每個網址的 ?v= 都一樣（遞增時沒有漏改）
  const vs = new Set(html.match(/\?v=[\d.]+/g));
  assert.deepEqual([...vs], [`?v=${GAME_VERSION}`]);
});
