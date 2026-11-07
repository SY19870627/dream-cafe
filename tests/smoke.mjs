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
// 接正式美術：角色與龍眼的材質來自 assets/art；攔下 assets/art 的請求（斷線、404、解碼錯誤）時退回 Canvas 繪圖，照樣坐下、沖一杯、沒有 JS 錯誤。
// 接正式美術第二批（art2a）：店內的材質、窗景、家具與小道具也來自 assets/art，全部失敗時一樣退回 Canvas 繪圖。
// 承峰 11/3 第二輪回饋：店裡的小事（擺飾第一次擺出來的反應、第 1 天予安探頭、店內小事件、&idle=N）。
// 熟客最愛的咖啡（承峰 11/4 Q75～Q78）：點熟客出現「請德叔端一杯給他」、從黑板選、端錯的溫和反應與一天一杯、錯兩次的提示、端對淡入照片（佔位圖）、
// 劇情演出中不出現、找到最愛溫度 +0.5°C、相簿有空格、記事本的入口、重新整理後還在。
// 點黑板打開菜單本（D191）：角落沙發、吧台座、看德叔沖點黑板打開菜單本，點到黑板前面的德叔照舊搭話，拖曳、選項、佈置時不開；
// 黑板菜單（D185～D188）：菜單本（佈置模式的「菜單」、記事本）、寫上／擦掉／寫滿時換一行、最後一杯喝的擦不掉、德叔照黑板沖、
// 德叔換黑板只換黑板上真的有的東西、重新整理後黑板還在、還沒解鎖的品項看不到。
// 誤按打烊（承峰 11/5，D205）：按打烊德叔先問一次（再坐一會兒在最下面）、按鈕列換了 0.5 秒內連點不打烊（觸控）。
// 試咖啡（承峰 11/5，D206、D207）：德叔提一次、試做、測試紀錄、定案上黑板（寫滿時換一行）、隔天德叔提一次只一次、第 8 版舊存檔遷移。
// 烘豆（承峰 11/6，D217）：開店時點烘豆機德叔說一句、打烊後點它選烘焙度（剛好在最下面）、德叔演完走回吧台、架上這一批與菜單本那一句、隔天沖時說一次、重新整理還在。
// 人物誌（承峰 11/6，D218）：記事本「店裡的熟客」點開人物誌頁、一段一段寫進去、照片縮圖、相簿入口、老先生重讀律師信、重新整理還在。
// 碰撞與循路（承峰 11/6）：桌子、吧台、椅子、擺飾都是碰撞物；各位子之間的路不穿過硬的東西；德叔端杯到窗邊座的一路上不在桌子或吧台裡。
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
// 整份要跑十幾分鐘：中途「Target page, context or browser has been closed」時，分得出是分頁當掉還是 Chromium 被外面關掉（外層逾時砍掉子程序）
const t0 = Date.now();
const elapsed = () => `${Math.round((Date.now() - t0) / 1000)} 秒`;
let finishing = false;
browser.on('disconnected', () => { if (!finishing) console.error(`\n!! 瀏覽器在第 ${elapsed()} 中途斷線（沒有分頁當掉的紀錄就是 Chromium 被外面關掉，例如外層指令逾時）`); });
const watchCrash = (page) => page.on('crash', () => console.error(`\n!! 分頁在第 ${elapsed()} 當掉（renderer crash，多半是記憶體不夠）：${page.url()}`));
for (const make of ['newPage', 'newContext']) {
  const orig = browser[make].bind(browser);
  browser[make] = async (...a) => {
    const r = await orig(...a);
    if (make === 'newPage') watchCrash(r); else r.on('page', watchCrash);
    return r;
  };
}

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

