import "./instrument.server";
import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpLive } from "./Http.js"
import { effectLayer } from "@sentry/core/effect"

const MainLive = HttpLive.pipe(Layer.provide(effectLayer))

MainLive.pipe(Layer.launch, NodeRuntime.runMain)