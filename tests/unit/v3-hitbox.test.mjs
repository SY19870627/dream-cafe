// 可點範圍：畫面上實際可點的範圍至少 44×44。
// 店內環景（canvas 2.5D，view/pano.js 的 hitBox）已拔掉（承峰 2026-11-21 20:48）；店裡改成 2D 定景，熱點是閱讀層上的按鈕
// （view/reader.js 的 hot()），跟著畫面上的元素走，寬高不足 44 就放大到 44、置中在元素上。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SHOP_CHAIR, SHOP_CUP, SHOP_CUP_STAND, CAT_2D } from '../../src/view/shop-still.js';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');

const W = 390;
const H = 844;
// .op-art：高＝畫面高、寬照 1170×2532、往上移 9%（top: -9%）、水平置中
const artW = (H * 1170) / 2532;
const artX = (W - artW) / 2;
const artY = -0.09 * H;
const toScreen = (r) => ({ x: artX + (r.left / 100) * artW, y: artY + (r.top / 100) * H, w: (r.width / 100) * artW, h: (r.height / 100) * H });

test('熱點放大：寬高不足 44 就放大到 44、置中在元素上（reader.js 的 place）', () => {
  const reader = read('src/view/reader.js');
  assert.match(reader, /const w = Math\.max\(44, r\.w\);\s*const hh = Math\.max\(44, r\.h\);/);
  assert.match(reader, /h\.el\.style\.left = `\$\{Math\.round\(r\.x \+ r\.w \/ 2 - w \/ 2\)\}px`;/);
  assert.match(reader, /h\.el\.style\.top = `\$\{Math\.round\(r\.y \+ r\.h \/ 2 - hh \/ 2\)\}px`;/);
  assert.match(reader, /if \(!r\) \{ h\.el\.hidden = true; continue; \}/, '量不到（元素藏起來）就不出熱點');
});

test('店內 2D 定景（390×844）：點椅子坐下的熱點完整在畫面內、至少 44×44、在沒有閱讀框的畫面上半到中段', () => {
  const c = toScreen(SHOP_CHAIR);
  assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= W && c.y + c.h <= H, `椅子 ${JSON.stringify(c)}`);
  assert.ok(c.w >= 44 && c.h >= 44, `椅子 ${c.w}×${c.h}`);
  // 杯子、地上的貓在閱讀框（下方 31%）上緣以上
  const boxTop = H * 0.69;
  assert.ok(artY + (SHOP_CUP.y / 100) * H <= boxTop + 1, '杯子在閱讀框上方（坐下特寫）');
  assert.ok(artY + (SHOP_CUP_STAND.y / 100) * H <= boxTop + 1, '杯子在閱讀框上方（進門 v2）');
  for (const [k, s] of Object.entries(CAT_2D)) assert.ok(artY + (s.y / 100) * H <= boxTop + 1, `貓 ${k} 的腳在閱讀框上方`);
});

test('坐下喝咖啡（靠窗特寫）：點杯子的熱點完整在畫面內、杯高至少 44（寬由 reader 放大到 44）', () => {
  const top = artY + ((SHOP_CUP.y - SHOP_CUP.h) / 100) * H;
  const h = (SHOP_CUP.h / 100) * H;
  const x = artX + (SHOP_CUP.x / 100) * artW;
  assert.ok(h >= 44, `杯高 ${h}`);
  assert.ok(top >= 0 && top + h <= H * 0.69 + 1 && x - 22 >= 0 && x + 22 <= W, `杯子 ${JSON.stringify({ x, top, h })}`);
});

test('店內環景的 hitBox／Pano 已拔掉（檔案刪掉）', () => {
  for (const f of ['src/view/pano.js', 'src/view/scenes.js', 'src/view/shop.js']) assert.ok(!existsSync(root(f)), f);
});
