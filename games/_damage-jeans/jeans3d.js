/* ダメージジーンズシミュレーターの立体の絵。ジーンズ・カッターマット・机は、すべて基本図形と手続きの模様から自作。
   three.js は random-bowling の既存配布物（MIT）を使う。
   単位: 1 = 10cm。ジーンズの絵（1024x2048）が 5.25 x 10.5 に広がる。y が上、腰が奥(-z)・すそが手前(+z)。 */
(function (global) {
  "use strict";
  var T;
  var TW = 1024, TH = 2048, PX = 195;
  var JW = TW / PX, JL = TH / PX;

  function hash2(x, y) { var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
  function rngOf(seed) {
    var R = seed % 2147483647; if (R <= 0) R += 2147483646;
    return function () { R = (R * 16807) % 2147483647; return (R - 1) / 2147483646; };
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function canvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  /* ---- ジーンズの形（絵の座標 px） ---- */
  var CROTCH = 572;
  function outline(g) {
    g.beginPath();
    g.moveTo(114, 58); g.lineTo(910, 58);
    g.bezierCurveTo(918, 220, 930, 360, 930, 520);
    g.lineTo(916, 1992);
    g.lineTo(548, 1998);
    g.lineTo(522, 610);
    g.quadraticCurveTo(512, CROTCH - 6, 502, 610);
    g.lineTo(476, 1998);
    g.lineTo(108, 1992);
    g.lineTo(94, 520);
    g.bezierCurveTo(94, 360, 106, 220, 114, 58);
    g.closePath();
  }
  /* 縫い目の線（金茶の糸、点線） */
  function stitch(g, path, w) {
    g.save();
    g.lineCap = "round"; g.setLineDash([7, 5]);
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = (w || 2.6) + 1.2;
    g.translate(0.8, 1.2); path(); g.stroke();
    g.translate(-0.8, -1.2);
    g.strokeStyle = "#d6a04a"; g.lineWidth = w || 2.6; path(); g.stroke();
    g.restore();
  }
  function line(g, pts) { return function () { g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); }; }

  /* 色ごと（濃紺の生、中くらい、色落ち、黒） */
  var SHADES = [
    { warp: [26, 40, 74], wash: 0.12, pale: [168, 184, 206] },
    { warp: [42, 70, 118], wash: 0.35, pale: [182, 198, 220] },
    { warp: [78, 112, 160], wash: 0.55, pale: [196, 210, 228] },
    { warp: [34, 34, 40], wash: 0.25, pale: [170, 170, 172] }
  ];

  function JeansScene() {
    T = global.THREE;
    var r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.LinearToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    var S = this.scene = new T.Scene();
    S.background = new T.Color(0x2a221c);
    this.camera = new T.PerspectiveCamera(32, 540 / 960, 1, 120);

    /* 映り込み用の部屋 */
    var env = new T.Scene();
    var room = new T.Mesh(new T.SphereGeometry(20, 32, 16), new T.MeshBasicMaterial({ side: T.BackSide, vertexColors: true }));
    var pos = room.geometry.attributes.position, cols = [];
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 20, x = pos.getX(i) / 20, z = pos.getZ(i) / 20;
      var win = Math.max(0, 1 - Math.hypot(x + 0.5, y - 0.55, z + 0.35) * 2.2);
      var base = 0.2 + 0.32 * Math.max(0, y);
      cols.push(base * 1.05 + win * 3, base + win * 3, base * 0.9 + win * 2.9);
    }
    room.geometry.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    env.add(room);
    S.environment = new T.PMREMGenerator(r).fromScene(env, 0.02).texture;

    S.add(new T.HemisphereLight(0xfff4e6, 0x3a3028, 0.55));
    var key = new T.DirectionalLight(0xfff2de, 2.4);
    key.position.set(-7, 6.5, -3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    var sc = key.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 6.5; sc.bottom = -6.5; sc.near = 1; sc.far = 25;
    key.shadow.radius = 4; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.015;
    S.add(key);
    var fill = new T.DirectionalLight(0xcfe0ff, 0.35);
    fill.position.set(4, 3, 5); S.add(fill);

    this.buildRoom();
    this.buildJeans();
    this.w = 0; this.h = 0;
  }

  /* 机とカッターマット、奥の壁 */
  JeansScene.prototype.buildRoom = function () {
    var S = this.scene;
    var wood = canvas(512, 512), g = wood.getContext("2d");
    g.fillStyle = "#7a5638"; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 260; i++) {
      var y = Math.random() * 512;
      g.strokeStyle = "rgba(" + (Math.random() < 0.5 ? "40,24,12" : "150,110,70") + "," + (0.05 + Math.random() * 0.12) + ")";
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath(); g.moveTo(0, y);
      for (var x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
      g.stroke();
    }
    var wt = new T.CanvasTexture(wood); wt.colorSpace = T.SRGBColorSpace; wt.wrapS = wt.wrapT = T.RepeatWrapping; wt.repeat.set(3, 3);
    var table = new T.Mesh(new T.BoxGeometry(30, 0.6, 30), new T.MeshStandardMaterial({ map: wt, roughness: 0.6 }));
    table.position.set(0, -0.36, 0); table.receiveShadow = true; S.add(table);

    /* カッターマット（緑地に1cmの方眼、5cmごとに太い線） */
    var mc = canvas(1024, 1434), m = mc.getContext("2d");
    m.fillStyle = "#2d6a4f"; m.fillRect(0, 0, 1024, 1434);
    for (var k = 0; k < 9000; k++) { m.fillStyle = "rgba(0,0,0," + Math.random() * 0.05 + ")"; m.fillRect(Math.random() * 1024, Math.random() * 1434, 2, 2); }
    var cm = 1024 / 90;
    for (var gx = 0; gx * cm <= 1024; gx++) {
      m.strokeStyle = gx % 5 ? "rgba(220,240,225,.28)" : "rgba(230,250,235,.55)"; m.lineWidth = gx % 5 ? 1 : 2;
      m.beginPath(); m.moveTo(gx * cm + 0.5, 0); m.lineTo(gx * cm + 0.5, 1434); m.stroke();
    }
    for (var gy = 0; gy * cm <= 1434; gy++) {
      m.strokeStyle = gy % 5 ? "rgba(220,240,225,.28)" : "rgba(230,250,235,.55)"; m.lineWidth = gy % 5 ? 1 : 2;
      m.beginPath(); m.moveTo(0, gy * cm + 0.5); m.lineTo(1024, gy * cm + 0.5); m.stroke();
    }
    /* 前に使った切り傷 */
    for (var s = 0; s < 40; s++) {
      var x0 = Math.random() * 1024, y0 = Math.random() * 1434, a = Math.random() * 6.28, l = 20 + Math.random() * 140;
      m.strokeStyle = "rgba(160,200,170,.25)"; m.lineWidth = 1;
      m.beginPath(); m.moveTo(x0, y0); m.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); m.stroke();
    }
    var mt = new T.CanvasTexture(mc); mt.colorSpace = T.SRGBColorSpace; mt.anisotropy = 8;
    var mat = new T.Mesh(new T.BoxGeometry(9, 0.04, 12.6), new T.MeshStandardMaterial({ map: mt, roughness: 0.75 }));
    mat.position.set(0, -0.04, 0.2); mat.receiveShadow = true; S.add(mat);

    var wall = new T.Mesh(new T.PlaneGeometry(40, 16), new T.MeshStandardMaterial({ color: 0xe8ddcc, roughness: 0.95 }));
    wall.position.set(0, 7, -15); S.add(wall);
  };

  /* ---- ジーンズ ---- */
  JeansScene.prototype.buildJeans = function () {
    /* 形の型（中が不透明） */
    var mk = canvas(TW, TH), mg = mk.getContext("2d");
    mg.fillStyle = "#fff"; outline(mg); mg.fill();
    var md = mg.getImageData(0, 0, TW, TH).data;
    var shape = this.shape = new Uint8Array(TW * TH);
    var area = 0;
    for (var i = 0; i < TW * TH; i++) { shape[i] = md[i * 4 + 3]; if (shape[i] > 127) area++; }
    this.area = area;

    this.colorCv = canvas(TW, TH); this.colorG = this.colorCv.getContext("2d");
    this.cut = new Uint8Array(TW * TH);      /* 切った量（0..255 → 0..2.55） */
    this.cur = new Uint8Array(TW * TH);      /* 今の一筋で切った量（筋の中では重ねがけしない） */
    this.fade = new Uint8Array(TW * TH);     /* 削って色が落ちた量 */

    /* 表の布 */
    var geo = new T.PlaneGeometry(JW, JL, 128, 256);
    geo.rotateX(-Math.PI / 2);
    this.puff(geo);
    this.colorTex = new T.CanvasTexture(this.colorCv);
    this.colorTex.colorSpace = T.SRGBColorSpace; this.colorTex.anisotropy = 8;
    this.bumpCv = canvas(TW, TH);
    this.bumpTex = new T.CanvasTexture(this.bumpCv); this.bumpTex.anisotropy = 8;
    var front = this.front = new T.Mesh(geo, new T.MeshStandardMaterial({
      map: this.colorTex, bumpMap: this.bumpTex, bumpScale: 1.4, roughness: 0.93, alphaTest: 0.5, side: T.DoubleSide
    }));
    front.castShadow = true; front.receiveShadow = true;
    this.scene.add(front);

    /* 裏の布（穴から見える内側。白っぽい裏地と、ポケットの袋） */
    this.backCv = canvas(512, 1024);
    this.backTex = new T.CanvasTexture(this.backCv); this.backTex.colorSpace = T.SRGBColorSpace;
    var bgeo = new T.PlaneGeometry(JW, JL, 1, 1); bgeo.rotateX(-Math.PI / 2);
    var back = this.back = new T.Mesh(bgeo, new T.MeshStandardMaterial({ map: this.backTex, roughness: 0.95, alphaTest: 0.5 }));
    back.position.y = 0.004; back.receiveShadow = true;
    this.scene.add(back);

    /* ボタンとリベット（金属） */
    var metal = this.metal = new T.MeshStandardMaterial({ color: 0xb8854a, metalness: 1, roughness: 0.32 });
    var self = this;
    function stud(px, py, r, h) {
      var m = new T.Mesh(new T.CylinderGeometry(r, r * 1.05, h, 28), metal);
      var p = self.toWorld(px, py);
      m.position.set(p.x, self.heightAt(px, py) + h / 2 - 0.004, p.z);
      m.castShadow = true; self.scene.add(m);
      return m;
    }
    stud(512, 96, 0.085, 0.035);
    var top = stud(512, 96, 0.06, 0.05); top.position.y += 0.012;
    [[236, 142], [788, 142], [112, 352], [912, 352], [172, 150], [292, 150]].forEach(function (p) { stud(p[0], p[1], 0.03, 0.022); });
  };

  /* 絵の座標 → 世界の座標 */
  JeansScene.prototype.toWorld = function (px, py) { return { x: (px / TW - 0.5) * JW, z: (py / TH - 0.5) * JL }; };
  /* ふくらみ。縁からの距離で丸く盛り上げ、ゆるいしわを足す */
  JeansScene.prototype.puff = function (geo) {
    var NX = 129, NZ = 257, shape = this.shape;
    var inside = new Uint8Array(NX * NZ), dist = new Float32Array(NX * NZ);
    for (var j = 0; j < NZ; j++) for (var i = 0; i < NX; i++) {
      var px = Math.min(TW - 1, Math.round(i / 128 * TW)), py = Math.min(TH - 1, Math.round(j / 256 * TH));
      inside[j * NX + i] = shape[py * TW + px] > 127 ? 1 : 0;
      dist[j * NX + i] = inside[j * NX + i] ? 1e9 : 0;
    }
    /* 縁までの近似距離（2回なめる） */
    for (j = 0; j < NZ; j++) for (i = 0; i < NX; i++) {
      var k = j * NX + i; if (!dist[k]) continue;
      if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + 1);
      if (j > 0) dist[k] = Math.min(dist[k], dist[k - NX] + 1);
      if (i > 0 && j > 0) dist[k] = Math.min(dist[k], dist[k - NX - 1] + 1.414);
      if (i < NX - 1 && j > 0) dist[k] = Math.min(dist[k], dist[k - NX + 1] + 1.414);
    }
    for (j = NZ - 1; j >= 0; j--) for (i = NX - 1; i >= 0; i--) {
      k = j * NX + i; if (!dist[k]) continue;
      if (i < NX - 1) dist[k] = Math.min(dist[k], dist[k + 1] + 1);
      if (j < NZ - 1) dist[k] = Math.min(dist[k], dist[k + NX] + 1);
      if (i < NX - 1 && j < NZ - 1) dist[k] = Math.min(dist[k], dist[k + NX + 1] + 1.414);
      if (i > 0 && j < NZ - 1) dist[k] = Math.min(dist[k], dist[k + NX - 1] + 1.414);
    }
    this.hgrid = new Float32Array(NX * NZ);
    var pos = geo.attributes.position;
    /* PlaneGeometry の頂点は上の段(奥)から順。uv の v=1 が絵の上 */
    for (var n = 0; n < pos.count; n++) {
      i = n % NX; j = Math.floor(n / NX);
      k = j * NX + i;
      var h = 0;
      if (inside[k]) {
        var t = Math.min(1, dist[k] / 13);
        h = 0.008 + 0.2 * (1 - (1 - t) * (1 - t));
        var wx = i / 128, wz = j / 256;
        h += 0.07 * t * (vnoise(wx * 7, wz * 18) - 0.5);
        h += 0.04 * t * Math.max(0, Math.sin(wz * 60 + vnoise(wx * 4, wz * 4) * 4)) * (wz > 0.55 && wz < 0.75 ? 1 : 0.3);
        if (wz < 0.07) h += 0.02 * t;          /* 腰帯は厚い */
      }
      this.hgrid[k] = h;
      pos.setY(n, h);
    }
    geo.computeVertexNormals();
  };
  JeansScene.prototype.heightAt = function (px, py) {
    var i = Math.max(0, Math.min(128, Math.round(px / TW * 128))), j = Math.max(0, Math.min(256, Math.round(py / TH * 256)));
    return this.hgrid[j * 129 + i];
  };

  /* 新しいジーンズ（色と色落ちを変える） */
  JeansScene.prototype.newJeans = function (seed) {
    var rnd = rngOf(seed);
    var sh = this.shade = SHADES[Math.floor(rnd() * SHADES.length)];
    this.cut.fill(0); this.cur.fill(0); this.fade.fill(0);
    this.paintBase(sh, rnd);
    this.paintBump();
    this.paintBack(sh);
    this.refresh(0, 0, TW, TH);
    this.metal.color.set(rnd() < 0.5 ? 0xb8854a : 0xbfc3c6);
    this.bumpTex.needsUpdate = true; this.backTex.needsUpdate = true;
  };

  /* 表の模様: 綾織りの濃紺、色むら、ヒゲ、縫い目、ポケット */
  JeansScene.prototype.paintBase = function (sh, rnd) {
    var g = this.colorG;
    var img = g.createImageData(TW, TH), d = img.data;
    var col = new Float32Array(TW);
    for (var x = 0; x < TW; x++) col[x] = 0.86 + 0.14 * vnoise(x * 0.35, 3.1) + 0.06 * (hash2(x, 7) - 0.5);
    var wr = sh.warp[0], wgc = sh.warp[1], wb = sh.warp[2];
    for (var y = 0; y < TH; y++) {
      var row = 0.95 + 0.05 * vnoise(1.7, y * 0.02);
      for (x = 0; x < TW; x++) {
        var tw = ((x + (y >> 1)) & 3) === 0 ? 1.18 : 1;   /* 斜めの綾 */
        var slub = col[x] * row * (0.92 + 0.16 * vnoise(x * 0.08, y * 0.004)) * tw;
        var spk = hash2(x, y) < 0.06 ? 1.5 : 1;          /* 白い横糸がちらりと見える */
        var i = (y * TW + x) * 4;
        d[i] = Math.min(255, wr * slub * spk); d[i + 1] = Math.min(255, wgc * slub * spk); d[i + 2] = Math.min(255, wb * slub * spk); d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);

    var pr = sh.pale, paleC = "rgba(" + pr[0] + "," + pr[1] + "," + pr[2] + ",";
    g.save();
    outline(g); g.clip();
    g.globalCompositeOperation = "screen";
    /* 腿とひざの色落ち */
    var w = sh.wash;
    [[300, 900, 230, 520], [724, 900, 230, 520], [300, 1380, 150, 200], [724, 1380, 150, 200]].forEach(function (e) {
      var gr = g.createRadialGradient(e[0], e[1], 0, e[0], e[1], e[3]);
      gr.addColorStop(0, paleC + (0.5 * w) + ")"); gr.addColorStop(1, paleC + "0)");
      g.save(); g.translate(e[0], e[1]); g.scale(e[2] / e[3], 1); g.translate(-e[0], -e[1]);
      g.fillStyle = gr; g.fillRect(e[0] - e[3], e[1] - e[3], e[3] * 2, e[3] * 2); g.restore();
    });
    /* 股のまわりのヒゲ（横に伸びる色落ちの筋） */
    for (var s = -1; s <= 1; s += 2) for (var k = 0; k < 6; k++) {
      var y0 = CROTCH + 10 + k * 34 + rnd() * 10, len = 150 + rnd() * 120;
      var gr2 = g.createLinearGradient(512, y0, 512 - s * len, y0 - 40);
      gr2.addColorStop(0, paleC + (0.35 + 0.4 * w) + ")"); gr2.addColorStop(1, paleC + "0)");
      g.strokeStyle = gr2; g.lineWidth = 5 + rnd() * 6; g.lineCap = "round";
      g.beginPath(); g.moveTo(512 - s * 30, y0); g.quadraticCurveTo(512 - s * (40 + len * 0.5), y0 - 6, 512 - s * (40 + len), y0 - 40 - rnd() * 30); g.stroke();
    }
    /* 縫い目の縁のあたり（すれて白っぽい） */
    g.lineWidth = 16; g.strokeStyle = paleC + (0.25 + 0.3 * w) + ")";
    outline(g); g.stroke();
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(114, 58); g.lineTo(910, 58); g.stroke();
    g.beginPath(); g.moveTo(108, 1992); g.lineTo(476, 1998); g.moveTo(548, 1998); g.lineTo(916, 1992); g.stroke();
    g.globalCompositeOperation = "source-over";

    /* 腰帯の下の線とポケットの口の影 */
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(100, 134); g.lineTo(924, 134); g.stroke();
    function pocketL() { g.beginPath(); g.moveTo(236, 136); g.quadraticCurveTo(206, 318, 98, 352); }
    function pocketR() { g.beginPath(); g.moveTo(788, 136); g.quadraticCurveTo(818, 318, 926, 352); }
    g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,.5)"; pocketL(); g.stroke(); pocketR(); g.stroke();
    g.lineWidth = 6; g.strokeStyle = paleC + ".35)";
    g.save(); g.translate(4, -4); pocketL(); g.stroke(); g.restore();
    g.save(); g.translate(-4, -4); pocketR(); g.stroke(); g.restore();
    /* 前の合わせ目 */
    g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(512, 136); g.lineTo(512, CROTCH); g.stroke();
    /* ベルト通し */
    [176, 338, 686, 848].forEach(function (x) {
      g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x - 17, 46, 38, 98);
      g.fillStyle = "rgba(" + sh.warp.map(function (v) { return Math.round(v * 1.15); }).join(",") + ",1)"; g.fillRect(x - 18, 44, 36, 96);
      g.globalCompositeOperation = "screen"; g.fillStyle = paleC + (0.25 + 0.3 * w) + ")"; g.fillRect(x - 18, 44, 36, 8); g.fillRect(x - 18, 132, 36, 8);
      g.globalCompositeOperation = "source-over";
    });
    g.restore();

    /* 縫い目 */
    stitch(g, line(g, [104, 68, 920, 68]));
    stitch(g, line(g, [102, 124, 922, 124]));
    stitch(g, function () { g.beginPath(); g.moveTo(230, 138); g.quadraticCurveTo(198, 330, 98, 366); });
    stitch(g, function () { g.beginPath(); g.moveTo(248, 138); g.quadraticCurveTo(220, 336, 98, 380); });
    stitch(g, function () { g.beginPath(); g.moveTo(794, 138); g.quadraticCurveTo(826, 330, 926, 366); });
    stitch(g, function () { g.beginPath(); g.moveTo(776, 138); g.quadraticCurveTo(804, 336, 926, 380); });
    stitch(g, function () { g.beginPath(); g.moveTo(436, 136); g.lineTo(436, 470); g.quadraticCurveTo(440, 538, 508, 548); });
    stitch(g, function () { g.beginPath(); g.moveTo(448, 136); g.lineTo(448, 466); g.quadraticCurveTo(452, 526, 508, 534); });
    /* コインポケット */
    stitch(g, line(g, [160, 150, 160, 262]));
    stitch(g, line(g, [304, 150, 296, 250]));
    stitch(g, line(g, [162, 162, 302, 162]));
    stitch(g, line(g, [162, 174, 302, 174]));
    /* 股下の縫い目（二本） */
    stitch(g, line(g, [496, 620, 466, 1984]));
    stitch(g, line(g, [486, 640, 456, 1984]));
    stitch(g, line(g, [528, 620, 558, 1984]));
    stitch(g, line(g, [538, 640, 568, 1984]));
    /* すそ */
    stitch(g, line(g, [112, 1956, 474, 1962]));
    stitch(g, line(g, [550, 1962, 912, 1956]));
    g.save(); g.globalCompositeOperation = "source-atop"; g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(108, 1944); g.lineTo(476, 1950); g.moveTo(548, 1950); g.lineTo(916, 1944); g.stroke(); g.restore();
    /* ベルト通しの留め */
    [176, 338, 686, 848].forEach(function (x) { stitch(g, line(g, [x - 12, 52, x + 12, 52]), 3); stitch(g, line(g, [x - 12, 132, x + 12, 132]), 3); });

    /* 外は透明に */
    var all = g.getImageData(0, 0, TW, TH), ad = all.data, shp = this.shape;
    for (var n = 0; n < TW * TH; n++) ad[n * 4 + 3] = shp[n];
    this.baseData = ad;
    this.img = all;
  };

  /* 凹凸: 綾の目、縫い目の盛り上がり、しわ */
  JeansScene.prototype.paintBump = function () {
    var g = this.bumpCv.getContext("2d");
    var img = g.createImageData(TW, TH), d = img.data;
    for (var y = 0; y < TH; y++) for (var x = 0; x < TW; x++) {
      var v = 128 + (((x + (y >> 1)) & 3) < 2 ? 14 : -14) + (hash2(x, y) - 0.5) * 16;
      var i = (y * TW + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.lineCap = "round";
    function ridge(path, w) { g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = w; path(); g.stroke(); g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 2; path(); g.stroke(); }
    ridge(line(g, [100, 134, 924, 134]), 10);
    ridge(function () { g.beginPath(); g.moveTo(236, 136); g.quadraticCurveTo(206, 318, 98, 352); }, 12);
    ridge(function () { g.beginPath(); g.moveTo(788, 136); g.quadraticCurveTo(818, 318, 926, 352); }, 12);
    ridge(line(g, [512, 136, 512, CROTCH]), 8);
    ridge(line(g, [492, 620, 462, 1984]), 12);
    ridge(line(g, [532, 620, 562, 1984]), 12);
    ridge(line(g, [108, 1950, 476, 1956]), 10);
    ridge(line(g, [548, 1956, 916, 1950]), 10);
    [176, 338, 686, 848].forEach(function (x) { g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x - 18, 44, 36, 96); });
    /* ひざ裏とすその横じわ */
    for (var k = 0; k < 40; k++) {
      var leg = k % 2, x0 = leg ? 560 + Math.random() * 300 : 130 + Math.random() * 300;
      var y0 = k < 20 ? 1250 + Math.random() * 300 : 1700 + Math.random() * 230;
      g.strokeStyle = "rgba(255,255,255," + (0.08 + Math.random() * 0.12) + ")"; g.lineWidth = 6 + Math.random() * 10;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + 60, y0 + (Math.random() - 0.5) * 30, x0 + 80 + Math.random() * 80, y0 + (Math.random() - 0.5) * 40); g.stroke();
    }
    this.bumpBase = g.getImageData(0, 0, TW, TH);
  };

  /* 裏の布: 裏返しのデニム（白っぽい）と白いポケットの袋 */
  JeansScene.prototype.paintBack = function (sh) {
    var c = this.backCv, g = c.getContext("2d"), s = 0.5;
    var img = g.createImageData(512, 1024), d = img.data;
    for (var y = 0; y < 1024; y++) for (var x = 0; x < 512; x++) {
      var t = 0.82 + 0.1 * vnoise(x * 0.3, y * 0.01) + (((x + y) & 3) === 0 ? -0.06 : 0);
      var i = (y * 512 + x) * 4;
      d[i] = sh.pale[0] * 0.42 * t; d[i + 1] = sh.pale[1] * 0.42 * t; d[i + 2] = sh.pale[2] * 0.45 * t; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.save(); g.scale(s, s);
    g.fillStyle = "#8f8a80";
    [[120, 130, 420, 640], [604, 130, 904, 640]].forEach(function (b) {
      g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[2], b[1]); g.lineTo(b[2], b[3] - 120); g.quadraticCurveTo((b[0] + b[2]) / 2, b[3] + 40, b[0], b[3] - 120); g.closePath(); g.fill();
    });
    g.globalCompositeOperation = "destination-in"; g.fillStyle = "#fff"; outline(g); g.fill();
    g.restore();
  };

  /* 指定の範囲の色を、元の色・色落ち・切り口から作り直す */
  JeansScene.prototype.refresh = function (x0, y0, x1, y1) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(TW, Math.ceil(x1)); y1 = Math.min(TH, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    var base = this.baseData, d = this.img.data, cut = this.cut, cur = this.cur, fade = this.fade, shp = this.shape;
    var pr = this.shade.pale;
    for (var y = y0; y < y1; y++) {
      var row = y % 7, thread = row < 3, rowLight = 0.82 + 0.18 * hash2(3, Math.floor(y / 7));
      if (row === 2) rowLight *= 0.75;
      for (var x = x0; x < x1; x++) {
        var n = y * TW + x, i = n * 4;
        if (shp[n] < 128) { d[i + 3] = 0; continue; }
        var r = base[i], gg = base[i + 1], b = base[i + 2], a = 255;
        var f = fade[n] / 255;
        if (f > 0) {
          var k = f * (0.7 + 0.3 * hash2(x * 0.7, y * 1.3));
          r += (pr[0] - r) * k; gg += (pr[1] - gg) * k; b += (pr[2] - b) * k;
        }
        var m = (cut[n] + cur[n]) / 100;
        if (m >= 0.5) {
          /* 穴: 白い横糸だけが残る。たくさん切ると糸も切れる */
          var brk = 1.25 + 0.9 * hash2(Math.floor(y / 7), Math.floor(x / 37) + 0.5);
          if (thread && m < brk) {
            var wv = 0.9 + 0.1 * Math.sin(x * 0.4 + y);
            r = 236 * rowLight * wv; gg = 232 * rowLight * wv; b = 222 * rowLight * wv;
          } else a = 0;
        } else if (m >= 0.16) {
          /* ほつれ: 切れた縦糸の白い毛羽 */
          var p = (m - 0.16) / 0.34;
          var h = hash2(x * 1.7, Math.floor(y / 2) + 0.3);
          if (h < p * 0.9) { var lv = 0.8 + 0.2 * hash2(x, y); r = 222 * lv; gg = 220 * lv; b = 212 * lv; }
          else { r += (pr[0] - r) * p * 0.6; gg += (pr[1] - gg) * p * 0.6; b += (pr[2] - b) * p * 0.6; }
        }
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = a;
      }
    }
    this.colorG.putImageData(this.img, 0, 0, x0, y0, x1 - x0, y1 - y0);
    this.dirty = true;
  };

  /* 画面の点(0..1) → 絵の座標。ジーンズの上でなければ null */
  JeansScene.prototype.pick = function (nx, ny) {
    var cam = this.camera;
    var v = new T.Vector3(nx * 2 - 1, 1 - ny * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    if (v.y >= -0.01) return null;
    var t = (0.08 - cam.position.y) / v.y;
    var x = cam.position.x + v.x * t, z = cam.position.z + v.z * t;
    var px = (x / JW + 0.5) * TW, py = (z / JL + 0.5) * TH;
    if (px < 0 || py < 0 || px >= TW || py >= TH) return null;
    return { x: px, y: py, on: this.shape[Math.floor(py) * TW + Math.floor(px)] > 127 };
  };

  /* 切る: 線分に沿って細長い切り口。一筋の中では重ねがけしない */
  JeansScene.prototype.slash = function (ax, ay, bx, by) {
    var R = 15;
    var x0 = Math.min(ax, bx) - R, x1 = Math.max(ax, bx) + R, y0 = Math.min(ay, by) - R, y1 = Math.max(ay, by) + R;
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(TW - 1, Math.ceil(x1)); y1 = Math.min(TH - 1, Math.ceil(y1));
    var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    var cur = this.cur, shp = this.shape, cut = this.cut, added = 0;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var n = y * TW + x; if (shp[n] < 128) continue;
      var t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      var ex = ax + dx * t - x, ey = ay + dy * t - y;
      var rr = R * (0.85 + 0.3 * hash2(Math.floor(x / 9), 1.5));
      var dd = Math.sqrt(ex * ex + ey * ey) / rr;
      if (dd >= 1) continue;
      var v = Math.round(100 * Math.pow(1 - dd, 0.8));
      if (v > cur[n]) {
        if (cut[n] + cur[n] < 50 && cut[n] + v >= 50) added++;
        cur[n] = Math.min(255 - cut[n], v);
      }
    }
    this.curBox = this.curBox ? [Math.min(this.curBox[0], x0), Math.min(this.curBox[1], y0), Math.max(this.curBox[2], x1), Math.max(this.curBox[3], y1)] : [x0, y0, x1, y1];
    this.refresh(x0, y0, x1 + 1, y1 + 1);
    return added;
  };
  /* 一筋が終わったら、切った量を足し込む */
  JeansScene.prototype.endSlash = function () {
    var b = this.curBox; if (!b) return;
    var cur = this.cur, cut = this.cut;
    for (var y = b[1]; y <= b[3]; y++) for (var x = b[0]; x <= b[2]; x++) {
      var n = y * TW + x; if (cur[n]) { cut[n] = Math.min(255, cut[n] + cur[n]); cur[n] = 0; }
    }
    this.curBox = null;
  };

  /* 削る: やすりでこすったところの色が落ちる。削りすぎると薄くなって穴が開く */
  JeansScene.prototype.rub = function (cx, cy, amt) {
    var R = 46, fade = this.fade, cut = this.cut, shp = this.shape;
    var x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(TW - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(TH - 1, Math.ceil(cy + R));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var n = y * TW + x; if (shp[n] < 128) continue;
      var dd = Math.hypot(x - cx, y - cy) / R; if (dd >= 1) continue;
      var w = (1 - dd) * (1 - dd) * (0.6 + 0.8 * hash2(x * 0.5, y * 0.13));
      fade[n] = Math.min(255, fade[n] + amt * 255 * w);
      if (fade[n] > 200 && hash2(x, y * 0.7) < 0.35 * w) cut[n] = Math.min(255, cut[n] + Math.ceil(amt * 60));
    }
    this.refresh(x0, y0, x1 + 1, y1 + 1);
  };

  /* どれだけダメージ加工したか（穴 + 色落ちの半分）0..1 */
  JeansScene.prototype.damage = function () {
    var s = 0, cut = this.cut, fade = this.fade, shp = this.shape;
    for (var n = 0; n < TW * TH; n += 3) {
      if (shp[n] < 128) continue;
      s += cut[n] >= 50 ? 1 : Math.max(cut[n] >= 16 ? 0.5 : 0, fade[n] / 255 * 0.5);
    }
    return s / (this.area / 3);
  };
  JeansScene.prototype.size = function () { return { w: TW, h: TH }; };

  JeansScene.prototype.setView = function (W, H, look, orbit) {
    var cam = this.camera;
    cam.aspect = W / H;
    var vf = cam.fov * Math.PI / 360;
    var hf = Math.atan(Math.tan(vf) * cam.aspect);
    var tilt = 0.98 + 0.1 * (look || 0), yaw = 0;
    var dist = Math.max(2.9 / Math.tan(hf), 5.0 / Math.tan(vf));
    if (orbit) { tilt += orbit.tilt; yaw = orbit.yaw; if (orbit.zoom) dist /= orbit.zoom; }
    tilt = Math.max(0.25, Math.min(1.5, tilt));
    var cz = 0.55;
    cam.position.set(Math.sin(yaw) * Math.cos(tilt) * dist, Math.sin(tilt) * dist, cz + Math.cos(yaw) * Math.cos(tilt) * dist);
    cam.lookAt(0, 0, cz);
    cam.updateProjectionMatrix();
    this.focus = dist;
  };

  /* ---- 仕上げ（ぼけ・色味・周辺減光・粒子） ---- */
  JeansScene.prototype.makePost = function (w, h) {
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
            "float coc(vec2 uv){ return clamp((abs(viewZ(uv) - uFocus) - uRange * 0.5) / uRange, 0.0, 1.0); }",
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
            "      float w = clamp(cs * uMaxBlur / max(rr * r, 0.001), 0.0, 1.0);",
            "      sum += texture2D(tColor, vUv + o).rgb * w; wsum += w;",
            "    }",
            "  }",
            "  vec3 col = sum / wsum;",
            "  col = toneMap(col);",
            "  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));",
            "  col = mix(vec3(l), col, 1.06);",
            "  col *= vec3(1.02, 1.0, 0.97);",
            "  col = toSRGB(clamp(col, 0.0, 1.0));",
            "  col = mix(col, col * col * (3.0 - 2.0 * col), 0.16);",
            "  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;",
            "  col *= 1.0 - 0.3 * smoothstep(0.4, 1.0, length(q) * 1.2);",
            "  col += (rnd(vUv * uRes) - 0.5) * 0.022;",
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

  JeansScene.prototype.render = function (ctx, W, H, look, orbit) {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    var r = this.renderer;
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; r.setSize(w, h, false); this.makePost(w, h); }
    this.setView(W, H, look, orbit);
    if (this.dirty) { this.colorTex.needsUpdate = true; this.dirty = false; }
    if (this.rt && !this.postFailed) {
      try {
        var u = this.postMat.uniforms, cam = this.camera;
        u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture;
        u.uRes.value.set(w, h); u.uNear.value = cam.near; u.uFar.value = cam.far;
        u.uFocus.value = this.focus;
        u.uRange.value = 7 + this.focus * 0.1;
        u.uMaxBlur.value = 6 * dpr;
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

  global.JeansScene = JeansScene;
})(window);
