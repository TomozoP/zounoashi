/* 出力先ごとにゲーム音とマイク音が正しく振り分けられることを確認する。 */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('games/_tools/recorder-ui.js','utf8');
const code=source.slice(source.indexOf('    var audioTracks='),source.indexOf("    output=document.createElement('canvas');"));
(async()=>{
for(const mode of ['combined','microphone','audio'])for(const mic of [false,true]){
  if(mode==='microphone'&&!mic)continue;
  function Recorder(stream){this.stream=stream;}Recorder.isTypeSupported=()=>true;
  const c={requestAnimationFrame:callback=>callback(0),window:{__zRecorderSound:{stream:{getAudioTracks:()=>['ゲーム音']}}},microphone:{getAudioTracks:()=>['声']},microphoneTracks:async()=>['合成音'],separateMode:mode,useMicrophone:mic,MediaStream:function(tracks){this.tracks=tracks;},MediaRecorder:Recorder,Blob,fail(){},separateRecorder:null,separateDone:null};
  vm.createContext(c);await vm.runInContext('(async()=>{'+code+'return {video:audioTracks,audio:separateTracks};})()',c).then(r=>{
    assert.deepEqual(Array.from(r.video),mode==='audio'?[]:mode==='microphone'||!mic?['ゲーム音']:['合成音']);
    assert.deepEqual(Array.from(r.audio),mode==='combined'?[]:mode==='microphone'?['声']:mic?['合成音']:['ゲーム音']);
  });
  if(c.separateRecorder){c.separateRecorder.ondataavailable({data:new Blob(['音'])});c.separateRecorder.onstop();assert.ok((await c.separateDone).size>0);}
}
console.log('動画・マイクだけ・全音声の振り分けと音声ファイルの確定を確認。');
})().catch(e=>{console.error(e);process.exitCode=1;});
