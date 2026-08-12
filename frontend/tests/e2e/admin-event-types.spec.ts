import { test, expect, type Page } from '@playwright/test';

type EventType = { id: number; name: string; description: string; duration_minutes: number };

async function setupAdminRoutes(page: Page) {
  let id = 100;
  const list: EventType[] = [
    {
      id: 1,
      name: 'Встреча 30 минут',
      description: 'Базовый тип события для бронирования.',
      duration_minutes: 30,
    },
  ];

  await page.route('**/api/owner/event-types', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
      return;
    }
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}') as Partial<EventType>;
      id += 1;
      const created: EventType = {
        id,
        name: body.name ?? 'Без имени',
        description: body.description ?? '',
        duration_minutes: body.duration_minutes ?? 30,
      };
      list.push(created);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/owner/event-types/*', async (route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/owner\/event-types\/(\d+)/);
    const eventTypeId = match ? Number(match[1]) : NaN;
    const found = list.find((et) => et.id === eventTypeId);
    if (route.request().method() === 'DELETE') {
      const idx = list.findIndex((et) => et.id === eventTypeId);
      if (idx >= 0) list.splice(idx, 1);
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (!Number.isFinite(eventTypeId) || !found) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'event_type_not_found', message: 'не найден' } }) });
      return;
    }
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() ?? '{}') as Partial<EventType>;
      found.name = body.name ?? found.name;
      found.description = body.description ?? found.description;
      found.duration_minutes = body.duration_minutes ?? found.duration_minutes;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(found) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(found) });
  });
}

test('admin can create, edit, and delete event types', async ({ page }) => {
  await setupAdminRoutes(page);

  await page.goto('/admin/event-types');
  await expect(page.getByText('Встреча 30 минут').first()).toBeVisible();

  // Create
  await page.getByRole('link', { name: /Создать тип/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/event-types\/new$/);
  const newName = `Тест тип ${Date.now()}`;
  await page.getByLabel('Название').fill(newName);
  await page.getByLabel('Описание').fill('Автотест: создание типа.');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page).toHaveURL(/\/admin\/event-types$/);

  await expect(page.locator('tr', { hasText: newName })).toBeVisible();

  // Edit
  await page.locator('tr', { hasText: newName }).getByRole('link', { name: /Редактировать/ }).click();
  await page.getByLabel('Описание').fill('Автотест: редактирование');
  await page.getByRole('button', { name: /Сохранить/ }).click();
  await expect(page.locator('tr', { hasText: 'Автотест: редактирование' })).toBeVisible();

  // Delete
  const edited = page.locator('tr', { hasText: 'Автотест: редактирование' });
  await edited.getByRole('button', { name: /Удалить/ }).click();
  await page.getByRole('button', { name: 'Удалить' }).last().click();
  await expect(page.locator('tr', { hasText: newName })).toHaveCount(0);
});
