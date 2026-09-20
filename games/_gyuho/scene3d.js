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
  var CAMS = [1, 1.09, 1.19, 1.31, 1.46];  /* 景色が変わるたび、カメラを引いて広く見せる */

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

    this.scene.add(new T.HemisphereLight("#ffffff", "#6d7a5c", 2.1));
    this.sun = new T.DirectionalLight("#fff4df", 1.9);
    this.sun.position.set(-600, 950, 420);
    this.scene.add(this.sun);

    this.geo = {
      ball: new T.SphereGeometry(1, 16, 12),
      box: new T.BoxGeometry(1, 1, 1),
      tube: new T.CylinderGeometry(1, 1, 1, 12),
      cone: new T.ConeGeometry(1, 1, 4)
    };
    this.bits = [];
    this.bitPool = [];
    this.flying = [];
    this.flyPool = [];
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

    this.lineTex = lineTexture();
    this.lineTex.repeat.set(1, 11000 / 240);
    this.lineMat = new T.MeshBasicMaterial({ map: this.lineTex, transparent: true, opacity: 0 });
    this.lines = this.mesh(new T.PlaneGeometry(260, 11000), this.lineMat);
    this.lines.rotation.x = -Math.PI / 2;
    this.lines.position.set(0, 1.4, -3600);

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
      towerWin:  new T.MeshBasicMaterial({ color: "#f6e9bb" })
    };
    /* 道ばたのもの */
    this.side = {
      fence: pool(40, function () { return self.makeFence(); }),
      barn:  pool(10, function () { return self.makeBarn(); }),
      pole:  pool(16, function () { return self.makePole(160, self.M.poleWood); }),
      rail:  pool(34, function () { return self.makeRail(); }),
      house: pool(18, function () { return self.makeHouse(); }),
      tower: pool(20, function () { return self.makeTower(); })
    };
    /* 壊すもの */
    this.propPool = [
      pool(10, function () { return self.makeStraw(); }),
      pool(10, function () { return self.makePerson(); }),
      pool(10, function () { return self.makeCar(); }),
      pool(8,  function () { return self.makeBuilding(); }),
      pool(10, function () { return self.makeStar(); })
    ];

    /* 吹っ飛ぶ人 */
    for (var f = 0; f < 8; f++) {
      var fp = this.makePerson();
      fp.visible = false;
      this.scene.add(fp);
      this.flyPool.push(fp);
    }

    /* 破片 */
    this.bitMats = ["#e8c25a", "#d9b24a", "#7b6a56", "#e0543c", "#3f7fd6", "#5a6472", "#f6e9bb", "#ffffff", "#f0c9a6", "#4c7fd6"]
      .map(function (c) { return mat(c, { rough: 0.9 }); });
    for (var i = 0; i < 120; i++) {
      var b = this.mesh(this.geo.box, this.bitMats[0]);
      b.visible = false;
      this.bitPool.push(b);
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
  function lineTexture() {
    var c = document.createElement("canvas");
    c.width = 64; c.height = 128;
    var g = c.getContext("2d");
    g.clearRect(0, 0, 64, 128);
    g.fillStyle = "#f1ead6";
    g.fillRect(30, 0, 5, 54);                 /* まん中の破線 */
    g.fillRect(2, 0, 3, 128);                 /* 路肩 */
    g.fillRect(59, 0, 3, 128);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  /* ============ 牛 ============ 頭が -Z を向いて走る */
  Scene3D.prototype.buildCow = function () {
    var root = new T.Group(), self = this;
    var white = mat("#f5f2ea"), black = mat("#2b2723"), pink = mat("#e9a9a3"), horn = mat("#e7dfcb", { rough: 0.7 });
    var body = new T.Group();
    root.add(body);

    add(this.geo.ball, white, 0, 74, 4, 46, 40, 64, body);          /* 胴 */
    add(this.geo.ball, black, -32, 84, 14, 21, 19, 22, body);       /* 斑 */
    add(this.geo.ball, black, 28, 66, -14, 15, 14, 16, body);
    add(this.geo.ball, black, -4, 98, -30, 17, 13, 15, body);
    add(this.geo.tube, white, 0, 96, -44, 19, 42, 19, body).rotation.x = 0.62;   /* 首 */
    add(this.geo.ball, white, 0, 112, -72, 23, 20, 27, body);       /* 頭 */
    add(this.geo.ball, pink,  0, 103, -95, 13, 11, 10, body);       /* 鼻 */
    add(this.geo.ball, black, -12, 120, -88, 3.6, 3.6, 3.6, body);  /* 目 */
    add(this.geo.ball, black, 12, 120, -88, 3.6, 3.6, 3.6, body);
    add(this.geo.ball, white, -25, 119, -62, 13, 6, 9, body);       /* 耳 */
    add(this.geo.ball, white, 25, 119, -62, 13, 6, 9, body);
    add(this.geo.ball, horn, -13, 133, -68, 5, 9, 5, body);         /* 角 */
    add(this.geo.ball, horn, 13, 133, -68, 5, 9, 5, body);

    var legs = [];
    [[-27, -38], [27, -38], [-27, 34], [27, 34]].forEach(function (p) {
      var L = new T.Group();
      L.position.set(p[0], 58, p[1]);
      add(self.geo.tube, white, 0, -29, 0, 9, 58, 9, L);
      add(self.geo.ball, black, 0, -58, 2, 10, 6, 12, L);
      root.add(L);
      legs.push(L);
    });
    var tail = new T.Group();
    tail.position.set(0, 100, 58);
    add(this.geo.tube, white, 0, -22, 8, 4, 46, 4, tail).rotation.x = -0.3;
    add(this.geo.ball, black, 0, -44, 15, 7, 10, 7, tail);
    root.add(tail);

    return { root: root, body: body, legs: legs, tail: tail };

    function add(geo, material, x, y, z, sx, sy, sz, parent) {
      var m = new T.Mesh(geo, material);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      parent.add(m);
      return m;
    }
  };

  /* ============ 道ばたのもの ============ */
  Scene3D.prototype.makeFence = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, this.M.fenceWood, g), 0, 27, 0, 9, 54, 9);
    this.put(this.mesh(this.geo.box, this.M.fenceBar, g), 0, 44, 0, 5, 7, 112);
    this.put(this.mesh(this.geo.box, this.M.fenceBar, g), 0, 24, 0, 5, 7, 112);
    return g;
  };
  Scene3D.prototype.makeBarn = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, this.M.barnWall, g), 0, 46, 0, 150, 92, 130);
    var roof = this.put(this.mesh(this.geo.cone, this.M.barnRoof, g), 0, 118, 0, 118, 62, 104);
    roof.rotation.y = Math.PI / 4;
    this.put(this.mesh(this.geo.box, this.M.barnDoor, g), 0, 23, -66, 40, 46, 4);
    return g;
  };
  Scene3D.prototype.makePole = function (h, m) {
    var g = new T.Group();
    this.put(this.mesh(this.geo.tube, m, g), 0, h / 2, 0, 7, h, 7);
    this.put(this.mesh(this.geo.box, m, g), 0, h - 14, 0, 62, 8, 8);
    this.put(this.mesh(this.geo.box, m, g), 0, h - 40, 0, 48, 7, 7);
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
    return g;
  };
  Scene3D.prototype.makeTower = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, this.M.towerWall, g), 0, 200, 0, 130, 400, 120);
    this.put(this.mesh(this.geo.box, this.M.towerWin, g), 0, 200, -61, 96, 330, 3);
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
  Scene3D.prototype.makeBuilding = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.box, mat("#596373"), g), 0, 150, 0, 130, 300, 130);
    this.put(this.mesh(this.geo.box, mat("#f6e9bb", { flat: true }), g), 0, 155, -66, 92, 250, 3);
    g.userData.body = g.children[0];
    return g;
  };
  Scene3D.prototype.makeStar = function () {
    var g = new T.Group();
    this.put(this.mesh(this.geo.ball, mat("#ffffff", { flat: true }), g), 0, 120, 0, 26, 26, 26);
    this.put(this.mesh(this.geo.ball, new T.MeshBasicMaterial({ color: "#9fc4ff", transparent: true, opacity: 0.32 }), g),
             0, 120, 0, 46, 46, 46);
    return g;
  };

  /* ============ 破片 ============ */
  Scene3D.prototype.burst = function (x, z, type) {
    var cols = [[0, 1], [8, 9], [3, 4], [5, 6], [6, 7]][type] || [0, 1];
    var high = [40, 160, 46, 260, 120][type] || 40;
    for (var i = 0; i < 9; i++) {
      var m = this.bitPool.pop();
      if (!m) break;
      m.material = this.bitMats[cols[i % cols.length]];
      m.visible = true;
      var sx = 8 + Math.random() * 22;
      m.scale.set(sx, sx * (0.4 + Math.random() * 0.5), 6 + Math.random() * 14);
      m.position.set(x + (Math.random() - 0.5) * 70, 20 + Math.random() * high, z + (Math.random() - 0.5) * 60);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.bits.push({
        m: m, life: 0,
        vx: (Math.random() - 0.5) * 460,
        vy: 180 + Math.random() * 480,
        vz: 220 + Math.random() * 420,
        rx: (Math.random() - 0.5) * 12, ry: (Math.random() - 0.5) * 12
      });
    }
  };
  /* 人をひとり、宙へ跳ね上げる（こわさない） */
  Scene3D.prototype.launchPerson = function (x, r) {
    var m = this.flyPool.pop();
    if (!m) {
      var old = this.flying.shift();
      if (!old) return;
      m = old.m;
    }
    m.visible = true;
    m.position.set(x, 8, 0);
    m.rotation.set(0, r * 3.14, 0);
    if (m.userData.shirt) m.userData.shirt.color.copy(this.shirtColor(r));
    this.flying.push({
      m: m, life: 0,
      vx: (Math.random() - 0.5) * 240,
      vy: 470 + Math.random() * 260,
      vz: (this._wsp || 100) + 170 + Math.random() * 150,
      rx: (Math.random() - 0.5) * 10, ry: (Math.random() - 0.5) * 7, rz: (Math.random() - 0.5) * 10
    });
  };
  Scene3D.prototype.stepFlying = function (dt) {
    for (var i = this.flying.length - 1; i >= 0; i--) {
      var f = this.flying[i];
      f.life += dt;
      f.vy -= 1250 * dt;
      f.m.position.x += f.vx * dt;
      f.m.position.y += f.vy * dt;
      f.m.position.z += f.vz * dt;
      f.m.rotation.x += f.rx * dt;
      f.m.rotation.y += f.ry * dt;
      f.m.rotation.z += f.rz * dt;
      if (f.m.position.z > 900 || f.m.position.y < -240 || f.life > 3) {
        f.m.visible = false;
        this.flyPool.push(f.m);
        this.flying.splice(i, 1);
      }
    }
  };

  Scene3D.prototype.stepBits = function (dt) {
    for (var i = this.bits.length - 1; i >= 0; i--) {
      var b = this.bits[i];
      b.life += dt;
      b.vy -= 1500 * dt;
      b.m.position.x += b.vx * dt;
      b.m.position.y += b.vy * dt;
      b.m.position.z += b.vz * dt;
      b.m.rotation.x += b.rx * dt;
      b.m.rotation.y += b.ry * dt;
      if (b.life > 1.1 || b.m.position.y < -60 || b.m.position.z > 700) {
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
    for (var j = 0; j < this.flying.length; j++) {
      this.flying[j].m.visible = false;
      this.flyPool.push(this.flying[j].m);
    }
    this.flying.length = 0;
  };

  /* ============ 毎コマの更新 ============
     s: { dist, w, gear, legPhase, wsp, beta, props, dt, sky } */
  Scene3D.prototype.sync = function (s) {
    var w = s.w;
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
    var fov = this._baseFov * (1 + 0.1 * (s.t || 0));
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    /* 地面と道の色 */
    setColor(this.groundMat.color, s.groundColor);
    setColor(this.roadMat.color, s.roadColor);
    this.roadMat.opacity = 1 - w[4];
    this.road.visible = this.roadMat.opacity > 0.02;
    this.grassMat.opacity = 0.2 * (1 - w[4]);
    this.grass.visible = this.grassMat.opacity > 0.01;
    this.grassTex.offset.y = s.dist / 140;
    this.lineTex.offset.y = s.dist / 240;
    this.lineMat.opacity = Math.min(1, w[1] + w[2] + w[3]) * (1 - w[4]);
    this.lines.visible = this.lineMat.opacity > 0.02;
    setColor(this.fog.color, s.fogColor);
    this.fog.near = (800 + 1200 * w[4]) * ws;    /* 世界が広くなったぶん、霞む距離ものばす */
    this.fog.far = (2800 + 2600 * w[4]) * ws;

    /* 牛 */
    var cow = this.cow;
    var bob = Math.abs(Math.sin(s.legPhase * Math.PI * 2)) * 5;
    cow.root.position.set(0, bob, s.clickPulse * -26);
    cow.root.rotation.x = -0.06 * Math.min(1, s.wsp / 2400) - s.clickPulse * 0.06;
    for (var i = 0; i < cow.legs.length; i++) {
      var off = (i === 0 || i === 3) ? 0 : 0.5;
      cow.legs[i].rotation.x = Math.sin((s.legPhase + off) * Math.PI * 2) * 0.62;
    }
    cow.tail.rotation.x = Math.sin(s.legPhase * Math.PI) * 0.26 - 0.1;

    /* 道ばたのもの */
    this.row("fence", w[0], 112 * ws, 176 * ws, s.dist);
    this.row("barn", w[0], 520 * ws, 430 * ws, s.dist);
    this.row("pole", w[1] + w[2], 440 * ws, 300 * ws, s.dist);
    this.row("rail", w[1] + w[2] + w[3], 210 * ws, 156 * ws, s.dist);
    this.row("house", w[2], 340 * ws, 380 * ws, s.dist);
    this.row("tower", w[3], 420 * ws, 450 * ws, s.dist);

    /* 壊すもの */
    var used = [0, 0, 0, 0, 0];
    for (var p = 0; p < s.props.length; p++) {
      var o = s.props[p];
      if (o.z == null || o.z < -60 || o.z > 2600) continue;
      var lane = this.propPool[o.t];
      if (used[o.t] >= lane.length) continue;
      var m = lane[used[o.t]++];
      m.visible = true;
      m.position.set(o.x, 0, -o.z);
      m.rotation.y = o.t === 2 ? (o.r - 0.5) * 0.24 : o.r * 3.14;
      if (o.t === 1 && m.userData.shirt) m.userData.shirt.color.copy(this.shirtColor(o.r));
      if (o.t === 2 && m.userData.body) m.userData.body.material = this.carMat(o.r);
      if (o.t === 3 && m.userData.body) m.userData.body.scale.y = 300 * (0.7 + o.r * 0.7);
    }
    for (var t = 0; t < 5; t++) {
      for (var k = used[t]; k < this.propPool[t].length; k++) this.propPool[t][k].visible = false;
    }

    /* 星 */
    this.starMat.opacity = w[4];
    this.stars.visible = w[4] > 0.02;
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
    this.stepBits(s.dt);
    this.stepFlying(s.dt);

    function setColor(c, arr) { c.setRGB(srgb(arr[0]), srgb(arr[1]), srgb(arr[2])); }
    function srgb(v) {
      v = v / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
  };

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
    var start = Math.ceil((dist - BEHIND) / gap) * gap;   /* 通りすぎたぶんも残す */
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
    var p = this._v.set(0, 40, 0).project(this.camera);
    var x = (p.x + 1) / 2 * gameW, y = (1 - p.y) / 2 * gameH;
    var q = this._v.set(0, 140, 0).project(this.camera);
    var top = (1 - q.y) / 2 * gameH;
    return { x: x, y: y, s: Math.max(0.2, (y - top) / 100) };
  };
  Scene3D.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };
  Scene3D.prototype.reset = function () {
    this.clearBits();
  };

  global.GyuhoScene3D = Scene3D;
})(window);
