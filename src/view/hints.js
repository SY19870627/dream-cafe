// 點擊／拖曳的提示字（通用提示規則；承峰 2026-11-21 23:14「照建議稿補齊，可選互動加「（也可以直接翻頁）」」）
// 規則：目標物呼吸光圈加箭頭；閱讀框上方一行短提示（樣式同「點信封，把信拿出來。」）；做過或翻頁後提示消失；點目標那一下不算翻頁。
// 必做的不加「（也可以直接翻頁）」；可選的加在後面（畫面上用小一號的字）。
// 已有按鈕字、不另加提示的：事由欄與「送出」、「下班」、「出發去東山」、「發動」、「掉頭回去」。
// 「點信封，把信拿出來。」原本在 lines/opening.js 的 ROOM_LETTER.hint；承峰 2026-11-24 開信封改成分鏡格，點信封與這句提示拿掉。
// 錢包、抽屜、把存摺放進提款機的提示也隨分鏡格拿掉（數錢、開抽屜、刷存摺都改成分鏡格）。

export const OPTIONAL_SUFFIX = '（也可以直接翻頁）';
export const MAILBOX_SUFFIX = '（也可以直接上樓）';

// 超商的徵人海報：定版超商圖（bg_v56_store_interior_seating_portrait）畫了座位區，海報在座位區後牆上（承峰 2026-11-22「超商圖定版」）。
export const POSTER_HINT = '點座位區的徵人海報';

// 必做（字先不出來，做完才出下一句；或做完才進下一幕）
export const MUST_HINTS = {
  door: '把門推開', // 開場到店、晚上回來各一次（門上的字「推門進去」只給螢幕閱讀器與門板，不是提示）
  hold: '按住畫面，往前騎',
  fork: '點左邊或右邊的路',
  chair: '點椅子坐下', // 店內 2D 定景上點那張看得到的椅子
  keyGive: '把鑰匙拿給德叔',
  keyBar: '把鑰匙放到吧台',
  poster: POSTER_HINT,
  pause: '點一下繼續', // 超商停一拍
  calico: '點花斑貓，跟著走',
  can: '點地上的空罐子',
};
// 小圖：疊上來以後點一下才出句子（依小圖是哪一張）
export const MINI_HINTS = {
  stain: '點窗戶下面的水痕',
  passbook: '點存摺',
  hat: '點斗笠',
  label: '點標籤',
  longan: '點龍眼乾',
};
// 可選（不做也能翻頁）
export const OPTIONAL_HINTS = {
  cat: `摸摸龍眼${OPTIONAL_SUFFIX}`,
  bed: `點床躺下${OPTIONAL_SUFFIX}`,
  cup: `點杯子喝一口${OPTIONAL_SUFFIX}`,
  faucet: `點水龍頭洗臉${OPTIONAL_SUFFIX}`,
  mailbox: `點信箱看看${MAILBOX_SUFFIX}`,
};

// 熱點 id → 提示字（view/reader.js 的 hot() 出熱點時自動顯示）
export const HOT_HINTS = { ...OPTIONAL_HINTS, chair: MUST_HINTS.chair, poster: MUST_HINTS.poster, calico: MUST_HINTS.calico, can: MUST_HINTS.can };
// 關卡（gate）→ 提示字。keyGive 的提示由 view/days.js 的 props.gate 自己畫（pp-hint），這裡不重複
export const GATE_HINTS = { door: MUST_HINTS.door, hold: MUST_HINTS.hold, fork: MUST_HINTS.fork };
// 分鏡格（set.mini 是 sb-…，或 tap panel）：沿用超商停一拍的「點一下繼續」，不另寫新字；自動亮起的（panelAuto）不出提示
export const isStoryboard = (m) => String(m || '').startsWith('sb-');
// 字出來之前要先做的（tap）→ 提示字；mini 看這一句疊的是哪張小圖
export function tapHint(name, look = {}) {
  if (name === 'panel' || (name === 'mini' && isStoryboard(look.mini))) return MUST_HINTS.pause;
  if (name === 'panelAuto') return null;
  if (name === 'mini') return MINI_HINTS[look.mini] || null;
  return MUST_HINTS[name] || null;
}
// 畫面上把可選的那句小字分開（小一號）：[主句, 小字]
export function splitHint(text) {
  const m = /^(.*?)(（也可以直接[^）]*）)$/.exec(String(text || ''));
  return m ? [m[1], m[2]] : [String(text || ''), ''];
}
