// 場景組裝：把店裡（畫師美術）與夢想場景（粗稿）組成 Pano 吃的 { background, items, foreground, tint }。
import { img, ready } from './art.js';
import { getDream, DREAM_ORDER } from '../dreams/index.js';
import { FOV } from './pano.js';
import { INTERACTIONS, applyDone } from '../dreams/interact.js';

const HORIZON = 0.62;

// 色溫：同一間店，早上與傍晚只換色溫
export const TONE = {
  morning: 'rgba(255,214,150,.07)',
  dusk: 'rgba(120,60,20,.28)',
};

const patterns = new Map();
function pattern(g, name) {
  if (patterns.has(name)) return patterns.get(name);
  const im = img(name);
  if (!ready(im)) return null;
  const p = g.createPattern(im, 'repeat');
  patterns.set(name, p);
  return p;
}

// 店裡的牆與地板：灰泥牆、木地板（畫師的材質圖），跟著轉頭捲動
function shopBackground(g, W, H, yaw) {
  const ppd = W / FOV;
  const off = -yaw * ppd * 0.85;
  const hy = H * HORIZON;
  const wall = pattern(g, 'tex_wall_plaster');
  g.save();
  g.fillStyle = '#d8c7a8';
  g.fillRect(0, 0, W, hy);
  if (wall) {
    g.translate(off % 256, 0);
    g.scale(0.25, 0.25);
    g.fillStyle = wall;
    g.fillRect(-2048, 0, (W + 4096) * 4, hy * 4);
  }
  g.restore();
  g.fillStyle = 'rgba(80,50,30,.25)'; // 牆腳
  g.fillRect(0, hy - 18, W, 18);
  const floor = pattern(g, 'tex_floor_wood');
  g.save();
  g.fillStyle = '#8a6545';
  g.fillRect(0, hy, W, H - hy);
  if (floor) {
    g.beginPath();
    g.rect(0, hy, W, H - hy);
    g.clip();
    g.translate((off * 1.3) % 512, hy);
    g.scale(0.25, 0.25);
    g.fillStyle = floor;
    g.fillRect(-4096, 0, (W + 8192) * 4, (H - hy) * 4);
  }
  g.restore();
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(40,25,15,.35)');
  shade.addColorStop(0.3, 'rgba(40,25,15,0)');
  shade.addColorStop(1, 'rgba(40,25,15,.25)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
}

// 有材質的長方形（吧台正面、桌面）
const texRect = (name, base) => (g, w, h) => {
  const im = img(name);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  if (ready(im)) g.drawImage(im, 0, 0, w, h);
};

// 龍眼：每天自己靠近一點（窗台睡 → 吧台前 → 桌邊）
export const CAT_BY_DAY = [
  { angle: 70, depth: 0.32, y: 0.47, h: 0.07, img: 'cat_longan_sleep' }, // 第 0 天（開場）：窗台
  { angle: 70, depth: 0.32, y: 0.47, h: 0.07, img: 'cat_longan_sleep' },
  { angle: 52, depth: 0.45, y: 0.8, h: 0.08, img: 'cat_longan_sit' },
  { angle: 38, depth: 0.55, y: 0.86, h: 0.09, img: 'cat_longan_sleep' },
  { angle: 28, depth: 0.66, y: 0.9, h: 0.1, img: 'cat_longan_sit' },
  { angle: 18, depth: 0.78, y: 0.95, h: 0.11, img: 'cat_longan_sleep' },
];

// mode：'enter' 剛推門、'sit' 等玩家點椅子、'seated' 坐著；deshu：德叔的姿勢；takeaways：已上架的夢想 id；tone：色溫
export function shopScene({ mode = 'seated', deshu = 'stand', day = 0, takeaways = [], tone = 'morning' }) {
  const seated = mode === 'seated';
  const items = [
    { id: 'backbar', angle: 0, depth: 0.18, y: 0.6, h: 0.32, img: 'backbar' },
    { id: 'lamp', angle: -4, depth: 0.42, y: 0.2, h: 0.2, img: 'pendant_lamp' },
    { id: 'deshu', angle: -8, depth: 0.32, y: 0.74, h: 0.46, img: `char_deshu_${deshu}` },
    { id: 'counter', angle: 0, depth: 0.42, y: 0.8, h: 0.17, aspect: 3.4, draw: texRect('tex_counter_front', '#6b4a30') },
    { id: 'kettle', angle: 16, depth: 0.44, y: 0.645, h: 0.055, img: 'kettleSet' },
    { id: 'window', angle: 72, depth: 0.28, y: 0.56, h: 0.3, img: 'window_day_clear' },
    { id: 'bookshelf', angle: -72, depth: 0.3, y: 0.76, h: 0.44, img: 'bookshelf' },
    { id: 'radio', angle: -118, depth: 0.42, y: 0.8, h: 0.24, img: 'radio' },
    { id: 'plant', angle: 122, depth: 0.45, y: 0.84, h: 0.28, img: 'plant' },
    { id: 'door', angle: 180, depth: 0.35, y: 0.8, h: 0.48, shape: 'door' },
    { id: 'shelf', angle: -37, depth: 0.46, y: 0.5, h: 0.03, shape: 'plank', aspect: 8 },
  ];
  // 帶回來的東西上架（粗稿形狀；點了會出它的名字）
  takeaways.forEach((id, i) => {
    const d = getDream(id);
    if (!d) return;
    items.push({ id: `take-${id}`, angle: -52 + i * 7.5, depth: 0.47, y: 0.495, h: 0.05, shape: d.takeaway.shape, hit: true, label: d.takeaway.name, takeaway: id });
  });
  const cat = CAT_BY_DAY[Math.max(0, Math.min(5, day))];
  items.push({ id: 'longan', ...cat });
  if (mode === 'sit') items.push({ id: 'seat', angle: 16, depth: 0.78, y: 0.98, h: 0.34, img: 'chair', hit: true, glow: true, label: '椅子' });
  return {
    background: shopBackground,
    items,
    foreground: seated ? (g, W, H) => {
      // 坐下來：桌面在畫面下緣
      const top = H * 0.86;
      const tex = pattern(g, 'tex_wood_top');
      g.fillStyle = '#7a5638';
      g.fillRect(0, top, W, H - top);
      if (tex) { g.save(); g.beginPath(); g.rect(0, top, W, H - top); g.clip(); g.scale(0.3, 0.3); g.fillStyle = tex; g.fillRect(0, top / 0.3, W / 0.3, (H - top) / 0.3); g.restore(); }
      g.fillStyle = 'rgba(255,240,210,.25)';
      g.fillRect(0, top, W, 3);
    } : null,
    tint: TONE[tone],
  };
}

// 夢想場景的牆與地板（粗稿）：天花板、牆、地板三段色帶，加一點該場的光
function dreamBackground(p) {
  return (g, W, H, yaw, t) => {
    const hy = H * HORIZON;
    g.fillStyle = p.ceiling;
    g.fillRect(0, 0, W, H * 0.1);
    const wg = g.createLinearGradient(0, H * 0.1, 0, hy);
    wg.addColorStop(0, p.wall[0]);
    wg.addColorStop(1, p.wall[1]);
    g.fillStyle = wg;
    g.fillRect(0, H * 0.1, W, hy - H * 0.1);
    const fg = g.createLinearGradient(0, hy, 0, H);
    fg.addColorStop(0, p.floor[0]);
    fg.addColorStop(1, p.floor[1]);
    g.fillStyle = fg;
    g.fillRect(0, hy, W, H - hy);
    // 牆面的木板縫，跟著轉頭移動（讓人感覺得到在轉）
    const ppd = W / FOV;
    g.strokeStyle = 'rgba(0,0,0,.08)';
    g.lineWidth = 2;
    for (let a = -180; a < 180; a += 12) {
      const x = W / 2 + (((a - yaw + 540) % 360) - 180) * ppd * 0.85;
      if (x < -5 || x > W + 5) continue;
      g.beginPath(); g.moveTo(x, H * 0.1); g.lineTo(x, hy); g.stroke();
    }
    if (p.blinds) { // 百葉窗的光一條一條落在牆上
      g.fillStyle = 'rgba(255,236,190,.12)';
      for (let i = 0; i < 9; i++) g.fillRect(0, H * 0.2 + i * H * 0.045, W, H * 0.015);
    }
    if (p.shade) { // 騎樓的影子把地面切成一半
      g.fillStyle = 'rgba(30,25,20,.28)';
      g.beginPath(); g.moveTo(0, hy); g.lineTo(W * 0.55, hy); g.lineTo(W * 0.2, H); g.lineTo(0, H); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(0, hy - 3, W, 3);
  };
}

export const EXIT_LABEL = '回店裡'; // 出口門上的技術標示

// interacted：這條夢想的互動做過了沒（做過就直接畫做完的樣子，物件上不再有手勢）
export function dreamScene(id, { interacted = false } = {}) {
  const d = getDream(id);
  const items = [];
  const def = INTERACTIONS[id];
  for (const p of d.props) items.push({ id: `prop-${items.length}`, ...p });
  for (const o of d.objects) {
    const it = { ...o, hit: true, label: o.name, kind: 'object' };
    if (def && o.id === def.target) Object.assign(it, { gesture: def.kind, feedback: def.feedback });
    items.push(it);
  }
  const gr = d.granny;
  items.push({
    id: 'granny', // 不可點（沒有 hit）、不標示（沒有 label）
    angle: gr.angle,
    depth: gr.depth,
    z: gr.z,
    y: gr.y ?? HORIZON + 0.34 * gr.depth,
    h: gr.pose === 'sit' ? 0.2 : 0.28,
    shape: gr.pose === 'sit' ? 'grannySit' : 'granny',
    opt: { umbrella: gr.umbrella, cup: gr.cup },
  });
  items.push({ id: 'exit', angle: d.exit.angle, depth: 0.4, y: 0.82, h: 0.44, shape: 'door', hit: true, label: EXIT_LABEL, showLabel: true, kind: 'exit' });
  if (interacted) applyDone(id, items);
  return { dream: d, scene: { background: dreamBackground(d.palette), items, tint: d.palette.tint } };
}

export const allDreamScenes = () => DREAM_ORDER.map((id) => dreamScene(id));
