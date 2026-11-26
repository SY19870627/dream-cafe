// 開場的 DOM 畫面（劇本 v5.9 第一幕到第四幕，字卡倒數版）：
//   showOpening()：16:49 的辦公室（離職申請單）→ 標題（按「下班」→ 字卡前 4 天）→ 租屋處房間、第一次收到信（點信封；幕 id 沿用 mailbox）
//     → 信（信後旁白一句一句點，讀完淡出 → 字卡前 2 天）→ 特休前一晚（eve，「出發去東山」）；
//     以及接回場（resend，歸零字卡之後同一間辦公室自動送出，按「下班」→ 字卡第二天）。
//     整幕自己處理，換幕時呼叫 api.go(act, { fade })（字卡是 main.js 的 dayCard）
//   showScene()：三合院外（夜裡、晚上）、黑路、岔路、工寮與土地公廟、庭埕與護龍房間、待續。
//     這些畫面的字由閱讀框（view/reader.js）一句一句出；畫面只負責「第 i 句時長什麼樣子」與互動關卡（推門、發動、按住騎、岔路、掉頭、點床）。
// 開場這些畫面沒有「跳過」按鈕。只有睡前自白期間，閱讀框才會顯示「跳過自白」（view/reader.js）；其他幕與互動關卡都不能跳過。
// 字全部來自 src/lines/opening.js。畫師原圖只讀不改（不重新壓縮、不縮圖）；夜路的路面是程式繪製；工寮、土地公廟、掉頭是分鏡格（codeart v2，疊在 #op-prop）。
import { RESIGNATION, LETTER, ROOM_LETTER, EVE, OFFICE, TITLE, ROAD, DEPART, TEMPLE } from '../lines/opening.js';
import { RESEND } from '../lines/days.js';
import { play, setEngine, setEnginePath, ENGINE_TURN, ENGINE_UTURN } from './audio.js';
import { artUrl, srcOf } from './art-map.js';
import { STORYBOARDS, parseSb, applyStoryboard, sbHintTop } from './days.js';
import { MUST_HINTS, isStoryboard } from './hints.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const art = (name) => `assets/art/${name}.webp`;

export const HOLD_MS = 1500; // 按住騎多久翻到下一句
export const DOOR_DRAG = 140; // 推門：拖多遠算推到底（推到 75% 才開）
export const DOOR_FADE_MS = 1000; // 門推開後，推門熱區（與「推門進去」字）淡出多久（與 index.html 的 .op-door-wrap.gone 一致）
export const DOOR_NUDGE_MS = 280; // 只點一下：活動扇閃成「開一道縫」多久再彈回關著
export const BLACKOUT_MS = 1600; // 離開工寮掉頭：短黑幕（含引擎聲 ENGINE_UTURN 1.6 秒）

// 三合院的雙扇門（畫師去背層，art-map.js 的 door_*）：活動扇三張開度依 k（0 關～1 全開）淡換；暖光 = k。純函式，有單元測試
//   k ≤ 0：全關；0～0.5：關 → 開一道縫；0.5～1：開一道縫 → 全開
export function leafMix(k) {
  const c = Math.max(0, Math.min(1, Number(k) || 0));
  const r = (v) => Math.round(v * 1000) / 1000;
  if (c <= 0.5) { const t = c / 0.5; return { shut: r(1 - t), ajar: r(t), open: 0, glow: r(c) }; }
  const t = (c - 0.5) / 0.5;
  return { shut: 0, ajar: r(1 - t), open: r(t), glow: r(c) };
}
// 門的圖層（整張 1170×2532 對齊層）：暖光 → 固定扇 → 活動扇（關／開一道縫／全開）；台階上的貓在這一層上面（z-index 較高），門板不會蓋到貓
const doorArtHtml = () => `<div class="op-door-art" aria-hidden="true">
          <img class="dr-glow" src="${artUrl(srcOf('door_glow'))}" alt="">
          <img class="dr-fixed" src="${artUrl(srcOf('door_fixed'))}" alt="">
          <img class="dr-leaf shut" src="${artUrl(srcOf('door_leaf_shut'))}" alt="">
          <img class="dr-leaf ajar" src="${artUrl(srcOf('door_leaf_ajar'))}" alt="">
          <img class="dr-leaf open" src="${artUrl(srcOf('door_leaf_open'))}" alt="">
        </div>`;
