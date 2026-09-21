/* 停止した音声を初回操作と指を離す操作で再開できるか確認する。 */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
for(const game of ['random-bowling','wanko','oushogi','_template']){
 const source=fs.readFileSync('games/'+game+'/index.html','utf8');
 function body(name){const start=source.indexOf('  function '+name+'(');let i=source.indexOf('{',start),depth=1;for(i++;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
 const events={};let calls=0,starts=0,warmups=[];
 function Context(){this.state='suspended';this.sampleRate=10;this.destination={};}
 Context.prototype.resume=function(){calls++;return Promise.resolve();};
 const node=()=>new Proxy({connect(){},disconnect(){},start(){starts++;warmups.push(this);},getChannelData(){return new Float32Array(20);}}, {get(t,k){return k in t?t[k]:t[k]={value:0};}});
 for(const name of ['createGain','createDynamicsCompressor','createBuffer','createBufferSource','createBiquadFilter'])Context.prototype[name]=node;
 const c={window:{AudioContext:Context},wrap:{addEventListener(n,f){events[n]=f;}},Float32Array,Math};
 vm.createContext(c);
 vm.runInContext(fs.readFileSync('games/audio.js','utf8'),c);
 vm.runInContext('var AC=null,NOISE=null,MASTER=null,hissGain=null,hissFilter=null,audioUnlocked=false;'+body('resumeAudio')+body('audioOn')+
 source.slice(source.indexOf('  wrap.addEventListener("touchstart"'),source.indexOf('  function audioOn()')),c);
 events.touchstart();assert.equal(calls,1,game+' 初回から再開');assert(starts>0,game+' 指を離す前に音源を開始');assert(warmups.some(n=>typeof n.onended==='function'),game+' 起動用の音源を再生');
 c.AC.state='interrupted';events.touchend();assert.equal(calls,2,game+' 中断から復帰');
 events.pointerup();assert.equal(calls,3,game+' 指を離したときにも再試行');
 c.AC.state='running';warmups.filter(n=>typeof n.onended==='function').forEach(n=>n.onended());const completed=starts;events.touchstart();assert.equal(calls,3);assert.equal(starts,completed,game+' 起動後は無音を繰り返さない');
 c.AC.state='closed';events.touchend();assert.equal(calls,3);
}
console.log('初回タッチ・中断復帰・指を離した再試行：4本とも問題なし');

// 共通処理は音声ごとに起動状態を持ち、失敗後の操作で再試行する。
(async function () {
 const c={window:{}};vm.createContext(c);
 vm.runInContext(fs.readFileSync('games/audio.js','utf8'),c);
 const resume=c.window.zAudioResume;
 function context(state){
  return {state,sampleRate:48000,destination:{},calls:0,nodes:[],lengths:[],
   resume(){this.calls++;return Promise.reject(new Error('再試行待ち'));},
   createBuffer(channels,length){this.lengths.push(length);return {};},
   createBufferSource(){const n={connect(){},disconnect(){this.disconnected=true;},start(){}};this.nodes.push(n);return n;}};
 }
 resume(null);
 const a=context('suspended');resume(a);await Promise.resolve();
 assert.equal(a.calls,1);assert.deepEqual(a.lengths,[1]);
 a.nodes[0].onended();resume(a);assert.equal(a.calls,2,'失敗後の操作で再試行');
 a.state='running';a.nodes[1].onended();resume(a);assert.equal(a.nodes.length,2,'起動済みなら無音を追加しない');
 assert(a.nodes[1].disconnected,'起動用音源を切り離す');
 const b=context('running');resume(b,128);assert.deepEqual(b.lengths,[128],'牛の起動音源の長さを保持');
 b.nodes[0].onended();resume(b);assert.equal(b.nodes.length,1,'別の音声の状態が混ざらない');
 a.state='interrupted';resume(a);assert.equal(a.calls,3,'中断後にも再開');
 a.state='closed';const count=a.nodes.length;resume(a);assert.equal(a.nodes.length,count);assert.equal(a.calls,3);
 const d=context('suspended');d.resume=function(){this.calls++;throw Error('一時失敗');};resume(d);resume(d);assert.equal(d.calls,2,'同期的な失敗でも再試行');
 for(const game of fs.readdirSync('games')){
  const file='games/'+game+'/index.html';if(!fs.existsSync(file))continue;
  const source=fs.readFileSync(file,'utf8');if(!source.includes('function resumeAudio()'))continue;
  assert(source.includes('<script src="../audio.js"></script>'),game+' 共通処理を読み込む');
  assert(!source.includes('audioUnlocked'),game+' 起動状態を二重管理しない');
 }
 await Promise.resolve();
 console.log('音声の分離・失敗後の再試行・起動音源の長さ・全ゲームの読み込み：問題なし');
})().catch(e=>{console.error(e);process.exitCode=1;});
