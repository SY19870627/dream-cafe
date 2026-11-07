// 試咖啡（承峰 11/5「先做試咖啡」D206／D207；11/5 夜重做：參數微調 → 登錄測試紀錄 → 定案寫入品項沖法）：
// - 老闆只在吧台座與德叔一起調：粉水比、水溫、研磨、技法（冰飲技法另開）；無失敗、無分數、不加溫度。
// - 沖完可「登錄」到測試紀錄（綁定目標品項）；記事本上「定為這支的沖法」才寫 brewProfile，新品才進菜單本／黑板。
// - 黑板只寫品名、不暗示調過（承峰）。劇情配方 kiln／zhe-new 保留解鎖節奏，改為預設參數。
// - 存檔第 10 版 save.tasting；舊第 9 版紀錄遷移為 legacy。純邏輯，不依賴 Three.js 或 DOM。
import { ITEMS, unlocked, onBoard, boardFull, unlock, write, replace, isDrink, bookItems } from './menu.js';
import { hasMilestone } from './story.js';

export const RECORDS_KEEP = 30;

// —— 參數檔位 ——
export const RATIOS = ['1:18', '1:16', '1:15', '1:14', '1:12'];
export const TEMPS = [88, 90, 92, 94, 96];
export const GRINDS = ['coarse', 'med-coarse', 'med', 'med-fine', 'fine'];
export const TECH_HOT = ['one-pour', 'pulse', 'center', 'bloom-long'];
export const TECH_ICE = ['ice-pour', 'ice-chill'];
export const TECH_ALL = [...TECH_HOT, ...TECH_ICE];

export const DEFAULT_PARAMS = { ratio: '1:15', temp: 92, grind: 'med', technique: 'pulse' };

// 劇情配方：解鎖節奏照舊；params 是第一次打開微調面板的預設
export const RECIPES = {
  kiln: {
    item: 'kiln', after: { who: 'yuan', n: 3 }, dish: true,
    params: { ratio: '1:16', temp: 90, grind: 'med', technique: 'bloom-long' },
    offer: '予安小姐說的龍眼窯，我想用粉和水慢慢調一杯。老闆，要不要一起試試？', // 【待定】
    served: '東山的豆，配窯烤的龍眼乾。煙是甜的，她說的。', // 【待定】
    line: '龍眼乾放在旁邊，咖啡喝起來就甜了。', // 【待定】
  },
  'zhe-new': {
    item: 'zhe-new', after: { who: 'zhe', n: 5 }, dish: false,
    params: { ratio: '1:15', temp: 94, grind: 'med-fine', technique: 'center' },
    offer: '阿哲那包新方法的豆子，還剩一點。老闆，粉水比和水溫我們可以慢慢調。', // 【待定】
    served: '阿哲的新方法。比較亮，像早上。', // 【待定】
    line: '酸是亮的，不刺。他阿公大概會說太年輕。', // 【待定】
  },
};
export const RECIPE_IDS = Object.keys(RECIPES);

