import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpLive } from "./Http.js"
import { SentryLive } from "./Sentry.js"

const SentryLayer = SentryLive({
  dsn: process.env.SENTRY_DSN ?? "",
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 1.0,
  debug: process.env.NODE_ENV === "development",
})

const MainLive = HttpLive.pipe(Layer.provide(SentryLayer))

MainLive.pipe(Layer.launch, NodeRuntime.runMain)
