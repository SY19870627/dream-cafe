import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, H, DOOR, emptyLayout, placeProblem, validate, footprint, seatCells, size, walkMap, pathTo, nearestEntrance, layoutKey, remaining,
  bestPlacementAt, placeableCells, pieceCells,
} from '../../src/grid.js';

let n = 0;
const corner = (type, x, y, rot = 0, style = 'wood') => ({ uid: `c${n++}`, kind: 'corner', type, x, y, rot, style });
const decor = (type, x, y) => ({ uid: `d${n++}`, kind: 'decor', type, x, y, rot: 0 });
const lay = (...items) => ({ items });

test('空店可以開：門走得到吧台', () => {
  const v = validate(emptyLayout());
  assert.equal(v.ok, true);
  assert.equal(v.barOk, true);
  assert.deepEqual(v.stuck, []);
});

test('店面 7×9', () => {
  assert.equal(W, 7);
  assert.equal(H, 9);
});

test('窗邊雙人座要靠窗', () => {
  assert.equal(placeProblem(emptyLayout(), corner('window', 0, 1)), null);
  assert.equal(placeProblem(emptyLayout(), corner('window', 2, 4)), 'window');
  assert.equal(placeProblem(emptyLayout(), corner('window', 0, 6)), 'window'); // 窗只到第 5 列
});

test('工作桌要靠插座', () => {
  // 插座在 (6,6)：直放 2×3 貼右牆
  assert.equal(placeProblem(emptyLayout(), corner('worktable', 5, 5, 1)), null);
  assert.equal(placeProblem(emptyLayout(), corner('worktable', 1, 4)), 'outlet');
});

test('超出店面、壓到吧台、壓到門口都不行', () => {
  assert.equal(placeProblem(emptyLayout(), corner('window', -1, 1)), 'out');
  assert.equal(placeProblem(emptyLayout(), corner('worktable', 5, 7, 1)), 'out');
  assert.equal(placeProblem(emptyLayout(), decor('plant', 5, 1)), 'fixed');
  assert.equal(placeProblem(emptyLayout(), decor('plant', 5, 2)), 'fixed'); // 高腳椅
  assert.equal(placeProblem(emptyLayout(), decor('plant', DOOR.x, DOOR.y)), 'clear');
  assert.equal(placeProblem(emptyLayout(), decor('plant', 4, 3)), 'clear'); // 吧台前
});

test('碰撞：角落與擺飾不能重疊；移動自己不算撞到自己', () => {
  const a = corner('window', 0, 1);
  const l = lay(a);
  assert.equal(placeProblem(l, corner('window', 0, 2)), 'overlap');
  assert.equal(placeProblem(l, decor('lamp', 1, 2)), 'overlap');
  assert.equal(placeProblem(l, decor('lamp', 2, 2)), null);
  assert.equal(placeProblem(l, { ...a, y: 2 }), null);
});

test('旋轉：佔地長寬對調，座位跟著轉', () => {
  const a = corner('worktable', 0, 0, 0);
  assert.deepEqual(size(a), { w: 3, h: 2 });
  assert.deepEqual(size({ ...a, rot: 1 }), { w: 2, h: 3 });
  assert.equal(footprint({ ...a, rot: 1 }).length, 6);
  const seats = seatCells({ ...a, x: 5, y: 5, rot: 1 });
  for (const s of seats) assert.ok(footprint({ ...a, x: 5, y: 5, rot: 1 }).some((c) => c.x === s.x && c.y === s.y));
});

test('BFS：門口三面都堵住就走不到吧台，不能開店', () => {
  const l = lay(decor('plant', 2, 8), decor('plant', 4, 8), decor('lamp', 3, 7));
  const v = validate(l);
  assert.equal(v.ok, false);
  assert.equal(v.barOk, false);
  assert.ok(v.stuck.length > 0); // 堵住的空格會標紅
});

