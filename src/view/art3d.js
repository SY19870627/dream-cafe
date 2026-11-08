// 3D 店面共用的美術：畫師的 assets/art/*.webp 載成貼圖、做成「紙片」（立在地上的平面）。
// 手法沿用第一版 legacy/src/art.js 與 main.js 的 paper()：透明圖裁掉四周留白、底邊就是落地點，
// 用公尺算大小（家具照畫布代表的公尺；人物照身高）。俯視店面與座位視角共用這一份，兩邊看起來是同一間店。
import * as THREE from 'three';

const ART = './assets/art/';

// size：畫布代表幾公尺（寬, 高）；h：人物畫到的部分（頭頂到腳底）幾公尺；ax：人物原點在圖寬的哪裡（坐姿的臀部）
// 數字照第一版 art.js 的 ART_SPEC／ROOM_SPEC
export const PAPER_SPEC = {
  char_deshu_stand: { h: 1.67 }, char_deshu_brew: { h: 1.67 }, char_deshu_smile: { h: 1.67 },
  char_kevin_stand: { h: 1.61 }, char_kevin_sit: { h: 1.28, ax: 0.78 },
  char_yuan_stand: { h: 1.56 }, char_yuan_sit: { h: 1.22, ax: 0.8 },
  char_zhe_stand: { h: 1.62 },
  char_grandpa_stand: { h: 1.5 }, char_grandpa_sit: { h: 1.2 },
  cat_longan_sleep: { h: 0.28 }, cat_longan_sit: { h: 0.4 }, cat_longan_walk: { h: 0.34 },
  stool: { size: [0.45, 0.8] }, chair: { size: [0.5, 0.95] }, rattanChair: { size: [0.8, 1.2] },
  bookshelf: { size: [1, 1.9] }, plant: { size: [0.8, 1.4] }, framedNapkin: { size: [0.5, 0.95] },
  floorLamp_on: { size: [0.6, 1.7] }, catCushion: { size: [0.7, 0.3] }, kettleSet: { size: [0.7, 0.45] },
  longanJar: { size: [0.5, 0.95] }, menuBoard: { size: [0.6, 1] }, cabinet: { size: [0.9, 1.6] },
  // 掛在牆上的（整張用、不裁）
  backbar: { size: [2.8, 1.8], keep: true }, thermometer_frame: { size: [0.36, 0.9], keep: true },
  pendant_lamp: { size: [0.36, 0.9], keep: true }, window_frame: { size: [1.6, 1.3], keep: true },
};

const MAX_PX = 1024; // 手機記憶體：長邊最多 1024
const cache = new Map(); // 檔名 → Promise<{ tex, w, h }>（整頁共用，不 dispose）

// crossOrigin 一定要在 src 之前設：raw.githack 等跨網域預覽少了它，canvas 會被污染，
// getImageData 丟 SecurityError、CanvasTexture 也上傳不了 WebGL（紙片家具全消失）
function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(url));
    img.src = url;
  });
}

// 量出畫到的範圍（透明度 > 24），縮成 1/4 量就夠準
function bbox(img) {
  const q = 4;
  const mw = Math.ceil(img.naturalWidth / q);
  const mh = Math.ceil(img.naturalHeight / q);
  const m = document.createElement('canvas');
  m.width = mw; m.height = mh;
  const g = m.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, mw, mh);
  let d;
  try {
    d = g.getImageData(0, 0, mw, mh).data;
  } catch {
    return { x0: 0, y0: 0, x1: img.naturalWidth, y1: img.naturalHeight }; // 讀不到像素就整張用、不裁
  }
  let top = mh; let bottom = -1; let left = mw; let right = -1;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    if (d[(y * mw + x) * 4 + 3] <= 24) continue;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
    if (x < left) left = x;
    if (x > right) right = x;
  }
  if (bottom < 0) return { x0: 0, y0: 0, x1: img.naturalWidth, y1: img.naturalHeight };
  return {
    x0: Math.max(0, left * q - 2), y0: Math.max(0, top * q - 2),
    x1: Math.min(img.naturalWidth, (right + 1) * q + 2), y1: Math.min(img.naturalHeight, (bottom + 1) * q),
  };
}

async function decode(name) {
  const spec = PAPER_SPEC[name] || { size: [1, 1] };
  const img = await loadImage(`${ART}${name}.webp`);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  let { x0, y0, x1, y1 } = spec.keep ? { x0: 0, y0: 0, x1: W, y1: H } : bbox(img);
  if (spec.ax !== undefined) {
    // 以 ax 為中線左右對稱地裁：紙片原點（坐姿的臀部）就在正中間
    const ax = spec.ax * W;
    const half = Math.max(ax - x0, x1 - ax);
    x0 = ax - half; x1 = ax + half;
  }
  const s = Math.min(1, MAX_PX / Math.max(x1 - x0, y1 - y0));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((x1 - x0) * s));
  c.height = Math.max(1, Math.round((y1 - y0) * s));
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
  // 每公尺幾個原圖像素：人物照身高、家具照畫布寬
  const ppm = spec.h ? (y1 - y0) / spec.h : W / spec.size[0];
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, w: (x1 - x0) / ppm, h: (y1 - y0) / ppm };
}

