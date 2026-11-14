/**
 * dream-cafe 測試回報收件端（Google Apps Script 網頁應用程式）
 * 遊戲網址帶 ?debug=1 時，面板的「回報問題」會把一筆回報 POST 到這裡：寫進試算表一列，截圖存到雲端硬碟資料夾。
 * 部署步驟見同一個資料夾的「部署說明.md」。
 *
 * 要改的只有下面兩行：
 *   REPORT_KEY      和遊戲 src/debug/config.js 的 REPORT_KEY 一模一樣（不一樣就回 forbidden，不寫入）
 *   SPREADSHEET_ID  留空＝用「這份腳本所在的那份試算表」（從試算表的 擴充功能 > Apps Script 建的就留空）
 */
var REPORT_KEY = 'REPLACE_ME';
var SPREADSHEET_ID = '';
var SHEET_NAME = '回報';
var FOLDER_NAME = 'dream-cafe 回報截圖';
var CELL_MAX = 5000; // 每一格最多幾個字（試算表一格上限五萬字，留短一點好讀）
var HEADERS = ['時間(台北)', '版本', '天', '場景', '句', '說話的人', '原文', '分類', '意見', '截圖連結', '裝置', '狀態', '處理說明'];

function doGet() {
  return ContentService.createTextOutput('dream-cafe report endpoint ok').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return text_('bad json');
  }
  // 密語沒改（還是 REPLACE_ME）也一律拒收：避免忘了改就讓任何人都能寫進來
  if (!data || data.key !== REPORT_KEY || REPORT_KEY === '' || REPORT_KEY === 'REPLACE_ME') return text_('forbidden');

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return text_('busy');
  }
  try {
    var when = parseTime_(data.time);
    var link = '';
    try {
      link = saveShot_(data.screenshot, when, data.scene);
    } catch (err) {
      link = '截圖存檔失敗：' + err;
    }
    var sheet = sheet_();
    sheet.appendRow([
      Utilities.formatDate(when, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'),
      cell_(data.version),
      cell_(data.day),
      cell_(data.scene),
      cell_(data.line),
      cell_(data.speaker),
      cell_(data.text),
      cell_(data.category),
      cell_(data.comment),
      cell_(link),
      cell_(data.device),
      '未處理',
      '',
    ]);
    return text_('ok');
  } finally {
    lock.releaseLock();
  }
}

function text_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

// 回報裡的時間（ISO）；壞掉就用收到的時間
function parseTime_(iso) {
  var d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d : new Date();
}

// 一格的內容：轉成字串、截長度；= + - @ 開頭的前面加 ' ，避免被當成公式
function cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  var s = String(v);
  if (s.length > CELL_MAX) s = s.slice(0, CELL_MAX - 1) + '…';
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

// 工作表：沒有就建，第一列沒有標題就補
function sheet_() {
  var book = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

// 截圖（data:image/jpeg;base64,...）存到雲端硬碟資料夾，設成「知道連結的人可以檢視」，回傳連結；沒有截圖回傳空字串
function saveShot_(dataUrl, when, scene) {
  if (typeof dataUrl !== 'string') return '';
  var m = /^data:(image\/(jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!m) return '';
  var ext = m[2] === 'png' ? 'png' : 'jpg';
  var name = Utilities.formatDate(when, 'Asia/Taipei', 'yyyyMMdd-HHmmss') + '_' + String(scene || 'unknown').replace(/[^\w-]/g, '') + '.' + ext;
  var blob = Utilities.newBlob(Utilities.base64Decode(m[3]), m[1], name);
  var file = folder_().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    // 公司／學校帳號可能不允許公開分享：檔案還是存了，只有你自己看得到
  }
  return file.getUrl();
}

function folder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}
