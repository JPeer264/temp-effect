import { Effect, Option, Ref } from "effect"
import { Todo, TodoCreateInput, TodoId, TodoNotFound, TodoUpdateInput } from "./Domain/Todo.js"

export class Todos extends Effect.Service<Todos>()("Todos", {
  effect: Effect.gen(function* () {
    const store = yield* Ref.make<Map<TodoId, Todo>>(new Map())
    let idCounter = 0

    const generateId = (): TodoId => {
      idCounter++
      return `todo-${idCounter}` as TodoId
    }

    const list = Effect.gen(function* () {
      const todos = yield* Ref.get(store)
      return Array.from(todos.values())
    }).pipe(Effect.withSpan("Todos.list"))

    const create = (input: TodoCreateInput) =>
      Effect.gen(function* () {
        const id = generateId()
        const todo = new Todo({
          id,
          title: input.title,
          completed: false,
          createdAt: new Date().toISOString()
        })
        yield* Ref.update(store, (map) => new Map(map).set(id, todo))
        return todo
      }).pipe(Effect.withSpan("Todos.create", { attributes: { input } }))

    const findById = (id: TodoId) =>
      Effect.gen(function* () {
        const todos = yield* Ref.get(store)
        return Option.fromNullable(todos.get(id))
      }).pipe(Effect.withSpan("Todos.findById", { attributes: { id } }))

    const update = (id: TodoId, input: TodoUpdateInput) =>
      Effect.gen(function* () {
        const todos = yield* Ref.get(store)
        const existing = todos.get(id)
        if (!existing) {
          return yield* Effect.fail(new TodoNotFound({ id }))
        }
        const updated = new Todo({
          id: existing.id,
          title: input.title ?? existing.title,
          completed: input.completed ?? existing.completed,
          createdAt: existing.createdAt
        })
        yield* Ref.update(store, (map) => new Map(map).set(id, updated))
        return updated
      }).pipe(Effect.withSpan("Todos.update", { attributes: { id, input } }))

    const remove = (id: TodoId) =>
      Effect.gen(function* () {
        const todos = yield* Ref.get(store)
        if (!todos.has(id)) {
          return yield* Effect.fail(new TodoNotFound({ id }))
        }
        yield* Ref.update(store, (map) => {
          const newMap = new Map(map)
          newMap.delete(id)
          return newMap
        })
      }).pipe(Effect.withSpan("Todos.remove", { attributes: { id } }))

    return { list, create, findById, update, remove } as const
  })
}) {}
