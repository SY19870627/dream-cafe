// 菜單板（3 格）＋咖啡三步設計（豆子 → 沖法 → 加一味）＋指定招牌。
import { BEANS, BREWS, ADDS, MENU_SLOTS, tagsOf, weirdness, makeRecipe, defaultName, setSlot, setSignature } from '../menu.js';
import { esc } from './ui.js';

// root：#sheet；getMenu／setMenu：讀寫目前菜單；canDesign：第 2 章才開放
export function openMenuSheet(root, { getMenu, setMenu, canDesign, onClose }) {
  root.hidden = false;
  let editing = null; // { slot, bean, brew, add, name }

  function board() {
    const m = getMenu();
    let html = '<h2>菜單板</h2>';
    if (!canDesign) html += '<p class="note">咖啡怎麼沖，下一章再說。現在黑板上是德叔那杯。</p>';
    html += '<ol class="mb-slots">';
    for (let i = 0; i < MENU_SLOTS; i++) {
      const r = m.slots[i];
      const sig = m.signature === i;
      html += `<li class="mb-slot ${r ? '' : 'empty'} ${sig ? 'sig' : ''}">`;
      if (r) {
        html += `<div class="mb-name">${sig ? '<em>招牌</em>' : ''}${esc(r.name)}</div>
          <div class="mb-tags">${tagsOf(r).map((t) => `<span>${esc(t)}</span>`).join('')}${weirdness(r) ? '<span class="weird">怪怪的？</span>' : ''}</div>
          <div class="mb-by">${r.by === 'deshu' ? '德叔的' : '你設計的'}·${BEANS[r.bean].name}／${BREWS[r.brew].name}／${ADDS[r.add].name}</div>`;
        if (canDesign) {
          html += `<div class="mb-acts">
            <button type="button" data-act="edit" data-slot="${i}">改</button>
            ${sig ? '' : `<button type="button" data-act="sig" data-slot="${i}">設為招牌</button>`}
            <button type="button" data-act="clear" data-slot="${i}">擦掉</button></div>`;
        }
      } else {
        html += canDesign ? `<button type="button" class="mb-new" data-act="edit" data-slot="${i}">＋ 設計一杯</button>` : '<span class="mb-emptytext">（空）</span>';
      }
      html += '</li>';
    }
    html += '</ol><button type="button" class="primary sheet-close">好了</button>';
    root.innerHTML = `<div class="sheet-body">${html}</div>`;
    root.querySelector('.sheet-close').onclick = close;
    for (const b of root.querySelectorAll('[data-act]')) {
      b.onclick = () => {
        const slot = Number(b.dataset.slot);
        const act = b.dataset.act;
        if (act === 'sig') setMenu(setSignature(getMenu(), slot));
        if (act === 'clear') setMenu(setSlot(getMenu(), slot, null));
        if (act === 'edit') {
          const r = getMenu().slots[slot];
          editing = r ? { slot, bean: r.bean, brew: r.brew, add: r.add, name: r.by === 'player' ? r.name : '' } : { slot, bean: 'dongshan', brew: 'pour', add: 'none', name: '' };
          designer();
          return;
        }
        board();
      };
    }
  }

  function designer() {
    const e = editing;
    const row = (title, key, opts) => `<div class="ds-row"><h3>${title}</h3><div class="ds-opts">${Object.entries(opts).map(([id, o]) =>
      `<button type="button" data-k="${key}" data-v="${id}" class="${e[key] === id ? 'on' : ''}">${esc(o.name)}</button>`).join('')}</div></div>`;
    const preview = { bean: e.bean, brew: e.brew, add: e.add };
    const w = weirdness(preview);
    const m = getMenu();
    const willSig = m.signature === e.slot || !m.slots.some((r, i) => r?.by === 'player' && i !== e.slot);
    root.innerHTML = `<div class="sheet-body">
      <h2>設計一杯</h2>
      ${row('1. 豆子', 'bean', BEANS)}
      ${row('2. 沖法', 'brew', BREWS)}
      ${row('3. 加一味', 'add', ADDS)}
      <div class="ds-tags">${tagsOf(preview).map((t) => `<span>${esc(t)}</span>`).join('')}${w ? `<span class="weird">${esc(w.why)}，可能怪怪的</span>` : ''}</div>
      <label class="ds-name">取個名字 <input maxlength="10" value="${esc(e.name)}" placeholder="${esc(defaultName(preview))}"></label>
      <label class="ds-sig"><input type="checkbox" ${willSig ? 'checked' : ''}> 當招牌</label>
      <div class="ds-acts"><button type="button" class="ds-cancel">算了</button><button type="button" class="primary ds-ok">寫上黑板</button></div>
    </div>`;
    const name = root.querySelector('.ds-name input');
    name.oninput = () => { e.name = name.value; };
    for (const b of root.querySelectorAll('[data-k]')) b.onclick = () => { e[b.dataset.k] = b.dataset.v; designer(); };
    root.querySelector('.ds-cancel').onclick = () => { editing = null; board(); };
    root.querySelector('.ds-ok').onclick = () => {
      let menu = setSlot(getMenu(), e.slot, makeRecipe(e.bean, e.brew, e.add, e.name));
      if (root.querySelector('.ds-sig input').checked) menu = setSignature(menu, e.slot);
      setMenu(menu);
      editing = null;
      board();
    };
  }

  function close() {
    root.hidden = true;
    root.innerHTML = '';
    onClose?.();
  }

  board();
  return { close };
}
