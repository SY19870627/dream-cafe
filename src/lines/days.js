// 第一天到第四天的字：劇本 v4.4（作者 2026-11-14 13:58 核准接進遊戲）。開場（第一幕～第一晚）仍在 lines/opening.js。
// 規則與開場相同：
// - 畫面上的對白、旁白、按鈕字與劇本逐字相同；句首的【待定】【待確認】【新增互動】是稿件標記，這裡已拿掉，只留正文。
// - 劇本裡全形括弧（……）的畫面／聲音／互動指示不是字，不放進 text；演出寫在每一句的 set／sfx／gate／optional。
// - 作者親寫句一字不改（例：德叔「看妳的氣色變好，最近是不是遇到甚麼好事了。」用「甚麼」）。
//
// 每一幕是一個存檔點（幕 id 是穩定的英文短名，加在 story/state.js 的 OPENING_ACTS 後面，只往前）。
// view：still＝整張背景圖的畫面（view/days.js）；shop＝店內 360（沿用開場的店面、德叔、龍眼）
// 每一句（beat）除了開場就有的 who／text／set／sfx／wait／gate／optional，另外有：
//   mono：這一句屬於「本段自白」（睡前自白；自白期間會出現「跳過自白」）
//   sleep：自白最後一句（睡著）；這一句一出現就自動存檔成「隔天早上」（第四天則是待續）
//   film：相機計數窗至少到第幾張（快到底了 35、扳不動了 36；中間拍幾張由玩家決定）
//   branch：第一天晚上的存摺選擇（show 把存摺放上吧台／keep 收著）；只播選到的那一支
// gate（關卡，做完才能往下）：passbook 存摺拖到櫃檯、badge 識別證放到櫃檯、tape 撕膠帶三次、rewind 倒片、choice 存摺兩個按鈕
// optional（可選，不做也能翻頁）：faucet 水龍頭、keyGive 鑰匙遞給德叔、mailbox 信箱、drawer 最底下的抽屜、clothes 撥開衣服、
//   cup 杯子、switch 電燈開關、gateCard 識別證刷閘門、reply 輸入框、report 報告、stroke 從頭順到尾巴、lever 過片扳手、shutter 快門、focus 對焦環

// 說話的人（開場只有德叔與我；名牌字）
export const DAY_SPEAKERS = {
  teller: '行員', guard: '保全', yizhen: '宜蓁', manager: '經理', vp: '副總', director: '協理', agui: '阿桂',
  msg: '宜蓁', // 宜蓁（訊息）：手機訊息，名牌仍寫宜蓁，字用訊息框
  note: '便條', // 便條（畫面文字）：原子筆字的便條
};
// 對稿用：劇本裡的說話人寫法 → who
export const SCRIPT_SPEAKERS = {
  德叔: 'deshu', 我: 'me', 行員: 'teller', 保全: 'guard', 宜蓁: 'yizhen', 經理: 'manager', 副總: 'vp', 協理: 'director', 阿桂: 'agui',
  '宜蓁（訊息）': 'msg', '便條（畫面文字）': 'note',
};

// 每天開頭的章名卡（劇本標題，去標記）
export const DAY_TITLES = {
  d1wake: '第一天　最底下那個抽屜',
  d2wake: '第二天　洗把臉',
  d3wake: '第三天　第十二頁',
  d4wake: '第四天　還剩十七張',
};

// 第一天晚上的兩個按鈕（兩邊都會進到第 1 杯）
export const PASSBOOK_CHOICES = [
  { id: 'show', text: '把存摺放上吧台' },
  { id: 'keep', text: '收著' },
];

// 店內鏡頭：counter＝朝吧台；side＝朝靠窗那一側（桌上的杯子、龍眼）
const COUNTER = { yaw: 0 };
const SIDE = { yaw: 40 };

export const DAY_ACT_VIEW = {
  d1wake: 'still', d1shop: 'shop', d1town: 'still', d1cafe: 'shop', d1night: 'still',
  d2wake: 'still', d2shop: 'shop', d2town: 'still', d2cafe: 'shop', d2night: 'still',
  d3wake: 'still', d3shop: 'shop', d3town: 'still', d3cafe: 'shop', d3night: 'still',
  d4wake: 'still', d4shop: 'shop', d4town: 'still', d4cafe: 'shop', d4night: 'still',
};
export const DAY_ACTS = Object.keys(DAY_ACT_VIEW);

