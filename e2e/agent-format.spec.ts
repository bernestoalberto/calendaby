import { expect, test } from '@playwright/test'

const reply = [
  "Baby's next nap is around **2:10 PM**.",
  '',
  '- Offer a feed around **1:30 PM**.',
  '- Wind down from 1:55 PM.',
  '',
  'More: [CDC](https://www.cdc.gov/sleep/about/index.html) <b>not bold</b> [bad](javascript:alert(1))',
].join('\n')

test('the agent\'s reply is shown with bold times, bullets and a safe link, and no raw markup', async ({ page }) => {
  // A stand-in for the agent: the test never calls a model.
  await page.route('**/api/agent', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply, drafts: [], questions: [] }) }))
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Agent' }).click()
  await page.getByLabel('Message').fill('When is the next nap?')
  await page.getByRole('button', { name: 'Send' }).click()

  const bubble = page.locator('.bubble.agent .reply')
  await expect(bubble.locator('strong').first()).toHaveText('2:10 PM')
  await expect(bubble.locator('li')).toHaveCount(2)
  await expect(bubble.locator('a')).toHaveCount(1)
  await expect(bubble.locator('a')).toHaveAttribute('href', 'https://www.cdc.gov/sleep/about/index.html')
  await expect(bubble.getByText('<b>not bold</b>')).toBeVisible()
  await expect(bubble.getByText('[bad](javascript:alert(1))')).toBeVisible()
  await expect(bubble.getByText('**')).toHaveCount(0)
})
