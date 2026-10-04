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
    this.renderer.setClearColor(0xf1e3b8, 1);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(32, 0.5, 0.5, 4000);
    this.scene.add(new T.HemisphereLight(0xfff6e6, 0x6a5038, 1.5));
    var key = new T.DirectionalLight(0xffefd8, 2.2);
    key.position.set(-4, 8, 7);
    this.scene.add(key);
    var rim = new T.DirectionalLight(0xc8dcff, 0.7);
    rim.position.set(5, 3, -4);
    this.scene.add(rim);
    this.layers = [];
    this.held = null; this.fall = null; this.spills = {};
    this.w = 0; this.h = 0;
    this.makeParts();
    this.makeShop();
    this.makeBowl();
    this.makeSky();
    this.makeTongs();
  }

  /* ============ 共通の部品 ============ */
  RamenScene.prototype.makeParts = function () {
    /* もやし1本：少し曲がった細い管 */
    var curve = new T.QuadraticBezierCurve3(new T.Vector3(-0.15, 0, 0), new T.Vector3(0, 0.045, 0), new T.Vector3(0.15, 0, 0));
    this.gSprout = new T.TubeGeometry(curve, 3, 0.024, 4, false);
    this.gHead = new T.SphereGeometry(0.034, 5, 4);
    this.gLeaf = new T.SphereGeometry(1, 8, 5);
    this.gCube = new T.BoxGeometry(1, 1, 1);
    this.gDome = new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    this.mSprout = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0 });
    this.mHead = new T.MeshStandardMaterial({ color: 0xe6cf5c, roughness: 0.6 });
    this.mLeaf = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: T.DoubleSide });
    this.mDome = new T.MeshStandardMaterial({ color: 0xe8dfb8, roughness: 0.9 });
    this.mGarlic = new T.MeshStandardMaterial({ color: 0xeedc94, roughness: 0.8 });
    this.mFat = new T.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.25, transparent: true, opacity: 0.92 });
    this.mKarame = new T.MeshStandardMaterial({ color: 0x6b3412, roughness: 0.15, transparent: true, opacity: 0.8 });
    this.dummy = new T.Object3D();
  };

  /* 一段のヤサイの山。w はゲームの幅 */
  RamenScene.prototype.clump = function (w, kind, salt) {
    var g = new T.Group(), r = rng(1000 + salt * 97 + Math.round(w)), d = this.dummy;
    var R = w / 2 / M, H = 0.44;
    var dome = new T.Mesh(this.gDome, this.mDome);
    dome.scale.set(R * 0.85, H * 0.7, R * 0.85);
    dome.position.y = -0.1;
    g.add(dome);

    var n = Math.round(40 + 190 * R * R);
    var sp = new T.InstancedMesh(this.gSprout, this.mSprout, n);
    var heads = [], col = new T.Color(), end = new T.Vector3();
    for (var i = 0; i < n; i++) {
      var a = r() * Math.PI * 2, u = Math.pow(r(), 0.35);
      var px = Math.cos(a) * u * R, pz = Math.sin(a) * u * R;
      var py = H * Math.sqrt(Math.max(0, 1 - u * u)) * (0.6 + r() * 0.45) - 0.1 - r() * 0.05;
      d.position.set(px, py, pz);
      d.rotation.set((r() - 0.5) * 1.6, r() * Math.PI * 2, (r() - 0.5) * 1.2);
      var s = 0.8 + r() * 0.5;
      d.scale.set(s, 1, 1);
      d.updateMatrix();
      sp.setMatrixAt(i, d.matrix);
      col.setHSL(0.12 + r() * 0.03, 0.3 + r() * 0.4, 0.8 + r() * 0.16);
      sp.setColorAt(i, col);
      if (r() < 0.4) { end.set(r() < 0.5 ? 0.13 : -0.13, 0, 0).applyMatrix4(d.matrix); heads.push(end.clone()); }
    }
    sp.frustumCulled = false;
    g.add(sp);
    if (heads.length) {
      var hm = new T.InstancedMesh(this.gHead, this.mHead, heads.length);
      heads.forEach(function (p, k) { d.position.copy(p); d.rotation.set(0, 0, 0); d.scale.set(1.1, 0.8, 0.8); d.updateMatrix(); hm.setMatrixAt(k, d.matrix); });
      hm.frustumCulled = false;
      g.add(hm);
    }
    /* キャベツ */
    var nc = Math.round((kind === "kyabetsu" ? 14 : 3) * R * R + (kind === "kyabetsu" ? 4 : 1));
    var lm = new T.InstancedMesh(this.gLeaf, this.mLeaf, nc);
    for (i = 0; i < nc; i++) {
      a = r() * Math.PI * 2; u = Math.sqrt(r()) * 0.9;
      d.position.set(Math.cos(a) * u * R, H * Math.sqrt(Math.max(0, 1 - u * u)) * 0.85 - 0.06, Math.sin(a) * u * R);
      d.rotation.set((r() - 0.5) * 1.2, r() * 6, (r() - 0.5) * 1.2);
      d.scale.set(0.09 + r() * 0.06, 0.012, 0.06 + r() * 0.04);
      d.updateMatrix(); lm.setMatrixAt(i, d.matrix);
      col.setHSL(0.24 + r() * 0.04, 0.5, 0.45 + r() * 0.25);
      lm.setColorAt(i, col);
    }
    lm.frustumCulled = false;
    g.add(lm);
    /* ニンニク：てっぺんに刻みの小山 */
    if (kind === "ninniku") {
      var ng = 36, gm = new T.InstancedMesh(this.gCube, this.mGarlic, ng);
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
      var nf = Math.max(6, Math.round(10 * R)), fm = new T.InstancedMesh(this.gCube, this.mFat, nf), km = new T.InstancedMesh(this.gLeaf, this.mKarame, nf);
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
    g.userData.R = R;
    return g;
  };

  function drop(g) {
    g.traverse(function (o) { if (o.isInstancedMesh) o.dispose(); });
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
    tile.repeat.set(80 / 0.6, (CEIL / M + 3) / 0.6);
    var wallH = CEIL / M + 3;
    var wall = new T.Mesh(new T.PlaneGeometry(80, wallH), new T.MeshStandardMaterial({ map: tile, roughness: 0.6, emissive: 0x302820, emissiveIntensity: 0.6 }));
    wall.position.set(0, wallH / 2 - 3, -4.5);
    s.add(wall);
    var band = new T.Mesh(new T.BoxGeometry(80, 0.7, 0.05), new T.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 }));
    band.position.set(0, 5.9, -4.45);
    s.add(band);
    var band2 = new T.Mesh(new T.BoxGeometry(80, 0.08, 0.06), new T.MeshStandardMaterial({ color: 0xb8860b }));
    band2.position.set(0, 5.52, -4.44);
    s.add(band2);
    /* カウンター */
    var wood = canvasTex(512, 128, function (g, w, h) {
      g.fillStyle = "#a8743e"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 40; i++) { g.strokeStyle = "rgba(90,50,20," + (0.08 + Math.random() * 0.12) + ")"; g.lineWidth = 1 + Math.random() * 2; var y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 2); g.stroke(); }
    });
    wood.wrapS = T.RepeatWrapping; wood.repeat.set(6, 1);
    var top = new T.Mesh(new T.BoxGeometry(60, 0.25, 7), new T.MeshStandardMaterial({ map: wood, roughness: 0.55 }));
    top.position.set(0, -1.63, 0);
    s.add(top);
    var front = new T.Mesh(new T.BoxGeometry(60, 6, 0.3), new T.MeshStandardMaterial({ color: 0x5e3b1c, roughness: 0.8 }));
    front.position.set(0, -4.7, 3.4);
    s.add(front);
    /* コップとレンゲ立て（小物） */
    var glass = new T.Mesh(new T.CylinderGeometry(0.32, 0.27, 0.9, 20, 1, true), new T.MeshStandardMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.35, roughness: 0.05, side: T.DoubleSide }));
    glass.position.set(3.1, -1.05, 0.6);
    s.add(glass);
    var water = new T.Mesh(new T.CylinderGeometry(0.27, 0.25, 0.6, 20), new T.MeshStandardMaterial({ color: 0xe2f2fa, transparent: true, opacity: 0.4, roughness: 0.05 }));
    water.position.set(3.1, -1.2, 0.6);
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
    var s = this.scene;
    var pts = [], prof = [[0, -1.5], [1.0, -1.5], [1.04, -1.42], [1.0, -1.3], [1.2, -1.25], [1.55, -1.0], [1.85, -0.55], [2.05, 0.0], [2.14, 0.3], [2.18, 0.34], [2.12, 0.35], [2.04, 0.2], [1.8, -0.4], [1.2, -1.0], [0, -1.12]];
    prof.forEach(function (p) { pts.push(new T.Vector2(p[0], p[1])); });
    var tex = canvasTex(1024, 256, function (g, w, h) {
      g.fillStyle = "#f7f4ec"; g.fillRect(0, 0, w, h);
      /* 外側の模様（雷紋っぽい帯）と縁。v は上が縁 */
      g.fillStyle = "#16202e"; g.fillRect(0, 48, w, 10);
      g.strokeStyle = "#c0392b"; g.lineWidth = 9; g.lineJoin = "miter";
      var y0 = 80, s2 = 26;
      for (var k = 0; k < w / (s2 * 2); k++) {
        var x = k * s2 * 2;
        g.beginPath();
        g.moveTo(x, y0 + s2); g.lineTo(x, y0); g.lineTo(x + s2 * 1.5, y0); g.lineTo(x + s2 * 1.5, y0 + s2 * 0.8);
        g.lineTo(x + s2 * 0.5, y0 + s2 * 0.8); g.lineTo(x + s2 * 0.5, y0 + s2 * 0.35); g.lineTo(x + s2, y0 + s2 * 0.35);
        g.stroke();
      }
      g.fillStyle = "#c0392b"; g.fillRect(0, 128, w, 6);
      g.fillStyle = "#16202e"; g.fillRect(0, 0, w, 14);
    });
    var bowl = new T.Mesh(new T.LatheGeometry(pts, 64), new T.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0, side: T.DoubleSide }));
    s.add(bowl);
    /* スープ */
    var soup = new T.Mesh(new T.CircleGeometry(2.02, 48), new T.MeshStandardMaterial({ color: 0x6a3510, roughness: 0.15, metalness: 0.1 }));
    soup.rotation.x = -Math.PI / 2; soup.position.y = 0.12;
    s.add(soup);
    var r = rng(9), fat = new T.MeshStandardMaterial({ color: 0xe0a860, roughness: 0.1, transparent: true, opacity: 0.55 });
    for (var i = 0; i < 26; i++) {
      var a = r() * 6.28, u = 1.45 + r() * 0.5;
      var dot = new T.Mesh(new T.CircleGeometry(0.04 + r() * 0.07, 10), fat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(Math.cos(a) * u, 0.125, Math.sin(a) * u);
      s.add(dot);
    }
    /* 極太麺（ふちから見えるぶん） */
    var nm = new T.MeshStandardMaterial({ color: 0xe0b552, roughness: 0.45 });
    for (i = 0; i < 16; i++) {
      a = r() * 6.28;
      var p0 = new T.Vector3(Math.cos(a) * 1.25, 0.05, Math.sin(a) * 1.25);
      var p1 = new T.Vector3(Math.cos(a + 0.3) * 1.75, 0.3 + r() * 0.15, Math.sin(a + 0.3) * 1.75);
      var p2 = new T.Vector3(Math.cos(a + 0.6) * 1.95, 0.05, Math.sin(a + 0.6) * 1.95);
      var tube = new T.Mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(p0, p1, p2), 10, 0.065, 6, false), nm);
      tube.scale.set(1, 1, 1);
      s.add(tube);
    }
    /* チャーシュー（豚）：厚切りを山に立てかける */
    var side = new T.MeshStandardMaterial({ color: 0x6e3518, roughness: 0.6 });
    var face = canvasTex(256, 256, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "#e9aa98"); gr.addColorStop(0.7, "#d58c78"); gr.addColorStop(0.86, "#9a5030"); gr.addColorStop(1, "#5c2a12");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(250,232,210,.85)"; g.lineWidth = 9;
      g.beginPath(); g.arc(w / 2 - 20, h / 2 + 10, 50, 0.4, 3.6); g.stroke();
      g.lineWidth = 5; g.beginPath(); g.arc(w / 2 + 30, h / 2 - 10, 70, 3.8, 5.6); g.stroke();
    });
    var faceM = new T.MeshStandardMaterial({ map: face, roughness: 0.5 });
    [[-1, 0.15], [1, -0.1]].forEach(function (p) {
      var m = new T.Mesh(new T.CylinderGeometry(0.62, 0.62, 0.22, 28), [side, faceM, faceM]);
      m.scale.set(1, 1, 0.8);
      m.rotation.set(Math.PI / 2 - 0.2, 0, p[0] * 0.35);
      m.position.set(p[0] * 1.15, 0.55, 0.85 + p[1]);
      s.add(m);
    });
  };

  /* ============ 空 ============ */
  RamenScene.prototype.makeSky = function () {
    var s = this.scene, r = rng(31);
    var cm = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x8090a0, emissiveIntensity: 0.25 });
    var sg = new T.SphereGeometry(1, 12, 8);
    for (var i = 0; i < 60; i++) {
      var g = new T.Group(), y = CEIL / M + 6 + r() * 150;
      for (var k = 0; k < 5; k++) {
        var b = new T.Mesh(sg, cm);
        b.position.set(k * 0.8 - 1.6, (k % 2) * 0.3, r() * 0.4);
        var sc = 0.6 + r() * 0.6; b.scale.set(sc * 1.2, sc * 0.8, sc);
        g.add(b);
      }
      g.position.set((r() < 0.5 ? -1 : 1) * (2.5 + r() * 6), y, -3 - r() * 6);
      s.add(g);
    }
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
    var t = Math.max(0, (y - CEIL) / 9000), i = Math.min(2, Math.floor(t)), f = Math.min(1, t - i);
    var a = SKY[i], b = SKY[i + 1];
    return new T.Color((a[0] + (b[0] - a[0]) * f) / 255, (a[1] + (b[1] - a[1]) * f) / 255, (a[2] + (b[2] - a[2]) * f) / 255);
  }

  /* ============ トング ============ */
  RamenScene.prototype.makeTongs = function () {
    var g = new T.Group(), m = new T.MeshStandardMaterial({ color: 0xd0d6dc, roughness: 0.3, metalness: 0.35 });
    var arms = [];
    [-1, 1].forEach(function (s) {
      var arm = new T.Group();
      var up = new T.Mesh(new T.BoxGeometry(0.07, 30, 0.12), m);
      up.position.set(0, 15 + 0.5, 0); arm.add(up);
      var low = new T.Mesh(new T.BoxGeometry(0.07, 0.75, 0.16), m);
      low.position.set(0, 0.1, 0); low.rotation.z = s * 0.55; arm.add(low);
      var tip = new T.Mesh(new T.BoxGeometry(0.28, 0.06, 0.2), m);
      tip.position.set(s * 0.25, -0.22, 0); arm.add(tip);
      arm.position.x = s * 0.08;
      arm.userData.s = s;
      g.add(arm); arms.push(arm);
    });
    this.tongs = g; this.arms = arms;
    this.scene.add(g);
  };

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
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
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
      g.position.set(L.x / M, i * LAYER / M, 0);
      s.add(g);
      this.layers.push(g);
    }
    /* カメラ：2Dの見え方（画面の H*0.62 に camY、1m = 100*zoom）に合わせる */
    var tan = Math.tan(this.camera.fov * Math.PI / 360);
    var D = (H / 2) / (tan * st.zoom * M);
    var ty = (st.camY + 0.12 * H / st.zoom) / M;
    this.camera.position.set(0, ty + D * 0.18, D);
    this.camera.lookAt(0, ty, 0);
    this.camera.near = Math.max(0.5, D * 0.2); this.camera.far = D + 1000;
    this.camera.updateProjectionMatrix();
    var halfV = (H / 2) / (st.zoom * M) + 2;
    for (i = 0; i < this.layers.length; i++) {
      var y = i * LAYER / M;
      var vis = y > ty - halfV - 1 && y < ty + halfV + 1;
      this.layers[i].visible = vis;
      var pop = st.layers[i].pop || 0;
      if (vis) this.layers[i].scale.set(1 + pop * 0.06, 1 + pop * 0.25, 1 + pop * 0.06);
    }
    /* 天井の穴 */
    if (!this.holeOn && st.layers.length * LAYER > CEIL - 20) {
      var hi = Math.min(st.layers.length - 1, Math.floor(CEIL / LAYER)), HL = st.layers[hi];
      this.buildCeil([HL.x - HL.w / 2 - 30, HL.x + HL.w / 2 + 30]);
      this.holeOn = true;
      this.lamps.forEach(function (l) { l.visible = Math.abs(l.position.x - HL.x / M) > HL.w / M / 2 + 0.6; });
    }
    /* 空の色 */
    var c = skyColor(ty * M);
    this.renderer.setClearColor(c, 1);
    /* トングと持っている山 */
    var topY = st.layers.length * LAYER;
    var showHand = !st.ending && !st.intro;
    this.tongs.visible = showHand;
    var hx = st.falling ? st.falling.x : st.handX;
    this.tongs.position.set(hx / M, (topY + st.handUp) / M + 0.45, 0.1);
    var open = st.falling ? 0.35 : 0;
    this.arms.forEach(function (a) { a.rotation.z = -a.userData.s * open; });
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
      m.rotation.set(p.r * 0.4, p.r * 0.7, p.r);
    });
    for (var k in this.spills) if (!seen[k]) { drop(this.spills[k]); delete this.spills[k]; }

    this.renderer.render(s, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  };

  global.RamenScene = RamenScene;
})(window);
