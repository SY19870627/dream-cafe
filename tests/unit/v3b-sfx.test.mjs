// 真實音效：對照表（story/sfx.js）與 assets/audio/sfx/ 的檔案一對一；audio.js 用 fetch（cors）載、接 master、載不到退回合成。
// 只讀原始碼與檔案，不開瀏覽器、不出聲。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SFX_DIR, SFX_FILES, SFX_SYNTH_ONLY, SFX_GAIN, sfxFiles, sfxGain } from '../../src/story/sfx.js';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');

test('每個接上的真實音效在 assets/audio/sfx/ 都有 ogg 與 mp3；資料夾裡沒有多的檔', () => {
  assert.equal(SFX_DIR, 'assets/audio/sfx');
  const want = new Set();
  for (const name of Object.keys(SFX_FILES)) {
    const f = sfxFiles(name);
    assert.ok(f, name);
    for (const url of [f.ogg, f.mp3]) {
      assert.ok(existsSync(root(url)), `缺 ${url}`);
      assert.ok(statSync(root(url)).size > 0, `${url} 是空檔`);
      want.add(url.slice(SFX_DIR.length + 1));
    }
  }
  assert.deepEqual(new Set(readdirSync(root(SFX_DIR))), want, '多了或少了音效檔');
  let total = 0;
  for (const f of want) total += statSync(root(`${SFX_DIR}/${f}`)).size;
  assert.ok(total <= 8 * 1024 * 1024, `音效總量 ${total} 超過 8 MB`);
});

test('檔名對照：駝峰名稱對到連字號檔名；新拆出的名稱都在；tap／memory／ding 維持合成', () => {
  assert.equal(SFX_FILES.engineStart, 'engine-start');
  assert.equal(SFX_FILES.engineOff, 'engine-off');
  assert.equal(SFX_FILES.thinPour, 'thin-pour');
  for (const [k, v] of Object.entries({ doorIron: 'door-iron', tickBowl: 'tick-bowl', pageBag: 'page-bag', chime: 'chime', creakWindow: 'creak-window', creakDrawer: 'creak-drawer', store: 'store', wallet: 'wallet' })) assert.equal(SFX_FILES[k], v, k);
  assert.deepEqual(SFX_SYNTH_ONLY, ['tap', 'memory', 'ding']);
  for (const n of SFX_SYNTH_ONLY) assert.equal(sfxFiles(n), null, n);
  assert.equal(sfxFiles('toString'), null, '原型上的名稱不算');
  assert.deepEqual(Object.keys(sfxFiles('bell')), ['ogg', 'mp3'], 'audio.js 照這個順序試：ogg 先、mp3 備用');
  assert.equal(sfxGain('bell'), 1, '預設增益 1');
  for (const g of Object.values(SFX_GAIN)) assert.ok(g > 0 && g <= 1.5);
});

test('audio.js：每個有錄音的名稱都留著合成退路；錄音用 fetch cors 載、接 master、不另建 <audio>', () => {
  const src = read('src/view/audio.js');
  const AMBIENT = new Set(['rain', 'heater', 'room', 'cafe', 'shop', 'fan', 'grinder', 'hum', 'wind', 'lobby', 'store', 'scooter', 'engine', 'insects']);
  for (const n of [...Object.keys(SFX_FILES), ...SFX_SYNTH_ONLY]) {
    if (AMBIENT.has(n)) assert.match(src, new RegExp(`name === '${n}'`), `環境聲 ${n} 沒有合成退路`);
    else assert.ok(src.includes(`case '${n}':`), `音效 ${n} 沒有合成退路`);
  }
  assert.match(src, /from '\.\.\/story\/sfx\.js'/);
  assert.match(src, /fetch\(url, \{ mode: 'cors', credentials: 'omit' \}\)/);
  assert.match(src, /decodeAudioData/);
  assert.match(src, /s\.connect\(g\)\.connect\(master\)/, '短音效接 master（靜音鍵一起管）');
  assert.match(src, /src\.connect\(pg\)\.connect\(g\)/, '循環環境聲接到環境聲增益（再接 master）');
  assert.doesNotMatch(src, /connect\(ctx\.destination\)[\s\S]*connect\(ctx\.destination\)/, '只有 master 接 destination');
  assert.equal((src.match(/createElement\('audio'\)/g) || []).length, 1, '只有 makeSlot 建 <audio>');
  // setEngine：錄音用 playbackRate，怠速 1.0、往前騎約 1.2
  assert.match(src, /engine = \{ rate: src\.playbackRate \}/);
  assert.match(src, /const ENGINE_RATE = 0\.2;/);
});

