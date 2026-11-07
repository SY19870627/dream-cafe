// 三位熟客的故事線：里程碑引擎（劇本「三位熟客」）。
// 每位熟客六個里程碑，以條件觸發（開店天數、來店次數、溫度、前一個里程碑、是否在場），不用固定日程。
// - 可離線的里程碑：老闆不在時，在營業日誌結算時發生並寫進日誌；老闆在店裡時就當場演出。
// - 「在場」里程碑：只在老闆在店裡時演出；老闆不在的日子，日誌只寫一次「想等老闆在」的提示。
// - 每位熟客一天最多一個里程碑；「在場」里程碑全店一天最多演一個（Q7 的暫定做法，決定 D53）。
// 場景（scene）是給 main.js 演出的步驟清單；場景、日誌句、「想等老闆在」的提示在劇本檔 scripts/<熟客>.yaml 的 milestones（D224），
// 這裡只留條件、順序、獎勵與排程（when 是遊戲規則，不放進劇本檔）。客人註冊表（名字、第一次來、來店機率）在 scripts/_shared.yaml。
// 純邏輯，不依賴 Three.js 或 DOM。
import { hash01 } from './weather.js';
import { temperature, pending } from './tasks.js';
import * as M from './menu.js';
import { allVisitLines, stepTexts } from './visits.js';
import { SCRIPT } from './script.js';

export const WEEK2 = 8; // 「第 2 週」＝開店第 8 天起（Q7）
export const WEEK3 = 15; // 「第 3 週」＝開店第 15 天起
// 溫度門檻的保底：到了這天，溫度不夠也照樣發生（Q8，決定 D55）
export const FALLBACK_DAY = { yuan5: 16, kevin5: 17, zhe6: 19 };

// rate：平常日子來店的機率（予安整天坐窗邊、凱文每天下午五點、阿哲不固定）；first：第一次來的那天
// 客人註冊表在 scripts/_shared.yaml 的 regulars（加新客人時加一列、加一個劇本檔，再在下面的 MILESTONES 加他的里程碑條件）
export const REGULARS = Object.fromEntries(Object.entries(SCRIPT.regulars).map(([id, r]) =>
  [id, { name: r.name, short: r.short, first: r.first, rate: r.rate, salt: r.salt, about: r.about }]));
export const REGULAR_IDS = Object.keys(REGULARS);
export const KEVIN_HOUR = 17; // 凱文每天下午五點來

// 菜單（Q1 暫定的菜單風格：在地食材）：品項、黑板與菜單本在 menu.js（D185）。MENU 留著給舊的呼叫端讀名字
export const MENU = M.ITEMS;
export const DEFAULT_MENU = M.START_ITEMS;

// 讀得到的紙本：予安念的稿子、予安的書的扉頁（劇本原文）
export const DOCS = {
  manuscript: { id: 'manuscript', title: '予安的稿子', hand: true,
    paragraphs: ['阿公說，龍眼要燻三日三夜，窯火不能斷，人也不能睡。那三天，是他一年裡最清醒的時候。'] },
  dedication: { id: 'dedication', title: '予安的書・扉頁', hand: true,
    paragraphs: ['給一間讓人敢慢下來的店。'] },
};

// 颱風過後的隔天，日誌多一句 【待定】
export const AFTER_TYPHOON = '颱風過了。台階上都是葉子，我掃了一個早上。';

// 熟客的場景沒有按鈕時，畫面底部的提示（承峰 2026-11-07：「A,改成(營業中)」，D219；原本是 D177 的「什麼都不用做，在這裡就好」）
// 每個熟客場景都顯示，颱風夜也是；里程碑標 noHint: true 的場景不顯示（目前沒有劇情使用）
export const SCENE_HINT = '營業中';
export const sceneHint = (m) => (m && !m.noHint ? SCENE_HINT : '');

