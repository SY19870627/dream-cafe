// 所有美術都用 Canvas 程式繪製，原型階段不需要外部圖檔。
// 之後換成手繪插畫時，只要讓同名函式回傳圖片即可。
import * as THREE from 'three';

const PPM = 200; // 每公尺像素數

function canvas(wm, hm) {
  const c = document.createElement('canvas');
  c.width = Math.round(wm * PPM);
  c.height = Math.round(hm * PPM);
  const g = c.getContext('2d');
  g.scale(PPM, PPM); // 之後一律用公尺為單位繪製
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return { c, g };
}

export function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const INK = '#3b2a20';
function outline(g, w = 0.018) {
  g.strokeStyle = INK;
  g.lineWidth = w;
  g.stroke();
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function ell(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

// 簡單的偽亂數，讓每次畫出來都一樣
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/* ---------- 建築材質 ---------- */

export function woodFloor() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const r = rng(7);
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    let x = -r() * 200;
    while (x < 512) {
      const len = 160 + r() * 220;
      const tone = 150 + r() * 30;
      g.fillStyle = `rgb(${tone + 20},${tone - 25},${tone - 70})`;
      g.fillRect(x, i * 64, len, 64);
      g.strokeStyle = 'rgba(70,40,20,0.45)';
      g.lineWidth = 3;
      g.strokeRect(x, i * 64, len, 64);
      g.strokeStyle = 'rgba(90,55,30,0.18)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        const yy = i * 64 + 12 + r() * 40;
        g.moveTo(x + 5, yy);
        g.bezierCurveTo(x + len * 0.3, yy + 6, x + len * 0.6, yy - 6, x + len - 5, yy);
        g.stroke();
      }
      x += len;
    }
  }
  return c;
}

// 牆：下半紅磚、上半石灰白牆（三合院的感覺）
export function wall(wm, hm) {
  const { c, g } = canvas(wm, hm);
  g.fillStyle = '#efe6d6';
  g.fillRect(0, 0, wm, hm);
  const r = rng(11);
  g.fillStyle = 'rgba(160,140,110,0.08)';
  for (let i = 0; i < 400; i++) g.fillRect(r() * wm, r() * hm, 0.06, 0.03);
  const brickTop = hm - 1.0;
  g.fillStyle = '#a24a33';
  g.fillRect(0, brickTop, wm, 1.0);
  const bh = 0.09, bw = 0.24;
  for (let row = 0; row * bh < 1.0; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -off; x < wm; x += bw) {
      const t = r();
      g.fillStyle = t < 0.3 ? '#9a4430' : t < 0.6 ? '#ad5239' : '#a34b34';
      g.fillRect(x + 0.008, brickTop + row * bh + 0.008, bw - 0.016, bh - 0.016);
    }
  }
  g.fillStyle = '#6e4a32';
  g.fillRect(0, brickTop - 0.05, wm, 0.06); // 腰帶木條
  return c;
}

export function ceiling(wm, hm) {
  const { c, g } = canvas(wm, hm);
  g.fillStyle = '#5a3d2b';
  g.fillRect(0, 0, wm, hm);
  for (let x = 0.3; x < wm; x += 0.9) {
    g.fillStyle = '#3f2a1d';
    g.fillRect(x, 0, 0.16, hm);
  }
  return c;
}

// weather：'clear'、'rain'（灰藍的雨天）、'typhoon'（颱風夜：暗、樹被吹彎）
export function windowView(night, weather = 'clear') {
  const { c, g } = canvas(1.6, 1.3);
  const sky = g.createLinearGradient(0, 0, 0, 1.3);
  const wet = weather !== 'clear';
  if (weather === 'typhoon') {
    sky.addColorStop(0, '#141b22');
    sky.addColorStop(1, '#33403f');
  } else if (weather === 'rain') {
    sky.addColorStop(0, night ? '#151b2a' : '#8d99a6');
    sky.addColorStop(1, night ? '#2b3445' : '#c4c9c8');
  } else if (night) {
    sky.addColorStop(0, '#0f1a33');
    sky.addColorStop(1, '#2a3555');
  } else {
    sky.addColorStop(0, '#9fd0f0');
    sky.addColorStop(1, '#f6e7c6');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 1.6, 1.3);
  const r = rng(3);
  if (night && !wet) {
    g.fillStyle = '#fff8dc';
    for (let i = 0; i < 40; i++) g.fillRect(r() * 1.6, r() * 0.7, 0.008, 0.008);
    ell(g, 1.25, 0.25, 0.08, 0.08);
    g.fillStyle = '#fbf0c8';
    g.fill();
  }
  // 遠山
  g.beginPath();
  g.moveTo(0, 0.85);
  for (let x = 0; x <= 1.6; x += 0.1) g.lineTo(x, 0.7 + Math.sin(x * 3.1) * 0.08 + Math.sin(x * 7) * 0.03);
  g.lineTo(1.6, 1.3); g.lineTo(0, 1.3);
  g.fillStyle = weather === 'typhoon' ? '#1c2525' : night ? '#1b2440' : wet ? '#7d9283' : '#8fb38a';
  g.fill();
  // 近處龍眼樹（颱風夜被風吹彎）
  g.fillStyle = weather === 'typhoon' ? '#101716' : night ? '#121a2c' : wet ? '#45624a' : '#4f7d4a';
  for (const [x, y, s] of [[0.2, 0.95, 0.28], [0.55, 1.05, 0.22], [1.3, 1.0, 0.3]]) {
    if (weather === 'typhoon') { g.beginPath(); g.ellipse(x + s * 0.35, y - s * 0.1, s * 1.15, s * 0.55, -0.35, 0, Math.PI * 2); g.fill(); }
    else { ell(g, x, y, s, s * 0.8); g.fill(); }
  }
  // 雨絲
  if (wet) {
    const heavy = weather === 'typhoon';
    g.strokeStyle = heavy ? 'rgba(200,215,220,0.5)' : 'rgba(230,236,240,0.45)';
    g.lineWidth = 0.006;
    for (let i = 0; i < (heavy ? 140 : 60); i++) {
      const x = r() * 1.7, y = r() * 1.3, l = heavy ? 0.12 : 0.07;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - (heavy ? 0.06 : 0.01), y + l); g.stroke();
    }
  }
  // 窗框
  g.strokeStyle = '#4a3122';
  g.lineWidth = 0.07;
  g.strokeRect(0.035, 0.035, 1.53, 1.23);
  g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(0.8, 0); g.lineTo(0.8, 1.3); g.moveTo(0, 0.65); g.lineTo(1.6, 0.65); g.stroke();
  return c;
}

// menu：菜單上的東西（阿哲的豆上架後，小黑板多一行）
export function backBar(wm, hm, menu = []) {
  // 吧台後方牆上的層架與罐子
  const { c, g } = canvas(wm, hm);
  const r = rng(5);
  for (let i = 0; i < 2; i++) {
    const y = 0.45 + i * 0.5;
    g.fillStyle = '#6b4630';
    g.fillRect(0.1, y, wm - 0.2, 0.05);
    for (let x = 0.2; x < wm - 0.3; x += 0.22 + r() * 0.1) {
      const h = 0.14 + r() * 0.12;
      rr(g, x, y - h, 0.12, h, 0.02);
      g.fillStyle = ['#c9a77c', '#7b5a43', '#d9c6a3', '#5e7b6a'][Math.floor(r() * 4)];
      g.fill();
      outline(g, 0.01);
    }
  }
  // 小黑板
  rr(g, wm / 2 - 0.45, 1.15, 0.9, 0.5, 0.03);
  g.fillStyle = '#2f3a33'; g.fill(); outline(g, 0.02);
  g.fillStyle = '#f2ead8';
  g.font = '0.09px "PingFang TC","Noto Sans TC",sans-serif';
  g.textAlign = 'center';
  g.fillText('今日手沖', wm / 2, 1.3);
  g.font = '0.075px "PingFang TC","Noto Sans TC",sans-serif';
  if (menu.includes('zhe-beans')) {
    g.fillText('東山 日曬', wm / 2, 1.41);
    g.fillText('阿里山 水洗', wm / 2, 1.5);
    g.font = 'bold 0.085px "PingFang TC","Noto Sans TC",sans-serif';
    g.fillStyle = '#ffd27a';
    g.fillText('阿哲的豆', wm / 2, 1.61); // 「好啦，寫大一點。」
  } else {
    g.fillText('東山 日曬', wm / 2, 1.44);
    g.fillText('阿里山 水洗', wm / 2, 1.56);
  }
  return c;
}

export function thermometer(temp) {
  const { c, g } = canvas(0.36, 0.9);
  rr(g, 0.03, 0.02, 0.3, 0.86, 0.05);
  g.fillStyle = '#e8d7b5'; g.fill(); outline(g, 0.015);
  g.fillStyle = INK;
  g.font = 'bold 0.05px "PingFang TC","Noto Sans TC",sans-serif';
  g.textAlign = 'center';
  g.fillText('溫度', 0.18, 0.1);
  rr(g, 0.155, 0.14, 0.05, 0.58, 0.025);
  g.fillStyle = '#fff'; g.fill(); outline(g, 0.01);
  const t = Math.max(20, Math.min(37, temp));
  const top = 0.7 - ((t - 20) / 17) * 0.54;
  g.fillStyle = '#c4382c';
  g.fillRect(0.165, top, 0.03, 0.72 - top);
  ell(g, 0.18, 0.76, 0.05, 0.05); g.fill(); outline(g, 0.01);
  g.font = '0.04px "PingFang TC","Noto Sans TC",sans-serif';
  g.fillText(t.toFixed(1) + '°', 0.18, 0.86);
  return c;
}

