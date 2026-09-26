const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:
"window.__dbg={setup:function(get){window.navigator.mediaDevices={getUserMedia:get};AC={createAnalyser:function(){return {fftSize:1024,getFloatTimeDomainData:function(a){a.fill(.09);}};},createMediaStreamSource:function(){return {connect:function(){},disconnect:function(){}};}};},request:requestMic,crash:popBalloon,stop:stopMic};"});
(async()=>{
 let requests=0,stops=0;g.dbg.setup(async()=>{requests++;return {getTracks:()=>[{stop(){stops++;}}]};});
 g.probe.reset();await g.dbg.request();
 for(let i=0;i<4;i++){
  g.step(3);assert.equal(g.probe.now().air,1,'再挑戦でも音量で噴射する');
  assert(g.probe.now().vy<0);g.dbg.crash();g.step(91);
  await Promise.resolve();assert.equal(g.probe.now().state,'play');
 }
 assert.equal(requests,1,'再挑戦でマイクを再取得しない');assert.equal(stops,0,'死亡でマイクを切らない');
 g.dbg.stop();assert.equal(stops,1,'終了時には解放できる');
 console.log('4回の自動再開後も同じマイクから噴射・終了時の解放を確認');
})().catch(e=>{console.error(e);process.exitCode=1;});
