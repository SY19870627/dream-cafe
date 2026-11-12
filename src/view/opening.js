// 開場的 DOM 畫面（劇本 v3.8 第一幕到第四幕）：
//   showOpening()：16:49 的辦公室 → 標題 → 信箱 → 信（整幕自己處理，換幕時呼叫 api.go）
//   showScene()：三合院外（傍晚／晚上）、黑路、岔路、工寮與土地公廟、庭埕與護龍房間、待續。
//     這些畫面的字由閱讀框（view/reader.js）一句一句出；畫面只負責「第 i 句時長什麼樣子」與互動關卡（推門、發動、按住騎、岔路、掉頭、點床）。
// 字全部來自 src/lines/opening.js。畫師原圖只讀不改（不重新壓縮、不縮圖）；夜路的路面是程式繪製，路上照到的東西用畫師原圖。
import { RESIGNATIONS, RESIGNATION_MAIL, LETTER, OFFICE, TITLE, MAILBOX, ROAD, DEPART, TEMPLE } from '../lines/opening.js';
import { play, setEngine } from './audio.js';
import { img, ready } from './art.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const art = (name) => `assets/art/${name}.webp`;

export const HOLD_MS = 1500; // 按住騎多久翻到下一句
export const DOOR_DRAG = 140; // 推門：拖多遠算推到底（推到 75% 才開）

function makeStage(root) {
  root.hidden = false;
  const token = (root._token = (root._token || 0) + 1);
  const alive = () => root._token === token;
  const stage = (name, html) => {
    for (const old of root.querySelectorAll('.op-stage')) { old.classList.remove('on'); setTimeout(() => old.remove(), 700); }
    const el = document.createElement('section');
    el.className = `op-stage op-${name}`;
    el.innerHTML = html;
    root.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    return el;
  };
  return { alive, stage };
}

