/* スキー炒飯の立体の見た目。games/three-base.js の Z3 を土台にする。
   ゲーム側（index.html）が持つ人の位置・米粒を sync で写すだけ。当たりや点数はゲーム側。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var BR = 0.34, RIM = 0.2;
  function surf(r) { return BR - Math.sqrt(Math.max(0, BR * BR - r * r)); }

  function GameScene(o) {
    T = global.THREE;
    this.o = o;
    var st = this.stage = new Z3.Stage({ renderer: { tone: "aces", exposure: 1.05 }, camera: { fov: 70, near: 0.05, far: 160 } });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    sc.background = new T.Color(0x9cc6ec);
    sc.fog = new T.Fog(0xe2edf7, 28, 125);
    sc.add(new T.HemisphereLight(0xffffff, 0x9fb4cc, 1.5));
    var sun = new T.DirectionalLight(0xfff4e2, 2.2); sun.position.set(-4, 9, 3); sc.add(sun);

    /* 雪の斜面。人の近くだけを毎回高さを付け直して使い回す（1マス2m、絵も2mで繰り返す） */
    var snowTex = Z3.canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = "#f3f7fb"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      for (var i = 0; i < 260; i++) {
        g.fillStyle = r() < 0.5 ? "rgba(170,190,215,.35)" : "rgba(255,255,255,.9)";
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
    }, 1);
    snowTex.wrapS = snowTex.wrapT = T.RepeatWrapping;
    this.GW = 72; this.GL = 150;
    var gg = new T.PlaneGeometry(this.GW, this.GL, 36, 75);
    gg.rotateX(-Math.PI / 2);
    var uv = gg.attributes.uv;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 36, uv.getY(i) * 75);
    this.base = gg.attributes.position.array.slice();
    this.groundMesh = new T.Mesh(gg, new T.MeshLambertMaterial({ map: snowTex }));
    sc.add(this.groundMesh);
    this.gKey = "";

    /* 木 */
    var trees = o.trees, n = trees.length;
    var leafG = new T.ConeGeometry(1.4, 3.6, 7); leafG.translate(0, 3.2, 0);
    var leaf2 = new T.ConeGeometry(1.0, 2.6, 7); leaf2.translate(0, 4.8, 0);
    var trunkG = new T.CylinderGeometry(0.22, 0.28, 1.6, 6); trunkG.translate(0, 0.8, 0);
    var leaves = new T.InstancedMesh(leafG, new T.MeshLambertMaterial({ color: 0x2f6b46 }), n);
    var leaves2 = new T.InstancedMesh(leaf2, new T.MeshLambertMaterial({ color: 0x3d7f55 }), n);
    var trunks = new T.InstancedMesh(trunkG, new T.MeshLambertMaterial({ color: 0x6b4a32 }), n);
    var m = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3();
    for (i = 0; i < n; i++) {
      var t = trees[i];
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), i * 1.7);
      v.set(t.x, o.ground(t.x, t.z) - 0.1, t.z); s.set(t.s, t.s, t.s);
      m.compose(v, q, s);
      leaves.setMatrixAt(i, m); leaves2.setMatrixAt(i, m); trunks.setMatrixAt(i, m);
    }
    sc.add(leaves); sc.add(leaves2); sc.add(trunks);

    /* ゴールの門 */
    var gz = -o.len, gy0 = o.ground(0, gz);
    var flagTex = Z3.canvasTex(256, 32, function (g, w, h) {
      for (var x = 0; x < w / 16; x++) for (var y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#fff"; g.fillRect(x * 16, y * 16, 16, 16); }
    });
    flagTex.wrapS = T.RepeatWrapping; flagTex.repeat.set(4, 1);
    var banner = new T.Mesh(new T.PlaneGeometry(o.edge * 2, 1.4), new T.MeshBasicMaterial({ map: flagTex, side: T.DoubleSide }));
    banner.position.set(0, gy0 + 5, gz); sc.add(banner);
    var poleM = new T.MeshLambertMaterial({ color: 0xd8382e });
    [-1, 1].forEach(function (k) {
      var p = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 6, 8), poleM);
      p.position.set(k * o.edge, gy0 + 3, gz); sc.add(p);
    });

    /* 人：体の向きだけ回る台。カメラ・鍋・板はここに付ける */
    var rig = this.rig = new T.Group(); sc.add(rig);
    this.head = new T.Group(); rig.add(this.head);
    this.head.add(this.camera);

    /* 板 */
    var skiM = new T.MeshLambertMaterial({ color: 0xe0312b });
    this.skis = new T.Group(); rig.add(this.skis);
    [-0.14, 0.14].forEach(function (x) {
      var b = new T.Mesh(new T.BoxGeometry(0.1, 0.025, 1.6), skiM); b.position.set(x, -1.57, -0.45); this.skis.add(b);
      var tip = new T.Mesh(new T.BoxGeometry(0.1, 0.025, 0.25), skiM); tip.position.set(x, -1.53, -1.33); tip.rotation.x = 0.45; this.skis.add(tip);
    }, this);

    /* 中華鍋 */
    var wok = this.wok = new T.Group(); rig.add(wok);
    var pts = [];
    for (i = 0; i <= 14; i++) { var r = RIM * i / 14; pts.push(new T.Vector2(r, surf(r))); }
    pts.push(new T.Vector2(RIM + 0.008, surf(RIM) + 0.004));
    var steel = new T.MeshStandardMaterial({ color: 0x4a4e55, metalness: 0.25, roughness: 0.45, side: T.DoubleSide });
    wok.add(new T.Mesh(new T.LatheGeometry(pts, 32), steel));
    var handle = new T.Mesh(new T.CylinderGeometry(0.018, 0.022, 0.36, 8), new T.MeshLambertMaterial({ color: 0x8a5a33 }));
    handle.rotation.set(Math.PI / 2, 0, 0); handle.rotation.order = "YXZ"; handle.rotation.y = 0.55;
    handle.position.set(0.24, surf(RIM) - 0.01, 0.2); wok.add(handle);
    var glove = new T.MeshLambertMaterial({ color: 0x2b6fd6 });
    var gR = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), glove); gR.scale.set(1, 0.8, 1.3); gR.position.set(0.33, surf(RIM) - 0.02, 0.34); wok.add(gR);
    var gL = new T.Mesh(new T.SphereGeometry(0.055, 10, 8), glove); gL.scale.set(1.3, 0.8, 1); gL.position.set(-0.22, surf(RIM) - 0.01, 0.06); wok.add(gL);
    /* 鍋の下のコンロと火 */
    var stove = new T.Mesh(new T.CylinderGeometry(0.06, 0.075, 0.05, 14), new T.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.7, roughness: 0.4 }));
    stove.position.y = -0.085; wok.add(stove);
    this.flames = new T.Group(); wok.add(this.flames);
    var fm = new T.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.85 });
    var fo = new T.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.8 });
    for (i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      var f = new T.Mesh(new T.ConeGeometry(0.018, 0.07, 6), i % 2 ? fo : fm);
      f.position.set(Math.cos(a) * 0.06, -0.035, Math.sin(a) * 0.06); this.flames.add(f);
    }
    wok.position.set(0, -0.5, -0.66);

    /* 米粒 */
    var N = o.n;
    this.rice = new T.InstancedMesh(new T.BoxGeometry(0.017, 0.009, 0.009), new T.MeshLambertMaterial({ color: 0xffffff }), N);
    this.rice.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.rice.frustumCulled = false;
    wok.add(this.rice);
    this.rot = [];
    var rr = Z3.rng(11);
    for (i = 0; i < N; i++) this.rot.push(new T.Euler(rr() * 6, rr() * 6, rr() * 6));
    this.col = new T.Color();
    this.cRaw = new T.Color(0xf7f3e6); this.cGold = new T.Color(0xf0c35a); this.cBurn = new T.Color(0x3a2212);
    this.cEgg = new T.Color(0xffd23a); this.cNegi = new T.Color(0x4f9f36);
    this.m = m; this.q = q; this.v = v; this.s = s;
  }

  GameScene.prototype.reset = function () {};

  GameScene.prototype.groundAt = function (cx, cz) {
    var sx = Math.round(cx / 2) * 2, sz = Math.round(cz / 2) * 2, key = sx + "," + sz;
    if (key === this.gKey) return;
    this.gKey = key;
    var oz = sz - this.GL / 2 + 2;              /* 人の少し後ろから前へ */
    var pos = this.groundMesh.geometry.attributes.position, b = this.base, a = pos.array, g = this.o.ground;
    for (var i = 0; i < pos.count; i++) {
      var x = b[i * 3] + sx, z = b[i * 3 + 2] + oz;
      a[i * 3] = x; a[i * 3 + 1] = g(x, z); a[i * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    this.groundMesh.geometry.computeVertexNormals();
    this.groundMesh.geometry.computeBoundingSphere();
  };

  GameScene.prototype.sync = function (s) {
    var p = s.p; if (!p) return;
    this.groundAt(p.x, p.z);
    this.rig.position.set(p.x, p.y, p.z);
    this.rig.rotation.y = p.h;
    var sh = s.shake || 0, t = s.t;
    this.head.rotation.set(-0.5 + Math.sin(t * 40) * sh * 0.05, Math.sin(t * 33) * sh * 0.05, (s.steer || 0) * 0.12, "YXZ");
    /* あおる動き：さっと持ち上げて手前へ引く */
    var ft = s.flipT, k = ft < 0.22 ? Math.sin(ft / 0.22 * Math.PI) : 0;
    this.wok.position.set(0, -0.5 + k * 0.06, -0.66 + k * 0.04);
    this.wok.rotation.x = k * 0.28;
    this.skis.rotation.y = -(s.steer || 0) * 0.15;
    for (var j = 0; j < this.flames.children.length; j++) this.flames.children[j].scale.y = 0.7 + Math.random() * 0.6;

    var gs = s.grains, M = this.m, Q = this.q, V = this.v, Sc = this.s;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (g.lost && g.y < -1.4) { Sc.set(0, 0, 0); }
      else Sc.set(1, 1, 1);
      var e = this.rot[i];
      if (!g.on) { e.x += 0.25; e.z += 0.17; }
      Q.setFromEuler(e);
      V.set(g.x, g.y + 0.006, g.z);
      M.compose(V, Q, Sc);
      this.rice.setMatrixAt(i, M);
      var c = this.col;
      if (g.kind === 2) c.copy(this.cNegi);
      else {
        c.copy(g.kind === 1 ? this.cEgg : this.cRaw).lerp(this.cGold, g.cook * (g.kind === 1 ? 0.3 : 0.8));
        c.lerp(this.cBurn, Math.min(1, g.burn * 1.2));
      }
      this.rice.setColorAt(i, c);
    }
    this.rice.instanceMatrix.needsUpdate = true;
    if (this.rice.instanceColor) this.rice.instanceColor.needsUpdate = true;
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
