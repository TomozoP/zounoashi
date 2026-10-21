/* 最速泳法ファインダーのプールの立体の見た目（three.js）。games/three-base.js の Z3 を土台にする。
   動き（手足の物理）はゲーム側の2Dのまま。ここは見た目と、画面の点 ⇔ ゲームの点の変換だけ。
   単位：ゲームの 100px が立体の 1。ゲームの x → 立体の x、ゲームの y（下向き）→ 立体の -y。
   水面（ゲームの SY）が立体の y=0。人は z=0 の面で泳ぐ。
   真横から遠近なしで見る2.5D（立体の絵を平らに並べた画面）。画面は泳ぐ人を追って横に動く。
   手足はプレイヤーが描いた線なので、区切りごとの筒をつないで作る。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var U = 100;

  function NumaScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.1 }, camera: { fov: 30, near: 1, far: 80 } });
    /* 真横から遠近なしで見る。少しだけ見下ろして水面のつやを見せる */
    st.camera = new T.OrthographicCamera(-2.7, 2.7, 4.8, -4.8, 0.1, 80);
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0xdfeef5);
    this.built = false;

    var sc = this.scene;
    sc.add(new T.HemisphereLight(0xf6fbff, 0x7aa8c0, 1.9));
    var key = this.key = new T.DirectionalLight(0xfff8ee, 1.9);
    key.castShadow = true;
    key.shadow.mapSize.set(Z3.mobile ? 1024 : 2048, Z3.mobile ? 1024 : 2048);
    var sc2 = key.shadow.camera; sc2.left = -4; sc2.right = 4; sc2.top = 4; sc2.bottom = -4; sc2.near = 0.5; sc2.far = 30;
    key.shadow.bias = -0.0008;
    sc.add(key); sc.add(key.target);
    var rim = new T.DirectionalLight(0xd8f0ff, 1.0); rim.position.set(4, 3, -5); sc.add(rim);

    this.buildPerson();

    /* 泡・しぶき（使い回す） */
    this.bubbleMat = Z3.std(0xffffff, { roughness: 0.1, transparent: true, opacity: 0.7 });
    this.splatMat = Z3.std(0xffffff, { roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x9fd8f0, emissiveIntensity: 0.4 });
    this.ballGeo = new T.SphereGeometry(1, 10, 8);
    this.pool = [];
  }

  /* プール一式。最初の1回だけ作る（x はゲームの座標から直す。画面の高さが変わっても x の並びは同じ） */
  NumaScene.prototype.buildPool = function (g) {
    var sc = this.scene;
    var x0 = (g.WALL0 - this.cx) / U, x1 = (g.WALL1 - this.cx) / U, len = x1 - x0, mid = (x0 + x1) / 2;
    var m5 = g.M * 5 / U;

    /* 奥の壁：明るい壁に大きな窓 */
    var wallTex = Z3.canvasTex(512, 256, function (c, w, h) {
      c.fillStyle = "#eef3f6"; c.fillRect(0, 0, w, h);
      var gr = c.createLinearGradient(0, 30, 0, 170);
      gr.addColorStop(0, "#8fd0f4"); gr.addColorStop(1, "#d4f0fb");
      c.fillStyle = gr;
      for (var i = 0; i < 4; i++) c.fillRect(20 + i * 124, 30, 104, 140);
      c.fillStyle = "#c9d6de"; c.fillRect(0, 200, w, 56);
    });
    wallTex.wrapS = T.RepeatWrapping; wallTex.repeat.set((len + 20) / 6, 1);
    var wall = new T.Mesh(new T.PlaneGeometry(len + 20, 6), new T.MeshBasicMaterial({ map: wallTex }));
    wall.position.set(mid, 2.6, -8); sc.add(wall);

    /* タイルの貼り物 */
    function tileTex(a, b, n) {
      var t = Z3.canvasTex(128, 128, function (c, w, h) {
        c.fillStyle = a; c.fillRect(0, 0, w, h);
        c.strokeStyle = b; c.lineWidth = 3;
        for (var i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * w / n, 0); c.lineTo(i * w / n, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / n); c.lineTo(w, i * h / n); c.stroke(); }
      });
      t.wrapS = t.wrapT = T.RepeatWrapping; return t;
    }
    /* 奥のプールサイド */
    var deckTex = tileTex("#f2f4f2", "#d8dcd8", 4); deckTex.repeat.set((len + 20) / 2, 2.5);
    var deck = new T.Mesh(new T.BoxGeometry(len + 20, 0.4, 5), Z3.std(0xffffff, { roughness: 0.5, map: deckTex }));
    deck.position.set(mid, 0.1, -5.7); deck.receiveShadow = true; sc.add(deck);

    /* 水槽の中：底と奥の面は水色のタイル、紺の線 */
    var inTex = tileTex("#7fd3f0", "#5fb8de", 4); inTex.repeat.set(len, 3);
    var inMat = Z3.std(0xffffff, { roughness: 0.4, map: inTex });
    var back = new T.Mesh(new T.PlaneGeometry(len, 3), inMat);
    back.position.set(mid, -1.5, -3.2); sc.add(back);
    var floorTex = inTex.clone(); floorTex.repeat.set(len, 4.2); floorTex.needsUpdate = true;
    var floor = new T.Mesh(new T.PlaneGeometry(len, 4.2), Z3.std(0xffffff, { roughness: 0.4, map: floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(mid, -3, -1.1); sc.add(floor);
    var navy = Z3.std(0x1d3a6a, { roughness: 0.5 });
    var line = new T.Mesh(new T.PlaneGeometry(len - 4, 0.25), navy);
    line.position.set(mid, -2.2, -3.19); sc.add(line);
    [x0 + 2, x1 - 2].forEach(function (x) {
      var tb = new T.Mesh(new T.PlaneGeometry(0.25, 0.9), navy);
      tb.position.set(x, -2.2, -3.18); sc.add(tb);
    });
    /* 5mごとの目印（奥の面） */
    var white = Z3.std(0xffffff, { roughness: 0.5 });
    for (var k = 1; k < 5; k++) {
      var mk = new T.Mesh(new T.PlaneGeometry(0.08, 0.5), white);
      mk.position.set(x0 + k * m5, -0.45, -3.18); sc.add(mk);
    }

    /* 両端の壁（プールサイドの台）。ゴール側はタッチ板つき */
    var side = Z3.std(0xf2f4f2, { roughness: 0.5 });
    [[x0 - 3, x0], [x1, x1 + 3]].forEach(function (r) {
      var b = new T.Mesh(new T.BoxGeometry(r[1] - r[0], 3.4, 9), side);
      b.position.set((r[0] + r[1]) / 2, -1.5, -1.5); b.receiveShadow = true; sc.add(b);
    });
    var pad = new T.Mesh(new T.BoxGeometry(0.06, 0.9, 2.4), Z3.std(0xffd23a, { roughness: 0.4 }));
    pad.position.set(x1 - 0.03, -0.2, -1); sc.add(pad);
    /* 水槽の下の土台（画面の下まで） */
    var base = new T.Mesh(new T.BoxGeometry(len + 20, 10, 9), Z3.std(0xc8d4dc, { roughness: 0.7 }));
    base.position.set(mid, -3 - 5, -1.5); sc.add(base);

    /* 水：透ける水色の箱。水の中の体は青く透けて見える */
    var water = new T.Mesh(new T.BoxGeometry(len, 3, 4.2), new T.MeshStandardMaterial({ color: 0x2aa6e0, roughness: 0.08, transparent: true, opacity: 0.42, depthWrite: false }));
    water.position.set(mid, -1.5, -1.1); water.renderOrder = 2; sc.add(water);

    /* コースロープ（奥）：壁から5mは赤白、あとは青白の浮き */
    var n = Math.floor(len / 0.22);
    var rope = new T.InstancedMesh(new T.CylinderGeometry(0.09, 0.09, 0.18, 12), Z3.std(0xffffff, { roughness: 0.4 }), n);
    var mtx = new T.Matrix4(), q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2), col = new T.Color(), one = new T.Vector3(1, 1, 1);
    for (var i = 0; i < n; i++) {
      var x = x0 + 0.11 + i * 0.22, near = Math.min(x - x0, x1 - x) < m5;
      mtx.compose(new T.Vector3(x, 0.02, -2.3), q, one);
      rope.setMatrixAt(i, mtx);
      rope.setColorAt(i, col.set(near ? (i % 2 ? 0xe03a3a : 0xffffff) : (i % 3 === 0 ? 0xffffff : 0x2f6fe0)));
    }
    sc.add(rope);

    /* 両端から5mに張った紐と三角の旗 */
    var flagCols = [0xe03a3a, 0xffffff, 0x2f6fe0, 0xffd23a].map(function (c) { return Z3.std(c, { roughness: 0.6 }); });
    var cordM = Z3.std(0x555555), poleM = Z3.std(0xb0b8c0, { roughness: 0.4 });
    [x0 + m5, x1 - m5].forEach(function (x) {
      var cord = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 5, 6), cordM);
      cord.rotation.x = Math.PI / 2; cord.position.set(x, 1.9, -1.5); sc.add(cord);
      for (var j = 0; j < 9; j++) {
        var f = new T.Mesh(new T.ConeGeometry(0.12, 0.3, 3), flagCols[j % 4]);
        f.rotation.x = Math.PI; f.position.set(x, 1.75, -3.6 + j * 0.5); sc.add(f);
      }
      var pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 2.2, 8), poleM);
      pole.position.set(x, 0.9, -4.0); sc.add(pole);
    });
    this.built = true;
  };

  /* 人の部品：丸い頭に水泳帽とゴーグル、大きな目、太い胴と手足 */
  NumaScene.prototype.buildPerson = function () {
    var sc = this.scene;
    var skin = Z3.std(0xffc69a, { roughness: 0.45 });
    var skinB = Z3.std(0xe8ad82, { roughness: 0.5 });
    var trunks = Z3.std(0xd8322e, { roughness: 0.45 });
    var capM = Z3.std(0xffffff, { roughness: 0.3 });
    var cyl = new T.CylinderGeometry(1, 1, 1, 16, 1, true), sph = new T.SphereGeometry(1, 16, 12);

    var root = this.person = new T.Group(); sc.add(root);
    /* 手足：筒と両端の玉。setLimb で両端を合わせる */
    function limb(mat, r) {
      var m = new T.Group();
      var c = new T.Mesh(cyl, mat), a = new T.Mesh(sph, mat), b = new T.Mesh(sph, mat);
      c.scale.set(r, 1, r); a.scale.setScalar(r); b.scale.setScalar(r);
      [c, a, b].forEach(function (x) { x.castShadow = true; m.add(x); });
      m.userData = { c: c, b: b };
      root.add(m); return m;
    }
    function ball(mat, r) {
      var m = new T.Mesh(new T.SphereGeometry(r, 18, 12), mat); m.castShadow = true; root.add(m); return m;
    }
    /* 描いた手足：区切りごとの筒をつないで作る（本数は描いた長さで変わる）。手前は明るく、奥は少し暗く */
    this.limbMake = limb;
    this.limbMats = [skin, skinB, skin, skinB];
    this.limbR = [0.12, 0.11, 0.16, 0.15];
    this.limbZ = [0.8, -0.8, 0.3, -0.3];    /* 腕は頭（ゴーグルのゴムを含む）より外側を通す */
    this.chains = [[], [], [], []];
    this.torso = limb(skin, 0.31);
    this.trunks = new T.Mesh(new T.CylinderGeometry(0.33, 0.35, 0.36, 20), trunks);
    root.add(this.trunks);

    /* 頭（帽子と顔をまとめて回す） */
    var head = this.head = new T.Group(); root.add(head);
    head.rotation.order = "ZYX";            /* 顔を少し手前へ向けてから、体の傾きで回す */
    var skull = new T.Mesh(new T.SphereGeometry(0.42, 28, 18), skin); skull.castShadow = true; head.add(skull);
    /* 水泳帽：頭の後ろ上を包む */
    var cap = new T.Mesh(new T.SphereGeometry(0.44, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), capM);
    cap.rotation.z = -0.45; head.add(cap);
    /* 目：白目と黒目。顔は -x（ゴールと反対＝仰向けで上）と手前を向く */
    var whiteE = Z3.std(0xffffff, { roughness: 0.3 }), black = Z3.std(0x1a1a28, { roughness: 0.2 });
    this.eyes = [];
    for (var i = 0; i < 2; i++) {
      var e = new T.Group();
      var w = new T.Mesh(new T.SphereGeometry(0.11, 16, 12), whiteE); w.scale.set(0.6, 1.25, 0.6); e.add(w);
      var p = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), black); p.position.set(-0.05, 0, 0.02); p.scale.set(0.6, 1.2, 0.8); e.add(p);
      e.position.set(-0.34, 0.04, i ? 0.25 : 0.03);
      e.userData.w = w; e.userData.p = p;
      head.add(e); this.eyes.push(e);
    }
    /* ゴーグル：目を包む色つきのレンズと縁、頭をまわるゴム */
    var rimM = Z3.std(0x1a1a28, { roughness: 0.4 });
    var lensM = new T.MeshStandardMaterial({ color: 0x3fa9e8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55 });
    for (var g2 = 0; g2 < 2; g2++) {
      var gz = g2 ? 0.25 : 0.03;
      var lens = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), lensM);
      lens.scale.set(0.55, 1, 1); lens.position.set(-0.36, 0.04, gz); head.add(lens);
      var rim = new T.Mesh(new T.TorusGeometry(0.13, 0.025, 8, 20), rimM);
      rim.rotation.y = Math.PI / 2; rim.position.set(-0.36, 0.04, gz); head.add(rim);
    }
    var strap = new T.Mesh(new T.TorusGeometry(0.43, 0.03, 8, 32), rimM);
    strap.rotation.x = Math.PI / 2; strap.position.y = 0.04; head.add(strap);
  };

  function setLimb(m, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, dz = (b.z || 0) - (a.z || 0);
    var len = Math.max(0.001, Math.hypot(dx, dy, dz));
    m.position.set(a.x, a.y, a.z || 0);
    m.userData.c.scale.y = len; m.userData.c.position.y = len / 2;
    m.userData.b.position.y = len;
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / len, dy / len, dz / len));
  }

  /* ゲームの点 → 立体の点 */
  NumaScene.prototype.v = function (x, y, z) { return { x: (x - this.cx) / U, y: (this.SY - y) / U, z: z || 0 }; };

  /* カメラ：遠近なしで真横から。camX（ゲームの x）が画面の中央に来る */
  NumaScene.prototype.aim = function (W, H, SY, camX, camY, zoom) {
    this.W = W; this.H = H; this.SY = SY; this.cx = W / 2;
    var cam = this.camera, hw = W / U / 2 / zoom, hh = H / U / 2 / zoom;   /* zoom：描くときは寄り、泳ぐときは引く */
    var pitch = 0.1, D = 20, ty = (SY - camY) / U, tx = (camX - this.cx) / U;
    cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh;
    cam.position.set(tx, ty + Math.sin(pitch) * D, Math.cos(pitch) * D);
    cam.lookAt(tx, ty, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.key.position.set(tx - 3, 6, 8);
    this.key.target.position.set(tx, 0, 0);
  };

  /* 画面の点 → z=0 の面のゲームの点（指の位置に使う） */
  NumaScene.prototype.toGame = function (sx, sy) {
    if (!this.W) return { x: sx, y: sy };
    var nx = sx / this.W * 2 - 1, ny = -(sy / this.H) * 2 + 1;
    var o = new T.Vector3(nx, ny, -1).unproject(this.camera), f = new T.Vector3(nx, ny, 1).unproject(this.camera);
    var d = f.sub(o), t = -o.z / d.z;
    return { x: (o.x + d.x * t) * U + this.cx, y: this.SY - (o.y + d.y * t) * U };
  };
  /* ゲームの点 → 画面の点 */
  NumaScene.prototype.toScreen = function (x, y) {
    var p = this.v(x, y); var v = new T.Vector3(p.x, p.y, 0).project(this.camera);
    return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H };
  };

  /* g: ゲームの状態（点はすべてゲームの座標） */
  NumaScene.prototype.sync = function (g) {
    this.aim(g.W, g.H, g.SY, g.camX, g.camY, g.zoom);
    if (!this.built) this.buildPool(g);
    var self = this, V = function (p, z) { return self.v(p.x, p.y, z); };

    var h = V(g.hip), s = V(g.shoulder);
    setLimb(this.torso, h, s);
    var thT = Math.atan2(s.x - h.x, s.y - h.y);          /* 胴の傾き（上向きから時計回り） */
    this.trunks.position.set(h.x + (s.x - h.x) * 0.06, h.y + (s.y - h.y) * 0.06, 0);
    this.trunks.rotation.set(0, 0, -thT);
    /* 描いた手足 */
    for (var li = 0; li < 4; li++) {
      var pl = g.limbs[li], ch = this.chains[li], z = this.limbZ[li];
      while (ch.length < pl.length - 1) ch.push(this.limbMake(this.limbMats[li], this.limbR[li]));
      for (var ci = 0; ci < ch.length; ci++) {
        ch[ci].visible = ci < pl.length - 1;
        if (!ch[ci].visible) continue;
        var a1 = V(pl[ci]), b1 = V(pl[ci + 1]);
        setLimb(ch[ci], { x: a1.x, y: a1.y, z: z }, { x: b1.x, y: b1.y, z: z });
      }
    }

    /* 頭：首から頭への向きに合わせて回す。うつ伏せなので顔は下（と少し手前）を向く */
    var hp = V(g.head), thH = Math.atan2(hp.x - s.x, hp.y - s.y);
    this.head.position.set(hp.x, hp.y, 0.02);
    this.head.rotation.set(0, Math.PI - 0.35, -thH);
    this.head.scale.setScalar(g.K * 0.95);

    /* 表情 */
    var blink = (g.T % 3.2) < 0.12;
    this.eyes.forEach(function (e) {
      var w = e.userData.w, p = e.userData.p;
      if (g.face === "scared") { w.scale.set(0.7, 1.45, 0.7); p.scale.set(0.35, 0.6, 0.5); }
      else if (g.face === "calm" || blink) { w.scale.set(0.6, 0.2, 0.6); p.scale.set(0.01, 0.01, 0.01); }
      else { w.scale.set(0.6, 1.25, 0.6); p.scale.set(0.6, 1.2, 0.8); }
    });

    /* 泡と水しぶき（毎コマ作り直さず使い回す） */
    var n = 0, pool = this.pool, scn = this.scene;
    function get(mat) {
      var m = pool[n];
      if (!m) { m = new T.Mesh(self.ballGeo, mat); m.renderOrder = 4; pool.push(m); scn.add(m); }
      m.material = mat; m.visible = true; n++; return m;
    }
    g.bubbles.forEach(function (b) {
      var k = b.t / b.life, m = get(self.bubbleMat), p = self.v(b.x, g.SY + 20 - k * 20, 0);
      m.position.set(p.x, p.y, 0.4); m.scale.setScalar(b.r / U * 1.5);
    });
    g.splats.forEach(function (sp) {
      var m = get(self.splatMat), p = self.v(sp.x, sp.y, 0);
      m.position.set(p.x, p.y, 0.5); m.scale.setScalar(sp.r / U * 1.3);
    });
    for (var i = n; i < pool.length; i++) pool[i].visible = false;
  };

  NumaScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.NumaScene = NumaScene;
})(window);
