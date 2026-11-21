// 跳關選單的內容（純邏輯）：每一幕的名字、有幾句。實際換進度用 story/state.js 的 jumpState。
import { OPENING_ACTS, lineCount, END_ACT } from '../story/state.js';
import { DAY_TITLES, DAY_ACT_VIEW, DAY_ACT_NAMES } from '../lines/days.js';

// 開場各幕（幕 id 照 state.js 的註解）
const OPENING_NAMES = {
  office: '辦公室', title: '標題', mailbox: '信箱', letter: '信', road: '三合院外（傍晚）', deshu: '店裡（德叔）',
  sit: '店內 360 點椅子', coffee: '坐下喝咖啡', depart: '三合院外（晚上，發動）', ride: '黑路', fork: '岔路',
  temple: '工寮與土地公廟', return: '回三合院外', stay: '店裡（晚上）', room: '庭埕、房間、第一晚自白',
  [END_ACT]: '待續',
};
const VIEW_NAMES = { shop: '店內 360', still: '背景圖', card: '字卡' };

// 一幕的顯示名：開場用上面的名字；第一天起用劇本段落名（lines/days.js 的 DAY_ACT_NAMES）＋畫面種類，有章名的幕加章名
export function actLabel(act) {
  if (OPENING_NAMES[act]) return OPENING_NAMES[act];
  const m = /^d(\d+)(\w+)$/.exec(act);
  if (!m) return act;
  const title = DAY_TITLES[act];
  const view = VIEW_NAMES[DAY_ACT_VIEW[act]];
  const name = DAY_ACT_NAMES[act] || `第${m[1]}天・${m[2]}`;
  return `${title ? `${title}｜` : ''}${name}${view ? `（${view}）` : ''}`;
}

// 選單分組：開場一組、每一天一組；每一項 { act, label, lines }
export function jumpGroups() {
  const groups = [];
  const groupOf = (act) => {
    const m = /^d(\d+)/.exec(act);
    return m ? `第${m[1]}天` : act === END_ACT ? '待續' : '開場';
  };
  for (const act of OPENING_ACTS) {
    const name = groupOf(act);
    let g = groups.at(-1);
    if (!g || g.name !== name) groups.push((g = { name, items: [] }));
    g.items.push({ act, label: `${act}　${actLabel(act)}`, lines: lineCount(act) });
  }
  return groups;
}
