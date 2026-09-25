/* 偏県の偏見ロボを3Dで描く（three.js）。
   ゲームの2D画面に貼り込めるよう、小さい画面に描いてその canvas を返す。録画にもそのまま映る。

   var robo = window.HenkenRobo3D.create(px);   px は描く大きさ（正方形、画素）
   robo.render({ t, talking, mouth, happy, blink, shake, party, hue }) → canvas
     t       … 秒
     talking … 話している（口をぱくぱく）
     happy   … 目を細める（当てられた・クリア）
     blink   … まばたき中
     shake   … 首を振る量（-1〜1。外されたとき）
     party   … クリア（虹色に光って踊る）
     hue     … party のときの色相（0〜360）

   形: 角の丸い箱の頭に、顔の画面とアンテナ。目は「偏」「見」の光る字、口は横長の光る棒。耳と首はない。 */
(function (global) {
  "use strict";

  /* 角の丸い箱。細かく割った箱の点を、内側の箱から半径 r だけ外へ押し出して作る */
  function roundedBox(THREE, w, h, d, r, seg) {
    var g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    var p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
    var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
      v.sub(c).normalize().multiplyScalar(r).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  function create(px) {
    var THREE = global.THREE;
    var canvas = document.createElement("canvas");
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(px, px, false);
    renderer.setClearColor(0x000000, 0);
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    camera.position.set(0, 0.25, 6.2);
    camera.lookAt(0, 0.12, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa0b8, 1.6));
    var key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2.5, 3, 4);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xbfe6ff, 1.2);
    rim.position.set(3, 1, -2);
    scene.add(rim);

    var robo = new THREE.Group();
    scene.add(robo);

    /* 頭 */
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0xc9d5df, metalness: 0.18, roughness: 0.34 });
    var head = new THREE.Mesh(roundedBox(THREE, 1.5, 1.32, 1.15, 0.26, 8), bodyMat);
    robo.add(head);

    /* 顔の画面。字と口は小さい2D画面に描いて貼る（毎コマ描き直す） */
    var faceCv = document.createElement("canvas");
    faceCv.width = 256; faceCv.height = 208;
    var fx = faceCv.getContext("2d");
    var faceTex = new THREE.CanvasTexture(faceCv);
    if ("colorSpace" in faceTex) faceTex.colorSpace = THREE.SRGBColorSpace;
    var face = new THREE.Mesh(roundedBox(THREE, 1.16, 0.98, 0.08, 0.035, 4),
      new THREE.MeshStandardMaterial({ color: 0x23364a, metalness: 0.1, roughness: 0.25 }));
    face.position.set(0, -0.02, 0.56);
    robo.add(face);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
    screen.position.set(0, -0.02, 0.605);
    robo.add(screen);

    /* アンテナ */
    var stemMat = new THREE.MeshStandardMaterial({ color: 0x16202e, metalness: 0.4, roughness: 0.5 });
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 12), stemMat);
    stem.position.set(0, 0.82, 0);
    robo.add(stem);
    var ballMat = new THREE.MeshStandardMaterial({ color: 0xe2504c, emissive: 0xe2504c, emissiveIntensity: 0.35, roughness: 0.3 });
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), ballMat);
    ball.position.set(0, 1.02, 0);
    robo.add(ball);

    function drawFace(o) {
      fx.clearRect(0, 0, 256, 208);
      fx.fillStyle = "#7df0ff";
      fx.shadowColor = "rgba(125,240,255,.9)";
      fx.shadowBlur = 14;
      fx.font = "900 64px sans-serif";
      fx.textAlign = "center";
      fx.textBaseline = "middle";
      var sy = o.happy ? 0.5 : o.blink ? 0.15 : 1;
      ["偏", "見"].forEach(function (ch, k) {
        fx.save();
        fx.translate(k ? 180 : 76, o.happy ? 70 : 80);
        fx.scale(1, sy);
        fx.fillText(ch, 0, 2);
        fx.restore();
      });
      var open = o.talking ? 8 + (o.mouth || 0) * 26 : 8;
      fx.beginPath();
      var x = 78, y = 150 - open / 2, w = 100, r = 4;
      fx.moveTo(x + r, y); fx.arcTo(x + w, y, x + w, y + open, r); fx.arcTo(x + w, y + open, x, y + open, r);
      fx.arcTo(x, y + open, x, y, r); fx.arcTo(x, y, x + w, y, r); fx.closePath();
      fx.fill();
      faceTex.needsUpdate = true;
    }

    var tmp = new THREE.Color();
    return {
      canvas: canvas,
      render: function (o) {
        var t = o.t || 0;
        drawFace(o);
        /* ふだんは少し首をかしげて左右を見回す。3Dの厚みが見えるように */
        var yaw = Math.sin(t * 0.9) * 0.38, pitch = -0.08 + Math.sin(t * 1.7) * 0.04, roll = Math.sin(t * 0.7) * 0.05;
        var y = Math.sin(t * 2) * 0.03;
        if (o.talking) { pitch += Math.sin(t * 18) * 0.05; y += Math.sin(t * 18) * 0.015; }
        if (o.shake) yaw += o.shake * 0.5;
        if (o.party) {
          /* 頭で円を描くようにノリノリで揺れる（顔が見えるよう、回りきらずに左右へ首を振る） */
          var ph = t * Math.PI * 4;
          yaw = Math.sin(ph / 2) * 0.7;
          roll = Math.sin(ph) * 0.3;
          pitch = Math.cos(ph) * 0.18;
          y = Math.abs(Math.sin(ph)) * 0.12;
          robo.position.x = Math.cos(ph) * 0.12;
        } else robo.position.x = 0;
        robo.rotation.set(pitch, yaw, roll, "YXZ");
        robo.position.y = y;
        if (o.party) {
          tmp.setHSL((o.hue || 0) / 360, 0.9, 0.62);
          bodyMat.color.copy(tmp);
          bodyMat.emissive.copy(tmp);
          bodyMat.emissiveIntensity = 0.35;
          tmp.setHSL(((o.hue || 0) + 180) % 360 / 360, 1, 0.55);
          ballMat.color.copy(tmp); ballMat.emissive.copy(tmp); ballMat.emissiveIntensity = 0.9;
        } else {
          bodyMat.color.set(0xc9d5df);
          bodyMat.emissive.set(0x000000);
          var blinkBall = o.talking && Math.floor(t * 8) % 2;
          ballMat.color.set(blinkBall ? 0xff7a2f : 0xe2504c);
          ballMat.emissive.set(blinkBall ? 0xff7a2f : 0xe2504c);
          ballMat.emissiveIntensity = 0.35;
        }
        renderer.render(scene, camera);
        return canvas;
      }
    };
  }

  global.HenkenRobo3D = { create: create };
})(window);
