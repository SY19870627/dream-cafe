// 360 環視：顧客視角的 2.5D 紙片場景（canvas）。
// 手指只做兩件事：左右拖曳轉頭、點一下物件。拖曳超過 10px 就不算點，避免轉頭時誤觸。
// 物件用角度擺在一圈上；depth 越大越近，轉頭時移動得比遠的快一點（紙片的層次感）。
import { img, ready } from './art.js';
import { drawShape, ASPECT } from './draft.js';

export const FOV = 78; // 畫面寬度對應的角度
export const TAP_SLOP = 10;
export const MIN_HIT = 44;
export const MIN_VISIBLE = 8; // 物件露在畫面內的寬或高少於這個，就先不能點（轉過去一點才能點）

// 點擊範圍：從物件「畫面內看得到的部分」（含下方標籤）算起，放大到至少 44×44，再整個夾進畫面裡。
// 所以畫面上每一個可點範圍都完整在 canvas 內、至少 44×44；物件只露一角時，點擊範圍往畫面內延伸，不會落到畫面外。
// p：物件在畫面上的矩形 { x, y, w, h }；W、H：canvas 大小；labelH：下方標籤的高度
export function hitBox(p, W, H, labelH = 0) {
  const x0 = Math.max(0, p.x);
  const x1 = Math.min(W, p.x + p.w);
  const y0 = Math.max(0, p.y);
  const y1 = Math.min(H, p.y + p.h + labelH);
  // 露出不夠就先不能點；本身就比 8px 小的物件，整個看得到就可以點
  if (x1 - x0 < Math.min(MIN_VISIBLE, p.w) || y1 - y0 < Math.min(MIN_VISIBLE, p.h + labelH) || x1 <= x0 || y1 <= y0) return null;
  // 對齊整數像素再夾進畫面（避免浮點誤差讓寬度變成 43.999…）
  const w = Math.min(Math.floor(W), Math.ceil(Math.max(MIN_HIT, x1 - x0)));
  const h = Math.min(Math.floor(H), Math.ceil(Math.max(MIN_HIT, y1 - y0)));
  const x = Math.max(0, Math.min(Math.floor(W) - w, Math.floor((x0 + x1) / 2 - w / 2)));
  const y = Math.max(0, Math.min(Math.floor(H) - h, Math.floor((y0 + y1) / 2 - h / 2)));
  return { x, y, w, h };
}

// 物件在畫面上的矩形（純函式，給 Pano.project 與單元測試共用）。aspect：寬 / 高；不在視野內回傳 null。
// 物件用角度擺在一圈上；y 是物件底邊（佔畫面高），h 是高（佔畫面高），depth 越大越近、越大。
export function projectRect(it, W, H, yaw, aspect) {
  const ppd = W / FOV;
  const f = 0.85 + 0.3 * it.depth;
  const dx = wrap(it.angle - yaw);
  const x = W / 2 + dx * ppd * f;
  const s = 0.65 + 0.7 * it.depth;
  const h = it.h * H * s;
  const w = h * aspect;
  const y = it.y * H - h;
  if (x + w / 2 < -40 || x - w / 2 > W + 40) return null;
  return { x: x - w / 2, y, w, h };
}

// 子物件（例如桌上的杯子）跟著父物件（桌子）走：位置用父物件「原圖像素」給，不用自己的角度／高度。
// parent：父物件在畫面上的矩形；size：父物件原圖 [寬, 高]；at：{ x, y：子物件底邊中心（父原圖像素）, h：子物件高（父原圖像素） }；aspect：子物件寬 / 高
export function childRect(parent, size, at, aspect) {
  const kx = parent.w / size[0];
  const ky = parent.h / size[1];
  const h = at.h * ky;
  const w = h * aspect;
  return { x: parent.x + at.x * kx - w / 2, y: parent.y + at.y * ky - h, w, h };
}
// 父物件原圖上的一點 → 畫面座標（測試與除錯用：桌面四邊形投影到畫面上）
export const childPoint = (parent, size, [x, y]) => [parent.x + (x * parent.w) / size[0], parent.y + (y * parent.h) / size[1]];

export const wrap =(a) => ((((a + 180) % 360) + 360) % 360) - 180;

