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
  // 第 2 輪新擺設用到的圖：大小多半用 paper() 的 height 指定，這裡只給個量級
  sofa: { size: [1.6, 1.0] }, recordPlayer: { size: [0.6, 0.5] }, catTree: { size: [0.8, 1.4] }, succulent: { size: [0.4, 0.4] },
  noticeBoard: { size: [0.8, 0.7] }, map_taiwan: { size: [0.6, 0.8] }, bookWall: { size: [1.2, 1.0] }, bookStack: { size: [0.4, 0.3] },
  beanBag: { size: [0.4, 0.5] }, coffeeSack: { size: [0.6, 0.7] }, longanBag: { size: [0.4, 0.5] }, radio: { size: [0.5, 0.4] },
  prop_cup: { size: [0.25, 0.25] }, prop_cup_daily: { size: [0.25, 0.25] }, prop_coaster_menu: { size: [0.3, 0.3] }, floorLamp_off: { size: [0.6, 1.7] },
  // v2 第一批正式美術（assets/art/previews/manifest_v2.json）：多半也用 height／fit 指定，這裡給量級
  showcase_wood: { size: [2.2, 2.2] }, showcase_white: { size: [2.2, 2.2] },
  goods_beans: { size: [1.6, 1.6] }, goods_cups: { size: [1.6, 1.6] }, goods_craft: { size: [1.6, 1.6] },
  sofa_single: { size: [1.1, 1.1] }, low_cabinet: { size: [1.4, 1.4] }, bookshelf_low: { size: [1.0, 1.0] },
  wall_shelf_plants: { size: [0.9, 0.9] }, rug_tile: { size: [1.6, 1.6] },
  chair_wood_back: { size: [0.85, 0.85] }, chair_rattan_back: { size: [1.0, 1.0] },
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
  tex.name = name; // 驗收腳本認圖用
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
    t.name = name;
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
// opt：{ fit：寬度上限（公尺，超過就整張等比縮小）、height：直接指定高度（公尺）、maxH：高度上限、scale、flip（左右翻）、
//        lift（離地）、shadow、uid（點選用）、tint、onReady }
// 掛在牆上的另外設 group.userData.wall（後牆，不轉）或 wallFace（側牆，見 faceCamera）；userData.yawOff：朝桌子等方向偏轉
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
    let k = opt.height ? opt.height / a.h : (opt.scale || 1);
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

// 疊在紙片上的另一張圖（展示櫃上的陳列、矮櫃上的唱盤）：掛在 parent 的 mesh 底下，跟著一起轉、一起仰、一起拉長。
// u：中心在 parent 寬度的哪裡（-0.5～0.5）、v：底邊在 parent 高度的哪裡（0～1）、w：寬度佔 parent 寬的幾成、z：往前浮多少（公尺，防 z-fighting）
// parent 要先載好（在它的 onReady 裡叫）。回傳 mesh（載好前不顯示）
export function overlay(parent, name, { u = 0, v = 0, w = 0.5, z = 0.01, flip = false, uid } = {}) {
  const pm = parent.userData.mesh;
  const ps = parent.userData.size;
  const mat = new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), mat);
  m.visible = false;
  m.userData.uid = uid;
  m.userData.overlay = name;
  pm.add(m);
  loadPaper(name).then((a) => {
    if (!a || !ps) return;
    mat.map = a.tex;
    mat.needsUpdate = true;
    const hm = (w * ps.w * a.h) / a.w; // 等比：公尺高
    m.scale.set(w * (flip ? -1 : 1), hm / ps.h, 1);
    m.position.set(u, v, z);
    m.visible = true;
  });
  return m;
}

