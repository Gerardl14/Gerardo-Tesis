'use client';

import { Component, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '50vh', padding: '2rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(255,113,108,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <AlertTriangle size={32} color="var(--error)" />
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Algo salió mal
            </h2>
            <p style={{
              color: 'var(--on-surface-variant)', fontSize: '0.9rem',
              lineHeight: 1.6, marginBottom: '1.5rem',
            }}>
              {this.props.fallbackMessage || 'Ocurrió un error inesperado. Puedes intentar recargar la sección.'}
            </p>
            {this.state.error && (
              <p style={{
                color: 'var(--error)', fontSize: '0.75rem',
                padding: '0.5rem 0.75rem', background: 'rgba(255,113,108,0.08)',
                borderRadius: '0.5rem', marginBottom: '1rem',
                fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all',
              }}>
                {this.state.error.message}
              </p>
            )}
            <button
              className="btn-primary"
              onClick={this.handleRetry}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
