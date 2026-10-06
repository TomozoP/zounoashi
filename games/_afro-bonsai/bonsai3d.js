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
    this.scene.children.forEach(function (o) { o.layers.enable(1); });
    /* 顔だけを毎コマ描く小さな画面（髪や鉢は描き直さないので軽い） */
    this.faceR = new T.WebGLRenderer({ antialias: true, alpha: true });
    this.faceR.outputColorSpace = T.SRGBColorSpace; this.faceR.setClearColor(0x000000, 0);
    this.faceCam = new T.OrthographicCamera(0, 1, 0, -1, 1, 5000); this.faceCam.position.set(0, 0, 2000); this.faceCam.layers.set(1);
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
      var inner = new T.Mesh(new T.SphereGeometry(1, 16, 12), std(0x8a5e38, { roughness: 0.8 }));
      inner.scale.set(7, 12, 6); inner.position.set(cx + s * 86, -(cy + 4), 146); G.add(inner);
    });
    /* 幹 */
    var bark = std(0x9a6c45, { roughness: 1 });
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
    for (var j = 0; j < N - 1; j += step) for (i = 0; i < N - 1; i += step) {
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
    /* 生え際の粒は別にして、顔を毎コマ描き直すときも一緒に描く（顔の上に前髪がかぶるため） */
    var hairGeo = new T.IcosahedronGeometry(5.2, 0), hairM = std(0xffffff, { roughness: 0.95, flatShading: true });
    var col = new T.Color(), c3 = g.look.hair, cols3 = cells.map(function () { return 0.55 + R() * 0.9; });
    var rot = pts.map(function () { return R() * 6.28; });
    this.hairs = [[], []].map(function (list, which) {
      pts.forEach(function (a, n) {
        var fringe = a[1] > cy - 50 && a[1] < cy && Math.abs(a[0] - cx) < 90;
        if (fringe === (which === 1)) list.push(n);
      });
      var hm = new T.InstancedMesh(hairGeo, hairM, Math.max(1, list.length));
      hm.count = list.length;
      list.forEach(function (n, i) {
        var mm = cols3[n];
        col.setRGB(c3[0] / 255 * mm, c3[1] / 255 * mm, c3[2] / 255 * mm, T.SRGBColorSpace);
        hm.setColorAt(i, col);
      });
      if (which === 1) hm.layers.enable(1);
      G.add(hm);
      return { mesh: hm, list: list };
    });
    this.cells = cells; this.pts = pts; this.rot = rot; this.N = N;
    this.lastHair = null;
    this.g = g;
  };


  /* 顔の形。正面から平行に見るので、凹凸は前後（z）の起伏で付けて光の当たり方で見せる。
     gu, gv は顔の中心からのゲーム座標（右・下が正）。
     e: null ふつう / "joy" 大喜び / "shock" 愕然（大きく開いた口） / "ouch" 痛がる（目をつぶって歯を食いしばる） */
  function gs(dx, dy, sx, sy) { return Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy)); }
  /* 口の開き：上の縁と下の縁（開いていなければ null） */
  function mouthEdges(gu, e) {
    var g2 = gu * gu;
    if (e === "joy") { if (Math.abs(gu) >= 34) return null; return [60 - 0.012 * g2, 76 - 0.0258 * g2]; }
    if (e === "ouch") { if (Math.abs(gu) >= 30) return null; var c = 1 - g2 / 900; return [60 + 0.008 * g2 - 4 * c, 64 + 0.008 * g2 + 4 * c]; }
    if (e === "shock") { var q = 1 - g2 / 324; if (q <= 0) return null; var h = 22 * Math.sqrt(q); return [72 - h, 72 + h]; }
    return null;
  }
  function closedLine(gu) { return 61 + 0.004 * gu * gu; }
  /* 口の中の色：0 なし / 1 口の中（暗い） / 2 歯 */
  /* 顔のパーツの大きさ：横に FX 倍、縦に FY 倍（CY0 を中心に）。顔の座標をパーツの元の座標に戻してから形を決める */
  var FX = 1.25, FY = 1.1, CY0 = 30;
  function fx(u) { return u * FX; }
  function fy(v) { return CY0 + (v - CY0) * FY; }
  function mouthKind(gu, gv, e) {
    gu /= FX; gv = CY0 + (gv - CY0) / FY;
    var m = mouthEdges(gu, e);
    if (!m || gv <= m[0] || gv >= m[1]) return 0;
    var f = (gv - m[0]) / (m[1] - m[0]);
    if (e === "joy") return f < 0.38 ? 2 : 1;
    if (e === "ouch") return Math.abs(f - 0.5) < 0.09 ? 1 : 2;
    return f < 0.12 ? 2 : 1;
  }
  function relief(gu, gv, e) {
    gu /= FX; gv = CY0 + (gv - CY0) / FY;
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
    d += 5 * gs(gu, gv - 92, 22, 10);              /* あご */
    var m = mouthEdges(gu, e);
    if (m) {
      var lw = gs(gu, 0, e === "shock" ? 16 : 30, 1);
      d += 5 * lw * gs(0, gv - (m[0] - 3), 1, 3.5); /* 上唇 */
      d += 6 * lw * gs(0, gv - (m[1] + 3), 1, 4);   /* 下唇 */
      if (gv > m[0] && gv < m[1]) d -= 16;          /* 口の中 */
    } else if (!e || e === "joy" || e === "ouch") {
      var my = closedLine(gu), lip = gs(gu, 0, 22, 1);
      d += 4 * lip * gs(0, gv - (my - 5), 1, 4);
      d += 5 * lip * gs(0, gv - (my + 6), 1, 5);
      d -= 2 * gs(gu, gv - 49, 4, 4);              /* 人中 */
    }
    if (e === "joy") {
      d += 9 * gs(au - 38, gv - 38, 14, 11);       /* 頬が大きく上がる */
      d -= 4 * gs(au - 36, gv - 56, 4, 14);        /* 深いほうれい線 */
    }
    if (e === "ouch") {
      d += 6 * gs(au - 38, gv - 26, 14, 10);       /* 頬が目を押し上げる */
      d -= 3 * gs(au - 6, gv + 8, 1.6, 9);         /* 眉間のしわ */
      d -= 2.5 * gs(au - 9, gv - 14, 6, 1.3);      /* 鼻のしわ */
      d -= 2.5 * gs(au - 9, gv - 19, 6, 1.3);
      d -= 3 * gs(au - 34, gv - 62, 3, 10);        /* 口の脇のしわ */
    }
    if (e === "shock") d -= 3 * gs(au - 44, gv - 40, 14, 18);   /* 頬がこける */
    return d;
  }
  /* 肌の色むら：頬と鼻先に赤み、唇、口の中と歯 */
  function tint(gu, gv, e, out) {
    gu /= FX; gv = CY0 + (gv - CY0) / FY;
    var au = Math.abs(gu), r = 1, g = 1, b = 1;
    /* 木目：横にゆらぐ細い縞 */
    var grain = 0.5 + 0.5 * Math.sin(gv * 0.55 + Math.sin(gu * 0.045 + gv * 0.01) * 3.2 + Math.sin(gu * 0.13) * 0.6);
    grain = Math.pow(grain, 6) * 0.16 + 0.03 * Math.sin(gu * 0.9 + gv * 0.2);
    r *= 1 - grain; g *= 1 - grain * 1.1; b *= 1 - grain * 1.2;
    var blush = (e === "joy" ? 0.9 : 0.5) * gs(au - 42, gv - 32, 18, 14) + 0.35 * gs(gu, gv - 36, 9, 7);
    if (e === "ouch") blush += 0.6 * gs(gu, gv - 10, 40, 30);
    r *= 1 + 0.04 * blush; g *= 1 - 0.14 * blush; b *= 1 - 0.1 * blush;
    var sock = gs(au - 30, gv - 4, 22, 13);
    if (e === "shock") sock *= 1.8;
    r *= 1 - 0.12 * sock; g *= 1 - 0.15 * sock; b *= 1 - 0.1 * sock;
    var m = mouthEdges(gu, e), lip = 0;
    if (m) {
      var lw = gs(gu, 0, e === "shock" ? 17 : 31, 1);
      lip = lw * Math.max(gs(0, gv - (m[0] - 3), 1, 3.5), gs(0, gv - (m[1] + 3), 1, 4.5));
    } else {
      var my = closedLine(gu), lw2 = gs(gu, 0, 23, 1);
      lip = lw2 * Math.max(gs(0, gv - (my - 4), 1, 4), gs(0, gv - (my + 5), 1, 5.5));
      var seam = gs(gu, 0, 20, 1) * gs(0, gv - my, 1, 1.3);
      r *= 1 - 0.55 * seam; g *= 1 - 0.7 * seam; b *= 1 - 0.65 * seam;
    }
    r *= 1 - 0.05 * lip; g *= 1 - 0.42 * lip; b *= 1 - 0.3 * lip;
    out[0] = r; out[1] = g; out[2] = b;
  }
  /* 目と眉の形（表情ごと）。a は上まぶたの縁の角度（大きいほど閉じる） */
  var EYE = {
    n: { a: 0.38, low: 0, iris: 1, brow: function (u) { return -18 + 4 * u * u - 2 * Math.sin(u * Math.PI); } },
    joy: { a: 0.6, low: 4, iris: 1, brow: function (u) { return -19 + 4 * u * u - 4 * Math.sin(u * Math.PI); } },
    ouch: { a: 0.8, low: 4, iris: 1, brow: function (u) { return -22 + 13 * u - 2 * u * u; } },
    shock: { a: 0.2, low: -1, iris: 0.7, brow: function (u) { return -21 + 5 * u * u - 3 * Math.sin(u * Math.PI); } }
  };

  /* true / false は判定の顔で、joy / shock と同じ */
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
    var geo = new T.SphereGeometry(1, 220, 160), pos = geo.attributes.position, n = pos.count;
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
      var mk = pz > 0.3 ? mouthKind(gu, gv, expr) : 0;                 /* 歯と口の中は肌の色と別に塗る */
      if (mk === 2) { cols[i * 3] = 0.86; cols[i * 3 + 1] = 0.83; cols[i * 3 + 2] = 0.74; }
      else if (mk === 1) { cols[i * 3] = 0.09; cols[i * 3 + 1] = 0.012; cols[i * 3 + 2] = 0.015; }
    }
    geo.setAttribute("color", new T.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    var skinM = new T.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.62, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0.2, sheenColor: new T.Color(0xc89a6a) });
    F.add(new T.Mesh(geo, skinM));
    /* 目：白目・虹彩・瞳・まぶた。まばたき・視線・眉は毎コマ animate で少し動かす */
    function surf(gu, gv) { var fu = gu / 86, fv = gv / 104; return FZ + FD * Math.sqrt(Math.max(0, 1 - fu * fu - fv * fv)) + relief(gu, gv, expr); }
    var E = EYE[expr || "n"];
    var white = std(0xf4f0e8, { roughness: 0.2 }), iris = std(0x4a2c18, { roughness: 0.3 }), pupil = std(0x0b0806, { roughness: 0.1 });
    var lidM = std(g.look.skin, { roughness: 0.55 }), lashM = std(0x1a120c, { roughness: 0.8 });
    var bm = std(0x3a2414, { roughness: 1 });   /* 眉は濃い木の色 */
    var eyes = this.eyes = [];
    [-1, 1].forEach(function (s) {
      var ex = fx(s * 30), ey = fy(2), R = 12.8, ez = surf(ex, ey) - R + 5;
      var at = new T.Vector3(cx + ex, -(cy + ey), ez);
      var eye = new T.Mesh(new T.SphereGeometry(R, 32, 24), white); eye.position.copy(at); F.add(eye);
      /* 黒目は目玉の中心で回すと視線が動く */
      var look = new T.Group(); look.position.copy(at); F.add(look);
      var ir = new T.Mesh(new T.CircleGeometry(5.6 * E.iris, 32), iris); ir.position.set(0, -0.5, R + 0.05); look.add(ir);
      var pu = new T.Mesh(new T.CircleGeometry(2.6 * E.iris, 24), pupil); pu.position.set(0, -0.5, R + 0.1); look.add(pu);
      var hl = new T.Mesh(new T.CircleGeometry(1.3, 12), new T.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(-2, 1.5, R + 0.15); look.add(hl);
      /* 上まぶた：目玉より少し大きい殻の上側。前に回すと閉じる */
      var a = Math.PI * E.a, lidG = new T.Group(); lidG.position.copy(at); F.add(lidG);
      var lid = new T.Mesh(new T.SphereGeometry(R + 1.2, 32, 16, 0, Math.PI * 2, 0, a), lidM);
      lid.scale.set(1.04, 1, 1); lidG.add(lid);
      var pts = [];
      for (var t = -1; t <= 1.001; t += 0.1) {
        var ang = t * 1.25, rr = R + 1.6, y = Math.cos(a) * rr, xz = Math.sin(a) * rr;
        pts.push(new T.Vector3(Math.sin(ang) * xz * 1.04, y, Math.cos(ang) * xz));
      }
      lidG.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, 0.9, 6, false), lashM));
      /* 下まぶたのふくらみ */
      var low = new T.Mesh(new T.TorusGeometry(R * 0.95, 1.6 + E.low * 0.3, 8, 24, Math.PI * 0.8), lidM);
      low.rotation.z = Math.PI + Math.PI * 0.1; low.scale.set(1.1, 0.55, 1);
      low.position.set(at.x, at.y + 0.5 + E.low, ez + R * 0.55); F.add(low);
      /* 眉：毛の色の太い線を顔の表面に沿わせる。眉頭を太く、眉尻を細く */
      var bp = [], bw = g.look.brow ? 4 : 2.6;
      for (var u = 0; u <= 1.001; u += 0.1) {
        var bx = fx(s * (16 + 30 * u)), by = Math.max(-20, fy(E.brow(u)));
        bp.push(new T.Vector3(cx + bx, -(cy + by), surf(bx, by) + bw * 0.4 + 1));
      }
      var bc = new T.CatmullRomCurve3(bp), brow = new T.Mesh(new T.TubeGeometry(bc, 20, 1, 8, false), bm);
      var bpa = brow.geometry.attributes.position;
      for (var j = 0; j < bpa.count; j++) {
        var tt = Math.floor(j / 9) / 20, cc = bc.getPointAt(tt), wd = bw * (1.1 - 0.6 * tt);
        bpa.setXYZ(j, cc.x + (bpa.getX(j) - cc.x) * wd, cc.y + (bpa.getY(j) - cc.y) * wd, cc.z + (bpa.getZ(j) - cc.z) * wd * 0.5);
      }
      brow.geometry.computeVertexNormals();
      var browG = new T.Group(); browG.add(brow); F.add(browG);
      /* 閉じた目：目玉を隠してまぶたの肌でふさぐ。線は本物の目と同じく、まつげの生え際・二重の溝・下まぶた・目尻のしわ。
         笑うと下まぶたが押し上がって細い弧になり、痛いとぎゅっと閉じて目尻にしわが寄る */
      var shutG = new T.Group(); shutG.position.copy(at); F.add(shutG);
      var sk = new T.Color(g.look.skin), lidShut = std(sk.clone().multiplyScalar(0.93).getHex(), { roughness: 0.55 });
      var crM = std(sk.clone().multiplyScalar(0.62).getHex(), { roughness: 0.8 });
      var squeeze = expr === "ouch" ? 1 : expr === "joy" ? 0.5 : 0;
      var cover = new T.Mesh(new T.SphereGeometry(1, 28, 18), lidShut);
      cover.scale.set(R * 1.12, R * 0.95, R * (0.55 + 0.1 * squeeze)); cover.position.z = R * 0.4; shutG.add(cover);
      function front(x, y) { return R * (0.95 + 0.1 * squeeze) + 1.2 - 1.6 * (x / R) * (x / R); }   /* ふくらみの少し手前（正面からは区別がつかない） */
      function line(fy, w, m) {
        var pts = [];
        for (var q = 0; q <= 1.001; q += 0.1) { var lx = (q * 2 - 1) * R * 1.05, qq = 1 - (q * 2 - 1) * (q * 2 - 1), ly = fy(lx, qq); pts.push(new T.Vector3(lx, ly, front(lx, ly))); }
        shutG.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, w, 6, false), m));
      }
      /* まつげの生え際 */
      if (expr === "joy") line(function (x, qq) { return -R * 0.18 + R * 0.16 * qq; }, 0.8, lashM);
      else if (expr === "ouch") line(function (x, qq) { return -R * 0.08 + R * 0.04 * qq; }, 1.0, lashM);
      else line(function (x, qq) { return -R * 0.28 - R * 0.1 * qq; }, 0.65, lashM);
      /* 二重の溝 */
      line(function (x, qq) { return R * (0.3 - 0.1 * squeeze) + R * 0.22 * qq; }, 0.45, crM);
      /* 下まぶたのふくらみ（笑う・痛いと押し上がる） */
      var bag = new T.Mesh(new T.SphereGeometry(1, 20, 12), lidM);
      bag.scale.set(R * 1.0, R * (0.28 + 0.14 * squeeze), R * 0.4); bag.position.set(0, -R * (0.62 - 0.22 * squeeze), R * 0.62); shutG.add(bag);
      /* 目尻のしわ */
      for (var w = 0; w < (squeeze ? (expr === "ouch" ? 3 : 2) : 0); w++) {
        var ox2 = s * R * 1.1, ang = (w - 0.8) * 0.45, len = R * (0.5 + 0.25 * squeeze);
        var wp = [0, 0.5, 1].map(function (t) { var xx = ox2 + s * Math.cos(ang) * len * t, yy = Math.sin(ang) * len * t - R * 0.1; return new T.Vector3(xx, yy, front(R * 0.9, yy) - 2.5 * t); });
        shutG.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(wp), 6, 0.4, 5, false), crM));
      }
      var openParts = [eye, look, lidG, low];
      eyes.push({ s: s, lid: lidG, a: a, look: look, brow: browG, shut: shutG, open: openParts, closed: expr === "ouch" || expr === "joy" });
    });
    /* 毎コマ描き直す顔の範囲（髪がかぶらない生え際の下から口まで） */
    F.traverse(function (o) { o.layers.enable(1); });
    this.faceRect = [cx - 80, cy - 25, 160, 130];
  };

  /* 生き物らしさ：まばたき、視線のふらつき、眉と目元のかすかな動き。形は作り直さず回すだけ */
  BonsaiScene.prototype.animate = function (now) {
    if (!this.eyes) return;
    /* 反応の震え・跳ねは顔だけ動かす。動いている間は全体も描き直す */
    var j = this.jolt || { x: 0, y: 0 }, fp = this.faceGroup.position;
    if (fp.x !== j.x || fp.y !== -j.y) { fp.set(j.x, -j.y, 0); this.stale = true; }
    var A = this.anim || (this.anim = { blink: now + 1.5, gx: 0, gy: 0, tx: 0, ty: 0, next: now + 1 });
    if (now > A.next) { A.tx = (Math.random() * 2 - 1) * 0.9; A.ty = (Math.random() * 2 - 1) * 0.5; A.next = now + 0.6 + Math.random() * 2.2; }
    var f = 0.25; A.gx += (A.tx - A.gx) * f; A.gy += (A.ty - A.gy) * f;
    /* はさみを持っている間は、両目ではさみを追う */
    var aim = this.aim, cam = this.g;
    var bt = now - A.blink, bl = 0;
    if (bt > 0) { bl = bt < 0.07 ? bt / 0.07 : bt < 0.17 ? 1 - (bt - 0.07) / 0.1 : 0; if (bt > 0.17) A.blink = now + 1.8 + Math.random() * 3.5; }
    var n1 = Math.sin(now * 0.9) * 0.6 + Math.sin(now * 2.3 + 1) * 0.4, n2 = Math.sin(now * 0.7 + 2) * 0.5 + Math.sin(now * 1.9) * 0.5;
    this.eyes.forEach(function (e) {
      var shut = e.closed || bl > 0.4;
      e.shut.visible = shut;
      e.open.forEach(function (o) { o.visible = !shut; });
      e.lid.rotation.x = 0.06 * n2;
      var ry = A.gx * 0.32, rx = A.gy * 0.25;
      if (aim && cam) {
        var dx = aim.x - (cam.cx + fx(e.s * 30)), dy = aim.y - (cam.cy + fy(2));
        ry = Math.max(-0.55, Math.min(0.55, Math.atan2(dx, 160)));
        rx = Math.max(-0.45, Math.min(0.45, Math.atan2(dy, 160)));
      }
      e.ry = e.ry == null ? ry : e.ry + (ry - e.ry) * 0.35; e.rx = e.rx == null ? rx : e.rx + (rx - e.rx) * 0.35;
      e.look.rotation.y = e.ry; e.look.rotation.x = e.rx;
      e.brow.position.y = 1.4 * n1 + (e.s > 0 ? 0.6 : -0.6) * n2;
      e.brow.rotation.z = 0;
    });
  };

  /* 残っている升目に合わせて粒を出し入れする */
  BonsaiScene.prototype.setHair = function (hair, ver) {
    if (ver === this.lastHair) return;
    this.lastHair = ver;
    this.stale = true;
    var m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s1 = new T.Vector3(1, 1, 1), s0 = new T.Vector3(0, 0, 0), p = new T.Vector3();
    var self = this, NN = this.N;
    this.hairs.forEach(function (h) {
      h.list.forEach(function (n, i) {
        var a = self.pts[n];
        p.set(a[0], -a[1], a[2]);
        e.set(self.rot[n], self.rot[n] * 1.7, 0); q.setFromEuler(e);
        var k = self.cells[n], left = hair[k] + hair[k + 1] + hair[k + NN] + hair[k + NN + 1];
        m.compose(p, q, left >= 2 ? s1 : s0);   /* 粒の下の4升のうち半分以上残っていれば見せる */
        h.mesh.setMatrixAt(i, m);
      });
      h.mesh.instanceMatrix.needsUpdate = true;
    });
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
    var now = global.performance.now() / 1000;
    this.animate(now);
    if (this.stale) { this.renderer.render(this.scene, this.camera); this.stale = false; }
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    /* 顔の範囲だけ描き直して重ねる（顔の輪郭は表情で変わらないので、下の絵の顔をそのまま覆える） */
    var r = this.faceRect;
    if (r) {
      var x0 = Math.floor(r[0] * dpr) / dpr, y0 = Math.floor(r[1] * dpr) / dpr, x1 = Math.ceil((r[0] + r[2]) * dpr) / dpr, y1 = Math.ceil((r[1] + r[3]) * dpr) / dpr;
      var fw = Math.round((x1 - x0) * dpr), fh = Math.round((y1 - y0) * dpr), fc = this.faceCam;
      if (fw !== this.fw || fh !== this.fh) { this.faceR.setSize(fw, fh, false); this.fw = fw; this.fh = fh; }
      if (fc.left !== x0 || fc.top !== -y0 || fc.right !== x1) { fc.left = x0; fc.right = x1; fc.top = -y0; fc.bottom = -y1; fc.updateProjectionMatrix(); }
      this.faceR.render(this.scene, fc);
      ctx.drawImage(this.faceR.domElement, x0, y0, x1 - x0, y1 - y0);
    }
    return true;
  };

  global.BonsaiScene = BonsaiScene;
})(window);
