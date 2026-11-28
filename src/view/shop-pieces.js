// 店內 2D 定景的家具切片與前後排序（y-sort）。純資料＋純函式：不碰 DOM，單元測試直接測。
// 做法（承峰 2026-11-28 00:50／08:19 同意的 Phase 1–3）：桌椅、吧台仍烤在底圖裡；畫師另交與底圖逐像素對齊的 1170×2532 透明母檔，
// 用 tools/shop-cut.mjs 依下面每片的 box 裁成小圖（WebP），疊在角色前面，靠 z-index 排前後。沒有 canvas、沒有動畫迴圈。
//
// 座標：原圖像素（1170×2532），左上角為 0。
//   box  ：[x0, y0, x1, y1]，裁切範圍（x1／y1 不含）。
//   base ：這片的排序線＝家具碰到地面最前面那一點的 y（像素）。片的 z＝base。
//   foot ：地面接觸線或多邊形，預留欄位（D8：不做 2D 走動、不寫透視換算），現在只當註記，程式不讀。
//   measured：box／base 是不是已經對著畫師母檔實量過。false＝方案目測值（誤差約 ±15px），tools/shop-cut.mjs 不拿它裁切
//             （要先跑 --measure，照母檔的實量結果改這裡、改成 true，才裁得出遊戲檔）。
//   eyeball：實量之前的方案目測值（box、base），只留作對照紀錄，程式不讀。
// 排序規則（方案 2.3）：
//   片：z＝base。地上的角色：z＝腳線 y（像素）。在家具上面的（杯子在桌上、貓趴在桌上／椅上，on: 片 id）：z＝那片的 base＋1。
//   例外寫死：德叔 behind: 'bar_front'（z＝bar_front.base−1）；摸頭的手 z＝Z_FRONT（最高，不跟著貓被椅背擋）；
//   對面椅上的龍眼 before: 'chair_back'（z＝那片 base＋1；見下面 seated 的說明）。靠窗特寫腳邊的龍眼（feetSeated）
//   承峰 2026-11-28 11:25 起改到 chair_back 那張椅子右邊的地板，照腳線排序，沒有例外。
//   穿插的家具切成兩片、各給 base，不寫特例邏輯。
// 三種站姿光線（night／day／dusk）同構圖但不是逐像素對齊：每種光線各一套 box／base，不共用遮罩。
// 靠窗特寫（seated，僅夜）構圖不同，另一套。

export const ART_W = 1170;
export const ART_H = 2532;
export const Z_FRONT = 9999; // 摸頭的手：永遠在最前面
export const LIGHTS = ['night', 'day', 'dusk', 'seated'];

// 實量（2026-11-28，畫師母檔 _agent/art-shop-layers-v1/lyr_shop_{光線}_{片名}_v{ver}.png）：
//   box＝alpha > 0 的外框，x1／y1 不含（＝畫師 layers_manifest.md 的含邊外框 +1）；tools/shop-cut.mjs --measure 的
//   opaqueBox／lowest 與此相同（它建議的 box 另外四周多留 2px 全透明，不需要）。
//   base（站姿五片）＝遮罩最低的不透明列（alpha ≥ 128 與 > 0 同一列）＝家具碰地最前面那一點，與 manifest 相同。
// 片名與美術清單一致：lyr_shop_{光線}_{片名}_v{ver}（ver＝這片採用的母檔版本，沒寫＝1）。
// v2（2026-11-28 畫師重交 5 張，layers_manifest.md；v1 的實量在 layers_manifest_v1.md）：
//   夜／白天 bar_front＝磨豆機球頭右側補圓（夜版頂端外框補 2px：y0 823 → 821）；
//   夜／白天／傍晚 chair_mid＝與 table_right、chair_front_right 相鄰的邊緣外擴 1–2px（補接縫，box／base 不變）。
//   其餘 12 片（含傍晚 bar_front）沿用 v1。
const USE = {
  bar_front: '吧台檯面＋正面板＋檯上白杯＋磨豆機（德叔站在它後面）',
  table_left: '左桌＋它後面的椅子＋桌上盆栽杯',
  chair_mid: '吧台前中間那張椅（龍眼跳上去踩兩圈的那張）',
  table_right: '右桌（含桌後椅子的椅背圈；龍眼原本趴這張，2026-11-28 09:59 起改趴左桌）',
  chair_front_right: '右前曲木椅（環內透明）',
};
// 方案目測值（實量前；三種光線共用一份），留作對照
const EYEBALL = {
  bar_front: { box: [440, 880, 1170, 1345], base: 1340 },
  table_left: { box: [0, 1040, 445, 1720], base: 1715 },
  chair_mid: { box: [600, 1095, 935, 1645], base: 1640 },
  table_right: { box: [710, 1175, 1170, 1795], base: 1790 },
  chair_front_right: { box: [785, 1210, 1130, 1855], base: 1850 },
  table_corner: { box: [0, 1430, 750, 2000], base: 1995 },
};
const piece = (id, box, base, { use = USE[id], ver = 1 } = {}) => ({ id, use, box, base, ver, foot: null, measured: true, eyeball: EYEBALL[id] || null });

