// X の投稿画面で、預かった動画と文を入れる。投稿ボタンは押さない（自分で確かめて押す）
const wait = (find, ms = 60000) => new Promise((ok, ng) => {
  const end = Date.now() + ms;
  (function look() { const el = find(); if (el) return ok(el); if (Date.now() > end) return ng(new Error('見つかりません')); setTimeout(look, 200); })();
});
const sleep = ms => new Promise(ok => setTimeout(ok, ms));
const box = n => { const el = document.querySelector('[data-testid="tweetTextarea_' + n + '"]'); return el && (el.isContentEditable ? el : el.querySelector('[contenteditable="true"]')); };
// 文字の入力欄には貼り付けとして入れる（直接打ち込む形だと消えたり二重になったりした）
async function write(n, text) {
  const el = await wait(() => box(n));
  el.focus();
  await sleep(300);
  if (el.textContent.trim()) return;           // もう入っていれば入れない
  const dt = new DataTransfer(); dt.setData('text/plain', text);
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}
async function fill(p) {
  const [first, second] = p.texts;
  // 先に動画を付ける（文を先に入れると、付けたときに文が消えた）
  const bin = atob(p.data.split(',')[1]), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const input = await wait(() => document.querySelector('input[data-testid="fileInput"]'));
  const dt = new DataTransfer(); dt.items.add(new File([bytes], p.name, { type: p.type }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(1500);
  if (first) await write(0, first);
  if (second) {
    // 「＋」は動画の処理が終わるまで押せないので、押せるようになるまで待つ
    const add = await wait(() => { const b = document.querySelector('[data-testid="addButton"]'); return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' ? b : null; }, 180000);
    add.click();
    await write(1, second);
  }
}
if (location.pathname.startsWith('/compose/post')) {
  chrome.runtime.sendMessage({ type: 'take' }, p => {
    if (p) fill(p).catch(e => alert('Cake Cut → X：うまく入れられませんでした（' + e.message + '）'));
  });
}
