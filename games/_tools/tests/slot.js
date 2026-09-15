/* 100列の停止順、横移動、同じ絵柄の連続数を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_slot/index.html';
function play(sequence, shape, keyboard) {
  const g = load(file, {quiet:true});
  g.view(...shape);
  g.key(' ');
  assert.equal(g.probe.now().state, 'intro', '開始は指を離してから');
  g.key(' ', true);
  assert.equal(g.probe.now().nextReel, 0, '開始操作は停止に混ぜない');
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
  g.tap(215, now.H/2+220);
  assert.equal(g.probe.now().state, 'play');
  assert.equal(g.probe.now().camera, 0);
  assert.equal(g.probe.now().nextReel, 0);
  g.key(' ');g.key(' ');
  assert.equal(g.probe.now().nextReel, 1, '押しっぱなしでは連続停止しない');
  g.key(' ', true);
  g.esc();
  assert.equal(g.probe.now().state, 'intro');
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
    const g=load(file,{quiet:true});g.press(' ');
    for(let i=0;i<8;i++) {
      stopAs(g,target);
      assert.equal(g.probe.now().speed,4+increments[target]*i);
      assert.equal(g.probe.now().targetSymbol,target);
    }
    g.step(30);assert.ok(g.probe.now().camera>0);
    stopAs(g,wrong);
    const now=g.probe.now();
    assert.equal(now.state,'play','失敗後は開始画面を挟まずやり直す');
    assert.equal(now.nextReel,0);
    assert.equal(now.camera,0);
    assert.equal(now.speed,4);
    assert.equal(now.targetSymbol,null);
    assert.equal(now.score,0);
    assert.ok(now.stopped.every(v=>!v));
    stopAs(g,(target+1)%4);
    assert.equal(g.probe.now().targetSymbol,(target+1)%4,'やり直しで別の絵柄を選べる');
  }
}
console.log('4絵柄それぞれ100連成功、12通りの不一致リセット、絵柄別の加速、4画面を確認。');
console.log('100列目の停止猶予（ミリ秒）: '+increments.map(a=>(1000/(4+a*98)).toFixed(1)).join(' / '));
