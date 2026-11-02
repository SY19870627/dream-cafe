// art2b：從畫師的 app_icon_1024.webp 預先縮出 manifest 與 iOS 主畫面要的 PNG（512、192、180），存在 assets/art/（原圖不動）。
// 換了 app_icon_1024 之後執行：node tests/make-icons.mjs
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { server, url } = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url + 'README.md');
for (const n of [512, 192, 180]) {
  const data = await page.evaluate(async (n) => {
    const bmp = await createImageBitmap(await (await fetch('/assets/art/app_icon_1024.webp')).blob());
    // 先縮一半再縮到目標，邊緣比較平滑
    let src = bmp, w = 1024;
    while (w / 2 >= n * 1.0 && w / 2 >= n) { const c = new OffscreenCanvas(w / 2, w / 2); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w / 2, w / 2); src = c; w /= 2; }
    const c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, n, n);
    return c.toDataURL('image/png').split(',')[1];
  }, n);
  await writeFile(`assets/art/app_icon_${n}.png`, Buffer.from(data, 'base64'));
}
await browser.close(); server.close();
