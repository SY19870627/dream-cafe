// 回報問題送到哪裡（Google Apps Script 網頁應用程式的網址；部署方式見 tools/report-endpoint/部署說明.md）。
// REPORT_ENDPOINT 留空：回報一律先存在這台裝置的佇列裡（面板上可以「複製」匯出）。
// REPORT_KEY 要和 Code.gs 裡的 REPORT_KEY 一模一樣，不然對方回 forbidden、不會寫進表單。
export const REPORT_ENDPOINT = '';
export const REPORT_KEY = 'REPLACE_ME';
