import { expect, test } from '@playwright/test'

const GOOGLE = '**/*googletagmanager.com/**'
const DISABLE_FLAG = 'ga-disable-G-MEV4FXM7CK'

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
  expect(asked[0]).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-P2BQ7L9N')
  expect(await page.evaluate((flag) => (window as unknown as Record<string, unknown>)[flag], DISABLE_FLAG)).toBe(false)

  await page.getByRole('button', { name: 'Turn off sharing' }).click()
  expect(await page.evaluate((flag) => (window as unknown as Record<string, unknown>)[flag], DISABLE_FLAG)).toBe(true)
})

test('only listed events reach the container, and never the typed text', async ({ page }) => {
  await page.route(GOOGLE, (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Baby profile' }).click()
  await page.getByRole('button', { name: 'Share anonymous usage' }).click()
  await expect(page.getByRole('button', { name: 'Turn off sharing' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Today' }).click()
  await page.getByLabel('Log in your own words').fill('wet diaper, Lily is asleep at 3pm')
  await page.getByLabel('Log in your own words').press('Enter')
  await expect(page.getByText(/Logged/)).toBeVisible()

  const layer = JSON.stringify(await page.evaluate(() => (window as unknown as { dataLayer: unknown[] }).dataLayer.map((e) => (Symbol.iterator in Object(e) ? Array.from(e as Iterable<unknown>) : e))))
  expect(layer).toContain('"event":"log_entry","kind":"diaper"')
  expect(layer).toContain('"event":"screen_opened","screen":"today"')
  expect(layer).not.toMatch(/Lily|3pm|asleep/)
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
