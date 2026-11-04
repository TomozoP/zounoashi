/* 入れ替え行列の3Dの絵（three.js）。土台は games/three-base.js の Z3。
   人の作りは倒してもいいですかゲームと同じ（玉の頭、棒の手足、玉の胴）。
   単位はメートル。行列の先頭（店）が -z、後ろ（カメラ側）が +z。
   ゲームの進行はゲーム側（index.html）。ここは見た目と、画面の座標への写しだけ。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var GAP = 0.8;                 /* 1人ぶんの間隔 */
  var SEE = 2;

  function Scene3D() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.35 }, camera: { fov: 40, near: 0.1, far: 80 }, finish: { vignette: 0.12, grain: 0 } });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    sc.background = new T.Color("#cfe3f2");
    sc.fog = new T.Fog("#cfe3f2", 18, 45);
    var L = this.L = Z3.lights(sc, { shadows: true, shadowSize: 6, scale: 1.2 });
    L.key.position.set(3, 8, 4);
    sc.add(L.key.target);
    this.geo = { ball: new T.SphereGeometry(1, 18, 12), tube: new T.CylinderGeometry(1, 1, 1, 12), box: new T.BoxGeometry(1, 1, 1) };
    this.mats = {};

    /* 歩道・車道・向かいの建物 */
    var len = 60;
    this.part(sc, "box", "#b9b3a8", 0, -0.05, len / 2 - 10, 4.4, 0.1, len).castShadow = false;
    this.part(sc, "box", "#55585e", 4.2, -0.08, len / 2 - 10, 4, 0.1, len).castShadow = false;
    this.part(sc, "box", "#9a958b", 2.25, 0.02, len / 2 - 10, 0.15, 0.14, len).castShadow = false;
    var self = this;
    var tile = Z3.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#c4beb2"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
    }, 1);
    tile.repeat.set(4, 60);
    var walk = new T.Mesh(new T.PlaneGeometry(4.4, len), new T.MeshStandardMaterial({ map: tile, roughness: 0.9 }));
    walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.001, len / 2 - 10); walk.receiveShadow = true; sc.add(walk);
    /* 左の建物の壁（行列はこの壁ぞい） */
    var r = Z3.rng(5);
    for (var z = -10; z < 50; z += 3) {
      var c = ["#d8cfc0", "#c9bfae", "#e1d9cc", "#bfb6a6"][(r() * 4) | 0];
      this.part(sc, "box", c, -2.7, 3, z, 1, 6 + r() * 3, 2.96).castShadow = false;
    }
    /* 店（先頭の左手前） */
    var shop = new T.Group(); shop.position.set(0, 0, -GAP * 1.4); sc.add(shop);
    this.part(shop, "box", "#3a2a22", -0.2, 1.6, -0.6, 4.8, 3.2, 0.4);
    this.part(shop, "box", "#1a120e", 0, 1.05, -0.38, 1.3, 2.1, 0.06);
    this.part(shop, "box", "#ffe2a0", 0, 1.05, -0.4, 1.1, 1.9, 0.02, { emissive: "#ffcc66", emissiveIntensity: 0.6 });
    for (var i = 0; i < 4; i++) this.part(shop, "box", i % 2 ? "#b8322b" : "#cc3f37", -0.48 + i * 0.32, 1.95, -0.3, 0.3, 0.6, 0.02);
    this.part(shop, "box", "#7a5a40", 0, 2.27, -0.3, 1.5, 0.06, 0.06);
    [-1.1, 1.1].forEach(function (x) {
      self.part(shop, "ball", "#e85b3a", x, 2.0, -0.2, 0.2, 0.28, 0.2, { emissive: "#ff5a2a", emissiveIntensity: 0.5 });
    });
    this.part(shop, "box", "#2a1d17", 0, 3.35, -0.35, 4.9, 0.3, 0.7);

    /* 見張りの視界（床の扇形） */
    this.coneGeo = new T.CircleGeometry(1, 24, -Math.PI * 0.18, Math.PI * 0.36);
    this.cones = [];
    /* 入れ替えられる人の足もとの輪 */
    this.ringGeo = new T.TorusGeometry(0.24, 0.035, 8, 32);
    this.ringMat = new T.MeshBasicMaterial({ color: "#3fe6ff" });
    this.rings = [];
    this.people = new Map();
    this.t = 0;
  }

  Scene3D.prototype.mat = function (color, opt) {
    var key = color + JSON.stringify(opt || {});
    if (!this.mats[key]) {
      var o = { color: color, roughness: 0.85 };
      for (var k in opt) o[k] = opt[k];
      this.mats[key] = new T.MeshStandardMaterial(o);
    }
    return this.mats[key];
  };
  Scene3D.prototype.part = function (parent, kind, color, x, y, z, sx, sy, sz, opt) {
    var m = new T.Mesh(this.geo[kind], typeof color === "string" ? this.mat(color, opt) : color);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  Scene3D.prototype.seg = function (parent, color, a, b, r) {
    var m = this.part(parent, "tube", color, 0, 0, 0, r, 1, r);
    var A = new T.Vector3(a[0], a[1], a[2]), B = new T.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A);
    m.position.copy(A).addScaledVector(d, 0.5);
    m.scale.y = d.length();
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return m;
  };

  /* 立っている人。前（店のほう）が -z。o: { shirt, pants, skin, hair, h（身長の倍率）, wide, phone } */
  Scene3D.prototype.person = function (o) {
    var g = new T.Group(), b = new T.Group(), self = this;
    g.add(b);
    b.scale.set(o.wide, o.h, o.wide);
    var sk = o.skin, sh = o.shirt, pa = o.pants;
    [-0.1, 0.1].forEach(function (x) {
      self.seg(b, pa, [x, 0.08, 0], [x, 0.86, 0], 0.07);
      self.part(b, "ball", "#2b2622", x, 0.05, -0.05, 0.08, 0.05, 0.13);
    });
    this.part(b, "ball", pa, 0, 0.9, 0, 0.18, 0.12, 0.13);
    this.part(b, "ball", sh, 0, 1.2, 0, 0.21, 0.31, 0.15);
    /* 腕：スマホの人は両手を胸の前、ほかは下ろす */
    [-1, 1].forEach(function (s) {
      self.part(b, "ball", sh, s * 0.22, 1.4, 0, 0.07, 0.07, 0.07);
      if (o.phone) {
        self.seg(b, sh, [s * 0.24, 1.4, 0], [s * 0.2, 1.12, -0.04], 0.055);
        self.seg(b, sh, [s * 0.2, 1.12, -0.04], [s * 0.05, 1.18, -0.26], 0.05);
        self.part(b, "ball", sk, s * 0.05, 1.18, -0.27, 0.05, 0.05, 0.05);
      } else {
        self.seg(b, sh, [s * 0.24, 1.4, 0], [s * 0.27, 1.1, 0.02], 0.055);
        self.seg(b, sh, [s * 0.27, 1.1, 0.02], [s * 0.27, 0.86, 0], 0.05);
        self.part(b, "ball", sk, s * 0.27, 0.82, 0, 0.05, 0.05, 0.05);
      }
    });
    if (o.phone) {
      this.part(b, "box", "#1d1f24", 0, 1.24, -0.29, 0.08, 0.15, 0.012);
    }
    this.seg(b, sk, [0, 1.45, 0], [0, 1.58, 0], 0.05);
    var head = new T.Group(); head.position.set(0, 1.68, 0); b.add(head);
    this.part(head, "ball", sk, 0, 0, 0, 0.13, 0.14, 0.13);
    var hair = new T.Mesh(new T.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), this.mat(o.hair));
    hair.castShadow = true; head.add(hair);
    var back = new T.Mesh(new T.SphereGeometry(0.14, 24, 12, 0, Math.PI, 0, Math.PI * 0.82), this.mat(o.hair));
    back.rotation.y = 0; back.castShadow = true; head.add(back);      /* 後ろ髪（+z 側） */
    [-0.045, 0.045].forEach(function (x) { self.part(head, "ball", "#16202e", x, 0.01, -0.122, 0.018, 0.024, 0.012); });
    if (o.phone) head.rotation.x = 0.35;
    g.userData = { body: b, head: head, rot: 0, phone: o.phone };
    this.scene.add(g);
    return g;
  };

  /* s: { t, q（並び：{ id, y, look, me, look 0/1/2 }）, cam（カメラの位置の番号）, targets: [位置], seeCount } */
  Scene3D.prototype.sync = function (s) {
    var dt = Math.max(0, Math.min(0.1, s.t - this.t)); this.t = s.t;
    var self = this, used = new Set(), ci = 0;
    s.q.forEach(function (o, i) {
      var g = self.people.get(o);
      if (!g) { g = self.person(o.look3d); self.people.set(o, g); }
      used.add(o);
      g.position.set(o.x3d, 0, o.y * GAP);
      var u = g.userData;
      var want = o.look === 2 ? Math.PI : o.look === 1 ? 1.2 : 0;
      u.rot += (want - u.rot) * Math.min(1, dt * (o.look === 2 ? 12 : 6));
      g.rotation.y = u.rot;
      u.head.rotation.x = u.phone && o.look === 0 ? 0.35 : 0;
      /* 怒り（見つけた人）は少し跳ねる */
      u.body.position.y = o.q < 0 ? Math.abs(Math.sin(s.t * 18)) * 0.06 : 0;
      if (!o.me && o.look > 0) {
        var c = self.cones[ci];
        if (!c) {
          c = new T.Mesh(self.coneGeo, new T.MeshBasicMaterial({ color: "#ff3030", transparent: true, opacity: 0.35, depthWrite: false }));
          c.rotation.x = -Math.PI / 2; self.scene.add(c); self.cones.push(c);
        }
        ci++;
        c.visible = true;
        c.material.color.set(o.look === 2 ? "#ff2a2a" : "#ffd23a");
        c.material.opacity = o.look === 2 ? 0.42 : 0.25;
        var r = GAP * (SEE + 0.45);
        c.scale.set(r, r, 1);
        c.position.set(o.x3d, 0.012 + ci * 0.001, o.y * GAP);
        c.rotation.z = -Math.PI / 2;    /* 扇を +z（後ろ）へ向ける */
      }
    });
    for (; ci < this.cones.length; ci++) this.cones[ci].visible = false;
    this.people.forEach(function (g, o) { if (!used.has(o)) { self.scene.remove(g); self.people.delete(o); } });
    /* 足もとの輪 */
    s.targets.forEach(function (i, k) {
      var m = self.rings[k];
      if (!m) { m = new T.Mesh(self.ringGeo, self.ringMat); m.rotation.x = -Math.PI / 2; self.scene.add(m); self.rings.push(m); }
      m.visible = true;
      var o = s.q[i];
      m.position.set(o.x3d, 1.62 * o.look3d.h + 0.05, i * GAP);   /* 頭を囲む輪 */
    });
    for (var k = s.targets.length; k < this.rings.length; k++) this.rings[k].visible = false;

    /* カメラ：自分の斜め後ろ上から、行列の先を見る */
    var cz = s.cam * GAP;
    this.camera.position.set(0.35, 5.6, cz + 3.6);
    this.camera.lookAt(0, 0.2, cz - 3.0);
    this.L.key.position.set(3, 8, cz + 2);
    this.L.key.target.position.set(0, 0, cz - 2);
  };

  /* 立体の点を画面の座標へ。i は並びの番号、hy は高さ */
  Scene3D.prototype.screen = function (x, i, hy, W, H) {
    var v = new T.Vector3(x, hy, i * GAP).project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, s: v.z };
  };

  Scene3D.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.Scene3D = Scene3D;
})(window);
