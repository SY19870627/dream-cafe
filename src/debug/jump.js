// 跳關選單的內容（純邏輯）：每一幕的名字、有幾句。實際換進度用 story/state.js 的 jumpState。
import { OPENING_ACTS, lineCount, END_ACT, CARD_TEXTS } from '../story/state.js';
import { DAY_TITLES, DAY_ACT_VIEW, DAY_ACT_NAMES, SHOP_STILL_ACTS } from '../lines/days.js';

// 開場各幕（幕 id 照 state.js 的註解）
const OPENING_NAMES = {
  office: '辦公室', title: '標題',
  t4card: '字卡：我單方面辭退老闆前 4 天', mailbox: '收信（租屋處房間，點信封）', letter: '信（第一次讀，讀完淡出）',
  t2card: '字卡：我單方面辭退老闆前 2 天', eve: '特休前一晚（出發去東山）',
  road: '三合院外（夜裡）', deshu: '店裡（德叔）',
  sit: '店內點椅子', coffee: '坐下喝咖啡', depart: '三合院外（晚上，發動）', ride: '黑路', fork: '岔路',
  temple: '工寮與土地公廟', return: '回三合院外', stay: '店裡（晚上）', room: '庭埕、房間、第一晚自白',
  [END_ACT]: '待續',
};
// 店裡的幕（DAY_ACT_VIEW 也是 still，背景是店內 2D 定景）標「店內定景」；店內環景已拔掉
const VIEW_NAMES = { shop: '店內定景', still: '背景圖', card: '字卡', office: '辦公室' };
const viewOf = (act) => (SHOP_STILL_ACTS.includes(act) ? 'shop' : DAY_ACT_VIEW[act]);

// 一幕的顯示名：開場用上面的名字；第一天起用劇本段落名（lines/days.js 的 DAY_ACT_NAMES）＋畫面種類，有章名的幕加章名
export function actLabel(act) {
  if (OPENING_NAMES[act]) return OPENING_NAMES[act];
  const m = /^d(\d+)(\w+)$/.exec(act);
  if (!m && !DAY_ACT_NAMES[act]) return act;
  const title = DAY_TITLES[act];
  const view = viewOf(act) === 'card' ? null : VIEW_NAMES[viewOf(act)]; // 字卡的名字已經寫「字卡：」
  const name = DAY_ACT_NAMES[act] || `第${m[1]}天・${m[2]}`;
  return `${title ? `${title}｜` : ''}${name}${view ? `（${view}）` : ''}`;
}

// 選單分組：開場一組；之後每遇到一張倒數字卡或「第二天」「三天後」字卡就換一組（組名是卡上的字）；待續一組。
// （原本的「第一天」那組改成「我單方面辭退老闆前 1 天」）
const GROUP_AT = { d2card: '第二天', d5card: '三天後' };
export function jumpGroups() {
  const groups = [];
  let name = '開場';
  for (const act of OPENING_ACTS) {
    if (act === END_ACT) name = '待續';
    else if (CARD_TEXTS[act] != null) name = GROUP_AT[act] || CARD_TEXTS[act];
    let g = groups.at(-1);
    if (!g || g.name !== name) groups.push((g = { name, items: [] }));
    g.items.push({ act, label: `${act}　${actLabel(act)}`, lines: lineCount(act) });
  }
  return groups;
}
