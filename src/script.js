// 劇本檔（scripts/*.yaml）的載入與編譯（承峰 11/7：「把需要頻繁對話的程式設計，把劇情獨立出來一個檔案管理」，D224）。
// - scripts/_shared.yaml：說話者對照、客人註冊表（名字、第一次來、來店機率、說出名字以前的稱呼、自我介紹）、條件的別名、共用的句子
// - scripts/yuan.yaml、zhe.yaml、kevin.yaml：每位熟客的來訪段落（visits.js 的 SEGMENTS）與里程碑的演出、日誌、提示（story.js 的 MILESTONES）
// 劇本格式與每一種步驟的寫法見 docs/劇本格式.md；npm run script:view 產生給人看的 docs/劇本對照.md。
// 編譯出來的步驟和原本寫在 JS 裡的一樣（main.js 的 playStep() 照舊演），只多了：
//   narrate（旁白）、choice 的選項是 { id, text }、branch 的 cases 是 { 選項 id: 步驟 }。
// 載入：瀏覽器用 fetch（帶 ?v=版本號），Node（單元測試、npm run script:view）直接讀檔；都用 top-level await，不需要打包。
// 純邏輯，不依賴 Three.js 或 DOM；不 import 其他遊戲模組（visits.js、story.js 讀這裡）。
import { parse } from '../vendor/yaml-lite.js';
import { GAME_VERSION } from './version.js';

export const FILES = ['_shared', 'yuan', 'zhe', 'kevin'];
export const TAGS = ['待定', '原句', '劇本']; // 每一句的狀態：沒寫 tag 就是【待定】
const ID_RE = /^[a-z][a-zA-Z0-9_-]*$/; // 選項 id：英文小寫開頭（不能是純數字，物件的 key 會被重新排序）

// 不帶參數的步驟（- deshuHome）
const BARE = new Set(['deshuHome', 'music', 'brewTaste', 'menu', 'notice', 'name']);
// 只帶一個對象的步驟（- look: 予安）
const TARGET = new Set(['look', 'glance', 'deshuTo', 'leave', 'arrived']);
// 對象欄位：可以寫中文（予安、窗外）或 id（yuan、window）
const TARGET_KEYS = new Set(['who']);
// 原本就有的步驟（{ do: ... } 照原樣，main.js 的 playStep() 認得的）
export const STEP_KINDS = new Set(['say', 'narrate', 'wait', 'look', 'pose', 'enter', 'walk', 'arrived', 'leave', 'deshuTo', 'deshuHome',
  'serve', 'cat', 'music', 'laugh', 'glance', 'weather', 'prop', 'choice', 'branch', 'when', 'mark', 'catMove', 'notice', 'keys', 'name',
  'ifFire', 'read', 'brewTaste', 'menu']);

class ScriptError extends Error {}
const fail = (where, msg) => { throw new ScriptError(`劇本 ${where}：${msg}`); };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// 一句台詞的字與狀態：'字'，或 { text, tag, note }
function lineOf(v, where) {
  if (typeof v === 'string') return { text: v, tag: '待定' };
  if (isObj(v) && typeof v.text === 'string') {
    const tag = v.tag ?? '待定';
    if (!TAGS.includes(tag)) fail(where, `tag 只能是 ${TAGS.join('／')}：${tag}`);
    return { text: v.text, tag, ...(v.note ? { note: v.note } : {}) };
  }
  return fail(where, `要寫一句字：${JSON.stringify(v)}`);
}

