/* 北海道詰め: 交互に県を置いて、勝ち・負けの結果まで行けるか */
var fs = require("fs"), path = require("path");
var load = require("../harness");
var dir = fs.existsSync(path.join(__dirname, "../../gattai")) ? "../../gattai" : "../../_gattai";
function run(win) {
  var g = load(path.join(__dirname, dir, "index.html"), { withScripts: true, quiet: true });
  g.press(" "); g.step(5);
  var turns = 0;
  for (var i = 0; i < 60 * 60 && g.probe.now().state !== "result"; i++) {
    var e = g.probe.now();
    if (e.state === "mode") g.press(" ");
    if (e.state === "spin" && e.turn === 0) g.press(" ");
    if (e.state === "place" && e.turn === 0) { turns++; g.probe.debug(win ? 2 : turns >= 2 ? 3 : 1); }
    g.step(1);
  }
  e = g.probe.now();
  var ok = e.state === "result" && e.won === win && e.count >= 1;
  console.log(ok ? "OK" : "NG", win ? "勝ち" : "負け", JSON.stringify({ state: e.state, won: e.won, count: e.count, turns: turns }));
  return ok;
}
function runHK() {                             /* 北海道が出て置くと、枠が崩れて負け */
  var g = load(path.join(__dirname, dir, "index.html"), { withScripts: true, quiet: true });
  g.press(" "); g.step(5); g.press(" "); g.step(5);
  g.probe.debug(4);                             /* 北海道に止まる → 置いたら崩壊 */
  for (var i = 0; i < 60 * 10 && g.probe.now().state !== "result"; i++) { if (g.probe.now().state === "place") g.probe.debug(1); g.step(1); }
  var e = g.probe.now(), ok = e.state === "result" && e.won === false;
  console.log(ok ? "OK" : "NG", "北海道を置いて負け", JSON.stringify({ state: e.state, won: e.won }));
  return ok;
}
if (![run(true), run(false), runHK()].every(Boolean)) process.exit(1);
