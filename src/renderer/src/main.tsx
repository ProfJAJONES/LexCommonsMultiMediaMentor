import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'monospace', padding: 40, gap: 16
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171' }}>Something went wrong</div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 600, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 8, padding: '8px 20px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
