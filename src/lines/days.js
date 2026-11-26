import { COUNTDOWN, LETTER } from './opening.js';

// 劇本 v5.9（_agent/v3b/script-v5.9.md：v5.8 ＋ v4 倒數字卡版 ＋ 承峰 2026-11-22 02:07／02:09 字卡用語）：
// 字卡「我單方面辭退老闆前 1 天」→「# 最底下那個抽屜」起到超商（印章、提款機、超商三處改句，超商結尾改兩句）
// → 字卡「我單方面辭退老闆當天　16:49」→ 接回 16:49 的辦公室（RESEND）→ 字卡「第二天」→ 之後 v5.8 原字到「我：「好，我帶去公司。」」。
// 以下是 v5.8 時的說明（段落仍適用）：
// 第一天到研發咖啡的字：劇本 v5.8（_agent/v3b/script-v5.8.md，承峰 2026-11-21 19:44 定稿）正文
// 「# 第一天　最底下那個抽屜」起到「我：「好，我帶去公司。」」。
// - 第一天開頭到下山進市區：v5.7 原字（v5.0 補回；【待定】句照演，標記不顯示）。還鑰匙是「不好意思阿，我手騰不出空間來，妳先留著吧。」
//   「那我……下次拿來。」（不再用 v5.6 的挽留三句與「下次再來。」）
// - 「## 信箱、房東」到「德叔：「我相信妳一定可以的。」」：v5.6 已核准正文（父親開的戶頭、壓歲錢、活存十六萬、提款機補刷；
//   房東只提醒下禮拜交房租）。超商下決心後是字卡「第二天」，再進「# 第二天　回咖啡館」。
// - 「我相信妳一定可以的。」之後：德叔的微笑停一拍淡出 → 字卡「三天後」（字卡出現前自動存檔），不加回住處、不加隔天早上。
// - 「# 三天後」起：v5.6 原字，一字不改。
// 開場（第一幕～第一晚）在 lines/opening.js；公司那場不在這裡（lines/company.js 不動）。
// 規則與開場相同：
// - 畫面上的對白、旁白、按鈕字、章名與劇本正文逐字相同。
// - 劇本裡全形括弧（……）的畫面／聲音／互動指示、【小圖：…】、【新增互動】【待定】、實作註記都不是字，不放進 text；演出寫在每一句的 set／sfx／tap／gate／optional。
// - 第一晚借住、隔天早上下山之後，不再演起床睡覺、不再睡護龍（沒有睡前自白、沒有 sleep）。
// - 章節小標（## 信箱、房東／## 房間、盤點／## 提款機／## 超商／## 市調…）不上畫面；上畫面的只有每天的章名與字卡。
//
// 每一幕是一個存檔點（幕 id 是穩定的英文短名，加在 story/state.js 的 OPENING_ACTS 後面，只往前）。
// view：still＝整張背景圖的畫面；card＝只有一張字卡（沒有句子）。
//   店裡的幕（第一句 set.place 是 'shop'）也是 still：背景是店內 2D 定景（view/shop-still.js，圖見 art-map.js 的 SHOP_STILL_NIGHT／SHOP_STILL_DAY），
//   德叔、龍眼、杯子疊在上面；其他地方用 view/days.js 的 showDay。店內環景已拔掉（承峰 2026-11-21 20:48）。
// 每一句（beat）除了開場就有的 who／text／set／sfx／wait／gate／optional，另外有：
//   tap：這一句的字出來「之前」要先做的互動（字先不出來；做完才出這一句）。可以是一個或依序好幾個：
//     mini      小圖或分鏡格已經疊上來，玩家點一下才出句子（set.mini 決定是哪一張；sb-… 是分鏡格）
//     panel     只在這一句字出來之前亮一下的分鏡格（b.panel），點一下收起才出句子（研發咖啡開頭、貓靠近第 2 格）
//     panelAuto 分鏡格自己亮起、不佔點擊（b.panel；刷存摺第 1 格進場景自動亮）
//     pause     停一拍，玩家點一下才繼續
//     poster    點座位區的徵人海報
//     keyBar    點包包裡的鑰匙，放到吧台上　　calico 點花斑貓　　can 點地上的空罐子
//   ifTap：可點可不點、不點就不出這一句（mailbox：點了信箱才出「信箱是空的……」；不點直接接樓梯間的拖鞋聲與房東）
//   gate：keyGive 把鑰匙拖向德叔（他兩手都在豆子裡，沒有接；拖向吧台也放不下，一樣回到手上）
//   face：德叔這一句用哪一張臉（smile＝char_deshu_smile）；只管這一句，不累加
//   linger：這一幕最後一句說完後停多久才淡出（毫秒）；停之前就先存成下一幕（字卡出現前自動存檔）
//   set.mini：疊在原場景上的小圖（stain 水痕／passbook 存簿／hat 斗笠／label 空罐子的標籤／longan 龍眼乾）；null＝收掉
//     也放分鏡格（承峰 2026-11-24／25 定版八組，咖啡館畫師產圖，見 view/days.js 的 STORYBOARDS）：
//     sb-<名>＝單格；sb-<名>-<n>＝直排多格亮到第 n 格（sb-atm-1～3 刷存摺、sb-cat-1～2 貓靠近）
//   set.prop：特寫卡（徵人海報已改成分鏡格 sb-poster，現在第一天起沒有句子用特寫卡）
// optional（可選，不做也能翻頁）：faucet 水龍頭

