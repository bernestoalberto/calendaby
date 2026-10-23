// Builds the web app, syncs it into the Android project and builds the debug APK. If a phone or emulator
// is connected it installs the APK; otherwise it skips the install and still exits 0.
// Works on Windows, macOS and Linux. Needs adb on PATH and USB debugging on to install.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const win = process.platform === 'win32'
const android = join(process.cwd(), 'android')
const apk = join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

function run(cmd, args, cwd = process.cwd()) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: win })
  if (res.status !== 0) {
    console.error(`\nFailed: ${cmd} ${args.join(' ')}`)
    process.exit(res.status ?? 1)
  }
}

/** Serials of devices in the "device" state; "unauthorized" and "offline" ones cannot be installed to. */
function connectedDevices() {
  const res = spawnSync('adb', ['devices'], { encoding: 'utf8', shell: win })
  if (res.error || res.status !== 0) return undefined
  return res.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial)
}

run('npm', ['run', 'cap:sync'])
run(win ? 'gradlew.bat' : './gradlew', ['assembleDebug'], android)

const devices = connectedDevices()
if (devices === undefined) {
  console.log(`\nBuilt ${apk}\nSkipped install: adb was not found on PATH.`)
} else if (devices.length === 0) {
  console.log(`\nBuilt ${apk}\nSkipped install: no phone or emulator connected (check the cable and USB debugging).`)
} else {
  for (const serial of devices) run('adb', ['-s', serial, 'install', '-r', apk])
  console.log(`\nInstalled on ${devices.length} device${devices.length === 1 ? '' : 's'}. Open Calendaby on the phone.`)
}
