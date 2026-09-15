/* ゴール時の記録と、通過後の時間・物理更新を確認する。 */
const assert=require('assert'),load=require('../harness');
for(const altitude of [0,-5000]){
 const g=load('games/shark-walk/index.html',{withScripts:true,inject:"window.__dbg={place:function(y){walker.points.forEach(function(p){p.x+=3201-222.5;p.px=p.x-1;p.y+=y;p.py=p.y;});},image:function(){return goalSnapshot;}};"});
 g.press(' ');g.step(30);g.dbg.place(altitude);g.step(2);
 const first=g.probe.now(),image=g.dbg.image();assert.equal(first.state,'result');assert(first.snapshot);
 assert.equal(first.resultButtons.length,3,'結果では下の操作を三つの結果ボタンへ置き換える');assert(first.resultButtons.every(b=>b.y===first.H*.82),'結果ボタンは写真枠の外の操作列');g.key('a');g.step(15);assert(g.probe.now().elapsed<first.elapsed+.1,'ゴール直後はスローになる');g.step(105);g.drawn.length=0;const later=g.probe.now();
 assert(later.elapsed>first.elapsed+.9,'ゴール後も時間は進む');assert.equal(later.score,first.score,'記録タイムは通過時の値を保持');assert.strictEqual(g.dbg.image(),image,'スナップショットは上書きしない');assert(!later.leftLegPressed,'結果では四肢操作に反応しない');assert(Math.abs(later.x-first.x)+Math.abs(later.y-first.y)>1,'ゴール後も車体が動く');
 g.esc();assert.equal(g.probe.now().state,'intro');assert(!g.probe.now().snapshot,'編集へ戻ると写真を消す');
 g.press(' ');assert.equal(g.probe.now().score,0);assert(!g.probe.now().snapshot);
}
console.log('地上・飛行ゴールの写真・記録保持・時間継続・結果ボタン・スロー・再編集：確認済み');
