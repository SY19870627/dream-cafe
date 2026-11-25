// 音效與環境聲：真實錄音（對照表在 story/sfx.js，音檔路徑只寫在那裡），用 fetch（cors）＋ decodeAudioData 解成 AudioBuffer 播；
// 載不到或解不開的名稱退回原本的 WebAudio 合成。tap、memory、ding（電梯）沒有錄音，維持合成。
// 預覽站音檔會 301 到別的網域：fetch 用 cors、不帶憑證，跟音樂同一個原因；不另外建 <audio>。
// 背景音樂：曲目表在 story/music.js（音檔路徑只寫在那裡），用 <audio>（ogg＋mp3 兩個 source）接進同一個 AudioContext 的音樂支線。
// 瀏覽器要求第一次觸控之後才能出聲：unlock() 掛在 pointerdown／pointerup／touchend／click／keydown（main.js）。
// 支線：master 0.6 → { sfx／環境聲（錄音與合成都直接接 master；錄音另有 story/sfx.js 的每名稱增益）、music 0.4 }。靜音＝master 0.15 秒降到 0，音樂暫停。
import { TRACKS } from '../story/music.js'; // 【待定】
import { SFX_FILES, sfxFiles, sfxGain } from '../story/sfx.js'; // 【待定】

let ctx = null;
let master = null;
let ambient = null; // { name, stop() }
const MASTER = 0.6;
const MUSIC_BUS = 0.4; // 【待定】音樂支線預設；100%＝這個值
// 淡入淡出秒數（照 v5.9 音樂計畫，不要自己改）
export const MUSIC_FADE = { out: 1.5, in: 2, first: 2.5, level: 1, mute: 0.15, loop: 3 }; // 【待定】
let musicBus = null; // 【待定】
let muted = false; // 【待定】
let hidden = false; // 【待定】分頁切走

export function unlock() {
  if (ctx) { // 【待定】iOS 來電回來是 interrupted；切回分頁後也可能是 suspended
    if (!hidden && (ctx.state === 'suspended' || ctx.state === 'interrupted')) ctx.resume()?.catch?.(() => {}); // 【待定】
    blessPool(); // 【待定】
    wakeMusic(); // 【待定】
    return; // 【待定】
  } // 【待定】
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER; // 【待定】
  master.connect(ctx.destination);
  musicBus = ctx.createGain(); // 【待定】
  musicBus.gain.value = MUSIC_BUS; // 【待定】
  musicBus.connect(master); // 【待定】
  ctx.onstatechange = () => { if (ctx.state === 'running') wakeMusic(); }; // 【待定】
  blessPool(); // 【待定】
  preloadSfx(pendingAmbient); // 【待定】背景先抓錄音（目前要用的環境聲排第一）
  if (pendingAmbient) setAmbient(pendingAmbient, pendingLevel);
  applyMusic(); // 【待定】解鎖前記著的音樂（pending）：第一次出聲 2.5 秒淡入
}

/* ---------- 背景音樂 ---------- */
// 同時最多三個 <audio>（換曲時舊曲淡出＋新曲淡入，加上非循環曲自己接回開頭的那一段）。
// 三個元素在玩家第一次點擊時先「點過一次 play」（iOS 要每個元素在手勢裡播過，之後換曲才不會被擋）。
const POOL = 3; // 【待定】
let pool = []; // 【待定】{ el, gain, voice }
let voices = []; // 【待定】{ id, name, slot, level, dying, held }
let musicTarget = null; // 【待定】{ track, level } 或 null；尚未解鎖時就是 pending
let firstSound = true; // 【待定】解鎖後第一次出聲用 2.5 秒
let voiceId = 0; // 【待定】
let silentUrl = null; // 【待定】

// 一小段無聲的 PCM（只在記憶體裡，給 iOS 在手勢裡先播一次用）
function silence() { // 【待定】
  if (silentUrl) return silentUrl; // 【待定】
  const n = 800; // 【待定】
  const v = new DataView(new ArrayBuffer(44 + n * 2)); // 【待定】
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }; // 【待定】
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); // 【待定】
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); // 【待定】
  v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true); // 【待定】
  try { silentUrl = URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' })); } catch { silentUrl = ''; } // 【待定】
  return silentUrl; // 【待定】
} // 【待定】

