/* スキー炒飯の立体の見た目。games/three-base.js の Z3 を土台にする。
   ゲーム側（index.html）が持つ人の位置・米粒を sync で写すだけ。当たりや点数はゲーム側。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var BR = 0.34, RIM = 0.2;
  function surf(r) { return BR - Math.sqrt(Math.max(0, BR * BR - r * r)); }

  function GameScene(o) {
    T = global.THREE;
    this.o = o;
    var st = this.stage = new Z3.Stage({ renderer: { tone: "aces", exposure: 1.05 }, camera: { fov: 80, near: 0.05, far: 160 } });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    sc.background = new T.Color(0xbcd8f2);
    sc.fog = new T.Fog(0xe2edf7, 28, 125);
    sc.add(new T.HemisphereLight(0xffffff, 0x9fb4cc, 1.5));
    var sun = new T.DirectionalLight(0xfff4e2, 2.2); sun.position.set(-4, 9, 3); sc.add(sun);

    /* 空：上ほど濃い青のドーム。遠くの山並み（人について動く） */
    var skyG = new T.SphereGeometry(140, 24, 12), sc2 = [], top = new T.Color(0x2f74c8), hor = new T.Color(0xcfe3f6);
    for (i = 0; i < skyG.attributes.position.count; i++) {
      var yy = Math.max(0, skyG.attributes.position.getY(i) / 140), c = hor.clone().lerp(top, Math.pow(yy, 0.45));
      sc2.push(c.r, c.g, c.b);
    }
    skyG.setAttribute("color", new T.Float32BufferAttribute(sc2, 3));
    this.sky = new T.Group(); sc.add(this.sky);
    this.sky.add(new T.Mesh(skyG, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false, toneMapped: false })));
    var mtTex = Z3.canvasTex(1024, 128, function (g, w, h) {
      var r2 = Z3.rng(9);
      /* とがった峰を2列。奥は青く、手前は白っぽく */
      [["#9fbcdc", 0.3, 18], ["#e4edf6", 0.55, 11]].forEach(function (L) {
        g.fillStyle = L[0]; g.beginPath(); g.moveTo(0, h);
        var x = 0, y0 = h * 0.9;
        g.lineTo(0, y0);
        while (x < w) {
          var wd = 30 + r2() * 60, pk = h * L[1] + r2() * h * 0.25;
          g.lineTo(x + wd * (0.4 + r2() * 0.2), pk); x += wd; g.lineTo(x, h * 0.75 + r2() * h * 0.15);
        }
        g.lineTo(w, h); g.closePath(); g.fill();
      });
    });
    var mt = new T.Mesh(new T.CylinderGeometry(120, 120, 22, 40, 1, true), new T.MeshBasicMaterial({ map: mtTex, transparent: true, side: T.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    mt.position.y = -14; this.sky.add(mt);
    this.sky.children.forEach(function (c) { c.renderOrder = -1; });

    /* 雪の斜面。人の近くだけを毎回高さを付け直して使い回す（1マス2m、絵も2mで繰り返す） */
    var snowTex = Z3.canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = "#f3f7fb"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      for (var i = 0; i < 420; i++) {
        g.fillStyle = r() < 0.6 ? "rgba(140,165,200,.55)" : "rgba(255,255,255,.95)";
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
    }, 1);
    snowTex.wrapS = snowTex.wrapT = T.RepeatWrapping;
    this.GW = 72; this.GL = 150;
    var gg = new T.PlaneGeometry(this.GW, this.GL, 36, 75);
    gg.rotateX(-Math.PI / 2);
    var uv = gg.attributes.uv;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 36, uv.getY(i) * 75);
    this.base = gg.attributes.position.array.slice();
    this.groundMesh = new T.Mesh(gg, new T.MeshLambertMaterial({ map: snowTex }));
    sc.add(this.groundMesh);
    this.gKey = "";

    /* 木 */
    var trees = o.trees, n = trees.length;
    var leafG = new T.ConeGeometry(1.4, 3.6, 7); leafG.translate(0, 3.2, 0);
    var leaf2 = new T.ConeGeometry(1.0, 2.6, 7); leaf2.translate(0, 4.8, 0);
    var trunkG = new T.CylinderGeometry(0.22, 0.28, 1.6, 6); trunkG.translate(0, 0.8, 0);
    var leaves = new T.InstancedMesh(leafG, new T.MeshLambertMaterial({ color: 0x2f6b46 }), n);
    var leaves2 = new T.InstancedMesh(leaf2, new T.MeshLambertMaterial({ color: 0x3d7f55 }), n);
    var trunks = new T.InstancedMesh(trunkG, new T.MeshLambertMaterial({ color: 0x6b4a32 }), n);
    var m = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3();
    for (i = 0; i < n; i++) {
      var t = trees[i];
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), i * 1.7);
      v.set(t.x, o.ground(t.x, t.z) - 0.1, t.z); s.set(t.s, t.s, t.s);
      m.compose(v, q, s);
      leaves.setMatrixAt(i, m); leaves2.setMatrixAt(i, m); trunks.setMatrixAt(i, m);
    }
    /* 枝の上の雪 */
    var capG = new T.ConeGeometry(0.62, 1.1, 7); capG.translate(0, 5.65, 0);
    var caps = new T.InstancedMesh(capG, new T.MeshLambertMaterial({ color: 0xf6f9fc }), n);
    var capG2 = new T.ConeGeometry(1.0, 0.9, 7); capG2.translate(0, 4.0, 0);
    var caps2 = new T.InstancedMesh(capG2, new T.MeshLambertMaterial({ color: 0xf0f5fa }), n);
    var tint = new T.Color();
    for (i = 0; i < n; i++) {
      leaves.getMatrixAt(i, m); caps.setMatrixAt(i, m); caps2.setMatrixAt(i, m);
      var tv2 = 0.85 + ((i * 37) % 30) / 100;
      leaves.setColorAt(i, tint.setRGB(tv2, tv2, tv2)); leaves2.setColorAt(i, tint.setRGB(tv2, tv2, tv2));
    }
    sc.add(leaves); sc.add(leaves2); sc.add(trunks); sc.add(caps); sc.add(caps2);

    /* ゴールの門 */
    var gz = -o.len, gy0 = o.ground(0, gz);
    var flagTex = Z3.canvasTex(256, 32, function (g, w, h) {
      for (var x = 0; x < w / 16; x++) for (var y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#fff"; g.fillRect(x * 16, y * 16, 16, 16); }
    });
    flagTex.wrapS = T.RepeatWrapping; flagTex.repeat.set(4, 1);
    var banner = new T.Mesh(new T.PlaneGeometry(o.edge * 2, 1.4), new T.MeshBasicMaterial({ map: flagTex, side: T.DoubleSide }));
    banner.position.set(0, gy0 + 5, gz); sc.add(banner);
    var poleM = new T.MeshLambertMaterial({ color: 0xd8382e });
    [-1, 1].forEach(function (k) {
      var p = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 6, 8), poleM);
      p.position.set(k * o.edge, gy0 + 3, gz); sc.add(p);
    });

    /* 舞う雪：人のまわりに置き、後ろへ抜けたら前へ戻す（速さが見える） */
    this.flakeN = 260;
    var fp = new Float32Array(this.flakeN * 3);
    this.flakes = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ color: 0xffffff, size: 0.05, map: Z3.canvasTex(32, 32, function (g) { var r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.5, "rgba(255,255,255,.8)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 32, 32); }), transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
    this.flakes.geometry.setAttribute("position", new T.BufferAttribute(fp, 3));
    this.flakes.frustumCulled = false;
    this.flakeR = Z3.rng(5);
    this.flakeInit = false;
    sc.add(this.flakes);

    /* 人：体の向きだけ回る台。カメラ・鍋・板はここに付ける */
    var rig = this.rig = new T.Group(); sc.add(rig);
    this.head = new T.Group(); rig.add(this.head);
    this.head.add(this.camera);

    /* 板（先が反った細い板と、前から見える留め具） */
    var skiM = new T.MeshStandardMaterial({ color: 0xd8342c, roughness: 0.35 });
    var skiLine = new T.MeshBasicMaterial({ color: 0xffffff });
    this.skis = new T.Group(); rig.add(this.skis);
    [-0.13, 0.13].forEach(function (x) {
      var b = new T.Mesh(new T.BoxGeometry(0.085, 0.02, 1.4), skiM); b.position.set(x, -1.57, -0.5); this.skis.add(b);
      var ln = new T.Mesh(new T.PlaneGeometry(0.012, 1.3), skiLine); ln.rotation.x = -Math.PI / 2; ln.position.set(x, -1.558, -0.55); this.skis.add(ln);
      var tip = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.085, 12, 1, true, 0, Math.PI / 2), skiM);
      tip.rotation.set(0, 0, Math.PI / 2); tip.position.set(x, -1.47, -1.2); this.skis.add(tip);
    }, this);

    /* 中華鍋：内側は焼けた色、縁は少し厚く。右に長い木の柄、左に小さな持ち手 */
    var wok = this.wok = new T.Group(); rig.add(wok);
    var pts = [];
    for (i = 0; i <= 16; i++) { var r = RIM * i / 16; pts.push(new T.Vector2(r, surf(r))); }
    var RY = surf(RIM);
    pts.push(new T.Vector2(RIM + 0.006, RY + 0.003), new T.Vector2(RIM + 0.01, RY - 0.004));
    var wokTex = Z3.canvasTex(8, 128, function (g, w, h) {
      var gr = g.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, "#2a2018"); gr.addColorStop(0.35, "#4a3a2c"); gr.addColorStop(0.6, "#5b5f68"); gr.addColorStop(0.9, "#7d828b"); gr.addColorStop(1, "#c9ccd2");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    var steel = new T.MeshStandardMaterial({ map: wokTex, metalness: 0.45, roughness: 0.38, side: T.DoubleSide });
    wok.add(new T.Mesh(new T.LatheGeometry(pts, 40), steel));
    var metal = new T.MeshStandardMaterial({ color: 0x8b9099, metalness: 0.6, roughness: 0.35 });
    var wood = new T.MeshStandardMaterial({ color: 0x9a6232, roughness: 0.6 });
    /* 柄は鍋の右手前へ伸ばす（hd が向き） */
    var hd = new T.Vector3(0.42, 0.16, 0.89).normalize(), hq = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), hd);
    var h0 = new T.Vector3(RIM * 0.42, RY - 0.012, RIM * 0.9);
    var shank = new T.Mesh(new T.CylinderGeometry(0.011, 0.014, 0.1, 8), metal);
    shank.quaternion.copy(hq); shank.position.copy(h0).addScaledVector(hd, 0.05); wok.add(shank);
    var grip = new T.Mesh(new T.CylinderGeometry(0.02, 0.017, 0.26, 10), wood);
    grip.quaternion.copy(hq); grip.position.copy(h0).addScaledVector(hd, 0.23); wok.add(grip);
    this.gripR = h0.clone().addScaledVector(hd, 0.2);          /* 右手で握る所（鍋の中の座標） */
    this.gripL = new T.Vector3(-0.19, 0.0, 0.06);               /* 左手で持つ所（コンロの左端） */

    /* 腕：肩から手首まで、上着の袖と手袋。毎回の鍋の位置に合わせて伸ばす */
    var sleeveG = new T.CylinderGeometry(0.042, 0.062, 1, 12); sleeveG.translate(0, 0.5, 0);
    var cuffG = new T.CylinderGeometry(0.047, 0.047, 0.05, 12);
    var jacket = new T.MeshStandardMaterial({ color: 0xf07a22, roughness: 0.7 });
    var cuffM = new T.MeshStandardMaterial({ color: 0x23324a, roughness: 0.8 });
    var gloveM = new T.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.75 });
    var mitt = new T.SphereGeometry(1, 14, 10), thumbG = new T.CapsuleGeometry ? new T.CapsuleGeometry(0.013, 0.03, 4, 8) : new T.SphereGeometry(0.016, 8, 6);
    this.arms = [];
    [1, -1].forEach(function (k) {
      var arm = { k: k, sleeve: new T.Mesh(sleeveG, jacket), cuff: new T.Mesh(cuffG, cuffM), hand: new T.Group() };
      var palm = new T.Mesh(mitt, gloveM); palm.scale.set(0.042, 0.03, 0.06); palm.position.y = 0.045; arm.hand.add(palm);
      var thumb = new T.Mesh(thumbG, gloveM); thumb.position.set(-k * 0.035, 0.035, 0.015); thumb.rotation.z = k * 0.6; arm.hand.add(thumb);
      rig.add(arm.sleeve); rig.add(arm.cuff); rig.add(arm.hand);
      this.arms.push(arm);
    }, this);
    this.tmpV = new T.Vector3(); this.tmpW = new T.Vector3(); this.up = new T.Vector3(0, 1, 0); this.tmpQ = new T.Quaternion();

    /* 左手で持つカセットコンロ。鍋はこの上に載せていて、あおると浮く */
    var stove = this.stove = new T.Group(); rig.add(stove);
    var body = new T.Mesh(new T.BoxGeometry(0.36, 0.07, 0.28), new T.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.5, roughness: 0.35 }));
    stove.add(body);
    var topPlate = new T.Mesh(new T.BoxGeometry(0.34, 0.006, 0.26), new T.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5 }));
    topPlate.position.y = 0.037; stove.add(topPlate);
    var burner = new T.Mesh(new T.CylinderGeometry(0.05, 0.055, 0.012, 16), metal);
    burner.position.y = 0.045; stove.add(burner);
    var trivet = new T.Mesh(new T.TorusGeometry(0.085, 0.005, 6, 20), metal);
    trivet.rotation.x = Math.PI / 2; trivet.position.y = 0.055; stove.add(trivet);
    var knob = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.02, 12), new T.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 }));
    knob.rotation.x = Math.PI / 2; knob.position.set(0.11, 0, 0.145); stove.add(knob);
    var lid = new T.Mesh(new T.BoxGeometry(0.1, 0.05, 0.004), new T.MeshStandardMaterial({ color: 0xd8342c, roughness: 0.5 }));
    lid.position.set(-0.09, 0, 0.142); stove.add(lid);
    this.STOVE = new T.Vector3(0, -0.44 - 0.085, -0.5);
    this.flames = new T.Group(); this.flames.position.y = 0.085; stove.add(this.flames);
    var fm = new T.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.85 });
    var fo = new T.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.8 });
    for (i = 0; i < 10; i++) {
      var a = i / 10 * Math.PI * 2;
      var f = new T.Mesh(new T.ConeGeometry(0.014, 0.06, 6), i % 2 ? fo : fm);
      f.position.set(Math.cos(a) * 0.05, -0.035, Math.sin(a) * 0.05); this.flames.add(f);
    }
    wok.position.set(0, -0.44, -0.5);

    /* ゴールで出てくる皿（白い丸皿に青い縁） */
    var plateTex = Z3.canvasTex(128, 8, function (g, w, h) {
      g.fillStyle = "#fbfbf8"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#2f5fa8"; g.fillRect(w * 0.82, 0, w * 0.06, h);
    });
    var pp = [new T.Vector2(0, 0), new T.Vector2(0.12, 0.004), new T.Vector2(0.16, 0.018), new T.Vector2(0.175, 0.03), new T.Vector2(0.17, 0.034), new T.Vector2(0.15, 0.022), new T.Vector2(0.09, 0.01), new T.Vector2(0.06, -0.01), new T.Vector2(0, -0.01)];
    var plateG = new T.LatheGeometry(pp, 40), puv = plateG.attributes.uv;
    for (i = 0; i < puv.count; i++) puv.setXY(i, 1 - puv.getY(i), 0.5);
    this.plate = new T.Mesh(plateG, new T.MeshStandardMaterial({ map: plateTex, roughness: 0.25, side: T.DoubleSide }));
    this.plate.visible = false;
    rig.add(this.plate);
    this.PLATE = new T.Vector3(0, -0.6, -0.7);
    /* 皿の上の山の芯（粒のすき間から皿が透けて浮いて見えないように）と、山の下の影 */
    this.mound = new T.Mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.8 }));
    this.mound.visible = false; rig.add(this.mound);
    this.moundShadow = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ map: Z3.canvasTex(64, 64, function (g) { var r = g.createRadialGradient(32, 32, 8, 32, 32, 32); r.addColorStop(0, "rgba(60,45,30,.45)"); r.addColorStop(1, "rgba(60,45,30,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false }));
    this.moundShadow.rotation.x = -Math.PI / 2; this.moundShadow.visible = false; rig.add(this.moundShadow);
    this.invW = new T.Matrix4();

    /* 米粒 */
    var N = o.n;
    /* 米粒は細長い粒 */
    var grainG = new T.SphereGeometry(0.5, 8, 5); grainG.scale(0.019, 0.0095, 0.0095);
    /* 動く粒1つにつき、見た目の粒を K 個まとめて描く（動きの数はそのままで量を多く見せる） */
    var K = this.K = 4;
    this.rice = new T.InstancedMesh(grainG, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), N * K);
    this.rice.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.rice.frustumCulled = false;
    wok.add(this.rice);
    this.rot = [];
    var rr = Z3.rng(11);
    this.off = []; this.pr = [];
    for (i = 0; i < N * K; i++) {
      this.rot.push(new T.Euler(rr() * 6, rr() * 6, rr() * 6));
      this.pr.push([rr(), rr(), rr(), rr()]);
      var oa = rr() * 6.283, orr = i % K ? 0.006 + rr() * 0.011 : 0;
      this.off.push([Math.cos(oa) * orr, i % K ? rr() * 0.014 : 0, Math.sin(oa) * orr]);
    }
    this.col = new T.Color();
    this.cRaw = new T.Color(0xf7f3e6); this.cGold = new T.Color(0xf0c35a); this.cBurn = new T.Color(0x3a2212);
    this.cEgg = new T.Color(0xffd23a); this.cNegi = new T.Color(0x4f9f36);
    this.m = m; this.q = q; this.v = v; this.s = s;
  }

  GameScene.prototype.reset = function () {};

  GameScene.prototype.groundAt = function (cx, cz) {
    var sx = Math.round(cx / 2) * 2, sz = Math.round(cz / 2) * 2, key = sx + "," + sz;
    if (key === this.gKey) return;
    this.gKey = key;
    var oz = sz - this.GL / 2 + 2;              /* 人の少し後ろから前へ */
    var pos = this.groundMesh.geometry.attributes.position, b = this.base, a = pos.array, g = this.o.ground;
    for (var i = 0; i < pos.count; i++) {
      var x = b[i * 3] + sx, z = b[i * 3 + 2] + oz;
      a[i * 3] = x; a[i * 3 + 1] = g(x, z); a[i * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    this.groundMesh.geometry.computeVertexNormals();
    this.groundMesh.geometry.computeBoundingSphere();
  };

  GameScene.prototype.sync = function (s) {
    var p = s.p; if (!p) return;
    this.groundAt(p.x, p.z);
    /* 目の高さはこぶの上下をなめらかにして見せる（鍋の揺れはゲーム側でそのまま） */
    var base = p.gy != null ? p.gy : p.y;
    this.camDy = this.camDy == null ? 0 : this.camDy + ((p.y - base) - this.camDy) * 0.12;
    this.rig.position.set(p.x, base + this.camDy, p.z);
    this.rig.rotation.y = p.h;
    this.sky.position.set(p.x, base, p.z);
    var sh = s.shake || 0, t = s.t, sp = s.state === "play" ? p.v / s.vmax : 0;
    /* 速いほど細かく揺れて、視野が少し広がる */
    var buzz = sp * 0.0012;
    this.head.rotation.set(-0.5 + Math.sin(t * 40) * sh * 0.025 + Math.sin(t * 71) * buzz, Math.sin(t * 33) * sh * 0.025 + Math.sin(t * 57) * buzz, (s.steer || 0) * 0.14, "YXZ");
    var fov = 80 + sp * 8;
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.syncFlakes(p);
    /* あおる動き：さっと持ち上げて手前へ引く */
    var ft = s.flipT, k = ft < 0.22 ? Math.sin(ft / 0.22 * Math.PI) : 0;
    this.wok.position.set(0, -0.44 + k * 0.06, -0.5 + k * 0.04);
    this.wok.rotation.set(k * 0.28, 0, 0);
    this.skis.position.set(0, 0, 0);
    this.skis.rotation.set(0, -(s.steer || 0) * 0.15, 0);
    var sv = s.serveA >= 0 ? s.serveA : -1;
    this.plate.visible = sv >= 0;
    if (sv < 0) {
      this.head.position.set(0, 0, 0);
      this.skis.visible = this.stove.visible = true;
      for (var aj = 0; aj < this.arms.length; aj++) this.arms[aj].sleeve.visible = this.arms[aj].cuff.visible = this.arms[aj].hand.visible = true;
    }
    if (sv >= 0) {
      /* 皿が奥の下から出てきて、鍋は皿の手前上へ動き、向こうへ傾けて盛る。コンロは左下へ下ろす */
      var pu = Math.min(1, sv / 0.6), pe = 1 - Math.pow(1 - pu, 3);
      this.plate.position.set(this.PLATE.x, this.PLATE.y - 0.35 * (1 - pe), this.PLATE.z);
      var wu = Math.min(1, sv / 0.7), we = wu * wu * (3 - 2 * wu);
      var tilt = sv < 0.7 ? 0 : Math.min(1, (sv - 0.7) / 0.35) * (sv < 2.0 ? 1 : Math.max(0, 1 - (sv - 2.0) / 0.4));
      var away = sv < 2.0 ? 0 : Math.min(1, (sv - 2.0) / 0.5);
      this.wok.position.set(0.26 * we + 0.4 * away, -0.44 + 0.04 * we + 0.2 * away, -0.5 - 0.18 * we);
      this.wok.rotation.set(0, 0, 1.15 * tilt);
      this.stoveOff = we;
      this.head.rotation.x = -0.5 - 0.22 * we;
      /* 盛り終わったら皿へ寄って大きく映す。板・コンロ・腕は消す */
      var cu = Math.max(0, Math.min(1, (sv - 2.15) / 0.8)), ce = cu * cu * (3 - 2 * cu);
      if (ce > 0) {
        this.head.rotation.set(-0.72 + 0.06 * ce, 0, 0, "YXZ");
        this.head.position.set(0, -0.12 * ce, -0.12 * ce);
        var f2 = 80 + (56 - 80) * ce;
        if (Math.abs(this.camera.fov - f2) > 0.05) { this.camera.fov = f2; this.camera.updateProjectionMatrix(); }
      }
      var hideGear = ce > 0.35;
      this.skis.visible = this.stove.visible = !hideGear;
      for (var ai = 0; ai < this.arms.length; ai++) this.arms[ai].sleeve.visible = this.arms[ai].cuff.visible = this.arms[ai].hand.visible = !hideGear;
    }
    var so = sv >= 0 ? this.stoveOff : 0;
    this.stove.position.set(this.STOVE.x - 0.3 * so, this.STOVE.y - 0.5 * so, this.STOVE.z + 0.15 * so);
    this.stove.rotation.set(0, 0, 0);
    this.syncArms(s.crashA >= 0 ? Math.min(s.crashA, 1.6) : 0);
    if (s.crashA >= 0) this.crashPose(Math.min(s.crashA, 1.6), t);
    for (var j = 0; j < this.flames.children.length; j++) this.flames.children[j].scale.y = 0.7 + Math.random() * 0.6;

    var gs = s.grains, M = this.m, Q = this.q, V = this.v, Sc = this.s;
    var K = this.K;
    /* 盛りつけ：残った粒を皿の上のドームの形へ。皿の位置は鍋の中の座標に直して置く */
    var serving = sv >= 0, slot = 0, total = 0, Rd = 0;
    if (serving) {
      for (var u = 0; u < gs.length; u++) if (!gs[u].lost) total++;
      total *= K;
      Rd = 0.035 + 0.07 * Math.cbrt(total / (gs.length * K));
      this.wok.updateMatrix(); this.stove.updateMatrix(); this.invW.copy(this.wok.matrix).invert();
      /* 芯は粒が落ちるにつれて育つ。色は粒の火の通りの平均 */
      var grow = Math.max(0, Math.min(1, (sv - 1.0) / 0.9)), ck = 0, bn = 0, cnt = 0;
      for (var u2 = 0; u2 < gs.length; u2++) if (!gs[u2].lost) { ck += gs[u2].cook; bn += gs[u2].burn; cnt++; }
      this.mound.visible = this.moundShadow.visible = total > 0 && grow > 0;
      this.mound.position.set(this.PLATE.x, this.plate.position.y + 0.008, this.PLATE.z);
      this.mound.scale.set(Rd * 1.02 * Math.max(0.3, grow), Rd * 1.15 * grow, Rd * 1.02 * Math.max(0.3, grow));
      this.mound.material.color.copy(this.cRaw).lerp(this.cGold, cnt ? ck / cnt * 0.8 : 0).lerp(this.cBurn, cnt ? Math.min(1, bn / cnt * 1.2) : 0).multiplyScalar(0.92);
      this.moundShadow.position.set(this.PLATE.x, this.plate.position.y + 0.005, this.PLATE.z);
      this.moundShadow.scale.setScalar(Rd * 1.45 * Math.max(0.3, grow));
    } else { this.mound.visible = this.moundShadow.visible = false; }
    for (var n = 0; n < gs.length * K; n++) {
      var i = Math.floor(n / K), g = gs[i], kind = n % K ? 0 : g.kind;
      if (g.lost && g.y < -1.4) { Sc.set(0, 0, 0); }
      else Sc.set(1, 1, 1);
      var e = this.rot[n], o = this.off[n], spread = g.on ? 1 : 1.6;
      if (!g.on && !serving) { e.x += 0.25; e.z += 0.17; }   /* 盛った後は回さない（うごめかない） */
      Q.setFromEuler(e);
      V.set(g.x + o[0] * spread, g.y + 0.006 + o[1], g.z + o[2] * spread);
      if (serving && !g.lost) {
        /* 落ちる先は皿の上の山の中のばらばらな場所。鍋の傾いた側（左）にある粒から順に、少しずつずれて落ちる */
        var pr = this.pr[n], rr2 = Rd * 1.15 * Math.sqrt(pr[0]), an = pr[1] * 6.2832;
        var hgt = Rd * 1.3 * Math.sqrt(Math.max(0, 1 - pr[0])) * (0.8 + 0.2 * pr[2]);
        var tx = this.PLATE.x + Math.cos(an) * rr2, ty = this.plate.position.y + 0.012 + hgt, tz = this.PLATE.z + Math.sin(an) * rr2;
        var go = Math.max(0, Math.min(1, (sv - 0.85 - (g.x + 0.2) * 1.2 - pr[3] * 0.35) / 0.32));
        if (go > 0) {
          var sx = this.tmpW.copy(V).applyMatrix4(this.wok.matrix);
          var fx2 = sx.x + (tx - sx.x) * go, fz2 = sx.z + (tz - sx.z) * go;
          var fy2 = sx.y + (ty - sx.y) * go * go + Math.sin(go * Math.PI) * 0.02;
          V.set(fx2, fy2, fz2).applyMatrix4(this.invW);
          if (go < 1) { e.x += 0.3; e.y += 0.2; }
        }
      }
      M.compose(V, Q, Sc);
      this.rice.setMatrixAt(n, M);
      var c = this.col;
      if (kind === 2) c.copy(this.cNegi);
      else {
        c.copy(kind === 1 ? this.cEgg : this.cRaw).lerp(this.cGold, g.cook * (kind === 1 ? 0.3 : 0.8));
        c.lerp(this.cBurn, Math.min(1, g.burn * 1.2));
      }
      this.rice.setColorAt(n, c);
    }
    this.rice.instanceMatrix.needsUpdate = true;
    if (this.rice.instanceColor) this.rice.instanceColor.needsUpdate = true;
  };

  /* 激突：前のめりに転がって雪に突っ込む。鍋は回りながら前へ飛び、板も外れる */
  GameScene.prototype.crashPose = function (c, t) {
    /* 激突：後ろへ吹っ飛んで空を見上げる。その空へ鍋が回りながら飛び、炒飯が舞う。板も外れる */
    var e = 1 - Math.pow(1 - Math.min(1, c / 0.9), 3);
    var back = e * 1.6;
    this.rig.position.x -= -Math.sin(this.rig.rotation.y) * back;
    this.rig.position.z -= -Math.cos(this.rig.rotation.y) * back;
    this.rig.position.y -= e * 1.05;
    this.head.rotation.set(-0.5 + e * 1.15 + Math.sin(c * 26) * 0.05 * (1 - e), e * 0.25, e * 0.55, "YXZ");
    this.wok.position.set(c * 0.5, -0.44 + c * 4.2 - c * c * 1.9, -0.5 - c * 2.4);
    this.wok.rotation.set(c * 7, c * 3, c * 5);
    this.stove.position.set(this.STOVE.x - c * 0.6, this.STOVE.y + c * 3.0 - c * c * 1.8, this.STOVE.z - c * 1.6);
    this.stove.rotation.set(c * 5, c * 3, c * 4);
    this.skis.position.set(c * -0.4, c * 2.2 - c * c * 1.4, -c * 1.2);
    this.skis.rotation.set(c * 4, c * 2, c * 3);
  };

  /* 肩から鍋の握り所まで袖を伸ばす。転んだときは腕を振り上げる */
  GameScene.prototype.syncArms = function (c) {
    this.wok.updateMatrix(); this.stove.updateMatrix();
    for (var i = 0; i < this.arms.length; i++) {
      var A = this.arms[i], k = A.k;
      var sh = this.tmpV.set(k * 0.22, -0.6, 0.02);
      var wr = k > 0 ? this.tmpW.copy(this.gripR).applyMatrix4(this.wok.matrix) : this.tmpW.copy(this.gripL).applyMatrix4(this.stove.matrix);
      if (c > 0) wr.set(k * (0.35 + c * 0.2), -0.2 + c * 0.9, -0.35);
      var dir = wr.clone().sub(sh), len = Math.max(0.05, dir.length() - 0.045);
      dir.normalize();
      this.tmpQ.setFromUnitVectors(this.up, dir);
      A.sleeve.position.copy(sh); A.sleeve.quaternion.copy(this.tmpQ); A.sleeve.scale.set(1, len, 1);
      A.cuff.position.copy(sh).addScaledVector(dir, len); A.cuff.quaternion.copy(this.tmpQ);
      A.hand.position.copy(sh).addScaledVector(dir, len + 0.01); A.hand.quaternion.copy(this.tmpQ);
    }
  };

  GameScene.prototype.syncFlakes = function (p) {
    var a = this.flakes.geometry.attributes.position.array, r = this.flakeR;
    var fx = -Math.sin(p.h), fz = -Math.cos(p.h);
    for (var i = 0; i < this.flakeN; i++) {
      var k = i * 3, dx = a[k] - p.x, dz = a[k + 2] - p.z;
      var ahead = dx * fx + dz * fz;
      if (!this.flakeInit || ahead < -1 || ahead > 26 || Math.abs(dx * fz - dz * fx) > 9) {
        var d = this.flakeInit ? 14 + r() * 10 : 1 + r() * 23, side = (r() * 2 - 1) * (1 + r() * 6);
        a[k] = p.x + fx * d - fz * side * -1; a[k + 2] = p.z + fz * d + fx * side * -1;
        a[k + 1] = p.y - 1.6 + r() * 2.4;
      }
      a[k + 1] -= 0.012;
    }
    this.flakeInit = true;
    this.flakes.geometry.attributes.position.needsUpdate = true;
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
