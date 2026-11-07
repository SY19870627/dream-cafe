// 落地烘豆機的位置與圖的規格（承峰 11/7：「咖啡烘焙機應該很大一台，不要放吧台了，改在咖啡廳右下角一大台」；src/roast.js 的 ROASTER／ROASTER_ART）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as RO from '../../src/roast.js';
import { createNav } from '../../src/pathfind.js';

// 和 main.js 一樣的店（x −3～3、z −4～4；門口在前牆 x 0.15、寬 0.92、門框 0.08）與 navBlockers() 的硬東西、椅子
const ROOM = { x0: -3, x1: 3, z0: -4, z1: 4 };
const DOOR = { x0: 0.15 - 0.46 - 0.08, x1: 0.15 + 0.46 + 0.08 };
const COUNTER = { id: 'counter', x0: 1.6, x1: 2.4, z0: -3.25, z1: 0.25 };
const CAFE = [
  COUNTER,
  { id: 'backBase', x0: 2.8, x1: 3.0, z0: -2.78, z1: 0.02 },
  RO.roasterBox(),
  { id: 'tableWindow', x: -2.2, z: -0.6, r: 0.38 },
  { id: 'tableSofa', x: -1.45, z: 2.4, r: 0.42 },
  { id: 'tableYuan', x: -0.4, z: -2.3, r: 0.34 },
  { id: 'chairWindow', x: -1.9, z: 0.15, r: 0.22, soft: true },
  { id: 'sofa', x: -2.1, z: 3.3, r: 0.6, soft: true },
  { id: 'yuanChair', x: -0.4, z: -1.86, r: 0.2, soft: true },
  { id: 'stoolBar', x: 1.3, z: -1.0, r: 0.17, soft: true },
  { id: 'stoolMid', x: 1.3, z: -2.1, r: 0.17, soft: true },
  { id: 'stoolFar', x: 1.3, z: -2.9, r: 0.17, soft: true },
];
const HOME = { x: 2.6, z: -1.6 };
const DOOR_IN = { x: 0.15, z: 3.7 };
const NOTICE = { x: 0.95, z: 3.45, r: 0.2 }; // 門口的徵才啟事（告別第 2 段貼出去）
const SPOT = RO.ROASTER.spot;

function makeNav() {
  const nav = createNav({ bounds: ROOM, cell: 0.1, radius: 0.12 });
  nav.setBlockers(CAFE);
  return nav;
}
function assertClear(nav, from, pts) {
  const all = [from, ...pts];
  for (let i = 1; i < all.length; i++) assert.equal(nav.segmentHits(all[i - 1], all[i], true), null, `第 ${i} 段穿過硬的東西`);
}

test('位置：俯瞰畫面的右下角＝店門口右手邊那一角的地板，落地的大台（不在吧台上）', () => {
  const b = RO.roasterBox();
  assert.equal(b.id, 'roaster');
  assert.ok(!b.soft, '硬的碰撞物');
  assert.ok(RO.ROASTER.x > 1.5 && RO.ROASTER.z > 2.5, '右邊（+x）、靠店門口（+z）');
  assert.ok(b.x0 >= ROOM.x0 && b.x1 <= ROOM.x1 && b.z0 >= ROOM.z0 && b.z1 <= ROOM.z1, '在店裡');
  assert.ok(ROOM.x1 - b.x1 <= 0.1 && ROOM.z1 - b.z1 <= 0.2, '靠著右牆與前牆那一角');
  assert.ok(RO.ROASTER.w >= 0.9 && RO.ROASTER.d >= 0.7, '佔地是大台的尺寸（0.9 × 0.75 公尺）');
  // 不和吧台（含店門口那一端外面的走道）、門口、徵才啟事重疊
  assert.ok(b.z0 - COUNTER.z1 > 2, '離吧台店門口那一端兩公尺以上');
  assert.ok(b.x0 - DOOR.x1 > 1, '離門口一公尺以上');
  assert.ok(b.x0 - (NOTICE.x + NOTICE.r) > 0.5, '和門口的徵才啟事之間留著走道');
});

