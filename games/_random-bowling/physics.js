/* レッスルボウル。関節でつないだレスラーと大型ピンの剛体計算。 */
var ZWrestlePhysics=(function(C){
  'use strict';
  var scale=1.8,parts=[
    {id:'pelvis',shape:'pelvis',p:[0,1.08,0],size:[.33,.22,.23],mass:16},
    {id:'torso',shape:'torso',p:[0,1.64,0],size:[.43,.40,.24],mass:28},
    {id:'head',shape:'head',p:[0,2.30,0],size:[.24,.29,.23],mass:6}
  ];
  [-1,1].forEach(function(s){var tag=s<0?'L':'R';parts.push(
    {id:'upperArm'+tag,shape:'upperArm',p:[s*.60,1.59,0],size:[.18,.29,.18],mass:4},
    {id:'forearm'+tag,shape:'forearm',p:[s*.64,1.07,0],size:[.14,.28,.14],mass:3},
    {id:'thigh'+tag,shape:'thigh',p:[s*.20,.69,0],size:[.22,.34,.23],mass:9},
    {id:'shin'+tag,shape:'shin',p:[s*.20,.19,0],size:[.16,.34,.17],mass:5});});
  function vector(a){return new C.Vec3(a[0],a[1],a[2]);}
  function pose(b){return {x:b.position.x,y:b.position.y,z:b.position.z,q:{x:b.quaternion.x,y:b.quaternion.y,z:b.quaternion.z,w:b.quaternion.w},vx:b.velocity.x,vy:b.velocity.y,vz:b.velocity.z};}
  function swingPose(angle){
    var yaw=new C.Quaternion(),flat=new C.Quaternion();yaw.setFromEuler(0,-angle,0);flat.setFromEuler(0,0,-Math.PI/2);var roll=new C.Quaternion();roll.setFromEuler(0,-Math.PI/2,0);var q=yaw.mult(flat).mult(roll),origin=new C.Vec3(1.25*Math.cos(angle),1.5,1.25*Math.sin(angle));
    return parts.map(function(part){var p=q.vmult(vector(part.p)).vadd(origin);return {id:part.id,x:p.x,y:p.y,z:p.z,q:{x:q.x,y:q.y,z:q.z,w:q.w}};});
  }
  function Game(){
    this.world=new C.World({gravity:new C.Vec3(0,-9.81,0),allowSleep:true});this.world.solver.iterations=30;this.world.solver.tolerance=.0001;
    this.floorMat=new C.Material('床');this.pinMat=new C.Material('ピン');this.humanMat=new C.Material('レスラー');
    this.world.addContactMaterial(new C.ContactMaterial(this.floorMat,this.pinMat,{friction:.28,restitution:.08}));
    this.world.addContactMaterial(new C.ContactMaterial(this.pinMat,this.pinMat,{friction:.22,restitution:.18}));
    this.world.addContactMaterial(new C.ContactMaterial(this.floorMat,this.humanMat,{friction:.24,restitution:.16}));
    this.world.addContactMaterial(new C.ContactMaterial(this.pinMat,this.humanMat,{friction:.32,restitution:.25}));
    var self=this;
    function box(x,y,z,w,h,d){self.world.addBody(new C.Body({mass:0,material:self.floorMat,collisionFilterGroup:1,shape:new C.Box(new C.Vec3(w/2,h/2,d/2)),position:new C.Vec3(x,y,z)}));}
    box(0,-.2,18,8,.4,40);box(0,-.2,-1,12,.4,10);
    [-1,1].forEach(function(s){box(s*4.45,-.4,20,.9,.3,36);box(s*4.96,.1,20,.12,.8,36);});
    box(0,-.3,39.5,10,.4,3);box(0,1.5,41,10,3,.3);
    this.pins=[];this.bodies=[];this.joints=[];this.reset();
  }
  Game.prototype.reset=function(){
    var self=this;this.joints.forEach(function(j){self.world.removeConstraint(j);});this.bodies.forEach(function(b){self.world.removeBody(b);});this.pins.forEach(function(p){self.world.removeBody(p.body);});
    this.bodies=[];this.joints=[];this.pins=[];this.time=0;this.accumulator=0;this.impact=0;
    for(var row=0;row<4;row++)for(var col=0;col<=row;col++){
      var b=new C.Body({mass:6,material:this.pinMat,collisionFilterGroup:2,position:new C.Vec3((col-row/2)*1.5,.47*scale,29+row*1.4),linearDamping:.22,angularDamping:.24});
      b.addShape(new C.Cylinder(.26*scale,.21*scale,.5*scale,12),new C.Vec3(0,-.20*scale,0));
      b.addShape(new C.Cylinder(.105*scale,.26*scale,.35*scale,12),new C.Vec3(0,.225*scale,0));
      b.addShape(new C.Cylinder(.105*scale,.105*scale,.23*scale,12),new C.Vec3(0,.515*scale,0));
      b.addShape(new C.Sphere(.17*scale),new C.Vec3(0,.70*scale,0));
      b.sleepSpeedLimit=.1;b.sleepTimeLimit=.7;b.addEventListener('collide',function(e){self.impact=Math.max(self.impact,Math.abs(e.contact.getImpactVelocityAlongNormal()));});
      this.world.addBody(b);this.pins.push({body:b,down:false});
    }
    for(var i=0;i<60;i++)this.world.step(1/180);
  };
  Game.prototype.launch=function(angle,omega){
    if(this.bodies.length)return;
    var poses=swingPose(angle),self=this,lookup={},speed=(12+Math.abs(omega)*2.7)*(omega<0?-1:1);
    parts.forEach(function(part,i){var p=poses[i],b=new C.Body({mass:part.mass,material:self.humanMat,collisionFilterGroup:4,collisionFilterMask:3,linearDamping:.035,angularDamping:.15});
      b.addShape(new C.Box(new C.Vec3(part.size[0]*.9,part.size[1]*.9,part.size[2]*.9)));b.position.set(p.x,p.y,p.z);b.quaternion.set(p.q.x,p.q.y,p.q.z,p.q.w);
      // 手を離した瞬間の接線方向。各部位の速度差も回転として引き継ぐ。
      b.velocity.set(-Math.sin(angle)*speed-omega*(p.z-poses[0].z)*.3,2.5+Math.abs(omega)*.12,Math.cos(angle)*speed+omega*(p.x-poses[0].x)*.3);
      b.angularVelocity.set(0,-omega*.3,1.2);b.sleepSpeedLimit=.12;b.sleepTimeLimit=.65;self.world.addBody(b);self.bodies.push(b);lookup[part.id]=b;
    });
    function joint(a,b,p,angleLimit){var ba=lookup[a],bb=lookup[b],pa=parts.find(function(d){return d.id===a;}),pb=parts.find(function(d){return d.id===b;}),va=vector(p).vsub(vector(pa.p)),vb=vector(p).vsub(vector(pb.p));
      var c=new C.ConeTwistConstraint(ba,bb,{pivotA:va,pivotB:vb,axisA:new C.Vec3(0,1,0),axisB:new C.Vec3(0,1,0),angle:angleLimit,twistAngle:.6,maxForce:1e5,collideConnected:false});self.world.addConstraint(c);self.joints.push(c);}
    joint('pelvis','torso',[0,1.30,0],.45);joint('torso','head',[0,2.03,0],.65);
    ['L','R'].forEach(function(tag){var s=tag==='L'?-1:1;joint('torso','upperArm'+tag,[s*.43,1.84,0],1.6);joint('upperArm'+tag,'forearm'+tag,[s*.63,1.32,0],1.3);joint('pelvis','thigh'+tag,[s*.2,.94,0],1.1);joint('thigh'+tag,'shin'+tag,[s*.2,.44,0],1.2);});
  };
  Game.prototype.step=function(dt){
    if(!this.bodies.length)return;this.accumulator+=Math.min(dt,.1);
    while(this.accumulator>=1/180){this.world.step(1/360);this.world.step(1/360);this.accumulator-=1/180;this.time+=1/180;}
    this.pins.forEach(function(p){var up=p.body.quaternion.vmult(new C.Vec3(0,1,0));if(up.y<.7||p.body.position.y<.23*scale||Math.abs(p.body.position.x)>4)p.down=true;});
  };
  Game.prototype.snapshot=function(){return {pins:this.pins.map(function(p){var v=pose(p.body);v.down=p.down;return v;}),human:this.bodies.map(function(b,i){var v=pose(b);v.id=parts[i].id;return v;}),time:this.time};};
  Game.prototype.finished=function(){if(!this.bodies.length)return false;if(this.time>9)return true;var center=this.bodies[0].position,still=this.pins.every(function(p){return p.body.velocity.length()<.2&&p.body.angularVelocity.length()<.3;});return this.time>2.5&&still&&(center.y<-3||center.z<-8||Math.abs(center.x)>12||this.bodies.every(function(b){return b.velocity.length()<.4;})||center.z>37);};
  return {Game:Game,parts:parts,pinScale:scale,swingPose:swingPose};
})(typeof CANNON!=='undefined'?CANNON:require('./vendor/cannon.js'));
if(typeof module!=='undefined')module.exports=ZWrestlePhysics;
