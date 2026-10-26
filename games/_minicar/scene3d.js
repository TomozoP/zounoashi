/* 立体の場面（three.js）。どこまでも続く机の道と、トラップと、ミニカー。
   長さの単位は 1 = 100mm。車は -z の向きへ走る。道の上面が y=0、幅は 2.6。
   トラップの動き（pose）と当たりはゲーム側（index.html）で決め、ここは見た目だけ。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var ROAD = 2.6, THICK = 0.3;

  /* 配色の候補。確認用に URL の ?pal=1 などで切り替える */
  var PALS = [
    { bg: 0x9fc4dc, road: 0xffffff, side: 0x7a4c2a, frame: 0xf2c230, red: 0xc8322a, orange: 0xe8792a, steel: 0x47505c, dark: 0x2a2e35, box: 0x8a949f },
    /* 1 ポップ：濃い空色に、原色の黄・赤・青 */
    { bg: 0x46c8ff, road: 0xffe2c0, side: 0x9a5a2a, frame: 0xffd400, red: 0xff2d55, orange: 0xff8a00, steel: 0x3b5bdb, dark: 0x1f2a5c, box: 0x4dabf7, light: 1.15 },
    /* 2 おもちゃ：ピンクの背景、ミントの道、パステル */
    { bg: 0xffcfe6, road: 0x9be8d0, plain: true, side: 0x4fbf9f, frame: 0xffe066, red: 0xff6b8a, orange: 0xffa94d, steel: 0x8e7cf0, dark: 0x4b3f8a, box: 0xb197fc, light: 1.15 },
    /* 3 レース場：オレンジのプラ道（おもちゃのコース）に青と黄緑 */
    { bg: 0xbfe9ff, road: 0xff7a1a, plain: true, side: 0xd25a00, frame: 0x1e88ff, red: 0xff3040, orange: 0x7ed321, steel: 0x2f3640, dark: 0x1b1f24, box: 0x74c0fc, light: 1.1 },
    /* 4 夕焼け：橙の空、木の道、青緑・紫・桃 */
    { bg: 0xffa36c, road: 0xffd2a8, side: 0x7a4428, frame: 0x2ec4b6, red: 0x9b5de5, orange: 0xf15bb5, steel: 0x3a3a6a, dark: 0x24243e, box: 0x5fd3c8 }
  ];
  var PAL = PALS[+((/[?&]pal=(\d)/.exec(global.location.search) || [])[1] || 0)] || PALS[0];

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces" }, camera: { fov: 54, near: 0.1, far: 80 }, finish: { vignette: 0.28, grain: 0.02 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(PAL.bg);     /* 暗い金属や黄・橙・赤のトラップが溶けない明るさ */
    this.scene.fog = new T.Fog(PAL.bg, 24, 50);
    var L = this.lights = Z3.lights(this.scene, { shadows: true, shadowSize: 7, scale: PAL.light || 1 });
    this.scene.add(L.key.target);

    /* 机の木目 */
    var wood = Z3.canvasTex(256, 512, function (g, w, h) {
      g.fillStyle = "#b07a48"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      for (var i = 0; i < 50; i++) {
        var x = r() * w;
        g.strokeStyle = "rgba(" + (r() < 0.5 ? "80,45,20," : "210,160,110,") + (0.08 + r() * 0.12) + ")";
        g.lineWidth = 1 + r() * 4;
        g.beginPath(); g.moveTo(x, 0);
        for (var y = 0; y <= h; y += 64) g.lineTo(x + Math.sin(y * 0.01 + i) * 6, y);
        g.stroke();
      }
    });
    var side = Z3.std(PAL.side);
    var top = PAL.plain ? Z3.std(PAL.road, { roughness: 0.35 }) : Z3.std(PAL.road, { map: wood, roughness: 0.55 });
    this.roadMat = [side, side, top, side, side, side];
    /* 注意の縞（黄と黒） */
    var stripe = Z3.canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = "#f2c230"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#1b1b1b";
      for (var i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 48, 0); g.lineTo(i * 48 + 24, 0); g.lineTo(i * 48 + 24 + h, h); g.lineTo(i * 48 + h, h); g.fill(); }
    });
    this.M = {
      steel: Z3.std(PAL.steel, { roughness: 0.4, metalness: 0.4 }),
      dark: Z3.std(PAL.dark, { roughness: 0.5, metalness: 0.3 }),
      yellow: Z3.std(PAL.frame, { roughness: 0.45 }),
      red: Z3.std(PAL.red, { roughness: 0.4, metalness: 0.2 }),
      orange: Z3.std(PAL.orange, { roughness: 0.45 }),
      chrome: Z3.std(0xd0d4da, { roughness: 0.2, metalness: 0.9 }),
      box: Z3.std(PAL.box, { roughness: 0.5, metalness: 0.3 }),
      wood2: Z3.std(PAL.side),
      stripe: Z3.std(0xffffff, { map: stripe, roughness: 0.5 })
    };

    this.add(roadBox(this, 7, 0));                     /* スタートの台 */
    this.built = [];                                   /* 作ったトラップ（トラップの物ごと覚える） */
    this.car = makeCar();
    this.scene.add(this.car.group);
  }

  GameScene.prototype.add = function (o) { this.scene.add(o); return o; };

  /* z0 から z1（z0 > z1）までの道の板 */
  function roadBox(self, z0, z1) {
    var m = new T.Mesh(new T.BoxGeometry(ROAD, THICK, z0 - z1), self.roadMat);
    m.position.set(0, -THICK / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    return m;
  }
  function mesh(geo, mat, x, y, z, parent) {
    var m = new T.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  /* 門の形の枠（左右の柱と上の梁） */
  function frame(self, parent, h) {
    var g = parent.tall = new T.Group();
    parent.add(g);
    var M = self.M;
    /* 手前（カメラ側）の柱は置かない。横から見たときにトラップを隠すため、奥の柱からの片持ちにする */
    mesh(new T.BoxGeometry(0.5, 0.06, 0.5), M.dark, -1.5, 0.03, 0, g);          /* 足もとの板 */
    mesh(new T.BoxGeometry(0.22, h + 0.11, 0.22), M.yellow, -1.5, (h + 0.11) / 2, 0, g);
    mesh(new T.BoxGeometry(2.1, 0.22, 0.3), M.yellow, -0.55, h, 0, g);
    var brace = mesh(new T.BoxGeometry(0.1, 0.9, 0.1), M.yellow, -1.2, h - 0.33, 0, g);   /* 斜めの支え */
    brace.rotation.z = -Math.PI / 4;
    [-1.5, 0.4].forEach(function (x) {                                            /* ボルト */
      mesh(new T.CylinderGeometry(0.035, 0.035, 0.32, 8), M.dark, x, h, 0, g).rotation.x = Math.PI / 2;
    });
  }

  /* トラップ1つ分（道の板ごと）。動く部品は g.part に入れる */
  function buildTrap(self, tr) {
    var g = new T.Group(), M = self.M;
    g.position.z = tr.zc;
    if (tr.kind === "door") {
      var hole = 0.7;
      var a = roadBox(self, tr.z0, tr.zc + hole), b = roadBox(self, tr.zc - hole, tr.z1);
      a.position.z -= tr.zc; b.position.z -= tr.zc; g.add(a); g.add(b);
      /* 穴のふち（金属の枠）と、蝶番の軸 */
      [-1, 1].forEach(function (k) {
        mesh(new T.BoxGeometry(ROAD, 0.03, 0.08), M.dark, 0, 0.005, k * (hole + 0.04), g);
        mesh(new T.BoxGeometry(0.08, THICK, hole * 2), M.dark, k * (ROAD / 2 - 0.04), -THICK / 2, 0, g);
        mesh(new T.CylinderGeometry(0.03, 0.03, hole * 2, 8), M.steel, k * (ROAD / 2 - 0.02), -0.02, 0, g).rotation.x = Math.PI / 2;
      });
      /* 外側に蝶番がある2枚の扉。開くと下へ垂れる */
      g.part = [];
      [-1, 1].forEach(function (s) {
        var hinge = new T.Group();
        hinge.position.set(s * ROAD / 2, -0.02, 0);
        mesh(new T.BoxGeometry(ROAD / 2, 0.04, hole * 2), M.stripe, -s * ROAD / 4, 0, 0, hinge);
        hinge.userData.s = s;
        g.add(hinge); g.part.push(hinge);
      });
    } else {
      var road = roadBox(self, tr.z0, tr.z1); road.position.z -= tr.zc; g.add(road);
    }
    if ((tr.k + 1) % 10 === 0) {                       /* ステージのゴール：市松模様の線 */
      if (!self.goalTex) self.goalTex = Z3.canvasTex(128, 32, function (c, w, h) {
        for (var i = 0; i < 16; i++) for (var j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? "#111" : "#f4f4f4"; c.fillRect(i * 8, j * 8, 8, 8); }
      });
      var goal = new T.Mesh(new T.PlaneGeometry(ROAD, 0.65), Z3.std(0xffffff, { map: self.goalTex }));
      goal.rotation.x = -Math.PI / 2; goal.position.set(0, 0.006, tr.z1 - tr.zc + 0.33); goal.receiveShadow = true;
      g.add(goal);
    }
    if (tr.kind === "press") {
      frame(self, g, 2.6);
      /* 梁の上の油圧シリンダー。押す棒はいつもこの筒の中に収まる */
      mesh(new T.CylinderGeometry(0.2, 0.2, 1.7, 14), M.red, 0, 2.6 + 0.85 + 0.11, 0, g);
      mesh(new T.CylinderGeometry(0.24, 0.24, 0.08, 14), M.dark, 0, 2.6 + 1.75, 0, g);
      var blk = new T.Group();
      mesh(new T.BoxGeometry(1.9, 0.8, 0.9), M.steel, 0, 0.5, 0, blk);
      mesh(new T.BoxGeometry(2.0, 0.1, 1.0), M.dark, 0, 0.95, 0, blk);          /* 上のふち */
      mesh(new T.BoxGeometry(1.94, 0.12, 0.94), M.stripe, 0, 0.06, 0, blk);     /* 下の縞（押す面） */
      mesh(new T.CylinderGeometry(0.1, 0.1, 1.9, 12), M.chrome, 0, 1.95, 0, blk);
      g.add(blk); g.part = blk;
    } else if (tr.kind === "hammer") {
      frame(self, g, 2.95);
      [-1, 1].forEach(function (k) { mesh(new T.BoxGeometry(0.2, 0.3, 0.04), M.dark, 0, 2.72, k * 0.17, g); });   /* 軸受けの板 */
      var piv = new T.Group();
      piv.position.set(0, 2.72, 0);
      mesh(new T.CylinderGeometry(0.08, 0.08, 0.42, 12), M.chrome, 0, 0, 0, piv).rotation.x = Math.PI / 2;   /* 軸 */
      mesh(new T.CylinderGeometry(0.045, 0.045, 2.2, 8), M.steel, 0, -1.1, 0, piv);                       /* 柄 */
      /* 槌の頭：振れる向き（左右）に軸をもつ太い円柱と、両端の金具 */
      var head = mesh(new T.CylinderGeometry(0.26, 0.26, 0.7, 18), M.red, 0, -2.35, 0, piv);
      head.rotation.z = Math.PI / 2;
      [-1, 1].forEach(function (k) {
        mesh(new T.CylinderGeometry(0.28, 0.28, 0.06, 18), M.dark, k * 0.36, -2.35, 0, piv).rotation.z = Math.PI / 2;
      });
      mesh(new T.CylinderGeometry(0.07, 0.07, 0.1, 10), M.dark, 0, -2.06, 0, piv);
      g.add(piv); g.part = piv;
    } else if (tr.kind === "spinner") {
      mesh(new T.CylinderGeometry(0.3, 0.32, 0.06, 18), M.dark, -1.45, 0.03, 0, g);     /* 台座 */
      mesh(new T.CylinderGeometry(0.15, 0.18, 0.42, 16), M.yellow, -1.45, 0.24, 0, g);  /* 回る軸の箱 */
      var arm = new T.Group();
      arm.position.set(-1.45, 0.2, 0);
      mesh(new T.CylinderGeometry(0.17, 0.17, 0.12, 16), M.dark, 0, 0.0, 0, arm);        /* 軸の頭 */
      mesh(new T.BoxGeometry(2.7, 0.12, 0.13), M.stripe, 1.45, 0, 0, arm);              /* 縞の腕 */
      mesh(new T.CylinderGeometry(0.09, 0.09, 0.16, 12), M.dark, 2.8, 0, 0, arm);        /* 先のゴム */
      g.add(arm); g.part = arm;
    } else if (tr.kind === "pusher") {
      g.part = [];
      [-1, 1].forEach(function (s) {
        /* 横向きの油圧プレス：道の外の台に寝かせたシリンダーから、棒が押し板を押し出す */
        mesh(new T.BoxGeometry(1.6, THICK, 1.1), M.wood2, s * 2.1, -THICK / 2, 0, g);           /* 台 */
        mesh(new T.BoxGeometry(1.2, 0.12, 0.5), M.dark, s * 2.12, 0.06, 0, g);                   /* 取り付け台 */
        [1.72, 2.55].forEach(function (x) { mesh(new T.BoxGeometry(0.08, 0.3, 0.46), M.dark, s * x, 0.2, 0, g); });
        var cyl = mesh(new T.CylinderGeometry(0.19, 0.19, 1.25, 16), M.red, s * 2.125, 0.3, 0, g);  /* シリンダー */
        cyl.rotation.z = Math.PI / 2;
        var cap = mesh(new T.CylinderGeometry(0.22, 0.22, 0.06, 16), M.dark, s * 1.5, 0.3, 0, g);
        cap.rotation.z = Math.PI / 2;
        var wall = new T.Group();                       /* 原点は押し板の内側の面 */
        mesh(new T.BoxGeometry(0.26, 0.5, 0.8), M.orange, s * 0.13, 0.27, 0, wall);              /* 押し板 */
        mesh(new T.BoxGeometry(0.03, 0.5, 0.82), M.stripe, s * 0.0, 0.27, 0, wall);              /* 押す面の縞 */
        mesh(new T.BoxGeometry(0.3, 0.06, 0.84), M.dark, s * 0.13, 0.53, 0, wall);               /* 上のふち */
        var rod = mesh(new T.CylinderGeometry(0.07, 0.07, 1.2, 12), M.chrome, s * (0.26 + 0.6), 0.3, 0, wall);   /* 閉じても開いてもシリンダーの中に残る長さ */
        rod.rotation.z = Math.PI / 2;
        wall.userData.s = s;
        g.add(wall); g.part.push(wall);
      });
    }
    return g;
  }
  function poseTrap(g, tr) {
    if (!g.part) return;                               /* ゴールの先の道など、動く部品がないもの */
    var p = tr.pose;
    if (tr.kind === "press") g.part.position.y = 0.02 + p * 1.5;
    else if (tr.kind === "hammer") g.part.rotation.z = p;
    else if (tr.kind === "spinner") g.part.rotation.y = -p;
    else if (tr.kind === "pusher") g.part.forEach(function (w) { w.position.x = w.userData.s * (1.15 - p * 1.0); });
    else g.part.forEach(function (h) { h.rotation.z = -h.userData.s * p * 1.45; });
  }

  /* ミニカー。原点は重心の真下（道の上面）。長さ0.8 = 80mm */
  function makeCar() {
    var g = new T.Group(), body = new T.Group();
    g.add(body);
    var red = Z3.std(0xd8262c, { roughness: 0.3, metalness: 0.2 });
    var dark = Z3.std(0x1d2633, { roughness: 0.15, metalness: 0.4 });
    var chrome = Z3.std(0xd0d4da, { roughness: 0.25, metalness: 0.9 });
    function box(w, h, l, m, x, y, z) {
      var b = new T.Mesh(new T.BoxGeometry(w, h, l), m);
      b.position.set(x, y, z); b.castShadow = true; body.add(b); return b;
    }
    var white = Z3.std(0xf6f3ea, { roughness: 0.35 });
    var black = Z3.std(0x16181c, { roughness: 0.6 });
    /* 上がすぼまった箱（キャビン・ボンネットの丸み代わり） */
    function taper(w, h, l, m, x, y, z, kx, kz, dz) {
      var geo = new T.BoxGeometry(w, h, l), a = geo.attributes.position;
      for (var i = 0; i < a.count; i++) if (a.getY(i) > 0) { a.setX(i, a.getX(i) * kx); a.setZ(i, a.getZ(i) * kz + (dz || 0)); }
      geo.computeVertexNormals();
      var b = new T.Mesh(geo, m); b.position.set(x, y, z); b.castShadow = true; body.add(b); return b;
    }
    taper(0.4, 0.1, 0.8, red, 0, 0.12, 0, 0.96, 0.97);          /* 車体の下半分 */
    taper(0.38, 0.05, 0.78, red, 0, 0.195, 0, 0.92, 0.94);      /* 肩の丸み */
    taper(0.34, 0.11, 0.4, dark, 0, 0.275, 0.05, 0.8, 0.62, 0.02); /* 窓（前後に傾いたガラス） */
    taper(0.27, 0.025, 0.25, red, 0, 0.342, 0.06, 0.95, 0.9);   /* 屋根 */
    /* 白いストライプ（ボンネット・屋根・トランク） */
    box(0.07, 0.006, 0.2, white, -0.045, 0.221, -0.27); box(0.07, 0.006, 0.2, white, 0.045, 0.221, -0.27);
    box(0.05, 0.006, 0.22, white, -0.035, 0.356, 0.06); box(0.05, 0.006, 0.22, white, 0.035, 0.356, 0.06);
    box(0.07, 0.006, 0.12, white, -0.045, 0.221, 0.33); box(0.07, 0.006, 0.12, white, 0.045, 0.221, 0.33);
    /* 横のゼッケン */
    [-1, 1].forEach(function (k) {
      var disc = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.006, 16), white);
      disc.rotation.z = Math.PI / 2; disc.position.set(k * 0.2, 0.15, -0.02); body.add(disc);
      box(0.006, 0.05, 0.012, black, k * 0.204, 0.15, -0.02);
      box(0.03, 0.015, 0.03, red, k * 0.18, 0.25, -0.15);       /* ドアミラー */
    });
    /* 前：グリル・ライト・バンパー */
    box(0.2, 0.05, 0.01, black, 0, 0.14, -0.4);
    var lamp = Z3.std(0xfff3c0, { emissive: 0x8a7d40 });
    var tail = Z3.std(0xff3a2a, { emissive: 0x801010 });
    [-1, 1].forEach(function (k) {
      var hl = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.015, 12), lamp);
      hl.rotation.x = Math.PI / 2; hl.position.set(k * 0.14, 0.15, -0.402); body.add(hl);
      box(0.08, 0.035, 0.01, tail, k * 0.13, 0.16, 0.4);
    });
    box(0.42, 0.04, 0.04, chrome, 0, 0.09, -0.41);     /* バンパー */
    box(0.42, 0.04, 0.04, chrome, 0, 0.09, 0.41);
    var pipe = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.06, 8), chrome);   /* マフラー */
    pipe.rotation.x = Math.PI / 2; pipe.position.set(-0.12, 0.07, 0.42); body.add(pipe);
    /* タイヤの上の黒いふち */
    [[-0.2, -0.27], [0.2, -0.27], [-0.2, 0.27], [0.2, 0.27]].forEach(function (p) {
      box(0.03, 0.03, 0.2, black, p[0] > 0 ? 0.205 : -0.205, 0.19, p[1]);
    });
    var tire = Z3.std(0x18181a, { roughness: 0.9 }), hub = Z3.std(0xbfc3c8, { roughness: 0.3, metalness: 0.8 });
    var wheels = [];
    [[-0.2, -0.27], [0.2, -0.27], [-0.2, 0.27], [0.2, 0.27]].forEach(function (p) {
      var w = new T.Group();
      var t = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.07, 16), tire);
      t.rotation.z = Math.PI / 2; t.castShadow = true; w.add(t);
      var h = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.075, 8), hub);
      h.rotation.z = Math.PI / 2; w.add(h);
      w.add(new T.Mesh(new T.BoxGeometry(0.076, 0.02, 0.12), hub));
      w.position.set(p[0], 0.09, p[1]);
      body.add(w); wheels.push(w);
    });
    /* お尻のゼンマイのネジ（蝶の形のつまみ）。z の軸まわりに回る */
    var brass = Z3.std(0xd9a93a, { roughness: 0.3, metalness: 0.85 });
    var key = new T.Group();
    key.position.set(0, 0.17, 0.43);
    var shaft = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.14, 8), brass);
    shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.06; shaft.castShadow = true; key.add(shaft);
    [-1, 1].forEach(function (k) {
      var lobe = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.022, 16), brass);
      lobe.rotation.x = Math.PI / 2;                    /* 円盤の面をカメラ（後ろ）へ向ける */
      lobe.scale.set(1, 1, 1);
      lobe.position.set(k * 0.085, 0, 0.13);
      lobe.castShadow = true; key.add(lobe);
    });
    body.add(key);
    return { group: g, body: body, wheels: wheels, key: key };
  }

  GameScene.prototype.reset = function () {};

  /* s: { x, y, z, pitch, roll, yaw, wheel, camZ, traps } */
  GameScene.prototype.sync = function (s) {
    var c = this.car;
    c.group.position.set(s.x, s.y, s.z);
    c.body.rotation.set(-s.pitch, s.yaw, s.roll);
    c.body.scale.set(s.sx, s.sy, s.sz);                /* 潰れ・へこみ */
    for (var i = 0; i < 4; i++) c.wheels[i].rotation.x = s.wheel;
    c.key.rotation.z = s.key || 0;

    /* 近くのトラップだけ作って動かす。遠くなったものは捨てる */
    var next = [];
    for (i = 0; i < s.traps.length; i++) {
      var tr = s.traps[i];
      if (tr.z1 > s.camZ + 10 || tr.z0 < s.camZ - 50) continue;
      var b = null;
      for (var j = 0; j < this.built.length; j++) if (this.built[j].tr === tr) b = this.built[j];
      if (!b) { b = { tr: tr, g: buildTrap(this, tr) }; this.scene.add(b.g); }
      poseTrap(b.g, tr);
      next.push(b);
    }
    for (j = 0; j < this.built.length; j++) if (next.indexOf(this.built[j]) < 0) this.scene.remove(this.built[j].g);
    this.built = next;

    /* 車と、次にくぐるトラップが両方入るように追いかける（右うしろのななめ上から）。
       間が開くほど引いて、車は画面の下寄り・トラップは上寄りに映る */
    var ahead = s.ahead == null ? s.camZ - 4 : Math.max(s.camZ - 9, Math.min(s.camZ - 2.5, s.ahead));
    var mid = s.camZ * 0.62 + ahead * 0.38, span = s.camZ - ahead;
    if (this.cam == null) this.cam = { mid: mid, span: span };
    this.cam.mid += (mid - this.cam.mid) * 0.08;      /* 急に跳ばないように少しずつ寄せる */
    this.cam.span += (span - this.cam.span) * 0.05;
    var m = this.cam.mid, d = 2.2 + this.cam.span * 0.75;
    this.camera.position.set(d * 0.75, d * 0.95, m + d * 0.95);
    this.camera.lookAt(0, 0.2, m);
    var key = this.lights.key;
    key.position.set(-4, 8, s.camZ + 2);
    key.target.position.set(0, 0, s.camZ - 4);
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
