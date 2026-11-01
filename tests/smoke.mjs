// 冒煙測試：npm test（先跑 tests/unit/ 的純邏輯單元測試，再跑這支）
// 以 Chromium 載入遊戲，檢查沒有 JS 錯誤、座位標籤不被切掉、點擊目標 ≥ 44px、
// 沖一杯咖啡後杯子上桌看得見、按鈕恢復、溫度 20.0 → 20.5°C、開發者資訊面板；
// 階段 3：開場四幕（與略過、中途重新整理）、營業日誌、第一封老先生的信、舊存檔直接進店。
// 不測開場的段落用 ?dev=1&opening=0 直接當作看過開場；不測熟客的段落加 &regulars=0（溫度與基金才算得準）。
// 要算準溫度的段落另加 &weather=clear：店裡的天氣依季節，碰到雨天坐窗邊會多完成「在雨天坐窗邊喝一杯」。
// 階段 4：三位熟客的故事線（快轉天數走完 18 個里程碑、颱風夜、凱文的三選一、記事本、選豆子）、雨天坐窗邊。
// 階段 5：龍眼（睡覺的地方跟著擺飾、跳上老闆的椅子、點太多次走開）、打烊後（最後一杯、關燈、咖啡日記、明天見、重新整理）、
// 一次客人模式（推門、點單、聽熟客聊天、任務 #17）；三條線的測試裡，予安念稿改由打烊觸發。
// 階段 6：從 36.5°C 走完徵店長與告別（七段）、第二封信、咖啡地圖、常態店（凱文顧店）與重新整理。
// 階段 7：聲音（點過畫面後出聲、沖咖啡有磨豆與注水聲、選單的音樂／音量／店裡的聲音）、效能（解析度倍率、貼圖數）、
// 試玩心得連結、常態店的按鈕寫「請凱文沖一杯」。從新存檔玩到結尾的全流程另見 tests/playthrough.mjs（npm run playthrough）。
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

// 美術評分修正 a：泡泡不碰頂部介面（上緣在介面最下緣往下 ≥ 8px、左右各留 12px）；
// 座位標籤彼此不重疊、也不和泡泡重疊；房間在可用高度裡（地板下緣離按鈕列不遠）
async function overlayProblems(page) {
  return page.evaluate(() => {
    const out = [];
    const app = document.getElementById('app').getBoundingClientRect();
    let uiBottom = 0;
    for (const el of document.querySelectorAll('.top, #speed, #op-skip-shop')) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (r.height) uiBottom = Math.max(uiBottom, r.bottom);
    }
    const b = document.getElementById('bubble');
    const rects = [];
    if (b.classList.contains('show')) {
      const r = b.getBoundingClientRect();
      if (r.top < uiBottom + 8 - 0.5) out.push(`泡泡上緣 ${Math.round(r.top)} 碰到頂部介面（${Math.round(uiBottom)}）`);
      if (r.left < app.left + 12 - 0.5 || r.right > app.right - 12 + 0.5) out.push('泡泡左右沒有留 12px');
      if (!b.textContent.trim()) out.push('畫出了空的泡泡');
      rects.push(['泡泡', r]);
    }
    if (document.getElementById('labels').style.display !== 'none') {
      for (const el of document.querySelectorAll('.seat-label span')) rects.push([el.textContent, el.getBoundingClientRect()]);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const [n1, a] = rects[i], [n2, c] = rects[j];
      if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) out.push(`「${n1}」和「${n2}」重疊`);
    }
    return out;
  });
}

