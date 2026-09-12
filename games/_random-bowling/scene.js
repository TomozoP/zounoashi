/* 光・影・材質と追従カメラ。計算した剛体の位置と回転をそのまま描く。 */
var ZWrestleScene=(function(){
  'use strict';
  function Scene(){
    var T=THREE,self=this;
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new T.Scene();this.scene.scale.x=-1;this.scene.background=new T.Color('#142a37');this.scene.fog=new T.Fog('#142a37',42,85);
    this.camera=new T.PerspectiveCamera(52,540/960,.08,100);
    this.camera.position.set(0,9,-12);this.camera.lookAt(0,0,14);
    this.follow=0;this.followX=0;this.look=new T.Vector3(0,0,9);this.w=540;this.h=960;
    this.scene.add(new T.HemisphereLight('#deefff','#625743',2.1));
    var light=new T.DirectionalLight('#fff1d5',3.3);light.position.set(-4,14,18);light.castShadow=true;
    light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-8,right:8,top:28,bottom:-28,near:1,far:65});light.target.position.set(0,0,20);light.shadow.bias=-.0002;this.scene.add(light,light.target);
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
    var lane=new T.Mesh(new T.PlaneGeometry(8,39),new T.MeshStandardMaterial({map:wt,roughness:.3,metalness:.05}));lane.rotation.x=-Math.PI/2;lane.position.set(0,.002,16.5);lane.receiveShadow=true;this.scene.add(lane);
    box(0,-.22,16.5,10,.4,39,mat('#273d49',.5));
    [-1,1].forEach(function(s){box(s*4.45,-.12,16.5,.9,.13,39,mat('#0a1820',.28,.4));box(s*4.96,.1,16.5,.12,.38,39,mat('#70838b',.28,.65));});
    box(0,-.28,37.5,10,.3,3,mat('#101d25',.85));box(0,.9,41,10,3,.3,mat('#10222d',.75));
    // 隣のレーンは暗く控えめに置き、奥行きを見せる。
    [-1,1].forEach(function(s){box(s*10,-.05,16,5.3,.1,40,mat('#675846',.48));box(s*6.2,.22,16,.2,.4,40,mat('#304751',.5));});
    for(var i=-3;i<=3;i++){var shape=new T.Shape();shape.moveTo(-.055,0);shape.lineTo(.055,0);shape.lineTo(0,.22);shape.closePath();var arrow=new T.Mesh(new T.ShapeGeometry(shape),mat('#765331',.8));arrow.rotation.x=-Math.PI/2;arrow.position.set(i*.55,.009,6.5+Math.abs(i)*.3);this.scene.add(arrow);}
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

    box(0,-.14,-1,12,.3,10,mat('#233e4c',.8));
    var ring=new T.Mesh(new T.RingGeometry(3.9,4.02,80),mat('#e9d7b1',.7));ring.rotation.x=-Math.PI/2;ring.position.y=.01;this.scene.add(ring);
    this.red=this.makeWrestler('#df2437');this.blue=this.makeWrestler('#2466e7');this.modelReady=false;
    function geometry(d){var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.normal,3));return g;}
    Promise.all([fetch('models.json').then(function(r){return r.json();}),fetch('wrestlers.json').then(function(r){return r.json();})]).then(function(data){
      var pg=geometry(data[0].pin);self.pins.forEach(function(p){p.children[0].geometry=pg;});
      ZWrestlePhysics.parts.forEach(function(p){var geo=geometry(data[1][p.shape]);self.red.parts[p.id].children[0].geometry=geo;self.blue.parts[p.id].children[0].geometry=geo;});self.modelReady=true;
    }).catch(function(e){console.error('模型を読めない',e);});
    this.direction=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color:'#f35644',side:T.DoubleSide,transparent:true,opacity:.85}));this.scene.add(this.direction);
  }
  Scene.prototype.makeWrestler=function(color){
    var T=THREE,root=new T.Group(),parts={},skin=new T.MeshStandardMaterial({color:'#d69c74',roughness:.65}),pants=new T.MeshStandardMaterial({color:color,roughness:.65}),black=new T.MeshStandardMaterial({color:'#17202b',roughness:.6}),white=new T.MeshStandardMaterial({color:'#fff3dc',roughness:.6});
    ZWrestlePhysics.parts.forEach(function(p){var g=new T.Group(),geo=new T.SphereGeometry(1,16,12);geo.scale(p.size[0],p.size[1],p.size[2]);var body=new T.Mesh(geo,p.shape==='pelvis'?pants:skin);body.castShadow=true;body.receiveShadow=true;g.add(body);g.position.set(p.p[0],p.p[1],p.p[2]);root.add(g);parts[p.id]=g;
      function ellipsoid(x,y,z,sx,sy,sz,m){var mesh=new T.Mesh(new T.SphereGeometry(1,12,8),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;g.add(mesh);}
      if(p.shape==='head'){ellipsoid(0,.13,-.03,.245,.18,.22,black);[-1,1].forEach(function(s){ellipsoid(s*.085,.025,.205,.035,.035,.025,white);ellipsoid(s*.085,.025,.226,.014,.020,.008,black);});ellipsoid(0,-.035,.235,.047,.05,.035,skin);ellipsoid(0,-.14,.20,.095,.018,.02,black);}
      if(p.shape==='shin'){ellipsoid(0,-.16,.065,.18,.22,.25,black);ellipsoid(0,.15,.035,.18,.10,.18,pants);}
      if(p.shape==='forearm'){ellipsoid(0,-.14,0,.155,.07,.15,white);ellipsoid(0,-.26,0,.15,.12,.14,skin);}
    });
    this.scene.add(root);return {root:root,parts:parts};
  };
  Scene.prototype.resize=function(w,h){this.w=w;this.h=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.fov=2*Math.atan(Math.tan(31*Math.PI/180)*(h/w)/(960/540))*180/Math.PI;this.camera.updateProjectionMatrix();};
  Scene.prototype.project=function(x,y,z){var v=new THREE.Vector3(-x,y,z).project(this.camera);return {x:(v.x*.5+.5)*540,y:(.5-v.y*.5)*this.logicalH};};
  Scene.prototype.draw=function(ctx,W,H,data,phase,angle,omega,dt){
    var T=THREE;this.logicalH=H;var flying=phase==='flight'||phase==='settle',body=data.human[0],target=flying&&body?Math.max(0,Math.min(22,body.z-2)):0;
    this.follow+=(target-this.follow)*(1-Math.exp(-4*dt));this.followX+=((flying&&body?Math.max(-2,Math.min(2,body.x*.3)):0)-this.followX)*(1-Math.exp(-3*dt));
    this.camera.position.set(-this.followX,9-this.follow/22*3.5,-12+this.follow);this.camera.lookAt(-this.followX*.5,.8,12+this.follow*.65);this.camera.updateMatrixWorld();
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
    human.forEach(function(p){var g=blue.parts[p.id];g.position.set(p.x,p.y,p.z);g.quaternion.set(p.q.x,p.q.y,p.q.z,p.q.w);});
    // 頭の方向を短い矢印で示す。向きの補正や自動照準はしない。
    this.direction.visible=phase==='swing';if(this.direction.visible){var p=human[0],direction=ZWrestlePhysics.headDirection(human),dx=direction.x,dz=direction.z,nx=dz*.12,nz=-dx*.12,len=1.2+Math.abs(omega)*.12,x=p.x+dx*.6,z=p.z+dz*.6;
      var verts=[x+nx,.025,z+nz,x-nx,.025,z-nz,x+dx*len,.025,z+dz*len,x+dx*len+nx*2,.025,z+dz*len+nz*2,x+dx*len-nx*2,.025,z+dz*len-nz*2,x+dx*(len+.5),.025,z+dz*(len+.5)];this.direction.geometry.dispose();this.direction.geometry=new T.BufferGeometry();this.direction.geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));}
    this.renderer.render(this.scene,this.camera);ctx.drawImage(this.renderer.domElement,0,0,W,H);
  };
  return Scene;
})();
