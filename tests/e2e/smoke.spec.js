import { expect, test } from '@playwright/test';

const priorityPages = [
  { path: '/', expectedTitle: /Air Express HVAC/i, expectedH1: /Air Express HVAC|Heating & Cooling|Neighbors/i },
  { path: '/contact.html', expectedTitle: /Contact Air Express HVAC|Get Free Estimate/i, expectedH1: /Contact|Estimate/i },
  { path: '/request-estimate.html', expectedTitle: /Request a Free Estimate/i, expectedH1: /Free Estimate/i },
  { path: '/schedule-service.html', expectedTitle: /Schedule (HVAC )?Service/i, expectedH1: /Schedule/i }
];

const legacyRedirectChecks = [
  { from: '/contact/', to: '/contact.html', expectedH1: /Contact|Estimate/i },
  { from: '/about-us/', to: '/about.html', expectedH1: /About|Story/i },
  { from: '/about-us/accessibility-statement/', to: '/accessibility.html', expectedH1: /Accessibility/i },
  { from: '/alpine-ut-air-conditioning-heating-services/', to: '/service-area-alpine.html', expectedH1: /Alpine/i },
  { from: '/apply-for-financing-lehi-ut/', to: '/financing.html', expectedH1: /Financing/i },
  { from: '/air-purification-lehi-ut/', to: '/air-purifiers.html', expectedH1: /Air Purifier|Purifier/i },
  { from: '/ac-compressor-not-starting/', to: '/ac-repair.html', expectedH1: /AC Not Working|Repair/i },
  { from: '/commercial-heating-repair-considerations/', to: '/commercial.html', expectedH1: /Commercial/i }
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
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('header nav')).toHaveCount(1);

    expect(errors, `Console or page errors on ${pageDef.path}`).toEqual([]);
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

test('legacy live routes redirect to launch-candidate pages', async ({ page }) => {
  for (const route of legacyRedirectChecks) {
    await page.goto(route.from);
    await expect(page).toHaveURL(new RegExp(`${route.to.replace(/\./g, '\\.')}$`));
    await expect(page.locator('h1').first()).toContainText(route.expectedH1);
  }
});
