/* むりやり星座: 星を3つ結ぶと星座ができ、同じ組み合わせは数えず、60秒で結果になる */
var path = require("path");
var load = require("../harness");
var g = load(path.join(__dirname, "../../_muriyari-seiza/index.html"));
var fail = 0;
function ok(c, m) { console.log((c ? "OK  " : "NG  ") + m); if (!c) fail++; }
g.probe.reset(); g.step(2);
ok(g.probe.now().state === "play", "開始できる");
function trace(ids) {
  var p = ids.map(function (i) { return g.probe.star(i); });
  g.down(p[0].x, p[0].y);
  for (var i = 1; i < p.length; i++) {
    for (var k = 1; k <= 6; k++) g.moveTo(p[i - 1].x + (p[i].x - p[i - 1].x) * k / 6, p[i - 1].y + (p[i].y - p[i - 1].y) * k / 6);
  }
  g.up(); g.step(1);
}
var s = g.probe.now();
// 近い星3つを選ぶ（途中で別の星を拾わないように）
function near(i) {
  var a = g.probe.star(i), best = -1, bd = 1e9;
  for (var j = 0; j < s.stars; j++) { if (j === i) continue; var b = g.probe.star(j), d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; best = j; } }
  return best;
}
var a = 0, b = near(0), c = near(b) === a ? -1 : near(b);
if (c < 0) { for (var j = 0; j < s.stars; j++) if (j !== a && j !== b) { c = j; break; } }
trace([a, b]);
ok(g.probe.now().score === 0, "星2つでは星座にならない");
trace([a, b, c]);
var n1 = g.probe.now().score;
ok(n1 >= 1, "星3つで星座になる " + JSON.stringify(g.probe.now().names));
trace([c, b, a]);
ok(g.probe.now().score === n1, "逆向きに同じ組み合わせは数えない");
g.step(61 * 60);
ok(g.probe.now().state === "result", "60秒で結果になる");
process.exit(fail ? 1 : 0);
