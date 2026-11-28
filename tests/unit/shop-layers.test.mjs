// 店內 2D 定景的前後遮擋（承峰 2026-11-28 同意的 Phase 1–3）：貓與德叔的腳線錨點、接觸陰影、配光、家具切片 y-sort、
// 摸頭的手最高、交叉淡化連切片一起淡、裁圖工具（tools/shop-cut-core.mjs）。
// 2026-11-28 畫師 17 片母檔到位：box／base 實量（與 layers_manifest.md 一致）、裁成 assets/art-v60 的 WebP、shop-cut-ready.js 列 17 片。
// 同日畫師重交 5 張 v2（夜／白天 bar_front 磨豆機球頭、三光 chair_mid 接縫外擴）：這 5 片改用 v2 母檔重裁、遊戲檔名 _v2，其餘 12 片仍 v1。
// 遮擋關係用「片的 box 與角色框有重疊、且片的 z 比角色大」判斷；逐像素的交疊量測與截圖在 tests/output/layer-shots-20261128（不進 repo）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CAT_2D, DESHU_2D, CAT_FOOT, DESHU_FOOT, CAT_H, catFrame, deshuFrame, LIGHT_FILTER, CUP_ON, SHOP_CUP, SHOP_CUP_STAND,
  lightOf, readyPieces, deshuClipped, stillOf,
} from '../../src/view/shop-still.js';
import { SHOP_PIECES, LIGHTS, Z_FRONT, ART_W, ART_H, zOf, pieceOf, cutFile, pxY } from '../../src/view/shop-pieces.js';
import { SHOP_CUT_READY } from '../../src/view/shop-cut-ready.js';
import { SHOP_CUT_MAP, SHOP_CUT_DIR, cutRefOf, ART_MAP, artUrl, SHOP_STILL_NIGHT, SHOP_STILL_DAY, SHOP_STILL_DUSK, SHOP_STILL_SEATED } from '../../src/view/art-map.js';
import { SHOP_ART } from '../../src/view/art.js';
import * as CUT from '../../tools/shop-cut-core.mjs';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const code = (p) => read(p).replace(/\/\/.*$/gm, '');
const STAND = ['night', 'day', 'dusk'];
const webpSize = (buf) => {
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  throw new Error(kind);
};

