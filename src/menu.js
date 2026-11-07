// 黑板菜單（承峰 11/3：「菜單做 A，存檔照 B 設計」，D185～D188）：
// - 解鎖過的品項收在「菜單本」，老闆決定哪幾樣寫上吧台後的黑板；寫上、擦掉都免費、馬上生效、隨時可以改回。
// - 黑板寫得下 BOARD_MAX 行（物理的限制）；沒有營收、銷量、排行，也沒有「上架 N 樣」的任務。
// - 品項只從劇情長出來（熟客的里程碑），還沒解鎖的不出現、不顯示鎖住的格子。
// - 德叔照黑板沖：「請德叔沖一杯」、最後一杯、一次客人模式點單都從黑板上喝的東西選；黑板上有點心就附一小碟。
// - 熟客劇情裡點的東西（予安的黑咖啡、凱文的冰美式、德叔端的熱可可）照演，和黑板無關；
//   熟客看到「自己的東西」第一次寫上黑板、或平常點的東西被擦掉時，說一句好的或中性的話（各一次）。
// 存檔 save.menu 照選項 B 的需求設計（之後擴充 B 不用再改格式），見 blankMenu()。
// 台詞都是自行補寫的（每一句都標了待定）。純邏輯，不依賴 Three.js 或 DOM。

export const BOARD_MAX = 4; // 黑板最多幾行（Q74 的暫定做法：4 行，咖啡、點心混著寫；D188）

// 品項（菜單本的順序）：
//   name：菜單本上的名字；chalk：黑板上的字；big：寫大一點（阿哲的豆）；kind：coffee 咖啡、drink 不是咖啡的飲品、food 點心（附一小碟）
//   cup：端上桌的杯子（main.js 的 makeCup）；desc：菜單本上的一句來歷；from：哪個里程碑解鎖（start＝一開店就有）；who：和誰有關
//   station：哪一站（選項 B 的「旅程菜單」用；可以帶到下一站的品項之後加 carry）
//   auto：解鎖時黑板寫得下就直接寫上去（原本劇情就上菜單的東西：龍眼乾、阿哲的豆）
//   served：端上桌時德叔說的那句；got：解鎖了但沒寫上黑板時，德叔說一次（老闆不在就寫進營業日誌）；gotBoard：解鎖時直接寫上黑板，德叔說一次
export const ITEMS = {
  dongshan: { name: '東山的豆', chalk: '東山 日曬', kind: 'coffee', cup: 'hot', from: 'start', who: 'deshu', station: 'dongshan',
    desc: '德叔的手沖。東山的豆，就是窗外那片山。',
    served: '東山的豆，就是窗外那片山。' },
  longan: { name: '窯烤龍眼乾', chalk: '窯烤龍眼乾', kind: 'food', from: 'zhe1', who: 'zhe', station: 'dongshan', auto: true,
    desc: '阿哲的阿公窯烤的龍眼乾，配咖啡剛好。',
    gotBoard: '龍眼乾，我先寫上黑板了。黑板上要寫什麼，老闆說了算。' }, // 【待定】
  black: { name: '黑咖啡', chalk: '黑咖啡', kind: 'coffee', cup: 'hot', from: 'yuan1', who: 'yuan', station: 'dongshan',
    desc: '窗邊那位小姐只點這個。不加糖，也不加奶。', // 【待定】
    served: '黑咖啡。窗邊那位小姐，也是喝這個。', // 【待定】
    got: '窗邊那位小姐的黑咖啡，我記進菜單本了。要不要寫上黑板，老闆決定。' }, // 【待定】
  iced: { name: '冰美式', chalk: '冰美式', kind: 'coffee', cup: 'iced', from: 'kevin1', who: 'kevin', station: 'dongshan',
    desc: '下午五點那位先生每天點的。冰塊最後才放。', // 【待定】
    served: '冰美式。冰塊最後才放，比較不會淡。', // 【待定】
    got: '冰美式，我也記進菜單本了。黑板上寫不寫，看老闆。' }, // 【待定】
  cocoa: { name: '熱可可', chalk: '熱可可', kind: 'drink', cup: 'cocoa', from: 'yuan4', who: 'yuan', station: 'dongshan',
    desc: '予安小姐收到退稿信那天，德叔端給她的。她說她沒點。', // 【待定】
    served: '熱可可。今天不喝咖啡，也可以。', // 【待定】
    got: '那杯熱可可，我也記進菜單本了。老闆想寫上黑板，再寫。' }, // 【待定】
  'zhe-beans': { name: '阿哲的豆', chalk: '阿哲的豆', big: true, kind: 'coffee', cup: 'hot', from: 'zhe6', who: 'zhe', station: 'dongshan', auto: true,
    desc: '阿哲自己處理的豆子。名字寫大一點。',
    served: '阿哲的豆。他說寫大一點，我就寫大一點。', // 【待定】（原本就有的句子）
    got: '阿哲的豆，我記進菜單本了。黑板要不要換一行，老闆決定。' }, // 【待定】
  // 試咖啡（D206、D207，tasting.js）：德叔試做、老闆在測試紀錄上「定案」才收進菜單本並寫上黑板；from 是 trial:<配方>。dish：端上桌時附一小碟龍眼乾
  kiln: { name: '龍眼窯特調', chalk: '龍眼窯特調', kind: 'coffee', cup: 'hot', dish: true, from: 'trial:kiln', who: 'yuan', station: 'dongshan', // 【待定】
    desc: '東山的豆配窯烤龍眼乾。予安小姐在寫的那座龍眼窯，煙大概是這個味道。', // 【待定】「煙是甜的」留給照片 yuan-3 她本人第一次說
    served: '龍眼窯特調。龍眼乾放在旁邊。' }, // 【待定】
  'zhe-new': { name: '阿哲的新法', chalk: '阿哲的新法', kind: 'coffee', cup: 'hot', from: 'trial:zhe-new', who: 'zhe', station: 'dongshan', // 【待定】
    desc: '阿哲自己的新方法處理的那一包，單獨沖。比較亮。', // 【待定】
    served: '阿哲的新法。比較亮，像早上。' }, // 【待定】
};
export const ITEM_IDS = Object.keys(ITEMS);
export const START_ITEMS = ['dongshan'];
export const isDrink = (id) => ITEMS[id]?.kind === 'coffee' || ITEMS[id]?.kind === 'drink';
export const byFrom = (from) => ITEM_IDS.filter((id) => ITEMS[id].from === from);

