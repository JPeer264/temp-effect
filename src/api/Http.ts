import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { Layer } from "effect"
import { createServer } from "http"
import { Api } from "./Api.js"
import { HttpTodosLive } from "./Todos/Http.js"

const ApiLive = Layer.provide(HttpApiBuilder.api(Api), [HttpTodosLive])

export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors({ allowedOrigins: ["*"] })),
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 }))
)
