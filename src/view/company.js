// 送咖啡回公司（第 3 天，只一次）：騎車 10 秒 → 櫃台對話（點下一句）→ 杯套上的「王」→ 主角離開不看反應 → 同事慢半拍的笑。
// 畫面全是粗稿（canvas）。對話字在 src/lines/company.js，逐字照規格書。
// 公司場景的角落也有老太太（不可點、不標示）：大廳沙發，距離比照第 3 天。
import { COMPANY_TALK, SLEEVE } from '../lines/company.js';
import { drawShape } from './draft.js';
import { play, setAmbient } from './audio.js';

export const RIDE_MS = 10000;

// 在 fx canvas 上跑一段動畫；ms 為 null 時一直跑到 stop()
export function animate(canvas, draw, ms) {
  const g = canvas.getContext('2d');
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width;
  const H = r.height;
  const t0 = performance.now();
  let stopped = false;
  let done;
  const p = new Promise((res) => { done = res; });
  const loop = () => {
    if (stopped) return;
    const t = (performance.now() - t0) / 1000;
    draw(g, W, H, t);
    if (ms != null && t * 1000 >= ms) { stopped = true; done(); return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  p.stop = () => { stopped = true; done(); };
  return p;
}

// ① 騎車：每次都是同一段路
export function drawRide(g, W, H, t) {
  const sky = g.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#9cc3dd');
  sky.addColorStop(1, '#f2e6c9');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const layer = (speed, base, amp, col, k) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) g.lineTo(x, base - Math.sin((x + t * speed) * k) * amp - Math.sin((x + t * speed) * k * 2.7) * amp * 0.3);
    g.lineTo(W, H);
    g.fill();
  };
  layer(15, H * 0.42, 30, '#9aa7b8', 0.012);
  layer(40, H * 0.5, 22, '#7d9a7a', 0.02);
  // 路邊的龍眼樹
  for (let i = 0; i < 6; i++) {
    const x = ((i * 130 - t * 160) % (W + 260) + W + 260) % (W + 260) - 130;
    g.fillStyle = '#5a4030';
    g.fillRect(x + 28, H * 0.5, 8, H * 0.08);
    g.fillStyle = '#4f7a4a';
    g.beginPath(); g.ellipse(x + 32, H * 0.48, 40, 30, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#5d5f63';
  g.fillRect(0, H * 0.58, W, H * 0.16);
  g.fillStyle = '#e8e2d0';
  for (let i = 0; i < 8; i++) g.fillRect(((i * 90 - t * 320) % (W + 90) + W + 90) % (W + 90) - 90, H * 0.66, 44, 4);
  g.fillStyle = '#8a9a6a';
  g.fillRect(0, H * 0.74, W, H * 0.26);
  // 機車與騎車的人（剪影），腳踏板上放著外送袋
  const bx = W * 0.42;
  const by = H * 0.64 + Math.sin(t * 14) * 1.2;
  g.fillStyle = '#2e3440';
  for (const dx of [-34, 34]) { g.beginPath(); g.arc(bx + dx, by + 10, 13, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#c4382c';
  g.beginPath(); g.moveTo(bx - 44, by); g.lineTo(bx + 30, by); g.lineTo(bx + 46, by - 30); g.lineTo(bx + 36, by - 32); g.lineTo(bx + 20, by - 8); g.lineTo(bx - 40, by - 12); g.fill();
  g.fillStyle = '#c9a06a';
  g.fillRect(bx - 4, by - 26, 22, 24); // 外送袋
  g.fillStyle = '#3b3f4a';
  g.beginPath(); g.moveTo(bx - 26, by - 12); g.lineTo(bx - 10, by - 60); g.lineTo(bx + 6, by - 58); g.lineTo(bx + 4, by - 12); g.fill();
  g.beginPath(); g.moveTo(bx - 4, by - 52); g.lineTo(bx + 34, by - 32); g.lineWidth = 6; g.strokeStyle = '#3b3f4a'; g.stroke();
  g.fillStyle = '#f2ece2';
  g.beginPath(); g.arc(bx - 4, by - 72, 12, 0, Math.PI * 2); g.fill(); // 安全帽
  // 風
  g.strokeStyle = 'rgba(255,255,255,.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const y = H * (0.2 + i * 0.09);
    const x = ((i * 170 - t * 500) % (W + 200) + W + 200) % (W + 200) - 100;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60, y); g.stroke();
  }
}

// ② 公司櫃台：同樣的燈、影印機、櫃台。bag：袋子放上櫃台了沒；smile：同事嘴角 0～1
export function drawCounter(g, W, H, t, { bag = false, smile = 0 } = {}) {
  g.fillStyle = '#d9dcdc';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#eef0ee';
  g.fillRect(0, 0, W, H * 0.12);
  // 日光燈（偶爾閃一下）
  const flick = Math.sin(t * 37) > 0.97 ? 0.5 : 1;
  for (const x of [0.15, 0.55]) {
    g.fillStyle = `rgba(250,255,255,${flick})`;
    g.fillRect(W * x, H * 0.04, W * 0.3, H * 0.018);
  }
  g.fillStyle = '#b9c0c2';
  g.fillRect(0, H * 0.62, W, H * 0.38);
  // 牆上的公司字樣用色塊代替（粗稿）
  g.fillStyle = '#9aa3a8';
  g.fillRect(W * 0.3, H * 0.16, W * 0.4, H * 0.05);
  // 影印機（右邊），掃描的光來回
  g.fillStyle = '#c7c9c4';
  g.fillRect(W * 0.78, H * 0.42, W * 0.2, H * 0.22);
  g.fillStyle = '#8a8d88';
  g.fillRect(W * 0.78, H * 0.42, W * 0.2, H * 0.03);
  g.fillStyle = `rgba(160,255,200,${0.4 + 0.4 * Math.sin(t * 3)})`;
  g.fillRect(W * 0.8 + ((t * 40) % (W * 0.14)), H * 0.455, 4, H * 0.02);
  // 左邊角落：大廳沙發與老太太（不可點、不標示）
  g.fillStyle = '#7a8890';
  g.fillRect(W * 0.01, H * 0.56, W * 0.2, H * 0.07);
  g.save();
  g.translate(W * 0.05, H * 0.47);
  drawShape(g, 'grannySit', W * 0.09, H * 0.12, t, {});
  g.restore();
  // 同事
  g.save();
  g.translate(W * 0.36, H * 0.3);
  drawShape(g, 'colleague', W * 0.28, H * 0.34, t, { smile });
  g.restore();
  // 櫃台
  g.fillStyle = '#e6e2d8';
  g.fillRect(W * 0.12, H * 0.56, W * 0.76, H * 0.04);
  g.fillStyle = '#c3bfb4';
  g.fillRect(W * 0.14, H * 0.6, W * 0.72, H * 0.24);
  if (bag) {
    g.fillStyle = '#c9a06a';
    g.fillRect(W * 0.58, H * 0.47, W * 0.14, H * 0.09);
    g.fillStyle = '#a07a4a';
    g.fillRect(W * 0.58, H * 0.47, W * 0.14, H * 0.012);
  }
}

// ③ 杯套上的「王」（特寫）
export function drawSleeve(g, W, H) {
  g.fillStyle = '#e6e2d8';
  g.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H * 0.48;
  g.fillStyle = '#fbfaf6';
  g.beginPath(); g.moveTo(cx - 90, cy - 150); g.lineTo(cx + 90, cy - 150); g.lineTo(cx + 70, cy + 150); g.lineTo(cx - 70, cy + 150); g.closePath(); g.fill();
  g.fillStyle = '#3b2a20';
  g.fillRect(cx - 96, cy - 168, 192, 22); // 蓋子
  g.fillStyle = '#b8895a';
  g.beginPath(); g.moveTo(cx - 84, cy - 60); g.lineTo(cx + 84, cy - 60); g.lineTo(cx + 78, cy + 60); g.lineTo(cx - 78, cy + 60); g.closePath(); g.fill();
  g.fillStyle = '#2a2622';
  g.font = '700 84px "Kaiti TC","KaiTi","DFKai-SB","BiauKai",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(SLEEVE, cx + 4, cy + 4);
}

// ④⑤ 離開：朝玻璃門走，門上反射出櫃台那邊；同事的笑慢半拍才出來
export function drawLeave(g, W, H, t, { smile = 0, walk = 0 } = {}) {
  g.fillStyle = '#cfd3d3';
  g.fillRect(0, 0, W, H);
  const s = 1 + walk * 0.35;
  const dw = W * 0.7 * s;
  const dh = H * 0.62 * s;
  const x = (W - dw) / 2;
  const y = H * 0.12 - (s - 1) * H * 0.1;
  g.fillStyle = '#8a9296';
  g.fillRect(x - 8, y - 8, dw + 16, dh + 16);
  const glass = g.createLinearGradient(x, y, x + dw, y + dh);
  glass.addColorStop(0, '#d7e6ea');
  glass.addColorStop(1, '#b7ccd2');
  g.fillStyle = glass;
  g.fillRect(x, y, dw, dh);
  // 反射（左右顛倒、淡淡的）：櫃台與同事
  g.save();
  g.globalAlpha = 0.35;
  g.translate(x + dw * 0.62, y + dh * 0.32);
  g.scale(-1, 1);
  drawShape(g, 'colleague', dw * 0.26, dh * 0.4, t, { smile });
  g.restore();
  g.fillStyle = 'rgba(120,120,110,.25)';
  g.fillRect(x + dw * 0.15, y + dh * 0.68, dw * 0.7, dh * 0.04);
  g.fillStyle = '#6a7276';
  g.fillRect(x + dw / 2 - 2, y, 4, dh);
  g.fillStyle = '#c9c9c2';
  g.fillRect(x + dw / 2 - 18, y + dh * 0.5, 10, 50);
  g.fillRect(x + dw / 2 + 8, y + dh * 0.5, 10, 50);
  g.fillStyle = '#9aa0a0';
  g.fillRect(0, H * 0.8, W, H * 0.2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 櫃台對話的每一拍（純函式，給測試用）：
//   say：引號裡的對話，一次一句、點下一句；cue：舞台動作（袋子放上櫃台），畫面演、不顯示字、不用點；
//   deferred：同事的笑，對話中不演，留到主角離開之後（laugh 步驟）
export function talkBeats() {
  return COMPANY_TALK.map((l, i) => {
    if (l.who !== 'act') return { i, type: 'say', who: l.who, text: l.text };
    if (l.cue === 'laugh') return { i, type: 'deferred', cue: 'laugh' };
    return { i, type: 'cue', cue: l.cue };
  });
}

// 整段流程。api：{ state, step(name), line(n), finish(), fx（canvas）, say(who, text), hideSay(), waitTap() }
export async function runCompany(api) {
  const alive = api.alive;
  const s = api.state.company;
  setAmbient('hum');
  if (s.step === 'ride') {
    setAmbient('scooter');
    await animate(api.fx, drawRide, RIDE_MS);
    if (!alive()) return;
    api.step('talk');
    setAmbient('hum');
  }
  if (s.step === 'talk') {
    const beats = talkBeats();
    let bag = beats.slice(0, s.line).some((b) => b.cue === 'bag');
    const scene = animate(api.fx, (g, W, H, t) => drawCounter(g, W, H, t, { bag, smile: 0 }), null); // 對話中同事不笑
    play('copier');
    for (let i = s.line; i < beats.length; i++) {
      const b = beats[i];
      if (b.type === 'say') {
        api.say(b.who, b.text);
        await api.waitTap();
        if (!alive()) { scene.stop(); return; }
      } else if (b.type === 'cue') {
        // 舞台動作：只演，不出字、不要玩家點
        api.hideSay();
        bag = true;
        play('place');
        await sleep(900);
        if (!alive()) { scene.stop(); return; }
      }
      // deferred（同事的笑）：留到離開之後的 laugh 步驟
      api.line(i + 1);
    }
    scene.stop();
    api.hideSay();
    api.step('sleeve');
  }
  if (s.step === 'sleeve') {
    const scene = animate(api.fx, (g, W, H) => drawSleeve(g, W, H), null);
    await api.waitTap();
    scene.stop();
    if (!alive()) return;
    api.step('leave');
  }
  if (s.step === 'leave') {
    await animate(api.fx, (g, W, H, t) => drawLeave(g, W, H, t, { walk: Math.min(1, t / 3) }), 3200);
    if (!alive()) return;
    api.step('laugh');
  }
  if (s.step === 'laugh') {
    await animate(api.fx, (g, W, H, t) => drawLeave(g, W, H, t, { walk: 1, smile: Math.max(0, Math.min(1, (t - 1.4) / 2.4)) }), 4600);
    if (!alive()) return;
    play('door');
    api.finish();
  }
}
