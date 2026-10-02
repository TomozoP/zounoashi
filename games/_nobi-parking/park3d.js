/* 縦列駐車の場面を立体で描き、主画面（2Dのcanvas）へ写す。録画にもそのまま入る。
   動きの計算はゲーム側（上から見た平面）のまま。ここは見た目だけ。
   世界の x はそのまま x、世界の y（下向き）は z。高さは y。単位はメートル。
   模型はすべて基本図形から自作。three.js は random-bowling の既存配布物（MIT）を使う。 */
(function (global) {
  "use strict";

  function ParkScene() {
    var T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x9cc3e6, 1);
    this.scene = new T.Scene();
    this.scene.fog = new T.Fog(0x9cc3e6, 70, 160);
    this.camera = new T.PerspectiveCamera(38, 0.6, 0.5, 400);
    this.scene.add(new T.HemisphereLight(0xeef4ff, 0x5a5650, 1.6));
    var sun = new T.DirectionalLight(0xfff1dc, 1.8);
    sun.position.set(-20, 40, 15);
    this.scene.add(sun);
    this.world = null;
    this.player = null;
    this.mats = {};
    this.w = 0; this.h = 0;
  }

  ParkScene.prototype.mat = function (color, opts) {
    var T = global.THREE, key = color + JSON.stringify(opts || {});
    if (!this.mats[key]) {
      var o = { color: color };
      if (opts && opts.opacity != null) { o.transparent = true; o.opacity = opts.opacity; o.depthWrite = false; }
      this.mats[key] = opts && opts.basic ? new T.MeshBasicMaterial(o) : new T.MeshLambertMaterial(o);
    }
    return this.mats[key];
  };

  function box(self, parent, w, h, d, x, y, z, color, opts) {
    var T = global.THREE;
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), self.mat(color, opts));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  /* 角を丸く面取りした箱。底面の角丸を押し出し、上下の縁にも丸みを付ける */
  function rbox(self, parent, w, h, d, x, y, z, color, r) {
    var T = global.THREE;
    r = Math.min(r, w / 2 - 0.01, d / 2 - 0.01, h / 2 - 0.01);
    var hw = w / 2 - r, hd = d / 2 - r, sh = new T.Shape();
    sh.moveTo(-hw, -hd - 0.0001);
    sh.absarc(hw, -hd, 0.0001, -Math.PI / 2, 0, false);
    sh.absarc(hw, hd, 0.0001, 0, Math.PI / 2, false);
    sh.absarc(-hw, hd, 0.0001, Math.PI / 2, Math.PI, false);
    sh.absarc(-hw, -hd, 0.0001, Math.PI, Math.PI * 1.5, false);
    var geo = new T.ExtrudeGeometry(sh, { depth: Math.max(0.001, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -(h - 2 * r) / 2, 0);
    var m = new T.Mesh(geo, self.mat(color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function flat(self, parent, w, d, x, y, z, color, opts) {
    var T = global.THREE;
    var m = new T.Mesh(new T.PlaneGeometry(w, d), self.mat(color, opts));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  /* 車。前は -z。長いほど窓の柱が増える。前輪は steer で向きを変える */
  ParkScene.prototype.makeCar = function (len, color, carW, overhang) {
    var T = global.THREE, self = this;
    var g = new T.Group(), body = new T.Group();
    g.add(body);
    flat(self, g, carW + 0.35, len + 0.35, 0, 0.02, 0, 0x000000, { opacity: 0.3, basic: true });
    rbox(self, body, carW, 0.66, len, 0, 0.55, 0, color, 0.2);
    var cabin = Math.max(1.2, len - 2.3), cz = 0.25;
    rbox(self, body, carW * 0.84, 0.56, cabin, 0, 1.1, cz, 0x26313d, 0.16);
    rbox(self, body, carW * 0.78, 0.12, cabin - 0.3, 0, 1.38, cz, color, 0.05);
    var n = Math.max(1, Math.round(cabin / 1.35));
    for (var i = 1; i < n; i++) box(self, body, carW * 0.86, 0.5, 0.14, 0, 1.09, cz - cabin / 2 + cabin * i / n, color);
    box(self, body, carW * 0.86, 0.5, 0.12, 0, 1.09, cz - cabin / 2, color);
    box(self, body, carW * 0.86, 0.5, 0.12, 0, 1.09, cz + cabin / 2, color);
    [-1, 1].forEach(function (s) {
      box(self, body, 0.4, 0.14, 0.06, s * (carW / 2 - 0.3), 0.62, -len / 2 - 0.01, 0xfff3b0, { basic: true });
      box(self, body, 0.4, 0.14, 0.06, s * (carW / 2 - 0.3), 0.62, len / 2 + 0.01, 0xd8263a, { basic: true });
    });
    var a = len / 2 - overhang, geo = new T.CylinderGeometry(0.34, 0.34, 0.26, 16);
    var front = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
      var pivot = new T.Group();
      pivot.position.set(q[0] * (carW / 2 - 0.08), 0.34, q[1] * a);
      var wh = new T.Mesh(geo, self.mat(0x16181c));
      wh.rotation.z = Math.PI / 2;
      pivot.add(wh);
      body.add(pivot);
      if (q[1] < 0) front.push(pivot);
    });
    return { g: g, body: body, front: front, len: len };
  };

  function dispose(o) {
    o.traverse(function (m) { if (m.geometry) m.geometry.dispose(); });
  }

  /* 場面を組み立てる。s は { LEFT, ROAD, CURB, G, L, carW, overhang, parked:[{x,y,len,color}], color } */
  ParkScene.prototype.setup = function (s) {
    var T = global.THREE, self = this;
    if (this.world) { this.scene.remove(this.world); dispose(this.world); }
    var w = new T.Group();
    this.world = w;
    this.scene.add(w);
    this.s = s;
    var zMin = -150, zMax = 150, zl = zMax - zMin;
    /* 道と歩道 */
    flat(self, w, s.CURB - s.LEFT, zl, (s.LEFT + s.CURB) / 2, 0, 0, 0x4b4f55);
    box(self, w, 40, 0.15, zl, s.LEFT - 20, 0.075, 0, 0xbdb6a8);
    box(self, w, 40, 0.15, zl, s.CURB + 20, 0.075, 0, 0xbdb6a8);
    box(self, w, 0.25, 0.17, zl, s.LEFT - 0.125, 0.085, 0, 0xe3ddd0);
    box(self, w, 0.25, 0.17, zl, s.CURB + 0.125, 0.085, 0, 0xe3ddd0);
    /* 線 */
    flat(self, w, 0.16, zl, s.ROAD, 0.01, 0, 0xf2efe6, { basic: true });
    for (var z = zMin; z < zMax; z += 3) flat(self, w, 0.16, 1.6, (s.LEFT + s.ROAD) / 2, 0.01, z + 0.8, 0xf2efe6, { basic: true });
    flat(self, w, s.CURB - s.ROAD, 0.12, (s.ROAD + s.CURB) / 2, 0.012, -0.05, 0xf2efe6, { basic: true });
    flat(self, w, s.CURB - s.ROAD, 0.12, (s.ROAD + s.CURB) / 2, 0.012, s.G - 0.07, 0xf2efe6, { basic: true });
    this.slot = flat(self, w, s.CURB - s.ROAD, s.G, (s.ROAD + s.CURB) / 2, 0.006, s.G / 2, 0x5adc78, { opacity: 0, basic: true });
    /* 止まっている車 */
    s.parked.forEach(function (p) {
      var c = self.makeCar(p.len, p.color, s.carW, Math.min(1.0, p.len * 0.2));
      c.g.position.set(p.x, 0, p.y);
      w.add(c.g);
    });
    /* 自分の車 */
    this.player = this.makeCar(s.L, s.color, s.carW, Math.min(1.0, s.L * 0.2));
    w.add(this.player.g);
    this.fit = null;
  };

  /* 上の車と下の車がぎりぎり収まるようにカメラを置く */
  ParkScene.prototype.fitCamera = function (aspect) {
    var T = global.THREE, s = this.s, cam = this.camera;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    var cx = ((s.LEFT + s.CURB) / 2 + (s.ROAD + s.CURB) / 2) / 2, zFar = -s.parkL - 0.4, zNear = s.G + s.parkL + 0.4;
    var el = 52 * Math.PI / 180, v = new T.Vector3();
    function place(d, zt) {
      cam.position.set(cx, Math.sin(el) * d, zt + Math.cos(el) * d);
      cam.lookAt(cx, 0, zt);
      cam.updateMatrixWorld();
    }
    function ndcY(z) { v.set(cx, 0, z); v.project(cam); return v.y; }
    var lo = 5, hi = 300, zt = (zFar + zNear) / 2;
    for (var i = 0; i < 30; i++) {
      var d = (lo + hi) / 2;
      /* 上下の余りが同じになるよう、見る場所を合わせる */
      for (var j = 0; j < 12; j++) {
        place(d, zt);
        var off = (ndcY(zFar) + ndcY(zNear)) / 2;
        zt -= off * (zNear - zFar) * 0.5;
      }
      place(d, zt);
      if (ndcY(zFar) > 0.985 || ndcY(zNear) < -0.985) lo = d; else hi = d;
    }
    place(hi, zt);
  };

  /* st は { car:{x,y,th,d,len}, parked:bool } */
  ParkScene.prototype.render = function (ctx, W, Hv, st) {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(Hv * dpr);
    if (w !== this.w || h !== this.h || !this.fit) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
      this.fitCamera(W / Hv);
      this.fit = true;
    }
    var p = this.player, c = st.car;
    p.g.position.set(c.x, 0, c.y);
    p.g.rotation.y = -c.th;
    p.body.scale.z = c.len / p.len;
    p.front.forEach(function (f) { f.rotation.y = -c.d; });
    this.slot.material.opacity = st.parked ? 0.4 : 0;
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, Hv);
  };

  /* 世界の点を画面の位置へ */
  ParkScene.prototype.toScreen = function (x, y, W, Hv) {
    var v = new global.THREE.Vector3(x, 0.6, y).project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * Hv };
  };

  global.ParkScene = ParkScene;
})(window);
