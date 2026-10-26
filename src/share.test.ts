import { afterEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ on: false, share: vi.fn(), canShare: vi.fn() }))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on } }))
vi.mock('@capacitor/share', () => ({ Share: { share: native.share, canShare: native.canShare } }))

import { shareText } from './share'

afterEach(() => {
  native.on = false
  native.share.mockReset()
  native.canShare.mockReset()
  vi.unstubAllGlobals()
})

describe('shareText', () => {
  it('uses the native share sheet in the phone app', async () => {
    native.on = true
    native.canShare.mockResolvedValue({ value: true })
    native.share.mockResolvedValue({})
    expect(await shareText('Invite', 'Join us')).toBe('shared')
    expect(native.share).toHaveBeenCalledWith({ title: 'Invite', text: 'Join us', dialogTitle: 'Invite' })
  })

  it('uses the browser share API on the web', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    expect(await shareText('Invite', 'Join us')).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Invite', text: 'Join us' })
  })

  it('reports a cancelled share instead of an error', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')) })
    expect(await shareText('Invite', 'Join us')).toBe('cancelled')
  })

  it('lets a real failure through', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('boom')) })
    await expect(shareText('Invite', 'Join us')).rejects.toThrow('boom')
  })

  it('copies to the clipboard when nothing can share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await shareText('Invite', 'Join us')).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('Join us')
  })
})
