# 📝 Simple Side Note

A simple and elegant notepad that lives in your Chrome browser sidebar. Quickly jot down notes, save important memos, and capture text from any webpage — all without leaving your current tab.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Version](https://img.shields.io/badge/Version-1.0-brightgreen)

## ✨ Features

- **Sidebar Notepad** — Opens directly in Chrome's side panel, always accessible while browsing
- **Auto-Save** — Your memo is saved automatically as you type
- **Capture from Web Pages** — Select text on any webpage, right-click and choose "Add to Memo" to quickly append it
- **Save & Manage Memos** — Save multiple memos, browse them in a list, and load them back into the editor
- **Export to Word** — Download any saved memo as a `.doc` file
- **3 Themes** — Light, Dark, and Warm themes to suit your preference
- **Tab Interface** — Clean UI with Memo, Saved, and About tabs

## 📸 Screenshots

> _Screenshots coming soon_

## 🚀 Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/swyoonlabs/simple-side-note.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the cloned project folder

### From Chrome Web Store

> _Coming soon_

## 📖 How to Use

### Writing Memos
1. Click the extension icon in the toolbar or open the side panel
2. Start typing in the memo area — your text is auto-saved

### Capturing Text from Web Pages
1. Select any text on a webpage
2. Right-click and choose **"Add to Memo"**
3. The selected text is appended to your current memo with a timestamp

### Saving & Managing Memos
- Click **💾 Save** to save the current memo to your saved list
- Go to the **💾 Saved** tab to browse saved memos
- Click a saved memo to load it back into the editor
- Hover over a saved memo to reveal download (📥) and delete (✕) buttons

### Changing Themes
- Use the theme circles in the top-right corner of the tab bar:
  - 🔵 **Light** — Clean white theme
  - 🟣 **Dark** — Dark background for comfortable reading
  - 🟠 **Warm** — Warm paper-like tone

## 🛠️ Tech Stack

- **Chrome Extension Manifest V3**
- **Side Panel API** — Opens the notepad in Chrome's side panel
- **Context Menus API** — "Add to Memo" right-click action
- **Chrome Storage API** — Persistent local storage for memos and settings
- Vanilla HTML, CSS, JavaScript (no dependencies)

## 📁 Project Structure

```
simple-side-note/
├── manifest.json        # Extension manifest (Manifest V3)
├── sidepanel.html       # Side panel UI (HTML + CSS)
├── sidepanel.js         # Side panel logic (tabs, memo CRUD, themes)
├── service-worker.js    # Background service worker (context menu setup)
├── content.js           # Content script for text selection
├── icon_16.png          # 16x16 extension icon
├── icon_48.png          # 48x48 extension icon
├── icon_128.png         # 128x128 extension icon
└── README.md            # This file
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/swyoonlabs">swyoonlabs</a>
</p>