/* 既存の人物の配色・体形を、厚みのある模型にする。共通の形はまとめて描く。 */
(function(global){
  'use strict';
  function People3D(){
    var T=global.THREE,self=this;
    this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera();
    this.scene.add(new T.HemisphereLight('#ffffff','#697566',2));
    var light=new T.DirectionalLight('#fff4df',2.4);light.position.set(-400,900,500);this.scene.add(light);
    this.geometry={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,10,8),tube:new T.CylinderGeometry(1,1,1,8)};
    this.materials={};this.batches={};this.models=[];this.people=null;this.up=new T.Vector3(0,1,0);this.ray=new T.Raycaster();
    this.mat=function(color){if(!self.materials[color])self.materials[color]=new T.MeshStandardMaterial({color:color,roughness:.9});return self.materials[color];};
  }
  People3D.prototype.shirt=function(p){
    var T=global.THREE,key=p.color+'-'+p.pattern+'-'+p.patternColor;
    if(this.materials[key])return this.materials[key];
    if(!p.pattern)return this.mat(p.color);
    var c=document.createElement('canvas');c.width=c.height=64;var g=c.getContext('2d');
    g.fillStyle=p.color;g.fillRect(0,0,64,64);g.fillStyle=p.patternColor;
    for(var n=0;n<64;n+=16){
      if(p.pattern===1||p.pattern===3)g.fillRect(0,n,64,p.pattern===3?2:5);
      if(p.pattern===2||p.pattern===3)g.fillRect(n,0,p.pattern===3?2:4,64);
      if(p.pattern===4)for(var x=0;x<64;x+=16){g.beginPath();g.arc(x+6,n+6,2.5,0,Math.PI*2);g.fill();}
    }
    if(p.pattern===5)g.fillRect(0,22,64,14);
    var texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
    return this.materials[key]=new T.MeshStandardMaterial({map:texture,roughness:.9});
  };
  People3D.prototype.make=function(p){
    var T=global.THREE,self=this,root=new T.Group();
    function part(kind,color,x,y,z,sx,sy,sz){
      var mesh=new T.Mesh(self.geometry[kind],typeof color==='string'?self.mat(color):color);
      mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);root.add(mesh);return mesh;
    }
    part('ball',this.shirt(p),0,54,0,p.belly+1,18,7);
    part('tube',p.skin,0,73,0,3,7,3);
    part('ball',p.skin,0,82,0,6.5,8,6.2);
    part('ball',p.skin,0,81,6,1.7,2,2);
    [-1,1].forEach(function(s){part('ball','#303533',s*2.5,83,5.8,.7,.7,.7);});
    var hair=['#303632','#654a39','#a9936a','#b9b7aa','#8b533d'][p.hair];
    part('ball',hair,0,87,-1,6.8,p.hairStyle===4?5:3.5,6.4);
    if(p.hairStyle===2)part('box',hair,0,79,-5.2,12,18,4);
    if(p.hairStyle===3)part('ball',hair,0,78,-9,3,9,3);
    if(p.hairStyle===1)part('box',hair,-3,87,3,7,6,6);
    if(p.hat){
      part(p.hat===2?'tube':'ball',p.hatColor,0,91,0,7,p.hat===2?9:6,7);
      if(p.hat!==3)part('tube',p.hatColor,0,87,p.hat===1?3:0,p.hat===2?11:8,1.5,p.hat===2?11:10);
      else part('ball',p.hatColor,0,97,0,2.5,2.5,2.5);
    }
    var legs=[],arms=[];
    [-1,1].forEach(function(s){
      legs.push({side:s,upper:part('tube',p.trousers,0,0,0,3.6,1,3.6),lower:part('tube',p.trousers,0,0,0,3,1,3),foot:part('box','#303533',0,0,0,7,4,11)});
      arms.push({side:s,upper:part('tube',p.color,0,0,0,3.3,1,3.3),lower:part('tube',p.skin,0,0,0,2.3,1,2.3),hand:part('ball',p.skin,0,0,0,2.7,3.5,2.4)});
    });
    return {root:root,legs:legs,arms:arms};
  };
  People3D.prototype.segment=function(mesh,a,b){
    var T=global.THREE,from=new T.Vector3(a[0],a[1],a[2]),to=new T.Vector3(b[0],b[1],b[2]),delta=to.sub(from);
    mesh.position.copy(from).addScaledVector(delta,.5);mesh.scale.y=delta.length();
    mesh.quaternion.setFromUnitVectors(this.up,delta.normalize());
  };
  People3D.prototype.pick=function(x,y,width,height){
    var T=global.THREE;this.ray.setFromCamera(new T.Vector2(x/width*2-1,1-y/height*2),this.camera);
    var hits=this.ray.intersectObjects(this.scene.children,false);
    return hits.length?hits[0].object.userData.owners[hits[0].instanceId]:-1;
  };
  People3D.prototype.render=function(people,time,attacker,victim,elapsed,fall,width,height,pixelWidth,pixelHeight){
    var T=global.THREE,self=this,focal=Math.max(1000,height),angle=48*Math.PI/180;
    // 人物だけ縦横65％・横540画素までに抑え、文字や操作位置は元の解像度を保つ。
    var resolution=Math.min(.65,540/pixelWidth);
    pixelWidth=Math.max(1,Math.round(pixelWidth*resolution));
    pixelHeight=Math.max(1,Math.round(pixelHeight*resolution));
    if(this.renderer.domElement.width!==pixelWidth||this.renderer.domElement.height!==pixelHeight)this.renderer.setSize(pixelWidth,pixelHeight,false);
    this.camera.fov=2*Math.atan(height/(2*focal))*180/Math.PI;this.camera.aspect=width/height;
    this.camera.near=10;this.camera.far=12000;this.camera.position.set(width/2,focal*Math.sin(angle),height/2+focal*Math.cos(angle));
    this.camera.lookAt(width/2,0,height/2);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    if(this.people!==people){this.people=people;this.models=people.map(function(p){return self.make(p);});}
    Object.keys(this.batches).forEach(function(k){self.batches[k].count=0;});
    people.forEach(function(p,i){
      var m=self.models[i],cycle=time*p.pace+p.phase,fallen=p.id===victim&&elapsed>=0;
      var gait=fallen?0:Math.sin(cycle),stride=gait*p.stride;
      m.root.position.set(p.x,fallen?4*fall:Math.abs(gait)*p.bounce,p.y);
      m.root.scale.set(p.build,1.4*p.stature,p.build);
      m.root.rotation.set(0,Math.atan2(p.vx,p.vy),fallen?-fall*fall*(3-2*fall)*Math.PI/2:Math.sin(cycle)*p.sway);
      m.legs.forEach(function(l){
        var z=stride*l.side*10,knee=[l.side*5,21,Math.max(0,z)*.7+2],foot=[l.side*5,3,z];
        self.segment(l.upper,[l.side*5,40,0],knee);self.segment(l.lower,knee,foot);l.foot.position.set(foot[0],2,foot[2]+3);
      });
      m.root.updateMatrixWorld(true);
      var target=null;
      if(p.id===attacker&&elapsed>=0&&elapsed<1/30-1e-9){var other=people[victim];target=m.root.worldToLocal(new T.Vector3(other.x,101*other.stature,other.y));}
      m.arms.forEach(function(a){
        var swing=-Math.sin(cycle+.18)*p.arm*a.side*10*(fallen?0:1);
        var shoulder=[a.side*11,66,0],elbow=[a.side*13,52,swing*.5],hand=[a.side*12,39,swing];
        if(target&&a.side===(target.x<0?-1:1)){hand=[target.x,target.y,target.z];elbow=[(shoulder[0]+hand[0])*.5,(shoulder[1]+hand[1])*.5,(shoulder[2]+hand[2])*.5];}
        self.segment(a.upper,shoulder,elbow);self.segment(a.lower,elbow,hand);a.hand.position.set(hand[0],hand[1],hand[2]);
      });
      m.root.updateMatrixWorld(true);
      m.root.children.forEach(function(mesh){
        var key=mesh.geometry.uuid+mesh.material.uuid,batch=self.batches[key];
        if(!batch){batch=self.batches[key]=new T.InstancedMesh(mesh.geometry,mesh.material,2048);batch.count=0;batch.userData.owners=[];batch.frustumCulled=false;batch.instanceMatrix.setUsage(T.DynamicDrawUsage);self.scene.add(batch);}
        batch.userData.owners[batch.count]=p.id;batch.setMatrixAt(batch.count++,mesh.matrixWorld);
      });
    });
    Object.keys(this.batches).forEach(function(k){self.batches[k].instanceMatrix.needsUpdate=true;self.batches[k].boundingSphere=null;});
    this.renderer.render(this.scene,this.camera);
    return this.renderer.domElement;
  };
  global.ShutoPeople3D=People3D;
})(window);
