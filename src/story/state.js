// v3b 進度（純邏輯）：開場哪一幕、劇本讀到哪一頁、兩個選項選了什麼。不碰 DOM、不碰 localStorage。
// 存檔只記「目前這一頁的 id」和「已選的答案」；回顧紀錄從這兩樣推出來，所以不會重複、也不會出現沒走的那一支。
// 每個轉移都要傳入「玩家眼前那一頁的 id」，跟存檔對不上就什麼都不做（回傳 false）：連點、換頁中的舊點擊都不會多推一頁。
import { sequence, listChoices, END_ID } from './script.js';

export const SCHEMA = 1;
// 開場各幕（與 v3a day.js 相同順序；這裡自己定義，執行時不必載入 v3a 的泡咖啡流程）
export const OPENING_ACTS = ['office', 'title', 'mailbox', 'letter', 'road', 'deshu', 'sit'];
export const FIRST_PAGE = 'op-act4-1';

export function newStoryState() {
  return {
    v: SCHEMA,
    phase: 'opening', // opening → story
    opening: { act: 'office', resignation: null, name: '', deshuLine: 0 },
    at: null, // 劇本目前這一頁的 id（phase === 'story' 時才有）
    choices: {}, // { share_tv: 'location'|'tv', note_share: 'note'|'warm' }
  };
}

/* ---------- 開場（流程與第一版相同，只往前） ---------- */
export function setOpeningAct(s, act) {
  if (s.phase !== 'opening') return false;
  const to = OPENING_ACTS.indexOf(act);
  const from = OPENING_ACTS.indexOf(s.opening.act);
  if (to < 0 || to <= from) return false;
  s.opening.act = act;
  return true;
}
export function setDeshuLine(s, n) {
  if (s.phase !== 'opening' || s.opening.act !== 'deshu' || n <= s.opening.deshuLine) return false;
  s.opening.deshuLine = Math.min(3, n);
  return true;
}
// 坐下：開場結束，接第四幕的兩句再進第一天
export function finishOpening(s) {
  if (s.phase !== 'opening' || s.opening.act !== 'sit') return false;
  s.opening.act = 'done';
  s.phase = 'story';
  s.at = FIRST_PAGE;
  return true;
}

/* ---------- 劇本 ---------- */
export function pagesOf(source, s) {
  return sequence(source, s.choices);
}
export function currentPage(source, s) {
  if (s.phase !== 'story') return null;
  return pagesOf(source, s).find((p) => p.id === s.at) || null;
}

// 下一頁：只有一般頁與章名頁能推；選項頁要選、end 頁沒有下一頁
export function advance(source, s, fromId) {
  if (s.phase !== 'story' || s.at !== fromId) return false;
  const pages = pagesOf(source, s);
  const i = pages.findIndex((p) => p.id === s.at);
  if (i < 0) return false;
  const p = pages[i];
  if (p.kind === 'choice' || p.kind === 'end') return false;
  const next = pages[i + 1];
  if (!next) return false;
  s.at = next.id;
  return true;
}

// 選一個答案：每個選項只能選一次；選完直接進那一支的第一頁
export function choose(source, s, choiceId, value) {
  if (s.phase !== 'story' || s.at !== choiceId) return false;
  const page = currentPage(source, s);
  if (!page || page.kind !== 'choice' || page.chosen != null) return false;
  if (Object.prototype.hasOwnProperty.call(s.choices, page.key)) return false;
  if (!page.options.some((o) => o.value === value)) return false;
  s.choices[page.key] = value;
  const pages = pagesOf(source, s);
  const i = pages.findIndex((p) => p.id === choiceId);
  s.at = pages[i + 1].id;
  return true;
}

export const isEnd = (s) => s.phase === 'story' && s.at === END_ID;