// 菜單本與黑板的文字（每一句都標了待定）
export const BOOK = {
  title: '菜單本', // 【待定】
  sub: '黑板上寫什麼，德叔就沖什麼。寫上、擦掉都不用錢，隨時可以改。', // 【待定】
  full: '黑板只寫得下四行。', // 【待定】
  swap: '黑板寫不下了，要擦掉哪一行？', // 【待定】提案原文
  onBoard: '黑板上', // 【待定】
  inBook: '收在菜單本裡', // 【待定】
  write: '寫上黑板', // 【待定】
  erase: '擦掉', // 【待定】
  replace: '換掉一行', // 【待定】
  eraseThis: '擦掉這行', // 【待定】
  cancel: '先不寫', // 【待定】
  keepOne: '留一杯，德叔才有東西沖', // 【待定】黑板上最後一杯喝的不能擦
  isNew: '新的', // 【待定】菜單本裡還沒看過的品項
  kinds: { coffee: '咖啡', drink: '熱飲', food: '點心' }, // 【待定】
  open: '打開菜單本', // 【待定】記事本「菜單」一段的按鈕
  boardLine: '黑板上：', // 【待定】記事本
  button: '菜單', // 【待定】佈置模式下面的按鈕
};
export const eraseOf = (name) => `擦掉「${name}」`; // 【待定】阿哲第六幕黑板寫滿時的選項
// 黑板的標題：上面只有咖啡時照舊寫「今日手沖」，混著別的東西時寫「今日」
export const BOARD_HEAD = { coffee: '今日手沖', mixed: '今日' }; // 「今日」【待定】
// 請德叔沖一杯、最後一杯：黑板上喝的東西有兩樣以上時先問（都是咖啡時照舊問豆子）
export const ASK = {
  bean: '今天想喝哪一支豆子？', // 原本就有的句子
  drink: '今天想喝哪一杯？', // 【待定】黑板上有不是咖啡的東西時
  lastDrink: '最後一杯，想喝哪一杯？', // 【待定】
};