// 說話的人（開場的德叔與我之外；名牌字）
export const DAY_SPEAKERS = {
  landlord: '房東', kunbo: '坤伯', storeManager: '店長', clerk: '店員',
};
// 對稿用：劇本裡的說話人寫法 → who
export const SCRIPT_SPEAKERS = {
  德叔: 'deshu', 我: 'me', 房東: 'landlord', 坤伯: 'kunbo', 店長: 'storeManager', 店員: 'clerk',
};

// 章名卡：每天開頭用劇本標題原文（背景圖的畫面用 showDay 的 .op-card；店裡開始的一天用 showCard）
// v5.9：「最底下那個抽屜」拿掉「第一天」（前面先出倒數字卡「我單方面辭退老闆前 1 天」）
export const DAY_TITLES = {
  d1wake: '最底下那個抽屜',
  d2cafe: '第二天　回咖啡館',
};
// 只有一張字卡的幕（view: card）：倒數字卡（字在 lines/opening.js 的 COUNTDOWN）、「（字卡：第二天）」畫面只顯示「第二天」；「# 三天後」用劇本標題原文
export const DAY_CARDS = {
  t1card: COUNTDOWN.t1card,
  t0card: COUNTDOWN.t0card,
  d2card: '第二天',
  d5card: '三天後',
};

/* ---------- 接回場（幕 id 'resend'）：歸零字卡之後，回到開場同一間辦公室 ---------- */
// 時鐘 16:49，事由（親寫句）和說明已在欄位裡；玩家不能點事由、不能按送出。送出音效和翻鐘自動播一次（跟開場同一份），停在 16:50。
// 然後四拍一句一句點：送出去了 →（【待定】旁白）我想起信上的那一句 → 信上原句（親寫原字，信的字體）→ 其實我已經辭職了...（親寫原字）
// → 最後一句才出「下班」→ 字卡「第二天」。信的字體那一拍是 RESEND.quoteAt。
// 這一幕沒有閱讀框的句子（lineCount 0）：讀檔落在這一幕中間，從開頭重播自動送出。
export const RESEND = {
  lines: [
    '送出去了。',
    '我想起信上的那一句。', // 【待定】v4 第四節第 10 處原句
    LETTER.paragraphs[3], // 我沒有要強迫妳辭職，只是咖啡館比較遠，擔心妳應付不來。（信上原句）
    '其實我已經辭職了...',
  ],
  quoteAt: 2, // 信上原句那一拍：用信的字體
  next: '下班',
};

// 店內 2D 定景的畫面：counter＝吧台那一側（整張）；side＝靠窗那一側（桌子、龍眼，畫面往窗邊推近一點）。
// 兩個都用同一張店內定版圖（scene_shop_interior_night_lit_v2，看得到吧台與左側的窗；side 只是往窗邊推近一點）。
const COUNTER = { frame: 'counter' };
const SIDE = { frame: 'side' };
const SHOP = { place: 'shop' };