export const DAY_LINES = {
  /* ====================== 第一天　最底下那個抽屜 ====================== */
  // 護龍，早上 → 洗手台
  d1wake: [
    { text: '我是被雞叫醒的。', set: { place: 'roomMorning', prop: null } },
    { text: '手機還有百分之十一。充電器在租屋處，我昨天出門的時候沒想過會在外面過夜。' },
    { text: '水很冰。我洗完抬頭，鏡子邊緣的水銀掉了一圈，中間照得到人。', set: { place: 'basin' }, optional: 'faucet' },
    { text: '下巴那顆按下去還會痛，還沒熟。我的手放開了。' },
    { text: '黑眼圈就那樣，從去年看到今年。' },
    { text: '衣服是昨天那套。我聞了一下袖口，還好。' },
  ],
  // 咖啡店內（早上）：德叔挑豆，鑰匙還不出去
  d1shop: [
    { text: '我昨天喝的那個杯子洗好了，放在我坐過的那張桌上，把手朝右。', set: { ...SIDE, tone: 'morning', deshu: 'brew', cat: 'nap', cup: true, portrait: false } },
    { text: '我走過去看。杯底是乾的。' },
    { text: '德叔站在吧台後面挑豆，壞的丟鐵碗，頭沒抬。', set: { ...COUNTER }, sfx: ['tick'] },
    { who: 'me', text: '德叔早。' },
    { who: 'deshu', text: '早。' },
    { who: 'me', text: '昨天不好意思，還住了一晚。我先回去了。' },
    { who: 'deshu', text: '嗯。' },
    { text: '我從口袋拿出鑰匙，遞過去。', optional: 'keyGive' },
    { who: 'deshu', text: '手髒。' },
    { text: '他兩隻手都是豆子的銀皮。吧台上也沒有一塊空的地方。' },
    { text: '我拿著鑰匙站了一下。' },
    { who: 'me', text: '那我……下次拿來。' },
    { who: 'deshu', text: '下坡有砂，騎慢點。' },
    { text: '我把鑰匙放回口袋。' },
  ],
  // 下山 → 租屋處信箱 → 房間 → 銀行 → 房間（傍晚）→ 上山回店門口
  d1town: [
    { text: '下山到市區一個多小時。等了幾個紅燈，進市區以後外套穿不住，我停在路邊脫掉塞進車廂。', set: { place: 'road', prop: null } },
    { text: '信箱是空的，連傳單都沒有。', set: { place: 'mailbox' }, optional: 'mailbox' },
    { text: '我把手機插上充電，坐在床邊等它亮。', set: { place: 'home' } },
    { text: '要換衣服。常穿的那幾件都在洗衣籃裡，最上面那件是上禮拜二的。' },
    { text: '衣櫃吊的那排只剩面試穿的襯衫。', optional: 'drawer' },
    { text: '最底下那個抽屜放換季的衣服。我一年多沒開了，拉到一半卡住，要用膝蓋頂著才出得來。' },
    { text: '有樟腦丸的味道。兩件高領，一條圍巾，一件大學系服。', optional: 'clothes' },
    { text: '系服下面壓著一個資料袋。拉鍊那種，塑膠已經霧了，我用手抹過去，留下一道指印。', set: { prop: 'bag' } },
    { text: '封面貼了一張標籤，是我的字：「重要　不要丟」。' },
    { text: '字比現在寫的圓。我現在簽名都用撇的。' },
    { text: '存摺的銀行我現在沒在用。薪水早就換到另一家了。', set: { prop: 'passbook' } },
    { text: '最後一行是好幾年前，後面整本空白。' },
    { text: '印章盒裡的印泥乾成一塊，印章還在，刻的是陳怡君。' },
    { text: '我想了很久。只想起櫃檯小姐說過一句「放著不會少」，還有那天我趕著回去上班。', set: { prop: null } },
    { text: '銀行三點半關。我換上那件有樟腦丸味的高領，太熱，又脫掉，穿了面試的襯衫出門。' },
    { text: '我拿皮夾抽身分證。識別證卡在後面那格，跟著滑出來一半，我把它推回去。', set: { place: 'bank' }, sfx: ['ding'] },
    { who: 'teller', text: '陳小姐，這本很久沒補了，我幫妳刷一下。', gate: 'passbook' },
    { text: '機器一直印，換頁了還在印。', set: { prop: 'printing' } },
    { who: 'teller', text: '妳這筆定存到期都有自動續存，利息滾進去。要繼續放，還是今天解？', set: { prop: null } },
    { who: 'me', text: '……這是我的？' },
    { text: '行員看了一眼螢幕，又看我的身分證。' },
    { who: 'teller', text: '開戶人陳怡君，印鑑也對。妳自己開的。' },
    { text: '她把存摺轉過來推給我。開戶日期是我第一份工作那年的八月。', set: { prop: 'passbook' } },
    { text: '我看最後一行的數字，在心裡除以房租。除了兩次，怕算錯。' },
    { text: '夠我好一陣子不用開人力銀行的 App。' },
    { who: 'teller', text: '陳小姐？', set: { prop: null } },
    { who: 'me', text: '先放著。活存那邊的我領一點。' },
    { text: '我簽名的時候手是穩的。走到門口才發現號碼牌還捏在手裡，捏爛了。' },
    { text: '我坐在床邊把存摺又翻了一遍。裡面每一筆的日期，我都在上班。', set: { place: 'homeDusk' } },
    { text: '外套口袋裡的鑰匙硌到大腿。' },
    { text: '鑰匙還沒還。' },
    { text: '我拿了背包，塞了三天份的衣服、充電器、牙刷。塞完覺得三天太多，也沒拿出來。' },
    { text: '資料袋我放在最上面。' },
    { text: '我推門的時候，水已經在爐子上了。', set: { place: 'shopDusk' }, sfx: ['boil'] },
  ],
  // 咖啡店內（晚上）：存摺放不放上吧台 → 第 1 杯
  d1cafe: [
    { text: '吧台上的竹篩收走了。德叔在擦濾杯，看了我的背包一眼，沒說什麼。', set: { ...COUNTER, tone: 'dusk', deshu: 'stand', cat: 'nap', cup: false, cloth: true, portrait: false } },
    { text: '龍眼趴在我對面那張椅子上。', set: { ...SIDE, cloth: false } },
    { text: '我彎下去，手放在他頭上，順著背往下，摸到尾巴尖才放開。' },
    { text: '他沒睜眼，尾巴勾了一下我的手腕。' },
    { text: '我坐下，手伸進背包，摸到存摺的硬角。', gate: 'choice' },
    // 〔把存摺放上吧台〕
    { text: '我把存摺拿出來，放在吧台上。', branch: 'show', set: { ...COUNTER } },
    { who: 'me', text: '我今天在抽屜裡翻到這個。我自己的，我完全忘了。', branch: 'show' },
    { text: '德叔看了封面，把抹布移開，離存摺遠一點。', branch: 'show' },
    { who: 'deshu', text: '收好，等一下有水。', branch: 'show' },
    { text: '我等他問，他只是去拿杯子。', branch: 'show' },
    // 〔收著〕
    { text: '我的手在背包裡停了一下，把拉鍊拉上。', branch: 'keep' },
    { who: 'me', text: '今天回去拿了一點東西。', branch: 'keep', set: { ...COUNTER } },
    { who: 'deshu', text: '嗯。', branch: 'keep' },
    { text: '他去拿杯子。', branch: 'keep' },
    // 合流：德叔沖咖啡（水柱落在粉上）
    { text: '是早上那個杯子。他放下來的時候，把手朝右。', set: { ...SIDE, deshu: 'brew', cup: true }, sfx: ['thinPour'], wait: 1400 },
    { text: '我把鑰匙掏出來，放在杯子旁邊。', sfx: ['keys'] },
    { who: 'me', text: '早上沒還到。' },
    { text: '德叔看了鑰匙，又看了我的背包。', set: { ...COUNTER, deshu: 'stand' } },
    { who: 'deshu', text: '被子下午曬過。' },
    { text: '他回去洗濾杯了。鑰匙沒有人拿。', set: { ...SIDE }, sfx: ['rinse'], optional: 'cup' },
    { text: '我喝了。比昨天那杯酸一點，吞下去喉嚨是暖的。' },
    { text: '喝到剩一口，我才發現自己一整天只吃了一個御飯糰。' },
    { text: '德叔從後面端了一碗麵出來放在我旁邊，加了蛋。他自己那碗已經吃完了，碗在水槽。', set: { deshu: 'serveTable' }, sfx: ['place'] },
  ],
  // 護龍，夜 → 睡前自白
  d1night: [
    { text: '被子有曬過的味道。', set: { place: 'roomNight', prop: null } },
    { text: '我把鑰匙放在枕頭旁邊，手機插上充電，螢幕亮了一下。', set: { key: true } },
    { text: '那本存摺在最底下的抽屜放了這麼多年，我連裡面有多少錢都忘了。', set: { place: 'bed' }, mono: true },
    { text: '銀行補完摺，我才知道那筆定存一直自己在續存，夠我好一陣子不用急著找工作。', mono: true },
    { text: '鑰匙我早上要還給德叔，他沒接，現在它又在我的枕頭旁邊。', mono: true },
    { text: '明天我還要不要再還他一次？', mono: true },
    { text: '下巴那顆壓到枕頭還是會痛，我翻到另一邊睡。', mono: true, sleep: true },
  ],

  /* ====================== 第二天　洗把臉 ====================== */
  d2wake: [
    { text: '我洗完臉抬頭，拿毛巾的手停在半空。', set: { place: 'basin', prop: null }, optional: 'faucet' },
    { text: '下巴是平的。' },
    { text: '我用手指按昨天那個位置。不痛，也沒有疤，連摸起來硬硬的那一塊都沒有。' },
    { text: '我湊近鏡子，把額前的頭髮撥開。那兩顆小的也沒了。', optional: 'switch' },
    { text: '我開了燈再看。眼睛下面那兩塊，從去年跟到現在的，不見了。', set: { light: true } },
    { text: '我昨天十二點多才睡，被子再好睡也沒有這種事。' },
    { text: '我對著鏡子做了個鬼臉，鏡子裡的人也做了。' },
  ],
  // 咖啡店內（早上）：水在燒，德叔在磨豆
  d2shop: [
    { who: 'me', text: '德叔早。', set: { ...COUNTER, tone: 'morning', deshu: 'brew', cat: 'nap', cup: false, portrait: false }, sfx: ['grind'] },
    { text: '德叔抬頭，手上的磨豆機慢下來。' },
    { who: 'deshu', text: '看妳的氣色變好，最近是不是遇到甚麼好事了。' },
    { who: 'me', text: '……有嗎。' },
    { text: '我摸了一下下巴。' },
    { text: '他把磨好的粉倒出來，敲了兩下。', sfx: ['tick'] },
    { who: 'deshu', text: '這點跟老老闆很像。喝完咖啡，隔天就像變一個人一樣。' },
    { text: '龍眼剛好跳上吧台，尾巴掃過我的手背。我伸手去擋他屁股後面那個杯子。', set: { cat: 'bar' }, sfx: ['hop'] },
    { who: 'me', text: '老老闆也這樣？' },
    { who: 'deshu', text: '水開了。', sfx: ['boil'] },
    { text: '他轉過去關火。我等了一下，他沒有回來接這個話。' },
    { text: '我把那個杯子往裡面推了一點。他問的好事，我還沒想到要怎麼答。' },
    { text: '我拿皮夾要去買早餐。識別證又從身分證後面滑出來。', set: { prop: 'badge' } },
    { text: '照片是進公司第一年拍的。那時候還沒有黑眼圈，後來就有了，到今天早上為止。' },
    { text: '這張早就該還了。最後一天我抱著紙箱，沒有人跟我要。' },
    { who: 'me', text: '我下山一趟，傍晚回來。', set: { prop: null } },
    { who: 'deshu', text: '嗯。' },
  ],
  // 辦公大樓一樓大廳（閘門、櫃檯、訪客沙發；遠景沙發上的老太太）→ 上山回店門口
  d2town: [
    { text: '我習慣性地刷了。紅燈。', set: { place: 'lobby', prop: null }, optional: 'gateCard' },
    { who: 'guard', text: '小姐，這張停了喔。找哪位？' },
    { who: 'me', text: '我來還這張，交給櫃檯可以嗎？' },
    { who: 'guard', text: '這個要你們公司的人收。我打上去。' },
    { text: '我站在櫃檯旁邊等。電梯那邊出來一批拿便當的人，我一個都不認識。' },
    { text: '宜蓁出來的時候還在看手機，走到我面前才抬頭。', sfx: ['ding'] },
    { text: '她愣住了。' },
    { who: 'yizhen', text: '……怡君？' },
    { who: 'me', text: '嗨。' },
    { who: 'yizhen', text: '妳去做了什麼？' },
    { who: 'me', text: '沒有啊。' },
    { who: 'yizhen', text: '真的假的。妳下巴這裡，」她比自己的下巴，「以前不是每個月都一顆？' },
    { who: 'me', text: '就……有睡覺。' },
    { who: 'yizhen', text: '我也有睡啊。' },
    { text: '她盯著我的臉又看了幾秒，想找粉底的邊界，沒找到。' },
    { who: 'yizhen', text: '好啦，妳氣色真的差很多。我剛剛在電梯口還沒認出來。' },
    { text: '經理從電梯出來，手上拿著車鑰匙。他先看到宜蓁，然後看到我，腳步頓了一下。', sfx: ['ding'] },
    { who: 'manager', text: '喔，怡君。回來看大家喔？氣色不錯嘛。那時候妳單子送得那麼突然，我本來還想找妳……' },
    { text: '他的手機響了。', sfx: ['buzz'] },
    { who: 'manager', text: '喂，是，我在樓下了。' },
    { text: '他對我點了一下頭，邊講邊往大門走，話就停在那裡。' },
    { text: '宜蓁看他出去，肩膀放下來。' },
    { who: 'yizhen', text: '妳走了以後週報都我在弄。妳那個會自己抓數字的表，我打開全部是井字號。今天又要交，我大概又要到九點。' },
    { text: '她看著我。' },
    { text: '我以前會說「我看一下」，然後看到十點。' },
    { who: 'me', text: '檔案在共用槽我的資料夾，第一個分頁有寫怎麼改路徑。' },
    { who: 'yizhen', text: '妳不能上來幫我……' },
    { who: 'me', text: '我還要騎回去，很遠。', gate: 'badge' },
    { text: '我把識別證放在櫃檯上，推到她那邊。' },
    { who: 'me', text: '這個麻煩妳。' },
    { who: 'yizhen', text: '妳現在在哪上班？' },
    { who: 'me', text: '還沒。' },
    { who: 'yizhen', text: '還沒上班，臉長這樣？' },
    { text: '我笑出來。她也笑了，笑完又嘆氣，拿著識別證回電梯。' },
    { text: '我走出大門，在騎樓底下站了一下。玻璃上有我的影子，我多看了一眼才去牽車。' },
    { text: '推門的時候壺嘴已經在冒白煙。', set: { place: 'shopDusk' }, sfx: ['boil'] },
  ],
  // 咖啡店內（傍晚）：第 2 杯、公司總機打來
  d2cafe: [
    { text: '龍眼坐在門邊的地墊上，看我的鞋。', set: { ...SIDE, tone: 'dusk', deshu: 'stand', cat: 'mat', cup: false, portrait: false } },
    { text: '我蹲下來，從他的頭摸到尾巴，摸了一趟。', sfx: ['purr'] },
    { text: '他站起來，走在我前面。', set: { cat: 'doorway' } },
    { text: '德叔沒問我去哪。他把杯子放在老位置，把手朝右。', set: { cat: 'nap', cup: true }, sfx: ['place'] },
    { text: '我過去坐下。', optional: 'cup' },
    { text: '第二杯我喝得比較慢。' },
    { who: 'me', text: '德叔，今天有人說認不出我。', set: { ...COUNTER } },
    { who: 'deshu', text: '嗯。' },
    { text: '他擦著吧台，擦到我這邊，繞過我的杯子。', set: { cloth: true } },
    { text: '手機在吧台上震。市話，區碼是市區的，後四碼我背得出來，是公司總機。', set: { cloth: false }, sfx: ['buzz'] },
    { text: '我看著它震完，沒接。' },
    { text: '過了一分鐘又震一次。', sfx: ['buzz'] },
    { text: '我把手機翻過去蓋著，把剩下的喝完。', set: { ...SIDE } },
  ],
  // 護龍，夜：睡前自白（一開始就躺著）
  d2night: [
    { text: '我又摸了一次下巴，還是平的。', set: { place: 'bed', prop: null }, mono: true },
    { text: '下巴和額頭的痘，早上洗臉的時候就不見了，連跟了我好幾年的黑眼圈也沒了。', mono: true },
    { text: '宜蓁一直盯著我的臉看，我沒辦法跟她解釋，因為我自己也不知道是怎麼回事。', mono: true },
    { text: '德叔說老老闆喝完咖啡，隔天就像變了一個人，他講到這裡就說水開了，後面沒有再講。', mono: true },
    { text: '明天我要趁水還沒開的時候問他。', mono: true },
    { text: '我把手機翻過去蓋在床上，沒多久就睡著了。', mono: true, sleep: true },
  ],

  /* ====================== 第三天　第十二頁 ====================== */
  d3wake: [
    { text: '鏡子裡還是昨天那張臉。我還是按了一下下巴。', set: { place: 'basin', prop: null } },
    { text: '宜蓁傳了四則。', set: { place: 'roomMorning', prop: 'phone' }, sfx: ['buzz'] },
    { who: 'msg', text: '妳電話都不接' },
    { who: 'msg', text: '去年那個連鎖門市的案子，客戶今天下午要來' },
    { who: 'msg', text: '他們說要找陳小姐本人，副總叫我一定要找到妳' },
    { who: 'msg', text: '拜託，兩點' },
    { text: '那個案子我做了三個月，交出去以後就沒有再看過。', optional: 'reply' },
    { text: '我回她：「我兩點到。」', set: { replied: true } },
  ],
  d3shop: [
    { who: 'me', text: '德叔，我今天又要下山。', set: { ...COUNTER, tone: 'morning', deshu: 'brew', cat: 'nap', cup: false, portrait: false, prop: null }, sfx: ['boil'] },
    { who: 'deshu', text: '吃過再走。' },
    { text: '桌上有一盤煎蛋，兩片吐司，放在我的位置。', set: { ...SIDE } },
  ],
  // 辦公大樓大廳（換訪客證）→ 會議室（玻璃牆，對街長椅上的老太太）→ 電梯口 → 大廳 → 超商門口
  d3town: [
    { text: '保全收了我的身分證，給我一張掛繩的訪客證。繩子是新的，比以前那條好戴。', set: { place: 'lobby', prop: null } },
    { text: '會議室裡坐著副總、經理，還有客戶那邊兩個人。年紀大的那位我見過，是他們的營運協理。', set: { place: 'meeting' } },
    { text: '報告擺在桌子中間。封面撰寫人那一欄印的是經理的名字。' },
    { text: '我看了一眼，拉椅子坐下。' },
    { who: 'vp', text: '怡君，謝謝妳特地跑一趟。協理有幾個細節想確認。' },
    { text: '協理沒有寒暄，直接翻到折角的那頁。', sfx: ['page'] },
    { who: 'director', text: '陳小姐，第十二頁這張表。平均來客數為什麼只算十一個月？' },
    { text: '經理清了一下喉嚨。' },
    { who: 'manager', text: '這個部分當時是考量整體的資料品質……' },
    { text: '協理沒看他，看我。' },
    { who: 'me', text: '七月扣掉了。你們安南那家七月淹水，停了兩個禮拜，放進去整年平均會被拉低，看起來像那個商圈不行。' },
    { who: 'director', text: '報告裡沒寫。' },
    { who: 'me', text: '我口頭補。原始的表我有分開列，含七月跟不含的，差大概一成。', optional: 'report' },
    { text: '協理旁邊的年輕人開始打字。', set: { prop: null } },
    { who: 'director', text: '第十九頁，建議撤的三家裡面，有一家你們後來改成保留。為什麼？' },
    { who: 'me', text: '那家帳面最差，可是晚上九點以後的客人都是對面醫院下班的。我去站了三個晚上，店長有給我看他自己記的本子。撤掉的話，那些人不會改去你們別家，路線不順。' },
    { who: 'director', text: '店長姓什麼？' },
    { who: 'me', text: '姓蘇。他騎野狼。' },
    { text: '協理笑了一下，他今天第一次笑。' },
    { who: 'director', text: '他跟我說，去年來點貨點到半夜的是一位陳小姐。我翻了整本，找不到這個名字。' },
    { text: '會議室沒有人講話。冷氣出風口的聲音變得很清楚。' },
    { text: '經理手上的筆蓋開了，又蓋回去。' },
    { text: '我沒有看他。' },
    { who: 'me', text: '內容的部分，還有要問的我都可以答。' },
    { text: '協理看了我幾秒，翻到下一個折角。', sfx: ['page'] },
    { text: '他又問了五題，我都答了。有一題我說「這個我當時沒查到，數字是估的，估法在附錄」，他點頭，在旁邊打了個勾。' },
    { text: '問完，協理把報告闔起來。' },
    { who: 'director', text: '可以了。謝謝陳小姐。' },
    { text: '副總送客戶到電梯，回來的時候把會議室的門帶上。經理還坐在原位。' },
    { who: 'vp', text: '怡君，今天謝謝妳專程跑一趟。' },
    { who: 'me', text: '不會。' },
    { text: '我把東西收進包包。經理把桌上那份報告翻開，又闔起來。' },
    { who: 'manager', text: '怡君，那個……妳有沒有考慮回來？' },
    { who: 'manager', text: '職稱可以調，薪水我去幫妳爭取。妳要是願意，下禮拜就可以回來上班。' },
    { text: '副總站在門邊，沒有插話。' },
    { who: 'me', text: '不用了。' },
    { who: 'manager', text: '妳不用現在回答，回去想幾天再跟我講也可以。' },
    { who: 'me', text: '我知道，不用了。' },
    { who: 'vp', text: '好，那就不勉強妳。' },
    { text: '我站起來，把椅子靠回去。' },
    { who: 'manager', text: '怡君。' },
    { text: '我背著包包，站在門口等他講。' },
    { who: 'manager', text: '……路上小心。' },
    { who: 'me', text: '好。' },
    { who: 'yizhen', text: '怎樣？', set: { place: 'elevator' } },
    { who: 'me', text: '問完了。' },
    { who: 'yizhen', text: '經理有沒有留妳？' },
    { who: 'me', text: '有。' },
    { who: 'yizhen', text: '然後？' },
    { text: '電梯來了。我走進去，按了一樓。', sfx: ['ding'] },
    { who: 'me', text: '週報後來有弄好嗎？' },
    { who: 'yizhen', text: '有啦，改路徑就好了。欸妳不要轉移話題……' },
    { text: '門關上了。' },
    { text: '下樓我才發現襯衫背後濕了一片。會議室冷氣那麼強。', set: { place: 'lobby' } },
    { text: '我在超商買了一瓶水，站在門口喝掉半瓶。手有一點抖，抖了一下就沒了。', set: { place: 'street' } },
  ],
  // 咖啡店內（傍晚）：龍眼、兩聲、第 3 杯
  d3cafe: [
    { text: '德叔看我進門，多拿了一個小碟子，放了兩塊餅乾。', set: { ...COUNTER, tone: 'dusk', deshu: 'brew', cat: null, cup: true, portrait: false }, sfx: ['boil', 'place'] },
    { text: '龍眼在我的椅子底下。', set: { ...SIDE, cat: 'under' } },
    { text: '我蹲下來，包包滑到手肘。他自己走出來，坐在我面前。', set: { cat: 'front' }, optional: 'stroke' },
    { text: '手從他頭頂順下去，過了背，尾巴從我掌心滑出去。' },
    { text: '昨天回來，我也這樣摸了他一趟。' },
    { who: 'me', text: '龍眼，我最近怎麼這麼幸運？' },
    { text: '龍眼喵了一聲。' },
    { text: '他把下巴靠到我膝蓋上。', sfx: ['purr'] },
    { who: 'me', text: '該不會是你帶來的吧？' },
    { text: '龍眼又喵了一聲。' },
    { who: 'me', text: '所以真的是你帶好運給我的嗎？' },
    { text: '龍眼喵了兩聲。' },
    { text: '我笑出聲，兩手把他整隻撈起來，抱在懷裡。他後腳懸了一下，踩到我手臂上。', set: { cat: null } },
    { who: 'me', text: '兩聲。我聽到了喔。' },
    { text: '我抬頭。德叔在吧台後面看著我們，嘴角彎彎的。', set: { ...COUNTER } },
    { text: '我抱著他起身，坐到椅子上。他在我腿上轉了半圈，趴好。', set: { ...SIDE }, optional: 'cup' },
    { who: 'me', text: '我今天講了很多話，比我以前一個月開會講的還多。' },
    { who: 'deshu', text: '喝慢點。' },
    { text: '我喝慢一點。' },
    { who: 'me', text: '他們叫我回去。' },
    { text: '德叔把濾紙丟進桶子，沒有問我怎麼回答。' },
    { who: 'deshu', text: '明天會出太陽。有衣服要洗的話，後面有竹竿。' },
    { text: '我帶的三天份，今天穿的是最後一件。' },
  ],
  d3night: [
    { text: '經理說職稱可以調，薪水他去幫我爭取，我跟他說不用了。', set: { place: 'bed', prop: null }, mono: true },
    { text: '報告封面印的是經理的名字，這件事我在會議上沒有講，反正客戶問的那些只有我答得出來。', mono: true },
    { text: '傍晚抱著龍眼的時候，我發現我已經沒有在想公司的事了。', mono: true },
    { text: '我帶來的衣服今天穿到最後一件，德叔說明天會出太陽，後面有竹竿，我明天一早要先洗衣服。', mono: true },
    { text: '我翻了個身，很快就睡著了。', mono: true, sleep: true },
  ],

  /* ====================== 第四天　還剩十七張 ====================== */
  d4wake: [
    { text: '蚊帳我到現在還是不會掛，半夜掉下來蓋在臉上。早上起來，脖子被叮了兩個包。', set: { place: 'roomMorning', prop: null } },
    { text: '鏡子裡的臉沒變，多兩個蚊子包。', set: { place: 'basin' } },
  ],
  d4shop: [
    { who: 'me', text: '我回去拿衣服。', set: { ...COUNTER, tone: 'morning', deshu: 'brew', cat: 'nap', cup: false, portrait: false, prop: null }, sfx: ['boil'] },
    { who: 'deshu', text: '嗯。' },
  ],
  // 租屋處信箱 → 郵局 → 郵局門口 → 房間 → 省道 → 阿桂的攤子 → 果園 → 咖啡店外
  d4town: [
    { text: '前天這個信箱還是空的。今天裡面有一張粉紅色的單子。', set: { place: 'mailbox', prop: null }, optional: 'mailbox' },
    { text: '包裹招領。寄件人那欄的名字我看了兩次。' },
    { text: '是大學同學，畢業以後只在別人的婚禮上見過一次。' },
    { text: '單子上寫要帶身分證跟印章。印章在背包的資料袋裡，前天之前我連它在哪都不知道。' },
    { text: '紙箱不大，抱起來有重量。膠帶纏了很多圈，她以前包東西就這樣。', set: { place: 'post', prop: 'box' }, sfx: ['place'], gate: 'tape' },
    { text: '我在郵局門口的機車上拆。', set: { place: 'street' } },
    { text: '泡泡紙裡面是一台底片相機，黑色的，背帶上有我用立可白寫的英文名字，掉了一半。', set: { prop: 'camera' } },
    { text: '大三她說要去畢旅借一下。後來她沒提，我也不好意思問。再後來我就當它丟了。' },
    { who: 'note', text: '搬家翻到的。早該還妳了，拖這麼久對不起。裡面的底片我沒動。', set: { prop: 'note' } },
    { text: '我把相機翻過來。計數窗停在 19。', set: { prop: 'camera', counter: true } },
    { text: '前面十九張是誰拍的、拍了什麼，我想不起來。' },
    { text: '後面還有十七張。', optional: 'lever' },
    { text: '我扳了一下。卡榫的聲音跟我記得的一樣。' },
    { text: '我上樓把洗衣籃裡的衣服丟進洗衣機，等它洗完晾起來。房間還是那個樣子，桌上有前天的號碼牌。', set: { place: 'home', prop: null } },
    { text: '房東傳訊息提醒月底繳房租。我回了「好」。', sfx: ['buzz'] },
    { text: '我另外拿了四天份的衣服。相機掛在脖子上，騎車的時候塞進外套裡面。' },
    { text: '等紅燈的時候我拍了一張，檳榔攤的招牌掉了一個字。', set: { place: 'road' }, optional: 'shutter' },
    { text: '過橋我停下來拍溪。水很少，石頭都露在外面。', optional: 'shutter' },
    { text: '我很久沒有為了看一個東西把車停下來。後面的貨車按了我一聲喇叭。', optional: 'shutter' },
    { text: '對焦要用轉的。我的手指一開始找不到環在哪，轉過頭又轉回來。' },
    { text: '上坡那個攤子今天有人。紙板上用奇異筆寫著「阿桂」。', set: { place: 'stall' } },
    { text: '她坐在塑膠椅上剝東西，看到我脖子上的相機，手停了。', set: { portrait: 'agui' } },
    { who: 'agui', text: '那個還買得到底片喔？' },
    { who: 'me', text: '不知道。這卷是以前的。' },
    { who: 'agui', text: '拍得出來嗎？' },
    { who: 'me', text: '不知道。' },
    { text: '她把手在圍裙上擦了擦，站起來，走到磅秤旁邊。' },
    { who: 'agui', text: '幫我拍一張。', optional: 'focus' },
    { text: '她站得很直，沒有笑，手不知道要放哪，最後放在磅秤上。' },
    { text: '我按下去。' },
    { who: 'agui', text: '好了？' },
    { who: 'me', text: '好了。' },
    { who: 'agui', text: '洗出來再說。' },
    { text: '她坐回去繼續剝。我要走的時候，她抓了兩顆放在我的機車踏板上，沒看我。' },
    { text: '過了果園我又停一次。水塔上面站了一隻白鷺鷥，我對牠對了很久，按下去的時候牠飛了。', set: { place: 'orchard', portrait: null }, optional: 'shutter' },
    { text: '我拍到的大概只有水塔。' },
    { text: '到店門口，我看了一下計數窗，快到底了。', set: { place: 'shopDusk', film: 35 }, sfx: ['boil'] },
    { text: '水在燒。德叔在吧台後面，背對門，在把洗好的杯子一個一個倒扣。', optional: 'shutter' },
    { text: '我站在門口拍了。他聽到聲音回頭，看到相機，又轉回去扣杯子。' },
    { text: '我再扳，扳不動了。', set: { film: 36 } },
  ],
  // 吧台：倒片 → 咖啡豆罐 → 回護龍
  d4cafe: [
    { text: '我坐在老位置，按住底下的鈕，把底片倒回去。', set: { ...COUNTER, tone: 'dusk', deshu: 'stand', cat: 'nap', cup: false, portrait: false, prop: 'camera', film: 36 }, gate: 'rewind' },
    { text: '轉到一半，我想起來前面十九張裡面，應該有一張是我自己，她幫我拍的，在系館樓梯。那時候幾歲我要算一下。' },
    { text: '搖桿忽然變輕。' },
    { text: '我打開背蓋，把那卷倒出來。很小一顆，握在手裡是溫的。', set: { prop: null } },
    { who: 'me', text: '德叔，這附近有地方洗底片嗎？' },
    { who: 'deshu', text: '新營以前有一家，不知道還在不在。' },
    { text: '他走到後面，拿了一個空的咖啡豆罐出來，罐口朝我，放在吧台上。', set: { prop: 'can' }, sfx: ['place'] },
    { who: 'deshu', text: '先放這個，不會潮。' },
    { text: '我把底片放進去。它在鐵罐底滾了半圈，停了。', sfx: ['drip'] },
    { text: '爐子上的水還在響。他把我的杯子擺出來，把手朝右。', set: { prop: null, deshu: 'brew' }, sfx: ['boil', 'place'] },
    { text: '水滾了，德叔沖了一杯給我，我坐在吧台把它喝完。', sfx: ['thinPour'] },
    { who: 'deshu', text: '杯仔放著就好，我等一下再洗。', set: { deshu: 'stand' } },
    { who: 'me', text: '好。德叔晚安。' },
    { text: '我把那個裝底片的鐵罐拿在手上，從店裡走回三合院。', set: { prop: 'can' } },
  ],
  // 庭埕（晚上）→ 護龍的房間 → 關燈躺下 → 睡前自白
  d4night: [
    { text: '我穿過庭埕，走回右邊護龍。', set: { place: 'courtyard', prop: null } },
    { text: '我把鐵罐放在枕頭旁邊，今天下山帶回來的衣服放在床尾。', set: { place: 'roomNight', can: true } },
    { text: '我關了燈，躺下來。', set: { place: 'bed', dark: true }, sfx: ['creak'] },
    { text: '脖子上那兩個蚊子叮的包還在癢。', mono: true },
    { text: '今天拍的照片裡有阿桂，也有德叔，我想拍白鷺鷥的那一張，大概只拍到水塔。', mono: true },
    { text: '那捲底片前面還有十九張是以前拍的，我完全想不起來那時候拍了什麼。', mono: true },
    { text: '德叔說新營以前有一家洗照片的，不知道還在不在，我明天想去找找看。', mono: true },
    { text: '枕頭旁邊放著那個鐵罐，我沒再想就睡著了。', mono: true, sleep: true },
  ],
};