export class Pano {
  constructor(canvas, { onTap, onGesture } = {}) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.onTap = onTap || (() => {});
    this.onGesture = onGesture || (() => {}); // (物件, { dx, dy, ms, endInside }) 在有互動的物件上拖曳後放開
    this.yaw = 0;
    this.vel = 0;
    this.scene = null;
    this.t0 = performance.now();
    this.flash = new Map(); // 物件 id → 亮一下的開始時間
    this.boxes = [];
    this.enabled = true;
    this.bind();
    this.resize();
    addEventListener('resize', () => this.resize());
    const loop = () => { this.frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.W = r.width || 390;
    this.H = r.height || 844;
    this.c.width = Math.round(this.W * dpr);
    this.c.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setScene(scene, { yaw } = {}) {
    this.scene = scene;
    this.resize(); // canvas 可能剛從 hidden 變成看得見
    if (yaw != null) { this.yaw = yaw; this.turn = null; }
    this.vel = 0;
  }

  // 鏡頭慢慢轉到某個角度（開場演出用；玩家拖曳時取消）
  turnTo(yaw, ms = 900) {
    const from = this.yaw;
    const d = wrap(yaw - from);
    if (Math.abs(d) < 0.5) { this.yaw = wrap(yaw); this.turn = null; return; }
    this.turn = { from, d, t0: performance.now(), ms };
    this.vel = 0;
  }

  bind() {
    const c = this.c;
    let start = null;
    const local = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      c.setPointerCapture?.(e.pointerId);
      const p = local(e);
      // 按在有互動的物件上：這次拖曳交給物件，不轉頭
      const hit = this.hitAt(p.x, p.y);
      const gesture = hit?.item.gesture ? hit.item : null;
      start = { x: e.clientX, y: e.clientY, lx: e.clientX, moved: false, t: performance.now(), lt: performance.now(), gesture };
      this.vel = 0;
      if (!this.scene?.locked) this.turn = null;
    });
    c.addEventListener('pointermove', (e) => {
      if (!start || this.scene?.locked) return;
      if (Math.abs(e.clientX - start.x) > TAP_SLOP || Math.abs(e.clientY - start.y) > TAP_SLOP) start.moved = true;
      if (!start.moved) return;
      if (start.gesture) {
        this.dragFeedback(start.gesture, e.clientX - start.x, e.clientY - start.y, local(e));
        return;
      }
      const dx = e.clientX - start.lx;
      const now = performance.now();
      const d = -dx / (this.W / FOV);
      this.yaw = wrap(this.yaw + d);
      this.vel = d / Math.max(8, now - start.lt);
      start.lx = e.clientX;
      start.lt = now;
    });
    const end = (e) => {
      if (!start) return;
      const s = start;
      start = null;
      const p = local(e);
      if (s.gesture) {
        const it = s.gesture;
        delete it.drag;
        if (this.scene) this.scene.hand = null;
        if (s.moved && e.type !== 'pointercancel') {
          const endInside = this.hitAt(p.x, p.y)?.item === it;
          this.onGesture(it, { dx: e.clientX - s.x, dy: e.clientY - s.y, ms: performance.now() - s.t, endInside });
          return;
        }
      }
      if (s.moved || e.type === 'pointercancel') return;
      this.tapAt(p.x, p.y);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    // 鍵盤：左右鍵轉頭
    c.tabIndex = 0;
    c.addEventListener('keydown', (e) => {
      if (this.scene?.locked) return;
      if (e.key === 'ArrowLeft') this.yaw = wrap(this.yaw - 15);
      if (e.key === 'ArrowRight') this.yaw = wrap(this.yaw + 15);
    });
  }

  // 這個點落在哪個可點的物件上（近的優先）
  hitAt(x, y) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  tapAt(x, y) {
    const b = this.hitAt(x, y);
    if (b) this.flash.set(b.item.id, performance.now());
    this.onTap(b ? b.item : null);
  }

  // 拖曳中：物件跟著手指動一點（粗稿），或畫一隻手跟著手指（伸手向出風口）
  dragFeedback(it, dx, dy, p) {
    const cl = (v, m) => Math.max(-m, Math.min(m, v));
    if (it.feedback === 'hand') { if (this.scene) this.scene.hand = p; return; }
    if (it.feedback === 'follow-y') it.drag = { dx: 0, dy: cl(Math.min(0, dy), 120) };
    else if (it.feedback === 'follow-x') it.drag = { dx: cl(dx, 90), dy: 0 };
    else it.drag = { dx: cl(dx, 160), dy: cl(dy, 160) };
  }