/* ---------- 紙片人物與擺飾（底部置中為原點） ---------- */

export function deshu(pose) {
  // 德叔：白襯衫、深咖啡背心、灰白頭髮
  const W = 0.9, H = 1.8;
  const { c, g } = canvas(W, H);
  const cx = W / 2;
  // 褲子
  rr(g, cx - 0.17, 1.05, 0.15, 0.73, 0.04); g.fillStyle = '#3d3a3a'; g.fill(); outline(g);
  rr(g, cx + 0.02, 1.05, 0.15, 0.73, 0.04); g.fill(); outline(g);
  // 身體
  rr(g, cx - 0.22, 0.48, 0.44, 0.65, 0.1); g.fillStyle = '#f7f4ee'; g.fill(); outline(g);
  g.beginPath();
  g.moveTo(cx - 0.2, 0.55); g.lineTo(cx - 0.06, 0.55); g.lineTo(cx, 0.72); g.lineTo(cx + 0.06, 0.55);
  g.lineTo(cx + 0.2, 0.55); g.lineTo(cx + 0.2, 1.1); g.lineTo(cx - 0.2, 1.1); g.closePath();
  g.fillStyle = '#5b3a29'; g.fill(); outline(g);
  g.fillStyle = '#d8c6a8';
  for (const y of [0.78, 0.88, 0.98]) { ell(g, cx, y, 0.012, 0.012); g.fill(); }
  // 手臂
  g.fillStyle = '#f7f4ee';
  const wiping = pose === 'wipe' || pose === 'wipe2';
  if (wiping) {
    // 擦琺瑯杯：兩隻手在胸前，一手拿杯、一手拿布（wipe2 是布擦到另一邊）
    rr(g, cx - 0.31, 0.52, 0.11, 0.3, 0.05); g.fill(); outline(g);
    rr(g, cx + 0.2, 0.52, 0.11, 0.3, 0.05); g.fill(); outline(g);
    g.save(); g.translate(cx - 0.27, 0.8); g.rotate(-0.85);
    rr(g, 0, -0.05, 0.22, 0.1, 0.05); g.fill(); outline(g); g.restore();
    g.save(); g.translate(cx + 0.27, 0.8); g.rotate(Math.PI + 0.85);
    rr(g, 0, -0.05, 0.22, 0.1, 0.05); g.fill(); outline(g); g.restore();
    enamelCup(g, cx - 0.07, 0.5);
    const off = pose === 'wipe2' ? -0.05 : 0.03;
    g.beginPath(); g.moveTo(cx + off, 0.52); g.quadraticCurveTo(cx + off + 0.08, 0.49, cx + off + 0.13, 0.54);
    g.lineTo(cx + off + 0.12, 0.66); g.quadraticCurveTo(cx + off + 0.05, 0.69, cx + off - 0.01, 0.64); g.closePath();
    g.fillStyle = '#e6dcc4'; g.fill(); outline(g, 0.012);
    g.fillStyle = '#e9c3a0';
    ell(g, cx - 0.1, 0.64, 0.045, 0.045); g.fill(); outline(g, 0.012);
    ell(g, cx + off + 0.08, 0.6, 0.045, 0.045); g.fill(); outline(g, 0.012);
  } else {
    rr(g, cx - 0.31, 0.52, 0.11, 0.42, 0.05); g.fill(); outline(g);
  }
  if (wiping) {
    // 手已經畫在胸前
  } else if (pose === 'pour') {
    g.save(); g.translate(cx + 0.2, 0.56); g.rotate(-1.0);
    rr(g, 0, -0.05, 0.4, 0.11, 0.05); g.fill(); outline(g);
    g.restore();
    g.fillStyle = '#e9c3a0';
    ell(g, cx + 0.43, 0.23, 0.05, 0.05); g.fill(); outline(g, 0.012);
  } else {
    rr(g, cx + 0.2, 0.52, 0.11, 0.42, 0.05); g.fill(); outline(g);
  }
  // 手
  g.fillStyle = '#e9c3a0';
  if (!wiping) { ell(g, cx - 0.255, 0.96, 0.05, 0.05); g.fill(); outline(g, 0.012); }
  if (pose !== 'pour' && !wiping) { ell(g, cx + 0.255, 0.96, 0.05, 0.05); g.fill(); outline(g, 0.012); }
  // 頭
  ell(g, cx, 0.3, 0.15, 0.17); g.fillStyle = '#e9c3a0'; g.fill(); outline(g);
  g.beginPath();
  g.ellipse(cx, 0.22, 0.16, 0.11, 0, Math.PI, Math.PI * 2);
  g.fillStyle = '#c9c6c0'; g.fill(); outline(g);
  // 臉
  g.strokeStyle = INK; g.lineWidth = 0.014;
  g.beginPath(); g.moveTo(cx - 0.08, 0.31); g.lineTo(cx - 0.035, 0.31); g.stroke();
  g.beginPath(); g.moveTo(cx + 0.035, 0.31); g.lineTo(cx + 0.08, 0.31); g.stroke();
  g.beginPath(); g.moveTo(cx - 0.05, 0.39); g.quadraticCurveTo(cx, 0.405, cx + 0.05, 0.39);
  g.strokeStyle = '#8a8580'; g.lineWidth = 0.022; g.stroke();
  return c;
}

// 那個舊的琺瑯杯：白底、深藍杯緣，有一點掉漆（x, y 是杯子左上角）
function enamelCup(g, x, y) {
  rr(g, x, y, 0.13, 0.12, 0.02); g.fillStyle = '#f4f2ec'; g.fill(); outline(g, 0.012);
  g.fillStyle = '#23406e'; g.fillRect(x + 0.005, y, 0.12, 0.018);
  g.beginPath(); g.arc(x + 0.135, y + 0.06, 0.03, -1.3, 1.3); g.strokeStyle = '#23406e'; g.lineWidth = 0.014; g.stroke();
  g.fillStyle = '#4a4440'; ell(g, x + 0.03, y + 0.09, 0.008, 0.006); g.fill(); // 掉漆的一小塊
}

export function cat(pose) {
  // 龍眼：橘貓
  const { c, g } = canvas(0.6, 0.45);
  const o = '#e8913a';
  if (pose === 'sleep') {
    ell(g, 0.3, 0.33, 0.24, 0.1); g.fillStyle = o; g.fill(); outline(g, 0.012);
    ell(g, 0.12, 0.3, 0.09, 0.08); g.fill(); outline(g, 0.012);
    g.beginPath(); g.moveTo(0.06, 0.25); g.lineTo(0.07, 0.19); g.lineTo(0.11, 0.23); g.fill(); outline(g, 0.01);
    g.beginPath(); g.moveTo(0.14, 0.23); g.lineTo(0.18, 0.19); g.lineTo(0.19, 0.25); g.fill(); outline(g, 0.01);
    g.strokeStyle = INK; g.lineWidth = 0.008;
    g.beginPath(); g.moveTo(0.08, 0.3); g.quadraticCurveTo(0.1, 0.31, 0.11, 0.3); g.stroke();
    g.beginPath(); g.moveTo(0.48, 0.38); g.quadraticCurveTo(0.58, 0.4, 0.5, 0.42); g.strokeStyle = o; g.lineWidth = 0.04; g.stroke();
    g.strokeStyle = '#c96f22'; g.lineWidth = 0.012;
    for (const x of [0.28, 0.35, 0.42]) { g.beginPath(); g.moveTo(x, 0.24); g.lineTo(x - 0.02, 0.3); g.stroke(); }
  } else {
    ell(g, 0.3, 0.32, 0.13, 0.12); g.fillStyle = o; g.fill(); outline(g, 0.012);
    ell(g, 0.3, 0.15, 0.1, 0.09); g.fill(); outline(g, 0.012);
    g.beginPath(); g.moveTo(0.21, 0.11); g.lineTo(0.22, 0.03); g.lineTo(0.27, 0.08); g.fill(); outline(g, 0.01);
    g.beginPath(); g.moveTo(0.33, 0.08); g.lineTo(0.38, 0.03); g.lineTo(0.39, 0.11); g.fill(); outline(g, 0.01);
    g.fillStyle = INK;
    ell(g, 0.265, 0.15, 0.012, 0.016); g.fill();
    ell(g, 0.335, 0.15, 0.012, 0.016); g.fill();
    g.beginPath(); g.moveTo(0.42, 0.4); g.quadraticCurveTo(0.55, 0.38, 0.5, 0.25); g.strokeStyle = o; g.lineWidth = 0.04; g.stroke();
  }
  return c;
}

