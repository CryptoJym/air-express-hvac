(function() {
    // Universal Mobile Navigation Toggle
    var toggle = document.querySelector('.nav-toggle');
    // Try multiple selectors for the nav element
    var nav = document.querySelector('header nav') ||
              document.querySelector('.nav-menu') ||
              document.querySelector('.nav-links') ||
              document.querySelector('nav');

    if (toggle && nav) {
        // Create mobile CTA block inside nav (phone + estimate button)
        var headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            var mobileCta = headerActions.cloneNode(true);
            mobileCta.classList.add('mobile-nav-cta');
            nav.appendChild(mobileCta);
        }

        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            nav.classList.toggle('active');
            var expanded = nav.classList.contains('active');
            toggle.setAttribute('aria-expanded', String(expanded));
            if (expanded) {
                toggle.style.position = 'fixed';
                toggle.style.top = '20px';
                toggle.style.right = '20px';
                toggle.style.zIndex = '1002';
                document.body.style.overflow = 'hidden';
            } else {
                toggle.style.position = '';
                toggle.style.top = '';
                toggle.style.right = '';
                toggle.style.zIndex = '';
                document.body.style.overflow = '';
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

    // Close mobile nav on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && nav && nav.classList.contains('active')) {
            nav.classList.remove('active');
            document.body.style.overflow = '';
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
                toggle.style.position = '';
                toggle.style.top = '';
                toggle.style.right = '';
                toggle.style.zIndex = '';
                toggle.focus();
            }
        }
    });

    // Close mobile nav on link click
    if (nav) {
        nav.querySelectorAll('a:not(.dropdown > a)').forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768 && nav.classList.contains('active')) {
                    nav.classList.remove('active');
                    document.body.style.overflow = '';
                    if (toggle) {
                        toggle.setAttribute('aria-expanded', 'false');
                        toggle.style.position = '';
                        toggle.style.top = '';
                        toggle.style.right = '';
                        toggle.style.zIndex = '';
                    }
                }
            });
        });
    }

    // Back-to-top button functionality
    var backToTopBtn = document.querySelector('.back-to-top');
    if (backToTopBtn) {
        window.addEventListener('scroll', function() {
            if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
                backToTopBtn.style.display = 'block';
            } else {
                backToTopBtn.style.display = 'none';
            }
        });

        backToTopBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
})();