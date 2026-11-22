// v3b 進度（純邏輯）：開場哪一幕、劇本讀到哪一頁、兩個選項選了什麼。不碰 DOM、不碰 localStorage。
// 存檔只記「目前這一頁的 id」和「已選的答案」；回顧紀錄從這兩樣推出來，所以不會重複、也不會出現沒走的那一支。
// 每個轉移都要傳入「玩家眼前那一頁的 id」，跟存檔對不上就什麼都不做（回傳 false）：連點、換頁中的舊點擊都不會多推一頁。
import { sequence, listChoices, END_ID } from './script.js';
import { OPENING_LINES, OPENING_CARDS } from '../lines/opening.js';
import { DAY_LINES, DAY_ACTS, DAY_CARDS } from '../lines/days.js';

// 存檔格式版本。劇本 v5.9（倒數字卡版）升成 2：幕的順序變了（加了字卡、特休前一晚、接回場）。
// 版本 1 的存檔不打回開頭，照 V1_ACTS 對回最近的場次開頭（見 normalize）；1、2 以外的版本才從頭開始。
// 舊存檔另外由幕名判斷：舊幕名照 LEGACY_ACTS 接；跟新版同名的 d2cafe 用 v4.5 的舊欄位分辨（isLegacyD2cafe）。
export const SCHEMA = 2;
// 可玩流程各幕（只往前；幕 id 會存進存檔，不要改名）。劇本 v5.9 的玩家順序：
//   office 辦公室（離職申請單，玩家自己點事由、按送出）→ title 標題（下班）
//   → t4card 字卡「我單方面辭退老闆前 4 天」→ mailbox 租屋處房間、第一次收到信、點信封（幕 id 沿用）→ letter 信（讀完淡出）
//   → t2card 字卡「我單方面辭退老闆前 2 天」→ eve 特休前一晚（出發去東山）
//   → road 三合院外（夜裡，推門）→ deshu 店裡站著（到「泡好了」）→ sit 店內 2D 定景點椅子 → coffee 坐下喝咖啡（閱讀框）
//   → depart 三合院外（晚上，發動）→ ride 黑路（按住騎）→ fork 岔路 → temple 工寮與土地公廟（掉頭回去）→ return 回三合院外（再推門）
//   → stay 店裡（晚上）→ room 庭埕、護龍房間、第一晚自白
//   → t1card 字卡「我單方面辭退老闆前 1 天」→ d1wake 護龍早上（章名「最底下那個抽屜」）→ d1shop 店裡（鑰匙沒還成）
//   → d1town 下山、信箱、房東 → d1home 房間盤點 → d1bank 提款機 → d1store 超商
//   → t0card 字卡「我單方面辭退老闆當天　16:49」→ resend 接回：同一間辦公室自動送出、按「下班」
//   → d2card 字卡「第二天」→ d2cafe 第二天　回咖啡館 → d5card 字卡「三天後」→ d5cafe 咖啡館
//   → d5village 市調、坤伯院子 → d5thanks 坤伯來答謝 → d5brew 研發咖啡 → tbc 待續（帶咖啡去公司之前，這次切片到此）
//   第一晚之後不再睡護龍、沒有睡前自白（只有開場的 room 有）。
// 舊存檔的 end（舊版第一晚之後的待續）已不在列表裡：讀檔時接到第一晚之後（t1card，字卡後是第一天早上）。
// 舊版的幕名（v4.5、v5.7 未提交版）不在列表裡：讀檔時照 LEGACY_ACTS 接到新流程（該幕第 0 句）。
// 三天 AVG 模組保留，但只有 enterStory() 會進去，執行畫面不呼叫。
export const END_ACT = 'tbc';
export const LEGACY_END = 'end';
export const OPENING_ACTS = ['office', 'title', 't4card', 'mailbox', 'letter', 't2card', 'eve', 'road', 'deshu', 'sit', 'coffee', 'depart', 'ride', 'fork', 'temple', 'return', 'stay', 'room', ...DAY_ACTS, END_ACT];
// 只有一張字卡的幕 → 卡上的字（開場的倒數兩張＋第一天起的倒數兩張、第二天、三天後）
export const CARD_TEXTS = { ...OPENING_CARDS, ...DAY_CARDS };
export const isCardAct = (act) => Object.prototype.hasOwnProperty.call(CARD_TEXTS, act);
// 讀檔（開機後第一次進畫面）時，先重出「這一段最近的字卡」再回原句：回傳那張字卡的幕 id；沒有就 null。
// 開場（office、title，還沒有字卡）不出；停在字卡本身不另外再出（字卡自己會演）；待續不出。
export function resumeCardOf(s) {
  if (!s || s.phase !== 'opening') return null;
  const act = s.opening.act;
  if (act === END_ACT || isCardAct(act)) return null;
  const i = OPENING_ACTS.indexOf(act);
  for (let j = i - 1; j >= 0; j--) if (isCardAct(OPENING_ACTS[j])) return OPENING_ACTS[j];
  return null;
}
// 版本 1（劇本 v5.8 以前）的存檔：原「第二天」開頭（字卡「第二天」、第二天回咖啡館第 0 句）對到歸零字卡之前，
// 讓玩家補看接回場；其他幕名在 v5.9 仍是同一個場景，照原幕原句接著讀。
export const V1_TO_T0 = ['d2card'];
export const FORK_SIDES = ['left', 'right'];
// 拿掉的幕 → 新流程的幕（從第 0 句開始）。
//   v4.5：d1cafe／d1night（補完摺回店、睡前）→ d1store（超商下決心；新流程裡同一天剛補刷完）
//         第二～四天（洗把臉、公司、第十二頁、相機）→ d1wake（第一天早上，跟舊待續 end 同方向）
//         舊 d2cafe 跟新版同名、已在 OPENING_ACTS 裡，不在這張表：見 isLegacyD2cafe
//   v5.7（中途停下、未提交的實作；定存、當天付房租、再上山、人資訊息、濾掛包都已作廢）：照劇情位置接到 v5.8 最近的下一幕
//         d1rent／d1dusk／d1back（補摺之後的同一天）→ d1store；d1ride（第一天騎回住處）、d2home（第二天開頭）→ t0card
//         （v5.9：原「第二天」開頭對到歸零字卡之前，補看接回場）；d2back（第二天回店）→ d2cafe；d2ride、d3card、d3morn（第二天之後）→ d5card
export const LEGACY_ACTS = {
  d1rent: 'd1store', d1dusk: 'd1store', d1back: 'd1store', d1ride: 't0card', d2home: 't0card', d2back: 'd2cafe',
  d2ride: 'd5card', d3card: 'd5card', d3morn: 'd5card',
  d1cafe: 'd1store', d1night: 'd1store',
  d2wake: 'd1wake', d2shop: 'd1wake', d2town: 'd1wake', d2night: 'd1wake',
  d3wake: 'd1wake', d3shop: 'd1wake', d3town: 'd1wake', d3cafe: 'd1wake', d3night: 'd1wake',
  d4wake: 'd1wake', d4shop: 'd1wake', d4town: 'd1wake', d4cafe: 'd1wake', d4night: 'd1wake',
};
// 舊 v4.5 的 d2cafe：幕名跟新版「第二天・回咖啡館」一樣，用 v4.5 才有的欄位分辨（存摺選擇 passbook；
// normalize 不保留這個欄位，所以新版存過的檔不會有）。是舊檔就接到 d1wake；新版的 d2cafe 照原樣接著讀。
export const isLegacyD2cafe = (raw) => !!raw && raw.phase !== 'story' && raw.opening?.act === 'd2cafe'
  && Object.prototype.hasOwnProperty.call(raw.opening, 'passbook');
