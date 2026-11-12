import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Without this, one error while drawing (or a screen's code that fails to download after an update) unmounts the whole
 * app and leaves a blank page. Everything logged is already saved on the phone, so reloading is safe.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen failed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <AppProblem detail={this.state.error.message} />
  }
}

export function AppProblem(p: { detail: string }) {
  return (
    <main className="center stack" role="alert">
      <h2>Something went wrong</h2>
      <p className="muted small">Your entries are saved on this phone. Reloading usually fixes it.</p>
      <p className="muted small">{p.detail}</p>
      <button type="button" className="pill primary" onClick={() => location.reload()}>
        Reload
      </button>
    </main>
  )
}
