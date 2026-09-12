/* 長押し・赤レスラーの向き・関節・大型ピン・3投の完走を確認する。 */
var assert=require('assert'),load=require('../harness'),P=require('../../_random-bowling/physics');
var g=load('games/_random-bowling/index.html',{withScripts:true,quiet:true,inject:'window.__dbg={tick:function(n){for(var i=0;i<n;i++)update(1/60);}};'});
function now(){return g.probe.now();}function tick(n){g.dbg.tick(n);}function ready(){for(var i=0;i<800&&now().phase!=='ready'&&now().state!=='result';i++)tick(1);}
assert.equal(now().phase,'ready');g.down(270,600);tick(30);var slow=now().omega;tick(150);assert(now().omega>13&&now().omega<14);assert(now().omega>slow);var before=now().angle;g.moveTo(40,100);assert.equal(now().angle,before);assert.equal(now().human.length,11);
var direction=P.throwDirection(now().angle);var angle=now().angle;g.up();assert.equal(now().phase,'flight');assert.equal(now().human.length,11);var pelvis=now().human[0];assert(Math.abs(pelvis.vx-direction.x*(12+now().omega*2.7))<.001);assert(Math.abs(pelvis.vz-direction.z*(12+now().omega*2.7))<.001);
tick(6);assert(now().simulationTime>.05&&now().simulationTime<.07,'投げた瞬間は微スロー');tick(24);assert.equal(now().playbackRate,1,'すぐ通常速度に戻る');g.down(270,600);g.up();assert.equal(now().phase,'flight');ready();assert.equal(now().shot,1);
g.esc();g.down(270,600);tick(10);g.wrap.fire('pointercancel',{});assert.equal(now().phase,'ready');assert.equal(now().human.length,0);
g.esc();g.key(' ');tick(150);assert.equal(now().phase,'swing');g.key(' ',true);assert.equal(now().phase,'flight');ready();
g.esc();g.pad({press:true});g.step(5);assert.equal(now().phase,'swing');g.pad({});g.step(1);assert.equal(now().phase,'flight');
g.esc();for(var shot=0;shot<3;shot++){ready();g.key(' ');for(var i=0;i<500;i++){tick(1);if(now().swingTime>2&&P.throwDirection(now().angle).z>.99&&Math.abs(P.throwDirection(now().angle).x)<.08)break;}g.key(' ',true);ready();assert.equal(now().shot,shot+1);}
assert.equal(now().state,'result');assert.equal(now().score,now().history.reduce(function(a,b){return a+b;},0));assert(now().score>0);
g.tap(380,g.H*.62+34);assert(g.shared[0].includes('/30 #レッスルボウル'));g.tap(160,g.H*.62+34);assert.equal(now().state,'play');assert.equal(now().score,0);
load.SHAPES.forEach(function(v){g.view(v[0],v[1]);g.step(1);assert(now().H>=780&&now().H<=1700);});
console.log('長押し加速・最大回転・離す方向・入力取消・ジョイパッド・3投完走・共有・画面6通り：問題なし');
