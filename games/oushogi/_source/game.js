  /* Blenderで作った面を、奥から順にcanvasへ描く。追加の読込や道具は要らない。 */
  var MODEL = __MODEL__;
  var thumbMode = /(?:^|[?&])thumb=1(?:&|$)/.test(location.search || '');
  var state, score, T, elapsed, first, selected, focus, impact, held = false;
  var CY = 480;
  var eye, basis, focal, queue, centers = [], shakeX = 0, shakeY = 0;
  var still = document.createElement('canvas'), stillKey = '';
  var shots = [0.7, 2.6/3, 4.1], duration = 0.7+2.6/3+4.1;
  var confirmedAt = null, lotteryBeat = 0;
  function place() { CY = H * 0.49; }
  function newRound() {
    state = 'ready'; score = 0; T = 0; elapsed = 0;
    first = null; selected = false; focus = 0; impact = -1; held = false;
    confirmedAt = null;
  }
  function start() { first = null; state = 'lottery'; T = 0; stillKey = ''; lotteryBeat=0; tone(620,.035,.025,'sine'); }
  function lotteryFirst() { return Math.floor(T / .12) % 2 === 0; }
  function startButton() { return {x:140,y:H*.79,w:260,h:68}; }
  function capture() { state = 'cinema'; T = 0; impact = -1; selected = false; score = 1; }
  function update(dt) {
    elapsed += dt; T += dt;
    if(state==='lottery'){
      var beat=Math.floor(T/.12);
      if(beat!==lotteryBeat){lotteryBeat=beat;tone(beat%2?520:620,.035,.025,'sine');}
    }
    if (state === 'reply' && T >= 1.3) capture();
    if (state === 'cinema') {
      var s = shot();
      if (s.progress >= 0.70 && impact !== s.index) {
        impact = s.index;
        noiseHit(.24, 150, .34, .7);
        noiseHit(.07, 1100, .11, 1.5);
        tone(92, .42, .22, 'sine', 34);
        tone(48, .62, .15, 'triangle', 25, .02);
      }
      if (T >= duration) {
        state = 'result'; T = 0;
        /* 結果へ移る瞬間だけ、勝ちは上がる音、負けは下がる音を鳴らす。 */
        if(first){
          tone(523.25,.22,.065,'sine',null,0);
          tone(659.25,.24,.065,'sine',null,.12);
          tone(783.99,.55,.07,'sine',null,.24);
        }else{
          tone(293.66,.24,.065,'sine',null,0);
          tone(220,.28,.065,'sine',null,.15);
          tone(146.83,.55,.07,'sine',null,.30);
        }
      }
    }
  }
  function shot() {
    var n = T < shots[0] ? 0 : T < shots[0] + shots[1] ? 1 : 2;
    var offset = n === 0 ? 0 : n === 1 ? shots[0] : shots[0] + shots[1];
    /* 三つ目は着手をゆっくり見せ、取った後もカメラだけが寄り続ける。 */
    var local=T-offset;
    var motion=n===2?1.8:shots[n];
    return { index: n, local:local, motion:motion, progress:Math.min(1,local/motion),
      close:n===2?ease((local-1.26)/(shots[2]-1.26)):0 };
  }
  function buttons() {
    return [{ id:'retry', x:52, y:H * 0.64, w:202, h:68, label:'もう一度' },
            { id:'share', x:286, y:H * 0.64, w:202, h:68, label:'Xでシェア' }];
  }
  function hit(b,x,y) { return x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h; }
  function down(x,y) {
    audioOn();
    if (state === 'ready') { if (x == null || hit(startButton(),x,y)) start(); return; }
    if (state === 'lottery') { first=lotteryFirst(); confirmedAt=elapsed; state=first?'play':'reply'; T=0; tone(440,.18,.05); return; }
    if (state === 'result') {
      var b = x == null ? buttons()[focus] : buttons().filter(function(b){return hit(b,x,y);})[0];
      if (b && b.id === 'retry') newRound();
      if (b && b.id === 'share') zShare({text:'迄1手で'+(first?'先手の勝ち':'後手の負け')+'です。 #王将棋'});
      return;
    }
    if (state !== 'play') return;
    if (x == null) { if (selected) capture(); else selected = true; return; }
    var near = centers.map(function(p){return Math.hypot(x-p.x,y-p.y);});
    if (near[0] < 85 && near[0] <= near[1]) { selected = !selected; tone(550,0.05,0.035); }
    else if (selected && near[1] < 95) capture();
  }
  function atCanvas(e) {
    var r=canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};
  }
  wrap.addEventListener('pointerdown',function(e){e.preventDefault(); var p=atCanvas(e); down(p.x,p.y);});
  window.addEventListener('keydown',function(e){
    var go=e.key===' ' || e.code==='Space' || e.key==='Enter';
    if(e.key==='Escape'){e.preventDefault(); if(!e.repeat)newRound();return;}
    if(state==='result' && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key)>=0){e.preventDefault();if(!e.repeat)focus=1-focus;return;}
    if(go){e.preventDefault();if(!e.repeat)down();}
  });
  function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function norm(a){var d=Math.hypot.apply(null,a)||1;return a.map(function(v){return v/d;});}
  function camera(pos,target,zoom){
    eye=pos; var front=norm(sub(target,pos)),right=norm(cross(front,[0,0,1])),up=cross(right,front);
    basis=[right,up,front]; focal=zoom;
  }
  function project(p){var d=sub(p,eye),z=dot(d,basis[2]);return {x:270+dot(d,basis[0])*focal/z+shakeX,y:CY-dot(d,basis[1])*focal/z+shakeY,z:z};}
  function path(points){ctx.beginPath();points.forEach(function(p,i){if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();}
  function worldPath(points){path(points.map(project));}
  function transform(p,m){var c=Math.cos(m.r),s=Math.sin(m.r);return [p[0]*c-p[1]*s+m.x,p[0]*s+p[1]*c+m.y,p[2]+m.z];}
  function model(objects,m,layer){
    objects.forEach(function(o){
      var world=o.v.map(function(v){return transform(v,m);}),screen=world.map(project);
      /* 文字の三角形はまとめて塗り、境目に白い細線が出るのを防ぐ。 */
      if(o.name.indexOf('墨文字')===0){
        queue.push({paths:o.f.map(function(f){return f.map(function(i){return screen[i];});}),
          z:screen.reduce(function(a,p){return a+p.z;},0)/screen.length,layer:layer+1,color:'#090704'});
        return;
      }
      o.f.forEach(function(f){
        var vs=f.map(function(i){return world[i];}),ps=f.map(function(i){return screen[i];});
        var n=norm(cross(sub(vs[1],vs[0]),sub(vs[2],vs[0])));
        if(dot(n,sub(eye,vs[0]))<=0)return;
        var light=0.69+Math.max(0,dot(n,[-0.35,-0.45,0.82]))*0.31;
        queue.push({p:ps,z:ps.reduce(function(a,p){return a+p.z;},0)/ps.length,layer:o.name.indexOf('盤の脚')===0?.5:layer+(o.color[0]<.1?1:0),
          color:'rgb('+o.color.map(function(c){return Math.round((o.color[0]>.2?Math.sqrt(c):c)*255*light);}).join(',')+')',
          grain:n[2]>.99 && f.length>=4 && o.color[0]>.2,vs:vs,m:m});
      });
    });
  }
  function flat(points,color,layer){var ps=points.map(project);queue.push({p:ps,z:ps.reduce(function(a,p){return a+p.z;},0)/ps.length,color:color,layer:layer||0});}
  function shadow(x,y,z,opacity){
    var pts=[];for(var i=0;i<24;i++){var a=i*Math.PI/12;pts.push([x+Math.cos(a)*.66,y+Math.sin(a)*.75,z]);}
    flat(pts,'rgba(36,24,13,'+opacity+')',z>0?3:0);
  }
  function ease(v){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);}
  function scene(){
    var cinematic=state==='cinema',s=cinematic?shot():{index:0,progress:0};
    var p=s.progress,sgn=first===false?-1:1;
    shakeX=shakeY=0;
    if(cinematic){
      var hitAge=s.local-s.motion*.70;
      if(hitAge>=0 && hitAge<.42){
        var power=11*Math.pow(1-hitAge/.42,2);
        shakeX=Math.sin(hitAge*155)*power;
        shakeY=Math.cos(hitAge*127)*power*.72;
      }
    }
    if(state==='ready' && thumbMode){
      /* 一覧の絵だけは、二枚の駒と盤の厚みが読める斜め上から撮る。 */
      camera([4.7,-7.8,12.5],[0,0,-.22],Math.min(900,H));
    }
    else if(state==='ready'){
      /* 開始前だけ、30秒で一周する。開始後は盤を真上から見せる。 */
      var angle=elapsed*Math.PI*2/30;
      camera([Math.sin(angle)*9,-Math.cos(angle)*9,11.5],[0,0,-.25],Math.min(760,H*.84));
    }
    else if(cinematic && s.index===1)camera([5.9,-4.2+1.1*p,2.8],[0,.05,.14],780);
    else if(cinematic && s.index===2)camera([0,-.1+sgn*1.02*s.close,10.4-.8*p-1.2*s.close],
      [0,sgn*1.02*s.close,0],980+100*p+140*s.close);
    else if(cinematic) camera([3.5-p*.7,-7.8,11.8],[0,0,-.12],990+120*p);
    else camera([0,-.1,11.5],[0,0,0],Math.min(820,H*.94));
    queue=[];
    // 畳の縁や継ぎ目は描かず、短い織り目だけを床に重ねる。
    flat([[-12,-12,-1.58],[12,-12,-1.58],[12,12,-1.58],[-12,12,-1.58]],'#79775a');
    for(var row=-30;row<=30;row++){
      for(var col=-30;col<=30;col++){
        var tx=col*.25+(row%2)*.125,ty=row*.25;
        var weave=project([tx,ty,-1.579]);
        if(weave.x<-12||weave.x>W+12||weave.y<-12||weave.y>H+12)continue;
        flat([[tx,ty,-1.579],[tx+.17,ty,-1.579],[tx+.17,ty+.018,-1.579],[tx,ty+.018,-1.579]],
          (row+col)%3===0?'rgba(213,201,142,.14)':'rgba(41,49,26,.10)',.1);
      }
    }
    flat([[-2.78,-2.74,-1.57],[3.10,-2.74,-1.57],[3.10,3.22,-1.57],[-2.78,3.22,-1.57]],'rgba(21,24,14,.24)');
    model(MODEL.board,{x:0,y:0,z:0,r:0},1);
    var progress=cinematic?ease((p-.12)/.58):state==='result'?1:0;
    var lift=cinematic?Math.sin(progress*Math.PI)*.94:0;
    var active={x:0,y:sgn*(-1.02+2.04*progress),z:lift+.012,r:sgn===1?0:Math.PI};
    var passive={x:0,y:sgn*1.02,z:.012,r:sgn===1?Math.PI:0};
    var activeNear=project([active.x,active.y,active.z]).z<project([passive.x,passive.y,passive.z]).z;
    if(progress<.92){shadow(passive.x,passive.y,.015,.16);model(first===false?MODEL.piece:MODEL.opponent,passive,activeNear?4:6);}
    shadow(active.x+lift*.15,active.y+.03,.016,.16/(1+lift));
    model(first===false?MODEL.opponent:MODEL.piece,active,activeNear?6:4);
    if(state==='play' && selected){
      flat([[-.94,-1.94,.019],[.94,-1.94,.019],[.94,-.10,.019],[-.94,-.10,.019]],'rgba(252,230,148,.20)',3);
      flat([[-.94,.1,.019],[.94,.1,.019],[.94,1.94,.019],[-.94,1.94,.019]],'rgba(252,230,148,.29)',3);
    }
    queue.sort(function(a,b){return a.layer-b.layer || b.z-a.z;});
    queue.forEach(function(f){
      if(f.paths){
        ctx.beginPath();f.paths.forEach(function(ps){ps.forEach(function(p,i){if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();});
        ctx.fillStyle=f.color;ctx.fill();return;
      }
      path(f.p);ctx.fillStyle=f.color;ctx.fill();
      if(f.grain){
        ctx.save();ctx.clip();ctx.strokeStyle='rgba(86,43,12,.13)';ctx.lineWidth=.65;
        var z=f.vs[0][2]+.0001;
        for(var k=-3;k<=3;k+=.062){
          ctx.beginPath();for(var t=-3;t<=3;t+=.3){var pp=project([k+.014*Math.sin(t*3+k*29),t,z]);if(t===-3)ctx.moveTo(pp.x,pp.y);else ctx.lineTo(pp.x,pp.y);}ctx.stroke();
        }ctx.restore();
      }
    });
    centers=[project([0,-1.02,.2]),project([0,1.02,.2])];
    if(state==='play' && selected){var q=centers[1];ctx.strokeStyle='#fff0b0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,53,0,Math.PI*2);ctx.stroke();}
  }
  function text(str,x,y,size,color){ctx.fillStyle=color||'#f1e6cf';ctx.font=size+'px "Yu Mincho", "Hiragino Mincho ProN", serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(str,x,y);}
  function resultLabel(){ return first?'先手勝ち':'後手負け'; }
  function turnLabel(){
    if(state==='lottery'||(confirmedAt!==null&&elapsed-confirmedAt<1)){
      var turn=state==='lottery'?lotteryFirst():first;
      text('あなたは'+(turn?'先攻':'後攻')+'です',270,H*.79+34,30);
    }
  }
  function plaque(str,x,y,on){
    ctx.fillStyle=on?'#e8d6ad':'#302d25';ctx.fillRect(x-52,y-28,104,56);
    ctx.strokeStyle=on?'#f8e9c7':'#77705b';ctx.lineWidth=1;ctx.strokeRect(x-48,y-24,96,48);
    text(str,x,y,24,on?'#322b20':'#b9af96');
  }
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#777358';ctx.fillRect(0,0,W,H);
    if(state==='cinema'||state==='ready') scene();
    else {
      var cacheKey=[state,first,selected,H].join('/');
      if(cacheKey!==stillKey){
        still.width=W*2;still.height=H*2;
        var main=ctx;ctx=still.getContext('2d');ctx.setTransform(2,0,0,2,0,0);
        scene();ctx=main;stillKey=cacheKey;
      }
      ctx.drawImage(still,0,0,W,H);
    }
    var shade=ctx.createRadialGradient(270,CY,150,270,CY,H*.7);
    shade.addColorStop(0,'rgba(16,18,12,0)');shade.addColorStop(1,'rgba(16,18,12,.75)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
    if(state==='cinema'){
      var s=shot(),opening=Math.min(1,T/.1);ctx.fillStyle='#11110e';ctx.fillRect(0,0,W,80*opening);ctx.fillRect(0,H-80*opening,W,80*opening);
      var flash=Math.max(0,1-Math.abs(s.progress-.70)*35);if(flash){ctx.fillStyle='rgba(255,240,203,'+(flash*.22)+')';ctx.fillRect(0,80,W,H-160);}
      turnLabel();
      return;
    }
    if(state==='ready' && !thumbMode){
      var b=startButton();ctx.fillStyle='#e6d7b7';ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.strokeStyle='#a89a77';ctx.strokeRect(b.x+4,b.y+4,b.w-8,b.h-8);
      text('対局開始',270,b.y+b.h/2,28,'#30291e');
    }
    turnLabel();
    if(state==='result'){
      ctx.fillStyle='rgba(19,19,15,.76)';ctx.fillRect(0,H*.12,W,H*.76);
      text(resultLabel(),270,H*.33,54);text('1手',270,H*.46,38,'#cbbc99');
      buttons().forEach(function(b,i){
        ctx.fillStyle=focus===i?'#e6d7b7':'#302f28';ctx.fillRect(b.x,b.y,b.w,b.h);
        ctx.strokeStyle='#c4b38a';ctx.strokeRect(b.x+4,b.y+4,b.w-8,b.h-8);
        text(b.label,b.x+b.w/2,b.y+b.h/2,24,focus===i?'#30291e':'#e6d7b7');
      });
    }
  }
  window.__probe={
    now:function(){return {state:state,score:score,W:W,H:H,first:first,selected:selected,camera:state==='cinema'?shot().index:null,
      time:T,cells:2,pieces:state==='result'?1:2,playerPiece:'王将',opponentPiece:'玉将',resultLabel:state==='result'?resultLabel():null,
      centers:centers,buttons:buttons(),shake:{x:shakeX,y:shakeY},duration:duration,startButton:startButton(),lotteryFirst:lotteryFirst()};},
    step:function(n){for(var i=0;i<(n||1);i++){update(1/60);draw();}},reset:newRound
  };
  /* ============ ループ ============ */
  newRound();layout();draw();
  var last=performance.now();
  function loop(now){var dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(loop);}
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>
