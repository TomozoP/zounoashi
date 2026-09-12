/* 位置・角度の二回のドラッグ後にパワーを止めて投球、各球の投球を確認する。 */
var assert=require('assert'),load=require('../harness');
var g=load('games/_random-bowling/index.html',{withScripts:true,inject:'window.__dbg={set:function(k,a){kind=kinds[k];aim=a;world.reset(kind);syncPhysics();},tick:function(n){for(var i=0;i<n;i++)update(1/60);}};'});
function now(){return g.probe.now();}
function until(phase){for(var i=0;i<1100&&now().phase!==phase;i++)g.dbg.tick(1);assert.equal(now().phase,phase);}
function ready(){until('position');}
function keys(){g.press(' ');assert.equal(now().phase,'angle');}
assert.equal(now().phase,'return');g.press(' ');assert.equal(now().ball,null);
g.dbg.tick(73);assert.equal(now().phase,'receive');g.press(' ');assert.equal(now().phase,'receive');
g.dbg.tick(13);assert.equal(now().phase,'place');g.press(' ');assert.equal(now().phase,'place');
ready();assert.equal(now().ball,null);
var cy=g.H-210;
g.down(330,cy);assert(now().position>.7,'押した瞬間にその横位置へ移動する');g.moveTo(345,g.H-210);assert.equal(now().phase,'position');g.up();assert.equal(now().phase,'angle');assert(now().position>0.9);
var pos=now().position,depth=now().heightOffset;g.down(345,g.H-210);g.moveTo(300,g.H-260);depth=now().heightOffset;assert(depth>0);g.up();assert.equal(now().phase,'power');assert.equal(now().ball,null);g.dbg.tick(54);var weak=now().power;assert(weak<.36);g.dbg.tick(54);assert(now().power>.99);g.tap(270,cy);assert.equal(now().phase,'roll');assert(now().aim<0);assert.equal(now().position,pos);
assert.equal(now().phase,'roll');assert.equal(now().ball.x,pos);assert.equal(now().ball.z,.65);assert(Math.abs(now().ball.y-(now().kinds.find(function(k){return k.name===now().kind;}).r+.45+depth))<.001);
var speed=now().ball.vz;g.tap(270,g.H-160);assert.equal(now().ball.vz,speed,'連打しても投げ直さない');
for(var n=0;n<10;n++) {
 for(var a of [0,.2]) {
  g.esc();ready();keys();g.dbg.set(n,a);g.dbg.tick(47);g.press(' ');assert.equal(now().phase,'power');g.dbg.tick(30);g.press(' ');
  until('settle');assert(now().score>=0&&now().score<=10);assert.equal(now().score,now().pins.filter(function(p){return p.down;}).length);assert(now().scoreTime>1.9);
  g.dbg.tick(125);assert.equal(now().scoreTime,0);
 }
}
g.esc();for(var i=0;i<10;i++){ready();keys();g.dbg.tick(40);g.press(' ');g.dbg.tick(30);g.press(' ');until('settle');g.dbg.tick(62);assert.equal(now().shot,i+1);}
assert.equal(now().state,'result');assert.equal(now().score,now().history.reduce(function(a,b){return a+b;},0));
g.tap(380,g.H*.62+34);assert.equal(g.shared.length,1);g.tap(160,g.H*.62+34);assert.equal(now().score,0);
ready();g.pad({press:true});g.step(1);g.pad({});g.step(1);assert.equal(now().phase,'angle');g.pad({dx:1});g.step(1);g.pad({});g.step(1);assert(now().aim>0);
g.esc();ready();g.down(270,cy);g.moveTo(270,cy-200);assert.equal(now().heightOffset,0);g.up();g.down(270,cy);g.moveTo(270,cy-200);assert.equal(now().heightOffset,2.4);g.moveTo(270,cy+200);assert.equal(now().heightOffset,-.3);g.up();assert.equal(now().phase,'power');assert.equal(now().heightOffset,-.3);
g.esc();ready();g.press('ArrowUp');assert.equal(now().heightOffset,0);keys();g.press('ArrowUp');assert(now().heightOffset>0);g.press('ArrowDown');assert(Math.abs(now().heightOffset)<.001);
g.esc();assert.equal(now().ball,null);assert.equal(now().phase,'return');
load.SHAPES.forEach(function(v){g.view(v[0],v[1]);g.step(1);g.drawn.length=0;assert(now().H>=780&&now().H<=1700);});
console.log('二回のドラッグ・位置保持・連打防止・10種類・10投完走・共有・やり直し・ジョイパッド・画面6通り：問題なし');