function makeSlot() { // 【待定】
  const el = document.createElement('audio'); // 【待定】不放進 DOM、沒有 controls，畫面上沒有下載入口
  el.crossOrigin = 'anonymous'; // 【待定】必須在設 src／load() 之前；預覽站音檔 301 到別的網域，沒設的話 MediaElementSource 會輸出靜音
  el.preload = 'none'; // 【待定】換到這首才開始抓
  el.setAttribute('playsinline', ''); // 【待定】
  const gain = ctx.createGain(); // 【待定】
  gain.gain.value = 0; // 【待定】
  try { ctx.createMediaElementSource(el).connect(gain); } catch { /* 不支援就沒有音樂 */ } // 【待定】
  gain.connect(musicBus); // 【待定】
  return { el, gain, voice: null, blessed: false }; // 【待定】
} // 【待定】

// 在玩家的點擊裡，把還沒播過的元素都先播一下無聲（之後換曲不需要手勢）
function blessPool() { // 【待定】
  if (!ctx || typeof document === 'undefined') return; // 【待定】
  while (pool.length < POOL) pool.push(makeSlot()); // 【待定】
  for (const s of pool) { // 【待定】
    if (s.blessed || s.voice) continue; // 【待定】
    const url = silence(); // 【待定】
    if (!url) continue; // 【待定】
    s.el.src = url; // 【待定】
    const p = s.el.play(); // 【待定】
    s.blessed = true; // 【待定】
    p?.then?.(() => { if (!s.voice) { s.el.pause(); clearSrc(s.el); } }, () => { s.blessed = false; }); // 【待定】
  } // 【待定】
} // 【待定】

function clearSrc(el) { // 【待定】停掉並不再緩衝
  el.pause(); // 【待定】
  el.removeAttribute('src'); // 【待定】
  while (el.firstChild) el.firstChild.remove(); // 【待定】
  try { el.load(); } catch { /* 已清 */ } // 【待定】
} // 【待定】

function setSources(el, t) { // 【待定】ogg 先、mp3 備用（Safari）
  clearSrc(el); // 【待定】
  const { ogg, mp3 } = t.files; // 【待定】音檔路徑只在曲目表（src/story/music.js）
  for (const [type, src] of [['audio/ogg', ogg], ['audio/mpeg', mp3]]) { // 【待定】
    const s = document.createElement('source'); // 【待定】
    s.type = type; // 【待定】
    s.src = src; // 【待定】
    el.appendChild(s); // 【待定】
  } // 【待定】
  el.preload = 'auto'; // 【待定】
  el.load(); // 【待定】
} // 【待定】

function ramp(g, to, sec) { // 【待定】
  const t = ctx.currentTime; // 【待定】
  g.gain.cancelScheduledValues(t); // 【待定】
  g.gain.setValueAtTime(g.gain.value, t); // 【待定】
  g.gain.linearRampToValueAtTime(to, t + sec); // 【待定】
} // 【待定】

function startVoice(name, level, fadeIn) { // 【待定】
  const t = TRACKS[name]; // 【待定】
  if (!t) return null; // 【待定】
  while (pool.length < POOL) pool.push(makeSlot()); // 【待定】
  let slot = pool.find((s) => !s.voice); // 【待定】
  if (!slot) { // 【待定】都在用：收掉最舊的那個正在淡出的
    const old = voices.find((v) => v.dying) || voices[0]; // 【待定】
    releaseVoice(old); // 【待定】
    slot = old.slot; // 【待定】
  } // 【待定】
  const v = { id: ++voiceId, name, slot, level, dying: false, held: false, looped: false }; // 【待定】
  slot.voice = v; // 【待定】
  slot.blessed = true; // 【待定】
  setSources(slot.el, t); // 【待定】
  slot.el.loop = !!t.loop; // 【待定】官方循環軌
  slot.el.ontimeupdate = t.loop ? null : () => selfLoop(v); // 【待定】非循環軌：快結束時自己接回開頭
  slot.gain.gain.cancelScheduledValues(ctx.currentTime); // 【待定】
  slot.gain.gain.setValueAtTime(0, ctx.currentTime); // 【待定】
  ramp(slot.gain, level, fadeIn); // 【待定】
  slot.el.play()?.catch?.(() => {}); // 【待定】
  voices.push(v); // 【待定】
  return v; // 【待定】
} // 【待定】

// 非循環曲剩約 3 秒：第二個 <audio> 從頭淡入，這一個淡出
function selfLoop(v) { // 【待定】
  const el = v.slot.el; // 【待定】
  if (v.dying || v.looped || v.slot.voice !== v || !(el.duration > MUSIC_FADE.loop * 2)) return; // 【待定】
  if (el.duration - el.currentTime > MUSIC_FADE.loop) return; // 【待定】
  v.looped = true; // 【待定】
  startVoice(v.name, v.level, MUSIC_FADE.loop); // 【待定】
  fadeOutVoice(v, MUSIC_FADE.loop); // 【待定】
} // 【待定】

