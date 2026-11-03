// 店裡的聲音與音樂：全部用 WebAudio 即時合成，不用音檔（沒有授權問題，見計畫 Q11、決定 D99～D101）。
// 不依賴 Three.js 與 DOM；瀏覽器要等玩家點過畫面（unlock）才能出聲，沒有 AudioContext 時所有函式都是空動作。
//
// 音樂：慵懶的日系咖啡店電鋼琴（Bbmaj7 → C7sus → Am7 → Dm7 → Gm7 → C7 → Fmaj7 → Dm9 八小節循環），
//   白天有很輕的刷鼓；打烊後換成更慢、更稀疏、更暗的版本；店裡擺了黑膠唱機時多一點唱針的沙沙聲。
// 店裡的聲音：磨豆、熱水壺注水、倒進杯子、杯子放上桌、門口的鈴、關燈的「喀」、窗外經過的機車、
//   雨打在鐵皮雨遮上、颱風夜的風；開場的辦公室有日光燈的嗡嗡聲與鍵盤聲，信封裡的鑰匙會響。
// 音量預設「小」，選單可以調、可以分別關掉音樂與店裡的聲音。

export const VOLUMES = [0.32, 0.6, 0.95]; // 小、中、大
export const VOLUME_NAMES = ['小', '中', '大'];

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// 八小節的和弦：[低音, 和弦音…]（MIDI 音高）
const CHORDS = [
  [46, 58, 62, 65, 69], // Bbmaj7
  [48, 58, 62, 65, 67], // C7sus4
  [45, 55, 60, 64, 67], // Am7
  [50, 57, 60, 64, 65], // Dm7(11)
  [43, 53, 58, 62, 65], // Gm7
  [48, 58, 62, 64, 67], // C7
  [41, 57, 60, 64, 69], // Fmaj7
  [50, 57, 60, 64, 65], // Dm9
];
const MELODY = [65, 67, 69, 72, 74, 77, 79, 81]; // F 大調五聲音階（F G A C D）
const STYLES = {
  day: { bpm: 68, cutoff: 3000, brush: 0.05, melody: 0.32, comp: 0.55, gain: 1.0 },
  night: { bpm: 56, cutoff: 1700, brush: 0, melody: 0.18, comp: 0.25, gain: 0.85 },
};

