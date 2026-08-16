import { test, expect, type Page, type APIRequestContext, type APIResponse } from '@playwright/test'
import { addDays } from 'date-fns'

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

function isoMskAtTomorrow(hh: number, mm: number): string {
  const tomorrow = addDays(new Date(), 1)
  const utc = new Date(tomorrow.getTime())
  utc.setUTCHours(hh - 3, mm, 0, 0)
  return utc.toISOString().slice(0, 19) + '+00:00'
}

async function seedEventType(
  request: APIRequestContext,
  suffix: string,
): Promise<{ id: number; name: string }> {
  const res = await request.post('/api/owner/event-types', {
    data: { name: `US-G7 ${suffix}`, description: 'acceptance: US-G7', duration_minutes: 30 },
  })
  expect(res.status()).toBe(200)
  const body = (await res.json()) as { id: number; name: string }
  expect(typeof body.id).toBe('number')
  return body
}

async function gotoBookForm(page: Page, eventTypeId: number): Promise<void> {
  await page.locator(`a[href="/event-types/${eventTypeId}"]`).first().click()
  await expect(page).toHaveURL(new RegExp(`/event-types/${eventTypeId}$`))

  const freeSlot = page.locator('button[data-status="free"]').first()
  await expect(freeSlot).toBeVisible({ timeout: 15_000 })
  await freeSlot.click()

  await page.getByRole('button', { name: /Продолжить/ }).click()
  await expect(page).toHaveURL(new RegExp(`/event-types/${eventTypeId}/book$`))
}

test('US-G7: backend returns 422 validation_failed with field details', async ({ request }) => {
  const suffix = uniqueSuffix()
  const eventType = await seedEventType(request, suffix)

  const startAt = isoMskAtTomorrow(10, 0)

  const res: APIResponse = await request.post(`/api/event-types/${eventType.id}/bookings`, {
    data: {
      guest_name: '',
      guest_email: 'not-an-email',
      start_at: startAt,
    },
  })

  expect(res.status()).toBe(422)
  const body = (await res.json()) as {
    error: { code: string; message: string; details?: Array<{ field: string; messages: string[] }> }
  }
  expect(body.error.code).toBe('validation_failed')
  expect(Array.isArray(body.error.details)).toBe(true)
  const fields = (body.error.details ?? []).map((d) => d.field).sort()
  expect(fields).toEqual(['guest_email', 'guest_name'])
})

test('US-G7: form with invalid input never reaches /success', async ({ page, request }) => {
  const suffix = uniqueSuffix()
  const eventType = await seedEventType(request, suffix)

  await page.goto('/event-types')
  await gotoBookForm(page, eventType.id)

  await page.getByLabel('Имя').fill('Иван')
  await page.getByLabel('E-mail').fill('not-an-email')
  await page.getByRole('button', { name: /Подтвердить бронирование/ }).click()

  await expect(page.getByText(/Введите корректный e-mail/i)).toBeVisible({
    timeout: 5_000,
  })
  await expect(page).toHaveURL(new RegExp(`/event-types/${eventType.id}/book$`))
})