function fadeOutVoice(v, sec) { // 【待定】
  if (v.dying) return; // 【待定】
  v.dying = true; // 【待定】
  ramp(v.slot.gain, 0, sec); // 【待定】
  setTimeout(() => releaseVoice(v), sec * 1000 + 120); // 【待定】
} // 【待定】

function releaseVoice(v) { // 【待定】
  if (!v || v.slot.voice !== v) { voices = voices.filter((x) => x !== v); return; } // 【待定】
  v.slot.el.ontimeupdate = null; // 【待定】
  v.slot.gain.gain.cancelScheduledValues(ctx.currentTime); // 【待定】
  v.slot.gain.gain.setValueAtTime(0, ctx.currentTime); // 【待定】
  clearSrc(v.slot.el); // 【待定】
  v.slot.voice = null; // 【待定】
  voices = voices.filter((x) => x !== v); // 【待定】
} // 【待定】

// 依 musicTarget 調整正在播的曲子（同一首只改音量；換曲交叉淡化；換到無音樂就淡出）
function applyMusic() { // 【待定】
  if (!ctx) return; // 【待定】尚未解鎖：musicTarget 先記著
  if (muted || hidden) { // 【待定】靜音／分頁切走：不開新曲；暫停中的舊曲若已不是目標就收掉（不再緩衝）
    for (const v of [...voices]) if (v.dying || !musicTarget || v.name !== musicTarget.track) releaseVoice(v); // 【待定】
    return; // 【待定】
  } // 【待定】
  const live = voices.filter((v) => !v.dying); // 【待定】
  const tgt = musicTarget; // 【待定】
  if (!tgt) { for (const v of live) fadeOutVoice(v, MUSIC_FADE.out); return; } // 【待定】
  const same = live.filter((v) => v.name === tgt.track); // 【待定】
  if (same.length) { // 【待定】
    for (const v of live) if (v.name !== tgt.track) fadeOutVoice(v, MUSIC_FADE.out); // 【待定】
    for (const v of same) { // 【待定】
      if (v.held || v.slot.el.paused) { v.held = false; v.slot.el.play()?.catch?.(() => {}); } // 【待定】
      if (v.level !== tgt.level) { v.level = tgt.level; ramp(v.slot.gain, tgt.level, MUSIC_FADE.level); } // 【待定】
    } // 【待定】
    return; // 【待定】
  } // 【待定】
  for (const v of live) fadeOutVoice(v, MUSIC_FADE.out); // 【待定】
  startVoice(tgt.track, tgt.level, firstSound ? MUSIC_FADE.first : MUSIC_FADE.in); // 【待定】
  firstSound = false; // 【待定】
} // 【待定】

function holdMusic() { // 【待定】暫停（靜音、分頁切走）：淡出中的直接收掉，其餘暫停原地
  for (const v of [...voices]) { // 【待定】
    if (v.dying) { releaseVoice(v); continue; } // 【待定】
    v.held = true; // 【待定】
    v.slot.el.pause(); // 【待定】
  } // 【待定】
} // 【待定】

function wakeMusic() { // 【待定】
  if (!ctx || muted || hidden) return; // 【待定】
  applyMusic(); // 【待定】
} // 【待定】

// 設定這一刻應該播的音樂：null＝不放；{ track, level }（level 是音樂支線的相對音量）
export function setMusic(spec) { // 【待定】
  const next = spec && TRACKS[spec.track] ? { track: spec.track, level: spec.level ?? 1 } : null; // 【待定】
  if (next?.track === musicTarget?.track && next?.level === musicTarget?.level) return; // 【待定】
  musicTarget = next; // 【待定】
  applyMusic(); // 【待定】
} // 【待定】
// 同一首只改音量（1 秒）
export function setMusicLevel(level) { // 【待定】
  if (musicTarget) setMusic({ ...musicTarget, level }); // 【待定】
} // 【待定】
export const musicNow = () => (musicTarget ? { ...musicTarget } : null); // 【待定】
export const isUnlocked = () => !!ctx; // 【待定】
export const isMuted = () => muted; // 【待定】

