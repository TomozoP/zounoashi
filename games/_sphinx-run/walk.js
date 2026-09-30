/* スフィンクスラン。朝は4本、昼は2本、夕は3本の足で歩く体の剛体計算。
   cannon-es の剛体を縦の面（前後と上下）に限って動かす。前へ押す力や姿勢を起こす外力は加えず、
   関節の回転の力（隣り合う体に同じ大きさで逆向き）だけで歩く。 */
var ZSphinxWalk = (function (C) {
  "use strict";

  var STEP = 1 / 480;
  var G_GROUND = 1, G_BODY = 2;

  // 形ごとの寸法と筋力。角度は、下がった手足が前へ振れる向きを正にする。
  // k は角度のずれ1ラジアンあたりの回す速さ、max は関節が出せる回転の力の上限。
  var FORMS = {
    baby: {
      trunk: { len: 0.34, half: 0.08, mass: 5 }, head: { r: 0.1, mass: 1.6 },
      arm: { len: 0.24, r: 0.032, mass: 0.35 },
      thigh: { len: 0.17, r: 0.045, mass: 0.6 }, shin: { len: 0.16, r: 0.035, mass: 0.3 },
      k: 17, max: 13.5,
      swingArm: 1.04, stanceArm: -0.76, swingThigh: 0.93, stanceThigh: -0.49, fold: 2.3
    },
    adult: {
      trunk: { len: 0.56, half: 0.13, mass: 32 }, head: { r: 0.12, mass: 5 },
      arm: { len: 0.62, r: 0.045, mass: 3.4 },
      thigh: { len: 0.45, r: 0.07, mass: 8 }, shin: { len: 0.44, r: 0.05, mass: 4 },
      foot: 0.25,
      hip: 400, hipKp: 400, hipKd: 30, knee: 350, kneeKp: 400, kneeKd: 25, ankle: 150, ankleKp: 200, ankleKd: 5, standKp: 650,
      torsoKp: 530, torsoKd: 90, tip: 0, tipKp: 260, pushTime: 0, pushKp: 400, pushMax: 40, placeD: 0.35, placeV: 0.06,
      lean: 0.22, liftHip: 0.7, liftKnee: -1.3, reachHip: 0.15
    },
    elder: {
      trunk: { len: 0.5, half: 0.13, mass: 30 }, head: { r: 0.12, mass: 5 },
      arm: { len: 0.56, r: 0.045, mass: 3.2 }, cane: { len: 0.9, mass: 0.6 },
      thigh: { len: 0.43, r: 0.07, mass: 8 }, shin: { len: 0.42, r: 0.05, mass: 4 },
      foot: 0.23,
      hip: 260, hipKp: 280, hipKd: 24, knee: 240, kneeKp: 300, kneeKd: 20, ankle: 110, ankleKp: 300, ankleKd: 4, standKp: 650,
      torsoKp: 575, torsoKd: 70, tip: 0.03, tipKp: 300, pushTime: 0, pushKp: 250, pushMax: 40, placeD: 0.41, placeV: 0.17,
      lean: 0.306, liftHip: 0.57, liftKnee: -1.1, reachHip: 0.31,
      caneLift: 0.26, canePlant: 0.12, caneKp: 58, caneSoft: 14
    }
  };

  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function angleOf(b) { return wrap(2 * Math.atan2(b.quaternion.z, b.quaternion.w)); }
  function clamp(v, a) { return Math.max(-a, Math.min(a, v)); }

  function Walker(form, x) {
    this.form = form;
    this.cfg = FORMS[form];
    this.world = new C.World({ gravity: new C.Vec3(0, -9.81, 0) });
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
    if (form === "baby") this.buildBaby(x || 0); else this.buildAdult(x || 0);
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

  Walker.prototype.buildAdult = function (x) {
    var c = this.cfg, ankleY = 0.08, legLen = c.thigh.len + c.shin.len, hipY = legLen + ankleY;
    var hip = [x, hipY], neck = [x + Math.sin(c.lean) * c.trunk.len, hipY + Math.cos(c.lean) * c.trunk.len];
    var trunk = this.trunkBody(hip, neck, c.trunk, c.head);
    var self = this;
    ["L", "R"].forEach(function (s) {
      var kneeP = [x, hipY - c.thigh.len], ankle = [x, ankleY];
      var thigh = self.segment("thigh" + s, hip, kneeP, c.thigh.r, c.thigh.mass);
      var shin = self.segment("shin" + s, kneeP, ankle, c.shin.r, c.shin.mass);
      // かかとから前へ伸びる足。足首で脛とつなぐ。
      var foot = self.body("foot" + s, 2, x + c.foot / 2 - 0.06, 0.03, 0);
      foot.addShape(new C.Box(new C.Vec3(c.foot / 2, 0.03, 0.05)));
      foot.len = c.foot;
      self.world.addBody(foot);
      self.hinge(trunk, thigh, hip);
      self.hinge(thigh, shin, kneeP);
      self.hinge(shin, foot, ankle);
      var arm = self.segment("arm" + s, neck, [neck[0], neck[1] - c.arm.len], c.arm.r, c.arm.mass);
      self.hinge(trunk, arm, neck);
    });
    if (this.form === "elder") {
      // 右手の杖。手首でつなぎ、先が地面をつく。
      var armR = this.parts.armR, hand = [neck[0] + Math.sin(0.55) * c.arm.len, neck[1] - Math.cos(0.55) * c.arm.len];
      armR.position.set((neck[0] + hand[0]) / 2, (neck[1] + hand[1]) / 2, 0);
      armR.quaternion.setFromEuler(0, 0, 0.55);
      this.world.removeConstraint(this.joints.armR);
      this.hinge(trunk, armR, neck);
      var tipX = hand[0] + Math.tan(c.canePlant) * (hand[1] - 0.02);
      var cane = this.segment("cane", hand, [tipX, 0.02], 0.02, c.cane.mass);
      this.hinge(armR, cane, hand);
    }
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

  // 立って歩く体（昼・夕）。押している間は振り出す脚を上げ、離すと前へ伸ばして着く。
  // 胴を立てる力は、立っている脚の股関節で受け渡す（体の外から支える力はない）。
  Walker.prototype.upright = function () {
    var self = this, p = this.parts, c = this.cfg, near = this.near || {}, trunk = p.trunk;
    var sw = this.side === -1 ? "L" : this.side === 1 ? "R" : null;
    var both = !sw || (!this.pressed && near["foot" + sw]);
    var stances = both ? ["L", "R"] : [sw === "L" ? "R" : "L"];
    var grounded = stances.filter(function (s) { return near["foot" + s]; });
    var torso = c.torsoKp * wrap(-c.lean - angleOf(trunk)) - c.torsoKd * trunk.angularVelocity.z;
    var swingT = 0;
    var push = this.pressed && this.time - this.pressTime < c.pushTime && near["foot" + sw];
    if (push) {
      // 押した直後は、後ろ足のつま先で地面を蹴る。
      this.pd("foot" + sw, -0.7, c.pushKp, c.ankleKd, c.pushMax);
      this.pd("shin" + sw, -0.05, c.kneeKp, c.kneeKd, c.knee);
      this.pd("thigh" + sw, 0, c.hipKp * 0.2, c.hipKd * 0.2, c.hip);
      stances = [sw === "L" ? "R" : "L"];
      grounded = stances.filter(function (s) { return near["foot" + s]; });
    } else if (!both) {
      // 体が前へ流れているほど、振り出す脚を遠くへ出す（転びそうな側へ足を出す反射）。
      var st = p["foot" + stances[0]], d = trunk.position.x - st.position.x, v = trunk.velocity.x;
      var reach = clamp(c.placeD * d + c.placeV * v, 0.5);
      swingT = this.pdWorld("thigh" + sw, (this.pressed ? c.liftHip : c.reachHip) + reach, c.hipKp, c.hipKd, c.hip);
      this.pd("shin" + sw, this.pressed ? c.liftKnee : -0.05, c.kneeKp * 0.5, c.kneeKd * 0.5, c.knee);
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
      if (self.form === "elder" && s === "R") return;
      var swing = !sw ? 0 : s === sw ? -0.3 : 0.3;
      self.pdWorld("arm" + s, swing - c.lean * 0.3, 20, 2, 30);
    });
    if (this.form === "elder") {
      // 杖は左脚と一緒に前へ出す。つくと力を抜き、体が前へ出るのに合わせて傾く。
      var lifting = sw === "L" && this.pressed;
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
    return !!(t.trunk || t.thighL || t.thighR || t.armL || (this.form !== "elder" && t.armR));
  };
  Walker.prototype.x = function () { return this.parts.trunk.position.x; };
  Walker.prototype.takeImpacts = function () { var r = this.impacts; this.impacts = []; return r; };
  Walker.prototype.angle = function (name) { return angleOf(this.parts[name]); };

  return { Walker: Walker, FORMS: FORMS, angleOf: angleOf, STEP: STEP };
})(CANNON);
if (typeof module !== "undefined") module.exports = ZSphinxWalk;
