/* ちくわかちくわぶかゲームの立体の場面（three.js）。games/three-base.js の Z3 を土台にする。
   ゲーム側は sync(状態) と draw(ctx, W, H) を呼ぶ。当たり・点数・時間はゲーム側。ここは見た目だけ。

   ちくわ・ちくわぶは、断面の形（丸／歯車）に穴をあけて長さ方向へ押し出して作る。
   焼き色やざらつきは2Dで描いた絵を貼る（横＝長さ方向、縦＝ぐるり一周）。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var CREAM_W = "#f1e2bb", CREAM_B = "#efe7d2";

  /* 断面の形。o.shape: "circle" 丸 / "gear" n個の山（depth で山の深さ）/ "hex" 六角 */
  function outline(o) {
    var pts = [], n = o.shape === "hex" ? 6 : o.shape === "gear" ? 96 : 48, R = o.R;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, r = R;
      if (o.shape === "gear") r = R * (1 - o.depth * (0.5 - 0.5 * Math.cos(a * o.n)));
      pts.push(new T.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    return pts;
  }

  /* 押し出した筒。o: { shape, n, depth, R, L, hole（半径の割合、0で穴なし）, slice（輪切りで外側を焼き色に） } */
  function tubeGeo(o) {
    var shape = new T.Shape(outline(o)), R = o.R, L = o.L, hr = R * (o.hole || 0);
    if (hr > 0) {
      var hole = new T.Path();
      hole.absarc(0, 0, hr, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    var bev = o.bevel != null ? o.bevel : o.slice ? 0.015 : Math.min(0.05, R * 0.12);
    var g = new T.ExtrudeGeometry(shape, { depth: L, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 2, curveSegments: 24, steps: 1 });
    g.translate(0, 0, -L / 2);
    /* 貼り絵の位置を自分で決める。穴の内側は u=0（端の色）、外側は u=長さ方向、v=ぐるり一周。断面は別の材質 */
    var pos = g.attributes.position, uv = g.attributes.uv, mid = hr > 0 ? (R + hr) / 2 : -1;
    var caps = g.groups[0] ? g.groups[0].count : 0;
    for (var t = 0; t < pos.count; t += 3) {
      var vs = [];
      for (var k = 0; k < 3; k++) {
        var i = t + k, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        var inner = Math.sqrt(x * x + y * y) < mid;
        var u = (i < caps || inner) ? 0 : (o.slice ? 0.5 : Math.min(1, Math.max(0, z / L + 0.5)));
        var v = i < caps ? (x / R + 1) / 2 : Math.atan2(y, x) / (Math.PI * 2) + 0.5;
        if (i < caps) u = (y / R + 1) / 2;
        vs.push([u, v]);
      }
      /* 角度の継ぎ目をまたぐ三角は、小さい側に1を足して絵がつぶれないようにする */
      var vmax = Math.max(vs[0][1], vs[1][1], vs[2][1]);
      for (k = 0; k < 3; k++) {
        if (t >= caps && vmax - vs[k][1] > 0.5) vs[k][1] += 1;
        uv.setXY(t + k, vs[k][0], vs[k][1]);
      }
    }
    uv.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }

  /* ちくわの焼き色の絵。両端は白く、まん中にまだら。grill で焼きの濃さ */
  function grillTex(seed, grill) {
    return Z3.canvasTex(256, 256, function (g, w, h) {
      var r = Z3.rng(seed);
      g.fillStyle = CREAM_W; g.fillRect(0, 0, w, h);
      var gr = g.createLinearGradient(0, 0, w, 0), c = "rgba(196,124,58,";
      gr.addColorStop(0, c + "0)"); gr.addColorStop(0.1, c + (0.95 * grill) + ")");
      gr.addColorStop(0.9, c + (0.95 * grill) + ")"); gr.addColorStop(1, c + "0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 160; i++) {
        var x = w * 0.08 + r() * w * 0.84, y = r() * h;
        var sz = 3 + r() * 9;
        g.fillStyle = "rgba(" + (120 + r() * 40 | 0) + "," + (70 + r() * 25 | 0) + ",30," + (0.2 + r() * 0.4) * grill + ")";
        g.beginPath(); g.ellipse(x, y, sz * (1 + r() * 0.6), sz, 0, 0, Math.PI * 2); g.fill();
      }
      for (i = 0; i < 300; i++) {
        g.fillStyle = "rgba(245,222,170," + (0.2 + r() * 0.35) + ")";
        g.fillRect(w * 0.06 + r() * w * 0.88, r() * h, 2, 1.5);
      }
    });
  }
  /* ちくわぶの小麦のざらつき */
  function wheatTex(seed) {
    return Z3.canvasTex(128, 128, function (g, w, h) {
      var r = Z3.rng(seed);
      g.fillStyle = CREAM_B; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 400; i++) {
        g.fillStyle = "rgba(" + (r() < 0.5 ? "205,186,146," : "255,252,242,") + (0.2 + r() * 0.3) + ")";
        g.fillRect(r() * w, r() * h, 1.5, 1.5);
      }
    });
  }

  /* ちくわぶの縦の筋（仮面男の右半身） */
  function ridgeTex() {
    return Z3.canvasTex(256, 256, function (g, w, h) {
      var r = Z3.rng(77);
      g.fillStyle = CREAM_B; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 6; i++) {
        var x = (i + 0.5) * w / 6;
        g.fillStyle = "rgba(150,128,90,.55)"; g.fillRect(x - 5, 0, 10, h);
        g.fillStyle = "rgba(255,252,240,.8)"; g.fillRect(x + 6, 0, 5, h);
      }
      for (i = 0; i < 500; i++) { g.fillStyle = "rgba(205,186,146," + (0.2 + r() * 0.3) + ")"; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    });
  }

  function woodTex() {
    return Z3.canvasTex(512, 512, function (g, w, h) {
      var r = Z3.rng(9);
      g.fillStyle = "#6b4426"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 60; i++) {
        var y = r() * h;
        g.strokeStyle = "rgba(" + (r() < 0.5 ? "40,22,10," : "150,100,60,") + (0.12 + r() * 0.18) + ")";
        g.lineWidth = 1 + r() * 4;
        g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 30, w * 0.7, y + (r() - 0.5) * 30, w, y + (r() - 0.5) * 16);
        g.stroke();
      }
    });
  }

  /* それ以外の筒状のもの。貼り絵は横＝長さ方向、縦＝ぐるり一周 */
  function speck(g, w, h, n, col, seed) {
    var r = Z3.rng(seed);
    for (var i = 0; i < n; i++) { g.fillStyle = col(r); g.fillRect(r() * w, r() * h, 1.5 + r() * 1.5, 1.5 + r()); }
  }
  var OTHER = {
    /* 竹 */
    bamboo: { R: 0.44, L: 2.7, hole: 0.78, cap: 0xe9e2b8, rough: 0.45, paint: function (g, w, h) {
      var r = Z3.rng(21);
      g.fillStyle = "#6e9a3c"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 40; i++) { g.fillStyle = "rgba(" + (r() < 0.5 ? "40,80,20," : "150,190,90,") + (0.15 + r() * 0.2) + ")"; g.fillRect(0, r() * h, w, 1 + r() * 2); }
      [0.34, 0.74].forEach(function (x) {
        g.fillStyle = "rgba(60,90,30,.5)"; g.fillRect(w * x - 5, 0, 10, h);
        g.fillStyle = "rgba(220,230,170,.8)"; g.fillRect(w * x - 1, 0, 3, h);
      });
    } },
    /* トイレットペーパーの芯 */
    core: { R: 0.52, L: 1.05, hole: 0.93, cap: 0xa87b4f, rough: 0.95, paint: function (g, w, h) {
      g.fillStyle = "#c69766"; g.fillRect(0, 0, w, h);
      speck(g, w, h, 500, function (r) { return "rgba(120,80,40," + (0.1 + r() * 0.15) + ")"; }, 4);
      g.strokeStyle = "rgba(110,70,35,.55)"; g.lineWidth = 2;
      for (var k = -2; k < 3; k++) { g.beginPath(); g.moveTo(k * w * 0.5, 0); g.lineTo(k * w * 0.5 + w * 0.9, h); g.stroke(); }
    } },
    /* 白い塩ビ管 */
    pvc: { R: 0.44, L: 2.7, hole: 0.82, cap: 0xdcdad2, rough: 0.35, paint: function (g, w, h) {
      g.fillStyle = "#ebe9e3"; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(90,90,100,.6)";
      for (var x = 20; x < w - 30; x += 14) g.fillRect(x, h * 0.25, 9, 4);
    } },
    /* リガトーニ（筋の入ったパスタ） */
    rigatoni: { shape: "gear", n: 14, depth: 0.07, R: 0.36, L: 1.3, hole: 0.68, cap: 0xe8c26c, rough: 0.6, paint: function (g, w, h) {
      g.fillStyle = "#e7bf69"; g.fillRect(0, 0, w, h);
      speck(g, w, h, 400, function (r) { return "rgba(" + (r() < 0.5 ? "190,140,60," : "255,230,160,") + (0.2 + r() * 0.3) + ")"; }, 8);
    } },
    /* ストロー */
    straw: { R: 0.13, L: 3.4, hole: 0.82, cap: 0xffffff, rough: 0.3, paint: function (g, w, h) {
      g.fillStyle = "#fafafa"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#e0453a"; g.lineWidth = 14;
      for (var k = -4; k < 12; k++) { g.beginPath(); g.moveTo(k * 40, 0); g.lineTo(k * 40 + 80, h); g.stroke(); }
    } },
    /* 乾電池 */
    battery: { R: 0.3, L: 1.5, hole: 0, cap: 0xc8c8cc, capMetal: 0.8, rough: 0.35, paint: function (g, w, h) {
      g.fillStyle = "#1c1c20"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#d4a73c"; g.fillRect(w * 0.68, 0, w * 0.3, h);
      g.fillStyle = "#c8c8cc"; g.fillRect(0, 0, w * 0.03, h); g.fillRect(w * 0.97, 0, w * 0.03, h);
      g.fillStyle = "rgba(255,255,255,.75)";
      for (var x = w * 0.12; x < w * 0.6; x += 16) g.fillRect(x, h * 0.45, 10, 10);
    } },
    /* 鉛筆 */
    pencil: { shape: "hex", R: 0.28, L: 3.0, hole: 0, cap: 0xe6c38c, rough: 0.45, paint: function (g, w, h) {
      g.fillStyle = "#2f6b3c"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#d8b24a"; g.fillRect(w * 0.9, 0, 6, h);
      g.fillStyle = "rgba(216,178,74,.9)";
      for (var x = w * 0.6; x < w * 0.85; x += 10) g.fillRect(x, h * 0.05, 6, h * 0.08);
    } },
    /* ねぎ */
    negi: { R: 0.3, L: 3.3, hole: 0, cap: 0xeef2e0, rough: 0.5, paint: function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, "#f4f4ea"); gr.addColorStop(0.55, "#eef0d8"); gr.addColorStop(0.75, "#a9c86a"); gr.addColorStop(1, "#4f8a32");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      var r = Z3.rng(31);
      for (var i = 0; i < 30; i++) { g.fillStyle = "rgba(160,170,120," + (0.1 + r() * 0.15) + ")"; g.fillRect(0, r() * h, w, 1); }
    } },
    /* きりたんぽ */
    kiritanpo: { R: 0.42, L: 2.5, hole: 0.32, cap: 0xf3ead6, rough: 0.8, paint: function (g, w, h) {
      var r = Z3.rng(41);
      g.fillStyle = "#f1e6cc"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 260; i++) {
        g.fillStyle = "rgba(" + (r() < 0.3 ? "200,140,70," : "255,250,235,") + (0.4 + r() * 0.4) + ")";
        g.beginPath(); g.ellipse(r() * w, r() * h, 5, 2.5, r() * 3, 0, Math.PI * 2); g.fill();
      }
      for (i = 0; i < 40; i++) {
        g.fillStyle = "rgba(170,100,40," + (0.25 + r() * 0.35) + ")";
        g.beginPath(); g.arc(w * 0.08 + r() * w * 0.84, r() * h, 4 + r() * 9, 0, Math.PI * 2); g.fill();
      }
    } },
    /* 鉄パイプ */
    pipe: { R: 0.4, L: 2.7, hole: 0.82, cap: 0x8d9096, capMetal: 0.7, metal: 0.65, rough: 0.45, paint: function (g, w, h) {
      g.fillStyle = "#9a9ea5"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(51);
      for (var i = 0; i < 30; i++) { g.fillStyle = "rgba(255,255,255," + (0.05 + r() * 0.1) + ")"; g.fillRect(0, r() * h, w, 1 + r() * 3); }
      for (i = 0; i < 25; i++) { g.fillStyle = "rgba(150,70,30," + (0.2 + r() * 0.4) + ")"; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 8, 0, Math.PI * 2); g.fill(); }
    } }
  };
  for (var key in OTHER) if (!OTHER[key].shape) OTHER[key].shape = "circle";

  /* カメラ。手前の椅子に座って、テーブルの向こうの仮面を見上げる */
  var CAM = { fov: 50, pos: [0, 8.6, 9.4], at: [0, 1.5, -1.0] };          /* 男を写す（開始画面・失敗したとき） */
  var PLATE = { fov: 44, pos: [0, 10.6, 6.0], at: [0, 0.45, -0.95] };          /* 遊んでいる間は皿を大きく */
  var MASK_Z = -3.5;
  /* 殴られる流れ（失敗してからの秒数） */
  var TURN = 0.4, WIND = 0.82, HIT = 1.0;   /* カメラが男へ向く → 振りかぶる → 殴る */

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: CAM.fov } });
    this.scene = st.scene;
    this.camera = st.camera;
    /* 暗い部屋。テーブルの上だけ明るい */
    this.scene.background = new T.Color(0x0d0b0c);
    Z3.lights(this.scene, { shadows: true, shadowSize: 5, scale: 0.8 });
    var spot = new T.SpotLight(0xfff1d8, 60, 18, 0.62, 0.5, 1.6);
    spot.position.set(0, 9, -0.5); spot.target.position.set(0, 0, -1);
    this.scene.add(spot); this.scene.add(spot.target);
    this.aimCamera(0, 0, 1);

    /* 木のテーブル。向こう側の端の奥に仮面が立つ（カメラの後ろまでは伸ばさない） */
    var table = new T.Mesh(new T.BoxGeometry(9, 0.4, 7.2), Z3.std(0xffffff, { map: woodTex(), roughness: 0.75 }));
    table.position.set(0, -0.2, 0.9); table.receiveShadow = true;
    this.scene.add(table);
    this.mask = this.makeMask();
    this.scene.add(this.mask.root);

    /* 皿 */
    var prof = [[0, 0.02], [1.7, 0.02], [2.05, 0.1], [2.35, 0.22], [2.42, 0.25], [2.44, 0.2], [2.3, 0.12], [1.8, 0.05], [1.7, 0.0], [0, 0.0]]
      .map(function (p) { return new T.Vector2(p[0], p[1]); }).reverse();
    this.plate = new T.Group();
    var dish = new T.Mesh(new T.LatheGeometry(prof, 48), Z3.std(0xf6f3ec, { roughness: 0.35, side: T.DoubleSide }));
    dish.receiveShadow = true; dish.castShadow = true;
    this.plate.add(dish);
    var line = new T.Mesh(new T.RingGeometry(2.08, 2.14, 64), Z3.std(0x4a6aa0, { roughness: 0.4 }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.125;
    this.plate.add(line);
    this.scene.add(this.plate);

    /* おでんの鍋 */
    this.pot = new T.Group();
    var potBody = new T.Mesh(new T.CylinderGeometry(2.55, 2.45, 0.7, 48, 1, true), Z3.std(0x3a3a40, { roughness: 0.4, metalness: 0.5, side: T.DoubleSide }));
    potBody.position.y = 0.35; potBody.receiveShadow = true;
    this.pot.add(potBody);
    var potRim = new T.Mesh(new T.TorusGeometry(2.55, 0.06, 8, 48), Z3.std(0x55555c, { metalness: 0.6, roughness: 0.35 }));
    potRim.rotation.x = Math.PI / 2; potRim.position.y = 0.7;
    this.pot.add(potRim);
    this.broth = new T.Mesh(new T.CircleGeometry(2.5, 48), Z3.std(0xc98f3e, { roughness: 0.15, transparent: true, opacity: 0.86 }));
    this.broth.rotation.x = -Math.PI / 2; this.broth.position.y = 0.42;
    this.pot.add(this.broth);
    this.pot.visible = false;
    this.scene.add(this.pot);

    /* 部品の作り置き。焼き・筋の濃さは3段に丸める */
    this.geo = {}; this.tex = {};
    this.items = [];          /* いま置いているもの */
    this.cur = null; this.curItem = null; this.leaveItem = null; this.leaveObj = null;
    this.intro = null;
  }

  GameScene.prototype.level = function (x) { return x > 0.8 ? 1 : x > 0.6 ? 0.7 : 0.45; };
  GameScene.prototype.geometry = function (it, ridge, slice) {
    var key = it.kind === "o" ? "o" + it.other : it.kind + ridge + (slice ? "s" : "");
    if (!this.geo[key]) {
      this.geo[key] = it.kind === "o" ? tubeGeo(OTHER[it.other]) :
        it.kind === "w" ? tubeGeo({ shape: "circle", R: 0.42, L: slice ? 0.22 : 2.7, hole: 0.5, slice: slice }) :
        tubeGeo({ shape: "gear", n: 8, depth: 0.16 * ridge, R: 0.48, L: slice ? 0.24 : 2.45, hole: 0.27, slice: slice });
    }
    return this.geo[key];
  };
  GameScene.prototype.texture = function (it, grill) {
    var key = it.kind === "o" ? "o" + it.other : it.kind + grill + "_" + (it.seed % 3), seed = it.seed;
    if (!this.tex[key]) this.tex[key] = it.kind === "o" ? Z3.canvasTex(256, 256, OTHER[it.other].paint) :
      it.kind === "w" ? grillTex(11 + seed % 3 * 17, grill) : wheatTex(5 + seed % 3);
    return this.tex[key];
  };

  /* 1品ぶんの立体を作る */
  GameScene.prototype.build = function (it) {
    var grill = this.level(it.grill), ridge = this.level(it.ridge), slice = it.view === "slice";
    var o = it.kind === "o" ? OTHER[it.other] : null;
    var side = Z3.std(0xffffff, { map: this.texture(it, grill), roughness: o ? o.rough : it.kind === "w" ? 0.55 : 0.8, metalness: o && o.metal || 0 });
    var cap = Z3.std(o ? o.cap : it.kind === "w" ? 0xf6ecd4 : 0xf4eedf, { roughness: o ? o.rough : 0.8, metalness: o && o.capMetal || 0 });
    /* おでんの汁がしみた色 */
    var s = it.simmer || 0;
    [side, cap].forEach(function (m) { m.color.multiply(new T.Color(1 - 0.18 * s, 1 - 0.38 * s, 1 - 0.68 * s)); });
    var mats = [cap, side];
    var geo = this.geometry(it, ridge, slice);
    var root = new T.Group(), R = o ? o.R : it.kind === "w" ? 0.42 : 0.48, sunk = s > 0 ? 0.25 : 0;
    if (!slice) {
      var m = new T.Mesh(geo, mats);
      m.rotation.z = (it.seed % 628) / 100;     /* ぐるりの向きをばらす（先に軸まわり） */
      m.rotation.y = Math.PI / 2;
      m.position.y = R + 0.12 + sunk;
      m.castShadow = m.receiveShadow = true;
      root.add(m);
    } else {
      it.slices.forEach(function (sl) {
        var p = new T.Mesh(geo, mats);
        p.position.set(sl.x / 95, 0.24 + sunk + 0.12, sl.y / 95);
        p.rotation.x = -Math.PI / 2 + (1 - sl.tilt) * 0.9;
        p.rotation.z = sl.a;
        p.castShadow = p.receiveShadow = true;
        root.add(p);
      });
    }
    root.userData.mats = mats;
    return root;
  };
  GameScene.prototype.drop = function (obj) {
    if (!obj) return;
    this.scene.remove(obj);
    if (obj.userData.mats) obj.userData.mats.forEach(function (m) { m.dispose(); });
  };

  GameScene.prototype.reset = function () {};

  /* カメラを置く。knock: 殴られて倒れる量 0〜1 */
  /* view: 0=皿 1=男 */
  GameScene.prototype.aimCamera = function (knock, jolt, view) {
    var c = this.camera, k = knock, v = view || 0;
    var pos = lerp3(PLATE.pos, CAM.pos, v), at = lerp3(PLATE.at, CAM.at, v), fov = PLATE.fov + (CAM.fov - PLATE.fov) * v;
    if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); }
    c.up.set(0, 1, 0);
    c.position.set(pos.x + jolt * 0.3, pos.y - k * 3.2, pos.z + k * 1.5);
    c.lookAt(at.x - k * 2.5, at.y + k * 3.5, at.z);
    if (k > 0) c.rotateZ(k * 1.25);
  };

  /* ちくわちくわぶ仮面。黒い頭巾、白い仮面、左目がちくわ・右目がちくわぶの筒 */
  GameScene.prototype.makeMask = function () {
    /* 体は向かって左半分がちくわ、右半分がちくわぶ（左目・右目と同じ側） */
    var root = new T.Group();
    var matW = Z3.std(0xffffff, { map: grillTex(13, 1), roughness: 0.55 });
    var matB = Z3.std(0xffffff, { map: ridgeTex(), roughness: 0.8 });
    root.position.z = MASK_Z;
    /* 半分ずつ作る。x<0 側=ちくわ、x>0 側=ちくわぶ */
    function halves(make, parent, setup) {
      [[matW, -1], [matB, 1]].forEach(function (h) {
        var m = new T.Mesh(make(h[1]), h[0]); setup(m); parent.add(m);
      });
    }
    halves(function (side) { return new T.CylinderGeometry(1.0, 1.35, 3.4, 20, 1, false, side > 0 ? 0 : Math.PI, Math.PI); }, root, function (m) { m.position.y = 0.3; });
    halves(function (side) { return new T.SphereGeometry(1.0, 20, 12, side > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI); }, root, function (m) { m.scale.set(1.45, 0.55, 0.85); m.position.y = 1.95; });
    var head = new T.Group(); head.position.y = 2.95; root.add(head);
    halves(function (side) { return new T.SphereGeometry(0.86, 24, 16, side > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI); }, head, function (m) { m.scale.set(1, 1.12, 1); });
    var face = new T.Mesh(new T.SphereGeometry(0.7, 24, 16), Z3.std(0xf1ede2, { roughness: 0.35 }));
    face.scale.set(0.95, 1.12, 0.45); face.position.z = 0.55; head.add(face);
    /* 目の筒（穴の奥は暗い） */
    var cw = tubeGeo({ shape: "circle", R: 0.2, L: 0.55, hole: 0.5 });
    var cb = tubeGeo({ shape: "gear", n: 8, depth: 0.16, R: 0.22, L: 0.5, hole: 0.27 });
    var eyeW = new T.Mesh(cw, [Z3.std(0xf6ecd4), Z3.std(0xffffff, { map: grillTex(11, 1), roughness: 0.55 })]);
    var eyeB = new T.Mesh(cb, [Z3.std(0xf4eedf), Z3.std(0xffffff, { map: wheatTex(5), roughness: 0.8 })]);
    eyeW.position.set(-0.27, 0.12, 0.82); eyeB.position.set(0.27, 0.12, 0.82);
    head.add(eyeW); head.add(eyeB);
    var mouth = new T.Mesh(new T.BoxGeometry(0.42, 0.05, 0.05), Z3.std(0x2a1f1a));
    mouth.position.set(0, -0.38, 0.86); mouth.rotation.z = 0.04; head.add(mouth);
    /* 腕：肩から拳までの棒と拳。毎コマつなぎ直す */
    var arms = [-1, 1].map(function (side) {
      var arm = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 1, 10), side < 0 ? matW : matB);
      var fist = new T.Mesh(new T.SphereGeometry(0.36, 16, 12), side < 0 ? matW : matB);
      fist.scale.set(1, 0.85, 1.05);
      root.add(arm); root.add(fist);
      return { side: side, arm: arm, fist: fist, shoulder: new T.Vector3(side * 1.25, 1.85, 0.1) };
    });
    root.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return { root: root, head: head, arms: arms };
  };

  var UP = null;
  function placeArm(a, hand) {
    UP = UP || new T.Vector3(0, 1, 0);
    var d = hand.clone().sub(a.shoulder), len = d.length();
    a.arm.position.copy(a.shoulder).addScaledVector(d, 0.5);
    a.arm.quaternion.setFromUnitVectors(UP, d.normalize());
    a.arm.scale.set(1, len, 1);
    a.fist.position.copy(hand);
  }
  function lerp3(a, b, k) { return new T.Vector3(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k); }
  function ease(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); }

  /* 仮面の動き。t: 時刻、miss: 失敗してからの秒数（失敗していなければ -1）、nod: うなずき 0〜1 */
  GameScene.prototype.poseMask = function (t, miss, nod, intro) {
    var m = this.mask, br = Math.sin(t * 1.6) * 0.04;
    m.head.rotation.set(-0.38 + nod * 0.35, Math.sin(t * 0.5) * 0.08, Math.sin(t * 0.7) * 0.04);
    m.head.position.y = 2.95 + br;
    var restL = [-1.35, 0.3, 1.25], restR = [1.35, 0.3, 1.25];
    placeArm(m.arms[0], lerp3(restL, restL, 0).add(new T.Vector3(0, br, 0)));
    if (miss < 0) { placeArm(m.arms[1], lerp3(restR, restR, 0).add(new T.Vector3(0, br, 0))); this.aimCamera(0, 0, intro ? 1 : 0); return; }
    /* 振りかぶって（WIND）、カメラめがけて殴る（HIT）、倒れる */
    var up = [1.9, 3.4, -0.6];
    var c = CAM.pos, cam = [c[0] + 0.25, c[1] - 0.35, c[2] - MASK_Z - 1.3];
    var hand = miss < TURN ? restR.slice() && lerp3(restR, restR, 0) : miss < WIND ? lerp3(restR, up, ease((miss - TURN) / (WIND - TURN))) : lerp3(up, cam, Math.min(1, Math.pow((miss - WIND) / (HIT - WIND), 2)));
    if (miss > HIT) hand = lerp3(cam, [1.6, 2.2, 3.5], ease((miss - HIT) / 0.5));
    placeArm(m.arms[1], hand);
    m.head.rotation.x = -0.38 - ease((miss - TURN) / (WIND - TURN)) * 0.12;
    var knock = miss > HIT ? ease((miss - HIT) / 0.7) : 0;
    var jolt = miss > HIT && miss < HIT + 0.25 ? Math.sin(miss * 90) * (1 - (miss - HIT) / 0.25) : 0;
    this.aimCamera(knock, jolt, ease(miss / TURN));
  };

  /* s: { state, T, item, leave, intro } */
  GameScene.prototype.sync = function (s) {
    var self = this;
    this.poseMask(s.T, s.miss == null ? -1 : s.miss, s.nod || 0, s.intro);
    if (s.intro) {
      if (!this.intro) {
        this.intro = new T.Group();
        var a = this.build({ kind: "w", view: "side", grill: 1, ridge: 1, seed: 3, simmer: 0 });
        var b = this.build({ kind: "b", view: "side", grill: 1, ridge: 1, seed: 5, simmer: 0 });
        a.position.z = -0.65; b.position.z = 0.65;
        a.rotation.y = b.rotation.y = 0.18;
        this.intro.add(a); this.intro.add(b);
        this.scene.add(this.intro);
      }
      this.intro.visible = true;
      if (this.cur) this.cur.visible = false;
      if (this.leaveObj) this.leaveObj.visible = false;
      this.plate.visible = true; this.pot.visible = false;
      return;
    }
    if (this.intro) this.intro.visible = false;
    var it = s.item;
    if (it !== this.curItem) {
      /* 前の品は飛んでいく役に回す */
      this.drop(this.leaveObj);
      this.leaveObj = this.cur; this.leaveItem = this.curItem;
      this.cur = it ? this.build(it) : null;
      this.curItem = it;
      if (this.cur) this.scene.add(this.cur);
    }
    var simmer = it ? it.simmer > 0 : false;
    this.plate.visible = !simmer; this.pot.visible = simmer;
    if (simmer) this.broth.position.y = 0.42 + Math.sin(s.T * 2) * 0.01;
    if (this.cur) {
      this.cur.visible = true;
      var pop = Math.min(1, (s.T - it.born) / 0.1), k = (0.7 + 0.3 * pop) * it.scale;
      this.cur.scale.setScalar(k);
      this.cur.position.set(0, 0, 0);
      this.cur.rotation.y = -(it.ang + it.spin * (s.T - it.born)) + (it.flip ? Math.PI : 0);
    }
    if (this.leaveObj) {
      if (s.leave && s.leave.item === this.leaveItem) {
        var q = s.leave.t / 0.22;
        this.leaveObj.visible = true;
        this.leaveObj.position.set(s.leave.dir * q * 4.5, q * (s.leave.dir ? 1.6 : 2.6), -q * (s.leave.dir ? 0.8 : 2.4));
        this.leaveObj.scale.setScalar(this.leaveItem.scale * (1 - q * 0.3));
      } else { this.drop(this.leaveObj); this.leaveObj = null; this.leaveItem = null; }
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
