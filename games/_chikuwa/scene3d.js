/* ちくわかちくわぶかゲームの立体の場面（three.js）。games/three-base.js の Z3 を土台にする。
   ゲーム側は sync(状態) と draw(ctx, W, H) を呼ぶ。当たり・点数・時間はゲーム側。ここは見た目だけ。

   ちくわ・ちくわぶは、断面の形（丸／歯車）に穴をあけて長さ方向へ押し出して作る。
   焼き色やざらつきは2Dで描いた絵を貼る（横＝長さ方向、縦＝ぐるり一周）。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var CREAM_W = "#f1e2bb", CREAM_B = "#efe7d2";

  /* 断面の形。ちくわ=丸、ちくわぶ=8つ山の歯車（ridge で山の深さ） */
  function outline(kind, R, ridge) {
    var pts = [], n = kind === "w" ? 48 : 96;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      var r = kind === "w" ? R : R * (1 - 0.16 * ridge * (0.5 - 0.5 * Math.cos(a * 8)));
      pts.push(new T.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    return pts;
  }

  /* 押し出した筒。slice のときは短い輪切りで、外側の皮が焼き色になるようにする */
  function tubeGeo(kind, R, L, ridge, slice) {
    var shape = new T.Shape(outline(kind, R, ridge));
    var hr = R * (kind === "w" ? 0.5 : 0.27), hole = new T.Path();
    hole.absarc(0, 0, hr, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    var bev = slice ? 0.015 : 0.05;
    var g = new T.ExtrudeGeometry(shape, { depth: L, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 2, curveSegments: 24, steps: 1 });
    g.translate(0, 0, -L / 2);
    /* 貼り絵の位置を自分で決める。断面（群0）と穴の内側は u=0（白い端）、外側は長さ方向と角度 */
    var pos = g.attributes.position, uv = g.attributes.uv, mid = (R + hr) / 2;
    var caps = g.groups[0] ? g.groups[0].count : 0;
    for (var t = 0; t < pos.count; t += 3) {
      var vs = [];
      for (var k = 0; k < 3; k++) {
        var i = t + k, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        var inner = Math.sqrt(x * x + y * y) < mid;
        var u = (i < caps || inner) ? 0 : (slice ? 0.5 : Math.min(1, Math.max(0, z / L + 0.5)));
        var v = Math.atan2(y, x) / (Math.PI * 2) + 0.5;
        vs.push([u, v]);
      }
      /* 角度の継ぎ目をまたぐ三角は、小さい側に1を足して絵がつぶれないようにする */
      var vmax = Math.max(vs[0][1], vs[1][1], vs[2][1]);
      for (k = 0; k < 3; k++) {
        if (vmax - vs[k][1] > 0.5) vs[k][1] += 1;
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

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: 30 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x6b4426);
    Z3.lights(this.scene, { shadows: true, shadowSize: 4 });
    this.camera.position.set(0, 15.5, 8.6);
    this.camera.lookAt(0, 0, 0.75);

    /* 木のカウンター（カメラの後ろまでは伸ばさない） */
    var table = new T.Mesh(new T.PlaneGeometry(12, 12), Z3.std(0xffffff, { map: woodTex(), roughness: 0.75 }));
    table.rotation.x = -Math.PI / 2; table.position.z = 0; table.receiveShadow = true;
    this.scene.add(table);

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
  GameScene.prototype.geometry = function (kind, ridge, slice) {
    var key = kind + ridge + (slice ? "s" : "");
    if (!this.geo[key]) {
      this.geo[key] = kind === "w" ? tubeGeo("w", 0.42, slice ? 0.22 : 2.7, 1, slice) : tubeGeo("b", 0.48, slice ? 0.24 : 2.45, ridge, slice);
    }
    return this.geo[key];
  };
  GameScene.prototype.texture = function (kind, grill, seed) {
    var key = kind + grill + "_" + (seed % 3);
    if (!this.tex[key]) this.tex[key] = kind === "w" ? grillTex(11 + seed % 3 * 17, grill) : wheatTex(5 + seed % 3);
    return this.tex[key];
  };

  /* 1品ぶんの立体を作る */
  GameScene.prototype.build = function (it) {
    var grill = this.level(it.grill), ridge = this.level(it.ridge), slice = it.view === "slice";
    var mat = Z3.std(0xffffff, { map: this.texture(it.kind, grill, it.seed), roughness: it.kind === "w" ? 0.55 : 0.8 });
    /* おでんの汁がしみた色 */
    var s = it.simmer || 0;
    mat.color.setRGB(1 - 0.18 * s, 1 - 0.38 * s, 1 - 0.68 * s);
    var geo = this.geometry(it.kind, ridge, slice);
    var root = new T.Group(), R = it.kind === "w" ? 0.42 : 0.48, sunk = s > 0 ? 0.25 : 0;
    if (!slice) {
      var m = new T.Mesh(geo, mat);
      m.rotation.z = (it.seed % 628) / 100;     /* ぐるりの向きをばらす（先に軸まわり） */
      m.rotation.y = Math.PI / 2;
      m.position.y = R + 0.12 + sunk;
      m.castShadow = m.receiveShadow = true;
      root.add(m);
    } else {
      it.slices.forEach(function (sl) {
        var p = new T.Mesh(geo, mat);
        p.position.set(sl.x / 95, 0.24 + sunk + 0.12, sl.y / 95);
        p.rotation.x = -Math.PI / 2 + (1 - sl.tilt) * 0.9;
        p.rotation.z = sl.a;
        p.castShadow = p.receiveShadow = true;
        root.add(p);
      });
    }
    root.userData.mat = mat;
    return root;
  };
  GameScene.prototype.drop = function (obj) {
    if (!obj) return;
    this.scene.remove(obj);
    if (obj.userData.mat) obj.userData.mat.dispose();
  };

  GameScene.prototype.reset = function () {};

  /* s: { state, T, item, leave, intro } */
  GameScene.prototype.sync = function (s) {
    var self = this;
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
        this.leaveObj.position.set(s.leave.dir * q * 4.5, q * 1.6, -q * 0.8);
        this.leaveObj.scale.setScalar(this.leaveItem.scale * (1 - q * 0.3));
      } else { this.drop(this.leaveObj); this.leaveObj = null; this.leaveItem = null; }
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
