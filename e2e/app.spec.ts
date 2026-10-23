import { networkInterfaces } from 'node:os'
import { expect, test } from '@playwright/test'

const errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors.length = 0
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

for (const screen of ['Today', 'Timeline', 'Log', 'Analytics', 'Agent']) {
  test(`${screen} opens`, async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: screen }).click()
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
}

test('profile opens', async ({ page }) => {
  await page.getByRole('button', { name: 'Baby profile' }).click()
  await expect(page.getByRole('heading').first()).toBeVisible()
})

test('agent answers a baby question', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Agent' }).click()
  await page.getByLabel('Message').fill('How many wet diapers a day is normal?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.locator('.bubble.agent').last()).toContainText(/diaper/i, { timeout: 60_000 })
})

test('works across two open tabs sharing the database', async ({ page, context }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log' }).click()
  await page.getByText('Diaper', { exact: true }).click()
  await page.getByRole('button', { name: 'Wet', exact: true }).click()
  await page.getByRole('button', { name: 'Save Diaper' }).click()

  const second = await context.newPage()
  second.on('pageerror', (e) => errors.push(e.message))
  second.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await second.goto('/')
  await second.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Timeline' }).click()
  await expect(second.getByText(/diaper/i).first()).toBeVisible()
})

test('works over a plain http LAN address with a warning', async ({ page, baseURL }) => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((i) => i?.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
  test.skip(!lan, 'no LAN address')
  await page.goto(`http://${lan?.address}:${new URL(baseURL ?? '').port}`)
  await expect(page.locator('.warning')).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log' }).click()
  await page.getByText('Diaper', { exact: true }).click()
  await page.getByRole('button', { name: 'Wet', exact: true }).click()
  await page.getByRole('button', { name: 'Save Diaper' }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Timeline' }).click()
  await expect(page.getByText(/diaper/i).first()).toBeVisible()
})