// 等客人的時候，畫面底部的提示（承峰 11/3 試玩回饋：「要玩家等，但要等啥沒讓玩家知道，會以為當機了」，D179）
// 不催促、不報時間，只讓玩家知道店還活著、有人會來（或今天不會再有人來，也沒關係）。
// approach：有熟客快走到門口（門外同時有腳步聲、門上的鈴輕輕晃）；soon：一分半鐘內有人會來；
// later：今天還有人會來，但還要一陣子；quiet：今天不會再有人來，店裡也沒有人
export const WAIT_HINT = {
  approach: '好像有人往這邊走來了……', // 【待定】
  soon: '店裡很安靜。等一下，也許會有人推門進來', // 【待定】
  later: '晚一點也許還會有人來。想待多久都可以', // 【待定】
  quiet: '今天店裡很安靜。想待多久都可以', // 【待定】
};
export const APPROACH_MS = 7000; // 有人走進門之前幾毫秒開始有腳步聲
export const WAIT_IDLE_MS = 20000; // 坐著、沒有人說話超過這麼久，才把操作說明換成等待的句子
export const WAIT_SOON_MS = 90000;
// 坐著、沒在沖咖啡時的提示：回傳 '' 表示照舊顯示操作說明（左右拖曳環顧四周，點人物可以搭話）
// nextMs：下一位熟客還有幾毫秒走進門（今天沒有人要來是 null）；idleMs：多久沒有人說話；here：店裡有沒有熟客
export function waitHint({ approaching = false, nextMs = null, idleMs = 0, here = false } = {}) {
  if (approaching) return WAIT_HINT.approach;
  if (idleMs < WAIT_IDLE_MS) return '';
  if (nextMs !== null && nextMs <= WAIT_SOON_MS) return WAIT_HINT.soon;
  if (here) return ''; // 有人在店裡：點人物可以搭話，這句比較有用
  return nextMs !== null ? WAIT_HINT.later : WAIT_HINT.quiet;
}

// 場景步驟（main.js 依序演出）：
//   say：角色說話（who 可以是 deshu、yuan、zhe、kevin、grandpa、boss、player）；name：泡泡上的名字（覆寫）
//   wait：停一下（秒）；look：坐著時鏡頭轉向某人；pose：換姿勢；enter／walk／leave：走進來、走到某處、離開
//   arrived：等某人走到位子上；deshuTo／deshuHome：德叔走到某人旁邊、走回吧台（async：不等他走完）；serve：德叔端東西給某人（hot、iced、cocoa）
//   cat：龍眼走到某人身邊（lap：跳上腿）；music：德叔把音樂調小；laugh：笑（輕輕跳兩下）；glance：看一眼
//   weather：天氣變化（颱風）；prop：吧台上多一樣東西
//   needClosing：要老闆按了「打烊」、喝完最後一杯才演（予安念稿）；needSeat：要老闆坐著才演（凱文的問題）
//   choice：畫面下方出現選項（key 存在存檔）；branch：依選項接不同台詞；ifFire：開場選了「單方面辭退」才演
//   read：打開一張紙（予安的稿子、書的扉頁）；brewTaste：德叔在吧台試沖；
//   menu：阿哲的豆收進菜單本，德叔問老闆要不要寫上黑板（Q73 的暫定做法，D186）
//   品項的解鎖不寫在里程碑上：menu.js 的 ITEMS[].from 記著哪個里程碑解鎖哪一樣
// 里程碑的規則：id、who、n 第幾個、present 要老闆在場、task 完成的溫度任務、gift 收進倉庫的東西、when(c) 條件（c = { day, visits, temp, on }）、
// needClosing 要打烊後才演、needSeat 要老闆坐著才演、entrance 走進來就是演出、force 那天一定來、arrivePose 走進來的姿勢。
// 台詞（scene、journal、waiting、needSeatHint、needClosingHint）在劇本檔，最下面的 withScript() 依 id 合進來。
const RULES = [
  /* ---------- 林予安：卡稿的作家 ---------- */
  { id: 'yuan1', who: 'yuan', n: 1, present: false,
    when: (c) => c.day >= 2 },
  { id: 'yuan2', who: 'yuan', n: 2, present: false, task: 'yuan-pen', gift: 'napkin',
    when: (c) => c.visits >= 3 },
  { id: 'yuan3', who: 'yuan', n: 3, present: true, task: 'yuan-kiln',
    when: (c) => c.visits >= 6 },
  { id: 'yuan4', who: 'yuan', n: 4, present: true,
    when: (c) => c.day >= WEEK2 },
  // 打烊後：老闆按「打烊」、喝完最後一杯，其他客人都走了，予安還在（決定 D57、D78）
  { id: 'yuan5', who: 'yuan', n: 5, present: true, task: 'yuan-reading', needClosing: true,
    when: (c) => c.temp >= 30 || c.day >= FALLBACK_DAY.yuan5 },
  { id: 'yuan6', who: 'yuan', n: 6, present: true, task: 'yuan-book', gift: 'yuan-book',
    when: (c) => c.day >= WEEK3 },

  /* ---------- 陳柏哲（阿哲）：返鄉青農 ---------- */
  { id: 'zhe1', who: 'zhe', n: 1, present: false, task: 'zhe-longan',
    when: (c) => c.day >= 1 },
  { id: 'zhe2', who: 'zhe', n: 2, present: false,
    when: (c) => c.visits >= 4 },
  // 颱風夜：天色暗下來、風雨聲，阿哲全身是泥衝進店裡；德叔沒說話，遞毛巾與咖啡
  { id: 'zhe3', who: 'zhe', n: 3, present: true, task: 'typhoon', entrance: true,
    when: (c) => c.day >= WEEK2 },
  { id: 'zhe4', who: 'zhe', n: 4, present: false, task: 'zhe-grandpa', entrance: true, force: true,
    when: (c) => c.on[3] > 0 && c.day >= c.on[3] + 3 }, // 颱風後 3 天
  { id: 'zhe5', who: 'zhe', n: 5, present: true,
    when: (c) => c.visits >= 10 },
  { id: 'zhe6', who: 'zhe', n: 6, present: false, task: 'zhe-beans',
    when: (c) => c.temp >= 33 || c.day >= FALLBACK_DAY.zhe6 },

  /* ---------- 張凱文（Kevin）：遠距工作的工程師 ---------- */
  { id: 'kevin1', who: 'kevin', n: 1, present: false,
    when: (c) => c.day >= 3 },
  // 視訊會議被主管當眾罵；關掉鏡頭躲到角落；德叔把音樂調小，龍眼跳上他的腿
  { id: 'kevin2', who: 'kevin', n: 2, present: true, task: 'kevin-scolded',
    when: (c) => c.visits >= 4 },
  { id: 'kevin3', who: 'kevin', n: 3, present: false,
    when: (c) => c.visits >= 7 },
  { id: 'kevin4', who: 'kevin', n: 4, present: true, needSeat: true,
    when: (c) => c.day >= WEEK2 },
  { id: 'kevin5', who: 'kevin', n: 5, present: false, task: 'kevin-no-laptop', arrivePose: 'free',
    when: (c) => c.temp >= 31 || c.day >= FALLBACK_DAY.kevin5 },
  { id: 'kevin6', who: 'kevin', n: 6, present: true,
    when: (c) => c.day >= WEEK3 },
];