export function createAudio({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let ctx = null;
  let nodes = null;
  const want = { music: true, sfx: true, volume: 0, weather: 'clear', night: false, closingStyle: false, vinyl: false, inShop: false, office: false, duck: 1 };
  const loops = new Map(); // 正在播的長音（磨豆、注水……）
  const stats = { started: false, sfx: {}, bars: 0, lastSfx: '' };
  let musicTimer = null;
  let nextBar = 0, bar = 0;
  let bikeAt = 0;

  /* ---------- 建立 ---------- */
  function init() {
    if (ctx || !AudioContextClass) return !!ctx;
    try {
      ctx = new AudioContextClass();
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // 簡單的房間殘響：一段往下掉的雜訊
      const len = Math.floor(ctx.sampleRate * 2.2);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const ch = ir.getChannelData(c);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      }
      const master = ctx.createGain(); master.gain.value = 0;
      master.connect(ctx.destination);
      const meter = ctx.createAnalyser(); meter.fftSize = 2048; // 給測試看「真的有聲音、沒有爆音」
      master.connect(meter);
      const reverb = ctx.createConvolver(); reverb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.28;
      reverb.connect(wet).connect(master);
      // 音樂：自己的音量（開關、打烊、德叔把音樂調小）→ 一個暖暖的低通 → 主音量（也送一點進殘響）
      const musicBus = ctx.createGain(); musicBus.gain.value = 0;
      const musicTone = ctx.createBiquadFilter(); musicTone.type = 'lowpass'; musicTone.frequency.value = STYLES.day.cutoff; musicTone.Q.value = 0.3;
      musicBus.connect(musicTone);
      musicTone.connect(master);
      musicTone.connect(reverb);
      // 店裡的聲音
      const sfxBus = ctx.createGain(); sfxBus.gain.value = 0;
      sfxBus.connect(master);
      const sfxVerb = ctx.createGain(); sfxVerb.gain.value = 0.35;
      sfxBus.connect(sfxVerb).connect(reverb);
      // 風雨：白噪音濾波＋一陣一陣的風（沿用階段 4 的做法）
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const rainF = ctx.createBiquadFilter(); rainF.type = 'bandpass'; rainF.frequency.value = 2400; rainF.Q.value = 0.5;
      const rainG = ctx.createGain(); rainG.gain.value = 0;
      src.connect(rainF).connect(rainG).connect(sfxBus);
      const windF = ctx.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 420;
      const windG = ctx.createGain(); windG.gain.value = 0;
      src.connect(windF).connect(windG).connect(sfxBus);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0;
      lfo.connect(lfoG).connect(windG.gain);
      // 唱針的沙沙聲（店裡有黑膠唱機才有）
      const crackF = ctx.createBiquadFilter(); crackF.type = 'highpass'; crackF.frequency.value = 3800;
      const crackG = ctx.createGain(); crackG.gain.value = 0;
      src.connect(crackF).connect(crackG).connect(musicBus);
      lfo.start(); src.start();
      nodes = { noise, master, meter, reverb, musicBus, musicTone, sfxBus, rainG, windG, lfoG, crackG };
      setInterval(tick, 120);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  const live = () => ctx && nodes && ctx.state === 'running';
  const T = () => ctx.currentTime;

  /* ---------- 小零件 ---------- */
  function noiseSrc(t, dur, out, { type = 'bandpass', freq = 1000, q = 1, gain = 0.2, attack = 0.005, release = null } = {}) {
    const s = ctx.createBufferSource(); s.buffer = nodes.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setTargetAtTime(0, t + attack, release ?? dur / 3);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.6);
    return { s, f, g };
  }
  function tone(t, freq, dur, out, { type = 'sine', gain = 0.1, attack = 0.005, decay = 0.3, detune = 0 } = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setTargetAtTime(0, t + attack, decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + decay * 5);
    return o;
  }
  // 電鋼琴：正弦波＋一個會慢慢消失的 FM 調變（敲下去亮一點，之後變圓）
  function epiano(t, note, vel, out, len = 2.4) {
    const f = midi(note);
    const car = ctx.createOscillator(); car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = f;
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(f * 1.6 * vel, t);
    modG.gain.setTargetAtTime(f * 0.15, t, 0.25);
    mod.connect(modG).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.012);
    g.gain.setTargetAtTime(0.035 * vel, t + 0.012, 0.5);
    g.gain.setTargetAtTime(0, t + len, 0.35);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.5; car.connect(g).connect(pan).connect(out); } else car.connect(g).connect(out);
    car.start(t); mod.start(t);
    car.stop(t + len + 2); mod.stop(t + len + 2);
  }
  // 旋律：像音樂盒，很輕
  function bell(t, note, vel, out) {
    const f = midi(note);
    tone(t, f, 0.05, out, { gain: 0.05 * vel, decay: 0.55 });
    tone(t, f * 3, 0.02, out, { gain: 0.008 * vel, decay: 0.18 });
  }

  /* ---------- 音樂 ---------- */
  function scheduleBar(t) {
    const st = want.closingStyle ? STYLES.night : STYLES.day;
    const beat = 60 / st.bpm;
    const ch = CHORDS[bar % CHORDS.length];
    const out = nodes.musicBus;
    // 低音：第一拍，偶爾第三拍
    tone(t, midi(ch[0]), beat * 1.6, out, { type: 'triangle', gain: 0.075, attack: 0.02, decay: beat * 0.9 });
    if (Math.random() < 0.55) tone(t + beat * 2, midi(ch[0] + (Math.random() < 0.5 ? 7 : 12)), beat, out, { type: 'triangle', gain: 0.05, attack: 0.02, decay: beat * 0.6 });
    // 和弦：第一拍輕輕刷下去，偶爾在第二拍半補一下
    ch.slice(1).forEach((n, i) => epiano(t + i * 0.035 + Math.random() * 0.01, n, 0.55 + Math.random() * 0.15, out, beat * 3.6));
    if (Math.random() < st.comp) ch.slice(2).forEach((n, i) => epiano(t + beat * 2.5 + i * 0.03, n, 0.32, out, beat * 1.2));
    // 旋律：五聲音階上零零星星幾個音（搖擺一點）
    let prev = 2 + Math.floor(Math.random() * 4);
    for (let h = 0; h < 8; h++) {
      if (Math.random() > st.melody) continue;
      prev = Math.max(0, Math.min(MELODY.length - 1, prev + Math.floor(Math.random() * 5) - 2));
      const swing = h % 2 ? beat * 0.16 : 0;
      bell(t + h * beat / 2 + swing, MELODY[prev], 0.7 + Math.random() * 0.3, out);
    }
    // 刷鼓：第二、四拍很輕的一下
    if (st.brush) for (const b of [1, 3]) noiseSrc(t + b * beat, 0.18, out, { type: 'bandpass', freq: 5200, q: 0.7, gain: st.brush, attack: 0.01, release: 0.06 });
    stats.bars++;
    bar++;
    return beat * 4;
  }
  function musicLevel() {
    if (!want.music || !want.inShop) return 0;
    const st = want.closingStyle ? STYLES.night : STYLES.day;
    return st.gain * want.duck;
  }

  /* ---------- 每 120ms 排一次：音樂往前排、長音的顆粒、窗外的機車、鐵皮雨遮上的雨滴 ---------- */
  function tick() {
    if (!live()) return;
    const t = T();
    if (musicLevel() > 0) {
      if (nextBar < t + 0.05) nextBar = t + 0.15;
      while (nextBar < t + 0.5) nextBar += scheduleBar(nextBar);
    } else nextBar = 0;
    for (const [name, l] of loops) if (l.grain) l.grain(t);
    if (want.sfx && want.inShop) {
      // 窗外偶爾有機車經過（白天、不是颱風夜）
      if (!bikeAt) bikeAt = t + 25 + Math.random() * 60;
      if (t > bikeAt) {
        bikeAt = t + 80 + Math.random() * 140;
        if (!want.night && want.weather !== 'typhoon') play('motorbike');
      }
      // 雨打在鐵皮雨遮上：一顆一顆的小「答」
      if (want.weather !== 'clear') {
        const n = want.weather === 'typhoon' ? 6 : 3;
        for (let i = 0; i < n; i++) if (Math.random() < 0.7) noiseSrc(t + Math.random() * 0.12, 0.03, nodes.sfxBus, { type: 'bandpass', freq: 2600 + Math.random() * 2600, q: 6, gain: 0.05 + Math.random() * 0.05, attack: 0.001, release: 0.012 });
      }
    }
  }

  /* ---------- 套用目前的狀態到各個音量 ---------- */
  function apply() {
    if (!ctx || !nodes) return;
    const t = T();
    nodes.master.gain.setTargetAtTime(VOLUMES[want.volume] ?? VOLUMES[0], t, 0.4);
    nodes.musicBus.gain.setTargetAtTime(musicLevel(), t, 1.2);
    nodes.musicTone.frequency.setTargetAtTime((want.closingStyle ? STYLES.night : STYLES.day).cutoff, t, 2);
    nodes.crackG.gain.setTargetAtTime(want.vinyl ? 0.012 : 0, t, 1);
    const s = want.sfx;
    nodes.sfxBus.gain.setTargetAtTime(s ? 1 : 0, t, 0.3);
    const w = want.weather;
    nodes.rainG.gain.setTargetAtTime(s && w === 'typhoon' ? 0.16 : s && w === 'rain' ? 0.07 : 0, t, 0.8);
    nodes.windG.gain.setTargetAtTime(s && w === 'typhoon' ? 0.32 : 0, t, 0.8);
    nodes.lfoG.gain.setTargetAtTime(s && w === 'typhoon' ? 0.22 : 0, t, 0.8);
    // 開場的辦公室：日光燈的嗡嗡聲
    if (want.office && s && !loops.has('office')) startLoop('office');
    if ((!want.office || !s) && loops.has('office')) stopLoop('office');
  }

  /* ---------- 單發的聲音 ---------- */
  function play(name, opt = {}) {
    if (!want.sfx || !live()) return;
    const t = T() + 0.01;
    const out = nodes.sfxBus;
    stats.sfx[name] = (stats.sfx[name] || 0) + 1;
    stats.lastSfx = name;
    switch (name) {
      case 'cup': { // 杯子放上桌：瓷器輕輕一碰
        const base = opt.enamel ? 1450 : 2150;
        for (const [k, g] of [[1, 0.05], [1.58, 0.03], [2.41, 0.018]]) tone(t, base * k, 0.01, out, { gain: g, decay: 0.09 });
        noiseSrc(t, 0.02, out, { type: 'lowpass', freq: 700, gain: 0.05, release: 0.02 });
        break;
      }
      case 'bell': { // 門口的鈴：兩三下黃銅小鈴
        for (let i = 0; i < 3; i++) {
          const tt = t + i * 0.13 + Math.random() * 0.03, v = i ? 0.6 : 1;
          for (const [k, g] of [[1, 0.04], [2.76, 0.022], [5.4, 0.01]]) tone(tt, 1980 * k, 0.005, out, { gain: g * v, decay: 0.4 / k ** 0.3 });
        }
        break;
      }
      case 'click': // 關燈的「喀」
        noiseSrc(t, 0.01, out, { type: 'highpass', freq: 2500, gain: 0.12, attack: 0.001, release: 0.006 });
        tone(t, 140, 0.01, out, { gain: 0.06, decay: 0.025 });
        break;
      case 'keys': // 信封裡的鑰匙
        for (let i = 0; i < 9; i++) {
          const tt = t + Math.random() * 0.7;
          tone(tt, 3000 + Math.random() * 3200, 0.002, out, { gain: 0.02 + Math.random() * 0.02, decay: 0.05 + Math.random() * 0.06 });
        }
        break;
      case 'key': // 鍵盤：一下
        noiseSrc(t, 0.02, out, { type: 'bandpass', freq: 1800 + Math.random() * 900, q: 2, gain: 0.07, attack: 0.001, release: 0.012 });
        tone(t, 220 + Math.random() * 60, 0.005, out, { gain: 0.03, decay: 0.02 });
        break;
      case 'enter': // 按下送出：重一點的一下
        noiseSrc(t, 0.03, out, { type: 'bandpass', freq: 1300, q: 1.5, gain: 0.12, attack: 0.001, release: 0.02 });
        tone(t, 160, 0.01, out, { gain: 0.05, decay: 0.04 });
        break;
      case 'thunder': // 颱風夜的閃電之後：遠遠的悶雷
        noiseSrc(t + 0.4 + Math.random() * 0.8, 2.6, out, { type: 'lowpass', freq: 160, q: 0.7, gain: 0.35, attack: 0.25, release: 0.9 });
        break;
      case 'steps': // 門外的腳步聲（承峰 11/3 回饋）：石板路上五步，由遠走近，悶悶的、很小聲
        for (let i = 0; i < 5; i++) {
          const tt = t + i * 0.52 + Math.random() * 0.06, v = 0.35 + i * 0.16;
          noiseSrc(tt, 0.05, out, { type: 'lowpass', freq: 380 + i * 30, gain: 0.05 * v, attack: 0.004, release: 0.07 });
          tone(tt, 85 + Math.random() * 10, 0.004, out, { gain: 0.018 * v, decay: 0.05 });
        }
        break;
      case 'door': // 推門：老木門低低的一聲
        noiseSrc(t, 0.5, out, { type: 'lowpass', freq: 380, gain: 0.08, attack: 0.08, release: 0.2 });
        break;
      case 'motorbike': { // 窗外經過的機車：低低的引擎聲由一邊經過另一邊，隔著窗戶悶悶的
        const dur = 5.5;
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
        const o2 = ctx.createOscillator(); o2.type = 'square';
        for (const [o, m] of [[o1, 1], [o2, 2.02]]) {
          o.frequency.setValueAtTime(48 * m, t);
          o.frequency.linearRampToValueAtTime(63 * m, t + dur * 0.45);
          o.frequency.linearRampToValueAtTime(46 * m, t + dur);
        }
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + dur * 0.45);
        g.gain.linearRampToValueAtTime(0, t + dur);
        const mix = ctx.createGain(); mix.gain.value = 0.5;
        o1.connect(f); o2.connect(mix).connect(f);
        let tail = f.connect(g);
        if (ctx.createStereoPanner) {
          const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.85, t); p.pan.linearRampToValueAtTime(0.85, t + dur);
          tail = tail.connect(p);
        }
        tail.connect(out);
        o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
        break;
      }
      default:
        break;
    }
  }

  /* ---------- 長音：開始與停止（動作多長，聲音就多長） ---------- */
  function startLoop(name) {
    if (!live() || loops.has(name)) return;
    const out = nodes.sfxBus;
    const t = T();
    const l = { stops: [] };
    if (name === 'grind') {
      // 手搖磨豆：一小顆一小顆咬碎豆子的聲音
      let next = t;
      l.grain = (now) => {
        while (next < now + 0.25) {
          noiseSrc(next, 0.04, out, { type: 'bandpass', freq: 900 + Math.random() * 1600, q: 1.4, gain: 0.05 + Math.random() * 0.06, attack: 0.002, release: 0.018 });
          next += 0.035 + Math.random() * 0.045;
        }
      };
      l.grain(t);
    } else if (name === 'pour' || name === 'pourCup' || name === 'office') {
      // 注水：細細的水聲，忽大忽小；倒進杯子：水聲越來越高（杯子滿了）；辦公室：日光燈的嗡嗡聲
      const s = ctx.createBufferSource(); s.buffer = nodes.noise; s.loop = true;
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      if (name === 'office') {
        f.type = 'lowpass'; f.frequency.value = 180;
        g.gain.linearRampToValueAtTime(0.06, t + 1.5);
        const hum = ctx.createOscillator(); hum.frequency.value = 120;
        const hg = ctx.createGain(); hg.gain.value = 0.012;
        hum.connect(hg).connect(g);
        hum.start(t);
        l.stops.push(hum);
      } else {
        f.type = 'bandpass'; f.Q.value = name === 'pour' ? 0.9 : 1.3;
        f.frequency.setValueAtTime(name === 'pour' ? 850 : 700, t);
        if (name === 'pourCup') f.frequency.linearRampToValueAtTime(1500, t + 1.6);
        g.gain.linearRampToValueAtTime(name === 'pour' ? 0.09 : 0.1, t + 0.15);
        const wob = ctx.createOscillator(); wob.frequency.value = 5.5;
        const wg = ctx.createGain(); wg.gain.value = 140;
        wob.connect(wg).connect(f.frequency);
        wob.start(t);
        l.stops.push(wob);
      }
      s.connect(f).connect(g).connect(out);
      s.start(t);
      l.stops.push(s);
      l.g = g;
    }
    stats.sfx[name] = (stats.sfx[name] || 0) + 1;
    stats.lastSfx = name;
    loops.set(name, l);
  }
  function stopLoop(name) {
    const l = loops.get(name);
    if (!l) return;
    loops.delete(name);
    if (!ctx) return;
    const t = T();
    if (l.g) { l.g.gain.cancelScheduledValues(t); l.g.gain.setTargetAtTime(0, t, 0.08); }
    for (const s of l.stops) { try { s.stop(t + 0.5); } catch { /* 已經停了 */ } }
  }

  return {
    // 玩家第一次點畫面時呼叫（瀏覽器規定）
    unlock() {
      if (!want.music && !want.sfx) return;
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume().then(() => { stats.started = true; apply(); }).catch(() => {});
      else { stats.started = true; apply(); }
    },
    // 設定：music、sfx（開關）、volume（0 小／1 中／2 大）；場景：weather、night、closingStyle、vinyl、inShop、office
    set(o) { Object.assign(want, o); apply(); },
    play,
    start: startLoop,
    stop: stopLoop,
    // 德叔把音樂調小：之後一陣子都小聲一點
    duck(level = 0.4, sec = 60) {
      want.duck = level;
      apply();
      clearTimeout(musicTimer);
      musicTimer = setTimeout(() => { want.duck = 1; apply(); }, sec * 1000);
    },
    // 分頁切到背景：整個停下來（省電，也不在背景出聲）
    pause() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && stats.started && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    // 目前輸出的峰值（0～1；測試用）
    peak() {
      if (!nodes) return 0;
      const buf = new Float32Array(nodes.meter.fftSize);
      nodes.meter.getFloatTimeDomainData(buf);
      let m = 0;
      for (const v of buf) m = Math.max(m, Math.abs(v));
      return m;
    },
    get state() {
      return { ctx: ctx ? ctx.state : 'none', started: stats.started, bars: stats.bars, sfx: { ...stats.sfx }, lastSfx: stats.lastSfx, loops: [...loops.keys()], want: { ...want } };
    },
  };
}