export const FIRST_PAGE = 'op-act4-1';
// 每一幕的句子（開場＋第一～四天）
export const ACT_LINES = { ...OPENING_LINES, ...DAY_LINES };
const linesOf = (act) => (Object.prototype.hasOwnProperty.call(ACT_LINES, act) ? ACT_LINES[act] : []);
// 每一幕有幾句（沒有句子的幕是 0：只有互動）
export const lineCount = (act) => linesOf(act).length;
// 下一幕（最後一幕沒有下一幕）
export function nextActOf(act) {
  const i = OPENING_ACTS.indexOf(act);
  return i >= 0 && i + 1 < OPENING_ACTS.length ? OPENING_ACTS[i + 1] : null;
}
// 有睡前自白的幕（只有開場的 room）；自白是哪幾句
export const isNightAct = (act) => linesOf(act).some((b) => b.sleep);
export const monoLines = (act) => linesOf(act).map((b, i) => (b.mono ? i : -1)).filter((i) => i >= 0);
export const beatAt = (s) => linesOf(s.opening.act)[s.opening.line] || null;
export const inMonologue = (s) => s.phase === 'opening' && !!beatAt(s)?.mono;

export function newStoryState() {
  return {
    v: SCHEMA,
    phase: 'opening', // 執行畫面永遠是 opening（開場與第一～四天都在這裡）；story 只給保留的三天 AVG 模組（測試）用
    opening: { act: 'office', resignation: null, name: '', line: 0, fork: null },
    at: null, // 劇本目前這一頁的 id（phase === 'story' 時才有）
    choices: {}, // { share_tv: 'location'|'tv', note_share: 'note'|'warm' }
  };
}

