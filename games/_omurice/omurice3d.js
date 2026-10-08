/* リアルオムライスの立体の絵。卵・皿・机・ケチャップの線は、すべて基本図形と手続きの模様から自作。
   three.js は random-bowling の既存配布物（MIT）を使う。
   単位: 1 = 約8.2cm（卵の長さ 2.2 ≒ 18cm）。y が上。 */
(function (global) {
  "use strict";
  var T;

  /* ---- なめらかな乱数（値ノイズ） ---- */
  function hash3(x, y, z) {
    var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function noise3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function L(a, b, t) { return a + (b - a) * t; }
    return L(
      L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
      L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
  }
  function fbm(x, y, z, oct) {
    var s = 0, a = 0.5, f = 1;
    for (var i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
    return s;
  }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ---- 手続きの模様 ---- */
  function canvasTex(size, paint, repeat) {
    var c = document.createElement("canvas"); c.width = c.height = size;
    paint(c.getContext("2d"), size);
    var t = new T.CanvasTexture(c);
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); }
    t.anisotropy = 4;
    return t;
  }
  /* 卵の表面の細かいでこぼこ（焼きむら・薄い膜のしわ） */
  function eggBump(g, s) {
    var img = g.createImageData(s, s), d = img.data;
    for (var y = 0; y < s; y++) for (var x = 0; x < s; x++) {
      var u = x / s * 8, v = y / s * 8;
      var n = fbm(u, v, 0.5, 4) * 0.7 + noise3(u * 9, v * 9, 3) * 0.3;
      var c = Math.round(n * 255), i = (y * s + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = c; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  /* 木の机 */
  function woodColor(g, s) {
    var img = g.createImageData(s, s), d = img.data;
    for (var y = 0; y < s; y++) for (var x = 0; x < s; x++) {
      var u = x / s, v = y / s;
      var ring = Math.sin((v * 60 + fbm(u * 4, v * 12, 1, 4) * 5) * Math.PI);
      var fine = noise3(u * 300, v * 14, 2);
      var k = 0.62 + 0.05 * ring + 0.07 * fine + 0.1 * fbm(u * 3, v * 3, 5, 3);
      var i = (y * s + x) * 4;
      d[i] = Math.min(255, 128 * k); d[i + 1] = Math.min(255, 84 * k); d[i + 2] = Math.min(255, 52 * k); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  function OmuScene() {
    T = global.THREE;
    var r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    var S = this.scene = new T.Scene();
    S.background = new T.Color(0x2a1c12);
    this.camera = new T.PerspectiveCamera(30, 540 / 960, 0.1, 100);

    /* 映り込み用の部屋（明るい窓と暖かい壁） */
    var env = new T.Scene();
    var room = new T.Mesh(new T.SphereGeometry(20, 32, 16), new T.MeshBasicMaterial({ side: T.BackSide, vertexColors: true }));
    var pos = room.geometry.attributes.position, cols = [];
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 20, x = pos.getX(i) / 20, z = pos.getZ(i) / 20;
      var win = Math.max(0, 1 - Math.hypot(x + 0.5, y - 0.55, z + 0.35) * 2.2);
      var base = 0.18 + 0.32 * Math.max(0, y);
      cols.push(base * 1.1 + win * 3, base * 0.95 + win * 3, base * 0.8 + win * 2.8);
    }
    room.geometry.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    env.add(room);
    var pm = new T.PMREMGenerator(r);
    S.environment = pm.fromScene(env, 0.02).texture;

    /* 光 */
    S.add(new T.HemisphereLight(0xfff1dc, 0x4a3020, 0.45));
    var key = this.key = new T.DirectionalLight(0xfff0d8, 2.6);
    key.position.set(-2.5, 6, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    var sc = key.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 1; sc.far = 15;
    key.shadow.radius = 6; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    S.add(key);
    var fill = new T.DirectionalLight(0xc8dcff, 0.35);
    fill.position.set(3, 2, -2); S.add(fill);

    this.buildTable();
    this.buildPlate();
    this.buildEgg();

    this.inkMat = new T.MeshPhysicalMaterial({ color: 0x9c0d07, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.3, sheenColor: new T.Color(0xff5030) });
    this.strokes = [];
    this.ray = new T.Raycaster();
    this.targets = [this.egg, this.plateTop];
    this.w = 0; this.h = 0; this.look = 0;
  }

  OmuScene.prototype.buildTable = function () {
    var tex = canvasTex(1024, woodColor, 5);
    tex.colorSpace = T.SRGBColorSpace;
    var m = new T.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 });
    var t = new T.Mesh(new T.PlaneGeometry(40, 40), m);
    t.rotation.x = -Math.PI / 2; t.receiveShadow = true;
    this.scene.add(t);
  };

  /* 白い皿（ふちが少し反った楕円の平皿） */
  OmuScene.prototype.buildPlate = function () {
    var pts = [
      [0, 0.03], [1.1, 0.03], [1.38, 0.05], [1.5, 0.1], [1.62, 0.16], [1.68, 0.175], [1.7, 0.16], [1.62, 0.12], [1.45, 0.04], [1.25, 0.0], [0.9, 0.0], [0.88, 0.012], [0, 0.012]
    ].map(function (p) { return new T.Vector2(p[0], p[1]); });
    var geo = new T.LatheGeometry(pts.reverse(), 128);
    geo.scale(1.2, 1, 0.92);
    geo.computeVertexNormals();
    var m = new T.MeshPhysicalMaterial({ color: 0xf6f4ee, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    var p = new T.Mesh(geo, m);
    p.castShadow = true; p.receiveShadow = true;
    this.scene.add(p);
    /* 線を引ける皿の面（見えない板） */
    var top = new T.Mesh(new T.CircleGeometry(1.0, 48), new T.MeshBasicMaterial({ visible: false }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.031; top.scale.set(1.62, 1.55, 1);
    this.plateTop = top;
    this.scene.add(top);
  };

  /* 卵：ラグビーボール形のふくらみ。両端に包んだしわ、表面に焼きむら */
  OmuScene.prototype.buildEgg = function () {
    var geo = new T.SphereGeometry(1, 192, 96);
    var pos = geo.attributes.position, cols = [];
    var v = new T.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var x = v.x, y = v.y, z = v.z;
      var ax = Math.abs(x);
      var taper = 1 - 0.22 * Math.pow(ax, 2.6);
      /* 底は平ら、上は丸く */
      var Y = y >= 0 ? Math.pow(y, 0.85) * 0.5 : y * 0.04;
      var Z = z * 0.66;
      Y *= taper; Z *= taper;
      var X = x * 1.12;
      /* 端の包み込みのしわ */
      var ang = Math.atan2(y, z);
      var end = smooth(0.62, 0.98, ax) * Math.max(0, y + 0.2);
      var fold = Math.sin(ang * 11 + fbm(x * 3, y * 3, z * 3, 2) * 4) * 0.022 * end;
      /* 全体のゆるいうねり */
      var wob = (fbm(x * 2.2 + 7, y * 2.2, z * 2.2, 3) - 0.5) * 0.05 * Math.max(0, y);
      var n = new T.Vector3(X, Y * 1.6, Z).normalize();
      X += n.x * (fold + wob); Y += n.y * (fold + wob) + 0.012; Z += n.z * (fold + wob);
      pos.setXYZ(i, X, Y, Z);
      /* 色: 明るい卵色に、焼き色と半熟の照り */
      var spot = fbm(x * 4 + 3, y * 4, z * 4, 4);
      var brown = smooth(0.58, 0.75, spot) * 0.55 + end * 0.25;
      var pale = smooth(0.35, 0.2, fbm(x * 6, y * 6 + 9, z * 6, 3)) * 0.5;
      var rC = 0.99 - brown * 0.14 + pale * 0.01, gC = 0.76 - brown * 0.22 + pale * 0.08, bC = 0.2 - brown * 0.08 + pale * 0.12;
      var col = new T.Color().setRGB(rC, gC, bC, T.SRGBColorSpace);
      cols.push(col.r, col.g, col.b);
    }
    geo.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    var bump = canvasTex(512, eggBump, 3);
    var m = new T.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.38, bumpMap: bump, bumpScale: 0.6,
      clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new T.Color(0xffe6a0), sheenRoughness: 0.6
    });
    var egg = this.egg = new T.Mesh(geo, m);
    egg.position.y = 0.03;
    egg.castShadow = true; egg.receiveShadow = true;
    this.scene.add(egg);
    /* 卵のふちからのぞくケチャップライス */
    var rice = new T.Mesh(new T.SphereGeometry(1, 64, 24),
      new T.MeshStandardMaterial({ color: 0xc24a26, roughness: 0.7, bumpMap: canvasTex(256, function (g, s) {
        for (var k = 0; k < 2200; k++) {
          var gx = Math.random() * s, gy = Math.random() * s, c = 120 + Math.random() * 135;
          g.fillStyle = "rgb(" + c + "," + c + "," + c + ")";
          g.beginPath(); g.ellipse(gx, gy, 3.2, 1.6, Math.random() * 3, 0, 7); g.fill();
        }
      }, 4), bumpScale: 2 }));
    rice.scale.set(1.08, 0.06, 0.66);
    rice.position.y = 0.04;
    rice.receiveShadow = true;
    this.scene.add(rice);
  };

  /* 画面の形に合わせてカメラを置く（皿の幅が画面に収まるように） */
  OmuScene.prototype.setView = function (W, H, look) {
    var cam = this.camera;
    cam.aspect = W / H;
    var hf = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect);
    var dist = 1.5 / Math.tan(hf / 2);
    var tilt = 1.0 - 0.18 * (look || 0);      /* 見下ろす角度（ラジアン）。完成後は少し低く */
    cam.position.set(0, Math.sin(tilt) * dist + 0.1, Math.cos(tilt) * dist);
    cam.lookAt(0, 0.12, 0);
    cam.updateProjectionMatrix();
  };

  /* 画面の点(0..1)から、卵か皿の表面の位置と向き */
  OmuScene.prototype.pick = function (nx, ny) {
    this.ray.setFromCamera(new T.Vector2(nx * 2 - 1, 1 - ny * 2), this.camera);
    var hits = this.ray.intersectObjects(this.targets, false);
    if (!hits.length) return null;
    var h = hits[0];
    var n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new T.Vector3(0, 1, 0);
    if (h.object === this.plateTop) n.set(0, 1, 0);
    return { p: h.point.clone(), n: n.normalize(), o: h.object };
  };

  /* ---- ケチャップの線 ---- */
  OmuScene.prototype.beginStroke = function () {
    var s = { pts: [], mesh: null, caps: [] };
    this.strokes.push(s);
    return s;
  };
  OmuScene.prototype.addPoint = function (s, hit, r) {
    var last = s.pts[s.pts.length - 1];
    if (last && last.p.distanceTo(hit.p) < 0.012) { last.r = Math.max(last.r, r * 0.9 + last.r * 0.1); this.rebuild(s); return 0; }
    var len = last ? last.p.distanceTo(hit.p) : 0;
    if (last && (len > 0.25 || last.o !== hit.o)) return -1;                   /* 卵から皿へ飛ぶような大きな跳びはつなげない */
    s.pts.push({ p: hit.p, n: hit.n, r: r, o: hit.o });
    this.rebuild(s);
    return len * Math.PI * r * r * 0.75;                  /* 使ったケチャップの量（体積） */
  };
  OmuScene.prototype.rebuild = function (s) {
    var P = s.pts, n = P.length, SEG = 10;
    if (s.mesh) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); }
    s.caps.forEach(function (c) { this.scene.remove(c); c.geometry.dispose(); }, this);
    s.caps = [];
    if (n === 0) return;
    var self = this;
    function cap(pt) {
      var m = new T.Mesh(new T.SphereGeometry(1, 16, 10), self.inkMat);
      m.position.copy(pt.p).addScaledVector(pt.n, pt.r * 0.25);
      m.scale.set(pt.r * 1.05, pt.r * 0.72, pt.r * 1.05);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), pt.n);
      m.castShadow = true;
      self.scene.add(m); s.caps.push(m);
    }
    cap(P[0]);
    if (n > 1) cap(P[n - 1]);
    if (n < 2) return;
    var verts = [], idx = [];
    var t = new T.Vector3(), side = new T.Vector3(), c = new T.Vector3();
    for (var i = 0; i < n; i++) {
      var a = P[Math.max(0, i - 1)].p, b = P[Math.min(n - 1, i + 1)].p;
      t.subVectors(b, a).normalize();
      side.crossVectors(P[i].n, t).normalize();
      var r = P[i].r;
      c.copy(P[i].p).addScaledVector(P[i].n, r * 0.25);
      for (var k = 0; k < SEG; k++) {
        var ang = k / SEG * Math.PI * 2;
        verts.push(
          c.x + side.x * Math.cos(ang) * r * 1.05 + P[i].n.x * Math.sin(ang) * r * 0.72,
          c.y + side.y * Math.cos(ang) * r * 1.05 + P[i].n.y * Math.sin(ang) * r * 0.72,
          c.z + side.z * Math.cos(ang) * r * 1.05 + P[i].n.z * Math.sin(ang) * r * 0.72);
      }
    }
    for (i = 0; i < n - 1; i++) for (k = 0; k < SEG; k++) {
      var a0 = i * SEG + k, a1 = i * SEG + (k + 1) % SEG, b0 = a0 + SEG, b1 = a1 + SEG;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    s.mesh = new T.Mesh(geo, this.inkMat);
    s.mesh.castShadow = true;
    this.scene.add(s.mesh);
  };
  OmuScene.prototype.clear = function () {
    this.strokes.forEach(function (s) { s.pts = []; this.rebuild(s); }, this);
    this.strokes = [];
  };

  OmuScene.prototype.render = function (ctx, W, H, look) {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.renderer.setSize(w, h, false); }
    this.setView(W, H, look);
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  global.OmuScene = OmuScene;
})(window);
