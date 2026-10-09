/* ダメージジーンズメーカーの立体の絵。ジーンズ・カッターマット・机は、すべて基本図形と手続きの模様から自作。
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

    S.add(this.hemi = new T.HemisphereLight(0xfff4e6, 0x3a3028, 0.55));
    var key = this.key = new T.DirectionalLight(0xfff2de, 2.4);
    key.position.set(-7, 6.5, -3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    var sc = key.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 6.5; sc.bottom = -6.5; sc.near = 1; sc.far = 25;
    key.shadow.radius = 4; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.015;
    S.add(key); S.add(key.target);
    var fill = new T.DirectionalLight(0xcfe0ff, 0.35);
    fill.position.set(4, 3, 5); S.add(fill);

    this.buildRoom();
    this.buildJeans();
    this.w = 0; this.h = 0;
  }

  /* 机とカッターマット、奥の壁 */
  JeansScene.prototype.buildRoom = function () {
    var S = this.room = new T.Group();
    this.scene.add(S);
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
    this.shapeOrig = new Uint8Array(shape);
    this.cut = new Uint8Array(TW * TH);      /* 切った量（0..255 → 0..2.55） */
    this.cur = new Uint8Array(TW * TH);      /* 今の一筋で切った量（筋の中では重ねがけしない） */
    this.fade = new Uint8Array(TW * TH);     /* 削って色が落ちた量 */

    /* 表の布 */
    var geo = new T.PlaneGeometry(JW, JL, 128, 256);
    geo.rotateX(-Math.PI / 2);
    this.flat = new T.Group(); this.scene.add(this.flat);
    this.geo = geo;
    this.puff(geo);
    this.colorTex = new T.CanvasTexture(this.colorCv);
    this.colorTex.colorSpace = T.SRGBColorSpace; this.colorTex.anisotropy = 8;
    this.bumpCv = canvas(TW, TH);
    this.bumpTex = new T.CanvasTexture(this.bumpCv); this.bumpTex.anisotropy = 8;
    var front = this.front = new T.Mesh(geo, new T.MeshStandardMaterial({
      map: this.colorTex, bumpMap: this.bumpTex, bumpScale: 1.4, roughness: 0.93, alphaTest: 0.5, side: T.DoubleSide
    }));
    front.castShadow = true; front.receiveShadow = true;
    this.flat.add(front);

    /* 裏の布（穴から見える内側。白っぽい裏地と、ポケットの袋） */
    this.backCv = canvas(512, 1024);
    this.backTex = new T.CanvasTexture(this.backCv); this.backTex.colorSpace = T.SRGBColorSpace;
    var bgeo = new T.PlaneGeometry(JW, JL, 1, 1); bgeo.rotateX(-Math.PI / 2);
    var back = this.back = new T.Mesh(bgeo, new T.MeshStandardMaterial({ map: this.backTex, roughness: 0.95, alphaTest: 0.5 }));
    back.position.y = 0.004; back.receiveShadow = true;
    this.flat.add(back);
    /* 履かせたときの後ろ側（ポケットもダメージもない無地のデニム） */
    this.plainCv = canvas(TW, TH);
    this.plainTex = new T.CanvasTexture(this.plainCv); this.plainTex.colorSpace = T.SRGBColorSpace; this.plainTex.anisotropy = 8;

    /* ボタンとリベット（金属） */
    var metal = this.metal = new T.MeshStandardMaterial({ color: 0xb8854a, metalness: 1, roughness: 0.32 });
    var self = this;
    this.studs = [];
    function stud(px, py, r, h) {
      var m = new T.Mesh(new T.CylinderGeometry(r, r * 1.05, h, 28), metal);
      var p = self.toWorld(px, py);
      m.position.set(p.x, self.heightAt(px, py) + h / 2 - 0.004, p.z);
      m.castShadow = true; self.flat.add(m);
      self.studs.push({ m: m, px: px, py: py, y: m.position.y, y0: self.heightAt(px, py) });
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
    this.hgrid = this.hgrid || new Float32Array(NX * NZ);
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
    pos.needsUpdate = true;
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
    this.shape.set(this.shapeOrig);
    this.puff(this.geo);
    var self = this;
    this.studs.forEach(function (st) { st.m.visible = true; });
    (this.pieces || []).forEach(function (pc) { self.scene.remove(pc.m); pc.m.material.map.dispose(); pc.m.material.dispose(); pc.m.geometry.dispose(); });
    this.pieces = [];
    this.showModel(false);
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
    var pg = this.plainCv.getContext("2d");
    pg.putImageData(img, 0, 0);
    stitch(pg, line(pg, [112, 1956, 474, 1962]));
    stitch(pg, line(pg, [550, 1962, 912, 1956]));

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
    var pim = pg.getImageData(0, 0, TW, TH), pd = pim.data;
    for (n = 0; n < TW * TH; n++) pd[n * 4 + 3] = shp[n];
    pg.putImageData(pim, 0, 0);
    this.plainTex.needsUpdate = true;
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
      if (shp[n] < 128) { if (this.shapeOrig[n] > 127) s += 1; continue; }
      s += cut[n] >= 50 ? 1 : Math.max(cut[n] >= 16 ? 0.5 : 0, fade[n] / 255 * 0.5);
    }
    return Math.min(1, s / (this.area / 3));
  };
  /* ハサミ: なぞった線で布を断つ。腰とつながらなくなった（いちばん大きいかたまり以外の）布は落ちる。
     始点の近くで線を終えると輪が閉じて、中を切り抜ける */
  JeansScene.prototype.snip = function (path) {
    if (!path || path.length < 2) return 0;
    var pts = path.slice(), a = pts[0], b = pts[pts.length - 1];
    if (pts.length > 6 && Math.hypot(a.x - b.x, a.y - b.y) < 70) pts.push(a);
    var shp = this.shape, cut = this.cut;
    var bx0 = TW, by0 = TH, bx1 = 0, by1 = 0;
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i - 1], q = pts[i];
      var dx = q.x - p.x, dy = q.y - p.y, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 1.5));
      for (var k = 0; k <= steps; k++) {
        var cx = Math.round(p.x + dx * k / steps), cy = Math.round(p.y + dy * k / steps);
        if (cx < -9 || cy < -9 || cx > TW + 9 || cy > TH + 9) continue;
        bx0 = Math.min(bx0, cx - 9); by0 = Math.min(by0, cy - 9); bx1 = Math.max(bx1, cx + 9); by1 = Math.max(by1, cy + 9);
        for (var oy = -9; oy <= 9; oy++) for (var ox = -9; ox <= 9; ox++) {
          var x = cx + ox, y = cy + oy, d2 = ox * ox + oy * oy;
          if (x < 0 || y < 0 || x >= TW || y >= TH || d2 > 81) continue;
          var n = y * TW + x;
          if (shp[n] < 128) continue;
          if (d2 <= 4) shp[n] = 0;
          else { var v = Math.round(40 - Math.sqrt(d2) * 2.5); if (cut[n] < v) cut[n] = v; }   /* 切り口のほつれ */
        }
      }
    }
    /* つながったかたまりに分ける */
    var lab = this.lab || (this.lab = new Int32Array(TW * TH)), qu = this.qu || (this.qu = new Int32Array(TW * TH));
    lab.fill(0);
    var comps = [], qn = 0, id = 0;
    for (var s0 = 0; s0 < TW * TH; s0++) {
      if (shp[s0] < 128 || lab[s0]) continue;
      id++; var st = qn; qu[qn++] = s0; lab[s0] = id;
      var mnx = TW, mny = TH, mxx = 0, mxy = 0;
      for (var h = st; h < qn; h++) {
        var c = qu[h], X = c % TW, Y = (c - X) / TW;
        if (X < mnx) mnx = X; if (X > mxx) mxx = X; if (Y < mny) mny = Y; if (Y > mxy) mxy = Y;
        if (X > 0 && !lab[c - 1] && shp[c - 1] > 127) { lab[c - 1] = id; qu[qn++] = c - 1; }
        if (X < TW - 1 && !lab[c + 1] && shp[c + 1] > 127) { lab[c + 1] = id; qu[qn++] = c + 1; }
        if (Y > 0 && !lab[c - TW] && shp[c - TW] > 127) { lab[c - TW] = id; qu[qn++] = c - TW; }
        if (Y < TH - 1 && !lab[c + TW] && shp[c + TW] > 127) { lab[c + TW] = id; qu[qn++] = c + TW; }
      }
      comps.push({ id: id, a: st, b: qn, box: [mnx, mny, mxx + 1, mxy + 1] });
    }
    /* 腰の帯につながっている布を残す（腰ごと切り落としたときは、いちばん大きいかたまり） */
    var keep = null, wid = 0;
    for (var wy = 70; wy < 130 && !wid; wy += 4) for (var wx = 400; wx < 624; wx += 4) { if (lab[wy * TW + wx] && shp[wy * TW + wx] > 127) { wid = lab[wy * TW + wx]; break; } }
    if (wid) keep = comps.filter(function (c) { return c.id === wid; })[0];
    if (!keep) keep = comps.reduce(function (m, c) { return !m || c.b - c.a > m.b - m.a ? c : m; }, null);
    var removed = 0, self = this;
    comps.forEach(function (c) {
      if (c === keep) return;
      removed += c.b - c.a;
      if (c.b - c.a > 300) self.dropPiece(c, lab);
      for (var h = c.a; h < c.b; h++) shp[qu[h]] = 0;
      bx0 = Math.min(bx0, c.box[0]); by0 = Math.min(by0, c.box[1]); bx1 = Math.max(bx1, c.box[2]); by1 = Math.max(by1, c.box[3]);
    });
    this.refresh(bx0, by0, bx1 + 1, by1 + 1);
    this.trimBack();
    this.puff(this.geo);
    this.studs.forEach(function (st) { st.m.visible = shp[st.py * TW + st.px] > 127; st.m.position.y = self.heightAt(st.px, st.py) + st.y - st.y0; });
    return removed;
  };
  /* 裏の布も、残った形に合わせて抜く */
  JeansScene.prototype.trimBack = function () {
    var mc = this.maskCv || (this.maskCv = canvas(TW, TH)), g = mc.getContext("2d");
    var img = g.createImageData(TW, TH), d = img.data, shp = this.shape;
    for (var n = 0; n < TW * TH; n++) d[n * 4 + 3] = shp[n];
    g.putImageData(img, 0, 0);
    var bg = this.backCv.getContext("2d");
    bg.save(); bg.globalCompositeOperation = "destination-in"; bg.drawImage(mc, 0, 0, 512, 1024); bg.restore();
    this.backTex.needsUpdate = true;
    var pg = this.plainCv.getContext("2d");
    pg.save(); pg.globalCompositeOperation = "destination-in"; pg.drawImage(mc, 0, 0); pg.restore();
    this.plainTex.needsUpdate = true;
  };
  /* 切り落とした布が、ひらりと飛んで消える */
  JeansScene.prototype.dropPiece = function (c, lab) {
    var b = c.box, w = b[2] - b[0], h = b[3] - b[1];
    var cv = canvas(w, h), g = cv.getContext("2d");
    var img = this.colorG.getImageData(b[0], b[1], w, h), d = img.data;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (lab[(y + b[1]) * TW + x + b[0]] !== c.id) d[(y * w + x) * 4 + 3] = 0;
    g.putImageData(img, 0, 0);
    var tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    var geo = new T.PlaneGeometry(w / PX, h / PX); geo.rotateX(-Math.PI / 2);
    var m = new T.Mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 0.93, alphaTest: 0.5, side: T.DoubleSide, transparent: true }));
    var mid = this.toWorld(b[0] + w / 2, b[1] + h / 2);
    m.position.set(mid.x, 0.12, mid.z); m.castShadow = true;
    this.scene.add(m);
    var dir = new T.Vector3(mid.x, 0, mid.z - 0.5); if (dir.length() < 0.1) dir.set(1, 0, 0);
    dir.normalize();
    this.pieces.push({ m: m, t: 0, v: new T.Vector3(dir.x * 3.5, 3.2, dir.z * 3.5 + 1.5), r: new T.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 5) });
  };
  JeansScene.prototype.tick = function (dt) {
    var S = this.scene;
    if (this.modelOn) this.walk(dt);
    this.pieces = (this.pieces || []).filter(function (pc) {
      pc.t += dt; pc.v.y -= 9 * dt;
      pc.m.position.addScaledVector(pc.v, dt);
      pc.m.rotation.x += pc.r.x * dt; pc.m.rotation.y += pc.r.y * dt; pc.m.rotation.z += pc.r.z * dt;
      pc.m.material.opacity = Math.max(0, 1 - Math.max(0, pc.t - 0.7) / 0.6);
      pc.m.material.alphaTest = 0.5 * pc.m.material.opacity;
      if (pc.t < 1.3) return true;
      S.remove(pc.m); pc.m.material.map.dispose(); pc.m.material.dispose(); pc.m.geometry.dispose();
      return false;
    });
  };

  /* ---- 完成後: モデルに履かせる ----
     平らなジーンズの絵を、そのまま腰と脚の筒に巻きつける（表は前、同じ絵を裏返して後ろ）。
     穴の向こうには肌の脚が見える。高さは床が0、腰が 10.2（102cm） */
  JeansScene.prototype.rowSegs = function (py) {
    py = Math.max(60, Math.min(1990, Math.round(py)));
    var so = this.shapeOrig, segs = [], inS = false, a = 0;
    for (var x = 0; x < TW; x++) {
      var v = so[py * TW + x] > 127;
      if (v && !inS) { a = x; inS = true; } else if (!v && inS) { segs.push([a, x]); inS = false; }
    }
    if (inS) segs.push([a, TW]);
    return segs;
  };
  /* 正面から見た輪郭は平らなジーンズのまま（横の位置はそのまま）。奥行きだけを足して筒にする */
  var XS = 0.92, LEGGAP = 0.22;
  JeansScene.prototype.wrapPos = function (px, py, back) {
    var segs = this.rowSegs(py);
    var H = [segs[0][0], segs[segs.length - 1][1]];
    var legs = segs.length >= 2 ? segs : (this.legTop || (this.legTop = this.rowSegs(CROTCH + 90)));
    var hc = (H[0] + H[1]) / 2, hw = (H[1] - H[0]) / 2;
    var s = Math.max(-1, Math.min(1, (px - hc) / hw));
    var hz = hw / PX * 0.6 * Math.sqrt(1 - s * s), hx = hc + s * hw;
    var L = px < 512 ? legs[0] : legs[legs.length - 1];
    var c = (L[0] + L[1]) / 2, w = (L[1] - L[0]) / 2;
    var s2 = Math.max(-1, Math.min(1, (px - c) / w));
    var lz = w / PX * 0.85 * Math.sqrt(1 - s2 * s2), lx = c + s2 * w;
    var t = Math.max(0, Math.min(1, (py - (CROTCH - 40)) / 160)); t = t * t * (3 - 2 * t);
    var z = hz + (lz - hz) * t;
    /* 輪郭の外の頂点は縁に寄せ、絵は少し内側を読む。前と後ろが横の縫い目でぴったり閉じる */
    var ex = hx + (lx - hx) * t;
    this.uvX = (hc + s * hw * 0.95) + ((c + s2 * w * 0.95) - (hc + s * hw * 0.95)) * t;
    /* 左右の脚は少し離して立たせる（脚どうしが重なって見えないように） */
    var spread = (px < 512 ? -LEGGAP : LEGGAP) * t;
    return new T.Vector3((ex - 512) / PX * XS + spread, 10.2 - (py - 58) / PX, back ? -z : z);
  };
  /* マネキンの関節の位置（床が0）。股関節と膝で脚を曲げる */
  var HIPY = 8.4, KNEEY = 4.6;
  JeansScene.prototype.legX = function (side) {
    var L = this.rowSegs(CROTCH + 90), seg = side ? L[L.length - 1] : L[0];
    return ((seg[0] + seg[1]) / 2 - 512) / PX * XS + (side ? LEGGAP : -LEGGAP);
  };
  JeansScene.prototype.buildModel = function () {
    var G = this.model = new T.Group();
    this.scene.add(G);
    var self = this;
    /* ジーンズ（歩くたびに頂点を曲げ直すので、細かさは控えめ） */
    var mat = this.front.material, plain = new T.MeshStandardMaterial({ map: this.plainTex, roughness: 0.93, alphaTest: 0.5, side: T.DoubleSide }), NX = 96, NZ = 128;
    this.wear = [false, true].map(function (back) {
      var geo = new T.PlaneGeometry(1, 1, NX, NZ), pos = geo.attributes.position, cnt = pos.count;
      var rest = new Float32Array(cnt * 3), side = new Uint8Array(cnt), w = new Float32Array(cnt);
      for (var n = 0; n < cnt; n++) {
        var i = n % (NX + 1), j = Math.floor(n / (NX + 1));
        var px = i / NX * TW, py = j / NZ * TH;
        var v = self.wrapPos(px, py, back);
        geo.attributes.uv.setX(n, self.uvX / TW);
        rest[n * 3] = v.x; rest[n * 3 + 1] = v.y; rest[n * 3 + 2] = v.z;
        side[n] = px < 512 ? 0 : 1;
        var t = Math.max(0, Math.min(1, (HIPY + 0.2 - v.y) / 1.4)); w[n] = t * t * (3 - 2 * t);
        pos.setXYZ(n, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      var m = new T.Mesh(geo, back ? plain : mat);
      m.castShadow = true; m.receiveShadow = true;
      G.add(m);
      return { geo: geo, rest: rest, side: side, w: w };
    });
    /* マネキン（つやのある白、顔なし） */
    var body = new T.MeshPhysicalMaterial({ color: 0xf3f1ec, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    function lathe(pts, seg) { var m = new T.Mesh(new T.LatheGeometry(pts.map(function (a) { return new T.Vector2(a[0], a[1]); }), seg || 32), body); m.castShadow = true; m.receiveShadow = true; return m; }
    /* ブリーフ: 腰から太ももの付け根までを紺に塗る（ゴムの帯は灰色） */
    var brief = body.clone(); brief.vertexColors = true; brief.color.set(0xffffff);
    var WHITE = new T.Color(0xf3f1ec), NAVY = new T.Color(0x1e2638), BAND = new T.Color(0x9aa0aa);
    function briefColor(y, leg) { return y > 9.45 ? WHITE : y > 9.2 ? BAND : (!leg || y > 7.35) ? NAVY : WHITE; }
    function latheB(pts, seg, oy) {
      var geo = new T.LatheGeometry(pts.map(function (a) { return new T.Vector2(a[0], a[1]); }), seg || 32);
      var pos = geo.attributes.position, cols = [];
      for (var i = 0; i < pos.count; i++) { var c = briefColor(pos.getY(i) + (oy || 0), !!oy); cols.push(c.r, c.g, c.b); }
      geo.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
      var m = new T.Mesh(geo, brief); m.castShadow = true; m.receiveShadow = true; return m;
    }
    function capsule(r, len) { var m = new T.Mesh(new T.CapsuleGeometry(r, len, 6, 18), body); m.castShadow = true; m.receiveShadow = true; return m; }
    /* 胴: 腰まわりはジーンズより少し細く、上は胸と肩 */
    var tp = [];
    for (var py = CROTCH - 30; py >= 70; py -= 18) {
      var sg = this.rowSegs(py), hw = (sg[sg.length - 1][1] - sg[0][0]) / 2;
      tp.push([hw / PX * XS * 0.84, 10.2 - (py - 58) / PX]);
    }
    /* 股の下は丸く閉じる */
    var b0 = tp[0];
    tp.unshift([b0[0] * 0.82, b0[1] - 0.22], [b0[0] * 0.55, b0[1] - 0.4], [b0[0] * 0.25, b0[1] - 0.5], [0.001, b0[1] - 0.52]);
    tp.sort(function (a, b) { return a[1] - b[1]; });
    tp = tp.concat([[1.68, 10.9], [1.62, 11.8], [1.85, 12.7], [1.95, 13.25], [1.6, 13.75], [0.8, 14.15], [0.5, 14.4], [0.46, 14.8], [0.001, 14.9]]);
    var torso = latheB(tp, 48); torso.scale.set(1, 1, 0.62); G.add(torso);
    var head = new T.Mesh(new T.SphereGeometry(0.82, 32, 24), body); head.scale.set(0.9, 1.22, 1.0); head.position.set(0, 15.75, 0.05); head.castShadow = true; G.add(head);
    /* 腕（肩でふる）。継ぎ目のない一本のなめらかな形 */
    this.arms = [-1, 1].map(function (s) {
      var sh = new T.Group(); sh.position.set(s * 2.15, 13.05, 0); G.add(sh);
      var arm = lathe([[0.001, 0.45], [0.3, 0.38], [0.4, 0.05], [0.37, -0.8], [0.31, -2.0], [0.26, -3.0], [0.25, -3.6], [0.2, -5.1], [0.22, -5.5], [0.2, -6.0], [0.12, -6.35], [0.001, -6.45]]);
      arm.scale.z = 0.9; sh.add(arm);
      sh.rotation.z = s * 0.1;
      return sh;
    });
    /* 脚: 股関節 → 太もも → 膝 → すね・足。ジーンズの中に収まる太さ */
    var anat = function (y, r) {
      var py2 = 58 + (10.2 - y) * PX;
      if (py2 > CROTCH + 90 && py2 < 1990) {
        var sg2 = self.rowSegs(py2), LL = sg2[0];
        r = Math.max(0.43, Math.min(r, (LL[1] - LL[0]) / 2 / PX * XS * 0.74));
      }
      return r;
    };
    this.legs = [0, 1].map(function (side) {
      var hip = new T.Group(); hip.position.set(self.legX(side), HIPY, 0); G.add(hip);
      var th = latheB([[0.001, 4.3], [0.3, 4.36], [0.43, 4.6], [anat(5.0, 0.48), 5.0], [anat(5.4, 0.52), 5.4], [anat(6.4, 0.62), 6.4], [anat(7.3, 0.66), 7.3], [anat(7.4, 0.67), 7.4], [0.68, 7.8], [0.66, 8.4], [0.58, 8.9], [0.34, 9.3], [0.001, 9.4]].map(function (a) { return [a[0], a[1] - HIPY]; }), 32, HIPY);
      hip.add(th);
      var knee = new T.Group(); knee.position.y = KNEEY - HIPY; hip.add(knee);
      var sn = lathe([[0.001, 0.5], [0.28, 0.55], [anat(1.2, 0.33), 1.2], [anat(2.0, 0.42), 2.0], [anat(2.9, 0.5), 2.9], [anat(3.8, 0.47), 3.8], [anat(4.0, 0.46), 4.0], [0.43, 4.6], [0.36, 4.86], [0.001, 4.95]].map(function (a) { return [a[0], a[1] - KNEEY]; }));
      knee.add(sn);
      /* 膝の丸み（曲げても折れ目に見えないように） */
      var kb = new T.Mesh(new T.SphereGeometry(0.425, 24, 16), body); kb.scale.set(1, 1, 0.95); kb.castShadow = true; knee.add(kb);
      var foot = capsule(0.3, 1.1); foot.rotation.x = Math.PI / 2 + 0.12; foot.scale.set(1.15, 1, 0.75); foot.position.set(0, 0.32 - KNEEY, 0.42); knee.add(foot);
      return { hip: hip, knee: knee };
    });
    var bp = this.wrapPos(512, 96, false);
    var btn = this.btn = new T.Mesh(new T.CylinderGeometry(0.085, 0.09, 0.05, 24), this.metal);
    btn.rotation.x = Math.PI / 2; btn.position.set(bp.x, bp.y, bp.z + 0.04); G.add(btn);
    this.buildRunway();
    this.pose(0, 0, 0, 0);
  };

  /* ランウェイの会場: 黒い通路、縁の光、左右の客席、奥の光る入口 */
  JeansScene.prototype.buildRunway = function () {
    var R = this.stage = new T.Group();
    this.scene.add(R);
    var walk = new T.Mesh(new T.BoxGeometry(6.4, 0.8, 90), new T.MeshStandardMaterial({ color: 0x141418, roughness: 0.18, metalness: 0.1 }));
    walk.position.set(0, -0.4, -15); walk.receiveShadow = true; R.add(walk);
    var glow = new T.MeshBasicMaterial({ color: 0xfff6e6 });
    [-1, 1].forEach(function (s) { var e = new T.Mesh(new T.BoxGeometry(0.08, 0.06, 90), glow); e.position.set(s * 3.2, 0.01, -15); R.add(e); });
    var floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.8; R.add(floor);
    /* 幕（深い赤のビロード。縦のひだ） */
    var cc = canvas(512, 256), cg = cc.getContext("2d");
    for (var x = 0; x < 512; x++) {
      var f = 0.55 + 0.45 * Math.sin(x / 512 * Math.PI * 34 + Math.sin(x * 0.05) * 0.8);
      cg.fillStyle = "rgb(" + Math.round(70 + 90 * f) + "," + Math.round(8 + 12 * f) + "," + Math.round(16 + 16 * f) + ")";
      cg.fillRect(x, 0, 1, 256);
    }
    var gr = cg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(0,0,0,.35)"); gr.addColorStop(0.2, "rgba(0,0,0,0)"); gr.addColorStop(0.92, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(255,210,120,.5)");
    cg.fillStyle = gr; cg.fillRect(0, 0, 512, 256);
    var ct = new T.CanvasTexture(cc); ct.colorSpace = T.SRGBColorSpace;
    var cgeo = new T.PlaneGeometry(40, 26, 160, 1), cpos = cgeo.attributes.position;
    for (var k = 0; k < cpos.count; k++) cpos.setZ(k, Math.sin(cpos.getX(k) / 40 * Math.PI * 34) * 0.18);
    cgeo.computeVertexNormals();
    this.curtain = new T.Mesh(cgeo, new T.MeshStandardMaterial({ map: ct, roughness: 0.85 }));
    this.curtain.position.set(0, 13, -36.5); this.curtain.castShadow = true; R.add(this.curtain);
    /* ステージの外で光るカメラのフラッシュ（人は見せない） */
    this.flashes = [];
    for (var f = 0; f < 8; f++) {
      var fl = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff }));
      fl.visible = false; R.add(fl); this.flashes.push({ m: fl, t: Math.random() });
    }
    /* 奥の壁と光る入口 */
    var wall = new T.Mesh(new T.PlaneGeometry(80, 40), new T.MeshStandardMaterial({ color: 0x15151a, roughness: 0.9 }));
    wall.position.set(0, 18, -52); R.add(wall);
    var door = new T.Mesh(new T.PlaneGeometry(7, 20), new T.MeshBasicMaterial({ color: 0xfff3dc }));
    door.position.set(0, 9.2, -51.9); R.add(door);
    this.spot = new T.SpotLight(0xffffff, 900, 70, 0.28, 0.6, 1.6);
    this.spot.position.set(0, 30, 10); R.add(this.spot); R.add(this.spot.target);
  };

  /* 姿勢: 左右の股関節・膝の角度。ジーンズも同じだけ曲げる */
  JeansScene.prototype.pose = function (hl, hr, kl, kr) {
    var H = [hl, hr], K = [kl, kr], self = this;
    this.legs.forEach(function (lg, i) { lg.hip.rotation.x = H[i]; lg.knee.rotation.x = K[i]; });
    var lx = [this.legX(0), this.legX(1)];
    var ch = H.map(Math.cos), sh = H.map(Math.sin), ck = K.map(Math.cos), sk = K.map(Math.sin);
    this.wear.forEach(function (wr) {
      var rest = wr.rest, pos = wr.geo.attributes.position.array, side = wr.side, w = wr.w;
      for (var n = 0; n < side.length; n++) {
        var x = rest[n * 3], y = rest[n * 3 + 1], z = rest[n * 3 + 2], s = side[n], wt = w[n];
        if (wt > 0) {
          var kw = Math.max(0, Math.min(1, (KNEEY + 0.45 - y) / 0.9)); kw = kw * kw * (3 - 2 * kw);
          var a, c, sn, dy, dz;
          if (kw > 0) {                                           /* 膝で曲げる */
            a = K[s] * kw; c = Math.cos(a); sn = Math.sin(a);
            dy = y - KNEEY; dz = z; y = KNEEY + dy * c - dz * sn; z = dy * sn + dz * c;
          }
          a = H[s] * wt; c = Math.cos(a); sn = Math.sin(a);       /* 股関節で振る */
          dy = y - HIPY; dz = z; y = HIPY + dy * c - dz * sn; z = dy * sn + dz * c;
        }
        pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z;
      }
      wr.geo.attributes.position.needsUpdate = true;
      wr.geo.computeVertexNormals();
    });
  };

  /* 完成後: 奥の入口からランウェイを歩いてきて、手前で立ち止まる */
  JeansScene.prototype.walk = function (dt) {
    var wk = this.walkState; if (!wk) return;
    wk.t += dt;
    var END = -2, speed = 8.5;
    /* 幕が上がってから歩き出す */
    var cu = Math.max(0, Math.min(1, (wk.t - 0.3) / 2.4)); cu = cu * cu * (3 - 2 * cu);
    this.curtain.position.y = 13 + 27 * cu;
    var moving = wk.z < END;
    if (wk.t < 1.9) { moving = false; }
    else if (moving) { wk.z = Math.min(END, wk.z + speed * dt); wk.ph += dt * Math.PI * 2 * 0.78; wk.amp = Math.min(1, wk.amp + dt * 3); }
    else { wk.amp = Math.max(0, wk.amp - dt * 2.5); if (wk.amp > 0) wk.ph += dt * Math.PI * 2 * 0.78 * wk.amp; }
    var a = wk.amp, p = wk.ph, sp = Math.sin(p), cp = Math.cos(p);
    var hl = -0.3 * sp * a, hr = 0.3 * sp * a;
    var kl = 0.7 * Math.pow(Math.max(0, cp), 1.5) * a + 0.05 * a, kr = 0.7 * Math.pow(Math.max(0, -cp), 1.5) * a + 0.05 * a;
    this.pose(hl, hr, kl, kr);
    this.arms[0].rotation.x = 0.32 * sp * a; this.arms[1].rotation.x = -0.32 * sp * a;
    var M = this.model;
    M.position.set(0, -0.12 * a * (1 - Math.abs(Math.cos(p))) , wk.z);
    M.rotation.y = 0.06 * sp * a;
    /* 立ち止まったら少し腰を振ってポーズ */
    if (wk.z >= END && a < 0.05) { wk.pose = Math.min(1, (wk.pose || 0) + dt * 1.5); M.rotation.y = 0.18 * Math.sin(wk.pose * Math.PI / 2); this.arms[1].rotation.z = 0.1 + 0.2 * wk.pose; }
    this.flashes.forEach(function (f) {
      f.t -= dt;
      if (f.t > 0) return;
      if (f.m.visible) { f.m.visible = false; f.t = 0.15 + Math.random() * 1.2; return; }
      if (wk.t < 2) { f.t = 0.2; return; }
      var sd = Math.random() < 0.5 ? -1 : 1;
      f.m.position.set(sd * (4.5 + Math.random() * 5), 2 + Math.random() * 4, wk.z + (Math.random() - 0.3) * 14);
      f.m.visible = true; f.t = 0.05 + Math.random() * 0.04;
    });
    this.hemi.intensity = this.flashes.some(function (f) { return f.m.visible; }) ? 0.45 : 0.18;
    this.spot.target.position.set(0, 4, wk.z);
    this.spot.position.set(0, 30, wk.z + 12);
    this.key.target.position.set(0, 6, wk.z); this.key.position.set(-8, 22, wk.z + 12);
  };

  JeansScene.prototype.showModel = function (on) {
    this.modelOn = !!on;
    if (on && !this.model) this.buildModel();
    if (this.model) { this.model.visible = this.stage.visible = !!on; }
    this.room.visible = this.flat.visible = !on;
    var k = this.key, sc = k.shadow.camera;
    if (on) {
      this.walkState = { z: -40, ph: 0, amp: 0, t: 0 };
      this.btn.visible = this.shape[96 * TW + 512] > 127;
      this.arms[1].rotation.z = 0.1;
      sc.left = -6; sc.right = 6; sc.top = 11; sc.bottom = -11; sc.near = 5; sc.far = 60;
      k.intensity = 1.2; this.hemi.intensity = 0.18;
      this.scene.background.set(0x08080b);
      this.walk(0);
    } else {
      this.walkState = null;
      k.intensity = 2.4; this.hemi.intensity = 0.55;
      k.position.set(-7, 6.5, -3); k.target.position.set(0, 0, 0);
      sc.left = -4; sc.right = 4; sc.top = 6.5; sc.bottom = -6.5; sc.near = 1; sc.far = 25;
      this.scene.background.set(0x2a221c);
    }
    sc.updateProjectionMatrix();
  };

  /* ワッペン: 選んだ画像を布にして、縁を刺しゅうで縫い付ける。下の穴や色落ちはふさがる。
     透過PNGなら絵の形に沿ってふち取り（ダイカット）、そうでなければ角の丸い四角 */
  JeansScene.prototype.addPatch = function (img, cx, cy) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;
    var M = 230, k = M / Math.max(iw, ih), w0 = Math.max(40, Math.round(iw * k)), h0 = Math.max(40, Math.round(ih * k));
    /* 透過しているか（縁まわりに透明な所があるか） */
    var tc = canvas(w0, h0), tg = tc.getContext("2d"); tg.drawImage(img, 0, 0, w0, h0);
    var td = tg.getImageData(0, 0, w0, h0).data, clear = 0, sr = 0, sg = 0, sb = 0, n = 0;
    for (var i = 0; i < td.length; i += 16) {
      if (td[i + 3] < 40) clear++;
      else { sr += td[i]; sg += td[i + 1]; sb += td[i + 2]; n++; }
    }
    n = n || 1;
    var die = clear > td.length / 16 * 0.04;
    var bc = "rgb(" + Math.round(sr / n * 0.45) + "," + Math.round(sg / n * 0.45) + "," + Math.round(sb / n * 0.45) + ")";
    var P = die ? 14 : 0, w = w0 + P * 2, h = h0 + P * 2;
    var pc = canvas(w, h), g = pc.getContext("2d");
    function rr(x, y, ww, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); }
    function threads(gg, ww, hh) {
      for (var y = 0; y < hh; y += 3) { gg.fillStyle = "rgba(255,255,255," + (0.05 + (y % 6 ? 0 : 0.04)) + ")"; gg.fillRect(0, y, ww, 1); gg.fillStyle = "rgba(0,0,0,.06)"; gg.fillRect(0, y + 1, ww, 1); }
    }
    /* 絵の形を r だけ太らせた型 */
    function grow(r, color) {
      var c = canvas(w, h), cg = c.getContext("2d");
      for (var a = 0; a < 32; a++) { var t = a / 32 * Math.PI * 2; cg.drawImage(tc, P + Math.cos(t) * r, P + Math.sin(t) * r); }
      cg.drawImage(tc, P, P);
      cg.globalCompositeOperation = "source-in"; cg.fillStyle = color; cg.fillRect(0, 0, w, h);
      return c;
    }
    if (die) {
      /* 外側: 刺しゅうのふち（斜めのサテン縫い） */
      var edge = grow(12, bc), eg = edge.getContext("2d");
      eg.globalCompositeOperation = "source-atop"; eg.strokeStyle = "rgba(255,255,255,.22)"; eg.lineWidth = 1.2;
      for (var d = -h; d < w; d += 3.5) { eg.beginPath(); eg.moveTo(d, 0); eg.lineTo(d + h, h); eg.stroke(); }
      g.drawImage(edge, 0, 0);
      g.drawImage(grow(4, "#f1ece0"), 0, 0);                 /* ふちの内側の布 */
      g.drawImage(tc, P, P);
      g.save(); g.globalCompositeOperation = "source-atop"; threads(g, w, h); g.restore();
    } else {
      var R = Math.min(w, h) * 0.16;
      g.save(); rr(0, 0, w, h, R); g.clip();
      g.fillStyle = "#f1ece0"; g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      threads(g, w, h);
      g.restore();
      g.lineWidth = 12; g.strokeStyle = bc; rr(6, 6, w - 12, h - 12, Math.max(4, R - 6)); g.stroke();
      g.save(); rr(6, 6, w - 12, h - 12, Math.max(4, R - 6)); g.lineWidth = 12; g.setLineDash([1.5, 2.5]); g.strokeStyle = "rgba(255,255,255,.28)"; g.stroke(); g.restore();
      g.lineWidth = 1.5; g.strokeStyle = "rgba(0,0,0,.45)"; rr(0.75, 0.75, w - 1.5, h - 1.5, R); g.stroke();
    }
    var x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    /* 布の絵に重ねる。ふさいだ所の切れ目と色落ちは消す */
    var pd = g.getImageData(0, 0, w, h).data, base = this.baseData, shp = this.shapeOrig, cut = this.cut, fade = this.fade, cur = this.cur;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= TW || Y >= TH) continue;
      var q = (y * w + x) * 4, a = pd[q + 3] / 255; if (a <= 0) continue;
      var nn = Y * TW + X, b = nn * 4;
      if (shp[nn] < 128) continue;
      base[b] = base[b] * (1 - a) + pd[q] * a; base[b + 1] = base[b + 1] * (1 - a) + pd[q + 1] * a; base[b + 2] = base[b + 2] * (1 - a) + pd[q + 2] * a;
      if (a > 0.5) { cut[nn] = 0; fade[nn] = 0; cur[nn] = 0; }
    }
    /* 盛り上がり（ワッペンの形のまま） */
    var sil = canvas(w, h), sg2 = sil.getContext("2d");
    sg2.drawImage(pc, 0, 0); sg2.globalCompositeOperation = "source-in"; sg2.fillStyle = "rgba(205,205,205,.65)"; sg2.fillRect(0, 0, w, h);
    this.bumpCv.getContext("2d").drawImage(sil, x0, y0);
    this.bumpTex.needsUpdate = true;
    this.refresh(x0, y0, x0 + w, y0 + h);
    return true;
  };

  JeansScene.prototype.size = function () { return { w: TW, h: TH }; };

  JeansScene.prototype.setView = function (W, H, look, orbit) {
    var cam = this.camera;
    cam.aspect = W / H;
    var vf = cam.fov * Math.PI / 360;
    var hf = Math.atan(Math.tan(vf) * cam.aspect);
    if (this.modelOn) {
      /* ランウェイの先から、歩いてくるマネキンを見る（全身が入る距離） */
      var mz = this.model.position.z;
      var mt = 0.04, my = 0, md = 6.7 / Math.tan(vf);
      if (orbit) { mt += orbit.tilt; my = Math.max(-1.3, Math.min(1.3, orbit.yaw)); if (orbit.zoom) md /= orbit.zoom; }
      mt = Math.max(-0.05, Math.min(0.7, mt));
      var cy = 5.2;
      cam.position.set(Math.sin(my) * Math.cos(mt) * md, cy + Math.sin(mt) * md, mz + Math.cos(my) * Math.cos(mt) * md);
      cam.lookAt(0, cy, mz);
      cam.updateProjectionMatrix();
      this.focus = cam.position.distanceTo(new T.Vector3(0, cy, mz));
      return;
    }
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
