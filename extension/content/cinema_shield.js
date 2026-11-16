// Cinema AdShield - Content Script v2.0
// Safari / Chrome Extension — Full rewrite with all features working

(function () {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================
    const currentHost = window.location.hostname.toLowerCase();

    // Fixed: use partial match (hostname doesn't include scheme)
    const isYouTube = currentHost.includes('youtube') || currentHost.includes('youtu.be');
    const isKinopoisk = currentHost.includes('kinopoisk');
    const isIvi = currentHost.includes('ivi.ru');
    const isOkko = currentHost.includes('okko.tv');
    const isKinogo = currentHost.includes('kinogo');
    const isHDRezka = currentHost.includes('hdrezka') || currentHost.includes('rezka');
    const isLordfilm = currentHost.includes('lordfilm');
    const isFilmix = currentHost.includes('filmix');
    const isZetflix = currentHost.includes('zetflix');
    const isSeasonvar = currentHost.includes('seasonvar');
    const isRutracker = currentHost.includes('rutracker');

    const isStreamingSite = isKinogo || isHDRezka || isLordfilm || isFilmix ||
                            isZetflix || isSeasonvar || isKinopoisk || isIvi || isOkko || isRutracker;

    // Do nothing on non-target sites
    if (!isYouTube && !isStreamingSite) return;

    let blockedCount = 0;
    let isEnabled = true;
    let whitelistedDomains = [];

    // ==========================================
    // LOAD SETTINGS FROM STORAGE
    // ==========================================
    function loadSettingsAndInit() {
        try {
            chrome.storage.local.get({
                isEnabled: true,
                whitelistedDomains: []
            }, (data) => {
                isEnabled = data.isEnabled;
                whitelistedDomains = data.whitelistedDomains || [];

                const isWhitelisted = whitelistedDomains.some(d =>
                    currentHost === d || currentHost.endsWith('.' + d)
                );

                if (!isEnabled || isWhitelisted) {
                    return; // Extension disabled or site whitelisted
                }

                // Initialize the appropriate module
                if (isYouTube) {
                    initYouTubeShield();
                } else if (isStreamingSite) {
                    initAntiPopunder();
                    initStreamingVideoHook();
                    initDOMObserver();
                    if (isKinogo) initKinogoCleaner();
                    if (isKinopoisk) initKinopoiskCleaner();
                    if (isHDRezka) initHDRezkaCleaner();
                }
            });
        } catch (e) {
            // Fallback if chrome.storage not available (e.g. injected as userscript)
            if (isYouTube) {
                initYouTubeShield();
            } else if (isStreamingSite) {
                initAntiPopunder();
                initStreamingVideoHook();
                initDOMObserver();
            }
        }
    }

    // ==========================================
    // HELPER: Report blocked element
    // ==========================================
    function reportBlocked(count) {
        blockedCount += count;
        try {
            chrome.runtime.sendMessage({ action: 'increment_blocked', count: count });
        } catch (e) {}
    }

    // ==========================================
    // 1. ANTI-POPUNDER & CLICK-JACKING
    // ==========================================
    function initAntiPopunder() {
        const SUSPICIOUS_DOMAINS = [
            'pinco', 'pin-co', 'pin-up', 'pinup', '1xbet', '1x-bet', 'vavada', 'mostbet',
            'melbet', '1win', 'catcasino', 'joycasino', 'fonbet', 'betboom', 'winline',
            'linebet', 'clickadu', 'propellerads', 'adcash', 'popads', 'popcash',
            'exoclick', 'trafficjunky', 'monetag', 'hilltopads', 'casino', 'betting',
            'epicstar', 'vulcan', 'slotoking', 'spinamba', 'brazino', 'bettilt',
            'bonuscode', 'freespins', 'leovegas', 'betway', 'betwinner'
        ];

        function isSuspiciousUrl(url) {
            if (!url || typeof url !== 'string') return false;
            const lower = url.toLowerCase();
            return SUSPICIOUS_DOMAINS.some(p => lower.includes(p));
        }

        // Override window.open
        const _open = window.open;
        window.open = function (url, target, features) {
            if (isSuspiciousUrl(url)) {
                reportBlocked(1);
                return null;
            }
            // Block all _blank popups that open external domains
            if (target === '_blank' && url) {
                try {
                    const urlObj = new URL(url, window.location.href);
                    if (urlObj.hostname !== window.location.hostname && isSuspiciousUrl(url)) {
                        reportBlocked(1);
                        return null;
                    }
                } catch (e) {}
            }
            return _open.apply(this, arguments);
        };

        // Block suspicious link clicks
        document.addEventListener('click', function (e) {
            const link = e.target && e.target.closest('a');
            if (!link) return;
            const href = (link.href || '').toLowerCase();
            if (!href || href.startsWith('javascript:')) return;

            const isCasino = isSuspiciousUrl(href);
            const st = window.getComputedStyle(link);
            const isOverlay = (st.position === 'fixed' || st.position === 'absolute') &&
                              link.offsetWidth > 300 && link.offsetHeight > 200;

            if (isCasino || isOverlay) {
                e.preventDefault();
                e.stopImmediatePropagation();
                link.remove();
                reportBlocked(1);
            }
        }, true);

        // Block document.write for popunder injections
        const _docWrite = document.write.bind(document);
        document.write = function (markup) {
            if (typeof markup === 'string' && isSuspiciousUrl(markup)) {
                return;
            }
            return _docWrite(markup);
        };
    }

    // ==========================================
    // 2. YOUTUBE MODULE
    // ==========================================
    function initYouTubeShield() {
        let lastAdState = false;

        function handleYouTubeAds() {
            const player = document.querySelector('#movie_player, .html5-video-player');
            const isAdShowing = player && (
                player.classList.contains('ad-showing') ||
                player.classList.contains('ad-interrupting') ||
                !!document.querySelector('.ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-module')
            );

            if (isAdShowing) {
                if (!lastAdState) {
                    lastAdState = true;
                    reportBlocked(1);
                }

                const video = player.querySelector('video') || document.querySelector('video.html5-main-video');
                if (video && isFinite(video.duration) && video.duration > 0) {
                    try { video.currentTime = video.duration; } catch (e) {}
                }

                // Mute ad audio immediately
                if (video && !video.muted) {
                    try { video.muted = true; setTimeout(() => { if (video) video.muted = false; }, 3000); } catch(e) {}
                }

                const skipSelectors = [
                    '.ytp-ad-skip-button',
                    '.ytp-ad-skip-button-modern',
                    '.ytp-skip-ad-button',
                    '.ytp-ad-skip-button-slot',
                    '.ytp-ad-overlay-close-button',
                    'button[class*="skip"]',
                    'button[id*="skip"]'
                ];
                skipSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(btn => {
                        try { btn.click(); } catch (e) {}
                    });
                });

                if (typeof player.skipAd === 'function') {
                    try { player.skipAd(); } catch (e) {}
                }
            } else {
                lastAdState = false;
            }

            // Dismiss YouTube's "Ad blocker detected" dialog
            const enforcementSelectors = [
                'ytd-enforcement-message-view-model',
                'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
                '#header-dismiss-button',
                'yt-confirm-dialog-renderer'
            ];
            const dialog = document.querySelector(enforcementSelectors.join(', '));
            if (dialog) {
                const closeBtn = dialog.querySelector('#dismiss-button, button[class*="dismiss"], button');
                if (closeBtn) {
                    try { closeBtn.click(); } catch(e) {}
                } else {
                    dialog.remove();
                }
                const video = document.querySelector('video');
                if (video && video.paused) video.play().catch(() => {});
            }

            // Close overlay ads
            document.querySelectorAll('.ytp-ad-overlay-close-button').forEach(btn => {
                try { btn.click(); } catch(e) {}
            });
        }

        // Clean YouTube DOM ad elements
        const YT_AD_SELECTORS = [
            'ytd-action-companion-ad-renderer',
            'ytd-banner-promo-renderer',
            'ytd-promoted-sparkles-web-renderer',
            'ytd-promoted-video-renderer',
            'ytd-statement-banner-renderer',
            'ytd-in-feed-ad-layout-renderer',
            'ytd-ad-slot-renderer',
            'ytd-player-legacy-desktop-watch-ads-renderer',
            'ytd-display-ad-renderer',
            'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
            '#masthead-ad',
            '#player-ads',
            '.ytd-mealbar-promo-renderer',
            'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
            'ytd-merch-shelf-renderer'
        ];

        function cleanYouTubeDOM() {
            let removed = 0;
            YT_AD_SELECTORS.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    el.remove();
                    removed++;
                });
            });
            if (removed > 0) reportBlocked(removed);
        }

        // Use MutationObserver for dynamic content
        const ytObserver = new MutationObserver(() => {
            handleYouTubeAds();
            cleanYouTubeDOM();
        });

        function startYTObserver() {
            const target = document.documentElement;
            ytObserver.observe(target, {
                childList: true,
                subtree: true,
                attributes: false
            });
        }

        // Initial run
        cleanYouTubeDOM();
        handleYouTubeAds();
        startYTObserver();

        // Fallback interval (slower) for cases observer misses
        setInterval(handleYouTubeAds, 500);
        setInterval(cleanYouTubeDOM, 2000);
    }

    // ==========================================
    // 3. STREAMING VIDEO AD SKIPPER
    // ==========================================
    function initStreamingVideoHook() {
        const RU_AD_TEXTS = [
            'Реклама 1/', 'Реклама 2/', 'Реклама 3/',
            'Пропустить через', 'Реклама закончится',
            'Пропустить рекламу', 'Skip Ad', 'Advertisement'
        ];

        const AD_CONTAINER_SELECTORS = [
            '.ad-container', '.preroll', '.player-ad',
            '[class*="vast"]', '[class*="vpaid"]',
            '.player-adv', '.b-player__adv',
            '.video-ad', '.inroll', '[id*="preroll"]',
            '[class*="preroll"]', '[id*="vast"]'
        ];

        const SKIP_SELECTORS = [
            '.skip-ad', '.skip-button', '.video-ad-skip', '.vpaid-skip',
            '[class*="skip"][class*="ad"]', '[id*="skip"][id*="ad"]',
            '.b-player__adv-skip', 'button.b-adv__btn', '.adv-skip',
            '.player-adv-skip', 'div[class*="adv-skip"]',
            'span[class*="skip"]', 'button[class*="skip"]',
            '.jw-skip', '.fp-skip', '.plyr__ads-skip'
        ];

        function checkVideoAds() {
            const bodyText = document.body ? (document.body.innerText || '') : '';
            const isAdTextVisible = RU_AD_TEXTS.some(t => bodyText.includes(t));

            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                const isInsideAd = AD_CONTAINER_SELECTORS.some(sel => video.closest(sel));
                const isShortVideo = video.duration > 0 && video.duration <= 120;

                if (isInsideAd || (isAdTextVisible && isShortVideo)) {
                    try {
                        video.muted = true;
                        video.playbackRate = 16.0;
                        if (isFinite(video.duration) && video.duration > 0) {
                            video.currentTime = video.duration - 0.01;
                        }
                    } catch (err) {}
                }
            });

            // Click all visible skip buttons
            SKIP_SELECTORS.forEach(sel => {
                document.querySelectorAll(sel).forEach(btn => {
                    // Only click if visible
                    if (btn.offsetParent !== null || btn.offsetWidth > 0) {
                        try { btn.click(); reportBlocked(1); } catch (e) {}
                    }
                });
            });
        }

        setInterval(checkVideoAds, 300);
    }

    // ==========================================
    // 4. MUTATION OBSERVER FOR STREAMING SITES
    // ==========================================
    function initDOMObserver() {
        const AD_ELEMENT_SELECTORS = [
            '#kinogo-banner', '.kinogo-adv', '.kinogo-app', '.app-banner', '.app-block', '.kino-app',
            '.sticky-adv', '.fixed-banner', '.commercial-block', '.ad_box',
            '.full-banner', '.full-adv', '.b-adv', '.b-adv-side', '.b-adv-side__item',
            '.b-adv__top', '.b-adv__bottom', '.rezka-adv', '.lordfilm-adv', '.lf-banner',
            '.filmix-adv', '.zetflix-adv', '.zf-banner', '.seasonvar-adv',
            '.click-under', '.pop-under', '.click-overlay', '.overlay-ad',
            '[class*="casino-banner"]', '[id*="casino-banner"]',
            '[class*="popup-ad"]', '[id*="popup-ad"]'
        ];

        function cleanAdElements() {
            let removed = 0;
            AD_ELEMENT_SELECTORS.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    el.remove();
                    removed++;
                });
            });

            // Remove fixed/absolute external links
            document.querySelectorAll('a[href]').forEach(a => {
                const href = (a.href || '').toLowerCase();
                const isCasino = ['pinco', 'pin-up', '1xbet', 'vavada', 'mostbet', 'epicstar',
                    'melbet', '1win', 'vulcan', 'fonbet', 'joycasino'].some(p => href.includes(p));
                if (isCasino) {
                    const st = window.getComputedStyle(a);
                    if (st.position === 'fixed' || st.position === 'absolute' ||
                        a.offsetWidth > 400 || a.children.length === 0) {
                        a.remove();
                        removed++;
                    }
                }
            });

            if (removed > 0) reportBlocked(removed);
        }

        // Run immediately
        cleanAdElements();

        // Observe DOM mutations
        const observer = new MutationObserver((mutations) => {
            let shouldClean = false;
            mutations.forEach(m => {
                if (m.addedNodes.length > 0) shouldClean = true;
            });
            if (shouldClean) cleanAdElements();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Periodic cleanup as fallback
        setInterval(cleanAdElements, 1000);
    }

    // ==========================================
    // 5. KINOGO SPECIFIC CLEANER
    // ==========================================
    function initKinogoCleaner() {
        function cleanKinogo() {
            // Remove app install banners
            document.querySelectorAll('#kinogo-banner, .kinogo-adv, .kinogo-app, .app-banner, .app-block').forEach(el => {
                el.remove();
                reportBlocked(1);
            });

            // Remove casino overlays
            document.querySelectorAll('[style*="z-index"]').forEach(el => {
                const st = window.getComputedStyle(el);
                if ((st.position === 'fixed' || st.position === 'absolute') &&
                    parseInt(st.zIndex) > 9000 &&
                    el.offsetWidth > window.innerWidth * 0.5 &&
                    el.offsetHeight > window.innerHeight * 0.3) {
                    // Check if it's not the player itself
                    if (!el.closest('#player, .player-box, video')) {
                        el.remove();
                        reportBlocked(1);
                    }
                }
            });
        }

        cleanKinogo();
        setInterval(cleanKinogo, 500);
    }

    // ==========================================
    // 6. KINOPOISK SPECIFIC CLEANER
    // ==========================================
    function initKinopoiskCleaner() {
        function cleanKinopoisk() {
            // Remove Kinopoisk's own ad banners (not main content)
            const adSelectors = [
                '[class*="Advert"]',
                '[class*="advertisement"]',
                '[data-testid*="ad"]',
                '[class*="Banner"]:not([class*="film"])',
                'iframe[src*="an.yandex"]',
                'iframe[src*="doubleclick"]'
            ];
            adSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    el.remove();
                    reportBlocked(1);
                });
            });
        }

        cleanKinopoisk();
        setInterval(cleanKinopoisk, 2000);
    }

    // ==========================================
    // 7. HDREZKA SPECIFIC CLEANER
    // ==========================================
    function initHDRezkaCleaner() {
        function cleanHDRezka() {
            document.querySelectorAll('.rezka-adv, [id*="rezka-banner"], .b-adv').forEach(el => {
                el.remove();
                reportBlocked(1);
            });
        }

        cleanHDRezka();
        setInterval(cleanHDRezka, 1000);
    }

    // ==========================================
    // 8. ELEMENT ZAPPER (triggered from popup)
    // ==========================================
    function initElementZapper() {
        let zapperActive = false;
        let highlightedEl = null;
        let overlay = null;

        function createOverlay() {
            overlay = document.createElement('div');
            overlay.id = '_cinema_zapper_overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 2147483647;
                cursor: crosshair;
                background: transparent;
                pointer-events: all;
            `;
            document.body.appendChild(overlay);
        }

        function removeOverlay() {
            if (overlay) { overlay.remove(); overlay = null; }
        }

        function highlight(el) {
            if (highlightedEl === el) return;
            if (highlightedEl) {
                highlightedEl.style.outline = '';
                highlightedEl.style.opacity = '';
            }
            if (el && el !== document.body && el !== document.documentElement) {
                el.style.outline = '3px dashed #e50914';
                el.style.opacity = '0.7';
                highlightedEl = el;
            }
        }

        function stopZapper() {
            zapperActive = false;
            removeOverlay();
            if (highlightedEl) {
                highlightedEl.style.outline = '';
                highlightedEl.style.opacity = '';
                highlightedEl = null;
            }
            document.removeEventListener('mousemove', onMouseMove, true);
            document.removeEventListener('click', onZapClick, true);
            document.removeEventListener('keydown', onEscape, true);
        }

        function onMouseMove(e) {
            removeOverlay(); // temporarily remove to find real element below
            const el = document.elementFromPoint(e.clientX, e.clientY);
            createOverlay();
            highlight(el);
        }

        function onZapClick(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            removeOverlay();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el && el !== document.body && el !== document.documentElement) {
                el.remove();
                reportBlocked(1);
            }
            stopZapper();
        }

        function onEscape(e) {
            if (e.key === 'Escape') stopZapper();
        }

        // Listen for zapper activation from popup
        try {
            chrome.runtime.onMessage.addListener((request) => {
                if (request.action === 'start_zapper') {
                    if (zapperActive) {
                        stopZapper();
                        return;
                    }
                    zapperActive = true;
                    createOverlay();
                    document.addEventListener('mousemove', onMouseMove, true);
                    document.addEventListener('click', onZapClick, true);
                    document.addEventListener('keydown', onEscape, true);
                }
            });
        } catch (e) {}
    }

    // ==========================================
    // START
    // ==========================================
    loadSettingsAndInit();
    initElementZapper(); // Always register zapper listener

})();
