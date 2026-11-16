// Cinema AdShield - Background Service Worker v2.0

// ==========================================
// INSTALL / UPDATE
// ==========================================
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Cinema AdShield] Installed/Updated. Reason:', details.reason);

    // Set defaults only on fresh install
    if (details.reason === 'install') {
        chrome.storage.local.set({
            isEnabled: true,
            totalBlocked: 0,
            whitelistedDomains: [],
            installDate: Date.now()
        });
    }

    // Ensure required keys always exist
    chrome.storage.local.get({
        isEnabled: true,
        totalBlocked: 0,
        whitelistedDomains: []
    }, (data) => {
        chrome.storage.local.set(data);
    });
});

// ==========================================
// PER-TAB AD COUNTERS
// ==========================================
const tabCounters = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || typeof request !== 'object' || sender.id !== chrome.runtime.id) return;
    const popup = sender.url === chrome.runtime.getURL('popup/popup.html');
    if (request.action !== 'increment_blocked' && !popup) return;
    // Handle increment_blocked message from content scripts
    if (request.action === 'increment_blocked') {
        const tabId = sender.tab ? sender.tab.id : null;
        const count = Number.isInteger(request.count) && request.count > 0 && request.count <= 100 ? request.count : 1;

        if (tabId !== null) {
            tabCounters[tabId] = (tabCounters[tabId] || 0) + count;
            updateBadge(tabId, tabCounters[tabId]);
        }

        chrome.storage.local.get({ totalBlocked: 0 }, (data) => {
            const newTotal = (data.totalBlocked || 0) + count;
            chrome.storage.local.set({ totalBlocked: newTotal });
        });

        sendResponse({ success: true });
        return true;
    }

    // Handle get_tab_stats request from popup
    if (request.action === 'get_tab_stats') {
        const tabId = request.tabId;
        sendResponse({
            count: tabCounters[tabId] || 0
        });
        return true;
    }

    // Handle reset_total request from popup
    if (request.action === 'reset_total') {
        chrome.storage.local.set({ totalBlocked: 0 });
        // Reset all tab counters
        Object.keys(tabCounters).forEach(id => {
            tabCounters[id] = 0;
            updateBadge(parseInt(id), 0);
        });
        sendResponse({ success: true });
        return true;
    }
});

// ==========================================
// TAB LIFECYCLE MANAGEMENT
// ==========================================

// Clear counter on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        tabCounters[tabId] = 0;
        updateBadge(tabId, 0);
    }
});

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabCounters[tabId];
});

// ==========================================
// BADGE UPDATE HELPER
// ==========================================
function updateBadge(tabId, count) {
    try {
        if (count > 0) {
            chrome.action.setBadgeText({
                tabId: tabId,
                text: count > 9999 ? '9999+' : count.toString()
            });
            chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#e50914' });
            chrome.action.setBadgeTextColor({ tabId: tabId, color: '#ffffff' });
        } else {
            chrome.action.setBadgeText({ tabId: tabId, text: '' });
        }
    } catch (e) {
        // Tab may have been closed
    }
}
