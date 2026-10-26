import { expect, test } from '@playwright/test'

test('an invite link opens Profile and takes the code out of the address bar', async ({ page }) => {
  await page.goto('/?join=PK5-CPA')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Baby profile' })).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
  await expect(page.getByText('Caregiver on this phone')).toBeVisible()
})

test('a protocol link from the browser does the same', async ({ page }) => {
  await page.goto(`/?open=${encodeURIComponent('web+calendaby:join/PK5-CPA')}`)
  await expect(page.getByText('Caregiver on this phone')).toBeVisible()
})

test('a link without a valid code opens the app as usual', async ({ page }) => {
  await page.goto('/?join=nope')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(page.getByText('Caregiver on this phone')).toBeHidden()
})
