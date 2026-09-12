/* 長押し・接線方向・関節・大型ピン・10投の完走を確認する。 */
var assert=require('assert'),load=require('../harness'),P=require('../../_random-bowling/physics');
var g=load('games/_random-bowling/index.html',{withScripts:true,quiet:true,inject:'window.__dbg={tick:function(n){for(var i=0;i<n;i++)update(1/60);}};'});
function now(){return g.probe.now();}function tick(n){g.dbg.tick(n);}function ready(){for(var i=0;i<800&&now().phase!=='ready'&&now().state!=='result';i++)tick(1);}
function circle(turns,sign){var c=now().spinCenter;g.down(c.x+100,c.y);for(var i=1;i<=turns*60;i++){tick(1);var a=i*Math.PI*2/60*sign;g.moveTo(c.x+100*Math.cos(a),c.y-100*Math.sin(a)/1.65);}}
assert.equal(now().phase,'ready');var initial=now().angle;g.down(270,600);tick(120);assert.equal(now().angle,initial);assert.equal(now().omega,0);g.up();assert.equal(now().phase,'ready');
circle(2,1);assert(now().omega>5);assert(now().angle>Math.PI*2);assert.equal(now().human.length,0);
var angle=now().angle;g.up();assert.equal(now().phase,'flight');assert.equal(now().human.length,11);var pelvis=now().human[0];assert(Math.abs(pelvis.vx+Math.sin(angle)*(12+now().omega*2.7))<.001);assert(Math.abs(pelvis.vz-Math.cos(angle)*(12+now().omega*2.7))<.001);
g.down(270,600);g.up();assert.equal(now().phase,'flight');ready();assert.equal(now().shot,1);
g.esc();g.down(270,600);tick(10);g.wrap.fire('pointercancel',{});assert.equal(now().phase,'ready');assert.equal(now().human.length,0);
g.esc();circle(1,-1);assert(now().omega< -5);var clockwiseAngle=now().angle;g.up();assert.equal(now().phase,'flight');assert(Math.sign(now().human[0].vx)===Math.sign(Math.sin(clockwiseAngle)));ready();
g.esc();circle(1,1);tick(180);g.up();assert.equal(now().phase,'ready');
g.esc();g.key(' ');tick(150);assert.equal(now().phase,'swing');g.key(' ',true);assert.equal(now().phase,'flight');ready();
g.esc();g.pad({press:true});g.step(5);assert.equal(now().phase,'swing');g.pad({});g.step(1);assert.equal(now().phase,'flight');
g.esc();for(var shot=0;shot<10;shot++){ready();g.key(' ');for(var i=0;i<500;i++){tick(1);if(now().swingTime>2&&Math.cos(now().angle)>0&&Math.sin(now().angle)>.07&&Math.sin(now().angle)<.18)break;}g.key(' ',true);ready();assert.equal(now().shot,shot+1);}
assert.equal(now().state,'result');assert.equal(now().score,now().history.reduce(function(a,b){return a+b;},0));assert(now().score>0);
g.tap(380,g.H*.62+34);assert(g.shared[0].includes('レッスルボウル'));g.tap(160,g.H*.62+34);assert.equal(now().state,'play');assert.equal(now().score,0);
load.SHAPES.forEach(function(v){g.view(v[0],v[1]);g.step(1);assert(now().H>=780&&now().H<=1700);});
console.log('円運動・逆回転・静止時の減速・離す方向・入力取消・ジョイパッド・10投完走・共有・画面6通り：問題なし');