// 把劇本檔的台詞合進里程碑：每個里程碑都要有劇本（scene）；可離線的要有日誌（journal），在場的要有「想等老闆在」（waiting）
function withScript(rules) {
  return rules.map((m) => {
    const s = SCRIPT.milestones[m.id];
    if (!s) throw new Error(`劇本檔裡沒有里程碑 ${m.id}`);
    const out = { ...m, ...s };
    if (!m.present && !out.journal) throw new Error(`里程碑 ${m.id} 可以離線發生，劇本檔要有 journal`);
    if (m.present && !out.waiting) throw new Error(`里程碑 ${m.id} 要老闆在場，劇本檔要有 waiting`);
    return out;
  });
}
export const MILESTONES = withScript(RULES);

const BY_ID = new Map(MILESTONES.map((m) => [m.id, m]));
export const milestoneById = (id) => BY_ID.get(id);

// 點熟客搭話的台詞（依故事進度）。【待定】除了予安原型就有的四句，其他都是自行補寫
export const TALK = {
  yuan: [
    { lines: ['這句我又刪掉了。', '窗外那片山，今天的顏色很好看。', '再一杯黑咖啡，我就寫得出來。', '我阿公以前也在這條路上烤龍眼。'] },
    { after: 3, lines: ['今天寫了兩頁。龍眼窯那段，還是寫不好。', '阿公以前說，窯火要用龍眼木，煙才會甜。'] },
    { after: 6, lines: ['下一本要寫什麼，我還不知道。先坐著。', '書店說要辦簽書會。我比較想在這裡辦。'] },
  ],
  zhe: [
    { lines: ['我阿公叫我來看看你們缺什麼。我是被逼來的。', '今天果園的龍眼開花了，整片都是蜂。', '德叔，你們的豆子是哪一區的？……我只是問問。'] },
    { after: 2, lines: ['德叔，你真的喝過我阿公的豆？什麼時候？', '我阿公的日曬是曬在竹篩上，一天要翻好幾次。'] },
    { after: 3, lines: ['倒的那幾棵，阿公說要留著當柴。', '颱風那天，謝謝你們開著燈。'] },
    { after: 5, lines: ['新方法那包，我再調一下發酵的時間。', '阿公現在會問我，今天的豆子怎麼樣。'] },
  ],
  kevin: [
    { lines: ['……抱歉，我在開會。', '嗯？喔，冰美式，謝謝。', '這裡的網路比台北的辦公室穩。'] },
    { after: 2, lines: ['龍眼今天有來找我。', '我把會議的鏡頭關掉了。看山比較好。'] },
    { after: 5, lines: ['原來下午五點的山，是這個顏色。', '今天沒有會。我不太習慣。'] },
  ],
};

