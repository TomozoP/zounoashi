/* ラグドールの関節が離れず、実際の衝突でピンを倒すことを確認する。 */
var assert=require('assert'),P=require('../../_random-bowling/physics');
function shot(angle,dt,omega){var g=new P.Game();g.launch(angle,omega||14);var gap=0;while(!g.finished()){g.step(dt);g.joints.forEach(function(j){gap=Math.max(gap,j.bodyA.pointToWorldFrame(j.pivotA).distanceTo(j.bodyB.pointToWorldFrame(j.pivotB)));});g.bodies.forEach(function(b){assert(Number.isFinite(b.position.x+b.position.y+b.position.z));});}assert(gap<.08,'関節が離れない');return {score:g.pins.filter(function(p){return p.down;}).length,gap:gap,g:g};}
var forward=shot(Math.PI/2+.03,1/60),side=shot(0,1/60),back=shot(-Math.PI/2,1/60);assert(forward.score>0);assert.equal(side.score,0);assert.equal(back.score,0);assert.equal(forward.g.bodies.length,11);assert.equal(forward.g.joints.length,10);assert.equal(P.pinScale,4.5);
var a=shot(Math.PI/2+.03,1/30),b=shot(Math.PI/2+.03,1/120);assert.equal(a.score,forward.score);assert.equal(b.score,forward.score);
var torso=forward.g.bodies[1].quaternion,arm=forward.g.bodies[3].quaternion;assert(Math.abs(torso.x-arm.x)+Math.abs(torso.y-arm.y)+Math.abs(torso.z-arm.z)>.1,'手足は胴体と別々に回転する');
console.log(JSON.stringify({正面:forward.score,横:side.score,後ろ:back.score,関節の最大隙間:forward.gap,ピン倍率:P.pinScale}));

var fast=shot(Math.PI/2+.03,1/60,15.4);assert(fast.g.finished());console.log(JSON.stringify({最大回転の本数:fast.score,最大回転の関節の隙間:fast.gap}));

// 回転中も足首の拘束だけで振られ、離しても姿勢が飛び替わらない。
var held=new P.Game(),a=-Math.PI/2,gap=0,gripGap=0;held.startSwing(a);
for(var i=0;i<480;i++){var omega=1.8+13.6*(1-Math.exp(-(i+1)/60/2.3));a+=omega/60;held.swing(1/60,a);held.joints.forEach(function(j){gap=Math.max(gap,j.bodyA.pointToWorldFrame(j.pivotA).distanceTo(j.bodyB.pointToWorldFrame(j.pivotB)));});held.grabs.forEach(function(j){gripGap=Math.max(gripGap,j.bodyA.pointToWorldFrame(j.pivotA).distanceTo(j.bodyB.pointToWorldFrame(j.pivotB)));});}
assert(gap<.08&&gripGap<.03);var before=held.snapshot().human,ideal=P.swingPose(a,held.ringZ);assert(Math.hypot(before[2].x-ideal[2].x,before[2].y-ideal[2].y,before[2].z-ideal[2].z)>.1,'頭が台本どおりの位置に固定されていない');var heading=P.throwDirection(a);assert(Math.abs(heading.x-(before[2].x-before[0].x)/Math.hypot(before[2].x-before[0].x,before[2].z-before[0].z))>.001,'青の揺れと投げる向きが独立している');held.launch(a,15.4);assert.equal(held.grabs.length,0);assert.equal(held.hands.length,0);assert.equal(held.joints.length,10);var after=held.snapshot().human;after.forEach(function(p,i){assert.equal(p.x,before[i].x);assert.equal(p.y,before[i].y);assert(Math.abs(p.vx-heading.x*55)<.001);assert(Math.abs(p.vz-heading.z*55)<.001);});
console.log(JSON.stringify({回転中の関節の隙間:gap,足首の隙間:gripGap}));

var weak=shot(Math.PI/2,1/60,1.8);assert.equal(weak.score,0,'低速ではピンまで届かない');assert(weak.g.bodies[0].position.z<weak.g.ringZ+15,'低速では手前に落ちる');assert.equal(P.humanScale,1.5);
