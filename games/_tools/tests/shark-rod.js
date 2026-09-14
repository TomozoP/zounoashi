/* 回転棒の剛性、連続回転、空中での反動を確認する。 */
const fs=require('fs'),assert=require('assert');
const make=new Function(fs.readFileSync('games/_shark-walk/walk.js','utf8')+';return SharkWalk;')();
const w=make({leftLeg:'rod',rightLeg:'rod',leftArm:'rod',rightArm:'rod'});
w.points.forEach(p=>{p.y-=30000;p.py=p.y;});
function center(){return w.points.reduce((s,p)=>s+p.x/p.w,0)/w.points.reduce((s,p)=>s+1/p.w,0);}
const start=center(),j=w.joints[0];w.set('leftLeg',true);
function angle(){return Math.atan2(j.c.y-j.a.y,j.c.x-j.a.x)-w.now().angle;}
let old=angle(),total=0;
for(let i=0;i<240;i++){
  w.update(1/60);let a=angle();total+=Math.atan2(Math.sin(a-old),Math.cos(a-old));old=a;
  assert(Math.hypot(j.b.x-(j.a.x+j.c.x)/2,j.b.y-(j.a.y+j.c.y)/2)<.1,'棒は途中で曲がらない');
  assert(Math.abs(Math.hypot(j.c.x-j.a.x,j.c.y-j.a.y)-140)<.1,'棒の長さを保つ');
}
assert(total>Math.PI*2,'付け根から一周以上回転する');assert(Math.abs(center()-start)<.001,'空中で前進補正を加えない');assert(Math.abs(w.now().angle)>.1,'回転の反動が胴体へ返る');
w.set('leftLeg',false);for(let i=0;i<180;i++)w.update(1/60);old=angle();for(let i=0;i<30;i++)w.update(1/60);assert(Math.abs(Math.atan2(Math.sin(angle()-old),Math.cos(angle()-old)))<.3,'離すと回転が収まる');
console.log('回転棒の長さ・直線維持・一周・反動・停止：確認済み');
