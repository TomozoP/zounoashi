/* 底なし沼の立体の見た目（three.js）。games/three-base.js の Z3 を土台にする。
   動き（沈み・傾き・泥かき）はゲーム側の2Dのまま。ここは見た目と、画面の点 ⇔ ゲームの点の変換だけ。
   単位：ゲームの 100px が立体の 1。ゲームの x → 立体の x、ゲームの y（下向き）→ 立体の -y。
   沼の表面（ゲームの SY）が立体の y=0。人は z=0 の面の上で動く。
   真横から遠近なしで見る2.5Dの見た目（ワンダーのような、立体の絵を平らに並べた画面）。丸っこい形と明るい色で、つやを少し出す。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var U = 100;

  function NumaScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.1 }, camera: { fov: 30, near: 1, far: 80 } });
    /* 真横から遠近なしで見る（2.5D）。少しだけ見下ろして泥の表面のつやを見せる */
    st.camera = new T.OrthographicCamera(-2.7, 2.7, 4.8, -4.8, 0.1, 80);
    this.scene = st.scene;
    this.camera = st.camera;
    var sc = this.scene;

    /* 空：明るい青のグラデーション */
    sc.background = Z3.canvasTex(4, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#2f8fe0"); gr.addColorStop(0.6, "#7cc4f2"); gr.addColorStop(1, "#d6f0fb");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });

    sc.add(new T.HemisphereLight(0xf2f8ff, 0x8a7050, 1.9));
    var key = this.key = new T.DirectionalLight(0xfff4e2, 2.0);
    key.position.set(-3, 6, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(Z3.mobile ? 1024 : 2048, Z3.mobile ? 1024 : 2048);
    var sc2 = key.shadow.camera; sc2.left = -5; sc2.right = 5; sc2.top = 5; sc2.bottom = -5; sc2.near = 0.5; sc2.far = 30;
    key.shadow.bias = -0.0008;
    sc.add(key); sc.add(key.target);
    var rim = new T.DirectionalLight(0xd8f0ff, 1.2); rim.position.set(4, 3, -5); sc.add(rim);

    var r = Z3.rng(5);
    var self = this;
    /* もこもこ（玉の集まり）。雲・丘・茂みに使う */
    function puff(mat, x, y, z, w, h, n, seed) {
      var g = new T.Group(), rr = Z3.rng(seed);
      for (var i = 0; i < n; i++) {
        var k = i / Math.max(1, n - 1), rad = h * (0.55 + 0.45 * Math.sin(k * Math.PI)) * (0.8 + rr() * 0.3);
        var m = new T.Mesh(new T.SphereGeometry(1, 20, 14), mat);
        m.scale.setScalar(rad);
        m.position.set(x + (k - 0.5) * w, y + rad * 0.2, z + rr() * 0.2);
        g.add(m);
      }
      sc.add(g); return g;
    }
    /* 雲（奥）：白くふくらんだ玉 */
    var cloud = Z3.std(0xffffff, { roughness: 0.95, emissive: 0x9ab8d0, emissiveIntensity: 0.35 });
    puff(cloud, -2.3, 1.2, -20, 2.4, 0.9, 6, 1);
    puff(cloud, 2.6, 2.4, -20, 1.8, 0.55, 5, 2);
    puff(cloud, 0.4, 3.6, -20, 1.0, 0.3, 4, 3);
    puff(cloud, -1.4, 3.1, -20, 0.8, 0.22, 3, 4);
    /* 丘（奥ほど淡い） */
    var hillFar = Z3.std(0x9fd6b4, { roughness: 1, emissive: 0x3a6a5a, emissiveIntensity: 0.25 });
    var hillMid = Z3.std(0x5cbf6a, { roughness: 0.9 });
    puff(hillFar, 0, -0.6, -16, 6.5, 1.3, 5, 7);
    puff(hillMid, -1.5, -0.7, -12, 3.5, 1.1, 4, 8);
    puff(hillMid, 2.8, -0.9, -12, 2.4, 1.0, 3, 9);

    /* 奥の岸：草の帯と、茂み・ガマ */
    var grassMat = Z3.std(0x58c040, { roughness: 0.6 });
    var back = new T.Mesh(new T.BoxGeometry(14, 0.6, 3), grassMat);
    back.position.set(0, -0.15, -5.2); back.receiveShadow = true; sc.add(back);
    var bush = Z3.std(0x2fa84a, { roughness: 0.55 });
    puff(bush, -2.2, 0.25, -4.4, 0.9, 0.32, 4, 11).children.forEach(function (m) { m.castShadow = true; });
    puff(bush, 0.6, 0.22, -4.4, 0.7, 0.28, 3, 12);
    puff(bush, 2.3, 0.25, -4.4, 0.8, 0.3, 4, 13);
    var stem = Z3.std(0x4f9a3a, { roughness: 0.6 }), head = Z3.std(0x8a5a2e, { roughness: 0.5 });
    for (var j = 0; j < 9; j++) {
      var cx = -2.6 + j * 0.62 + r() * 0.2, hgt = 0.9 + r() * 0.6;
      var st1 = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, hgt, 6), stem);
      st1.position.set(cx, hgt / 2, -3.3 - r() * 0.4); st1.rotation.z = (r() - 0.5) * 0.25; sc.add(st1);
      var hd = new T.Mesh(new T.CapsuleGeometry(0.06, 0.22, 4, 8), head);
      hd.position.set(cx + st1.rotation.z * -hgt * 0.5, hgt * 0.92, st1.position.z); sc.add(hd);
    }

    /* 沼：上の面が y=0 の箱（z は -3〜+1）。人は z=0 で動くので、沈んだ所は手前の泥に隠れる */
    this.mudMat = Z3.std(0x7a4c26, { roughness: 0.18, metalness: 0.0 });
    /* 手前の切り口：波打つ泥の層（ワンダーの地面の断面のように） */
    var cut = Z3.std(0xffffff, { roughness: 0.85, map: Z3.canvasTex(512, 512, function (g, w, h) {
      var cols = ["#8a5630", "#6e4224", "#5a341b", "#7a4a28", "#4a2a14", "#3a200e"];
      g.fillStyle = cols[0]; g.fillRect(0, 0, w, h);
      for (var i = 1; i < cols.length; i++) {
        var y0 = h * (i / cols.length) - 10;
        g.fillStyle = cols[i];
        g.beginPath(); g.moveTo(0, h);
        for (var x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x / w * Math.PI * 6 + i * 1.7) * 14);
        g.lineTo(w, h); g.fill();
      }
      var rr = Z3.rng(3);
      for (var k = 0; k < 26; k++) {
        g.fillStyle = "rgba(255,230,190," + (0.08 + rr() * 0.1) + ")";
        g.beginPath(); g.ellipse(rr() * w, 40 + rr() * (h - 40), 8 + rr() * 14, 5 + rr() * 8, 0, 0, 7); g.fill();
      }
    }, null) });
    cut.map.wrapS = T.RepeatWrapping; cut.map.repeat.set(3, 1);
    this.mud = new T.Mesh(new T.BoxGeometry(14, 8, 4), [this.mudMat, this.mudMat, this.mudMat, this.mudMat, cut, this.mudMat]);
    this.mud.receiveShadow = true;
    sc.add(this.mud);
    /* 手前のふちの丸み（つやのある泥） */
    this.lip = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 14, 16), this.mudMat);
    this.lip.rotation.z = Math.PI / 2; sc.add(this.lip);

    /* 岸：断面の見える土の台に、丸いふちの芝 */
    this.shore = new T.Group(); sc.add(this.shore);
    var soil = Z3.std(0xffffff, { roughness: 0.9, map: Z3.canvasTex(256, 512, function (g, w, h) {
      var cols = ["#c98a4a", "#b0703a", "#d29a58", "#a4652f", "#8a5226"];
      for (var i = 0; i < cols.length; i++) {
        g.fillStyle = cols[i];
        g.beginPath(); g.moveTo(0, h);
        var y0 = h * (i / cols.length);
        for (var x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x / w * Math.PI * 3 + i) * 12);
        g.lineTo(w, h); g.fill();
      }
    }) });
    var dirtSide = Z3.std(0xb0703a, { roughness: 0.9 });
    var dirt = new T.Mesh(new T.BoxGeometry(4, 8, 8), [dirtSide, dirtSide, dirtSide, dirtSide, soil, dirtSide]);
    dirt.position.set(2, -4 + 0.26, -2); dirt.receiveShadow = true; this.shore.add(dirt);
    var grass = new T.Mesh(new T.BoxGeometry(4.1, 0.2, 8.1), grassMat);
    grass.position.set(2.02, 0.34, -2); grass.receiveShadow = true; this.shore.add(grass);
    for (var q = 0; q < 14; q++) {
      var bump = new T.Mesh(new T.SphereGeometry(0.14, 14, 10), grassMat);
      bump.position.set(0.05 + q * 0.15, 0.3, 2.0); bump.scale.set(1, 0.8, 0.8); this.shore.add(bump);
    }
    var edge = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 8.1, 14), grassMat);
    edge.rotation.x = Math.PI / 2; edge.position.set(0, 0.3, -2); this.shore.add(edge);
    var sb = puff(bush, 0, 0, 0, 0.6, 0.26, 3, 14);
    sc.remove(sb); this.shore.add(sb); sb.position.set(0.75, 0.5, -1.2);

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
    var cam = this.camera, hw = W / U / 2, hh = H / U / 2;
    var pitch = 0.1, D = 20, ty = (SY - H / 2) / U;
    cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh;
    cam.position.set(0, ty + Math.sin(pitch) * D, Math.cos(pitch) * D);
    cam.lookAt(0, ty, 0);
    cam.updateProjectionMatrix();
    this.key.target.position.set(0, 0, 0);
  };

  /* 画面の点 → z=0 の面のゲームの点（指の位置に使う） */
  NumaScene.prototype.toGame = function (sx, sy) {
    if (!this.W) return { x: sx, y: sy };
    var nx = sx / this.W * 2 - 1, ny = -(sy / this.H) * 2 + 1;
    var o = new T.Vector3(nx, ny, -1).unproject(this.camera), f = new T.Vector3(nx, ny, 1).unproject(this.camera);
    var d = f.sub(o), t = -o.z / d.z;
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
    this.mud.position.set(shore.x - 7, -4, -1);
    this.lip.position.set(shore.x - 7, -0.06, 0.95);
    this.shore.position.set(shore.x, 0, 0);

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
