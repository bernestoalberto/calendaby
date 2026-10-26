import { afterEach, describe, expect, it, vi } from 'vitest'
import { keepStorage } from './keepStorage'

afterEach(() => vi.unstubAllGlobals())

const withStorage = (storage: object | undefined) => vi.stubGlobal('navigator', { storage })

describe('keepStorage', () => {
  it('does nothing when the browser has no storage API', async () => {
    withStorage(undefined)
    expect(await keepStorage()).toBe('unsupported')
  })

  it('does not ask again when the storage is already kept', async () => {
    const persist = vi.fn()
    withStorage({ persisted: async () => true, persist })
    expect(await keepStorage()).toBe('kept')
    expect(persist).not.toHaveBeenCalled()
  })

  it('asks the browser to keep the data and reports the answer', async () => {
    withStorage({ persisted: async () => false, persist: async () => true })
    expect(await keepStorage()).toBe('kept')
    withStorage({ persisted: async () => false, persist: async () => false })
    expect(await keepStorage()).toBe('refused')
  })

  it('lets a real failure through', async () => {
    withStorage({ persisted: async () => false, persist: async () => Promise.reject(new Error('blocked')) })
    await expect(keepStorage()).rejects.toThrow('blocked')
  })
})
