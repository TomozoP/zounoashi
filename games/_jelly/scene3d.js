/* ぷるぷる落ち物の立体（three.js）。土台は games/three-base.js の Z3。
   物理は index.html の2D断面。ここは各ブロックの外周の点の輪に厚みと丸い縁を付けて、ゼリーの塊として描く。
   座標は物理と同じ（x 0〜BW、y が上、床 y=0）。手前が +z。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var DEPTH = 0.42;              /* 厚みの半分 */
  /* 硬さごとの縁：やわらかいほど丸く（スライム）、かたいほど段が少なく角ばる（宝石のカット面） */
  var EDGES = [0.32, 0.26, 0.2, 0.14, 0.16];
  var KLS = [11, 9, 7, 5, 3];

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: !Z3.mobile, tone: "aces", exposure: 1.35 }, camera: { fov: 30, near: 0.5, far: 80 }, dpr: 1.5 });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    sc.background = new T.Color("#4a4252");

    /* 映り込み用の部屋（やわらかい照明の箱）。ゼリーのつやはこの映り込みで出す */
    var env = new T.Scene();
    var room = new T.Mesh(new T.SphereGeometry(30, 32, 16), new T.MeshBasicMaterial({ side: T.BackSide, map: Z3.canvasTex(256, 128, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, "#8a7f90"); gr.addColorStop(1, "#3a3340");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }) }));
    env.add(room);
    function softbox(x, y, z, w, h, c) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    softbox(-8, 10, 12, 10, 6, "#ffffff");
    softbox(10, 6, 8, 4, 10, "#fff4e6");
    softbox(0, 14, -10, 14, 4, "#e6f0ff");
    var pm = new T.PMREMGenerator(st.renderer);
    sc.environment = pm.fromScene(env, 0.02).texture;

    var key = new T.DirectionalLight("#fff6ee", 1.6);
    key.position.set(-4, 14, 10);
    if (!Z3.mobile) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      var c = key.shadow.camera; c.left = -6; c.right = 6; c.top = 9; c.bottom = -3; c.near = 1; c.far = 40;
      key.shadow.radius = 4; key.shadow.bias = -0.002;
    }
    key.target.position.set(3, 4, 0);
    sc.add(key); sc.add(key.target);
    sc.add(new T.HemisphereLight("#ffffff", "#c9b9ad", 0.5));

    /* 台と壁（乳白のトレー） */
    var BW = 5;
    var tray = Z3.std("#e9e1da", { roughness: 0.3 });
    var floor = new T.Mesh(new T.BoxGeometry(BW + 0.6, 0.4, 2.4), tray);
    floor.position.set(BW / 2, -0.2, 0); floor.receiveShadow = true; sc.add(floor);
    var back = new T.Mesh(new T.BoxGeometry(BW + 0.6, 14, 0.2), Z3.std("#5d5366", { roughness: 0.9 }));
    back.position.set(BW / 2, 6.8, -1.1); back.receiveShadow = true; sc.add(back);
    /* 左右の透明な壁 */
    var glass = new T.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, transmission: 0, transparent: true, opacity: 0.18, clearcoat: 1 });
    [-0.15, BW + 0.15].forEach(function (x) {
      var w = new T.Mesh(new T.BoxGeometry(0.3, 11.5, 2.2), glass);
      w.position.set(x, 5.75, 0); sc.add(w);
    });
    /* あふれの線 */
    this.line = new T.Mesh(new T.BoxGeometry(BW, 0.04, 0.04), new T.MeshBasicMaterial({ color: "#ff6a6a", transparent: true, opacity: 0.5 }));
    this.line.position.set(BW / 2, 9, 0.9); sc.add(this.line);
    /* 落とす位置の目安 */
    this.guide = new T.Mesh(new T.BoxGeometry(0.03, 10, 0.03), new T.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45 }));
    sc.add(this.guide);

    this.mats = [];
    this.meshes = new Map();
    this.holdMesh = null;
    this.t = 0;
  }

  /* 硬さごとの材質。やわらかいほど透けて、かたいほど詰まったグミ */
  GameScene.prototype.mat = function (lv, LV) {
    if (!this.mats[lv]) {
      var col = new T.Color(LV[lv].color);
      var u = lv / 4;                                 /* 0=スライム 1=宝石 */
      this.mats[lv] = new T.MeshPhysicalMaterial({
        color: col, roughness: 0.14 * (1 - u), metalness: 0,
        transmission: 0.3 + u * 0.45, thickness: 0.6 + u * 1.2, ior: 1.3 + u * 0.45,
        attenuationColor: col, attenuationDistance: 0.15 + u * 0.2,
        clearcoat: 1, clearcoatRoughness: 0.04 * (1 - u),
        sheen: 0.5 * (1 - u), sheenColor: new T.Color("#ffffff"), sheenRoughness: 0.3,
        iridescence: u > 0.7 ? 0.35 : 0, iridescenceIOR: 1.6,
        specularIntensity: 1, envMapIntensity: 1.0 + u * 0.6,
        flatShading: lv >= 3
      });
    }
    return this.mats[lv];
  };

  /* 外周 n 点の輪から、厚みと丸い縁のある塊の形を作る（点の数は毎回同じ、位置だけ書き換える） */
  GameScene.prototype.blob = function (n, lv) {
    var g = new T.BufferGeometry(), KL = KLS[lv];
    var vcount = n * KL + 2;
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(vcount * 3), 3));
    var idx = [];
    for (var k = 0; k < KL - 1; k++) for (var i = 0; i < n; i++) {
      var a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, d = (k + 1) * n + (i + 1) % n;
      idx.push(a, b, d, a, d, c);
    }
    var front = n * KL, backC = n * KL + 1;
    for (i = 0; i < n; i++) {
      idx.push(front, (KL - 1) * n + i, (KL - 1) * n + (i + 1) % n);   /* 手前のふた */
      idx.push(backC, (i + 1) % n, i);                                  /* 奥のふた */
    }
    g.setIndex(idx);
    g.userData.n = n; g.userData.lv = lv;
    return g;
  };
  GameScene.prototype.shape = function (g, pts, cx, cy, swell) {
    var n = g.userData.n, pos = g.attributes.position.array, KL = KLS[g.userData.lv], EDGE = EDGES[g.userData.lv];
    for (var k = 0; k < KL; k++) {
      var a = -Math.PI / 2 + Math.PI * k / (KL - 1);           /* 奥 → 手前 */
      var z = Math.sin(a) * DEPTH * swell, inset = EDGE * (1 - Math.cos(a));
      for (var i = 0; i < n; i++) {
        var p = pts[i], q0 = pts[(i + n - 1) % n], q1 = pts[(i + 1) % n];
        var nx = q1.y - q0.y, ny = -(q1.x - q0.x), l = Math.hypot(nx, ny) || 1;
        var o = (k * n + i) * 3;
        pos[o] = p.x - nx / l * inset; pos[o + 1] = p.y - ny / l * inset; pos[o + 2] = z;
      }
    }
    var f = n * KL * 3;
    pos[f] = cx; pos[f + 1] = cy; pos[f + 2] = DEPTH * swell * 1.08;
    pos[f + 3] = cx; pos[f + 4] = cy; pos[f + 5] = -DEPTH * swell * 1.08;
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };

  GameScene.prototype.reset = function () {
    var self = this;
    this.meshes.forEach(function (m) { self.scene.remove(m); m.geometry.dispose(); });
    this.meshes.clear();
  };

  GameScene.prototype.sync = function (s) {
    var self = this, used = new Set();
    s.bodies.forEach(function (b) {
      var m = self.meshes.get(b);
      if (!m) {
        m = new T.Mesh(self.blob(b.pts.length, b.lv), self.mat(b.lv, s.LV));
        m.castShadow = true; m.receiveShadow = true;
        self.scene.add(m); self.meshes.set(b, m);
      }
      used.add(b);
      var cx = 0, cy = 0;
      b.pts.forEach(function (p) { cx += p.x; cy += p.y; });
      cx /= b.pts.length; cy /= b.pts.length;
      /* はじけるときはふくらんで縮む */
      var sw = 1, k = 1;
      if (b.pop) { var u = b.pop / 0.45; k = u < 0.4 ? 1 + u * 0.5 : Math.max(0.01, 1.2 * (1 - (u - 0.4) / 0.6)); }
      var pts = k === 1 ? b.pts : b.pts.map(function (p) { return { x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }; });
      self.shape(m.geometry, pts, cx, cy, sw * k);
    });
    this.meshes.forEach(function (m, b) { if (!used.has(b)) { self.scene.remove(m); m.geometry.dispose(); self.meshes.delete(b); } });

    /* 持っているブロック */
    if (s.hold) {
      if (this.holdMesh && this.holdMesh.geometry.userData.lv !== s.hold.lv) { this.scene.remove(this.holdMesh); this.holdMesh.geometry.dispose(); this.holdMesh = null; }
      if (!this.holdMesh) { this.holdMesh = new T.Mesh(this.blob(s.RESTS[s.hold.lv].length, s.hold.lv), this.mat(s.hold.lv, s.LV)); this.holdMesh.castShadow = true; this.scene.add(this.holdMesh); }
      var hm = this.holdMesh, wob = Math.sin(s.t * 5) * 0.03 * (1 - s.hold.lv / 4);
      hm.visible = true;
      this.shape(hm.geometry, s.RESTS[s.hold.lv].map(function (r) { return { x: s.hold.x + r.x * (1 + wob), y: s.hold.y + r.y * (1 - wob) }; }), s.hold.x, s.hold.y, 1);
      this.guide.visible = true;
      this.guide.position.set(s.hold.x, s.hold.y - 5.6, 0);
    } else {
      if (this.holdMesh) this.holdMesh.visible = false;
      this.guide.visible = false;
    }
    this.line.material.opacity = 0.35 + s.danger * 0.5;

    /* カメラ：正面やや上から箱全体 */
    this.camera.position.set(s.BW / 2, 6.6, 21);
    this.camera.lookAt(s.BW / 2, 5.3, 0);
  };

  /* 画面の x を、高さ y の手前の面の x へ */
  GameScene.prototype.worldX = function (sx, W, H, y) {
    var v = new T.Vector3((sx / W) * 2 - 1, 0, 0.5).unproject(this.camera);
    var o = this.camera.position, d = v.sub(o);
    var t = (0 - o.z) / d.z;
    return o.x + d.x * t;
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
