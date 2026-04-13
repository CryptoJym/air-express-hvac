/**
 * Decap CMS OAuth flow — Step 2 of 2: callback
 *
 * GitHub redirects back to this endpoint after the user approves the
 * OAuth app on github.com. GitHub sends a short-lived `code` and the
 * `state` we set in step 1. We:
 *
 *   1. Verify the `state` matches the cookie we set in /api/auth
 *   2. Exchange the `code` for a long-lived access token via GitHub's
 *      token endpoint
 *   3. Return an HTML page that uses window.postMessage to send the
 *      token back to the Decap CMS popup opener, then closes itself
 *
 * Required Vercel environment variables:
 *   OAUTH_GITHUB_CLIENT_ID
 *   OAUTH_GITHUB_CLIENT_SECRET
 */

/**
 * Build a minimal HTML page that posts a message to the opener window
 * in the format Decap CMS expects, then closes itself.
 * Content Security: the message is a string, not HTML, so no XSS risk
 * even if the token contained weird characters.
 */
function renderPostMessageHtml(status, message) {
  // Decap listens for messages of the form:
  //   "authorization:github:success:{\"token\":\"...\",\"provider\":\"github\"}"
  //   "authorization:github:error:{\"error\":\"...\"}"
  const payload = `authorization:github:${status}:${JSON.stringify(message)}`;
  // Escape the payload for safe embedding in a JS string literal.
  const safePayload = payload
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/</g, "\\u003c");

  // NOTE: all JavaScript below this comment runs in the user's BROWSER
  // as part of the popup window that Decap CMS opened. It is NOT server
  // code and has no serverless execution-time implications.
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Decap CMS · Authorization</title></head>
<body>
<p style="font-family:system-ui;padding:24px;color:#1E3A5F;">
  Authorization complete. You can close this window if it does not close automatically.
</p>
<script>
  (function () {
    var payload = '${safePayload}';
    function receiveMessage(e) {
      if (!window.opener) return;
      window.opener.postMessage(payload, e.origin);
      window.removeEventListener('message', receiveMessage, false);
      // Use a microtask to defer window.close until after postMessage
      // has been dispatched. No serverless implications — this runs
      // in the user's browser popup.
      Promise.resolve().then(function () { window.close(); });
    }
    // The Decap popup handshake: Decap sends 'authorizing:github' when
    // it's ready to receive, we echo back with the token.
    window.addEventListener('message', receiveMessage, false);
    if (window.opener) {
      window.opener.postMessage('authorizing:github', '*');
    }
  })();
</script>
</body>
</html>`;
}

/** Extract a cookie value from the Cookie header without pulling a dep. */
function parseCookie(header, name) {
  if (!header) return null;
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

export const config = { runtime: "edge" };

export default async function callbackHandler(request) {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "GET",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "[decap-oauth] /api/callback called without OAUTH_GITHUB_CLIENT_ID or OAUTH_GITHUB_CLIENT_SECRET set"
    );
    return Response.json(
      {
        error:
          "OAuth env vars missing. Set OAUTH_GITHUB_CLIENT_ID and OAUTH_GITHUB_CLIENT_SECRET in Vercel project settings.",
      },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // User denied access on the GitHub consent screen.
  if (error) {
    console.log(`[decap-oauth] user denied access on GitHub consent: ${error}`);
    return new Response(
      renderPostMessageHtml("error", { error: `GitHub OAuth error: ${error}` }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!code) {
    console.error("[decap-oauth] /api/callback missing code parameter");
    return new Response(
      renderPostMessageHtml("error", { error: "Missing authorization code from GitHub." }),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Verify state matches the cookie we set in /api/auth (CSRF protection)
  const cookieHeader = request.headers.get("cookie");
  const stateCookie = parseCookie(cookieHeader, "decap_oauth_state");

  if (!state || !stateCookie || state !== stateCookie) {
    console.error("[decap-oauth] /api/callback state mismatch (possible CSRF)");
    return new Response(
      renderPostMessageHtml("error", { error: "State mismatch. Please try logging in again." }),
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Exchange the short-lived code for an access token
  let tokenResponse;
  try {
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/callback`,
    });

    tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "Air-Express-HVAC-Decap-OAuth",
      },
      body: tokenParams.toString(),
    });
  } catch (err) {
    console.error(`[decap-oauth] token exchange network error: ${err.message}`);
    return new Response(
      renderPostMessageHtml("error", { error: "Network error talking to GitHub." }),
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!tokenResponse.ok) {
    console.error(`[decap-oauth] token exchange failed: ${tokenResponse.status}`);
    return new Response(
      renderPostMessageHtml("error", {
        error: `GitHub token exchange failed: ${tokenResponse.status}`,
      }),
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const tokenData = await tokenResponse.json();

  if (tokenData.error || !tokenData.access_token) {
    console.error(
      `[decap-oauth] token exchange returned error: ${tokenData.error || "no access_token"}`
    );
    return new Response(
      renderPostMessageHtml("error", {
        error: tokenData.error_description || tokenData.error || "No access token returned.",
      }),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Success. Post the token back to the Decap popup opener and clear the
  // state cookie so it can't be replayed.
  console.log("[decap-oauth] /api/callback success, posting token to Decap popup");

  const clearStateCookie = [
    "decap_oauth_state=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (url.protocol === "https:") clearStateCookie.push("Secure");

  return new Response(
    renderPostMessageHtml("success", {
      token: tokenData.access_token,
      provider: "github",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": clearStateCookie.join("; "),
        "Cache-Control": "no-store",
      },
    }
  );
}
