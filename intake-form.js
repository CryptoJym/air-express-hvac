const INTAKE_MESSAGES = {
    success: {
        title: "Request received",
        body: "We got your request and will follow up soon. If it is urgent, call (801) 766-8585.",
        className: "intake-status--success",
    },
    validation_error: {
        title: "Check the highlighted fields",
        body: "Some required details were missing or invalid. Review the marked fields and submit again.",
        className: "intake-status--validation",
    },
    upstream_error: {
        title: "We could not send that request",
        body: "Please try again in a moment or call (801) 766-8585 if you want help right now.",
        className: "intake-status--error",
    },
};

const TURNSTILE_CONFIG_URL = "/api/turnstile/config";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";
const TURNSTILE_ERROR_FIELD = "captcha";
const INTAKE_TRACKING_KEY_PREFIX = "airExpressIntakeTracked";
const ATTRIBUTION_FIELD_NAMES = [
    "trace_id",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
];

let turnstileConfigPromise;
let turnstileScriptPromise;

function getPageState() {
    const params = new URLSearchParams(window.location.search);

    return {
        intake: params.get("intake"),
        fields: params
            .get("fields")
            ?.split(",")
            .map((field) => field.trim())
            .filter(Boolean) ?? [],
    };
}

function getTurnstileGroup(form) {
    return form.querySelector("[data-intake-turnstile-group='true']");
}

function getTurnstileWidget(form) {
    return form.querySelector("[data-intake-turnstile='true']");
}

function getFirstControl(form, fieldName) {
    if (fieldName === TURNSTILE_ERROR_FIELD) {
        return getTurnstileWidget(form);
    }

    const control = form.elements.namedItem(fieldName);

    if (!control) {
        return null;
    }

    if (typeof control.tagName === "string") {
        return control;
    }

    return control[0] || null;
}

function getSubmitControl(form) {
    return form.querySelector("button[type='submit'], input[type='submit']");
}

function ensureHiddenField(form, name, value) {
    let field = form.querySelector(`input[type="hidden"][name="${name}"]`);

    if (!field) {
        field = document.createElement("input");
        field.type = "hidden";
        field.name = name;
        form.prepend(field);
    }

    field.value = value;
}

function setSubmitDisabled(form, disabled) {
    const submit = getSubmitControl(form);
    if (!submit) {
        return;
    }

    submit.disabled = disabled;
    submit.setAttribute("aria-disabled", disabled ? "true" : "false");
}

function safeSessionStorage() {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

function hiddenFieldValue(form, name) {
    return form.querySelector(`input[type="hidden"][name="${name}"]`)?.value || "";
}

function generateTraceId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    const random = Math.random().toString(36).slice(2, 10);
    return `air-${Date.now().toString(36)}-${random}`;
}

function attributionParameters(form) {
    return ATTRIBUTION_FIELD_NAMES.reduce((params, fieldName) => {
        const value = hiddenFieldValue(form, fieldName);
        if (value) {
            params[fieldName] = value;
        }
        return params;
    }, {});
}

function intakeTrackingKey(form, intakeState) {
    const formType = form.dataset.intakeForm || "intake";
    const traceId = hiddenFieldValue(form, "trace_id") || "no-trace";
    const sourcePath = hiddenFieldValue(form, "source_path") || window.location.pathname || "/";
    return [
        INTAKE_TRACKING_KEY_PREFIX,
        formType,
        intakeState.intake,
        traceId,
        sourcePath,
        window.location.pathname || "",
    ].join(":");
}

function trackIntakeSuccess(form, intakeState) {
    if (intakeState.intake !== "success" || typeof window.gtag !== "function") {
        return;
    }

    const storage = safeSessionStorage();
    const trackingKey = intakeTrackingKey(form, intakeState);
    if (storage?.getItem(trackingKey)) {
        return;
    }

    const formType = form.dataset.intakeForm || "intake";
    window.gtag("event", "generate_lead", {
        event_category: "lead",
        event_label: formType,
        form_type: formType,
        source_path: hiddenFieldValue(form, "source_path") || window.location.pathname || "/",
        page_location: window.location.href,
        ...attributionParameters(form),
    });

    storage?.setItem(trackingKey, "true");
}

function ensureTurnstileGroup(form) {
    let group = getTurnstileGroup(form);

    if (group) {
        return group;
    }

    group = document.createElement("div");
    group.className = "form-group turnstile-group";
    group.dataset.intakeTurnstileGroup = "true";

    const widget = document.createElement("div");
    widget.className = "intake-turnstile";
    widget.dataset.intakeTurnstile = "true";
    widget.tabIndex = -1;
    widget.setAttribute("aria-label", "Security verification");

    const message = document.createElement("p");
    message.className = "error-msg";
    message.dataset.intakeGenerated = "true";

    group.appendChild(widget);
    group.appendChild(message);

    const submit = getSubmitControl(form);
    if (submit) {
        submit.before(group);
    } else {
        form.appendChild(group);
    }

    return group;
}

function setTurnstileError(form, messageText) {
    const group = ensureTurnstileGroup(form);
    const message = group.querySelector(".error-msg");

    group.classList.add("has-error");
    if (message) {
        message.textContent = messageText;
    }
}

function clearTurnstileToken(form) {
    ensureHiddenField(form, TURNSTILE_RESPONSE_FIELD, "");
    form.dataset.turnstileVerified = "false";
    setSubmitDisabled(form, true);
}

function clearValidationState(form) {
    form.querySelectorAll(".form-group.has-error").forEach((group) => {
        group.classList.remove("has-error");
    });

    form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
        field.removeAttribute("aria-invalid");
    });

    form.querySelectorAll(".error-msg[data-intake-generated='true']").forEach((message) => {
        message.remove();
    });
}

