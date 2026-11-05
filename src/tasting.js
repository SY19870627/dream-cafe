// 試咖啡（承峰 11/5：「先做試咖啡」，D206；提案《一天的份量》第三節第 5 點最小版＋第 7 點「測試紀錄 → 定案 → 每日菜單」）：
// - 配方只從劇情長出來（D185）：熟客的某個里程碑發生以後，德叔在店裡安靜時提一次「想試一杯新的」，老闆坐著才提。
//   老闆說好，德叔試做一杯、端過來；做完程式自動寫一張「測試紀錄」（老闆不用打字），收在記事本「測試紀錄」一段。
//   之後坐著點德叔，可以請他再試一杯（每一杯都是新的一張紀錄）。
// - 定案：老闆在紀錄上按「定案」→ 收進菜單本並寫上黑板（每日菜單就是黑板，承峰 11/5，D207）；黑板寫滿走菜單本現有的「換一行」，
//   最後一杯喝的擦不掉、德叔只照黑板沖、阿哲第六幕的「之後再說」都照舊（menu.js 的 write()／replace()，規則不改）。
//   不定案也沒關係，紀錄留著，之後隨時可以定。
// - 黑板沿用昨天（不每天清空）；有新的、還沒定案的紀錄時，德叔隔天在店裡安靜時提一次（一張紀錄最多提一次，不催）。
// - 沒有失敗、沒有計時、不加溫度、不進任務、不碰熟客最愛的三段（試做那杯不算「老闆最近一次喝的那杯」）。
// 存檔 save.tasting（第 9 版），見 blankTasting()。台詞與 UI 文字都是自行補寫的（每一句都標了待定）。純邏輯，不依賴 Three.js 或 DOM。
import { ITEMS, unlocked, onBoard, boardFull, unlock, write, replace } from './menu.js';
import { hasMilestone } from './story.js';

export const RECORDS_KEEP = 30; // 存檔裡最多留幾張紀錄（定案過的不刪）

// 劇情配方：item 是定案後收進菜單本的品項（menu.js 的 ITEMS），after 是哪個里程碑之後開放
//   base：用哪一支豆、level：烘焙度（還沒有烘豆，都是德叔平常的）、brew：沖法、dish：附一小碟龍眼乾
//   flavor：酸、甜、苦（1 一點／2 有／3 很明顯；是描述不是分數，固定的，同一杯每次一樣）
//   offer：德叔第一次提的那句；served：端上桌時說的；line：記在紀錄上的德叔一句
export const RECIPES = {
  kiln: { item: 'kiln', after: { who: 'yuan', n: 3 }, base: 'dongshan', level: 'usual', brew: 'hot', dish: true,
    flavor: { acid: 1, sweet: 3, bitter: 2 },
    offer: '予安小姐說的龍眼窯，我一直在想。老闆，我想試一杯新的，要不要喝喝看？', // 【待定】
    served: '東山的豆，配窯烤的龍眼乾。煙是甜的，她說的。', // 【待定】
    line: '龍眼乾放在旁邊，咖啡喝起來就甜了。', // 【待定】
  },
  'zhe-new': { item: 'zhe-new', after: { who: 'zhe', n: 5 }, base: 'zhe', level: 'usual', brew: 'hot', dish: false,
    flavor: { acid: 3, sweet: 2, bitter: 1 },
    offer: '阿哲那包新方法的豆子，還剩一點。老闆，我想單獨沖一杯試試，要不要喝喝看？', // 【待定】
    served: '阿哲的新方法。比較亮，像早上。', // 【待定】
    line: '酸是亮的，不刺。他阿公大概會說太年輕。', // 【待定】
  },
};
export const RECIPE_IDS = Object.keys(RECIPES);

