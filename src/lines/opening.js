// 開場（第一幕到第四幕）的字：照劇本 v5.9（_agent/v3b/script-v5.9.md：v5.8 ＋ v4 倒數字卡版 ＋ 承峰 2026-11-22 02:07／02:09 字卡用語）
// 「# 開場」到第一晚最後一句，逐字相同。第一幕、第三幕、第四幕是 v5.8 原字（只改睡前「今天下班前我還坐在公司」那一句）；
// 第二幕改成第一次收到信、讀完淡出；新增字卡「前 4 天」「前 2 天」與特休前一晚（「出發去東山」移到這裡）。
// 規則：
// - 畫面上的對白、旁白、信件、按鈕字、標題與劇本逐字相同；劇本沒有的字不放上畫面（只給螢幕閱讀器的 aria-label 除外）。
// - 句首的【待定】【待確認】【新增互動】是稿件標記，這裡已拿掉，只留正文；引用區塊裡的空白行不是字。
// - 劇本裡全形括弧（……）的畫面／聲音／互動指示不是字，不放進 text；演出寫在每一句的 set／sfx／gate／optional（只給畫面用）。
//   例外：括弧裡用「」寫明要出現在畫面上的字（按鈕字「下班」「掉頭回去」、操作提示「點信封，把信拿出來。」、
//   打字聲字樣「喀噠、喀噠……」、轉場字「夜裡，東山。」、提示字「摸摸龍眼」「點床躺下」）照「」裡的原字顯示。
// - 開場到第一晚自白最後一句「我本來只想躺一下，燈還沒關就睡著了。」為止；第一天起在 lines/days.js。
//
// 每一句（beat）：
//   who：'deshu' 德叔、'me' 我（怡君自己開口）；沒有 who 是旁白
//   text：畫面上的字
//   set：從這一句起畫面要變成的樣子（累加；重新整理時用 sceneAt() 一次算回來）
//   sfx：這一句出現時的音效（一次）；wait：音效先響多久字才出來（毫秒）
//   gate：這一句不能點一下就過，要做完互動（door 推門／hold 按住騎／turnback 掉頭回去）
//   optional：這一句可以多做的互動（不做也能點下一句）

/* ---------- 第一幕　16:49 的辦公室 ---------- */
// 離職事由固定一句（劇本 v5.6：「離職事由：從今天起，我單方面辭退您。」），不再三選一；要先點過事由欄才能送出
export const RESIGNATION = { id: 'fire', text: '從今天起，我單方面辭退您。' };
export const RESIGNATIONS = [RESIGNATION]; // 舊名字：只剩這一句

// 公司簽核系統的「離職申請單」：離職申請單 → 申請人：陳怡君（固定，沒有輸入框）→ 送簽對象：經理
// → 離職事由（點一下才打出固定那一句）→ 說明 → 特休那一句 → 送出
export const OFFICE = {
  clock: '16:49',
  clockAfter: '16:50', // 按下送出，時鐘翻成 16:50
  form: '離職申請單',
  applicantLabel: '申請人：',
  applicant: '陳怡君', // 申請人固定，沒有輸入框
  toLabel: '送簽對象：',
  to: '經理',
  reasonLabel: '離職事由：', // 事由欄（點一下才填進固定那一句）
  note: '說明：這件事我想了很久，今天決定說出來。',
  leave: '我還有特休沒休完，會先把特休休完，離職日就是假休完的那一天。',
  keys: '喀噠、喀噠……', // 打字聲字樣（劇本：打字聲字樣「喀噠、喀噠……」）：打字時才出現
  send: '送出',
};

/* ---------- 標題畫面 ---------- */
// 按「下班」先出字卡「我單方面辭退老闆前 4 天」，再進租屋處房間（不按就留在標題畫面）。
// 接回場（resend）也有一顆「下班」，去向是字卡「第二天」：字在 lines/days.js 的 RESEND.next，處理也分開。
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

