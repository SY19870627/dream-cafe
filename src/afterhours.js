// 打烊後模式（招牌功能）與一次客人模式：台詞、咖啡日記、客人模式的對話。
// - 打烊：由老闆自己按「打烊」開始。客人離開、德叔沖「最後一杯，是老闆的」；燈一盞一盞由老闆自己關；
//   可以整理擺飾、摸龍眼、寫一句「今天的一杯」咖啡日記。沒有任何任務提示。
// - 客人模式（溫度任務 #17）：溫度 ≥ 28°C 後的某次進店，德叔邀請老闆從門口進來一次（決定 D9）；
//   推門、「歡迎。不急，先坐。」、點單、坐下聽熟客聊這間店（依擺了什麼說不同的話）。
// 純邏輯，不依賴 Three.js 或 DOM。
import { hash01 } from './weather.js';

/* ---------- 打烊 ---------- */
export const CLOSING = {
  start: '打烊了。我去把門口的牌子翻過來。', // 【待定】
  sitDown: '老闆，坐吧。最後一杯，我來沖。', // 【待定】還沒坐下時
  lastCup: '最後一杯，是老闆的。', // 劇本原文（端上桌時）
  chooseBean: '最後一杯，想喝哪一支？', // 【待定】菜單上有兩支豆子時
  goodnight: '明天見，老闆。', // 【待定】
  closedAgain: '已經打烊了。老闆想坐，就再坐一下。', // 【待定】打烊之後重新整理、回到店裡
  // 打烊後點德叔（他在擦那個琺瑯杯）
  deshuTalk: ['慢慢來，店不會跑掉。', '這個杯子，不借人的。', '燈關了，山就看得比較清楚。'], // 【待定】
  // 打烊之後的畫面（按「明天見」）
  endTitle: '今天的店，關好了。', // 【待定】
  endSub: '店會等你。什麼時候回來都可以。', // 【待定】
};

// 打烊的狀態存在 save.closing：{ day 哪一天打烊、lastCup 喝了最後一杯、bean 最後一杯的豆子、lightsOff 關掉的燈、done 按了明天見 }
export const blankClosing = () => ({ day: 0, lastCup: false, bean: '', lightsOff: [], done: false });
export const closedOn = (save, day) => !!save.closing && save.closing.day === day;
export function startClosing(save, day) {
  if (closedOn(save, day)) return save.closing;
  save.closing = { ...blankClosing(), day };
  return save.closing;
}
// 關燈／開燈（id：吊燈 p0、p1，落地燈 l<uid>）。回傳關掉了沒
export function toggleLight(save, id) {
  const off = save.closing.lightsOff;
  const i = off.indexOf(id);
  if (i >= 0) off.splice(i, 1); else off.push(id);
  return i < 0;
}

/* ---------- 「今天的一杯」咖啡日記 ---------- */
export const DIARY = {
  title: '今天的一杯',
  placeholder: '寫一句今天的心情。', // 【待定】
  save: '寫好了',
  cancel: '先不寫',
  empty: '還沒有寫下任何一杯。', // 【待定】記事本裡還沒有日記時（目前不會出現：沒有日記就不列入口）
};
export const DIARY_MAX = 40; // 一句話，最多 40 個字
export const DIARY_KEEP = 200; // 存檔裡最多留幾篇

// 一天一篇；同一天再寫就改掉那一篇。text 空白就不寫（回傳 null）
export function writeDiary(save, { day, t, bean, text }) {
  const s = [...String(text || '').replace(/\s+/g, ' ').trim()].slice(0, DIARY_MAX).join('');
  const i = save.diary.findIndex((e) => e.day === day);
  if (!s) { if (i >= 0) save.diary.splice(i, 1); return null; }
  const entry = { day, t, bean: bean || 'dongshan', text: s };
  if (i >= 0) save.diary[i] = entry; else save.diary.push(entry);
  save.diary.sort((a, b) => a.day - b.day);
  if (save.diary.length > DIARY_KEEP) save.diary.splice(0, save.diary.length - DIARY_KEEP);
  return entry;
}
export const diaryOn = (save, day) => save.diary.find((e) => e.day === day) || null;

/* ---------- 一次客人模式 ---------- */
export const GUEST_TEMP = 28;
export const GUEST = {
  invite: '老闆，今天要不要從門口進來一次？', // 【待定】決定 D9
  yes: '好，從門口進來。', // 【待定】
  no: '下次吧。', // 【待定】
  later: '好。門一直都在。', // 【待定】
  welcome: '歡迎。不急，先坐。', // 劇本原文（客人進門）
  order: '今天想喝點什麼？', // 【待定】
  orderOk: '好。請稍等。', // 【待定】
  // 聽完客人聊天，德叔過來收杯子時小聲說的
  end: ['……老闆，從門口進來，店是不是不太一樣？', '歡迎回來。這次，是真的。'], // 【待定】
};
// 德叔邀請：還沒當過客人、溫度夠了、今天還沒問過（問了說「下次吧」，隔天以後再問）
export function guestDue(save, temp, day) {
  return !!save.flags.seenOpening && !save.flags.guestVisit && temp >= GUEST_TEMP && save.flags.guestOffered !== day;
}

