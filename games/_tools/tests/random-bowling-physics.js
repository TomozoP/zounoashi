/* ラグドールの関節が離れず、実際の衝突でピンを倒すことを確認する。 */
var assert=require('assert'),P=require('../../_random-bowling/physics');
function shot(angle,dt){var g=new P.Game();g.launch(angle,6.5);var gap=0;while(!g.finished()){g.step(dt);g.joints.forEach(function(j){gap=Math.max(gap,j.bodyA.pointToWorldFrame(j.pivotA).distanceTo(j.bodyB.pointToWorldFrame(j.pivotB)));});g.bodies.forEach(function(b){assert(Number.isFinite(b.position.x+b.position.y+b.position.z));});}assert(gap<.08,'関節が離れない');return {score:g.pins.filter(function(p){return p.down;}).length,gap:gap,g:g};}
var forward=shot(.08,1/60),side=shot(Math.PI/2,1/60),back=shot(Math.PI,1/60);assert(forward.score>0);assert.equal(side.score,0);assert.equal(back.score,0);assert.equal(forward.g.bodies.length,11);assert.equal(forward.g.joints.length,10);assert.equal(P.pinScale,1.8);
var a=shot(.08,1/30),b=shot(.08,1/120);assert.equal(a.score,forward.score);assert.equal(b.score,forward.score);
var torso=forward.g.bodies[1].quaternion,arm=forward.g.bodies[3].quaternion;assert(Math.abs(torso.x-arm.x)+Math.abs(torso.y-arm.y)+Math.abs(torso.z-arm.z)>.1,'手足は胴体と別々に回転する');
console.log(JSON.stringify({正面:forward.score,横:side.score,後ろ:back.score,関節の最大隙間:forward.gap,ピン倍率:P.pinScale}));
