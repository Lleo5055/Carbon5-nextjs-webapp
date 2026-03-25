'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'greenio_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
    // Enable GA4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    }
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#111827',
      color: '#f9fafb',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.2)',
    }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, flex: 1, minWidth: 240 }}>
        We use cookies to analyse site traffic and improve your experience. See our{' '}
        <a href="/privacy" style={{ color: '#34d399', textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            background: 'transparent',
            border: '1px solid #4b5563',
            color: '#9ca3af',
            borderRadius: 6,
            padding: '8px 18px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{
            background: '#059669',
            border: 'none',
            color: '#fff',
            borderRadius: 6,
            padding: '8px 18px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
