/* 倒してもいいですかゲームの3Dの絵（three.js）。土台は games/three-base.js の Z3。
   人の作りはアツアツ一輪車と同じ（玉の頭、棒の手足、玉の胴）。鼻はなし。
   単位はメートル。進む向き（座席の前）が +x、手前（カメラ側）が +z。
   当たり判定に使う形（背もたれの箱・後ろの人の頭）もここで決めて、ゲーム側から使う。
   カメラは真横から遠近なし（正射影）で写すので、画面で見える形と当たりの形がそのまま一致する。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  var PITCH = 0.78;                             /* 座席の間隔 */
  var SEAT_Y = 0.45;                            /* 座面の高さ */
  var BACK = { u0: -0.12, u1: 0.02, v0: 0, v1: 0.95 };  /* 背もたれ（軸から見た箱。u は前が＋、v は上） */
  var HEAD_R = 0.14;
  /* キャップ（頭の中心から見た形。頭と一緒に nd だけ回る）。てっぺんの丸みと前に出たつば */
  var CAP = { dome: { x: -0.005, y: 0.045, rx: 0.15, ry: 0.11 }, brim: { x0: 0.09, x1: 0.24, y: 0.04, t: 0.016 } };
  /* 後ろの人の頭の外形の点（頭の中心から、回す前）。当たりはこの点と背もたれの箱の距離で見る（キャップは自分だけ） */
  var OUTLINE = (function () {
    var pts = [], n = 360;
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; pts.push([Math.cos(a) * HEAD_R, Math.sin(a) * HEAD_R]); }
    return pts;
  })();

  /* 背もたれの軸（自分の座席は x=0 に置く） */
  function pivot(seatX) { return { x: seatX - 0.04, y: SEAT_Y }; }

  /* 後ろの人の頭と鼻の先。lean は前かがみの角度（ラジアン） */
  function backHead(lean) {
    var hip = { x: -PITCH + 0.12, y: SEAT_Y + 0.08 };
    var sh = { x: hip.x + Math.sin(lean) * 0.46, y: hip.y + Math.cos(lean) * 0.46 };
    var a2 = lean + 0.08;
    var head = { x: sh.x + Math.sin(a2) * 0.24, y: sh.y + Math.cos(a2) * 0.24 };
    var nd = 0.14;                              /* 背もたれに頭をあずけて少し上向き */
    return { hip: hip, sh: sh, head: head, nd: nd };
  }

  /* 点から背もたれの箱までの距離。a は倒した角度（ラジアン、後ろへ） */
  function distToBack(a, p) {
    var pv = pivot(0), dx = p.x - pv.x, dy = p.y - pv.y;
    var c = Math.cos(a), s = Math.sin(a);
    /* 箱は軸のまわりに a だけ後ろ（-x）へ倒れている。点を箱の向きに戻す */
    var u = dx * c + dy * s, v = -dx * s + dy * c;
    var cu = Math.max(BACK.u0, Math.min(BACK.u1, u)), cv = Math.max(BACK.v0, Math.min(BACK.v1, v));
    var du = u - cu, dv = v - cv;
    return { d: Math.sqrt(du * du + dv * dv), near: { x: pv.x + cu * c - cv * s, y: pv.y + cu * s + cv * c } };
  }
  /* すき間（メートル）。頭の外形のいちばん近い点まで */
  function gapAt(a, lean) {
    var b = backHead(lean), c = Math.cos(b.nd), s = Math.sin(b.nd), best = null;
    for (var i = 0; i < OUTLINE.length; i++) {
      var o = OUTLINE[i], p = { x: b.head.x + o[0] * c - o[1] * s, y: b.head.y + o[0] * s + o[1] * c };
      var h = distToBack(a, p);
      if (!best || h.d < best.gap) best = { gap: h.d, at: p, near: h.near, r: 0 };
    }
    return best;
  }

  function Scene3D() {
    T = global.THREE;
    var self = this;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.45 }, finish: { vignette: 0.06, grain: 0 } });
    var sc = this.scene = st.scene;
    this.camera = st.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
    sc.background = new T.Color("#ebe7dc");
    var L = Z3.lights(sc, { shadows: true, shadowSize: 2.5, scale: 1.25 });   /* くすまないよう、はっきりめ */
    L.key.position.set(2, 5, 4);
    this.geo = { ball: new T.SphereGeometry(1, 18, 12), tube: new T.CylinderGeometry(1, 1, 1, 12), box: new T.BoxGeometry(1, 1, 1) };
    this.mats = {};

    /* 床と壁 */
    var floor = this.part(sc, "box", "#8d887b", -0.4, -1, 1.5, 7, 2, 4.6);
    floor.castShadow = false; floor.receiveShadow = true;
    var wallC = "#ebe7dc";
    this.part(sc, "box", wallC, -0.4, 0.38, -0.75, 7, 0.76, 0.04).receiveShadow = true;
    this.part(sc, "box", wallC, -0.4, 2.0, -0.75, 7, 1.2, 0.04).receiveShadow = true;
    this.part(sc, "box", "#c9c4b6", -0.4, 0.77, -0.72, 7, 0.04, 0.08);
    this.part(sc, "box", "#c9c4b6", -0.4, 1.4, -0.72, 7, 0.04, 0.06);
    [-2.5, -1.45, -0.4, 0.65, 1.7].forEach(function (x) { self.part(sc, "box", wallC, x, 1.08, -0.75, 0.12, 0.66, 0.05); });
    /* 窓の外の景色（流れる） */
    this.sceneryTex = Z3.canvasTex(1024, 256, function (g, w, h) {
      var sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#7fb9ea"); sky.addColorStop(1, "#d6ecfa");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#6c86a8"; g.beginPath(); g.moveTo(260, h); g.lineTo(440, 70); g.lineTo(520, 70); g.lineTo(700, h); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(410, 108); g.lineTo(440, 70); g.lineTo(520, 70); g.lineTo(550, 108); g.lineTo(505, 98); g.lineTo(480, 112); g.lineTo(455, 98); g.fill();
      g.fillStyle = "#6b8f4e";
      for (var i = 0; i < 14; i++) { g.beginPath(); g.ellipse(i * 80 + 20, h - 26, 60, 40, 0, 0, Math.PI * 2); g.fill(); }
    });
    this.sceneryTex.wrapS = T.RepeatWrapping;
    var view = new T.Mesh(new T.PlaneGeometry(7, 0.62), new T.MeshBasicMaterial({ map: this.sceneryTex }));
    view.position.set(-0.4, 1.09, -0.8); sc.add(view);
    /* 荷物棚 */
    this.part(sc, "box", "#b9b4a6", -0.4, 1.9, -0.5, 7, 0.03, 0.4);

    /* 座席2つ（自分・後ろ） */
    this.myBack = this.seat(0);
    this.backBack = this.seat(-PITCH);
    this.backBack.rotation.z = 0.03;   /* 後ろの人の座席はほぼ直角 */

    /* 人 */
    this.me = this.person({ coat: "#3a6fb8", pants: "#2e3442", skin: "#f1c7a1", cap: "#d8412f", hand: "#f1c7a1" });
    this.him = this.person({ coat: "#5d7a4a", pants: "#3a3530", skin: "#eab993", hair: "#2a2420", hand: "#eab993" });
    /* スマホ */
    this.phone = this.part(sc, "box", "#1d1f24", 0, 0, 0, 0.075, 0.008, 0.14);
    this.phoneScreen = this.part(sc, "box", "#9fd8ff", 0, 0, 0, 0.06, 0.002, 0.12, { emissive: "#6fb8ef", emissiveIntensity: 0.6 });

    this.t = 0;
  }

  Scene3D.prototype.mat = function (color, opt) {
    var key = color + JSON.stringify(opt || {});
    if (!this.mats[key]) {
      var o = { color: color, roughness: 0.85 };
      for (var k in opt) o[k] = opt[k];
      this.mats[key] = new T.MeshStandardMaterial(o);
    }
    return this.mats[key];
  };
  Scene3D.prototype.part = function (parent, kind, color, x, y, z, sx, sy, sz, opt) {
    var m = new T.Mesh(this.geo[kind], typeof color === "string" ? this.mat(color, opt) : color);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  /* 太さのある棒を a から b へ渡す（a, b は {x, y, z}） */
  Scene3D.prototype.segment = function (mesh, a, b) {
    var from = new T.Vector3(a.x, a.y, a.z || 0), to = new T.Vector3(b.x, b.y, b.z || 0);
    var d = to.clone().sub(from), len = d.length();
    mesh.position.copy(from).addScaledVector(d, 0.5);
    mesh.scale.y = Math.max(0.001, len);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  };

  /* 座席。背もたれのまとまりを返す（軸で回す） */
  Scene3D.prototype.seat = function (x) {
    var sc = this.scene, blue = "#2f4f86", self = this;
    this.part(sc, "box", blue, x + 0.22, SEAT_Y - 0.06, 0, 0.5, 0.12, 0.48);
    this.part(sc, "box", "#6f747c", x + 0.22, 0.18, 0, 0.36, 0.3, 0.06);
    [-0.25, 0.25].forEach(function (z) {
      self.part(sc, "box", "#4a4f57", x + 0.2, SEAT_Y + 0.2, z, 0.42, 0.05, 0.06);
      self.part(sc, "box", "#4a4f57", x + 0.0, SEAT_Y + 0.08, z, 0.05, 0.2, 0.05);
    });
    var pv = pivot(x), g = new T.Group();
    g.position.set(pv.x, pv.y, 0);
    sc.add(g);
    var u = (BACK.u0 + BACK.u1) / 2;
    this.part(g, "box", blue, u, (BACK.v0 + BACK.v1) / 2, 0, BACK.u1 - BACK.u0, BACK.v1 - BACK.v0, 0.48);
    /* 頭の部分の白いカバー */
    this.part(g, "box", "#f2f2ee", BACK.u1 - 0.03, BACK.v1 - 0.12, 0, 0.07, 0.24, 0.3);   /* 前側だけに出る（裏の当たりの面は変えない） */
    /* 背中側の板と、たたんだテーブル */
    this.part(g, "box", "#26447a", BACK.u0 - 0.004, 0.45, 0, 0.01, 0.6, 0.4);
    this.part(g, "box", "#cfcac0", BACK.u0 - 0.012, 0.42, 0, 0.012, 0.3, 0.36);
    return g;
  };

  /* 人（アツアツ一輪車の作り）。座った姿勢は pose() で毎回置く */
  Scene3D.prototype.person = function (o) {
    var sc = this.scene, p = { o: o };
    p.thigh = this.part(sc, "tube", o.pants, 0, 0, 0, 0.06, 1, 0.06);
    p.shin = this.part(sc, "tube", o.pants, 0, 0, 0, 0.05, 1, 0.05);
    p.knee = this.part(sc, "ball", o.pants, 0, 0, 0, 0.06, 0.06, 0.06);
    p.foot = this.part(sc, "ball", "#3b2a22", 0, 0, 0, 0.09, 0.045, 0.055);
    p.hips = this.part(sc, "ball", o.pants, 0, 0, 0, 0.14, 0.1, 0.15);
    p.torso = this.part(sc, "ball", o.coat, 0, 0, 0, 0.16, 0.26, 0.17);
    p.upper = this.part(sc, "tube", o.coat, 0, 0, 0, 0.045, 1, 0.045);
    p.fore = this.part(sc, "tube", o.coat, 0, 0, 0, 0.04, 1, 0.04);
    p.elbow = this.part(sc, "ball", o.coat, 0, 0, 0, 0.045, 0.045, 0.045);
    p.hand = this.part(sc, "ball", o.hand, 0, 0, 0, 0.045, 0.045, 0.045);
    p.neck = this.part(sc, "tube", o.skin, 0, 0, 0, 0.05, 1, 0.05);
    var head = p.head = new T.Group();
    sc.add(head);
    p.faceMat = this.mat(o.skin).clone();
    p.faceMat.emissive = new T.Color("#ff2010"); p.faceMat.emissiveIntensity = 0;
    var face = new T.Mesh(this.geo.ball, p.faceMat); face.scale.setScalar(HEAD_R); face.castShadow = true; head.add(face);
    if (o.hair) {                                /* 短い髪：頭の玉にぴったり（当たりの形を変えない） */
      var hair = new T.Mesh(new T.SphereGeometry(HEAD_R * 1.002, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), this.mat(o.hair));
      hair.rotation.z = 0.5; hair.castShadow = true; head.add(hair);
    }
    if (o.cap) {
      var D = CAP.dome, B = CAP.brim;
      var dome = new T.Mesh(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(o.cap));
      dome.scale.set(D.rx, D.ry, 0.15); dome.position.set(D.x, D.y, 0); dome.castShadow = true; head.add(dome);
      this.part(head, "box", o.cap, (B.x0 + B.x1) / 2, B.y, 0, B.x1 - B.x0, B.t, 0.2);
      this.part(head, "ball", o.cap, D.x, D.y + D.ry, 0, 0.02, 0.012, 0.02);
    }
    return p;
  };
  /* 座った姿勢。hip, sh（肩）, head（頭の中心）, nd（鼻の向き）, knee, foot, elbow, hand（いずれも x, y）、z は体の奥行き */
  Scene3D.prototype.pose = function (p, q) {
    var z = 0.12;
    function P(a, dz) { return { x: a.x, y: a.y, z: dz == null ? z : dz }; }
    this.segment(p.thigh, P(q.hip), P(q.knee));
    this.segment(p.shin, P(q.knee), P(q.foot));
    p.knee.position.set(q.knee.x, q.knee.y, z);
    p.foot.position.set(q.foot.x + 0.06, q.foot.y, z);
    p.hips.position.set(q.hip.x, q.hip.y, 0);
    var mid = { x: (q.hip.x + q.sh.x) / 2, y: (q.hip.y + q.sh.y) / 2 };
    p.torso.position.set(mid.x, mid.y + 0.04, 0);
    p.torso.rotation.z = -Math.atan2(q.sh.x - q.hip.x, q.sh.y - q.hip.y);
    this.segment(p.upper, P(q.sh, 0.17), P(q.elbow, 0.18));
    this.segment(p.fore, P(q.elbow, 0.18), P(q.hand, 0.14));
    p.elbow.position.set(q.elbow.x, q.elbow.y, 0.18);
    p.hand.position.set(q.hand.x, q.hand.y, 0.14);
    p.head.position.set(q.head.x, q.head.y, 0);
    p.head.rotation.z = q.nd;
    /* 首：肩の上から頭の下まで */
    var ux = q.sh.x - q.hip.x, uy = q.sh.y - q.hip.y, ul = Math.sqrt(ux * ux + uy * uy) || 1;
    this.segment(p.neck, { x: q.sh.x - ux / ul * 0.05, y: q.sh.y - uy / ul * 0.05, z: 0 }, { x: q.head.x, y: q.head.y - 0.05, z: 0 });
    p.q = q;
  };

  /* 状態を写す。s: { t, angle（ラジアン）, lean, near（0〜1 近さ）, angry（0〜1）, mag } */
  Scene3D.prototype.sync = function (s) {
    var dt = Math.max(0, Math.min(0.1, s.t - this.t)); this.t = s.t;
    this.sceneryTex.offset.x = (this.sceneryTex.offset.x + dt * 0.35) % 1;
    var a = s.angle;
    this.myBack.rotation.z = a;

    /* 自分：背もたれにもたれる */
    var pv = pivot(0), c = Math.cos(a), sn = Math.sin(a);
    function onBack(u, v) { return { x: pv.x + u * c - v * sn, y: pv.y + u * sn + v * c }; }
    var hip = onBack(0.14, 0.1), sh = onBack(0.16, 0.56), head = onBack(0.2, 0.8);
    var knee = { x: hip.x + 0.42, y: SEAT_Y + 0.08 }, foot = { x: knee.x + 0.05, y: 0.05 };
    this.pose(this.me, { hip: hip, sh: sh, head: head, nd: a * 0.6, knee: knee, foot: foot,
      elbow: { x: sh.x + 0.05, y: SEAT_Y + 0.24 }, hand: { x: knee.x - 0.1, y: SEAT_Y + 0.14 } });

    if (s.rag && !this.rag) this.ragStart();
    if (!s.rag && this.rag) this.ragReset();
    if (this.rag) {
      this.rag.world.step(1 / 60, dt, 4);
      this.rag.parts.forEach(function (o) {
        o.g.position.set(o.b.position.x, o.b.position.y, o.b.position.z);
        o.g.quaternion.set(o.b.quaternion.x, o.b.quaternion.y, o.b.quaternion.z, o.b.quaternion.w);
      });
      var R = this.rag, na = R.torso.pointToWorldFrame(R.nkA), hp = R.head.position;
      this.segment(this.him.neck, { x: na.x, y: na.y, z: na.z }, { x: hp.x, y: hp.y, z: hp.z });
      this.him.faceMat.emissiveIntensity = 0.8;
    } else {
    /* 後ろの人：ふつうに座ってスマホ。近いと頭がふるえて顔が赤くなる */
    /* 頭は当たりの形と同じ場所・向きに置く（ずらさない） */
    var b = backHead(s.lean), back = 0;
    var bh = { x: b.head.x, y: b.head.y };
    /* 前の座席が近いので、ひざは低めに手前で止め、手も体に寄せる（倒れてきた背もたれに食い込まない） */
    var bknee = { x: b.hip.x + 0.36, y: SEAT_Y + 0.07 }, bfoot = { x: bknee.x + 0.02, y: 0.05 };
    var hand = { x: b.hip.x + 0.22, y: b.hip.y + 0.2 };
    this.pose(this.him, { hip: b.hip, sh: { x: b.sh.x - back * 0.6, y: b.sh.y }, head: bh, nd: b.nd,
      knee: bknee, foot: bfoot, elbow: { x: b.sh.x + 0.04, y: b.sh.y - 0.27 }, hand: hand });
    this.him.faceMat.emissiveIntensity = Math.max(s.angry * 0.8, Math.max(0, s.near - 0.5) * 0.6);
    this.phone.position.set(hand.x + 0.02, hand.y + 0.03, 0.08);
    this.phone.rotation.set(0, 0, 0.5);
    this.phoneScreen.position.set(hand.x + 0.016, hand.y + 0.042, 0.08);
    this.phoneScreen.rotation.set(0, 0, 0.5);
    }

    /* カメラ：真横から遠近なし（見た目と当たりを一致させる）。横1.75mを写し、縦長の画面では上下が広がる */
    var vw = 1.75, vh = vw * s.H / s.W, cx = -0.4, cy = 0.95;
    var cam = this.camera;
    cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2;
    cam.updateProjectionMatrix();
    cam.position.set(cx, cy, 6);
    cam.lookAt(cx, cy, 0);
  };

  /* ============ ぶつかったらラグドール（アツアツ一輪車と同じ作り。cannon.js） ============
     後ろの人を頭・胴・太もも・すね・上腕・前腕に分けて、関節でつないだ物理の体にする。
     ぶつかり分け：床・座席1 / 体2（体どうしはぶつけない） */
  Scene3D.prototype.ragStart = function () {
    var C = global.CANNON, self = this, p = this.him, q = p.q;
    if (!C || !q) return;
    var world = new C.World({ gravity: new C.Vec3(0, -9.8, 0) });
    world.broadphase = new C.NaiveBroadphase();
    world.solver.iterations = 15;
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.25;
    function fixed(shape, x, y, z, rz) {
      var b = new C.Body({ mass: 0, collisionFilterGroup: 1, collisionFilterMask: -1 });
      b.addShape(shape); b.position.set(x, y, z);
      if (rz) b.quaternion.setFromEuler(0, 0, rz);
      world.addBody(b); return b;
    }
    var ground = fixed(new C.Plane(), 0, 0, 0); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    var wall = fixed(new C.Plane(), 0, 0, -0.72); wall.quaternion.setFromEuler(0, 0, 0);
    /* 後ろの人の座面と背もたれ、自分の背もたれ */
    fixed(new C.Box(new C.Vec3(0.25, 0.06, 0.24)), -PITCH + 0.22, SEAT_Y - 0.06, 0);
    var bp = pivot(-PITCH), mp = pivot(0), hv = (BACK.v1 - BACK.v0) / 2, hu = (BACK.u1 - BACK.u0) / 2, cu = (BACK.u0 + BACK.u1) / 2;
    function backBody(pv, a) {
      var cx = pv.x + cu * Math.cos(a) - hv * Math.sin(a), cy = pv.y + cu * Math.sin(a) + hv * Math.cos(a);
      fixed(new C.Box(new C.Vec3(hu, hv, 0.24)), cx, cy, 0, a);
    }
    backBody(bp, this.backBack.rotation.z);
    backBody(mp, this.myBack.rotation.z);
    var moved = [], parts = [];
    function part(meshes, center, quat, shape, mass, vel, damp) {
      var g = new T.Group();
      g.position.copy(center); g.quaternion.copy(quat);
      self.scene.add(g);
      meshes.forEach(function (m) {
        moved.push({ m: m, parent: m.parent, p: m.position.clone(), q: m.quaternion.clone(), s: m.scale.clone() });
        g.attach(m);
      });
      var b = new C.Body({ mass: mass, linearDamping: 0.05, angularDamping: damp || 0.4, collisionFilterGroup: 2, collisionFilterMask: 1 });
      b.addShape(shape);
      b.position.set(center.x, center.y, center.z);
      b.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      b.velocity.set(vel[0], vel[1], vel[2]);
      world.addBody(b);
      parts.push({ g: g, b: b });
      return b;
    }
    function V(a, z) { return new T.Vector3(a.x, a.y, z || 0); }
    function limb(meshes, a, bpt, r, mass, vel, za, zb) {
      var A = V(a, za), B = V(bpt, zb), mid = A.clone().add(B).multiplyScalar(0.5);
      var qt = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      return part(meshes, mid, qt, new C.Box(new C.Vec3(r, Math.max(0.02, A.distanceTo(B) / 2), r)), mass, vel);
    }
    function joint(b1, b2, pt, z) {
      var c = new C.Vec3(pt.x, pt.y, z || 0);
      world.addConstraint(new C.PointToPointConstraint(b1, b1.pointToLocalFrame(c), b2, b2.pointToLocalFrame(c)));
    }
    /* はね飛ばされる勢い：頭は後ろ上へ、体は通路（手前）へ */
    var push = [-1.6, 1.2, 1.6];
    var mid = { x: (q.hip.x + q.sh.x) / 2, y: (q.hip.y + q.sh.y) / 2 };
    var tq = new T.Quaternion().setFromEuler(new T.Euler(0, 0, p.torso.rotation.z));
    var torso = part([p.hips, p.torso], V(mid), tq, new C.Box(new C.Vec3(0.15, 0.27, 0.15)), 30, [push[0] * 0.5, push[1] * 0.6, push[2]]);
    var hq = new T.Quaternion().setFromEuler(new T.Euler(0, 0, q.nd));
    var head = part([p.head], V(q.head), hq, new C.Sphere(HEAD_R), 6, [push[0] * 0.6, push[1] * 0.6, push[2] * 0.6], 0.85);
    /* 首は円すいの範囲(約25°)でしか曲がらない関節にして、頭が暴れすぎないようにする */
    var nk = new C.Vec3(q.head.x * 0.4 + q.sh.x * 0.6, q.head.y * 0.4 + q.sh.y * 0.6, 0);
    var ax = new C.Vec3(q.head.x - q.sh.x, q.head.y - q.sh.y, 0); ax.normalize();
    world.addConstraint(new C.ConeTwistConstraint(torso, head, {
      pivotA: torso.pointToLocalFrame(nk), pivotB: head.pointToLocalFrame(nk),
      axisA: torso.vectorToLocalFrame(ax), axisB: head.vectorToLocalFrame(ax),
      angle: 0.45, twistAngle: 0.2
    }));
    var th = limb([p.thigh, p.knee], q.hip, q.knee, 0.055, 7, [0, 0.4, push[2] * 0.7], 0.12, 0.12);
    var sh = limb([p.shin, p.foot], q.knee, q.foot, 0.045, 4, [0.3, 0.2, push[2] * 0.5], 0.12, 0.12);
    joint(torso, th, q.hip, 0.12); joint(th, sh, q.knee, 0.12);
    var up = limb([p.upper, p.elbow], q.sh, q.elbow, 0.045, 2.5, [push[0] * 0.4, push[1], push[2]], 0.17, 0.18);
    var fo = limb([p.fore, p.hand, this.phone, this.phoneScreen], q.elbow, q.hand, 0.04, 2, [0.5, 2, push[2]], 0.18, 0.14);
    joint(torso, up, q.sh, 0.17); joint(up, fo, q.elbow, 0.18);
    /* 首：胴の肩の点と頭の中心を毎フレーム棒でつなぐ（頭が取れて見えないように） */
    var nkA = torso.pointToLocalFrame(new C.Vec3(q.sh.x, q.sh.y, 0));
    this.rag = { world: world, parts: parts, moved: moved, torso: torso, head: head, nkA: nkA };
  };
  Scene3D.prototype.ragReset = function () {
    var self = this;
    if (!this.rag) return;
    this.rag.moved.forEach(function (o) {
      o.parent.add(o.m);
      o.m.position.copy(o.p); o.m.quaternion.copy(o.q); o.m.scale.copy(o.s);
    });
    this.rag.parts.forEach(function (o) { self.scene.remove(o.g); });
    this.rag = null;
  };

  /* 場面の点（x, y, z=0）を画面の座標へ */
  Scene3D.prototype.project = function (p, W, H) {
    var v = new T.Vector3(p.x, p.y, p.z || 0).project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };

  Scene3D.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.Scene3D = Scene3D;
  global.zRecline = { gapAt: gapAt, backHead: backHead };
})(window);
