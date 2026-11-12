// 開場（第一幕到第四幕）的字：劇本 v3.8（作者 2026-11-12 核准前四幕）；留宿段依劇本 v3.9（2026-11-13 核准）。
// 規則：
// - 畫面上的對白、旁白、信件、按鈕字、標題與劇本逐字相同；句首的【待定】【待確認】【新增互動】是稿件標記，這裡已拿掉，只留正文。
// - 劇本裡全形括弧（……）的畫面／聲音／互動指示不是字，不放進 text；演出寫在每一句的 set／sfx／gate／optional（只給畫面用）。
// - 開場到「我本來只想躺一下，燈還沒關就睡著了。」為止；第一天起不在這裡。
//
// 每一句（beat）：
//   who：'deshu' 德叔、'me' 我（怡君自己開口）；沒有 who 是旁白
//   text：畫面上的字
//   set：從這一句起畫面要變成的樣子（累加；重新整理時用 sceneAt() 一次算回來）
//   sfx：這一句出現時的音效（一次）；wait：音效先響多久字才出來（毫秒）
//   gate：這一句不能點一下就過，要做完互動（door 推門／hold 按住騎／turnback 掉頭回去）
//   optional：這一句可以多做的互動（不做也能點下一句）

/* ---------- 第一幕　16:49 的辦公室 ---------- */
export const RESIGNATIONS = [
  { id: 'thanks', text: '謝謝這些年的照顧。' },
  { id: 'dream', text: '我要去追一個夢了。' },
  { id: 'fire', text: '從今天起，我單方面辭退您。' },
];

export const RESIGNATION_MAIL = {
  to: '經理',
  subject: '辭呈',
  body: [
    '經理您好：',
    '這件事我想了很久，今天決定說出來。',
    '我會在月底前把手上的工作交接完畢，之後就不再進公司了。',
  ],
};

export const OFFICE = {
  clock: '16:49',
  clockAfter: '16:50', // 按下送出，時鐘翻成 16:50
  question: '結尾要寫哪一句？',
  signature: '陳怡君　敬上', // 署名固定，沒有輸入框
  send: '送出',
  keys: '喀噠、喀噠……',
  to: '收件人：',
  subject: '主旨：',
};

/* ---------- 標題畫面 ---------- */
export const TITLE = {
  lines: ['我單方面辭退老闆後，', '開了一間夢想中的咖啡店'],
  sub: '試玩版・台南東山',
  next: '下班',
  credit: '開發者 SY',
  links: [
    { text: 'GitHub', href: 'https://github.com/SY19870627' },
    { text: 'Threads', href: 'https://www.threads.com/@ye.c.feng' },
    { text: '方格子', href: 'https://vocus.cc/user/@SY19870627' },
  ],
};

/* ---------- 第二幕　信箱與信封 ---------- */
export const MAILBOX = {
  caption: '我回到租屋處。信箱裡有一個牛皮紙信封。',
  tap: '點信箱，把信封拿出來。',
  shaken: '搖起來，有鑰匙的聲音。',
  boxLabel: '拿出信封',
  artLabel: '一整排鐵信箱，其中一格露出牛皮紙信封', // 只給螢幕閱讀器（alt），畫面上不出現
  next: '出發去東山',
};

// 信：排版字，不露筆跡
export const LETTER = {
  title: '信',
  greeting: '怡君：',
  paragraphs: [
    '妳沒見過我，突然收到這種信，一定覺得奇怪。不想理它，放著也沒關係。',
    '我在台南東山有一間老三合院，住了很多年。正廳是一間咖啡館，現在還開著。',
    '我年紀大了，現在不住那裡。店想交給妳經營，屋子也一起留給妳。那間屋子冬天曬得到太陽，坐起來是暖的。',
    '若妳尚未辭職，請先辭職。這句不算條件，是我雞婆。',
    '那邊有人在等妳。妳哪一天去，他都在。',
    '到了東山，找院子裡種一棵老龍眼樹、門上掛風鈴的那間三合院就是。鑰匙放在信封裡，屋子是妳的，鑰匙就是這個意思。門平常沒有鎖，到了用推的就好。',
  ],
  closing: '祝　平安',
  signature: '東山老屋　屋主',
  attachment: '附件：鑰匙一把',
  after: '辭了。今天下午四點五十分。',
};

/* ---------- 第三幕　東山、龍眼、推門、還沒打烊 ---------- */
export const ROAD = {
  card: '傍晚，東山。', // 轉場字
  door: '推門進去',
};
export const DEPART = { start: '發動' };
export const TEMPLE = { back: '掉頭回去' };

// 店內的鏡頭：counter＝朝吧台（德叔）；cat＝朝靠窗那一側（我和龍眼，德叔只露出肩膀）
const COUNTER = { yaw: 0 };
const SIDE = { yaw: 40 };

