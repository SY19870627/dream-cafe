# 除錯核心（debug core）

兩個遊戲共用的「測試模式＋回報系統」：網址帶 `?debug=1` 時，畫面左邊出現 **DBG**（除錯面板）與 **回報** 兩顆按鈕。

- 除錯面板：目前位置、跳關、快轉、待送佇列（重送、複製 JSON）、本人識別碼、版本與最新版本、重新載入最新版（清 Cache Storage 與 service worker）、清除存檔重來。
- 回報框：一按就截圖，自動帶入「第幾天｜場景｜第幾句、說話的人：原文、版本、裝置」，選分類（台詞、畫面、圖、操作、其他，可不選）、寫意見（最多 1000 字），送出；送不出去就存在這台裝置的佇列，之後自動重送。
- 截圖三段退路：完整畫面（被汙染的畫布跳過）→ 不放任何圖 → 自己畫的文字截圖（一定成功）。WebGL 遊戲可以給「遊戲畫面快照」掛勾（例如 Phaser 的 `renderer.snapshot`），第一段會把快照放進遊戲畫布。

核心**與遊戲無關**：遊戲名、存檔鍵、場景名、版本怎麼判斷、圖片網址怎麼改寫，全部由設定傳進來。核心裡的檔案不可以寫任何遊戲專屬的字（有單元測試擋）。

純 ES module JavaScript（JSDoc 註解），瀏覽器直接 `import` 就能用，不用打包；TypeScript 專案用 `index.d.ts`（strict 可用）。

核心版本：`version.js` 的 `CORE_VERSION`。

## 檔案

| 檔案 | 內容 | 碰 DOM？ |
| --- | --- | --- |
| `index.js` | 總入口，re-export 下面全部 | 只 import 不會碰 |
| `index.d.ts` | 型別宣告 | — |
| `version.js` | `CORE_VERSION` | 否 |
| `flag.js` | `debugOn(search, param='debug', value='1')` | 否 |
| `stamp.js` | `taipeiStamp`、`formatVersion`、`versionParts`、`splitVersion`、`BUILD_TIME_RE` | 否 |
| `report.js` | `buildPayload`、`reportText`、`deviceSummary`、`plainText`、`wrapText`、`charUnits`、`firstOk`、`shotErrorText`、`textShotLines`、`rewriteCssUrls`、`shotFits`、`shotScale`、常數（`CATEGORIES`、`COMMENT_MAX`、`SHOT_REV`…） | 否 |
| `queue.js` | `createQueue(key)`（`readQueue`／`writeQueue`／`enqueue`／`submit`／`flush`）、`post`、`exportText`、`withoutOwner`、`RETRY_MS` | 否（storage、fetch 從參數傳） |
| `reset.js` | `keysToClear`、`storageKeys`、`bustUrl`、`ownerStore` | 否 |
| `capture.js` | `capture`、`loadHtml2canvas`、`toJpeg`、`taintCheck` | 是 |
| `ui.js` | `startDebug`、`copyText`、`clearCaches`、`DEFAULT_TEXT` | 是 |
| `manifest-check.js`（＋`.d.ts`） | MANIFEST 的產生與比對（**只在 Node 用**，`index.js` 不會載入） | — |
| `MANIFEST.json` | 每個檔的 sha256、核心版本、來源 commit（同步腳本產生，不要手改） | — |

## 用法

```js
import { debugOn } from './debug/core/flag.js'; // 很小，可以靜態載入

if (debugOn(location.search)) {
  // 其他部分一律動態載入：一般玩家不會下載除錯程式
  const { startDebug } = await import('./debug/core/index.js');
  await startDebug({ /* 設定，見下面 */ });
}
```

`startDebug(options)` 回傳 `Promise<{ root, setFast(on), retry(), close() } | null>`；`version.autoPin()` 回傳 true（正在換頁）時回傳 `null`、不畫面板。

