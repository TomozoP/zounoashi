/* 牛歩シミュレーターの立体。道・牛・道ばたのもの・壊すもの・破片・星をまとめて持つ。

   ゲーム本体（index.html）は、進みぐあいを sync() に渡して render() を呼ぶだけ。
   絵の合成は本体の2Dキャンバスで行う（空と雲は2D、そのうえにこの絵を重ねる）。
   WebGL が無いところ（テストの偽DOM）では読み込まれないので、本体は
   window.GyuhoScene3D が無くても動くようにしてある。 */
(function (global) {
  "use strict";
  var T;

  /* 世界の単位はゲーム本体と同じ。道の半分の幅が130、牛の背が約115。
     カメラは牛の左後ろの上。道は右奥へ伸びて見える。 */
  var CAM = { x: -232, y: 262, z: 596 };
  var LOOK = { x: 26, y: 76, z: -216 };
  var FOCAL = 900;                       /* 画面の高さに対する画角のもと */
  var BEHIND = 760;                      /* 牛を通りすぎたものを、どこまで残すか */
  var CAMS = [1, 1.09, 1.19, 1.31, 1.52, 1.75];  /* 景色が変わるたび、カメラを引いて広く見せる */

  function Scene3D() {
    T = global.THREE;
    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0, 0);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.dom = this.renderer.domElement;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(60, 1, 8, 7000);
    this.camera.position.set(CAM.x, CAM.y, CAM.z);
    this.camera.lookAt(LOOK.x, LOOK.y, LOOK.z);
    this.fog = new T.Fog(new T.Color("#d5e9f6"), 900, 3000);
    this.scene.fog = this.fog;

    this.hemi = new T.HemisphereLight("#ffffff", "#6d7a5c", 2.1);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight("#fff4df", 1.9);
    this.sun.position.set(-600, 950, 420);
    this.scene.add(this.sun);

    this.geo = {
      ball: new T.SphereGeometry(1, 16, 12),
      box: new T.BoxGeometry(1, 1, 1),
      tube: new T.CylinderGeometry(1, 1, 1, 12),
      cone: new T.ConeGeometry(1, 1, 4),
      peak: new T.ConeGeometry(1, 1, 6),
      puff: new T.SphereGeometry(1, 6, 4),
      ring: new T.RingGeometry(0.86, 1, 36)
    };
    this.bits = [];
    this.bitPool = [];
    this.flying = [];
    this.flyPool = [];
    this.dust = [];
    this.dustPool = [];
    this.dustTimer = 0;
    this.ringLife = [];
    this.build();
    this._v = new T.Vector3();
  }

  function mat(color, opt) {
    var o = { color: color, roughness: (opt && opt.rough) != null ? opt.rough : 0.95 };
    if (opt && opt.transparent) { o.transparent = true; o.opacity = 1; }
    if (opt && opt.flat) return new T.MeshBasicMaterial({ color: color, transparent: !!(opt && opt.transparent) });
    return new T.MeshStandardMaterial(o);
  }

  Scene3D.prototype.mesh = function (geo, material, parent) {
    var m = new T.Mesh(geo, material);
    (parent || this.scene).add(m);
    return m;
  };
  Scene3D.prototype.put = function (m, x, y, z, sx, sy, sz) {
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz === undefined ? sx : sz);
    return m;
  };

  /* ============ 組み立て ============ */
  Scene3D.prototype.build = function () {
    var self = this;

    /* 地面と道。長い板をZ方向に敷いて、模様だけ流す */
    this.groundMat = mat("#7fb04a", { rough: 1 });
    this.ground = this.mesh(new T.PlaneGeometry(14000, 11000), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(0, 0, -3600);

    this.grassTex = stripeTexture();
    this.grassTex.repeat.set(1, 11000 / 140);
    this.grassMat = new T.MeshBasicMaterial({ map: this.grassTex, transparent: true, opacity: 0.2 });
    this.grass = this.mesh(new T.PlaneGeometry(14000, 11000), this.grassMat);
    this.grass.rotation.x = -Math.PI / 2;
    this.grass.position.set(0, 0.4, -3600);

    this.roadMat = mat("#4a4b50", { rough: 1, transparent: true });
    this.road = this.mesh(new T.PlaneGeometry(260, 11000), this.roadMat);
    this.road.rotation.x = -Math.PI / 2;
    this.road.position.set(0, 0.9, -3600);

    this.lineTex = lineTexture(false);
    this.lineTex.repeat.set(1, 11000 / 240);
    this.lineTexCity = lineTexture(true);
    this.lineTexCity.repeat.set(1, 11000 / 240);
    this.lineMat = new T.MeshBasicMaterial({ map: this.lineTex, transparent: true, opacity: 0 });
    this.lines = this.mesh(new T.PlaneGeometry(260, 11000), this.lineMat);
    this.lines.rotation.x = -Math.PI / 2;
    this.lines.position.set(0, 1.4, -3600);

    /* 歩道の敷石と両端の縁石。第2段階だけ表示する。 */
    var pavingCanvas = document.createElement("canvas");
    pavingCanvas.width = 128; pavingCanvas.height = 128;
    var paving = pavingCanvas.getContext("2d");
    paving.fillStyle = "#c5bbaa"; paving.fillRect(0, 0, 128, 128);
    paving.strokeStyle = "#a29787"; paving.lineWidth = 2;
    paving.beginPath();
    paving.moveTo(0, 0); paving.lineTo(128, 0);
    paving.moveTo(0, 64); paving.lineTo(128, 64);
    paving.moveTo(64, 0); paving.lineTo(64, 64);
    paving.moveTo(0, 64); paving.lineTo(0, 128); paving.stroke();
    this.pavingTex = new T.CanvasTexture(pavingCanvas);
    this.pavingTex.colorSpace = T.SRGBColorSpace;
    this.pavingTex.wrapS = this.pavingTex.wrapT = T.RepeatWrapping;
    this.pavingTex.repeat.set(3, 11000 / 110);
    this.pavingMat = new T.MeshStandardMaterial({ map: this.pavingTex, roughness: 1 });
    this.paving = this.mesh(new T.PlaneGeometry(260, 11000), this.pavingMat);
    this.paving.rotation.x = -Math.PI / 2;
    this.paving.position.set(0, 2, -3600);
    this.curbs = new T.Group(); this.scene.add(this.curbs);
    var curbMat = mat("#d8d3c9");
    [-1, 1].forEach(function (side) {
      self.put(self.mesh(self.geo.box, curbMat, self.curbs), side * 170, 4, -3600, 15, 8, 11000);
    });

    /* 牛 */
    this.cow = this.buildCow();
    this.scene.add(this.cow.root);

    this.M = {
      fenceWood: mat("#8f7048"),
      fenceBar:  mat("#a8875c"),
      barnWall:  mat("#b5503f"),
      barnRoof:  mat("#8c3a2d"),
      barnDoor:  mat("#6d5a44"),
      poleWood:  mat("#6b5c4c"),
      railTop:   mat("#c9cdd2", { rough: 0.6 }),
      railLeg:   mat("#9aa0a7", { rough: 0.6 }),
      houseWall: mat("#efe7d8"),
      houseRoof: mat("#c25a4a"),
      houseWin:  mat("#8fb6cf", { rough: 0.4 }),
      towerWall: mat("#454f5f"),
      towerWin:  new T.MeshBasicMaterial({ color: "#f6e9bb" }),
      rock:      mat("#6f6a55"),
      snow:      mat("#eef2f5"),
      sand:      mat("#ddc89b"),
      isle:      mat("#4f8a4a"),
      palm:      mat("#6b5433"),
      jet:       mat("#8d949c", { rough: 0.45 }),
      jetDark:   mat("#5b626b", { rough: 0.45 })
    };
    /* 道ばたのもの */
    this.side = {
      fence: pool(72, function () { return self.makeFence(); }),
      barn:  pool(18, function () { return self.makeBarn(); }),
      pole:  pool(20, function () { return self.makePole(160, self.M.poleWood); }),
      rail:  pool(40, function () { return self.makeRail(); }),
      house: pool(24, function () { return self.makeHouse(); }),
      tower: pool(22, function () { return self.makeTower(); }),
      isle:  pool(12, function () { return self.makeIsland(2.1); })
    };
    /* 壊すもの */
    this.propPool = [
      pool(10, function () { return self.makeStraw(); }),
      pool(10, function () { return self.makePerson(); }),
      pool(10, function () { return self.makeCar(); }),
      pool(8,  function () { return self.makeTruck(); }),
      pool(8,  function () { return self.makeIsland(1); }),
      pool(10, function () { return self.makeStar(); }),
      pool(8,  function () { return self.makeJet(); })
    ];

    /* 吹っ飛ぶ人 */
    for (var f = 0; f < 8; f++) {
      var fp = this.makePerson();
      fp.visible = false;
      this.scene.add(fp);
      this.flyPool.push(fp);
    }

    /* 破片 */
    this.bitMats = ["#e8c25a", "#d9b24a", "#7b6a56", "#e0543c", "#3f7fd6", "#5a6472", "#f6e9bb", "#ffffff", "#f0c9a6", "#4c7fd6", "#4f8a4a", "#ddc89b", "#8d949c", "#ff8a3a"]
      .map(function (c) { return mat(c, { rough: 0.9 }); });
    for (var i = 0; i < 120; i++) {
      var b = this.mesh(this.geo.box, this.bitMats[0]);
      b.visible = false;
      this.bitPool.push(b);
    }

    /* 土ぼこり。ひと粒ずつ濃さを変えるので、材質も粒ごとに持つ */
    for (var d = 0; d < 46; d++) {
      var dm = new T.MeshBasicMaterial({ color: "#c9b48c", transparent: true, opacity: 0.5, depthWrite: false });
      var puff = this.mesh(this.geo.puff, dm);
      puff.visible = false;
      this.dustPool.push(puff);
    }

    /* 音の壁を抜けたときの輪 */
    this.ringMesh = [];
    for (var r = 0; r < 7; r++) {
      var rm = new T.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false });
      var ring = this.mesh(this.geo.ring, rm);
      ring.visible = false;
      this.ringMesh.push(ring);
      this.ringLife.push(0);
    }

    /* 宇宙の星 */
    var pg = new T.BufferGeometry();
    var n = 420, arr = new Float32Array(n * 3);
    this.starN = n;
    for (var s = 0; s < n; s++) {
      arr[s * 3] = (Math.random() - 0.5) * 3600;
      arr[s * 3 + 1] = Math.random() * 1500 + 20;
      arr[s * 3 + 2] = -Math.random() * 4200 + 400;
    }
    pg.setAttribute("position", new T.BufferAttribute(arr, 3));
    this.starMat = new T.PointsMaterial({ color: "#dfeaff", size: 13, sizeAttenuation: true, transparent: true, opacity: 0 });
    this.stars = new T.Points(pg, this.starMat);
    this.scene.add(this.stars);

    function pool(count, make) {
      var a = [];
      for (var i = 0; i < count; i++) {
        var m = make();
        m.visible = false;
        self.scene.add(m);
        a.push(m);
      }
      return a;
    }
  };

  /* 道の模様（横じま）と、白線 */
  function stripeTexture() {
    var c = document.createElement("canvas");
    c.width = 8; c.height = 64;
    var g = c.getContext("2d");
    g.clearRect(0, 0, 8, 64);
    g.fillStyle = "rgba(0,0,0,1)";
    g.fillRect(0, 0, 8, 32);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  function lineTexture(city) {
    var c = document.createElement("canvas");
    c.width = 64; c.height = 128;
    var g = c.getContext("2d");
    g.clearRect(0, 0, 64, 128);
    g.fillStyle = "#f1ead6";
    if (city) {                               /* 都市：車線の多い大通り */
      g.fillRect(30, 0, 2, 128);              /* まん中の二重線 */
      g.fillRect(34, 0, 2, 128);
      g.fillRect(15, 0, 3, 52);               /* 車線の破線 */
      g.fillRect(47, 0, 3, 52);
      g.fillRect(2, 0, 4, 128);               /* 路肩 */
      g.fillRect(58, 0, 4, 128);
    } else {
      g.fillRect(30, 0, 5, 54);               /* まん中の破線 */
      g.fillRect(2, 0, 3, 128);               /* 路肩 */
      g.fillRect(59, 0, 3, 128);
    }
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  /* ============ 牛 ============ 頭が -Z を向いて走る */
  Scene3D.prototype.buildCow = function () {
    var root = new T.Group(), body = new T.Group(), self = this;
    root.add(body);
    var white = mat("#f4f0e5"), black = mat("#272625"), pink = mat("#d99b96");
    var hoof = mat("#45403c"), horn = mat("#ded3b8"), eye = mat("#17191b", { rough: 0.25 });
    /* 胴は横に長く、肩と腰をなだらかにつなぐ。 */
    add(this.geo.ball, white, 0, 76, 6, 43, 37, 66, body);
    add(this.geo.ball, white, 0, 79, -35, 35, 35, 35, body);
    add(this.geo.ball, white, 0, 77, 48, 38, 35, 32, body);
    /* 斑は表面に沿わせて薄く置く。 */
    add(this.geo.ball, black, -37, 83, 12, 7, 23, 27, body).rotation.z = -0.2;
    add(this.geo.ball, black, 37, 74, -8, 6, 20, 25, body);
    add(this.geo.ball, black, -10, 110, 13, 22, 4, 24, body);
    add(this.geo.ball, black, 22, 97, 46, 15, 12, 20, body).rotation.z = -0.5;
    /* 首は前上がりの丸い塊。筒の端が背中から突き出ない形にする。 */
    add(this.geo.ball, white, 0, 94, -52, 26, 34, 27, body).rotation.x = -0.48;
    add(this.geo.ball, white, 0, 78, -54, 22, 25, 22, body);
    var head = new T.Group(); head.position.set(0, 117, -77); body.add(head);
    add(this.geo.ball, white, 0, 0, 0, 22, 23, 24, head);
    add(this.geo.ball, white, 0, -9, -18, 18, 17, 23, head);
    add(this.geo.ball, pink, 0, -16, -35, 19, 12, 13, head);
    add(this.geo.ball, black, -8, -13, -46, 3.4, 2.3, 1.7, head);
    add(this.geo.ball, black, 8, -13, -46, 3.4, 2.3, 1.7, head);
    add(this.geo.ball, hoof, 0, -22, -45, 11, 0.8, 1, head);
    [-1, 1].forEach(function (side) {
      add(self.geo.ball, black, side * 18, 5, -13, 5, 8, 9, head);
      add(self.geo.ball, eye, side * 21, 5, -18, 3, 4, 3, head);
      add(self.geo.ball, white, side * 22, 6, -20, 1, 1.2, 1, head);
      var ear = new T.Group(); ear.position.set(side * 23, 10, 3); ear.rotation.z = side * 0.2; head.add(ear);
      add(self.geo.ball, white, side * 9, 0, 0, 15, 6, 9, ear);
      add(self.geo.ball, pink, side * 10, 1, -5, 10, 3, 3, ear);
      var h = add(self.geo.peak, horn, side * 14, 26, 3, 4.5, 17, 4.5, head);
      h.rotation.z = -side * 0.32;
    });
    /* 腿から細い脚へ。脚全体の振りは従来の歩調に合わせる。 */
    var legs = [];
    [[-26, -34], [26, -34], [-27, 44], [27, 44]].forEach(function (p, i) {
      var leg = new T.Group(); leg.position.set(p[0], 61, p[1]); root.add(leg);
      add(self.geo.ball, white, 0, -10, 0, i < 2 ? 10 : 13, 22, 12, leg);
      add(self.geo.tube, white, 0, -35, 0, 6.5, 35, 6.5, leg);
      add(self.geo.ball, white, 0, -30, 0, 8, 9, 8, leg);
      add(self.geo.ball, hoof, 0, -55, -3, 9, 6, 12, leg);
      add(self.geo.box, black, 0, -56, -13, 1, 5, 2, leg);
      legs.push(leg);
    });
    var tail = new T.Group(); tail.position.set(0, 97, 65); root.add(tail);
    add(this.geo.ball, white, 0, -20, 6, 3.5, 25, 4, tail).rotation.x = -0.22;
    add(this.geo.ball, black, 0, -44, 11, 6, 11, 6, tail);
    return { root: root, body: body, legs: legs, tail: tail };
    function add(geo, material, x, y, z, sx, sy, sz, parent) {
      var m = new T.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
    }
  };

  /* ============ 道ばたのもの ============ */
  Scene3D.prototype.makeFence = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, this.M.fenceWood, g), 0, 27, 0, 9, 54, 9);
    this.put(this.mesh(this.geo.box, this.M.fenceBar, g), 0, 44, 0, 5, 7, 112);
    this.put(this.mesh(this.geo.box, this.M.fenceBar, g), 0, 24, 0, 5, 7, 112);
    this.put(this.mesh(this.geo.peak, this.M.fenceWood, g), 0, 58, 0, 7, 9, 7);
    return g;
  };
  Scene3D.prototype.makeBarn = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, this.M.barnWall, g), 0, 46, 0, 150, 92, 130);
    var roof = this.put(this.mesh(this.geo.cone, this.M.barnRoof, g), 0, 118, 0, 118, 62, 104);
    roof.rotation.y = Math.PI / 4;
    this.put(this.mesh(this.geo.box, this.M.barnDoor, g), 0, 23, -66, 40, 46, 4);
    this.put(this.mesh(this.geo.box, this.M.houseWall, g), 0, 24, -69, 3, 48, 2);
    this.put(this.mesh(this.geo.box, this.M.houseWall, g), 0, 48, -69, 45, 4, 2);
    return g;
  };
  Scene3D.prototype.makePole = function (h, m) {
    var g = new T.Group();
    this.put(this.mesh(this.geo.tube, m, g), 0, h / 2, 0, 7, h, 7);
    this.put(this.mesh(this.geo.box, m, g), 0, h - 14, 0, 62, 8, 8);
    this.put(this.mesh(this.geo.box, m, g), 0, h - 40, 0, 48, 7, 7);
    [-22, 22].forEach(function (x) {
      this.put(this.mesh(this.geo.tube, this.M.houseWall, g), x, h - 6, 0, 5, 12, 5);
    }, this);
    return g;
  };
  Scene3D.prototype.makeRail = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, this.M.railTop, g), 0, 30, 0, 5, 10, 104);
    this.put(this.mesh(this.geo.box, this.M.railLeg, g), 0, 15, 0, 7, 30, 7);
    return g;
  };
  Scene3D.prototype.makeHouse = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, this.M.houseWall, g), 0, 48, 0, 116, 96, 104);
    var roof = this.put(this.mesh(this.geo.cone, this.M.houseRoof, g), 0, 118, 0, 96, 52, 88);
    roof.rotation.y = Math.PI / 4;
    this.put(this.mesh(this.geo.box, this.M.houseWin, g), -26, 62, -53, 30, 26, 4);
    this.put(this.mesh(this.geo.box, this.M.houseWin, g), 26, 62, -53, 30, 26, 4);
    this.put(this.mesh(this.geo.box, this.M.barnDoor, g), 0, 22, -54, 22, 44, 4);
    this.put(this.mesh(this.geo.box, this.M.houseWall, g), 0, 48, -57, 106, 3, 3);
    this.put(this.mesh(this.geo.box, this.M.rock, g), 30, 133, 15, 15, 45, 17);
    return g;
  };
  Scene3D.prototype.makeTower = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, this.M.towerWall, g), 0, 200, 0, 130, 400, 120);
    this.put(this.mesh(this.geo.box, this.M.towerWin, g), 0, 200, -61, 96, 330, 3);
    for (var floor = 48; floor < 370; floor += 40) {
      this.put(this.mesh(this.geo.box, this.M.towerWall, g), 0, floor, -64, 103, 7, 4);
    }
    this.put(this.mesh(this.geo.box, this.M.towerWall, g), 0, 200, -65, 7, 335, 3);
    this.put(this.mesh(this.geo.box, this.M.railLeg, g), 22, 411, 12, 34, 22, 30);
    return g;
  };

  /* ============ 壊すもの ============ */
  Scene3D.prototype.makeStraw = function () {
    var g = new T.Group();
    var roll = this.put(this.mesh(this.geo.tube, mat("#d9b24a"), g), 0, 27, 0, 27, 44, 27);
    roll.rotation.z = Math.PI / 2;
    var face = this.put(this.mesh(this.geo.tube, mat("#c2913a"), g), 23, 27, 0, 22, 4, 22);
    face.rotation.z = Math.PI / 2;
    return g;
  };
  /* 人。牛とおなじ向きで道に立っている */
  Scene3D.prototype.makePerson = function () {
    var g = new T.Group();
    var skin = mat("#f0c9a6"), shirt = mat("#4c7fd6"), pants = mat("#3b4a6b"), hair = mat("#3a2e26");
    g.userData.shirt = shirt;
    this.put(this.mesh(this.geo.tube, pants, g), -13, 38, 0, 11, 76, 11);   /* 脚 */
    this.put(this.mesh(this.geo.tube, pants, g), 13, 38, 0, 11, 76, 11);
    this.put(this.mesh(this.geo.box, shirt, g), 0, 108, 0, 46, 66, 26);     /* 胴 */
    this.put(this.mesh(this.geo.tube, shirt, g), -30, 106, 0, 10, 62, 10);  /* 腕 */
    this.put(this.mesh(this.geo.tube, shirt, g), 30, 106, 0, 10, 62, 10);
    this.put(this.mesh(this.geo.ball, skin, g), 0, 156, 0, 19, 21, 19);     /* 頭 */
    this.put(this.mesh(this.geo.ball, hair, g), 0, 163, 3, 20, 15, 20);     /* 髪 */
    return g;
  };

  Scene3D.prototype.makeCar = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, mat("#e0543c", { rough: 0.5 }), g), 0, 26, 0, 92, 40, 160);
    this.put(this.mesh(this.geo.box, mat("#cfe0ea", { rough: 0.3 }), g), 0, 54, 6, 72, 30, 86);
    g.userData.body = g.children[0];
    var trim = mat("#444b51"), light = mat("#fff0c4", { flat: true }), red = mat("#b82e28", { flat: true });
    this.put(this.mesh(this.geo.box, trim, g), 0, 69, 6, 76, 5, 90);
    this.put(this.mesh(this.geo.box, trim, g), 0, 54, 6, 76, 30, 5);
    [-1, 1].forEach(function (side) {
      this.put(this.mesh(this.geo.box, light, g), side * 30, 32, -81, 18, 10, 3);
      this.put(this.mesh(this.geo.box, red, g), side * 32, 32, 81, 15, 9, 3);
      this.put(this.mesh(this.geo.box, trim, g), side * 46, 42, 12, 3, 4, 13);
      this.put(this.mesh(this.geo.box, trim, g), side * 44, 53, -25, 13, 7, 9);
    }, this);
    this.put(this.mesh(this.geo.box, trim, g), 0, 16, 82, 84, 7, 5);
    this.put(this.mesh(this.geo.box, trim, g), 0, 22, -82, 52, 9, 4);
    var wheel = mat("#23242a");
    [[-44, -52], [44, -52], [-44, 52], [44, 52]].forEach(function (p) {
      var w = new T.Mesh(this.geo.tube, wheel);
      w.position.set(p[0], 14, p[1]);
      w.scale.set(14, 10, 14);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }, this);
    return g;
  };
  Scene3D.prototype.makeTruck = function () {
    var g = new T.Group();
    var metal = mat("#d7d9d5"), dark = mat("#343a40"), glass = mat("#94bacb", { rough: 0.3 });
    this.put(this.mesh(this.geo.box, mat("#4273a4"), g), 0, 65, -104, 125, 94, 80);
    g.userData.body = g.children[0];
    this.put(this.mesh(this.geo.box, metal, g), 0, 92, 30, 136, 136, 218);
    this.put(this.mesh(this.geo.box, dark, g), 0, 24, 0, 112, 18, 290);
    this.put(this.mesh(this.geo.box, glass, g), 0, 91, -145, 103, 32, 3);
    [-1, 1].forEach(function (side) {
      this.put(this.mesh(this.geo.box, glass, g), side * 63, 91, -105, 3, 30, 47);
      this.put(this.mesh(this.geo.box, dark, g), side * 77, 86, -127, 12, 20, 9);
      this.put(this.mesh(this.geo.box, mat("#fff1c0", { flat: true }), g), side * 44, 43, -146, 22, 12, 3);
      this.put(this.mesh(this.geo.box, mat("#bc302c", { flat: true }), g), side * 48, 38, 141, 18, 10, 3);
      [-104, 62, 111].forEach(function (z) {
        this.put(this.mesh(this.geo.tube, dark, g), side * 64, 21, z, 21, 14, 21).rotation.z = Math.PI / 2;
        this.put(this.mesh(this.geo.tube, metal, g), side * 72, 21, z, 10, 2, 10).rotation.z = Math.PI / 2;
      }, this);
    }, this);
    this.put(this.mesh(this.geo.box, dark, g), 0, 29, -148, 127, 10, 6);
    this.put(this.mesh(this.geo.box, dark, g), 0, 54, -146, 54, 20, 3);
    this.put(this.mesh(this.geo.box, dark, g), 0, 96, 140, 3, 121, 3);
    this.put(this.mesh(this.geo.box, dark, g), 0, 32, 142, 131, 5, 5);
    return g;
  };

  /* 車は車体を保ったまま跳ね飛ぶ。通り過ぎた車体を繰り返し使う。 */
  Scene3D.prototype.launchVehicle = function (x, r, z, dist, type) {
    if (!this.vehiclePool) this.vehiclePool = { 2: [], 3: [] };
    var m = this.vehiclePool[type].pop();
    if (!m) { m = type === 3 ? this.makeTruck() : this.makeCar(); this.scene.add(m); }
    m.visible = true;
    m.position.set(x, 0, -z); m.rotation.set(0, (r - 0.5) * 0.16, 0);
    m.userData.body.material = this.carMat(r);
    this.flying.push({ m: m, life: 0, dist: dist, vehicle: type,
      vx: (x < 0 ? -1 : 1) * (150 + r * 140), vy: type === 3 ? 420 : 560,
      vz: -180, rx: -1.5 - r, ry: (r - 0.5) * 2, rz: (x < 0 ? -1 : 1) * 2 });
  };
  /* 島。洋上で道の先に浮かび、まわりにはもっと大きいものを並べる */
  Scene3D.prototype.makeIsland = function (k) {
    var g = new T.Group();
    this.put(this.mesh(this.geo.tube, this.M.sand, g), 0, 5 * k, 0, 200 * k, 14 * k, 200 * k);
    var hill = this.put(this.mesh(this.geo.peak, this.M.isle, g), 0, 62 * k, 0, 140 * k, 124 * k, 140 * k);
    hill.rotation.y = 0.4;
    this.put(this.mesh(this.geo.tube, this.M.palm, g), 74 * k, 46 * k, 40 * k, 6 * k, 92 * k, 6 * k).rotation.z = 0.2;
    this.put(this.mesh(this.geo.ball, this.M.isle, g), 80 * k, 96 * k, 40 * k, 34 * k, 12 * k, 34 * k);
    for (var leaf = 0; leaf < 5; leaf++) {
      var angle = leaf * Math.PI * 2 / 5;
      var frond = this.put(this.mesh(this.geo.ball, this.M.isle, g),
        (80 + Math.cos(angle) * 24) * k, 100 * k, (40 + Math.sin(angle) * 24) * k, 38 * k, 4 * k, 10 * k);
      frond.rotation.y = -angle;
    }
    this.put(this.mesh(this.geo.puff, this.M.rock, g), -100 * k, 15 * k, 50 * k, 25 * k, 24 * k, 32 * k);
    return g;
  };

  /* 戦闘機。機首をこちらへ向けて飛んでくる */
  Scene3D.prototype.makeJet = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.tube, this.M.jet, g), 0, 0, 0, 15, 160, 15).rotation.x = Math.PI / 2;
    this.put(this.mesh(this.geo.cone, this.M.jet, g), 0, 0, -92, 15, 44, 15).rotation.x = -Math.PI / 2;
    this.put(this.mesh(this.geo.box, this.M.jet, g), 0, -2, 16, 190, 7, 44);       /* 主翼 */
    this.put(this.mesh(this.geo.box, this.M.jetDark, g), 0, 22, 62, 7, 42, 30);    /* 尾翼 */
    this.put(this.mesh(this.geo.box, this.M.jet, g), 0, 0, 66, 76, 6, 24);
    this.put(this.mesh(this.geo.ball, this.M.jetDark, g), 0, 11, -44, 13, 10, 28); /* 風防 */
    return g;
  };

  Scene3D.prototype.makeStar = function () {
    var g = new T.Group();
    if (!this.planetMats) {
      /* 地球・火星・木星・土星・海王星。表面の模様は球に巻き付ける。 */
      this.planetColors = ["#398aca", "#cb6544", "#d6ae80", "#ddc795", "#3876da"];
      this.planetMats = this.planetColors.map(function (color, kind) {
        var c = document.createElement("canvas"); c.width = 512; c.height = 256;
        var p = c.getContext("2d"); p.fillStyle = color; p.fillRect(0, 0, 512, 256);
        for (var i = 0; i < 90; i++) {
          var x = Math.random() * 512, y = Math.random() * 256;
          p.fillStyle = kind === 0 ? (i % 3 ? "#579654" : "#c6e3d9")
            : kind === 1 ? (i % 2 ? "#97412f" : "#e69a6b")
            : (i % 2 ? "rgba(255,245,215,.24)" : "rgba(65,40,45,.2)");
          p.beginPath();
          p.ellipse(x, y, kind < 2 ? 8 + Math.random() * 30 : 290,
            kind < 2 ? 5 + Math.random() * 16 : 2 + Math.random() * 7, 0, 0, Math.PI * 2);
          p.fill();
        }
        if (kind === 2) {
          p.fillStyle = "#ad634b"; p.beginPath(); p.ellipse(330, 165, 40, 15, 0, 0, Math.PI * 2); p.fill();
        }
        var tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
        return new T.MeshStandardMaterial({ map: tex, roughness: 1, emissive: color, emissiveIntensity: 0.12 });
      });
      this.planetGeo = new T.SphereGeometry(1, 40, 28);
      this.planetRingGeo = new T.RingGeometry(1.35, 2.05, 64);
      this.planetRingMat = new T.MeshStandardMaterial({ color: "#cbb68c", side: T.DoubleSide, transparent: true, opacity: 0.8 });
    }
    g.userData.body = this.mesh(this.planetGeo, this.planetMats[0], g);
    var ring = this.mesh(this.planetRingGeo, this.planetRingMat, g);
    ring.rotation.x = -1.1; ring.rotation.y = 0.25;
    g.userData.ring = ring;
    return g;
  };

  /* ============ 破片 ============ */
  Scene3D.prototype.burst = function (x, baseY, type, variant, z) {
    if (type === 5) {
      var radius = 240 + (variant || 0) * 160;
      var material = this.planetMats[Math.min(4, Math.floor((variant || 0) * 5))];
      for (var j = 0; j < 32; j++) {
        var shard = this.bitPool.pop(); if (!shard) break;
        var az = Math.random() * Math.PI * 2, up = Math.random() * 2 - 1;
        var side = Math.sqrt(1 - up * up), dx = Math.cos(az) * side, dz = Math.sin(az) * side;
        shard.geometry = this.geo.puff; shard.material = material; shard.visible = true;
        var size = radius * (0.07 + Math.random() * 0.10);
        shard.scale.set(size, size * 0.7, size * 0.85);
        shard.position.set(x + dx * radius * 0.7, 110 + up * radius * 0.7, -z + dz * radius * 0.7);
        this.bits.push({ m: shard, life: 0, space: true,
          vx: dx * 650, vy: up * 650, vz: dz * 650 + 280,
          rx: Math.random() * 7, ry: Math.random() * 7 });
      }
      return;
    }
    var cols = [[0, 1], [8, 9], [3, 4], [5, 6], [10, 11], [6, 7], [12, 13]][type] || [0, 1];
    var high = [40, 160, 46, 260, 150, 120, 60][type] || 40;
    for (var i = 0; i < 9; i++) {
      var m = this.bitPool.pop();
      if (!m) break;
      m.material = this.bitMats[cols[i % cols.length]];
      m.geometry = this.geo.box;
      m.visible = true;
      var sx = 8 + Math.random() * 22;
      m.scale.set(sx, sx * (0.4 + Math.random() * 0.5), 6 + Math.random() * 14);
      m.position.set(x + (Math.random() - 0.5) * 70, (baseY || 0) + 20 + Math.random() * high, (Math.random() - 0.5) * 60);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      var pw = Math.min(2.4, 0.85 + (this._wsp || 100) / 850);   /* 速いほど豪快に飛ぶ */
      this.bits.push({
        m: m, life: 0,
        vx: (Math.random() - 0.5) * 460 * pw,
        vy: (180 + Math.random() * 480) * pw,
        vz: (220 + Math.random() * 420) * pw,
        rx: (Math.random() - 0.5) * 12, ry: (Math.random() - 0.5) * 12
      });
    }
  };
  /* 土ぼこりをひと粒あげる */
  Scene3D.prototype.puffUp = function (col) {
    var m = this.dustPool.pop();
    if (!m) return;
    m.visible = true;
    m.material.color.setRGB(srgb(col[0] * 0.55 + 140), srgb(col[1] * 0.55 + 132), srgb(col[2] * 0.55 + 112));
    m.material.opacity = 0.5;
    var sz = 13 + Math.random() * 15;
    m.scale.set(sz, sz, sz);
    m.position.set((Math.random() - 0.5) * 54, 6 + Math.random() * 12,
      this.cow.root.position.z + 38 + Math.random() * 20);
    this.dust.push({ m: m, life: 0, vx: (Math.random() - 0.5) * 95, vy: 34 + Math.random() * 72, gr: 1 + Math.random() * 1.6 });
  };
  Scene3D.prototype.stepDust = function (dt, travel) {
    for (var i = this.dust.length - 1; i >= 0; i--) {
      var d = this.dust[i];
      d.life += dt;
      d.m.position.x += d.vx * dt;
      d.m.position.y += d.vy * dt;
      d.m.position.z += travel;
      var gs = 1 + d.gr * dt;
      d.m.scale.multiplyScalar(gs);
      d.m.material.opacity = Math.max(0, 0.5 * (1 - d.life / 0.85));
      if (d.life > 0.85 || d.m.position.z > 820) {
        d.m.visible = false;
        this.dustPool.push(d.m);
        this.dust.splice(i, 1);
      }
    }
  };

  /* 音の壁を抜けた。輪を3枚、すこしずらして広げる */
  Scene3D.prototype.sonicBoom = function (count) {
    var want = count || 3, got = 0;
    for (var i = 0; i < this.ringMesh.length && got < want; i++) {
      if (this.ringMesh[i].visible) continue;   /* 空いている輪から使う */
      this.ringMesh[i].visible = true;
      this.ringLife[i] = -got * 0.13;
      got++;
    }
  };
  Scene3D.prototype.stepRings = function (dt) {
    for (var i = 0; i < this.ringMesh.length; i++) {
      var m = this.ringMesh[i];
      if (!m.visible) continue;
      this.ringLife[i] += dt;
      var k = this.ringLife[i] / 0.72;
      if (k < 0) { m.material.opacity = 0; continue; }
      if (k >= 1) { m.visible = false; continue; }
      var sc = 26 + k * 520;
      m.scale.set(sc, sc, sc);
      m.position.set(0, 74, -40 + k * 150);
      m.material.opacity = 0.7 * (1 - k) * (1 - k);
    }
  };

  /* 人をひとり、宙へ跳ね上げる（こわさない） */
  Scene3D.prototype.launchPerson = function (x, r, z, dist) {
    var m = this.flyPool.pop();
    if (!m) {
      var personIndex = this.flying.findIndex(function (f) { return !f.vehicle; });
      if (personIndex < 0) return;
      var old = this.flying.splice(personIndex, 1)[0];
      m = old.m;
    }
    m.visible = true;
    m.position.set(x, 8, -z);
    m.rotation.set(0, r * 3.14, 0);
    if (m.userData.shirt) m.userData.shirt.color.copy(this.shirtColor(r));
    this.flying.push({
      m: m, life: 0, dist: dist,
      vx: (x < 0 ? -1 : 1) * (100 + Math.random() * 160),
      vy: 470 + Math.random() * 260,
      vz: -(120 + Math.random() * 100),  /* 前へ跳ね、牛が進むと後方へ流れる */
      rx: (Math.random() - 0.5) * 10, ry: (Math.random() - 0.5) * 7, rz: (Math.random() - 0.5) * 10
    });
  };
  Scene3D.prototype.stepFlying = function (dt, dist) {
    for (var i = this.flying.length - 1; i >= 0; i--) {
      var f = this.flying[i];
      f.life += dt;
      f.vy -= 1250 * dt;
      f.m.position.x += f.vx * dt;
      f.m.position.y += f.vy * dt;
      f.m.position.z += f.vz * dt + Math.max(0, dist - f.dist);
      f.dist = dist;
      f.m.rotation.x += f.rx * dt;
      f.m.rotation.y += f.ry * dt;
      f.m.rotation.z += f.rz * dt;
      if (f.m.position.z > 900 || f.m.position.y < -240 || f.life > 3) {
        f.m.visible = false;
        if (f.vehicle) this.vehiclePool[f.vehicle].push(f.m);
        else this.flyPool.push(f.m);
        this.flying.splice(i, 1);
      }
    }
  };

  Scene3D.prototype.stepBits = function (dt) {
    for (var i = this.bits.length - 1; i >= 0; i--) {
      var b = this.bits[i];
      b.life += dt;
      if (!b.space) b.vy -= 1500 * dt;
      b.m.position.x += b.vx * dt;
      b.m.position.y += b.vy * dt;
      b.m.position.z += b.vz * dt;
      b.m.rotation.x += b.rx * dt;
      b.m.rotation.y += b.ry * dt;
      if (b.life > (b.space ? 1.7 : 1.1) || (!b.space && b.m.position.y < -60) || b.m.position.z > 700) {
        b.m.visible = false;
        this.bitPool.push(b.m);
        this.bits.splice(i, 1);
      }
    }
  };
  Scene3D.prototype.clearBits = function () {
    for (var i = 0; i < this.bits.length; i++) {
      this.bits[i].m.visible = false;
      this.bitPool.push(this.bits[i].m);
    }
    this.bits.length = 0;
    for (var d2 = 0; d2 < this.dust.length; d2++) {
      this.dust[d2].m.visible = false;
      this.dustPool.push(this.dust[d2].m);
    }
    this.dust.length = 0;
    for (var r2 = 0; r2 < this.ringMesh.length; r2++) this.ringMesh[r2].visible = false;
    for (var j = 0; j < this.flying.length; j++) {
      this.flying[j].m.visible = false;
      if (this.flying[j].vehicle) this.vehiclePool[this.flying[j].vehicle].push(this.flying[j].m);
      else this.flyPool.push(this.flying[j].m);
    }
    this.flying.length = 0;
  };

  /* ============ 毎コマの更新 ============
     s: { dist, w, gear, legPhase, wsp, beta, props, dt, sky } */
  Scene3D.prototype.sync = function (s) {
    var travel = this._lastDist == null ? 0 : Math.max(0, s.dist - this._lastDist);
    this._lastDist = s.dist;
    var w = s.w;
    if (s.quietSpace && !this._quietSpace) this.clearBits();
    this._quietSpace = !!s.quietSpace;
    this.scene.fog = w[5] ? null : this.fog;
    var ws = s.world || 1, cs = CAMS[s.gear] || 1;
    if (this._ws !== ws) {
      this.road.scale.x = ws;
      this.lines.scale.x = ws;
      this._ws = ws;
    }
    if (this._cs !== cs) {
      this.camera.position.set(CAM.x * cs, CAM.y * cs, CAM.z * cs);
      this.camera.lookAt(LOOK.x * cs, LOOK.y * cs, LOOK.z * cs);
      this._cs = cs;
    }
    var lit = s.light == null ? 1 : s.light;    /* 日が落ちると、あかりも落とす */
    if (this._lit !== lit) {
      this.sun.intensity = 1.9 * lit;
      this.hemi.intensity = 2.1 * (0.3 + 0.7 * lit);
      this._lit = lit;
    }
    var thrust = Math.min(1, (s.lead || 0) / 260);
    var fov = this._baseFov * (1 + 0.1 * (s.t || 0) + thrust * 0.055);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    /* 地面と道の色 */
    setColor(this.groundMat.color, s.groundColor);
    setColor(this.roadMat.color, s.roadColor);
    this.roadMat.opacity = 1 - w[5] - w[4];   /* 洋上に道は無い */
    this.road.visible = this.roadMat.opacity > 0.02;
    this.grassMat.opacity = (w[4] ? 0.17 : 0.2) * (1 - w[5]);  /* 洋上では波として使う */
    this.ground.visible = !w[5];                /* 宇宙に地面は無い（空とのつなぎ目も消える） */
    this.grass.visible = this.grassMat.opacity > 0.01;
    this.grassTex.offset.y = s.dist / 140;
    var wantTex = w[3] ? this.lineTexCity : this.lineTex;
    if (this.lineMat.map !== wantTex) { this.lineMat.map = wantTex; this.lineMat.needsUpdate = true; }
    wantTex.offset.y = s.dist / 240;
    this.lineMat.opacity = Math.min(1, w[2] + w[3]) * (1 - w[5]);   /* 歩道には白線を引かない */
    this.paving.visible = this.curbs.visible = !!w[1];
    this.paving.scale.x = ws;
    this.pavingTex.offset.y = s.dist / 110;
    this.lines.visible = this.lineMat.opacity > 0.02;
    setColor(this.fog.color, s.fogColor);
    this.fog.near = (800 + 1200 * w[5]) * ws;    /* 世界が広くなったぶん、霞む距離ものばす */
    this.fog.far = (2800 + 2600 * w[5]) * ws;

    /* 牛 */
    var cow = this.cow;
    var bob = Math.abs(Math.sin(s.legPhase * Math.PI * 2)) * 5;
    cow.root.position.set(0, bob, -(s.lead || 0));       /* はらうと前へ出る */
    cow.root.rotation.x = -0.06 * Math.min(1, s.wsp / 2400) - thrust * 0.21;
    cow.body.scale.set(1 - thrust * 0.035, 1 - thrust * 0.07, 1 + thrust * 0.09);
    for (var i = 0; i < cow.legs.length; i++) {
      var off = (i === 0 || i === 3) ? 0 : 0.5;
      cow.legs[i].rotation.x = Math.sin((s.legPhase + off) * Math.PI * 2) * 0.62;
    }
    cow.tail.rotation.x = Math.sin(s.legPhase * Math.PI) * 0.26 - 0.1;

    /* 道ばたのもの */
    this.row("fence", w[0], 112 * ws, 176 * ws, s.dist);
    this.row("barn", w[0], 520 * ws, 430 * ws, s.dist);
    this.row("pole", w[1] + w[2], 440 * ws, 300 * ws, s.dist);
    this.row("rail", w[2] + w[3], 210 * ws, 156 * ws, s.dist);
    this.row("house", w[2], 340 * ws, 380 * ws, s.dist);
    this.row("tower", w[3], 420 * ws, 450 * ws, s.dist);
    this.row("isle", w[4], 880 * ws, 430 * ws, s.dist);

    /* 壊すもの */
    var used = [0, 0, 0, 0, 0, 0, 0];
    for (var p = 0; p < s.props.length; p++) {
      var o = s.props[p];
      if (o.z == null || o.z < -60 || o.z > (o.t === 5 ? 6500 : 2600)) continue;
      var lane = this.propPool[o.t];
      if (used[o.t] >= lane.length) continue;
      var m = lane[used[o.t]++];
      m.visible = true;
      m.position.set(o.x, o.y || 0, -o.z);
      if (o.t === 5) {
        var kind = Math.min(4, Math.floor(o.r * 5)), radius = 240 + o.r * 160;
        m.position.y = 110;
        m.scale.setScalar(radius);
        m.userData.body.material = this.planetMats[kind];
        m.userData.ring.visible = kind === 3;
      }
      m.rotation.y = o.t === 2 || o.t === 3 ? (o.r - 0.5) * 0.16 : (o.t === 6 ? Math.PI : o.r * 3.14);
      if (o.t === 6) m.rotation.z = (o.r - 0.5) * 0.5;
      if (o.t === 1 && m.userData.shirt) m.userData.shirt.color.copy(this.shirtColor(o.r));
      if (o.t === 2 && m.userData.body) m.userData.body.material = this.carMat(o.r);
      if (o.t === 3 && m.userData.body) m.userData.body.material = this.carMat(o.r);
    }
    for (var t = 0; t < 7; t++) {
      for (var k = used[t]; k < this.propPool[t].length; k++) this.propPool[t][k].visible = false;
    }

    /* 星 */
    this.starMat.opacity = w[5];
    this.stars.visible = w[5] > 0.02;
    if (this.stars.visible) {
      var pos = this.stars.geometry.attributes.position, a = pos.array;
      var move = s.wsp * s.dt * 1.8;
      for (var q = 0; q < this.starN; q++) {
        a[q * 3 + 2] += move;
        if (a[q * 3 + 2] > 500) {
          a[q * 3 + 2] -= 4700;
          a[q * 3] = (Math.random() - 0.5) * 3600;
          a[q * 3 + 1] = Math.random() * 1500 + 20;
        }
      }
      pos.needsUpdate = true;
    }

    this._wsp = s.wsp;
    /* 出た煙は地面と同じ距離だけ流し、新しい煙は踏み込んだ足元に出す。 */
    this.stepDust(s.dt, travel);
    var dusty = clamp01(((s.kmh || 0) - 1.2) / 6);   /* 歩きだしてから立ちはじめる */
    if (s.running && w[5] < 0.5 && dusty > 0.02) {
      var rate = Math.min(48, 3 + Math.max(s.wsp, travel / Math.max(s.dt, 1 / 120)) / 24) * dusty;
      this.dustTimer -= s.dt;
      var guard = 0;
      while (this.dustTimer <= 0 && guard++ < 8) {
        this.puffUp(w[4] ? [236, 244, 248] : s.roadColor);
        this.dustTimer += 1 / rate;
      }
    }
    this.stepRings(s.dt);
    this.stepBits(s.dt);
    this.stepFlying(s.dt, s.dist);

    function setColor(c, arr) { c.setRGB(srgb(arr[0]), srgb(arr[1]), srgb(arr[2])); }
  };
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function srgb(v) {
    v = Math.min(255, v) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  Scene3D.prototype.shirtColor = function (r) {
    if (!this._shirts) {
      this._shirts = ["#4c7fd6", "#d95f4c", "#4aa86b", "#e8b63a", "#8a5ad0", "#e9e4da"]
        .map(function (c) { return new T.Color(c); });
    }
    return this._shirts[Math.floor(r * this._shirts.length) % this._shirts.length];
  };

  Scene3D.prototype.carMat = function (r) {
    if (!this._carMats) {
      this._carMats = ["#e0543c", "#3f7fd6", "#e8b63a", "#4aa86b", "#e9e4da", "#8a5ad0"]
        .map(function (c) { return mat(c, { rough: 0.5 }); });
    }
    return this._carMats[Math.floor(r * this._carMats.length) % this._carMats.length];
  };

  /* 道の両わきに、等間隔でならべる */
  Scene3D.prototype.row = function (kind, alpha, gap, x, dist) {
    var list = this.side[kind];
    if (alpha < 0.5) {
      for (var i = 0; i < list.length; i++) list[i].visible = false;
      return;
    }
    var half = Math.floor(list.length / 2);
    /* カメラと物の奥行きより後ろへ抜けてから、遠方へ戻す。 */
    var behind = Math.max(BEHIND, this.camera.position.z + (kind === "isle" ? 1100 : 300));
    var start = Math.ceil((dist - behind) / gap) * gap;
    for (var k = 0; k < half; k++) {
      var z = start + k * gap - dist;
      var left = list[k * 2], right = list[k * 2 + 1];
      if (z > 2600) { left.visible = right.visible = false; continue; }
      var id = Math.round((start + k * gap) / gap);
      place(left, -x, z, id);
      place(right, x, z, id + 911);
    }
    function place(g, px, z, id) {
      g.visible = true;
      g.position.set(px, 0, -z);
      var r = fract(Math.sin(id * 12.9898) * 43758.5453);
      g.rotation.y = (kind === "house" || kind === "barn" || kind === "tower")
                     ? (px < 0 ? -Math.PI / 2 : Math.PI / 2) : 0;
      var sc = 0.8 + r * 0.5;
      if (kind === "house" || kind === "tower" || kind === "barn") g.scale.set(1, sc, 1);
    }
    function fract(v) { return v - Math.floor(v); }
  };

  /* ============ 画面まわり ============ */
  Scene3D.prototype.resize = function (pxW, pxH, gameH) {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(pxW, pxH, false);
    this.camera.aspect = pxW / pxH;
    this._baseFov = 2 * Math.atan((gameH / 2) / FOCAL) * 180 / Math.PI;
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
  };
  /* 地平線が画面のどこに来るか（ゲーム座標の y） */
  Scene3D.prototype.horizonY = function (gameH) {
    var c = this.camera.position;
    var d = this._v.set(LOOK.x - CAM.x, 0, LOOK.z - CAM.z).normalize();
    var far = this._v.set(c.x + d.x * 60000, c.y, c.z + d.z * 60000);
    far.project(this.camera);
    return (1 - far.y) / 2 * gameH;
  };
  /* 道がすいこまれていく先（画面のどこか） */
  Scene3D.prototype.vanish = function (gameW, gameH) {
    var p = this._v.set(0, 0, -80000).project(this.camera);
    return { x: (p.x + 1) / 2 * gameW, y: (1 - p.y) / 2 * gameH };
  };
  /* 牛が画面のどこに、どれくらいの大きさで見えるか */
  Scene3D.prototype.cowScreen = function (gameW, gameH) {
    var cowPos = this.cow.root.position;
    var p = this._v.set(0, cowPos.y + 40, cowPos.z).project(this.camera);
    var x = (p.x + 1) / 2 * gameW, y = (1 - p.y) / 2 * gameH;
    var q = this._v.set(0, cowPos.y + 140, cowPos.z).project(this.camera);
    var top = (1 - q.y) / 2 * gameH;
    return { x: x, y: y, s: Math.max(0.2, (y - top) / 100) };
  };
  Scene3D.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };
  Scene3D.prototype.reset = function () {
    this.clearBits();
    this._lastDist = null;
    this.dustTimer = 0;
  };

  global.GyuhoScene3D = Scene3D;
})(window);