// 編譯器：shared＝_shared.yaml 的內容；meta＝保留 tag／note（npm run script:view 用；遊戲裡不需要）
export function compiler(shared, { meta = false } = {}) {
  const speakers = shared.speakers || {};
  const targets = { ...speakers, ...(shared.targets || {}) };
  const ids = new Set(Object.values(targets));
  const narrator = shared.narrator || '旁白';
  const target = (v, where) => {
    if (Array.isArray(v)) return v.map((x) => target(x, where));
    const id = targets[v] ?? v;
    if (!ids.has(id)) fail(where, `不認得的人或地方：${v}`);
    return id;
  };
  const cond = (v, where) => {
    if (typeof v !== 'string' || !v.trim()) fail(where, `條件要寫成字：${JSON.stringify(v)}`);
    const s = v.trim();
    return s.startsWith('not ') ? '!' + s.slice(4).trim() : s;
  };
  const keys = new Map(); // 選項的 key → 出現在哪裡（同一個 key 不能用兩次）
  const tagOf = (m, where) => {
    const tag = m.tag ?? '待定';
    if (!TAGS.includes(tag)) fail(where, `tag 只能是 ${TAGS.join('／')}：${tag}`);
    return meta ? { tag, ...(m.note ? { note: m.note } : {}) } : {};
  };
  // 選項清單：- id: 字（可以接 then: 選了以後的步驟、tag:）
  function options(list, where) {
    if (!Array.isArray(list) || !list.length) fail(where, 'options 要是至少一個選項的清單');
    const seen = new Set();
    return list.map((o, i) => {
      if (!isObj(o)) fail(where, `第 ${i + 1} 個選項要寫成「- id: 字」`);
      const [id, ...rest] = Object.keys(o).filter((k) => k !== 'then' && k !== 'tag' && k !== 'note');
      if (!id || rest.length) fail(where, `第 ${i + 1} 個選項要寫成「- id: 字」（多了 ${rest.join('、')}）`);
      if (!ID_RE.test(id)) fail(where, `選項 id 要英文小寫開頭：${id}`);
      if (seen.has(id)) fail(where, `選項 id 重複：${id}`);
      seen.add(id);
      if (typeof o[id] !== 'string') fail(where, `選項 ${id} 要有字`);
      return { id, text: o[id], ...tagOf(o, where), then: o.then === undefined ? null : steps(o.then, `${where}／${id}`) };
    });
  }
  // 一個步驟 → 一或多個編譯好的步驟（choice 帶 then 時，後面接一個 branch）
  function step(s, where) {
    if (typeof s === 'string') {
      if (!BARE.has(s)) fail(where, `不認得的步驟：${s}`);
      return [{ do: s }];
    }
    if (!isObj(s)) fail(where, `看不懂的步驟：${JSON.stringify(s)}`);
    if ('do' in s) { // 原樣的步驟：{ do: serve, who: 予安, kind: hot }
      if (!STEP_KINDS.has(s.do)) fail(where, `不認得的步驟：${s.do}`);
      if (s.do === 'choice' || s.do === 'branch' || s.do === 'when') fail(where, `${s.do} 請用「- ${s.do}: …」的寫法`);
      const out = {};
      for (const [k, v] of Object.entries(s)) {
        if (k === 'steps') out.steps = steps(v, where);
        else if (TARGET_KEYS.has(k)) out[k] = target(v, where);
        else if (k === 'tag' || k === 'note') Object.assign(out, tagOf(s, where));
        else out[k] = v;
      }
      return [out];
    }
    const head = Object.keys(s)[0];
    const extra = (allowed) => {
      const bad = Object.keys(s).filter((k) => k !== head && !allowed.includes(k));
      if (bad.length) fail(where, `「${head}」不認得的欄位：${bad.join('、')}`);
    };
    if (head === narrator) {
      extra(['tag', 'note']);
      return [{ do: 'narrate', text: lineOf(s[head], where).text, ...tagOf(s, where) }];
    }
    if (head in speakers) {
      extra(['tag', 'note', 'name']);
      if (typeof s[head] !== 'string') fail(where, `${head} 的台詞要是字`);
      return [{ do: 'say', who: speakers[head], text: s[head], ...(s.name ? { name: s.name } : {}), ...tagOf(s, where) }];
    }
    if (head === 'wait') { extra([]); if (typeof s.wait !== 'number') fail(where, 'wait 要寫秒數'); return [{ do: 'wait', sec: s.wait }]; }
    if (TARGET.has(head)) { extra([]); return [{ do: head, who: target(s[head], where) }]; }
    if (head === 'when') {
      extra(['steps']);
      return [{ do: 'when', if: cond(s.when, where), steps: steps(s.steps, `${where}／when ${s.when}`) }];
    }
    if (head === 'ifFire') { extra([]); return [{ do: 'ifFire', steps: steps(s.ifFire, `${where}／ifFire`) }]; }
    if (head === 'choice') {
      extra(['options', 'prompt', 'speak']);
      const key = s.choice;
      if (typeof key !== 'string' || !/^[a-zA-Z][\w-]*$/.test(key)) fail(where, `choice 要寫存檔用的 key：${key}`);
      if (keys.has(key)) fail(where, `choice 的 key「${key}」在 ${keys.get(key)} 用過了`);
      keys.set(key, where);
      const opts = options(s.options, `${where}／${key}`);
      const out = [{ do: 'choice', key, options: opts.map(({ then, ...o }) => o), ...(s.prompt ? { prompt: s.prompt } : {}), ...(s.speak ? { speak: true } : {}) }];
      if (opts.some((o) => o.then)) out.push({ do: 'branch', key, cases: Object.fromEntries(opts.map((o) => [o.id, o.then || []])) });
      return out;
    }
    if (head === 'branch') { // 不緊接在選項後面的分支（例如隔天才用到的選項）：- branch: key，下面每個選項 id 一段步驟
      const cases = {};
      for (const [k, v] of Object.entries(s)) if (k !== 'branch') { if (!ID_RE.test(k)) fail(where, `branch 的選項 id：${k}`); cases[k] = steps(v, `${where}／${k}`); }
      return [{ do: 'branch', key: s.branch, cases }];
    }
    return fail(where, `不認得的步驟：${head}`);
  }
  function steps(list, where, { speak = false } = {}) {
    if (list == null) return [];
    if (!Array.isArray(list)) fail(where, 'steps 要是清單（每一步前面一個 -）');
    const out = list.flatMap((s, i) => step(s, `${where} 第 ${i + 1} 步`));
    if (speak) markSpeak(out); // 來訪段落：選項選了以後老闆說出那一句（巢狀的 when、branch 裡也是）
    return out;
  }
  const markSpeak = (list) => { for (const c of list) { if (c.do === 'choice') c.speak = true; if (c.steps) markSpeak(c.steps); if (c.cases) Object.values(c.cases).forEach(markSpeak); } };
  return { steps, options, line: lineOf, cond, target };
}

