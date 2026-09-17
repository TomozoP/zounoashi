/* 遠近が変わっても指した人物を選べること、画面の隅から地面へ戻せることを確認。 */
const assert=require('assert'),load=require('../harness');
for(const [w,h] of [[375,812],[700,700],[500,1600]]){
  const g=load('games/shuto/index.html',{w,h,inject:`window.__dbg={
    project:position,ground:groundAt,
    target:function(y){newRound();people=people.slice(0,2);var p=groundAt(W/2,y);
      people[0].x=p.x;people[0].y=p.y;people[0].stature=1;
      people[1].x=-1000;people[1].y=p.y;attacker=0;victim=1;elapsed=1;draw();}
  };`});
  for(const x of [0,270,540])for(const y of [0,g.H/2,g.H]){
    const q=g.dbg.project(g.dbg.ground(x,y));
    assert(Math.abs(q.x-x)<1e-7&&Math.abs(q.y-y)<1e-7);
  }
  let sizes=[];
  for(const ratio of [.25,.8]){
    g.dbg.target(g.H*ratio);let p=g.probe.now().people[0];sizes.push(p.scale);
    g.tap(p.x+34*p.scale,p.y);assert.equal(g.probe.now().state,'play','人物の外は選ばない');
    g.tap(p.x,p.y);assert.equal(g.probe.now().state,'success','遠近に合わせた位置で正解');
  }
  assert(sizes[1]>sizes[0]*1.3,'手前を大きく、奥を小さく描く');
}
console.log('3画面の透視投影・地面座標への変換・遠近別クリック判定を確認しました');
