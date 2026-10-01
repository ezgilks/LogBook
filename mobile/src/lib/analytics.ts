// Product analytics boundary. No-ops until a PostHog key is configured
// (EXPO_PUBLIC_POSTHOG_KEY); see README "Services".

type Props = Record<string, string | number | boolean>;
type Sink = (event: string, props?: Props) => void;

let sink: Sink | null = null;

export function setAnalyticsSink(s: Sink | null) {
  sink = s;
}

export function track(event: string, props?: Props) {
  try {
    sink?.(event, props);
  } catch {}
}
