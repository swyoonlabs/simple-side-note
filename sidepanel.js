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

// Backup / restore elements
const exportAllBtn = document.getElementById('exportAllBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const backupStatus = document.getElementById('backupStatus');

// Trash (recently deleted) elements
const trashSection = document.getElementById('trashSection');
const trashToggle = document.getElementById('trashToggle');
const trashHeaderLabel = document.getElementById('trashHeaderLabel');
const trashCaret = document.getElementById('trashCaret');
const trashBody = document.getElementById('trashBody');
const trashList = document.getElementById('trashList');
const emptyTrashBtn = document.getElementById('emptyTrashBtn');

// How long deleted memos stay recoverable in Trash before being purged.
const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Confirm dialog elements
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

// ===== Settings =====
const DEFAULT_SETTINGS = {
  autoPreserveDraft: false,  // silently keep unsaved editor content across sessions
  warnUnsaved: true,         // confirm before discarding unsaved changes
  confirmDelete: true,       // confirm before deleting a saved memo
  captureUrl: false,         // append source URL when using "Add to Memo"
  keyboardShortcuts: true,   // enable ⌘/Ctrl+S save & ⌘/Ctrl+F search shortcuts
  autoCleanupDays: 0         // auto-delete unpinned memos older than N days (0 = off)
};
let settings = Object.assign({}, DEFAULT_SETTINGS);

const settingControls = {
  autoPreserveDraft: document.getElementById('setAutoPreserve'),
  warnUnsaved: document.getElementById('setWarnUnsaved'),
  confirmDelete: document.getElementById('setConfirmDelete'),
  captureUrl: document.getElementById('setCaptureUrl'),
  keyboardShortcuts: document.getElementById('setKeyboardShortcuts')
};

// Auto-cleanup is a <select>, not a checkbox, so it's wired separately below.
const autoCleanupSelect = document.getElementById('setAutoCleanup');

chrome.storage.local.get(['settings'], (result) => {
  settings = Object.assign({}, DEFAULT_SETTINGS, result.settings || {});
  Object.keys(settingControls).forEach((key) => {
    const el = settingControls[key];
    if (!el) return;
    el.checked = !!settings[key];
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      chrome.storage.local.set({ settings: settings });
      updateShortcutLabels();
    });
  });
  updateShortcutLabels();

  if (autoCleanupSelect) {
    autoCleanupSelect.value = String(settings.autoCleanupDays || 0);
    autoCleanupSelect.addEventListener('change', () => {
      settings.autoCleanupDays = Number(autoCleanupSelect.value) || 0;
      chrome.storage.local.set({ settings: settings });
      // Apply immediately so the user sees the effect right after choosing.
      runAutoCleanup(renderSavedList);
    });
  }

  // Once per panel open, after settings are known: purge long-dead trash,
  // then move newly-expired memos into the trash.
  purgeExpiredTrash(() => runAutoCleanup());
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

// ===== OS detection (for native-feeling shortcut labels) =====
// userAgentData.platform is the modern signal; fall back to navigator.platform.
const isMac = /mac/i.test(
  (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
);
// On Mac the modifier reads as "⌘S", on Windows/Linux as "Ctrl+S".
const modLabel = isMac ? '⌘' : 'Ctrl+';

// Show the OS-appropriate shortcut as a tooltip when shortcuts are enabled,
// and drop the hint when the user turns them off (doesn't disturb the dirty-state label).
function updateShortcutLabels() {
  const on = settings.keyboardShortcuts;
  if (saveBtn) saveBtn.title = on ? 'Save (' + modLabel + 'S)' : 'Save';
  if (searchInput) searchInput.title = on ? 'Search saved memos (' + modLabel + 'F)' : 'Search saved memos';
}
updateShortcutLabels();

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
      // Purge long-dead trash, sweep expired memos into trash, then show the list
      purgeExpiredTrash(() => runAutoCleanup(renderSavedList));
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

// ===== 4c. Keyboard shortcuts =====
// ⌘S / Ctrl+S → save, ⌘F / Ctrl+F → jump to the saved-memo search.
// Match the modifier to the OS so Ctrl+S on Mac doesn't hijack the native ⌘S.
document.addEventListener('keydown', (e) => {
  if (!settings.keyboardShortcuts) return; // respect the Settings toggle
  const modActive = isMac ? e.metaKey : e.ctrlKey;
  if (!modActive || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === 's') {
    e.preventDefault();
    // Reuse the button's own click logic (empty-content guard, flash, re-render)
    saveBtn.click();
  } else if (key === 'f') {
    e.preventDefault();
    // Suppress the browser find bar; open the Saved tab and focus search instead
    const savedTab = document.querySelector('.tab-item[data-tab="saved"]');
    if (savedTab) savedTab.click();
    if (searchInput) searchInput.focus();
  }
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

    const now = Date.now();
    if (index !== -1) {
      savedMemos[index].title = title;
      savedMemos[index].content = htmlContent;
      savedMemos[index].date = new Date().toLocaleString();
      savedMemos[index].updatedAt = now; // last-touched time drives auto-cleanup age
    } else {
      // New memo, or the tracked memo no longer exists (e.g. was deleted)
      const savedMemo = {
        id: now,
        title: title,
        content: htmlContent,
        date: new Date().toLocaleString(),
        pinned: false,
        updatedAt: now
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
        showConfirm('Move this memo to Trash? You can restore it for 30 days.', 'Delete').then((ok) => {
          if (ok) deleteSavedMemo(memo.id);
        });
      });

      savedList.appendChild(li);
    });

    // Keep the Trash panel below the list in sync
    renderTrash();
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

// ===== 7. Delete a saved memo (moves it to Trash, not gone forever) =====
function deleteSavedMemo(id) {
  chrome.storage.local.get(['savedMemos', 'trashedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    const trashedMemos = result.trashedMemos || [];
    const memo = savedMemos.find(m => m.id === id);
    const remaining = savedMemos.filter(m => m.id !== id);
    // Keep a copy in Trash so an accidental delete can be undone.
    const newTrash = memo
      ? [Object.assign({}, memo, { trashedAt: Date.now() })].concat(trashedMemos)
      : trashedMemos;
    chrome.storage.local.set({ savedMemos: remaining, trashedMemos: newTrash }, () => {
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

// ===== 7b. Auto-cleanup of old memos =====
// Deletes unpinned memos whose last-touched time is older than the configured
// age. Pinned memos and the memo currently open in the editor are always kept,
// so the user can rely on 📌 as "keep this" and never lose what they're viewing.
function runAutoCleanup(callback) {
  const days = Number(settings.autoCleanupDays) || 0;
  if (!days) { if (callback) callback(); return; } // feature off
  const cutoff = Date.now() - days * DAY_MS;

  chrome.storage.local.get(['savedMemos', 'trashedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    const trashedMemos = result.trashedMemos || [];
    const now = Date.now();
    const kept = [];
    const expired = [];
    savedMemos.forEach((m) => {
      if (m.pinned || m.id === currentMemoId) { kept.push(m); return; } // never auto-remove
      const ts = typeof m.updatedAt === 'number' ? m.updatedAt : m.id;   // fall back to creation time
      if (ts >= cutoff) kept.push(m);                                    // recent enough to keep
      else expired.push(Object.assign({}, m, { trashedAt: now }));       // → Trash, not gone
    });

    if (expired.length === 0) { if (callback) callback(); return; } // nothing expired

    chrome.storage.local.set(
      { savedMemos: kept, trashedMemos: expired.concat(trashedMemos) },
      () => { if (callback) callback(); }
    );
  });
}

// ===== 7c. Trash: purge, restore, delete-forever, empty, render =====

// Drop trashed memos older than the retention window (runs on panel/tab open).
function purgeExpiredTrash(callback) {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * DAY_MS;
  chrome.storage.local.get(['trashedMemos'], (result) => {
    const trashedMemos = result.trashedMemos || [];
    const kept = trashedMemos.filter(m => (m.trashedAt || 0) >= cutoff);
    if (kept.length === trashedMemos.length) { if (callback) callback(); return; }
    chrome.storage.local.set({ trashedMemos: kept }, () => { if (callback) callback(); });
  });
}

// Move a memo from Trash back into the saved list.
function restoreFromTrash(id) {
  chrome.storage.local.get(['savedMemos', 'trashedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    const trashedMemos = result.trashedMemos || [];
    const memo = trashedMemos.find(m => m.id === id);
    if (!memo) return;
    const newTrash = trashedMemos.filter(m => m.id !== id);
    const restored = Object.assign({}, memo);
    delete restored.trashedAt;
    if (savedMemos.some(m => m.id === restored.id)) restored.id = Date.now(); // avoid id clash
    savedMemos.unshift(restored);
    chrome.storage.local.set({ savedMemos: savedMemos, trashedMemos: newTrash }, () => {
      renderSavedList(); // also re-renders Trash
    });
  });
}

// Permanently remove a single memo from Trash.
function deleteFromTrashForever(id) {
  chrome.storage.local.get(['trashedMemos'], (result) => {
    const trashedMemos = (result.trashedMemos || []).filter(m => m.id !== id);
    chrome.storage.local.set({ trashedMemos: trashedMemos }, renderTrash);
  });
}

// Render the Trash panel; hides itself when empty.
function renderTrash() {
  if (!trashSection || !trashList) return;
  chrome.storage.local.get(['trashedMemos'], (result) => {
    const trashedMemos = result.trashedMemos || [];
    if (trashedMemos.length === 0) {
      trashSection.style.display = 'none';
      if (trashBody) trashBody.style.display = 'none';
      if (trashCaret) trashCaret.textContent = '▸';
      if (trashToggle) trashToggle.setAttribute('aria-expanded', 'false');
      return;
    }
    trashSection.style.display = 'block';
    if (trashHeaderLabel) trashHeaderLabel.textContent = '🗑️ Trash (' + trashedMemos.length + ')';

    trashList.innerHTML = '';
    trashedMemos
      .slice()
      .sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0)) // most recently deleted first
      .forEach((memo) => {
        const li = document.createElement('li');
        li.className = 'trash-item';
        li.innerHTML =
          '<div class="trash-item-title">' + escapeHtml(memo.title || 'Untitled') + '</div>' +
          '<div class="trash-item-actions">' +
            '<button class="trash-restore" title="Restore to saved memos">↩ Restore</button>' +
            '<button class="trash-delete" title="Delete permanently">✕</button>' +
          '</div>';
        li.querySelector('.trash-restore').addEventListener('click', () => restoreFromTrash(memo.id));
        li.querySelector('.trash-delete').addEventListener('click', () => {
          showConfirm('Permanently delete this memo? This cannot be undone.', 'Delete').then((ok) => {
            if (ok) deleteFromTrashForever(memo.id);
          });
        });
        trashList.appendChild(li);
      });
  });
}

// Expand / collapse the Trash panel
if (trashToggle && trashBody) {
  trashToggle.addEventListener('click', () => {
    const open = trashBody.style.display !== 'none';
    trashBody.style.display = open ? 'none' : 'block';
    if (trashCaret) trashCaret.textContent = open ? '▸' : '▾';
    trashToggle.setAttribute('aria-expanded', String(!open));
  });
}

// Empty the whole Trash at once
if (emptyTrashBtn) {
  emptyTrashBtn.addEventListener('click', () => {
    showConfirm('Empty the Trash? Everything in it will be permanently deleted.', 'Empty trash').then((ok) => {
      if (ok) chrome.storage.local.set({ trashedMemos: [] }, renderTrash);
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

// ===== Backup & Restore =====
function setBackupStatus(msg, isError) {
  if (!backupStatus) return;
  backupStatus.textContent = msg || '';
  backupStatus.style.color = isError ? 'var(--danger, #d93025)' : 'var(--text-secondary, #70757a)';
}

// Export every saved memo to a single JSON backup file
function exportAllMemos() {
  chrome.storage.local.get(['savedMemos'], (result) => {
    const savedMemos = result.savedMemos || [];
    if (savedMemos.length === 0) {
      setBackupStatus('No saved memos to export yet.', true);
      return;
    }
    const payload = {
      app: 'Simple Side Note',
      type: 'backup',
      version: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      memos: savedMemos
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'simple-side-note-backup-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupStatus('✓ Exported ' + savedMemos.length + ' memo' + (savedMemos.length === 1 ? '' : 's') + '.');
  });
}

// Coerce one raw entry from a backup file into a valid memo (or null to skip)
function normalizeImportedMemo(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const content = typeof raw.content === 'string' ? raw.content : '';
  if (!content && !(typeof raw.title === 'string' && raw.title.trim())) return null; // empty junk
  const title = (typeof raw.title === 'string' && raw.title.trim())
    ? raw.title
    : (stripHtml(content).split('\n')[0] || 'Untitled').substring(0, 50);
  return {
    id: typeof raw.id === 'number' ? raw.id : fallbackId,
    title: title,
    content: content,
    date: typeof raw.date === 'string' ? raw.date : new Date().toLocaleString(),
    pinned: !!raw.pinned
  };
}

// Merge a backup file into the existing memos. Never deletes; skips exact
// duplicates (same title + content) so re-importing is safe.
function importMemosFromFile(file) {
  const reader = new FileReader();
  reader.onerror = () => setBackupStatus('⚠ Could not read the file.', true);
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch (err) {
      setBackupStatus('⚠ Could not import — the file is not valid JSON.', true);
      return;
    }
    const rawMemos = Array.isArray(data)
      ? data
      : (data && Array.isArray(data.memos) ? data.memos : null);
    if (!rawMemos) {
      setBackupStatus('⚠ This file is not a Simple Side Note backup.', true);
      return;
    }

    chrome.storage.local.get(['savedMemos'], (result) => {
      const existing = result.savedMemos || [];
      const existingIds = new Set(existing.map(m => m.id));
      const existingKeys = new Set(existing.map(m => (m.title || '') + '::' + m.content));

      const idBase = Date.now();
      const toAdd = [];
      rawMemos.forEach((raw, i) => {
        const memo = normalizeImportedMemo(raw, idBase + i);
        if (!memo) return;
        const key = (memo.title || '') + '::' + memo.content;
        if (existingKeys.has(key)) return;        // already have this exact memo
        existingKeys.add(key);
        if (existingIds.has(memo.id)) memo.id = idBase + i; // keep ids unique
        existingIds.add(memo.id);
        toAdd.push(memo);
      });

      if (toAdd.length === 0) {
        setBackupStatus('Nothing new to import — those memos are already here.');
        return;
      }

      const merged = toAdd.concat(existing);
      chrome.storage.local.set({ savedMemos: merged }, () => {
        if (chrome.runtime.lastError) {
          setBackupStatus('⚠ Import failed: ' + chrome.runtime.lastError.message, true);
          return;
        }
        setBackupStatus('✓ Imported ' + toAdd.length + ' memo' + (toAdd.length === 1 ? '' : 's') + '.');
        renderSavedList();
      });
    });
  };
  reader.readAsText(file);
}

if (exportAllBtn) exportAllBtn.addEventListener('click', exportAllMemos);
if (importBtn && importFile) {
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files && importFile.files[0];
    if (file) importMemosFromFile(file);
    importFile.value = ''; // let the user re-select the same file later
  });
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

