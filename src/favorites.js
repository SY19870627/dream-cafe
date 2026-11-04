// 幫熟客找到最愛的咖啡、相簿（承峰 11/4：Q75「做每人三段的版本」，提案 docs/提案_熟客最愛咖啡與相簿.md 的方案二）：
// - 熟客在店裡時，點他搭話，下方多一個「請德叔端一杯給他」；從黑板上喝的東西選（德叔只照黑板沖，D185）。
// - 每位熟客三段，每段跟在一個現有的里程碑後面、照順序開放；線索是熟客與德叔的一句話（不是提示框、不是清單）。
// - 端對：熟客說一句，畫面淡入那一段的「回憶畫面」（Q76），收進相簿。端錯：熟客照喝、說一句溫和的話，什麼都不會少。
// - 一天一位熟客只收一杯；同一段端錯兩次以上，德叔說一句更靠近的話（Q80，預設，待承峰確認）。
// - 第三段是那位熟客「最愛的那杯」（Q79 三杯最愛，預設，待承峰確認），找到時店裡暖 0.5°C（Q78「找到最愛要加溫度」，見 tasks.js 的 FAVORITE_TEMP）。
// - 相簿顯示還沒拿到的空格（Q77「相簿顯示空格」）：空格不寫內容、不寫數字。
// 存檔第 8 版的 favorites／photos（save.js）。台詞都是自行補寫的（每一句都標了待定）；劇本原文另外註明。
// 純邏輯，不依賴 Three.js 或 DOM。
import * as M from './menu.js';

export const FAV_IDS = ['yuan', 'zhe', 'kevin'];
export const STAGE_COUNT = 3;

