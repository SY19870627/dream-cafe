// 咖啡三步組合（豆子 → 沖法 → 加一味）與標籤；菜單板格子與招牌。
// 純邏輯，用 node --test 測試。不定價、不算成本。

export const BEANS = {
  dongshan: { name: '東山日曬', short: '東山', tag: '果酸' },
  gukeng: { name: '古坑水洗', short: '古坑', tag: '堅果' },
};
export const BREWS = {
  pour: { name: '手沖', tag: '乾淨', temp: '熱' },
  cold: { name: '冰滴', tag: '清爽', temp: '冰' },
};
export const ADDS = {
  none: { name: '不加', tags: [] },
  milk: { name: '鮮奶', tags: ['奶香'] },
  honey: { name: '龍眼蜜', tags: ['甜', '在地'] },
};

// 不完美的組合：照樣能上菜單，只是有客人會覺得怪怪的
export const WEIRD = [
  { bean: 'dongshan', add: 'milk', why: '日曬的果酸碰上鮮奶' },
];

export const MENU_SLOTS = 3;

// 德叔的那杯（開場第一杯）。by: 'deshu' 代表不是玩家設計的
export const DESHU_CUP = Object.freeze({ bean: 'dongshan', brew: 'pour', add: 'none', name: '東山的豆', by: 'deshu' });

export function initialMenu() {
  return { slots: [{ ...DESHU_CUP }, null, null], signature: 0 };
}

// 顯示用的風味標籤
export function tagsOf(r) {
  return [BEANS[r.bean].tag, BREWS[r.brew].tag, ...ADDS[r.add].tags];
}

// 比對客人口味用的關鍵字：風味標籤＋沖法＋冷熱＋「不加」
export function keysOf(r) {
  const k = new Set(tagsOf(r));
  k.add(BREWS[r.brew].name);
  k.add(BREWS[r.brew].temp);
  if (r.add === 'none') k.add('不加');
  return k;
}

export function weirdness(r) {
  return WEIRD.find((w) => w.bean === r.bean && w.add === r.add) || null;
}

export function defaultName(r) {
  const add = r.add === 'none' ? '' : `加${ADDS[r.add].name}`;
  return `${BEANS[r.bean].short}${BREWS[r.brew].name}${add}`;
}

export function makeRecipe(bean, brew, add, name = '') {
  if (!BEANS[bean] || !BREWS[brew] || !ADDS[add]) throw new Error(`沒有這個組合：${bean}/${brew}/${add}`);
  const r = { bean, brew, add, by: 'player' };
  r.name = (name || '').trim().slice(0, 10) || defaultName(r);
  return r;
}

// 菜單上有的品項：[{ slot, recipe }]
export function menuItems(menu) {
  return menu.slots.map((recipe, slot) => ({ slot, recipe })).filter((m) => m.recipe);
}

export function setSlot(menu, slot, recipe) {
  if (slot < 0 || slot >= MENU_SLOTS) throw new Error('菜單板沒有這一格');
  const slots = menu.slots.slice();
  slots[slot] = recipe;
  let signature = menu.signature;
  if (!recipe && signature === slot) signature = slots.findIndex(Boolean);
  if (signature < 0 || signature === null) signature = slots.findIndex(Boolean);
  return { slots, signature: signature < 0 ? null : signature };
}

export function setSignature(menu, slot) {
  if (!menu.slots[slot]) return menu;
  return { ...menu, signature: slot };
}

export const signatureRecipe = (menu) => (menu.signature == null ? null : menu.slots[menu.signature] || null);
export const signatureIsPlayers = (menu) => signatureRecipe(menu)?.by === 'player';

// 這杯對某種口味（關鍵字陣列）合幾樣
export function matchScore(r, taste) {
  const k = keysOf(r);
  return taste.reduce((n, t) => n + (k.has(t) ? 1 : 0), 0);
}

export function menuKey(menu) {
  return menu.slots.map((r) => (r ? `${r.bean}/${r.brew}/${r.add}/${r.by}` : '-')).join('|') + `#${menu.signature}`;
}
