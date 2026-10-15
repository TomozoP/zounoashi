/* 逆・作業支援ツールの部屋（three.js）。games/three-base.js の Z3 を土台にする。
   物の形は簡素にして、明かり（電気スタンドの暖色・窓からの月明かり・ノートPCの照り返し・窓の電球）で雰囲気を出す。
   妨害の道具は最初から全部部屋に置いておき、鳴っている物だけ動かす。
   ゲームの進行と当たりはゲーム側。ここは見た目と、道具の画面上の位置（anchor）だけ。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  function mat(col, extra) { return Z3.std(col, extra); }
  function mesh(geo, col, extra) { var m = new T.Mesh(geo, mat(col, extra)); m.castShadow = true; m.receiveShadow = true; return m; }
  function box(w, h, d, col, x, y, z, extra) { var m = mesh(new T.BoxGeometry(w, h, d), col, extra); m.position.set(x || 0, y || 0, z || 0); return m; }
  function cyl(rt, rb, h, col, x, y, z, seg, extra) { var m = mesh(new T.CylinderGeometry(rt, rb, h, seg || 18), col, extra); m.position.set(x || 0, y || 0, z || 0); return m; }
  function ball(r, col, x, y, z, extra) { var m = mesh(new T.SphereGeometry(r, 18, 12), col, extra); m.position.set(x || 0, y || 0, z || 0); return m; }
  function cone(r, h, col, x, y, z, seg) { var m = mesh(new T.ConeGeometry(r, h, seg || 16), col); m.position.set(x || 0, y || 0, z || 0); return m; }
  function glowMat(col) { return new T.MeshBasicMaterial({ color: col }); }

  /* 窓の外（夜空と街）は2Dで描いて貼る */
  function skyTex() {
    return Z3.canvasTex(512, 384, function (g, w, h) {
      var sg = g.createLinearGradient(0, 0, 0, h);
      sg.addColorStop(0, "#141640"); sg.addColorStop(0.6, "#3d3580"); sg.addColorStop(1, "#c0709a");
      g.fillStyle = sg; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      g.fillStyle = "#fff6d8";
      for (var i = 0; i < 60; i++) g.fillRect(r() * w, r() * h * 0.55, 2, 2);
      g.fillStyle = "#fff1c4"; g.beginPath(); g.arc(380, 90, 34, 0, 7); g.fill();
      g.fillStyle = "#1e2052"; g.beginPath(); g.arc(395, 80, 31, 0, 7); g.fill();
      var x = 0;
      while (x < w) {
        var bw = 30 + r() * 50, bh = 70 + r() * 130;
        g.fillStyle = "#1d1838"; g.fillRect(x, h - bh, bw, bh);
        g.fillStyle = "#ffc86b";
        for (var yy = h - bh + 10; yy < h - 6; yy += 16) for (var xx = x + 6; xx < x + bw - 6; xx += 12) if (r() < 0.3) g.fillRect(xx, yy, 5, 7);
        x += bw + 2;
      }
    });
  }

  /* 道具の形。pos は置き場所、make で形を作り、anim で鳴っているときに動かす。
     a は画面上の位置を取る点（置き場所からのずれ）。e = { on, t, k } */
  var WOOD = 0x5e4369, DESK = 1.0;
  /* 部屋（家具・壁・人）だけを K 倍に縮め、道具は元の大きさのまま。物どうしの間隔が詰まって見える */
  var K = 0.78;
  var MODELS = {
    lamp: { pos: [-0.78, DESK, -0.8], a: [0.15, 0.5, 0],
      make: function (g, s) {
        g.add(cyl(0.08, 0.09, 0.03, 0x2a2340));
        var a1 = cyl(0.012, 0.012, 0.42, 0x2a2340, -0.06, 0.2, 0); a1.rotation.z = 0.3; g.add(a1);
        var a2 = cyl(0.012, 0.012, 0.36, 0x2a2340, 0.02, 0.5, 0); a2.rotation.z = -0.9; g.add(a2);
        var sh = cyl(0.03, 0.1, 0.13, 0x3e7a6c, 0.18, 0.58, 0, 18, { side: T.DoubleSide }); sh.rotation.z = 0.6; g.add(sh);
        var bl = new T.Mesh(new T.SphereGeometry(0.035, 12, 8), glowMat(0xfff1c8)); bl.position.set(0.21, 0.54, 0); g.add(bl);
      },
      anim: function (g, e) { g.rotation.z = e.on ? Math.sin(e.t * 25) * 0.04 : 0; } },
    laptopNo: null,
    phone: { big: 1.6, pos: [0.38, DESK + 0.04, -0.62], a: [0, 0, 0],
      make: function (g, s) {
        g.add(box(0.09, 0.012, 0.17, 0x1c1f24, 0, 0, 0, { roughness: 0.3 }));
        var sc = new T.Mesh(new T.PlaneGeometry(0.075, 0.15), glowMat(0x2a3038)); sc.rotation.x = -Math.PI / 2; sc.position.y = 0.007; g.add(sc);
        s.phoneScreen = sc; g.rotation.y = 0.4;
      },
      anim: function (g, e, s) { g.position.x = 0.38 + (e.on ? Math.sin(e.t * 90) * 0.01 : 0); s.phoneScreen.material.color.setHex(e.on ? 0x47b8ff : 0x2a3038); } },
    tamago: { big: 1.5, pos: [-0.45, DESK + 0.07, -0.62], a: [0, 0, 0],
      make: function (g) { var b = ball(0.06, 0xff86c8); b.scale.set(0.85, 1, 0.6); g.add(b); g.add(box(0.06, 0.045, 0.01, 0xcfe8c8, 0, 0.01, 0.036)); },
      anim: function (g, e) { g.rotation.z = e.on ? Math.sin(e.t * 30) * 0.2 : 0; } },
    chick: { big: 1.6, pos: [0.72, DESK + 0.05, -0.68], a: [0, 0.02, 0],
      make: function (g) { g.add(ball(0.05, 0xffe14d)); g.add(ball(0.035, 0xffe14d, -0.03, 0.06, 0)); g.add(cone(0.012, 0.03, 0xff9a2a, -0.07, 0.06, 0)).children; g.children[2].rotation.z = Math.PI / 2; },
      anim: function (g, e) { g.position.y = DESK + 0.05 + (e.on && (e.t % 0.22) < 0.08 ? 0.04 : 0); } },
    radio: { pos: [-0.4, 3.12, -1.05], a: [0, 0, 0],
      make: function (g) {
        g.add(box(0.32, 0.2, 0.12, 0xc2443a));
        var sp = cyl(0.06, 0.06, 0.02, 0x3b2b26, -0.07, -0.01, 0.065); sp.rotation.x = Math.PI / 2; g.add(sp);
        g.add(box(0.09, 0.04, 0.01, 0xf2d37a, 0.08, 0.04, 0.065));
        var ant = cyl(0.004, 0.004, 0.25, 0x888888, 0.12, 0.2, 0); ant.rotation.z = -0.4; g.add(ant);
      },
      anim: function (g, e) { g.scale.setScalar(e.on && e.k % 2 ? 1.1 : 1); } },
    metro: { pos: [0.35, 3.02, -1.05], a: [0, 0.16, 0],
      make: function (g, s) {
        var b = cone(0.1, 0.32, 0x5a3c2a, 0, 0.16, 0, 4); b.rotation.y = Math.PI / 4; g.add(b);
        var p = new T.Group(); p.position.set(0, 0.05, 0.075);
        p.add(cyl(0.006, 0.006, 0.26, 0x222222, 0, 0.13, 0)); p.add(box(0.04, 0.03, 0.02, 0xc9a227, 0, 0.18, 0));
        g.add(p); s.pend = p;
      },
      anim: function (g, e, s) { s.pend.rotation.z = e.on ? Math.sin(e.t * Math.PI / 0.19) * 0.5 : 0; } },
    cuckoo: { pos: [1.0, 3.75, -1.12], a: [0, 0, 0],
      make: function (g, s) {
        g.add(box(0.26, 0.24, 0.1, 0x6b4227));
        var roof = cone(0.22, 0.14, 0x4a2a18, 0, 0.19, 0, 4); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.45; g.add(roof);
        var hole = cyl(0.04, 0.04, 0.01, 0x1a100a, 0, 0.02, 0.051); hole.rotation.x = Math.PI / 2; g.add(hole);
        var bird = ball(0.035, 0x7fb6e8, 0, 0.02, 0.02); g.add(bird); s.bird = bird;
        var pend = cyl(0.005, 0.005, 0.3, 0xc9a227, 0, -0.27, 0.03); g.add(pend);
      },
      anim: function (g, e, s) { s.bird.position.z = e.on && (e.t % 0.75) < 0.4 ? 0.1 : 0.02; } },
    clock: { pos: [1.3, 2.34, -0.95], a: [0, 0, 0],
      make: function (g) {
        var b = cyl(0.11, 0.11, 0.06, 0xe34f3e, 0, 0, 0, 24); b.rotation.x = Math.PI / 2; g.add(b);
        var f = new T.Mesh(new T.CircleGeometry(0.088, 24), mat(0xfffaf0)); f.position.z = 0.031; g.add(f);
        g.add(box(0.008, 0.06, 0.004, 0x333333, 0, 0.03, 0.035)); g.add(box(0.045, 0.008, 0.004, 0x333333, 0.02, 0, 0.035));
        g.add(ball(0.035, 0xe0b33a, -0.08, 0.11, 0)); g.add(ball(0.035, 0xe0b33a, 0.08, 0.11, 0));
      },
      anim: function (g, e) { g.rotation.z = e.on ? Math.sin(e.t * 70) * 0.12 : 0; } },
    bubble: { pos: [1.3, 1.74, -0.95], a: [0, 0, 0],
      make: function (g) { g.add(box(0.2, 0.12, 0.14, 0x6bc4ff)); var n = cyl(0.04, 0.05, 0.06, 0x3a8acf, 0.12, 0.02, 0); n.rotation.z = Math.PI / 2; g.add(n); },
      anim: function (g, e) { g.position.y = 1.74 + (e.on ? Math.abs(Math.sin(e.t * 12)) * 0.01 : 0); } },
    microwave: { pos: [1.3, 0.21, -0.95], a: [0, 0, 0],
      make: function (g, s) {
        g.add(box(0.42, 0.26, 0.3, 0xe8e8ec));
        var w = new T.Mesh(new T.PlaneGeometry(0.26, 0.18), glowMat(0x3a3a44)); w.position.set(-0.05, 0, 0.152); g.add(w); s.mwWin = w;
      },
      anim: function (g, e, s) { s.mwWin.material.color.setHex(e.on ? 0xffd27a : 0x3a3a44); g.rotation.y = e.on ? Math.sin(e.t * 40) * 0.01 : 0; } },
    kettle: { pos: [1.3, 0.58, -0.95], a: [0, 0.08, 0],
      make: function (g) {
        var b = ball(0.13, 0xc9ced8, 0, 0.1, 0, { metalness: 0.6, roughness: 0.3 }); b.scale.y = 0.8; g.add(b);
        var sp = cyl(0.02, 0.03, 0.15, 0xc9ced8, 0.15, 0.15, 0); sp.rotation.z = -0.9; g.add(sp);
        var hd = new T.Mesh(new T.TorusGeometry(0.08, 0.01, 6, 16, Math.PI), mat(0x333333)); hd.position.y = 0.18; g.add(hd);
      },
      anim: function (g, e) { g.rotation.z = e.on ? Math.sin(e.t * 50) * 0.03 : 0; } },
    printer: { pos: [-1.3, 2.82, -0.95], a: [0, 0.05, 0],
      make: function (g, s) {
        g.add(box(0.4, 0.14, 0.28, 0xd6d8de));
        var p = box(0.2, 0.005, 0.2, 0xffffff, 0, 0.075, 0.05); g.add(p); s.paper = p;
      },
      anim: function (g, e, s) { s.paper.scale.z = e.on ? 1 + (e.t * 1.5) % 1.2 : 1; s.paper.position.z = 0.05 + (s.paper.scale.z - 1) * 0.1; } },
    monkey: { pos: [-1.3, 2.23, -0.95], a: [0, 0.12, 0],
      make: function (g, s) {
        g.add(ball(0.08, 0x8a5a3a, 0, 0.06, 0)); g.add(ball(0.065, 0x8a5a3a, 0, 0.19, 0)); g.add(ball(0.04, 0xe8c39e, 0, 0.18, 0.04));
        var c1 = cyl(0.05, 0.05, 0.01, 0xf2c94c, -0.1, 0.1, 0.03, 18, { metalness: 0.7, roughness: 0.3 }); c1.rotation.z = Math.PI / 2; g.add(c1);
        var c2 = c1.clone(); c2.position.x = 0.1; g.add(c2); s.cym = [c1, c2];
      },
      anim: function (g, e, s) { var o = e.on && e.k % 2 ? 0.035 : 0.1; s.cym[0].position.x = -o; s.cym[1].position.x = o; } },
    jack: { pos: [1.3, 1.13, -0.95], a: [0, 0.1, 0],
      make: function (g, s) {
        g.add(box(0.16, 0.14, 0.16, 0x3b6fd8, 0, 0.07, 0));
        var lid = box(0.17, 0.02, 0.17, 0xf2c94c, 0, 0.15, 0); g.add(lid); s.jlid = lid;
        var head = ball(0.05, 0xffffff, 0, 0.12, 0); g.add(head); s.jhead = head;
      },
      anim: function (g, e, s) {
        var up = e.on ? Math.abs(Math.sin(e.t * 5)) * 0.2 + 0.05 : 0;
        s.jhead.position.y = 0.12 + up; s.jlid.rotation.x = e.on ? -1.6 : 0; s.jlid.position.z = e.on ? -0.09 : 0; s.jlid.position.y = e.on ? 0.22 : 0.15;
      } },
    landline: { pos: [-1.3, 1.68, -0.95], a: [0, 0.05, 0],
      make: function (g, s) {
        var b = box(0.24, 0.1, 0.18, 0x1e1e22, 0, 0.05, 0); g.add(b);
        var r = box(0.28, 0.05, 0.06, 0x1e1e22, 0, 0.13, 0); g.add(r); s.recv = r;
      },
      anim: function (g, e, s) { s.recv.position.y = 0.13 + (e.on ? Math.abs(Math.sin(e.t * 60)) * 0.02 : 0); } },
    trumpet: { pos: [-1.3, 1.13, -0.95], a: [0, 0.05, 0],
      make: function (g) {
        var t = cyl(0.015, 0.015, 0.22, 0xf2c94c, 0, 0.05, 0, 12, { metalness: 0.7, roughness: 0.3 }); t.rotation.z = Math.PI / 2; g.add(t);
        var bell = cone(0.06, 0.1, 0xf2c94c, 0.15, 0.05, 0); bell.rotation.z = Math.PI / 2; g.add(bell);
      },
      anim: function (g, e) { g.rotation.z = e.on ? 0.3 + Math.sin(e.t * 10) * 0.08 : 0; } },
    taiko: { pos: [-1.3, 0.08, -0.95], a: [0, 0.1, 0],
      make: function (g) { g.add(cyl(0.13, 0.13, 0.16, 0xa0402f, 0, 0.08, 0)); g.add(cyl(0.135, 0.135, 0.01, 0xf3e6c8, 0, 0.165, 0)); },
      anim: function (g, e) { g.scale.setScalar(e.on && (e.t % 0.4) < 0.08 ? 1.08 : 1); } },
    horn: { pos: [-1.3, 0.58, -0.95], a: [0, 0.12, 0],
      make: function (g) { g.add(cyl(0.045, 0.045, 0.14, 0xe53935, 0, 0.07, 0)); g.add(cone(0.08, 0.14, 0xcfd3da, 0, 0.21, 0)).children; g.children[1].rotation.x = Math.PI; },
      anim: function (g, e) { g.scale.setScalar(e.on && (e.t % 1) < 0.5 ? 1.1 : 1); } },
    smoke: { pos: [0.75, 4.55, -1.13], a: [0, 0, 0],
      make: function (g, s) { var d = cyl(0.11, 0.11, 0.04, 0xe9e9ee, 0, 0, 0, 24); d.rotation.x = Math.PI / 2; g.add(d); var l = new T.Mesh(new T.CircleGeometry(0.015, 12), glowMat(0x553333)); l.position.z = 0.025; g.add(l); s.smokeL = l; },
      anim: function (g, e, s) { s.smokeL.material.color.setHex(e.on ? 0xff3b3b : 0x553333); } },
    disco: { pos: [-0.6, 4.05, -0.3], a: [0, 0, 0],
      make: function (g) { g.add(cyl(0.004, 0.004, 1.2, 0x888888, 0, 0.65, 0)); g.add(ball(0.09, 0xc9d2e0, 0, 0, 0, { metalness: 0.9, roughness: 0.25 })); },
      anim: function (g, e) { if (e.on) g.rotation.y = e.t * 2; } },
    drip: { pos: [-0.2, 0, 0.8], a: [0, 0.1, 0],
      make: function (g, s) {
        g.add(cyl(0.11, 0.09, 0.18, 0x6b7a8f, 0, 0.09, 0, 18, { side: T.DoubleSide }));
        var dr = ball(0.02, 0x8fd3ff, 0, 3.85, 0); dr.visible = false; g.add(dr); s.drop = dr;
      },
      anim: function (g, e, s) { s.drop.visible = e.on; if (e.on) s.drop.position.y = 3.85 - ((e.t % 0.55) / 0.55) * 3.7; } },
    cracker: { pos: [-0.95, 0.5, 0.05], a: [0, 0.08, 0],
      make: function (g) {
        g.add(cyl(0.16, 0.16, 0.04, 0xe6533b, 0, -0.02, 0)); g.add(cyl(0.025, 0.025, 0.48, 0x6b3f2a, 0, -0.26, 0));
        var c = cone(0.045, 0.14, 0xe85a8a, 0, 0.07, 0); c.rotation.z = Math.PI; g.add(c);
      },
      anim: function (g, e) { g.rotation.z = e.on && (e.t % 0.9) < 0.1 ? 0.15 : 0; } },
    vacuum: { pos: [1.25, 0.03, 0.1], a: [0, 0.03, 0], move: true,
      make: function (g) { g.add(cyl(0.17, 0.17, 0.06, 0x3a3d44, 0, 0, 0, 24)); g.add(cyl(0.15, 0.15, 0.02, 0xcfd3da, 0, 0.035, 0, 24)); },
      anim: function (g, e) {
        if (!e.on) { g.position.set(1.25, 0.03, 0.1); return; }
        var ph = (e.t * 0.35) % 2, u = ph < 1 ? ph : 2 - ph;
        g.position.set(1.25 - u * 2.2, 0.03, 0.2 + Math.sin(e.t * 1.3) * 0.2); g.rotation.y = e.t * 2;
      } },
    cat: { pos: [0.45, 0.04, 0.65], a: [0, 0.1, 0], move: true,
      make: function (g, s) {
        var b = ball(0.12, 0xe9e2d6); b.scale.set(1.4, 0.8, 0.9); b.position.y = 0.08; g.add(b);
        g.add(ball(0.075, 0xe9e2d6, -0.15, 0.15, 0));
        var e1 = cone(0.025, 0.05, 0xe9e2d6, -0.17, 0.23, 0.035, 4); g.add(e1); var e2 = e1.clone(); e2.position.z = -0.035; g.add(e2);
        var tail = cyl(0.015, 0.015, 0.2, 0xe9e2d6, 0.2, 0.15, 0); tail.rotation.z = -0.6; g.add(tail);
      },
      anim: function (g, e) {
        if (!e.on) { g.position.set(0.45, 0.04, 0.65); g.rotation.set(0, 0.3, 0); return; }
        var ph = (e.t * 0.25) % 2, u = ph < 1 ? ph : 2 - ph;
        g.position.set(-0.75 + u * 1.4, DESK + 0.02 + Math.abs(Math.sin(e.t * 8)) * 0.015, -0.53);
        g.rotation.set(0, (ph < 1 ? Math.PI : 0), 0);
      } },
    dog: { pos: [-0.85, 0.04, 0.6], a: [0, 0.18, 0],
      make: function (g) {
        g.add(cyl(0.3, 0.3, 0.06, 0x5a4a7a, 0, -0.01, 0, 24));
        var b = ball(0.13, 0xb07a46, 0, 0.12, 0); b.scale.set(1.3, 0.9, 0.9); g.add(b);
        g.add(ball(0.09, 0xb07a46, 0.1, 0.25, 0.04)); g.add(ball(0.04, 0x6b4a2a, 0.08, 0.3, 0.1));
      },
      anim: function (g, e) { g.children[0].children[2].position.y = 0.25 + (e.on && (e.t % 0.4) < 0.1 ? 0.04 : 0); } },
    fly: { big: 2.2, pos: [-1.0, 4.3, -1.12], a: [0, 0, 0], move: true,
      make: function (g) { g.add(ball(0.025, 0x111111)); var w = new T.Mesh(new T.PlaneGeometry(0.05, 0.025), new T.MeshBasicMaterial({ color: 0xddeeff, transparent: true, opacity: 0.6, side: T.DoubleSide })); w.position.y = 0.02; g.add(w); },
      anim: function (g, e) {
        if (!e.on) { g.position.set(-1.0, 4.3, -1.12); return; }
        g.position.set(-0.3 + Math.sin(e.t * 1.3) * 0.9, 2.2 + Math.sin(e.t * 2.1) * 0.8, -0.4 + Math.sin(e.t * 0.9) * 0.5);
        g.children[0].children[1].rotation.x = Math.sin(e.t * 80);
      } },
    mosquito: { big: 2.2, pos: [0.25, 4.35, -1.12], a: [0, 0, 0], move: true,
      make: function (g) { g.add(box(0.06, 0.012, 0.012, 0x333333)); var w = new T.Mesh(new T.PlaneGeometry(0.05, 0.02), new T.MeshBasicMaterial({ color: 0xddeeff, transparent: true, opacity: 0.6, side: T.DoubleSide })); w.position.y = 0.012; g.add(w); },
      anim: function (g, e) {
        if (!e.on) { g.position.set(0.25, 4.35, -1.12); return; }
        g.position.set(0.3 + Math.sin(e.t * 1.7 + 1) * 0.9, 2.0 + Math.sin(e.t * 2.6) * 0.8, -0.2 + Math.sin(e.t * 1.1) * 0.4);
        g.children[0].children[1].rotation.x = Math.sin(e.t * 90);
      } },
    duck: { big: 1.2, pos: [0.4, 1.55, -1.02], a: [0, 0.1, 0],
      make: function (g) {
        var b = ball(0.09, 0xffd53d, 0, 0.07, 0, { roughness: 0.4 }); b.scale.set(1.3, 0.85, 1); g.add(b);
        g.add(ball(0.06, 0xffd53d, -0.07, 0.17, 0, { roughness: 0.4 }));
        var bk = cone(0.025, 0.06, 0xff8a2a, -0.14, 0.16, 0, 10); bk.rotation.z = Math.PI / 2; g.add(bk);
      },
      anim: function (g, e) { var q = e.on ? Math.max(0, Math.sin(e.t * Math.PI / 0.48 * 2)) : 0; g.scale.set(1.2 * (1 + q * 0.12), 1.2 * (1 - q * 0.2), 1.2 * (1 + q * 0.12)); } },
    chair: { pos: [1.05, 0, 0.6], a: [0, 0.55, 0],
      make: function (g) {
        g.add(box(0.36, 0.04, 0.36, 0xc9824a, 0, 0.42, 0)); g.add(box(0.04, 0.45, 0.36, 0xc9824a, 0.16, 0.66, 0));
        var r1 = new T.Mesh(new T.TorusGeometry(0.6, 0.015, 6, 24, 0.9), mat(0x8a5a30)); r1.rotation.z = Math.PI * 1.5 - 0.45; r1.position.set(0, 0.6, 0.15); g.add(r1);
        var r2 = r1.clone(); r2.position.z = -0.15; g.add(r2);
        [[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.15], [0.15, -0.15]].forEach(function (p) { g.add(box(0.03, 0.38, 0.03, 0x8a5a30, p[0], 0.21, p[1])); });
      },
      anim: function (g, e) { g.rotation.z = e.on ? Math.sin(e.t * 8) * 0.12 : 0; } },
    /* 窓辺の小さな話す箱（読み上げ）。鳴っている間は上の輪が点けっぱなしで光る */
    speaker: { big: 1.3, pos: [-0.12, 1.5, -1.1], a: [0, 0.1, 0],
      make: function (g, s) {
        g.add(cyl(0.055, 0.06, 0.15, 0x3a3f4a, 0, 0.075, 0, 24, { roughness: 0.8 }));
        var ring = new T.Mesh(new T.CylinderGeometry(0.056, 0.056, 0.015, 24), glowMat(0x2a2f3a)); ring.position.y = 0.152; g.add(ring);
        s.speakerRing = ring;
      },
      anim: function (g, e, s) { s.speakerRing.material.color.setHex(e.on ? 0x5fd0ff : 0x2a2f3a); g.scale.y = 1.3 * (e.on ? 1 + Math.sin(e.t * 14) * 0.03 : 1); } },
    /* 上半身はだかで叫びながら部屋の手前を横切るおじさん（鳴っていない間はいない） */
    ojisan: { big: 0.62, pos: [-3, 0, 0.95], a: [0, 0.6, 0], move: true,
      make: function (g, s) {
        var skin = 0xe8b48a, dark = 0x1a1620, o = s.oji = {};
        var body = new T.Group(); g.add(body); o.body = body;
        var belly = ball(0.2, skin, 0, 0.78, 0.02); belly.scale.set(1, 1.15, 0.9); body.add(belly);
        body.add(ball(0.17, skin, 0, 1.0, 0));
        body.add(box(0.36, 0.2, 0.26, dark, 0, 0.55, 0));
        o.legs = [-0.09, 0.09].map(function (x) {
          var L = new T.Group(); L.position.set(x, 0.5, 0); body.add(L);
          L.add(cyl(0.055, 0.05, 0.46, skin, 0, -0.24, 0)); L.add(box(0.09, 0.04, 0.16, skin, 0, -0.47, 0.03));
          return L;
        });
        o.arms = [-1, 1].map(function (sd) {
          var A = new T.Group(); A.position.set(sd * 0.2, 1.05, 0); body.add(A);
          A.add(cyl(0.05, 0.045, 0.42, skin, 0, -0.2, 0)); A.add(ball(0.05, skin, 0, -0.42, 0));
          return A;
        });
        var head = new T.Group(); head.position.set(0, 1.27, 0); body.add(head); o.head = head;
        head.add(ball(0.15, skin, 0, 0, 0));
        /* 頭のてっぺんは無く、横と後ろだけ長い髪 */
        [-1, 1].forEach(function (sd) { var hr = box(0.06, 0.3, 0.2, dark, sd * 0.14, -0.07, -0.03); hr.rotation.z = sd * 0.1; head.add(hr); });
        head.add(box(0.26, 0.3, 0.06, dark, 0, -0.07, -0.13));
        [-1, 1].forEach(function (sd) {
          var br = box(0.08, 0.03, 0.02, dark, sd * 0.06, 0.05, 0.14); br.rotation.z = -sd * 0.35; head.add(br);
          head.add(ball(0.022, 0xffffff, sd * 0.055, 0.0, 0.135));
        });
        var mouth = ball(0.045, 0x5a1a22, 0, -0.08, 0.13); mouth.scale.set(1.2, 1, 0.5); head.add(mouth); o.mouth = mouth;
        head.add(box(0.14, 0.025, 0.02, dark, 0, -0.03, 0.145));
      },
      anim: function (g, e, s) {
        var o = s.oji;
        if (!e.on) { g.visible = false; g.position.set(-3, 0, 0.95); return; }
        g.visible = true;
        var ph = (e.t * 0.13) % 2, u = ph < 1 ? ph : 2 - ph, dir = ph < 1 ? 1 : -1;
        g.position.set(-1.3 + u * 2.6, Math.abs(Math.sin(e.t * 7)) * 0.04, 0.95);
        g.rotation.y = dir * 0.7;
        var sw = Math.sin(e.t * 7);
        o.legs[0].rotation.x = sw * 0.6; o.legs[1].rotation.x = -sw * 0.6;
        o.arms[0].rotation.x = -sw * 1.1; o.arms[1].rotation.x = sw * 1.1;
        o.arms[0].rotation.z = -0.3; o.arms[1].rotation.z = 0.3;
        o.head.rotation.z = Math.sin(e.t * 3.5) * 0.15;
        o.mouth.scale.y = 0.6 + Math.abs(Math.sin(e.t * 9)) * 0.9;
      } }
  };
  delete MODELS.laptopNo;

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({
      renderer: { shadows: true, tone: "aces", exposure: 1.2 },
      camera: { fov: 40, near: 0.3, far: 40 },
      finish: { contrast: 0, vignette: 0.32, grain: 0.008 }   /* 明るい所が緑に化けるので、コントラストの仕上げは使わない */
    });
    var S = this.scene = st.scene;
    this.camera = st.camera;
    S.background = new T.Color(0x16122a);

    /* 明かり：全体はうす紫、暖かい電気スタンド（影はこれだけ）、窓からの月明かり（人の背中の縁を照らす）、画面の照り返し */
    S.add(new T.HemisphereLight(0x9a8ae8, 0x2a1a40, 1.25));
    var front = new T.DirectionalLight(0xb8a8ff, 0.5); front.position.set(1, 2.5, 5); S.add(front);
    var moon = new T.DirectionalLight(0x8fa2ff, 1.3); moon.position.set(-0.5, 3.5, -4); moon.target.position.set(0.2, 1, 0.5);
    S.add(moon); S.add(moon.target);
    var lamp = new T.SpotLight(0xffb066, 14, 5, 1.0, 0.6, 1.5);
    lamp.position.set(-0.85, 1.6, -0.8); lamp.target.position.set(-0.3, DESK, -0.65);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(Z3.mobile ? 512 : 1024, Z3.mobile ? 512 : 1024);
    lamp.shadow.bias = -0.002;
    S.add(lamp); S.add(lamp.target);
    var bulb = new T.PointLight(0xffa860, 2.2, 3.2, 2); bulb.position.set(-0.85, 1.55, -0.7); S.add(bulb);
    this.screenLight = new T.PointLight(0xffe2c8, 0.5, 1.2, 2); this.screenLight.position.set(0.05, 1.35, -0.5); S.add(this.screenLight);
    var warm2 = new T.PointLight(0xff8fb0, 1.2, 4, 2); warm2.position.set(1.2, 2.6, 0.2); S.add(warm2);

    /* 部屋 */
    var wallC = 0x4a3f78, wz = -1.2;
    var floor = new T.Mesh(new T.PlaneGeometry(10, 5), mat(0x2c2244)); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.8); floor.receiveShadow = true; S.add(floor);
    var rug = cyl(1.1, 1.1, 0.01, 0x6b4c7f, 0.3, 0.005, 0.45, 40); rug.scale.z = 0.4; S.add(rug);
    var wx0 = -0.8, wx1 = 0.7, wy0 = 1.5, wy1 = 2.75;
    S.add(box(10, wy0, 0.1, wallC, 0, wy0 / 2, wz));
    S.add(box(10, 3.2, 0.1, wallC, 0, wy1 + 1.6, wz));
    S.add(box(wx0 + 5, wy1 - wy0, 0.1, wallC, (wx0 - 5) / 2, (wy0 + wy1) / 2, wz));
    S.add(box(5 - wx1, wy1 - wy0, 0.1, wallC, (wx1 + 5) / 2, (wy0 + wy1) / 2, wz));
    var fr = 0x221c40;
    S.add(box(0.05, wy1 - wy0, 0.12, fr, (wx0 + wx1) / 2, (wy0 + wy1) / 2, wz));
    S.add(box(wx1 - wx0, 0.05, 0.12, fr, (wx0 + wx1) / 2, (wy0 + wy1) / 2, wz));
    S.add(box(wx1 - wx0 + 0.16, 0.05, 0.2, 0x5b4a7e, (wx0 + wx1) / 2, wy0 - 0.025, wz + 0.08));
    var sky = new T.Mesh(new T.PlaneGeometry(2.6, 1.9), new T.MeshBasicMaterial({ map: skyTex() }));
    sky.position.set((wx0 + wx1) / 2, (wy0 + wy1) / 2, -1.9); S.add(sky);
    this.win = [new T.Vector3(wx0, wy1, wz), new T.Vector3(wx1, wy0, wz)];
    /* 窓の外の出来事を描く板（空と壁のあいだ。壁と枠の奥に見える） */
    var OW = 1.9, OH = 1.6, oc = document.createElement("canvas");
    oc.width = 512; oc.height = Math.round(512 * OH / OW);
    var otex = new T.CanvasTexture(oc); otex.colorSpace = T.SRGBColorSpace;
    var outside = new T.Mesh(new T.PlaneGeometry(OW, OH), new T.MeshBasicMaterial({ map: otex, transparent: true, depthWrite: false }));
    outside.position.set((wx0 + wx1) / 2, (wy0 + wy1) / 2, -1.6); S.add(outside);
    var iw = (wx1 - wx0) / OW * oc.width, ih = (wy1 - wy0) / OH * oc.height;
    this.outside = { ctx: oc.getContext("2d"), tex: otex, w: oc.width, h: oc.height, inner: { x: (oc.width - iw) / 2, y: (oc.height - ih) / 2, w: iw, h: ih } };
    /* 窓の上の電球の飾り（点けっぱなし） */
    var fairyCols = [0xffd27a, 0xff9ab8, 0x9fe0ff];
    for (var i = 0; i < 14; i++) {
      var fx = wx0 - 0.05 + (wx1 - wx0 + 0.1) * i / 13, fy = wy1 + 0.08 - Math.sin(i / 13 * Math.PI) * 0.1;
      var fb = new T.Mesh(new T.SphereGeometry(0.018, 8, 6), glowMat(fairyCols[i % 3])); fb.position.set(fx, fy, wz + 0.08); S.add(fb);
    }
    var fl = new T.PointLight(0xffc89a, 0.8, 2.2, 2); fl.position.set((wx0 + wx1) / 2, wy1, wz + 0.3); S.add(fl);
    /* 鉢 */
    S.add(cyl(0.07, 0.055, 0.12, 0xc06b52, -0.55, wy0 + 0.06, wz + 0.08));
    var lf = ball(0.09, 0x3f8a6a, -0.55, wy0 + 0.22, wz + 0.08); lf.scale.set(0.8, 1.4, 0.8); S.add(lf);

    /* 机（窓の下） */
    S.add(box(1.9, 0.06, 0.65, 0x7b5446, 0, DESK, -0.85));
    [[-0.92, -0.55], [0.92, -0.55], [-0.92, -1.12], [0.92, -1.12]].forEach(function (p) { S.add(box(0.05, DESK, 0.05, 0x5a3d3a, p[0], DESK / 2, p[1])); });
    /* ノートPC（画面は人のほうへ） */
    S.add(box(0.34, 0.02, 0.24, 0xb9c1d6, 0.02, DESK + 0.04, -0.72, { roughness: 0.4, metalness: 0.3 }));
    var lid = new T.Group(); lid.position.set(0.02, DESK + 0.05, -0.84); lid.rotation.x = -0.25;
    lid.add(box(0.34, 0.24, 0.015, 0xb9c1d6, 0, 0.12, 0, { roughness: 0.4, metalness: 0.3 }));
    var scr = new T.Mesh(new T.PlaneGeometry(0.3, 0.2), glowMat(0xbfe6ff)); scr.position.set(0, 0.12, 0.009); lid.add(scr);
    S.add(lid);
    S.add(cyl(0.045, 0.045, 0.1, 0xf1ece2, 0.55, DESK + 0.08, -0.98));
    /* 左右の細い棚（1段に1つずつ）と、窓の上の棚 */
    [-1.3, 1.3].forEach(function (x) {
      S.add(box(0.6, 3.0, 0.04, 0x4a3560, x, 1.5, -1.13));
      S.add(box(0.04, 3.0, 0.35, 0x4a3560, x - 0.3, 1.5, -0.97)); S.add(box(0.04, 3.0, 0.35, 0x4a3560, x + 0.3, 1.5, -0.97));
      [0.06, 0.55, 1.1, 1.65, 2.2, 2.75].forEach(function (y) { S.add(box(0.58, 0.03, 0.33, WOOD, x, y, -0.97)); });
    });
    S.add(box(1.5, 0.04, 0.3, WOOD, 0, 3.0, -1.05));
    var bookCols = [0x7c5fa0, 0xc56e8f, 0x4f8fb0, 0xd6a54a];
    for (var bi = 0; bi < 5; bi++) S.add(box(0.06, 0.24, 0.2, bookCols[bi % 4], -0.05 + bi * 0.07, 3.14, -1.05));

    /* 飾りの小物（押しても何もない）。部屋の密度を上げる */
    var R = Z3.rng(11), C = [0x7c5fa0, 0xc56e8f, 0x4f8fb0, 0xd6a54a, 0x6aa87a, 0xe0805a];
    function books(x, y, z, n, rot) {
      var g = new T.Group(); g.position.set(x, y, z); g.rotation.y = rot || 0;
      var bx = 0;
      for (var i = 0; i < n; i++) { var w = 0.04 + R() * 0.03, h = 0.16 + R() * 0.1; g.add(box(w, h, 0.17, C[Math.floor(R() * C.length)], bx, h / 2, 0)); bx += w + 0.004; }
      S.add(g); return g;
    }
    function stack(x, y, z, n) {
      for (var i = 0; i < n; i++) { var b = box(0.28 + R() * 0.08, 0.05, 0.2, C[Math.floor(R() * C.length)], x + (R() - 0.5) * 0.04, y + 0.025 + i * 0.05, z); b.rotation.y = (R() - 0.5) * 0.4; S.add(b); }
    }
    function plant(x, y, z, k) {
      k = k || 1;
      S.add(cyl(0.07 * k, 0.055 * k, 0.12 * k, 0xc06b52, x, y + 0.06 * k, z));
      for (var i = 0; i < 5; i++) { var a = i * 1.26, lf = ball(0.06 * k, 0x3f8a6a + (i % 2) * 0x0a1004, x + Math.cos(a) * 0.05 * k, y + (0.17 + (i % 3) * 0.05) * k, z + Math.sin(a) * 0.05 * k); lf.scale.set(0.7, 1.5, 0.7); lf.rotation.z = Math.cos(a) * 0.5; lf.rotation.x = Math.sin(a) * 0.5; S.add(lf); }
    }
    function poster(x, y, w, h, paint) {
      S.add(box(w + 0.04, h + 0.04, 0.02, 0x2a2340, x, y, wz + 0.06));
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: Z3.canvasTex(128, Math.round(128 * h / w), paint), roughness: 0.9 }));
      m.position.set(x, y, wz + 0.075); S.add(m);
    }
    /* 天井と梁 */
    var ceil = new T.Mesh(new T.PlaneGeometry(10, 5), mat(0x241d44, { emissive: 0x241a48 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.9, 0.8); S.add(ceil);
    [-0.2, 0.9, 2.0].forEach(function (z) { S.add(box(10, 0.14, 0.16, 0x3a2c55, 0, 4.83, z, { emissive: 0x2a2050 })); });
    poster(-1.25, 4.15, 0.4, 0.5, function (g, w, h) { g.fillStyle = "#3a8a8a"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffd6e0"; g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w - 20, h - 20); g.lineTo(20, h - 20); g.fill(); });
    poster(1.3, 4.25, 0.45, 0.35, function (g, w, h) { g.fillStyle = "#e0805a"; g.fillRect(0, 0, w, h); g.fillStyle = "#2a2340"; for (var i = 0; i < 5; i++) { g.beginPath(); g.arc(20 + i * 22, h / 2 + Math.sin(i) * 14, 9, 0, 7); g.fill(); } });
    /* 壁の絵（文字なしの形だけ） */
    poster(-0.35, 3.75, 0.5, 0.65, function (g, w, h) { g.fillStyle = "#f2c3a0"; g.fillRect(0, 0, w, h); g.fillStyle = "#e85a6a"; g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.28, 0, 7); g.fill(); g.fillStyle = "#3a3f78"; g.fillRect(0, h * 0.7, w, h * 0.3); });
    poster(0.35, 3.6, 0.42, 0.42, function (g, w, h) { g.fillStyle = "#2a5a6a"; g.fillRect(0, 0, w, h); g.fillStyle = "#f2d37a"; for (var i = 0; i < 4; i++) g.fillRect(14 + i * 26, h - 20 - i * 20, 18, 20 + i * 20); });
    poster(-0.1, 4.45, 0.36, 0.3, function (g, w, h) { g.fillStyle = "#e9e2d6"; g.fillRect(0, 0, w, h); g.strokeStyle = "#7c5fa0"; g.lineWidth = 8; g.beginPath(); g.moveTo(10, h - 20); g.quadraticCurveTo(w / 2, 0, w - 10, h - 20); g.stroke(); });
    /* 付箋（文字なし） */
    [[0.82, 1.35, 0xffe46b], [0.9, 1.2, 0xff9ab8], [-0.92, 1.3, 0x9fe0ff], [-0.86, 1.15, 0xffe46b], [0.78, 1.1, 0x9dff9b]].forEach(function (p) { var n = box(0.08, 0.08, 0.005, p[2], p[0], p[1], wz + 0.06); n.rotation.z = (R() - 0.5) * 0.3; S.add(n); });
    /* 棚の上・机・窓辺 */
    books(-1.52, 3.0, -0.97, 7); plant(-1.15, 3.0, -0.97, 0.9);
    books(1.08, 3.0, -0.97, 5); plant(1.45, 3.0, -0.97, 0.8);
    books(-1.5, 2.2, -0.97, 3); books(1.43, 0.55, -0.97, 2); books(-1.47, 1.1, -0.97, 2); books(1.45, 2.2, -0.97, 3);
    stack(-0.55, DESK + 0.03, -1.0, 3); stack(0.75, DESK + 0.03, -0.98, 2);
    S.add(cyl(0.035, 0.03, 0.1, 0x4f8fb0, -0.25, DESK + 0.08, -1.02));
    for (var pi = 0; pi < 4; pi++) { var pen = cyl(0.005, 0.005, 0.14, C[pi], -0.25 + (pi - 1.5) * 0.01, DESK + 0.14, -1.02); pen.rotation.z = (pi - 1.5) * 0.15; S.add(pen); }
    plant(0.15, 1.52, wz + 0.08, 0.7);
    /* 天井からの鉢 */
    [[-0.95, 3.55], [0.7, 3.25]].forEach(function (h) {
      S.add(cyl(0.004, 0.004, 1.4, 0x777777, h[0], h[1] + 0.75, -0.75));
      S.add(cyl(0.1, 0.08, 0.12, 0xe9e2d6, h[0], h[1], -0.75));
      for (var i = 0; i < 6; i++) S.add(ball(0.04, 0x4f9a6a, h[0] + Math.cos(i) * 0.08, h[1] - 0.04 - (i % 3) * 0.08, -0.75 + Math.sin(i) * 0.08));
    });
    /* 床 */
    stack(-1.25, 0, 0.05, 5); stack(0.2, 0, 1.05, 3);
    var cush = ball(0.24, 0xe07a9a, 0.85, 0.08, 1.05); cush.scale.set(1, 0.35, 1); S.add(cush);
    var cush2 = ball(0.2, 0x7aa0e0, -0.45, 0.07, 1.15); cush2.scale.set(1, 0.35, 1); S.add(cush2);
    S.add(box(0.36, 0.28, 0.3, 0xb08a5a, 1.4, 0.14, 0.75)); S.add(box(0.28, 0.22, 0.26, 0xc29a68, 1.42, 0.39, 0.75));
    plant(-1.6, 0, 0.75, 2.2);
    var basket = cyl(0.17, 0.14, 0.26, 0xd6b47a, 1.6, 0.13, 0.15, 14); S.add(basket);
    var guitar = new T.Group(); guitar.position.set(-1.7, 0.05, 0.1); guitar.rotation.z = -0.25; guitar.rotation.y = 0.5;
    var gb = ball(0.17, 0xb0602a); gb.scale.set(1, 1.2, 0.35); gb.position.y = 0.18; guitar.add(gb);
    guitar.add(box(0.05, 0.55, 0.03, 0x3a2410, 0, 0.6, 0)); S.add(guitar);
    /* 床の上にも電球の飾り（点けっぱなし） */
    for (var li = 0; li < 10; li++) { var fb2 = new T.Mesh(new T.SphereGeometry(0.016, 8, 6), glowMat([0xffd27a, 0xff9ab8, 0x9fe0ff][li % 3])); fb2.position.set(-1.55 + li * 0.03, 3.02 - Math.sin(li / 9 * Math.PI) * 0.06, -0.8); S.add(fb2); }
    for (var lj = 0; lj < 10; lj++) { var fb3 = new T.Mesh(new T.SphereGeometry(0.016, 8, 6), glowMat([0xffd27a, 0xff9ab8, 0x9fe0ff][lj % 3])); fb3.position.set(1.02 + lj * 0.058, 3.02 - Math.sin(lj / 9 * Math.PI) * 0.06, -0.8); S.add(fb3); }

    /* 道具 */
    var self = this;
    this.items = {}; this.a = {};
    Object.keys(MODELS).forEach(function (id) {
      var M = MODELS[id], g = new T.Group();
      g.position.set(M.pos[0], M.pos[1], M.pos[2]);
      M.make(g, self);
      var inner = new T.Group(); inner.scale.setScalar(1 / K);
      while (g.children.length) inner.add(g.children[0]);
      g.add(inner);
      if (M.big) g.scale.setScalar(M.big);
      S.add(g); self.items[id] = g;
      self.a[id] = new T.Vector3();
    });

    /* 人：机に向かって座り、こちらには背中と横顔の後ろだけが見える（顔は見えない角度） */
    var hoodie = 0xe7a948, skin = 0xf3c9a8, hair = 0x1e1a2e, pants = 0x2f3b5c;
    var seat = this.seat = new T.Group(); seat.position.set(0.12, 0, -0.05); seat.rotation.y = -1.35; S.add(seat);
    seat.add(box(0.42, 0.05, 0.42, 0x3a2c55, 0, 0.62, 0));
        seat.add(cyl(0.025, 0.025, 0.6, 0x2a2040, 0, 0.3, 0));
    seat.add(cyl(0.22, 0.22, 0.03, 0x2a2040, 0, 0.02, 0, 5));
    var girl = new T.Group(); girl.position.set(-0.05, 0.65, 0); seat.add(girl);
    girl.add(box(0.4, 0.13, 0.3, pants, -0.15, 0.06, 0));
    girl.add(box(0.12, 0.5, 0.28, pants, -0.33, -0.23, 0));
    girl.add(box(0.18, 0.07, 0.28, 0xe9e3f2, -0.38, -0.5, 0));
    var torso = cyl(0.15, 0.19, 0.55, hoodie, 0.02, 0.36, 0, 20); torso.rotation.z = 0.12; girl.add(torso);
    var hood = ball(0.13, 0xd39436, 0.12, 0.6, 0); hood.scale.set(0.8, 0.6, 1.1); girl.add(hood);
    var head = this.head = new T.Group(); head.position.set(-0.03, 0.82, 0); girl.add(head);
    head.add(cyl(0.05, 0.05, 0.12, skin, 0.02, -0.15, 0));
    head.add(ball(0.15, skin, 0, 0, 0, { roughness: 0.7 }));
    var hm = ball(0.165, hair, 0.035, 0.03, 0, { roughness: 0.6 }); head.add(hm);
    head.add(cyl(0.17, 0.165, 0.2, hair, 0.05, -0.08, 0, 20));
    var hpC = 0xe45d7b;
    [1, -1].forEach(function (s) {
      var cup = cyl(0.068, 0.068, 0.05, hpC, 0.02, -0.01, s * 0.18, 20, { roughness: 0.4 }); cup.rotation.x = Math.PI / 2; head.add(cup);
    });
    var band = new T.Mesh(new T.TorusGeometry(0.19, 0.02, 8, 24, Math.PI), mat(hpC, { roughness: 0.4 }));
    band.rotation.y = Math.PI / 2; band.position.set(0.02, -0.01, 0); band.castShadow = true; head.add(band);
    this.arms = [];
    var selfArms = this.arms;
    [0.14, -0.14].forEach(function (z) {
      var arm = new T.Group(); arm.position.set(-0.02, 0.56, z); girl.add(arm);
      var up = cyl(0.045, 0.045, 0.3, hoodie, -0.07, -0.13, 0); up.rotation.z = -0.5; arm.add(up);
      var fore = new T.Group(); fore.position.set(-0.14, -0.2, 0); arm.add(fore);
      var lo = cyl(0.04, 0.04, 0.3, hoodie, -0.15, 0, 0); lo.rotation.z = Math.PI / 2; fore.add(lo);
      fore.add(ball(0.035, skin, -0.31, 0, 0));
      selfArms.push({ arm: arm, fore: fore });
    });

    
    this.v = new T.Vector3();
    /* 全部を部屋の箱に入れて縮める（奥の壁あたりを中心に） */
    var root = this.root = new T.Group();
    while (S.children.length) root.add(S.children[0]);
    root.scale.setScalar(K); root.position.set(0, 0, -0.8 * (1 - K));
    S.add(root);
  }

  GameScene.prototype.reset = function () {};

  /* s: { t, done, type, radioBeat, items: { id: {on,t,k} } } */
  GameScene.prototype.sync = function (s) {
    var self = this;
    /* 縦長の画面でも、部屋の幅（左右の棚まで）と高さ（天井の物から床の物まで）が収まるように引く */
    var asp = this.camera.aspect || 0.56, d = 5.6;
    var hh = Math.max(2.2, 1.45 / asp) * K;
    this.camera.fov = 2 * Math.atan(hh / d) * 180 / Math.PI;
    this.camera.position.set(-1.25 * K, 2.6 * K, d);
    this.camera.lookAt(0.05 * K, 2.1 * K, -0.5);
    this.root.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    Object.keys(MODELS).forEach(function (id) {
      var e = s.items[id] || { on: false, t: 0, k: 0 };
      MODELS[id].anim(self.items[id], e, self);
      var M = MODELS[id], g = self.items[id];
      self.a[id].set(g.position.x + M.a[0] / K, g.position.y + M.a[1] / K, g.position.z + M.a[2] / K);
      self.root.localToWorld(self.a[id]);
    });
    var radio = s.items.radio || {};
    this.head.position.y = 0.82 + (radio.on ? (radio.k % 2 ? 0.015 : 0) : Math.sin(s.t * 2) * 0.006);
    this.head.rotation.z = s.done ? 0.3 : 0;
    var tap = s.type * 0.03;
    this.arms.forEach(function (A, i) {
      if (s.done) { A.arm.rotation.z = -2.4; A.fore.rotation.z = 0.3; A.fore.position.y = -0.2; }
      else { A.arm.rotation.z = 0; A.fore.rotation.z = 0; A.fore.position.y = -0.2 + (i === (s.typeSide || 0) ? tap : 0); }
    });
    this.screenLight.intensity = 0.5 + s.type * 0.2;
  };

  GameScene.prototype.screen = function (v, W, H) {
    var p = this.v.copy(v).project(this.camera);
    return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H };
  };
  GameScene.prototype.anchor = function (id, W, H) { return this.screen(this.a[id], W, H); };
  GameScene.prototype.winRect = function (W, H) {
    this.root.updateMatrixWorld();
    var p = this.screen(this.root.localToWorld(this.win[0].clone()), W, H), q = this.screen(this.root.localToWorld(this.win[1].clone()), W, H);
    return { x: p.x, y: p.y, w: q.x - p.x, h: q.y - p.y };
  };
  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  GameScene.ITEMS = Object.keys(MODELS);
  global.GameScene = GameScene;
})(window);
