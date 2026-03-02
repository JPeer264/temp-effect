import * as Sentry from "@sentry/node"
import {
  SentryPropagator,
  SentrySampler,
  SentrySpanProcessor,
  setOpenTelemetryContextAsyncContextStrategy,
  setupEventContextTrace,
  wrapContextManagerClass,
} from "@sentry/opentelemetry"
import { Resource, Tracer as OtelTracer } from "@effect/opentelemetry"
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"
import { context, propagation, trace } from "@opentelemetry/api"
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base"
import { Context, Effect, Layer } from "effect"
import type { NodeClient } from "@sentry/node"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

export interface SentryConfig {
  readonly dsn: string
  readonly environment?: string
  readonly release?: string
  readonly tracesSampleRate?: number
  readonly debug?: boolean
  readonly serviceName?: string
}

// -----------------------------------------------------------------------------
// SentryService - Effect Service for Sentry operations
// -----------------------------------------------------------------------------

export interface SentryService {
  readonly captureException: (error: unknown, hint?: Sentry.EventHint) => Effect.Effect<string>
  readonly captureMessage: (message: string, level?: Sentry.SeverityLevel) => Effect.Effect<string>
  readonly setUser: (user: Sentry.User | null) => Effect.Effect<void>
  readonly setTag: (key: string, value: string) => Effect.Effect<void>
  readonly setTags: (tags: Record<string, string>) => Effect.Effect<void>
  readonly setExtra: (key: string, value: unknown) => Effect.Effect<void>
  readonly setExtras: (extras: Record<string, unknown>) => Effect.Effect<void>
  readonly setContext: (name: string, context: Record<string, unknown> | null) => Effect.Effect<void>
  readonly addBreadcrumb: (breadcrumb: Sentry.Breadcrumb) => Effect.Effect<void>
  readonly withScope: <A, E, R>(fn: (scope: Sentry.Scope) => Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

export const SentryService = Context.GenericTag<SentryService>("@app/SentryService")

// -----------------------------------------------------------------------------
// Scope utilities
// -----------------------------------------------------------------------------

export const getCurrentScope: Effect.Effect<Sentry.Scope> = Effect.sync(() => Sentry.getCurrentScope())

export const getIsolationScope: Effect.Effect<Sentry.Scope> = Effect.sync(() => Sentry.getIsolationScope())

// -----------------------------------------------------------------------------
// Implementation
// -----------------------------------------------------------------------------

const makeSentryService = (): SentryService => ({
  captureException: (error, hint) =>
    Effect.sync(() => Sentry.captureException(error, hint)),

  captureMessage: (message, level) =>
    Effect.sync(() => Sentry.captureMessage(message, level)),

  setUser: (user) =>
    Effect.sync(() => Sentry.setUser(user)),

  setTag: (key, value) =>
    Effect.sync(() => Sentry.setTag(key, value)),

  setTags: (tags) =>
    Effect.sync(() => Sentry.setTags(tags)),

  setExtra: (key, value) =>
    Effect.sync(() => Sentry.setExtra(key, value)),

  setExtras: (extras) =>
    Effect.sync(() => Sentry.setExtras(extras)),

  setContext: (name, ctx) =>
    Effect.sync(() => Sentry.setContext(name, ctx)),

  addBreadcrumb: (breadcrumb) =>
    Effect.sync(() => Sentry.addBreadcrumb(breadcrumb)),

  withScope: <A, E, R>(fn: (scope: Sentry.Scope) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.suspend(() => {
      let result: Effect.Effect<A, E, R> | undefined
      Sentry.withScope((scope) => {
        result = fn(scope)
      })
      return result!
    }),
})

// -----------------------------------------------------------------------------
// OpenTelemetry + Sentry initialization
// -----------------------------------------------------------------------------

const SentryContextManager = wrapContextManagerClass(AsyncLocalStorageContextManager)

const initSentryAndOtel = (config: SentryConfig): NodeClient => {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate ?? 1.0,
    debug: config.debug ?? false,
    skipOpenTelemetrySetup: true,
  })

  const client = Sentry.getClient<NodeClient>()
  if (!client) {
    throw new Error("Sentry client not initialized")
  }

  setupEventContextTrace(client)

  const provider = new BasicTracerProvider({
    sampler: new SentrySampler(client),
    spanProcessors: [new SentrySpanProcessor()],
  })

  trace.setGlobalTracerProvider(provider)
  propagation.setGlobalPropagator(new SentryPropagator())
  context.setGlobalContextManager(new SentryContextManager())

  setOpenTelemetryContextAsyncContextStrategy()

  return client
}

// -----------------------------------------------------------------------------
// Layers
// -----------------------------------------------------------------------------

const SentryInitLayer = (config: SentryConfig): Layer.Layer<never> =>
  Layer.effectDiscard(Effect.sync(() => initSentryAndOtel(config)))

const ResourceLayer = (config: SentryConfig): Layer.Layer<Resource.Resource> => {
  const resourceConfig: { serviceName: string; serviceVersion?: string } = {
    serviceName: config.serviceName ?? "effect-app",
  }
  if (config.release) {
    resourceConfig.serviceVersion = config.release
  }
  return Resource.layer(resourceConfig)
}

const SentryServiceLayer: Layer.Layer<SentryService> = Layer.succeed(
  SentryService,
  makeSentryService()
)

export const SentryLive = (config: SentryConfig): Layer.Layer<SentryService> => {
  const Init = SentryInitLayer(config)
  const Res = ResourceLayer(config)
  const EffectTracer = OtelTracer.layerGlobal.pipe(
    Layer.provide(Res),
    Layer.discard
  )

  return Layer.merge(Layer.merge(Init, EffectTracer), SentryServiceLayer)
}

// -----------------------------------------------------------------------------
// Convenience functions that use the SentryService from context
// -----------------------------------------------------------------------------

export const captureException = (error: unknown, hint?: Sentry.EventHint): Effect.Effect<string, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.captureException(error, hint))

