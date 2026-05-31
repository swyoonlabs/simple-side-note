const memoArea = document.getElementById('memo');
const status = document.getElementById('status');
const dropZone = document.getElementById('dropZone');
const clearBtn = document.getElementById('clearBtn');

// 1. Load saved memo (initialize)
chrome.storage.local.get(['studyMemo'], (result) => {
  if (result.studyMemo) {
    memoArea.value = result.studyMemo;
    status.textContent = "Status: Previous memo loaded.";
  }
});

// 2. Real-time auto-save on input
memoArea.addEventListener('input', () => {
  const content = memoArea.value;
  chrome.storage.local.set({ studyMemo: content }, () => {
    status.textContent = "Status: Saving...";
    setTimeout(() => { status.textContent = "Status: All changes auto-saved"; }, 1000);
  });
});

// 3. Drag and drop - get text
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  
  const text = e.dataTransfer.getData('text/plain');
  if (text && text.trim()) {
    const timestamp = new Date().toLocaleString();
    const entry = '\n📌 [' + timestamp + ']\n' + text.trim() + '\n';
    memoArea.value += entry;
    
    chrome.storage.local.set({ studyMemo: memoArea.value }, () => {
      status.textContent = "Status: Dropped text saved.";
      setTimeout(() => { status.textContent = "Status: All changes auto-saved"; }, 2000);
    });
  }
});

// 4. Detect text added from context menu
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.memoEntries) {
    const entries = changes.memoEntries.newValue || [];
    if (entries.length > 0) {
      const oldEntries = changes.memoEntries.oldValue || [];
      const newItems = entries.slice(oldEntries.length);
      
      newItems.forEach((entry) => {
        const header = '\n📝 [' + entry.timestamp + ']\n';
        memoArea.value += header + entry.text + '\n';
      });
      
      chrome.storage.local.set({ studyMemo: memoArea.value }, () => {
        status.textContent = "Status: " + newItems.length + " item(s) added.";
        setTimeout(() => { status.textContent = "Status: All changes auto-saved"; }, 3000);
      });
      
      chrome.storage.local.remove('memoEntries');
    }
  }
});

// 5. Clear all memos
clearBtn.addEventListener('click', () => {
  if (memoArea.value && confirm('Are you sure you want to clear all memos?')) {
    memoArea.value = '';
    chrome.storage.local.set({ studyMemo: '' });
    chrome.storage.local.remove('memoEntries');
    status.textContent = "Status: All memos cleared.";
  }
});