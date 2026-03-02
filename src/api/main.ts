import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpLive } from "./Http.js"
import { SentryLive, type SentryService } from "./Sentry.js"

const SentryLayer: Layer.Layer<SentryService> = SentryLive({
  dsn: "https://0299849066e3bcf4626b214897b6c17f@o447951.ingest.us.sentry.io/4510555608449024",
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 1.0,
  debug: true,
  serviceName: "effect-todo-api",
})

const MainLive = HttpLive.pipe(Layer.provideMerge(SentryLayer))

MainLive.pipe(Layer.launch, NodeRuntime.runMain)
