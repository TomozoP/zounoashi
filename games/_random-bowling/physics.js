/* レッスルボウル。関節でつないだレスラーと大型ピンの剛体計算。 */
var ZWrestlePhysics=(function(C){
  'use strict';
  var humanScale=1.5,scale=4.5,parts=[
    {id:'pelvis',shape:'pelvis',p:[0,1.08,0],size:[.33,.22,.23],mass:16},
    {id:'torso',shape:'torso',p:[0,1.64,0],size:[.43,.40,.24],mass:28},
    {id:'head',shape:'head',p:[0,2.30,0],size:[.24,.29,.23],mass:6}
  ];
  [-1,1].forEach(function(s){var tag=s<0?'L':'R';parts.push(
    {id:'upperArm'+tag,shape:'upperArm',p:[s*.60,1.59,0],size:[.18,.29,.18],mass:4},
    {id:'forearm'+tag,shape:'forearm',p:[s*.64,1.07,0],size:[.14,.28,.14],mass:3},
    {id:'thigh'+tag,shape:'thigh',p:[s*.20,.69,0],size:[.22,.34,.23],mass:9},
    {id:'shin'+tag,shape:'shin',p:[s*.20,.19,0],size:[.16,.34,.17],mass:5});});
  function vector(a){return new C.Vec3(a[0]*humanScale,a[1]*humanScale,a[2]*humanScale);}
  function pose(b){return {x:b.position.x,y:b.position.y,z:b.position.z,q:{x:b.quaternion.x,y:b.quaternion.y,z:b.quaternion.z,w:b.quaternion.w},vx:b.velocity.x,vy:b.velocity.y,vz:b.velocity.z};}
  function swingPose(angle){
    var yaw=new C.Quaternion(),flat=new C.Quaternion();yaw.setFromEuler(0,-angle,0);flat.setFromEuler(0,0,-Math.PI/2);var roll=new C.Quaternion();roll.setFromEuler(0,-Math.PI/2,0);var q=yaw.mult(flat).mult(roll),origin=vector([1.25*Math.cos(angle),1.5,1.25*Math.sin(angle)]);
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
    box(0,-.2,29.25,20,.4,64.5);box(0,-.2,-1,12,.4,10);
    [-1,1].forEach(function(s){box(s*10.5,-.4,29.25,1,.3,64.5);box(s*11.06,.1,29.25,.12,.8,64.5);});
    box(0,-.3,63,22,.4,3);box(0,3.2,64.5,22,7,.3);
    this.pins=[];this.bodies=[];this.joints=[];this.grabs=[];this.hands=[];this.reset();
  }
  Game.prototype.reset=function(){
    var self=this;this.releaseHands();this.released=false;this.joints.forEach(function(j){self.world.removeConstraint(j);});this.bodies.forEach(function(b){self.world.removeBody(b);});this.pins.forEach(function(p){self.world.removeBody(p.body);});
    this.bodies=[];this.joints=[];this.pins=[];this.time=0;this.accumulator=0;this.impact=0;
    for(var row=0;row<4;row++)for(var col=0;col<=row;col++){
      var b=new C.Body({mass:12,material:this.pinMat,collisionFilterGroup:2,position:new C.Vec3((col-row/2)*3.75,.47*scale,43.5+row*3.5),linearDamping:.22,angularDamping:.24});
      b.addShape(new C.Cylinder(.26*scale,.21*scale,.5*scale,12),new C.Vec3(0,-.20*scale,0));
      b.addShape(new C.Cylinder(.105*scale,.26*scale,.35*scale,12),new C.Vec3(0,.225*scale,0));
      b.addShape(new C.Cylinder(.105*scale,.105*scale,.23*scale,12),new C.Vec3(0,.515*scale,0));
      b.addShape(new C.Sphere(.17*scale),new C.Vec3(0,.70*scale,0));
      b.sleepSpeedLimit=.1;b.sleepTimeLimit=.7;b.addEventListener('collide',function(e){self.impact=Math.max(self.impact,Math.abs(e.contact.getImpactVelocityAlongNormal()));});
      this.world.addBody(b);this.pins.push({body:b,down:false});
    }
    for(var i=0;i<60;i++)this.world.step(1/180);
  };
  Game.prototype.createHuman=function(angle){
    if(this.bodies.length)return;
    var poses=swingPose(angle),self=this,lookup={};
    parts.forEach(function(part,i){var p=poses[i],b=new C.Body({mass:part.mass,material:self.humanMat,collisionFilterGroup:4,collisionFilterMask:3,linearDamping:.035,angularDamping:.15});
      b.addShape(new C.Box(new C.Vec3(part.size[0]*.9*humanScale,part.size[1]*.9*humanScale,part.size[2]*.9*humanScale)));b.position.set(p.x,p.y,p.z);b.quaternion.set(p.q.x,p.q.y,p.q.z,p.q.w);
      b.sleepSpeedLimit=.12;b.sleepTimeLimit=.65;self.world.addBody(b);self.bodies.push(b);lookup[part.id]=b;
    });
    function joint(a,b,p,angleLimit){var ba=lookup[a],bb=lookup[b],pa=parts.find(function(d){return d.id===a;}),pb=parts.find(function(d){return d.id===b;}),va=vector(p).vsub(vector(pa.p)),vb=vector(p).vsub(vector(pb.p));
      var c=new C.ConeTwistConstraint(ba,bb,{pivotA:va,pivotB:vb,axisA:new C.Vec3(0,1,0),axisB:new C.Vec3(0,1,0),angle:angleLimit,twistAngle:.6,maxForce:1e5,collideConnected:false});self.world.addConstraint(c);self.joints.push(c);}
    joint('pelvis','torso',[0,1.30,0],.45);joint('torso','head',[0,2.03,0],.65);
    ['L','R'].forEach(function(tag){var s=tag==='L'?-1:1;joint('torso','upperArm'+tag,[s*.43,1.84,0],1.6);joint('upperArm'+tag,'forearm'+tag,[s*.63,1.32,0],1.3);joint('pelvis','thigh'+tag,[s*.2,.94,0],1.1);joint('thigh'+tag,'shin'+tag,[s*.2,.44,0],1.2);});
  };
  function throwDirection(angle){return {x:Math.cos(angle),z:Math.sin(angle)};}
  Game.prototype.releaseHands=function(){var self=this;(this.grabs||[]).forEach(function(c){self.world.removeConstraint(c);});(this.hands||[]).forEach(function(b){self.world.removeBody(b);});this.grabs=[];this.hands=[];this.holding=false;};
  Game.prototype.startSwing=function(angle){
    this.createHuman(angle);this.holding=true;this.holdAngle=angle;var self=this;
    ['L','R'].forEach(function(tag){var index=parts.findIndex(function(p){return p.id==='shin'+tag;}),body=self.bodies[index],pivot=vector([0,-.19,0]),pos=body.pointToWorldFrame(pivot),hand=new C.Body({mass:0,type:C.Body.KINEMATIC,collisionFilterMask:0,position:pos});
      self.world.addBody(hand);self.hands.push(hand);var grip=new C.PointToPointConstraint(hand,new C.Vec3(),body,pivot,1e6);grip.collideConnected=false;self.world.addConstraint(grip);self.grabs.push(grip);});
  };
  Game.prototype.swing=function(dt,angle){
    if(!this.holding)return;var steps=Math.max(1,Math.ceil(dt*720)),step=dt/steps,start=this.holdAngle;
    for(var i=0;i<steps;i++){var a=start+(angle-start)*(i+1)/steps;
      this.hands.forEach(function(hand,j){var side=j===0?-1:1,x=1.25*Math.cos(a)-side*.2*Math.sin(a),z=1.25*Math.sin(a)+side*.2*Math.cos(a);hand.velocity.set((x*humanScale-hand.position.x)/step,(1.5*humanScale-hand.position.y)/step,(z*humanScale-hand.position.z)/step);});
      this.world.step(step);
    }this.holdAngle=angle;
  };
  Game.prototype.launch=function(angle,omega){
    if(this.released)return;if(!this.bodies.length)this.createHuman(angle);
    var direction=throwDirection(angle),speed=3+47*Math.pow(Math.min(1,Math.abs(omega)/14),1.5);
    this.releaseHands();this.released=true;this.time=0;this.accumulator=0;
    // 赤レスラーが向く方向へ押し出す。振り回されていた姿勢と各部位の回転は保つ。
    this.bodies.forEach(function(b){b.wakeUp();b.velocity.set(direction.x*speed,2.5+Math.abs(omega)*.12,direction.z*speed);var spin=b.angularVelocity.length();if(spin>18)b.angularVelocity.scale(18/spin,b.angularVelocity);});
  };
  Game.prototype.step=function(dt){
    if(!this.bodies.length||this.holding)return;this.accumulator+=Math.min(dt,.1);
    while(this.accumulator>=1/180){var fast=this.bodies.some(function(b){return b.velocity.length()>35;}),steps=fast?4:2;for(var i=0;i<steps;i++)this.world.step(1/180/steps);this.accumulator-=1/180;this.time+=1/180;}
    this.pins.forEach(function(p){var up=p.body.quaternion.vmult(new C.Vec3(0,1,0));if(up.y<.7||p.body.position.y<.23*scale||Math.abs(p.body.position.x)>10)p.down=true;});
  };
  Game.prototype.snapshot=function(){return {pins:this.pins.map(function(p){var v=pose(p.body);v.down=p.down;return v;}),human:this.bodies.map(function(b,i){var v=pose(b);v.id=parts[i].id;return v;}),time:this.time};};
  Game.prototype.finished=function(){if(!this.bodies.length||this.holding)return false;if(this.time>9)return true;var center=this.bodies[0].position,still=this.pins.every(function(p){return p.body.velocity.length()<.2&&p.body.angularVelocity.length()<.3;});return this.time>2.5&&still&&(center.y<-3||center.z<-8||Math.abs(center.x)>24||this.bodies.every(function(b){return b.velocity.length()<.4;})||center.z>61.5);};
  return {Game:Game,parts:parts,humanScale:humanScale,pinScale:scale,swingPose:swingPose,throwDirection:throwDirection};
})(typeof CANNON!=='undefined'?CANNON:require('./vendor/cannon.js'));
if(typeof module!=='undefined')module.exports=ZWrestlePhysics;
