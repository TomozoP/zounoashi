// Cake Cut に「拡張が入っている」ことを知らせ、投稿ボタンから来た中身を預け先へ渡す
document.documentElement.dataset.zxExt = '1';
window.addEventListener('message', e => {
  if (e.source !== window || !e.data || e.data.zx !== 'post') return;
  chrome.runtime.sendMessage({ type: 'post', data: e.data.payload });
});
