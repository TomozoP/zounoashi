/* 実際のマイクは使わず、許可待ち・拒否・音量計算・解放を確認する。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:`
  window.__dbg={
    setup:function(get){
      window.navigator.mediaDevices={getUserMedia:get};
      AC={createAnalyser:function(){return {fftSize:1024,getFloatTimeDomainData:function(a){a.fill(window.__dbg.volume);}};},
        createMediaStreamSource:function(){return {connect:function(){},disconnect:function(){}};}};
    },
    volume:0, request:requestMic, stop:stopMic, read:readVoice,
    hidden:function(v){document.hidden=v;document.dispatchEvent({type:'visibilitychange'});}
  };
`});
(async()=>{
  let accept,stopped=0;
  const stream={getTracks:()=>[{stop(){stopped++;}}]};
  g.dbg.setup(()=>new Promise(r=>accept=r));g.probe.reset();
  const pending=g.dbg.request();g.step(180);
  assert(g.probe.now().micPending);assert.equal(g.probe.now().score,0,'許可待ちでは進まない');
  accept(stream);await pending;assert(!g.probe.now().micPending);
  g.dbg.volume=.005;assert.equal(g.dbg.read(),0,'小さい雑音を除く');
  g.dbg.volume=.09;assert.equal(g.dbg.read(),1,'声の音量を拾う');
  g.step(6);assert(g.probe.now().air>.95,'マイク入力で噴射');
  g.dbg.volume=0;g.step(6);assert(g.probe.now().air<.3,'無音で停止');
  g.dbg.stop();assert.equal(stopped,1,'マイクを解放');
  g.dbg.setup(()=>Promise.reject(Error('拒否')));await g.dbg.request();
  assert(g.probe.now().micError);assert(!g.probe.now().micPending);
  g.probe.reset();g.key(' ');await Promise.resolve();await Promise.resolve();g.step(30);assert(g.probe.now().air>.8,'拒否後も長押しで試せる');
  await Promise.resolve();
  g.dbg.setup(()=>new Promise(r=>accept=r));const late=g.dbg.request();
  g.dbg.hidden(true);accept(stream);await late;assert.equal(stopped,2,'非表示後に届いたマイクも解放');
  console.log('マイクの許可待ち・音量・無音・拒否・解放を確認');
})().catch(e=>{console.error(e);process.exitCode=1;});
