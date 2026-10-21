// Cake Cut から受け取った動画と文を預かり、X の投稿画面を開く。開いた画面が受け取ったら消す
chrome.runtime.onMessage.addListener((m, sender, send) => {
  if (m.type === 'post') {
    chrome.storage.local.set({ pending: m.data }).then(() => chrome.tabs.create({ url: 'https://x.com/compose/post' }));
    return false;
  }
  if (m.type === 'take') {
    chrome.storage.local.get('pending').then(r => { chrome.storage.local.remove('pending'); send(r.pending || null); });
    return true;
  }
});
