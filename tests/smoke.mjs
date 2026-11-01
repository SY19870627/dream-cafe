// 冒煙測試：npm test
// 以 Chromium 載入遊戲，檢查沒有 JS 錯誤、座位標籤不被切掉、點擊目標 ≥ 44px、
// 沖一杯咖啡後杯子上桌看得見、按鈕恢復、溫度 20.0 → 20.5°C、開發者資訊面板。
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
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20');
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

  /* ---------- 一般模式：看不到測試用按鈕 ---------- */
  console.log('手機 390×844（一般模式）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '');
    check(await page.isHidden('#speed'), '一般模式沒有快轉鈕');
    check(await page.evaluate(() => window.__cafe === undefined), '一般模式沒有測試介面');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 桌機 1280×720 ---------- */
  console.log('桌機 1280×720');
  {
    const { page, errors } = await open({ width: 1280, height: 720 }, '?dev=1');
    for (const l of await labelsInside(page)) check(l.ok, `座位標籤「${l.name}」完整顯示`);
    const small = await smallTargets(page);
    check(small.length === 0, `可點目標都 ≥ 44px ${small.length ? JSON.stringify(small) : ''}`);
    await page.screenshot({ path: OUT + 'desktop-overview.png' });
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
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
