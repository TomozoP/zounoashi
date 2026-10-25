/* カンガルーバトルの立体の見た目（three.js）。games/three-base.js の Z3 を土台にする。
   動き（点とばねの物理）はゲーム側の2Dのまま。ここは物理の点の位置を受け取り、
   その位置に胴・脚・しっぽ・頭・腕・グローブを置いて描くだけ。
   2Dの1px = 0.01、地面の線 = 高さ0。カメラは画面の真ん中を正面から見るので、
   2Dの座標と画面上の位置がそろう（当たりの光や指の印を2Dで重ねられる）。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var FOV = 30;

  function mat(color, extra) { return Z3.std(color, extra); }

  /* 2点の間に、縦向き（y）に作った形を渡す */
  var UP = null, tmpV = null;
  function between(mesh, a, b, baseLen) {
    tmpV.subVectors(b, a);
    var len = tmpV.length() || 0.001;
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, tmpV.multiplyScalar(1 / len));
    if (baseLen) mesh.scale.set(1, len / baseLen, 1);
  }

  function Roo(scene, M) {
    var g = this.group = new T.Group();
    function add(geo, m) { var o = new T.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
    var sph = new T.SphereGeometry(1, 20, 14);
    this.body = add(sph, M.fur);      /* 腰まわり（大きい） */
    this.upper = add(sph, M.fur);     /* 胸（細い・なで肩） */
    this.belly = add(sph, M.belly);
    this.neck = add(new T.CapsuleGeometry(1, 1, 4, 10), M.fur);
    this.trunks = add(sph, M.trunks);
    this.thigh = add(sph, M.fur);
    this.foot = add(new T.CapsuleGeometry(1, 1, 4, 10), M.dark);
    this.tail = add(new T.CylinderGeometry(0.045, 0.2, 1, 14), M.fur);
    this.tailTip = add(new T.SphereGeometry(0.05, 8, 6), M.fur);
    this.armB = add(new T.CapsuleGeometry(0.075, 1, 4, 8), M.fur);
    this.armF = add(new T.CapsuleGeometry(0.075, 1, 4, 8), M.fur);
    /* 前腕（ひじから先） */
    this.foreB = add(new T.CapsuleGeometry(0.07, 1, 4, 8), M.fur);
    this.foreF = add(new T.CapsuleGeometry(0.07, 1, 4, 8), M.fur);
    var glove = new T.SphereGeometry(0.19, 18, 12);
    this.gloveB = add(glove, M.glove);
    this.gloveF = add(glove, M.glove);
    this.cuffB = add(new T.CylinderGeometry(0.11, 0.11, 0.08, 14), M.cuff);
    this.cuffF = add(new T.CylinderGeometry(0.11, 0.11, 0.08, 14), M.cuff);
    /* 頭：+x が前。左右は scale.x で返す */
    var h = this.head = new T.Group(); g.add(h);
    function hadd(geo, m, x, y, z, sx, sy, sz) { var o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx || 1, sy || 1, sz || 1); o.castShadow = true; h.add(o); return o; }
    hadd(sph, M.fur, 0, 0, 0, 0.2, 0.17, 0.17);
    /* 鼻先は長さを変えられるよう、まとめて1つの組にする */
    var sn = this.snout = new T.Group(); h.add(sn);
    function sadd(m, x, y, z, sx, sy, sz) { var o = new T.Mesh(sph, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; sn.add(o); }
    sadd(M.fur, 0.2, -0.06, 0, 0.24, 0.11, 0.12);
    sadd(M.belly, 0.2, -0.12, 0, 0.18, 0.05, 0.09);
    sadd(M.nose, 0.43, -0.03, 0, 0.045, 0.035, 0.05);
    this.ears = [];
    hadd(sph, M.eye, 0.11, 0.06, 0.15, 0.035, 0.04, 0.03);
    hadd(sph, M.eye, 0.11, 0.06, -0.15, 0.035, 0.04, 0.03);
    var ear = new T.ConeGeometry(0.075, 0.34, 12);
    var self = this;
    [-1, 1].forEach(function (s) {
      var eg = new T.Group(); eg.position.set(-0.06, 0.16, 0.09 * s); eg.rotation.set(0.25 * s, 0, 0.22); h.add(eg);
      var e = new T.Mesh(ear, M.fur); e.position.y = 0.14; e.castShadow = true; eg.add(e);
      var inner = new T.Mesh(ear, M.ear); inner.position.set(0.015, 0.13, 0.01 * s); inner.scale.set(0.6, 0.85, 0.5); eg.add(inner);
      self.ears.push(eg);
    });
    /* 黒いふち：裏側だけ描く少し大きい写しを各部品に重ねる */
    var lineM = new T.MeshBasicMaterial({ color: 0x111111, side: T.BackSide });
    var parts = [];
    g.traverse(function (o) { if (o.isMesh && o.material !== M.eye && o.material !== M.nose && o.material !== M.ear) parts.push(o); });
    parts.forEach(function (o) {
      var thin = o.geometry.type !== "SphereGeometry", k = thin ? 1.5 : 1.1;
      var l = new T.Mesh(o.geometry, lineM); l.scale.set(k, thin ? 1.04 : k, k); o.add(l);
    });
    scene.add(g);
    this.M = M;
    this.hurt = 0;
    this.v = {};
  }

  /* 見た目の違い：毛色・グローブ・トランクスの色、耳と鼻先の長さ */
  Roo.prototype.setLook = function (L) {
    var M = this.M;
    M.fur.color.setHex(L.fur);
    M.belly.color.setHex(L.fur).lerp(new T.Color(0xf3dcc0), 0.55);
    M.glove.color.setHex(L.glove);
    M.trunks.color.setHex(L.trunks);
    this.ears.forEach(function (e) { e.scale.set(1, L.ear, 1); });
    this.snout.scale.set(L.snout, 1, 1);
  };

  /* 物理の点（2Dのpx）から形を置く */
  Roo.prototype.sync = function (f, map, z, other) {
    var v = this.v, P = f.P, d = f.dir, s = f.sc;
    ["foot", "hip", "chest", "head", "tail", "gf", "gb"].forEach(function (n) {
      v[n] = v[n] || new T.Vector3();
      map(P[n], v[n]); v[n].z = z;
    });
    var hip = v.hip, chest = v.chest, foot = v.foot;
    /* 胴：洋なし形。腰まわりが大きく、胸は細い */
    var len = hip.distanceTo(chest);
    between(this.body, hip, chest);
    this.body.position.lerpVectors(hip, chest, 0.35);
    this.body.scale.set(0.46 * s, len * 0.42 + 0.3 * s, 0.4 * s);
    between(this.upper, hip, chest);
    this.upper.position.lerpVectors(hip, chest, 0.85);
    this.upper.scale.set(0.27 * s, 0.36 * s, 0.26 * s);
    between(this.belly, hip, chest);
    this.belly.position.lerpVectors(hip, chest, 0.42);
    this.belly.position.x += 0.14 * d * s; this.belly.position.z += 0.06;
    this.belly.scale.set(0.3 * s, len * 0.38 + 0.2 * s, 0.34 * s);
    /* トランクス：腰まわりを少し大きく包む */
    between(this.trunks, hip, chest);
    this.trunks.position.lerpVectors(hip, chest, 0.2);
    this.trunks.scale.set(0.5 * s, 0.32 * s, 0.44 * s);
    /* 首：胸から頭までつなぐ（離れない） */
    var nk = tmpV.copy(v.head).sub(chest).multiplyScalar(0.1).add(chest).clone();
    between(this.neck, nk, v.head);
    this.neck.scale.set(0.12 * s, nk.distanceTo(v.head) * 0.9, 0.12 * s);
    /* 太もも：大きく、前へ張り出す */
    var tm = tmpV.copy(foot).sub(hip).multiplyScalar(0.3).add(hip).clone();
    between(this.thigh, hip, foot);
    this.thigh.position.copy(tm);
    this.thigh.position.x += 0.08 * d * s;
    this.thigh.scale.set(0.44 * s, 0.56 * s, 0.38 * s);
    /* 足：かかとから前へ長く */
    this.foot.position.set(foot.x + 0.42 * d * s, foot.y + 0.08 * s, z);
    this.foot.rotation.set(0, 0, Math.PI / 2);
    this.foot.scale.set(0.09 * s, 0.8 * s, 0.11 * s);
    /* しっぽ */
    between(this.tail, v.tail, hip, 1);
    this.tail.scale.x = this.tail.scale.z = s;
    this.tailTip.position.copy(v.tail);
    /* 腕とグローブ */
    var sh = tmpV.copy(v.head).sub(chest).multiplyScalar(0.25).add(chest).clone();
    /* グローブはいつも胴より手前（カメラ側）に出す。奥の腕は肩を奥に残し、胴の横から前へ回す */
    var shB = sh.clone(); shB.z = z - 0.12 * s;
    var shF = sh.clone(); shF.z = z + 0.5 * s;
    var gB = v.gb.clone(); gB.z = z + 0.4 * s;
    var gF = v.gf.clone(); gF.z = z + 0.62 * s;
    /* ひじは下へ曲がる。肩とグローブが近いほど深く曲がり、伸ばすとまっすぐに近づく */
    function elbow(a, b) {
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001;
      var l = Math.max(0.5 * s, d / 2 * 1.02), h = Math.sqrt(Math.max(0, l * l - d * d / 4));
      var px = dy / d, py = -dx / d;
      if (py > 0) { px = -px; py = -py; }
      return new T.Vector3((a.x + b.x) / 2 + px * h, (a.y + b.y) / 2 + py * h, (a.z + b.z) / 2 + 0.04 * (a.z > z ? 1 : -1));
    }
    var eB = elbow(shB, gB), eF = elbow(shF, gF);
    between(this.armB, shB, eB, 1); this.armB.scale.x = this.armB.scale.z = s;
    between(this.armF, shF, eF, 1); this.armF.scale.x = this.armF.scale.z = s;
    between(this.foreB, eB, gB, 1); this.foreB.scale.x = this.foreB.scale.z = s;
    between(this.foreF, eF, gF, 1); this.foreF.scale.x = this.foreF.scale.z = s;
    this.gloveB.position.copy(gB); this.gloveB.scale.set(1.1 * s, 0.95 * s, 0.95 * s);
    this.gloveF.position.copy(gF); this.gloveF.scale.set(1.1 * s, 0.95 * s, 0.95 * s);
    this.cuffB.position.lerpVectors(eB, gB, 0.72); this.cuffB.quaternion.copy(this.foreB.quaternion); this.cuffB.scale.setScalar(s);
    this.cuffF.position.lerpVectors(eF, gF, 0.72); this.cuffF.quaternion.copy(this.foreF.quaternion); this.cuffF.scale.setScalar(s);
    /* 頭：いつも相手の顔の方を向く（倒れたら胸から頭への向き） */
    var rot;
    if (other && !f.ko) {
      v.look = v.look || new T.Vector3();
      map(other.P.head, v.look);
      var a = Math.atan2(v.look.y - v.head.y, (v.look.x - v.head.x) * d);
      rot = Math.max(-0.6, Math.min(0.6, a)) * d;
    } else {
      var hx = v.head.x - chest.x, hy = v.head.y - chest.y;
      rot = Math.atan2(hy, hx) - Math.atan2(0.58, 0.28 * d);
    }
    this.head.position.copy(v.head);
    this.head.rotation.set(0, 0, rot);
    this.head.scale.set(d * s, s, s);
    /* 殴られた瞬間は少し赤く */
    this.hurt = f.hurtT > 0 ? 1 : this.hurt * 0.8;
  };

  function KangarooScene() {
    T = global.THREE;
    UP = new T.Vector3(0, 1, 0); tmpV = new T.Vector3();
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: FOV, near: 1, far: 80 }, finish: { contrast: 0.12, vignette: 0.45, grain: 0.02 } });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    sc.background = new T.Color(0x14161c);
    sc.fog = new T.Fog(0x14161c, 18, 40);
    /* 明かり：会場の上からのスポットと、やわらかい周りの光 */
    sc.add(new T.HemisphereLight(0xfff2e0, 0x2a2420, 0.7));
    var key = new T.DirectionalLight(0xfff1dc, 2.6);
    key.position.set(-3, 9, 7); key.castShadow = true;
    key.shadow.mapSize.set(Z3.mobile ? 1024 : 2048, Z3.mobile ? 1024 : 2048);
    var c = key.shadow.camera; c.left = -6; c.right = 6; c.top = 6; c.bottom = -2; c.near = 1; c.far = 30;
    key.shadow.bias = -0.0006;
    sc.add(key);
    var rim = new T.DirectionalLight(0xbcd4ff, 1.1); rim.position.set(4, 4, -6); sc.add(rim);

    /* リング：マット・エプロン・柱・ロープ */
    var matTex = Z3.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#35587e"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2200; i++) { g.fillStyle = "rgba(" + (Math.random() < 0.5 ? "255,255,255,.035" : "0,0,0,.05") + ")"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    }, 3);
    var floor = new T.Mesh(new T.BoxGeometry(12, 0.3, 7), mat(0xffffff, { map: matTex, roughness: 0.85 }));
    floor.position.set(0, -0.15, -0.6); floor.receiveShadow = true; sc.add(floor);
    var apron = new T.Mesh(new T.BoxGeometry(12.2, 1.4, 7.2), mat(0x1b1d22, { roughness: 0.7 }));
    apron.position.set(0, -1.0, -0.6); sc.add(apron);
    var post = new T.CylinderGeometry(0.12, 0.12, 3.4, 12), postM = mat(0xb8bcc4, { roughness: 0.35, metalness: 0.6 });
    [-5.2, 5.2].forEach(function (x) { var p = new T.Mesh(post, postM); p.position.set(x, 1.7, -3.6); p.castShadow = true; sc.add(p); });
    var ropeCols = [0xd23a32, 0xf0f0f0, 0x2f5fc2];
    [1.05, 1.95, 2.85].forEach(function (y, i) {
      var r = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 10.4, 10), mat(ropeCols[i], { roughness: 0.5 }));
      r.rotation.z = Math.PI / 2; r.position.set(0, y, -3.6); sc.add(r);
    });
    /* 奥の客席の暗がりにぼんやりした明かり */
    var dots = Z3.canvasTex(512, 128, function (g, w, h) {
      g.fillStyle = "#0f1116"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 160; i++) { g.fillStyle = "rgba(255,230,190," + (0.04 + Math.random() * 0.1) + ")"; g.beginPath(); g.arc(Math.random() * w, h * 0.3 + Math.random() * h * 0.7, 1 + Math.random() * 3, 0, Math.PI * 2); g.fill(); }
    });
    var back = new T.Mesh(new T.PlaneGeometry(40, 10), new T.MeshBasicMaterial({ map: dots }));
    back.position.set(0, 2.5, -14); sc.add(back);

    /* 観客：暗いシルエットを段々に並べ、盛り上がるほど揺れる（目立ちすぎないよう暗く・霧の奥） */
    var sil = Z3.canvasTex(64, 96, function (g, w, h) {
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(w / 2, 26, 15, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(6, h); g.quadraticCurveTo(8, 46, w / 2, 44); g.quadraticCurveTo(w - 8, 46, w - 6, h); g.closePath(); g.fill();
    });
    var crowdM = new T.MeshBasicMaterial({ map: sil, transparent: true, alphaTest: 0.4, color: 0xffffff, fog: true });
    var rows = Z3.mobile ? 4 : 5, perRow = Z3.mobile ? 26 : 34, n = rows * perRow;
    var crowd = this.crowd = new T.InstancedMesh(new T.PlaneGeometry(0.75, 1.1), crowdM, n);
    this.crowdBase = [];
    var col = new T.Color(), rr = Z3.rng(11), m4 = new T.Matrix4();
    for (var r = 0; r < rows; r++) for (var i = 0; i < perRow; i++) {
      var k = r * perRow + i;
      var x = -13 + (i + rr() * 0.6) * (26 / perRow), y = 0.6 + r * 0.95 + rr() * 0.15, zz = -6.5 - r * 1.3;
      var cs = 0.9 + rr() * 0.25;
      this.crowdBase.push({ x: x, y: y, z: zz, s: cs, ph: rr() * 6.28, sp: 5 + rr() * 5 });
      m4.makeScale(cs, cs, 1); m4.setPosition(x, y, zz); crowd.setMatrixAt(k, m4);
      var v = 0.045 + rr() * 0.045;
      col.setRGB(v * (0.9 + rr() * 0.3), v * (0.85 + rr() * 0.2), v * (0.95 + rr() * 0.3));
      crowd.setColorAt(k, col);
    }
    sc.add(crowd);
    /* カメラのフラッシュ（盛り上がるほど多く） */
    var flashTex = Z3.canvasTex(64, 64, function (g, w, h) {
      var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(220,235,255,.6)"); gr.addColorStop(1, "rgba(200,220,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    this.flashes = [];
    for (var f = 0; f < 6; f++) {
      var sp = new T.Sprite(new T.SpriteMaterial({ map: flashTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }));
      sp.scale.set(1.4, 1.4, 1); sp.visible = false; sc.add(sp);
      this.flashes.push({ s: sp, t: 1 });
    }
    /* 天井からの照明の筋（うっすら） */
    this.beams = [];
    var beamM = new T.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.01, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
    [-3.5, 3.5].forEach(function (x, i) {
      var b = new T.Mesh(new T.ConeGeometry(1.6, 12, 20, 1, true), beamM);
      b.position.set(x, 6, -3); b.rotation.z = (i ? 1 : -1) * 0.25;
      sc.add(b); this.beams.push(b);
    }, this);
    this.t = 0;

    var M = {
      fur: mat(0xcd8c58, { roughness: 0.95 }),
      belly: mat(0xdcb48a, { roughness: 0.95 }),
      dark: mat(0x9c6640, { roughness: 0.95 }),
      ear: mat(0xd9958a, { roughness: 0.9 }),
      eye: mat(0x0c0c0c, { roughness: 0.15 }),
      nose: mat(0x2a1a14, { roughness: 0.4 }),
      glove: mat(0xc01c1c, { roughness: 0.32 }),
      trunks: mat(0x8a1414, { roughness: 0.55 }),
      cuff: mat(0xf2f2f2, { roughness: 0.5 })
    };
    var M2 = {}; for (var k in M) M2[k] = M[k];
    M2.glove = mat(0x1d48b8, { roughness: 0.32 });
    M2.fur = mat(0xc49a70, { roughness: 0.95 });
    M2.belly = mat(0xdcb48a, { roughness: 0.95 });
    M2.trunks = mat(0x1d48b8, { roughness: 0.55 });
    this.me = new Roo(sc, M);
    this.foe = new Roo(sc, M2);
    this.furM = [M.fur, M2.fur];
  }

  /* s: { me, foe, W, H, ground } */
  KangarooScene.prototype.sync = function (s) {
    var W = s.W, G = s.ground;
    function map(p, out) { out.set((p.x - W / 2) / 100, (G - p.y) / 100, 0); return out; }
    if (s.me) this.me.sync(s.me, map, 0.15, s.foe);
    if (s.foe) this.foe.sync(s.foe, map, -0.15, s.me);
    if (s.foeLook && s.foeLook !== this.foeLook) { this.foeLook = s.foeLook; this.foe.setLook(s.foeLook); }
    this.foe.group.visible = !!s.showFoe;
    this.furM[0].emissive.setRGB(0.14 * this.me.hurt, 0, 0);
    this.furM[1].emissive.setRGB(0.14 * this.foe.hurt, 0, 0);
    this.animate(s.dt || 1 / 60, s.excite || 0);
    /* 画面の真ん中を正面から見る。z=0 の面で 1px = 0.01 になる距離に置く */
    var cy = (G - s.H / 2) / 100, dist = (s.H / 200) / Math.tan(FOV * Math.PI / 360);
    this.camera.position.set(0, cy, dist);
    this.camera.lookAt(0, cy, 0);
  };

  /* 観客の揺れ・フラッシュ・照明の筋。excite は 0〜1 の盛り上がり */
  var m4b = null;
  KangarooScene.prototype.animate = function (dt, excite) {
    this.t += dt;
    m4b = m4b || new T.Matrix4();
    var t = this.t, amp = 0.03 + excite * 0.22, crowd = this.crowd;
    for (var i = 0; i < this.crowdBase.length; i++) {
      var c = this.crowdBase[i], b = Math.abs(Math.sin(t * c.sp * (0.5 + excite * 0.5) + c.ph));
      m4b.makeScale(c.s, c.s, 1); m4b.setPosition(c.x + Math.sin(t * 0.7 + c.ph) * 0.05, c.y + b * amp, c.z);
      crowd.setMatrixAt(i, m4b);
    }
    crowd.instanceMatrix.needsUpdate = true;
    var rate = 0.4 + excite * 6;
    this.flashes.forEach(function (f) {
      f.t += dt;
      if (f.t > 0.12) {
        f.s.visible = false;
        if (Math.random() < rate * dt / 6) {
          var c = this.crowdBase[(Math.random() * this.crowdBase.length) | 0];
          f.s.position.set(c.x, c.y + 0.35, c.z + 0.1); f.t = 0; f.s.visible = true;
        }
      }
      f.s.material.opacity = f.s.visible ? 1 - f.t / 0.12 : 0;
    }, this);
    this.beams.forEach(function (b, i) { b.rotation.z = (i ? 1 : -1) * (0.25 + Math.sin(t * 0.4 + i) * 0.06); });
  };

  KangarooScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.KangarooScene = KangarooScene;
})(window);