export const OPENING_LINES = {
  // 三合院外（傍晚）：兩句旁白 → 推門 → 貓鑽進去
  road: [
    { text: '我把機車停在三合院外面，安全帽掛在後照鏡上。' },
    { text: '正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。', gate: 'door' },
    { text: '門一開，台階上的橘貓瞇著眼醒來，伸一個懶腰後，從我腳邊鑽進去。', set: { doorOpen: true } },
  ],

  // 店裡（傍晚，站著）：先不出立繪，擦杯子聲 → 德叔只有聲音 → 立繪出現 → … → 泡好了
  deshu: [
    { text: '店裡的椅子都還沒收。吧台上一台磨豆機，旁邊排著洗好的杯子，後面有個人低著頭在擦杯子。',
      set: { ...COUNTER, portrait: false, deshu: 'brew', cat: 'doorway', cloth: true, cup: false } },
    { who: 'deshu', text: '還沒打烊，位子自己挑。', voice: true },
    { text: '他抬頭，手上那塊布停在杯口。', set: { portrait: true, deshu: null, cloth: false } },
    { text: '他低頭把杯子放好，兩隻手在圍裙上抹了抹，才又看我。' },
    { who: 'deshu', text: '是老闆啊，歡迎回來。' },
    { text: '老闆這兩個字，第一次被人這樣稱呼。' },
    { who: 'me', text: '我第一次來。' },
    { who: 'deshu', text: '我知道。' },
    { text: '他沒有改口。' },
    { who: 'me', text: '我們認識嗎？' },
    { who: 'deshu', text: '妳跟老老闆長得很像，一眼就能認出來。' },
    { who: 'me', text: '老老闆，是寫信給我的那個人？' },
    { who: 'deshu', text: '嗯。信是老老闆寫的。' },
    { who: 'me', text: '我們是親戚嗎？' },
    { text: '他把那塊布對折，掛回吧台邊。' },
    { who: 'deshu', text: '信上怎麼寫？' },
    { who: 'me', text: '沒寫。只說我沒見過。' },
    { who: 'deshu', text: '那我也不能多說什麼，妳會有機會知道的。' },
    { who: 'me', text: '好吧...' },
    // （橘貓跳上靠窗那張椅子，踩兩圈趴下。）（窗邊椅子上，橘貓的耳朵轉過來。）：cat chair＝踩兩圈 → 趴下 → 耳朵轉過來
    { text: '我往裡面走了一步。', set: { ...SIDE, portrait: false, deshu: 'stand', cat: 'chair' }, sfx: ['hop'] },
    { text: '橘貓下了椅子，走過來聞我的鞋，兩隻都聞。', set: { cat: 'shoes' }, sfx: ['hop'] },
    { text: '然後他整個身體靠上來，從頭到尾巴在我小腿上擦過去，掉頭再擦一次。', set: { cat: 'rub' }, optional: 'cat' }, // 點貓：手入鏡摸頭、頭頂上來；不點：蹭完坐在腳邊舔前腳（cat feet）
    { who: 'deshu', text: '那隻貓叫龍眼，是這間三合院的主人，而妳是老闆。', set: { ...COUNTER, portrait: true, deshu: null, cat: 'feet' } },
    { who: 'me', text: '龍眼。' },
    { text: '他沒理我，尾巴勾了一下我的腳踝。', set: { ...SIDE, portrait: false, deshu: 'stand' } },
    { text: '德叔彎腰，從吧台下面拿出一個杯子，沖了水。吧台上那排洗好的，他沒有動。', set: { ...COUNTER, deshu: 'brew' }, sfx: ['rinse'] },
    { who: 'me', text: '不用麻煩了。' },
    { text: '磨豆機響了，我後面的話沒講。', sfx: ['grind'], wait: 900 },
    { text: '龍眼的耳朵往後壓了一下，沒有走。', set: { ...SIDE, cat: 'earsBack' } },
    // （畫面留在我和龍眼，德叔只看得到肩膀。水滾，接著很細的水聲，斷了一次，又接上。不能操作。）
    { text: '香味一路到門口。', sfx: ['boil', 'thinPour'], wait: 2600 },
    { text: '德叔端著杯子走出吧台，放在靠窗那張桌上，龍眼剛才那個位子的右手邊。把手朝右。',
      set: { deshu: 'serveTable', cup: true }, sfx: ['place'] },
    { who: 'deshu', text: '泡好了。坐下喝看看。', set: { portrait: true, deshu: null } },
  ],

  // 第四幕：坐下後的閱讀框（背景是看得到窗的店內夜景，窗外暗下來）
  coffee: [
    { text: '椅子是木頭的，坐下去才知道腿有多痠。', set: { portrait: false, deshu: 'stand', cat: 'feetSeated', night: 0.35 } },
    { who: 'deshu', text: '這個杯子沒有人用，以後就是妳的。', set: { portrait: true, deshu: null } },
    { text: '他說完就回吧台，拿起那塊布，接著擦剩下的杯子。', set: { portrait: false, deshu: 'stand', cloth: true }, optional: 'cup' },
    { text: '燙。我吹了兩下才喝。', set: { cloth: false, night: 0.55 } },
    { text: '苦味很短，吞下去以後嘴裡是甜的。' },
    { text: '公司那台機器的咖啡，我都是放到冷了才想起來喝。' },
    { text: '我兩隻手捧著杯子，沒有放下來。', set: { night: 0.75 } },
    { text: '龍眼跳上對面那張椅子，踩兩圈，趴下。', set: { cat: 'across' }, sfx: ['hop'] },
    { who: 'me', text: '我今天只是先來看看。' },
    { who: 'deshu', text: '好。', set: { portrait: true, deshu: null } },
    { text: '我把咖啡喝完，杯子留在桌上。', set: { portrait: false, deshu: 'stand', night: 1 }, sfx: ['place'] },
    { who: 'me', text: '那我先回去了，改天再來。' },
    { who: 'deshu', text: '下去那段沒有路燈，騎慢一點。', set: { portrait: true, deshu: null } },
  ],

  // 黑路：按住往前騎才會翻到下一句
  ride: [
    { text: '過了第一個彎，後照鏡裡就看不到那盞燈了。', gate: 'hold' },
    { text: '車燈只照得到前面一小塊柏油，兩邊是果園還是水溝，我看不出來。', gate: 'hold' },
    { text: '來的時候天還亮，我是跟著導航騎上來的，沒在記路。', gate: 'hold' },
    { text: '現在手機夾在龍頭上，導航一直轉圈圈，訊號剩一格。', gate: 'hold' },
  ],
  // 岔路：點左邊或右邊（哪一邊後面的字都一樣）
  fork: [
    { text: '前面是岔路，兩邊都沒有路牌。', gate: 'fork' },
  ],
  temple: [
    { text: '我挑了一條騎進去。路越騎越窄，十幾分鐘後車燈照到一間鐵皮工寮，後面沒有路了。', set: { sight: 'hut' } },
    { text: '我掉頭騎回岔路，換另一條。這一條繞了一大圈，車燈照到一間土地公廟。', set: { sight: 'temple' } },
    { text: '那間廟我剛才經過了。' },
    { text: '我在廟前面停下來，腳撐著地。油表剩不到一半。' },
    { text: '回三合院的路我還認得。', gate: 'turnback' },
  ],
  // 回到三合院外（晚上），再推一次門
  return: [
    { text: '我把車停回剛才的位置。龍眼還在台階上，換了一邊睡。', gate: 'door' },
  ],
  // 店裡（晚上，站著）
  stay: [
    { text: '德叔還在，拿著掃把。我剛才坐的那張椅子還沒收。', set: { ...COUNTER, portrait: false, deshu: 'broom', cat: null, cup: true, night: 1 } },
    { who: 'me', text: '我繞了半個多小時，找不到路下去。' },
    { who: 'deshu', text: '這邊比較偏僻，導航可能會不太準。', set: { portrait: true, deshu: null } },
    { who: 'deshu', text: '老老闆交代過，要留一個房間讓妳睡。' },
    { who: 'me', text: '留給我？' },
    { who: 'deshu', text: '右邊護龍第一間整理好了，被子下午曬過。' },
    { who: 'me', text: '我什麼都沒帶。' },
    { who: 'deshu', text: '櫃子裡有毛巾。' },
    { who: 'deshu', text: '我回去了，早上再過來。門平常沒在鎖，妳要鎖的話，裡面有門閂。' },
  ],
  // 庭埕 → 護龍的房間 → 睡著
  room: [
    { text: '我穿過庭埕。龍眼跟到一半就坐下來，沒有再跟。', set: { place: 'yard' } },
    { text: '房間不大。我把鑰匙從口袋拿出來，放在枕頭旁邊。', set: { place: 'room' }, optional: 'bed' },
    { text: '我本來只想躺一下，燈還沒關就睡著了。', set: { lying: true } },
  ],
};

export const SPEAKER_NAMES = { deshu: '德叔', me: '我' };

// 第 i 句時畫面該有的樣子：從第 0 句累加到第 i 句的 set
export function sceneAt(lines, i) {
  const out = {};
  for (const b of (lines || []).slice(0, Math.max(0, i) + 1)) Object.assign(out, b.set || {});
  return out;
}

/* ---------- 第一版的字（不在可玩開場使用） ---------- */
// 以下只給仍保留的舊模組引用：v3a 驗證版（lines/shop.js、day.js）與三天 AVG 模組（story/script.js）。
// v3.8 的可玩開場不顯示這些字，也不會接到第一天。
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
export const DESHU_ENTER = [
  '老闆，歡迎回來。',
  '哦，是第一次來。習慣了，對每個人都這樣說。',
  '那隻貓叫龍眼，是這間三合院本來就有的。他不是我們的，是我們是他的。',
];
export const SIT = '先坐。';
export const ACT4_CUP = '東山的豆，就是窗外那片山。';
export const ACT4_EMPTY = '店是空的。老闆，你想坐在什麼樣的店裡？';