test('開場轉彎、迴轉：不播 rev 錄音（冷車爆音像要故障），改走引擎轉速曲線，結束回怠速', async () => {
  const view = read('src/view/opening.js');
  assert.doesNotMatch(view, /play\('rev'\)/, '轉彎／迴轉不再疊 rev 錄音');
  assert.doesNotMatch(view, /setEngine\(0\.[78]\)/, '不再把轉速停在 0.7／0.8');
  assert.match(view, /setEnginePath\(ENGINE_TURN\);[^\n]*\n\s*await road\.turn\(side\);/);
  assert.match(view, /setEnginePath\(ENGINE_UTURN\);[^\n]*\n\s*await road\.uturn\(\);/);
  assert.match(view, /import \{[^}]*\bsetEnginePath\b[^}]*\bENGINE_TURN\b[^}]*\bENGINE_UTURN\b[^}]*\} from '\.\/audio\.js';/);
  const src = read('src/view/audio.js');
  assert.match(src, /export function setEnginePath\(steps\)/);
  assert.match(src, /export const ENGINE_TURN = /);
  assert.match(src, /export const ENGINE_UTURN = /);
  const A = await import('../../src/view/audio.js');
  assert.equal(typeof A.setEnginePath, 'function');
  for (const [name, path, end, peak] of [['ENGINE_TURN', A.ENGINE_TURN, 1.5, 0.7], ['ENGINE_UTURN', A.ENGINE_UTURN, 1.6, 0.5]]) {
    assert.ok(path.length >= 2, name);
    assert.equal(path.at(-1).t, end, `${name} 對齊動畫長度`);
    assert.equal(path.at(-1).rev, 0, `${name} 結束回怠速`);
    let prev = 0;
    for (const s of path) {
      assert.ok(s.t - prev >= 0.2 - 1e-9, `${name} 每段至少 0.2 秒（${prev}→${s.t}）`);
      assert.ok(s.rev >= 0 && s.rev <= peak, `${name} 轉速 ${s.rev} 超過 ${peak}`);
      prev = s.t;
    }
  }
  // 沒有 AudioContext 時只記下最後轉速，不丟錯
  A.setEnginePath(A.ENGINE_TURN);
});

test('呼叫點換成新拆出來的名稱', () => {
  const days = read('src/view/days.js');
  assert.match(days, /name === 'mailbox'\) \{ play\('doorIron'\)/);
  // 數錢、開抽屜改成分鏡格（承峰 2026-11-24）：音效跟著分鏡格疊上來時播（錢包只播錢包聲、拉抽屜聲）
  assert.match(days, /wallet: \{ slot: 'sb_wallet', panels: 1, sfx: 'wallet' \}/, '數錢分鏡格只播錢包聲');
  assert.match(days, /drawer: \{ slot: 'sb_drawer', panels: 1, sfx: 'creakDrawer' \}/);
  assert.doesNotMatch(days, /name === 'wallet'\)|name === 'deskDrawer'\)/, '點錢包、點抽屜的程式動作拿掉');
  assert.match(days, /store: placeOf\('bg_store', \{ ambient: 'store'/);
  const lines = read('src/lines/days.js');
  assert.match(lines, /我先把窗戶打開。', set: \{[^}]*\}, sfx: \['creakWindow'\]/);
  assert.match(lines, /袋子一打開，[^']*', set: \{ \.\.\.SIDE \}, sfx: \['pageBag'\]/);
  assert.match(lines, /壞的丟鐵碗，頭沒抬。', sfx: \['tickBowl'\]/);
  assert.match(lines, /我又剝了一顆。', sfx: \['tickBowl'\]/);
  // 承峰 11/23 20:22：德叔這句改回原本的喀一聲（tick），不要用 tickBowl
  assert.match(lines, /啊是有好吃還是沒好吃？', sfx: \['tick'\]/);
  assert.match(lines, /一顆龍眼乾滾到桌上，牠自己嚇了一跳。', sfx: \['tick'\]/);
  assert.match(read('src/story/direction.js'), /'d3-s3-01': \{ sfx: \['ding'\] \}/, '電梯仍是合成的 ding');
  assert.match(read('src/view/opening.js'), /play\('creak'\)/, '開場躺下仍是床板 creak');
});
