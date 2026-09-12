/* 共通の受け口（games/pad.js）が、どのゲームでも効いているか。

   ジョイパッドと絵の外のタップが、ちゃんとキーに化けて
   ゲームまで届いているかを見る。中身の遊びには踏み込まない。 */
var fs = require("fs");
var path = require("path");
var load = require("../harness");

var root = path.join(__dirname, "..", "..", "..");
var bad = [];
var skipped = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

/* pad.js を読んでいるゲームを、自分で見つける */
var games = fs.readdirSync(path.join(root, "games")).filter(function (n) {
  var f = path.join(root, "games", n, "index.html");
  return fs.existsSync(f) && /src="\.\.\/pad\.js"/.test(fs.readFileSync(f, "utf8"));
}).sort();

if (!games.length) { console.log("pad.js を読んでいるゲームが無い"); process.exit(1); }
console.log("見ているゲーム: " + games.join(", "));
console.log("");

games.forEach(function (id) {
  var file = "games/" + id + "/index.html";

  var g;
  try { g = load(file, { quiet: true, withScripts: true }); }
  catch (e) {
    /* WebGL など、偽のDOMでは動かせないものを使っているゲーム。
       pad.js のせいではないので落とさず、実ブラウザで見るように言う */
    skipped.push(id + "（" + String(e.message).slice(0, 40) + "）");
    console.log("--  " + id + " は台に載らないので未確認。ブラウザで確かめること");
    console.log("");
    return;
  }

  /* 届いたキーを控える */
  var got = [];
  g.win.addEventListener("keydown", function (e) { got.push("↓" + e.key); });
  g.win.addEventListener("keyup", function (e) { got.push("↑" + e.key); });
  function since() { var a = got.slice(); got.length = 0; return a; }

  g.step(5); since();

  /* --- ボタン --- */
  g.pad({ press: true }); g.step(2);
  var a = since();
  ok(id + "  ボタン → スペース", a.indexOf("↓ ") >= 0, a.join(" ") || "なにも来ない");

  g.pad({ press: true }); g.step(2);
  ok(id + "  押しっぱなしで連発しない", since().length === 0);

  g.pad({ press: false }); g.step(2);
  var b = since();
  ok(id + "  離すと キーも離れる", b.indexOf("↑ ") >= 0, b.join(" ") || "なにも来ない");

  /* --- 十字キー --- */
  g.pad({ dx: 1 }); g.step(2);
  var c = since();
  ok(id + "  十字 右 → ArrowRight", c.indexOf("↓ArrowRight") >= 0, c.join(" ") || "なにも来ない");

  g.pad({ dx: -1 }); g.step(2);
  var d = since();
  ok(id + "  右→左 で 右が離れ 左が入る",
     d.indexOf("↑ArrowRight") >= 0 && d.indexOf("↓ArrowLeft") >= 0, d.join(" "));

  g.pad({ dx: 0 }); g.step(2);
  ok(id + "  戻すと 離れる", since().indexOf("↑ArrowLeft") >= 0);

  /* --- 便りが途切れたら離す --- */
  g.pad({ press: true }); since(); g.step(40);
  ok(id + "  便りが途切れたら離した扱い", since().indexOf("↑ ") >= 0);

  /* --- タップは、絵の中も外も、キーには化けさせない --- */
  g.step(5); since();
  g.down(-60, 300); g.step(1); g.up(); g.step(1);
  var e1 = since().filter(function (s) { return s === "↓ " || s === "↑ "; });
  ok(id + "  絵の外のタップは相手にしない", e1.length === 0, e1.join(" "));

  /* --- 絵の中のタップは、化けさせない（ゲーム自身が受けるところ） --- */
  g.step(5); since();
  g.down(270, 300); g.step(1); g.up(); g.step(1);
  var f = since().filter(function (s) { return s === "↓ " || s === "↑ "; });
  ok(id + "  絵の中のタップはキーにしない", f.length === 0, f.join(" "));

  console.log("");
});

if (skipped.length) {
  console.log("台に載らないので未確認（ブラウザで確かめること）:");
  skipped.forEach(function (s) { console.log("  - " + s); });
  console.log("");
}
if (bad.length) {
  console.log("問題:");
  bad.forEach(function (b) { console.log("  - " + b); });
  process.exit(1);
}
console.log("問題なし");
