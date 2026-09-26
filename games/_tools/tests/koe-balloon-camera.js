/* 実際の映像を撮らず、顔位置・鏡の左右・拒否・取消と解放を確認する。 */
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
let code=fs.readFileSync(path.join(__dirname,'../../_koe-balloon/camera.js'),'utf8');
code=code.replace('async function detector(){','async function detector(){return global.__detector();}\n async function unusedDetector(){');
let stopped=0,request,detectCalls=0;
const video=()=>({muted:false,playsInline:false,setAttribute(){},play:async()=>{},pause(){},readyState:2,videoWidth:320,currentTime:1});
const stream=()=>({getTracks:()=>[{stop(){stopped++;}}]});
const win={navigator:{mediaDevices:{getUserMedia:()=>request()}},__detector:async()=>({detectForVideo(){detectCalls++;return {detections:[]};}})};
const doc={hidden:false,createElement:video};
vm.runInNewContext(code,{window:win,document:doc,console:{warn(){}},setTimeout,clearTimeout});
const face=new win.FaceSteering();
const hit=x=>[{boundingBox:{originX:x*320-40,originY:30,width:80,height:100}}];
const game=require('../harness')('games/_koe-balloon/index.html',{inject:`
  camera={status:'active',found:true,vector:0,tick:function(){},stop:function(){},start:function(){}};
  window.__dbg={face:function(v,found){camera.vector=v;camera.found=found;}};
`});
game.probe.reset();game.dbg.face(-1,true);game.step(20);assert(game.probe.now().x<250,'顔の左入力がゲームへ届く');
game.dbg.face(1,true);game.step(40);assert(game.probe.now().x>270,'顔の右入力がゲームへ届く');
game.dbg.face(0,false);const paused=game.probe.now();game.step(100);
assert.equal(game.probe.now().altitude,paused.altitude,'顔を見失うと止まる');assert.equal(game.probe.now().x,paused.x);
(async()=>{
 request=async()=>stream();await face.start();assert.equal(face.status,'active');
 for(let i=0;i<5;i++)face.accept(hit(.5),320,i*100);
 assert(face.found);assert.equal(face.vector,0);
 face.accept(hit(.7),320,600);assert(face.vector<-.5,'自分の左へ動くと左');
 face.accept(hit(.3),320,700);face.accept(hit(.3),320,800);assert(face.vector>.5,'自分の右へ動くと右');
 face.accept([],320,1300);assert.equal(face.vector,0);assert(!face.found,'顔が消えたら止まる');
 face.tick(1500);assert.equal(detectCalls,1);face.tick(1600);assert.equal(detectCalls,1,'同じ映像を繰り返さない');
 face.stop();assert.equal(stopped,1);assert.equal(face.video,null);
 request=async()=>{throw Error('拒否');};await face.start();assert.equal(face.status,'error');
 let resolve;request=()=>new Promise(r=>resolve=r);const pending=face.start();face.stop();resolve(stream());await pending;
 assert.equal(stopped,2,'取消後に届いたカメラも止める');assert.equal(face.status,'idle');
 console.log('顔の中立位置・左右・顔消失・映像更新・拒否・取消を確認');
})().catch(e=>{console.error(e);process.exitCode=1;});
