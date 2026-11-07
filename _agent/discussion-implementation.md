# 實作對照（opus，2026-11-07，v0.1.4）

依 `_agent/discussion-opus-response1.md` 第三節預定變更 1～8 與 `_agent/discussion-round2.md`（fable 第二輪：全部同意、無新歧見）實作。`_agent/fable-discussion.md` 不動。沒有跑測試、git、npm（承峰自己跑）；冒煙測試不改、不截圖。

| # | 檔案 | 實作 | 共識 |
| --- | --- | --- | --- |
| 1 | `src/visits.js` | yuan-v2 選項 a「晚一點會更好看。」、回答「那我晚一點再走。」；kevin-v6「……下次，我帶點東西給龍眼。可以嗎？」；zhe-v2「不缺。待一下再走。」；kevin-v5 選項 b「窗外那片山，看過了嗎？」、第二句「……這麼近。」 | 符合 |
| 2 | `src/visits.js` | missing 德叔：「黑板上現在沒有黑咖啡。」「黑板上現在沒有龍眼乾。」「黑板上現在沒有冰美式。」（接回 yuan-r3／zhe-r2／kevin-r3 共用）；yuan-v4 `look('window'), wait(4)` 之後才是老闆那句 | 符合 |
| 3 | `src/favorites.js` | 凱文第一段 `ok`「……你記得。謝謝。」；`MISS.kevin` 不動 | 符合 |
| 4 | `docs/第一版開發計畫.md` | 1322 行引用的 missing 句改新字；Q159 處理欄補雙方依據，寫「未定，等承峰」，程式維持德叔只照黑板沖 | 符合 |
| 5 | `src/menu.js`、`src/tasting.js` | `kiln.desc`「東山的豆配窯烤龍眼乾。予安小姐在寫的那座龍眼窯，煙大概是這個味道。」、`RECIPES.kiln.served`「東山的豆，配窯烤的龍眼乾。她在寫的那座窯，煙大概是這樣。」；`favorites.js` 照片那句「煙是甜的。」不動；`tasting.js:28` 不動 | 符合 |
| 6 | `_agent/text-edit-audit.md` | 73 行 tasting.js:97「沒改」更正為已是「再叫我一聲」 | 符合 |
| 7 | `docs/人物誌.md:84` | `sitDown` 只在老闆還站著時說，坐著只聽到 `CLOSING.lastCup` | 符合 |
| 8 | `_agent/fable-applied-summary.md` | 19 段 → 20 段（予安 8 含 yuan-r3、阿哲 5、凱文 7） | 符合 |
| — | `tests/unit/visits.test.mjs` | 新增一項測試：上面每一處的新字、舊字不在、missing 只陳述、`wait(4)` 的位置、原句與照片那句不動、新字標【待定】；兩處註解跟著改 | 只改單元 |
| — | `src/version.js`、`index.html` | 0.1.3 → 0.1.4（2026-11-07），`?v=` 24 處同步 | — |

保留不改（雙方同意）：yuan-v2 原句「今天的顏色」、`MISS.kevin` 的「我是說」、`tasting.js:28` 的「甜」、`condOk()` 不加天氣、Q159 不改程式、所有【原句】、D202／D203 照片台詞。

留給承峰：`npm run pending` 重產 `docs/待定文本審稿.md`；`_agent/text-edit-audit.md:85`（「煙是甜的」次序「沒改」）在變更 5 之後同樣落後，不在清單裡，沒動。