// view：still 背景圖／card 字卡／office 接回場（開場同一間辦公室的 DOM 畫面，view/opening.js 的 showOpening）
export const DAY_ACT_VIEW = {
  t1card: 'card',
  d1wake: 'still', d1shop: 'still', d1town: 'still', d1home: 'still', d1bank: 'still', d1store: 'still',
  t0card: 'card', resend: 'office',
  d2card: 'card', d2cafe: 'still',
  d5card: 'card', d5cafe: 'still', d5village: 'still', d5return: 'still', d5thanks: 'still', d5brew: 'still',
};
export const DAY_ACTS = Object.keys(DAY_ACT_VIEW);
// 跳關選單、回報用的幕名（劇本段落）。v5.9：原「第一天」那段改用事件名（前面是字卡「我單方面辭退老闆前 1 天」）
export const DAY_ACT_NAMES = {
  t1card: '字卡：我單方面辭退老闆前 1 天',
  d1wake: '護龍早上、洗臉', d1shop: '店裡（鑰匙沒還成）', d1town: '下山、信箱、房東',
  d1home: '房間、盤點', d1bank: '提款機', d1store: '超商',
  t0card: '字卡：我單方面辭退老闆當天　16:49', resend: '接回：16:49 的辦公室（自動送出）',
  d2card: '字卡：第二天', d2cafe: '第二天・回咖啡館',
  d5card: '字卡：三天後', d5cafe: '三天後・咖啡館', d5village: '三天後・市調、坤伯院子', d5return: '三天後・回到店裡', d5thanks: '三天後・坤伯來答謝', d5brew: '研發咖啡',
};

