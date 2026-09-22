/* 氷上の重心と、転倒後の関節。描画と同じ座標を衝突にも使う。 */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // 9本目の手前から、緩やかに下り坂へ移る。
  const ground=z=>{const d=Math.max(0,z-158);return d<12?-.003*d*d:-.432-(d-12)*.072;};
  const downhill=z=>clamp((z-158)/12,0,1);
  const links=[[0,1],[1,2],[2,3],[2,4],[4,5],[2,6],[6,7],[0,8],[8,9],[0,10],[10,11],[4,6],[8,10],[0,2]];
  function pose(s){
    const b=s.bend, a=b*1.48, hip=1.35-b*.55-.12*clamp(Math.abs(s.roll)/.6,0,1);
    const skating=(s.thrust||0)*(1-b)*(1-b),cycle=Math.sin(s.t*4.8);
    const p=[[0,hip,.13+b*.3],[0,hip+.34*Math.cos(a),.13+b*.3-.34*Math.sin(a)],
      [0,hip+.68*Math.cos(a),.13+b*.3-.68*Math.sin(a)],
      [0,hip+.91*Math.cos(a),.13+b*.3-.91*Math.sin(a)]];
    for(const side of [-1,1]){
      p.push([side*(.43+b*.12),hip+.43*Math.cos(a)+.025*b*b*b,.05-b*.26-side*cycle*.13*skating]);
      p.push([side*(.69+b*.13),hip+.16+.035*b*b*b+Math.abs(cycle)*.045*skating,.18-b*.35-side*cycle*.32*skating]);
    }
    for(const side of [-1,1]){
      const stride=cycle*.26*skating,kick=Math.max(0,side*cycle)*skating;
      p.push([side*(.23+kick*.10),hip*.48,.28+b*.44+side*stride*.5]);
      p.push([side*(.23+b*.12+kick*.24),.12,side*.12-side*stride]);
    }
    // 深く反ると上半身が小刻みに震える。足元は氷につけたまま。
    const tremble=clamp((b-.25)/.75,0,1);
    for(let i=1;i<8;i++){p[i][0]+=Math.sin(s.t*44+i*.35)*.009*tremble;p[i][1]+=Math.sin(s.t*51+i*.45)*.006*tremble;}
    const world=p.map(v=>({x:s.x+v[0]*Math.cos(s.roll)-v[1]*Math.sin(s.roll),y:ground(s.z+v[2])+v[0]*Math.sin(s.roll)+v[1]*Math.cos(s.roll),z:s.z+v[2]}));
    // 傾いても低い側の靴が氷へ潜らない位置を支点にする。
    const lift=Math.max(...[9,11].map(i=>ground(world[i].z)+.12-world[i].y));
    world.forEach(v=>v.y+=lift);
    return world;
  }
  function create(){
    const s={state:'intro',t:0,x:0,z:0,distance:0,vx:0,speed:4.9,roll:.015,rv:0,bend:0,thrust:0,target:0,weight:0,score:0,fallTime:0,reason:'',rag:null,impact:0,flash:0,gates:[]};
    for(let i=0;i<12;i++)s.gates.push({z:16+i*19,height:Math.max(1.31,1.82-i*.085)+.28*Math.max(0,1-i/3),slope:i<4||i>7?0:(i%2===0?.12:-.12),passed:false,hit:false,drop:0});
    s.goal=s.gates[s.gates.length-1].z+6;
    return s;
  }
  function fall(s,reason,hit){
    if(s.state!=='play')return;
    s.state='fall';s.reason=reason;s.fallTime=0;s.impact=1;
    const p=pose(s);
    s.rag=p.map((v,i)=>({x:v.x,y:v.y,z:v.z,ox:v.x-(s.vx+(i%2?1:-1)*.35)/60,oy:v.y-(i>7?2.9:.9)/60,oz:v.z-(s.speed*(hit&&i<4?.18:1)+((i%3)-1)*.6)/60}));
    s.lengths=links.map(([a,b])=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y,p[a].z-p[b].z));
    if(hit)hit.hit=true;
  }
  function step(s,dt){
    s.flash=Math.max(0,s.flash-dt*1.6);s.impact=Math.max(0,s.impact-dt*3);
    if(s.state==='intro'||s.state==='result')return;
    s.t+=dt;
    if(s.state==='fall'){
      s.fallTime+=dt;
      for(const g of s.gates)if(g.hit)g.drop+=dt;
      for(const p of s.rag){
        const vx=(p.x-p.ox)*.998,vy=p.y-p.oy,vz=(p.z-p.oz)*.998;
        p.ox=p.x;p.oy=p.y;p.oz=p.z;p.x+=vx;p.y+=vy-12*dt*dt;p.z+=vz;
      }
      for(let n=0;n<7;n++){
        links.forEach(([a,b],i)=>{const p=s.rag[a],q=s.rag[b],dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,d=Math.hypot(dx,dy,dz)||1,k=(d-s.lengths[i])/d*.5;p.x+=dx*k;p.y+=dy*k;p.z+=dz*k;q.x-=dx*k;q.y-=dy*k;q.z-=dz*k;});
        s.rag.forEach((p,i)=>{const r=ground(p.z)+(i===3?.16:.13);if(p.y<r){const vy=p.y-p.oy;if(vy<-.04)s.impact=Math.max(s.impact,Math.min(.7,-vy*5));p.y=r;p.oy=r+vy*.23;if(n===6){p.ox=p.x-(p.x-p.ox)*.97;p.oz=p.z-(p.z-p.oz)*.99;}}if(Math.abs(p.x)>3.7){p.x=clamp(p.x,-3.7,3.7);p.ox=p.x+(p.x-p.ox)*.3;}});
      }
      s.z=s.rag[0].z;s.x=s.rag[0].x;
      if(s.fallTime>4.5)s.state='result';
      return;
    }
    const old=s.bend;s.bend+=(Math.max(0,s.target)-s.bend)*Math.min(1,dt*5);s.thrust+=(Math.max(0,-s.target)-s.thrust)*Math.min(1,dt*6);
    /* 深く反るほど刃の上の重心が不安定。入力は重心への力で、姿勢を直接戻さない。 */
    s.rv+=(s.roll*(1.15+s.bend*2.15)-s.weight*3.35+Math.sin(s.t*2.3)*(.032+s.bend*.055)+(s.bend-old)*.7)*dt;
    s.rv*=Math.exp(-1.3*dt);s.roll+=s.rv*dt;
    s.vx+=(-s.roll*1.6-s.vx*.65)*dt;s.x+=s.vx*dt;
    // 上入力で蹴って加速。中央は惰性で滑り、下入力で反って制動する。
    const acceleration=(6.45+s.score*.13-s.speed)*.85*s.thrust+downhill(s.z)*1.3-s.bend*3.3-.03*(1-s.thrust);
    s.speed=Math.max(0,s.speed+acceleration*dt);s.z+=s.speed*dt;
    s.distance=clamp(s.z,0,s.goal);
    const p=pose(s);
    // 靴の刃以外が氷へ触れたら転倒する。大きさは描画に合わせる。
    const radii=[.21,.23,.16,.155,.11,.085,.11,.085,.11,0,.11,0];
    const touchesIce=p.some((v,i)=>radii[i]>0&&v.y-radii[i]<=ground(v.z));
    if(touchesIce||Math.abs(s.x)>3.2){fall(s,'balance');return;}
    for(const g of s.gates){
      if(g.passed)continue;
      const slope=g.slope||0,normal=Math.sqrt(1+slope*slope),height=g.height+ground(g.z);
      for(let i=0;i<p.length;i++){
        const v=p[i],radius=i===3?.16:i<3?.2:.12;
        if(Math.abs(v.z-g.z)<radius+.07&&Math.abs((v.y-height-slope*v.x)/normal)<radius+.065&&Math.abs(v.x)<2.5){fall(s,'bar',g);return;}
        if(Math.abs(v.z-g.z)<radius+.09&&Math.abs(v.x)>2.34){fall(s,'post',g);return;}
      }
      /* 関節の点だけでなく、点と点の間の胴体や手足もバーへ当てる。 */
      for(let i=0;i<11;i++){
        const a=p[links[i][0]],b=p[links[i][1]],dy=(b.y-a.y-slope*(b.x-a.x))/normal,dz=b.z-a.z,ay=(a.y-height-slope*a.x)/normal;
        const u=clamp((-ay*dy+(g.z-a.z)*dz)/(dy*dy+dz*dz||1),0,1);
        if(Math.abs(a.x+(b.x-a.x)*u)<2.5&&Math.hypot(ay+dy*u,a.z+dz*u-g.z)<(i<2?.24:i===2?.075:.13)+.065){fall(s,'bar',g);return;}
      }
      if(s.z>g.z+1.5){g.passed=true;s.score++;s.flash=1;}
    }
    if(s.score===s.gates.length&&s.z>=s.goal){s.state='result';s.reason='clear';}
  }
  root.SkatePhysics={create,step,pose,links,clamp,ground,downhill};
  if(typeof module!=='undefined')module.exports=root.SkatePhysics;
})(typeof window!=='undefined'?window:globalThis);
