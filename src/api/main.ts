import "./instrument.server";
import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpLive } from "./Http.js"
import { withSentry } from "./Sentry.js"

const MainLive = HttpLive.pipe(withSentry)

MainLive.pipe(Layer.launch, NodeRuntime.runMain)