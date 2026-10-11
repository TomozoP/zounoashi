/* 立体の場面（three.js）。games/three-base.js の Z3 を土台にする。
   ゲーム側（index.html）は scene3d() で取り出し、▼DRAW で sync(状態) と draw(ctx, W, H) を呼ぶ。
   ゲームの進行（当たり・点数・時間）はゲーム側に置き、ここは見た目だけにする。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  function GameScene() {
    T = global.THREE;
    /* finish: 仕上げ（コントラスト・周辺を暗く・粒子）。要らなければ外す */
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces" }, camera: { fov: 32 }, finish: true });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x20242c);
    Z3.lights(this.scene, { shadows: true, shadowSize: 8 });
    this.camera.position.set(0, 6, 12);
    this.camera.lookAt(0, 0, 0);

    /* ▼3D: ここに物を置く（見本は床と箱） */
    /* 床などの大きい板はカメラの後ろまで伸ばさない（クラウドの確認用ブラウザの描画では崩れて写る） */
    var floor = new T.Mesh(new T.PlaneGeometry(16, 16), Z3.std(0x8a7a66));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.scene.add(floor);
    this.box = new T.Mesh(new T.BoxGeometry(2, 2, 2), Z3.std(0xe8443a, { roughness: 0.5 }));
    this.box.position.y = 1; this.box.castShadow = true;
    this.scene.add(this.box);
  }

  /* もう一度のときに見た目を戻す */
  GameScene.prototype.reset = function () {
    this.box.rotation.set(0, 0, 0);
  };

  /* ゲームの状態を見た目に写す。s はゲーム側で決めた形でよい */
  GameScene.prototype.sync = function (s) {
    this.box.rotation.y = s.t;
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
