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
    default: break;
  }
}

// 環境聲（循環）：rain 雨、heater 暖氣、room 屋內、cafe 咖啡店、hum 日光燈、scooter 機車
let pendingAmbient = null;
let pendingLevel = 1;
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
  };
  if (name === 'rain') { loopNoise(1800, 0.4, 0.12); loopNoise(400, 0.6, 0.05); }
  else if (name === 'heater') { loopNoise(250, 0.5, 0.08, 'lowpass'); hum(55, 0.02); }
  else if (name === 'room') loopNoise(500, 0.3, 0.015);
  else if (name === 'cafe') { loopNoise(700, 0.4, 0.025); }
  else if (name === 'shop') loopNoise(600, 0.3, 0.012);
  else if (name === 'fan') { loopNoise(350, 0.4, 0.03, 'lowpass'); hum(4, 0.004); }
  else if (name === 'grinder') { loopNoise(700, 0.4, 0.02); loopNoise(2600, 4, 0.012); }
  else if (name === 'hum') { hum(120, 0.02, 'sawtooth'); loopNoise(3000, 1, 0.006); }
  else if (name === 'scooter') { hum(70, 0.05, 'sawtooth'); loopNoise(300, 0.5, 0.05, 'lowpass'); }
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
