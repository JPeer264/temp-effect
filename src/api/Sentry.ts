import * as Sentry from "@sentry/node";
import { Resource, Tracer as OtelTracer } from "@effect/opentelemetry";
import { Context, Effect, Layer, Logger, LogLevel } from "effect";
export interface SentryService {
  readonly client: Sentry.NodeClient | undefined;
}

export const SentryService =
  Context.GenericTag<SentryService>("@app/SentryService");

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
  const currentClient = Sentry.getClient() as Sentry.NodeClient | undefined || client;

  if (!currentClient) {
    return Layer.succeed(SentryService, { client: undefined });
  }

  const { enableLogs = false } = currentClient.getOptions() ?? {};

  const Res = ResourceLayer(currentClient);
  const EffectTracer = OtelTracer.layerGlobal.pipe(
    Layer.provide(Res),
    Layer.discard,
  );

  const SentryServiceLayer = Layer.succeed(SentryService, { client: currentClient });

  let layer = Layer.effectDiscard(Effect.sync(() => currentClient)).pipe(
    Layer.provideMerge(EffectTracer),
    Layer.provideMerge(SentryServiceLayer),
  );

  if (enableLogs) {
    const EffectLogger = Logger.replace(Logger.defaultLogger, SentryLogger);
    layer = layer.pipe(Layer.provideMerge(EffectLogger));
  }

  return layer;
}

export const withSentry = Layer.provideMerge(SentryLive());