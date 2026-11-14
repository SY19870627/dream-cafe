// 除錯核心的同步：正本是這個 repo 的 src/debug/core/。
//   node scripts/sync-debug-core.mjs              → 只重算正本的 src/debug/core/MANIFEST.json（改過核心就要跑）
//   node scripts/sync-debug-core.mjs <目標資料夾>  → 重算正本的 MANIFEST，再把整個核心複製到 <目標資料夾>（例如另一個遊戲的 src/debug/core），
//                                                  目標也寫一份同樣的 MANIFEST.json
// 目標資料夾裡舊 MANIFEST 列過、正本已經沒有的檔會刪掉；目標裡其他沒列過的檔不動（並提示）。
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, listCoreFiles, MANIFEST_NAME } from '../src/debug/core/manifest-check.js';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = join(REPO, 'src', 'debug', 'core');

function git(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return ''; }
}
const sourceCommit = git(['rev-parse', '--short', 'HEAD']);
// 核心（不含 MANIFEST 本身）有沒有還沒 commit 的修改
const sourceDirty = !!git(['status', '--porcelain', '--', 'src/debug/core', `:!src/debug/core/${MANIFEST_NAME}`]);

const manifest = buildManifest(SRC, { sourceCommit, sourceDirty });
const text = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(join(SRC, MANIFEST_NAME), text, 'utf8');
console.log(`正本 MANIFEST：核心 ${manifest.coreVersion}，${Object.keys(manifest.files).length} 個檔，來源 ${sourceCommit || '（不明）'}${sourceDirty ? '（有未提交的修改）' : ''}`);

const target = process.argv[2];
if (target) {
  const dest = resolve(target);
  if (dest === SRC) throw new Error('目標資料夾就是正本，不用同步');
  mkdirSync(dest, { recursive: true });
  // 舊 MANIFEST 列過、這次沒有的檔：刪掉
  const oldPath = join(dest, MANIFEST_NAME);
  if (existsSync(oldPath)) {
    let old = {};
    try { old = JSON.parse(readFileSync(oldPath, 'utf8')).files || {}; } catch { old = {}; }
    for (const f of Object.keys(old)) {
      if (!(f in manifest.files) && existsSync(join(dest, f))) { rmSync(join(dest, f)); console.log(`刪掉：${f}`); }
    }
  }
  for (const f of listCoreFiles(SRC)) {
    mkdirSync(dirname(join(dest, f)), { recursive: true });
    copyFileSync(join(SRC, f), join(dest, f));
  }
  writeFileSync(oldPath, text, 'utf8');
  const strays = listCoreFiles(dest).filter((f) => !(f in manifest.files));
  if (strays.length) console.log(`注意：目標裡有正本沒有的檔（沒動它們，MANIFEST 測試會失敗）：${strays.join('、')}`);
  console.log(`已複製到 ${dest}`);
}
