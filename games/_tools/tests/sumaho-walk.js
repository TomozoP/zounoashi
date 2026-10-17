/* スマホ歩き：10m（ゲームの中で100）先のゴールまでのタイム競争。
   リズムよくタップすればゴールできる。止まると倒れる。 */
var load = require("../harness");
function run(gap, sec, jitter) {
  var g = load(__dirname + "/../../_sumaho/index.html");
  g.probe.reset(); var next = 0;
  for (var i = 0; i < 60 * sec; i++) {
    if (i >= next && (gap || i === 0)) { g.probe.tap(); next = i + (gap ? gap * (jitter ? 0.8 + Math.random() * 0.4 : 1) : 1e9); }
    g.probe.step(1);
    if (g.probe.now().state === "result") break;
  }
  return g.probe.now();
}
var ng = 0;
function ok(c, m) { console.log((c ? "OK  " : "NG  ") + m); if (!c) ng++; }
var q, best = 0;
for (var t = 0; t < 6 && !best; t++) { q = run(50, 90, true); if (q.cleared) best = q.score; }
ok(best > 15 && best < 60, "0.8秒くらいのリズムでゴールでき、タイムが出る（" + best + "秒）");
q = run(0, 10); ok(q.state === "result" && !q.cleared, "1回だけで止まると倒れて割れる");
process.exit(ng ? 1 : 0);