// 予安：坐著寫稿的作家。pose：'type'（看筆電）、'napkin'（借了筆在紙巾上寫字）、'read'（念稿子）、'book'（拿著剛印好的書）
export function yuan(pose = 'type') {
  const { c, g } = canvas(0.8, 1.35);
  const cx = 0.4;
  rr(g, cx - 0.18, 0.5, 0.36, 0.5, 0.1); g.fillStyle = '#7c8f9e'; g.fill(); outline(g);
  rr(g, cx - 0.2, 0.95, 0.4, 0.14, 0.05); g.fillStyle = '#d9cbb3'; g.fill(); outline(g);
  rr(g, cx - 0.15, 1.05, 0.11, 0.28, 0.04); g.fillStyle = '#4b4a52'; g.fill(); outline(g);
  rr(g, cx + 0.04, 1.05, 0.11, 0.28, 0.04); g.fill(); outline(g);
  ell(g, cx, 0.32, 0.13, 0.15); g.fillStyle = '#efc9a6'; g.fill(); outline(g);
  g.beginPath(); g.ellipse(cx, 0.3, 0.16, 0.19, 0, Math.PI * 0.95, Math.PI * 2.05);
  g.fillStyle = '#2d2420'; g.fill();
  rr(g, cx - 0.16, 0.25, 0.07, 0.3, 0.03); g.fill();
  rr(g, cx + 0.09, 0.25, 0.07, 0.3, 0.03); g.fill();
  g.strokeStyle = INK; g.lineWidth = 0.012;
  g.beginPath(); g.moveTo(cx - 0.06, 0.34); g.lineTo(cx - 0.02, 0.35); g.stroke();
  g.beginPath(); g.moveTo(cx + 0.02, 0.35); g.lineTo(cx + 0.06, 0.34); g.stroke();
  const hand = (x, y) => { ell(g, x, y, 0.04, 0.04); g.fillStyle = '#efc9a6'; g.fill(); outline(g, 0.01); };
  if (pose === 'napkin') {
    // 紙巾在腿上，一手拿筆
    g.save(); g.translate(cx + 0.02, 0.86); g.rotate(-0.12);
    rr(g, -0.12, -0.06, 0.24, 0.13, 0.01); g.fillStyle = '#fbfaf5'; g.fill(); outline(g, 0.01);
    g.strokeStyle = 'rgba(40,40,60,.6)'; g.lineWidth = 0.006;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-0.1, -0.035 + k * 0.028); g.lineTo(0.06 + (k % 2) * 0.04, -0.035 + k * 0.028); g.stroke(); }
    g.restore();
    hand(cx - 0.1, 0.86);
    g.strokeStyle = '#2e4b7a'; g.lineWidth = 0.014; g.beginPath(); g.moveTo(cx + 0.1, 0.84); g.lineTo(cx + 0.16, 0.74); g.stroke();
    hand(cx + 0.1, 0.86);
  } else if (pose === 'read') {
    // 雙手拿著幾張稿紙
    g.save(); g.translate(cx, 0.68); g.rotate(0.05);
    rr(g, -0.13, -0.1, 0.26, 0.2, 0.01); g.fillStyle = '#fbf6e8'; g.fill(); outline(g, 0.01);
    g.strokeStyle = 'rgba(60,40,30,.5)'; g.lineWidth = 0.006;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-0.1, -0.06 + k * 0.03); g.lineTo(0.1, -0.06 + k * 0.03); g.stroke(); }
    g.restore();
    hand(cx - 0.13, 0.72); hand(cx + 0.13, 0.72);
  } else if (pose === 'book') {
    // 拿著剛印好的書，封面朝外
    rr(g, cx - 0.12, 0.6, 0.24, 0.3, 0.015); g.fillStyle = '#c2683f'; g.fill(); outline(g, 0.012);
    rr(g, cx - 0.08, 0.66, 0.16, 0.05, 0.01); g.fillStyle = '#f3e7cf'; g.fill();
    ell(g, cx, 0.8, 0.05, 0.035); g.fillStyle = 'rgba(255,240,210,.7)'; g.fill(); // 封面上的一縷煙
    hand(cx - 0.13, 0.8); hand(cx + 0.13, 0.8);
  }
  return c;
}

export function chair() {
  const { c, g } = canvas(0.5, 0.95);
  g.fillStyle = '#8a5a3b';
  rr(g, 0.06, 0.02, 0.38, 0.08, 0.03); g.fill(); outline(g);
  rr(g, 0.06, 0.02, 0.05, 0.55, 0.02); g.fill(); outline(g);
  rr(g, 0.39, 0.02, 0.05, 0.55, 0.02); g.fill(); outline(g);
  for (const y of [0.2, 0.32]) { rr(g, 0.1, y, 0.3, 0.04, 0.02); g.fill(); outline(g, 0.012); }
  rr(g, 0.03, 0.5, 0.44, 0.08, 0.03); g.fillStyle = '#a06b46'; g.fill(); outline(g);
  g.fillStyle = '#8a5a3b';
  rr(g, 0.06, 0.56, 0.05, 0.38, 0.02); g.fill(); outline(g);
  rr(g, 0.39, 0.56, 0.05, 0.38, 0.02); g.fill(); outline(g);
  return c;
}

export function stool() {
  const { c, g } = canvas(0.45, 0.8);
  ell(g, 0.225, 0.08, 0.18, 0.06); g.fillStyle = '#a06b46'; g.fill(); outline(g);
  g.fillStyle = '#4a4744';
  rr(g, 0.08, 0.1, 0.04, 0.69, 0.02); g.fill(); outline(g, 0.012);
  rr(g, 0.33, 0.1, 0.04, 0.69, 0.02); g.fill(); outline(g, 0.012);
  rr(g, 0.1, 0.5, 0.25, 0.03, 0.01); g.fill(); outline(g, 0.012);
  return c;
}

export function sofa() {
  const { c, g } = canvas(1.5, 0.9);
  rr(g, 0.1, 0.05, 1.3, 0.5, 0.12); g.fillStyle = '#5f7b6a'; g.fill(); outline(g);
  rr(g, 0.02, 0.35, 0.22, 0.45, 0.08); g.fill(); outline(g);
  rr(g, 1.26, 0.35, 0.22, 0.45, 0.08); g.fill(); outline(g);
  rr(g, 0.2, 0.45, 1.1, 0.25, 0.08); g.fillStyle = '#6f8d7a'; g.fill(); outline(g);
  rr(g, 0.2, 0.62, 1.1, 0.18, 0.05); g.fillStyle = '#4f6858'; g.fill(); outline(g);
  rr(g, 0.3, 0.2, 0.3, 0.25, 0.08); g.fillStyle = '#e6c46e'; g.fill(); outline(g, 0.012);
  g.fillStyle = '#3b2a20';
  rr(g, 0.15, 0.8, 0.06, 0.1, 0.02); g.fill();
  rr(g, 1.29, 0.8, 0.06, 0.1, 0.02); g.fill();
  return c;
}

export function plant() {
  const { c, g } = canvas(0.8, 1.4);
  const r = rng(9);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
    const L = 0.25 + r() * 0.3;
    const x = 0.4 + Math.cos(a) * L, y = 0.75 + Math.sin(a) * L;
    g.beginPath(); g.moveTo(0.4, 1.0); g.quadraticCurveTo(0.4, y + 0.2, x, y);
    g.strokeStyle = '#4c6a3a'; g.lineWidth = 0.02; g.stroke();
    g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
    ell(g, 0, 0, 0.08, 0.15);
    g.fillStyle = i % 2 ? '#5f8f4a' : '#4f7d3e'; g.fill(); outline(g, 0.012);
    g.restore();
  }
  g.beginPath(); g.moveTo(0.22, 1.0); g.lineTo(0.58, 1.0); g.lineTo(0.53, 1.38); g.lineTo(0.27, 1.38); g.closePath();
  g.fillStyle = '#c2734a'; g.fill(); outline(g);
  return c;
}

export function bookshelf() {
  const { c, g } = canvas(1.0, 1.9);
  rr(g, 0.02, 0.02, 0.96, 1.86, 0.03); g.fillStyle = '#7a5038'; g.fill(); outline(g);
  const r = rng(21);
  for (let s = 0; s < 4; s++) {
    const y0 = 0.1 + s * 0.44;
    g.fillStyle = '#4a2f21';
    g.fillRect(0.08, y0, 0.84, 0.36);
    let x = 0.1;
    while (x < 0.86) {
      const w = 0.04 + r() * 0.04, h = 0.24 + r() * 0.1;
      g.fillStyle = ['#b5523b', '#e2c27a', '#5c7f8c', '#8b9a5b', '#e9e0cf', '#6b4a7a'][Math.floor(r() * 6)];
      g.fillRect(x, y0 + 0.36 - h, w, h);
      x += w + 0.008;
    }
  }
  return c;
}

export function recordPlayer() {
  const { c, g } = canvas(0.7, 0.85);
  rr(g, 0.05, 0.3, 0.6, 0.52, 0.03); g.fillStyle = '#8c5d3f'; g.fill(); outline(g);
  rr(g, 0.1, 0.38, 0.5, 0.18, 0.02); g.fillStyle = '#6b452f'; g.fill(); outline(g, 0.012);
  rr(g, 0.02, 0.18, 0.66, 0.13, 0.03); g.fillStyle = '#3a2a22'; g.fill(); outline(g);
  ell(g, 0.32, 0.22, 0.2, 0.05); g.fillStyle = '#151515'; g.fill();
  ell(g, 0.32, 0.22, 0.05, 0.015); g.fillStyle = '#c4382c'; g.fill();
  g.beginPath(); g.moveTo(0.58, 0.2); g.lineTo(0.45, 0.14); g.lineTo(0.38, 0.2); outline(g, 0.012);
  return c;
}

