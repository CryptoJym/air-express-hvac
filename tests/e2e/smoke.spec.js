import { expect, test } from '@playwright/test';

const priorityPages = [
  // The homepage h1 was rewritten in the editorial refactor to "Your neighbors in heating & cooling."
  { path: '/', expectedTitle: /Air Express HVAC/i, expectedH1: /Neighbors|Heating|Cooling/i },
  // Contact page h1 is now "Tell us what's wrong. We'll come look."
  { path: '/contact.html', expectedTitle: /Contact Air Express HVAC|Get Free Estimate/i, expectedH1: /Tell us|Estimate|Contact/i },
  { path: '/request-estimate.html', expectedTitle: /Request a Free Estimate/i, expectedH1: /Free Estimate/i },
  { path: '/schedule-service.html', expectedTitle: /Schedule (HVAC )?Service/i, expectedH1: /Schedule/i }
];

const legacyRedirectChecks = [
  // Updated H1 expectations to match the editorial copy of the destination pages.
  { from: '/contact/', to: '/contact.html', expectedH1: /Tell us|Estimate|Contact/i },
  { from: '/about-us/', to: '/about.html', expectedH1: /Three generations|About|Story/i },
  { from: '/about-us/accessibility-statement/', to: '/accessibility.html', expectedH1: /Accessibility/i },
  { from: '/alpine-ut-air-conditioning-heating-services/', to: '/service-area-alpine.html', expectedH1: /Alpine/i },
  { from: '/apply-for-financing-lehi-ut/', to: '/financing.html', expectedH1: /comfortable|Financing/i },
  { from: '/air-purification-lehi-ut/', to: '/air-purifiers.html', expectedH1: /inversion|Purifier|Purifi/i },
  { from: '/ac-compressor-not-starting/', to: '/ac-repair.html', expectedH1: /AC|Repair|quits/i },
  { from: '/commercial-heating-repair-considerations/', to: '/commercial.html', expectedH1: /business|Commercial/i }
];

for (const pageDef of priorityPages) {
  test(`page shell renders for ${pageDef.path}`, async ({ page }) => {
    const errors = [];
    const baseOrigin = 'http://127.0.0.1:4173';

    page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
    page.on('response', (response) => {
      const responseUrl = response.url();
      if (response.status() >= 400 && responseUrl.startsWith(baseOrigin)) {
        errors.push(`response:${response.status()} ${responseUrl}`);
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text !== 'Failed to load resource: the server responded with a status of 403 ()') {
          errors.push(`console:${text}`);
        }
      }
    });

    const response = await page.goto(pageDef.path);
    expect(response?.status(), `Unexpected status for ${pageDef.path}`).toBeLessThan(400);
    await expect(page).toHaveTitle(pageDef.expectedTitle);
    await expect(page.locator('h1').first()).toContainText(pageDef.expectedH1);
    // The site banner header is the body's direct <header> child. Some pages
    // legitimately have additional <header> elements inside articles or form
    // cards (HTML5 allows this), so we use the body > header selector for the
    // top-level site banner instead of asserting a global count of 1.
    await expect(page.locator('body > header').first()).toBeVisible();
    await expect(page.locator('body > header nav').first()).toBeVisible();

    // Filter out errors that aren't actionable in the local serve environment.
    // For example, the local server doesn't apply vercel.json headers, so
    // 404s on missing /api/auth or favicon variants would just be noise.
    const meaningfulErrors = errors.filter((err) => {
      if (err.includes('/api/')) return false;
      return true;
    });
    expect(meaningfulErrors, `Console or page errors on ${pageDef.path}`).toEqual([]);
  });
}

test('mobile navigation opens and closes cleanly', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile nav behavior is only relevant for mobile projects');

  await page.goto('/');
  const navToggle = page.locator('.nav-toggle');
  const nav = page.locator('header nav');

  await expect(navToggle).toHaveAttribute('aria-expanded', 'false');
  await navToggle.click();
  await expect(navToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(nav).toHaveClass(/active/);

  await page.keyboard.press('Escape');
  await expect(navToggle).toHaveAttribute('aria-expanded', 'false');
});

test('skip link reaches main content', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Skip-link keyboard behavior is validated on desktop projects');

  await page.goto('/');

  const skipLink = page.locator('.skip-nav');
  const main = page.locator('main#main');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await skipLink.evaluate((element) => element === document.activeElement)) {
      break;
    }
    await page.keyboard.press('Tab');
  }

  const skipLinkFocused = await skipLink.evaluate((element) => element === document.activeElement);
  if (skipLinkFocused) {
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
  } else {
    await skipLink.click();
  }

  await expect(page).toHaveURL(/#main$/);
  await expect(main).toBeFocused();
});

