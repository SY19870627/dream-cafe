// 背景音樂的曲目表與「每一幕播哪首」（純資料＋純函式；不碰 DOM、不出聲）。
// 音檔路徑只寫在這一個檔（main.js、view/opening.js 不寫路徑）；畫面上不放任何指向音檔的連結。
// 出處與授權細節給開發者看的版本在 assets/audio/CREDITS.md。承峰 2026-11-22 22:21「現在把音樂接進遊戲」，白天曲選「夏空へ」。
// 播放（淡入淡出、循環、靜音）在 view/audio.js 的 setMusic()；這裡只回答「這一幕、這一句應該是哪首、多大聲」。
import { ACT_LINES, OPENING_ACTS } from './state.js'; // 【待定】

// 四首都是 DOVA-SYNDROME（OpenTracks）サイト準拠；署名任意；允許轉檔、淡入淡出、循環編輯；
// 禁止把音源單獨散布／販賣、禁止讓玩家輕易把音檔當純音樂檔複製走、禁止當作業用／療癒／睡眠等「音樂本身為主」的內容、禁止 AI 訓練。
const LICENSE = 'DOVA-SYNDROME（OpenTracks）音源利用ライセンス（サイト準拠）：遊戲背景音樂可用；署名任意；允許轉檔、淡入淡出、循環編輯；禁止單獨散布或販賣音源、禁止讓玩家輕易抽出音檔、禁止以音樂本身為主的用途、禁止 AI 訓練'; // 【待定】
const NORU = '；のる另重申不可用於以音樂為主的影片（作業用／療癒／睡眠），本遊戲背景音樂不抵觸'; // 【待定】
// loop：官方循環軌用 <audio loop>；非循環軌（city、day）在快結束時自己交叉淡化接回開頭（view/audio.js）
export const TRACKS = { // 【待定】
  city: { // 【待定】
    title: '窓辺のドロップス', author: 'すもち', url: 'https://dova-s.jp/bgm/play13691.html', track: 'トラック1（非ループ，2:12）', // 【待定】
    loop: false, license: LICENSE, downloaded: '2026-11-22', // 【待定】
    files: { ogg: 'assets/audio/city.ogg', mp3: 'assets/audio/city.mp3' }, // 【待定】
  }, // 【待定】
  day: { // 【待定】
    title: '夏空へ', author: 'ハヤシユウ', url: 'https://dova-s.jp/bgm/play19399.html', track: 'トラック1（非ループ，3:13）', // 【待定】
    loop: false, license: LICENSE, downloaded: '2026-11-22', // 【待定】
    files: { ogg: 'assets/audio/day.ogg', mp3: 'assets/audio/day.mp3' }, // 【待定】
  }, // 【待定】
  cafe: { // 【待定】
    title: 'Chill Out Lounge', author: 'のる', url: 'https://dova-s.jp/bgm/play16336.html', track: 'トラック2（ループ，約 2:08）', // 【待定】
    loop: true, license: LICENSE + NORU, downloaded: '2026-11-22', // 【待定】
    files: { ogg: 'assets/audio/cafe.ogg', mp3: 'assets/audio/cafe.mp3' }, // 【待定】
  }, // 【待定】
  night: { // 【待定】
    title: 'Sweet Dreams', author: 'のる', url: 'https://dova-s.jp/bgm/play16883.html', track: 'トラック2（ループ，約 2:06）', // 【待定】
    loop: true, license: LICENSE + NORU, downloaded: '2026-11-22', // 【待定】
    files: { ogg: 'assets/audio/night.ogg', mp3: 'assets/audio/night.mp3' }, // 【待定】
  }, // 【待定】
}; // 【待定】

// level 是音樂支線的相對音量（1＝100%）
const m = (track, level = 1) => ({ track, level }); // 【待定】

