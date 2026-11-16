// Cinema AdShield - Content Script for Safari
// Designed specifically for streaming / movie sites (KinoGo, HDRezka, Lordfilm, Zetflix, etc.) and YouTube

(function () {
    'use strict';

    let blockedCount = 0;

    chrome.storage.local.get({ isEnabled: true, whitelistedDomains: [] }, function (data) {
        if (!data.isEnabled) return;

        const currentHost = window.location.hostname;
        if (data.whitelistedDomains && data.whitelistedDomains.includes(currentHost)) {
            return;
        }

        const isYouTube = currentHost.includes('youtube.com') || currentHost.includes('youtu.be');
        const isKinogo = currentHost.includes('kinogo');

        initAntiPopunder();

        if (isYouTube) {
            initYouTubeShield();
        } else {
            initStreamingVideoHook();
            if (isKinogo) {
                initKinogoCleaner();
            }
        }
    });

    // ==========================================
    // 1. ANTI-POPUNDER & CLICK-JACKING
    // ==========================================
    function initAntiPopunder() {
        const originalOpen = window.open;
        window.open = function (url) {
            if (typeof url === 'string') {
                const suspicious = [
                    'pinco', 'pin-co', 'pin-up', 'pinup', '1xbet', '1x-bet', 'vavada', 'mostbet',
                    'melbet', '1win', 'catcasino', 'joycasino', 'fonbet', 'betboom', 'winline',
                    'linebet', 'clickadu', 'propellerads', 'adcash', 'popads', 'popcash',
                    'exoclick', 'trafficjunky', 'monetag', 'hilltopads', 'casino', 'betting', 'epicstar'
                ];
                if (suspicious.some(pattern => url.toLowerCase().includes(pattern))) {
                    return null;
                }
            }
            return originalOpen.apply(this, arguments);
        };

        document.addEventListener('click', function (e) {
            const target = e.target;
            if (!target) return;
            const link = target.closest('a');
            if (link && link.target === '_blank') {
                const href = (link.href || '').toLowerCase();
                const isCasino = href.includes('pinco') || href.includes('pin-up') || href.includes('pinup') ||
                                 href.includes('1xbet') || href.includes('vavada') || href.includes('mostbet') ||
                                 href.includes('1win') || href.includes('epicstar');
                const isOverlay = (
                    window.getComputedStyle(link).position === 'fixed' ||
                    window.getComputedStyle(link).position === 'absolute' ||
                    link.offsetWidth > 400
                );
                if ((isOverlay || isCasino) && href && !href.includes(window.location.hostname)) {
                    e.preventDefault();
                    e.stopPropagation();
                    link.remove();
                }
            }
        }, true);
    }

    // ==========================================
    // 2. YOUTUBE MODULE
    // ==========================================
    function initYouTubeShield() {
        function handleYouTubeAds() {
            const player = document.querySelector('#movie_player, .html5-video-player');
            const isAdShowing = player && (
                player.classList.contains('ad-showing') ||
                player.classList.contains('ad-interrupting') ||
                document.querySelector('.ytp-ad-player-overlay, .ytp-ad-text') !== null
            );

            if (isAdShowing) {
                const video = player.querySelector('video') || document.querySelector('video.html5-main-video');
                if (video && isFinite(video.duration) && video.duration > 0) {
                    try {
                        video.currentTime = video.duration;
                    } catch (e) {}
                }

                const skipButtons = document.querySelectorAll(
                    '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot, button.ytp-ad-overlay-close-button, .ytp-ad-preview-container'
                );
                skipButtons.forEach(btn => {
                    try { btn.click(); } catch (e) {}
                });

                if (typeof player.skipAd === 'function') {
                    try { player.skipAd(); } catch (e) {}
                }
            }

            const adBlockDialog = document.querySelector('ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)');
            if (adBlockDialog) {
                const closeBtn = adBlockDialog.querySelector('#dismiss-button, button');
                if (closeBtn) closeBtn.click();
                else adBlockDialog.remove();
                const video = document.querySelector('video');
                if (video && video.paused) video.play().catch(() => {});
            }

            const overlayClose = document.querySelector('.ytp-ad-overlay-close-button');
            if (overlayClose) overlayClose.click();
        }

        setInterval(handleYouTubeAds, 250);

        function cleanYouTubeDOM() {
            const adSelectors = [
                'ytd-action-companion-ad-renderer', 'ytd-banner-promo-renderer',
                'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-video-renderer',
                'ytd-statement-banner-renderer', 'ytd-in-feed-ad-layout-renderer',
                'ytd-ad-slot-renderer', 'ytd-player-legacy-desktop-watch-ads-renderer',
                '#masthead-ad', '#player-ads'
            ];
            adSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => el.remove());
            });
        }

        cleanYouTubeDOM();
        setInterval(cleanYouTubeDOM, 1500);
    }

    // ==========================================
    // 3. STREAMING VIDEO AD SKIPPER
    // ==========================================
    function initStreamingVideoHook() {
        function checkVideoAds() {
            const bodyText = document.body ? document.body.innerText || '' : '';
            const isAdTextVisible = bodyText.includes('Реклама 1/') || bodyText.includes('Реклама 2/') ||
                                   bodyText.includes('Пропустить через') || bodyText.includes('Реклама закончится');

            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                const isInsideAd = video.closest('.ad-container, .preroll, .player-ad, [class*="vast"], [class*="vpaid"], .player-adv, .b-player__adv');
                if (isInsideAd || (isAdTextVisible && video.duration > 0 && video.duration <= 90)) {
                    try {
                        video.muted = true;
                        video.playbackRate = 16.0;
                        video.currentTime = video.duration || 9999;
                    } catch (err) {}
                }
            });

            const skipSelectors = [
                '.skip-ad', '.skip-button', '.video-ad-skip', '.vpaid-skip',
                '[class*="skip"]', '[id*="skip"]', '.b-player__adv-skip',
                'button.b-adv__btn', '.adv-skip', '.player-adv-skip',
                'div[class*="skip"]', 'span[class*="skip"]', 'button[class*="skip"]'
            ];
            skipSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(btn => {
                    if (btn.offsetParent !== null) {
                        try { btn.click(); } catch (e) {}
                    }
                });
            });
        }

        setInterval(checkVideoAds, 300);
    }

    // ==========================================
    // 4. KINOGO CLEANER (Safe & Non-Destructive)
    // ==========================================
    function initKinogoCleaner() {
        function cleanKinogo() {
            // Remove casino background wallpaper
            if (document.documentElement) {
                document.documentElement.style.setProperty('background-image', 'none', 'important');
                document.documentElement.style.setProperty('background-color', '#141414', 'important');
            }
            if (document.body) {
                document.body.style.setProperty('background-image', 'none', 'important');
                document.body.style.setProperty('background-color', '#141414', 'important');
            }

            // Remove banners without touching content
            document.querySelectorAll('#kinogo-banner, .kinogo-adv, .kinogo-app, .app-banner').forEach(el => el.remove());

            // Remove fullscreen clickjacking overlay links
            document.querySelectorAll('a').forEach(a => {
                const href = (a.href || '').toLowerCase();
                if (href.includes('pinco') || href.includes('pin-up') || href.includes('1xbet') || href.includes('vavada') || href.includes('epicstar') || href.includes('mostbet')) {
                    const st = window.getComputedStyle(a);
                    if (st.position === 'fixed' || st.position === 'absolute' || a.offsetWidth > 400 || a.children.length === 0) {
                        a.remove();
                    }
                }
            });
        }

        cleanKinogo();
        setInterval(cleanKinogo, 500);
    }

})();
