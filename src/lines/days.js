// 第一天到研發咖啡的字：劇本 v5.6（docs/劇本.md 正文「# 第一天　最底下那個抽屜」起到「我：「好，我帶去公司。」」）。
// 開場（第一幕～第一晚）仍在 lines/opening.js；公司那場不在這裡（lines/company.js 不動）。
// 規則與開場相同：
// - 畫面上的對白、旁白、按鈕字、章名與劇本正文逐字相同。
// - 劇本裡全形括弧（……）的畫面／聲音／互動指示、【小圖：…】、【新增互動】都不是字，不放進 text；演出寫在每一句的 set／sfx／tap／optional。
// - 第一晚借住、隔天早上下山之後，不再演起床睡覺、不再睡護龍（沒有睡前自白、沒有 sleep）。
//
// 每一幕是一個存檔點（幕 id 是穩定的英文短名，加在 story/state.js 的 OPENING_ACTS 後面，只往前）。
// view：still＝整張背景圖的畫面（view/days.js）；shop＝店內 360（沿用開場的店面、德叔、龍眼）；card＝只有一張字卡（沒有句子）
// 每一句（beat）除了開場就有的 who／text／set／sfx／wait／gate／optional，另外有：
//   tap：這一句的字出來「之前」要先做的互動（字先不出來；做完才出這一句）。可以是一個或依序好幾個：
//     mini      小圖已經疊上來，玩家點一下才出句子（set.mini 決定是哪一張小圖）
//     pause     停一拍，玩家點一下才繼續
//     wallet    點桌上的錢包　　deskDrawer 點抽屜　　atm 點存摺放進提款機　　poster 點門邊的徵人海報
//     keyBar    點包包裡的鑰匙，放到吧台上　　calico 點花斑貓　　can 點地上的空罐子
//   face：德叔這一句用哪一張臉（smile＝char_deshu_smile）；只管這一句，不累加
//   set.mini：疊在原場景上的小圖（stain 水痕／passbook 存摺／hat 斗笠／label 空罐子的標籤／longan 龍眼乾）；null＝收掉
//   set.prop：特寫卡（printing 存摺一行一行印／passbook 存摺／poster 徵人海報／paperbag 測試品的紙袋）
// optional（可選，不做也能翻頁）：faucet 水龍頭、mailbox 信箱

// 說話的人（開場的德叔與我之外；名牌字）
export const DAY_SPEAKERS = {
  landlord: '房東', kunbo: '坤伯', storeManager: '店長', clerk: '店員',
};
// 對稿用：劇本裡的說話人寫法 → who
export const SCRIPT_SPEAKERS = {
  德叔: 'deshu', 我: 'me', 房東: 'landlord', 坤伯: 'kunbo', 店長: 'storeManager', 店員: 'clerk',
};

// 章名卡：第一天開頭用劇本標題原文（showDay 的 .op-card）
export const DAY_TITLES = {
  d1wake: '第一天　最底下那個抽屜',
};
// 只有一張字卡的幕（view: card）：「（字卡：第二天）」畫面只顯示「第二天」；「# 三天後」用劇本標題原文
export const DAY_CARDS = {
  d2card: '第二天',
  d5card: '三天後',
};

// 店內鏡頭：counter＝朝吧台；side＝朝靠窗那一側（桌子、龍眼）
const COUNTER = { yaw: 0 };
const SIDE = { yaw: 40 };