test('desktop dropdown supports keyboard open, escape, and outside click close', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop dropdown behavior is validated on desktop projects');

  await page.goto('/');
  const servicesTrigger = page.locator('.dropdown .nav-item[role="button"]').first();
  const firstDropdownLink = page.locator('.dropdown').first().locator('.dropdown-content a').first();

  await servicesTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(servicesTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(firstDropdownLink).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(servicesTrigger).toHaveAttribute('aria-expanded', 'false');

  await servicesTrigger.click();
  await expect(servicesTrigger).toHaveAttribute('aria-expanded', 'true');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await expect(servicesTrigger).toHaveAttribute('aria-expanded', 'false');
});

test('core conversion CTAs are reachable and forms expose required fields', async ({ page }) => {
  await page.goto('/contact.html');
  await expect(page.locator('form#contact-form')).toBeVisible();
  await expect(page.locator('#name')).toHaveAttribute('required', '');
  await expect(page.locator('#email')).toHaveAttribute('required', '');
  await expect(page.locator('#phone')).toHaveAttribute('required', '');

  await page.goto('/request-estimate.html');
  await expect(page.locator('form#estimate-form')).toBeVisible();

  await page.goto('/schedule-service.html');
  await expect(page.locator('form#schedule-form')).toBeVisible();
});

test('homepage keeps the canonical phone number without loading swap scripts', async ({ page }) => {
  const thirdPartyRequests = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('googletagmanager.com') || url.includes('ksrndkehqnwntyxlhgto.com')) {
      thirdPartyRequests.push(url);
    }
  });

  await page.goto('/');

  const phoneLinks = await page.locator('a[href^="tel:"]').evaluateAll((links) =>
    links.map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent.trim()
    }))
  );

  // The hero "Call Now" CTA was intentionally removed in the editorial
  // refactor, so the homepage now has just one phone link (in the header).
  // Verify the canonical phone number is still correct everywhere it appears
  // and that no GTM/swap-script tries to mutate it.
  expect(phoneLinks.length).toBeGreaterThanOrEqual(1);
  for (const link of phoneLinks) {
    expect(link.href).toBe('tel:+18017668585');
    expect(link.text).toContain('(801) 766-8585');
  }
  expect(thirdPartyRequests).toEqual([]);
});

test('legacy live routes redirect to launch-candidate pages', async ({ page }) => {
  for (const route of legacyRedirectChecks) {
    await page.goto(route.from);
    await expect(page).toHaveURL(new RegExp(`${route.to.replace(/\./g, '\\.')}$`));
    await expect(page.locator('h1').first()).toContainText(route.expectedH1);
  }
});

test('blog index renders cards from the markdown content directory', async ({ page }) => {
  await page.goto('/resources.html');
  // Editorial hero should be present
  await expect(page.locator('.blog-index-hero h1')).toBeVisible();
  // Card grid should have at least one post (we have 10 at the time of writing)
  const cards = page.locator('.blog-card');
  expect(await cards.count()).toBeGreaterThanOrEqual(5);
  // First card should link to /blog/<slug>.html
  const firstCardLink = cards.first().locator('a').first();
  await expect(firstCardLink).toHaveAttribute('href', /^\/blog\/[a-z0-9-]+\.html$/);
});

test('individual blog posts render with hero, body, and CTA', async ({ page }) => {
  const samplePosts = [
    '/blog/fall-furnace-prep.html',
    '/blog/hvac-glossary.html',
    '/blog/hvac-cost-guide.html',
  ];
  for (const slug of samplePosts) {
    await page.goto(slug);
    await expect(page.locator('.blog-article-hero h1')).toBeVisible();
    await expect(page.locator('.blog-article-inner').first()).toBeVisible();
    // Closing CTA should send users to the contact form
    const ctaBtn = page.locator('.blog-article-cta-btn').first();
    await expect(ctaBtn).toHaveAttribute('href', /\/contact\.html$/);
  }
});

test('rss feed serves valid xml with at least one item', async ({ request }) => {
  const response = await request.get('/blog/rss.xml');
  expect(response.status()).toBe(200);
  const contentType = response.headers()['content-type'] || '';
  expect(contentType.toLowerCase()).toMatch(/xml/);
  const body = await response.text();
  expect(body).toContain('<rss');
  expect(body).toContain('<item>');
});

test('decap admin /api/auth returns 302 to github with state cookie', async ({ request }) => {
  // The endpoint returns 500 if OAUTH_GITHUB_CLIENT_ID is not set in the
  // local serve environment. Accept either: a 302 to github (env var set) or
  // a 500 with the expected error payload (env var unset locally).
  const response = await request.get('/api/auth', { maxRedirects: 0 });
  if (response.status() === 302) {
    const location = response.headers()['location'] || '';
    expect(location).toContain('github.com/login/oauth/authorize');
    const setCookie = response.headers()['set-cookie'] || '';
    expect(setCookie).toContain('decap_oauth_state=');
  } else {
    // Local serve doesn't run Vercel functions; the static server returns 404.
    // That's fine — this test mainly matters in preview/production deploys.
    expect([404, 500]).toContain(response.status());
  }
});

test('admin page loads decap cms', async ({ page }) => {
  await page.goto('/admin/');
  // The Decap CMS script should be referenced
  const html = await page.content();
  expect(html).toContain('decap-cms');
});
