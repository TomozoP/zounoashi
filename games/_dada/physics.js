/* ガチ駄々の剛体計算（cannon-es）。おもちゃ屋の床・壁・棚・おもちゃと、関節でつないだ子供。
   単位はメートル。床は y=0、店は x -5〜5、z -7〜7。カメラは +z 側から見下ろす。
   見た目は scene3d.js。ここは形と動きだけ。 */
var ZDadaPhysics = (function (C) {
  "use strict";

  var STORE = { w: 10, d: 14, wall: 2.2 };
  /* 棚（ゴンドラ）: 中心 x,z、長さ（x方向）、段の高さ */
  var SHELVES = [
    { x: -2.6, z: -3.2, len: 3.2 }, { x: 2.6, z: -3.2, len: 3.2 },
    { x: -2.6, z: 1.4, len: 3.2 }, { x: 2.6, z: 1.4, len: 3.2 },
    { x: 0, z: -6.4, len: 8.5 }
  ];
  var LEVELS = [0.1, 0.6, 1.1], SHELF_D = 0.6, SHELF_H = 1.45;

  /* 子供の部品（立った姿勢での中心と大きさ。大きさは半分の長さ） */
  var PARTS = [
    { id: "pelvis", p: [0, 0.52, 0], h: [0.13, 0.08, 0.09], m: 4 },
    { id: "torso", p: [0, 0.76, 0], h: [0.15, 0.16, 0.10], m: 6 },
    { id: "head", p: [0, 1.1, 0], h: [0.15, 0.15, 0.15], m: 3 },
    { id: "armUL", p: [-0.22, 0.79, 0], h: [0.045, 0.11, 0.045], m: 1.6 },
    { id: "armLL", p: [-0.22, 0.56, 0], h: [0.04, 0.11, 0.04], m: 1.3 },
    { id: "armUR", p: [0.22, 0.79, 0], h: [0.045, 0.11, 0.045], m: 1.6 },
    { id: "armLR", p: [0.22, 0.56, 0], h: [0.04, 0.11, 0.04], m: 1.3 },
    { id: "legUL", p: [-0.07, 0.33, 0], h: [0.055, 0.11, 0.055], m: 2 },
    { id: "legLL", p: [-0.07, 0.11, 0], h: [0.05, 0.11, 0.05], m: 1.6 },
    { id: "legUR", p: [0.07, 0.33, 0], h: [0.055, 0.11, 0.055], m: 2 },
    { id: "legLR", p: [0.07, 0.11, 0], h: [0.05, 0.11, 0.05], m: 1.6 }
  ];
  var JOINTS = [
    ["pelvis", "torso", [0, 0.6, 0], 0.5], ["torso", "head", [0, 0.94, 0], 0.6],
    ["torso", "armUL", [-0.2, 0.9, 0], 2.2], ["armUL", "armLL", [-0.22, 0.675, 0], 1.6],
    ["torso", "armUR", [0.2, 0.9, 0], 2.2], ["armUR", "armLR", [0.22, 0.675, 0], 1.6],
    ["pelvis", "legUL", [-0.07, 0.44, 0], 1.4], ["legUL", "legLL", [-0.07, 0.22, 0], 1.3],
    ["pelvis", "legUR", [0.07, 0.44, 0], 1.4], ["legUR", "legLR", [0.07, 0.22, 0], 1.3]
  ];
  var LIMBS = ["armLL", "armLR", "legLL", "legLR", "armUL", "armUR"];

  function rng(seed) { var a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function Game() {
    var w = this.world = new C.World({ gravity: new C.Vec3(0, -9.81, 0), allowSleep: true });
    w.solver.iterations = 16;
    w.broadphase = new C.SAPBroadphase(w);
    this.fixedMat = new C.Material("店");
    this.toyMat = new C.Material("おもちゃ");
    this.kidMat = new C.Material("子供");
    w.addContactMaterial(new C.ContactMaterial(this.fixedMat, this.toyMat, { friction: 0.4, restitution: 0.15 }));
    w.addContactMaterial(new C.ContactMaterial(this.toyMat, this.toyMat, { friction: 0.4, restitution: 0.12 }));
    w.addContactMaterial(new C.ContactMaterial(this.fixedMat, this.kidMat, { friction: 0.5, restitution: 0.1 }));
    w.addContactMaterial(new C.ContactMaterial(this.toyMat, this.kidMat, { friction: 0.3, restitution: 0.25 }));
    this.statics = [];
    var self = this;
    function fixed(x, y, z, hx, hy, hz, kind) {
      var b = new C.Body({ mass: 0, material: self.fixedMat, shape: new C.Box(new C.Vec3(hx, hy, hz)), position: new C.Vec3(x, y, z) });
      w.addBody(b); self.statics.push({ x: x, y: y, z: z, hx: hx, hy: hy, hz: hz, kind: kind });
      return b;
    }
    fixed(0, -0.2, 0, STORE.w / 2 + 0.5, 0.2, STORE.d / 2 + 0.5, "floor");
    fixed(-STORE.w / 2 - 0.1, STORE.wall / 2, 0, 0.1, STORE.wall / 2, STORE.d / 2, "wall");
    fixed(STORE.w / 2 + 0.1, STORE.wall / 2, 0, 0.1, STORE.wall / 2, STORE.d / 2, "wall");
    fixed(0, STORE.wall / 2, -STORE.d / 2 - 0.1, STORE.w / 2, STORE.wall / 2, 0.1, "wall");
    fixed(0, STORE.wall / 2, STORE.d / 2 + 0.1, STORE.w / 2, STORE.wall / 2, 0.1, "front");
    SHELVES.forEach(function (s) {
      var hx = s.len / 2, parts = [];
      LEVELS.forEach(function (y) { parts.push(fixed(s.x, y - 0.02, s.z, hx, 0.02, SHELF_D / 2, "board")); });
      parts.push(fixed(s.x, SHELF_H / 2, s.z - SHELF_D / 2 + 0.02, hx, SHELF_H / 2, 0.02, "back"));
      parts.push(fixed(s.x - hx, SHELF_H / 2, s.z, 0.03, SHELF_H / 2, SHELF_D / 2, "side"));
      parts.push(fixed(s.x + hx, SHELF_H / 2, s.z, 0.03, SHELF_H / 2, SHELF_D / 2, "side"));
      parts.forEach(function (b) { b.isShelf = true; });
    });
    this.toys = [];
    this.kid = null;
    this.reset();
  }

  /* おもちゃの並び（毎回同じ） */
  function toyPlan() {
    var r = rng(11), list = [];
    SHELVES.forEach(function (s, si) {
      LEVELS.forEach(function (y, li) {
        var x = s.x - s.len / 2 + 0.12;
        while (true) {
          var kind = r() < 0.2 ? "ball" : (r() < 0.22 ? "bear" : "box");
          var size;
          if (kind === "ball") { var rr = 0.12 + r() * 0.06; size = [rr, rr, rr]; }
          else if (kind === "bear") size = [0.15, 0.2, 0.13];
          else size = [0.12 + r() * 0.1, 0.12 + r() * 0.1, 0.1 + r() * 0.1];
          if (x + size[0] * 2 > s.x + s.len / 2 - 0.06) break;
          var hue = r();
          list.push({ kind: kind, h: size, x: x + size[0], y: y + size[1] + 0.005, z: s.z + 0.02 + (r() - 0.5) * 0.08,
            hue: hue, pat: Math.floor(r() * 4), price: Math.round((800 + r() * r() * 9000) / 100) * 100 * (kind === "bear" ? 2 : 1) });
          x += size[0] * 2 + 0.04 + r() * 0.06;
        }
      });
    });
    /* 真ん中の積み木の山（平台） */
    for (var lv = 0; lv < 4; lv++) {
      for (var i = 0; i < 4 - lv; i++) for (var j = 0; j < 4 - lv; j++) {
        list.push({ kind: "box", h: [0.13, 0.13, 0.13], x: -0.42 + (i + lv / 2) * 0.28, y: 0.13 + lv * 0.26 + 0.002, z: -1.0 + (j + lv / 2) * 0.28,
          hue: r(), pat: 4, price: 1500 });
      }
    }
    return list;
  }

  Game.prototype.reset = function () {
    var w = this.world, self = this;
    this.toys.forEach(function (t) { w.removeBody(t.body); });
    if (this.kid) { this.kid.joints.forEach(function (j) { w.removeConstraint(j); }); this.kid.list.forEach(function (b) { w.removeBody(b); }); }
    this.toys = toyPlan().map(function (d) {
      var shape = d.kind === "ball" ? new C.Sphere(d.h[0]) : new C.Box(new C.Vec3(d.h[0], d.h[1], d.h[2]));
      var vol = d.h[0] * d.h[1] * d.h[2] * 8;
      var b = new C.Body({ mass: Math.max(0.15, vol * 250), material: self.toyMat, shape: shape, position: new C.Vec3(d.x, d.y, d.z), linearDamping: 0.05, angularDamping: d.kind === "ball" ? 0.3 : 0.1 });
      b.sleepSpeedLimit = 0.15; b.sleepTimeLimit = 0.4;
      w.addBody(b);
      b.sleep();
      var t = { d: d, body: b, home: { x: d.x, y: d.y, z: d.z }, broken: false, hit: 0 };
      b.addEventListener("collide", function (e) { var v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > t.hit) t.hit = v; });
      return t;
    });
    this.makeKid();
    this.time = 0;
    this.acc = 0;
    this.flail = 0;
    this.kidHit = 0;
    this.bumps = [];
  };

  Game.prototype.makeKid = function () {
    var w = this.world, self = this, map = {}, list = [];
    /* 立った姿勢から少し後ろへ傾けて置き、始まるとひっくり返る */
    var q = new C.Quaternion(); q.setFromEuler(-0.25, 0, 0);
    var base = new C.Vec3(0, 0.02, 2.6);
    PARTS.forEach(function (p) {
      var shape = p.r ? new C.Sphere(p.r) : new C.Box(new C.Vec3(p.h[0], p.h[1], p.h[2]));
      var b = new C.Body({ mass: p.m, material: self.kidMat, shape: shape, linearDamping: 0.08, angularDamping: 0.25, collisionFilterGroup: 2, collisionFilterMask: 1 });
      var pos = q.vmult(new C.Vec3(p.p[0], p.p[1], p.p[2])).vadd(base);
      b.position.copy(pos); b.quaternion.copy(q);
      b.allowSleep = false;
      w.addBody(b); map[p.id] = b; list.push(b);
      /* 棚にぶつかったら、その辺りの棚が揺れておもちゃが落ちる */
      b.addEventListener("collide", function (e) {
        if (!e.body.isShelf) return;
        var v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 1) self.bumps.push({ x: b.position.x, z: b.position.z, v: v });
      });
    });
    var joints = JOINTS.map(function (j) {
      var a = PARTS.find(function (p) { return p.id === j[0]; }), b = PARTS.find(function (p) { return p.id === j[1]; });
      var piv = new C.Vec3(j[2][0], j[2][1], j[2][2]);
      var c = new C.ConeTwistConstraint(map[j[0]], map[j[1]], {
        pivotA: piv.vsub(new C.Vec3(a.p[0], a.p[1], a.p[2])), pivotB: piv.vsub(new C.Vec3(b.p[0], b.p[1], b.p[2])),
        axisA: new C.Vec3(0, 1, 0), axisB: new C.Vec3(0, 1, 0), angle: j[3], twistAngle: 0.5, maxForce: 1e7, collideConnected: false });
      w.addConstraint(c);
      return c;
    });
    this.kid = { map: map, list: list, joints: joints };
    /* 店のもの（グループ1）にも当たるように。おもちゃの mask は既定（全部）なので子供(2)とも当たる */
  };

  /* 子供の中心（胴） */
  Game.prototype.center = function () { var p = this.kid.map.torso.position; return { x: p.x, y: p.y, z: p.z }; };

  /* 1コマ進める。input: { rage（激しさ 0〜1）, to（触った床の点 {x,z}）, tap（今たたいた） } */
  Game.prototype.step = function (dt, input, rand) {
    var k = this.kid.map, self = this;
    var all = this.kid.list;
    var rage = input.rage || 0, to = input.to;
    var dir = null;
    if (to) {
      var c = k.torso.position, ddx = to.x - c.x, ddz = to.z - c.z, dl = Math.sqrt(ddx * ddx + ddz * ddz);
      if (dl > 0.3) dir = { x: ddx / dl, z: ddz / dl };
    }
    if (input.tap) {
      /* 1回たたくごとに、触った方へ跳ねて転がる（激しさ rage が高いほど強い）。全身に同じだけ足す（関節がちぎれないよう） */
      var sp = 1.8 + rage * 4.5, upv = k.torso.position.y < 0.7 ? 0.5 + rage * 0.9 : 0, spin = 7 + rage * 12;
      var tx = dir ? dir.x : (rand() - 0.5), tz = dir ? dir.z : (rand() - 0.5);
      all.forEach(function (b) {
        /* 足し続けると連打で速さが際限なく増えるので、混ぜて上限を作る */
        b.velocity.x = b.velocity.x * 0.5 + tx * sp; b.velocity.z = b.velocity.z * 0.5 + tz * sp; b.velocity.y = Math.max(b.velocity.y, upv);
        /* 進む向きに丸太のように転がる回転（向きをそろえて、ほかの回転は弱める） */
        b.angularVelocity.x = b.angularVelocity.x * 0.3 + tz * spin; b.angularVelocity.z = b.angularVelocity.z * 0.3 - tx * spin; b.angularVelocity.y *= 0.5;
      });
      LIMBS.forEach(function (id) { var b = k[id]; b.velocity.x += (rand() - 0.5) * (1 + rage * 3); b.velocity.y += rand() * (0.6 + rage * 1.2); b.velocity.z += (rand() - 0.5) * (1 + rage * 3); });
    }
    if (dir && rage > 0.05) {
      /* 激しいあいだは触った方へ転がり続ける */
      var vx = k.torso.velocity.x * dir.x + k.torso.velocity.z * dir.z, acc = (vx < 2 + rage * 4 ? 14 : 0) * (0.4 + rage) * dt;
      var w = (k.torso.angularVelocity.x * dir.z - k.torso.angularVelocity.z * dir.x) < 6 + rage * 8 ? 30 * (0.4 + rage) * dt : 0;
      all.forEach(function (b) { b.velocity.x += dir.x * acc; b.velocity.z += dir.z * acc; b.angularVelocity.x += dir.z * w; b.angularVelocity.z -= dir.x * w; });
    }
    /* 手足をバタバタ（激しいほど細かく強く） */
    this.flail -= dt;
    if (this.flail <= 0) {
      this.flail = 0.18 - rage * 0.11;
      var s = 0.45 + rage * 1.1;
      LIMBS.forEach(function (id) {
        var b = k[id];
        if (rand() < 0.6) { b.velocity.x += (rand() - 0.5) * 2.2 * s; b.velocity.y += (0.3 + rand() * 1.2) * s; b.velocity.z += (rand() - 0.5) * 2.2 * s; }
      });
    }
    /* 速すぎ・高すぎを抑える（店の外へ飛ばない） */
    all.forEach(function (b) {
      var v = b.velocity, h = Math.sqrt(v.x * v.x + v.z * v.z);
      if (h > 7) { v.x *= 7 / h; v.z *= 7 / h; }
      if (v.y > 3) v.y = 3;
    });
    this.acc += dt;
    while (this.acc >= 1 / 120) { this.world.step(1 / 120); this.acc -= 1 / 120; }
    this.time += dt;
    var bumps = this.bumps; this.bumps = [];
    if (bumps.length) {
      var bp = bumps.reduce(function (a, c) { return c.v > a.v ? c : a; });
      this.toys.forEach(function (t) {
        var p = t.body.position;
        if (Math.abs(p.x - bp.x) > 1.0 || Math.abs(p.z - bp.z) > 1.0 || rand() < 0.4) return;
        t.body.wakeUp();
        var f = Math.min(3, bp.v) * (0.3 + rand() * 0.5);
        t.body.velocity.x += (rand() - 0.5) * f; t.body.velocity.y += f * 0.6; t.body.velocity.z += f * (0.4 + rand() * 0.6) * Math.sign(p.z - bp.z || 1) * -1 + f * 0.5;
      });
      this.shook = bp.v;
    }
    /* 壊れた（元の場所から落ちた・動いた）おもちゃ */
    var events = [];
    this.toys.forEach(function (t) {
      var p = t.body.position, hm = t.home;
      if (!t.broken) {
        var moved = Math.abs(p.x - hm.x) + Math.abs(p.z - hm.z) > 0.25 || p.y < hm.y - 0.15;
        if (moved) { t.broken = true; events.push({ toy: t, kind: "break" }); }
      }
      if (t.hit > 1.2) events.push({ toy: t, kind: "hit", v: t.hit });
      t.hit = 0;
    });
    return events;
  };

  return { Game: Game, PARTS: PARTS, SHELVES: SHELVES, LEVELS: LEVELS, SHELF_D: SHELF_D, SHELF_H: SHELF_H, STORE: STORE };
})(CANNON);
