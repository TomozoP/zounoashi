/* 位置・角度の二回のドラッグとパワー決定、各球の投球を確認する。 */
var assert=require('assert'),load=require('../harness');
var g=load('games/_random-bowling/index.html',{inject:'window.__dbg={set:function(k,a){kind=kinds[k];aim=a;},tick:function(n){for(var i=0;i<n;i++)update(1/60);}};'});
function now(){return g.probe.now();}
function until(phase){for(var i=0;i<1100&&now().phase!==phase;i++)g.dbg.tick(1);assert.equal(now().phase,phase);}
function ready(){until('receive');}
function keys(){g.press(' ');g.press(' ');g.press(' ');assert.equal(now().phase,'power');}
assert.equal(now().phase,'return');g.press(' ');assert.equal(now().ball,null);
ready();g.dbg.tick(120);assert.equal(now().phase,'receive','自動で投球位置へ移動しない');
var k=now().kinds.find(function(k){return k.name===now().kind;}),r=Math.max(18,Math.min(46,k.r*78)),cy=g.H-47-r*(k.skin===8?1.35:1);
g.tap(270,cy);assert.equal(now().phase,'receive','タップだけでは位置を確定しない');
g.down(270,cy);g.moveTo(345,g.H-210);assert.equal(now().phase,'position');g.up();assert.equal(now().phase,'angle');assert(now().position>0.9);
var pos=now().position;g.down(345,g.H-210);g.moveTo(300,g.H-260);g.up();assert.equal(now().phase,'power');assert(now().aim<0);assert.equal(now().position,pos);
g.dbg.tick(24);assert(now().power>.4&&now().power<.6);g.tap(270,g.H-160);assert.equal(now().phase,'roll');assert.equal(now().ball.x,pos);
var speed=now().ball.vz;g.tap(270,g.H-160);assert.equal(now().ball.vz,speed,'連打しても投げ直さない');
for(var n=0;n<10;n++) {
 for(var a of [0,.2]) {
  g.esc();ready();keys();g.dbg.set(n,a);g.dbg.tick(47);g.press(' ');
  until('settle');assert(a===0?now().score>0:now().score===0);assert(now().scoreTime>1.9);
  g.dbg.tick(125);assert.equal(now().scoreTime,0);
 }
}
// 最弱でも全種類が最後まで到達する。
for(var n=0;n<10;n++){g.esc();ready();keys();g.dbg.set(n,0);g.press(' ');until('settle');assert.equal(now().shot,1);}
g.esc();for(var i=0;i<10;i++){ready();keys();g.dbg.tick(40);g.press(' ');until('settle');g.dbg.tick(62);assert.equal(now().shot,i+1);}
assert.equal(now().state,'result');assert.equal(now().score,now().history.reduce(function(a,b){return a+b;},0));
g.tap(380,g.H*.62+34);assert.equal(g.shared.length,1);g.tap(160,g.H*.62+34);assert.equal(now().score,0);
ready();g.pad({press:true});g.step(1);g.pad({});g.step(1);assert.equal(now().phase,'position');g.pad({dx:1});g.step(1);g.pad({});g.step(1);assert(now().position>0);
g.esc();assert.equal(now().ball,null);assert.equal(now().phase,'return');
load.SHAPES.forEach(function(v){g.view(v[0],v[1]);g.step(1);g.drawn.length=0;assert(now().H>=780&&now().H<=1700);});
console.log('二回のドラッグ・位置保持・ゲージ停止・連打防止・10種類の強弱・10投完走・共有・やり直し・ジョイパッド・画面6通り：問題なし');
