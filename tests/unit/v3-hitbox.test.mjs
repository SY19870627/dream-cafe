// 可點範圍的幾何回歸：畫面內實際可點的範圍一定至少 44×44，且完整在 canvas 裡（390×844）。
// 回歸對象：舊算法只要物件有一角露在畫面邊緣就建立 44px 的範圍，大半落在畫面外，畫面內只剩 2～17px 可點。
import test from 'node:test';
import assert from 'node:assert/strict';

const W = 390;
const H = 844;

// Pano 在 node 裡跑：補上它用到的瀏覽器全域（只在建構時用到），canvas 換成什麼都不畫的假物件
globalThis.requestAnimationFrame ??= () => 0;
globalThis.addEventListener ??= () => {};
globalThis.devicePixelRatio ??= 1;
globalThis.Image ??= class { constructor() { this.complete = false; this.naturalWidth = 0; } };
function mockCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(_, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'createPattern') return () => null;
      if (k === 'measureText') return () => ({ width: 40 });
      return () => {};
    },
    set() { return true; },
  });
}
const fakeCanvas = () => ({
  getContext: () => mockCtx(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  addEventListener() {},
  setPointerCapture() {},
});

const { Pano, hitBox, MIN_HIT, MIN_VISIBLE } = await import('../../src/view/pano.js');
const { dreamScene, shopScene } = await import('../../src/view/scenes.js');
const { DREAM_ORDER } = await import('../../src/dreams/index.js');

// 畫面內實際可點的部分
const onScreen = (b) => ({ w: Math.min(W, b.x + b.w) - Math.max(0, b.x), h: Math.min(H, b.y + b.h) - Math.max(0, b.y) });
function assertGood(b, msg) {
  assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W + 1e-9 && b.y + b.h <= H + 1e-9, `${msg}：完整在畫面內 ${JSON.stringify(b)}`);
  const v = onScreen(b);
  assert.ok(v.w >= MIN_HIT && v.h >= MIN_HIT, `${msg}：畫面內至少 44×44，實際 ${v.w}×${v.h}`);
}
const covers = (b, r) => {
  // 可點範圍蓋住物件在畫面內看得到的部分
  const x0 = Math.max(0, r.x); const x1 = Math.min(W, r.x + r.w);
  const y0 = Math.max(0, r.y); const y1 = Math.min(H, r.y + r.h);
  return b.x <= x0 + 1e-9 && b.y <= y0 + 1e-9 && b.x + b.w >= x1 - 1e-9 && b.y + b.h >= y1 - 1e-9;
};

test('hitBox：左右上下邊界只露一部分的物件，畫面內仍有 44×44', () => {
  const cases = {
    '左邊露 10px': { x: -10, y: 400, w: 20, h: 20 },
    '右邊露 9px': { x: W - 9, y: 400, w: 30, h: 30 },
    '左邊剛好露 8px': { x: -22, y: 400, w: 30, h: 30 },
    '上邊露 10px': { x: 150, y: -40, w: 30, h: 50 },
    '下邊露 24px': { x: 100, y: H - 24, w: 200, h: 60 }, // 像拉高的被子
    '左上角露 10×10': { x: -30, y: -30, w: 40, h: 40 },
    '右下角露 10×10': { x: W - 10, y: H - 10, w: 40, h: 40 },
    '左邊大物件露一條': { x: -300, y: 300, w: 320, h: 200 },
  };
  for (const [name, p] of Object.entries(cases)) {
    const b = hitBox(p, W, H);
    assert.ok(b, name);
    assertGood(b, name);
    assert.ok(covers(b, p), `${name}：蓋住看得到的部分`);
  }
});

