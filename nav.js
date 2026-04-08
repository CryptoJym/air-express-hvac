(function() {
    // Universal Mobile Navigation Toggle
    var toggle = document.querySelector('.nav-toggle');
    // Try multiple selectors for the nav element
    var nav = document.querySelector('header nav') ||
              document.querySelector('.nav-menu') ||
              document.querySelector('.nav-links') ||
              document.querySelector('nav');

    if (toggle && nav) {
        // NOTE: We USED to set role="dialog" + aria-modal="true" here on
        // every page load. That caused iOS Safari to render the desktop
        // header nav with popover-like decorations on blog pages (the
        // client-reported "odd pop over, over the content"). The nav is
        // only a modal overlay on mobile when .active is set — so we
        // now apply those attributes in openNav() and strip them in
        // closeNav() instead of on initialization.
        nav.setAttribute('aria-label', 'Site navigation');

        // Create mobile CTA block inside nav (phone + estimate button)
        var headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            var mobileCta = headerActions.cloneNode(true);
            mobileCta.classList.add('mobile-nav-cta');
            nav.appendChild(mobileCta);
        }

        // Track elements we mark inert when the overlay opens, so we can
        // restore them on close. We use the inert attribute (now baseline
        // supported) to remove background content from the focus order.
        var inertedSiblings = [];
        var lastFocusedBeforeOpen = null;

        var setBackgroundInert = function (inert) {
            // Mark every direct child of <body> EXCEPT the header (which
            // contains the nav itself) as inert. This is the simplest
            // way to fully isolate the modal from the rest of the page.
            if (inert) {
                inertedSiblings = [];
                var bodyChildren = document.body.children;
                for (var i = 0; i < bodyChildren.length; i++) {
                    var el = bodyChildren[i];
                    if (el.contains(nav)) continue;
                    if (el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT') continue;
                    if (el.hasAttribute('inert')) continue;
                    el.setAttribute('inert', '');
                    el.setAttribute('aria-hidden', 'true');
                    inertedSiblings.push(el);
                }
            } else {
                inertedSiblings.forEach(function (el) {
                    el.removeAttribute('inert');
                    el.removeAttribute('aria-hidden');
                });
                inertedSiblings = [];
            }
        };

        var moveFocusIntoNav = function () {
            // Move focus to the first focusable inside the nav so keyboard
            // users land in the menu, not somewhere offscreen.
            var firstFocusable = nav.querySelector(
                'a, button, [tabindex]:not([tabindex="-1"])'
            );
            if (firstFocusable) {
                firstFocusable.focus();
            }
        };

        var openNav = function () {
            lastFocusedBeforeOpen = document.activeElement;
            nav.classList.add('active');
            // Only now does the nav become a modal dialog context. Screen
            // readers and iOS Safari will treat it as a modal only while
            // it's visibly an overlay.
            nav.setAttribute('role', 'dialog');
            nav.setAttribute('aria-modal', 'true');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.style.position = 'fixed';
            toggle.style.top = '20px';
            toggle.style.right = '20px';
            toggle.style.zIndex = '1002';
            document.body.style.overflow = 'hidden';
            setBackgroundInert(true);
            // Defer focus to next frame so the overlay is paint-ready
            window.requestAnimationFrame(moveFocusIntoNav);
        };

        var closeNav = function () {
            nav.classList.remove('active');
            nav.removeAttribute('role');
            nav.removeAttribute('aria-modal');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.style.position = '';
            toggle.style.top = '';
            toggle.style.right = '';
            toggle.style.zIndex = '';
            document.body.style.overflow = '';
            setBackgroundInert(false);
            // Restore focus to whatever the user was on before opening
            if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === 'function') {
                lastFocusedBeforeOpen.focus();
            } else {
                toggle.focus();
            }
            lastFocusedBeforeOpen = null;
        };

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            if (nav.classList.contains('active')) {
                closeNav();
            } else {
                openNav();
            }
        });

        // Trap Tab key inside the overlay so keyboard users can't escape
        // back to the inert background.
        nav.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab' || !nav.classList.contains('active')) return;
            var focusables = nav.querySelectorAll(
                'a, button, [tabindex]:not([tabindex="-1"])'
            );
            if (focusables.length === 0) return;
            var first = focusables[0];
            var last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        // Escape closes the overlay
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && nav.classList.contains('active')) {
                closeNav();
            }
        });

        // Tapping a link inside the overlay closes it (mobile only).
        // We listen on nav itself with delegation to catch clones too.
        nav.addEventListener('click', function (e) {
            var link = e.target.closest('a');
            if (!link) return;
            if (window.innerWidth <= 768 && nav.classList.contains('active')) {
                closeNav();
            }
        });
    }

    // Universal Dropdown Handling
    var dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(function(dd) {
        var trigger = dd.querySelector(':scope > a, :scope > button, :scope > span[role="button"]');
        var menu = dd.querySelector('.dropdown-menu, .dropdown-content');
        if (!trigger || !menu) return;

        // Set initial ARIA
        trigger.setAttribute('aria-haspopup', 'true');
        trigger.setAttribute('aria-expanded', 'false');

        trigger.addEventListener('click', function(e) {
            if (window.innerWidth <= 768 || trigger.getAttribute('href') === '#') {
                e.preventDefault();
            }
            var isOpen = dd.classList.contains('open');
            // Close all other dropdowns
            dropdowns.forEach(function(d) {
                d.classList.remove('open');
                var t = d.querySelector(':scope > a, :scope > button, :scope > span[role="button"]');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
            if (!isOpen) {
                dd.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });

        // Keyboard: Enter/Space to toggle, Escape to close
        trigger.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                trigger.click();
            }
            if (e.key === 'Escape') {
                dd.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        });

        // Arrow key navigation within dropdown
        menu.querySelectorAll('a').forEach(function(link, idx, links) {
            link.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (idx < links.length - 1) links[idx + 1].focus();
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (idx > 0) links[idx - 1].focus();
                    else trigger.focus();
                }
                if (e.key === 'Escape') {
                    dd.classList.remove('open');
                    trigger.setAttribute('aria-expanded', 'false');
                    trigger.focus();
                }
            });
        });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            dropdowns.forEach(function(d) {
                d.classList.remove('open');
                var t = d.querySelector(':scope > a, :scope > button, :scope > span[role="button"]');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
        }
    });

    // (mobile nav Escape + link-click handlers are inside the if (toggle && nav)
    // block above, where they have access to the closeNav function that handles
    // inert background restoration and focus return)

    // Back-to-top button — uses the .visible class that styles.css already
    // defines (opacity + visibility transition). The previous implementation
    // set style.display directly, which never overrode the CSS visibility:hidden
    // base state, so the button was invisible on every page.
    var backToTopBtn = document.querySelector('.back-to-top');
    if (backToTopBtn) {
        var rafScheduled = false;
        var updateVisibility = function () {
            rafScheduled = false;
            var scrolled = document.body.scrollTop > 300 || document.documentElement.scrollTop > 300;
            backToTopBtn.classList.toggle('visible', scrolled);
        };
        window.addEventListener('scroll', function () {
            if (rafScheduled) return;
            rafScheduled = true;
            window.requestAnimationFrame(updateVisibility);
        }, { passive: true });
        // Run once on load in case the page is already scrolled
        updateVisibility();

        backToTopBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
})();