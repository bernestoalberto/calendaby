import { describe, expect, it } from 'vitest'
import { isAllowedOrigin } from './origins'

const VERCEL = 'https://calendaby.vercel.app'
const CUSTOM = 'https://calenbaby.eabonet.com'

describe('isAllowedOrigin', () => {
  it('accepts the app\'s own address, whatever domain it is served from', () => {
    expect(isAllowedOrigin(CUSTOM, `${CUSTOM}/api/agent`, VERCEL)).toBe(true)
    expect(isAllowedOrigin(VERCEL, `${VERCEL}/api/agent`, undefined)).toBe(true)
  })

  it('accepts every address in a comma separated setting', () => {
    expect(isAllowedOrigin(CUSTOM, 'https://elsewhere.example/api/agent', `${VERCEL}, ${CUSTOM}`)).toBe(true)
    expect(isAllowedOrigin(VERCEL, 'https://elsewhere.example/api/agent', `${VERCEL},${CUSTOM}`)).toBe(true)
  })

  it('accepts the Android and iOS apps', () => {
    expect(isAllowedOrigin('https://localhost', `${VERCEL}/api/agent`, VERCEL)).toBe(true)
    expect(isAllowedOrigin('capacitor://localhost', `${VERCEL}/api/agent`, VERCEL)).toBe(true)
  })

  it('refuses a page from any other site, including one that only looks similar', () => {
    expect(isAllowedOrigin('https://evil.example', `${VERCEL}/api/agent`, VERCEL)).toBe(false)
    expect(isAllowedOrigin('https://calendaby.vercel.app.evil.example', `${VERCEL}/api/agent`, VERCEL)).toBe(false)
    expect(isAllowedOrigin('http://calendaby.vercel.app', `${VERCEL}/api/agent`, VERCEL)).toBe(false)
  })

  it('refuses a request that names no origin', () => {
    expect(isAllowedOrigin(null, `${VERCEL}/api/agent`, VERCEL)).toBe(false)
  })
})
