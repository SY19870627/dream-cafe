// 店裡的小事（承峰 11/3 第二輪回饋：「東西有點少、沒什麼變化」的方案 3、1、5）：
// - 前三天的小段落（EARLY，D181）：第 1 天阿哲走了以後、第 2～3 天熟客來之前或之後，還有一點事。一段只演一次；
// - 店內小事件（IDLE_EVENTS，D182）：沒有演出、沒有人說話、沒在沖咖啡的時候，每 1～3 分鐘一件：德叔擦杯子、澆花、換黑板，
//   龍眼在窗台上伸懶腰、翻身、尾巴晃、坐起來看窗外（不離開窗台，Q64），窗外經過機車、有鳥在叫。多半不說話；
// - 擺飾第一次擺出來的反應（DECOR_REACTIONS，D183）：德叔、在場的熟客或龍眼一句話或一個動作，一件一次，存檔記住。
// 台詞都是自行補寫的（每一句都標了待定），演出在 main.js。純邏輯，不依賴 Three.js 或 DOM。

/* ---------- 前三天的小段落（D181） ---------- */
// days：哪幾天可以發生（錯過就算了，不補）；when(c)：c 是店裡現在的狀態（見 earlyDue()）
// line：演完之後誰說一句（[說話的人, 台詞]）
export const EARLY = [
  // 第 1 天：阿哲走了以後，一位小姐推門進來、看了窗邊那張桌子一會兒，沒坐就走了（隔天予安第一次來，就坐在那裡）
  { id: 'd1-peek', days: [1, 1], when: (c) => c.met.zhe && !c.met.yuan && !c.here.includes('zhe') && !c.expecting.includes('zhe'),
    line: ['德叔', '剛才那位小姐，在門口看了窗邊那張桌子很久。'] }, // 【待定】
  // 第 2～3 天：予安第一次來之後，德叔替她續一杯黑咖啡（她不說話，德叔替她說）
  { id: 'd2-refill', days: [2, 3], when: (c) => c.met.yuan && c.seated.includes('yuan'),
    line: ['德叔', '第二杯。她沒抬頭，不過說了謝謝。'] }, // 【待定】
  // 第 3～4 天：門外有人停了一下，沒進來（劇本日誌「有一位路過的客人問這間店叫什麼」那句日誌已經在用，這裡換一句）
  { id: 'd3-passerby', days: [3, 4], when: () => true,
    line: ['德叔', '門口剛才有人停了一下，又走了。下次也許會進來。'] }, // 【待定】
];
export const EARLY_QUIET_MS = 30000; // 店裡安靜這麼久（遊戲時間）之後，才演前三天的小段落

// c：{ day, here: [在店裡的熟客], seated: [坐在自己位子上的熟客], expecting: [今天還沒走進來的熟客], met: { yuan, zhe } }
// done：已經演過的 id。回傳現在可以演的那一段（沒有就是 null）
export function earlyDue(c, done = []) {
  return EARLY.find((e) => !done.includes(e.id) && c.day >= e.days[0] && c.day <= e.days[1] && e.when(c)) || null;
}

/* ---------- 店內小事件（D182） ---------- */
// who：誰在動（deshu、cat、window）；w：權重；needs：店裡要擺著其中一件才會發生；day：只在白天、晴天
// lines：偶爾（chance）說的一句；say：說話的人（龍眼的事由德叔說）
export const IDLE_GAP = { min: 60000, max: 180000 }; // 沒事的時候，隔 1～3 分鐘一件（真實時間）
export const IDLE_EVENTS = [
  { id: 'deshu-wipe', who: 'deshu', w: 3, chance: 0.3,
    lines: ['杯子擦亮了，咖啡也會比較好喝。……大概。'] }, // 【待定】
  { id: 'deshu-water', who: 'deshu', w: 2, needs: ['plant', 'succulent'], chance: 0.5,
    lines: ['多喝一點。'] }, // 【待定】德叔對盆栽說
  { id: 'deshu-board', who: 'deshu', w: 2, chance: 0.5,
    lines: ['今天換這支。'] }, // 【待定】
  { id: 'cat-stretch', who: 'cat', w: 3, chance: 0.2,
    lines: ['伸完懶腰，又睡了。'] }, // 【待定】德叔說
  { id: 'cat-roll', who: 'cat', w: 2 },
  { id: 'cat-tail', who: 'cat', w: 3 },
  { id: 'cat-look', who: 'cat', w: 2 },
  { id: 'window-bike', who: 'window', w: 2, chance: 0.25,
    lines: ['隔壁的阿伯，又去巡果園了。'] }, // 【待定】德叔說
  { id: 'window-birds', who: 'window', w: 2, day: true },
];
const IDLE_BY_ID = new Map(IDLE_EVENTS.map((e) => [e.id, e]));
export const idleById = (id) => IDLE_BY_ID.get(id) || null;

