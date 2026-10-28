/* 立体の場面（three.js）。games/three-base.js の Z3 を土台にする。
   ゲーム側（index.html）の座標は px で、地面が y=0、上がマイナス。ここでは 100px = 1 にして、上をプラスにする。
   見た目だけを受け持ち、当たり・体力などはゲーム側に置く。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3, U = 100;

  var COL = {
    blue: 0x2d63e0, white: 0xf2f4f8, red: 0xe23a32, yellow: 0xffc928, dark: 0x2a3140, gray: 0x8f99a8
  };

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: !Z3.mobile, tone: "aces", exposure: 1.1 }, camera: { fov: 30, near: 0.5, far: 120 } });
    this.scene = st.scene;
    this.camera = st.camera;
    var sc = this.scene;
    sc.background = Z3.canvasTex(4, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#5f9ee6"); gr.addColorStop(0.65, "#b8dcf5"); gr.addColorStop(1, "#f3e6cf");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    sc.fog = new T.Fog(0xcfe2f0, 18, 60);
    var L = Z3.lights(sc, { shadows: !Z3.mobile, shadowSize: 12, scale: 1.1 });
    L.key.position.set(-6, 12, 10);
    this.key = L.key;

    /* 地面（カメラの後ろまでは伸ばさない） */
    var ground = new T.Mesh(new T.PlaneGeometry(80, 40), Z3.std(0x8d8a80, { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -3); ground.receiveShadow = true;
    sc.add(ground);
    var road = new T.Mesh(new T.PlaneGeometry(60, 3.2), Z3.std(0x5d6068, { roughness: 1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.005, 0); road.receiveShadow = true;
    sc.add(road);

    /* 遠くのビル（彩度を落として、主役と分ける） */
    var winTex = Z3.canvasTex(64, 128, function (g, w, h) {
      g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#c9d3dc";
      for (var y = 8; y < h - 6; y += 14) for (var x = 6; x < w - 6; x += 14) g.fillRect(x, y, 8, 8);
    });
    var r = Z3.rng(11), shades = [0xb9c2cc, 0xa9b4c0, 0xc8c3ba, 0x9eaab8, 0xd2cdc4];
    for (var row = 0; row < 3; row++) {
      for (var i = -14; i <= 14; i++) {
        var bw = 1.2 + r() * 1.4, bh = 1.5 + r() * (row === 2 ? 7 : 4.5), bd = 1.2 + r();
        var m = new T.MeshStandardMaterial({ color: shades[Math.floor(r() * shades.length)], map: winTex, roughness: 0.9 });
        var b = new T.Mesh(new T.BoxGeometry(bw, bh, bd), m);
        b.position.set(i * 2.2 + r() * 0.8, bh / 2, -3.5 - row * 4 - r() * 1.5);
        sc.add(b);
      }
    }

    this.robot = {};
    this.camPos = new T.Vector3();
  }

  /* ---------- 県のパーツ ----------
     形はゲーム側の window.GattaiShapes（px、中心は凸包の重心）。押し出して板にし、県名を前に貼る */
  function makePref(i) {
    var sh = global.GattaiShapes[i], g = new T.Group(), d = 0.45;
    var shape = new T.Shape();
    sh.pts.forEach(function (q, n) { if (n) shape.lineTo(q[0] / U, -q[1] / U); else shape.moveTo(q[0] / U, -q[1] / U); });
    shape.closePath();
    var geo = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1, curveSegments: 1 });
    geo.translate(0, 0, -d / 2);
    var col = new T.Color("hsl(" + Math.round((i * 137.5) % 360) + ",72%,58%)");
    var mesh = new T.Mesh(geo, Z3.std(col, { roughness: 0.45, metalness: 0.15 }));
    mesh.castShadow = true;
    var edges = new T.LineSegments(new T.EdgesGeometry(geo, 35), new T.LineBasicMaterial({ color: 0x16202e }));
    mesh.add(edges);
    g.add(mesh);
    /* 県名 */
    var name = sh.name, size = Math.max(0.22, Math.min(0.6, sh.r / U * 0.55));
    var tex = Z3.canvasTex(256, 128, function (c, w, h) {
      c.font = "900 " + (name.length >= 3 ? 70 : 92) + "px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineJoin = "round"; c.lineWidth = 16; c.strokeStyle = "#16202e"; c.strokeText(name, w / 2, h / 2 + 4);
      c.fillStyle = "#fff"; c.fillText(name, w / 2, h / 2 + 4);
    });
    var label = new T.Mesh(new T.PlaneGeometry(size * 2, size), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    label.position.z = d / 2 + 0.06;
    g.add(label);
    g.userData = { mesh: mesh, label: label, edges: edges, col: col, sil: null };
    return g;
  }

  GameScene.prototype.reset = function () {
    var sc = this.scene, self = this;
    Object.keys(this.robot).forEach(function (id) { sc.remove(self.robot[id]); });
    this.robot = {};
  };

  GameScene.prototype.sync = function (s) {
    var sc = this.scene, self = this, seen = {};
    s.pieces.forEach(function (p, n) {
      var g = self.robot[p.id];
      if (g && g.userData.pref !== p.i) { sc.remove(g); g = null; }
      if (!g) { g = self.robot[p.id] = makePref(p.i); g.userData.pref = p.i; sc.add(g); }
      seen[p.id] = true;
      /* 重なったときにちらつかないよう、並び順に少しずつ手前へ */
      g.position.set(p.x / U, -p.y / U, (p.id.charAt(0) === "e" ? -0.6 : 0) + n * 0.02);
      g.rotation.z = -p.a;
      var m = g.userData.mesh.material, u = g.userData;
      m.emissive.setHex(p.sel ? 0x333322 : 0x000000);
      /* できあがったら1色のシルエット（県の境目と県名を消す） */
      if (u.sil !== (p.sil || null)) {
        u.sil = p.sil || null;
        m.color.copy(u.sil ? new T.Color(u.sil) : u.col);
        u.edges.visible = u.label.visible = !u.sil;
      }
      g.userData.label.rotation.z = p.a;          /* 県名はいつも読める向き */
    });
    Object.keys(this.robot).forEach(function (id) { if (!seen[id]) { sc.remove(self.robot[id]); delete self.robot[id]; } });

    /* カメラ: cam.x, cam.y を画面の真ん中に、横幅 cam.w px が見えるように */
    var cam = this.camera, fov = cam.fov * Math.PI / 180;
    var aspect = cam.aspect || 0.5625;
    var dist = (s.cam.w / U) / 2 / (Math.tan(fov / 2) * aspect);
    cam.position.set(s.cam.x / U, -s.cam.y / U + 0.6, dist);
    cam.lookAt(s.cam.x / U, -s.cam.y / U, 0);
    this.key.target.position.set(s.cam.x / U, 0, 0);
    this.key.position.set(s.cam.x / U - 6, 12, 10);
    this.key.target.updateMatrixWorld();
  };

  /* ゲームの座標（px）を画面の座標へ */
  GameScene.prototype.project = function (x, y, W, H) {
    var v = new T.Vector3(x / U, -y / U, 0);
    this.camera.updateMatrixWorld();
    v.project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
