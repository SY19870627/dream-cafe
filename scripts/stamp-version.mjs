// 把目前的台北時間寫進 src/version.js 的 BUILD_TIME。
// 由 .githooks/pre-commit 在每次 commit 前自動執行（要先在本機設定一次：git config core.hooksPath .githooks）；
// 也可以手動跑：npm run version:stamp
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { taipeiStamp, versionSource } from '../src/debug/stamp.js';

const target = fileURLToPath(new URL('../src/version.js', import.meta.url));
const stamp = taipeiStamp(new Date());
writeFileSync(target, versionSource(stamp), 'utf8');
console.log(`src/version.js BUILD_TIME = ${stamp}`);
