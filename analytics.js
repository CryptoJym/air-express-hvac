(function () {
  var measurementId = "G-JZ7PY32EVX";
  var clarityProjectId = "x6kyvscnuu";
  var attributionStorageKey = "airExpressIntakeAttribution";
  var attributionFieldNames = [
    "trace_id",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "gbraid",
    "wbraid",
    "msclkid",
    "fbclid"
  ];
  var trackedScrollDepths = {};
  var startedForms = new WeakSet();

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: true,
    page_location: window.location.href,
    page_title: document.title
  });

  function loadClarity(projectId) {
    if (!projectId || window.clarity) {
      return;
    }

    window.clarity = function clarity() {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.clarity.ms/tag/" + encodeURIComponent(projectId);
    document.head.appendChild(script);
  }

  loadClarity(clarityProjectId);

  function safeSessionStorage() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  function cleanTrackingValue(value, maxLength) {
    return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength || 120);
  }

  function safeReferrerPath(referrer) {
    try {
      var url = new URL(referrer);
      return url.origin === window.location.origin ? "" : url.origin + url.pathname;
    } catch {
      return "";
    }
  }

  function readStoredAttribution(storage) {
    if (!storage) {
      return {};
    }

    try {
      return JSON.parse(storage.getItem(attributionStorageKey) || "{}") || {};
    } catch {
      return {};
    }
  }

  function persistAttribution() {
    var storage = safeSessionStorage();
    if (!storage) {
      return {};
    }

    var params = new URLSearchParams(window.location.search);
    var attribution = readStoredAttribution(storage);
    attribution.landing_page = attribution.landing_page || window.location.pathname || "/";

    var referrerPath = safeReferrerPath(document.referrer);
    if (referrerPath && !attribution.referrer) {
      attribution.referrer = cleanTrackingValue(referrerPath, 240);
    }

    attributionFieldNames.forEach(function (fieldName) {
      var value = cleanTrackingValue(params.get(fieldName), 120);
      if (value) {
        attribution[fieldName] = value;
      }
    });

    storage.setItem(attributionStorageKey, JSON.stringify(attribution));
    return attribution;
  }

  persistAttribution();

  function setClarityConsent(adStorage, analyticsStorage) {
    if (typeof window.clarity !== "function") {
      return;
    }

    window.clarity("consentv2", {
      ad_Storage: adStorage === "granted" ? "granted" : "denied",
      analytics_Storage: analyticsStorage === "granted" ? "granted" : "denied"
    });
  }

  window.airExpressClarityConsent = setClarityConsent;
  window.addEventListener("airExpressConsentGranted", function () {
    setClarityConsent("granted", "granted");
  });
  window.addEventListener("airExpressConsentDenied", function () {
    setClarityConsent("denied", "denied");
  });

  function pageContext() {
    return {
      page_location: window.location.href,
      page_title: document.title,
      page_path: window.location.pathname || "/"
    };
  }

  function trackEvent(eventName, parameters) {
    if (typeof window.gtag !== "function") {
      return;
    }

    window.gtag("event", eventName, Object.assign(pageContext(), parameters || {}));
  }

  function closestSectionLabel(element) {
    var section = element.closest("section, header, footer, main");
    var heading = section && section.querySelector("h1, h2, h3");
    return (heading && heading.textContent.trim().replace(/\s+/g, " ").slice(0, 80)) || "site";
  }

  function safeLinkText(element) {
    return (element.textContent || element.getAttribute("aria-label") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
  }

  function isDownloadPath(pathname) {
    return /\.(pdf|docx?|xlsx?|pptx?|zip|csv|ics)$/i.test(pathname);
  }

  function formName(form) {
    return form.dataset.intakeForm || form.getAttribute("name") || form.getAttribute("id") || "form";
  }

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link) {
        return;
      }

      var href = link.getAttribute("href") || "";
      var linkText = safeLinkText(link);
      var ctaLocation = closestSectionLabel(link);

      if (/^tel:/i.test(href)) {
        trackEvent("phone_clicked", {
          event_category: "lead",
          link_text: linkText,
          cta_location: ctaLocation
        });
      }

      if (link.classList.contains("cta-btn") || /estimate|schedule|contact|call/i.test(linkText)) {
        trackEvent("cta_clicked", {
          event_category: "engagement",
          link_text: linkText,
          link_url: href,
          cta_location: ctaLocation
        });
      }

      try {
        var url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin && /^https?:$/i.test(url.protocol)) {
          trackEvent("outbound_link_clicked", {
            event_category: "engagement",
            link_text: linkText,
            link_url: url.href
          });
        }

        if (isDownloadPath(url.pathname)) {
          trackEvent("resource_downloaded", {
            event_category: "engagement",
            resource_name: url.pathname.split("/").pop() || "download",
            resource_type: url.pathname.split(".").pop().toLowerCase()
          });
        }
      } catch {
        // Ignore malformed href values; they should not block page tracking.
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "focusin",
    function (event) {
      var form = event.target && event.target.closest ? event.target.closest("form") : null;
      if (!form || startedForms.has(form)) {
        return;
      }

      startedForms.add(form);
      trackEvent("form_started", {
        event_category: "lead",
        form_name: formName(form),
        form_location: closestSectionLabel(form)
      });
    },
    { passive: true }
  );

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.matches || !form.matches("form")) {
      return;
    }

    trackEvent("form_submitted", {
      event_category: "lead",
      form_name: formName(form),
      form_location: closestSectionLabel(form)
    });
  });

  window.addEventListener(
    "scroll",
    function () {
      var documentElement = document.documentElement;
      var scrollableHeight = Math.max(
        documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      ) - window.innerHeight;

      if (scrollableHeight <= 0) {
        return;
      }

      var percent = Math.round((window.scrollY / scrollableHeight) * 100);
      [25, 50, 75, 90].forEach(function (depth) {
        if (percent >= depth && !trackedScrollDepths[depth]) {
          trackedScrollDepths[depth] = true;
          trackEvent("scroll_depth", {
            event_category: "engagement",
            depth: depth
          });
        }
      });
    },
    { passive: true }
  );
})();
