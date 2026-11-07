// 熟客的來訪段落（文本與關係鋪陳，提案 _agent/relationship-proposal-a161cf1.md 與補稿 relationship-drafts-zhe-kevin.md，
// 依 fable（claude-fable-5-1）審稿 _agent/fable-relationship-review.md 全部建議改過；採納清單見 _agent/fable-applied-summary.md）：
// - 陌生 → 點單寒暄 → 閒聊 → 自己說出身世 → 熟了以後才請咖啡。予安前 4 次＋第 5 次與 yuan3、阿哲到 zhe2、凱文到 kevin3 的鋪陳。
// - 段落綁在「兩個里程碑之間的窗口」，不是綁在次數（fable 第四節 1）：窗口關了（下一個里程碑已經發生）就跳過，不補演、不在日誌倒播。
// - 里程碑當天的擴寫（kind: 'with'）：老闆坐著時取代那個里程碑的場景；原場景的每一句 say 照順序都在裡面（單元測試檢查子序列）。
//   老闆站著、或里程碑離線發生時，照舊演原場景、寫日誌（條件、順序一字不改）。
// - 接回（kind: 'reconnect'）：yuan2、zhe2、kevin3 沒有在老闆坐著時演到擴寫版，之後第一次見到他時演一段短的接回（zhe2、kevin3 結尾一樣問第一杯）。
// - 第一杯（最愛第一段）延到 yuan3／zhe2／kevin3 之後開放（favorites.js 的 after），在那一段的末尾用選項自然邀請一次（invite）。
// - 每位熟客一天最多一段、全店一天最多兩段；在場的里程碑（含同日擴寫）算一段（fable 第四節 10），里程碑本身也受這個上限（承峰採用預設）：
//   今天這位熟客已經有一段、或全店已經兩段時，那個里程碑今天不開始演（milestoneRoom()）：不記完成、不給獎勵、不跳過，
//   條件、順序、獎勵一字不改，只是開始演的那一刻延到下一個有份量的遊玩日；老闆不在的日子照舊由營業日誌結算（story.js 的 settleThrough()）。
//   所以擴寫與結尾的第一杯不會因為份量滿了消失（有份量時里程碑和擴寫一起演；沒份量時兩個都等）。
// - yuan3 演過、結尾的第一杯卻沒問到（選項出來前重新整理、換了一天等）：之後第一次見到她時的短接回（yuan-r3），只補那個邀請，
//   用 yuan-v6 結尾那一組選項與分支（fable 審過），不另寫新句、不重演 yuan3。
// - 閒聊只在老闆坐著時演（推近鏡頭只在坐著時有）；站著時德叔提一次「先坐。」（開場原句）。
// - 點熟客時「請德叔端一杯」的選項：每位熟客一天只主動問一次（offered）。
// 段落的台詞與步驟在劇本檔 scripts/<熟客>.yaml 的 segments（D224；src/script.js 載入、編譯成和 story.js 同一套步驟），這裡只留排程與存檔。
// 步驟除了 story.js 的那幾種，來訪段落多用到：
//   choice 的 speak：選了以後，老闆那句以「你」的泡泡說出來（括號開頭的「（點點頭）」這種不出泡泡，fable 第四節 8）；劇本檔的段落一律 speak
//   when：只在某個條件下演（condOk()；條件是字串，別名在 scripts/_shared.yaml 的 conds：catSill、peeked、met……）
//   mark：記一件事（flag: 'metYuan' 予安說出名字；early: 'd2-refill' 第二杯在段落裡演過，前三天的小段落不再演）
//   catMove：龍眼在窗台上的小動作（不離開窗台，Q64）；narrate：旁白（D224）
// 客人說出名字以前的稱呼與自我介紹也是資料（scripts/_shared.yaml 的 regulars：stranger、intro；strangerName()、introLine()）。
// 存檔第 13 版的 rel（save.js）。純邏輯，不依賴 Three.js 或 DOM；不 import story.js（story.js 的 allLines() 讀這裡）。
// 新寫的句子全部【待定】；劇本檔裡 tag: 原句 的是已上線的句子，一字不改搬進來。
import * as FV from './favorites.js';
import * as M from './menu.js';
import { SCRIPT } from './script.js';

