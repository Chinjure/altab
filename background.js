const SWITCHER_ACTION = 'toggle-switcher';
const SWITCH_TAB_ACTION = 'switch-tab';
const GET_TABS_ACTION = 'get-tabs';

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-tab-switcher') return;

  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabs = sanitizeTabs(allTabs);

  // Fast path: active tab already has content script
  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      action: SWITCHER_ACTION,
      tabs,
      activeTabId: activeTab.id
    });
    return;
  } catch { /* inject below */ }

  // Active tab is a normal page but missing content script — inject directly
  if (isSwitchableUrl(activeTab.url)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: activeTab.id },
        files: ['overlay.css']
      });
      await sleep(150);
      await chrome.tabs.sendMessage(activeTab.id, {
        action: SWITCHER_ACTION,
        tabs,
        activeTabId: activeTab.id
      });
      return;
    } catch { /* fall through to other tabs */ }
  }

  // Active tab is a system page — find another switchable tab
  for (const tab of allTabs) {
    if (tab.id === activeTab.id || !isSwitchableUrl(tab.url)) continue;

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
      continue;
    }

    await chrome.tabs.update(tab.id, { active: true });
    await sleep(150);

    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: SWITCHER_ACTION,
        tabs,
        activeTabId: activeTab.id
      });
      return;
    } catch { /* try next */ }
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
        sendResponse({
          tabs: sanitizeTabs(tabs),
          activeTabId: activeTab.id
        });
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