export const DAY_ACT_VIEW = {
  d1wake: 'still', d1shop: 'shop', d1town: 'still', d1home: 'still', d1bank: 'still', d1store: 'still',
  d2card: 'card', d2cafe: 'shop',
  d5card: 'card', d5cafe: 'shop', d5village: 'still', d5thanks: 'shop', d5brew: 'shop',
};
export const DAY_ACTS = Object.keys(DAY_ACT_VIEW);
// 跳關選單、回報用的幕名（劇本段落）
export const DAY_ACT_NAMES = {
  d1wake: '第一天・護龍早上、洗臉', d1shop: '第一天・店裡（德叔挽留）', d1town: '第一天・下山、信箱、房東',
  d1home: '第一天・房間、盤點', d1bank: '第一天・提款機', d1store: '第一天・超商',
  d2card: '字卡：第二天', d2cafe: '第二天・回咖啡館',
  d5card: '字卡：三天後', d5cafe: '三天後・咖啡館', d5village: '三天後・市調、坤伯院子', d5thanks: '三天後・坤伯來答謝', d5brew: '研發咖啡',
};

export const DAY_LINES = {
  /* ====================== 第一天　最底下那個抽屜 ====================== */
  // 護龍，早上（窗外有雞叫，遠處有機車發動的聲音）→ 洗臉（可點水龍頭）
  d1wake: [
    { text: '我是被雞叫醒的。', set: { place: 'roomMorning', prop: null, mini: null }, sfx: ['rooster'] },
    { text: '雖然臨時在外面過夜，但這是我這半年睡得最好的一次。', sfx: ['engineStart'] },
    { text: '手機還有百分之十一。充電器在租屋處，我昨天出門的時候沒想過會在外面過夜。' },
    { text: '鼻梁和臉頰上的雀斑還是一樣多，從國中照鏡子發現後，就沒消退過。', set: { place: 'basin' }, optional: 'faucet' },
    { text: '黑眼圈好明顯，也是去年的某天發現後，就一直掛在上面。' },
    { text: '衣服是昨天那套。我聞了一下袖口，還好。' },
  ],
  // 咖啡店內（早上，沿用開場）：吧台上攤著兩個竹篩，德叔挑豆（豆子一顆一顆丟進鐵碗）；挽留（A 案）
  d1shop: [
    { text: '德叔站在吧台後面挑豆，壞的丟鐵碗，頭沒抬。', set: { ...COUNTER, tone: 'morning', deshu: 'brew', cat: 'nap', cup: false, portrait: false }, sfx: ['tick'] },
    { who: 'me', text: '德叔早。' },
    { who: 'deshu', text: '早。' },
    { who: 'deshu', text: '昨天睡得好嗎？' },
    { who: 'me', text: '謝謝，睡得不錯。昨天不好意思，還住了一晚。我先回去了。' },
    { text: '我從口袋拿出鑰匙，遞過去。', sfx: ['keys'] },
    { text: '德叔看了一眼鑰匙，沒有伸手。' },
    { who: 'deshu', text: '這麼快就決定了阿？' },
    { who: 'deshu', text: '要不要再考慮幾天？回來這裡喝幾杯咖啡，喝完再決定也不會太慢阿。' },
    { who: 'deshu', text: '這裡隨時都歡迎妳。' },
    { text: '他兩隻手都是豆子的銀皮。吧台上也沒有一塊空的地方。', sfx: ['tick'] },
    { text: '我拿著鑰匙站了一下。' },
    { who: 'me', text: '那我……下次再來。' },
    { who: 'deshu', text: '鄉下的路碎石比較多，妳回去小心騎車阿。' },
    { text: '我把鑰匙放回口袋。', sfx: ['keys'] },
  ],
  // 下山的路（接省道，進市區）→ 租屋處信箱（可點）→ 樓梯間：房東
  d1town: [
    { text: '下山到市區一個多小時。等了幾個紅燈，進市區以後外套穿不住，我停在路邊脫掉塞進車廂。', set: { place: 'road', prop: null, mini: null }, sfx: ['engineStart'] },
    { text: '信箱是空的，連傳單都沒有。', set: { place: 'mailbox' }, optional: 'mailbox' },
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
  // 房間：窗戶下的水痕（小圖）→ 點錢包 → 點抽屜 → 存摺（小圖）
  d1home: [
    { text: '房間很悶，我先把窗戶打開。', set: { place: 'home', prop: null, mini: null }, sfx: ['creak'] },
    { text: '窗戶下面那塊水痕好像又比上個月大了一點。', set: { mini: 'stain' }, tap: 'mini' },
    { text: '跟房東講過幾遍，但後面就懶得講了。' },
    { who: 'me', text: '繳完房租，剩下五千塊錢。', set: { mini: null }, tap: 'wallet' },
    { who: 'me', text: '要吃泡麵過日子了……' },
    { text: '包包裡還放著德叔那把咖啡館的鑰匙。' },
    { who: 'me', text: '雖然德叔有說我是咖啡館老闆，但應該是開玩笑的吧。' },
    { who: 'me', text: '哪有人會隨便找一個不認識的人當老闆。' },
    { who: 'me', text: '而且我連泡咖啡都不會。' },
    { who: 'me', text: '對了，先找看看印章還在嗎，辦離職手續的時候會用到。' },
    { who: 'me', text: '印章還在。', tap: 'deskDrawer' },
    { who: 'me', text: '這本是……爸幫我開的戶頭。', set: { mini: 'passbook' }, tap: 'mini' },
    { who: 'me', text: '裡面存了幾年的壓歲錢，現在只好拿出來用了。' },
    { text: '存摺只印了前面幾行，後面都是空的。' },
    { who: 'me', text: '先去補刷，看看還有多少。' },
  ],
  // 銀行外面的提款機（八月的下午）：點存摺放進機器 → 一行一行印 → 存摺退出來
  d1bank: [
    { text: '每一行都是一萬。', set: { place: 'atm', prop: 'printing', mini: null }, tap: 'atm', sfx: ['copier'] },
    { text: '日期都在過年後，一年一筆，沒有斷過。', sfx: ['copier'] },
    { text: '我一直以為只有小時候那幾年。' },
    { who: 'me', text: '裡面居然有十六萬！', set: { prop: 'passbook' }, sfx: ['beep'] },
    { who: 'me', text: '爸從來沒跟我講過有這麼多。' },
    { who: 'me', text: '太好了，不用急著馬上找工作了。' },
    { text: '我站在提款機前面，大大吐了一口氣。', set: { prop: null } },
  ],
  // 回家路上的超商（進去吹冷氣，順便買水）：店長罵店員 → 點門邊的徵人海報 → 停一拍 → 下決心
  d1store: [
    { who: 'storeManager', text: '這個昨天就過期了，你是沒在看喔？', set: { place: 'store', prop: null, mini: null }, sfx: ['ding'] },
    { who: 'storeManager', text: '客人拿到櫃檯才發現，你要我怎麼跟人家講？' },
    { who: 'storeManager', text: '講幾遍了，上架前先看日期，你到底有沒有在聽？' },
    { who: 'clerk', text: '對不起。' },
    { who: 'storeManager', text: '對不起有用的話，我還要請你來幹嘛？' },
    { text: '店員低著頭，手上還拿著那個過期的便當。' },
    { text: '後面排隊的人都在看手機，沒有人講話。' },
    { who: 'me', text: '領這種餓不死、穿不暖的薪水，還要被這樣罵。', set: { prop: 'poster' }, tap: 'poster' },
    { who: 'me', text: '光在旁邊聽，我的胃就縮起來了。', set: { prop: null } },
    { who: 'me', text: '就算再找一份工作，大概還是這樣吧。' },
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
    { who: 'me', text: '明天就回去找德叔吧。' },
  ],

  /* ====================== （字卡：第二天）→ 第二天　回咖啡館 ====================== */
  d2card: [],
  d2cafe: [
    { text: '戶頭裡有十六萬，我才敢回來這裡。', set: { ...SIDE, tone: 'morning', deshu: 'stand', cat: 'nap', cup: false, portrait: false, prop: null, mini: null }, sfx: ['bell'] },
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
    { who: 'deshu', text: '我相信妳一定可以的。', face: 'smile' },
  ],

  /* ====================== 三天後 ====================== */
  d5card: [],
  // 三天後，咖啡館
  d5cafe: [
    { who: 'me', text: '德叔……我們這三天有幾位客人？', set: { ...COUNTER, tone: 'morning', deshu: 'stand', cat: 'nap', cup: false, portrait: false, prop: null, mini: null } },
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
    // （德叔從門邊拿了一頂斗笠給我。）【小圖：斗笠】
    { who: 'deshu', text: '好阿。太陽很大，這頂妳戴著。', set: { mini: 'hat' }, tap: 'mini' },
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
    // （畫面：坤伯把罐子拿過去，拿得很遠，瞇著眼睛看。）
    { who: 'me', text: '旁邊這罐才是肥料，還沒開。', set: { mini: null, canTaken: true } },
    { who: 'kunbo', text: '……我老花眼鏡放在屋裡啦。' },
    { who: 'kunbo', text: '兩罐長得一模一樣，誰分得出來。' },
    { who: 'kunbo', text: '這桶我本來就還沒有要用啊。' },
    { text: '他一邊講，一邊把那桶水提到牆角，離龍眼樹遠遠的。', set: { bucketMoved: true } },
  ],
  // 傍晚，咖啡館：坤伯推門進來，手上提著一個袋子 →【小圖：龍眼乾】→ 銀杏龍眼咖啡
  d5thanks: [
    { who: 'kunbo', text: '這個給妳們啦，我自己焙的龍眼乾。', set: { ...COUNTER, tone: 'dusk', deshu: 'stand', cat: 'nap', cup: false, portrait: false, prop: null, mini: null }, sfx: ['door', 'bell'] },
    { who: 'kunbo', text: '早上那個齁……不要跟別人講捏。' },
    { who: 'me', text: '好，我不會講。' },
    { who: 'kunbo', text: '啊不要站著，來，吃看看啦。' },
    // （坤伯把袋子打開，放在桌子中間。）
    { text: '袋子一打開，就有一股甜甜的、烤過的香味。', set: { ...SIDE }, sfx: ['page'] },
    { text: '坤伯拿起一顆，拇指一壓，殼「喀」一聲就裂開了。', sfx: ['tick'] },
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
    { who: 'kunbo', text: '欸，這個不是給你吃的啦。' },
    { text: '外面天色慢慢暗下來。店裡很安靜，只有剝殼的聲音。', set: { night: 0.6 } },
    { text: '我又剝了一顆。', sfx: ['tick'] },
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
  d5brew: [
    { who: 'deshu', text: '第一版好了，妳喝喝看。', set: { ...COUNTER, tone: 'dusk', night: 1, deshu: 'brew', cat: 'nap', cup: false, portrait: false, prop: null, mini: null }, sfx: ['thinPour'] },
    { text: '我喝了一口。', sfx: ['sip'] },
    { text: '很苦，後面還有一個怪味，我吞不太下去。' },
    // （畫面：她還沒開口，坤伯直接把杯子拿過去，整杯喝完。）
    { who: 'kunbo', text: '五告讚。', sfx: ['sip'] },
    // （畫面：坤伯捂著肚子，推門出去了。）
    { who: 'me', text: '德叔，這一杯其實……', sfx: ['door', 'bell'] },
    { who: 'deshu', text: '用了坤伯的龍眼乾加上我調配的比例，在這個村里敢說難喝，大概會被趕出村吧。' },
    { who: 'me', text: '……那我不敢說了。' },
    { who: 'deshu', text: '我再調調看阿。' },
    // （畫面：吧台上的杯子越排越多。）
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
    { text: '「提神醒腦，過目不忘」', set: { prop: 'paperbag' }, sfx: ['page'] },
    { who: 'me', text: '好，我帶去公司。' },
  ],
};

// 這一句字出來之前要做的互動（照順序）
export const tapsOf = (b) => (b?.tap ? [].concat(b.tap) : []);
