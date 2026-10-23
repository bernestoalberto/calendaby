// Renders the SVG sources in assets/ to every icon and splash the app ships: PWA, Android and iOS.
// Uses headless Edge or Chrome (already on most dev machines) instead of a native image library.
// Run after editing assets/*.svg:  node scripts/make-icons.mjs
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync)
if (!browser) {
  console.error('Needs Edge or Chrome installed to render the icons.')
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'calendaby-icons-'))
const svg = (name) => readFileSync(join('assets', name), 'utf8')

/** Renders an SVG into a w x h PNG. `shape` clips the corners; `bg` fills behind the art (splashes). */
function render(source, out, w, h, { shape, bg = 'transparent', fit = 'contain' } = {}) {
  const radius = shape === 'round' ? '50%' : shape === 'rounded' ? '22%' : '0'
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;background:${bg};overflow:hidden}
img{width:${w}px;height:${h}px;object-fit:${fit};border-radius:${radius};display:block}</style>
<img src="data:image/svg+xml;base64,${Buffer.from(svg(source)).toString('base64')}">`
  const page = join(work, `${out.replaceAll(/[^\w]/g, '_')}.html`)
  writeFileSync(page, html)
  mkdirSync(dirname(out), { recursive: true })
  const res = spawnSync(
    browser,
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--window-size=${w},${h}`, `--screenshot=${join(process.cwd(), out)}`, pathToFileURL(page).href],
    { stdio: 'ignore' },
  )
  if (res.status !== 0 || !existsSync(out)) throw new Error(`Could not render ${out}`)
}

// PWA and browser
render('icon-only.svg', 'public/icon-192.png', 192, 192)
render('icon-only.svg', 'public/icon-512.png', 512, 512)
copyFileSync('assets/icon-rounded.svg', 'public/icon.svg')
copyFileSync('assets/icon-rounded.svg', 'public/favicon.svg')

// Android launcher: legacy square and round icons, plus the adaptive foreground (108dp canvas)
const res = 'android/app/src/main/res'
for (const [d, dp] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  render('icon-only.svg', `${res}/mipmap-${d}/ic_launcher.png`, 48 * dp, 48 * dp, { shape: 'rounded' })
  render('icon-only.svg', `${res}/mipmap-${d}/ic_launcher_round.png`, 48 * dp, 48 * dp, { shape: 'round' })
  render('icon-foreground.svg', `${res}/mipmap-${d}/ic_launcher_foreground.png`, 108 * dp, 108 * dp)
}

// Android splash (portrait, landscape and default), centered on the app background
const splashSizes = {
  'drawable': [480, 320],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
}
for (const [dir, [w, h]] of Object.entries(splashSizes)) render('splash.svg', `${res}/${dir}/splash.png`, w, h, { bg: '#fff8f8' })

// iOS
render('icon-only.svg', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024)
const splash = 'ios/App/App/Assets.xcassets/Splash.imageset'
render('splash.svg', `${splash}/splash-2732x2732.png`, 2732, 2732, { bg: '#fff8f8' })
render('splash.svg', `${splash}/splash-2732x2732-1.png`, 2732, 2732, { bg: '#fff8f8' })
render('splash-dark.svg', `${splash}/splash-2732x2732-2.png`, 2732, 2732, { bg: '#16131a' })

console.log('Icons and splash screens regenerated. Run npm run android:install to see them.')
