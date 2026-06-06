const newBtn = document.getElementById('newBtn');
const saveBtn = document.getElementById('saveBtn');
const savedList = document.getElementById('savedList');
const emptyState = document.getElementById('emptyState');

// Track current editing memo ID (null = new memo)
let currentMemoId = null;

// ===== Initialize Quill Editor =====
const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: 'Write your study notes here...',
  modules: {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['clean']
    ]
  }
});

// ===== Theme switching =====
function applyTheme(theme) {
  document.body.className = 'theme-' + theme;
  document.querySelectorAll('.theme-circle').forEach(c => c.classList.remove('active'));
  document.querySelector('.theme-circle[data-theme="' + theme + '"]').classList.add('active');
  chrome.storage.local.set({ theme: theme });
}

document.querySelectorAll('.theme-circle').forEach(circle => {
  circle.addEventListener('click', () => {
    applyTheme(circle.dataset.theme);
  });
});

// Load saved theme
chrome.storage.local.get(['theme'], (result) => {
  applyTheme(result.theme || 'light');
});

// Load version from manifest
const versionInfo = document.getElementById('versionInfo');
if (versionInfo) {
  const manifest = chrome.runtime.getManifest();
  versionInfo.textContent = 'Version ' + manifest.version;
}

// ===== Tab switching =====
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'saved') {
      renderSavedList();
    }
  });
});

// ===== 1. Load saved memo (initialize) =====
chrome.storage.local.get(['studyMemo'], (result) => {
  if (result.studyMemo) {
    quill.root.innerHTML = result.studyMemo;
  }
});

// ===== 2. Real-time auto-save on text change =====
quill.on('text-change', () => {
  const content = quill.root.innerHTML;
  chrome.storage.local.set({ studyMemo: content });
});

// ===== 3. Detect text added from context menu =====
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.memoEntries) {
    const entries = changes.memoEntries.newValue || [];
    if (entries.length > 0) {
      const oldEntries = changes.memoEntries.oldValue || [];
      const newItems = entries.slice(oldEntries.length);
      
      const editorEl = quill.root;
      newItems.forEach((entry) => {
        const header = '📝 [' + entry.timestamp + ']';
        quill.insertText(quill.getLength() - 1, '\n' + header + '\n' + entry.text + '\n');
      });
      
      chrome.storage.local.set({ studyMemo: quill.root.innerHTML });
      chrome.storage.local.remove('memoEntries');
    }
  }
});

// ===== 4. New memo =====
newBtn.addEventListener('click', () => {
  const textContent = quill.getText().trim();
  if (textContent && !confirm('Start a new memo? Current unsaved content will be cleared.')) {
    return;
  }
  quill.setContents([]);
  chrome.storage.local.set({ studyMemo: '' });
  chrome.storage.local.remove('memoEntries');
  currentMemoId = null; // Reset to new memo mode
});

// ===== 5. Save current memo to saved list (update if exists, insert if new) =====
saveBtn.addEventListener('click', () => {
  const textContent = quill.getText().trim();
  if (!textContent) return;

  const title = textContent.split('\n')[0].substring(0, 50);

  chrome.storage.local.get(['savedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    const htmlContent = quill.root.innerHTML;

    if (currentMemoId !== null) {
      // Update existing memo
      const index = savedMemos.findIndex(m => m.id === currentMemoId);
      if (index !== -1) {
        savedMemos[index].title = title;
        savedMemos[index].content = htmlContent;
        savedMemos[index].date = new Date().toLocaleString();
      }
    } else {
      // Create new memo
      const savedMemo = {
        id: Date.now(),
        title: title,
        content: htmlContent,
        date: new Date().toLocaleString()
      };
      currentMemoId = savedMemo.id;
      savedMemos.unshift(savedMemo);
    }

    chrome.storage.local.set({ savedMemos: savedMemos });
  });
});

// ===== 6. Render saved list =====
function renderSavedList() {
  chrome.storage.local.get(['savedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    savedList.innerHTML = '';
    emptyState.style.display = savedMemos.length === 0 ? 'block' : 'none';

    savedMemos.forEach((memo) => {
      const li = document.createElement('li');
      li.className = 'saved-item';
      li.innerHTML = 
        '<div class="saved-item-title">' + escapeHtml(memo.title) + '</div>' +
        '<div class="saved-item-date">' + escapeHtml(memo.date) + '</div>' +
        '<div class="saved-item-actions">' +
          '<button class="saved-item-download" title="Download as .doc">📥</button>' +
          '<button class="saved-item-delete" data-id="' + memo.id + '" title="Delete">✕</button>' +
        '</div>';
      
      // Click to load memo
      li.addEventListener('click', (e) => {
        if (e.target.closest('.saved-item-actions')) return;
        currentMemoId = memo.id; // Track which memo is being edited
        quill.root.innerHTML = memo.content;
        chrome.storage.local.set({ studyMemo: memo.content });
        // Switch to editor tab
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="editor"]').classList.add('active');
        document.getElementById('tab-editor').classList.add('active');
      });

      // Download button
      li.querySelector('.saved-item-download').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDocx(memo);
      });

      // Delete button
      li.querySelector('.saved-item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this saved memo?')) {
          deleteSavedMemo(memo.id);
        }
      });

      savedList.appendChild(li);
    });
  });
}

// ===== 7. Delete a saved memo =====
function deleteSavedMemo(id) {
  chrome.storage.local.get(['savedMemos'], (result) => {
    const savedMemos = (result.savedMemos || []).filter(m => m.id !== id);
    chrome.storage.local.set({ savedMemos: savedMemos }, () => {
      // If the deleted memo was being edited, reset to new memo mode
      if (currentMemoId === id) {
        currentMemoId = null;
      }
      renderSavedList();
    });
  });
}

// ===== 8. Download memo as .doc file =====
function downloadDocx(memo) {
  // Use HTML content directly for rich formatting in Word
  const html = '<!DOCTYPE html>' +
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><title>' + escapeHtml(memo.title) + '</title>' +
    '<style>body{font-family:Calibri,sans-serif;font-size:14px;line-height:1.6;padding:20px;} p{margin:0 0 8px 0;} h1,h2,h3{margin:12px 0 6px 0;}</style>' +
    '</head><body>' + memo.content + '</body></html>';

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = memo.title.replace(/[^a-zA-Z0-9가-힣\u4e00-\u9fff]/g, '_') + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper: escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}