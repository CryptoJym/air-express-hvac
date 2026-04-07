/**
 * Decap CMS OAuth flow — Step 1 of 2: initiate
 *
 * Decap CMS's admin UI opens this endpoint in a popup window when a
 * content editor clicks "Login with GitHub". This function generates
 * a random state token (for CSRF protection) and redirects the popup
 * to GitHub's OAuth authorization page.
 *
 * GitHub will prompt the user to approve the OAuth app, then redirect
 * back to /api/callback with a temporary code. See callback.js for
 * the second half of the flow.
 *
 * Required Vercel environment variables:
 *   OAUTH_GITHUB_CLIENT_ID     — from your GitHub OAuth App
 *   OAUTH_GITHUB_CLIENT_SECRET — from your GitHub OAuth App (used in callback.js)
 *
 * Setup instructions live in admin/OAUTH_SETUP.md.
 */

export async function GET(request) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;

  if (!clientId) {
    // Logged to Vercel Runtime Logs for debugging misconfigured deploys.
    console.error("[decap-oauth] /api/auth called without OAUTH_GITHUB_CLIENT_ID set");
    return Response.json(
      {
        error: "OAUTH_GITHUB_CLIENT_ID environment variable is not set.",
        hint: "Set it in Vercel project settings. See admin/OAUTH_SETUP.md.",
      },
      { status: 500 }
    );
  }

  console.log("[decap-oauth] /api/auth initiating GitHub OAuth flow");

  // Random state token to protect against CSRF. We stash it in an
  // httpOnly cookie and verify in the callback.
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  // Build the absolute callback URL from the request's own host so the
  // same code works in preview and production without hard-coding.
  const url = new URL(request.url);
  const callbackUrl = `${url.origin}/api/callback`;

  // repo scope = read/write repo contents (needed for content commits)
  // user scope = read basic profile for the CMS UI
  const scope = "repo,user";

  const authorizeParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope,
    state,
    allow_signup: "false",
  });
  const authorizeUrl = `https://github.com/login/oauth/authorize?${authorizeParams.toString()}`;

  // Set the state cookie (httpOnly, SameSite=Lax so it survives the
  // GitHub redirect back to us, Secure when served over https)
  const isHttps = url.protocol === "https:";
  const cookieFlags = [
    `decap_oauth_state=${state}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
  ];
  if (isHttps) cookieFlags.push("Secure");

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      "Set-Cookie": cookieFlags.join("; "),
    },
  });
}
