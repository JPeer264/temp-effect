import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer, Metric, Option } from "effect"
import { Api } from "../Api.js"
import { TodoNotFound } from "../Domain/Todo.js"
import { Todos } from "../Todos.js"

const TodosCreatedCounter = Metric.counter("todos.created").pipe(
  Metric.withConstantInput(1),
)

const TodosDeletedCounter = Metric.counter("todos.deleted").pipe(
  Metric.withConstantInput(1),
)

export const HttpTodosLive = HttpApiBuilder.group(Api, "todos", (handlers) =>
  Effect.gen(function* () {
    const todos = yield* Todos

    return handlers
      .handle("list", () =>
        todos.list
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Creating todo").pipe(
            Effect.annotateLogs("title", payload.title)
          )
          const todo = yield* todos.create(payload)
          yield* Metric.increment(TodosCreatedCounter)
          return todo
        }).pipe(Effect.withSpan("Some custom span"))
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
        Effect.gen(function* () {
          yield* todos.remove(path.id)
          yield* Metric.increment(TodosDeletedCounter)
        })
      )
  })
)
