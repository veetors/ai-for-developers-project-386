import { test, expect, type Page, type Route } from '@playwright/test';
import { addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const MSK = 'Europe/Moscow';

function ymdMsk(d: Date): string {
  return format(toZonedTime(d, MSK), 'yyyy-MM-dd');
}

function isoMskAt(d: Date, hh: number, mm: number): string {
  const local = new Date(d);
  local.setHours(hh, mm, 0, 0);
  // Convert MSK wall-clock → UTC ISO with +03:00 offset.
  const utc = new Date(local.getTime() - 3 * 60 * 60 * 1000);
  return `${utc.toISOString().slice(0, 19)}+00:00`;
}

async function mockSlotsForToday(page: Page) {
  const today = new Date();
  const targetDate = ymdMsk(addDays(today, 1));
  const slots = Array.from({ length: 32 }, (_, i) => {
    const hour = 6 + Math.floor(i / 2);
    const minute = i % 2 === 0 ? 0 : 30;
    const start = isoMskAt(addDays(today, 1), hour, minute);
    const end = isoMskAt(addDays(today, 1), hour, minute + 30 === 60 ? 60 : 30);
    return { start_at: start, end_at: end, status: 'free' };
  });

  await page.route('**/api/event-types/**/slots*', async (route: Route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('date', targetDate);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(slots),
    });
  });
}

async function mockBookingPost(page: Page) {
  await page.route('**/api/event-types/**/bookings', async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const id = Math.floor(Math.random() * 10_000);
    const fake = {
      id,
      event_type: {
        id: 1,
        name: 'Встреча 30 минут',
        description: 'Базовый тип события для бронирования.',
        duration_minutes: 30,
      },
      guest_name: body.guest_name ?? 'guest',
      guest_email: body.guest_email ?? 'guest@example.com',
      start_at: body.start_at ?? new Date().toISOString(),
      end_at: new Date(new Date(body.start_at ?? Date.now()).getTime() + 30 * 60_000).toISOString(),
      created_at: new Date().toISOString(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fake),
    });
  });
}

test('public booking flow end-to-end', async ({ page }) => {
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
  await page.route('**/api/event-types/*', async (route) => {
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

  await mockSlotsForToday(page);
  await mockBookingPost(page);

  await page.goto('/');
  await expect(page).toHaveTitle(/Calendar/);
  await page.getByRole('link', { name: /Записаться/ }).first().click();

  await expect(page).toHaveURL(/\/event-types$/);
  await expect(page.getByText('Выберите тип события').first()).toBeVisible();

  const firstCard = page.locator('a[href^="/event-types/"]').first();
  await firstCard.click();

  await expect(page).toHaveURL(/\/event-types\/\d+$/);

  const freeSlot = page.locator('button[data-status="free"]').first();
  await expect(freeSlot).toBeVisible({ timeout: 15_000 });
  await freeSlot.click();

  await page.getByRole('button', { name: /Продолжить/ }).click();

  await expect(page).toHaveURL(/\/event-types\/\d+\/book$/);
  await page.getByLabel('Имя').fill('Иван Петров');
  await page.getByLabel('E-mail').fill('ivan@example.com');
  await page.getByRole('button', { name: /Подтвердить бронирование/ }).click();

  await expect(page).toHaveURL(/\/event-types\/\d+\/success$/, { timeout: 15_000 });
  await expect(page.getByText(/Бронирование подтверждено/)).toBeVisible();
  await expect(page.getByText('Иван Петров')).toBeVisible();
  await expect(page.getByText('ivan@example.com')).toBeVisible();
});
