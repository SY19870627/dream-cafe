// 開場第一幕到第三幕（劇本「開場」）：16:49 的辦公室 → 標題 → 信箱裡的律師信 → 175 縣道。
// 推門進去之後（第三幕德叔的三句話與第四幕的第一杯）在 main.js 的 3D 店裡演出。
// 只在新存檔播放；每一幕都可以「略過」，進度存在 save.flags.openingAct，重新整理會從那一幕接著播。
// 只依賴 DOM 與 art.js，不依賴 Three.js 的場景。
import { RESIGNATIONS, RESIGNATION_MAIL, LAWYER_LETTER } from './letters.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// root：#opening；save／persist：存檔；art：src/art.js；speed：開發者模式的倍率（只縮短等待時間）
// sound：{ stage(name) 換幕時通知（辦公室有日光燈的嗡嗡聲）、play(name) 單發的聲音（鍵盤、送出、鑰匙） }
// 回傳 Promise：玩家推門進店時 resolve({ lines: true })；第三幕被略過時 resolve({ lines: false })
export function runOpening({ root, save, persist, art, speed = 1, sound = {} }) {
  const T = (ms) => ms / speed;
  const sleep = (ms) => new Promise((r) => setTimeout(r, T(ms)));
  let finish;
  const done = new Promise((r) => { finish = r; });
  let stage = null; // 'office' | 'title' | 'mailbox' | 'road'
  let token = 0; // 換幕時讓上一幕還沒跑完的等待作廢

  root.hidden = false;
  root.classList.remove('fade');
  root.innerHTML = '<button id="op-skip" aria-label="略過這一幕">略過</button>';
  const skip = root.querySelector('#op-skip');

  function setAct(n) {
    save.flags.openingAct = n;
    persist();
  }

  // 換一幕：舊的淡出、新的淡入
  function show(name, html) {
    stage = name;
    token++;
    sound.stage?.(name);
    for (const old of root.querySelectorAll('.op-stage')) {
      old.classList.remove('on');
      setTimeout(() => old.remove(), T(700));
    }
    const el = document.createElement('section');
    el.className = `op-stage op-${name}`;
    el.innerHTML = html;
    root.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    return el;
  }

  /* ---------- 第一幕：16:49 的辦公室 ---------- */
  function office() {
    setAct(1);
    const m = RESIGNATION_MAIL;
    const el = show('office', `
      <div class="op-clock" aria-label="時間">16:49</div>
      <div class="op-monitor"><div class="op-mail">
        <div class="op-mail-head"><span>收件人：${esc(m.to)}</span><span>主旨：${esc(m.subject)}</span></div>
        ${m.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        <p class="op-ending"><span class="op-ending-text"></span><span class="caret"></span></p>
        <label class="op-sign">署名<input id="op-name" maxlength="12" autocomplete="off" placeholder="可以不寫">敬上</label>
      </div></div>
      <p class="op-q">結尾要寫哪一句？</p>
      <div class="op-choices">${RESIGNATIONS.map((r) => `<button data-id="${r.id}" aria-pressed="false">${esc(r.text)}</button>`).join('')}</div>
      <button id="op-send" class="primary" disabled>送出</button>
      <div class="op-keys" aria-hidden="true">喀噠、喀噠……</div>`); // 【待定】「結尾要寫哪一句？」是自行補寫的提示
    const name = el.querySelector('#op-name');
    name.value = save.player.name || '';
    let choice = null;
    for (const b of el.querySelectorAll('.op-choices button')) {
      b.onclick = () => {
        choice = b.dataset.id;
        for (const o of el.querySelectorAll('.op-choices button')) o.setAttribute('aria-pressed', String(o === b));
        typeOut(el.querySelector('.op-ending-text'), b.textContent);
        el.querySelector('#op-send').disabled = false;
      };
    }
    // 結尾一個字一個字打進郵件裡（喀噠、喀噠）
    let typing = 0;
    async function typeOut(target, text) {
      const my = ++typing;
      target.textContent = '';
      for (const ch of text) {
        if (my !== typing) return;
        target.textContent += ch;
        if (ch.trim()) sound.play?.('key');
        await sleep(55 + Math.random() * 45);
      }
    }
    el.querySelector('#op-send').onclick = async () => {
      const my = token;
      typing++;
      el.querySelector('.op-ending-text').textContent = RESIGNATIONS.find((r) => r.id === choice)?.text || '';
      sound.play?.('enter');
      save.player.resignation = choice;
      save.player.name = name.value.trim().slice(0, 12);
      persist();
      el.querySelector('#op-send').disabled = true;
      for (const b of el.querySelectorAll('.op-choices button')) b.disabled = true;
      const clock = el.querySelector('.op-clock');
      clock.classList.add('flip');
      await sleep(250);
      if (my !== token) return;
      clock.textContent = '16:50'; // 按下送出，時鐘跳到 16:50
      await sleep(1100);
      if (my === token) title();
    };
  }

  /* ---------- 畫面暗下，標題浮現（底部是開發者資訊） ---------- */
  function title() {
    setAct(2);
    // 【待定】標題畫面的按鈕「下班」是自行補寫的
    const el = show('title', `
      <h1>我單方面辭退老闆後，<br>開了一間夢想中的咖啡店</h1>
      <p class="sub">試玩版・台南東山</p>
      <button id="op-next" class="primary">下班</button>
      <div class="op-credit">開發者 SY・<a href="https://github.com/SY19870627" target="_blank" rel="noopener">GitHub</a>・<a href="https://x.com/nelsonyehfon" target="_blank" rel="noopener">X</a></div>`);
    el.querySelector('#op-next').onclick = mailbox;
  }

  /* ---------- 第二幕：信箱裡的律師信 ---------- */
  function mailbox() {
    setAct(2);
    const img = art.mailboxes().toDataURL();
    // 【待定】旁白兩句是自行補寫的（劇本的舞台說明改寫）
    const el = show('mailbox', `
      <p class="op-caption" id="op-cap">回到租屋處。信箱裡有一個牛皮紙信封。</p>
      <button class="op-box-btn" id="op-env" aria-label="拿出信封"><img alt="一整排鐵信箱，其中一格露出牛皮紙信封" src="${img}"></button>
      <p class="op-caption" id="op-tap">點信箱，把信封拿出來。</p>`);
    el.querySelector('#op-env').onclick = async (ev) => {
      const btn = ev.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true;
      const my = token;
      btn.classList.add('shake');
      sound.play?.('keys');
      el.querySelector('#op-cap').textContent = '搖起來，有鑰匙的聲音。';
      el.querySelector('#op-tap').remove();
      await sleep(1300);
      if (my !== token) return;
      btn.remove();
      el.querySelector('#op-cap').remove();
      el.insertAdjacentHTML('beforeend', `
        <article class="op-lawyer" aria-label="律師信">
          <h2>律師信</h2>
          ${LAWYER_LETTER.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
          <div class="key"><svg width="44" height="20" viewBox="0 0 44 20" aria-hidden="true"><circle cx="9" cy="10" r="7" fill="none" stroke="#8a6d3b" stroke-width="3"/><path d="M16 10h26M34 10v6M39 10v5" stroke="#8a6d3b" stroke-width="3" fill="none"/></svg>附件：鑰匙一把</div>
        </article>
        <button id="op-next" class="primary">出發去東山</button>`);
      el.querySelector('#op-next').onclick = road;
    };
  }

  /* ---------- 第三幕：175 縣道 ---------- */
  function road() {
    setAct(3);
    const img = art.countyRoad().toDataURL();
    const el = show('road', `
      <img alt="傍晚的山路，兩旁是龍眼樹；三合院的窗亮著一盞燈，台階上睡著一隻橘貓" src="${img}">
      <div class="op-road-ui">
        <p class="op-caption">傍晚，175 縣道。<br>正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。</p>
        <button id="op-next" class="primary">推門進去</button>
      </div>`); // 旁白取自劇本第三幕的舞台說明
    el.querySelector('#op-next').onclick = () => enter(true);
  }

  // 推門進店：開場畫面淡出，交給 main.js 演第三幕後半與第四幕
  function enter(lines) {
    token++;
    stage = 'shop';
    sound.stage?.('shop');
    setAct(4);
    skip.remove();
    root.classList.add('fade');
    setTimeout(() => { root.hidden = true; root.innerHTML = ''; }, T(900));
    finish({ lines });
  }

  // 略過：跳到下一幕
  skip.onclick = () => {
    if (stage === 'office') { save.player.resignation = save.player.resignation || ''; title(); }
    else if (stage === 'title') mailbox();
    else if (stage === 'mailbox') road();
    else if (stage === 'road') enter(false);
  };

  const act = Number(save.flags.openingAct) || 1;
  if (act <= 1) office();
  else if (act === 2) mailbox();
  else if (act === 3) road();
  else enter(false); // 已經推門進店了：從第四幕「先坐。」接著演
  return { done, get stage() { return stage; } };
}
