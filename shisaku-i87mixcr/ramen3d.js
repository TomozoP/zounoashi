/* 無限マシマシの場面を立体で描き、主画面（2Dのcanvas）へ写す。
   動きの計算はゲーム側のまま。ここは見た目だけ。
   ゲームの座標（横 x・高さ y、どんぶりのスープ面が 0）を 100 で割ってメートルにする。
   模型はすべて基本図形から自作。three.js は random-bowling の既存配布物（MIT）を使う。 */
(function (global) {
  "use strict";
  var T;
  var M = 100;          /* ゲームの座標 → メートル */
  var LAYER = 36;
  var CEIL = 1800;

  function rng(seed) {
    var s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function RamenScene() {
    T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.setClearColor(0xf1e3b8, 1);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(32, 0.5, 0.5, 4000);
    this.makeEnv();
    this.scene.add(new T.HemisphereLight(0xfff0dc, 0x3a2414, 0.55));
    /* 真上やや手前の照明：影を落とす主役 */
    var key = this.key = new T.DirectionalLight(0xffe2bc, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    this.scene.add(key.target);
    /* 窓側からの冷たい返し光と、奥からの縁の光 */
    var fill = new T.DirectionalLight(0xbcd2ff, 0.6);
    fill.position.set(6, 2, 5);
    this.scene.add(fill);
    var rim = this.rim = new T.DirectionalLight(0xffd29a, 1.6);
    this.scene.add(rim); this.scene.add(rim.target);
    this.steam = [];
    this.layers = [];
    this.held = null; this.fall = null; this.spills = {};
    this.w = 0; this.h = 0;
    this.makeParts();
    this.makeShop();
    /* どんぶりとその上のものはまとめて動かせるようにする（最後に下の段のカウンターへ置く） */
    this.dish = new T.Group();
    this.scene.add(this.dish);
    this.makeBowl();
    this.makeSky();
    this.makeSteam();
    this.makeAbura();
    var self = this;
    /* 影はどんぶりまわりだけが落とし、受けるのはどんぶりとカウンターだけ（軽くするため） */
    this.dish.traverse(function (o) { if (o.isMesh && !o.isInstancedMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.counterTop.receiveShadow = this.counterLow.receiveShadow = true;
  }

  /* 映り込み用の部屋：暗い店内に、白い蛍光灯と赤い提灯の明かり */
  RamenScene.prototype.makeEnv = function () {
    var es = new T.Scene();
    var room = new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x2a1d14, side: T.BackSide }));
    es.add(room);
    function panel(w, h, x, y, z, rx, ry, color) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: color, side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); es.add(m);
    }
    panel(10, 1.2, 0, 6.8, 0, Math.PI / 2, 0, 0xfff4e0);
    panel(10, 1.2, 0, 6.8, 5, Math.PI / 2, 0, 0xfff4e0);
    panel(8, 4, 0, 3, 14.8, 0, Math.PI, 0xdde8ff);
    panel(3, 2, -10, 2, -14.8, 0, 0, 0xff7a3a);
    panel(30, 2, 0, -6.8, 0, -Math.PI / 2, 0, 0x6b4428);
    var pm = new T.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(es, 0.03).texture;
    this.scene.environmentIntensity = 0.6;
    pm.dispose();
  };

  /* 湯気：ぼかした白い板が、どんぶりから立ちのぼって消える */
  RamenScene.prototype.makeSteam = function () {
    var tex = canvasTex(128, 128, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(255,255,255,.55)"); gr.addColorStop(0.5, "rgba(255,255,255,.18)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    for (var i = 0; i < 18; i++) {
      var m = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      m.userData.t = i / 18; m.userData.a = Math.random() * 6.28; m.userData.r = 1.0 + Math.random() * 0.9;
      this.dish.add(m); this.steam.push(m);
    }
  };
  RamenScene.prototype.stepSteam = function (time) {
    this.steam.forEach(function (m) {
      var u = m.userData, t = (u.t + time * 0.12) % 1;
      var a = u.a + t * 0.8;
      m.position.set(Math.cos(a) * u.r + Math.sin(time + u.a) * 0.15, 0.3 + t * 3.2, Math.sin(a) * u.r * 0.6 + 0.6);
      var sc = 0.8 + t * 1.8; m.scale.set(sc, sc, 1);
      m.material.opacity = Math.sin(t * Math.PI) * 0.35;
      m.material.rotation = a;
    });
  };

  /* ============ 共通の部品 ============ */
  RamenScene.prototype.makeParts = function () {
    this.gLeaf = new T.SphereGeometry(1, 8, 5);
    this.gCube = new T.BoxGeometry(1, 1, 1);
    this.mSprout = new T.MeshStandardMaterial({ map: this.sproutAtlas(), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.45, metalness: 0, emissive: 0x2a2410, emissiveIntensity: 0.5 });
    this.mLeaf = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, side: T.DoubleSide, emissive: 0x9a9a78, emissiveIntensity: 0.6 });   /* 裏や影でも暗い緑にならないよう明るめ */
    this.mGarlic = new T.MeshStandardMaterial({ color: 0xf2e2a0, roughness: 0.6, emissive: 0x2a2208, emissiveIntensity: 0.6 });
    this.mFat = new T.MeshStandardMaterial({ color: 0xfff0d6, roughness: 0.12, emissive: 0x302418, emissiveIntensity: 0.5 });
    this.mKarame = new T.MeshStandardMaterial({ color: 0x4a1e06, roughness: 0.05, transparent: true, opacity: 0.85 });
    this.dummy = new T.Object3D();
  };

  /* もやしの束の絵を8種類、1枚の画像に並べて描く（4×2マス） */
  RamenScene.prototype.sproutAtlas = function () {
    var CW = 256, CH = 160;
    return canvasTex(CW * 4, CH * 2, function (g) {
      for (var cell = 0; cell < 8; cell++) {
        var r = rng(300 + cell * 31), ox = (cell % 4) * CW, oy = Math.floor(cell / 4) * CH;
        g.save(); g.beginPath(); g.rect(ox, oy, CW, CH); g.clip();
        var cx = ox + CW / 2, by = oy + CH - 6;
        function hgt(dx) { var t = dx / (CW * 0.46); return t >= 1 ? 0 : (CH - 70) * Math.sqrt(1 - t * t) * (0.85 + 0.15 * Math.cos(dx * 0.05 + cell)); }
        g.lineCap = "round";
        for (var k = 0; k < 85; k++) {
          var px = (r() * 2 - 1) * (CW * 0.5 - 70);
          var depth = r();                      /* 0 が奥（暗い）、1 が手前（明るい） */
          var py = by - depth * hgt(px) * 0.95 - 4;
          var a = r() * Math.PI, len = 70 + r() * 50;
          var x1 = cx + px - Math.cos(a) * len / 2, y1 = py - Math.sin(a) * len / 2 * 0.55;
          var x2 = cx + px + Math.cos(a) * len / 2, y2 = py + Math.sin(a) * len / 2 * 0.55;
          var bend = (r() - 0.5) * 26;
          var lt = 62 + depth * 30 + r() * 6;
          g.strokeStyle = "hsl(45,25%," + (lt - 34) + "%)"; g.lineWidth = 15;
          g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx + px, py + bend, x2, y2); g.stroke();
          g.strokeStyle = "hsl(" + (46 + r() * 8) + "," + (30 + r() * 30) + "%," + Math.min(97, lt) + "%)"; g.lineWidth = 11;
          g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx + px, py + bend, x2, y2); g.stroke();
          g.strokeStyle = "rgba(255,255,255," + (0.25 + depth * 0.5) + ")"; g.lineWidth = 3;
          g.beginPath(); g.moveTo(x1, y1 - 1.5); g.quadraticCurveTo(cx + px, py + bend - 1.5, x2, y2 - 1.5); g.stroke();
          if (r() < 0.35) { g.fillStyle = "hsl(50,70%," + (45 + depth * 15) + "%)"; g.beginPath(); g.ellipse(x1, y1, 7, 5.5, a, 0, 7); g.fill(); }
        }
        g.restore();
      }
    });
  };

  /* 一段のヤサイの山。w はゲームの幅 */
  RamenScene.prototype.clump = function (w, kind, salt) {
    var g = new T.Group(), r = rng(1000 + salt * 97 + Math.round(w)), d = this.dummy;
    var R = w / 2 / M, H = 0.44;

    /* もやし：束を描いた板を、奥・中・手前の列に並べて重ねる（立体の1本ずつより軽い） */
    var pos = [], uvs = [], nor = [], idx = [], col = new T.Color(), i, a, u;
    var rows = [[-0.55, 0.06], [-0.2, 0.16], [0.15, 0.12], [0.5, 0.0], [0.8, -0.1]];
    var QW = 0.85, QH = 0.55;
    for (var ri = 0; ri < rows.length; ri++) {
      var z = rows[ri][0] * R, span = R * Math.sqrt(Math.max(0, 1 - rows[ri][0] * rows[ri][0])) * 0.98;
      var lift = rows[ri][1] + H * 0.35 * Math.sqrt(Math.max(0, 1 - rows[ri][0] * rows[ri][0]));
      var cnt = Math.max(1, Math.ceil(span * 2 / (QW * 0.4)));
      for (var k = 0; k < cnt; k++) {
        var t = cnt === 1 ? 0.5 : k / (cnt - 1);
        var cx = -span + QW * 0.4 * Math.min(1, span * 2 * 1.15 / QW) + t * Math.max(0, span * 2 - QW * 0.8) + (r() - 0.5) * 0.08;
        var edge = Math.abs(cx) / Math.max(0.01, span);
        /* 細い段では板も小さくする（絵を引き伸ばさない） */
        var fit = Math.min(1, span * 2 * 1.15 / QW);
        var qw = QW * fit * (0.85 + r() * 0.3), qh = QH * fit * (0.85 + r() * 0.3) * (1 - edge * 0.35);
        var cy = -0.12 + lift * (1 - edge * edge * 0.7) + (r() - 0.5) * 0.04;
        var cell = Math.floor(r() * 8), flip = r() < 0.5;
        var u0 = (cell % 4) / 4, v0 = 1 - (Math.floor(cell / 4) + 1) / 2, u1 = u0 + 0.25, v1 = v0 + 0.5;
        if (flip) { var tmp = u0; u0 = u1; u1 = tmp; }
        var zz = z + (r() - 0.5) * 0.06, base = pos.length / 3;
        pos.push(cx - qw / 2, cy, zz, cx + qw / 2, cy, zz, cx + qw / 2, cy + qh, zz, cx - qw / 2, cy + qh, zz);
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (var q = 0; q < 4; q++) nor.push(0, 0.35, 1);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    geo.normalizeNormals();
    var sp = new T.Mesh(geo, this.mSprout);
    sp.userData.own = true;
    sp.frustumCulled = false;
    g.add(sp);
    /* キャベツ */
    /* 大きめのざく切りを、もやしの表面から見えるように混ぜる */
    var nc = Math.round((kind === "kyabetsu" ? 16 : 7) * R * R + (kind === "kyabetsu" ? 5 : 2));
    var lm = new T.InstancedMesh(this.gLeaf, this.mLeaf, nc), ls = Math.min(1, 0.35 + R * 0.5);
    for (i = 0; i < nc; i++) {
      a = r() * Math.PI * 2; u = 0.35 + Math.sqrt(r()) * 0.6;
      d.position.set(Math.cos(a) * u * R, H * Math.sqrt(Math.max(0, 1 - u * u)) * 0.95 - 0.03, Math.sin(a) * u * R);
      d.rotation.set((r() - 0.5) * 0.7, r() * 6, (r() - 0.5) * 0.7);
      d.scale.set((0.2 + r() * 0.12) * ls, 0.018, (0.13 + r() * 0.08) * ls);
      d.updateMatrix(); lm.setMatrixAt(i, d.matrix);
      col.setHSL(0.17 + r() * 0.05, 0.5 + r() * 0.2, 0.72 + r() * 0.1);   /* 淡い黄緑 */
      lm.setColorAt(i, col);
    }
    lm.frustumCulled = false;
    g.add(lm);
    /* ニンニク：てっぺんに刻みの小山 */
    if (kind === "ninniku") {
      var ng = Math.max(4, Math.round(36 * Math.min(1, R / 0.8))), gm = new T.InstancedMesh(this.gCube, this.mGarlic, ng);
      for (i = 0; i < ng; i++) {
        a = r() * Math.PI * 2; u = Math.sqrt(r()) * Math.min(0.35, R * 0.6);
        d.position.set(Math.cos(a) * u, H * 0.72 + (0.35 - u) * 0.25 + r() * 0.03, Math.sin(a) * u);
        d.rotation.set(r() * 3, r() * 3, r() * 3);
        var c = 0.035 + r() * 0.02; d.scale.set(c, c, c);
        d.updateMatrix(); gm.setMatrixAt(i, d.matrix);
      }
      gm.frustumCulled = false;
      g.add(gm);
    }
    /* アブラとカラメ */
    if (kind === "abura") {
      var nf = Math.max(1, Math.round(10 * R)), fm = new T.InstancedMesh(this.gCube, this.mFat, nf), km = new T.InstancedMesh(this.gLeaf, this.mKarame, nf);
      for (i = 0; i < nf; i++) {
        a = r() * Math.PI * 2; u = Math.sqrt(r()) * 0.7;
        var y = H * Math.sqrt(Math.max(0, 1 - u * u)) * 0.82 - 0.04;
        d.position.set(Math.cos(a) * u * R, y, Math.sin(a) * u * R);
        d.rotation.set(r() * 0.6, r() * 3, r() * 0.6);
        d.scale.set(0.1 + r() * 0.05, 0.07, 0.09);
        d.updateMatrix(); fm.setMatrixAt(i, d.matrix);
        d.position.y -= 0.03;
        d.scale.set(0.12, 0.025, 0.1);
        d.updateMatrix(); km.setMatrixAt(i, d.matrix);
      }
      fm.frustumCulled = false; km.frustumCulled = false;
      g.add(km); g.add(fm);
    }
    /* もやしの山には影を付けない */
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    g.userData.R = R;
    return g;
  };

  function drop(g) {
    g.traverse(function (o) { if (o.isInstancedMesh) o.dispose(); if (o.userData.own) o.geometry.dispose(); });
    if (g.parent) g.parent.remove(g);
  }

  /* ============ 店 ============ */
  function canvasTex(w, h, paint) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    paint(c.getContext("2d"), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  RamenScene.prototype.makeShop = function () {
    var s = this.scene;
    /* 壁：白いタイルと黄色い帯 */
    var tile = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#fbf6e8"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ddd2b4"; g.lineWidth = 4;
      for (var i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); }
    });
    tile.wrapS = tile.wrapT = T.RepeatWrapping;
    tile.repeat.set(80 / 0.9, (CEIL / M + 3) / 0.9);
    var wallH = CEIL / M + 3;
    var wall = this.wall = new T.Mesh(new T.PlaneGeometry(80, wallH), new T.MeshStandardMaterial({ map: tile, color: 0xc8b898, roughness: 0.75 }));
    wall.position.set(0, wallH / 2 - 3, -4.5);
    s.add(wall);
    var band = new T.Mesh(new T.BoxGeometry(80, 0.7, 0.05), new T.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 }));
    band.position.set(0, 5.9, -4.45);
    s.add(band);
    var band2 = new T.Mesh(new T.BoxGeometry(80, 0.08, 0.06), new T.MeshStandardMaterial({ color: 0xb8860b }));
    band2.position.set(0, 5.52, -4.44);
    s.add(band2);
    /* カウンター：赤い天板 */
    var red = new T.MeshStandardMaterial({ color: 0xc81e1a, roughness: 0.3 });
    var top = this.counterTop = new T.Mesh(new T.BoxGeometry(60, 0.25, 7), red);
    top.position.set(0, -1.63, 0);
    s.add(top);
    /* 作る台（上の段）の前の赤い壁と、客の前のカウンター（下の段） */
    var front = new T.Mesh(new T.BoxGeometry(60, 2.8, 0.3), new T.MeshStandardMaterial({ color: 0xb01a16, roughness: 0.5 }));
    front.position.set(0, -2.9, 3.4);
    s.add(front);
    var low = this.counterLow = new T.Mesh(new T.BoxGeometry(60, 0.25, 7.5), red);
    low.position.set(0, -4.425, 7.3);
    s.add(low);
    var edge = new T.Mesh(new T.BoxGeometry(60, 0.12, 7.6), new T.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6 }));
    edge.position.set(0, -4.6, 7.3);
    s.add(edge);
    var under = new T.Mesh(new T.BoxGeometry(60, 10, 0.3), new T.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.8 }));
    under.position.set(0, -9.7, 10.9);
    s.add(under);
    /* コップとレンゲ立て（小物） */
    var glass = new T.Mesh(new T.CylinderGeometry(0.32, 0.27, 0.9, 20, 1, true), new T.MeshStandardMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.35, roughness: 0.05, side: T.DoubleSide }));
    glass.position.set(3.4, -3.85, 7.6);   /* 手前の下の段に、最初から水 */
    s.add(glass);
    var water = new T.Mesh(new T.CylinderGeometry(0.27, 0.25, 0.6, 20), new T.MeshStandardMaterial({ color: 0xe2f2fa, transparent: true, opacity: 0.4, roughness: 0.05 }));
    water.position.set(3.4, -4.0, 7.6);
    s.add(water);
    /* 天井 */
    this.ceil = new T.Group();
    s.add(this.ceil);
    this.buildCeil(null);
    /* 吊り照明 */
    var self = this;
    this.lamps = [];
    [-2.3, 2.3].forEach(function (x) {
      var g = new T.Group();
      var cord = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 1.4, 4), new T.MeshStandardMaterial({ color: 0x222222 }));
      cord.position.y = -0.7; g.add(cord);
      var shade = new T.Mesh(new T.ConeGeometry(0.45, 0.4, 20, 1, true), new T.MeshStandardMaterial({ color: 0xb82e22, roughness: 0.4, side: T.DoubleSide }));
      shade.position.y = -1.5; g.add(shade);
      var bulb = new T.Mesh(new T.SphereGeometry(0.13, 10, 8), new T.MeshBasicMaterial({ color: 0xfff1c4 }));
      bulb.position.y = -1.68; g.add(bulb);
      g.position.set(x, CEIL / M, -1.5);
      s.add(g);
      self.lamps.push(g);
    });
  };
  RamenScene.prototype.buildCeil = function (hole) {
    var c = this.ceil, mat = this.ceilMat || (this.ceilMat = new T.MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.9 }));
    while (c.children.length) c.remove(c.children[0]);
    var y = CEIL / M + 0.3, th = 0.6;
    function slab(x0, x1, z0, z1) {
      if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
      var m = new T.Mesh(new T.BoxGeometry(x1 - x0, th, z1 - z0), mat);
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      c.add(m);
    }
    if (!hole) { slab(-40, 40, -4.5, 8); return; }
    var a = hole[0] / M, b = hole[1] / M, rz = (b - a) / 2;
    slab(-40, a, -4.5, 8); slab(b, 40, -4.5, 8);
    slab(a, b, -4.5, -rz); slab(a, b, rz, 8);
    /* 割れたかけら */
    var r = rng(55);
    for (var i = 0; i < 14; i++) {
      var m = new T.Mesh(this.gCube, mat);
      var ang = r() * Math.PI * 2;
      m.position.set((a + b) / 2 + Math.cos(ang) * (rz + 0.1), y + (r() - 0.5) * 0.3, Math.sin(ang) * (rz + 0.1));
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      m.scale.set(0.2 + r() * 0.3, 0.15 + r() * 0.2, 0.2 + r() * 0.3);
      c.add(m);
    }
  };

  /* ============ どんぶり ============ */
  RamenScene.prototype.makeBowl = function () {
    var s = this.dish;
    var pts = [], prof = [[0, -1.5], [1.0, -1.5], [1.04, -1.42], [1.0, -1.3], [1.2, -1.25], [1.55, -1.0], [1.85, -0.55], [2.05, 0.0], [2.14, 0.3], [2.18, 0.34], [2.12, 0.35], [2.04, 0.2], [1.8, -0.4], [1.2, -1.0], [0, -1.12]];
    prof.forEach(function (p) { pts.push(new T.Vector2(p[0], p[1])); });
    var bowl = new T.Mesh(new T.LatheGeometry(pts, 48), new T.MeshPhysicalMaterial({ color: 0xe6eef6, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08, side: T.DoubleSide }));
    s.add(bowl);
    /* スープ */
    var soup = new T.Mesh(new T.CircleGeometry(2.02, 48), new T.MeshPhysicalMaterial({ color: 0x4a2008, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }));
    soup.rotation.x = -Math.PI / 2; soup.position.y = 0.12;
    s.add(soup);
    var r = rng(9), fat = new T.MeshStandardMaterial({ color: 0xf0b860, roughness: 0.02, transparent: true, opacity: 0.6, emissive: 0x3a2008 });
    /* 脂の粒はまとめて1回で描く */
    var dots = new T.InstancedMesh(new T.CircleGeometry(1, 10), fat, 26), d = this.dummy;
    for (var i = 0; i < 26; i++) {
      var a = r() * 6.28, u = 1.45 + r() * 0.5, ds = 0.04 + r() * 0.07;
      d.rotation.set(-Math.PI / 2, 0, 0); d.scale.set(ds, ds, ds);
      d.position.set(Math.cos(a) * u, 0.125, Math.sin(a) * u);
      d.updateMatrix(); dots.setMatrixAt(i, d.matrix);
    }
    s.add(dots);
    /* 刻みニンニクの小山：最初から左手前に乗っている */
    var gn = 220, gm = new T.InstancedMesh(this.gCube, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x2a2208, emissiveIntensity: 0.6 }), gn), gc = new T.Color();
    for (i = 0; i < gn; i++) {
      var ga = r() * Math.PI * 2, gu = Math.sqrt(r());
      d.position.set(-1.1 + Math.cos(ga) * gu * 0.55, 0.16 + (1 - gu * gu) * 0.45 + r() * 0.05, 1.0 + Math.sin(ga) * gu * 0.4);
      d.rotation.set(r() * 3, r() * 3, r() * 3);
      var gs = 0.08 + r() * 0.06; d.scale.set(gs, gs * (0.7 + r() * 0.5), gs);
      d.updateMatrix(); gm.setMatrixAt(i, d.matrix);
      gc.setHSL(0.12 + r() * 0.03, 0.75 + r() * 0.2, 0.62 + r() * 0.14);
      gm.setColorAt(i, gc);
    }
    gm.castShadow = gm.receiveShadow = true;
    s.add(gm);
    /* 極太麺（ふちから見えるぶん） */
    var nm = new T.MeshStandardMaterial({ color: 0xd9a748, roughness: 0.3 });
    for (i = 0; i < 16; i++) {
      a = r() * 6.28;
      var p0 = new T.Vector3(Math.cos(a) * 1.25, 0.05, Math.sin(a) * 1.25);
      var p1 = new T.Vector3(Math.cos(a + 0.3) * 1.75, 0.3 + r() * 0.15, Math.sin(a + 0.3) * 1.75);
      var p2 = new T.Vector3(Math.cos(a + 0.6) * 1.95, 0.05, Math.sin(a + 0.6) * 1.95);
      var tube = new T.Mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(p0, p1, p2), 10, 0.065, 6, false), nm);
      tube.scale.set(1, 1, 1);
      s.add(tube);
    }
    /* チャーシュー（豚）：丸く巻いた厚切り。まわりはこんがり焼き色、断面は淡い桃色に巻きの筋 */
    var crust = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#9a5522"; g.fillRect(0, 0, w, h);
      var rr = rng(12);
      for (var i = 0; i < 900; i++) {
        var c = rr();
        g.fillStyle = c < 0.4 ? "rgba(70,30,8,.5)" : c < 0.8 ? "rgba(200,130,60,.5)" : "rgba(240,190,120,.5)";
        g.beginPath(); g.arc(rr() * w, rr() * h, 2 + rr() * 7, 0, 7); g.fill();
      }
    });
    crust.wrapS = crust.wrapT = T.RepeatWrapping;
    var side = new T.MeshPhysicalMaterial({ map: crust, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    var face = canvasTex(512, 512, function (g, w, h) {
      var cx = w / 2, cy = h / 2, rr = rng(4);
      g.fillStyle = "#8a4a1c"; g.fillRect(0, 0, w, h);          /* 縁の焼き色 */
      g.fillStyle = "#c58a62";
      g.beginPath(); g.ellipse(cx, cy, w * 0.45, h * 0.44, 0, 0, 7); g.fill();
      var m = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.44);
      m.addColorStop(0, "#e2bba4"); m.addColorStop(0.75, "#d6a88c"); m.addColorStop(1, "#bf8460");
      g.fillStyle = m;
      g.beginPath(); g.ellipse(cx, cy, w * 0.42, h * 0.41, 0, 0, 7); g.fill();
      /* 巻いた肉の重なりの筋（うずまき） */
      g.lineCap = "round";
      for (var pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? "rgba(245,225,205,.55)" : "rgba(150,80,50,.45)";
        g.lineWidth = pass ? 4 : 7;
        g.beginPath();
        for (var t = 0; t <= 1.0001; t += 0.01) {
          var ang = t * Math.PI * 5.2 + 0.6, rad = (0.06 + t * 0.34) * w;
          var x = cx + Math.cos(ang) * rad * 1.02 + (pass ? 3 : 0), y = cy + Math.sin(ang) * rad * 0.98;
          if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      /* 肉の繊維と、ところどころの脂 */
      for (var i = 0; i < 420; i++) {
        var a = rr() * 6.28, u = Math.sqrt(rr()) * 0.4;
        g.fillStyle = rr() < 0.75 ? "rgba(150,85,60," + (rr() * 0.2) + ")" : "rgba(255,240,225," + (rr() * 0.35) + ")";
        g.fillRect(cx + Math.cos(a) * u * w, cy + Math.sin(a) * u * h, 2 + rr() * 6, 2);
      }
      /* 焼き色から肉へのなじみ */
      var e = g.createRadialGradient(cx, cy, w * 0.33, cx, cy, w * 0.47);
      e.addColorStop(0, "rgba(120,55,20,0)"); e.addColorStop(1, "rgba(120,55,20,.6)");
      g.fillStyle = e; g.fillRect(0, 0, w, h);
      /* タレの照り */
      var tl = g.createLinearGradient(0, 0, w, h);
      tl.addColorStop(0.3, "rgba(255,240,220,0)"); tl.addColorStop(0.4, "rgba(255,245,230,.35)"); tl.addColorStop(0.5, "rgba(255,240,220,0)");
      g.fillStyle = tl; g.fillRect(0, 0, w, h);
    });
    /* タレのてり：表面に強い艶の層 */
    var faceM = new T.MeshPhysicalMaterial({ map: face, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 3 });
    side.envMapIntensity = 3;
    /* 最後にどんぶりへ落とす2枚 */
    var ch = this.chashu = new T.Group();
    ch.visible = false;
    s.add(ch);
    /* 少しいびつな丸（横0.9×縦0.8） */
    var sh = new T.Shape(), pts2 = [], cr = rng(21);
    for (var q = 0; q < 14; q++) {
      var qa = q / 14 * Math.PI * 2, qr = 1 + (cr() - 0.5) * 0.08;
      pts2.push([0.45 + Math.cos(qa) * 0.45 * qr, 0.4 + Math.sin(qa) * 0.4 * qr]);
    }
    sh.moveTo((pts2[0][0] + pts2[1][0]) / 2, (pts2[0][1] + pts2[1][1]) / 2);
    for (q = 1; q <= 14; q++) { var q1 = pts2[q % 14], q2 = pts2[(q + 1) % 14]; sh.quadraticCurveTo(q1[0], q1[1], (q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2); }
    var cg = new T.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 4 });
    /* 断面の模様は 0〜1 に合わせて貼る */
    var uv = cg.attributes.uv;
    for (var k = 0; k < uv.count; k++) { uv.setX(k, uv.getX(k) / 0.9); uv.setY(k, uv.getY(k) / 0.8); }
    cg.center();
    /* どんぶりの右側に、2枚をずらして重ねる */
    [[0.35, 0.55, 1.7, -0.5, 0.2, 0.15], [0.75, 0.45, 1.6, -0.5, 0.3, 0.3]].forEach(function (p) {
      var m = new T.Mesh(cg, [faceM, side]);
      m.scale.set(0.85, 0.85, 0.85);
      m.rotation.set(p[3], p[4], p[5]);
      m.position.set(p[0], p[1], p[2]);
      ch.add(m);
    });
  };

  /* 終わりにてっぺんへ乗せるアブラの小山（カラメがけ） */
  RamenScene.prototype.makeAbura = function () {
    var g = this.abura = new T.Group(), r = rng(77), d = this.dummy, n = 46;
    var fm = new T.InstancedMesh(this.gCube, this.mFat, n), km = new T.InstancedMesh(this.gLeaf, this.mKarame, 14);
    for (var i = 0; i < n; i++) {
      var a = r() * Math.PI * 2, u = Math.sqrt(r()) * 0.7;
      d.position.set(Math.cos(a) * u, (0.7 - u) * 0.75 + r() * 0.06, Math.sin(a) * u * 0.8);
      d.rotation.set(r() * 3, r() * 3, r() * 3);
      var c = 0.15 + r() * 0.09; d.scale.set(c * 1.2, c, c);
      d.updateMatrix(); fm.setMatrixAt(i, d.matrix);
    }
    for (i = 0; i < 14; i++) {
      a = r() * Math.PI * 2; u = Math.sqrt(r()) * 0.55;
      d.position.set(Math.cos(a) * u, (0.7 - u) * 0.75 + 0.12, Math.sin(a) * u * 0.8);
      d.rotation.set(0, r() * 3, 0); d.scale.set(0.16, 0.03, 0.12);
      d.updateMatrix(); km.setMatrixAt(i, d.matrix);
    }
    fm.frustumCulled = km.frustumCulled = false;
    g.add(fm); g.add(km);
    g.visible = false;
    this.dish.add(g);
  };

  /* ============ 空 ============ */
  RamenScene.prototype.makeSky = function () {
    var s = this.scene, r = rng(31);
    /* 雲は球をまとめて1回で描く */
    var cm = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8090a0, emissiveIntensity: 0.25 });
    var clouds = new T.InstancedMesh(new T.SphereGeometry(1, 10, 6), cm, 300), d = this.dummy;
    for (var i = 0; i < 60; i++) {
      var y = CEIL / M + 6 + r() * 150, cx = (r() < 0.5 ? -1 : 1) * (2.5 + r() * 6), cz = -3 - r() * 6;
      for (var k = 0; k < 5; k++) {
        d.position.set(cx + k * 0.8 - 1.6, y + (k % 2) * 0.3, cz + r() * 0.4);
        var sc = 0.6 + r() * 0.6; d.rotation.set(0, 0, 0); d.scale.set(sc * 1.2, sc * 0.8, sc);
        d.updateMatrix(); clouds.setMatrixAt(i * 5 + k, d.matrix);
      }
    }
    s.add(clouds);
    var n = 1500, pos = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 120;
      pos[i * 3 + 1] = CEIL / M + 120 + r() * 600;
      pos[i * 3 + 2] = -20 - r() * 30;
    }
    var geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    this.stars = new T.Points(geo, new T.PointsMaterial({ color: 0xfffbe8, size: 2, sizeAttenuation: false }));
    s.add(this.stars);
  };
  var SKY = [[0x8c, 0xc9, 0xf0], [0x46, 0x78, 0xc8], [0x0c, 0x10, 0x30], [0x02, 0x02, 0x0a]];
  function skyColor(y) {
    var t = Math.max(0, (y - CEIL) / 9000) || 0, i = Math.min(2, Math.floor(t)), f = Math.min(1, t - i);
    var a = SKY[i], b = SKY[i + 1];
    return new T.Color((a[0] + (b[0] - a[0]) * f) / 255, (a[1] + (b[1] - a[1]) * f) / 255, (a[2] + (b[2] - a[2]) * f) / 255);
  }

  /* ============ 毎コマ ============ */
  RamenScene.prototype.reset = function () {
    this.layers.forEach(drop);
    this.layers = [];
    if (this.held) { drop(this.held); this.held = null; }
    if (this.fall) { drop(this.fall); this.fall = null; }
    for (var k in this.spills) drop(this.spills[k]);
    this.spills = {};
    this.holeOn = false;
    this.buildCeil(null);
  };

  /* st: { layers:[{x,w,kind,pop}], camY, zoom, H, handX, holdW, holdKind, n, falling:{x,y,w,kind,id}, spills:[{x,y,r,w,kind,id}], ending, intro } */
  RamenScene.prototype.render = function (ctx, W, H, st) {
    var dpr = Math.min(1.5, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (!(w >= 2 && h >= 2)) return false;     /* 画面の大きさが決まる前（0や数でない）は描かない */
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
      this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
    }
    var self = this, s = this.scene;
    /* 段を足す・消す */
    if (st.layers.length < this.layers.length) { while (this.layers.length > st.layers.length) drop(this.layers.pop()); }
    while (this.layers.length < st.layers.length) {
      var i = this.layers.length, L = st.layers[i];
      var g = this.clump(L.w, L.kind, i);
      g.position.set(L.x / M, (i - 1) * LAYER / M, 0);
      if (i === 0) g.visible = false;           /* 0段目は見えない土台 */
      this.dish.add(g);
      this.layers.push(g);
    }
    /* カメラ：2Dの見え方（画面の H*0.62 に camY、1m = 100*zoom）に合わせる */
    var tan = Math.tan(this.camera.fov * Math.PI / 360);
    var D = (H / 2) / (tan * st.zoom * M);
    var ty = (st.camY + 0.12 * H / st.zoom) / M;
    var py = ty + D * 0.18, pz = D, ly = ty;
    var halfV = (H / 2) / (st.zoom * M) + 2;
    if (!(st.endCam > 0)) this.camStart = { py: py, pz: pz, ly: ly };
    else {
      /* 終わりの引き：下の段に置いたあとのどんぶりの底から、山のてっぺんまでを画面のタテいっぱいに */
      var yt = (st.layers.length - 1) * LAYER / M + 0.8, zt = 0;
      var yb = -1.5 - 2.8, zb = 6.0 + 2.2;
      var a1 = (0.5 - 0.13) * 2 * tan, a2 = (0.83 - 0.5) * 2 * tan;   /* 見下ろす分、下は少し余らせる */
      var De = Math.max(zb + 15, (yt - yb + a1 * zt + a2 * zb) / (a1 + a2));
      var cy = yb + a2 * (De - zb);
      var e = st.endCam, c0 = this.camStart || { py: py, pz: pz, ly: ly };
      py = c0.py + (cy - c0.py) * e; pz = c0.pz + (De - c0.pz) * e; ly = c0.ly + (cy - c0.ly) * e;
      D = pz; ty = ly; halfV = 1e6;
    }
    /* 終わりは少し上から見下ろす */
    if (st.endCam > 0) py += pz * 0.22 * st.endCam;
    this.camera.position.set(0, py, pz);
    this.camera.lookAt(0, ly, 0);
    this.camera.near = Math.max(0.5, D * 0.2); this.camera.far = D + 1000;
    this.camera.updateProjectionMatrix();
    for (i = 0; i < this.layers.length; i++) {
      var y = (i - 1) * LAYER / M;
      var vis = i > 0 && y > ty - halfV - 1 && y < ty + halfV + 1;
      this.layers[i].visible = vis;
      var pop = st.layers[i].pop || 0;
      if (vis) this.layers[i].scale.set(1 + pop * 0.06, 1 + pop * 0.25, 1 + pop * 0.06);
    }
    /* 天井の穴 */
    if (!this.holeOn && (st.layers.length - 1) * LAYER > CEIL - 20) {
      var hi = Math.min(st.layers.length - 1, Math.floor(CEIL / LAYER) + 1), HL = st.layers[hi];
      this.buildCeil([HL.x - HL.w / 2 - 30, HL.x + HL.w / 2 + 30]);
      this.holeOn = true;
      this.lamps.forEach(function (l) { l.visible = Math.abs(l.position.x - HL.x / M) > HL.w / M / 2 + 0.6; });
    }
    /* 空の色 */
    var c = skyColor(ty * M);
    this.renderer.setClearColor(c, 1);
    /* 照明と影を、見ている高さについていかせる */
    var sh = Math.max(4, Math.min(halfV, D * tan * 1.3) * 1.1);
    this.key.position.set(-2.5, ty + 9, 6);
    this.key.target.position.set(0, ty - 1, 0);
    var sc = this.key.shadow.camera;
    if (sc.top !== sh) { sc.left = -sh * 0.8; sc.right = sh * 0.8; sc.top = sh; sc.bottom = -sh; sc.near = 1; sc.far = 40 + sh * 2; sc.updateProjectionMatrix(); }
    this.rim.position.set(3, ty + 4, -6);
    this.rim.target.position.set(0, ty, 0);
    this.stepSteam(st.time || 0);
    var outside = ty * M > CEIL + 200;
    this.scene.environmentIntensity = outside ? 0.9 : 0.6;
    /* 終わりにチャーシューが落ちてきて、てっぺんに乗る */
    /* 終わりの演出：てっぺんにアブラが落ちて乗り、引いたあとどんぶりにチャーシューが落ちてくる */
    this.abura.visible = st.abura >= 0;
    if (st.abura >= 0) {
      var TL = st.layers[st.layers.length - 1], at = st.abura;
      this.abura.position.set(TL.x / M, ((st.layers.length - 1) * LAYER - 12) / M + (1 - at * at) * 3.5, 0);
      var as = Math.max(0.7, Math.min(1.5, TL.w / M / 1.2));
      this.abura.scale.set(as, as, as);
    }
    this.chashu.visible = st.chashu >= 0;
    if (st.chashu >= 0) { var ct = st.chashu; this.chashu.position.set(0, (1 - ct * ct) * 8, 0); }
    /* 完成したら、上の段から手前の下の段へドンと置く（少し持ち上げてから落とす） */
    var pl = st.place > 0 ? st.place : 0, pe = pl * pl;
    this.dish.position.set(0, -2.8 * pe + Math.sin(Math.PI * Math.min(1, pl * 1.3)) * 1.2, 6.0 * Math.min(1, pl * 1.25));
    /* 持っている山 */
    var topY = (st.layers.length - 1) * LAYER;
    var showHand = !st.ending && !st.intro, hx = st.handX;
    var hkey = showHand && !st.falling ? st.n + ":" + Math.round(st.holdW) : null;
    if (this.heldKey !== hkey) {
      if (this.held) { drop(this.held); this.held = null; }
      if (hkey) { this.held = this.clump(st.holdW, st.holdKind, st.n); s.add(this.held); }
      this.heldKey = hkey;
    }
    if (this.held) this.held.position.set(hx / M, (topY + st.handUp) / M, 0);
    /* 落ちている山 */
    var fkey = st.falling ? st.falling.id : null;
    if (this.fallKey !== fkey) {
      if (this.fall) { drop(this.fall); this.fall = null; }
      if (st.falling) { this.fall = this.clump(st.falling.w, st.falling.kind, st.n); s.add(this.fall); }
      this.fallKey = fkey;
    }
    if (this.fall) this.fall.position.set(st.falling.x / M, st.falling.y / M, 0);
    /* こぼれ */
    var seen = {};
    st.spills.forEach(function (p) {
      seen[p.id] = true;
      var m = self.spills[p.id];
      if (!m) { m = self.spills[p.id] = self.clump(p.w, p.kind, p.id + 500); s.add(m); }
      m.position.set(p.x / M, p.y / M, p.z || 0);
      m.rotation.set(0, 0, p.r);
    });
    for (var k in this.spills) if (!seen[k]) { drop(this.spills[k]); delete this.spills[k]; }

    this.renderer.render(s, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    /* 周辺を少し落とす */
    if (!this.vig || this.vig.h !== H) {
      var vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.75);
      vg.addColorStop(0, "rgba(20,10,0,0)"); vg.addColorStop(1, "rgba(20,10,0,.45)");
      this.vig = { g: vg, h: H };
    }
    ctx.fillStyle = this.vig.g;
    ctx.fillRect(0, 0, W, H);
    return true;
  };

  global.RamenScene = RamenScene;
})(window);
