import {
  getServiceTitanConfig,
  serviceTitanAuthorizedRequest,
} from "./servicetitan-client.js";

export const INTAKE_FORMS = Object.freeze({
  contact: Object.freeze({
    defaultReturnTo: "/contact.html",
    fallbackService: "Something Else",
    requiredFields: Object.freeze(["name", "email", "phone", "service"]),
    serviceMap: Object.freeze({
      ac: "Air Conditioning",
      "air-conditioning-repair": "Air Conditioning",
      heating: "Heating & Furnace",
      "heating-repair": "Heating & Furnace",
      "heat-pump": "Heat Pump",
      ventilation: "Air Quality & Ventilation",
      "air-quality": "Air Quality & Ventilation",
      maintenance: "Maintenance / Tune-Up",
      "maintenance-tune-up": "Maintenance / Tune-Up",
      emergency: "Emergency Repair",
      "emergency-service": "Emergency Repair",
      other: "Something Else",
    }),
  }),
  estimate: Object.freeze({
    defaultReturnTo: "/request-estimate.html",
    fallbackService: "Other",
    requiredFields: Object.freeze(["name", "email", "phone", "service"]),
    serviceMap: Object.freeze({
      "AC Repair": "AC Repair",
      "air-conditioning-repair": "AC Repair",
      "AC Installation": "AC Installation",
      "air-conditioning-installation": "AC Installation",
      "Heating Repair": "Heating Repair",
      "heating-repair": "Heating Repair",
      "Furnace Installation": "Furnace Installation",
      "furnace-installation": "Furnace Installation",
      "Heat Pump": "Heat Pump",
      "heat-pump": "Heat Pump",
      "Air Quality": "Air Quality / Filtration",
      "air-quality": "Air Quality / Filtration",
      "Maintenance Plan": "Maintenance Plan",
      "maintenance-tune-up": "Maintenance Plan",
      "New Construction": "New Construction HVAC",
      "new-construction": "New Construction HVAC",
      Other: "Other",
      other: "Other",
    }),
  }),
  schedule: Object.freeze({
    defaultReturnTo: "/schedule-service.html",
    fallbackService: "Other",
    requiredFields: Object.freeze(["name", "phone", "address", "service"]),
    serviceMap: Object.freeze({
      "AC Repair": "AC Repair",
      "air-conditioning-repair": "AC Repair",
      "Heating Repair": "Heating / Furnace Repair",
      "heating-repair": "Heating / Furnace Repair",
      Maintenance: "Maintenance / Tune-Up",
      "maintenance-tune-up": "Maintenance / Tune-Up",
      Installation: "New Installation",
      "new-installation": "New Installation",
      "Air Quality": "Air Quality / Filters",
      "air-quality": "Air Quality / Filters",
      Emergency: "Emergency Service",
      "emergency-service": "Emergency Service",
      Other: "Other",
      other: "Other",
    }),
  }),
});

const RESULT_QUERY_VALUES = Object.freeze({
  success: "success",
  validationError: "validation_error",
  upstreamError: "upstream_error",
});

const REQUIRED_LEAD_ENV_KEYS = Object.freeze({
  campaignId: "SERVICETITAN_LEAD_CAMPAIGN_ID",
});

const OPTIONAL_LEAD_ENV_KEYS = Object.freeze({
  businessUnitId: "SERVICETITAN_LEAD_BUSINESS_UNIT_ID",
  callReasonId: "SERVICETITAN_LEAD_CALL_REASON_ID",
  jobTypeId: "SERVICETITAN_LEAD_JOB_TYPE_ID",
});

const RESEND_EMAILS_API_URL = "https://api.resend.com/emails";
const INTAKE_NOTIFICATION_ENV_KEYS = Object.freeze({
  resendApiKey: "RESEND_API_KEY",
  from: "INTAKE_NOTIFICATION_FROM",
  to: "INTAKE_NOTIFICATION_TO",
  cc: "INTAKE_NOTIFICATION_CC",
  bcc: "INTAKE_NOTIFICATION_BCC",
});