// 角色框（像素）：貓用這張圖的不透明左右範圍；德叔用整個立繪框
const catRect = (spot, img) => {
  const f = catFrame(spot, img);
  const w = (f.width / 100) * ART_W;
  const left = (f.left / 100) * ART_W;
  const [b0, b1] = CAT_FOOT[img].body;
  return [left + (b0 / 512) * w, (f.top / 100) * ART_H, left + (b1 / 512) * w, pxY(spot.y)];
};
const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
// 哪幾片會蓋在它前面（有重疊、片的 z 比它大）
const frontOf = (rect, it, light) => SHOP_PIECES[light].filter((p) => overlap(rect, p.box) && p.base > zOf(it, light)).map((p) => p.id).sort();
const catIt = (spot) => ({ foot: pxY(spot.y), on: spot.on, before: spot.before });
// 貓圖不透明輪廓（2026-11-28 r3 實量，alpha ≥ 16）：每 32 欄一段 [最上列, 最下列＋1]；null＝這段全透明。
// 每段當一個矩形（比逐像素保守：矩形裡的透明部分也算進去），換到原圖像素（含 flip：.sh-cat 以框中心左右翻）
const CAT_BANDS = {
  cat_longan_sleep: [[197, 286], [89, 313], [99, 316], [94, 325], [75, 327], [61, 325], [51, 317], [45, 329], [43, 338], [43, 340], [45, 340], [52, 339], [65, 336], [87, 328], [124, 313], [213, 276]],
  cat_longan_sit: [null, null, null, null, [23, 339], [23, 349], [49, 351], [39, 348], [31, 360], [151, 361], [173, 360], [234, 352], null, null, null, null],
  cat_longan_lick_paw_v2: [null, null, null, null, [22, 255], [23, 351], [49, 353], [42, 347], [34, 359], [147, 361], [164, 360], [210, 355], null, null, null, null],
  cat_longan_headbump_v2: [null, null, null, null, [86, 281], [23, 346], [25, 351], [57, 348], [69, 359], [68, 361], [170, 360], [218, 353], null, null, null, null],
};
const catBands = (spot, img) => {
  const f = catFrame(spot, img);
  const s = ((f.width / 100) * ART_W) / 512;
  const left = (f.left / 100) * ART_W;
  const top = (f.top / 100) * ART_H;
  return CAT_BANDS[img].map((b, i) => {
    if (!b) return null;
    let [c0, c1] = [i * 32, i * 32 + 32];
    if (spot.flip) [c0, c1] = [512 - c1, 512 - c0];
    return [left + c0 * s, top + b[0] * s, left + c1 * s, top + b[1] * s];
  }).filter(Boolean);
};
// 左桌桌面（r3 對母檔重量）：後緣＝table_left 遮罩頂（x 120–280）擬合、前緣＝底圖桌面→前裙板亮暗交界（x 90–400）擬合，y＝a·x＋c；
// corner＝兩線交點（右前角）的 x。盆栽杯：把手右緣約 x 100–105、杯底約 y 1216–1218
const TABLE_TOP = {
  night: { back: [0.1692, 1125.6], front: [-0.2502, 1309.5], corner: 438 },
  day: { back: [0.1653, 1128.9], front: [-0.2606, 1316.3], corner: 440 },
  dusk: { back: [0.1639, 1127.4], front: [-0.2541, 1311.1], corner: 439 },
};
const PLANT = { right: 106, bottom: 1219 };
const lineY = ([a, c], x) => a * x + c;
// 母檔遮罩（_agent/art-shop-layers-v1，未進 repo；不在就跳過逐像素那一段）
const MASTER_DIR = '_agent/art-shop-layers-v1';
const masks = {};
const maskOf = (light, id) => {
  const k = `${light}/${id}`;
  if (!masks[k]) masks[k] = CUT.decodePng(readFileSync(root(`${MASTER_DIR}/lyr_shop_${light}_${id}_v1.png`)));
  return masks[k];
};
// 矩形裡（原圖像素，含邊界那一格）alpha ≥ th 的像素數
const maskCount = (m, [x0, y0, x1, y1], th) => {
  let n = 0;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(m.height, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(m.width, Math.ceil(x1)); x++) if (m.data[(y * m.width + x) * 4 + 3] >= th) n++;
  }
  return n;
};
const rectArea = ([x0, y0, x1, y1]) => (Math.min(ART_W, Math.ceil(x1)) - Math.max(0, Math.floor(x0))) * (Math.min(ART_H, Math.ceil(y1)) - Math.max(0, Math.floor(y0)));
// 畫師 layers_manifest.md 的實量值（x0,y0,x1,y1 含邊；base）。shop-pieces.js 的 box 不含 x1／y1，所以是 +1
// 夜版 bar_front 是 v2（球頭右側補圓、頂端外框補 2px：v1 的 y0 是 823）；其餘 box 與 v1 相同
const MANIFEST = {
  night: { bar_front: [438, 821, 1169, 1362, 1362], table_left: [0, 1010, 453, 1711, 1711], chair_mid: [600, 1096, 930, 1642, 1642], table_right: [712, 1079, 1169, 1784, 1784], chair_front_right: [792, 1211, 1129, 1879, 1879] },
  day: { bar_front: [427, 820, 1169, 1365, 1365], table_left: [0, 1013, 455, 1717, 1717], chair_mid: [600, 1099, 930, 1646, 1646], table_right: [711, 1080, 1169, 1790, 1790], chair_front_right: [790, 1214, 1125, 1883, 1883] },
  dusk: { bar_front: [421, 821, 1169, 1363, 1363], table_left: [2, 1012, 454, 1708, 1708], chair_mid: [600, 1098, 930, 1640, 1640], table_right: [711, 1079, 1169, 1780, 1780], chair_front_right: [791, 1211, 1129, 1872, 1872] },
  seated: { table_corner: [0, 1252, 747, 2005, 2005], chair_back: [756, 1354, 1011, 2050, 2050] },
};
// 遊戲採用的母檔與定版底圖的 sha256（2026-11-28 接圖時量的；唯讀，不准改、不准重壓）。
// 5 片採用畫師重交的 v2（夜／白天 bar_front、三種光線 chair_mid），其餘 12 片採用 v1
const V2 = ['night/bar_front', 'day/bar_front', 'night/chair_mid', 'day/chair_mid', 'dusk/chair_mid'];
const MASTER_SHA = {
  'lyr_shop_day_bar_front_v2.png': '463218b85d9f7c262b114b23b83e7693e3939de3afcc56145b8d8782c4738f06',
  'lyr_shop_day_chair_front_right_v1.png': '5c7c3919285b887122e10cae80b3baf34aec9d4380a932377b186541aaedf4a9',
  'lyr_shop_day_chair_mid_v2.png': '266f6707a4382aa3419b812ce824338f20dfd31d919e7cf287c27b0ebc5452c1',
  'lyr_shop_day_table_left_v1.png': '287a8d5c45fb625d53599b41d99050b0499cc12e539f8a874bc1400ec37c0246',
  'lyr_shop_day_table_right_v1.png': '4e8279789710c73e1d9106b5a5394bab07f8b91d9848c3feff695e1e3a62f9f2',
  'lyr_shop_dusk_bar_front_v1.png': '359bb9eef21d7268277fee7e169c4ebcf91114f8e43a4d477b8e2cef265ecbbf',
  'lyr_shop_dusk_chair_front_right_v1.png': '10b1191c81937e50dcecd23accb431f0b678b6150278b068943e78d9fd7d0238',
  'lyr_shop_dusk_chair_mid_v2.png': '4311bd99990f39a04dc5eca444c32921d6867ab7213110e39a1d65e46a421299',
  'lyr_shop_dusk_table_left_v1.png': '295f62d1cd8217de16bf078fbe592e027e06877fdabfeac0a80dc1fdd028b8ed',
  'lyr_shop_dusk_table_right_v1.png': 'cac22969ca429a789502eb25e546c06a38f88b667520e29166ef1be7626508c1',
  'lyr_shop_night_bar_front_v2.png': 'cca38567bc83fc8e1a2f43513bba71cfe830b679d84901741d99ce1fd50df1bf',
  'lyr_shop_night_chair_front_right_v1.png': '2d79fb6083e445ab2761736b5cd0806df476265d628a9e33b0b597f815c445c7',
  'lyr_shop_night_chair_mid_v2.png': '7ce9089b89e3f0b2ec2883f0164f723c3b69bf07f03e406b714964d6312a2224',
  'lyr_shop_night_table_left_v1.png': '7435bd325c511c795073e5feed9da4d5ddb750ac4669f0fff761ba5d906c5d92',
  'lyr_shop_night_table_right_v1.png': '1071e8ea872898eece38b4492df6edb4cd3b9c611a81c7ef0f527d0c18200c3d',
  'lyr_shop_seated_chair_back_v1.png': '371828dd800f41a3129b50f0a66b329859a73d216ad6dc15744f126680bc0c32',
  'lyr_shop_seated_table_corner_v1.png': '096c8a3763f7e0b395d7993f38ae60f82ed1209ccc5313d8935da2b1c31b5fc3',
};
// 被 v2 取代的 5 張 v1 母檔：不再採用，但仍留著、唯讀（不刪、不改）
const MASTER_V1_REPLACED_SHA = {
  'lyr_shop_day_bar_front_v1.png': '4f19e8bbca59385038614decbb53a582f523f06f7a9756d6e19ceb710c332565',
  'lyr_shop_day_chair_mid_v1.png': 'c3e41533b29793e1fa1c2539d3f10d1476a43a2b9de6d6d436d371146ab13322',
  'lyr_shop_dusk_chair_mid_v1.png': 'cb53f8998b40ac91a727548e5117129a4f1f25f3c16cf4b3e56292b936b9712a',
  'lyr_shop_night_bar_front_v1.png': '823f7f9dd5a593b7098e9d8ae41cff6ba5fd7f651ad62315dbe77c85de31af2c',
  'lyr_shop_night_chair_mid_v1.png': '2cb0ed8e78b107198ffb2206ad62ead8d046802e9b4c745abb9951d5836b6027',
};
const BASE_SHA = {
  'assets/art/scene_shop_interior_night_lit_v2.webp': 'a9e69662d7e4cb92d5c0af7d75b8d68c02cc9c0b07b51d74a081bc61be9eae19',
  'assets/art-v59/scene_shop_interior_day_v1.webp': 'b3695d0721374b4a9b1676bcfd6665c44e787f32d19bbbd0f5272c079e72583f',
  'assets/art-v59/scene_shop_interior_dusk_v1.webp': '5f78c1cd5e49a9b82c9332ea6c097e2fc77f006e40065a3c42153b764f023ee0',
  'assets/art/scene_v3b_shop_window_night_seated.webp': '8c0fa6c9860beb5773bc3e0e7b893eaec164d178d1c106e7e876dbf43d323980',
};
const sha = (p) => createHash('sha256').update(readFileSync(root(p))).digest('hex');

