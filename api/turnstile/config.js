import {
  inspectTurnstileConfig,
  jsonResponse,
  loadTurnstileClientConfig,
} from "../_lib/turnstile.js";

export const config = { runtime: "edge" };

function methodNotAllowedResponse() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "GET",
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default function GET(request) {
  if (request.method !== "GET") {
    return methodNotAllowedResponse();
  }

  const diagnostics = inspectTurnstileConfig();
  const clientConfig = loadTurnstileClientConfig();
  if (!diagnostics.configured || !clientConfig) {
    return jsonResponse(
      {
        configured: false,
        missingKeys: diagnostics.missingKeys,
      },
      { status: 503 }
    );
  }

  return jsonResponse({
    configured: true,
    siteKey: clientConfig.siteKey,
  });
}
