// 開場冒煙（自動跑完，不用人盯）：用 Playwright 照劇本 v5.9（字卡倒數版）從辦公室、標題、字卡「前 4 天」、收到信、字卡「前 2 天」、
// 特休前一晚一路玩到第一晚自白，點「跳過自白」接字卡「前 1 天」與「最底下那個抽屜」，
// 再玩第一天（不點信箱也接到房東）、歸零字卡、接回場（自動送出、下班）、字卡「第二天」、第二天回咖啡館、字卡「三天後」、三天後到研發咖啡之後的待續；
// 每一幕截圖到 tests/output/opening/（不 commit）。
// 執行：node tests/smoke-opening.mjs（約 1～2 分鐘）。任何一步不對或頁面丟錯就以非 0 結束。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const OUT = fileURLToPath(new URL('./output/opening/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let shot = 0;
const fail = (m) => { throw new Error(m); };

const { server, url } = await startServer(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const snap = async (name) => { await page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${name}.png` }); };
const text = () => page.evaluate(() => document.querySelector('#op-read .st-text')?.textContent || '');
const who = () => page.evaluate(() => document.querySelector('#op-read .st-name')?.textContent || '');
const act = () => page.evaluate(() => JSON.parse(localStorage.getItem('dream-cafe.v3b') || '{}').opening?.act);
const waitText = async (t, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if ((await text()) === t) return; await sleep(100); }
  fail(`等不到這一句：${t}（畫面上是：${await text()}）`);
};
const waitAct = async (a, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if ((await act()) === a) return; await sleep(100); }
  fail(`等不到這一幕：${a}（存檔是：${await act()}）`);
};
const tapRead = async () => { await sleep(300); await page.mouse.click(195, 200); await sleep(420); };
const readUntil = async (t, onEach = async () => {}, max = 60) => {
  for (let i = 0; i < max; i++) {
    const cur = await text();
    await onEach(cur);
    if (cur === t) return;
    await tapRead();
  }
  fail(`點不到這一句：${t}`);
};
const drag = async (sel, dx) => {
  const b = await page.locator(sel).boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(x + (dx * i) / 12, y); await sleep(16); }
  await page.mouse.up();
};

try {
  await page.goto(`${url}index.html`);
  await page.evaluate(() => localStorage.removeItem('dream-cafe.v3b'));
  await page.reload();
  await page.waitForSelector('.op-office.on');

  // 第一幕：離職申請單（劇本 v5.7）
  if (await page.locator('#op-opening input, .op-office input').count()) fail('辦公室還有輸入框');
  if (!(await page.locator('#op-send').isDisabled())) fail('沒點事由欄「送出」卻能按');
  if ((await page.locator('.op-form-title').textContent()) !== '離職申請單') fail('表單標題不是「離職申請單」');
  const sign = await page.locator('.op-sign').textContent();
  if (sign !== '申請人：陳怡君') fail(`申請人不對：${sign}`);
  if ((await page.locator('.op-to').textContent()) !== '送簽對象：經理') fail('送簽對象不對');
  if ((await page.locator('.op-note').textContent()) !== '說明：這件事我想了很久，今天決定說出來。') fail('說明欄不對');
  if ((await page.locator('.op-leave').textContent()) !== '我還有特休沒休完，會先把特休休完，離職日就是假休完的那一天。') fail('特休那一句不對');
  const officeText = await page.locator('.op-office').innerText();
  for (const o of ['經理您好', '辭呈', '交接', '收件人', '主旨']) if (officeText.includes(o)) fail(`辦公室還有劇本沒有的字：${o}`);
  if (await page.locator('.op-choices button').count()) fail('事由還是三選一');
  await page.locator('#op-reason').click(); // 事由欄：點一下打出固定那一句
  await sleep(500);
  if ((await page.locator('.op-keys').textContent()) !== '喀噠、喀噠……' || !(await page.locator('.op-keys').isVisible())) fail('打字時沒有「喀噠、喀噠……」');
  await sleep(1300);
  const reason = await page.locator('#op-reason').textContent();
  if (reason !== '離職事由：從今天起，我單方面辭退您。') fail(`事由不對：${reason}`);
  if (await page.locator('#op-send').isDisabled()) fail('點了事由欄「送出」仍不能按');
  await snap('office');
  await page.locator('#op-send').click();
  await sleep(600);
  if ((await page.locator('.op-clock').textContent()) !== '16:50') fail('時鐘沒翻成 16:50');
  await page.waitForSelector('.op-title.on', { timeout: 5000 });
  await sleep(2500);
  await snap('title');
  if ((await page.locator('#op-next').textContent()) !== '下班') fail('標題畫面的按鈕不是「下班」');
  // 製作人員面板（承峰 2026-11-25）：標題上不直接列名單；按鈕打開，關閉鈕／點外面／Esc 都能關
  if (await page.locator('.op-credit .op-staff').count()) fail('標題畫面上還直接列名單');
  const staffOpen = async () => { await page.locator('#op-staff-btn').click(); await sleep(300); if (!(await page.locator('#op-staff-dlg').isVisible())) fail('按「製作人員」沒打開名單'); };
  const staffClosed = async (how) => { await sleep(300); if (await page.locator('#op-staff-dlg').isVisible()) fail(`名單面板${how}關不掉`); };
  await staffOpen();
  const staffText = await page.locator('#op-staff-dlg .op-staff').textContent();
  for (const t of ['分鏡：AI 產圖', '出處：DOVA-SYNDROME（OpenTracks）', '請勿將遊戲內音檔另行下載或改作他用']) if (!staffText.includes(t)) fail(`名單面板少了「${t}」`);
  await snap('title-staff');
  await page.keyboard.press('Escape'); await staffClosed('按 Esc');
  await staffOpen(); await page.mouse.click(6, 6); await staffClosed('點外面');
  await staffOpen(); await page.locator('#op-staff-x').click(); await staffClosed('按關閉鈕');
  await page.locator('#op-next').click(); // 按「下班」

  // 倒數字卡（劇本 v5.9）：標題的「下班」先出「我單方面辭退老闆前 4 天」，再進租屋處
  const cardText = () => page.evaluate(() => document.querySelector('.op-day.daycard .op-card:not(.out) p')?.textContent || '');
  const waitCard = async (t, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if ((await cardText()) === t) return; await sleep(100); }
    fail(`等不到字卡：${t}（畫面上是：${await cardText()}）`);
  };
  // 字卡整句都在畫面裡（換行可以，不被裁掉）
  const cardFits = () => page.evaluate(() => { const p = document.querySelector('.op-day.daycard .op-card p'); const r = p?.getBoundingClientRect(); return !!r && r.left >= 0 && r.right <= innerWidth && p.scrollWidth <= p.clientWidth + 1; });
  await waitAct('t4card', 3000);
  await waitCard('我單方面辭退老闆前 4 天');
  if (!(await cardFits())) fail('字卡「前 4 天」超出畫面');
  await snap('card-t4');

  // 第二幕：收到信（第一次收到；租屋處房間 → 點信封 → 信）
  await waitAct('mailbox', 6000);
  await page.waitForSelector('.op-letterroom.on', { timeout: 5000 });
  await sleep(900);
  const cap = () => page.locator('#op-cap').textContent();
  if ((await cap()) !== '我下班回到租屋處，進了房間，把包包放在床上。') fail(`房間第一句不對：${await cap()}`);
  if (await page.locator('button#op-env, button.op-env').count()) fail('桌上的信封還能點（開信封已改成分鏡格）');
  await snap('letter-room');
  await page.locator('#op-roombox').click();
  await sleep(500);
  if ((await cap()) !== '今天我收到一封信。牛皮紙信封，拿起來裡面有東西在響。') fail('房間第二句不對');
  if (await page.locator('#op-sb').isVisible()) fail('旁白還沒讀完就疊上開信封分鏡格');
  // 桌上的信封（畫師去背層，codeart）：前兩句桌面空；第三句淡入合著的；開信封分鏡格疊上的同時換成拆過的。信封只是擺著（img，不是按鈕）
  const envState = () => page.evaluate(() => {
    const op = (s) => { const e = document.querySelector(`.op-letterroom.on ${s}`); return e ? Number(getComputedStyle(e).opacity) : -1; };
    return { closed: op('.op-env-img.closed'), opened: op('.op-env-img.opened'), src: document.querySelector('.op-letterroom.on .op-art-img')?.getAttribute('src') || '' };
  });
  { const e = await envState(); if (e.closed > 0.05 || e.opened > 0.05) fail(`前兩句桌上就有信封：${JSON.stringify(e)}`); if (!e.src.endsWith('assets/art-v56/B/bg_v58_rental_room_evening_portrait.webp')) fail(`房間不是傍晚正式圖：${e.src}`); }
  await page.locator('#op-roombox').click();
  await sleep(1100);
  if ((await cap()) !== '我在摺疊桌前坐下來，把信封放在桌上。') fail('房間第三句不對');
  if (await page.locator('#op-sb').isVisible()) fail('第三句一出來就疊上分鏡格（應該讀完再點一下）');
  { const e = await envState(); if (e.closed < 0.95 || e.opened > 0.05) fail(`第三句沒有淡入合著的信封：${JSON.stringify(e)}`); }
  if (await page.locator('.op-letterroom.on button.op-env-img, .op-letterroom.on .op-env-img[role="button"]').count()) fail('桌上的信封變成按鈕');
  if ((await page.evaluate(() => getComputedStyle(document.querySelector('.op-letterroom.on .op-env-img.closed')).pointerEvents)) !== 'none') fail('桌上的信封會收點');
  // 開信封分鏡格（承峰 2026-11-24）：第三句讀完再點一下疊上來，提示「點一下繼續」；點分鏡格收掉才進信件。不再有點信封、「我把信抽出來，從頭看起。」
  await page.locator('#op-roombox').click();
  await sleep(700);
  const env = await page.evaluate(() => { const e = document.querySelector('#op-sb'); const r = e?.getBoundingClientRect(); const c = e?.querySelector('.sb-cell.lit')?.getBoundingClientRect();
    return { on: !!e && !e.hidden && e.classList.contains('on'), sb: e?.dataset.sb, src: e?.querySelector('img')?.getAttribute('src') || '', w: r?.width || 0, cw: c?.width || 0, ch: c?.height || 0 }; });
  if (!env.on || env.sb !== 'envelope' || !env.src.endsWith('assets/art-v56/S/sb_envelope_open_v1.webp')) fail(`沒有疊上開信封分鏡格：${JSON.stringify(env)}`);
  if (Math.abs(env.cw / env.ch - 4 / 3) > 0.02 || env.cw > 251) fail(`開信封分鏡格不是寬度同小圖的橫式 4:3：${JSON.stringify(env)}`);
  if ((await page.locator('#op-hint').textContent()) !== '點一下繼續' || !(await page.locator('#op-hint').isVisible())) fail('分鏡格沒有提示「點一下繼續」');
  if ((await cap()) === '我把信抽出來，從頭看起。') fail('還有不採納的「我把信抽出來，從頭看起。」');
  await sleep(400);
  { const e = await envState(); if (e.opened < 0.95 || e.closed > 0.05) fail(`開信封分鏡格疊上時桌上沒換成拆過的信封：${JSON.stringify(e)}`); }
  await snap('sb-envelope');
  if ((await act()) !== 'mailbox') fail('分鏡格還沒點就進了信件');
  await page.locator('#op-sb').click();
  await waitAct('letter', 4000); // 分鏡格收掉後進入信件畫面
  await page.waitForSelector('.op-letter', { timeout: 5000 });
  await sleep(1000);
  if ((await page.locator('.op-letter h2').textContent()) !== '信') fail('信件標題不是「信」');
  const letterText = await page.locator('.op-letter').innerText();
  for (const t of ['我年紀大了，現在不住那裡。店想交給妳經營，屋子也一起留給妳。那間屋子冬天曬得到太陽，住下來很舒服，而咖啡館坐起來也是暖的。', '我沒有要強迫妳辭職，只是咖啡館比較遠，擔心妳應付不來。']) if (!letterText.includes(t)) fail(`信少了劇本那一句：${t}`);
  for (const o of ['若妳尚未辭職', '附件']) if (letterText.includes(o)) fail(`信還有劇本沒有的字：${o}`);
  // 承峰 2026-11-23 22:07 v510 第 2 項：信件畫面沒有鑰匙按鈕與鑰匙特寫
  if (await page.locator('#op-attach').count()) fail('信件畫面還有鑰匙按鈕 #op-attach');
  if (await page.locator('#op-keyshot').count()) fail('信件畫面還有鑰匙特寫 #op-keyshot');
  await snap('letter');
  const after = ['信裡說，台南東山有一間老三合院，正廳是咖啡館，屋子和店都想交給我。', '寫信的人我沒見過，東山我也沒去過。', '辭職這件事，我沒有想過。', '我把信摺好，和信封一起放在摺疊桌上。鑰匙留在信封裡。'];
  for (let i = 0; i < after.length; i++) {
    const t = ((await page.locator('#op-after').textContent()) || '').replace('▾', '');
    if (t !== after[i]) fail(`信後旁白第 ${i + 1} 句不對：${t}`);
    if (i < after.length - 1) { await sleep(350); await page.locator('#op-after').click(); await sleep(200); }
  }
  if (await page.getByText('出發去東山').count()) fail('信件畫面還有「出發去東山」');
  if (await page.getByText('其實我已經辭職了...').count()) fail('信件畫面還有「其實我已經辭職了...」');
  await snap('letter-after');
  await sleep(350);
  await page.locator('#op-after').click(); // 最後一句再點一下：淡出

  // 字卡「我單方面辭退老闆前 2 天」→ 特休前一晚
  await waitAct('t2card', 4000);
  await waitCard('我單方面辭退老闆前 2 天', 6000);
  if (!(await cardFits())) fail('字卡「前 2 天」超出畫面');
  await snap('card-t2');
  await waitAct('eve', 6000);
  await page.waitForSelector('.op-letterroom.eve.on', { timeout: 5000 });
  await sleep(900);
  { const e = await envState(); if (e.opened < 0.95 || e.closed !== -1) fail(`特休前一晚桌上不是拆過的信封：${JSON.stringify(e)}`); }
  const eve = ['那封信一直擺在摺疊桌上。', '今天人資來問我，特休一天都沒請，要不要先放幾天。', '我說，去年的也是，一天都沒請，全部放著沒用。我先請了明天一天。', '明天不用上班。我想去看一眼，那間咖啡館是不是真的在那裡。', '我把鑰匙從信封裡拿出來，放進外套口袋。信留在桌上。'];
  for (let i = 0; i < eve.length; i++) {
    if ((await cap()) !== eve[i]) fail(`特休前一晚第 ${i + 1} 句不對：${await cap()}`);
    if (i < eve.length - 1) {
      if (await page.locator('#op-next').isVisible()) fail('旁白還沒讀完就出現「出發去東山」');
      await sleep(350); await page.locator('#op-roombox').click(); await sleep(300);
    }
  }
  if ((await page.locator('#op-next').textContent()) !== '出發去東山') fail('按鈕不是「出發去東山」');
  await snap('eve');
  await page.locator('#op-next').click();

  // 第三幕：三合院外（夜裡，東山。）
  await waitAct('road');
  await sleep(900);
  if (await page.getByText('傍晚，東山。').count()) fail('還有「傍晚，東山。」');
  if (!(await page.getByText('夜裡，東山。').isVisible())) fail('沒有轉場字「夜裡，東山。」');
  await snap('road-intro');
  await waitText('我把機車停在三合院外面，安全帽掛在後照鏡上。', 9000);
  await sleep(400);
  await snap('road');
  await tapRead();
  await waitText('正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。');
  await sleep(300);
  if ((await page.locator('#op-read .opr-hint').textContent()) !== '把門推開' || !(await page.locator('#op-read .opr-hint').isVisible())) fail('推門沒有提示字「把門推開」');
  // 去背雙扇門（codeart）：不拖兩扇都關著；只點一下活動扇開一道縫再彈回；拖夠全開。門板不蓋到台階上的貓
  const leaves = () => page.evaluate(() => {
    const o = (c) => { const e = document.querySelector(`.op-yard.on .op-door-art .${c}`); return e ? Math.round(Number(getComputedStyle(e).opacity) * 100) / 100 : -1; };
    return { shut: o('dr-leaf.shut'), ajar: o('dr-leaf.ajar'), open: o('dr-leaf.open'), glow: o('dr-glow'), fixed: o('dr-fixed'),
      knob: document.querySelectorAll('.op-door-knob').length,
      catAbove: (() => { const c = document.querySelector('.op-yard.on .op-step-cat'); const d = document.querySelector('.op-yard.on .op-door-art'); return !c || !d || Number(getComputedStyle(c).zIndex) > Number(getComputedStyle(d).zIndex); })() };
  });
  { const lv = await leaves(); if (lv.shut !== 1 || lv.ajar !== 0 || lv.open !== 0 || lv.fixed !== 1 || lv.knob || !lv.catAbove) fail(`推門前門的樣子不對：${JSON.stringify(lv)}`); }
  await page.locator('#op-door').click(); // 只點一下：活動扇開一道縫再彈回，不會開
  await sleep(900);
  if ((await text()) !== '正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。') fail('點一下門就開了');
  { const lv = await leaves(); if (lv.shut !== 1 || lv.open !== 0) fail(`點一下之後活動扇沒有彈回關著：${JSON.stringify(lv)}`); }
  await tapRead(); // 點旁白也不會過（要推門）
  if ((await text()) !== '正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。') fail('沒推門就往下了');
  await snap('road-door');
  await drag('#op-door', -160);
  await waitText('門一開，台階上的橘貓瞇著眼醒來，伸一個懶腰後，從我腳邊鑽進去。', 4000);
  if (!(await page.locator('.op-yard.lit .op-step-cat.stretch[src*="cat_longan_stretch_v3b_v2"]').count())) fail('門一開沒有伸懶腰');
  await sleep(1500);
  // 門推開、門聲風鈴過後：疊上去的假門板淡出藏起來，不留一條深色門板
  if (await page.locator('.op-door-wrap').isVisible()) fail('門開了還留著推門熱區與「推門進去」');
  { const lv = await leaves(); if (lv.open !== 1 || lv.shut !== 0 || lv.glow !== 1 || lv.fixed !== 1) fail(`推開後不是全開、暖光全亮（固定扇不動）：${JSON.stringify(lv)}`); }
  await snap('road-open');
  // 存檔停在「門一開……」重新整理：直接是門開著的樣子，從頭到尾不出現關著的「推門進去」
  await page.reload();
  let sawClosed = false;
  for (let end = Date.now() + 2500; Date.now() < end;) {
    if (await page.evaluate(() => { const w = document.querySelector('.op-door-wrap'); return !!w && !w.hidden && getComputedStyle(w).display !== 'none' && Number(getComputedStyle(w).opacity) > 0.05; })) sawClosed = true;
    await sleep(50);
  }
  if (sawClosed) fail('讀回「門一開……」時閃出關著的門');
  await waitText('門一開，台階上的橘貓瞇著眼醒來，伸一個懶腰後，從我腳邊鑽進去。');
  if (!(await page.locator('.op-yard.lit').count())) fail('讀回「門一開……」時門口沒有亮');
  if (await page.getByText('推門進去').first().isVisible()) fail('讀回「門一開……」還看得到「推門進去」');
  await snap('road-open-resumed');
  await tapRead();

  // 店裡
  await waitAct('deshu');
  await waitText('店裡的椅子都還沒收。吧台上一台磨豆機，旁邊排著洗好的杯子，後面有個人低著頭在擦杯子。');
  await sleep(700);
  await snap('shop-enter');
  let petted = false;
  const seenSbOpen = []; // 貓靠近分鏡格（直排兩格）：cat-1 → cat-2
  await readUntil('泡好了。坐下喝看看。', async (cur) => {
    if (cur === '還沒打烊，位子自己挑。') {
      if ((await who()) !== '德叔') fail('名牌不是德叔');
      if (await page.locator('.opr-portrait img').count()) fail('只有聲音時就出了立繪');
    }
    if (cur === '他抬頭，手上那塊布停在杯口。') { await sleep(500); if (!(await page.locator('.opr-portrait img').count())) fail('立繪沒出現'); await snap('shop-deshu'); }
    if (cur === '我第一次來。' && (await who()) !== '我') fail('怡君的名牌不是「我」');
    if (cur.startsWith('然後他整個身體靠上來') && !petted) {
      await sleep(1000);
      const hot = page.locator('.opr-hotspot[data-id="cat"]');
      if (!(await hot.count())) fail('沒有可以點的貓');
      const b = await hot.boundingBox();
      if (b.width < 44 || b.height < 44) fail('貓的熱點小於 44px');
      if ((await page.locator('#op-read .opr-hint').textContent()) !== '摸摸龍眼（也可以直接翻頁）') fail('沒有提示字「摸摸龍眼（也可以直接翻頁）」');
      await hot.click();
      petted = true;
      await sleep(300);
      if ((await text()) !== cur) fail('點貓卻翻頁了');
      await snap('shop-cat');
    }
    if (cur === '香味一路到門口。') await snap('shop-brew');
    const sbCat = await page.evaluate(() => { const e = document.querySelector('#op-prop .pp-mini.on.sb'); return e ? `${e.dataset.sb}-${e.dataset.lit}` : ''; });
    if (sbCat && !seenSbOpen.includes(sbCat)) { seenSbOpen.push(sbCat); await sleep(500); await snap(`sb-${sbCat}`); }
    if (cur.startsWith('德叔端著杯子')) { await sleep(900); await snap('shop-serve'); }
  });
  if (seenSbOpen.join() !== 'cat-1,cat-2') fail(`貓靠近分鏡格沒有依序亮兩格：${seenSbOpen.join()}`);
  // 重新整理：接著同一句
  await page.reload();
  await waitText('泡好了。坐下喝看看。');
  await tapRead();

  // 第四幕：點椅子（店內 2D 定景；那張看得到的椅子發光加箭頭，提示字「點椅子坐下」；不自動坐下、不轉鏡頭）
  await waitAct('sit');
  await sleep(1200);
  await snap('sit');
  if ((await page.locator('#op-read .opr-hint').textContent()) !== '點椅子坐下' || !(await page.locator('#op-read .opr-hint').isVisible())) fail('沒有提示字「點椅子坐下」');
  if (await page.locator('#pano, #shop-look, #shop-back, #shop-look-hint').count()) fail('店內環景／看看店裡還在');
  const chair = page.locator('.opr-hotspot[data-id="chair"]');
  if (!(await chair.count())) fail('沒有可以點的椅子');
  const cb = await chair.boundingBox();
  if (cb.width < 44 || cb.height < 44) fail('椅子的熱點小於 44px');
  await page.mouse.click(30, 120); // 點其他地方不會坐下
  await sleep(500);
  if ((await act()) !== 'sit') fail('點別的地方也坐下了');
  await sleep(2500);
  if ((await act()) !== 'sit') fail('不點椅子也自動坐下了');
  await chair.click();
  await waitAct('coffee', 4000);
  await waitText('椅子是木頭的，機車騎一個多小時，我屁股麻到現在。');
  await sleep(600);
  await snap('coffee');
  // 「看看店裡／回座位」已拔掉（承峰 2026-11-21 20:48）
  if (await page.getByText('看看店裡').count()) fail('坐下後還有「看看店裡」');
  await tapRead();
  await waitText('這個杯子沒有人用，以後就是妳的。');
  let sipped = false;
  await readUntil('出去那段路沒有路燈，騎車小心。', async (cur) => {
    if (cur.startsWith('他說完就回吧台') && !sipped) {
      const hot = page.locator('.opr-hotspot[data-id="cup"]');
      if (!(await hot.count())) fail('沒有可以點的杯子');
      if ((await page.locator('#op-read .opr-hint').textContent()) !== '點杯子喝一口（也可以直接翻頁）') fail('沒有提示字「點杯子喝一口（也可以直接翻頁）」');
      await hot.click();
      sipped = true;
      await sleep(700);
      await snap('coffee-sip');
      await sleep(900);
    }
    if (cur.startsWith('龍眼跳上對面')) { await sleep(500); await snap('coffee-cat'); }
  });
  await snap('coffee-night');
  await tapRead();

  // 發動
  await waitAct('depart');
  await sleep(900);
  await snap('depart');
  const car = await page.locator('.op-scooter').boundingBox();
  if (car.x + (car.width * 644) / 800 > 390 - 4) fail('機車車身卡在右緣被裁掉');
  if ((await page.evaluate(() => getComputedStyle(document.querySelector('.op-road-light')).opacity)) !== '0') fail('還沒發動就看得到路面光');
  await page.locator('#op-start').click();
  await sleep(700);
  // 發動後看得到路面光錐（_v2 原圖、錨點 (1330,110) 對準機車前輪著地點 (232,493)）
  const light = await page.evaluate(() => { const el = document.querySelector('.op-road-light'); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, op: Number(getComputedStyle(el).opacity), ok: el.complete && el.naturalWidth === 1400 }; });
  if (!light.ok || light.op < 0.5) fail('發動後看不到路面光');
  const sc = car.width / 800;
  if (Math.abs(light.x + 1330 * sc - (car.x + 232 * sc)) > 1.5 || Math.abs(light.y + 110 * sc - (car.y + 493 * sc)) > 1.5 || Math.abs(light.w - 1400 * sc) > 1.5) fail(`路面光錐沒對準前輪：${JSON.stringify(light)}`);
  await snap('depart-beam');

  // 黑路：按住騎
  await waitAct('ride');
  await waitText('過了第一個彎，後照鏡裡就看不到那盞燈了。');
  await sleep(500);
  if ((await page.locator('#op-read .opr-hint').textContent()) !== '按住畫面，往前騎') fail('沒有提示字「按住畫面，往前騎」');
  await snap('ride');
  await page.mouse.click(195, 300); // 點一下不會往前
  await sleep(500);
  if ((await text()) !== '過了第一個彎，後照鏡裡就看不到那盞燈了。') fail('點一下就往前了');
  const holdOnce = async (ms) => { await page.mouse.move(195, 300); await page.mouse.down(); await sleep(ms); await page.mouse.up(); await sleep(300); };
  await holdOnce(700); // 放開就停
  if ((await text()) !== '過了第一個彎，後照鏡裡就看不到那盞燈了。') fail('按太短就翻頁了');
  await holdOnce(1000); // 累積到了才翻
  await waitText('車燈只照得到前面一小塊柏油，兩邊是果園還是水溝，我看不出來。', 2000);
  await page.mouse.move(195, 300); await page.mouse.down(); await sleep(900); await snap('ride-hold'); await sleep(900); await page.mouse.up(); await sleep(300);
  await waitText('來的時候天就已經黑了，我是跟著導航騎上來的，沒在記路。', 2000);
  await holdOnce(1800);
  await waitText('現在手機夾在龍頭上，導航一直轉圈圈，訊號剩一格。', 2000);
  await holdOnce(1800);

  // 岔路
  await waitAct('fork');
  await waitText('前面是岔路，兩邊都沒有路牌。');
  await sleep(900);
  if ((await page.locator('#op-read .opr-hint').textContent()) !== '點左邊或右邊的路') fail('沒有提示字「點左邊或右邊的路」');
  await snap('fork');
  await page.locator('.op-fork.left').click();
  await waitAct('temple', 5000);
  // 夜騎分鏡格（codeart v2）：工寮那句疊工寮格（夜路停下並壓暗）；不再把工寮／廟小圖畫在夜路盡頭
  const rideSb = () => page.evaluate(() => { const e = document.querySelector('#op-prop .pp-mini.on.sb'); return e ? { sb: e.dataset.sb, src: e.querySelector('img')?.getAttribute('src') || '' } : null; });
  const dimmed = () => page.evaluate(() => !!document.querySelector('.op-night-road.on.sb-dim'));
  await waitText('我挑了一條騎進去。路越騎越窄，十幾分鐘後車燈照到一間鐵皮工寮，後面沒有路了。');
  await sleep(900);
  { const s = await rideSb(); if (s?.sb !== 'shed' || !s.src.endsWith('assets/art-v56/S/sb_ride_shed_v2.webp')) fail(`工寮那句沒有疊工寮格（v2）：${JSON.stringify(s)}`); }
  if (!(await dimmed())) fail('工寮格疊著時夜路沒有壓暗');
  await snap('temple-hut');
  await tapRead(); // 點一下：工寮格收掉 → 短黑幕與引擎聲 → 換另一條
  await sleep(500);
  if (await rideSb()) fail('點一下後工寮格沒有收掉');
  if (!(await page.evaluate(() => !!document.querySelector('.op-night-road.on.blackout')))) fail('離開工寮沒有短黑幕');
  await waitText('我掉頭騎回岔路，換另一條。這一條繞了一大圈，車燈照到一間土地公廟。', 5000);
  await sleep(600);
  { const s = await rideSb(); if (s?.sb !== 'temple' || !s.src.endsWith('assets/art-v56/S/sb_ride_temple_v2.webp')) fail(`土地公廟那句沒有疊廟格（v2）：${JSON.stringify(s)}`); }
  await page.reload(); // 重新整理：接著同一句（DOM 畫面也一樣）
  await waitText('我掉頭騎回岔路，換另一條。這一條繞了一大圈，車燈照到一間土地公廟。', 6000);
  if ((await act()) !== 'temple') fail('重新整理後不在廟這一幕');
  await readUntil('回三合院的路我還認得。', async (cur) => {
    await sleep(500);
    if ((await rideSb())?.sb !== 'temple') fail(`「${cur}」時廟格沒有留著`);
    if (cur === '那間廟我剛才經過了。') { await sleep(700); await snap('temple'); }
  });
  await sleep(400);
  await tapRead();
  if ((await text()) !== '回三合院的路我還認得。') fail('沒按掉頭就往下了');
  if ((await rideSb())?.sb !== 'temple') fail('按「掉頭回去」之前廟格沒有留著');
  if (((await page.locator('#op-turnback').textContent()) || '').trim() !== '掉頭回去') fail('掉頭按鈕不是「掉頭回去」');
  await page.locator('#op-turnback').click();
  // 按了之後：廟格先收，再疊掉頭格（v2）；玩家再點一下，格子才收掉、黑幕淡出回三合院外
  await sleep(1200);
  { const s = await rideSb(); if (s?.sb !== 'uturn' || !s.src.endsWith('assets/art-v56/S/sb_ride_uturn_v2.webp')) fail(`按「掉頭回去」後沒有疊掉頭格（v2）：${JSON.stringify(s)}`); }
  if ((await page.locator('#op-read .opr-hint').textContent()) !== '點一下繼續') fail('掉頭格沒有提示「點一下繼續」');
  await snap('uturn');
  await sleep(2500);
  if ((await act()) !== 'temple') fail('掉頭格還沒點就回三合院外了');
  await page.mouse.click(195, 200); // 再點一下：格子收掉
  await sleep(300);
  if (await page.locator('#op-prop .pp-mini.on.sb').count()) fail('點了掉頭格沒有收掉');

  // 回三合院，再推門
  await waitAct('return', 6000);
  await waitText('我把車停回剛才的位置。龍眼還在台階上，換了一邊睡。');
  await sleep(600);
  if (!(await page.locator('.op-step-cat[src*="cat_longan_sleep_flip_v2"]').count())) fail('回來時不是換一邊睡（sleep_flip）');
  await snap('return');
  await page.locator('#op-door').click();
  await sleep(800);
  if ((await act()) !== 'return') fail('回來時點一下門就開了');
  await drag('#op-door', -160);
  await waitAct('stay', 4000);
  await waitText('德叔還在，拿著掃把。我剛才坐的那張椅子還沒收。');
  await sleep(600);
  await snap('stay');
  await readUntil('我也住在這間三合院，晚上有什麼事，妳喊一聲我就聽得到。門平常沒在鎖，妳要鎖的話，裡面有門閂。');
  await tapRead();

  // 庭埕、房間、睡著
  await waitAct('room', 4000);
  await waitText('我穿過庭埕。龍眼跟到一半就坐下來，沒有再跟。');
  await sleep(600);
  await snap('yard');
  await tapRead();
  await waitText('房間不大。我把鑰匙從口袋拿出來，放在枕頭旁邊。');
  await sleep(1200);
  await snap('room');
  if ((await page.locator('#op-read .opr-hint').textContent()) !== '點床躺下（也可以直接翻頁）') fail('沒有提示字「點床躺下（也可以直接翻頁）」');
  await page.locator('.opr-hotspot[data-id="bed"]').click();
  // 第一晚自白（劇本 v5.7）：躺下視角；右上角有獨立的「跳過自白」
  await waitText('外面有蟲在叫，遠一點的地方有狗叫了幾聲，又停了。', 3000);
  await sleep(1200);
  if (!(await page.evaluate(() => { const im = document.querySelector('.op-room-act.lying .op-bedpov img'); return im?.complete && im.naturalWidth === 1170 && getComputedStyle(im.closest('.op-bedpov')).opacity === '1'; }))) fail('點床後沒有切到躺下的視角');
  if (await page.locator('.opr-skip').isHidden()) fail('自白期間沒有跳過按鈕');
  await snap('room-mono');
  await tapRead();
  await waitText('棉被真的有曬過，德叔沒有騙我。', 3000);
  if ((await act()) !== 'room') fail('點正文就跳完自白了');
  await sleep(1100);
  await page.locator('.opr-skip').click();
  // 跳過自白：睡著並存檔 → 字卡「我單方面辭退老闆前 1 天」→ 章名「最底下那個抽屜」（拿掉「第一天」）
  await waitAct('t1card', 4000);
  await waitCard('我單方面辭退老闆前 1 天', 6000);
  if (!(await cardFits())) fail('字卡「前 1 天」超出畫面');
  await snap('card-t1');
  await waitAct('d1wake', 8000);
  await sleep(1800);
  await snap('d1-title');
  const body = await page.evaluate(() => document.body.innerText);
  if (!body.includes('最底下那個抽屜')) fail('沒有接到「最底下那個抽屜」');
  if (body.includes('第一天')) fail('章名還有「第一天」');
  if (body.includes('待續')) fail('第一晚之後還停在待續');
  // 重新整理（讀檔落在倒數之後）：先重出這一段最近的字卡「前 1 天」，再回第一天早上；存檔不動
  await page.reload();
  await waitCard('我單方面辭退老闆前 1 天', 5000);
  if ((await act()) !== 'd1wake') fail('重新整理後不在第一天早上');
  await snap('card-t1-resumed');
  await sleep(4000);
  if ((await act()) !== 'd1wake') fail('重出字卡後存檔被改了');

  // 第一天～研發咖啡（劇本 v5.8）：一路點到待續。互動照做：
  // 必點的熱點（錢包、抽屜、徵人海報、花斑貓、空罐子：data-need）、要拖的東西（鑰匙拖向德叔）、疊在上面要點的東西（提款機的存摺、包包裡的鑰匙）、小圖（點一下才出字）
  // 信箱是可點可不點：這裡不點（點畫面其他地方），要直接接到樓梯間的房東
  const seenMini = [];
  const seenSb = []; // 分鏡格（名-亮到第幾格）
  const seenNames = new Set();
  const seenActs = [];
  const seenTexts = new Set();
  const seenTitles = new Set();
  const seenCards = new Set();
  if (body.includes('最底下那個抽屜')) seenTitles.add('最底下那個抽屜'); // 跳過自白後已經看到章名卡
  let dragged = 0;
  let sawMailbox = false;
  let resent = false;
  for (let n = 0; n < 1200; n++) {
    const a = await act();
    if (a === 'tbc') break;
    if (seenActs.at(-1) !== a) seenActs.push(a);
    if (a === 'resend' && !resent) { // 接回場：同一張已填好的單、不能點；自動送出（16:49 → 16:50）→ 四拍（送出去了／我想起信上的那一句／信上原句（信的字體）／其實我已經辭職了...）→ 「下班」→ 字卡「第二天」
      resent = true;
      await page.waitForSelector('.op-office.resend.on', { timeout: 5000 });
      if ((await page.locator('.op-clock').textContent()) !== '16:49') fail('接回場一開始不是 16:49');
      if ((await page.locator('#op-reason').textContent()) !== '離職事由：從今天起，我單方面辭退您。') fail('接回場的事由沒有已經填好');
      if (!(await page.locator('#op-reason').isDisabled()) || !(await page.locator('#op-send').isDisabled())) fail('接回場還能點事由或送出');
      await snap('resend-1649');
      const t0 = Date.now();
      while ((await page.locator('.op-clock').textContent()) !== '16:50') { if (Date.now() - t0 > 6000) fail('接回場沒有自動翻成 16:50'); await sleep(100); }
      await page.locator('#op-after').waitFor({ state: 'visible', timeout: 4000 });
      const lines = ['送出去了。', '我想起信上的那一句。', '我沒有要強迫妳辭職，只是咖啡館比較遠，擔心妳應付不來。', '其實我已經辭職了...'];
      for (let i = 0; i < lines.length; i++) {
        const t = ((await page.locator('#op-after').textContent()) || '').replace('▾', '');
        if (t !== lines[i]) fail(`接回場第 ${i + 1} 句不對：${t}`);
        const quote = await page.locator('#op-after').evaluate((e) => e.classList.contains('quote'));
        if (quote !== (i === 2)) fail(`接回場第 ${i + 1} 句的信的字體不對（只有信上原句那一拍用）`);
        if (i < lines.length - 1) {
          if (await page.locator('#op-next').isVisible()) fail('接回場旁白還沒讀完就出現「下班」');
          await sleep(350); await page.locator('#op-after').click(); await sleep(250);
        }
      }
      if ((await page.locator('#op-next').textContent()) !== '下班') fail('接回場的按鈕不是「下班」');
      await snap('resend-1650');
      await page.locator('#op-next').click();
      await waitAct('d2card', 3000);
      continue;
    }
    const st = await page.evaluate(() => ({
      need: [...document.querySelectorAll('.opr-hotspot[data-need="1"]')].filter((e) => !e.disabled && !e.hidden).map((e) => e.dataset.id),
      item: [...document.querySelectorAll('.pp-tapitem')].filter((e) => !e.disabled).map((e) => e.dataset.id),
      drag: !!document.querySelector('.pp-drag:not(.pp-tapitem):not(.placed):not([disabled])') && !!document.querySelector('.pp-zone'),
      peek: !!document.querySelector('.pp-peek'),
      mini: document.querySelector('.pp-mini.on')?.dataset.kind || '',
      sb: (() => { const e = document.querySelector('#op-prop .pp-mini.on.sb'); return e ? `${e.dataset.sb}-${e.dataset.lit}` : ''; })(),
      box: !!document.querySelector('#op-read:not([hidden]) .opr-box:not([hidden]) .st-text'),
      name: document.querySelector('#op-read .st-name')?.textContent || '',
      text: document.querySelector('#op-read .st-text')?.textContent || '',
      card: document.querySelector('.op-day.daycard .op-card:not(.out) p')?.textContent || '',
      title: document.querySelector('.op-day:not(.daycard) .op-card:not([hidden]) p')?.textContent || '',
    }));
    if (st.name) seenNames.add(st.name);
    if (st.text && !seenTexts.has(st.text)) { // codeart 去背層與底圖：洗臉低頭／抬頭、坤伯院子的罐子與水桶
      const op = (s) => page.evaluate((q) => { const e = document.querySelector(q); return e ? Number(getComputedStyle(e).opacity) : -1; }, s);
      const wait = async (s, want, label) => { const end = Date.now() + 2500; let v = -1; while (Date.now() < end) { v = await op(s); if (Math.abs(v - want) < 0.05) return; await sleep(100); } fail(`${label}：${s} 不透明度 ${v}`); };
      if (st.text === '水很冰。') {
        const src = await page.evaluate(() => document.querySelector('.dy-place.on[data-place="basin"] .op-art-img')?.getAttribute('src') || '');
        if (!src.endsWith('assets/art-v56/B/bg_v56_hulong_basin_morning_portrait.webp')) fail(`洗臉不是早晨洗手台底圖：${src}`);
        if (await page.locator('.dy-basin, .dy-sink').count()) fail('還有 CSS 洗手台');
        if (!(await page.locator('.dy-place.on[data-place="basin"] .dy-mirror-frame').count())) fail('沒有鏡框前景');
        await wait('.dy-place.on[data-place="basin"] .dy-face', 0, '「水很冰。」低頭時鏡子裡不該有角色卡');
        await snap('d1-basin-down');
      }
      if (st.text.startsWith('我關掉銅色的水龍頭抬起頭')) { await wait('.dy-place.on[data-place="basin"] .dy-face', 1, '抬起頭時角色卡沒淡入'); await snap('d1-basin-up'); }
      if (st.text === '坤伯蹲在院子裡，面前放著一個水桶。') {
        await wait('.dy-place.on[data-place="kunyard"] .dy-emptycan-art', 1, '空罐子不在地上');
        await wait('.dy-place.on[data-place="kunyard"] .dy-fullcan', 1, '肥料罐不在');
        await wait('.dy-place.on[data-place="kunyard"] .dy-bucket-corner', 0, '水桶還沒提就在牆角');
      }
      if (st.text === '……我老花眼鏡放在屋裡啦。') await wait('.dy-place.on[data-place="kunyard"] .dy-emptycan-art', 0, '坤伯拿走後空罐子還在地上');
      if (st.text.startsWith('他一邊講，一邊把那桶水提到牆角')) {
        await wait('.dy-place.on[data-place="kunyard"] .dy-bucket-patch', 1, '提水桶那句沒有地面補丁');
        await wait('.dy-place.on[data-place="kunyard"] .dy-bucket-corner', 1, '提水桶那句牆角水桶沒淡入');
        await wait('.dy-place.on[data-place="kunyard"] .dy-fullcan', 1, '肥料罐應該一直留著');
        await snap('d5-yard-bucket');
      }
    }
    if (st.text) seenTexts.add(st.text);
    if (st.title && !seenTitles.has(st.title)) { seenTitles.add(st.title); await snap(`title-${seenTitles.size}`); }
    if (st.card && !seenCards.has(st.card)) { seenCards.add(st.card); await snap(`card-${seenCards.size}`); }
    if (a === 'd1town' && !sawMailbox && (await page.locator('.dy-place.on[data-place="mailbox"]').count())) {
      sawMailbox = true; // 信箱畫面：熱點發光、沒有字；不點，點畫面其他地方
      await sleep(400);
      if (!(await page.locator('.opr-hotspot[data-id="mailbox"]').count())) fail('信箱畫面沒有可以點的信箱');
      if (st.box) fail('信箱還沒點，「信箱是空的……」就先出來了');
      if ((await page.locator('#op-read .opr-hint').textContent()) !== '點信箱看看（也可以直接上樓）') fail('信箱沒有提示字「點信箱看看（也可以直接上樓）」');
      // 第一天的空信箱：定版圖 scene_mailboxes_empty（門都關著、沒信封），整張放進 1950/1200 的圖框；不引用帶信封的 scene_mailboxes.webp；格口裡沒有信封
      const mb = await page.evaluate(() => {
        const on = document.querySelector('.dy-place.on[data-place="mailbox"]');
        const img = on?.querySelector('.op-art-img');
        const frame = on?.querySelector('.op-art')?.getBoundingClientRect();
        return {
          src: img?.getAttribute('src') || '', w: img?.naturalWidth || 0, fit: img ? getComputedStyle(img).objectFit : '',
          ratio: frame && frame.height ? frame.width / frame.height : 0,
          old: document.querySelectorAll('img[src*="scene_mailboxes.webp"]').length,
          extra: document.querySelectorAll('.dy-slip, .dy-mbwall, .dy-mailslot img, .dy-mb-hole *:not(.dy-mb-door)').length,
        };
      });
      if (!mb.src.endsWith('assets/art/scene_mailboxes_empty.webp') || mb.w !== 1950) fail(`信箱不是定版空信箱圖：${JSON.stringify(mb)}`);
      if (mb.fit !== 'contain' || Math.abs(mb.ratio - 1950 / 1200) > 0.02) fail(`信箱圖框不是整張放進 1950/1200：${JSON.stringify(mb)}`);
      if (mb.old || mb.extra) fail(`信箱還引用舊的帶信封圖，或格口裡長了東西：${JSON.stringify(mb)}`);
      await snap('d1-mailbox');
    }
    if (st.need.length) { // 必做的熱點：閱讀框上方有提示字（不加「也可以直接翻頁」）
      const hint = (await page.locator('#op-read .opr-hint').textContent()) || '';
      if (!hint || hint.includes('也可以直接')) fail(`必點的 ${st.need[0]} 沒有提示字或加了小字：${hint}`);
      if (st.need[0] === 'poster') {
        if (hint !== '點座位區的徵人海報') fail(`徵人海報提示字不是「點座位區的徵人海報」：${hint}`);
        // 定版超商圖：熱點對準座位區後牆海報外框（原圖 1170×2532 的 x348–646、y569–977），字落在紙面裡（x358–638、y580–967）
        const pg = await page.evaluate(() => {
          const on = document.querySelector('.dy-place.on');
          const art = on?.querySelector('.op-art')?.getBoundingClientRect();
          const box = on?.querySelector('.dy-poster')?.getBoundingClientRect();
          const span = on?.querySelector('.dy-poster .pp-overlay');
          const r = document.createRange(); if (span) r.selectNodeContents(span);
          const txt = span ? r.getBoundingClientRect() : null;
          const img = on?.querySelector('.op-art-img');
          const f = (b) => b && art ? [(b.left - art.left) / art.width * 1170, (b.top - art.top) / art.height * 2532, (b.right - art.left) / art.width * 1170, (b.bottom - art.top) / art.height * 2532].map(Math.round) : null;
          return { src: img?.getAttribute('src') || '', box: f(box), txt: f(txt), text: span?.textContent || '' };
        });
        if (!pg.src.endsWith('assets/art-v56/B/bg_v56_store_interior_seating_portrait.webp')) fail(`超商不是定版座位區圖：${pg.src}`);
        const near = (a, b) => a && a.every((v, i) => Math.abs(v - b[i]) <= 6);
        if (!near(pg.box, [348, 569, 646, 977])) fail(`徵人海報熱點沒對準外框：${JSON.stringify(pg)}`);
        if (!pg.txt || pg.txt[0] < 358 || pg.txt[1] < 580 || pg.txt[2] > 638 || pg.txt[3] > 967) fail(`徵人海報的字超出紙面：${JSON.stringify(pg)}`);
        if (pg.text !== '誠徵門市人員') fail(`徵人海報疊字不對：${pg.text}`);
        await snap('d1-poster');
      }
    }
    if (st.mini && !seenMini.includes(st.mini)) { seenMini.push(st.mini); await sleep(500); await snap(`mini-${st.mini}`); }
    if (st.sb && !seenSb.includes(st.sb)) {
      seenSb.push(st.sb);
      await sleep(550);
      // 分鏡格：橫式 4:3、寬度不超過小圖（250px）；整條在畫面內、不蓋到閱讀框上緣
      const g = await page.evaluate(() => { const e = document.querySelector('#op-prop .pp-mini.on.sb'); const r = e.getBoundingClientRect(); const c = e.querySelector('.sb-cell').getBoundingClientRect();
        const box = document.querySelector('#op-read .opr-box:not([hidden])')?.getBoundingClientRect();
        return { w: c.width, h: c.height, top: r.top, bottom: r.bottom, boxTop: box && box.height ? box.top : innerHeight }; });
      if (Math.abs(g.w / g.h - 4 / 3) > 0.02 || g.w > 251) fail(`分鏡格 ${st.sb} 不是寬度同小圖的橫式 4:3：${JSON.stringify(g)}`);
      if (g.top < 0 || g.bottom > g.boxTop + 1) fail(`分鏡格 ${st.sb} 超出畫面或蓋到閱讀框：${JSON.stringify(g)}`);
      await snap(`sb-${st.sb}`);
    }
    if (st.need.length) { await page.locator(`.opr-hotspot[data-need="1"][data-id="${st.need[0]}"]`).click(); await sleep(900); continue; }
    if (st.item.length) {
      const want = { keyBar: '把鑰匙放到吧台' }[st.item[0]];
      if (want && (await page.locator('#op-read .opr-hint').textContent()) !== want) fail(`沒有提示字「${want}」`);
      if (st.item[0] === 'keyBar') { if (!(await page.locator('.pp-zone.bar-drop').count())) fail('鑰匙放到吧台沒有放置目標'); await snap('d2-keybar'); }
      await page.locator(`.pp-tapitem[data-id="${st.item[0]}"]`).click(); await sleep(900); continue;
    }
    if (st.drag) { // 拖到第一個目標區（鑰匙 → 德叔；存摺 → 櫃檯）
      await sleep(400);
      await snap(`drag-${a}`);
      const from = await page.locator('.pp-drag:not(.pp-tapitem):not(.placed)').first().boundingBox();
      const to = await page.locator('.pp-zone').first().boundingBox();
      const x0 = from.x + from.width / 2; const y0 = from.y + from.height / 2;
      const x1 = to.x + to.width / 2; const y1 = to.y + to.height / 2;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      for (let i = 1; i <= 14; i++) { await page.mouse.move(x0 + ((x1 - x0) * i) / 14, y0 + ((y1 - y0) * i) / 14); await sleep(16); }
      await page.mouse.up();
      dragged++;
      await sleep(2600);
      continue;
    }
    if (st.peek) {
      if (st.box) fail('小圖還沒點，字就先出來了');
      await sleep(350);
      await page.mouse.click(195, 200);
      await sleep(500);
      continue;
    }
    if (a === 'd2cafe' && st.text === '我相信妳一定可以的。') { await sleep(500); await snap('d2-smile'); }
    await tapRead();
  }
  await waitAct('tbc', 8000);
  await sleep(2500);
  await snap('tbc');
  const want = ['d1wake', 'd1shop', 'd1town', 'd1home', 'd1bank', 'd1store', 'resend', 'd2card', 'd2cafe', 'd5card', 'd5cafe', 'd5village', 'd5return', 'd5thanks', 'd5brew'];
  for (const w of want) if (!seenActs.includes(w)) fail(`沒走到 ${w}（走過：${seenActs.join(' → ')}）`);
  for (const old of ['d1rent', 'd1dusk', 'd1back', 'd1ride', 'd2home', 'd2back', 'd2ride', 'd3card', 'd3morn']) if (seenActs.includes(old)) fail(`還走到 v5.7 的 ${old}`);
  if (seenActs.indexOf('d5card') !== seenActs.indexOf('d2cafe') + 1) fail(`「我相信妳一定可以的。」之後不是字卡「三天後」：${seenActs.join(' → ')}`);
  if (seenActs.indexOf('resend') < seenActs.indexOf('d1store') || seenActs.indexOf('resend') > seenActs.indexOf('d2card')) fail(`接回場不在超商與字卡「第二天」之間：${seenActs.join(' → ')}`);
  for (const c of ['我單方面辭退老闆當天　16:49', '第二天', '第二天　回咖啡館', '三天後']) if (!seenCards.has(c)) fail(`沒看到字卡：${c}（看到：${[...seenCards].join('／')}）`);
  for (const c of seenCards) if (c.includes('【')) fail(`字卡露出標記：${c}`);
  if (!seenTitles.has('最底下那個抽屜')) fail(`沒看到章名：最底下那個抽屜（看到：${[...seenTitles].join('／')}）`);
  if (dragged < 1) fail('沒有拖鑰匙給德叔');
  if (seenMini.join() !== 'stain,passbook,hat,label,longan') fail(`小圖不對：${seenMini.join()}`);
  // 分鏡格（承峰 2026-11-25 定版＋codeart 肥料罐）：數錢、開抽屜、刷存摺依序亮三格、坤伯院子的肥料罐、花斑貓、研發咖啡開頭五杯、紙袋
  if (seenSb.join() !== 'wallet-1,drawer-1,atm-1,atm-2,atm-3,fertilizer-1,calico-1,brew-1,paperbag-1') fail(`分鏡格不對：${seenSb.join()}`);
  for (const nm of ['房東', '店長', '店員', '坤伯', '德叔', '我']) if (!seenNames.has(nm)) fail(`沒看到名牌：${nm}`);
  // 不點信箱：不出「信箱是空的……」，但房東整段照出
  if (seenTexts.has('信箱是空的，連傳單都沒有。')) fail('沒點信箱卻出了「信箱是空的……」');
  for (const t of ['聽到這個拖鞋聲，我就知道是房東。', '記得下禮拜要交房租。', '不好意思阿，我手騰不出空間來，妳先留著吧。', '那我……下次拿來。', '水很冰。',
    '裡面居然有十六萬！', '先當實習的老闆試試看，不適合再說。', '公司那邊，不管適不適合，我都不做了。', '明天先回去上班，把離職單送出去。再回來找德叔。',
    '我想先當實習老闆。', '我相信妳一定可以的。', '德叔……我們這三天有幾位客人？']) if (!seenTexts.has(t)) fail(`沒看到：${t}`);
  if (seenTexts.has('明天就回去找德叔吧。')) fail('超商結尾還是「明天就回去找德叔吧。」');
  for (const t of ['妳是這裡的老闆，鑰匙就交給老闆了，有需要妳隨時可以回來。', '這麼快就決定了阿？', '那我……下次再來。', '後來每天都是這樣。']) if (seenTexts.has(t)) fail(`作廢的句子出現了：${t}`);
  if ([...seenTexts].some((t) => /定存|濾掛|人資|【/.test(t))) fail('作廢情節或標記出現了');
  if (!(await page.getByText('待續').first().isVisible())) fail('研發咖啡之後沒有待續');
  if (errors.length) fail(`頁面錯誤：\n${errors.join('\n')}`);
  console.log(`OK：開場走到第一晚自白、跳過後接到第一天，再一路玩過字卡第二天、第二天回咖啡館、字卡三天後、三天後到研發咖啡之後的待續，截圖 ${shot} 張在 ${OUT}`);
} catch (e) {
  await snap('FAIL').catch(() => {});
  console.error('FAIL：', e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