## 設定欄位（`startDebug(options)`）

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `app` | ✔ | 面板掛在哪個元素（要是 `position` 不是 `static` 的容器）。也是預設的截圖範圍、快轉時調 CSS 動畫速度的範圍，快轉時會加上 class `dbg-fast` 與 CSS 變數 `--dbg-time-scale`。 |
| `game` | ✔ | 遊戲代號，送出的 `game` 欄與「複製文字」的標題（`【<game> 回報】`）。收件端用它分遊戲。 |
| `endpoint` |  | 收件網址（字串或回傳字串的函式）；空字串＝還沒設定，回報只存在這台裝置。送法：`POST`、`mode: 'no-cors'`、`Content-Type: text/plain;charset=utf-8`，body 是 `{ key, ...payload }` 的 JSON。 |
| `key` |  | 收件端的密語（放在 body 的 `key`）。**不要寫進核心**，放在遊戲自己的設定檔。 |
| `storageKeys` | ✔ | `{ queue, fast, owner }`：待送佇列、快轉設定、本人識別碼存在 localStorage 的哪個鍵。這三個「清除存檔重來」一定不刪。 |
| `isGameSaveKey(key)` |  | 「清除存檔重來」：這個鍵是不是遊戲存檔，是才刪。沒給就什麼都不刪。 |
| `keepKeys` |  | 絕不刪的鍵（完全相同）。 |
| `keepPrefixes` |  | 絕不刪的鍵的開頭（例如除錯設定共同的開頭）。 |
| `position()` | ✔ | 回傳目前位置 `{ day, scene, line, speaker, text }`。面板「目前位置」、回報框「自動帶入」、文字截圖、送出的回報都用它。`text` 請給純文字（可用 `plainText()` 去標籤）。 |
| `sceneLabel(scene)` |  | 場景的中文名；給了才在位置後面顯示。 |
| `jumpGroups()` |  | 跳關選單：`[{ name, items: [{ scene, label, lines? }] }]`，`name` 是 `<optgroup>`，`lines` 顯示成「（N 句）」。和 `jump` 都給才有「跳到」區塊。 |
| `jump(scene, line)` |  | 跳關；回傳 `false`（或 Promise 的 false）顯示 `text.jumpFail`。 |
| `setTimeScale(k)` |  | 快轉時呼叫 `k = 1/fastRate`，恢復時 `k = 1`。遊戲自己的等待時間、`Phaser` 的 `time.timeScale`／`tweens.timeScale` 在這裡調。 |
| `fastRate` |  | 快轉倍數，預設 5。 |
| `version.display()` | ✔ | 顯示用的版本字串，例如「2026-11-14 20:14:11（70638dd）」（可以用 `formatVersion(commit時間, 短碼)` 組）；送出的 `version` 欄也是它。 |
| `version.parts()` |  | `{ time, hash }`；面板把括號部分畫成小字。沒給就用 `splitVersion(display())`。 |
| `version.note()` |  | 版本旁邊的提示（例如「可能不是最新版」），空字串不顯示。 |
| `version.latest()` |  | 查最新版本，回 `{ id, label }`、字串或 `null`（查不到）。面板顯示「最新版本 <label>」。每次打開面板查一次。 |
| `version.reloadUrl(latest)` |  | 「重新載入最新版」要去的網址（`latest` 是上面的結果或 `null`）。沒給就是目前網址加 `_r=<時間>`。重新載入前一定會清 Cache Storage 與 service worker。 |
| `version.autoPin()` |  | 開機先換到釘版本的網址；回傳 `true`＝正在換頁。 |
| `capture.html2canvasSrc` | ✔ | html2canvas 1.4.1（UMD）的網址，第一次截圖時才載入。 |
| `capture.root` |  | 要截的元素，預設 `app`。 |
| `capture.assetUrl(url)` |  | 截圖時改寫圖片網址（`<img>` 與 CSS 背景圖），例如換成有 CORS 標頭的直連網址，避免畫布被汙染。 |
| `capture.background` |  | 截圖背景色，預設 `#1a1612`。 |
| `capture.ignore(node)` |  | 另外不入鏡的元素（除錯介面本身一律不入鏡）。 |
| `capture.snapshot()` |  | 遊戲畫面快照：回傳畫布、圖片、ImageBitmap、data URL（或它們的 Promise）。WebGL 畫布（`preserveDrawingBuffer: false`）html2canvas 讀不到內容，給了這個掛勾，第一段就在 html2canvas 的複製品裡把快照畫進那張畫布，其他 DOM（HUD、對話框、背景）照常截，前後層次和畫面一樣；快照或這一段失敗就退回一般的完整截圖。 |
| `capture.snapshotMode` |  | `'overlay'`（預設，快照放進畫布＋其他 DOM）或 `'only'`（截圖就是快照本身）。 |
| `capture.snapshotElement()` |  | 快照要放在哪個元素的位置，預設畫面上最大的那張畫布。 |
| `text` |  | 換掉面板上跟遊戲有關的說法：`sceneAria`（跳關選單的無障礙名稱）、`jumpHint`、`jumpFail`、`shotLost`（有畫布被汙染時的提示）。預設值見 `DEFAULT_TEXT`。 |
| `storage` |  | 測試用：換掉 localStorage（`null`＝沒有）。 |
| `retryMs` |  | 自動重送間隔，預設 30000。 |

