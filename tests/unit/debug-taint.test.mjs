import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { directAssetUrl, directCssUrls } from '../../src/debug/report.js';

const PAGE = 'https://raw.githack.com/SY19870627/dream-cafe/b149bbf/index.html?debug=1';

test('截圖：raw.githack 的圖換成 raw.githubusercontent（同路徑），頁面與程式不換', () => {
  assert.equal(directAssetUrl('https://raw.githack.com/SY19870627/dream-cafe/b149bbf/assets/art/key.webp', PAGE), 'https://raw.githubusercontent.com/SY19870627/dream-cafe/b149bbf/assets/art/key.webp');
  assert.equal(directAssetUrl('assets/art/key.webp', PAGE), 'https://raw.githubusercontent.com/SY19870627/dream-cafe/b149bbf/assets/art/key.webp');
  assert.equal(directAssetUrl('https://raw.githack.com/SY19870627/dream-cafe/b149bbf/src/main.js', PAGE), 'https://raw.githack.com/SY19870627/dream-cafe/b149bbf/src/main.js');
  assert.equal(directAssetUrl('data:image/png;base64,AAAA', PAGE), 'data:image/png;base64,AAAA');
});

test('截圖：本機測試（不是 raw.githack）一律不換', () => {
  assert.equal(directAssetUrl('http://127.0.0.1:8080/assets/art/key.webp', 'http://127.0.0.1:8080/index.html'), 'http://127.0.0.1:8080/assets/art/key.webp');
});

test('截圖：CSS 背景裡的 url() 也換', () => {
  const css = 'url("https://raw.githack.com/SY19870627/dream-cafe/x/assets/art/scene_office_night.webp"), linear-gradient(#000, #111)';
  assert.equal(directCssUrls(css, PAGE), 'url("https://raw.githubusercontent.com/SY19870627/dream-cafe/x/assets/art/scene_office_night.webp"), linear-gradient(#000, #111)');
});

test('art.js 只有 debug 模式才用 CORS 載圖', () => {
  const src = readFileSync(new URL('../../src/view/art.js', import.meta.url), 'utf8');
  assert.match(src, /if \(CORS\) im\.crossOrigin = 'anonymous'/);
  assert.match(src, /debugOn\(globalThis\.location\?\.search\)/);
});
