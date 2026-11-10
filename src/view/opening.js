// 開場第一幕到第三幕前半（DOM 畫面）：16:49 的辦公室 → 標題 → 信箱 → 律師信 → 175 縣道 → 拖曳推門。
// 字全部來自 src/lines/opening.js（第一版原文）。版面沿用第一版 legacy/src/opening.js 的做法；第一版每一幕右上角的按鈕 v3 不放（互動表沒有）。
// 每一幕切換時由 main.js 存檔（state.opening.act），重新整理從那一幕接著。
import { RESIGNATIONS, RESIGNATION_MAIL, LAWYER_LETTER, OFFICE, TITLE, MAILBOX, ROAD } from '../lines/opening.js';
import { play } from './audio.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// root：#opening；act：目前這一幕；api：{ state, go(act)（存檔並換幕）, persist(), enterShop() }
export function showOpening(root, act, api) {
  root.hidden = false;
  root.classList.remove('fade');
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

  if (act === 'office') {
    const m = RESIGNATION_MAIL;
    const el = stage('office', `
      <div class="op-clock">${OFFICE.clock}</div>
      <div class="op-monitor"><div class="op-mail">
        <div class="op-mail-head"><span>${OFFICE.to}${esc(m.to)}</span><span>${OFFICE.subject}${esc(m.subject)}</span></div>
        ${m.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        <p class="op-ending"><span class="op-ending-text"></span><span class="caret"></span></p>
        <label class="op-sign">${OFFICE.sign}<input id="op-name" maxlength="12" autocomplete="off" placeholder="${OFFICE.signPlaceholder}">${OFFICE.signEnd}</label>
      </div></div>
      <p class="op-q">${OFFICE.question}</p>
      <div class="op-choices">${RESIGNATIONS.map((r) => `<button data-id="${r.id}" aria-pressed="false">${esc(r.text)}</button>`).join('')}</div>
      <button id="op-send" class="primary" disabled>${OFFICE.send}</button>
      <div class="op-keys" aria-hidden="true">${OFFICE.keys}</div>`);
    const name = el.querySelector('#op-name');
    name.value = api.state.opening.name || '';
    let choice = null;
    let typing = 0;
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
        el.querySelector('#op-send').disabled = false;
      };
    }
    el.querySelector('#op-send').onclick = async () => {
      typing++;
      target.textContent = RESIGNATIONS.find((r) => r.id === choice)?.text || '';
      play('send');
      api.state.opening.resignation = choice;
      api.state.opening.name = name.value.trim().slice(0, 12);
      api.persist();
      el.querySelector('#op-send').disabled = true;
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
      <button id="op-next" class="primary">${TITLE.next}</button>
      <div class="op-credit">${TITLE.credit}・${TITLE.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.text}</a>`).join('・')}</div>`);
    el.querySelector('#op-next').onclick = () => api.go('mailbox');
    return;
  }

  const letterHtml = `
    <article class="op-lawyer" aria-label="${LAWYER_LETTER.title}">
      <h2>${LAWYER_LETTER.title}</h2>
      ${LAWYER_LETTER.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      <div class="key"><svg width="44" height="20" viewBox="0 0 44 20" aria-hidden="true"><circle cx="9" cy="10" r="7" fill="none" stroke="#8a6d3b" stroke-width="3"/><path d="M16 10h26M34 10v6M39 10v5" stroke="#8a6d3b" stroke-width="3" fill="none"/></svg>${LAWYER_LETTER.attachment}</div>
    </article>
    <button id="op-next" class="primary">${MAILBOX.next}</button>`;

  if (act === 'mailbox') {
    const el = stage('mailbox', `
      <p class="op-caption" id="op-cap">${MAILBOX.caption}</p>
      <button class="op-box-btn" id="op-env" aria-label="${MAILBOX.boxLabel}"><img src="assets/art/scene_mailboxes.webp" alt="${MAILBOX.artLabel}"></button>
      <p class="op-caption" id="op-tap">${MAILBOX.tap}</p>`);
    el.querySelector('#op-env').onclick = async (ev) => {
      const btn = ev.currentTarget;
      if (btn.disabled) return;
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
    const el = stage('mailbox reading', letterHtml);
    el.querySelector('#op-next').onclick = () => api.go('road');
    return;
  }

  if (act === 'road') {
    const el = stage('road', `
      <svg class="op-road-art" viewBox="0 0 1170 2532" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${ROAD.artLabel}">
        <image href="assets/art/scene_county_road.webp" width="1170" height="2532"/>
        <text x="1028" y="1625" text-anchor="middle" font-size="60" font-weight="700" fill="#2f5d8a" letter-spacing="1">175</text>
      </svg>
      <div class="op-road-ui">
        <p class="op-caption">${ROAD.caption.map(esc).join('<br>')}</p>
        <div class="op-door" id="op-door" role="button" tabindex="0" aria-label="${ROAD.door}">
          <div class="op-door-panel"><span class="op-door-knob"></span><span class="op-door-text">${ROAD.door}</span></div>
        </div>
      </div>`);
    pushDoor(el.querySelector('#op-door'), () => { if (alive()) api.enterShop(); });
  }
}

// 進門：拖曳推門，門推開才有風鈴聲（規格書互動表）。點一下門只會晃一下，不會開。
function pushDoor(door, onOpen) {
  const panel = door.querySelector('.op-door-panel');
  let start = null;
  let opened = false;
  const set = (k) => { panel.style.transform = `perspective(600px) rotateY(${-k * 75}deg)`; };
  const open = () => {
    if (opened) return;
    opened = true;
    set(1);
    play('door');
    play('bell');
    door.classList.add('open');
    setTimeout(onOpen, 900);
  };
  door.addEventListener('pointerdown', (e) => {
    if (opened) return;
    door.setPointerCapture?.(e.pointerId);
    start = { x: e.clientX, y: e.clientY };
    panel.style.transition = 'none';
  });
  door.addEventListener('pointermove', (e) => {
    if (!start || opened) return;
    const d = Math.max(Math.abs(e.clientX - start.x), start.y - e.clientY, 0);
    const k = Math.min(1, d / 140);
    set(k * 0.8);
    if (k >= 0.75) { start = null; panel.style.transition = ''; open(); }
  });
  const release = () => {
    if (!start || opened) return;
    start = null;
    panel.style.transition = '';
    set(0);
    door.classList.remove('nudge');
    void door.offsetWidth;
    door.classList.add('nudge'); // 推不夠：門晃一下回來
  };
  door.addEventListener('pointerup', release);
  door.addEventListener('pointercancel', release);
  door.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(); });
}
