/* 組み替えと車輪・ジェットの力を確認する。 */
const fs=require('fs'),assert=require('assert'),load=require('../harness');
const make=new Function(fs.readFileSync('games/_shark-walk/walk.js','utf8')+';return SharkWalk;')();
const groups=['leftLeg','rightLeg','leftArm','rightArm'];
const g=load('games/_shark-walk/index.html',{withScripts:true});
g.press('a');g.press('a');g.press('l');g.press('l');g.step(20);
assert.equal(g.probe.now().state,'intro');assert.equal(g.probe.now().equipment.leftLeg,'wheel');assert.equal(g.probe.now().equipment.rightArm,'jet');
g.press(' ');assert.equal(g.probe.now().state,'play');assert(!g.probe.now().leftLegPressed,'開始操作を駆動に混ぜない');
g.key('a');g.esc();assert.equal(g.probe.now().state,'intro','Escは改造画面に戻る');assert(!g.probe.now().leftLegPressed,'操作を解除する');g.step(60);assert.equal(g.probe.now().x,222.5,'編集中は走行しない');g.key('a',true);assert.equal(g.probe.now().equipment.rightArm,'jet','やり直しても選択を保持');
g.press(' ');g.tap(45,93);assert.equal(g.probe.now().state,'intro','歯車で選び直せる');g.press('a');assert.equal(g.probe.now().equipment.leftLeg,'jet');
assert.equal(make({leftLeg:'arm'}).now().equipment.leftLeg,'arm','後ろ側にも腕を付けられる');assert.equal(make({rightArm:'leg'}).now().equipment.rightArm,'leg','前側にも脚を付けられる');
function all(type){return Object.fromEntries(groups.map(k=>[k,type]));}
function center(w){return w.points.reduce((s,p)=>s+p.x/p.w,0)/w.points.reduce((s,p)=>s+1/p.w,0);}
const wheels=make(all('wheel'));let traction=false,roll=false;
for(let i=0;i<600;i++){groups.forEach((k,n)=>wheels.set(k,(i+n*20)%90<45));wheels.update(1/60);for(const j of wheels.joints){const p=j.c;assert(Math.abs(p.traction)<=p.gripLimit+1e-9,'摩擦力は接地荷重による上限を超えない');traction=traction||Math.abs(p.traction)>.1;roll=roll||Math.abs(wheels.now().spins[j.name])>.1;}}
assert(traction&&roll,'脚の動きと接地摩擦でタイヤが転がる');
function jointAngle(j){let u=Math.atan2(j.a.y-j.b.y,j.a.x-j.b.x),v=Math.atan2(j.c.y-j.b.y,j.c.x-j.b.x);return Math.abs(Math.atan2(Math.sin(v-u),Math.cos(v-u)));}
const air=make(all('wheel'));air.points.forEach(p=>{p.y-=2000;p.py-=2000;});let start=center(air);groups.forEach(k=>air.set(k,true));for(let i=0;i<30;i++)air.update(1/60);
assert(Math.abs(center(air)-start)<.001,'空中で前進力を加えない');
assert(air.joints.every(j=>jointAngle(j)>1.2),'駆動ボタンで関節を折り畳まない');
assert(groups.every(k=>air.now().wheelSpeed[k]>1),'押すと空中でもタイヤが回る');
groups.forEach(k=>air.set(k,false));for(let i=0;i<30;i++)air.update(1/60);
assert(air.joints.every(j=>Math.abs(jointAngle(j)-2.3)<.6),'解放後にばねの角度へ戻る');
assert(air.joints.every(j=>Math.abs(Math.hypot(j.b.x-j.c.x,j.b.y-j.c.y)-j.length)<1),'タイヤは関節の先に繋がる');
assert(air.joints.every(j=>j.c.traction===0),'空中では摩擦による推進力がない');
for(const type of ['wheel','jet']){
  const standing=make(all(type));for(let i=0;i<600;i++)standing.update(1/60);
  assert(standing.rear.y<-100&&standing.front.y<-100,'無操作で10秒経っても装備の脚が胴体を支える');
  assert(Math.abs(standing.now().angle)<.15,'平地で前後の脚が釣り合う');
  const spring=make(all(type));spring.points.forEach(p=>{p.y-=4000;p.py=p.y;});
  const j=spring.joints[0],u=Math.atan2(j.a.y-j.b.y,j.a.x-j.b.x)+j.sign*.9;
  j.c.x=j.b.x+Math.cos(u)*j.length;j.c.y=j.b.y+Math.sin(u)*j.length;j.c.px=j.c.x;j.c.py=j.c.y;
  assert(jointAngle(j)<1,'関節を圧縮した状態から確認');
  for(let i=0;i<180;i++)spring.update(1/60);
  assert(Math.abs(jointAngle(j)-2.3)<.25,'車輪とジェットのばねが自然角度へ戻る');
  assert(Math.hypot(j.a.x-j.c.x,j.a.y-j.c.y)>100,'装置は胴体へ直付けせず脚の先にある');
}
for(const inverted of [false,true]){const jet=make(all('jet'));jet.points.forEach(p=>{if(inverted){p.x=445-p.x;p.y=-282-p.y;}p.y-=2000;p.px=p.x;p.py=p.y;});start=center(jet);groups.forEach(k=>jet.set(k,true));for(let i=0;i<15;i++)jet.update(1/60);assert(inverted?center(jet)<start-1:center(jet)>start+1,'噴射は胴体の向きに従う');}
g.press('a');assert.equal(g.probe.now().equipment.leftLeg,'balloon','風船を選べる');g.press('a');assert.equal(g.probe.now().equipment.leftLeg,'leg','風船の次は脚に戻る');
function height(w){return w.points.reduce((s,p)=>s+p.y/p.w,0)/w.points.reduce((s,p)=>s+1/p.w,0);}
let passiveHeight;
for(const active of [false,true]){const w=make(all('balloon'));w.points.forEach(p=>{p.y-=3000;p.py=p.y;});const x=center(w),y=height(w);groups.forEach(k=>w.set(k,active));for(let i=0;i<120;i++)w.update(1/60);if(active)assert(height(w)<y-50,'風船の浮力で胴体ごと上がる');assert(w.balloons.leftLeg.r>(active?35:0)&&w.balloons.leftLeg.r<(active?38:16),'風船は非操作時にしぼむ');assert(Math.abs(center(w)-x)<.001,'風船は横向きの補正を加えない');if(active)assert(height(w)<passiveHeight-100,'押すと浮力が強まる');else passiveHeight=height(w);}
for(let c=0;c<625;c++){let n=c,parts={};groups.forEach(k=>{parts[k]=['leg','arm','wheel','jet','balloon'][n%5];n=Math.floor(n/5);});const w=make(parts);for(let f=0;f<180;f++){groups.forEach((k,i)=>w.set(k,(f+i*17)%70<35));w.update(1/60);}assert(w.now().finite,'混ぜたパーツで計算が壊れない');}
console.log('選択・開始・保持・選び直し・車輪の接地・噴射方向・625通りの組み合わせ：確認済み');

assert.equal(g.probe.now().goal,3200,'延長したコースを保持');assert(make().ground(2220)<-80,'追加した山を保持');
// 選択と出発は押した瞬間ではなく、同じ場所で離したときに確定する。
function fire(name,x,y){g.wrap.fire(name,{pointerId:7,clientX:x,clientY:y,button:0,isPrimary:true,preventDefault(){}});}
let b=g.probe.now().controls[1],before=g.probe.now().equipment.rightLeg;fire('pointerdown',b.x,b.y);assert.equal(g.probe.now().equipment.rightLeg,before);fire('pointercancel',b.x,b.y);assert.equal(g.probe.now().equipment.rightLeg,before);fire('pointerdown',b.x,b.y);fire('pointerup',b.x,b.y);assert.notEqual(g.probe.now().equipment.rightLeg,before);
let y=g.probe.now().H*.94;fire('pointerdown',270,y);assert.equal(g.probe.now().state,'intro');fire('pointerup',270,y);assert.equal(g.probe.now().state,'play');assert(!g.probe.now().leftLegPressed&&!g.probe.now().rightArmPressed);
assert(!fs.readFileSync('games/_shark-walk/index.html','utf8').includes('id="start"'),'STARTボタンは戻さない');
