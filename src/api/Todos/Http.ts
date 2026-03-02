import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer, Option } from "effect"
import { Api } from "../Api.js"
import { TodoNotFound } from "../Domain/Todo.js"
import { Todos } from "../Todos.js"
import * as SentryEffect from "../Sentry.js"

export const HttpTodosLive = HttpApiBuilder.group(Api, "todos", (handlers) =>
  Effect.gen(function* () {
    const todos = yield* Todos
    const sentry = yield* SentryEffect.SentryService

    return handlers
      .handle("list", () =>
        todos.list
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Creating todo").pipe(
            Effect.annotateLogs("title", payload.title)
          )
          return yield* todos.create(payload)
        })
      )
      .handle("findById", ({ path }) =>
        Effect.gen(function* () {
          const maybeTodo = yield* todos.findById(path.id)
          if (Option.isNone(maybeTodo)) {
            return yield* Effect.fail(new TodoNotFound({ id: path.id }))
          }
          return maybeTodo.value
        })
      )
      .handle("update", ({ path, payload }) =>
        todos.update(path.id, payload)
      )
      .handle("delete", ({ path }) =>
        todos.remove(path.id)
      )
  })
).pipe(Layer.provide(Todos.Default))
