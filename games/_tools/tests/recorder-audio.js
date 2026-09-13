/* 録画開始前から存在する音の出口と、後から増える効果音を確認する。 */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('games/_tools/recorder-ui.js','utf8');
const code=source.slice(source.indexOf('  if (window.AudioNode'),source.indexOf('  function make('));
function Destination(){}
function Node(context){this.context=context;this.connections=[];}
Node.prototype.connect=function(destination){this.connections.push(destination);return destination;};
let created=0;
const context={createMediaStreamDestination(){created++;return {context:this,stream:{}};}};
const win={AudioNode:Node,AudioDestinationNode:Destination};
vm.runInNewContext(code,{window:win,AudioNode:Node,AudioDestinationNode:Destination});
const speakers=new Destination(),master=new Node(context);
assert.equal(master.connect(speakers),speakers);
assert.equal(created,1,'録画開始前でも音声トラックを用意する');
assert.deepEqual(master.connections,[speakers,win.__zRecorderSound],'既存の音も録音へ届く');
const effect=new Node(context);effect.connect(speakers);
assert.equal(created,1,'同じ音声トラックを再利用する');
assert.equal(effect.connections[1],win.__zRecorderSound);
master.connect(speakers);
assert.equal(master.connections.filter(v=>v===win.__zRecorderSound).length,1,'二重に録音しない');
const internal=new Node(context);internal.connect(master);
assert.equal(internal.connections.length,1,'途中の接続は録音に重ねない');
console.log('録画開始前の音・追加の効果音・二重録音防止：問題なし');
