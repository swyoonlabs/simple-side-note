const memoArea = document.getElementById('memo');
const status = document.getElementById('status');
const dropZone = document.getElementById('dropZone');
const clearBtn = document.getElementById('clearBtn');

// 1. 저장된 메모 불러오기 (초기화)
chrome.storage.local.get(['studyMemo'], (result) => {
  if (result.studyMemo) {
    memoArea.value = result.studyMemo;
    status.textContent = "상태: 이전 메모를 불러왔습니다.";
  }
});

// 2. 입력할 때마다 실시간 자동 저장
memoArea.addEventListener('input', () => {
  const content = memoArea.value;
  chrome.storage.local.set({ studyMemo: content }, () => {
    status.textContent = "상태: 저장 중...";
    setTimeout(() => { status.textContent = "상태: 모든 변경사항이 자동 저장됨"; }, 1000);
  });
});

// 3. 드래그 앤 드롭 - 텍스트 가져오기
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
      status.textContent = "상태: 드롭된 텍스트가 저장되었습니다.";
      setTimeout(() => { status.textContent = "상태: 모든 변경사항이 자동 저장됨"; }, 2000);
    });
  }
});

// 4. 컨텍스트 메뉴에서 추가된 텍스트 감지
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
        status.textContent = "상태: " + newItems.length + "개 항목이 추가되었습니다.";
        setTimeout(() => { status.textContent = "상태: 모든 변경사항이 자동 저장됨"; }, 3000);
      });
      
      chrome.storage.local.remove('memoEntries');
    }
  }
});

// 5. 메모 전체 지우기
clearBtn.addEventListener('click', () => {
  if (memoArea.value && confirm('모든 메모를 지우시겠습니까?')) {
    memoArea.value = '';
    chrome.storage.local.set({ studyMemo: '' });
    chrome.storage.local.remove('memoEntries');
    status.textContent = "상태: 메모가 모두 지워졌습니다.";
  }
});