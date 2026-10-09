/* オム文字シミュレーターの立体の絵。卵・皿・机・ケチャップの線は、すべて基本図形と手続きの模様から自作。
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
  /* ゆるやかに変わる模様は粗い升目で計算して間をなめらかにつなぐ（読み込みを軽くする） */
  function coarse(n, f) {
    var a = new Float32Array((n + 1) * (n + 1));
    for (var j = 0; j <= n; j++) for (var i = 0; i <= n; i++) a[j * (n + 1) + i] = f(i / n, j / n);
    return function (u, v) {
      var x = u * n, y = v * n, i = Math.min(n - 1, x | 0), j = Math.min(n - 1, y | 0), fx = x - i, fy = y - j, k = j * (n + 1) + i;
      return (a[k] * (1 - fx) + a[k + 1] * fx) * (1 - fy) + (a[k + n + 1] * (1 - fx) + a[k + n + 2] * fx) * fy;
    };
  }
  /* 卵の表面の細かいでこぼこ（焼きむら・薄い膜のしわ） */
  function eggBump(g, s) {
    var img = g.createImageData(s, s), d = img.data;
    var low = coarse(128, function (u, v) { return fbm(u * 10, v * 10, 0.5, 3); });
    for (var y = 0; y < s; y++) for (var x = 0; x < s; x++) {
      var u = x / s * 10, v = y / s * 10;
      var n = 0.5 + (low(x / s, y / s) - 0.5) * 0.5 + (noise3(u * 14, v * 14, 3) - 0.5) * 0.18;
      var c = Math.round(Math.max(0, Math.min(1, n)) * 255), i = (y * s + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = c; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    /* 膜のしわ（短く曲がった細い溝） */
    g.lineCap = "round";
    for (var k = 0; k < 900; k++) {
      var x0 = Math.random() * s, y0 = Math.random() * s, a = Math.random() * 6.3, L = 8 + Math.random() * 40;
      g.strokeStyle = "rgba(40,40,40," + (0.08 + Math.random() * 0.16).toFixed(2) + ")";
      g.lineWidth = 0.8 + Math.random() * 1.6;
      g.beginPath(); g.moveTo(x0, y0);
      for (var t = 1; t <= 5; t++) { a += (Math.random() - 0.5) * 0.9; x0 += Math.cos(a) * L / 5; y0 += Math.sin(a) * L / 5; g.lineTo(x0, y0); }
      g.stroke();
    }
    /* ふくらんだ気泡のあと（明るい小さな点） */
    for (k = 0; k < 500; k++) {
      g.fillStyle = "rgba(255,255,255," + (0.06 + Math.random() * 0.12).toFixed(2) + ")";
      g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 0, 7); g.fill();
    }
  }

  /* 木の机 */
  function woodColor(g, s) {
    var img = g.createImageData(s, s), d = img.data;
    var bend = coarse(192, function (u, v) { return fbm(u * 4, v * 12, 1, 4); });
    var tone = coarse(64, function (u, v) { return fbm(u * 3, v * 3, 5, 3); });
    for (var y = 0; y < s; y++) for (var x = 0; x < s; x++) {
      var u = x / s, v = y / s;
      var ring = Math.sin((v * 60 + bend(u, v) * 5) * Math.PI);
      var fine = noise3(u * 110, v * 10, 2);
      var k = 0.62 + 0.05 * ring + 0.07 * fine + 0.1 * tone(u, v);
      var i = (y * s + x) * 4;
      d[i] = Math.min(255, 128 * k); d[i + 1] = Math.min(255, 84 * k); d[i + 2] = Math.min(255, 52 * k); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  function OmuScene() {
    T = global.THREE;
    var r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.LinearToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    var S = this.scene = new T.Scene();
    S.background = new T.Color(0x2a1c12);
    this.camera = new T.PerspectiveCamera(30, 540 / 960, 0.8, 120);

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
    S.add(new T.HemisphereLight(0xfff1dc, 0x4a3020, 0.5));
    var key = this.key = new T.DirectionalLight(0xfff0d8, 2.6);
    key.position.set(-4, 4.5, 1.5);
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
    this.buildParsley();

    this.inkMat = new T.MeshPhysicalMaterial({ color: 0xb3120a, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.3, sheenColor: new T.Color(0xff5030) });
    this.strokes = [];
    this.ray = new T.Raycaster();
    this.targets = [this.egg, this.plate, this.table];
    this.w = 0; this.h = 0; this.look = 0;
  }

  /* 食卓（天板と脚）。読み込みを軽くするため、まわりの部屋は置かない */
  OmuScene.prototype.buildTable = function () {
    var S = this.scene;
    function std(c, o) { var p = { color: c, roughness: 0.8 }; for (var k in o) p[k] = o[k]; return new T.MeshStandardMaterial(p); }
    function box(w, h, d, m, x, y, z, shadow) {
      var b = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      if (shadow) { b.castShadow = true; b.receiveShadow = true; }
      S.add(b); return b;
    }
    /* 食卓（幅120cm×奥行80cm、高さ72cm ≒ 14.6×9.8、8.8） */
    var tex = canvasTex(1024, woodColor);   /* くり返さず1枚で貼る（継ぎ目を出さない） */
    tex.colorSpace = T.SRGBColorSpace;
    var wood = std(0xffffff, { map: tex, roughness: 0.55 });
    var dark = std(0x5a3b24, { roughness: 0.7 });
    var t = new T.Mesh(new T.PlaneGeometry(14.6, 9.8), wood);
    t.rotation.x = -Math.PI / 2; t.receiveShadow = true;
    this.table = t; S.add(t);
    box(14.6, 0.45, 9.8, dark, 0, -0.3, 0);
    [[-6.6, -4.2], [6.6, -4.2], [-6.6, 4.2], [6.6, 4.2]].forEach(function (p) { box(0.6, 8.4, 0.6, dark, p[0], -4.65, p[1]); });
  };

  /* 白い皿（ふちが少し反った楕円の平皿） */
  OmuScene.prototype.buildPlate = function () {
    var pts = [
      [0, 0.03], [1.1, 0.03], [1.38, 0.05], [1.5, 0.1], [1.62, 0.16], [1.68, 0.175], [1.7, 0.16], [1.62, 0.12], [1.45, 0.04], [1.25, 0.0], [0.9, 0.0], [0.88, 0.012], [0, 0.012]
    ].map(function (p) { return new T.Vector2(p[0], p[1]); });
    var geo = new T.LatheGeometry(pts.reverse(), 128);
    geo.scale(1.12, 1, 0.82);
    geo.computeVertexNormals();
    var m = new T.MeshPhysicalMaterial({ color: 0xf6f4ee, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    var p = new T.Mesh(geo, m);
    p.castShadow = true; p.receiveShadow = true;
    this.plate = p;
    this.scene.add(p);
    /* 線を引ける皿の面（見えない板） */
    var top = new T.Mesh(new T.CircleGeometry(1.0, 48), new T.MeshBasicMaterial({ visible: false }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.031; top.scale.set(1.25, 1.95, 1);
    this.plateTop = top;
    this.scene.add(top);
  };

  /* 卵：ラグビーボール形のふくらみ。両端に包んだしわ、表面に焼きむら */
  OmuScene.prototype.buildEgg = function (seed) {
    /* seed ごとに形・しわ・焼き色の違うオムライスになる */
    var R = seed || 1;
    function rr() { R = (R * 16807) % 2147483647; return (R - 1) / 2147483646; }
    var SX = rr() * 50, SY = rr() * 50, SZ = rr() * 50;
    var LEN = 1.2 + rr() * 0.22, WID = 0.6 + rr() * 0.12, HGT = 0.5 + rr() * 0.12, TONE = rr();
    function F(a, b, c, o) { return fbm(a + SX, b + SY, c + SZ, o); }
    if (this.egg) { this.scene.remove(this.egg); this.egg.geometry.dispose(); }
    /* 極（UVの縮むところ）を卵の両端に向けてから形を作る */
    var geo = new T.SphereGeometry(1, 200, 120);
    geo.rotateZ(Math.PI / 2);
    var pos = geo.attributes.position, cols = [];
    var v = new T.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var x = v.x, y = v.y, z = v.z;
      var ax = Math.abs(x);
      /* 両端がとがった木の葉形。底は平ら、上はふっくら */
      var taper = Math.pow(Math.max(0, 1 - Math.pow(ax, 1.7)), 0.62) / Math.max(0.0001, Math.sqrt(Math.max(0, 1 - x * x)));
      taper = Math.min(1.25, taper) * (1 - 0.12 * ax);
      var Y = y >= 0 ? Math.pow(y, 0.8) * HGT : y * 0.03;
      var Z = z * WID;
      Y *= taper; Z *= taper;
      var X = x * LEN;
      /* 卵の膜のゆるいしわと、端の包みじわ */
      var ang = Math.atan2(y, z);
      var end = smooth(0.55, 0.97, ax) * Math.max(0, y + 0.3);
      var fold = Math.sin(ang * 9 + F(x * 3, y * 3, z * 3, 2) * 5) * 0.018 * end;
      var wob = (F(x * 3.2 + 7, y * 3.2, z * 3.2, 4) - 0.5) * 0.09 * Math.max(0, y + 0.1);
      var crease = Math.pow(Math.abs(Math.sin(F(x * 1.8, y * 1.8 + 3, z * 1.8, 3) * 9)), 6) * -0.02 * Math.max(0, y);
      var d = fold + wob + crease;
      var n = new T.Vector3(X, Y * 1.6, Z).normalize();
      X += n.x * d; Y += n.y * d + 0.012; Z += n.z * d;
      pos.setXYZ(i, X, Y, Z);
      /* 色: あざやかな卵の黄色。明るいむらと、端だけほんのり濃い */
      var patch = F(x * 3 + 3, y * 3, z * 3, 4);
      var light = smooth(0.45, 0.7, patch) * 0.6;
      var deep = smooth(0.8, 1.0, ax) * 0.4 + smooth(0.35, 0.2, patch) * 0.3;
      var col = new T.Color().setRGB(0.99 + light * 0.01, 0.76 + TONE * 0.07 + light * 0.07 - deep * 0.08, 0.1 + light * 0.14 - deep * 0.05, T.SRGBColorSpace);
      cols.push(col.r, col.g, col.b);
    }
    geo.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    var bump = this.eggBump || (this.eggBump = canvasTex(1024, eggBump));
    var m = this.eggMat || new T.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.6, bumpMap: bump, bumpScale: 3,
      clearcoat: 0.12, clearcoatRoughness: 0.55, sheen: 0.35, sheenColor: new T.Color(0xffe080), sheenRoughness: 0.5,
      emissive: new T.Color(0x3a2000), emissiveIntensity: 0.15
    });
    this.eggMat = m;
    var egg = this.egg = new T.Mesh(geo, m);
    if (this.targets) this.targets[0] = egg;
    egg.position.y = 0.03;
    egg.castShadow = true; egg.receiveShadow = true;
    this.scene.add(egg);
  };

  /* 皿の端に添えるパセリ（縮れた葉のかたまりを、細い茎の先に付ける） */
  OmuScene.prototype.buildParsley = function () {
    var g = new T.Group();
    var leafMat = new T.MeshStandardMaterial({ color: 0x2f6b22, roughness: 0.65, flatShading: true });
    var lightMat = new T.MeshStandardMaterial({ color: 0x4f8f33, roughness: 0.6, flatShading: true });
    var stemMat = new T.MeshStandardMaterial({ color: 0x6f9a3e, roughness: 0.7 });
    var R = 7;
    function rr() { R = (R * 16807) % 2147483647; return (R - 1) / 2147483646; }
    /* 縮れた葉: でこぼこにした小さな玉を寄せ集める */
    function curl(x, y, z, s) {
      var geo = new T.IcosahedronGeometry(1, 2), pos = geo.attributes.position, v = new T.Vector3();
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        var k = 0.72 + 0.4 * fbm(v.x * 3 + x * 9, v.y * 3 + z * 9, v.z * 3, 2);
        pos.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
      }
      geo.computeVertexNormals();
      var m = new T.Mesh(geo, rr() < 0.35 ? lightMat : leafMat);
      m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(rr() * 3, rr() * 3, rr() * 3);
      m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    for (var b = 0; b < 5; b++) {
      var a = b / 5 * Math.PI * 2 + rr() * 0.6, len = 0.12 + rr() * 0.06;
      var ex = Math.cos(a) * len, ez = Math.sin(a) * len, ey = 0.1 + rr() * 0.06;
      /* 茎 */
      var st = new T.Mesh(new T.CylinderGeometry(0.008, 0.012, 1, 6), stemMat);
      var from = new T.Vector3(0, 0.02, 0), to = new T.Vector3(ex * 0.7, ey * 0.7, ez * 0.7);
      st.position.copy(from).add(to).multiplyScalar(0.5);
      st.scale.y = from.distanceTo(to);
      st.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      g.add(st);
      for (var k = 0; k < 14; k++) curl(ex + (rr() - 0.5) * 0.11, ey + (rr() - 0.3) * 0.07, ez + (rr() - 0.5) * 0.11, 0.04 + rr() * 0.035);
    }
    /* 長い茎を1本、皿の上に寝かせる */
    var lst = new T.Mesh(new T.CylinderGeometry(0.009, 0.011, 0.32, 6), stemMat);
    lst.rotation.z = Math.PI / 2 - 0.25; lst.rotation.y = 0.5; lst.position.set(0.12, 0.03, 0.1);
    g.add(lst);
    g.position.set(1.12, 0.03, -0.5); g.scale.setScalar(1.0);
    this.parsley = g;
    this.scene.add(g);
  };

  /* 画面の形に合わせてカメラを置く（皿の幅が画面に収まるように） */
  OmuScene.prototype.setView = function (W, H, look, orbit) {
    var cam = this.camera;
    cam.aspect = W / H;
    var vf = cam.fov * Math.PI / 360;
    var hf = Math.atan(Math.tan(vf) * cam.aspect);
    /* 横向きの卵の長さが画面の幅に収まる近さ */
    var dist = Math.max(1.55 / Math.tan(hf), 0.9 / Math.tan(vf));
    var tilt = 0.98 - 0.1 * (look || 0), yaw = 0;   /* 見下ろす角度・まわりこむ角度（ラジアン） */
    if (orbit) { tilt += orbit.tilt; yaw = orbit.yaw; if (orbit.zoom) dist /= orbit.zoom; }
    tilt = Math.max(0.22, Math.min(1.45, tilt));
    cam.position.set(Math.sin(yaw) * Math.cos(tilt) * dist, Math.sin(tilt) * dist + 0.1, Math.cos(yaw) * Math.cos(tilt) * dist);
    cam.lookAt(0, 0.12, 0.02);
    cam.updateProjectionMatrix();
  };

  /* 画面の点(0..1)から、卵か皿の表面の位置と向き */
  OmuScene.prototype.pick = function (nx, ny) {
    this.ray.setFromCamera(new T.Vector2(nx * 2 - 1, 1 - ny * 2), this.camera);
    var hits = this.ray.intersectObjects(this.targets, false);
    if (!hits.length) return null;
    var h = hits[0];
    var n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new T.Vector3(0, 1, 0);
    if (h.object === this.table) n.set(0, 1, 0);
    if (n.y < 0) n.negate();
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
    this.lastLen = 0;
    if (last && last.p.distanceTo(hit.p) < 0.012) { return 0; }
    if (s.pts.length >= 240) return -2;                  /* 1本が長すぎると作り直しが重いので、続きは新しい線にする */
    var len = last ? last.p.distanceTo(hit.p) : 0;
    if (last && (len > 0.25 || last.o !== hit.o)) return -1;                   /* 卵から皿へ飛ぶような大きな跳びはつなげない */
    s.pts.push({ p: hit.p, n: hit.n, r: r, o: hit.o });
    this.lastLen = len;
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
      m.position.copy(pt.p).addScaledVector(pt.n, pt.r * 0.5 + 0.004);
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
      c.copy(P[i].p).addScaledVector(P[i].n, r * 0.5 + 0.004);
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
  /* 全部消して、別のオムライスを出す */
  OmuScene.prototype.newOmu = function (seed) {
    this.clear();
    this.buildEgg(seed);
  };
  /* 線を1本だけ消す（2本指で拡大縮小を始めたときの書きかけ） */
  OmuScene.prototype.dropStroke = function (s) {
    var i = this.strokes.indexOf(s);
    if (i < 0) return;
    s.pts = []; this.rebuild(s);
    this.strokes.splice(i, 1);
  };
  OmuScene.prototype.clear = function () {
    this.strokes.forEach(function (s) { s.pts = []; this.rebuild(s); }, this);
    this.strokes = [];
  };

  /* ---- 後処理: ピントのぼけ・色味・周辺減光・粒子（写真らしく見せる） ----
     一度画面外に描いてから、奥行きを見てぼかす。作れない端末ではそのまま描く */
  OmuScene.prototype.makePost = function (w, h) {
    if (this.postFailed) return null;
    try {
      if (this.rt) { this.rt.dispose(); this.rt.depthTexture.dispose(); }
      var rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples: 4 });
      rt.depthTexture = new T.DepthTexture(w, h);
      rt.depthTexture.type = T.UnsignedIntType;
      this.rt = rt;
      if (!this.postMat) {
        this.postMat = new T.ShaderMaterial({
          uniforms: {
            tColor: { value: null }, tDepth: { value: null }, uRes: { value: new T.Vector2() },
            uNear: { value: 1 }, uFar: { value: 100 }, uFocus: { value: 8 }, uRange: { value: 1.6 },
            uMaxBlur: { value: 6 }, uTime: { value: 0 }
          },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
          fragmentShader: [
            "uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes;",
            "uniform float uNear, uFar, uFocus, uRange, uMaxBlur, uTime; varying vec2 vUv;",
            "float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = d * 2.0 - 1.0;",
            "  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }",
            "float coc(vec2 uv){ return clamp((abs(viewZ(uv) - uFocus) - uRange * 0.35) / uRange, 0.0, 1.0); }",
            "vec3 toneMap(vec3 c){ vec3 k = max(c - 0.78, 0.0); return min(c, 0.78) + k / (1.0 + k / 0.22); }",
            "vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }",
            "float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }",
            "void main(){",
            "  float c0 = coc(vUv); float r = c0 * uMaxBlur;",
            "  vec3 sum = texture2D(tColor, vUv).rgb; float wsum = 1.0;",
            "  if (r > 0.3) {",
            "    for (int i = 0; i < 16; i++) {",
            "      float a = float(i) * 2.39996; float rr = sqrt((float(i) + 0.5) / 16.0);",
            "      vec2 o = vec2(cos(a), sin(a)) * rr * r / uRes;",
            "      float cs = coc(vUv + o);",
            "      float w = clamp(cs * uMaxBlur / max(rr * r, 0.001), 0.0, 1.0);",  /* 手前のくっきりした物がにじまないように */
            "      sum += texture2D(tColor, vUv + o).rgb * w; wsum += w;",
            "    }",
            "  }",
            "  vec3 col = sum / wsum;",
            "  col = toneMap(col);",
            "  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));",
            "  col = mix(vec3(l), col, 1.08);",                                  /* 少しだけ鮮やかに */
            "  col *= vec3(1.03, 1.0, 0.95);",                                    /* あたたかい色味 */
            "  col = toSRGB(clamp(col, 0.0, 1.0));",
            "  col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);",              /* 少しコントラスト */
            "  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;",
            "  col *= 1.0 - 0.32 * smoothstep(0.35, 0.95, length(q) * 1.25);",     /* 周辺を暗く */
            "  col += (rnd(vUv * uRes) - 0.5) * 0.025;",                           /* 細かい粒子 */
            "  gl_FragColor = vec4(col, 1.0);",
            "}"
          ].join("\n"),
          depthTest: false, depthWrite: false
        });
        this.postScene = new T.Scene();
        this.postScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.postMat));
        this.postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      }
      return rt;
    } catch (e) { this.postFailed = true; return null; }
  };

  OmuScene.prototype.render = function (ctx, W, H, look, orbit) {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    var r = this.renderer;
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; r.setSize(w, h, false); this.makePost(w, h); }
    this.setView(W, H, look, orbit);
    if (this.rt && !this.postFailed) {
      try {
        var u = this.postMat.uniforms, cam = this.camera;
        u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture;
        u.uRes.value.set(w, h); u.uNear.value = cam.near; u.uFar.value = cam.far;
        u.uFocus.value = cam.position.distanceTo(this.focusPoint || (this.focusPoint = new T.Vector3(0, 0.15, 0)));
        u.uRange.value = 1.4 + u.uFocus.value * 0.06;
        u.uMaxBlur.value = 7 * dpr;
        u.uTime.value = (u.uTime.value + 0.37) % 100;
        r.setRenderTarget(this.rt);
        r.render(this.scene, cam);
        r.setRenderTarget(null);
        r.render(this.postScene, this.postCam);
      } catch (e) { this.postFailed = true; r.setRenderTarget(null); r.render(this.scene, this.camera); }
    } else r.render(this.scene, this.camera);
    ctx.drawImage(r.domElement, 0, 0, W, H);
    return true;
  };

  global.OmuScene = OmuScene;
})(window);
