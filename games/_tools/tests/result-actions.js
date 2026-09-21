/* 端末差・取消・失敗と、クリック権限を失わない呼び出しを確認する。 */
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync('games/result-actions.js', 'utf8');
function setup(mode) {
  const seen = { downloads: 0, shares: 0, results: [], revoked: 0 };
  const nav = { userAgent: mode === 'pc' ? 'PC' : 'iPhone', canShare: () => true };
  if (mode !== 'unsupported') nav.share = data => {
    seen.shares++; seen.data = data;
    if (mode === 'throw') throw Error('拒否');
    if (mode === 'cancel') return Promise.reject({ name: 'AbortError' });
    if (mode === 'failure') return Promise.reject(Error('拒否'));
    return Promise.resolve();
  };
  const zShare = opt => { seen.x = opt; };
  zShare.pageUrl = () => 'https://example.com/share/game/?r=abc';
  const win = { navigator: nav, zShare };
  const body = { appendChild(a) { a.parentNode = body; }, removeChild(a) { a.parentNode = null; } };
  vm.runInNewContext(source, { window: win, zShare, Promise, Blob, File, Uint8Array,
    atob, setTimeout: fn => fn(), URL: { createObjectURL: () => 'blob:image', revokeObjectURL: () => seen.revoked++ },
    document: { body, createElement: () => ({ style: {}, click() { seen.downloads++; seen.name = this.download; } }) }
  });
  return { actions: win.zResultActions, nav, seen, done: r => seen.results.push(r) };
}
(async function () {
  for (const mode of ['pc', 'mobile', 'unsupported', 'cancel', 'failure', 'throw']) {
    const { actions, seen, done } = setup(mode);
    actions.x({ text: '最新の結果', done });
    assert.equal(seen.x.native, false); assert.equal(seen.shares, 0);
    actions.saveImage({ canvas: { toDataURL: () => 'data:image/png;base64,UE5H' }, name: '結果.png', done });
    assert.equal(seen.shares, mode === 'pc' || mode === 'unsupported' ? 0 : 1, '共有は同期で始める');
    await Promise.resolve();
    const download = ['pc', 'unsupported', 'failure', 'throw'].includes(mode);
    assert.equal(seen.downloads, download ? 1 : 0);
    assert.equal(seen.revoked, seen.downloads);
    assert.equal(seen.results[0], mode === 'cancel' ? 'cancel' : download ? 'saved' : 'shared');
    if (seen.data) { assert.equal(seen.data.files[0].name, '結果.png'); assert.equal(seen.data.files[0].type, 'image/png'); }
  }
  for (const mode of ['pc', 'unsupported', 'cancel', 'failure', 'throw']) {
    const { actions, seen, done } = setup(mode);
    actions.share({ text: '結果', done });
    await Promise.resolve();
    assert.equal(seen.results[0], mode === 'unsupported' ? 'unsupported' : mode === 'cancel' ? 'cancel' : ['failure', 'throw'].includes(mode) ? 'error' : 'shared');
    assert(!seen.x); assert.equal(seen.downloads, 0);
    if (seen.data) assert.equal(seen.data.url, 'https://example.com/share/game/?r=abc');
  }
  const { actions, seen, done, nav } = setup('mobile');
  actions.saveImage({ blob: new Blob(['PNG'], { type: 'image/png' }), native: false, done });
  assert.equal(seen.downloads, 1); assert.equal(seen.shares, 0);
  nav.canShare = () => { throw Error('非対応'); };
  actions.saveImage({ blob: new Blob(['PNG']), done });
  assert.equal(seen.downloads, 2);
  actions.saveImage({ canvas: { toDataURL() { throw Error('別サイトの画像'); } }, done });
  assert.equal(seen.results.at(-1), 'error');
  let fired = 0, stopped = 0;
  const handlers = {}, button = { hidden: false, style: {}, addEventListener(n, fn) { handlers[n] = fn; }, removeEventListener(n) { delete handlers[n]; } };
  const unbind = actions.bind(button, () => fired++);
  const event = { stopPropagation() { stopped++; }, preventDefault() { throw Error('通常クリックを消した'); } };
  handlers.pointerdown(event); handlers.pointerup(event); assert.equal(fired, 0);
  handlers.click(event); assert.equal(fired, 1);
  handlers.keydown(event); handlers.keyup(event);
  actions.place(button, { x: 270, y: 480, w: 100, h: 80 }, 540, 960, false);
  handlers.click(event); assert.equal(fired, 1);
  actions.place(button, { x: 270, y: 480, w: 100, h: 80 }, 540, 960, true);
  assert.equal(button.style.left, '50%'); assert.equal(button.style.top, '50%');
  let writes = 0, hidden = false;
  const measured = { style: new Proxy({}, { set(o,k,v) { writes++; o[k]=parseFloat(v).toFixed(4)+'%'; return true; } }),
    get hidden() { return hidden; }, set hidden(v) { writes++; hidden=v; } };
  const box = { x: 270, y: 480, w: 100, h: 80 };
  actions.place(measured, box, 540, 960, true);
  assert.equal(writes, 4);
  writes=0;
  for(let i=0;i<600;i++)actions.place(measured, box, 540, 960, true);
  assert.equal(writes,0,'静止した600コマでは表示を書き直さない');
  actions.place(measured, box, 540, 1200, true);
  assert.equal(writes,2,'画面の高さが変われば縦位置と高さを更新');
  actions.place(measured, box, 540, 1200, false);
  assert(measured.hidden);
  actions.place(measured, box, 540, 1200, true);
  assert(!measured.hidden,'ゲーム側で隠したあとも再表示できる');
  measured.style.left='0%';writes=0;
  actions.place(measured, box, 540, 1200, true);
  assert.equal(writes,1,'別の処理で動かされた位置は戻す');
  button.disabled = true; handlers.click(event); assert.equal(fired, 1);
  unbind(); assert.equal(Object.keys(handlers).length, 0); assert(stopped > 0);
  console.log('X専用・総合共有・PNG保存・取消・失敗・通常クリック・解除を確認しました');
})().catch(e => { console.error(e); process.exitCode = 1; });
