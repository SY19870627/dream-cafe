// 機關煮咖啡：canvas 程式生成，全遊戲唯一的動畫。驗證版只做一條路線，玩家不操作、不能跳過。
// 路線：溫杯 → 搖柄帶動齒輪 → 齒輪磨豆 → 熱水走管線滴進濾杯 → 骨牌一排倒下 → 撞到槓桿，方糖掉進杯子。
// ROUTE 與 drawMachine() 都是純函式：給時間 t（秒）就畫出那一刻，重新整理後從經過的秒數接著畫。

export const ROUTE = [
  { id: 'warm', dur: 5 }, // 溫杯（德叔煮咖啡前一定先溫杯）
  { id: 'gears', dur: 9 }, // 搖柄、齒輪
  { id: 'grind', dur: 8 }, // 豆子落下磨碎
  { id: 'pipes', dur: 11 }, // 熱水走管線、滴濾
  { id: 'dominoes', dur: 8 }, // 骨牌
  { id: 'sugar', dur: 5 }, // 方糖落杯、冒煙
];
export const DURATION = ROUTE.reduce((a, s) => a + s.dur, 0);

// 每段開始的秒數
export const START = (() => {
  const o = {};
  let t = 0;
  for (const s of ROUTE) { o[s.id] = t; t += s.dur; }
  return o;
})();

// 某一段的進度 0～1
export function progress(id, t) {
  const seg = ROUTE.find((s) => s.id === id);
  if (!seg) return 0;
  return Math.max(0, Math.min(1, (t - START[id]) / seg.dur));
}

// 骨牌
export const DOMINO_COUNT = 9;
// 聲音事件（秒）：給 view 排程合成音效
export const SOUND_EVENTS = (() => {
  const ev = [{ t: 0.3, name: 'pour' }];
  for (let i = 0; i < 12; i++) ev.push({ t: START.gears + 0.4 + i * 0.7, name: 'tick' });
  ev.push({ t: START.grind + 0.2, name: 'grind' });
  ev.push({ t: START.pipes + 0.2, name: 'water' });
  for (let i = 0; i < DOMINO_COUNT; i++) ev.push({ t: START.dominoes + 0.6 + i * (6 / DOMINO_COUNT), name: 'domino' });
  ev.push({ t: START.sugar + 1.6, name: 'plop' });
  return ev.sort((a, b) => a.t - b.t);
})();

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const lerp = (a, b, k) => a + (b - a) * k;

// 設計座標 390 × 560，由呼叫端縮放
export const DESIGN = { w: 390, h: 560 };

function gear(g, x, y, r, teeth, rot, fill) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r + 6;
    const a2 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    g.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = 'rgba(40,25,15,.55)';
  g.lineWidth = 2;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  g.fillStyle = '#3b2a20';
  g.fill();
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(r * 0.8, 0);
  g.strokeStyle = 'rgba(255,240,210,.5)';
  g.lineWidth = 3;
  g.stroke();
  g.restore();
}

// 管線的路徑（熱水從左下的鍋爐走到右邊的濾杯）
const PIPE = [[58, 300], [58, 250], [150, 250], [150, 300], [220, 300], [220, 230], [300, 230], [300, 262]];
function pipeLen() {
  let L = 0;
  for (let i = 1; i < PIPE.length; i++) L += Math.hypot(PIPE[i][0] - PIPE[i - 1][0], PIPE[i][1] - PIPE[i - 1][1]);
  return L;
}
function pointOnPipe(k) {
  let d = k * pipeLen();
  for (let i = 1; i < PIPE.length; i++) {
    const [x0, y0] = PIPE[i - 1];
    const [x1, y1] = PIPE[i];
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (d <= L) return [lerp(x0, x1, d / L), lerp(y0, y1, d / L)];
    d -= L;
  }
  return PIPE[PIPE.length - 1];
}

