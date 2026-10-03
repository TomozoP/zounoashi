/* メロディ迷路の立体の場面。主画面（2Dのcanvas）へ写すので録画にもそのまま入る。
   動きの計算はゲーム側（マス目）のまま。ここは見た目だけ。
   マスの x はそのまま x、マスの y（下向き）は z。1マス = 1。高さは y。
   床の模様（線・光・出口）はゲーム側が描いた絵を貼る。
   three.js は random-bowling の既存配布物（MIT）を使う。 */
(function (global) {
  "use strict";

  /* 前の球を玉にした音符（八分音符）。下端が y=0。玉・棒・旗を同じ色で組む。玉の側（-x）が前 */
  function noteMesh(T, mat) {
    var g = new T.Group(), inner = new T.Group();
    var HR = 0.3, SR = 0.045, sx = -0.05 + HR - SR, top = 1.12;
    var head = new T.Mesh(new T.SphereGeometry(HR, 40, 24), mat);
    head.position.set(-0.05, HR, 0);
    inner.add(head);
    var stem = new T.Mesh(new T.CylinderGeometry(SR, SR, top - HR, 16), mat);
    stem.position.set(sx, HR + (top - HR) / 2, 0);
    inner.add(stem);
    /* 旗：棒の上から外へ張り出して垂れる、幅のある形。厚みを付けて角を丸める */
    var fl = new T.Shape(), L = sx - SR;
    fl.moveTo(L, top);
    fl.quadraticCurveTo(L + 0.10, top - 0.02, L + 0.24, top - 0.16);
    fl.quadraticCurveTo(L + 0.38, top - 0.30, L + 0.30, top - 0.50);
    fl.quadraticCurveTo(L + 0.29, top - 0.34, L + 0.09, top - 0.26);
    fl.lineTo(L, top - 0.26);
    fl.closePath();
    var FD = 0.06, FB = 0.025;
    var flag = new T.Mesh(new T.ExtrudeGeometry(fl, { depth: FD, bevelEnabled: true, bevelThickness: FB, bevelSize: FB, bevelSegments: 3, curveSegments: 16 }), mat);
    flag.geometry.translate(-L, -top, 0);
    flag.position.set(L, top, -FD / 2);
    flag.scale.set(1.15, 1.15, 1);
    inner.add(flag);
    var cap = new T.Mesh(new T.SphereGeometry(SR, 12, 8), mat);
    cap.position.set(sx, top, 0);
    inner.add(cap);
    g.add(inner);
    g.yaw = inner;                       /* 向きを変えるのはこの組 */
    return g;
  }
  var VIEW = 11;                /* 画面に収める行の数 */
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
    this.cube = noteMesh(T, this.bodyMat);
    this.scene.add(this.cube);
    this.tint = new T.Color(BODY);      /* 今の体の色 */
    this.target = new T.Color(BODY);
    this.squash = 0;                    /* 着地したときのつぶれ */
    this.pend = null;                   /* 着地したら染まる色 */
    this.yaw = 0; this.yawTo = 0;       /* 向き */
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
    this.camZ = null;
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
    /* 進む向きを向く（いちばん近い回り方で） */
    var a = Math.atan2(y1 - y0, -(x1 - x0));
    while (a - this.yaw > Math.PI) a -= Math.PI * 2;
    while (a - this.yaw < -Math.PI) a += Math.PI * 2;
    this.yawTo = a;
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
    this.camT = (this.camT || 0) + dt;
    if (this.roll) {
      this.roll.t += dt;
      if (this.roll.t >= this.roll.dur) this.finish();
    }
    this.squash = Math.max(0, this.squash - dt * 4);
    this.yaw += (this.yawTo - this.yaw) * Math.min(1, dt * 25);
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
    /* 縦に長い迷路は、VIEW 行ぶんが収まる距離にして、カメラが音符を追いかける */
    var view = Math.min(this.ny, VIEW), cx = this.nx / 2, cz = view / 2, tilt = 62 * Math.PI / 180;
    var corners = [[0, 0], [this.nx, 0], [0, view], [this.nx, view]];
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
    this.dist = dist;
    this.tilt = tilt;
    /* カメラを寄せてよい範囲：板の奥の端が画面の上端より上、手前の端が下端より下にあるあいだ（板の外の空きを見せない）。
       板が画面に収まるときは真ん中に固定 */
    var self = this, P = new T.Vector3();
    function edge(c, z, y) { self.aim(c); cam.updateMatrixWorld(); return P.set(cx, y, z).project(cam).y; }
    var lo = null, hi = null;
    for (var c = -6; c <= this.ny + 6; c += 0.05) {
      if (lo === null && edge(c, 0, 0.35) >= 0.92) lo = c;
      if (edge(c, this.ny, 0) <= -0.92) hi = c;
    }
    if (lo === null || hi === null || hi < lo) lo = hi = this.ny / 2;
    this.camLo = lo; this.camHi = hi;
  };
  /* カメラを、縦の位置 cz を中心に置く */
  MazeScene.prototype.aim = function (cz) {
    var cam = this.camera, cx = this.nx / 2;
    cam.position.set(cx, Math.sin(this.tilt) * this.dist, cz + Math.cos(this.tilt) * this.dist);
    cam.lookAt(cx, 0, cz + 0.2);
  };

  MazeScene.prototype.render = function (ctx, W, Hv) {
    var T = global.THREE;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.round(W * dpr), h = Math.round(Hv * dpr);
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
    }
    if (this.aspect !== W / Hv) { this.aspect = W / Hv; this.fit(this.aspect); this.camZ = null; }
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
    this.cube.yaw.rotation.y = this.yaw;
    this.bodyMat.color.copy(this.tint);
    this.shadow.position.set(this.cube.position.x, 0.01, this.cube.position.z);
    this.shadow.scale.setScalar(R * 3.2 * (1 - lift * 0.5));

    /* 音符の縦位置へカメラを寄せる（端では止める） */
    var want = Math.max(this.camLo, Math.min(this.camHi, this.cube.position.z));
    this.camZ = this.camZ == null ? want : this.camZ + (want - this.camZ) * (1 - Math.exp(-8 * this.camT));
    this.camT = 0;
    this.aim(this.camZ);
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, Hv);
  };

  global.MazeScene = MazeScene;
})(window);
