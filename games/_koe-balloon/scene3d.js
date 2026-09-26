/* 翼・待機用人物・柱を立体で描き、録画にも使う主画面へ合成する。
   模型はすべて基本図形から自作。three.js は隣の既存配布物（MIT）を使う。 */
(function(global){
  'use strict';
  function WingScene(){
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

    this.placeholder=new T.Group();p.add(this.placeholder);
    this.part(this.placeholder,this.ball,0x365664,0,-24,2,23,38,14);
    this.part(this.placeholder,this.ball,0xe7a67d,0,30,5,23,28,20);
    this.part(this.placeholder,this.ball,0x253b4b,0,47,3,24,13,20);
    [-1,1].forEach(function(side){self.part(self.placeholder,self.ball,0x162d3d,side*8,32,24,2.5,3,2);});
    this.wings=[-1,1].map(function(side){
      var root=new T.Group();root.position.x=side*24;p.add(root);
      var mirror=new T.Group();mirror.scale.x=side;root.add(mirror);
      self.part(mirror,self.ball,0xffefc7,33,2,-7,40,15,8);
      for(var i=0;i<8;i++){
        var feather=self.part(mirror,self.ball,i%2?0xffffff:0xe0eaf0,25+i*7,-5-i*1.8,-6+i*.4,30-i*1.5,7,4);
        feather.rotation.z=.12+i*.055;
      }
      return root;
    });
    this.gateModels=[];
  }
  WingScene.prototype.makeGate=function(){
    var T=global.THREE,self=this,root=new T.Group();this.scene.add(root);
    function bar(){
      var g=new T.Group();root.add(g);g.rotation.x=.4;
      return {root:g,body:self.part(g,self.box,0x456873,0,0,0,1,30,26),cap:self.part(g,self.box,0xffc563,0,0,0,12,30,26,true)};
    }
    root.scale.y=40/(30*Math.cos(.4)+26*Math.sin(.4));
    return {root:root,left:bar(),right:bar()};
  };
  WingScene.prototype.render=function(ctx,canvas,s){
    var w=Math.min(canvas.width,810),h=Math.round(w*s.H/s.W);
    if(this.renderer.domElement.width!==w||this.renderer.domElement.height!==h)this.renderer.setSize(w,h,false);
    this.camera.right=s.W;this.camera.bottom=-s.H;this.camera.updateProjectionMatrix();
    var x=s.fallen?s.fallen.x:s.x,y=s.fallen?s.fallen.y:s.y;
    this.person.position.set(x,-y,0);
    this.person.rotation.z=s.fallen?-s.fallen.angle:0;
    this.placeholder.visible=!s.portrait;
    this.wings.forEach(function(wing,i){wing.rotation.z=(i===0?-1:1)*(s.fallen?-.8:s.wings[i]);});
    while(this.gateModels.length<s.gates.length)this.gateModels.push(this.makeGate());
    this.gateModels.forEach(function(m,i){
      var g=s.gates[i];m.root.visible=!!g;if(!g)return;
      m.root.position.set(0,-g.y,0);
      m.left.body.scale.x=g.left;m.left.body.position.x=g.left/2;
      m.left.cap.position.x=g.left-6;
      m.right.body.scale.x=s.W-g.right;m.right.body.position.x=(s.W+g.right)/2;
      m.right.cap.position.x=g.right+6;
    });
    this.renderer.render(this.scene,this.camera);
    ctx.drawImage(this.renderer.domElement,0,0,s.W,s.H);
  };
  global.WingScene=WingScene;
})(window);
