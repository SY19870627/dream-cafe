// MANIFEST.json 的產生與比對（只在 Node 用：單元測試、同步腳本）。瀏覽器不會載入這個檔（index.js 沒有 import 它）。
// 雜湊前先把換行統一成 \n：Windows 上 git 可能把檔案換成 CRLF，內容一樣就要算一樣。
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const MANIFEST_NAME = 'MANIFEST.json';

/**
 * 一個檔的 sha256（換行統一成 \n 後再算）。
 * @param {string | Uint8Array} content
 * @returns {string}
 */
export function hashContent(content) {
  const s = typeof content === 'string' ? content : Buffer.from(content).toString('utf8');
  return createHash('sha256').update(s.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/**
 * 核心資料夾裡所有的檔（不含 MANIFEST.json），用 / 分隔的相對路徑，排序過。
 * @param {string} dir
 * @returns {string[]}
 */
export function listCoreFiles(dir) {
  /** @type {string[]} */
  const out = [];
  const walk = (/** @type {string} */ d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = relative(dir, p).split(sep).join('/');
        if (rel !== MANIFEST_NAME) out.push(rel);
      }
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * 依資料夾裡現在的檔案算出 MANIFEST 的內容。
 * @param {string} dir 核心資料夾
 * @param {{ sourceCommit?: string, sourceDirty?: boolean }} [meta]
 * @returns {{ coreVersion: string, sourceCommit: string, sourceDirty: boolean, files: Record<string, string> }}
 */
export function buildManifest(dir, meta = {}) {
  /** @type {Record<string, string>} */
  const files = {};
  for (const f of listCoreFiles(dir)) files[f] = hashContent(readFileSync(join(dir, f)));
  const m = /CORE_VERSION\s*=\s*'([^']+)'/.exec(readFileSync(join(dir, 'version.js'), 'utf8'));
  return { coreVersion: m ? m[1] : '', sourceCommit: String(meta.sourceCommit || ''), sourceDirty: !!meta.sourceDirty, files };
}

/**
 * 比對 MANIFEST.json 與實際檔案：少檔、多檔、內容不同、核心版本不同都列出來。
 * @param {string} dir 核心資料夾
 * @returns {{ ok: boolean, missing: string[], extra: string[], changed: string[], versionMismatch: boolean, manifest: any }}
 */
export function checkManifest(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, MANIFEST_NAME), 'utf8'));
  const now = buildManifest(dir);
  const listed = Object.keys(manifest.files || {});
  const missing = listed.filter((f) => !(f in now.files));
  const extra = Object.keys(now.files).filter((f) => !(f in (manifest.files || {})));
  const changed = listed.filter((f) => f in now.files && now.files[f] !== manifest.files[f]);
  const versionMismatch = manifest.coreVersion !== now.coreVersion;
  return { ok: !missing.length && !extra.length && !changed.length && !versionMismatch, missing, extra, changed, versionMismatch, manifest };
}
