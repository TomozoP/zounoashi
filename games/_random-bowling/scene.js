/* 光・影・材質と追従カメラ。計算した剛体の位置と回転をそのまま描く。 */
var ZWrestleScene=(function(){
  'use strict';
  function Scene(){
    var T=THREE,self=this;
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new T.Scene();this.scene.scale.x=-1;this.scene.background=new T.Color('#142a37');this.scene.fog=new T.Fog('#142a37',65,150);
    this.camera=new T.PerspectiveCamera(52,540/960,.08,350);
    this.camera.position.set(0,9,-12);this.camera.lookAt(0,0,14);
    this.follow=0;this.followX=0;this.swingX=0;this.swingZ=0;this.w=540;this.h=960;
    this.scene.add(new T.HemisphereLight('#deefff','#625743',2.1));
    var light=new T.DirectionalLight('#fff1d5',3.3);light.position.set(-4,14,18);light.castShadow=true;
    light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-18,right:18,top:35,bottom:-35,near:1,far:90});light.target.position.set(0,0,20);light.shadow.bias=-.0002;this.scene.add(light,light.target);
    var fill=new T.DirectionalLight('#9dcede',1.3);fill.position.set(5,6,-8);this.scene.add(fill);
    function mat(color,roughness,metalness){return new T.MeshStandardMaterial({color:color,roughness:roughness==null?.5:roughness,metalness:metalness||0});}
    function box(x,y,z,w,h,d,m){var mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=true;self.scene.add(mesh);return mesh;}
    // 板目は細い木目を重ね、縦の継ぎ目だけを薄く残す。
    var wood=document.createElement('canvas');wood.width=512;wood.height=1024;var c=wood.getContext('2d');
    c.fillStyle='#cba370';c.fillRect(0,0,512,1024);
    for(var i=0;i<20;i++){c.fillStyle=['#c29a65','#d8b681','#d0aa76','#cda570'][i%4];c.fillRect(i*25.6,0,25.6,1024);c.fillStyle='rgba(71,47,26,.18)';c.fillRect(i*25.6,0,1,1024);
      for(var j=0;j<7;j++){c.strokeStyle='rgba(110,75,39,.09)';c.lineWidth=.7;c.beginPath();var x=i*25.6+j*3.7;for(var y=0;y<=1024;y+=16){var xx=x+Math.sin(y*.018+j*2)*1.1;if(!y)c.moveTo(xx,y);else c.lineTo(xx,y);}c.stroke();}
      for(var y=100+(i%4)*150;y<1024;y+=470){c.fillStyle='rgba(74,48,26,.13)';c.fillRect(i*25.6,y,25.6,1);}
    }
    var wt=new T.CanvasTexture(wood);wt.colorSpace=T.SRGBColorSpace;wt.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    var lane=new T.Mesh(new T.PlaneGeometry(20,79),new T.MeshStandardMaterial({map:wt,roughness:.3,metalness:.05}));lane.rotation.x=-Math.PI/2;lane.position.set(0,.002,36.5);lane.receiveShadow=true;this.scene.add(lane);
    box(0,-.22,36.5,22,.4,79,mat('#273d49',.5));
    [-1,1].forEach(function(s){box(s*10.5,-.12,36.5,1,.13,79,mat('#0a1820',.28,.4));box(s*11.06,.1,36.5,.12,.38,79,mat('#70838b',.28,.65));});
    box(0,-.28,77.5,22,.3,3,mat('#101d25',.85));box(0,3.2,79,22,7,.3,mat('#10222d',.75));
    // 黒い奥壁より上に離して得点を常設する。
    this.scoreCanvas=document.createElement('canvas');this.scoreCanvas.width=768;this.scoreCanvas.height=192;
    this.scoreTexture=new T.CanvasTexture(this.scoreCanvas);this.scoreTexture.colorSpace=T.SRGBColorSpace;
    this.scoreBoard=new T.Mesh(new T.PlaneGeometry(16,4),new T.MeshBasicMaterial({map:this.scoreTexture,transparent:true,toneMapped:false}));
    this.scoreBoard.rotation.y=Math.PI;this.scoreBoard.scale.x=-1;this.scoreBoard.position.set(0,12,78.8);this.scene.add(this.scoreBoard);this.scoreKey=null;
    // 隣のレーンは暗く控えめに置き、奥行きを見せる。
    [-1,1].forEach(function(s){box(s*23,-.05,36.5,20,.1,79,mat('#675846',.48));box(s*12,.22,36.5,.2,.4,79,mat('#304751',.5));});
    this.pinMaterial=mat('#f5f0e6',.24,.04);this.redMaterial=mat('#c52d40',.3);
    var profile=[[0,0],[0,.19],[.05,.22],[.19,.26],[.42,.25],[.64,.19],[.81,.105],[1.02,.105],[1.1,.16],[1.24,.17],[1.33,.09],[1.35,.001]];
    var pinGeo=new T.LatheGeometry(profile.map(function(p){return new T.Vector2(p[1],p[0]-.47);}),32);
    this.pins=[];
    for(var i=0;i<10;i++){var g=new T.Group(),body=new T.Mesh(pinGeo,this.pinMaterial);body.castShadow=true;g.add(body);
      // 底面は読み込み前後とも塞ぎ、裏側から見ても抜けない円板にする。
      var cap=new T.Mesh(new T.CircleGeometry(.195,32),new T.MeshStandardMaterial({color:'#f5f0e6',roughness:.4,side:T.DoubleSide}));cap.rotation.x=Math.PI/2;cap.position.y=-.4705;g.add(cap);
      [.88,1.0].forEach(function(y){var ring=new T.Mesh(new T.CylinderGeometry(.108,.108,.06,24),self.redMaterial);ring.position.y=y-.47;ring.castShadow=true;g.add(ring);});
      g.scale.setScalar(ZWrestlePhysics.pinScale);this.scene.add(g);this.pins.push(g);
    }

    // 四角いマットと三段ロープ。レーン側は投球用に開ける。
    box(0,-.3,-1,12,.6,10,mat('#152735',.85));
    box(0,.006,-1,11.7,.02,9.7,mat('#477887',.95));
    var edge=mat('#c6d6d7',.85);
    [-1,1].forEach(function(side){box(side*5.55,.023,-1,.09,.012,9.1,edge);box(0,.023,-1+side*4.55,11.1,.012,.09,edge);});
    var postMat=mat('#283741',.4,.5),ropeMats=[mat('#d84c51',.7),mat('#e5e3d8',.8),mat('#3d68a1',.7)];
    function rope(a,b,material){var from=new T.Vector3(a[0],a[1],a[2]),to=new T.Vector3(b[0],b[1],b[2]),d=to.clone().sub(from),mesh=new T.Mesh(new T.CylinderGeometry(.045,.045,d.length(),8),material);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());mesh.castShadow=true;self.scene.add(mesh);}
    [-1,1].forEach(function(side){
      [-5.7,3.7].forEach(function(z){
        box(side*5.7,1.05,z,.19,2.1,.19,postMat);
        [.65,1.25,1.85].forEach(function(y){box(side*5.56,y,z,.3,.23,.32,mat(side<0?'#c63746':'#315daf',.8));});
      });
      [.65,1.25,1.85].forEach(function(y,i){rope([side*5.7,y,-5.7],[side*5.7,y,3.7],ropeMats[i]);});
    });
    [.65,1.25,1.85].forEach(function(y,i){rope([-5.7,y,-5.7],[5.7,y,-5.7],ropeMats[i]);});
    this.red=this.makeWrestler('#df2437');this.blue=this.makeWrestler('#2466e7');this.modelReady=false;
    function geometry(d){var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.normal,3));return g;}
    Promise.all([fetch('models.json').then(function(r){return r.json();}),fetch('wrestlers.json').then(function(r){return r.json();})]).then(function(data){
      var pg=geometry(data[0].pin);self.pins.forEach(function(p){p.children[0].geometry=pg;});
      ZWrestlePhysics.parts.forEach(function(p){var geo=geometry(data[1][p.shape]);self.red.parts[p.id].children[0].geometry=geo;self.blue.parts[p.id].children[0].geometry=geo;});self.modelReady=true;
    }).catch(function(e){console.error('模型を読めない',e);});
  }
  Scene.prototype.makeWrestler=function(color){
    var T=THREE,root=new T.Group(),parts={},skin=new T.MeshStandardMaterial({color:'#d69c74',roughness:.65}),pants=new T.MeshStandardMaterial({color:color,roughness:.65}),black=new T.MeshStandardMaterial({color:'#17202b',roughness:.6}),white=new T.MeshStandardMaterial({color:'#fff3dc',roughness:.6});
    ZWrestlePhysics.parts.forEach(function(p){var g=new T.Group(),geo=new T.SphereGeometry(1,16,12);geo.scale(p.size[0],p.size[1],p.size[2]);var body=new T.Mesh(geo,p.shape==='pelvis'?pants:skin);body.castShadow=true;body.receiveShadow=true;g.add(body);g.position.set(p.p[0],p.p[1],p.p[2]);root.add(g);parts[p.id]=g;
      function ellipsoid(x,y,z,sx,sy,sz,m){var mesh=new T.Mesh(new T.SphereGeometry(1,12,8),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;g.add(mesh);}
      if(p.shape==='shin'){ellipsoid(0,-.16,.065,.18,.22,.25,black);ellipsoid(0,.15,.035,.18,.10,.18,pants);}
      if(p.shape==='forearm'){ellipsoid(0,-.14,0,.155,.07,.15,white);ellipsoid(0,-.26,0,.15,.12,.14,skin);}
    });
    root.scale.setScalar(ZWrestlePhysics.humanScale);this.scene.add(root);return {root:root,parts:parts};
  };
  Scene.prototype.resize=function(w,h){this.w=w;this.h=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.fov=2*Math.atan(Math.tan(31*Math.PI/180)*(h/w)/(960/540))*180/Math.PI;this.camera.updateProjectionMatrix();};
  Scene.prototype.project=function(x,y,z){var v=new THREE.Vector3(-x,y,z).project(this.camera);return {x:(v.x*.5+.5)*540,y:(.5-v.y*.5)*this.logicalH};};
  Scene.prototype.draw=function(ctx,W,H,data,phase,angle,omega,dt,history){
    history=history||[];var scoreKey=history.join(',');
    if(this.scoreKey!==scoreKey){
      var c=this.scoreCanvas.getContext('2d');c.clearRect(0,0,768,192);
      c.textAlign='center';c.textBaseline='middle';c.font='600 112px sans-serif';
      for(var i=0;i<3;i++){c.fillStyle='#2c414c';c.fillRect(24+i*248,16,224,160);c.fillStyle='#c2d2d7';c.fillText(history[i]==null?'·':String(history[i]),136+i*248,100);}
      this.scoreTexture.needsUpdate=true;this.scoreKey=scoreKey;
    }
    var T=THREE;this.logicalH=H;var flying=phase==='flight'||phase==='settle',body=data.human[0],target=flying&&body?Math.max(0,Math.min(data.pinDistance-7,body.z-2)):0;
    this.follow+=(target-this.follow)*(1-Math.exp(-4*dt));this.followX+=((flying&&body?Math.max(-2,Math.min(2,body.x*.3)):0)-this.followX)*(1-Math.exp(-3*dt));
    // 振り回される青を少しだけ追い、投球後は滑らかに元の追従へ戻す。
    var swinging=phase==='swing'&&body,blend=1-Math.exp(-7*dt);
    this.swingX+=((swinging?Math.max(-.6,Math.min(.6,body.x*.2)):0)-this.swingX)*blend;
    this.swingZ+=((swinging?Math.max(-.45,Math.min(.45,body.z*.15)):0)-this.swingZ)*blend;
    this.camera.position.set(-this.followX-this.swingX,9-Math.min(1,this.follow/36.5)*3.5,-16+this.follow+this.swingZ);this.camera.lookAt(-this.followX*.5-this.swingX*1.5,.8,12+this.follow*.65+this.swingZ);this.camera.updateMatrixWorld();
    this.pins.forEach(function(g,i){var p=data.pins[i];g.position.set(p.x,p.y,p.z);g.quaternion.set(p.q.x,p.q.y,p.q.z,p.q.w);});
    var red=this.red;red.root.rotation.y=Math.PI/2-angle;red.root.position.y=phase==='swing'?Math.sin(angle*2)*.04:0;
    // 赤は足を踏み替え、両手で青の足首を持つ。
    ['L','R'].forEach(function(tag){var side=tag==='L'?-1:1;
      var shoulder=new T.Vector3(side*.43,1.84,0),elbow=new T.Vector3(side*.43,1.5,.62),hand=new T.Vector3(side*.2,1.5,1.25);
      function segment(id,a,b){var g=red.parts[id],d=b.clone().sub(a);g.position.copy(a).add(b).multiplyScalar(.5);g.scale.y=d.length()/(id.indexOf('upperArm')===0?.58:.56);g.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),d.normalize());}
      segment('upperArm'+tag,shoulder,elbow);segment('forearm'+tag,elbow,hand);
      red.parts['thigh'+tag].rotation.x=Math.sin(angle*2+side)*.1;red.parts['shin'+tag].rotation.x=-Math.sin(angle*2+side)*.1;
    });
    var human=data.human.length?data.human:ZWrestlePhysics.swingPose(angle),blue=this.blue;
    human.forEach(function(p){var g=blue.parts[p.id];g.position.set(p.x/ZWrestlePhysics.humanScale,p.y/ZWrestlePhysics.humanScale,p.z/ZWrestlePhysics.humanScale);g.quaternion.set(p.q.x,p.q.y,p.q.z,p.q.w);});
    this.renderer.render(this.scene,this.camera);ctx.drawImage(this.renderer.domElement,0,0,W,H);
  };
  return Scene;
})();
