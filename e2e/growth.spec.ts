import { expect, test } from '@playwright/test'

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime()
const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 29, 12, 0))
})

async function setBaby(page: import('@playwright/test').Page, birth: string, sex: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Baby profile' }).click()
  await page.locator('input[type=date]').fill(birth)
  await page.getByLabel('Sex (for growth charts, optional)').selectOption(sex)
}

test('a measurement logged from the Log tab shows on Today, with its WHO percentile', async ({ page }) => {
  await setBaby(page, '2026-07-29', 'girl')
  await nav(page).getByRole('button', { name: 'Log' }).click()
  await page.getByRole('tab', { name: 'Growth' }).click()
  await page.getByLabel(/Weight/).fill('13.7')
  await page.getByLabel(/Length/).fill('24.4')
  await page.getByLabel(/Head/).fill('16.1')
  await page.getByRole('button', { name: 'Save Growth' }).click()

  await nav(page).getByRole('button', { name: 'Today' }).click()
  const card = page.getByLabel('Growth', { exact: true })
  await expect(card.getByText('13 lb 11 oz')).toBeVisible()
  await expect(card.getByText('24.4 in')).toBeVisible()
  await expect(card.getByText(/percentile/).first()).toBeVisible()
  // The card only shows the readings.
  await expect(card.getByRole('textbox')).toHaveCount(0)

  await card.getByRole('button', { name: /Growth & milestones/ }).click()
  await expect(page.getByRole('heading', { name: 'Growth & milestones' })).toBeVisible()
  await expect(page.getByText('13 lb 11 oz').first()).toBeVisible()
})

test('without a sex set the screen says why there is no percentile', async ({ page }) => {
  await setBaby(page, '2026-07-29', '')
  await nav(page).getByRole('button', { name: 'Log' }).click()
  await page.getByRole('tab', { name: 'Growth' }).click()
  await page.getByLabel(/Weight/).fill('6.2')
  await page.getByRole('button', { name: 'Save Growth' }).click()
  await nav(page).getByRole('button', { name: 'Today' }).click()
  await page.getByRole('button', { name: /Growth & milestones/ }).click()
  await expect(page.getByText(/sex in Profile to see where each reading falls/)).toBeVisible()
  await expect(page.getByText(/\d(st|nd|rd|th) percentile/)).toHaveCount(0)
})

test('a milestone answer is kept, can be changed, and a "not yet" is listed to raise at the checkup', async ({ page }) => {
  await setBaby(page, '2026-04-20', '')
  await nav(page).getByRole('button', { name: 'Today' }).click()
  await page.getByRole('button', { name: /Growth & milestones/ }).click()

  const first = page.getByRole('group', { name: 'Answer for: Knows familiar people' })
  await first.getByRole('button', { name: 'Yes' }).click()
  await expect(first.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')

  await first.getByRole('button', { name: 'Not yet' }).click()
  await expect(first.getByRole('button', { name: 'Not yet' })).toHaveAttribute('aria-pressed', 'true')
  await expect(first.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Worth raising at the next checkup')).toBeVisible()

  await page.reload()
  await nav(page).getByRole('button', { name: 'Today' }).click()
  await page.getByRole('button', { name: /Growth & milestones/ }).click()
  await expect(page.getByRole('group', { name: 'Answer for: Knows familiar people' }).getByRole('button', { name: 'Not yet' })).toHaveAttribute('aria-pressed', 'true')
})

test('the sleep log shows what cannot be right and marks the entries in the Timeline', async ({ page }) => {
  const events = [
    { id: 'a', kind: 'sleep', phase: 'start', at: at(29, 9, 0), loggedBy: 'Dad' },
    { id: 'b', kind: 'sleep', phase: 'start', at: at(29, 10, 30), loggedBy: 'Dad' },
    { id: 'c', kind: 'sleep', phase: 'end', at: at(29, 11, 0), loggedBy: 'Dad' },
  ]
  await page.addInitScript((data) => localStorage.setItem('calendaby.events.v1', data), JSON.stringify(events))
  await page.goto('/')
  const alert = page.getByRole('alert', { name: 'Sleep log needs a look' })
  await expect(alert).toBeVisible()
  await expect(alert.getByText(/with no wake-up between/)).toBeVisible()

  await alert.getByRole('button', { name: /Review/ }).click()
  await expect(page.locator('p.warning', { hasText: 'with no wake-up between' }).first()).toBeVisible()
})

test('the sleep goal for a newborn follows the CDC range and can be above 15 hours', async ({ page }) => {
  await setBaby(page, '2026-10-15', '')
  await nav(page).getByRole('button', { name: 'Today' }).click()
  await expect(page.getByText(/15\.5h goal/)).toBeVisible()
  await expect(page.getByText(/typical 14 to 17 h for this age/)).toBeVisible()
})