export const REL_IDS = ['yuan', 'zhe', 'kevin'];
export const DAY_CAP = 2; // 全店一天最多兩段（含在場的里程碑）
export const SEAT_HINT = SCRIPT.lines.seatHint; // 開場原句（德叔），閒聊要老闆坐著時提一次
export const YUAN_STRANGER = SCRIPT.regulars.yuan.stranger.name; // 予安說出名字以前，泡泡上的名字【待定】（提案原則 4）
export const VISIT_QUIET_MS = 8000; // 店裡安靜這麼久（遊戲時間）之後，才開始來訪段落（熟客剛坐下、剛說完話時不馬上開始）
export const VISIT_WAIT = SCRIPT.lines.visitWait; // 坐下後等來訪段落開始時的提示（承峰 11/8 定稿）
// 等來訪段落的提示列：pending＝現在有沒有待演的 visit／reconnect；remainingMs＝離開始還有幾毫秒遊戲時間。
// 秒數無條件進位，最少 1 秒（時間到了、還在等店裡安靜下來時也寫 1 秒）；沒有要等的段落是 null
export function visitWaitHint(pending, remainingMs) {
  if (!pending) return null;
  const sec = Math.max(1, Math.ceil(Math.max(0, remainingMs) / 1000));
  return `${VISIT_WAIT}（${sec} 秒）`;
}

// 段落：id、who、kind（with＝里程碑當天的擴寫；visit＝里程碑之間；reconnect＝離線發生之後的接回）
//   with：取代哪一個里程碑的場景（id）；after／before：窗口（第幾個里程碑發生之後、第幾個發生之前）；of：接回哪一個里程碑
//   invite：結尾的第一杯 { options [{ id, text }]（treat＝我請）, yes, no, missing（黑板上沒有那一杯）, drink, any（喝的不限）, need（黑板上要有的點心） }，
//   或另一段的 id（同一組選項與分支）
export const SEGMENTS = SCRIPT.segments;

const BY_ID = new Map(SEGMENTS.map((s) => [s.id, s]));
export const segmentById = (id) => BY_ID.get(id) || null;
// 接回的 invite 寫成另一段的 id（同一組選項與分支）
export function inviteOf(seg) {
  if (!seg?.invite) return null;
  return typeof seg.invite === 'string' ? segmentById(seg.invite)?.invite || null : seg.invite;
}

// invited：段落結尾的第一杯已經問過（老闆選了其中一個選項）的熟客
export const blankRel = () => ({ done: [], seen: [], today: { day: 0, slots: [] }, offered: { yuan: 0, zhe: 0, kevin: 0 }, invited: [] });
const relOf = (save) => {
  if (!save.rel) save.rel = blankRel();
  if (!save.rel.invited) save.rel.invited = []; // 第 13 版剛加上 rel 時還沒有這一欄
  return save.rel;
};
const has = (save, who, n) => (save.regulars?.[who]?.milestones || []).includes(n);
const milestoneN = (id) => Number(String(id).replace(/\D+/g, '')) || 0;
const whoOf = (id) => String(id).replace(/\d+$/, '');

