// v3b 進度（純邏輯）：開場哪一幕、劇本讀到哪一頁、兩個選項選了什麼。不碰 DOM、不碰 localStorage。
// 存檔只記「目前這一頁的 id」和「已選的答案」；回顧紀錄從這兩樣推出來，所以不會重複、也不會出現沒走的那一支。
// 每個轉移都要傳入「玩家眼前那一頁的 id」，跟存檔對不上就什麼都不做（回傳 false）：連點、換頁中的舊點擊都不會多推一頁。
import { sequence, listChoices, END_ID } from './script.js';
import { OPENING_LINES } from '../lines/opening.js';

export const SCHEMA = 1;
// 開場各幕（劇本 v3.8 開場到第四幕，只往前）：
//   office 辦公室 → title 標題 → mailbox 信箱 → letter 信 → road 三合院外（傍晚，推門）→ deshu 店裡站著（到「泡好了」）
//   → sit 店內 360 點椅子 → coffee 坐下喝咖啡（閱讀框）→ depart 三合院外（晚上，發動）→ ride 黑路（按住騎）→ fork 岔路
//   → temple 工寮與土地公廟（掉頭回去）→ return 回三合院外（再推門）→ stay 店裡（晚上）→ room 庭埕與護龍房間 → end 待續
// end 之後沒有下一幕：可玩流程不會進入第一天（三天 AVG 模組保留，但只有 enterStory() 會進去，執行畫面不呼叫）。
export const OPENING_ACTS = ['office', 'title', 'mailbox', 'letter', 'road', 'deshu', 'sit', 'coffee', 'depart', 'ride', 'fork', 'temple', 'return', 'stay', 'room', 'end'];
export const FORK_SIDES = ['left', 'right'];
export const FIRST_PAGE = 'op-act4-1';
// 每一幕有幾句（沒有句子的幕是 0：只有互動）
export const lineCount = (act) => (Object.prototype.hasOwnProperty.call(OPENING_LINES, act) ? OPENING_LINES[act].length : 0);

export function newStoryState() {
  return {
    v: SCHEMA,
    phase: 'opening', // 執行畫面永遠是 opening；story 只給保留的三天 AVG 模組（測試）用
    opening: { act: 'office', resignation: null, name: '', line: 0, fork: null },
    at: null, // 劇本目前這一頁的 id（phase === 'story' 時才有）
    choices: {}, // { share_tv: 'location'|'tv', note_share: 'note'|'warm' }
  };
}

/* ---------- 開場（只往前） ---------- */
// 換幕：只能往後，換幕時句子從第 0 句開始
export function setOpeningAct(s, act) {
  if (s.phase !== 'opening') return false;
  const to = OPENING_ACTS.indexOf(act);
  const from = OPENING_ACTS.indexOf(s.opening.act);
  if (to < 0 || to <= from) return false;
  s.opening.act = act;
  s.opening.line = 0;
  return true;
}
// 同一幕裡讀到第幾句（0 起算，就是畫面上正在顯示的那一句）：只往前、不超過這一幕的句數
export function setOpeningLine(s, n) {
  if (s.phase !== 'opening' || !Number.isInteger(n)) return false;
  if (n <= s.opening.line || n >= lineCount(s.opening.act)) return false;
  s.opening.line = n;
  return true;
}
// 舊名字（v3b 第一輪只記德叔三句）：現在每一幕都用同一個進度
export const setDeshuLine = setOpeningLine;
// 岔路：左或右（後面的字都一樣），只選一次
export function chooseFork(s, side) {
  if (s.phase !== 'opening' || s.opening.act !== 'fork' || s.opening.fork != null || !FORK_SIDES.includes(side)) return false;
  s.opening.fork = side;
  return true;
}
// 最後一句（睡著）讀完：開場結束，停在「待續」。不進第一天。
export function finishOpening(s) {
  if (s.phase !== 'opening' || s.opening.act !== 'room' || s.opening.line !== lineCount('room') - 1) return false;
  s.opening.act = 'end';
  s.opening.line = 0;
  return true;
}
export const isOpeningEnd = (s) => s.phase === 'opening' && s.opening.act === 'end';
// 執行畫面讀檔後再過一次：舊版存到三天故事裡的存檔（phase story）不接著播，回到開場開頭
export function playable(s) {
  return s && s.phase === 'opening' ? s : newStoryState();
}
// 保留的三天 AVG 模組入口（只給單元測試；執行畫面不呼叫）
export function enterStory(s) {
  s.phase = 'story';
  s.opening.act = 'done';
  s.opening.line = 0;
  s.at = FIRST_PAGE;
  return s;
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
    // 句子進度：新存檔用 line，第一輪存檔用 deshuLine；夾在這一幕的句數之內
    const rawLine = raw.opening.line ?? raw.opening.deshuLine;
    const max = Math.max(0, lineCount(s.opening.act) - 1);
    s.opening.line = Math.max(0, Math.min(max, Math.floor(Number(rawLine)) || 0));
    s.opening.fork = FORK_SIDES.includes(raw.opening.fork) ? raw.opening.fork : null;
  }
  if (raw.phase !== 'story') {
    if (s.opening.act === 'done') { s.opening.act = 'sit'; s.opening.line = 0; }
    if (OPENING_ACTS.indexOf(s.opening.act) <= OPENING_ACTS.indexOf('fork')) s.opening.fork = null; // 還沒到岔路就不可能已經選了
    return s;
  }
  s.phase = 'story';
  s.opening.act = 'done';
  s.opening.line = 0;
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
