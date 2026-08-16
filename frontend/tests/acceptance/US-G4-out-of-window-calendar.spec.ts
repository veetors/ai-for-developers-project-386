import { test, expect, type APIRequestContext } from '@playwright/test'

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

async function seedEventType(request: APIRequestContext, suffix: string): Promise<{ id: number }> {
  const res = await request.post('/api/owner/event-types', {
    data: {
      name: `US-G4 ${suffix}`,
      description: 'acceptance: US-G4',
      duration_minutes: 30,
    },
  })
  expect(res.status()).toBe(200)
  return (await res.json()) as { id: number }
}

test('US-G4: calendar disables dates outside the 14-day window', async ({ page, request }) => {
  const et = await seedEventType(request, uniqueSuffix())

  await page.goto(`/event-types/${et.id}`)
  const calendar = page.locator('.rdp').first()
  await expect(calendar).toBeVisible()

  const enabled = page.locator('.rdp button[name="day"]:not([disabled])')
  const disabled = page.locator('.rdp button[name="day"][disabled]')
  await expect(enabled.first()).toBeVisible()
  await expect(disabled.first()).toBeVisible()
  await expect(disabled.first()).toBeDisabled()
})
