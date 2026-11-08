import test from 'node:test';
import assert from 'node:assert/strict';
import {
  W, H, DOOR, emptyLayout, placeProblem, validate, footprint, seatCells, size, walkMap, pathTo, nearestEntrance, layoutKey, remaining,
  bestPlacementAt, placeableCells, pieceCells,
  cornerOpts, seatingCorners, wallSideOf, flushSide, cornerWallSpot, layerOf, itemKey, blockedSet,
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

/* ---------- 擺設大改：新擺設、牆面／地毯圖層、角落細調 ---------- */
test('商品展示櫃：1×3、整排貼牆（後牆、左牆窗以外、右牆），沒有座位', () => {
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 0, 0, 0)), null); // 後牆 x0～2
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 1, 0, 0)), null); // 後牆 x1～3
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 2, 0, 0)), 'fixed'); // 壓到吧台
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 0, 1, 1)), 'flush'); // 窗前不行
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 0, 6, 1)), null); // 左牆窗下面那段
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 6, 4, 1)), null); // 右牆
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 6, 3, 1)), 'clear'); // 吧台前要留空
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 3, 4, 1)), 'flush'); // 店中間
  assert.equal(placeProblem(emptyLayout(), corner('showcase', 0, 1, 0)), 'flush'); // 離後牆一格
  const s = corner('showcase', 0, 6, 1);
  assert.equal(flushSide(s), 'left');
  assert.deepEqual(seatCells(s), []);
  assert.equal(validate(lay(s)).ok, true);
  assert.deepEqual(seatingCorners(lay(s)), []); // 只擺展示櫃不算有座位的角落
});

test('唱片角要靠牆；沙發兩個位子、一台唱盤', () => {
  assert.equal(placeProblem(emptyLayout(), corner('record', 2, 4)), 'wall');
  assert.equal(placeProblem(emptyLayout(), corner('record', 0, 6)), null);
  assert.equal(placeProblem(emptyLayout(), corner('record', 5, 5)), null);
  assert.equal(seatCells(corner('record', 0, 6)).length, 2);
  assert.ok(pieceCells(corner('record', 0, 6)).some((p) => p.piece === 'player'));
});

test('掛牆上的：只能放牆邊（窗、吧台那面不行）、不擋路、可以掛在矮家具上方，不能掛在展示櫃上', () => {
  assert.equal(layerOf(decor('board', 3, 0)), 'wall');
  assert.equal(placeProblem(emptyLayout(), decor('board', 3, 0)), null);
  assert.equal(placeProblem(emptyLayout(), decor('board', 3, 4)), 'wallonly');
  assert.equal(placeProblem(emptyLayout(), decor('map', 0, 2)), 'wallonly'); // 窗
  assert.equal(placeProblem(emptyLayout(), decor('map', 5, 0)), 'fixed'); // 吧台
  assert.equal(placeProblem(emptyLayout(), decor('bookwall', 6, 3)), null); // 吧台前上方的牆：掛著不擋路
  assert.equal(placeProblem(lay(decor('plant', 0, 7)), decor('greenwall', 0, 7)), null); // 盆栽上方
  assert.equal(placeProblem(lay(decor('greenwall', 0, 7)), decor('plant', 0, 7)), null);
  assert.equal(placeProblem(lay(decor('board', 0, 7)), decor('map', 0, 7)), 'overlap'); // 同一面牆同一格
  assert.equal(placeProblem(lay(corner('showcase', 0, 0, 0)), decor('board', 1, 0)), 'overlap');
  assert.equal(placeProblem(lay(decor('board', 1, 0)), corner('showcase', 0, 0, 0)), 'overlap');
  const l = lay(decor('board', 6, 8), decor('map', 0, 8));
  assert.equal(validate(l).ok, true);
  assert.equal(blockedSet(l).has('6,8'), false);
});

