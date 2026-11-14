// 開場的閱讀框（第三幕推門之後到第四幕結束）：沿用三天 AVG 的閱讀框樣式（.st-box／.st-line／.st-name／立繪）。
// 一句一句：點畫面任何地方（或 Enter／Space）出下一句；不點就停在這一句。
// 可選互動（點貓、點杯子、點床）是閱讀層上方的發光熱點，點了做那件事，不會順便翻頁。
// 互動關卡（推門、按住騎、岔路、掉頭）時閱讀框只顯示字，點擊穿過去交給底下的畫面。
// 睡前自白（mono）期間，右上角有一個獨立的「跳過自白」按鈕：點正文／畫面空白處仍只翻一句；只有點這個按鈕才跳完整段。
// 按鈕剛出現的一小段時間（SKIP_ARM_MS）不收點：進入自白的那一下、翻到自白第一句的那一下，不會落到跳過上。
import { SPEAKER_NAMES } from '../lines/opening.js';
import { DAY_SPEAKERS } from '../lines/days.js';
import { play } from './audio.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export const TAP_GUARD_MS = 260; // 一句剛出來的一小段時間不收點（連點不會跳句）
export const SKIP_ARM_MS = 900; // 「跳過自白」出現後多久才收點
export const SKIP_LABEL = '跳過自白';
// 名牌：開場（德叔、我）＋第一～四天（行員、保全、宜蓁、經理、副總、協理、阿桂、訊息、便條）
export const nameOf = (who) => (who ? SPEAKER_NAMES[who] || DAY_SPEAKERS[who] || '' : '');
// 對白中間夾著的動作（劇本「……，」她比自己的下巴，「……」）：字照稿放，畫面上把夾在 」「 中間的那段用旁白的顏色
export function lineHtml(text) {
  return String(text).split(/(」[^「」]*「)/).map((part) => (/^」[^「」]*「$/.test(part)
    ? `<span class="st-aside">${esc(part.slice(1, -1))}</span>` : esc(part))).join('');
}
// 立繪的位置（.st-portrait img 預設 left:50% 置中）
export const PORTRAIT_PLACE = {
  center: 'height:130%;top:7%',
  aside: 'height:100%;top:19%;left:77%', // 坐下窗景：杯子在左半邊桌上（約 x128–178），德叔站到右手邊
  half: 'height:62%;top:22%', // 第一～四天的半身立繪（阿桂）
};

