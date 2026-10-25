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
    this.body = add(sph, M.fur);
    this.belly = add(sph, M.belly);
    this.thigh = add(sph, M.fur);
    this.foot = add(new T.CapsuleGeometry(1, 1, 4, 10), M.dark);
    this.tail = add(new T.CylinderGeometry(0.05, 0.17, 1, 12), M.fur);
    this.tailTip = add(new T.SphereGeometry(0.05, 8, 6), M.fur);
    this.armB = add(new T.CapsuleGeometry(0.075, 1, 4, 8), M.fur);
    this.armF = add(new T.CapsuleGeometry(0.075, 1, 4, 8), M.fur);
    var glove = new T.SphereGeometry(0.19, 18, 12);
    this.gloveB = add(glove, M.glove);
    this.gloveF = add(glove, M.glove);
    this.cuffB = add(new T.CylinderGeometry(0.11, 0.11, 0.08, 14), M.cuff);
    this.cuffF = add(new T.CylinderGeometry(0.11, 0.11, 0.08, 14), M.cuff);
    /* 頭：+x が前。左右は scale.x で返す */
    var h = this.head = new T.Group(); g.add(h);
    function hadd(geo, m, x, y, z, sx, sy, sz) { var o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx || 1, sy || 1, sz || 1); o.castShadow = true; h.add(o); return o; }
    hadd(sph, M.fur, 0, 0, 0, 0.24, 0.2, 0.2);
    hadd(sph, M.fur, 0.2, -0.05, 0, 0.21, 0.12, 0.13);
    hadd(sph, M.belly, 0.22, -0.11, 0, 0.16, 0.06, 0.1);
    hadd(sph, M.nose, 0.4, -0.02, 0, 0.045, 0.035, 0.05);
    hadd(sph, M.eye, 0.11, 0.06, 0.15, 0.035, 0.04, 0.03);
    hadd(sph, M.eye, 0.11, 0.06, -0.15, 0.035, 0.04, 0.03);
    var ear = new T.ConeGeometry(0.075, 0.34, 12);
    [-1, 1].forEach(function (s) {
      var e = hadd(ear, M.fur, -0.06, 0.3, 0.09 * s);
      e.rotation.set(0.25 * s, 0, 0.22);
      var inner = hadd(ear, M.ear, -0.045, 0.29, 0.1 * s, 0.6, 0.85, 0.5);
      inner.rotation.set(0.25 * s, 0, 0.22);
    });
    scene.add(g);
    this.hurt = 0;
    this.v = {};
  }

  /* 物理の点（2Dのpx）から形を置く */
  Roo.prototype.sync = function (f, map, z) {
    var v = this.v, P = f.P, d = f.dir, s = f.sc;
    ["foot", "hip", "chest", "head", "tail", "gf", "gb"].forEach(function (n) {
      v[n] = v[n] || new T.Vector3();
      map(P[n], v[n]); v[n].z = z;
    });
    var hip = v.hip, chest = v.chest, foot = v.foot;
    /* 胴：腰から胸 */
    var len = hip.distanceTo(chest);
    between(this.body, hip, chest);
    this.body.scale.set(0.43 * s, len / 2 + 0.38 * s, 0.37 * s);
    between(this.belly, hip, chest);
    this.belly.position.x += 0.12 * d * s; this.belly.position.z += 0.05;
    this.belly.scale.set(0.3 * s, len / 2 + 0.22 * s, 0.33 * s);
    /* 太もも */
    var tm = tmpV.copy(foot).sub(hip).multiplyScalar(0.35).add(hip).clone();
    between(this.thigh, hip, foot);
    this.thigh.position.copy(tm);
    this.thigh.scale.set(0.38 * s, 0.5 * s, 0.33 * s);
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
    var shB = sh.clone(); shB.z = z - 0.2 * s;
    var shF = sh.clone(); shF.z = z + 0.2 * s;
    var gB = v.gb.clone(); gB.z = z - 0.2 * s;
    var gF = v.gf.clone(); gF.z = z + 0.2 * s;
    between(this.armB, shB, gB, 1); this.armB.scale.x = this.armB.scale.z = s;
    between(this.armF, shF, gF, 1); this.armF.scale.x = this.armF.scale.z = s;
    this.gloveB.position.copy(gB); this.gloveB.scale.set(1.1 * s, 0.95 * s, 0.95 * s);
    this.gloveF.position.copy(gF); this.gloveF.scale.set(1.1 * s, 0.95 * s, 0.95 * s);
    this.cuffB.position.lerpVectors(shB, gB, 0.82); this.cuffB.quaternion.copy(this.armB.quaternion); this.cuffB.scale.setScalar(s);
    this.cuffF.position.lerpVectors(shF, gF, 0.82); this.cuffF.quaternion.copy(this.armF.quaternion); this.cuffF.scale.setScalar(s);
    /* 頭：胸から頭への向きで傾ける */
    var hx = v.head.x - chest.x, hy = v.head.y - chest.y;
    var rot = Math.atan2(hy, hx) - Math.atan2(0.58, 0.28 * d);
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

    var M = {
      fur: mat(0xa8693b, { roughness: 0.95 }),
      belly: mat(0xdcb48a, { roughness: 0.95 }),
      dark: mat(0x7c4a28, { roughness: 0.95 }),
      ear: mat(0xd9958a, { roughness: 0.9 }),
      eye: mat(0x0c0c0c, { roughness: 0.15 }),
      nose: mat(0x2a1a14, { roughness: 0.4 }),
      glove: mat(0xc01c1c, { roughness: 0.32 }),
      cuff: mat(0xf2f2f2, { roughness: 0.5 })
    };
    var M2 = {}; for (var k in M) M2[k] = M[k];
    M2.glove = mat(0x1d48b8, { roughness: 0.32 });
    M2.fur = mat(0x96704e, { roughness: 0.95 });
    this.me = new Roo(sc, M);
    this.foe = new Roo(sc, M2);
    this.furM = [M.fur, M2.fur];
  }

  /* s: { me, foe, W, H, ground } */
  KangarooScene.prototype.sync = function (s) {
    var W = s.W, G = s.ground;
    function map(p, out) { out.set((p.x - W / 2) / 100, (G - p.y) / 100, 0); return out; }
    if (s.me) this.me.sync(s.me, map, 0.15);
    if (s.foe) this.foe.sync(s.foe, map, -0.15);
    this.foe.group.visible = !!s.showFoe;
    this.furM[0].emissive.setRGB(0.14 * this.me.hurt, 0, 0);
    this.furM[1].emissive.setRGB(0.14 * this.foe.hurt, 0, 0);
    /* 画面の真ん中を正面から見る。z=0 の面で 1px = 0.01 になる距離に置く */
    var cy = (G - s.H / 2) / 100, dist = (s.H / 200) / Math.tan(FOV * Math.PI / 360);
    this.camera.position.set(0, cy, dist);
    this.camera.lookAt(0, cy, 0);
  };

  KangarooScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.KangarooScene = KangarooScene;
})(window);
