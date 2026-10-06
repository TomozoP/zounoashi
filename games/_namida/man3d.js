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

  function ManScene() {
    T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(0, 540, 0, -960, 1, 5000);
    this.camera.position.set(0, 0, 2000);
    this.scene.add(new T.HemisphereLight(0xfff4e6, 0x6b5a4a, 1.25));
    var sun = new T.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-0.5, 0.8, 1); this.scene.add(sun);
    var rim = new T.DirectionalLight(0xcfe6ff, 0.7);
    rim.position.set(0.9, 0.1, 0.5); this.scene.add(rim);
    this.key = ""; this.w = 0; this.h = 0; this.group = null;
    this.tearMat = new T.MeshStandardMaterial({ color: 0x8fd2ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, emissive: 0x1b4d77, emissiveIntensity: 0.35 });
    var prof = [];
    for (var i = 0; i <= 18; i++) { var a = i / 18 * Math.PI; prof.push(new T.Vector2(Math.sin(a) * Math.sin(a / 2) * 1.05, Math.cos(a) * 1.45)); }
    this.tearGeo = new T.LatheGeometry(prof, 16);
    this.tearPool = [];
  }

  /* 頭（楕円の玉）の表面の奥行き */
  ManScene.prototype.surf = function (x, y) {
    var dx = (x - this.FX) / this.RX, dy = (y - this.FY) / this.RY, q = 1 - dx * dx - dy * dy;
    return q > 0 ? this.RZ * Math.sqrt(q) : 0;
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

    /* 頭 */
    var skin = this.skin = std(0xf0c19a, { roughness: 0.48 });
    var head = this.head = new T.Group(); G.add(head);
    ball(skin, RX, RY, RZ, FX, FY, 0, head);
    [-1, 1].forEach(function (s) {
      ball(skin, 24, 42, 22, FX + s * (RX - 6), FY + 10, -10, head);
      ball(std(0xd99b74), 12, 26, 10, FX + s * (RX + 4), FY + 10, 6, head);
    });
    var hairM = std(0x3a3532, { roughness: 1 });
    [-1, 1].forEach(function (s) {
      ball(hairM, 26, 54, 70, FX + s * (RX - 14), FY - 64, -20, head).rotation.z = s * 0.22;
    });
    for (var k = 0; k < 3; k++) this.tube(qpts(FX - 118, FY - 150 + k * 14, FX, FY - 222 + k * 10, FX + 122, FY - 140 + k * 16, 12), 2.2, hairM, 1, head);
    /* おでこのしわ */
    var wrinkle = std(0xc98f6d, { roughness: 0.7 });
    for (k = 0; k < 3; k++) this.tube(qpts(FX - 68 + k * 6, FY - 112 - k * 16, FX, FY - 126 - k * 16, FX + 68 - k * 6, FY - 112 - k * 16, 8), 2, wrinkle, 0, head);

    /* 眉（ふつう・号泣の2つを作って切り替える） */
    var brow = std(0x2d2724, { roughness: 1 });
    this.brows = [6, 16].map(function (lift) {
      var gp = new T.Group(); head.add(gp);
      [-1, 1].forEach(function (s) {
        self.tube(qpts(FX + s * 140, FY - 60, FX + s * 95, FY - 70, FX + s * 40, FY - 86 - lift, 10), 7, brow, 4, gp);
      });
      return gp;
    });
    /* ぎゅっとつぶった目と、目にたまる涙 */
    var lid = std(0x5b3b26, { roughness: 0.8 });
    this.pools = [];
    [-1, 1].forEach(function (s) {
      var ex = FX + s * 80;
      self.tube(qpts(ex - 44, FY - 20, ex, FY - 46, ex + 44, FY - 20, 10), 3.6, lid, 2, head);
      self.tube(qpts(ex - 32, FY - 8, ex, FY + 2, ex + 32, FY - 8, 8), 1.8, lid, 1, head);
      self.tube([[ex + s * 50, FY - 26], [ex + s * 62, FY - 34]], 1.6, lid, 1, head);
      self.tube([[ex + s * 50, FY - 16], [ex + s * 64, FY - 14]], 1.6, lid, 1, head);
      var pool = ball(self.tearMat, 40, 7, 6, ex, FY - 17, self.surf(ex, FY - 17) + 2, head);
      self.pools.push(pool);
    });
    /* ほお */
    /* ほおの赤みは平面の絵で上から重ねる（ゲーム側） */
    /* 鼻 */
    var noseM = std(0xeca684, { roughness: 0.45 });
    ball(noseM, 36, 31, 34, FX, FY + 36, this.surf(FX, FY + 36) + 4, head);
    ball(lid, 7, 4, 4, FX - 13, FY + 56, this.surf(FX, FY + 56) + 20, head);
    ball(lid, 7, 4, 4, FX + 13, FY + 56, this.surf(FX, FY + 56) + 20, head);
    /* 口（∩の形。縦の大きさは毎コマ変える） */
    var my = this.my = FY + 128, mz = this.surf(FX, my) + 3;
    var mouth = this.mouth = new T.Group(); mouth.position.set(FX, -my, mz); head.add(mouth);
    function arc(w, h) {
      var s = new T.Shape();
      s.moveTo(-w, -h * 0.5);
      s.quadraticCurveTo(0, h * 1.0, w, -h * 0.5);
      s.quadraticCurveTo(0, -h * 1.0, -w, -h * 0.5);
      return s;
    }
    flat(arc(1, 1), std(0x5a1d1f, { roughness: 0.9 }), 0, mouth);
    var tongue = new T.Mesh(new T.CircleGeometry(1, 24), std(0xd9737a, { roughness: 0.6 }));
    tongue.scale.set(0.42, 0.18, 1); tongue.position.set(0, -0.52, 0.5); mouth.add(tongue);
    var teeth = new T.Mesh(new T.PlaneGeometry(0.6, 0.1), std(0xffffff, { roughness: 0.4 }));
    teeth.position.set(0, 0.07, 0.6); mouth.add(teeth);
    var lipM = std(0xc98466, { roughness: 0.6 });
    this.lip = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(arc(1, 1).getPoints(40).map(function (p) { return new T.Vector3(p.x, p.y, 0.3); }), true), 60, 0.05, 6, true), lipM);
    mouth.add(this.lip);
    /* ひげ */
    var mus = std(0x3a3532, { roughness: 1 });
    [-1, 1].forEach(function (s) {
      var m = ball(mus, 46, 15, 16, FX + s * 40, FY + 84, self.surf(FX + s * 40, FY + 84) + 6, head);
      m.rotation.z = s * -0.25;
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
    this.brows[0].visible = !s.burst; this.brows[1].visible = !!s.burst;
    var mw = s.burst ? 70 : 54, mh = (s.burst ? 52 : 30) + Math.sin(s.T * (s.burst ? 26 : 11)) * (s.burst ? 8 : 4);
    this.mouth.scale.set(mw, mh, 1);
    this.pools.forEach(function (p) { p.scale.y = s.burst ? 10 : 7; });
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