// 畫第 t 秒的機關（g 已經縮放到設計座標）
export function drawMachine(g, t) {
  const { w, h } = DESIGN;
  // 背景：吧台後面的牆與檯面
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#3a2a20');
  bg.addColorStop(0.7, '#4a3427');
  bg.addColorStop(1, '#2a1d16');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#6b4a33';
  g.fillRect(0, 500, w, 60);
  g.fillStyle = '#8a6545';
  g.fillRect(0, 496, w, 6);

  const cup = { x: 300, y: 470 };
  const pWarm = progress('warm', t);
  const pGears = progress('gears', t);
  const pGrind = progress('grind', t);
  const pPipes = progress('pipes', t);
  const pDom = progress('dominoes', t);
  const pSugar = progress('sugar', t);

  // ① 溫杯：水壺從上面倒一點熱水
  {
    const tilt = pWarm > 0 && pWarm < 1 ? Math.sin(pWarm * Math.PI) : 0;
    g.save();
    g.translate(cup.x - 40, 360);
    g.rotate(-0.1 - tilt * 0.6);
    g.fillStyle = '#c9c2b4';
    g.beginPath();
    g.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(16, -6, 26, 6); // 細嘴
    g.restore();
    if (tilt > 0.4) {
      g.strokeStyle = 'rgba(220,235,245,.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cup.x - 6, 372);
      g.lineTo(cup.x - 2, cup.y - 18);
      g.stroke();
    }
  }

  // ② 齒輪：左上搖柄帶動三個齒輪（之後一直慢慢轉，帶動磨豆）
  const spin = ease(pGears) * Math.PI * 6 + pGrind * Math.PI * 8;
  {
    // 搖柄
    g.save();
    g.translate(70, 120);
    g.rotate(spin);
    g.strokeStyle = '#9a7b55';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -48);
    g.stroke();
    g.fillStyle = '#c4382c';
    g.beginPath();
    g.arc(0, -48, 7, 0, Math.PI * 2);
    g.fill();
    g.restore();
    gear(g, 70, 120, 34, 12, spin, '#b08a4f');
    gear(g, 140, 104, 24, 8, -spin * (34 / 24) + 0.2, '#c79d5a');
    gear(g, 196, 128, 18, 6, spin * (34 / 18), '#a8834a');
    // 皮帶連到磨豆機
    g.strokeStyle = 'rgba(30,20,12,.7)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(196, 110);
    g.lineTo(290, 140);
    g.moveTo(196, 146);
    g.lineTo(290, 170);
    g.stroke();
  }

  // ③ 磨豆：上方漏斗裡的豆子一顆顆掉進磨盤，粉落進濾杯
  {
    g.fillStyle = '#d9cbb0';
    g.beginPath();
    g.moveTo(262, 60);
    g.lineTo(318, 60);
    g.lineTo(300, 110);
    g.lineTo(280, 110);
    g.closePath();
    g.fill();
    const beansLeft = Math.round((1 - pGrind) * 10);
    g.fillStyle = '#4a2c1a';
    for (let i = 0; i < beansLeft; i++) {
      g.beginPath();
      g.ellipse(272 + (i % 5) * 9, 72 + Math.floor(i / 5) * 9, 4, 3, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    gear(g, 290, 156, 20, 9, spin * 1.7, '#8d8d86');
    if (pGrind > 0 && pGrind < 1) {
      const fall = (t * 3) % 1;
      g.fillStyle = '#4a2c1a';
      g.beginPath();
      g.ellipse(290, lerp(112, 140, fall), 4, 3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(90,55,30,.8)';
      for (let i = 0; i < 6; i++) g.fillRect(286 + Math.sin(t * 9 + i) * 3, 180 + ((t * 80 + i * 13) % 70), 2, 2);
    }
  }

  // 濾杯
  g.fillStyle = '#efe6d6';
  g.beginPath();
  g.moveTo(272, 262);
  g.lineTo(328, 262);
  g.lineTo(306, 300);
  g.lineTo(294, 300);
  g.closePath();
  g.fill();
  if (pGrind > 0) {
    g.fillStyle = '#5a3a24';
    const k = Math.min(1, pGrind);
    g.beginPath();
    g.moveTo(300 - 18 * k, 286 - 14 * k);
    g.lineTo(300 + 18 * k, 286 - 14 * k);
    g.lineTo(304, 296);
    g.lineTo(296, 296);
    g.closePath();
    g.fill();
  }

  // ④ 管線：鍋爐的熱水沿著管子走到濾杯，一滴一滴落進杯子
  {
    g.fillStyle = '#7c6a5a';
    g.fillRect(34, 300, 48, 60);
    g.fillStyle = '#c4382c';
    g.fillRect(52, 342, 12, 6);
    g.strokeStyle = '#a99a86';
    g.lineWidth = 8;
    g.lineJoin = 'round';
    g.beginPath();
    PIPE.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    if (pPipes > 0) {
      const head = Math.min(1, pPipes * 1.6);
      g.strokeStyle = 'rgba(170,210,235,.95)';
      g.lineWidth = 4;
      g.beginPath();
      const n = 40;
      for (let i = 0; i <= n * head; i++) {
        const [x, y] = pointOnPipe(i / n);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      if (pPipes > 0.62 && pPipes < 1) {
        const d = (t * 2.2) % 1;
        g.fillStyle = '#6b3f22';
        g.beginPath();
        g.ellipse(300, lerp(304, cup.y - 22, d), 3, 4, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 蒸氣
    if (pPipes > 0.1) {
      g.fillStyle = 'rgba(255,255,255,.12)';
      for (let i = 0; i < 3; i++) {
        const y = 290 - ((t * 25 + i * 20) % 50);
        g.beginPath();
        g.arc(58 + Math.sin(t + i) * 6, y - 20, 8, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // ⑤ 骨牌：一排倒下，最後一張撞到槓桿
  const domX = (i) => 40 + i * 22;
  {
    for (let i = 0; i < DOMINO_COUNT; i++) {
      const start = (i / DOMINO_COUNT) * 0.75;
      const k = Math.max(0, Math.min(1, (pDom - start) / 0.12));
      g.save();
      g.translate(domX(i) + 6, 496);
      g.rotate(ease(k) * 1.1);
      g.fillStyle = '#f2eadb';
      g.fillRect(-6, -36, 10, 36);
      g.fillStyle = '#3b2a20';
      g.beginPath();
      g.arc(-1, -26, 2, 0, Math.PI * 2);
      g.arc(-1, -10, 2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  // ⑥ 槓桿與方糖：骨牌撞到槓桿，湯匙翹起，方糖掉進杯子
  {
    const hit = Math.max(0, Math.min(1, (pDom - 0.88) / 0.12));
    const lever = hit > 0 ? -0.35 * ease(hit) : 0;
    g.save();
    g.translate(244, 486);
    g.fillStyle = '#5a4030';
    g.beginPath();
    g.moveTo(-8, 10);
    g.lineTo(8, 10);
    g.lineTo(0, 0);
    g.closePath();
    g.fill();
    g.rotate(lever);
    g.fillStyle = '#c9a06a';
    g.fillRect(-14, -3, 60, 5);
    g.restore();
    // 方糖
    let sx = 284;
    let sy = 470 - 30 * Math.sin(-lever * 2.6);
    if (pSugar > 0) {
      const k = Math.min(1, pSugar / 0.35);
      sx = lerp(284, cup.x, k);
      sy = lerp(440, cup.y - 18, k * k) - Math.sin(k * Math.PI) * 60;
    }
    if (pSugar < 0.35) {
      g.fillStyle = '#fbfaf5';
      g.fillRect(sx - 6, sy - 6, 12, 12);
      g.strokeStyle = 'rgba(0,0,0,.2)';
      g.strokeRect(sx - 6, sy - 6, 12, 12);
    }
  }

  // 杯子（咖啡隨滴濾慢慢變滿）
  {
    const level = Math.min(1, Math.max(0, (pPipes - 0.62) / 0.38)) * 0.85 + (pSugar > 0.35 ? 0.05 : 0);
    g.fillStyle = '#f4efe6';
    g.beginPath();
    g.moveTo(cup.x - 26, cup.y - 24);
    g.lineTo(cup.x + 26, cup.y - 24);
    g.lineTo(cup.x + 20, cup.y + 24);
    g.lineTo(cup.x - 20, cup.y + 24);
    g.closePath();
    g.fill();
    g.strokeStyle = '#f4efe6';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cup.x + 28, cup.y, 10, -1.2, 1.2);
    g.stroke();
    if (level > 0) {
      g.fillStyle = '#5b3520';
      const top = cup.y + 22 - 42 * level;
      g.fillRect(cup.x - 22 + (1 - level) * 2, top, 44 - (1 - level) * 4, cup.y + 22 - top);
    }
    if (pSugar > 0.35 && pSugar < 0.6) {
      const r = (pSugar - 0.35) * 160;
      g.strokeStyle = `rgba(255,240,220,${0.6 - (pSugar - 0.35) * 2})`;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(cup.x, cup.y - 18, r * 0.6, r * 0.2, 0, 0, Math.PI * 2);
      g.stroke();
    }
    if (pSugar > 0.4) {
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        for (let k = 0; k < 12; k++) {
          const yy = cup.y - 30 - k * 6;
          const xx = cup.x - 12 + i * 12 + Math.sin(t * 2 + k * 0.6 + i) * 4;
          k ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
        }
        g.stroke();
      }
    }
  }
}
