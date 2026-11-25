// 種子存檔各幕：每一幕用 jumpState 種存檔（第 0 句、中間、最後一句），重新載入，檢查沒有頁面錯誤、畫面有東西、存檔幕名不跑掉。
// 執行：node tests/seed-acts.mjs（要 playwright；約數分鐘）
//
// 遊戲在兩種點會「合法地」自動把存檔推進下一幕，這裡的期望照遊戲行為：
// - 字卡幕（t4card、t2card、t1card、t0card、d2card、d5card…）：字卡演完就 nextAct 存成下一幕（main.js dayCard）。
//   檢查時可能字卡還在（存檔仍是字卡幕），也可能已經存成下一幕（下一幕若有章名卡，畫面上還是 daycard）。
//   兩種都接受，但接著等字卡走完，確認最後落點：存檔是下一幕、畫面不是字卡、沒有頁面錯誤。
// - 睡著那句（b.sleep，房間最後一句）：這一句一出現就自動存成下一幕（S.sleepThrough），畫面還停在這一句。
//   期望存檔是下一幕（t1card），畫面仍不是字卡。
// 其他點照舊嚴格：存檔幕名必須等於種進去的那一幕，不能停在字卡畫面，任何一組都不能有頁面錯誤。
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import * as S from '../src/story/state.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { server, url } = await startServer(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('requestfailed', (r) => errs.push(`requestfailed ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
const cardOn = async () => (await page.locator('.op-stage.daycard.on').count()) > 0;
// 字卡會自己走完（約 3～5 秒，「第二天／回咖啡館」兩段更久），不點，等它走完（最多 12 秒）
const waitCardGone = async () => { for (let k = 0; k < 24 && await cardOn(); k++) await sleep(500); };
const snap = () => page.evaluate(() => {
  const sv = JSON.parse(localStorage.getItem('dream-cafe.v3b') || '{}');
  const stage = [...document.querySelectorAll('.op-stage.on')].map((e) => e.className).join('|');
  const txt = document.querySelector('#op-read .st-text')?.textContent || document.querySelector('.op-stage.on')?.innerText?.slice(0, 30) || '';
  return { act: sv.opening?.act, line: sv.opening?.line, phase: sv.phase, stage, txt: txt.replace(/\s+/g, ' ').slice(0, 30) };
});
const rows = []; let bad = 0;
for (const act of S.OPENING_ACTS) {
  const n = (S.ACT_LINES[act] || []).length;
  const lines = [...new Set([0, Math.floor(n / 2), Math.max(0, n - 1)])];
  const isCard = S.isCardAct(act);
  const next = S.nextActOf(act);
  for (const line of lines) {
    errs = [];
    const st = S.jumpState(S.newStoryState(), act, line);
    const slept = !!(S.ACT_LINES[act] || [])[line]?.sleep && !!next; // 睡著那句：一出現就存成下一幕
    await page.goto(`${url}index.html`);
    await page.evaluate((raw) => { localStorage.clear(); localStorage.setItem('dream-cafe.v3b', raw); }, JSON.stringify(st));
    await page.goto(`${url}index.html`);
    await sleep(2200);
    // 讀檔時先出所在那一段的字卡：字卡幕以外等它走完，接回存檔那一句
    if (!isCard && act !== S.END_ACT) await waitCardGone();
    await sleep(600);
    const r = await snap();
    let ok; let note = '';
    if (isCard) {
      // 字卡幕：還在字卡（存檔仍是這一幕），或字卡已演完、存成下一幕；畫面要有字卡或下一幕
      ok = !!r.stage && (r.act === act || r.act === next);
      // 落點：等字卡（含下一幕的章名卡）走完，存檔必須是下一幕、畫面不是字卡
      await waitCardGone();
      await sleep(600);
      const f = await snap();
      const landed = !!f.stage && f.act === next && !/daycard/.test(f.stage);
      ok = ok && landed;
      note = ` → 落點 存檔 ${f.act}#${f.line} 畫面 ${f.stage || '（無）'}「${f.txt}」`;
    } else {
      const want = slept ? next : act;
      const card = /daycard/.test(r.stage) && act !== S.END_ACT; // 不是字卡幕卻一直停在字卡畫面
      ok = !!r.stage && r.act === want && !card;
      if (slept) note = `（睡著那句：期望存成 ${want}）`;
    }
    ok = ok && !errs.length;
    if (!ok) bad++;
    rows.push(`${ok ? 'OK ' : 'NG '} ${act}#${line}/${n} → 存檔 ${r.act} 畫面 ${r.stage || '（無）'}「${r.txt}」${note}${errs.length ? ' 錯誤：' + errs.join(' ; ') : ''}`);
  }
}
await browser.close(); server.close();
console.log(rows.join('\n'));
console.log(`種子存檔：${rows.length} 組，${rows.length - bad} 過，${bad} 不過`);
process.exit(bad ? 1 : 0);
