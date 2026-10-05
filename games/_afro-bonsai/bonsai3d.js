/* アフロ盆栽の立体の絵。遊びの計算（髪の升目・切る線）はゲーム側のまま、正面からの平行投影で描くので
   ゲームの座標と画面がぴったり重なる。世界の座標は (x, -y, z)、単位はゲーム座標。
   模型はすべて基本図形から自作。three.js は random-bowling の既存配布物（MIT）を使う。 */
(function (global) {
  "use strict";
  var T;

  function rng(seed) {
    var s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function std(color, extra) {
    var o = { color: color, roughness: 0.85 };
    for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }

  function BonsaiScene() {
    T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(0, 540, 0, -960, 1, 5000);
    this.camera.position.set(0, 0, 2000);
    this.scene.add(new T.HemisphereLight(0xfff6e8, 0x6a5a48, 1.3));
    var sun = new T.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-0.6, 0.9, 1); this.scene.add(sun);
    var rim = new T.DirectionalLight(0xffe0b0, 0.8);
    rim.position.set(0.8, 0.2, 0.6); this.scene.add(rim);
    this.group = null; this.key = ""; this.w = 0; this.h = 0;
  }

  /* 場所と見た目が変わったら作り直す */
  BonsaiScene.prototype.build = function (g) {
    var key = [g.W, g.H, g.cx, g.cy, g.potY, g.look.skin, g.look.hair.join("-"), g.look.seed, g.styleId].join(",");
    if (key === this.key) return;
    this.key = key;
    if (this.group) { this.scene.remove(this.group); this.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    var G = this.group = new T.Group();
    this.scene.add(G);
    var cx = g.cx, cy = g.cy, P = g.potY;
    var skin = std(g.look.skin, { roughness: 0.6 });
    /* 顔（少しつぶした球）と耳 */
    this.faceZ = 150; this.faceD = 60;
    var face = new T.Mesh(new T.SphereGeometry(1, 40, 28), skin);
    face.scale.set(86, 104, this.faceD); face.position.set(cx, -cy, this.faceZ); G.add(face);
    [-1, 1].forEach(function (s) {
      var ear = new T.Mesh(new T.SphereGeometry(1, 20, 14), skin);
      ear.scale.set(13, 20, 10); ear.position.set(cx + s * 84, -(cy + 4), 140); G.add(ear);
    });
    /* 幹 */
    var bark = std(0x6b4a2e, { roughness: 1 });
    var curve = new T.CatmullRomCurve3([
      new T.Vector3(cx, -(cy + 60), 80),
      new T.Vector3(cx - 24, -(cy + 90 + (P - cy) * 0.33), 70),
      new T.Vector3(cx + 10, -(cy + 90 + (P - cy) * 0.62), 60),
      new T.Vector3(cx - 4, -(P + 6), 50)
    ]);
    var tube = new T.Mesh(new T.TubeGeometry(curve, 40, 1, 14, false), bark);
    /* 根元ほど太くする */
    var pos = tube.geometry.attributes.position, nor = tube.geometry.attributes.normal;
    var frames = curve.computeFrenetFrames(40, false), v = new T.Vector3();
    for (var i = 0; i < pos.count; i++) {
      var seg = Math.floor(i / 15), t = seg / 40, c = curve.getPointAt(t);
      v.set(pos.getX(i) - c.x, pos.getY(i) - c.y, pos.getZ(i) - c.z);
      var r = 26 + 18 * t * t;
      pos.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
    }
    tube.geometry.computeVertexNormals();
    G.add(tube);
    /* 鉢 */
    var potM = std(0x2f4f5f, { roughness: 0.4, metalness: 0.1 }), rimM = std(0x3d6577, { roughness: 0.35, metalness: 0.1 });
    var body = new T.Mesh(new T.CylinderGeometry(1, 0.8, 1, 4, 1), potM);
    body.rotation.y = Math.PI / 4; body.scale.set(150 * Math.SQRT2, 116, 60 * Math.SQRT2);
    body.position.set(cx, -(P + 24 + 58), 40); G.add(body);
    var rimB = new T.Mesh(new T.BoxGeometry(340, 30, 130), rimM); rimB.position.set(cx, -(P + 15), 40); G.add(rimB);
    var soil = new T.Mesh(new T.BoxGeometry(316, 8, 110), std(0x5b4630, { roughness: 1 })); soil.position.set(cx, -(P - 2), 40); G.add(soil);
    [-1, 1].forEach(function (s) {
      var f = new T.Mesh(new T.BoxGeometry(38, 16, 50), std(0x24404d)); f.position.set(cx + s * 93, -(P + 148), 40); G.add(f);
    });
    var moss = std(0x6f9a4a, { roughness: 1 }), r0 = rng(7);
    for (i = 0; i < 18; i++) {
      var m = new T.Mesh(new T.SphereGeometry(1, 10, 8), moss);
      var mx = (r0() * 2 - 1) * 150; if (Math.abs(mx) < 50) mx += mx < 0 ? -50 : 50;
      m.scale.set(10 + r0() * 14, 6 + r0() * 4, 10 + r0() * 10);
      m.position.set(cx + mx, -(P - 4), 40 + (r0() * 2 - 1) * 40); G.add(m);
    }
    /* 髪：升目2つおきに巻き毛の粒をひとつ。正面から見える表面の深さに置く */
    var N = g.N, CS = g.CS, step = 2, cells = [], pts = [];
    var R = rng(g.look.seed || 1), AR = g.AR;
    for (var j = 0; j < N; j += step) for (i = 0; i < N; i += step) {
      var k = j * N + i;
      if (!g.hairable(g.ox + (i + 0.5) * CS, g.oy + (j + 0.5) * CS)) continue;
      var x = g.ox + (i + 1) * CS + (R() - 0.5) * 3, y = g.oy + (j + 1) * CS + (R() - 0.5) * 3;
      var dx = x - g.ax, dy = y - g.ay, rr = Math.sqrt(dx * dx + dy * dy);
      var z = Math.sqrt(Math.max(0, AR * AR - rr * rr)) * 0.8;
      /* おでこの上の髪は顔より手前 */
      var fu = (x - cx) / 86, fv = (y - cy) / 104, fq = 1 - fu * fu - fv * fv;
      if (fq > 0) z = Math.max(z, this.faceZ + this.faceD * Math.sqrt(fq) + 4);
      cells.push(k); pts.push([x, y, z + (R() - 0.5) * 6]);
    }
    /* 頭から生えている枝。髪の表面のすぐ手前を通す */
    var self = this;
    function surfZ(x, y) {
      var dx = x - g.ax, dy = y - g.ay, z = Math.sqrt(Math.max(0, AR * AR - dx * dx - dy * dy)) * 0.8;
      var fu = (x - cx) / 86, fv = (y - cy) / 104, fq = 1 - fu * fu - fv * fv;
      if (fq > 0) z = Math.max(z, self.faceZ + self.faceD * Math.sqrt(fq) + 4);
      return z;
    }
    (g.branches || []).forEach(function (q) {
      var w = q[q.length - 1], pts3 = [];
      for (var k = 0; k + 1 < q.length - 1; k += 2) {
        var x0 = cx + q[k], y0 = cy + q[k + 1];
        if (k + 3 < q.length - 1) {
          var x1 = cx + q[k + 2], y1 = cy + q[k + 3];
          for (var t = 0; t < 1; t += 0.125) { var xx = x0 + (x1 - x0) * t, yy = y0 + (y1 - y0) * t; pts3.push(new T.Vector3(xx, -yy, surfZ(xx, yy) + w * 0.3)); }
        } else pts3.push(new T.Vector3(x0, -y0, surfZ(x0, y0) + w * 0.3));
      }
      var cv = new T.CatmullRomCurve3(pts3);
      var br = new T.Mesh(new T.TubeGeometry(cv, pts3.length * 3, w / 2, 10, false), bark);
      G.add(br);
      var cap = new T.Mesh(new T.SphereGeometry(w / 2, 12, 10), bark);
      cap.position.copy(pts3[pts3.length - 1]); G.add(cap);
    });
    var hairGeo = new T.IcosahedronGeometry(5.2, 0);
    var hm = new T.InstancedMesh(hairGeo, std(0xffffff, { roughness: 0.95, flatShading: true }), cells.length);
    var col = new T.Color(), c3 = g.look.hair;
    for (i = 0; i < cells.length; i++) {
      var mm = 0.55 + R() * 0.9;
      col.setRGB(c3[0] / 255 * mm, c3[1] / 255 * mm, c3[2] / 255 * mm, T.SRGBColorSpace);
      hm.setColorAt(i, col);
    }
    this.hair = hm; this.cells = cells; this.pts = pts; this.rot = pts.map(function () { return R() * 6.28; });
    G.add(hm);
    this.lastHair = null;
  };

  /* 残っている升目に合わせて粒を出し入れする */
  BonsaiScene.prototype.setHair = function (hair, ver) {
    if (ver === this.lastHair) return;
    this.lastHair = ver;
    var m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s1 = new T.Vector3(1, 1, 1), s0 = new T.Vector3(0, 0, 0), p = new T.Vector3();
    for (var i = 0; i < this.cells.length; i++) {
      var a = this.pts[i];
      p.set(a[0], -a[1], a[2]);
      e.set(this.rot[i], this.rot[i] * 1.7, 0); q.setFromEuler(e);
      m.compose(p, q, hair[this.cells[i]] ? s1 : s0);
      this.hair.setMatrixAt(i, m);
    }
    this.hair.instanceMatrix.needsUpdate = true;
  };

  BonsaiScene.prototype.render = function (ctx, W, H) {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (!(w >= 2 && h >= 2)) return false;
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
      this.camera.left = 0; this.camera.right = W; this.camera.top = 0; this.camera.bottom = -H;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  global.BonsaiScene = BonsaiScene;
})(window);
