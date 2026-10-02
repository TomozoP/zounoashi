/* 表示の言語。ブラウザの言語が日本語以外なら英語にする。

     zT("点でした", "points")   // 今の言語の文字を返す
     zLang                       // "ja" か "en"
     zSetLang("en")              // 切り替えて覚える（読み込み直す）

   確かめるときは URL に ?lang=en / ?lang=ja を付ける。
   サイトの中で開いたゲームは、サイト側の指定を引き継ぐ。
   読み込むと <html lang> も合わせる（ブラウザ翻訳の勧めが的外れにならないように）。 */
(function (global) {
  "use strict";

  function pick(search) {
    var m = /[?&]lang=(ja|en)\b/.exec(search || "");
    return m ? m[1] : null;
  }
  function detect() {
    var own = pick(global.location.search);
    if (own) return own;
    try {
      if (global.parent && global.parent !== global) {
        var loc = global.parent.location;
        var parent = pick(loc.search) || pick(loc.hash.slice(loc.hash.indexOf("?")));
        if (parent) return parent;
      }
    } catch (e) {}
    try {
      var saved = global.localStorage.getItem("zLang");
      if (saved === "ja" || saved === "en") return saved;
    } catch (e) {}
    var n = global.navigator || {};
    var first = (n.languages && n.languages[0]) || n.language || "ja";
    return /^ja\b/i.test(first) ? "ja" : "en";
  }

  var lang = detect();
  global.zLang = lang;
  global.zSetLang = function (next) {
    try { global.localStorage.setItem("zLang", next); } catch (e) {}
    /* サイトの中で開いたゲームからは、サイトごと切り替える（上のバーや一覧も揃える） */
    try {
      if (global.parent && global.parent !== global && global.parent.zSetLang) { global.parent.zSetLang(next); return; }
    } catch (e) {}
    /* URL の指定が残っていると切り替わらないので外す */
    var url = new URL(global.location.href);
    url.searchParams.delete("lang");
    var hash = url.hash.replace(/([?&])lang=(ja|en)&?/, "$1").replace(/[?&]$/, "");
    try { global.history.replaceState(null, "", url.pathname + url.search + hash); } catch (e) {}
    global.location.reload();
  };
  global.zT = function (ja, en) { return lang === "ja" || en == null ? ja : en; };
  var doc = global.document;
  if (doc && doc.documentElement) doc.documentElement.lang = lang;

  /* 結果画面などの共通ボタンの読み上げ名は、ここでまとめて英語にする */
  var LABELS = { "Xでシェア": "Share on X", "もう一度": "Retry", "次": "Next", "次へ": "Next" };
  function labels() {
    doc.querySelectorAll("[aria-label]").forEach(function (el) {
      var en = LABELS[el.getAttribute("aria-label")];
      if (en) el.setAttribute("aria-label", en);
    });
  }
  if (lang === "en" && doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", labels);
    else labels();
  }
})(window);
