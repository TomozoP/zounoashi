/* ゲーム共通のシェア機能。X（Twitter）の投稿画面を、本文とリンク付きで開く。

     zShare({
       text: "40075.0kmの水切りに成功しました #水切り世界一周",
       native: false,                    // 端末の共有シートを使わず、Xの投稿画面を直接開く
       done: function (result) { ... }   // "shared" / "opened" / "cancel" / "blocked"
     });

   公開ゲームはタイトルとサムネのある共有ページを使う。
   下書きなどは、埋め込んでいるページのURLを共有する。

   スマホでは、まず端末の共有シート（Web Share）を試す。
   window.open はポップアップとして止められることがあり、
   ボタンを押しても何も起きない端末があるため。
   それも使えないときは新しいタブ、それも開けないときは
   リンクを作って踏ませる、と順に下りていく。 */
(function (global) {
  "use strict";

  function pageUrl() {
    var game = global.location.pathname.match(/^\/games\/([a-z0-9-]+)\/(?:index\.html)?$/);
    var current = global.location.href;
    try {
      if (global.parent && global.parent !== global) current = global.parent.location.href;
    } catch (e) {}
    if (!game) return current;
    var page = new URL(current);
    var query = page.hash.indexOf("#/game/" + game[1]) === 0
      ? page.hash.slice(page.hash.indexOf("?")) : page.search;
    if (query.charAt(0) !== "?") query = "";
    var params = new URLSearchParams(query);
    params.delete("v");
    /* 大きいカードの保存済み表示を避け、確認済みの正方形カードのURLを使う。 */
    params.set("card", "square2");
    var search = params.toString();
    return global.location.origin + "/share/" + game[1] + "/" + (search ? "?" + search : "");
  }

  function isPhone() {
    var n = global.navigator || {};
    var ua = n.userAgent || "";
    if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
    return (n.maxTouchPoints || 0) > 1 && /Mac/i.test(n.platform || "");   // iPadOS
  }

  /* 新しいタブで開く。開けなければリンクを作って踏ませる */
  function openTab(url, done) {
    var w = null;
    try { w = global.open(url, "_blank"); } catch (e) {}
    if (w) {
      try { w.opener = null; } catch (e) {}
      done("opened");
      return;
    }
    try {
      var a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
      done("opened");
      return;
    } catch (e) {}
    done("blocked");
  }

  global.zShare = function (opt) {
    opt = opt || {};
    var text = opt.text || "";
    var url = pageUrl();
    var to = "https://x.com/intent/post?text=" + encodeURIComponent(text) +
             "&url=" + encodeURIComponent(url);
    var done = opt.done || function () {};
    var nav = global.navigator;

    if (opt.native !== false && isPhone() && nav && nav.share) {
      try {
        var p = nav.share({ text: text, url: url });
        if (p && p.then) {
          p.then(function () { done("shared"); }, function (e) {
            if (e && e.name === "AbortError") { done("cancel"); return; }
            openTab(to, done);                    // 共有シートが出せなければ従来どおり
          });
          return;
        }
      } catch (e) {}
    }
    openTab(to, done);
  };
})(window);