// 每一段：after＝那位熟客第幾個里程碑發生之後開放；want(c)＝端對了沒（c = { drink 端過去的那杯, snack 附了一小碟龍眼乾, last 老闆最近一次喝的那杯 }）
//   talk：這一段開放時，點熟客搭話偶爾說的線索（現有的句子照抄、不改）；deshu：開放後德叔在吧台說一次的線索
//   ok：端對時熟客那一句；caption：照片下面的一句說明；hint：同一段端錯兩次以後，德叔更靠近的那句
//   said：照片淡入時熟客說的那一句（承峰 11/4：「圖上不寫字，改由角色台詞說出來」，D202）：原本要寫在照片裡的字改由他說出來，
//     相簿裡重看那張照片也顯示同一句；只有原本規格裡有字的照片才有（予安第三段、阿哲第三段），其他段沒有這一句
//   scene：給畫師的照片內容（不是玩家看得到的字，見 docs/照片美術清單.md）
// 凱文第三段的答案是「老闆最近一次喝的那杯」，hint 是函式（要寫出那一杯的名字）
export const STAGES = {
  yuan: [
    { n: 1, after: 1, title: '她只點這個', want: (c) => c.drink === 'black',
      talk: ['再一杯黑咖啡，我就寫得出來。', // 現有的句子（story.js 的 TALK）
        '今天還沒喝到黑咖啡，字都不太肯出來。'], // 【待定】
      deshu: '窗邊那位小姐，每次都只點同一杯。老闆想請她喝，點她跟我說一聲就好。', // 【待定】
      ok: '……謝謝。我今天會寫完這一頁。', // 【待定】
      caption: '第二杯黑咖啡之後，她寫下了第一行。', // 【待定】
      hint: '她桌上那杯，每次都是黑的。不加糖，也不加奶。' }, // 【待定】
    { n: 2, after: 4, title: '她沒點的那杯', want: (c) => c.drink === 'cocoa',
      talk: ['那天的熱可可，我後來一直想到。'], // 【待定】
      deshu: '予安小姐今天看了黑板很久。', // 【待定】
      ok: '這次是我想喝的。', // 【待定】
      caption: '這一次，是她自己點的。', // 【待定】
      hint: '退稿那天那杯，她說她沒點。……也許，現在想點了。' }, // 【待定】
    { n: 3, after: 5, title: '窯的煙', favorite: true, want: (c) => c.drink === 'black' && c.snack,
      talk: ['阿公以前說，窯火要用龍眼木，煙才會甜。', // 現有的句子（story.js 的 TALK）
        '稿子裡的煙，我寫得出來了。可是那個味道，我想不起來。'], // 【待定】
      deshu: '她說的煙，我想，是配著喝的。', // 【待定】
      ok: '……就是這個味道。阿公的窯，還在這裡。', // 【待定】
      caption: '阿公的窯熄了，煙還在這裡。', // 【待定】
      said: '煙是甜的。', // 原本要寫在照片稿紙上的字（照片美術清單，D202 改成她說出來）
      hint: '窯烤的龍眼乾，配她的黑咖啡。黑板上兩樣都寫著，我就一起端過去。' }, // 【待定】
  ],
  zhe: [
    { n: 1, after: 1, title: '有龍眼乾就好', want: (c) => c.snack,
      talk: ['喝什麼都可以啦，有龍眼乾就好。'], // 【待定】
      deshu: '阿哲每次進門，都先看吧台上那袋龍眼乾。老闆想請他喝，點他跟我說一聲就好。', // 【待定】
      ok: '你們真的把它寫上去了喔。……好啦，好吃。', // 【待定】
      caption: '他說他是被逼來的。他吃了第三顆。', // 【待定】
      hint: '黑板上寫著龍眼乾，每一杯就會附一小碟。阿哲那杯，也一樣。' }, // 【待定】
    { n: 2, after: 4, title: '阮的豆仔', want: (c) => c.drink === 'dongshan',
      talk: ['阿公那天喝的那杯……是哪一支啊？'], // 【待定】
      deshu: '阿公那天喝了一口，就認出來了。', // 【待定】
      ok: '……原來阿公的日曬，是這個味道。', // 【待定】
      caption: '阿公的日曬，曬在竹篩上，一天翻好幾次。', // 【待定】
      hint: '阿公喝的，是店裡最早的那一支。窗外那片山的。' }, // 【待定】
    { n: 3, after: 6, title: '以後', favorite: true, want: (c) => c.drink === 'zhe-beans',
      talk: ['我自己的豆，還沒有人沖給我喝過。'], // 【待定】
      deshu: '阿哲的豆，他自己還沒在店裡喝過。', // 【待定】
      ok: '……寫大一點是對的。', // 【待定】
      caption: '寫大一點，是對的。', // 【待定】
      said: '阿哲的豆。……黑板上，是我的名字。', // 【待定】照片淡入時阿哲說（原本是照片裡黑板上的「阿哲的豆」，D202）
      hint: '名字寫得最大的那一支，請他喝喝看吧。' }, // 【待定】
  ],
  kevin: [
    { n: 1, after: 1, title: '冰塊最後才放', want: (c) => c.drink === 'iced',
      talk: ['嗯？喔，冰美式，謝謝。', // 現有的句子（story.js 的 TALK）
        '下午五點，還是想喝冰的。'], // 【待定】
      deshu: '下午五點那位先生，每天都點同一杯。老闆想請他喝，點他跟我說一聲就好。', // 【待定】
      ok: '……你記得。我是說，謝謝。', // 【待定】
      caption: '冰塊最後才放，比較不會淡。', // 【待定】
      hint: '他那杯，冰塊最後才放。' }, // 【待定】
    { n: 2, after: 5, title: '下午五點的山', want: (c) => c.drink === 'dongshan',
      talk: ['原來下午五點的山，是這個顏色。', // 現有的句子（story.js 的 TALK）
        '窗外那片山，喝得到嗎？……我是說，有沒有那種咖啡。'], // 【待定】
      deshu: '凱文先生最近一直在看山。', // 【待定】
      ok: '喝起來像窗外。我以前都沒看。', // 【待定】
      caption: '下午五點的山，是這個顏色。', // 【待定】
      hint: '窗外那片山上的豆子，店裡一開門就有。' }, // 【待定】
    { n: 3, after: 6, title: '老闆的那杯', favorite: true, want: (c) => c.drink === c.last,
      talk: ['老闆，你平常都喝哪一支？……我想喝喝看。'], // 【待定】
      deshu: '凱文先生問我，老闆平常喝什麼。我說，我不替老闆回答。', // 【待定】
      ok: '原來你每天喝的是這個。……我好像知道要怎麼生活了。', // 【待定】
      caption: '他想知道，老闆每天怎麼過。', // 【待定】
      hint: (name) => `老闆上一杯喝的，是${name}。他想喝一樣的。` }, // 【待定】
  ],
};

