'use client';

import dynamic from 'next/dynamic';

// Lazy load Office3D - only loads when user visits /office
const Office3D = dynamic(
  () => import('@/components/Office3D/Office3D'),
  {
    ssr: false, // Disable SSR for 3D canvas
    loading: () => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#111',
        color: '#fff',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(255, 59, 48, 0.3)',
          borderTopColor: '#ff3b30',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
          Loading 3D Office...
        </div>
      </div>
    ),
  }
);

export default function OfficePage() {
  return <Office3D />;
}