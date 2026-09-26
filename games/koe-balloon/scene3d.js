/* 人物・噴射装置・柱を立体で描き、録画にも使う主画面へ合成する。
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
    this.body=this.part(p,this.box,0xc3d2db,0,-8,0,32,34,25,true);
    this.head=new T.Group();p.add(this.head);
    this.face=this.part(this.head,this.box,0xb1c7d2,0,0,0,40,38,24,false);
    this.skin=this.face.material;this.skinBase=new T.Color(0xb1c7d2);
    this.part(this.head,this.box,0x182f40,0,-4,13,30,12,2,false);
    [-1,1].forEach(function(side){
      self.part(self.head,self.box,0x78f4ff,side*7,-3,15,5,4,2);
      self.part(self.head,self.tube,0x647f93,side*20,0,0,5,12,5,true);
    });


    this.cheeks=[];
    this.joints=[];
    // 上腕・前腕・太もも・すねを、それぞれ別の関節でつなぐ。
    [[1,3,7,0xb5c7d1],[3,4,5,0x829bac],[1,5,7,0xb5c7d1],[5,6,5,0x829bac],
     [0,7,6,0x314858],[7,8,5,0x314858],[0,9,6,0x314858],[9,10,5,0x314858]].forEach(function(v){
      self.joints.push({a:v[0],b:v[1],mesh:self.part(p,self.tube,v[3],0,0,0,v[2],1,v[2])});
    });
    this.hands=[4,6].map(function(i){return {index:i,mesh:self.part(p,self.ball,0x71899b,0,0,3,5.5,6,5.5)};});
    this.feet=[8,10].map(function(i){return {index:i,mesh:self.part(p,self.ball,0x243846,0,0,3,7,5,10)};});
    this.pack=new T.Group();p.add(this.pack);
    this.part(this.pack,this.box,0x405365,-8,0,-13,34,32,18,true);
    this.flames=[];
    [-1,1].forEach(function(side){
      var x=side*20-6;
      self.part(self.pack,self.box,0x71899b,x,0,-10,13,32,14,false);

      self.part(self.pack,self.tube,0x263a49,x,-22,-10,8,9,8,true);
      var flame=self.part(self.pack,new T.ConeGeometry(1,1,14),0xff922e,x,-42,-10,8,35,8);
      flame.rotation.z=Math.PI;flame.name="jetFlame";
      var core=self.part(self.pack,new T.ConeGeometry(1,1,14),0xffefb6,x,-34,-3,4,18,4);
      core.rotation.z=Math.PI;core.name="jetFlame";self.flames.push({outer:flame,core:core});
    });
    this.up=new T.Vector3(0,1,0);
    this.fragments=[];
    for(var i=0;i<36;i++)this.fragments.push(this.part(this.scene,new T.TetrahedronGeometry(1),0xffba58,0,0,0,5,9,2,true));
    this.gateModels=[];this.ghostModels=[];this.blastModels=[];
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
    var model={root:root,top:column(),bottom:column(),cuts:{value:Array.from({length:64},function(){return new T.Vector3(0,0,0);})},cutCount:{value:0},left:{value:0}};
    root.traverse(function(mesh){if(!mesh.isMesh)return;
      mesh.material=mesh.material.clone();
      mesh.material.onBeforeCompile=function(shader){
        shader.uniforms.craters=model.cuts;shader.uniforms.craterCount=model.cutCount;shader.uniforms.pillarLeft=model.left;
        shader.vertexShader="varying vec3 craterWorld;\n"+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace("#include <project_vertex>","#include <project_vertex>\ncraterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;");
        shader.fragmentShader="varying vec3 craterWorld;uniform vec3 craters[64];uniform int craterCount;uniform float pillarLeft;\n"+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace("#include <clipping_planes_fragment>","#include <clipping_planes_fragment>\nfor(int ci=0;ci<64;ci++){if(ci>=craterCount)break;vec2 delta=vec2(craterWorld.x-pillarLeft,-craterWorld.y)-craters[ci].xy;if(dot(delta,delta)<craters[ci].z*craters[ci].z)discard;}");
      };
      mesh.material.customProgramCacheKey=function(){return "円形の爆発跡";};
    });return model;
  };
  BalloonScene.prototype.render=function(ctx,canvas,s){
    var w=Math.min(canvas.width,810),h=Math.round(w*s.H/s.W);
    if(this.renderer.domElement.width!==w||this.renderer.domElement.height!==h)this.renderer.setSize(w,h,false);
    this.camera.right=s.W;this.camera.bottom=-s.H;this.camera.updateProjectionMatrix();
    this.person.position.set(155,-s.y,0);this.person.visible=false;
    var pts=s.doll?s.doll.points:s.pose.map(function(p){return {x:p[0],y:p[1]};});
    function local(i){return new global.THREE.Vector3(pts[i].x-155,s.y-pts[i].y,0);}
    var hips=local(0),shoulder=local(1),head=local(2),bodyDirection=shoulder.clone().sub(hips);
    this.body.position.copy(hips);if(!s.doll)this.body.position.add(shoulder).multiplyScalar(.5);
    if(s.doll)this.body.rotation.set(s.fallTime*5,s.fallTime*4,s.fallTime*3);else this.body.quaternion.setFromUnitVectors(this.up,bodyDirection.normalize());
    this.body.visible=false;
    this.joints.forEach(function(j){j.mesh.visible=false;});
    this.hands.concat(this.feet).forEach(function(p){p.mesh.visible=false;});
    this.head.position.copy(head);
    this.head.rotation.set(s.doll?s.fallTime*7:0,.5,s.doll?s.fallTime*5:0);
    this.skin.color.copy(this.skinBase);
    this.cheeks.forEach(function(m){m.scale.set(0,0,0);});
    var self=this;
    this.joints.forEach(function(j){if(s.doll){j.mesh.position.copy(local(j.b));j.mesh.scale.y=18;j.mesh.rotation.set(s.fallTime*(j.b-4),0,s.fallTime*(j.b-2));return;}var a=local(j.a),b=local(j.b),d=b.clone().sub(a);j.mesh.position.copy(a).add(b).multiplyScalar(.5);j.mesh.scale.y=d.length();j.mesh.quaternion.setFromUnitVectors(self.up,d.normalize());});
    this.hands.concat(this.feet).forEach(function(p){p.mesh.position.copy(local(p.index));p.mesh.position.z=3;});
    this.pack.position.copy(s.doll?hips:head);
    this.pack.quaternion.copy(this.body.quaternion);
    this.flames.forEach(function(f,i){
      f.outer.visible=f.core.visible=!s.doll&&s.level>0;
      var length=22+s.level*48+(Math.sin(s.time*65+i*2)+1)*6;
      f.outer.scale.y=length;f.outer.position.y=-26-length/2;
      f.core.scale.y=length*.58;f.core.position.y=-26-length*.29;
    });
    this.fragments.forEach(function(m,i){
      m.visible=!!s.doll&&s.fallTime<1.1;if(!m.visible)return;
      var angle=i*2.399,t=s.fallTime;
      m.position.set(s.burst.x+Math.cos(angle)*(s.burst.r+(220+i%5*70)*t),-s.burst.y+Math.sin(angle)*(s.burst.r+180*t)-220*t*t,Math.sin(i)*20);
      m.rotation.set(i+t*8,i*.4+t*12,t*10);m.scale.setScalar(Math.max(.01,1-t/1.1)*6);
    });
    while(this.gateModels.length<s.gates.length)this.gateModels.push(this.makeGate());
    this.gateModels.forEach(function(m,i){
      var g=s.gates[i];m.root.visible=!!g;if(!g)return;
      var danger=g.danger||0;
      [m.top,m.bottom].forEach(function(c){c.cap.material.color.setHex(danger>.5?0xff4051:0xffc563);c.body.material.color.setHex(danger>.5?0x633747:0x456873);});
      m.root.position.x=g.x+29;m.left.value=g.x;
      m.cutCount.value=Math.min(64,(g.holes||[]).length);
      (g.holes||[]).slice(0,64).forEach(function(h,j){m.cuts.value[j].set(h.x,h.y*s.H,h.r);});
      m.top.body.position.y=-(g.top-30)/2;m.top.body.scale.y=g.top+30;
      m.top.cap.position.y=-g.top+7;
      m.top.inset.position.y=-(g.top-30)/2;m.top.inset.scale.y=Math.max(1,g.top+2);
      m.bottom.body.position.y=-(g.bottom+s.H+30)/2;m.bottom.body.scale.y=s.H+30-g.bottom;
      m.bottom.cap.position.y=-g.bottom-7;
      m.bottom.inset.position.y=-(g.bottom+s.H+44)/2;m.bottom.inset.scale.y=Math.max(1,s.H+16-g.bottom);
    });
    var ghosts=s.ghosts||[],blasts=s.explosions||[];
    while(this.blastModels.length<blasts.length){
      var material=new global.THREE.MeshBasicMaterial({color:0xffb54c,transparent:true,opacity:.5,depthWrite:false});
      var blast=new global.THREE.Mesh(this.ball,material);this.scene.add(blast);this.blastModels.push(blast);
    }
    this.blastModels.forEach(function(m,i){var e=blasts[i];m.visible=!!e;if(!e)return;m.position.set(e.x-s.scroll,-e.y,35);m.scale.set(25+e.age*230,25+e.age*230,15+e.age*30);m.material.opacity=Math.max(0,.6-e.age);});
    this.renderer.render(this.scene,this.camera);
    ctx.drawImage(this.renderer.domElement,0,0,s.W,s.H);
    // 人物は2Dで描き、同じ画面を録画にも使う。
    function robot(x,y,thrust,number,opacity){
      ctx.save();ctx.translate(x,y);ctx.globalAlpha=opacity;
      if(thrust>0){
        [-24,19].forEach(function(dx){var length=25+Math.sin(s.time*65+dx)*7;
          ctx.fillStyle="#ff9a35";ctx.beginPath();ctx.moveTo(dx-5,19);ctx.lineTo(dx,19+length);ctx.lineTo(dx+5,19);ctx.fill();
          ctx.fillStyle="#fff0a6";ctx.fillRect(dx-2,20,4,length*.45);
        });
      }
      ctx.fillStyle="#506675";ctx.fillRect(-30,-14,12,36);ctx.fillRect(16,-14,10,36);
      ctx.fillStyle="#d0dbe0";ctx.fillRect(-19,-19,38,36);
      ctx.fillStyle="#9eb4c0";ctx.fillRect(-19,13,38,5);
      ctx.fillStyle="#163444";ctx.fillRect(-14,-3,28,11);
      ctx.fillStyle="#80efff";ctx.fillRect(-9,0,5,5);ctx.fillRect(5,0,5,5);
      ctx.fillStyle="#263b4b";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 10px sans-serif";ctx.fillText(String(number||1).padStart(2,"0"),0,-11);
      ctx.restore();
    }
    ghosts.forEach(function(g){robot(g.x,g.y,g.air,g.number,.35);});
    if(!s.dead)robot(155,s.y,s.level,s.number,1);
  };
  global.BalloonScene=BalloonScene;
})(window);