// 端錯時熟客的一句（照喝、溫和；照端錯的次數輪流）
export const MISS = {
  yuan: ['謝謝。……今天這杯也很好。', '謝謝德叔，也謝謝老闆。我慢慢喝。'], // 【待定】
  zhe: ['喔，謝啦。……嗯，好喝。', '老闆請的喔？那我不客氣了。'], // 【待定】
  kevin: ['謝謝。……今天這杯也不錯。', '謝謝。我是說，真的謝謝。'], // 【待定】
};

// 三段都找到時，相簿那一頁最後的一句（他的最愛）
export const FAVORITE_LINE = {
  yuan: '予安：黑咖啡，配一小碟龍眼乾。', // 【待定】
  zhe: '阿哲：阿哲的豆。', // 【待定】
  kevin: (name) => `凱文：老闆的那杯（${name}）。`, // 【待定】
};

// 介面與德叔的話
export const FAV_TEXT = {
  offer: (bar, name) => `請${bar}端一杯給${name}`, // 【待定】點熟客搭話後下方的選項
  just: '只是聊聊', // 【待定】不端，照舊只搭話
  ask: (name) => `要端哪一杯給${name}？`, // 【待定】
  cancel: '再想想', // 【待定】
  start: '好，我沖一杯過去。', // 【待定】德叔接下來沖
  firstPhoto: '這張，我收進記事本的相簿了。', // 【待定】第一次拿到照片
  album: '相簿', // 【待定】記事本的入口、面板的標題
  albumSub: '端對的那一杯，留下來的樣子。想看的時候再翻。', // 【待定】
  day: (d) => `第 ${d} 天`, // 【待定】
  close: '闔上', // 【待定】大圖下面
};

// 吧台請凱文喝一杯（承峰 11/4：「坐吧台時可以請凱文喝一杯」，D199）：離開東山之後凱文在吧台後面顧店，不再是客人。
// 老闆坐吧台座時點凱文，下方多一個「請凱文喝一杯」；凱文照黑板替自己沖一杯，老闆請客。
// 承峰 11/4：「出來坐旁邊喝」（D200，取代 D199 的「放在自己面前的吧台上」）：凱文沖好端著杯子走出吧台，坐到老闆旁邊的高腳椅喝（sit），
// 喝完說一句（back）再走回吧台。
// 段落、開放條件、正確答案、端對與端錯的話都和上面的 STAGES.kevin／MISS.kevin 一樣；德叔已經不在店裡，
// 線索與錯兩次的提示改由凱文自己說（他轉述德叔以前說過的話）。clue／hint 照段落排（第 1～3 段），第三段的 hint 要寫出那一杯的名字
export const KEEPER_FAV = {
  offer: '請凱文喝一杯', // 【待定】坐吧台座點凱文後下方的選項
  ask: '老闆要請我喝哪一杯？', // 【待定】選飲料時上面那一行（凱文問）
  start: '老闆請客？……那我替自己沖一杯。德叔說，不要急。', // 【待定】凱文開始沖
  sit: '以前我坐外面，德叔在裡面。……今天換回來，坐一下。', // 【待定】凱文端著杯子坐到老闆旁邊的高腳椅（D200）
  back: '喝完了。我回吧台，老闆慢慢坐。', // 【待定】坐著喝完、站起來回吧台之前（D200）
  clue: [
    ['以前每天下午五點，我都點同一杯。現在換我沖給別人，自己反而沒喝了。'], // 【待定】第一段
    ['站在吧台裡面，剛好看得到窗外那片山。……那片山，喝得到嗎？'], // 【待定】第二段
    ['老闆平常都喝哪一支？德叔不肯替老闆回答，我只好自己記。'], // 【待定】第三段
  ],
  hint: [
    '德叔以前替我沖的那杯，冰塊最後才放。……我自己沖，反而忘了。', // 【待定】第一段，錯兩次以後
    '德叔說過，店裡最早的那一支，就是窗外那片山。', // 【待定】第二段
    (name) => `老闆上一杯喝的，是${name}。我是說，我想喝一樣的。`, // 【待定】第三段
  ],
};
// 凱文顧店時，坐吧台座點他偶爾說的線索（他那一段開放時；沒有開放是空陣列）
export const keeperClueLines = (save) => (isOpen(save, 'kevin') ? KEEPER_FAV.clue[current(save, 'kevin').n - 1] : []);
export function keeperHintOf(save) {
  const s = current(save, 'kevin');
  if (!s) return '';
  const h = KEEPER_FAV.hint[s.n - 1];
  return typeof h === 'function' ? h(nameOf(lastBeanOf(save))) : h;
}