export const SHOP_PIECES = {
  night: [
    piece('bar_front', [438, 821, 1170, 1363], 1362, { ver: 2 }), // v1 實量 y0 823
    piece('table_left', [0, 1010, 454, 1712], 1711),
    piece('chair_mid', [600, 1096, 931, 1643], 1642, { ver: 2 }),
    piece('table_right', [712, 1079, 1170, 1785], 1784),
    piece('chair_front_right', [792, 1211, 1130, 1880], 1879),
  ],
  day: [
    piece('bar_front', [427, 820, 1170, 1366], 1365, { ver: 2 }),
    piece('table_left', [0, 1013, 456, 1718], 1717),
    piece('chair_mid', [600, 1099, 931, 1647], 1646, { ver: 2 }),
    piece('table_right', [711, 1080, 1170, 1791], 1790),
    piece('chair_front_right', [790, 1214, 1126, 1884], 1883),
  ],
  dusk: [
    piece('bar_front', [421, 821, 1170, 1364], 1363),
    piece('table_left', [2, 1012, 455, 1709], 1708),
    piece('chair_mid', [600, 1098, 931, 1641], 1640, { ver: 2 }),
    piece('table_right', [711, 1079, 1170, 1781], 1780),
    piece('chair_front_right', [791, 1211, 1130, 1873], 1872),
  ],
  // 靠窗特寫（scene_v3b_shop_window_night_seated）：桌角＋對面椅子的椅背。
  // 這張圖 y ≈ 2040 以下是暗部漸層，桌腳、椅腳碰地的地方都畫在暗部裡看不到，兩片的 base 只能取遮罩最低點：
  //   table_corner 2005＝桌面右前角（x ≈ 500）的下緣，不是桌腳碰地（真的碰地點在暗部裡、還要更低）。拿來當排序線仍合理：
  //     杯子在桌上（on，2006）分得開；腳邊的龍眼（feetSeated）在 x 87、y 78.6（腳線 1990），椅右地板（承峰 2026-11-28 11:25），
  //     不透明像素與椅背／桌角遮罩交疊 0，照腳線排序不用例外。
  //   chair_back 2050＝椅背立桿被暗部吃掉的那一列（同樣不是椅腳碰地）。
  //   對面椅子上的龍眼（across，腳線 1861）照排序會被兩片擋，但擋到牠的是桌子右後腳與椅背立桿，都在椅座後面，是錯的遮擋，
  //     所以 across 寫例外（before: 'chair_back'）。結果這兩片目前不擋任何角色，只是就位（日後有東西在桌後／椅後再用到）。
  seated: [
    piece('table_corner', [0, 1252, 748, 2006], 2005, { use: '靠窗特寫的桌角（桌面＋桌上盆栽杯；桌下橫樑與桌腳在暗部，留在底圖）' }),
    piece('chair_back', [756, 1354, 1012, 2051], 2050, { use: '靠窗特寫對面那張椅子的椅背（兩根立桿＋圈環；椅座坐墊留在底圖）' }),
  ],
};
// 【待定】龍眼乾袋（樣子、放哪張桌）與花斑貓在店內定景上的位置、姿勢都還沒定案（承峰 2026-11-28 08:19）：
//   這裡不放袋子或花斑貓的片、不寫座標；定案、美術交圖之後再加。

// 這一片的遊戲檔名（不含副檔名、不含資料夾）
//   版本跟著片的 ver 走（＝這片採用的母檔版本）；不在資料裡的片退回 v1
export const pieceOf = (light, id) => (SHOP_PIECES[light] || []).find((p) => p.id === id) || null;
export const cutFile = (light, id) => `lyr_shop_${light}_${id}_v${pieceOf(light, id)?.ver || 1}`;

// 站在定景上的東西（角色、杯子）的 z。it：{ foot（像素 y）, on?, behind?, before?, front? }
//   before：站在地上、在這片前面（z＝base＋1，數值與 on 相同，但意思是「在它前面的地上」不是「在它上面」）
export function zOf(it, light) {
  if (it.front) return Z_FRONT;
  if (it.behind) { const p = pieceOf(light, it.behind); if (p) return p.base - 1; }
  if (it.before) { const p = pieceOf(light, it.before); if (p) return p.base + 1; }
  if (it.on) { const p = pieceOf(light, it.on); if (p) return p.base + 1; }
  return Math.round(it.foot);
}
// 某個東西被哪幾片擋住（片的 z 比它大）：驗收／測試用
export const coveredBy = (it, light) => (SHOP_PIECES[light] || []).filter((p) => p.base > zOf(it, light)).map((p) => p.id);
// 百分比（相對 1170×2532）→ 像素 y
export const pxY = (pct) => (pct / 100) * ART_H;
