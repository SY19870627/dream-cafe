// 每杯咖啡的五步流程與劇情事件插入（v3.0 驗證版）。
// 純邏輯：不碰 DOM、不碰 localStorage，用 node --test 測試。
// 一天：點餐 order → 機關 brew → 喝 drink → 筆記本 notebook → 夢想 dream → 回店 return →（下一天）
// 第 3 天開頭插一次送咖啡回公司 company；第 5 天回店之後是 rest（沒有第六天、沒有結局）。
// 每個轉移都先檢查目前的 phase，不符合就什麼都不做（回傳 false）：連點、重新整理後重送都不會重複派發。
import { MENU } from './lines/shop.js';
import { DREAM_ORDER } from './dreams/index.js';

export const LAST_DAY = 5;
export const COMPANY_DAY = 3;
export const SCHEMA = 1;

// 開場進度（依序，只會往前）：辦公室 → 標題 → 信箱 → 律師信 → 縣道 → 推門後德叔三句 → 「先坐。」
export const OPENING_ACTS = ['office', 'title', 'mailbox', 'letter', 'road', 'deshu', 'sit'];
export const PHASES = ['opening', 'order', 'brew', 'drink', 'notebook', 'dream', 'return', 'company', 'rest'];
// 送咖啡的步驟（依序）
export const COMPANY_STEPS = ['ride', 'talk', 'sleeve', 'leave', 'laugh'];

export function newState() {
  return {
    v: SCHEMA,
    day: 0, // 第 0 天只有開場
    phase: 'opening',
    opening: { act: 'office', resignation: null, name: '', deshuLine: 0 },
    orders: {}, // { 天數: 菜單 id }
    brewStartedAt: null, // 機關開始的時間（ms），重新整理時從這裡接著播
    dreamsOpened: [], // 已翻開的夢想 id（依天數順序）
    tapped: {}, // { 夢想 id: [已點過的物件 id] }
    takeaways: [], // 已帶回店裡的夢想 id（帶回物的名字在 lines/dreams.js）
    interacted: [], // 已做過那一個互動的夢想 id（每條最多一次）
    company: { done: false, step: 'ride', line: 0 },
  };
}

export const dreamForDay = (day) => (day >= 1 && day <= LAST_DAY ? DREAM_ORDER[day - 1] : null);

/* ---------- 開場 ---------- */
export function setOpeningAct(s, act) {
  if (s.phase !== 'opening') return false;
  const to = OPENING_ACTS.indexOf(act);
  const from = OPENING_ACTS.indexOf(s.opening.act);
  if (to < 0 || to <= from) return false; // 只往前
  s.opening.act = act;
  return true;
}
export function finishOpening(s) {
  if (s.phase !== 'opening' || s.opening.act !== 'sit') return false;
  s.opening.act = 'done';
  s.day = 1;
  s.phase = 'order';
  return true;
}

/* ---------- 一杯咖啡 ---------- */
export function order(s, itemId, now = Date.now()) {
  if (s.phase !== 'order') return false;
  if (!MENU.some((m) => m.id === itemId)) return false;
  s.orders[s.day] = itemId;
  s.phase = 'brew';
  s.brewStartedAt = now;
  return true;
}
export function brewDone(s) {
  if (s.phase !== 'brew') return false;
  s.phase = 'drink';
  s.brewStartedAt = null;
  return true;
}
export function drink(s) {
  if (s.phase !== 'drink') return false;
  s.phase = 'notebook';
  return true;
}
// 翻開筆記本的一頁：今天的夢想記一次，畫面切過去
export function openNotebook(s) {
  if (s.phase !== 'notebook') return false;
  const id = dreamForDay(s.day);
  if (!id) return false;
  if (!s.dreamsOpened.includes(id)) s.dreamsOpened.push(id);
  s.phase = 'dream';
  return true;
}
export function tapObject(s, objId) {
  if (s.phase !== 'dream') return false;
  const id = dreamForDay(s.day);
  const list = (s.tapped[id] ||= []);
  if (!list.includes(objId)) list.push(objId);
  return true;
}
// 夢想裡那一個互動（拉被子、伸手、丟球、翻頁、推門）：每條最多一次，做不做都可以回店
export function interact(s) {
  if (s.phase !== 'dream') return false;
  const id = dreamForDay(s.day);
  if (!id || s.interacted.includes(id)) return false;
  s.interacted.push(id);
  return true;
}
// 從夢想場景的出口回店（不要求點完所有物件、不要求做過互動）
export function leaveDream(s) {
  if (s.phase !== 'dream') return false;
  s.phase = 'return';
  return true;
}
// 回店（return）不需要玩家再點：畫面先讓帶回物停在桌上 RETURN_SHOW_MS，畫面自己呼叫 placeTakeaway()
export const RETURN_SHOW_MS = 4000;
// 把帶回來的東西放上架：這一天結束；第 5 天之後停在 rest
export function placeTakeaway(s) {
  if (s.phase !== 'return') return false;
  const id = dreamForDay(s.day);
  if (id && !s.takeaways.includes(id)) s.takeaways.push(id);
  if (s.day >= LAST_DAY) {
    s.phase = 'rest';
    return true;
  }
  s.day += 1;
  s.phase = s.day === COMPANY_DAY && !s.company.done ? 'company' : 'order';
  return true;
}

