// 開場四幕的字（第一版原文，一字不改）。
// 來源：legacy/src/letters.js（辭呈、律師信）、legacy/src/opening.js（各幕畫面上的字）、
//       legacy/src/main.js 3266、3287（推門後德叔的三句、「先坐。」）、legacy/docs/第一站劇本.md（開場）。
// 第一版自己標【待定】的字照抄（連同標記寫在註解裡），不在這裡改寫。
// 與 v3 規格對不上的地方（已故委託人、溫度基金、台南東山、老闆的稱呼……）先保留，列在 _agent/v3a/opus-report.md。

// 第一幕：辭呈的三種結尾（legacy/src/letters.js 6～10）
export const RESIGNATIONS = [
  { id: 'thanks', text: '謝謝這些年的照顧。' },
  { id: 'dream', text: '我要去追一個夢了。' },
  { id: 'fire', text: '從今天起，我單方面辭退您。' },
];

// 第一幕：寫到一半的辭職郵件（legacy/src/letters.js 15～23；第一版標【待定】：收件人、主旨與內文是自行補寫的）
export const RESIGNATION_MAIL = {
  to: '經理',
  subject: '辭呈',
  body: [
    '經理您好：',
    '這件事我想了很久，今天決定說出來。',
    '我會在月底前把手上的工作交接完畢，之後就不再進公司了。',
  ],
};

// 第二幕：律師信（legacy/src/letters.js 26～36；劇本原文）
export const LAWYER_LETTER = {
  title: '律師信',
  paragraphs: [
    '閣下您好：',
    '本事務所受一位已故委託人之託，通知您為「溫度基金」之受益人。本基金將支付您開設並經營一間咖啡店的全部費用。',
    '委託人只留下一個條件：請讓這間店，讓人覺得溫暖。店的營收、翻桌率與成本，皆不在考核之列。',
    '委託人亦交代，若您尚未辭職，請先辭職。',
    '一位咖啡管家已在台南東山等候您。隨信附上鑰匙一把。',
  ],
  attachment: '附件：鑰匙一把',
};

// 各幕畫面上的字（legacy/src/opening.js）
export const OFFICE = {
  clock: '16:49',
  clockAfter: '16:50', // 按下送出，時鐘跳到 16:50
  question: '結尾要寫哪一句？', // 第一版標【待定】：自行補寫的提示
  sign: '署名',
  signPlaceholder: '可以不寫',
  signEnd: '敬上',
  send: '送出',
  keys: '喀噠、喀噠……',
  to: '收件人：',
  subject: '主旨：',
};
export const TITLE = {
  lines: ['我單方面辭退老闆後，', '開了一間夢想中的咖啡店'],
  sub: '試玩版・台南東山',
  next: '下班', // 第一版標【待定】：標題畫面的按鈕「下班」是自行補寫的
  credit: '開發者 SY',
  links: [
    { text: 'GitHub', href: 'https://github.com/SY19870627' },
    { text: 'Threads', href: 'https://www.threads.com/@ye.c.feng' },
    { text: '方格子', href: 'https://vocus.cc/user/@SY19870627' },
  ],
};
export const MAILBOX = {
  caption: '回到租屋處。信箱裡有一個牛皮紙信封。', // 第一版標【待定】：旁白兩句是自行補寫的（劇本的舞台說明改寫）
  tap: '點信箱，把信封拿出來。',
  shaken: '搖起來，有鑰匙的聲音。',
  boxLabel: '拿出信封',
  artLabel: '一整排鐵信箱，其中一格露出牛皮紙信封',
  next: '出發去東山',
};
export const ROAD = {
  caption: ['傍晚，175 縣道。', '正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。'], // 旁白取自劇本第三幕的舞台說明
  artLabel: '傍晚的山路，兩旁是龍眼樹；三合院的窗亮著一盞燈，台階上睡著一隻橘貓',
  door: '推門進去',
};

// 第三幕後半：推門進去，吧台後的人抬頭（legacy/src/main.js 3266；劇本原文）
export const DESHU_ENTER = [
  '老闆，歡迎回來。',
  '哦，是第一次來。習慣了，對每個人都這樣說。',
  '那隻貓叫龍眼，是這間三合院本來就有的。他不是我們的，是我們是他的。',
];
// 第四幕 1（legacy/src/main.js 3287；劇本原文）
export const SIT = '先坐。';
// 第四幕 3、4（劇本原文；legacy/src/menu.js 22 的 served、legacy/src/main.js 3297）
// v3 放在第 1 天第一杯的前後（見 lines/shop.js 的 deshuLines）；第一版接在後面的佈置、溫度計不做
export const ACT4_CUP = '東山的豆，就是窗外那片山。';
export const ACT4_EMPTY = '店是空的。老闆，你想坐在什麼樣的店裡？';
