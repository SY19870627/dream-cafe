// 劇本對照：npm run script:view（D224）
// 把劇本檔（scripts/*.yaml）整理成給人看的 docs/劇本對照.md：每一段、每一句的說話者、【待定】／【原句】／【劇本】、
// 選項與分支、條件、動作。清單是程式產生的，改了劇本檔之後重跑一次就好；劇本格式見 docs/劇本格式.md。
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, TEXTS, FILES } from '../src/script.js';

const KIND = { with: '里程碑當天的擴寫', visit: '里程碑之間的來訪', reconnect: '離線發生之後的接回' };
const SERVE = { hot: '熱的', iced: '冰的', cocoa: '可可' };
const COND = { catSill: '龍眼在窗台上', peeked: '第一天門口那位小姐的小段落演過', met: '予安說過名字' };

export function renderView(meta) {
  const names = Object.fromEntries(Object.entries({ ...meta.shared.speakers, ...meta.shared.targets }).map(([k, v]) => [v, k]));
  const nm = (id) => (Array.isArray(id) ? id.map(nm).join('、') : names[id] || id);
  const tag = (t) => `【${t || '待定'}】`;
  const cond = (c) => {
    const not = c.startsWith('!'), k = not ? c.slice(1) : c;
    const [kind, arg] = k.split(':');
    const text = COND[k] || (kind === 'flag' ? `記過 ${arg}` : kind === 'early' ? `前三天的小段落 ${arg} 演過` : kind === 'seg' ? `段落 ${arg} 演過`
      : kind === 'milestone' ? `里程碑 ${arg} 發生過` : k);
    return not ? `不是「${text}」` : text;
  };
  const note = (s) => (s.note ? `　〔${s.note}〕` : '');
  const action = (s) => {
    switch (s.do) {
      case 'look': return `鏡頭轉向${nm(s.who)}`;
      case 'glance': return `看${nm(s.who)}一眼`;
      case 'deshuTo': return `德叔走到${nm(s.who)}旁邊`;
      case 'deshuHome': return s.async ? '德叔走回吧台（不等他走完）' : '德叔走回吧台';
      case 'wait': return `停 ${s.sec} 秒`;
      case 'serve': return `德叔端${SERVE[s.kind] || s.kind}給${nm(s.who)}`;
      case 'pose': return `${nm(s.who)}換姿勢：${s.pose}`;
      case 'mark': return `記下：${s.flag ? `flag ${s.flag}` : `early ${s.early}`}`;
      case 'catMove': return `龍眼在窗台上：${s.kind}`;
      case 'cat': return `龍眼走到${nm(s.who)}身邊${s.lap ? '、跳上腿' : ''}`;
      case 'enter': return `${nm(s.who)}走進來（${s.at}）`;
      case 'walk': return `${nm(s.who)}走到 ${s.at}`;
      case 'leave': return `${nm(s.who)}離開`;
      case 'arrived': return `等${nm(s.who)}走到位子上`;
      case 'laugh': return `${nm(s.who)}笑`;
      case 'prop': return `吧台上多一樣東西：${s.prop}`;
      case 'weather': return `天氣：${s.weather}`;
      case 'read': return `打開一張紙：${s.doc}`;
      case 'music': return '德叔把音樂調小';
      case 'brewTaste': return '德叔在吧台試沖';
      case 'menu': return '阿哲的豆收進菜單本，德叔問要不要寫上黑板';
      default: return `${s.do} ${JSON.stringify(s)}`;
    }
  };
  const out = [];
  const lines = (list, depth = 0) => {
    const pad = '  '.repeat(depth);
    for (const s of list || []) {
      if (s.do === 'say') out.push(`${pad}- ${tag(s.tag)}**${s.name || nm(s.who)}**：${s.text}${note(s)}`);
      else if (s.do === 'narrate') out.push(`${pad}- ${tag(s.tag)}*旁白*：${s.text}${note(s)}`);
      else if (s.do === 'when') { out.push(`${pad}- 條件：${cond(s.if)}`); lines(s.steps, depth + 1); }
      else if (s.do === 'ifFire') { out.push(`${pad}- 條件：開場選了「單方面辭退」`); lines(s.steps, depth + 1); }
      else if (s.do === 'choice') {
        out.push(`${pad}- 選項 ${s.key}${s.speak ? '（選了以後老闆說出那一句；括號開頭的不出泡泡）' : ''}${s.prompt ? `：${s.prompt}` : ''}`);
        for (const o of s.options) out.push(`${pad}  - \`${o.id}\` ${tag(o.tag)}${o.text}${note(o)}`);
      } else if (s.do === 'branch') {
        out.push(`${pad}- 分支 ${s.key}`);
        for (const [id, c] of Object.entries(s.cases)) { out.push(`${pad}  - 選了 \`${id}\``); if (c.length) lines(c, depth + 2); else out.push(`${pad}    - （沒有）`); }
      } else out.push(`${pad}- （${action(s)}）`);
    }
  };
  const line = (label, l) => out.push(`- ${label}：${tag(l.tag)}${l.text}${note(l)}`);
  const count = { 待定: 0, 原句: 0, 劇本: 0 };
  const tally = (list) => { for (const s of list || []) { if (s.do === 'say' || s.do === 'narrate') count[s.tag || '待定']++; if (s.options) for (const o of s.options) count[o.tag || '待定']++; tally(s.steps); Object.values(s.cases || {}).forEach(tally); } };
  for (const s of meta.segments) { tally(s.steps); if (s.invite && typeof s.invite === 'object') { tally(s.invite.yes); tally(s.invite.no); tally(s.invite.missing); for (const o of s.invite.options) count[o.tag || '待定']++; } }
  for (const m of Object.values(meta.milestones)) {
    tally(m.scene);
    for (const l of [...(m.journal || []), m.waiting, m.needSeatHint, m.needClosingHint].filter(Boolean)) count[l.tag || '待定']++;
  }

  out.push('# 劇本對照', '',
    '> 由 `npm run script:view`（`tests/script-view.mjs`）從 `scripts/*.yaml` 產生，請不要手動修改；改完劇本檔重跑一次即可。',
    '> 每一句前面的【待定】是還沒經作者確認的句子；【原句】是已上線的句子搬進來段落、【劇本】是 docs/第一站劇本.md 的原文。',
    '> 寫法見 [劇本格式.md](./劇本格式.md)。條件、排程與獎勵在 `src/story.js`、`src/visits.js`，不在這份清單裡。', '',
    `目前：【待定】${count.待定} 句、【原句】${count.原句} 句、【劇本】${count.劇本} 句（含選項與日誌）。`, '');
  for (const file of FILES.slice(1)) {
    const r = meta.regulars[file];
    out.push(`## ${r ? `${r.name}（${r.short}）` : file}　\`scripts/${file}.yaml\``, '');
    if (r?.stranger) out.push(`- 還不知道名字時泡泡上叫「${r.stranger.name}」；${r.stranger.until.map(cond).join('、或')}以後叫名字${r.stranger.visits ? '（來訪段落開著時）' : ''}`);
    if (r?.intro) out.push(`- 自我介紹（第一次點他時，${r.intro.ready.map(cond).join('、或')}以後）：${tag(r.intro.tag)}${r.intro.text}`);
    if (r?.stranger || r?.intro) out.push('');
    out.push('### 來訪段落', '');
    for (const s of meta.segments.filter((x) => meta.file[x.id] === file)) {
      const where = s.kind === 'with' ? `取代 ${s.with} 的場景` : `${s.kind === 'reconnect' ? `接回 ${s.of}，` : ''}第 ${s.after} 個里程碑之後、第 ${s.before} 個之前${s.uninvited ? '（只補第一杯）' : ''}`;
      out.push(`#### ${s.id}｜${KIND[s.kind]}｜${where}`, '');
      if (s.note) out.push(`${s.note}`, '');
      lines(s.steps);
      if (typeof s.invite === 'string') out.push(`- 結尾的第一杯：和 ${s.invite} 同一組`);
      else if (s.invite) {
        out.push(`- 結尾的第一杯（${s.invite.drink}${s.invite.any ? '，喝的不限' : ''}${s.invite.need ? `，黑板上要有 ${s.invite.need}` : ''}）`);
        for (const o of s.invite.options) out.push(`  - \`${o.id}\` ${tag(o.tag)}${o.text}${note(o)}`);
        out.push('  - 選了 `treat`、黑板上有那一杯'); lines(s.invite.yes, 2);
        out.push('  - 選了另一個'); lines(s.invite.no, 2);
        out.push('  - 選了 `treat`、黑板上沒有那一杯'); lines(s.invite.missing, 2);
      }
      out.push('');
    }
    out.push('### 里程碑', '');
    for (const [id, m] of Object.entries(meta.milestones).filter(([k]) => meta.file[k] === file)) {
      out.push(`#### ${id}`, '');
      if (m.note) out.push(m.note, '');
      for (const [i, l] of (m.journal || []).entries()) line(`日誌 ${i + 1}`, l);
      if (m.waiting) line('想等老闆在（日誌）', m.waiting);
      if (m.needSeatHint) line('要老闆坐下的提示', m.needSeatHint);
      if (m.needClosingHint) line('要打烊後的提示', m.needClosingHint);
      out.push('- 場景：');
      lines(m.scene, 1);
      out.push('');
    }
  }
  return out.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const md = renderView(build(TEXTS, { meta: true }));
  const file = fileURLToPath(new URL('../docs/劇本對照.md', import.meta.url));
  writeFileSync(file, md);
  console.log(`寫好了 ${file}`);
}
