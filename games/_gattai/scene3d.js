/* 立体の場面（three.js）。games/three-base.js の Z3 を土台にする。
   ゲーム側（index.html）の座標は px で、地面が y=0、上がマイナス。ここでは 100px = 1 にして、上をプラスにする。
   見た目だけを受け持ち、当たり・体力などはゲーム側に置く。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3, U = 100;

  var COL = {
    blue: 0x2d63e0, white: 0xf2f4f8, red: 0xe23a32, yellow: 0xffc928, dark: 0x2a3140, gray: 0x8f99a8,
    kaiju: 0x4f9a52, belly: 0xc9d77a, kdark: 0x2f6b38
  };

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: !Z3.mobile, tone: "aces", exposure: 1.1 }, camera: { fov: 30, near: 0.5, far: 120 } });
    this.scene = st.scene;
    this.camera = st.camera;
    var sc = this.scene;
    sc.background = Z3.canvasTex(4, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#5f9ee6"); gr.addColorStop(0.65, "#b8dcf5"); gr.addColorStop(1, "#f3e6cf");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    sc.fog = new T.Fog(0xcfe2f0, 18, 60);
    var L = Z3.lights(sc, { shadows: !Z3.mobile, shadowSize: 12, scale: 1.1 });
    L.key.position.set(-6, 12, 10);
    this.key = L.key;

    /* 地面（カメラの後ろまでは伸ばさない） */
    var ground = new T.Mesh(new T.PlaneGeometry(80, 40), Z3.std(0x8d8a80, { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -3); ground.receiveShadow = true;
    sc.add(ground);
    var road = new T.Mesh(new T.PlaneGeometry(60, 3.2), Z3.std(0x5d6068, { roughness: 1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.005, 0); road.receiveShadow = true;
    sc.add(road);

    /* 遠くのビル（彩度を落として、主役と分ける） */
    var winTex = Z3.canvasTex(64, 128, function (g, w, h) {
      g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#c9d3dc";
      for (var y = 8; y < h - 6; y += 14) for (var x = 6; x < w - 6; x += 14) g.fillRect(x, y, 8, 8);
    });
    var r = Z3.rng(11), shades = [0xb9c2cc, 0xa9b4c0, 0xc8c3ba, 0x9eaab8, 0xd2cdc4];
    for (var row = 0; row < 3; row++) {
      for (var i = -14; i <= 14; i++) {
        var bw = 1.2 + r() * 1.4, bh = 1.5 + r() * (row === 2 ? 7 : 4.5), bd = 1.2 + r();
        var m = new T.MeshStandardMaterial({ color: shades[Math.floor(r() * shades.length)], map: winTex, roughness: 0.9 });
        var b = new T.Mesh(new T.BoxGeometry(bw, bh, bd), m);
        b.position.set(i * 2.2 + r() * 0.8, bh / 2, -3.5 - row * 4 - r() * 1.5);
        sc.add(b);
      }
    }

    this.robot = {};
    this.kaiju = null;
    this.ghost = null;
    this.camPos = new T.Vector3();
  }

  /* ---------- ロボのパーツの形 ---------- */
  function box(w, h, d, color, x, y, z, extra) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), Z3.std(color, extra || { roughness: 0.45, metalness: 0.15 }));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    return m;
  }
  function outline(mesh) {
    var e = new T.LineSegments(new T.EdgesGeometry(mesh.geometry), new T.LineBasicMaterial({ color: 0x16202e }));
    mesh.add(e);
    return mesh;
  }
  /* パーツごとに色を変えて「別々のメカが合体した」感じを出す（11個すべて別の色） */
  var PART = {
    chest: 0xe0322c, head: 0xf2f4f8, uarmL: 0x2d63e0, uarmR: 0x22b8d8, farmL: 0xffc21a, farmR: 0xa6d11e,
    waist: 0x3a3f4a, thighL: 0x2fae5a, thighR: 0x8a4fd8, legL: 0xf07a1e, legR: 0xf0609a
  };
  function makePiece(p) {
    var g = new T.Group(), w = p.w / U, h = p.h / U, d;
    var k = p.kind, c = PART[p.id];
    if (k === "uarm" || k === "farm") {
      /* 腕は横向き。縦向きで作って、つなぎ目側が胸のほうへ向くように回す */
      var inner = new T.Group(), vw = h, vh = w;
      d = 0.5;
      if (k === "uarm") {
        inner.add(outline(box(vw * 0.85, vh, d * 0.85, c)));
        inner.add(outline(box(vw * 1.25, vh * 0.22, d, COL.white, 0, vh * 0.39)));
        inner.add(box(vw * 1.0, vh * 0.06, d * 1.02, COL.dark, 0, -vh * 0.2));
      } else {
        inner.add(outline(box(vw, vh * 0.68, d, c, 0, vh * 0.16)));
        inner.add(outline(box(vw * 1.2, vh * 0.34, d * 1.08, COL.dark, 0, -vh * 0.34)));
        inner.add(box(vw * 1.02, vh * 0.06, d * 1.04, COL.white, 0, -vh * 0.1));
      }
      inner.rotation.z = /L$/.test(p.id) ? -Math.PI / 2 : Math.PI / 2;
      g.add(inner);
    } else if (k === "chest") {
      d = 0.7;
      g.add(outline(box(w, h, d, c)));
      g.add(outline(box(w * 0.8, h * 0.42, 0.1, COL.white, 0, h * 0.2, d / 2 + 0.02)));
      for (var i = 0; i < 3; i++) g.add(box(w * 0.18, h * 0.06, 0.06, COL.dark, -w * 0.22 + i * w * 0.22, h * 0.2, d / 2 + 0.08));
      g.add(outline(box(w * 0.3, h * 0.3, 0.12, COL.yellow, 0, -h * 0.18, d / 2 + 0.03)));
      g.add(box(w * 0.14, h * 0.14, 0.08, 0x38c8ff, 0, -h * 0.18, d / 2 + 0.12, { roughness: 0.3, emissive: 0x1070a0 }));
    } else if (k === "head") {
      d = 0.5;
      g.add(outline(box(w, h * 0.8, d, c, 0, -h * 0.1)));
      g.add(box(w * 0.8, h * 0.18, 0.06, 0x111822, 0, h * 0.02, d / 2 + 0.02));
      g.add(box(w * 0.7, h * 0.08, 0.04, 0x9fffd0, 0, h * 0.02, d / 2 + 0.06, { emissive: 0x4fe0a0, emissiveIntensity: 1.2 }));
      g.add(outline(box(w * 0.36, h * 0.16, d * 0.9, COL.red, 0, -h * 0.42)));
      [-1, 1].forEach(function (s) {
        var fin = box(w * 0.55, h * 0.1, 0.08, COL.yellow, s * w * 0.24, h * 0.38, d / 2 - 0.05);
        fin.rotation.z = s * 0.55; g.add(fin);
      });
      g.add(box(w * 0.14, h * 0.14, 0.1, COL.red, 0, h * 0.28, d / 2));
    } else if (k === "waist") {
      d = 0.6;
      g.add(outline(box(w, h, d, c)));
      g.add(outline(box(w * 0.3, h * 0.9, 0.08, COL.yellow, 0, 0, d / 2 + 0.02)));
    } else if (k === "thigh") {
      d = 0.5;
      g.add(outline(box(w * 0.85, h, d * 0.9, c)));
      g.add(box(w * 0.9, h * 0.08, d * 0.95, COL.white, 0, -h * 0.4));
    } else if (k === "leg") {
      d = 0.55;
      g.add(outline(box(w, h * 0.78, d, c, 0, h * 0.1)));
      g.add(outline(box(w * 1.3, h * 0.26, d * 1.4, COL.dark, 0, -h * 0.37, 0.06)));
      g.add(box(w * 0.6, h * 0.12, 0.06, COL.white, 0, h * 0.25, d / 2 + 0.02));
    }
    return g;
  }

  /* ---------- 怪獣 ---------- */
  function makeKaiju() {
    var K = {}, mat = Z3.std(COL.kaiju, { roughness: 0.7 }), dark = Z3.std(COL.kdark, { roughness: 0.8 });
    var belly = Z3.std(COL.belly, { roughness: 0.8 });
    function sh(geo, m, x, y, z) { var o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; return o; }
    /* 胴（170x320）。正面は左向き（-x）で作り、向きは scale.x で返す */
    var body = new T.Group();
    var torso = sh(new T.CapsuleGeometry(0.8, 1.5, 6, 12), mat, 0, 0.1, 0); torso.scale.set(1.05, 1, 0.9); body.add(torso);
    var bl = sh(new T.CapsuleGeometry(0.55, 1.2, 6, 10), belly, -0.32, 0.1, 0.25); bl.scale.set(0.8, 1, 0.8); body.add(bl);
    [-0.45, 0.45].forEach(function (z) {
      var leg = sh(new T.CylinderGeometry(0.34, 0.42, 0.9, 10), dark, 0.1, -1.15, z); body.add(leg);
      var foot = sh(new T.BoxGeometry(0.85, 0.22, 0.6), dark, -0.12, -1.5, z); body.add(foot);
    });
    var tail = sh(new T.ConeGeometry(0.5, 2.4, 10), mat, 1.4, -0.9, -0.2); tail.rotation.z = Math.PI / 2 + 0.5; body.add(tail);
    for (var i = 0; i < 5; i++) {
      var sp = sh(new T.ConeGeometry(0.16, 0.42, 6), Z3.std(0xe8e0c0, { roughness: 0.6 }), 0.62 + i * 0.12, 1.1 - i * 0.42, 0);
      sp.rotation.z = -0.9 - i * 0.12; body.add(sp);
    }
    /* 頭（120x80） */
    var head = new T.Group();
    var skull = sh(new T.BoxGeometry(1.2, 0.62, 0.8), mat, 0, 0.08, 0); head.add(skull);
    var jaw = sh(new T.BoxGeometry(1.0, 0.22, 0.7), dark, -0.1, -0.3, 0); head.add(jaw);
    for (var t = 0; t < 5; t++) head.add(sh(new T.ConeGeometry(0.05, 0.14, 4), Z3.std(0xffffff), -0.52 + t * 0.12, -0.17, 0.3));
    [0.25, -0.25].forEach(function (z) {
      var eye = sh(new T.SphereGeometry(0.09, 10, 8), Z3.std(0xffe23a, { emissive: 0xff4a10, emissiveIntensity: 1.2 }), -0.25, 0.22, z + (z > 0 ? 0.16 : -0.16));
      head.add(eye);
    });
    head.add(sh(new T.ConeGeometry(0.12, 0.4, 6), Z3.std(0xe8e0c0), 0.3, 0.5, 0));
    /* 爪（90x34） */
    var claw = new T.Group();
    var arm = sh(new T.CapsuleGeometry(0.15, 0.6, 4, 8), mat, 0, 0, 0); arm.rotation.z = Math.PI / 2; claw.add(arm);
    for (var c = 0; c < 3; c++) {
      var cl = sh(new T.ConeGeometry(0.05, 0.22, 5), Z3.std(0xffffff), -0.5, -0.1 + c * 0.1, 0); cl.rotation.z = Math.PI / 2; claw.add(cl);
    }
    claw.position.z = 0.35;
    K.body = body; K.head = head; K.claw = claw;
    return K;
  }

  GameScene.prototype.reset = function () {
    var sc = this.scene, self = this;
    Object.keys(this.robot).forEach(function (id) { sc.remove(self.robot[id]); });
    this.robot = {};
    if (this.kaiju) { sc.remove(this.kaiju.body); sc.remove(this.kaiju.head); sc.remove(this.kaiju.claw); this.kaiju = null; }
    if (this.ghost) { sc.remove(this.ghost); this.ghost = null; }
  };

  GameScene.prototype.sync = function (s) {
    var sc = this.scene, self = this, seen = {};
    s.robot.forEach(function (p) {
      var g = self.robot[p.id];
      if (!g) { g = self.robot[p.id] = makePiece(p); sc.add(g); }
      seen[p.id] = true;
      /* 重なったときにちらつかないよう、くっついた順に少しずつ手前へ */
      g.position.set(p.x / U, -p.y / U, p.kind === "chest" ? 0 : (p.snapped ? 0.02 : 0.08 + p.order * 0.03));
      g.rotation.z = -p.a;
      g.visible = !(p.flying && s.fpv);           /* コクピットの中からは自分の機体は見えない */
    });
    Object.keys(this.robot).forEach(function (id) { if (!seen[id]) { sc.remove(self.robot[id]); delete self.robot[id]; } });

    /* ぴったりはまる場所の影 */
    if (s.slot) {
      if (!this.ghost || this.ghost.userData.id !== s.slot.id) {
        if (this.ghost) sc.remove(this.ghost);
        this.ghost = new T.Mesh(new T.BoxGeometry(s.slot.w / U, s.slot.h / U, 0.5), new T.MeshBasicMaterial({ color: 0xffe25a, transparent: true, opacity: 0.35, depthWrite: false }));
        this.ghost.userData.id = s.slot.id;
        sc.add(this.ghost);
      }
      this.ghost.position.set(s.slot.x / U, -s.slot.y / U, 0);
      this.ghost.rotation.z = -(s.slot.a || 0);
      this.ghost.material.opacity = 0.25 + 0.15 * Math.sin(s.t * 8);
    } else if (this.ghost) { sc.remove(this.ghost); this.ghost = null; }

    if (s.kaiju) {
      if (!this.kaiju) { this.kaiju = makeKaiju(); sc.add(this.kaiju.body); sc.add(this.kaiju.head); sc.add(this.kaiju.claw); }
      var K = this.kaiju, f = 1;
      s.kaiju.forEach(function (b) {
        var o = K[b.part];
        o.position.x = b.x / U; o.position.y = -b.y / U;
        o.rotation.z = -b.a;
        o.scale.x = f;
      });
      K.body.position.y += 0;
    }

    var cam = this.camera;
    /* コクピット視点: パーツのすぐ後ろから胸の面をまっすぐ見る */
    if (s.fpv) {
      if (cam.fov !== s.fpv.fov) { cam.fov = s.fpv.fov; cam.updateProjectionMatrix(); }
      cam.position.set(s.fpv.x / U, -s.fpv.y / U, s.fpv.z / U);
      cam.lookAt(s.fpv.x / U, -s.fpv.y / U, 0);
      this.key.target.position.set(0, 0, 0); this.key.target.updateMatrixWorld();
      return;
    }
    if (cam.fov !== 30) { cam.fov = 30; cam.updateProjectionMatrix(); }
    /* カメラ: cam.x, cam.y を画面の真ん中に、横幅 cam.w px が見えるように */
    var fov = cam.fov * Math.PI / 180;
    var aspect = cam.aspect || 0.5625;
    var dist = (s.cam.w / U) / 2 / (Math.tan(fov / 2) * aspect);
    cam.position.set(s.cam.x / U, -s.cam.y / U + 0.6, dist);
    cam.lookAt(s.cam.x / U, -s.cam.y / U, 0);
    this.key.target.position.set(s.cam.x / U, 0, 0);
    this.key.position.set(s.cam.x / U - 6, 12, 10);
    this.key.target.updateMatrixWorld();
  };

  /* ゲームの座標（px）を画面の座標へ */
  GameScene.prototype.project = function (x, y, W, H) {
    var v = new T.Vector3(x / U, -y / U, 0);
    this.camera.updateMatrixWorld();
    v.project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