// 照片還沒畫時，程式畫的佔位圖上的字（承峰 11/4：「照片待畫」改成「回憶等待觸發」，D198）
export const PHOTO_PLACEHOLDER = '回憶等待觸發';

// 照片：一段一張（D192：只用一張圖加程式動態）。file 是 assets/art/ 裡的檔名（不含 .webp），還沒有圖時用程式畫的佔位圖
// 圖裡不放任何文字（D202）；said 是照片淡入時那位熟客說的一句（沒有就是空字串），相簿裡重看也一樣
export const PHOTOS = FAV_IDS.flatMap((who) => STAGES[who].map((s) => ({ id: `${who}-${s.n}`, who, n: s.n, file: `photo_${who}_${s.n}`, caption: s.caption, said: s.said || '', favorite: !!s.favorite })));
export const photoById = (id) => PHOTOS.find((p) => p.id === id) || null;

export const blankFavorite = () => ({ stage: 0, misses: 0, servedDay: 0, told: 0 });
export function blankFavorites() { return { yuan: blankFavorite(), zhe: blankFavorite(), kevin: blankFavorite() }; }

const favOf = (save, who) => save.favorites?.[who] || null;
const hasMilestone = (save, who, n) => (save.regulars?.[who]?.milestones || []).includes(n);
// 現在要找的那一段（三段都找到了是 null）
export function current(save, who) {
  const f = favOf(save, who);
  if (!f) return null;
  return STAGES[who]?.[f.stage] || null;
}
// 這一段開放了沒：跟著的里程碑發生了（照順序，一次只有一段）
export function isOpen(save, who) {
  const s = current(save, who);
  return !!s && hasMilestone(save, who, s.after);
}
// 今天可以請德叔端一杯給他嗎（一天一杯；呼叫端另外判斷人在不在店裡、有沒有在演出）
export const canServe = (save, who, day) => isOpen(save, who) && favOf(save, who).servedDay !== day;

// 老闆最近一次喝的那杯：請德叔沖一杯、最後一杯、客人模式都記在 stats.lastBean；沒有就看咖啡日記、最後一杯，再沒有就是東山的豆
export function lastBeanOf(save) {
  const ok = (id) => !!id && M.isDrink(id);
  if (ok(save.stats?.lastBean)) return save.stats.lastBean;
  const d = [...(save.diary || [])].reverse().find((e) => ok(e.bean));
  if (d) return d.bean;
  if (ok(save.closing?.bean)) return save.closing.bean;
  return 'dongshan';
}
const nameOf = (id) => M.ITEMS[id]?.name || id;
export function hintOf(save, who) {
  const s = current(save, who);
  if (!s) return '';
  return typeof s.hint === 'function' ? s.hint(nameOf(lastBeanOf(save))) : s.hint;
}
export function isRight(save, who, drink, snack = M.withSnack(save)) {
  const s = current(save, who);
  return !!s && !!s.want({ drink, snack: !!snack, last: lastBeanOf(save) });
}

