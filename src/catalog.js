// 德叔的型錄：可以買的擺飾與家具，以及買東西、擺東西的純邏輯。
// 錢只用來買家具與擺飾，擺放永遠免費；試擺不扣錢，按「確定」才算數。
// 價格依劇本「節奏設定」：小擺飾 300～800 元、家具 1,500～5,000 元、大件約 1 萬元。
// 純邏輯，不依賴 Three.js 或 DOM。

export const CATEGORY = { small: '小擺飾', furniture: '家具', large: '大件' };

// art：src/art.js 裡的同名繪圖函式；books：算進「第一面書牆」的份量；
// wall：背面要靠牆的東西，放在牆邊會自動貼牆、轉向室內。
// 【待定】每件擺飾的一句說明（desc）都是自行補寫的
export const CATALOG = [
  { id: 'plant', name: '盆栽', cat: 'small', price: 400, art: 'plant', desc: '葉子很大，會跟著窗外的光轉。' },
  { id: 'menu-board', name: '黑板立牌', cat: 'small', price: 500, art: 'menuBoard', desc: '「不限時，慢慢等。」' },
  { id: 'longan-jar', name: '龍眼乾玻璃罐', cat: 'small', price: 300, art: 'longanJar', desc: '東山的龍眼乾，裝在老玻璃罐裡。' },
  { id: 'succulent', name: '小花架', cat: 'small', price: 300, art: 'succulent', desc: '三盆多肉，不太需要人照顧。' },
  { id: 'book-stack', name: '一疊舊書', cat: 'small', price: 400, art: 'bookStack', desc: '書頁有點黃，翻起來有聲音。' },
  { id: 'coffee-sack', name: '咖啡麻布袋', cat: 'small', price: 500, art: 'coffeeSack', desc: '印著「東山」兩個字的生豆袋。' },
  { id: 'cat-cushion', name: '貓咪軟墊', cat: 'small', price: 500, art: 'catCushion', desc: '龍眼不一定會睡，但也不一定不會。' },
  { id: 'easel', name: '畫架・東山的山', cat: 'small', price: 600, art: 'easel', desc: '畫的是窗外那片山，畫得不太像。' },
  { id: 'radio', name: '老收音機', cat: 'small', price: 800, art: 'radio', desc: '只收得到一個台，剛好是老歌。' },
  { id: 'floor-lamp', name: '落地燈', cat: 'furniture', price: 1500, art: 'floorLamp', light: true, desc: '晚上會亮，2700K 的黃光。' },
  { id: 'cabinet', name: '老碗櫥', cat: 'furniture', price: 2000, art: 'cabinet', wall: true, desc: '玻璃門後面放著不成套的杯子。' },
  { id: 'bookshelf', name: '書櫃', cat: 'furniture', price: 2500, art: 'bookshelf', wall: true, books: 1, desc: '一櫃書。三櫃排在一起，就是一面書牆。' },
  { id: 'record-player', name: '黑膠唱機', cat: 'furniture', price: 3000, art: 'recordPlayer', wall: true, desc: '轉速有點慢，聽起來剛好。' },
  { id: 'cat-tree', name: '貓跳台', cat: 'furniture', price: 3500, art: 'catTree', desc: '最上面那層，是給龍眼看窗外的。' },
  { id: 'rattan-chair', name: '藤編搖椅', cat: 'furniture', price: 4000, art: 'rattanChair', desc: '坐下去會輕輕晃，不適合趕時間的人。' },
  { id: 'book-wall', name: '整面書牆', cat: 'large', price: 10000, art: 'bookWall', wall: true, books: 3, desc: '從地板到天花板，一整面牆的書。' },
];

const BY_ID = new Map(CATALOG.map((i) => [i.id, i]));
export const itemById = (id) => BY_ID.get(id);

// 德叔送的三件初始擺飾（劇本第四幕「送三件初始擺飾」），由 save.js 的 giveStarters() 在開場第四幕送出
export const STARTER_ITEMS = ['plant', 'floor-lamp', 'menu-board'];

// 基金餘額＝帳本加總（撥款為正、購買為負）
export function balance(save) {
  return save.fund.ledger.reduce((s, e) => s + e.amount, 0);
}

export const placedItems = (save) => save.owned.filter((o) => o.placed);
export const storedItems = (save) => save.owned.filter((o) => !o.placed);

// 店裡擺了幾件書（書櫃 1、整面書牆 3），≥ 3 就算「第一面書牆」
export function bookCount(owned) {
  return owned.filter((o) => o.placed).reduce((s, o) => s + (itemById(o.item)?.books || 0), 0);
}

// 把佈置模式裡的工作清單寫回存檔。
// layout：[{ uid?, item, placed, x, z, trial }]；trial 是試擺中、還沒買的東西。
// 試擺的東西依擺上去的順序結帳，基金夠就帶回來；不夠的退回型錄（不出現「餘額不足」字眼，由德叔一句話帶過）。
// 回傳 { bought: [品項 id], returned: [品項 id], spent, changed }
export function commitLayout(save, layout, now) {
  const result = { bought: [], returned: [], spent: 0, changed: false };
  let left = balance(save);
  const before = JSON.stringify(save.owned);
  const owned = [];
  for (const e of layout) {
    if (!e.trial) {
      const o = save.owned.find((x) => x.uid === e.uid);
      if (!o) continue;
      owned.push({ ...o, placed: !!e.placed, x: e.x, z: e.z });
      continue;
    }
    const item = itemById(e.item);
    if (!item) continue;
    if (item.price > left) { result.returned.push(item.id); continue; }
    left -= item.price;
    result.spent += item.price;
    result.bought.push(item.id);
    const uid = save.nextUid++;
    owned.push({ uid, item: item.id, placed: true, x: e.x, z: e.z });
    save.fund.ledger.push({ t: now, kind: 'buy', ref: item.id, amount: -item.price });
  }
  // 工作清單裡沒列到的已擁有物品（理論上不會發生）原樣保留，避免東西憑空消失
  for (const o of save.owned) if (!owned.some((x) => x.uid === o.uid)) owned.push(o);
  owned.sort((a, b) => a.uid - b.uid);
  save.owned = owned;
  result.changed = result.bought.length > 0 || JSON.stringify(save.owned) !== before;
  return result;
}
