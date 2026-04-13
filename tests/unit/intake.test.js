import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIntakeLeadPayload,
  normalizeIntakeSubmission,
  sanitizeRelativeReturnPath,
} from "../../api/_lib/intake.js";

const CONTACT_MODULE_URL = "../../api/intake/contact.js";
const ESTIMATE_MODULE_URL = "../../api/intake/estimate.js";
const SCHEDULE_MODULE_URL = "../../api/intake/schedule.js";

function buildFormData(entries) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== null) {
      formData.set(key, value);
    }
  }
  return formData;
}

function buildRequest(path, formData) {
  return new Request(`https://air-express.local${path}`, {
    method: "POST",
    body: formData,
  });
}

function setProcessEnv(overrides) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function createServiceTitanResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const serviceTitanMockState = {
  calls: [],
  leadRequests: [],
  leadStatus: 200,
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  serviceTitanMockState.calls.push({ url, init });

  if (url === "https://auth-integration.servicetitan.io/connect/token") {
    return createServiceTitanResponse(JSON.stringify({ access_token: "token-123", expires_in: 3600 }));
  }

  if (url === "https://api-integration.servicetitan.io/crm/v2/tenant/4378713196/leads") {
    serviceTitanMockState.leadRequests.push(JSON.parse(init.body));
    return new Response(
      serviceTitanMockState.leadStatus >= 400 ? "ServiceTitan unavailable" : "",
      { status: serviceTitanMockState.leadStatus }
    );
  }

  throw new Error(`Unexpected fetch call: ${url}`);
};

process.on("exit", () => {
  globalThis.fetch = originalFetch;
});

test("sanitizeRelativeReturnPath rejects open redirects", () => {
  assert.equal(
    sanitizeRelativeReturnPath("https://evil.example.com/path", "/contact.html"),
    "/contact.html"
  );
  assert.equal(sanitizeRelativeReturnPath("//evil.example.com/path", "/contact.html"), "/contact.html");
});

test("endpoint wrappers export callable handlers", async () => {
  const [contactModule, estimateModule, scheduleModule] = await Promise.all([
    import(CONTACT_MODULE_URL),
    import(ESTIMATE_MODULE_URL),
    import(SCHEDULE_MODULE_URL),
  ]);

  for (const [name, module] of [
    ["contact", contactModule],
    ["estimate", estimateModule],
    ["schedule", scheduleModule],
  ]) {
    assert.equal(typeof module.default, "function", `${name} wrapper default export should be callable`);
    assert.equal(module.config?.runtime, "edge", `${name} wrapper should use the edge runtime shape`);
  }
});