// 德叔換黑板（deshu-board）：黑板菜單（D185）以後，黑板上只寫老闆寫上去、真的點得到的東西（Q74 的暫定做法，D188）。
// 原本輪流換成裝飾用的「阿里山 水洗」「東山 蜜處理」「古坑 日曬」（點不到）拿掉了；
// 現在是把黑板上喝的東西換一杯到最上面（不改老闆寫了哪幾樣），黑板上只有一杯喝的時只是重寫一次、不說話（見 main.js）

// 可以發生的小事件：c＝{ placed: Set, night, weather, keeper（凱文顧店，德叔不在）, deshuFree, catFree, recent: [最近幾件的 id] }
export function idleCandidates(c) {
  return IDLE_EVENTS.filter((e) => {
    if (e.who === 'deshu' && (c.keeper || !c.deshuFree)) return false;
    if (e.who === 'cat' && !c.catFree) return false;
    if (e.needs && !e.needs.some((i) => c.placed.has(i))) return false;
    if (e.day && (c.night || c.weather !== 'clear')) return false;
    return !(c.recent || []).includes(e.id);
  });
}
// 挑一件（r：0～1 的亂數）；最近兩件不重複，都不行時放寬
export function pickIdle(c, r) {
  let list = idleCandidates(c);
  if (!list.length) list = idleCandidates({ ...c, recent: [] });
  if (!list.length) return null;
  const total = list.reduce((s, e) => s + e.w, 0);
  let k = r * total;
  for (const e of list) if ((k -= e.w) < 0) return e;
  return list[list.length - 1];
}
// 這次要不要說那一句（r2：另一個 0～1 的亂數）；回傳台詞或 ''
export const idleLine = (e, r2) => (e.lines?.length && r2 < (e.chance || 0) ? e.lines[Math.floor(r2 * 1000) % e.lines.length] : '');

