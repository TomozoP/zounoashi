/* メロディ迷路の立体の場面。主画面（2Dのcanvas）へ写すので録画にもそのまま入る。
   動きの計算はゲーム側（マス目）のまま。ここは見た目だけ。
   マスの x はそのまま x、マスの y（下向き）は z。1マス = 1。高さは y。
   床の模様（線・光・出口）はゲーム側が描いた絵を貼る。
   three.js は random-bowling の既存配布物（MIT）を使う。 */
(function (global) {
  "use strict";

  /* 音符（八分音符）の形を厚みのある板にする。下端が y=0、左右と前後の中心が 0 */
  function noteGeometry(T) {
    var head = new T.Shape();
    head.absellipse(0, 0.15, 0.19, 0.14, 0, Math.PI * 2, false, 0.4);
    var stem = new T.Shape();
    stem.moveTo(0.11, 0.17); stem.lineTo(0.19, 0.17); stem.lineTo(0.19, 0.78); stem.lineTo(0.11, 0.78); stem.closePath();
    var flag = new T.Shape();
    flag.moveTo(0.12, 0.78); flag.lineTo(0.19, 0.78);
    flag.quadraticCurveTo(0.22, 0.64, 0.36, 0.56);
    flag.quadraticCurveTo(0.44, 0.44, 0.37, 0.32);
    flag.quadraticCurveTo(0.37, 0.48, 0.19, 0.56);
    flag.lineTo(0.12, 0.56); flag.closePath();
    var D = 0.12, BV = 0.03;
    var geo = new T.ExtrudeGeometry([head, stem, flag], { depth: D, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 3, curveSegments: 20 });
    geo.translate(-0.09, BV + 0.01, -D / 2);
    geo.scale(1.35, 1.35, 1.35);
    geo.rotateX(-0.45);              /* 上から見下ろすカメラへ少し向ける */
    geo.computeVertexNormals();
    return geo;
  }
  var R = 0.3;                  /* 足もとの影の大きさの目安 */
  var HOP = 0.55;               /* 跳ぶ高さ */
  var BODY = 0xf4efe6;           /* ふだんの体の色。歌うとその音の色に染まる */

  function MazeScene() {
    var T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x172033, 1);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(36, 0.6, 0.1, 200);
    this.scene.add(new T.HemisphereLight(0xf2f5ff, 0x30384a, 1.7));
    var sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-4, 10, 6);
    this.scene.add(sun);
    this.world = null;
    this.w = 0; this.h = 0; this.aspect = 0;

    /* 跳ねる音符。着地すると音が鳴り、その音の色に染まってつぶれる */
    this.bodyMat = new T.MeshLambertMaterial({ color: BODY });
    this.cube = new T.Mesh(noteGeometry(T), this.bodyMat);
    this.scene.add(this.cube);
    this.tint = new T.Color(BODY);      /* 今の体の色 */
    this.target = new T.Color(BODY);
    this.squash = 0;                    /* 着地したときのつぶれ */
    this.pend = null;                   /* 着地したら染まる色 */
    /* 足もとの影 */
    var sh = document.createElement("canvas");
    sh.width = sh.height = 64;
    var g = sh.getContext("2d"), rg = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    rg.addColorStop(0, "rgba(0,0,0,.55)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    this.shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sh), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this.roll = null;                 /* 跳んでいる途中 {x0, z0, dx, dz, t, dur} */
    this.at = { x: 0.5, z: 0.5 };
  }

  /* 迷路を組む。floor はゲームが床の模様を描く canvas */
  MazeScene.prototype.setup = function (m, floor) {
    var T = global.THREE;
    if (this.world) {
      this.scene.remove(this.world);
      this.world.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    }
    var world = new T.Group();
    this.world = world;
    this.nx = m.NX; this.ny = m.NY;
    this.tex = new T.CanvasTexture(floor);
    this.tex.colorSpace = T.SRGBColorSpace;
    this.tex.anisotropy = 4;
    var ground = new T.Mesh(new T.PlaneGeometry(m.NX, m.NY), new T.MeshBasicMaterial({ map: this.tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(m.NX / 2, 0, m.NY / 2);
    world.add(ground);

    var wallMat = new T.MeshLambertMaterial({ color: 0xe8ecf4 });
    var TH = 0.1, HT = 0.34;
    function wall(x0, z0, x1, z1) {
      var w = Math.abs(x1 - x0) + TH, d = Math.abs(z1 - z0) + TH;
      var b = new T.Mesh(new T.BoxGeometry(w, HT, d), wallMat);
      b.position.set((x0 + x1) / 2, HT / 2, (z0 + z1) / 2);
      world.add(b);
    }
    wall(0, 0, m.NX, 0);
    wall(0, 0, 0, m.NY);
    for (var y = 0; y < m.NY; y++) for (var x = 0; x < m.NX; x++) {
      var k = y * m.NX + x;
      if (m.wallR[k] && !(x === m.NX - 1 && y === m.NY - 1)) wall(x + 1, y, x + 1, y + 1);
      if (m.wallD[k]) wall(x, y + 1, x + 1, y + 1);
    }
    this.scene.add(world);
    this.roll = null;
    this.place(m.start % m.NX, (m.start / m.NX) | 0);
    this.aspect = 0;
  };

  MazeScene.prototype.place = function (x, y) {
    this.roll = null;
    this.at = { x: x + 0.5, z: y + 0.5 };
  };

  /* 1マス跳ぶ。(x0,y0) から (x1,y1) へ、dur 秒で */
  MazeScene.prototype.rollTo = function (x0, y0, x1, y1, dur) {
    this.finish();
    this.roll = { x0: x0 + 0.5, z0: y0 + 0.5, dx: x1 - x0, dz: y1 - y0, t: 0, dur: dur };
  };
  MazeScene.prototype.finish = function () {
    var r = this.roll;
    if (!r) return;
    this.at = { x: r.x0 + r.dx, z: r.z0 + r.dz };
    this.roll = null;
    /* 着地 */
    this.squash = 1;
    if (this.pend !== null) { this.target.set(this.pend); this.pend = null; }
  };
  MazeScene.prototype.update = function (dt) {
    if (this.roll) {
      this.roll.t += dt;
      if (this.roll.t >= this.roll.dur) this.finish();
    }
    this.squash = Math.max(0, this.squash - dt * 4);
    this.tint.lerp(this.target, Math.min(1, dt * 10));
    this.target.lerp(new global.THREE.Color(BODY), Math.min(1, dt * 1.2));
  };

  /* 鳴った音の色に染まる。跳んでいる途中なら着地したときに */
  MazeScene.prototype.sing = function (color) {
    if (this.roll) this.pend = color;
    else { this.squash = 1; this.target.set(color); }
  };
  /* 寄り道したとき：灰色になる */
  MazeScene.prototype.oops = function () {
    this.sing(0xb9b2a8);
  };

  /* 板が画面に収まるよう、カメラの距離を決める */
  MazeScene.prototype.fit = function (aspect) {
    var T = global.THREE, cam = this.camera;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    var cx = this.nx / 2, cz = this.ny / 2, tilt = 62 * Math.PI / 180;
    var corners = [[0, 0], [this.nx, 0], [0, this.ny], [this.nx, this.ny]];
    for (var dist = 8; dist < 80; dist += 0.25) {
      cam.position.set(cx, Math.sin(tilt) * dist, cz + Math.cos(tilt) * dist);
      cam.lookAt(cx, 0, cz + 0.2);
      cam.updateMatrixWorld();
      var ok = corners.every(function (c) {
        var v = new T.Vector3(c[0], 0.35, c[1]).project(cam);
        return Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9;
      });
      if (ok) break;
    }
  };

  MazeScene.prototype.render = function (ctx, W, Hv) {
    var T = global.THREE;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.round(W * dpr), h = Math.round(Hv * dpr);
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
    }
    if (this.aspect !== W / Hv) { this.aspect = W / Hv; this.fit(this.aspect); }
    this.tex.needsUpdate = true;

    /* 音符。山なりに跳び、着地でつぶれる */
    var r = this.roll, lift = 0;
    if (r) {
      var f = Math.min(1, r.t / r.dur);
      lift = HOP * 4 * f * (1 - f);
      var st = 0.08 * Math.sin(f * Math.PI);   /* 空中では少し縦に伸びる */
      this.cube.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);
      this.cube.position.set(r.x0 + r.dx * f, lift, r.z0 + r.dz * f);
    } else {
      var sq = Math.sin(this.squash * Math.PI) * 0.22 * this.squash;
      this.cube.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
      this.cube.position.set(this.at.x, 0, this.at.z);
    }
    this.bodyMat.color.copy(this.tint);
    this.shadow.position.set(this.cube.position.x, 0.01, this.cube.position.z);
    this.shadow.scale.setScalar(R * 3.2 * (1 - lift * 0.5));

    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, Hv);
  };

  global.MazeScene = MazeScene;
})(window);
