// yaml-lite：劇本檔（scripts/*.yaml）用的小型 YAML 解析器。不依賴任何套件，瀏覽器與 Node 都能直接 import（不需要打包）。
// 只支援劇本用得到的 YAML 子集（寫法都是標準 YAML，別的 YAML 工具也讀得懂）：
// - 縮排的 mapping（key: value）與 sequence（- item），sequence 裡可以直接接 mapping（- key: value，下一行同欄位續寫）
// - 單行的 flow：[a, b]、{ do: serve, who: yuan }（可以巢狀）
// - 純量：不加引號的字、'單引號'（'' 是一個 '）、"雙引號"（\" \\ \n）；整數、小數、true／false、null／~；
//   yes／no／on／off 照 YAML 1.2 當成字串
// - 區塊字串：| 保留換行、> 摺成一行
// - 註解：一行開頭的 #，或空白後面的 #（引號裡的不算）
// 不支援：錨點與別名（& *）、tag（!）、多文件（---）、多行的 flow、複雜 key（?）。遇到看不懂的寫法會丟出含行號的錯誤。
// 字串裡有「: 」（半形冒號加空白）、「 #」，或開頭是 - [ ] { } ! & * ' " | > % @ ` 時要加引號；中文的全形標點不用。

export class YamlError extends Error {
  constructor(msg, line) { super(line ? `第 ${line} 行：${msg}` : msg); this.line = line; }
}

