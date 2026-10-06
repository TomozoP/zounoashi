/* おじさんの涙の立体の絵。遊びの計算（涙の位置・ハンカチ）はゲーム側のまま、正面からの平行投影で描くので
   ゲームの座標と画面がぴったり重なる。世界の座標は (x, -y, z)、単位はゲーム座標。
   模型はすべて基本図形から自作。three.js は random-bowling の既存配布物（MIT）を使う。 */
(function (global) {
  "use strict";
  var T;

  function std(color, extra) {
    var o = { color: color, roughness: 0.8 };
    for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }

  /* 顔の凹凸（ゲーム座標の高さ）。u, v は顔の中心からの位置（横幅・縦幅で割った値、v は下が正） */
  function g2(u, v, cu, cv, su, sv) { var a = (u - cu) / su, b = (v - cv) / sv; return Math.exp(-a * a - b * b); }
  function seg(u, v, pts, sx, sy) {
    var best = 1e9;
    for (var i = 0; i + 3 < pts.length; i += 2) {
      var ax = pts[i] * sx, ay = pts[i + 1], bx = pts[i + 2] * sx, by = pts[i + 3];
      var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, k = l ? Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l)) : 0;
      var cx = ax + dx * k - u, cy = ay + dy * k - v, d = cx * cx + cy * cy;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  function groove(u, v, pts, width, depth) {
    var d = Math.min(seg(u, v, pts, 1, 1), seg(u, v, pts, -1, 1));
    return -depth * Math.exp(-(d / width) * (d / width));
  }
  function mouthBox(big) { return big ? { c: 0.56, w: 0.30, t: 0.13, b: 0.17 } : { c: 0.56, w: 0.25, t: 0.08, b: 0.1 }; }
  /* 口の中なら 0〜1（縁に向かって 0） */
  function inMouth(u, v, big) {
    var m = mouthBox(big), du = u / m.w;
    if (Math.abs(du) >= 1) return -1;
    var q = 1 - du * du;
    var top = m.c + 0.03 - m.t * q, bot = m.c + 0.03 + m.b * q;
    if (v < top || v > bot) return -Math.min(Math.abs(v - top), Math.abs(v - bot)) - (1 - Math.sqrt(q)) * 0.1;
    return Math.min(v - top, bot - v, (1 - Math.abs(du)) * m.w);
  }
  /* 輪郭：高さごとの横幅の倍率（こめかみ・ほお骨・ほおのこけ・えら・頭のてっぺん） */
  function e1(v, c, s) { var a = (v - c) / s; return Math.exp(-a * a); }
  function widthAt(v) {
    return 1 + 0.05 * e1(v, -0.02, 0.22) - 0.035 * e1(v, -0.42, 0.12) - 0.05 * e1(v, 0.36, 0.11) + 0.075 * e1(v, 0.66, 0.1) - 0.05 * e1(v, -0.8, 0.18);
  }
  function relief(u, v, big) {
    var au = Math.abs(u), h = 0;
    /* 額と眉の骨 */
    h += 10 * g2(au, v, 0.38, -0.3, 0.3, 0.07) + 6 * g2(u, v, 0, -0.3, 0.2, 0.08);
    /* 目のくぼみと、閉じたまぶたの丸み */
    h += -32 * g2(au, v, 0.42, -0.12, 0.2, 0.1);
    h += 15 * g2(au, v, 0.42, -0.11, 0.14, 0.065);
    h += groove(u, v, [0.24, -0.1, 0.33, -0.075, 0.42, -0.068, 0.51, -0.075, 0.6, -0.1], 0.012, big ? 5 : 4);
    /* 目の下のたるみ */
    h += 5 * g2(au, v, 0.42, -0.01, 0.13, 0.035) + groove(u, v, [0.3, 0.03, 0.42, 0.05, 0.54, 0.03], 0.018, 3);
    /* 目尻のしわ */
    for (var k = 0; k < 3; k++) h += groove(u, v, [0.62, -0.13 + k * 0.035, 0.71, -0.16 + k * 0.05], 0.008, 1.6);
    /* 眉間のしわ（泣いて寄せる） */
    h += groove(u, v, [0.045, -0.26, 0.06, -0.17], 0.012, big ? 4 : 2.5);
    /* 額のしわ */
    for (k = 0; k < 4; k++) {
      var y0 = -0.42 - k * 0.075, bend = big ? 0.05 : 0.03;
      h += groove(u, v, [0, y0 - bend, 0.18, y0 - bend * 0.6, 0.36, y0 + 0.01], 0.012, (big ? 3 : 2) * (1 - k * 0.15));
    }
    /* 鼻 */
    var nb = Math.max(0, Math.min(1, (v + 0.12) / 0.3));
    h += (10 + nb * 34) * Math.exp(-Math.pow(u / (0.06 + nb * 0.04), 2)) * (v > -0.16 && v < 0.2 ? 1 : Math.exp(-Math.pow((v < -0.16 ? v + 0.16 : v - 0.2) / 0.05, 2)));
    h += 38 * g2(u, v, 0, 0.17, 0.1, 0.08);
    h += 18 * g2(au, v, 0.12, 0.215, 0.065, 0.055);
    h += -12 * g2(au, v, 0.065, 0.25, 0.035, 0.022);
    /* ほお骨とほうれい線 */
    h += 16 * g2(au, v, 0.45, 0.14, 0.2, 0.15);
    h += groove(u, v, [0.17, 0.24, 0.24, 0.36, 0.32, 0.5, 0.36, 0.62], 0.025, big ? 7 : 5.5);
    /* 口のまわりの盛り上がり・あご・あごの肉 */
    h += 8 * g2(u, v, 0, 0.5, 0.28, 0.16);
    h += 12 * g2(u, v, 0, 0.86, 0.22, 0.09);
    h += 7 * g2(au, v, 0.48, 0.66, 0.15, 0.12);
    h += groove(u, v, [-0.12, 0.78, 0, 0.8, 0.12, 0.78], 0.02, 3);
    /* 口：唇の縁を盛り上げ、中をへこませる */
    var im = inMouth(u, v, big);
    if (im >= 0) h += -6 - Math.min(1, im / 0.03) * 38;
    else h += 6 * Math.exp(-Math.pow(-im / 0.022, 2));
    return h;
  }

  function ManScene() {
    T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(0, 540, 0, -960, 1, 5000);
    this.camera.position.set(0, 0, 2000);
    this.scene.add(new T.HemisphereLight(0xfff0e0, 0x3a2e26, 0.45));
    var sun = new T.DirectionalLight(0xffeedd, 2.7);
    sun.position.set(-0.8, 0.7, 0.75); this.scene.add(sun);
    var rim = new T.DirectionalLight(0xbcd6ff, 1.4);
    rim.position.set(0.95, 0.25, -0.2); this.scene.add(rim);
    var fill = new T.DirectionalLight(0xffd8c0, 0.5);
    fill.position.set(0.6, -0.2, 1); this.scene.add(fill);
    this.key = ""; this.w = 0; this.h = 0; this.group = null;
    /* 映り込み用のまわりの光（白い箱の部屋に明かりの板） */
    var pm = new T.PMREMGenerator(this.renderer), env = new T.Scene();
    var room = new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: 0x3a3028, side: T.BackSide })); env.add(room);
    [[-3, 3, 2, 3, 2, 0xfff0dd, 6], [3.5, 1, -1, 2, 3, 0xbfd8ff, 3], [0, 4.9, 0, 4, 4, 0xffffff, 2.5], [0, -2, 4.9, 6, 1, 0xffd9b0, 1.2]].forEach(function (l) {
      var m = new T.Mesh(new T.PlaneGeometry(l[3], l[4]), new T.MeshBasicMaterial({ color: new T.Color(l[5]).multiplyScalar(l[6]), side: T.DoubleSide }));
      m.position.set(l[0], l[1], l[2]); m.lookAt(0, 0, 0); env.add(m);
    });
    this.scene.environment = pm.fromScene(env, 0.03).texture;
    this.tearMat = new T.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: 12, ior: 1.33, roughness: 0.02, metalness: 0, attenuationColor: new T.Color(0xc4e6ff), attenuationDistance: 28, envMapIntensity: 1.6, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02 });
    var prof = [];
    for (var i = 0; i <= 18; i++) { var a = i / 18 * Math.PI; prof.push(new T.Vector2(Math.sin(a) * Math.sin(a / 2) * 1.05, Math.cos(a) * 1.45)); }
    this.tearGeo = new T.LatheGeometry(prof, 16);
    this.poolMat = this.tearMat;
    this.dropGeo = new T.SphereGeometry(1, 14, 10);
    this.dropPool = [];
    /* 顔のぬれ具合（涙の通った跡が光る） */
    this.wcv = global.document.createElement("canvas"); this.wcv.width = this.wcv.height = 256;
    var wc = this.wcv.getContext("2d"); wc.fillStyle = "rgb(14,14,14)"; wc.fillRect(0, 0, 256, 256);
    this.wtex = new T.CanvasTexture(this.wcv);
    this.makePost();
    this.tearPool = [];
  }

  /* 頭（楕円の玉）の表面の奥行き */
  ManScene.prototype.surf = function (x, y) {
    var dy = (y - this.FY) / this.RY, dx = (x - this.FX) / (this.RX * widthAt(dy)), q = 1 - dx * dx - dy * dy;
    if (q <= 0) return 0;
    var z = Math.sqrt(q), w = Math.max(0, Math.min(1, (z - 0.05) / 0.35));
    return this.RZ * z + relief(dx, dy, this.big) * this.K * w;
  };
  /* (x, y) のまわり r の範囲でいちばん手前の表面（涙やハンカチを埋めないため） */
  ManScene.prototype.surfMax = function (x, y, r) {
    var m = 0;
    for (var i = -2; i <= 2; i++) for (var j = -2; j <= 2; j++) m = Math.max(m, this.surf(x + i * r / 2, y + j * r / 2));
    return m;
  };
  ManScene.prototype.P = function (x, y, off) { return new T.Vector3(x, -y, this.surf(x, y) + (off || 0)); };
  ManScene.prototype.tube = function (pts, r, mat, off, parent) {
    var self = this;
    var curve = new T.CatmullRomCurve3(pts.map(function (p) { return self.P(p[0], p[1], off); }));
    var m = new T.Mesh(new T.TubeGeometry(curve, 28, r, 8, false), mat);
    (parent || this.group).add(m);
    [0, 1].forEach(function (k) {
      var cap = new T.Mesh(new T.SphereGeometry(r, 10, 8), mat);
      cap.position.copy(curve.getPoint(k)); m.add(cap);
    });
    return m;
  };
  function qpts(x0, y0, cx, cy, x1, y1, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
    }
    return out;
  }
  function ball(mat, sx, sy, sz, x, y, z, parent) {
    var m = new T.Mesh(new T.SphereGeometry(1, 32, 22), mat);
    m.scale.set(sx, sy, sz); m.position.set(x, -y, z); parent.add(m); return m;
  }
  function flat(shape, mat, z, parent) {
    var m = new T.Mesh(new T.ShapeGeometry(shape, 16), mat);
    m.position.z = z; parent.add(m); return m;
  }
  /* ゲーム座標の点列を、世界の向き（yを反転）の形にする */
  function shapeOf(pts) {
    var s = new T.Shape();
    pts.forEach(function (p, i) { if (i) s.lineTo(p[0], -p[1]); else s.moveTo(p[0], -p[1]); });
    s.closePath();
    return s;
  }

  ManScene.prototype.build = function (g) {
    var key = [g.W, g.H, g.FX, g.FY, g.RX, g.RY].join(",");
    if (key === this.key) return;
    this.key = key;
    if (this.group) { this.scene.remove(this.group); this.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    var G = this.group = new T.Group();
    this.scene.add(G);
    var FX = this.FX = g.FX, FY = this.FY = g.FY, RX = this.RX = g.RX, RY = this.RY = g.RY, RZ = this.RZ = 175 * g.RX / 188, K = this.K = g.RX / 188;
    var H = g.H, self = this;

    /* 奥の壁（ぼけた部屋の明かり） */
    var wall = new T.Mesh(new T.PlaneGeometry(g.W, H), new T.MeshBasicMaterial({ map: this.paintWall(g.W, H) }));
    wall.position.set(g.W / 2, -H / 2, -800); G.add(wall);
    /* 体（肩・胸・腕と、白いタンクトップ）。上から見た輪を回して作り、前側を胸やお腹の分だけ押し出す */
    /* 体は顔の大きさに合わせて広げる（首の付け根を中心に K 倍） */
    var top = FY + RY * 0.82, BW = g.W, BH = H;
    var GBo = new T.Group(); GBo.position.set(FX, -top, 0); GBo.scale.set(K, K, K); G.add(GBo);
    var GB = new T.Group(); GB.position.set(-FX, top, 0); GBo.add(GB);
    var bodyTex = this.paintBody(BW, BH, FX, top);
    var bodySkin = new T.MeshPhysicalMaterial({ map: bodyTex.color, bumpMap: bodyTex.bump, bumpScale: 1.2, roughness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.4, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new T.Color(0xff9a80), envMapIntensity: 0.6 });
    /* 胸・お腹の盛り上がり（rel は首の付け根からの下向きの距離） */
    function bodyRelief(dx, rel) {
      var ax = Math.abs(dx);
      var h = 16 * Math.exp(-Math.pow((ax - 85) / 70, 2) - Math.pow((rel - 205) / 55, 2));      /* 胸 */
      h -= 4 * Math.exp(-Math.pow(dx / 14, 2) - Math.pow((rel - 200) / 70, 2));                  /* みぞおち */
      h += 34 * Math.exp(-Math.pow(dx / 170, 2) - Math.pow((rel - 420) / 140, 2));              /* お腹 */
      h += 5 * Math.exp(-Math.pow((rel - 92 - Math.pow((ax - 60) / 90, 2) * 14) / 8, 2)) * (ax > 25 && ax < 175 ? 1 : 0);  /* 鎖骨 */
      h -= 6 * Math.exp(-Math.pow(dx / 18, 2) - Math.pow((rel - 105) / 14, 2));                  /* 鎖骨の間のくぼみ */
      return h;
    }
    function bodyGeo(prof, sz, z0, extra) {
      var geo = new T.LatheGeometry(prof.map(function (p) { return new T.Vector2(p[0], -p[1]); }), 96, -Math.PI / 2, Math.PI * 2);
      var p = geo.attributes.position, uv = geo.attributes.uv;
      for (var i = 0; i < p.count; i++) {
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i) * sz;
        var rel = -y, fr = Math.max(0, z) / (sz * 260);
        z += z0 + (z > 0 ? (bodyRelief(x, rel) + (extra || 0)) * Math.min(1, fr * 2.5) : 0);
        p.setXYZ(i, FX + x, -(top + rel), z);
        uv.setXY(i, (FX + x) / BW, 1 - (top + rel) / BH);
      }
      geo.computeVertexNormals();
      return geo;
    }
    var prof = [[0, -10], [96, -10], [104, 30], [150, 56], [212, 78], [252, 112], [266, 160], [262, 220], [244, 280], [242, 330], [252, 430], [256, H - top + 40], [0, H - top + 40]];
    GB.add(new T.Mesh(bodyGeo(prof, 0.55, -150), bodySkin));
    /* 首（体と同じ肌） */
    var neck = new T.Mesh(bodyGeo([[0, -170], [96, -170], [100, -40], [104, 20], [0, 20]], 0.72, -140), bodySkin); GB.add(neck);
    /* 腕 */
    [-1, 1].forEach(function (s) {
      var arm = new T.Mesh(new T.CylinderGeometry(58, 48, 560, 40, 8), bodySkin);
      arm.position.set(FX + s * 262, -(top + 470), -175); arm.rotation.z = s * 0.05; GB.add(arm);
      ball(bodySkin, 60, 74, 60, FX + s * 256, top + 196, -175, GB);
    });
    /* タンクトップ（白いリブ編み）。体に沿わせて少し外に出し、首まわりと袖ぐりは絵で抜く */
    var tank = this.paintTank(BW, BH, FX, top);
    var tankM = new T.MeshPhysicalMaterial({ color: 0xe6e2d8, map: tank.color, alphaMap: tank.alpha, alphaTest: 0.5, bumpMap: tank.bump, bumpScale: 2.2, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new T.Color(0xffffff), side: T.DoubleSide });
    GB.add(new T.Mesh(bodyGeo([[0, 18], [104, 18], [112, 32], [152, 56], [214, 80], [255, 114], [269, 162], [265, 222], [247, 282], [245, 332], [256, 432], [260, H - top + 40], [0, H - top + 40]], 0.55, -146, 3), tankM));

    /* 頭。玉を顔の凹凸の分だけ押し出し・へこませて作る（ふつう・号泣の2つ） */
    var head = this.head = new T.Group(); G.add(head);
    var earM = std(0xdca084, { roughness: 0.6 });
    [-1, 1].forEach(function (s) {
      var ex = FX + s * (RX * widthAt(0.0) - 10 * K);
      var ear = ball(earM, 20 * K, 44 * K, 18 * K, ex, FY + 4, -20 * K, head); ear.rotation.y = s * 0.5;
      ball(std(0xb87a64, { roughness: 0.7 }), 10 * K, 30 * K, 8 * K, ex + s * 4 * K, FY + 2, -8 * K, head).rotation.y = s * 0.5;
    });
    this.faces = [false, true].map(function (big) {
      var tex = self.paintSkin(big);
      var mat = new T.MeshPhysicalMaterial({ map: tex.color, bumpMap: tex.bump, bumpScale: 1.4, roughness: 0.5, clearcoat: 1, clearcoatMap: self.wtex, clearcoatRoughness: 0.12, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new T.Color(0xff9a80), envMapIntensity: 0.6 });
      var geo = new T.SphereGeometry(1, 180, 140);
      var p = geo.attributes.position, uv = geo.attributes.uv;
      for (var i = 0; i < p.count; i++) {
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = x, v = -y;
        var w = Math.max(0, Math.min(1, (z - 0.05) / 0.35));
        p.setXYZ(i, FX + x * RX * widthAt(v), -(FY + v * RY), z * RZ + (w > 0 ? relief(u, v, big) * K * w : 0));
        uv.setXY(i, (u + 1) / 2, 1 - (v + 1) / 2);
      }
      geo.computeVertexNormals();
      var m = new T.Mesh(geo, mat); head.add(m);
      return m;
    });
    this.big = false;
    /* 目にたまる涙 */
    this.pools = [];
    [-1, 1].forEach(function (s) {
      var ex = FX + s * RX * 0.42, ey = FY - RY * 0.043;
      self.pools.push(ball(self.poolMat, 28 * K, 3 * K, 2.5 * K, ex, ey, self.surf(ex, ey) + 1, head));
    });

    /* ハンカチ（布に格子とシミの絵を貼る） */
    this.hcv = global.document.createElement("canvas"); this.hcv.width = this.hcv.height = 128;
    this.htex = new T.CanvasTexture(this.hcv); this.htex.colorSpace = T.SRGBColorSpace;
    var hgeo = new T.PlaneGeometry(108, 108, 10, 10);
    this.hbase = hgeo.attributes.position.array.slice();
    this.hanky = new T.Mesh(hgeo, new T.MeshStandardMaterial({ map: this.htex, roughness: 0.95, side: T.DoubleSide }));
    this.hanky.visible = false; this.scene.add(this.hanky);
    this.hwet = -1;
  };

  /* 肌の絵（色と、毛穴の凹凸）。顔の正面に平らに貼る */
  ManScene.prototype.paintSkin = function (big) {
    var S = 1024, doc = global.document;
    var cv = doc.createElement("canvas"); cv.width = cv.height = S;
    var c = cv.getContext("2d");
    var bv = doc.createElement("canvas"); bv.width = bv.height = S;
    var b = bv.getContext("2d");
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function X(u) { return (u + 1) / 2 * S; }
    function Y(v) { return (v + 1) / 2 * S; }
    function blob(u, v, ru, rv, col, a) {
      c.save(); c.translate(X(u), Y(v)); c.scale(ru, rv);
      var g = c.createRadialGradient(0, 0, 0, 0, 0, S / 2);
      g.addColorStop(0, "rgba(" + col + "," + a + ")"); g.addColorStop(1, "rgba(" + col + ",0)");
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, S / 2, 0, Math.PI * 2); c.fill(); c.restore();
    }
    c.fillStyle = "#dfa98a"; c.fillRect(0, 0, S, S);
    var i, u, v;
    for (i = 0; i < 260; i++) blob(rnd() * 2 - 1, rnd() * 2 - 1, 0.05 + rnd() * 0.1, 0.05 + rnd() * 0.1, rnd() < 0.5 ? "196,130,100" : "240,190,160", 0.18);
    /* 赤み：鼻・ほお・泣きはらしたまぶた */
    blob(0, 0.17, 0.13, 0.1, "205,95,85", 0.55);
    blob(0.13, 0.22, 0.06, 0.05, "205,95,85", 0.4); blob(-0.13, 0.22, 0.06, 0.05, "205,95,85", 0.4);
    [-1, 1].forEach(function (s) {
      blob(s * 0.45, 0.16, 0.2, 0.13, "210,105,95", big ? 0.42 : 0.32);
      blob(s * 0.42, -0.1, 0.17, 0.08, "200,90,85", big ? 0.55 : 0.45);
      blob(s * 0.42, 0.02, 0.13, 0.04, "150,95,95", 0.25);
    });
    blob(0, -0.55, 0.5, 0.25, "240,200,175", 0.25);
    /* 頭の横の髪（白髪まじり） */
    function hairStroke(x, y, ang, len, col, w) {
      c.strokeStyle = col; c.lineWidth = w;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
    }
    c.lineCap = "round";
    for (i = 0; i < 2600; i++) {
      var s = rnd() < 0.5 ? -1 : 1;
      v = -0.6 + rnd() * 0.75; u = s * (0.8 + rnd() * 0.2 - Math.max(0, -v - 0.3) * 0.25);
      if (u * u + v * v > 1) continue;
      hairStroke(X(u), Y(v), Math.PI / 2 + s * (0.9 + rnd() * 0.3), 10 + rnd() * 14, rnd() < 0.3 ? "rgba(170,165,160,.8)" : "rgba(55,48,44,.8)", 1.4);
    }
    /* 眉（内側が上がった、泣き顔の眉） */
    var lift = big ? 0.06 : 0.03;
    [-1, 1].forEach(function (s) {
      for (var k = 0; k < 700; k++) {
        var t = rnd();
        var cu = 0.16 + t * 0.52, cvv = -0.27 - lift * (1 - t) * (1 - t) * 2 + t * t * 0.07 - t * 0.01;
        var thick = 0.035 * (1 - t * 0.5);
        var x = X(s * cu + (rnd() - 0.5) * 0.02), y = Y(cvv + (rnd() - 0.5) * thick);
        var ang = s > 0 ? -0.35 + t * 0.6 : Math.PI + 0.35 - t * 0.6;
        hairStroke(x, y, ang + (rnd() - 0.5) * 0.4, 8 + rnd() * 10, rnd() < 0.2 ? "rgba(140,130,122,.9)" : "rgba(42,36,33,.85)", 1.6);
      }
    });
    /* 閉じた目の線とまつげ */
    [-1, 1].forEach(function (s) {
      c.strokeStyle = "rgba(70,40,35,.9)"; c.lineWidth = 3;
      c.beginPath();
      var pts = [[0.24, -0.1], [0.33, -0.075], [0.42, -0.068], [0.51, -0.075], [0.6, -0.1]];
      pts.forEach(function (p, j) { if (j) c.lineTo(X(s * p[0]), Y(p[1])); else c.moveTo(X(s * p[0]), Y(p[1])); });
      c.stroke();
      for (var k = 0; k < 40; k++) {
        var t = 0.08 + k / 40 * 0.84, pu = 0.24 + t * 0.36, pv = -0.1 + Math.sin(t * Math.PI) * 0.032;
        hairStroke(X(s * pu), Y(pv), Math.PI / 2 + s * (t - 0.5) * 0.8, 7 + rnd() * 4, "rgba(35,28,26,.85)", 1.3);
      }
    });
    /* 口ひげと、無精ひげ */
    for (i = 0; i < 1400; i++) {
      u = (rnd() * 2 - 1) * 0.27; v = 0.355 + rnd() * 0.08 + Math.abs(u) * 0.25;
      if (Math.abs(u) < 0.03 && rnd() < 0.7) continue;
      hairStroke(X(u), Y(v), Math.PI / 2 + u * 2.2, 9 + rnd() * 8, rnd() < 0.25 ? "rgba(150,142,135,.85)" : "rgba(45,40,37,.85)", 1.6);
    }
    c.fillStyle = "rgba(60,55,52,.32)";
    for (i = 0; i < 16000; i++) {
      u = rnd() * 2 - 1; v = 0.2 + rnd() * 0.8;
      var au = Math.abs(u);
      if (u * u + v * v > 0.97) continue;
      if (v < 0.5 && au < 0.32 + (v - 0.2) * 0.4) continue;
      if (inMouth(u, v, big) > -0.04) continue;
      c.fillRect(X(u), Y(v), 1.6, 1.6);
    }
    /* 唇と口の中（升目ごとに塗る） */
    var m = mouthBox(big), x0 = Math.floor(X(-m.w - 0.06)), x1 = Math.ceil(X(m.w + 0.06)), y0 = Math.floor(Y(m.c - m.t - 0.06)), y1 = Math.ceil(Y(m.c + m.b + 0.1));
    var img = c.getImageData(x0, y0, x1 - x0, y1 - y0), d = img.data;
    for (var py = y0; py < y1; py++) for (var px = x0; px < x1; px++) {
      u = px / S * 2 - 1; v = py / S * 2 - 1;
      var im = inMouth(u, v, big), o = ((py - y0) * (x1 - x0) + (px - x0)) * 4, col = null, a = 1;
      if (im >= 0) {
        var top = m.c + 0.03 - m.t * (1 - Math.pow(u / m.w, 2));
        var dk = Math.min(1, im / 0.05);
        col = [90 - dk * 60, 25 - dk * 15, 25 - dk * 15];
        if (v - top < 0.028 && Math.abs(u) < m.w * 0.55) col = [222, 212, 190];
        var tg = Math.pow(u / (m.w * 0.55), 2) + Math.pow((v - (m.c + 0.03 + m.b * 0.75)) / 0.05, 2);
        if (tg < 1) col = [170, 72, 78];
      } else if (im > -0.03) { col = [170, 92, 86]; a = Math.min(1, (0.03 + im) / 0.012); }
      if (col) { d[o] = d[o] * (1 - a) + col[0] * a; d[o + 1] = d[o + 1] * (1 - a) + col[1] * a; d[o + 2] = d[o + 2] * (1 - a) + col[2] * a; }
    }
    c.putImageData(img, x0, y0);
    /* 毛穴 */
    b.fillStyle = "#808080"; b.fillRect(0, 0, S, S);
    for (i = 0; i < 60000; i++) {
      b.fillStyle = rnd() < 0.5 ? "rgba(60,60,60,.5)" : "rgba(200,200,200,.35)";
      b.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
    }
    var ct = new T.CanvasTexture(cv); ct.colorSpace = T.SRGBColorSpace; ct.anisotropy = 4;
    var bt = new T.CanvasTexture(bv);
    return { color: ct, bump: bt };
  };

  ManScene.prototype.paintHanky = function (wet) {
    var n = Math.min(14, Math.floor(wet / 1.5));
    if (n === this.hwet) return;
    this.hwet = n;
    var c = this.hcv.getContext("2d");
    c.fillStyle = "#fdfdfb"; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = "#5b8fd8"; c.lineWidth = 7; c.strokeRect(10, 10, 108, 108);
    c.lineWidth = 2.5;
    for (var k = 1; k <= 3; k++) {
      c.beginPath(); c.moveTo(10 + k * 27, 10); c.lineTo(10 + k * 27, 118); c.stroke();
      c.beginPath(); c.moveTo(10, 10 + k * 27); c.lineTo(118, 10 + k * 27); c.stroke();
    }
    c.fillStyle = "rgba(70,130,200,.24)";
    for (var i = 0; i < n; i++) { c.beginPath(); c.ellipse(64 + Math.sin(i * 2.4) * 36, 64 + Math.cos(i * 1.7) * 36, 17 + (i % 3) * 6, 13 + (i % 2) * 7, 0, 0, Math.PI * 2); c.fill(); }
    this.htex.needsUpdate = true;
  };

  /* 毎コマの動き */
  ManScene.prototype.pose = function (s) {
    var shake = s.burst ? Math.sin(s.T * 47) * 2.5 : Math.sin(s.T * 9) * 0.8;
    this.head.position.x = shake;
    this.big = !!s.burst;
    this.faces[0].visible = !this.big; this.faces[1].visible = this.big;
    var K = this.K; this.pools.forEach(function (p) { p.scale.y = (s.burst ? 4.5 : 3) * K; });
    /* 涙 */
    var self = this, pool = this.tearPool;
    while (pool.length < s.tears.length) { var m = new T.Mesh(this.tearGeo, this.tearMat); this.scene.add(m); pool.push(m); }
    pool.forEach(function (m, i) {
      var t = s.tears[i];
      if (!t) { m.visible = false; return; }
      var r = 8 + t.vol * 9;
      m.visible = true;
      m.scale.set(r * 0.85, r * 0.95, t.onFace ? r * 0.45 : r * 0.8);
      m.position.set(t.x + (t.onFace ? shake : 0), -t.y, (t.onFace ? self.surfMax(t.x, t.y, r) + r * 0.5 : Math.max(self.RZ * 0.9, self.surfMax(t.x, t.y, r) + r)));
    });
    /* しぶき */
    var dp = this.dropPool;
    while (dp.length < s.drops.length) { var d = new T.Mesh(this.dropGeo, this.tearMat); this.scene.add(d); dp.push(d); }
    dp.forEach(function (m, i) {
      var d = s.drops[i];
      if (!d) { m.visible = false; return; }
      m.visible = true; var r = d.r || 4;
      m.scale.set(r, r * (1 + Math.min(1.2, Math.abs(d.vy) / 500)), r);
      m.position.set(d.x, -d.y, 150);
    });
    /* 涙の通った跡をぬらす（だんだん乾く） */
    var wc = this.wcv.getContext("2d");
    this.dryT = (this.dryT || 0) + (s.dt || 0);
    if (this.dryT > 0.1) { wc.fillStyle = "rgba(14,14,14," + Math.min(1, this.dryT * 0.25) + ")"; wc.fillRect(0, 0, 256, 256); this.dryT = 0; }
    wc.fillStyle = "rgba(255,255,255,.5)";
    s.tears.forEach(function (t) {
      if (!t.onFace) return;
      var v = (t.y - self.FY) / self.RY, u = (t.x - self.FX) / (self.RX * widthAt(v));
      wc.beginPath(); wc.arc((u + 1) / 2 * 256, (v + 1) / 2 * 256, 2.6 + t.vol * 2.5, 0, Math.PI * 2); wc.fill();
    });
    this.wtex.needsUpdate = true;
    this.water = { level: s.level, rip: s.ripples || [], T: s.T };
    /* ハンカチ */
    var h = this.hanky;
    h.visible = !!s.held;
    if (s.held) {
      this.paintHanky(s.wet);
      var z = Math.max(this.surfMax(s.hx, s.hy, 60), 60) + 34;
      h.position.set(s.hx, -s.hy, z);
      h.rotation.set(-0.15, 0.1, 0.2 - Math.sin(s.T * 6) * 0.05);
      var a = h.geometry.attributes.position, b = this.hbase;
      for (var i = 0; i < a.count; i++) {
        var x = b[i * 3], y = b[i * 3 + 1];
        a.array[i * 3 + 2] = Math.sin(x * 0.05 + s.T * 5) * 4 + Math.cos(y * 0.06 + s.T * 4) * 3 - (x * x + y * y) * 0.004;
      }
      a.needsUpdate = true;
      h.geometry.computeVertexNormals();
    }
  };

  ManScene.prototype.render = function (ctx, W, H) {
    var dpr = Math.min(1.5, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (!(w >= 2 && h >= 2)) return false;
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.rt.setSize(w, h);
      this.w = w; this.h = h;
      this.camera.left = 0; this.camera.right = W; this.camera.top = 0; this.camera.bottom = -H;
      this.camera.updateProjectionMatrix();
    }
    var u = this.post.material.uniforms, wt = this.water || { level: H, rip: [], T: 0 };
    u.uSize.value.set(W, H); u.uLevel.value = wt.level; u.uTime.value = wt.T;
    for (var i = 0; i < 12; i++) {
      var r = wt.rip[wt.rip.length - 1 - i];
      u.uRip.value[i].set(r ? r.x : 0, r ? wt.T - r.t : 0, r ? r.a : 0, 0);
    }
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  /* 水の絵：描いた場面を、水面より下だけ揺らして屈折させ、色を吸わせ、光の網目と水面の照り返しを足す */
  ManScene.prototype.makePost = function () {
    this.rt = new T.WebGLRenderTarget(2, 2, { samples: 4, type: T.HalfFloatType });
    var rips = []; for (var i = 0; i < 12; i++) rips.push(new T.Vector4());
    var mat = new T.ShaderMaterial({
      uniforms: { tScene: { value: this.rt.texture }, uSize: { value: new T.Vector2(540, 960) }, uLevel: { value: 2000 }, uTime: { value: 0 }, uRip: { value: rips } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: [
        "uniform sampler2D tScene; uniform vec2 uSize; uniform float uLevel; uniform float uTime; uniform vec4 uRip[12];",
        "varying vec2 vUv;",
        "vec4 S(vec2 p){ return texture2D(tScene, vec2(p.x / uSize.x, 1.0 - p.y / uSize.y)); }",
        "float ripple(vec2 p, out vec2 g){",
        "  float h = 0.0; g = vec2(0.0);",
        "  for (int i = 0; i < 12; i++) { vec4 r = uRip[i]; if (r.z <= 0.0) continue;",
        "    float dx = p.x - r.x, d = abs(dx), front = r.y * 150.0, k = 0.13;",
        "    float env = r.z * exp(-r.y * 1.6) * exp(-pow((d - front) / 40.0, 2.0));",
        "    h += env * sin((d - front) * k); g.x += env * cos((d - front) * k) * sign(dx); }",
        "  return h; }",
        "float caus(vec2 q, float t){",
        "  vec2 a = q + vec2(sin(q.y * 1.7 + t * 0.9), cos(q.x * 1.3 - t * 0.7)) * 0.7;",
        "  vec2 b = q * 1.63 + vec2(cos(q.y * 2.1 - t * 1.1), sin(q.x * 1.9 + t * 0.8)) * 0.6;",
        "  float v1 = abs(sin(a.x) * sin(a.y)), v2 = abs(sin(b.x + 1.3) * sin(b.y + 0.7));",
        "  return pow(1.0 - v1, 9.0) * 0.6 + pow(1.0 - v2, 12.0) * 0.5; }",
        "void main(){",
        "  vec2 p = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);",
        "  vec2 g; float rp = ripple(p, g);",
        "  float h = uLevel + sin(p.x * 0.021 + uTime * 1.7) * 2.0 + sin(p.x * 0.053 - uTime * 2.3) * 1.1 + rp;",
        "  float d = p.y - h;",
        "  vec3 c;",
        "  if (d < 0.0) {",
        "    c = S(p).rgb;",
        "    c *= 1.0 - 0.25 * exp(-pow((d + 1.5) / 1.2, 2.0));",
        "  } else {",
        "    float dd = d;",
        "    vec2 n = vec2(sin(p.y * 0.05 + uTime * 1.3 + p.x * 0.02) + sin(p.x * 0.031 - uTime * 1.1),",
        "                  cos(p.x * 0.043 + uTime * 1.5) + sin(p.y * 0.037 - uTime * 0.9));",
        "    n += g * 0.35;",
        "    vec2 off = n * (1.6 + min(dd, 140.0) * 0.035);",
        "    c = S(p + off).rgb;",
        "    float band = 1.0 - smoothstep(0.0, 18.0, dd);",
        "    vec3 mir = S(vec2(p.x + off.x * 2.0, h + 36.0 - dd)).rgb;",
        "    c = mix(c, mir * 1.15 + vec3(0.04, 0.06, 0.07), band * 0.6);",
        "    vec3 ab = exp(-(dd + 25.0) * vec3(0.0045, 0.0018, 0.0012));",
        "    c = c * ab + vec3(0.05, 0.24, 0.28) * (1.0 - ab);",
        "    c += vec3(0.7, 0.9, 1.0) * caus(p * 0.024 + n * 0.08, uTime * 0.9) * 0.16 * exp(-dd * 0.004);",
        "    c += vec3(1.0) * exp(-pow(d / 1.3, 2.0)) * 0.55;",
        "    c += vec3(0.6, 0.8, 0.9) * exp(-dd / 5.0) * 0.08;",
        "  }",
        "  gl_FragColor = vec4(c, 1.0);",
        "  #include <colorspace_fragment>",
        "}"
      ].join("\n"),
      depthTest: false, depthWrite: false
    });
    this.post = new T.Mesh(new T.PlaneGeometry(2, 2), mat);
    this.postScene = new T.Scene(); this.postScene.add(this.post);
    this.postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  };

  /* 体の肌の絵（ゲーム座標そのままの向きで貼る） */
  ManScene.prototype.paintBody = function (W, H, FX, top) {
    var S = 2, doc = global.document;
    var cv = doc.createElement("canvas"); cv.width = W * S / 2; cv.height = H * S / 2;
    var c = cv.getContext("2d"), k = S / 2;
    var bv = doc.createElement("canvas"); bv.width = cv.width; bv.height = cv.height;
    var b = bv.getContext("2d");
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    c.fillStyle = "#d9a283"; c.fillRect(0, 0, cv.width, cv.height);
    var i;
    for (i = 0; i < 160; i++) {
      var x = rnd() * cv.width, y = rnd() * cv.height, r = 20 + rnd() * 60;
      var g = c.createRadialGradient(x, y, 0, x, y, r);
      var col = rnd() < 0.5 ? "190,125,98" : "236,185,155";
      g.addColorStop(0, "rgba(" + col + ",.22)"); g.addColorStop(1, "rgba(" + col + ",0)");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    /* 首と胸の上の日焼け・赤み */
    var g2 = c.createRadialGradient(FX * k, (top + 60) * k, 0, FX * k, (top + 60) * k, 160 * k);
    g2.addColorStop(0, "rgba(200,105,85,.28)"); g2.addColorStop(1, "rgba(200,105,85,0)");
    c.fillStyle = g2; c.fillRect(0, 0, cv.width, cv.height);
    /* 胸毛と腕の毛（まばら） */
    c.lineCap = "round";
    for (i = 0; i < 1300; i++) {
      var hx = FX + (rnd() - 0.5) * 2 * 120 * Math.pow(rnd(), 0.6), hy = top + 120 + rnd() * 160;
      c.strokeStyle = rnd() < 0.35 ? "rgba(150,140,132,.75)" : "rgba(50,42,38,.7)"; c.lineWidth = 1.1;
      var a = Math.PI / 2 + (hx - FX) * 0.006 + (rnd() - 0.5) * 1.6, l = 5 + rnd() * 7;
      c.beginPath(); c.moveTo(hx * k, hy * k); c.quadraticCurveTo((hx + Math.cos(a) * l * 0.5 + 2) * k, (hy + Math.sin(a) * l * 0.5) * k, (hx + Math.cos(a) * l) * k, (hy + Math.sin(a) * l) * k); c.stroke();
    }
    for (i = 0; i < 900; i++) {
      var s = rnd() < 0.5 ? -1 : 1, ax = FX + s * (215 + rnd() * 110), ay = top + 180 + rnd() * 600;
      c.strokeStyle = "rgba(60,50,45,.45)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(ax * k, ay * k); c.lineTo((ax + s * 2) * k, (ay + 6) * k); c.stroke();
    }
    /* ほくろ */
    c.fillStyle = "rgba(80,50,40,.8)";
    [[FX - 60, top + 170], [FX + 140, top + 260], [FX + 40, top + 330]].forEach(function (p) { c.beginPath(); c.arc(p[0] * k, p[1] * k, 2.2, 0, Math.PI * 2); c.fill(); });
    b.fillStyle = "#808080"; b.fillRect(0, 0, bv.width, bv.height);
    for (i = 0; i < 40000; i++) { b.fillStyle = rnd() < 0.5 ? "rgba(60,60,60,.45)" : "rgba(200,200,200,.3)"; b.fillRect(rnd() * bv.width, rnd() * bv.height, 1.4, 1.4); }
    var ct = new T.CanvasTexture(cv); ct.colorSpace = T.SRGBColorSpace;
    return { color: ct, bump: new T.CanvasTexture(bv) };
  };

  /* タンクトップの形（首まわりのU字と袖ぐり）、リブ編みの縦すじ、少しの黄ばみ */
  ManScene.prototype.paintTank = function (W, H, FX, top) {
    var doc = global.document, w = W, h = H;
    function cvs() { var c = doc.createElement("canvas"); c.width = w; c.height = h; return c; }
    var av = cvs(), a = av.getContext("2d"), cv = cvs(), c = cv.getContext("2d"), bv = cvs(), b = bv.getContext("2d");
    var img = a.createImageData(w, h), d = img.data;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dx = Math.abs(x - FX), rel = y - top, on = rel > 22;
      if (dx < 88 && rel < 70 + 125 * Math.sqrt(Math.max(0, 1 - Math.pow(dx / 88, 2)))) on = false;      /* 首まわり */
      var edge = rel < 80 ? 140 : rel < 270 ? 140 + 110 * Math.pow((rel - 80) / 190, 2.2) : 400;
      if (dx > edge) on = false;                                                                           /* 袖ぐり */
      var o = (y * w + x) * 4; d[o] = d[o + 1] = d[o + 2] = on ? 255 : 0; d[o + 3] = 255;
    }
    a.putImageData(img, 0, 0);
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, w, h);
    var g = c.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, "rgba(235,225,200,.0)"); g.addColorStop(1, "rgba(225,212,180,.35)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    b.fillStyle = "#808080"; b.fillRect(0, 0, w, h);
    for (var xx = 0; xx < w; xx += 4) { b.fillStyle = "rgba(255,255,255,.55)"; b.fillRect(xx, 0, 2, h); }
    /* 縁の縫い目 */
    c.strokeStyle = "rgba(200,195,185,.9)"; c.lineWidth = 3;
    var tex = function (cvx, color) { var t = new T.CanvasTexture(cvx); if (color) t.colorSpace = T.SRGBColorSpace; return t; };
    return { alpha: tex(av), color: tex(cv, true), bump: tex(bv) };
  };

  /* 奥の壁：薄暗い部屋に、ぼけた明かり */
  ManScene.prototype.paintWall = function (W, H) {
    var cv = global.document.createElement("canvas"); cv.width = 512; cv.height = Math.round(512 * H / W);
    var c = cv.getContext("2d"), w = cv.width, h = cv.height;
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#5a4a3c"); g.addColorStop(0.5, "#3e332b"); g.addColorStop(1, "#211b17");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    var seed = 3;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (var i = 0; i < 22; i++) {
      var x = rnd() * w, y = rnd() * h * 0.6, r = 20 + rnd() * 60;
      var rg = c.createRadialGradient(x, y, 0, x, y, r);
      var col = rnd() < 0.7 ? "255,200,140" : "200,220,255";
      rg.addColorStop(0, "rgba(" + col + "," + (0.18 + rnd() * 0.2) + ")"); rg.addColorStop(0.7, "rgba(" + col + ",0.06)"); rg.addColorStop(1, "rgba(" + col + ",0)");
      c.fillStyle = rg; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    var vg = c.createRadialGradient(w / 2, h * 0.4, w * 0.2, w / 2, h * 0.5, h * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
    var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    return t;
  };

  global.ManScene = ManScene;
})(window);
