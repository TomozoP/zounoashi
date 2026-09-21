/* 複数ファイルの反映に失敗したら、元の内容と置き場所へ戻す。 */
const fs = require('fs'), path = require('path');
module.exports = function(changes, move, write = fs.writeFileSync) {
  const before = changes.map(c => ({ file: c.file, data: fs.existsSync(c.file) ? fs.readFileSync(c.file) : null }));
  let moved = false;
  const created = [];
  try {
    for (const c of changes) {
      let dir = path.dirname(c.file), dirs = [];
      while (!fs.existsSync(dir)) { dirs.unshift(dir); dir = path.dirname(dir); }
      for (const d of dirs) { fs.mkdirSync(d); created.push(d); }
      write(c.file, c.data);
    }
    /* 移動は最後。一覧が指す先の書き出しが失敗しても下書きを保つ。 */
    if (move) { fs.renameSync(move.from, move.to); moved = true; }
  } catch (e) {
    if (moved) fs.renameSync(move.to, move.from);
    for (const b of before) {
      if (b.data === null) { if (fs.existsSync(b.file)) fs.unlinkSync(b.file); }
      else fs.writeFileSync(b.file, b.data);
    }
    created.reverse().forEach(d => { if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d); });
    throw e;
  }
};
