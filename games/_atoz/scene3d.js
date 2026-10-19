/* 立体の場面（three.js）。机の上の、A〜Zのボタンを無理やり詰め込んだゲーム機。
   ゲームの進行は index.html に置き、ここは見た目と、ボタンが画面のどこに写っているか（タップの当たり）だけを受け持つ。
   模型はすべて基本図形から自作。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* ゲーム機の寸法（机の上に寝かせて置く。x 横、z 手前、y 上。単位cm） */
  var BW = 10.6, BL = 20, BH = 1.4;
  var SW = 7.0, SL = 5.6, SZ = -6.4;            /* 画面（160:128）。中心の z */

  /* btns: [{ id, kind: "round" | "pad" | "shoulder", x, z, r, col, label }]（index.html が決める） */
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

    /* ボタン */
    var holeM = Z3.std(0x8a6a20, { roughness: 0.7 });
    var labels = {};
    function labelMat(text, dark) {
      var k = text + (dark ? "d" : "");
      if (!labels[k]) labels[k] = new T.MeshBasicMaterial({ transparent: true, map: Z3.canvasTex(64, 64, function (c, w, h) {
        c.fillStyle = dark ? "#16202e" : "#fff"; c.font = "bold 44px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(text, w / 2, h / 2 + 3);
      }) });
      return labels[k];
    }
    this.btn = {};
    this.base = {};
    btns.forEach(function (b) {
      var g = new T.Group(), m, lab;
      if (b.kind === "shoulder") {
        m = new T.Mesh(new T.BoxGeometry(2.8, 0.7, 0.9), Z3.std(b.col, { roughness: 0.5 }));
        g.add(m);
        lab = new T.Mesh(new T.PlaneGeometry(0.8, 0.8), labelMat(b.label, true));
        lab.rotation.x = -Math.PI / 2; lab.position.y = 0.36; g.add(lab);
        g.position.set(b.x, top - 0.3, b.z);
      } else if (b.kind === "pad") {
        /* 十字キーの腕1本。4本で十字になる */
        var horiz = b.dir === "left" || b.dir === "right";
        m = new T.Mesh(new T.BoxGeometry(horiz ? 1.1 : 0.95, 0.4, horiz ? 0.95 : 1.1), Z3.std(0x2a2d38, { roughness: 0.45 }));
        g.add(m);
        var tri = new T.Shape(), d = 0.22;
        tri.moveTo(0, -d); tri.lineTo(-d * 0.9, d * 0.6); tri.lineTo(d * 0.9, d * 0.6); tri.closePath();
        var tm = new T.Mesh(new T.ShapeGeometry(tri), new T.MeshBasicMaterial({ color: 0x5a5f70 }));
        tm.rotation.x = -Math.PI / 2;
        tm.rotation.z = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[b.dir];
        tm.position.y = 0.21; g.add(tm);
        g.position.set(b.x, top + 0.1, b.z);
      } else {
        m = new T.Mesh(new T.CylinderGeometry(b.r, b.r, 0.26, 24), Z3.std(b.col, { roughness: 0.6 }));
        g.add(m);
        lab = new T.Mesh(new T.PlaneGeometry(b.r * 1.5, b.r * 1.5), labelMat(b.label, b.darkText));
        lab.rotation.x = -Math.PI / 2; lab.position.y = 0.135; g.add(lab);
        g.position.set(b.x, top + 0.11, b.z);
        var hole = new T.Mesh(new T.CircleGeometry(b.r + 0.06, 20), holeM);
        hole.rotation.x = -Math.PI / 2; hole.position.set(b.x, top + 0.005, b.z); dev.add(hole);
      }
      m.castShadow = true;
      if (b.rot) g.rotation.y = b.rot;
      dev.add(g);
      this.btn[b.id] = g;
      this.base[b.id] = g.position.y;
    }, this);
    /* 十字キーの真ん中 */
    var pc = btns.filter(function (b) { return b.kind === "pad"; });
    if (pc.length) {
      var cx = 0, cz = 0; pc.forEach(function (b) { cx += b.x / pc.length; cz += b.z / pc.length; });
      var mid = new T.Mesh(new T.BoxGeometry(0.95, 0.4, 0.95), Z3.std(0x2a2d38, { roughness: 0.45 }));
      mid.position.set(cx, top + 0.1, cz); dev.add(mid);
    }
    this.btns = btns;
  }

  /* s: { pressed: {id: 押されているか}, used: {id: 使い終わったか}, shake: 本体の揺れ(0〜1) } */
  GameScene.prototype.sync = function (s) {
    var self = this;
    this.tex.needsUpdate = true;
    this.btns.forEach(function (b) {
      var g = self.btn[b.id], dn = s.pressed[b.id] ? 0.12 : s.used && s.used[b.id] ? 0.09 : 0;
      g.position.y = self.base[b.id] - dn;
    });
    var k = s.shake || 0;
    this.dev.position.x = Math.sin(k * 60) * k * 0.15;
  };

  /* 画面の形に合わせて、本体がちょうど収まる距離にカメラを置く */
  GameScene.prototype.fit = function (W, H) {
    if (this.fitW === W && this.fitH === H) return;
    this.fitW = W; this.fitH = H;
    var cam = this.camera, v = cam.fov * Math.PI / 360, hz = Math.atan(Math.tan(v) * W / H);
    var d = Math.max((BW / 2 + 0.35) / Math.tan(hz), (BL / 2 + 0.9) / Math.tan(v)) + this.top;
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
  /* ボタンの写っている場所と大きさ */
  GameScene.prototype.buttonAt = function (b, W, H) {
    var c = this.screen(b.x, this.top, b.z, W, H), e = this.screen(b.x + b.r, this.top, b.z, W, H);
    return { x: c.x, y: c.y, r: Math.abs(e.x - c.x) };
  };
  GameScene.prototype.draw = function (ctx, W, H) {
    this.fit(W, H);
    return this.stage.draw(ctx, W, H);
  };

  global.GameScene = GameScene;
})(window);
