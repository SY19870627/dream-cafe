// 店內家具切片的裁圖工具（D4）。母檔＝畫師交的、與某張店內底圖逐像素對齊的 1170×2532 透明 PNG（RGBA、straight alpha）。
// 母檔與原底圖都只讀；輸出是新檔名的小 WebP（帶 alpha），放在 assets/<SHOP_CUT_DIR>/（＝assets/art-v60）。
//
// 用法：
//   量（不寫檔）：node tools/shop-cut.mjs --light night --master <母檔.png> --measure
//     → 每片印出母檔上的實際不透明外框（建議 box）與最低不透明列（base 參考）。照結果改 src/view/shop-pieces.js 的 box／base，
//       並把該片改成 measured: true（base 要人看圖確認：家具碰到地面最前面那一點，不一定是最低的不透明列）。
//   裁：node tools/shop-cut.mjs --light night --master <母檔.png> [--only bar_front,chair_mid] [--q 0.9] [--lossless] [--dry]
//     → 只裁 measured: true 的片；寫 WebP、回讀檢查邊緣（色邊太大自動改無損重壓），最後更新 src/view/shop-cut-ready.js。
//     輸出檔名 lyr_shop_{光線}_{片}_v{ver}（ver＝shop-pieces.js 裡該片採用的母檔版本）；母檔名是 lyr_shop_… 時版本要對得上，
//     一張母檔只含一片，要加 --only 那一片。
//   光線：night（夜景 v2）／day（白天）／dusk（傍晚）／seated（靠窗特寫）。可重複跑：同名輸出覆寫，母檔不動。
// 選項：--out <資料夾>（預設 assets/<SHOP_CUT_DIR>）、--allow-unmeasured（只給測試夾具用，正式檔不要用）。
// WebP 編碼用 Playwright 的 Chromium（canvas.convertToBlob）；PNG 解碼、裁切、檢查在 Node（tools/shop-cut-core.mjs）。
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodePng, checkMaster, crop, measure, checkOutDir, planCuts, checkMasterName, edgeError, renderReady, toPosix } from './shop-cut-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { SHOP_PIECES, LIGHTS } = await import(pathToFileURL(join(ROOT, 'src/view/shop-pieces.js')).href);
const { SHOP_CUT_DIR } = await import(pathToFileURL(join(ROOT, 'src/view/art-map.js')).href);
const READY_FILE = join(ROOT, 'src/view/shop-cut-ready.js');

const opt = { q: 0.9 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--light') opt.light = argv[++i];
  else if (a === '--master') opt.master = argv[++i];
  else if (a === '--only') opt.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--q') opt.q = Number(argv[++i]);
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--ready') opt.ready = argv[++i]; // 測試用：另寫一份 ready 檔，不動 src/
  else if (a === '--measure') opt.measure = true;
  else if (a === '--lossless') opt.lossless = true;
  else if (a === '--dry') opt.dry = true;
  else if (a === '--allow-unmeasured') opt.allowUnmeasured = true;
  else { console.error(`不認得的參數 ${a}`); process.exit(2); }
}
if (!LIGHTS.includes(opt.light) || !opt.master) {
  console.error('用法：node tools/shop-cut.mjs --light night|day|dusk|seated --master <母檔.png> [--measure] [--only id,id] [--q 0.9] [--lossless] [--dry]');
  process.exit(2);
}

const masterPath = resolve(opt.master);
const img = decodePng(readFileSync(masterPath));
const { clearRatio } = checkMaster(img);
console.log(`母檔 ${opt.master}：${img.width}×${img.height}，透明 ${(clearRatio * 100).toFixed(1)}%`);

if (opt.measure) {
  for (const p of SHOP_PIECES[opt.light]) {
    if (opt.only && !opt.only.includes(p.id)) continue;
    const m = measure(img, p.box);
    console.log(JSON.stringify({ id: p.id, now: { box: p.box, base: p.base, measured: p.measured }, ...m }));
    if (m.touchesSearchEdge) console.log(`  ！${p.id}：不透明區碰到搜尋範圍邊緣，可能跟別片連在一起，請看圖確認`);
  }
  process.exit(0);
}