// 試咖啡與紀錄的文字（每一句都標了待定）
export const TASTE = {
  yes: '喝喝看', // 【待定】
  no: '下次吧', // 【待定】安全的放最下面
  later: '好。想喝的時候，點我一聲就好。', // 【待定】選「下次吧」（試咖啡教學）
  guide: '老闆，坐下來。我想試一杯新的，跟你說一聲。', // 【待定】配方剛開放、老闆還站著時德叔提一次
  offerHint: '坐著等德叔提；或之後點德叔，請他再試。', // 【待定】第一次出現選項時底部提示
  recordsHelp: '德叔試做的杯子會記在這裡。老闆決定要不要寫上黑板。', // 【待定】記事本測試紀錄空狀態／第一張旁
  again: (name) => `請德叔再試一杯「${name}」`, // 【待定】坐著點德叔
  just: '只是聊聊', // 【待定】
  start: '好，我試試看。', // 【待定】
  written: '我記在記事本的測試紀錄了。要不要寫上黑板，老闆決定。', // 【待定】端上桌以後
  hint: (name) => `那杯${name}，紀錄還在記事本裡。老闆想寫上黑板，再寫。`, // 【待定】隔天提一次
  settled: (name) => `好。${name}，我寫上黑板了。`, // 【待定】定案以後
  section: '測試紀錄', // 【待定】記事本一段的標題
  settle: '定案', // 【待定】
  like: '喜歡', // 【待定】
  liked: '喜歡 ✓', // 【待定】
  settledOn: (day) => `第 ${day} 天定案・寫上黑板`, // 【待定】
  dayLine: (day, part) => `開店第 ${day} 天・${part}・試做`, // 【待定】
  part: { day: '白天', night: '下班後', after: '打烊後' }, // 【待定】
  bean: { dongshan: '東山的豆', zhe: '阿哲新方法的那一包' }, // 【待定】
  level: { usual: '德叔平常的烘焙' }, // 【待定】
  brew: { hot: '手沖・熱的', iced: '手沖・冰的' }, // 【待定】
  dish: '附一小碟龍眼乾', // 【待定】
  flavorName: { acid: '酸', sweet: '甜', bitter: '苦' }, // 【待定】
  flavorWord: ['', '一點', '有', '很明顯'], // 【待定】
};

// 存檔 save.tasting（第 9 版；教學旗標 guided／offerHint 是附加欄位，舊存檔讀進來補預設，不升版）：
//   trials：{ [配方 id]: { offered 德叔第一次提是第幾天（0＝還沒提）, tried 第一次試做是第幾天 } }
//   records：測試紀錄 [{ id, day, t, part: 'day' | 'night' | 'after', src: 'trial', recipe,
//            cups: [{ item, base, level, brew, dish, flavor: { acid, sweet, bitter }, line }], liked 老闆標了喜歡, settled 第幾天定案（0＝還沒）, told 德叔提過了 }]
//   nextId：下一張紀錄的編號
//   guided：德叔說過「坐下來……試一杯新的」引導（一次）；offerHint：第一次 offer 底部提示已顯示
export const blankTasting = () => ({ trials: {}, records: [], nextId: 1, guided: false, offerHint: false });
const T = (save) => {
  if (!save.tasting || typeof save.tasting !== 'object') save.tasting = blankTasting();
  const ts = save.tasting;
  if (typeof ts.guided !== 'boolean') ts.guided = false;
  if (typeof ts.offerHint !== 'boolean') ts.offerHint = false;
  return ts;
};
export const markGuided = (save) => { T(save).guided = true; };
export const markOfferHint = (save) => { T(save).offerHint = true; };

// 這個配方開放了沒（里程碑發生過）
export const recipeOpen = (save, id) => !!RECIPES[id] && hasMilestone(save, RECIPES[id].after.who, RECIPES[id].after.n);
export const openRecipes = (save) => RECIPE_IDS.filter((id) => recipeOpen(save, id));
// 德叔還沒提過的配方（店裡安靜、老闆坐著時提一次）
export const pendingOffer = (save) => openRecipes(save).find((id) => !T(save).trials[id]?.offered) || null;
export function markOffered(save, id, day) {
  const tr = T(save).trials;
  tr[id] = { offered: day, tried: 0, ...tr[id] };
  if (!tr[id].offered) tr[id].offered = day;
}
// 坐著點德叔，可以請他再試一杯：提過的配方
export const againRecipes = (save) => openRecipes(save).filter((id) => T(save).trials[id]?.offered);
export const recipeName = (id) => ITEMS[RECIPES[id]?.item]?.name || '';