// 端一杯給熟客：記進存檔，回傳演出要用的東西；今天不能端（沒開放、今天已經收過）回傳 null
// { right, who, n, line 熟客那句, photo 照片 id（端對）, first 第一張照片, favorite 找到最愛（第三段）, hint 德叔更靠近的那句（端錯兩次以後） }
// keeper：凱文顧店時請他喝的那杯（錯兩次以後的提示改成凱文自己說的那句，KEEPER_FAV.hint）
export function serve(save, who, drink, day, t = 0, snack = M.withSnack(save), keeper = false) {
  if (!canServe(save, who, day) || !M.isDrink(drink)) return null;
  const f = favOf(save, who), s = current(save, who);
  f.servedDay = day;
  if (isRight(save, who, drink, snack)) {
    const id = `${who}-${s.n}`;
    if (!save.photos.some((p) => p.id === id)) save.photos.push({ id, day, t, item: drink, snack: !!snack });
    f.stage = s.n;
    f.misses = 0;
    return { right: true, who, n: s.n, line: s.ok, photo: id, first: save.photos.length === 1, favorite: !!s.favorite, hint: '' };
  }
  f.misses++;
  const pool = MISS[who];
  return { right: false, who, n: s.n, line: pool[(f.misses - 1) % pool.length], photo: null, first: false, favorite: false, hint: f.misses >= 2 ? (keeper && who === 'kevin' ? keeperHintOf(save) : hintOf(save, who)) : '' };
}

// 點熟客搭話的線索：這一段開放時，回傳那一段的句子（呼叫端決定多常用；沒有開放是空陣列）
export const clueLines = (save, who) => (isOpen(save, who) ? current(save, who).talk : []);
// 德叔在吧台說一次的線索：here＝在店裡、沒在演場景的熟客。回傳 { who, n, line } 或 null
export function pendingClue(save, here = []) {
  for (const who of FAV_IDS) {
    if (!here.includes(who) || !isOpen(save, who)) continue;
    const s = current(save, who);
    if ((favOf(save, who).told || 0) < s.n) return { who, n: s.n, line: s.deshu };
  }
  return null;
}
export function markClue(save, who, n) { const f = favOf(save, who); if (f) f.told = Math.max(f.told || 0, n); }

// 找到最愛（第三段）的熟客有幾位（溫度用，tasks.js 另外算一次，不 import 這個檔案）
export const favoritesFound = (save) => FAV_IDS.filter((w) => (favOf(save, w)?.stage || 0) >= STAGE_COUNT).length;

// 相簿：每位見過的熟客一頁，三格（拿到的照片＋還沒拿到的空格，Q77）；三段都找到的那一頁最後寫他的最愛
// 回傳 [{ who, slots: [{ id, n, file, got: { day, t, item } | null, caption、said（拿到才有） }], favorite: '' }]
export function album(save) {
  const out = [];
  for (const who of FAV_IDS) {
    if (!hasMilestone(save, who, 1)) continue; // 還沒見過的熟客不列（不劇透名字）
    const slots = STAGES[who].map((s) => {
      const id = `${who}-${s.n}`, got = (save.photos || []).find((p) => p.id === id) || null;
      return { id, n: s.n, file: `photo_${who}_${s.n}`, got, caption: got ? s.caption : '', said: got ? s.said || '' : '' };
    });
    const fav = (favOf(save, who)?.stage || 0) >= STAGE_COUNT;
    const last = slots[STAGE_COUNT - 1].got;
    const line = FAVORITE_LINE[who];
    out.push({ who, slots, favorite: fav ? (typeof line === 'function' ? line(nameOf(last?.item || lastBeanOf(save))) : line) : '' });
  }
  return out;
}

// 測試與校稿用：這個檔案裡所有玩家看得到的字
export function allFavoriteLines() {
  const out = [];
  for (const who of FAV_IDS) for (const s of STAGES[who]) out.push(...s.talk, s.deshu, s.ok, s.caption, ...(s.said ? [s.said] : []), typeof s.hint === 'function' ? s.hint('東山的豆') : s.hint);
  out.push(...Object.values(MISS).flat(), FAVORITE_LINE.yuan, FAVORITE_LINE.zhe, FAVORITE_LINE.kevin('東山的豆'));
  out.push(KEEPER_FAV.offer, KEEPER_FAV.ask, KEEPER_FAV.start, KEEPER_FAV.sit, KEEPER_FAV.back, ...KEEPER_FAV.clue.flat(), ...KEEPER_FAV.hint.map((h) => (typeof h === 'function' ? h('東山的豆') : h)));
  out.push(FAV_TEXT.offer('德叔', '予安'), FAV_TEXT.just, FAV_TEXT.ask('予安'), FAV_TEXT.cancel, FAV_TEXT.start, FAV_TEXT.firstPhoto, FAV_TEXT.album, FAV_TEXT.albumSub, FAV_TEXT.day(3), FAV_TEXT.close);
  return out;
}
