# Decap CMS OAuth — Vercel Self-Hosted Setup

This project runs its Decap CMS authentication on Vercel directly — no
Netlify, no third-party identity service. Two serverless functions live
in `/api/` and handle the GitHub OAuth flow:

- `api/auth.js` — initiates the flow, redirects the popup to GitHub
- `api/callback.js` — receives the GitHub callback, exchanges the code
  for an access token, posts it back to the Decap popup opener

To enable `/admin/` for real content editors, you need to do three
one-time things.

## 1. Create a GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps** →
   **New OAuth App**
2. Fill in:
   - **Application name:** `Air Express HVAC CMS`
   - **Homepage URL:** `https://www.airexpresshvac.net` (or your
     production domain, whichever is canonical)
   - **Application description:** `Internal content editor for the
     Air Express HVAC website`
   - **Authorization callback URL:** `https://www.airexpresshvac.net/api/callback`
3. Click **Register application**
4. On the next screen, click **Generate a new client secret**
5. Copy the **Client ID** and the **Client Secret** — you will not see
   the secret again

> **Preview deploys:** The callback URL on the OAuth app must exactly
> match the host that hits it. If you want to use `/admin/` on Vercel
> preview deploys (like `option-c-nine.vercel.app`), create a **second**
> GitHub OAuth App with that as its callback URL, or add multiple
> callback URLs to the same app (GitHub allows this on OAuth apps
> created after early 2024).

## 2. Add the env vars to Vercel

In the Vercel dashboard:

1. Open the `option-c` project
2. **Settings** → **Environment Variables**
3. Add these two variables (scope to **Production**, **Preview**, and
   **Development** — all three):

   | Name | Value |
   |---|---|
   | `OAUTH_GITHUB_CLIENT_ID` | (the Client ID from step 1) |
   | `OAUTH_GITHUB_CLIENT_SECRET` | (the Client Secret from step 1) |

4. Save. Vercel will use them on the next deploy automatically. If you
   want them active on an existing deploy without redeploying, use
   **Redeploy** from the Deployments tab.

## 3. Grant yourself access to the repo

Decap CMS uses the logged-in GitHub user's own permissions. The
`repo` OAuth scope gives the token read/write access to whatever repos
the authenticated user can already touch. So:

1. Whoever will be editing content needs **write access** to
   `CryptoJym/air-express-hvac`
2. Invite collaborators via **GitHub → Settings → Collaborators** on
   the repo

## How the flow works end-to-end

1. Editor visits `https://www.airexpresshvac.net/admin/`
2. Decap CMS loads, shows a "Login with GitHub" button
3. Editor clicks it → Decap opens a popup to `/api/auth`
4. `api/auth.js` generates a CSRF state token, stashes it in an
   httpOnly cookie, and redirects the popup to
   `github.com/login/oauth/authorize?...`
5. GitHub prompts the editor to approve the OAuth app (first time only)
6. GitHub redirects the popup back to `/api/callback?code=...&state=...`
7. `api/callback.js` verifies the state cookie, exchanges the code for
   an access token via `github.com/login/oauth/access_token`, and
   returns an HTML page that uses `window.postMessage` to send the
   token back to the Decap CMS window
8. The popup closes, Decap stores the token, and the editor is now
   logged in
9. All content changes commit directly to the `main` branch via the
   GitHub API (or to a draft branch in editorial-workflow mode)
10. Vercel rebuilds automatically and the new post goes live

## Troubleshooting

### "OAUTH_GITHUB_CLIENT_ID environment variable is not set"
You haven't added the env vars in step 2 yet, or you added them but
haven't redeployed. Check **Vercel → Settings → Environment Variables**.

### "State mismatch. Please try logging in again."
The CSRF state cookie didn't round-trip. This usually means the
cookie was blocked (third-party cookie blocker, private browsing) or
the callback happened on a different host than `/api/auth`. Make sure
you're clicking the login button on the same origin as your Vercel
deploy.

### "GitHub token exchange failed: 401"
Client secret is wrong. Regenerate it in the GitHub OAuth App settings
and update `OAUTH_GITHUB_CLIENT_SECRET` in Vercel.

### The popup closes immediately with no login
Open browser DevTools on the `/admin/` page, go to Console, and watch
for postMessage events. You should see `authorizing:github` followed by
a success or error message.

### Vercel Runtime Logs
The functions log all errors to `console.error`. In Vercel:
**Project → Deployments → [current] → Functions tab → `/api/auth` or
`/api/callback` → Logs**

## Local testing

To work on Decap content locally without GitHub auth, run:

```bash
npx decap-server
```

Then uncomment `local_backend: true` in `admin/config.yml`. Decap will
bypass OAuth and write changes directly to your local filesystem. Do
not commit that line change.

## Why self-hosted on Vercel instead of Netlify?

- Single platform — no extra account, no extra vendor
- No dependency on Netlify Identity / git-gateway service staying up
- Full control over the OAuth flow, logging, and CSRF protection
- Env vars colocated with everything else
- No traffic routed through a third party