// 試做完：寫一張紀錄（全部由程式產生）。回傳那張紀錄
export function addRecord(save, id, day = 1, t = 0, part = 'day') {
  const r = RECIPES[id];
  if (!r) return null;
  const ts = T(save);
  markOffered(save, id, day);
  if (!ts.trials[id].tried) ts.trials[id].tried = day;
  const rec = { id: ts.nextId++, day, t, part, src: 'trial', recipe: id,
    cups: [{ item: r.item, base: r.base, level: r.level, brew: r.brew, dish: !!r.dish, flavor: { ...r.flavor }, line: r.line }],
    liked: false, settled: 0, told: false };
  ts.records.push(rec);
  // 最多留 RECORDS_KEEP 張：從最舊、沒定案的開始刪
  while (ts.records.length > RECORDS_KEEP) {
    const i = ts.records.findIndex((x) => !x.settled);
    if (i < 0) break;
    ts.records.splice(i, 1);
  }
  return rec;
}
export const recordById = (save, rid) => T(save).records.find((r) => r.id === rid) || null;
// 記事本裡的順序：新的在上面
export const recordsNewest = (save) => [...T(save).records].reverse();
export function toggleLike(save, rid) {
  const r = recordById(save, rid);
  if (!r) return false;
  r.liked = !r.liked;
  return r.liked;
}

// 紀錄上的幾行字（UI 文字，不畫在圖上：D202）
export function recordLines(rec) {
  const c = rec.cups[0];
  const fl = ['acid', 'sweet', 'bitter'].map((k) => `${TASTE.flavorName[k]}：${TASTE.flavorWord[c.flavor[k]] || ''}`).join('・');
  return {
    head: TASTE.dayLine(rec.day, TASTE.part[rec.part] || TASTE.part.day),
    name: ITEMS[c.item]?.name || '',
    bean: [TASTE.bean[c.base], TASTE.level[c.level]].filter(Boolean).join('・'),
    brew: [TASTE.brew[c.brew], c.dish ? TASTE.dish : ''].filter(Boolean).join('・'),
    flavor: fl,
    line: `「${c.line}」`,
    settled: rec.settled ? TASTE.settledOn(rec.settled) : '',
  };
}

// 定案：收進菜單本並寫上黑板。out：黑板寫滿時要換掉的那一行（菜單本的「換一行」選的）。
// 回傳 'done'（寫上黑板了）、'full'（黑板寫滿了，要先選換掉哪一行；品項已經收進菜單本）、'' （不行）
export function settle(save, rid, day = 1, t = 0, out = null) {
  const rec = recordById(save, rid);
  if (!rec) return '';
  const item = rec.cups[0].item;
  if (!ITEMS[item]) return '';
  if (!unlocked(save, item)) {
    unlock(save, item, day, t, { from: `trial:${rec.recipe}`, board: false });
    const it = save.menu.items[item];
    it.told = true; // 老闆自己定的，德叔不用再提「記進菜單本了」
    it.seen = true;
    it.record = rec.id;
  }
  if (!onBoard(save, item)) {
    if (out) { if (!replace(save, out, item, day)) return ''; }
    else if (boardFull(save)) return 'full';
    else if (!write(save, item, day)) return '';
  }
  rec.settled = day;
  rec.told = true;
  return 'done';
}
// 黑板寫滿、老闆按了「先不寫」：剛剛為了定案才收進菜單本的品項拿掉（還沒定案就不出現在菜單本）
export function cancelSettle(save, rid) {
  const rec = recordById(save, rid);
  if (!rec || rec.settled) return false;
  const item = rec.cups[0].item;
  const it = save.menu.items[item];
  if (!it || it.record !== rec.id || onBoard(save, item)) return false;
  delete save.menu.items[item];
  return true;
}

// 德叔提一次：還沒定案、還沒提過、不是今天才做的紀錄（黑板沿用昨天，有新紀錄時隔天提一次）。回傳最新的那張或 null
export function pendingHint(save, day) {
  const list = T(save).records.filter((r) => !r.settled && !r.told && r.day < day && !onBoard(save, r.cups[0].item));
  return list.length ? list[list.length - 1] : null;
}
// 提過了：同時把其他還沒提過的也標起來（一張紀錄最多提一次，也不一張一張催）
export function markHinted(save, day) {
  for (const r of T(save).records) if (!r.settled && r.day < day) r.told = true;
}

// 測試與校稿用：這個檔案裡所有玩家看得到的字
export function allTastingLines() {
  const out = [];
  for (const r of Object.values(RECIPES)) out.push(r.offer, r.served, r.line);
  for (const v of Object.values(TASTE)) {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') out.push(v.length >= 2 ? v(1, '白天') : v('龍眼窯特調'));
    else if (Array.isArray(v)) out.push(...v.filter(Boolean));
    else out.push(...Object.values(v));
  }
  return out;
}
