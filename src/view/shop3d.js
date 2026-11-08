// 俯視店面（Three.js 斜上方、低 fov）：佈置與營業共用同一個畫面。
// 店面底子沿用第一版的 3D 店（木地板、石灰牆＋紅磚腰牆、窗、吧台、德叔、吊燈、畫師的紙片家具）；
// 這裡只負責畫與「點到了什麼」，佈置、拖放、狀態都在 main.js。
import * as THREE from 'three';
import {
  W, H, DOOR, WINDOW_ROWS, OUTLETS, KEEP_CLEAR, BAR_CELLS, STOOL_CELLS, DECOR, BAR_ITEM, footprint, size, pieceCells, layerOf, cornerLabel,
} from '../grid.js';
import { GUESTS, ACTIONS } from '../sim.js';
import { buildRoom, buildLayout, disposeGroup, CELL, RW, RD, cx, cz, toCell, styleOf } from './room3d.js';
import { paper, setPaperArt, faceCamera, facingOf, PAPER_SPEC } from './art3d.js';

export { styleOf };

// 一般客人沒有專用的圖：先借既有的人物圖（規格書：美術能用既有的就用）。對應：
//   小鎮居民 → 阿公（grandpa）　　獨坐的人 → 予安（yuan）　　帶筆電的人 → 凱文（kevin）
//   觀光客 → 阿哲（zhe）　　結伴來的人 → 阿哲＋予安（第二位左右翻）　　愛貓的人 → 凱文（左右翻，和帶筆電的分開）
// 熟客的故事節點做出來以後，一般客人要換成自己的圖，免得認錯人。
// 坐姿三張：sit（3/4 側面，面向畫面左邊）、sitFront（正對鏡頭）、sitBack（背對鏡頭）；照椅子朝哪邊挑（pickSit）
const SIT = {
  grandpa: { sit: 'char_grandpa_sit', sitFront: 'char_grandpa_sit_front_nostool', sitBack: 'char_grandpa_sit_back' },
  yuan: { sit: 'char_yuan_sit', sitFront: 'char_yuan_sit_front', sitBack: 'char_yuan_sit_back' },
  kevin: { sit: 'char_kevin_sit', sitFront: 'char_kevin_sit_front', sitBack: 'char_kevin_sit_back' },
  zhe: { sit: 'char_zhe_sit', sitFront: 'char_zhe_sit_front', sitBack: 'char_zhe_sit_back' },
};
const GUEST_ART = {
  resident: [{ stand: 'char_grandpa_stand', ...SIT.grandpa }],
  solo: [{ stand: 'char_yuan_stand', ...SIT.yuan }],
  laptop: [{ stand: 'char_kevin_stand', ...SIT.kevin }],
  tourist: [{ stand: 'char_zhe_stand', ...SIT.zhe }],
  pair: [{ stand: 'char_zhe_stand', ...SIT.zhe }, { stand: 'char_yuan_stand', ...SIT.yuan, flip: true }],
  catlover: [{ stand: 'char_kevin_stand', ...SIT.kevin, flip: true }],
};

// 坐下時用哪張、往哪偏、離椅子多遠：
// 正對鏡頭 → sitFront，全身不裁，站在椅子前面一點（蓋住椅面，腿腳交給桌子／沙發前緣遮）；
// 背對鏡頭 → sitBack，屁股線（PAPER_SPEC.seat）以下裁掉、往桌子那邊縮一點，只剩頭肩上背從椅背上方露出來；
// 其他 → 側面 sit，照椅子的 flip／yawOff。吧台（沒有 face）照舊用側面、面向吧台
function pickSit(art, spot, camera, onStool) {
  const side = { name: art.sit, flip: spot && !onStool ? spot.flip : !!art.flip, yawOff: spot && !onStool ? spot.yawOff : 0, dx: 0, dz: onStool ? 0.12 : 0.1, facing: 'side' };
  if (!spot?.face || onStool) return side;
  const f = facingOf(spot.face, camera, true);
  if (f === 'front' && art.sitFront) return { name: art.sitFront, flip: !!art.flip, yawOff: 0, dx: spot.face[0] * 0.1, dz: spot.face[1] * 0.1, facing: 'front' };
  if (f === 'back' && art.sitBack) {
    return { name: art.sitBack, flip: !!art.flip, yawOff: 0, dx: spot.face[0] * 0.05, dz: spot.face[1] * 0.05, facing: 'back', crop: PAPER_SPEC[art.sitBack]?.seat || 0 };
  }
  return side;
}

