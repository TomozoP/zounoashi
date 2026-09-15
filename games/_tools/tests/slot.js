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
  const end = now.reels.slice();
  g.step(60);
  assert.deepEqual(g.probe.now().reels, end, '終了後は全列が止まる');
  g.tap(270, now.H/2+310);
  assert.equal(g.probe.now().state, 'play');
  assert.equal(g.probe.now().camera, 0);
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
const increments = [0.02,0.045,0.075,0.11];
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
      assert.equal(g.probe.now().speed,4+increments[target]*i);
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
console.log('100列目の停止猶予（ミリ秒）: '+increments.map(a=>(1000/(4+a*98)).toFixed(1)).join(' / '));
