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
    this.scene.add(new T.HemisphereLight(0xfff4e6, 0x5b4a3e, 0.9));
    var sun = new T.DirectionalLight(0xfff2e4, 2.6);
    sun.position.set(-0.85, 0.75, 0.7); this.scene.add(sun);
    var rim = new T.DirectionalLight(0xcfe6ff, 0.7);
    rim.position.set(0.9, 0.1, 0.5); this.scene.add(rim);
    this.key = ""; this.w = 0; this.h = 0; this.group = null;
    this.tearMat = new T.MeshStandardMaterial({ color: 0x8fd2ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, emissive: 0x1b4d77, emissiveIntensity: 0.35 });
    var prof = [];
    for (var i = 0; i <= 18; i++) { var a = i / 18 * Math.PI; prof.push(new T.Vector2(Math.sin(a) * Math.sin(a / 2) * 1.05, Math.cos(a) * 1.45)); }
    this.tearGeo = new T.LatheGeometry(prof, 16);
    this.poolMat = new T.MeshStandardMaterial({ color: 0xcfeaff, roughness: 0.05, transparent: true, opacity: 0.55 });
    this.tearPool = [];
  }

  /* 頭（楕円の玉）の表面の奥行き */
  ManScene.prototype.surf = function (x, y) {
    var dx = (x - this.FX) / this.RX, dy = (y - this.FY) / this.RY, q = 1 - dx * dx - dy * dy;
    if (q <= 0) return 0;
    var z = Math.sqrt(q), w = Math.max(0, Math.min(1, (z - 0.05) / 0.35));
    return this.RZ * z + relief(dx, dy, this.big) * w;
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
    var FX = this.FX = g.FX, FY = this.FY = g.FY, RX = this.RX = g.RX, RY = this.RY = g.RY, RZ = this.RZ = 150;
    var H = g.H, self = this;

    /* 体（背広・シャツ・ネクタイ） */
    var top = FY + RY - 40;
    var suit = std(0x4a5262, { roughness: 0.9 });
    ball(suit, 262, 120, 120, FX, top + 130, -90, G);
    var torso = new T.Mesh(new T.CylinderGeometry(262, 275, Math.max(10, H - top), 40), suit);
    torso.scale.z = 0.46; torso.position.set(FX, -(top + 130 + (H - top) / 2), -90); G.add(torso);
    var neckM = std(0xeab48c, { roughness: 0.7 });
    var neck = new T.Mesh(new T.CylinderGeometry(68, 74, 130, 28), neckM);
    neck.position.set(FX, -(top + 20), -20); G.add(neck);
    var shirt = std(0xfafaf4, { roughness: 0.7 });
    flat(shapeOf([[FX - 92, top + 52], [FX, top + 220], [FX + 92, top + 52], [FX + 58, top + 44], [FX, top + 84], [FX - 58, top + 44]]), shirt, 40, G);
    var tieM = std(0xb8343a, { roughness: 0.6 });
    var tie = flat(shapeOf([[FX - 18, top + 84], [FX + 18, top + 84], [FX + 12, top + 106], [FX + 30, top + 222], [FX, top + 252], [FX - 30, top + 222], [FX - 12, top + 106]]), tieM, 44, G);
    var knot = ball(tieM, 20, 14, 10, FX, top + 92, 46, G);

    /* 頭。玉を顔の凹凸の分だけ押し出し・へこませて作る（ふつう・号泣の2つ） */
    var head = this.head = new T.Group(); G.add(head);
    var earM = std(0xdca084, { roughness: 0.6 });
    [-1, 1].forEach(function (s) {
      ball(earM, 22, 40, 20, FX + s * (RX - 8), FY + 8, -14, head);
    });
    this.faces = [false, true].map(function (big) {
      var tex = self.paintSkin(big);
      var mat = new T.MeshPhysicalMaterial({ map: tex.color, bumpMap: tex.bump, bumpScale: 1.6, roughness: 0.52, clearcoat: 0.18, clearcoatRoughness: 0.45, });
      var geo = new T.SphereGeometry(1, 180, 140);
      var p = geo.attributes.position, uv = geo.attributes.uv;
      for (var i = 0; i < p.count; i++) {
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = x, v = -y;
        var w = Math.max(0, Math.min(1, (z - 0.05) / 0.35));
        p.setXYZ(i, FX + x * RX, -(FY + v * RY), z * RZ + (w > 0 ? relief(u, v, big) * w : 0));
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
      var ex = FX + s * 80;
      self.pools.push(ball(self.poolMat, 30, 3, 3, ex, FY - 10, self.surf(ex, FY - 10) + 1, head));
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
    this.pools.forEach(function (p) { p.scale.y = s.burst ? 4.5 : 3; });
    /* 涙 */
    var self = this, pool = this.tearPool;
    while (pool.length < s.tears.length) { var m = new T.Mesh(this.tearGeo, this.tearMat); this.scene.add(m); pool.push(m); }
    pool.forEach(function (m, i) {
      var t = s.tears[i];
      if (!t) { m.visible = false; return; }
      var r = 8 + t.vol * 9;
      m.visible = true;
      m.scale.set(r, r, r * 0.8);
      m.position.set(t.x + (t.onFace ? shake : 0), -t.y, (t.onFace ? self.surf(t.x, t.y) : self.RZ * 0.9) + r * 0.6);
    });
    /* ハンカチ */
    var h = this.hanky;
    h.visible = !!s.held;
    if (s.held) {
      this.paintHanky(s.wet);
      var z = Math.max(this.surf(s.hx, s.hy), 60) + 40;
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
      this.w = w; this.h = h;
      this.camera.left = 0; this.camera.right = W; this.camera.top = 0; this.camera.bottom = -H;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  global.ManScene = ManScene;
})(window);