test("contact wrapper normalizes unknown service values and submits a lead", async () => {
  serviceTitanMockState.calls.length = 0;
  serviceTitanMockState.leadRequests.length = 0;
  serviceTitanMockState.leadStatus = 200;
  const restoreEnv = setProcessEnv({
    SERVICETITAN_ENV: "integration",
    SERVICETITAN_TENANT_ID: "4378713196",
    SERVICETITAN_APP_KEY: "app-key",
    SERVICETITAN_CLIENT_ID: "client-id",
      SERVICETITAN_CLIENT_SECRET: "client-secret",
      SERVICETITAN_API_BASE_URL: "https://api-integration.servicetitan.io",
      SERVICETITAN_AUTH_URL: "https://auth-integration.servicetitan.io/connect/token",
      SERVICETITAN_LEAD_CAMPAIGN_ID: "80365413",
    });

  try {
    const { default: contactHandler } = await import(CONTACT_MODULE_URL);
    const response = await contactHandler(
      buildRequest(
        "/api/intake/contact",
        buildFormData({
          name: "Jordan Example",
          email: "jordan@example.com",
          phone: "(801) 555-0100",
          service: "tampered-service-value",
          message: "The AC is blowing warm air.",
          return_to: "https://evil.example.com/hijack",
          source_path: "/contact.html",
        })
      )
    );

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/contact.html?intake=success");
    assert.equal(serviceTitanMockState.leadRequests.length, 1);
    assert.equal(serviceTitanMockState.leadRequests[0].campaignId, 80365413);
    assert.equal(serviceTitanMockState.leadRequests[0].leadCustomerName, "Jordan Example");
    assert.equal(serviceTitanMockState.leadRequests[0].leadPhone, "(801) 555-0100");
    assert.equal(serviceTitanMockState.leadRequests[0].leadEmail, "jordan@example.com");
    assert.match(serviceTitanMockState.leadRequests[0].summary, /Air Express Website Lead - Something Else/);
    assert.match(serviceTitanMockState.leadRequests[0].body, /Form Type: contact/);
    assert.match(serviceTitanMockState.leadRequests[0].body, /Requested Service: Something Else/);
    assert.match(serviceTitanMockState.leadRequests[0].body, /Source Page: \/contact.html/);
    assert.match(serviceTitanMockState.leadRequests[0].body, /Submitted At:/);
    assert.match(serviceTitanMockState.leadRequests[0].body, /Message:\nThe AC is blowing warm air\./);
    assert.match(serviceTitanMockState.leadRequests[0].followUpDate, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    restoreEnv();
  }
});

test("estimate wrapper redirects deterministically on validation failure", async () => {
  serviceTitanMockState.calls.length = 0;
  serviceTitanMockState.leadRequests.length = 0;
  serviceTitanMockState.leadStatus = 200;
  const { default: estimateHandler } = await import(ESTIMATE_MODULE_URL);
  const response = await estimateHandler(
    buildRequest(
      "/api/intake/estimate",
      buildFormData({
        name: "Jordan Example",
        email: "",
        phone: "",
        service: "",
      })
    )
  );

  assert.equal(serviceTitanMockState.calls.length, 0);
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("Location"),
    "/request-estimate.html?intake=validation_error&fields=email%2Cphone%2Cservice"
  );
});

test("schedule wrapper includes preferred date and redirects on upstream error", async () => {
  serviceTitanMockState.calls.length = 0;
  serviceTitanMockState.leadRequests.length = 0;
  serviceTitanMockState.leadStatus = 500;
  const restoreEnv = setProcessEnv({
    SERVICETITAN_ENV: "integration",
    SERVICETITAN_TENANT_ID: "4378713196",
    SERVICETITAN_APP_KEY: "app-key",
    SERVICETITAN_CLIENT_ID: "client-id",
      SERVICETITAN_CLIENT_SECRET: "client-secret",
      SERVICETITAN_API_BASE_URL: "https://api-integration.servicetitan.io",
      SERVICETITAN_AUTH_URL: "https://auth-integration.servicetitan.io/connect/token",
      SERVICETITAN_LEAD_CAMPAIGN_ID: "80365413",
    });

  try {
    const { default: scheduleHandler } = await import(SCHEDULE_MODULE_URL);
    const response = await scheduleHandler(
      buildRequest(
        "/api/intake/schedule",
        buildFormData({
          name: "Jordan Example",
          phone: "(801) 555-0100",
          address: "123 Main St, Lehi, UT",
          service: "AC Repair",
          preferred_date: "2026-04-20",
          preferred_time: "Morning (8am-12pm)",
          notes: "Please call before arrival.",
        })
      )
    );

    assert.equal(serviceTitanMockState.leadRequests.length, 1);
    assert.match(serviceTitanMockState.leadRequests[0].body, /Preferred Date: 2026-04-20/);
    assert.match(serviceTitanMockState.leadRequests[0].body, /Preferred Time: Morning \(8am-12pm\)/);
    assert.match(serviceTitanMockState.leadRequests[0].body, /Notes:\nPlease call before arrival\./);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/schedule-service.html?intake=upstream_error");
  } finally {
    restoreEnv();
  }
});

