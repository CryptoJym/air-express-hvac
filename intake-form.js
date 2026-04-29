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

function getFirstControl(form, fieldName) {
    const control = form.elements.namedItem(fieldName);

    if (!control) {
        return null;
    }

    if (typeof control.tagName === "string") {
        return control;
    }

    return control[0] || null;
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

    ensureHiddenField(form, "return_to", returnTo);
    ensureHiddenField(form, "source_path", sourcePath);
}

function init() {
    const intakeState = getPageState();
    const forms = document.querySelectorAll("form[data-intake-form]");

    forms.forEach((form) => {
        initializeForm(form);
        renderStatus(form, intakeState);
    });
}

document.addEventListener("DOMContentLoaded", init);
