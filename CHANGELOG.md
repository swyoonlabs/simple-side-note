# Changelog

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