export function floorLamp(on) {
  const { c, g } = canvas(0.6, 1.7);
  if (on) {
    const grd = g.createRadialGradient(0.3, 0.25, 0.02, 0.3, 0.25, 0.3);
    grd.addColorStop(0, 'rgba(255,214,150,0.9)');
    grd.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 0.6, 0.6);
  }
  g.beginPath(); g.moveTo(0.16, 0.38); g.lineTo(0.44, 0.38); g.lineTo(0.38, 0.12); g.lineTo(0.22, 0.12); g.closePath();
  g.fillStyle = on ? '#ffe2b0' : '#efe1c4'; g.fill(); outline(g);
  rr(g, 0.285, 0.38, 0.03, 1.22, 0.01); g.fillStyle = '#3a3330'; g.fill();
  ell(g, 0.3, 1.62, 0.13, 0.04); g.fill(); outline(g, 0.012);
  return c;
}

export function menuBoard() {
  const { c, g } = canvas(0.6, 1.0);
  g.strokeStyle = '#6b452f'; g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(0.1, 0.98); g.lineTo(0.18, 0.05); g.moveTo(0.5, 0.98); g.lineTo(0.42, 0.05); g.stroke();
  rr(g, 0.08, 0.05, 0.44, 0.62, 0.03); g.fillStyle = '#2f3a33'; g.fill(); outline(g);
  g.fillStyle = '#f2ead8';
  g.font = '0.06px "PingFang TC","Noto Sans TC",sans-serif';
  g.textAlign = 'center';
  g.fillText('營業中', 0.3, 0.17);
  g.font = '0.045px "PingFang TC","Noto Sans TC",sans-serif';
  g.fillText('不限時', 0.3, 0.3);
  g.fillText('慢慢等', 0.3, 0.4);
  g.fillText('咖啡也在等你', 0.3, 0.5);
  return c;
}

/* ---------- 德叔的型錄：階段 2 新增的擺飾（之後換手繪只改這些同名函式） ---------- */

// 小邊桌（小擺飾放在上面，免得直接擺在地上）
function sideTable(g, cx, top, w = 0.4, h = 0.55) {
  rr(g, cx - w / 2, top, w, 0.05, 0.02); g.fillStyle = '#8a5a3b'; g.fill(); outline(g);
  g.fillStyle = '#6b452f';
  rr(g, cx - w / 2 + 0.04, top + 0.05, 0.035, h - 0.05, 0.01); g.fill(); outline(g, 0.012);
  rr(g, cx + w / 2 - 0.075, top + 0.05, 0.035, h - 0.05, 0.01); g.fill(); outline(g, 0.012);
}

export function longanJar() {
  // 龍眼乾玻璃罐，放在小邊桌上
  const { c, g } = canvas(0.5, 0.95);
  sideTable(g, 0.25, 0.4);
  rr(g, 0.13, 0.13, 0.24, 0.27, 0.05); g.fillStyle = 'rgba(214,236,242,0.75)'; g.fill(); outline(g, 0.012);
  const r = rng(31);
  for (let i = 0; i < 16; i++) { ell(g, 0.16 + r() * 0.18, 0.22 + r() * 0.15, 0.025, 0.022); g.fillStyle = i % 2 ? '#8a4e22' : '#6e3b18'; g.fill(); }
  rr(g, 0.15, 0.08, 0.2, 0.06, 0.02); g.fillStyle = '#c4382c'; g.fill(); outline(g, 0.012);
  rr(g, 0.17, 0.27, 0.16, 0.07, 0.01); g.fillStyle = '#f2ead8'; g.fill();
  g.fillStyle = INK; g.font = '0.04px "PingFang TC","Noto Sans TC",sans-serif'; g.textAlign = 'center';
  g.fillText('龍眼乾', 0.25, 0.325);
  return c;
}

export function succulent() {
  // 小花架上的三盆多肉
  const { c, g } = canvas(0.5, 1.0);
  g.strokeStyle = '#6b452f'; g.lineWidth = 0.03;
  g.beginPath(); g.moveTo(0.12, 0.98); g.lineTo(0.16, 0.35); g.moveTo(0.38, 0.98); g.lineTo(0.34, 0.35); g.stroke();
  for (const y of [0.35, 0.68]) { rr(g, 0.08, y, 0.34, 0.04, 0.01); g.fillStyle = '#8a5a3b'; g.fill(); outline(g, 0.012); }
  const pot = (x, y, s) => {
    for (let i = 0; i < 5; i++) {
      g.save(); g.translate(x, y); g.rotate(-1 + i * 0.5);
      ell(g, 0, -0.035 * s, 0.022 * s, 0.045 * s); g.fillStyle = i % 2 ? '#7fae7a' : '#6a9a68'; g.fill(); outline(g, 0.008);
      g.restore();
    }
    g.beginPath(); g.moveTo(x - 0.05 * s, y); g.lineTo(x + 0.05 * s, y); g.lineTo(x + 0.04 * s, y + 0.07 * s); g.lineTo(x - 0.04 * s, y + 0.07 * s); g.closePath();
    g.fillStyle = '#c2734a'; g.fill(); outline(g, 0.01);
  };
  pot(0.17, 0.28, 1); pot(0.33, 0.28, 0.9); pot(0.25, 0.61, 1.1);
  return c;
}

export function bookStack() {
  // 地上的一疊舊書
  const { c, g } = canvas(0.5, 0.5);
  const r = rng(41);
  let y = 0.48;
  for (let i = 0; i < 7; i++) {
    const h = 0.045 + r() * 0.025, w = 0.3 + r() * 0.12, x = 0.25 - w / 2 + (r() - 0.5) * 0.05;
    y -= h;
    rr(g, x, y, w, h, 0.008);
    g.fillStyle = ['#b5523b', '#e2c27a', '#5c7f8c', '#8b9a5b', '#e9e0cf', '#6b4a7a'][i % 6]; g.fill(); outline(g, 0.01);
  }
  return c;
}

export function coffeeSack() {
  // 印著「東山」的生豆麻布袋
  const { c, g } = canvas(0.6, 0.75);
  g.beginPath();
  g.moveTo(0.12, 0.12); g.quadraticCurveTo(0.3, 0.02, 0.48, 0.12);
  g.quadraticCurveTo(0.6, 0.45, 0.54, 0.72); g.lineTo(0.06, 0.72); g.quadraticCurveTo(0, 0.45, 0.12, 0.12);
  g.fillStyle = '#c9a77c'; g.fill(); outline(g);
  g.strokeStyle = 'rgba(110,80,50,0.35)'; g.lineWidth = 0.006;
  for (let x = 0.1; x < 0.55; x += 0.035) { g.beginPath(); g.moveTo(x, 0.15); g.lineTo(x, 0.7); g.stroke(); }
  ell(g, 0.3, 0.12, 0.13, 0.04); g.fillStyle = '#6b4428'; g.fill(); outline(g, 0.01);
  g.fillStyle = '#7a3a24'; g.font = 'bold 0.1px "PingFang TC","Noto Sans TC",sans-serif'; g.textAlign = 'center';
  g.fillText('東山', 0.3, 0.46);
  g.font = '0.04px "PingFang TC","Noto Sans TC",sans-serif';
  g.fillText('TAINAN COFFEE', 0.3, 0.55);
  return c;
}

export function catCushion() {
  // 窗邊的貓咪軟墊
  const { c, g } = canvas(0.7, 0.3);
  ell(g, 0.35, 0.19, 0.32, 0.1); g.fillStyle = '#d98f6a'; g.fill(); outline(g);
  ell(g, 0.35, 0.16, 0.24, 0.06); g.fillStyle = '#f0c49a'; g.fill(); outline(g, 0.012);
  g.fillStyle = '#d98f6a';
  for (const x of [0.25, 0.35, 0.45]) { ell(g, x, 0.16, 0.018, 0.014); g.fill(); }
  return c;
}

export function easel() {
  // 畫架：畫的是窗外那片山（畫得不太像）
  const { c, g } = canvas(0.7, 1.5);
  g.strokeStyle = '#8a5a3b'; g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(0.12, 1.48); g.lineTo(0.33, 0.05); g.lineTo(0.58, 1.48); g.moveTo(0.35, 0.3); g.lineTo(0.42, 1.4); g.stroke();
  rr(g, 0.08, 0.2, 0.54, 0.44, 0.01); g.fillStyle = '#f6f0e2'; g.fill(); outline(g);
  g.beginPath(); g.moveTo(0.1, 0.5);
  for (let x = 0.1; x <= 0.6; x += 0.05) g.lineTo(x, 0.42 + Math.sin(x * 12) * 0.04);
  g.lineTo(0.6, 0.62); g.lineTo(0.1, 0.62); g.closePath(); g.fillStyle = '#8fb38a'; g.fill();
  ell(g, 0.5, 0.3, 0.04, 0.04); g.fillStyle = '#f2b45a'; g.fill();
  g.fillStyle = '#4f7d4a'; ell(g, 0.2, 0.56, 0.06, 0.05); g.fill();
  rr(g, 0.07, 0.64, 0.56, 0.04, 0.01); g.fillStyle = '#6b452f'; g.fill(); outline(g, 0.012);
  return c;
}

