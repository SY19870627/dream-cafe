// tools/shop-cut.mjs 的純邏輯（不開瀏覽器、不寫檔；單元測試直接測）：
// 讀 PNG（RGBA 8-bit、straight alpha）、檢查母檔、裁切、在母檔上量 box／base、產生 shop-cut-ready.js 的內容。
import { inflateSync, deflateSync } from 'node:zlib';
import { resolve, relative, isAbsolute, sep } from 'node:path';

export const ART_W = 1170;
export const ART_H = 2532;
// 只讀的資料夾：輸出不准寫進去（定版底圖、舊圖、v5.6 圖）
export const READ_ONLY_DIRS = ['assets/art', 'assets/art-v56', 'assets/art-v59', 'public/bg'];

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

// PNG → { width, height, data: Uint8Array RGBA }。只收 8-bit、非交錯的 RGBA（6）／RGB（2，alpha 補 255）
export function decodePng(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('不是 PNG');
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (type !== 6 && type !== 2) || interlace) throw new Error(`PNG 格式不支援（bit depth ${depth}、color type ${type}、interlace ${interlace}）：母檔要 8-bit RGBA`);
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (f !== 0) throw new Error(`PNG filter ${f} 不認得`);
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, s = x * bpp;
      out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = bpp === 4 ? cur[s + 3] : 255;
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, data: out };
}

// RGBA → PNG（filter 0；測試夾具與 --png 輸出用）
export function encodePng({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const chunk = (kind, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const kb = Buffer.concat([Buffer.from(kind, 'ascii'), body]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(kb));
    return Buffer.concat([len, kb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// 母檔檢查：與底圖同尺寸（逐像素對齊）、真的有透明區（整張不透明＝拿底圖充當母檔，不收）
export function checkMaster(img, { w = ART_W, h = ART_H } = {}) {
  if (img.width !== w || img.height !== h) throw new Error(`母檔尺寸 ${img.width}×${img.height}，要與底圖同為 ${w}×${h}（逐像素對齊）`);
  let clear = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] === 0) clear++;
  const ratio = clear / (img.width * img.height);
  if (ratio < 0.2) throw new Error(`母檔只有 ${(ratio * 100).toFixed(1)}% 透明：不像切片母檔（不可拿底圖或改過的底圖當母檔）`);
  return { clearRatio: ratio };
}

export function checkBox(box, { w = ART_W, h = ART_H } = {}) {
  const [x0, y0, x1, y1] = box || [];
  if (![x0, y0, x1, y1].every(Number.isInteger) || x0 < 0 || y0 < 0 || x1 > w || y1 > h || x1 <= x0 || y1 <= y0) throw new Error(`box 不合法：${JSON.stringify(box)}`);
}

export function crop(img, box) {
  checkBox(box, { w: img.width, h: img.height });
  const [x0, y0, x1, y1] = box;
  const width = x1 - x0, height = y1 - y0;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x1) * 4), y * width * 4);
  return { width, height, data };
}

// 在母檔上量：box 外擴 pad 的範圍內，alpha ≥ th 的外框（建議的 box）與最低一列（建議的 base 參考：家具最低的不透明點）
export function measure(img, box, { th = 128, pad = 60 } = {}) {
  const sx0 = Math.max(0, box[0] - pad), sy0 = Math.max(0, box[1] - pad), sx1 = Math.min(img.width, box[2] + pad), sy1 = Math.min(img.height, box[3] + pad);
  let x0 = sx1, y0 = sy1, x1 = -1, y1 = -1, any = 0;
  for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
    const a = img.data[(y * img.width + x) * 4 + 3];
    if (a > 0) any++;
    if (a >= th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { found: false, any };
  // 半透明邊也要收進去：外框照 alpha > 0 再外擴 2px
  let ax0 = x0, ay0 = y0, ax1 = x1, ay1 = y1;
  for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] > 0) { if (x < ax0) ax0 = x; if (x > ax1) ax1 = x; if (y < ay0) ay0 = y; if (y > ay1) ay1 = y; }
  }
  const box2 = [Math.max(0, ax0 - 2), Math.max(0, ay0 - 2), Math.min(img.width, ax1 + 3), Math.min(img.height, ay1 + 3)];
  const touches = box2[0] === sx0 && sx0 > 0 || box2[1] === sy0 && sy0 > 0 || box2[2] === sx1 && sx1 < img.width || box2[3] === sy1 && sy1 < img.height;
  return { found: true, box: box2, lowest: y1, opaqueBox: [x0, y0, x1 + 1, y1 + 1], touchesSearchEdge: touches };
}

