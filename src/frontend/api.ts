import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform"
import * as Sentry from "@sentry/effect"
import { Context, Effect, Layer, ManagedRuntime, SubscriptionRef, Stream } from "effect"

const API_BASE = "http://localhost:3001"

const SentryLayer = Sentry.effectLayer({
  dsn: "https://0299849066e3bcf4626b214897b6c17f@o447951.ingest.us.sentry.io/4510555608449024",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^http:\/\/localhost/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

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
      Effect.map((data) => data as Todo[]),
      Effect.withSpan("api.listTodos")
    )

  const createTodo = (input: CreateTodoInput) =>
    HttpClientRequest.post(`${API_BASE}/todos`).pipe(
      HttpClientRequest.bodyJson(input),
      Effect.flatMap(client.execute),
      Effect.flatMap((res) => res.json),
      Effect.scoped,
      Effect.map((data) => data as Todo),
      Effect.withSpan("api.createTodo", { attributes: { "todo.title": input.title } })
    )

  const updateTodo = (id: string, input: UpdateTodoInput) =>
    HttpClientRequest.patch(`${API_BASE}/todos/${id}`).pipe(
      HttpClientRequest.bodyJson(input),
      Effect.flatMap(client.execute),
      Effect.flatMap((res) => res.json),
      Effect.scoped,
      Effect.map((data) => data as Todo),
      Effect.withSpan("api.updateTodo", { attributes: { "todo.id": id } })
    )

  const deleteTodo = (id: string) =>
    HttpClientRequest.del(`${API_BASE}/todos/${id}`).pipe(
      client.execute,
      Effect.asVoid,
      Effect.scoped,
      Effect.withSpan("api.deleteTodo", { attributes: { "todo.id": id } })
    )

  return { listTodos, createTodo, updateTodo, deleteTodo } as const
})

export class ApiClient extends Effect.Service<ApiClient>()("ApiClient", {
  effect: makeApiClient,
  dependencies: [FetchHttpClient.layer]
}) {}

export class AppConfig extends Context.Tag("AppConfig")<
  AppConfig,
  {
    readonly apiBase: string
    readonly environment: "development" | "production"
  }
>() {
  static readonly Live = Layer.succeed(this, {
    apiBase: API_BASE,
    environment: import.meta.env.DEV ? "development" : "production"
  })
}

export class Logger extends Context.Tag("Logger")<
  Logger,
  {
    readonly log: (message: string, data?: unknown) => Effect.Effect<void>
    readonly error: (message: string, error?: unknown) => Effect.Effect<void>
  }
>() {
  static readonly Live = Layer.succeed(this, {
    log: (message, data) =>
      Effect.sync(() => {
        if (import.meta.env.DEV) {
          console.log(`[App] ${message}`, data ?? "")
        }
      }),
    error: (message, error) =>
      Effect.sync(() => {
        console.error(`[App Error] ${message}`, error ?? "")
      })
  })
}

export interface AppState {
  todos: Todo[]
  newTitle: string
  loading: boolean
  error: string | null
}

const initialState: AppState = {
  todos: [],
  newTitle: "",
  loading: true,
  error: null
}

const makeAppStore = Effect.gen(function* () {
  const state = yield* SubscriptionRef.make(initialState)
  const api = yield* ApiClient
  const logger = yield* Logger

  const updateState = (fn: (s: AppState) => AppState) =>
    SubscriptionRef.update(state, fn)

  const fetchTodos = Effect.gen(function* () {
    yield* updateState((s) => ({ ...s, loading: true, error: null }))
    yield* logger.log("Fetching todos")
    const todos = yield* api.listTodos()
    yield* logger.log("Fetched todos", { count: todos.length })
    yield* updateState((s) => ({ ...s, todos, loading: false }))
  }).pipe(
    Effect.catchAll((e) =>
      updateState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to fetch todos"
      }))
    )
  )

  const createTodo = (title: string) =>
    Effect.gen(function* () {
      if (!title.trim()) return
      yield* logger.log("Creating todo", { title })
      yield* api.createTodo({ title: title.trim() })
      yield* updateState((s) => ({ ...s, newTitle: "" }))
      yield* fetchTodos
    }).pipe(
      Effect.catchAll((e) =>
        updateState((s) => ({
          ...s,
          error: e instanceof Error ? e.message : "Failed to create todo"
        }))
      )
    )

  const toggleTodo = (todo: Todo) =>
    Effect.gen(function* () {
      yield* logger.log("Toggling todo", { id: todo.id, completed: !todo.completed })
      yield* api.updateTodo(todo.id, { completed: !todo.completed })
      yield* fetchTodos
    }).pipe(
      Effect.catchAll((e) =>
        updateState((s) => ({
          ...s,
          error: e instanceof Error ? e.message : "Failed to update todo"
        }))
      )
    )

  const deleteTodo = (id: string) =>
    Effect.gen(function* () {
      yield* logger.log("Deleting todo", { id })
      yield* api.deleteTodo(id)
      yield* fetchTodos
    }).pipe(
      Effect.catchAll((e) =>
        updateState((s) => ({
          ...s,
          error: e instanceof Error ? e.message : "Failed to delete todo"
        }))
      )
    )

  const setNewTitle = (title: string) =>
    updateState((s) => ({ ...s, newTitle: title }))

  const changes = state.changes

  return {
    state,
    changes,
    fetchTodos,
    createTodo,
    toggleTodo,
    deleteTodo,
    setNewTitle
  } as const
})

export class AppStore extends Effect.Service<AppStore>()("AppStore", {
  effect: makeAppStore,
  dependencies: [ApiClient.Default, Logger.Live]
}) {}

export const AppLayer = Layer.mergeAll(
  AppConfig.Live,
  Logger.Live,
  ApiClient.Default,
  AppStore.Default
).pipe(Layer.provide(SentryLayer))

export type AppLayerContext = Layer.Layer.Success<typeof AppLayer>

export const appRuntime = ManagedRuntime.make(AppLayer)

export const runAppEffect = <A, E>(effect: Effect.Effect<A, E, AppLayerContext>) =>
  appRuntime.runPromise(effect)

export const runAppEffectFork = <A, E>(effect: Effect.Effect<A, E, AppLayerContext>) =>
  appRuntime.runFork(effect)

export { Stream }
