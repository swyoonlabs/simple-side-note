// Add selected text to memo via context menu
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addSelectedText') {
    const selectedText = window.getSelection().toString();
    if (selectedText) {
      chrome.storage.local.get(['memoEntries'], (result) => {
        const entries = result.memoEntries || [];
        entries.push({
          text: selectedText,
          timestamp: new Date().toLocaleString()
        });
        chrome.storage.local.set({ memoEntries: entries });
      });
    }
  }
});
