// Builds the web app, syncs it into the Android project and builds the debug APK. If a phone or emulator
// is connected it installs the APK and opens the app; otherwise it skips the install and still exits 0.
// Works on Windows, macOS and Linux. Needs adb on PATH and USB debugging on to install.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const win = process.platform === 'win32'
const android = join(process.cwd(), 'android')
const appId = 'com.calendaby.app'
const apk = join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

// A JDK is usable only if it has a java binary: a folder left behind by an interrupted Android Studio update exists but is empty.
const javaBin = (home) => join(home, 'bin', win ? 'java.exe' : 'java')
const usableJdk = (home) => Boolean(home) && existsSync(javaBin(home.trim()))

// Android Studio can sit in "Android Studio", "Android Studio1" and so on.
function studioJdks() {
  const root = 'C:/Program Files/Android'
  const windows = existsSync(root) ? readdirSync(root).filter((d) => d.startsWith('Android Studio')).map((d) => `${root}/${d}/jbr`) : []
  return [...windows, '/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr']
}

// A stale JAVA_HOME (an uninstalled JDK, or a stray space at the end) breaks Gradle; fall back to Android Studio's bundled JDK.
const env = { ...process.env }
if (usableJdk(env.JAVA_HOME)) {
  env.JAVA_HOME = env.JAVA_HOME.trim()
} else {
  const studioJdk = studioJdks().find(usableJdk)
  if (studioJdk) env.JAVA_HOME = studioJdk
}

// adb is often missing from PATH even with the SDK installed.
const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? (env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Android', 'Sdk') : undefined)
const sdkAdb = sdk ? join(sdk, 'platform-tools', win ? 'adb.exe' : 'adb') : undefined
const adb = sdkAdb && existsSync(sdkAdb) ? `"${sdkAdb}"` : 'adb'

function run(cmd, args, cwd = process.cwd()) {
  const res = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: win })
  if (res.status !== 0) {
    console.error(`\nFailed: ${cmd} ${args.join(' ')}`)
    process.exit(res.status ?? 1)
  }
}

/** Serials of devices in the "device" state; "unauthorized" and "offline" ones cannot be installed to. */
function connectedDevices() {
  const res = spawnSync(adb, ['devices'], { env, encoding: 'utf8', shell: win })
  if (res.error || res.status !== 0) return undefined
  return res.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial)
}

run('npm', ['run', 'cap:sync'])
run(join(android, win ? 'gradlew.bat' : 'gradlew'), ['assembleDebug'], android)

const devices = connectedDevices()
if (devices === undefined) {
  console.log(`\nBuilt ${apk}\nSkipped install: adb was not found on PATH.`)
} else if (devices.length === 0) {
  console.log(`\nBuilt ${apk}\nSkipped install: no phone or emulator connected (check the cable and USB debugging).`)
} else {
  for (const serial of devices) {
    run(adb, ['-s', serial, 'install', '-r', apk])
    // Starts the app; on a locked screen it opens as soon as the phone is unlocked.
    run(adb, ['-s', serial, 'shell', 'am', 'start', '-n', `${appId}/.MainActivity`])
  }
  console.log(`\nInstalled on ${devices.length} device${devices.length === 1 ? '' : 's'}. Calendaby is opening on the phone.`)
}
