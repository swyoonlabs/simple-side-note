const newBtn = document.getElementById('newBtn');
const saveBtn = document.getElementById('saveBtn');
const titleInput = document.getElementById('titleInput');

const savedList = document.getElementById('savedList');
const emptyState = document.getElementById('emptyState');

// Search elements
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearSearch');
const noResults = document.getElementById('noResults');
const sortSelect = document.getElementById('sortSelect');

// Confirm dialog elements
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

// ===== Settings =====
const DEFAULT_SETTINGS = {
  autoPreserveDraft: false, // silently keep unsaved editor content across sessions
  warnUnsaved: true,        // confirm before discarding unsaved changes
  confirmDelete: true,      // confirm before deleting a saved memo
  captureUrl: false         // append source URL when using "Add to Memo"
};
let settings = Object.assign({}, DEFAULT_SETTINGS);

const settingControls = {
  autoPreserveDraft: document.getElementById('setAutoPreserve'),
  warnUnsaved: document.getElementById('setWarnUnsaved'),
  confirmDelete: document.getElementById('setConfirmDelete'),
  captureUrl: document.getElementById('setCaptureUrl')
};

chrome.storage.local.get(['settings'], (result) => {
  settings = Object.assign({}, DEFAULT_SETTINGS, result.settings || {});
  Object.keys(settingControls).forEach((key) => {
    const el = settingControls[key];
    if (!el) return;
    el.checked = !!settings[key];
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      chrome.storage.local.set({ settings: settings });
    });
  });
});

// Initialize search UI - hide clear button initially
if (clearBtn) {
  clearBtn.classList.add('hidden');
}

// Track current editing memo ID (null = new memo)
let currentMemoId = null;
let currentSearchQuery = '';
let currentSort = 'recent';
let isDirty = false; // true when the editor has unsaved changes

// ===== Initialize Quill Editor =====
const SizeStyle = Quill.import('attributors/style/size');
SizeStyle.whitelist = ['20px', '26px', '34px'];
Quill.register(SizeStyle, true);

const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: 'Write your study notes here...',
  modules: {
    toolbar: false
  }
});

// ===== Font size buttons =====
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const size = btn.dataset.size;
    const current = quill.getFormat()['size'];
    if (current === size) {
      quill.format('size', false);
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    } else {
      quill.format('size', size);
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    quill.focus();
  });
});

quill.on('selection-change', (range) => {
  // range is null when the editor loses focus (e.g. clicking the title input).
  // Passing the range explicitly avoids getFormat() forcing focus back here.
  if (!range) return;
  const fmt = quill.getFormat(range);
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === fmt['size']);
  });
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === fmt['color']);
  });
});

// ===== Font color buttons =====
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.color;
    const current = quill.getFormat()['color'];
    if (current === color) {
      quill.format('color', false);
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    } else {
      quill.format('color', color);
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    quill.focus();
  });
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
chrome.storage.local.get(['studyMemo', 'studyMemoTitle', 'sortOrder', 'currentMemoId'], (result) => {
  if (result.studyMemo) {
    quill.root.innerHTML = result.studyMemo;
  }
  if (titleInput && result.studyMemoTitle) {
    titleInput.value = result.studyMemoTitle;
  }
  if (sortSelect && result.sortOrder) {
    currentSort = result.sortOrder;
    sortSelect.value = result.sortOrder;
  }
  if (typeof result.currentMemoId !== 'undefined') {
    currentMemoId = result.currentMemoId;
  }
  // Content restored from the last save = clean state
  isDirty = false;
  updateSaveState();
});

// Editing the title marks the memo as unsaved
if (titleInput) {
  titleInput.addEventListener('input', () => {
    isDirty = true;
    updateSaveState();
    if (settings.autoPreserveDraft) {
      chrome.storage.local.set({ studyMemoTitle: titleInput.value });
    }
  });
}

// Sort control
if (sortSelect) {
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    chrome.storage.local.set({ sortOrder: currentSort });
    renderSavedList();
  });
}

// ===== 2. Mark unsaved on text change (optionally preserve draft) =====
quill.on('text-change', () => {
  isDirty = true;
  updateSaveState();
  if (settings.autoPreserveDraft) {
    chrome.storage.local.set({ studyMemo: quill.root.innerHTML });
  }
});

