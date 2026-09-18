/* 一輪車で鍋の3Dの絵。中身の計算は index.html 側で、ここは受け取った姿勢を描くだけ。
   単位はメートル。進む向きが +x、手前（カメラ側）が +z。 */
(function (global) {
  "use strict";

  var R = 0.3;                 /* 車輪の半径 */
  var HIP = 0.58;              /* 車軸から腰まで */
  var THIGH = 0.34, SHIN = 0.34;
  var UPPER = 0.23, FORE = 0.23;
  var CRANK = 0.12;
  var POT = { x: 0.42, y: 0.7 };   /* 体から見た鍋の場所（胴に食い込まない距離） */
  var MOUTH = { x: 0.2, y: 1.12, z: 0.05 };

  /* 具。形・色・大きさ */
  var FOODS = [
    ["tofu", "#f4efe2"], ["negi", "#e8efd0"], ["shiitake", "#6b4a34"], ["hakusai", "#dfe9b8"],
    ["ebi", "#ef7f4f"], ["tofu", "#f4efe2"], ["ninjin", "#f08a2a"], ["negi", "#e8efd0"],
    ["shiitake", "#6b4a34"], ["tofu", "#f4efe2"], ["hakusai", "#dfe9b8"], ["ebi", "#ef7f4f"],
    ["negi", "#e8efd0"], ["ninjin", "#f08a2a"], ["shiitake", "#6b4a34"], ["tofu", "#f4efe2"]
  ];

  function NabeScene() {
    var T = global.THREE, self = this;
    this.T = T;
    var r = this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.outputColorSpace = T.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    this.canvas = r.domElement;

    var sc = this.scene = new T.Scene();
    sc.background = new T.Color("#1c2544");
    sc.fog = new T.Fog("#1c2544", 7, 22);
    this.camera = new T.PerspectiveCamera(40, 0.56, 0.1, 60);
    this.camX = 0;

    sc.add(new T.HemisphereLight("#b6c2f0", "#4a3a34", 1.4));
    var sun = this.sun = new T.DirectionalLight("#ffe6c4", 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sh = sun.shadow.camera;
    sh.left = -1.6; sh.right = 1.6; sh.top = 2; sh.bottom = -1.2; sh.near = 0.5; sh.far = 12;
    sun.shadow.bias = -0.0015;
    sc.add(sun, sun.target);

    this.mats = {};
    this.geo = {
      ball: new T.SphereGeometry(1, 18, 12),
      tube: new T.CylinderGeometry(1, 1, 1, 12),
      box: new T.BoxGeometry(1, 1, 1)
    };

    this.buildTown();
    this.buildRider();
    this.buildSteam();
    this.buildSnow();
    this.buildSpill();
  }

  NabeScene.prototype.mat = function (color, opt) {
    var key = color + JSON.stringify(opt || {});
    if (!this.mats[key]) {
      var o = { color: color, roughness: 0.85 };
      for (var k in opt) o[k] = opt[k];
      this.mats[key] = new this.T.MeshStandardMaterial(o);
    }
    return this.mats[key];
  };

  NabeScene.prototype.part = function (parent, kind, color, x, y, z, sx, sy, sz, opt) {
    var m = new this.T.Mesh(this.geo[kind], typeof color === "string" ? this.mat(color, opt) : color);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  /* 太さのある棒を a から b へ渡す */
  NabeScene.prototype.segment = function (mesh, a, b) {
    var T = this.T;
    var from = new T.Vector3(a[0], a[1], a[2]), to = new T.Vector3(b[0], b[1], b[2]);
    var d = to.clone().sub(from), len = d.length();
    mesh.position.copy(from).addScaledVector(d, 0.5);
    mesh.scale.y = Math.max(0.001, len);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  };

  /* ============ 町（進むぶんだけ並びを回す） ============ */
  NabeScene.prototype.buildTown = function () {
    var T = this.T, sc = this.scene, self = this;
    this.loops = [];

    var ground = this.ground = new T.Group();
    sc.add(ground);
    function plane(color, z0, z1, y) {
      var m = new T.Mesh(new T.PlaneGeometry(60, z1 - z0), self.mat(color));
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, y || 0, (z0 + z1) / 2);
      m.receiveShadow = true;
      ground.add(m);
    }
    plane("#3a3e4b", -1.4, 1.6);           /* 道 */
    plane("#e4eaf4", 1.6, 12, 0.005);      /* 手前の雪 */
    plane("#cfd7e6", -3.4, -1.4, 0.06);    /* 歩道の雪 */
    plane("#e4eaf4", -30, -3.4, 0.005);

    /* 縁石 */
    var curb = new T.Mesh(this.geo.box, this.mat("#9aa3b5"));
    curb.scale.set(60, 0.08, 0.14); curb.position.set(0, 0.04, -1.4); curb.receiveShadow = true;
    ground.add(curb);

    function loop(obj, spacing, count, i) {
      obj.userData.base = i * spacing;
      obj.userData.span = spacing * count;
      self.loops.push(obj);
      sc.add(obj);
    }
    /* 道の白線 */
    for (var i = 0; i < 16; i++) {
      var dash = new T.Mesh(this.geo.box, this.mat("#d8dce6"));
      dash.scale.set(0.9, 0.01, 0.08);
      dash.position.set(0, 0.006, 1.25);
      dash.receiveShadow = true;
      loop(dash, 2, 16, i);
    }
    /* 家 */
    var walls = ["#b8876a", "#8c6f5a", "#c9b393", "#7c8a8e", "#a36c5a", "#d2c2a4"];
    var roofs = ["#5a3a32", "#3f4a5a", "#6a4a3a", "#4a3a3a"];
    for (i = 0; i < 8; i++) {
      var h = new T.Group();
      var w = 3.1, tall = 2.2 + (i * 37 % 5) * 0.35, dep = 2.4;
      var body = new T.Mesh(this.geo.box, this.mat(walls[i % walls.length]));
      body.scale.set(w, tall, dep); body.position.y = tall / 2; body.receiveShadow = true;
      h.add(body);
      var roof = new T.Mesh(new T.CylinderGeometry(0.01, 1, 1, 4, 1), this.mat(roofs[i % roofs.length]));
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w * 0.78, 0.9, dep * 0.78);
      roof.position.y = tall + 0.45;
      h.add(roof);
      var snowRoof = new T.Mesh(new T.CylinderGeometry(0.01, 1, 1, 4, 1), this.mat("#eef2fa"));
      snowRoof.rotation.y = Math.PI / 4;
      snowRoof.scale.set(w * 0.6, 0.55, dep * 0.6);
      snowRoof.position.y = tall + 0.62;
      h.add(snowRoof);
      for (var f = 0; f < Math.floor(tall / 1.1); f++) {
        for (var c = 0; c < 2; c++) {
          var lit = ((i * 7 + f * 3 + c * 5) % 4) !== 0;
          var win = new T.Mesh(this.geo.box, lit ? this.mat("#ffd38a", { emissive: "#ffb454", emissiveIntensity: 1.3 }) : this.mat("#2a3148"));
          win.scale.set(0.55, 0.6, 0.04);
          win.position.set(-0.7 + c * 1.4, 0.75 + f * 1.1, dep / 2 + 0.01);
          h.add(win);
        }
      }
      h.position.z = -5;
      loop(h, 3.5, 8, i);
    }
    /* 街灯 */
    for (i = 0; i < 5; i++) {
      var lamp = new T.Group();
      var pole = new T.Mesh(this.geo.tube, this.mat("#2c313d"));
      pole.scale.set(0.05, 2.8, 0.05); pole.position.y = 1.4; pole.castShadow = true;
      lamp.add(pole);
      var arm = new T.Mesh(this.geo.box, this.mat("#2c313d"));
      arm.scale.set(0.05, 0.05, 0.5); arm.position.set(0, 2.78, 0.22);
      lamp.add(arm);
      var bulb = new T.Mesh(this.geo.ball, this.mat("#fff1c8", { emissive: "#ffcf80", emissiveIntensity: 2 }));
      bulb.scale.set(0.12, 0.08, 0.12); bulb.position.set(0, 2.7, 0.42);
      lamp.add(bulb);
      var glow = new T.Sprite(new T.SpriteMaterial({ map: this.softTexture("255,210,140"), transparent: true, depthWrite: false, opacity: 0.55 }));
      glow.scale.set(1.3, 1.3, 1); glow.position.set(0, 2.66, 0.42);
      lamp.add(glow);
      lamp.position.z = -1.9;
      loop(lamp, 6, 5, i);
    }
  };

  NabeScene.prototype.softTexture = function (rgb) {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(" + rgb + ",1)");
    grd.addColorStop(0.4, "rgba(" + rgb + ",.45)");
    grd.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    var t = new this.T.CanvasTexture(c);
    t.colorSpace = this.T.SRGBColorSpace;
    return t;
  };

  /* ============ 一輪車と人 ============ */
  NabeScene.prototype.buildRider = function () {
    var T = this.T, self = this;
    var base = this.base = new T.Group();
    this.scene.add(base);

    /* 車輪（回る） */
    var wheel = this.wheel = new T.Group();
    base.add(wheel);
    var tire = new T.Mesh(new T.TorusGeometry(R - 0.035, 0.035, 10, 32), this.mat("#1d1f24"));
    tire.castShadow = true; wheel.add(tire);
    var rim = new T.Mesh(new T.TorusGeometry(R - 0.07, 0.01, 6, 32), this.mat("#c9ccd4", { metalness: 0.6, roughness: 0.35 }));
    wheel.add(rim);
    for (var i = 0; i < 12; i++) {
      var sp = new T.Mesh(this.geo.tube, this.mat("#c9ccd4", { metalness: 0.6, roughness: 0.35 }));
      sp.scale.set(0.004, R - 0.07, 0.004);
      sp.rotation.z = i / 12 * Math.PI * 2;
      sp.position.set(-Math.sin(sp.rotation.z) * (R - 0.07) / 2, Math.cos(sp.rotation.z) * (R - 0.07) / 2, 0);
      wheel.add(sp);
    }
    var hub = new T.Mesh(this.geo.tube, this.mat("#8a8f9c"));
    hub.scale.set(0.03, 0.2, 0.03); hub.rotation.x = Math.PI / 2; wheel.add(hub);
    this.pedals = [];
    [-1, 1].forEach(function (s) {
      var crank = new T.Group();
      crank.position.z = s * 0.1;
      crank.rotation.z = s > 0 ? 0 : Math.PI;
      wheel.add(crank);
      var arm = self.part(crank, "box", "#9aa0ad", 0, -CRANK / 2, 0, 0.022, CRANK, 0.015);
      arm.castShadow = true;
      self.part(crank, "box", "#2a2d33", 0, -CRANK, s * 0.03, 0.08, 0.02, 0.06);
      self.pedals.push(s);
    });

    /* 車軸から上。倒れるときはここごと回る */
    var rig = this.rig = new T.Group();
    base.add(rig);
    var frame = "#d8412f";
    [-1, 1].forEach(function (s) { self.segment(self.part(rig, "tube", frame, 0, 0, 0, 0.016, 1, 0.016), [0, 0, s * 0.06], [0, 0.3, s * 0.035]); });
    this.part(rig, "box", frame, 0, 0.3, 0, 0.05, 0.03, 0.1);
    this.part(rig, "tube", "#b8bcc6", 0, 0.42, 0, 0.018, 0.24, 0.018, { metalness: 0.5, roughness: 0.4 });
    this.part(rig, "ball", "#222428", 0.01, 0.55, 0, 0.13, 0.035, 0.07);
    this.frameParts = rig.children.slice();       /* 骨組み（倒れたら一輪車と一緒に転がる） */

    var coat = "#3a6fb8", pants = "#2e3442", skin = "#f1c7a1", mitten = "#e2493a";
    this.legs = [];
    [-1, 1].forEach(function (s) {
      self.legs.push({
        s: s,
        thigh: self.part(rig, "tube", pants, 0, 0, 0, 0.055, 1, 0.055),
        shin: self.part(rig, "tube", pants, 0, 0, 0, 0.045, 1, 0.045),
        knee: self.part(rig, "ball", pants, 0, 0, 0, 0.055, 0.055, 0.055),
        foot: self.part(rig, "ball", "#3b2a22", 0, 0, 0, 0.075, 0.04, 0.05)
      });
    });
    var hips = this.part(rig, "ball", pants, 0, HIP + 0.04, 0, 0.13, 0.09, 0.14);
    this.torso = this.part(rig, "ball", coat, 0.02, 0.83, 0, 0.16, 0.24, 0.16);
    var skirt = this.part(rig, "tube", "#f2c94c", 0.02, 0.63, 0, 0.14, 0.04, 0.145);        /* 上着のすそ */
    var scarf = this.part(rig, "tube", "#e8702a", 0.02, 1.04, 0, 0.1, 0.06, 0.1);            /* マフラー */
    var tail = this.part(rig, "box", "#e8702a", -0.06, 0.95, 0.07, 0.04, 0.16, 0.05);
    tail.rotation.z = 0.2;
    this.torsoParts = [hips, this.torso, skirt, scarf, tail];   /* 倒れたら胴としてひとかたまり */

    /* 頭。顔をすこしカメラへ向ける */
    var head = this.head = new T.Group();
    head.position.set(0.03, 1.2, 0);
    head.rotation.y = -0.55;
    rig.add(head);
    this.face = this.part(head, "ball", skin, 0, 0, 0, 0.14, 0.14, 0.14);
    this.face.material = this.face.material.clone();
    this.skinColor = new T.Color(skin);
    this.hotColor = new T.Color("#e0281e");
    this.face.material.emissive = new T.Color("#ff2010");
    this.face.material.emissiveIntensity = 0;
    /* 顔の部品（目・口・ほほ）は付けない。熱さは顔色と湯気と頭のふるえで見せる */
    /* 長い鼻。顔と同じ色なので、熱いと一緒に赤くなる */
    var nose = new T.Mesh(new T.CylinderGeometry(0.013, 0.032, 0.2, 12), this.face.material);
    nose.rotation.z = -Math.PI / 2 + 0.12;
    nose.position.set(0.225, -0.005, 0);
    nose.castShadow = true;
    head.add(nose);
    /* ニット帽 */
    this.part(head, "ball", "#d8412f", -0.005, 0.045, 0, 0.145, 0.12, 0.145);
    this.part(head, "tube", "#f2ede4", 0, 0.05, 0, 0.148, 0.04, 0.148);
    this.part(head, "ball", "#f2ede4", -0.02, 0.18, 0, 0.045, 0.045, 0.045);

    /* 腕：奥の手で鍋を持ち、手前の手で箸 */
    this.arms = [];
    [-1, 1].forEach(function (s) {
      self.arms.push({
        s: s,
        upper: self.part(rig, "tube", coat, 0, 0, 0, 0.045, 1, 0.045),
        fore: self.part(rig, "tube", coat, 0, 0, 0, 0.04, 1, 0.04),
        elbow: self.part(rig, "ball", coat, 0, 0, 0, 0.045, 0.045, 0.045),
        hand: self.part(rig, "ball", mitten, 0, 0, 0, 0.045, 0.045, 0.045)
      });
    });
    this.chop = [0, 1].map(function () { return self.part(rig, "tube", "#c98a4b", 0, 0, 0, 0.005, 1, 0.005); });
    this.held = this.part(rig, "ball", "#fff", 0, 0, 0, 0.025, 0.02, 0.025);
    this.held.material = this.held.material.clone();

    /* 土鍋 */
    var pot = this.pot = new T.Group();
    pot.scale.setScalar(1.3);
    rig.add(pot);
    var prof = [[0, 0], [0.11, 0], [0.16, 0.035], [0.172, 0.085], [0.166, 0.105], [0.152, 0.105], [0.155, 0.085], [0.145, 0.04], [0.1, 0.014], [0, 0.014]]
      .map(function (p) { return new T.Vector2(p[0], p[1]); });
    var clay = new T.Mesh(new T.LatheGeometry(prof, 28), this.mat("#6e3f27", { side: T.DoubleSide }));
    clay.castShadow = true;
    pot.add(clay);
    var band = new T.Mesh(new T.TorusGeometry(0.164, 0.007, 6, 28), this.mat("#f0e6d2"));
    band.rotation.x = Math.PI / 2; band.position.y = 0.1; pot.add(band);
    [-1, 1].forEach(function (s) {
      /* 取っ手は奥と手前。縁から水平に張り出す輪で、根元は壁に埋める */
      var hd = new T.Mesh(new T.TorusGeometry(0.03, 0.011, 6, 12, Math.PI), self.mat("#6e3f27"));
      hd.position.set(0, 0.085, s * 0.162); hd.rotation.x = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      hd.castShadow = true;
      pot.add(hd);
    });
    var soup = this.soup = new T.Mesh(new T.CircleGeometry(0.15, 28), this.mat("#d8783a", { roughness: 0.3 }));
    soup.rotation.x = -Math.PI / 2;
    pot.add(soup);
    this.warm = new T.PointLight("#ffa060", 1.5, 1.6, 1.5);
    this.warm.position.set(0, 0.25, 0.1);
    pot.add(this.warm);

    /* 具 */
    this.foods = FOODS.map(function (f, i) {
      var g = new T.Group(), kind = f[0], col = f[1];
      if (kind === "tofu") self.part(g, "box", col, 0, 0, 0, 0.05, 0.03, 0.05);
      else if (kind === "negi") { var n = self.part(g, "tube", col, 0, 0, 0, 0.016, 0.06, 0.016); n.rotation.z = Math.PI / 2; self.part(g, "tube", "#7fb34a", 0.035, 0, 0, 0.017, 0.012, 0.017).rotation.z = Math.PI / 2; }
      else if (kind === "shiitake") { self.part(g, "ball", col, 0, 0.008, 0, 0.032, 0.016, 0.032); }
      else if (kind === "hakusai") self.part(g, "box", col, 0, 0, 0, 0.06, 0.01, 0.035);
      else if (kind === "ninjin") self.part(g, "tube", col, 0, 0, 0, 0.026, 0.012, 0.026);
      else { var eb = new T.Mesh(new T.TorusGeometry(0.022, 0.01, 6, 10, Math.PI * 1.3), self.mat(col)); eb.rotation.x = -Math.PI / 2; g.add(eb); }
      var a = i * 2.4, rr = 0.03 + (i % 4) * 0.028;
      g.userData.home = [Math.cos(a) * rr, Math.sin(a) * rr];
      g.rotation.y = a * 1.7;
      g.userData.spin = g.rotation.y;
      g.userData.color = col;
      pot.add(g);
      return g;
    });
  };

  /* ============ 倒れたら中身をぶちまける ============
     具は物理（cannon）の体にして放り出す。地面で跳ねて転がり、具どうしもぶつかる。
     汁はしぶきを飛ばし、落ちたところにしみを残す。鍋が落ちたところに汁だまりが広がる。
     見た目だけの演出で、遊びの計算には関わらない。 */
  NabeScene.prototype.buildSpill = function () {
    var T = this.T;
    this.drops = [];
    var dropMat = this.mat("#c8652e", { roughness: 0.25 });
    for (var i = 0; i < 48; i++) {
      var d = new T.Mesh(this.geo.ball, dropMat);
      d.visible = false;
      this.scene.add(d);
      this.drops.push({ m: d, vx: 0, vy: 0, vz: 0, flying: false });
    }
    this.puddle = new T.Mesh(new T.CircleGeometry(1, 28), this.mat("#b85a2a", { roughness: 0.2, transparent: true, opacity: 0.9 }));
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.visible = false;
    this.puddle.receiveShadow = true;
    this.scene.add(this.puddle);
    this.spill = null;
  };

  NabeScene.prototype.spillStart = function (v, fl) {
    var T = this.T, C = global.CANNON, self = this;
    var left = 1 - v.eaten / v.N;                   /* 残っていた汁と具の割合 */
    var world = this.fallWorld;
    var bodies = [];
    var shown = this.foods.length, gone = Math.floor(v.eaten * shown / v.N);
    this.pot.updateMatrixWorld(true);
    this.foods.forEach(function (f, i) {
      if (i < gone || !f.visible) return;
      self.scene.attach(f);
      var vx = fl.vx * (0.6 + Math.random() * 0.7) + (Math.random() - 0.5) * 1.2;
      var vy = fl.vy * (0.7 + Math.random() * 0.6) + 0.4 + Math.random() * 1.2;
      var vz = (Math.random() - 0.3) * 1.4;
      var b = null;
      if (world) {
        var kind = FOODS[i][0];
        var shape = kind === "tofu" ? new C.Box(new C.Vec3(0.033, 0.02, 0.033))
                  : kind === "hakusai" ? new C.Box(new C.Vec3(0.04, 0.007, 0.023))
                  : kind === "negi" ? new C.Box(new C.Vec3(0.05, 0.012, 0.012))
                  : new C.Sphere(0.022);
        b = new C.Body({ mass: 0.02, shape: shape, linearDamping: 0.05, angularDamping: 0.3,
                           collisionFilterGroup: 4, collisionFilterMask: -1 });
        b.position.set(f.position.x, f.position.y, f.position.z);
        b.quaternion.set(f.quaternion.x, f.quaternion.y, f.quaternion.z, f.quaternion.w);
        b.velocity.set(vx, vy, vz);
        b.angularVelocity.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
        world.addBody(b);
      }
      bodies.push({ f: f, b: b, v: [vx, vy, vz] });
    });
    /* 汁のしぶき */
    var pw = new T.Vector3();
    this.pot.getWorldPosition(pw);
    var n = Math.round(this.drops.length * (0.25 + 0.75 * left));
    this.drops.forEach(function (d, i) {
      d.m.visible = i < n;
      d.flying = i < n;
      if (!d.flying) return;
      d.m.position.set(pw.x + (Math.random() - 0.5) * 0.12, pw.y + 0.08, pw.z + (Math.random() - 0.5) * 0.12);
      var s = 0.012 + Math.random() * 0.018;
      d.m.scale.set(s, s, s);
      d.vx = fl.vx * (0.5 + Math.random()) + (Math.random() - 0.5) * 1.6;
      d.vy = fl.vy * (0.5 + Math.random()) + Math.random() * 1.8;
      d.vz = (Math.random() - 0.3) * 1.6;
    });
    this.soup.visible = false;
    this.spill = { world: world, bodies: bodies, left: left, puddleT: -1 };
  };

  NabeScene.prototype.spillStep = function (dt) {
    var sp = this.spill;
    if (!sp) return;
    if (sp.world) sp.world.step(1 / 60, dt, 4);
    sp.bodies.forEach(function (o) {
      if (o.b) {
        o.f.position.set(o.b.position.x, o.b.position.y, o.b.position.z);
        o.f.quaternion.set(o.b.quaternion.x, o.b.quaternion.y, o.b.quaternion.z, o.b.quaternion.w);
      } else {
        /* 物理が読めないときは、放物線で落ちて止まるだけ */
        o.v[1] -= 9.8 * dt;
        o.f.position.x += o.v[0] * dt; o.f.position.y += o.v[1] * dt; o.f.position.z += o.v[2] * dt;
        if (o.f.position.y < 0.02) { o.f.position.y = 0.02; o.v = [o.v[0] * 0.5, 0, o.v[2] * 0.5]; }
      }
    });
    /* しぶき：落ちたら平たいしみになる */
    this.drops.forEach(function (d) {
      if (!d.flying) return;
      d.vy -= 9.8 * dt;
      d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
      if (d.m.position.y <= 0.004) {
        d.flying = false;
        d.m.position.y = 0.004;
        var s = d.m.scale.x;
        d.m.scale.set(s * 2.6, s * 0.15, s * 2.6);
      }
    });
    /* 鍋が地面に着いたら汁だまりが広がる */
    if (this.potFlying && this.potFlying.vy === 0 && sp.puddleT < 0) {
      sp.puddleT = 0;
      this.puddle.position.set(this.pot.position.x, 0.003, this.pot.position.z);
      this.puddle.visible = true;
    }
    if (sp.puddleT >= 0) {
      sp.puddleT += dt;
      var r = (0.12 + 0.4 * sp.left) * (1 - Math.exp(-sp.puddleT * 3));
      this.puddle.scale.set(r, r * 0.8, 1);
    }
  };

  NabeScene.prototype.spillReset = function () {
    var self = this;
    if (!this.spill) return;
    this.spill.bodies.forEach(function (o) {
      self.pot.attach(o.f);
      o.f.quaternion.identity();
      o.f.rotation.y = o.f.userData.spin || 0;
      o.f.scale.set(1, 1, 1);
    });
    this.drops.forEach(function (d) { d.m.visible = false; d.flying = false; });
    this.puddle.visible = false;
    this.soup.visible = true;
    this.spill = null;
  };

  /* ============ 倒れたらラグドール ============
     倒れた瞬間に、体を頭・胴・上腕・前腕・太もも・すねに分けて、関節でつないだ物理の体にする。
     一輪車も別の体にして転がす。飛び散った具とも同じ世界でぶつかる。
     ぶつかり分け：地面1 / 体2（体どうしはぶつけない。関節がつっぱらないように）/ 具4 / 一輪車8 */
  NabeScene.prototype.makeFallWorld = function () {
    var C = global.CANNON;
    if (!C) return null;
    var world = new C.World({ gravity: new C.Vec3(0, -9.8, 0) });
    world.broadphase = new C.NaiveBroadphase();
    world.solver.iterations = 15;
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.3;
    var ground = new C.Body({ mass: 0, shape: new C.Plane(), collisionFilterGroup: 1, collisionFilterMask: -1 });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);
    return world;
  };

  NabeScene.prototype.ragStart = function (v) {
    var T = this.T, C = global.CANNON, self = this, world = this.fallWorld;
    if (!C || !world) return;
    this.scene.updateMatrixWorld(true);
    var axle = new T.Vector3();
    this.base.getWorldPosition(axle);
    var rq = new T.Quaternion();
    this.rig.getWorldQuaternion(rq);
    var moved = [], parts = [];
    function W(p) { return self.rig.localToWorld(new T.Vector3(p[0], p[1], p[2])); }
    function part(meshes, center, quat, shape, mass, group, mask, shapeQuat) {
      var g = new T.Group();
      g.position.copy(center); g.quaternion.copy(quat);
      self.scene.add(g);
      meshes.forEach(function (m) {
        moved.push({ m: m, parent: m.parent, p: m.position.clone(), q: m.quaternion.clone(), s: m.scale.clone() });
        g.attach(m);
      });
      var b = new C.Body({ mass: mass, linearDamping: 0.05, angularDamping: 0.4,
                           collisionFilterGroup: group, collisionFilterMask: mask });
      b.addShape(shape, new C.Vec3(0, 0, 0), shapeQuat);
      b.position.set(center.x, center.y, center.z);
      b.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      /* 倒れる回転の勢いを引き継ぐ（体は z 軸まわりに -w で回っている） */
      var rx = center.x - axle.x, ry = center.y - axle.y;
      b.velocity.set(v.v + v.w * ry, -v.w * rx, (Math.random() - 0.5) * 0.3);
      b.angularVelocity.set(0, 0, -v.w);
      world.addBody(b);
      parts.push({ g: g, b: b });
      return b;
    }
    function limb(meshes, a, bpt, r, mass) {
      var A = W(a), B = W(bpt), mid = A.clone().add(B).multiplyScalar(0.5);
      var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      return part(meshes, mid, q, new C.Box(new C.Vec3(r, Math.max(0.02, A.distanceTo(B) / 2), r)), mass, 2, 1 | 4 | 8);
    }
    function joint(b1, b2, p) {
      var w = W(p), c = new C.Vec3(w.x, w.y, w.z);
      world.addConstraint(new C.PointToPointConstraint(b1, b1.pointToLocalFrame(c), b2, b2.pointToLocalFrame(c)));
    }
    var torso = part(this.torsoParts, W([0.02, 0.83, 0]), rq, new C.Box(new C.Vec3(0.15, 0.27, 0.15)), 30, 2, 1 | 4 | 8);
    var head = part([this.head], W([0.03, 1.2, 0]), rq, new C.Sphere(0.15), 5, 2, 1 | 4 | 8);
    joint(torso, head, [0.03, 1.07, 0]);
    this.legs.forEach(function (L) {
      var P = L.pts;
      var th = limb([L.thigh, L.knee], P[0], P[1], 0.055, 7);
      var sh = limb([L.shin, L.foot], P[1], P[2], 0.045, 4);
      joint(torso, th, P[0]);
      joint(th, sh, P[1]);
    });
    this.arms.forEach(function (A) {
      var P = A.pts;
      var up = limb([A.upper, A.elbow], P[0], P[1], 0.045, 2.5);
      var fo = limb([A.fore, A.hand].concat(A.s > 0 ? self.chop : []), P[1], P[2], 0.04, 2);
      joint(torso, up, P[0]);
      joint(up, fo, P[1]);
    });
    /* 一輪車：車輪（z 向きの円柱）と支柱 */
    var cyc = part([this.wheel].concat(this.frameParts), axle.clone(), rq,
                   new C.Cylinder(R, R, 0.08, 14), 6, 8, 1 | 2 | 4,
                   new C.Quaternion().setFromEuler(Math.PI / 2, 0, 0));
    cyc.addShape(new C.Box(new C.Vec3(0.03, 0.28, 0.05)), new C.Vec3(0, 0.3, 0));
    cyc.angularVelocity.set(0, 0, -v.v / R);
    this.held.visible = false;
    this.rag = { parts: parts, moved: moved };
  };

  NabeScene.prototype.ragStep = function () {
    if (!this.rag) return;
    this.rag.parts.forEach(function (o) {
      o.g.position.set(o.b.position.x, o.b.position.y, o.b.position.z);
      o.g.quaternion.set(o.b.quaternion.x, o.b.quaternion.y, o.b.quaternion.z, o.b.quaternion.w);
    });
  };

  NabeScene.prototype.ragReset = function () {
    var self = this;
    if (!this.rag) return;
    this.rag.moved.forEach(function (o) {
      o.parent.add(o.m);
      o.m.position.copy(o.p); o.m.quaternion.copy(o.q); o.m.scale.copy(o.s);
    });
    this.rag.parts.forEach(function (o) { self.scene.remove(o.g); });
    this.rag = null;
  };

  /* ============ 湯気と雪 ============ */
  NabeScene.prototype.buildSteam = function () {
    var T = this.T;
    var tex = this.softTexture("255,255,255");
    this.puffs = [];
    for (var i = 0; i < 48; i++) {
      var s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      this.scene.add(s);
      this.puffs.push({ s: s, life: 0, max: 1, vx: 0, vy: 0, size: 0.1 });
    }
    this.nextPuff = 0;
  };
  NabeScene.prototype.puff = function (p, vx, vy, size, life, op) {
    var q = this.puffs[this.nextPuff++ % this.puffs.length];
    q.s.position.copy(p);
    q.vx = vx; vy = vy; q.vy = vy; q.size = size; q.life = q.max = life; q.op = op;
    q.s.visible = true;
  };

  NabeScene.prototype.buildSnow = function () {
    var T = this.T, n = 500, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = Math.random() * 14 - 7;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = Math.random() * 8 - 5;
    }
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    this.snow = new T.Points(g, new T.PointsMaterial({ color: "#ffffff", size: 0.05, map: this.softTexture("255,255,255"), transparent: true, opacity: 0.9, depthWrite: false }));
    this.scene.add(this.snow);
    this.snowT = 0;
  };

  /* ============ 大きさ ============ */
  NabeScene.prototype.resize = function (wPx, hPx, W, H) {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(wPx, hPx, false);
    var aspect = W / H;
    this.camera.aspect = aspect;
    /* 横の見える幅を保ち、縦長の端末では上下が広がる */
    var hf = 40 * Math.PI / 180;
    this.camera.fov = 2 * Math.atan(Math.tan(hf / 2) / aspect) * 180 / Math.PI;
    this.camera.updateProjectionMatrix();
    this.aspect = aspect;
  };

  /* ============ 1コマ ============
     v = { x, th, v, bite:{p, idx}, eaten, N, hot, phase, fallT, doneT, t } */
  NabeScene.prototype.render = function (v, dt) {
    var T = this.T, self = this;

    /* カメラは滑らかに追う */
    /* 速さのぶん先を見越して、進んでいても人物が真ん中に来るように */
    /* 倒れたら倒れた先へ寄せて、少し引く */
    var fk = v.phase === "fall" ? Math.min(1, v.fallT * 2) : 0;
    /* ラグドールの間は、転がっていく胴を追う */
    var aim = this.rag ? this.rag.parts[0].g.position.x : v.x + v.v * 0.33 + fk * Math.sin(v.th) * 0.55;
    this.camX += (aim - this.camX) * Math.min(1, dt * 3);
    var cx = this.camX;
    var tall = 1 / this.aspect;               /* 縦長ほど少し引く */
    this.camera.position.set(cx + 0.75, 1.5 + (tall - 1.6) * 0.3 + fk * 0.2, 2.35 + (tall - 1.6) * 0.6 + fk * 0.9);
    this.camera.lookAt(cx + 0.12, 0.72 + (tall - 1.6) * 0.1, 0);
    this.sun.position.set(cx + 1.5, 5, 3.5);
    this.sun.target.position.set(cx, 0, 0);
    this.ground.position.x = cx;
    this.loops.forEach(function (o) {
      var span = o.userData.span, b = o.userData.base;
      var rel = ((b - cx) % span + span * 1.5) % span - span / 2;
      o.position.x = cx + rel;
    });

    /* 一輪車 */
    this.base.position.set(v.x, R, 0);
    var phi = -v.x / R;
    var th = v.th, posing = !this.rag;       /* ラグドールの間は、姿勢を物理にまかせる */
    if (posing) this.wheel.rotation.z = phi;
    this.rig.rotation.z = -th;

    /* 脚：ペダルを体の向きに直して、ひざを前に曲げる */
    var ct = Math.cos(th), st = Math.sin(th);
    if (posing) this.legs.forEach(function (L, i) {
      var a = phi + (L.s > 0 ? 0 : Math.PI);
      var px = Math.sin(a) * CRANK, py = -Math.cos(a) * CRANK;
      /* 車輪の枠から体の枠へ（体は -th 回っている） */
      var fx = px * ct - py * st, fy = px * st + py * ct;
      var hip = [0.01, HIP, L.s * 0.075], foot = [fx + 0.02, fy + 0.02, L.s * 0.12];
      var knee = ik2(hip, foot, THIGH, SHIN, 1);
      self.segment(L.thigh, hip, knee);
      self.segment(L.shin, knee, foot);
      L.knee.position.set(knee[0], knee[1], knee[2]);
      L.foot.position.set(foot[0] + 0.02, foot[1] + 0.01, foot[2]);
      L.pts = [hip, knee, foot];
    });

    /* 箸と具 */
    var surf = 0.03 + 0.055 * (1 - v.eaten / v.N);
    this.soup.position.y = surf;
    var hotK = Math.max(0, Math.min(1, v.hot));
    /* 食べきったら：持ち上げて傾ける(0〜0.5秒) → 頭を反らして飲み干す(〜1.3秒) → 元の位置へ戻す(〜1.7秒) */
    var dT = v.phase === "done" ? v.doneT : -1;
    var potLift = dT < 0 ? 0 : dT < 0.5 ? ease(dT / 0.5) : dT < 1.3 ? 1 : dT < 1.7 ? 1 - ease((dT - 1.3) / 0.4) : 0;
    var drink = dT < 0.5 ? 0 : Math.min(1, (dT - 0.5) / 0.8);          /* 飲み干すほど深く傾ける */
    var gulp = dT >= 0.5 && dT < 1.3 ? potLift : 0;
    /* 食べきったら、鍋を口へ運んで汁を飲む */
    var potX = POT.x - potLift * 0.1, potY = POT.y + potLift * 0.36;
    if (!this.potFlying) this.pot.position.set(potX, potY, -0.02);
    if (!this.potFlying) this.pot.rotation.z = potLift * (0.85 + 0.55 * drink);

    var p = v.bite.p, rest = [potX - 0.02, potY + 0.2, 0.03];
    var inPot = [potX + 0.02, potY + surf + 0.01, 0.02];
    var mouth = [MOUTH.x, MOUTH.y, MOUTH.z];
    var tip;
    if (p < 0.3) tip = lerp3(rest, inPot, ease(p / 0.3));
    else if (p < 0.65) tip = lerp3(inPot, mouth, ease((p - 0.3) / 0.35));
    else if (p < 0.8) tip = mouth;
    else tip = lerp3(mouth, rest, ease((p - 0.8) / 0.2));
    if (v.phase !== "ride" && v.phase !== "intro") tip = [rest[0] - 0.05, rest[1] + 0.1, 0.1];
    var shake = hotK * Math.sin(v.t * 40) * 0.02;
    tip = [tip[0] + shake, tip[1], tip[2]];
    var hand = [tip[0] - 0.13, tip[1] + 0.12, tip[2] + 0.14];
    if (v.phase === "done") {
      /* 箸は持ったまま、手前の手も鍋に添える */
      hand = [potX - 0.04, potY + 0.02, 0.15];
      tip = [hand[0] + 0.05, hand[1] + 0.2, hand[2] + 0.02];
    }
    if (posing) this.segment(this.chop[0], hand, tip);
    if (posing) this.segment(this.chop[1], [hand[0], hand[1] + 0.012, hand[2] - 0.01], [tip[0] + 0.005, tip[1] + 0.01, tip[2] - 0.012]);
    var holding = v.bite.idx < v.N && p >= 0.3 && p < 0.72 && v.phase === "ride";
    this.held.visible = holding;
    if (holding) {
      this.held.position.set(tip[0], tip[1], tip[2]);
      this.held.material.color.set(this.foods[v.bite.idx].userData.color);
    }
    if (!this.spill) this.foods.forEach(function (f, i) {
      var gone = i < v.eaten || (i === v.bite.idx && holding);
      f.visible = !gone;
      f.position.set(f.userData.home[0], surf + 0.012, f.userData.home[1]);
    });

    /* 腕 */
    var potHand = [potX, potY + 0.1, -0.28];          /* 奥の手は奥の取っ手をつかむ */
    if (posing) this.arms.forEach(function (A) {
      var sh = [0.03, 0.98, A.s * 0.17];
      var h = A.s > 0 ? hand : potHand;
      var el = ik2(sh, h, UPPER, FORE, -1);
      el[2] += A.s * 0.04;
      self.segment(A.upper, sh, el);
      self.segment(A.fore, el, h);
      A.elbow.position.set(el[0], el[1], el[2]);
      A.hand.position.set(h[0], h[1], h[2]);
      A.pts = [sh, el, h];
    });

    /* 顔：熱いと赤くなって、頭がふるえる */
    var red = Math.max(0, Math.min(1, v.red || 0));
    this.face.material.color.copy(this.skinColor).lerp(this.hotColor, red);
    this.face.material.emissiveIntensity = red * 0.35;   /* 夜でも赤さが見えるよう少し光らせる */
    if (posing) {
    this.head.rotation.z = hotK * Math.sin(v.t * 30) * 0.12;
    /* もぐもぐ：食べてから0.8秒ほど、頭を上下に縮めたり戻したりして小さくうなずく */
    var ck = v.phase === "ride" && v.chew != null ? Math.max(0, 1 - v.chew / 0.8) : 0;
    var cw = Math.abs(Math.sin(v.chew * 17)) * ck;
    this.head.scale.set(1 + cw * 0.05, 1 - cw * 0.09, 1 + cw * 0.05);
    this.head.position.y = 1.2 - cw * 0.012;
    this.head.rotation.z += Math.sin(v.chew * 17) * ck * 0.06;
    this.head.rotation.x = 0;
    /* 飲み干すあいだは頭を反らして、ごくごくと小さくうなずく */
    this.head.rotation.z += gulp * (0.22 + Math.max(0, Math.sin(v.t * 14)) * 0.07);
    }

    /* 鍋が飛ぶ */
    if (v.phase === "fall" && !this.potFlying) {
      this.potFlying = { vx: (th > 0 ? 1.4 : -1.1) + v.v * 0.6, vy: 1.2, spin: th > 0 ? -5 : 5 };
      this.scene.attach(this.pot);
      this.fallWorld = this.makeFallWorld();
      this.ragStart(v);
      this.spillStart(v, this.potFlying);
    }
    if (v.phase !== "fall" && this.potFlying) {
      this.spillReset();
      this.ragReset();
      this.fallWorld = null;
      this.potFlying = null;
      this.rig.attach(this.pot);
      this.pot.position.set(POT.x, POT.y, -0.02);
      this.pot.rotation.set(0, 0, 0);
      this.pot.scale.setScalar(1.3);
    }
    if (this.potFlying) {
      var fl = this.potFlying;
      if (this.pot.position.y > 0.01 || fl.vy > 0) {
        fl.vy -= 9.8 * dt;
        this.pot.position.x += fl.vx * dt;
        this.pot.position.y = Math.max(0.01, this.pot.position.y + fl.vy * dt);
        this.pot.rotation.z += fl.spin * dt;
        if (this.pot.position.y <= 0.01) { fl.vy = 0; fl.vx = 0; fl.spin = 0; this.pot.rotation.z = Math.PI * Math.round(this.pot.rotation.z / Math.PI); }
      }
    }

    this.spillStep(dt);
    this.ragStep();

    /* 湯気 */
    var heat = v.phase === "fall" ? 0.2 : 0.35 + 0.65 * (1 - v.eaten / v.N);
    if (v.phase === "done") heat = 0.1;
    this.steamAcc = (this.steamAcc || 0) + dt * 14 * heat;
    var pw = new T.Vector3();
    this.pot.getWorldPosition(pw);
    while (this.steamAcc > 1) {
      this.steamAcc -= 1;
      var sp = pw.clone().add(new T.Vector3((Math.random() - 0.5) * 0.18, 0.12, (Math.random() - 0.5) * 0.18));
      this.puff(sp, (Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.2, 0.12, 1.4 + Math.random() * 0.6, 0.35);
    }
    if (v.puff) {
      var mw = new T.Vector3(MOUTH.x + 0.03, MOUTH.y, MOUTH.z);
      this.rig.localToWorld(mw);
      for (var q = 0; q < 6; q++) this.puff(mw, 0.5 + Math.random() * 0.4, 0.15 + Math.random() * 0.2, 0.08, 0.7 + Math.random() * 0.3, 0.6);
    }
    this.puffs.forEach(function (q) {
      if (!q.s.visible) return;
      q.life -= dt;
      if (q.life <= 0) { q.s.visible = false; return; }
      var k = 1 - q.life / q.max;
      q.s.position.x += q.vx * dt;
      q.s.position.y += q.vy * dt;
      q.vy *= 1 - dt * 0.5;
      var sz = q.size * (1 + k * 2.5);
      q.s.scale.set(sz, sz, 1);
      q.s.material.opacity = q.op * Math.sin(Math.PI * Math.min(1, k * 1.3));
    });

    /* 雪 */
    this.snowT += dt;
    var arr = this.snow.geometry.attributes.position.array;
    for (var i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * (0.45 + (i % 7) * 0.05);
      arr[i] += Math.sin(this.snowT + i) * dt * 0.1;
      if (arr[i + 1] < 0) arr[i + 1] += 6;
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
    this.snow.position.x = Math.floor(cx / 14) * 14;
    for (i = 0; i < arr.length; i += 3) {
      var wx = arr[i] + this.snow.position.x;
      if (wx < cx - 7) arr[i] += 14; else if (wx > cx + 7) arr[i] -= 14;
    }

    this.warm.intensity = 0.4 + 1.4 * heat;
    this.renderer.render(this.scene, this.camera);
    return this.canvas;
  };

  /* 2本の骨で a から b へ届く中間の関節。bend=+1 は前へ、-1 は後ろ・下へ曲げる */
  function ik2(a, b, l1, l2, bend) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var d = Math.sqrt(dx * dx + dy * dy);
    var dd = Math.min(d, l1 + l2 - 0.001);
    var ang = Math.atan2(dy, dx);
    var cosA = (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd);
    var A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    var t = ang + bend * A;
    return [a[0] + Math.cos(t) * l1, a[1] + Math.sin(t) * l1, (a[2] + b[2]) / 2];
  }
  function lerp3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function ease(k) { return k * k * (3 - 2 * k); }

  NabeScene.N = FOODS.length;
  global.NabeScene = NabeScene;
})(window);
