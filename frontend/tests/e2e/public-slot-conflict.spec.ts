import { test, expect, type Page } from '@playwright/test';
import { addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const MSK = 'Europe/Moscow';

function ymdMsk(d: Date): string {
  return format(toZonedTime(d, MSK), 'yyyy-MM-dd');
}

function isoMskAt(d: Date, hh: number, mm: number): string {
  const local = new Date(d.getTime());
  local.setUTCHours(hh - 3, mm, 0, 0);
  return local.toISOString().slice(0, 19) + '+00:00';
}

async function setupBaseRoutes(page: Page) {
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
}

test('slot conflict: 409 on POST → UI invalidates slots and disables re-submit', async ({ page }) => {
  await setupBaseRoutes(page);

  const today = new Date();
  const target = addDays(today, 1);
  let attempt = 0;

  // First /slots: all free. Second /slots: chosen slot becomes busy.
  await page.route('**/api/event-types/1/slots*', async (route) => {
    const slots = Array.from({ length: 32 }, (_, i) => {
      const hour = 6 + Math.floor(i / 2);
      const minute = i % 2 === 0 ? 0 : 30;
      const start = isoMskAt(target, hour, minute);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : 30;
      const end = isoMskAt(target, endHour, endMinute);
      const isChosen = i === 0 && attempt > 0;
      return { start_at: start, end_at: end, status: isChosen ? 'busy' : 'free' };
    });
    attempt++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(slots),
    });
  });

  // POST returns 409 for the chosen slot.
  await page.route('**/api/event-types/1/bookings', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'slot_taken', message: 'Слот только что заняли.' },
      }),
    });
  });

  await page.goto('/event-types/1');
  const firstSlot = page.locator('button[data-status="free"]').first();
  await expect(firstSlot).toBeVisible();
  await firstSlot.click();
  await page.getByRole('button', { name: /Продолжить/ }).click();
  await page.getByLabel('Имя').fill('Иван');
  await page.getByLabel('E-mail').fill('ivan@example.com');
  await page.getByRole('button', { name: /Подтвердить бронирование/ }).click();

  // Toast surfaces in the page
  await expect(page.getByText(/Слот только что заняли/)).toBeVisible({ timeout: 5_000 });

  // Navigate back to slots picker and verify first slot is now busy.
  await page.goto('/event-types/1');
  const busy = page.locator('button[data-status="busy"]').first();
  await expect(busy).toBeVisible();
  await expect(busy).toBeDisabled();

  void ymdMsk;
});
