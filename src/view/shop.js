// 俯視店面：格子、固定物、角落、擺飾、客人與龍眼。佈置與營業共用同一個畫面。
// 只負責畫；拖放與狀態在 main.js。
import {
  W, H, DOOR, WINDOW_ROWS, OUTLETS, BAR_CELLS, KEEP_CLEAR, CORNERS, DECOR, BAR_ITEM, size, seatCells, pieceCell, footprint,
} from '../grid.js';
import { GUESTS, ACTIONS } from '../sim.js';

const ART = './assets/art/';
const img = (name, cls = '', alt = '') => `<img class="${cls}" src="${ART}${name}.webp" alt="${alt}" draggable="false">`;

export function styleOf(item) {
  const c = CORNERS[item.type];
  return c.styles.find((s) => s.id === item.style) || c.styles[0];
}

export class ShopView {
  constructor(el) {
    this.el = el;
    this.cell = 50;
    el.innerHTML = `
      <div class="shop">
        <div class="sh-floor"></div>
        <div class="sh-grid"></div>
        <div class="sh-fixed"></div>
        <div class="sh-items"></div>
        <div class="sh-marks"></div>
        <div class="sh-actors"></div>
      </div>`;
    this.shop = el.querySelector('.shop');
    this.items = el.querySelector('.sh-items');
    this.marks = el.querySelector('.sh-marks');
    this.actors = el.querySelector('.sh-actors');
    this.fixed = el.querySelector('.sh-fixed');
    this.ghost = null;
    this.guestEls = new Map();
  }

  // 依可用空間決定一格多大
  fit(maxW, maxH) {
    this.cell = Math.max(36, Math.floor(Math.min(maxW / W, maxH / H)));
    this.shop.style.setProperty('--cell', `${this.cell}px`);
    this.shop.style.width = `${this.cell * W}px`;
    this.shop.style.height = `${this.cell * H}px`;
    this.drawFixed();
  }

  box(x, y, w = 1, h = 1) {
    const c = this.cell;
    return `left:${x * c}px;top:${y * c}px;width:${w * c}px;height:${h * c}px`;
  }

  drawFixed() {
    const bx = Math.min(...BAR_CELLS.map((c) => c.x));
    let html = '';
    html += `<div class="sh-window" style="${this.box(0, WINDOW_ROWS[0], 1, WINDOW_ROWS.length)}"><span>窗</span></div>`;
    html += `<div class="sh-door" style="${this.box(DOOR.x, DOOR.y)}"><span>門</span></div>`;
    html += `<div class="sh-bar" style="${this.box(bx, 0, 3, 2)}">${img('char_deshu_stand', 'deshu', '德叔')}<span>吧台</span></div>`;
    for (const o of OUTLETS) html += `<div class="sh-outlet" style="${this.box(o.x, o.y)}" title="插座"><i></i></div>`;
    for (const k of KEEP_CLEAR) html += `<div class="sh-clear" style="${this.box(k.x, k.y)}"></div>`;
    this.fixed.innerHTML = html;
  }

  // 一個角落／擺飾的內容
  itemHTML(it) {
    const c = this.cell;
    if (it.kind === 'decor') return img(DECOR[it.type].art, 'deco', DECOR[it.type].name);
    const st = styleOf(it);
    let inner = '';
    const rel = (cell) => `left:${(cell.x - it.x) * c}px;top:${(cell.y - it.y) * c}px;width:${c}px;height:${c}px`;
    const table = pieceCell(it, 'table');
    if (table) {
      // 工作桌的長桌佔一整排：畫在桌子那一格所在的整條
      if (it.type === 'worktable') {
        const fp = footprint(it);
        const s = size(it);
        const line = it.rot % 2 ? fp.filter((q) => q.x === table.x) : fp.filter((q) => q.y === table.y);
        const minX = Math.min(...line.map((q) => q.x));
        const minY = Math.min(...line.map((q) => q.y));
        const w = it.rot % 2 ? 1 : s.w;
        const h = it.rot % 2 ? s.h : 1;
        inner += `<div class="pc table" style="left:${(minX - it.x) * c + 4}px;top:${(minY - it.y) * c + 4}px;width:${w * c - 8}px;height:${h * c - 8}px"></div>`;
      } else {
        inner += `<div class="pc table" style="left:${(table.x - it.x) * c + 6}px;top:${(table.y - it.y) * c + 6}px;width:${c - 12}px;height:${c - 12}px"></div>`;
      }
    }
    const shelf = pieceCell(it, 'shelf');
    if (shelf) inner += `<div class="pc" style="${rel(shelf)}">${img('bookshelf', 'pc-img', '小書架')}</div>`;
    seatCells(it).forEach((s, i) => {
      inner += `<div class="pc seat" data-seat="${i}" style="${rel(s)}">${img(st.chair || 'stool', 'pc-img', '椅子')}</div>`;
    });
    if (it.type === 'worktable' && table) inner += `<div class="pc lamp" style="${rel(table)}">${img('floorLamp_on', 'pc-img small', '檯燈')}</div>`;
    return `${inner}<span class="label">${CORNERS[it.type].name}・${st.name}</span>`;
  }

