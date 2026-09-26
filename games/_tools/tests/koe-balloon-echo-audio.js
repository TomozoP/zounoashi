/* 人の音声を使わず、録音データの保持・同時再生・停止を検証する。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:
"window.__dbg={test:function(){"+
"var starts=[],stops=0;AC={sampleRate:1000,destination:{},createBuffer:function(c,n,r){var data=new Float32Array(n);return {duration:n/r,getChannelData:function(){return data;}};},createBufferSource:function(){return {connect:function(){},start:function(t,o){starts.push(o);},stop:function(){stops++;}};},createGain:function(){return {gain:{},connect:function(){}};}};"+
"newRound();T=1;track=[{y:.5,air:0},{y:.5,air:1}];capture=[{time:.1,data:new Float32Array([.2,.4,.1])}];saveAttempt();"+
"var sample=history[0].audio.getChannelData(0)[101];newRound();T=1;track=[{y:.5,air:0},{y:.5,air:1}];capture=[{time:0,data:new Float32Array([.3])}];saveAttempt();"+
"newRound();startReplay();startReplay();var count=starts.length;stopReplay();return {sample:sample,count:count,starts:starts,stops:stops,capture:capture.length};}};"});
const p=g.dbg.test();assert(Math.abs(p.sample-.4)<.001);assert.equal(p.count,2);
assert(p.starts[0]>p.starts[1],'古い声ほど先行');assert.equal(p.stops,2);assert.equal(p.capture,0);
console.log('録音の時刻・2本の同時再生・先行時間・重複防止・停止を確認');
