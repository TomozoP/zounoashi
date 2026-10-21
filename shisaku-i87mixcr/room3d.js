/* 引っ張り引っ越しの立体の見た目（three.js）。games/three-base.js の Z3 を土台にする。
   動き（物理・当たり・時間）はゲーム側の2Dのまま。ここは見た目と、画面の点 ⇔ 床の点の変換だけ。
   家具の上の面には、2Dの絵をそのまま貼る（質感は2Dのまま）。へこんだら輪郭から作り直す。
   単位：ゲームの 40px が立体の 1。ゲームの x → 立体の x、ゲームの y → 立体の z。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var S = 40;
  var HEIGHT = { bed: 36, sofa: 44, shelf: 80, fridge: 100, tv: 46, table: 40, chair: 24, box: 44, dish: 40,
    plant: 34, lamp: 70, washer: 60, dresser: 64, guitar: 10, chabudai: 20, cushion: 8, kotatsu: 30, trash: 34 };
  var SIDE = { bed: 0x6d4f37, sofa: 0x3f6187, shelf: 0x7c552f, fridge: 0xc9d0d6, tv: 0x1a1d22, table: 0x94683f, chair: 0x6d4f33,
    box: 0xa47a45, dish: 0xa47a45, plant: 0x9e522c, lamp: 0xd8c78f, washer: 0xcfd5da, dresser: 0x86592f, guitar: 0x8a5a26,
    chabudai: 0x7a4826, cushion: 0xb5403c, kotatsu: 0xb8483a, trash: 0x6f8396 };
  var WALL_H = 46;

  function RoomScene(game) {
    T = global.THREE;
    this.game = game;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true }, camera: { fov: 30, near: 1, far: 120 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x6d737a);
    var hemi = new T.HemisphereLight(0xffffff, 0x8a8178, 1.9);
    this.scene.add(hemi);
    var key = this.key = new T.DirectionalLight(0xffffff, 1.3);
    key.castShadow = true;
    key.shadow.mapSize.set(Z3.mobile ? 1024 : 2048, Z3.mobile ? 1024 : 2048);
    key.shadow.bias = -0.0008;
    this.scene.add(key); this.scene.add(key.target);
    this.items = {};
    this.walls = [];
    this.ray = new T.Raycaster();
    this.built = null;
  }

  RoomScene.prototype.u = function (px) { return px / S; };

  /* 間取りが変わったら（もう一度・画面の高さが変わった）床と壁を作り直す */
  RoomScene.prototype.build = function (G, W, H) {
    var sc = this.scene, self = this;
    if (this.root) { sc.remove(this.root); disposeAll(this.root); }
    Object.keys(this.items).forEach(function (k) { self.dropItem(k); });
    this.root = new T.Group(); sc.add(this.root);
    this.W = W; this.H = H; this.G = G;
    /* 道（画面の外まで少し広く） */
    var street = new T.Mesh(new T.PlaneGeometry(W / S + 16, H / S + 16), new T.MeshLambertMaterial({ map: Z3.canvasTex(256, 512, function (g, w, h) {
      g.fillStyle = "#6d737a"; g.fillRect(0, 0, w, h);
    }) }));
    street.rotation.x = -Math.PI / 2; street.position.set(W / 2 / S, -0.01, H / 2 / S); street.receiveShadow = true;
    this.root.add(street);
    /* 道の白線 */
    var ly = (G.ny1 + G.oy0) / 2, lineMat = new T.MeshBasicMaterial({ color: 0xc9ccd0 });
    for (var x = -10; x < W; x += 60) {
      var dash = new T.Mesh(new T.PlaneGeometry(34 / S, 6 / S), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set((x + 17) / S, 0, ly / S);
      this.root.add(dash);
    }
    this.root.add(floor(G.nx0, G.ny0, G.nx1, G.ny1, "#f3dfb8", "rgba(170,130,80,.18)"));
    this.root.add(floor(G.ox0, G.oy0, G.ox1, G.oy1, "#d9c29a", "rgba(120,90,50,.2)"));
    /* 壁 */
    this.walls = G.walls.map(function (r) {
      var m = new T.Mesh(new T.BoxGeometry((r[2] - r[0]) / S, WALL_H / S, (r[3] - r[1]) / S), new T.MeshLambertMaterial({ color: 0x2b2724 }));
      m.position.set((r[0] + r[2]) / 2 / S, WALL_H / 2 / S, (r[1] + r[3]) / 2 / S);
      m.castShadow = true; m.receiveShadow = true;
      self.root.add(m);
      return m;
    });
    /* 影の範囲と光の向き */
    var cx = W / 2 / S, cz = H / 2 / S, sh = this.key.shadow.camera, half = Math.max(W, H) / 2 / S + 1;
    sh.left = -half; sh.right = half; sh.top = half; sh.bottom = -half; sh.near = 1; sh.far = 80;
    sh.updateProjectionMatrix();
    this.key.position.set(cx - 8, 30, cz - 6); this.key.target.position.set(cx, 0, cz);
    this.fit(W, H);
    this.built = G;
  };

  /* 間取り全体が画面に収まる距離を探す（手前から少し傾けて見下ろす） */
  RoomScene.prototype.fit = function (W, H) {
    var cam = this.camera, tilt = 22 * Math.PI / 180;
    cam.aspect = W / H; cam.updateProjectionMatrix();
    var tx = W / 2 / S, tz = H / 2 / S + 0.3;
    var pts = [[0, 0, 0], [W, 0, 0], [0, 0, H], [W, 0, H], [0, WALL_H, 0], [W, WALL_H, 0]];
    var v = new T.Vector3();
    for (var D = 10; D < 90; D += 0.25) {
      cam.position.set(tx, Math.cos(tilt) * D, tz + Math.sin(tilt) * D);
      cam.lookAt(tx, 0, tz);
      cam.updateMatrixWorld(true);
      var ok = pts.every(function (p) {
        v.set(p[0] / S, p[1] / S, p[2] / S).project(cam);
        return Math.abs(v.x) <= 1.0 && v.y <= 0.9 && v.y >= -1.0;
      });
      if (ok) break;
    }
  };

  function floor(x0, y0, x1, y1, base, line) {
    var w = x1 - x0, h = y1 - y0;
    var tex = Z3.canvasTex(Math.round(w * 2), Math.round(h * 2), function (g, cw, ch) {
      g.scale(2, 2);
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.strokeStyle = line; g.lineWidth = 1; g.beginPath();
      for (var y = 18; y < h; y += 18) { g.moveTo(0, y); g.lineTo(w, y); }
      g.stroke();
    });
    var m = new T.Mesh(new T.PlaneGeometry(w / S, h / S), new T.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2 / S, 0, (y0 + y1) / 2 / S);
    m.receiveShadow = true;
    return m;
  }

  function disposeAll(o) {
    o.traverse(function (c) {
      if (c.geometry) c.geometry.dispose();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  /* 家具1つ：輪郭を押し出した柱。上の面に2Dの絵 */
  RoomScene.prototype.makeItem = function (b) {
    var d = b.def, hpx = HEIGHT[d.k] || 30;
    var g = new T.Group();
    var top = new T.MeshLambertMaterial({ map: this.artTex(b) });
    var side = new T.MeshLambertMaterial({ color: SIDE[d.k] || 0x888888 });
    var mesh = new T.Mesh(this.itemGeo(b, hpx), [top, side]);
    mesh.rotation.x = Math.PI / 2; mesh.position.y = hpx / S;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.body = b;
    g.add(mesh);
    this.root.add(g);
    return { g: g, mesh: mesh, top: top, h: hpx, ver: b.ver || 0 };
  };
  RoomScene.prototype.itemGeo = function (b, hpx) {
    var sh = new T.Shape();
    b.shape.forEach(function (p, i) {
      var x = (p.x0 + p.nx * p.off) / S, y = (p.y0 + p.ny * p.off) / S;
      if (i) sh.lineTo(x, y); else sh.moveTo(x, y);
    });
    sh.closePath();
    return new T.ExtrudeGeometry(sh, { depth: hpx / S, bevelEnabled: false });
  };
  RoomScene.prototype.artTex = function (b) {
    var d = b.def, w = d.r ? d.r * 2 : d.w, h = d.r ? d.r * 2 : d.h;
    var k = Z3.mobile ? 3 : 4, pad = 6, cwp = w + pad * 2, chp = h + pad * 2, game = this.game;
    var tex = Z3.canvasTex(Math.ceil(cwp * k), Math.ceil(chp * k), function (g, cw, ch) {
      g.fillStyle = "#" + (SIDE[d.k] || 0x888888).toString(16).padStart(6, "0"); g.fillRect(0, 0, cw, ch);   /* 絵の外は側面の色 */
      g.setTransform(k, 0, 0, k, cw / 2, ch / 2);
      game.paintArt(g, b);
    });
    tex.repeat.set(S / cwp, -S / chp);
    tex.offset.set(0.5, 0.5);
    return tex;
  };
  RoomScene.prototype.dropItem = function (id) {
    var it = this.items[id];
    if (!it) return;
    if (this.root) this.root.remove(it.g);
    disposeAll(it.g);
    delete this.items[id];
  };

  /* ゲームの状態を写す */
  RoomScene.prototype.sync = function (o) {
    var self = this, seen = {};
    if (this.built !== o.G) this.build(o.G, o.W, o.H);
    o.items.forEach(function (b) {
      if (b.dead) return;
      var it = self.items[b.id];
      if (!it) it = self.items[b.id] = self.makeItem(b);
      seen[b.id] = 1;
      if ((b.ver || 0) !== it.ver) {             /* へこみ・傷が増えたら作り直す */
        it.mesh.geometry.dispose(); it.mesh.geometry = self.itemGeo(b, it.h);
        it.top.map.dispose(); it.top.map = self.artTex(b); it.top.needsUpdate = true;
        it.ver = b.ver || 0;
      }
      it.g.position.set(b.position.x / S, 0, b.position.y / S);
      it.g.rotation.y = -b.angle;
    });
    Object.keys(this.items).forEach(function (id) { if (!seen[id]) self.dropItem(id); });
    o.G.walls.forEach(function (r, i) {
      var m = self.walls[i];
      if (!m) return;
      m.visible = !r.dead;
      var k = Math.max(0, Math.min(1, 1 - r.hp / o.wallHp));   /* 傷むほど少し明るく */
      m.material.color.setRGB((43 + k * 60) / 255, (39 + k * 52) / 255, (36 + k * 46) / 255, T.SRGBColorSpace);
    });
  };

  /* 画面の点 → 床から高さ hpx の面の上の、ゲームの点 */
  RoomScene.prototype.toGame = function (sx, sy, hpx) {
    this.ray.setFromCamera(new T.Vector2(sx / this.W * 2 - 1, 1 - sy / this.H * 2), this.camera);
    var r = this.ray.ray, h = (hpx || 0) / S;
    if (Math.abs(r.direction.y) < 1e-6) return null;
    var t = (h - r.origin.y) / r.direction.y;
    return { x: (r.origin.x + r.direction.x * t) * S, y: (r.origin.z + r.direction.z * t) * S };
  };
  /* 画面の点にある家具。当たった所（ゲームの点）と高さも返す */
  RoomScene.prototype.pick = function (sx, sy) {
    this.ray.setFromCamera(new T.Vector2(sx / this.W * 2 - 1, 1 - sy / this.H * 2), this.camera);
    var meshes = [], self = this;
    Object.keys(this.items).forEach(function (id) { meshes.push(self.items[id].mesh); });
    var hit = this.ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    return { body: hit.object.userData.body, x: hit.point.x * S, y: hit.point.z * S, h: hit.point.y * S };
  };
  /* ゲームの点（高さ hpx）→ 画面の点 */
  RoomScene.prototype.toScreen = function (x, y, hpx) {
    var v = new T.Vector3(x / S, (hpx || 0) / S, y / S).project(this.camera);
    return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H };
  };
  RoomScene.prototype.heightOf = function (b) { return HEIGHT[b.def.k] || 30; };

  RoomScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.RoomScene = RoomScene;
})(window);
