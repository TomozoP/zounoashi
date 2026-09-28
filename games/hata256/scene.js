/* 256色旗揚げの舞台。
   校庭に2人。奥の人がこちらを向いて指示を出し、手前の人は背中を見せて両手に旗を持つ。
   本体から渡された腕の上げ具合・旗の色・口の開き具合を描くだけ。 */
var ZHataScene = (function () {
  'use strict';

  var T;
  var INK = 0x16202e;

  function mat(color, rough) {
    return new T.MeshStandardMaterial({ color: color, roughness: rough == null ? .8 : rough });
  }
  function capsule(r, len, m) {
    var mesh = new T.Mesh(new T.CapsuleGeometry(r, len, 6, 12), m);
    return mesh;
  }

  /* 人ひとり。facing が 1 ならこちら向き（顔あり）、-1 なら背中向き。
     腕は肩の関節ごとに回す。arm.rotation.z が 0 で真下 */
  function person(o) {
    var g = new T.Group();
    var skin = mat(0xf1c7a4), shirt = mat(o.shirt), pants = mat(o.pants), hair = mat(0x1d1a1a, .9), shoe = mat(0x2b2b2b);
    [-1, 1].forEach(function (s) {
      var leg = capsule(.085, .62, pants); leg.position.set(s * .11, .47, 0); g.add(leg);
      var foot = new T.Mesh(new T.BoxGeometry(.13, .08, .26), shoe); foot.position.set(s * .11, .04, .05 * o.facing); g.add(foot);
    });
    var body = capsule(.2, .42, shirt); body.position.y = 1.12; body.scale.z = .72; g.add(body);
    var neck = new T.Mesh(new T.CylinderGeometry(.055, .06, .12, 10), skin); neck.position.y = 1.46; g.add(neck);
    var head = new T.Mesh(new T.SphereGeometry(.16, 24, 16), skin); head.position.y = 1.62; head.scale.set(.95, 1.05, 1); g.add(head);
    /* 髪。背中向きの人は後ろ頭がほぼ髪 */
    var hairTop = new T.Mesh(new T.SphereGeometry(.168, 24, 16, 0, Math.PI * 2, 0, Math.PI * .55), hair);
    hairTop.position.y = 1.635; hairTop.rotation.x = -.35 * o.facing; g.add(hairTop);
    var back = new T.Mesh(new T.SphereGeometry(.165, 20, 14, 0, Math.PI), hair);
    back.position.set(0, 1.6, -.012 * o.facing); back.rotation.y = o.facing > 0 ? Math.PI : 0; g.add(back);
    var mouth = null;
    if (o.facing > 0) {
      var eyeM = mat(0x1d1a1a, .5);
      [-1, 1].forEach(function (s) {
        var eye = new T.Mesh(new T.SphereGeometry(.018, 10, 8), eyeM); eye.position.set(s * .055, 1.64, .148); g.add(eye);
      });
      mouth = new T.Mesh(new T.SphereGeometry(.03, 12, 8), mat(0x7a2323, .6));
      mouth.position.set(0, 1.55, .15); mouth.scale.set(1.2, .2, .5); g.add(mouth);
    }
    var arms = [-1, 1].map(function (s) {
      var pivot = new T.Group(); pivot.position.set(s * .27, 1.38, 0); g.add(pivot);
      var upper = capsule(.062, .5, shirt); upper.position.y = -.3; pivot.add(upper);
      var hand = new T.Mesh(new T.SphereGeometry(.068, 14, 10), skin); hand.position.y = -.62; pivot.add(hand);
      return { pivot: pivot, side: s, hand: hand };
    });
    return { group: g, arms: arms, mouth: mouth, head: head };
  }

  /* 旗。棒は手から腕の先へ伸び、布は棒の外側にたなびく */
  function flag(parentArm) {
    var g = new T.Group();
    g.position.y = -.62;
    parentArm.pivot.add(g);
    var pole = new T.Mesh(new T.CylinderGeometry(.013, .013, .66, 8), mat(0xd8c6a0, .6));
    pole.position.y = -.22; g.add(pole);
    var knob = new T.Mesh(new T.SphereGeometry(.024, 10, 8), mat(0xe9d9b2, .5)); knob.position.y = -.56; g.add(knob);
    var geo = new T.PlaneGeometry(.42, .3, 10, 4);
    geo.translate(.21, 0, 0);
    var cloth = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }));
    var edge = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: INK }));
    var holder = new T.Group();
    holder.position.y = -.38;                        /* 棒の先寄りに、布の一辺を棒に沿わせる */
    holder.scale.x = parentArm.side;                 /* 外側へ向ける */
    holder.add(cloth); holder.add(edge);
    g.add(holder);
    return { group: g, cloth: cloth, edge: edge, base: geo.attributes.position.array.slice(), holder: holder };
  }

  function Scene() {
    T = THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x9fd3f0);
    this.scene.fog = new T.Fog(0x9fd3f0, 18, 60);
    this.camera = new T.PerspectiveCamera(46, 540 / 960, .1, 200);

    this.scene.add(new T.HemisphereLight(0xeaf6ff, 0x9c8a6a, 1.6));
    var sun = new T.DirectionalLight(0xffffff, 1.8);
    sun.position.set(3, 8, 5);
    this.scene.add(sun);

    var ground = new T.Mesh(new T.PlaneGeometry(200, 200), mat(0xcdb68c, 1));
    ground.rotation.x = -Math.PI / 2; this.scene.add(ground);
    /* 校庭の白線と、遠くの植え込み */
    var lineM = new T.MeshBasicMaterial({ color: 0xf4f1e8 });
    [-2.2, -8.5].forEach(function (z) {
      var l = new T.Mesh(new T.PlaneGeometry(14, .08), lineM); l.rotation.x = -Math.PI / 2; l.position.set(0, .005, z); this.scene.add(l);
    }, this);
    var bushM = mat(0x3f7d3a, 1);
    for (var i = -8; i <= 8; i++) {
      var b = new T.Mesh(new T.SphereGeometry(1.3, 12, 10), bushM);
      b.position.set(i * 2.1, .5, -26 - (i % 2) * .6); b.scale.y = .8; this.scene.add(b);
    }
    var soft = new T.Mesh(new T.CircleGeometry(.42, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .16 }));

    this.caller = person({ shirt: 0xd8423a, pants: 0x2d3a55, facing: 1 });
    this.caller.group.position.set(0, 0, -4.2);
    this.scene.add(this.caller.group);
    this.player = person({ shirt: 0xf6f6f2, pants: 0x28406e, facing: -1 });
    this.scene.add(this.player.group);
    [this.caller.group, this.player.group].forEach(function (g) {
      var s = soft.clone(); s.rotation.x = -Math.PI / 2; s.position.set(g.position.x, .006, g.position.z); this.scene.add(s);
    }, this);
    /* 手前の人の腕：画面の左が arms[0]、右が arms[1] */
    this.flags = this.player.arms.map(flag);
    this.w = 540; this.h = 960;
  }

  Scene.prototype.resize = function (w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    /* 縦長の画面ほど少し引いて、2人と旗が収まるようにする */
    var tall = Math.max(0, Math.min(1, (h / w - 1.45) / .9));
    this.camera.fov = 42 + tall * 12;
    this.camera.position.set(0, 3.0, 5.6);
    this.camera.lookAt(0, 1.2, -2.2);
    this.camera.updateProjectionMatrix();
  };

  /* 腕の角度。p=0 で下げた（少し外へ開く）、p=1 で上げた（斜め上） */
  function armAngle(side, p) {
    var down = .45, up = 2.5;
    return side * (down + (up - down) * p);
  }

  Scene.prototype.draw = function (ctx, W, H, s) {
    var t = s.t;
    for (var i = 0; i < 2; i++) {
      var arm = this.player.arms[i], f = this.flags[i];
      arm.pivot.rotation.z = armAngle(arm.side, s.arms[i]);
      arm.pivot.rotation.x = -.18;
      f.cloth.material.color.set(s.colors[i]);
      /* 持ち替え：布が棒のまわりを1回転する */
      f.holder.rotation.y = s.pop[i] * Math.PI * 2;
      /* 布のはためき */
      var pos = f.cloth.geometry.attributes.position, a = pos.array, b = f.base;
      for (var k = 0; k < a.length; k += 3) {
        var u = b[k] / .42;
        a[k + 2] = Math.sin(t * 9 + u * 5 + i) * .05 * u;
      }
      pos.needsUpdate = true;
      f.cloth.visible = f.edge.visible = !(s.blink === i && Math.floor(t * 8) % 2);
    }
    /* 奥の人。しゃべっている間は口が開き、両手を口に添える（どちらの旗かは手で教えない） */
    var c = this.caller;
    if (c.mouth) c.mouth.scale.y = .2 + 1.1 * s.talk * (.5 + .5 * Math.sin(t * 38));
    c.arms.forEach(function (arm) {
      arm.pivot.rotation.z = arm.side * (.18 - .5 * s.talk);
      arm.pivot.rotation.x = -1.9 * s.talk;
    });
    c.head.rotation.x = -.06 * s.talk;
    this.player.group.position.x = s.shake ? Math.sin(t * 70) * .03 * s.shake : 0;

    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  };

  /* 世界の点を画面の座標へ */
  Scene.prototype.project = function (x, y, z, W, H) {
    var v = new T.Vector3(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };
  Scene.prototype.callerHead = function (W, H) {
    return this.project(0, 1.9, -4.2, W, H);
  };

  return Scene;
})();
