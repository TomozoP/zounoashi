/* 待機中の最初のタップだけを受け取り、本編へ流さずに開始する。
   開始条件・音・演出・キー操作は各ゲームが担当する。 */
(function () {
  "use strict";
  window.zStartTap = function (waiting, start) {
    var pointer = null;
    function down(e) {
      if (!waiting() || e.isPrimary === false || e.button > 0 || pointer !== null) return;
      pointer = e.pointerId;
      e.stopImmediatePropagation();
    }
    function up(e) {
      if (pointer === null || pointer !== e.pointerId) return;
      pointer = null;
      if (!waiting()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      start(e);
    }
    function cancel(e) { if (pointer === e.pointerId) pointer = null; }
    function clear() { pointer = null; }
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", clear);
    return function () {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", clear);
      clear();
    };
  };
})();
