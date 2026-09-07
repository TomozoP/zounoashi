/* ゲーム共通のシェア機能。X（Twitter）の投稿画面を、本文とリンク付きで開く。

     zShare({
       text: "40075.0kmの水切りに成功しました #水切り世界一周",
       done: function (result) { ... }   // "shared" / "opened" / "cancel" / "blocked"
     });

   iframeの中で動いている場合は、埋め込んでいるページのURLを共有する。

   スマホでは、まず端末の共有シート（Web Share）を試す。
   window.open はポップアップとして止められることがあり、
   ボタンを押しても何も起きない端末があるため。
   それも使えないときは新しいタブ、それも開けないときは
   リンクを作って踏ませる、と順に下りていく。 */
(function (global) {
  "use strict";

  function pageUrl() {
    try {
      if (global.parent && global.parent !== global) return global.parent.location.href;
    } catch (e) {}
    return location.href;
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

    if (isPhone() && nav && nav.share) {
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
