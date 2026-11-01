/* ===========================================================================
   ゾウノアシゲームズ 体重・体脂肪ログ（Google Apps Script）

   iPhone の「ショートカット」がヘルスケアの体重・体脂肪率を毎日ここへ送り、
   サイトの /health/ ページがここから読んでグラフにします。

   ■ 置きかた
     1. Googleスプレッドシートを新規作成する（体重ログ専用の、まっさらなもの）
     2. 拡張機能 → Apps Script を開き、このファイルの中身をぜんぶ貼り付ける
     3. エディタの「実行」で setup を選んで1回実行する
        → 実行ログに「合言葉」が出ます。ショートカットに書くので控えておく
     4. 「デプロイ」→「新しいデプロイ」→ 種類は「ウェブアプリ」
          次のユーザーとして実行 : 自分
          アクセスできるユーザー : 全員
     5. 出てきた .../exec で終わるURLを health/index.html の HEALTH_URL に貼る

   ■ できること（どちらも GET）
     <URL>                                  → 記録を全部返す（読むだけ）
     <URL>?key=合言葉&w=72.4&f=21.3        → 今日の分として書く（同じ日は上書き）
     <URL>?key=合言葉&w=72.4&f=21.3&d=2026-11-01  → 日付を指定して書く

   ■ 公開して大丈夫なこと
     読むのは誰でもできます（サイトに出す数字なので）。
     書くには合言葉が必要です。合言葉はサイトには書かず、ショートカットにだけ書きます。
     数字は log シートで手で直せます。
   =========================================================================== */

var SHEET_NAME = "log";

function setup() {
  var p = PropertiesService.getScriptProperties();
  var key = p.getProperty("KEY");
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, "").slice(0, 16);
    p.setProperty("KEY", key);
  }
  sheet_();
  Logger.log("合言葉: " + key);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["date", "weight", "fat"]);
    sh.getRange("A:A").setNumberFormat("@");
  }
  return sh;
}

function num_(v) {
  if (v === undefined || v === null || v === "") return "";
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : "";
}

function doGet(e) {
  var q = (e && e.parameter) || {};
  var sh = sheet_();
  if (q.key) {
    var key = PropertiesService.getScriptProperties().getProperty("KEY");
    if (!key || q.key !== key) return json_({ ok: false, error: "key" });
    var d = /^\d{4}-\d{2}-\d{2}$/.test(q.d || "") ? q.d
      : Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
    var w = num_(q.w), f = num_(q.f);
    if (f !== "" && f > 0 && f < 1) f = Math.round(f * 1000) / 10; // 0.213 → 21.3
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var vals = sh.getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        var vd = vals[i][0] instanceof Date ? Utilities.formatDate(vals[i][0], "Asia/Tokyo", "yyyy-MM-dd") : String(vals[i][0]);
        if (vd === d) {
          sh.getRange(i + 1, 2, 1, 2).setValues([[w === "" ? vals[i][1] : w, f === "" ? vals[i][2] : f]]);
          return json_({ ok: true, date: d, weight: w, fat: f, updated: true });
        }
      }
      sh.appendRow([d, w, f]);
    } finally { lock.releaseLock(); }
    return json_({ ok: true, date: d, weight: w, fat: f });
  }
  var rows = sh.getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      var d = r[0] instanceof Date ? Utilities.formatDate(r[0], "Asia/Tokyo", "yyyy-MM-dd") : String(r[0]);
      return [d, num_(r[1]), num_(r[2])];
    })
    .sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  return json_({ ok: true, data: rows });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
