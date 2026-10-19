/* 立体の場面（three.js）。机の上の、同じボタンが100個あるゲーム機。
   ゲームの進行（どれが本物か・当たり・時間）は index.html に置き、ここは見た目と、
   ボタンが画面のどこに写っているか（タップの当たり）だけを受け持つ。模型はすべて基本図形から自作。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* ゲーム機の寸法（机の上に寝かせて置く。x 横、z 手前、y 上。単位cm） */
  var BW = 10.6, BL = 20, BH = 1.4;
  var SW = 7.5, SL = 6.0, SZ = -6.2;            /* 画面（160:128）。中心の z */

  /* btns: [{x, z, r}] ボタンの置き場所（index.html が決める） */
  function GameScene(lcd, btns) {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: 38 }, finish: { vignette: 0.25, grain: 0.015 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x3a2a20);
    Z3.lights(this.scene, { shadows: true, shadowSize: 14 });
    /* 影を控えめに：光をほぼ真上からにして短くし、全体を少し明るく持ち上げる */
    this.scene.children.forEach(function (l) { if (l.isDirectionalLight && l.castShadow) l.position.set(-1.5, 10, 2.5); });
    this.scene.add(new T.AmbientLight(0xffffff, 0.45));
    this.v = new T.Vector3();

    /* 机 */
    var wood = Z3.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#9a6a43"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 60; i++) {
        g.strokeStyle = "rgba(60,30,10," + (0.05 + Math.random() * 0.1) + ")"; g.lineWidth = 1 + Math.random() * 2;
        var y = Math.random() * h; g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + Math.random() * 10 - 5, w * 0.7, y + Math.random() * 10 - 5, w, y); g.stroke();
      }
    }, 3);
    var desk = new T.Mesh(new T.PlaneGeometry(50, 50), Z3.std(0xffffff, { map: wood, roughness: 0.8 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true;
    this.scene.add(desk);
    var dev = this.dev = new T.Group();
    this.scene.add(dev);

    /* 本体：四隅とも同じ丸みの板 */
    var shape = new T.Shape(), r = 1.0, x0 = -BW / 2, z0 = -BL / 2;
    shape.moveTo(x0 + r, z0); shape.lineTo(x0 + BW - r, z0); shape.quadraticCurveTo(x0 + BW, z0, x0 + BW, z0 + r);
    shape.lineTo(x0 + BW, z0 + BL - r); shape.quadraticCurveTo(x0 + BW, z0 + BL, x0 + BW - r, z0 + BL);
    shape.lineTo(x0 + r, z0 + BL); shape.quadraticCurveTo(x0, z0 + BL, x0, z0 + BL - r);
    shape.lineTo(x0, z0 + r); shape.quadraticCurveTo(x0, z0, x0 + r, z0);
    var body = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: BH, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 10 }), Z3.std(0xf0c85a, { roughness: 0.55 }));
    body.rotation.x = Math.PI / 2; body.position.y = BH + 0.25;
    body.castShadow = true; body.receiveShadow = true;
    dev.add(body);
    var top = this.top = BH + 0.5;

    /* 画面の縁と画面 */
    var bez = new T.Mesh(new T.BoxGeometry(SW + 1.1, 0.12, SL + 1.3), Z3.std(0x2f3550, { roughness: 0.4 }));
    bez.position.set(0, top + 0.02, SZ + 0.1); dev.add(bez);
    this.tex = new T.CanvasTexture(lcd);
    this.tex.magFilter = T.NearestFilter; this.tex.minFilter = T.LinearFilter;
    this.tex.colorSpace = T.SRGBColorSpace;
    var scr = new T.Mesh(new T.PlaneGeometry(SW, SL), new T.MeshBasicMaterial({ map: this.tex }));
    scr.rotation.x = -Math.PI / 2; scr.position.set(0, top + 0.09, SZ);
    dev.add(scr);
    var lamp = new T.Mesh(new T.CircleGeometry(0.12, 12), new T.MeshBasicMaterial({ color: 0x6ee07a }));
    lamp.rotation.x = -Math.PI / 2; lamp.position.set(-SW / 2 - 0.3, top + 0.1, SZ - 0.8); dev.add(lamp);

    /* ボタン。全部同じ形で、色は1つずつ違う */
    var geo = new T.CylinderGeometry(1, 1, 0.26, 24);
    this.markMat = Z3.std(0xffffff, { roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.6 });
    this.lampM = lamp.material;
    var holeM = Z3.std(0x8a6a20, { roughness: 0.7 });
    this.btn = btns.map(function (b) {
      var m = new T.Mesh(geo, Z3.std(b.col, { roughness: 0.6 }));
      m.userData.mat = m.material;
      /* 押している間は暗くする（押した感を見た目でも出す） */
      m.userData.down = m.material.clone(); m.userData.down.color.multiplyScalar(0.55);
      m.scale.set(b.r, 1, b.r);
      m.position.set(b.x, top + 0.11, b.z);
      m.castShadow = true;
      dev.add(m);
      var hole = new T.Mesh(new T.CircleGeometry(b.r + 0.07, 20), holeM);
      hole.rotation.x = -Math.PI / 2; hole.position.set(b.x, top + 0.005, b.z); dev.add(hole);
      return m;
    }, this);
    this.btns = btns;
  }

  /* s: { pressed: [ボタンごとに押されているか], mark: [確かめ用に光らせるか], bounce: 本体の跳ね(0〜1),
          wave: { x, z, t } 押した所から広がる波, pop: [飛び出す高さ], lamp: ランプの色 } */
  GameScene.prototype.sync = function (s) {
    var top = this.top, self = this, w = s.wave;
    this.tex.needsUpdate = true;
    this.btn.forEach(function (m, i) {
      var b = self.btns[i], y = s.pressed[i] ? -0.1 : 0.11;
      if (w) { var d = Math.hypot(b.x - w.x, b.z - w.z) - w.t * 14; if (d > -2 && d < 0) y += Math.sin(-d / 2 * Math.PI) * 0.6; }
      if (s.pop && s.pop[i]) y += s.pop[i];
      var a = s.anim && s.anim[i];
      /* 大外れで飛び散っている間は、渡された位置と傾きのまま */
      if (a) { m.position.set(a.x, top + 0.11 + a.y, a.z); m.rotation.set(a.rx, 0, a.rz); }
      else { m.position.set(b.x, top + y, b.z); m.rotation.set(0, 0, 0); }
      m.material = s.mark && s.mark[i] ? self.markMat : s.pressed[i] && !a ? m.userData.down : m.userData.mat;
      var sc = s.pressed[i] && !a ? 0.9 : 1;
      m.scale.set(b.r * sc, 1, b.r * sc);
    });
    var k = s.bounce || 0;
    this.dev.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * k * 2.5;
    this.dev.rotation.z = Math.sin(k * Math.PI * 4) * k * 0.08;
    if (s.lamp != null) this.lampM.color.setHSL(s.lamp, 0.8, 0.6);
  };

  /* 画面の形に合わせて、本体がちょうど収まる距離にカメラを置く */
  GameScene.prototype.fit = function (W, H) {
    if (this.fitW === W && this.fitH === H) return;
    this.fitW = W; this.fitH = H;
    var cam = this.camera, v = cam.fov * Math.PI / 360, hz = Math.atan(Math.tan(v) * W / H);
    var d = Math.max((BW / 2 + 0.35) / Math.tan(hz), (BL / 2 + 0.4) / Math.tan(v)) + this.top;
    /* 真上から。画面の上が奥（-z） */
    cam.aspect = W / H; cam.updateProjectionMatrix();
    cam.up.set(0, 0, -1);
    cam.position.set(0, d, 0);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
  };
  /* 立体の点(x, y, z)が、ゲームの画面（横W×縦H）のどこに写るか */
  GameScene.prototype.screen = function (x, y, z, W, H) {
    this.fit(W, H);
    this.v.set(x, y, z).project(this.camera);
    return { x: (this.v.x + 1) / 2 * W, y: (1 - this.v.y) / 2 * H };
  };
  /* i番目のボタンの写っている場所と大きさ */
  GameScene.prototype.buttonAt = function (i, W, H) {
    var b = this.btns[i], c = this.screen(b.x, this.top, b.z, W, H), e = this.screen(b.x + b.r, this.top, b.z, W, H);
    return { x: c.x, y: c.y, r: Math.abs(e.x - c.x) };
  };
  GameScene.prototype.draw = function (ctx, W, H) {
    this.fit(W, H);
    return this.stage.draw(ctx, W, H);
  };

  GameScene.BODY = { w: BW, l: BL };
  GameScene.SCREEN = { w: SW, l: SL, z: SZ };
  global.GameScene = GameScene;
})(window);
