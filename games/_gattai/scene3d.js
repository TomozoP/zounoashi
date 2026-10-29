/* 立体の場面（three.js）。games/three-base.js の Z3 を土台にする。見た目だけを受け持つ。
   ゲーム側の座標は px の平面（x 右、y 手前）。ここでは 100px = 1、平面は x-z、上が +y。
   北海道の板の上面が y=0。物の位置・向き（cannon の体）はゲーム側から受け取る。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3, U = 100, FLAT = null;

  function GameScene(o) {
    T = global.THREE;
    FLAT = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
    this.o = o;                                  /* { hk: 北海道の輪郭(px), cx, cy: 北海道の真ん中(px), boardT, thick } */
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: 30, near: 1, far: 120 } });
    this.scene = st.scene; this.camera = st.camera;
    var sc = this.scene;
    sc.background = new T.Color(0x2a7fc0);
    var L = Z3.lights(sc, { shadows: false, scale: 0.8 });
    /* 真上からの光で、県の影が真下に落ちる（どこに落ちるかの目安） */
    var sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0, 20, 0.001); sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(Z3.mobile ? 1024 : 2048, Z3.mobile ? 1024 : 2048);
    var s = sun.shadow.camera; s.left = -5; s.right = 5; s.top = 5; s.bottom = -5; s.near = 1; s.far = 40;
    sun.shadow.bias = -0.002;
    sc.add(sun); sc.add(sun.target);

    /* 海（波の模様がゆっくり流れる） */
    this.waveTex = Z3.canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = "#2a7fc0"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,255,255,.22)"; g.lineWidth = 4; g.lineCap = "round";
      [[20, 30], [84, 62], [40, 100]].forEach(function (p) {
        g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + 8, p[1] - 6, p[0] + 16, p[1]); g.quadraticCurveTo(p[0] + 24, p[1] + 6, p[0] + 32, p[1]); g.stroke();
      });
    }, true);
    this.waveTex.repeat.set(30, 30);
    var sea = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ map: this.waveTex, roughness: 0.6 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -o.boardT - 0.15; sea.receiveShadow = true;
    sc.add(sea);

    /* 北海道の板（上が陸の色、側面は崖の色） */
    var shape = new T.Shape();
    o.hk.forEach(function (q, n) { var x = (q[0] - o.cx) / U, y = -(q[1] - o.cy) / U; if (n) shape.lineTo(x, y); else shape.moveTo(x, y); });
    shape.closePath();
    var geo = new T.ExtrudeGeometry(shape, { depth: o.boardT, bevelEnabled: false });
    geo.translate(0, 0, -o.boardT); geo.rotateX(-Math.PI / 2);
    var board = new T.Mesh(geo, [Z3.std(0x6dbf4b, { roughness: 0.9 }), Z3.std(0x8c7a58, { roughness: 1 })]);
    board.receiveShadow = true; board.castShadow = true;
    sc.add(board);
    var edge = new T.LineSegments(new T.EdgesGeometry(geo, 40), new T.LineBasicMaterial({ color: 0x4d5a3a }));
    sc.add(edge);

    this.items = {};
    this.ray = new T.Raycaster();
  }

  /* 県の板（本当の形を押し出す）と、上面の県名 */
  function makePiece(sh, thick, color) {
    var g = new T.Group(), shape = new T.Shape();
    sh.pts.forEach(function (q, n) { var x = q[0] / U, y = -q[1] / U; if (n) shape.lineTo(x, y); else shape.moveTo(x, y); });
    shape.closePath();
    var geo = new T.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
    geo.translate(0, 0, -thick / 2); geo.rotateX(-Math.PI / 2);
    var mat = Z3.std(new T.Color(color), { roughness: 0.55 });
    var mesh = new T.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    g.add(new T.LineSegments(new T.EdgesGeometry(geo, 35), new T.LineBasicMaterial({ color: 0x16202e })));
    var name = sh.name, size = Math.max(0.2, Math.min(0.55, sh.r / U * 0.5));
    var tex = Z3.canvasTex(256, 128, function (c, w, h) {
      c.font = "900 " + (name.length >= 3 ? 70 : 92) + "px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineJoin = "round"; c.lineWidth = 14; c.strokeStyle = "#16202e"; c.strokeText(name, w / 2, h / 2 + 4);
      c.fillStyle = "#fff"; c.fillText(name, w / 2, h / 2 + 4);
    });
    var label = new T.Mesh(new T.PlaneGeometry(size * 2, size), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    label.renderOrder = 10;
    label.rotation.x = -Math.PI / 2; label.position.y = thick / 2 + 0.01;
        g.userData = { mat: mat, label: label };
    return g;
  }

  GameScene.prototype.reset = function () {
    var sc = this.scene, self = this;
    Object.keys(this.items).forEach(function (id) { sc.remove(self.items[id]); });
    this.items = {};
  };

  /* s.items: [{ id, i, color, x, y, z, q:[x,y,z,w] | yaw, ghost }] （x, y, z は物理の単位） */
  GameScene.prototype.sync = function (s) {
    var sc = this.scene, self = this, seen = {};
    s.items.forEach(function (p) {
      var g = self.items[p.id];
      if (!g) { g = self.items[p.id] = makePiece(global.GattaiShapes[p.i], self.o.thick, p.color); sc.add(g); }
      seen[p.id] = true;
      g.position.set(p.x, p.y, p.z);
      if (p.q) g.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
      else { g.quaternion.identity(); g.rotation.y = -p.yaw; }
      var m = g.userData.mat;
      m.transparent = !!p.ghost; m.opacity = p.ghost ? 0.8 : 1;
      m.emissive.setHex(p.bad ? (p.ghost ? 0xcc1100 : 0x661100) : 0x000000);
      /* 県名はいつも上向き・正面向き（県が回っても読める） */
    });
    Object.keys(this.items).forEach(function (id) { if (!seen[id]) { sc.remove(self.items[id]); delete self.items[id]; } });
    this.waveTex.offset.set((s.t * 0.01) % 1, (s.t * 0.004) % 1);

    /* カメラ: 北海道をななめ上から見下ろす。北海道が画面の上のほうに入るよう、見る先を手前にずらす */
    var cam = this.camera, aspect = cam.aspect || 0.5625, fov = cam.fov * Math.PI / 180;
    var tilt = 72 * Math.PI / 180, w = s.cam.w;
    var dist = (w / 2) / (Math.tan(fov / 2) * aspect);
    var tx = s.cam.x, tz = s.cam.z;
    cam.position.set(tx + s.cam.sx, Math.sin(tilt) * dist, tz + Math.cos(tilt) * dist + s.cam.sy);
    cam.lookAt(tx, 0, tz);
    cam.updateMatrixWorld();
  };

  /* 画面の点 (sx, sy) から、高さ hy の水平面への当たり（物理の単位）。当たらなければ null */
  GameScene.prototype.ground = function (sx, sy, W, H, hy) {
    var v = new T.Vector2(sx / W * 2 - 1, -(sy / H) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    var o = this.ray.ray.origin, d = this.ray.ray.direction;
    if (Math.abs(d.y) < 1e-4) return null;
    var t = (hy - o.y) / d.y;
    if (t < 0) return null;
    return { x: o.x + d.x * t, z: o.z + d.z * t };
  };
  /* 物理の単位の点を画面へ */
  GameScene.prototype.project = function (x, y, z, W, H) {
    var v = new T.Vector3(x, y, z);
    v.project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
