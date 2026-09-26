/* 許可待ち・声量・拒否・終了時のマイク解放を確認。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/_zekkyou-saiban/index.html',{inject:`
 window.__dbg={volume:0,setup:function(get){window.navigator.mediaDevices={getUserMedia:get};AC={createAnalyser:function(){return {fftSize:1024,getFloatTimeDomainData:function(a){a.fill(window.__dbg.volume);}};},createMediaStreamSource:function(){return {connect:function(){},disconnect:function(){}};}};},select:function(){selected=current.answer;},request:requestMic,read:readVoice};tone=function(){};noiseHit=function(){};
`});
(async()=>{let accept,stopped=0;g.dbg.setup(()=>new Promise(r=>accept=r));g.probe.reset();const request=g.dbg.request();g.step(600);assert.equal(g.probe.now().time,0);accept({getTracks:()=>[{stop(){stopped++;}}]});await request;
g.dbg.volume=.005;assert.equal(g.dbg.read(),0);g.dbg.volume=.09;g.dbg.select();g.step(30);assert(g.probe.now().won);assert.equal(stopped,1);
g.dbg.setup(()=>Promise.reject(Error('拒否')));await g.dbg.request();assert(g.probe.now().micError);g.probe.reset();g.dbg.select();g.key(' ');g.step(30);assert(g.probe.now().won,'マイク拒否時もキーで試せる');console.log('マイク待機・声量による勝訴・解放・拒否後の代替操作を確認');})().catch(e=>{console.error(e);process.exitCode=1;});