export function createReader(root, app) {
  const box = root.querySelector('.opr-box');
  const portrait = root.querySelector('.opr-portrait');
  const hotLayer = root.querySelector('.opr-hot');
  const skipBtn = root.querySelector('.opr-skip');
  let skipArmed = Infinity; // 跳過按鈕從什麼時候起收點
  let pending = null; // { resolve }
  let shownAt = 0;
  let hots = [];
  let raf = 0;

  const finish = (ok) => {
    const p = pending;
    pending = null;
    root.classList.remove('waiting');
    if (p) p.resolve(ok);
  };
  root.addEventListener('click', (e) => {
    if (!pending || e.target.closest('.opr-hotspot, .opr-skip')) return;
    if (performance.now() - shownAt < TAP_GUARD_MS) return;
    play('tap');
    finish(true);
  });
  addEventListener('keydown', (e) => {
    if (!pending || root.hidden) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // Enter／Space 只翻一句：焦點剛好停在「跳過自白」上也一樣（不會變成跳過整段）
    if (!e.target.closest?.('.opr-skip') && e.target.closest?.('button, input, textarea, select, a, [contenteditable]')) return;
    e.preventDefault();
    if (performance.now() - shownAt < TAP_GUARD_MS) return;
    play('tap');
    finish(true);
  });

  // 跳過自白：獨立的按鈕（不與翻一句共用點擊範圍），自己擋掉冒泡
  skipBtn.textContent = SKIP_LABEL;
  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    skipBtn.blur(); // 焦點不留在按鈕上
    if (skipBtn.hidden || !pending || performance.now() < skipArmed) return;
    play('tap');
    finish('skip');
  });
  skipBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

  // 熱點跟著目標移動（店內鏡頭在轉、貓在走）
  const place = () => {
    const base = app.getBoundingClientRect();
    for (const h of hots) {
      const r = h.rect(base);
      if (!r) { h.el.hidden = true; continue; }
      const w = Math.max(44, r.w);
      const hh = Math.max(44, r.h);
      h.el.hidden = false;
      h.el.style.left = `${Math.round(r.x + r.w / 2 - w / 2)}px`;
      h.el.style.top = `${Math.round(r.y + r.h / 2 - hh / 2)}px`;
      h.el.style.width = `${Math.round(w)}px`;
      h.el.style.height = `${Math.round(hh)}px`;
    }
    raf = hots.length ? requestAnimationFrame(place) : 0;
  };

  return {
    // 顯示一句（who：deshu／me；沒有是旁白）
    show(beat) {
      root.hidden = false;
      const name = nameOf(beat.who);
      box.innerHTML = `<p class="st-line ${beat.who || 'narrator'}${beat.mono ? ' mono' : ''}">${name ? `<span class="st-name">${esc(name)}</span>` : ''}<span class="st-text">${lineHtml(beat.text)}</span></p><span class="st-more" aria-hidden="true">▾</span>`;
      box.hidden = false;
      box.scrollTop = 0;
      shownAt = performance.now();
    },
    // 自白期間顯示「跳過自白」（on）；第一次出現時開始算防誤觸時間，同一段自白裡一直留著
    skip(on) {
      if (!on) { skipBtn.hidden = true; skipArmed = Infinity; return; }
      if (!skipBtn.hidden) return;
      skipBtn.hidden = false;
      skipArmed = performance.now() + SKIP_ARM_MS;
      skipBtn.classList.remove('arm');
      void skipBtn.offsetWidth;
      skipBtn.classList.add('arm');
    },
    // 等玩家點一下（回傳 true；點了「跳過自白」回傳 'skip'）；換畫面時 cancel() 讓它回傳 false
    next() {
      finish(false);
      root.hidden = false;
      root.classList.add('waiting');
      root.classList.remove('passive');
      return new Promise((resolve) => { pending = { resolve }; });
    },
    // 互動關卡：字留著，點擊穿過去
    passive() {
      finish(false);
      root.hidden = false;
      root.classList.add('passive');
    },
    // place：center＝站在畫面中間（預設）；aside＝坐下喝咖啡時站在右手邊、小一點，不擋住桌上的杯子
    portrait(src, place = 'center', alt = '德叔') {
      const key = src ? `${src}|${place}` : '';
      if (portrait.dataset.src === key) return;
      portrait.dataset.src = key;
      if (!src) { portrait.innerHTML = ''; return; }
      portrait.innerHTML = `<img class="enter" src="assets/art/${src}.webp" alt="${esc(alt)}" style="${PORTRAIT_PLACE[place] || PORTRAIT_PLACE.center}">`;
      portrait.querySelector('img').onerror = (e) => e.target.remove();
    },
    // 可選互動熱點：[{ id, label, rect(base) → {x,y,w,h}（相對 #app），onTap, repeat }]
    hot(list) {
      cancelAnimationFrame(raf);
      hotLayer.innerHTML = '';
      hots = list.map((h) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'opr-hotspot';
        el.setAttribute('aria-label', h.label);
        el.dataset.id = h.id;
        el.onclick = (e) => {
          e.stopPropagation();
          if (el.disabled) return;
          if (!h.repeat) el.disabled = true;
          const done = h.onTap();
          if (h.repeat && done) el.disabled = true; // 要點好幾次的（抽屜、撥衣服）：做完才收起來
        };
        hotLayer.appendChild(el);
        return { ...h, el };
      });
      if (hots.length) place();
    },
    clearHot() { this.hot([]); },
    hideBox() { box.hidden = true; },
    hide() {
      finish(false);
      this.clearHot();
      this.portrait(null);
      this.skip(false);
      box.innerHTML = '';
      root.hidden = true;
      root.classList.remove('passive');
    },
    cancel() { finish(false); },
    // 可選互動做完要直接翻頁時（點床：躺下去，翻到下一句）
    advance() { if (pending) finish(true); },
    get waiting() { return !!pending; },
  };
}
