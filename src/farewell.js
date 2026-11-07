// 第一站的結尾（劇本「徵店長與告別」）：溫度達 37°C 後，整段在老闆在場時依序發生，可以分幾天看完。
//   1 店會自己呼吸了 → 2 三選一徵才啟事 → 3 凱文來面試 → 4 予安的告別（裱框的紙巾）→
//   5 阿哲的告別（一包阿哲的豆、花蓮舞鶴的老咖啡樹）→ 6 凱文的交接（吧台的鑰匙、二選一）→
//   7 最後一晚（德叔用琺瑯杯沖一杯，第一次叫老闆的名字；龍眼睡在凱文的腿上）
// 之後：離開東山的早上，德叔拿出第二封信（letters.js）→ 你的咖啡地圖（只亮東山一盞燈，下一站「待續」）→
// 店轉為常態經營：凱文顧店，老闆隨時可以回東山當客人坐坐。
// 場景步驟和熟客里程碑（story.js）同一套格式，由 main.js 的 playSteps() 演出。
// 純邏輯，不依賴 Three.js 或 DOM。
import { temperature, GOAL_TEMP } from './tasks.js';
import { hasMilestone } from './story.js';

export const FAREWELL_TEMP = GOAL_TEMP; // 37°C

// 三張徵才啟事（劇本原文；只影響啟事文字，以及凱文面試時念出來的那句）
export const NOTICES = [
  { id: 'cat', text: '徵店長，不需經驗，需要喜歡貓。' },
  { id: 'slow', text: '徵一個不趕時間的人。' },
  { id: 'turnover', text: '徵店長。翻桌率不重要。' },
];

// 存檔裡的告別進度：step 已經演完第幾段（0～7）、on 每一段在開店第幾天、notice 貼出去的啟事、
// departed 離開東山了沒（讀完第二封信）、mapSeen 看過咖啡地圖了沒、keeperGreeted 凱文第一次在門口打過招呼了沒
export const blankFarewell = () => ({ step: 0, on: {}, notice: '', departed: false, mapSeen: false, keeperGreeted: false });

const say = (who, text, name) => ({ do: 'say', who, text, ...(name ? { name } : {}) });
const wait = (sec) => ({ do: 'wait', sec });

// 劇本「德叔」：口頭禪
export const CATCHPHRASE = '不急，咖啡會等人，人也該等咖啡。';

// 最後一晚，德叔第一次叫老闆的名字（辭呈署名，Q4）。沒留名字時改說「……謝謝你，老闆。」
// 【待定】劇本只寫「第一次叫了玩家的名字」，這句台詞是自行補寫
export function nameLine(name) {
  const n = String(name || '').trim();
  return n ? `${n}，這一杯，是你的。` : '這一杯，是你的。……謝謝你，老闆。';
}

