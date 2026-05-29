// 확장 아이콘 클릭 시 측면 패널 열기
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addToMemo",
    title: "📝 메모장에 추가",
    contexts: ["selection"]
  });
});

// 컨텍스트 메뉴 클릭 처리
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addToMemo" && info.selectionText) {
    // 선택된 텍스트를 storage에 저장 (sidepanel에서 읽어감)
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