// 打烊時德叔的營業日誌：把一天的模擬結果寫成幾句話。純邏輯。
// 寫今天來了誰、坐在哪個角落、發生了什麼；不寫來客數、營收、滿意度。
import { CORNERS, DECOR, cornersOf } from './grid.js';
import { signatureRecipe, signatureIsPlayers } from './menu.js';
import { GUESTS } from './sim.js';
import { J } from './lines/journal.js';

const NUM = ['零', '一', '兩', '三', '四', '五', '六', '七', '八', '九', '十'];
export const num = (n) => NUM[n] ?? String(n);

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));

function mostCommon(list) {
  const m = new Map();
  for (const x of list) m.set(x, (m.get(x) || 0) + 1);
  let best = null;
  for (const [k, n] of m) if (!best || n > best[1]) best = [k, n];
  return best ? best[0] : null;
}

const whoText = (gs) => {
  const types = [...new Set(gs.map((g) => g.type))];
  if (types.length === 1) return `${num(gs.length)}位${GUESTS[types[0]].name}`;
  return types.slice(0, 2).map((t) => GUESTS[t].name).join('和');
};

// ctx：{ day, chapter, layout, menu, result, goalMet }
export function buildJournal({ chapter, layout, menu, result, goalMet }) {
  const lines = [];
  const gs = result.guests;

  // 各角落：誰坐、喝什麼
  for (const c of cornersOf(layout)) {
    const here = gs.filter((g) => g.corner === c.uid);
    const label = CORNERS[c.type].name;
    if (!here.length) {
      if (!c.fixed) lines.push(fill(J.corner_empty, { corner: label }));
      continue;
    }
    const drink = mostCommon(here.map((g) => g.orderName).filter(Boolean)) || '水';
    const likeType = { bar: 'resident', window: 'solo', worktable: 'laptop' }[c.type];
    const fans = here.filter((g) => g.type === likeType);
    if (fans.length && fans.length >= here.length / 2) {
      lines.push(fill(J[`${c.type}_${likeType}`], { num: num(fans.length), drink }));
    } else {
      const solo = here.filter((g) => g.type !== 'pair');
      if (solo.length) lines.push(fill(J[`${c.type}_other`], { who: whoText(solo), drink }));
    }
  }

  // 結伴的、外地的、找貓的、拍照的、等位子的、喝到怪怪的
  const pair = gs.find((g) => g.type === 'pair');
  if (pair) lines.push(fill(J.pair, { corner: CORNERS[pair.cornerType].name, drink: pair.orderName || '水' }));
  if (gs.some((g) => g.type === 'tourist')) lines.push(J.tourist);
  if (gs.some((g) => g.type === 'catlover')) lines.push(J.catlover);
  const photo = gs.find((g) => g.action === 'photo');
  if (photo) {
    const frame = layout.items.find((i) => i.type === 'frame');
    lines.push(fill(J.photo, { place: frame ? DECOR.frame.name : '窗外' }));
  }
  if (result.stats.waited) lines.push(J.waited);
  const weird = gs.find((g) => g.weird);
  if (weird) lines.push(fill(J.weird, { name: weird.orderName }));

  // 招牌
  const sig = signatureRecipe(menu);
  if (chapter >= 2) {
    if (!signatureIsPlayers(menu)) lines.push(J.sig_deshu);
    else if (!goalMet) {
      const n = result.stats.signatureOrders;
      lines.push(n ? fill(J.sig_some, { name: sig.name, num: num(n) }) : fill(J.sig_none, { name: sig.name }));
      // 線索：進門的人多半想喝什麼
      const top = mostCommon(gs.map((g) => g.type));
      if (top) lines.push(J[`taste_${top}`]);
    }
  }

  // 龍眼睡哪裡
  lines.push(J[`cat_${result.cat.place}`]);

  // 章節
  if (chapter === 1 && !layout.items.some((i) => i.kind === 'corner')) lines.push(J.ch1_empty);
  if (goalMet && chapter === 1) lines.push(J.ch1_done);
  if (goalMet && chapter === 2) lines.push(fill(J.ch2_done, { num: num(result.stats.signatureOrders) }));
  return lines;
}
