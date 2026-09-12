/* 質量・反発・回転・コマ数の違いを、実際の剛体計算で測る。 */
var assert=require('assert'),P=require('../../_random-bowling/physics');
function run(k,dt,angle){var g=new P.Game();g.reset(k);assert(g.snapshot().pins.every(function(p){return !p.down&&p.y>.4;}));g.launch(0,angle||0);var maxY=0,rot=0;
  for(var i=0;i<2000&&!g.finished();i++){g.step(dt);var s=g.snapshot();maxY=Math.max(maxY,s.ball.y);rot=Math.max(rot,Math.abs(s.ball.q.x));assert(Object.values(s.ball).filter(function(v){return typeof v==='number';}).every(Number.isFinite));}
  assert(g.finished(),'投球に終わりがある');return {score:g.snapshot().pins.filter(function(p){return p.down;}).length,rotation:rot,maxY:maxY,state:g.snapshot()};}
var heavy=run(P.kinds[6],1/60),light=run(P.kinds[5],1/60);
assert(heavy.score>light.score,'重い鉄球は軽いビーチ球よりピンを押し抜く');
function rebound(bounce){var g=new P.Game(),k=Object.assign({},P.kinds[0],{bounce:bounce,friction:0,drag:0});g.reset(k);g.launch(0,0);g.ball.position.y=2;g.ball.velocity.set(0,0,0);g.ball.angularVelocity.set(0,0,0);var hit=false,peak=0;
 for(var i=0;i<300;i++){g.step(1/180);if(g.ball.position.y<.36)hit=true;if(hit)peak=Math.max(peak,g.ball.position.y);}return peak;}
var soft=rebound(.08),rubber=rebound(.94);assert(rubber>soft+.8,'反発係数で実際の跳ねる高さが変わる');
var base=run(P.kinds[0],1/60,.01),low=run(P.kinds[0],1/30,.01),high=run(P.kinds[0],1/120,.01);
assert.equal(base.score,low.score);assert.equal(base.score,high.score);assert(base.rotation>.8,'球は姿勢を回転させて転がる');
var rugby=run(P.kinds[8],1/60);assert(Math.abs(rugby.state.ball.x)>.2,'楕円体の形で軌道が変わる');
console.log(JSON.stringify({鉄球:heavy.score,ビーチ球:light.score,低反発の高さ:soft,ゴムの高さ:rubber,毎秒30枚:low.score,毎秒60枚:base.score,毎秒120枚:high.score,ラグビーの横ずれ:rugby.state.ball.x}));

// 同じ球でも、止めたパワーが初速と回転へ反映される。
var weakShot=new P.Game(),strongShot=new P.Game();weakShot.launch(0,.1,.7475);strongShot.launch(0,.1,1.3);assert(strongShot.ball.velocity.z>weakShot.ball.velocity.z*1.7);assert(strongShot.ball.angularVelocity.x>weakShot.ball.angularVelocity.x*1.7);

// 床から離れた位置で放し、空中を進んでから自然に着地する。
var loft=new P.Game();loft.launch(0,0);assert(loft.ball.position.y-P.kinds[0].r>=.44);assert(loft.ball.velocity.z>=16);var landed=false;for(var i=0;i<180;i++){loft.step(1/180);if(loft.ball.position.y<P.kinds[0].r+.015){landed=true;assert(loft.ball.position.z>4);break;}}assert(landed,'浮かせた球が着地する');
