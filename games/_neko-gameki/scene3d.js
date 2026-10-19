/* 立体の場面（three.js）。机の上のゲーム機と、邪魔しにくるネコ。
   ゲームの進行（当たり・時間・ネコがいつ何をするか）は index.html に置き、ここは見た目と、
   ボタン・ネコが画面のどこに写っているか（タップの当たり）だけを受け持つ。模型はすべて基本図形から自作。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* ゲーム機の寸法（机の上に寝かせて置く。x 横、z 手前、y 上） */
  var BW = 9.2, BL = 14.6, BH = 1.4;           /* 本体 */
  var SW = 6.6, SL = 5.28, SZ = -3.1;           /* 画面（160:128）。中心の z */
  var BTN = { L: [-2.85, 3.3, 0.62], R: [-1.25, 3.3, 0.62], A: [2.55, 3.1, 0.72] };

  function GameScene(lcd) {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: 38 }, finish: { vignette: 0.25, grain: 0.015 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x3a2a20);
    Z3.lights(this.scene, { shadows: true, shadowSize: 12 });

    /* 机 */
    var wood = Z3.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#9a6a43"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 60; i++) {
        g.strokeStyle = "rgba(60,30,10," + (0.05 + Math.random() * 0.1) + ")"; g.lineWidth = 1 + Math.random() * 2;
        var y = Math.random() * h; g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + Math.random() * 10 - 5, w * 0.7, y + Math.random() * 10 - 5, w, y); g.stroke();
      }
    }, 3);
    var desk = new T.Mesh(new T.PlaneGeometry(40, 40), Z3.std(0xffffff, { map: wood, roughness: 0.8 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true;
    this.scene.add(desk);

    /* 本体：角の丸い板 */
    var shape = new T.Shape(), r = 1.0, x0 = -BW / 2, z0 = -BL / 2;
    shape.moveTo(x0 + r, z0); shape.lineTo(x0 + BW - r, z0); shape.quadraticCurveTo(x0 + BW, z0, x0 + BW, z0 + r);
    shape.lineTo(x0 + BW, z0 + BL - 2.2); shape.quadraticCurveTo(x0 + BW, z0 + BL, x0 + BW - 2.2, z0 + BL);
    shape.lineTo(x0 + r, z0 + BL); shape.quadraticCurveTo(x0, z0 + BL, x0, z0 + BL - r);
    shape.lineTo(x0, z0 + r); shape.quadraticCurveTo(x0, z0, x0 + r, z0);
    var body = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: BH, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 10 }), Z3.std(0xf0c85a, { roughness: 0.55 }));
    body.rotation.x = Math.PI / 2; body.position.y = BH + 0.25;
    body.castShadow = true; body.receiveShadow = true;
    this.scene.add(body);
    var top = BH + 0.5;
    this.top = top;

    /* 画面の縁と画面 */
    var bez = new T.Mesh(new T.BoxGeometry(SW + 1.1, 0.12, SL + 1.3), Z3.std(0x2f3550, { roughness: 0.4 }));
    bez.position.set(0, top + 0.02, SZ + 0.1); this.scene.add(bez);
    this.tex = new T.CanvasTexture(lcd);
    this.tex.magFilter = T.NearestFilter; this.tex.minFilter = T.LinearFilter;
    this.tex.colorSpace = T.SRGBColorSpace;
    var scr = new T.Mesh(new T.PlaneGeometry(SW, SL), new T.MeshBasicMaterial({ map: this.tex }));
    scr.rotation.x = -Math.PI / 2; scr.position.set(0, top + 0.09, SZ);
    this.scene.add(scr);
    var lamp = new T.Mesh(new T.CircleGeometry(0.12, 12), new T.MeshBasicMaterial({ color: 0x6ee07a }));
    lamp.rotation.x = -Math.PI / 2; lamp.position.set(-SW / 2 - 0.3, top + 0.1, SZ - 0.8); this.scene.add(lamp);
    /* 下の小さな穴（スピーカー） */
    var holeM = Z3.std(0x8a6a20);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 3; j++) {
      var h = new T.Mesh(new T.CircleGeometry(0.12, 10), holeM);
      h.rotation.x = -Math.PI / 2; h.position.set(2.2 + i * 0.42 - j * 0.0, top + 0.01, 5.4 + j * 0.42); this.scene.add(h);
    }

    /* ボタン */
    this.btn = {};
    var self = this;
    Object.keys(BTN).forEach(function (id) {
      var b = BTN[id], g = new T.Group();
      var m = new T.Mesh(new T.CylinderGeometry(b[2], b[2], 0.45, 28), Z3.std(id === "A" ? 0xe2574c : 0x3a3f52, { roughness: 0.35 }));
      m.castShadow = true; g.add(m);
      if (id !== "A") {
        var tri = new T.Shape(), d = id === "L" ? -1 : 1;
        tri.moveTo(d * 0.3, 0); tri.lineTo(-d * 0.18, -0.26); tri.lineTo(-d * 0.18, 0.26); tri.closePath();
        var tm = new T.Mesh(new T.ShapeGeometry(tri), new T.MeshBasicMaterial({ color: 0xf4f1e8 }));
        tm.rotation.x = -Math.PI / 2; tm.position.y = 0.23; g.add(tm);
      } else {
        var ac = Z3.canvasTex(64, 64, function (c, w, hh) { c.fillStyle = "#f4f1e8"; c.font = "bold 44px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("A", w / 2, hh / 2 + 2); });
        var am = new T.Mesh(new T.PlaneGeometry(0.8, 0.8), new T.MeshBasicMaterial({ map: ac, transparent: true }));
        am.rotation.x = -Math.PI / 2; am.position.y = 0.231; g.add(am);
      }
      g.position.set(b[0], top + 0.2, b[1]);
      self.scene.add(g);
      self.btn[id] = g;
    });

    this.cat = this.makeCat();
    this.paw = this.makePaw();

    this.camera.position.set(0, 21, 9.5);
    this.camera.lookAt(0, 0, 0.6);
    this.v = new T.Vector3();
  }

  var FUR = 0xe89a4a, FUR2 = 0xc8743a, WHITE = 0xfff4e6;
  GameScene.prototype.makeCat = function () {
    var g = new T.Group(), fur = Z3.std(FUR, { roughness: 0.9 }), white = Z3.std(WHITE, { roughness: 0.9 });
    var ball = new T.SphereGeometry(1, 24, 16);
    function m(geo, mat, x, y, z, sx, sy, sz, parent) {
      var o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; (parent || g).add(o); return o;
    }
    var c = { g: g };
    c.body = m(ball, fur, 0, 1.3, 0, 2.3, 1.5, 3.6);
    /* 背中のしま */
    var stripe = Z3.std(FUR2, { roughness: 0.9 });
    for (var i = 0; i < 4; i++) m(ball, stripe, 0, 2.55 - Math.abs(i - 1.5) * 0.05, -2 + i * 1.3, 1.6, 0.25, 0.32);
    c.head = new T.Group(); c.head.position.set(0, 2.0, 3.6); g.add(c.head);
    m(ball, fur, 0, 0, 0, 1.75, 1.5, 1.55, c.head);
    m(ball, white, 0, -0.45, 1.05, 0.9, 0.6, 0.6, c.head);
    var ear = new T.ConeGeometry(0.6, 1.1, 12);
    [-1, 1].forEach(function (s) { var e = m(ear, fur, s * 0.95, 1.25, -0.1, 1, 1, 0.6, c.head); e.rotation.z = -s * 0.35; });
    var black = new T.MeshBasicMaterial({ color: 0x1a1a1a });
    c.eyes = [-1, 1].map(function (s) { return m(ball, black, s * 0.62, 0.25, 1.3, 0.22, 0.3, 0.15, c.head); });
    m(ball, Z3.std(0xf08a9a), 0, -0.15, 1.6, 0.18, 0.13, 0.12, c.head);
    c.legs = [[-1.3, 2.4], [1.3, 2.4], [-1.3, -2.2], [1.3, -2.2]].map(function (p) { return m(ball, white, p[0], 0.45, p[1], 0.6, 0.45, 0.75); });
    c.tail = [];
    for (i = 0; i < 16; i++) c.tail.push(m(ball, i > 12 ? stripe : fur, 0, 0.6, -3.4 - i * 0.42, 0.46 - i * 0.008, 0.46 - i * 0.008, 0.46 - i * 0.008));
    g.visible = false;
    this.scene.add(g);
    return c;
  };
  GameScene.prototype.makePaw = function () {
    var g = new T.Group(), fur = Z3.std(FUR, { roughness: 0.9 }), white = Z3.std(WHITE, { roughness: 0.9 });
    var arm = new T.Mesh(new T.CapsuleGeometry(0.75, 9, 6, 14), fur);
    arm.rotation.z = Math.PI / 2; arm.position.set(5.2, 0, 0); arm.castShadow = true; g.add(arm);
    var hand = new T.Mesh(new T.SphereGeometry(1, 20, 14), white); hand.scale.set(1.1, 0.7, 1.0); hand.castShadow = true; g.add(hand);
    var pink = Z3.std(0xf08a9a);
    [[-0.55, -0.45], [-0.75, 0], [-0.55, 0.45]].forEach(function (p) {
      var b = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), pink); b.scale.y = 0.4; b.position.set(p[0], 0.55, p[1]); g.add(b);
    });
    g.visible = false;
    this.scene.add(g);
    return { g: g };
  };

  GameScene.prototype.reset = function () { this.cat.g.visible = false; this.paw.g.visible = false; };

  /* s: { t, pressed: {L,R,A}, cat: {kind, x, z, rot, lie, flinch, tailT} または null, paw: {x, z, out} または null } */
  GameScene.prototype.sync = function (s) {
    var self = this;
    this.tex.needsUpdate = true;
    Object.keys(this.btn).forEach(function (id) { self.btn[id].position.y = self.top + (s.pressed[id] ? 0.04 : 0.2); });
    var c = this.cat, k = s.cat;
    c.g.visible = !!k;
    if (k) {
      c.g.position.set(k.x, k.y, k.z);
      c.g.rotation.y = k.rot;
      var lie = k.lie || 0, fl = k.flinch || 0;
      c.body.scale.set(2.3 + lie * 0.4, 1.5 - lie * 0.45, 3.6);
      c.body.position.y = 1.3 - lie * 0.5;
      c.head.position.y = 2.0 - lie * 0.9 + fl * 0.4;
      c.head.rotation.z = Math.sin(s.t * 1.3) * 0.12 * (1 - lie) + fl * 0.3;
      c.legs.forEach(function (l, i) {
        var walk = k.walking ? Math.sin(s.t * 10 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0;
        l.position.z = [2.4, 2.4, -2.2, -2.2][i] + walk + lie * (i < 2 ? 0.6 : -0.3);
        l.position.x = [-1.3, 1.3, -1.3, 1.3][i] * (1 + lie * 0.35);
      });
      c.eyes.forEach(function (e) { e.scale.y = lie > 0.8 ? 0.06 : 0.3; });
      c.tail.forEach(function (b, i) {
        var ang = Math.sin(s.t * (k.swish ? 1.8 : 1.2) - i * 0.18) * (k.swish ? 1.0 : 0.35) * (i / 15);
        b.position.x = Math.sin(ang * 1.4) * i * 0.42;
        b.position.z = -3.4 - Math.cos(ang) * i * 0.42;
        b.position.y = k.swish ? self.top + 0.45 - k.y + i * 0.02 : 0.6 - lie * 0.2;
      });
    }
    var p = s.paw;
    this.paw.g.visible = !!p;
    if (p) { this.paw.g.position.set(p.x, this.top + 0.75, p.z); this.paw.g.rotation.y = p.rot || 0; }
  };

  /* 画面の形に合わせて、本体がちょうど収まる距離にカメラを置く */
  GameScene.prototype.fit = function (W, H) {
    if (this.fitW === W && this.fitH === H) return;
    this.fitW = W; this.fitH = H;
    var cam = this.camera, v = cam.fov * Math.PI / 360, hz = Math.atan(Math.tan(v) * W / H);
    var d = Math.max((BW / 2 + 0.7) / Math.tan(hz), (BL / 2 + 1.6) / Math.tan(v));
    var dir = new T.Vector3(0, 0.93, 0.37).normalize();
    cam.aspect = W / H; cam.updateProjectionMatrix();
    cam.position.set(0, 0, 0.3).addScaledVector(dir, d);
    cam.lookAt(0, 0, 0.3);
    cam.updateMatrixWorld();
  };
  /* 立体の点(x, y, z)が、ゲームの画面（横W×縦H）のどこに写るか */
  GameScene.prototype.screen = function (x, y, z, W, H) {
    this.fit(W, H);
    this.v.set(x, y, z).project(this.camera);
    return { x: (this.v.x + 1) / 2 * W, y: (1 - this.v.y) / 2 * H };
  };
  /* ボタンの写っている場所と大きさ */
  GameScene.prototype.buttonAt = function (id, W, H) {
    var b = BTN[id], c = this.screen(b[0], this.top, b[1], W, H), e = this.screen(b[0] + b[2], this.top, b[1], W, H);
    return { x: c.x, y: c.y, r: Math.abs(e.x - c.x) };
  };
  GameScene.prototype.draw = function (ctx, W, H) {
    this.fit(W, H);
    return this.stage.draw(ctx, W, H);
  };

  GameScene.SCREEN = { w: SW, l: SL, z: SZ };
  GameScene.TOP = BH + 0.5;
  GameScene.BODY = { w: BW, l: BL };
  GameScene.BTN = BTN;
  global.GameScene = GameScene;
})(window);