const DEFAULT_LEAD_FOLLOW_UP_DELAY_MS = 24 * 60 * 60 * 1000;

function readStringField(formData, name) {
  const value = formData.get(name);
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function isSafeRelativePath(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) || trimmed.startsWith("//")) {
    return false;
  }

  try {
    const resolved = new URL(trimmed, "https://air-express.local");
    return resolved.origin === "https://air-express.local";
  } catch {
    return false;
  }
}

export function sanitizeRelativeReturnPath(value, fallbackPath) {
  const fallback = isSafeRelativePath(fallbackPath) ? fallbackPath.trim() : "/";
  if (!isSafeRelativePath(value)) {
    return fallback;
  }

  const resolved = new URL(value.trim(), "https://air-express.local");
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

function normalizeFreeformNotes(formData) {
  const parts = [];
  const message = readStringField(formData, "message");
  const notes = readStringField(formData, "notes");

  if (message) {
    parts.push(`Message:\n${message}`);
  }
  if (notes) {
    parts.push(`Notes:\n${notes}`);
  }

  return parts.join("\n\n");
}

function normalizeServiceValue(formType, rawService) {
  const fallbackService = INTAKE_FORMS[formType]?.fallbackService || "";
  const normalized = typeof rawService === "string" ? rawService.trim() : "";
  if (!normalized) {
    return fallbackService;
  }

  return INTAKE_FORMS[formType]?.serviceMap?.[normalized] || fallbackService;
}

function parseMissingFields(formData, requiredFields) {
  return requiredFields.filter((field) => !readStringField(formData, field));
}

function buildLeadSummary(submission) {
  return `Air Express Website Lead - ${submission.service}`;
}

function buildSummaryLines(submission) {
  const lines = [
    "Air Express Website Lead",
    `Form Type: ${submission.formType}`,
    `Requested Service: ${submission.service}`,
    `Source Page: ${submission.sourcePath}`,
    `Submitted At: ${submission.submittedAt}`,
  ];

  if (submission.formType === "schedule" && submission.preferredDate) {
    lines.push(`Preferred Date: ${submission.preferredDate}`);
  }
  if (submission.formType === "schedule" && submission.preferredTime) {
    lines.push(`Preferred Time: ${submission.preferredTime}`);
  }

  lines.push(`Name: ${submission.name}`);
  if (submission.email) {
    lines.push(`Email: ${submission.email}`);
  }
  lines.push(`Phone: ${submission.phone}`);
  if (submission.address) {
    lines.push(`Address: ${submission.address}`);
  }

  if (submission.freeformNotes) {
    lines.push("");
    lines.push(submission.freeformNotes);
  }

  return lines.join("\n");
}

function parsePositiveIntegerEnv(value, envName, { required = false } = {}) {
  const parsedValue = typeof value === "string" ? value.trim() : "";

  if (!parsedValue) {
    if (required) {
      throw new Error(`Missing required environment variable: ${envName}`);
    }
    return undefined;
  }

  const numberValue = Number(parsedValue);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`Invalid positive integer for ${envName}: ${parsedValue}`);
  }

  return numberValue;
}

