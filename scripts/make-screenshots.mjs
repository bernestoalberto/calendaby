// Takes the app screenshots listed in the PWA manifest (vite.config.ts): a narrow set for phones and a wide set for
// desktop, so browsers can show the richer install dialog. Uses the dev server signed out, with a few sample entries.
// Run after the look of Today or Timeline changes:  npm run screenshots
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const PORT = 5199
const URL = `http://localhost:${PORT}`
const OUT = 'public/screenshots'
const SIZES = {
  narrow: { width: 540, height: 960 },
  wide: { width: 1280, height: 720 },
}
const SAMPLE_ENTRIES = ['fed 4oz', 'wet diaper', 'tummy time 5 min', 'gave vitamin D']
const SCREENS = ['Today', 'Timeline']

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    const up = await fetch(URL).then((r) => r.ok, () => false)
    if (up) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`The dev server did not start on ${URL}`)
}

function stop(server) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill()
}

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel })
    } catch (err) {
      console.warn(`Could not start ${channel}: ${err instanceof Error ? err.message.split('\n')[0] : err}`)
    }
  }
  throw new Error('Needs Chrome or Edge installed to take the screenshots.')
}

async function shoot(browser, form) {
  const context = await browser.newContext({ viewport: SIZES[form], deviceScaleFactor: 1, colorScheme: 'light' })
  const page = await context.newPage()
  await page.goto(URL)
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.waitFor()
  for (const entry of SAMPLE_ENTRIES) {
    await page.getByLabel('Log in your own words').fill(entry)
    await page.getByLabel('Log in your own words').press('Enter')
    await page.waitForTimeout(400)
  }
  // The "Logged ..." toast covers the bottom of the screen for 5 seconds; wait it out.
  await page.getByRole('button', { name: 'Undo' }).waitFor({ state: 'hidden', timeout: 10_000 })
  for (const screen of SCREENS) {
    await nav.getByRole('button', { name: screen }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/${screen.toLowerCase()}-${form}.png` })
  }
  await context.close()
}

mkdirSync(OUT, { recursive: true })
// An empty key (set in the environment, which wins over the .env files) runs the app signed out, so no account is needed.
const env = { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '' }
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore', env })
try {
  await waitForServer()
  const browser = await launch()
  for (const form of Object.keys(SIZES)) await shoot(browser, form)
  await browser.close()
  console.log(`Saved ${SCREENS.length * Object.keys(SIZES).length} screenshots in ${OUT}`)
} finally {
  stop(server)
}
