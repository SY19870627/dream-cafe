# 夢想咖啡店（dream-cafe）

> **現行規格：[`docs/規格書.md`](docs/規格書.md)**（v2，一小時短篇）。  
> 第一版已作廢；舊程式與舊文件在 [`legacy/`](legacy/)，只供參考。

你辭掉工作，在台南東山接手一間空店：親手佈置、定菜單、設計咖啡，看客人被店吸引、慢慢變成熟客；最後店有了自己的樣子，交給下一任店長。

- 手機直立、繁體中文、網頁版
- 全長約 60 分鐘（序章 + 9 章）
- **不是經營遊戲**：沒有營收、翻桌率、舒適度分數
- 玩法核心是**佈置**（整組角落、格子、碰撞、留路）

## 給接手的人／AI

1. 先讀 [`AGENTS.md`](AGENTS.md) 與 [`docs/規格書.md`](docs/規格書.md)
2. 人物設定讀 [`docs/人物誌.md`](docs/人物誌.md)
3. 需要開場四幕台詞或舊實作時，再查 [`legacy/README.md`](legacy/README.md)
4. **不要**在 `legacy/src/` 上繼續開發第二版

## 目前狀態

第二版雛形尚未實作（規格書「第一個雛形」：序章～第 2 章）。  
根目錄的 `assets/art/`（畫師美術）與 `vendor/`（Three.js）保留給新版沿用。

線上 GitHub Pages 目前仍從 **main** 根目錄發布第一版試玩。本分支（`chore/cleanup-v2`）若合併進 main，根目錄將不再有可玩的第一版（已移到 `legacy/`），Pages 會變成下面的重建說明頁，除非另外處理。

## 本機

```bash
npm install
npm run serve   # http://127.0.0.1:8000
```

第一版可玩複本在 `legacy/`（需自行用靜態伺服器指到該目錄或暫時改路徑）。第二版測試會依規格書重建（Node 測 grid／sim；Playwright 390×844 截圖）。

## 授權

見 [LICENSE](LICENSE)。