test('地毯 2×2：不擋路、桌椅可以壓在上面，地毯之間不能疊', () => {
  const r = decor('rug', 1, 1);
  assert.deepEqual(size(r), { w: 2, h: 2 });
  assert.equal(placeProblem(emptyLayout(), r), null);
  assert.equal(placeProblem(lay(r), corner('window', 0, 1)), null);
  assert.equal(placeProblem(lay(corner('window', 0, 1)), r), null);
  assert.equal(placeProblem(lay(r), decor('rug', 2, 2)), 'overlap');
  assert.equal(placeProblem(emptyLayout(), decor('rug', 3, 7)), null); // 鋪到門口也行
  assert.equal(validate(lay(decor('rug', 3, 7))).ok, true);
  assert.equal(placeProblem(emptyLayout(), decor('rug', 6, 4)), 'out');
  // 點右下角那一格：往左上挪著放
  const b = bestPlacementAt(emptyLayout(), 'decor', 'rug', { x: 6, y: 8 });
  assert.deepEqual([b.item.x, b.item.y], [5, 7]);
});

test('貓跳台要靠牆', () => {
  assert.equal(placeProblem(emptyLayout(), decor('cattree', 3, 5)), 'wall');
  assert.equal(placeProblem(emptyLayout(), decor('cattree', 0, 3)), null);
});

test('牆邊格子靠哪面牆、角落的牆位', () => {
  assert.equal(wallSideOf({ x: 0, y: 0 }), 'back');
  assert.equal(wallSideOf({ x: 0, y: 7 }), 'left');
  assert.equal(wallSideOf({ x: 0, y: 3 }), null); // 窗
  assert.equal(wallSideOf({ x: 6, y: 1 }), null); // 吧台
  assert.equal(wallSideOf({ x: 6, y: 6 }), 'right');
  assert.equal(wallSideOf({ x: 3, y: 4 }), null);
  const spot = cornerWallSpot(corner('worktable', 5, 5, 1));
  assert.equal(spot.side, 'right');
  assert.equal(spot.cells.length, 3);
  assert.equal(cornerWallSpot(corner('worktable', 2, 4)), null);
});

test('角落細調：舊存檔沒有 opts 用款式補；不合法的值用預設；張數一張只留一個座位', () => {
  assert.deepEqual(cornerOpts(corner('window', 0, 1, 0, 'wood')), { table: 'wood', chair: 'chair', seats: 2, top: 'none', lamp: 'off', wall: 'shelf' });
  assert.deepEqual(cornerOpts(corner('window', 0, 1, 0, 'rattan')), { table: 'rattan', chair: 'rattanChair', seats: 2, top: 'none', lamp: 'off', wall: 'shelf' });
  assert.equal(cornerOpts(corner('worktable', 5, 5, 1, 'iron')).chair, 'stool');
  assert.equal(cornerOpts(corner('worktable', 5, 5, 1, 'iron')).lamp, 'on');
  const w = { ...corner('window', 0, 1), opts: { seats: 1, top: 'book', chair: 'sofa' } }; // 窗邊座沒有沙發
  const o = cornerOpts(w);
  assert.equal(o.seats, 1);
  assert.equal(o.top, 'book');
  assert.equal(o.chair, 'chair');
  assert.equal(seatCells(w).length, 1);
  assert.equal(seatCells({ ...w, opts: { seats: '2' } }).length, 2); // 存檔裡是字串也行
  assert.equal(seatCells(corner('worktable', 5, 5, 1)).length, 2);
  assert.equal(seatCells({ ...corner('worktable', 5, 5, 1), opts: { seats: 1 } }).length, 1);
  assert.ok(!pieceCells({ ...corner('window', 0, 1), opts: { wall: 'none' } }).some((p) => p.piece === 'shelf'));
  assert.ok(pieceCells({ ...corner('window', 0, 1), opts: { wall: 'plant' } }).some((p) => p.piece === 'plant'));
});

test('細調進版面字串：跟預設一樣就跟沒調過一樣（舊存檔種子不變），有調就不一樣', () => {
  const a = corner('window', 0, 1);
  assert.equal(itemKey({ ...a, opts: cornerOpts(a) }), itemKey(a));
  assert.notEqual(itemKey({ ...a, opts: { ...cornerOpts(a), lamp: 'on' } }), itemKey(a));
  assert.notEqual(layoutKey(lay({ ...a, opts: { seats: 1 } })), layoutKey(lay(a)));
});
