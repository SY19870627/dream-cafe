// 開場冒煙（自動跑完，不用人盯）：用 Playwright 從辦公室一路玩到第一晚自白，點「跳過自白」接到第一天，每一幕截圖到 tests/output/opening/（不 commit）。
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

  // 第一幕
  if (await page.locator('#op-opening input, .op-office input').count()) fail('辦公室還有輸入框');
  if (!(await page.locator('#op-send').isDisabled())) fail('沒選結尾「送出」卻能按');
  const sign = await page.locator('.op-sign').textContent();
  if (sign !== '陳怡君　敬上') fail(`署名不對：${sign}`);
  await page.locator('.op-choices button').nth(2).click();
  await sleep(1800);
  if (await page.locator('#op-send').isDisabled()) fail('選了結尾「送出」仍不能按');
  await snap('office');
  await page.locator('#op-send').click();
  await sleep(600);
  if ((await page.locator('.op-clock').textContent()) !== '16:50') fail('時鐘沒翻成 16:50');
  await page.waitForSelector('.op-title.on', { timeout: 5000 });
  await sleep(2500);
  await snap('title');
  await page.locator('#op-next').click();

  // 第二幕
  await page.waitForSelector('.op-mailbox.on #op-env');
  await sleep(800);
  await snap('mailbox');
  await page.locator('#op-env').click();
  await sleep(300);
  if ((await page.locator('#op-cap').textContent()) !== '搖起來，有鑰匙的聲音。') fail('信箱旁白沒換');
  await page.waitForSelector('.op-letter', { timeout: 5000 });
  await sleep(1000);
  if ((await page.locator('.op-letter h2').textContent()) !== '信') fail('信件標題不是「信」');
  await snap('letter');
  await page.locator('#op-attach').click();
  await sleep(1700);
  if (!(await page.evaluate(() => { const im = document.querySelector('#op-keyshot:not([hidden]) .envkey'); return im?.complete && im.naturalWidth === 1024 && im.src.includes('prop_v3b_envelope_key_v2'); }))) fail('鑰匙特寫不是 prop_v3b_envelope_key_v2 原圖');
  await snap('letter-key');
  await page.locator('#op-keyshot').click();
  await page.locator('#op-next').click();

  // 第三幕：三合院外
  await waitAct('road');
  await sleep(900);
  await snap('road-card');
  await waitText('我把機車停在三合院外面，安全帽掛在後照鏡上。', 9000);
  await sleep(400);
  await snap('road');
  await tapRead();
  await waitText('正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。');
  await page.locator('#op-door').click(); // 只點一下：門晃一下，不會開
  await sleep(900);
  if ((await text()) !== '正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。') fail('點一下門就開了');
  await tapRead(); // 點旁白也不會過（要推門）
  if ((await text()) !== '正廳的窗亮著一盞燈，門口的台階上睡著一隻橘貓。') fail('沒推門就往下了');
  await snap('road-door');
  await drag('#op-door', -160);
  await waitText('門一開，台階上的橘貓瞇著眼醒來，伸一個懶腰後，從我腳邊鑽進去。', 4000);
  if (!(await page.locator('.op-yard.lit .op-step-cat.stretch[src*="cat_longan_stretch_v3b_v2"]').count())) fail('門一開沒有伸懶腰');
  await sleep(1500);
  // 門推開、門聲風鈴過後：疊上去的假門板淡出藏起來，不留一條深色門板
  if (await page.locator('.op-door-wrap').isVisible()) fail('門開了還留著假門板');
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
      await hot.click();
      petted = true;
      await sleep(300);
      if ((await text()) !== cur) fail('點貓卻翻頁了');
      await snap('shop-cat');
    }
    if (cur === '香味一路到門口。') await snap('shop-brew');
    if (cur.startsWith('德叔端著杯子')) { await sleep(900); await snap('shop-serve'); }
  });
  // 重新整理：接著同一句
  await page.reload();
  await waitText('泡好了。坐下喝看看。');
  await tapRead();

  // 第四幕：點椅子
  await waitAct('sit');
  await sleep(900);
  await snap('sit');
  await page.mouse.click(60, 300); // 點其他地方不會坐下
  await sleep(500);
  if ((await act()) !== 'sit') fail('點別的地方也坐下了');
  await sleep(600);
  const seat = await page.evaluate(() => {
    // 找畫面上發光的椅子：掃描 canvas 不實際，改用已知角度推算位置（yaw 24、椅子在 38 度）
    const W = innerWidth > 390 ? 390 : innerWidth;
    const H = innerHeight;
    const ppd = W / 78;
    const f = 0.85 + 0.3 * 0.63;
    const s = 0.65 + 0.7 * 0.63;
    const h = 0.3 * H * s;
    return { x: W / 2 + (38 - 24) * ppd * f, y: 0.9 * H - h / 2 };
  });
  await page.mouse.click(seat.x, seat.y);
  await waitAct('coffee', 4000);
  await waitText('椅子是木頭的，坐下去才知道腿有多痠。');
  await sleep(600);
  await snap('coffee');
  let sipped = false;
  await readUntil('下去那段沒有路燈，騎慢一點。', async (cur) => {
    if (cur.startsWith('他說完就回吧台') && !sipped) {
      const hot = page.locator('.opr-hotspot[data-id="cup"]');
      if (!(await hot.count())) fail('沒有可以點的杯子');
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
  await waitText('來的時候天還亮，我是跟著導航騎上來的，沒在記路。', 2000);
  await holdOnce(1800);
  await waitText('現在手機夾在龍頭上，導航一直轉圈圈，訊號剩一格。', 2000);
  await holdOnce(1800);

  // 岔路
  await waitAct('fork');
  await waitText('前面是岔路，兩邊都沒有路牌。');
  await sleep(900);
  await snap('fork');
  await page.locator('.op-fork.left').click();
  await waitAct('temple', 5000);
  await waitText('我挑了一條騎進去。路越騎越窄，十幾分鐘後車燈照到一間鐵皮工寮，後面沒有路了。');
  await sleep(1500);
  await snap('temple-hut');
  await tapRead();
  await waitText('我掉頭騎回岔路，換另一條。這一條繞了一大圈，車燈照到一間土地公廟。');
  await page.reload(); // 重新整理：接著同一句（DOM 畫面也一樣）
  await waitText('我掉頭騎回岔路，換另一條。這一條繞了一大圈，車燈照到一間土地公廟。');
  if ((await act()) !== 'temple') fail('重新整理後不在廟這一幕');
  await readUntil('回三合院的路我還認得。', async (cur) => { if (cur === '那間廟我剛才經過了。') { await sleep(1200); await snap('temple'); } });
  await sleep(400);
  await tapRead();
  if ((await text()) !== '回三合院的路我還認得。') fail('沒按掉頭回去就往下了');
  await page.locator('#op-turnback').click();
  await sleep(800);
  await snap('uturn');

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
  await readUntil('我回去了，早上再過來。門平常沒在鎖，妳要鎖的話，裡面有門閂。');
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
  await page.locator('.opr-hotspot[data-id="bed"]').click();
  // 第一晚 A 版自白（劇本 v4.4）：躺下視角；右上角有獨立的「跳過自白」
  await waitText('外面有蟲在叫，遠一點的地方有狗叫了幾聲，又停了。', 3000);
  await sleep(1200);
  if (!(await page.evaluate(() => { const im = document.querySelector('.op-room-act.lying .op-bedpov img'); return im?.complete && im.naturalWidth === 1170 && getComputedStyle(im.closest('.op-bedpov')).opacity === '1'; }))) fail('點床後沒有切到躺下的視角');
  if (await page.locator('.opr-skip').isHidden()) fail('自白期間沒有跳過按鈕');
  await snap('room-mono');
  await tapRead();
  await waitText('被子真的有曬過，德叔沒有騙我。', 3000);
  if ((await act()) !== 'room') fail('點正文就跳完自白了');
  await sleep(1100);
  await page.locator('.opr-skip').click();
  await waitAct('d1wake', 4000); // 跳過自白：睡著並存檔，接著是第一天早上（不再停在待續）
  await sleep(1800);
  await snap('d1-title');
  const body = await page.evaluate(() => document.body.innerText);
  if (!body.includes('第一天')) fail('沒有接到第一天');
  if (body.includes('待續')) fail('第一晚之後還停在待續');
  await page.reload();
  await sleep(1500);
  if ((await act()) !== 'd1wake') fail('重新整理後不在第一天早上');
  if (errors.length) fail(`頁面錯誤：\n${errors.join('\n')}`);
  console.log(`OK：開場走到第一晚自白、跳過後接到第一天，截圖 ${shot} 張在 ${OUT}`);
} catch (e) {
  await snap('FAIL').catch(() => {});
  console.error('FAIL：', e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
