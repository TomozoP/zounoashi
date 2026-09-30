/* 100歳まで歩く体の剛体計算。0歳はハイハイ、1歳で立ち、背が伸び、年をとると前かがみになって杖をつく。
   cannon-es の剛体を縦の面（前後と上下）に限って動かす。前へ押す力は加えず、関節の回転の力
   （隣り合う体に同じ大きさで逆向き）で歩く。外からの力は、腰が足の上から大きく外れたときに少し引き戻す手助けだけ。 */
var ZLifeWalk = (function (C) {
  "use strict";

  var STEP = 1 / 480;
  var G_GROUND = 1, G_BODY = 2;

  // ハイハイの赤ちゃん。角度は、下がった手足が前へ振れる向きを正にする。
  var BABY = {
    trunk: { len: 0.34, half: 0.08, mass: 5 }, head: { r: 0.1, mass: 1.6 },
    arm: { len: 0.24, r: 0.032, mass: 0.35 },
    thigh: { len: 0.17, r: 0.045, mass: 0.6 }, shin: { len: 0.16, r: 0.035, mass: 0.3 },
    k: 17, max: 13.5,
    swingArm: 1.04, stanceArm: -0.76, swingThigh: 0.93, stanceThigh: -0.49, fold: 2.3
  };
  // 立って歩く体の筋力と動かし方。身長170cmの大人の値で、体の大きさに合わせて縮める。
  // ADULT は働き盛り、ELDER は杖をつく老人。その間の年齢は混ぜる。
  var ADULT = {
    hip: 400, hipKp: 400, hipKd: 30, knee: 350, kneeKp: 400, kneeKd: 25, ankle: 150, ankleKp: 200, ankleKd: 5, standKp: 650,
    torsoKp: 530, torsoKd: 90, tip: 0, tipKp: 260, placeD: 0.35, placeV: 0.06,
    lean: 0.22, liftHip: 0.7, liftKnee: -1.3, reachHip: 0.15,
    caneLift: 0.26, canePlant: 0.12, caneKp: 58, caneSoft: 14
  };
  var ELDER = {
    hip: 260, hipKp: 280, hipKd: 24, knee: 240, kneeKp: 300, kneeKd: 20, ankle: 110, ankleKp: 92, ankleKd: 4, standKp: 650,
    torsoKp: 595, torsoKd: 70, tip: 0.22, tipKp: 58, placeD: 0.467, placeV: 0.021,
    lean: 0.251, liftHip: 0.676, liftKnee: -1.1, reachHip: 0.36,
    caneLift: 0.681, canePlant: 0.04, caneKp: 89, caneSoft: 4.8
  };
  var TORQUE = ["hip", "hipKp", "knee", "kneeKp", "ankle", "ankleKp", "standKp", "torsoKp", "tipKp", "caneKp", "caneSoft"];
  var DAMP = ["hipKd", "kneeKd", "ankleKd", "torsoKd"];
  var CANE_AGE = 70;
  var FOOT = { len: 0.25 };
  // 転びにくくする手助け。hold・damp は引き戻す強さ（体重に対する割合）、ahead はつま先より前へ許す幅（大人の m）、old は年をとって弱める割合。
  var HELP = { old: 0, hold: 0.45, damp: 3, ahead: 0.15 };
  // 体の大きさ s による縮め方（s の何乗か）。重力も s 倍にすると、小さい体も大人と同じ間合いで倒れ、同じ押し方で歩ける。
  var SIZE = { torque: 5, damp: 5, v: 1, g: 1 };
  var GROW_STEP = 0.005;   // 背がこれだけ変わるたびに体を作り直す（小さいほど途切れなく育つ）
  var KID = { until: [2, 8], lean: 0.6, ankle: 1, stand: 1 };

  // 年齢ごとの背の高さ（大人を1とする）。
  var HEIGHT = [[1, 0.45], [2, 0.51], [4, 0.6], [6, 0.68], [8, 0.75], [10, 0.81], [12, 0.87], [14, 0.94], [16, 0.98], [18, 1], [60, 1], [80, 0.97], [100, 0.94]];
  function table(t, x) {
    if (x <= t[0][0]) return t[0][1];
    for (var i = 1; i < t.length; i++) if (x <= t[i][0]) { var a = t[i - 1], b = t[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return t[t.length - 1][1];
  }
  function heightAt(age) { return table(HEIGHT, age); }
  // 進んだ距離と年齢。距離は背の高さで割った値（大人の1m）。ハイハイで1歳、子どものうちに背が伸び、年をとると一歩が重くなる。
  var LIFE = [[0, 0], [2, 1], [8.5, 18], [27, 70], [35, 100]];
  function ageAt(x) { return table(LIFE, Math.max(0, x)); }
  function distanceAt(age) { return table(LIFE.map(function (p) { return [p[1], p[0]]; }), age); }
  function smooth(a, b, x) { var u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); }

  // 大きさ s の体の寸法。子どもは頭が大きめ。
  function dims(s) {
    var m = s * s * s;
    return {
      trunk: { len: 0.56 * s, half: 0.13 * s, mass: 32 * m }, head: { r: 0.12 * Math.pow(s, 0.3), mass: 5 * Math.pow(s, 1.8) },
      arm: { len: 0.62 * s, r: 0.045 * s, mass: 3.4 * m },
      thigh: { len: 0.45 * s, r: 0.07 * s, mass: 8 * m }, shin: { len: 0.44 * s, r: 0.05 * s, mass: 4 * m },
      foot: FOOT.len * s, footMass: 2 * s * s, cane: { mass: 0.6 * s }
    };
  }
  // 年齢 age、大きさ s の体の筋力と動かし方。
  function params(age, s) {
    var t = smooth(50, 85, age), c = {}, k;
    for (k in ADULT) c[k] = ADULT[k] + (ELDER[k] - ADULT[k]) * t;
    // 85歳を過ぎると力が落ち、腰が曲がる。
    var old = Math.max(0, Math.min(1, (age - 85) / 15));
    ["hip", "knee", "ankle"].forEach(function (k) { c[k] *= 1 - 0.3 * old; });
    c.lean += 0.08 * old;
    // 幼い子は頭が重く足が小さいので、前へ傾けず、足首を強くする。
    var kid = 1 - smooth(KID.until[0], KID.until[1], age);
    c.lean *= 1 - KID.lean * kid;
    c.ankle *= 1 + KID.ankle * kid;
    c.standKp *= 1 + KID.stand * kid;
    c.tipKp *= 1 + KID.ankle * kid;
    var r = Math.pow(s, SIZE.torque), rd = Math.pow(s, SIZE.damp);
    TORQUE.forEach(function (k) { c[k] *= r; });
    DAMP.forEach(function (k) { c[k] *= rd; });
    c.placeD /= s;
    c.placeV /= Math.pow(s, SIZE.v);
    return c;
  }

  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function angleOf(b) { return wrap(2 * Math.atan2(b.quaternion.z, b.quaternion.w)); }
  function clamp(v, a) { return Math.max(-a, Math.min(a, v)); }

  // form は "baby"（ハイハイ）か "biped"（立って歩く）。opts: { age, cane, from }。
  // from に前の体を渡すと、その姿勢と速さを引き継いで大きさだけ変えた体を作る。
  function Walker(form, x, opts) {
    opts = opts || {};
    this.form = form;
    this.age = opts.age || 0;
    this.cane = !!opts.cane;
    if (form === "baby") this.cfg = BABY;
    else { this.scale = heightAt(this.age); this.dims = dims(this.scale); this.cfg = params(this.age, this.scale); }
    this.world = new C.World({ gravity: new C.Vec3(0, -9.81 * (form === "baby" ? 1 : Math.pow(this.scale, SIZE.g)), 0) });
    this.world.solver.iterations = 30;
    this.world.solver.tolerance = 1e-6;
    this.groundMat = new C.Material("地面");
    this.bodyMat = new C.Material("体");
    this.world.addContactMaterial(new C.ContactMaterial(this.groundMat, this.bodyMat, { friction: 0.9, restitution: 0.02 }));
    var ground = new C.Body({ mass: 0, material: this.groundMat, collisionFilterGroup: G_GROUND, collisionFilterMask: G_BODY });
    ground.addShape(new C.Box(new C.Vec3(2000, 0.5, 3)));
    ground.position.set(0, -0.5, 0);
    this.world.addBody(ground);
    this.ground = ground;
    this.parts = {};
    this.list = [];
    this.joints = {};
    this.time = 0;
    this.side = 0;        // 振り出している側。-1 左、1 右、0 まだ（両方で立つ）
    this.pressed = false;
    this.limp = false;
    this.impacts = [];
    this.touch = {};
    if (form === "baby") this.buildBaby(x || 0); else this.buildBiped(x || 0, opts.from);
    this.mass = this.list.reduce(function (m, b) { return m + b.mass; }, 0);
    var self = this;
    this.world.addEventListener("beginContact", function (e) {
      var b = e.bodyA === ground ? e.bodyB : e.bodyB === ground ? e.bodyA : null;
      if (!b || !b.part) return;
      var v = Math.abs(b.velocity.y) + Math.abs(b.velocity.x) * 0.3;
      if (v > 0.2) self.impacts.push({ part: b.part, strength: Math.min(1, v / 2.5) });
    });
  }

  Walker.prototype.body = function (name, mass, x, y, angle) {
    var b = new C.Body({ mass: mass, material: this.bodyMat, collisionFilterGroup: G_BODY, collisionFilterMask: G_GROUND, linearDamping: 0.01, angularDamping: 0.03 });
    b.position.set(x, y, 0);
    b.quaternion.setFromEuler(0, 0, angle);
    b.linearFactor.set(1, 1, 0);
    b.angularFactor.set(0, 0, 1);
    b.part = name;
    this.parts[name] = b;
    this.list.push(b);
    return b;
  };
  // 上端 top から下端 bottom へ伸びる部位。丸い先で地面に触れる。
  Walker.prototype.segment = function (name, top, bottom, r, mass) {
    var dx = bottom[0] - top[0], dy = bottom[1] - top[1], len = Math.hypot(dx, dy);
    var b = this.body(name, mass, (top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, Math.atan2(dx, -dy));
    b.addShape(new C.Box(new C.Vec3(r * 0.8, Math.max(0.01, len / 2 - r), r * 0.8)));
    b.addShape(new C.Sphere(r), new C.Vec3(0, -len / 2, 0));
    b.len = len;
    b.r = r;
    this.world.addBody(b);
    return b;
  };
  Walker.prototype.trunkBody = function (hip, neck, t, head) {
    var dx = neck[0] - hip[0], dy = neck[1] - hip[1], len = Math.hypot(dx, dy);
    var b = this.body("trunk", t.mass + head.mass, (hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2, Math.atan2(-dx, dy));
    b.addShape(new C.Box(new C.Vec3(t.half * 0.75, len / 2, t.half)));
    b.addShape(new C.Sphere(head.r), new C.Vec3(0, len / 2 + head.r * 0.9, 0));
    b.len = len;
    b.half = t.half;
    b.headOffset = len / 2 + head.r * 0.9;
    b.headR = head.r;
    this.world.addBody(b);
    return b;
  };
  // 二つの部位を同じ一点でつなぐ蝶番。回す力は蝶番の中で両方へ返る。
  Walker.prototype.hinge = function (a, b, at) {
    var p = new C.Vec3(at[0], at[1], 0);
    var j = new C.HingeConstraint(a, b, {
      pivotA: a.pointToLocalFrame(p), pivotB: b.pointToLocalFrame(p),
      axisA: new C.Vec3(0, 0, 1), axisB: new C.Vec3(0, 0, 1), maxForce: 1e6
    });
    j.collideConnected = false;
    j.enableMotor();
    j.motorEquation.maxForce = 0;
    j.motorEquation.minForce = 0;
    this.world.addConstraint(j);
    this.joints[b.part] = j;
    return j;
  };

  // 年をとらせる。筋力と動かし方だけを変え、体の大きさは作り直すまで変えない。
  Walker.prototype.setAge = function (age) {
    if (this.form === "baby") { this.age = age; return; }
    this.age = age;
    this.cfg = params(age, this.scale);
  };
  // 作り直しが要るか（背が変わった、杖を持つ年になった）。
  Walker.prototype.outgrown = function (age) {
    if (this.form === "baby") return age >= 1;
    return Math.abs(heightAt(age) / this.scale - 1) > GROW_STEP || (age >= CANE_AGE) !== this.cane;
  };
  Walker.prototype.grow = function (age) {
    return new Walker("biped", 0, { age: age, cane: age >= CANE_AGE, from: this });
  };

  // 足の裏の四隅と杖の先のうち、いちばん低い高さ。
  function lowest(w) {
    var y = Infinity;
    ["footL", "footR"].forEach(function (n) {
      var f = w.parts[n];
      if (!f) return;
      [[-1, -1], [1, -1]].forEach(function (k) {
        var p = f.pointToWorldFrame(new C.Vec3(k[0] * f.len / 2, k[1] * f.h, 0));
        y = Math.min(y, p.y);
      });
    });
    return y;
  }

  // 立って歩く体。from があれば各部位の角度を引き継ぐ（なければ気をつけの姿勢）。
  Walker.prototype.buildBiped = function (x, from) {
    var c = this.cfg, d = this.dims, s = this.scale, self = this;
    var A = {};
    function ang(name, def) { return from && from.parts[name] && from.form === "biped" ? angleOf(from.parts[name]) : def; }
    A.trunk = ang("trunk", -c.lean);
    ["L", "R"].forEach(function (k) { A["thigh" + k] = ang("thigh" + k, 0); A["shin" + k] = ang("shin" + k, 0); A["foot" + k] = ang("foot" + k, 0); A["arm" + k] = ang("arm" + k, 0); });
    if (this.cane) { A.armR = from && from.cane ? A.armR : 0.55; A.cane = from && from.cane ? ang("cane", c.canePlant) : c.canePlant; }
    function down(p, a, len) { return [p[0] + Math.sin(a) * len, p[1] - Math.cos(a) * len]; }
    var ankleY = 0.08 * s;
    var hip = [from ? from.hip()[0] : x, 0];
    var neck = [hip[0] - Math.sin(A.trunk) * d.trunk.len, hip[1] + Math.cos(A.trunk) * d.trunk.len];
    var pts = { hip: hip, neck: neck };
    ["L", "R"].forEach(function (k) {
      pts["knee" + k] = down(hip, A["thigh" + k], d.thigh.len);
      pts["ankle" + k] = down(pts["knee" + k], A["shin" + k], d.shin.len);
      pts["hand" + k] = down(neck, A["arm" + k], d.arm.len);
    });
    // 足の裏のいちばん低い所を、前の体と同じ高さ（地面より下にはしない）に合わせる。
    var fh = 0.03 * s, lowNew = Infinity;
    ["L", "R"].forEach(function (k) {
      var a = A["foot" + k], cx = pts["ankle" + k][0], cy = pts["ankle" + k][1];
      var ox = d.foot / 2 - 0.06 * s, oy = 0.03 * s - ankleY;
      var fx = cx + ox * Math.cos(a) - oy * Math.sin(a), fy = cy + ox * Math.sin(a) + oy * Math.cos(a);
      pts["footC" + k] = [fx, fy];
      [-1, 1].forEach(function (e) { lowNew = Math.min(lowNew, fy + e * d.foot / 2 * Math.sin(a) - fh * Math.cos(a)); });
    });
    var target = from && from.form === "biped" ? Math.max(0, lowest(from)) : 0;
    var lift = target - lowNew;
    Object.keys(pts).forEach(function (k) { pts[k] = [pts[k][0], pts[k][1] + lift]; });
    hip = pts.hip; neck = pts.neck;

    var trunk = this.trunkBody(hip, neck, d.trunk, d.head);
    ["L", "R"].forEach(function (k) {
      var thigh = self.segment("thigh" + k, hip, pts["knee" + k], d.thigh.r, d.thigh.mass);
      var shin = self.segment("shin" + k, pts["knee" + k], pts["ankle" + k], d.shin.r, d.shin.mass);
      // かかとから前へ伸びる足。足首で脛とつなぐ。
      var foot = self.body("foot" + k, d.footMass, pts["footC" + k][0], pts["footC" + k][1], A["foot" + k]);
      foot.addShape(new C.Box(new C.Vec3(d.foot / 2, fh, 0.05 * s)));
      foot.len = d.foot;
      foot.h = fh;
      self.world.addBody(foot);
      self.hinge(trunk, thigh, hip);
      self.hinge(thigh, shin, pts["knee" + k]);
      self.hinge(shin, foot, pts["ankle" + k]);
      var arm = self.segment("arm" + k, neck, pts["hand" + k], d.arm.r, d.arm.mass);
      self.hinge(trunk, arm, neck);
    });
    if (this.cane) {
      // 右手の杖。手首でつなぎ、先が地面をつく長さにする。
      var hand = pts.handR, len = (hand[1] - 0.02) / Math.cos(A.cane);
      if (from && from.cane) len = from.parts.cane.len * s / from.scale;
      var cane = this.segment("cane", hand, down(hand, A.cane, len), 0.02 * s, d.cane.mass);
      this.hinge(this.parts.armR, cane, hand);
    }
    if (from && from.form === "baby") {
      // ハイハイから立ち上がるときは、止まって両足で立つところから。
      this.time = from.time;
    } else if (from) {
      // 速さと回転を引き継ぐ。
      var ft = from.parts.trunk;
      this.list.forEach(function (b) {
        var o = from.parts[b.part] || ft;
        b.velocity.set(o.velocity.x, o.velocity.y, 0);
        b.angularVelocity.set(0, 0, o.angularVelocity.z);
      });
      this.time = from.time;
      this.lastTouch = {};
      for (var k in from.lastTouch || {}) this.lastTouch[k] = from.lastTouch[k];
      this.near = from.near;
      this.touch = from.touch || {};
      this.side = from.side;
      this.pressed = from.pressed;
      this.pressTime = from.pressTime;
      this.limp = from.limp;
    }
  };
  // 股関節の位置。
  Walker.prototype.hip = function () {
    var t = this.parts.trunk, p = t.pointToWorldFrame(new C.Vec3(0, -t.len / 2, 0));
    return [p.x, p.y];
  };

  Walker.prototype.buildBaby = function (x) {
    var c = this.cfg, kneeY = c.shin.r + 0.004, hipY = kneeY + c.thigh.len, shoulderY = c.arm.len + c.arm.r + 0.004;
    var hip = [x, hipY], shoulder = [x + Math.sqrt(c.trunk.len * c.trunk.len - (shoulderY - hipY) * (shoulderY - hipY)), shoulderY];
    var trunk = this.trunkBody(hip, shoulder, c.trunk, c.head);
    var self = this;
    ["L", "R"].forEach(function (s) {
      var knee = [x, kneeY];
      var thigh = self.segment("thigh" + s, hip, knee, c.thigh.r, c.thigh.mass);
      var shin = self.segment("shin" + s, knee, [x - c.shin.len, kneeY], c.shin.r, c.shin.mass);
      self.hinge(trunk, thigh, hip);
      self.hinge(thigh, shin, knee);
      var arm = self.segment("arm" + s, shoulder, [shoulder[0], shoulder[1] - c.arm.len], c.arm.r, c.arm.mass);
      self.hinge(trunk, arm, shoulder);
    });
  };

  // 蝶番の回す速さの目標と力の上限を決める。蝶番は (親の回転 - 子の回転) を目標へ寄せる。
  function motor(j, wa, wb, max) {
    j.motorEquation.targetVelocity = wa - wb;
    j.motorEquation.maxForce = max;
    j.motorEquation.minForce = -max;
  }
  // 子の、親に対する角度を狙う。
  Walker.prototype.rel = function (child, target, k, max, vmax) {
    var j = this.joints[child], a = j.bodyA, b = j.bodyB;
    var err = wrap(target - (angleOf(b) - angleOf(a)));
    motor(j, a.angularVelocity.z, a.angularVelocity.z + clamp(k * err, vmax || 14), max);
  };
  // 子の、世界に対する角度を狙う。
  Walker.prototype.world_ = function (child, target, k, max) {
    var j = this.joints[child], a = j.bodyA, b = j.bodyB;
    motor(j, a.angularVelocity.z, clamp(k * wrap(target - angleOf(b)), 14), max);
  };
  // 親の、世界に対する角度を狙う（立っている脚で胴を支える、足で脛を支える）。
  Walker.prototype.parent_ = function (child, target, k, max) {
    var j = this.joints[child], a = j.bodyA, b = j.bodyB;
    motor(j, clamp(k * wrap(target - angleOf(a)), 14), b.angularVelocity.z, max);
  };

  // 足首。足の裏は平らへ、脛は lean の傾きへ寄せる（null なら脛は今の回転を止めるだけ）。
  Walker.prototype.ankle = function (s, lean, k, max) {
    var j = this.joints["foot" + s], shin = j.bodyA, foot = j.bodyB;
    var ws = lean == null ? 0 : clamp(k * wrap(lean - angleOf(shin)), 14);
    motor(j, ws, clamp(k * wrap(-angleOf(foot)), 14), max);
  };

  Walker.prototype.control = function () {
    var self = this, p = this.parts, c = this.cfg;
    if (this.limp) {
      Object.keys(this.joints).forEach(function (k) { var j = self.joints[k]; motor(j, 0, 0, self.form === "baby" ? 0.3 : 8); });
      return;
    }
    if (this.form === "baby") {
      // 対角の手足を組にする。押している組を前へ振り、もう一方で床を後ろへかく。
      var groups = [["armL", "thighR"], ["armR", "thighL"]];
      var front = this.side === -1 ? 0 : this.side === 1 ? 1 : -1;
      groups.forEach(function (g, i) {
        var arm = 0, leg = 0;
        if (front >= 0) {
          if (i === front) { arm = self.pressed ? c.swingArm : c.swingArm * 0.6; leg = self.pressed ? c.swingThigh : c.swingThigh * 0.6; }
          else { arm = c.stanceArm; leg = c.stanceThigh; }
        }
        // 胴に対する角度で動かす（胴が水平のとき、真下が 0）。
        self.rel(g[0], arm + Math.PI / 2, c.k, c.max);
        self.rel(g[1], leg + Math.PI / 2, c.k, c.max);
      });
      // 振り出す脚は膝をたたんで、すねを床から浮かせる。
      ["L", "R"].forEach(function (s) {
        var lifting = self.pressed && front >= 0 && groups[front][1] === "thigh" + s;
        self.rel("shin" + s, lifting ? -c.fold : -Math.PI / 2, c.k, c.max);
      });
      return;
    }
    this.upright();
    // 見えない手助け：腰が着いている足の上（つま先より少し前まで）から外れたら、外から少しだけ引き戻す。
    var near = this.near || {}, lo = Infinity, hi = -Infinity, parts = this.parts;
    ["footL", "footR"].forEach(function (n) {
      if (!near[n]) return;
      var f = parts[n];
      lo = Math.min(lo, f.position.x - f.len / 2); hi = Math.max(hi, f.position.x + f.len / 2);
    });
    if (HELP.hold > 0 && lo < hi) {
      hi += HELP.ahead * this.scale;
      var tr = p.trunk, hx = tr.position.x, out = hx < lo ? hx - lo : hx > hi ? hx - hi : 0;
      var weak = 1 - HELP.old * smooth(60, 100, this.age), mg = this.mass * 9.81 * Math.pow(this.scale, SIZE.g);
      if (out) {
        tr.force.x -= HELP.hold * mg * weak * clamp(out / (0.1 * this.scale), 1);
        tr.force.x -= HELP.damp * this.mass * weak * (out > 0 ? Math.max(0, tr.velocity.x) : Math.min(0, tr.velocity.x));
      }
    }
  };

  // 関節の回転の力を、子へ +t、親へ -t で加える。
  function torque(parent, child, t, max) {
    t = clamp(t, max);
    child.torque.z += t;
    parent.torque.z -= t;
    return t;
  }
  // 子の、親に対する角度へ寄せるばねと減衰。
  Walker.prototype.pd = function (child, target, kp, kd, max) {
    var j = this.joints[child], a = j.bodyA, b = j.bodyB;
    var err = wrap(target - (angleOf(b) - angleOf(a)));
    return torque(a, b, kp * err - kd * (b.angularVelocity.z - a.angularVelocity.z), max);
  };
  // 子の、世界に対する角度へ寄せる。反動は親が受ける。
  Walker.prototype.pdWorld = function (child, target, kp, kd, max) {
    var j = this.joints[child], a = j.bodyA, b = j.bodyB;
    return torque(a, b, kp * wrap(target - angleOf(b)) - kd * b.angularVelocity.z, max);
  };

  // 立って歩く体。押している間は振り出す脚を上げ、離すと前へ伸ばして着く。
  // 胴を立てる力は、立っている脚の股関節で受け渡す（体の外から支える力はない）。
  Walker.prototype.upright = function () {
    var self = this, p = this.parts, c = this.cfg, near = this.near || {}, trunk = p.trunk;
    var sw = this.side === -1 ? "L" : this.side === 1 ? "R" : null;
    var lift = this.pressed;
    var both = !sw || (!lift && near["foot" + sw]);
    var stances = both ? ["L", "R"] : [sw === "L" ? "R" : "L"];
    var grounded = stances.filter(function (s) { return near["foot" + s]; });
    var torso = c.torsoKp * wrap(-c.lean - angleOf(trunk)) - c.torsoKd * trunk.angularVelocity.z;
    var swingT = 0;
    if (!both) {
      // 体が前へ流れているほど、振り出す脚を遠くへ出す（転びそうな側へ足を出す反射）。
      var st = p["foot" + stances[0]], d = trunk.position.x - st.position.x, v = trunk.velocity.x;
      var reach = clamp(c.placeD * d + c.placeV * v, 0.5);
      swingT = this.pdWorld("thigh" + sw, (lift ? c.liftHip : c.reachHip) + reach, c.hipKp, c.hipKd, c.hip);
      this.pd("shin" + sw, lift ? c.liftKnee : -0.05, c.kneeKp * 0.5, c.kneeKd * 0.5, c.knee);
      this.pd("foot" + sw, 0.1, c.ankleKp * 0.5, c.ankleKd * 0.5, c.ankle);
    }
    stances.forEach(function (s) {
      var th = p["thigh" + s];
      if (grounded.indexOf(s) >= 0) torque(trunk, th, (-torso - swingT) / grounded.length, c.hip);
      else self.pd("thigh" + s, c.lean * 0.5, c.hipKp * 0.3, c.hipKd * 0.3, c.hip);
      self.pd("shin" + s, -0.05, c.kneeKp, c.kneeKd, c.knee);
      if (both && sw) self.pdWorld("foot" + s, 0, c.ankleKp * 0.15, c.ankleKd * 0.5, c.ankle);
      else if (both) self.pd("foot" + s, 0, sw ? c.ankleKp : c.standKp, c.ankleKd, c.ankle);
      else self.pd("foot" + s, c.tip, c.tipKp, c.ankleKd, c.ankle);
    });
    ["L", "R"].forEach(function (s) {
      if (self.cane && s === "R") return;
      var swing = !sw ? 0 : s === sw ? -0.3 : 0.3;
      self.pdWorld("arm" + s, swing - c.lean * 0.3, 20, 2, 30);
    });
    if (this.cane) {
      // 杖は左脚と一緒に前へ出す。つくと力を抜き、体が前へ出るのに合わせて傾く。
      var lifting = sw === "L" && lift;
      this.pdWorld("armR", 0.55, 200, 12, 160);
      this.pdWorld("cane", lifting ? c.canePlant + c.caneLift : c.canePlant, lifting ? c.caneKp : c.caneSoft, 2, 80);
    }
  };

  Walker.prototype.press = function (side) {
    if (side == null) side = this.side === -1 ? 1 : -1;
    this.side = side;
    this.pressed = true;
    this.pressTime = this.time;
  };
  Walker.prototype.release = function () { this.pressed = false; };

  Walker.prototype.step = function (dt) {
    var n = Math.max(1, Math.round(dt / STEP));
    for (var i = 0; i < n; i++) {
      this.control();
      this.world.step(STEP);
      this.time += STEP;
      this.contacts();
    }
  };
  Walker.prototype.contacts = function () {
    var touch = {}, g = this.ground, last = this.lastTouch || (this.lastTouch = {}), now = this.time;
    this.world.contacts.forEach(function (eq) {
      var b = eq.bi === g ? eq.bj : eq.bj === g ? eq.bi : null;
      if (b && b.part) { touch[b.part] = true; last[b.part] = now; }
    });
    // 一瞬離れただけなら、ついているままとみなす。
    this.near = {};
    for (var k in last) if (now - last[k] < 0.08) this.near[k] = true;
    var t = this.parts.trunk, head = t.pointToWorldFrame(new C.Vec3(0, t.headOffset, 0));
    this.head = head;
    if (head.y < t.headR + 0.02) touch.head = true;
    this.touch = touch;
  };
  // 転んだか。頭がつく、ハイハイで裏返る、立ち歩きで胴・腿・腕が地面につく。
  Walker.prototype.fallen = function () {
    var t = this.touch, a = angleOf(this.parts.trunk);
    if (t.head) return true;
    if (this.form === "baby") return Math.abs(wrap(a + Math.PI / 2)) > 1.3;
    return !!(t.trunk || t.thighL || t.thighR || t.armL || (!this.cane && t.armR));
  };
  Walker.prototype.x = function () { return this.parts.trunk.position.x; };
  Walker.prototype.takeImpacts = function () { var r = this.impacts; this.impacts = []; return r; };
  Walker.prototype.angle = function (name) { return angleOf(this.parts[name]); };

  return { Walker: Walker, BABY: BABY, ADULT: ADULT, ELDER: ELDER, heightAt: heightAt, ageAt: ageAt, distanceAt: distanceAt, LIFE: LIFE, params: params, CANE_AGE: CANE_AGE, FOOT: FOOT, HELP: HELP, SIZE: SIZE, KID: KID, angleOf: angleOf, STEP: STEP };
})(CANNON);
if (typeof module !== "undefined") module.exports = ZLifeWalk;
