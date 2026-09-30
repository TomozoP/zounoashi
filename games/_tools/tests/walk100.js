/* 100歳ウォーク。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/walk100.js

   見るところ
   ・開始画面では歩かない。スペースを離すと0歳（ハイハイ）から始まる
   ・押さなければ転ばずにその場にいる（赤ちゃん・幼児・大人・杖の老人）
   ・進むほど年をとる。1歳で立ち、背が伸び、70歳で杖をつく
   ・見ながら押す人のまねで、大人の年齢まで歩ける。100歳まで歩けることもある
   ・歩き続けないと転ぶ（一歩で止まると体の流れを止めきれない）。転ぶとその年齢（歳）が結果になる
   ・Esc で最初から */

var load = require("../harness");
var FILE = process.argv[2] || (require("fs").existsSync("games/walk100/index.html") ? "games/walk100/index.html" : "games/_walk100/index.html");

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

// サムネ撮影用の関数で、好きな年齢の体から始められるようにする（テストだけ）。
var g = load(FILE, { withScripts: true, quiet: true, inject: "window.__probe.jump = function (a) { window.__thumbnail({ age: a }); };" });
g.view(390, 844);
g.step(60);
var n = g.probe.now();
ok("開始画面では歩かない", n.state === "intro" && Math.abs(n.x) < 0.3, n.x.toFixed(2));
g.key(" "); g.key(" ", true);
g.step(2);
n = g.probe.now();
ok("0歳のハイハイから始まる", n.state === "play" && n.form === "baby" && n.age < 0.1);

// 押さないで立っているだけなら転ばない。
[0, 2, 30, 90].forEach(function (a) {
  g.probe.reset();
  if (a) g.probe.jump(a);
  g.step(60 * 4);
  n = g.probe.now();
  ok(a + "歳は押さなければ転ばない", n.state === "play" && !n.fallen, n.x.toFixed(2));
});

// 見ながら押す人のまね。振り出した手足が着いてから少し待って押し、決めた時間だけ押す。
function play(delay, hold, limit) {
  g.probe.reset();
  var frames = 0, pressedAt = -1, landedAt = -1, seen = { stood: false, cane: false }, k = 1;
  while (frames < limit * 60) {
    n = g.probe.now();
    if (n.state !== "play") break;
    if (n.form === "biped") seen.stood = true;
    if (n.cane) seen.cane = true;
    if (pressedAt >= 0 && frames - pressedAt >= hold * k * 60) { g.key(" ", true); pressedAt = -1; }
    if (pressedAt < 0) {
      if (!n.landed) landedAt = -1;
      else if (landedAt < 0) landedAt = frames;
      if (landedAt >= 0 && frames - landedAt >= delay * k * 60) { g.key(" "); pressedAt = frames; landedAt = -1; }
    }
    g.step(1);
    frames++;
  }
  g.step(150);
  return { n: g.probe.now(), seen: seen };
}
var results = [[0, 0.3], [0.1, 0.35], [0.05, 0.2], [0.15, 0.4]].map(function (r) { return play(r[0], r[1], 200); });
results.forEach(function (r, i) { console.log("    リズム" + i + ": " + r.n.state + " " + r.n.scoreText + " " + r.n.T.toFixed(1) + "秒"); });
ok("見ながら押せば大人まで歩ける", results.every(function (r) { return r.n.score >= 20; }));
ok("100歳まで歩けることがある", results.some(function (r) { return r.n.finished && r.n.score === 100; }));
ok("途中で立ち、杖をつく", results.some(function (r) { return r.seen.stood && r.seen.cane; }));
ok("結果は歳", results.every(function (r) { return /^\d+歳$/.test(r.n.scoreText) && r.n.state === "result"; }));
ok("100歳を超えない", results.every(function (r) { return r.n.score <= 100; }));

// 一歩だけ出して止まると、体の流れを止めきれずに転ぶか。
g.probe.reset();
g.probe.jump(30);
g.key(" "); g.step(18); g.key(" ", true);
g.step(60 * 6);
n = g.probe.now();
ok("一歩で止まると転ぶ", n.state === "down" || n.state === "result", n.state);
g.step(150);
n = g.probe.now();
ok("転ぶと年齢が結果になる", n.state === "result" && /^3\d歳$/.test(n.scoreText), n.scoreText);

g.press("Escape");
g.step(2);
n = g.probe.now();
ok("Esc で最初から", n.state === "play" && n.age < 0.1 && Math.abs(n.x) < 0.5);

if (bad.length) { console.log("\nNG: " + bad.join(" / ")); process.exit(1); }
console.log("\nすべてOK");
