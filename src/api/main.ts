import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpLive } from "./Http.js"
import { SentryLive } from "./Sentry.js"
import * as Sentry from "@sentry/node"

const client = Sentry.init({
  dsn: "https://0299849066e3bcf4626b214897b6c17f@o447951.ingest.us.sentry.io/4510555608449024",
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 1.0,
  debug: true,
  enableLogs: true,
})

const MainLive = HttpLive.pipe(Layer.provideMerge(SentryLive(client)))

MainLive.pipe(Layer.launch, NodeRuntime.runMain)