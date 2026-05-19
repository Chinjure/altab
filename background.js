const SWITCHER_ACTION = 'toggle-switcher';
const SWITCH_TAB_ACTION = 'switch-tab';
const GET_TABS_ACTION = 'get-tabs';

let switcherOpen = false;

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
    switcherOpen = !switcherOpen;
  } catch {
    // Content script not available (e.g. chrome:// pages)
    // Try the next switchable tab
    const switchable = allTabs.find(t => t.id !== activeTab.id && isSwitchableUrl(t.url));
    if (switchable) {
      await chrome.tabs.update(switchable.id, { active: true });
      await sleep(200);
      await chrome.tabs.sendMessage(switchable.id, {
        action: SWITCHER_ACTION,
        tabs: sanitizeTabs(allTabs),
        activeTabId: activeTab.id
      });
      switcherOpen = true;
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
