/* 底なし沼の立体の見た目（three.js）。games/three-base.js の Z3 を土台にする。
   動き（沈み・傾き・泥かき）はゲーム側の2Dのまま。ここは見た目と、画面の点 ⇔ ゲームの点の変換だけ。
   単位：ゲームの 100px が立体の 1。ゲームの x → 立体の x、ゲームの y（下向き）→ 立体の -y。
   沼の表面（ゲームの SY）が立体の y=0。人は z=0 の面の上で動く。
   横から少し見下ろす2.5Dの見た目。丸っこい形と明るい色で、つやを少し出す。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var U = 100;

  function NumaScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: 30, near: 1, far: 80 } });
    this.scene = st.scene;
    this.camera = st.camera;
    var sc = this.scene;

    /* 空：上は青、下は明るい黄緑 */
    sc.background = Z3.canvasTex(4, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#5fb6e8"); gr.addColorStop(0.55, "#a8e0e6"); gr.addColorStop(1, "#e8f2c0");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });

    sc.add(new T.HemisphereLight(0xeaf6ff, 0x6a5a3a, 1.6));
    var key = this.key = new T.DirectionalLight(0xfff3e0, 2.2);
    key.position.set(-3, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(Z3.mobile ? 1024 : 2048, Z3.mobile ? 1024 : 2048);
    var sc2 = key.shadow.camera; sc2.left = -5; sc2.right = 5; sc2.top = 5; sc2.bottom = -5; sc2.near = 0.5; sc2.far = 30;
    key.shadow.bias = -0.0008;
    sc.add(key); sc.add(key.target);
    var rim = new T.DirectionalLight(0xbfe4ff, 1.4); rim.position.set(4, 3, -5); sc.add(rim);

    /* 遠くの丘と林（奥ほど淡く） */
    this.hills = [];
    for (var i = 0; i < 2; i++) {
      var col = i ? 0x8cc77a : 0x6fb36a;
      var hill = new T.Mesh(new T.SphereGeometry(1, 24, 12), Z3.std(col, { roughness: 1 }));
      this.hills.push(hill);
      sc.add(hill);
    }
    this.hills[0].position.set(-2.4, -0.6, -9); this.hills[0].scale.set(5, 2.4, 1);
    this.hills[1].position.set(3.2, -0.8, -12); this.hills[1].scale.set(6, 3.2, 1);

    var r = Z3.rng(5);
    this.trees = new T.Group(); sc.add(this.trees);
    var bark = Z3.std(0x6a4a34, { roughness: 0.9 });
    for (var j = 0; j < 5; j++) {
      var tx = -3.4 + j * 1.6 + r() * 0.6, tz = -2.5 - r() * 3;
      var tr = new T.Group();
      var trunk = new T.Mesh(new T.CylinderGeometry(0.07, 0.13, 2.4, 8), bark);
      trunk.position.y = 1.1; trunk.castShadow = true; tr.add(trunk);
      for (var k = 0; k < 3; k++) {
        var br = new T.Mesh(new T.CylinderGeometry(0.03, 0.06, 0.9, 6), bark);
        var side = k % 2 ? 1 : -1;
        br.position.set(side * 0.28, 1.4 + k * 0.35, 0);
        br.rotation.z = -side * (0.7 + r() * 0.4);
        tr.add(br);
      }
      /* 枝先のもこもこ（明るい緑） */
      var leaf = Z3.std(0x7ccf5a, { roughness: 0.7 });
      for (var m = 0; m < 3; m++) {
        var b = new T.Mesh(new T.SphereGeometry(0.32 + r() * 0.15, 16, 10), leaf);
        b.position.set((r() - .5) * 0.9, 2.3 + r() * 0.4, (r() - .5) * 0.3);
        b.castShadow = true;
        tr.add(b);
      }
      tr.position.set(tx, 0, tz);
      tr.scale.setScalar(0.8 + r() * 0.4);
      this.trees.add(tr);
    }

    /* 沼：上の面が y=0 の箱。手前の面より奥の z=0 で人が動くので、沈んだ所は泥に隠れる */
    this.mudMat = Z3.std(0x6a4426, { roughness: 0.22, metalness: 0.0 });
    /* 手前の切り口：下ほど暗い泥の層と、埋まった石 */
    var cut = Z3.std(0xffffff, { roughness: 0.9, map: Z3.canvasTex(512, 512, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#7a4e2a"); gr.addColorStop(0.08, "#5e3a1e"); gr.addColorStop(1, "#24140a");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      var rr = Z3.rng(3);
      for (var i = 0; i < 40; i++) {
        g.fillStyle = "rgba(" + (rr() < .5 ? "40,24,12" : "120,84,50") + "," + (0.25 + rr() * 0.3) + ")";
        g.beginPath(); g.ellipse(rr() * w, 30 + rr() * (h - 30), 6 + rr() * 22, 3 + rr() * 9, 0, 0, 7); g.fill();
      }
    }) });
    this.mud = new T.Mesh(new T.BoxGeometry(14, 8, 9), [this.mudMat, this.mudMat, this.mudMat, this.mudMat, cut, this.mudMat]);
    this.mud.receiveShadow = true;
    sc.add(this.mud);

    /* 岸：草の乗った土の台 */
    this.shore = new T.Group(); sc.add(this.shore);
    var dirt = new T.Mesh(new T.BoxGeometry(4, 8, 9), Z3.std(0x9a6a3e, { roughness: 0.9 }));
    dirt.position.set(2, -4 + 0.26, 0); dirt.receiveShadow = true; this.shore.add(dirt);
    var grass = new T.Mesh(new T.BoxGeometry(4.1, 0.16, 9.1), Z3.std(0x6cc34a, { roughness: 0.7 }));
    grass.position.set(2, 0.32, 0); grass.receiveShadow = true; this.shore.add(grass);
    var edge = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 9.1, 12), Z3.std(0x6cc34a, { roughness: 0.7 }));
    edge.rotation.x = Math.PI / 2; edge.position.set(0, 0.29, 0); this.shore.add(edge);
    var tuft = Z3.std(0x58b03c, { roughness: 0.7 });
    for (var q = 0; q < 6; q++) {
      var c = new T.Mesh(new T.ConeGeometry(0.06, 0.3, 6), tuft);
      c.position.set(0.15 + q * 0.13, 0.5, 0.3 + (q % 3) * 0.25);
      c.rotation.z = (q % 2 ? 0.2 : -0.2);
      this.shore.add(c);
    }

    this.buildPerson();

    /* 体のまわりの泥の盛り上がり・泡・飛び散る泥 */
    this.mound = new T.Mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mudMat);
    sc.add(this.mound);
    this.bubbleMat = Z3.std(0x9a7048, { roughness: 0.2, transparent: true, opacity: 0.9 });
    this.bubbleGeo = new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    this.splatGeo = new T.SphereGeometry(1, 8, 6);
    this.pool = [];
  }

  /* 人の部品：丸い頭に帽子、大きな目、太い胴と手足（カプセル） */
  NumaScene.prototype.buildPerson = function () {
    var sc = this.scene;
    var skin = Z3.std(0xffc69a, { roughness: 0.55 });
    var shirt = Z3.std(0xe8b04a, { roughness: 0.6 });
    var pants = Z3.std(0x3a6fd0, { roughness: 0.6 });
    var boot = Z3.std(0x7a4a2a, { roughness: 0.5 });
    var hat = Z3.std(0xd9b878, { roughness: 0.7 });
    var band = Z3.std(0xc8402e, { roughness: 0.6 });
    this.mats = { skin: skin, shirt: shirt, pants: pants, boot: boot };
    var cyl = new T.CylinderGeometry(1, 1, 1, 16, 1, true), sph = new T.SphereGeometry(1, 16, 12);

    var root = this.person = new T.Group(); sc.add(root);
    this.limbs = [];
    var self = this;
    /* 手足：筒と両端の玉。setLimb で両端を合わせる */
    function limb(mat, r) {
      var m = new T.Group();
      var c = new T.Mesh(cyl, mat), a = new T.Mesh(sph, mat), b = new T.Mesh(sph, mat);
      c.scale.set(r, 1, r); a.scale.setScalar(r); b.scale.setScalar(r);
      [c, a, b].forEach(function (x) { x.castShadow = true; m.add(x); });
      m.userData = { c: c, b: b };
      root.add(m); self.limbs.push(m); return m;
    }
    function ball(mat, r) {
      var m = new T.Mesh(new T.SphereGeometry(r, 18, 12), mat); m.castShadow = true; root.add(m); return m;
    }
    this.legB = limb(Z3.std(0x2f5cb0, { roughness: 0.6 }), 0.17);
    this.bootB = ball(boot, 0.17);
    this.armB = limb(Z3.std(0xd09a38, { roughness: 0.6 }), 0.11);
    this.handB = ball(skin, 0.12);
    this.thigh = limb(pants, 0.19); this.shin = limb(pants, 0.18);
    this.bootF = ball(boot, 0.19);
    this.torso = limb(shirt, 0.31);
    this.belt = new T.Mesh(new T.CylinderGeometry(0.33, 0.33, 0.1, 18), Z3.std(0x5a3a22, { roughness: 0.5 }));
    root.add(this.belt);
    this.upper = limb(shirt, 0.13); this.fore = limb(skin, 0.11);
    this.handF = ball(skin, 0.14);

    /* 頭（帽子と顔をまとめて回す） */
    var head = this.head = new T.Group(); root.add(head);
    var skull = new T.Mesh(new T.SphereGeometry(0.42, 28, 18), skin); skull.castShadow = true; head.add(skull);
    var brim = new T.Mesh(new T.CylinderGeometry(0.62, 0.62, 0.05, 28), hat); brim.position.y = 0.2; head.add(brim);
    var crown = new T.Mesh(new T.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hat);
    crown.position.y = 0.2; crown.scale.y = 0.8; head.add(crown);
    var hb = new T.Mesh(new T.CylinderGeometry(0.405, 0.405, 0.09, 24), band); hb.position.y = 0.26; head.add(hb);
    var nose = new T.Mesh(new T.SphereGeometry(0.12, 16, 10), Z3.std(0xffb488, { roughness: 0.5 }));
    nose.position.set(-0.4, -0.06, 0.12); head.add(nose);
    /* 目：白目と黒目。顔は -x（岸と反対）と手前を向く */
    var white = Z3.std(0xffffff, { roughness: 0.3 }), black = Z3.std(0x1a1a28, { roughness: 0.2 });
    this.eyes = [];
    for (var i = 0; i < 2; i++) {
      var e = new T.Group();
      var w = new T.Mesh(new T.SphereGeometry(0.11, 16, 12), white); w.scale.set(0.6, 1.25, 0.6); e.add(w);
      var p = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), black); p.position.set(-0.05, 0, 0.02); p.scale.set(0.6, 1.2, 0.8); e.add(p);
      e.position.set(-0.34, 0.06, i ? 0.25 : 0.03);
      e.userData.w = w; e.userData.p = p;
      head.add(e); this.eyes.push(e);
    }
    this.mouth = new T.Mesh(new T.SphereGeometry(0.07, 12, 8), Z3.std(0x6a1e1e, { roughness: 0.4 }));
    this.mouth.position.set(-0.36, -0.22, 0.14); head.add(this.mouth);
    var mus = new T.Mesh(new T.CapsuleGeometry(0.05, 0.16, 4, 8), Z3.std(0x4a2e1e, { roughness: 0.6 }));
    mus.rotation.x = Math.PI / 2; mus.position.set(-0.4, -0.14, 0.12); head.add(mus);
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

  /* カメラ：z=0 の面の画面の中央がゲームの中央に来るよう、少し見下ろす */
  NumaScene.prototype.aim = function (W, H, SY) {
    if (this.W === W && this.H === H && this.SY === SY) return;
    this.W = W; this.H = H; this.SY = SY; this.cx = W / 2;
    var cam = this.camera, fov = 30 * Math.PI / 180;
    var D = (H / U / 2) / Math.tan(fov / 2);
    var pitch = 0.16;
    var ty = (SY - H / 2) / U;
    cam.position.set(0, ty + Math.sin(pitch) * D, Math.cos(pitch) * D);
    cam.lookAt(0, ty, 0);
    cam.aspect = W / H; cam.updateProjectionMatrix();
    this.key.target.position.set(0, 0, 0);
  };

  /* 画面の点 → z=0 の面のゲームの点（指の位置に使う） */
  NumaScene.prototype.toGame = function (sx, sy) {
    if (!this.W) return { x: sx, y: sy };
    var v = new T.Vector3(sx / this.W * 2 - 1, -(sy / this.H) * 2 + 1, 0.5).unproject(this.camera);
    var o = this.camera.position, d = v.sub(o).normalize();
    var t = -o.z / d.z;
    return { x: (o.x + d.x * t) * U + this.cx, y: this.SY - (o.y + d.y * t) * U };
  };
  /* ゲームの点 → 画面の点（光る輪に使う） */
  NumaScene.prototype.toScreen = function (x, y) {
    var p = this.v(x, y); var v = new T.Vector3(p.x, p.y, 0).project(this.camera);
    return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H };
  };

  /* g: ゲームの状態（点はすべてゲームの座標） */
  NumaScene.prototype.sync = function (g) {
    this.aim(g.W, g.H, g.SY);
    var self = this, V = function (p, z) { return self.v(p.x, p.y, z); };
    var shore = this.v(g.SHORE, g.SY);
    this.mud.position.set(shore.x - 7, -4, -2.5);
    this.shore.position.set(shore.x, 0, -2.5);

    var sh = g.shake * 0.04;
    this.person.position.set((Math.random() - .5) * sh, (Math.random() - .5) * sh, 0);
    var h = V(g.hip), s = V(g.shoulder), knee = V(g.knee), foot = V(g.foot), el = V(g.elbow), hd = V(g.hand), ot = V(g.other);
    var zf = 0.18, zb = -0.18;
    setLimb(this.legB, { x: h.x, y: h.y, z: zb }, { x: foot.x + 0.06, y: foot.y + 0.03, z: zb });
    this.bootB.position.set(foot.x + 0.06, foot.y + 0.03, zb);
    setLimb(this.thigh, { x: h.x, y: h.y, z: zf }, { x: knee.x, y: knee.y, z: zf });
    setLimb(this.shin, { x: knee.x, y: knee.y, z: zf }, { x: foot.x, y: foot.y, z: zf });
    this.bootF.position.set(foot.x, foot.y, zf);
    setLimb(this.torso, h, s);
    this.belt.position.set(h.x + (s.x - h.x) * 0.1, h.y + (s.y - h.y) * 0.1, 0);
    this.belt.rotation.set(0, 0, -g.th);
    setLimb(this.armB, { x: s.x, y: s.y, z: -0.3 }, { x: ot.x, y: ot.y, z: -0.3 });
    this.handB.position.set(ot.x, ot.y, -0.3);
    setLimb(this.upper, { x: s.x, y: s.y, z: 0.32 }, { x: el.x, y: el.y, z: 0.34 });
    setLimb(this.fore, { x: el.x, y: el.y, z: 0.34 }, { x: hd.x, y: hd.y, z: 0.36 });
    this.handF.position.set(hd.x, hd.y, 0.36);

    var hp = V(g.head);
    this.head.position.set(hp.x, hp.y, 0.02);
    this.head.rotation.set(0, 0.35, -g.th);
    this.head.scale.setScalar(g.K * 0.95);

    /* 表情 */
    var blink = (g.T % 3.2) < 0.12;
    this.eyes.forEach(function (e) {
      var w = e.userData.w, p = e.userData.p;
      if (g.face === "scared") { w.scale.set(0.7, 1.45, 0.7); p.scale.set(0.35, 0.6, 0.5); }
      else if (g.face === "calm" || blink) { w.scale.set(0.6, 0.2, 0.6); p.scale.set(0.01, 0.01, 0.01); }
      else { w.scale.set(0.6, 1.25, 0.6); p.scale.set(0.6, 1.2, 0.8); }
    });
    if (g.face === "scared") this.mouth.scale.set(1.2, 1.8, 1);
    else if (g.face === "calm") this.mouth.scale.set(0.8, 0.3, 1);
    else this.mouth.scale.set(0.9, 0.6, 1);

    /* 体のまわりの泥の盛り上がり */
    var lying = g.th > 1.15;
    this.mound.position.set(lying ? h.x + 0.6 : h.x, -0.01, 0);
    this.mound.scale.set(lying ? 1.5 : 0.48, 0.07, 0.5);
    this.mound.visible = g.state !== "clear" && g.state !== "result" || !g.won;

    /* 泡と泥の粒（毎コマ作り直さず使い回す） */
    var n = 0, pool = this.pool, scn = this.scene;
    function get(geo) {
      var m = pool[n];
      if (!m) { m = new T.Mesh(geo, self.bubbleMat); pool.push(m); scn.add(m); }
      m.geometry = geo; m.visible = true; n++; return m;
    }
    g.bubbles.forEach(function (b) {
      var k = b.t / b.life, m = get(self.bubbleGeo), p = self.v(b.x, g.SY, 0);
      m.position.set(p.x, 0, ((b.x * 7) % 3) * 0.3 - 0.4); m.scale.setScalar(b.r / U * (0.6 + k) * 1.4);
    });
    g.splats.forEach(function (sp) {
      var m = get(self.splatGeo), p = self.v(sp.x, sp.y, 0);
      m.position.set(p.x, p.y, 0.3); m.scale.setScalar(sp.r / U * 1.3);
    });
    for (var i = n; i < pool.length; i++) pool[i].visible = false;
  };

  NumaScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.NumaScene = NumaScene;
})(window);
