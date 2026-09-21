/* 最初の操作・中断後の操作から音声を再開する共通処理。
   音声の作成、効果音、操作の受け取り方は各ゲームが担当する。 */
(function () {
  "use strict";
  var unlocked = new WeakMap();
  window.zAudioResume = function (context, samples) {
    if (!context || context.state === "closed") return;
    if (context.state !== "running") {
      unlocked.set(context, false);
      try {
        var pending = context.resume();
        if (pending && pending.catch) pending.catch(function () {});
      } catch (e) {}
    }
    if (!unlocked.get(context)) {
      try {
        var warmup = context.createBufferSource();
        warmup.buffer = context.createBuffer(1, samples || 1, context.sampleRate);
        warmup.connect(context.destination);
        warmup.onended = function () {
          unlocked.set(context, context.state === "running");
          warmup.disconnect();
        };
        warmup.start(0);
      } catch (e) {}
    }
  };
})();