// 全部靜音（音樂、音效、環境聲）：約 0.15 秒；靜音時音樂暫停、不開新曲
export function setMuted(on) { // 【待定】
  muted = !!on; // 【待定】
  if (!ctx) return; // 【待定】解鎖時 master 會照 muted 設
  ramp(master, muted ? 0 : MASTER, MUSIC_FADE.mute); // 【待定】
  if (muted) setTimeout(() => { if (muted) holdMusic(); }, MUSIC_FADE.mute * 1000 + 30); // 【待定】
  else wakeMusic(); // 【待定】
} // 【待定】

// 分頁切走：暫停；回來：恢復（靜音中就不恢復音樂）
export function setHidden(on) { // 【待定】
  hidden = !!on; // 【待定】
  if (!ctx) return; // 【待定】
  if (hidden) { holdMusic(); ctx.suspend?.()?.catch?.(() => {}); return; } // 【待定】
  ctx.resume?.()?.catch?.(() => {}); // 【待定】iOS 可能要等下一次點擊（unlock 會再 resume）
  wakeMusic(); // 【待定】
} // 【待定】

function tone(freq, { at = 0, dur = 0.3, type = 'sine', gain = 0.2, attack = 0.005, to = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseBuffer(sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function noise({ at = 0, dur = 0.2, gain = 0.2, freq = 2000, q = 1, type = 'bandpass' } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(Math.max(0.1, dur + 0.1));
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.05);
}

/* ---------- 真實錄音（音效與環境聲） ---------- */
// 每個名稱一份狀態：{ buf, failed, p }；buf＝解好的 AudioBuffer，failed＝兩種格式都載不到（之後一律合成）
const sfxState = new Map(); // 【待定】
const SFX_LATE = 700; // 【待定】毫秒：錄音還在載、超過這麼久才到就不補放（短音效晚響很怪）

function decode(data) { // 【待定】舊 Safari 的 decodeAudioData 只有 callback
  return new Promise((res, rej) => { // 【待定】
    const p = ctx.decodeAudioData(data, res, rej); // 【待定】
    p?.then?.(res, rej); // 【待定】
  }); // 【待定】
} // 【待定】

async function fetchBuffer(urls) { // 【待定】ogg 先；抓不到或解不開（舊 Safari 不吃 Vorbis）就換 mp3
  for (const url of urls) { // 【待定】
    try { // 【待定】
      const r = await fetch(url, { mode: 'cors', credentials: 'omit' }); // 【待定】預覽站會 301 到別的網域
      if (!r.ok) continue; // 【待定】
      return await decode(await r.arrayBuffer()); // 【待定】
    } catch { /* 換下一個格式 */ } // 【待定】
  } // 【待定】
  return null; // 【待定】
} // 【待定】

// 開始載入（只載一次）；沒有錄音的名稱回傳 null
function loadSfx(name) { // 【待定】
  if (sfxState.has(name)) return sfxState.get(name); // 【待定】
  const files = sfxFiles(name); // 【待定】
  if (!files || !ctx || typeof fetch !== 'function') return null; // 【待定】
  const s = { buf: null, failed: false, p: null }; // 【待定】
  s.p = fetchBuffer(Object.values(files)).then((buf) => { // 【待定】sfxFiles 的順序就是 ogg 先、mp3 後
    if (buf) s.buf = buf; else s.failed = true; // 【待定】
    return buf; // 【待定】
  }); // 【待定】
  sfxState.set(name, s); // 【待定】
  return s; // 【待定】
} // 【待定】

// 解鎖後在背景把全部錄音抓下來（同時最多 4 個）；first 排第一
function preloadSfx(first) { // 【待定】
  const names = Object.keys(SFX_FILES); // 【待定】
  if (first && names.includes(first)) names.unshift(...names.splice(names.indexOf(first), 1)); // 【待定】
  const next = () => { // 【待定】
    const n = names.shift(); // 【待定】
    if (!n) return; // 【待定】
    const s = loadSfx(n); // 【待定】
    if (s) s.p.then(next); else next(); // 【待定】
  }; // 【待定】
  for (let i = 0; i < 4; i++) next(); // 【待定】
} // 【待定】

function fireBuffer(name, buf) { // 【待定】
  const s = ctx.createBufferSource(); // 【待定】
  s.buffer = buf; // 【待定】
  const g = ctx.createGain(); // 【待定】
  g.gain.value = sfxGain(name); // 【待定】
  s.connect(g).connect(master); // 【待定】接 master：靜音鍵一起管
  s.start(); // 【待定】
} // 【待定】

// 播錄音；回傳 false＝這個名稱要用合成
function playFile(name) { // 【待定】
  const s = loadSfx(name); // 【待定】
  if (!s || s.failed) return false; // 【待定】
  if (s.buf) { fireBuffer(name, s.buf); return true; } // 【待定】
  const asked = Date.now(); // 【待定】還在載：載到了而且不太晚才放；載不到就補合成
  s.p.then((buf) => { // 【待定】
    if (!ctx || Date.now() - asked > SFX_LATE) return; // 【待定】
    if (buf) fireBuffer(name, buf); else synth(name); // 【待定】
  }); // 【待定】
  return true; // 【待定】
} // 【待定】

export function play(name) {
  if (!ctx) return;
  if (playFile(name)) return; // 【待定】
  synth(name); // 【待定】
}

// 原本的 WebAudio 合成（錄音載不到時的退路；tap、memory、ding 只有這個）
function synth(name) { // 【待定】
  switch (name) {
    case 'key': noise({ dur: 0.04, gain: 0.25, freq: 3200, q: 2 }); break;
    case 'send': // 送出：一聲「咻」加一聲輕響
      noise({ dur: 0.35, gain: 0.18, freq: 1200, q: 0.8 });
      tone(880, { at: 0.25, dur: 0.5, gain: 0.12 });
      tone(1320, { at: 0.32, dur: 0.6, gain: 0.08 });
      break;
    case 'keys': // 信封裡的鑰匙
      for (let i = 0; i < 6; i++) tone(3000 + Math.random() * 2000, { at: i * 0.09, dur: 0.12, gain: 0.05, type: 'triangle' });
      break;
    case 'door':
    case 'doorIron': noise({ dur: 0.6, gain: 0.12, freq: 300, q: 0.7 }); break;
    case 'bell': // 風鈴
      [1568, 2093, 2637, 1760].forEach((f, i) => tone(f, { at: i * 0.12 + Math.random() * 0.05, dur: 1.8, gain: 0.07 }));
      break;
    case 'pour': noise({ dur: 1.4, gain: 0.08, freq: 900, q: 0.6 }); break;
    case 'tick':
    case 'tickBowl': tone(1800, { dur: 0.05, gain: 0.06, type: 'square' }); break;
    case 'grind': for (let i = 0; i < 16; i++) noise({ at: i * 0.12, dur: 0.1, gain: 0.08, freq: 2500, q: 3 }); break;
    case 'water': noise({ dur: 2.5, gain: 0.05, freq: 600, q: 0.5 }); break;
    case 'domino': tone(900 + Math.random() * 200, { dur: 0.08, gain: 0.12, type: 'triangle' }); noise({ dur: 0.05, gain: 0.1, freq: 2500 }); break;
    case 'plop': tone(600, { dur: 0.25, gain: 0.18, to: 180 }); break;
    case 'sip': noise({ dur: 0.5, gain: 0.05, freq: 1500, q: 0.5 }); break;
    case 'page':
    case 'pageBag': noise({ dur: 0.35, gain: 0.12, freq: 3500, q: 0.4 }); break;
    case 'place': tone(320, { dur: 0.18, gain: 0.12, type: 'triangle' }); break;
    case 'wallet': noise({ dur: 0.4, gain: 0.1, freq: 2200, q: 0.5 }); break; // 打開錢包／紙鈔
    case 'tap': tone(660, { dur: 0.12, gain: 0.05 }); break;
    case 'memory': tone(523, { dur: 1.6, gain: 0.05 }); tone(784, { at: 0.2, dur: 1.6, gain: 0.04 }); break;
    case 'copier': noise({ dur: 1.6, gain: 0.05, freq: 500, q: 1.5 }); break;
    // v3b 演出用
    case 'buzz': for (let i = 0; i < 2; i++) tone(140, { at: i * 0.32, dur: 0.22, gain: 0.08, type: 'sawtooth' }); break; // 手機震動
    case 'drip': tone(900, { dur: 0.18, gain: 0.08, to: 420 }); break; // 鋁盆滴水
    case 'ding': // 電梯（沒有錄音）
    case 'chime': tone(1046, { dur: 0.9, gain: 0.06 }); tone(784, { at: 0.35, dur: 1.2, gain: 0.05 }); break; // 電梯
    case 'beep': tone(1480, { dur: 0.12, gain: 0.05, type: 'square' }); break; // 閘門
    // 開場（劇本 v3.8 第三、四幕）
    case 'engineStart': // 機車發動：起動馬達一陣，接著引擎轉起來
      noise({ dur: 0.45, gain: 0.08, freq: 900, q: 2 });
      tone(48, { at: 0.35, dur: 0.9, gain: 0.12, type: 'sawtooth', to: 95 });
      noise({ at: 0.35, dur: 0.9, gain: 0.06, freq: 260, q: 0.8, type: 'lowpass' });
      break;
    case 'engineOff': // 熄火：轉速掉下來，最後一聲喀
      tone(80, { dur: 1.1, gain: 0.1, type: 'sawtooth', to: 26 });
      noise({ at: 1.0, dur: 0.06, gain: 0.08, freq: 1500, q: 3 });
      break;
    case 'rev': // 合成退路（錄音載不到時）；開場轉彎、迴轉已改走 setEnginePath 引擎曲線，不播這個
      tone(60, { dur: 1.2, gain: 0.1, type: 'sawtooth', to: 120 });
      noise({ dur: 1.2, gain: 0.05, freq: 320, q: 0.7, type: 'lowpass' });
      break;
    case 'dog': // 遠處的狗叫（兩聲，小聲）
      for (let i = 0; i < 2; i++) {
        tone(520, { at: i * 0.32, dur: 0.16, gain: 0.025, type: 'sawtooth', to: 360 });
        noise({ at: i * 0.32, dur: 0.14, gain: 0.02, freq: 800, q: 1.5 });
      }
      break;
    case 'cloth': noise({ dur: 0.32, gain: 0.05, freq: 2200, q: 0.6 }); break; // 布擦杯子，一下
    case 'rinse': noise({ dur: 0.9, gain: 0.05, freq: 1300, q: 0.7 }); break; // 杯子沖水
    case 'meow': tone(620, { dur: 0.22, gain: 0.05, type: 'triangle', to: 900 }); tone(900, { at: 0.2, dur: 0.35, gain: 0.04, type: 'triangle', to: 520 }); break; // 短貓叫（錄音載不到時）
    case 'hop': tone(140, { dur: 0.14, gain: 0.08, to: 80 }); noise({ dur: 0.08, gain: 0.04, freq: 500, q: 0.8 }); break; // 貓跳上／跳下
    case 'boil': // 水滾：低沉的滾聲加幾顆氣泡
      noise({ dur: 1.6, gain: 0.07, freq: 380, q: 0.6, type: 'lowpass' });
      for (let i = 0; i < 10; i++) tone(500 + Math.random() * 600, { at: 0.2 + Math.random() * 1.3, dur: 0.06, gain: 0.03, to: 900 });
      break;
    case 'thinPour': // 很細的水聲，斷了一次，又接上
      noise({ at: 1.5, dur: 0.6, gain: 0.05, freq: 2600, q: 2.5 });
      noise({ at: 2.35, dur: 1.4, gain: 0.05, freq: 2600, q: 2.5 });
      break;
    case 'purr': // 呼嚕：很低的聲音一顫一顫
      for (let i = 0; i < 18; i++) noise({ at: i * 0.075, dur: 0.07, gain: 0.07, freq: 140, q: 0.9, type: 'lowpass' });
      for (let i = 0; i < 18; i++) noise({ at: 1.5 + i * 0.075, dur: 0.07, gain: 0.06, freq: 140, q: 0.9, type: 'lowpass' });
      break;
    case 'creak': // 床板
    case 'creakWindow': // 錄音載不到時：窗戶、抽屜也用這個
    case 'creakDrawer':
      tone(190, { dur: 0.45, gain: 0.05, type: 'sawtooth', to: 150 });
      noise({ dur: 0.3, gain: 0.04, freq: 700, q: 4 });
      tone(170, { at: 0.5, dur: 0.3, gain: 0.03, type: 'sawtooth', to: 140 });
      break;
    // 第一～四天（劇本 v4.4）
    case 'shutter': // 底片相機的快門：喀一聲＋簧片
      noise({ dur: 0.04, gain: 0.3, freq: 2600, q: 1.5 });
      noise({ at: 0.06, dur: 0.07, gain: 0.22, freq: 1500, q: 2 });
      break;
    case 'tape': // 撕膠帶
      noise({ dur: 0.35, gain: 0.1, freq: 2400, q: 0.6, type: 'highpass' });
      break;
    case 'rewind': // 倒片：沙沙
      for (let i = 0; i < 4; i++) noise({ at: i * 0.06, dur: 0.05, gain: 0.06, freq: 3000, q: 1.2 });
      break;
    // 劇本 v5.6：窗外的雞叫、樓梯間的拖鞋聲
    case 'rooster': // 遠遠的雞叫：幾段往上滑再拉長的聲音
      tone(520, { dur: 0.18, gain: 0.04, type: 'sawtooth', to: 780 });
      tone(780, { at: 0.2, dur: 0.22, gain: 0.04, type: 'sawtooth', to: 900 });
      tone(900, { at: 0.44, dur: 0.7, gain: 0.035, type: 'sawtooth', to: 620 });
      break;
    case 'slipper': // 拖鞋一步一步下樓
      for (let i = 0; i < 6; i++) noise({ at: i * 0.38, dur: 0.08, gain: 0.08, freq: 600, q: 1.4 });
      break;
    default: break;
  }
}

// 環境聲（循環）：rain 雨、heater 暖氣、room 屋內、cafe 咖啡店、hum 日光燈、scooter 機車、lobby 公司大廳、store 超商
let pendingAmbient = null;
let pendingLevel = 1;
let engine = null; // 錄音：{ rate }（playbackRate）；合成：{ o, o2 }（振盪器）
let pendingRev = 0;
const ENGINE_RATE = 0.2; // 【待定】錄音：怠速 1.0 → 往前騎 1.2，不要誇張到變調好笑
const clampRev = (rev) => Math.max(0, Math.min(1, rev));
// 引擎轉速：0＝怠速、1＝往前騎（只影響 engine 環境聲）；ramp＝錄音幾秒滑到位（合成固定 0.35 秒）
export function setEngine(rev, ramp = 0.6) {
  pendingRev = clampRev(rev);
  if (!ctx || !engine) return;
  const t = ctx.currentTime;
  if (engine.rate) { // 【待定】
    engine.rate.cancelScheduledValues(t); // 【待定】
    engine.rate.setValueAtTime(engine.rate.value, t); // 【待定】
    engine.rate.linearRampToValueAtTime(1 + pendingRev * ENGINE_RATE, t + ramp); // 【待定】
    return; // 【待定】
  } // 【待定】
  const f = 38 + pendingRev * 42;
  for (const [o, k] of [[engine.o, 1], [engine.o2, 0.5]]) {
    o.frequency.cancelScheduledValues(t);
    o.frequency.setValueAtTime(o.frequency.value, t);
    o.frequency.linearRampToValueAtTime(f * k, t + 0.35);
  }
}
// 引擎轉速曲線：steps＝[{ t, rev }, ...]，t 是從現在起算的秒數（遞增），每段直線滑過去，不急降、不抖。
// 過彎、迴轉用這個，不另外播一次性音效（rev 錄音是冷車爆音，疊上去像要故障）。
export function setEnginePath(steps) {
  if (!steps.length) return;
  pendingRev = clampRev(steps[steps.length - 1].rev);
  if (!ctx || !engine) return;
  const now = ctx.currentTime;
  const params = engine.rate ? [[engine.rate, null]] : [[engine.o.frequency, 1], [engine.o2.frequency, 0.5]];
  for (const [p, k] of params) {
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    for (const s of steps) {
      const r = clampRev(s.rev);
      p.linearRampToValueAtTime(k === null ? 1 + r * ENGINE_RATE : (38 + r * 42) * k, now + s.t);
    }
  }
}
// 轉彎（對齊 road.turn 1.5 秒）：輕加油 → 過彎小收油 → 出彎平順加油 → 回怠速
export const ENGINE_TURN = Object.freeze([
  { t: 0.3, rev: 0.5 },
  { t: 0.85, rev: 0.28 },
  { t: 1.25, rev: 0.58 },
  { t: 1.5, rev: 0 },
]);
// 迴轉（對齊 road.uturn 1.6 秒）：更慢、更收油；輕帶油 → 壓低接近怠速 → 轉完帶一點油 → 回怠速
export const ENGINE_UTURN = Object.freeze([
  { t: 0.25, rev: 0.35 },
  { t: 1.05, rev: 0.15 },
  { t: 1.35, rev: 0.42 },
  { t: 1.6, rev: 0 },
]);
// 調整目前環境聲的音量（例如推開咖啡豆行的門，磨豆機聲變大）
export function setAmbientLevel(level) {
  pendingLevel = level;
  if (!ctx || !ambient) return;
  const t = ctx.currentTime;
  ambient.gain.gain.cancelScheduledValues(t);
  ambient.gain.gain.setValueAtTime(ambient.gain.gain.value, t);
  ambient.gain.gain.linearRampToValueAtTime(level, t + 0.8);
}
export function setAmbient(name, level = 1) {
  pendingAmbient = name;
  pendingLevel = level;
  if (!ctx) return;
  if (ambient?.name === name) { setAmbientLevel(level); return; }
  ambient?.stop();
  ambient = null;
  engine = null;
  if (!name) return;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(level, ctx.currentTime + 1.2);
  g.connect(master);
  const nodes = [];
  const amb = {
    name,
    gain: g,
    stopped: false, // 【待定】
    stop() {
      amb.stopped = true; // 【待定】還在載的錄音到了也不接
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* 已停 */ } }), 900);
    },
  };
  ambient = amb;
  const s = loadSfx(name); // 【待定】有錄音就循環播錄音；載不到才合成
  if (!s || s.failed) { synthAmbient(name, g, nodes); return; } // 【待定】
  const startFile = (buf) => { // 【待定】
    if (amb.stopped || ambient !== amb) return; // 【待定】
    if (!buf) { synthAmbient(name, g, nodes); return; } // 【待定】
    const src = ctx.createBufferSource(); // 【待定】
    src.buffer = buf; // 【待定】
    src.loop = true; // 【待定】檔案本身已剪成可循環
    const pg = ctx.createGain(); // 【待定】每個名稱的增益；晚到也從 0 淡入
    const t = ctx.currentTime; // 【待定】
    pg.gain.setValueAtTime(0, t); // 【待定】
    pg.gain.linearRampToValueAtTime(sfxGain(name), t + 1.2); // 【待定】
    src.connect(pg).connect(g); // 【待定】
    src.start(); // 【待定】
    nodes.push(src); // 【待定】
    if (name === 'engine') { engine = { rate: src.playbackRate }; setEngine(pendingRev); } // 【待定】怠速錄音：轉速改播放速度
  }; // 【待定】
  if (s.buf) startFile(s.buf); else s.p.then(startFile); // 【待定】
}