// 每一幕「進幕那一刻」的音樂（null＝不放音樂）。字卡是「下一幕開場那一刻」的狀態（讀檔重播字卡也照這張表）。
export const ACT_MUSIC = { // 【待定】
  office: null, // 【待定】只有日光燈嗡聲、打字、送出音效
  title: m('city'), // 【待定】送出後才有音樂：解鎖後第一次出聲 2.5 秒淡入
  t4card: m('city'), // 【待定】
  mailbox: m('city'), // 【待定】
  letter: m('city'), // 【待定】
  t2card: m('city'), // 【待定】
  eve: m('city'), // 【待定】
  road: null, // 【待定】夜路不放：門外只有風
  deshu: m('cafe'), // 【待定】推門進店才開始
  sit: m('cafe'), // 【待定】
  coffee: m('cafe'), // 【待定】
  depart: null, // 【待定】
  ride: null, // 【待定】
  fork: null, // 【待定】
  temple: null, // 【待定】
  return: null, // 【待定】
  stay: m('cafe', 0.6), // 【待定】
  room: m('night'), // 【待定】
  t1card: null, // 【待定】字卡到雞叫前的換氣不放
  d1wake: null, // 【待定】開場先靜：章名卡「最底下那個抽屜」出現時才淡入 day（TITLE_CUES）
  d1shop: m('day'), // 【待定】
  d1town: m('city'), // 【待定】
  d1home: m('city'), // 【待定】
  d1bank: m('city', 0.5), // 【待定】
  d1store: m('city', 0.5), // 【待定】「不然……先試試看好了。」升回 100%（LINE_CUES）
  t0card: null, // 【待定】接回場和當天字卡不放（承峰 21:41）
  resend: null, // 【待定】
  d2card: m('day'), // 【待定】
  d2cafe: m('day'), // 【待定】
  d5card: m('day'), // 【待定】
  d5cafe: m('day'), // 【待定】
  d5village: m('day'), // 【待定】
  d5thanks: m('day', 0.7), // 【待定】「外面天色慢慢暗下來」與畫面入夜同一拍換 cafe（LINE_CUES）
  d5brew: m('cafe'), // 【待定】
  tbc: m('night', 0.5), // 【待定】待續：不靜音
}; // 【待定】

// 章名卡出現那一刻換的音樂（只有 d1wake；d2cafe 的章名卡不重切）
export const TITLE_CUES = { // 【待定】
  d1wake: m('day'), // 【待定】
}; // 【待定】

// 幕內切點：讀到這一句（原文，一字不改）時換成這個音樂狀態；之後的句子都維持
export const LINE_CUES = { // 【待定】
  d1store: [{ text: '不然……先試試看好了。', music: m('city', 1) }], // 【待定】
  d5thanks: [{ text: '外面天色慢慢暗下來。店裡很安靜，只有剝殼的聲音。', music: m('cafe', 1) }], // 【待定】
}; // 【待定】

// 切點那一句在幕裡的 index（找不到是 -1）
export const cueLine = (act, text) => (ACT_LINES[act] || []).findIndex((b) => b.text === text); // 【待定】

// 這一幕第 line 句應該是什麼音樂；titled＝章名卡已經出現（line > 0 一定已過章名）
export function musicAt(act, line = 0, { titled = line > 0 } = {}) { // 【待定】
  if (!Object.prototype.hasOwnProperty.call(ACT_MUSIC, act)) return null; // 【待定】
  let cur = ACT_MUSIC[act]; // 【待定】
  if (titled && TITLE_CUES[act]) cur = TITLE_CUES[act]; // 【待定】
  for (const c of LINE_CUES[act] || []) { // 【待定】
    const i = cueLine(act, c.text); // 【待定】
    if (i >= 0 && line >= i) cur = c.music; // 【待定】
  } // 【待定】
  return cur; // 【待定】
} // 【待定】

// 沒登記的幕（測試用；應該是空的）
export const unlistedActs = () => OPENING_ACTS.filter((a) => !Object.prototype.hasOwnProperty.call(ACT_MUSIC, a)); // 【待定】