export function loadPaper(name) {
  if (!cache.has(name)) {
    // 載不到就這次不畫、遊戲照常；失敗不留在快取裡，下次要用再重試
    cache.set(name, decode(name).catch(() => { cache.delete(name); return null; }));
  }
  return cache.get(name);
}

// 不透明的材質（地板、牆、吧台正面、窗景）：同名同 repeat 共用
const texCache = new Map();
export function loadTex(name, repeat = [1, 1]) {
  const k = `${name}@${repeat.join('x')}`;
  if (!texCache.has(k)) {
    const t = new THREE.TextureLoader().load(`${ART}${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 8;
    texCache.set(k, t);
  }
  return texCache.get(k);
}

// 地上的軟影子（程式畫的圓形漸層）
let blob = null;
export function blobTex() {
  if (blob) return blob;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(40,24,12,0.45)');
  gr.addColorStop(1, 'rgba(40,24,12,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  blob = new THREE.CanvasTexture(c);
  return blob;
}

// 紙片：一個 Group（原點在落地點），裡面是貼圖的平面（userData.mesh）與地上的影子。
// opt：{ fit：寬度上限（公尺，超過就整張等比縮小）、scale、flip（左右翻）、lift（離地）、shadow、uid（點選用）、tint、onReady }
export function paper(name, opt = {}) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, color: opt.tint || '#ffffff' });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.position.y = opt.lift || 0;
  mesh.userData.uid = opt.uid;
  group.add(mesh);
  group.userData = { mesh, flip: opt.flip ? -1 : 1, size: null };
  let shadow = null;
  if (opt.shadow !== false && !opt.lift) {
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.006;
    shadow.visible = false;
    group.add(shadow);
  }
  loadPaper(name).then((a) => {
    if (!a) return;
    let k = opt.scale || 1;
    if (opt.fit && a.w * k > opt.fit) k = opt.fit / a.w;
    if (opt.maxH && a.h * k > opt.maxH) k = opt.maxH / a.h;
    mat.map = a.tex;
    mat.needsUpdate = true;
    group.userData.size = { w: a.w * k, h: a.h * k };
    mesh.scale.set(a.w * k * group.userData.flip, a.h * k, 1);
    group.userData.baseScaleY = a.h * k;
    mesh.visible = true;
    if (shadow) {
      shadow.scale.set(a.w * k * 1.1, Math.max(0.25, a.w * k * 0.55), 1);
      shadow.visible = true;
    }
    opt.onReady?.(group);
  });
  return group;
}

// 換一張圖（客人坐下／站起來）：沿用同一個紙片，大小跟著換
export function setPaperArt(group, name, opt = {}) {
  if (group.userData.art === name && !!group.userData.flipNow === !!opt.flip) return;
  group.userData.art = name;
  group.userData.flipNow = !!opt.flip;
  loadPaper(name).then((a) => {
    if (!a || group.userData.art !== name) return;
    const k = opt.scale || 1;
    const m = group.userData.mesh;
    m.material.map = a.tex;
    m.material.needsUpdate = true;
    group.userData.flip = opt.flip ? -1 : 1;
    group.userData.size = { w: a.w * k, h: a.h * k };
    group.userData.baseScaleY = a.h * k;
    m.scale.set(a.w * k * group.userData.flip, a.h * k, 1);
    m.visible = true;
  });
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fwd = new THREE.Vector3();

// 紙片轉向鏡頭（第一版 faceCamera() 的做法）。
// over（俯視）：不靠牆的紙片只繞垂直軸轉到和畫面平行，往後仰一點，剩下看不到的高度用往上拉長補回來，
// 才不會從斜上方看成扁扁一條；座位視角：各自轉向鏡頭的位置、不仰。
export function faceCamera(papers, camera, over) {
  camera.getWorldDirection(fwd);
  const screenYaw = Math.atan2(-fwd.x, -fwd.z);
  for (const p of papers) {
    if (p.userData.wall) continue; // 貼牆的不轉
    const m = p.userData.mesh;
    const wp = p.getWorldPosition(new THREE.Vector3());
    p.rotation.y = over ? screenYaw : wrapAngle(Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z));
    const shadow = p.children[1];
    if (shadow) shadow.rotation.z = -p.rotation.y;
    const baseY = p.userData.baseScaleY;
    if (!baseY) continue;
    if (over) {
      const elev = Math.atan2(camera.position.y - baseY / 2, Math.hypot(camera.position.x - wp.x, camera.position.z - wp.z));
      const lean = Math.min(0.47, Math.max(0, (elev - 0.5) * 0.6));
      m.rotation.x = -lean;
      m.scale.y = baseY * Math.min(1.8, 1 / Math.cos(Math.max(0, elev - lean)));
    } else {
      m.rotation.x = 0;
      m.scale.y = baseY;
    }
  }
}