export const TASTE = {
  together: '一起試一杯', // 【待定】吧台座點德叔
  just: '只是聊聊', // 【待定】
  yes: '一起調', // 【待定】德叔主動提時
  no: '下次再調', // 【待定】安全的放最下面
  later: '好。想調的時候，叫我一聲就好。', // 【待定】
  guide: '老闆，坐到吧台來。粉和水、水溫，我們可以慢慢調。', // 【待定】俯瞰引導
  offerHint: '撥一撥就好。沒有錯的沖法。', // 【待定】第一次打開微調面板
  recordsHelp: '粉水比、水溫、研磨、技法會記在這裡。老闆決定要不要定成那支的沖法。', // 【待定】
  title: '今天這杯怎麼沖', // 【待定】
  sub: '慢慢調。沒有錯的沖法。', // 【待定】
  pickItem: '登錄到哪一支', // 【待定】
  draft: '（試作中）', // 【待定】尚未進菜單本的劇情品
  brewNow: '請德叔依這組沖', // 【待定】
  cancelTune: '下次再調', // 【待定】
  start: '好，我試試看。', // 【待定】
  logTo: (name) => `登錄到「${name}」`, // 【待定】沖完
  logOnly: '登錄到試調紀錄', // 【待定】
  retune: '再調一版', // 【待定】
  skipLog: '先不登錄', // 【待定】最下面
  written: '我記在記事本的試調紀錄了。要不要定成那支的沖法，老闆決定。', // 【待定】
  hint: (name) => `「${name}」那組數字還在記事本裡。老闆想定成沖法，再定。`, // 【待定】
  settled: (name) => `好。「${name}」的沖法，我換成這一版了。`, // 【待定】已在菜單本
  settledBoard: (name) => `好。「${name}」寫上黑板了。沖法也是這一版。`, // 【待定】新品上黑板
  settledSame: (name) => `黑板還是寫「${name}」的名字，沖法我換成這一版。`, // 【待定】已在黑板
  section: '試調紀錄', // 【待定】
  settle: '定為這支的沖法', // 【待定】
  like: '喜歡', // 【待定】
  liked: '喜歡 ✓', // 【待定】
  settledOn: (day) => `第 ${day} 天定下來・沖法換成這一版`, // 【待定】
  dayLine: (day, part) => `開店第 ${day} 天・${part}・試調`, // 【待定】
  part: { day: '白天', night: '下班後', after: '打烊後' }, // 【待定】
  param: { ratio: '粉水比', temp: '水溫', grind: '研磨', technique: '技法' }, // 【待定】
  ratio: Object.fromEntries(RATIOS.map((r) => [r, `粉水 ${r}`])), // 【待定】
  temp: Object.fromEntries(TEMPS.map((t) => [String(t), `水溫 ${t}°C`])), // 【待定】
  tempIce: '水溫・冰', // 【待定】冰飲不顯示 °C
  grind: { coarse: '研磨・粗', 'med-coarse': '研磨・中粗', med: '研磨・中', 'med-fine': '研磨・中細', fine: '研磨・細' }, // 【待定】
  technique: {
    'one-pour': '技法・一刀流', pulse: '技法・分段注水', center: '技法・中心繞圈', 'bloom-long': '技法・悶蒸長一點',
    'ice-pour': '技法・冰手沖', 'ice-chill': '技法・冰鎮',
  }, // 【待定】
  flavorName: { acid: '酸', sweet: '甜', bitter: '苦' }, // 【待定】
  flavorWord: ['', '一點', '有', '很明顯'], // 【待定】
  profileLine: '店內沖法', // 【待定】菜單本小字
  defaultLine: '和店裡平常那杯差不多。穩。', // 【待定】
};