/* ====================== 第一幕～第二幕（整幕自己處理） ====================== */
// root：#opening；act：目前這一幕；api：{ state, go(act)（存檔並換幕）, persist() }
export function showOpening(root, act, api) {
  const { alive, stage } = makeStage(root);

  if (act === 'office') {
    const m = RESIGNATION_MAIL;
    const el = stage('office', `
      <div class="op-clock">${OFFICE.clock}</div>
      <div class="op-monitor"><div class="op-mail">
        <div class="op-mail-head"><span>${OFFICE.to}${esc(m.to)}</span><span>${OFFICE.subject}${esc(m.subject)}</span></div>
        ${m.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        <p class="op-ending"><span class="op-ending-text"></span><span class="caret"></span></p>
        <p class="op-sign">${esc(OFFICE.signature)}</p>
      </div></div>
      <p class="op-q">${OFFICE.question}</p>
      <div class="op-choices">${RESIGNATIONS.map((r) => `<button type="button" data-id="${r.id}" aria-pressed="false">${esc(r.text)}</button>`).join('')}</div>
      <button type="button" id="op-send" class="primary" disabled>${OFFICE.send}</button>
      <div class="op-keys" aria-hidden="true">${OFFICE.keys}</div>`);
    let choice = null;
    let typing = 0;
    const send = el.querySelector('#op-send');
    const target = el.querySelector('.op-ending-text');
    const typeOut = async (text) => {
      const my = ++typing;
      target.textContent = '';
      for (const ch of text) {
        if (my !== typing || !alive()) return;
        target.textContent += ch;
        if (ch.trim()) play('key');
        await sleep(55 + Math.random() * 45);
      }
    };
    for (const b of el.querySelectorAll('.op-choices button')) {
      b.onclick = () => {
        choice = b.dataset.id;
        for (const o of el.querySelectorAll('.op-choices button')) o.setAttribute('aria-pressed', String(o === b));
        typeOut(b.textContent);
        send.disabled = false;
      };
    }
    send.onclick = async () => {
      if (!choice || send.disabled) return; // 沒選結尾不能送出
      typing++;
      target.textContent = RESIGNATIONS.find((r) => r.id === choice)?.text || '';
      play('send');
      api.state.opening.resignation = choice;
      api.persist();
      send.disabled = true;
      for (const b of el.querySelectorAll('.op-choices button')) b.disabled = true;
      const clock = el.querySelector('.op-clock');
      clock.classList.add('flip');
      await sleep(250);
      if (!alive()) return;
      clock.textContent = OFFICE.clockAfter;
      await sleep(1100);
      if (alive()) api.go('title');
    };
    return;
  }

  if (act === 'title') {
    const el = stage('title', `
      <h1>${TITLE.lines.map(esc).join('<br>')}</h1>
      <p class="sub">${TITLE.sub}</p>
      <button type="button" id="op-next" class="primary">${TITLE.next}</button>
      <div class="op-credit">${TITLE.credit}・${TITLE.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.text}</a>`).join('・')}</div>`);
    el.querySelector('#op-next').onclick = () => api.go('mailbox');
    return;
  }

  if (act === 'mailbox') {
    const el = stage('mailbox', `
      <p class="op-caption" id="op-cap">${MAILBOX.caption}</p>
      <button type="button" class="op-box-btn" id="op-env"><img src="${art('scene_mailboxes')}" alt="${MAILBOX.artLabel}"><span class="op-box-label">${MAILBOX.boxLabel}</span></button>
      <p class="op-caption" id="op-tap">${MAILBOX.tap}</p>`);
    el.querySelector('#op-env').onclick = async (ev) => {
      const btn = ev.currentTarget;
      if (btn.disabled) return; // 只能點一次
      btn.disabled = true;
      btn.classList.add('shake');
      play('keys');
      el.querySelector('#op-cap').textContent = MAILBOX.shaken;
      el.querySelector('#op-tap').remove();
      await sleep(1300);
      if (alive()) api.go('letter');
    };
    return;
  }

  if (act === 'letter') {
    const L = LETTER;
    const el = stage('mailbox reading', `
      <article class="op-letter" aria-label="${L.title}">
        <h2>${L.title}</h2>
        <p>${esc(L.greeting)}</p>
        ${L.paragraphs.map((p) => `<p class="indent">${esc(p)}</p>`).join('')}
        <p class="indent op-letter-close">${esc(L.closing)}</p>
        <p class="op-letter-sign">${esc(L.signature)}</p>
        <button type="button" class="op-attach" id="op-attach"><svg width="40" height="18" viewBox="0 0 44 20" aria-hidden="true"><circle cx="9" cy="10" r="7" fill="none" stroke="#8a6d3b" stroke-width="3"/><path d="M16 10h26M34 10v6M39 10v5" stroke="#8a6d3b" stroke-width="3" fill="none"/></svg>${L.attachment}</button>
      </article>
      <p class="op-caption op-after">${esc(L.after)}</p>
      <button type="button" id="op-next" class="primary">${MAILBOX.next}</button>
      <div class="op-keyshot" id="op-keyshot" hidden aria-hidden="true">
        <div class="op-keyshot-in"><img class="env" src="${art('envelope')}" alt=""><img class="key" src="${art('key')}" alt=""></div>
      </div>`);
    // 可選：點附件，鑰匙從信封滑出來的特寫（不點也能出發）
    const shot = el.querySelector('#op-keyshot');
    el.querySelector('#op-attach').onclick = () => {
      shot.hidden = false;
      shot.classList.remove('play');
      void shot.offsetWidth;
      shot.classList.add('play');
      play('keys');
    };
    shot.onclick = () => { shot.hidden = true; };
    el.querySelector('#op-next').onclick = () => api.go('road');
  }
}

/* ====================== 第三幕～第四幕的畫面 ====================== */
// 回傳 { beat(i, look), gate(name) → Promise<boolean>, hot(name) → 熱點目標元素, stop() }
// look：sceneAt() 算出來的「這一句時的樣子」
export function showScene(root, act, api) {
  const { alive, stage } = makeStage(root);
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => alive() && fn(), ms); timers.push(id); return id; };
  let stopFns = [];
  const ctl = { beat() {}, gate: async () => false, hot: () => null, stop() { timers.forEach(clearTimeout); stopFns.forEach((f) => f()); stopFns = []; } };

  /* ---------- 三合院外：傍晚（road）、晚上發動（depart）、晚上回來（return） ---------- */
  if (act === 'road' || act === 'depart' || act === 'return') {
    const night = act !== 'road';
    const el = stage(`yard${night ? ' night' : ''}${act === 'depart' ? ' no-box' : ''}`, `
      <div class="op-art">
        <img class="op-art-img" src="${art(night ? 'scene_v3b_sanheyuan_night' : 'scene_v3b_sanheyuan_dusk')}" alt="">
        <div class="op-glow door"></div>
        <div class="op-scooter" aria-hidden="true">
          <img class="off" src="${art('prop_v3b_scooter_off')}" alt="">
          ${act === 'depart' ? `<img class="on" src="${art('prop_v3b_scooter_on')}" alt=""><img class="beam" src="${art('prop_v3b_scooter_beam')}" alt="">` : ''}
        </div>
        ${act === 'depart' ? '' : `<img class="op-step-cat${act === 'return' ? ' flip' : ''}" src="${art('cat_longan_sleep')}" alt="">`}
        <div class="op-door-wrap" hidden>
          <div class="op-door" id="op-door" role="button" tabindex="0" aria-label="${ROAD.door}">
            <div class="op-door-panel"><span class="op-door-knob"></span><span class="op-door-text">${ROAD.door}</span></div>
          </div>
        </div>
      </div>
      <div class="op-card" ${act === 'road' && api.state.opening.line === 0 && !api.resumed ? '' : 'hidden'}><p>${esc(ROAD.card)}</p></div>
      ${act === 'depart' ? `<button type="button" class="primary op-start" id="op-start">${DEPART.start}</button>` : ''}
`);
    const doorWrap = el.querySelector('.op-door-wrap');
    ctl.intro = async () => { // 傍晚，東山。（機車引擎聲，熄火）
      const card = el.querySelector('.op-card');
      if (card.hidden) return true;
      play('engineStart');
      await sleep(1700);
      if (!alive()) return false;
      play('engineOff');
      await sleep(900);
      if (!alive()) return false;
      card.classList.add('out');
      await sleep(800);
      card.hidden = true;
      return alive();
    };
    ctl.beat = (i, look) => {
      el.classList.toggle('lit', !!look.doorOpen);
      doorWrap.hidden = !(act !== 'depart' && (look.doorOpen || ctl.atDoor));
      if (look.doorOpen) el.querySelector('#op-door').classList.add('open');
    };
    ctl.gate = (name) => {
      if (name === 'door') {
        ctl.atDoor = true;
        doorWrap.hidden = false;
        return new Promise((res) => pushDoor(el.querySelector('#op-door'), () => {
          el.classList.add('lit');
          later(() => res(true), 650);
        }));
      }
      if (name === 'start') {
        return new Promise((res) => {
          const btn = el.querySelector('#op-start');
          btn.onclick = async () => {
            if (btn.disabled) return;
            btn.disabled = true;
            play('engineStart');
            el.classList.add('beam'); // 車燈亮起來
            await sleep(1500);
            res(alive());
          };
        });
      }
      return Promise.resolve(false);
    };
    return ctl;
  }

  /* ---------- 黑路、岔路、工寮與土地公廟（canvas：只有車燈照出來的一小塊路面） ---------- */
  if (act === 'ride' || act === 'fork' || act === 'temple') {
    const el = stage('night-road', `
      <canvas class="op-road-cv" aria-hidden="true"></canvas>
      <div class="op-hold" hidden aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="bg"/><circle cx="32" cy="32" r="26" class="fg"/><path d="M26 22 L40 32 L26 42" class="arrow"/></svg></div>
      <button type="button" class="op-fork left" hidden aria-label="左邊的路"><span aria-hidden="true">‹</span></button>
      <button type="button" class="op-fork right" hidden aria-label="右邊的路"><span aria-hidden="true">›</span></button>
      ${act === 'temple' ? `<button type="button" class="primary op-turnback" id="op-turnback" hidden>${TEMPLE.back}</button>` : ''}`);
    const road = nightRoad(el.querySelector('.op-road-cv'), { fork: act === 'fork', side: api.state.opening.fork });
    stopFns.push(() => road.stop());
    // 遠處的狗叫，偶爾一聲
    const bark = () => { play('dog'); later(bark, 7000 + Math.random() * 9000); };
    later(bark, 2500 + Math.random() * 3000);
    ctl.beat = (i, look) => { road.sight(look.sight || null); };
    ctl.gate = (name) => {
      if (name === 'hold') return holdToRide(el, road, stopFns);
      if (name === 'fork') {
        return new Promise((res) => {
          const btns = el.querySelectorAll('.op-fork');
          for (const b of btns) {
            b.hidden = false;
            b.onclick = async () => {
              const side = b.classList.contains('left') ? 'left' : 'right';
              for (const o of btns) { o.disabled = true; o.classList.toggle('picked', o === b); }
              if (!api.chooseFork(side)) { res(false); return; }
              play('rev');
              setEngine(0.8);
              await road.turn(side);
              res(alive());
            };
          }
        });
      }
      if (name === 'turnback') {
        return new Promise((res) => {
          const btn = el.querySelector('#op-turnback');
          btn.hidden = false;
          btn.onclick = async () => {
            if (btn.disabled) return;
            btn.disabled = true;
            play('rev');
            setEngine(0.7);
            await road.uturn(); // 車燈掃過路邊轉半圈
            res(alive());
          };
        });
      }
      return Promise.resolve(false);
    };
    return ctl;
  }

  /* ---------- 庭埕（晚上）→ 護龍的房間 ---------- */
  if (act === 'room') {
    const el = stage('room-act', `
      <div class="op-yardnight"><div class="op-art">
        <img class="op-art-img" src="${art('scene_v3b_courtyard_night')}" alt="">
        <img class="op-yn-cat" src="${art('cat_longan_sit')}" alt="">
      </div></div>
      <div class="op-room"><div class="op-art">
        <img class="op-art-img" src="${art('scene_v3b_room_night')}" alt="">
        <img class="op-rm-key" src="${art('key')}" alt="">
        <div class="op-rm-bed" id="op-bed"></div>
      </div></div>`);
    ctl.beat = (i, look) => {
      el.classList.toggle('in-room', look.place === 'room');
      if (look.lying) el.classList.add('lying');
    };
    ctl.hot = (name) => (name === 'bed' ? el.querySelector('#op-bed') : null);
    ctl.lieDown = () => { el.classList.add('lying'); play('creak'); return sleep(900); };
    return ctl;
  }

  /* ---------- 待續 ---------- */
  if (act === 'end') {
    const el = stage('end', `
      <div class="op-end-lamp" aria-hidden="true"></div>
      <p class="op-end-title">待續</p>
      <button type="button" class="op-end-again" id="op-again">從開頭再看一次</button>`);
    el.querySelector('#op-again').onclick = () => api.restart();
    return ctl;
  }
  return ctl;
}

// 進門：拖曳推門，門推開才有門聲與風鈴（與第一次相同）。點一下門只會晃一下，不會開。門沒有鎖。
export function pushDoor(door, onOpen) {
  const panel = door.querySelector('.op-door-panel');
  door.classList.remove('open');
  let start = null;
  let opened = false;
  const set = (k) => { panel.style.transform = `perspective(600px) rotateY(${-k * 75}deg)`; };
  set(0);
  const open = () => {
    if (opened) return;
    opened = true;
    set(1);
    play('door');
    play('bell');
    door.classList.add('open');
    setTimeout(onOpen, 900);
  };
  door.onpointerdown = (e) => {
    if (opened) return;
    door.setPointerCapture?.(e.pointerId);
    start = { x: e.clientX, y: e.clientY };
    panel.style.transition = 'none';
  };
  door.onpointermove = (e) => {
    if (!start || opened) return;
    const d = Math.max(Math.abs(e.clientX - start.x), start.y - e.clientY, 0);
    const k = Math.min(1, d / DOOR_DRAG);
    set(k * 0.8);
    if (k >= 0.75) { start = null; panel.style.transition = ''; open(); }
  };
  const release = () => {
    if (!start || opened) return;
    start = null;
    panel.style.transition = '';
    set(0);
    door.classList.remove('nudge');
    void door.offsetWidth;
    door.classList.add('nudge'); // 推不夠：門晃一下回來
  };
  door.onpointerup = release;
  door.onpointercancel = release;
  door.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
}

// 按住畫面往前騎：路面往前捲、引擎轉速上來；放開就停、引擎怠速。累積按住 HOLD_MS 翻下一句。
function holdToRide(el, road, stopFns) {
  const ring = el.querySelector('.op-hold');
  const fg = ring.querySelector('.fg');
  // 按住的狀態掛在畫面上（不跟著句子重來）：手一直按著，翻到下一句也繼續騎；放開才停
  if (!el._hold) {
    const hold = (el._hold = { down: false, last: 0 });
    const press = (e) => {
      if (e.button > 0 || hold.down) return;
      e.preventDefault();
      if (e.pointerId != null) el.setPointerCapture?.(e.pointerId);
      hold.down = true;
      hold.last = performance.now();
      road.go(true);
      setEngine(1);
      ring.classList.add('down');
    };
    const lift = () => {
      if (!hold.down) return;
      hold.down = false;
      road.go(false); // 放開就停在原地
      setEngine(0); // 引擎怠速
      ring.classList.remove('down');
    };
    const key = (e) => { // 鍵盤：按住 Enter／Space／↑ 也能騎
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      if (e.type === 'keydown' && !e.repeat) press({ button: 0, preventDefault() {}, pointerId: null });
      if (e.type === 'keyup') lift();
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
    addEventListener('keydown', key);
    addEventListener('keyup', key);
    stopFns.push(() => { removeEventListener('keydown', key); removeEventListener('keyup', key); });
  }
  const hold = el._hold;
  ring.hidden = false;
  return new Promise((res) => {
    let held = 0;
    let raf = 0;
    const tick = (now) => {
      if (!el.isConnected) return;
      if (hold.down) { held += now - hold.last; hold.last = now; }
      fg.style.strokeDashoffset = String(163.4 * (1 - Math.min(1, held / HOLD_MS)));
      if (held >= HOLD_MS) { cancelAnimationFrame(raf); res(true); return; }
      raf = requestAnimationFrame(tick);
    };
    hold.last = performance.now();
    raf = requestAnimationFrame(tick);
  });
}

// 車燈照到的東西（畫師透明底原圖）：z＝站在路上多遠（0 腳下～1 遠處）；w＝寬佔畫面寬；dx＝離路中線（佔畫面寬）；
// ax、ay＝圖上哪一點落在路面上（底部中心，依原圖的不透明範圍）
const SIGHTS = {
  hut: { src: 'prop_v3b_iron_shed_night', z: 0.42, w: 0.56, dx: 0, ax: 0.5, ay: 727 / 768 }, // 路的盡頭，正面被車燈照到
  temple: { src: 'prop_v3b_tudigong_night', z: 0.5, w: 0.4, dx: 0.2, ax: 525 / 1024, ay: 945 / 1024 }, // 路邊的小廟
};
// 原圖不改：畫到另一張畫布上，再把上半部壓暗一點（車燈從下面照上去，越高越暗）
const litCache = new Map();
function litSprite(name) {
  if (litCache.has(name)) return litCache.get(name);
  const im = img(SIGHTS[name].src);
  if (!ready(im)) return null;
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const dim = g.createLinearGradient(0, 0, 0, c.height);
  dim.addColorStop(0, 'rgba(4,6,10,.5)');
  dim.addColorStop(0.55, 'rgba(4,6,10,.12)');
  dim.addColorStop(1, 'rgba(4,6,10,0)');
  g.fillStyle = dim;
  g.fillRect(0, 0, c.width, c.height);
  litCache.set(name, c);
  return c;
}

// 夜路（程式繪製）：黑底、車燈照出的一小塊柏油、中線、路邊的草；fork＝前面分成左右兩條；sight＝車燈照到的東西（畫師原圖）
function nightRoad(cv, { fork = false, side = null } = {}) {
  const g = cv.getContext('2d');
  let W = 0;
  let H = 0;
  let speed = 0;
  let target = 0;
  let off = 0;
  let bend = side === 'left' ? -1 : side === 'right' ? 1 : 0; // 車燈轉向（-1 左、1 右）
  let bendTo = bend;
  let sweep = 0; // 掉頭：車燈掃過一圈，0..1
  let sightName = null;
  let sightA = 0;
  let raf = 0;
  let stopped = false;
  for (const k of Object.keys(SIGHTS)) img(SIGHTS[k].src); // 先開始載入
  let lastT = performance.now();
  const tufts = Array.from({ length: 40 }, (_, i) => ({ z: i / 40, side: i % 2 ? 1 : -1, r: Math.random() }));
  const resize = () => {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width || 390;
    H = r.height || 844;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const draw = (now) => {
    if (stopped) return;
    const dt = Math.min(50, now - lastT) / 1000;
    lastT = now;
    if (!W) resize();
    speed += (target - speed) * Math.min(1, dt * 3);
    off = (off + speed * dt * 1.4) % 1;
    bend += (bendTo - bend) * Math.min(1, dt * 2.2);
    sightA += ((sightName ? 1 : 0) - sightA) * Math.min(1, dt * 1.5);
    const viewH = H * 0.69; // 閱讀框上方
    const hy = viewH * 0.36; // 地平線
    const cx = W / 2 + bend * W * 0.28; // 消失點跟著車燈轉向
    g.fillStyle = '#050608';
    g.fillRect(0, 0, W, H);
    // 夜空一點點亮
    const sky = g.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, '#0b0f1a');
    sky.addColorStop(1, '#141826');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, hy);
    // 遠山的輪廓
    g.fillStyle = '#07090d';
    g.beginPath();
    g.moveTo(0, hy);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, hy - 18 - Math.sin((x + bend * 120) / 70) * 10 - Math.sin((x + bend * 80) / 31) * 5);
    g.lineTo(W, hy);
    g.closePath();
    g.fill();
    // 掉頭：整個畫面跟著車燈橫掃
    g.save();
    if (sweep > 0) g.translate(-Math.sin(sweep * Math.PI * 2) * W * 0.6, 0);
    // 車燈照出來的路面（梯形，越遠越窄、越暗）
    const roadAt = (z) => { // z 0（腳下）→ 1（遠處）
      const y = viewH - (viewH - hy) * (1 - (1 - z) ** 2);
      const half = W * 0.55 * (1 - z) + W * 0.02;
      const x = W / 2 + (cx - W / 2) * z ** 1.6;
      return { y, half, x };
    };
    const beam = g.createRadialGradient(cx, viewH, 10, cx, viewH, viewH * 0.85);
    beam.addColorStop(0, 'rgba(255,236,190,.42)');
    beam.addColorStop(0.55, 'rgba(255,226,170,.1)');
    beam.addColorStop(1, 'rgba(255,226,170,0)');
    const FORK_Z = 0.3; // 岔路：在車燈照得到的地方分成左右兩條
    const branch = (dir) => {
      g.beginPath();
      for (let k = 0; k <= 10; k++) {
        const z = FORK_Z + k * ((1 - FORK_Z) / 10);
        const p = roadAt(z);
        const x = p.x + dir * (z - FORK_Z) * W * 1.3;
        k === 0 ? g.moveTo(x - p.half, p.y) : g.lineTo(x - p.half, p.y);
      }
      for (let k = 10; k >= 0; k--) {
        const z = FORK_Z + k * ((1 - FORK_Z) / 10);
        const p = roadAt(z);
        const x = p.x + dir * (z - FORK_Z) * W * 1.3;
        g.lineTo(x + p.half, p.y);
      }
      g.closePath();
      g.fill();
    };
    const asphalt = g.createLinearGradient(0, viewH, 0, hy);
    asphalt.addColorStop(0, '#34302b');
    asphalt.addColorStop(0.6, '#1c1a18');
    asphalt.addColorStop(1, '#0c0b0a');
    g.fillStyle = asphalt;
    g.beginPath();
    const lim = fork ? FORK_Z : 1;
    for (let k = 0; k <= 20; k++) { const p = roadAt((k / 20) * lim); k === 0 ? g.moveTo(p.x - p.half, p.y) : g.lineTo(p.x - p.half, p.y); }
    for (let k = 20; k >= 0; k--) { const p = roadAt((k / 20) * lim); g.lineTo(p.x + p.half, p.y); }
    g.closePath();
    g.fill();
    if (fork) { branch(-1); branch(1); }
    // 中線（往前捲）
    g.fillStyle = 'rgba(235,225,200,.75)';
    for (let i = 0; i < 9; i++) {
      const z0 = (i + off) / 9;
      const z1 = z0 + 0.035;
      if (z1 > lim) continue;
      const a = roadAt(z0);
      const b = roadAt(z1);
      const w0 = Math.max(1, a.half * 0.025);
      const w1 = Math.max(1, b.half * 0.025);
      g.beginPath();
      g.moveTo(a.x - w0, a.y); g.lineTo(a.x + w0, a.y); g.lineTo(b.x + w1, b.y); g.lineTo(b.x - w1, b.y);
      g.closePath();
      g.fill();
    }
    // 路邊的草（果園還是水溝，看不出來）
    for (const t of tufts) {
      const z = (t.z + off) % 1;
      if (fork && z > FORK_Z) continue;
      const p = roadAt(z);
      const x = p.x + t.side * (p.half + 6 + t.r * 30 * (1 - z));
      const h = (1 - z) * 26 + 3;
      g.strokeStyle = `rgba(110,120,80,${0.5 * (1 - z)})`;
      g.lineWidth = Math.max(1, (1 - z) * 2.5);
      g.beginPath();
      g.moveTo(x, p.y); g.lineTo(x - 4, p.y - h); g.moveTo(x, p.y); g.lineTo(x + 3, p.y - h * 0.8);
      g.stroke();
    }
    // 車燈的光（疊在路面上）
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = beam;
    g.fillRect(0, hy - 40, W, viewH - hy + 40);
    g.globalCompositeOperation = 'source-over';
    // 光以外壓暗：車燈只照得到前面一小塊，遠處和兩邊都是黑的
    const lx = W / 2 + (cx - W / 2) * 0.35;
    const dark = g.createRadialGradient(lx, viewH * 1.04, W * 0.08, lx, viewH * 1.04, viewH * 0.66);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(0.55, 'rgba(0,0,0,.38)');
    dark.addColorStop(0.85, 'rgba(0,0,0,.88)');
    dark.addColorStop(1, 'rgba(0,0,0,.97)');
    g.fillStyle = dark;
    g.fillRect(-W, 0, W * 3, H);
    // 車燈照到的東西（畫師原圖；車燈掃到才看得見）：鐵皮工寮擋在路的盡頭，土地公廟在路邊
    if (sightA > 0.02 && sightName && SIGHTS[sightName]) {
      const S = SIGHTS[sightName];
      const lit = litSprite(sightName);
      if (lit) {
        const p = roadAt(S.z);
        const w = W * S.w;
        const h = (w * lit.height) / lit.width;
        g.save();
        g.globalAlpha = sightA;
        // 地上一點影子，讓東西站在路上
        g.fillStyle = 'rgba(0,0,0,.45)';
        g.beginPath();
        g.ellipse(p.x + W * S.dx, p.y - 2, w * 0.46, Math.max(3, w * 0.035), 0, 0, Math.PI * 2);
        g.fill();
        g.drawImage(lit, p.x + W * S.dx - w * S.ax, p.y - h * S.ay, w, h);
        g.restore();
      }
    }
    g.restore();
    // 龍頭的影子（畫面下緣）
    g.fillStyle = '#030303';
    g.beginPath();
    g.moveTo(W * 0.1, viewH + 4); g.quadraticCurveTo(W / 2, viewH - 30, W * 0.9, viewH + 4); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
    g.fill();
    raf = requestAnimationFrame(draw);
  };
  addEventListener('resize', resize);
  raf = requestAnimationFrame((t) => { lastT = t; resize(); draw(t); });
  const anim = (ms, fn) => new Promise((res) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      fn(k);
      if (k < 1 && !stopped) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  return {
    go(on) { target = on ? 1 : 0; },
    sight(name) { sightName = name; },
    async turn(dir) { // 岔路：車燈轉向那一邊，繼續往前
      bendTo = dir === 'left' ? -1 : 1;
      target = 0.8;
      await anim(1500, () => {});
      target = 0;
    },
    async uturn() { // 掉頭：車燈掃過路邊轉半圈
      target = 0.3;
      await anim(1600, (k) => { sweep = k < 1 ? k : 0; });
      target = 0;
    },
    stop() { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); },
  };
}
