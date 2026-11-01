// 全流程試玩：npm run playthrough [輸出資料夾]（階段 7）
// 從新存檔開始，像一位玩家一樣把第一站玩到結尾：開場四幕（不略過）→ 第一杯與初始擺飾 → 坐遍座位、龍眼跳上椅子、
// 用溫度基金買擺飾（書櫃三個、擺滿十件）→ 每天：讀日誌與信、等熟客的事發生完（選項選第一個）、客人模式、打烊喝最後一杯 →
// 開發者工具「跳到明天」→ …… → 37°C 的徵店長與告別 → 第二封信 → 咖啡地圖 → 回東山（凱文顧店）。
// 390×844 與 1280×720 各走一次，沿路截圖；每張截圖都檢查可點目標 ≥ 44px、按鈕沒有跑出畫面，最後檢查沒有 JS 錯誤、沒有卡關。
// 比冒煙測試慢很多（約十幾分鐘），不放在 npm test 裡。截圖預設存到 tests/output/playthrough/（不進 git）。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { CATALOG } from '../src/catalog.js';

const OUT = (process.argv[2] || fileURLToPath(new URL('./output/playthrough/', import.meta.url))).replace(/[\\/]?$/, '/');
await mkdir(OUT, { recursive: true });
const SIZES = (process.env.SIZES || '390x844,1280x720').split(',').map((s) => s.split('x').map(Number));

let failed = 0;
function check(ok, msg) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
  if (!ok) failed++;
}

