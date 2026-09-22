/* 自作の人物・リンク。球と円柱で関節の動きが分かる形に組む。 */
(function(){
  'use strict';
  const photoBase=document.currentScript&&document.currentScript.src?document.currentScript.src.replace(/[^/]*$/, 'img/'):'./img/';
  window.SkateScene=function(){
    const T=window.THREE,scene=new T.Scene();scene.background=new T.Color('#d7edef');scene.fog=new T.Fog('#d7edef',26,83);
    const ground=window.SkatePhysics.ground,course=window.SkatePhysics.create();
    const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
    const camera=new T.PerspectiveCamera(40,1,.1,130);
    scene.add(new T.HemisphereLight(0xffffff,0x547d8c,2.0));const sun=new T.DirectionalLight(0xfff1d9,2.2);sun.position.set(-4,12,7);scene.add(sun);
    const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.65});
    const ice=mat('#b9e0e5'),white=mat('#fffaf0'),navy=mat('#203e51'),coral=mat('#ee715b'),skin=mat('#f5d447'),teal=mat('#318c92'),metal=mat('#759baa'),hair=mat('#47362e');
    function box(w,h,d,m,x,y,z,parent=scene){const o=new T.Mesh(new T.BoxGeometry(w,h,d,1,1,Math.max(1,Math.ceil(d/2))),m);o.position.set(x,y,z);parent.add(o);return o;}
    function ball(r,m,parent=scene){const o=new T.Mesh(new T.SphereGeometry(r,12,8),m);parent.add(o);return o;}
    const cylinder=new T.CylinderGeometry(1,1,1,10),axis=new T.Vector3(0,1,0);
    function bone(m,r,parent=scene){const o=new T.Mesh(cylinder,m);o.userData.r=r;parent.add(o);return o;}
    function join(o,a,b){const av=new T.Vector3(a.x,a.y,a.z),bv=new T.Vector3(b.x,b.y,b.z),d=bv.clone().sub(av);o.position.copy(av).add(bv).multiplyScalar(.5);o.scale.set(o.userData.r,d.length(),o.userData.r);o.quaternion.setFromUnitVectors(axis,d.normalize());}
    box(8,.15,280,ice,0,-.09,124);
    for(let side of [-1,1]){
      box(.19,.78,280,white,side*4,.36,124);box(.24,.10,280,teal,side*4,.8,124);box(.21,.15,280,coral,side*4,.12,124);
      for(let z=-8;z<260;z+=5){box(.06,1.1,.08,metal,side*4,.98,z);}
      for(let row=0;row<3;row++)box(1.15,.32,280,mat(row%2?'#9dbec5':'#769ba7'),side*(5+row*.85),.3+row*.43,124);
      for(let z=-5;z<260;z+=12){box(.10,6,.10,white,side*7,3,z);box(2.6,.09,.22,white,side*6,6,z);}
    }
    const lineMat=new T.MeshBasicMaterial({color:'#e8f6f5',transparent:true,opacity:.5});
    for(let z=-8;z<265;z+=6)box(7.7,.012,.028,lineMat,0,.009,z);
    for(let x of [-2.5,2.5])box(.025,.015,280,lineMat,x,.011,124);
    const circle=new T.Mesh(new T.RingGeometry(2.4,2.43,64),lineMat);circle.rotation.x=-Math.PI/2;circle.position.set(0,.018,7);scene.add(circle);
    // 床・柵・客席の形を同じ坂へ沿わせる。
    scene.updateMatrixWorld(true);
    scene.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);o.localToWorld(v);v.y+=ground(v.z);o.worldToLocal(v);a.setXYZ(i,v.x,v.y,v.z);}a.needsUpdate=true;o.geometry.computeVertexNormals();});
    // 床に敷いた市松模様の先頭をゴール地点にする。
    for(let row=0;row<2;row++)for(let col=0;col<16;col++){const z=course.goal+row*.5+.25;const tile=box(.5,.012,.5,(row+col)%2?navy:white,-3.75+col*.5,ground(z)+.02,z);tile.rotation.x=Math.atan(.072*window.SkatePhysics.downhill(z));}
    const gates=[];
    for(let i=0;i<12;i++){
      const g=new T.Group();g.position.z=16+i*19;g.position.y=ground(g.position.z);scene.add(g);const height=Math.max(1.31,1.82-i*.085)+.28*Math.max(0,1-i/3)+(i>=4&&i<=7?.12:0),slope=i<4||i>7?0:(i%2===0?.08:-.08);
      for(let side of [-1,1]){const endHeight=height+side*2.5*slope;box(.14,endHeight+.25,.14,navy,side*2.5,endHeight/2,0,g);box(.6,.07,.65,navy,side*2.5,.035,0,g);ball(.115,white,g).position.set(side*2.5,endHeight+.13,0);}
      const bar=new T.Group();bar.position.y=height;bar.rotation.z=Math.atan(slope);bar.scale.x=Math.sqrt(1+slope*slope);g.add(bar);
      box(5.15,.105,.105,coral,0,0,0,bar);for(let x=-2.4;x<2.5;x+=.45)box(.17,.11,.11,white,x,0,0,bar);
      gates.push({group:g,bar});
    }
    // 写真を背景専用の画面に合成し、人物やバーの手前には重ねない。
    const photoCanvas=document.createElement('canvas');photoCanvas.width=540;photoCanvas.height=960;
    const photoContext=photoCanvas.getContext('2d'),photoTexture=new T.CanvasTexture(photoCanvas);photoTexture.colorSpace=T.SRGBColorSpace;
    const photos=Array.from({length:5},(_,i)=>{const img=new Image();img.src=photoBase+'tropical-'+(i+1)+'.webp';return img;});
    let festivalFade=0,festivalTime=null,photoIndex=-1,limboActive=false;
    function paintPhoto(img,opacity){if(!img.complete||!img.naturalWidth)return;const cw=photoCanvas.width,ch=photoCanvas.height,scale=Math.max(cw/img.naturalWidth,ch/img.naturalHeight);photoContext.globalAlpha=opacity;photoContext.drawImage(img,(cw-img.naturalWidth*scale)/2,(ch-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale);}
    const person=new T.Group();scene.add(person);
    const parts=[],spheres=[];
    const segments=[[0,1,.21,coral],[1,2,.24,coral],[2,3,.075,skin],[2,4,.10,coral],[4,5,.085,skin],[2,6,.10,coral],[6,7,.085,skin],[0,8,.145,navy],[8,9,.10,navy],[0,10,.145,navy],[10,11,.10,navy]];
    segments.forEach(([a,b,r,m])=>parts.push({a,b,mesh:bone(m,r,person)}));
    for(let i=0;i<12;i++)spheres.push(ball(i===3?.155:i===0?.21:i===1?.23:i===2?.16:i===5||i===7?.085:.11,i===3||i===5||i===7?skin:i<3?coral:i<8?coral:navy,person));
    const head=new T.Group();person.add(head);const cap=ball(.158,hair,head);cap.scale.set(1,.6,1);cap.position.y=.083;
    const nose=ball(.045,skin,head);nose.scale.set(.8,.85,2.8);nose.position.set(0,-.01,.22);
    const scarf=bone(white,.085,person);
    const boots=[];for(let i=0;i<2;i++){const b=new T.Group();person.add(b);const toe=ball(1,white,b);toe.scale.set(.125,.105,.24);toe.position.set(0,.015,.09);const ankle=ball(1,white,b);ankle.scale.set(.105,.16,.12);ankle.position.set(0,.09,-.055);const sole=ball(1,navy,b);sole.scale.set(.127,.035,.245);sole.position.set(0,-.06,.08);box(.035,.075,.60,metal,0,-.10,.05,b);for(let z of [-.03,.08,.19])box(.15,.015,.022,navy,0,.115,z,b);boots.push(b);}
    const shadowMat=new T.MeshBasicMaterial({color:0x31566b,transparent:true,opacity:.13,depthWrite:false});
    const shadows=[];for(let i=0;i<12;i++){const m=new T.Mesh(new T.CircleGeometry(i<4?.35:.17,20),shadowMat);m.rotation.x=-Math.PI/2;m.position.y=.025;scene.add(m);shadows.push(m);}
    const particles=[];for(let i=0;i<48;i++){const p=ball(.025+(i%3)*.012,white);p.visible=false;particles.push(p);}
    /* 今回と過去4回ぶんを固定数の領域に残し、古い滑走ほど薄くする。 */
    const trackHistory=Array.from({length:5},()=>{
      const data=new Float32Array(3200*6),geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.BufferAttribute(data,3));geometry.setDrawRange(0,0);
      const material=new T.LineBasicMaterial({color:'#79a8b5',transparent:true,opacity:.60,depthWrite:false});
      const mesh=new T.LineSegments(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
      return {data,geometry,material,count:0};
    });
    let trackRound=null,trackSlot=-1,trackIndex=0,lastZ=-99,previousFeet=null;
    let follow=0,cameraStopped=false;
    function draw(s,w,h){
      const dt=festivalTime===null||s.t<festivalTime?0:Math.min(.05,s.t-festivalTime);festivalTime=s.t;
      const target=s.state==='play'?window.SkatePhysics.clamp((s.bend-.04)/.55,0,1):0;
      if(s.state==='intro'||s.state==='fall'||(s.state==='result'&&s.reason!=='clear')||s.t===0)festivalFade=0;else festivalFade+=(target-festivalFade)*(1-Math.exp(-dt*4));
      // 小さな揺れでは切り替えず、起こしてから再び反るたびに次の写真へ。
      if(s.state!=='play'||s.bend<.08)limboActive=false;
      if(s.state==='play'&&s.bend>.18&&!limboActive){limboActive=true;photoIndex=(photoIndex+1)%photos.length;}
      const photoHeight=Math.round(540*h/w);if(photoCanvas.height!==photoHeight)photoCanvas.height=photoHeight;
      photoContext.globalAlpha=1;photoContext.fillStyle='#d7edef';photoContext.fillRect(0,0,540,photoCanvas.height);
      if(photoIndex>=0)paintPhoto(photos[photoIndex],festivalFade);
      photoContext.globalAlpha=1;photoTexture.needsUpdate=true;scene.background=photoTexture;
      if(renderer.domElement.width!==w||renderer.domElement.height!==h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=2*Math.atan(Math.tan(22*Math.PI/180)*h/w)*180/Math.PI;camera.updateProjectionMatrix();}
      const p=s.rag||window.SkatePhysics.pose(s);
      p.forEach((v,i)=>{spheres[i].position.set(v.x,v.y,v.z);shadows[i].position.x=v.x;shadows[i].position.z=v.z;shadows[i].position.y=ground(v.z)+.025;});
      parts.forEach(o=>join(o.mesh,p[o.a],p[o.b]));
      head.position.copy(spheres[3].position);head.quaternion.setFromUnitVectors(axis,new T.Vector3(p[3].x-p[2].x,p[3].y-p[2].y,p[3].z-p[2].z).normalize());
      join(scarf,p[2],{x:p[2].x+.005,y:p[2].y+.10,z:p[2].z});
      boots.forEach((b,i)=>{const v=p[i?11:9],k=p[i?10:8];b.position.set(v.x,v.y,v.z);b.rotation.set(s.rag?Math.atan2(k.z-v.z,k.y-v.y):Math.atan(.072*window.SkatePhysics.downhill(s.z)),0,s.rag?-(k.x-v.x):s.roll*.3);});
      gates.forEach((g,i)=>{const v=s.gates[i];g.bar.position.y=v.hit?Math.max(.12,v.height-v.drop*v.drop*3):v.height;g.bar.rotation.z=Math.atan(v.slope||0)+(v.hit?Math.min(.3,v.drop*.5):0);g.bar.position.z=v.hit?v.drop*1.4:0;});
      if(s.state==='play'){
        if(trackRound!==s){
          trackRound=s;trackSlot=(trackSlot+1)%trackHistory.length;trackIndex=0;lastZ=s.z;previousFeet=null;
          const current=trackHistory[trackSlot];current.count=0;current.geometry.setDrawRange(0,0);
          trackHistory.forEach((v,i)=>{const age=(trackSlot-i+trackHistory.length)%trackHistory.length;v.material.opacity=[.60,.43,.31,.22,.15][age];});
        }
        const feet=[p[9],p[11]];
        if(!previousFeet)previousFeet=feet.map(v=>({x:v.x,z:v.z}));
        if(Math.abs(s.z-lastZ)>.08){
          const current=trackHistory[trackSlot];
          feet.forEach((v,i)=>{const prev=previousFeet[i],offset=trackIndex++%3200*6;current.data.set([prev.x,ground(prev.z)+.022,prev.z,v.x,ground(v.z)+.022,v.z],offset);});
          current.count=Math.min(trackIndex,3200);current.geometry.setDrawRange(0,current.count*2);current.geometry.attributes.position.needsUpdate=true;
          previousFeet=feet.map(v=>({x:v.x,z:v.z}));lastZ=s.z;
        }
      }
      particles.forEach((o,i)=>{const fall=s.state==='fall',phase=fall?s.fallTime-i*.009:(s.t*2+i*.19)%1;o.visible=(fall?phase>0&&phase<1.8:s.state==='play'&&Math.abs(s.roll)>.1);if(o.visible){const origin=p[fall?0:i%2?9:11],k=fall?3:.5;o.position.set(origin.x+Math.sin(i*23)*phase*k,ground(origin.z-phase*(fall?2:1))+Math.max(.025,(fall?2:.35)*phase-1.3*phase*phase),origin.z-phase*(fall?2:1));}});
      if(s.state!=='result'||s.reason!=='clear')cameraStopped=false;
      if(!cameraStopped){
      if(s.state==='intro'||s.z<.1)follow=s.z;else follow+=(s.z-follow)*.13;
      const shake=s.impact*.035;
      camera.position.set(s.x*.8+1.65+Math.sin(s.t*65)*shake,ground(follow)+3.2,follow-6.8);camera.lookAt(s.x*.8,ground(follow)+.75,follow+1.0);
      if(s.state==='result'&&s.reason==='clear')cameraStopped=true;
      }
      renderer.render(scene,camera);return renderer.domElement;
    }
    return {draw};
  };
})();
