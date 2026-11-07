// 遊戲版本（承峰 11/7：加不干擾畫面的小字版本號，方便確認更新；後來「順便把版本號改在記事本裡面」）
// - 整個遊戲唯一的版本號就是這裡的 GAME_VERSION；記事本最底下的小字（main.js 的 #nb-version）從這裡讀。
// - index.html 載入 JS 時加的 ?v= 也要和這裡一樣（main.js 的 <script src> 與 importmap 裡每個子模組），
//   tests/unit/version.test.mjs 會檢查兩邊對得上。
// - 每次 commit 前遞增（規則見 AGENTS.md「協作慣例」）：修正與小調整加 PATCH（0.1.0 → 0.1.1），
//   新功能或新段落加 MINOR、PATCH 歸零（0.1.1 → 0.2.6）；GAME_VERSION_DATE 改成當天日期。
// 純資料，不依賴 Three.js 或 DOM。
export const GAME_VERSION = '0.2.6';
export const GAME_VERSION_DATE = '2026-11-07';

// 記事本最底下顯示的字：v0.2.6・2026-11-07
export const versionLabel = () => `v${GAME_VERSION}・${GAME_VERSION_DATE}`;
