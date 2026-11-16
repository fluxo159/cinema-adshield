// Cinema AdShield - Popup Controller v2.0

document.addEventListener('DOMContentLoaded', async () => {
    // ==========================================
    // DOM REFS
    // ==========================================
    const mainToggle = document.getElementById('mainToggle');
    const currentDomainEl = document.getElementById('currentDomain');
    const whitelistBtn = document.getElementById('whitelistBtn');
    const pageBlockedCountEl = document.getElementById('pageBlockedCount');
    const totalBlockedCountEl = document.getElementById('totalBlockedCount');
    const zapperBtn = document.getElementById('zapperBtn');
    const resetBtn = document.getElementById('resetBtn');
    const featureDots = document.querySelectorAll('.feature-dot');
    const featureStatuses = document.querySelectorAll('.feature-status');
    const statusBanner = document.getElementById('statusBanner');

    let currentTab = null;
    let currentHostname = '';
    let isWhitelisted = false;

    // ==========================================
    // 1. GET ACTIVE TAB
    // ==========================================
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            currentTab = tabs[0];
            if (currentTab.url) {
                try {
                    const url = new URL(currentTab.url);
                    currentHostname = url.hostname;
                    currentDomainEl.textContent = currentHostname || 'safari://';
                    currentDomainEl.title = currentHostname;
                } catch (e) {
                    currentDomainEl.textContent = 'safari://';
                }
            }
        }
    } catch (e) {
        console.error('[AdShield Popup] Failed to get active tab:', e);
        currentDomainEl.textContent = 'Ошибка';
    }

    // ==========================================
    // 2. LOAD SETTINGS & STATS
    // ==========================================
    chrome.storage.local.get({
        isEnabled: true,
        totalBlocked: 0,
        whitelistedDomains: []
    }, (data) => {
        mainToggle.checked = data.isEnabled;
        totalBlockedCountEl.textContent = formatNumber(data.totalBlocked);

        isWhitelisted = currentHostname
            ? (data.whitelistedDomains || []).some(d =>
                currentHostname === d || currentHostname.endsWith('.' + d)
            )
            : false;

        updateWhitelistBtn(isWhitelisted);
        updateStatusVisuals(data.isEnabled && !isWhitelisted);
        updateStatusBanner(data.isEnabled, isWhitelisted);
    });

    // ==========================================
    // 3. GET PAGE-SPECIFIC BLOCKED COUNT
    // ==========================================
    if (currentTab && currentTab.id) {
        chrome.runtime.sendMessage(
            { action: 'get_tab_stats', tabId: currentTab.id },
            (response) => {
                if (chrome.runtime.lastError) return;
                if (response && response.count !== undefined) {
                    pageBlockedCountEl.textContent = formatNumber(response.count);
                }
            }
        );
    }

    // Animate count-up for stats
    function animateCount(el, target) {
        const current = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
        if (current === target) return;
        const step = Math.ceil(Math.abs(target - current) / 12);
        let val = current;
        const interval = setInterval(() => {
            val = val < target ? Math.min(val + step, target) : Math.max(val - step, target);
            el.textContent = formatNumber(val);
            if (val === target) clearInterval(interval);
        }, 30);
    }

    // ==========================================
    // 4. MAIN TOGGLE HANDLER
    // ==========================================
    mainToggle.addEventListener('change', () => {
        const enabled = mainToggle.checked;
        chrome.storage.local.set({ isEnabled: enabled }, () => {
            updateStatusVisuals(enabled && !isWhitelisted);
            updateStatusBanner(enabled, isWhitelisted);

            // Reload tab to apply changes
            if (currentTab && currentTab.id) {
                setTimeout(() => chrome.tabs.reload(currentTab.id), 300);
            }
        });
    });

    // ==========================================
    // 5. WHITELIST BUTTON HANDLER
    // ==========================================
    whitelistBtn.addEventListener('click', () => {
        if (!currentHostname) return;

        chrome.storage.local.get({ whitelistedDomains: [] }, (data) => {
            let list = data.whitelistedDomains || [];
            const existingIdx = list.findIndex(d =>
                currentHostname === d || currentHostname.endsWith('.' + d)
            );

            if (existingIdx > -1) {
                list.splice(existingIdx, 1);
                isWhitelisted = false;
            } else {
                list.push(currentHostname);
                isWhitelisted = true;
            }

            chrome.storage.local.set({ whitelistedDomains: list }, () => {
                updateWhitelistBtn(isWhitelisted);
                updateStatusVisuals(mainToggle.checked && !isWhitelisted);
                updateStatusBanner(mainToggle.checked, isWhitelisted);

                // Brief visual feedback
                whitelistBtn.style.transform = 'scale(0.95)';
                setTimeout(() => { whitelistBtn.style.transform = ''; }, 150);

                if (currentTab && currentTab.id) {
                    setTimeout(() => chrome.tabs.reload(currentTab.id), 300);
                }
            });
        });
    });

    // ==========================================
    // 6. ELEMENT ZAPPER BUTTON
    // ==========================================
    if (zapperBtn) {
        zapperBtn.addEventListener('click', () => {
            if (currentTab && currentTab.id) {
                chrome.tabs.sendMessage(
                    currentTab.id,
                    { action: 'start_zapper' },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            // Content script may not be loaded on this page
                            showToast('Заппер недоступен на этой странице');
                            return;
                        }
                        window.close();
                    }
                );
            }
        });
    }

    // ==========================================
    // 7. RESET COUNTER BUTTON
    // ==========================================
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'reset_total' }, () => {
                totalBlockedCountEl.textContent = '0';
                pageBlockedCountEl.textContent = '0';
                showToast('Счётчик сброшен');
            });
        });
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================
    function updateWhitelistBtn(whitelisted) {
        const span = whitelistBtn.querySelector('span');
        if (whitelisted) {
            whitelistBtn.classList.add('active');
            if (span) span.textContent = 'Включить защиту';
            whitelistBtn.title = 'Сайт в белом списке — нажмите чтобы включить защиту';
        } else {
            whitelistBtn.classList.remove('active');
            if (span) span.textContent = 'В белый список';
            whitelistBtn.title = 'Отключить блокировку только для этого сайта';
        }
    }

    function updateStatusVisuals(isActive) {
        featureDots.forEach(dot => {
            if (isActive) dot.classList.add('active');
            else dot.classList.remove('active');
        });
        featureStatuses.forEach(st => {
            st.textContent = isActive ? 'ВКЛ' : 'ВЫКЛ';
            st.classList.toggle('off', !isActive);
        });
    }

    function updateStatusBanner(enabled, whitelisted) {
        if (!statusBanner) return;
        if (!enabled) {
            statusBanner.textContent = '⏸ Защита отключена глобально';
            statusBanner.className = 'status-banner disabled';
        } else if (whitelisted) {
            statusBanner.textContent = '⚪ Сайт в белом списке';
            statusBanner.className = 'status-banner whitelisted';
        } else {
            statusBanner.textContent = '🛡 Защита активна';
            statusBanner.className = 'status-banner active';
        }
    }

    function formatNumber(n) {
        if (n === undefined || n === null) return '0';
        return n.toLocaleString('ru-RU');
    }

    function showToast(message) {
        const existing = document.querySelector('._shield-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = '_shield-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
            background: rgba(255,255,255,0.12); color: #fff;
            padding: 6px 14px; border-radius: 20px; font-size: 11px;
            backdrop-filter: blur(8px); z-index: 999;
            animation: fadeIn 0.2s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
});
