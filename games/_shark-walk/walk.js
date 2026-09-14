/* 四肢の長さと膝・肘の角度だけを保つ。胴体の姿勢や進行方向は制御しない。 */
function SharkWalk(parts) {
  parts=parts||{};var equipment={},spins={},mounts=[];
  var points=[], names=['leftLeg','rightLeg','leftArm','rightArm'];
  var bends={},pressed={},contacts=0;
  names.forEach(function(k){bends[k]=0;pressed[k]=false;spins[k]=0;equipment[k]=["wheel","jet"].indexOf(parts[k])>=0?parts[k]:"human";});
  function point(x,y,m,r){var p={x:x,y:y,px:x,py:y,w:1/m,r:r};points.push(p);return p;}
  var rear=point(160,-141,5,27),front=point(285,-141,5,30);
  // 背びれ側と腹側も地面に当たる。距離だけで形を保ち、向きは戻さない。
  var back=point(222.5,-247,1,8),belly=point(222.5,-100,1,8);
  var bodyLinks=[[rear,front],[rear,back],[front,back],[rear,belly],[front,belly],[back,belly]].map(function(pair){return{a:pair[0],b:pair[1],length:Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)};});
  var feet=[point(117,-6,1,6),point(126,-6,1,6)];
  var hands=[point(247,-6,.8,6),point(256,-6,.8,6)];
  function knee(a,b,l,sign){var dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,h=Math.sqrt(Math.max(0,l*l-d*d/4));return{x:(a.x+b.x)/2+dy/d*h*sign,y:(a.y+b.y)/2-dx/d*h*sign};}
  function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a));}
  function angle(a,b,c){return wrap(Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(a.y-b.y,a.x-b.x));}
  var joints=[],knees=[],elbows=[];
  names.forEach(function(name,i){var a=i<2?rear:front,c=i<2?feet[i]:hands[i-2],length=i<2?76:74;
    var at=knee(a,c,length,i<2?1:-1),b=point(at.x,at.y,.65,8);
    if(equipment[name]!=='human'){
      var dx=i%2?10:-10;
      b.x=a.x+dx;b.y=a.y+45;b.px=b.x;b.py=b.y;
      c.x=a.x+dx;c.y=a.y+(equipment[name]==='wheel'?105:65);c.px=c.x;c.py=c.y;c.r=equipment[name]==='wheel'?28:17;c.wheel=equipment[name]==='wheel';
      [b,c].forEach(function(p){[rear,front,back].forEach(function(root){mounts.push({a:root,b:p,length:Math.hypot(root.x-p.x,root.y-p.y)});});});
    }
    (i<2?knees:elbows).push(b);joints.push({a:a,b:b,c:c,length:length,name:name,sign:Math.sign(angle(a,b,c))});
  });
  function ground(x){return x<600?0:x<1100?-18*Math.sin((x-600)/500*Math.PI):x<1500?0:x<1950?-28*Math.sin((x-1500)/450*Math.PI):0;}
  function distance(a,b,len){var dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,q=(d-len)/d/(a.w+b.w);a.x+=dx*q*a.w;a.y+=dy*q*a.w;b.x-=dx*q*b.w;b.y-=dy*q*b.w;}
  // 三点の角度への力は、関節を含む三点へ返す。肩と股関節の向きは自由。
  function bend(j){
    if(equipment[j.name]!=="human")return;
    var a=j.a,b=j.b,c=j.c,ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
    var u2=ux*ux+uy*uy,v2=vx*vx+vy*vy;if(u2<1||v2<1)return;
    var ga={x:uy/u2,y:-ux/u2},gc={x:-vy/v2,y:vx/v2},gb={x:-ga.x-gc.x,y:-ga.y-gc.y};
    var target=j.sign*(Math.PI-.18-bends[j.name]*2.1);
    var error=wrap(angle(a,b,c)-target);
    var weight=a.w*(ga.x*ga.x+ga.y*ga.y)+b.w*(gb.x*gb.x+gb.y*gb.y)+c.w*(gc.x*gc.x+gc.y*gc.y);
    var q=-error*.12/weight;
    [[a,ga],[b,gb],[c,gc]].forEach(function(pair){var p=pair[0],g=pair[1];p.x+=q*p.w*g.x;p.y+=q*p.w*g.y;});
  }
  function set(group,value){if(names.indexOf(group)!==-1)pressed[group]=!!value;}
  function update(dt){
    for(var sub=0;sub<2;sub++){
      var h=dt/2;
      names.forEach(function(k){bends[k]+=((pressed[k]?1:0)-bends[k])*Math.min(1,12*h);});
      // 車輪は接地中だけ駆動。ジェットは胴体と一緒に回る向きへ推力を出す。
      var bodyAngle=Math.atan2(front.y-rear.y,front.x-rear.x);
      joints.forEach(function(j){var kind=equipment[j.name];if(!pressed[j.name])return;
        if(kind==='wheel'){spins[j.name]+=10*h;if(j.c.y+j.c.r>=ground(j.c.x)-2){j.c.px-=1800*h*h;}}
        if(kind==='jet'){var dir=bodyAngle-.35;j.c.px-=Math.cos(dir)*11000*h*h;j.c.py-=Math.sin(dir)*11000*h*h;}
      });
      points.forEach(function(p){var vx=(p.x-p.px)*.997,vy=(p.y-p.py)*.997;p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+900*h*h;});
      contacts=0;
      for(var n=0;n<18;n++){
        joints.forEach(bend);
        bodyLinks.forEach(function(link){distance(link.a,link.b,link.length);});
        joints.forEach(function(j){if(equipment[j.name]!=="human")return;distance(j.a,j.b,j.length);distance(j.b,j.c,j.length);});
        mounts.forEach(function(link){distance(link.a,link.b,link.length);});
        points.forEach(function(p){var g=ground(p.x)-p.r;if(p.y>g){p.y=g;if(n===17)contacts++;p.px=p.x-(p.x-p.px)*(p.wheel?.995:.12);p.py=p.y;}});
      }
    }
  }
  function now(){var out={x:(rear.x+front.x)/2,y:rear.y,equipment:Object.assign({},equipment),spins:Object.assign({},spins),angle:Math.atan2(front.y-rear.y,front.x-rear.x),contacts:contacts,finite:points.every(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.y);})};names.forEach(function(k){out[k]=bends[k];out[k+'Pressed']=pressed[k];});return out;}
  return {rear:rear,front:front,feet:feet,hands:hands,knees:knees,elbows:elbows,points:points,joints:joints,ground:ground,set:set,update:update,now:now};
}
