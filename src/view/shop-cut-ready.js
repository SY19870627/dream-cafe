// 已裁好的店內家具切片（由 tools/shop-cut.mjs 寫入；不要手改）。
// 每種光線：{ 片 id: { box: [x0, y0, x1, y1] } }，box 是裁切時實際用的範圍（要與 shop-pieces.js 的 SHOP_PIECES 一致，有單元測試）。
// 某種光線的某一片不在這裡＝檔案還沒到：畫面不放那一片、不發請求（不閃破圖）；德叔的 bar_front 沒到就照舊用 clip-path 擋。
export const SHOP_CUT_READY = {
  night: {
    bar_front: { box: [438, 821, 1170, 1363] },
    chair_front_right: { box: [792, 1211, 1130, 1880] },
    chair_mid: { box: [600, 1096, 931, 1643] },
    table_left: { box: [0, 1010, 454, 1712] },
    table_right: { box: [712, 1079, 1170, 1785] },
  },
  day: {
    bar_front: { box: [427, 820, 1170, 1366] },
    chair_front_right: { box: [790, 1214, 1126, 1884] },
    chair_mid: { box: [600, 1099, 931, 1647] },
    table_left: { box: [0, 1013, 456, 1718] },
    table_right: { box: [711, 1080, 1170, 1791] },
  },
  dusk: {
    bar_front: { box: [421, 821, 1170, 1364] },
    chair_front_right: { box: [791, 1211, 1130, 1873] },
    chair_mid: { box: [600, 1098, 931, 1641] },
    table_left: { box: [2, 1012, 455, 1709] },
    table_right: { box: [711, 1079, 1170, 1781] },
  },
  seated: {
    chair_back: { box: [756, 1354, 1012, 2051] },
    table_corner: { box: [0, 1252, 748, 2006] },
  },
};