// 客人們聊這間店：A、B 兩位熟客一來一往。need(placed, ctx)：店裡擺了什麼；yuan：要予安在場（她說自己的東西）
// 【待定】以下對話全部是自行補寫
export const GUEST_TALKS = [
  { id: 'books', need: (p) => p.has('bookshelf') || p.has('book-wall'),
    lines: [['A', '這裡的書，好像都是有人讀過才放上去的。'], ['B', '我上次抽了一本，看到打烊都沒發現。']] },
  { id: 'record', need: (p) => p.has('record-player'),
    lines: [['A', '那台唱機，轉得有點慢。'], ['B', '慢一點剛好。這間店本來就不趕。']] },
  { id: 'radio', need: (p) => p.has('radio'),
    lines: [['A', '收音機一整天都是老歌。'], ['B', '好像只收得到一個台。可是那個台剛好。']] },
  { id: 'cat', need: (p) => p.has('cat-cushion') || p.has('cat-tree'),
    lines: [['A', '龍眼有自己的位子耶。'], ['B', '店裡最好的位子，大概都是他的。']] },
  { id: 'lamp', need: (p) => p.has('floor-lamp'),
    lines: [['A', '晚上那盞落地燈亮起來，很像回到家。'], ['B', '像有人幫你留了一盞燈。']] },
  { id: 'rattan', need: (p) => p.has('rattan-chair'),
    lines: [['A', '那張搖椅我坐過一次，差點睡著。'], ['B', '那大概就是它的用途。']] },
  { id: 'plants', need: (p) => p.has('plant') || p.has('succulent'),
    lines: [['A', '店裡的植物都長得很好。'], ['B', '這裡的人照顧東西，都很有耐心。']] },
  { id: 'board', need: (p) => p.has('menu-board'),
    lines: [['A', '黑板上寫「不限時，慢慢等」。'], ['B', '第一次看到店家這樣寫。我就真的慢慢等了。']] },
  { id: 'jar', need: (p) => p.has('longan-jar'),
    lines: [['A', '龍眼乾可以自己拿耶。'], ['B', '窯烤的。吃一顆，嘴巴裡都是煙的味道。']] },
  { id: 'sack', need: (p) => p.has('coffee-sack'),
    lines: [['A', '那袋生豆印著「東山」。'], ['B', '就是窗外那片山的豆子吧。']] },
  { id: 'easel', need: (p) => p.has('easel'),
    lines: [['A', '那幅畫，畫的是窗外的山吧。'], ['B', '畫得不太像。可是看久了，很像。']] },
  { id: 'cabinet', need: (p) => p.has('cabinet'),
    lines: [['A', '碗櫥裡的杯子都不成套。'], ['B', '所以每次來，都可以換一個杯子用。']] },
  { id: 'napkin', yuan: true, need: (p) => p.has('napkin'),
    lines: [['B', '那張紙巾上面，寫滿了字。'], ['yuan', '……那是我寫的。沒想到真的擺出來了。']] },
  { id: 'yuan-book', yuan: true, need: (p) => p.has('yuan-book'),
    lines: [['B', '那本書，是予安寫的吧？'], ['yuan', '不要念出書名，很害羞。']] },
  // 擺飾很少、很多的時候
  { id: 'few', need: (p, c) => c.count < 4,
    lines: [['A', '店裡東西不多。'], ['B', '空空的也好，坐起來很鬆。']] },
  { id: 'many', need: (p, c) => c.count >= 10,
    lines: [['A', '每次來，店裡都多一樣東西。'], ['B', '像有人在慢慢搬家進來。']] },
];
// 最後一定聊到老闆（他們沒認出門口進來的客人就是老闆）
export const GUEST_LAST = [['A', '這間店的老闆，好像不常在。'], ['B', '可是店裡每一樣東西，都像有人想過才放的。']]; // 【待定】

// 挑客人模式的對話：依擺飾挑兩段（同一份存檔、同一天結果固定），最後聊老闆。
// talkers：[A, B] 兩位熟客的 id（予安在場時放在 A 或 B 都可以）。回傳 [{ who, text }]
export function guestTalk(save, talkers, day) {
  const placed = new Set(save.owned.filter((o) => o.placed).map((o) => o.item));
  const c = { count: save.owned.filter((o) => o.placed).length };
  const [A, B] = talkers;
  const other = talkers.find((w) => w !== 'yuan') || B;
  const ok = GUEST_TALKS.filter((t) => t.need(placed, c) && (!t.yuan || talkers.includes('yuan')));
  const seed = (Number(save.createdAt) || 0) % 2147483647;
  const ranked = ok.map((t, i) => ({ t, r: hash01(seed, day, 59 + i) + (t.id === 'few' || t.id === 'many' ? 0.4 : 0) }))
    .sort((a, b) => a.r - b.r).slice(0, 2).map((x) => x.t);
  const role = (r, t) => (r === 'yuan' ? 'yuan' : t.yuan ? other : r === 'A' ? A : B);
  const out = [];
  for (const t of ranked) for (const [r, text] of t.lines) out.push({ who: role(r, t), text });
  for (const [r, text] of GUEST_LAST) out.push({ who: r === 'A' ? A : B, text });
  return out;
}

// 校稿與測試用：這個檔案裡所有寫得出來的句子
export function allAfterLines() {
  return [
    ...Object.values(CLOSING).flat(), ...Object.values(DIARY), ...Object.values(GUEST).flat(),
    ...GUEST_TALKS.flatMap((t) => t.lines.map((l) => l[1])), ...GUEST_LAST.map((l) => l[1]),
  ];
}