export function radio() {
  // 老收音機，放在小邊桌上
  const { c, g } = canvas(0.55, 0.95);
  sideTable(g, 0.275, 0.4, 0.45);
  rr(g, 0.07, 0.12, 0.41, 0.28, 0.06); g.fillStyle = '#9b6a44'; g.fill(); outline(g);
  rr(g, 0.1, 0.16, 0.2, 0.2, 0.03); g.fillStyle = '#e6d3ae'; g.fill(); outline(g, 0.012);
  g.strokeStyle = 'rgba(80,50,30,0.5)'; g.lineWidth = 0.008;
  for (let y = 0.19; y < 0.35; y += 0.025) { g.beginPath(); g.moveTo(0.11, y); g.lineTo(0.29, y); g.stroke(); }
  for (const y of [0.2, 0.31]) { ell(g, 0.39, y, 0.035, 0.035); g.fillStyle = '#4a3326'; g.fill(); outline(g, 0.01); }
  g.beginPath(); g.moveTo(0.4, 0.12); g.lineTo(0.48, 0.0); outline(g, 0.012);
  return c;
}

export function cabinet() {
  // 老碗櫥：玻璃門後面放著不成套的杯子
  const { c, g } = canvas(0.9, 1.6);
  rr(g, 0.04, 0.04, 0.82, 1.52, 0.03); g.fillStyle = '#7a5038'; g.fill(); outline(g);
  for (const [y, h] of [[0.12, 0.42], [0.6, 0.42]]) {
    rr(g, 0.1, y, 0.7, h, 0.02); g.fillStyle = 'rgba(214,236,242,0.55)'; g.fill(); outline(g, 0.012);
    g.beginPath(); g.moveTo(0.45, y); g.lineTo(0.45, y + h); outline(g, 0.012);
  }
  const r = rng(51);
  for (const y of [0.5, 0.98]) {
    for (let x = 0.16; x < 0.75; x += 0.13) {
      rr(g, x, y - 0.08 - r() * 0.03, 0.08, 0.08, 0.015);
      g.fillStyle = ['#f4f1ea', '#c4382c', '#5c7f8c', '#e2c27a'][Math.floor(r() * 4)]; g.fill(); outline(g, 0.008);
    }
  }
  for (const y of [1.1, 1.3]) { rr(g, 0.1, y, 0.7, 0.17, 0.02); g.fillStyle = '#8a5a3b'; g.fill(); outline(g, 0.012); ell(g, 0.45, y + 0.085, 0.018, 0.018); g.fillStyle = '#d8c6a8'; g.fill(); }
  return c;
}

export function catTree() {
  // 貓跳台：最上面那層是給龍眼看窗外的
  const { c, g } = canvas(0.8, 1.7);
  g.fillStyle = '#d9c6a3';
  rr(g, 0.33, 0.25, 0.1, 1.38, 0.03); g.fill(); outline(g);
  rr(g, 0.15, 0.85, 0.08, 0.75, 0.03); g.fill(); outline(g);
  g.strokeStyle = 'rgba(110,80,50,0.4)'; g.lineWidth = 0.008;
  for (let y = 0.3; y < 1.6; y += 0.04) { g.beginPath(); g.moveTo(0.33, y); g.lineTo(0.43, y + 0.02); g.stroke(); }
  for (const [x, y, w] of [[0.18, 0.18, 0.5], [0.05, 0.78, 0.4], [0.35, 1.1, 0.4]]) { rr(g, x, y, w, 0.08, 0.04); g.fillStyle = '#b5866a'; g.fill(); outline(g); }
  rr(g, 0.05, 1.58, 0.7, 0.1, 0.04); g.fillStyle = '#8a5a3b'; g.fill(); outline(g);
  ell(g, 0.6, 1.26, 0.04, 0.04); g.fillStyle = '#c4382c'; g.fill(); outline(g, 0.01);
  g.beginPath(); g.moveTo(0.6, 1.18); g.lineTo(0.6, 1.22); outline(g, 0.008);
  return c;
}

export function rattanChair() {
  // 藤編搖椅
  const { c, g } = canvas(0.8, 1.2);
  rr(g, 0.14, 0.05, 0.52, 0.65, 0.18); g.fillStyle = '#d2a868'; g.fill(); outline(g);
  g.strokeStyle = 'rgba(120,80,30,0.45)'; g.lineWidth = 0.008;
  for (let x = 0.2; x < 0.62; x += 0.04) { g.beginPath(); g.moveTo(x, 0.1); g.lineTo(x, 0.66); g.stroke(); }
  for (let y = 0.12; y < 0.66; y += 0.05) { g.beginPath(); g.moveTo(0.16, y); g.lineTo(0.64, y); g.stroke(); }
  rr(g, 0.1, 0.62, 0.6, 0.14, 0.06); g.fillStyle = '#c99a58'; g.fill(); outline(g);
  rr(g, 0.16, 0.6, 0.48, 0.1, 0.05); g.fillStyle = '#e8d7b5'; g.fill(); outline(g, 0.012);
  g.strokeStyle = '#a77a3e'; g.lineWidth = 0.03;
  g.beginPath(); g.moveTo(0.16, 0.76); g.lineTo(0.12, 1.08); g.moveTo(0.64, 0.76); g.lineTo(0.68, 1.08); g.stroke();
  g.beginPath(); g.moveTo(0.02, 1.06); g.quadraticCurveTo(0.4, 1.2, 0.78, 1.06); g.lineWidth = 0.035; g.stroke();
  return c;
}

export function bookWall() {
  // 整面書牆：從地板到天花板
  const W = 1.9, H = 2.5; // 寬 1.9 公尺：後牆的窗戶與老溫度計之間剛好放得下
  const { c, g } = canvas(W, H);
  rr(g, 0.02, 0.02, W - 0.04, H - 0.04, 0.03); g.fillStyle = '#6e4632'; g.fill(); outline(g);
  const r = rng(61);
  const rows = 6, rowH = (H - 0.14) / rows;
  for (let s = 0; s < rows; s++) {
    const y0 = 0.08 + s * rowH;
    g.fillStyle = '#41291d';
    g.fillRect(0.08, y0, W - 0.16, rowH - 0.06);
    let x = 0.1;
    while (x < W - 0.14) {
      const w = 0.035 + r() * 0.045, h = rowH * (0.55 + r() * 0.3);
      if (r() < 0.06) { x += 0.12; continue; } // 偶爾空一格，放一個小東西的位置
      g.fillStyle = ['#b5523b', '#e2c27a', '#5c7f8c', '#8b9a5b', '#e9e0cf', '#6b4a7a', '#a77a3e'][Math.floor(r() * 7)];
      g.fillRect(x, y0 + rowH - 0.06 - h, w, h);
      x += w + 0.006;
    }
  }
  // 中間的梯子
  g.strokeStyle = '#a77a3e'; g.lineWidth = 0.035;
  const L = W - 0.75;
  g.beginPath(); g.moveTo(L, 0.3); g.lineTo(L + 0.2, H - 0.05); g.moveTo(L + 0.25, 0.3); g.lineTo(L + 0.45, H - 0.05); g.stroke();
  g.lineWidth = 0.025;
  for (let k = 0; k < 7; k++) { const t = k / 7; g.beginPath(); g.moveTo(L + 0.02 + t * 0.2, 0.5 + t * 1.9); g.lineTo(L + 0.27 + t * 0.2, 0.5 + t * 1.9); g.stroke(); }
  return c;
}

export function kettleSet() {
  // 吧台上的手沖架與磨豆機
  const { c, g } = canvas(0.7, 0.45);
  rr(g, 0.05, 0.05, 0.16, 0.38, 0.03); g.fillStyle = '#5a4a40'; g.fill(); outline(g, 0.012);
  ell(g, 0.13, 0.06, 0.07, 0.03); g.fillStyle = '#7b6455'; g.fill(); outline(g, 0.012);
  g.beginPath(); g.moveTo(0.32, 0.22); g.lineTo(0.48, 0.22); g.lineTo(0.42, 0.3); g.lineTo(0.38, 0.3); g.closePath();
  g.fillStyle = '#f1efe9'; g.fill(); outline(g, 0.012);
  rr(g, 0.33, 0.3, 0.14, 0.13, 0.03); g.fillStyle = 'rgba(200,220,230,0.8)'; g.fill(); outline(g, 0.012);
  rr(g, 0.52, 0.28, 0.13, 0.15, 0.03); g.fillStyle = '#c8ccd0'; g.fill(); outline(g, 0.012);
  return c;
}

export function cup() {
  const { c, g } = canvas(0.2, 0.14);
  ell(g, 0.1, 0.125, 0.09, 0.015); g.fillStyle = '#e8e2d6'; g.fill(); outline(g, 0.008);
  rr(g, 0.045, 0.03, 0.11, 0.09, 0.025); g.fillStyle = '#f6f2ea'; g.fill(); outline(g, 0.008);
  ell(g, 0.1, 0.035, 0.055, 0.012); g.fillStyle = '#5b3420'; g.fill();
  g.beginPath(); g.arc(0.165, 0.07, 0.022, -1.4, 1.4); outline(g, 0.01);
  return c;
}