// ===== 2b. Handle paste events (for images) =====
quill.root.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let item of items) {
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (event) => {
        const index = quill.getSelection().index;
        quill.insertEmbed(index, 'image', event.target.result);
        quill.setSelection(index + 1);
        // insertEmbed fires text-change → isDirty is set automatically
      };
      reader.readAsDataURL(file);
    }
  }
});

// ===== 3. Detect text added from context menu =====
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.memoEntries) {
    const entries = changes.memoEntries.newValue || [];
    if (entries.length > 0) {
      const oldEntries = changes.memoEntries.oldValue || [];
      const newItems = entries.slice(oldEntries.length);
      
      newItems.forEach((entry) => {
        const header = '📝 [' + entry.timestamp + ']';
        let block = '\n' + header + '\n' + entry.text + '\n';
        if (settings.captureUrl && entry.url) {
          block += '🔗 ' + entry.url + '\n';
        }
        quill.insertText(quill.getLength() - 1, block);
      });

      // insertText fires text-change → isDirty is set; user must Save to persist
      chrome.storage.local.remove('memoEntries');
    }
  }
});

// ===== 4. New memo =====
function startNewMemo() {
  quill.setContents([]);
  if (titleInput) titleInput.value = '';
  currentMemoId = null;
  isDirty = false;
  updateSaveState();
  chrome.storage.local.set({ studyMemo: '', studyMemoTitle: '', currentMemoId: null });
  chrome.storage.local.remove('memoEntries');
}

newBtn.addEventListener('click', () => {
  if (settings.warnUnsaved && isDirty && quill.getText().trim()) {
    showConfirm('Discard unsaved changes and start a new memo?', 'Discard').then((ok) => {
      if (ok) startNewMemo();
    });
  } else {
    startNewMemo();
  }
});

// ===== 4b. Save button =====
saveBtn.addEventListener('click', () => {
  if (!quill.getText().trim()) return; // nothing to save
  saveCurrentMemo(() => {
    isDirty = false;
    flashSaved();
    renderSavedList();
  });
});

// Reflect unsaved state on the Save button
function updateSaveState() {
  if (!saveBtn) return;
  saveBtn.textContent = isDirty ? '💾 Save •' : '💾 Save';
  saveBtn.classList.toggle('dirty', isDirty);
}

// Briefly confirm a successful save
function flashSaved() {
  if (!saveBtn) return;
  saveBtn.textContent = '✓ Saved';
  saveBtn.classList.remove('dirty');
  saveBtn.disabled = true;
  setTimeout(() => {
    saveBtn.disabled = false;
    updateSaveState();
  }, 1200);
}

// ===== Save helper =====
function saveCurrentMemo(callback) {
  const textContent = quill.getText().trim();
  if (!textContent) {
    if (callback) callback();
    return;
  }

  // Prefer the user-entered title; fall back to first line of content
  const typedTitle = titleInput ? titleInput.value.trim() : '';
  const title = typedTitle || textContent.split('\n')[0].substring(0, 50);

  chrome.storage.local.get(['savedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    const htmlContent = quill.root.innerHTML;

    const index = currentMemoId !== null
      ? savedMemos.findIndex(m => m.id === currentMemoId)
      : -1;

    if (index !== -1) {
      savedMemos[index].title = title;
      savedMemos[index].content = htmlContent;
      savedMemos[index].date = new Date().toLocaleString();
    } else {
      // New memo, or the tracked memo no longer exists (e.g. was deleted)
      const savedMemo = {
        id: Date.now(),
        title: title,
        content: htmlContent,
        date: new Date().toLocaleString(),
        pinned: false
      };
      currentMemoId = savedMemo.id;
      savedMemos.unshift(savedMemo);
    }

    chrome.storage.local.set({
      savedMemos: savedMemos,
      studyMemo: htmlContent,
      studyMemoTitle: title,
      currentMemoId: currentMemoId
    }, () => {
      if (callback) callback();
    });
  });
}

// ===== 6. Render saved list =====
function sortMemos(memos) {
  const sorted = memos.slice();
  sorted.sort((a, b) => {
    // Pinned memos always come first
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (currentSort === 'oldest') return a.id - b.id;
    if (currentSort === 'title') {
      return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    }
    // default: recent (newest id first)
    return b.id - a.id;
  });
  return sorted;
}

