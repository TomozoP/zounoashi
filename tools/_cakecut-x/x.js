// X の投稿画面で、預かった文と動画を入れる。投稿ボタンは押さない（自分で確かめて押す）
const wait = (find, ms = 20000) => new Promise((ok, ng) => {
  const end = Date.now() + ms;
  (function look() { const el = find(); if (el) return ok(el); if (Date.now() > end) return ng(new Error('見つかりません')); setTimeout(look, 200); })();
});
const box = n => { const el = document.querySelector('[data-testid="tweetTextarea_' + n + '"]'); return el && (el.isContentEditable ? el : el.querySelector('[contenteditable="true"]')); };
async function write(n, text) {
  const el = await wait(() => box(n));
  el.focus();
  document.execCommand('insertText', false, text);
}
async function fill(p) {
  const [first, second] = p.texts;
  await write(0, first || '');
  const bin = atob(p.data.split(',')[1]), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const input = await wait(() => document.querySelector('input[data-testid="fileInput"]'));
  const dt = new DataTransfer(); dt.items.add(new File([bytes], p.name, { type: p.type }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  if (second) {
    (await wait(() => document.querySelector('[data-testid="addButton"]'))).click();
    await write(1, second);
  }
}
if (location.pathname.startsWith('/compose/post')) {
  chrome.runtime.sendMessage({ type: 'take' }, p => {
    if (p) fill(p).catch(e => alert('Cake Cut → X：うまく入れられませんでした（' + e.message + '）'));
  });
}
