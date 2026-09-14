/* 重力・関節・足裏の摩擦で進む、サメの歩行。座標は地面を高さ0とする。 */
function SharkWalk() {
  var points=[], phase=0, target=0, steps=0, contacts=0;
  function point(x,y,m,r){var p={x:x,y:y,px:x,py:y,w:1/m,r:r};points.push(p);return p;}
  var rear=point(160,-135,5,27),front=point(285,-135,5,30);
  var feet=[point(120,-6,1,6),point(200,-6,1,6)];
  var hands=[point(265,-55,.45,5),point(300,-55,.45,5)];
  function ground(x){return x<600?0:x<1100?-18*Math.sin((x-600)/500*Math.PI):x<1500?0:x<1950?-28*Math.sin((x-1500)/450*Math.PI):0;}
  function distance(a,b,len,k){var dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,q=(d-len)/d*k/(a.w+b.w);a.x+=dx*q*a.w;a.y+=dy*q*a.w;b.x-=dx*q*b.w;b.y-=dy*q*b.w;}
  function motor(a,b,x,y,k){var dx=b.x-a.x-x,dy=b.y-a.y-y,q=k/(a.w+b.w);a.x+=dx*q*a.w;a.y+=dy*q*a.w;b.x-=dx*q*b.w;b.y-=dy*q*b.w;}
  function advance(){target+=Math.PI;steps++;}
  function update(dt){
    for(var sub=0;sub<2;sub++){
      var h=dt/2;
      phase+=Math.min(target-phase,6*h);
      points.forEach(function(p){var vx=(p.x-p.px)*.997,vy=(p.y-p.py)*.997;p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+900*h*h;});
      contacts=0;
      for(var n=0;n<14;n++){
        distance(rear,front,125,1);
        // 姿勢を支える筋力。地面へ足を押し返した反力は胴体にも返る。
        var angle=Math.atan2(front.y-rear.y,front.x-rear.x), c=Math.cos(angle),s=Math.sin(angle);
        feet.forEach(function(f,i){var a=phase+i*Math.PI, x=48*Math.cos(a),y=110+24*Math.sin(a);motor(rear,f,x*c-y*s,x*s+y*c,.035);distance(rear,f,Math.min(146,Math.hypot(x,y)),.08);});
        hands.forEach(function(f,i){var a=phase+i*Math.PI,x=-24*Math.cos(a),y=69;motor(front,f,x*c-y*s,x*s+y*c,.016);distance(front,f,78,.1);});
        // 胴体の傾きを戻すばね。外力による揺れは残す。
        var tilt=(front.y-rear.y)*.012;front.y-=tilt;rear.y+=tilt;
        points.forEach(function(p){var g=ground(p.x)-p.r;if(p.y>g){p.y=g;if(n===13)contacts++;p.px=p.x-(p.x-p.px)*.12;p.py=p.y;}});
      }
    }
  }
  function knee(a,b,l,sign){var dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,h=Math.sqrt(Math.max(0,l*l-d*d/4));return{x:(a.x+b.x)/2+dy/d*h*sign,y:(a.y+b.y)/2-dx/d*h*sign};}
  return {rear:rear,front:front,feet:feet,hands:hands,points:points,ground:ground,knee:knee,advance:advance,update:update,now:function(){return{x:(rear.x+front.x)/2,y:rear.y,phase:phase,target:target,steps:steps,contacts:contacts,finite:points.every(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.y);})};}};
}
