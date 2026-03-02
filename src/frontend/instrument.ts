import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: "https://a9bca71876a6583f20495b3daf74264d@o447951.ingest.us.sentry.io/4510821494292480",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^http:\/\/localhost/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