test('碰撞與循路：德叔從吧台走到烘豆機左邊、再走回吧台，不穿檯面、不穿機器', () => {
  const nav = makeNav();
  assert.equal(nav.hardAt(RO.ROASTER.x, RO.ROASTER.z)?.id, 'roaster');
  assert.equal(nav.hardAt(SPOT.x, SPOT.z), null, '德叔站的地方不在任何硬的東西裡');
  assert.ok(nav.walkable(SPOT.x, SPOT.z), '德叔站的地方走得到（不貼牆、不貼機器）');
  const gap = RO.roasterGap(SPOT.x, SPOT.z);
  assert.ok(gap > nav.radius && gap < 0.4, `站在機器旁邊（離機身 ${gap.toFixed(2)} 公尺）`);
  assert.ok(SPOT.x < RO.roasterBox().x0, '站在機器左邊（冷卻盤那一側）');
  const go = nav.findPath(HOME, SPOT);
  assert.ok(go.ok);
  assert.deepEqual(go.pts.at(-1), SPOT);
  assertClear(nav, HOME, go.pts);
  assert.ok(go.pts.some((p) => p.z > COUNTER.z1), '從吧台店門口那一端出來');
  const back = nav.findPath(SPOT, HOME);
  assert.ok(back.ok);
  assert.deepEqual(back.pts.at(-1), HOME);
  assertClear(nav, SPOT, back.pts);
});

test('不擋門口與走道：客人從門口走到各個位子、德叔端杯，都和搬過來之前一樣走得到', () => {
  const nav = makeNav();
  const spots = [{ x: -0.4, z: -1.75 }, { x: 1.3, z: -2.9 }, { x: 1.3, z: -0.2 }, { x: -2.35, z: -1.3 }, { x: -0.85, z: 1.75 }, { x: 2.5, z: -1.0 }, { x: 0.75, z: 3.4 }, { x: -0.55, z: 3.35 }];
  for (const to of spots) {
    const r = nav.findPath(DOOR_IN, to);
    assert.ok(r.ok, JSON.stringify(to));
    assertClear(nav, DOOR_IN, r.pts);
  }
  // 門口那一格、門口往店裡的走道、吧台店門口那一端外面都不是硬的東西
  for (const p of [DOOR_IN, { x: 0.15, z: 3.2 }, { x: 1.4, z: 3.0 }, { x: 2.6, z: 0.6 }, { x: 2.5, z: 2.5 }]) assert.equal(nav.hardAt(p.x, p.z), null, JSON.stringify(p));
  // 德叔從吧台到門口（徵才、交鑰匙那幾段）照樣走得到
  const out = nav.findPath(HOME, DOOR_IN);
  assert.ok(out.ok);
  assertClear(nav, HOME, out.pts);
});

test('熟客躲的角落：原本的 (2.35, 3.1) 在機器裡面，挪到機器前面的 (2.45, 2.5) 走得到', () => {
  // main.js 的 CORNERS 第 4 個
  const nav = makeNav();
  assert.equal(nav.hardAt(2.35, 3.1)?.id, 'roaster', '舊的角落現在是機器');
  const corner = { x: 2.45, z: 2.5 };
  assert.ok(RO.roasterGap(corner.x, corner.z) >= 0.5);
  const r = nav.findPath(DOOR_IN, corner);
  assert.ok(r.ok);
  assert.deepEqual(r.pts.at(-1), corner);
  assertClear(nav, DOOR_IN, r.pts);
});

