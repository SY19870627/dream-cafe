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

// D224：與 smoke.mjs 相同——等 canvas、__cafe、劇本 YAML 編譯完成，才開始通關流程。
async function awaitGame(page) {
  // D224：scripts/*.yaml 以 top-level await 載入；main.js 要等它編譯完才會掛上 #app canvas。
  await page.waitForSelector('#app canvas');
  const isDev = await page.evaluate(() => new URLSearchParams(location.search).get('dev') === '1');
  // 一般模式故意沒有 window.__cafe（冒煙會斷言 === undefined）。此時等 canvas 已涵蓋 YAML 載入；
  // 若 YAML 404／編譯失敗，main 不會跑到掛 canvas，這裡會超時失敗——沒有放寬。
  if (!isDev) return { mode: 'player' };
  await page.waitForFunction(() => !!window.__cafe?.script, null, { timeout: 15000 });
  const sc = await page.evaluate(() => window.__cafe.script);
  if (!sc || sc.segments < 20 || sc.milestones < 18 || !sc.files?.includes('yuan')) {
    throw new Error(`劇本還沒就緒或數量不對：${JSON.stringify(sc)}`);
  }
  return sc;
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function play([W, H]) {
  const tag = `${W}x${H}`;
  console.log(`\n全流程 ${tag}`);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // 畫師還在畫的落地烘豆機（prop_roaster_large，承峰 11/7）：檔案放進來之前是 404（網路層的訊息），遊戲用 Canvas 暫代，不算錯誤
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location().url || '').includes('/assets/art/prop_roaster_large.webp')) errors.push(`console: ${m.text()}`); });
  await page.goto(url + '?dev=1&speed=20');
  await awaitGame(page);
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
    // 捲動區裡（例如記事本有了測試紀錄以後變長、型錄）超出畫面是正常的：改成捲到看得見時，要在畫面裡而且點得到；量完把捲動位置還原
    const r = await page.$$eval('button, a', (els, [w, h]) => els
      .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden' && el.closest('[hidden]') === null; })
      .map((el) => {
        const outside = (b) => b.left < -1 || b.right > w + 1 || b.bottom > h + 1 || b.top < -1;
        let b = el.getBoundingClientRect();
        let out = outside(b);
        const t = el.textContent.trim().slice(0, 10);
        if (out && t) {
          const scrollers = [];
          for (let p = el.parentElement; p; p = p.parentElement) {
            const oy = getComputedStyle(p).overflowY;
            if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) scrollers.push([p, p.scrollTop]);
          }
          if (scrollers.length) {
            el.scrollIntoView({ block: 'nearest' });
            b = el.getBoundingClientRect();
            const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            out = outside(b) || !hit || !(hit === el || el.contains(hit)) || getComputedStyle(el).pointerEvents === 'none';
            for (const [p, top] of scrollers) p.scrollTop = top;
          }
        }
        return { t, w: b.width, h: b.height, out };
      })
      .filter((b) => b.w < 44 || b.h < 44 || (b.out && b.t)), [W, H]);
    if (r.length) bad.push(`${name}: ${JSON.stringify(r)}`);
  }
  // 美術評分修正 c：等淡入、展開這類動畫跑完再拍（律師信原本在整幕淡入到 0.2 的時候就拍了，截圖整片暗灰）
  const settled = () => page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 3000)),
  ]));
  const said = [];
  await page.exposeFunction('__said', (t) => said.push(t));

  /* ---------- 開場四幕（不略過） ---------- */
  await page.waitForSelector('.op-office.on');
  await page.click('.op-choices button >> nth=0');
  await page.waitForTimeout(400);
  await settled();
  await shot('opening-office');
  await page.click('#op-send');
  await page.waitForSelector('.op-title.on');
  await page.waitForTimeout(600);
  await settled();
  await shot('opening-title');
  await page.click('#op-next');
  await page.waitForSelector('.op-mailbox.on');
  await page.click('#op-env');
  await page.waitForSelector('.op-lawyer');
  await settled();
  await page.waitForTimeout(300);
  await shot('opening-lawyer-letter');
  await page.click('.op-mailbox #op-next');
  await page.waitForSelector('.op-road.on');
  await page.waitForTimeout(500);
  await settled();
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
      // art2b：颱風夜拍德叔端咖啡給阿哲之後、阿哲說最後一句的那一格（評審看到兩人疊在一起的就是這裡）。
      // 快轉 20 倍時整場只有幾秒，等第一句話拍完再等常常已經演完了：這一場直接等最後一句，同一格也當作場景的截圖
      if (s.scene === 'zhe3' && !shots.includes('typhoon-night')) {
        await page.waitForFunction(() => !window.__cafe.scene || (document.getElementById('bubble').classList.contains('show') && document.getElementById('bubble').textContent.includes('四十年') && window.__cafe.camStill), null, { timeout: 90000, polling: 'raf' }).catch(() => {});
        await page.waitForTimeout(150);
        await shot('typhoon-night');
        await shot('scene-zhe3');
      }
      if (s.scene && !shots.includes(`scene-${s.scene}`)) {
        // 美術評分修正 c：場景一開始先轉向說話的人，等第一句話的泡泡出來再拍（原本拍到的是還沒開口的那一格）
        await page.waitForFunction(() => window.__cafe.camStill && document.getElementById('bubble').classList.contains('show'), null, { timeout: 5000, polling: 'raf' }).catch(() => {});
        await page.waitForTimeout(300); // 泡泡淡入 0.3 秒
        await shot(`scene-${s.scene}`);
      }
      if (s.map) { await page.waitForTimeout(1200); await shot('coffee-map'); return 'map'; }
      if (await vis('#tune')) { // 試咖啡微調面板：全流程不進，按「下次再調」
        await page.click('#tune-cancel');
        await page.waitForTimeout(400);
        continue;
      }
      if (await vis('#choices')) {
        await shot(`choice-${s.scene || s.guest || s.closing || 'brew'}`);
        // 試咖啡：選「下次再調／先不登錄／只是聊聊」；其餘劇情／打烊仍選第一項
        const nth = await page.$$eval('#choices button', (bs) => {
          // 只跳過試咖啡進微調（一起調／登錄）；熟客「只是聊聊」不要誤傷（最愛咖啡任務）
          const texts = bs.map((b) => b.textContent || '');
          if (texts.some((x) => /一起調|一起試|登錄到|再調一版/.test(x))) {
            const i = texts.findIndex((x) => /下次再調|先不登錄|只是聊聊/.test(x));
            return i >= 0 ? i : texts.length - 1;
          }
          return 0;
        });
        await page.click(`#choices button >> nth=${nth}`);
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
      // art2b：客人模式拍熟客聊天的那一格（說話的是熟客、鏡頭轉好了）；原本拍到的常是德叔端上桌後走回吧台、說話的人已經不在畫面裡
      if (s.guest === 'talk' && !shots.includes('guest-talk')) {
        await page.waitForFunction(() => window.__cafe.guest !== 'talk' || (/^(予安|阿哲|凱文)/.test(document.querySelector('#bubble b')?.textContent || '') && document.getElementById('bubble').classList.contains('show') && window.__cafe.camStill), null, { timeout: 30000, polling: 'raf' }).catch(() => {});
        await page.waitForTimeout(300);
        await shot('guest-talk');
      }
      if (s.closing === 'after' && !s.scene && !s.busy && !s.brewing && !s.cin) {
        await page.waitForTimeout(1500);
        await shot('closing-after');
        if (!diaryWritten && await vis('#diary-btn')) {
          // 打烊後：關燈、寫一句今天的一杯、明天見
          for (const b of await page.$$('.light-label:not(.off)')) { if (await b.isVisible()) { await b.click().catch(() => {}); await page.waitForTimeout(300); } }
          // 美術評分修正 e：坐著的時候燈的開關在底部按鈕列（一次一盞）
          for (let i = 0; i < 8 && await vis('#lights-btn') && (await page.textContent('#lights-btn')).includes('關燈'); i++) { await page.click('#lights-btn'); await page.waitForTimeout(300); }
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
        if (await vis('#close-shop')) { // 誤按打烊（D205）：等連點保護過去，德叔問一次，選「打烊」
          // 試咖啡微調／提一次可能剛佔住 choose：點了沒問出來就再等一輪，不要整段 playthrough 炸掉
          await page.waitForTimeout(700);
          await page.click('#close-shop');
          let appeared = await page.waitForSelector('#choices button', { timeout: 6000 }).catch(() => null);
          if (!appeared) {
            await page.waitForTimeout(900);
            if (await vis('#choices')) appeared = true;
            else if (await vis('#close-shop')) {
              await page.click('#close-shop');
              appeared = await page.waitForSelector('#choices button', { timeout: 8000 }).catch(() => null);
            }
          }
          if (!appeared) continue;
          await page.click('#choices button >> nth=0');
          await page.waitForTimeout(300); continue;
        }
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
        // 吧台座可能被德叔拉去試咖啡：選「下次再調／只是聊聊」，微調面板按取消
        if (await vis('#tune')) { await page.click('#tune-cancel'); await page.waitForTimeout(300); }
        if (await vis('#choices')) {
          const nth = await page.$$eval('#choices button', (bs) => {
            const texts = bs.map((b) => b.textContent || '');
            if (texts.some((x) => /一起調|一起試|登錄到|再調一版/.test(x))) {
              const i = texts.findIndex((x) => /下次再調|先不登錄|只是聊聊/.test(x));
              return i >= 0 ? i : texts.length - 1;
            }
            return texts.length - 1;
          });
          await page.click(`#choices button >> nth=${nth}`);
          await page.waitForTimeout(400);
        }
        await shot(`seat-${seat}`);
        if (await vis('#stand')) { await page.click('#stand'); await page.waitForTimeout(900); }
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