// 去掉註解（引號裡的 # 不算）
function stripComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (q === '"' && c === '\\') { i++; continue; }
      if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      if (i === 0 || /[\s[{,:]/.test(s[i - 1])) q = c;
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

// 找 mapping 的冒號：引號與 flow 括號外面、後面是空白或行尾。沒有就是 -1
function keyColon(s) {
  let q = null, depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (q === '"' && c === '\\') { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if ((c === '"' || c === "'") && (i === 0 || /[\s[{,]/.test(s[i - 1]))) q = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === ':' && depth === 0 && (i + 1 === s.length || s[i + 1] === ' ')) return i;
  }
  return -1;
}

function unquote(s, line) {
  if (s[0] === "'") {
    if (!s.endsWith("'") || s.length < 2) throw new YamlError(`單引號沒有關起來：${s}`, line);
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (!s.endsWith('"') || s.length < 2) throw new YamlError(`雙引號沒有關起來：${s}`, line);
  return s.slice(1, -1).replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t', '"': '"', '\\': '\\', '/': '/' })[c] ?? c);
}

function plain(s, line) {
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^[-+]?\d+$/.test(s)) return Number(s);
  if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s);
  if (/^[&*!%@`|>]/.test(s)) throw new YamlError(`開頭是「${s[0]}」的字要加引號：${s}`, line);
  return s;
}

// 單行的 flow（[...]、{...}）與純量
function inline(src, line) {
  const s = src.trim();
  if (s[0] !== '[' && s[0] !== '{') return s[0] === '"' || s[0] === "'" ? unquote(s, line) : plain(s, line);
  let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const scalar = (stops) => {
    ws();
    if (s[i] === '"' || s[i] === "'") {
      const q = s[i]; let j = i + 1;
      for (; j < s.length; j++) {
        if (q === '"' && s[j] === '\\') { j++; continue; }
        if (s[j] === q) { if (q === "'" && s[j + 1] === "'") { j++; continue; } break; }
      }
      const out = unquote(s.slice(i, j + 1), line); i = j + 1; return out;
    }
    let j = i;
    while (j < s.length && !stops.includes(s[j]) && !(s[j] === ':' && s[j + 1] === ' ' && stops.includes(':'))) j++;
    const out = plain(s.slice(i, j).trim(), line); i = j; return out;
  };
  const value = (stops) => { ws(); return s[i] === '[' ? seq() : s[i] === '{' ? map() : scalar(stops); };
  function seq() {
    i++; const out = []; ws();
    if (s[i] === ']') { i++; return out; }
    for (;;) {
      out.push(value(',]'));
      ws();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === ']') { i++; return out; }
      throw new YamlError(`[ ] 沒有關好：${s}`, line);
    }
  }
  function map() {
    i++; const out = {}; ws();
    if (s[i] === '}') { i++; return out; }
    for (;;) {
      const k = scalar(':,}');
      ws();
      if (s[i] !== ':') throw new YamlError(`{ } 裡要寫成 key: value：${s}`, line);
      i++;
      out[String(k)] = value(',}');
      ws();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === '}') { i++; return out; }
      throw new YamlError(`{ } 沒有關好：${s}`, line);
    }
  }
  const out = value('');
  ws();
  if (i < s.length) throw new YamlError(`看不懂後面的字：${s.slice(i)}`, line);
  return out;
}

export function parse(text) {
  const raw = String(text).replace(/^﻿/, '').split(/\r?\n/);
  // 每一行：縮排、內容（去掉註解）、原始字（區塊字串用）、行號
  const lines = [];
  raw.forEach((r, n) => {
    if (/\t/.test(r.match(/^\s*/)[0])) throw new YamlError('縮排不能用 Tab，請用空白', n + 1);
    const body = stripComment(r).replace(/\s+$/, '');
    if (body.trim() === '') { lines.push({ blank: true, raw: r, line: n + 1 }); return; }
    if (/^(---|\.\.\.)\s*$/.test(body)) throw new YamlError('不支援多文件（---）', n + 1);
    const indent = body.match(/^ */)[0].length;
    lines.push({ indent, text: body.slice(indent), raw: r, line: n + 1 });
  });
  let p = 0;
  const skip = () => { while (p < lines.length && lines[p].blank) p++; };
  const cur = () => { skip(); return lines[p]; };
  const isItem = (t) => t === '-' || t.startsWith('- ');

  function block(indent) {
    const l = cur();
    if (!l || l.indent < indent) return null;
    return isItem(l.text) ? seq(l.indent) : map(l.indent);
  }
  // 區塊字串（| 或 >）：比 key 那一行深的行全部收進來
  function blockScalar(style, parentIndent) {
    const body = [];
    let ind = null;
    while (p < lines.length) {
      const l = lines[p];
      if (l.blank) { body.push(''); p++; continue; }
      if (l.indent <= parentIndent) break;
      if (ind === null) ind = l.indent;
      body.push(l.raw.slice(ind));
      p++;
    }
    while (body.length && body[body.length - 1] === '') body.pop();
    return style === '|' ? body.join('\n') : body.join(' ').replace(/\s+/g, ' ').trim();
  }
  // key: 後面的值
  function after(rest, indent, line, inSeq) {
    const v = rest.trim();
    if (v === '|' || v === '>' || v === '|-' || v === '>-') return blockScalar(v[0], indent);
    if (v !== '') return inline(v, line);
    const n = cur();
    if (!n) return null;
    if (n.indent > indent) return block(n.indent);
    if (n.indent === indent && isItem(n.text) && !inSeq) return seq(indent); // key: 下一行同欄位的 - item
    return null;
  }
  function map(indent) {
    const out = {};
    for (;;) {
      const l = cur();
      if (!l || l.indent < indent) return out;
      if (l.indent > indent) throw new YamlError('縮排對不齊', l.line);
      if (isItem(l.text)) return out; // 同欄位的 - 屬於外層
      const c = keyColon(l.text);
      if (c < 0) throw new YamlError(`這一行要寫成「key: value」：${l.text}`, l.line);
      const kRaw = l.text.slice(0, c).trim();
      const k = String(kRaw[0] === '"' || kRaw[0] === "'" ? unquote(kRaw, l.line) : kRaw);
      if (k in out) throw new YamlError(`同一層有兩個「${k}」`, l.line);
      p++;
      out[k] = after(l.text.slice(c + 1), indent, l.line, false);
    }
  }
  function seq(indent) {
    const out = [];
    for (;;) {
      const l = cur();
      if (!l || l.indent < indent) return out;
      if (l.indent > indent) throw new YamlError('縮排對不齊', l.line);
      if (!isItem(l.text)) return out;
      const rest = l.text === '-' ? '' : l.text.slice(2);
      const pad = rest.match(/^ */)[0].length;
      const body = rest.slice(pad);
      if (body === '') { p++; const n = cur(); out.push(n && n.indent > indent ? block(n.indent) : null); continue; }
      // - key: value 或 - - item：把這一行當成往右縮的一行，交給 mapping／sequence 讀
      if (isItem(body) || (keyColon(body) >= 0 && body[0] !== '[' && body[0] !== '{')) {
        lines[p] = { ...l, indent: indent + 2 + pad, text: body };
        out.push(block(indent + 2 + pad));
        continue;
      }
      p++;
      out.push(inline(body, l.line));
    }
  }
  const out = block(0);
  const left = cur();
  if (left) throw new YamlError(`縮排對不齊：${left.text}`, left.line);
  return out;
}
