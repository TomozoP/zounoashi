/* 高いところから紅茶を注ぐ：まっすぐ狙い続けると満杯で終わるか、結果が出るか */
var load = require("../harness");
var g = load(__dirname + "/../../_koucha/index.html");
g.probe.reset();
g.probe.hold(true);
var t = 0;
var ok = g.until(function () {
  var p = g.probe.now();
  /* 落ちる時間ぶん先回り（横へ出る速さ 11cm/s） */
  var fall = Math.sqrt(2 * p.h / 980);
  g.probe.moveTo(11 * fall);
  return p.state === "result";
}, 60 * 40);
var p = g.probe.now();
console.log(ok ? "OK" : "NG", "結果まで", JSON.stringify({ score: p.score, h: Math.round(p.h), inCup: p.inCup, left: p.left }));
process.exit(ok ? 0 : 1);
