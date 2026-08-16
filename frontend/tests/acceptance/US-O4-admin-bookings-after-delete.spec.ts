import { test, expect, type APIRequestContext } from '@playwright/test'
import { addDays } from 'date-fns'

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

function offsetMinutesForSuffix(suffix: string): number {
  const value = suffix.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7)
  return value % 600
}

function isoMskAtTomorrow(hh: number, mm: number): string {
  const tomorrow = addDays(new Date(), 1)
  const utc = new Date(tomorrow.getTime())
  utc.setUTCHours(hh - 3, mm, 0, 0)
  return utc.toISOString().slice(0, 19) + '+00:00'
}

async function seedEventTypeAndBooking(
  request: APIRequestContext,
  suffix: string,
): Promise<{ id: number; name: string; guestName: string }> {
  const eventTypeName = `US-O4 ${suffix}`
  const etRes = await request.post('/api/owner/event-types', {
    data: {
      name: eventTypeName,
      description: 'will be deleted',
      duration_minutes: 30,
    },
  })
  expect(etRes.status(), 'seed event type').toBe(200)
  const et = (await etRes.json()) as { id: number; name: string }

  const guestName = `US-O4 guest ${suffix}`
  const offsetMin = offsetMinutesForSuffix(suffix)
  const hh = 6 + Math.floor(offsetMin / 60)
  const mm = offsetMin % 60
  const startAt = isoMskAtTomorrow(hh, mm)
  const bookingRes = await request.post(`/api/event-types/${et.id}/bookings`, {
    data: {
      guest_name: guestName,
      guest_email: 'us-o4@example.com',
      start_at: startAt,
    },
  })
  expect(bookingRes.status(), `seed booking at ${startAt}`).toBe(200)

  return { id: et.id, name: et.name, guestName }
}

test('US-O4: booking keeps event_type_name after event type deletion', async ({
  page,
  request,
}) => {
  const seed = await seedEventTypeAndBooking(request, uniqueSuffix())

  await page.goto('/admin/bookings')
  const bookingRow = page.locator('tr', { hasText: seed.guestName })
  await expect(bookingRow).toBeVisible()
  await expect(bookingRow).toContainText(seed.name)

  await page.goto('/admin/event-types')
  const etRow = page.locator('tr', { hasText: seed.name })
  await expect(etRow).toBeVisible()
  await etRow.getByRole('button', { name: /Удалить/ }).click()

  // Wait for the row to disappear (server-side delete succeeds; the 500 vs 204
  // race in the Vite preview proxy's gunicorn Connection: close handling is
  // handled at the UI state level).
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Удалить' }).click()
  await expect(etRow).toHaveCount(0, { timeout: 10_000 })

  await page.goto('/admin/bookings')
  const stillThere = page.locator('tr', { hasText: seed.guestName })
  await expect(stillThere).toBeVisible()
  await expect(stillThere).toContainText(seed.name)
})
