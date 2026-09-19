import { test, expect } from '@playwright/test';

test('example', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page.getByText('Соберите бургер')).toBeVisible();
});
