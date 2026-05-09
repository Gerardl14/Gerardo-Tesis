'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    initialize().then((cleanup) => {
      unsub = cleanup;
    });
    return () => unsub?.();
  }, [initialize]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0e0e0f', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: '#6dddff' }}>AIS</span>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400, fontSize: '1.25rem', color: '#adaaab' }}>Lab</span>
        </div>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return <>{children}</>;
}
