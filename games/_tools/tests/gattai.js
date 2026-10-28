/* 最強都道府県獣バトル: 5県を選んで合成し、8体と戦って勝ち・負けの結果まで行けるか（matter.js を読むので withScripts） */
var fs = require("fs"), path = require("path");
var load = require("../harness");
var dir = fs.existsSync(path.join(__dirname, "../../gattai")) ? "../../gattai" : "../../_gattai";
function run(win) {
  var g = load(path.join(__dirname, dir, "index.html"), { withScripts: true, quiet: true });
  g.press(" "); g.step(5);
  g.probe.debug(1); g.step(5);
  var picked = g.probe.now().picks;
  g.press(" "); g.step(30);                    /* 並べる画面へ */
  var arr = g.probe.now().state;
  g.press(" ");                                /* 合体 */
  for (var i = 0; i < 60 * 12 && g.probe.now().state !== "fight"; i++) g.step(1);
  var fought = g.probe.now().state === "fight";
  for (i = 0; i < 60 * 5; i++) { if (i % 20 === 0) g.probe.attack(i % 40 ? "kick" : "punch"); g.step(1); }
  if (win) { g.probe.debug(6); for (i = 0; i < 60 * 4; i++) g.step(1); }
  g.probe.debug(win ? 4 : 5);
  for (i = 0; i < 60 * 25 && g.probe.now().state !== "result"; i++) { if (win && i % 20 === 0) { g.press("ArrowRight"); g.probe.attack("punch"); } g.step(1); }
  var e = g.probe.now();
  var ok = picked === 5 && arr === "arrange" && fought && e.state === "result";
  console.log(ok ? "OK" : "NG", win ? "勝ち" : "負け", JSON.stringify({ picked: picked, arr: arr, fought: fought, state: e.state, stage: e.stage, score: e.score, me: Math.round(e.myHP), foe: Math.round(e.foeHP) }));
  return ok;
}
if (![run(true), run(false)].every(Boolean)) process.exit(1);