// 黑板上的便條（承峰 11/7：「便條紙直接貼上黑板好了」）：不做箭頭、不做發光，黑板右上角一直貼著一張德叔寫的便條，
// 點開是可以重複讀的說明（試咖啡怎麼開始、烘豆什麼時候烘）。這是「黑板不暗示調過」（承峰）之外的新例外：
// 便條只說怎麼開始，黑板上寫的品名照舊不暗示調過。不新增記事本頁面。
// 德叔提便條各一次（存檔 flags）：第一次坐吧台座、第一次打烊（最後一杯喝完以後）；還沒坐吧台座就點德叔想試，提醒先坐吧台（一次進店一次）
export const BOARD_NOTE = {
  title: '黑板上的便條', // 【待定】
  sub: '德叔寫的，一直貼著。', // 【待定】
  lines: [
    '老闆：', // 【待定】
    '新的配方會跟著店裡的故事慢慢開，不用急著找；有了，我先跟你說。', // 【待定】配方照劇情開放，便條不提前解鎖
    '有配方可以試的時候，先坐到吧台座，再叫我一聲。研磨、粉水比、水溫、技法，我們一項一項慢慢調，沒有錯的沖法。', // 【待定】
    '想烘豆，等打烊、最後一杯喝完以後，點門口右手邊角落那台大的烘豆機。淺一點、深一點，跟我說就好。', // 【待定】承峰 11/7 烘豆機搬到店門口右手邊那一角
    '不急。這張我一直貼著。', // 【待定】
  ],
  sign: '——德叔', // 【待定】
  close: '收起來', // 【待定】
  barHint: '老闆，黑板右上角那張便條是我寫的。想試新的沖法，看一下就知道。', // 【待定】第一次坐吧台座
  closeHint: '打烊以後也可以烘豆。怎麼烘，寫在黑板那張便條上。', // 【待定】第一次打烊、最後一杯喝完
  needBar: '想試新的沖法，先坐到吧台來。黑板上的便條有寫。', // 【待定】還沒坐吧台座就點德叔
};
const noteFlags = (save) => (save.flags && typeof save.flags === 'object' ? save.flags : (save.flags = {}));
// kind：'bar'（第一次坐吧台座）／'close'（第一次打烊）；提過就不再提
export const NOTE_FLAG = { bar: 'noteBarHint', close: 'noteCloseHint' };
export const noteHintDue = (save, kind) => !!NOTE_FLAG[kind] && !noteFlags(save)[NOTE_FLAG[kind]];
export function markNote(save, kind) { if (NOTE_FLAG[kind]) noteFlags(save)[NOTE_FLAG[kind]] = true; }
// 吧台座點德叔會出現「一起試一杯」：照原本的規則，德叔引導過或有配方照劇情開放了（againRecipes 是 openRecipes 的一部分）。
// 讀便條不會解鎖任何東西
export const tastingOpen = (save) => !!save.tasting?.guided || openRecipes(save).length > 0;

export const blankTasting = () => ({ trials: {}, records: [], nextId: 1, guided: false, offerHint: false });
const T = (save) => {
  if (!save.tasting || typeof save.tasting !== 'object') save.tasting = blankTasting();
  const ts = save.tasting;
  if (typeof ts.guided !== 'boolean') ts.guided = false;
  if (typeof ts.offerHint !== 'boolean') ts.offerHint = false;
  if (!Array.isArray(ts.records)) ts.records = [];
  if (!ts.trials || typeof ts.trials !== 'object') ts.trials = {};
  if (!Number.isFinite(ts.nextId)) ts.nextId = 1;
  return ts;
};
export const markGuided = (save) => { T(save).guided = true; };
export const markOfferHint = (save) => { T(save).offerHint = true; };

export const recipeOpen = (save, id) => !!RECIPES[id] && hasMilestone(save, RECIPES[id].after.who, RECIPES[id].after.n);
export const openRecipes = (save) => RECIPE_IDS.filter((id) => recipeOpen(save, id));
export const pendingOffer = (save) => openRecipes(save).find((id) => !T(save).trials[id]?.offered) || null;
export function markOffered(save, id, day) {
  const tr = T(save).trials;
  tr[id] = { offered: day, tried: tr[id]?.tried || 0, ...tr[id] };
  if (!tr[id].offered) tr[id].offered = day;
}
export const againRecipes = (save) => openRecipes(save).filter((id) => T(save).trials[id]?.offered);
export const recipeName = (id) => ITEMS[RECIPES[id]?.item]?.name || '';

export const isIceItem = (id) => ITEMS[id]?.cup === 'iced';

export function normalizeParams(raw = {}, item = 'dongshan') {
  const ice = isIceItem(item);
  const ratio = RATIOS.includes(raw.ratio) ? raw.ratio : DEFAULT_PARAMS.ratio;
  const grind = GRINDS.includes(raw.grind) ? raw.grind : DEFAULT_PARAMS.grind;
  let technique = TECH_ALL.includes(raw.technique) ? raw.technique : DEFAULT_PARAMS.technique;
  if (ice && !TECH_ICE.includes(technique)) technique = 'ice-pour';
  if (!ice && TECH_ICE.includes(technique)) technique = 'pulse';
  let temp = Number(raw.temp);
  if (ice) temp = 0;
  else if (!TEMPS.includes(temp)) temp = DEFAULT_PARAMS.temp;
  return { ratio, temp, grind, technique };
}

