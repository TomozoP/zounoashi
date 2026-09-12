/* 一球の搬送、投球待ち、10種類の物理と10投の完走を確認する。 */
var assert=require('assert'),load=require('../harness');
var g=load('games/_random-bowling/index.html',{inject:
 'window.__dbg={set:function(k,a){kind=kinds[k];aim=a;manual=true;},tick:function(n){for(var i=0;i<n;i++)update(1/60);}};'});
function now(){return g.probe.now();}
function ready(){for(var i=0;i<200&&now().phase!=='aim';i++)g.dbg.tick(1);assert.equal(now().phase,'aim');}
assert.equal(now().scoreTime,0);
assert.equal(now().phase,'return');g.press(' ');assert.equal(now().ball,null);
g.dbg.tick(73);assert.equal(now().phase,'place');g.press(' ');assert.equal(now().ball,null);
ready();g.dbg.tick(120);assert.equal(now().phase,'aim');assert.equal(now().shot,0);
for(var k=0;k<10;k++) {
 for(var a of [0,.2]) {
  g.esc();ready();g.dbg.set(k,a);g.press(' ');assert.equal(now().phase,'roll');
  g.dbg.tick(320);assert.equal(now().history.length,1);
  assert(a===0?now().score>0:now().score===0);
  assert(now().scoreTime>1.8,'結果更新時にヘッダーを表示');
  g.dbg.tick(125);assert.equal(now().scoreTime,0,'二秒後に隠れる');
 }
}
g.esc();
for(var i=0;i<10;i++) {
 ready();g.dbg.set(i,0);
 if(i%2)g.tap(270,g.H-200);else g.press(' ');
 g.press(' ');g.dbg.tick(380);assert.equal(now().shot,i+1);
}
assert.equal(now().state,'result');
assert.equal(now().score,now().history.reduce(function(a,b){return a+b;},0));
g.tap(380,g.H*.62+34);assert.equal(g.shared.length,1);
g.tap(160,g.H*.62+34);assert.equal(now().score,0);assert.equal(now().phase,'return');
ready();g.pad({dx:1});g.step(1);g.pad({});g.step(1);assert(now().aim>0);
g.pad({press:true});g.step(1);g.pad({});g.step(1);assert.equal(now().phase,'roll');
g.esc();assert.equal(now().ball,null);assert.equal(now().phase,'return');
load.SHAPES.forEach(function(v){g.view(v[0],v[1]);g.step(1);g.drawn.length=0;assert(now().H>=780&&now().H<=1700);});
console.log('一球の搬送・自動移動・移動中の誤投防止・10種類・溝・10投完走・共有・やり直し・ジョイパッド・画面6通り：問題なし');