  // 物件的寬高比：有圖就用圖的比例，圖還沒載入時用 it.aspect（或 it.size）
  aspectOf(it) {
    let aspect = it.aspect || (it.size ? it.size[0] / it.size[1] : 0);
    if (it.img) {
      const im = img(it.img);
      aspect = ready(im) ? im.naturalWidth / im.naturalHeight : aspect || 1;
    }
    return aspect || ASPECT[it.shape] || 1;
  }

  // 物件在畫面上的位置（不在視野內回傳 null）。有 parent 的物件（例如桌上的杯子）跟著父物件走：用父物件原圖像素定位
  project(it) {
    if (it.parent) {
      const par = this.scene?.items?.find((x) => x.id === it.parent);
      const pr = par && !par.hidden ? this.project(par) : null;
      return pr ? childRect(pr, par.size, it.at, this.aspectOf(it)) : null;
    }
    return projectRect(it, this.W, this.H, this.yaw, this.aspectOf(it));
  }

  frame() {
    const { g, W, H, scene } = this;
    if (!scene) return;
    const t = (performance.now() - this.t0) / 1000;
    if (this.turn) {
      const k = Math.min(1, (performance.now() - this.turn.t0) / this.turn.ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.yaw = wrap(this.turn.from + this.turn.d * e);
      if (k >= 1) this.turn = null;
    }
    if (Math.abs(this.vel) > 0.0005 && !scene.locked) {
      this.yaw = wrap(this.yaw + this.vel * 16);
      this.vel *= 0.92;
    }
    g.clearRect(0, 0, W, H);
    scene.background?.(g, W, H, this.yaw, t);
    const items = [...(scene.items || [])].filter((i) => !i.hidden).sort((a, b) => (a.z ?? a.depth) - (b.z ?? b.depth));
    this.boxes = [];
    for (const it of items) {
      const p = this.project(it);
      if (!p) continue;
      g.save();
      if (it.alpha != null) g.globalAlpha = it.alpha;
      const fl = this.flash.get(it.id);
      const k = fl ? Math.max(0, 1 - (performance.now() - fl) / 700) : 0;
      if (it.glow || k > 0) {
        g.shadowColor = 'rgba(255,236,190,.95)';
        g.shadowBlur = 18 * Math.max(k, it.glow ? 0.6 + 0.4 * Math.sin(t * 5) : 0);
      }
      g.translate(p.x + (it.drag?.dx || 0), p.y + (it.drag?.dy || 0));
      if (it.flip) { g.translate(p.w, 0); g.scale(-1, 1); }
      if (it.img) {
        const im = img(it.img);
        if (ready(im)) g.drawImage(im, 0, 0, p.w, p.h);
      } else if (it.draw) it.draw(g, p.w, p.h, t);
      else drawShape(g, it.shape, p.w, p.h, t, it.opt || {});
      g.restore();
      if (it.label && it.showLabel) {
        g.save();
        g.font = '600 14px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
        g.textAlign = 'center';
        g.fillStyle = 'rgba(30,22,16,.7)';
        const tw = g.measureText(it.label).width + 20;
        const lx = p.x + p.w / 2;
        const ly = p.y + p.h + 8;
        g.beginPath();
        g.roundRect ? g.roundRect(lx - tw / 2, ly, tw, 26, 13) : g.rect(lx - tw / 2, ly, tw, 26);
        g.fill();
        g.fillStyle = '#f6efe2';
        g.fillText(it.label, lx, ly + 18);
        g.restore();
      }
      if (it.hit) {
        const b = hitBox(p, W, H, it.showLabel ? 34 : 0);
        if (b) this.boxes.push({ item: it, ...b });
      }
    }
    if (scene.hand) { // 伸手：手跟著手指
      g.save();
      g.translate(scene.hand.x - 40, scene.hand.y - 20);
      drawShape(g, 'hands', 80, 60, t, {});
      g.restore();
    }
    scene.foreground?.(g, W, H, t);
    if (scene.tint) {
      g.fillStyle = scene.tint;
      g.fillRect(0, 0, W, H);
    }
  }
}