// 輸出資料夾不可是只讀資料夾（或其子資料夾）
export function checkOutDir(outDir, repoRoot) {
  const abs = resolve(repoRoot, outDir);
  for (const ro of READ_ONLY_DIRS) {
    const rel = relative(resolve(repoRoot, ro), abs);
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error(`輸出資料夾 ${outDir} 在只讀的 ${ro} 裡`);
  }
  return abs;
}

// 這次要裁哪幾片：只裁 measured（照母檔實量過）的，除非明說 allowUnmeasured（只給測試夾具用）
export function planCuts(pieces, light, { only = null, allowUnmeasured = false } = {}) {
  const list = (pieces[light] || []).filter((p) => !only || only.includes(p.id));
  if (!list.length) throw new Error(`光線 ${light} 沒有要裁的片`);
  const skipped = [];
  const cuts = [];
  for (const p of list) {
    if (!p.measured && !allowUnmeasured) { skipped.push(p.id); continue; }
    checkBox(p.box);
    cuts.push({ id: p.id, box: [...p.box], file: `lyr_shop_${light}_${p.id}_v${p.ver || 1}` });
  }
  return { cuts, skipped };
}

// 母檔檔名若是 lyr_shop_{光線}_{片}_v{n}.png：光線要對、要在這次的裁切裡、版本要等於該片採用的 ver（防止拿 v1 母檔裁成 v2 檔名）。
// 其他檔名（測試夾具）不檢查。回傳母檔指的片 id 或 null
export function checkMasterName(name, light, cuts) {
  const m = /^lyr_shop_([a-z]+)_([a-z_]+)_v(\d+)\.png$/.exec(name);
  if (!m) return null;
  const [, l, id, v] = m;
  if (l !== light) throw new Error(`母檔 ${name} 是 ${l} 光線，不是 --light ${light}`);
  const c = cuts.find((x) => x.id === id);
  if (!c) throw new Error(`母檔 ${name} 是 ${id}，這次要裁的是 ${cuts.map((x) => x.id).join(', ')}（請用 --only ${id}）`);
  if (cuts.length > 1) throw new Error(`母檔 ${name} 只有 ${id} 一片，請用 --only ${id}`);
  if (c.file !== `lyr_shop_${l}_${id}_v${v}`) throw new Error(`母檔 ${name} 是 v${v}，shop-pieces.js 裡這片採用 ${c.file}`);
  return id;
}

// 邊緣檢查（防色邊）：原圖與解回來的圖比，alpha ≥ minA 的像素 RGB 差（以 alpha 加權）的平均與最大
export function edgeError(src, out, { minA = 64 } = {}) {
  if (src.width !== out.width || src.height !== out.height) throw new Error('尺寸不同');
  let sum = 0, n = 0, max = 0, alphaMax = 0;
  for (let i = 0; i < src.data.length; i += 4) {
    const a = src.data[i + 3];
    alphaMax = Math.max(alphaMax, Math.abs(a - out.data[i + 3]));
    if (a < minA) continue;
    const e = (Math.abs(src.data[i] - out.data[i]) + Math.abs(src.data[i + 1] - out.data[i + 1]) + Math.abs(src.data[i + 2] - out.data[i + 2])) / 3 * (a / 255);
    sum += e; n++; if (e > max) max = e;
  }
  return { mean: n ? sum / n : 0, max, alphaMax };
}

// shop-cut-ready.js 的內容（整檔重寫；排序固定，diff 好讀）
export function renderReady(ready, lights = ['night', 'day', 'dusk', 'seated']) {
  const line = (l) => {
    const ids = Object.keys(ready[l] || {}).sort();
    if (!ids.length) return `  ${l}: {},`;
    return `  ${l}: {\n${ids.map((id) => `    ${id}: { box: [${ready[l][id].box.join(', ')}] },`).join('\n')}\n  },`;
  };
  return `// 已裁好的店內家具切片（由 tools/shop-cut.mjs 寫入；不要手改）。
// 每種光線：{ 片 id: { box: [x0, y0, x1, y1] } }，box 是裁切時實際用的範圍（要與 shop-pieces.js 的 SHOP_PIECES 一致，有單元測試）。
// 某種光線的某一片不在這裡＝檔案還沒到：畫面不放那一片、不發請求（不閃破圖）；德叔的 bar_front 沒到就照舊用 clip-path 擋。
export const SHOP_CUT_READY = {
${lights.map(line).join('\n')}
};
`;
}

export const toPosix = (p) => p.split(sep).join('/');
