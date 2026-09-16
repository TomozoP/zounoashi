/* マイクとゲーム音の合成、終了時の解放、許可拒否を確認する。 */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('games/_tools/recorder-ui.js','utf8');
const code=source.slice(source.indexOf('  function releaseMicrophone()'),source.indexOf('  function wait(ms)'));
async function check(mode){
  let stopped=0,closed=0,requested=0;const connections=[],listeners={};
  const mic={getTracks(){return [{stop(){stopped++;}}];}},game={stream:{}},mixed={stream:{getAudioTracks(){return ['合成音声'];}}};
  function Context(){this.resume=async()=>{};this.close=async()=>{closed++;};this.createMediaStreamDestination=()=>mixed;this.createMediaStreamSource=stream=>({connect(out){connections.push([stream,out]);}});}
  const sandbox={microphone:null,microphoneMix:null,leaving:mode==='leave',window:{AudioContext:Context,addEventListener(name,fn){listeners[name]=fn;}},navigator:{mediaDevices:{async getUserMedia(options){requested++;assert.equal(options.video,false);if(mode==='deny')throw Object.assign(Error(),{name:'NotAllowedError'});return mic;}}}};
  vm.createContext(sandbox);vm.runInContext(code,sandbox);
  if(mode==='deny'||mode==='leave'){
    await assert.rejects(()=>sandbox.microphoneTracks(game),mode==='deny'?/許可/:/中止/);
    assert.equal(connections.length,0);assert.equal(sandbox.microphone,null);
    if(mode==='leave')assert.equal(stopped,1);
  }else{
    const tracks=await sandbox.microphoneTracks(mode==='mic-only'?null:game);
    assert.equal(tracks[0],'合成音声');assert.equal(connections.length,mode==='mic-only'?1:2);
    assert.ok(connections.every(c=>c[1]===mixed),'スピーカーには流さない');
    listeners.pagehide();sandbox.releaseMicrophone();assert.equal(stopped,1);assert.equal(closed,1);
  }
  assert.equal(requested,1);
}
(async()=>{for(const mode of ['both','mic-only','deny','leave'])await check(mode);console.log('マイクとゲーム音の合成・許可拒否・終了時のマイク解放を確認。');})().catch(e=>{console.error(e);process.exitCode=1;});