// 誤按打烊（D205）：按「打烊」→ 德叔先問一次 → 選第一個「打烊」。按鈕列剛換過時 0.5 秒內按不下去，先等一下
async function closeShop(page) {
  await page.waitForTimeout(600);
  await page.click('#close-shop');
  try { await page.waitForSelector('#choices button', { timeout: 5000 }); } catch { return false; }
  await page.click('#choices button >> nth=0');
  return true;
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
    for (const el of document.querySelectorAll('.top')) { // 美術評分修正 b：快轉併進 .top、「略過開場」移到底部
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

// 美術評分修正 b：彈窗打開時，場景上的標籤、泡泡、提示與按鈕列收起來；遮罩至少 .45、卡片完全不透明
async function modalProblems(page, sel) {
  return page.evaluate((sel) => {
    const out = [];
    const dlg = document.querySelector(sel), card = dlg.querySelector('.card') || dlg;
    for (const s of ['#labels', '#bubble', '.bottom', '#lights']) {
      const el = document.querySelector(s);
      if (getComputedStyle(el).visibility !== 'hidden' && el.style.display !== 'none' && el.getBoundingClientRect().height) out.push(`${s} 從遮罩後面透出來`);
    }
    const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const v = m[1].split(',').map(Number); return v.length > 3 ? v[3] : 1; };
    const bg = alpha(getComputedStyle(dlg).backgroundColor);
    if (bg < 0.45) out.push(`遮罩只有 ${bg}`);
    const cs = getComputedStyle(card);
    if (alpha(cs.backgroundColor) < 1 || Number(cs.opacity) < 1) out.push(`卡片不是完全不透明（${cs.backgroundColor}, ${cs.opacity}）`);
    return out;
  }, sel);
}
// 美術評分修正 b：信紙／日誌的橫線間距＝文字的行高、段落之間沒有多出來的空隙；行首沒有句號、逗號、後引號
async function paperProblems(page, sel, lh) {
  return page.evaluate(([sel, lh]) => {
    const out = [];
    const box = document.querySelector(sel);
    if (getComputedStyle(box).getPropertyValue('--lh').trim() !== `${lh}px`) out.push(`橫線間距不是 ${lh}px`);
    for (const el of box.querySelectorAll('p, li, h3')) {
      const cs = getComputedStyle(el);
      if (cs.lineHeight !== `${lh}px`) out.push(`「${el.textContent.slice(0, 6)}」的行高 ${cs.lineHeight}`);
      if ((parseFloat(cs.marginTop) + parseFloat(cs.marginBottom)) % lh) out.push(`「${el.textContent.slice(0, 6)}」的段落間距不在橫線上`);
    }
    const NO_START = '，。、；：！？」』）〉》…—';
    for (const p of box.querySelectorAll('p')) {
      let top = -1;
      for (const c of p.children) {
        if (c.offsetTop > top + 4) { if (top >= 0 && NO_START.includes(c.textContent[0])) out.push(`行首是「${c.textContent[0]}」`); top = c.offsetTop; }
      }
    }
    return out;
  }, [sel, lh]);
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
    {
      // 美術評分修正 b：頂部只有一列（快轉併進右上角），標題、快轉、溫度、選單一樣高；溫度不是飽和的正紅
      const top = await page.evaluate(() => {
        const hs = ['.title', '#speed', '#temp', '#menu-btn'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().height));
        const rows = new Set(['.title', '#speed', '#temp', '#menu-btn'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().top)));
        return { hs, rows: rows.size, inTop: !!document.querySelector('.top #speed'), bg: getComputedStyle(document.getElementById('temp')).backgroundColor };
      });
      check(top.inTop && top.rows === 1 && top.hs.every((h) => h === 44), `頂部介面一列、膠囊一樣高 44px ${JSON.stringify(top.hs)}`);
      check(top.bg !== 'rgb(196, 56, 44)' && top.bg !== 'rgba(0, 0, 0, 0)', `溫度改成陶土色／琥珀色（${top.bg}）`);
      // 特寫用的人物材質：每公尺至少 400 像素、有 mipmap 與三線性過濾
      const art = await page.evaluate(() => window.__cafe.artInfo);
      check(art.ppm >= 400 && art.mip && art.trilinear, `人物材質的解析度與過濾 ${JSON.stringify(art)}`);
      // 俯瞰：地板下緣離提示不遠（直立畫面下面不留一大塊空白）
      const gap = await page.evaluate(() => window.__cafe.overviewGap());
      check(gap < 50, `俯瞰：地板下緣離提示 ${Math.round(gap)}px`);
    }
    check((await page.textContent('#temp')) === '20.0°C', '一開始溫度 20.0°C');
    await page.screenshot({ path: OUT + 'phone-overview.png' });

    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1600);
    check(await page.evaluate(() => window.__cafe.mode === 'seat'), '點「窗邊座」可以坐下');
    check((await smallTargets(page)).length === 0, '坐下後的按鈕都 ≥ 44px');
    // 美術評分修正 d：坐窗邊座時，龍眼睡在窗台上、在畫面裡（窗邊座的焦點）
    await page.waitForFunction(() => window.__cafe.catOnSill, null, { timeout: 5000 }).catch(() => {});
    const sill = await page.evaluate(() => ({ on: window.__cafe.catOnSill, at: window.__cafe.catOnScreen(), w: document.getElementById('app').clientWidth, h: document.getElementById('app').clientHeight }));
    check(sill.on && sill.at.inFront && sill.at.x > 0 && sill.at.x < sill.w && sill.at.y > 0 && sill.at.y < sill.h, `坐窗邊座時龍眼睡在窗台上、在畫面裡 ${JSON.stringify(sill)}`);

    await page.click('#brew');
    await page.waitForTimeout(200);
    check(await page.evaluate(() => window.__cafe.brewing && window.__cafe.closeup), '按沖咖啡後鏡頭移到吧台');
    // 按住畫面 ×3：×20 時一杯只沖幾秒，電腦忙的時候後面的檢查一拖就沖完了，所以按完沖咖啡馬上按住
    const box = await page.locator('#app canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);
    const held = await page.evaluate(() => ({ brewing: window.__cafe.brewing, speed: window.__cafe.speed }));
    check(held.brewing && held.speed === 60, `沖煮中按住畫面，動作 ×3 ${JSON.stringify(held)}`);
    await page.mouse.up();
    check(await page.evaluate(() => window.__cafe.speed === 20), '放開恢復原速');
    // 美術評分修正 d：德叔的沖煮圖已經拿著手沖壺與濾杯，吧台上的立體器具收起來；沖煮中一直是沖煮圖
    await page.waitForFunction(() => window.__cafe.phase === 'brew' && window.__cafe.art.now.deshu === 'char_deshu_brew', null, { timeout: 5000 }).catch(() => {});
    const kit = await page.evaluate(() => ({ kit: window.__cafe.brewKit, deshu: window.__cafe.art.now.deshu }));
    check(!kit.kit && kit.deshu === 'char_deshu_brew', `沖煮中德叔是沖煮圖、吧台上沒有另一套立體器具 ${JSON.stringify(kit)}`);
    check((await page.textContent('#brew')) === '回座位', '沖煮中按鈕是「回座位」');

    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 20000 });
    check(!(await page.isDisabled('#brew')) && (await page.textContent('#brew')) === '請德叔沖一杯', '杯子上桌後按鈕立刻恢復');
    check(await page.evaluate(() => window.__cafe.tasks.includes('first-coffee') && window.__cafe.temp === 20.5), '杯子上桌那一刻完成任務、溫度 +0.5');
    await page.waitForFunction(() => document.getElementById('temp').textContent === '20.5°C', null, { timeout: 5000 });
    check(true, '右上角溫度爬到 20.5°C');
    // 承峰 11/3 回饋（D180）：完成任務時，地點牌下方淡入一張小紙條，不擋地點牌、溫度與按鈕，幾秒後淡出
    await page.waitForFunction(() => window.__cafe.stageNote, null, { timeout: 5000 });
    {
      const r = await page.evaluate(() => {
        const box = (q) => document.querySelector(q).getBoundingClientRect();
        const n = box('#stage-note'), t = box('.title'), tp = box('#temp'), b = [...document.querySelectorAll('.bottom button')].filter((e) => e.offsetWidth).map((e) => e.getBoundingClientRect());
        const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
        return { text: document.getElementById('stage-note').textContent, below: n.top >= t.bottom, clear: !hit(n, t) && !hit(n, tp) && b.every((x) => !hit(n, x)), inside: n.left >= 0 && n.right <= 390 };
      });
      check(r.text.includes('第一次坐下喝德叔的咖啡') && r.text.includes('+0.5°C'), `完成任務的小紙條：${r.text}`);
      check(r.below && r.clear && r.inside, '小紙條在地點牌下方，不擋地點牌、溫度與按鈕');
      await page.screenshot({ path: OUT + 'phone-stage-note.png' });
      { const p = await overlayProblems(page); check(p.length === 0, `小紙條出現時，泡泡不碰頂部介面 ${p.join('；')}`); }
      await page.waitForFunction(() => !window.__cafe.stageNote, null, { timeout: 8000 });
      check(true, '小紙條幾秒後淡出');
    }
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
    check(links.some(([h]) => h === 'https://github.com/SY19870627')
      && links.some(([h]) => h === 'https://www.threads.com/@ye.c.feng') && links.some(([h]) => h === 'https://vocus.cc/user/@SY19870627'), '面板有 GitHub、Threads、方格子連結');
    check(!links.some(([h]) => /^https?:\/\/([^/]*\.)?(x|twitter)\.com\//i.test(h)) && !(await page.textContent('#about')).includes('@nelsonyehfon'), '面板沒有 X 連結');
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
    { const p = await modalProblems(page, '#journal'); check(p.length === 0, `營業日誌打開時，背景的標籤、泡泡、提示都收起來 ${p.join('；')}`); }
    { const p = await paperProblems(page, '#jr-body', 28); check(p.length === 0, `日誌的字落在橫線上 ${p.join('；')}`); }
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
    check(credit.includes('https://github.com/SY19870627') && credit.includes('https://www.threads.com/@ye.c.feng') && credit.includes('https://vocus.cc/user/@SY19870627') && (await page.textContent('.op-credit')).includes('SY'), '標題畫面底部有開發者資訊');
    check(!credit.some((h) => /^https?:\/\/([^/]*\.)?(x|twitter)\.com\//i.test(h)), '標題畫面底部沒有 X 連結');
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
    check(await page.evaluate(() => !!document.querySelector('.bottom .row #op-skip-shop')), '「略過開場」在底部按鈕列，不壓在場景上');
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
    { const p = await modalProblems(page, '#letter'); check(p.length === 0, `信打開時，背景的「讀信」與提示收起來 ${p.join('；')}`); }
    { const p = await paperProblems(page, '#lt-body', 32); check(p.length === 0, `信紙：橫線對齊每一行、沒有避頭點問題 ${p.join('；')}`); }
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
    let choiceSmall = null, kevinOptions = null, kevinAsk = '';
    let typhoonHint = null, kevinHint = null; // 熟客場景的提示：颱風夜與其他熟客場景都顯示
    const closedFor = new Set();
    let readAfterClosing = false, guestSeen = false;
    // 一天裡要發生的事都發生完：選項就選第一個、信就讀、紙就收好
    async function pump(label) {
      const t0 = Date.now();
      while (Date.now() - t0 < 90000) {
        const s = await page.evaluate(() => ({ busy: window.__cafe.storyBusy, scene: window.__cafe.scene, weather: window.__cafe.weather, choosing: window.__cafe.choosing,
          hint: document.getElementById('hint').hidden ? '' : document.getElementById('hint').textContent }));
        // 熟客場景的提示和場景在同一刻讀（場景演完、提示就換了）：颱風夜與凱文第二幕各取一次
        if (s.scene === 'zhe3' && typhoonHint === null && !s.choosing) typhoonHint = s.hint;
        if (s.scene === 'kevin2' && kevinHint === null && !s.choosing) kevinHint = s.hint;
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
            kevinAsk = (await page.isVisible('#ask')) ? await page.textContent('#ask') : '';
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
          if (await page.isVisible('#close-shop')) { await closeShop(page); closedFor.add('yuan5'); continue; }
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
      check(false, `${label}：熟客的事情在時限內發生完 ${JSON.stringify(await page.evaluate(() => ({ w: window.__cafe.waitInfo, scene: window.__cafe.scene, mode: window.__cafe.mode, closeup: window.__cafe.closeup, here: window.__cafe.here })))}`);
      await page.screenshot({ path: OUT + 'phone-regulars-stuck.png' });
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
    check(kevinAsk.includes('凱文') && kevinAsk.includes('你當初怎麼敢辭職的？'), `三選一的上面一行是凱文的問句（${kevinAsk}）`);
    check(choiceSmall && choiceSmall.length === 0, '選項按鈕都 ≥ 44px');
    check(shots.has('kevin2') && shots.has('manuscript'), '凱文被罵時龍眼陪他、予安念稿');
    check(typhoonHint === '營業中' && kevinHint === '營業中', `颱風夜與凱文第二幕都顯示場景提示（颱風夜「${typhoonHint}」、凱文「${kevinHint}」）`);
    check(closedFor.has('yuan5') && readAfterClosing, '予安念稿：老闆按了「打烊」、喝完最後一杯之後才念');
    check(guestSeen && (await cafe('tasks')).includes('guest-visit'), '溫度到了 28°C，德叔邀請老闆從門口進來一次（客人模式）');
    const tasks = await cafe('tasks');
    check(['zhe-longan', 'yuan-pen', 'kevin-scolded', 'yuan-kiln', 'typhoon', 'kevin-no-laptop', 'zhe-grandpa', 'yuan-reading', 'zhe-beans', 'yuan-book'].every((id) => tasks.includes(id)), '熟客的 10 個溫度任務都完成');
    check((await cafe('fund')) === (await cafe('ledgerSum')), '基金與帳本一致');
    const owned = await cafe('owned');
    check(owned.includes('napkin') && owned.includes('yuan-book'), '寫滿字的紙巾、予安的書收進倉庫');
    check(st.menu.includes('zhe-beans') && st.board.includes('zhe-beans'), `阿哲第六幕：老闆選「寫上去」，阿哲的豆寫上黑板（${st.board.join('、')}）`);
    check(['black', 'iced', 'cocoa'].every((id) => st.menu.includes(id)) && !st.board.includes('black'), '黑咖啡、冰美式、熱可可收進菜單本，沒有自己寫上黑板');
    check(journals.length > 0 && !journals.join('').match(/不划算|KPI/), '日誌裡沒有「不划算」之類的字眼');
    // 選豆子：菜單上有兩支豆子時，先選今天喝哪一支
    await page.waitForSelector('#brew', { state: 'visible', timeout: 10000 });
    await page.click('#brew');
    check(await page.isVisible('#choices') && (await page.textContent('#choices')).includes('阿哲的豆'), '請德叔沖一杯：先選東山的豆或阿哲的豆');
    check(await page.isVisible('#ask') && (await page.textContent('#ask')).includes('今天想喝哪一支豆子？') && await page.evaluate(() => document.getElementById('shade').classList.contains('on')),
      '選項上面有德叔的問句，後面墊一層漸層');
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

  /* ---------- 承峰 11/3 試玩回饋：門口有門、等客人的提示（D178、D179） ---------- */
  console.log('手機 390×844（門口與等客人）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=4&opening=0&weather=clear');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    check((await cafe('door')).stub && !(await cafe('door')).visible, '俯瞰：前牆收起來，門口留出缺口（剖面＋門檻＋腳踏墊）');
    await page.click('.seat-label >> text=角落沙發');
    await page.waitForTimeout(1500);
    await page.mouse.click(195, 300); // 點一下畫面：聲音開始（瀏覽器要使用者先互動）
    check((await cafe('door')).visible && !(await cafe('door')).stub, '坐下：前牆上有門');
    await page.evaluate(() => window.__cafe.look(-1.2));
    await page.waitForTimeout(600);
    await page.screenshot({ path: OUT + 'phone-door-sofa.png' });
    // 第 1 天阿哲會來：走進門之前幾秒，提示列寫「好像有人往這邊走來了……」，門外有腳步聲
    await page.waitForFunction(() => window.__cafe.waitHint.approach, null, { timeout: 30000 });
    const w = await cafe('waitHint');
    check(w.hint === '好像有人往這邊走來了……' && w.breathe, `有人快走到門口：${w.hint}`);
    { const au = await cafe('audio'); check((au.sfx.steps || 0) >= 1, `門外有腳步聲（${au.ctx}）`); }
    check(!(await cafe('here')).includes('zhe'), '腳步聲在阿哲走進門之前');
    await page.waitForFunction(() => window.__cafe.here.includes('zhe'), null, { timeout: 15000 });
    await page.waitForFunction(() => window.__cafe.door.open > 0.05, null, { timeout: 3000 });
    check(true, '阿哲推門進來：門往店裡開');
    await page.waitForFunction(() => window.__cafe.scene, null, { timeout: 30000 });
    const sh = await cafe('waitHint');
    check(sh.hint === '營業中' && sh.breathe, '熟客場景的提示是「營業中」，提示列慢慢呼吸');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 承峰 11/3 第二輪回饋：店裡的小事（前三天的小段落、店內小事件、擺飾的反應） ---------- */
  console.log('手機 390×844（店裡的小事）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=8&opening=0&weather=clear');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    // 擺飾第一次擺出來：德叔說一句（一件一次，存檔記住）
    await page.click('#place');
    await page.click('#p-store');
    await page.click('.sheet-row:has-text("黑板立牌") button');
    await page.click('#p-deselect');
    await page.click('#p-done');
    await page.waitForFunction(() => window.__cafe.moments.decor.includes('menu-board'), null, { timeout: 20000 });
    await page.waitForFunction(() => window.__cafe.moments.lastSaid?.text.includes('不限時'), null, { timeout: 10000 });
    check(true, '擺上黑板立牌：德叔有一句反應，存檔記住已經反應過');
    // 第 1 天：阿哲來過、走了以後，予安在門口探頭看一眼，德叔說一句
    await page.waitForFunction(() => window.__cafe.story.zhe.milestones.includes(1), null, { timeout: 60000 });
    await page.waitForFunction(() => window.__cafe.moments.early.includes('d1-peek'), null, { timeout: 60000 });
    check(!(await cafe('story')).yuan.milestones.length && (await cafe('story')).yuan.visits === 0, '予安探頭不算來店（隔天才是第一次來）');
    await page.waitForFunction(() => window.__cafe.here.includes('yuan'), null, { timeout: 15000 });
    await page.screenshot({ path: OUT + 'phone-moment-peek.png' });
    await page.waitForFunction(() => window.__cafe.moments.lastSaid?.text.includes('窗邊那張桌子'), null, { timeout: 20000 });
    check(!(await cafe('here')).includes('yuan'), '予安看了一眼就走了，德叔說「剛才那位小姐，在門口看了窗邊那張桌子很久。」');
    // 店內小事件：直接演幾件，德叔回到吧台、龍眼還在窗台上
    await page.waitForFunction(() => !window.__cafe.moments.busy, null, { timeout: 15000 });
    for (const id of ['deshu-wipe', 'deshu-board', 'cat-stretch', 'cat-roll', 'window-bike']) {
      check(await page.evaluate((i) => window.__cafe.idleEvent(i, false), id), `店內小事件 ${id}`);
    }
    const m = await cafe('moments');
    const mn = await cafe('menu');
    check(m.deshuFree && (await cafe('catOnSill')) && !m.board.includes('阿里山 水洗') && m.board.join() === mn.lines.join(),
      `德叔回到吧台、龍眼還在窗台上、黑板只寫菜單上真的有的東西（${m.board.join('／')}）`);
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    // 開發者模式 &idle=N：安靜 N 秒就來一件店內小事件（平常 1～3 分鐘）
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=4&opening=0&regulars=0&weather=clear&idle=2');
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForFunction(() => window.__cafe.moments.log.some((x) => x.kind === 'idle'), null, { timeout: 20000 });
    const first = (await page.evaluate(() => window.__cafe.moments.log)).find((x) => x.kind === 'idle');
    check(true, `坐著沒事：店裡自己發生一件小事（${first.id}）`);
    await page.waitForFunction(() => !window.__cafe.moments.busy, null, { timeout: 20000 });
    await page.click('#brew');
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 40000 });
    check((await page.evaluate(() => window.__cafe.tasks)).includes('first-coffee'), '小事件之後照常可以請德叔沖一杯');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 黑板菜單（D185～D188） ---------- */
  console.log('手機 390×844（黑板菜單）');
  {
    // 新存檔：菜單本只有東山的豆，看不到還沒解鎖的品項
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=8&opening=0&regulars=0&weather=clear');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    await page.click('#place');
    check(await page.isVisible('#p-menu'), '佈置模式下面有「菜單」');
    await page.click('#p-menu');
    let rows = await page.$$eval('#sheet-list .menu-row', (rs) => rs.map((r) => r.dataset.item));
    check(JSON.stringify(rows) === '["dongshan"]' && !(await page.textContent('#sheet-list')).match(/黑咖啡|冰美式|熱可可|阿哲|龍眼/), `新存檔的菜單本只有東山的豆，沒有鎖住的格子（${rows}）`);
    check(await page.isDisabled('.menu-row[data-item="dongshan"] button'), '黑板上只有一杯喝的：擦不掉');
    await page.click('#sheet-close');
    await page.click('#p-done');
    await page.close();
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
  }
  {
    // 解鎖全部品項（&menu=all）：寫上、擦掉、寫滿時換一行，馬上寫在黑板上；德叔照黑板沖
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=8&opening=0&regulars=0&weather=clear&menu=all');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    const menu = () => cafe('menu');
    await page.click('#place');
    await page.click('#p-menu');
    const rows = await page.$$eval('#sheet-list .menu-row', (rs) => rs.map((r) => r.dataset.item));
    check(rows.length === 6 && rows[0] === 'dongshan', `菜單本：六樣（${rows.join('、')}）`);
    check((await page.textContent('#sheet-title')) === '菜單本' && (await page.textContent('#sheet-list')).includes('新的'), '剛解鎖的品項標「新的」');
    check((await smallTargets(page)).length === 0, '菜單本的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-menu-book.png' });
    await page.click('.menu-row[data-item="black"] button');
    check((await menu()).board.join() === 'dongshan,black' && (await menu()).lines.join() === '東山 日曬,黑咖啡', '寫上黑板：馬上寫上去');
    await page.click('.menu-row[data-item="cocoa"] button');
    await page.click('.menu-row[data-item="iced"] button');
    let mn = await menu();
    check(mn.board.length === 4 && mn.head === '今日', `寫滿四行（${mn.lines.join('／')}，標題「${mn.head}」）`);
    check((await page.textContent('.menu-row[data-item="longan"] button')) === '換掉一行', '寫滿了：其他品項的按鈕是「換掉一行」');
    await page.click('.menu-row[data-item="longan"] button');
    check((await page.textContent('#sheet-sub')).includes('黑板寫不下了，要擦掉哪一行？') && await page.isVisible('#menu-cancel'), '德叔問「黑板寫不下了，要擦掉哪一行？」，也可以先不寫');
    await page.screenshot({ path: OUT + 'phone-menu-swap.png' });
    await page.click('.menu-row[data-item="cocoa"] button');
    mn = await menu();
    check(mn.board.join() === 'dongshan,black,longan,iced', `換掉熱可可，龍眼乾寫在同一行（${mn.board.join('、')}）`);
    await page.click('.menu-row[data-item="black"] button');
    check(!(await menu()).board.includes('black'), '擦掉：馬上擦掉');
    check((await cafe('fund')) === 0, '寫上、擦掉都不花錢');
    await page.click('#sheet-close');
    await page.click('#p-done');
    // 德叔照黑板沖：黑板上有東山的豆、冰美式（點心龍眼乾附一小碟）
    await page.click('.seat-label >> text=吧台座');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: OUT + 'phone-menu-board.png' });
    await page.click('#brew');
    const opts = await page.$$eval('#choices button', (bs) => bs.map((b) => b.textContent));
    check(JSON.stringify(opts) === '["東山的豆","冰美式"]', `請德叔沖一杯：從黑板上的選（${opts.join('、')}）`);
    check((await page.textContent('#ask')).includes('今天想喝哪一支豆子？'), '都是咖啡：照舊問豆子');
    await page.click('#choices button:has-text("冰美式")');
    await page.waitForFunction(() => window.__cafe.closeup, null, { timeout: 8000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: OUT + 'phone-menu-brew.png' });
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 40000 });
    await page.waitForFunction(() => document.getElementById('bubble').textContent.includes('冰美式。冰塊最後才放'), null, { timeout: 8000 });
    check(true, '冰美式沖好上桌，德叔說那一杯的話');
    // 德叔換黑板：只換黑板上真的有的那幾樣的順序
    await page.waitForFunction(() => !window.__cafe.moments.busy && !window.__cafe.brewing, null, { timeout: 15000 });
    await page.waitForFunction(() => window.__cafe.moments.deshuFree, null, { timeout: 15000 });
    const before = await menu();
    await page.evaluate(() => window.__cafe.idleEvent('deshu-board', false));
    const after = await menu();
    check(after.drinks[0] === 'iced' && before.drinks[0] === 'dongshan' && [...after.lines].sort().join() === [...before.lines].sort().join(), `德叔換黑板：換一杯到最上面，黑板上的東西不變（${after.lines.join('／')}）`);
    // 重新整理：黑板還在
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1500);
    check((await menu()).board.join() === 'dongshan,longan,iced', '重新整理後黑板照舊');
    // 黑板字修正（D189）：黑板寫滿 4 行，手機直向坐吧台座（正面）、看德叔沖、角落沙發，黑板上的字整段在畫面裡、不被德叔或其他東西擋住
    check(await page.evaluate(() => window.__cafe.menuWrite('black')), '黑板寫滿 4 行');
    await page.click('.seat-label >> text=吧台座');
    await page.waitForFunction(() => window.__cafe.camStill, null, { timeout: 8000 });
    await page.waitForTimeout(400);
    let bv = await page.evaluate(() => window.__cafe.boardView());
    check(bv.lines === 4 && bv.inView === 100 && bv.visible >= 97 && bv.charPx >= 13, `坐吧台座：黑板 4 行字都看得到（在畫面裡 ${bv.inView}%、沒被擋住 ${bv.visible}%、字高 ${bv.charPx}px、擋住的 ${JSON.stringify(bv.blockedBy)}）`);
    await page.screenshot({ path: OUT + 'phone-menu-board4.png' });
    await page.click('#brew');
    await page.click('#choices button:has-text("東山的豆")');
    await page.waitForFunction(() => window.__cafe.closeup, null, { timeout: 8000 });
    await page.waitForFunction(() => window.__cafe.camStill, null, { timeout: 8000 });
    bv = await page.evaluate(() => window.__cafe.boardView());
    check(bv.inView >= 97 && bv.visible >= 95 && bv.charPx >= 16, `看德叔沖：黑板的字在德叔旁邊（在畫面裡 ${bv.inView}%、沒被擋住 ${bv.visible}%、字高 ${bv.charPx}px）`);
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 40000 });
    await page.click('#stand');
    await page.waitForTimeout(1500);
    await page.click('.seat-label >> text=角落沙發');
    await page.waitForFunction(() => window.__cafe.camStill, null, { timeout: 8000 });
    await page.waitForTimeout(400);
    bv = await page.evaluate(() => window.__cafe.boardView());
    check(bv.inView === 100 && bv.visible >= 97, `坐角落沙發：黑板的字不被德叔或吧台上的東西擋住（沒被擋住 ${bv.visible}%、字高 ${bv.charPx}px）`);
    await page.click('#stand');
    await page.waitForTimeout(1500);
    check(await page.evaluate(() => window.__cafe.menuErase('black')), '擦掉黑咖啡，回到 3 行');
    // 記事本也打得開菜單本
    await page.click('#menu-btn');
    await page.click('#open-notebook');
    check((await page.textContent('#nb-people')).includes('黑板上：東山的豆・窯烤龍眼乾・冰美式'), '記事本：黑板上寫什麼');
    await page.click('#nb-menu');
    check((await menu()).open, '記事本的「打開菜單本」');
    await page.click('#sheet-close');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 點黑板打開菜單本（D191） ---------- */
  console.log('手機 390×844（點黑板打開菜單本）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=8&opening=0&regulars=0&weather=clear&board=dongshan,zhe-beans,cocoa,longan');
    const isOpen = () => page.evaluate(() => window.__cafe.menu.open);
    const close = async () => { await page.click('#sheet-close'); await page.waitForTimeout(200); };
    const sit = async (name) => {
      await page.click(`.seat-label >> text=${name}`);
      await page.waitForFunction(() => window.__cafe.camStill, null, { timeout: 8000 });
      await page.waitForTimeout(400);
    };
    // 坐角落沙發，點黑板：打開和「佈置」→「菜單」同一本菜單本
    await sit('角落沙發');
    let bv = await page.evaluate(() => window.__cafe.boardView());
    check(!!bv.tap && bv.tap.ok, `角落沙發：boardView() 給得出點得到黑板的一點（${JSON.stringify(bv.tap)}，中心 ${JSON.stringify(bv.center)}）`);
    await page.mouse.click(bv.tap.pageX, bv.tap.pageY);
    await page.waitForTimeout(200);
    check(await isOpen() && (await page.textContent('#sheet-title')) === '菜單本', '角落沙發：點黑板打開菜單本');
    await page.screenshot({ path: OUT + 'phone-board-tap-sofa.png' });
    // 菜單本開著時再點畫面（點到的是面板的背景），不會又開一次，也不會搭話
    await close();
    check(!(await isOpen()), '關上菜單本');
    // 拖曳環顧：拖過去又拖回原處、拖到別的地方，放開時都不開
    await page.mouse.move(bv.tap.pageX, bv.tap.pageY);
    await page.mouse.down();
    await page.mouse.move(bv.tap.pageX - 60, bv.tap.pageY, { steps: 6 });
    await page.mouse.move(bv.tap.pageX, bv.tap.pageY, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    check(!(await isOpen()), '從黑板拖出去又拖回黑板上放開：不開菜單本');
    await page.evaluate(() => window.__cafe.look(0));
    await page.waitForTimeout(600);
    bv = await page.evaluate(() => window.__cafe.boardView());
    await page.mouse.move(bv.tap.pageX + 80, bv.tap.pageY);
    await page.mouse.down();
    await page.mouse.move(bv.tap.pageX, bv.tap.pageY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    check(!(await isOpen()), '拖曳環顧停在黑板上放開：不開菜單本');
    await page.evaluate(() => window.__cafe.look(0));
    await page.click('#stand');
    await page.waitForTimeout(1500);
    // 坐吧台座：德叔站在黑板左半前面，點到德叔照舊搭話；點黑板右邊打開菜單本
    await sit('吧台座');
    const spot = await page.evaluate(() => {
      const W = document.getElementById('app').clientWidth, H = document.getElementById('app').clientHeight;
      for (let y = 40; y < H * 0.7; y += 8) for (let x = 8; x < W; x += 8) {
        const t = window.__cafe.tapWhat(x, y);
        if (t.first === '德叔' && t.behind) return { x, y };
      }
      return null;
    });
    check(!!spot, `吧台座：找得到德叔站在黑板前面的一點（${JSON.stringify(spot)}）`);
    if (spot) {
      const box = await page.$eval('#app', (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top }; });
      const said0 = await page.evaluate(() => window.__cafe.moments.lastSaid);
      await page.mouse.click(box.x + spot.x, box.y + spot.y);
      await page.waitForTimeout(300);
      const said = await page.evaluate(() => window.__cafe.moments.lastSaid);
      check(!(await isOpen()) && said?.name === '德叔' && said.at !== said0?.at, `點到黑板前面的德叔：照舊搭話、不開菜單本（${said?.name}：${said?.text}）`);
    }
    bv = await page.evaluate(() => window.__cafe.boardView());
    await page.mouse.click(bv.tap.pageX, bv.tap.pageY);
    await page.waitForTimeout(200);
    check(await isOpen(), '吧台座：點黑板打開菜單本');
    await close();
    // 選項出現時（請德叔沖一杯）點黑板：不開
    await page.click('#brew');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.__cafe.tapWhat(0, 0).ok) === false, '選項出現時：點黑板不會開（tapWhat().ok 為 false）');
    await page.mouse.click(bv.tap.pageX, bv.tap.pageY);
    await page.waitForTimeout(200);
    check(!(await isOpen()), '選項出現時點黑板：不開菜單本');
    await page.click('#choices button:has-text("東山的豆")');
    await page.waitForFunction(() => window.__cafe.closeup, null, { timeout: 8000 });
    await page.waitForFunction(() => window.__cafe.camStill, null, { timeout: 8000 });
    bv = await page.evaluate(() => window.__cafe.boardView());
    await page.mouse.click(bv.tap.pageX, bv.tap.pageY);
    await page.waitForTimeout(200);
    check(await isOpen(), '看德叔沖的近景：點黑板打開菜單本（沖煮照舊）');
    await close();
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 40000 });
    await page.click('#stand');
    await page.waitForTimeout(1500);
    // 佈置模式：點黑板不開（點擊是用來選、搬擺飾的）
    await page.click('#place');
    await page.waitForTimeout(800);
    check((await page.evaluate(() => window.__cafe.tapWhat(0, 0).ok)) === false, '佈置模式：點黑板不會開');
    await page.click('#p-done');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    // 觸控（手機：isMobile、hasTouch、deviceScaleFactor 2）：坐角落沙發，用手指點黑板
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(url + '?dev=1&speed=8&opening=0&regulars=0&weather=clear&board=dongshan,zhe-beans,cocoa,longan');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1800);
    await page.tap('.seat-label >> text=角落沙發');
    await page.waitForFunction(() => window.__cafe.camStill, null, { timeout: 8000 });
    await page.waitForTimeout(400);
    const bv = await page.evaluate(() => window.__cafe.boardView());
    await page.touchscreen.tap(bv.tap.pageX, bv.tap.pageY);
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.__cafe.menu.open), `觸控：坐角落沙發用手指點黑板（${bv.tap.pageX}, ${bv.tap.pageY}）打開菜單本`);
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await ctx.close();
  }

  /* ---------- 熟客最愛的咖啡、相簿（承峰 11/4 Q75～Q78，favorites.js） ---------- */
  console.log('手機 390×844（熟客最愛的咖啡、相簿）');
  {
    // 觸控的手機（isMobile、hasTouch、deviceScaleFactor 2）。照片只接了予安一二三段與阿哲第三段（D204），其他還沒畫：assets/art/photo_*.webp 是 404，
    // 瀏覽器會記一筆「Failed to load resource」（網路層的訊息，不是 JS 錯誤），只放過照片的那幾筆
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/\/assets\/art\/photo_/.test(m.location().url || '')) errors.push(`console: ${m.text()}`); });
    await page.goto(url + '?dev=1&speed=8&opening=0&weather=clear&moments=0&board=dongshan,black,iced,longan');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(2200);
    const fav = () => page.evaluate(() => window.__cafe.fav);
    const choices = () => page.$$eval('#choices button', (b) => b.map((x) => x.textContent));
    const tapPerson = async (w) => { const p = await page.evaluate((w) => window.__cafe.personOnScreen(w), w); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(500); };
    check(!!(await page.evaluate(() => window.__cafe.favSetup('yuan', 1))), '予安走到第一段、人在店裡');
    check((await fav()).offerable.yuan, '予安可以收老闆請的那杯');
    await tapPerson('yuan');
    check(JSON.stringify(await choices()) === JSON.stringify(['請德叔端一杯給予安', '只是聊聊']), `點予安搭話：下方多一個「請德叔端一杯給予安」（${(await choices()).join('、')}）`);
    await page.screenshot({ path: OUT + 'phone-fav-offer.png' });
    await page.tap('#choices button >> text=只是聊聊');
    await page.waitForTimeout(300);
    check((await choices()).length === 0 && (await fav()).log.length === 0, '「只是聊聊」：照舊只搭話，沒有端');
    await page.waitForTimeout(400);
    await tapPerson('yuan');
    await page.tap('#choices button >> nth=0');
    await page.waitForTimeout(400);
    const drinks = await choices();
    check(JSON.stringify(drinks) === JSON.stringify(['東山的豆', '黑咖啡', '冰美式', '再想想']), `從黑板上喝的東西選（${drinks.join('、')}）`);
    check(/要端哪一杯給予安/.test(await page.textContent('#ask')), '選項上面問「要端哪一杯給予安？」');
    await page.screenshot({ path: OUT + 'phone-fav-drinks.png' });
    await page.tap('#choices button >> text=東山的豆');
    await page.waitForTimeout(300);
    check((await fav()).busy === 'yuan' && !(await page.isVisible('#place')), '端過去的時候：下面的按鈕收起來');
    await page.waitForFunction(() => window.__cafe.fav.log.length === 1, null, { timeout: 40000 });
    const miss = (await fav()).log[0];
    check(miss.right === false && miss.hint === '' && !(await fav()).photoOpen, `端錯：予安照喝、說一句溫和的話（${miss.line}），沒有照片、沒有提示`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: OUT + 'phone-fav-miss.png' });
    await page.waitForFunction(() => !window.__cafe.fav.busy, null, { timeout: 30000 });
    const f1 = await fav();
    check(f1.favorites.yuan.misses === 1 && f1.favorites.yuan.stage === 0 && !f1.offerable.yuan, '一天一杯：今天收過了就不再出現選項');
    await page.waitForTimeout(400);
    await tapPerson('yuan');
    check(!(await choices()).includes('請德叔端一杯給予安'), '再點予安：只搭話');
    // 同一段端錯第二次：德叔說一句更靠近的話
    await page.evaluate(() => window.__cafe.favSetup('yuan', 1, { misses: 1 }));
    const r2 = await page.evaluate(() => window.__cafe.favServe('yuan', 'iced'));
    check(r2 && !r2.right && /黑的/.test(r2.hint), `同一段端錯第二次：德叔「${r2?.hint}」`);
    // 端對：淡入照片（予安第一段已經是真圖，D204）
    await page.evaluate(() => window.__cafe.favSetup('yuan', 1));
    const right = page.evaluate(() => window.__cafe.favServe('yuan', 'black'));
    await page.waitForFunction(() => window.__cafe.fav.photoShow, null, { timeout: 40000 });
    const ph = await fav();
    await page.waitForFunction(() => window.__cafe.fav.real, null, { timeout: 6000 }).catch(() => {});
    check((await fav()).photoFile === 'photo_yuan_1' && (await fav()).real && !(await fav()).placeholder, '端對：畫面淡入予安第一段的照片（真圖，D204）');
    check(ph.placeholderText === '回憶等待觸發', '佔位圖上的字是「回憶等待觸發」（承峰 11/4，D198）');
    check(await page.evaluate(() => document.getElementById('app').classList.contains('modal')), '照片開著時，場景上的按鈕、泡泡收起來');
    await page.waitForTimeout(2200);
    await page.screenshot({ path: OUT + 'phone-fav-photo.png' });
    const rr = await right;
    check(rr?.right && rr.first && rr.photo === 'yuan-1' && !(await fav()).photoOpen, '照片幾秒後自己淡回店裡；第一張照片');
    check((await page.evaluate(() => window.__cafe.moments.lastSaid?.text)) === '這張，我收進記事本的相簿了。', '第一張照片：德叔說收進記事本的相簿');
    // 劇情演出中不出現這個選項
    await page.evaluate(() => window.__cafe.favSetup('zhe', 1, { alone: false }));
    check((await fav()).offerable.zhe, '阿哲第一段開放、人在店裡');
    await page.evaluate(() => window.__cafe.playScene('zhe2'));
    await page.waitForTimeout(300);
    check(!(await fav()).offerable.zhe && !(await fav()).offerable.yuan, '熟客劇情演出中：不能請德叔端一杯');
    await page.waitForFunction(() => !window.__cafe.scene, null, { timeout: 60000 });
    // 找到最愛：溫度 +0.5°C
    await page.evaluate(() => window.__cafe.favSetup('kevin', 3));
    const t0 = (await fav()).temp;
    const fr = await page.evaluate(() => window.__cafe.favServe('kevin', 'dongshan'));
    await page.waitForTimeout(2600);
    check(fr?.right && fr.favorite && (await fav()).temp === Math.round((t0 + 0.5) * 10) / 10, `凱文第三段「老闆的那杯」（老闆還沒喝過：東山的豆）：找到最愛，溫度 ${t0} → ${(await fav()).temp}°C`);
    check((await page.evaluate(() => window.__cafe.shownTemp)) >= t0 + 0.49, '右上角的溫度跟著升上去');
    // 相簿：見過的熟客一列三格，拿到的是照片，還沒拿到的是空格
    await page.evaluate(() => window.__cafe.album());
    await page.waitForTimeout(600);
    const al = (await fav()).album;
    check(al.open && al.slots === 9 && al.empty === 5, `相簿：三位熟客九格，拿到 4 張、空格 ${al.empty} 格`);
    check(await page.$$eval('.album-slot.empty', (els) => els.every((e) => !e.textContent.trim() && e.tagName !== 'BUTTON')), '空格不寫字、不能點');
    check(/^凱文：老闆的那杯（東山的豆）。$/.test(await page.textContent('.album-fav')), '三段都找到的那一頁：最後一句寫他的最愛');
    await page.waitForFunction(() => [...document.querySelectorAll('.album-slot:not(.empty) img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 6000 }).catch(() => {});
    const thumbs = await page.$$eval('.album-slot:not(.empty)', (els) => els.map((e) => [e.dataset.id, e.querySelector('img').src.slice(0, 5)]));
    check(thumbs.every(([id, src]) => (/^yuan-[12]$/.test(id) ? src === 'blob:' : src === 'data:')), `相簿縮圖：予安一二段是真圖，凱文還沒畫是佔位圖（${thumbs.map((t) => t.join(' ')).join('、')}）`);
    await page.screenshot({ path: OUT + 'phone-fav-album.png' });
    check((await smallTargets(page)).length === 0, `相簿的按鈕 ≥ 44px ${JSON.stringify(await smallTargets(page))}`);
    await page.tap('.album-slot:not(.empty) >> nth=0');
    await page.waitForTimeout(1800);
    check((await fav()).photoOpen && await page.isVisible('#photo-close'), '點縮圖看大圖（有「闔上」）');
    await page.tap('#photo-close');
    await page.waitForTimeout(1500);
    check(!(await fav()).photoOpen && (await fav()).album.open, '闔上大圖回到相簿');
    await page.tap('#sheet-close');
    await page.evaluate(() => { document.getElementById('menu-btn').click(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('open-notebook').click());
    await page.waitForTimeout(300);
    check(await page.isVisible('#nb-links button >> text=相簿'), '記事本有「相簿」');
    await page.tap('#nb-links button >> text=相簿');
    await page.waitForTimeout(400);
    check((await fav()).album.open, '從記事本打開相簿');
    await page.tap('#sheet-close');
    // 重新整理：照片、段落還在
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1800);
    const after = await fav();
    check(after.photos.length === 4 && after.favorites.kevin.stage === 3 && after.favorites.yuan.stage === 1, '重新整理：相簿與段落存在存檔裡');
    // 圖上不寫字，改由角色台詞說出來（承峰 11/4，D202）：予安第三段淡入時她說「煙是甜的。」；相簿重看顯示同一句；沒字的照片不說
    check(!!(await page.evaluate(() => window.__cafe.favSetup('yuan', 3))), '予安走到第三段（最愛）');
    const y3 = page.evaluate(() => window.__cafe.favServe('yuan', 'black'));
    await page.waitForFunction(() => window.__cafe.fav.photoShow, null, { timeout: 40000 });
    const sayT0 = Date.now();
    check((await fav()).photoFile === 'photo_yuan_3' && !(await fav()).placeholder, '端對：淡入予安第三段的照片（真圖，D204）');
    await page.waitForFunction(() => window.__cafe.fav.photoSay?.shown, null, { timeout: 6000 });
    const ps = (await fav()).photoSay, sayAt = Date.now() - sayT0;
    check(ps.who === 'yuan' && ps.name === '予安' && ps.text === '煙是甜的。', `照片淡入時予安說「${ps.text}」（${ps.name}）`);
    check(sayAt < 3500, `那一句在 7 秒的停留裡早早出現（淡入後約 ${sayAt} ms）`);
    check((await page.textContent('#photo-cap')).startsWith('阿公的窯熄了，煙還在這裡。'), '照片下方原本的說明不變');
    await page.screenshot({ path: OUT + 'phone-fav-photo-say.png' });
    const y3r = await y3;
    check(y3r?.right && y3r.favorite && (await fav()).photoSay === null, '照片淡回店裡：那一句跟著收起來');
    await page.evaluate(() => window.__cafe.album());
    await page.waitForTimeout(600);
    await page.tap('.album-row[data-who="yuan"] .album-slot >> nth=2');
    await page.waitForFunction(() => window.__cafe.fav.photoSay?.shown, null, { timeout: 6000 });
    const ap = await fav();
    check(ap.photoFile === 'photo_yuan_3' && ap.photoSay.text === '煙是甜的。' && ap.photoSay.name === '予安' && await page.isVisible('#photo-close'), '相簿重看予安第三段：顯示同一句、標明是予安說的');
    await page.screenshot({ path: OUT + 'phone-fav-album-say.png' });
    await page.tap('#photo-close');
    await page.waitForTimeout(1500);
    await page.tap('.album-row[data-who="yuan"] .album-slot >> nth=0');
    await page.waitForFunction(() => window.__cafe.fav.photoShow, null, { timeout: 6000 });
    await page.waitForTimeout(2600);
    check((await fav()).photoFile === 'photo_yuan_1' && (await fav()).photoSay === null && !(await page.isVisible('#photo-say')), '相簿重看予安第一段（原本沒字）：沒有這一句');
    await page.tap('#photo-close');
    await page.waitForTimeout(1500);
    await page.tap('#sheet-close');
    for (const [id, re] of [['zhe-3', /阿哲的豆/], ['kevin-2', null]]) {
      await page.evaluate((id) => { window.__cafe.photo(id); }, id);
      await page.waitForFunction(() => window.__cafe.fav.photoShow, null, { timeout: 6000 });
      await page.waitForTimeout(2600);
      const q = (await fav()).photoSay;
      check(re ? (await fav()).real : (await fav()).placeholder, re ? '阿哲第三段是真圖（D204）' : `${id} 還沒畫：仍是佔位圖「回憶等待觸發」`);
      check(re ? q?.shown && q.name === '阿哲' && re.test(q.text) : q === null, re ? `阿哲第三段淡入時阿哲說「${q?.text}」` : `${id}（原本沒字）淡入時不說`);
      await page.click('#photo');
      await page.waitForFunction(() => !window.__cafe.fav.photoOpen, null, { timeout: 6000 });
    }
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await ctx.close();
  }

  /* ---------- 吧台請凱文喝一杯（承峰 11/4：「坐吧台時可以請凱文喝一杯」，D199） ---------- */
  console.log('手機 390×844（吧台請凱文喝一杯）');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/\/assets\/art\/photo_/.test(m.location().url || '')) errors.push(`console: ${m.text()}`); });
    await page.goto(url + '?dev=1&speed=8&opening=0&weather=clear&moments=0&board=dongshan,black,iced,longan');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(2200);
    const fav = () => page.evaluate(() => window.__cafe.fav);
    const choices = () => page.$$eval('#choices button', (b) => b.map((x) => x.textContent));
    const tapKevin = async () => { const p = await page.evaluate(() => window.__cafe.personOnScreen('deshu')); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(500); };
    check(!!(await page.evaluate(() => window.__cafe.keeperSetup(1))), '開發者：直接到凱文顧店、凱文停在第一段、坐吧台座');
    await page.waitForTimeout(2000);
    check((await page.evaluate(() => window.__cafe.keeper)) && (await page.evaluate(() => window.__cafe.barName)) === '凱文' && (await page.evaluate(() => window.__cafe.mode)) === 'seat', '常態店、吧台後面是凱文、老闆坐著');
    check((await fav()).keeperOfferable, '坐吧台座：可以請凱文喝一杯');
    await tapKevin();
    check(JSON.stringify(await choices()) === JSON.stringify(['請凱文喝一杯', '只是聊聊']), `點凱文：下方多一個「請凱文喝一杯」（${(await choices()).join('、')}）`);
    await page.screenshot({ path: OUT + 'phone-keeper-offer.png' });
    await page.tap('#choices button >> text=只是聊聊');
    await page.waitForTimeout(300);
    check((await choices()).length === 0 && (await fav()).log.length === 0, '「只是聊聊」：照舊只搭話');
    await page.waitForTimeout(400);
    await tapKevin();
    await page.tap('#choices button >> text=請凱文喝一杯');
    await page.waitForTimeout(400);
    const drinks = await choices();
    check(JSON.stringify(drinks) === JSON.stringify(['東山的豆', '黑咖啡', '冰美式', '再想想']), `從黑板上喝的東西選（${drinks.join('、')}）`);
    check(/要請我喝哪一杯/.test(await page.textContent('#ask')), '選項上面凱文問「老闆要請我喝哪一杯？」');
    await page.screenshot({ path: OUT + 'phone-keeper-drinks.png' });
    await page.tap('#choices button >> text=東山的豆');
    // D214：凱文出吧台、回吧台走循路（不再是寫死的航點）：每 40ms 記一次他站的地方，不在吧台、桌子裡，也不穿過椅子、高腳椅（老闆坐的位子不另加碰撞物：那裡本來就有椅子）
    await page.evaluate(() => {
      const trail = window.__keeperTrail = { hard: new Set(), soft: new Set(), out: 0, back: 0, minZ: 9, maxZ: -9 };
      const tick = setInterval(() => {
        const f = window.__cafe.fav, n = window.__cafe.nav;
        if (!f.keeperPhase) { if (trail.back) clearInterval(tick); return; }
        if (f.keeperPhase === 'sit') return;
        const { x, z } = f.keeperPos, h = n.hardAt(x, z);
        if (h) trail.hard.add(h);
        for (const b of n.blockers) if (b.soft && b.id !== 'stoolMid' && b.r && Math.hypot(x - b.x, z - b.z) < b.r) trail.soft.add(b.id); // stoolMid 是他要坐的那張
        trail[f.keeperPhase === 'walkOut' ? 'out' : 'back']++;
        if (x < 1.6) { trail.minZ = Math.min(trail.minZ, z); trail.maxZ = Math.max(trail.maxZ, z); }
      }, 40);
    });
    await page.waitForTimeout(300);
    check((await fav()).busy === 'kevin' && !(await page.isVisible('#brew')), '凱文替自己沖的時候：下面的按鈕收起來');
    // 凱文出來坐旁邊喝（承峰 11/4：「出來坐旁邊喝」，D200）：端著杯子走出吧台 → 坐到老闆旁邊的高腳椅 → 說話 → 喝完回吧台
    await page.waitForFunction(() => window.__cafe.fav.keeperPhase === 'walkOut' && window.__cafe.fav.keeperPos.x < 1.6, null, { timeout: 40000 });
    const out = await fav();
    check(out.keeperCup && out.keeperPos.x < 1.6 && !out.keeperHome, `凱文端著杯子走出吧台（${out.keeperPos.x}, ${out.keeperPos.z}）`);
    await page.waitForFunction(() => window.__cafe.fav.keeperSeated, null, { timeout: 40000 });
    const side = await fav();
    check(Math.abs(side.keeperPos.x - 1.3) < 0.05 && Math.abs(side.keeperPos.z + 2.1) < 0.05 && side.sideStool && side.keeperCup && side.busy === 'kevin',
      `坐在老闆旁邊的高腳椅（${side.keeperPos.x}, ${side.keeperPos.z}），店裡那張高腳椅照樣擺著（D215），杯子在面前`);
    await page.waitForTimeout(900);
    const on = await page.evaluate(() => window.__cafe.personOnScreen('deshu'));
    check(on && on.x > 20 && on.x < 370 && on.y > 60 && on.y < 800, `鏡頭轉過去：坐在旁邊的凱文在畫面裡（${on && Math.round(on.x)}, ${on && Math.round(on.y)}）`);
    await page.waitForFunction(() => window.__cafe.fav.log.length === 1, null, { timeout: 40000 });
    const miss = (await fav()).log[0];
    check(miss.keeper && miss.right === false && miss.hint === '' && (await fav()).keeperSeated, `端錯：凱文坐在旁邊照喝（${miss.line}）`);
    await page.waitForFunction(() => !window.__cafe.fav.busy, null, { timeout: 30000 });
    check(!(await fav()).keeperOfferable, '一天一杯：今天請過了就不再出現');
    check((await fav()).keeperSeated && (await page.isVisible('#stand')), '說完以後：凱文還坐著喝，老闆可以站起來');
    await page.waitForFunction(() => window.__cafe.fav.keeperPhase === 'walkBack', null, { timeout: 30000 });
    check((await fav()).keeperCup && (await fav()).sideStool, '喝完：站起來端著空杯走回去，高腳椅一直擺著');
    await page.waitForFunction(() => window.__cafe.fav.keeperHome, null, { timeout: 30000 });
    check(!(await fav()).keeperCup && (await page.evaluate(() => window.__cafe.deshuHome)), '回到吧台裡他的位子，杯子收走');
    const trail = await page.evaluate(() => { const t = window.__keeperTrail; return { ...t, hard: [...t.hard], soft: [...t.soft] }; });
    check(trail.out > 5 && trail.back > 5 && trail.hard.length === 0 && trail.soft.length === 0, `凱文出吧台到高腳椅、回吧台：一路不在吧台、桌子裡，也不穿過椅子、高腳椅（循路，D214）${JSON.stringify(trail)}`);
    await page.waitForTimeout(400);
    await tapKevin();
    check(!(await choices()).includes('請凱文喝一杯'), '再點凱文：只搭話');
    // 坐在旁邊時老闆站起來：凱文收杯回吧台（D200）
    await page.evaluate(() => window.__cafe.keeperSetup(2));
    page.evaluate(() => window.__cafe.favServe('kevin', 'black'));
    await page.waitForFunction(() => window.__cafe.fav.keeperSeated && !window.__cafe.fav.busy, null, { timeout: 60000 });
    await page.tap('#stand');
    await page.waitForTimeout(300);
    check((await page.evaluate(() => window.__cafe.mode)) === 'overview' && (await fav()).keeperPhase === 'walkBack', '坐在旁邊時老闆站起來：凱文馬上收杯走回吧台');
    await page.waitForFunction(() => window.__cafe.fav.keeperHome, null, { timeout: 30000 });
    check((await fav()).sideStool && !(await fav()).keeperCup, '站起來之後：凱文回到吧台、高腳椅一直擺著');
    // 坐在旁邊時按「請凱文沖一杯」：先回吧台再沖（不衝突）
    await page.evaluate(() => window.__cafe.keeperSetup(2));
    page.evaluate(() => window.__cafe.favServe('kevin', 'black'));
    await page.waitForFunction(() => window.__cafe.fav.keeperSeated && !window.__cafe.fav.busy, null, { timeout: 60000 });
    await page.tap('#brew');
    await page.waitForSelector('#choices button');
    await page.tap('#choices button >> text=黑咖啡');
    await page.waitForFunction(() => window.__cafe.brewing && window.__cafe.phase === 'wait', null, { timeout: 5000 }).catch(() => {});
    const waitPhase = await page.evaluate(() => [window.__cafe.brewing, window.__cafe.phase, window.__cafe.fav.keeperPhase]);
    check(waitPhase[0] && waitPhase[1] === 'wait' && waitPhase[2] === 'walkBack', `坐在旁邊時請凱文沖一杯：他先走回吧台（${waitPhase.join('／')}）`);
    await page.waitForFunction(() => window.__cafe.phase === 'brew', null, { timeout: 30000 });
    check((await fav()).keeperHome, '回到吧台才開始沖');
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 60000 });
    // 凱文還坐在旁邊時重設（和換一天同一條路 stopStory()）：直接回到吧台
    await page.evaluate(() => window.__cafe.keeperSetup(3));
    await page.waitForFunction(() => window.__cafe.fav.keeperOfferable, null, { timeout: 30000 }); // 沖完那杯之後凱文還在「走回吧台」的狀態
    page.evaluate(() => window.__cafe.favServe('kevin', 'iced'));
    await page.waitForFunction(() => window.__cafe.fav.keeperSeated, null, { timeout: 60000 });
    await page.evaluate(() => window.__cafe.keeperSetup(2));
    await page.waitForTimeout(300);
    check((await fav()).keeperHome && (await fav()).sideStool && !(await fav()).keeperCup, '重設（keeperSetup 和換一天都走 stopStory）：凱文直接回到吧台');
    await page.waitForFunction(() => !window.__cafe.fav.busy, null, { timeout: 60000 });
    // 同一段端錯第二次：凱文自己說（轉述德叔）
    await page.evaluate(() => window.__cafe.keeperSetup(1, { misses: 1 }));
    const r2 = await page.evaluate(() => window.__cafe.favServe('kevin', 'black'));
    check(r2 && !r2.right && /冰塊最後才放/.test(r2.hint) && /德叔/.test(r2.hint), `同一段端錯第二次：凱文「${r2?.hint}」`);
    // 端對：淡入照片（佔位圖）
    await page.evaluate(() => window.__cafe.keeperSetup(1));
    const right = page.evaluate(() => window.__cafe.favServe('kevin', 'iced'));
    await page.waitForFunction(() => window.__cafe.fav.photoShow, null, { timeout: 40000 });
    const ph = await fav();
    check(ph.photoFile === 'photo_kevin_1' && ph.placeholder && ph.placeholderText === '回憶等待觸發', '端對：淡入凱文第一段的照片（佔位圖「回憶等待觸發」）');
    await page.waitForTimeout(2200);
    await page.screenshot({ path: OUT + 'phone-keeper-photo.png' });
    const rr = await right;
    check(rr?.right && rr.photo === 'kevin-1' && (await fav()).favorites.kevin.stage === 1, '凱文第一段找到了，收進相簿');
    // 最愛（第三段，老闆最近一次喝的那杯）：溫度 +0.5°C
    await page.evaluate(() => window.__cafe.keeperSetup(3));
    const t0 = (await fav()).temp;
    // 前面「坐在旁邊時請凱文沖一杯」老闆喝了黑咖啡：第三段的答案是老闆最近一次喝的那杯（stats.lastBean）
    const fr = await page.evaluate(() => window.__cafe.favServe('kevin', window.__cafe.fav.lastBean || 'dongshan'));
    await page.waitForTimeout(2600);
    check(fr?.right && fr.favorite && (await fav()).temp === Math.min(37, Math.round((t0 + 0.5) * 10) / 10), `凱文顧店後找到最愛：溫度 ${t0} → ${(await fav()).temp}°C`);
    // 只有吧台座：站起來（俯瞰）、坐窗邊座都不出現
    await page.evaluate(() => window.__cafe.keeperSetup(2));
    check((await fav()).keeperOfferable, '第二段開放、坐吧台座');
    await page.tap('#stand');
    await page.waitForTimeout(1600);
    check(!(await fav()).keeperOfferable && !(await fav()).keeperCup, '站起來：不出現，吧台上凱文的杯子收走');
    await tapKevin();
    check(!(await choices()).includes('請凱文喝一杯'), '俯瞰時點凱文：照舊只搭話');
    await page.waitForTimeout(3600);
    await page.tap('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1600);
    check((await page.evaluate(() => window.__cafe.mode)) === 'seat' && !(await fav()).keeperOfferable, '坐窗邊座：不出現');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await ctx.close();
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
    // 美術評分修正 f（Q64）：龍眼在店裡固定睡在窗台上
    check(await cafe('catOnSill') && Math.abs((await cafe('catPos')).y - 1.1) < 0.01, `一進店龍眼就睡在窗台上 ${JSON.stringify(await cafe('catPos'))}`);
    // 坐一會兒再站起來：椅子還熱著，龍眼跳上去（任務 #7）
    // 美術評分修正 d：記下泡泡說過的每一句（德叔那句話可能很快被下一句蓋掉；逾時時印出來看是哪一句）
    await page.evaluate(() => { window.__said = []; new MutationObserver(() => window.__said.push(document.getElementById('bubble').textContent)).observe(document.getElementById('bubble'), { childList: true, subtree: true, characterData: true }); });
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1200);
    await page.click('#stand');
    await page.waitForFunction(() => window.__cafe.catOnSeat === 'window', null, { timeout: 15000 });
    await page.waitForFunction(() => window.__cafe.tasks.includes('cat-chair'), null, { timeout: 5000 });
    check(Math.abs((await cafe('catPos')).y - 0.42) < 0.01, '龍眼跳上老闆剛坐過的椅子，任務 #7 完成');
    const catLine = await page.waitForFunction(() => window.__said.some((t) => t.includes('龍眼最會挑位子')), null, { timeout: 8000 }).then(() => true, () => false);
    check(catLine, `德叔一句話帶出（不跳任務清單）${catLine ? '' : JSON.stringify(await page.evaluate(() => ({ said: window.__said, bubble: document.getElementById('bubble').textContent, w: window.__cafe.waitInfo })))}`);
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
    // 擺一個貓咪軟墊：龍眼還是回窗台睡（Q64）
    await page.click('#menu-btn');
    await page.click('#dev-fund');
    await page.click('#about-close');
    await page.click('#place');
    await page.click('#p-catalog');
    await page.click('.sheet-row:has-text("貓咪軟墊") button');
    await page.click('#p-done');
    check((await cafe('placed')).includes('cat-cushion'), '擺了貓咪軟墊');
    await page.waitForFunction(() => window.__cafe.catOnSill, null, { timeout: 20000 });
    check(true, '走開一陣子之後、擺了軟墊之後，龍眼回到窗台上睡');
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
    await closeShop(page);
    check(await page.isHidden('#close-shop') && await page.isHidden('#place'), '按下打烊、選「打烊」：按鈕先收起來');
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
    check(await page.evaluate(() => Number(getComputedStyle(document.getElementById('dy-count')).opacity) === 1), '字數（例如 11／40）不再是半透明的淡字');
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
    await closeShop(page);
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
          if (await page.isVisible('#close-shop')) { await closeShop(page); continue; }
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
    { const p = await modalProblems(page, '#map'); check(p.length === 0, `咖啡地圖：卡片不透明、背景收起來 ${p.join('；')}`); }
    {
      const rows = await page.$$eval('#map-list li', (ls) => ls.map((l) => Math.round(l.getBoundingClientRect().height)));
      check(rows.length === 2 && rows.every((h) => h < 34), `咖啡地圖：清單每一列都是一行（${rows}）`);
    }
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

  /* ---------- 接正式美術：角色與龍眼的手繪圖（assets/art/），以及載入失敗時退回 Canvas 繪圖 ---------- */
  console.log('\n正式美術：角色與龍眼');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    const got = new Map();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('response', (r) => { const m = r.url().match(/assets\/art\/([^/?]+)\.webp/); if (m) got.set(m[1], r.status()); });
    await page.goto(url + '?dev=1&speed=20&opening=0&regulars=0&weather=clear');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1500);
    const art = await page.evaluate(() => window.__cafe.art);
    // art2b：第二批的開場、地圖與介面再加 7 張 webp（信封、辭呈與律師信背景、信箱、縣道、地圖、信紙、泡泡外框）＋ CSS 的啟動畫面
    check(got.size === 74 && [...got.values()].every((s) => s === 200) && got.has('splash_1170x2532'), `從 assets/art 載入 74 張 webp（第一批 18＋凱文坐高腳椅 1、第二批店內 46＋平常杯子 1、開場與介面 7、啟動畫面 1；${got.size} 張）`);
    check(art.loaded.length === 73 && art.loaded.every((n) => got.has(n)), `73 張都解碼成功（${art.loaded.length} 張；啟動畫面由 CSS 直接用）`);
    const tags = await page.evaluate(() => window.__cafe.uiArtTags());
    check(tags.map === 'svg' && tags.road === 'svg' && tags.mail === 'IMG', `地圖與縣道是手繪圖＋程式畫的標記（SVG）、信箱是手繪圖 ${JSON.stringify(tags)}`);
    check(art.ui.length === 6 && art.icons && art.envelope === 'envelope', `開場、地圖與介面的圖、介面圖示、信封都載到了 ${JSON.stringify(art.ui)} 圖示 ${art.icons}`);
    const ui = await page.evaluate(() => ({
      vars: ['--art-office', '--art-paper', '--art-bubble'].map((v) => getComputedStyle(document.documentElement).getPropertyValue(v).startsWith('url(')),
      bubble: getComputedStyle(document.getElementById('bubble')).borderImageSource.startsWith('url('),
      icons: ['#menu-btn', '#speed', '#temp'].map((s) => !!document.querySelector(`${s} svg.icon use`)),
      temp: document.getElementById('temp').textContent, splash: !document.getElementById('splash'),
      manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
    }));
    check(ui.vars.every(Boolean) && ui.bubble && ui.icons.every(Boolean) && ui.temp === '20.0°C' && ui.splash,
      `介面用上手繪圖：信紙、泡泡外框、辭呈背景的 CSS 變數，選單／快轉／溫度的圖示，啟動畫面已收起 ${JSON.stringify(ui)}`);
    const mf = await page.evaluate(async (h) => { const r = await fetch(h); const j = await r.json(); const icons = await Promise.all(j.icons.map(async (i) => (await fetch(i.src)).status)); return { name: j.short_name, icons }; }, ui.manifest);
    check(mf.icons.length === 3 && mf.icons.every((st) => st === 200), `manifest 的圖示都在（${JSON.stringify(mf)}）`);
    // 接正式美術第二批：座位的椅子、高腳椅、沙發、吧台後的層架、溫度計、吊燈都是手繪圖；窗景與地板是原圖大小（桌機 2048）
    check(art.props.window === 'chair' && art.props.bar === 'stool' && art.props.sofa === 'sofa' && art.backBar === 'backbar' && art.thermo === 'thermometer_frame' && art.hanging === 2,
      `店內的家具、層架、溫度計、吊燈來自 assets/art ${JSON.stringify(art.props)} ${art.backBar} ${art.thermo} 吊燈 ${art.hanging}`);
    check(art.windowW >= 1024 && art.floorW >= 1024, `窗景與地板是手繪材質（寬 ${art.windowW}、${art.floorW} 像素）`);
    check(art.now.deshu === 'char_deshu_stand' && art.now.cat === 'cat_longan_sleep', `德叔與龍眼的材質來自 assets/art（${art.now.deshu}、${art.now.cat}）`);
    check(['yuan', 'zhe', 'kevin', 'grandpa'].every((w) => art.now[w]?.startsWith(`char_${w}_`)), `熟客與阿公的材質來自 assets/art ${JSON.stringify(art.now)}`);
    const info = await page.evaluate(() => window.__cafe.artInfo);
    check(info.ppm >= 400 && info.mip && info.trilinear && info.srgb, `手繪圖的材質：每公尺 ${Math.round(info.ppm)} 像素、mipmap、三線性過濾、sRGB`);
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    // 攔截 assets/art 的請求讓它失敗（像離線或檔案不見了）：退回 Canvas 繪圖，照樣坐下、沖一杯、溫度上升、沒有 JS 錯誤
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    let blocked = 0;
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    // 被攔下來的請求，瀏覽器會記一筆「Failed to load resource」：那是網路層的訊息，不是 JS 錯誤
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
    // 德叔的圖回一個壞掉的檔案（解碼錯誤）、阿哲的回 404，其他的直接斷線
    await page.route('**/assets/art/**', (r) => {
      blocked++;
      if (/deshu|backbar/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/webp', body: 'not a webp' });
      if (/zhe|sofa/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
      return r.abort('failed');
    });
    await page.goto(url + '?dev=1&speed=20&opening=0&regulars=0&weather=clear');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1800);
    const art = await page.evaluate(() => window.__cafe.art);
    check(blocked >= 64 && art.loaded.length === 0 && Object.values(art.now).every((v) => v === null) && art.yuanChair, `assets/art 全部失敗（斷線、404、解碼錯誤，攔下 ${blocked} 個請求）：人物退回 Canvas 繪圖，予安那張椅子照樣擺著（D215）`);
    check(Object.values(art.props).every((v) => v === null) && !art.backBar && !art.thermo && art.hanging === 0 && art.windowW <= 400 && art.floorW === 512,
      `店內的家具、層架、溫度計、吊燈、窗景與地板也退回 Canvas 繪圖 ${JSON.stringify(art.props)} 窗 ${art.windowW} 地板 ${art.floorW}`);
    // art2b：開場、地圖與介面的圖、圖示全部沒有：CSS 變數不設（原本的漸層與 2px 墨色框）、按鈕照舊是文字、信封是 Canvas、地圖是 Canvas
    const ui = await page.evaluate(() => ({
      vars: ['--art-office', '--art-paper', '--art-bubble'].map((v) => getComputedStyle(document.documentElement).getPropertyValue(v)).join(''),
      border: getComputedStyle(document.getElementById('bubble')).borderImageSource, menu: document.getElementById('menu-btn').textContent,
      icons: document.querySelectorAll('svg.icon').length, temp: document.getElementById('temp').textContent,
      tags: window.__cafe.uiArtTags(),
    }));
    check(art.ui.length === 0 && !art.icons && art.envelope === null && ui.vars === '' && ui.border === 'none' && ui.menu === '≡' && ui.icons === 0 && ui.temp === '20.0°C'
      && ui.tags.map === 'CANVAS' && ui.tags.road === 'CANVAS' && ui.tags.mail === 'CANVAS',
      `開場、地圖與介面的圖也全部失敗：介面退回原本的 CSS、選單是「≡」、信封是 Canvas ${JSON.stringify(ui)}`);
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1600);
    check(await page.evaluate(() => window.__cafe.mode === 'seat'), '沒有手繪圖也能坐下');
    await page.click('#brew');
    await page.waitForFunction(() => window.__cafe.brewing, null, { timeout: 5000 });
    check(await page.evaluate(() => window.__cafe.brewKit), '沒有沖煮圖時，吧台上照舊是立體的沖煮器具');
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 20000 });
    check(await page.evaluate(() => window.__cafe.tasks.includes('first-coffee') && window.__cafe.temp === 20.5), '沒有手繪圖也能沖一杯（杯子上桌、溫度 +0.5）');
    await page.screenshot({ path: OUT + 'phone-art-fallback.png' });
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    // art2b：颱風夜（評分不通過）：從窗邊座看，德叔端咖啡給吧台前的阿哲之後，兩人畫出來的範圍不能重疊（原本疊成一個雙頭人）
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(url + '?dev=1&speed=8&opening=0&regulars=0&weather=clear');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1200);
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__cafe.playScene('zhe3'));
    await page.waitForFunction(() => document.getElementById('bubble').textContent.includes('四十年') && window.__cafe.camStill, null, { timeout: 60000, polling: 'raf' });
    const [z, d] = await page.evaluate(() => [window.__cafe.spanOnScreen('zhe'), window.__cafe.spanOnScreen('deshu')]);
    check(z && d && (d[0] >= z[1] || d[1] <= z[0]), `颱風夜：阿哲與德叔在畫面上沒有重疊（阿哲 ${z}、德叔 ${d}）`);
    await page.screenshot({ path: OUT + 'phone-typhoon-apart.png' });
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    // art2b：assets/art 全部失敗時的開場（新存檔）：辭呈、信箱、律師信、縣道都退回原本的 Canvas 與 CSS，照樣走到推門進店
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
    await page.route('**/assets/art/**', (r) => (/office|county|paper/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/webp', body: 'not a webp' }) : r.abort('failed')));
    await page.goto(url + '?dev=1&speed=20');
    await page.waitForSelector('.op-office.on');
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.op-office')).backgroundImage);
    check(!bg.includes('url(') && bg.includes('linear-gradient'), `沒有手繪圖：辭呈的背景是原本的漸層（${bg.slice(0, 60)}）`);
    await page.click('#op-skip'); await page.waitForSelector('.op-title.on');
    await page.click('#op-next'); await page.waitForSelector('.op-mailbox.on');
    check(await page.isVisible('#op-env canvas'), '沒有手繪圖：信箱是 Canvas 畫的');
    await page.click('#op-env'); await page.waitForSelector('.op-lawyer');
    await page.click('.op-mailbox #op-next'); await page.waitForSelector('.op-road.on');
    check(await page.isVisible('.op-road canvas.op-road-art'), '沒有手繪圖：縣道是 Canvas 畫的');
    await page.click('.op-road #op-next');
    await page.waitForFunction(() => window.__cafe.openingStage === 'shop', null, { timeout: 5000 });
    check(errors.length === 0, `沒有手繪圖也能走完開場、沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }

  /* ---------- 誤按打烊（D205）：德叔先問一次＋連點保護 ---------- */
  console.log('手機 390×844 觸控（誤按打烊：先問一次、再坐一會兒、換列後 0.5 秒內連點不打烊）');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(url + '?dev=1&speed=20&opening=0&regulars=0&weather=clear');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1800);
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    const center = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    await page.waitForTimeout(600);
    await page.tap('#close-shop');
    await page.waitForSelector('#choices button');
    const opts = await page.$$eval('#choices button', (bs) => bs.map((b) => ({ t: b.textContent, y: b.getBoundingClientRect().top })));
    check(opts.length === 2 && opts[0].t === '打烊' && opts[1].t === '再坐一會兒' && opts[1].y > opts[0].y, `按「打烊」先出確認，「再坐一會兒」在最下面（${opts.map((o) => o.t).join('／')}）`);
    check((await page.textContent('#ask')).includes('今天先收了'), '德叔問「今天先收了？」');
    check(!(await cafe('closing')), '還沒打烊');
    check((await smallTargets(page)).length === 0, '確認的選項 ≥ 44px');
    await page.tap('#choices button >> nth=1');
    await page.waitForTimeout(500);
    check(!(await cafe('closing')) && await page.isVisible('#close-shop'), '選「再坐一會兒」：不打烊，按鈕列回來');
    // 連點：佈置按「確定」的同一點，下一刻就是「打烊」
    for (const gap of [80, 150, 300]) {
      await page.waitForTimeout(600);
      await page.tap('#place');
      await page.waitForSelector('#p-done:visible');
      await page.waitForTimeout(600);
      const p = await center('#p-done');
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(gap);
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, p);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(300);
      check(hit === 'close-shop' && !(await cafe('choosing')) && !(await cafe('closing')), `連點「確定」兩下（間隔 ${gap} 毫秒，第二下落在「${hit}」上）：不打烊、也不問`);
    }
    // 坐著按「站起來」之後，右邊那顆變成「打烊」
    await page.tap('.seat-label >> text=窗邊座');
    await page.waitForFunction(() => window.__cafe.mode === 'seat', null, { timeout: 8000 });
    await page.waitForTimeout(600);
    // 軟體繪圖的模擬器一幀可能要好幾百毫秒，兩下之間的時間在頁面裡量：按「站起來」之後馬上點同一列最右邊那顆
    const age = await page.evaluate(() => {
      document.getElementById('stand').click();
      const a = window.__cafe.tasting.rowAge;
      document.getElementById('close-shop').click();
      return a;
    });
    await page.waitForTimeout(300);
    check(age < 500 && !(await cafe('choosing')) && !(await cafe('closing')), `站起來後 ${age} 毫秒點「打烊」：不打烊`);
    const q = await center('#close-shop');
    // 0.5 秒之後照常可以打烊（先問一次）
    await page.waitForTimeout(600);
    await page.touchscreen.tap(q.x, q.y);
    await page.waitForSelector('#choices button');
    await page.screenshot({ path: OUT + 'phone-close-confirm.png' });
    // 確認出現時，連點的第二下落在最下面那個選項（再坐一會兒）上，不會打烊
    const last = await center('#choices button >> nth=1');
    await page.touchscreen.tap(last.x, last.y);
    await page.waitForTimeout(400);
    check(!(await cafe('closing')), '確認時點最下面那一格：不打烊');
    check(await closeShop(page), '選「打烊」才打烊');
    await page.waitForFunction(() => window.__cafe.closing === 'lastcup', null, { timeout: 20000 });
    check(true, '選「打烊」：客人離開、等最後一杯');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await ctx.close();
  }

  /* ---------- 試咖啡 v2：參數微調 → 登錄 → 定案寫 brewProfile；只在吧台座；黑板不寫參數 ---------- */
  console.log('手機 390×844 觸控（試咖啡 v2：微調、登錄、定案、吧台限定、舊存檔）');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(url + '?dev=1&speed=20&opening=0&regulars=0&weather=clear');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1800);
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    const said = (text, timeout = 20000) => page.waitForFunction((x) => window.__cafe.moments.lastSaid?.text?.includes(x), text, { timeout });
    check((await cafe('tasting')).open.length === 0, '劇情還沒到：沒有配方');
    check((await page.evaluate(() => window.__cafe.tastingSetup('kiln'))).includes('kiln'), '予安第三幕之後：龍眼窯特調開放');
    const bean0 = (await cafe('fav')).lastBean;

    // 窗邊座不能試
    await page.tap('.seat-label >> text=窗邊座');
    await page.waitForFunction(() => window.__cafe.mode === 'seat', null, { timeout: 8000 });
    await page.waitForTimeout(800);
    for (let i = 0; i < 8; i++) {
      if (await page.isVisible('#read-letter')) await page.tap('#read-letter');
      else if (await page.isVisible('#lt-close')) await page.tap('#lt-close');
      else if (await page.isVisible('#journal')) await page.click('#jr-close');
      else break;
      await page.waitForTimeout(300);
    }
    check(!(await cafe('tasting')).offerable, '窗邊座：不可試咖啡');
    await page.tap('#stand');
    await page.waitForFunction(() => window.__cafe.mode === 'overview', null, { timeout: 8000 });

    await page.tap('.seat-label >> text=吧台座');
    await page.waitForFunction(() => window.__cafe.mode === 'seat' && window.__cafe.seat === 'bar', null, { timeout: 8000 });
    const offered = () => page.evaluate(() => [...document.querySelectorAll('#choices button')].some((b) => b.textContent === '一起調'));
    for (let i = 0; i < 300 && !(await offered()); i++) {
      if (await page.isVisible('#read-letter')) await page.tap('#read-letter');
      else if (await page.isVisible('#lt-close')) await page.tap('#lt-close');
      else if (await page.isVisible('#journal')) await page.click('#jr-close');
      await page.waitForTimeout(300);
    }
    const opts = await page.$$eval('#choices button', (bs) => bs.map((b) => b.textContent));
    check(opts.join('／') === '一起調／下次再調', `德叔問一起調，「下次再調」在最下面（${opts.join('／')}）`);
    await page.tap('#choices button >> nth=0');
    await page.waitForSelector('#tune:not([hidden])', { timeout: 8000 });
    check((await page.textContent('#tune-title')).includes('怎麼沖'), '打開微調面板');
    await page.screenshot({ path: OUT + 'phone-tasting-tune.png' });
    // 調一檔粉水比再沖
    await page.locator('#tune-list .tune-row').first().locator('button').nth(1).click(); // ＋
    await page.tap('#tune-brew');
    await page.waitForFunction(() => window.__cafe.brewing, null, { timeout: 8000 });
    await page.waitForFunction(() => window.__cafe.phase === 'serve', null, { timeout: 30000 });
    await page.screenshot({ path: OUT + 'phone-tasting-brew.png' });
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 30000 });
    // 沖完：登錄選項（等 choosing，避免 hidden 競態）
    await page.waitForFunction(() => window.__cafe.choosing && [...document.querySelectorAll('#choices button')].some((b) => /登錄/.test(b.textContent)), null, { timeout: 25000 });
    await page.waitForTimeout(200);
    const logOpts = await page.$$eval('#choices button', (bs) => bs.map((b) => b.textContent));
    check(logOpts[0].includes('登錄到') && logOpts.includes('再調一版') && logOpts[logOpts.length - 1].includes('先不登錄'), `登錄與定案拆兩步（${logOpts.join('／')}）`);
    await page.tap('#choices button >> nth=0');
    await page.waitForTimeout(700);
    await page.screenshot({ path: OUT + 'phone-tasting.png' });
    let t = await cafe('tasting');
    const rec = t.records[0];
    check(t.records.length === 1 && rec.item === 'kiln' && rec.params && !rec.settled, '登錄後一張測試紀錄（還沒定案）');
    check(!!rec.params.ratio && !!rec.params.grind && !!rec.params.technique, '紀錄帶四項參數');
    check((await cafe('fav')).lastBean === bean0, '試調那杯不算 lastBean');
    check(!(await cafe('menu')).book.includes('kiln'), '還沒定案：不在菜單本');
    await said('測試紀錄');
    check(true, '德叔說記在測試紀錄了');
    await page.tap('#menu-btn');
    await page.tap('#open-notebook');
    await page.waitForSelector('.nb-record');
    await page.locator('.nb-record').first().scrollIntoViewIfNeeded();
    const card = await page.$eval('.nb-record', (el) => el.innerText);
    check(card.includes('龍眼窯特調') && card.includes('粉水') && card.includes('研磨') && card.includes('技法') && card.includes('酸'),
      '紀錄有品項、參數、酸甜苦');
    check((await smallTargets(page)).length === 0, '喜歡／定為沖法 ≥ 44px');
    await page.tap('.nb-record .rec-like');
    check((await cafe('tasting')).records[0].liked, '按「喜歡」');
    await page.screenshot({ path: OUT + 'phone-records.png' });
    await page.tap('#nb-close');
    const boardBefore = (await cafe('menu')).board;
    await page.evaluate(() => window.__cafe.jumpDays(1));
    await page.waitForTimeout(800);
    for (let i = 0; i < 6 && await page.isVisible('#journal'); i++) { await page.click('#jr-close'); await page.waitForTimeout(400); }
    check(JSON.stringify((await cafe('menu')).board) === JSON.stringify(boardBefore), '隔天黑板沿用昨天');
    await said('還在記事本', 40000);
    await page.screenshot({ path: OUT + 'phone-deshu-hint.png' });
    await page.waitForTimeout(8000);
    const hints = (await cafe('moments')).log.filter((x) => x.kind === 'record').length;
    t = await cafe('tasting');
    check(hints === 1 && t.records[0].told && !t.hint, `德叔提一次（${hints}）`);
    await page.tap('#menu-btn');
    await page.tap('#open-notebook');
    await page.waitForSelector('.nb-record .rec-settle');
    await page.locator('.nb-record .rec-settle').first().scrollIntoViewIfNeeded();
    await page.tap('.nb-record .rec-settle');
    await page.waitForTimeout(600);
    const m = await cafe('menu');
    t = await cafe('tasting');
    check(m.book.includes('kiln') && m.board.includes('kiln') && m.lines.includes('龍眼窯特調') && t.records[0].settled > 0, '定案：菜單本＋黑板＋brewProfile');
    check(!!(await page.evaluate(() => window.__cafe.menu)).book, '菜單本有品項');
    const profile = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('dream-cafe.save'));
      return raw.menu.items.kiln?.brewProfile || null;
    });
    check(!!profile?.ratio && !!profile?.grind, `brewProfile 已寫入（${JSON.stringify(profile)}）`);
    // 黑板字只有品名、不含參數
    check(!m.lines.some((l) => /1:|°C|粉水|研磨/.test(l)), `黑板不暗示參數（${m.lines.join('／')}）`);
    check(await page.isHidden('#notebook'), '定案後記事本闔上');
    await said('寫上黑板了', 8000);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: OUT + 'phone-board-final.png' });
    await page.waitForFunction(() => !window.__cafe.brewing && !document.getElementById('brew').disabled && !document.getElementById('brew').hidden, null, { timeout: 30000 });
    await page.tap('#brew');
    await page.waitForSelector('#choices button');
    const brewOpts = await page.$$eval('#choices button', (bs) => bs.map((b) => b.textContent));
    check(brewOpts.includes('龍眼窯特調'), `請德叔沖一杯有龍眼窯（${brewOpts.join('／')}）`);
    await page.tap('#choices button >> nth=0');
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 40000 });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('to-v8')) return;
      sessionStorage.setItem('to-v8', '1');
      const raw = JSON.parse(localStorage.getItem('dream-cafe.save'));
      raw.version = 8; delete raw.tasting;
      localStorage.setItem('dream-cafe.save', JSON.stringify(raw));
    });
    const boardOld = (await cafe('menu')).board;
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1800);
    for (let i = 0; i < 6 && await page.isVisible('#journal'); i++) { await page.click('#jr-close'); await page.waitForTimeout(400); }
    t = await cafe('tasting');
    const v = await page.evaluate(() => sessionStorage.getItem('to-v8'));
    check(v && t.records.length === 0 && JSON.stringify((await cafe('menu')).board) === JSON.stringify(boardOld), `第 8 版遷移：紀錄空、黑板照舊`);
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await ctx.close();
  }
  {
    // 碰撞與循路（承峰 11/6）：桌子、吧台、椅子、擺飾都是碰撞物，走路自動循路，不穿過去
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=6&opening=0&regulars=0&weather=clear&moments=0');
    const nav = await page.evaluate(() => { const n = window.__cafe.nav; return { ids: n.blockers.map((b) => b.id), spots: n.spots }; });
    for (const id of ['counter', 'backBase', 'tableWindow', 'tableSofa', 'tableYuan', 'chairWindow', 'sofa', 'stoolBar', 'stoolMid', 'stoolFar']) check(nav.ids.includes(id), `碰撞物有 ${id}`);
    // 中島吧台（D213）：檯面最裡端到後牆的空隙沒有封起來；吧台裡最裡面走到凱文那張高腳椅走這個空隙，不穿檯面
    check(!nav.ids.includes('barBackEnd'), '吧台最裡端沒有封起來');
    const gap = await page.evaluate(() => { const n = window.__cafe.nav, from = { x: 2.6, z: -3.0 }, r = n.path(from, { x: 1.3, z: -3.4 }); const all = [from, ...r.pts]; const hits = []; for (let i = 1; i < all.length; i++) { const h = n.hits(all[i - 1], all[i]); if (h) hits.push(h); } return { ok: r.ok, hits, minZ: Math.min(...r.pts.map((p) => p.z)), maxZ: Math.max(...r.pts.map((p) => p.z)) }; });
    check(gap.ok && gap.hits.length === 0 && gap.minZ < -3.25 && gap.maxZ < 0.25, `吧台最裡端的空隙走得過去、不穿檯面 ${JSON.stringify(gap)}`);
    // 從倉庫擺出盆栽：擺飾也是碰撞物，移過去碰撞物跟著移
    const plantAt = () => page.evaluate(() => window.__cafe.nav.blockers.find((b) => b.id === 'decor:plant') || null);
    await page.click('#place');
    await page.click('#p-store');
    await page.click('.sheet-row:has-text("盆栽") button');
    const p0 = await plantAt();
    check(!!p0, `擺出來的盆栽是碰撞物 ${JSON.stringify(p0)}`);
    const box = await page.locator('#app canvas').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
    const p1 = await plantAt();
    check(p0 && p1 && Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.2, `移動盆栽，碰撞物跟著移 ${JSON.stringify(p1)}`);
    await page.click('#p-done');
    await page.waitForTimeout(600);
    const bad = await page.evaluate(() => {
      const n = window.__cafe.nav, out = [];
      const names = Object.keys(n.spots);
      for (const a of names) for (const b of names) {
        if (a === b) continue;
        const from = n.spots[a], to = n.spots[b];
        const r = n.path(from, to);
        const all = [from, ...r.pts];
        for (let i = 1; i < all.length; i++) { const hit = n.hits(all[i - 1], all[i]); if (hit) out.push(`${a}→${b} 穿過 ${hit}`); }
        if (!r.ok) out.push(`${a}→${b} 走不到（${r.reason}）`);
      }
      return out;
    });
    check(bad.length === 0, `各位子之間的路都不穿過桌子、吧台 ${bad.slice(0, 6).join(' | ')}`);
    // 椅子一律保留拉開的狀態（承峰 11/6，D215）：坐下、站起來，椅子都不收、不動，碰撞物也一樣
    const chairs0 = await page.evaluate(() => window.__cafe.chairs), blk0 = JSON.stringify((await page.evaluate(() => window.__cafe.nav)).blockers);
    check(Object.values(chairs0).every((c) => c.visible), `店裡每一張椅子都擺著 ${JSON.stringify(chairs0)}`);
    for (const [label, id] of [['吧台座', 'bar'], ['角落沙發', 'sofa']]) {
      await page.click(`.seat-label >> text=${label}`);
      await page.waitForTimeout(1600);
      const c = await page.evaluate(() => window.__cafe.chairs);
      check((await page.evaluate(() => window.__cafe.camInfo)).seat === id && JSON.stringify(c) === JSON.stringify(chairs0), `坐${label}：坐的那張和其他椅子都照樣擺著、位置不變`);
      check(JSON.stringify((await page.evaluate(() => window.__cafe.nav)).blockers) === blk0, `坐${label}：碰撞物不變`);
      await page.click('#stand');
      await page.waitForTimeout(1400);
      check(JSON.stringify(await page.evaluate(() => window.__cafe.chairs)) === JSON.stringify(chairs0), `從${label}站起來：椅子還是擺著`);
    }
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1600);
    check((await page.evaluate(() => window.__cafe.chairs)).window.visible, '坐窗邊座：那張椅子照樣擺著');
    await page.click('#brew');
    // 德叔端杯走過去再走回吧台：每 40ms 量一次他站的地方
    const inside = await page.evaluate(async () => {
      const n = window.__cafe.nav, hits = new Set();
      let far = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < 30000) {
        const d = n.deshu, h = n.hardAt(d.x, d.z);
        if (h) hits.add(h);
        far = Math.max(far, Math.hypot(d.x - 2.6, d.z + 1.6));
        if (far > 1 && !window.__cafe.brewing && Math.hypot(d.x - 2.6, d.z + 1.6) < 0.05) break;
        await new Promise((r) => setTimeout(r, 40));
      }
      return { hits: [...hits], far: +far.toFixed(2) };
    });
    check(inside.far > 2 && inside.hits.length === 0, `德叔端杯到窗邊座再回吧台，一路不在桌子或吧台裡 ${JSON.stringify(inside)}`);
    const last = await page.evaluate(() => window.__cafe.nav.last);
    check(last && last.ok, `最後一條路走得到 ${JSON.stringify(last?.reason)}`);
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    // 選項 B（承峰 11/6：「B，另外寫死的走法也應該處理」，D214）：後牆 (2.2, −3.6) 的擺飾位保留；擺了櫃子，吧台最裡端的空隙被擋住，
    // 吧台裡外的路（凱文出吧台到老闆旁邊的高腳椅、回吧台）循路改走店門口那一端，不穿檯面、不穿櫃子、不穿椅子；老闆坐吧台座也一樣（老闆坐的位子不另加碰撞物，D214 修正）
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript((day) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const t = Date.now();
      localStorage.setItem('dream-cafe.save', JSON.stringify({ version: 1, createdAt: t - day, lastSeen: t - 1000,
        tasks: [{ id: 'first-coffee', t: t - day, day: 1 }], fund: { ledger: [] },
        owned: [{ uid: 1, item: 'cabinet', placed: true, x: 2.2, z: -3.6 }], nextUid: 2, seatsSat: ['window'], stats: { cups: 1, rainyWindowCups: 0 }, flags: { starterGiven: true } }));
    }, 864e5);
    await page.goto(url + '?dev=1&speed=6&opening=0&regulars=0&weather=clear&moments=0');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1500);
    for (let i = 0; i < 4 && await page.isVisible('#journal'); i++) { await page.click('#jr-close'); await page.waitForTimeout(400); }
    const route = () => page.evaluate(() => {
      const n = window.__cafe.nav, k = n.keeper(), home = n.spots.home, hits = [];
      const cab = n.blockers.find((b) => b.id === 'decor:cabinet');
      const soft = n.blockers.filter((b) => b.soft && b.r && b.id !== 'stoolMid'); // 櫃子、椅子、高腳椅、沙發（stoolMid 是凱文要坐的那張）
      for (const [from, r] of [[home, k.out], [k.side, k.back]]) {
        const all = [from, ...r.pts];
        for (let i = 1; i < all.length; i++) {
          const h = n.hits(all[i - 1], all[i]);
          if (h) hits.push(h);
          for (let j = 0; j <= 50; j++) { // 也不穿過櫃子、椅子、另外兩張高腳椅的本體
            const x = all[i - 1].x + (all[i].x - all[i - 1].x) * j / 50, z = all[i - 1].z + (all[i].z - all[i - 1].z) * j / 50;
            for (const b of soft) if (Math.hypot(x - b.x, z - b.z) < b.r) hits.push(b.id);
          }
        }
      }
      return { ok: k.out.ok && k.back.ok, hits: [...new Set(hits)], cab, boss: n.blockers.some((b) => b.id === 'boss'), door: k.out.pts.some((p) => p.z > 0.25) && k.back.pts.some((p) => p.z > 0.25),
        gap: [...k.out.pts, ...k.back.pts].some((p) => p.z < -3.25 && p.x > 1.6) };
    });
    const r0 = await route();
    check(r0.cab && Math.abs(r0.cab.x - 2.2) < 0.01, `後牆 (2.2, −3.6) 的擺飾位照舊可以擺（櫃子是碰撞物）${JSON.stringify(r0.cab)}`);
    check(r0.ok && r0.door && !r0.gap && r0.hits.length === 0, `空隙被櫃子擋住：凱文出吧台、回吧台改走店門口那一端，不穿檯面、櫃子、高腳椅 ${JSON.stringify(r0)}`);
    await page.click('.seat-label >> text=吧台座');
    await page.waitForTimeout(1600);
    const r1 = await route();
    check(r1.ok && !r1.boss && r1.door && !r1.gap && r1.hits.length === 0, `老闆坐吧台座：沒有老闆的碰撞物（承峰「我坐的地方不會影響才對」），仍走店門口那一端、不穿檯面、櫃子、椅子 ${JSON.stringify(r1)}`);
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  {
    // 黑板寫滿 + 吧台座 tastingBrew(autoLog)
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(url + '?dev=1&speed=20&opening=0&regulars=0&weather=clear&moments=0&board=dongshan,black,iced,longan');
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1800);
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    await page.evaluate(() => window.__cafe.tastingSetup('zhe-new'));
    await page.tap('.seat-label >> text=吧台座');
    await page.waitForFunction(() => window.__cafe.tasting.offerable, null, { timeout: 15000 });
    check(await page.evaluate(() => window.__cafe.tastingBrew('zhe-new')), '阿哲第五幕之後：試調阿哲的新法（autoLog）');
    await page.waitForFunction(() => window.__cafe.brewing, null, { timeout: 5000 });
    await page.waitForFunction(() => !window.__cafe.brewing, null, { timeout: 40000 });
    await page.waitForTimeout(600);
    const rid = (await cafe('tasting')).records[0].id;
    check(!!(await cafe('tasting')).records[0].params, 'autoLog 帶參數');
    await page.evaluate((id) => window.__cafe.recordSettle(id), rid);
    let m = await cafe('menu');
    check(m.open && m.swapFor === 'zhe-new', '黑板寫滿：打開菜單本換一行');
    await page.tap('#menu-cancel');
    await page.tap('#sheet-close');
    m = await cafe('menu');
    check(!m.book.includes('zhe-new') && !(await cafe('tasting')).records[0].settled, '先不寫：不進菜單本');
    await page.evaluate((id) => window.__cafe.recordSettle(id), rid);
    await page.tap('.menu-row[data-item="iced"] button');
    await page.waitForTimeout(400);
    m = await cafe('menu');
    check(JSON.stringify(m.board) === JSON.stringify(['dongshan', 'black', 'zhe-new', 'longan']) && !m.open && (await cafe('tasting')).records[0].settled > 0, `換掉冰美式定案（${m.board.join(',')}）`);
    const zp = await page.evaluate(() => JSON.parse(localStorage.getItem('dream-cafe.save')).menu.items['zhe-new']?.brewProfile);
    check(!!zp?.technique, '定案寫入 zhe-new brewProfile');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await ctx.close();
  }
  /* ---------- 烘豆（D217）：打烊後點烘豆機、選烘焙度、德叔演完、東山的豆換成這一批、菜單本多一句、沖的時候說一次 ---------- */
  console.log('手機 390×844（烘豆：打烊後點烘豆機、淺／深／剛好、架上這一批）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&regulars=0&weather=clear&moments=0');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    let pt = await page.evaluate(() => window.__cafe.roasterOnScreen());
    check(!!pt, `俯瞰看得到吧台最裡端的烘豆機 ${JSON.stringify(pt)}`);
    await page.mouse.click(pt.pageX, pt.pageY);
    await page.waitForTimeout(300);
    check((await page.textContent('#bubble')).includes('打烊以後再烘') && !(await cafe('roast')).roasting && await page.isHidden('#choices'), '開店時點烘豆機：德叔說一句，不會開始烘');
    await page.waitForTimeout(3500);
    await closeShop(page);
    await page.waitForFunction(() => window.__cafe.closing === 'lastcup', null, { timeout: 20000 });
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForFunction(() => window.__cafe.closing === 'after', null, { timeout: 25000 });
    await page.waitForTimeout(1500);
    await page.click('#stand');
    await page.waitForFunction(() => window.__cafe.roast.openable && window.__cafe.mode === 'overview', null, { timeout: 15000 });
    await page.waitForTimeout(1500); // 等鏡頭回到俯瞰
    await page.waitForFunction(() => !document.getElementById('bubble').classList.contains('show'), null, { timeout: 15000 }); // 德叔說完話（鏡頭不再轉向他）
    pt = await page.evaluate(() => window.__cafe.roasterOnScreen());
    await page.mouse.click(pt.pageX, pt.pageY);
    await page.waitForSelector('#choices button', { timeout: 5000 });
    const opts = await page.$$eval('#choices button', (b) => b.map((x) => x.textContent));
    check(opts.length === 3 && opts[2] === '剛好', `打烊後點烘豆機：德叔問淺一點、深一點、剛好（剛好在最下面）${opts.join('／')}`);
    check((await smallTargets(page)).length === 0, '烘豆的選項都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-roast-ask.png' });
    await page.click('#choices button >> nth=0');
    check((await cafe('roast')).batch?.level === 'light', '選「淺一點」：架上換成這一批（先存檔，中途離開也不白烘）');
    await page.waitForFunction(() => window.__cafe.roast.roasting?.phase === 'roast', null, { timeout: 15000 });
    await page.waitForFunction(() => window.__cafe.roast.smoke > 0 && window.__cafe.roast.flame > 0.2, null, { timeout: 10000 });
    const r1 = await cafe('roast');
    check(Math.abs(r1.deshu.x - 2.6) < 0.05 && Math.abs(r1.deshu.z + 3) < 0.05, `德叔走到烘豆機後面搖滾筒、爐火亮、冒淡灰的煙 ${JSON.stringify(r1.deshu)}`);
    check(await page.isVisible('#goodnight') && await page.isVisible('#diary-btn'), '烘的時候老闆照樣可以做別的事（明天見、今天的一杯）');
    await page.screenshot({ path: OUT + 'phone-roast-roasting.png' });
    await page.waitForFunction(() => window.__cafe.roast.tray, null, { timeout: 15000 });
    check(true, '下豆：竹篩出現');
    await page.waitForFunction(() => !window.__cafe.roast.roasting, null, { timeout: 20000 });
    const r2 = await cafe('roast');
    check(!r2.tray && r2.smoke === 0 && r2.flame === 0 && Math.abs(r2.deshu.z + 1.6) < 0.05, '烘完：德叔走回吧台，竹篩收起來、煙與爐火都停了');
    // 菜單本那一頁多一句；黑板不變
    await page.evaluate(() => window.__cafe.menuBook());
    const note = await page.textContent('.menu-row[data-item="dongshan"]');
    check(note.includes('架上這一批：淺焙'), `菜單本「東山的豆」那一頁多一句（${note.slice(0, 60)}）`);
    check(JSON.stringify((await cafe('menu')).lines) === JSON.stringify(['東山 日曬']), '黑板還是同一行「東山 日曬」');
    await page.click('#sheet-close');
    // 隔天沖東山的豆：德叔說一次是哪一批，第二杯不再說
    await page.click('#menu-btn');
    await page.click('#dev-day1');
    if (await page.isVisible('#journal')) await page.click('#jr-close');
    await page.waitForTimeout(800);
    await page.click('.seat-label >> text=窗邊座');
    await page.waitForTimeout(1500);
    await page.click('#brew');
    await page.waitForFunction(() => window.__cafe.moments.lastSaid?.text?.includes('這一批烘得淺'), null, { timeout: 40000 });
    check(true, '隔天德叔沖東山的豆：說一次「這一批烘得淺」');
    check((await cafe('roast')).batch.told, '說過就記下來（只說一次）');
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1500);
    check((await cafe('roast')).batch?.level === 'light', '重新整理：架上還是淺焙那一批');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
  /* ---------- 人物誌（D209、D218）：記事本「店裡的熟客」點開人物誌頁、一段一段寫進去、照片縮圖（佔位）、相簿的入口、老先生只指向信 ---------- */
  console.log('手機 390×844（人物誌：記事本、相簿入口、分段揭露）');
  {
    const { page, errors } = await open({ width: 390, height: 844 }, '?dev=1&speed=20&opening=0&weather=clear&moments=0');
    const cafe = (k) => page.evaluate((key) => window.__cafe[key], k);
    for (let i = 0; i < 4 && await page.isVisible('#journal'); i++) { await page.click('#jr-close'); await page.waitForTimeout(300); }
    let pr = await cafe('profiles');
    check(['deshu', 'longan', 'oldman'].every((w) => pr.open.includes(w)) && !pr.open.includes('yuan') && !pr.open.includes('grandpa'), `看過開場：德叔、龍眼、老先生開頁；還沒見過的人不列（${pr.open.join(',')}）`);
    await page.click('#menu-btn');
    await page.click('#open-notebook');
    const rows = await page.$$eval('#nb-people .nb-profile', (b) => b.map((x) => x.dataset.who));
    check(rows.includes('deshu') && rows.includes('longan') && rows.includes('oldman'), `記事本「店裡的熟客」列出德叔、龍眼、老先生（${rows.join(',')}）`);
    check((await smallTargets(page)).length === 0, '記事本的人物誌按鈕都 ≥ 44px');
    await page.click('#nb-people .nb-profile[data-who="deshu"]');
    pr = await cafe('profiles');
    check(pr.showing === 'deshu' && pr.title === '德叔' && pr.segs === 1, `點德叔：打開人物誌頁，只寫第一段（${pr.segs} 段）`);
    check(!(await page.textContent('#sheet-list')).match(/還有|\d+\/\d+|學徒/), '人物誌頁不寫還有幾段，也不寫德叔的秘密');
    await page.screenshot({ path: OUT + 'phone-profile-deshu.png' });
    await page.click('#sheet-close');
    // 予安走到第三段（里程碑 1～5、照片 yuan-1、yuan-2）：人物誌一段一段寫進去，跟著照片的段落有縮圖
    await page.evaluate(() => window.__cafe.favSetup('yuan', 3));
    await page.evaluate(() => window.__cafe.profile('yuan'));
    pr = await cafe('profiles');
    check(pr.showing === 'yuan' && pr.segs === 4 && pr.photos === 2, `予安：寫進 4 段（里程碑與兩張照片），兩段有照片縮圖（${pr.segs} 段、${pr.photos} 張）`);
    check(JSON.stringify(pr.got.yuan.map((x) => x.n)) === JSON.stringify([1, 2, 3, 4]), '還沒拿到的照片那一段（第 5 段）不出現、也不留空格');
    await page.waitForFunction(() => [...document.querySelectorAll('#sheet-list .profile-photo img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
    check(true, '照片縮圖載得出來（沒有圖的用「回憶等待觸發」佔位圖）');
    check((await smallTargets(page)).length === 0, '人物誌頁的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-profile-yuan.png' });
    await page.click('#sheet-list .profile-photo >> nth=0');
    await page.waitForFunction(() => window.__cafe.fav.photoOpen, null, { timeout: 5000 });
    check(true, '點縮圖看大圖');
    await page.click('#photo-close');
    await page.waitForTimeout(1500);
    await page.click('#sheet-close');
    // 相簿：予安那一頁有人物誌的入口
    await page.evaluate(() => window.__cafe.album());
    check(await page.isVisible('.album-profile[data-who="yuan"]'), '相簿：予安那一頁有「人物誌」入口');
    check((await smallTargets(page)).length === 0, '相簿的按鈕都 ≥ 44px');
    await page.screenshot({ path: OUT + 'phone-album-profile.png' });
    await page.click('.album-profile[data-who="yuan"]');
    check((await cafe('profiles')).showing === 'yuan', '從相簿點進予安的人物誌');
    await page.click('#sheet-close');
    // 老先生以已故為準：只指向信
    await page.evaluate(() => window.__cafe.profile('oldman'));
    pr = await cafe('profiles');
    check(pr.letters === 1 && (await page.textContent('#sheet-list')).includes('過世'), '老先生：寫已經過世、可以重讀律師信');
    await page.click('#sheet-list .profile-letter');
    await page.waitForSelector('#letter', { state: 'visible', timeout: 5000 });
    check(true, '「重讀這封信」打開律師信');
    await page.click('#lt-close');
    await page.reload();
    await page.waitForSelector('#app canvas');
    await page.waitForTimeout(1500);
    for (let i = 0; i < 4 && await page.isVisible('#journal'); i++) { await page.click('#jr-close'); await page.waitForTimeout(300); }
    check(JSON.stringify((await page.evaluate(() => JSON.parse(localStorage.getItem('dream-cafe.save')).profiles.got.yuan)).map((x) => x.n)) === JSON.stringify([1, 2, 3, 4]), '重新整理：寫進去的段落還在存檔裡');
    check(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
    await page.close();
  }
} catch (e) {
  console.error(e);
  failed++;
} finally {
  finishing = true;
  await browser.close();
  server.close();
}

console.log((failed ? `\n冒煙測試失敗：${failed} 項` : '\n冒煙測試通過') + `（${elapsed()}）`);
process.exit(failed ? 1 : 0);