const SEG_KEYS = new Set(['id', 'who', 'kind', 'with', 'after', 'before', 'of', 'uninvited', 'steps', 'invite', 'note']);
const MS_KEYS = new Set(['scene', 'journal', 'waiting', 'needSeatHint', 'needClosingHint', 'note']);
const INVITE_KEYS = new Set(['drink', 'any', 'need', 'options', 'missing', 'note']);

// texts：{ 檔名: YAML 字 }。回傳 { shared, regulars, segments, milestones, file }（file：每段、每個里程碑寫在哪個檔）
export function build(texts, { meta = false } = {}) {
  const read = (name) => {
    if (texts[name] == null) fail(name, '找不到檔案');
    try { return parse(texts[name]) || {}; } catch (e) { return fail(`${name}.yaml`, e.message); }
  };
  const shared = read('_shared');
  const C = compiler(shared, { meta });
  const segments = [], milestones = {}, file = {};
  for (const name of FILES.slice(1)) {
    const doc = read(name), where = `${name}.yaml`;
    for (const [i, seg] of (doc.segments || []).entries()) {
      const at = `${where} 段落 ${seg?.id || i + 1}`;
      if (!isObj(seg) || !seg.id || !seg.who || !seg.kind) fail(at, '每一段要有 id、who、kind');
      for (const k of Object.keys(seg)) if (!SEG_KEYS.has(k)) fail(at, `不認得的欄位：${k}`);
      if (!['with', 'visit', 'reconnect'].includes(seg.kind)) fail(at, `kind 只能是 with／visit／reconnect：${seg.kind}`);
      if (segments.some((s) => s.id === seg.id)) fail(at, 'id 重複');
      const out = { ...seg, steps: C.steps(seg.steps, at, { speak: true }) };
      if (!meta) delete out.note;
      if (isObj(seg.invite)) {
        const inv = seg.invite;
        for (const k of Object.keys(inv)) if (!INVITE_KEYS.has(k)) fail(at, `invite 不認得的欄位：${k}`);
        const opts = C.options(inv.options, `${at}／invite`);
        const treat = opts.find((o) => o.id === 'treat');
        if (!treat || opts.length !== 2) fail(at, 'invite 的 options 要兩個，其中一個 id 是 treat（我請）');
        const other = opts.find((o) => o !== treat);
        out.invite = { drink: inv.drink, ...(inv.any ? { any: true } : {}), ...(inv.need ? { need: inv.need } : {}),
          options: opts.map(({ then, ...o }) => o),
          yes: C.steps(treat.then, `${at}／invite／treat`), no: C.steps(other.then, `${at}／invite／${other.id}`),
          missing: C.steps(inv.missing, `${at}／invite／missing`), ...(meta && inv.note ? { note: inv.note } : {}) };
      } else if (seg.invite != null && typeof seg.invite !== 'string') fail(at, 'invite 要是一組邀請，或另一段的 id');
      segments.push(out);
      file[seg.id] = name;
    }
    for (const [id, m] of Object.entries(doc.milestones || {})) {
      const at = `${where} 里程碑 ${id}`;
      if (milestones[id]) fail(at, 'id 重複');
      for (const k of Object.keys(m || {})) if (!MS_KEYS.has(k)) fail(at, `不認得的欄位：${k}`);
      const out = { scene: C.steps(m.scene, `${at}／scene`) };
      const one = (k) => { if (m[k] != null) { const l = C.line(m[k], `${at}／${k}`); out[k] = meta ? l : l.text; } };
      if (m.journal) out.journal = m.journal.map((l, i) => { const x = C.line(l, `${at}／journal ${i + 1}`); return meta ? x : x.text; });
      one('waiting'); one('needSeatHint'); one('needClosingHint');
      if (meta && m.note) out.note = m.note;
      milestones[id] = out;
      file[id] = name;
    }
  }
  // 接回的 invite 寫成另一段的 id：那一段要有自己的 invite
  for (const s of segments) if (typeof s.invite === 'string' && !isObj(segments.find((x) => x.id === s.invite)?.invite)) fail(`${file[s.id]}.yaml 段落 ${s.id}`, `invite 指到的段落沒有邀請：${s.invite}`);
  const regulars = {};
  for (const [id, r] of Object.entries(shared.regulars || {})) {
    const at = `_shared.yaml regulars ${id}`;
    for (const k of ['name', 'short', 'first', 'rate', 'salt']) if (r?.[k] == null) fail(at, `少了 ${k}`);
    regulars[id] = { ...r,
      ...(r.stranger ? { stranger: { ...r.stranger, until: [].concat(r.stranger.until || []).map((c) => C.cond(c, at)) } } : {}),
      ...(r.intro ? { intro: { ...C.line(r.intro, `${at}／intro`), flag: r.intro.flag, ready: [].concat(r.intro.ready || []).map((c) => C.cond(c, at)) } } : {}) };
    if (!meta) { if (regulars[id].intro) delete regulars[id].intro.tag; delete regulars[id].note; }
  }
  const lines = Object.fromEntries(Object.entries(shared.lines || {}).map(([k, v]) => { const l = C.line(v, `_shared.yaml lines ${k}`); return [k, meta ? l : l.text]; }));
  return { shared, regulars, conds: shared.conds || {}, lines, segments, milestones, file };
}

