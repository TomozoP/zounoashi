/* 四つの音程、装備の操作音、腕と脚の衝突音を確認する。 */
const fs=require('fs'),assert=require('assert'),load=require('../harness');
const make=new Function(fs.readFileSync('games/shark-walk/music.js','utf8')+';return SharkPartSound;')();
const frequencies=[],outputs=[];
function param(){return{setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}};}
const ac={currentTime:1,state:'running',destination:{},createOscillator(){const f=param();f.exponentialRampToValueAtTime=v=>frequencies.push(v);return{frequency:f,connect(){},disconnect(){},start(){},stop(){}};},createGain(){return{gain:param(),connect(to){outputs.push(to);},disconnect(){}};}};
const hit=make(ac),groups=['leftLeg','rightLeg','leftArm','rightArm'];groups.forEach(hit);
assert.equal(frequencies.length,12);
[62,66,69,71].forEach((note,i)=>assert(Math.abs(frequencies[i*3]-440*Math.pow(2,(note-69)/12))<.001));
assert(outputs.every(o=>o===ac.destination),'録画と同じ出力に送る');hit('leftLeg');assert.equal(frequencies.length,15);ac.state='closed';hit('leftLeg');assert.equal(frequencies.length,15);

const g=load('games/shark-walk/index.html',{withScripts:true,inject:'  var heard=[];partSound=function(group,kind){heard.push([group,kind]);};window.__probe.heard=function(){return heard.slice();};'});
g.press(' ');['a','s','k','l'].forEach(k=>g.key(k));assert.deepEqual(g.probe.heard(),[],'腕と脚は押しただけでは鳴らない');
g.esc();g.press('a');g.press('a');g.press('k');g.press('k');g.press('l');g.press('l');g.press('l');
g.press(' ');['a','k','l'].forEach(k=>g.key(k));assert.deepEqual(g.probe.heard(),[['leftLeg','wheel'],['leftArm','jet'],['rightArm','balloon']],'装備ごとの効果音');
g.key('a');assert.equal(g.probe.heard().length,3,'長押し開始の重複を防ぐ');
const Walk=new Function(fs.readFileSync('games/shark-walk/walk.js','utf8')+';return SharkWalk;')();
let w=Walk();w.update(1/60);assert.equal(w.takeImpacts().length,0,'弱い接地は無音');
w=Walk();w.points.forEach(p=>p.py=p.y-4);w.update(1/60);assert.equal(w.takeImpacts().length,4,'強い衝突は各部位で鳴る');assert.equal(w.takeImpacts().length,0,'衝突は一回だけ取り出す');
w.update(1/60);assert.equal(w.takeImpacts().length,0,'接地直後は連打しない');
w=Walk({leftLeg:'wheel',rightLeg:'jet',leftArm:'balloon',rightArm:'wheel'});w.points.forEach(p=>p.py=p.y-4);w.update(1/60);assert.equal(w.takeImpacts().length,0,'装備に腕脚の衝突音を混ぜない');
console.log('和音・装備別の音・腕脚の衝突閾値・重複防止：確認済み');
