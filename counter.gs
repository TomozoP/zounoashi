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

   ■ Googleアナリティクスに切り替えたあと（index.html の GA_ID を入れたあと）
     開いた回数はアナリティクスが数えるので、?hit= では数えなくなります。
     カードの数字は「counts シートの数（切り替えまでの分）＋ 切り替え日からのアナリティクスの数」で、
     1日1回 dailyUpdate が作り直します。置きかた：
       1. 下の GA_PROPERTY_ID にアナリティクスのプロパティID（数字だけ）、
          GA_START に切り替えた日（"2026-10-08" の形）を書く
       2. エディタ左の「サービス ＋」から「Google Analytics Data API」を足す（ID は AnalyticsData のまま）
       3. エディタの「実行」で setupDaily を選んで1回実行し、出てくる許可を通す
          （毎朝4時ごろに dailyUpdate が動くようになり、その場で1回作り直します）
       4. デプロイを管理 → 新バージョン で反映する

   counts シートに id と count が並ぶので、数字は手で直せます。
   コードを直したときは「デプロイ → デプロイを管理 → 鉛筆 → バージョン：新バージョン → デプロイ」で
   反映します（「新しいデプロイ」だとURLが変わるので使わない）。
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

/* 全部の回数は5分のあいだ控えに置き、毎回スプレッドシートを読まない。
   1回の実行を短くして、同時に動く数（上限1000）を増やさないため */
/* アナリティクスに切り替えたら書く（上の説明を参照）。空なら前のとおり ?hit= で数える */
var GA_PROPERTY_ID = "";
var GA_START = "";

var CACHE_KEY = "all";
var CACHE_SEC = 300;

function doGet(e) {
  var id = (e && e.parameter && e.parameter.hit) ? String(e.parameter.hit).trim() : "";
  if (id && !ID_OK.test(id)) id = "";     // 変な文字列は数えない
  var cache = CacheService.getScriptCache();
  var out = {};

  if (GA_PROPERTY_ID) {
    /* 切り替え後は数えずに、1日1回作った数を返すだけ */
    var made = PropertiesService.getScriptProperties().getProperty("totals");
    return ContentService.createTextOutput(made || JSON.stringify(readAll_(sheet_())))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (id) {
    /* 同時にアクセスされても数え落とさないように、ここだけ順番待ちにする。
       長く待つと待っている実行が積み重なって上限に近づくので、
       少し待って空かなければその1回は数えずにあきらめる */
    var lock = LockService.getScriptLock();
    if (lock.tryLock(2000)) {
      try {
        var sh = sheet_();
        var row = rowOf_(sh, id);
        if (row) {
          var n = (Number(sh.getRange(row, 2).getValue()) || 0) + 1;
          sh.getRange(row, 2).setValue(n);
          SpreadsheetApp.flush();
          out[id] = n;
          var kept = cache.get(CACHE_KEY);
          if (kept) {
            var all = JSON.parse(kept);
            all[id] = n;
            cache.put(CACHE_KEY, JSON.stringify(all), CACHE_SEC);
          }
        }
      } finally {
        lock.releaseLock();
      }
    }
  } else {
    var text = cache.get(CACHE_KEY);
    if (!text) {
      text = JSON.stringify(readAll_(sheet_()));
      cache.put(CACHE_KEY, text, CACHE_SEC);
    }
    return ContentService.createTextOutput(text)
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/* アナリティクスの「play_ゲームid」の回数を数えて、counts シートの数に足したものを覚えておく。
   イベント名では「-」が「_」になっているので、シートのidと照らし合わせて元に戻す */
function dailyUpdate() {
  var base = readAll_(sheet_());
  var back = {};
  for (var k in base) back[k.replace(/-/g, "_")] = k;

  var res = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: GA_START, endDate: "today" }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "BEGINS_WITH", value: "play_" } } },
    limit: 1000
  }, "properties/" + GA_PROPERTY_ID);

  var out = {};
  for (var b in base) out[b] = base[b];
  (res.rows || []).forEach(function (r) {
    var key = r.dimensionValues[0].value.slice(5);
    var id = back[key] || key;
    out[id] = (out[id] || 0) + (Number(r.metricValues[0].value) || 0);
  });
  PropertiesService.getScriptProperties().setProperty("totals", JSON.stringify(out));
  Logger.log(out);
}

/* 毎朝 dailyUpdate が動くようにする。何度実行しても1つだけになる */
function setupDaily() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "dailyUpdate") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("dailyUpdate").timeBased().everyDays(1).atHour(4).create();
  dailyUpdate();
}
