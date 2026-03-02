import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpLive } from "./Http.js"
import { SentryLive } from "./Sentry.js"
import * as Sentry from "@sentry/node"

const MainLive = HttpLive.pipe(Layer.provideMerge(SentryLive(Sentry.getClient())))

MainLive.pipe(Layer.launch, NodeRuntime.runMain)