// 原本的合成環境聲（錄音載不到時的退路）
function synthAmbient(name, g, nodes) { // 【待定】
  const loopNoise = (freq, q, gain, type = 'bandpass') => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(3);
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const gg = ctx.createGain();
    gg.gain.value = gain;
    s.connect(f).connect(gg).connect(g);
    s.start();
    nodes.push(s);
  };
  const hum = (freq, gain, type = 'sine') => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const gg = ctx.createGain();
    gg.gain.value = gain;
    o.connect(gg).connect(g);
    o.start();
    nodes.push(o);
    return o;
  };
  if (name === 'rain') { loopNoise(1800, 0.4, 0.12); loopNoise(400, 0.6, 0.05); }
  else if (name === 'heater') { loopNoise(250, 0.5, 0.08, 'lowpass'); hum(55, 0.02); }
  else if (name === 'room') loopNoise(500, 0.3, 0.015);
  else if (name === 'cafe') { loopNoise(700, 0.4, 0.025); }
  else if (name === 'shop') loopNoise(600, 0.3, 0.012);
  else if (name === 'fan') { loopNoise(350, 0.4, 0.03, 'lowpass'); hum(4, 0.004); }
  else if (name === 'grinder') { loopNoise(700, 0.4, 0.02); loopNoise(2600, 4, 0.012); }
  else if (name === 'hum') { hum(120, 0.02, 'sawtooth'); loopNoise(3000, 1, 0.006); }
  else if (name === 'wind') { loopNoise(380, 0.4, 0.05, 'lowpass'); loopNoise(1200, 0.6, 0.012); }
  else if (name === 'insects') { loopNoise(4200, 8, 0.012); loopNoise(5600, 10, 0.008); } // 夏夜蟲鳴：輕的高頻細聲
  else if (name === 'lobby' || name === 'store') { loopNoise(300, 0.4, 0.025, 'lowpass'); hum(100, 0.004); }
  else if (name === 'scooter') { hum(70, 0.05, 'sawtooth'); loopNoise(300, 0.5, 0.05, 'lowpass'); }
  else if (name === 'engine') { // 騎在黑路上：怠速／往前騎由 setEngine() 調轉速
    const o = hum(38, 0.05, 'sawtooth');
    const o2 = hum(19, 0.03, 'square');
    loopNoise(260, 0.6, 0.04, 'lowpass');
    loopNoise(1400, 0.5, 0.008); // 夜裡的風、蟲
    engine = { o, o2 };
    setEngine(pendingRev);
  }
}