// 熟客「見過了沒」（給營業日誌挑句子用）：第一個里程碑發生在那天以前
export function metOn(save, day) {
  const on = (who, n) => { const d = save.regulars[who]?.on?.[n]; return d > 0 && d <= day; };
  return { yuan: on('yuan', 1), zhe: on('zhe', 1), kevin: on('kevin', 1), kevinFree: on('kevin', 5) };
}

const seedOf = (save) => (Number(save.createdAt) || 0) % 2147483647;
const R = (save, who) => save.regulars[who];
export const hasMilestone = (save, who, n) => (R(save, who)?.milestones || []).includes(n);

// 下一個還沒發生的里程碑（里程碑一定照順序，前一個沒發生，後一個不會發生）
export function nextMilestone(save, who) {
  const done = R(save, who).milestones;
  return MILESTONES.find((m) => m.who === who && !done.includes(m.n)) || null;
}

// 判定用的溫度：已完成的任務，加上條件已經達成、這次結算會一起完成的任務
export function projectedTemp(save, day) {
  return Math.round((temperature(save) + pending(save, { daysOpen: day }).reduce((s, t) => s + t.temp, 0)) * 10) / 10;
}

export function ctxOf(save, who, day) {
  const r = R(save, who);
  return { day, visits: r.visits, temp: projectedTemp(save, day), on: r.on };
}
export const isDue = (save, m, day) => !!m && m.when(ctxOf(save, m.who, day));

// 這位熟客這天平常會不會來（同一天永遠是同樣的結果）
export function scheduled(save, who, day) {
  const info = REGULARS[who];
  if (day < info.first) return false;
  if (!hasMilestone(save, who, 1)) return true; // 第一次來（里程碑 1）
  const m = nextMilestone(save, who);
  if (m && m.force && !m.present && isDue(save, m, day)) return true; // 例如阿哲帶阿公來的那天
  if (day - R(save, who).lastVisit >= 3) return true; // 熟客不會連續兩天以上沒來（決定 D54）
  return hash01(seedOf(save), day, info.salt) < info.rate;
}

// 里程碑發生：記進存檔，並處理解鎖（擺飾收進倉庫、品項收進菜單本、颱風那天）
// 回傳 false＝已經發生過；不然回傳這次解鎖的品項 [{ id, boarded }]（陣列，可能是空的）
export function complete(save, m, day, t = 0) {
  const r = R(save, m.who);
  if (r.milestones.includes(m.n)) return false;
  r.milestones.push(m.n);
  r.on[m.n] = day;
  r.lastMilestoneDay = day;
  if (m.present) save.story.lastPresentDay = day;
  if (m.gift && !save.owned.some((o) => o.item === m.gift)) save.owned.push({ uid: save.nextUid++, item: m.gift, placed: false, x: 0, z: 0 });
  const got = M.unlockFrom(save, m.id, day, t);
  // 劇情裡熟客已經看過它寫上黑板（阿哲第一幕的龍眼乾、第六幕的阿哲的豆），之後不再補一次「第一次寫上黑板」的反應
  for (const g of got) if (g.boarded) M.markNoticed(save, g.id, m.who);
  if (m.id === 'zhe3') save.story.typhoonDay = day;
  return got;
}

