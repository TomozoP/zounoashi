/* 停止した音声を初回操作と指を離す操作で再開できるか確認する。 */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
for(const game of ['random-bowling','wanko','oushogi','_template']){
 const source=fs.readFileSync('games/'+game+'/index.html','utf8');
 function body(name){const start=source.indexOf('  function '+name+'(');let i=source.indexOf('{',start),depth=1;for(i++;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
 const events={};let calls=0;
 function Context(){this.state='suspended';this.sampleRate=10;this.destination={};}
 Context.prototype.resume=function(){calls++;return Promise.resolve();};
 const node=()=>new Proxy({connect(){},start(){},getChannelData(){return new Float32Array(20);}}, {get(t,k){return k in t?t[k]:t[k]={value:0};}});
 for(const name of ['createGain','createDynamicsCompressor','createBuffer','createBufferSource','createBiquadFilter'])Context.prototype[name]=node;
 const c={window:{AudioContext:Context},wrap:{addEventListener(n,f){events[n]=f;}},Float32Array,Math};
 vm.createContext(c);
 vm.runInContext('var AC=null,NOISE=null,MASTER=null,hissGain=null,hissFilter=null;'+body('resumeAudio')+body('audioOn')+
 source.slice(source.indexOf('  wrap.addEventListener("touchstart"'),source.indexOf('  function audioOn()')),c);
 events.touchstart();assert.equal(calls,1,game+' 初回から再開');
 c.AC.state='interrupted';events.touchend();assert.equal(calls,2,game+' 中断から復帰');
 events.pointerup();assert.equal(calls,3,game+' 指を離したときにも再試行');
 c.AC.state='running';events.touchstart();assert.equal(calls,3);
 c.AC.state='closed';events.touchend();assert.equal(calls,3);
}
console.log('初回タッチ・中断復帰・指を離した再試行：4本とも問題なし');
