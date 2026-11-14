// 回報問題送到哪裡（Google Apps Script 網頁應用程式的網址；部署方式見 tools/report-endpoint/部署說明.md）。
// REPORT_ENDPOINT 留空：回報一律先存在這台裝置的佇列裡（面板上可以「複製」匯出）。
// REPORT_KEY 要和 Code.gs 裡的 REPORT_KEY 一模一樣，不然對方回 forbidden、不會寫進表單。
export const REPORT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbww3bKL77hXEaYURdF58_6ECnTh9Lkzj9E2N35C4xIw2WjU0gHgBOAoqKMV3ehjrV45/exec';
export const REPORT_KEY = 'dc-vC36DCZFcCXt5z5OISfACX_z'; // 只是擋亂送的通關字；會出現在公開程式裡，這是已接受的