// 換一張圖（客人坐下／站起來、椅子轉成椅背）：沿用同一個紙片，大小跟著換。opt：{ flip, scale, height, fit }（同 paper()）
export function setPaperArt(group, name, opt = {}) {
  if (group.userData.art === name && !!group.userData.flipNow === !!opt.flip) return;
  group.userData.art = name;
  group.userData.flipNow = !!opt.flip;
  loadPaper(name).then((a) => {
    if (!a || group.userData.art !== name) return;
    let k = opt.height ? opt.height / a.h : (opt.scale || 1);
    if (opt.fit && a.w * k > opt.fit) k = opt.fit / a.w;
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
//
// 側牆上的東西（userData.wallFace = { side: 'left'|'right', x, z, hung }）：俯視時側牆幾乎是一條線，
// 貼平了看不到，所以轉到斜斜朝著鏡頭（往牆那邊偏 0.5 弧度），整張往房間裡推、不插進牆裡；座位視角就平貼在牆上。
// hung（掛著的）不往後仰、不拉長。userData.yawOff：在「朝鏡頭」之外再偏一點（椅子朝桌子）。
// wallFace.tilt：很寬的東西（整面的展示櫃）偏多一點，才不會從牆邊一路伸到房間中間。
//
// 椅子（userData.chair = { side, back, flip, yawOff, face：[ux, uz] 朝桌子的方向, fit }）：
// 椅子背對鏡頭（坐在桌子靠鏡頭這一側）時換成椅背圖、正對鏡頭；其他角度照舊用 3/4 側面圖＋flip／yawOff。
const SIDE_TILT = 0.5;
const BACK_DOT = -0.6; // 朝向和「往鏡頭」的夾角 cos 小於這個就算背對
function chairFacing(p, camera, over, wp) {
  const c = p.userData.chair;
  if (!c.back || !p.userData.size) return;
  if (!c.h) c.h = p.userData.size.h; // 側面圖載好時的高度：椅背圖照這個高度
  let tx;
  let tz;
  if (over) { tx = -fwd.x; tz = -fwd.z; } else { tx = camera.position.x - wp.x; tz = camera.position.z - wp.z; }
  const len = Math.hypot(tx, tz) || 1;
  const away = (c.face[0] * tx + c.face[1] * tz) / len < BACK_DOT;
  if (away) {
    setPaperArt(p, c.back, { height: c.h, fit: c.fit });
    p.userData.yawOff = 0;
  } else {
    setPaperArt(p, c.side, { flip: c.flip, fit: c.fit });
    p.userData.yawOff = c.yawOff;
  }
}

export function faceCamera(papers, camera, over) {
  camera.getWorldDirection(fwd);
  const screenYaw = Math.atan2(-fwd.x, -fwd.z);
  for (const p of papers) {
    const wf = p.userData.wallFace;
    if (p.userData.wall && !wf) continue; // 貼後牆的不轉
    const m = p.userData.mesh;
    if (p.userData.chair) chairFacing(p, camera, over, p.getWorldPosition(new THREE.Vector3()));
    if (wf) {
      const inward = wf.side === 'left' ? 1 : -1;
      if (over) {
        const tilt = (wf.tilt ?? SIDE_TILT) * inward;
        p.rotation.y = screenYaw + tilt;
        const half = (p.userData.size?.w || 0) / 2;
        p.position.set(wf.x + inward * (half * Math.cos(tilt) + 0.03), 0, wf.z);
      } else {
        p.rotation.y = inward * Math.PI / 2;
        p.position.set(wf.x + inward * 0.03, 0, wf.z);
      }
    } else {
      const wp = p.getWorldPosition(new THREE.Vector3());
      p.rotation.y = (over ? screenYaw : wrapAngle(Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z))) + (p.userData.yawOff || 0);
    }
    const shadow = p.children[1];
    if (shadow) shadow.rotation.z = -p.rotation.y;
    const baseY = p.userData.baseScaleY;
    if (!baseY) continue;
    if (wf?.hung) {
      m.rotation.x = 0;
      m.scale.y = baseY;
      continue;
    }
    const wp = p.getWorldPosition(new THREE.Vector3());
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
