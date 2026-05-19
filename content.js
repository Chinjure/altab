(function () {
  if (window.__altabInstalled) return;
  window.__altabInstalled = true;

  const OVERLAY_ID = '__altab-overlay';
  const CONTAINER_ID = '__altab-container';
  const SELECTED_TITLE_ID = '__altab-selected-title';
  const COUNTER_ID = '__altab-counter';

  let tabs = [];
  let selectedIdx = 0;
  let currentTabId = null;
  let isOpen = false;
  let pendingMode = false;
  let pendingTimer = null;
  let pendingPrevId = null;

  /* ── DOM ────────────────────────────────────────────────── */

  function buildOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const backdrop = document.createElement('div');
    backdrop.id = OVERLAY_ID;

    const titleBar = document.createElement('div');
    titleBar.id = SELECTED_TITLE_ID;

    const container = document.createElement('div');
    container.id = CONTAINER_ID;

    const counter = document.createElement('div');
    counter.id = COUNTER_ID;

    backdrop.appendChild(titleBar);
    backdrop.appendChild(container);
    backdrop.appendChild(counter);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) dismiss();
    });
  }

  function renderTabs() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    container.innerHTML = '';

    tabs.forEach((tab, i) => {
      const card = document.createElement('div');
      card.className = '__altab-card' + (i === selectedIdx ? ' selected' : '');
      card.setAttribute('data-idx', i);

      const img = document.createElement('img');
      img.className = '__altab-favicon';
      img.src = tab.favIconUrl || createFallbackFavicon(tab.title);
      img.onerror = () => { img.src = createFallbackFavicon(tab.title); };

      const title = document.createElement('span');
      title.className = '__altab-title';
      title.textContent = tab.title;

      card.appendChild(img);
      card.appendChild(title);

      card.addEventListener('click', () => {
        selectedIdx = i;
        commitAndClose();
      });

      container.appendChild(card);
    });

    updateSelectedInfo();
    scrollSelectedIntoView();
  }

  function updateSelectedInfo() {
    const titleEl = document.getElementById(SELECTED_TITLE_ID);
    const counterEl = document.getElementById(COUNTER_ID);
    const sel = tabs[selectedIdx];
    if (titleEl) titleEl.textContent = sel ? sel.title : '';
    if (counterEl) counterEl.textContent = `${selectedIdx + 1} / ${tabs.length}`;
  }

  function scrollSelectedIntoView() {
    const card = document.querySelector('.__altab-card.selected');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function updateSelection() {
    const prev = document.querySelector('.__altab-card.selected');
    if (prev) prev.classList.remove('selected');
    const next = document.querySelector(`.__altab-card[data-idx="${selectedIdx}"]`);
    if (next) {
      next.classList.add('selected');
      scrollSelectedIntoView();
    }
    updateSelectedInfo();
  }

  /* ── Show / Hide ────────────────────────────────────────── */

  function show(tabList, activeId) {
    if (!document.body) return;
    tabs = tabList;
    currentTabId = activeId;

    const curIdx = tabs.findIndex(t => t.id === activeId);
    selectedIdx = (curIdx + 1) % tabs.length;

    buildOverlay();
    renderTabs();

    document.getElementById(OVERLAY_ID).classList.add('visible');
    isOpen = true;
  }

  function dismiss() {
    if (!isOpen) return;
    document.getElementById(OVERLAY_ID)?.classList.remove('visible');
    isOpen = false;
    currentTabId = null;
  }

  function commitAndClose() {
    const target = tabs[selectedIdx];
    dismiss();
    if (target && target.id !== currentTabId) {
      chrome.runtime.sendMessage({ action: 'switch-tab', tabId: target.id });
    }
  }

  function cycle(delta) {
    if (!isOpen || tabs.length === 0) return;
    selectedIdx = (selectedIdx + delta + tabs.length) % tabs.length;
    updateSelection();
  }

  /* ── Keyboard ───────────────────────────────────────────── */

  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        e.stopImmediatePropagation();
        cycle(e.shiftKey ? -1 : 1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        e.stopImmediatePropagation();
        cycle(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        e.stopImmediatePropagation();
        cycle(-1);
        break;
      case 'Enter':
        e.preventDefault();
        e.stopImmediatePropagation();
        commitAndClose();
        break;
      case 'Escape':
        e.preventDefault();
        e.stopImmediatePropagation();
        dismiss();
        break;
      case 'Home':
        e.preventDefault();
        e.stopImmediatePropagation();
        selectedIdx = 0;
        updateSelection();
        break;
      case 'End':
        e.preventDefault();
        e.stopImmediatePropagation();
        selectedIdx = tabs.length - 1;
        updateSelection();
        break;
    }
  }, true);

  document.addEventListener('keyup', function (e) {
    if (e.key === 'Alt' || e.key === 'q' || e.key === 'Q') {
      if (isOpen && !e.altKey && !e.ctrlKey && !e.metaKey) {
        commitAndClose();
      } else if (pendingMode && !e.altKey && !e.ctrlKey && !e.metaKey) {
        clearTimeout(pendingTimer);
        pendingMode = false;
        if (pendingPrevId != null) {
          chrome.runtime.sendMessage({ action: 'switch-tab', tabId: pendingPrevId });
        }
      }
    }
  }, true);

  /* ── Messages ───────────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'toggle-switcher') {
      if (isOpen) {
        cycle(1);
      } else if (pendingMode) {
        clearTimeout(pendingTimer);
        pendingMode = false;
        show(msg.tabs, msg.activeTabId);
      } else {
        pendingMode = true;
        pendingPrevId = msg.previousTabId;
        pendingTimer = setTimeout(() => {
          pendingMode = false;
          show(msg.tabs, msg.activeTabId);
        }, 200);
      }
    }
  });

  /* ── Helpers ────────────────────────────────────────────── */

  function createFallbackFavicon(title) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const hue = hashStr(title || '?') % 360;
    ctx.fillStyle = `hsl(${hue}, 50%, 35%)`;
    ctx.beginPath();
    const r = 6;
    ctx.moveTo(r, 0);
    ctx.lineTo(32 - r, 0);
    ctx.arcTo(32, 0, 32, r, r);
    ctx.lineTo(32, 32 - r);
    ctx.arcTo(32, 32, 32 - r, 32, r);
    ctx.lineTo(r, 32);
    ctx.arcTo(0, 32, 0, 32 - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((title || '?')[0].toUpperCase(), 16, 16);

    return canvas.toDataURL();
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
})();