// 阿哲第六幕（任務 #19「菜單上架『阿哲的豆』」，Q73 的暫定做法）：任務照舊在里程碑發生時完成、豆子收進菜單本；
// 寫不寫上黑板由老闆決定（可以說之後再說）。老闆不在那天結算時，黑板寫得下就照原本的劇本直接寫上去。
export const ZHE6 = {
  ask: '老闆，要寫上黑板嗎？', // 【待定】德叔問
  options: ['寫上去', '之後再說'], // 【待定】
  later: '好。豆子先收進菜單本，老闆想寫，隨時寫。', // 【待定】
};

// 熟客看到黑板（D187）：on＝那樣東西第一次寫上黑板時、他在店裡；off＝曾經寫上過、現在被擦掉了，他在店裡（各一次）
// need(h)：h(who, n) 是那位熟客的第 n 個里程碑發生了沒
export const BOARD_REACT = [
  { item: 'black', who: 'yuan', on: '黑板上有黑咖啡了。……我點的東西，被寫上去了。', // 【待定】
    off: '今天黑板上沒有黑咖啡。沒關係，德叔知道我要什麼。' }, // 【待定】
  { item: 'iced', who: 'kevin', on: '冰美式寫上黑板了。好像我在這裡，有一個固定的位子。', // 【待定】
    off: '黑板上沒有冰美式啊。……德叔大概還是會端冰的給我。', offNeed: (h) => !h('kevin', 5) }, // 【待定】第五幕以後他改喝熱的
  { item: 'cocoa', who: 'yuan', on: '熱可可……是那天那杯。寫上去了啊。' }, // 【待定】
  { item: 'zhe-beans', who: 'zhe', on: '……真的寫上去了。好啦，字是有比較大。' }, // 【待定】老闆在第六幕說「之後再說」、之後才寫上去時
];

// 存檔 save.menu（第 7 版）：
//   items：解鎖過的品項 { [id]: { day 第幾天解鎖, t 什麼時候, from 哪段劇情, station 哪一站, seen 在菜單本看過了沒, told 德叔提過了沒,
//          boardedDay 第一次寫上黑板是第幾天（0＝還沒寫過）, noticed／missed 哪些熟客看過它寫上黑板／被擦掉 } }
//   board：黑板上的品項，由上往下（最多 BOARD_MAX 行）
//   night：選項 B 的「下班後那一面」黑板；null＝和白天同一面（A 不使用）
export const blankItem = (from = 'start', day = 1, t = 0, station = 'dongshan') =>
  ({ day, t, from, station, seen: false, told: false, boardedDay: 0, noticed: [], missed: [], brewProfile: null });
export function blankMenu(t = 0) {
  const items = {};
  for (const id of START_ITEMS) items[id] = { ...blankItem('start', 1, t), seen: true, told: true, boardedDay: 1 };
  return { items, board: [...START_ITEMS], night: null };
}