export function defaultParamsFor(item, recipeId = null) {
  if (recipeId && RECIPES[recipeId]) return normalizeParams(RECIPES[recipeId].params, RECIPES[recipeId].item);
  if (item && ITEMS[item]?.brewDefault) return normalizeParams(ITEMS[item].brewDefault, item);
  return normalizeParams(DEFAULT_PARAMS, item || 'dongshan');
}

export function techniquesFor(item) {
  return isIceItem(item) ? [...TECH_ICE] : [...TECH_HOT];
}

// 可登錄的品項：菜單本已解鎖的喝的 + 已開放尚未進菜單本的劇情試作
export function tuneItems(save) {
  const out = [];
  for (const id of bookItems(save)) if (isDrink(id)) out.push({ id, draft: false });
  for (const rid of openRecipes(save)) {
    const item = RECIPES[rid].item;
    if (!unlocked(save, item) && !out.some((x) => x.id === item)) out.push({ id: item, draft: true, recipe: rid });
  }
  return out;
}

export function labelParam(key, val, item) {
  if (key === 'temp' && (isIceItem(item) || val === 0)) return TASTE.tempIce;
  if (key === 'ratio') return TASTE.ratio[val] || String(val);
  if (key === 'temp') return TASTE.temp[String(val)] || `水溫 ${val}°C`;
  if (key === 'grind') return TASTE.grind[val] || String(val);
  if (key === 'technique') return TASTE.technique[val] || String(val);
  return String(val);
}

export function paramsSummary(params, item) {
  const p = normalizeParams(params, item);
  return ['ratio', 'temp', 'grind', 'technique'].map((k) => labelParam(k, p[k], item)).join('・');
}

// 口感：檔位指數加權 → 1～3，無分數、無失敗
export function flavorFromParams(params, item = 'dongshan') {
  const p = normalizeParams(params, item);
  const ri = RATIOS.indexOf(p.ratio); // 0 稀 → 4 濃
  const gi = GRINDS.indexOf(p.grind); // 0 粗 → 4 細
  const ti = isIceItem(item) ? 2 : TEMPS.indexOf(p.temp); // 0 低 → 4 高
  const tech = p.technique;
  let acid = 2, sweet = 2, bitter = 2;
  acid += (gi >= 3 ? 1 : 0) + (ti >= 3 ? 1 : 0) + (ri <= 1 ? 1 : 0) - (ri >= 3 ? 1 : 0);
  sweet += (ri >= 3 ? 1 : 0) + (gi <= 1 ? 1 : 0) + (tech === 'bloom-long' ? 1 : 0) - (ti >= 4 ? 1 : 0);
  bitter += (ri >= 3 ? 1 : 0) + (gi >= 3 ? 1 : 0) + (ti <= 1 ? 1 : 0) - (ri <= 1 ? 1 : 0);
  if (tech === 'ice-chill') { acid = Math.max(1, acid - 1); sweet += 1; }
  if (tech === 'one-pour') bitter += 1;
  const clamp = (n) => Math.max(1, Math.min(3, Math.round(n)));
  return { acid: clamp(acid), sweet: clamp(sweet), bitter: clamp(bitter) };
}