function markInvalidFields(form, fieldNames) {
    if (!fieldNames.length) {
        return;
    }

    fieldNames.forEach((fieldName) => {
        const field = getFirstControl(form, fieldName);

        if (!field) {
            return;
        }

        if (fieldName === TURNSTILE_ERROR_FIELD) {
            field.setAttribute("aria-invalid", "true");
            setTurnstileError(form, "Please complete the security check and try again.");
            return;
        }

        const group = field.closest(".form-group");

        field.setAttribute("aria-invalid", "true");

        if (group) {
            group.classList.add("has-error");

            let message = group.querySelector(".error-msg");

            if (!message) {
                message = document.createElement("p");
                message.className = "error-msg";
                message.dataset.intakeGenerated = "true";
                group.appendChild(message);
            }

            message.textContent = "Please check this field and try again.";
        }
    });
}

function loadTurnstileConfig() {
    if (!turnstileConfigPromise) {
        turnstileConfigPromise = fetch(TURNSTILE_CONFIG_URL, {
            cache: "no-store",
            credentials: "same-origin",
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Turnstile config request failed with HTTP ${response.status}`);
                }
                return response.json();
            })
            .then((config) => {
                if (!config?.configured || !config.siteKey) {
                    throw new Error("Turnstile site key is not configured.");
                }
                return config;
            });
    }

    return turnstileConfigPromise;
}

function loadTurnstileScript() {
    if (window.turnstile?.render) {
        return Promise.resolve(window.turnstile);
    }

    if (!turnstileScriptPromise) {
        turnstileScriptPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
            const script = existingScript || document.createElement("script");

            script.addEventListener("load", () => resolve(window.turnstile));
            script.addEventListener("error", () => reject(new Error("Turnstile script failed to load.")));

            if (!existingScript) {
                script.src = TURNSTILE_SCRIPT_URL;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
        }).then((turnstile) => {
            if (!turnstile?.render) {
                throw new Error("Turnstile render API is unavailable.");
            }
            return turnstile;
        });
    }

    return turnstileScriptPromise;
}

async function initializeTurnstile(form) {
    const group = ensureTurnstileGroup(form);
    const widget = getTurnstileWidget(form);

    clearTurnstileToken(form);

    try {
        const [turnstileConfig, turnstile] = await Promise.all([
            loadTurnstileConfig(),
            loadTurnstileScript(),
        ]);

        const widgetId = turnstile.render(widget, {
            sitekey: turnstileConfig.siteKey,
            callback: (token) => {
                ensureHiddenField(form, TURNSTILE_RESPONSE_FIELD, token);
                form.dataset.turnstileVerified = "true";
                group.classList.remove("has-error");
                setSubmitDisabled(form, false);
            },
            "expired-callback": () => {
                clearTurnstileToken(form);
                turnstile.reset(widgetId);
            },
            "error-callback": () => {
                clearTurnstileToken(form);
                setTurnstileError(form, "Security check failed. Please try again.");
            },
        });

        form.dataset.turnstileWidgetId = widgetId;
    } catch (error) {
        console.error("[intake] Turnstile initialization failed", error);
        setTurnstileError(form, "Security check is unavailable. Please call (801) 766-8585.");
        setSubmitDisabled(form, true);
    }
}

function renderStatus(form, intakeState) {
    const status = form.parentElement?.querySelector(".intake-status");

    if (!status || !intakeState.intake || !INTAKE_MESSAGES[intakeState.intake]) {
        return;
    }

    const message = INTAKE_MESSAGES[intakeState.intake];

    status.hidden = false;
    status.className = `intake-status ${message.className}`;
    status.innerHTML = `<strong>${message.title}</strong><span>${message.body}</span>`;
    status.setAttribute("role", intakeState.intake === "validation_error" ? "alert" : "status");
    status.tabIndex = -1;

    if (intakeState.intake === "validation_error") {
        clearValidationState(form);
        markInvalidFields(form, intakeState.fields);
    } else {
        clearValidationState(form);
        trackIntakeSuccess(form, intakeState);
    }

    status.focus?.({ preventScroll: true });

    if (intakeState.intake === "validation_error") {
        const firstInvalidField = intakeState.fields
            .map((fieldName) => getFirstControl(form, fieldName))
            .find(Boolean);

        firstInvalidField?.focus?.({ preventScroll: true });
    }
}

function initializeForm(form) {
    const returnTo = form.dataset.intakeReturn || window.location.pathname || "/";
    const sourcePath = window.location.pathname || returnTo;
    const params = new URLSearchParams(window.location.search);
    const traceId = hiddenFieldValue(form, "trace_id") || generateTraceId();

    ensureHiddenField(form, "return_to", returnTo);
    ensureHiddenField(form, "source_path", sourcePath);
    ensureHiddenField(form, "trace_id", traceId);
    ATTRIBUTION_FIELD_NAMES
        .filter((fieldName) => fieldName !== "trace_id")
        .forEach((fieldName) => {
            const value = params.get(fieldName) || hiddenFieldValue(form, fieldName);
            if (value) {
                ensureHiddenField(form, fieldName, value);
            }
        });
    ensureHiddenField(form, TURNSTILE_RESPONSE_FIELD, "");
    ensureTurnstileGroup(form);
}

function init() {
    const intakeState = getPageState();
    const forms = document.querySelectorAll("form[data-intake-form]");

    forms.forEach((form) => {
        initializeForm(form);
        renderStatus(form, intakeState);
        initializeTurnstile(form);
    });
}

document.addEventListener("DOMContentLoaded", init);