/* ---------- 關卡（做完才能往下） ---------- */
// 記住「眼前這一句的關卡已經做完」。不進存檔：做完會馬上翻到下一句並存檔；讀檔回來停在關卡那一句就要重做。
const cleared = new WeakMap();
const here = (s) => `${s.opening.act}:${s.opening.line}`;
const gateOpen = (s) => !beatAt(s)?.gate || cleared.get(s) === here(s);
// 互動關卡做完（door 推門、hold 按住騎、turnback 掉頭）。岔路要用 chooseFork（要記下選了哪一邊）。
// （第一天起「字出來之前要先做的互動」（lines/days.js 的 tap）不進這裡：字沒出來就翻不到下一句；讀檔回到那一句要重做。）
export function passGate(s, name) {
  const b = beatAt(s);
  if (s.phase !== 'opening' || !b || b.gate !== name || name === 'fork') return false;
  cleared.set(s, here(s));
  return true;
}

/* ---------- 開場與第一～四天（只往前） ---------- */
// 換幕：只能往後，換幕時句子從第 0 句開始。
// （關卡擋在 setOpeningLine：第一～四天的關卡都在幕中間，不做完翻不到下一句，也就走不到這一幕的最後；
//   開場那幾個在最後一句的關卡（再推門、掉頭、按住騎）由畫面擋，與原本相同。）
export function setOpeningAct(s, act) {
  if (s.phase !== 'opening') return false;
  const to = OPENING_ACTS.indexOf(act);
  const from = OPENING_ACTS.indexOf(s.opening.act);
  if (to < 0 || to <= from) return false;
  s.opening.act = act;
  s.opening.line = 0;
  cleared.delete(s);
  return true;
}
// 同一幕裡讀到第幾句（0 起算，就是畫面上正在顯示的那一句）：只往前、不超過這一幕的句數、不能跨過還沒做完的關卡
export function setOpeningLine(s, n) {
  if (s.phase !== 'opening' || !Number.isInteger(n)) return false;
  if (n <= s.opening.line || n >= lineCount(s.opening.act)) return false;
  const lines = linesOf(s.opening.act);
  for (let j = s.opening.line; j < n; j++) {
    if (!lines[j].gate) continue;
    if (j !== s.opening.line || !gateOpen(s)) return false;
  }
  s.opening.line = n;
  cleared.delete(s);
  return true;
}
// 舊名字（v3b 第一輪只記德叔三句）：現在每一幕都用同一個進度
export const setDeshuLine = setOpeningLine;
// 這一句之後要播哪一句；這一幕沒有了回傳 -1
export function nextLine(s) {
  const n = s.opening.line + 1;
  return n < lineCount(s.opening.act) ? n : -1;
}
// 岔路：左或右（後面的字都一樣），只選一次
export function chooseFork(s, side) {
  if (s.phase !== 'opening' || s.opening.act !== 'fork' || s.opening.fork != null || !FORK_SIDES.includes(side)) return false;
  s.opening.fork = side;
  if (beatAt(s)?.gate === 'fork') cleared.set(s, here(s));
  return true;
}
// 睡著：自白（mono）裡的任何一句都可以直接睡著（自然讀到最後一句，或點「跳過自白」）。
// 換到下一幕的第 0 句（第一晚之後是第一天早上）。呼叫的人接著存檔：這就是「睡著時自動存檔」的檢查點。
export function sleepThrough(s) {
  if (s.phase !== 'opening' || !isNightAct(s.opening.act) || !inMonologue(s)) return false;
  const next = nextActOf(s.opening.act);
  if (!next) return false;
  s.opening.act = next;
  s.opening.line = 0;
  cleared.delete(s);
  return true;
}
// 跳過本段自白：與自然睡著相同（剩下的自白不再一句一句出，直接睡著；呼叫的人存檔）
export const skipMonologue = sleepThrough;
// 研發咖啡之後（帶咖啡去公司之前）：待續
export const isOpeningEnd = (s) => s.phase === 'opening' && s.opening.act === END_ACT;
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
  if (!raw || typeof raw !== 'object' || (raw.v !== SCHEMA && raw.v !== 1)) return s;
  if (raw.opening && typeof raw.opening === 'object') {
    let act = raw.opening.act;
    const legacyEnd = act === LEGACY_END && raw.phase !== 'story';
    if (legacyEnd) act = DAY_ACTS[0]; // 舊版的待續（第一晚已經睡著）：不卡在舊待續、不重開，接到第一晚之後（字卡「前 1 天」→ 第一天早上）
    const legacyD2cafe = isLegacyD2cafe(raw);
    let legacyDay = legacyD2cafe || (raw.phase !== 'story' && typeof act === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_ACTS, act));
    if (legacyDay) act = legacyD2cafe ? DAY_ACTS[0] : LEGACY_ACTS[act]; // 舊版第一～四天的幕：接到新流程（第 0 句）
    // 版本 1：停在原「第二天」開頭（字卡「第二天」，或第二天回咖啡館第 0 句）→ 歸零字卡之前，補看接回場
    if (raw.v === 1 && !legacyDay && raw.phase !== 'story'
      && (V1_TO_T0.includes(act) || (act === 'd2cafe' && !(Math.floor(Number(raw.opening.line)) > 0)))) {
      act = 't0card';
      legacyDay = true;
    }
    s.opening.act = OPENING_ACTS.includes(act) || act === 'done' ? act : 'office';
    s.opening.resignation = typeof raw.opening.resignation === 'string' ? raw.opening.resignation.slice(0, 20) : null;
    s.opening.name = typeof raw.opening.name === 'string' ? raw.opening.name.slice(0, 12) : '';
    // 句子進度：新存檔用 line，第一輪存檔用 deshuLine；夾在這一幕的句數之內
    const rawLine = legacyEnd || legacyDay ? 0 : (raw.opening.line ?? raw.opening.deshuLine);
    const max = Math.max(0, lineCount(s.opening.act) - 1);
    s.opening.line = Math.max(0, Math.min(max, Math.floor(Number(rawLine)) || 0));
    s.opening.fork = FORK_SIDES.includes(raw.opening.fork) ? raw.opening.fork : null; // 舊檔的 passbook（v4.5 存摺選擇）不再保留
  }
  if (raw.phase !== 'story') {
    if (s.opening.act === 'done') { s.opening.act = 'sit'; s.opening.line = 0; }
    const at = OPENING_ACTS.indexOf(s.opening.act);
    if (at <= OPENING_ACTS.indexOf('fork')) s.opening.fork = null; // 還沒到岔路就不可能已經選了
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

/* ---------- 測試用跳關（只有網址帶 ?debug=1 的除錯面板會呼叫） ---------- */
// 回傳一份新的進度（不改傳入的 s）：停在 act 的第 line 句（夾在句數之內），phase 一律是 opening。
// 跳過的前提自動補上，讓那一幕能照常演：已經過了岔路就補左右（沿用原本的，沒有就 left）。
// 關卡做完的記號（cleared）在新物件上是空的：停在關卡那一句就要重做。最後過一次 normalize，跟讀檔走同一套規則。
// act 不在 OPENING_ACTS 裡回傳 null。
export function jumpState(s, act, line = 0) {
  if (!OPENING_ACTS.includes(act)) return null;
  const prev = (s && typeof s.opening === 'object' && s.opening) || {};
  const at = OPENING_ACTS.indexOf(act);
  const max = Math.max(0, lineCount(act) - 1);
  const n = Math.max(0, Math.min(max, Math.floor(Number(line)) || 0));
  const raw = {
    v: SCHEMA,
    phase: 'opening',
    opening: {
      act,
      line: n,
      resignation: prev.resignation ?? null,
      name: prev.name ?? '',
      fork: at > OPENING_ACTS.indexOf('fork') ? (FORK_SIDES.includes(prev.fork) ? prev.fork : FORK_SIDES[0]) : null,
    },
    at: null,
    choices: {},
  };
  return normalize(raw);
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
