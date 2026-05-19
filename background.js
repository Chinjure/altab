const SWITCHER_ACTION = 'toggle-switcher';
const SWITCH_TAB_ACTION = 'switch-tab';
const GET_TABS_ACTION = 'get-tabs';

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-tab-switcher') return;

  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      action: SWITCHER_ACTION,
      tabs: sanitizeTabs(allTabs),
      activeTabId: activeTab.id
    });
  } catch {
    // Content script not available — try to inject it, then try each switchable tab
    for (const tab of allTabs) {
      if (tab.id === activeTab.id || !isSwitchableUrl(tab.url)) continue;

      await chrome.tabs.update(tab.id, { active: true });
      await sleep(300);

      // Try injecting content script + CSS in case it wasn't auto-injected
      // (e.g. extension was just installed on already-open tabs)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['overlay.css']
        });
      } catch {
        // Injection may fail on restricted pages; skip to next tab
      }

      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: SWITCHER_ACTION,
          tabs: sanitizeTabs(allTabs),
          activeTabId: activeTab.id
        });
        return;
      } catch {
        // Try next switchable tab
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === SWITCH_TAB_ACTION) {
    chrome.tabs.update(message.tabId, { active: true }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === GET_TABS_ACTION) {
    chrome.tabs.query({ currentWindow: true }).then((tabs) => {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([activeTab]) => {
        sendResponse({ tabs: sanitizeTabs(tabs), activeTabId: activeTab.id });
      });
    });
    return true;
  }
});

function sanitizeTabs(tabs) {
  return tabs.map(t => ({
    id: t.id,
    title: t.title || 'Untitled',
    url: t.url,
    favIconUrl: t.favIconUrl || '',
    index: t.index,
    active: t.active
  }));
}

function isSwitchableUrl(url) {
  return url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !url.startsWith('devtools://');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
