/* 曲げ伸ばしの独立操作、複数指、接地による前進を確認する。 */
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const load=require('../harness');
const g=load('games/_shark-walk/index.html',{withScripts:true});
function now(){return g.probe.now();}
function step(n){g.step(n);g.drawn.length=0;assert(now().finite);}
function pointer(type,id,group){const b=now().controls.find(b=>b.id===group);g.wrap.fire(type,{pointerId:id,clientX:b.x,clientY:b.y,button:0,isPrimary:id===1,preventDefault(){}});}
g.step(180);assert.equal(now().state,'intro');
g.press(' ');assert.equal(now().state,'play');assert(!now().leftLegPressed&&!now().leftArmPressed);
step(600);assert(now().state==='play','放置してもゴール扱いにしない');assert(now().contacts>0);
g.tap(270,200);assert(!now().leftLegPressed&&!now().leftArmPressed,'ボタン外では曲がらない');
pointer('pointerdown',1,'leftLeg');step(30);assert(now().leftLeg>.95&&now().leftArm<.01,'脚だけ曲がる');
pointer('pointerdown',2,'leftArm');step(30);assert(now().leftLeg>.95&&now().leftArm>.95,'二本指で同時に曲がる');
pointer('pointerup',1,'leftLeg');step(30);assert(now().leftLeg<.01&&now().leftArm>.95,'片方を離しても他方を保持');
pointer('pointercancel',2,'leftArm');step(30);assert(!now().leftArmPressed&&now().leftArm<.01);
g.key('a');pointer('pointerdown',1,'leftLeg');pointer('pointerup',1,'leftLeg');assert(now().leftLegPressed,'指を離してもキーで保持');
g.key('k');g.win.fire('blur',{});assert(!now().leftLegPressed&&!now().leftArmPressed,'画面外へ移ると解除');
g.esc();
const groups=['leftLeg','rightLeg','leftArm','rightArm'];
for(const group of groups){pointer('pointerdown',1,group);step(30);for(const other of groups)assert(other===group?now()[other]>.95:now()[other]<.01,'四肢の曲げ量が独立している');pointer('pointerup',1,group);step(30);}
groups.forEach((group,i)=>pointer('pointerdown',i+1,group));step(30);assert(groups.every(group=>now()[group]>.95),'四本同時に保持できる');
groups.forEach((group,i)=>{pointer('pointerup',i+1,group);assert(groups.every((other,j)=>now()[other+'Pressed']===(j>i)),'一本ずつ独立して離せる');});
g.esc();
// 前進できるようには調整しない。操作中の安定性だけを見る。
for(let i=0;i<20;i++){g.key('a');g.key('s');step(21);g.key('k');g.key('l');step(21);g.key('a',true);g.key('s',true);step(21);g.key('k',true);g.key('l',true);step(21);}
g.esc();assert.equal(now().state,'play');assert(!now().leftLegPressed&&!now().leftArmPressed);
load.SHAPES.forEach(v=>{g.view(v[0],v[1]);step(20);let b=now().controls;assert.equal(b.length,4);for(let i=1;i<4;i++){assert(b[i].x-b[i-1].x>63);assert(b[i].x-b[i-1].x>b[i].r+b[i-1].r);}assert(b.every(b=>b.y+b.r<now().H));});
// 空中では筋力がサメ全体を横へ加速させない。地面の反力だけで進む。
const scope={};vm.createContext(scope);vm.runInContext(fs.readFileSync('games/_shark-walk/walk.js','utf8'),scope);
const air=scope.SharkWalk();air.points.forEach(p=>{p.y-=1000;p.py-=1000;});
function center(w){return w.points.reduce((v,p)=>v+p.x/p.w,0)/w.points.reduce((v,p)=>v+1/p.w,0);}
const x=center(air);for(let i=0;i<30;i++){air.set('leftLeg',i<15);air.set('leftArm',i>10);air.update(1/60);}assert(Math.abs(center(air)-x)<.001,'空中で横向きの力を足さない');
// 頭が後ろ向きのまま落としても、正面へ自動復帰しない。
const inverted=scope.SharkWalk();inverted.points.forEach(p=>{p.x=445-p.x;p.px=p.x;p.y=-800-p.y;p.py=p.y;});
for(let i=0;i<900;i++)inverted.update(1/60);
assert(inverted.front.x<inverted.rear.x,'ひっくり返った姿勢を強制的に戻さない');
const reverse=scope.SharkWalk();let minX=222.5,maxAngle=0;
for(let i=0;i<2400;i++){groups.forEach((k,j)=>reverse.set(k,(i+j*13)%90<45));reverse.update(1/60);assert(reverse.now().finite);minX=Math.min(minX,reverse.now().x);maxAngle=Math.max(maxAngle,Math.abs(reverse.now().angle));}
assert(minX<172.5,'後退を許す');assert(maxAngle>Math.PI/2,'胴体の反転を許す');
console.log('後退の最小位置：'+minX.toFixed(1)+'、最大の傾き：'+(maxAngle*180/Math.PI).toFixed(1)+'度');
console.log('四肢独立・複数指・取消・画面6種類・空中の力・後退・反転：確認済み');
