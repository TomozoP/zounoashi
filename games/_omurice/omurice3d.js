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
      var u = x / s * 10, v = y / s * 10;
      var n = 0.5 + (fbm(u, v, 0.5, 3) - 0.5) * 0.5 + (noise3(u * 14, v * 14, 3) - 0.5) * 0.18;
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
    r.toneMapping = T.LinearToneMapping;
    r.toneMappingExposure = 1.0;
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

    this.inkMat = new T.MeshPhysicalMaterial({ color: 0xb3120a, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.3, sheenColor: new T.Color(0xff5030) });
    this.strokes = [];
    this.ray = new T.Raycaster();
    this.targets = [this.egg, this.plate, this.table];
    this.w = 0; this.h = 0; this.look = 0;
  }

  /* 食卓と、まわりのリビング（床・壁・窓・ソファ・棚・照明・観葉植物）。すべて基本図形で自作 */
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
    var tex = canvasTex(1024, woodColor, 2);
    tex.colorSpace = T.SRGBColorSpace;
    var wood = std(0xffffff, { map: tex, roughness: 0.55 });
    var dark = std(0x5a3b24, { roughness: 0.7 });
    var t = new T.Mesh(new T.PlaneGeometry(14.6, 9.8), wood);
    t.rotation.x = -Math.PI / 2; t.receiveShadow = true;
    this.table = t; S.add(t);
    box(14.6, 0.45, 9.8, dark, 0, -0.23, 0);
    [[-6.6, -4.2], [6.6, -4.2], [-6.6, 4.2], [6.6, 4.2]].forEach(function (p) { box(0.6, 8.4, 0.6, dark, p[0], -4.65, p[1]); });
    var FLOOR = -8.85;
    /* 椅子（左右に1脚ずつ） */
    var chair = std(0x7a5536, { roughness: 0.7 }), cushion = std(0xd8cbb3, { roughness: 1 });
    [-1, 1].forEach(function (s) {
      var cx = s * 9.6;
      box(4.6, 0.4, 4.6, chair, cx, FLOOR + 5.4, 0);
      box(4.4, 0.5, 4.4, cushion, cx, FLOOR + 5.85, 0);
      box(0.4, 6, 4.6, chair, cx + s * 2.1, FLOOR + 8.6, 0);
      [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]].forEach(function (p) { box(0.35, 5.2, 0.35, chair, cx + p[0], FLOOR + 2.6, p[1]); });
    });
    /* 床（フローリング）とラグ */
    var ftex = canvasTex(1024, function (g, s) {
      woodColor(g, s);
      g.strokeStyle = "rgba(40,24,12,.5)"; g.lineWidth = 2;
      for (var i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, i * s / 8); g.lineTo(s, i * s / 8); g.stroke(); }
      for (i = 0; i < 16; i++) { var y = Math.floor(i / 2) * s / 8, x = (i % 2 ? 0.3 : 0.75) * s + (i * 97 % 130); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + s / 8); g.stroke(); }
    }, 6);
    ftex.colorSpace = T.SRGBColorSpace;
    var floor = new T.Mesh(new T.PlaneGeometry(70, 70), std(0xd9c2a0, { map: ftex, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; S.add(floor);
    var rug = new T.Mesh(new T.CircleGeometry(13, 48), std(0xb9a58c, { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = FLOOR + 0.05; rug.scale.set(1.3, 1, 1); S.add(rug);
    /* 壁（あたたかい白）と天井 */
    var wall = std(0xece4d6, { roughness: 0.95, side: T.BackSide });
    var room = new T.Mesh(new T.BoxGeometry(70, 34, 70), wall);
    room.position.y = FLOOR + 17; S.add(room);
    /* 奥の壁の大きな窓（明るい外とレースのカーテン） */
    var sky = new T.MeshBasicMaterial({ color: 0xdff0ff });
    var win = new T.Mesh(new T.PlaneGeometry(22, 14), sky);
    win.position.set(-6, FLOOR + 14, -34.9); S.add(win);
    var frame = std(0xf5f2ec, { roughness: 0.5 });
    box(22.8, 0.6, 0.4, frame, -6, FLOOR + 21, -34.7); box(22.8, 0.6, 0.4, frame, -6, FLOOR + 7, -34.7);
    box(0.6, 14.6, 0.4, frame, -17.1, FLOOR + 14, -34.7); box(0.6, 14.6, 0.4, frame, 5.1, FLOOR + 14, -34.7); box(0.4, 14, 0.4, frame, -6, FLOOR + 14, -34.7);
    var lace = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 1, side: T.DoubleSide });
    var cur = std(0xc9b48f, { roughness: 1 });
    box(4, 22, 0.6, cur, -19.5, FLOOR + 11.5, -34.2); box(4, 22, 0.6, cur, 7.5, FLOOR + 11.5, -34.2);
    var l = new T.Mesh(new T.PlaneGeometry(8, 15), lace); l.position.set(-13.5, FLOOR + 13.5, -34.3); S.add(l);
    /* 奥のソファとクッション */
    var sofa = std(0x6e7f8c, { roughness: 1 });
    box(20, 3.5, 7, sofa, 8, FLOOR + 3, -26, true); box(20, 6, 2.2, sofa, 8, FLOOR + 6.5, -28.6, true);
    box(2.2, 5, 7, sofa, -1, FLOOR + 4.2, -26, true); box(2.2, 5, 7, sofa, 17, FLOOR + 4.2, -26, true);
    box(3.6, 3.4, 1.2, std(0xe3b54a, { roughness: 1 }), 3, FLOOR + 6.4, -26.8); box(3.6, 3.4, 1.2, std(0xe9e1d2, { roughness: 1 }), 13, FLOOR + 6.4, -26.8);
    /* 左の本棚 */
    var shelf = std(0x8a6444, { roughness: 0.7 });
    box(2.4, 22, 12, shelf, -33.6, FLOOR + 11, -10, true);
    var bookCols = [0x8c3b2e, 0x2f5d6e, 0xd8c08a, 0x3e6b45, 0xa65b2a, 0x51476e, 0xe4dccb];
    for (var row = 0; row < 4; row++) {
      box(2.4, 0.4, 12, shelf, -32.4, FLOOR + 2 + row * 5, -10);
      var z = -15.4;
      for (var bk = 0; z < -4.8; bk++) {
        var bw = 0.6 + ((bk * 7 + row * 3) % 5) * 0.15, bh = 3 + ((bk * 5 + row) % 4) * 0.35;
        box(1.8, bh, bw, std(bookCols[(bk + row * 2) % bookCols.length], { roughness: 0.9 }), -32.2, FLOOR + 2.2 + row * 5 + bh / 2, z + bw / 2);
        z += bw + 0.08;
      }
    }
    /* 右の観葉植物 */
    box(3, 3.6, 3, std(0xe8e2d8, { roughness: 0.6 }), 26, FLOOR + 1.8, -22, true);
    var leaf = std(0x3f6e3a, { roughness: 0.8 });
    for (var k = 0; k < 14; k++) {
      var a = k * 2.4, h = 4 + (k % 5) * 1.6;
      var lf = new T.Mesh(new T.SphereGeometry(1, 12, 8), leaf);
      lf.scale.set(1.8, 0.5, 0.9); lf.position.set(26 + Math.cos(a) * 1.6, FLOOR + h + 2, -22 + Math.sin(a) * 1.6);
      lf.rotation.set(0.3 * Math.sin(k), a, 0.5 * Math.cos(k)); lf.castShadow = true; S.add(lf);
    }
    /* 右の壁: テレビ台とテレビ、額の絵 */
    box(3.5, 4, 18, std(0x6b4a32, { roughness: 0.7 }), 33, FLOOR + 2, 4, true);
    box(0.6, 9, 16, std(0x111111, { roughness: 0.3 }), 33.6, FLOOR + 9.5, 4);
    var tvGlow = new T.Mesh(new T.PlaneGeometry(15, 8.2), new T.MeshBasicMaterial({ color: 0x1b2633 }));
    tvGlow.rotation.y = -Math.PI / 2; tvGlow.position.set(33.25, FLOOR + 9.5, 4); S.add(tvGlow);
    function picture(x, y, z, ry, w, h, cols) {
      var g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; S.add(g);
      var fr = new T.Mesh(new T.BoxGeometry(w + 0.8, h + 0.8, 0.3), std(0x3a2a1c, { roughness: 0.6 })); g.add(fr);
      var c = document.createElement("canvas"); c.width = 128; c.height = 128;
      var cg = c.getContext("2d"), gr = cg.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, cols[0]); gr.addColorStop(0.6, cols[1]); gr.addColorStop(1, cols[2]);
      cg.fillStyle = gr; cg.fillRect(0, 0, 128, 128);
      cg.fillStyle = cols[3]; cg.beginPath(); cg.arc(40, 50, 14, 0, 7); cg.fill();
      cg.fillStyle = cols[2]; cg.beginPath(); cg.moveTo(0, 128); cg.lineTo(50, 70); cg.lineTo(90, 100); cg.lineTo(128, 60); cg.lineTo(128, 128); cg.fill();
      var tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
      var art = new T.Mesh(new T.PlaneGeometry(w, h), std(0xffffff, { map: tx, roughness: 0.9 }));
      art.position.z = 0.16; g.add(art);
    }
    picture(34.7, FLOOR + 20, -12, -Math.PI / 2, 7, 5, ["#9fc3d9", "#e8d9b0", "#6d8a5a", "#f3c96b"]);
    /* 手前の壁: ドアと時計と絵 */
    box(8, 17, 0.4, std(0xc9ab84, { roughness: 0.6 }), 14, FLOOR + 8.5, 34.8);
    var knob = new T.Mesh(new T.SphereGeometry(0.35, 12, 8), std(0xc8b07a, { metalness: 0.8, roughness: 0.3 }));
    knob.position.set(11, FLOOR + 8.5, 34.4); S.add(knob);
    var clock = new T.Mesh(new T.CylinderGeometry(2, 2, 0.4, 40), std(0xf6f3ee, { roughness: 0.5 }));
    clock.rotation.x = Math.PI / 2; clock.position.set(-6, FLOOR + 21, 34.7); S.add(clock);
    var rim = new T.Mesh(new T.TorusGeometry(2, 0.18, 8, 40), std(0x2b2b2b, { roughness: 0.4 }));
    rim.position.set(-6, FLOOR + 21, 34.6); S.add(rim);
    box(0.15, 1.4, 0.1, std(0x222222), -6, FLOOR + 21.6, 34.4).rotation.z = 0.5;
    box(0.12, 1.0, 0.1, std(0x222222), -6.3, FLOOR + 20.6, 34.4).rotation.z = -2.2;
    picture(-20, FLOOR + 16, 34.7, Math.PI, 9, 6, ["#f2b38a", "#f6e2c4", "#b9875a", "#ffffff"]);
    /* 左の壁にも小さな絵 */
    picture(-34.7, FLOOR + 20, 12, Math.PI / 2, 5, 6, ["#c7d7c0", "#e9e2d0", "#7f9a7a", "#d96c4f"]);
    /* 食卓の上のペンダントライト */
    var shade = new T.Mesh(new T.ConeGeometry(2.2, 1.8, 32, 1, true), std(0x2e2a26, { roughness: 0.5, side: T.DoubleSide }));
    shade.position.set(0, 13, 0); S.add(shade);
    var bulb = new T.Mesh(new T.SphereGeometry(0.5, 16, 10), new T.MeshBasicMaterial({ color: 0xfff1cc }));
    bulb.position.set(0, 12.3, 0); S.add(bulb);
    box(0.08, 12, 0.08, std(0x222222), 0, 19.9, 0);
    var lamp = new T.PointLight(0xffd9a0, 30, 40, 2);
    lamp.position.set(0, 12, 0); S.add(lamp);
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

  OmuScene.prototype.render = function (ctx, W, H, look, orbit) {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.renderer.setSize(w, h, false); }
    this.setView(W, H, look, orbit);
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  global.OmuScene = OmuScene;
})(window);