export const captureMessage = (message: string, level?: Sentry.SeverityLevel): Effect.Effect<string, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.captureMessage(message, level))

export const setUser = (user: Sentry.User | null): Effect.Effect<void, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.setUser(user))

export const setTag = (key: string, value: string): Effect.Effect<void, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.setTag(key, value))

export const setTags = (tags: Record<string, string>): Effect.Effect<void, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.setTags(tags))

export const setExtra = (key: string, value: unknown): Effect.Effect<void, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.setExtra(key, value))

export const setExtras = (extras: Record<string, unknown>): Effect.Effect<void, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.setExtras(extras))

export const setContext = (name: string, ctx: Record<string, unknown> | null): Effect.Effect<void, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.setContext(name, ctx))

export const addBreadcrumb = (breadcrumb: Sentry.Breadcrumb): Effect.Effect<void, never, SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.addBreadcrumb(breadcrumb))

export const withScope = <A, E, R>(
  fn: (scope: Sentry.Scope) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | SentryService> =>
  Effect.flatMap(SentryService, (sentry) => sentry.withScope(fn))

// -----------------------------------------------------------------------------
// Error handling utilities
// -----------------------------------------------------------------------------

export const tapErrorAndCapture = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | SentryService> =>
  effect.pipe(
    Effect.tapError((error) =>
      Effect.flatMap(SentryService, (sentry) => sentry.captureException(error))
    )
  )

export const withSentryErrorBoundary = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | SentryService> =>
  Effect.flatMap(SentryService, (sentry) =>
    sentry.withScope(() => tapErrorAndCapture(effect))
  )

// -----------------------------------------------------------------------------
// Request context utilities (useful for HTTP handlers)
// -----------------------------------------------------------------------------

export interface RequestContext {
  readonly method: string
  readonly url: string
  readonly headers?: Record<string, string>
  readonly query?: Record<string, string>
  readonly ip?: string
  readonly userId?: string
}

export const withRequestContext = <A, E, R>(
  requestContext: RequestContext,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | SentryService> =>
  Effect.flatMap(SentryService, (sentry) =>
    sentry.withScope((scope) => {
      const normalizedRequest: Record<string, unknown> = {
        method: requestContext.method,
        url: requestContext.url,
      }
      if (requestContext.headers) {
        normalizedRequest.headers = requestContext.headers
      }
      if (requestContext.query) {
        normalizedRequest.query_string = requestContext.query
      }

      scope.setSDKProcessingMetadata({ normalizedRequest })

      if (requestContext.ip) {
        scope.setUser({ ip_address: requestContext.ip })
      }
      if (requestContext.userId) {
        scope.setUser({ id: requestContext.userId })
      }

      scope.setTag("http.method", requestContext.method)
      scope.setTag("http.url", requestContext.url)

      return effect
    })
  )

// -----------------------------------------------------------------------------
// Custom Integration
// -----------------------------------------------------------------------------

export interface EffectIntegrationOptions {
  /**
   * Whether to capture Effect fiber information in events.
   * @default true
   */
  readonly captureFiberInfo?: boolean
  /**
   * Whether to add Effect-specific breadcrumbs.
   * @default true
   */
  readonly addBreadcrumbs?: boolean
  /**
   * Custom tags to add to all events processed by this integration.
   */
  readonly tags?: Record<string, string>
}

const INTEGRATION_NAME = "EffectIntegration"

/**
 * Sentry integration for Effect applications.
 *
 * This integration enhances Sentry events with Effect-specific context,
 * including fiber information and Effect-related tags.
 *
 * @example
 * ```ts
 * import * as Sentry from "@sentry/node"
 * import { effectIntegration } from "./Sentry"
 *
 * Sentry.init({
 *   dsn: "your-dsn",
 *   integrations: [
 *     effectIntegration({
 *       captureFiberInfo: true,
 *       addBreadcrumbs: true,
 *       tags: { framework: "effect" }
 *     })
 *   ]
 * })
 * ```
 */
export const effectIntegration = (
  options: EffectIntegrationOptions = {}
): Sentry.Integration => {
  const { captureFiberInfo = true, addBreadcrumbs = true, tags = {} } = options

  return {
    name: INTEGRATION_NAME,

    setupOnce() {
      // Global setup that runs only once, regardless of how many clients are created
      // Use for global monkey-patching or similar operations
    },

    setup(client: Sentry.Client) {
      // Setup for each client instance
      // Add Effect-specific event listeners or hooks here
      if (addBreadcrumbs) {
        client.on("beforeSendEvent", () => {
          Sentry.addBreadcrumb({
            category: "effect",
            message: "Effect integration active",
            level: "info",
          })
        })
      }
    },

    afterAllSetup(_client: Sentry.Client) {
      // Called after all integrations have been set up
      // Useful for operations that depend on other integrations being initialized
    },

    preprocessEvent(event: Sentry.Event, _hint: Sentry.EventHint | undefined, _client: Sentry.Client) {
      // Preprocess events before they go through other event processors
      // Add Effect-specific tags
      if (!event.tags) {
        event.tags = {}
      }
      event.tags["effect.enabled"] = "true"

      // Add custom tags from options
      for (const [key, value] of Object.entries(tags)) {
        event.tags[key] = value
      }

      // Add fiber information if enabled
      if (captureFiberInfo) {
        if (!event.contexts) {
          event.contexts = {}
        }
        event.contexts["effect"] = {
          runtime: "effect",
          version: "3.x",
        }
      }
    },

    processEvent(event: Sentry.Event, _hint: Sentry.EventHint, _client: Sentry.Client) {
      // Process events - can modify, drop (return null), or pass through
      // Return the event to send it, null to drop it, or a Promise

      // Example: Add additional context to exceptions from Effect
      if (event.exception?.values) {
        for (const exception of event.exception.values) {
          if (exception.type?.includes("Effect") || exception.type?.includes("Fiber")) {
            if (!event.tags) {
              event.tags = {}
            }
            event.tags["effect.exception"] = "true"
          }
        }
      }

      return event
    },
  }
}

export { Sentry }
