// Cinema AdShield - Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
    const mainToggle = document.getElementById('mainToggle');
    const currentDomainEl = document.getElementById('currentDomain');
    const whitelistBtn = document.getElementById('whitelistBtn');
    const pageBlockedCountEl = document.getElementById('pageBlockedCount');
    const totalBlockedCountEl = document.getElementById('totalBlockedCount');
    const zapperBtn = document.getElementById('zapperBtn');
    const featureDots = document.querySelectorAll('.feature-dot');
    const featureStatuses = document.querySelectorAll('.feature-status');

    let currentTab = null;
    let currentHostname = '';

    // 1. Get active tab
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            currentTab = tabs[0];
            if (currentTab.url) {
                try {
                    const url = new URL(currentTab.url);
                    currentHostname = url.hostname;
                    currentDomainEl.textContent = currentHostname || 'safari://';
                } catch (e) {
                    currentDomainEl.textContent = 'safari://';
                }
            }
        }
    } catch (e) {
        console.error('Failed to get active tab:', e);
    }

    // 2. Load stored settings & stats
    chrome.storage.local.get({
        isEnabled: true,
        totalBlocked: 0,
        whitelistedDomains: []
    }, (data) => {
        mainToggle.checked = data.isEnabled;
        totalBlockedCountEl.textContent = data.totalBlocked.toLocaleString();

        const isWhitelisted = currentHostname && data.whitelistedDomains.includes(currentHostname);
        updateWhitelistBtn(isWhitelisted);
        updateStatusVisuals(data.isEnabled && !isWhitelisted);
    });

    // 3. Request page-specific blocked count from background or content script
    if (currentTab && currentTab.id) {
        chrome.runtime.sendMessage({ action: 'get_tab_stats', tabId: currentTab.id }, (response) => {
            if (response && response.count !== undefined) {
                pageBlockedCountEl.textContent = response.count;
            }
        });
    }

    // 4. Main On/Off Toggle Handler
    mainToggle.addEventListener('change', () => {
        const enabled = mainToggle.checked;
        chrome.storage.local.set({ isEnabled: enabled });
        updateStatusVisuals(enabled);

        // Reload tab to apply changes immediately
        if (currentTab && currentTab.id) {
            chrome.tabs.reload(currentTab.id);
        }
    });

    // 5. Whitelist Button Handler
    whitelistBtn.addEventListener('click', () => {
        if (!currentHostname) return;

        chrome.storage.local.get({ whitelistedDomains: [] }, (data) => {
            let list = data.whitelistedDomains || [];
            const index = list.indexOf(currentHostname);
            let isNowWhitelisted = false;

            if (index > -1) {
                list.splice(index, 1);
                isNowWhitelisted = false;
            } else {
                list.push(currentHostname);
                isNowWhitelisted = true;
            }

            chrome.storage.local.set({ whitelistedDomains: list }, () => {
                updateWhitelistBtn(isNowWhitelisted);
                updateStatusVisuals(mainToggle.checked && !isNowWhitelisted);
                if (currentTab && currentTab.id) {
                    chrome.tabs.reload(currentTab.id);
                }
            });
        });
    });

    // 6. Element Zapper Button Handler
    zapperBtn.addEventListener('click', () => {
        if (currentTab && currentTab.id) {
            chrome.tabs.sendMessage(currentTab.id, { action: 'start_zapper' }, () => {
                window.close(); // Close popup so user can click element
            });
        }
    });

    function updateWhitelistBtn(isWhitelisted) {
        if (isWhitelisted) {
            whitelistBtn.classList.add('active');
            whitelistBtn.querySelector('span').textContent = 'Включить защиту';
        } else {
            whitelistBtn.classList.remove('active');
            whitelistBtn.querySelector('span').textContent = 'В белый список';
        }
    }

    function updateStatusVisuals(isActive) {
        featureDots.forEach(dot => {
            if (isActive) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        featureStatuses.forEach(st => {
            st.textContent = isActive ? 'ВКЛ' : 'ВЫКЛ';
            st.style.color = isActive ? '#30d158' : '#ff453a';
        });
    }
});
