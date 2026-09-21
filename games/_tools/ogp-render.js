/* 書き込み前に共有用の本文を組み立てる。 */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
module.exports = function(g, html, img) {
  var url = "https://www.zounoashi.com/share/" + g.id + "/";
  var image = "https://www.zounoashi.com/" + img;
  var tags = '<!-- ゲームのOGP：道具で更新 -->\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:site_name" content="ゾウノアシゲームズ">\n' +
    '<meta property="og:title" content="' + esc(g.title) + '">\n' +
    '<meta property="og:url" content="' + url + '">\n' +
    '<meta property="og:image" content="' + esc(image) + '">\n' +
    '<meta property="og:image:alt" content="' + esc(g.title) + '">\n' +
    '<meta name="twitter:card" content="summary">\n' +
    '<meta name="twitter:title" content="' + esc(g.title) + '">\n' +
    '<meta name="twitter:image" content="' + esc(image) + '">\n' +
    '<!-- ゲームのOGPここまで -->';
  html = html.replace(/<!-- ゲームのOGP：道具で更新 -->[\s\S]*?<!-- ゲームのOGPここまで -->\r?\n?/g, "");
  if (!/<\/head>/i.test(html)) throw Error("</head> がありません");
  var target = "/#/game/" + encodeURIComponent(g.id);
  return { game: html.replace(/<\/head>/i, () => tags + "\n</head>"), share: '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n<title>' + esc(g.title) + '</title>\n' + tags + '\n</head>\n<body>\n<script>location.replace(' + JSON.stringify(target) + ' + location.search);</script>\n<noscript><a href="' + esc(target) + '">' + esc(g.title) + '</a></noscript>\n</body>\n</html>\n' };
};
