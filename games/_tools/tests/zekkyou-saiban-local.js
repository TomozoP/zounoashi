/* 外部認識へ切り替わらないことを試験用の認識器で確認する。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/_zekkyou-saiban/index.html',{inject:`window.__dbg={start:startRecognition,stop:stopRecognition,set:function(R){window.SpeechRecognition=R;}};`});
(async()=>{let starts=0;function R(){}R.prototype.start=function(){assertLocal(this);starts++;};R.prototype.abort=function(){};
function assertLocal(r){assert.equal(r.processLocally,true);}
g.probe.reset();g.dbg.set(R);await g.dbg.start();assert.equal(starts,0,'端末内処理非対応では開始しない');
R.prototype.processLocally=false;R.available=async o=>{assert.equal(o.processLocally,true);return 'unavailable';};await g.dbg.start();assert.equal(starts,0,'日本語モデルなしでは開始しない');
R.available=async()=> 'available';await g.dbg.start();assert.equal(starts,1);assert.equal(g.probe.now().mode,'words');g.dbg.stop();console.log('端末内処理の必須指定・非対応時の停止を確認');})().catch(e=>{console.error(e);process.exitCode=1;});