  // state：{ layout, validation, selected, mode, cat }
  render({ layout, validation, selected, mode, cat }) {
    this.shop.classList.toggle('setup', mode === 'setup');
    this.shop.classList.toggle('business', mode === 'business');
    const bad = new Set([...(validation?.problems || []).map((p) => p.uid), ...(validation?.unreachable || [])]);
    const all = [BAR_ITEM, ...layout.items];
    this.items.innerHTML = all.map((it) => {
      const s = size(it);
      const cls = ['it', it.kind, it.type, it.style || '', bad.has(it.uid) ? 'bad' : '', selected === it.uid ? 'sel' : '', it.fixed ? 'fixed' : ''].join(' ');
      const bg = it.kind === 'corner' && !it.fixed ? `background:${styleOf(it).color}33;border-color:${styleOf(it).color}` : '';
      return `<div class="${cls}" data-uid="${it.uid}" style="${this.box(it.x, it.y, s.w, s.h)};${bg}">${this.itemHTML(it)}</div>`;
    }).join('');
    // 堵住、走不到的空格標紅
    let marks = '';
    if (mode === 'setup') for (const c of validation?.stuck || []) marks += `<div class="sh-stuck" style="${this.box(c.x, c.y)}"></div>`;
    this.marks.innerHTML = marks;
    if (this.ghost) this.marks.appendChild(this.ghost);
    this.drawCat(cat, layout);
  }

  drawCat(cat) {
    let el = this.actors.querySelector('.cat');
    if (!cat) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'cat';
      el.innerHTML = img('cat_longan_sleep', '', '龍眼');
      this.actors.appendChild(el);
    }
    el.style.cssText = this.box(cat.x, cat.y);
  }

  // 拖曳中的影子：綠色可以放、紅色放不下
  showGhost(item, ok) {
    if (!this.ghost) {
      this.ghost = document.createElement('div');
      this.marks.appendChild(this.ghost);
    }
    const s = size(item);
    this.ghost.className = `sh-ghost ${ok ? 'ok' : 'no'}`;
    this.ghost.style.cssText = this.box(item.x, item.y, s.w, s.h);
  }

  hideGhost() {
    this.ghost?.remove();
    this.ghost = null;
  }

  // 螢幕座標 → 格子座標（小數）；不在店面裡回傳 null
  pointToCell(clientX, clientY, allowOutside = false) {
    const r = this.shop.getBoundingClientRect();
    const fx = (clientX - r.left) / this.cell;
    const fy = (clientY - r.top) / this.cell;
    if (!allowOutside && (fx < 0 || fy < 0 || fx >= W || fy >= H)) return null;
    return { fx, fy };
  }

  /* ---------- 營業：客人 ---------- */
  clearGuests() {
    for (const el of this.guestEls.values()) el.remove();
    this.guestEls.clear();
  }

  // 依模擬時間 t 擺客人的位置；回傳現在店裡的人數（畫面提示用）
  renderGuests(guests, t, onTap) {
    const c = this.cell;
    for (const g of guests) {
      const pos = guestPos(g, t);
      let el = this.guestEls.get(g.gid);
      if (!pos) {
        if (el) el.hidden = true;
        continue;
      }
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'guest';
        el.style.setProperty('--g', GUESTS[g.type].color);
        el.innerHTML = `<span>${GUESTS[g.type].short}</span><i class="bub"></i>`;
        el.onclick = () => onTap?.(g);
        this.actors.appendChild(el);
        this.guestEls.set(g.gid, el);
      }
      el.hidden = false;
      el.style.transform = `translate(${pos.x * c}px, ${pos.y * c}px)`;
      const bub = el.querySelector('.bub');
      let icon = '';
      if (pos.state === 'sit') {
        const k = (t - g.sitAt) / (g.leaveAt - g.sitAt);
        if (k < 0.3) icon = g.weird ? '❓' : '☕';
        else if (k < 0.85) icon = ACTIONS[g.action]?.icon || '';
      } else if (pos.state === 'wait') icon = '⌛';
      bub.textContent = icon;
      bub.hidden = !icon;
      el.classList.toggle('sig', g.signature && pos.state === 'sit');
    }
  }
}

// 客人在時間 t 的位置（格子座標，格子左上角為原點）；不在店裡回傳 null
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
