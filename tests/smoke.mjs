// 冒煙測試：npm test（先跑 tests/unit/ 的純邏輯單元測試，再跑這支）
// 以 Chromium 載入遊戲，檢查沒有 JS 錯誤、座位標籤不被切掉、點擊目標 ≥ 44px、
// 沖一杯咖啡後杯子上桌看得見、按鈕恢復、溫度 20.0 → 20.5°C、開發者資訊面板；
// 階段 3：開場四幕（與略過、中途重新整理）、營業日誌、第一封老先生的信、舊存檔直接進店。
// 不測開場的段落用 ?dev=1&opening=0 直接當作看過開場。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const OUT = fileURLToPath(new URL('./output/', import.meta.url));
await mkdir(OUT, { recursive: true });

let failed = 0;
function check(ok, msg) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
  if (!ok) failed++;
}

const { server, url } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(viewport, query) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(url + query);
  await page.waitForSelector('#app canvas');
  await page.waitForTimeout(1800); // 等俯瞰鏡頭與第一句話
  return { page, errors };
}

// 所有看得見的按鈕與連結都要 ≥ 44px
async function smallTargets(page) {
  return page.$$eval('button, a', (els) => els
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
    .map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 12), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((r) => r.w < 44 || r.h < 44));
}

// 座位標籤完整落在 #app 裡、在上方標題列與下方按鈕之間
async function labelsInside(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app').getBoundingClientRect();
    const top = document.querySelector('.top').getBoundingClientRect().bottom;
    const bottom = document.querySelector('.bottom').getBoundingClientRect().top;
    return [...document.querySelectorAll('.seat-label')].map((el) => {
      const r = el.getBoundingClientRect();
      return { name: el.textContent, ok: r.left >= app.left && r.right <= app.right && r.top >= top && r.bottom <= bottom };
    });
  });
}

