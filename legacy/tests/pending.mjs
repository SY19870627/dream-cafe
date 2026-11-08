// 產生 docs/待定文本審稿.md：npm run pending（階段 7）
// 把程式裡標了「// 【待定】」的那一行的中文字串（台詞、信、日誌句、按鈕字）整理成一份清單，
// 讓作者不用讀程式也能審稿。每一條附上檔案與行號；註解寫的補充說明也一起列出。
// 清單是程式產生的，改台詞之後重跑一次就好；計畫檔「【待定】文本清單」是人寫的摘要，兩者並存。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FILES = readdirSync(ROOT + 'src').filter((f) => f.endsWith('.js')).sort();
const TITLE = {
  'afterhours.js': '打烊後、咖啡日記、一次客人模式', 'art.js': '美術裡的字', 'cat.js': '龍眼', 'catalog.js': '德叔的型錄',
  'farewell.js': '徵店長與告別、離開東山、常態店', 'favorites.js': '熟客最愛的咖啡、相簿', 'journal.js': '德叔的營業日誌', 'letters.js': '辭呈、律師信、老先生的信',
  'main.js': '店裡的演出與介面', 'menu.js': '黑板菜單（品項、菜單本、阿哲第六幕、熟客看到黑板）', 'moments.js': '店裡的小事（前三天、店內小事件、擺飾的反應）', 'opening.js': '開場第一～三幕', 'story.js': '三位熟客', 'tasks.js': '溫度任務完成時的一句話', 'tasting.js': '試咖啡與測試紀錄', 'roast.js': '烘豆', 'profiles.js': '人物誌', 'weather.js': '天氣',
};
const han = /[一-鿿]/;
const strRe = /(['`"])((?:\\.|(?!\1)[^\\\n])*?)\1/g;

let total = 0;
const out = [
  '# 【待定】文本審稿清單',
  '',
  '> 由 `npm run pending`（`tests/pending.mjs`）從程式碼產生，請不要手動修改；改完台詞重跑一次即可。',
  '> 收錄程式裡標了 `// 【待定】` 的每一行：自行補寫、還沒經作者確認的台詞、信件、日誌句與介面文字。',
  '> 「說明」是程式註解裡的補充（例如什麼時候出現）。劇本原文不在這份清單裡。',
  '> 摘要與分類另見 [第一版開發計畫.md](./第一版開發計畫.md)「五、【待定】文本清單」。',
  '',
];
for (const f of FILES) {
  const lines = readFileSync(ROOT + 'src/' + f, 'utf8').split(/\r?\n/);
  const items = [];
  lines.forEach((line, i) => {
    const at = line.indexOf('【待定】');
    if (at < 0) return;
    const code = line.slice(0, line.lastIndexOf('//', at) >= 0 ? line.lastIndexOf('//', at) : at);
    const note = line.slice(at + 4).replace(/^[\s：:，,]+/, '').trim();
    const grab = (src) => [...src.matchAll(strRe)].map((m) => m[2]).filter((t) => han.test(t) && !/^[\w-]+$/.test(t));
    const texts = grab(code);
    let block = null;
    if (!texts.length) {
      // 標在一整段前面的註解（例如「以下對話全部是自行補寫」）：把下面同一段的字串都列出來，
      // 直到縮排退回來的 ] 或 }、或下一個【待定】為止
      const indent = line.search(/\S/);
      block = [];
      for (let j = i + 1; j < Math.min(lines.length, i + 120); j++) {
        const l = lines[j];
        if (l.includes('【待定】')) break;
        if (/^\s*[\]}]/.test(l) && l.search(/\S/) < indent) break;
        const g = grab(l.includes(' //') ? l.slice(0, l.indexOf(' //')) : l);
        if (g.length) block.push({ n: j + 1, texts: g });
      }
      if (!block.length) block = null;
    }
    if (!texts.length && !note && !block) return;
    items.push({ n: i + 1, texts, note, block });
  });
  if (!items.length) continue;
  total += items.length;
  out.push(`## ${TITLE[f] || f}（\`src/${f}\`，${items.length} 處）`, '');
  const q = (ts) => ts.map((t) => `「${t.replace(/\\n/g, ' ／ ')}」`).join(' ');
  for (const it of items) {
    const body = it.texts.length ? q(it.texts) : it.block ? '（下面這一段）' : '（文字在附近幾行）';
    out.push(`- L${it.n}：${body}${it.note ? `　— 說明：${it.note}` : ''}`);
    for (const b of it.block || []) out.push(`  - L${b.n}：${q(b.texts)}`);
  }
  out.push('');
}
out.splice(7, 0, `共 ${total} 處。`, '');
writeFileSync(ROOT + 'docs/待定文本審稿.md', out.join('\n'));
console.log(`docs/待定文本審稿.md：${total} 處`);
