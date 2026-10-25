/* 立体の場面（three.js）。机とミニカー。
   長さの単位は 1 = 100mm。机の端が z=0 で、車は +z 側から -z へ走る。机の上面が y=0、床は y=-7.5。
   ゲームの進行はゲーム側（index.html）に置き、ここは見た目だけ。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var DESK = 13, FLOOR = -7.5;

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces" }, camera: { fov: 40, near: 0.1, far: 80 }, finish: { vignette: 0.28, grain: 0.02 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x2b2a33);
    var L = this.lights = Z3.lights(this.scene, { shadows: true, shadowSize: 3 });
    this.scene.add(L.key.target);

    /* 机の天板（木目） */
    var wood = Z3.canvasTex(256, 1024, function (g, w, h) {
      g.fillStyle = "#b07a48"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      for (var i = 0; i < 70; i++) {
        var x = r() * w;
        g.strokeStyle = "rgba(" + (r() < 0.5 ? "80,45,20," : "210,160,110,") + (0.08 + r() * 0.12) + ")";
        g.lineWidth = 1 + r() * 4;
        g.beginPath(); g.moveTo(x, 0);
        for (var y = 0; y <= h; y += 64) g.lineTo(x + Math.sin(y * 0.01 + i) * 6, y);
        g.stroke();
      }
    });
    var top = new T.Mesh(new T.BoxGeometry(5, 0.4, DESK), [
      Z3.std(0x8a5a32), Z3.std(0x8a5a32), Z3.std(0xffffff, { map: wood, roughness: 0.55 }),
      Z3.std(0x6e4526), Z3.std(0x8a5a32), Z3.std(0x9a6438)
    ]);
    top.position.set(0, -0.2, DESK / 2);
    top.receiveShadow = true;
    this.scene.add(top);

    /* 端からの距離の目盛り（巻き尺）。1目盛り10mm、数字は cm */
    var tape = Z3.canvasTex(64, 2048, function (g, w, h) {
      g.fillStyle = "#f2cf3a"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#222";
      var per = h / 120;                               /* 120cm分 */
      for (var i = 0; i <= 120; i++) {
        var y = h - i * per, len = i % 10 === 0 ? 34 : i % 5 === 0 ? 22 : 12;
        g.fillRect(0, y - 1.5, len, 3);
        if (i % 10 === 0 && i > 0) {
          g.save(); g.translate(48, y); g.rotate(-Math.PI / 2);
          g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(String(i), 0, 0); g.restore();
        }
      }
    });
    tape.anisotropy = 8;
    var tapeM = new T.Mesh(new T.PlaneGeometry(0.42, 12), Z3.std(0xffffff, { map: tape, roughness: 0.6 }));
    tapeM.rotation.x = -Math.PI / 2;
    tapeM.rotation.z = Math.PI;
    tapeM.position.set(-1.6, 0.004, 6);
    tapeM.receiveShadow = true;
    this.scene.add(tapeM);

    /* 脚 */
    var legM = Z3.std(0x5a3a22);
    [[-2.25, 0.3], [2.25, 0.3], [-2.25, DESK - 0.3], [2.25, DESK - 0.3]].forEach(function (p) {
      var leg = new T.Mesh(new T.BoxGeometry(0.35, -FLOOR - 0.4, 0.35), legM);
      leg.position.set(p[0], (FLOOR - 0.4) / 2, p[1]);
      this.scene.add(leg);
    }, this);

    /* 床（じゅうたん）と壁 */
    var floor = new T.Mesh(new T.PlaneGeometry(30, 32), Z3.std(0x5d6e7c, { roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);
    var wall = new T.Mesh(new T.PlaneGeometry(30, 20), Z3.std(0x4a5160, { roughness: 1 }));
    wall.position.set(0, FLOOR + 10, -16);
    this.scene.add(wall);

    this.car = makeCar();
    this.scene.add(this.car.group);
    this.camPos = new T.Vector3(); this.camLook = new T.Vector3();
  }

  /* ミニカー。原点は重心の真下（机の上面）。長さ0.8 = 80mm */
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
    box(0.4, 0.12, 0.8, red, 0, 0.13, 0);              /* 車体 */
    box(0.34, 0.1, 0.38, dark, 0, 0.24, 0.04);         /* 窓 */
    box(0.32, 0.02, 0.32, red, 0, 0.3, 0.05);          /* 屋根 */
    box(0.42, 0.04, 0.04, chrome, 0, 0.1, -0.41);      /* 前のバンパー */
    box(0.42, 0.04, 0.04, chrome, 0, 0.1, 0.41);
    var lamp = Z3.std(0xfff3c0, { emissive: 0x665c30 });
    box(0.07, 0.04, 0.02, lamp, -0.13, 0.15, -0.405);
    box(0.07, 0.04, 0.02, lamp, 0.13, 0.15, -0.405);
    var tire = Z3.std(0x18181a, { roughness: 0.9 }), hub = Z3.std(0xbfc3c8, { roughness: 0.3, metalness: 0.8 });
    var wheels = [];
    [[-0.2, -0.27], [0.2, -0.27], [-0.2, 0.27], [0.2, 0.27]].forEach(function (p) {
      var w = new T.Group();
      var t = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.07, 16), tire);
      t.rotation.z = Math.PI / 2; t.castShadow = true; w.add(t);
      var h = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.075, 8), hub);
      h.rotation.z = Math.PI / 2; w.add(h);
      var spoke = new T.Mesh(new T.BoxGeometry(0.076, 0.02, 0.12), hub);
      w.add(spoke);
      w.position.set(p[0], 0.09, p[1]);
      body.add(w); wheels.push(w);
    });
    return { group: g, body: body, wheels: wheels };
  }

  GameScene.prototype.reset = function () {};

  /* s: { z, y, pitch, wheel, side, fall } */
  GameScene.prototype.sync = function (s) {
    var c = this.car;
    c.group.position.set(0, s.y + 0.17 * (1 - Math.cos(s.pitch)), s.z);   /* 裏返っても床に埋まらない */
    c.body.rotation.x = -s.pitch;                      /* 正で前が下がる */
    for (var i = 0; i < 4; i++) c.wheels[i].rotation.x = s.wheel;

    /* カメラ：後ろから追う → 端の横から見る（落ちたら床を見下ろす） */
    var k = s.side, e = k * k * (3 - 2 * k);
    var fx = 0.35, fy = 2.6, fz = s.z + 3.9, lx = 0, ly = 0, lz = s.z - 4.5;
    var ex, ey, ez, tx, ty, tz;
    if (s.fall) { ex = 1.6; ey = FLOOR + 2.6; ez = -5.5; tx = 0; ty = FLOOR + 0.6; tz = Math.min(-0.5, s.z); }
    else { ex = 3.6; ey = 0.13; ez = 0; tx = 0; ty = -0.05; tz = 0.1; }
    this.camera.position.set(fx + (ex - fx) * e, fy + (ey - fy) * e, fz + (ez - fz) * e);
    this.camera.lookAt(lx + (tx - lx) * e, ly + (ty - ly) * e, lz + (tz - lz) * e);

    var key = this.lights.key;
    key.position.set(-4, 8 + s.y, s.z + 6);
    key.target.position.set(0, s.y, s.z);
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
