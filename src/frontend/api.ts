import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform"
import { Effect, Layer } from "effect"

const API_BASE = "http://localhost:3001"

export interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

export interface CreateTodoInput {
  title: string
}

export interface UpdateTodoInput {
  title?: string
  completed?: boolean
}

const makeApiClient = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient

  const listTodos = () =>
    HttpClientRequest.get(`${API_BASE}/todos`).pipe(
      client.execute,
      Effect.flatMap((res) => res.json),
      Effect.scoped,
      Effect.map((data) => data as Todo[])
    )

  const createTodo = (input: CreateTodoInput) =>
    HttpClientRequest.post(`${API_BASE}/todos`).pipe(
      HttpClientRequest.bodyJson(input),
      Effect.flatMap(client.execute),
      Effect.flatMap((res) => res.json),
      Effect.scoped,
      Effect.map((data) => data as Todo)
    )

  const updateTodo = (id: string, input: UpdateTodoInput) =>
    HttpClientRequest.patch(`${API_BASE}/todos/${id}`).pipe(
      HttpClientRequest.bodyJson(input),
      Effect.flatMap(client.execute),
      Effect.flatMap((res) => res.json),
      Effect.scoped,
      Effect.map((data) => data as Todo)
    )

  const deleteTodo = (id: string) =>
    HttpClientRequest.del(`${API_BASE}/todos/${id}`).pipe(
      client.execute,
      Effect.asVoid,
      Effect.scoped
    )

  return { listTodos, createTodo, updateTodo, deleteTodo } as const
})

export class ApiClient extends Effect.Service<ApiClient>()("ApiClient", {
  effect: makeApiClient,
  dependencies: [FetchHttpClient.layer]
}) {}

export const ApiClientLive = Layer.provide(ApiClient.Default, FetchHttpClient.layer)

export const runApiEffect = <A, E>(effect: Effect.Effect<A, E, ApiClient>) =>
  Effect.runPromise(Effect.provide(effect, ApiClientLive))
