// 音效與環境聲的真實錄音對照表（純資料；不碰 DOM、不出聲）。
// 音檔路徑只寫在這一個檔（view/audio.js 不寫路徑）；出處與授權在 assets/audio/CREDITS.md。
// 每個名稱都有同名 .ogg 與 .mp3（單聲道 44.1 kHz，已做 loudness 正規化）。
// 播放在 view/audio.js：fetch（cors）＋ decodeAudioData，接到 master；載不到就退回原本的 WebAudio 合成。
// 不在表裡的名稱（tap、memory、ding 電梯到站）沒有合適的真實錄音，維持合成。

export const SFX_DIR = 'assets/audio/sfx'; // 【待定】

// play()／setAmbient() 的名稱 → 檔名（不含副檔名）
export const SFX_FILES = { // 【待定】
  // 短音效：沿用原名
  rooster: 'rooster', key: 'key', send: 'send', keys: 'keys', door: 'door', bell: 'bell', pour: 'pour', tick: 'tick', // 【待定】
  grind: 'grind', water: 'water', domino: 'domino', plop: 'plop', sip: 'sip', page: 'page', place: 'place', copier: 'copier', // 【待定】
  buzz: 'buzz', drip: 'drip', beep: 'beep', hop: 'hop', boil: 'boil', purr: 'purr', shutter: 'shutter', tape: 'tape', // 【待定】
  rewind: 'rewind', slipper: 'slipper', cloth: 'cloth', rinse: 'rinse', rev: 'rev', creak: 'creak', dog: 'dog', // 【待定】
  // 檔名有連字號、程式名稱是駝峰
  engineStart: 'engine-start', engineOff: 'engine-off', thinPour: 'thin-pour', // 【待定】
  // 新拆出來的名稱
  doorIron: 'door-iron', // 【待定】第一天開信箱的鐵片門
  tickBowl: 'tick-bowl', // 【待定】德叔挑豆丟碗、壓開龍眼殼、又剝了一顆
  pageBag: 'page-bag', // 【待定】龍眼乾的袋子打開
  chime: 'chime', // 【待定】第一天走進超商（電梯仍是合成的 ding）
  creakWindow: 'creak-window', // 【待定】打開房間窗戶
  creakDrawer: 'creak-drawer', // 【待定】拉開書桌抽屜
  meow: 'meow', // 【待定】德叔那幕：尾巴勾了一下腳踝（短貓叫，播一次）
  // 循環環境聲
  rain: 'rain', heater: 'heater', room: 'room', cafe: 'cafe', shop: 'shop', fan: 'fan', grinder: 'grinder', hum: 'hum', // 【待定】
  wind: 'wind', lobby: 'lobby', store: 'store', scooter: 'scooter', engine: 'engine', // 【待定】
  insects: 'insects', // 【待定】夏夜蟲鳴：三合院外、房間裡躺下後
}; // 【待定】

// 沒有真實錄音、維持合成的名稱
export const SFX_SYNTH_ONLY = ['tap', 'memory', 'ding']; // 【待定】

// 每個名稱的額外增益（預設 1）：環境聲略低，免得蓋過配樂
export const SFX_GAIN = { // 【待定】
  wind: 0.8, room: 0.8, lobby: 0.8, insects: 0.8, // 【待定】
  engine: 0.75, scooter: 0.75, // 【待定】
}; // 【待定】

export const sfxGain = (name) => SFX_GAIN[name] ?? 1; // 【待定】

// 這個名稱的音檔網址（ogg 先、mp3 備用）；沒有錄音回傳 null
export function sfxFiles(name) { // 【待定】
  const f = Object.prototype.hasOwnProperty.call(SFX_FILES, name) ? SFX_FILES[name] : null; // 【待定】
  if (!f) return null; // 【待定】
  return { ogg: `${SFX_DIR}/${f}.ogg`, mp3: `${SFX_DIR}/${f}.mp3` }; // 【待定】
} // 【待定】
