// 開場第一幕到第三幕前半：16:49 的辦公室 → 標題 → 信箱裡的律師信 → 175 縣道。
// 推門之後（第三幕德叔的三句話、第四幕第一杯）在 main.js 的店裡演。
// 只依賴 DOM；每一幕右上角都可以「略過」。
import { RESIGNATIONS, RESIGNATION_MAIL, LAWYER_LETTER, OPENING_TEXT as T } from './letters.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const ART = './assets/art/';

// root：#opening；speed：?speed= 的倍率（只縮短等待）
// 回傳 Promise：推門進去時 resolve({ resignation, name })
export function runOpening({ root, speed = 1 }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms / speed));
  const result = { resignation: '', name: '' };
  let finish;
  const done = new Promise((r) => { finish = r; });
  let stage = null;
  let token = 0;

  root.hidden = false;
  root.innerHTML = '<button class="op-skip" type="button">略過</button>';
  const skip = root.querySelector('.op-skip');

  function show(name, html) {
    stage = name;
    token++;
    for (const old of root.querySelectorAll('.op-stage')) old.remove();
    const el = document.createElement('section');
    el.className = `op-stage op-${name}`;
    el.innerHTML = html;
    root.appendChild(el);
    return el;
  }

  /* 第一幕：16:49 的辦公室 */
  function office() {
    const m = RESIGNATION_MAIL;
    const el = show('office', `
      <div class="op-bg" style="background-image:url(${ART}scene_office_night.webp)"></div>
      <div class="op-clock">16:49</div>
      <div class="op-mail">
        <div class="op-mail-head"><span>收件人：${esc(m.to)}</span><span>主旨：${esc(m.subject)}</span></div>
        ${m.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        <p class="op-ending"><span class="op-ending-text"></span><span class="caret"></span></p>
        <label class="op-sign">署名 <input id="op-name" maxlength="12" autocomplete="off" placeholder="可以不寫"> 敬上</label>
      </div>
      <p class="op-q">${esc(T.question)}</p>
      <div class="op-choices">${RESIGNATIONS.map((r) => `<button type="button" data-id="${r.id}">${esc(r.text)}</button>`).join('')}</div>
      <button type="button" id="op-send" class="primary" disabled>送出</button>
      <div class="op-keys">${esc(T.keys)}</div>`);
    let choice = null;
    let typing = 0;
    const target = el.querySelector('.op-ending-text');
    async function typeOut(text) {
      const my = ++typing;
      target.textContent = '';
      for (const ch of text) {
        if (my !== typing) return;
        target.textContent += ch;
        await sleep(60);
      }
    }
    for (const b of el.querySelectorAll('.op-choices button')) {
      b.onclick = () => {
        choice = b.dataset.id;
        for (const o of el.querySelectorAll('.op-choices button')) o.classList.toggle('on', o === b);
        typeOut(b.textContent);
        el.querySelector('#op-send').disabled = false;
      };
    }
    el.querySelector('#op-send').onclick = async () => {
      const my = token;
      typing++;
      target.textContent = RESIGNATIONS.find((r) => r.id === choice)?.text || '';
      result.resignation = choice;
      result.name = el.querySelector('#op-name').value.trim().slice(0, 12);
      el.querySelector('#op-send').disabled = true;
      for (const b of el.querySelectorAll('.op-choices button')) b.disabled = true;
      await sleep(300);
      if (my !== token) return;
      el.querySelector('.op-clock').textContent = '16:50'; // 按下送出，時鐘跳到 16:50
      await sleep(1100);
      if (my === token) title();
    };
  }

  /* 畫面暗下，標題浮現 */
  function title() {
    const el = show('title', `
      <h1>${T.title.map(esc).join('<br>')}</h1>
      <p class="sub">${esc(T.titleSub)}</p>
      <button type="button" id="op-next" class="primary">${esc(T.titleNext)}</button>`);
    el.querySelector('#op-next').onclick = mailbox;
  }

  /* 第二幕：信箱裡的律師信 */
  function mailbox() {
    const el = show('mailbox', `
      <p class="op-caption" id="op-cap">${esc(T.mailbox)}</p>
      <button type="button" class="op-box" id="op-env" aria-label="拿出信封"><img src="${ART}scene_mailboxes.webp" alt="一整排鐵信箱，其中一格露出牛皮紙信封"></button>
      <p class="op-caption small" id="op-tap">${esc(T.mailboxTap)}</p>`);
    el.querySelector('#op-env').onclick = async (ev) => {
      const btn = ev.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;
      const my = token;
      btn.classList.add('shake');
      el.querySelector('#op-cap').textContent = T.mailboxShake;
      el.querySelector('#op-tap').remove();
      await sleep(1300);
      if (my !== token) return;
      btn.remove();
      el.querySelector('#op-cap').remove();
      el.insertAdjacentHTML('beforeend', `
        <article class="op-lawyer">
          <h2>${esc(LAWYER_LETTER.title)}</h2>
          ${LAWYER_LETTER.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
          <div class="key"><img src="${ART}key.webp" alt="">${esc(T.keyNote)}</div>
        </article>
        <button type="button" id="op-next" class="primary">${esc(T.toRoad)}</button>`);
      el.querySelector('#op-next').onclick = road;
    };
  }

  /* 第三幕：175 縣道 */
  function road() {
    const el = show('road', `
      <div class="op-bg" style="background-image:url(${ART}scene_county_road.webp)"></div>
      <div class="op-road-ui">
        <p class="op-caption">${T.road.map(esc).join('<br>')}</p>
        <button type="button" id="op-next" class="primary">${esc(T.enter)}</button>
      </div>`);
    el.querySelector('#op-next').onclick = enter;
  }

  function enter() {
    token++;
    stage = 'shop';
    root.hidden = true;
    root.innerHTML = '';
    finish(result);
  }

  skip.onclick = () => {
    if (stage === 'office') title();
    else if (stage === 'title') mailbox();
    else if (stage === 'mailbox') road();
    else if (stage === 'road') enter();
  };

  office();
  return done;
}