test('腳線實量值（alpha ≥ 128 的最低一列）：店內用到的每張貓圖與德叔立繪都有，且在圖框裡', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(CAT_FOOT).map(([k, v]) => [k, v.y])), {
    cat_longan_sleep: 339, cat_longan_knead_v2: 348, cat_longan_sit: 360, cat_longan_walk: 340,
    cat_longan_lick_paw_v2: 359, cat_longan_ears_turn_v2: 360, cat_longan_ears_back_v2: 360, cat_longan_headbump_v2: 359,
  });
  assert.deepEqual(Object.fromEntries(Object.entries(DESHU_FOOT).map(([k, v]) => [k, v.y])), {
    char_deshu_stand: 2006, char_deshu_brew: 2006, char_deshu_broom: 2011, char_deshu_serve: 2005,
  });
  const used = new Set(['cat_longan_headbump_v2', 'cat_longan_lick_paw_v2']);
  for (const c of Object.values(CAT_2D)) { used.add(c.img); for (const s of c.seq || []) used.add(s.img); }
  for (const img of used) {
    assert.ok(CAT_FOOT[img], `${img} 沒有腳線`);
    const { y, body } = CAT_FOOT[img];
    assert.ok(y > 300 && y < 384 && body[0] >= 0 && body[1] <= 512 && body[0] < body[1], img);
  }
  for (const d of Object.values(DESHU_2D)) assert.ok(DESHU_FOOT[d.img], `${d.img} 沒有腳線`);
  assert.ok(!Object.values(CAT_2D).some((c) => (c.seq || []).some((s) => 'dy' in s)), '不再用 dy 偏移（各張用自己的腳線）');
  assert.doesNotMatch(code('src/view/shop-still.js'), /KNEAD_ON_SLEEP_LINE/);
});

test('錨點＝腳線：貓圖框放在腳線對到 spot.y 的位置（不是圖框底邊）；沒量過的圖退回圖框底邊', () => {
  for (const [k, spot] of Object.entries(CAT_2D)) {
    for (const img of [spot.img, ...(spot.seq || []).map((s) => s.img)]) {
      const f = catFrame(spot, img);
      const footPct = f.top + spot.w * CAT_H * (CAT_FOOT[img].y / 384);
      assert.ok(Math.abs(footPct - spot.y) < 1e-9, `${k}／${img}`);
      assert.ok(f.top + spot.w * CAT_H > spot.y, `${k}／${img}：圖框底邊在腳線下面（透明的部分）`);
    }
  }
  const f = catFrame({ x: 50, y: 60, w: 20 }, 'no_such_cat');
  assert.ok(Math.abs(f.top + 20 * CAT_H - 60) < 1e-9);
  assert.ok(Math.abs(CAT_H - 0.75 * 1170 / 2532) < 1e-12);
  // 德叔：腳線對到 d.y；clip fallback 的切線仍在原圖 y＝BAR_TOP
  for (const [k, d] of Object.entries(DESHU_2D)) {
    const f2 = deshuFrame(d);
    assert.ok(Math.abs(f2.top + d.h * (DESHU_FOOT[d.img].y / 2048) - d.y) < 1e-9, `德叔 ${k}`);
    assert.ok(f2.top >= 0, `德叔 ${k} 頭在圖內`);
    if (d.clip != null) assert.ok(Math.abs(f2.top + d.h * (1 - f2.clipBottom / 100) - d.clip) < 1e-9, `德叔 ${k} 的 clip 切在 ${d.clip}%`);
  }
});

test('家具切片資料：三種站姿光線各一套（不共用物件）、靠窗特寫另一套；box 在圖內、base 在 box 的 y 範圍、預留 foot', () => {
  assert.deepEqual(LIGHTS, ['night', 'day', 'dusk', 'seated']);
  const ids = ['bar_front', 'table_left', 'chair_mid', 'table_right', 'chair_front_right'];
  for (const l of STAND) assert.deepEqual(SHOP_PIECES[l].map((p) => p.id), ids, l);
  assert.deepEqual(SHOP_PIECES.seated.map((p) => p.id), ['table_corner', 'chair_back']);
  assert.notEqual(SHOP_PIECES.night[0], SHOP_PIECES.day[0], '每種光線各自一份，實量後可以不同');
  assert.notEqual(SHOP_PIECES.night[0].box, SHOP_PIECES.dusk[0].box);
  for (const l of LIGHTS) for (const p of SHOP_PIECES[l]) {
    const [x0, y0, x1, y1] = p.box;
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= ART_W && y1 <= ART_H && x0 < x1 && y0 < y1, `${l}/${p.id}`);
    assert.ok(p.base > y0 && p.base <= y1, `${l}/${p.id} base 在 box 裡`);
    assert.ok('foot' in p && 'measured' in p && p.use, `${l}/${p.id} 欄位`);
    assert.ok(p.base < Z_FRONT);
  }
  // 全部對母檔實量過：box＝manifest 含邊外框 +1（不含 x1／y1）、base＝manifest 的 base（遮罩最低點）
  for (const l of LIGHTS) {
    assert.deepEqual(SHOP_PIECES[l].map((p) => p.id).sort(), Object.keys(MANIFEST[l]).sort(), l);
    for (const p of SHOP_PIECES[l]) {
      const [x0, y0, x1, y1, base] = MANIFEST[l][p.id];
      assert.equal(p.measured, true, `${l}/${p.id} 實量`);
      assert.deepEqual(p.box, [x0, y0, x1 + 1, y1 + 1], `${l}/${p.id} box`);
      assert.equal(p.base, base, `${l}/${p.id} base`);
      assert.equal(p.base, p.box[3] - 1, `${l}/${p.id} base＝遮罩最低列`);
    }
  }
  // 目測值留作對照（程式不讀）
  assert.deepEqual(SHOP_PIECES.night[0].eyeball, { box: [440, 880, 1170, 1345], base: 1340 });
  assert.equal(pieceOf('seated', 'chair_back').eyeball, null, 'chair_back 方案沒有目測值（原本打算不切）');
});

