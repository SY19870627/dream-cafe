// 共用的小 UI：對話框（德叔說話、旁白）、短提示。
const $ = (id) => document.getElementById(id);
export const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

let sayToken = 0;
// 顯示一句話；點一下或 ms 毫秒後 resolve。who 為空代表旁白
export function say(text, { who = '德叔', ms = 4200, speed = 1 } = {}) {
  const box = $('say');
  const my = ++sayToken;
  box.hidden = false;
  box.classList.toggle('narr', !who);
  box.innerHTML = `${who ? `<b>${esc(who)}</b>` : ''}<p>${esc(text)}</p><i class="say-next">▼</i>`;
  return new Promise((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      box.onclick = null;
      resolve(my === sayToken);
    };
    box.onclick = end;
    setTimeout(end, ms / speed);
  });
}

export function hideSay() {
  sayToken++;
  const box = $('say');
  box.hidden = true;
  box.onclick = null;
}

let toastTimer = 0;
export function toast(text, ms = 1800) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
