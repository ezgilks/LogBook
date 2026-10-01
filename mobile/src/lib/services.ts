import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import { setAnalyticsSink } from './analytics';

// Crash reporting and product analytics. Each stays off until its key is set in
// .env (see README "Services"), so local dev and tests never phone home.

let started = false;

export function initServices() {
  if (started) return;
  started = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({ dsn, tracesSampleRate: 0.2, enabled: !__DEV__ });
  }

  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (key) {
    const posthog = new PostHog(key, { host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com' });
    setAnalyticsSink((event, props) => posthog.capture(event, props));
  }
}