test('y-sort 規則：片＝base、地上＝腳線、在家具上＝base+1、德叔 behind bar_front＝base−1、手＝最前', () => {
  for (const l of LIGHTS) {
    assert.equal(zOf({ foot: 1500.4 }, l), 1500);
    assert.equal(zOf({ front: true, foot: 0 }, l), Z_FRONT);
  }
  for (const l of STAND) {
    assert.equal(zOf({ foot: 100, on: 'table_right' }, l), pieceOf(l, 'table_right').base + 1);
    assert.equal(zOf({ foot: 9999, behind: 'bar_front' }, l), pieceOf(l, 'bar_front').base - 1);
    for (const k of ['stand', 'brew']) assert.ok(zOf({ foot: pxY(DESHU_2D[k].y), behind: DESHU_2D[k].behind }, l) < pieceOf(l, 'bar_front').base, `德叔 ${k} z 在 bar_front 下面（${l}）`);
  }
  assert.equal(zOf({ foot: 1234, on: 'no_such_piece' }, 'night'), 1234, '沒有那一片就照腳線');
  // 杯子在桌上
  for (const l of STAND) assert.equal(zOf({ foot: pxY(SHOP_CUP_STAND.y), on: CUP_ON.stand }, l), pieceOf(l, 'table_left').base + 1);
  assert.equal(zOf({ foot: pxY(SHOP_CUP.y), on: CUP_ON.seated }, 'seated'), pieceOf('seated', 'table_corner').base + 1);
  assert.equal(CAT_2D.chair.on, 'chair_mid');
  // nap：承峰 2026-11-28 09:59 從右桌改到左桌（臉要看得到）；z＝左桌 base＋1
  assert.equal(CAT_2D.nap.on, 'table_left');
  for (const l of STAND) assert.equal(zOf(catIt(CAT_2D.nap), l), pieceOf(l, 'table_left').base + 1);
  // before：在那片前面的地上（z＝base＋1）；只剩對面椅上的龍眼（across）寫例外，位置不動
  assert.equal(zOf({ foot: 100, before: 'chair_back' }, 'seated'), 2051);
  assert.equal(CAT_2D.across.before, 'chair_back');
  assert.deepEqual([CAT_2D.across.x, CAT_2D.across.y, CAT_2D.across.w], [59, 73.5, 28], 'across 位置沒動');
  // feetSeated：承峰 2026-11-28 11:25 改到對面椅子（chair_back）右邊的地板；沒有例外、照腳線排序（沒有 before、沒有 on）
  assert.ok(!('before' in CAT_2D.feetSeated) && !('on' in CAT_2D.feetSeated), 'feetSeated 不寫例外');
  assert.deepEqual([CAT_2D.feetSeated.x, CAT_2D.feetSeated.y, CAT_2D.feetSeated.w], [87, 78.6, 26]);
  assert.equal(zOf(catIt(CAT_2D.feetSeated), 'seated'), Math.round(pxY(CAT_2D.feetSeated.y)), 'z＝腳線像素');
  assert.match(code('src/view/shop-still.js'), /zOf\(\{ foot: pxY\(spot\.y\), on: spot\.on, before: spot\.before \}, lt\)/);
});

test('驗收（實量 box／base）：三種站姿光線都同一套遮擋；龍眼不被自己趴的那張擋、被前面的椅背桌緣擋；德叔在吧台後', () => {
  for (const l of STAND) {
    // 跳上吧台前那張椅子：不被 chair_mid 擋，右邊被右桌桌角與右前椅擋
    for (const img of ['cat_longan_knead_v2', 'cat_longan_sleep', 'cat_longan_ears_turn_v2']) {
      const front = frontOf(catRect(CAT_2D.chair, img), catIt(CAT_2D.chair), l);
      assert.ok(!front.includes('chair_mid'), `${l} chair／${img}`);
      assert.ok(front.includes('chair_front_right'), `${l} chair／${img} 被右前椅擋：${front}`);
    }
    // 趴在左桌桌面上：不被左桌（自己趴的那張）擋，也不再被右前曲木椅擋（臉要看得到），沒有任何片蓋在牠前面
    const napFront = frontOf(catRect(CAT_2D.nap, 'cat_longan_sleep'), catIt(CAT_2D.nap), l);
    assert.ok(!napFront.includes('table_left'), `${l} nap 被左桌自己擋就是錯的`);
    assert.ok(!napFront.includes('chair_front_right'), `${l} nap 不被右前椅擋`);
    assert.deepEqual(napFront, [], `${l} nap`);
    // 穩穩趴在左桌桌面上（承峰 2026-11-28 11:25：舊位置前爪搭在前緣「看起來會掉下來」）；
    // 承峰 2026-11-28 14:13：放回原本大小（w 17–18）、挪到桌心、背可以稍超過後緣。所以：
    //   睡姿不透明輪廓每一段的下緣（前爪／身體）都在前緣以上、留安全距離；上緣可以越出後緣，但只能「稍」：≤ 75px（約貓身高 6 成，
    //   腳線那一列仍在後緣以下）；右前角以左，不碰盆栽杯（左邊離盆栽把手 ≥ 15px）
    const T = TABLE_TOP[l];
    const nap = CAT_2D.nap;
    assert.ok(nap.w >= 17 && nap.w <= 18, `nap 原本大小（w ${nap.w}）`);
    for (const [x0, y0, x1, y1] of catBands(nap, 'cat_longan_sleep')) {
      for (const x of [x0, x1]) {
        assert.ok(lineY(T.back, x) - y0 <= 75, `${l} nap 背只稍超過後緣（x ${x.toFixed(0)}：越出 ${(lineY(T.back, x) - y0).toFixed(1)}px）`);
        assert.ok(lineY(T.front, x) - y1 >= 12, `${l} nap 前爪／身體不搭在前緣（x ${x.toFixed(0)}：${(lineY(T.front, x) - y1).toFixed(1)}px）`);
      }
      assert.ok(x1 < T.corner - 60, `${l} nap 不到右前角`);
      assert.ok(x0 > PLANT.right + 15, `${l} nap 不擋盆栽、不貼著盆栽`);
    }
    // 腳線那一列與圖框底邊（前爪那一列），在圖框中心那一欄：低於後緣、明顯高於前緣（不是貼齊前緣）；中心在盆栽與右前角之間
    const xc = (nap.x / 100) * ART_W;
    const nf = catFrame(nap, 'cat_longan_sleep');
    const frameBottom = ((nf.top + nap.w * CAT_H) / 100) * ART_H;
    assert.ok(pxY(nap.y) - lineY(T.back, xc) > 40, `${l} nap 腳線在後緣以下（貼地的那一列在桌面上）`);
    assert.ok(lineY(T.front, xc) - pxY(nap.y) >= 20, `${l} nap 腳線離前緣 ≥ 20px（${(lineY(T.front, xc) - pxY(nap.y)).toFixed(1)}）`);
    assert.ok(lineY(T.front, xc) - frameBottom >= 8, `${l} nap 圖框底邊在前緣以上（${(lineY(T.front, xc) - frameBottom).toFixed(1)}）`);
    assert.ok(xc > PLANT.right + 80 && xc < T.corner - 120, `${l} nap 在桌心（盆栽與右前角之間，x ${xc.toFixed(0)}）`);
    // 身體在左桌片的 x 範圍裡
    const napRect = catRect(CAT_2D.nap, 'cat_longan_sleep');
    assert.ok(napRect[0] > pieceOf(l, 'table_left').box[0] && napRect[2] < pieceOf(l, 'table_left').box[2], `${l} nap 不懸出左桌`);
    // 地上鏡頭前（進門、聞鞋、蹭、腳邊、耳朵往後）：都在家具前面
    for (const k of ['doorway', 'shoes', 'rub', 'feet', 'earsBack']) assert.deepEqual(frontOf(catRect(CAT_2D[k], CAT_2D[k].img), catIt(CAT_2D[k]), l), [], `${l} ${k}`);
    // 德叔站吧台後：吧台（含磨豆機、白杯）在他前面
    for (const k of ['stand', 'brew']) {
      const d = DESHU_2D[k];
      const f = deshuFrame(d);
      const wpx = (d.h / 100) * ART_H * 0.5;
      const rect = [(d.x / 100) * ART_W - wpx / 2, (f.top / 100) * ART_H, (d.x / 100) * ART_W + wpx / 2, pxY(d.y)];
      assert.ok(frontOf(rect, { foot: pxY(d.y), behind: d.behind }, l).includes('bar_front'), `${l} 德叔 ${k}`);
    }
    // 杯子放在左桌上：不被左桌擋
    assert.ok(zOf({ foot: pxY(SHOP_CUP_STAND.y), on: CUP_ON.stand }, l) > pieceOf(l, 'table_left').base);
    // 德叔端杯（站在左桌右邊走道）：逐像素交疊實量 0px（立繪不透明最左 x 464 > 左桌遮罩最右 x 455），不靠例外；
    // 位置沒動（x51 y67 h40）、不 clip、不 behind。掃地（腳線 1772）在左桌（≤1717）前面
    assert.deepEqual([DESHU_2D.serveTable.x, DESHU_2D.serveTable.y, DESHU_2D.serveTable.h], [51, 67, 40]);
    assert.ok(pieceOf(l, 'table_left').box[2] <= 456, `${l} 左桌右緣`);
    assert.ok(zOf({ foot: pxY(DESHU_2D.broom.y) }, l) > pieceOf(l, 'table_left').base, `${l} 掃地在左桌前`);
    for (const k of ['serveTable', 'broom']) assert.equal(deshuClipped(DESHU_2D[k]), false, `${l} ${k} 不 clip`);
  }
  // 靠窗特寫：across 寫例外畫在兩片前面
  assert.deepEqual(frontOf(catRect(CAT_2D.across, CAT_2D.across.img), catIt(CAT_2D.across), 'seated'), [], 'across');
  // feetSeated（承峰 2026-11-28 11:25 改到椅右地板）：沒有例外、z＝腳線 1990 < chair_back.base 2050，
  //   所以照排序 chair_back 在牠前面（box 有重疊），table_corner 不在前面；但三張圖的不透明輪廓都在椅背右緣右邊，
  //   實際被椅背蓋到的像素是 0（不該被擋的沒被擋）
  const fs = CAT_2D.feetSeated;
  for (const img of ['cat_longan_sit', 'cat_longan_lick_paw_v2', 'cat_longan_headbump_v2']) {
    assert.deepEqual(frontOf(catRect(fs, img), catIt(fs), 'seated'), ['chair_back'], `feetSeated／${img}：排序上只有椅背在前面`);
    const bands = catBands(fs, img);
    const minX = Math.min(...bands.map((r) => r[0]));
    const maxX = Math.max(...bands.map((r) => r[2]));
    // 椅背母檔 y 1700 以下每列最右不透明 x ≤ 936（r3 實量：1700→936、1800→914、1900→896、2000→892）；右牆＝畫面右緣
    assert.ok(minX > 936 + 4 && maxX <= ART_W, `feetSeated／${img} 在椅背右緣與右牆之間（x ${minX.toFixed(0)}–${maxX.toFixed(0)}）`);
    assert.ok(Math.min(...bands.map((r) => r[1])) > 1700, `feetSeated／${img} 整隻在牆腳以下的地板範圍`);
  }
  assert.ok(pxY(fs.y) > 1760 && pxY(fs.y) < pieceOf('seated', 'chair_back').base, 'feetSeated 腳線在椅右地板（牆腳以下、椅背立桿下緣以上）');
  assert.ok((fs.x - fs.w / 2) / 100 * ART_W > pieceOf('seated', 'table_corner').box[2], 'feetSeated 不在桌角那一側');
  // 沒有例外的話：across 會被桌角與椅背擋（所以 across 的例外留著）
  assert.deepEqual(frontOf(catRect(CAT_2D.across, 'cat_longan_sleep'), { foot: pxY(CAT_2D.across.y) }, 'seated'), ['chair_back', 'table_corner']);
  // 摸頭的手在所有片前面
  for (const l of LIGHTS) for (const p of SHOP_PIECES[l]) assert.ok(Z_FRONT > p.base);
});

