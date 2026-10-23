// Cake Cut に「拡張が入っている」ことを知らせ、投稿ボタンから来た中身を切れ端に分けて預け先へ渡す
document.documentElement.dataset.zxExt = '1';
const PART = 8 * 1024 * 1024;
window.addEventListener('message', async e => {
  if (e.source !== window || !e.data || e.data.zx !== 'post') return;
  const p = e.data.payload, data = p.data.slice(p.data.indexOf(',') + 1), n = Math.ceil(data.length / PART);
  await chrome.runtime.sendMessage({ type: 'start', meta: { texts: p.texts, name: p.name, type: p.type, n } });
  for (let i = 0; i < n; i++) await chrome.runtime.sendMessage({ type: 'part', i, s: data.slice(i * PART, (i + 1) * PART) });
  chrome.runtime.sendMessage({ type: 'open' });
});
