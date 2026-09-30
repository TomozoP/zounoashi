/* 100歳ウォーク。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/walk100.js

   見るところ
   ・開始画面では歩かない。スペースを離すと0歳（ハイハイ）から始まる
   ・押さなければ転ばずにその場にいる（赤ちゃん・幼児・大人・杖の老人）
   ・進むほど年をとる。1歳で立ち、背が伸び、70歳で杖をつく
   ・見ながら押す人のまねで、20歳からの階段を上り、100歳（大往生）まで歩ける。かかった時間（秒）が結果
   ・歩き続けないと転ぶ（一歩で止まると体の流れを止めきれない）。転んでもその場で同じ年齢のまま起き上がる
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
[0, 2, 30, 75].forEach(function (a) {
  g.probe.reset();
  if (a) g.probe.jump(a);
  g.step(60 * 4);
  n = g.probe.now();
  ok(a + "歳は押さなければ転ばない", n.state === "play" && !n.fallen, n.x.toFixed(2));
});

// 見ながら押す人のまね。振り出した手足が着いてから少し待って押し、決めた時間だけ押す。
function play(delay, hold, limit) {
  g.probe.reset();
  var frames = 0, pressedAt = -1, landedAt = -1, waitAt = -1, seen = { stood: false, cane: false, floor: 0 }, k = 1;
  while (frames < limit * 60) {
    n = g.probe.now();
    if (n.state === "result") break;
    if (n.form === "biped") seen.stood = true;
    if (n.cane) seen.cane = true;
    seen.floor = Math.max(seen.floor, n.floor || 0);
    if (pressedAt >= 0 && frames - pressedAt >= hold * k * 60) { g.key(" ", true); pressedAt = -1; }
    if (pressedAt < 0) {
      if (!n.landed) { landedAt = -1; if (waitAt < 0) waitAt = frames; }
      else if (landedAt < 0) landedAt = frames;
      // 足が段に引っかかって着かないまま1秒たったら、人と同じくもう一度押す。
      if ((landedAt >= 0 && frames - landedAt >= delay * k * 60) || (waitAt >= 0 && frames - waitAt >= 60)) { g.key(" "); pressedAt = frames; landedAt = -1; waitAt = -1; }
    }
    g.step(1);
    frames++;
  }
  g.step(150);
  return { n: g.probe.now(), seen: seen };
}
var results = [[0, 0.3], [0.1, 0.35], [0.05, 0.2], [0.15, 0.4]].map(function (r) { return play(r[0], r[1], 200); });
results.forEach(function (r, i) { console.log("    リズム" + i + ": " + r.n.state + " " + Math.floor(r.n.age) + "歳 " + r.n.scoreText + " 転んだ" + r.n.falls + "回"); });
ok("見ながら押せば100歳まで歩ける", results.every(function (r) { return r.n.state === "result" && r.n.age >= 100; }), results.map(function (r) { return r.n.scoreText; }).join(" "));
ok("20歳から階段を上る", results.some(function (r) { return r.seen.floor > 0.5; }), results.map(function (r) { return r.seen.floor.toFixed(2) + "m"; }).join(" "));
ok("途中で立つ", results.every(function (r) { return r.seen.stood; }));
ok("結果は秒", results.every(function (r) { return /^\d+\.\d秒$/.test(r.n.scoreText); }));
ok("100歳を超えない", results.every(function (r) { return r.n.age <= 100; }));

// 一歩だけ出して止まると、体の流れを止めきれずに転ぶか。
g.probe.reset();
g.probe.jump(30);
g.key(" "); g.step(18); g.key(" ", true);
g.step(60 * 6);
n = g.probe.now();
ok("一歩で止まると転ぶ", n.falls >= 1, n.state + " " + n.falls);
var fellAge = n.age;
g.step(60 * 2);
n = g.probe.now();
ok("転んでもその場で起き上がって続く", n.state === "play" && !n.fallen && Math.abs(n.age - fellAge) < 1, n.state + " " + n.age.toFixed(1) + "歳");

g.press("Escape");
g.step(2);
n = g.probe.now();
ok("Esc で最初から", n.state === "play" && n.age < 0.1 && Math.abs(n.x) < 0.5);

if (bad.length) { console.log("\nNG: " + bad.join(" / ")); process.exit(1); }
console.log("\nすべてOK");