test('逐像素（母檔遮罩）：nap 睡姿後緣以下的部分都在左桌桌面上（背可稍超過後緣）；feetSeated 三張圖不被椅背、桌角蓋到', (t) => {
  if (!existsSync(root(MASTER_DIR))) { t.skip('母檔資料夾不在（未進 repo）'); return; }
  // nap（承峰 2026-11-28 14:13：背可以稍超過後緣）：睡姿輪廓每段矩形（含透明部分，比實際保守）切掉後緣以上那一截
  //   （後緣取這段兩端較低的那一側再加 2px），剩下的部分裡 table_left 遮罩每一個像素都不透明＝貼著桌面的身體與前爪都落在桌面上
  for (const l of STAND) {
    const m = maskOf(l, 'table_left');
    const T = TABLE_TOP[l];
    for (const [x0, y0, x1, y1] of catBands(CAT_2D.nap, 'cat_longan_sleep')) {
      const r = [x0, Math.max(y0, Math.max(lineY(T.back, x0), lineY(T.back, x1)) + 2), x1, y1];
      assert.ok(r[3] - r[1] > 10, `${l} nap 這段 ${r.map((n) => n.toFixed(0))} 有身體在後緣以下`);
      assert.equal(maskCount(m, r, 128), rectArea(r), `${l} nap 這段 ${r.map((n) => n.toFixed(0))} 後緣以下都在 table_left 上`);
    }
  }
  // feetSeated：sit／舔前腳／頂頭三張的輪廓矩形裡，chair_back 與 table_corner 遮罩一個像素都沒有（alpha > 0 就算）
  for (const img of ['cat_longan_sit', 'cat_longan_lick_paw_v2', 'cat_longan_headbump_v2']) {
    for (const id of ['chair_back', 'table_corner']) {
      const m = maskOf('seated', id);
      const n = catBands(CAT_2D.feetSeated, img).reduce((s, r) => s + maskCount(m, r, 1), 0);
      assert.equal(n, 0, `feetSeated／${img} 與 ${id} 交疊 ${n}px`);
    }
  }
});