// 段落現在的窗口：'open' 可以演、'early' 還沒到、'closed' 過了（作廢）
export function windowOf(save, seg) {
  const r = relOf(save);
  if (r.done.includes(seg.id)) return 'closed';
  if (seg.kind === 'with') return has(save, seg.who, milestoneN(seg.with)) ? 'closed' : 'early';
  if (seg.before && has(save, seg.who, seg.before)) return 'closed';
  if (seg.kind === 'reconnect') {
    if (!has(save, seg.who, milestoneN(seg.of))) return 'early';
    // 只補第一杯的接回（yuan-r3）：已經問過、或第一段已經找到（點她請過了）就不用補
    if (seg.uninvited) return r.invited.includes(seg.who) || FV.current(save, seg.who)?.n !== 1 ? 'closed' : 'open';
    return r.seen.includes(seg.of) ? 'closed' : 'open';
  }
  return has(save, seg.who, seg.after) ? 'open' : 'early';
}
// 過期的段落記成演過（跳過，不補演、不倒播）。回傳這次跳過的 id
export function expire(save) {
  const r = relOf(save), out = [];
  for (const seg of SEGMENTS) if (!r.done.includes(seg.id) && windowOf(save, seg) === 'closed') { r.done.push(seg.id); out.push(seg.id); }
  return out;
}

// 今天的份量：slots＝今天已經用掉一段的熟客（在場的里程碑、擴寫、來訪段落都算一段）
function todayOf(save, day) {
  const r = relOf(save);
  if (r.today.day !== day) r.today = { day, slots: [] };
  return r.today;
}
export const slotsToday = (save, day) => [...todayOf(save, day).slots];
// 老闆在店裡看到一個里程碑演完（不管有沒有擴寫）：那位熟客今天的一段用掉了
export function noteMilestone(save, who, day) {
  const t = todayOf(save, day);
  if (!t.slots.includes(who)) t.slots.push(who);
}

// 老闆在場時，這位熟客現在可以演的來訪段落／接回（沒有就是 null）。不看老闆坐著沒（呼叫端看；站著時德叔提一次 SEAT_HINT）
// c：{ milestoneDue 這位熟客今天還有里程碑要演（里程碑優先）, reserved 今天別的熟客還要演的里程碑有幾個（先留給它們） }
export function dueVisit(save, who, day, { milestoneDue = false, reserved = 0 } = {}) {
  if (milestoneDue) return null;
  if (!roomToday(save, who, day, reserved)) return null;
  if ((save.regulars?.[who]?.lastMilestoneDay || 0) === day) return null;
  expire(save);
  return SEGMENTS.find((s) => s.who === who && s.kind !== 'with' && windowOf(save, s) === 'open') || null;
}
// 今天還能不能多演一段（在場的里程碑、擴寫、來訪段落）：這位熟客今天還沒有一段，全店（加上先留給別的熟客的里程碑 reserved）還沒滿兩段
export function roomToday(save, who, day, reserved = 0) {
  const t = todayOf(save, day);
  return !t.slots.includes(who) && t.slots.length + reserved < DAY_CAP;
}
// 老闆在場時，這位熟客的里程碑今天能不能開始演：在場的里程碑（含同日擴寫）算那位熟客今天的一段，和來訪段落共用一天的份量。
// false＝今天不開始演（main.js 的 liveScene() 當作今天沒有里程碑）：不記完成、不給獎勵、不跳過，條件與順序不動，
// 等下一個有份量的遊玩日；老闆不在的日子照舊由 story.js 的 settleThrough() 結算（可離線的寫日誌，在場的寫「想等老闆在」）
export const milestoneRoom = (save, who, day) => roomToday(save, who, day);
// 這個里程碑當天的擴寫（老闆坐著時取代原場景）；已經演過或作廢了是 null。
// 給了 day 就看今天的份量（roomToday）：滿了是 null。正式流程裡份量滿了里程碑本身也不演（milestoneRoom()），
// 所以只有開發者直接演（__cafe.playScene）時才會在滿了的時候拿到 null、演原場景
export function expansionFor(save, milestoneId, day) {
  const seg = SEGMENTS.find((s) => s.kind === 'with' && s.with === milestoneId);
  if (!seg || relOf(save).done.includes(seg.id)) return null;
  return day === undefined || roomToday(save, seg.who, day) ? seg : null;
}
// 演完一段：記下來、用掉那位熟客今天的一段；擴寫版演過的里程碑記成「老闆看過」（之後不演接回）
export function markPlayed(save, seg, day) {
  const r = relOf(save);
  if (!r.done.includes(seg.id)) r.done.push(seg.id);
  if (seg.kind === 'with' && !r.seen.includes(seg.with)) r.seen.push(seg.with);
  if (seg.kind === 'reconnect' && !r.seen.includes(seg.of)) r.seen.push(seg.of);
  noteMilestone(save, seg.who, day);
}
export const played = (save, id) => relOf(save).done.includes(id);

