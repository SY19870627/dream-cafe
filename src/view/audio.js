// 音效：全部用 WebAudio 即時合成，不用外部音檔。
// 瀏覽器要求第一次觸控之後才能出聲：unlock() 掛在第一次 pointerdown。
let ctx = null;
let master = null;
let ambient = null; // { name, stop() }

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  if (pendingAmbient) setAmbient(pendingAmbient, pendingLevel);
}

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

export function play(name) {
  if (!ctx) return;
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
    case 'door': noise({ dur: 0.6, gain: 0.12, freq: 300, q: 0.7 }); break;
    case 'bell': // 風鈴
      [1568, 2093, 2637, 1760].forEach((f, i) => tone(f, { at: i * 0.12 + Math.random() * 0.05, dur: 1.8, gain: 0.07 }));
      break;
    case 'pour': noise({ dur: 1.4, gain: 0.08, freq: 900, q: 0.6 }); break;
    case 'tick': tone(1800, { dur: 0.05, gain: 0.06, type: 'square' }); break;
    case 'grind': for (let i = 0; i < 16; i++) noise({ at: i * 0.12, dur: 0.1, gain: 0.08, freq: 2500, q: 3 }); break;
    case 'water': noise({ dur: 2.5, gain: 0.05, freq: 600, q: 0.5 }); break;
    case 'domino': tone(900 + Math.random() * 200, { dur: 0.08, gain: 0.12, type: 'triangle' }); noise({ dur: 0.05, gain: 0.1, freq: 2500 }); break;
    case 'plop': tone(600, { dur: 0.25, gain: 0.18, to: 180 }); break;
    case 'sip': noise({ dur: 0.5, gain: 0.05, freq: 1500, q: 0.5 }); break;
    case 'page': noise({ dur: 0.35, gain: 0.12, freq: 3500, q: 0.4 }); break;
    case 'place': tone(320, { dur: 0.18, gain: 0.12, type: 'triangle' }); break;
    case 'tap': tone(660, { dur: 0.12, gain: 0.05 }); break;
    case 'memory': tone(523, { dur: 1.6, gain: 0.05 }); tone(784, { at: 0.2, dur: 1.6, gain: 0.04 }); break;
    case 'copier': noise({ dur: 1.6, gain: 0.05, freq: 500, q: 1.5 }); break;
    // v3b 演出用
    case 'buzz': for (let i = 0; i < 2; i++) tone(140, { at: i * 0.32, dur: 0.22, gain: 0.08, type: 'sawtooth' }); break; // 手機震動
    case 'drip': tone(900, { dur: 0.18, gain: 0.08, to: 420 }); break; // 鋁盆滴水
    case 'ding': tone(1046, { dur: 0.9, gain: 0.06 }); tone(784, { at: 0.35, dur: 1.2, gain: 0.05 }); break; // 電梯
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
    case 'rev': // 掉頭時催一下油門
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
      tone(190, { dur: 0.45, gain: 0.05, type: 'sawtooth', to: 150 });
      noise({ dur: 0.3, gain: 0.04, freq: 700, q: 4 });
      tone(170, { at: 0.5, dur: 0.3, gain: 0.03, type: 'sawtooth', to: 140 });
      break;
    default: break;
  }
}

// 環境聲（循環）：rain 雨、heater 暖氣、room 屋內、cafe 咖啡店、hum 日光燈、scooter 機車
let pendingAmbient = null;
let pendingLevel = 1;
let engine = null; // { o, o2 }：環境聲 engine 的振盪器（調轉速用）
let pendingRev = 0;
// 引擎轉速：0＝怠速、1＝往前騎（只影響 engine 環境聲）
export function setEngine(rev) {
  pendingRev = Math.max(0, Math.min(1, rev));
  if (!ctx || !engine) return;
  const t = ctx.currentTime;
  const f = 38 + pendingRev * 42;
  for (const [o, k] of [[engine.o, 1], [engine.o2, 0.5]]) {
    o.frequency.cancelScheduledValues(t);
    o.frequency.setValueAtTime(o.frequency.value, t);
    o.frequency.linearRampToValueAtTime(f * k, t + 0.35);
  }
}
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
  else if (name === 'lobby') { loopNoise(300, 0.4, 0.025, 'lowpass'); hum(100, 0.004); }
  else if (name === 'scooter') { hum(70, 0.05, 'sawtooth'); loopNoise(300, 0.5, 0.05, 'lowpass'); }
  else if (name === 'engine') { // 騎在黑路上：怠速／往前騎由 setEngine() 調轉速
    const o = hum(38, 0.05, 'sawtooth');
    const o2 = hum(19, 0.03, 'square');
    loopNoise(260, 0.6, 0.04, 'lowpass');
    loopNoise(1400, 0.5, 0.008); // 夜裡的風、蟲
    engine = { o, o2 };
    setEngine(pendingRev);
  }
  ambient = {
    name,
    gain: g,
    stop() {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* 已停 */ } }), 900);
    },
  };
}