test('hitBox：小物件（完整在畫面內）放大到 44×44，置中在物件上；貼邊時往內夾', () => {
  const center = hitBox({ x: 190, y: 400, w: 6, h: 6 }, W, H);
  assertGood(center, '中間的小物件');
  assert.equal(center.w, MIN_HIT);
  assert.equal(center.h, MIN_HIT);
  assert.ok(Math.abs(center.x + center.w / 2 - 193) <= 1, '水平置中（整數像素）');
  assert.ok(Math.abs(center.y + center.h / 2 - 403) <= 1, '垂直置中（整數像素）');
  // 比 8px 還小、整個看得到的物件（例如遠處的小東西）可以點
  assertGood(hitBox({ x: 200, y: 200, w: 4, h: 5 }, W, H), '4×5 的小物件');
  // 小物件只露一半（比 8px 小的那一半）：不能點，轉過去才能點
  assert.equal(hitBox({ x: -3, y: 200, w: 6, h: 6 }, W, H), null);
  for (const [name, p] of Object.entries({ 左上: { x: 1, y: 1, w: 6, h: 6 }, 右上: { x: W - 7, y: 1, w: 6, h: 6 }, 左下: { x: 1, y: H - 7, w: 6, h: 6 }, 右下: { x: W - 7, y: H - 7, w: 6, h: 6 } })) {
    const b = hitBox(p, W, H);
    assertGood(b, `${name}角的小物件`);
    assert.ok(covers(b, p), `${name}角：蓋住物件`);
  }
  // 標籤算在可點範圍裡（出口門下方的「回店裡」）
  const lab = hitBox({ x: 100, y: 300, w: 80, h: 200 }, W, H, 34);
  assert.equal(lab.h, 234);
});

test('hitBox：畫面內露出不到 8px 或完全在畫面外的不能點（舊算法會給 2px 的可點範圍）', () => {
  assert.equal(hitBox({ x: -35, y: 400, w: 30, h: 30 }, W, H), null, '完全在左邊外面');
  assert.equal(hitBox({ x: W + 2, y: 400, w: 30, h: 30 }, W, H), null, '完全在右邊外面');
  assert.equal(hitBox({ x: -25, y: 400, w: 30, h: 30 }, W, H), null, `只露 5px（< ${MIN_VISIBLE}）`);
  assert.equal(hitBox({ x: 100, y: H - 3, w: 30, h: 30 }, W, H), null, '下面只露 3px');
  assert.ok(hitBox({ x: -22, y: 400, w: 30, h: 30 }, W, H), `露 ${MIN_VISIBLE}px 就可以點`);
});

test('Pano 實際畫面（390×844）：五條夢想（互動前後）與店裡轉一整圈，每個可點範圍都在畫面內且至少 44×44', () => {
  const pano = new Pano(fakeCanvas());
  assert.equal(pano.W, W);
  assert.equal(pano.H, H);
  const scenes = [];
  for (const id of DREAM_ORDER) {
    scenes.push([`${id} 互動前`, dreamScene(id).scene]);
    scenes.push([`${id} 互動後`, dreamScene(id, { interacted: true }).scene]);
  }
  scenes.push(['店裡（五樣帶回物上架）', shopScene({ mode: 'seated', day: 5, takeaways: DREAM_ORDER, tone: 'dusk' })]);
  scenes.push(['開場（等點椅子）', shopScene({ mode: 'sit', day: 0 })]);
  let edgeBoxes = 0;
  for (const [name, scene] of scenes) {
    pano.setScene(scene);
    for (let yaw = -180; yaw < 180; yaw += 2) {
      pano.yaw = yaw;
      pano.frame();
      for (const b of pano.boxes) {
        assertGood(b, `${name} yaw=${yaw} ${b.item.id}`);
        const p = pano.project(b.item);
        assert.ok(p, `${name} yaw=${yaw} ${b.item.id}：在視野內才有範圍`);
        if (p.x < 0 || p.x + p.w > W || p.y < 0 || p.y + p.h > H) edgeBoxes++;
        // 範圍中心點下去，點得到某個可點物件
        let hit = null;
        pano.onTap = (it) => { hit = it; };
        pano.tapAt(b.x + b.w / 2, b.y + b.h / 2);
        assert.ok(hit, `${name} yaw=${yaw} ${b.item.id}：中心點得到`);
      }
    }
  }
  assert.ok(edgeBoxes > 0, '轉一圈的過程確實有掃到貼邊、只露一部分的物件');
});

test('Pano：正對著物件時每個物件與出口都點得到（夾範圍沒有把該點的東西漏掉）', () => {
  const pano = new Pano(fakeCanvas());
  for (const id of DREAM_ORDER) {
    const { scene, dream } = dreamScene(id);
    pano.setScene(scene);
    for (const target of [...dream.objects.map((o) => o.id), 'exit']) {
      const it = scene.items.find((x) => x.id === target);
      pano.yaw = it.angle;
      pano.frame();
      const b = pano.boxes.find((x) => x.item.id === target);
      assert.ok(b, `${id}/${target} 正對時可點`);
      assertGood(b, `${id}/${target}`);
    }
  }
});
