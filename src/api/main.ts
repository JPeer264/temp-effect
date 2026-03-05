import * as Sentry from "@sentry/effect"
import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpLive } from "./Http.js"

const MainLive = HttpLive.pipe(Layer.provide(Sentry.effectLayer({
  dsn: "https://0299849066e3bcf4626b214897b6c17f@o447951.ingest.us.sentry.io/4510555608449024",
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0,
  debug: true,
})))

MainLive.pipe(Layer.launch, NodeRuntime.runMain)