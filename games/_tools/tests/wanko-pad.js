/* わんこボマーの、ジョイパッドと「絵の外は相手にしない」の確かめ。

   絵の外（上下左右の黒い余白）を叩いても、何も起きないのが正解です。
   ボタンでないところを押して何か起きるのはおかしい、ということで
   一度入れたものをやめた経緯があります。 */
var load = require("../harness");
var FILE = "games/wanko/index.html";
var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

/* その仕掛けが出るまで作り直す */
function fresh(kind) {
  for (var i = 0; i < 300; i++) {
    var g = load(FILE, { quiet: true });
    g.until(function () { return g.probe.now().state === "play"; }, 300);
    if (g.probe.now().key === kind) return g;
  }
  return null;
}
function need(kind) {
  var g = fresh(kind);
  if (!g) bad.push(kind + " の面が引けない");
  return g;
}

var ALL = ["wire", "color", "sw", "screw", "keypad", "trace", "dial", "pump", "hold", "time"];

/* ---- 絵の外 ---- */
console.log("■ 絵の外のタップ（何も起きないのが正解）");
ALL.forEach(function (kind) {
  var g = need(kind);
  if (!g) return;
  var s0 = g.probe.now();
  for (var i = 0; i < 20; i++) {                   /* 四方の余白をひととおり */
    g.tap(-80, 400); g.tap(620, 400); g.tap(270, -100); g.tap(270, g.H + 100);
    g.step(1);
  }
  var s1 = g.probe.now();
  ok(kind + " は余白を叩いても動かない",
     s1.state === s0.state && s1.score === s0.score, s1.state + " / 皿 " + s1.score);
});

/* 端ちょうどは中（0 と W/H はゲームの中） */
(function () {
  var g = need("pump");
  if (!g) return;
  var before = g.probe.now().score;
  for (var i = 0; i < 30; i++) { g.tap(0, 0); g.step(2); }
  ok("左上の角（0,0）は中として効く", g.probe.now().score > before,
     "皿 " + before + " → " + g.probe.now().score);
})();

/* ---- ジョイパッド ---- */
console.log("");
console.log("■ ジョイパッド");
(function () {
  var g = need("pump");
  if (!g) return;
  var before = g.probe.now().score;
  for (var i = 0; i < 30; i++) {
    g.pad({ press: true }); g.step(2);
    g.pad({ press: false }); g.step(2);
    if (g.probe.now().score > before) break;
  }
  ok("ボタンで連打の面が進む", g.probe.now().score > before,
     "皿 " + before + " → " + g.probe.now().score);
})();

(function () {
  var g = need("pump");
  if (!g) return;
  var before = g.probe.now().score;
  for (var i = 0; i < 120; i++) { g.pad({ press: true }); g.step(1); }   /* 押しっぱなし */
  ok("押しっぱなしでは連打にならない", g.probe.now().score === before,
     "皿 " + before + " → " + g.probe.now().score);
})();

/* 長押しの面は「離した」ときに判定が出る。動きが出れば伝わった証拠 */
(function () {
  var g = need("hold");
  if (!g) return;
  g.pad({ press: true });                          /* 押して、そのあと送らない */
  var frames = 0;
  g.until(function () { frames++; return g.probe.now().state !== "play"; }, 60);
  var v = g.probe.now();
  ok("便りが途切れたら離した扱いになる", v.state !== "play" && frames < 50,
     v.state + " / " + frames + "コマ（導火線は174コマ以上）");
})();

(function () {
  var g = need("keypad");
  if (!g) return;
  g.pad({ dx: 1 }); g.step(2);
  g.pad({ dx: 0 }); g.step(2);
  ok("十字キーを入れても壊れない", g.probe.now().state === "play", g.probe.now().state);
})();

(function () {
  var g = need("time");                            /* 結果画面でボタン → やり直し */
  if (!g) return;
  g.until(function () { return g.probe.now().state === "result"; }, 3000);
  if (g.probe.now().state !== "result") { bad.push("結果画面まで行かない"); return; }
  g.pad({ press: true }); g.step(2);
  g.pad({ press: false }); g.step(2);
  ok("結果画面でボタンを押すとやり直せる", g.probe.now().state !== "result",
     g.probe.now().state);
})();

console.log("");
if (bad.length) {
  console.log("問題:");
  bad.forEach(function (b) { console.log("  - " + b); });
  process.exit(1);
}
console.log("問題なし");
