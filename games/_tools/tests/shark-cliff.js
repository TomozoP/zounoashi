/* 後方の崖、落下、同じ構成での自動復帰を確認する。 */
const assert=require('assert'),fs=require('fs'),load=require('../harness');
const make=new Function(fs.readFileSync('games/_shark-walk/walk.js','utf8')+';return SharkWalk;')();
for(const type of ['leg','arm','wheel','jet']){
  const w=make(Object.fromEntries(['leftLeg','rightLeg','leftArm','rightArm'].map(k=>[k,type])));
  w.points.forEach(p=>{p.x-=700;p.px=p.x;});
  for(let i=0;i<240;i++)w.update(1/60);
  assert(w.now().fallen,'崖の外では脚や装備が見えない地面に乗らない');
}
const g=load('games/_shark-walk/index.html',{withScripts:true});g.press(' ');
const original=JSON.stringify(g.probe.now().equipment),keys=['a','s','k','l'];let last=0,reset=false;
for(let i=0;i<1200;i++){
  keys.forEach((k,j)=>g.key(k,(i+j*13)%90>=45));g.step(1);g.drawn.length=0;
  const n=g.probe.now();if(n.score<last){reset=true;assert.equal(n.state,'play');assert.equal(n.x,222.5);assert.equal(n.score,0);assert.equal(JSON.stringify(n.equipment),original);assert(!n.leftLegPressed&&!n.rightLegPressed&&!n.leftArmPressed&&!n.rightArmPressed);break;}last=n.score;
}
assert(reset,'後退して落ちると自動でやり直す');
console.log('後方の崖・落下・構成保持・入力解除・自動復帰：確認済み');