/* ---------- 擺飾第一次擺出來的反應（D183） ---------- */
// 每件一個候選清單，依序挑第一個做得到的：熟客要在店裡才說；deshu、cat 一定做得到。
// act：visit＝德叔走到那件東西旁邊再說；smile＝德叔在吧台笑一下；laugh＝熟客輕輕跳一下；sit＝龍眼在窗台上坐起來看一眼
export const DECOR_REACTIONS = {
  plant: [{ who: 'deshu', act: 'visit', line: '葉子朝著窗。它自己會找光。' }], // 【待定】
  'menu-board': [{ who: 'deshu', act: 'smile', line: '「不限時，慢慢等。」字是我寫的，老闆別笑。' }], // 【待定】
  'longan-jar': [{ who: 'zhe', act: 'laugh', line: '這罐是我阿公烤的那批吧？放這裡，客人會一直偷吃。' }, // 【待定】
    { who: 'deshu', line: '龍眼乾放在看得到的地方，人會比較想坐久一點。' }], // 【待定】
  succulent: [{ who: 'deshu', act: 'visit', line: '這幾盆不太需要人照顧。跟龍眼一樣。' }], // 【待定】
  'book-stack': [{ who: 'yuan', line: '有一本我高中讀過。書頁黃成這樣，剛好。' }, // 【待定】
    { who: 'deshu', line: '舊書放著，客人會翻。翻著翻著，就忘了看時間。' }], // 【待定】
  'coffee-sack': [{ who: 'zhe', line: '「東山」兩個字印歪了。……我們家的袋子也都這樣。' }, // 【待定】
    { who: 'deshu', line: '生豆袋放著，店裡就有一點豆子的味道。' }], // 【待定】
  'cat-cushion': [{ who: 'cat', act: 'sit', line: '他看了一眼。今天大概還是睡窗台。' }], // 【待定】德叔說
  easel: [{ who: 'yuan', line: '那座山畫得不太像。可是顏色是對的。' }, // 【待定】
    { who: 'deshu', line: '畫得不太像。不過下雨的時候，窗外的山也不太像。' }], // 【待定】
  radio: [{ who: 'kevin', line: '只有一個台？……那就不用選了。真好。' }, // 【待定】
    { who: 'deshu', act: 'visit', line: '只收得到一個台。老歌，剛好。' }], // 【待定】
  'floor-lamp': [{ who: 'deshu', act: 'smile', line: '晚上亮起來，這個角落就會有人想坐。' }], // 【待定】
  cabinet: [{ who: 'deshu', act: 'visit', line: '不成套的杯子，每一個都有人用過。' }], // 【待定】
  bookshelf: [{ who: 'yuan', act: 'laugh', line: '有書櫃的店，我可以坐一整天。……我本來就坐一整天。' }, // 【待定】
    { who: 'deshu', line: '書櫃放好了。字多的地方，人說話會小聲一點。' }], // 【待定】
  'record-player': [{ who: 'deshu', act: 'visit', line: '唱針放下去之前，店裡會安靜一下。我喜歡那一下。' }], // 【待定】
  'cat-tree': [{ who: 'cat', act: 'sit', line: '最上面那層是給他的。上不上去，他說了算。' }], // 【待定】德叔說
  'rattan-chair': [{ who: 'kevin', line: '這張椅子坐下去，我大概就不想開會了。' }, // 【待定】
    { who: 'deshu', line: '會晃的椅子。趕時間的人，坐不住。' }], // 【待定】
  'book-wall': [{ who: 'yuan', line: '……一整面。我可以在這裡寫完一本書。' }, // 【待定】
    { who: 'deshu', act: 'smile', line: '一整面牆的書。店裡安靜下來了，是好的那種安靜。' }], // 【待定】
  // 熟客送的東西
  napkin: [{ who: 'yuan', line: '你真的擺出來了……字很醜，不要靠太近看。' }, // 【待定】
    { who: 'deshu', act: 'visit', line: '予安小姐的紙巾。字很小，要靠近才看得到。' }], // 【待定】
  'yuan-book': [{ who: 'yuan', line: '擺在這裡，好像它本來就住在這裡。' }, // 【待定】
    { who: 'deshu', line: '扉頁那一句，我每天都會看一次。' }], // 【待定】
  'framed-napkin': [{ who: 'deshu', act: 'visit', line: '裱起來了。那天下午，就留在這裡了。' }], // 【待定】
  'zhe-bean-bag': [{ who: 'zhe', act: 'laugh', line: '放那麼顯眼……好啦，放大一點也可以。' }, // 【待定】
    { who: 'deshu', line: '阿哲的豆。名字寫得很大。' }], // 【待定】
};

// 這件擺飾的反應：here＝現在在店裡、沒在演場景的熟客；keeper＝凱文顧店（德叔的話改由吧台後面的人說不合適，只留熟客與龍眼）
export function decorReaction(item, here = [], keeper = false) {
  const list = DECOR_REACTIONS[item] || [];
  return list.find((r) => (r.who === 'deshu' ? !keeper : r.who === 'cat' ? true : here.includes(r.who))) || null;
}

// 擺在店裡、還沒反應過的擺飾（依擺進店裡的順序，同一種只算一次）
export function pendingDecor(save) {
  const seen = new Set(save.moments?.decor || []);
  const out = [];
  for (const o of [...save.owned].sort((a, b) => a.uid - b.uid)) {
    if (o.placed && !seen.has(o.item) && !out.includes(o.item)) out.push(o.item);
  }
  return out;
}
export function markDecor(save, item) {
  if (!save.moments.decor.includes(item)) save.moments.decor.push(item);
}
export function markEarly(save, id) {
  if (!save.moments.early.includes(id)) save.moments.early.push(id);
}

// 測試與校稿用：這個檔案裡所有玩家看得到的字
export function allMomentLines() {
  return [
    ...EARLY.map((e) => e.line[1]),
    ...IDLE_EVENTS.flatMap((e) => e.lines || []),
    ...Object.values(DECOR_REACTIONS).flatMap((l) => l.map((r) => r.line)),
  ];
}
