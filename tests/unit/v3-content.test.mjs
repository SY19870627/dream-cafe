// v3.0 驗證版：夢想資料、開場字句與第一版一致、公司對話逐字、機關長度、可點範圍。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DREAMS, DREAM_ORDER, getDream } from '../../src/dreams/index.js';
import { DREAM_TEXT, SOURCE } from '../../src/lines/dreams.js';
import * as OP from '../../src/lines/opening.js';
import { COMPANY_TALK, SLEEVE } from '../../src/lines/company.js';
import { SERVE, deshuLines } from '../../src/lines/shop.js';
import * as D from '../../src/day.js';
import { COMPANY_STEPS } from '../../src/day.js';
import { INTERACTIONS, recognize, ambientLevel } from '../../src/dreams/interact.js';
import { ROUTE, START, DURATION, SOUND_EVENTS, drawMachine, progress } from '../../src/machine.js';
import { dreamScene, shopScene, EXIT_LABEL } from '../../src/view/scenes.js';
import { MIN_HIT, TAP_SLOP } from '../../src/view/pano.js';
import { sequence } from '../../src/story/script.js';
import { drawShape, ASPECT } from '../../src/view/draft.js';
import { RIDE_MS, drawRide, drawCounter, drawSleeve, drawLeave, talkBeats } from '../../src/view/company.js';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const SPEC = read('docs/規格書.md');

// 什麼都不畫的 canvas context（測試畫圖函式不會丟錯）
function mockCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(_, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set() { return true; },
  });
}

test('五條夢想照規格書種子清單前五條的固定順序', () => {
  assert.equal(DREAM_ORDER.length, 5);
  assert.deepEqual(DREAM_TEXT.map((d) => d.id), DREAM_ORDER);
  const seeds = SPEC.match(/種子清單（作者已列）：\s*((?:\d+\. .+\r?\n)+)/)[1].trim().split('\n').map((l) => l.replace(/^\d+\. /, '').trim());
  assert.deepEqual(DREAM_TEXT.map((d) => d.seed), seeds.slice(0, 5), 'seed 欄位逐字等於規格書種子清單前五條');
  DREAMS.forEach((d, i) => assert.equal(d.day, i + 1));
});

test('每條夢想：3～4 個可點物件、各一行字、恰好一個像記憶的物件、帶回一樣東西、粗稿標記', () => {
  for (const d of DREAMS) {
    assert.ok(d.objects.length >= 3 && d.objects.length <= 4, d.id);
    assert.equal(d.objects.filter((o) => o.memory).length, 1, `${d.id} 恰好一個像記憶的物件`);
    for (const o of d.objects) {
      assert.equal(typeof o.line, 'string');
      assert.ok(!o.line.includes('\n'), '一行字');
      assert.ok(Number.isFinite(o.angle) && Number.isFinite(o.depth) && o.shape, `${d.id}/${o.id} 有版面`);
    }
    assert.equal(new Set(d.objects.map((o) => o.id)).size, d.objects.length);
    assert.ok(d.takeaway.name && d.takeaway.shape);
    assert.equal(d.draft, true);
    assert.equal(d.art, '粗稿');
    assert.ok(d.title);
  }
});

test('夢想文字只來自 fable52 稿，所有新文字保留【待定】', () => {
  assert.equal(SOURCE.model, 'claude-fable-5-2');
  assert.match(SOURCE.file, /fable52-draft\.md$/);
  assert.doesNotMatch(SOURCE.file, /fable-draft\.md$/);
  for (const d of DREAM_TEXT) {
    assert.ok(d.title.startsWith('【待定】'), d.title);
    assert.ok(d.bringBack.name.startsWith('【待定】'));
    assert.equal(d.interaction.status, '【待定】');
    for (const o of d.objects) {
      assert.ok(o.name.startsWith('【待定】'), o.name);
      assert.ok(o.line.startsWith('【待定】'), o.line);
    }
  }
});

test('夢想文字與 fable52-draft.md 的 JSON 逐字相同（本機有稿子時才比對）', (t) => {
  const p = root('_agent/v3a/fable52-draft.md');
  if (!existsSync(p)) { t.skip('沒有 _agent/v3a/fable52-draft.md'); return; }
  const md = readFileSync(p, 'utf8');
  const json = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]);
  assert.equal(json.dreams.length, 5);
  json.dreams.forEach((src, i) => {
    const mine = DREAM_TEXT[i];
    assert.equal(mine.id, src.id);
    assert.equal(mine.title, src.title);
    assert.deepEqual(mine.scene, src.scene);
    assert.deepEqual(mine.objects, src.objects);
    assert.deepEqual(mine.oldLady, src.oldLady);
    assert.deepEqual(mine.bringBack, src.bringBack);
    assert.deepEqual(mine.interaction, src.interaction);
  });
});

