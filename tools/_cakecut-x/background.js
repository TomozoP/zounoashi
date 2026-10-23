// Cake Cut から受け取った動画と文を預かり、X の投稿画面を開く。開いた画面が受け取ったら消す。
// 動画は一度に渡せる大きさ（64MB）に限りがあるので、切れ端に分けて預かる
chrome.runtime.onMessage.addListener((m, sender, send) => {
  const st = chrome.storage.local;
  if (m.type === 'start') { st.clear().then(() => st.set({ meta: m.meta })).then(() => send(true)); return true; }
  if (m.type === 'part') { st.set({ ['p' + m.i]: m.s }).then(() => send(true)); return true; }
  if (m.type === 'open') { chrome.tabs.create({ url: 'https://x.com/compose/post' }); return false; }
  if (m.type === 'take') { st.get('meta').then(r => send(r.meta || null)); return true; }
  if (m.type === 'get') { st.get('p' + m.i).then(r => send(r['p' + m.i] || '')); return true; }
  if (m.type === 'done') { st.clear(); return false; }
});
