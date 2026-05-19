# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Chrome extension (Manifest V3) that provides an Alt+Tab-style overlay for switching between browser tabs. Press `Alt+Q` to open a full-screen tab switcher, navigate with Tab/arrow keys, and release to jump to the selected tab.

## Build & test

This is a vanilla JS Chrome extension with no build step. To test:

1. Go to `chrome://extensions/`, enable "Developer mode"
2. Click "Load unpacked" and select this directory
3. Press `Alt+Q` on any page to test the tab switcher

No linter, formatter, or test framework is configured.

## Architecture

```
manifest.json          → declares permissions (tabs, activeTab), command binding, content script injection
background.js          → service worker: listens for Alt+Q command, queries tabs, relays messages
content.js             → injected into every page: builds and manages the overlay UI
overlay.css            → overlay styles (separate from host page, no CSS leakage)
```

**Communication flow:**

1. User presses `Alt+Q` → Chrome routes the `toggle-tab-switcher` command to `background.js`
2. Background queries all tabs in current window via `chrome.tabs.query`, sends them + active tab ID to the content script
3. Content script shows the overlay; if already visible, cycles to the next tab instead
4. When user confirms (Enter / release Alt or Q), content script sends `switch-tab` back to background
5. Background calls `chrome.tabs.update(tabId, { active: true })` to switch

**Edge case handling:**

- If the active tab is a `chrome://` / `chrome-extension://` / `devtools://` page, the content script won't be injected. Background falls back to switching to the next switchable tab, waits 200ms for content script injection, then retries the message.
- Guard `window.__altabInstalled` prevents the content script from injecting twice (e.g. on pages with iframes).
- Minimum visible time of 250ms prevents flicker-dismiss on very fast key releases.

**Key design decisions:**

- Overlay DOM is built dynamically on first use (`buildOverlay()`), uses prefixed IDs (`__altab-*`) to avoid collisions with host page elements.
- Fallback favicons are generated with `<canvas>` — a colored rounded rectangle with the first letter of the title, using a hash of the title to pick the hue.
- The content script uses an IIFE to avoid leaking variables into the host page scope.
