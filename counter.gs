/* ===========================================================================
   ゾウノアシゲームズ プレイ数カウンター（Google Apps Script）

   ■ 置きかた
     1. Googleスプレッドシートを新規作成する
        ★ カウンター専用の、まっさらなものを使ってください。
          このスクリプトは「そのスプレッドシート」に紐づいて動きます。
     2. 拡張機能 → Apps Script を開き、このファイルの中身をぜんぶ貼り付ける
     3. 「デプロイ」→「新しいデプロイ」→ 種類は「ウェブアプリ」
          次のユーザーとして実行 : 自分
          アクセスできるユーザー : 全員
     4. 出てきた .../exec で終わるURLを index.html の COUNTER_URL に貼る

   ■ できること（どちらも GET）
     <URL>                → { "ゲームid": 回数, ... } を全部返す（数えない）
     <URL>?hit=ゲームid   → そのゲームを1増やして、増えたあとの数を返す

   ■ 公開して大丈夫なこと・注意すること
     URLはサイトのHTMLに書くので誰でも見えます。それでも見られるのは
     ゲームIDと回数だけで、スプレッドシート自体は開けません。
     ただし誰でも叩けるので、回数は「だいたいの目安」です。
     このプロジェクトには他のコードを足さないでください（権限が広がります）。

   counts シートに id と count が並ぶので、数字は手で直せます。
   コードを直したときは、もう一度デプロイし直すと反映されます。
   =========================================================================== */

var SHEET_NAME = "counts";
var MAX_IDS = 200;                    // 知らないIDで行が際限なく増えないように
var ID_OK = /^[a-z0-9][a-z0-9_-]{0,39}$/;   // ゲームIDとして認める形

/* 動作確認用。エディタの「実行」でこれを選ぶと、
   スプレッドシートとつながっているか確かめられます。 */
function test() {
  var sh = sheet_();
  Logger.log("シート「" + sh.getName() + "」につながりました");
  Logger.log(readAll_(sh));
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      "スプレッドシートにつながっていません。" +
      "スプレッドシートを開いて「拡張機能 → Apps Script」から作り直してください。");
  }
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, 2).setValues([["id", "count"]]);
  }
  return sh;
}

/* シート全体を { id: 回数 } にして返す */
function readAll_(sh) {
  var out = {};
  var last = sh.getLastRow();
  if (last < 2) return out;
  var rows = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    var id = String(rows[i][0]).trim();
    if (id) out[id] = Number(rows[i][1]) || 0;
  }
  return out;
}

/* id の行番号を返す。無ければ末尾に作る。これ以上増やせないときは 0 */
function rowOf_(sh, id) {
  var last = sh.getLastRow();
  if (last >= 2) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) return i + 2;
    }
    if (last - 1 >= MAX_IDS) return 0;
  }
  var row = Math.max(last, 1) + 1;
  sh.getRange(row, 1, 1, 2).setValues([[id, 0]]);
  return row;
}

function doGet(e) {
  var id = (e && e.parameter && e.parameter.hit) ? String(e.parameter.hit).trim() : "";
  if (id && !ID_OK.test(id)) id = "";     // 変な文字列は数えない
  var sh = sheet_();
  var out = {};

  if (id) {
    /* 同時にアクセスされても数え落とさないように、ここだけ順番待ちにする */
    var lock = LockService.getScriptLock();
    try { lock.waitLock(10000); } catch (err) {}
    try {
      var row = rowOf_(sh, id);
      if (row) {
        var n = (Number(sh.getRange(row, 2).getValue()) || 0) + 1;
        sh.getRange(row, 2).setValue(n);
        SpreadsheetApp.flush();
        out[id] = n;
      }
    } finally {
      try { lock.releaseLock(); } catch (err) {}
    }
  } else {
    out = readAll_(sh);
  }

  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
