// 量圖的不透明範圍與腳線（只讀圖，不改圖）。用 Playwright 的 Chromium 解碼（webp／png 都可），在 Node 端算。
// 用法：node tools/measure-alpha.mjs [--th 128] <圖檔> [<圖檔> ...]
// 輸出每張：尺寸、不透明外框 [x0,y0,x1,y1]（alpha ≥ th）、腳線 foot＝最低一列有不透明像素的 y、
//   腳線中心 fx＝最低 12 列不透明像素的 x 平均（貓的腳底中心）、contact＝同 12 列的左右範圍。
// 腳線定義與 shop-still.js 的 CAT_FOOT 相同：alpha ≥ 128 的最低一列（sleep y339、knead_v2 y349 就是這樣量的）。
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
let th = 128;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--th') th = Number(args[++i]);
  else files.push(args[i]);
}
if (!files.length) { console.error('用法：node tools/measure-alpha.mjs [--th 128] <圖檔> ...'); process.exit(2); }

const mime = (f) => ({ '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' })[extname(f).toLowerCase()] || 'application/octet-stream';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const f of files) {
    const url = `data:${mime(f)};base64,${readFileSync(resolve(f)).toString('base64')}`;
    const r = await page.evaluate(async ({ url, th }) => {
      const im = new Image();
      im.src = url;
      await im.decode();
      const w = im.naturalWidth, h = im.naturalHeight;
      const cv = new OffscreenCanvas(w, h);
      const cx = cv.getContext('2d');
      cx.drawImage(im, 0, 0);
      const a = cx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] >= th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      let sx = 0, n = 0, c0 = w, c1 = -1;
      for (let y = Math.max(0, y1 - 11); y <= y1; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] >= th) { sx += x; n++; if (x < c0) c0 = x; if (x > c1) c1 = x; }
      // contact：最低 12 列不透明像素的左右範圍（接觸陰影的寬度用）
      return { w, h, box: [x0, y0, x1 + 1, y1 + 1], foot: y1, fx: n ? Math.round(sx / n) : null, contact: [c0, c1 + 1] };
    }, { url, th });
    console.log(JSON.stringify({ file: f, th, ...r }));
  }
} finally {
  await browser.close();
}
