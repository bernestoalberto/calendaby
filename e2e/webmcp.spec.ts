import { expect, test } from '@playwright/test'

type Tool = { execute: (args: unknown) => Promise<string>; annotations?: { readOnlyHint?: boolean } }
declare global {
  interface Window {
    __tools: Record<string, Tool>
  }
}

test.beforeEach(async ({ page }) => {
  // Stands in for Chrome's WebMCP, which is still an origin trial: it just remembers the tools the page offers.
  await page.addInitScript(() => {
    window.__tools = {}
    Object.defineProperty(document, 'modelContext', {
      value: { registerTool: async (tool: Tool & { name: string }) => void (window.__tools[tool.name] = tool) },
    })
  })
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await page.waitForFunction(() => Object.keys(window.__tools).length === 4)
})

test('an assistant can log a sentence, and the parent sees it and can undo it', async ({ page }) => {
  const reply = await page.evaluate(() => window.__tools.log_baby_event.execute({ text: 'wet diaper' }))
  expect(reply).toMatch(/^Logged/)
  await expect(page.getByText(/^Assistant: Logged/)).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Undone')).toBeVisible()
})

test('an assistant is told what was not understood instead of a guess being logged', async ({ page }) => {
  const reply = await page.evaluate(() => window.__tools.log_baby_event.execute({ text: 'purple elephants' }))
  expect(reply).toContain('Not logged')
  expect(reply).not.toMatch(/^Logged/)
})

test('an assistant can read the handoff and today\'s totals', async ({ page }) => {
  await page.evaluate(() => window.__tools.log_baby_event.execute({ text: 'fed 4oz' }))
  expect(await page.evaluate(() => window.__tools.get_today_summary.execute({}))).toContain('Feeds: 1')
  expect(await page.evaluate(() => window.__tools.get_handoff_brief.execute({}))).toMatch(/feed/i)
})

test('an assistant can ask what is expected next', async ({ page }) => {
  expect(await page.evaluate(() => window.__tools.get_upcoming_predictions.execute({}))).toMatch(/next|predict/i)
})

test('the Say it form is a tool, and an assistant-started submit logs and answers it', async ({ page }) => {
  const form = page.locator('form[toolname="fill_log_box"]')
  await expect(form).toHaveAttribute('tooldescription', /Say it/)
  const answer = await page.evaluate(() => {
    const f = document.querySelector('form[toolname="fill_log_box"]') as HTMLFormElement
    let reply: Promise<unknown> = Promise.resolve('')
    const ev = Object.assign(new SubmitEvent('submit', { cancelable: true, bubbles: true }), {
      agentInvoked: true,
      respondWith: (p: Promise<unknown>) => void (reply = p),
    })
    ;(f.elements.namedItem('text') as HTMLInputElement).value = 'wet diaper'
    f.dispatchEvent(ev)
    return reply
  })
  expect(answer).toBeTruthy()
})

test('input that is not a sentence is refused', async ({ page }) => {
  const message = await page.evaluate(() => window.__tools.log_baby_event.execute({ text: 5 }).then(() => '', (e: Error) => e.message))
  expect(message).not.toBe('')
})
