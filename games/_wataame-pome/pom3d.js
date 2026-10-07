/* わたあめポメの立体の絵。遊びの計算はゲーム側のまま、ここは描くだけ。
   ゲームの座標（上から見た x, y。単位 cm）を、立体では (x, 高さ, y) に置く。
   模型はすべて基本図形から自作。three.js は random-bowling の既存配布物（MIT）を使う。
   スマホで重くならないよう、球の細かさと描く解像度をおさえている。 */
(function (global) {
  "use strict";
  var T;

  function PomScene() {
    T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(34, 540 / 960, 1, 5000);
    this.scene.add(new T.HemisphereLight(0xeef2ff, 0x4a5068, 1.4));
    var sun = new T.DirectionalLight(0xffffff, 2.0);
    sun.position.set(-0.5, 1, 0.6); this.scene.add(sun);
    var back = new T.DirectionalLight(0xc8d4ff, 0.7);
    back.position.set(0.6, 0.4, -1); this.scene.add(back);
    this.w = 0; this.h = 0;
    this.buildMachine();
    this.buildBall();
    this.buildFace();
  }

  function std(color, extra) {
    var o = { color: color, roughness: 0.8 };
    for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }

  /* 綿あめ機：鍋・胴・真ん中の回る頭 */
  PomScene.prototype.buildMachine = function () {
    var G = this.machine = new T.Group();
    var pts = [], i;
    for (i = 0; i <= 12; i++) {
      var t = i / 12;
      pts.push(new T.Vector2(8 + 24 * Math.sin(t * Math.PI / 2), -14 + 14 * (1 - Math.cos(t * Math.PI / 2))));
    }
    var bowl = new T.Mesh(new T.LatheGeometry(pts, 48), std(0x8a93a8, { metalness: 0.6, roughness: 0.35, side: T.DoubleSide }));
    G.add(bowl);
    var floor = new T.Mesh(new T.CircleGeometry(8, 32), std(0x5a6278, { metalness: 0.5, roughness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -14; G.add(floor);
    var rim = new T.Mesh(new T.TorusGeometry(32, 0.9, 10, 64), std(0xdde2ec, { metalness: 0.7, roughness: 0.25 }));
    rim.rotation.x = Math.PI / 2; G.add(rim);
    var body = new T.Mesh(new T.CylinderGeometry(27, 29, 70, 48, 1, true), std(0xd23a4c, { roughness: 0.6 }));
    body.position.y = -14 - 35; G.add(body);
    var band = new T.Mesh(new T.CylinderGeometry(27.3, 27.6, 5, 48, 1, true), std(0xf4f4f6, { roughness: 0.6 }));
    band.position.y = -24; G.add(band);
    var head = this.head = new T.Group();
    head.position.y = -4;
    var drum = new T.Mesh(new T.CylinderGeometry(7, 7, 5, 32), std(0xc4cad6, { metalness: 0.8, roughness: 0.3 }));
    head.add(drum);
    var holes = std(0x4a5060, { roughness: 0.6 });
    for (i = 0; i < 12; i++) {
      var hole = new T.Mesh(new T.SphereGeometry(0.6, 8, 6), holes);
      var a = i / 12 * Math.PI * 2;
      hole.position.set(Math.cos(a) * 7, 0, Math.sin(a) * 7); head.add(hole);
    }
    var sugar = this.sugar = new T.Mesh(new T.CylinderGeometry(5, 5, 0.6, 32), std(0xffffff, { roughness: 1 }));
    sugar.position.y = 2.6; head.add(sugar);
    G.add(head);
    var glow = this.glow = new T.Mesh(new T.TorusGeometry(7.4, 0.5, 8, 48), std(0x441000, { emissive: 0xff5a1a, emissiveIntensity: 1.2 }));
    glow.rotation.x = Math.PI / 2; glow.position.y = -1.6; G.add(glow);
    this.scene.add(G);
  };

  /* 綿の玉：ポメの毛と綿あめをひと続きにした白い玉。形はゲームの「向きごとの半径」で毎コマ変える */
  PomScene.prototype.buildBall = function () {
    var geo = new T.SphereGeometry(1, 56, 36);
    var pos = geo.attributes.position, n = pos.count, i;
    this.base = new Float32Array(n * 3);
    this.fuzz = new Float32Array(n);
    var col = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      this.base[i * 3] = x; this.base[i * 3 + 1] = y; this.base[i * 3 + 2] = z;
      /* もこもこ：方向だけで決まる凹凸（いくつかの波を重ねる） */
      var v = Math.sin(x * 9.1 + y * 3.7) * Math.sin(y * 8.3 - z * 5.1) * 0.6 + Math.sin(z * 10.7 + x * 4.3) * 0.4 + Math.sin(x * 23.1 - z * 19.7 + y * 7.3) * Math.sin(y * 21.3 + z * 11.9) * 0.6;
      this.fuzz[i] = v;
      var c = 0.93 + v * 0.03;
      col[i * 3] = c; col[i * 3 + 1] = c; col[i * 3 + 2] = Math.min(1, c + 0.02);
    }
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    this.ballGeo = geo;
    this.ball = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true }));
    this.scene.add(this.ball);
    this.shapeKey = "";
  };

  /* ポメの顔（目・鼻・舌・耳）。玉の表面のカメラ側に貼る */
  PomScene.prototype.buildFace = function () {
    var F = this.face = new T.Group();
    var black = std(0x15100e, { roughness: 0.3 });
    var white = std(0xffffff, { roughness: 1 });
    var pink = std(0xe8848a, { roughness: 0.7 });
    this.eyes = []; this.dizzy = [];
    var ring = new T.TorusGeometry(1.3, 0.35, 6, 18);
    [-1, 1].forEach(function (s) {
      var eye = new T.Mesh(new T.SphereGeometry(1.6, 16, 12), black);
      eye.position.set(s * 4.4, 1.6, 0.6); F.add(eye); this.eyes.push(eye);
      var hl = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), white);
      hl.position.set(0.5, 0.6, 1.4); eye.add(hl);
      var dz = new T.Mesh(ring, black);
      dz.position.set(s * 4.4, 1.6, 0.9); dz.visible = false; F.add(dz); this.dizzy.push(dz);
      var ear = new T.Mesh(new T.ConeGeometry(3.6, 8, 12), white);
      ear.position.set(s * 6.8, 9.5, -2); ear.rotation.z = -s * 0.35; F.add(ear);
      var inner = new T.Mesh(new T.ConeGeometry(2.1, 5.4, 10), std(0xf2b8b4, { roughness: 0.8 }));
      inner.position.set(0, -0.6, 1.4); ear.add(inner);
    }, this);
    var nose = new T.Mesh(new T.SphereGeometry(1.3, 12, 10), black);
    nose.scale.set(1.2, 0.85, 1); nose.position.set(0, -1.6, 1.2); F.add(nose);
    var tongue = new T.Mesh(new T.SphereGeometry(1, 12, 10), pink);
    tongue.scale.set(1.1, 1.4, 0.6); tongue.position.set(0, -4.4, 0.6); F.add(tongue);
    this.scene.add(F);
  };

  /* 毎コマ：g = { px, py, f, PN, R0, camR, sugar, spin, bounce, dizzy } */
  PomScene.prototype.update = function (g) {
    var cam = this.camera, D = this.camDist(g.camR);
    var el = 64 * Math.PI / 180;
    cam.position.set(g.camX, Math.sin(el) * D, g.camY + Math.cos(el) * D);
    cam.lookAt(g.camX, -4, g.camY);
    cam.updateMatrixWorld();

    this.head.rotation.y += g.spin;
    var left = Math.max(0.001, g.sugar);
    this.sugar.scale.set(Math.sqrt(left), 1, Math.sqrt(left));
    this.sugar.visible = g.sugar > 0.01;

    /* 綿の玉の形。横向きはゲームの半径そのまま、上下は平均の半径に寄せる */
    var f = g.f, PN = g.PN, PTH = Math.PI * 2 / PN, mean = 0, i;
    for (i = 0; i < PN; i++) mean += f[i];
    mean /= PN;
    var key = 0; for (i = 0; i < PN; i++) key += f[i] * (i % 7 + 1); key = key.toFixed(2);
    if (key !== this.shapeKey) {
      this.shapeKey = key;
      var pos = this.ballGeo.attributes.position, b = this.base, n = pos.count, fz = 0.025 + 0.6 / mean;
      for (i = 0; i < n; i++) {
        var x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
        var h = Math.sqrt(x * x + z * z), a = Math.atan2(z, x);
        var u = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / PTH, k = Math.floor(u), t = u - k;
        var fr = f[k % PN] * (1 - t) + f[(k + 1) % PN] * t;
        var r = (mean + (fr - mean) * h) * (1 + this.fuzz[i] * fz);
        pos.setXYZ(i, x * r, y * r, z * r);
      }
      pos.needsUpdate = true;
      this.ballGeo.computeVertexNormals();
    }
    this.ball.position.set(g.px, 0, g.py);
    this.mean = mean;

    /* 顔は玉の中心からカメラへ向かう線と、玉の表面の交わる所 */
    var c = new T.Vector3(g.px, 0, g.py), v = cam.position.clone().sub(c).normalize();
    var hv = Math.sqrt(v.x * v.x + v.z * v.z), av = Math.atan2(v.z, v.x);
    var uu = ((av % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / PTH, kk = Math.floor(uu), tt = uu - kk;
    var frv = f[kk % PN] * (1 - tt) + f[(kk + 1) % PN] * tt;
    var rs = mean + (frv - mean) * hv;
    this.face.position.copy(c).addScaledVector(v, rs - 0.8);
    this.face.lookAt(cam.position);
    var s = g.bounce * (g.R0 / 14);
    this.face.scale.set(s, s, s);
    for (i = 0; i < 2; i++) {
      this.eyes[i].visible = !g.dizzy;
      this.dizzy[i].visible = g.dizzy;
      this.dizzy[i].rotation.z += 0.3 * (i ? 1 : -1);
    }
  };

  PomScene.prototype.camDist = function (camR) {
    var vf = this.camera.fov * Math.PI / 180;
    var hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    return Math.max(camR * 1.0 / Math.tan(hf / 2), camR * 1.1 / Math.tan(vf / 2));
  };

  /* 立体の点 (x, 高さ, y) → ゲーム画面の座標 */
  PomScene.prototype.project = function (x, h, y, W, H) {
    var v = new T.Vector3(x, h, y).project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z };
  };
  /* ゲーム画面の座標 → 高さ 0 の面の上の (x, y) */
  PomScene.prototype.unproject = function (sx, sy, W, H) {
    var v = new T.Vector3(sx / W * 2 - 1, 1 - sy / H * 2, 0.5).unproject(this.camera);
    var o = this.camera.position, d = v.sub(o);
    if (Math.abs(d.y) < 1e-6) return null;
    var t = -o.y / d.y;
    return { x: o.x + d.x * t, y: o.z + d.z * t };
  };

  PomScene.prototype.render = function (ctx, W, H) {
    /* スマホで重くならないよう、描く細かさは画面の1.5倍まで */
    var dpr = Math.min(1.5, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (!(w >= 2 && h >= 2)) return false;
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  /* カメラの縦横比だけ先に合わせる（入力の変換を描く前にも使うため） */
  PomScene.prototype.aspect = function (W, H) {
    if (this.camera.aspect !== W / H) { this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
  };

  global.PomScene = PomScene;
})(window);