// 老闆不在的日子：一天一天結算到 upto（含）。熟客來店次數照常累計；
// 可離線的里程碑當天發生並寫進日誌，「在場」里程碑只寫一次「想等老闆在」的提示。
// 回傳日誌要寫的句子：[{ day, line, kind: 'milestone' | 'waiting' | 'note', id }]
export function settleThrough(save, upto) {
  const events = [];
  const from = Math.min(...REGULAR_IDS.map((w) => R(save, w).settled)) + 1;
  for (let d = from; d <= upto; d++) {
    for (const who of REGULAR_IDS) {
      const r = R(save, who);
      if (r.settled >= d) continue;
      r.settled = d;
      if (!scheduled(save, who, d)) continue;
      r.visits++;
      r.lastVisit = d;
      const m = nextMilestone(save, who);
      if (!m || r.lastMilestoneDay === d || !isDue(save, m, d)) continue;
      if (!m.present) {
        const got = complete(save, m, d);
        for (const line of m.journal) events.push({ day: d, line, kind: 'milestone', id: m.id });
        // 收進菜單本的東西：德叔在日誌寫一句（之後老闆在店裡時就不再說）
        for (const g of got) {
          const line = M.tellLine(save, g.id);
          M.markTold(save, g.id);
          if (line) events.push({ day: d, line, kind: 'menu', id: g.id });
        }
      } else if (!save.story.hinted.includes(m.id)) {
        save.story.hinted.push(m.id);
        events.push({ day: d, line: m.waiting, kind: 'waiting', id: m.id });
      }
    }
    if (save.story.typhoonDay && d === save.story.typhoonDay + 1) events.push({ day: d, line: AFTER_TYPHOON, kind: 'note' });
  }
  return events;
}

// 老闆在店裡的這一天：誰會來。already＝今天已經來過了（同一天重新整理）
export function planToday(save, day) {
  const out = [];
  for (const who of REGULAR_IDS) {
    const r = R(save, who);
    if (r.lastVisit === day) { out.push({ who, already: true }); continue; }
    if (r.settled >= day) continue; // 這天已經結算過（不會發生在老闆在的日子，保險起見）
    const m = nextMilestone(save, who);
    const wants = m && m.present && isDue(save, m, day) && day >= REGULARS[who].first; // 有話想等老闆在的人，今天一定來
    if (scheduled(save, who, day) || wants) out.push({ who, already: false, milestone: m && isDue(save, m, day) ? m.id : null });
  }
  return out;
}

// 熟客走進店裡：記一次來店（同一天只記一次）
export function arrive(save, who, day) {
  const r = R(save, who);
  if (r.lastVisit === day) return false;
  r.visits++;
  r.lastVisit = day;
  r.settled = Math.max(r.settled, day);
  return true;
}

// 老闆在店裡時，這位熟客現在可以演的里程碑（沒有就回傳 null）
// 規則：人要在店裡、這位熟客今天還沒有里程碑、條件達成；「在場」里程碑全店一天一個
export function liveNext(save, who, day) {
  const r = R(save, who);
  if (r.lastVisit !== day || r.lastMilestoneDay === day) return null;
  const m = nextMilestone(save, who);
  if (!isDue(save, m, day)) return null;
  if (m.present && save.story.lastPresentDay === day) return null;
  return m;
}

// 凱文下午五點才來：現在離他來還有幾毫秒（已經過了五點就是 0）
export function kevinWaitMs(date) {
  const five = new Date(date.getFullYear(), date.getMonth(), date.getDate(), KEVIN_HOUR).getTime();
  return Math.max(0, five - date.getTime());
}

// 測試與校稿用：所有寫得出來的台詞
export function allLines() {
  const out = [];
  for (const m of MILESTONES) {
    out.push(...(m.journal || []));
    if (m.waiting) out.push(m.waiting);
    if (m.needSeatHint) out.push(m.needSeatHint);
    if (m.needClosingHint) out.push(m.needClosingHint);
    out.push(...stepTexts(m.scene));
  }
  out.push(...Object.values(WAIT_HINT));
  for (const list of Object.values(TALK)) for (const t of list) out.push(...t.lines);
  out.push(AFTER_TYPHOON, ...Object.values(DOCS).flatMap((d) => d.paragraphs));
  out.push(...allVisitLines()); // 來訪段落、里程碑當天的擴寫、接回、第一杯的邀請（visits.js）
  return out;
}
