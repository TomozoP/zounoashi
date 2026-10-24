/* 表示の言語。ブラウザの言語が日本語以外なら英語にする（韓国語は ko、中国語は簡体字 zh・台湾/香港は繁体字 tw）。

     zT("点でした", "points")              // 今の言語の文字を返す
     zT("点でした", "points", "점", "分", "分")  // 韓国語・簡体字・繁体字も書くとき（繁体字が無ければ簡体字、どれも無ければ英語）
     zLang                                  // "ja" か "en"（ko / zh / tw のときも "en"。ゲーム側は英語扱い）
     zLangFull                              // "ja" "en" "ko" "zh" "tw" のどれか
     zSetLang("en")                         // 切り替えて覚える（読み込み直す）

   確かめるときは URL に ?lang=en / ?lang=ko / ?lang=zh / ?lang=tw / ?lang=ja を付ける。
   サイトの中で開いたゲームは、サイト側の指定を引き継ぐ。
   読み込むと <html lang> も合わせる（ブラウザ翻訳の勧めが的外れにならないように）。 */
(function (global) {
  "use strict";

  function pick(search) {
    var m = /[?&]lang=(ja|en|ko|zh|tw)\b/.exec(search || "");
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
      if (/^(ja|en|ko|zh|tw)$/.test(saved)) return saved;
    } catch (e) {}
    var n = global.navigator || {};
    var first = (n.languages && n.languages[0]) || n.language || "ja";
    return /^ja\b/i.test(first) ? "ja" : /^ko\b/i.test(first) ? "ko" : /^zh\b/i.test(first) ? (/^zh-(tw|hk|mo|hant)\b/i.test(first) ? "tw" : "zh") : "en";
  }

  var full = detect();
  var lang = full === "ja" ? "ja" : "en";
  global.zLang = lang;
  global.zLangFull = full;
  global.zSetLang = function (next) {
    try { global.localStorage.setItem("zLang", next); } catch (e) {}
    /* サイトの中で開いたゲームからは、サイトごと切り替える（上のバーや一覧も揃える） */
    try {
      if (global.parent && global.parent !== global && global.parent.zSetLang) { global.parent.zSetLang(next); return; }
    } catch (e) {}
    /* URL の指定が残っていると切り替わらないので外す */
    var url = new URL(global.location.href);
    url.searchParams.delete("lang");
    var hash = url.hash.replace(/([?&])lang=(ja|en|ko|zh|tw)&?/, "$1").replace(/[?&]$/, "");
    try { global.history.replaceState(null, "", url.pathname + url.search + hash); } catch (e) {}
    global.location.reload();
  };
  global.zT = function (ja, en, ko, zh, tw) {
    if (full === "ko" && ko != null) return ko;
    if (full === "tw" && tw != null) return tw;
    if ((full === "zh" || full === "tw") && zh != null) return zh;
    return lang === "ja" || en == null ? ja : en;
  };
  var doc = global.document;
  if (doc && doc.documentElement) doc.documentElement.lang = full === "zh" ? "zh-CN" : full === "tw" ? "zh-TW" : full;

  /* 結果画面などの共通ボタンの読み上げ名は、ここでまとめて英語（韓国語・中国語）にする */
  var LABELS = {
    "Xでシェア": ["Share on X", "X에 공유", "分享到 X", "分享到 X"],
    "もう一度": ["Retry", "다시 하기", "再来一次", "再來一次"],
    "次": ["Next", "다음", "下一个", "下一個"],
    "次へ": ["Next", "다음", "下一个", "下一個"],
    "作者をフォロー": ["Follow the creator", "제작자 팔로우", "关注作者", "追蹤作者"]
  };
  function labels() {
    doc.querySelectorAll("[aria-label]").forEach(function (el) {
      var t = LABELS[el.getAttribute("aria-label")];
      if (t) el.setAttribute("aria-label", global.zT(null, t[0], t[1], t[2], t[3]));
    });
  }
  if (lang === "en" && doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", labels);
    else labels();
  }
})(window);
