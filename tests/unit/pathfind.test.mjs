// 走路的碰撞與循路（src/pathfind.js）：店裡的桌子、吧台、椅子、擺飾都是碰撞物，走路不能穿過去
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNav } from '../../src/pathfind.js';
import { roasterBox } from '../../src/roast.js';

// 和 main.js 的 navBlockers() 同一份配置（吧台檯面 0.8 × 3.5、裡面靠牆的矮櫃、店門口右手邊的落地烘豆機、三張圓桌、椅子與高腳椅）。
// 中島吧台（D213）：檯面最裡端（z −3.25）到後牆（z −4）的空隙可以走，吧台兩端都能進出
const CAFE = [
  { id: 'counter', x0: 1.6, x1: 2.4, z0: -3.25, z1: 0.25 },
  { id: 'backBase', x0: 2.8, x1: 3.0, z0: -2.78, z1: 0.02 },
  roasterBox(), // 承峰 11/7：烘豆機搬到店門口右手邊那一角的地板（roast.js 的 ROASTER）
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
const P = (x, z) => ({ x, z });

function makeNav(extra = []) {
  const nav = createNav({ bounds: { x0: -3, x1: 3, z0: -4, z1: 4 }, cell: 0.1, radius: 0.12 });
  nav.setBlockers([...CAFE, ...extra]);
  return nav;
}
// 整條路（起點＋轉折點）每一段都不穿過硬的東西；ignore 是起點或終點所在、這一趟可以碰到的 soft 東西
function assertClear(nav, from, pts, { soft = [], ignore = [] } = {}) {
  const all = [from, ...pts];
  for (let i = 1; i < all.length; i++) {
    const hit = nav.segmentHits(all[i - 1], all[i], true);
    assert.equal(hit, null, `第 ${i} 段 (${all[i - 1].x.toFixed(2)},${all[i - 1].z.toFixed(2)})→(${all[i].x.toFixed(2)},${all[i].z.toFixed(2)}) 穿過 ${hit?.id}`);
    for (const id of soft) {
      if (ignore.includes(id)) continue;
      const b = nav.blockers.find((q) => q.id === id);
      const len = Math.hypot(all[i].x - all[i - 1].x, all[i].z - all[i - 1].z);
      for (let k = 0; k <= Math.ceil(len / 0.02); k++) {
        const t = k / Math.max(1, Math.ceil(len / 0.02));
        assert.ok(nav.dist(b, all[i - 1].x + (all[i].x - all[i - 1].x) * t, all[i - 1].z + (all[i].z - all[i - 1].z) * t) >= 0, `穿過 ${id}`);
      }
    }
  }
}
const ALL_SOFT = CAFE.filter((b) => b.soft).map((b) => b.id);

test('直線會穿過窗邊桌時，循路繞開；走到的終點就是目的地', () => {
  const nav = makeNav();
  const from = P(-2.2, -1.5), to = P(-2.2, 0.4); // 正好隔著窗邊桌
  assert.ok(nav.segmentHits(from, to, true), '這兩點的直線本來就穿過桌子');
  const r = nav.findPath(from, to);
  assert.ok(r.ok);
  assert.deepEqual(r.pts.at(-1), to);
  assertClear(nav, from, r.pts, { soft: ALL_SOFT });
  assert.ok(r.pts.length >= 2, '要有轉折');
});

test('德叔從吧台裡出來端杯：從吧台兩端挑一端繞出去，不穿吧台、不穿桌子；窗邊座、沙發座走店門口那一端', () => {
  const nav = makeNav();
  for (const serve of [P(-1.55, -0.9), P(-0.8, 2.0), P(-0.95, -1.35), P(-0.55, 1.8)]) {
    const r = nav.findPath(HOME, serve);
    assert.ok(r.ok, JSON.stringify(serve));
    assert.deepEqual(r.pts.at(-1), serve);
    assertClear(nav, HOME, r.pts, { soft: ALL_SOFT });
    // 窗邊座、沙發座比較近的是店門口那一端（檯面盡頭 z 0.25 之外）
    assert.ok(r.pts.some((p) => p.z > 0.25), '從店門口那一端出去');
    const back = nav.findPath(serve, HOME);
    assert.ok(back.ok);
    assertClear(nav, serve, back.pts, { soft: ALL_SOFT });
  }
});

test('中島吧台：最裡端到後牆的空隙走得過去，兩端都能進出；吧台和矮櫃之間走得通，不穿檯面', () => {
  const nav = makeNav();
  // 空隙本身是空的（後牆到檯面盡頭 0.75 公尺）
  for (const x of [1.7, 2.0, 2.3, 2.6]) assert.equal(nav.hardAt(x, -3.6), null, `x ${x} 在空隙裡`);
  // 吧台裡最裡面 → 店的最裡面（例如凱文那張高腳椅）：走空隙，不繞到店門口那一端
  const inner = P(2.6, -3.0), out = P(1.3, -3.4);
  const r = nav.findPath(inner, out);
  assert.ok(r.ok);
  assertClear(nav, inner, r.pts, { soft: ALL_SOFT, ignore: ['stoolFar'] });
  assert.ok(r.pts.every((p) => p.z < 0.25), '不從店門口那一端繞');
  assert.ok(r.pts.some((p) => p.z < -3.25), '從最裡端的空隙出去');
  const back = nav.findPath(out, inner);
  assert.ok(back.ok && back.pts.every((p) => p.z < 0.25));
  assertClear(nav, out, back.pts, { soft: ALL_SOFT, ignore: ['stoolFar'] });
  // 吧台和矮櫃之間（x 2.4～2.8）從頭走到尾
  const run = nav.findPath(P(2.6, -3.6), P(2.6, 0.5));
  assert.ok(run.ok);
  assertClear(nav, P(2.6, -3.6), run.pts, { soft: ALL_SOFT });
  assert.ok(run.pts.every((p) => p.x > 2.4 - 0.001), '沿著吧台裡面走，不穿檯面');
  // 檯面兩側之間的直線一定穿過吧台
  assert.equal(nav.segmentHits(P(1.4, -1.5), P(2.6, -1.5), true)?.id, 'counter');
});

test('客人從門口走到各個位子、再走出去，都不穿桌子與吧台', () => {
  const nav = makeNav();
  const spots = {
    yuan: P(-0.4, -1.75), kevin: P(1.3, -2.9), bar: P(1.3, -0.2), oppWindow: P(-2.35, -1.3), oppBar: P(1.3, -2.1), oppSofa: P(-0.85, 1.75),
    corner: P(-2.45, -3.3), corner2: P(0.75, -3.45), corner3: P(2.45, 2.5), // corner3 原本 (2.35, 3.1)，烘豆機搬過去之後往店裡挪
  };
  for (const [k, to] of Object.entries(spots)) {
    const r = nav.findPath(DOOR_IN, to);
    assert.ok(r.ok, k);
    assert.deepEqual(r.pts.at(-1), to, k);
    const ignore = CAFE.filter((b) => b.soft && nav.dist(b, to.x, to.z) < 0.17).map((b) => b.id);
    assertClear(nav, DOOR_IN, r.pts, { soft: ALL_SOFT, ignore });
    const out = nav.findPath(to, DOOR_IN);
    assert.ok(out.ok, k + ' 出去');
    assertClear(nav, to, out.pts, { soft: ALL_SOFT, ignore });
  }
});

test('吧台裡外：德叔走到吧台前的人對面（吧台裡）時，挑近的一端繞進去，不穿吧台', () => {
  const nav = makeNav();
  // 窗邊座 → 吧台裡最裡面：走最裡端的空隙
  const from = P(-1.55, -0.9), to = P(2.5, -2.9);
  const r = nav.findPath(from, to);
  assert.ok(r.ok);
  assert.deepEqual(r.pts.at(-1), to);
  assertClear(nav, from, r.pts, { soft: ALL_SOFT });
  assert.ok(r.pts.some((p) => p.z < -3.25), '從最裡端的空隙進去');
  // 門口 → 吧台裡靠店門口那一頭：走店門口那一端
  const r2 = nav.findPath(DOOR_IN, P(2.5, -0.2));
  assert.ok(r2.ok);
  assertClear(nav, DOOR_IN, r2.pts, { soft: ALL_SOFT });
  assert.ok(r2.pts.every((p) => p.z > -3.25));
});

test('擺飾是碰撞物：擋在路上就繞開；終點就在擺飾旁（soft）可以走到', () => {
  const plant = { id: 'decor:plant', x: 0.3, z: 0.9, r: 0.3, soft: true };
  const nav = makeNav([plant]);
  const from = P(0.3, 2.2), to = P(0.3, -0.3);
  const r = nav.findPath(from, to);
  assert.ok(r.ok);
  assertClear(nav, from, r.pts, { soft: [...ALL_SOFT, 'decor:plant'] });
  // 龍眼跳上擺飾：終點在擺飾上，那一件這一趟不算
  const onIt = nav.findPath(from, P(0.3, 0.9));
  assert.ok(onIt.ok);
  assert.deepEqual(onIt.pts.at(-1), P(0.3, 0.9));
});

test('終點在桌子裡面（硬的）：不穿過去，停在最近走得到的地方', () => {
  const nav = makeNav();
  const r = nav.findPath(P(0, 0), P(-2.2, -0.6));
  assert.equal(r.ok, false);
  assertClear(nav, P(0, 0), r.pts);
  assert.equal(nav.hardAt(r.pts.at(-1).x, r.pts.at(-1).z), null);
});

test('完全被圍住走不到：退回最近走得到的點，不穿牆', () => {
  // 把門口那一角用一道牆圍起來
  const wall = { id: 'wall', x0: -3, x1: 3, z0: 1.0, z1: 1.2 };
  const nav = makeNav([wall]);
  const r = nav.findPath(DOOR_IN, HOME);
  assert.equal(r.ok, false);
  assert.ok(r.pts.length >= 1);
  assertClear(nav, DOOR_IN, r.pts);
  assert.ok(r.pts.at(-1).z > 1.2, '停在牆的這一邊');
});

test('換擺飾後重建：setBlockers 之後舊的結果不再沿用', () => {
  const nav = makeNav();
  const a = nav.findPath(P(0.3, 2.2), P(0.3, -0.3));
  assert.equal(a.pts.length, 1, '空的走道直走');
  nav.setBlockers([...CAFE, { id: 'decor:shelf', x: 0.3, z: 0.9, r: 0.4, soft: true }]);
  const b = nav.findPath(P(0.3, 2.2), P(0.3, -0.3));
  assert.ok(b.pts.length >= 2, '擺了東西就要繞');
});

// D214（承峰 11/6：「寫死的走法也應該處理」）：凱文出吧台去老闆旁邊的高腳椅、喝完回吧台，不再走寫死的航點（KEEPER_OUT），改走循路。
// 老闆坐的地方不另加碰撞物（承峰 11/6：「我坐的地方不會影響才對」）：能坐的位子都有真的椅子，椅子本身就是碰撞物
const KEEPER_SIDE = P(1.3, -2.1);

test('凱文出吧台到老闆旁邊的高腳椅、再回吧台：不穿硬的東西，也不穿椅子、其他高腳椅', () => {
  const nav = makeNav();
  const out = nav.findPath(HOME, KEEPER_SIDE);
  assert.ok(out.ok);
  assert.deepEqual(out.pts.at(-1), KEEPER_SIDE);
  assertClear(nav, HOME, out.pts, { soft: ALL_SOFT, ignore: ['stoolMid'] });
  const back = nav.findPath(KEEPER_SIDE, HOME);
  assert.ok(back.ok);
  assert.deepEqual(back.pts.at(-1), HOME);
  assertClear(nav, KEEPER_SIDE, back.pts, { soft: ALL_SOFT, ignore: ['stoolMid'] });
  // 後牆沒擺東西：走吧台最裡端的空隙（比繞店門口那一端近）
  assert.ok(out.pts.some((p) => p.z < -3.25) && out.pts.every((p) => p.z < 0.25), '走最裡端的空隙');
});

test('後牆 (2.2, −3.6) 的擺飾位擺了櫃子（選項 B，擺飾位保留）：吧台裡外改走店門口那一端，不穿檯面、不穿櫃子、不穿椅子', () => {
  // 靠牆的擺飾貼到後牆前 0.22 公尺（orient()：z −3.78）；老碗櫥的碰撞半徑約 0.25（decorRadius()）
  const cabinet = { id: 'decor:cabinet', x: 2.2, z: -3.78, r: 0.25, soft: true };
  const nav = makeNav([cabinet]);
  const soft = [...ALL_SOFT, cabinet.id];
  for (const [from, to, ignore] of [[HOME, KEEPER_SIDE, ['stoolMid']], [KEEPER_SIDE, HOME, ['stoolMid']], [P(2.6, -3.0), P(1.3, -3.4), ['stoolFar']], [P(-1.55, -0.9), P(2.5, -2.9), []]]) {
    const r = nav.findPath(from, to);
    assert.ok(r.ok, JSON.stringify([from, to]));
    assert.deepEqual(r.pts.at(-1), to);
    assertClear(nav, from, r.pts, { soft, ignore });
    assert.ok(r.pts.some((p) => p.z > 0.25), `從店門口那一端繞 ${JSON.stringify(r.pts)}`);
    assert.ok(r.pts.every((p) => p.z > -3.25 || p.x < 1.6), '不走被櫃子擋住的空隙（檯面最裡端和後牆之間）');
  }
});
