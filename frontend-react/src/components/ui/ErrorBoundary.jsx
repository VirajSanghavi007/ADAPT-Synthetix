import { Component } from 'react'
import { C } from '@/lib/theme'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ padding: 24, color: C.clay, fontSize: 11 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
        <div style={{ color: C.textMuted }}>{this.state.error?.message}</div>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{
            marginTop: 10, padding: '4px 10px', fontSize: 10,
            background: 'transparent', border: `1px solid ${C.clay}44`,
            borderRadius: 4, color: C.clay, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      </div>
    )
  }
}
