/* 四つの音程と、指・キーの押し始めだけで鳴ることを確認する。 */
const fs=require('fs'),assert=require('assert'),load=require('../harness');
const make=new Function(fs.readFileSync('games/shark-walk/music.js','utf8')+';return SharkPartSound;')();
const frequencies=[],outputs=[];
function param(){return{setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}};}
const ac={currentTime:1,state:'running',destination:{},createOscillator(){const f=param();f.exponentialRampToValueAtTime=v=>frequencies.push(v);return{frequency:f,connect(){},disconnect(){},start(){},stop(){}};},createGain(){return{gain:param(),connect(to){outputs.push(to);},disconnect(){}};}};
const hit=make(ac),groups=['leftLeg','rightLeg','leftArm','rightArm'];groups.forEach(hit);
assert.equal(frequencies.length,12);
[62,66,69,71].forEach((note,i)=>assert(Math.abs(frequencies[i*3]-440*Math.pow(2,(note-69)/12))<.001));
assert(outputs.every(o=>o===ac.destination),'録画と同じ出力に送る');hit('leftLeg');assert.equal(frequencies.length,15);ac.state='closed';hit('leftLeg');assert.equal(frequencies.length,15);
const g=load('games/shark-walk/index.html',{withScripts:true,inject:'  var heard=[];partSound=function(group){heard.push(group);};window.__probe.heard=function(){return heard.slice();};'});
g.press(' ');assert.deepEqual(g.probe.heard(),[],'出発操作では四肢の音を鳴らさない');
['a','s','k','l'].forEach(k=>g.key(k));assert.deepEqual(g.probe.heard(),groups,'四つ同時に重ねられる');
g.key('a');assert.equal(g.probe.heard().length,4,'長押しを重複させない');
const b=g.probe.now().controls[0];g.down(b.x,b.y);g.key('a',true);assert.equal(g.probe.heard().length,4,'同じ部位に指を足しても重複しない');g.up();
g.down(b.x,b.y);assert.equal(g.probe.heard().length,5,'離して押し直すと鳴る');g.wrap.fire('pointercancel',{pointerId:1});assert.equal(g.probe.heard().length,5,'取消では鳴らない');
console.log('四つの音程・和音・指とキー・最初の操作・重複防止：確認済み');
