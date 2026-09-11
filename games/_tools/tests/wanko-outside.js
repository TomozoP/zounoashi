/* 絵の外（上下左右の黒い余白）のタップと、ジョイパッドの効きを確かめる。
   ねらいの要る面は外では効かない＝誤爆しない、が大事なところ。 */
var load = require("../harness");
var FILE = "games/wanko/index.html";
var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

/* その仕掛けが出るまで作り直す（TYPE_KEYS は覗き穴から触らない方針なので、引くまで回す） */
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

/* ---- 余白のタップ ---- */
console.log("■ 余白のタップ");
/* 押すだけの面は、余白でも「触った」ことが伝わればよい。
   でたらめに押しているので、解けても間違えて爆発してもかまわない。
   導火線が尽きるより早く動きが出たことを、コマ数で見る */
["pump", "hold", "time"].forEach(function (kind) {
  var g = need(kind);
  if (!g) return;
  var before = g.probe.now().score, frames = 0, moved = false;
  for (var i = 0; i < 30 && !moved; i++) {
    g.down(270, -120);                                      /* 絵の上の余白 */
    if (kind === "hold") { g.step(20); frames += 20; }       /* 長押しは少し溜める */
    g.up();
    g.step(2); frames += 2;
    var v = g.probe.now();
    moved = v.score > before || v.state !== "play";
  }
  var w = g.probe.now();
  ok("余白を叩くと " + kind + " に届く", moved && frames < 150,
     "皿 " + before + " → " + w.score + " / " + w.state + " / " + frames + "コマ（導火線は174コマ以上）");
});

["wire", "color", "sw", "screw", "keypad", "trace", "dial"].forEach(function (kind) {
  var g = need(kind);                                       /* ねらいの要る面 */
  if (!g) return;
  var s0 = g.probe.now();
  for (var i = 0; i < 20; i++) {                            /* 四方の余白をひととおり */
    g.tap(-80, 400); g.tap(620, 400); g.tap(270, -100); g.tap(270, g.H + 100);
    g.step(1);
  }
  var s1 = g.probe.now();
  ok("余白を叩いても " + kind + " は動かない（誤爆しない）",
     s1.state === s0.state && s1.score === s0.score, s1.state);
});

/* 端ちょうどは中扱い（0 と W/H はゲームの中） */
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
    g.pad({ press: true }); g.step(2);                      /* 押す */
    g.pad({ press: false }); g.step(2);                     /* 離す */
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

/* パッドの便りが途切れたら、押したままにせず離した扱いにする。
   長押しの面は「離した」ときに判定が出るので、動きが出れば伝わった証拠 */
(function () {
  var g = need("hold");
  if (!g) return;
  g.pad({ press: true });                                   /* 押して、そのあと送らない */
  var frames = 0;
  g.until(function () { frames++; return g.probe.now().state !== "play"; }, 60);
  var v = g.probe.now();
  ok("便りが途切れたら離した扱いになる", v.state !== "play" && frames < 50,
     v.state + " / " + frames + "コマ（導火線は174コマ以上）");
})();

(function () {
  var g = need("keypad");                                   /* 十字キーで選ぶところが動くか */
  if (!g) return;
  var before = JSON.stringify(g.probe.spots());
  g.pad({ dx: 1 }); g.step(2);
  g.pad({ dx: 0 }); g.step(2);
  var v = g.probe.now();
  ok("十字キーを入れても壊れない", v.state === "play" && !!before, v.state);
})();

(function () {
  var g = need("time");                                     /* 結果画面でボタン → やり直し */
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
