import { expect, test } from '@playwright/test'

test('a screen that fails to load shows a way back instead of a blank page', async ({ page }) => {
  // Stands in for a screen's code missing after an update, or a dropped connection while it loads.
  await page.route(/\/src\/ui\/Routines\.tsx/, (route) => route.abort())
  await page.goto('/')
  await page.getByRole('region', { name: 'Routines' }).getByRole('button', { name: /All routines/ }).click()
  await expect(page.getByRole('alert')).toContainText('Something went wrong')
  await page.unroute(/\/src\/ui\/Routines\.tsx/)
  await page.getByRole('button', { name: 'Reload' }).click()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
})
