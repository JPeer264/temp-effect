import * as Sentry from "@sentry/node";
import { Resource, Tracer as OtelTracer } from "@effect/opentelemetry";
import { Context, Effect, Layer, Logger, LogLevel } from "effect";
export interface SentryService {
  readonly client: Sentry.NodeClient | undefined;
}

export const SentryService =
  Context.GenericTag<SentryService>("@app/SentryService");

// -----------------------------------------------------------------------------
// Sentry Logger
// -----------------------------------------------------------------------------

const SentryLogger = Logger.make(({ logLevel, message }) => {
  const msg = typeof message === "string" ? message : JSON.stringify(message);

  if (LogLevel.greaterThanEqual(logLevel, LogLevel.Error)) {
    Sentry.logger.error(msg);
  } else if (LogLevel.greaterThanEqual(logLevel, LogLevel.Warning)) {
    Sentry.logger.warn(msg);
  } else if (LogLevel.greaterThanEqual(logLevel, LogLevel.Info)) {
    Sentry.logger.info(msg);
  } else if (LogLevel.greaterThanEqual(logLevel, LogLevel.Debug)) {
    Sentry.logger.debug(msg);
  } else {
    Sentry.logger.trace(msg);
  }
});

// -----------------------------------------------------------------------------
// Layers
// -----------------------------------------------------------------------------

const ResourceLayer = (
  client: Sentry.NodeClient,
): Layer.Layer<Resource.Resource> => {
  const resourceConfig: { serviceName: string; serviceVersion?: string } = {
    serviceName: client.getOptions().serverName ?? "effect-app",
  };
  return Resource.layer(resourceConfig);
};

export function SentryLive(
  client?: Sentry.NodeClient,
): Layer.Layer<SentryService> {
  if (!client) {
    return Layer.succeed(SentryService, { client: undefined });
  }

  const { enableLogs = false } = client.getOptions() ?? {};

  // Then create the Effect tracer layer that uses the global provider Sentry set up
  const Res = ResourceLayer(client);
  const EffectTracer = OtelTracer.layerGlobal.pipe(
    Layer.provide(Res),
    Layer.discard,
  );

  // Provide SentryService to the context
  const SentryServiceLayer = Layer.succeed(SentryService, { client });

  // Base layers
  let layer = Layer.effectDiscard(Effect.sync(() => client)).pipe(
    Layer.provideMerge(EffectTracer),
    Layer.provideMerge(SentryServiceLayer),
  );

  // Conditionally add logger layer
  if (enableLogs) {
    const EffectLogger = Logger.replace(Logger.defaultLogger, SentryLogger);
    layer = layer.pipe(Layer.provideMerge(EffectLogger));
  }

  return layer;
}
