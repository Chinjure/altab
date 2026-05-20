# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Chrome extension (Manifest V3) that provides a Windows Alt+Tab-style overlay for switching between browser tabs. Press `Alt+Q` to open a full-screen tab switcher showing tabs in MRU (most-recently-used) order, navigate with Tab/arrow keys, and release to jump to the selected tab.

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
2. Background queries all tabs, orders them by MRU via `orderByMru()`, sends them + active tab ID to the content script
3. Content script shows the overlay with initial selection on the previous tab (index 1 in MRU order); if already visible, refreshes tab data and cycles to the next tab instead
4. When user confirms (Enter / release Alt or Q), content script sends `switch-tab` back to background
5. Background calls `chrome.tabs.update(tabId, { active: true })` to switch, and `onActivated` updates the MRU order accordingly

**MRU ordering (background.js):**

- `mruOrder` array tracks tab IDs sorted by recency; index 0 is always the active tab
- `onActivated`: moves the activated tab to index 0, places the previously-active tab at index 1
- `onCreated`: new tabs are appended to the end of the MRU list
- `onRemoved`: closed tabs are removed from MRU
- `orderByMru()` reorders the sanitized tab list to match MRU before sending to content script

**Edge case handling:**

- If the active tab is a `chrome://` / `chrome-extension://` / `devtools://` page, the content script won't be injected. Background falls back to finding the most recently used switchable tab (iterating tabs in MRU order), switches to it, injects content script there, and opens the overlay. If a tab already has the content script, injection errors are ignored.
- If no switchable tab exists at all, background creates a blank `about:blank` tab as a host for the overlay, then re-queries tabs so the MRU-ordered list is up to date.
- When the overlay is already open but tab data is stale (e.g. user switched tabs via the tab strip then returned via fallback), the content script refreshes its tab list from the incoming message and re-renders. If the overlay DOM exists but was hidden (tab was backgrounded), it shows fresh.
- Guard `window.__altabInstalled` prevents the content script from injecting twice (e.g. on pages with iframes).

**Key design decisions:**

- Overlay DOM is built dynamically on first use (`buildOverlay()`), uses prefixed IDs (`__altab-*`) to avoid collisions with host page elements.
- Fallback favicons are generated with `<canvas>` — a colored rounded rectangle with the first letter of the title, using a hash of the title to pick the hue.
- The content script uses an IIFE to avoid leaking variables into the host page scope.