/* ---------- 送咖啡回公司（只一次） ---------- */
export function companyStep(s, step) {
  if (s.phase !== 'company') return false;
  const to = COMPANY_STEPS.indexOf(step);
  if (to <= COMPANY_STEPS.indexOf(s.company.step)) return false;
  s.company.step = step;
  return true;
}
export function companyLine(s, n) {
  if (s.phase !== 'company' || s.company.step !== 'talk' || n <= s.company.line) return false;
  s.company.line = n;
  return true;
}
export function finishCompany(s) {
  if (s.phase !== 'company' || s.company.step !== 'laugh') return false;
  s.company.done = true;
  s.phase = 'order';
  return true;
}

/* ---------- 存檔讀回來的檢查 ---------- */
// 格式不對就從頭開始（沒有舊存檔遷移）；欄位缺了補預設
export function normalize(raw) {
  const s = newState();
  if (!raw || typeof raw !== 'object' || raw.v !== SCHEMA) return s;
  if (!PHASES.includes(raw.phase)) return s;
  const day = Number(raw.day);
  if (!Number.isInteger(day) || day < 0 || day > LAST_DAY) return s;
  if ((raw.phase === 'opening') !== (day === 0)) return s;
  s.day = day;
  s.phase = raw.phase;
  if (raw.opening && typeof raw.opening === 'object') {
    const act = raw.opening.act;
    s.opening.act = OPENING_ACTS.includes(act) || act === 'done' ? act : 'office';
    s.opening.resignation = typeof raw.opening.resignation === 'string' ? raw.opening.resignation : null;
    s.opening.name = typeof raw.opening.name === 'string' ? raw.opening.name.slice(0, 12) : '';
    s.opening.deshuLine = Math.max(0, Math.min(3, Number(raw.opening.deshuLine) || 0));
  }
  if (s.phase === 'opening' && s.opening.act === 'done') s.opening.act = 'sit';
  if (raw.orders && typeof raw.orders === 'object') {
    for (const [d, id] of Object.entries(raw.orders)) if (MENU.some((m) => m.id === id) && Number(d) >= 1 && Number(d) <= day) s.orders[d] = id;
  }
  s.brewStartedAt = s.phase === 'brew' && Number.isFinite(raw.brewStartedAt) ? raw.brewStartedAt : null;
  const known = (id) => DREAM_ORDER.includes(id);
  // 夢想只能是第 1～day 天的，順序照固定清單
  const allowed = DREAM_ORDER.slice(0, day);
  s.dreamsOpened = allowed.filter((id) => Array.isArray(raw.dreamsOpened) && raw.dreamsOpened.includes(id));
  s.takeaways = allowed.filter((id) => Array.isArray(raw.takeaways) && raw.takeaways.includes(id));
  s.interacted = allowed.filter((id) => Array.isArray(raw.interacted) && raw.interacted.includes(id));
  if (raw.tapped && typeof raw.tapped === 'object') {
    for (const [id, list] of Object.entries(raw.tapped)) if (known(id) && Array.isArray(list)) s.tapped[id] = list.filter((x) => typeof x === 'string');
  }
  if (raw.company && typeof raw.company === 'object') {
    s.company.done = !!raw.company.done;
    s.company.step = COMPANY_STEPS.includes(raw.company.step) ? raw.company.step : 'ride';
    s.company.line = Math.max(0, Number(raw.company.line) || 0);
  }
  if (s.phase === 'company' && (s.day !== COMPANY_DAY || s.company.done)) s.phase = 'order';
  if (s.phase === 'rest' && s.day !== LAST_DAY) return newState();
  // 已經在夢想裡或回店途中：今天的夢想一定算翻開過
  if ((s.phase === 'dream' || s.phase === 'return') && !s.dreamsOpened.includes(dreamForDay(s.day))) s.dreamsOpened = DREAM_ORDER.slice(0, s.day);
  if (s.phase === 'brew' && s.brewStartedAt == null) s.brewStartedAt = Date.now();
  return s;
}
