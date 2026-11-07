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
  /* 割り方: 0=なし 1=底(太い方)を割る 2=とがった方を割る。割った所は平らにつぶれる */
  function shapePt(r0, y0, mode) {
    if (mode === 1 && y0 < FLAT) return [r0 * (0.7 + 0.3 * y0 / FLAT), 0];
    if (mode === 1) return [r0, y0 - FLAT];
    if (mode === 2 && y0 > 1 - FLAT) return [r0 * (0.7 + 0.3 * (1 - y0) / FLAT), 1 - FLAT];
    return [r0, y0];
  }
  global.EggShape = {
    COM: 0.46,  /* 重心の高さ（足もとから） */
    FLAT: FLAT,
    low: function (a, cracked) {
      var c = Math.cos(a), sn = Math.sin(a), low = 1e9;
      for (var j = 0; j <= FN; j++) {
        var sp = shapePt(FINE[j][0], FINE[j][1], cracked || 0), rr = sp[0], y = sp[1];
        var y1 = y * c - rr * sn, y2 = y * c + rr * sn;
        if (y1 < low) low = y1;
        if (y2 < low) low = y2;
      }
      return low;
    }
  };

  function rand(seed) { return Z3.rng(seed); }

  /* 殻の絵（色むら・細かい斑点）。crack なら下の方にひび */
  function shellPaint(crack, top) {
    return function (g, w, h) {
      if (top) { g.translate(0, h); g.scale(1, -1); }   /* とがった方（絵の上側）にひびを描く */
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
        /* 下から上へ伸びる、枝分かれしたひび（立てたときに机の上から見える高さまで） */
        var crackLine = function (x0, y0, len, n, width, depth) {
          g.beginPath(); g.moveTo(x0, y0);
          var x1 = x0, y1 = y0, pts = [];
          for (var s2 = 0; s2 < n; s2++) {
            x1 += (r() - 0.5) * 22; y1 -= len / n * (0.6 + r() * 0.8);
            g.lineTo(x1, y1); pts.push([x1, y1]);
          }
          g.strokeStyle = "rgba(60,40,24,.92)"; g.lineWidth = width; g.stroke();
          g.strokeStyle = "rgba(255,250,240,.55)"; g.lineWidth = width * 0.4;
          g.save(); g.translate(1.2, -1); g.stroke(); g.restore();
          if (depth < 2) for (var q = 0; q < pts.length - 1; q++) if (r() < 0.35) crackLine(pts[q][0], pts[q][1], len * 0.45, 3, width * 0.7, depth + 1);
        };
        g.lineJoin = "round"; g.lineCap = "round";
        for (var k = 0; k < 11; k++) crackLine((k + r() * 0.6) / 11 * w, h - 2, 55 + r() * 45, 6, 2.6, 0);
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
    this.geoCrackedTop = this.geo.clone();
    pos = this.geoCrackedTop.attributes.position;
    for (i = 0; i < pos.count; i++) {
      var yt = pos.getY(i);
      if (yt > 1 - FLAT) { var kt = (1 - yt) / FLAT; pos.setY(i, 1 - FLAT); pos.setX(i, pos.getX(i) * (0.7 + 0.3 * kt)); pos.setZ(i, pos.getZ(i) * (0.7 + 0.3 * kt)); }
    }
    this.geoCrackedTop.computeVertexNormals();
    var bump = Z3.canvasTex(512, 256, bumpPaint);
    this.mapPlain = Z3.canvasTex(512, 256, shellPaint(false));
    this.mapCrack = Z3.canvasTex(512, 256, shellPaint(true));
    this.mapCrackTop = Z3.canvasTex(512, 256, shellPaint(true, true));
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
    this.cracked = 0;

    /* 卵立て（エッグスタンド）。左右の遠くに1つずつ。白い陶器 */
    var cupProf = [[0.0, 0.0], [0.2, 0.0], [0.21, 0.015], [0.19, 0.03], [0.09, 0.07], [0.07, 0.12], [0.09, 0.16], [0.18, 0.22], [0.24, 0.29], [0.26, 0.335], [0.25, 0.345], [0.23, 0.335], [0.21, 0.29], [0.15, 0.23], [0.06, 0.19], [0.0, 0.185]]
      .map(function (p) { return new T.Vector2(Math.max(p[0], 0.0001), p[1]); });
    var porcelain = new T.MeshPhysicalMaterial({ color: 0xf6f3ee, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    this.cups = [];
    var cm = new T.Mesh(new T.LatheGeometry(cupProf, 48), porcelain);
    cm.castShadow = true; cm.receiveShadow = true;
    cm.position.set(6.5, 0, 0); cm.scale.setScalar(1.35); sc.add(cm); this.cups.push(cm);
    this.CUP_SEAT = 0.27;   /* 卵の足もとが座る高さ（右の卵立て） */

    /* 左は塩の山。ざらざらの白い小山（頂上に卵の足もとが刺さる） */
    var saltPts = [], srng = rand(31);
    for (var si = 0; si <= 16; si++) {
      var su = si / 16;                                      /* 0=すそ 1=頂上 */
      saltPts.push(new T.Vector2(Math.max(0.0001, 0.62 * (1 - su)), 0.27 * (1 - Math.pow(1 - su, 1.6)) * (1 - 0.15 * su * su)));
    }
    var saltG = new T.LatheGeometry(saltPts, 48);
    /* すそを少しでこぼこに */
    var sp = saltG.attributes.position;
    for (si = 0; si < sp.count; si++) {
      var syy = sp.getY(si), ang = Math.atan2(sp.getZ(si), sp.getX(si));
      var wob = 1 + (Math.sin(ang * 5 + 1.3) * 0.05 + Math.sin(ang * 9) * 0.03) * (1 - syy / 0.27);
      sp.setX(si, sp.getX(si) * wob); sp.setZ(si, sp.getZ(si) * wob);
    }
    saltG.computeVertexNormals();
    var saltTex = Z3.canvasTex(256, 256, function (g, w, h) {
      var r = rand(41); g.fillStyle = "#e9e6e0"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 5000; i++) { var v = 200 + Math.floor(r() * 55); g.fillStyle = "rgb(" + v + "," + v + "," + (v - 4) + ")"; g.fillRect(r() * w, r() * h, 1.6, 1.6); }
    });
    this.salt = new T.Mesh(saltG, new T.MeshStandardMaterial({ map: saltTex, bumpMap: saltTex, bumpScale: 1.2, roughness: 0.95 }));
    this.salt.position.set(-6.5, 0, 0); this.salt.castShadow = true; this.salt.receiveShadow = true;
    sc.add(this.salt);
    /* 粒の飛び散り */
    this.grains = [];
    var gmat = new T.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.7 });
    var ggeo = new T.BoxGeometry(0.018, 0.018, 0.018);
    for (si = 0; si < 40; si++) {
      var gm2 = new T.Mesh(ggeo, gmat); gm2.visible = false;
      var ga = srng() * Math.PI * 2;
      gm2.userData = { vx: Math.cos(ga) * (0.4 + srng() * 0.8), vz: Math.sin(ga) * (0.3 + srng() * 0.6), vy: 0.8 + srng() * 1.2 };
      sc.add(gm2); this.grains.push(gm2);
    }
    this.SALT_SEAT = 0.19;

    /* 孵化: 殻の下半分・上のかけら・ヒヨコ */
    var cupPts = [], capPts = [];
    PROF.forEach(function (p) { if (p[1] <= 0.6) cupPts.push(new T.Vector2(p[0], p[1])); else capPts.push(new T.Vector2(p[0], p[1] - 0.6)); });
    capPts.unshift(new T.Vector2(PROF.filter(function (p) { return p[1] > 0.6; })[0][0], 0));
    var shellMat2 = new T.MeshPhysicalMaterial({ map: this.mapPlain, roughness: 0.58, side: T.DoubleSide, clearcoat: 0.15 });
    /* 割れ目はギザギザ（まっすぐ切らない）。下の殻と上のかけらで同じ形にする */
    var zr = rand(57), teeth = [];
    for (var zi = 0; zi < 11; zi++) teeth.push(0.03 + zr() * 0.07);
    function zig(ang) {
      var u = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * 11, i0 = Math.floor(u), f = u - i0;
      var tri = f < 0.5 ? f * 2 : (1 - f) * 2;                      /* 0→1→0 の山 */
      return (tri - 0.5) * teeth[i0 % 11] * 2;
    }
    function jag(geo, rowY, tol) {
      var ps = geo.attributes.position;
      for (var k = 0; k < ps.count; k++) {
        if (Math.abs(ps.getY(k) - rowY) > tol) continue;
        ps.setY(k, ps.getY(k) + zig(Math.atan2(ps.getX(k), ps.getZ(k))));
      }
      geo.computeVertexNormals();
      return geo;
    }
    var cupGeo = jag(new T.LatheGeometry(cupPts, 66), cupPts[cupPts.length - 1].y, 0.002);
    var capGeo = jag(new T.LatheGeometry(capPts, 66), 0, 0.002);
    this.cup = new T.Mesh(cupGeo, shellMat2); this.cup.castShadow = true; this.cup.rotation.y = Math.PI;
    this.cap = new T.Mesh(capGeo, shellMat2); this.cap.castShadow = true;
    this.cup.visible = this.cap.visible = false;
    sc.add(this.cup); sc.add(this.cap);
    this.chick = new T.Group();
    var yel = new T.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.9 });
    var body = new T.Mesh(new T.SphereGeometry(0.26, 24, 18), yel); body.scale.set(1, 0.95, 0.95); body.position.y = 0.26;
    var head = new T.Mesh(new T.SphereGeometry(0.17, 20, 16), yel); head.position.set(0, 0.58, 0.03);
    var beak = new T.Mesh(new T.ConeGeometry(0.045, 0.1, 12), new T.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.6 }));
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.57, 0.22);
    var eyeM = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    var e1 = new T.Mesh(new T.SphereGeometry(0.025, 10, 8), eyeM); e1.position.set(-0.07, 0.63, 0.16);
    var e2 = e1.clone(); e2.position.x = 0.07;
    var w1 = new T.Mesh(new T.SphereGeometry(0.1, 12, 10), yel); w1.scale.set(0.4, 0.8, 0.9); w1.position.set(-0.25, 0.3, 0);
    var w2 = w1.clone(); w2.position.x = 0.25;
    [body, head, beak, e1, e2, w1, w2].forEach(function (m) { m.castShadow = true; this.chick.add(m); }, this);
    this.chick.scale.setScalar(0.74);   /* 殻の中に収まる大きさ */
    this.chick.visible = false;
    sc.add(this.chick);
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
    if ((s.cracked || 0) !== this.cracked) {
      this.cracked = s.cracked || 0;
      this.egg.geometry = this.cracked === 1 ? this.geoCracked : this.cracked === 2 ? this.geoCrackedTop : this.geo;
      this.shellMat.map = this.cracked === 1 ? this.mapCrack : this.cracked === 2 ? this.mapCrackTop : this.mapPlain;
      this.shellMat.needsUpdate = true;
      this.skipRoll = true;   /* 形が変わった瞬間に横へずれないように */
    }
    /* 卵は足もとの点で机に乗る。傾けたら、一番低い所が机の面に来るように持ち上げる */
    var c = Math.cos(th), sn = Math.sin(th), low = 1e9, lowX = 0, cLx = 0, cLy = 0;
    for (var j = 0; j <= N; j++) {
      var sp = shapePt(PROF[j][0], PROF[j][1], this.cracked), rr = sp[0], y = sp[1];
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
    if (hs >= 0 && this.hatchShake) this.eggPivot.rotateZ(this.hatchShake);
    /* 転がり: 机に触れている点は滑らないので、殻の上で触れる点が動いた分だけ卵が進む（どこまでも） */
    var tt = s.t || 0, aSigned = tx;
    if (tt < this.prevT || !this.prevC) { this.rollX = lowX * dx; this.prevC = null; this.crackX = null; this.camX = 0; this.skipRoll = false; this.prevEx = null; this.cupFrom = null; }
    if (global.__eggJump != null) { this.rollX = global.__eggJump + lowX * dx; global.__eggJump = null; this.camX = global.__eggJump0 = this.rollX; this.prevC = null; }
    var lx = cLx * dx, ly = cLy;
    var cupK = 0;
    if (s.cup != null && s.cup >= 0) {
      /* 卵立てに入る間は転がって進まない。いまの場所から卵立ての上へ弧を描いて収まる */
      if (this.cupFrom == null) { this.cupFrom = [this.prevEx || 0, 0]; this.cupSide = this.rollX >= 0 ? 1 : -1; this.cupX = this.cupSide * (s.gapX || 6.5); }
      cupK = Math.min(1, s.cup / 0.45);
      cupK = cupK * cupK * (3 - 2 * cupK);
    } else if (this.skipRoll && this.prevEx != null) { this.rollX = this.prevEx + lowX * dx; this.skipRoll = false; }
    else if (this.prevC) {
      var ds = Math.hypot(lx - this.prevC[0], ly - this.prevC[1]);
      /* 割った平らな底の上では触れる点が端から端へ飛ぶだけなので進めない */
      var fy = this.cracked === 2 ? 1 - FLAT : 0;
      var onFace = this.cracked && Math.abs(ly - fy) < 0.002 && Math.abs(this.prevC[1] - fy) < 0.002;
      if (ds < 0.3 && !onFace) this.rollX += ds * (aSigned >= this.prevA ? 1 : -1);
    }
    this.prevC = [lx, ly]; this.prevA = aSigned; this.prevT = tt;
    var ex = this.rollX - lowX * dx;
    this.prevEx = ex; global.__eggX = this.rollX;
    var py = -low - lowX * dx * tp;
    if (cupK > 0) {
      ex = this.cupFrom[0] + (this.cupX - this.cupFrom[0]) * cupK;
      py = py * (1 - cupK) + (this.cupSide > 0 ? this.CUP_SEAT : this.SALT_SEAT) * cupK + Math.sin(cupK * Math.PI) * 0.35;
      this.rollX = ex + lowX * dx;
    } else this.cupFrom = null;
    this.eggPivot.position.set(ex, py, 0);
    /* 塩に刺さった瞬間、粒が飛び散る */
    var gt = (cupK > 0 && this.cupSide < 0) ? s.cup - 0.45 : -1;
    for (var gi2 = 0; gi2 < this.grains.length; gi2++) {
      var gr2 = this.grains[gi2], gu = gr2.userData;
      gr2.visible = gt >= 0;
      if (gt < 0) continue;
      var gtt = Math.min(gt, 0.6);
      gr2.position.set(-6.5 + gu.vx * gtt, Math.max(0.01, 0.2 + gu.vy * gtt - 4.9 * gtt * gtt), gu.vz * gtt);
    }
    /* 温まると、ほんのり赤みが出る */
    var hv = Math.min(1, s.heat || 0);
    this.shellMat.emissive = this.shellMat.emissive || new T.Color();
    this.shellMat.emissive.setRGB(0.22 * hv, 0.07 * hv, 0.01 * hv);
    /* 孵化の流れ: 0〜0.8秒 震える → 割れて上のかけらが飛ぶ → ヒヨコが出て立つ */
    var hs = s.hatch == null ? -1 : s.hatch;
    if (hs >= 0) {
      var shake = hs < 0.9 ? Math.sin(hs * 60) * 0.05 * (hs / 0.9) : 0;
      this.hatchShake = shake;
      var open = hs >= 0.9;
      this.egg.visible = !open;
      this.cup.visible = this.cap.visible = open;
      this.cup.position.set(ex, 0, 0);
      if (open) {
        var k2 = Math.min(1, (hs - 0.9) / 0.5);
        this.cap.position.set(ex + 0.55 * k2, 0.6 * (1 - k2) + Math.sin(k2 * Math.PI) * 0.35 + 0.02 * k2, 0.25 * k2);
        this.cap.rotation.set(0, 0, -2.2 * k2);
        var k3 = Math.min(1, Math.max(0, (hs - 1.2) / 0.6)), ease = 1 - Math.pow(1 - k3, 3);
        this.chick.visible = true;
        /* 殻が割れて、ヒヨコが上に出てくる */
        /* 殻の中（底より下には出ない）から上へ */
        this.chick.position.set(ex, 0.04 + 0.34 * ease, 0.0);
        this.chick.rotation.y = Math.sin(hs * 2) * 0.3;
      }
    } else if (!this.egg.visible || this.chick.visible) {
      this.egg.visible = true; this.cup.visible = this.cap.visible = this.chick.visible = false;
    }
    /* 机は卵についていき、木目だけずらす */
    this.table.position.x = ex;
    this.wood.offset.x = ex / 6;
    this.key.position.x = -2.4 + ex; this.key.target.position.set(ex, 0, 0);
    this.blob.position.set(lowX * 0.3 * dx, 0.002, lowX * 0.3 * dz);
    /* 卵の真ん中を追う（倒れても見切れない） */
    var cm = Math.sin(th) * 0.42;
    this.camX += (ex + cm * dx - this.camX) * (cupK > 0 ? 0.2 : 0.08);
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
