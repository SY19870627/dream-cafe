// 「坐下來看看」：從選定的座位看出去的 3D 畫面。
// 房間、角落、紙片都用 room3d.js 蓋，跟俯視店面是同一間店、同一套畫師的紙片；這裡多了前牆和天花板。
// 紙片各自轉向鏡頭（第一版座位視角的做法），從側面看才不會變成一條線。
import * as THREE from 'three';
import { seatCells, DOOR } from '../grid.js';
import { buildRoom, buildLayout, disposeGroup, cx, cz } from './room3d.js';
import { faceCamera } from './art3d.js';

const EYE = 1.15; // 坐著的眼睛高度（公尺）

export function openSeatView(root, { layout, item, seatIndex = 0, cat, onClose }) {
  root.hidden = false;
  root.innerHTML = `
    <canvas class="s3-canvas"></canvas>
    <div class="s3-ui">
      <p class="s3-hint">左右滑動轉頭</p>
      <div class="s3-btns">
        ${seatCells(item).length > 1 ? '<button type="button" class="s3-swap">換個位子</button>' : ''}
        <button type="button" class="s3-up primary">站起來</button>
      </div>
    </div>`;
  const canvas = root.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b2420');
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 60);

  const { room, papers: roomPapers } = buildRoom({ front: true, ceiling: true });
  scene.add(room);
  const furn = buildLayout(layout, cat);
  scene.add(furn.group);
  const ownChairs = furn.chairsOf.get(item.uid) || [];
  const papers = [...roomPapers, ...furn.papers];

  /* 鏡頭：坐在座位上。吧台座看吧台；其他座位先看向吧台前那一帶（德叔、吧台、店中間），一坐下就看得到自己的店，
     不會像以前看向角落中心那樣常常只看到牆和窗框。左右滑可以轉頭。 */
  let seat = seatIndex;
  let yaw = 0;
  const pitch = -0.1;
  function placeCamera() {
    const s = seatCells(item)[seat] || seatCells(item)[0];
    ownChairs.forEach((m, i) => { if (m) m.visible = i !== seat; }); // 自己坐的那張椅子不畫（鏡頭就在椅子上）
    const p = new THREE.Vector3(cx(s.x), EYE, cz(s.y));
    camera.position.copy(p);
    let tx;
    let tz;
    if (item.type === 'bar') { tx = cx(s.x); tz = cz(0); } else {
      tx = cx(4.5);
      tz = cz(2.5);
      if (Math.hypot(tx - p.x, tz - p.z) < 1) { tx = cx(DOOR.x); tz = cz(DOOR.y); } // 就坐在吧台旁邊：改看門口
    }
    yaw = Math.atan2(-(tx - p.x), -(tz - p.z));
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
    faceCamera(papers, camera, false); // 紙片轉向這個位子（轉頭時不跟著轉）
  }
  placeCamera();

  function resize() {
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let alive = true;
  let lastFace = 0;
  function loop(now) {
    if (!alive) return;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    // 圖是非同步載進來的：前一秒多轉幾次，載好的紙片才會轉到對的方向、拉到對的高度
    if (now - lastFace > 200) { faceCamera(papers, camera, false); lastFace = now; }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 左右滑轉頭
  let dragX = null;
  canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    yaw += (e.clientX - dragX) * 0.006;
    dragX = e.clientX;
  });
  canvas.addEventListener('pointerup', () => { dragX = null; });
  canvas.addEventListener('pointercancel', () => { dragX = null; });

  const swap = root.querySelector('.s3-swap');
  if (swap) swap.onclick = () => {
    seat = (seat + 1) % seatCells(item).length;
    placeCamera();
    ctl.onSeat?.(seat);
  };

  function close() {
    if (!alive) return;
    alive = false;
    window.removeEventListener('resize', resize);
    disposeGroup(room);
    disposeGroup(furn.group);
    renderer.dispose();
    root.innerHTML = '';
    root.hidden = true;
    onClose?.(seat);
  }
  root.querySelector('.s3-up').onclick = close;

  const ctl = { close, get seat() { return seat; }, onSeat: null, setUpLabel(t) { root.querySelector('.s3-up').textContent = t; }, hideUp(v) { root.querySelector('.s3-up').hidden = v; } };
  return ctl;
}
