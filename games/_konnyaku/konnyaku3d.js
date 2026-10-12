/* こんにゃく10等分の立体の見た目（three.js）。games/three-base.js の Z3 を土台にする。
   動き・切る判定はゲーム側（index.html）の2Dのまま。ここはそれを、まな板の上に写すだけ。
   ゲームの座標（横540の画面座標）を、1単位＝100 の立体の床（x-z）に置く。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var S = 0.01;           /* ゲーム座標 → 立体 */
  var THICK = 0.62;       /* こんにゃくの厚み */
  var CUT_Y = THICK * 0.6;/* 指が指す高さ（こんにゃくの上の面の近く） */
  var TILT = 0.30;        /* 真上から手前へ倒す角度（ラジアン） */

  function KonScene(o) {
    T = global.THREE;
    this.KW = o.KW; this.KH = o.KH; this.specks = o.specks;
    var st = this.stage = new Z3.Stage({
      renderer: { shadows: true, tone: "aces", exposure: 1.05 },
      camera: { fov: 30, near: 1, far: 60 },
      finish: Z3.mobile ? null : { contrast: 0.12, vignette: 0.3, grain: 0.02 }
    });
    this.scene = st.scene; this.camera = st.camera;
    this.scene.background = new T.Color(0x1d1a18);
    var L = Z3.lights(this.scene, { shadows: true, shadowSize: 6, scale: 0.9 });
    L.key.position.set(1, 9, -4);
    L.key.shadow.radius = 8;
    L.rim.intensity = 0.3;
    L.fill.intensity = 1.4;
    L.fill.position.set(1, 3, 8);   /* 手前の側面と切り口も明るく */
    this.makeEnv();
    this.makeMaterials();
    this.meshes = new Map();
    this.board = null; this.bkey = "";
    this.makeKnife();
    this.ray = new T.Raycaster();
    this.plane = new T.Plane(new T.Vector3(0, 1, 0), -CUT_Y);
  }

  /* 映り込み用の部屋：台所の天井の明かりと窓 */
  KonScene.prototype.makeEnv = function () {
    var es = new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x34302c, side: T.BackSide })));
    function panel(w, h, x, y, z, rx, ry, color) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: color, side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); es.add(m);
    }
    panel(8, 2.2, -2, 6.8, -2, Math.PI / 2, 0, 0xffffff);     /* 天井の蛍光灯 */
    panel(3, 1.2, 4, 6.8, 3, Math.PI / 2, 0, 0xfff1dc);
    panel(10, 5, 0, 4, -14.8, 0, 0, 0xfff4e6);                 /* 窓 */
    panel(5, 3, 1.5, 6.8, 6, Math.PI / 2, 0, 0xffffff);        /* カメラ側の明かり（上の面のつやになる） */
    panel(1.2, 6, -4, 6.8, 2, Math.PI / 2, 0, 0xffffff);
    var pm = new T.PMREMGenerator(this.stage.renderer);
    this.scene.environment = pm.fromScene(es, 0.03).texture;
    this.scene.environmentIntensity = 1.0;
    pm.dispose();
  };

  KonScene.prototype.makeMaterials = function () {
    var KW = this.KW, KH = this.KH;
    var r = Z3.rng(31);
    var PX = 2;   /* 貼り物の細かさ（ゲーム座標1あたり） */
    var w = KW * PX, h = KH * PX;
    /* 細かいつぶ（ひじき）。色と、でこぼこの両方で同じ場所を使う */
    var dots = [];
    for (var i = 0; i < 2600; i++) dots.push({ x: r() * w, y: r() * h, r: 0.7 + Math.pow(r(), 3) * 2.4, a: 0.45 + r() * 0.5 });
    /* 色：灰色がかった薄茶のむら＋小さな黒茶のつぶ（写真のこんにゃくに寄せる） */
    var col = Z3.canvasTex(w, h, function (g) {
      g.fillStyle = "#9a8a77"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 300; i++) {
        var x = r() * w, y = r() * h, rr = 14 + r() * 70;
        var gr = g.createRadialGradient(x, y, 0, x, y, rr);
        var d = r() < 0.5 ? "rgba(110,98,86," : "rgba(176,164,148,";
        gr.addColorStop(0, d + (0.12 + r() * 0.14) + ")"); gr.addColorStop(1, d + "0)");
        g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      dots.forEach(function (s) {
        g.fillStyle = "rgba(52,38,30," + s.a + ")";
        g.beginPath(); g.ellipse(s.x, s.y, s.r, s.r * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); g.fill();
      });
    });
    col.wrapS = col.wrapT = T.MirroredRepeatWrapping;
    /* でこぼこ：高さの絵を作り、そこから法線（ノーマルマップ）を計算する */
    var nw = Math.round(w / 2), nh = Math.round(h / 2);
    var hc = document.createElement("canvas"); hc.width = nw; hc.height = nh;
    var hg = hc.getContext("2d");
    hg.fillStyle = "#808080"; hg.fillRect(0, 0, nw, nh);
    for (var j = 0; j < 700; j++) {            /* ゆるいうねり */
      var x = r() * nw, y = r() * nh, rr = 6 + r() * 26, up = r() < 0.5;
      var gr = hg.createRadialGradient(x, y, 0, x, y, rr);
      var c0 = up ? "rgba(255,255,255," : "rgba(0,0,0,";
      gr.addColorStop(0, c0 + (0.05 + r() * 0.07) + ")"); gr.addColorStop(1, c0 + "0)");
      hg.fillStyle = gr; hg.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    var hd = hg.getImageData(0, 0, nw, nh).data;
    var nc = document.createElement("canvas"); nc.width = nw; nc.height = nh;
    var ng = nc.getContext("2d"), img = ng.createImageData(nw, nh), od = img.data;
    function H(x, y) { x = (x + nw) % nw; y = (y + nh) % nh; return hd[(y * nw + x) * 4] / 255; }
    var K = 3.4;
    for (var y2 = 0; y2 < nh; y2++) for (var x2 = 0; x2 < nw; x2++) {
      var dx = (H(x2 + 1, y2) - H(x2 - 1, y2)) * K, dy = (H(x2, y2 + 1) - H(x2, y2 - 1)) * K;
      var l = Math.sqrt(dx * dx + dy * dy + 1), o = (y2 * nw + x2) * 4;
      od[o] = (-dx / l * 0.5 + 0.5) * 255; od[o + 1] = (dy / l * 0.5 + 0.5) * 255; od[o + 2] = (1 / l * 0.5 + 0.5) * 255; od[o + 3] = 255;
    }
    ng.putImageData(img, 0, 0);
    var nrm = new T.CanvasTexture(nc);
    nrm.colorSpace = T.NoColorSpace;
    nrm.wrapS = nrm.wrapT = T.MirroredRepeatWrapping;
    nrm.anisotropy = 4;
    /* ぬれたつや：上に透明な層（clearcoat）。その層もでこぼこを拾って、光がゆらぐ */
    this.konMat = new T.MeshPhysicalMaterial({
      map: col, color: 0xd6cdc2, roughness: 0.42, metalness: 0,
      normalMap: nrm, normalScale: new T.Vector2(0.7, 0.7),
      clearcoat: 1, clearcoatRoughness: 0.14,
      sheen: 0.4, sheenColor: new T.Color(0xc8b9a4), sheenRoughness: 0.4,
      emissive: new T.Color(0x2a2219)     /* 影の側も真っ暗にしない（少し透けて見える感じ） */
    });
  };

  /* まな板（ゲームの壁の内側＋縁14） */
  KonScene.prototype.makeBoard = function (b, W, CY) {
    var key = [b.x0, b.x1, b.y0, b.y1, W, CY].join(",");
    if (key === this.bkey) return;
    this.bkey = key;
    if (this.board) { this.scene.remove(this.board); this.board.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    var g = this.board = new T.Group();
    var m = 14, bw = (b.x1 - b.x0 + m * 2) * S, bd = (b.y1 - b.y0 + m * 2) * S;
    var cx = ((b.x0 + b.x1) / 2 - W / 2) * S, cz = ((b.y0 + b.y1) / 2 - CY) * S;
    var r = Z3.rng(77);
    if (!this.woodTex) {
      this.woodTex = Z3.canvasTex(512, 1024, function (c, w, h) {
        var gr = c.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, "#e9d0a2"); gr.addColorStop(1, "#d6b47e");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        for (var i = 0; i < 120; i++) {
          var x = r() * w, a = 0.03 + r() * 0.08, k = r() * 6, lw = 0.6 + r() * 2.4;
          c.strokeStyle = "rgba(125,80,32," + a + ")"; c.lineWidth = lw;
          c.beginPath();
          for (var y = 0; y <= h; y += 16) {
            var ox = Math.sin(y / 90 + k) * 6 + Math.sin(y / 27 + k * 2) * 1.8;
            if (y === 0) c.moveTo(x + ox, y); else c.lineTo(x + ox, y);
          }
          c.stroke();
        }
        /* 包丁の細かい傷 */
        for (var j = 0; j < 160; j++) {
          var x0 = r() * w, y0 = r() * h, an = r() * Math.PI, l = 8 + r() * 40;
          c.strokeStyle = "rgba(90,60,30," + (0.05 + r() * 0.08) + ")"; c.lineWidth = 0.8;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(an) * l, y0 + Math.sin(an) * l); c.stroke();
        }
      });
      /* ぬれたところだけ、つやを強くする（粗さの貼り物） */
      this.wetTex = Z3.canvasTex(256, 512, function (c, w, h) {
        c.fillStyle = "#a8a8a8"; c.fillRect(0, 0, w, h);
        for (var i = 0; i < 40; i++) {
          var x = r() * w, y = r() * h, rr = 6 + r() * 30;
          var gr = c.createRadialGradient(x, y, 0, x, y, rr);
          gr.addColorStop(0, "rgba(40,40,40,.6)"); gr.addColorStop(1, "rgba(40,40,40,0)");
          c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, rr, rr * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); c.fill();
        }
      });
      this.wetTex.colorSpace = T.NoColorSpace;
      this.boardMat = new T.MeshPhysicalMaterial({ map: this.woodTex, roughnessMap: this.wetTex, roughness: 1, clearcoat: 0.35, clearcoatRoughnessMap: this.wetTex, clearcoatRoughness: 0.6 });
    }
    var top = new T.Mesh(new T.BoxGeometry(bw, 0.3, bd), [Z3.std(0xc9a46e), Z3.std(0xc9a46e), this.boardMat, Z3.std(0xb38d58), Z3.std(0xc9a46e), Z3.std(0xc9a46e)]);
    top.position.set(cx, -0.15, cz);
    top.receiveShadow = true;
    g.add(top);
    /* 台所の台（まな板より少し広いだけにする） */
    var counter = new T.Mesh(new T.BoxGeometry(bw + 6, 0.2, bd + 4), Z3.std(0x3a3632, { roughness: 0.4, metalness: 0.2 }));
    counter.position.set(cx, -0.4, cz);
    counter.receiveShadow = true;
    g.add(counter);
    this.scene.add(g);
    this.fit(bw, bd, cx, cz);
  };

  /* まな板が横いっぱいに収まるようにカメラを置く */
  KonScene.prototype.fit = function (bw, bd, cx, cz) {
    var cam = this.camera;
    var aspect = this.aspect || 540 / 960;
    var vf = cam.fov * Math.PI / 180;
    var hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    var dW = (bw / 2 * 1.04) / Math.tan(hf / 2);
    var dH = (bd / 2 * 1.06) / Math.tan(vf / 2);
    var d = Math.max(dW, dH) + THICK;
    cam.position.set(cx, Math.cos(TILT) * d, cz + Math.sin(TILT) * d);
    cam.lookAt(cx, 0, cz - 0.15);
    cam.updateMatrixWorld();
  };

  /* こんにゃく1切れの形。p.poly はゲーム座標（重心が原点）、p.c は元のこんにゃくでの重心。
     元のこんにゃくの外側だった辺は、上の肩をゆるい楕円で丸め、下も少し丸める（ぷるんとした形）。
     切り口の辺はまっすぐ縦に下ろし、切った角は鋭くする */
  var RX = 0.30, RY = 0.2, RB = 0.06, CR = 34;   /* CR はゲーム側の四隅の丸みと同じ（RX/S より大きくして、肩の内側の形が裏返らないように） */
  KonScene.prototype.pieceMesh = function (p) {
    var KW = this.KW, KH = this.KH;
    var P = p.poly, n = P.length, cx = p.c.x, cy = p.c.y;
    if (polyArea(P) < 0) P = P.slice().reverse();
    /* 元の外側（角を丸めた長方形）の上にある辺か */
    function sdf(x, y) {
      var qx = Math.abs(x) - (KW / 2 - CR), qy = Math.abs(y) - (KH / 2 - CR);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - CR;
    }
    var orig = [], nor = [], minR = 1e9;
    for (var i = 0; i < n; i++) {
      var a = P[i], b = P[(i + 1) % n];
      orig.push(Math.abs(sdf((a.x + b.x) / 2 + cx, (a.y + b.y) / 2 + cy)) < 1.2 && Math.abs(sdf(a.x + cx, a.y + cy)) < 1.2);
      var ex = b.x - a.x, ey = b.y - a.y, l = Math.hypot(ex, ey) || 1;
      nor.push({ x: ey / l, y: -ex / l });
      minR = Math.min(minR, Math.abs(a.x * ey / l - a.y * ex / l));   /* 重心から辺までの距離 */
    }
    /* 頂点ごとのなめらかな向き：となりの辺も元の外側で、曲がりがゆるいなら平均する */
    function vn(e, end) {
      var v = end ? (e + 1) % n : e, o = end ? v : (e - 1 + n) % n;   /* o: 頂点 v のもう一方の辺 */
      var A = nor[e], B = nor[o];
      if (orig[e] && orig[o] && A.x * B.x + A.y * B.y > 0.8) { var x = A.x + B.x, y = A.y + B.y, l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
      return A;
    }
    function inset(d) {
      var out = [];
      for (var i = 0; i < n; i++) {
        var j = (i - 1 + n) % n, n1 = nor[j], n2 = nor[i], v = P[i];
        var det = n1.x * n2.y - n1.y * n2.x;
        if (Math.abs(det) < 1e-3) { out.push({ x: v.x - n2.x * d[i], y: v.y - n2.y * d[i] }); continue; }
        var c1 = d[j], c2 = d[i];
        out.push({ x: v.x - (c1 * n2.y - c2 * n1.y) / det, y: v.y - (n1.x * c2 - n2.x * c1) / det });
      }
      return out;
    }
    /* 小さい切れは丸みも小さく */
    var k0 = Math.min(1, minR * S / (RX * 1.6));
    var rx = RX * k0, ry = RY * Math.max(0.5, k0), rb = RB;
    var SEG = Z3.mobile ? 5 : 8;
    /* 断面の道すじ：上の面の縁 → 肩の楕円 → 縦の壁 → 下の丸み。h,v は外向きの法線（横・縦） */
    var prof = [];
    for (var k = 0; k <= SEG; k++) {
      var ph = k / SEG * Math.PI / 2, sx = Math.sin(ph) / rx, sy = Math.cos(ph) / ry, l = Math.hypot(sx, sy);
      prof.push({ d: rx * (1 - Math.sin(ph)), y: THICK - ry + ry * Math.cos(ph), h: sx / l, v: sy / l });
    }
    for (var k2 = 0; k2 <= 3; k2++) {
      var ph2 = k2 / 3 * Math.PI / 2;
      prof.push({ d: rb * (1 - Math.cos(ph2)), y: rb - rb * Math.sin(ph2), h: Math.cos(ph2), v: -Math.sin(ph2) });
    }
    var rings = prof.map(function (q) {
      return { pts: inset(orig.map(function (o) { return o ? q.d : 0; })), y: q.y, h: q.h, v: q.v, top: q === prof[0] };
    });
    var pos = [], nrm = [], uv = [];
    function uvTop(v) { return [(v.x + cx) / KW + 0.5, 1 - ((v.y + cy) / KH + 0.5)]; }
    function vert(v, y, nx, ny, nz, u, w) { pos.push(v.x * S, y, v.y * S); nrm.push(nx, ny, nz); uv.push(u, w); }
    var top = rings[0].pts;
    for (var t = 1; t < n - 1; t++) {
      [top[0], top[t + 1], top[t]].forEach(function (v) { var q = uvTop(v); vert(v, THICK, 0, 1, 0, q[0], q[1]); });
    }
    for (var e = 0; e < n; e++) {
      var f = (e + 1) % n, N0 = vn(e, false), N1 = vn(e, true), Nf = nor[e];
      for (var rk = 0; rk < rings.length - 1; rk++) {
        var A = rings[rk], B = rings[rk + 1];
        function nn(ring, M) {
          if (!orig[e]) return ring.top ? [0, 1, 0] : [Nf.x, 0, Nf.y];
          return [M.x * ring.h, ring.v, M.y * ring.h];
        }
        var a0n = nn(A, N0), a1n = nn(A, N1), b0n = nn(B, N0), b1n = nn(B, N1);
        /* 切り口の辺は、上の面の縁で角を立てる（壁は横向きの法線だけ） */
        if (!orig[e] && A.top) { a0n = a1n = [Nf.x, 0, Nf.y]; }
        var a0 = A.pts[e], a1 = A.pts[f], b0 = B.pts[e], b1 = B.pts[f];
        function uvS(v, y) { return [((v.x + cx) * Math.abs(Nf.y) / KW + (v.y + cy) * Math.abs(Nf.x) / KH) + 0.5, 0.3 + y / S / KH]; }
        var ua0 = uvS(a0, A.y), ua1 = uvS(a1, A.y), ub0 = uvS(b0, B.y), ub1 = uvS(b1, B.y);
        vert(a0, A.y, a0n[0], a0n[1], a0n[2], ua0[0], ua0[1]); vert(a1, A.y, a1n[0], a1n[1], a1n[2], ua1[0], ua1[1]); vert(b0, B.y, b0n[0], b0n[1], b0n[2], ub0[0], ub0[1]);
        vert(a1, A.y, a1n[0], a1n[1], a1n[2], ua1[0], ua1[1]); vert(b1, B.y, b1n[0], b1n[1], b1n[2], ub1[0], ub1[1]); vert(b0, B.y, b0n[0], b0n[1], b0n[2], ub0[0], ub0[1]);
      }
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    var mesh = new T.Mesh(geo, this.konMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    var grp = new T.Group();
    grp.add(mesh);
    this.scene.add(grp);
    return grp;
  };
  function polyArea(P) {
    var a = 0;
    for (var i = 0; i < P.length; i++) { var p = P[i], q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; }
    return a / 2;
  }

  KonScene.prototype.makeKnife = function () {
    var k = this.knife = new T.Group();
    var inner = this.knifeInner = new T.Group();
    inner.position.x = -1.15;
    inner.rotation.x = 0.55;     /* 刃の腹が少し見えるよう寝かせる */
    k.add(inner);
    /* 刃：薄い鋼の板。刃先が下 */
    var sh = new T.Shape();
    sh.moveTo(0, 0); sh.lineTo(1.55, 0); sh.quadraticCurveTo(1.62, 0.6, 1.4, 0.82); sh.lineTo(0, 0.82); sh.closePath();
    var blade = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }),
      new T.MeshPhysicalMaterial({ color: 0xe4e8ec, metalness: 0.85, roughness: 0.32 }));
    blade.position.set(0, 0, -0.009);
    blade.castShadow = true;
    inner.add(blade);
    var handle = new T.Mesh(new T.BoxGeometry(0.85, 0.2, 0.12), Z3.std(0x4a3222, { roughness: 0.6 }));
    handle.position.set(-0.42, 0.68, 0);
    handle.castShadow = true;
    inner.add(handle);
    var pin = Z3.std(0xc0c4c8, { metalness: 1, roughness: 0.3 });
    [-0.2, -0.62].forEach(function (x) {
      var m = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.13, 8), pin);
      m.rotation.x = Math.PI / 2; m.position.set(x, 0.68, 0); inner.add(m);
    });
    k.visible = false;
    this.scene.add(k);
  };

  /* 画面の点 → まな板の上のゲーム座標 */
  KonScene.prototype.pick = function (x, y, W, H, CY) {
    this.ray.setFromCamera(new T.Vector2(x / W * 2 - 1, -(y / H * 2 - 1)), this.camera);
    var hit = new T.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return null;
    return { x: hit.x / S + W / 2, y: hit.z / S + CY };
  };
  /* ゲーム座標 → 画面の点 */
  KonScene.prototype.project = function (gx, gy, W, H, CY) {
    var v = new T.Vector3((gx - W / 2) * S, CUT_Y, (gy - CY) * S).project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };

  KonScene.prototype.sync = function (s) {
    var self = this;
    this.aspect = s.W / s.H;
    this.makeBoard(s.board, s.W, s.CY);
    var alive = new Set();
    (s.pieces || []).forEach(function (p) {
      alive.add(p);
      var g = self.meshes.get(p);
      if (!g) { g = self.pieceMesh(p); self.meshes.set(p, g); }
      g.position.set((p.x - s.W / 2) * S, 0, (p.y - s.CY) * S);
      g.rotation.y = -p.a;
      var wb = p.wob * Math.sin(s.t * 38 + p.c.x * 0.1) * 0.05;
      g.scale.set(1 + wb, 1 - wb * 1.5, 1 - wb);
    });
    this.meshes.forEach(function (g, p) {
      if (alive.has(p)) return;
      self.scene.remove(g);
      g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      self.meshes.delete(p);
    });
    var k = s.knife;
    this.knife.visible = !!k;
    if (k) {
      /* 刃先の少し後ろが指の場所。進む向きに刃を向け、刃はこんにゃくに沈める */
      var ang = k.dir == null ? -Math.PI / 2 : k.dir;
      this.knife.position.set((k.x - s.W / 2) * S, -0.02, (k.y - s.CY) * S);
      this.knife.rotation.set(0, -ang, 0);
    }
  };

  KonScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.KonScene = KonScene;
})(window);
