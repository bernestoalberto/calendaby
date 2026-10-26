import { expect, test, type Page } from '@playwright/test'

test('the first Tab stop is a skip link that jumps past the top bar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to main content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()
})

test('the agent\'s reply can be listened to and stopped, and is announced to screen readers', async ({ page }) => {
  // A stand-in for the device voice: it records what is read and never plays or finishes on its own.
  await page.addInitScript(() => {
    const said: string[] = []
    ;(window as unknown as { said: string[] }).said = said
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void said.push(u.text)
    window.speechSynthesis.cancel = () => undefined
  })
  await page.route('**/api/agent', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Next nap is around **2:10 PM**.\n\n- Offer a feed at **1:30 PM**.', drafts: [], questions: [] }) }),
  )
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Agent' }).click()
  await expect(page.locator('ol.chat')).toHaveAttribute('aria-live', 'polite')
  await page.getByLabel('Message').fill('When is the next nap?')
  await page.getByRole('button', { name: 'Send' }).click()

  const listen = page.getByRole('button', { name: 'Listen' })
  await expect(listen).toBeVisible()
  await listen.click()
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => (window as unknown as { said: string[] }).said)).toEqual(['Next nap is around 2:10 PM. Offer a feed at 1:30 PM.'])
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByRole('button', { name: 'Listen' })).toHaveAttribute('aria-pressed', 'false')
})

const transitionSeconds = (page: Page) =>
  page.getByRole('button', { name: 'Baby profile' }).click().then(() => page.locator('.pill').first().evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration)))

test.describe('when the device asks to reduce motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('animations and transitions are effectively off', async ({ page }) => {
    await page.goto('/')
    expect(await transitionSeconds(page)).toBeLessThan(0.01)
  })
})

test('animations stay on when the device has not asked to reduce motion', async ({ page }) => {
  await page.goto('/')
  expect(await transitionSeconds(page)).toBeGreaterThan(0.05)
})

test('a spoken "um" never reaches the entry box', async ({ page }) => {
  // The browser's recognizer, replaced by one that says a sentence with fillers in it.
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = ''
      interimResults = false
      onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      start() {
        setTimeout(() => this.onresult?.({ results: [[{ transcript: 'um fed, uh, four ounces' }]] }), 50)
      }
      stop() {
        this.onend?.()
      }
    }
    // Chrome has both the prefixed and the plain name; the app uses whichever it finds first.
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Speak' }).click()
  await expect(page.getByLabel('Log in your own words')).toHaveValue('fed, four ounces')
})