送出的 JSON 欄位（順序固定）：`time, version, day, scene, line, speaker, text, category, comment, screenshot, device, game, owner`。
`owner`（本人識別碼）只在送出那一刻帶上：不進佇列、不進匯出、不進複製文字、不顯示（面板只顯示「已設定／未設定」）。

### Phaser 3（WebGL）範例

```ts
import { debugOn } from './debug/core/flag.js';

if (debugOn(location.search)) {
  const { startDebug, formatVersion } = await import('./debug/core/index.js');
  await startDebug({
    app: document.getElementById('game-root')!,
    game: '<遊戲代號>',
    endpoint: REPORT_ENDPOINT,
    key: REPORT_KEY,
    storageKeys: { queue: '<前綴>.debug.queue', fast: '<前綴>.debug.fast', owner: '<前綴>.debug.owner' },
    isGameSaveKey: (k) => k.startsWith('<前綴>.'),
    keepPrefixes: ['<前綴>.debug.'],
    position: () => ({ day: '…', scene: '…', line: 0, speaker: '…', text: '…' }),
    setTimeScale: (k) => { game.scene.getScenes(true).forEach((s) => { s.time.timeScale = 1 / k; s.tweens.timeScale = 1 / k; }); },
    version: { display: () => formatVersion(COMMIT_TIME, COMMIT_SHORT) }, // 兩個值由遊戲自己的建置流程產生
    capture: {
      html2canvasSrc: `${import.meta.env.BASE_URL}vendor/html2canvas.min.js`,
      snapshot: () => new Promise((ok) => game.renderer.snapshot((img) => ok(img as HTMLImageElement))),
    },
  });
}
```

（`setTimeScale` 給的 `k` 是「等待時間的倍率」：快轉時是 1/5。Phaser 的 `timeScale` 是速度，所以用 `1 / k`。）

## 在另一個 repo 使用與同步

**正本只有一份**：主要維護的那個遊戲 repo 裡的 `src/debug/core/`。另一個 repo 只放複本，**不要在複本上改**；要改就改正本，再同步過去。

1. 在正本的 repo 改完核心後，重算 MANIFEST：
   `node scripts/sync-debug-core.mjs`
2. 同步到另一個 repo（目標是對方放核心的資料夾）：
   `node scripts/sync-debug-core.mjs ../<另一個遊戲>/src/debug/core`
   會把整個核心複製過去，兩邊各寫一份一樣的 `MANIFEST.json`（每個檔的 sha256、`coreVersion`、來源 commit、來源有沒有未提交的修改）。舊 MANIFEST 列過、正本已經沒有的檔會刪掉。
3. 兩邊各有一個單元測試比對 MANIFEST 與實際檔案（少檔、多檔、內容不同、核心版本不同都會失敗），避免有人只改一邊：

   ```js
   import { checkManifest } from '<路徑>/debug/core/manifest-check.js';
   const r = checkManifest('<核心資料夾的絕對路徑>');
   // r.ok 應為 true；不是的話看 r.missing／r.extra／r.changed／r.versionMismatch
   ```

   雜湊前會把 CRLF 換成 LF，Windows 上 git 自動轉換換行不會誤判。
4. 改了核心的對外行為就改 `version.js` 的 `CORE_VERSION`（只改內部：第三碼；新增設定或函式：第二碼；舊用法會壞：第一碼）。

Vite 專案：`index.js` 與其他瀏覽器檔可以直接 import（Vite 會打包）；`html2canvas.min.js` 放在 `public/vendor/`，`html2canvasSrc` 用 `import.meta.env.BASE_URL` 組。`manifest-check.js` 用了 `node:` 模組，只能在測試（Node／Vitest）裡 import。
