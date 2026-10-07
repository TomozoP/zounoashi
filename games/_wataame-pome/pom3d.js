/* わたあめポメの立体の絵と、綿の形。
   ポメを正面から見ている。
   形はゲーム側の「正面から見た向きごとの半径」（平面の形）で、ここはそれを厚みのある綿の玉にして描くだけ。単位は cm。
   模型はすべて基本図形から自作。three.js は random-bowling の既存配布物（MIT）を使う。
   スマホで重くならないよう、球の細かさと描く解像度をおさえている。 */
(function (global) {
  "use strict";
  var T;
  var BODY = 11;          /* これより内側は刈れない（ポメの体） */
  var START = 15;         /* 最初の毛の半径 */
  var CY = 26;            /* 玉の中心の高さ（回る頭の上） */

  function PomScene() {
    T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(34, 540 / 960, 1, 5000);
    this.scene.add(new T.HemisphereLight(0xeef2ff, 0x4a5068, 1.4));
    var sun = new T.DirectionalLight(0xffffff, 2.0);
    sun.position.set(-0.5, 1, 0.8); this.scene.add(sun);
    var back = new T.DirectionalLight(0xc8d4ff, 0.7);
    back.position.set(0.6, 0.4, -1); this.scene.add(back);
    this.w = 0; this.h = 0; this.view = 44;
    this.buildBall();
    this.buildFace();
  }

  function std(color, extra) {
    var o = { color: color, roughness: 0.8 };
    for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }

  /* 綿の玉：ポメの毛と綿あめをひと続きにした白い玉 */
  PomScene.prototype.buildBall = function () {
    var geo = new T.SphereGeometry(1, 64, 44);
    var pos = geo.attributes.position, n = pos.count, i;
    this.n = n;
    this.dir = new Float32Array(n * 3);
    this.fuzz = new Float32Array(n);
    var col = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      this.dir[i * 3] = x; this.dir[i * 3 + 1] = y; this.dir[i * 3 + 2] = z;
      var v = Math.sin(x * 9.1 + y * 3.7) * Math.sin(y * 8.3 - z * 5.1) * 0.6 + Math.sin(z * 10.7 + x * 4.3) * 0.4 + Math.sin(x * 23.1 - z * 19.7 + y * 7.3) * Math.sin(y * 21.3 + z * 11.9) * 0.6;
      this.fuzz[i] = v;
      var c = 0.93 + v * 0.03;
      col[i * 3] = c; col[i * 3 + 1] = c; col[i * 3 + 2] = Math.min(1, c + 0.02);
    }
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    this.ballGeo = geo;
    this.pom = new T.Group();
    this.pom.position.y = CY;
    this.ball = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true }));
    this.pom.add(this.ball);
    this.scene.add(this.pom);
  };

  /* ポメの顔（目・鼻・舌）と耳。決まった方向の、綿の表面に貼る */
  PomScene.prototype.buildFace = function () {
    var F = this.face = new T.Group();
    var black = std(0x15100e, { roughness: 0.3 });
    var white = std(0xffffff, { roughness: 1 });
    var pink = std(0xe8848a, { roughness: 0.7 });
    var ring = new T.TorusGeometry(1.3, 0.35, 6, 18);
    this.eyes = []; this.dizzy = [];
    [-1, 1].forEach(function (s) {
      var eye = new T.Mesh(new T.SphereGeometry(1.6, 16, 12), black);
      eye.position.set(s * 4.4, 1.6, 0.6); F.add(eye); this.eyes.push(eye);
      var hl = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), white);
      hl.position.set(0.5, 0.6, 1.4); eye.add(hl);
    }, this);
    var nose = new T.Mesh(new T.SphereGeometry(1.3, 12, 10), black);
    nose.scale.set(1.2, 0.85, 1); nose.position.set(0, -1.6, 1.2); F.add(nose);
    var tongue = this.tongue = new T.Mesh(new T.SphereGeometry(1, 12, 10), pink);
    tongue.scale.set(1.1, 1.4, 0.6); tongue.position.set(0, -4.4, 0.6); F.add(tongue);
    this.pom.add(F);
    this.ears = [];
    [-1, 1].forEach(function (s) {
      var ear = new T.Group();
      var cone = new T.Mesh(new T.ConeGeometry(3.4, 7.5, 12), white);
      cone.position.y = 3; ear.add(cone);
      var inner = new T.Mesh(new T.ConeGeometry(2, 5, 10), std(0xf2b8b4, { roughness: 0.8 }));
      inner.position.set(0, 2.6, 1.3); ear.add(inner);
      ear.userData.dir = new T.Vector3(s * 0.5, 0.87, 0);
      this.pom.add(ear); this.ears.push(ear);
    }, this);
  };

  /* 立体の点 → ゲーム画面の座標 */
  PomScene.prototype.project = function (v, W, H) {
    var p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H };
  };
  /* ゲーム画面の座標 → ポメの中心を通る正面の面の上の点（ポメの中心から、右が x、上が y） */
  PomScene.prototype.unproject = function (sx, sy, W, H) {
    var v = new T.Vector3(sx / W * 2 - 1, 1 - sy / H * 2, 0.5).unproject(this.camera);
    var o = this.camera.position, d = v.sub(o);
    if (Math.abs(d.z) < 1e-6) return null;
    var t = -o.z / d.z;
    return { x: o.x + d.x * t, y: o.y + d.y * t - CY };
  };

  /* 平面の形の、向き a の半径（なめらかにつなぐ） */
  function prof(f, PN, a) {
    var u = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2 / PN), i = Math.floor(u), t = u - i;
    return f[i % PN] * (1 - t) + f[(i + 1) % PN] * t;
  }

  /* 毎コマ：g = { dt, f, PN, bounce, blink } */
  PomScene.prototype.update = function (g) {
    var f = g.f, PN = g.PN, i, mean = 0;
    for (i = 0; i < PN; i++) mean += f[i];
    mean /= PN;
    var key = 0; for (i = 0; i < PN; i++) key += f[i] * (i % 7 + 1);
    if (key !== this.key) {
      this.key = key;
      /* 正面から見た形は f のまま。奥行きは、太い所でも平均くらいの厚みにおさえる */
      var thick = Math.max(START, mean * 0.95), pos = this.ballGeo.attributes.position, D = this.dir, mr = 0;
      for (i = 0; i < this.n; i++) {
        var x = D[i * 3], y = D[i * 3 + 1], z = D[i * 3 + 2];
        var fr = prof(f, PN, Math.atan2(y, x)), k = 1 + this.fuzz[i] * (0.02 + 0.5 / fr);
        pos.setXYZ(i, x * fr * k, y * fr * k, z * Math.min(fr, thick) * k);
        if (fr > mr) mr = fr;
      }
      pos.needsUpdate = true;
      this.ballGeo.computeVertexNormals();
      this.ballGeo.computeBoundingSphere();
      this.mr = mr; this.thick = thick;
    }

    /* 顔は正面の真ん中、耳は頭の上の綿の縁 */
    this.face.position.set(0, 1.5, (this.thick || START) - 0.8);
    var s = g.bounce;
    this.face.scale.set(s, s, s);
    this.eyes.forEach(function (e) { e.scale.set(1, g.blink ? 0.15 : 1, 1); });
    this.ears.forEach(function (ear) {
      var d = ear.userData.dir, a = Math.atan2(d.y, d.x), r = prof(f, PN, a);
      ear.position.set(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2), 2);
      ear.rotation.set(0, 0, a - Math.PI / 2);
    }, this);

    /* カメラは前の斜め上から。綿の大きさに合わせて引く */
    var want = Math.max(44, (this.mr || START) + 16);
    this.view += (want - this.view) * Math.min(1, g.dt * 2);
    var cam = this.camera, el = 8 * Math.PI / 180;
    var vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    var Dst = Math.max(this.view / Math.tan(hf / 2), this.view * 1.25 / Math.tan(vf / 2));
    var lookY = CY - this.view * 0.1;
    cam.position.set(0, lookY + Math.sin(el) * Dst, Math.cos(el) * Dst);
    cam.lookAt(0, lookY, 0);
    cam.updateMatrixWorld();
  };

  PomScene.prototype.render = function (ctx, W, H) {
    /* スマホで重くならないよう、描く細かさは画面の1.5倍まで */
    var dpr = Math.min(1.5, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (!(w >= 2 && h >= 2)) return false;
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
    }
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  PomScene.prototype.aspect = function (W, H) {
    if (this.camera.aspect !== W / H) { this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
  };

  global.PomScene = PomScene;
})(window);
