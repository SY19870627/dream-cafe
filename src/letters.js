// 開場四幕的文字：辭呈三種結尾、辭職郵件、律師信、175 縣道德叔三句、第一杯。
// 全部從第一版原樣沿用（legacy/src/letters.js、legacy/src/opening.js、legacy/src/main.js、legacy/docs/第一站劇本.md）。
// 純資料，不依賴 DOM。

// 第一幕：辭呈的三種結尾（只影響後續一句台詞）
export const RESIGNATIONS = [
  { id: 'thanks', text: '謝謝這些年的照顧。' },
  { id: 'dream', text: '我要去追一個夢了。' },
  { id: 'fire', text: '從今天起，我單方面辭退您。' },
];
export const resignationById = (id) => RESIGNATIONS.find((r) => r.id === id) || null;

// 第一幕：寫到一半的辭職郵件（第一版沿用）
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
  title: '律師信',
  paragraphs: [
    '閣下您好：',
    '本事務所受一位已故委託人之託，通知您為「溫度基金」之受益人。本基金將支付您開設並經營一間咖啡店的全部費用。',
    '委託人只留下一個條件：請讓這間店，讓人覺得溫暖。店的營收、翻桌率與成本，皆不在考核之列。',
    '委託人亦交代，若您尚未辭職，請先辭職。',
    '一位咖啡管家已在台南東山等候您。隨信附上鑰匙一把。',
  ],
};

// 畫面上的旁白與按鈕（第一版沿用）
export const OPENING_TEXT = {
  question: '結尾要寫哪一句？',
  keys: '喀噠、喀噠……',
  title: ['我單方面辭退老闆後，', '開了一間夢想中的咖啡店'],
  titleSub: '試玩版・台南東山',
  titleNext: '下班',
  mailbox: '回到租屋處。信箱裡有一個牛皮紙信封。',
  mailboxTap: '點信箱，把信封拿出來。',
  mailboxShake: '搖起來，有鑰匙的聲音。',
  keyNote: '附件：鑰匙一把',
  toRoad: '出發去東山',
  road: ['傍晚，175 縣道。', '正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。'],
  enter: '推門進去',
};

// 第三幕後半：推門進去，吧台後的人抬頭（劇本原文）
export const DESHU_ENTER = [
  '老闆，歡迎回來。',
  '哦，是第一次來。習慣了，對每個人都這樣說。',
  '那隻貓叫龍眼，是這間三合院本來就有的。他不是我們的，是我們是他的。',
];

// 第四幕：第一杯（劇本原文）
export const FIRST_CUP = {
  sit: '先坐。',
  brewing: '德叔慢慢溫杯、磨豆、注水。', // 劇本第四幕第 2 步的舞台說明
  served: '東山的豆，就是窗外那片山。',
  empty: '店是空的。老闆，你想坐在什麼樣的店裡？',
  glance: '德叔看了一眼溫度計，沒說話。', // 劇本第四幕第 5 步的舞台說明
};