// 點熟客時「請德叔端一杯」：每位熟客一天只主動問一次
export const offerable = (save, who, day) => (relOf(save).offered?.[who] || 0) !== day;
export function markOffered(save, who, day) { const r = relOf(save); r.offered = { ...blankRel().offered, ...r.offered, [who]: day }; }
export function resetOffered(save, who) { const r = relOf(save); r.offered = { ...blankRel().offered, ...r.offered, [who]: 0 }; }

// 段落結尾的第一杯問過了（老闆選了其中一個選項；選項出來前中斷不算）：yuan-r3 的窗口看這個
export function markInvited(save, who) { const r = relOf(save); if (!r.invited.includes(who)) r.invited.push(who); }
export const invited = (save, who) => relOf(save).invited.includes(who);
// 段落結尾的第一杯：還在找第一段、今天還沒收過才問（舊存檔已經找過第一段就不問）
export function inviteReady(save, who, day) {
  const s = FV.current(save, who);
  return !!s && s.n === 1 && FV.canServe(save, who, day);
}
// 第一杯的選項裡，選了 treat（我請）以外的就是 no
export const INVITE_TREAT = 'treat';
// 選「我請」時直接端哪一杯：黑板上有那一杯（阿哲是任何喝的，黑板上要有龍眼乾）；沒有就是 null（德叔問要端哪一杯，照平常的選杯流程）
export function inviteDrink(save, inv, shift = 0) {
  if (!inv) return null;
  if (inv.need && !M.onBoard(save, inv.need)) return null;
  const drinks = M.boardDrinks(save, shift);
  if (drinks.includes(inv.drink)) return inv.drink;
  return inv.any && drinks.length ? drinks[0] : null;
}

// when 的條件（字串）：c＝{ catSill 龍眼此刻在窗台上（main.js 看） }；其他從存檔讀。
//   catSill、flag:名字、early:名字、seg:段落 id、milestone:里程碑 id（yuan2），前面加 ! 或 not 是相反；
//   別名（peeked、met……）在 scripts/_shared.yaml 的 conds
export function condOk(save, cond, c = {}) {
  let k = String(cond).trim(), not = false;
  if (k.startsWith('!')) { not = true; k = k.slice(1).trim(); } else if (k.startsWith('not ')) { not = true; k = k.slice(4).trim(); }
  if (SCRIPT.conds[k]) return condOk(save, SCRIPT.conds[k], c) !== not;
  const at = k.indexOf(':'), kind = at < 0 ? k : k.slice(0, at), arg = at < 0 ? '' : k.slice(at + 1);
  const v = kind === 'catSill' ? !!c.catSill
    : kind === 'flag' ? !!save.flags?.[arg]
      : kind === 'early' ? (save.moments?.early || []).includes(arg)
        : kind === 'seg' ? (save.rel?.done || []).includes(arg)
          : kind === 'milestone' ? has(save, whoOf(arg), milestoneN(arg)) : false;
  return not ? !v : v;
}
const anyOk = (save, list) => (list || []).some((x) => condOk(save, x));