// 一組步驟裡每個選項的 id（依選項順序）：{ key: [id, …] }。存檔第 13 → 14 版把數字 index 換成 id 時用
export function choiceIdsOf(lists) {
  const out = {};
  const walk = (list) => {
    for (const s of list || []) {
      if (s.do === 'choice' && Array.isArray(s.options)) out[s.key] = s.options.map((o) => o.id);
      if (s.steps) walk(s.steps);
      if (s.cases) Object.values(s.cases).forEach(walk);
    }
  };
  lists.forEach(walk);
  return out;
}

async function readTexts() {
  const base = new URL('../scripts/', import.meta.url);
  if (base.protocol === 'file:') {
    const { readFileSync } = await import('node:fs');
    return Object.fromEntries(FILES.map((f) => [f, readFileSync(new URL(`${f}.yaml`, base), 'utf8')]));
  }
  const got = await Promise.all(FILES.map(async (f) => {
    const res = await fetch(new URL(`${f}.yaml?v=${GAME_VERSION}`, base));
    if (!res.ok) throw new Error(`讀不到劇本 scripts/${f}.yaml（${res.status}）`);
    return [f, await res.text()];
  }));
  return Object.fromEntries(got);
}

export const TEXTS = await readTexts();
export const SCRIPT = build(TEXTS);
