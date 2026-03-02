import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import { Todo, TodoCreateInput, TodoIdFromString, TodoNotFound, TodoUpdateInput } from "../Domain/Todo.js"

export class TodosApi extends HttpApiGroup.make("todos")
  .add(
    HttpApiEndpoint.get("list", "/")
      .addSuccess(Schema.Array(Todo))
  )
  .add(
    HttpApiEndpoint.post("create", "/")
      .setPayload(TodoCreateInput)
      .addSuccess(Todo)
  )
  .add(
    HttpApiEndpoint.get("findById", "/:id")
      .setPath(Schema.Struct({ id: TodoIdFromString }))
      .addSuccess(Todo)
      .addError(TodoNotFound)
  )
  .add(
    HttpApiEndpoint.patch("update", "/:id")
      .setPath(Schema.Struct({ id: TodoIdFromString }))
      .setPayload(TodoUpdateInput)
      .addSuccess(Todo)
      .addError(TodoNotFound)
  )
  .add(
    HttpApiEndpoint.del("delete", "/:id")
      .setPath(Schema.Struct({ id: TodoIdFromString }))
      .addSuccess(Schema.Void)
      .addError(TodoNotFound)
  )
  .prefix("/todos")
{}
