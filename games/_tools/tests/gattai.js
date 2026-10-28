/* 超合体！キングガッシンガーロボ: 合体して戦いに入り、勝ち・負けの結果まで行けるか（matter.js を読むので withScripts） */
var fs = require("fs"), path = require("path");
var load = require("../harness");
var dir = fs.existsSync(path.join(__dirname, "../../gattai")) ? "../../gattai" : "../../_gattai";
function run(perfect, win) {
  var g = load(path.join(__dirname, dir, "index.html"), { withScripts: true, quiet: true });
  g.press(" "); g.step(5);
  for (var k = 0; k < 4; k++) { g.step(60); g.press(" "); }   /* 何個かは本当に投げる */
  g.step(60);
  g.probe.debug(perfect ? 2 : 3);
  g.step(60 * 8);
  var s = g.probe.now(), fought = s.state === "fight";
  for (var i = 0; i < 60 * 6; i++) { if (i % 20 === 0) g.probe.attack(i % 40 ? "kick" : "punch"); g.step(1); }
  g.probe.debug(win ? 4 : 5);
  for (i = 0; i < 60 * 25 && g.probe.now().state !== "result"; i++) { if (win && i % 20 === 0) { g.press("ArrowRight"); g.probe.attack("punch"); } g.step(1); }
  var e = g.probe.now();
  var ok = fought && e.state === "result";
  console.log(ok ? "OK" : "NG", perfect ? "ぴったり" : "いびつ", win ? "勝ち" : "負け", "パーツ", s.parts, JSON.stringify({ state: e.state, score: e.score, robotHP: Math.round(e.robotHP), kaijuHP: Math.round(e.kaijuHP) }));
  return ok;
}
var all = [run(true, true), run(false, false)].every(Boolean);
if (!all) process.exit(1);
