import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

async function seedEventType(
  request: APIRequestContext,
  suffix: string,
  description = 'acceptance: US-G5',
): Promise<{ id: number; name: string }> {
  const res = await request.post('/api/owner/event-types', {
    data: { name: `US-G5 ${suffix}`, description, duration_minutes: 30 },
  })
  expect(res.status(), 'seed: POST /api/owner/event-types').toBe(200)
  const body = (await res.json()) as { id: number; name: string }
  expect(typeof body.id).toBe('number')
  return body
}

async function bookFirstFreeSlot(
  page: Page,
  eventTypeId: number,
  guest: { name: string; email: string },
): Promise<void> {
  await page.locator(`a[href="/event-types/${eventTypeId}"]`).first().click()
  await expect(page).toHaveURL(new RegExp(`/event-types/${eventTypeId}$`))

  const freeSlot = page.locator('button[data-status="free"]').first()
  await expect(freeSlot).toBeVisible({ timeout: 15_000 })
  await freeSlot.click()

  await page.getByRole('button', { name: /Продолжить/ }).click()
  await expect(page).toHaveURL(new RegExp(`/event-types/${eventTypeId}/book$`))

  await page.getByLabel('Имя').fill(guest.name)
  await page.getByLabel('E-mail').fill(guest.email)
  await page.getByRole('button', { name: /Подтвердить бронирование/ }).click()
  await expect(page).toHaveURL(new RegExp(`/event-types/${eventTypeId}/success$`), {
    timeout: 15_000,
  })
}

test('US-G5: guest books a slot end-to-end', async ({ page, request }) => {
  const suffix = uniqueSuffix()
  const eventType = await seedEventType(request, suffix)

  await page.goto('/event-types')
  await expect(page.getByText(eventType.name).first()).toBeVisible()

  await bookFirstFreeSlot(page, eventType.id, {
    name: 'Иван Петров',
    email: 'ivan@example.com',
  })

  await expect(page.getByText(/Бронирование подтверждено/)).toBeVisible()
  await expect(page.getByText('Иван Петров')).toBeVisible()
  await expect(page.getByText('ivan@example.com')).toBeVisible()
  await expect(page.getByText(eventType.name)).toBeVisible()
  await expect(page.getByText(/\d{1,2}:\d{2}\s*—\s*\d{1,2}:\d{2}/)).toBeVisible()

  await page.screenshot({
    path: test.info().outputPath('success.png'),
    fullPage: true,
  })
})
