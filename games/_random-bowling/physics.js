/* 三次元の剛体。描画から独立させ、同じ計算を自動確認でも使う。 */
var ZBowlingPhysics=(function(C){
  'use strict';
  var kinds=[
    {name:'ボーリング',color:'#5941ae',r:.34,mass:6.4,speed:12,friction:.12,bounce:.12,drag:.015,skin:0},
    {name:'サッカー',color:'#f5f3e9',r:.39,mass:.43,speed:12.5,friction:.24,bounce:.68,drag:.035,skin:1},
    {name:'バスケット',color:'#c96928',r:.43,mass:.62,speed:11.5,friction:.32,bounce:.8,drag:.035,skin:2},
    {name:'テニス',color:'#ccdf35',r:.23,mass:.058,speed:16,friction:.3,bounce:.74,drag:.045,skin:3},
    {name:'ゴルフ',color:'#f4f1e9',r:.16,mass:.046,speed:20,friction:.08,bounce:.52,drag:.012,skin:4},
    {name:'ビーチ',color:'#ffe6a1',r:.62,mass:.16,speed:10,friction:.28,bounce:.56,drag:.12,skin:5},
    {name:'鉄球',color:'#8797a1',r:.37,mass:12,speed:10,friction:.06,bounce:.08,drag:.01,skin:6},
    {name:'スイカ',color:'#4c883b',r:.54,mass:4.5,speed:10.5,friction:.23,bounce:.18,drag:.04,skin:7},
    {name:'ラグビー',color:'#9d512c',r:.34,mass:.45,speed:12,friction:.28,bounce:.58,drag:.03,skin:8},
    {name:'スーパーボール',color:'#e768ac',r:.29,mass:.12,speed:15,friction:.2,bounce:.94,drag:.018,skin:9}
  ];
  function releaseHeight(k){return k.r+.45+(k.skin===8?.15:0);}
  function Game(){
    this.world=new C.World({gravity:new C.Vec3(0,-9.81,0),allowSleep:true});
    this.world.solver.iterations=24;this.world.solver.tolerance=.0001;
    this.floorMat=new C.Material('床');this.pinMat=new C.Material('ピン');this.ballMat=new C.Material('球');
    this.world.addContactMaterial(new C.ContactMaterial(this.floorMat,this.pinMat,{friction:.28,restitution:.08}));
    this.world.addContactMaterial(new C.ContactMaterial(this.pinMat,this.pinMat,{friction:.22,restitution:.23}));
    this.floorContact=new C.ContactMaterial(this.floorMat,this.ballMat,{friction:.12,restitution:.12});
    this.pinContact=new C.ContactMaterial(this.pinMat,this.ballMat,{friction:.14,restitution:.2});
    this.world.addContactMaterial(this.floorContact);this.world.addContactMaterial(this.pinContact);
    this.world.defaultContactMaterial.contactEquationStiffness=1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation=3;
    var self=this;
    function box(x,y,z,sx,sy,sz){var b=new C.Body({mass:0,material:self.floorMat,shape:new C.Box(new C.Vec3(sx/2,sy/2,sz/2)),position:new C.Vec3(x,y,z)});self.world.addBody(b);}
    box(0,-.18,16.5,5.3,.36,39);
    box(-2.96,-.42,16.5,.62,.24,39);box(2.96,-.42,16.5,.62,.24,39);
    box(-3.32,.06,16.5,.12,.9,39);box(3.32,.06,16.5,.12,.9,39);
    box(0,-.25,37.5,6.8,.4,3);box(0,.65,39,6.8,1.8,.25);
    this.pins=[];this.ball=null;this.time=0;this.accumulator=0;this.impact=0;this.reset(kinds[0]);
  }
  Game.prototype.reset=function(kind){
    var self=this;
    this.pins.forEach(function(p){self.world.removeBody(p.body);});
    if(this.ball)this.world.removeBody(this.ball);
    this.ball=null;this.kind=kind;this.time=0;this.accumulator=0;this.impact=0;this.pins=[];
    for(var row=0;row<4;row++)for(var col=0;col<=row;col++){
      var b=new C.Body({mass:1.5,material:this.pinMat,position:new C.Vec3((col-row/2)*.88,.47,30+row*.81),linearDamping:.2,angularDamping:.22});
      b.addShape(new C.Cylinder(.26,.21,.5,12),new C.Vec3(0,-.20,0));
      b.addShape(new C.Cylinder(.105,.26,.35,12),new C.Vec3(0,.225,0));
      b.addShape(new C.Cylinder(.105,.105,.23,12),new C.Vec3(0,.515,0));
      b.addShape(new C.Sphere(.17),new C.Vec3(0,.70,0));
      b.sleepSpeedLimit=.08;b.sleepTimeLimit=.65;
      b.addEventListener('collide',function(e){self.impact=Math.max(self.impact,Math.abs(e.contact.getImpactVelocityAlongNormal()));});
      this.world.addBody(b);this.pins.push({body:b,down:false});
    }
    for(var i=0;i<60;i++)this.world.step(1/180);
    this.floorContact.friction=kind.friction;this.floorContact.restitution=kind.bounce;
    this.pinContact.friction=kind.friction*.6;this.pinContact.restitution=kind.bounce*.7;
  };
  Game.prototype.launch=function(x,angle,power,heightOffset){
    if(this.ball)return;
    var k=this.kind,b=new C.Body({mass:k.mass,material:this.ballMat,linearDamping:k.drag,angularDamping:k.drag*.6});
    if(k.skin===8){
      // 楕円体の当たり形。球の上を上下させる演出ではなく、形そのもので跳ねる。
      var vertices=[],faces=[],rings=9,sides=16;
      for(var j=0;j<rings;j++){var t=.03+(Math.PI-.06)*j/(rings-1);for(var i=0;i<sides;i++){var a=i*Math.PI*2/sides;vertices.push(new C.Vec3(Math.sin(t)*Math.cos(a)*k.r,Math.cos(t)*k.r*1.45,Math.sin(t)*Math.sin(a)*k.r));}}
      for(var j=0;j<rings-1;j++)for(var i=0;i<sides;i++){var n=(i+1)%sides;faces.push([j*sides+i,(j+1)*sides+i,(j+1)*sides+n,j*sides+n]);}
      faces.push(Array.from({length:sides},function(_,i){return sides-1-i;}));faces.push(Array.from({length:sides},function(_,i){return (rings-1)*sides+i;}));
      faces.forEach(function(f,i){if(i<(rings-1)*sides)f.reverse();});
      b.addShape(new C.ConvexPolyhedron({vertices:vertices,faces:faces}));b.quaternion.setFromEuler(.25,0,.45);
    }else b.addShape(new C.Sphere(k.r));
    // 少し浮かせて前へ放り、着地と跳ね返りは素材の物理に任せる。
    b.position.set(x,releaseHeight(k)+Math.max(-.3,Math.min(.8,heightOffset||0)),.65);
    var speed=k.speed*1.35*(power==null?1:Math.max(.4,Math.min(1.3,power)));
    b.velocity.set(angle*speed,.65,speed);
    b.angularVelocity.set(speed/k.r*.72,0,-angle*speed/k.r*.72);
    b.sleepSpeedLimit=.08;b.sleepTimeLimit=.6;
    this.world.addBody(b);this.ball=b;
  };
  Game.prototype.step=function(dt){
    if(!this.ball)return;
    this.accumulator+=Math.min(dt,.1);
    while(this.accumulator>=1/180){this.world.step(1/180);this.accumulator-=1/180;this.time+=1/180;}
    this.pins.forEach(function(p){
      var up=p.body.quaternion.vmult(new C.Vec3(0,1,0));
      if(up.y<.70||p.body.position.y<.23||Math.abs(p.body.position.x)>2.65)p.down=true;
    });
  };
  Game.prototype.snapshot=function(){
    function pose(b){return {x:b.position.x,y:b.position.y,z:b.position.z,q:{x:b.quaternion.x,y:b.quaternion.y,z:b.quaternion.z,w:b.quaternion.w},vx:b.velocity.x,vy:b.velocity.y,vz:b.velocity.z};}
    return {ball:this.ball?pose(this.ball):null,pins:this.pins.map(function(p){var v=pose(p.body);v.down=p.down;return v;}),time:this.time};
  };
  Game.prototype.finished=function(){
    if(!this.ball)return false;
    if(this.time>9)return true;
    var still=this.pins.every(function(p){return p.body.velocity.length()<.15&&p.body.angularVelocity.length()<.2;});
    return this.time>2.5&&still&&(this.ball.position.z>35||this.ball.velocity.length()<.25||this.ball.position.y<-2||this.ball.velocity.z<-.3);
  };
  return {Game:Game,kinds:kinds,releaseHeight:releaseHeight};
})(typeof CANNON!=='undefined'?CANNON:require('./vendor/cannon.js'));
if(typeof module!=='undefined')module.exports=ZBowlingPhysics;
