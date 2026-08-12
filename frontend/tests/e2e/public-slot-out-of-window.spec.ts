import { test, expect, type Page } from '@playwright/test';

async function setupRoutes(page: Page) {
  await page.route('**/api/event-types', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          name: 'Встреча 30 минут',
          description: 'Базовый тип события для бронирования.',
          duration_minutes: 30,
        },
      ]),
    });
  });
  await page.route('**/api/event-types/1', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        name: 'Встреча 30 минут',
        description: 'Базовый тип события для бронирования.',
        duration_minutes: 30,
      }),
    });
  });
  await page.route('**/api/event-types/1/slots*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test('out-of-window dates are disabled in calendar', async ({ page }) => {
  await setupRoutes(page);

  await page.goto('/event-types/1');
  const calendar = page.locator('.rdp').first();
  await expect(calendar).toBeVisible();

  const buttons = page.locator('.rdp button[name="day"]');
  await expect(buttons.first()).toBeVisible();

  const enabled = page.locator('.rdp button[name="day"]:not([disabled])');
  const disabled = page.locator('.rdp button[name="day"][disabled]');
  await expect(enabled.first()).toBeVisible();
  await expect(disabled.first()).toBeVisible();
});
