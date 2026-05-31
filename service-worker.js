// Open side panel when extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addToMemo",
    title: "📝 Add to Memo",
    contexts: ["selection"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addToMemo" && info.selectionText) {
    // Store selected text in storage (read by sidepanel)
    const timestamp = new Date().toLocaleString();
    const entry = {
      text: info.selectionText.trim(),
      timestamp: timestamp,
      url: info.pageUrl || (tab && tab.url) || ''
    };
    
    chrome.storage.local.get(['memoEntries'], (result) => {
      const entries = result.memoEntries || [];
      entries.push(entry);
      chrome.storage.local.set({ memoEntries: entries });
    });
  }
});