export function puff() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export function blob() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(40,25,15,0.45)');
  grd.addColorStop(1, 'rgba(40,25,15,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

// 溫度上升時溫度計後面的暖光（白色徑向漸層，顏色由材質決定）
export function glow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/* ---------- 開場與信 ---------- */

// 老先生的信封（德叔從吧台抽屜拿出來，放在吧台上）
export function envelope() {
  const { c, g } = canvas(0.26, 0.18);
  rr(g, 0.01, 0.01, 0.24, 0.16, 0.012); g.fillStyle = '#f3e7cf'; g.fill(); outline(g, 0.01);
  g.beginPath(); g.moveTo(0.015, 0.02); g.lineTo(0.13, 0.1); g.lineTo(0.245, 0.02);
  g.strokeStyle = '#b8a07a'; g.lineWidth = 0.008; g.stroke();
  g.fillStyle = '#b5452f'; ell(g, 0.13, 0.1, 0.018, 0.018); g.fill(); // 封蠟
  return c;
}

// 第二幕：租屋處樓下的信箱，一格露出牛皮紙信封
export function mailboxes() {
  const W = 3.9, H = 3;
  const { c, g } = canvas(W, H);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#3a3f4a'); bg.addColorStop(1, '#262a31');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 樓梯間的日光燈
  g.fillStyle = 'rgba(235,240,230,.9)'; rr(g, W / 2 - 0.6, 0.12, 1.2, 0.08, 0.04); g.fill();
  const light = g.createRadialGradient(W / 2, 0.2, 0.1, W / 2, 0.6, 2.4);
  light.addColorStop(0, 'rgba(220,230,215,.28)'); light.addColorStop(1, 'rgba(220,230,215,0)');
  g.fillStyle = light; g.fillRect(0, 0, W, H);
  // 一整排鐵信箱
  const cols = 4, rows = 3, bw = 0.78, bh = 0.52, x0 = (W - cols * bw) / 2, y0 = 0.62;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = x0 + i * bw, y = y0 + j * bh;
    rr(g, x + 0.03, y + 0.03, bw - 0.06, bh - 0.06, 0.03); g.fillStyle = '#9aa3a8'; g.fill(); outline(g, 0.016);
    g.fillStyle = '#4b5257'; g.fillRect(x + 0.15, y + 0.12, bw - 0.3, 0.035);
    g.fillStyle = '#e9e5da'; g.fillRect(x + 0.2, y + 0.25, 0.22, 0.09);
    g.fillStyle = '#6a7378'; ell(g, x + bw - 0.15, y + bh - 0.14, 0.025, 0.025); g.fill();
  }
  // 自己那一格（第二排第三格）露出牛皮紙信封
  const mx = x0 + 2 * bw, my = y0 + bh;
  g.save(); g.translate(mx + 0.17, my + 0.06); g.rotate(-0.12);
  rr(g, 0, 0, 0.44, 0.3, 0.02); g.fillStyle = '#c7955a'; g.fill(); outline(g, 0.014);
  g.beginPath(); g.moveTo(0, 0.02); g.lineTo(0.22, 0.14); g.lineTo(0.44, 0.02); g.strokeStyle = '#8c6236'; g.lineWidth = 0.012; g.stroke();
  g.restore();
  // 地板
  g.fillStyle = '#1d2026'; g.fillRect(0, y0 + rows * bh + 0.1, W, H);
  return c;
}

// 第三幕：傍晚的 175 縣道，兩旁是龍眼樹，三合院正廳的窗亮著一盞燈，台階上睡著一隻橘貓
export function countyRoad() {
  // 直立的畫面：上面多留天空，下面多留路（手機直立時用 cover 填滿，左右只會切掉一點）
  const W = 3.9, TOPPAD = 1.5, H = 4.2 + TOPPAD + 1.0;
  const { c, g } = canvas(W, H);
  const sky = g.createLinearGradient(0, 0, 0, TOPPAD + 2.2);
  sky.addColorStop(0, '#3c4170'); sky.addColorStop(0.5, '#a9778a'); sky.addColorStop(0.8, '#e09a7a'); sky.addColorStop(1, '#f4c98e');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const rs = rng(5);
  g.fillStyle = 'rgba(255,248,220,.8)';
  for (let i = 0; i < 18; i++) g.fillRect(rs() * W, rs() * TOPPAD * 0.8, 0.012, 0.012); // 第一顆星
  ell(g, 0.9, 0.75, 0.09, 0.09); g.fillStyle = 'rgba(251,240,200,.85)'; g.fill(); // 月亮
  g.translate(0, TOPPAD);
  // 遠山兩層
  for (const [base, amp, col, k] of [[1.35, 0.22, '#8a7c97', 2.1], [1.62, 0.16, '#6f6a7f', 3.3]]) {
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 0.01; x += 0.1) g.lineTo(x, base - Math.sin(x * k) * amp - Math.sin(x * 7.3) * 0.04);
    g.lineTo(W, H); g.closePath(); g.fillStyle = col; g.fill();
  }
  // 地面
  g.fillStyle = '#5d6b48'; g.fillRect(0, 2.05, W, H);
  // 三合院：正廳與左右護龍，紅磚、燕尾屋脊
  rr(g, 0.95, 1.95, 2.0, 0.85, 0.02); g.fillStyle = '#b4553b'; g.fill(); outline(g, 0.02); // 正廳
  g.fillStyle = '#9c4630';
  for (let j = 0; j < 8; j++) for (let x = 0.98 + (j % 2) * 0.08; x < 2.85; x += 0.16) g.fillRect(x, 2.05 + j * 0.1, 0.13, 0.012);
  g.beginPath(); g.moveTo(0.82, 1.98); g.quadraticCurveTo(1.95, 1.84, 3.08, 1.98); g.lineTo(3.16, 1.86); g.lineTo(3.02, 1.92);
  g.quadraticCurveTo(1.95, 1.62, 0.88, 1.92); g.lineTo(0.74, 1.86); g.closePath();
  g.fillStyle = '#5a3a2e'; g.fill(); outline(g, 0.02);
  for (const x of [0.15, 3.0]) { // 護龍
    rr(g, x, 2.3, 0.75, 0.6, 0.02); g.fillStyle = '#a24c34'; g.fill(); outline(g, 0.02);
    g.beginPath(); g.moveTo(x - 0.06, 2.32); g.lineTo(x + 0.375, 2.18); g.lineTo(x + 0.81, 2.32); g.closePath(); g.fillStyle = '#4e342a'; g.fill(); outline(g, 0.016);
  }
  // 亮著的窗：暖光
  const glow = g.createRadialGradient(1.45, 2.32, 0.02, 1.45, 2.32, 0.7);
  glow.addColorStop(0, 'rgba(255,214,140,.75)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
  g.fillStyle = glow; g.fillRect(0.7, 1.7, 1.5, 1.3);
  rr(g, 1.25, 2.16, 0.4, 0.32, 0.02); g.fillStyle = '#ffd68a'; g.fill(); outline(g, 0.018);
  g.strokeStyle = '#5a3a2e'; g.lineWidth = 0.02;
  g.beginPath(); g.moveTo(1.45, 2.16); g.lineTo(1.45, 2.48); g.moveTo(1.25, 2.32); g.lineTo(1.65, 2.32); g.stroke();
  // 門（關著）與台階
  rr(g, 2.05, 2.15, 0.48, 0.65, 0.02); g.fillStyle = '#6d4430'; g.fill(); outline(g, 0.018);
  g.fillStyle = '#d9c09a'; g.fillRect(2.27, 2.15, 0.03, 0.65);
  g.fillStyle = '#9b8f80'; g.fillRect(1.85, 2.8, 0.9, 0.08); g.fillRect(1.78, 2.88, 1.04, 0.08);
  // 台階上睡著的橘貓
  g.drawImage(cat('sleep'), 1.95, 2.66, 0.3, 0.225);
  // 路：從畫面下方彎進來
  const B = H - TOPPAD;
  g.beginPath(); g.moveTo(0.1, B); g.quadraticCurveTo(1.6, 3.4, 1.9, 2.98); g.lineTo(2.7, 2.98); g.quadraticCurveTo(2.6, 3.5, 3.9, B); g.closePath();
  g.fillStyle = '#6c6a66'; g.fill();
  g.strokeStyle = '#efe4c6'; g.lineWidth = 0.025; g.setLineDash([0.12, 0.12]);
  g.beginPath(); g.moveTo(2.0, B); g.quadraticCurveTo(2.1, 3.5, 2.3, 2.98); g.stroke(); g.setLineDash([]);
  // 兩旁的龍眼樹
  const r = rng(11);
  for (const [x, y, s] of [[0.35, 2.75, 0.5], [0.5, 3.35, 0.65], [0.15, 4.1, 0.8], [0.3, 4.9, 0.8], [3.55, 2.7, 0.5], [3.4, 3.3, 0.65], [3.75, 4.1, 0.85], [3.6, 4.9, 0.8]]) {
    g.fillStyle = '#4a3528'; g.fillRect(x - 0.04, y, 0.08, s * 0.7);
    for (let k = 0; k < 6; k++) { ell(g, x + (r() - 0.5) * s, y - r() * s * 0.5, s * (0.35 + r() * 0.2), s * (0.28 + r() * 0.15)); g.fillStyle = ['#3f5f3a', '#4d6e40', '#35502f'][k % 3]; g.fill(); }
    g.fillStyle = '#c99a4c';
    for (let k = 0; k < 5; k++) { ell(g, x + (r() - 0.5) * s, y - r() * s * 0.4, 0.025, 0.025); g.fill(); } // 一串串龍眼
  }
  // 路牌：175
  g.fillStyle = '#7a7a7a'; g.fillRect(2.98, 2.55, 0.03, 0.55);
  rr(g, 2.84, 2.36, 0.32, 0.24, 0.03); g.fillStyle = '#f2f2ee'; g.fill(); outline(g, 0.014);
  g.fillStyle = '#2f5d8a'; g.font = 'bold 0.12px "PingFang TC","Noto Sans TC",sans-serif'; g.textAlign = 'center'; g.fillText('175', 3.0, 2.52);
  return c;
}