test('老太太：每場都在、不可點、不標示，天數越後越近', () => {
  let last = -1;
  for (const d of DREAMS) {
    assert.equal(d.granny.clickable, false);
    assert.equal(d.granny.labeled, false);
    assert.ok(d.granny.depth > last, `${d.id} 比前一天近`);
    last = d.granny.depth;
    const { scene } = dreamScene(d.id);
    const g = scene.items.filter((it) => it.id === 'granny');
    assert.equal(g.length, 1, '每場一位');
    assert.ok(!g[0].hit, '不可點');
    assert.ok(!g[0].label && !g[0].showLabel, '不標示');
  }
  const dist = DREAMS.map((d) => d.granny.distanceM);
  assert.deepEqual([...dist].sort((a, b) => b - a), dist, '距離逐日變短');
});

test('夢想場景：每個物件可點、有場景內出口回店，出口不是工具列選單', () => {
  for (const id of DREAM_ORDER) {
    const { scene, dream } = dreamScene(id);
    const objs = scene.items.filter((it) => it.kind === 'object');
    assert.equal(objs.length, dream.objects.length);
    assert.ok(objs.every((o) => o.hit));
    const exits = scene.items.filter((it) => it.kind === 'exit');
    assert.equal(exits.length, 1);
    assert.equal(exits[0].label, EXIT_LABEL);
    assert.ok(Number.isFinite(exits[0].angle));
    const clickable = scene.items.filter((it) => it.hit);
    assert.equal(clickable.length, dream.objects.length + 1, '除了物件與出口沒有別的可點');
  }
});

test('店裡：開場時椅子可點；帶回來的東西上架可點，龍眼每天靠近一點', () => {
  const sit = shopScene({ mode: 'sit', day: 0 });
  assert.ok(sit.items.find((it) => it.id === 'seat')?.hit);
  const s = shopScene({ mode: 'seated', day: 3, takeaways: DREAM_ORDER.slice(0, 3) });
  assert.equal(s.items.filter((it) => it.takeaway).length, 3);
  const depths = [1, 2, 3, 4, 5].map((day) => shopScene({ day }).items.find((it) => it.id === 'longan').depth);
  assert.deepEqual([...depths].sort((a, b) => a - b), depths);
});

test('開場字句與第一版原文一字不差', () => {
  const legacy = ['legacy/src/letters.js', 'legacy/src/opening.js', 'legacy/src/main.js'].map(read).join('\n');
  const script = read('legacy/docs/第一站劇本.md');
  const has = (s) => assert.ok(legacy.includes(s), `legacy 找不到：${s}`);
  for (const r of OP.RESIGNATIONS) { has(`{ id: '${r.id}', text: '${r.text}' }`); assert.ok(script.includes(`「${r.text}」`)); }
  has(`to: '${OP.RESIGNATION_MAIL.to}'`);
  has(`subject: '${OP.RESIGNATION_MAIL.subject}'`);
  for (const p of OP.RESIGNATION_MAIL.body) has(`'${p}'`);
  for (const p of OP.LAWYER_LETTER.paragraphs) { has(`'${p}'`); assert.ok(script.includes(p), `劇本找不到：${p}`); }
  has(OP.LAWYER_LETTER.attachment);
  for (const v of [OP.OFFICE.clock, OP.OFFICE.clockAfter, OP.OFFICE.question, OP.OFFICE.sign, OP.OFFICE.signPlaceholder, OP.OFFICE.signEnd, OP.OFFICE.send, OP.OFFICE.keys, OP.OFFICE.to, OP.OFFICE.subject]) has(v);
  has(OP.TITLE.lines.join('<br>'));
  has(OP.TITLE.sub);
  has(`>${OP.TITLE.next}<`);
  for (const l of OP.TITLE.links) has(`href="${l.href}"`);
  for (const v of [OP.MAILBOX.caption, OP.MAILBOX.tap, OP.MAILBOX.shaken, OP.MAILBOX.boxLabel, OP.MAILBOX.artLabel, OP.MAILBOX.next]) has(v);
  has(OP.ROAD.caption.join('<br>'));
  has(OP.ROAD.artLabel);
  has(OP.ROAD.door);
  for (const l of OP.DESHU_ENTER) { has(`'${l}'`); assert.ok(script.includes(`「${l}」`)); }
  has(`'${OP.SIT}'`);
  assert.ok(script.includes(`「${OP.SIT}」`));
});

