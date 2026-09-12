/* 光・影・材質と追従カメラ。計算した剛体の位置と回転をそのまま描く。 */
var ZBowlingScene=(function(){
  'use strict';
  function Scene(){
    var T=THREE,self=this;
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new T.Scene();this.scene.scale.x=-1;this.scene.background=new T.Color('#142a37');this.scene.fog=new T.Fog('#142a37',42,85);
    this.camera=new T.PerspectiveCamera(52,540/960,.08,100);
    this.camera.position.set(0,5.4,-8.7);this.camera.lookAt(0,0,14);
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
    var lane=new T.Mesh(new T.PlaneGeometry(5.3,39),new T.MeshStandardMaterial({map:wt,roughness:.3,metalness:.05}));lane.rotation.x=-Math.PI/2;lane.position.set(0,.002,16.5);lane.receiveShadow=true;this.scene.add(lane);
    box(0,-.22,16.5,6.8,.4,39,mat('#273d49',.5));
    [-1,1].forEach(function(s){box(s*2.96,-.12,16.5,.61,.13,39,mat('#0a1820',.28,.4));box(s*3.32,.1,16.5,.12,.38,39,mat('#70838b',.28,.65));});
    box(0,-.28,37.5,6.7,.3,3,mat('#101d25',.85));box(0,.9,39,7,2.3,.3,mat('#10222d',.75));
    // 隣のレーンは暗く控えめに置き、奥行きを見せる。
    [-1,1].forEach(function(s){box(s*7,-.05,16,5.3,.1,40,mat('#675846',.48));box(s*4.05,.22,16,.2,.4,40,mat('#304751',.5));});
    for(var i=-3;i<=3;i++){var shape=new T.Shape();shape.moveTo(-.055,0);shape.lineTo(.055,0);shape.lineTo(0,.22);shape.closePath();var arrow=new T.Mesh(new T.ShapeGeometry(shape),mat('#765331',.8));arrow.rotation.x=-Math.PI/2;arrow.position.set(i*.55,.009,6.5+Math.abs(i)*.3);this.scene.add(arrow);}
    this.pinMaterial=mat('#f5f0e6',.24,.04);this.redMaterial=mat('#c52d40',.3);
    var profile=[[0,0],[0,.19],[.05,.22],[.19,.26],[.42,.25],[.64,.19],[.81,.105],[1.02,.105],[1.1,.16],[1.24,.17],[1.33,.09],[1.35,.001]];
    var pinGeo=new T.LatheGeometry(profile.map(function(p){return new T.Vector2(p[1],p[0]-.47);}),32);
    this.pins=[];
    for(var i=0;i<10;i++){var g=new T.Group(),body=new T.Mesh(pinGeo,this.pinMaterial);body.castShadow=true;g.add(body);
      // 底面は読み込み前後とも塞ぎ、裏側から見ても抜けない円板にする。
      var cap=new T.Mesh(new T.CircleGeometry(.195,32),new T.MeshStandardMaterial({color:'#f5f0e6',roughness:.4,side:T.DoubleSide}));cap.rotation.x=Math.PI/2;cap.position.y=-.4705;g.add(cap);
      [.88,1.0].forEach(function(y){var ring=new T.Mesh(new T.CylinderGeometry(.108,.108,.06,24),self.redMaterial);ring.position.y=y-.47;ring.castShadow=true;g.add(ring);});
      this.scene.add(g);this.pins.push(g);
    }
    this.ballMeshes=ZBowlingPhysics.kinds.map(function(k){return self.makeBall(k);});this.ballIndex=-1;this.modelReady=false;
    fetch('models.json').then(function(r){if(!r.ok)throw Error('模型を読めない');return r.json();}).then(function(data){
      function geometry(d){var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.normal,3));return g;}
      var pg=geometry(data.pin);self.pins.forEach(function(p){p.children[0].geometry=pg;});
      var bg=geometry(data.bowling);self.ballMeshes[0].children[0].geometry=bg;self.modelReady=true;
    }).catch(function(e){console.warn(e.message);});
    this.aimLine=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color:'#ee3025',side:T.DoubleSide}));this.scene.add(this.aimLine);
  }
  Scene.prototype.makeBall=function(k){
    var T=THREE,group=new T.Group(),canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
    var c=canvas.getContext('2d');c.fillStyle=k.color;c.fillRect(0,0,512,256);
    var phi=(1+Math.sqrt(5))/2,centers=[];
    for(var a of [-1,1])for(var b of [-1,1]){centers.push(new T.Vector3(0,a,b*phi).normalize(),new T.Vector3(a,b*phi,0).normalize(),new T.Vector3(b*phi,0,a).normalize());}
    if(k.skin===1){
      // 正十二面体の頂点方向に五角形を置く。黒点の並びにしない。
      var id=c.getImageData(0,0,512,256),d=id.data;
      for(var y=0;y<256;y++)for(var x=0;x<512;x++){
        var th=y/256*Math.PI,ph=x/512*Math.PI*2,v=new T.Vector3(-Math.cos(ph)*Math.sin(th),Math.cos(th),Math.sin(ph)*Math.sin(th));
        var black=false;
        for(var j=0;j<centers.length;j++){var n=centers[j],dot=v.dot(n);if(dot<.91)continue;var u=new T.Vector3().crossVectors(n,new T.Vector3(.13,1,.07)).normalize(),w=new T.Vector3().crossVectors(n,u),px=v.dot(u),py=v.dot(w),inside=true;
          for(var f=0;f<5;f++)if(px*Math.cos(f*Math.PI*.4)+py*Math.sin(f*Math.PI*.4)>.235)inside=false;
          if(inside){black=true;break;}}
        if(black){var p=(y*512+x)*4;d[p]=28;d[p+1]=35;d[p+2]=39;}
      }c.putImageData(id,0,0);
    }
    if(k.skin===2){c.strokeStyle='#302619';c.lineWidth=4;for(var x=0;x<=512;x+=128){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke();}c.beginPath();c.moveTo(0,128);c.lineTo(512,128);c.stroke();}
    if(k.skin===3){c.strokeStyle='#fff7d5';c.lineWidth=6;c.beginPath();for(var x=0;x<=512;x++){var y=128+57*Math.cos(x/512*Math.PI*4);if(!x)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
    if(k.skin===4){for(var y=12;y<256;y+=24)for(var x=0;x<512;x+=24){var xx=x+(Math.floor(y/24)%2)*12;c.fillStyle='#9fa9a3';c.beginPath();c.arc(xx,y,4.5,0,Math.PI*2);c.fill();c.fillStyle='#ffffff';c.beginPath();c.arc(xx+1,y+1.5,3.3,0,Math.PI*2);c.fill();}}
    if(k.skin===5){for(var i=0;i<8;i++){c.fillStyle=['#eb6652','#fff4d8','#57bfc8','#fff4d8'][i%4];c.fillRect(i*64,0,64,256);}c.fillStyle='#fff3d7';c.fillRect(0,0,512,16);c.fillRect(0,240,512,16);}
    if(k.skin===7){c.fillStyle='#235e31';for(var i=0;i<11;i++){c.beginPath();for(var y=0;y<=256;y+=4){var x=i*47+4*Math.sin(y*.045+i);if(!y)c.moveTo(x,y);else c.lineTo(x,y);}for(var y=256;y>=0;y-=4)c.lineTo(i*47+14+4*Math.sin(y*.045+i+.5),y);c.closePath();c.fill();}}
    if(k.skin===8){c.fillStyle='#eee6cc';c.fillRect(0,34,512,15);c.fillRect(0,207,512,15);c.strokeStyle='#f7eed5';c.lineWidth=4;c.beginPath();c.moveTo(384,92);c.lineTo(384,164);c.stroke();for(var y=96;y<=160;y+=11){c.beginPath();c.moveTo(373,y);c.lineTo(395,y);c.stroke();}}
    if(k.skin===9){c.fillStyle='#64d7cd';c.fillRect(0,89,512,48);c.fillStyle='#ecd35e';c.fillRect(0,137,512,28);}
    var map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
    var material=new T.MeshStandardMaterial({color:'#ffffff',map:map,roughness:k.skin===6?.17:k.skin===0?.2:k.skin===3?.95:k.skin===8?.75:.5,metalness:k.skin===6?.9:0});
    if(k.skin===0||k.skin===6){material.map=null;material.color.set(k.color);}
    if(k.skin===4){material.bumpMap=map;material.bumpScale=.035;}
    var mesh=new T.Mesh(new T.SphereGeometry(1,40,24),material);if(k.skin===8)mesh.scale.y=1.45;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    // 素材の小さな凹凸。模様を潰さず、光で違いを出す。
    if([2,3,8].indexOf(k.skin)>=0){var bump=document.createElement('canvas');bump.width=bump.height=128;var bc=bump.getContext('2d'),im=bc.createImageData(128,128);for(var i=0;i<im.data.length;i+=4){var n=128+((Math.sin(i*12.31)*43758)%1)*45;im.data[i]=im.data[i+1]=im.data[i+2]=n;im.data[i+3]=255;}bc.putImageData(im,0,0);material.bumpMap=new T.CanvasTexture(bump);material.bumpMap.wrapS=material.bumpMap.wrapT=T.RepeatWrapping;material.bumpMap.repeat.set(5,3);material.bumpScale=.012;}
    this.scene.add(group);group.visible=false;return group;
  };
  Scene.prototype.resize=function(w,h){this.w=w;this.h=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.fov=2*Math.atan(Math.tan(26*Math.PI/180)*(h/w)/(960/540))*180/Math.PI;this.camera.updateProjectionMatrix();};
  Scene.prototype.project=function(x,y,z){var v=new THREE.Vector3(-x,y,z).project(this.camera),v2=new THREE.Vector3(-x-1,y,z).project(this.camera);return {x:(v.x*.5+.5)*540,y:(.5-v.y*.5)*this.logicalH,k:Math.abs(v2.x-v.x)*270};};
  Scene.prototype.screenX=function(x){var v=new THREE.Vector3((x/540)*2-1,0,.5).unproject(this.camera),dir=v.sub(this.camera.position).normalize();return -(this.camera.position.x+dir.x*(.65-this.camera.position.z)/dir.z);};
  Scene.prototype.draw=function(ctx,W,H,data,kind,phase,elapsed,position,aim,dt,power){
    this.logicalH=H;var T=THREE;
    var rolling=phase==='roll'||phase==='settle',target=rolling&&data.ball?Math.max(0,Math.min(24,data.ball.z-1.2)):0;
    this.follow+=(target-this.follow)*(1-Math.exp(-3.2*dt));
    this.followX+=((rolling&&data.ball?Math.max(-.7,Math.min(.7,data.ball.x*.16)):0)-this.followX)*(1-Math.exp(-3*dt));
    var ratio=this.follow/24;
    // 投球後だけ低い位置へ滑らかに寄り、ピンの手前で追従を止める。
    this.camera.position.set(-this.followX,5.4-ratio*1.2,-8.7+this.follow);
    this.camera.lookAt(-this.followX*.5,.15,14+this.follow*.65);this.camera.updateMatrixWorld();
    for(var i=0;i<this.pins.length;i++){var p=data.pins[i];if(!p)continue;this.pins[i].position.set(p.x,p.y,p.z);this.pins[i].quaternion.set(p.q.x,p.q.y,p.q.z,p.q.w);}
    this.ballMeshes.forEach(function(m){m.visible=false;});var m=this.ballMeshes[kind.skin];m.visible=true;m.scale.setScalar(kind.r);m.quaternion.identity();
    if(rolling&&data.ball){var b=data.ball;m.position.set(b.x,b.y,b.z);m.quaternion.set(b.q.x,b.q.y,b.q.z,b.q.w);}
    else if(phase==='return'){var t=Math.min(1,elapsed/1.2),ease=1-(1-t)*(1-t);m.position.set(0,kind.r,-9+8.25*ease);m.rotation.x=ease*8.25/kind.r;}
    else if(phase==='receive')m.position.set(0,kind.r,-.75);
    else if(phase==='place'){var t=Math.min(1,elapsed/.4),ease=t*t*(3-2*t);m.position.set(0,kind.r+Math.sin(t*Math.PI)*.12,-.75+1.4*ease);}
    else m.position.set(position,kind.r,.65);
    this.aimLine.visible=phase==='position'||phase==='angle'||phase==='power';
    if(this.aimLine.visible){var length=phase==='power'?.65+29.35*power:30,vertices=[];for(var z=.65;z<length;z+=.85){var end=Math.min(z+.48,length),x=position+aim*(z-.65),ex=position+aim*(end-.65),w=.055;vertices.push(x-w,.025,z,x+w,.025,z,ex+w,.025,end,x-w,.025,z,ex+w,.025,end,ex-w,.025,end);}this.aimLine.geometry.dispose();this.aimLine.geometry=new T.BufferGeometry();this.aimLine.geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));}
    this.renderer.render(this.scene,this.camera);ctx.drawImage(this.renderer.domElement,0,0,W,H);
  };
  return Scene;
})();
