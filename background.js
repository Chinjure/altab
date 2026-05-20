const SWITCHER_ACTION = 'toggle-switcher';
const SWITCH_TAB_ACTION = 'switch-tab';
const GET_TABS_ACTION = 'get-tabs';

let previousTabId = null;
let activeTabId = null;
let mruOrder = [];

// Initialize state on service worker start
chrome.tabs.query({ currentWindow: true }).then((tabs) => {
  const activeTab = tabs.find(t => t.active);
  if (activeTab) {
    activeTabId = activeTab.id;
    mruOrder = [activeTab.id, ...tabs.filter(t => t.id !== activeTab.id).map(t => t.id)];
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  const prev = activeTabId;
  previousTabId = prev;
  activeTabId = tabId;

  // MRU: move new active to front, previous active right after it
  mruOrder = mruOrder.filter(id => id !== tabId);
  if (prev != null) {
    mruOrder = mruOrder.filter(id => id !== prev);
  }
  mruOrder.unshift(tabId);
  if (prev != null) {
    mruOrder.splice(1, 0, prev);
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id && !mruOrder.includes(tab.id)) {
    mruOrder.push(tab.id);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mruOrder = mruOrder.filter(id => id !== tabId);
  if (previousTabId === tabId) previousTabId = null;
  if (activeTabId === tabId) activeTabId = null;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-tab-switcher') return;

  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabs = orderByMru(sanitizeTabs(allTabs));

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

  // Active tab is a system page — find the most recently used switchable tab
  for (const tab of tabs) {
    if (tab.id === activeTab.id || !isSwitchableUrl(tab.url)) continue;

    // Try to inject scripts; ignore failure (they may already be present)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['overlay.css']
      });
    } catch { /* script may already be injected, proceed */ }

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

  // No switchable tab exists — open a blank tab to host the overlay
  try {
    const hostTab = await chrome.tabs.create({ url: 'about:blank', active: true });
    await sleep(300);
    await chrome.scripting.executeScript({
      target: { tabId: hostTab.id },
      files: ['content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: hostTab.id },
      files: ['overlay.css']
    });
    // Re-query: MRU order changed when host tab was activated, new tab list includes host
    const updatedAll = await chrome.tabs.query({ currentWindow: true });
    const updatedTabs = orderByMru(sanitizeTabs(updatedAll));
    await sleep(150);
    await chrome.tabs.sendMessage(hostTab.id, {
      action: SWITCHER_ACTION,
      tabs: updatedTabs,
      activeTabId: activeTab.id
    });
  } catch { /* give up */ }
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
          tabs: orderByMru(sanitizeTabs(tabs)),
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

function orderByMru(tabs) {
  const tabMap = new Map(tabs.map(t => [t.id, t]));
  const ordered = [];

  for (const id of mruOrder) {
    const tab = tabMap.get(id);
    if (tab) {
      ordered.push(tab);
      tabMap.delete(id);
    }
  }

  // Tabs not yet in MRU go at the end and get added
  for (const [id, tab] of tabMap) {
    ordered.push(tab);
    mruOrder.push(id);
  }

  return ordered;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