test('roasterGap：機器裡是 0，往外算到佔地的距離', () => {
  const b = RO.roasterBox();
  assert.equal(RO.roasterGap(RO.ROASTER.x, RO.ROASTER.z), 0);
  assert.ok(Math.abs(RO.roasterGap(b.x0 - 0.3, RO.ROASTER.z) - 0.3) < 1e-9);
  assert.ok(Math.abs(RO.roasterGap(RO.ROASTER.x, b.z0 - 0.5) - 0.5) < 1e-9);
  // 新擺飾的空位（main.js 的 FREE_SPOTS／WALL_SPOTS）裡和機器重疊的那幾個不用：(2.4, 3.2)、靠右牆的 (2.78, 2.8)、(2.78, 3.5)
  for (const [x, z] of [[2.4, 3.2], [2.78, 2.8], [2.78, 3.5]]) assert.ok(RO.roasterGap(x, z) <= 0.5, `${x},${z}`);
  for (const [x, z] of [[2.4, 1.6], [2.78, 2.0], [1.2, 3.5], [0.9, 2.5]]) assert.ok(RO.roasterGap(x, z) > 0.5, `${x},${z}`);
});

test('圖的規格：畫到的範圍放得進畫布；爐口、冷卻盤、漏斗、煙囪口都在畫到的範圍裡、上下順序合理', () => {
  const A = RO.ROASTER_ART;
  assert.ok(A.size[0] >= A.w && A.size[1] >= A.h, '畫布比畫到的範圍大（四周留白會裁掉）');
  assert.ok(A.w >= 0.75 && A.h >= 1.6 && A.h <= 2.2, '落地的大台：約 0.82 公尺寬、1.8 公尺高（含煙囪，不頂到 3.2 公尺的天花板）');
  assert.ok(Math.abs(A.w - RO.ROASTER.w) < 0.15, '畫到的寬和佔地的寬差不多');
  const inside = ([u, v]) => Math.abs(u) <= A.w / 2 && v >= 0 && v <= A.h;
  for (const k of ['flame', 'tray', 'hopper', 'smoke', 'tap']) assert.ok(inside(A[k]), k);
  assert.ok(Math.abs(A.tray[0]) + A.trayR <= A.w / 2 + 1e-9, '冷卻盤整個在畫到的範圍裡');
  assert.ok(A.tray[0] < 0, '冷卻盤在左邊（德叔站的那一側）');
  assert.ok(A.flame[1] < A.tray[1] && A.tray[1] < A.hopper[1] && A.hopper[1] < A.smoke[1], '由下往上：爐口、冷卻盤、漏斗、煙囪口');
  assert.ok(A.smoke[1] >= A.h - 0.1, '煙囪口在最上面');
});

test('main.js 與 art.js：用 roast.js 的位置與規格、載入 prop_roaster_large（沒有就 Canvas 暫代），不再放在吧台上', async () => {
  const main = await readFile(new URL('../../src/main.js', import.meta.url), 'utf8');
  const art = await readFile(new URL('../../src/art.js', import.meta.url), 'utf8');
  assert.match(main, /const ROASTER = RO\.ROASTER;/);
  assert.match(main, /out\.push\(roasterBox\(\)\)/, 'navBlockers() 有烘豆機');
  assert.match(main, /paper\(A\.roaster\(\), ROASTER\.x, ROASTER\.z, \{ name: 'roaster' \}\)/, '落地（不是 y: TOP 放在檯面上）');
  assert.doesNotMatch(main, /ROASTER_AT/, '舊的吧台位置拿掉了');
  assert.match(main, /const CORNERS = \[[^\]]*V2\(2\.45, 2\.5\)/, '躲的角落挪到機器前面');
  assert.doesNotMatch(main, /V2\(2\.35, 3\.1\)/);
  assert.match(main, /deshu, roasterP\]\)/, '俯瞰時整台在畫面裡（fitOverview()）');
  assert.match(art, /prop_roaster_large: \{ size: ROASTER_ART\.size \}/, 'ROOM_SPEC 有 prop_roaster_large');
  assert.match(art, /room\('prop_roaster_large'\)/, 'roaster() 有圖就用圖');
  assert.doesNotMatch(art, /room\('prop_roaster'\)/, '舊的小台 prop_roaster 不再找');
});