/* ---------- 倒數字卡（劇本 v5.9，承峰 2026-11-22 02:07／02:09 定的用語） ---------- */
// 數字用阿拉伯數字，N 前面一個半形空格；歸零卡「當天」與「16:49」之間是全形空格。
// t4card：標題按「下班」之後；t2card：讀完信之後、特休前一晚之前；t1card：第一晚睡著之後、「最底下那個抽屜」之前；
// t0card：超商結尾之後、接回 16:49 的辦公室之前（t1card／t0card 在 lines/days.js 的 DAY_CARDS）。
export const COUNTDOWN = {
  t4card: '我單方面辭退老闆前 4 天',
  t2card: '我單方面辭退老闆前 2 天',
  t1card: '我單方面辭退老闆前 1 天',
  t0card: '我單方面辭退老闆當天　16:49',
};
// 開場裡只有一張字卡的幕（沒有句子）
export const OPENING_CARDS = { t4card: COUNTDOWN.t4card, t2card: COUNTDOWN.t2card };

/* ---------- 第二幕　收到信（第一次收到） ---------- */
// 租屋處房間（幕 id 沿用 'mailbox'，舊存檔不會壞）：旁白三句 → 操作提示 → 點信封（只能點一次）→ 旁白換句 → 約一秒多後自動進信件畫面
export const ROOM_LETTER = {
  lines: ['我下班回到租屋處，進了房間，把包包放在床上。', '今天我收到一封信。牛皮紙信封，拿起來裡面有東西在響。', '我在摺疊桌前坐下來，把信封放在桌上。'],
  hint: '點信封，把信拿出來。',
  pulled: '我把信抽出來，從頭看起。',
  envLabel: '信封', // 只給螢幕閱讀器（aria-label），畫面上不出現
};
// 信：排版字，不露筆跡。標題「信」→ 信的內文 → 信後旁白（一句一句點）→ 最後一句再點一下淡出（沒有「出發去東山」）→ 字卡「前 2 天」
export const LETTER = {
  title: '信',
  greeting: '怡君：',
  paragraphs: [
    '妳沒見過我，突然收到這種信，一定覺得奇怪。不想理它，放著也沒關係。',
    '我在台南東山有一間老三合院，住了很多年。正廳是一間咖啡館，現在還開著。',
    '我年紀大了，現在不住那裡。店想交給妳經營，屋子也一起留給妳。那間屋子冬天曬得到太陽，住下來很舒服，而咖啡館坐起來也是暖的。',
    '我沒有要強迫妳辭職，只是咖啡館比較遠，擔心妳應付不來。',
    '那邊有人在等妳。妳哪一天去，他都在。',
    '到了東山，找院子裡種一棵老龍眼樹、門上掛風鈴的那間三合院就是。鑰匙放在信封裡，屋子是妳的，鑰匙就是這個意思。門平常沒有鎖，到了用推的就好。',
  ],
  closing: '祝　平安',
  signature: '東山老屋　屋主',
  afterLines: [
    '信裡說，台南東山有一間老三合院，正廳是咖啡館，屋子和店都想交給我。',
    '寫信的人我沒見過，東山我也沒去過。',
    '辭職這件事，我沒有想過。',
    '我把信摺好，和信封一起放在摺疊桌上。鑰匙留在信封裡。',
  ],
  keyLabel: '鑰匙', // 可選的鑰匙特寫按鈕：只有圖示，這個字只給螢幕閱讀器（aria-label），畫面上不出現
};

/* ---------- 特休前一晚（字卡「前 2 天」之後；幕 id 'eve'） ---------- */
// 同一間租屋處房間（信封一直擺在桌上，不能點）：旁白五句一句一句點 → 最後一句才出「出發去東山」→ 夜裡，東山
export const EVE = {
  lines: [
    '那封信一直擺在摺疊桌上。',
    '今天人資來問我，特休一天都沒請，要不要先放幾天。',
    '我說，去年的也是，一天都沒請，全部放著沒用。我先請了明天一天。',
    '明天不用上班。我想去看一眼，那間咖啡館是不是真的在那裡。',
    '我把鑰匙從信封裡拿出來，放進外套口袋。信留在桌上。',
  ],
  next: '出發去東山',
};

/* ---------- 第三幕　東山、龍眼、推門、還沒打烊 ---------- */
// card：轉場字（只在第一次到、第 0 句）
export const ROAD = { door: '推門進去', card: '夜裡，東山。' };
export const DEPART = { start: '發動' };
// 掉頭：按鈕字「掉頭回去」
export const TEMPLE = { back: '掉頭回去' };

