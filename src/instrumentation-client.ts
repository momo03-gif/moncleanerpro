// Sentry — initialisation côté CLIENT (navigateur). Capture les erreurs JS des
// utilisateurs (cleaners, hôtels, admin) en conditions réelles.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

// Suivi des transitions de navigation (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
