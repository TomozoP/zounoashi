/* 四肢の長さと膝・肘の角度だけを保つ。胴体の姿勢や進行方向は制御しない。 */
function SharkWalk() {
  var points=[], names=['leftLeg','rightLeg','leftArm','rightArm'];
  var bends={},pressed={},contacts=0;
  names.forEach(function(k){bends[k]=0;pressed[k]=false;});
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
    (i<2?knees:elbows).push(b);joints.push({a:a,b:b,c:c,length:length,name:name,sign:Math.sign(angle(a,b,c))});
  });
  // 山とくぼみを滑らかにつなぎ、継ぎ目に見えない段差を作らない。
  var terrain=[[450,800,-42],[800,1200,34],[1200,1640,-72],[1640,1980,26],[1980,2460,-92],[2460,2780,40],[2780,3060,-38]];
  function ground(x){for(var i=0;i<terrain.length;i++){var t=terrain[i];if(x>=t[0]&&x<t[1]){var u=(x-t[0])/(t[1]-t[0]);return t[2]*(1-Math.cos(u*Math.PI*2))/2;}}return 0;}
  function distance(a,b,len){var dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,q=(d-len)/d/(a.w+b.w);a.x+=dx*q*a.w;a.y+=dy*q*a.w;b.x-=dx*q*b.w;b.y-=dy*q*b.w;}
  // 三点の角度への力は、関節を含む三点へ返す。肩と股関節の向きは自由。
  function bend(j){
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
      points.forEach(function(p){var vx=(p.x-p.px)*.997,vy=(p.y-p.py)*.997;p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+900*h*h;});
      contacts=0;
      for(var n=0;n<18;n++){
        joints.forEach(bend);
        bodyLinks.forEach(function(link){distance(link.a,link.b,link.length);});
        joints.forEach(function(j){distance(j.a,j.b,j.length);distance(j.b,j.c,j.length);});
        points.forEach(function(p){var g=ground(p.x)-p.r;if(p.y>g){p.y=g;if(n===17)contacts++;p.px=p.x-(p.x-p.px)*.12;p.py=p.y;}});
      }
    }
  }
  function now(){var out={x:(rear.x+front.x)/2,y:rear.y,angle:Math.atan2(front.y-rear.y,front.x-rear.x),contacts:contacts,finite:points.every(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.y);})};names.forEach(function(k){out[k]=bends[k];out[k+'Pressed']=pressed[k];});return out;}
  return {rear:rear,front:front,feet:feet,hands:hands,knees:knees,elbows:elbows,points:points,joints:joints,ground:ground,set:set,update:update,now:now};
}