// 每一段：n 順序、needClosing 要老闆按了「打烊」、喝完最後一杯才演、who 要在店裡的熟客、
// entrance 自己走進來就是演出（凱文來面試）、gift 收進倉庫的東西、hint 還沒打烊時德叔提一次（每天一次）
// when(c)：c = { day, temp, on（每一段在第幾天）, kevin6（凱文說了想留在東山）}
export const SEGMENTS = [
  { n: 1, id: 'breathe', needClosing: true,
    when: (c) => c.temp >= FAREWELL_TEMP && c.kevin6,
    hint: '老闆，今天打烊以後，我有話想說。', // 【待定】
    scene: [{ do: 'look', who: 'thermo' }, wait(2.6), { do: 'look', who: 'deshu' },
      say('deshu', '老闆，這間店已經會自己呼吸了。'), say('deshu', '該找個人顧它。'), wait(1.2)] }, // 劇本原文（分成兩個泡泡）
  { n: 2, id: 'notice', needClosing: true, chain: true, // chain：緊接著上一段演
    when: () => true,
    hint: '老闆，今天打烊以後，門口要貼一樣東西。', // 【待定】第 1 段演完、還沒貼就換了一天時
    scene: [say('deshu', '門口，貼一張徵才的啟事吧。老闆來寫。'), // 【待定】
      { do: 'choice', key: 'notice', prompt: '啟事要寫哪一句？', options: NOTICES.map((x) => x.text) }, // 提示字【待定】
      { do: 'notice' },
      say('deshu', '貼好了。明天，看誰先來。')] }, // 【待定】
  { n: 3, id: 'interview', who: 'kevin', entrance: true,
    when: (c) => c.day > c.on[2], // 門貼出去的隔天
    // 凱文第一個來，穿著一件燙過的襯衫
    scene: [{ do: 'enter', who: 'kevin', at: 'bar', pose: 'shirt' }, { do: 'look', who: 'kevin' },
      say('deshu', '……凱文先生。今天穿得很整齊。'), // 【待定】
      say('kevin', '我看到門口的啟事了。'), // 【待定】
      { do: 'branch', key: 'notice', cases: [ // 【待定】凱文念出啟事的那句
        [say('kevin', '「需要喜歡貓」。這一條，我應該可以。')],
        [say('kevin', '「徵一個不趕時間的人」。我最近……剛好不趕了。')],
        [say('kevin', '「翻桌率不重要」。我看了三次，確定沒看錯。')],
      ] },
      say('kevin', '我不會煮咖啡。但我知道龍眼喜歡睡哪個位子，也知道予安寫不出來的時候會坐哪裡。'), // 劇本原文
      wait(1.2), { do: 'glance', who: 'deshu' },
      say('deshu', '咖啡我教你。後面那些，教不來。'), // 劇本原文
      say('kevin', '……所以，是錄取的意思嗎？'), say('deshu', '明天早一點來。先學溫杯。'), // 【待定】
      wait(1), { do: 'walk', who: 'kevin', at: 'home', pose: 'walk', then: 'free' }] },
  { n: 4, id: 'yuan', who: 'yuan', gift: 'framed-napkin',
    when: (c) => c.day >= c.on[3],
    scene: [{ do: 'look', who: 'yuan' },
      say('yuan', '老闆，聽說店要交給凱文了。'), // 【待定】
      { do: 'pose', who: 'yuan', pose: 'frame' },
      say('yuan', '那張紙巾，我拿去裱起來了。這個，送你。'), // 【待定】
      say('yuan', '下一本，寫你的店。不要拒絕，我已經開始寫了。'), // 劇本原文
      say('yuan', '我會常回來——不對，是你要常回來。'), // 劇本原文
      wait(1.5), say('deshu', '裱好的這張，我收進倉庫。這個，可以帶去下一站。'), // 【待定】
      { do: 'pose', who: 'yuan', pose: 'type' }] },
  { n: 5, id: 'zhe', who: 'zhe', gift: 'zhe-bean-bag',
    when: (c) => c.day > c.on[4], // 隔天
    scene: [{ do: 'look', who: 'zhe' },
      say('zhe', '老闆，聽說你要走了。這包給你。'), // 【待定】
      say('zhe', '我的豆，你帶去下一站。哪天你在別的地方喝到，就是我在想你。'), // 劇本原文
      wait(1),
      say('zhe', '對了，我學長在花蓮舞鶴種茶也種咖啡，他家茶園有一棵很老的咖啡樹，你一定要去看。'), // 劇本原文（下一站的邀請）
      wait(1), { do: 'glance', who: 'deshu' }, say('deshu', '……很老的咖啡樹。'), // 【待定】
      { do: 'laugh', who: ['zhe'] }] },
  { n: 6, id: 'handover', who: 'kevin',
    when: (c) => c.day >= c.on[5],
    scene: [{ do: 'look', who: 'kevin' }, { do: 'deshuTo', who: 'kevin' }, { do: 'keys', who: 'kevin' },
      say('deshu', '吧台的鑰匙。'), // 【待定】
      say('kevin', '這間店，我幫你顧。龍眼也是。你會常回來吧？'), // 劇本原文
      { do: 'choice', key: 'kevinBack', options: ['我會常回來。', '我會當你的熟客。'] }, // 劇本原文
      { do: 'branch', key: 'kevinBack', cases: [ // 【待定】凱文的反應
        [say('kevin', '好。你常坐的那個位子，我幫你留著。')],
        [say('kevin', '熟客啊。那我要記得，你第一次點的是什麼。')],
      ] },
      { do: 'deshuHome' }] },
  { n: 7, id: 'lastNight', who: 'kevin', needClosing: true, lastNight: true,
    when: (c) => c.day >= c.on[6],
    hint: '老闆，今天打烊，最後一杯我來沖。用一個不一樣的杯子。', // 【待定】
    // 打烊後，德叔用那個琺瑯杯沖了一杯（main.js 的最後一杯換成琺瑯杯），第一次放在老闆面前，也第一次叫了老闆的名字；
    // 龍眼睡在凱文的腿上。{ do: 'name' } 是德叔叫名字的那句（nameLine）
    scene: [wait(1.4), { do: 'name' }, wait(2), { do: 'cat', who: 'kevin', lap: true }, wait(2.5),
      say('deshu', CATCHPHRASE), say('deshu', '明天早上，出發。'), wait(1)] }, // 最後一句【待定】
];
const BY_N = new Map(SEGMENTS.map((s) => [s.n, s]));
export const segment = (n) => BY_N.get(n) || null;

