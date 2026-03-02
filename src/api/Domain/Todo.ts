import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"))
export type TodoId = typeof TodoId.Type

export const TodoIdFromString = Schema.String.pipe(
  Schema.compose(TodoId)
)

export class Todo extends Schema.Class<Todo>("Todo")({
  id: TodoId,
  title: Schema.String,
  completed: Schema.Boolean,
  createdAt: Schema.String
}) {}

export const TodoCreateInput = Schema.Struct({
  title: Schema.String
})
export type TodoCreateInput = typeof TodoCreateInput.Type

export const TodoUpdateInput = Schema.Struct({
  title: Schema.optional(Schema.String),
  completed: Schema.optional(Schema.Boolean)
})
export type TodoUpdateInput = typeof TodoUpdateInput.Type

export class TodoNotFound extends Schema.TaggedError<TodoNotFound>()(
  "TodoNotFound",
  { id: Schema.String },
  HttpApiSchema.annotations({ status: 404 })
) {}
