import { useState } from 'react'
import { useAccount } from './accountContext'

/** Two taps on purpose: the first only explains what goes, the second erases it. */
export function DeleteData({ onDelete }: Readonly<{ onDelete: () => Promise<void> }>) {
  const { signedIn } = useAccount()
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [error, setError] = useState<string>()

  async function remove() {
    setStep('deleting')
    setError(undefined)
    try {
      await onDelete()
    } catch (err) {
      setError(`Nothing was deleted. ${err instanceof Error ? err.message : 'Try again.'}`)
      setStep('confirm')
    }
  }

  if (step === 'idle') {
    return (
      <button type="button" className="pill quiet wide danger" onClick={() => setStep('confirm')}>
        Delete all my data
      </button>
    )
  }
  return (
    <div className="delete-confirm" role="alert">
      <p>
        <b>This cannot be undone.</b> Every log, setting, reminder and quick pick on this phone is erased
        {signedIn ? ', and so is your copy on the server. If you share a family, its log stays with the others and you leave it' : ''}.
        The app then starts over as if newly installed.
      </p>
      {error && <p className="field-error">{error}</p>}
      <div className="card-foot">
        <button type="button" className="pill quiet" disabled={step === 'deleting'} onClick={() => setStep('idle')}>
          Cancel
        </button>
        <button type="button" className="pill danger" disabled={step === 'deleting'} onClick={() => void remove()}>
          {step === 'deleting' ? 'Deleting…' : 'Delete everything'}
        </button>
      </div>
    </div>
  )
}
