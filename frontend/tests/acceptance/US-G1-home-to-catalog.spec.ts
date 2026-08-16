import { test, expect } from '@playwright/test'

test('US-G1: home renders and routes to catalog', async ({ page }) => {
  await page.goto('/')

  const header = page.getByRole('banner')
  await expect(header.getByRole('link', { name: /Записаться/ })).toBeVisible()
  await expect(header.getByRole('link', { name: /Админка/ })).toBeVisible()

  await header.getByRole('link', { name: /Записаться/ }).click()
  await expect(page).toHaveURL(/\/event-types$/)
})
