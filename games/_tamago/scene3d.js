/* たまご立てゲームの立体（three.js）。見た目だけ。進行は index.html 側。
   sync({ th: 卵の傾き(重力に対して、右へ+), phi: 机の傾き(右が下がる+), cracked, crackT, t }) */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* 卵の輪郭。下(とがっていない方)が太い。y: 0〜1 */
  var N = 48, PROF = [];
  (function () {
    for (var j = 0; j <= N; j++) {
      var a = j / N * Math.PI, t = -Math.cos(a);       /* -1(下)〜1(上) */
      var r = 0.36 * Math.sin(a) * (1 - 0.13 * t);
      PROF.push([Math.max(r, 0.0001), (t + 1) / 2]);
    }
  })();
  var FLAT = 0.065;                                     /* 割ったときに平らにする高さ */

  /* 卵の形から、傾き a のときの一番低い点（足もとを原点に回したとき）。ゲーム側の物理でも使う */
  /* 物理用の細かい輪郭（角ばると真上で転がり方が変わるため） */
  var FN = 480, FINE = [];
  for (var fj = 0; fj <= FN; fj++) {
    var fa = fj / FN * Math.PI, ft = -Math.cos(fa);
    FINE.push([0.36 * Math.sin(fa) * (1 - 0.13 * ft), (ft + 1) / 2]);
  }
  global.EggShape = {
    COM: 0.46,  /* 重心の高さ（足もとから） */
    FLAT: FLAT,
    low: function (a, cracked) {
      var c = Math.cos(a), sn = Math.sin(a), low = 1e9;
      for (var j = 0; j <= FN; j++) {
        var rr = FINE[j][0], y = cracked ? Math.max(FINE[j][1], FLAT) - FLAT : FINE[j][1];
        if (cracked && FINE[j][1] < FLAT) rr *= 0.7 + 0.3 * FINE[j][1] / FLAT;
        var y1 = y * c - rr * sn, y2 = y * c + rr * sn;
        if (y1 < low) low = y1;
        if (y2 < low) low = y2;
      }
      return low;
    }
  };

  function rand(seed) { return Z3.rng(seed); }

  /* 殻の絵（色むら・細かい斑点）。crack なら下の方にひび */
  function shellPaint(crack) {
    return function (g, w, h) {
      var r = rand(11);
      g.fillStyle = "#efe2cf"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 260; i++) {
        var x = r() * w, y = r() * h, s = 8 + r() * 40;
        var c = r() < 0.5 ? "rgba(214,186,150," : "rgba(250,242,230,", al = 0.10 + r() * 0.12;
        /* 左右の端でつながるように、はみ出す分は反対側にも描く */
        for (var ox = -w; ox <= w; ox += w) {
          var gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, s);
          gr.addColorStop(0, c + al + ")"); gr.addColorStop(1, c + "0)");
          g.fillStyle = gr; g.fillRect(x + ox - s, y - s, s * 2, s * 2);
        }
      }
      for (i = 0; i < 1400; i++) {
        g.fillStyle = "rgba(150,110,80," + (0.05 + r() * 0.12) + ")";
        var d = 0.6 + r() * 1.4;
        g.fillRect(r() * w, r() * h, d, d);
      }
      if (crack) {
        /* 下の端(絵の下側＝輪郭の下)から上へ伸びるひび */
        g.lineJoin = "round";
        for (var k = 0; k < 14; k++) {
          var x0 = (k + r() * 0.6) / 14 * w, y0 = h - 2;
          g.beginPath(); g.moveTo(x0, y0);
          var x1 = x0, y1 = y0, len = 18 + r() * 34;
          for (var s2 = 0; s2 < 5; s2++) {
            x1 += (r() - 0.5) * 14; y1 -= len / 5 * (0.6 + r() * 0.8);
            g.lineTo(x1, y1);
          }
          g.strokeStyle = "rgba(70,48,30,.9)"; g.lineWidth = 2.6; g.stroke();
          g.strokeStyle = "rgba(255,250,240,.6)"; g.lineWidth = 0.8;
          g.save(); g.translate(1, -1); g.stroke(); g.restore();
        }
        g.fillStyle = "rgba(120,90,60,.35)"; g.fillRect(0, h - 10, w, 10);
      }
    };
  }
  function bumpPaint(g, w, h) {
    var r = rand(5);
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 9000; i++) {
      var v = Math.floor(100 + r() * 70);
      g.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  }
  /* 木の天板 */
  function woodPaint(g, w, h) {
    var r = rand(3);
    var base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "#6b4428"); base.addColorStop(1, "#5a3820");
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 180; i++) {
      var y = r() * h, a = 0.04 + r() * 0.1, amp = 2 + r() * 6, fr = (2 + Math.floor(r() * 5)) * Math.PI * 2 / w, ph = r() * 9;   /* 左右でつながる波 */
      g.beginPath();
      for (var x = 0; x <= w; x += 8) {
        var yy = y + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 3 + ph) * amp * 0.3;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.strokeStyle = (r() < 0.5 ? "rgba(40,22,10," : "rgba(150,100,60,") + a + ")";
      g.lineWidth = 0.6 + r() * 2.4; g.stroke();
    }
    /* 板の継ぎ目 */
    for (var p = 1; p < 4; p++) { g.fillStyle = "rgba(25,12,4,.55)"; g.fillRect(0, p * h / 4 - 1, w, 2); }
  }
  function bgPaint(g, w, h) {
    var gr = g.createRadialGradient(w * 0.38, h * 0.32, 10, w * 0.5, h * 0.45, h * 0.8);
    gr.addColorStop(0, "#5c5048"); gr.addColorStop(0.5, "#2e2722"); gr.addColorStop(1, "#141110");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    /* ぼけた窓明かり */
    var b = g.createRadialGradient(w * 0.8, h * 0.25, 4, w * 0.8, h * 0.25, w * 0.35);
    b.addColorStop(0, "rgba(255,230,190,.22)"); b.addColorStop(1, "rgba(255,230,190,0)");
    g.fillStyle = b; g.fillRect(0, 0, w, h);
  }
  function blobPaint(g, w, h) {
    var gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(0.45, "rgba(0,0,0,.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }

  /* 写り込み用の部屋（柔らかい照明箱と窓） */
  function makeEnv(renderer) {
    var es = new T.Scene();
    var room = new T.Mesh(new T.BoxGeometry(20, 12, 20), new T.MeshBasicMaterial({ color: 0x2a2420, side: T.BackSide }));
    room.position.y = 4; es.add(room);
    function panel(w, h, c, x, y, z, rx, ry) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); es.add(m);
    }
    panel(6, 4, 0xfff1dc, -4, 9.9, 3, Math.PI / 2, 0);     /* 天井の照明箱 */
    panel(5, 6, 0xd8e6ff, 9.9, 5, -2, 0, -Math.PI / 2);    /* 窓 */
    panel(20, 2, 0x5a4636, 0, -1.9, 0, -Math.PI / 2, 0);   /* 床の照り返し */
    var pm = new T.PMREMGenerator(renderer);
    var tex = pm.fromScene(es, 0.04).texture;
    pm.dispose();
    return tex;
  }

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({
      renderer: { shadows: true, tone: "aces", exposure: 1.05 },
      camera: { fov: 26, near: 0.1, far: 60 },
      finish: { contrast: 0.12, vignette: 0.34, grain: 0.022 }
    });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    var r = st.renderer;
    r.shadowMap.type = T.PCFSoftShadowMap;
    try { sc.environment = makeEnv(r); } catch (e) {}
    sc.background = Z3.canvasTex(256, 512, bgPaint);

    /* 明かり：左上の主光（柔らかい影）と、右奥からの縁の光 */
    sc.add(new T.HemisphereLight(0xfff2e2, 0x3a2a1e, 0.35));
    var key = new T.DirectionalLight(0xfff0dc, 2.2);
    key.position.set(-2.4, 4.2, 2.2); key.castShadow = true;
    key.shadow.mapSize.set(Z3.mobile ? 1024 : 2048, Z3.mobile ? 1024 : 2048);
    var c = key.shadow.camera; c.left = -2; c.right = 2; c.top = 2; c.bottom = -2; c.near = 0.5; c.far = 12;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; key.shadow.radius = 6;
    sc.add(key); sc.add(key.target); this.key = key;
    var rim = new T.DirectionalLight(0xcfe0ff, 1.1); rim.position.set(3, 2.2, -3); sc.add(rim);

    /* 机（傾けるのは天板ごと。回す中心は卵の足もと） */
    this.table = new T.Group(); sc.add(this.table);
    var wood = this.wood = Z3.canvasTex(1024, 512, woodPaint);
    wood.wrapS = wood.wrapT = T.RepeatWrapping;
    var top = new T.Mesh(new T.BoxGeometry(6, 0.16, 5), new T.MeshStandardMaterial({ map: wood, roughness: 0.42, metalness: 0, envMapIntensity: 0.9 }));
    top.position.set(0, -0.08, 0.6); top.receiveShadow = true;
    this.table.add(top);
    this.blob = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: Z3.canvasTex(128, 128, blobPaint), transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.002;
    this.table.add(this.blob);

    /* 卵 */
    var pts = PROF.map(function (p) { return new T.Vector2(p[0], p[1]); });
    this.geo = new T.LatheGeometry(pts, Z3.mobile ? 48 : 72);
    this.geoCracked = this.geo.clone();
    var pos = this.geoCracked.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      if (y < FLAT) { var k = y / FLAT; pos.setY(i, FLAT); pos.setX(i, pos.getX(i) * (0.7 + 0.3 * k)); pos.setZ(i, pos.getZ(i) * (0.7 + 0.3 * k)); }
    }
    this.geoCracked.computeVertexNormals();
    this.geoCracked.translate(0, -FLAT, 0);
    var bump = Z3.canvasTex(512, 256, bumpPaint);
    this.mapPlain = Z3.canvasTex(512, 256, shellPaint(false));
    this.mapCrack = Z3.canvasTex(512, 256, shellPaint(true));
    this.shellMat = new T.MeshPhysicalMaterial({
      map: this.mapPlain, bumpMap: bump, bumpScale: 0.6, roughness: 0.58, metalness: 0,
      clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.3, sheenColor: new T.Color(0xfff6ea), sheenRoughness: 0.6
    });
    this.egg = new T.Mesh(this.geo, this.shellMat);
    this.egg.castShadow = true; this.egg.receiveShadow = true;
    this.egg.rotation.y = Math.PI;   /* 輪郭の継ぎ目を奥へ */
    this.eggPivot = new T.Group(); this.eggPivot.add(this.egg); sc.add(this.eggPivot);

    /* 割れたかけら */
    this.bits = [];
    var br = rand(21);
    for (i = 0; i < 14; i++) {
      var sh = new T.Shape(), n = 3 + Math.floor(br() * 3), s = 0.03 + br() * 0.04;
      for (var q = 0; q < n; q++) {
        var a = q / n * Math.PI * 2, rr = s * (0.6 + br() * 0.6);
        if (q === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      var m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshStandardMaterial({ color: 0xf1e4d2, roughness: 0.6, side: T.DoubleSide }));
      m.castShadow = true; m.visible = false;
      var ang = br() * Math.PI * 2, d = 0.28 + br() * 0.4;
      m.userData = { x: Math.cos(ang) * d, z: Math.sin(ang) * d * 0.8, rot: br() * 6, up: 0.25 + br() * 0.35 };
      this.table.add(m); this.bits.push(m);
    }

    this.camX = 0; this.camZ = 0; this.rollX = 0; this.prevC = null; this.prevA = 0; this.prevT = 0; this.crackX = null;
    this.aimCam(0, 0, 0, 0, 0);
    this.cracked = false;
  }

  GameScene.prototype.reset = function () {};
  /* カメラは卵の真ん中を横に追う（倒れても見切れない） */
  GameScene.prototype.aimCam = function (x, z, yaw, focus, shake) {
    /* focus: 0=引き 1=卵が真上に近いとき低く寄る。yaw: 卵のまわりの回り込み */
    var f = focus * focus * (3 - 2 * focus);
    var d = 6.9 - 2.6 * f, h = 1.4 - 0.75 * f, ly = 0.4 + 0.08 * f;
    /* 揺れはコマごとの乱数にせず、なめらかに小さく揺らす（カメラが飛んで見えないように） */
    var sx = 0, sy = shake ? Math.sin(this.shakeT * 70) * shake : 0;
    this.camera.position.set(x + Math.sin(yaw) * d + sx, h + sy, z + Math.cos(yaw) * d);
    this.camera.lookAt(x, ly, z);
  };

  GameScene.prototype.sync = function (s) {
    var phi = s.phi || 0, tx = s.tx || 0, tz = s.tz || 0, th = Math.sqrt(tx * tx + tz * tz);
    var dx = th > 1e-6 ? tx / th : 1, dz = th > 1e-6 ? tz / th : 0;
    this.table.rotation.z = -phi;
    if (!!s.cracked !== this.cracked) {
      this.cracked = !!s.cracked;
      this.egg.geometry = this.cracked ? this.geoCracked : this.geo;
      this.shellMat.map = this.cracked ? this.mapCrack : this.mapPlain;
      this.shellMat.needsUpdate = true;
      this.skipRoll = true;   /* 形が変わった瞬間に横へずれないように */
    }
    /* 卵は足もとの点で机に乗る。傾けたら、一番低い所が机の面に来るように持ち上げる */
    var c = Math.cos(th), sn = Math.sin(th), low = 1e9, lowX = 0, cLx = 0, cLy = 0;
    for (var j = 0; j <= N; j++) {
      var rr = PROF[j][0], y = this.cracked ? Math.max(PROF[j][1], FLAT) - FLAT : PROF[j][1];
      if (this.cracked && PROF[j][1] < FLAT) rr *= 0.7 + 0.3 * PROF[j][1] / FLAT;
      /* 右に倒れる(th>0)ときは右側(x=+r)の縁が下がる */
      var yr = y * c - rr * sn, xr = y * sn + rr * c;
      var yl = y * c + rr * sn, xl = y * sn - rr * c;
      if (yr < low) { low = yr; lowX = xr; cLx = rr; cLy = y; }
      if (yl < low) { low = yl; lowX = xl; cLx = -rr; cLy = y; }
    }
    /* 机の面（足もとの中心を軸に傾いている）の高さ */
    var tp = Math.tan(phi);
    /* 傾く向きに倒す（上向きの軸を、向き d へ th だけ回す） */
    this.tmpAxis = this.tmpAxis || new T.Vector3();
    this.tmpAxis.set(dz, 0, -dx);
    this.eggPivot.quaternion.setFromAxisAngle(this.tmpAxis, th);
    /* 転がり: 机に触れている点は滑らないので、殻の上で触れる点が動いた分だけ卵が進む（どこまでも） */
    var tt = s.t || 0, aSigned = tx;
    if (tt < this.prevT || !this.prevC) { this.rollX = lowX * dx; this.prevC = null; this.crackX = null; this.camX = 0; }
    var lx = cLx * dx, ly = cLy;
    if (this.skipRoll && this.prevEx != null) { this.rollX = this.prevEx + lowX * dx; this.skipRoll = false; }
    else if (this.prevC) {
      var ds = Math.hypot(lx - this.prevC[0], ly - this.prevC[1]);
      if (ds < 0.3) this.rollX += ds * (aSigned >= this.prevA ? 1 : -1);
    }
    this.prevC = [lx, ly]; this.prevA = aSigned; this.prevT = tt;
    var ex = this.rollX - lowX * dx;
    this.prevEx = ex;
    this.eggPivot.position.set(ex, -low - lowX * dx * tp, 0);
    /* 机は卵についていき、木目だけずらす */
    this.table.position.x = ex;
    this.wood.offset.x = ex / 6;
    this.key.position.x = -2.4 + ex; this.key.target.position.set(ex, 0, 0);
    this.blob.position.set(lowX * 0.3 * dx, 0.002, lowX * 0.3 * dz);
    /* 卵の真ん中を追う（倒れても見切れない） */
    var cm = Math.sin(th) * 0.42;
    this.camX += (ex + cm * dx - this.camX) * 0.08;
    this.camZ += (cm * dz - this.camZ) * 0.06;
    var ct0 = s.cracked ? (s.t || 0) - (s.crackT || 0) : 9;
    this.shakeT = ct0;
    this.aimCam(this.camX, this.camZ, s.yaw || 0, s.focus || 0, ct0 < 0.3 ? 0.025 * (1 - ct0 / 0.3) : 0);
    var stand = Math.max(0, 1 - Math.abs(th) * 1.6);
    this.blob.scale.set(0.75 + (1 - stand) * 0.6, 0.6 + (1 - stand) * 0.3, 1);
    this.blob.material.opacity = 0.5 + 0.4 * stand;
    /* かけら */
    var ct = s.cracked ? Math.max(0, (s.t || 0) - (s.crackT || 0)) : -1;
    for (var i = 0; i < this.bits.length; i++) {
      var b = this.bits[i], u = b.userData;
      b.visible = ct >= 0;
      if (ct < 0) continue;
      var k = Math.min(1, ct / 0.45);
      if (this.crackX == null) this.crackX = ex;
      b.position.set(u.x * k + this.crackX - ex, 0.004 + Math.max(0, Math.sin(k * Math.PI) * u.up), u.z * k);
      b.rotation.set(-Math.PI / 2 + (1 - k) * u.rot, 0, u.rot);
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
