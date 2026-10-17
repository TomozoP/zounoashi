/* スカイダイビング紅茶：開いてカップの真上で風に向かって止まり、注ぎ続けると結果まで行くか */
var load = require("../harness");
var g = load(__dirname + "/../../_koucha/index.html");
g.probe.reset();
var opened = false, holding = false;
var ok = g.until(function () {
  var p = g.probe.now();
  if (!opened && p.y < 700) { g.probe.hold(true); g.probe.hold(false); opened = true; }
  if (p.chute === 2 && !p.landed) {
    /* カップへ向かい、近づいたら風に逆らって止まる */
    var aim = -p.wind * 0.8 * p.y / 9;   /* 紅茶は風に流されるので風上へずらす */
    var want = Math.max(-6, Math.min(6, (aim - p.x) * 0.5));
    g.probe.steer(want - p.wind);
    if (!holding && Math.abs(p.x - aim) < 1 && p.y < 120) { g.probe.hold(true); holding = true; }
  }
  return p.state === "result";
}, 60 * 120);
var p = g.probe.now();
console.log(ok ? "OK" : "NG", JSON.stringify({ score: p.score, inCup: p.inCup, left: p.left, x: +p.x.toFixed(2), y: +p.y.toFixed(1) }));
process.exit(ok ? 0 : 1);
