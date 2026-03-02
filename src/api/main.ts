import "./instrument.server";
import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpLive } from "./Http.js"
import { SentryLive } from "./Sentry.js"

const MainLive = HttpLive.pipe(Layer.provideMerge(SentryLive()))

MainLive.pipe(Layer.launch, NodeRuntime.runMain)