// 把門圖層擺成開度 k
export function setDoorArt(artEl, k) {
  if (!artEl) return;
  const m = leafMix(k);
  for (const n of ['shut', 'ajar', 'open']) { const im = artEl.querySelector(`.dr-leaf.${n}`); if (im) im.style.opacity = String(m[n]); }
  const g = artEl.querySelector('.dr-glow');
  if (g) g.style.opacity = String(m.glow);
}

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

// 送出：送出音效、時鐘 16:49 翻成 16:50。開場按「送出」與接回場自動送出都呼叫這一個（同一份音效和動畫）。
// 回傳 true＝播完、畫面還在
export async function sendFx(el, alive) {
  play('send');
  const clock = el.querySelector('.op-clock');
  clock.classList.add('flip');
  await sleep(250);
  if (!alive()) return false;
  clock.textContent = OFFICE.clockAfter;
  await sleep(1100);
  return alive();
}

/* ====================== 第一幕～第二幕、特休前一晚、接回場（整幕自己處理） ====================== */
// root：#opening；act：目前這一幕；api：{ state, go(act)（存檔並換幕）, persist() }
export function showOpening(root, act, api) {
  const { alive, stage } = makeStage(root);

  if (act === 'office') {
    // 公司簽核系統的離職申請單（劇本 v5.8）：離職申請單、申請人（固定，沒有輸入框）、送簽對象、事由欄、說明、特休；沒有收件人、主旨、郵件內文
    const el = stage('office', `
      <div class="op-clock">${OFFICE.clock}</div>
      <div class="op-monitor"><div class="op-mail">
        <p class="op-form-title">${esc(OFFICE.form)}</p>
        <p class="op-sign">${esc(OFFICE.applicantLabel)}${esc(OFFICE.applicant)}</p>
        <p class="op-to">${esc(OFFICE.toLabel)}${esc(OFFICE.to)}</p>
        <button type="button" class="op-ending op-reason" id="op-reason" aria-pressed="false"><span class="op-reason-label">${esc(OFFICE.reasonLabel)}</span><span class="op-ending-text"></span><span class="caret"></span></button>
        <p class="op-note">${esc(OFFICE.note)}</p>
        <p class="op-leave">${esc(OFFICE.leave)}</p>
      </div></div>
      <div class="op-keys" aria-hidden="true" hidden>${esc(OFFICE.keys)}</div>
      <button type="button" id="op-send" class="primary" disabled>${OFFICE.send}</button>`);
    let choice = null;
    let typing = 0;
    const send = el.querySelector('#op-send');
    const reason = el.querySelector('#op-reason');
    const target = el.querySelector('.op-ending-text');
    const keys = el.querySelector('.op-keys');
    const typeOut = async (text) => {
      const my = ++typing;
      target.textContent = '';
      keys.hidden = false; // 打字聲字樣：打字時才出現
      for (const ch of text) {
        if (my !== typing || !alive()) return;
        target.textContent += ch;
        if (ch.trim()) play('key');
        await sleep(55 + Math.random() * 45);
      }
      if (my === typing) keys.hidden = true;
    };
    // 事由欄：點一下打出固定那一句（不再三選一）；點過才能送出
    reason.onclick = () => {
      if (reason.disabled || choice) return;
      choice = RESIGNATION.id;
      reason.setAttribute('aria-pressed', 'true');
      reason.classList.add('filled');
      typeOut(RESIGNATION.text);
      send.disabled = false;
    };
    send.onclick = async () => {
      if (!choice || send.disabled) return; // 沒點過事由欄不能送出
      typing++;
      target.textContent = RESIGNATION.text;
      keys.hidden = true;
      api.state.opening.resignation = choice;
      api.persist();
      send.disabled = true;
      reason.disabled = true;
      if (await sendFx(el, alive)) api.go('title'); // 送出音效、16:49 翻 16:50（接回場自動播同一份）
    };
    return;
  }

  if (act === 'resend') {
    // 接回場（字卡「我單方面辭退老闆當天　16:49」之後）：開場同一間辦公室、同一張單。事由（親寫句）和說明已在欄位裡，
    // 不能點事由、不能按送出；不看開場有沒有點過事由（沒玩過開場、跳關進來也一樣）。
    // 停一下 → 送出音效和翻鐘自動播一次（sendFx，跟開場同一份）→ 停在 16:50 → 旁白一句一句點 → 最後一句才出「下班」→ 字卡「第二天」
    const R = RESEND;
    const el = stage('office resend', `
      <div class="op-clock">${OFFICE.clock}</div>
      <div class="op-monitor"><div class="op-mail">
        <p class="op-form-title">${esc(OFFICE.form)}</p>
        <p class="op-sign">${esc(OFFICE.applicantLabel)}${esc(OFFICE.applicant)}</p>
        <p class="op-to">${esc(OFFICE.toLabel)}${esc(OFFICE.to)}</p>
        <button type="button" class="op-ending op-reason filled" id="op-reason" aria-pressed="true" disabled><span class="op-reason-label">${esc(OFFICE.reasonLabel)}</span><span class="op-ending-text">${esc(RESIGNATION.text)}</span></button>
        <p class="op-note">${esc(OFFICE.note)}</p>
        <p class="op-leave">${esc(OFFICE.leave)}</p>
      </div></div>
      <button type="button" id="op-send" class="primary" disabled>${OFFICE.send}</button>
      <button type="button" class="op-caption op-after" id="op-after" hidden><span class="op-after-text">${esc(R.lines[0])}</span><span class="st-more" aria-hidden="true">▾</span></button>
      <button type="button" id="op-next" class="primary op-resend-next" hidden>${R.next}</button>`);
    const after = el.querySelector('#op-after');
    const afterText = after.querySelector('.op-after-text');
    const next = el.querySelector('#op-next');
    let k = 0;
    (async () => {
      await sleep(1400);
      if (!alive()) return;
      if (!(await sendFx(el, alive))) return;
      el.querySelector('#op-send').hidden = true; // 送出去了：按鈕收起來，騰出位置給旁白
      after.hidden = false;
    })();
    after.onclick = () => {
      if (k >= R.lines.length - 1) return;
      k++;
      play('tap');
      afterText.textContent = R.lines[k];
      after.classList.toggle('quote', k === R.quoteAt); // 信上原句那一拍：信的字體
      if (k === R.lines.length - 1) { after.classList.add('done'); next.hidden = false; }
    };
    // 接回場的「下班」：去字卡「第二天」（標題畫面的「下班」去字卡「前 4 天」，兩個分開處理）
    next.onclick = () => { if (next.disabled) return; next.disabled = true; api.go('d2card', { fade: true }); };
    return;
  }

  if (act === 'title') {
    // 按「下班」先出字卡「我單方面辭退老闆前 4 天」，再進租屋處房間（不按就留在標題畫面）；開發者列照劇本放在畫面下方
    const el = stage('title', `
      <div class="op-title-block">
        <h1>${TITLE.lines.map(esc).join('<br>')}</h1>
        <p class="sub">${TITLE.sub}</p>
      </div>
      <button type="button" id="op-next" class="primary">${TITLE.next}</button>
      <div class="op-credit">
        <div class="op-credit-row">${esc(TITLE.credit)}</div>
        <div class="op-credit-row">${TITLE.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.text}</a>`).join('・')}</div>
        <button type="button" class="op-staff-btn" id="op-staff-btn" aria-haspopup="dialog" aria-controls="op-staff-dlg">${esc(TITLE.staffBtn)}</button>
      </div>
      <div class="op-staff-dlg" id="op-staff-dlg" role="dialog" aria-modal="true" aria-label="${esc(TITLE.staffBtn)}" hidden>
        <div class="op-staff-card">
          <button type="button" class="op-staff-x" id="op-staff-x" aria-label="關閉">×</button>
          <div class="op-staff">${[...TITLE.staff, TITLE.music.label, ...TITLE.music.lines, TITLE.music.source, TITLE.music.sfx].map((t) => `<p>${esc(t)}</p>`).join('')}<p class="op-credit-note">${esc(TITLE.music.note)}</p></div>
        </div>
      </div>`); // 第一行「製作：SY」，三個連結在下一行（承峰 11/22 22:52）；製作人員名單收進面板（承峰 2026-11-25）
    // 名單面板：「製作人員」打開；關閉鈕、點面板外、Esc 關掉（名單長了在面板裡捲動）
    const dlg = el.querySelector('#op-staff-dlg');
    const openBtn = el.querySelector('#op-staff-btn');
    const onKey = (e) => {
      if (!el.isConnected) { removeEventListener('keydown', onKey, true); return; } // 已離開標題畫面
      if (e.key === 'Escape' && !dlg.hidden) { e.preventDefault(); e.stopPropagation(); closeStaff(); } };
    const closeStaff = () => { if (dlg.hidden) return; dlg.hidden = true; removeEventListener('keydown', onKey, true); openBtn.focus(); };
    openBtn.onclick = () => { if (!dlg.hidden) return; dlg.hidden = false; addEventListener('keydown', onKey, true); el.querySelector('#op-staff-x').focus(); };
    el.querySelector('#op-staff-x').onclick = closeStaff;
    dlg.onclick = (e) => { if (!e.target.closest('.op-staff-card')) closeStaff(); };
    el.querySelector('#op-next').onclick = () => api.go('t4card');
    return;
  }

  if (act === 'mailbox') {
    // 第二幕：租屋處房間（傍晚正式圖 bg_letter_room，不再疊橘色濾鏡）。旁白三句（點一下換句）→ 第三句之後再點一下：
    // 疊上開信封分鏡格（鑰匙響一聲）→ 點一下分鏡格收掉，進信件畫面。不點就留在房間。
    // 摺疊桌上的信封是畫師去背層（pp_envelope 合著／pp_envelope_opened 拆過），只是擺著（<img aria-hidden>，不是按鈕、不能點）：
    // 前兩句桌面空；「我在摺疊桌前坐下來，把信封放在桌上。」淡入合著的；開信封分鏡格疊上的同時換成拆過的。
    // 原本的點信封、CSS 抽信動畫、提示「點信封，把信拿出來。」與「我把信抽出來，從頭看起。」都拿掉（承峰 2026-11-24 改分鏡格）。
    const R = ROOM_LETTER;
    const sb = parseSb(R.panel);
    const el = stage('letterroom', `
      <div class="op-art">
        <img class="op-art-img" src="${artUrl(srcOf('bg_letter_room'))}" alt="">
        <img class="op-env-img closed" src="${artUrl(srcOf('pp_envelope'))}" alt="" aria-hidden="true">
        <img class="op-env-img opened" src="${artUrl(srcOf('pp_envelope_opened'))}" alt="" aria-hidden="true">
      </div>
      <div class="pp-mini" id="op-sb" role="button" tabindex="0" aria-label="下一句" hidden></div>
      <p class="op-hint" id="op-hint" hidden>${esc(MUST_HINTS.pause)}</p>
      <div class="op-roombox" id="op-roombox" role="button" tabindex="0" aria-live="polite"><p class="op-caption" id="op-cap">${esc(R.lines[0])}</p><span class="st-more" aria-hidden="true">▾</span></div>`);
    for (const im of el.querySelectorAll('img')) im.onerror = () => im.remove(); // 缺圖：留底色
    const box = el.querySelector('#op-roombox');
    const cap = box.querySelector('.op-caption');
    const panel = el.querySelector('#op-sb');
    const hint = el.querySelector('#op-hint');
    let k = 0;
    let shown = false;
    let leaving = false;
    let armed = 0;
    // 桌上的信封：第三句（放在桌上）起合著；開信封分鏡格疊上時換成拆過的
    const ENV_AT = R.lines.length - 1;
    const envelope = (state) => { el.classList.toggle('env-closed', state === 'closed'); el.classList.toggle('env-opened', state === 'opened'); };
    const leave = async () => { // 分鏡格收掉 → 信件
      if (!shown || leaving || performance.now() < armed) return;
      leaving = true;
      play('tap');
      panel.classList.remove('on', 'ask');
      hint.hidden = true;
      await sleep(450);
      if (alive()) api.go('letter');
    };
    const more = () => {
      if (shown) { leave(); return; }
      if (k >= R.lines.length - 1) { // 第三句讀完：疊上分鏡格（格先出，點一下才往下）
        shown = true;
        armed = performance.now() + 300;
        panel.hidden = false;
        applyStoryboard(panel, sb);
        envelope('opened'); // 分鏡格疊上的同時，桌上換成拆過的信封
        panel.classList.remove('on');
        requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('on', 'ask')));
        box.classList.add('done');
        hint.hidden = false;
        { // 提示字貼著分鏡格（跟店內、第一天起的分鏡一致：單格放在格子正上方）
          const y = sbHintTop(panel);
          if (y != null) { hint.classList.add('sb-under'); hint.style.setProperty('--sb-hint-top', `${y}px`); }
        }
        if (STORYBOARDS[sb.name].sfx) play(STORYBOARDS[sb.name].sfx); // 鑰匙響一聲（信封裡有東西在響）
        return;
      }
      k++;
      play('tap');
      cap.textContent = R.lines[k];
      if (k === ENV_AT) envelope('closed'); // 「我在摺疊桌前坐下來，把信封放在桌上。」：合著的信封淡入
    };
    box.onclick = more;
    box.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); more(); } };
    panel.onclick = (e) => { e.stopPropagation(); leave(); };
    panel.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); leave(); } };
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
      </article>
      <button type="button" class="op-caption op-after" id="op-after"><span class="op-after-text">${esc(L.afterLines[0])}</span><span class="st-more" aria-hidden="true">▾</span></button>`);
    // 信件畫面沒有鑰匙按鈕與鑰匙特寫（承峰 2026-11-23 22:07 v510 第 2 項拿掉）
    // 信後旁白：一句一句點；最後一句再點一下就淡出，接字卡「我單方面辭退老闆前 2 天」（這裡沒有「出發去東山」）
    const after = el.querySelector('#op-after');
    const afterText = after.querySelector('.op-after-text');
    let k = 0;
    let leaving = false;
    after.onclick = () => {
      if (k >= L.afterLines.length - 1) {
        if (leaving) return;
        leaving = true;
        play('tap');
        api.go('t2card', { fade: true });
        return;
      }
      k++;
      play('tap');
      afterText.textContent = L.afterLines[k];
    };
    return;
  }

  if (act === 'eve') {
    // 特休前一晚（字卡「前 2 天」之後）：同一間租屋處房間，整場桌上都是拆過的信封（去背層 pp_envelope_opened；不能點）。旁白一句一句點，最後一句才出「出發去東山」。
    const E = EVE;
    const el = stage('letterroom eve env-opened', `
      <div class="op-art">
        <img class="op-art-img" src="${artUrl(srcOf('bg_letter_room'))}" alt="">
        <img class="op-env-img opened" src="${artUrl(srcOf('pp_envelope_opened'))}" alt="" aria-hidden="true">
      </div>
      <button type="button" id="op-next" class="primary op-eve-next" hidden>${E.next}</button>
      <div class="op-roombox" id="op-roombox" role="button" tabindex="0" aria-live="polite"><p class="op-caption" id="op-cap">${esc(E.lines[0])}</p><span class="st-more" aria-hidden="true">▾</span></div>`);
    for (const im of el.querySelectorAll('img')) im.onerror = () => im.remove(); // 缺圖：留底色
    const box = el.querySelector('#op-roombox');
    const cap = box.querySelector('.op-caption');
    const next = el.querySelector('#op-next');
    let k = 0;
    const more = () => {
      if (k >= E.lines.length - 1) return;
      k++;
      play('tap');
      cap.textContent = E.lines[k];
      if (k === E.lines.length - 1) { box.classList.add('done'); next.hidden = false; }
    };
    box.onclick = more;
    box.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); more(); } };
    next.onclick = () => { if (next.disabled) return; next.disabled = true; play('keys'); api.go('road'); };
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

  /* ---------- 三合院外：夜裡到東山（road）、晚上發動（depart）、晚上回來（return）；劇本 v5.8 三幕都是晚上 ---------- */
  if (act === 'road' || act === 'depart' || act === 'return') {
    // 轉場字「夜裡，東山。」與（機車引擎聲，熄火）：只在第一次到（第 0 句）；讀回存檔不再出
    const introOn = act === 'road' && api.state.opening.line === 0 && !api.resumed;
    const el = stage(`yard night${act === 'depart' ? ' no-box' : ''}`, `
      <div class="op-art">
        <img class="op-art-img" src="${art('scene_v3b_sanheyuan_night_v2')}" alt="">
        <div class="op-glow door"></div>
        ${act === 'depart' ? `<img class="op-road-light" src="${art('prop_v3b_scooter_road_light_v2')}" alt="" aria-hidden="true">` : ''}
        <div class="op-scooter" aria-hidden="true">
          <img class="off" src="${art('prop_v3b_scooter_off_v2')}" alt="">
          ${act === 'depart' ? `<img class="on" src="${art('prop_v3b_scooter_on_v2')}" alt=""><img class="beam" src="${art('prop_v3b_scooter_beam_v2')}" alt="">` : ''}
        </div>
        ${doorArtHtml()}
        ${act === 'road' ? `<img class="op-step-cat" src="${art('cat_longan_sleep')}" alt=""><img class="op-step-cat stretch" src="${art('cat_longan_stretch_v3b_v2')}" alt="">` : ''}
        ${act === 'return' ? `<img class="op-step-cat" src="${art('cat_longan_sleep_flip_v2')}" alt="">` : ''}
        <div class="op-door-wrap" hidden>
          <div class="op-door" id="op-door" role="button" tabindex="0" aria-label="${ROAD.door}">
            <div class="op-door-panel"><span class="op-door-text">${ROAD.door}</span></div>
          </div>
        </div>
      </div>
      ${act === 'depart' ? `<button type="button" class="primary op-start" id="op-start">${DEPART.start}</button>` : ''}
      ${act === 'road' ? `<div class="op-card" ${introOn ? '' : 'hidden'}><p>${esc(ROAD.card)}</p></div>` : ''}
`);
    const doorWrap = el.querySelector('.op-door-wrap');
    const doorArt = el.querySelector('.op-door-art');
    setDoorArt(doorArt, 0); // 一開始兩扇都關著
    ctl.intro = async () => {
      if (!introOn) return true;
      play('engineStart');
      await sleep(1700);
      if (!alive()) return false;
      play('engineOff');
      await sleep(900);
      if (!alive()) return false;
      const card = el.querySelector('.op-card');
      card.classList.add('out');
      await sleep(800);
      card.hidden = true;
      return alive();
    };
    // 門開了以後，推門熱區（.op-door-wrap，上面疊「推門進去」）不留在畫面上：剛推開時淡出（DOOR_FADE_MS），讀回存檔時直接藏起來；
    // 門圖層停在全開（活動扇 open、暖光全亮）；不會先閃一扇關著的「推門進去」。
    const hideDoor = (fade) => {
      if (doorWrap.classList.contains('gone')) return;
      doorWrap.classList.add('gone');
      if (fade) later(() => { doorWrap.hidden = true; }, DOOR_FADE_MS);
      else doorWrap.hidden = true;
    };
    ctl.beat = (i, look) => {
      const v = doorView(act, look, ctl.atDoor);
      el.classList.toggle('lit', v.lit);
      if (v.door === 'gone') hideDoor(false);
      else doorWrap.hidden = v.door !== 'closed';
      if (v.lit) setDoorArt(doorArt, 1); // 門已開（讀回「門一開……」）：活動扇全開、暖光全亮
    };
    ctl.gate = (name) => {
      if (name === 'door') {
        ctl.atDoor = true;
        doorWrap.hidden = false;
        return new Promise((res) => pushDoor(el.querySelector('#op-door'), doorArt, () => {
          el.classList.add('lit');
          hideDoor(true); // 門聲已過、風鈴正在收尾：假門板淡出
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
  // 工寮、土地公廟、掉頭改成分鏡格（sb_ride_shed_v2／sb_ride_temple_v2／sb_ride_uturn_v2，疊在 #op-prop，由 main.js 依句子的 set.mini 疊）；
  // 分鏡格疊著時夜路停下並壓暗（.sb-dim）。不再把工寮／廟小圖畫在夜路盡頭、不再程式打光、不再有 1.6 秒橫掃迴轉動畫。
  // 離開工寮的掉頭不出畫面：只有短黑幕（ctl.blackout）與引擎聲。
  if (act === 'ride' || act === 'fork' || act === 'temple') {
    const el = stage('night-road', `
      <canvas class="op-road-cv" aria-hidden="true"></canvas>
      <div class="op-road-black" aria-hidden="true"></div>
      <div class="op-hold" hidden aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="bg"/><circle cx="32" cy="32" r="26" class="fg"/><path d="M26 22 L40 32 L26 42" class="arrow"/></svg></div>
      <button type="button" class="op-fork left" hidden aria-label="左邊的路"><span aria-hidden="true">‹</span></button>
      <button type="button" class="op-fork right" hidden aria-label="右邊的路"><span aria-hidden="true">›</span></button>
      ${act === 'temple' ? `<button type="button" class="primary op-turnback" id="op-turnback" hidden>${esc(TEMPLE.back)}</button>` : ''}`);
    const road = nightRoad(el.querySelector('.op-road-cv'), { fork: act === 'fork', side: api.state.opening.fork });
    stopFns.push(() => road.stop());
    // 遠處的狗叫，偶爾一聲
    const bark = () => { play('dog'); later(bark, 7000 + Math.random() * 9000); };
    later(bark, 2500 + Math.random() * 3000);
    ctl.beat = (i, look) => { el.classList.toggle('sb-dim', isStoryboard(look.mini)); }; // 分鏡格疊著：夜路壓暗
    // 離開工寮的掉頭（工寮格收掉之後、土地公廟那句之前）：短黑幕＋引擎迴轉聲，不出畫面
    ctl.blackout = async () => {
      el.classList.add('blackout');
      setEnginePath(ENGINE_UTURN);
      await sleep(BLACKOUT_MS);
      if (!alive()) return false;
      el.classList.remove('blackout');
      await sleep(400);
      return alive();
    };
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
              setEnginePath(ENGINE_TURN); // 過彎：小收油再平順加油，轉完回怠速
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
            btn.hidden = true;
            setEnginePath(ENGINE_UTURN); // 迴轉：更慢更收油，轉完回怠速（畫面是掉頭分鏡格，由 main.js 疊）
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
        <img class="op-art-img" src="${art('scene_v3b_courtyard_night_v2')}" alt="">
        <img class="op-yn-cat" src="${art('cat_longan_sit')}" alt="">
      </div></div>
      <div class="op-room"><div class="op-art">
        <img class="op-art-img" src="${art('scene_v3b_room_night')}" alt="">
        <img class="op-rm-key" src="${art('key')}" alt="">
        <div class="op-rm-bed" id="op-bed"></div>
      </div></div>
      <div class="op-bedpov"><div class="op-art"><img class="op-art-img" src="${art('scene_v3b_bed_pov_night')}" alt=""></div></div>`);
    ctl.beat = (i, look) => {
      el.classList.toggle('in-room', look.place === 'room');
      if (look.lying) el.classList.add('lying');
    };
    ctl.hot = (name) => (name === 'bed' ? el.querySelector('#op-bed') : null);
    // 躺下：畫面切到躺在床上的視角（床頭燈一直亮著），床板聲
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

// 三合院外這一句時，門該是什麼樣子（純函式，有單元測試）：
//   門已經開了（doorOpen，包括存檔停在「門一開……」重新整理）→ lit、假門板 gone（不出現、不能推）
//   還沒開、走到門前（推門關卡）→ closed（可推的假門板）；發動那一幕沒有門
export function doorView(act, look, atDoor) {
  if (look && look.doorOpen) return { lit: true, door: 'gone' };
  return { lit: false, door: act !== 'depart' && atDoor ? 'closed' : 'none' };
}

// 進門：拖曳推門，門推開才有門聲與風鈴（與第一次相同）。門沒有鎖。第一次與回來用同一組素材、同一段程式。
// 玩家只拖活動扇（觀眾面對大門的右扇；#op-door 熱區疊在它上面）；固定扇不動。
//   不拖：兩扇都關著；只點一下：活動扇換成「開一道縫」再彈回關著，門不開；
//   拖曳：三張開度淡換（leafMix），暖光跟著變亮；拖夠（75%）：全開，門聲、風鈴聲
// art：門圖層（.op-door-art）
export function pushDoor(door, art, onOpen) {
  door.classList.remove('open');
  let start = null;
  let opened = false;
  let nudgeT = 0;
  const set = (k) => setDoorArt(art, k);
  set(0);
  const open = () => {
    if (opened) return;
    opened = true;
    clearTimeout(nudgeT);
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
    clearTimeout(nudgeT);
    art?.classList.add('dragging'); // 拖的時候開度跟著手，不等淡換
  };
  door.onpointermove = (e) => {
    if (!start || opened) return;
    const d = Math.max(Math.abs(e.clientX - start.x), start.y - e.clientY, 0);
    const k = Math.min(1, d / DOOR_DRAG);
    set(k * 0.9);
    if (k >= 0.75) { start = null; art?.classList.remove('dragging'); open(); }
  };
  const release = () => {
    if (!start || opened) return;
    start = null;
    art?.classList.remove('dragging');
    set(0.5); // 推不夠（或只點一下）：活動扇閃成開一道縫……
    nudgeT = setTimeout(() => { if (!opened) set(0); }, DOOR_NUDGE_MS); // ……再彈回關著
    door.classList.remove('nudge');
    void door.offsetWidth;
    door.classList.add('nudge'); // 推不夠：門開一道縫又彈回來
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

// 夜路（程式繪製）：黑底、車燈照出的一小塊柏油、中線、路邊的草；fork＝前面分成左右兩條。
// 工寮與土地公廟不再畫在路上（改成分鏡格，見上面 showScene 的夜路）
function nightRoad(cv, { fork = false, side = null } = {}) {
  const g = cv.getContext('2d');
  let W = 0;
  let H = 0;
  let speed = 0;
  let target = 0;
  let off = 0;
  let bend = side === 'left' ? -1 : side === 'right' ? 1 : 0; // 車燈轉向（-1 左、1 右）
  let bendTo = bend;
  let raf = 0;
  let stopped = false;
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
    g.save();
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
    async turn(dir) { // 岔路：車燈轉向那一邊，繼續往前
      bendTo = dir === 'left' ? -1 : 1;
      target = 0.8;
      await anim(1500, () => {});
      target = 0;
    },
    stop() { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); },
  };
}
