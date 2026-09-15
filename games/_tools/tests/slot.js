/* 100列の停止順、横移動、同じ絵柄の連続数を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_slot/index.html';
function play(sequence, shape, keyboard) {
  const g = load(file, {quiet:true});
  g.view(...shape);
  assert.equal(g.probe.now().state, 'play', '開いたらすぐ回る');
  const initial=g.probe.now().reels.slice();g.step(1);
  assert.notDeepEqual(g.probe.now().reels,initial,'入力なしで回転する');
  assert.equal(g.probe.now().nextReel, 0);
  assert.equal(g.probe.now().remaining,100);
  assert.equal(g.probe.now().reels.length, 100);
  g.tap(130, g.probe.now().H / 2);
  assert.equal(g.probe.now().nextReel, 0, '本体を押しても止まらない');
  let longest = 0, run = 0;
  sequence.forEach((target, i) => {
    let frames = 0;
    while (Math.round(g.probe.now().reels[i]) % 4 !== target && frames++ < 61) g.step(1);
    assert.ok(frames <= 61, '一周以内に狙った絵柄が来る');
    if (keyboard) g.press(' ');
    else g.tap(270, g.probe.now().buttonY);
    let now = g.probe.now();
    assert.equal(now.nextReel, i + 1);
    assert.equal(now.remaining, 99-i);
    assert.equal(now.speed,4+increments[target]*Math.floor((i+1)/10));
    if((i+1)%10===0) assert.equal(now.milestone,0.8,"10連ごとに節目の演出");
    assert.ok(now.flash>0);
    assert.equal(now.reels[i], target);
    assert.ok(now.stopped.slice(0, i+1).every(Boolean));
    assert.ok(now.stopped.slice(i+1).every(v => !v));
    assert.equal(now.state, i === 99 ? 'result' : 'play', '100列目でだけ終了');
    run = i > 0 && sequence[i-1] === target ? run+1 : 1;
    longest = Math.max(longest, run);
    assert.equal(now.score, longest);
    g.step(12);
    assert.equal(g.probe.now().reels[i], target, '止めた列は動かない');
  });
  g.step(30);
  const now = g.probe.now();
  assert.equal(now.camera, 97*140, '末尾まで移動する');
  assert.ok(now.buttonY+58 < now.H, 'ボタンが画面内に収まる');
  assert.ok(now.celebration>7);
  assert.equal(now.confetti,220);
  assert.equal(now.rainbow,sequence[0]===3);
  const end = now.reels.slice();
  g.step(60);
  assert.deepEqual(g.probe.now().reels, end, '終了後は全列が止まる');
  g.tap(270, now.H/2+310);
  assert.equal(g.probe.now().state, 'play');
  assert.equal(g.probe.now().camera, 0);
  assert.equal(g.probe.now().celebration,0);
  assert.equal(g.probe.now().rainbow,false);
  assert.equal(g.probe.now().nextReel, 0);
  g.key(' ');g.key(' ');
  assert.equal(g.probe.now().nextReel, 1, '押しっぱなしでは連続停止しない');
  g.key(' ', true);
  g.esc();
  assert.equal(g.probe.now().state, 'play');
  assert.equal(g.probe.now().streak, 0);
  return longest;
}
const shapes = [[375,667],[390,844],[768,1024],[1280,720]];
const increments = [0.15,0.3,0.45,0.65];
for(let target=0;target<4;target++) {
  assert.equal(play(Array(100).fill(target),shapes[target],target%2===0),100);
}
function stopAs(g,target) {
  let frames=0;
  while(Math.round(g.probe.now().reels[g.probe.now().nextReel])%4!==target && frames++<61)g.step(1);
  assert.ok(frames<=61);
  g.press(' ');
}
for(let target=0;target<4;target++) {
  for(let wrong=0;wrong<4;wrong++) {
    if(target===wrong)continue;
    const g=load(file,{quiet:true});
    for(let i=0;i<8;i++) {
      stopAs(g,target);
      assert.equal(g.probe.now().speed,4+increments[target]*Math.floor((i+1)/10));
      assert.equal(g.probe.now().targetSymbol,target);
    }
    g.step(30);assert.ok(g.probe.now().camera>0);
    stopAs(g,wrong);
    const now=g.probe.now();
    assert.equal(now.state,'result','失敗した場面で止める');
    assert.equal(now.failed,true);
    assert.equal(now.nextReel,8);
    assert.equal(now.remaining,92);
    assert.equal(now.score,8);
    assert.ok(now.flash>0);
    const frozen=now.reels.slice();g.step(30);
    assert.deepEqual(g.probe.now().reels,frozen,'失敗後は回らない');
    assert.equal(g.probe.now().flash,0,'枠の光は自然に消える');
    g.tap(410,now.buttonY);
    assert.equal(g.shared[0],'8連でした #100連スロット');
    assert.equal(g.probe.now().state,'result','共有しても勝手に戻らない');
    g.tap(270,now.buttonY);
    assert.equal(g.probe.now().remaining,100);
    assert.equal(g.probe.now().camera,0);
    assert.equal(g.probe.now().speed,4);
    assert.equal(g.probe.now().targetSymbol,null);
    assert.ok(g.probe.now().stopped.every(v=>!v));
    stopAs(g,(target+1)%4);
    assert.equal(g.probe.now().targetSymbol,(target+1)%4,'やり直しで別の絵柄を選べる');
  }
}
const direction=load(file,{quiet:true});
const before=direction.probe.now().reels[0];direction.step(1);
assert.ok(Math.abs(direction.probe.now().reels[0]-((before-4/60+4)%4))<1e-9,'以前と逆方向に回る');
direction.tap(20,20);assert.equal(direction.probe.now().flash,0,'枠外のタップでは光らない');
console.log('4絵柄100連、100→0表示、12通りの失敗停止・共有・戻る、枠の光と逆回転を確認。');
console.log('100列目の停止猶予（ミリ秒）: '+increments.map(a=>(1000/(4+a*9)).toFixed(1)).join(' / '));

// 音声の接続先と発声数を、音を出さない台で確かめる。
const voiced=load(file,{quiet:true,inject:'window.__probe.setAudio=function(C){window.AudioContext=C;};'});const voices=[];
function param(){return {value:0,setValueAtTime(v){if(this.first===undefined)this.first=v;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};}
function node(){return {connect(){},disconnect(){},start(){},stop(){},gain:param(),frequency:param(),detune:param(),pan:param(),Q:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
voiced.probe.setAudio(function(){
  this.state='running';this.sampleRate=1000;this.currentTime=0;this.destination=node();
  this.createBuffer=()=>({getChannelData:()=>new Float32Array(2000)});
  this.createBufferSource=node;this.createGain=node;this.createBiquadFilter=node;
  this.createConvolver=node;this.createDynamicsCompressor=node;this.createStereoPanner=node;
  this.createOscillator=()=>{const n=node();voices.push(n);return n;};
});
stopAs(voiced,0);stopAs(voiced,0);
assert.equal(voices.filter(v=>v.type==='sawtooth'||v.type==='triangle').length,40,'停止2回で20人の掛け声を2回');
assert.ok(voices.every(v=>v.type),'音声処理が最後まで組み立てられる');
console.log('ボーリングの掛け声が停止ごとに鳴る接続を確認。');

for(let i=2;i<10;i++)stopAs(voiced,0);
assert.equal(voices.filter(v=>v.type==='sawtooth').length,10*15+19,'10連で26人の歓声を追加');
for(let i=10;i<100;i++)stopAs(voiced,0);
assert.equal(voiced.probe.now().celebration,8);
const beforeFanfare=voices.length;voiced.step(120);
assert.ok(voices.length>beforeFanfare+26,'完走後も歓声とファンファーレが続く');
voiced.step(400);assert.equal(voiced.probe.now().celebration,0);
console.log('10連の歓声、8秒の完走演出、7だけの虹色、やり直し時の解除を確認。');

voiced.probe.reset();stopAs(voiced,0);
const beforeFailure=voices.filter(v=>v.type==='sawtooth').length;
stopAs(voiced,1);
assert.equal(voiced.probe.now().failed,true);
assert.equal(voices.filter(v=>v.type==='sawtooth').length-beforeFailure,30,'停止の掛け声と落胆の声を両方鳴らす');
console.log('失敗時の落胆の声を確認。');

const jump=load(file,{quiet:true});jump.step(120);
for(let digit=1;digit<=9;digit++) {
  jump.press(String(digit));assert.equal(jump.probe.now().nextReel,digit*10);
  assert.equal(jump.probe.now().milestone,0.8);
}
jump.press('0');assert.equal(jump.probe.now().state,'result');
assert.equal(jump.probe.now().remaining,0);
const clearTime=jump.probe.now().time;
assert.ok(Math.abs(clearTime-2)<1e-8);
jump.step(120);assert.equal(jump.probe.now().time,clearTime,'完走後はタイムを固定');
jump.press('3');assert.equal(jump.probe.now().nextReel,30);assert.equal(jump.probe.now().state,'play');
jump.esc();assert.equal(jump.probe.now().time,0);
const published=load(file,{quiet:true,inject:'location.hostname="www.zounoashi.com";'});
for(const digit of '1234567890')published.press(digit);
assert.equal(published.probe.now().nextReel,0,'公開先では数字キーで飛ばない');
console.log('ローカル数字キー10段階・公開先で無効・完走タイムの固定を確認。');

const wide=load(file,{quiet:true});wide.press('0');
assert.equal(wide.probe.now().cameraView.zoom,1,'完走直後は近い画面を保つ');
wide.step(210);
let whole=wide.probe.now().cameraView;
assert.ok(whole.left<=35 && whole.right>=14085,'100本と筐体の両端が収まる');
assert.ok(whole.zoom<0.04);
wide.view(375,667);whole=wide.probe.now().cameraView;
assert.ok(whole.left<=35 && whole.right>=14085,'画面変更後も全景を保つ');
wide.esc();assert.equal(wide.probe.now().cameraView.zoom,1,'やり直すと元の大きさ');
stopAs(wide,0);stopAs(wide,1);wide.step(210);
assert.equal(wide.probe.now().cameraView.zoom,1,'失敗時には引かない');
console.log('完走後の全100列の全景・画面変更・やり直し・失敗時のカメラを確認。');

const originalRandom=Math.random,pitches=[];
try {
  Math.random=()=>0.5;voiced.probe.reset();
  for(let i=0;i<11;i++) {
    const before=voices.length;stopAs(voiced,0);
    pitches.push(voices[before].frequency.first);
  }
} finally {Math.random=originalRandom;}
for(let i=1;i<10;i++)assert.ok(Math.abs(pitches[i]/pitches[i-1]-Math.pow(2,1/24))<1e-9);
assert.equal(pitches[10],pitches[0],'11回目の掛け声は最初の高さに戻る');
console.log('掛け声の1〜10回の音程上昇と11回目のリセットを確認。');