export function lineFromParams(params, item = 'dongshan', recipeId = null) {
  const p = normalizeParams(params, item);
  const d = defaultParamsFor(item, recipeId);
  if (p.ratio === d.ratio && p.temp === d.temp && p.grind === d.grind && p.technique === d.technique) {
    return recipeId && RECIPES[recipeId]?.line ? RECIPES[recipeId].line : TASTE.defaultLine;
  }
  const f = flavorFromParams(p, item);
  const bits = [];
  if (f.acid >= 3) bits.push('亮一點'); // 【待定】拼句用字
  else if (f.acid <= 1) bits.push('酸收著');
  if (f.sweet >= 3) bits.push('甜在中間');
  if (f.bitter >= 3) bits.push('尾巴有一點厚');
  else if (f.bitter <= 1) bits.push('尾段乾淨');
  if (RATIOS.indexOf(p.ratio) <= 1) bits.push('還可以再濃一點');
  else if (RATIOS.indexOf(p.ratio) >= 3) bits.push('再淡一點也許會打開');
  if (bits.length < 2 && TEMPS.indexOf(p.temp) >= 3) bits.push('水溫偏熱，香氣先出來');
  if (bits.length < 2 && GRINDS.indexOf(p.grind) >= 3) bits.push('磨得細，層次比較近');
  const body = bits.slice(0, 2).join('，') || '味道穩';
  if (recipeId === 'kiln') return `${body}。龍眼乾在旁邊，甜會再靠過來一點。`; // 【待定】
  if (recipeId === 'zhe-new') return `${body}。新方法的豆，酸是亮的。`; // 【待定】
  return `${body}。`; // 【待定】
}

function trimRecords(ts) {
  while (ts.records.length > RECORDS_KEEP) {
    const i = ts.records.findIndex((x) => !x.settled);
    if (i < 0) break;
    ts.records.splice(i, 1);
  }
}

// 登錄：寫測試紀錄（尚未改菜單本／黑板／brewProfile）
export function addTuneRecord(save, { item, recipe = null, params, day = 1, t = 0, part = 'day', legacy = false } = {}) {
  if (!ITEMS[item] || !isDrink(item)) return null;
  const ts = T(save);
  const p = normalizeParams(params, item);
  const flavor = flavorFromParams(p, item);
  const line = lineFromParams(p, item, recipe);
  if (recipe && RECIPES[recipe]) {
    markOffered(save, recipe, day);
    if (!ts.trials[recipe].tried) ts.trials[recipe].tried = day;
  }
  const dish = !!(RECIPES[recipe]?.dish || ITEMS[item]?.dish);
  const rec = {
    id: ts.nextId++, day, t, part, src: 'tune', recipe: recipe || null,
    item, params: p, flavor, line, dish, liked: false, settled: 0, told: false, legacy: !!legacy,
    // 相容舊讀法：cups[0].item
    cups: [{ item, base: item, level: 'usual', brew: isIceItem(item) ? 'iced' : 'hot', dish, flavor: { ...flavor }, line, params: p }],
  };
  ts.records.push(rec);
  trimRecords(ts);
  return rec;
}

// 舊 D206 一鍵試做：仍可用於遷移／測試，轉成帶預設參數的紀錄
export function addRecord(save, id, day = 1, t = 0, part = 'day') {
  const r = RECIPES[id];
  if (!r) return null;
  return addTuneRecord(save, { item: r.item, recipe: id, params: r.params, day, t, part });
}

export const recordById = (save, rid) => T(save).records.find((r) => r.id === rid) || null;
export const recordsNewest = (save) => [...T(save).records].reverse();
export function toggleLike(save, rid) {
  const r = recordById(save, rid);
  if (!r) return false;
  r.liked = !r.liked;
  return r.liked;
}

export function recordItem(rec) {
  return rec?.item || rec?.cups?.[0]?.item || '';
}

export function recordLines(rec) {
  const item = recordItem(rec);
  const p = rec.params || rec.cups?.[0]?.params || DEFAULT_PARAMS;
  const fl = rec.flavor || rec.cups?.[0]?.flavor || { acid: 2, sweet: 2, bitter: 2 };
  const flTxt = ['acid', 'sweet', 'bitter'].map((k) => `${TASTE.flavorName[k]}：${TASTE.flavorWord[fl[k]] || ''}`).join('・');
  return {
    head: TASTE.dayLine(rec.day, TASTE.part[rec.part] || TASTE.part.day),
    name: ITEMS[item]?.name || '',
    bean: paramsSummary(p, item),
    brew: rec.dish ? '附一小碟龍眼乾' : '', // 【待定】短註
    flavor: flTxt,
    line: `「${rec.line || rec.cups?.[0]?.line || ''}」`,
    settled: rec.settled ? TASTE.settledOn(rec.settled) : '',
  };
}