// 離開東山的早上（第 7 段的隔天以後第一次進店）：德叔打招呼、交第二封信（letters.js）、讀完之後出發
export const DEPART = {
  greet: '早。行李我收好了。', // 【待定】
  after: [ // 讀完第二封信之後 【待定】
    say('kevin', '路上小心。德叔，老闆就交給你了。'),
    say('deshu', '嗯。'),
    say('deshu', '走吧。'),
  ],
};

// 你的咖啡地圖（第一站結尾）
export const MAP = {
  title: '你的咖啡地圖',
  stations: [
    { id: 'dongshan', name: '台南・東山', note: '第一間店・37°C・店長 凱文', lit: true },
    { id: 'wuhe', name: '花蓮・舞鶴', note: '待續', lit: false },
  ],
  sub: '第一站，完。', // 【待定】
  line: '一棵很老的咖啡樹，在等。', // 【待定】
  back: '回東山坐坐', // 【待定】
  close: '闔上',
};

// 離開東山之後的常態店：凱文顧店（德叔跟著老闆去下一站）。這些都是凱文說的話 【待定】全部是自行補寫
export const KEEPER = {
  name: '凱文',
  firstGreet: ['老闆，歡迎回來。', '……德叔說，要這樣講。'], // 呼應開場德叔的第一句話
  greet: ['老闆，歡迎回來。今天想坐哪裡？', '歡迎回來。龍眼剛剛還在門口等。', '老闆，歡迎回來。不急，先坐。'],
  brewStart: '好，我來。德叔說，不要急。',
  serveWalk: '好了，我端過去。',
  served: '東山的豆。德叔說，就是窗外那片山。',
  talk: ['德叔昨天打電話來，問龍眼有沒有胖。', '溫杯，我現在不會忘了。', '予安說，下一本的主角是一間咖啡店的老闆。', '阿哲的豆，我每天替自己沖一杯。', '會議？我已經很久沒開了。'],
  closingTalk: ['打烊以後，我也會擦杯子。不是那個杯子就是了。', '燈讓老闆關。德叔說，這是老闆的事。', '龍眼今天在我腿上睡了一個下午，我沒辦法起來。'],
};

// 常態店的營業日誌（凱文寫的）多出來的句子 【待定】
export const KEEPER_JOURNAL = [
  '今天沖了十一杯。有一杯，德叔大概會說水太燙。',
  '予安說，下一本寫到第三章了。主角開了一間咖啡店。',
  '阿哲送豆子來，說有一包要留給老闆。我收在吧台下面。',
  '龍眼今天睡在我的高腳椅上。我站著顧店。',
  '門口的啟事我收起來了，夾在記事本裡。',
  '有一位客人問老闆在不在。我說，老闆常回來。',
];

