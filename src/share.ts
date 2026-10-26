import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

export type ShareResult = 'shared' | 'cancelled' | 'copied'

function cancelled(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === 'AbortError'
  // The native plugin rejects with a plain Error when the person closes the sheet.
  return err instanceof Error && /cancel/i.test(err.message)
}

/**
 * Phone app: the system share sheet. Browser: the Web Share API. Anything else: the clipboard.
 * Closing the sheet is not an error; a real failure throws.
 */
export async function shareText(title: string, text: string): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform() && (await Share.canShare()).value) {
      await Share.share({ title, text, dialogTitle: title })
      return 'shared'
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text })
      return 'shared'
    }
  } catch (err) {
    if (cancelled(err)) return 'cancelled'
    throw err
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
