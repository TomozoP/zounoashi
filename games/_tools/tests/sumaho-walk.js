/* スマホ歩き：1m（ゲームの中で10）先のゴールまでのタイム競争。
   ほどよいリズムならたいていゴールでき、急ぐほど速いが倒れやすい。止まると倒れる。 */
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
var q = run(50, 15); ok(q.cleared && q.score > 2 && q.score < 6, "0.8秒ごとのタップでゴールし、タイムが出る（" + q.score + "秒）");
q = run(0, 10); ok(q.state === "result" && !q.cleared, "1回だけで止まると倒れて割れる");
var fast = 0, slow = 0;
for (var t = 0; t < 10; t++) { if (run(16, 15, true).cleared) fast++; if (run(45, 15, true).cleared) slow++; }
ok(fast < slow, "急ぐほど倒れやすい（速いリズム " + fast + "/10、ゆっくり " + slow + "/10 がゴール）");
process.exit(ng ? 1 : 0);
