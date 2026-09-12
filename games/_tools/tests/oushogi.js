/* 先後、三つの視点、一手だけの決着、操作と画面の大きさを確かめる。 */
var assert = require('assert');
var load = require('../harness');
var file = 'games/_oushogi/index.html';
var meshes=require('../../_oushogi/_source/meshes.json');
assert(meshes.piece.some(function(o){return o.name==='墨文字王';}));
assert(meshes.opponent.some(function(o){return o.name==='墨文字玉';}));
assert(!meshes.opponent.some(function(o){return o.name==='墨文字王';}));
assert.equal(meshes.board.filter(function(o){return o.name.indexOf('盤の線')===0;}).length,3);
function advance(g,n){for(var i=0;i<n;i++){g.step(1);g.drawn.length=0;}}
function begin(g,first,kind){
  var b=g.probe.now().startButton;
  if(kind==='tap')g.tap(b.x+30,b.y+30);
  else if(kind==='pad'){g.pad({press:true});advance(g,1);g.pad({press:false});advance(g,1);}
  else g.press(' ');
  assert.equal(g.probe.now().state,'lottery');
  advance(g,600);assert.equal(g.probe.now().state,'lottery');
  while(g.probe.now().lotteryFirst!==first)advance(g,1);
  if(kind==='tap')g.tap(270,400);
  else if(kind==='pad'){g.pad({press:true});advance(g,1);g.pad({press:false});advance(g,1);}
  else g.press(' ');
  assert.equal(g.probe.now().first,first);
}
function confirm(g,kind,target){
  if(kind==='tap'){var p=g.probe.now().centers[target];g.tap(p.x,p.y);}
  else if(kind==='pad'){g.pad({press:true});advance(g,1);g.pad({press:false});advance(g,1);}
  else g.press(' ');
}
['tap','key','pad'].forEach(function(kind){
  [true,false].forEach(function(first){
    var g=load(file,{inject:"window.__dbg={resultSounds:[]}; tone=function(freq){if(state==='result')window.__dbg.resultSounds.push(freq);};"});begin(g,first,kind);
    if(first){
      assert.equal(g.probe.now().state,'play');
      if(kind==='tap'){confirm(g,kind,1);assert.equal(g.probe.now().state,'play');}
      confirm(g,kind,0);assert(g.probe.now().selected);
      confirm(g,kind,1);assert.equal(g.probe.now().state,'cinema');
    } else {assert.equal(g.probe.now().state,'reply');advance(g,80);}
    var seen=new Set(),frames=0,seenShake=false;
    while(g.probe.now().state==='cinema' && frames<460){
      seen.add(g.probe.now().camera);
      var shake=g.probe.now().shake;
      if(Math.hypot(shake.x,shake.y)>5)seenShake=true;
      if(frames%60===0)g.press(' ');
      advance(g,1);frames++;
    }
    assert.deepEqual(Array.from(seen),[0,1,2]);
    assert(seenShake,'駒を取る瞬間にカメラが揺れる');
    assert.equal(g.probe.now().state,'result');
    assert.equal(g.probe.now().resultLabel,first?'先手勝ち':'後手負け');
    assert.equal(g.probe.now().score,1);assert.equal(g.probe.now().pieces,1);
    assert.equal(g.probe.now().first,first);
    assert(frames>=330 && frames<=342);
    var sounds=g.dbg.resultSounds;
    assert.equal(sounds.length,3);
    assert(first?sounds[0]<sounds[1]&&sounds[1]<sounds[2]:sounds[0]>sounds[1]&&sounds[1]>sounds[2]);
    advance(g,60);assert.equal(sounds.length,3);
    var bs=g.probe.now().buttons;
    g.tap(bs[1].x+30,bs[1].y+30);
    assert.equal(g.shared[0],'迄1手で'+(first?'先手の勝ち':'後手の負け')+'です。 #王将棋');
    g.tap(bs[0].x+30,bs[0].y+30);assert.equal(g.probe.now().state,'ready');
    assert.equal(g.probe.now().score,0);
    console.log('OK '+kind+' '+(first?'先手の勝ち':'後手の負け')+'、一手、三視点、結果、再対局');
  });
});
load.SHAPES.forEach(function(v){
  var g=load(file);g.view(v[0],v[1]);advance(g,1);
  var s=g.probe.now(),a=s.centers[0],b=s.centers[1];
  assert(Math.hypot(a.x-b.x,a.y-b.y)>=63);
  s.buttons.forEach(function(b){assert(b.h>=63 && b.y+b.h<=s.H);});
  g.tap(-20,200);g.tap(10,10);assert.equal(g.probe.now().state,'ready');
  begin(g,true,'key');g.press(' ');g.press(' ');advance(g,150);g.esc();
  assert.equal(g.probe.now().state,'ready');
  g.win.fire('keydown',{key:'Escape',repeat:true,preventDefault:function(){}});
  assert.equal(g.probe.now().state,'ready');
  console.log('OK '+v.join('×')+' 押しどころの中心間 '+Math.round(Math.hypot(a.x-b.x,a.y-b.y)))
});
console.log('問題なし。先後はタップ確定、後手の待ち1.3秒、決着の演出約5.67秒（三回目はスローと着地後の寄り）。');
