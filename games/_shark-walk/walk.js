/* 四肢の長さと膝・肘の角度だけを保つ。胴体の姿勢や進行方向は制御しない。 */
function SharkWalk(parts) {
  parts=parts||{};var equipment={},spins={},wheelSpeed={},balloons={};
  var points=[], names=['leftLeg','rightLeg','leftArm','rightArm'];
  var bends={},pressed={},contacts=0,cliff=-100;
  names.forEach(function(k){bends[k]=0;pressed[k]=false;spins[k]=0;wheelSpeed[k]=0;equipment[k]=["leg","arm","wheel","jet","balloon","rod"].indexOf(parts[k])>=0?parts[k]:(k.indexOf("Leg")>=0?"leg":"arm");});
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
  var joints=[],knees=[],elbows=[],supports=[];
  names.forEach(function(name,i){var a=i<2?rear:front,c=i<2?feet[i]:hands[i-2],length=equipment[name]==='leg'?76:equipment[name]==='arm'||equipment[name]==='balloon'?74:i<2?76:74;
    if(equipment[name]==='wheel'||equipment[name]==='jet'){c.r=equipment[name]==='wheel'?28:20;c.wheel=equipment[name]==='wheel';c.x=a.x+(i<2?-40:40)+(i%2?4:-4);c.px=c.x;c.y=-c.r;c.py=c.y;}
    if(equipment[name]==='balloon'){c.x=a.x+(i%2?18:-18);c.y=a.y-130;c.px=c.x;c.py=c.y;c.r=6;c.w=1/.8;balloons[name]=point(c.x,c.y-60,.3,15);}
    if(equipment[name]==='rod'){length=70;c.x=a.x+(i%2?8:-8);c.y=a.y+Math.sqrt(140*140-64);c.px=c.x;c.py=c.y;c.r=9;}
    var at=knee(a,c,length,equipment[name]==='leg'?1:equipment[name]==='arm'||equipment[name]==='balloon'?-1:i<2?1:-1),b=point(at.x,at.y,.65,8);
    if(equipment[name]==='wheel'||equipment[name]==='jet')supports.push({a:back,b:a,c:b,name:name,rest:angle(back,a,b),support:true});
    (i<2?knees:elbows).push(b);joints.push({a:a,b:b,c:c,length:length,name:name,sign:Math.sign(angle(a,b,c)),jetOffset:-.35-Math.atan2(c.y-b.y,c.x-b.x)});
  });
  // 山とくぼみを滑らかにつなぎ、継ぎ目に見えない段差を作らない。
  var terrain=[[450,800,-42],[800,1200,34],[1200,1640,-72],[1640,1980,26],[1980,2460,-92],[2460,2780,40],[2780,3060,-38]];
  function ground(x){for(var i=0;i<terrain.length;i++){var t=terrain[i];if(x>=t[0]&&x<t[1]){var u=(x-t[0])/(t[1]-t[0]);return t[2]*(1-Math.cos(u*Math.PI*2))/2;}}return 0;}
  function distance(a,b,len){var dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,q=(d-len)/d/(a.w+b.w);a.x+=dx*q*a.w;a.y+=dy*q*a.w;b.x-=dx*q*b.w;b.y-=dy*q*b.w;}
  // 三点の角度への力は、関節を含む三点へ返す。人間の肩と股関節は自由。装備の付け根は胴体に対する角度をばねで支える。
  function bend(j,h){
    if(equipment[j.name]==="balloon"||equipment[j.name]==="rod")return;
    var suspension=equipment[j.name]==="wheel"||equipment[j.name]==="jet";if(suspension&&!h)return;
    var a=j.a,b=j.b,c=j.c,ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
    var u2=ux*ux+uy*uy,v2=vx*vx+vy*vy;if(u2<1||v2<1)return;
    var ga={x:uy/u2,y:-ux/u2},gc={x:-vy/v2,y:vx/v2},gb={x:-ga.x-gc.x,y:-ga.y-gc.y};
    var target=j.support?j.rest:j.sign*(suspension?2.3:Math.PI-.18-bends[j.name]*2.1);
    var error=wrap(angle(a,b,c)-target);
    if(suspension){
      // 角度のばねと減衰。ボタンで目標角度を変えず、荷重や反動でしなる。
      var rate=wrap(angle(a,b,c)-angle({x:a.px,y:a.py},{x:b.px,y:b.py},{x:c.px,y:c.py}))/h;
      var stiffness=j.support?1200000:600000,damping=j.support?16000:10000;
      var torque=Math.max(-900000,Math.min(900000,-stiffness*error-damping*rate));
      [[a,ga],[b,gb],[c,gc]].forEach(function(pair){var p=pair[0],g=pair[1];p.px-=torque*g.x*p.w*h*h;p.py-=torque*g.y*p.w*h*h;});return;
    }
    var weight=a.w*(ga.x*ga.x+ga.y*ga.y)+b.w*(gb.x*gb.x+gb.y*gb.y)+c.w*(gc.x*gc.x+gc.y*gc.y);
    var q=-error*.12/weight;
    [[a,ga],[b,gb],[c,gc]].forEach(function(pair){var p=pair[0],g=pair[1];p.x+=q*p.w*g.x;p.y+=q*p.w*g.y;});
  }
  // 棒の回転力と反動を、棒先・付け根・胴体へ返す。
  function rotateRod(j,h){
    var a=back,b=j.a,c=j.c,ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
    var u2=ux*ux+uy*uy,v2=vx*vx+vy*vy;if(u2<1||v2<1)return;
    var ga={x:uy/u2,y:-ux/u2},gc={x:-vy/v2,y:vx/v2},gb={x:-ga.x-gc.x,y:-ga.y-gc.y};
    var rate=wrap(angle(a,b,c)-angle({x:a.px,y:a.py},{x:b.px,y:b.py},{x:c.px,y:c.py}))/h;
    var torque=Math.max(-120000,Math.min(120000,18000*((pressed[j.name]?4:0)-rate)));
    [[a,ga],[b,gb],[c,gc]].forEach(function(pair){var p=pair[0],g=pair[1];p.px-=torque*g.x*p.w*h*h;p.py-=torque*g.y*p.w*h*h;});
  }
  function straightRod(j){
    var a=j.a,b=j.b,c=j.c,w=b.w+(a.w+c.w)/4;
    var qx=-(b.x-(a.x+c.x)/2)/w,qy=-(b.y-(a.y+c.y)/2)/w;
    b.x+=qx*b.w;b.y+=qy*b.w;a.x-=qx*a.w/2;a.y-=qy*a.w/2;c.x-=qx*c.w/2;c.y-=qy*c.w/2;
    distance(a,c,140);
  }
  function slope(x){return (ground(x+.05)-ground(x-.05))/.1;}
  function wheelContact(p,h){
    var x=p.x;p.touch=null;
    // 曲面上の近い点を探し、その法線へ押し出す。
    for(var k=0;k<6;k++)x=Math.max(p.x-p.r,Math.min(p.x+p.r,p.x-(ground(x)-p.y)*slope(x)));
    var y=ground(x),s=slope(x),length=Math.hypot(1,s),nx=s/length,ny=-1/length;
    var depth=p.r-((p.x-x)*nx+(p.y-y)*ny);
    if(depth<-.08)return;
    p.touch={nx:nx,ny:ny,tx:1/length,ty:s/length};
    if(depth>0){p.x+=nx*depth;p.y+=ny*depth;p.px+=nx*depth;p.py+=ny*depth;p.load+=depth/(p.w*h);}
  }
  function wheelFriction(j,h){
    var p=j.c,c=p.touch;if(!c)return;
    var vx=(p.x-p.px)/h,vy=(p.y-p.py)/h,vn=vx*c.nx+vy*c.ny;
    var normalImpulse=Math.max(p.load,-vn/p.w);
    if(vn<0){vx-=vn*c.nx;vy-=vn*c.ny;}
    var inertia=.5/p.w*p.r*p.r;
    var slip=vx*c.tx+vy*c.ty-wheelSpeed[j.name]*p.r;
    var requested=-slip/(p.w+p.r*p.r/inertia),limit=.65*normalImpulse;
    var impulse=Math.max(-limit,Math.min(limit,requested));
    vx+=impulse*p.w*c.tx;vy+=impulse*p.w*c.ty;
    wheelSpeed[j.name]-=impulse*p.r/inertia;
    p.px=p.x-vx*h;p.py=p.y-vy*h;
    p.slip=slip;p.traction=impulse;p.gripLimit=limit;
  }
  function set(group,value){if(names.indexOf(group)!==-1)pressed[group]=!!value;}
  function update(dt){
    for(var sub=0;sub<2;sub++){
      var h=dt/2;
      names.forEach(function(k){bends[k]+=((pressed[k]?1:0)-bends[k])*Math.min(1,12*h);});
      supports.forEach(function(j){bend(j,h);});
      joints.forEach(function(j){if(equipment[j.name]==='wheel'||equipment[j.name]==='jet')bend(j,h);});
      joints.forEach(function(j){var kind=equipment[j.name];
        if(kind==='rod')rotateRod(j,h);
        if(kind==='balloon'){var balloon=balloons[j.name];balloon.r=15+22*bends[j.name];balloon.py+=(1000+5500*bends[j.name])*balloon.w*h*h;}
        if(kind==='wheel'){
          var dx=j.c.x-j.b.x,dy=j.c.y-j.b.y,l2=Math.max(1,dx*dx+dy*dy);
          var speed=wrap(Math.atan2(dy,dx)-Math.atan2(j.c.py-j.b.py,j.c.px-j.b.px))/h;
          var relative=wheelSpeed[j.name]-speed,inertia=.5/j.c.w*j.c.r*j.c.r;
          var torque=(pressed[j.name]?20000*Math.max(-1,Math.min(1,1-relative/24)):0)-35*relative;
          wheelSpeed[j.name]+=torque*h/inertia;
          // 車軸の反動は下側の脚へ返し、前向きの力を直接加えない。
          var fx=torque*dy/l2,fy=-torque*dx/l2;
          j.c.px-=fx*j.c.w*h*h;j.c.py-=fy*j.c.w*h*h;
          j.b.px+=fx*j.b.w*h*h;j.b.py+=fy*j.b.w*h*h;
          j.c.load=0;j.c.touch=null;j.c.slip=0;j.c.traction=0;j.c.gripLimit=0;
        }
        if(kind==='jet'&&pressed[j.name]){var dir=Math.atan2(j.c.y-j.b.y,j.c.x-j.b.x)+j.jetOffset;j.c.px-=Math.cos(dir)*11000*h*h;j.c.py-=Math.sin(dir)*11000*h*h;}
      });
      points.forEach(function(p){var vx=(p.x-p.px)*.997,vy=(p.y-p.py)*.997;p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+900*h*h;});
      contacts=0;
      for(var n=0;n<18;n++){
        joints.forEach(function(j){bend(j);});
        bodyLinks.forEach(function(link){distance(link.a,link.b,link.length);});
        joints.forEach(function(j){if(equipment[j.name]==='rod'){straightRod(j);return;}distance(j.a,j.b,j.length);distance(j.b,j.c,j.length);var balloon=balloons[j.name];if(balloon&&Math.hypot(j.c.x-balloon.x,j.c.y-balloon.y)>60)distance(j.c,balloon,60);});
        points.forEach(function(p){if(p.x<cliff){if(p.wheel)p.touch=null;return;}if(p.wheel){wheelContact(p,h);if(n===17&&p.touch)contacts++;return;}var g=ground(p.x)-p.r;if(p.y>g){p.y=g;if(n===17)contacts++;p.px=p.x-(p.x-p.px)*.12;p.py=p.y;}});
      }
      joints.forEach(function(j){if(equipment[j.name]!=='wheel')return;wheelFriction(j,h);spins[j.name]+=wheelSpeed[j.name]*h;});
    }
  }
  function now(){var out={cliff:cliff,fallen:(rear.y+front.y)/2>650,x:(rear.x+front.x)/2,y:rear.y,equipment:Object.assign({},equipment),spins:Object.assign({},spins),wheelSpeed:Object.assign({},wheelSpeed),angle:Math.atan2(front.y-rear.y,front.x-rear.x),contacts:contacts,finite:points.every(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.y);})};names.forEach(function(k){out[k]=bends[k];out[k+'Pressed']=pressed[k];});return out;}
  return {balloons:balloons,rear:rear,front:front,feet:feet,hands:hands,knees:knees,elbows:elbows,points:points,joints:joints,ground:ground,set:set,update:update,now:now};
}