test("normalizeIntakeSubmission uses the configured safe fallback service", () => {
  const contactSubmission = normalizeIntakeSubmission(
    "contact",
    buildFormData({
      name: "Jordan Example",
      email: "jordan@example.com",
      phone: "(801) 555-0100",
      service: "tampered-service-value",
    }),
    {
      now: () => new Date("2026-04-13T20:15:30.000Z"),
    }
  );

  assert.equal(contactSubmission.service, "Something Else");
  assert.equal(contactSubmission.freeformNotes, "");
});

test("normalizeIntakeSubmission supports the shared service vocabulary", () => {
  const contactSubmission = normalizeIntakeSubmission(
    "contact",
    buildFormData({
      name: "Jordan Example",
      email: "jordan@example.com",
      phone: "(801) 555-0100",
      service: "maintenance-tune-up",
    }),
    {
      now: () => new Date("2026-04-13T20:15:30.000Z"),
    }
  );

  const estimateSubmission = normalizeIntakeSubmission(
    "estimate",
    buildFormData({
      name: "Jordan Example",
      email: "jordan@example.com",
      phone: "(801) 555-0100",
      service: "air-conditioning-installation",
    }),
    {
      now: () => new Date("2026-04-13T20:15:30.000Z"),
    }
  );

  const scheduleSubmission = normalizeIntakeSubmission(
    "schedule",
    buildFormData({
      name: "Jordan Example",
      phone: "(801) 555-0100",
      address: "123 Main St, Lehi, UT",
      service: "air-quality",
    }),
    {
      now: () => new Date("2026-04-13T20:15:30.000Z"),
    }
  );

  assert.equal(contactSubmission.service, "Maintenance / Tune-Up");
  assert.equal(estimateSubmission.service, "AC Installation");
  assert.equal(scheduleSubmission.service, "Air Quality / Filters");
});

test("buildIntakeLeadPayload uses live CRM field names and defaults follow-up date", () => {
  const submission = normalizeIntakeSubmission(
    "contact",
    buildFormData({
      name: "Jordan Example",
      email: "jordan@example.com",
      phone: "(801) 555-0100",
      service: "maintenance-tune-up",
      message: "Please call back soon.",
    }),
    {
      now: () => new Date("2026-04-13T20:15:30.000Z"),
    }
  );

  const payload = buildIntakeLeadPayload(submission, {
    SERVICETITAN_LEAD_CAMPAIGN_ID: "80365413",
  });

  assert.deepEqual(
    Object.keys(payload).sort(),
    ["body", "campaignId", "followUpDate", "leadCustomerName", "leadEmail", "leadPhone", "summary"]
  );
  assert.equal(payload.campaignId, 80365413);
  assert.equal(payload.summary, "Air Express Website Lead - Maintenance / Tune-Up");
  assert.match(payload.body, /Form Type: contact/);
  assert.match(payload.body, /Requested Service: Maintenance \/ Tune-Up/);
  assert.equal(payload.leadCustomerName, "Jordan Example");
  assert.equal(payload.leadEmail, "jordan@example.com");
  assert.equal(payload.leadPhone, "(801) 555-0100");
  assert.equal(payload.followUpDate, "2026-04-14T20:15:30.000Z");
});

test("buildIntakeLeadPayload prefers call reason over default follow-up date when configured", () => {
  const submission = normalizeIntakeSubmission(
    "estimate",
    buildFormData({
      name: "Jordan Example",
      email: "jordan@example.com",
      phone: "(801) 555-0100",
      service: "AC Repair",
    }),
    {
      now: () => new Date("2026-04-13T20:15:30.000Z"),
    }
  );

  const payload = buildIntakeLeadPayload(submission, {
    SERVICETITAN_LEAD_CAMPAIGN_ID: "80365413",
    SERVICETITAN_LEAD_CALL_REASON_ID: "27",
    SERVICETITAN_LEAD_BUSINESS_UNIT_ID: "11",
    SERVICETITAN_LEAD_JOB_TYPE_ID: "22",
  });

  assert.equal(payload.campaignId, 80365413);
  assert.equal(payload.callReasonId, 27);
  assert.equal(payload.businessUnitId, 11);
  assert.equal(payload.jobTypeId, 22);
  assert.equal("followUpDate" in payload, false);
});