export const DAY_LINES = {
  /* ====================== （字卡：我單方面辭退老闆前 1 天）→ 最底下那個抽屜 ====================== */
  t1card: [],
  // 護龍，早上（窗外有雞叫，遠處有機車發動的聲音）→ 洗手台（可點水龍頭；鏡子裡是帶缺點的角色卡；不點她自己開水，劇情照走）
  d1wake: [
    { text: '我是被雞叫醒的。', set: { place: 'roomMorning', prop: null, mini: null }, sfx: ['rooster'] },
    { text: '雖然臨時在外面過夜，但這是我這半年睡得最好的一次。' },
    { text: '手機還有百分之十一。充電器在租屋處，我昨天出門的時候沒想過會在外面過夜。' },
    // 低頭洗臉：鏡子裡還沒有角色卡（mirror false）；抬起頭那句才淡入
    { text: '水很冰。', set: { place: 'basin', mirror: false }, optional: 'faucet' },
    { text: '我關掉銅色的水龍頭抬起頭，木頭框的鏡子剛好照到我整張臉。', set: { mirror: true } },
    { text: '鼻梁和臉頰上的雀斑還是一樣多，從國中照鏡子發現後，就沒消退過。' },
    { text: '黑眼圈好明顯，也是去年的某天發現後，就一直掛在上面。' },
    { text: '衣服是昨天那套。我聞了一下袖口，還好。' },
  ],
  // 咖啡店內（早上，沿用開場）：吧台上攤著兩個竹篩，生豆鋪滿；爐子沒開。德叔挑豆（豆子一顆一顆丟進鐵碗）
  // → 把鑰匙拖向德叔（他兩手都在豆子裡，沒有接；拖向吧台也放不下，一樣回到手上）
  d1shop: [
    { text: '我昨天喝的那個杯子洗好了，收在德叔背後的架子上。', set: { ...SHOP, ...COUNTER, tone: 'morning', deshu: 'brew', cat: 'nap', cup: false, portrait: false } },
    { text: '別的杯子都是疊在一起的，只有那個自己放一格，把手朝右。' },
    { text: '德叔站在吧台後面挑豆，壞的丟鐵碗，頭沒抬。', sfx: ['tickBowl'] },
    { who: 'me', text: '德叔早。' },
    { who: 'deshu', text: '早。' },
    { who: 'deshu', text: '昨天睡得好嗎？' },
    { who: 'me', text: '謝謝，睡得不錯。昨天不好意思，還住了一晚。我先回去了。' },
    { who: 'deshu', text: '不會啦，有睡好就好。那間本來就是留給妳的，不用跟我客氣。' },
    { text: '我從口袋拿出鑰匙，遞過去。', sfx: ['keys'], gate: 'keyGive' },
    { who: 'deshu', text: '不好意思阿，我手騰不出空間來，妳先留著吧。' },
    { text: '他兩隻手都是豆子的銀皮。吧台上也沒有一塊空的地方。', sfx: ['tickBowl'] },
    { text: '我拿著鑰匙站了一下。' },
    { who: 'me', text: '那我……下次拿來。' },
    { who: 'deshu', text: '鄉下的路碎石比較多，妳回去小心騎車阿。' },
    { text: '我把鑰匙放回口袋。', sfx: ['keys'] },
  ],
  // 下山的路（接省道，進市區）→「## 信箱、房東」：租屋處樓下信箱（可點可不點）→ 樓梯間：拖鞋聲、房東
  // 不點信箱：不出「信箱是空的……」，直接接拖鞋聲與房東整段（「記得下禮拜要交房租。」不省略）；不會從信箱直接進房間
  d1town: [
    { text: '下山到市區一個多小時。等了幾個紅燈，進市區以後外套穿不住，我停在路邊脫掉塞進車廂。', set: { place: 'road', prop: null, mini: null }, sfx: ['engineStart'] },
    { text: '信箱是空的，連傳單都沒有。', set: { place: 'mailbox' }, ifTap: 'mailbox' },
    { text: '聽到這個拖鞋聲，我就知道是房東。', set: { place: 'stairs' }, sfx: ['slipper'] },
    { text: '要是早一分鐘上樓就好了。今天真的沒有力氣站著聽他講話。' },
    { who: 'landlord', text: '妳怎麼沒去上班？' },
    { who: 'landlord', text: '現在年輕人齁，動不動就請假……' },
    { who: 'landlord', text: '我們以前齁，發燒也照樣去上班。' },
    { who: 'me', text: '剛好有點事情要辦，我先去忙了。' },
    { who: 'landlord', text: '去吧，看到我就想跑。' },
    { text: '被他說中了。我有點不好意思，只好點點頭。' },
    { who: 'landlord', text: '記得下禮拜要交房租。' },
    { who: 'me', text: '好，我記得。' },
  ],
  // 房間：窗戶下的水痕（小圖）→ 數錢（分鏡格）→ 開抽屜（分鏡格）→ 存簿（小圖）。原本點錢包、點抽屜的 CSS 動作改成分鏡格
  d1home: [
    { text: '房間很悶，我先把窗戶打開。', set: { place: 'home', prop: null, mini: null }, sfx: ['creakWindow'] },
    { text: '窗戶下面那塊水痕好像又比上個月大了一點。', set: { mini: 'stain' }, tap: 'mini' },
    { text: '跟房東講過幾遍，但後面就懶得講了。' },
    // 【分鏡｜待定】錢包攤開，鈔票和零錢倒在桌上，手機亮著。（螢幕不畫內容，面額不可辨識。）
    { who: 'me', text: '繳完房租，剩下五千塊錢。', set: { mini: 'sb-wallet' }, tap: 'mini' },
    { who: 'me', text: '要吃泡麵過日子了……', set: { mini: null } },
    { text: '包包裡還放著德叔那把咖啡館的鑰匙。' },
    { who: 'me', text: '雖然德叔有說我是咖啡館老闆，但應該是開玩笑的吧。' },
    { who: 'me', text: '哪有人會隨便找一個不認識的人當老闆。' },
    { who: 'me', text: '而且我連泡咖啡都不會。' },
    { who: 'me', text: '……先找看看印章還在嗎。哪天真的要辦離職手續，會用到。' },
    // 【分鏡｜待定】抽屜拉開，印章在最裡面，旁邊露出存簿一角。（格收掉時直接換成存簿小圖）
    { who: 'me', text: '印章還在。', set: { mini: 'sb-drawer' }, tap: 'mini' },
    { who: 'me', text: '這本是……爸幫我開的戶頭。', set: { mini: 'passbook' }, tap: 'mini' },
    { who: 'me', text: '裡面存了幾年的壓歲錢，現在只好拿出來用了。' },
    { text: '存簿只印了前面幾行，後面都是空的。' },
    { who: 'me', text: '先去補刷，看看還有多少。' },
  ],
  // 郵局外面的提款機（八月的下午）：刷存簿直排三格（一張圖，照台詞依序亮格；原本點存摺放進機器、CSS 一行一行印、CSS 存摺卡都拿掉）
  //   第 1 格進場景自動亮起（不佔點擊）→ 第 2 格跟「每一行都是一萬。」等三句 → 第 3 格跟「裡面居然有十六萬！」→ 吐一口氣那句收起
  d1bank: [
    { text: '每一行都是一萬。', set: { place: 'atm', prop: null, mini: 'sb-atm-2' }, panel: 'sb-atm-1', tap: 'panelAuto', sfx: ['copier'] },
    { text: '日期都在過年後，一年一筆，沒有斷過。', sfx: ['copier'] },
    { text: '我一直以為只有小時候那幾年。' },
    { who: 'me', text: '裡面居然有十六萬！', set: { mini: 'sb-atm-3' }, sfx: ['beep'] },
    { who: 'me', text: '爸從來沒跟我講過有這麼多。' },
    { who: 'me', text: '太好了，就算真的辭職，也不用急著馬上找工作了。' },
    { text: '我站在提款機前面，大大吐了一口氣。', set: { prop: null, mini: null } },
  ],
  // （畫面：提款機圖淡出到黑底。下面三句在黑底上出。）→ 淡入超商店內圖（進門音效）
  // 回家路上的超商（進去吹冷氣，順便買水）：店長罵店員 → 點座位區的徵人海報 → 停一拍 → 下決心
  d1store: [
    { text: '我離開提款機，往回家的方向走。', set: { place: 'black', prop: null, mini: null } }, // 【待定】
    { text: '外面很熱，走沒多久就一身汗。' }, // 【待定】
    { text: '前面有一間超商。進去吹個冷氣，順便買瓶水好了。' }, // 【待定】
    { text: '我才剛走進去，就聽到店裡有人講話很大聲。', set: { place: 'store' }, sfx: ['chime'] }, // 【待定】
    { who: 'storeManager', text: '這個昨天就過期了，你是沒在看喔？' },
    { who: 'storeManager', text: '客人拿到櫃檯才發現，你要我怎麼跟人家講？' },
    { who: 'storeManager', text: '講幾遍了，上架前先看日期，你到底有沒有在聽？' },
    { who: 'clerk', text: '對不起。' },
    { who: 'storeManager', text: '對不起有用的話，我還要請你來幹嘛？' },
    { text: '店員低著頭，手上還拿著那個過期的便當。' },
    { text: '後面排隊的人都在看手機，沒有人講話。' },
    // 點座位區的徵人海報 → 海報分鏡格（sb_store_poster_v3）疊上，點一下出這句；翻到下一句收掉（特寫只停一句）
    { who: 'me', text: '領這種餓不死、穿不暖的薪水，還要被這樣罵。', set: { mini: 'sb-poster' }, tap: ['poster', 'mini'] },
    { who: 'me', text: '光在旁邊聽，我的胃就縮起來了。', set: { mini: null } },
    { who: 'me', text: '就算辭職再找一份工作，大概還是這樣吧。' },
    { who: 'me', text: '再找一份，再被罵，再找一份……我真的要一直這樣下去嗎？' },
    { who: 'me', text: '……德叔如果是認真的呢？' },
    { who: 'me', text: '說不定真的能順利繼承。' },
    { who: 'me', text: '那就不用再聽別人指揮做事情了。' },
    { who: 'me', text: '可是我什麼都不懂，連咖啡都不會泡。' },
    { who: 'me', text: '……不會泡，可以學。' },
    { who: 'me', text: '有那十六萬，可以先撐一陣子。' },
    { who: 'me', text: '可是撐完了以後呢？' },
    { who: 'me', text: '從以前到現在，都是別人叫我做什麼，我就做什麼。' },
    { who: 'me', text: '現在要我自己拿主意，我還真的不知道要怎麼辦。' },
    { who: 'me', text: '……可是如果不去，我大概會一直想這件事。', tap: 'pause' },
    { who: 'me', text: '不然……先試試看好了。' },
    { who: 'me', text: '先當實習的老闆試試看，不適合再說。' },
    { who: 'me', text: '公司那邊，不管適不適合，我都不做了。' },
    { who: 'me', text: '明天先回去上班，把離職單送出去。再回來找德叔。' },
  ],

  /* ====================== （字卡：我單方面辭退老闆當天　16:49）→ 接回 16:49 的辦公室 ====================== */
  // 進字卡之前（超商最後一句之後）已自動存檔。接回場的字在 RESEND（DOM 畫面自己出，不走閱讀框）
  t0card: [],
  resend: [],

  /* ====================== （字卡：第二天）→ 第二天　回咖啡館 ====================== */
  // 字卡只顯示「第二天」；進字卡之前（接回場按「下班」）已自動存檔
  d2card: [],
  // 第二天，咖啡館：章名「第二天　回咖啡館」→ 點包包裡的鑰匙放到吧台上 → 實習老闆。不加人資訊息、濾掛包、銀杏龍眼、親寫鑰匙句
  d2cafe: [
    { text: '戶頭裡有十六萬，我才敢回來這裡。', set: { ...SHOP, ...SIDE, tone: 'morning', deshu: 'stand', cat: 'nap', cup: false, portrait: false, prop: null, mini: null }, sfx: ['bell'] },
    { text: '德叔在吧台後面擦杯子，今天吧台上是空的。', set: { ...COUNTER, cloth: true } },
    { who: 'me', text: '德叔，鑰匙我帶來了。', set: { cloth: false }, tap: 'keyBar' },
    { who: 'me', text: '我想再確認一次，真的沒有找錯人嗎？' },
    { who: 'me', text: '我不會泡咖啡，也沒有開過店。' },
    { who: 'deshu', text: '突然要讓妳當老闆，想必壓力很大吧。' },
    { who: 'deshu', text: '造成妳的困擾，我很抱歉阿。' },
    { who: 'deshu', text: '不過這件事情是肯定的，就是妳要來繼承這家咖啡館。' },
    { who: 'me', text: '那……我有一個想法。' },
    { who: 'me', text: '我想先當實習老闆。' },
    { who: 'me', text: '店裡怎麼顧、咖啡怎麼泡，我先把這兩樣學起來。' },
    { who: 'me', text: '如果做了之後覺得自己不適合，我就不繼承。' },
    { who: 'me', text: '這樣可以嗎？' },
    // （畫面：德叔露出微笑。）→ 微笑停一拍，淡出 → 字卡「三天後」（停之前先自動存檔）
    { who: 'deshu', text: '我相信妳一定可以的。', face: 'smile', linger: 1400 },
  ],

  /* ====================== （字卡：三天後）→ 三天後 ====================== */
  // 字卡只顯示「三天後」（【待定】標記不顯示）；進字卡之前已自動存檔
  d5card: [],
  // 三天後，咖啡館
  d5cafe: [
    { who: 'me', text: '德叔……我們這三天有幾位客人？', set: { ...SHOP, ...COUNTER, tone: 'morning', deshu: 'stand', cat: 'nap', cup: false, portrait: false, prop: null, mini: null } },
    { who: 'deshu', text: '如果包含找龍眼玩的貓客人，我們這三天總共來了三位客人。', face: 'smile' },
    { text: '這三天來過的客人，我都記得。', set: { ...SIDE } },
    { text: '一位是晚上來喝咖啡的阿伯，德叔叫他坤伯。' },
    { text: '一位是路過的客人，坐一下就走了。' },
    { text: '再來，就是跟著坤伯來的那隻花斑貓。' },
    { text: '兩個人，一隻貓。' },
    { who: 'me', text: '不行，再這樣下去這家店要倒了。', set: { ...COUNTER } },
    { text: '可是咖啡我還在學，開店我也不懂。' },
    { text: '我會的，好像只有以前當業務助理做的那些事。' },
    { text: '那時候東西賣不出去，都是先去問客人要什麼。' },
    { text: '……這裡也可以這樣問嗎？' },
    { text: '我也不知道有沒有用。' },
    { text: '……還是去問問看好了，問一下也不會怎樣。' },
    { who: 'me', text: '德叔，我去附近問問看，大家為什麼不來喝咖啡。' },
    { who: 'deshu', text: '妳等一下。' }, // 【待定】
    { text: '德叔走到門邊，拿了一樣東西回來。' }, // 【待定】
    // （德叔從門邊拿了一頂斗笠給我。）【小圖：斗笠】
    { who: 'deshu', text: '太陽很大，這頂妳戴著。', set: { mini: 'hat' }, tap: 'mini' },
  ],
  // 村子的路上（拿著筆記本，一戶一戶敲門）→ 花斑貓（可點，跟著走）→ 坤伯家的院子 → 點空罐子 →【小圖：空罐子的標籤】
  d5village: [
    { text: '問了幾戶，筆記本上還寫不到幾行。', set: { place: 'village', prop: null, mini: null, calico: null } },
    { who: 'me', text: '咦，妳不是來店裡的那隻嗎？', set: { calico: 'wall' }, sfx: ['hop'] },
    { text: '貓走進一戶人家的院子，院子旁邊種了好幾棵龍眼樹。', set: { place: 'kunyard', calico: 'yard' }, tap: 'calico' },
    { text: '坤伯蹲在院子裡，面前放著一個水桶。' },
    { who: 'me', text: '坤伯？原來這裡是坤伯家。' },
    { who: 'kunbo', text: '喔，咖啡店的小姐捏。' },
    { who: 'me', text: '坤伯在忙什麼？' },
    { who: 'kunbo', text: '在弄肥料啦，等一下要拿去澆龍眼樹。' },
    { text: '水桶旁邊有一個空罐子，還有一罐長得很像、還沒開的。' },
    { who: 'me', text: '坤伯，這上面寫的是農藥。', set: { mini: 'label' }, tap: ['can', 'mini'] },
    { who: 'kunbo', text: '蛤？' },
    // （畫面：坤伯把罐子拿過去，拿得很遠，瞇著眼睛看。）→ 肥料罐分鏡格先疊上，點一下出這句，翻到下一句收掉
    { who: 'me', text: '旁邊這罐才是肥料，還沒開。', set: { mini: 'sb-fertilizer', canTaken: true }, tap: 'mini' },
    { who: 'kunbo', text: '……我老花眼鏡放在屋裡啦。', set: { mini: null } },
    { who: 'kunbo', text: '兩罐長得一模一樣，誰分得出來。' },
    { who: 'kunbo', text: '這桶我本來就還沒有要用啊。' },
    { text: '他一邊講，一邊把那桶水提到牆角，離龍眼樹遠遠的。', set: { bucketMoved: true } },
  ],
  // 傍晚，咖啡館（承峰定稿）：先側場、推門進來（門與風鈴）→ 轉吧台跟德叔講話。斗笠還德叔、德叔倒水只用句子交代（不疊小圖、不開杯子熱點）
  d5return: [
    { text: '離開坤伯家以後，我又多走了幾戶。回到店裡的時候，太陽已經快下山了。', set: { ...SHOP, ...SIDE, tone: 'dusk', deshu: 'stand', cat: 'nap', cup: false, portrait: false, prop: null, mini: null } },
    { text: '我推開門，風鈴響了一下。', sfx: ['door', 'bell'] },
    { who: 'deshu', text: '回來了阿。', set: { ...COUNTER } },
    { text: '我把斗笠拿下來還他。' },
    { who: 'deshu', text: '有問到嗎？' },
    { who: 'me', text: '沒問到幾句。' },
    { who: 'me', text: '不過有遇到坤伯，在他家院子。' },
    { who: 'deshu', text: '喔，坤伯阿。' },
    { text: '我想到牆角那桶加了農藥的水，不知道他後來倒掉了沒有。' },
    { text: '我還沒往下講。' },
    { text: '德叔先倒了一杯水給我。' },
  ],
  // 傍晚，咖啡館：坤伯推門進來，手上提著一個袋子 →【小圖：龍眼乾】→ 銀杏龍眼咖啡
  d5thanks: [
    { who: 'kunbo', text: '這個給妳們啦，我自己焙的龍眼乾。', set: { ...SHOP, ...COUNTER, tone: 'dusk', deshu: 'stand', cat: 'nap', cup: false, portrait: false, prop: null, mini: null }, sfx: ['door', 'bell'] },
    { who: 'kunbo', text: '早上那個齁……不要跟別人講捏。' },
    { who: 'me', text: '好，我不會講。' },
    { who: 'kunbo', text: '啊不要站著，來，吃看看啦。' },
    // （坤伯把袋子打開，放在桌子中間。）
    { text: '袋子一打開，就有一股甜甜的、烤過的香味。', set: { ...SIDE }, sfx: ['pageBag'] },
    { text: '坤伯拿起一顆，拇指一壓，殼「喀」一聲就裂開了。', sfx: ['tickBowl'] },
    { who: 'kunbo', text: '來，這顆給妳。' },
    { text: '殼還有一點溫溫的。果肉黑黑亮亮，有點黏手。', set: { mini: 'longan' }, tap: 'mini' },
    { text: '咬下去軟軟的，很甜，甜完嘴巴裡還留著一點煙燻的香味。' },
    { who: 'me', text: '……好好吃喔。', set: { mini: null } },
    { who: 'me', text: '跟外面買的不一樣，有一個烤過的香味。' },
    { who: 'kunbo', text: '晚上還要顧火烘龍眼乾，怕睡著，才都來這裡喝咖啡。' },
    { who: 'kunbo', text: '人老了，眼睛不行，記性也不行啊。' },
    { who: 'kunbo', text: '德叔，你也吃啦，站在那邊幹嘛。', set: { ...COUNTER } },
    // （德叔拿了一顆，剝開，放進嘴裡，沒有講話。）（德叔又拿了一顆。）
    { who: 'kunbo', text: '啊是有好吃還是沒好吃？', sfx: ['tick'] },
    { who: 'deshu', text: '……有啦。' },
    { text: '花斑貓跳上椅子，用手去撥袋子裡的龍眼乾。', set: { ...SIDE }, sfx: ['hop'] },
    { text: '一顆龍眼乾滾到桌上，牠自己嚇了一跳。', sfx: ['tick'] },
    // 【分鏡｜待定】單格：貓爪還伸著，一顆龍眼乾滾在桌上。（立繪與音效照舊）
    { who: 'kunbo', text: '欸，這個不是給你吃的啦。', set: { mini: 'sb-calico' }, tap: 'mini' },
    // 入夜：傍晚圖交叉淡化到夜景定版圖（shop-still.js 的 fadesBetween），之後停在夜景、不疊天色（與 d5brew 開頭一致）
    { text: '外面天色慢慢暗下來。店裡很安靜，只有剝殼的聲音。', set: { night: 1, mini: null } },
    { text: '我又剝了一顆。', sfx: ['tickBowl'] },
    { text: '……這個味道，不知道跟咖啡搭不搭。' },
    { who: 'me', text: '德叔，我們可以出一款咖啡嗎？', set: { ...COUNTER } },
    { who: 'me', text: '用坤伯的龍眼乾，再加銀杏。' },
    { who: 'me', text: '人家不是說銀杏顧記性嗎？' },
    { who: 'me', text: '就叫銀杏龍眼咖啡。' },
    { who: 'deshu', text: '好阿，比例我來試試看。' },
    { who: 'me', text: '坤伯，下次來，這杯免費招待。' },
    { who: 'kunbo', text: '免費的喔？那我一定來捏。' },
  ],
  // 另一天晚上，吧台：排了好幾個杯子，坤伯坐在旁邊 → 試到好喝 → 紙袋上寫字 → 帶去公司
  //   開頭分鏡格（咖啡五杯，單格）：只亮一次就收起，才接德叔開口；承峰 2026-11-25 拿掉第 2 格，「越排越多」只靠文字，不再重開
  d5brew: [
    { who: 'deshu', text: '第一版好了，妳喝喝看。', set: { ...SHOP, ...COUNTER, tone: 'dusk', night: 1, deshu: 'brew', cat: 'nap', cup: false, portrait: false, prop: null, mini: null }, panel: 'sb-brew', tap: 'panel', sfx: ['thinPour'] },
    { text: '我喝了一口。', sfx: ['sip'] },
    { text: '很苦，後面還有一個怪味，我吞不太下去。' },
    // （畫面：她還沒開口，坤伯直接把杯子拿過去，整杯喝完。）
    { who: 'kunbo', text: '五告讚。', sfx: ['sip'] },
    { text: '話才講完，坤伯的手就按到肚子上。' }, // 【待定】
    { who: 'kunbo', text: '……歹勢，我先來走。' }, // 【待定】
    // （畫面：坤伯捂著肚子，推門出去了。）
    { text: '他走得很快，門都沒關好。', sfx: ['door', 'bell'] }, // 【待定】推門出去：門與風鈴
    { who: 'me', text: '德叔，這一杯其實……' },
    { who: 'deshu', text: '用了坤伯的龍眼乾加上我調配的比例，在這個村里敢說難喝，大概會被趕出村吧。' },
    { who: 'me', text: '……那我不敢說了。' },
    { who: 'deshu', text: '我再調調看阿。' },
    // （畫面：吧台上的杯子越排越多。）只靠文字，不亮分鏡（承峰 2026-11-25）
    { text: '試到後來那一杯，我整杯喝完了。', sfx: ['place', 'sip'] },
    { who: 'me', text: '德叔，這杯好喝。' },
    { text: '我看著空杯子。連我這種不懂咖啡的人，都想再喝一杯。', set: { ...SIDE } },
    { text: '可是沒有人來，就沒有人喝得到。' },
    { text: '我認識的人不多，最多的就是公司的同事。' },
    { text: '剛好，我還要回公司一趟。' },
    { who: 'me', text: '我回公司辦離職手續的時候，想帶這個去。', set: { ...COUNTER } },
    { who: 'me', text: '給同事喝喝看，說不定他們會想來店裡。' },
    { who: 'deshu', text: '好阿。包裝還沒設計，先用這個紙袋裝。' },
    // （畫面：德叔拿起筆，在測試品的紙袋上寫字。）
    { text: '「提神醒腦，過目不忘」', sfx: ['page'] },
    // 【分鏡｜待定】紙袋上寫好「提神醒腦」「過目不忘」，筆擱在旁邊。（字畫進圖；原本 CSS 紙袋特寫與程式疊字拿掉）
    { who: 'me', text: '好，我帶去公司。', set: { mini: 'sb-paperbag' }, tap: 'mini' },
  ],
};

// 店裡的幕（背景是店內 2D 定景，main.js 交給 openingShop）：第一句 set.place 是 'shop'
export const SHOP_STILL_ACTS = DAY_ACTS.filter((a) => DAY_LINES[a]?.[0]?.set?.place === 'shop');

// 這一句字出來之前要做的互動（照順序）
export const tapsOf = (b) => (b?.tap ? [].concat(b.tap) : []);
