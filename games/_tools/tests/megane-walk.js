/* メガネウォーク：着いてから少し待って短く押す、を続けると歩けるか。押さずに長く押すと割れるか */
var load = require("../harness");
function run(hold, wait, limit) {
  var g = load(__dirname + "/../../_megane/index.html");
  g.probe.reset();
  var holding = false, rel = 0, lastSteps = 0, since = 0, t = 0;
  g.probe.press(); holding = true; rel = hold;
  for (var f = 0; f < limit * 60; f++) {
    t += 1 / 60;
    var p = g.probe.now();
    if (holding && t >= rel) { g.probe.release(); holding = false; }
    if (p.steps !== lastSteps) { lastSteps = p.steps; since = t; }
    if (!holding && p.steps > 0 && since > 0 && t - since >= wait) { g.probe.press(); holding = true; rel = t + hold; since = -1; }
    g.probe.step(1);
    if (p.state === "result") break;
  }
  return g.probe.now();
}
var a = run(0.15, 0.1, 15), b = run(0.8, 0.1, 10);
console.log((a.steps > 10 && !a.broken ? "OK" : "NG") + " 歩ける", a.steps, "歩", (a.x * 10).toFixed(0) + "cm");
console.log((b.broken ? "OK" : "NG") + " 長く押すと割れる", b.state, b.score);
process.exit(a.steps > 10 && !a.broken && b.broken ? 0 : 1);
