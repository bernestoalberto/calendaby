/** Scrolling that follows the device's "reduce motion" setting (Android's "Remove animations", iOS "Reduce Motion"). */
export function scrollBehavior(): 'smooth' | 'auto' {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return reduced ? 'auto' : 'smooth'
}
