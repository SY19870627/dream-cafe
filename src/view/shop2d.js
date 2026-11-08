// 俯視店面（2D 平面圖，canvas）：佈置與營業共用同一個畫面。
// 純平面、沒有高度：每個角落畫成佔地色塊＋每格的小圖示，客人是圓形頭像標記。
// 紙片 3D 只留給「坐下來看看」（seat3d.js）；這裡只負責畫與「點到了什麼」，佈置、拖放、狀態都在 main.js。
// 對外介面與 shop3d.js 的 ShopView 相同（shop3d.js 留著不 import，之後回頭比較用）。
import {
  W, H, DOOR, WINDOW_ROWS, OUTLETS, KEEP_CLEAR, BAR_CELLS, STOOL_CELLS, CORNERS, DECOR, TUNE, BAR_ITEM,
  footprint, size, pieceCells, layerOf, cornerLabel, cornerOpts, cornerWallSpot, tableLine, seatCells, wallSideOf, physicalSideOf,
} from '../grid.js';
import { GUESTS, ACTIONS } from '../sim.js';

const FONT = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
const WALL_T = 0.24; // 牆厚（格）
const BG = '#2b2420';
const FLOOR = '#e3b77c'; // 木地板：偏暖的淺橘黃
const FLOOR_LINE = '#c99a5e';
const PLASTER = '#e9dfcb'; // 石灰牆
const BRICK = '#a4513b'; // 紅磚腰牆
const LEDGE = '#7a5a3c';

// 角落每一格放什麼的小圓牌（選取時畫）：沿用 shop3d.js
const PIECE_TEXT = { seat: '椅', table: '桌', shelf: '書架', plant: '綠', player: '唱盤', goods: '櫃' };
const PIECE_BG = { seat: '#fffaf1', table: '#7a4f2e', shelf: '#3f6b5a', plant: '#4f7a45', player: '#2f2a33', goods: '#8a5a3b' };
const PIECE_FG = { seat: '#3a2d22', table: '#fff8ee', shelf: '#fff8ee', plant: '#fff8ee', player: '#fff8ee', goods: '#fff8ee' };

const CHAIR_COLOR = { chair: '#8a5a3b', rattanChair: '#c9a467', stool: '#6b4a33', sofa: '#9a5a48' };
// 擺飾沒有 color 的，平面圖上用這些（只是色塊，不是美術）
const DECOR_FILL = {
  plant: '#4f7a45', frame: '#b98a5a', lamp: '#f2c45a', catbed: '#c98f5a', cattree: '#8a6a4a',
  greenwall: '#5d8a52', board: '#a87b52', map: '#6f9a7a', bookwall: '#7a4f2e',
};
const DECOR_TEXT = { plant: '綠', frame: '框', lamp: '燈', catbed: '窩', cattree: '跳台', rug: '毯', greenwall: '綠', board: '板', map: '圖', bookwall: '書' };
const WALL_TEXT = { board: '板', map: '圖' };

const styleColor = (it) => {
  const c = CORNERS[it.type];
  return (c.styles.find((s) => s.id === it.style) || c.styles[0]).color;
};
const tableColor = (it) => TUNE.table.opts[cornerOpts(it).table]?.color || styleColor(it);

export class ShopView {
  constructor(el) {
    this.el = el;
    el.innerHTML = `
      <div class="s3d s2d">
        <canvas class="s3d-canvas"></canvas>
        <div class="s3d-labels"></div>
        <div class="s3d-actors"></div>
      </div>`;
    this.canvas = el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.labelsEl = el.querySelector('.s3d-labels');
    this.actorsEl = el.querySelector('.s3d-actors');
    this.w = 1;
    this.h = 1;
    this.s = 40; // 一格幾 px
    this.ox = 0;
    this.oy = 0;
    this.state = null;
    this.ghost = null;
    this.pulseUid = null;
    this.flashUntil = 0;
    this.guests = new Map(); // gid → { el, pos }
    this.labels = [];

    const loop = (now) => {
      requestAnimationFrame(loop);
      const seat = document.getElementById('seat');
      if (seat && !seat.hidden) return; // 坐下來看看的時候不用畫俯視
      this.draw(now);
      this.placeOverlays();
    };
    requestAnimationFrame(loop);
  }

