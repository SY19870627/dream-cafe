// 粗稿：程式畫的紙片形狀（夢想場景、公司、帶回物、老太太的剪影）。
// 驗證版用，不是正式美術；每個形狀畫在 (0,0)-(w,h) 的框裡，底邊對齊 h。
// ASPECT：寬 / 高，給 pano 算寬度。

export const ASPECT = {
  tv: 1.2, futon: 2.6, window: 0.8, box: 1, heater: 1.4, mug: 1, bowl: 2, cat: 1.3, book: 1.5, cup: 1.1,
  shelf: 0.8, lamp: 0.45, grinder: 0.7, kettle: 1.3, plant: 0.6, door: 0.5, granny: 0.5, grannySit: 0.75, colleague: 0.6,
  basin: 2.2, remote: 2.4, gloves: 1.1, thermos: 0.45, ball: 1, leash: 0.45, stool: 1.2, dog: 1.5, ticket: 1.8, glass: 0.6,
  blinds: 0.85, sack: 0.8, scale: 1, jar: 1.6, brassDoor: 0.5, beanbag: 0.75, bench: 3, booth: 2.2, tabletop: 3, storefront: 1.6,
  counter: 3.2, plank: 2.4, hands: 1.3,
};

function paper(g, path, fill) {
  g.save();
  g.shadowColor = 'rgba(0,0,0,.25)';
  g.shadowOffsetY = 3;
  g.shadowBlur = 6;
  g.beginPath();
  path();
  g.fillStyle = fill;
  g.fill();
  g.restore();
  g.beginPath();
  path();
  g.lineWidth = 2.5;
  g.strokeStyle = 'rgba(255,250,240,.85)'; // 紙片的白邊
  g.stroke();
}
const rr = (g, x, y, w, h, r) => { g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };

