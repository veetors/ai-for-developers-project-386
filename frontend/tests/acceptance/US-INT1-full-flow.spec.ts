import { test, expect } from '@playwright/test'

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

test('US-INT1: full owner→guest→owner flow', async ({ page }) => {
  const name = `US-INT1 ${uniqueSuffix()}`
  const guestName = 'Иван Тестов'
  const guestEmail = 'test-int1@example.com'

  await page.goto('/admin/event-types')
  await page
    .getByRole('link', { name: /Создать тип/ })
    .first()
    .click()
  await page.getByLabel('Название').fill(name)
  await page.getByLabel('Описание').fill('acceptance INT1')
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(page.locator('tr', { hasText: name })).toBeVisible()

  await page.goto('/event-types')
  await expect(page.getByText(name).first()).toBeVisible()

  const card = page.locator('a[href^="/event-types/"]', { hasText: name }).first()
  await card.click()

  const freeSlot = page.locator('button[data-status="free"]').first()
  await expect(freeSlot).toBeVisible({ timeout: 15_000 })
  await freeSlot.click()

  await page.getByRole('button', { name: /Продолжить/ }).click()
  await expect(page).toHaveURL(/\/event-types\/\d+\/book$/)

  await page.getByLabel('Имя').fill(guestName)
  await page.getByLabel('E-mail').fill(guestEmail)
  await page.getByRole('button', { name: /Подтвердить бронирование/ }).click()
  await expect(page).toHaveURL(/\/event-types\/\d+\/success$/, {
    timeout: 15_000,
  })
  await expect(page.getByText(/Бронирование подтверждено/)).toBeVisible()

  await page.goto('/admin/bookings')
  const row = page.locator('tr', { hasText: guestName })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toContainText(name)
  await expect(row).toContainText(guestEmail)
  await expect(row).toContainText(/\d{1,2}:\d{2}/)
})
