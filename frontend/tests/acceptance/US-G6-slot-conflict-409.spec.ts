import { test, expect, type APIRequestContext } from '@playwright/test'
import { formatInTimeZone } from 'date-fns-tz'

const MSK = 'Europe/Moscow'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

function todayMsk(): string {
  return formatInTimeZone(new Date(), MSK, 'yyyy-MM-dd')
}

interface Slot {
  start_at: string
  end_at: string
  status: 'free' | 'busy'
}

function mskHourMinute(iso: string): { hh: number; mm: number } {
  const hh = Number(formatInTimeZone(iso, MSK, 'HH'))
  const mm = Number(formatInTimeZone(iso, MSK, 'mm'))
  return { hh, mm }
}

async function seedEventType(request: APIRequestContext, suffix: string): Promise<{ id: number }> {
  const res = await request.post('/api/owner/event-types', {
    data: {
      name: `US-G6 ${suffix}`,
      description: 'acceptance: US-G6',
      duration_minutes: 30,
    },
  })
  expect(res.status()).toBe(200)
  return (await res.json()) as { id: number }
}

async function firstFreeSlotForToday(
  request: APIRequestContext,
  eventTypeId: number,
): Promise<Slot> {
  const date = todayMsk()
  const res = await request.get(`/api/event-types/${eventTypeId}/slots`, {
    params: { date },
  })
  expect(res.status()).toBe(200)
  const slots = (await res.json()) as Slot[]
  const free = slots.find((s) => s.status === 'free')
  expect(free, `expected at least one free slot on ${date}`).toBeDefined()
  return free!
}

test('US-G6: 409 conflict surfaces toast and refreshes slot to busy', async ({ page, request }) => {
  const et = await seedEventType(request, uniqueSuffix())
  const target = await firstFreeSlotForToday(request, et.id)

  const { hh, mm } = mskHourMinute(target.start_at)
  const expectedStart = `${pad(hh)}:${pad(mm)}`

  await page.goto(`/event-types/${et.id}`)
  const slotButton = page.locator(`button[data-status="free"]:has-text("${expectedStart}")`)
  await expect(slotButton.first()).toBeVisible()
  await slotButton.first().click({ timeout: 5_000 })

  // Take the slot — then seed a conflicting booking via direct API call so the
  // slot becomes taken before the UI submits its POST.
  const seedRes = await request.post(`/api/event-types/${et.id}/bookings`, {
    data: {
      guest_name: 'fast guest',
      guest_email: 'fast@example.com',
      start_at: target.start_at,
    },
  })
  expect(seedRes.status(), 'seed booking should succeed').toBe(200)

  await page.getByRole('button', { name: /Продолжить/ }).click()
  await expect(page).toHaveURL(new RegExp(`/event-types/${et.id}/book$`))

  await page.getByLabel('Имя').fill('Иван')
  await page.getByLabel('E-mail').fill('ivan@example.com')
  await page.getByRole('button', { name: /Подтвердить бронирование/ }).click()

  await expect(page.getByText(/Слот только что заняли/)).toBeVisible({
    timeout: 5_000,
  })

  // Refetch slots: target is now busy on the next GET.
  await page.goto(`/event-types/${et.id}`)
  const busy = page.locator(`button:has-text("${expectedStart}")`)
  await expect(busy.first()).toBeVisible()
  await expect(busy.first()).toBeDisabled()
})
