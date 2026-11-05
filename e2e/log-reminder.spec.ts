import { expect, test } from '@playwright/test'

const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime()

test('Today reminds when nothing was logged for a while', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 29, 13, 0))
  const events = [{ id: 'd1', kind: 'diaper', contents: 'wet', at: at(29, 8), loggedBy: 'Dad' }]
  await page.addInitScript((data) => localStorage.setItem('calendaby.events.v1', data), JSON.stringify(events))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Baby: nothing logged for 5h' })).toBeVisible()
  await page.screenshot({ path: process.env.SHOT ?? 'test-results/log-reminder.png' })

  await page.getByRole('button', { name: 'Baby profile' }).click()
  await page.getByLabel('Remind me when nothing is logged for').selectOption('off')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('heading', { name: /nothing logged for/ })).toHaveCount(0)
})