// 坐下時整張抬／沉多少：圖裡屁股的高度（PAPER_SPEC.seat）對齊椅面（seatH − seat，有正有負）。
// 側面腳看得到，最多沉 0.10（腳踝進地板）；正面腳被桌子遮、背面裁掉了，直接沉到椅面；吧台高腳椅只抬不沉
const SIDE_SINK = -0.1;
function sitLift(pose, spot, onStool) {
  const seat = PAPER_SPEC[pose.name]?.seat;
  if (!seat || !spot?.seatH) return 0;
  const d = spot.seatH - seat;
  if (onStool) return Math.max(0, d);
  return pose.facing === 'side' ? Math.max(SIDE_SINK, d) : d;
}

const ELEV = THREE.MathUtils.degToRad(54); // 鏡頭仰角
const FOV = 30; // 低 fov：接近正投影，格子不會前大後小得太誇張

function cellPlane(x, y, w, h, color, opacity, inset = 0.06, lift = 0.012) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w * CELL - inset, h * CELL - inset),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx(x) + ((w - 1) * CELL) / 2, lift, cz(y) + ((h - 1) * CELL) / 2);
  m.renderOrder = 1;
  return m;
}

// 佔地的外框：四條細邊，不被家具擋住（畫在最上層）
function cellOutline(x, y, w, h, color) {
  const g = new THREE.Group();
  const t = 0.06;
  const x0 = cx(x) - CELL / 2;
  const z0 = cz(y) - CELL / 2;
  const ww = w * CELL;
  const hh = h * CELL;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
  for (const [px, pz, sx, sz] of [[x0 + ww / 2, z0 + t / 2, ww, t], [x0 + ww / 2, z0 + hh - t / 2, ww, t], [x0 + t / 2, z0 + hh / 2, t, hh], [x0 + ww - t / 2, z0 + hh / 2, t, hh]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(px, 0.02, pz);
    m.renderOrder = 6;
    g.add(m);
  }
  return g;
}

// 角落每一格放什麼的小圓牌（椅／桌／書架）：選取時畫在最上層，轉向後一眼看得出換了邊
const PIECE_TEXT = { seat: '椅', table: '桌', shelf: '書架', plant: '綠', player: '唱盤', goods: '櫃' };
const PIECE_BG = { seat: '#fffaf1', table: '#7a4f2e', shelf: '#3f6b5a', plant: '#4f7a45', player: '#2f2a33', goods: '#8a5a3b' };
const PIECE_FG = { seat: '#3a2d22', table: '#fff8ee', shelf: '#fff8ee', plant: '#fff8ee', player: '#fff8ee', goods: '#fff8ee' };
const badgeTex = new Map();
function pieceBadge(x, y, piece) {
  if (!badgeTex.has(piece)) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = PIECE_BG[piece];
    g.strokeStyle = '#e3a85b';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = PIECE_FG[piece];
    const t = PIECE_TEXT[piece];
    g.font = `700 ${t.length > 1 ? 40 : 58}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t, 64, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    badgeTex.set(piece, tex);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL * 0.46, CELL * 0.46),
    new THREE.MeshBasicMaterial({ map: badgeTex.get(piece), transparent: true, depthWrite: false, depthTest: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx(x), 0.03, cz(y) + CELL * 0.18); // 往門口那側挪一點：不跟紙片的腳疊在一起
  m.renderOrder = 7;
  return m;
}

export class ShopView {
  constructor(el) {
    this.el = el;
    el.innerHTML = `
      <div class="s3d">
        <canvas class="s3d-canvas"></canvas>
        <div class="s3d-labels"></div>
        <div class="s3d-actors"></div>
      </div>`;
    this.canvas = el.querySelector('canvas');
    this.labelsEl = el.querySelector('.s3d-labels');
    this.actorsEl = el.querySelector('.s3d-actors');
    this.w = 1;
    this.h = 1;

    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#2b2420');
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);

    const { room, papers } = buildRoom({ front: false });
    this.scene.add(room);
    this.roomPapers = papers;
    this.roomPick = [];
    room.traverse((o) => { if (o.userData.uid) this.roomPick.push(o); });

    this.furniture = null; // buildLayout() 的結果
    this.furnKey = '';
    this.marks = new THREE.Group(); // 每次 render 重畫：選取、堵住、放不下
    this.scene.add(this.marks);
    this.ghost = null;
    this.pulse = null;
    this.mode = 'setup';
    this.guides = this.buildGuides(); // 格線、靠窗／插座、門口與吧台前要留空
    this.scene.add(this.guides);

    this.guests = new Map(); // gid → { paper, el, last }
    this.guestGroup = new THREE.Group();
    this.scene.add(this.guestGroup);
    this.groupFirst = new Map();
    this.labels = [];

    this.ray = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const loop = (now) => {
      requestAnimationFrame(loop);
      const seat = document.getElementById('seat');
      if (seat && !seat.hidden) return; // 坐下來看看的時候不用畫俯視
      faceCamera(this.roomPapers, this.camera, true);
      if (this.furniture) faceCamera(this.furniture.papers, this.camera, true);
      faceCamera([...this.guests.values()].map((g) => g.paper), this.camera, true);
      this.fadeOccluders();
      if (this.pulse) this.pulse.material.opacity = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(now / 160));
      // 選取中的佔地：慢慢呼吸；剛放下、剛轉向時快閃一陣，整組一眼找得到
      if (this.selFill) {
        const flashing = now < this.flashUntil;
        const k = 0.5 + 0.5 * Math.sin(now / (flashing ? 90 : 420));
        this.selFill.material.opacity = flashing ? 0.3 + 0.55 * k : 0.42 + 0.18 * k;
        const s = flashing ? 1 + 0.06 * k : 1;
        this.selFill.scale.set(s, s, 1);
      }
      renderer.render(this.scene, this.camera);
      this.placeLabels();
    };
    requestAnimationFrame(loop);
  }

  // 高的紙片（盆栽、小燈、書架、貓跳台…）在俯視時擋到後面的椅子或客人：那一張慢慢變半透明，沒擋到就慢慢回來
  fadeOccluders() {
    const occ = this.furniture?.occluders;
    if (!occ?.length) return;
    const targets = [];
    for (const list of this.furniture.chairsOf.values()) for (const c of list) if (c?.userData.size) targets.push(c);
    for (const g of this.guests.values()) if (g.paper.visible && g.paper.userData.size) targets.push(g.paper);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const o of occ) {
      const s = o.userData.size;
      const m = o.userData.mesh.material;
      if (!s || m.userData.faded) continue; // 拖曳中的那件另外處理
      o.getWorldPosition(a);
      const foot = this.project(a);
      const top = this.project(b.set(a.x, s.h * 1.15, a.z));
      const left = this.project(b.set(a.x - s.w / 2, 0, a.z)).x;
      const right = this.project(b.set(a.x + s.w / 2, 0, a.z)).x;
      let hide = false;
      for (const t of targets) {
        t.getWorldPosition(b);
        if (b.z >= a.z - 0.05) continue; // 在它前面（離鏡頭比較近）的不算
        const p = this.project(b.setY((t.userData.size.h || 0.8) * 0.5));
        if (p.x > left && p.x < right && p.y > top.y && p.y < foot.y) { hide = true; break; }
      }
      const want = hide ? 0.5 : 1;
      if (Math.abs(m.opacity - want) > 0.01) m.opacity += (want - m.opacity) * 0.2;
      else m.opacity = want;
    }
  }

  /* ---------- 版面 ---------- */
  fit(w, h) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.fitCamera();
  }

  // 把整間店（地板四角＋後牆上緣）放進畫面，垂直置中
  fitCamera() {
    const cam = this.camera;
    cam.aspect = this.w / this.h;
    cam.updateProjectionMatrix();
    const dir = new THREE.Vector3(0, Math.sin(ELEV), Math.cos(ELEV));
    const pts = [];
    for (const x of [-RW / 2, RW / 2]) {
      pts.push(new THREE.Vector3(x, 0, -RD / 2), new THREE.Vector3(x, 0, RD / 2 + 0.12), new THREE.Vector3(x, 2.1, -RD / 2));
    }
    const look = new THREE.Vector3(0, 0.3, 0.2);
    const v = new THREE.Vector3();
    const place = (d) => {
      cam.position.copy(look).addScaledVector(dir, d);
      cam.lookAt(look);
      cam.updateMatrixWorld();
    };
    const extent = () => {
      const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
      for (const p of pts) {
        v.copy(p).project(cam);
        r.x0 = Math.min(r.x0, v.x); r.x1 = Math.max(r.x1, v.x);
        r.y0 = Math.min(r.y0, v.y); r.y1 = Math.max(r.y1, v.y);
      }
      return r;
    };
    let d = 20;
    for (let k = 0; k < 3; k++) {
      let lo = 2;
      let hi = 80;
      for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2;
        place(mid);
        const r = extent();
        if (Math.max(-r.x0, r.x1, -r.y0, r.y1) <= 0.97) hi = mid; else lo = mid;
      }
      d = hi;
      place(d);
      const r = extent();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      look.addScaledVector(up, ((r.y0 + r.y1) / 2) * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    }
    place(d);
  }

  /* ---------- 佈置的輔助線（只在佈置時看得到） ---------- */
  buildGuides() {
    const g = new THREE.Group();
    const pts = [];
    for (let x = 0; x <= W; x++) pts.push(new THREE.Vector3(x * CELL - RW / 2, 0.01, -RD / 2), new THREE.Vector3(x * CELL - RW / 2, 0.01, RD / 2));
    for (let y = 0; y <= H; y++) pts.push(new THREE.Vector3(-RW / 2, 0.01, y * CELL - RD / 2), new THREE.Vector3(RW / 2, 0.01, y * CELL - RD / 2));
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#3a2618', transparent: true, opacity: 0.28, depthWrite: false }));
    g.add(lines);
    // 靠窗的那一排（窗邊雙人座要碰到）：淡藍
    for (const y of WINDOW_ROWS) g.add(cellPlane(0, y, 1, 1, '#9fd0e6', 0.2, 0.04));
    // 插座那一格（工作桌要碰到）：淡黃
    for (const o of OUTLETS) g.add(cellPlane(o.x, o.y, 1, 1, '#ffd36b', 0.3, 0.04));
    // 門口內側、吧台前：要留空
    for (const k of KEEP_CLEAR) g.add(cellPlane(k.x, k.y, 1, 1, '#ffffff', 0.22, 0.1));
    return g;
  }

  /* ---------- 畫店面 ---------- */
  // 剛放下、剛轉向：選取的佔地快閃一陣
  flash(ms = 1400) {
    this.flashUntil = performance.now() + ms;
  }

  // state：{ layout, validation, selected, spot, hint, mode, cat, dragging }
  // hint：點了下方角落列時，這種東西放得下的格子
  render({ layout, validation, selected, spot, hint, mode, cat, dragging }) {
    this.mode = mode;
    const key = JSON.stringify([layout.items, cat]);
    if (key !== this.furnKey) {
      this.furnKey = key;
      if (this.furniture) {
        this.scene.remove(this.furniture.group);
        disposeGroup(this.furniture.group);
      }
      this.furniture = buildLayout(layout, cat, { catScale: 1.5 });
      this.scene.add(this.furniture.group);
      this.pickables = [];
      this.furniture.group.traverse((o) => { if (o.userData.uid) this.pickables.push(o); });
    }
    // 拖曳中的那一件變淡
    for (const o of this.pickables) {
      if (!o.material) continue;
      const fade = !!dragging && o.userData.uid === dragging;
      for (const m of [].concat(o.material)) {
        if (!!m.userData.faded === fade) continue;
        m.userData.faded = fade;
        m.userData.wasTransparent ??= m.transparent;
        m.opacity = fade ? 0.3 : 1;
        m.transparent = fade || m.userData.wasTransparent;
        m.needsUpdate = true;
      }
    }

    const setup = mode === 'setup';
    this.guides.visible = setup;
    for (const m of this.marks.children.slice()) {
      this.marks.remove(m);
      if (m !== this.ghost) disposeGroup(m); // 拖曳的影子下面會再放回去
    }
    this.pulse = null;
    this.selFill = null;
    if (setup) {
      for (const c of validation?.stuck || []) this.marks.add(cellPlane(c.x, c.y, 1, 1, '#d2402c', 0.4, 0.04));
      const bad = new Set([...(validation?.problems || []).map((p) => p.uid), ...(validation?.unreachable || [])]);
      for (const it of layout.items) {
        if (!bad.has(it.uid)) continue;
        const s = size(it);
        this.marks.add(cellPlane(it.x, it.y, s.w, s.h, '#d2402c', 0.42, 0.04, 0.014));
      }
      for (const c of hint || []) this.marks.add(cellPlane(c.x, c.y, 1, 1, '#8fe08a', 0.42, 0.12, 0.015));
      const sel = selected === 'bar' ? BAR_ITEM : layout.items.find((i) => i.uid === selected);
      if (sel) {
        // 琥珀色的佔地＋不會被家具擋住的外框＋每格放什麼
        const s = size(sel);
        this.selFill = cellPlane(sel.x, sel.y, s.w, s.h, '#ffbf4d', 0.5, 0.02, 0.016);
        this.marks.add(this.selFill);
        this.marks.add(cellOutline(sel.x, sel.y, s.w, s.h, '#ffcf6b'));
        for (const p of pieceCells(sel)) this.marks.add(pieceBadge(p.x, p.y, p.piece));
      }
      if (spot) {
        this.marks.add(cellPlane(spot.x, spot.y, 1, 1, '#e3a85b', 0.6, 0.02, 0.016));
        this.marks.add(cellOutline(spot.x, spot.y, 1, 1, '#ffcf6b'));
      }
    }
    if (this.pulseUid === 'bar') {
      this.pulse = cellPlane(4, 0, 3, 3, '#e3a85b', 0.3, 0.02, 0.016);
      this.marks.add(this.pulse);
    }
    if (this.ghost) this.marks.add(this.ghost);
    this.renderLabels(setup ? layout : null, selected);
  }

  // 佈置時的小名牌：每個角落（角落・款式）一直都有；擺飾只在選取時有。
  // 貼在佔地靠門口那一邊的地上，不蓋在家具上；名牌不吃點擊（.s3d-labels 是 pointer-events: none）
  renderLabels(layout, selected) {
    this.labelsEl.innerHTML = '';
    this.labels = [];
    if (!layout) return;
    for (const it of layout.items) {
      const isSel = selected === it.uid;
      if (it.kind !== 'corner' && !isSel) continue;
      const fp = footprint(it);
      const pos = new THREE.Vector3(
        fp.reduce((a, q) => a + cx(q.x), 0) / fp.length, 0,
        cz(Math.max(...fp.map((q) => q.y))) + CELL / 2,
      );
      const el = document.createElement('span');
      el.className = `s3d-label${isSel ? ' sel' : ''}`;
      el.textContent = it.kind === 'corner' ? cornerLabel(it) : DECOR[it.type].name;
      this.labelsEl.appendChild(el);
      this.labels.push({ el, pos });
    }
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.w, y: ((1 - p.y) / 2) * this.h };
  }

  placeLabels() {
    for (const l of this.labels) {
      const p = this.project(l.pos);
      l.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, 2px)`;
    }
    for (const g of this.guests.values()) {
      if (g.el.hidden || !g.paper.userData.size) continue;
      const foot = g.paper.position;
      const h = g.paper.userData.size.h;
      const a = this.project(foot);
      const b = this.project(new THREE.Vector3(foot.x, h, foot.z));
      const top = Math.min(a.y, b.y);
      const hh = Math.max(44, a.y - top);
      const ww = Math.max(44, hh * 0.45);
      g.el.style.transform = `translate(${a.x - ww / 2}px, ${a.y - hh}px)`;
      g.el.style.width = `${ww}px`;
      g.el.style.height = `${hh}px`;
    }
  }

  // 開場「先坐。」：吧台座一閃一閃
  setPulse(uid) {
    this.pulseUid = uid;
  }

  // 拖曳中的影子：綠色可以放、紅色放不下
  showGhost(item, ok) {
    this.hideGhost();
    const s = size(item);
    this.ghost = cellPlane(item.x, item.y, s.w, s.h, ok ? '#3d8a4a' : '#d2402c', 0.5, 0.04, 0.02);
    this.marks.add(this.ghost);
  }

  hideGhost() {
    if (!this.ghost) return;
    this.marks.remove(this.ghost);
    disposeGroup(this.ghost);
    this.ghost = null;
  }

  // 格子中心在螢幕上的位置（自動化測試點格子用）
  cellToClient(x, y) {
    const r = this.canvas.getBoundingClientRect();
    const p = this.project(new THREE.Vector3(cx(x), 0, cz(y)));
    return { x: r.left + p.x, y: r.top + p.y };
  }

  /* ---------- 點到了什麼 ---------- */
  ndc(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  // 螢幕座標 → 地板上的格子座標（小數）；不在店面裡回傳 null
  pointToCell(clientX, clientY, allowOutside = false) {
    const r = this.canvas.getBoundingClientRect();
    if (!allowOutside && (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom)) return null;
    this.ray.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hit = this.ray.ray.intersectPlane(this.floorPlane, new THREE.Vector3());
    if (!hit) return null;
    const c = toCell(hit.x, hit.z);
    if (!allowOutside && (c.fx < 0 || c.fy < 0 || c.fx >= W || c.fy >= H)) return null;
    return c;
  }

  // 點到哪一件（uid），或地板上的哪一格：{ uid } | { cell } | null
  pick(clientX, clientY, layout) {
    const p = this.pointToCell(clientX, clientY);
    if (p) {
      const cell = { x: Math.floor(p.fx), y: Math.floor(p.fy) };
      const on = (list) => list.some((q) => q.x === cell.x && q.y === cell.y);
      if (on(BAR_CELLS) || on(STOOL_CELLS)) return { uid: 'bar', cell };
      // 同一格可能疊著：家具優先，再來掛牆上的，地毯最後
      const order = { solid: 0, wall: 1, rug: 2 };
      const it = layout.items.filter((i) => on(footprint(i))).sort((p, q) => order[layerOf(p)] - order[layerOf(q)])[0];
      if (it) return { uid: it.uid, cell };
    }
    // 地板上沒有東西：看是不是點到立著的紙片（椅背、書架、德叔）
    this.ray.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hits = this.ray.intersectObjects([...(this.pickables || []), ...this.roomPick], false);
    for (const h of hits) {
      let o = h.object;
      let vis = true;
      while (o) { if (!o.visible) vis = false; o = o.parent; }
      if (vis && h.object.userData.uid) return { uid: h.object.userData.uid, cell: p ? { x: Math.floor(p.fx), y: Math.floor(p.fy) } : null };
    }
    if (p) return { cell: { x: Math.floor(p.fx), y: Math.floor(p.fy) } };
    return null;
  }

  /* ---------- 營業：客人 ---------- */
  clearGuests() {
    for (const g of this.guests.values()) {
      this.guestGroup.remove(g.paper);
      disposeGroup(g.paper);
      g.el.remove();
    }
    this.guests.clear();
    this.groupFirst.clear();
  }

  // 依模擬時間 t 擺客人的位置
  renderGuests(guests, t, onTap) {
    for (const g of guests) {
      const pos = guestPos(g, t);
      let v = this.guests.get(g.gid);
      if (!pos) {
        if (v) { v.paper.visible = false; v.el.hidden = true; }
        continue;
      }
      if (!v) {
        if (!this.groupFirst.has(g.groupId)) this.groupFirst.set(g.groupId, g.gid);
        const list = GUEST_ART[g.type] || GUEST_ART.resident;
        const art = list[(g.gid - this.groupFirst.get(g.groupId)) % list.length];
        const p = paper(art.stand, { flip: !!art.flip });
        p.userData.art = art.stand;
        this.guestGroup.add(p);
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'guest';
        el.setAttribute('aria-label', GUESTS[g.type].name);
        el.innerHTML = `<i class="bub"></i><span class="tag">${GUESTS[g.type].short}</span>`;
        el.onclick = () => onTap?.(g);
        this.actorsEl.appendChild(el);
        v = { paper: p, el, art, lastX: pos.x, face: !!art.flip };
        this.guests.set(g.gid, v);
      }
      v.paper.visible = true;
      v.el.hidden = false;
      const sit = pos.state === 'sit';
      // 走路時看往哪邊走：圖是面向畫面左邊的，往右走就左右翻
      if (!sit && Math.abs(pos.x - v.lastX) > 0.01) v.face = pos.x > v.lastX ? !v.art.flip : !!v.art.flip;
      v.lastX = pos.x;
      const onStool = sit && g.cornerType === 'bar';
      // 坐下：坐在拉近桌子的那張椅子上；照椅子從鏡頭看是正對、背對還是側面，挑正面／背面／側面坐姿（吧台照舊側面、面向吧台）
      const spot = sit ? this.furniture?.spotsOf.get(g.corner)?.[g.seatIndex] : null;
      const pose = sit ? pickSit(v.art, spot, this.camera, onStool) : { name: v.art.stand, flip: v.face, yawOff: 0, dx: 0, dz: 0 };
      setPaperArt(v.paper, pose.name, { flip: pose.flip, crop: pose.crop });
      v.paper.userData.yawOff = pose.yawOff;
      v.paper.userData.pose = sit ? pose.name : ''; // 驗收腳本看客人用了哪張坐姿
      const bx = spot ? spot.x : cx(pos.x);
      const bz = spot ? spot.z : cz(pos.y);
      v.paper.position.set(bx + pose.dx, 0, bz + pose.dz);
      v.paper.userData.mesh.position.y = sit ? sitLift(pose, spot, onStool) : 0;
      // 頭上的小圖示（點了什麼、在做什麼）
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
    }
  }
}

// 客人在時間 t 的位置（格子座標，整數就是那一格）；不在店裡回傳 null
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
