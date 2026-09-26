const assert=require('assert'),load=require('../harness');
const g=load('games/koe-balloon/index.html',{inject:
"window.__dbg={test:function(){var values=[],starts=0;AC={currentTime:0,destination:{},createBufferSource:function(){return {connect:function(){},start:function(){starts++;}};},createBiquadFilter:function(){return {frequency:{},Q:{},connect:function(){}};},createGain:function(){return {gain:{setTargetAtTime:function(v){values.push(v);}},connect:function(){}};}};NOISE={};newRound();replayGhosts=[{air:1}];updateJetSound();held=true;updateJetSound();held=false;updateJetSound();newRound(true);updateJetSound();state=S.RESULT;updateJetSound();return {values:values,starts:starts};}};"});
const p=g.dbg.test();assert.equal(p.starts,1,'音源を使い回す');assert.deepEqual(p.values,[0,.055,0,0,0],'自分の噴射中だけ鳴り、過去の機体・停止・結果では鳴らない');
console.log('自分だけのジェット音・停止・再挑戦での音源再利用を確認');