  /* ---------- 版面 ---------- */
  // 平面圖等比置中：店面 W×H 格＋四周的牆
  fit(w, h) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    const tw = W + WALL_T * 2;
    const th = H + WALL_T * 2;
    this.s = Math.max(8, Math.min(this.w / tw, this.h / th));
    this.ox = (this.w - W * this.s) / 2;
    this.oy = (this.h - H * this.s) / 2;
  }

  X(fx) { return this.ox + fx * this.s; }
  Y(fy) { return this.oy + fy * this.s; }

  /* ---------- 畫店面 ---------- */
  flash(ms = 1400) {
    this.flashUntil = performance.now() + ms;
  }

  // state：{ layout, validation, selected, spot, hint, mode, cat, dragging }
  render(state) {
    this.state = state;
    this.renderLabels(state.mode === 'setup' ? state.layout : null, state.selected);
  }

  setPulse(uid) {
    this.pulseUid = uid;
  }

  showGhost(item, ok) {
    this.ghost = { item, ok };
  }

  hideGhost() {
    this.ghost = null;
  }

  draw(now) {
    const g = this.ctx;
    const s = this.s;
    g.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = BG;
    g.fillRect(0, 0, this.w, this.h);
    this.drawRoom(g, s);
    const st = this.state;
    if (!st) return;
    const setup = st.mode === 'setup';
    if (setup) this.drawGuides(g, s);
    this.drawBar(g, s);
    // 地毯 → 家具 → 掛牆（純平面：照層畫，不會互相遮錯）
    const items = st.layout.items;
    for (const layer of ['rug', 'solid', 'wall']) {
      for (const it of items) {
        if (layerOf(it) !== layer) continue;
        g.globalAlpha = st.dragging && it.uid === st.dragging ? 0.3 : 1; // 拖曳中的那一件變淡
        if (it.kind === 'corner') this.drawCorner(g, s, it);
        else this.drawDecor(g, s, it);
      }
    }
    g.globalAlpha = 1;
    if (st.cat) this.drawCat(g, s, st.cat);
    if (setup) this.drawMarks(g, s, now);
    if (this.pulseUid === 'bar') {
      const a = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(now / 160));
      this.cellRect(g, 4, 0, 3, 3, '#e3a85b', a, 0.027);
    }
    if (this.ghost) {
      const sz = size(this.ghost.item);
      this.cellRect(g, this.ghost.item.x, this.ghost.item.y, sz.w, sz.h, this.ghost.ok ? '#3d8a4a' : '#d2402c', 0.5, 0.05);
    }
  }

  // 牆、窗、門、木地板
  drawRoom(g, s) {
    const x0 = this.X(0);
    const y0 = this.Y(0);
    const ww = W * s;
    const hh = H * s;
    const t = WALL_T * s;
    // 地板＋木條
    g.fillStyle = FLOOR;
    g.fillRect(x0, y0, ww, hh);
    g.strokeStyle = FLOOR_LINE;
    g.globalAlpha = 0.45;
    g.lineWidth = 1;
    const plank = s / 3;
    g.beginPath();
    for (let i = 1; i < H * 3; i++) {
      const y = y0 + i * plank;
      g.moveTo(x0, y); g.lineTo(x0 + ww, y);
      const off = (i % 3) * s * 0.8;
      for (let x = x0 + off; x < x0 + ww; x += s * 2.4) { g.moveTo(x, y - plank); g.lineTo(x, y); }
    }
    g.stroke();
    g.globalAlpha = 1;
    // 牆：外側石灰、內側一條紅磚腰牆
    const wallBand = (x, y, w, h, inner) => {
      g.fillStyle = PLASTER;
      g.fillRect(x, y, w, h);
      g.fillStyle = BRICK;
      if (inner === 'b') g.fillRect(x, y + h - h * 0.38, w, h * 0.38);
      if (inner === 'r') g.fillRect(x + w - w * 0.38, y, w * 0.38, h);
      if (inner === 'l') g.fillRect(x, y, w * 0.38, h);
    };
    wallBand(x0 - t, y0 - t, ww + t * 2, t, 'b'); // 後牆
    wallBand(x0 - t, y0, t, hh, 'r'); // 左牆
    wallBand(x0 + ww, y0, t, hh, 'l'); // 右牆
    // 左牆的窗（第 1～5 列）
    const wy0 = this.Y(WINDOW_ROWS[0]);
    const wy1 = this.Y(WINDOW_ROWS[WINDOW_ROWS.length - 1] + 1);
    g.fillStyle = '#bfe0ee';
    g.fillRect(x0 - t, wy0 + s * 0.08, t, wy1 - wy0 - s * 0.16);
    g.strokeStyle = '#6b5440';
    g.lineWidth = 1.5;
    g.strokeRect(x0 - t, wy0 + s * 0.08, t, wy1 - wy0 - s * 0.16);
    g.beginPath();
    g.moveTo(x0 - t, (wy0 + wy1) / 2); g.lineTo(x0, (wy0 + wy1) / 2);
    g.stroke();
    // 插座：牆上的小白盒
    g.fillStyle = '#f4f1ea';
    for (const o of OUTLETS) {
      const bx = o.x === 0 ? x0 - t * 0.55 : x0 + ww + t * 0.15;
      g.fillRect(bx, this.Y(o.y + 0.4), t * 0.4, s * 0.2);
    }
    // 前面：一道矮木檯，門口留缺口；門墊
    g.fillStyle = LEDGE;
    g.fillRect(x0 - t, y0 + hh, this.X(DOOR.x) - x0 + t, t * 0.7);
    g.fillRect(this.X(DOOR.x + 1), y0 + hh, x0 + ww + t - this.X(DOOR.x + 1), t * 0.7);
    g.fillStyle = '#a8977f';
    g.fillRect(this.X(DOOR.x), y0 + hh, s, t * 0.35);
    g.fillStyle = '#7a5a3c';
    g.fillRect(this.X(DOOR.x + 0.08), this.Y(DOOR.y + 0.45), s * 0.84, s * 0.5);
    this.text(g, '門', this.X(DOOR.x + 0.5), this.Y(DOOR.y + 0.7), s * 0.24, '#f3eadb');
  }

  // 佈置的輔助線：格線、靠窗／插座、門口與吧台前要留空（照 shop3d.js 的 buildGuides）
  drawGuides(g, s) {
    g.strokeStyle = '#3a2618';
    g.globalAlpha = 0.28;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x++) { g.moveTo(this.X(x), this.Y(0)); g.lineTo(this.X(x), this.Y(H)); }
    for (let y = 0; y <= H; y++) { g.moveTo(this.X(0), this.Y(y)); g.lineTo(this.X(W), this.Y(y)); }
    g.stroke();
    g.globalAlpha = 1;
    for (const y of WINDOW_ROWS) this.cellRect(g, 0, y, 1, 1, '#9fd0e6', 0.3, 0.05);
    for (const o of OUTLETS) this.cellRect(g, o.x, o.y, 1, 1, '#ffd36b', 0.4, 0.05);
    for (const k of KEEP_CLEAR) {
      this.cellRect(g, k.x, k.y, 1, 1, '#ffffff', 0.3, 0.13);
      // 斜線：這格要留空
      g.save();
      g.beginPath();
      g.rect(this.X(k.x + 0.065), this.Y(k.y + 0.065), s * 0.87, s * 0.87);
      g.clip();
      g.strokeStyle = '#ffffff';
      g.globalAlpha = 0.45;
      g.lineWidth = 1;
      g.beginPath();
      for (let d = -1; d <= 1; d += 0.25) { g.moveTo(this.X(k.x + d), this.Y(k.y + 1)); g.lineTo(this.X(k.x + d + 1), this.Y(k.y)); }
      g.stroke();
      g.restore();
    }
  }

  // 吧台與德叔的工作區（固定）＋三張高腳椅
  drawBar(g, s) {
    const bx = Math.min(...BAR_CELLS.map((c) => c.x));
    const by = Math.min(...BAR_CELLS.map((c) => c.y));
    const bw = Math.max(...BAR_CELLS.map((c) => c.x)) - bx + 1;
    const bh = Math.max(...BAR_CELLS.map((c) => c.y)) - by + 1;
    g.fillStyle = '#cfa877'; // 工作區的地板深一點
    g.fillRect(this.X(bx), this.Y(by), bw * s, bh * s);
    g.fillStyle = '#6b4a33'; // 後牆層架
    g.fillRect(this.X(bx), this.Y(by), bw * s, s * 0.28);
    // 吧台檯子（第二排靠客人那側）
    this.roundRect(g, this.X(bx + 0.04), this.Y(by + 1.2), (bw - 0.08) * s, s * 0.62, s * 0.08);
    g.fillStyle = '#8a5a3b';
    g.fill();
    g.strokeStyle = '#5a3a26';
    g.lineWidth = 1.5;
    g.stroke();
    this.text(g, '吧台', this.X(bx + bw / 2), this.Y(by + 1.51), s * 0.26, '#fff8ee');
    // 德叔
    this.disc(g, this.X(bx + bw / 2 + 0.2), this.Y(by + 0.72), s * 0.24, '#4a3a2e', '#e3a85b');
    this.text(g, '德', this.X(bx + bw / 2 + 0.2), this.Y(by + 0.72), s * 0.24, '#fff8ee');
    // 高腳椅
    for (const c of STOOL_CELLS) this.disc(g, this.X(c.x + 0.5), this.Y(c.y + 0.35), s * 0.18, CORNERS.bar.styles[0].color, '#4a3424');
  }

  // 角落：佔地色塊＋每格的小圖示
  drawCorner(g, s, it) {
    const c = CORNERS[it.type];
    const sz = size(it);
    const col = styleColor(it);
    this.roundRect(g, this.X(it.x + 0.05), this.Y(it.y + 0.05), (sz.w - 0.1) * s, (sz.h - 0.1) * s, s * 0.12);
    const a = g.globalAlpha;
    g.globalAlpha = a * 0.32;
    g.fillStyle = col;
    g.fill();
    g.globalAlpha = a;
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.stroke();
    const o = cornerOpts(it);
    const pieces = pieceCells(it);
    // 牆上（留言板／地圖）：貼牆的細條
    if (o.wall && WALL_TEXT[o.wall]) {
      const spot = cornerWallSpot(it);
      if (spot) for (const q of spot.cells) this.wallStrip(g, s, q, spot.side, DECOR_FILL[o.wall], WALL_TEXT[o.wall]);
    }
    // 桌子
    const tl = tableLine(it);
    const tcol = tableColor(it);
    if (c.tall) {
      // 展示櫃：一整排的櫃子
      this.roundRect(g, this.X(it.x + 0.1), this.Y(it.y + 0.1), (sz.w - 0.2) * s, (sz.h - 0.2) * s, s * 0.06);
      g.fillStyle = tcol;
      g.fill();
      g.strokeStyle = '#5a3a26';
      g.lineWidth = 1.5;
      g.stroke();
      const goods = TUNE.goods.opts[o.goods]?.name || '';
      this.text(g, `${PIECE_TEXT.goods}・${goods}`, this.X(it.x + sz.w / 2), this.Y(it.y + sz.h / 2), s * 0.24, tcol === '#f1ece3' || tcol === '#f4efe6' ? '#3a2d22' : '#fff8ee');
    } else if (tl.length > 1) {
      const xs = tl.map((q) => q.x);
      const ys = tl.map((q) => q.y);
      const x1 = Math.min(...xs);
      const y1 = Math.min(...ys);
      const w = Math.max(...xs) - x1 + 1;
      const h = Math.max(...ys) - y1 + 1;
      const ins = 0.16;
      this.roundRect(g, this.X(x1 + ins), this.Y(y1 + ins), (w - ins * 2) * s, (h - ins * 2) * s, s * 0.06);
      g.fillStyle = tcol;
      g.fill();
      g.strokeStyle = '#4a3424';
      g.lineWidth = 1.5;
      g.stroke();
    } else if (tl.length === 1) {
      this.disc(g, this.X(tl[0].x + 0.5), this.Y(tl[0].y + 0.5), s * (c.lowTable ? 0.3 : 0.34), tcol, '#4a3424');
    }
    // 桌上的東西
    if (tl.length && o.top && o.top !== 'none') {
      const q = tl[Math.floor(tl.length / 2)];
      const px = this.X(q.x + 0.5);
      const py = this.Y(q.y + 0.5);
      if (o.top === 'succulent') this.disc(g, px, py, s * 0.09, '#5d8a52', '#2f4a2a');
      else if (o.top === 'book') { g.fillStyle = '#7a3b32'; g.fillRect(px - s * 0.1, py - s * 0.07, s * 0.2, s * 0.14); }
      else this.disc(g, px, py, s * 0.08, '#fffaf1', '#806a55');
    }
    // 燈：桌格的一角一顆黃點
    if (o.lamp === 'on' && tl.length) {
      const q = tl[tl.length - 1];
      this.disc(g, this.X(q.x + 0.82), this.Y(q.y + 0.18), s * 0.09, '#ffd36b', '#8a6a2a');
    }
    // 其他小件
    for (const p of pieces) {
      const px = this.X(p.x + 0.5);
      const py = this.Y(p.y + 0.5);
      if (p.piece === 'shelf') {
        const side = physicalSideOf(p);
        const r = this.sideRect(p, side, 0.34);
        this.roundRect(g, r.x, r.y, r.w, r.h, s * 0.05);
        g.fillStyle = PIECE_BG.shelf;
        g.fill();
        this.text(g, PIECE_TEXT.shelf, r.x + r.w / 2, r.y + r.h / 2, s * 0.2, '#fff8ee');
      } else if (p.piece === 'plant') {
        this.disc(g, px, py, s * 0.24, PIECE_BG.plant, '#2f4a2a');
        this.text(g, PIECE_TEXT.plant, px, py, s * 0.22, '#fff8ee');
      } else if (p.piece === 'player') {
        this.roundRect(g, px - s * 0.3, py - s * 0.26, s * 0.6, s * 0.52, s * 0.06);
        g.fillStyle = PIECE_BG.player;
        g.fill();
        this.text(g, PIECE_TEXT.player, px, py, s * 0.2, '#fff8ee');
      }
    }
    // 椅子：小方塊往桌子拉近，椅背在遠離桌子那側（看得出朝哪邊坐）
    for (const q of seatCells(it)) this.drawChair(g, s, q, tl, o.chair || c.styles[0].chair || 'chair');
  }

  drawChair(g, s, q, tables, chair) {
    let ux = 0;
    let uy = 0;
    if (tables.length) {
      const t = tables.reduce((a, b) => (Math.hypot(b.x - q.x, b.y - q.y) < Math.hypot(a.x - q.x, a.y - q.y) ? b : a));
      const len = Math.hypot(t.x - q.x, t.y - q.y) || 1;
      ux = (t.x - q.x) / len;
      uy = (t.y - q.y) / len;
    }
    const cxp = this.X(q.x + 0.5 + ux * 0.16);
    const cyp = this.Y(q.y + 0.5 + uy * 0.16);
    const col = CHAIR_COLOR[chair] || CHAIR_COLOR.chair;
    if (chair === 'stool') { this.disc(g, cxp, cyp, s * 0.17, col, '#3a2618'); return; }
    const half = s * (chair === 'sofa' ? 0.3 : 0.2);
    this.roundRect(g, cxp - half, cyp - half, half * 2, half * 2, s * (chair === 'sofa' ? 0.1 : 0.05));
    g.fillStyle = col;
    g.fill();
    g.strokeStyle = '#3a2618';
    g.lineWidth = 1.2;
    g.stroke();
    if (!ux && !uy) return;
    // 椅背：遠離桌子那一邊的粗線
    const bx = cxp - ux * half * 0.8;
    const by = cyp - uy * half * 0.8;
    const px = -uy;
    const py = ux;
    g.strokeStyle = '#3a2618';
    g.lineWidth = Math.max(2, s * (chair === 'sofa' ? 0.12 : 0.07));
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(bx - px * half * 0.85, by - py * half * 0.85);
    g.lineTo(bx + px * half * 0.85, by + py * half * 0.85);
    g.stroke();
    g.lineCap = 'butt';
  }

  // 擺飾：地毯畫成淡色底、掛牆畫成貼牆的細條、其他是色塊＋字
  drawDecor(g, s, it) {
    const d = DECOR[it.type];
    const sz = size(it);
    const col = d.color || DECOR_FILL[it.type] || '#a87b52';
    const layer = layerOf(it);
    const a = g.globalAlpha;
    if (layer === 'rug') {
      this.roundRect(g, this.X(it.x + 0.08), this.Y(it.y + 0.08), (sz.w - 0.16) * s, (sz.h - 0.16) * s, s * 0.08);
      g.globalAlpha = a * 0.38;
      g.fillStyle = col;
      g.fill();
      g.globalAlpha = a * 0.7;
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.setLineDash([s * 0.12, s * 0.08]);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = a;
      return;
    }
    if (layer === 'wall') {
      for (const q of footprint(it)) this.wallStrip(g, s, q, wallSideOf(q) || physicalSideOf(q), col, DECOR_TEXT[it.type]);
      return;
    }
    const px = this.X(it.x + sz.w / 2);
    const py = this.Y(it.y + sz.h / 2);
    if (it.type === 'plant' || it.type === 'lamp') this.disc(g, px, py, s * 0.26, col, '#3a2618');
    else if (it.type === 'catbed') {
      g.beginPath();
      g.ellipse(px, py, s * 0.34, s * 0.24, 0, 0, Math.PI * 2);
      g.fillStyle = col;
      g.fill();
      g.strokeStyle = '#5a3a26';
      g.lineWidth = 1.5;
      g.stroke();
    } else {
      this.roundRect(g, this.X(it.x + 0.18), this.Y(it.y + 0.18), (sz.w - 0.36) * s, (sz.h - 0.36) * s, s * 0.06);
      g.fillStyle = col;
      g.fill();
      g.strokeStyle = '#3a2618';
      g.lineWidth = 1.2;
      g.stroke();
    }
    this.text(g, DECOR_TEXT[it.type] || d.name[0], px, py, s * 0.22, it.type === 'lamp' ? '#3a2d22' : '#fff8ee');
  }

  // 貼牆的細條（掛牆的擺飾、角落的牆上）
  wallStrip(g, s, q, side, col, label) {
    const r = this.sideRect(q, side || 'back', 0.2);
    this.roundRect(g, r.x, r.y, r.w, r.h, s * 0.04);
    g.fillStyle = col;
    g.fill();
    g.strokeStyle = '#3a2618';
    g.lineWidth = 1;
    g.stroke();
    if (label) this.text(g, label, r.x + r.w / 2, r.y + r.h / 2, s * 0.16, '#fff8ee');
  }

  // 一格裡貼著某一面牆的長條（像素矩形）
  sideRect(q, side, depth) {
    const s = this.s;
    const m = 0.08;
    if (side === 'left') return { x: this.X(q.x + 0.04), y: this.Y(q.y + m), w: s * depth, h: s * (1 - m * 2) };
    if (side === 'right') return { x: this.X(q.x + 0.96 - depth), y: this.Y(q.y + m), w: s * depth, h: s * (1 - m * 2) };
    if (side === 'back') return { x: this.X(q.x + m), y: this.Y(q.y + 0.04), w: s * (1 - m * 2), h: s * depth };
    return { x: this.X(q.x + 0.2), y: this.Y(q.y + 0.2), w: s * 0.6, h: s * 0.6 };
  }

  // 龍眼：橘色小圓點
  drawCat(g, s, cat) {
    const px = this.X(cat.x + 0.5);
    const py = this.Y(cat.y + 0.62);
    this.disc(g, px, py, s * 0.15, '#e08a2e', '#7a4a1a');
    this.disc(g, px - s * 0.06, py - s * 0.13, s * 0.045, '#e08a2e', null);
    this.disc(g, px + s * 0.06, py - s * 0.13, s * 0.045, '#e08a2e', null);
  }

  // 選取、放不下、堵住、放得下的提示、點到的空地（照 shop3d.js render 的顏色）
  drawMarks(g, s, now) {
    const { layout, validation, selected, spot, hint } = this.state;
    for (const c of validation?.stuck || []) this.cellRect(g, c.x, c.y, 1, 1, '#d2402c', 0.4, 0.05);
    const bad = new Set([...(validation?.problems || []).map((p) => p.uid), ...(validation?.unreachable || [])]);
    for (const it of layout.items) {
      if (!bad.has(it.uid)) continue;
      const sz = size(it);
      this.cellRect(g, it.x, it.y, sz.w, sz.h, '#d2402c', 0.42, 0.05);
    }
    for (const c of hint || []) this.cellRect(g, c.x, c.y, 1, 1, '#8fe08a', 0.5, 0.16);
    const sel = selected === 'bar' ? BAR_ITEM : layout.items.find((i) => i.uid === selected);
    if (sel) {
      // 琥珀色的佔地慢慢呼吸；剛放下、剛轉向時快閃一陣
      const sz = size(sel);
      const flashing = now < this.flashUntil;
      const k = 0.5 + 0.5 * Math.sin(now / (flashing ? 90 : 420));
      const a = flashing ? 0.3 + 0.55 * k : 0.36 + 0.16 * k;
      const sc = flashing ? 1 + 0.06 * k : 1;
      const cxp = sel.x + sz.w / 2;
      const cyp = sel.y + sz.h / 2;
      this.cellRect(g, cxp - (sz.w * sc) / 2, cyp - (sz.h * sc) / 2, sz.w * sc, sz.h * sc, '#ffbf4d', a, 0.027);
      g.strokeStyle = '#ffcf6b';
      g.lineWidth = 3;
      g.strokeRect(this.X(sel.x) + 1.5, this.Y(sel.y) + 1.5, sz.w * s - 3, sz.h * s - 3);
      for (const p of pieceCells(sel)) this.badge(g, s, p.x, p.y, p.piece);
    }
    if (spot) {
      this.cellRect(g, spot.x, spot.y, 1, 1, '#e3a85b', 0.6, 0.027);
      g.strokeStyle = '#ffcf6b';
      g.lineWidth = 3;
      g.strokeRect(this.X(spot.x) + 1.5, this.Y(spot.y) + 1.5, s - 3, s - 3);
    }
  }

  // 每格放什麼的小圓牌
  badge(g, s, x, y, piece) {
    const px = this.X(x + 0.5);
    const py = this.Y(y + 0.5);
    this.disc(g, px, py, s * 0.21, PIECE_BG[piece], '#e3a85b', Math.max(2, s * 0.04));
    const t = PIECE_TEXT[piece];
    this.text(g, t, px, py, s * (t.length > 1 ? 0.14 : 0.21), PIECE_FG[piece]);
  }

  /* ---------- 小工具 ---------- */
  cellRect(g, x, y, w, h, color, alpha, inset = 0.05) {
    const s = this.s;
    const a = g.globalAlpha;
    g.globalAlpha = a * alpha;
    g.fillStyle = color;
    g.fillRect(this.X(x + inset / 2), this.Y(y + inset / 2), (w - inset) * s, (h - inset) * s);
    g.globalAlpha = a;
  }

  roundRect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  disc(g, x, y, r, fill, stroke, lw = 1.5) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }

  text(g, t, x, y, px, color) {
    g.fillStyle = color;
    g.font = `700 ${Math.max(9, Math.round(px))}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t, x, y + px * 0.06);
  }

  /* ---------- 名牌與客人（DOM，疊在 canvas 上） ---------- */
  // 佈置時的小名牌：每個角落一直都有；擺飾只在選取時有。貼在佔地靠門口那一邊
  renderLabels(layout, selected) {
    this.labelsEl.innerHTML = '';
    this.labels = [];
    if (!layout) return;
    for (const it of layout.items) {
      const isSel = selected === it.uid;
      if (it.kind !== 'corner' && !isSel) continue;
      const fp = footprint(it);
      const pos = { fx: fp.reduce((a, q) => a + q.x + 0.5, 0) / fp.length, fy: Math.max(...fp.map((q) => q.y)) + 1 };
      const el = document.createElement('span');
      el.className = `s3d-label${isSel ? ' sel' : ''}`;
      el.textContent = it.kind === 'corner' ? cornerLabel(it) : DECOR[it.type].name;
      this.labelsEl.appendChild(el);
      this.labels.push({ el, pos });
    }
  }

  placeOverlays() {
    for (const l of this.labels) {
      l.el.style.transform = `translate(${this.X(l.pos.fx)}px, ${this.Y(l.pos.fy)}px) translate(-50%, 2px)`;
    }
    const d = Math.max(44, Math.round(this.s * 0.8));
    for (const v of this.guests.values()) {
      if (v.el.hidden || !v.pos) continue;
      v.el.style.width = `${d}px`;
      v.el.style.height = `${d}px`;
      v.el.style.transform = `translate(${this.X(v.pos.x + 0.5) - d / 2}px, ${this.Y(v.pos.y + 0.5) - d / 2}px)`;
    }
  }

  // 格子中心在螢幕上的位置（自動化測試點格子用）
  cellToClient(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + this.X(x + 0.5), y: r.top + this.Y(y + 0.5) };
  }

  /* ---------- 點到了什麼 ---------- */
  // 螢幕座標 → 格子座標（小數）；不在店面裡回傳 null
  pointToCell(clientX, clientY, allowOutside = false) {
    const r = this.canvas.getBoundingClientRect();
    if (!allowOutside && (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom)) return null;
    const c = { fx: (clientX - r.left - this.ox) / this.s, fy: (clientY - r.top - this.oy) / this.s };
    if (!allowOutside && (c.fx < 0 || c.fy < 0 || c.fx >= W || c.fy >= H)) return null;
    return c;
  }

  // 點到哪一件（uid），或地板上的哪一格：{ uid, cell } | { cell } | null
  pick(clientX, clientY, layout) {
    const p = this.pointToCell(clientX, clientY);
    if (!p) return null;
    const cell = { x: Math.floor(p.fx), y: Math.floor(p.fy) };
    const on = (list) => list.some((q) => q.x === cell.x && q.y === cell.y);
    if (on(BAR_CELLS) || on(STOOL_CELLS)) return { uid: 'bar', cell };
    // 同一格可能疊著：家具優先，再來掛牆上的，地毯最後
    const order = { solid: 0, wall: 1, rug: 2 };
    const it = layout.items.filter((i) => on(footprint(i))).sort((a, b) => order[layerOf(a)] - order[layerOf(b)])[0];
    if (it) return { uid: it.uid, cell };
    return { cell };
  }

  /* ---------- 營業：客人 ---------- */
  clearGuests() {
    for (const v of this.guests.values()) v.el.remove();
    this.guests.clear();
  }

  // 依模擬時間 t 擺客人的位置：圓形頭像標記（≥ 44px 可點），頭上的小圖示照 shop3d.js 的規則
  renderGuests(guests, t, onTap) {
    for (const g of guests) {
      const pos = guestPos(g, t);
      let v = this.guests.get(g.gid);
      if (!pos) {
        if (v) v.el.hidden = true;
        continue;
      }
      if (!v) {
        const info = GUESTS[g.type];
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'guest';
        el.style.setProperty('--c', info.color);
        el.setAttribute('aria-label', info.name);
        el.innerHTML = `<i class="bub"></i><span class="tag">${info.short}</span>`;
        el.onclick = () => onTap?.(g);
        this.actorsEl.appendChild(el);
        v = { el, pos };
        this.guests.set(g.gid, v);
      }
      v.pos = pos;
      v.el.hidden = false;
      const sit = pos.state === 'sit';
      const bub = v.el.querySelector('.bub');
      let icon = '';
      if (sit) {
        const k = (t - g.sitAt) / (g.leaveAt - g.sitAt);
        if (k < 0.3) icon = g.weird ? '❓' : '☕';
        else if (k < 0.85) icon = ACTIONS[g.action]?.icon || '';
      } else if (pos.state === 'wait') icon = '⌛';
      bub.textContent = icon;
      bub.hidden = !icon;
      v.el.classList.toggle('sig', g.signature && sit);
      v.el.classList.toggle('walk', !sit);
    }
    this.placeOverlays();
  }
}

// 客人在時間 t 的位置（格子座標，整數就是那一格）；不在店裡回傳 null
// （從 shop3d.js 原樣複製：不 import shop3d，免得把 Three.js 的俯視一起拉進來；行為必須與那邊一致）
export function guestPos(g, t) {
  if (t < g.arrive || t >= g.exitAt) return null;
  const route = [...g.path, g.seat];
  const along = (k) => {
    const f = Math.max(0, Math.min(route.length - 1, k * (route.length - 1)));
    const i = Math.floor(f);
    const a = route[i];
    const b = route[Math.min(route.length - 1, i + 1)];
    const r = f - i;
    return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  };
  // 門口等位子：稍微往旁邊站
  if (t < g.startWalk) return { x: DOOR.x + 0.35 * ((g.gid % 3) - 1), y: DOOR.y + 0.2, state: 'wait' };
  if (t < g.sitAt) return { ...along((t - g.startWalk) / (g.sitAt - g.startWalk)), state: 'walk' };
  if (t < g.leaveAt) return { x: g.seat.x, y: g.seat.y, state: 'sit' };
  return { ...along(1 - (t - g.leaveAt) / (g.exitAt - g.leaveAt)), state: 'walk' };
}