// 回顧：讀過的頁（到目前這一頁為止）＋選過的答案。目前這一頁若是還沒選的選項，不列選項內容。
export function history(source, s) {
  if (s.phase !== 'story') return [];
  const pages = pagesOf(source, s);
  const i = pages.findIndex((p) => p.id === s.at);
  if (i < 0) return [];
  const out = [];
  for (const p of pages.slice(0, i + 1)) {
    if (p.kind === 'line') for (const l of p.lines) out.push({ id: l.id, kind: 'line', speaker: l.speaker, name: l.name, text: l.text });
    else if (p.kind === 'title') out.push({ id: p.id, kind: 'title', text: p.text });
    else if (p.kind === 'choice' && p.chosen != null) {
      const o = p.options.find((x) => x.value === p.chosen);
      out.push({ id: p.id, kind: 'choice', text: o.label });
    }
  }
  return out;
}

/* ---------- 讀檔檢查 ---------- */
// 格式不對：從頭開始。欄位壞了：補預設。選項只留「目前頁之前就已經選過」的。
export function normalize(raw, source) {
  const s = newStoryState();
  if (!raw || typeof raw !== 'object' || raw.v !== SCHEMA) return s;
  if (raw.opening && typeof raw.opening === 'object') {
    const act = raw.opening.act;
    s.opening.act = OPENING_ACTS.includes(act) || act === 'done' ? act : 'office';
    s.opening.resignation = typeof raw.opening.resignation === 'string' ? raw.opening.resignation.slice(0, 20) : null;
    s.opening.name = typeof raw.opening.name === 'string' ? raw.opening.name.slice(0, 12) : '';
    s.opening.deshuLine = Math.max(0, Math.min(3, Math.floor(Number(raw.opening.deshuLine)) || 0));
  }
  if (raw.phase !== 'story') {
    if (s.opening.act === 'done') s.opening.act = 'sit';
    return s;
  }
  s.phase = 'story';
  s.opening.act = 'done';
  // 只收已知的 key 與合法的值
  const known = listChoices(source);
  if (raw.choices && typeof raw.choices === 'object') {
    for (const c of known) {
      const v = raw.choices[c.key];
      if (typeof v === 'string' && c.values.includes(v)) s.choices[c.key] = v;
    }
  }
  const at = typeof raw.at === 'string' ? raw.at : null;
  let pages = sequence(source, s.choices);
  let i = pages.findIndex((p) => p.id === at);
  if (i < 0) {
    // 找不到這一頁：回到劇本開頭，沒走到的選項一併丟掉
    s.choices = {};
    s.at = FIRST_PAGE;
    return s;
  }
  s.at = at;
  // 選項在目前頁「之後」才出現：不可能已經選了，丟掉
  for (const c of known) {
    if (!(c.key in s.choices)) continue;
    const ci = pages.findIndex((p) => p.id === c.id);
    if (ci < 0 || ci > i) delete s.choices[c.key];
  }
  pages = sequence(source, s.choices);
  i = pages.findIndex((p) => p.id === s.at);
  if (i < 0) { s.choices = {}; s.at = FIRST_PAGE; return s; }
  // 停在已經選過的選項頁：照已選的那一支往下（不再問一次）
  const p = pages[i];
  if (p.kind === 'choice' && p.chosen != null) s.at = pages[i + 1].id;
  return s;
}

/* ---------- 連點防護 ---------- */
// 選項剛出現的一小段時間內不收點擊（避免推頁的連點直接落在選項上）；推頁之間也留一點間隔。
export const CHOICE_ARM_MS = 400;
export const ADVANCE_GAP_MS = 140;
export function createGate() {
  let armedAt = 0;
  let lastAdvance = -Infinity;
  return {
    arm(now, ms = CHOICE_ARM_MS) { armedAt = now + ms; },
    canChoose(now) { return now >= armedAt; },
    canAdvance(now) {
      if (now - lastAdvance < ADVANCE_GAP_MS) return false;
      lastAdvance = now;
      return true;
    },
  };
}
