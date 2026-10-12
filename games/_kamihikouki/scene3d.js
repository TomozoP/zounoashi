/* 紙飛行機の立体の場面。机の上で折る場面と、原っぱで飛ばす場面の2つ。
   ゲーム側（index.html）が sync(状態) で紙の面・飛行の位置を渡し、ここは見た目だけを受け持つ。
   紙の座標は横1・縦1.414（機首が上）。飛ぶ場面では 1 = 0.21m（A4の横幅）として縮める。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var PAPER_M = 0.21;

  /* 紙の面（凸の多角形）を三角形と縁の線にする。map(x, y, l) → [x, y, z] */
  function paperGeometry(faces, map, maxL) {
    var pos = [], col = [], uv = [], line = [];
    faces.forEach(function (f) {
      var v = f.p.map(function (p) { return map(p[0], p[1], f.l); });
      var t = f.p.map(function (p) { return [p[2] || 0, p[3] || 0]; });
      var c = 0.86 + 0.14 * (maxL ? f.l / maxL : 1);
      for (var i = 1; i < v.length - 1; i++) {
        [0, i, i + 1].forEach(function (k) { var q = v[k]; pos.push(q[0], q[1], q[2]); col.push(c, c, c * 0.985); uv.push(t[k][0], t[k][1]); });
      }
      for (var j = 0; j < v.length; j++) {
        var a = v[j], b = v[(j + 1) % v.length];
        line.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    });
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    var lg = new T.BufferGeometry();
    lg.setAttribute("position", new T.Float32BufferAttribute(line, 3));
    return { mesh: g, line: lg };
  }

  /* 平らな紙の位置（机の上）。段ごとに少しずつ浮かせる */
  function flatMap(mid) {
    return function (x, y, l) { return [x, 0.001 + l * 0.004, -(y - mid)]; };
  }
  /* 機体の形：真ん中で谷に折り、胴（KEEL の内側）は下へ垂れ、外側は少し上反りの翼になる */
  function planeMap(mid, keel) {
    var dih = 0.16, cs = Math.cos(dih), sn = Math.sin(dih);
    return function (x, y, l) {
      var ax = Math.abs(x), sg = x < 0 ? -1 : 1;
      if (ax < keel) return [sg * (0.003 + l * 0.0025), -(keel - ax), -(y - mid)];
      var w = ax - keel;
      return [sg * w * cs, w * sn + l * 0.0025, -(y - mid)];
    };
  }

  /* 紙ごとの模様（文字は入れない） */
  function paperTexture(id, ratio) {
    return Z3.canvasTex(256, Math.round(256 * ratio), function (g, w, h) {
      var r = Z3.rng(id.length * 7 + 3), i;
      var base = { copy: "#fbfaf6", origami: "#e04a3c", news: "#e9e5d9", drawing: "#f4ecd4", tissue: "#ffffff", cardboard: "#bb8b55" }[id];
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      if (id === "news") {
        /* 見出しの太い帯・写真・細い行の段組み（読める文字は描かない） */
        g.fillStyle = "#3a3a3a"; g.fillRect(w * 0.08, h * 0.05, w * 0.84, h * 0.045);
        g.fillStyle = "#9a978e"; g.fillRect(w * 0.08, h * 0.13, w * 0.5, h * 0.22);
        g.fillStyle = "rgba(60,60,60,.55)";
        for (var col = 0; col < 4; col++) {
          var x0 = w * (0.08 + col * 0.215);
          for (var y = h * 0.13; y < h * 0.95; y += 5) {
            if (col < 2 && y < h * 0.36) continue;
            g.fillRect(x0, y, w * (0.18 - r() * 0.03), 2);
          }
        }
      } else if (id === "cardboard") {
        for (i = 0; i < w; i += 9) { g.fillStyle = "rgba(120,80,40,.25)"; g.fillRect(i, 0, 3, h); }
        for (i = 0; i < 500; i++) { g.fillStyle = "rgba(90,60,30,.15)"; g.fillRect(r() * w, r() * h, 2, 2); }
      } else if (id === "tissue") {
        g.strokeStyle = "rgba(200,205,215,.5)"; g.lineWidth = 2;
        for (i = 0; i < h; i += 16) { g.beginPath(); for (var x = 0; x <= w; x += 8) g.lineTo(x, i + Math.sin(x / 14) * 4); g.stroke(); }
      } else if (id === "drawing") {
        for (i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(170,150,110,.25)" : "rgba(255,255,255,.4)"; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
      } else {
        for (i = 0; i < 600; i++) { g.fillStyle = id === "origami" ? "rgba(120,20,20,.12)" : "rgba(150,145,135,.08)"; g.fillRect(r() * w, r() * h, 2, 2); }
      }
    });
  }

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { tone: "aces", exposure: 1.05 }, camera: { fov: 32, near: 0.05, far: 400 }, dpr: 1.5 });
    this.camera = st.camera;
    this.paperMat = new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: T.DoubleSide });
    this.lineMat = new T.LineBasicMaterial({ color: 0x8c877d });

    /* ---- 机 ---- */
    var fold = this.foldScene = new T.Scene();
    fold.background = new T.Color(0x6e4a2c);
    fold.add(new T.HemisphereLight(0xfff6ea, 0x8a6a50, 1.6));
    var key = new T.DirectionalLight(0xfff0e0, 2.0); key.position.set(-2, 6, 3); fold.add(key);
    var desk = new T.Mesh(new T.PlaneGeometry(8, 8), new T.MeshLambertMaterial({ map: Z3.canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = "#a8774a"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      for (var i = 0; i < 140; i++) {
        var y = r() * h;
        g.strokeStyle = "rgba(" + (r() < 0.5 ? "90,55,25" : "200,150,100") + "," + (0.05 + r() * 0.12) + ")";
        g.lineWidth = 1 + r() * 4;
        g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 20, w * 0.7, y + (r() - 0.5) * 20, w, y + (r() - 0.5) * 10);
        g.stroke();
      }
    }, 2) }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -0.002;
    fold.add(desk);
    this.foldPaper = new T.Mesh(new T.BufferGeometry(), this.paperMat);
    this.foldLine = new T.LineSegments(new T.BufferGeometry(), this.lineMat);
    fold.add(this.foldPaper); fold.add(this.foldLine);
    /* 最初に半分に折って開いた筋 */
    var cg = new T.BufferGeometry();
    cg.setAttribute("position", new T.Float32BufferAttribute([0, 0.0025, -0.707, 0, 0.0025, 0.707], 3));
    this.crease = new T.LineSegments(cg, new T.LineBasicMaterial({ color: 0xc9c4ba }));
    fold.add(this.crease);

    /* ---- 原っぱ ---- */
    var fly = this.flyScene = new T.Scene();
    fly.background = new T.Color(0x9fd3f2);
    fly.fog = new T.Fog(0x9fd3f2, 60, 230);
    fly.add(new T.HemisphereLight(0xeaf6ff, 0xa9b890, 1.5));
    var sun = new T.DirectionalLight(0xfff3dc, 1.8); sun.position.set(-20, 40, 10); fly.add(sun);
    var grass = new T.Mesh(new T.PlaneGeometry(160, 260), new T.MeshLambertMaterial({ map: Z3.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#6fa544"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(11);
      for (var i = 0; i < 1600; i++) {
        g.fillStyle = r() < 0.5 ? "rgba(60,110,40,.35)" : "rgba(150,200,90,.3)";
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 4);
      }
    }, 40) }));
    grass.rotation.x = -Math.PI / 2; grass.position.z = -120;
    fly.add(grass);
    /* 5mごとの白線（10mごとに太く） */
    var white = new T.MeshBasicMaterial({ color: 0xf4f4ee, transparent: true, opacity: 0.85 });
    for (var m = 5; m <= 200; m += 5) {
      var ln = new T.Mesh(new T.PlaneGeometry(m % 10 ? 10 : 18, m % 10 ? 0.08 : 0.16), white);
      ln.rotation.x = -Math.PI / 2; ln.position.set(0, 0.01, -m);
      fly.add(ln);
    }
    var start = new T.Mesh(new T.PlaneGeometry(4, 0.12), new T.MeshBasicMaterial({ color: 0xe0533a }));
    start.rotation.x = -Math.PI / 2; start.position.set(0, 0.012, 0);
    fly.add(start);
    /* 両側の木（2回の描画でまとめて描く） */
    var r = Z3.rng(5), N = 70;
    var leaf = new T.InstancedMesh(new T.ConeGeometry(1.6, 4.2, 7), new T.MeshLambertMaterial({ color: 0x3f7a35 }), N);
    var trunk = new T.InstancedMesh(new T.CylinderGeometry(0.22, 0.28, 1.4, 6), new T.MeshLambertMaterial({ color: 0x6b4a2e }), N);
    var mtx = new T.Matrix4(), sc = new T.Vector3(), q = new T.Quaternion();
    for (var i = 0; i < N; i++) {
      var side = i % 2 ? 1 : -1, x = side * (14 + r() * 26), z = 4 - r() * 230, s = 0.8 + r() * 0.8;
      sc.set(s, s, s);
      mtx.compose(new T.Vector3(x, 0.7 * s, z), q, sc); trunk.setMatrixAt(i, mtx);
      mtx.compose(new T.Vector3(x, (1.4 + 2.1) * s, z), q, sc); leaf.setMatrixAt(i, mtx);
    }
    fly.add(leaf); fly.add(trunk);
    /* 機体 */
    this.plane = new T.Group();
    this.plane.rotation.order = "YXZ";
    this.planeMesh = new T.Mesh(new T.BufferGeometry(), this.paperMat);
    this.planeLine = new T.LineSegments(new T.BufferGeometry(), this.lineMat);
    var inner = this.planeInner = new T.Group(); inner.scale.setScalar(PAPER_M);
    inner.add(this.planeMesh); inner.add(this.planeLine);
    this.plane.add(inner);
    fly.add(this.plane);
    /* 地面の影 */
    /* 地面の影：機体の形を太陽の向きに地面へ押しつぶして描く。
       紙の重なりで濃くならないよう、同じ深さの2枚目は描かない（LessDepth） */
    this.inner = inner;
    this.shadow = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, side: T.DoubleSide, depthFunc: T.LessDepth, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.shadow.renderOrder = 1;
    this.shadow.matrixAutoUpdate = false;
    this.shadow.frustumCulled = false;
    var L = sun.position.clone().normalize(), h = 0.012;
    this.flatten = new T.Matrix4().set(
      L.y, -L.x, 0, L.x * h,
      0, 0, 0, L.y * h,
      0, -L.z, L.y, L.z * h,
      0, 0, 0, L.y);
    fly.add(this.shadow);
    /* 飛んだ跡 */
    this.trailMax = 1200;
    var tg = new T.BufferGeometry();
    tg.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(this.trailMax * 3), 3));
    this.trail = new T.Line(tg, new T.LineBasicMaterial({ color: 0xffffff }));
    this.trail.frustumCulled = false;
    fly.add(this.trail);

    this.camPos = new T.Vector3(); this.camLook = new T.Vector3();
    this.lastFaces = null; this.lastMorph = -1; this.lastPlane = null;
    this.tex = {}; this.shelf = null; this.lastPaper = -1;
  }

  GameScene.prototype.setPaper = function (mesh, line, faces, map) {
    var maxL = 0;
    faces.forEach(function (f) { maxL = Math.max(maxL, f.l); });
    var g = paperGeometry(faces, map, maxL);
    mesh.geometry.dispose(); line.geometry.dispose();
    mesh.geometry = g.mesh; line.geometry = g.line;
  };

  GameScene.prototype.texFor = function (pp) {
    return this.tex[pp.id] || (this.tex[pp.id] = paperTexture(pp.id, pp.ratio));
  };

  /* 紙を選ぶ：机の上に紙を横一列に並べ、流した位置に合わせてずらす（端と端はつながっている） */
  GameScene.prototype.syncShelf = function (s) {
    var self = this, n = s.papers.length, gap = 0.95;
    if (!this.shelf) {
      this.shelf = s.papers.map(function (pp) {
        var k = Math.min(1.3, pp.m / 0.21);
        var m = new T.Mesh(new T.PlaneGeometry(k, k * pp.ratio), new T.MeshLambertMaterial({ map: self.texFor(pp) }));
        m.rotation.x = -Math.PI / 2;
        var e = new T.LineSegments(new T.EdgesGeometry(m.geometry), self.lineMat);
        m.add(e);
        self.foldScene.add(m);
        return m;
      });
    }
    this.shelf.forEach(function (m, i) {
      var d = i - s.sel;
      d -= Math.round(d / n) * n;
      m.visible = true;
      /* 真ん中に来た紙ほど大きく */
      var near = Math.max(0, 1 - Math.abs(d));
      m.scale.setScalar(0.6 + 0.25 * near);
      m.position.set(d * gap, 0.002 + near * 0.02, 0);
    });
  };

  GameScene.prototype.sync = function (s) {
    var cam = this.camera;
    var selecting = s.state === "select" || s.state === "intro";
    if (selecting) this.syncShelf(s);
    else if (this.shelf) this.shelf.forEach(function (m) { m.visible = false; });
    this.foldPaper.visible = this.foldLine.visible = !selecting;
    if (this.lastPaper !== s.paper) {
      var pp = s.papers[s.paper];
      this.paperMat.map = this.texFor(pp); this.paperMat.needsUpdate = true;
      this.planeInner.scale.setScalar(pp.m);
      this.crease.geometry.attributes.position.setZ(0, -pp.ratio / 2);
      this.crease.geometry.attributes.position.setZ(1, pp.ratio / 2);
      this.crease.geometry.attributes.position.needsUpdate = true;
      this.lastPaper = s.paper;
    }
    var onDesk = selecting || s.state === "fold" || s.state === "make";
    this.stage.scene = onDesk ? this.foldScene : this.flyScene;
    if (onDesk) {
      if (selecting) {
        this.crease.visible = false;
      } else if (s.state === "make") {
        if (this.lastFaces !== s.planeFaces || this.lastMorph !== s.morph) {
          var e = s.morph * s.morph * (3 - 2 * s.morph), fm = flatMap(s.mid), pm = planeMap(s.mid, s.keel);
          this.setPaper(this.foldPaper, this.foldLine, s.planeFaces, function (x, y, l) {
            /* 半分に折って重なった形から、胴と翼を開いていく */
            var a = fm(x, y, l), b = pm(x, y, l);
            if (x * s.half > 0) { a[0] = -x; a[1] = 0.05 + l * 0.004; }
            return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] + s.keel + 0.01 - a[1]) * e, a[2] + (b[2] - a[2]) * e];
          });
          this.lastFaces = s.planeFaces; this.lastMorph = s.morph;
        }
        this.crease.visible = false;
      } else if (this.lastFaces !== s.faces) {
        this.setPaper(this.foldPaper, this.foldLine, s.faces, flatMap(s.mid));
        this.lastFaces = s.faces; this.lastMorph = -1;
        this.crease.visible = true;
      }
      /* 真上から見下ろす。紙の座標と画面の座標がちょうど合うように高さを決める */
      var D = s.H / (2 * s.fs * Math.tan(cam.fov * Math.PI / 360));
      var z0 = (s.H / 2 - s.pcy) / s.fs;
      var k = s.state === "make" ? Math.max(0, (s.morph - 0.3) / 0.7) : 0;
      k = k * k * (3 - 2 * k);
      cam.position.set(1.5 * k, D + (1.3 - D) * k, z0 + (2.3 - z0) * k);
      cam.up.set(0, k, -(1 - k)).normalize();
      cam.lookAt(0, 0.12 * k, z0 * (1 - k));
      return;
    }

    /* ---- 飛ぶ場面 ---- */
    if (this.lastPlane !== s.planeFaces) {
      this.setPaper(this.planeMesh, this.planeLine, s.planeFaces, planeMap(s.mid, s.keel));
      this.lastPlane = s.planeFaces;
    }
    var p = this.plane, f = s.fl;
    if (!f) {
      /* 手に持って構えている */
      p.position.set(0, 1.6 + Math.sin(s.t * 2.2) * 0.008, 0);
      p.rotation.set(0.06, 0, Math.sin(s.t * 1.7) * 0.02);
      this.camPos.set(0, 1.8, 0.95); this.camLook.set(0, 1.5, -2.5);
      cam.position.copy(this.camPos); cam.up.set(0, 1, 0); cam.lookAt(this.camLook);
      this.trail.geometry.setDrawRange(0, 0);
    } else {
      p.position.set(f.x, f.y, f.z);
      p.rotation.set(f.gam, f.psi, f.phi);
      var hx = -Math.sin(f.psi), hz = -Math.cos(f.psi);
      var want = new T.Vector3(), look = new T.Vector3();
      if (s.state === "fly") {
        want.set(f.x - hx * 1.5, Math.max(0.35, f.y + 0.45), f.z - hz * 1.5);
        look.set(f.x + hx * 1.5, f.y, f.z + hz * 1.5);
        this.camPos.lerp(want, 0.12); this.camLook.lerp(look, 0.2);
      } else {
        /* 着地したら落ちた機体に寄り、まわりを回る（向きは指で変えられる） */
        var o = s.orbit, R = 1.3, yaw = f.psi + o.yaw;
        want.set(f.x + Math.sin(yaw) * Math.cos(o.pitch) * R, 0.03 + Math.sin(o.pitch) * R, f.z + Math.cos(yaw) * Math.cos(o.pitch) * R);
        look.set(f.x, 0.04, f.z);
        this.camPos.lerp(want, s.state === "land" ? 0.06 : 0.3); this.camLook.lerp(look, 0.15);
      }
      cam.position.copy(this.camPos); cam.up.set(0, 1, 0); cam.lookAt(this.camLook);
      var a = this.trail.geometry.attributes.position, n = Math.min(this.trailMax, s.trail.length);
      for (var i = 0; i < n; i++) a.setXYZ(i, s.trail[i].x, s.trail[i].y, s.trail[i].z);
      a.needsUpdate = true;
      this.trail.geometry.setDrawRange(0, n);
    }
    this.shadow.geometry = this.planeMesh.geometry;
    p.updateMatrixWorld(true);
    this.shadow.matrix.multiplyMatrices(this.flatten, this.inner.matrixWorld);
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
