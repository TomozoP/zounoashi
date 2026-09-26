/* 人物・風船・柱を立体で描き、録画にも使う主画面へ合成する。
   模型はすべて基本図形から自作。three.js は隣の既存配布物（MIT）を使う。 */
(function(global){
  'use strict';
  function BalloonScene(){
    var T=global.THREE,self=this;
    this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setClearColor(0,0);
    this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.scene=new T.Scene();
    this.camera=new T.OrthographicCamera(0,540,0,-960,1,3000);
    this.camera.position.set(0,0,1000);
    this.scene.add(new T.HemisphereLight(0xf3fcff,0x677579,1.5));
    var sun=new T.DirectionalLight(0xfff0da,2.3);sun.position.set(-300,500,700);this.scene.add(sun);
    var rim=new T.DirectionalLight(0xc1eaff,.8);rim.position.set(400,-100,-150);this.scene.add(rim);
    this.ball=new T.SphereGeometry(1,24,16);
    this.box=new T.BoxGeometry(1,1,1);
    this.tube=new T.CylinderGeometry(1,1,1,12);
    this.materials={};
    this.mat=function(color,gloss){
      var key=color+'-'+!!gloss;
      return self.materials[key]||(self.materials[key]=new T.MeshStandardMaterial({color:color,roughness:gloss?.23:.62,metalness:gloss?.12:0}));
    };
    this.part=function(parent,geometry,color,x,y,z,sx,sy,sz,gloss){
      var m=new T.Mesh(geometry,self.mat(color,gloss));
      m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
    };
    this.person=new T.Group();this.scene.add(this.person);
    var p=this.person;
    this.body=this.part(p,this.ball,0xfff3d9,0,-8,0,18,22,12);
    this.head=new T.Group();p.add(this.head);
    this.face=this.part(this.head,this.ball,0xe7a67d,0,0,0,20,23,18);
    this.skin=this.face.material;this.skinBase=new T.Color(0xe7a67d);this.skinRed=new T.Color(0xee373d);
    this.part(this.head,this.ball,0x253b4b,0,13,-1,20.5,12,18.5);
    this.part(this.head,this.ball,0xe7a67d,0,-3,18,4,4,5);
    [-1,1].forEach(function(side){
      self.part(self.head,self.ball,0xe7a67d,side*19,0,0,4,6,4);
      self.part(self.head,self.ball,0x162d3d,side*7,3,17,2,2.5,2);
      self.part(self.head,self.ball,0xffffff,side*7-.5,4,18.5,.65,.7,.6);
    });
    this.cheeks=[-1,1].map(function(side){return self.part(self.head,self.ball,0xe7a67d,side*12,-6,14,6,6,5);});
    this.mouth=this.part(this.head,this.ball,0xa86156,0,-9,18,4,1.4,1);
    this.joints=[];
    // 上腕・前腕・太もも・すねを、それぞれ別の関節でつなぐ。
    [[1,3,7,0xfff3d9],[3,4,5,0xe7a67d],[1,5,7,0xfff3d9],[5,6,5,0xe7a67d],
     [0,7,6,0x314858],[7,8,5,0x314858],[0,9,6,0x314858],[9,10,5,0x314858]].forEach(function(v){
      self.joints.push({a:v[0],b:v[1],mesh:self.part(p,self.tube,v[3],0,0,0,v[2],1,v[2])});
    });
    this.hands=[4,6].map(function(i){return {index:i,mesh:self.part(p,self.ball,0xf0b792,0,0,3,5.5,6,5.5)};});
    this.feet=[8,10].map(function(i){return {index:i,mesh:self.part(p,self.ball,0x243846,0,0,3,7,5,10)};});
    this.balloon=this.part(this.scene,this.ball,0xf04b68,155,-400,0,40,44,40,true);
    this.neck=this.part(this.scene,new T.ConeGeometry(1,1,12),0xd83d59,155,-360,0,6,10,6,true);
    this.rope=this.part(this.scene,this.tube,0x6b6060,155,-335,0,1.2,20,1.2);
    this.up=new T.Vector3(0,1,0);
    this.fragments=[];
    for(var i=0;i<12;i++)this.fragments.push(this.part(this.scene,new T.TetrahedronGeometry(1),0xf04b68,0,0,0,5,9,2,true));
    this.gateModels=[];
  }
  BalloonScene.prototype.makeGate=function(){
    var T=global.THREE,self=this,root=new T.Group();this.scene.add(root);
    // 回転後の見える横幅を58にそろえ、当たり判定との横ずれを防ぐ。
    var angle=-.42,extent=43*Math.cos(angle)+44*Math.abs(Math.sin(angle));
    root.scale.x=58/extent;root.rotation.y=0;
    function column(){
      var g=new T.Group();g.rotation.y=angle;root.add(g);
      var body=self.part(g,self.box,0x456873,0,0,0,43,1,44);
      var cap=self.part(g,self.box,0xffc563,0,0,0,43,14,44,true);
      var inset=self.part(g,self.box,0x658690,-11,0,22.2,5,1,.5);
      return {root:g,body:body,cap:cap,inset:inset};
    }
    return {root:root,top:column(),bottom:column()};
  };
  BalloonScene.prototype.render=function(ctx,canvas,s){
    var w=Math.min(canvas.width,810),h=Math.round(w*s.H/s.W);
    if(this.renderer.domElement.width!==w||this.renderer.domElement.height!==h)this.renderer.setSize(w,h,false);
    this.camera.right=s.W;this.camera.bottom=-s.H;this.camera.updateProjectionMatrix();
    this.person.position.set(155,-s.y,0);
    var pts=s.doll?s.doll.points:s.pose.map(function(p){return {x:p[0],y:p[1]};});
    function local(i){return new global.THREE.Vector3(pts[i].x-155,s.y-pts[i].y,0);}
    var hips=local(0),shoulder=local(1),head=local(2),bodyDirection=shoulder.clone().sub(hips);
    this.body.position.copy(hips).add(shoulder).multiplyScalar(.5);
    this.body.quaternion.setFromUnitVectors(this.up,bodyDirection.normalize());
    this.head.position.copy(head);
    this.head.rotation.set(s.doll?-.1:0,.5,s.doll?-Math.atan2(pts[2].x-pts[1].x,pts[1].y-pts[2].y):0);
    this.skin.color.copy(this.skinBase);
    this.cheeks.forEach(function(m){m.scale.set(0,0,0);});
    var self=this;
    this.joints.forEach(function(j){var a=local(j.a),b=local(j.b),d=b.clone().sub(a);j.mesh.position.copy(a).add(b).multiplyScalar(.5);j.mesh.scale.y=d.length();j.mesh.quaternion.setFromUnitVectors(self.up,d.normalize());});
    this.hands.concat(this.feet).forEach(function(p){p.mesh.position.copy(local(p.index));p.mesh.position.z=3;});
    var by=s.y-65-s.radius*1.08;
    this.balloon.position.set(155,-by,0);
    this.balloon.scale.set(s.radius,s.radius*1.08,s.radius);
    this.neck.position.set(155,-by-s.radius*1.08-4,0);
    var ropeTop=-by-s.radius*1.08-8,ropeBottom=-s.y+43;
    this.rope.position.set(155,(ropeTop+ropeBottom)/2,0);
    this.rope.scale.y=Math.max(1,ropeTop-ropeBottom);
    this.balloon.visible=this.neck.visible=this.rope.visible=!s.doll;    this.fragments.forEach(function(m,i){
      m.visible=!!s.doll&&s.fallTime<.65;if(!m.visible)return;
      var angle=i*Math.PI*2/12,t=s.fallTime;
      m.position.set(s.burst.x+Math.cos(angle)*(s.burst.r+180*t),-s.burst.y+Math.sin(angle)*(s.burst.r+180*t)-220*t*t,Math.sin(i)*20);
      m.rotation.set(i+t*8,i*.4+t*12,t*10);m.scale.setScalar(Math.max(.01,1-t/.65)*6);
    });
    while(this.gateModels.length<s.gates.length)this.gateModels.push(this.makeGate());
    this.gateModels.forEach(function(m,i){
      var g=s.gates[i];m.root.visible=!!g;if(!g)return;
      m.root.position.x=g.x+29;
      m.top.body.position.y=-(g.top-30)/2;m.top.body.scale.y=g.top+30;
      m.top.cap.position.y=-g.top+7;
      m.top.inset.position.y=-(g.top-30)/2;m.top.inset.scale.y=Math.max(1,g.top+2);
      m.bottom.body.position.y=-(g.bottom+s.H+30)/2;m.bottom.body.scale.y=s.H+30-g.bottom;
      m.bottom.cap.position.y=-g.bottom-7;
      m.bottom.inset.position.y=-(g.bottom+s.H+44)/2;m.bottom.inset.scale.y=Math.max(1,s.H+16-g.bottom);
    });
    this.renderer.render(this.scene,this.camera);
    ctx.drawImage(this.renderer.domElement,0,0,s.W,s.H);
  };
  global.BalloonScene=BalloonScene;
})(window);
