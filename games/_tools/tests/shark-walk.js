/* 曲げ伸ばしの独立操作、二本指、接地による前進を確認する。 */
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const load=require('../harness');
const g=load('games/_shark-walk/index.html',{withScripts:true});
function now(){return g.probe.now();}
function step(n){g.step(n);g.drawn.length=0;assert(now().finite);}
function pointer(type,id,group){const b=now().controls.find(b=>b.id===group);g.wrap.fire(type,{pointerId:id,clientX:b.x,clientY:b.y,button:0,isPrimary:id===1,preventDefault(){}});}
g.step(180);assert.equal(now().state,'intro');
g.press(' ');assert.equal(now().state,'play');assert(!now().legPressed&&!now().armPressed);
step(600);assert(Math.abs(now().x-222.5)<10,'放置しても前進し続けない');assert(now().contacts>0);
g.tap(270,200);assert(!now().legPressed&&!now().armPressed,'ボタン外では曲がらない');
pointer('pointerdown',1,'leg');step(30);assert(now().leg>.95&&now().arm<.01,'脚だけ曲がる');
pointer('pointerdown',2,'arm');step(30);assert(now().leg>.95&&now().arm>.95,'二本指で同時に曲がる');
pointer('pointerup',1,'leg');step(30);assert(now().leg<.01&&now().arm>.95,'片方を離しても他方を保持');
pointer('pointercancel',2,'arm');step(30);assert(!now().armPressed&&now().arm<.01);
g.key('a');pointer('pointerdown',1,'leg');pointer('pointerup',1,'leg');assert(now().legPressed,'指を離してもキーで保持');
g.key('d');g.win.fire('blur',{});assert(!now().legPressed&&!now().armPressed,'画面外へ移ると解除');
g.esc();
let frames=0;
while(now().state==='play'&&frames<7200){g.key('a');step(21);g.key('d');step(21);g.key('a',true);step(21);g.key('d',true);step(21);frames+=84;}
assert.equal(now().state,'result','脚と腕を曲げ伸ばししてゴールへ着く');assert(now().x>=2500);
console.log('交互に曲げ伸ばしして到着：'+now().score+'秒');
g.esc();assert.equal(now().state,'play');assert(!now().legPressed&&!now().armPressed);
load.SHAPES.forEach(v=>{g.view(v[0],v[1]);step(20);let b=now().controls;assert(b[1].x-b[0].x>63);assert(b.every(b=>b.y+b.r<now().H));});
// 空中では筋力がサメ全体を横へ加速させない。地面の反力だけで進む。
const scope={};vm.createContext(scope);vm.runInContext(fs.readFileSync('games/_shark-walk/walk.js','utf8'),scope);
const air=scope.SharkWalk();air.points.forEach(p=>{p.y-=1000;p.py-=1000;});
function center(w){return w.points.reduce((v,p)=>v+p.x/p.w,0)/w.points.reduce((v,p)=>v+1/p.w,0);}
const x=center(air);for(let i=0;i<30;i++){air.set('leg',i<15);air.set('arm',i>10);air.update(1/60);}assert(Math.abs(center(air)-x)<.001,'空中で横向きの力を足さない');
for(const group of ['leg','arm','both']){const w=scope.SharkWalk();w.set('leg',group!=='arm');w.set('arm',group!=='leg');for(let i=0;i<1200;i++)w.update(1/60);const before=w.now().x;for(let i=0;i<600;i++)w.update(1/60);assert(Math.abs(w.now().x-before)<2,'押しっぱなしで自動走行しない');}
console.log('開始・独立操作・二本指・取消・混合入力・到着・再挑戦・画面6種類・空中の力・長押し：確認済み');
