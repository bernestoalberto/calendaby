/** The part of `document` this needs; a plain object can stand in for it in tests. */
interface Visibility {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/**
 * Runs an app update only while nobody is looking at the app. Reloading the page in front of a parent would throw away a
 * half-typed entry, so a new version waits until the app goes to the background or the tab is closed and reopened.
 */
export function updateWhenAway(update: () => void, doc: Visibility = document): void {
  if (doc.visibilityState === 'hidden') {
    update()
    return
  }
  const onChange = () => {
    if (doc.visibilityState !== 'hidden') return
    doc.removeEventListener('visibilitychange', onChange)
    update()
  }
  doc.addEventListener('visibilitychange', onChange)
}