// t：秒（動態用，例如雨、電視閃）；opt.weather：window 的窗外（rain／snow／sun／street）
export function drawShape(g, shape, w, h, t = 0, opt = {}) {
  switch (shape) {
    case 'tv': {
      paper(g, () => rr(g, 0, h * 0.05, w, h * 0.8, 8), '#5b5148');
      const flick = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1);
      g.fillStyle = `rgba(150,190,220,${flick})`;
      g.fillRect(w * 0.1, h * 0.14, w * 0.62, h * 0.6);
      g.fillStyle = '#3a332d';
      g.fillRect(w * 0.78, h * 0.2, w * 0.12, h * 0.08);
      g.fillRect(w * 0.78, h * 0.4, w * 0.12, h * 0.08);
      g.fillRect(w * 0.2, h * 0.85, w * 0.08, h * 0.15);
      g.fillRect(w * 0.72, h * 0.85, w * 0.08, h * 0.15);
      break;
    }
    case 'futon': {
      paper(g, () => rr(g, 0, h * 0.35, w, h * 0.65, 18), '#e9e1d2');
      g.fillStyle = '#c9a98a';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.45, w * 0.45, h * 0.18, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f5efe4';
      rr(g, w * 0.05, h * 0.2, w * 0.25, h * 0.3, 10);
      g.fill();
      break;
    }
    case 'window': {
      paper(g, () => g.rect(0, 0, w, h), '#6b5a48');
      const sky = { rain: '#7d8a99', snow: '#dfe7ee', sun: '#f6e7b8', street: '#c9d6db', fog: '#d6dde2' }[opt.weather] || '#a9c1d4';
      g.fillStyle = sky;
      g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.86);
      if (opt.weather === 'rain') {
        g.strokeStyle = 'rgba(230,240,250,.6)';
        g.lineWidth = 1.5;
        for (let i = 0; i < 14; i++) {
          const x = w * 0.1 + ((i * 37) % 100) / 100 * w * 0.8;
          const y = h * 0.08 + ((t * 300 + i * 53) % (h * 0.8));
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - 2, y + 10);
          g.stroke();
        }
      } else if (opt.weather === 'snow') {
        g.fillStyle = '#fff';
        for (let i = 0; i < 12; i++) {
          const x = w * 0.12 + ((i * 41) % 100) / 100 * w * 0.76 + Math.sin(t + i) * 3;
          const y = h * 0.08 + ((t * 25 + i * 31) % (h * 0.8));
          g.fillRect(x, y, 3, 3);
        }
        g.fillStyle = '#8fa2b3';
        g.beginPath();
        g.moveTo(w * 0.08, h * 0.7);
        g.lineTo(w * 0.4, h * 0.45);
        g.lineTo(w * 0.92, h * 0.65);
        g.lineTo(w * 0.92, h * 0.92);
        g.lineTo(w * 0.08, h * 0.92);
        g.fill();
      }
      if (opt.weather === 'fog') {
        g.strokeStyle = 'rgba(110,125,135,.7)'; // 外面的山只剩一條線
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(w * 0.08, h * 0.55); g.quadraticCurveTo(w * 0.4, h * 0.4, w * 0.92, h * 0.5); g.stroke();
        g.fillStyle = 'rgba(240,244,246,.45)';
        g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.86);
      }
      g.fillStyle = '#6b5a48';
      g.fillRect(w * 0.48, h * 0.06, w * 0.04, h * 0.86);
      g.fillRect(w * 0.08, h * 0.47, w * 0.84, h * 0.04);
      break;
    }
    case 'heater': {
      paper(g, () => rr(g, 0, h * 0.1, w, h * 0.9, 10), '#b9b2a3');
      g.fillStyle = '#4d463d';
      for (let i = 0; i < 5; i++) g.fillRect(w * 0.12, h * (0.25 + i * 0.1), w * 0.76, h * 0.04);
      g.fillStyle = `rgba(255,140,60,${0.45 + 0.2 * Math.sin(t * 2)})`;
      g.fillRect(w * 0.12, h * 0.78, w * 0.76, h * 0.06);
      g.strokeStyle = 'rgba(255,200,150,.35)';
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const y = h * 0.08 - k * 6;
          const x = w * (0.3 + i * 0.2) + Math.sin(t * 3 + k + i) * 4;
          k ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
      break;
    }
    case 'mug':
    case 'cup': {
      paper(g, () => { g.moveTo(w * 0.1, h * 0.2); g.lineTo(w * 0.75, h * 0.2); g.lineTo(w * 0.7, h); g.lineTo(w * 0.15, h); g.closePath(); }, shape === 'mug' ? '#c76b4a' : '#f2ece2');
      g.strokeStyle = shape === 'mug' ? '#c76b4a' : '#f2ece2';
      g.lineWidth = Math.max(3, w * 0.06);
      g.beginPath();
      g.arc(w * 0.8, h * 0.55, h * 0.18, -1.3, 1.3);
      g.stroke();
      g.fillStyle = '#5b3520';
      g.fillRect(w * 0.14, h * 0.22, w * 0.58, h * 0.06);
      break;
    }
    case 'bowl': {
      paper(g, () => { g.moveTo(0, h * 0.35); g.quadraticCurveTo(w * 0.5, h * 1.3, w, h * 0.35); g.closePath(); }, opt.steel ? '#b8bec4' : '#d97a5a');
      g.fillStyle = '#8b5a33';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.36, w * 0.42, h * 0.1, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'cat': {
      paper(g, () => {
        g.ellipse(w * 0.55, h * 0.7, w * 0.4, h * 0.3, 0, 0, Math.PI * 2);
        g.moveTo(w * 0.32, h * 0.45);
        g.arc(w * 0.25, h * 0.45, w * 0.18, 0, Math.PI * 2);
      }, '#e8a24a');
      g.fillStyle = '#e8a24a';
      g.beginPath();
      g.moveTo(w * 0.1, h * 0.35); g.lineTo(w * 0.14, h * 0.15); g.lineTo(w * 0.22, h * 0.3);
      g.moveTo(w * 0.28, h * 0.3); g.lineTo(w * 0.36, h * 0.15); g.lineTo(w * 0.4, h * 0.35);
      g.fill();
      const lick = Math.sin(t * 4) > 0.6;
      g.strokeStyle = '#7a4a1e';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(w * 0.18, h * 0.42); g.lineTo(w * 0.22, h * 0.44);
      g.moveTo(w * 0.28, h * 0.44); g.lineTo(w * 0.32, h * 0.42);
      g.stroke();
      if (lick) { g.fillStyle = '#d0546a'; g.fillRect(w * 0.23, h * 0.52, w * 0.04, h * 0.05); }
      break;
    }
    case 'book': {
      paper(g, () => { g.moveTo(0, h * 0.4); g.lineTo(w * 0.5, h * 0.55); g.lineTo(w, h * 0.4); g.lineTo(w, h); g.lineTo(w * 0.5, h); g.lineTo(0, h); g.closePath(); }, '#f4ede0');
      g.strokeStyle = 'rgba(80,60,40,.35)';
      g.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(w * 0.08, h * (0.55 + i * 0.1)); g.lineTo(w * 0.42, h * (0.65 + i * 0.1)); g.stroke();
        g.beginPath(); g.moveTo(w * 0.58, h * (0.65 + i * 0.1)); g.lineTo(w * 0.92, h * (0.55 + i * 0.1)); g.stroke();
      }
      if (opt.turned) { // 翻過去的那一頁立在中間
        paper(g, () => { g.moveTo(w * 0.5, h * 0.55); g.quadraticCurveTo(w * 0.62, h * 0.1, w * 0.3, h * 0.05); g.lineTo(w * 0.3, h * 0.5); g.closePath(); }, '#fbf6ea');
      }
      break;
    }
    case 'shelf': {
      paper(g, () => g.rect(0, 0, w, h), '#7a5638');
      const cols = ['#b5523b', '#3f6b5a', '#c9a24d', '#4a5a85', '#8a4f6a', '#d8cbb0'];
      for (let r = 0; r < 3; r++) {
        let x = w * 0.08;
        for (let i = 0; x < w * 0.88; i++) {
          const bw = w * (0.06 + ((i * 7 + r * 3) % 4) * 0.015);
          const bh = h * (0.18 + ((i + r) % 3) * 0.03);
          g.fillStyle = cols[(i + r * 2) % cols.length];
          g.fillRect(x, h * (0.3 + r * 0.3) - bh, bw, bh);
          x += bw + 2;
        }
        g.fillStyle = '#5a3e28';
        g.fillRect(0, h * (0.3 + r * 0.3), w, h * 0.03);
      }
      break;
    }
    case 'lamp': {
      g.fillStyle = 'rgba(255,220,150,.18)';
      g.beginPath(); g.moveTo(w * 0.5, h * 0.2); g.lineTo(-w, h); g.lineTo(w * 2, h); g.fill();
      paper(g, () => { g.moveTo(w * 0.1, h * 0.3); g.lineTo(w * 0.9, h * 0.3); g.lineTo(w * 0.7, h * 0.05); g.lineTo(w * 0.3, h * 0.05); g.closePath(); }, '#e9c98a');
      g.fillStyle = '#4a3a2a';
      g.fillRect(w * 0.45, h * 0.3, w * 0.1, h * 0.65);
      g.fillRect(w * 0.2, h * 0.95, w * 0.6, h * 0.05);
      break;
    }
    case 'grinder': {
      paper(g, () => { g.rect(w * 0.1, h * 0.45, w * 0.8, h * 0.55); g.moveTo(w * 0.2, h * 0.45); g.lineTo(w * 0.8, h * 0.45); g.lineTo(w * 0.65, h * 0.25); g.lineTo(w * 0.35, h * 0.25); g.closePath(); }, '#8a5a36');
      g.strokeStyle = '#555';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(w * 0.5, h * 0.25); g.lineTo(w * 0.5, h * 0.12); g.lineTo(w * 0.5 + Math.cos(t * 2) * w * 0.35, h * 0.12 + Math.sin(t * 2) * 4); g.stroke();
      g.fillStyle = '#c9a06a';
      g.fillRect(w * 0.35, h * 0.7, w * 0.3, h * 0.12);
      break;
    }
    case 'kettle': {
      paper(g, () => { g.ellipse(w * 0.45, h * 0.62, w * 0.32, h * 0.36, 0, 0, Math.PI * 2); g.moveTo(w * 0.72, h * 0.6); g.lineTo(w * 1, h * 0.25); g.lineTo(w * 0.95, h * 0.22); g.lineTo(w * 0.7, h * 0.5); }, '#c9c2b4');
      g.strokeStyle = 'rgba(255,255,255,.4)';
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k < 8; k++) g.lineTo(w * 0.97 + Math.sin(t * 2 + k) * 3, h * 0.2 - k * 5);
      g.stroke();
      break;
    }
    case 'plant': {
      paper(g, () => { g.moveTo(w * 0.2, h * 0.7); g.lineTo(w * 0.8, h * 0.7); g.lineTo(w * 0.7, h); g.lineTo(w * 0.3, h); g.closePath(); }, '#b8734d');
      g.fillStyle = '#4f7a4a';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.ellipse(w * (0.3 + (i % 3) * 0.2), h * (0.25 + Math.floor(i / 3) * 0.22), w * 0.18, h * 0.1, (i - 2.5) * 0.4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'box': {
      paper(g, () => rr(g, w * 0.1, h * 0.3, w * 0.8, h * 0.7, 6), '#b9a27e');
      g.fillStyle = 'rgba(60,40,20,.25)';
      g.fillRect(w * 0.1, h * 0.5, w * 0.8, h * 0.05);
      break;
    }
    case 'door': {
      // 回店的出口：一扇木門，門上掛著風鈴
      paper(g, () => g.rect(0, 0, w, h), '#7b4f2f');
      g.fillStyle = 'rgba(255,230,180,.55)';
      g.fillRect(w * 0.18, h * 0.1, w * 0.64, h * 0.35);
      g.fillStyle = '#d9b26a';
      g.beginPath(); g.arc(w * 0.8, h * 0.55, w * 0.06, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d9b26a';
      g.lineWidth = 2;
      const sw = Math.sin(t * 2) * 3;
      g.beginPath(); g.moveTo(w * 0.5, 0); g.lineTo(w * 0.5 + sw, h * 0.06); g.stroke();
      g.beginPath(); g.arc(w * 0.5 + sw, h * 0.075, w * 0.06, Math.PI, 0); g.fill();
      break;
    }
    case 'granny':
    case 'grannySit': {
      // 老太太：灰色調的剪影，低對比、不可點、不標示
      const sit = shape === 'grannySit';
      g.fillStyle = 'rgba(92,86,82,.82)';
      g.beginPath();
      g.arc(w * 0.5, h * 0.12, w * (sit ? 0.12 : 0.16), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(200,196,190,.55)'; // 白髮
      g.beginPath();
      g.arc(w * 0.5, h * 0.09, w * (sit ? 0.12 : 0.16), Math.PI, 0);
      g.fill();
      g.fillStyle = 'rgba(92,86,82,.82)';
      g.beginPath();
      if (sit) {
        g.moveTo(w * 0.32, h * 0.24); g.lineTo(w * 0.68, h * 0.24); g.lineTo(w * 0.72, h * 0.62);
        g.lineTo(w * 0.98, h * 0.66); g.lineTo(w * 0.96, h); g.lineTo(w * 0.82, h); g.lineTo(w * 0.82, h * 0.78); g.lineTo(w * 0.28, h * 0.74);
      } else {
        g.moveTo(w * 0.3, h * 0.25); g.lineTo(w * 0.7, h * 0.25); g.lineTo(w * 0.82, h * 0.9); g.lineTo(w * 0.62, h); g.lineTo(w * 0.38, h); g.lineTo(w * 0.18, h * 0.9);
      }
      g.closePath();
      g.fill();
      if (sit) { g.fillStyle = 'rgba(70,60,55,.6)'; g.fillRect(w * 0.15, h * 0.72, w * 0.85, h * 0.06); }
      if (opt.cup) { g.fillStyle = 'rgba(230,224,214,.7)'; g.fillRect(w * 0.9, h * 0.6, w * 0.14, h * 0.1); }
      if (opt.umbrella) {
        g.fillStyle = 'rgba(70,72,80,.85)';
        g.beginPath(); g.moveTo(-w * 0.3, h * 0.12); g.quadraticCurveTo(w * 0.5, -h * 0.25, w * 1.3, h * 0.12); g.closePath(); g.fill();
      }
      break;
    }
    case 'colleague': {
      // 公司櫃台的同事（粗稿剪影）；opt.smile：0～1 嘴角
      g.fillStyle = '#3e4a5c';
      g.beginPath(); g.moveTo(w * 0.1, h); g.lineTo(w * 0.2, h * 0.38); g.lineTo(w * 0.8, h * 0.38); g.lineTo(w * 0.9, h); g.fill();
      g.fillStyle = '#e9cfb4';
      g.beginPath(); g.arc(w * 0.5, h * 0.22, w * 0.22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b2420';
      g.beginPath(); g.arc(w * 0.5, h * 0.17, w * 0.23, Math.PI, 0); g.fill();
      g.fillRect(w * 0.42, h * 0.22, w * 0.03, h * 0.02);
      g.fillRect(w * 0.55, h * 0.22, w * 0.03, h * 0.02);
      const s = opt.smile || 0;
      g.strokeStyle = '#7a4a3a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(w * 0.44, h * 0.3);
      g.quadraticCurveTo(w * 0.5, h * (0.3 + 0.03 * s), w * 0.56, h * 0.3);
      g.stroke();
      break;
    }
    case 'basin': {
      paper(g, () => { g.moveTo(0, h * 0.3); g.lineTo(w, h * 0.3); g.lineTo(w * 0.85, h); g.lineTo(w * 0.15, h); g.closePath(); }, '#b8bcc0');
      g.fillStyle = 'rgba(120,150,175,.8)';
      g.beginPath(); g.ellipse(w * 0.5, h * 0.36, w * 0.44, h * 0.12, 0, 0, Math.PI * 2); g.fill();
      const d = (t * 0.7) % 1; // 滴水
      g.fillStyle = 'rgba(200,220,235,.9)';
      g.beginPath(); g.ellipse(w * 0.55, -h * 2 + d * h * 2.3, 2, 3, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'remote': {
      paper(g, () => rr(g, w * 0.05, h * 0.2, w * 0.9, h * 0.8, 4), '#2f2f33');
      g.fillStyle = '#c4382c'; g.fillRect(w * 0.12, h * 0.4, w * 0.08, h * 0.3);
      g.strokeStyle = '#d8b46a'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.6, h * 0.2); g.lineTo(w * 0.6, h); g.stroke(); // 橡皮筋
      break;
    }
    case 'gloves': {
      for (const dx of [0, 0.45]) {
        paper(g, () => { g.moveTo(w * (0.05 + dx), 0); g.lineTo(w * (0.5 + dx), 0); g.lineTo(w * (0.48 + dx), h * 0.75); g.lineTo(w * (0.07 + dx), h * 0.75); g.closePath(); }, dx ? '#8a3a3a' : '#a84a42');
      }
      g.fillStyle = 'rgba(200,220,240,.9)';
      const d = (t * 0.8) % 1;
      g.beginPath(); g.ellipse(w * 0.3, h * (0.8 + d * 0.2), 2, 3, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'thermos': {
      paper(g, () => rr(g, w * 0.2, h * 0.15, w * 0.6, h * 0.85, 8), '#5a7a6a');
      g.fillStyle = '#c9c2b4'; g.fillRect(w * 0.15, 0, w * 0.7, h * 0.18);
      break;
    }
    case 'ball': {
      paper(g, () => g.ellipse(w * 0.5, h * 0.6, w * 0.45, h * 0.4, 0, 0, Math.PI * 2), '#c8d64a');
      g.strokeStyle = '#f4f4e0'; g.lineWidth = 2; g.beginPath(); g.arc(w * 0.2, h * 0.6, w * 0.3, -0.9, 0.9); g.stroke();
      break;
    }
    case 'leash': {
      g.fillStyle = '#6a5a4a'; g.fillRect(w * 0.45, 0, w * 0.1, h * 0.1);
      g.strokeStyle = '#c4382c'; g.lineWidth = Math.max(3, w * 0.08);
      g.beginPath(); g.moveTo(w * 0.5, h * 0.08); g.bezierCurveTo(w * 1.1, h * 0.5, -w * 0.1, h * 0.6, w * 0.5, h * 0.95); g.stroke();
      g.fillStyle = '#222'; g.fillRect(w * 0.38, h * 0.02, w * 0.24, h * 0.1); // 電火布
      break;
    }
    case 'stool': {
      paper(g, () => { rr(g, 0, 0, w, h * 0.22, 4); g.rect(w * 0.1, h * 0.2, w * 0.12, h * 0.8); g.rect(w * 0.78, h * 0.2, w * 0.12, h * 0.8); }, '#d9534a');
      break;
    }
    case 'dog': {
      // 店家養的黑狗，低頭吃飯（不可點）
      const bob = Math.sin(t * 6) * h * 0.03;
      g.fillStyle = '#26221f';
      g.beginPath(); g.ellipse(w * 0.6, h * 0.55, w * 0.32, h * 0.22, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(w * 0.38, h * 0.65, w * 0.07, h * 0.35); g.fillRect(w * 0.78, h * 0.65, w * 0.07, h * 0.35);
      g.beginPath(); g.ellipse(w * 0.22, h * 0.72 + bob, w * 0.16, h * 0.14, 0.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(w * 0.9, h * 0.45); g.quadraticCurveTo(w * 1.02, h * (0.2 + 0.05 * Math.sin(t * 9)), w * 0.98, h * 0.15); g.lineWidth = 4; g.strokeStyle = '#26221f'; g.stroke();
      break;
    }
    case 'ticket': {
      paper(g, () => g.rect(0, h * 0.2, w, h * 0.8), '#e9d9a8');
      g.strokeStyle = 'rgba(120,80,40,.6)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(w * 0.7, h * 0.2); g.lineTo(w * 0.7, h); g.stroke(); g.setLineDash([]);
      break;
    }
    case 'glass': {
      paper(g, () => { g.moveTo(w * 0.15, 0); g.lineTo(w * 0.85, 0); g.lineTo(w * 0.75, h * 0.9); g.lineTo(w * 0.25, h * 0.9); g.closePath(); }, 'rgba(210,225,230,.55)');
      g.fillStyle = 'rgba(90,55,30,.75)'; g.fillRect(w * 0.24, h * 0.3, w * 0.52, h * 0.58);
      g.fillStyle = 'rgba(160,190,210,.6)'; g.beginPath(); g.ellipse(w * 0.5, h * 0.95, w * 0.5, h * 0.06, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'blinds': {
      paper(g, () => g.rect(0, 0, w, h), '#f3e2b8');
      g.fillStyle = '#d9c08a';
      for (let i = 0; i < 12; i++) {
        const tilt = i === 7 ? 0.2 : 0; // 歪的那一片
        g.save(); g.translate(w * 0.04, h * (0.05 + i * 0.08)); g.rotate(tilt); g.fillRect(0, 0, w * 0.92, h * 0.045); g.restore();
      }
      break;
    }
    case 'sack': {
      paper(g, () => { g.moveTo(w * 0.1, h * 0.2); g.lineTo(w * 0.9, h * 0.2); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); }, '#b49a6a');
      g.fillStyle = '#4a2c1a'; g.beginPath(); g.ellipse(w * 0.5, h * 0.22, w * 0.4, h * 0.08, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'scale': {
      paper(g, () => { g.rect(w * 0.15, h * 0.35, w * 0.7, h * 0.65); g.moveTo(0, h * 0.12); g.lineTo(w, h * 0.12); g.lineTo(w * 0.9, h * 0.25); g.lineTo(w * 0.1, h * 0.25); g.closePath(); }, '#8a9a8a');
      g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(w * 0.5, h * 0.65, w * 0.22, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c4382c'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.5, h * 0.65); g.lineTo(w * 0.47, h * 0.47); g.stroke();
      break;
    }
    case 'jar': {
      for (let k = 0; k < 3; k++) {
        const x = w * (0.02 + k * 0.33);
        paper(g, () => rr(g, x, h * 0.15, w * 0.3, h * 0.85, 6), 'rgba(220,230,230,.6)');
        g.fillStyle = '#4a2c1a'; g.fillRect(x + w * 0.03, h * 0.45, w * 0.24, h * 0.52);
        g.fillStyle = '#f4ecd8'; g.fillRect(x + w * 0.05, h * 0.5, w * 0.2, h * 0.18);
      }
      break;
    }
    case 'brassDoor': {
      if (opt.open) { // 推開了：門框裡是外面的晨光，門板轉到一邊變窄
        g.fillStyle = '#f4e3bf';
        g.fillRect(0, 0, w, h);
        paper(g, () => g.rect(0, 0, w * 0.22, h), '#6b4528');
        g.fillStyle = '#d9a84a'; g.beginPath(); g.arc(w * 0.17, h * 0.58, w * 0.05, 0, Math.PI * 2); g.fill();
        break;
      }
      paper(g, () => g.rect(0, 0, w, h), '#6b4528');
      g.fillStyle = 'rgba(255,236,190,.6)'; g.fillRect(w * 0.15, h * 0.08, w * 0.7, h * 0.4);
      g.fillStyle = '#d9a84a'; g.beginPath(); g.arc(w * 0.82, h * 0.58, w * 0.07, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'beanbag': {
      paper(g, () => { g.moveTo(w * 0.15, h * 0.1); g.lineTo(w * 0.85, h * 0.1); g.lineTo(w * 0.9, h); g.lineTo(w * 0.1, h); g.closePath(); }, '#c9a06a');
      g.fillStyle = 'rgba(80,50,30,.4)'; g.fillRect(w * 0.15, h * 0.1, w * 0.7, h * 0.08);
      break;
    }
    case 'hands': {
      // 兩隻手伸在出風口前面（粗稿）
      for (const dx of [0.08, 0.52]) {
        paper(g, () => { rr(g, w * dx, h * 0.25, w * 0.4, h * 0.75, w * 0.12); }, '#e9c7a4');
        g.fillStyle = '#d9b08a';
        for (let k = 0; k < 4; k++) g.fillRect(w * (dx + 0.04 + k * 0.09), h * 0.05, w * 0.06, h * 0.35);
      }
      break;
    }
    case 'bench':
    case 'booth':
      paper(g, () => { g.rect(0, shape === 'booth' ? 0 : h * 0.3, w, shape === 'booth' ? h * 0.5 : h * 0.2); g.rect(w * 0.05, h * 0.5, w * 0.06, h * 0.5); g.rect(w * 0.89, h * 0.5, w * 0.06, h * 0.5); }, shape === 'booth' ? '#7a3a2e' : '#8a6a4a');
      break;
    case 'tabletop':
      g.fillStyle = '#5a3a24';
      g.fillRect(-w, 0, w * 3, h);
      g.fillStyle = 'rgba(255,240,200,.18)'; // 百葉窗的光
      for (let i = 0; i < 6; i++) g.fillRect(-w + i * w * 0.5, 0, w * 0.18, h);
      break;
    case 'storefront': {
      paper(g, () => g.rect(0, 0, w, h), '#b8a888');
      g.fillStyle = '#5a6a5a'; g.fillRect(w * 0.05, h * 0.25, w * 0.9, h * 0.75);
      const cols = ['#c4382c', '#d9a84a', '#3f6b5a', '#4a5a85'];
      for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 4]; g.fillRect(w * (0.1 + (i % 8) * 0.1), h * (0.35 + Math.floor(i / 8) * 0.25), w * 0.07, h * 0.15); }
      g.fillStyle = '#c4382c'; g.fillRect(0, 0, w, h * 0.16);
      break;
    }
    case 'counter':
      paper(g, () => g.rect(0, 0, w, h), '#6b4a30');
      g.fillStyle = '#8a6545'; g.fillRect(0, 0, w, h * 0.12);
      break;
    case 'plank':
      g.fillStyle = '#5a3e28'; g.fillRect(0, h * 0.5, w, h * 0.5);
      break;
    default:
      paper(g, () => rr(g, 0, 0, w, h, 6), '#b9a27e');
  }
}
