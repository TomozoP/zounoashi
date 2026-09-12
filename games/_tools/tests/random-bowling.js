/* 10種類の投球、連鎖、得点、操作を偽DOMの台で確かめる。 */
var assert = require('assert');
var load = require('../harness');
var file = 'games/_random-bowling/index.html';
var g = load(file, { inject: `
  window.__dbg = {
    set: function(k,a) {kind=kinds[k];aim=a;manual=true;},
    tick: function(n,dt) {for(var i=0;i<n;i++) update(dt||1/60);},
    sample: function(r) {
      var saved=Math.random;
      try {Math.random=function(){return r;};nextBall();return kind.name;}
      finally {Math.random=saved;}
    }
  };
` });
function now() {return g.probe.now();}
function shot(k,a) {
  g.esc();g.dbg.set(k,a);g.press(' ');
  var maxY=0;
  for(var i=0;i<320;i++) {
    g.dbg.tick(1);
    var p=now();
    maxY=Math.max(maxY,p.ball.y);
    assert(Number.isFinite(p.ball.x)&&Number.isFinite(p.ball.z));
    assert(p.score>=0&&p.score<=10);
  }
  assert.equal(now().phase,'settle');
  assert.equal(now().history[0],now().score);
  return {score:now().score,height:maxY};
}
assert.equal(now().kinds.length,10);
var names=new Set();
for(var k=0;k<10;k++) names.add(g.dbg.sample((k+.5)/10));
assert.equal(names.size,10,'抽選範囲の10等分すべてから別の球が出る');
assert.equal(g.dbg.sample(0),g.dbg.sample(.099999));
assert(names.has(g.dbg.sample(.999999)));
var measurements=[];
for(var k=0;k<10;k++) {
  var center=shot(k,0),left=shot(k,-.09),right=shot(k,.09),gutter=shot(k,.2);
  assert(center.score>0,'どの球も中央付近を狙えば倒せる');
  assert.equal(gutter.score,0,'溝に入った球はピンを倒さない');
  assert(center.score>Math.min(left.score,right.score),'狙う向きで結果が変わる');
  measurements.push([now().kind,left.score,center.score,right.score,center.height.toFixed(2)]);
}
assert(measurements[9][4]>1,'スーパーボールは高く跳ねる');
console.log('種類 / 左 / 中央 / 右 / 最高位置');
measurements.forEach(function(row){console.log(row.join(' / '));});

g.esc();
for(var k=0;k<10;k++) {
  g.dbg.set(k,0);
  if(k%2) g.tap(270,g.H-70);else g.press(' ');
  g.press(' ');g.tap(270,g.H-70);
  g.dbg.tick(380);
  assert.equal(now().shot,k+1,'連打しても投数は増えない');
}
assert.equal(now().state,'result');
assert.equal(now().score,now().history.reduce(function(a,b){return a+b;},0));
g.tap(380,g.H*.62+34);
assert.equal(g.shared.length,1);
assert(g.shared[0].includes(now().score+'/100'));
g.tap(160,g.H*.62+34);
assert.equal(now().score,0);
assert.equal(now().phase,'aim');
g.pad({dx:1});g.step(1);g.pad({});g.step(1);
assert(now().aim>0);
g.pad({press:true});g.step(1);g.pad({});g.step(1);
assert.equal(now().phase,'roll');
g.dbg.tick(30);g.esc();
assert.equal(now().shot,0);
assert.equal(now().ball,null);
g.key('ArrowLeft');assert(now().aim<0);
g.tap(454,g.H-69);assert.equal(now().aim,0);
g.win.fire('keydown',{key:' ',code:'Space',repeat:true,preventDefault:function(){}});
assert.equal(now().phase,'aim','押しっぱなしでは投げない');
load.SHAPES.forEach(function(v){
  g.view(v[0],v[1]);g.step(1);g.drawn.length=0;
  assert(now().H>=780&&now().H<=1700);
});
console.log('10投完走・得点合計・連打・溝・再開・途中リセット・共有・ジョイパッド・画面6通り：問題なし');
