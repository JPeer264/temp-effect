import { HttpApi } from "@effect/platform"
import { TodosApi } from "./Todos/Api.js"

export class Api extends HttpApi.make("api")
  .add(TodosApi)
{}