export const unlocked = (save, id) => !!save.menu?.items?.[id];
export const onBoard = (save, id) => (save.menu?.board || []).includes(id);
export const boardFull = (save) => (save.menu?.board || []).length >= BOARD_MAX;
// 菜單本：解鎖過的品項（照 ITEMS 的順序）
export const bookItems = (save) => ITEM_IDS.filter((id) => unlocked(save, id));
// 黑板上喝的東西（請德叔沖一杯、最後一杯、客人模式點單都從這裡選）；shift：德叔換黑板時把第幾杯換到最上面（不存檔）
export function boardDrinks(save, shift = 0) {
  const list = (save.menu?.board || []).filter(isDrink);
  if (!list.length) return ['dongshan']; // 保險：黑板上一定留著一杯（canErase），舊資料壞掉時才會走到這裡
  const k = ((shift % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}
export const boardFood = (save) => (save.menu?.board || []).filter((id) => ITEMS[id]?.kind === 'food');
export const withSnack = (save) => boardFood(save).length > 0; // 黑板上有點心：每一杯旁邊附一小碟
// 黑板上寫的字（由上往下）：[{ id, text, big }]；喝的東西照 shift 輪換，點心寫在後面
export function boardLines(save, shift = 0) {
  const drinks = (save.menu?.board || []).some(isDrink) ? boardDrinks(save, shift) : [];
  const ids = [...drinks, ...boardFood(save)];
  return ids.map((id) => ({ id, text: ITEMS[id].chalk, big: !!ITEMS[id].big }));
}
export function boardHead(save) {
  const b = save.menu?.board || [];
  return b.length && b.every((id) => ITEMS[id]?.kind === 'coffee') ? BOARD_HEAD.coffee : BOARD_HEAD.mixed;
}
// 請德叔沖一杯的問句（最後一杯：都是咖啡時用 afterhours.js 原本的 CLOSING.chooseBean，不然用 ASK.lastDrink）
export const askFor = (ids) => (ids.every((id) => ITEMS[id]?.kind === 'coffee') ? ASK.bean : ASK.drink);

// 解鎖一樣東西（劇情裡發生）；auto 的品項黑板寫得下就直接寫上去（opt.board === false 時不寫）。
// 回傳 null（已經有了／不認得）或 { id, boarded }
export function unlock(save, id, day = 1, t = 0, opt = {}) {
  if (!ITEMS[id] || unlocked(save, id)) return null;
  save.menu.items[id] = blankItem(opt.from || ITEMS[id].from, day, t, ITEMS[id].station);
  let boarded = false;
  if (ITEMS[id].auto && opt.board !== false && !boardFull(save)) boarded = write(save, id, day);
  return { id, boarded };
}
// 這個里程碑解鎖的品項
export const unlockFrom = (save, from, day, t = 0, opt = {}) => byFrom(from).map((id) => unlock(save, id, day, t, { ...opt, from })).filter(Boolean);

// 寫上黑板（寫滿了就不寫，回傳 false）
export function write(save, id, day = 1) {
  if (!unlocked(save, id) || onBoard(save, id) || boardFull(save)) return false;
  save.menu.board.push(id);
  const it = save.menu.items[id];
  if (!it.boardedDay) it.boardedDay = day;
  return true;
}
// 擦掉：黑板上最後一杯喝的東西不能擦（德叔要有東西沖）
export const canErase = (save, id) => onBoard(save, id) && (!isDrink(id) || save.menu.board.filter(isDrink).length > 1);
export function erase(save, id) {
  if (!canErase(save, id)) return false;
  save.menu.board.splice(save.menu.board.indexOf(id), 1);
  return true;
}
// 黑板寫滿時換一行：擦掉 out、在同一行寫上 id
export function replace(save, out, id, day = 1) {
  if (!onBoard(save, out) || !unlocked(save, id) || onBoard(save, id)) return false;
  // 換掉的是最後一杯喝的東西、換上來的不是喝的：不行（德叔要有東西沖）
  if (isDrink(out) && !isDrink(id) && save.menu.board.filter(isDrink).length <= 1) return false;
  save.menu.board[save.menu.board.indexOf(out)] = id;
  const it = save.menu.items[id];
  if (!it.boardedDay) it.boardedDay = day;
  return true;
}
export function markSeen(save) { for (const id of bookItems(save)) save.menu.items[id].seen = true; }

// 解鎖了、德叔還沒提的品項（老闆在店裡時，安靜下來由德叔說一句）：[{ id, line }]
export function pendingTell(save) {
  return bookItems(save).filter((id) => !save.menu.items[id].told).map((id) => ({ id, line: tellLine(save, id) })).filter((x) => x.line);
}
export function tellLine(save, id) {
  const it = ITEMS[id];
  return onBoard(save, id) ? it.gotBoard || '' : it.got || '';
}
export function markTold(save, id) { if (save.menu.items[id]) save.menu.items[id].told = true; }

// 熟客看到黑板：here＝在店裡、沒在演場景的熟客；h(who, n)＝里程碑發生了沒。回傳 { item, who, kind: 'on' | 'off', line } 或 null
export function boardReaction(save, here = [], h = () => true) {
  for (const r of BOARD_REACT) {
    const it = save.menu.items[r.item];
    if (!it || !here.includes(r.who)) continue;
    if (onBoard(save, r.item) && r.on && !it.noticed.includes(r.who)) return { item: r.item, who: r.who, kind: 'on', line: r.on };
    if (!onBoard(save, r.item) && it.boardedDay && r.off && !it.missed.includes(r.who) && (!r.offNeed || r.offNeed(h))) return { item: r.item, who: r.who, kind: 'off', line: r.off };
  }
  return null;
}
export function markReaction(save, r) {
  const it = save.menu.items[r.item];
  if (!it) return;
  const list = r.kind === 'on' ? it.noticed : it.missed;
  if (!list.includes(r.who)) list.push(r.who);
}
// 熟客已經在劇情裡看過它寫上黑板（龍眼乾：阿哲第一幕；阿哲的豆：第六幕當場寫上去）
export function markNoticed(save, id, who) { const it = save.menu.items[id]; if (it && !it.noticed.includes(who)) it.noticed.push(who); }

// 舊存檔（第 6 版以前，menu 是 id 陣列）升級：原本菜單上的東西全部當作解鎖過、寫在黑板上、德叔提過了；
// 熟客劇情已經發生過的品項（黑咖啡、冰美式、熱可可）補進菜單本、不寫上黑板（德叔之後安靜時提一次）
// milestones：{ yuan: [...], zhe: [...], kevin: [...] }；day：今天第幾天
export function migrateMenu(old, milestones = {}, day = 1, t = 0) {
  const m = blankMenu(t);
  const list = Array.isArray(old) ? old.filter((id) => ITEMS[id]) : [];
  for (const id of list) {
    if (!m.items[id]) m.items[id] = { ...blankItem(ITEMS[id].from, day, t), seen: true, told: true };
    m.items[id].boardedDay = m.items[id].boardedDay || day;
    if (!m.board.includes(id) && m.board.length < BOARD_MAX) m.board.push(id);
    if (id === 'longan' || id === 'zhe-beans') m.items[id].noticed.push('zhe'); // 劇情裡阿哲已經看過
  }
  for (const id of ITEM_IDS) {
    if (m.items[id]) continue;
    const from = ITEMS[id].from;
    const who = from.replace(/\d+$/, ''), n = Number(from.match(/\d+$/)?.[0]);
    if (n && (milestones[who] || []).includes(n)) m.items[id] = blankItem(from, day, t);
  }
  return m;
}

// 測試與校稿用：這個檔案裡所有玩家看得到的字
export function allMenuLines() {
  return [
    ...Object.values(ITEMS).flatMap((i) => [i.name, i.chalk, i.desc, i.served, i.got, i.gotBoard].filter(Boolean)),
    ...Object.values(BOOK).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))),
    ...Object.values(BOARD_HEAD), ...Object.values(ASK), ZHE6.ask, ...ZHE6.options, ZHE6.later,
    eraseOf('東山的豆'),
    ...BOARD_REACT.flatMap((r) => [r.on, r.off].filter(Boolean)),
  ];
}

// 菜單本小字：定案後的店內沖法（黑板不寫參數）
export function brewProfileNote(save, id) {
  const p = save.menu?.items?.[id]?.brewProfile;
  if (!p) return '';
  const bits = [];
  if (p.ratio) bits.push(p.ratio);
  if (p.temp) bits.push(`${p.temp}°C`);
  else if (ITEMS[id]?.cup === 'iced') bits.push('冰');
  if (p.grind) bits.push(({ coarse: '粗', 'med-coarse': '中粗', med: '中', 'med-fine': '中細', fine: '細' })[p.grind] || p.grind);
  if (p.technique) bits.push(({ 'one-pour': '一刀流', pulse: '分段', center: '繞圈', 'bloom-long': '悶蒸長', 'ice-pour': '冰手沖', 'ice-chill': '冰鎮' })[p.technique] || p.technique);
  return bits.length ? `店內沖法 ${bits.join('・')}` : '';
}
