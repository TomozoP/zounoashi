/* メガネウォークの立体（three.js）。games/three-base.js の Z3 を土台にする。
   机の上を、つるを脚にしたメガネが歩く。動きはゲーム側（index.html）が決め、ここは見た目だけ。
   大きさは本物の10倍（つる14cm → 1.4）。メガネは +x の向きを向いて歩く。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var L = 1.4, HINGE_Y = 0.17, HALF = 0.7;     /* つるの長さ・枠の中心から蝶番まで・つるの間の半分 */

  function canvasTex(w, h, paint) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    paint(c.getContext("2d"), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces" }, camera: { fov: 40, near: 0.1, far: 80 } });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    sc.background = new T.Color(0xd9cfc2);
    sc.fog = new T.Fog(0xd9cfc2, 12, 30);
    Z3.lights(sc, { shadows: true, shadowSize: 6 });

    /* 机（木目）。カメラについて動かし、木目だけずらす */
    var wood = canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = "#a8774c"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        var y = Math.random() * h, a = 0.05 + Math.random() * 0.12;
        g.strokeStyle = "rgba(70,40,20," + a + ")"; g.lineWidth = 1 + Math.random() * 3;
        g.beginPath(); g.moveTo(0, y);
        for (var x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4);
        g.stroke();
      }
    });
    wood.wrapS = wood.wrapT = T.RepeatWrapping; wood.repeat.set(3, 2);
    this.wood = wood;
    var desk = this.desk = new T.Mesh(new T.PlaneGeometry(24, 14), Z3.std(0xffffff, { map: wood, roughness: 0.6 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; desk.position.z = -3;
    sc.add(desk);

    /* 奥に置いた定規（目盛りだけ、数字なし）。1cm ごと（10倍で0.1）の目盛り */
    var rulerTex = canvasTex(1024, 64, function (g, w, h) {
      g.fillStyle = "#eef0e6"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#333";
      for (var i = 0; i < 100; i++) {
        var x = i * w / 100, len = i % 10 === 0 ? 34 : i % 5 === 0 ? 24 : 14;
        g.fillRect(x, 0, 2, len);
      }
    });
    rulerTex.wrapS = T.RepeatWrapping; rulerTex.repeat.set(2.4, 1);
    this.rulerTex = rulerTex;
    var ruler = this.ruler = new T.Mesh(new T.BoxGeometry(24, 0.03, 0.6), [
      Z3.std(0xe6e8de), Z3.std(0xe6e8de), Z3.std(0xffffff, { map: rulerTex, roughness: 0.5 }), Z3.std(0xe6e8de), Z3.std(0xe6e8de), Z3.std(0xe6e8de)
    ]);
    ruler.position.set(0, 0.015, -1.6); ruler.receiveShadow = true;
    sc.add(ruler);

    this.buildGlasses();
    this.shardMeshes = [];
    var shardGeo = new T.BufferGeometry();
    shardGeo.setAttribute("position", new T.Float32BufferAttribute([0, 1, 0, -0.8, -0.6, 0, 0.9, -0.4, 0], 3));
    shardGeo.computeVertexNormals();
    this.shardGeo = shardGeo;
    this.shardMat = new T.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.75, side: T.DoubleSide });
    this.camX = 0;
  }

  GameScene.prototype.buildGlasses = function () {
    var sc = this.scene;
    var frameMat = Z3.std(0x1b1b1f, { roughness: 0.35 });          /* 黒いセル枠 */
    var lensMat = this.lensMat = new T.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.28 });
    var crack = this.crackMat = new T.MeshStandardMaterial({ roughness: 0.1, transparent: true, opacity: 0.85,
      map: canvasTex(256, 256, function (g, w, h) {
        g.fillStyle = "rgba(220,236,255,.35)"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 2.5;
        var cx = w * 0.45, cy = h * 0.55;
        for (var i = 0; i < 11; i++) {
          var a = i / 11 * 6.283 + Math.random() * 0.4, x = cx, y = cy;
          g.beginPath(); g.moveTo(x, y);
          for (var k = 0; k < 5; k++) { a += (Math.random() - 0.5) * 0.6; x += Math.cos(a) * 30; y += Math.sin(a) * 30; g.lineTo(x, y); }
          g.stroke();
        }
        for (var r = 25; r < 120; r += 32) { g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke(); }
      }) });
    this.crackMat.map.colorSpace = T.SRGBColorSpace;

    /* 横に傾けるための入れ物：立っている側の足を中心に回す */
    var root = this.root = new T.Group(); sc.add(root);
    var tilt = this.tilt = new T.Group(); root.add(tilt);

    /* 枠：蝶番から下がる。枠の正面は +x */
    var frame = this.frame = new T.Group(); tilt.add(frame);
    this.lenses = [];
    for (var s = -1; s <= 1; s += 2) {
      var rim = new T.Mesh(new T.TorusGeometry(0.25, 0.04, 10, 36), frameMat);
      rim.rotation.y = Math.PI / 2; rim.scale.set(1, 0.86, 1); rim.position.set(0.05, -HINGE_Y, s * 0.33);
      rim.castShadow = true; frame.add(rim);
      var lens = new T.Mesh(new T.CircleGeometry(0.25, 32), lensMat);
      lens.rotation.y = Math.PI / 2; lens.scale.set(1, 0.86, 1); lens.position.set(0.05, -HINGE_Y, s * 0.33);
      frame.add(lens); this.lenses.push(lens);
      /* つるとの継ぎ目（智） */
      var end = new T.Mesh(new T.BoxGeometry(0.12, 0.06, 0.12), frameMat);
      end.position.set(0.0, 0, s * (HALF - 0.05)); frame.add(end);
    }
    var bridge = new T.Mesh(new T.TorusGeometry(0.1, 0.03, 8, 16, Math.PI), frameMat);
    bridge.rotation.y = Math.PI / 2; bridge.position.set(0.05, -HINGE_Y + 0.06, 0); frame.add(bridge);

    /* つる2本：蝶番から下へ。先は耳にかける曲がり（足） */
    this.legs = [];
    for (var i = 0; i < 2; i++) {
      var g = new T.Group(); tilt.add(g);
      var bar = new T.Mesh(new T.BoxGeometry(0.05, L - 0.15, 0.04), frameMat);
      bar.position.y = -(L - 0.15) / 2; bar.castShadow = true; g.add(bar);
      var hook = new T.Mesh(new T.BoxGeometry(0.05, 0.3, 0.04), frameMat);
      hook.position.set(-0.07, -L + 0.06, 0); hook.rotation.z = -0.6; hook.castShadow = true; g.add(hook);
      g.position.z = i === 0 ? -HALF : HALF;
      this.legs.push(g);
    }
  };

  GameScene.prototype.reset = function () {};

  GameScene.prototype.sync = function (s) {
    var hip = s.hip, x = hip[0];
    this.camX = x;
    var cx = this.camX;
    this.camera.position.set(cx + 5.2, 3.0, 6.2);
    this.camera.lookAt(cx + 0.4, 0.6, 0);
    /* 机と定規はカメラについて動き、模様だけずらす */
    this.desk.position.x = cx; this.wood.offset.x = cx / 8;
    this.ruler.position.x = cx; this.rulerTex.offset.x = cx / 10;

    /* 横の傾き：立っている側のつるの足先を中心に回す */
    var stZ = s.roll >= 0 ? HALF : -HALF;
    this.root.position.set(0, 0, stZ);
    this.tilt.position.set(0, 0, -stZ);
    this.root.rotation.x = s.roll;

    this.frame.position.set(x, hip[1], 0);
    this.frame.rotation.z = s.beta;
    for (var i = 0; i < 2; i++) {
      var g = this.legs[i];
      g.position.x = x; g.position.y = hip[1];
      g.rotation.z = s.legs[i];
    }
    for (var k = 0; k < 2; k++) this.lenses[k].material = s.broken ? this.crackMat : this.lensMat;

    /* 破片 */
    while (this.shardMeshes.length < s.shards.length) {
      var m = new T.Mesh(this.shardGeo, this.shardMat); this.scene.add(m); this.shardMeshes.push(m);
    }
    for (var j = 0; j < this.shardMeshes.length; j++) {
      var mm = this.shardMeshes[j], p = s.shards[j];
      mm.visible = !!p;
      if (!p) continue;
      mm.position.set(p.x, p.y, p.z); mm.rotation.set(p.r, p.r * 0.7, p.r * 0.3); mm.scale.setScalar(p.s);
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
