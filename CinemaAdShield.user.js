// ==UserScript==
// @name         Cinema AdShield — Пропуск рекламы Kinogo
// @namespace    https://github.com/cinema-adshield
// @version      3.0.0
// @description  Автоматически пропускает рекламу перед фильмами на Kinogo и похожих сайтах. Блокирует казино-попандеры.
// @author       Cinema AdShield
// @match        *://kinogo.la/*
// @match        *://kinogo.bio/*
// @match        *://kinogo.club/*
// @match        *://kinogo.co/*
// @match        *://kinogo.cc/*
// @match        *://kinogo.ac/*
// @match        *://kinogo.biz/*
// @match        *://kinogo.me/*
// @match        *://kinogo.es/*
// @match        *://kinogo.top/*
// @match        *://kinogo.in/*
// @match        *://kinogo.cam/*
// @match        *://*.kinogo.*/*
// @match        *://hdrezka.*/*
// @match        *://*.hdrezka.*/*
// @match        *://lordfilm.*/*
// @match        *://*.lordfilm.*/*
// @match        *://filmix.*/*
// @match        *://zetflix.*/*
// @match        *://seasonvar.*/*
// @match        *://seasonvar.ru/*
// @match        *://*.youtube.com/*
// @run-at       document-start
// @all-frames   true
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    const host = window.location.hostname.toLowerCase();
    const isYouTube = host.includes('youtube');
    const isKinogo  = host.includes('kinogo');
    const isStreaming = isKinogo ||
                        host.includes('hdrezka') || host.includes('rezka') ||
                        host.includes('lordfilm') || host.includes('filmix') ||
                        host.includes('zetflix')  || host.includes('seasonvar');

    if (!isYouTube && !isStreaming) return;

    // ═══════════════════════════════════════════════════
    //  КАЗИНО-ПОПАНДЕРЫ — блокировка window.open
    // ═══════════════════════════════════════════════════
    const BAD_DOMAINS = [
        'pinco','pin-up','pinup','1xbet','1x-bet','vavada','mostbet',
        'melbet','1win','catcasino','joycasino','fonbet','betboom','winline',
        'linebet','clickadu','propellerads','adcash','popads','popcash',
        'exoclick','monetag','hilltopads','casino','betting','epicstar',
        'vulkan','slotoking','betwinner','leovegas','brazino'
    ];

    function isBadUrl(url) {
        if (!url) return false;
        const u = String(url).toLowerCase();
        return BAD_DOMAINS.some(d => u.includes(d));
    }

    // Перехватываем window.open — убиваем казино-попандеры
    const _origOpen = window.open;
    window.open = function (url, ...args) {
        if (isBadUrl(url)) return null;
        return _origOpen.call(this, url, ...args);
    };

    // Убиваем казино-ссылки при клике
    document.addEventListener('click', function (e) {
        const a = e.target && e.target.closest('a');
        if (!a) return;
        const href = (a.href || '').toLowerCase();
        if (isBadUrl(href)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            a.remove();
        }
    }, true);

    // ═══════════════════════════════════════════════════
    //  CSS — скрываем рекламные баннеры
    // ═══════════════════════════════════════════════════
    GM_addStyle(`
        /* Kinogo / стриминг-сайты */
        #kinogo-banner, .kinogo-adv, .kinogo-app,
        .app-banner, .app-block, .kino-app,
        .sticky-adv, .fixed-banner, .commercial-block,
        .ad_box, .adsbygoogle, .full-banner, .full-adv,
        .b-adv, .b-adv-side, .b-adv__top, .b-adv__bottom,
        .b-adv-side__item, .rezka-adv, .lordfilm-adv,
        .lf-banner, .filmix-adv, .zetflix-adv, .zf-banner,
        .click-under, .pop-under, .click-overlay, .overlay-ad,
        .video-ad-overlay, .mgbox, .mgline, .native-ad,
        iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
        iframe[src*="an.yandex"], iframe[src*="yabs.yandex"],
        iframe[src*="propellerads"], iframe[src*="popads"],
        iframe[src*="exoclick"], iframe[src*="monetag"],
        iframe[src*="adcash"], iframe[src*="clickadu"],
        a[target="_blank"][style*="position: fixed"],
        a[target="_blank"][style*="position: absolute"][style*="z-index"],
        /* YouTube */
        ytd-ad-slot-renderer, ytd-action-companion-ad-renderer,
        ytd-banner-promo-renderer, ytd-promoted-video-renderer,
        ytd-statement-banner-renderer, ytd-in-feed-ad-layout-renderer,
        ytd-display-ad-renderer, ytd-player-legacy-desktop-watch-ads-renderer,
        ytd-merch-shelf-renderer, ytd-mealbar-promo-renderer,
        #masthead-ad, #player-ads,
        .ytp-ad-overlay-container, .ytp-ad-message-container,
        .ytp-ad-progress-list, .ytp-ad-module {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            height: 0 !important;
            overflow: hidden !important;
        }

        /* Плеер НЕ трогаем */
        video,
        #player, .player-box, .b-player,
        #player_box, .player-container,
        #movie_player, .html5-video-player {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            height: auto !important;
            pointer-events: auto !important;
        }
    `);

    // ═══════════════════════════════════════════════════
    //  YOUTUBE — пропуск пре-роллов
    // ═══════════════════════════════════════════════════
    if (isYouTube) {
        const YT_AD_ELEMS = [
            'ytd-ad-slot-renderer','ytd-action-companion-ad-renderer',
            'ytd-banner-promo-renderer','ytd-promoted-video-renderer',
            'ytd-display-ad-renderer','ytd-player-legacy-desktop-watch-ads-renderer',
            'ytd-merch-shelf-renderer','#masthead-ad','#player-ads'
        ];

        function skipYT() {
            const player = document.querySelector('#movie_player, .html5-video-player');
            if (!player) return;

            const adShowing = player.classList.contains('ad-showing') ||
                              player.classList.contains('ad-interrupting') ||
                              !!document.querySelector('.ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-module');

            if (adShowing) {
                // 1. Прокручиваем видео в конец
                const vid = player.querySelector('video') || document.querySelector('video');
                if (vid && isFinite(vid.duration) && vid.duration > 0) {
                    try { vid.currentTime = vid.duration; } catch(e) {}
                }
                // 2. Жмём кнопку скипа если есть
                document.querySelectorAll([
                    '.ytp-ad-skip-button',
                    '.ytp-ad-skip-button-modern',
                    '.ytp-skip-ad-button',
                    '.ytp-ad-skip-button-slot',
                    '.ytp-ad-overlay-close-button'
                ].join(',')).forEach(b => { try { b.click(); } catch(e) {} });
                // 3. API метод
                if (typeof player.skipAd === 'function') {
                    try { player.skipAd(); } catch(e) {}
                }
            }

            // Закрываем диалог "Обнаружен блокировщик рекламы"
            const dlg = document.querySelector(
                'ytd-enforcement-message-view-model, ' +
                'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)'
            );
            if (dlg) {
                const btn = dlg.querySelector('#dismiss-button, button');
                if (btn) { try { btn.click(); } catch(e) {} }
                else dlg.remove();
                const v = document.querySelector('video');
                if (v && v.paused) v.play().catch(() => {});
            }
        }

        function cleanYT() {
            YT_AD_ELEMS.forEach(s => {
                document.querySelectorAll(s).forEach(el => el.remove());
            });
        }

        // MutationObserver — реагируем мгновенно на изменения DOM
        new MutationObserver(() => { skipYT(); cleanYT(); })
            .observe(document.documentElement, { childList: true, subtree: true });

        // Резервный интервал
        setInterval(skipYT, 300);
        setInterval(cleanYT, 1500);
        return;
    }

    // ═══════════════════════════════════════════════════
    //  KINOGO И СТРИМИНГ — пропуск пре-роллов в плеере
    // ═══════════════════════════════════════════════════

    // Контейнеры рекламного видео
    const AD_WRAPPERS = [
        '.ad-container', '.preroll', '.player-ad', '.inroll',
        '[class*="vast"]', '[class*="vpaid"]',
        '.player-adv', '.b-player__adv', '.video-ad',
        '[id*="preroll"]', '[class*="preroll"]', '[id*="vast"]',
        '.jw-overlays', '[id*="vpaid"]', '[class*="adsContainer"]',
        '[class*="ad_wrapper"]', '[id*="ad_wrapper"]',
        '.adsframe', '#adsframe', '.ads-frame', '#prerollAds',
        '[class*="PreRoll"]', '[class*="preRoll"]'
    ];

    // Кнопки пропуска рекламы
    const SKIP_BTNS = [
        '.skip-ad', '.skip-button', '.video-ad-skip', '.vpaid-skip',
        '.b-player__adv-skip', '.adv-skip', '.player-adv-skip',
        '.jw-skip', '.fp-skip', '.plyr__ads-skip',
        '[class*="skip-ad"]', '[id*="skip-ad"]',
        '[class*="skipAd"]', '[id*="skipAd"]',
        '[class*="AdSkip"]', '[class*="adSkip"]',
        'button[class*="skip"]', 'div[class*="skip"]',
        'span[class*="skip"]', 'button.b-adv__btn'
    ];

    // Тексты, указывающие что идёт реклама
    const AD_TEXTS = [
        'Реклама 1/', 'Реклама 2/', 'Реклама 3/',
        'Пропустить через', 'Реклама закончится через',
        'Реклама закончится', 'Пропустить рекламу',
        'Skip Ad', 'Skip in', 'Advertisement',
        'Your video will resume', 'после рекламы'
    ];

    // ─── Главная функция пропуска рекламы ───────────────
    function skipPreroll() {
        const bodyText = document.body ? (document.body.innerText || '') : '';
        const adTextFound = AD_TEXTS.some(t => bodyText.includes(t));

        // 1. Найти все video-элементы и проверить — реклама ли?
        document.querySelectorAll('video').forEach(vid => {
            const inAdWrapper = AD_WRAPPERS.some(sel => {
                try { return !!vid.closest(sel); } catch(e) { return false; }
            });

            // Условие: видео внутри рекламного блока ИЛИ текст рекламы виден + видео короткое (≤120 сек)
            const isAd = inAdWrapper || (adTextFound && vid.duration > 0 && vid.duration <= 120);

            if (isAd && vid.readyState >= 1) {
                try {
                    vid.muted = true;
                    vid.playbackRate = 16.0;   // максимальная скорость → реклама заканчивается мгновенно
                    if (isFinite(vid.duration) && vid.duration > 0) {
                        vid.currentTime = vid.duration - 0.1;  // прыгаем в конец
                    }
                } catch(e) {}
            }
        });

        // 2. Жмём все видимые кнопки пропуска
        SKIP_BTNS.forEach(sel => {
            document.querySelectorAll(sel).forEach(btn => {
                // Проверяем что кнопка видима
                const visible = btn.offsetParent !== null ||
                                btn.getBoundingClientRect().width > 0;
                if (visible) {
                    try { btn.click(); } catch(e) {}
                }
            });
        });

        // 3. Убираем оверлеи которые перекрывают плеер
        removeAdOverlays();
    }

    // ─── Удаление рекламных оверлеев над плеером ────────
    const AD_OVERLAY_SELECTORS = [
        '#kinogo-banner', '.kinogo-adv', '.kinogo-app',
        '.app-banner', '.app-block', '.click-under',
        '.pop-under', '.click-overlay', '.overlay-ad',
        '.video-ad-overlay', '.b-adv', '.b-adv__top',
        '.b-adv__bottom', '[class*="casino-banner"]',
        '[id*="casino-banner"]', '[class*="popup-ad"]'
    ];

    function removeAdOverlays() {
        AD_OVERLAY_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
        });

        // Убираем фиксированные/абсолютные элементы казино
        document.querySelectorAll('a[href]').forEach(a => {
            if (isBadUrl(a.href)) {
                const st = window.getComputedStyle(a);
                if (st.position === 'fixed' || st.position === 'absolute' ||
                    a.offsetWidth > 400 || a.children.length === 0) {
                    a.remove();
                }
            }
        });
    }

    // ─── MutationObserver — мгновенно реагируем на новые элементы ──
    let skipTimeout = null;
    new MutationObserver((muts) => {
        const hasNewNodes = muts.some(m => m.addedNodes.length > 0);
        if (hasNewNodes) {
            // Debounce чтобы не молотить слишком часто
            clearTimeout(skipTimeout);
            skipTimeout = setTimeout(skipPreroll, 50);
            removeAdOverlays();
        }
    }).observe(document.documentElement, { childList: true, subtree: true });

    // ─── Основной интервал (главная защита) ─────────────
    setInterval(skipPreroll, 250);       // часто — ловим пре-ролл сразу
    setInterval(removeAdOverlays, 800);  // реже — чистим баннеры

    // ─── Запуск сразу и после загрузки DOM ──────────────
    skipPreroll();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', skipPreroll);
    }
    window.addEventListener('load', skipPreroll);

})();