/* ---------- 階段 4：熟客（之後換手繪只改這些同名函式） ---------- */

const SKIN = '#e9c3a0';
function face(g, cx, y, opt = {}) {
  g.strokeStyle = INK; g.lineWidth = 0.013;
  g.fillStyle = INK; ell(g, cx - 0.05, y, 0.012, 0.016); g.fill(); ell(g, cx + 0.05, y, 0.012, 0.016); g.fill();
  if (opt.smile) { g.beginPath(); g.moveTo(cx - 0.035, y + 0.07); g.quadraticCurveTo(cx, y + 0.1, cx + 0.035, y + 0.07); g.stroke(); }
}

// 阿哲：返鄉青農，站著。pose：'stand'（帽子、工作服、沾泥的雨鞋）、'muddy'（颱風夜全身是泥）、'towel'（披著德叔給的毛巾）
export function zhe(pose = 'stand') {
  const W = 0.9, H = 1.75;
  const { c, g } = canvas(W, H);
  const cx = W / 2;
  const muddy = pose !== 'stand';
  // 褲子與雨鞋
  rr(g, cx - 0.16, 1.0, 0.14, 0.58, 0.04); g.fillStyle = '#41506a'; g.fill(); outline(g);
  rr(g, cx + 0.02, 1.0, 0.14, 0.58, 0.04); g.fill(); outline(g);
  rr(g, cx - 0.18, 1.5, 0.17, 0.23, 0.04); g.fillStyle = '#2f3b33'; g.fill(); outline(g);
  rr(g, cx + 0.01, 1.5, 0.17, 0.23, 0.04); g.fill(); outline(g);
  g.fillStyle = '#7a5532'; // 鞋子上總是泥
  for (const [x, y, r] of [[cx - 0.12, 1.66, 0.04], [cx + 0.1, 1.69, 0.05], [cx - 0.05, 1.7, 0.03]]) { ell(g, x, y, r, r * 0.7); g.fill(); }
  // 上衣：捲起袖子的工作襯衫
  rr(g, cx - 0.21, 0.46, 0.42, 0.62, 0.1); g.fillStyle = muddy ? '#4f6a45' : '#6b8f5a'; g.fill(); outline(g);
  rr(g, cx - 0.3, 0.5, 0.1, 0.36, 0.05); g.fill(); outline(g);
  rr(g, cx + 0.2, 0.5, 0.1, 0.36, 0.05); g.fill(); outline(g);
  g.fillStyle = SKIN;
  rr(g, cx - 0.29, 0.8, 0.08, 0.14, 0.04); g.fill(); outline(g, 0.012);
  rr(g, cx + 0.21, 0.8, 0.08, 0.14, 0.04); g.fill(); outline(g, 0.012);
  // 頭
  ell(g, cx, 0.3, 0.14, 0.16); g.fillStyle = SKIN; g.fill(); outline(g);
  if (pose === 'stand') {
    g.beginPath(); g.ellipse(cx, 0.2, 0.15, 0.09, 0, Math.PI, Math.PI * 2); g.fillStyle = '#c9a34a'; g.fill(); outline(g); // 帽子
    rr(g, cx - 0.02, 0.17, 0.2, 0.045, 0.02); g.fill(); outline(g, 0.012);
    face(g, cx, 0.31, { smile: true });
  } else {
    // 濕透的頭髮貼在額頭上
    g.beginPath(); g.ellipse(cx, 0.24, 0.155, 0.1, 0, Math.PI, Math.PI * 2); g.fillStyle = '#1e1a18'; g.fill();
    for (const x of [-0.08, -0.02, 0.05]) { rr(g, cx + x, 0.22, 0.035, 0.08, 0.015); g.fill(); }
    face(g, cx, 0.33);
    g.fillStyle = 'rgba(110,75,40,.85)'; // 泥
    const r = rng(41);
    for (let k = 0; k < 14; k++) { ell(g, cx - 0.2 + r() * 0.4, 0.5 + r() * 1.1, 0.02 + r() * 0.03, 0.015 + r() * 0.02); g.fill(); }
    ell(g, cx + 0.07, 0.4, 0.03, 0.015); g.fill();
    g.fillStyle = 'rgba(190,215,235,.7)'; // 雨水
    for (let k = 0; k < 6; k++) { ell(g, cx - 0.25 + r() * 0.5, 0.3 + r() * 0.5, 0.008, 0.016); g.fill(); }
  }
  if (pose === 'towel') {
    g.beginPath(); g.moveTo(cx - 0.2, 0.18); g.quadraticCurveTo(cx, 0.05, cx + 0.2, 0.18); g.lineTo(cx + 0.22, 0.75); g.lineTo(cx + 0.12, 0.75);
    g.lineTo(cx + 0.1, 0.42); g.quadraticCurveTo(cx, 0.48, cx - 0.1, 0.42); g.lineTo(cx - 0.12, 0.75); g.lineTo(cx - 0.22, 0.75); g.closePath();
    g.fillStyle = '#f4efe2'; g.fill(); outline(g, 0.014);
    g.strokeStyle = '#c9b48d'; g.lineWidth = 0.01;
    g.beginPath(); g.moveTo(cx - 0.21, 0.68); g.lineTo(cx - 0.13, 0.68); g.moveTo(cx + 0.13, 0.68); g.lineTo(cx + 0.21, 0.68); g.stroke();
  }
  return c;
}

