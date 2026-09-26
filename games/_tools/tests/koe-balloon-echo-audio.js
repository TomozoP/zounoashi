/* 人の音声を使わず、録音データの保持・同時再生・停止を検証する。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:
"window.__dbg={test:function(){"+
"var starts=[],stops=0,carriers=0,released=0;AC={sampleRate:1000,destination:{},createBuffer:function(c,n,r){var data=new Float32Array(n);return {duration:n/r,getChannelData:function(){return data;}};},createBufferSource:function(){return {disconnect:function(){},connect:function(){},start:function(t,o){starts.push(o);},stop:function(){stops++;}};},createGain:function(){return {gain:{},connect:function(){},disconnect:function(){}};},createBiquadFilter:function(){return {frequency:{},Q:{},connect:function(){},disconnect:function(){}};},createOscillator:function(){return {frequency:{},connect:function(){},disconnect:function(){},start:function(){carriers++;},stop:function(){released++;}};}};"+
"newRound();T=1;track=[{y:.5,air:0},{y:.5,air:1}];capture=[{time:.1,data:new Float32Array(1000).fill(.4)},{time:.9,data:new Float32Array(500).fill(.2)}];saveAttempt();"+
"var recorded=history[0].audio.getChannelData(0),sample=recorded[101],boundary=[recorded[999],recorded[1000],recorded.length];newRound();T=1;track=[{y:.5,air:0},{y:.5,air:1}];capture=[{time:0,data:new Float32Array(1000).fill(.3)}];saveAttempt();"+
"newRound();startReplay();startReplay();var count=starts.length;stopReplay();return {sample:sample,boundary:boundary,count:count,starts:starts,stops:stops,capture:capture.length,carriers:carriers,released:released};}};"});
const p=g.dbg.test();assert(Math.abs(p.sample-.4)<.001);assert.equal(p.count,2);assert(Math.abs(p.boundary[0]-.4)<.001&&Math.abs(p.boundary[1]-.2)<.001);assert.equal(p.boundary[2],1500,"描画時刻がずれても録音に隙間や重複を作らない");
assert(p.starts[0]>p.starts[1],'古い声ほど先行');assert.equal(p.stops,2);assert.equal(p.capture,0);assert.equal(p.carriers,2);assert.equal(p.released,2,'再生停止でロボ加工も停止');
console.log('録音の時刻・2本の同時再生・先行時間・重複防止・停止を確認');