try {
  /* ---------- 手機 390×844，開發者模式加速 ---------- */
  console.log('手機 390×844（?dev=1&speed=20）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0');
    for (const l of await labelsInside(page)) check(l.ok, `座位標籤「${l.name}」完整顯示`);
    const small = await smallTargets(page);
    check(small.length === 0, `可點目標都 ≥ 44px ${small.length ? JSON.stringify(small) : ''}`);
    check(await page.isVisible('#speed'), '開發者模式顯示快轉鈕');
    check((await page.textContent('#temp')) === '20.0°C', '一開始溫度 20.0°C');
    await page.screenshot({ path: OUT + 'phone-overview.png' });

    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1600);
    check(await page.evaluate(() => window.__cafe.mode === 'seat'), '點「窗邊座」可以坐下');
    check((await smallTargets(page)).length === 0, '坐下後的按鈕都 ≥ 44px');

    await page.click('#brew');
    await page.waitForTimeout(200);
    check(await page.evaluate(() => window.__cafe.brewing && window.__cafe.closeup), '按沖咖啡後鏡頭移到吧台');
    check((await page.textContent('#brew')) === '回座位', '沖煮中按鈕是「回座位」');
    // 按住畫面 ×3
    const box = await page.locator('#app canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);
    check(await page.evaluate(() => window.__cafe.speed === 60), '沖煮中按住畫面，動作 ×3');
    await page.mouse.up();
    check(await page.evaluate(() => window.__cafe.speed === 20), '放開恢復原速');

    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 20000 });
    check(!(await page.isDisabled('#brew')) && (await page.textContent('#brew')) === '請德叔沖一杯', '杯子上桌後按鈕立刻恢復');
    check(await page.evaluate(() => window.__cafe.tasks.includes('first-coffee') && window.__cafe.temp === 20.5), '杯子上桌那一刻完成任務、溫度 +0.5');
    await page.waitForFunction(() => document.getElementById('temp').textContent === '20.5°C', null, { timeout: 5000 });
    check(true, '右上角溫度爬到 20.5°C');
    await page.waitForTimeout(1200); // 鏡頭回到座位
    const cup = await page.evaluate(() => window.__cafe.cupOnScreen('window'));
    const band = await page.evaluate(() => {
      const app = document.getElementById('app').getBoundingClientRect();
      return { w: app.width, top: document.querySelector('.top').getBoundingClientRect().bottom - app.top, bottom: document.querySelector('.bottom').getBoundingClientRect().top - app.top };
    });
    check(cup && cup.inFront && cup.x > 0 && cup.x < band.w && cup.y > band.top && cup.y < band.bottom,
      `杯子在桌上、不被按鈕擋住 ${JSON.stringify(cup)} 可視帶 ${Math.round(band.top)}～${Math.round(band.bottom)}`);
    await page.screenshot({ path: OUT + 'phone-cup.png' });

    // 德叔還在走回吧台時再點一杯：不會卡住，溫度不會重複加
    await page.click('#brew');
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 25000 });
    check(await page.evaluate(() => window.__cafe.temp === 20.5), '第二杯也能沖完，溫度沒有重複加');

    // 關於面板
    await page.click('#menu-btn');
    check(await page.isVisible('#about'), '「≡」打開關於面板');
    const links = await page.$$eval('#about a', (as) => as.map((a) => [a.href, a.target, a.rel]));
    check(links.some(([h]) => h === 'https://github.com/SY19870627') && links.some(([h]) => h === 'https://x.com/nelsonyehfon'), '面板有 GitHub 與 X 連結');
    check(links.every(([, t, r]) => t === '_blank' && r.includes('noopener')), '連結另開分頁（noopener）');
    check((await page.textContent('#about')).includes('SY'), '面板寫著開發者 SY');
    check((await smallTargets(page)).length === 0, '面板裡的按鈕與連結都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-about.png' });
    await page.mouse.click(box.x + 10, box.y + 10); // 點面板外面
    check(await page.isHidden('#about'), '點面板外面關閉');

    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 階段 2：存檔、佈置與型錄、跳天數、記事本 ---------- */
  console.log('手機 390×844（存檔、佈置、型錄、跳天數）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    const consistent = () => page.evaluate(() => window.__cafe.fund === window.__cafe.ledgerSum);
    check((await cafe('saveStatus')) === 'new' && (await page.textContent('#day')) === '開店第 1 天', '新存檔：開店第 1 天');
    check(JSON.stringify(await cafe('stored')) === JSON.stringify(['plant', 'floor-lamp', 'menu-board']) && (await cafe('fund')) === 0, '倉庫裡有三件初始擺飾、基金 0 元');

    // 從倉庫擺出來、點地板換位置、復原
    await page.click('#place');
    check(await page.isVisible('#p-catalog') && await page.isVisible('#p-done') && await page.isHidden('#place'), '進入佈置：型錄、倉庫、復原、確定');
    await page.click('#p-store');
    check((await page.$$('#sheet-list .sheet-row')).length === 3, '倉庫列出三件');
    check((await smallTargets(page)).length === 0, '倉庫面板的按鈕都 ≥ 44px');
    await page.click('.sheet-row:has-text("盆栽") button');
    check(await page.isHidden('#sheet') && (await cafe('selected')) === 'plant', '擺出來後直接選起盆栽');
    const before = (await cafe('layoutPlaced'))[0];
    const box = await page.locator('#app canvas').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
    const after = (await cafe('layoutPlaced'))[0];
    check(after && (Math.abs(after.x - before.x) > 0.2 || Math.abs(after.z - before.z) > 0.2) && !(await cafe('selected')), '點地板把盆栽移過去');
    await page.click('#p-revert');
    check((await cafe('layoutPlaced')).length === 0 && (await cafe('fund')) === 0, '「復原」回到進來時的樣子');
    await page.click('#p-store');
    await page.click('.sheet-row:has-text("盆栽") button');
    await page.click('#p-deselect');
    await page.click('#p-done');
    await page.waitForFunction(() => document.getElementById('temp').textContent === '20.5°C', null, { timeout: 5000 });
    check((await cafe('tasks')).includes('first-decor') && (await cafe('fund')) === 500 && !(await cafe('placing')), '按「確定」擺上第一件：+0.5°C、撥款 500 元');

    // 型錄：試擺不扣錢，確定才扣；基金不夠的退回型錄
    await page.click('#place');
    await page.click('#p-catalog');
    check((await page.$$('#sheet-list .sheet-row')).length >= 10, '型錄至少 10 件');
    check((await page.textContent('#sheet')).includes('再等等') && !(await page.textContent('#sheet')).match(/不足|不划算/), '買不起的寫「再等等」，沒有「不足」「不划算」');
    check((await smallTargets(page)).length === 0, '型錄面板的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-catalog.png' });
    await page.click('.sheet-row:has-text("龍眼乾玻璃罐") button');
    check((await cafe('fund')) === 500 && (await cafe('layoutPlaced')).some((e) => e.trial), '試擺不扣錢');
    await page.click('#p-revert');
    check(!(await cafe('layoutPlaced')).some((e) => e.trial), '「復原」把試擺的東西收回');
    await page.click('#p-catalog');
    await page.click('.sheet-row:has-text("龍眼乾玻璃罐") button');
    await page.click('#p-deselect');
    await page.click('#p-catalog');
    await page.click('.sheet-row:has-text("整面書牆") button');
    await page.click('#p-deselect');
    await page.click('#p-done');
    await page.waitForTimeout(300);
    check((await cafe('fund')) === 200 && (await consistent()), '確定後才扣 300 元，基金與帳本一致');
    check(JSON.stringify(await cafe('placed')) === JSON.stringify(['plant', 'longan-jar']), '書牆基金還不夠，退回型錄；罐子擺在店裡');

    // 重新整理：進度都在
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(800);
    check((await cafe('saveStatus')) === 'loaded' && (await page.textContent('#temp')) === '20.5°C' && (await cafe('fund')) === 200
      && (await cafe('placed')).length === 2 && (await cafe('stored')).length === 2, '重新整理後溫度、基金、擺設都在');

    // 跳天數：開店滿 3 天、7 天
    await page.click('#menu-btn');
    check(await page.isVisible('#dev-tools'), '開發者模式的選單有跳天數工具');
    check((await smallTargets(page)).length === 0, '選單裡的按鈕都 ≥ 44px');
    await page.click('#dev-day1');
    check(await page.isVisible('#journal'), '跳到明天：德叔交出營業日誌');
    await page.click('#jr-close');
    await page.click('#menu-btn');
    await page.click('#dev-day1');
    await page.click('#jr-close');
    check((await cafe('day')) === 3 && (await cafe('tasks')).includes('open-3-days') && (await cafe('temp')) === 21, '跳到第 3 天：「開店滿 3 天」完成');
    await page.click('#menu-btn');
    await page.click('#dev-day7');
    await page.click('#jr-close');
    check((await cafe('day')) === 10 && (await cafe('tasks')).includes('open-7-days') && (await cafe('temp')) === 22 && (await cafe('fund')) === 3200, '再跳 7 天：「開店滿 7 天」完成，基金 3,200 元');
    check((await cafe('grants')) === 500 + 1000 + 2000 && (await consistent()), '撥款與任務對得上');
    // 記事本：只列已經發生的事
    await page.click('#menu-btn');
    await page.click('#open-notebook');
    check(await page.isVisible('#notebook') && (await page.$$('#nb-list li')).length === 3, '記事本列出已完成的三件事');
    check((await page.textContent('#notebook')).includes('開店第 10 天'), '記事本寫著開店第 10 天');
    await page.screenshot({ path: OUT + 'phone-notebook.png' });
    await page.click('#nb-close');
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(800);
    check((await page.textContent('#day')) === '開店第 10 天' && (await cafe('temp')) === 22, '重新整理後仍是第 10 天、22.0°C');
    // 重置存檔
    await page.click('#menu-btn');
    await page.click('#dev-reset');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(800);
    check((await cafe('saveStatus')) === 'new' && (await cafe('temp')) === 20 && (await cafe('day')) === 1, '重置存檔後回到第 1 天、20.0°C');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 階段 3：完整開場 ---------- */
  console.log('手機 390×844（開場四幕）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    check(await page.isVisible('.op-office') && (await page.textContent('.op-clock')) === '16:49', '第一幕：16:49 的辦公室');
    check(await page.isDisabled('#op-send'), '還沒選結尾之前不能送出');
    check((await page.$$('.op-choices button')).length === 3, '三種辭呈結尾');
    check((await smallTargets(page)).length === 0, '第一幕的按鈕都 ≥ 44px');
    await page.click('.op-choices button:has-text("單方面辭退")');
    await page.fill('#op-name', '小林');
    await page.screenshot({ path: OUT + 'phone-opening-office.png' });
    // 記下時鐘顯示過的時間（加速模式下第一幕很快就換場）
    await page.evaluate(() => {
      const el = document.querySelector('.op-clock');
      window.__clock = [el.textContent];
      new MutationObserver(() => window.__clock.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await page.click('#op-send');
    await page.waitForSelector('.op-title.on');
    check(JSON.stringify(await page.evaluate(() => window.__clock)) === '["16:49","16:50"]', '按下送出，時鐘跳到 16:50');
    const credit = await page.$$eval('.op-credit a', (as) => as.map((a) => a.href));
    check(credit.includes('https://github.com/SY19870627') && credit.includes('https://x.com/nelsonyehfon') && (await page.textContent('.op-credit')).includes('SY'), '標題畫面底部有開發者資訊');
    await page.waitForTimeout(600);
    check((await smallTargets(page)).length === 0, '標題畫面的按鈕與連結都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-opening-title.png' });
    await page.click('#op-next');
    await page.waitForSelector('.op-mailbox.on');
    await page.click('#op-env');
    await page.waitForSelector('.op-lawyer');
    check((await page.textContent('.op-lawyer')).includes('若您尚未辭職，請先辭職'), '第二幕：律師信');
    await page.screenshot({ path: OUT + 'phone-opening-letter.png' });
    await page.click('.op-mailbox #op-next');
    await page.waitForSelector('.op-road.on');
    check((await smallTargets(page)).length === 0, '第三幕的按鈕都 ≥ 44px');
    await page.click('.op-road #op-next');
    await page.waitForFunction(() => window.__cafe.tutorial === 'enter', null, { timeout: 5000 });
    check(await page.evaluate(() => window.__cafe.mode === 'door'), '推門進去：鏡頭在門口');
    await page.waitForFunction(() => window.__cafe.tutorial === 'sit', null, { timeout: 10000 });
    check(await page.isHidden('#place') && await page.isVisible('#op-skip-shop'), '第四幕：「先坐。」只留座位，佈置鈕先收起來');
    check(!(await cafe('yuanHere')), '開店第 1 天予安還沒來');
    check((await cafe('stored')).length === 0, '初始擺飾還沒送');
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForFunction(() => window.__cafe.brewing, null, { timeout: 5000 });
    check(true, '坐下之後德叔自己開始沖');
    await page.waitForFunction(() => window.__cafe.tutorial === 'choose', null, { timeout: 40000 });
    check((await cafe('temp')) === 20.5 && (await cafe('tasks')).includes('first-coffee'), '第一杯：溫度 20 → 20.5°C');
    check(JSON.stringify(await cafe('stored')) === JSON.stringify(['plant', 'floor-lamp', 'menu-board']), '德叔送了三件初始擺飾');
    const pl = await cafe('player');
    check(pl.name === '小林' && pl.resignation === 'fire', '辭呈署名與結尾存進存檔');
    check((await smallTargets(page)).length === 0, '「開始佈置／再坐一下」都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-opening-choose.png' });
    await page.click('#tut-place');
    await page.waitForTimeout(300);
    check((await cafe('placing')) && await page.isVisible('#sheet') && (await page.$$('#sheet-list .sheet-row')).length === 3, '「開始佈置」打開佈置與倉庫');
    check((await cafe('seenOpening')) && (await cafe('tutorial')) === null, '開場結束');
    await page.click('#sheet-close');
    await page.click('#p-done');
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1000);
    check(await page.isHidden('#opening') && (await cafe('saveStatus')) === 'loaded', '重新整理後直接進店，不再播開場');
    check(errors.length === 0, 'Phase3 開場沒有 JS 錯誤 ' + errors.join(' | '));
    await page.close();
  }

  /* ---------- 階段 3：開場中途重新整理 ---------- */
  console.log('手機 390×844（開場中途重新整理）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20');
    await page.click('#op-skip');
    await page.waitForSelector('.op-title.on');
    await page.reload();
    await page.waitForSelector('.op-mailbox.on');
    check(true, '看過標題後重新整理，從第二幕接著播');
    await page.click('#op-skip');
    await page.waitForSelector('.op-road.on');
    await page.click('#op-skip');
    await page.waitForFunction(() => window.__cafe.tutorial === 'sit', null, { timeout: 5000 });
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForFunction(() => window.__cafe.tutorial === 'sit', null, { timeout: 5000 });
    await page.waitForTimeout(1000);
    check(await page.isHidden('#opening'), '進店之後重新整理，從第四幕「先坐。」接著演');
    await page.click('#op-skip-shop');
    check(await page.evaluate(() => window.__cafe.seenOpening && window.__cafe.stored.length === 3), '略過第四幕：開場結束、初始擺飾照樣送');
    check(errors.length === 0, '沒有 JS 錯誤 ' + errors.join(' | '));
    await page.close();
  }

  /* ---------- 階段 3：營業日誌與第一封老先生的信 ---------- */
  console.log('手機 390×844（營業日誌、第一封信）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    const dayLines = () => page.$$eval('#jr-body .jr-list', (uls) => uls.map((u) => u.children.length));
    await page.waitForTimeout(1500);
    check(!(await cafe('letterWaiting')) && (await cafe('letters')).length === 0, '第 1 天、20°C：還不交信');
    await page.click('#menu-btn');
    await page.click('#dev-day1');
    check(await page.isVisible('#journal'), '跳到明天：營業日誌');
    const one = await dayLines();
    check(one.length === 1 && one[0] >= 2 && one[0] <= 4 && (await page.textContent('#jr-body')).includes('第 2 天'), `日誌寫第 2 天，${one[0]} 條（2～4 條）`);
    check((await smallTargets(page)).length === 0, '日誌的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-journal.png' });
    check(await cafe('yuanHere'), '開店第 2 天予安來了');
    check(!(await cafe('letterWaiting')), '日誌還開著的時候不交信');
    await page.click('#jr-close');
    await page.waitForFunction(() => window.__cafe.letterWaiting === 'first', null, { timeout: 15000 });
    await page.waitForSelector('#read-letter', { state: 'visible' });
    check(await page.isHidden('#place'), '第 2 天：德叔把第一封信放在吧台上，只留「讀信」');
    await page.click('#read-letter');
    check(await page.isVisible('#letter') && (await page.textContent('#lt-body')).includes('德昌煮的咖啡很慢'), '信紙：第一封老先生的信');
    const shaky = await page.$$eval('#lt-body i', (is) => is.filter((i) => /rotate\(-?\d/.test(i.style.transform)).length);
    check(shaky > 100, `手寫的字有點抖（${shaky} 個字微微旋轉）`);
    check((await smallTargets(page)).length === 0, '信紙的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-letter.png' });
    await page.click('#lt-close');
    check(await cafe('cinematic'), '讀完：鏡頭轉向擦琺瑯杯的德叔');
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + 'phone-letter-wipe.png' });
    await page.waitForFunction(() => !window.__cafe.cinematic, null, { timeout: 10000 });
    check(JSON.stringify(await cafe('letters')) === '["first"]' && !(await cafe('letterWaiting')), '信記進存檔');
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(2500);
    check(await page.isHidden('#journal') && !(await cafe('letterWaiting')) && await page.isHidden('#read-letter'), '重新整理：同一天不再寫日誌，信也不再交');
    await page.click('#menu-btn');
    await page.click('#open-notebook');
    const links = await page.$$eval('#nb-links button', (bs) => bs.map((b) => b.textContent));
    check(links.length === 3 && links[0].includes('營業日誌') && links[1] === '律師信' && links[2].includes('第一封信'), `記事本可以重讀日誌、律師信、第一封信 ${JSON.stringify(links)}`);
    check((await smallTargets(page)).length === 0, '記事本的按鈕都 ≥ 44px');
    await page.click('#nb-links button:has-text("第一封信")');
    check(await page.isVisible('#letter') && (await page.textContent('#lt-body')).includes('幫我摸摸那隻貓'), '在記事本重讀第一封信');
    await page.click('#lt-close');
    check(!(await cafe('cinematic')) && (await cafe('letters')).length === 1, '重讀不會重演、也不會重複記');
    // 離開 7 天：只展開最近 3 天，其餘一句帶過
    await page.click('#menu-btn');
    await page.click('#dev-day7');
    check(await page.isVisible('#jr-body .jr-sum') && (await page.textContent('#jr-body .jr-sum')).includes('第 3～6 天'), '離開 7 天：前面的日子一句帶過');
    check((await page.$$('#jr-body .jr-day')).length === 3, '只展開最近 3 天');
    check((await page.$$eval('#jr-body > .jr-list', (uls) => uls.slice(-3).map((u) => u.children.length))).every((n) => n >= 2 && n <= 4), '每天 2～4 條');
    await page.screenshot({ path: OUT + 'phone-journal-7days.png' });
    await page.click('#jr-close');
    check((await cafe('journalPages')) === 2, '日誌收進存檔');
    check(errors.length === 0, '沒有 JS 錯誤 ' + errors.join(' | '));
    await page.close();
  }

  /* ---------- 階段 3：第 1 版的舊存檔 ---------- */
  console.log('手機 390×844（舊存檔）');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript((day) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const t = Date.now();
      localStorage.setItem('dream-cafe.save', JSON.stringify({ version: 1, createdAt: t - 3 * day, lastSeen: t - 2 * day,
        tasks: [{ id: 'first-coffee', t: t - 3 * day, day: 1 }], fund: { ledger: [{ t: t - 3 * day, kind: 'grant', ref: 'first-coffee', amount: 500 }] },
        owned: [{ uid: 1, item: 'plant', placed: true, x: 2.4, z: 1.6 }, { uid: 2, item: 'floor-lamp', placed: false, x: 0, z: 0 }, { uid: 3, item: 'menu-board', placed: false, x: 0, z: 0 }],
        nextUid: 4, seatsSat: ['window'], stats: { cups: 1, rainyWindowCups: 0 }, flags: { starterGiven: true } }));
    }, 864e5);
    await page.goto(url + '?dev=1&speed=20');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1500);
    check(await page.isHidden('#opening'), '舊存檔不播開場，直接進店');
    check(await page.isVisible('#journal') && (await page.$$('#jr-body .jr-day')).length === 2, '離開兩天：看到兩天的營業日誌');
    check(await page.evaluate(() => window.__cafe.placed.length + window.__cafe.stored.length === 3), '初始擺飾沒有重複送');
    check(errors.length === 0, '沒有 JS 錯誤 ' + errors.join(' | '));
    await page.close();
  }


  /* ---------- 私密模式：存不了檔也照常遊戲 ---------- */
  console.log('手機 390×844（存不了檔）');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } }));
    await page.goto(url + '?dev=1&opening=0');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(800);
    check(await page.evaluate(() => window.__cafe.saveStatus === 'memory'), '讀不到 localStorage 時改用記憶體');
    await page.click('#menu-btn');
    check(await page.isVisible('#save-note'), '選單裡溫和地說明這台裝置存不了檔');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 一般模式：看不到測試用按鈕 ---------- */
  console.log('手機 390×844（一般模式）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '');
    check(await page.isHidden('#speed'), '一般模式沒有快轉鈕');
    check(await page.evaluate(() => window.__cafe === undefined), '一般模式沒有測試介面');
    check(await page.isVisible('.op-office'), '新存檔從第一幕「16:49 的辦公室」開始');
    // 每一幕都可以略過：辦公室 → 標題 → 信箱 → 縣道 → 店裡（第四幕）→ 結束
    for (const sel of ['.op-title', '.op-mailbox', '.op-road']) {
      await page.click('#op-skip');
      await page.waitForSelector(sel + '.on');
    }
    await page.click('#op-skip');
    await page.waitForSelector('#op-skip-shop', { state: 'visible', timeout: 15000 });
    await page.click('#op-skip-shop');
    check(await page.isHidden('#op-skip-shop') && await page.isVisible('#place'), '一路略過開場後可以照常佈置');
    await page.click('#menu-btn');
    check(await page.isHidden('#dev-tools'), '一般模式的選單沒有開發者工具');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 桌機 1280×720 ---------- */
  console.log('桌機 1280×720');
  {
    const { page, errors } = await open({ width: 1280, height: 720 }, '?dev=1&opening=0');
    for (const l of await labelsInside(page)) check(l.ok, `座位標籤「${l.name}」完整顯示`);
    const small = await smallTargets(page);
    check(small.length === 0, `可點目標都 ≥ 44px ${small.length ? JSON.stringify(small) : ''}`);
    await page.screenshot({ path: OUT + 'desktop-overview.png' });
    await page.click('#place');
    await page.click('#p-catalog');
    const inside = await page.evaluate(() => {
      const app = document.getElementById('app').getBoundingClientRect();
      const r = document.querySelector('#sheet .card').getBoundingClientRect();
      return r.left >= app.left && r.right <= app.right && r.top >= app.top && r.bottom <= app.bottom + 1;
    });
    check(inside, '型錄面板完整落在畫面裡');
    check((await smallTargets(page)).length === 0, '型錄面板的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'desktop-catalog.png' });
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    const { page, errors } = await open({ width: 1280, height: 720 }, '?dev=1&speed=20');
    const inApp = (sel) => page.evaluate((q) => {
      const app = document.getElementById('app').getBoundingClientRect();
      return [...document.querySelectorAll(q)].filter((el) => el.offsetParent).every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= app.left - 1 && r.right <= app.right + 1 && r.top >= app.top - 1 && r.bottom <= app.bottom + 1;
      });
    }, sel);
    check(await inApp('.op-office button, .op-office input'), '第一幕的按鈕完整落在畫面裡');
    check((await smallTargets(page)).length === 0, '第一幕的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'desktop-opening-office.png' });
    for (const sel of ['.op-title', '.op-mailbox', '.op-road']) {
      await page.click('#op-skip');
      await page.waitForSelector(sel + '.on');
    }
    await page.click('#op-skip');
    await page.waitForSelector('#op-skip-shop', { state: 'visible', timeout: 15000 });
    await page.click('#op-skip-shop');
    await page.click('#menu-btn');
    await page.click('#dev-day1');
    check(await inApp('#journal .card'), '營業日誌完整落在畫面裡');
    await page.screenshot({ path: OUT + 'desktop-journal.png' });
    await page.click('#jr-close');
    await page.waitForSelector('#read-letter', { state: 'visible', timeout: 15000 });
    await page.click('#read-letter');
    check(await inApp('#letter .card'), '信紙完整落在畫面裡');
    check((await smallTargets(page)).length === 0, '信紙的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'desktop-letter.png' });
    check(errors.length === 0, '沒有 JS 錯誤 ' + errors.join(' | '));
    await page.close();
  }
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
  server.close();
}

console.log(failed ? `\n冒煙測試失敗：${failed} 項` : '\n冒煙測試通過');
process.exit(failed ? 1 : 0);