// 凱文：遠距工作的工程師。pose：'walk'（背著電腦包走進來）、'sit'（坐著開筆電、戴耳機）、
// 'closed'（被罵之後把筆電闔上）、'hide'（躲到角落，抱著膝蓋）、'free'（沒帶筆電，捧著一杯熱的）
export function kevin(pose = 'sit') {
  const standing = pose === 'walk';
  const W = 0.8, H = standing ? 1.78 : 1.4;
  const { c, g } = canvas(W, H);
  const cx = W / 2;
  const shirt = '#d7dde6';
  if (standing) {
    rr(g, cx - 0.15, 1.0, 0.13, 0.74, 0.04); g.fillStyle = '#343a46'; g.fill(); outline(g);
    rr(g, cx + 0.02, 1.0, 0.13, 0.74, 0.04); g.fill(); outline(g);
    rr(g, cx - 0.26, 0.55, 0.12, 0.38, 0.04); g.fillStyle = '#3f4a5c'; g.fill(); outline(g); // 電腦包
    rr(g, cx - 0.19, 0.48, 0.38, 0.6, 0.1); g.fillStyle = shirt; g.fill(); outline(g);
    rr(g, cx + 0.17, 0.52, 0.09, 0.42, 0.04); g.fill(); outline(g);
    ell(g, cx + 0.215, 0.97, 0.04, 0.04); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
    g.strokeStyle = '#3f4a5c'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(cx - 0.12, 0.5); g.lineTo(cx + 0.1, 1.0); g.stroke();
  } else {
    // 坐在高腳椅上
    g.fillStyle = '#4a4744';
    rr(g, cx - 0.16, 1.05, 0.035, 0.34, 0.01); g.fill(); rr(g, cx + 0.125, 1.05, 0.035, 0.34, 0.01); g.fill();
    ell(g, cx, 1.05, 0.2, 0.05); g.fillStyle = '#a06b46'; g.fill(); outline(g);
    const hide = pose === 'hide';
    rr(g, cx - 0.18, hide ? 0.58 : 0.5, 0.36, 0.5, 0.1); g.fillStyle = shirt; g.fill(); outline(g);
    rr(g, cx - 0.19, 0.92, 0.38, 0.13, 0.05); g.fillStyle = '#343a46'; g.fill(); outline(g);
    rr(g, cx - 0.15, 1.0, 0.11, 0.3, 0.04); g.fill(); outline(g);
    rr(g, cx + 0.04, 1.0, 0.11, 0.3, 0.04); g.fill(); outline(g);
    if (hide) { rr(g, cx - 0.17, 0.72, 0.34, 0.26, 0.1); g.fillStyle = '#343a46'; g.fill(); outline(g); } // 膝蓋抱起來
  }
  // 頭
  const hy = standing ? 0.3 : pose === 'hide' ? 0.42 : 0.33;
  ell(g, cx, hy, 0.13, 0.15); g.fillStyle = SKIN; g.fill(); outline(g);
  g.beginPath(); g.ellipse(cx, hy - 0.06, 0.145, 0.1, 0, Math.PI, Math.PI * 2); g.fillStyle = '#26221f'; g.fill();
  rr(g, cx - 0.06, hy - 0.08, 0.17, 0.05, 0.02); g.fill();
  // 眼鏡
  g.strokeStyle = INK; g.lineWidth = 0.01;
  g.beginPath(); g.roundRect(cx - 0.09, hy - 0.005, 0.07, 0.045, 0.01); g.roundRect(cx + 0.02, hy - 0.005, 0.07, 0.045, 0.01); g.stroke();
  g.beginPath(); g.moveTo(cx - 0.02, hy + 0.015); g.lineTo(cx + 0.02, hy + 0.015); g.stroke();
  const down = pose === 'closed' || pose === 'hide';
  g.beginPath();
  if (down) { g.moveTo(cx - 0.03, hy + 0.09); g.quadraticCurveTo(cx, hy + 0.08, cx + 0.03, hy + 0.09); }
  else { g.moveTo(cx - 0.03, hy + 0.08); g.quadraticCurveTo(cx, pose === 'free' ? hy + 0.1 : hy + 0.085, cx + 0.03, hy + 0.08); }
  g.stroke();
  // 耳機：開會時戴著，被罵之後掛在脖子上，沒帶筆電的日子沒有
  if (pose === 'sit') {
    g.beginPath(); g.arc(cx, hy, 0.16, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = '#222'; g.lineWidth = 0.025; g.stroke();
    rr(g, cx - 0.18, hy - 0.03, 0.05, 0.08, 0.02); g.fillStyle = '#222'; g.fill(); rr(g, cx + 0.13, hy - 0.03, 0.05, 0.08, 0.02); g.fill();
  } else if (down) {
    g.beginPath(); g.arc(cx, hy + 0.2, 0.12, Math.PI * 0.1, Math.PI * 0.9); g.strokeStyle = '#222'; g.lineWidth = 0.022; g.stroke();
  }
  if (!standing) {
    if (pose === 'sit' || pose === 'closed') {
      // 筆電（開著發藍光／闔上）
      if (pose === 'sit') {
        g.beginPath(); g.moveTo(cx - 0.17, 0.82); g.lineTo(cx - 0.13, 0.6); g.lineTo(cx + 0.13, 0.6); g.lineTo(cx + 0.17, 0.82); g.closePath();
        g.fillStyle = '#9aa3ad'; g.fill(); outline(g, 0.012);
        g.fillStyle = 'rgba(140,190,255,.55)'; g.beginPath(); g.moveTo(cx - 0.14, 0.8); g.lineTo(cx - 0.11, 0.63); g.lineTo(cx + 0.11, 0.63); g.lineTo(cx + 0.14, 0.8); g.closePath(); g.fill();
      }
      rr(g, cx - 0.2, 0.82, 0.4, 0.05, 0.015); g.fillStyle = '#7f8892'; g.fill(); outline(g, 0.012);
      ell(g, cx - 0.17, 0.83, 0.04, 0.035); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
      ell(g, cx + 0.17, 0.83, 0.04, 0.035); g.fill(); outline(g, 0.01);
    } else if (pose === 'free') {
      // 捧著一杯熱的
      rr(g, cx - 0.06, 0.7, 0.12, 0.11, 0.025); g.fillStyle = '#f4f1ea'; g.fill(); outline(g, 0.012);
      ell(g, cx - 0.1, 0.77, 0.04, 0.035); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
      ell(g, cx + 0.1, 0.77, 0.04, 0.035); g.fill(); outline(g, 0.01);
    }
  }
  return c;
}

// 阿哲的阿公：種了四十年龍眼的老農。pose：'stand'（拄著拐杖走進來）、'sit'（坐在角落的板凳上）
export function grandpa(pose = 'stand') {
  const sit = pose === 'sit';
  const W = 0.8, H = sit ? 1.3 : 1.62;
  const { c, g } = canvas(W, H);
  const cx = W / 2;
  if (sit) {
    rr(g, cx - 0.24, 1.0, 0.48, 0.06, 0.02); g.fillStyle = '#8a5a3b'; g.fill(); outline(g); // 板凳
    g.fillStyle = '#6b452f'; rr(g, cx - 0.2, 1.06, 0.04, 0.23, 0.01); g.fill(); rr(g, cx + 0.16, 1.06, 0.04, 0.23, 0.01); g.fill();
    rr(g, cx - 0.17, 0.48, 0.34, 0.54, 0.1); g.fillStyle = '#e7e1d2'; g.fill(); outline(g);
    rr(g, cx - 0.18, 0.92, 0.36, 0.12, 0.05); g.fillStyle = '#4b4238'; g.fill(); outline(g);
    rr(g, cx - 0.14, 1.0, 0.1, 0.26, 0.04); g.fill(); outline(g); rr(g, cx + 0.04, 1.0, 0.1, 0.26, 0.04); g.fill(); outline(g);
    ell(g, cx - 0.1, 0.86, 0.04, 0.035); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
    ell(g, cx + 0.1, 0.86, 0.04, 0.035); g.fill(); outline(g, 0.01);
  } else {
    rr(g, cx - 0.14, 0.98, 0.12, 0.6, 0.04); g.fillStyle = '#4b4238'; g.fill(); outline(g);
    rr(g, cx + 0.02, 0.98, 0.12, 0.6, 0.04); g.fill(); outline(g);
    rr(g, cx - 0.18, 0.46, 0.36, 0.58, 0.1); g.fillStyle = '#e7e1d2'; g.fill(); outline(g);
    g.strokeStyle = '#7a5532'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(cx + 0.26, 0.82); g.lineTo(cx + 0.3, 1.6); g.stroke(); // 拐杖
    ell(g, cx + 0.25, 0.83, 0.04, 0.04); g.fillStyle = SKIN; g.fill(); outline(g, 0.01);
  }
  const hy = sit ? 0.32 : 0.3;
  ell(g, cx, hy, 0.13, 0.15); g.fillStyle = '#dcb38f'; g.fill(); outline(g);
  // 斗笠
  g.beginPath(); g.moveTo(cx - 0.24, hy - 0.06); g.lineTo(cx, hy - 0.22); g.lineTo(cx + 0.24, hy - 0.06); g.closePath();
  g.fillStyle = '#d8b874'; g.fill(); outline(g, 0.014);
  g.strokeStyle = INK; g.lineWidth = 0.012;
  g.beginPath(); g.moveTo(cx - 0.07, hy + 0.01); g.lineTo(cx - 0.03, hy + 0.01); g.moveTo(cx + 0.03, hy + 0.01); g.lineTo(cx + 0.07, hy + 0.01); g.stroke();
  g.beginPath(); g.moveTo(cx - 0.05, hy + 0.08); g.quadraticCurveTo(cx, hy + 0.1, cx + 0.05, hy + 0.08); g.stroke();
  g.strokeStyle = 'rgba(80,60,40,.4)'; g.beginPath(); g.moveTo(cx - 0.09, hy + 0.05); g.lineTo(cx - 0.06, hy + 0.06); g.moveTo(cx + 0.06, hy + 0.06); g.lineTo(cx + 0.09, hy + 0.05); g.stroke(); // 皺紋
  return c;
}

// 熟客送的擺飾：寫滿字的紙巾（放在小邊桌上，用一塊小石頭壓著）
export function napkin() {
  const { c, g } = canvas(0.5, 0.95);
  sideTable(g, 0.25, 0.4);
  g.save(); g.translate(0.25, 0.3); g.rotate(-0.08);
  rr(g, -0.16, -0.13, 0.32, 0.24, 0.01); g.fillStyle = '#fbfaf5'; g.fill(); outline(g, 0.01);
  g.strokeStyle = 'rgba(40,45,70,.65)'; g.lineWidth = 0.006;
  const r = rng(53);
  for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(-0.14, -0.1 + k * 0.03); g.lineTo(-0.02 + r() * 0.15, -0.1 + k * 0.03); g.stroke(); }
  g.restore();
  ell(g, 0.36, 0.37, 0.05, 0.03); g.fillStyle = '#8f8a80'; g.fill(); outline(g, 0.01);
  return c;
}

// 予安的書：立在小書架上，封面朝外
export function yuanBook() {
  const { c, g } = canvas(0.5, 0.95);
  sideTable(g, 0.25, 0.4);
  rr(g, 0.13, 0.08, 0.24, 0.32, 0.015); g.fillStyle = '#c2683f'; g.fill(); outline(g, 0.012);
  rr(g, 0.17, 0.13, 0.16, 0.05, 0.01); g.fillStyle = '#f3e7cf'; g.fill();
  g.strokeStyle = 'rgba(255,240,210,.85)'; g.lineWidth = 0.012;
  g.beginPath(); g.moveTo(0.22, 0.36); g.quadraticCurveTo(0.3, 0.3, 0.24, 0.25); g.quadraticCurveTo(0.2, 0.21, 0.28, 0.2); g.stroke(); // 封面上的龍眼窯煙
  return c;
}

// 吧台上的那袋龍眼乾（阿哲的阿公送的）
export function longanBag() {
  const { c, g } = canvas(0.22, 0.2);
  g.beginPath(); g.moveTo(0.03, 0.19); g.lineTo(0.05, 0.05); g.lineTo(0.17, 0.05); g.lineTo(0.19, 0.19); g.closePath();
  g.fillStyle = '#d8b874'; g.fill(); outline(g, 0.01);
  g.beginPath(); g.moveTo(0.05, 0.05); g.lineTo(0.08, 0.02); g.lineTo(0.14, 0.02); g.lineTo(0.17, 0.05); g.fillStyle = '#c9a35e'; g.fill(); outline(g, 0.008);
  g.fillStyle = '#c4382c'; g.fillRect(0.07, 0.1, 0.08, 0.05);
  return c;
}

// 雨絲（貼在窗戶前面，往下捲動）
export function rain(heavy) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const r = rng(heavy ? 71 : 73);
  g.strokeStyle = heavy ? 'rgba(220,230,240,0.55)' : 'rgba(235,240,245,0.45)';
  g.lineWidth = 1.2;
  for (let i = 0; i < (heavy ? 90 : 40); i++) {
    const x = r() * 128, y = r() * 256, l = heavy ? 22 : 14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - (heavy ? 7 : 1.5), y + l); g.stroke();
  }
  return c;
}

// 音符（德叔把音樂調小時，音符縮小、淡掉）
export function note() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#3b2a20';
  g.font = 'bold 46px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♪', 32, 34);
  return c;
}

export const SIZES = { PPM };