test('光線：定景 → night／day／dusk／seated；配光濾鏡日／傍晚／夜看得出差別，貓、德叔、杯子走同一套', () => {
  assert.equal(lightOf({ night: 1 }), 'night');
  assert.equal(lightOf({ tone: 'morning' }), 'day');
  assert.equal(lightOf({ tone: 'dusk' }), 'dusk');
  assert.equal(lightOf({ tone: 'dusk', night: 1 }), 'night');
  assert.equal(lightOf({}), 'night');
  assert.equal(lightOf({ tone: 'morning' }, true), 'seated');
  for (const [look, still] of [[{ night: 1 }, SHOP_STILL_NIGHT], [{ tone: 'morning' }, SHOP_STILL_DAY], [{ tone: 'dusk' }, SHOP_STILL_DUSK]]) assert.equal(stillOf(look), still);
  assert.equal(stillOf({}, true), SHOP_STILL_SEATED);
  assert.equal(new Set([LIGHT_FILTER.day, LIGHT_FILTER.dusk, LIGHT_FILTER.night]).size, 3);
  const bright = (f) => Number((f.match(/brightness\(([\d.]+)\)/) || [])[1]);
  assert.ok(bright(LIGHT_FILTER.day) >= 0.98, '白天接近原圖');
  assert.ok(bright(LIGHT_FILTER.night) >= 0.8 && bright(LIGHT_FILTER.night) <= 0.9, '夜約 .85');
  assert.ok(bright(LIGHT_FILTER.dusk) > bright(LIGHT_FILTER.night) && /sepia/.test(LIGHT_FILTER.dusk), '傍晚偏暖');
  assert.equal(LIGHT_FILTER.seated, LIGHT_FILTER.night);
  const css = read('index.html');
  assert.match(css, /\.sh-cat-img \{[^}]*filter: var\(--lit\);/);
  assert.match(css, /\.sh-deshu \{[^}]*filter: var\(--lit\) drop-shadow/);
  assert.match(css, /\.sh-cup \{[^}]*filter: var\(--lit\) drop-shadow/);
  assert.match(code('src/view/shop-still.js'), /el\.style\.setProperty\('--lit', LIGHT_FILTER\[lt\]\);/);
  // 接觸陰影：貓在腳線上、德叔在腳底（被 clip 擋時不放）
  assert.match(code('src/view/shop-still.js'), /<div class="sh-cat" hidden><span class="sh-cat-shadow"/);
  assert.match(code('src/view/shop-still.js'), /if \(!clipped\) \{/);
  assert.match(css, /\.sh-deshu-shadow, \.sh-cat-shadow \{[^}]*radial-gradient/);
});

test('同一個 stacking context：.sh-cat 不再固定 z-index:2；手拆成兄弟元素、z 最高；德叔站吧台後一律 clip（切片到了也是）', () => {
  const css = read('index.html');
  assert.doesNotMatch(css, /\.sh-cat \{[^}]*z-index/);
  assert.match(css, /\.sh-hand-box \{ position: absolute; aspect-ratio: 512 \/ 384;/);
  const shop = code('src/view/shop-still.js');
  assert.doesNotMatch(shop, /<div class="sh-cat" hidden>[^\n]*sh-hand/, '手不在 .sh-cat 裡');
  assert.match(shop, /<div class="sh-hand-box" aria-hidden="true"><img class="sh-hand"/);
  assert.match(shop, /handBox\.style\.zIndex = String\(Z_FRONT\);/);
  assert.match(shop, /cat\.style\.zIndex = String\(zOf\(\{ foot: pxY\(spot\.y\), on: spot\.on, before: spot\.before \}, lt\)\)/);
  assert.match(shop, /clipPath: clipped \?/);
  // 站吧台後的德叔：bar_front 切片都到了仍 clip。實量：腳線 y 1299 比吧台在 x 900–1100 的下緣（約 1185）低，
  // 只靠切片的話小腿從吧台下緣漏出來（夜 stand 約 740px、brew 約 800px）
  for (const l of STAND) {
    assert.ok(SHOP_CUT_READY[l].bar_front, `${l} bar_front 到位`);
    for (const k of ['stand', 'brew']) {
      assert.equal(deshuClipped(DESHU_2D[k]), true, `${l} ${k}`);
      assert.ok(pxY(DESHU_2D[k].y) > 1185, '腳線比吧台下緣低（所以要 clip）');
    }
  }
  for (const k of ['broom', 'serveTable']) assert.equal(deshuClipped(DESHU_2D[k]), false);
  const fake = { night: { bar_front: { box: SHOP_PIECES.night[0].box } }, day: {}, dusk: {}, seated: {} };
  assert.deepEqual(readyPieces('night', fake).map((p) => [p.id, p.ref]), [['bar_front', 'art-v60/lyr_shop_night_bar_front_v2']]);
  assert.deepEqual(readyPieces('day', fake), []);
});

test('交叉淡化：底圖與該光線的切片一起淡；新片插在底圖正後面（舊片 DOM 在後、同 z 蓋在上面一起淡掉）', () => {
  const shop = code('src/view/shop-still.js');
  assert.match(shop, /const fade = fadesBetween\(shown, id\);/);
  assert.match(shop, /if \(fade\) crossFade\(bg\.getAttribute\('src'\)\);/);
  assert.match(shop, /if \(lt !== light\) \{ placePieces\(lt, fade\); light = lt; \}/);
  assert.match(shop, /for \(const im of \[\.\.\.pieces\]\.reverse\(\)\) bg\.after\(im\);/);
  assert.match(shop, /o\.classList\.add\('sh-piece-old'\);/);
  assert.match(shop, /oldPieces\.forEach\(\(p\) => p\.remove\(\)\);/, 'dropOld 連舊片一起收');
  assert.match(read('index.html'), /\.sh-piece \{ position: absolute; pointer-events: none; transition: opacity 1\.2s ease; \}/);
  assert.match(shop, /im\.addEventListener\('error', \(\) => \{ im\.style\.visibility = 'hidden'; \}\);/, '片載不到也不閃破圖');
  assert.doesNotMatch(shop, /requestAnimationFrame|getContext|<canvas/);
});

test('切片 slot（art-map.js 的 SHOP_CUT_MAP）：每片一格、光線用 variants、檔名 lyr_shop_{光線}_{片}_v{ver}；不進 ART_MAP；沒有袋子與花斑貓', () => {
  assert.equal(SHOP_CUT_DIR, 'art-v60');
  assert.doesNotMatch(read('src/view/art-map.js') + read('tools/shop-cut.mjs'), /art-v60\/L|暫記|暫定/, '資料夾已定名，不留暫定標註');
  for (const l of LIGHTS) for (const p of SHOP_PIECES[l]) {
    const slot = SHOP_CUT_MAP[`shop_cut_${p.id}`];
    assert.ok(slot && slot.piece === p.id, p.id);
    assert.equal(slot.variants[l], cutFile(l, p.id));
    assert.equal(cutRefOf(p.id, l), `art-v60/${cutFile(l, p.id)}`);
  }
  assert.equal(cutRefOf('table_corner', 'night'), null, '靠窗桌角只有 seated');
  assert.equal(cutRefOf('chair_back', 'seated'), 'art-v60/lyr_shop_seated_chair_back_v1');
  assert.equal(cutRefOf('chair_back', 'night'), null);
  assert.equal(Object.keys(SHOP_CUT_MAP).length, 7);
  for (const k of Object.keys(SHOP_CUT_MAP)) assert.ok(!(k in ART_MAP));
  const ids = [...Object.keys(SHOP_CUT_MAP), ...LIGHTS.flatMap((l) => SHOP_PIECES[l].map((p) => p.id))].join(' ');
  assert.doesNotMatch(ids, /bag|huaban|calico|longan_dry/, '袋子與花斑貓【待定】：不留會被執行的片');
  assert.doesNotMatch(code('src/view/shop-still.js') + code('src/view/shop-pieces.js'), /huaban|calico/);
  assert.match(read('src/view/shop-still.js'), /【待定】花斑貓/);
  assert.match(read('src/view/shop-pieces.js'), /【待定】龍眼乾袋/);
});

test('切片清單 shop-cut-ready.js：與工具寫的格式一致；列上的片 box 與資料相同、已實量、檔案在且尺寸對；預載只含到位的片', () => {
  assert.equal(read('src/view/shop-cut-ready.js').replace(/\r\n/g, '\n'), CUT.renderReady(SHOP_CUT_READY), '照工具格式（換行不計）');
  assert.deepEqual(Object.keys(SHOP_CUT_READY), LIGHTS);
  const refs = [];
  for (const l of LIGHTS) for (const [id, v] of Object.entries(SHOP_CUT_READY[l])) {
    const p = pieceOf(l, id);
    assert.ok(p, `${l}/${id} 不是資料裡的片`);
    assert.deepEqual(v.box, p.box, `${l}/${id} 裁切後 box 被改過，要重裁`);
    assert.equal(p.measured, true, `${l}/${id} 沒實量就裁了`);
    const ref = cutRefOf(id, l);
    assert.ok(existsSync(root(artUrl(ref))), `缺 ${artUrl(ref)}`);
    assert.deepEqual(webpSize(readFileSync(root(artUrl(ref)))), [p.box[2] - p.box[0], p.box[3] - p.box[1]]);
    assert.ok(SHOP_ART.includes(ref), `${ref} 沒預載`);
    refs.push(ref);
  }
  assert.deepEqual(SHOP_ART.filter((n) => n.startsWith(`${SHOP_CUT_DIR}/`)).sort(), refs.sort(), '沒到位的片不預載（不發 404 請求）');
  // 17 片全部到位：夜／白天／傍晚各 5、靠窗特寫 2（與 shop-pieces.js 一一對應）
  assert.equal(refs.length, 17);
  for (const l of LIGHTS) assert.deepEqual(readyPieces(l).map((p) => p.id), SHOP_PIECES[l].map((p) => p.id), `${l} 全部到位`);
  assert.ok(SHOP_ART.includes('art-v60/lyr_shop_seated_chair_back_v1'), 'chair_back 有預載');
  assert.ok(!existsSync(root('assets/art-v60/L')), '舊的 L 子資料夾已搬空刪掉，不留兩份');
});

test('定版底圖不動：assets/art、art-v56、art-v59、public/bg 沒有被改動或刪除；店內四張底圖 hash 不變', (t) => {
  for (const [p, h] of Object.entries(BASE_SHA)) assert.equal(sha(p), h, `${p} 被改了`);
  let out;
  try { out = execFileSync('git', ['status', '--porcelain', '--', 'assets/art', 'assets/art-v56', 'assets/art-v59', 'public/bg'], { cwd: root('.'), encoding: 'utf8' }); } catch { t.skip('沒有 git'); return; }
  const changed = out.split('\n').filter((l) => l && !l.startsWith('??'));
  assert.deepEqual(changed, []);
});

test('採用的母檔版本：5 片 v2（夜／白天 bar_front、三光 chair_mid）、其餘 12 片 v1；遊戲檔名跟著版本走', () => {
  const v2 = LIGHTS.flatMap((l) => SHOP_PIECES[l].filter((p) => p.ver === 2).map((p) => `${l}/${p.id}`));
  assert.deepEqual(v2.sort(), [...V2].sort());
  for (const l of LIGHTS) for (const p of SHOP_PIECES[l]) {
    assert.equal(p.ver, V2.includes(`${l}/${p.id}`) ? 2 : 1, `${l}/${p.id}`);
    assert.equal(cutFile(l, p.id), `lyr_shop_${l}_${p.id}_v${p.ver}`);
    assert.ok(`${cutFile(l, p.id)}.png` in MASTER_SHA, `${l}/${p.id} 的遊戲檔名要對到採用的母檔`);
  }
  assert.equal(cutFile('dusk', 'bar_front'), 'lyr_shop_dusk_bar_front_v1', '傍晚 bar_front 沒有 v2，沿用 v1');
  assert.equal(cutFile('night', 'bar_front'), 'lyr_shop_night_bar_front_v2');
  assert.deepEqual(pieceOf('night', 'bar_front').box, [438, 821, 1170, 1363], '夜版 bar_front v2 頂端多 2px');
  // 被取代的 5 個 v1 遊戲檔已刪（不留兩份）；其他 12 個 v1 遊戲檔還在
  for (const k of V2) {
    const [l, id] = k.split('/');
    assert.ok(!existsSync(root(`assets/${SHOP_CUT_DIR}/lyr_shop_${l}_${id}_v1.webp`)), `${k} 的 v1 遊戲檔要刪掉`);
    assert.ok(existsSync(root(artUrl(cutRefOf(id, l)))), `${k} 的 v2 遊戲檔`);
  }
  assert.ok(!SHOP_ART.some((r) => V2.some((k) => r === `${SHOP_CUT_DIR}/lyr_shop_${k.replace('/', '_')}_v1`)), '不預載被取代的 v1');
});

test('畫師母檔（_agent/art-shop-layers-v1）唯讀：採用的 17 張與被取代的 5 張 v1 hash 都不變', (t) => {
  const dir = '_agent/art-shop-layers-v1';
  if (!existsSync(root(dir))) { t.skip('母檔資料夾不在（未進 repo）'); return; }
  assert.equal(Object.keys(MASTER_SHA).length, 17);
  assert.equal(Object.keys(MASTER_V1_REPLACED_SHA).length, 5);
  for (const [f, h] of Object.entries({ ...MASTER_SHA, ...MASTER_V1_REPLACED_SHA })) assert.equal(sha(`${dir}/${f}`), h, `${f} 被改了`);
});

/* ---------- 裁圖工具（tools/shop-cut-core.mjs；CLI 是 tools/shop-cut.mjs） ---------- */
// 夾具：小張合成圖（不是任何底圖）
const fixture = (w, h, fn) => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};

test('裁圖工具：PNG 讀寫來回一致（RGBA、straight alpha，含半透明）；只收 8-bit RGBA／RGB', () => {
  const img = fixture(37, 23, (x, y) => [x * 6, y * 11, (x * y) % 256, (x + y) % 3 === 0 ? 0 : 40 + x * 5]);
  const back = CUT.decodePng(CUT.encodePng(img));
  assert.equal(back.width, 37);
  assert.equal(back.height, 23);
  assert.deepEqual(Buffer.from(back.data), Buffer.from(img.data), '半透明像素的 RGB 原樣保留（不預乘）');
  assert.throws(() => CUT.decodePng(Buffer.from('RIFF....WEBPVP8 ')), /不是 PNG/, 'WebP 底圖不能當母檔');
});

test('裁圖工具：裁切位置正確；box 不合法就丟錯', () => {
  const img = fixture(20, 10, (x, y) => [x, y, 0, 255]);
  const c = CUT.crop(img, [3, 2, 8, 6]);
  assert.equal(c.width, 5);
  assert.equal(c.height, 4);
  assert.deepEqual([...c.data.subarray(0, 4)], [3, 2, 0, 255]);
  assert.deepEqual([...c.data.subarray(c.data.length - 4)], [7, 5, 0, 255]);
  for (const b of [[0, 0, 21, 5], [5, 5, 5, 6], [-1, 0, 3, 3], [0, 0, 2.5, 3]]) assert.throws(() => CUT.crop(img, b), /box 不合法/);
});

test('裁圖工具：母檔檢查（尺寸要 1170×2532 對齊；幾乎不透明＝底圖充當，不收）', () => {
  const ok = { width: 1170, height: 2532, data: new Uint8Array(1170 * 2532 * 4) };
  assert.ok(CUT.checkMaster(ok).clearRatio > 0.99);
  const opaque = { width: 1170, height: 2532, data: new Uint8Array(1170 * 2532 * 4).fill(255) };
  assert.throws(() => CUT.checkMaster(opaque), /不像切片母檔/);
  assert.throws(() => CUT.checkMaster(fixture(10, 10, () => [0, 0, 0, 0])), /尺寸/);
});

test('裁圖工具：在母檔上量 box（含半透明邊外擴 2px）與最低不透明列', () => {
  const img = fixture(200, 300, (x, y) => (x >= 50 && x < 120 && y >= 80 && y < 210 ? [200, 100, 50, x === 50 ? 60 : 255] : [0, 0, 0, 0]));
  const m = CUT.measure(img, [40, 70, 130, 220], { pad: 20 });
  assert.equal(m.found, true);
  assert.deepEqual(m.box, [48, 78, 122, 212]);
  assert.equal(m.lowest, 209);
  assert.deepEqual(m.opaqueBox, [51, 80, 120, 210]);
  assert.equal(CUT.measure(fixture(50, 50, () => [0, 0, 0, 0]), [0, 0, 50, 50]).found, false);
});

test('裁圖工具：只裁實量過的片；輸出不准寫進只讀資料夾；檔名照美術清單', () => {
  const pieces = { night: [{ id: 'a', box: [0, 0, 10, 10], base: 9, measured: true }, { id: 'b', box: [0, 0, 5, 5], base: 4, measured: false }] };
  assert.deepEqual(CUT.planCuts(pieces, 'night'), { cuts: [{ id: 'a', box: [0, 0, 10, 10], file: 'lyr_shop_night_a_v1' }], skipped: ['b'] });
  // 檔名版本跟著片的 ver（沒寫＝1）；母檔名是 lyr_shop_… 時版本、光線、片都要對得上，一張母檔只裁一片
  const v2 = { night: [{ id: 'bar_front', box: [0, 0, 10, 10], base: 9, measured: true, ver: 2 }, { id: 'chair_mid', box: [0, 0, 5, 5], base: 4, measured: true }] };
  const c2 = CUT.planCuts(v2, 'night', { only: ['bar_front'] }).cuts;
  assert.equal(c2[0].file, 'lyr_shop_night_bar_front_v2');
  assert.equal(CUT.checkMasterName('lyr_shop_night_bar_front_v2.png', 'night', c2), 'bar_front');
  assert.throws(() => CUT.checkMasterName('lyr_shop_night_bar_front_v1.png', 'night', c2), /是 v1/, 'v1 母檔不可裁成 v2 檔名');
  assert.throws(() => CUT.checkMasterName('lyr_shop_day_bar_front_v2.png', 'night', c2), /光線/);
  assert.throws(() => CUT.checkMasterName('lyr_shop_night_bar_front_v2.png', 'night', CUT.planCuts(v2, 'night').cuts), /--only bar_front/);
  assert.throws(() => CUT.checkMasterName('lyr_shop_night_chair_mid_v1.png', 'night', c2), /--only chair_mid/);
  assert.equal(CUT.checkMasterName('fixture.png', 'night', c2), null, '夾具檔名不檢查');
  assert.match(read('tools/shop-cut.mjs'), /checkMasterName\(basename\(masterPath\), opt\.light, cuts\);/);
  assert.deepEqual(CUT.planCuts(pieces, 'night', { allowUnmeasured: true }).skipped, []);
  assert.deepEqual(CUT.planCuts(pieces, 'night', { only: ['b'] }).cuts, []);
  assert.throws(() => CUT.planCuts(pieces, 'day'), /沒有要裁的片/);
  // 正式資料全部實量過：每片都裁得出來、沒有略過
  for (const l of LIGHTS) {
    const { cuts, skipped } = CUT.planCuts(SHOP_PIECES, l);
    assert.equal(cuts.length, SHOP_PIECES[l].length, l);
    assert.deepEqual(skipped, [], l);
  }
  const repo = root('.');
  for (const d of ['assets/art', 'assets/art/x', 'assets/art-v56/C', 'assets/art-v59', 'public/bg']) assert.throws(() => CUT.checkOutDir(d, repo), /只讀/, d);
  assert.ok(CUT.checkOutDir('assets/art-v60', repo));
  assert.ok(CUT.checkOutDir('tests/output/cut', repo));
  assert.equal(cutFile('dusk', 'chair_mid'), 'lyr_shop_dusk_chair_mid_v2');
  assert.equal(cutFile('dusk', 'table_left'), 'lyr_shop_dusk_table_left_v1');
});

test('裁圖工具：邊緣檢查（同圖誤差 0、RGB 偏了會量到）；ready 清單格式', () => {
  const a = fixture(8, 8, (x, y) => [100, 120, 140, x < 4 ? 255 : 128]);
  assert.deepEqual(CUT.edgeError(a, a), { mean: 0, max: 0, alphaMax: 0 });
  const b = { ...a, data: a.data.map((v, i) => (i % 4 === 0 ? v + 30 : v)) };
  assert.ok(CUT.edgeError(a, b).mean > 5);
  const txt = CUT.renderReady({ night: { chair_mid: { box: [1, 2, 3, 4] }, bar_front: { box: [5, 6, 7, 8] } }, day: {}, dusk: {}, seated: {} });
  assert.match(txt, /night: \{\n {4}bar_front: \{ box: \[5, 6, 7, 8\] \},\n {4}chair_mid: \{ box: \[1, 2, 3, 4\] \},\n {2}\},\n {2}day: \{\},/);
});