const { server, url } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function play([W, H]) {
  const tag = `${W}x${H}`;
  console.log(`\n全流程 ${tag}`);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(url + '?dev=1&speed=20');
  await page.waitForSelector('#app canvas');
  const cafe = (k) => page.evaluate((key) => window.__cafe?.[key], k);
  const vis = (sel) => page.isVisible(sel);
  const shots = [];
  const bad = [];
  let n = 0;
  async function shot(name) {
    if (shots.includes(name)) return;
    shots.push(name);
    await page.screenshot({ path: `${OUT}${tag}-${String(++n).padStart(2, '0')}-${name}.png` });
    // 可點目標 ≥ 44px、按鈕與連結都在畫面裡
    const r = await page.$$eval('button, a', (els, [w, h]) => els
      .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden' && el.closest('[hidden]') === null; })
      .map((el) => { const b = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 10), w: b.width, h: b.height, out: b.left < -1 || b.right > w + 1 || b.bottom > h + 1 || b.top < -1 }; })
      .filter((b) => b.w < 44 || b.h < 44 || (b.out && b.t)), [W, H]);
    // 捲動區裡（例如選單、型錄）超出畫面是正常的：只記錄不在捲動區裡的
    if (r.length) bad.push(`${name}: ${JSON.stringify(r)}`);
  }
  const said = [];
  await page.exposeFunction('__said', (t) => said.push(t));

  /* ---------- 開場四幕（不略過） ---------- */
  await page.waitForSelector('.op-office.on');
  await page.click('.op-choices button >> nth=0');
  await page.waitForTimeout(400);
  await shot('opening-office');
  await page.click('#op-send');
  await page.waitForSelector('.op-title.on');
  await page.waitForTimeout(600);
  await shot('opening-title');
  await page.click('#op-next');
  await page.waitForSelector('.op-mailbox.on');
  await page.click('#op-env');
  await page.waitForSelector('.op-lawyer');
  await shot('opening-lawyer-letter');
  await page.click('.op-mailbox #op-next');
  await page.waitForSelector('.op-road.on');
  await page.waitForTimeout(500);
  await shot('opening-road');
  await page.click('.op-road #op-next');
  await page.waitForFunction(() => window.__cafe.tutorial === 'enter', null, { timeout: 8000 });
  await page.evaluate(() => new MutationObserver(() => window.__said(document.getElementById('bubble').textContent)).observe(document.getElementById('bubble'), { childList: true, subtree: true, characterData: true }));
  await page.waitForTimeout(900);
  await shot('shop-door');
  await page.waitForFunction(() => window.__cafe.tutorial === 'sit', null, { timeout: 15000 });
  await page.click('.seat-label >> text=窗邊座');
  await page.waitForFunction(() => window.__cafe.closeup, null, { timeout: 8000 });
  await page.waitForTimeout(1200);
  await shot('first-cup-closeup');
  await page.waitForFunction(() => window.__cafe.tutorial === 'choose', null, { timeout: 40000 });
  await shot('first-cup-gift');
  check((await cafe('temp')) >= 20.5, `${tag} 第一杯：20.5°C`);
  // 開始佈置：三件初始擺飾全部擺出來
  await page.click('#tut-place');
  await page.waitForSelector('#sheet', { state: 'visible' });
  for (let i = 0; i < 3; i++) {
    if (!(await vis('#sheet'))) await page.click('#p-store');
    await page.click('#sheet-list .sheet-row >> nth=0 >> button');
    await page.click('#p-deselect');
  }
  await shot('placing-starters');
  await page.click('#p-done');
  await page.waitForTimeout(800);

  /* ---------- 每一天 ---------- */
  const audioOk = { music: false, sfx: false };
  let diaryWritten = false;
  let catTried = 0;
  // 等畫面上的事告一段落：處理選項、信、日誌、坐下、打烊；回傳 true＝今天沒事了
  async function settle(label, { close }) {
    const t0 = Date.now();
    while (Date.now() - t0 < 150000) {
      const s = await page.evaluate(() => {
        const c = window.__cafe;
        return { busy: c.storyBusy, scene: c.scene, closing: c.closing, guest: c.guest, mode: c.mode, brewing: c.brewing, keeper: c.keeper, map: c.mapOpen, arriving: c.arriving, temp: c.temp, weather: c.weather, placing: c.placing, cin: c.cinematic };
      });
      if (s.scene) await shot(`scene-${s.scene}`);
      if (s.weather === 'typhoon') await shot('typhoon-night');
      if (s.map) { await page.waitForTimeout(1200); await shot('coffee-map'); return 'map'; }
      if (await vis('#choices')) {
        await shot(`choice-${s.scene || s.guest || s.closing || 'brew'}`);
        await page.click('#choices button >> nth=0');
        continue;
      }
      if (await vis('#letter')) { await shot(`letter-${(await page.textContent('#lt-title')).trim()}`); await page.click('#lt-close'); continue; }
      if (await vis('#journal')) { await shot('journal'); await page.click('#jr-close'); continue; }
      if (await vis('#closed')) { await shot('closed-goodnight'); await page.click('#cl-stay'); continue; }
      if (await vis('#read-letter')) { await page.click('#read-letter'); continue; }
      if ((s.closing === 'lastcup' || s.guest === 'sit') && s.mode !== 'seat' && await vis('.seat-label >> text=窗邊座')) {
        if (s.guest) await shot('guest-door');
        else await shot('closing-lastcup');
        await page.click('.seat-label >> text=窗邊座');
        continue;
      }
      if (s.guest === 'talk') await shot('guest-talk');
      if (s.closing === 'after' && !s.scene && !s.busy && !s.brewing && !s.cin) {
        await page.waitForTimeout(1500);
        await shot('closing-after');
        if (!diaryWritten && await vis('#diary-btn')) {
          // 打烊後：關燈、寫一句今天的一杯、明天見
          for (const b of await page.$$('.light-label:not(.off)')) { await b.click().catch(() => {}); await page.waitForTimeout(300); }
          await page.waitForTimeout(1200);
          await shot('closing-lights-off');
          await page.click('#diary-btn');
          await page.fill('#dy-text', '雨停了，咖啡還是熱的。');
          await shot('closing-diary');
          await page.click('#dy-save');
          diaryWritten = true;
          await page.click('#goodnight');
          await page.waitForSelector('#closed', { state: 'visible', timeout: 10000 });
          continue;
        }
        return 'idle';
      }
      if (!s.busy && !s.scene && !s.brewing && !s.closing && !s.guest && !s.arriving && !s.placing && !s.cin) {
        if (!close || s.keeper) return 'idle';
        // 今天的事都發生完了：站起來、打烊、坐窗邊喝最後一杯
        if (await vis('#stand')) { await page.click('#stand'); await page.waitForTimeout(400); continue; }
        if (await vis('#close-shop')) { await page.click('#close-shop'); await page.waitForTimeout(300); continue; }
      }
      await page.waitForTimeout(150);
    }
    check(false, `${tag} ${label}：在時限內告一段落 ${JSON.stringify(await cafe('waitInfo'))}`);
    return 'stuck';
  }
  // 玩家自己會做的事：坐遍三個座位、讓龍眼跳上椅子、用基金買擺飾
  async function playerChores() {
    const tasks = await cafe('tasks');
    if (await vis('#stand')) { await page.click('#stand'); await page.waitForTimeout(800); }
    if (!tasks.includes('all-seats')) {
      for (const seat of ['吧台座', '角落沙發', '窗邊座']) {
        await page.click(`.seat-label >> text=${seat}`);
        await page.waitForTimeout(1300);
        await shot(`seat-${seat}`);
        await page.click('#stand');
        await page.waitForTimeout(900);
      }
    }
    if (!tasks.includes('cat-chair') && catTried < 4) {
      catTried++;
      await page.click('.seat-label >> text=窗邊座');
      await page.waitForTimeout(1500);
      await page.click('#stand');
      try { await page.waitForFunction(() => window.__cafe.catOnSeat, null, { timeout: 12000 }); await page.waitForTimeout(600); await shot('cat-on-chair'); } catch { /* 龍眼今天沒心情，明天再試 */ }
    }
    // 買東西：先湊三個書櫃（第一面書牆），再挑便宜的湊滿十件
    const fund = await cafe('fund');
    const placed = await cafe('placed');
    const want = [];
    let left = fund;
    const books = placed.filter((i) => i === 'bookshelf').length;
    for (let i = books; i < 3; i++) { const it = CATALOG.find((c) => c.id === 'bookshelf'); if (left >= it.price) { want.push(it); left -= it.price; } }
    const cheap = CATALOG.filter((c) => c.id !== 'book-wall' && c.id !== 'bookshelf' && !placed.includes(c.id)).sort((a, b) => a.price - b.price);
    for (const it of cheap) if (placed.length + want.length < 11 && left >= it.price) { want.push(it); left -= it.price; }
    if (!want.length) return;
    if (await vis('#stand')) { await page.click('#stand'); await page.waitForTimeout(800); }
    if (!(await page.waitForSelector('#place', { state: 'visible', timeout: 8000 }).catch(() => null))) return;
    await page.click('#place');
    for (const it of want) {
      await page.click('#p-catalog');
      await page.click(`#sheet-list .sheet-row:has(b:text-is("${it.name}")) button`);
      await page.click('#p-deselect');
    }
    await shot('placing-catalog-trial');
    await page.click('#p-done');
    await page.waitForTimeout(1200);
    await shot(`overview-${(await cafe('placed')).length}-items`);
  }

  let day = 1, ended = false;
  while (day <= 40) {
    let r = await settle(`第 ${day} 天（早上）`, { close: false });
    if (r === 'map') { ended = true; break; }
    if (r === 'stuck') break;
    if (!(await cafe('keeper'))) await playerChores();
    // 每天都請德叔沖一杯（坐窗邊；雨天就是「在雨天坐窗邊喝一杯」）
    if (await vis('.seat-label >> text=窗邊座')) await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1200);
    r = await settle(`第 ${day} 天（坐下）`, { close: false });
    if (r === 'map') { ended = true; break; }
    if (await vis('#brew') && !(await page.isDisabled('#brew'))) {
      await page.click('#brew');
      await page.waitForTimeout(300);
      if (await vis('#choices')) await page.click('#choices button >> nth=0');
      await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 40000 }).catch(() => {});
      if ((await cafe('weather')) !== 'clear') await shot('rain-window-cup');
    }
    const a = await cafe('audio');
    if (a.bars > 0) audioOk.music = true;
    if (a.sfx.grind && a.sfx.cup) audioOk.sfx = true;
    r = await settle(`第 ${day} 天（打烊）`, { close: true });
    if (r === 'map') { ended = true; break; }
    if (r === 'stuck') break;
    if ((await cafe('temp')) >= 37) await shot(`farewell-day-${day}`);
    // 跳到明天
    await page.click('#menu-btn');
    await page.click('#dev-day1');
    day++;
    if (day % 5 === 0) console.log(`  … 第 ${day} 天 ${await cafe('temp')}°C 基金 ${await cafe('fund')} 告別 ${(await cafe('farewell')).step}/7`);
  }
  check(ended, `${tag} 玩到第一站結尾的咖啡地圖（第 ${day} 天）`);
  if (ended) {
    await page.click('#map-back');
    await page.waitForFunction(() => window.__cafe.keeper && !window.__cafe.arriving && window.__cafe.mode === 'overview', null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot('keeper-overview');
    check((await cafe('barName')) === '凱文' && (await page.textContent('#brew')).includes('凱文'), `${tag} 回東山：凱文顧店，按鈕寫「請凱文沖一杯」`);
    await page.click('.seat-label >> text=吧台座');
    await page.waitForTimeout(1200);
    await page.click('#brew');
    await page.waitForTimeout(300);
    if (await vis('#choices')) await page.click('#choices button >> nth=0');
    await page.waitForFunction(() => window.__cafe.closeup, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await shot('keeper-brew');
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 40000 });
    await page.click('#menu-btn');
    await page.click('#open-notebook');
    await shot('notebook-end');
  }
  const t = await cafe('tasks');
  check(t.length === 20 && (await cafe('temp')) === 37, `${tag} 20 個溫度任務都完成、37°C（${t.length} 個）`);
  check(audioOk.music && audioOk.sfx, `${tag} 音樂與店裡的聲音都有出聲（音樂 ${audioOk.music}、磨豆與杯子 ${audioOk.sfx}）`);
  check(!said.join('|').match(/不划算|KPI|餘額不足/), `${tag} 一路上的台詞沒有「不划算」「KPI」「餘額不足」`);
  check(bad.length === 0, `${tag} 所有截圖的可點目標 ≥ 44px、沒有跑出畫面 ${bad.slice(0, 5).join(' | ')}`);
  check(errors.length === 0, `${tag} 沒有 JS 錯誤 ${errors.slice(0, 5).join(' | ')}`);
  console.log(`  截圖 ${shots.length} 張：${OUT}${tag}-*.png`);
  await page.close();
}

try {
  for (const s of SIZES) await play(s);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n全流程試玩失敗：${failed} 項` : '\n全流程試玩通過');
process.exit(failed ? 1 : 0);
