// 場景組裝：把店裡（畫師美術）與夢想場景（粗稿）組成 Pano 吃的 { background, items, foreground, tint }。
import { getDream, DREAM_ORDER } from '../dreams/index.js';
import { FOV } from './pano.js';
import { HORIZON, shopScene as shopBase } from './shop.js';
import { INTERACTIONS, applyDone } from '../dreams/interact.js';

export { TONE, CAT_BY_DAY } from './shop.js';
// v3a 的店裡：帶回物要查夢想資料
export const shopScene = (opts) => shopBase({ getDream, ...opts });

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
