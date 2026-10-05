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
    this.stale = true;
    if (this.group) { this.scene.remove(this.group); this.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    var G = this.group = new T.Group();
    this.scene.add(G);
    var cx = g.cx, cy = g.cy, P = g.potY;
    var skin = std(g.look.skin, { roughness: 0.6 });
    /* 顔は表情で作り直すので別の組に入れる（下の buildFace）。ここでは耳だけ */
    this.faceZ = 150; this.faceD = 60;
    this.faceGroup = null; this.faceKey = "";
    [-1, 1].forEach(function (s) {
      var ear = new T.Mesh(new T.SphereGeometry(1, 20, 14), skin);
      ear.scale.set(13, 20, 10); ear.position.set(cx + s * 84, -(cy + 4), 140); G.add(ear);
      var inner = new T.Mesh(new T.SphereGeometry(1, 16, 12), std(0xd9a93c, { roughness: 0.7 }));
      inner.scale.set(7, 12, 6); inner.position.set(cx + s * 86, -(cy + 4), 146); G.add(inner);
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
    this.g = g;
  };


  /* 顔の形。正面から平行に見るので、凹凸は前後（z）の起伏で付けて光の当たり方で見せる。
     gu, gv は顔の中心からのゲーム座標（右・下が正） */
  function gs(dx, dy, sx, sy) { return Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy)); }
  function mouthLine(gu, expr) {
    if (expr === "joy") return 62 - 0.012 * Math.min(gu * gu, 26 * 26);   /* 口角が上がる */
    if (expr === "ouch") return 60 + 0.009 * Math.min(gu * gu, 26 * 26);  /* 口をへの字に食いしばる */
    return 61 + 0.004 * gu * gu;
  }
  function relief(gu, gv, expr) {
    var au = Math.abs(gu), d = 0;
    d -= 9 * gs(au - 30, gv - 2, 19, 12);          /* 目のくぼみ */
    d += 4 * gs(au - 30, gv - 15, 25, 6);          /* 眉の骨 */
    d -= 3 * gs(au - 70, gv - 5, 12, 22);          /* こめかみ */
    d += 5 * gs(gu, gv - 8, 6, 12);                /* 鼻すじ */
    d += 15 * gs(gu, gv - 28, 8, 12);              /* 鼻 */
    d += 6 * gs(gu, gv - 37, 8, 6);                /* 鼻先 */
    d += 5 * gs(au - 11, gv - 38, 6, 5);           /* 小鼻 */
    d -= 4 * gs(au - 7, gv - 43, 3, 2.5);          /* 鼻の穴 */
    d += 5 * gs(au - 44, gv - 22, 17, 14);         /* 頬骨 */
    d -= 3 * gs(au - 28, gv - 50, 6, 12);          /* ほうれい線 */
    d -= 2 * gs(gu, gv - 49, 4, 4);                /* 人中 */
    var my = mouthLine(gu, expr), w = expr === "shock" ? 12 : 22;
    var lip = gs(gu, 0, w, 1);
    d += 4 * lip * gs(0, gv - (my - 5), 1, 4);     /* 上唇 */
    d += 5 * lip * gs(0, gv - (my + 6), 1, 5);     /* 下唇 */
    d -= 4 * lip * gs(0, gv - my, 1, 1.6);         /* 唇の合わせ目 */
    if (expr === "shock") {                          /* 「お」の口 */
      var q = (gu / 11) * (gu / 11) + ((gv - 66) / 14) * ((gv - 66) / 14);
      if (q < 1) d -= 22 * (1 - q);
    }
    if (expr === "joy") d += 3 * gs(au - 36, gv - 44, 10, 8);   /* 笑うと頬が上がる */
    d += 5 * gs(gu, gv - 90, 22, 10);              /* あご */
    return d;
  }
  /* 肌の色むら：頬と鼻先に赤み、唇、口の中 */
  function tint(gu, gv, expr, out) {
    var au = Math.abs(gu), r = 1, g = 1, b = 1;
    var blush = 0.5 * gs(au - 42, gv - 30, 18, 14) + 0.35 * gs(gu, gv - 36, 9, 7);
    r *= 1 + 0.04 * blush; g *= 1 - 0.14 * blush; b *= 1 - 0.1 * blush;
    var sock = gs(au - 30, gv - 4, 22, 13);
    r *= 1 - 0.12 * sock; g *= 1 - 0.15 * sock; b *= 1 - 0.1 * sock;
    var my = mouthLine(gu, expr), w = expr === "shock" ? 13 : 23;
    var lip = gs(gu, 0, w, 1) * Math.max(gs(0, gv - (my - 4), 1, 4), gs(0, gv - (my + 5), 1, 5.5));
    r *= 1 - 0.05 * lip; g *= 1 - 0.42 * lip; b *= 1 - 0.3 * lip;
    if (expr === "shock") {
      var q = (gu / 10) * (gu / 10) + ((gv - 66) / 13) * ((gv - 66) / 13);
      if (q < 1) { r *= 0.35; g *= 0.12; b *= 0.12; }
    } else {
      var seam = gs(gu, 0, w * 0.85, 1) * gs(0, gv - my, 1, 1.3);
      r *= 1 - 0.55 * seam; g *= 1 - 0.7 * seam; b *= 1 - 0.65 * seam;
    }
    out[0] = r; out[1] = g; out[2] = b;
  }

  /* expr: null ふつう / "joy" うれしい / "shock" がっかり（「お」の口） / "ouch" いたっ（目をつぶる）。
     true / false は判定の顔で、joy / shock と同じ */
  BonsaiScene.prototype.buildFace = function (expr) {
    var g = this.g; if (!g) return;
    if (expr === true) expr = "joy"; else if (expr === false) expr = "shock";
    var key = this.key + "|" + expr;
    if (key === this.faceKey) return;
    this.faceKey = key; this.stale = true;
    if (this.faceGroup) { this.group.remove(this.faceGroup); this.faceGroup.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    var F = this.faceGroup = new T.Group(); this.group.add(F);
    var cx = g.cx, cy = g.cy, FZ = this.faceZ, FD = this.faceD;
    var base = new T.Color(g.look.skin);
    var geo = new T.SphereGeometry(1, 120, 90), pos = geo.attributes.position, n = pos.count;
    var cols = new Float32Array(n * 3), tc = [1, 1, 1];
    for (var i = 0; i < n; i++) {
      var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      var gu = px * 86, gv = -py * 104, z = pz * FD;
      if (pz > 0) {
        var k = Math.min(1, pz * 2.5);
        z += relief(gu, gv, expr) * k;
        tint(gu, gv, expr, tc);
        for (var c = 0; c < 3; c++) tc[c] = 1 + (tc[c] - 1) * k;
      } else tc[0] = tc[1] = tc[2] = 1;
      pos.setXYZ(i, cx + gu, -(cy + gv), FZ + z);
      cols[i * 3] = base.r * tc[0]; cols[i * 3 + 1] = base.g * tc[1]; cols[i * 3 + 2] = base.b * tc[2];
    }
    geo.setAttribute("color", new T.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    var skinM = new T.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.4, sheenColor: new T.Color(0xffd9a0) });
    F.add(new T.Mesh(geo, skinM));
    /* 目：白目・虹彩・瞳・まぶた */
    function surf(gu, gv) { var fu = gu / 86, fv = gv / 104; return FZ + FD * Math.sqrt(Math.max(0, 1 - fu * fu - fv * fv)) + relief(gu, gv, expr); }
    var white = std(0xf4f0e8, { roughness: 0.2 }), iris = std(0x4a2c18, { roughness: 0.3 }), pupil = std(0x0b0806, { roughness: 0.1 });
    var lidM = std(g.look.skin, { roughness: 0.55 }), lashM = std(0x1a120c, { roughness: 0.8 });
    var open = expr === "shock" ? 1.0 : expr === "joy" ? 0.45 : 0.7;   /* まぶたの開き */
    [-1, 1].forEach(function (s) {
      var ex = s * 30, ey = 2, R = 10.5, ez = surf(ex, ey) - R + 5;
      var eye = new T.Mesh(new T.SphereGeometry(R, 32, 24), white); eye.position.set(cx + ex, -(cy + ey), ez); F.add(eye);
      var ir = new T.Mesh(new T.CircleGeometry(5.6, 32), iris); ir.position.set(cx + ex, -(cy + ey + 0.5), ez + R + 0.05); F.add(ir);
      var pu = new T.Mesh(new T.CircleGeometry(2.6, 24), pupil); pu.position.set(cx + ex, -(cy + ey + 0.5), ez + R + 0.1); F.add(pu);
      var hl = new T.Mesh(new T.CircleGeometry(1.3, 12), new T.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(cx + ex - 2, -(cy + ey - 1.5), ez + R + 0.15); F.add(hl);
      /* 上まぶた：目玉より少し大きい殻の上側 */
      var a = expr === "ouch" ? Math.PI * 0.7 : Math.PI * (0.3 + 0.25 * (1 - open));
      var lid = new T.Mesh(new T.SphereGeometry(R + 1.2, 32, 16, 0, Math.PI * 2, 0, a), lidM);
      lid.scale.set(1.12, 1, 1);
      lid.position.copy(eye.position); F.add(lid);
      /* まつげの線：まぶたの縁 */
      var pts = [];
      for (var t = -1; t <= 1.001; t += 0.1) {
        var ang = t * 1.25, rr = R + 1.6;
        var y = Math.cos(a) * rr, xz = Math.sin(a) * rr;
        var v3 = new T.Vector3(Math.sin(ang) * xz * 1.15, y, Math.cos(ang) * xz);
        pts.push(v3.add(eye.position));
      }
      F.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, 0.9, 6, false), lashM));
      /* 下まぶたのふくらみ */
      var low = new T.Mesh(new T.TorusGeometry(R * 0.95, 1.6, 8, 24, Math.PI * 0.8), lidM);
      low.rotation.z = Math.PI + Math.PI * 0.1; low.scale.set(1.1, 0.55, 1);
      low.position.set(eye.position.x, eye.position.y + 0.5, ez + R * 0.55); F.add(low);
      /* 眉：毛の色の太い線を顔の表面に沿わせる */
      var hc = g.look.hair, bm = std(new T.Color(hc[0] / 255, hc[1] / 255, hc[2] / 255).getHex(), { roughness: 1 });
      var bp = [], bw = g.look.brow ? 4 : 2.6;
      for (var u = 0; u <= 1.001; u += 0.1) {
        var bx = s * (16 + 30 * u), by = -18 + 4 * u * u - 2 * Math.sin(u * Math.PI) - (expr === "shock" ? 5 : 0) + (expr === "ouch" ? 6 * (1 - u) : 0);
        bp.push(new T.Vector3(cx + bx, -(cy + by), surf(bx, by) + bw * 0.4));
      }
      var brow = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(bp), 20, 1, 8, false), bm);
      var bpa = brow.geometry.attributes.position;
      /* 眉頭を太く、眉尻を細く */
      var bc = new T.CatmullRomCurve3(bp);
      for (var j = 0; j < bpa.count; j++) {
        var sg = Math.floor(j / 9), tt = sg / 20, cc = bc.getPointAt(tt), wd = bw * (1.1 - 0.6 * tt);
        bpa.setXYZ(j, cc.x + (bpa.getX(j) - cc.x) * wd, cc.y + (bpa.getY(j) - cc.y) * wd, cc.z + (bpa.getZ(j) - cc.z) * wd * 0.5);
      }
      brow.geometry.computeVertexNormals();
      F.add(brow);
    });
  };

  /* 残っている升目に合わせて粒を出し入れする */
  BonsaiScene.prototype.setHair = function (hair, ver) {
    if (ver === this.lastHair) return;
    this.lastHair = ver;
    this.stale = true;
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
      this.stale = true;
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
      this.camera.left = 0; this.camera.right = W; this.camera.top = 0; this.camera.bottom = -H;
      this.camera.updateProjectionMatrix();
    }
    /* 場面は止まっているので、髪や画面が変わったときだけ描き直す（スマホで重くしないため） */
    if (this.stale) { this.renderer.render(this.scene, this.camera); this.stale = false; }
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  global.BonsaiScene = BonsaiScene;
})(window);
