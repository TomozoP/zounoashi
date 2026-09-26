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
    this.part(p,this.ball,0xfff3d9,0,-8,0,18,22,12);
    this.part(p,this.ball,0xe7a67d,0,20,1,20,23,18);
    this.part(p,this.ball,0x253b4b,0,33,-1,20.5,12,18.5);
    this.part(p,this.ball,0xe7a67d,0,17,19,4,4,5);
    [-1,1].forEach(function(side){
      self.part(p,self.ball,0xf0b792,side*19,20,0,4,6,4);
      self.part(p,self.ball,0x162d3d,side*7,23,17,2,2.5,2);
      self.part(p,self.ball,0xffffff,side*7-.5,24,18.5,.65,.7,.6);
    });
    this.part(p,this.ball,0xa86156,0,10,18,4,1.4,1);
    this.arms=[];this.legs=[];
    [-1,1].forEach(function(side){
      var arm=new T.Group();arm.position.set(side*15,1,0);p.add(arm);
      self.part(arm,self.ball,0xfff3d9,side*5,3,0,7,10,7);
      self.part(arm,self.ball,0xe7a67d,side*10,13,1,5,10,5);
      self.part(arm,self.ball,0xf0b792,side*12,22,2,5.5,6,5.5);
      self.arms.push(arm);
      var leg=new T.Group();leg.position.set(side*8,-24,0);p.add(leg);
      self.part(leg,self.ball,0x314858,0,-8,0,6,13,6);
      self.part(leg,self.ball,0x243846,0,-18,3,7,5,10);
      self.legs.push(leg);
    });
    this.balloon=this.part(this.scene,this.ball,0xf04b68,155,-400,0,40,44,40,true);
    this.knot=this.part(this.scene,new T.ConeGeometry(1,1,12),0xd83d59,155,-360,0,6,10,6,true);
    this.rope=this.part(this.scene,this.tube,0x6b6060,155,-335,0,1.2,40,1.2);
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
    this.person.rotation.set(0,.5,Math.max(-.16,Math.min(.16,-s.vy/700)));
    for(var i=0;i<2;i++){
      this.legs[i].rotation.x=Math.sin(s.time*4+i*2)*.16;
      this.legs[i].rotation.z=(i?1:-1)*(.15+Math.abs(s.vy)*.0008);
      this.arms[i].rotation.z=(i?1:-1)*(.12+Math.sin(s.time*3)*.035);
    }
    var by=s.y-65-s.radius;
    this.balloon.position.set(155,-by,0);this.balloon.scale.set(s.radius,s.radius*1.08,s.radius);
    this.knot.position.set(155,-by-s.radius*1.08-4,0);
    var ropeTop=-by-s.radius*1.08-8,ropeBottom=-s.y+40;
    this.rope.position.set(155,(ropeTop+ropeBottom)/2,0);this.rope.scale.y=Math.max(1,ropeTop-ropeBottom);
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