/* ---------- 判定 ---------- */
export const fw = (save) => save.farewell;
export const done = (save, n) => fw(save).step >= n;
export const nextSegment = (save) => segment(fw(save).step + 1);
export const started = (save) => fw(save).step >= 1;
// 告別進行中（第 1 段之後、還沒離開東山）
export const inFarewell = (save) => fw(save).step >= 1 && !fw(save).departed;
// 第 7 段（最後一晚）之後的隔天以後：離開東山的早上
export const departureDue = (save, day) => fw(save).step >= 7 && !fw(save).departed && day > (fw(save).on[7] || 0);
export const departed = (save) => !!fw(save).departed;

export function ctxOf(save, day, temp = temperature(save)) {
  return { day, temp, on: fw(save).on, kevin6: hasMilestone(save, 'kevin', 6) };
}

// 這一段的條件到了沒（不看老闆在不在、打烊了沒；那些由 main.js 判斷）
export function segmentDue(save, day, temp) {
  const s = nextSegment(save);
  if (!s || fw(save).departed) return null;
  return s.when(ctxOf(save, day, temp)) ? s : null;
}

// 演完一段：記進存檔（同一段只記一次），回傳有沒有記
export function complete(save, n, day) {
  const f = fw(save);
  if (f.step !== n - 1) return false;
  f.step = n;
  f.on[n] = day;
  const s = segment(n);
  if (s.gift && !save.owned.some((o) => o.item === s.gift)) save.owned.push({ uid: save.nextUid++, item: s.gift, placed: false, x: 0, z: 0 });
  return true;
}

// 貼出啟事（第 2 段）
export function postNotice(save, i) {
  const n = NOTICES[i] || NOTICES[0];
  fw(save).notice = n.id;
  return n;
}
export const noticeText = (save) => (NOTICES.find((n) => n.id === fw(save).notice) || null)?.text || '';
// 啟事貼在門口的期間：貼出去之後，到凱文來面試為止
export const noticeUp = (save) => fw(save).step === 2 && !!fw(save).notice;

// 讀完第二封信：離開東山
export function depart(save, now) {
  const f = fw(save);
  if (f.departed) return false;
  f.departed = true;
  f.departedAt = now;
  return true;
}

// 告別期間，熟客今天會不會來：要演的那一段需要誰，那個人今天一定來；第 3 段（面試）的凱文由場景自己走進來
export function needsToday(save, day, temp) {
  const s = segmentDue(save, day, temp);
  const out = new Set();
  if (!s) return out;
  if (s.who && !s.entrance) out.add(s.who);
  // 接下來同一天還可能演的段落也要在（例如第 4、6 段和前一段同一天）
  const next = segment(s.n + 1);
  if (next && next.who && !next.entrance && next.when({ ...ctxOf(save, day, temp), on: { ...fw(save).on, [s.n]: day } })) out.add(next.who);
  return out;
}

// 校稿與測試用：所有寫得出來的台詞
export function allFarewellLines() {
  const out = [];
  const walk = (steps) => {
    for (const s of steps) {
      if (s.text) out.push(s.text);
      if (s.options) out.push(...s.options);
      if (s.prompt) out.push(s.prompt);
      if (s.cases) s.cases.forEach(walk);
    }
  };
  for (const s of SEGMENTS) { walk(s.scene); if (s.hint) out.push(s.hint); }
  walk(DEPART.after);
  out.push(DEPART.greet, nameLine(''), nameLine('小林'), CATCHPHRASE, ...NOTICES.map((n) => n.text));
  out.push(MAP.title, MAP.sub, MAP.line, MAP.back, ...MAP.stations.flatMap((s) => [s.name, s.note]));
  out.push(...Object.values(KEEPER).flat(), ...KEEPER_JOURNAL);
  return out;
}
