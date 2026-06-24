// Sentry — initialisation côté EDGE (proxy.ts, fonctions edge).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
