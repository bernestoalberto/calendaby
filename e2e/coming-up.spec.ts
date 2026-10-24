import { expect, test } from '@playwright/test'

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime()

/** Four days of naps, feeds and nights, loaded through the legacy import on first open. */
function seed(): object[] {
  const out: object[] = []
  const add = (e: object) => out.push({ ...e, id: `s${out.length}`, loggedBy: 'Dad' })
  for (const d of [21, 22, 23, 24]) {
    add({ kind: 'sleep', at: at(d - 1, 19, 30), phase: 'start' })
    add({ kind: 'feed', at: at(d, 2, 10), method: 'bottle', amountMl: 120 })
    add({ kind: 'sleep', at: at(d, 6, 50), phase: 'end' })
    add({ kind: 'sleep', at: at(d, 8, 30), phase: 'start' })
    add({ kind: 'sleep', at: at(d, 9, 40), phase: 'end' })
    add({ kind: 'sleep', at: at(d, 11, 45), phase: 'start' })
    add({ kind: 'sleep', at: at(d, 12, 50), phase: 'end' })
    for (const h of [7, 10, 13, 16]) add({ kind: 'feed', at: at(d, h), method: 'bottle', amountMl: 150 })
  }
  return out
}

test('Today shows what is coming up and tonight', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 24, 17, 10))
  await page.addInitScript((data) => localStorage.setItem('calendaby.events.v1', data), JSON.stringify(seed()))
  await page.goto('/')
  const card = page.locator('section.insight')
  await expect(card.getByRole('heading', { name: 'Coming up' })).toBeVisible()
  await expect(card.getByText('Bedtime')).toBeVisible()
  await expect(card.getByText(/Tonight: bed 7:30 PM, about 1 night feed/)).toBeVisible()
})
