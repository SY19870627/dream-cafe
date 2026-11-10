// 演出表：把劇本 stage 裡「做得出來」的部分轉成畫面／聲音指令。只放指令，不放任何會顯示給玩家的字。
// 劇本的 stage 原文不會出現在畫面上；沒做出來的 stage 列在 docs 外的報告（resume-report.md「沒演的 stage」）。
// sfx：audio.js 的音效名；portrait：從這一句起換立繪（none＝退場）；phone：手機特寫螢幕亮／暗；
// ambientLevel：環境聲音量（電台轉小一格）；cat：龍眼在店裡的位置（manifest.js 的 CAT_SPOTS）。
export const NODE_DIRECTION = {
  'd1-s1-08': { ambientLevel: 0.55 },
  'd1-s1-11': { sfx: ['bell'] },
  'd1-s2-03': { sfx: ['drip'] },
  'd1-s3-01': { sfx: ['buzz'] },
  'd1-s3-07': { phone: 'off' },
  'd1-s4-03': { sfx: ['buzz'], phone: 'off' },
  'd1-s4-07': { phone: 'on' },
  'd1-s5-01': { sfx: ['bell'] },
  'd2-s1-09': { sfx: ['bell'] },
  'd2-s2-03': { portrait: 'gui' }, // 阿桂立繪在這一句才出現
  'd2-s5-01': { sfx: ['bell'] },
  'd2-s5-15': { cat: 'floor' },
  'd2-s5-17': { sfx: ['bell'], portrait: 'none' },
  'd3-s1-01': { sfx: ['bell'] },
  'd3-s1-11': { sfx: ['bell'], portrait: 'none' },
  'd3-s1-12': { portrait: 'deshu' },
  'd3-s1-18': { sfx: ['bell'] },
  'd3-s3-01': { sfx: ['ding'] },
  'd3-s4-01': { sfx: ['beep'] },
  'd3-s4-14': { sfx: ['door'] },
  'd3-s5-01': { sfx: ['bell'] },
  'd3-s5-09': { sfx: ['buzz'] },
};

// 每一場開頭的狀態
export const SCENE_DIRECTION = {
  'op-act4': { cat: 'shelfSleep' },
  'd1-s1-shop': { cat: 'shelfSleep' },
  'd1-s5-return': { cat: 'shelfSit', ambientLevel: 0.55 },
  'd2-s1-shop': { cat: 'shelfSleep' },
  'd2-s2-hut': { portrait: 'none' }, // 前兩頁只有山屋，阿桂還在門裡講電話
  'd2-s5-return': { cat: 'shelfSit' },
  'd3-s1-shop': { cat: 'shelfSleep' },
  'd3-s5-return': { cat: 'table' },
};