function parseEmailListEnv(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadIntakeNotificationConfig(env = process.env) {
  const resendApiKey = typeof env?.[INTAKE_NOTIFICATION_ENV_KEYS.resendApiKey] === "string"
    ? env[INTAKE_NOTIFICATION_ENV_KEYS.resendApiKey].trim()
    : "";
  const from = typeof env?.[INTAKE_NOTIFICATION_ENV_KEYS.from] === "string"
    ? env[INTAKE_NOTIFICATION_ENV_KEYS.from].trim()
    : "";
  const to = parseEmailListEnv(env?.[INTAKE_NOTIFICATION_ENV_KEYS.to]);

  if (!resendApiKey || !from || to.length === 0) {
    return null;
  }

  const cc = parseEmailListEnv(env?.[INTAKE_NOTIFICATION_ENV_KEYS.cc]);
  const bcc = parseEmailListEnv(env?.[INTAKE_NOTIFICATION_ENV_KEYS.bcc]);

  return Object.freeze({
    resendApiKey,
    from,
    to,
    cc,
    bcc,
  });
}

function buildLeadMetadataFromEnv(env = process.env) {
  const metadata = {
    campaignId: parsePositiveIntegerEnv(env?.[REQUIRED_LEAD_ENV_KEYS.campaignId], REQUIRED_LEAD_ENV_KEYS.campaignId, {
      required: true,
    }),
  };

  for (const [key, envName] of Object.entries(OPTIONAL_LEAD_ENV_KEYS)) {
    const value = parsePositiveIntegerEnv(env?.[envName], envName);
    if (value !== undefined) {
      metadata[key] = value;
    }
  }

  return metadata;
}

function buildDefaultFollowUpDate(submission) {
  const submittedAtMs = Date.parse(submission.submittedAt);
  const baseMs = Number.isFinite(submittedAtMs) ? submittedAtMs : Date.now();
  return new Date(baseMs + DEFAULT_LEAD_FOLLOW_UP_DELAY_MS).toISOString();
}

export function normalizeIntakeSubmission(formType, formData, { now = () => new Date() } = {}) {
  const spec = INTAKE_FORMS[formType];
  if (!spec) {
    throw new Error(`Unsupported intake form type: ${formType}`);
  }

  const missingFields = parseMissingFields(formData, spec.requiredFields);
  const returnTo = sanitizeRelativeReturnPath(
    readStringField(formData, "return_to"),
    spec.defaultReturnTo
  );
  const sourcePath = sanitizeRelativeReturnPath(
    readStringField(formData, "source_path"),
    spec.defaultReturnTo
  );
  const submittedAt = now().toISOString();
  const service = normalizeServiceValue(formType, readStringField(formData, "service"));
  const preferredDate = readStringField(formData, "preferred_date");
  const preferredTime = readStringField(formData, "preferred_time");

  return {
    formType,
    returnTo,
    sourcePath,
    submittedAt,
    name: readStringField(formData, "name"),
    email: readStringField(formData, "email"),
    phone: readStringField(formData, "phone"),
    address: readStringField(formData, "address"),
    service,
    preferredDate,
    preferredTime,
    freeformNotes: normalizeFreeformNotes(formData),
    missingFields,
  };
}

export function buildLeadPayload(submission, env = process.env) {
  const metadata = buildLeadMetadataFromEnv(env);
  const payload = {
    campaignId: metadata.campaignId,
    summary: buildLeadSummary(submission),
    body: buildSummaryLines(submission),
    leadCustomerName: submission.name,
    leadPhone: submission.phone,
  };

  if (submission.email) {
    payload.leadEmail = submission.email;
  }
  if (submission.address) {
    payload.leadStreet = submission.address;
  }

  if (metadata.businessUnitId !== undefined) {
    payload.businessUnitId = metadata.businessUnitId;
  }
  if (metadata.jobTypeId !== undefined) {
    payload.jobTypeId = metadata.jobTypeId;
  }
  if (metadata.callReasonId !== undefined) {
    payload.callReasonId = metadata.callReasonId;
  } else {
    payload.followUpDate = buildDefaultFollowUpDate(submission);
  }

  return payload;
}

export function buildIntakeNotificationEmailPayload(submission, env = process.env) {
  const notificationConfig = loadIntakeNotificationConfig(env);
  if (!notificationConfig) {
    return null;
  }

  const payload = {
    from: notificationConfig.from,
    to: notificationConfig.to,
    subject: buildLeadSummary(submission),
    text: buildSummaryLines(submission),
  };

  if (notificationConfig.cc.length > 0) {
    payload.cc = notificationConfig.cc;
  }
  if (notificationConfig.bcc.length > 0) {
    payload.bcc = notificationConfig.bcc;
  }
  if (submission.email) {
    payload.reply_to = [submission.email];
  }

  return payload;
}

function buildRelativeRedirect(path, searchParams = {}) {
  const url = new URL(path, "https://air-express.local");
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function redirectResponse(path, searchParams = {}) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: buildRelativeRedirect(path, searchParams),
      "Cache-Control": "no-store",
    },
  });
}