try {
  /* ---------- 手機 390×844，開發者模式加速 ---------- */
  console.log('手機 390×844（?dev=1&speed=20）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&regulars=0&weather=clear');
    for (const l of await labelsInside(page)) check(l.ok, `座位標籤「${l.name}」完整顯示`);
    { const p = await overlayProblems(page); check(p.length === 0, `俯瞰：泡泡不碰頂部介面、標籤和泡泡彼此不重疊 ${p.join('；')}`); }
    {
      // 俯瞰鏡頭依可用高度縮放：房間（座位）不會擠在上半部，角落沙發的標籤落在畫面下半部
      const y = await page.evaluate(() => [...document.querySelectorAll('.seat-label')].find((e) => e.textContent === '角落沙發').getBoundingClientRect().bottom);
      check(y > 844 * 0.6, `俯瞰：房間填滿直立畫面（角落沙發的標籤在 ${Math.round(y)}px）`);
    }
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
    // 階段 7：聲音（WebAudio 合成）與效能
    const au = await page.evaluate(() => window.__cafe.audio);
    check(au.started && au.ctx === 'running', `點過畫面之後聲音開始（${au.ctx}）`);
    check(au.sfx.grind >= 1 && au.sfx.pour >= 3 && au.sfx.pourCup >= 1 && au.sfx.cup >= 1 && au.loops.length === 0, `沖咖啡：磨豆、注水、倒進杯子、杯子上桌都有聲音，沖完就停 ${JSON.stringify(au.sfx)}`);
    check(au.bars >= 1 && au.want.inShop && au.want.volume === 0, `店裡有背景音樂（${au.bars} 小節），音量預設「小」`);
    check((await page.evaluate(() => window.__cafe.audioPeak())) < 0.5, '音量小的時候不會爆音');
    const perf = await page.evaluate(() => window.__cafe.perf);
    check(perf.ratio <= 2 && perf.ratio >= 1 && perf.textures < 80 && perf.calls < 150, `效能：解析度 ×${perf.ratio}、貼圖 ${perf.textures} 張、每幀繪製 ${perf.calls} 次`);
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
    check(links.some(([h]) => h.startsWith('https://github.com/SY19870627/dream-cafe/issues/new')) && (await page.textContent('#about')).includes('試玩版'), '面板有「留下試玩心得」連結、寫著試玩版');
    // 聲音的開關：音樂、音量（小 → 中 → 大 → 小）、店裡的聲音；存進存檔
    check((await page.textContent('#music-toggle')) === '音樂：開' && (await page.textContent('#volume-btn')) === '音量：小' && (await page.textContent('#sound-toggle')) === '店裡的聲音：開', '選單：音樂開、音量小、店裡的聲音開');
    await page.click('#volume-btn');
    await page.click('#music-toggle');
    check((await page.textContent('#volume-btn')) === '音量：中' && (await page.textContent('#music-toggle')) === '音樂：關', '可以調音量、關掉音樂');
    const st = await page.evaluate(() => ({ s: window.__cafe.settings, a: window.__cafe.audio.want }));
    check(st.s.volume === 1 && st.s.music === false && st.a.music === false && st.a.volume === 1, '設定存進存檔，聲音跟著變');
    await page.click('#volume-btn'); await page.click('#volume-btn'); await page.click('#music-toggle');
    check((await page.textContent('#volume-btn')) === '音量：小' && (await page.textContent('#music-toggle')) === '音樂：開', '音量轉一圈回到「小」、音樂打開');
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
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&regulars=0&weather=clear');
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
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&weather=clear');
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
    {
      // 律師信一出現就是不透明的紙色卡片配深色字（不從透明淡入）
      const st = await page.evaluate(() => { const e = document.querySelector('.op-lawyer'); const s = getComputedStyle(e); return { o: Number(s.opacity), bg: s.backgroundColor, c: s.color }; });
      check(st.o === 1 && st.bg === 'rgb(251, 248, 241)' && st.c === 'rgb(42, 38, 34)', `律師信一出現就看得清楚 ${JSON.stringify(st)}`);
    }
    await page.screenshot({ path: OUT + 'phone-opening-letter.png' });
    await page.click('.op-mailbox #op-next');
    await page.waitForSelector('.op-road.on');
    check((await smallTargets(page)).length === 0, '第三幕的按鈕都 ≥ 44px');
    await page.click('.op-road #op-next');
    await page.waitForFunction(() => window.__cafe.tutorial === 'enter', null, { timeout: 5000 });
    check(await page.evaluate(() => window.__cafe.mode === 'door'), '推門進去：鏡頭在門口');
    await page.waitForFunction(() => window.__cafe.tutorial === 'sit', null, { timeout: 10000 });
    check(await page.isHidden('#place') && await page.isVisible('#op-skip-shop'), '第四幕：「先坐。」只留座位，佈置鈕先收起來');
    { const p = await overlayProblems(page); check(p.length === 0, `第四幕：泡泡與標籤避開「略過開場」與快轉 ${p.join('；')}`); }
    check(!(await cafe('yuanHere')), '開店第 1 天予安還沒來');
    check((await cafe('stored')).length === 0, '初始擺飾還沒送');
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForFunction(() => window.__cafe.brewing, null, { timeout: 5000 });
    check(true, '坐下之後德叔自己開始沖');
    await page.waitForFunction(() => window.__cafe.tutorial === 'choose', null, { timeout: 40000 });
    { const t = await cafe('temp'), ts = await cafe('tasks'); check(t === 20.5 && ts.includes('first-coffee'), `第一杯：溫度 20 → 20.5°C（${t}°C，${ts}）`); }
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
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&regulars=0');
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

  /* ---------- 階段 4：三位熟客的故事線 ---------- */
  console.log('手機 390×844（三位熟客：快轉天數走完三條線）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=40&opening=0');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    const story = () => cafe('story');
    const done = (st) => ['yuan', 'zhe', 'kevin'].reduce((n, w) => n + st[w].milestones.length, 0);
    // 第 1 天：阿哲拎著龍眼乾來（可離線的里程碑，老闆在就當場演）
    await page.waitForFunction(() => window.__cafe.here.includes('zhe'), null, { timeout: 15000 });
    check(true, '第 1 天：阿哲走進店裡');
    await page.waitForFunction(() => window.__cafe.story.zhe.milestones.includes(1) && !window.__cafe.scene, null, { timeout: 20000 });
    let st = await story();
    check(st.menu.includes('longan') && (await cafe('tasks')).includes('zhe-longan'), '阿哲的龍眼乾：菜單多了窯烤龍眼乾、溫度任務完成');
    await page.screenshot({ path: OUT + 'phone-regulars-zhe.png' });
    // 坐在窗邊座，之後每天都從這裡看（凱文的問題要老闆坐著才會發生）
    await page.waitForSelector('.seat-label >> text=窗邊座', { state: 'visible', timeout: 10000 });
    await page.click('.seat-label >> text=窗邊座');
    const shots = new Set();
    let choiceSmall = null, kevinOptions = null;
    const closedFor = new Set();
    let readAfterClosing = false, guestSeen = false;
    // 一天裡要發生的事都發生完：選項就選第一個、信就讀、紙就收好
    async function pump(label) {
      const t0 = Date.now();
      while (Date.now() - t0 < 90000) {
        const s = await page.evaluate(() => ({ busy: window.__cafe.storyBusy, scene: window.__cafe.scene, weather: window.__cafe.weather, choosing: window.__cafe.choosing }));
        if (s.scene === 'zhe3' && s.weather === 'typhoon' && !shots.has('typhoon')) {
          await page.waitForTimeout(150);
          shots.add('typhoon');
          await page.screenshot({ path: OUT + 'phone-regulars-typhoon.png' });
        }
        if (s.scene === 'kevin2' && !shots.has('kevin2') && (await page.textContent('#bubble')).includes('謝謝。我是說貓')) {
          shots.add('kevin2');
          await page.screenshot({ path: OUT + 'phone-regulars-kevin-cat.png' });
        }
        if (await page.isVisible('#choices')) {
          if (s.scene === 'kevin4') {
            kevinOptions = await page.$$eval('#choices button', (bs) => bs.map((b) => b.textContent));
            choiceSmall = await smallTargets(page);
            await page.screenshot({ path: OUT + 'phone-regulars-choice.png' });
          }
          await page.click('#choices button >> nth=0');
          continue;
        }
        if (await page.isVisible('#letter')) {
          if (s.scene === 'yuan5' && !shots.has('manuscript')) { shots.add('manuscript'); await page.screenshot({ path: OUT + 'phone-regulars-manuscript.png' }); }
          await page.click('#lt-close');
          continue;
        }
        if (await page.isVisible('#read-letter')) { await page.click('#read-letter'); continue; }
        // 予安想等打烊：站起來按「打烊」，再坐回窗邊喝最後一杯；客人模式也坐窗邊
        const x = await page.evaluate(() => ({ need: window.__cafe.needClosing, closing: window.__cafe.closing, guest: window.__cafe.guest, mode: window.__cafe.mode }));
        if (x.need && !s.scene && !s.choosing) {
          if (await page.isVisible('#stand')) { await page.click('#stand'); continue; }
          if (await page.isVisible('#close-shop')) { await page.click('#close-shop'); closedFor.add('yuan5'); continue; }
        }
        if ((x.closing === 'lastcup' || x.guest === 'sit') && x.mode !== 'seat' && await page.isVisible('.seat-label >> text=窗邊座')) {
          await page.click('.seat-label >> text=窗邊座');
          continue;
        }
        if (s.scene === 'yuan5' && x.closing === 'after') readAfterClosing = true;
        if (x.guest === 'talk') guestSeen = true;
        if (!s.busy) return true;
        await page.waitForTimeout(120);
      }
      check(false, `${label}：熟客的事情在時限內發生完`);
      return false;
    }
    await pump('第 1 天');
    let day = 1;
    const journals = [];
    while (day < 30 && done(await story()) < 18) {
      await page.click('#menu-btn');
      await page.click('#dev-day1');
      day++;
      if (await page.isVisible('#journal')) { journals.push(await page.textContent('#jr-body')); await page.click('#jr-close'); }
      if (!(await pump(`第 ${day} 天`))) break;
    }
    st = await story();
    check(done(st) === 18, `快轉到第 ${day} 天，三條線的 18 個里程碑都發生了`);
    check(['yuan', 'zhe', 'kevin'].every((w) => JSON.stringify(st[w].milestones) === '[1,2,3,4,5,6]'), '每個里程碑只發生一次、照順序');
    check(day <= 25, `大約三週走完（第 ${day} 天）`);
    check(st.typhoonDay >= 8 && shots.has('typhoon'), `第 2 週的颱風夜（第 ${st.typhoonDay} 天）`);
    check(st.zhe.on[4] >= st.zhe.on[3] + 3, '颱風後 3 天，阿哲和阿公一起來');
    check(kevinOptions?.length === 3 && st.answers.kevinQuit === 0, `凱文問「你當初怎麼敢辭職的？」：三選一 ${JSON.stringify(kevinOptions)}`);
    check(choiceSmall && choiceSmall.length === 0, '選項按鈕都 ≥ 44px');
    check(shots.has('kevin2') && shots.has('manuscript'), '凱文被罵時龍眼陪他、予安念稿');
    check(closedFor.has('yuan5') && readAfterClosing, '予安念稿：老闆按了「打烊」、喝完最後一杯之後才念');
    check(guestSeen && (await cafe('tasks')).includes('guest-visit'), '溫度到了 28°C，德叔邀請老闆從門口進來一次（客人模式）');
    const tasks = await cafe('tasks');
    check(['zhe-longan', 'yuan-pen', 'kevin-scolded', 'yuan-kiln', 'typhoon', 'kevin-no-laptop', 'zhe-grandpa', 'yuan-reading', 'zhe-beans', 'yuan-book'].every((id) => tasks.includes(id)), '熟客的 10 個溫度任務都完成');
    check((await cafe('fund')) === (await cafe('ledgerSum')), '基金與帳本一致');
    const owned = await cafe('owned');
    check(owned.includes('napkin') && owned.includes('yuan-book'), '寫滿字的紙巾、予安的書收進倉庫');
    check(st.menu.includes('zhe-beans'), '菜單上架「阿哲的豆」');
    check(journals.length > 0 && !journals.join('').match(/不划算|KPI/), '日誌裡沒有「不划算」之類的字眼');
    // 選豆子：菜單上有兩支豆子時，先選今天喝哪一支
    await page.waitForSelector('#brew', { state: 'visible', timeout: 10000 });
    await page.click('#brew');
    check(await page.isVisible('#choices') && (await page.textContent('#choices')).includes('阿哲的豆'), '請德叔沖一杯：先選東山的豆或阿哲的豆');
    await page.click('#choices button:has-text("阿哲的豆")');
    await page.waitForFunction(() => window.__cafe.brewing, null, { timeout: 5000 });
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 20000 });
    check(true, '阿哲的豆沖好上桌');
    // 記事本：店裡的熟客、菜單、予安的稿子與扉頁
    await page.click('#menu-btn');
    await page.click('#open-notebook');
    const nb = await page.textContent('#notebook');
    check(nb.includes('店裡的熟客') && nb.includes('林予安') && nb.includes('陳柏哲') && nb.includes('張凱文') && nb.includes('阿哲的豆'), '記事本：店裡的熟客與菜單');
    const links = await page.$$eval('#nb-links button', (bs) => bs.map((b) => b.textContent));
    check(links.includes('予安念的稿子') && links.includes('予安的書・扉頁'), '記事本可以重讀予安的稿子與扉頁');
    check((await smallTargets(page)).length === 0, '記事本的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-regulars-notebook.png' });
    await page.click('#nb-links button:has-text("扉頁")');
    check((await page.textContent('#lt-body')).includes('給一間讓人敢慢下來的店。'), '扉頁：「給一間讓人敢慢下來的店。」');
    await page.click('#lt-close');
    // 重新整理：故事進度都在，同一天的予安、凱文還在位子上
    const before = await story();
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1500);
    const after = await story();
    check(JSON.stringify(after.yuan.milestones) === JSON.stringify(before.yuan.milestones) && after.zhe.visits === before.zhe.visits, '重新整理後熟客的進度都在');
    check(!(await cafe('scene')), '重新整理不會重演已經發生的里程碑');
    // 倉庫：熟客送的東西可以擺出來
    await page.click('#place');
    await page.click('#p-store');
    check((await page.textContent('#sheet-list')).includes('寫滿字的紙巾') && (await page.textContent('#sheet-list')).includes('予安的書'), '倉庫裡有寫滿字的紙巾與予安的書');
    await page.click('.sheet-row:has-text("寫滿字的紙巾") button');
    await page.click('#p-done');
    check((await cafe('placed')).includes('napkin'), '紙巾擺進店裡');
    await page.click('#place');
    await page.click('#p-catalog');
    check(!(await page.textContent('#sheet-list')).includes('寫滿字的紙巾'), '熟客送的東西不在型錄上賣');
    await page.click('#sheet-close');
    await page.click('#p-done');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 階段 4：雨天坐窗邊、颱風夜的畫面 ---------- */
  console.log('手機 390×844（雨天）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&regulars=0&weather=rain');
    check((await page.evaluate(() => window.__cafe.weather)) === 'rain', '店裡下雨');
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1600);
    await page.screenshot({ path: OUT + 'phone-rain-window.png' });
    await page.click('#brew');
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 20000 });
    await page.waitForFunction(() => window.__cafe.tasks.includes('rain-window'), null, { timeout: 5000 });
    check(true, '雨天坐窗邊喝一杯：溫度任務完成');
    await page.click('#menu-btn');
    check(await page.isVisible('#sound-toggle') && (await page.textContent('#sound-toggle')).includes('開'), '選單裡可以關掉店裡的聲音（含風雨聲）');
    check((await page.evaluate(() => window.__cafe.audio.want.weather)) === 'rain', '雨聲跟著店裡的天氣');
    await page.click('#sound-toggle');
    check((await page.textContent('#sound-toggle')).includes('關') && (await page.evaluate(() => window.__cafe.audio.want.sfx)) === false, '店裡的聲音：關');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 階段 5：龍眼 ---------- */
  console.log('手機 390×844（龍眼：睡覺的地方、跳上椅子、拒絕互動）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&regulars=0');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    check(['sofa', 'step', 'sill'].includes(await cafe('catSpot')), `沒有貓窩時，龍眼睡在沙發、台階或窗台下（${await cafe('catSpot')}）`);
    // 坐一會兒再站起來：椅子還熱著，龍眼跳上去（任務 #7）
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1200);
    await page.click('#stand');
    await page.waitForFunction(() => window.__cafe.catOnSeat === 'window', null, { timeout: 15000 });
    await page.waitForFunction(() => window.__cafe.tasks.includes('cat-chair'), null, { timeout: 5000 });
    check(Math.abs((await cafe('catPos')).y - 0.42) < 0.01, '龍眼跳上老闆剛坐過的椅子，任務 #7 完成');
    await page.waitForFunction(() => document.getElementById('bubble').textContent.includes('龍眼最會挑位子'), null, { timeout: 5000 });
    check(true, '德叔一句話帶出（不跳任務清單）');
    await page.screenshot({ path: OUT + 'phone-cat-chair.png' });
    // 坐回去：龍眼跳下來讓位
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForFunction(() => !window.__cafe.catOnSeat, null, { timeout: 5000 });
    check(true, '老闆坐回去，龍眼跳下來');
    await page.click('#stand');
    await page.waitForFunction(() => !window.__cafe.catBusy, null, { timeout: 15000 });
    // 點太多次：他轉身走開，一陣子不理人
    for (let i = 0; i < 4; i++) {
      const p = await page.evaluate(() => window.__cafe.catOnScreen());
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(150);
    }
    check(await cafe('catAway'), '點龍眼太多次，他走開了（可以拒絕互動）');
    // 擺一個貓咪軟墊：龍眼當天就去睡
    await page.click('#menu-btn');
    await page.click('#dev-fund');
    await page.click('#about-close');
    await page.click('#place');
    await page.click('#p-catalog');
    await page.click('.sheet-row:has-text("貓咪軟墊") button');
    await page.click('#p-done');
    await page.waitForFunction(() => window.__cafe.catSpot === 'cushion', null, { timeout: 5000 });
    check((await cafe('placed')).includes('cat-cushion'), '擺了貓咪軟墊之後，龍眼今天換到軟墊上睡');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 階段 5：打烊後模式 ---------- */
  console.log('手機 390×844（打烊後：最後一杯、關燈、今天的一杯、明天見）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&regulars=0');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    check(await page.isVisible('#close-shop'), '俯瞰時有「打烊」');
    check((await smallTargets(page)).length === 0, '「打烊」與其他按鈕都 ≥ 44px');
    await page.click('#close-shop');
    check(await page.isHidden('#close-shop') && await page.isHidden('#place'), '按下打烊：按鈕先收起來');
    await page.waitForFunction(() => window.__cafe.closing === 'lastcup', null, { timeout: 20000 });
    check(await cafe('night'), '天色轉成夜裡');
    await page.screenshot({ path: OUT + 'phone-closing-lastcup.png' });
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForFunction(() => window.__cafe.brewing, null, { timeout: 8000 });
    check(true, '坐下之後，德叔沖最後一杯');
    await page.waitForFunction(() => window.__cafe.closing === 'after', null, { timeout: 25000 });
    check((await page.textContent('#bubble')).includes('最後一杯，是老闆的。'), '端上桌：「最後一杯，是老闆的。」');
    check((await cafe('closingSave')).lastCup, '最後一杯記進存檔');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: OUT + 'phone-closing-lastcup-served.png' });
    check(await page.isVisible('#diary-btn') && await page.isVisible('#goodnight') && await page.isHidden('#brew') && await page.isHidden('#night'), '打烊後：今天的一杯、明天見（不再沖咖啡）');
    check(await page.isHidden('#hint'), '打烊後沒有任何提示');
    await page.click('#stand');
    await page.waitForFunction(() => window.__cafe.deshuWiping, null, { timeout: 15000 });
    check(true, '德叔在吧台擦那個琺瑯杯');
    const lights = await page.$$('.light-label');
    check(lights.length >= 2, `每盞燈旁邊有開關（${lights.length} 盞）`);
    check((await smallTargets(page)).length === 0, '關燈的按鈕都 ≥ 44px');
    await page.waitForTimeout(800);
    await page.screenshot({ path: OUT + 'phone-closing-after.png' });
    const hemiOn = await cafe('hemi');
    for (let i = 0; i < lights.length; i++) { await page.click('.light-label:not(.off) >> nth=0'); await page.waitForTimeout(400); }
    await page.waitForTimeout(1200);
    check((await cafe('pendantLevels')).every((v) => v < 0.05) && (await cafe('hemi')) < hemiOn, '燈一盞一盞由老闆自己關，店裡只剩月光');
    check((await cafe('closingSave')).lightsOff.length === lights.length, '關掉的燈記進存檔');
    await page.screenshot({ path: OUT + 'phone-closing-dark.png' });
    // 摸龍眼
    const cp = await page.evaluate(() => window.__cafe.catOnScreen());
    await page.mouse.click(cp.x, cp.y);
    await page.waitForTimeout(200);
    check((await page.textContent('#bubble')).startsWith('龍眼'), '打烊後可以摸龍眼');
    // 今天的一杯
    await page.click('#diary-btn');
    check(await page.isVisible('#diary') && (await page.textContent('#dy-sub')).includes('東山的豆'), '「今天的一杯」寫著今天喝的豆子');
    check((await smallTargets(page)).length === 0, '日記的按鈕都 ≥ 44px');
    await page.fill('#dy-text', '今天的山很清楚，咖啡也是。');
    await page.screenshot({ path: OUT + 'phone-closing-diary.png' });
    await page.click('#dy-save');
    check((await cafe('diary'))[0]?.text === '今天的山很清楚，咖啡也是。', '日記存進存檔');
    // 整理擺飾：打烊後也可以佈置
    await page.click('#place');
    check(await page.isVisible('#p-done') && (await page.$$eval('.light-label', (b) => b.filter((x) => x.offsetParent).length)) === 0, '打烊後可以整理擺飾');
    await page.click('#p-done');
    await page.click('#goodnight');
    await page.waitForSelector('#closed', { state: 'visible', timeout: 10000 });
    check((await page.textContent('#closed')).includes('今天的山很清楚'), '明天見：畫面暗下來，寫著今天的一杯');
    check((await smallTargets(page)).length === 0, '打烊畫面的按鈕 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-closing-goodnight.png' });
    await page.click('#cl-stay');
    check(await page.isHidden('#closed') && (await cafe('closing')) === 'after', '「再待一下」回到打烊後的店裡');
    // 重新整理：同一天仍是打烊後的店，燈還是關著
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1500);
    check((await cafe('closing')) === 'after' && (await cafe('night')) && (await cafe('pendantLevels')).every((v) => v < 0.05), '重新整理：今天已經打烊，燈也還關著');
    await page.click('#menu-btn');
    await page.click('#open-notebook');
    await page.click('#nb-links button:has-text("今天的一杯")');
    check((await page.textContent('#dy-read')).includes('今天的山很清楚'), '記事本可以翻咖啡日記');
    await page.click('#dy-close');
    // 隔天：店重新開門
    await page.click('#menu-btn');
    await page.click('#dev-day1');
    if (await page.isVisible('#journal')) await page.click('#jr-close');
    check(!(await cafe('closing')) && !(await cafe('night')) && await page.isVisible('#close-shop'), '隔天：店重新開門、燈都亮著');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 階段 5：一次客人模式 ---------- */
  console.log('手機 390×844（一次客人模式）');
  {
    // &guest=1：不看溫度，店裡安靜下來就邀請（正式條件是溫度 ≥ 28°C，見上面三條線的測試）
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&guest=1');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    await page.waitForFunction(() => window.__cafe.guest === 'offer', null, { timeout: 30000 });
    check((await page.textContent('#bubble')).includes('要不要從門口進來一次'), '德叔邀請：「老闆，今天要不要從門口進來一次？」');
    check((await smallTargets(page)).length === 0, '邀請的選項 ≥ 44px');
    await page.click('#choices button >> nth=0');
    await page.waitForFunction(() => window.__cafe.mode === 'door', null, { timeout: 8000 });
    await page.waitForFunction(() => document.getElementById('bubble').textContent.includes('歡迎。不急，先坐。'), null, { timeout: 8000 });
    check(true, '推門進店：「歡迎。不急，先坐。」');
    await page.screenshot({ path: OUT + 'phone-guest-door.png' });
    await page.waitForFunction(() => window.__cafe.guest === 'sit', null, { timeout: 8000 });
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForSelector('#choices button', { state: 'visible', timeout: 15000 });
    check((await page.textContent('#bubble')).includes('今天想喝點什麼'), '坐下之後，德叔過來點單');
    await page.screenshot({ path: OUT + 'phone-guest-order.png' });
    await page.click('#choices button >> nth=0');
    await page.waitForFunction(() => window.__cafe.guest === 'talk', null, { timeout: 30000 });
    const pair = await cafe('guestPair');
    check(pair?.length === 2 && pair.every((w) => ['yuan', 'zhe', 'kevin'].includes(w)), `兩位熟客聊這間店（${pair}）`);
    const heard = new Set();
    while (await cafe('guest')) { heard.add(await page.textContent('#bubble')); await page.waitForTimeout(50); }
    check([...heard].join('|').includes('老闆，好像不常在'), '聽到客人聊這間店的老闆');
    check((await cafe('tasks')).includes('guest-visit'), '客人模式完成：任務 #17');
    check(await page.isVisible('#stand') && (await cafe('mode')) === 'seat', '結束後還坐在位子上，按鈕恢復');
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(3000);
    check(!(await cafe('guest')), '當過一次客人，不會再邀請');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 桌機 1280×720 ---------- */
  console.log('桌機 1280×720');
  {
    const { page, errors } = await open({ width: 1280, height: 720 }, '?dev=1&speed=20&opening=0&regulars=0');
    for (const l of await labelsInside(page)) check(l.ok, `座位標籤「${l.name}」完整顯示`);
    { const p = await overlayProblems(page); check(p.length === 0, `桌機俯瞰：泡泡與標籤 ${p.join('；')}`); }
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
    await page.click('#sheet-close');
    await page.click('#p-done');
    // 打烊後（桌機）：按鈕一排放得下，日記卡片在畫面裡
    await page.click('#close-shop');
    await page.waitForFunction(() => window.__cafe.closing === 'lastcup', null, { timeout: 60000 });
    await page.click('.seat-label >> text=吧台座');
    await page.waitForFunction(() => window.__cafe.closing === 'after', null, { timeout: 90000 });
    const row = await page.evaluate(() => {
      const app = document.getElementById('app').getBoundingClientRect();
      return [...document.querySelectorAll('.bottom .row button')].filter((b) => b.offsetParent)
        .every((b) => { const r = b.getBoundingClientRect(); return r.left >= app.left && r.right <= app.right && r.height < 60; });
    });
    check(row, '打烊後的按鈕一排放得下');
    await page.click('#diary-btn');
    const card = await page.evaluate(() => {
      const app = document.getElementById('app').getBoundingClientRect();
      const r = document.querySelector('#diary .card').getBoundingClientRect();
      return r.left >= app.left && r.right <= app.right && r.top >= app.top && r.bottom <= app.bottom;
    });
    check(card, '「今天的一杯」完整落在畫面裡');
    await page.screenshot({ path: OUT + 'desktop-closing-diary.png' });
    await page.click('#dy-cancel');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    const { page, errors } = await open({ width: 1280, height: 720 }, '?dev=1&speed=20&regulars=0');
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

  /* ---------- 階段 6：從 36.5°C 走完告別、第二封信、咖啡地圖、常態店 ---------- */
  console.log('手機 390×844（徵店長與告別：從 36.5°C 開始）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=40&opening=0&weather=clear');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    const fw = () => cafe('farewell');
    // 記下所有說過的話（快轉時泡泡一閃而過）
    await page.evaluate(() => { window.__said = []; new MutationObserver(() => window.__said.push(document.getElementById('bubble').textContent)).observe(document.getElementById('bubble'), { childList: true, subtree: true, characterData: true }); });
    const said = () => page.evaluate(() => window.__said.join('|'));
    await page.click('#menu-btn');
    await page.click('#dev-fw');
    check((await cafe('temp')) === 36.5, '開發者工具「告別前」：36.5°C');
    // 擺上第一件擺飾：37°C
    await page.click('#place');
    await page.click('#p-store');
    await page.click('.sheet-row >> nth=0 >> button');
    await page.click('#p-done');
    await page.waitForFunction(() => window.__cafe.temp === 37, null, { timeout: 5000 });
    check(true, '溫度到 37°C');
    let choiceSmall = [];
    const seen = {};
    // 告別的事情都發生完：選項選第一個、信與啟事收好；close＝要打烊的段落就按「打烊」、坐窗邊喝最後一杯
    async function pump(until, label, close = false) {
      const t0 = Date.now();
      while (Date.now() - t0 < 90000) {
        if (await until()) return true;
        const bub = await said();
        for (const k of ['自己呼吸', '教不來', '下一本，寫你的店', '花蓮舞鶴', '這一杯，是你的', '路上小心']) if (bub.includes(k)) seen[k] = true;
        if (await page.isVisible('#choices')) { choiceSmall = choiceSmall.concat(await smallTargets(page)); seen['choice:' + (await page.textContent('#choices'))] = true; await page.click('#choices button >> nth=0'); continue; }
        if (await page.isVisible('#letter')) { seen['letter:' + (await page.textContent('#lt-title'))] = await page.textContent('#lt-body'); await page.click('#lt-close'); continue; }
        if (await page.isVisible('#journal')) { await page.click('#jr-close'); continue; }
        if (await page.isVisible('#read-letter')) { await page.click('#read-letter'); continue; }
        const x = await page.evaluate(() => ({ closing: window.__cafe.closing, mode: window.__cafe.mode, scene: window.__cafe.scene }));
        if (close && !x.closing && !x.scene) {
          if (await page.isVisible('#stand')) { await page.click('#stand'); continue; }
          if (await page.isVisible('#close-shop')) { await page.click('#close-shop'); continue; }
        }
        if (x.closing === 'lastcup' && x.mode !== 'seat' && await page.isVisible('.seat-label >> text=窗邊座')) { await page.click('.seat-label >> text=窗邊座'); continue; }
        await page.waitForTimeout(100);
      }
      check(false, `${label}：在時限內發生完 ${JSON.stringify(await fw())}`);
      return false;
    }
    const step = (n) => async () => (await fw()).step >= n;
    const nextDay = async () => { await page.click('#menu-btn'); await page.click('#dev-day1'); };
    // 第 1、2 段：打烊後
    await pump(step(2), '店會自己呼吸了、徵才啟事', true);
    let f = await fw();
    check(seen['自己呼吸'] && f.on[1] === f.on[2], '打烊後：「這間店已經會自己呼吸了」，接著貼徵才啟事');
    check(Object.keys(seen).some((k) => k.includes('需要喜歡貓') && k.includes('翻桌率不重要')), '徵才啟事三選一（劇本原文）');
    check(f.notice === 'cat' && (await cafe('noticeUp')) && (seen['letter:徵才啟事'] || '').includes('需要喜歡貓'), '啟事貼在門口');
    check(choiceSmall.length === 0, '選項按鈕都 ≥ 44px');
    // 隔天：凱文來面試、予安的告別
    await nextDay();
    await pump(step(4), '凱文面試、予安告別');
    f = await fw();
    check(seen['教不來'] && f.on[3] === f.on[2] + 1, '門貼出去的隔天，凱文來面試（「咖啡我教你。後面那些，教不來。」）');
    check(seen['下一本，寫你的店'] && (await cafe('stored')).includes('framed-napkin'), '予安的告別：裱框的紙巾收進倉庫');
    check(!(await cafe('noticeUp')), '面試之後啟事收起來');
    // 隔天：阿哲的告別、凱文的交接、最後一晚
    await nextDay();
    await pump(step(6), '阿哲告別、凱文交接');
    check(seen['花蓮舞鶴'] && (await cafe('stored')).includes('zhe-bean-bag'), '阿哲的告別：一包阿哲的豆、花蓮舞鶴的老咖啡樹');
    check(Object.keys(seen).some((k) => k.includes('我會常回來。') && k.includes('我會當你的熟客。')), '凱文：「你會常回來吧？」二選一');
    await pump(step(7), '最後一晚', true);
    if ((await said()).includes('這一杯，是你的')) seen['這一杯，是你的'] = true;
    check(seen['這一杯，是你的'] && (await cafe('enamelOnTable')), '最後一晚：琺瑯杯放在老闆面前，德叔第一次叫老闆的名字（沒留名字時說謝謝你，老闆）');
    check((await cafe('here')).includes('kevin') && (await cafe('catPos')).y > 0.3, '龍眼睡在凱文的腿上');
    await page.screenshot({ path: OUT + 'phone-farewell-last-night.png' });
    // 隔天早上：第二封信 → 出發 → 咖啡地圖
    await nextDay();
    check(await cafe('departureDue'), '最後一晚的隔天：離開東山的早上');
    await pump(() => cafe('mapOpen'), '第二封信與咖啡地圖');
    check((seen['letter:第二封信'] || '').includes('之後每一個明天，都是公休。'), '德叔拿出第二封信（劇本原文）');
    const map = await page.textContent('#map');
    check(map.includes('你的咖啡地圖') && map.includes('台南・東山') && map.includes('花蓮・舞鶴') && map.includes('待續'), '咖啡地圖：只亮東山一盞燈，下一站「待續」');
    check((await smallTargets(page)).length === 0, '地圖的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-farewell-map.png' });
    await page.click('#map-back');
    await page.waitForFunction(() => window.__cafe.keeper && !window.__cafe.arriving && window.__cafe.mode === 'overview', null, { timeout: 20000 });
    check((await cafe('barName')) === '凱文' && !(await cafe('here')).includes('kevin'), '回東山坐坐：常態店，凱文在吧台後面顧店');
    // 重新整理：仍是常態店，凱文從門口迎接；可以請凱文沖一杯
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForFunction(() => window.__cafe && window.__cafe.keeper && !window.__cafe.arriving && window.__cafe.mode === 'overview', null, { timeout: 20000 });
    check((await cafe('barName')) === '凱文' && (await fw()).departed && (await fw()).mapSeen, '重新整理後仍是常態店');
    await page.waitForTimeout(1800); // 鏡頭回到俯瞰
    await page.click('.seat-label >> text=吧台座');
    await page.waitForFunction(() => window.__cafe.mode === 'seat', null, { timeout: 5000 });
    await page.waitForSelector('#brew', { state: 'visible', timeout: 10000 });
    await page.click('#brew');
    await page.waitForTimeout(300);
    if (await page.isVisible('#choices')) await page.click('#choices button >> nth=0');
    await page.waitForFunction(() => window.__cafe.brewing, null, { timeout: 5000 });
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 20000 });
    check(true, '常態店裡可以請凱文沖一杯');
    check((await page.textContent('#brew')) === '請凱文沖一杯', '常態店的按鈕寫「請凱文沖一杯」（德叔已經去下一站）');
    await page.click('#stand');
    await page.click('#menu-btn');
    await page.click('#open-notebook');
    const links = await page.$$eval('#nb-links button', (bs) => bs.map((b) => b.textContent));
    check(links.includes('你的咖啡地圖') && links.some((t) => t.startsWith('老先生的第二封信')), '記事本可以重看咖啡地圖與第二封信');
    await page.click('#nb-links button:has-text("你的咖啡地圖")');
    check((await page.textContent('#map-back')) === '闔上', '從記事本打開的地圖可以闔上');
    await page.click('#map-back');
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