test('BFS：角落入口被堵住也不能開店', () => {
  // 窗邊座在左上角 (0,1)～(1,2)，把它周圍能站的格子全堵住
  const w = corner('window', 0, 1);
  const l = lay(w, decor('plant', 0, 0), decor('plant', 1, 0), decor('lamp', 2, 1), decor('lamp', 2, 2), decor('frame', 0, 3), decor('catbed', 1, 3));
  const v = validate(l);
  assert.equal(v.problems.length, 0);
  assert.deepEqual(v.unreachable, [w.uid]);
  assert.equal(v.ok, false);
});

test('BFS：路徑從門口出發、每步只走一格', () => {
  const w = corner('window', 0, 1);
  const l = lay(w);
  const map = walkMap(l);
  const e = nearestEntrance(l, w, map);
  const p = pathTo(map, e);
  assert.deepEqual(p[0], DOOR);
  assert.deepEqual(p[p.length - 1], e);
  for (let i = 1; i < p.length; i++) assert.equal(Math.abs(p[i].x - p[i - 1].x) + Math.abs(p[i].y - p[i - 1].y), 1);
});

test('庫存與版面字串與 uid、順序無關', () => {
  const a = corner('window', 0, 1);
  const b = decor('plant', 3, 4);
  assert.equal(layoutKey(lay(a, b)), layoutKey(lay({ ...b, uid: 'x' }, { ...a, uid: 'y' })));
  assert.equal(remaining(lay(a), 'corner', 'window'), 1);
  assert.equal(remaining(lay(a), 'corner', 'worktable'), 1);
});

test('點一格：找蓋住這一格的合法擺法；放不下回原因', () => {
  const r = bestPlacementAt(emptyLayout(), 'corner', 'window', { x: 0, y: 2 });
  assert.ok(r.item);
  assert.ok(footprint(r.item).some((c) => c.x === 0 && c.y === 2));
  assert.equal(placeProblem(emptyLayout(), r.item, '__new'), null);
  assert.equal(bestPlacementAt(emptyLayout(), 'corner', 'window', { x: 5, y: 6 }).reason, 'window');
  assert.equal(bestPlacementAt(emptyLayout(), 'decor', 'plant', DOOR).reason, 'clear');
  assert.ok(bestPlacementAt(emptyLayout(), 'decor', 'plant', { x: 2, y: 5 }).item);
});

test('放得下的格子：窗邊雙人座只在靠窗那一帶，擺飾避開門口與吧台', () => {
  const win = placeableCells(emptyLayout(), 'corner', 'window');
  assert.ok(win.length > 0);
  assert.ok(win.every((c) => c.x <= 1));
  const plant = placeableCells(emptyLayout(), 'decor', 'plant');
  assert.ok(!plant.some((c) => c.x === DOOR.x && c.y === DOOR.y));
  assert.ok(!plant.some((c) => c.x >= 4 && c.y <= 3));
});

test('轉向後，桌子、書架、椅子換到別格', () => {
  const at = (it) => pieceCells(it).map((p) => `${p.piece}@${p.x - it.x},${p.y - it.y}`).sort().join(' ');
  const w0 = corner('window', 0, 1, 0);
  const w1 = { ...w0, rot: 1 };
  const w2 = { ...w0, rot: 2 };
  assert.notEqual(at(w0), at(w1));
  assert.notEqual(at(w0), at(w2));
  assert.notEqual(at(w1), at(w2));
  // 工作桌：長桌從橫的一排變成直的一列
  const t0 = pieceCells(corner('worktable', 4, 6, 0)).filter((p) => p.piece === 'table');
  const t1 = pieceCells(corner('worktable', 5, 6, 1)).filter((p) => p.piece === 'table');
  assert.equal(t0.length, 3);
  assert.equal(t1.length, 3);
  assert.equal(new Set(t0.map((p) => p.y)).size, 1);
  assert.equal(new Set(t1.map((p) => p.x)).size, 1);
});