export function applyBrewProfile(save, item, params) {
  if (!save.menu?.items?.[item]) return false;
  save.menu.items[item].brewProfile = normalizeParams(params, item);
  return true;
}

export function brewProfileOf(save, item) {
  return save.menu?.items?.[item]?.brewProfile || null;
}

// 定案：寫入 brewProfile；新品則收進菜單本並寫上黑板
// 回傳 'done' | 'full' | 'profile'（只更新沖法、已在菜單本） | ''
export function settle(save, rid, day = 1, t = 0, out = null) {
  const rec = recordById(save, rid);
  if (!rec || rec.settled) return '';
  const item = recordItem(rec);
  if (!ITEMS[item]) return '';
  const params = normalizeParams(rec.params || rec.cups?.[0]?.params, item);
  const wasUnlocked = unlocked(save, item);
  const wasBoard = onBoard(save, item);
  if (!wasUnlocked) {
    unlock(save, item, day, t, { from: rec.recipe ? `trial:${rec.recipe}` : 'tune', board: false });
    const it = save.menu.items[item];
    it.told = true;
    it.seen = true;
    it.record = rec.id;
  }
  applyBrewProfile(save, item, params);
  if (!onBoard(save, item)) {
    if (out) { if (!replace(save, out, item, day)) return ''; }
    else if (boardFull(save)) return 'full';
    else if (!write(save, item, day)) return '';
  }
  rec.settled = day;
  rec.told = true;
  if (wasUnlocked && wasBoard) return 'profile';
  if (wasUnlocked) return 'done';
  return 'done';
}

export function cancelSettle(save, rid) {
  const rec = recordById(save, rid);
  if (!rec || rec.settled) return false;
  const item = recordItem(rec);
  const it = save.menu.items[item];
  if (!it || it.record !== rec.id || onBoard(save, item)) return false;
  delete save.menu.items[item];
  return true;
}

export function pendingHint(save, day) {
  const list = T(save).records.filter((r) => !r.settled && !r.told && r.day < day);
  return list.length ? list[list.length - 1] : null;
}
export function markHinted(save, day) {
  for (const r of T(save).records) if (!r.settled && r.day < day) r.told = true;
}

// 第 9 → 10：舊紀錄補 params／item，已定案的寫入 brewProfile 預設
export function migrateTastingToV10(save) {
  const ts = T(save);
  for (const rec of ts.records) {
    const item = recordItem(rec);
    if (!rec.item) rec.item = item;
    if (!rec.params) {
      const preset = rec.recipe && RECIPES[rec.recipe] ? RECIPES[rec.recipe].params : DEFAULT_PARAMS;
      rec.params = normalizeParams(preset, item);
      rec.legacy = true;
    } else rec.params = normalizeParams(rec.params, item);
    if (!rec.flavor) rec.flavor = flavorFromParams(rec.params, item);
    if (!rec.line) rec.line = rec.cups?.[0]?.line || lineFromParams(rec.params, item, rec.recipe);
    if (rec.settled && item && unlocked(save, item) && !save.menu.items[item].brewProfile) {
      applyBrewProfile(save, item, rec.params);
    }
  }
  return ts;
}

export function allTastingLines() {
  const out = [];
  for (const r of Object.values(RECIPES)) out.push(r.offer, r.served, r.line);
  for (const v of Object.values(TASTE)) {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') out.push(v.length >= 2 ? v(1, '白天') : v('龍眼窯特調'));
    else if (Array.isArray(v)) out.push(...v.filter(Boolean));
    else out.push(...Object.values(v));
  }
  for (const v of Object.values(BOARD_NOTE)) out.push(...(Array.isArray(v) ? v : [v]));
  out.push('亮一點', '酸收著', '甜在中間', '尾巴有一點厚', '尾段乾淨', '還可以再濃一點', '再淡一點也許會打開', '水溫偏熱，香氣先出來', '磨得細，層次比較近', '味道穩');
  return out;
}