test('公司對話逐字取自規格書範例（含原有用字），順序相同', () => {
  const para = SPEC.split('\n').find((l) => l.includes('欸，聽說你開咖啡店喔'));
  assert.ok(para);
  let from = 0;
  for (const l of COMPANY_TALK) {
    const at = para.indexOf(l.who === 'act' ? l.text : `「${l.text}」`, from);
    assert.ok(at >= from, `規格書找不到或順序不對：${l.text}`);
    from = at + l.text.length;
  }
  // 規格書範例裡的每一段引號都有收進來
  const quoted = [...para.matchAll(/「([^」]*)」/g)].map((m) => m[1]);
  assert.deepEqual(COMPANY_TALK.filter((l) => l.who !== 'act').map((l) => l.text), quoted);
  assert.ok(COMPANY_TALK.some((l) => l.text.includes('你們哧？')), '原有用字照抄');
  assert.equal(SLEEVE, '王');
  assert.ok(SPEC.includes('杯套上寫「王」'));
});

test('公司：舞台動作只演不出字、不多要點擊；同事的笑在離開之後才演一次', () => {
  const beats = talkBeats();
  assert.equal(beats.length, COMPANY_TALK.length, '每一拍對上一筆，存檔的 line 編號不變');
  const says = beats.filter((b) => b.type === 'say');
  // 顯示出來的字只有引號裡的對話
  const para = SPEC.split('\n').find((l) => l.includes('欸，聽說你開咖啡店喔'));
  assert.deepEqual(says.map((b) => b.text), [...para.matchAll(/「([^」]*)」/g)].map((m) => m[1]));
  assert.ok(says.every((b) => b.who === 'me' || b.who === 'colleague'), '沒有旁白說話者');
  for (const l of COMPANY_TALK.filter((x) => x.who === 'act')) assert.ok(!says.some((b) => b.text === l.text), `不顯示：${l.text}`);
  // 袋子：對話當下演出；笑：對話中不演，留到 laugh
  assert.deepEqual(beats.filter((b) => b.type === 'cue').map((b) => b.cue), ['bag']);
  assert.deepEqual(beats.filter((b) => b.type === 'deferred').map((b) => b.cue), ['laugh']);
  assert.ok(COMPANY_STEPS.indexOf('leave') < COMPANY_STEPS.indexOf('laugh'), '先離開，才笑');
  // 玩家要點的次數＝對話句數（舞台動作不加點擊）
  assert.equal(says.length, 8);
  // 對話畫面的同事不笑
  const src = read('src/view/company.js');
  assert.match(src, /drawCounter\(g, W, H, t, \{ bag, smile: 0 \}\)/);
  assert.doesNotMatch(read('src/main.js'), /act: '/);
});

test('開場第四幕兩句原文與第一版一字不差：v3b 接在坐下之後、第一天之前（legacy：v3a deshuLines／day.js 的第一杯流程仍保留作回歸）', () => {
  const legacyMain = read('legacy/src/main.js');
  const legacyMenu = read('legacy/src/menu.js');
  const script = read('legacy/docs/第一站劇本.md');
  assert.ok(legacyMenu.includes(`served: '${OP.ACT4_CUP}'`));
  assert.ok(script.includes(`「${OP.ACT4_CUP}」`));
  assert.ok(legacyMain.includes(`tsay('${OP.ACT4_EMPTY}'`));
  assert.ok(script.includes(`「${OP.ACT4_EMPTY}」`));
  // 第 1 天：端上杯時先「東山的豆……」再「今天的，請慢用。」；喝完筆記本上桌時「店是空的……」
  assert.deepEqual(deshuLines('drink', 1), [OP.ACT4_CUP, SERVE]);
  assert.deepEqual(deshuLines('notebook', 1), [OP.ACT4_EMPTY]);
  for (let day = 2; day <= 5; day++) {
    assert.deepEqual(deshuLines('drink', day), [SERVE], '之後每天只說規格書那句');
    assert.deepEqual(deshuLines('notebook', day), []);
  }
  for (const p of ['order', 'return', 'rest']) assert.deepEqual(deshuLines(p, 1), []);
  // v3b：泡咖啡流程已從執行畫面拿掉，這兩句改接在坐下之後、第一天之前（閱讀框，杯子已在桌上），原字不變。
  // （v3a 原本斷言 main.js 原始碼裡的 deshuSays(deshuLines(...)) 呼叫；該 UI 已整段移除，改驗 v3b 劇本順序）
  const story = sequence(JSON.parse(read('src/story/final-source.json')), {});
  assert.deepEqual(story.slice(0, 2).map((p) => p.lines[0].text), [OP.ACT4_CUP, OP.ACT4_EMPTY]);
  assert.equal(story[2].id, 'd1-title');
  // v3a 的純邏輯（day.js 仍保留作回歸）照舊走得到第 1 天的 drink、notebook
  const s = D.newState();
  for (const act of D.OPENING_ACTS.slice(1)) D.setOpeningAct(s, act);
  D.finishOpening(s);
  D.order(s, 'iced');
  D.brewDone(s);
  assert.equal(s.phase, 'drink');
  assert.equal(s.day, 1);
  D.drink(s);
  assert.equal(s.phase, 'notebook');
});

test('v3b 執行畫面沒有端杯／喝杯流程，杯子只是道具（legacy：v3a deshuLines 供餐句順序仍保留）', () => {
  // 每天 drink 的最後一句都是規格書的供餐句；第 1 天第一版那句在它前面
  for (let day = 1; day <= 5; day++) assert.equal(deshuLines('drink', day).at(-1), SERVE);
  assert.deepEqual(deshuLines('drink', 1), [OP.ACT4_CUP, SERVE], '第一版兩句仍保留');
  // v3b：執行畫面沒有端杯、喝杯（原本斷言 v3a main.js 的 serveCup／deshuSays 原始碼，該段已移除）。
  // 杯子只是畫在桌上的道具：沒有可點的杯子按鈕、沒有 drink／brew 的流程呼叫。
  const main = read('src/main.js');
  assert.doesNotMatch(main, /serveCup|class="cup"|D\.drink|brewDone|drawMachine/);
});

test('v3b 執行畫面不自動上架、不用計時器推頁或換天（legacy：v3a RETURN_SHOW_MS 範圍仍保留）', () => {
  assert.ok(D.RETURN_SHOW_MS >= 1500 && D.RETURN_SHOW_MS <= 6000, '短暫展示帶回物');
  // v3b：原本斷言 v3a main.js「回店計時自動上架、再自動淡到隔天」的原始碼；v3b 改成玩家讀完才跨天，
  // 所以改驗執行畫面不呼叫 placeTakeaway，也沒有用計時器推頁或換天（推頁只經過 tryAdvance／選項按鈕）。
  const main = read('src/main.js');
  assert.doesNotMatch(main, /placeTakeaway|RETURN_SHOW_MS/);
  for (const m of main.matchAll(/setTimeout\(([^;]*)/g)) assert.doesNotMatch(m[1], /advance|choose|render/, '計時器不推頁');
});

test('夢想互動：每條恰好一個、對上 fable 稿的目標物件，與轉頭手勢分開', () => {
  for (const id of DREAM_ORDER) {
    const def = INTERACTIONS[id];
    const text = DREAM_TEXT.find((d) => d.id === id);
    assert.equal(def.target, text.interaction.target, `${id} 的互動物件照稿`);
    const { scene } = dreamScene(id);
    const g = scene.items.filter((it) => it.gesture);
    assert.equal(g.length, 1, `${id} 只有一個可觸發的互動`);
    assert.equal(g[0].id, def.target);
    assert.equal(g[0].kind, 'object', '互動掛在物件上（點它仍出那一行字）');
    assert.ok(g[0].hit);
    // 做過之後重建場景：沒有可觸發的互動，畫的是做完的樣子
    const after = dreamScene(id, { interacted: true }).scene;
    assert.equal(after.items.filter((it) => it.gesture).length, 0);
  }
  const by = (id, k) => dreamScene(id, { interacted: true }).scene.items.find((it) => it.id === k);
  assert.equal(by('rain-quilt-tv', 'quilt').opt.pulled, true);
  assert.ok(by('hut-heater-hands', 'hands'));
  assert.equal(by('watch-dog-eat-play', 'ball').angle, 96);
  assert.equal(by('watch-dog-eat-play', 'dog').angle, 88, '狗追到球旁邊');
  assert.equal(by('read-in-cafe', 'book').opt.turned, true);
  assert.equal(by('door-coffee-smell', 'door').opt.open, true);
  assert.ok(ambientLevel('door-coffee-smell', false) < ambientLevel('door-coffee-smell', true), '推門後聲音變大');
  // 帶回物還在（球丟出去還是那顆球）
  assert.ok(by('watch-dog-eat-play', 'ball').hit);
});

test('夢想互動的手勢判斷：方向與距離對了才算，輕點不算', () => {
  const tap = { dx: 2, dy: 3, ms: 120, endInside: true };
  for (const k of ['pullUp', 'reach', 'throw', 'flip', 'push']) assert.equal(recognize(k, tap), false, `${k}：輕點不算`);
  assert.equal(recognize('pullUp', { dx: 5, dy: -80 }), true);
  assert.equal(recognize('pullUp', { dx: 5, dy: 80 }), false, '往下拉不算');
  assert.equal(recognize('reach', { dx: 0, dy: -40, ms: 900, endInside: true }), true);
  assert.equal(recognize('reach', { dx: 0, dy: -40, ms: 200, endInside: true }), false, '要停在前面');
  assert.equal(recognize('reach', { dx: 0, dy: -40, ms: 900, endInside: false }), false, '手要停在出風口前');
  assert.equal(recognize('throw', { dx: 90, dy: -40 }), true);
  assert.equal(recognize('flip', { dx: -60, dy: 5 }), true);
  assert.equal(recognize('flip', { dx: 5, dy: -60 }), false);
  assert.equal(recognize('push', { dx: 70, dy: 10 }), true);
});

test('畫面上拖曳在互動物件上交給物件、在空白處轉頭（原始碼）', () => {
  const src = read('src/view/pano.js');
  assert.match(src, /const gesture = hit\?\.item\.gesture \? hit\.item : null;/);
  assert.match(src, /if \(start\.gesture\) \{\s*this\.dragFeedback/);
  assert.match(src, /this\.onGesture\(it, \{ dx/);
});

test('德叔上杯那句是規格書原文', () => {
  assert.equal(SERVE, '今天的，請慢用。');
  assert.ok(SPEC.includes(`德叔說「${SERVE}」`));
});

test('機關：一條路線、30～60 秒、不操作；每一刻都畫得出來', () => {
  assert.ok(DURATION >= 30 && DURATION <= 60, `機關長度 ${DURATION} 秒`);
  let t = 0;
  for (const s of ROUTE) {
    assert.ok(s.dur > 0);
    assert.equal(START[s.id], t);
    t += s.dur;
  }
  assert.equal(new Set(ROUTE.map((s) => s.id)).size, ROUTE.length);
  for (const e of SOUND_EVENTS) assert.ok(e.t >= 0 && e.t <= DURATION);
  assert.equal(progress('warm', 0), 0);
  assert.equal(progress('sugar', DURATION), 1);
  const g = mockCtx();
  for (let x = 0; x <= DURATION; x += 0.5) drawMachine(g, x);
});

test('送咖啡的畫面：騎車 10 秒、櫃台、杯套、離開都畫得出來', () => {
  assert.equal(RIDE_MS, 10000);
  const g = mockCtx();
  for (let x = 0; x <= 10; x += 0.5) {
    drawRide(g, 390, 844, x);
    drawCounter(g, 390, 844, x, { bag: x > 5, smile: x / 10 });
    drawLeave(g, 390, 844, x, { walk: x / 10, smile: x / 10 });
  }
  drawSleeve(g, 390, 844);
});

test('可點範圍至少 44px；拖曳超過 10px 不算點', () => {
  assert.ok(MIN_HIT >= 44);
  assert.ok(TAP_SLOP >= 8);
  const html = read('index.html');
  assert.match(html, /button \{[^}]*min-height: 44px; min-width: 44px;/);
  assert.match(html, /<script type="module" src="src\/main\.js">/);
});

test('畫面沒有「略過」、選單、數值、進度列表', () => {
  const src = ['index.html', 'src/main.js', 'src/view/opening.js', 'src/view/company.js'].map(read).join('\n');
  for (const word of ['略過', '跳過', '任務', '完成獎勵', '還差', '進度', 'alert(', 'confirm(']) assert.ok(!src.includes(word), `不應出現：${word}`);
});

test('粗稿形狀（含互動前後的狀態）都畫得出來', () => {
  const g = mockCtx();
  const opts = [{}, { pulled: true }, { turned: true }, { open: true }, { weather: 'rain' }, { weather: 'fog' }, { steel: true }, { umbrella: true, cup: true }];
  for (const shape of Object.keys(ASPECT)) for (const o of opts) drawShape(g, shape, 100, 80, 1.5, o);
});

test('getDream 對不存在的 id 回傳 null', () => {
  assert.equal(getDream('nope'), null);
});