// 店內 2D 定景的畫面（店內環景已拔掉）：counter＝吧台那一側（整張）；side＝靠窗那一側（我和龍眼，畫面往窗邊推近一點）
const COUNTER = { frame: 'counter' };
const SIDE = { frame: 'side' };

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
      set: { ...COUNTER, portrait: false, deshu: 'brew', cat: 'doorway', cloth: true, cup: false, night: 1 } }, // 夜裡到東山：窗外是夜色
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
    { who: 'deshu', text: '嗯，信是從這裡寄出去的。' },
    { who: 'me', text: '我們是親戚嗎？' },
    { text: '他把那塊布對折，掛回吧台邊。' },
    { who: 'deshu', text: '信上怎麼寫？' },
    { who: 'me', text: '沒寫。只說我沒見過。' },
    { who: 'deshu', text: '那我也不能多說什麼，妳會有機會知道的。' },
    { who: 'me', text: '好吧...' },
    // （橘貓跳上靠窗那張椅子，踩兩圈趴下。）（窗邊椅子上，橘貓的耳朵轉過來。）：cat chair＝踩兩圈 → 趴下 → 耳朵轉過來
    { text: '我往裡面走了一步。', set: { ...SIDE, portrait: false, deshu: 'stand', cat: 'chair' }, sfx: ['hop'] },
    { text: '橘貓下了椅子，走過來聞我的鞋，兩隻都聞。', set: { cat: 'shoes' }, sfx: ['hop'] },
    { text: '然後他整個身體靠上來，從頭到尾巴在我小腿上蹭過去，掉頭再蹭一次。', set: { cat: 'rub' }, optional: 'cat' }, // 點貓：手入鏡摸頭、頭頂上來；不點：蹭完坐在腳邊舔前腳（cat feet）
    { who: 'deshu', text: '那隻貓叫龍眼，是這間三合院的主人，而妳是新老闆。', set: { ...COUNTER, portrait: true, deshu: null, cat: 'feet' } },
    { who: 'me', text: '龍眼。' },
    { text: '他沒理我，尾巴勾了一下我的腳踝。', set: { ...SIDE, portrait: false, deshu: 'stand' } },
    { text: '德叔彎腰，從吧台下面拿出一個杯子，沖了水。吧台上那排洗好的，他沒有動。', set: { ...COUNTER, deshu: 'brew' }, sfx: ['rinse'] },
    // （音效：磨豆機，短短一陣。）→ 德叔開口；我本來要拒絕，話嚥了回去
    { who: 'deshu', text: '老闆要不要試一下咖啡？', sfx: ['grind'], wait: 900 },
    { text: '德叔問完沒有等我回答，就把磨好的咖啡粉倒進濾杯。', set: { portrait: false, deshu: 'brew' } },
    { text: '我本來打算拒絕的話來不及說出口，嚥了回去。' },
    { text: '龍眼的耳朵往後壓了一下，沒有走。', set: { ...SIDE, cat: 'earsBack' } },
    // （畫面留在我和龍眼，德叔只看得到肩膀。水滾，接著很細的水聲，斷了一次，又接上。不能操作。）
    { text: '香味一路到門口。', sfx: ['boil', 'thinPour'], wait: 2600 },
    { text: '德叔端著杯子走出吧台，放在靠窗那張桌上，龍眼剛才那個位子的右手邊。把手朝右。',
      // char_deshu_serve 立繪手上就端著那一杯：這句桌上還沒有杯子（不然畫面上兩個杯子）
      set: { deshu: 'serveTable', cup: false } },
    // 放下之後桌上的杯子才出現（place 音效在這句）。沒有桌旁空手的德叔立繪：放下後 2D 德叔退場、改出對話立繪
    { who: 'deshu', text: '泡好了。坐下喝看看。', set: { portrait: true, deshu: null, cup: true }, sfx: ['place'] },
  ],

  // 第四幕：坐下後的閱讀框（背景是看得到窗的店內夜景；夜裡到東山，窗外已經是黑的）
  coffee: [
    { text: '椅子是木頭的，機車騎一個多小時，我屁股麻到現在。', set: { portrait: false, deshu: 'stand', cat: 'feetSeated', night: 1 } },
    { who: 'deshu', text: '這個杯子沒有人用，以後就是妳的。', set: { portrait: true, deshu: null } },
    { text: '他說完就回吧台，拿起那塊布，接著擦剩下的杯子。', set: { portrait: false, deshu: 'stand', cloth: true }, optional: 'cup' },
    { text: '燙。我吹了兩下才喝。', set: { cloth: false } },
    { text: '苦味很短，吞下去以後嘴裡是甜的。' },
    { text: '哇，好久沒喝到現沖的咖啡了，早上在公司的那杯咖啡，忙完回頭喝都冷掉了。' },
    { text: '我兩隻手捧著杯子，沒有放下來。' },
    { text: '龍眼跳上對面那張椅子，踩兩圈，趴下。', set: { cat: 'across' }, sfx: ['hop'] },
    { who: 'me', text: '我今天只是先來看看。' },
    { who: 'deshu', text: '好。', set: { portrait: true, deshu: null } },
    { text: '我把咖啡喝完，杯子留在桌上。', set: { portrait: false, deshu: 'stand' }, sfx: ['place'] },
    { who: 'me', text: '那我先回去了，改天再來。' },
    { who: 'deshu', text: '出去那段路沒有路燈，騎車小心。', set: { portrait: true, deshu: null } },
  ],

  // 黑路：按住往前騎才會翻到下一句
  ride: [
    { text: '過了第一個彎，後照鏡裡就看不到那盞燈了。', gate: 'hold' },
    { text: '車燈只照得到前面一小塊柏油，兩邊是果園還是水溝，我看不出來。', gate: 'hold' },
    { text: '來的時候天就已經黑了，我是跟著導航騎上來的，沒在記路。', gate: 'hold' },
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
    { who: 'me', text: '我繞了半個多小時，找不到回去的路。' },
    { who: 'deshu', text: '這邊比較偏僻，導航可能會不太準。', set: { portrait: true, deshu: null } },
    { who: 'deshu', text: '老老闆交代過，要留一個房間讓妳睡。' },
    { who: 'me', text: '留給我？' },
    { who: 'deshu', text: '右邊護龍第一間整理好了，棉被下午曬過。' },
    { who: 'me', text: '我什麼都沒帶。' },
    { who: 'deshu', text: '櫃子裡有毛巾。' },
    { who: 'deshu', text: '我也住在這間三合院，晚上有什麼事，妳喊一聲我就聽得到。門平常沒在鎖，妳要鎖的話，裡面有門閂。' },
  ],
  // 庭埕 → 護龍的房間 → 躺下 → 第一晚睡前自白（劇本 v5.8）→ 睡著
  // 第 2 句起是自白（mono）：畫面是躺下的視角（lying）；自白期間有「跳過自白」。
  // 舊存檔停在第 2 句（舊的睡著句）會落到自白第一句：人已經躺下，接著看自白。
  // 最後一句（sleep）一出現就自動存檔成第一天早上。
  room: [
    { text: '我穿過庭埕。龍眼跟到一半就坐下來，沒有再跟。', set: { place: 'yard' } },
    { text: '房間不大。我把鑰匙從口袋拿出來，放在枕頭旁邊。', set: { place: 'room' }, optional: 'bed' },
    { text: '外面有蟲在叫，遠一點的地方有狗叫了幾聲，又停了。', set: { lying: true }, mono: true },
    { text: '棉被真的有曬過，德叔沒有騙我。', mono: true },
    { text: '蓋起來暖暖的，跟我在市區拿去投幣烘衣機、剛烘好拿出來的棉被一樣暖。', mono: true },
    { text: '可是他說老老闆交代過，要留一個房間讓我睡。', mono: true },
    { text: '老老闆怎麼會知道我今天晚上回不去？', mono: true },
    { text: '我連老老闆是誰都還沒搞清楚，就先睡在他留給我的房間裡了。', mono: true },
    { text: '今天下班前我還坐在公司，現在躺在這裡，覺得那好像是好幾天以前的事。', mono: true },
    { text: '明天早上看到德叔，我要先問他老老闆的事。', mono: true },
    { text: '我本來只想躺一下，燈還沒關就睡著了。', mono: true, sleep: true },
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
// 可玩流程（開場 → 第一～四天）不顯示這些字，也不會進入三天 AVG 模組。
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