function renderSavedList() {
  chrome.storage.local.get(['savedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    savedList.innerHTML = '';

    // Filter memos based on search query, then sort (pinned first)
    const filteredMemos = sortMemos(savedMemos.filter(memo => memoMatchesQuery(memo, currentSearchQuery)));

    // Show/hide empty states
    if (savedMemos.length === 0) {
      emptyState.style.display = 'block';
      emptyState.textContent = 'No saved memos yet.';
      noResults.style.display = 'none';
    } else if (filteredMemos.length === 0) {
      emptyState.style.display = 'none';
      noResults.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      noResults.style.display = 'none';
    }

    filteredMemos.forEach((memo) => {
      const li = document.createElement('li');
      li.className = 'saved-item' + (memo.pinned ? ' pinned' : '');
      const pinPrefix = memo.pinned ? '📌 ' : '';
      li.innerHTML =
        '<div class="saved-item-title">' + pinPrefix + highlightSearchTerm(memo.title, currentSearchQuery) + '</div>' +
        '<div class="saved-item-date">' + escapeHtml(memo.date) + '</div>' +
        '<div class="saved-item-actions">' +
          '<button class="saved-item-pin" title="' + (memo.pinned ? 'Unpin' : 'Pin to top') + '">📌</button>' +
          '<button class="saved-item-md" title="Download as .md">📄</button>' +
          '<button class="saved-item-download" title="Download as .html">📥</button>' +
          '<button class="saved-item-delete" data-id="' + memo.id + '" title="Delete">✕</button>' +
        '</div>';

      // Click to load memo
      li.addEventListener('click', (e) => {
        if (e.target.closest('.saved-item-actions')) return;
        const doLoad = () => loadMemoIntoEditor(memo);
        if (settings.warnUnsaved && isDirty && quill.getText().trim() && memo.id !== currentMemoId) {
          showConfirm('Discard unsaved changes and open this memo?', 'Discard').then((ok) => {
            if (ok) doLoad();
          });
        } else {
          doLoad();
        }
      });

      // Pin toggle
      li.querySelector('.saved-item-pin').addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin(memo.id);
      });

      // Markdown download
      li.querySelector('.saved-item-md').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadMarkdown(memo);
      });

      // HTML download
      li.querySelector('.saved-item-download').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDocx(memo);
      });

      // Delete button
      li.querySelector('.saved-item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!settings.confirmDelete) {
          deleteSavedMemo(memo.id);
          return;
        }
        showConfirm('Delete this saved memo?', 'Delete').then((ok) => {
          if (ok) deleteSavedMemo(memo.id);
        });
      });

      savedList.appendChild(li);
    });
  });
}

// ===== 6a. Load a saved memo into the editor =====
function loadMemoIntoEditor(memo) {
  currentMemoId = memo.id;
  quill.root.innerHTML = memo.content;
  if (titleInput) titleInput.value = memo.title || '';
  isDirty = false;
  updateSaveState();
  chrome.storage.local.set({
    studyMemo: memo.content,
    studyMemoTitle: memo.title || '',
    currentMemoId: memo.id
  });
  // Switch to editor tab
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="editor"]').classList.add('active');
  document.getElementById('tab-editor').classList.add('active');
}

// ===== 6b. Toggle pin state =====
function togglePin(id) {
  chrome.storage.local.get(['savedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    const memo = savedMemos.find(m => m.id === id);
    if (memo) {
      memo.pinned = !memo.pinned;
      chrome.storage.local.set({ savedMemos: savedMemos }, renderSavedList);
    }
  });
}

// ===== 7. Delete a saved memo =====
function deleteSavedMemo(id) {
  chrome.storage.local.get(['savedMemos'], (result) => {
    const savedMemos = (result.savedMemos || []).filter(m => m.id !== id);
    chrome.storage.local.set({ savedMemos: savedMemos }, () => {
      // If the deleted memo was being edited, detach it so a later Save
      // creates a fresh entry instead of silently doing nothing.
      if (currentMemoId === id) {
        currentMemoId = null;
        chrome.storage.local.set({ currentMemoId: null });
      }
      renderSavedList();
    });
  });
}

