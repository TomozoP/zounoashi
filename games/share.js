/* ゲーム共通のシェア機能。X（Twitter）の投稿画面を、本文とリンク付きで開く。

     zShare({
       text: "40075.0kmの水切りに成功しました #水切り世界一周",
       done: function (result) { ... }   // "opened" / "blocked"
     });

   iframeの中で動いている場合は、埋め込んでいるページのURLを共有する。 */
(function (global) {
  "use strict";

  function pageUrl() {
    try {
      if (global.parent && global.parent !== global) return global.parent.location.href;
    } catch (e) {}
    return location.href;
  }

  global.zShare = function (opt) {
    opt = opt || {};
    var to = "https://x.com/intent/post?text=" + encodeURIComponent(opt.text || "") +
             "&url=" + encodeURIComponent(pageUrl());
    var w = null;
    try { w = global.open(to, "_blank", "noopener"); } catch (e) {}
    if (opt.done) opt.done(w ? "opened" : "blocked");
  };
})(window);
