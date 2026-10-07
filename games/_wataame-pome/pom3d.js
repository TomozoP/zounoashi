/* わたあめポメの立体の絵と、綿の形。
   綿あめ機の回る頭の上にポメが乗って、ゆっくり回っている。
   綿の玉は「方向ごとの半径」で形を持ち、スプレーで伸ばし、ハサミで刈る。単位は cm。
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
    this.w = 0; this.h = 0; this.turn = 0; this.view = 40;
    this.ray = new T.Raycaster();
    this.buildMachine();
    this.buildBall();
    this.buildFace();
    this.reset();
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
    G.add(new T.Mesh(new T.LatheGeometry(pts, 48), std(0x8a93a8, { metalness: 0.6, roughness: 0.35, side: T.DoubleSide })));
    var rim = new T.Mesh(new T.TorusGeometry(32, 0.9, 10, 64), std(0xdde2ec, { metalness: 0.7, roughness: 0.25 }));
    rim.rotation.x = Math.PI / 2; G.add(rim);
    var body = new T.Mesh(new T.CylinderGeometry(27, 29, 70, 48, 1, true), std(0xd23a4c, { roughness: 0.6 }));
    body.position.y = -49; G.add(body);
    var band = new T.Mesh(new T.CylinderGeometry(27.3, 27.6, 5, 48, 1, true), std(0xf4f4f6, { roughness: 0.6 }));
    band.position.y = -24; G.add(band);
    var head = this.head = new T.Group();
    var drum = new T.Mesh(new T.CylinderGeometry(7, 7, 16, 32), std(0xc4cad6, { metalness: 0.8, roughness: 0.3 }));
    drum.position.y = 0; head.add(drum);
    var holes = std(0x4a5060, { roughness: 0.6 });
    for (i = 0; i < 12; i++) {
      var hole = new T.Mesh(new T.SphereGeometry(0.6, 8, 6), holes);
      var a = i / 12 * Math.PI * 2;
      hole.position.set(Math.cos(a) * 7, 4, Math.sin(a) * 7); head.add(hole);
    }
    G.add(head);
    this.scene.add(G);
  };

  /* 綿の玉：ポメの毛と綿あめをひと続きにした白い玉 */
  PomScene.prototype.buildBall = function () {
    var geo = new T.SphereGeometry(1, 64, 44);
    var pos = geo.attributes.position, n = pos.count, i;
    this.n = n;
    this.dir = new Float32Array(n * 3);
    this.fuzz = new Float32Array(n);
    this.rad = new Float32Array(n);
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
    this.faceDir = new T.Vector3(0, 0.12, 1).normalize();
    this.ears = [];
    [-1, 1].forEach(function (s) {
      var ear = new T.Group();
      var cone = new T.Mesh(new T.ConeGeometry(3.4, 7.5, 12), white);
      cone.position.y = 3; ear.add(cone);
      var inner = new T.Mesh(new T.ConeGeometry(2, 5, 10), std(0xf2b8b4, { roughness: 0.8 }));
      inner.position.set(0, 2.6, 1.3); ear.add(inner);
      ear.userData.dir = new T.Vector3(s * 0.42, 0.85, 0.32).normalize();
      this.pom.add(ear); this.ears.push(ear);
    }, this);
  };

  PomScene.prototype.reset = function () {
    for (var i = 0; i < this.n; i++) this.rad[i] = START;
    this.dirty = true; this.turn = 0;
  };

  /* 方向 d（玉の向きの中）に一番近い頂点の半径 */
  PomScene.prototype.radAt = function (d) {
    var best = -2, bi = 0, D = this.dir;
    for (var i = 0; i < this.n; i++) {
      var c = D[i * 3] * d.x + D[i * 3 + 1] * d.y + D[i * 3 + 2] * d.z;
      if (c > best) { best = c; bi = i; }
    }
    return this.rad[bi];
  };

  /* 画面の点から道具を使う。tool: "spray" | "cut"。戻り値は綿の増減（cm³ のめやす）と当たった所 */
  PomScene.prototype.tool = function (tool, sx, sy, W, H, dt) {
    var cam = this.camera;
    this.ray.setFromCamera(new T.Vector2(sx / W * 2 - 1, 1 - sy / H * 2), cam);
    this.pom.updateMatrixWorld();
    var hits = this.ray.intersectObject(this.ball, false);
    var inv = new T.Matrix4().copy(this.pom.matrixWorld).invert();
    var o = this.ray.ray.origin.clone().applyMatrix4(inv);
    var d = this.ray.ray.direction.clone().transformDirection(inv);
    var target, reach, onBall = hits.length > 0;
    if (onBall) {
      target = hits[0].point.clone().applyMatrix4(inv);
      reach = Infinity;
    } else {
      /* 玉から外れた所：視線の上で玉の中心に一番近い点まで、綿を伸ばす */
      var t = -o.dot(d);
      target = o.clone().addScaledVector(d, t);
      reach = target.length();
    }
    var dirT = target.clone().normalize();
    var sig = tool === "cut" ? 0.2 : 0.22, s2 = 2 * sig * sig, D = this.dir, R = this.rad, total = 0;
    if (tool === "cut" && !onBall) return { amount: 0, hit: null };
    for (var i = 0; i < this.n; i++) {
      var c = D[i * 3] * dirT.x + D[i * 3 + 1] * dirT.y + D[i * 3 + 2] * dirT.z;
      if (c < 0.6) continue;
      var a = Math.acos(Math.min(1, c)), w = Math.exp(-a * a / s2);
      if (w < 0.02) continue;
      var r0 = R[i], r1;
      if (tool === "cut") r1 = Math.max(BODY, r0 - 60 * w * dt);
      else r1 = Math.min(Math.max(r0, reach * Math.sqrt(w)), r0 + (onBall ? 14 : 26) * w * dt);   /* 先ほど細く伸びる */
      R[i] = r1;
      total += (r1 * r1 * r1 - r0 * r0 * r0);
    }
    if (total !== 0) this.dirty = true;
    var hitW = target.clone().applyMatrix4(this.pom.matrixWorld);
    return { amount: total * 0.05, hit: hitW };
  };

  /* 立体の点 → ゲーム画面の座標 */
  PomScene.prototype.project = function (v, W, H) {
    var p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H };
  };

  /* 大きさ：いちばん長い差し渡し（上下・左右・前後のうち最大）cm */
  PomScene.prototype.size = function () {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], D = this.dir, R = this.rad;
    for (var i = 0; i < this.n; i++) for (var k = 0; k < 3; k++) {
      var v = D[i * 3 + k] * R[i];
      if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
    }
    return Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  };
  PomScene.prototype.maxR = function () { var m = 0; for (var i = 0; i < this.n; i++) if (this.rad[i] > m) m = this.rad[i]; return m; };

  /* 毎コマ：g = { dt, spin, bounce, dizzy, sugar } */
  PomScene.prototype.update = function (g) {
    this.turn += g.spin * g.dt;
    this.pom.rotation.y = this.turn;
    this.head.rotation.y = this.turn;

    if (this.dirty) {
      this.dirty = false;
      var pos = this.ballGeo.attributes.position, D = this.dir, R = this.rad;
      for (var i = 0; i < this.n; i++) {
        var r = R[i] * (1 + this.fuzz[i] * (0.02 + 0.5 / R[i]));
        pos.setXYZ(i, D[i * 3] * r, D[i * 3 + 1] * r, D[i * 3 + 2] * r);
      }
      pos.needsUpdate = true;
      this.ballGeo.computeVertexNormals();
      this.ballGeo.computeBoundingSphere();
      this.mr = this.maxR();
    }

    /* 顔と耳は、その方向の綿の表面に置く */
    var fr = this.radAt(this.faceDir);
    this.face.position.copy(this.faceDir).multiplyScalar(fr - 0.6);
    this.face.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), this.faceDir);
    var s = g.bounce;
    this.face.scale.set(s, s, s);
    this.eyes.forEach(function (e) { e.scale.set(1, g.blink ? 0.15 : 1, 1); });
    this.ears.forEach(function (ear) {
      var d = ear.userData.dir, r = this.radAt(d);
      ear.position.copy(d).multiplyScalar(r - 1.5);
      ear.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d);
    }, this);

    /* カメラは前の斜め上から。綿の大きさに合わせて引く */
    var want = Math.max(40, (this.mr || START) + 14);
    this.view += (want - this.view) * Math.min(1, g.dt * 2);
    var cam = this.camera, el = 22 * Math.PI / 180;
    var vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    var Dst = Math.max(this.view / Math.tan(hf / 2), this.view * 1.25 / Math.tan(vf / 2));
    var lookY = CY - this.view * 0.12;
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
