/* 無断転載よけ。よそのサイトに埋め込まれたり（iframe）、まるごとコピーされて別のドメインで開かれたら、
   ゲームを止めて「ゾウノアシゲームズで遊ぶ」ボタンだけにする。

   各ゲームの <title> の直後で読む（<script src="../guard.js"></script>）。サイトの index.html は games/guard.js。
   自分たちの場所（本番・固定リンクのプレビュー・Cake Cut・手元の配信・Claude の確認用ページ）では何もしない。
   よそに許可を出すときは HOSTS に足す。 */
(function () {
  "use strict";
  var HOSTS = [
    "zounoashi.com", "www.zounoashi.com", "tomozop.github.io",
    "localhost", "127.0.0.1", "[::1]", "",
    "claude.ai", ".claude.ai", ".claudeusercontent.com", ".claude.site", ".anthropic.com"
  ];
  var HOME = "https://www.zounoashi.com/";

  function okHost(h) {
    h = String(h || "").toLowerCase();
    if (/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h)) return true;  // 家の中のネットワーク（スマホで手元の配信を見る）
    for (var i = 0; i < HOSTS.length; i++) {
      var a = HOSTS[i];
      if (a.charAt(0) === "." ? (h === a.slice(1) || h.slice(-a.length) === a) : h === a) return true;
    }
    return false;
  }
  function hostOf(url) {
    try { return new URL(url).hostname; } catch (e) { return null; }
  }
  function framedOk() {
    if (window.top === window.self) return true;
    var anc = location.ancestorOrigins;
    if (anc && anc.length) {
      for (var i = 0; i < anc.length; i++) if (!okHost(hostOf(anc[i]))) return false;
      return true;
    }
    try { return okHost(window.top.location.hostname); } catch (e) {}
    var ref = hostOf(document.referrer);
    return ref !== null && okHost(ref);
  }
  if (location.protocol === "file:" || (okHost(location.hostname) && framedOk())) return;

  /* ここから先はよその場所。ゲームの読み込みを止めて、本家への入口だけ出す */
  var m = /\/games\/([^\/_][^\/]*)\//.exec(location.pathname);
  var url = HOME + (m ? "#/game/" + m[1] : "");
  var ja = /^ja\b/i.test(navigator.language || "");
  var label = ja ? "ゾウノアシゲームズで遊ぶ" : "Play on Zounoashi Games";
  var title = (document.title || "").replace(/</g, "&lt;");
  try { window.stop(); } catch (e) {}
  document.documentElement.innerHTML =
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + title + '</title><style>' +
    'html,body{margin:0;height:100%;background:#12100e;color:#fff;font-family:system-ui,sans-serif}' +
    'body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:16px;box-sizing:border-box;text-align:center}' +
    'h1{margin:0;font-size:clamp(20px,5vw,32px)}' +
    'a{display:inline-block;padding:14px 28px;border-radius:999px;background:#fff;color:#12100e;border:3px solid #3a2e26;font-weight:700;font-size:18px;text-decoration:none}' +
    '</style></head><body>' + (title ? '<h1>' + title + '</h1>' : '') +
    '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a></body>';
})();