// ===== 8. Download memo as .html file =====
function downloadDocx(memo) {
  const html = '<!DOCTYPE html>' +
    '<html lang="ko"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(memo.title) + '</title>' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; line-height: 1.6; padding: 40px; margin: 0; background: #fff; color: #202124; }' +
    'img { max-width: 100%; height: auto; margin: 10px 0; }' +
    'h1, h2, h3, h4, h5, h6 { margin-top: 16px; margin-bottom: 8px; }' +
    'p { margin: 0 0 8px 0; }' +
    '</style>' +
    '</head><body>' +
    '<h1>' + escapeHtml(memo.title) + '</h1>' +
    memo.content +
    '</body></html>';

  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = memo.title.replace(/[^a-zA-Z0-9가-힣\u4e00-\u9fff]/g, '_') + '.html';
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

// ===== 8b. Download memo as .md (Markdown) file =====
function htmlToMarkdown(html) {
  const container = document.createElement('div');
  container.innerHTML = html;

  // Convert inline formatting within a node to Markdown text
  function inline(node) {
    let out = '';
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        const inner = inline(child);
        if (tag === 'strong' || tag === 'b') out += '**' + inner + '**';
        else if (tag === 'em' || tag === 'i') out += '*' + inner + '*';
        else if (tag === 's' || tag === 'strike' || tag === 'del') out += '~~' + inner + '~~';
        else if (tag === 'code') out += '`' + inner + '`';
        else if (tag === 'a') out += '[' + inner + '](' + (child.getAttribute('href') || '') + ')';
        else if (tag === 'img') out += '![](' + (child.getAttribute('src') || '') + ')';
        else if (tag === 'br') out += '\n';
        else out += inner; // spans (color/size), u, etc. → keep text
      }
    });
    return out;
  }

  const lines = [];
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.trim();
      if (t) lines.push(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      lines.push('#'.repeat(Number(tag[1])) + ' ' + inline(node).trim());
    } else if (tag === 'ul' || tag === 'ol') {
      let n = 1;
      Array.from(node.children).forEach((li) => {
        if (li.tagName.toLowerCase() !== 'li') return;
        const listType = li.getAttribute('data-list');
        const inner = inline(li).trim();
        if (listType === 'bullet' || (tag === 'ul' && listType !== 'ordered')) {
          lines.push('- ' + inner);
        } else {
          lines.push((n++) + '. ' + inner);
        }
      });
    } else if (tag === 'blockquote') {
      lines.push('> ' + inline(node).trim());
    } else if (tag === 'img') {
      lines.push('![](' + (node.getAttribute('src') || '') + ')');
    } else {
      // <p>, <div>, or anything else → paragraph (may be blank)
      lines.push(inline(node).trim());
    }
  });

  return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function downloadMarkdown(memo) {
  const md = '# ' + memo.title + '\n\n' + htmlToMarkdown(memo.content) + '\n';
  const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = memo.title.replace(/[^a-zA-Z0-9가-힣一-鿿]/g, '_') + '.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== Custom themed confirm dialog =====
function showConfirm(message, okLabel) {
  return new Promise((resolve) => {
    if (!confirmOverlay) {
      resolve(window.confirm(message));
      return;
    }
    confirmMessage.textContent = message;
    confirmOk.textContent = okLabel || 'OK';
    confirmOverlay.classList.remove('hidden');

    const cleanup = () => {
      confirmOverlay.classList.add('hidden');
      confirmOk.onclick = null;
      confirmCancel.onclick = null;
      confirmOverlay.onclick = null;
    };
    confirmOk.onclick = () => { cleanup(); resolve(true); };
    confirmCancel.onclick = () => { cleanup(); resolve(false); };
    // Click outside the modal cancels
    confirmOverlay.onclick = (e) => {
      if (e.target === confirmOverlay) { cleanup(); resolve(false); }
    };
  });
}

// ===== Search functionality =====
// Search input event
if (searchInput) {
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value.trim();
    if (clearBtn) clearBtn.classList.toggle('hidden', !currentSearchQuery);
    renderSavedList();
  });
}

// Clear search button
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentSearchQuery = '';
    clearBtn.classList.add('hidden');
    renderSavedList();
  });
}

// Highlight search terms in text
function highlightSearchTerm(text, query) {
  if (!query) return escapeHtml(text);
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return escapeHtml(text).replace(regex, '<span class="search-highlight">$1</span>');
}

// Escape special regex characters
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check if memo matches search query
function memoMatchesQuery(memo, query) {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  const lowerTitle = memo.title.toLowerCase();
  const lowerContent = stripHtml(memo.content).toLowerCase();
  return lowerTitle.includes(lowerQuery) || lowerContent.includes(lowerQuery);
}

// Strip HTML tags for search
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

