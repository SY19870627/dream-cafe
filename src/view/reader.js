// 開場的閱讀框（第三幕推門之後到第四幕結束）：沿用三天 AVG 的閱讀框樣式（.st-box／.st-line／.st-name／立繪）。
// 一句一句：點畫面任何地方（或 Enter／Space）出下一句；不點就停在這一句。
// 可選互動（點貓、點杯子、點床）是閱讀層上方的發光熱點，點了做那件事，不會順便翻頁。
// 互動關卡（推門、按住騎、岔路、掉頭）時閱讀框只顯示字，點擊穿過去交給底下的畫面。
import { SPEAKER_NAMES } from '../lines/opening.js';
import { play } from './audio.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export const TAP_GUARD_MS = 260; // 一句剛出來的一小段時間不收點（連點不會跳句）

export function createReader(root, app) {
  const box = root.querySelector('.opr-box');
  const portrait = root.querySelector('.opr-portrait');
  const hotLayer = root.querySelector('.opr-hot');
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
    if (!pending || e.target.closest('.opr-hotspot')) return;
    if (performance.now() - shownAt < TAP_GUARD_MS) return;
    play('tap');
    finish(true);
  });
  addEventListener('keydown', (e) => {
    if (!pending || root.hidden) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest?.('button, input, textarea, select, a, [contenteditable]')) return;
    e.preventDefault();
    if (performance.now() - shownAt < TAP_GUARD_MS) return;
    play('tap');
    finish(true);
  });

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
      const name = beat.who ? SPEAKER_NAMES[beat.who] : '';
      box.innerHTML = `<p class="st-line ${beat.who || 'narrator'}">${name ? `<span class="st-name">${esc(name)}</span>` : ''}<span class="st-text">${esc(beat.text)}</span></p><span class="st-more" aria-hidden="true">▾</span>`;
      box.hidden = false;
      box.scrollTop = 0;
      shownAt = performance.now();
    },
    // 等玩家點一下（回傳 true）；換畫面時 cancel() 讓它回傳 false
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
    portrait(src) {
      const key = src || '';
      if (portrait.dataset.src === key) return;
      portrait.dataset.src = key;
      if (!src) { portrait.innerHTML = ''; return; }
      portrait.innerHTML = `<img class="enter" src="assets/art/${src}.webp" alt="德叔" style="height:130%;top:7%">`;
      portrait.querySelector('img').onerror = (e) => e.target.remove();
    },
    // 可選互動熱點：[{ id, label, rect(base) → {x,y,w,h}（相對 #app），onTap }]
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
          el.disabled = true;
          h.onTap();
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
