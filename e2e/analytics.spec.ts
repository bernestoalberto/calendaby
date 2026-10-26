import { expect, test } from '@playwright/test'

const GOOGLE = '**/*googletagmanager.com/**'

test('nothing goes to Google until a parent turns sharing on, and it stops when turned off', async ({ page }) => {
  const asked: string[] = []
  // A stand-in for Google's server: the test never touches the real network.
  await page.route(GOOGLE, async (route) => {
    asked.push(route.request().url())
    await route.fulfill({ contentType: 'text/javascript', body: '' })
  })

  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Timeline' }).click()
  await page.getByRole('button', { name: 'Baby profile' }).click()
  await expect(page.getByText('Help improve Calendaby')).toBeVisible()
  expect(asked).toEqual([])

  await page.getByRole('button', { name: 'Share anonymous usage' }).click()
  await expect(page.getByRole('button', { name: 'Turn off sharing' })).toBeVisible()
  await expect.poll(() => asked.length).toBe(1)
  expect(asked[0]).toBe('https://www.googletagmanager.com/gtag/js?id=G-MEV4FXM7CK')
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['ga-disable-G-MEV4FXM7CK'])).toBe(false)

  await page.getByRole('button', { name: 'Turn off sharing' }).click()
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['ga-disable-G-MEV4FXM7CK'])).toBe(true)
})

test('the choice is remembered after a reload', async ({ page }) => {
  await page.route(GOOGLE, (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Baby profile' }).click()
  await page.getByRole('button', { name: 'Share anonymous usage' }).click()
  await expect(page.getByRole('button', { name: 'Turn off sharing' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Baby profile' }).click()
  await expect(page.getByRole('button', { name: 'Turn off sharing' })).toBeVisible()
})
