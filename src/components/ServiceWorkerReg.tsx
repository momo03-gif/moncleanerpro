'use client';

import { useEffect } from 'react';

export default function ServiceWorkerReg() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(console.error);
    }
  }, []);

  return null;
}