// 泡泡上的名字：還不知道名字的熟客（scripts/_shared.yaml 的 stranger）是那個稱呼；不是就是 null（照平常的名字）
// 予安說出名字以前（而且還沒到 yuan2，日誌裡德叔已經叫她予安小姐）是「窗邊的小姐」；凱文在主管叫出他的名字以前是「冰美式先生」
// visits：來訪段落開著沒（stranger.visits 的稱呼只在開著時用）
export function strangerName(save, who, { visits = true } = {}) {
  const st = SCRIPT.regulars[who]?.stranger;
  if (!st || (st.visits && !visits)) return null;
  return anyOk(save, st.until) ? null : st.name;
}
// 第一次點他時的自我介紹（scripts/_shared.yaml 的 intro）：還沒說過（flag）、而且時機到了（ready）才有；不然是 null。
// 說完由呼叫端記 introFlag()。visits：來訪段落開著沒（關著時不看 ready，照舊第一次點就說）
export function introLine(save, who, { visits = true } = {}) {
  const it = SCRIPT.regulars[who]?.intro;
  if (!it || save.flags?.[it.flag]) return null;
  return !visits || anyOk(save, it.ready) ? it.text : null;
}
export const introFlag = (who) => SCRIPT.regulars[who]?.intro?.flag || null;
// 予安說出名字（第一次點她時說「……啊，你好。我叫予安……」）的時機：第 2 次來訪演過（選了點頭，名字留到下次點她）或那個窗口已經過了
export const yuanIntroReady = (save) => anyOk(save, SCRIPT.regulars.yuan.intro.ready);
// 予安還是「窗邊的小姐」
export const yuanStranger = (save) => strangerName(save, 'yuan') !== null;

// 存檔 12 → 13：舊存檔已經發生的里程碑，當天的擴寫與接回都記成演過（不補演舊的事）；過期的段落跳過；照片、最愛的段落都不動
export function migrateRel(save) {
  const r = relOf(save);
  for (const seg of SEGMENTS) {
    const ms = seg.kind === 'with' ? seg.with : seg.kind === 'reconnect' ? seg.of : '';
    if (ms && has(save, whoOf(ms), milestoneN(ms))) {
      if (!r.done.includes(seg.id)) r.done.push(seg.id);
      if (!r.seen.includes(ms)) r.seen.push(ms);
    }
  }
  expire(save);
  return save;
}

// 選項的字（choice 的 options 是 [{ id, text }]）
export const optionTexts = (options) => (options || []).map((o) => (typeof o === 'string' ? o : o.text));
// branch 的每個分支（cases 是 { 選項 id: 步驟 }）
const casesOf = (s, branches) => { const all = Object.values(s.cases || {}); return branches === 'all' ? all : all.slice(0, 1); };

// 一段裡所有說出口的句子（子序列檢查用）：branch 的每個分支、when 的步驟都算（旁白不算說出口）
export function sayTexts(steps, { branches = 'all' } = {}) {
  const out = [];
  const walk = (list) => {
    for (const s of list || []) {
      if (s.do === 'say') out.push(s.text);
      if (s.do === 'when') walk(s.steps);
      if (s.do === 'branch') casesOf(s, branches).forEach(walk);
    }
  };
  walk(steps);
  return out;
}

// 一組步驟裡所有玩家看得到的字（台詞、旁白、選項）
export function stepTexts(steps) {
  const out = [];
  const walk = (list) => {
    for (const s of list || []) {
      if (s.text) out.push(s.text);
      if (s.options) out.push(...optionTexts(s.options));
      if (s.cases) Object.values(s.cases).forEach(walk);
      if (s.steps) walk(s.steps);
    }
  };
  walk(steps);
  return out;
}

// 測試與校稿用：來訪段落裡所有玩家看得到的字
export function allVisitLines() {
  const out = [];
  for (const seg of SEGMENTS) {
    out.push(...stepTexts(seg.steps));
    if (seg.invite && typeof seg.invite === 'object') {
      out.push(...optionTexts(seg.invite.options), ...stepTexts(seg.invite.yes), ...stepTexts(seg.invite.no), ...stepTexts(seg.invite.missing));
    }
  }
  for (const r of Object.values(SCRIPT.regulars)) { if (r.stranger) out.push(r.stranger.name); if (r.intro) out.push(r.intro.text); }
  out.push(SEAT_HINT);
  return [...new Set(out)];
}
