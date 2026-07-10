# Changelog

## [1.2.0] - 2026-07-10

### New Features
- **Full backup & restore** — New **Backup & Restore** section in Settings. **📤 Export all** saves every memo (title, content, pin, date) to a dated JSON file; **📥 Import** merges a backup back in. Import only ever *adds* — it never deletes existing memos, skips exact duplicates so re-importing is safe, and reassigns colliding ids to keep storage intact.
- **Keyboard shortcuts** — **⌘/Ctrl+S** saves the current memo and **⌘/Ctrl+F** jumps to the saved-memo search. The modifier matches the OS (⌘ on macOS, Ctrl elsewhere) and the shortcut hint shows in each control's tooltip. Toggle the whole feature on/off in Settings.

### Improvements
- **OS-native system fonts** — The UI and editor now use the platform system font (SF on macOS, Segoe UI on Windows) instead of a Windows-only stack, matching the look of exported files.
- **Save-failure awareness** — Importing checks `chrome.runtime.lastError`, so a failed write (e.g. storage quota) reports an error instead of silently appearing to succeed.

### Bug Fixes
- Fixed: color-button tooltips were in Korean while the rest of the UI is English — now Black / Red / Blue.

---

## [1.1.0] - 2026-07-04

### New Features
- **Explicit Save button** — Replaced silent auto-save with a dedicated **💾 Save** button. The button shows a "•" when there are unsaved changes and briefly confirms with "✓ Saved".
- **Custom memo titles** — Added a title field in the editor. Leave it empty to auto-generate the title from the first line.
- **Pin & sort saved memos** — Pin favorites to the top (📌) and sort the saved list by Newest / Oldest / Title.
- **Markdown export** — Download any memo as `.md` (📄) in addition to HTML (📥).
- **Settings tab** — New ⚙️ tab to toggle: auto-preserve draft, unsaved-change warnings, delete confirmation, and appending the source URL on capture.
- **Themed confirm dialog** — Replaced the native browser confirm with a styled, theme-aware modal.

### Improvements
- **Draft & editing state persist across sessions** — The current memo id is remembered so re-opening the panel continues editing the same memo instead of creating a duplicate.
- **Unsaved-change protection** — Starting a new memo or opening another one warns before discarding unsaved edits (configurable).

### Bug Fixes
- Fixed: clicking the title field (or search box) would bounce focus back into the editor.
- Fixed: saving after deleting the memo being edited no longer silently fails — it creates a fresh entry.

### Housekeeping
- Removed the unused `<all_urls>` content script (`content.js`) and dead code, reducing permissions and Web Store review surface.

---

## [1.0.2] - 2026-06-13

### New Features
- **Font size buttons** — Replaced the Quill dropdown toolbar with three dedicated buttons: `Large` (20px), `Larger` (26px), and `Huge` (34px). Clicking an active button returns text to the default size.
- **Font color buttons** — Added three color-coded circle buttons (Black / Red / Blue) for quick text coloring. Clicking an active button removes the color.
- **Auto-save on New** — Clicking the **New** button now automatically saves the current memo before clearing the editor. No more confirmation dialogs or accidental data loss.

### Improvements
- **Larger default font size** — Editor base font size increased from 14px to 18px for more comfortable reading and writing.
- **Simplified toolbar** — Removed the full Quill toolbar (headers, bold, italic, lists, color pickers). The editor is now cleaner with only the essential custom controls above it.
- **Single action button** — Removed the separate Save button. The New button handles saving and starting fresh in one step.
- **About tab refresh** — Added a full feature list, Developer Blog link, and Privacy Policy link to the About tab.

### Bug Fixes
- Fixed: editing a saved memo and clicking New would discard unsaved changes without saving them back to the memo list.

---

## [1.0.1] - 2026

### New Features
- Replaced plain textarea with **Quill rich text editor** for formatted note-taking.
- Added **Light / Dark / Warm** themes.
- Expanded privacy policy documentation.

---

## [1.0.0] - Initial Release

- Browser sidebar memo pad with auto-save.
- Right-click any selected text on a webpage → **Add to Memo**.
- Save, organize, and export memos as Word (`.doc`).
- Chrome Web Store release.