const outDir = checkOutDir(opt.out || join('assets', SHOP_CUT_DIR), ROOT);
const { cuts, skipped } = planCuts(SHOP_PIECES, opt.light, { only: opt.only, allowUnmeasured: opt.allowUnmeasured });
if (skipped.length) console.log(`略過（box／base 還是目測值，先 --measure 再改 shop-pieces.js）：${skipped.join(', ')}`);
if (!cuts.length) { console.log('沒有可裁的片。'); process.exit(1); }
checkMasterName(basename(masterPath), opt.light, cuts);
for (const c of cuts) if (resolve(outDir, `${c.file}.webp`) === masterPath) throw new Error('輸出會蓋到母檔');
if (opt.dry) { for (const c of cuts) console.log(`（dry）${c.id} box ${JSON.stringify(c.box)} → ${toPosix(join(outDir, `${c.file}.webp`))}`); process.exit(0); }

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage();
  const enc = (part, quality) => page.evaluate(async ({ b64, w, h, quality }) => {
    const bin = atob(b64);
    const px = new Uint8ClampedArray(bin.length);
    for (let i = 0; i < bin.length; i++) px[i] = bin.charCodeAt(i);
    const cv = new OffscreenCanvas(w, h);
    cv.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0);
    const blob = await cv.convertToBlob({ type: 'image/webp', quality });
    if (blob.type !== 'image/webp') throw new Error(`瀏覽器不支援 WebP 編碼（${blob.type}）`);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // 回讀：解回來比邊緣
    const bm = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const c2 = new OffscreenCanvas(w, h).getContext('2d');
    c2.drawImage(bm, 0, 0);
    const back = c2.getImageData(0, 0, w, h).data;
    let s = '', t = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    for (let i = 0; i < back.length; i += 0x8000) t += String.fromCharCode(...back.subarray(i, i + 0x8000));
    return { webp: btoa(s), back: btoa(t) };
  }, { b64: Buffer.from(part.data).toString('base64'), w: part.width, h: part.height, quality });
  mkdirSync(outDir, { recursive: true });
  for (const c of cuts) {
    const part = crop(img, c.box);
    let q = opt.lossless ? 1 : opt.q;
    let r = await enc(part, q);
    let e = edgeError(part, { width: part.width, height: part.height, data: new Uint8Array(Buffer.from(r.back, 'base64')) });
    if (q < 1 && (e.mean > 6 || e.alphaMax > 24)) { // 色邊太大：改無損重壓
      console.log(`  ${c.id}：有損 q${q} 邊緣誤差 mean ${e.mean.toFixed(2)}／alpha ${e.alphaMax}，改無損`);
      q = 1;
      r = await enc(part, q);
      e = edgeError(part, { width: part.width, height: part.height, data: new Uint8Array(Buffer.from(r.back, 'base64')) });
    }
    const file = join(outDir, `${c.file}.webp`);
    writeFileSync(file, Buffer.from(r.webp, 'base64'));
    results.push(c);
    console.log(`${c.id}：${part.width}×${part.height} → ${toPosix(file)}（${(statSync(file).size / 1024).toFixed(0)} KB，q${q}，邊緣誤差 mean ${e.mean.toFixed(2)} max ${e.max.toFixed(1)} alpha ${e.alphaMax}）`);
  }
} finally {
  await browser.close();
}

// 更新 ready 清單（這次裁好的片記上實際 box；其他光線、其他片不動）
const readyFile = opt.ready ? resolve(opt.ready) : READY_FILE;
let ready = { night: {}, day: {}, dusk: {}, seated: {} };
try { ready = { ...ready, ...(await import(`${pathToFileURL(readyFile).href}?t=${Date.now()}`)).SHOP_CUT_READY }; } catch { /* 第一次寫 */ }
ready[opt.light] = { ...ready[opt.light] };
for (const c of results) ready[opt.light][c.id] = { box: c.box };
writeFileSync(readyFile, renderReady(ready));
console.log(`已更新 ${toPosix(readyFile)}（${opt.light}：${Object.keys(ready[opt.light]).join(', ')}）`);
