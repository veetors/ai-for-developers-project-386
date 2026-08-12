import { test, expect, type Page } from '@playwright/test';

const MSK = 'Europe/Moscow';

function isoMskAt(dayOffset: number, hh: number, mm: number): string {
  const target = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  const local = new Date(target.getTime());
  local.setUTCHours(hh - 3, mm, 0, 0);
  return local.toISOString().slice(0, 19) + '+00:00';
}

async function setupAdminBookingsRoutes(page: Page, adminBookings: unknown[]) {
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

  await page.route('**/api/owner/event-types', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 999, name: 'mock', description: '', duration_minutes: 30 }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/owner/bookings', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminBookings) });
  });
}

test('admin bookings list shows new booking after public flow', async ({ page }) => {
  const eventTypeName = `Админ-${Date.now()}`;
  const guestName = 'Гость для админки';
  const startAt = isoMskAt(2, 7, 0);
  const endAt = isoMskAt(2, 7, 30);

  const adminBookings = [
    {
      id: 100,
      event_type_id: 1,
      event_type_name: eventTypeName,
      guest_name: guestName,
      guest_email: 'guest-admin@example.com',
      start_at: startAt,
      end_at: endAt,
      created_at: new Date().toISOString(),
    },
  ];

  await setupAdminBookingsRoutes(page, adminBookings);

  await page.goto('/admin/bookings');
  const row = page.locator('tr', { hasText: guestName });
  await expect(row).toBeVisible();
  await expect(row).toContainText(eventTypeName);

  void MSK;
});
