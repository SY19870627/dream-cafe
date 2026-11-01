// 開場與老先生的信：文字與觸發條件（劇本「開場」「第一封老先生的信」）。
// 純邏輯，不依賴 Three.js 或 DOM，用 node --test 測試。

// 第一幕：辭呈的三種結尾（只影響後續一句台詞；凱文里程碑 4 會用到 'fire'）
export const RESIGNATIONS = [
  { id: 'thanks', text: '謝謝這些年的照顧。' },
  { id: 'dream', text: '我要去追一個夢了。' },
  { id: 'fire', text: '從今天起，我單方面辭退您。' },
];
export const resignationById = (id) => RESIGNATIONS.find((r) => r.id === id) || null;

// 第一幕：寫到一半的辭職郵件
// 【待定】收件人、主旨與郵件內文是自行補寫的（劇本只寫「一封寫到一半的郵件」）
export const RESIGNATION_MAIL = {
  to: '經理',
  subject: '辭呈',
  body: [
    '經理您好：',
    '這件事我想了很久，今天決定說出來。',
    '我會在月底前把手上的工作交接完畢，之後就不再進公司了。',
  ],
};

// 第二幕：律師信（劇本原文）
export const LAWYER_LETTER = {
  id: 'lawyer',
  title: '律師信',
  paragraphs: [
    '閣下您好：',
    '本事務所受一位已故委託人之託，通知您為「溫度基金」之受益人。本基金將支付您開設並經營一間咖啡店的全部費用。',
    '委託人只留下一個條件：請讓這間店，讓人覺得溫暖。店的營收、翻桌率與成本，皆不在考核之列。',
    '委託人亦交代，若您尚未辭職，請先辭職。',
    '一位咖啡管家已在台南東山等候您。隨信附上鑰匙一把。',
  ],
};

// 老先生的信。due：什麼時候由德叔交給玩家；give：德叔拿出來時說的話（依觸發原因）
export const LETTERS = [
  {
    id: 'first', title: '第一封信', no: 1,
    // 劇本：開店第 2 天，或溫度達 22°C
    due: (save, ctx) => !!save.flags.seenOpening && (ctx.daysOpen >= 2 || ctx.temp >= 22),
    give: (ctx) => (ctx.daysOpen >= 2
      ? '這封，他交代第二天給你。' // 劇本原文
      : '這封，他交代店暖起來一點就給你。'), // 【待定】第 1 天就到 22°C 時的版本（劇本只寫了「第二天」）
    paragraphs: [
      '你好。',
      '不好意思，突然把這間店交給你。你一定覺得奇怪，為什麼是你。這個問題，我後面會回答。',
      '我要你做的事很少。不用算帳，不用趕客人走，也不用把菜單改得划算。想放什麼就放什麼，想坐哪裡就坐哪裡。就把它當成，你一直想去、卻一直沒找到的那家店。',
      '德昌煮的咖啡很慢，你不要催他。他年輕的時候更慢，我也沒催過。',
      '我年輕的時候，也有過一間這樣的店。後來的事，等你待久一點，我再慢慢說。',
      '幫我摸摸那隻貓。',
    ],
  },
  // 第二封信（離開東山的早上）在階段 6 加入
];

export const letterById = (id) => (id === 'lawyer' ? LAWYER_LETTER : LETTERS.find((l) => l.id === id) || null);
export const hasRead = (save, id) => save.letters.some((l) => l.id === id);

// 現在該交給玩家的信（一次只交一封）；沒有就回傳 null
export function dueLetter(save, ctx) {
  return LETTERS.find((l) => !hasRead(save, l.id) && l.due(save, ctx)) || null;
}

// 讀完一封信：記進存檔，同一封只記一次
export function markRead(save, id, now, day) {
  if (hasRead(save, id)) return false;
  save.letters.push({ id, t: now, day });
  return true;
}
