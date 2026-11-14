// 測試共用：照玩家的方式往前走一步（純邏輯，不開瀏覽器）。不是測試檔（npm test 只跑 *.test.mjs）。
// 每一句「點一下」才往下；關卡要做完（passGate／chooseFork／choosePassbook）；可選互動一律不做；
// 自白最後一句（sleep）＝睡著：sleepThrough 直接換到隔天早上。回傳這一步畫面上的那一句（沒有句子的幕回傳 null）。
import assert from 'node:assert/strict';
import * as S from '../../src/story/state.js';

export function step(s, { side = 'left', passbook = 'show' } = {}) {
  const act = s.opening.act;
  const b = (S.ACT_LINES[act] || [])[s.opening.line] || null;
  if (b) {
    if (b.gate === 'fork') assert.equal(S.chooseFork(s, side), true, `${act} 岔路`);
    else if (b.gate === 'choice') assert.equal(S.choosePassbook(s, passbook), true, `${act} 存摺`);
    else if (b.gate) assert.equal(S.passGate(s, b.gate), true, `${act} ${b.gate}`);
    if (b.sleep) { assert.equal(S.sleepThrough(s), true, `${act} 睡著`); return b; }
    const n = S.nextLine(s);
    if (n >= 0) { assert.equal(S.setOpeningLine(s, n), true, `${act} 第 ${n} 句`); return b; }
  }
  assert.equal(S.setOpeningAct(s, S.nextActOf(act)), true, `${act} → 下一幕`);
  return b;
}

// 一直走到 stop(s) 為真；each(s) 每一步之前呼叫。回傳 { s, seen：讀到的句子 }
export function walk(s, { stop, each = () => {}, ...opt }) {
  const seen = [];
  let guard = 0;
  while (!stop(s)) {
    assert.ok(guard++ < 2000, `走不到終點（停在 ${s.opening.act} 第 ${s.opening.line} 句）`);
    each(s);
    const b = step(s, opt);
    if (b) seen.push(b);
  }
  each(s);
  return { s, seen };
}
