/* スフィンクスラン。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/sphinx-run.js

   見るところ
   ・開始画面では歩かない。スペースを離すと朝（ハイハイ）から始まる
   ・押さなければ転ばずにその場にいる（3つの体とも）
   ・押して離すリズムで前へ進み、区切りを越えると昼（二足）、夕（杖）の体になる
   ・見ながら押す人のまねで、朝から夕のゴールまで歩ける
   ・押しっぱなし・連打で転ぶことがある。転ぶと進んだ距離（m）が結果になる
   ・ゴールすると時間（秒）が結果になる
   ・Esc で最初から */

var load = require("../harness");
var FILE = process.argv[2] || (require("fs").existsSync("games/sphinx-run/index.html") ? "games/sphinx-run/index.html" : "games/_sphinx-run/index.html");

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

// サムネ撮影用の関数で、昼・夕の体から始められるようにする（テストだけ）。
var g = load(FILE, { withScripts: true, quiet: true, inject: "window.__probe.jump = function (i) { window.__thumbnail({ stage: i }); };" });
g.view(390, 844);
g.step(60);
var n = g.probe.now();
ok("開始画面では歩かない", n.state === "intro" && Math.abs(n.x) < 0.3, n.x.toFixed(2));
g.key(" "); g.key(" ", true);
g.step(2);
n = g.probe.now();
ok("朝のハイハイから始まる", n.state === "play" && n.form === "baby" && n.stage === 0);

// 押さないで立っているだけなら転ばない。
[0, 1, 2].forEach(function (i) {
  g.probe.reset();
  if (i) g.probe.jump(i);
  g.step(60 * 4);
  n = g.probe.now();
  ok(["朝", "昼", "夕"][i] + "は押さなければ転ばない", n.state === "play" && !n.fallen && n.stage === i, n.x.toFixed(2));
});

// 見ながら押す人のまね。振り出した手足が着いてから少し待って押し、決めた時間だけ押す。
function play(delay, hold, limit) {
  g.probe.reset();
  var frames = 0, pressedAt = -1, landedAt = -1, stages = {};
  while (frames < limit * 60) {
    n = g.probe.now();
    if (n.state !== "play") break;
    stages[n.form] = true;
    if (pressedAt >= 0 && frames - pressedAt >= hold * 60) { g.key(" ", true); pressedAt = -1; }
    if (pressedAt < 0) {
      if (!n.landed) landedAt = -1;
      else if (landedAt < 0) landedAt = frames;
      if (landedAt >= 0 && frames - landedAt >= delay * 60) { g.key(" "); pressedAt = frames; landedAt = -1; }
    }
    g.step(1);
    frames++;
  }
  g.step(150);
  return { n: g.probe.now(), stages: Object.keys(stages) };
}
var results = [[0, 0.3], [0.1, 0.35], [0.05, 0.2], [0.2, 0.3]].map(function (r) { return play(r[0], r[1], 150); });
var done = results.filter(function (r) { return r.n.finished; });
results.forEach(function (r, i) { console.log("    リズム" + i + ": " + r.n.state + " " + r.n.scoreText + " " + r.stages.join("→")); });
ok("見ながら押せばゴールまで歩ける", done.length > 0);
ok("ゴールは朝・昼・夕を通る", done.every(function (r) { return r.stages.join() === "baby,adult,elder"; }));
ok("ゴールの結果は秒", done.every(function (r) { return /^\d+\.\d秒$/.test(r.n.scoreText) && r.n.state === "result"; }));

// 押しっぱなしで転ぶか。
g.probe.reset();
g.probe.jump(1);
g.key(" ");
g.step(60 * 6);
n = g.probe.now();
ok("昼に押しっぱなしだと転ぶ", n.state === "down" || n.state === "result", n.state);
g.key(" ", true);
g.step(150);
n = g.probe.now();
ok("転ぶと距離（m）が結果になる", n.state === "result" && /^\d+\.\dm$/.test(n.scoreText), n.scoreText);

g.press("Escape");
g.step(2);
n = g.probe.now();
ok("Esc で最初から", n.state === "play" && n.stage === 0 && Math.abs(n.x) < 0.5);

if (bad.length) { console.log("\nNG: " + bad.join(" / ")); process.exit(1); }
console.log("\nすべてOK");
