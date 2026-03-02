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
        todos.list.pipe(
          Effect.withSpan("todos.list", { attributes: { "sentry.op": "db.query" } })
        )
      )
      .handle("create", ({ payload }) =>
        todos.create(payload).pipe(
          Effect.tap(() => sentry.addBreadcrumb({
            category: "todo",
            message: `Created todo: ${payload.title}`,
            level: "info",
          })),
          Effect.withSpan("todos.create", { attributes: { "sentry.op": "db.insert" } })
        )
      )
      .handle("findById", ({ path }) =>
        Effect.gen(function* () {
          const maybeTodo = yield* todos.findById(path.id)
          if (Option.isNone(maybeTodo)) {
            return yield* Effect.fail(new TodoNotFound({ id: path.id }))
          }
          return maybeTodo.value
        }).pipe(
          Effect.withSpan("todos.findById", {
            attributes: { "sentry.op": "db.query", "todo.id": path.id },
          })
        )
      )
      .handle("update", ({ path, payload }) =>
        todos.update(path.id, payload).pipe(
          Effect.withSpan("todos.update", {
            attributes: { "sentry.op": "db.update", "todo.id": path.id },
          })
        )
      )
      .handle("delete", ({ path }) =>
        todos.remove(path.id).pipe(
          Effect.withSpan("todos.delete", {
            attributes: { "sentry.op": "db.delete", "todo.id": path.id },
          })
        )
      )
  })
).pipe(Layer.provide(Todos.Default))
