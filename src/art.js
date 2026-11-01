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

export function windowView(night) {
  const { c, g } = canvas(1.6, 1.3);
  const sky = g.createLinearGradient(0, 0, 0, 1.3);
  if (night) {
    sky.addColorStop(0, '#0f1a33');
    sky.addColorStop(1, '#2a3555');
  } else {
    sky.addColorStop(0, '#9fd0f0');
    sky.addColorStop(1, '#f6e7c6');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 1.6, 1.3);
  const r = rng(3);
  if (night) {
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
  g.fillStyle = night ? '#1b2440' : '#8fb38a';
  g.fill();
  // 近處龍眼樹
  g.fillStyle = night ? '#121a2c' : '#4f7d4a';
  for (const [x, y, s] of [[0.2, 0.95, 0.28], [0.55, 1.05, 0.22], [1.3, 1.0, 0.3]]) {
    ell(g, x, y, s, s * 0.8); g.fill();
  }
  // 窗框
  g.strokeStyle = '#4a3122';
  g.lineWidth = 0.07;
  g.strokeRect(0.035, 0.035, 1.53, 1.23);
  g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(0.8, 0); g.lineTo(0.8, 1.3); g.moveTo(0, 0.65); g.lineTo(1.6, 0.65); g.stroke();
  return c;
}

export function backBar(wm, hm) {
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
  g.fillText('東山 日曬', wm / 2, 1.44);
  g.fillText('阿里山 水洗', wm / 2, 1.56);
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
  rr(g, cx - 0.31, 0.52, 0.11, 0.42, 0.05); g.fill(); outline(g);
  if (pose === 'pour') {
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
  ell(g, cx - 0.255, 0.96, 0.05, 0.05); g.fill(); outline(g, 0.012);
  if (pose !== 'pour') { ell(g, cx + 0.255, 0.96, 0.05, 0.05); g.fill(); outline(g, 0.012); }
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

export function yuan() {
  // 予安：坐著看筆電的作家
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

export const SIZES = { PPM };
