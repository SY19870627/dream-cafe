// 每條夢想最多一個互動（fable52 稿的 interaction，標【待定】；這裡是粗稿實作）。
// 手指在那個物件上拖曳才算互動；在空白處拖曳照樣是轉頭；在物件上輕點照樣出那一行字。
// 做完只切換一次狀態（存進 state.interacted），重新整理後直接畫做完的樣子，不會再觸發一次。
// 純邏輯，不碰 DOM，用 node --test 測試。

// target：fable 稿 interaction.target；kind：手勢；feedback：拖曳中物件怎麼跟著手指（粗稿）
export const INTERACTIONS = {
  'rain-quilt-tv': { target: 'quilt', kind: 'pullUp', feedback: 'follow-y' }, // 往上拖，把被子拉到下巴
  'hut-heater-hands': { target: 'heater', kind: 'reach', feedback: 'hand' }, // 把手拖向出風口，停在前面
  'watch-dog-eat-play': { target: 'ball', kind: 'throw', feedback: 'follow' }, // 拖曳後放開，網球丟出去，狗追過去
  'read-in-cafe': { target: 'book', kind: 'flip', feedback: 'follow-x' }, // 翻一頁
  'door-coffee-smell': { target: 'door', kind: 'push', feedback: 'follow-x' }, // 推門，磨豆機的聲音變大
};

export const REACH_HOLD_MS = 700;

// info：{ dx, dy（px，從按下到放開）, ms（按住多久）, endInside（放開時手指還在物件上） }
export function recognize(kind, { dx = 0, dy = 0, ms = 0, endInside = false } = {}) {
  const dist = Math.hypot(dx, dy);
  switch (kind) {
    case 'pullUp': return dy <= -50 && -dy > Math.abs(dx);
    case 'reach': return dist >= 20 && endInside && ms >= REACH_HOLD_MS;
    case 'throw': return dist >= 60;
    case 'flip': return Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy);
    case 'push': return Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy);
    default: return false;
  }
}

// 做完之後的樣子：直接改場景物件（粗稿的狀態切換）
export function applyDone(id, items) {
  const def = INTERACTIONS[id];
  if (!def) return;
  const find = (k) => items.find((it) => it.id === k);
  const target = find(def.target);
  if (target) delete target.gesture; // 只能做一次
  if (id === 'rain-quilt-tv' && target) Object.assign(target, { depth: 0.98, y: 1.0, h: 0.34, opt: { ...target.opt, pulled: true } });
  if (id === 'hut-heater-hands' && !find('hands')) items.push({ id: 'hands', angle: target?.angle ?? 0, depth: 0.86, y: 0.8, h: 0.09, shape: 'hands' });
  if (id === 'watch-dog-eat-play') {
    if (target) Object.assign(target, { angle: 96, depth: 0.62, y: 0.86 });
    const dog = find('dog');
    if (dog) Object.assign(dog, { angle: 88, depth: 0.6, y: 0.87 });
  }
  if (id === 'read-in-cafe' && target) target.opt = { ...target.opt, turned: true };
  if (id === 'door-coffee-smell' && target) target.opt = { ...target.opt, open: true };
}

// 環境聲音量：咖啡豆行推門之前比較小，推開之後變大
export const ambientLevel = (id, done) => (id === 'door-coffee-smell' && !done ? 0.3 : 1);