function methodNotAllowedResponse() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "POST",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

async function defaultSubmitLead(submission, env = process.env) {
  const { tenantId } = getServiceTitanConfig();
  const leadEndpointPath = `/crm/v2/tenant/${tenantId}/leads`;
  const response = await serviceTitanAuthorizedRequest(leadEndpointPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(buildLeadPayload(submission, env)),
  });

  if (!response.ok) {
    throw new Error(`ServiceTitan lead request failed with HTTP ${response.status}`);
  }

  return response;
}

export async function sendIntakeNotificationEmail(
  submission,
  { env = process.env, fetchImpl = globalThis.fetch } = {}
) {
  const notificationConfig = loadIntakeNotificationConfig(env);
  if (!notificationConfig) {
    return { skipped: true, reason: "not_configured" };
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to send intake notification email.");
  }

  const response = await fetchImpl(RESEND_EMAILS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notificationConfig.resendApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(buildIntakeNotificationEmailPayload(submission, env)),
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;

    try {
      const responseText = await response.text();
      if (responseText) {
        errorDetail = responseText;
      }
    } catch {
      // Ignore response parsing failures and preserve the status-based fallback.
    }

    throw new Error(`Notification email request failed: ${errorDetail}`);
  }

  return { skipped: false };
}

export function createIntakeHandler({
  formType,
  defaultReturnTo = INTAKE_FORMS[formType]?.defaultReturnTo,
  submitLead = defaultSubmitLead,
  notifySubmission = sendIntakeNotificationEmail,
  now = () => new Date(),
} = {}) {
  if (!INTAKE_FORMS[formType]) {
    throw new Error(`Unsupported intake form type: ${formType}`);
  }

  return async function POST(request) {
    if (request.method !== "POST") {
      return methodNotAllowedResponse();
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return redirectResponse(defaultReturnTo, {
        intake: RESULT_QUERY_VALUES.validationError,
        fields: INTAKE_FORMS[formType].requiredFields.join(","),
      });
    }

    const submission = normalizeIntakeSubmission(formType, formData, { now });

    if (submission.missingFields.length > 0) {
      return redirectResponse(submission.returnTo || defaultReturnTo, {
        intake: RESULT_QUERY_VALUES.validationError,
        fields: submission.missingFields.join(","),
      });
    }

    try {
      await submitLead(submission);
    } catch (error) {
      console.error(`[intake:${formType}] ServiceTitan lead submission failed`, error);
      return redirectResponse(submission.returnTo || defaultReturnTo, {
        intake: RESULT_QUERY_VALUES.upstreamError,
      });
    }

    try {
      const notificationResult = await notifySubmission(submission);
      if (notificationResult?.skipped) {
        console.warn(`[intake:${formType}] Intake notification skipped: ${notificationResult.reason}`);
      } else {
        console.info(`[intake:${formType}] Intake notification sent`);
      }
    } catch (error) {
      console.error(`[intake:${formType}] Intake notification failed`, error);
    }

    return redirectResponse(submission.returnTo || defaultReturnTo, {
      intake: RESULT_QUERY_VALUES.success,
    });
  };
}

export {
  buildLeadPayload as buildIntakeLeadPayload,
  buildSummaryLines as buildIntakeSummaryLines,
  defaultSubmitLead as submitIntakeLeadToServiceTitan,
  methodNotAllowedResponse,
  redirectResponse,
};
