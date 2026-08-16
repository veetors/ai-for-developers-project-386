import { test, expect } from '@playwright/test'

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

test('US-O2: admin creates event type via UI', async ({ page }) => {
  const name = `US-O2 ${uniqueSuffix()}`
  const description = 'acceptance event type'

  await page.goto('/admin/event-types')

  await expect(page.getByRole('heading', { name: 'Типы событий' })).toBeVisible()

  await page
    .getByRole('link', { name: /Создать тип/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/admin\/event-types\/new$/)

  await page.getByLabel('Название').fill(name)
  await page.getByLabel('Описание').fill(description)

  const durationField = page.getByLabel('Длительность, мин')
  await expect(durationField).toHaveValue('30')
  await expect(durationField).toBeDisabled()

  await page.getByRole('button', { name: 'Создать' }).click()

  await expect(page).toHaveURL(/\/admin\/event-types$/)
  const row = page.locator('tr', { hasText: name })
  await expect(row).toBeVisible()
  await expect(row).toContainText(description)

  await page.screenshot({
    path: test.info().outputPath('list.png'),
    fullPage: true,
  })
})
