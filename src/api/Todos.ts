import { SqlClient } from "@effect/sql"
import { Effect, Option } from "effect"
import { Todo, TodoCreateInput, TodoId, TodoNotFound, TodoUpdateInput } from "./Domain/Todo.js"

interface TodoRow {
  readonly id: number
  readonly title: string
  readonly completed: boolean
  readonly created_at: Date
}

const rowToTodo = (row: TodoRow): Todo =>
  new Todo({
    id: `todo-${row.id}` as TodoId,
    title: row.title,
    completed: row.completed,
    createdAt: row.created_at.toISOString(),
  })

const parseId = (id: TodoId): Effect.Effect<number, TodoNotFound> => {
  const match = id.match(/^todo-(\d+)$/)
  if (!match || !match[1]) return Effect.fail(new TodoNotFound({ id }))
  return Effect.succeed(parseInt(match[1], 10))
}

export class Todos extends Effect.Service<Todos>()("Todos", {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const list = sql<TodoRow>`SELECT * FROM todos ORDER BY created_at DESC`.pipe(
      Effect.map((rows) => rows.map(rowToTodo)),
      Effect.orDie,
      Effect.withSpan("Todos.list"),
    )

    const create = (input: TodoCreateInput) =>
      sql<TodoRow>`INSERT INTO todos (title) VALUES (${input.title}) RETURNING *`.pipe(
        Effect.flatMap((rows) =>
          rows[0] ? Effect.succeed(rowToTodo(rows[0])) : Effect.die("Insert returned no rows"),
        ),
        Effect.orDie,
        Effect.withSpan("Todos.create", { attributes: { input } }),
      )

    const findById = (id: TodoId) =>
      parseId(id).pipe(
        Effect.flatMap((numericId) => sql<TodoRow>`SELECT * FROM todos WHERE id = ${numericId}`),
        Effect.map((rows) => (rows[0] ? Option.some(rowToTodo(rows[0])) : Option.none())),
        Effect.orDie,
        Effect.withSpan("Todos.findById", { attributes: { id } }),
      )

    const update = (id: TodoId, input: TodoUpdateInput) =>
      Effect.gen(function* () {
        const numericId = yield* parseId(id)
        const existing = yield* sql<TodoRow>`SELECT * FROM todos WHERE id = ${numericId}`
        const current = existing[0]
        if (!current) {
          return yield* Effect.fail(new TodoNotFound({ id }))
        }

        const newTitle = input.title ?? current.title
        const newCompleted = input.completed ?? current.completed

        const updated = yield* sql<TodoRow>`
          UPDATE todos 
          SET title = ${newTitle}, completed = ${newCompleted}
          WHERE id = ${numericId}
          RETURNING *
        `
        const updatedRow = updated[0]
        if (!updatedRow) {
          return yield* Effect.die("Update returned no rows")
        }
        return rowToTodo(updatedRow)
      }).pipe(Effect.orDie, Effect.withSpan("Todos.update", { attributes: { id, input } }))

    const remove = (id: TodoId) =>
      Effect.gen(function* () {
        const numericId = yield* parseId(id)
        const existing = yield* sql<TodoRow>`SELECT * FROM todos WHERE id = ${numericId}`
        if (existing.length === 0) {
          return yield* Effect.fail(new TodoNotFound({ id }))
        }
        yield* sql`DELETE FROM todos WHERE id = ${numericId}`
      }).pipe(Effect.orDie, Effect.withSpan("Todos.remove", { attributes: { id } }))

    return { list, create, findById, update, remove } as const
  }),
  dependencies: [],
}) {}
