/* まだ公開しないゲームの、一覧への仮登録。

   このファイルは `_` で始まるフォルダの中にあるので GitHub Pages が公開しません。
   サイトの index.html は、localhost で開いたときだけこれを読みに行きます。
   つまり手元では一覧にカードが出て遊べて、公開サイトには何も出ません。

   公開するときは games/_wanko/README.md の手順どおりに、
   フォルダ名を games/wanko に戻して、下の1件を index.html の GAMES に移します
   （パスの _wanko を wanko に直すのを忘れずに）。 */
window.DRAFT_GAMES = [
  { type: "lab", tags: [], id: "wanko", title: "わんこボマー", year: 2026, date: "2026-09-11",
    plays: null, url: "", img: "games/_wanko/img/thumb.svg",
    play: "games/_wanko/index.html", full: true,
    catch: "次から次へと差し出される爆弾を、導火線が尽きる前に解除しつづける" }
];
