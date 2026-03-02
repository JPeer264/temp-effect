import * as Sentry from "@sentry/node";
import type { ServerRuntimeClient } from "@sentry/core";
import { Context, Layer, Logger } from "effect";
import { SentryLogger } from "./sentry/logger.js";
import { SentryMetricsLayer } from "./sentry/metrics.js";
import { SentryTracerLayer } from "./sentry/spans.js";

export interface SentryService {
  readonly client: ServerRuntimeClient | undefined;
}

export const SentryService =
  Context.GenericTag<SentryService>("@app/SentryService");

function SentryLive(): Layer.Layer<SentryService> {
  const currentClient = Sentry.getClient() as ServerRuntimeClient;

  if (!currentClient) {
    return Layer.succeed(SentryService, { client: undefined });
  }

  const { enableLogs = false, enableMetrics = false } =
    currentClient.getOptions() ?? {};

  const SentryServiceLayer = Layer.succeed(SentryService, {
    client: currentClient,
  });

  let layer = SentryTracerLayer.pipe(Layer.provideMerge(SentryServiceLayer));

  if (enableLogs) {
    const EffectLogger = Logger.replace(Logger.defaultLogger, SentryLogger);
    layer = layer.pipe(Layer.provideMerge(EffectLogger));
  }

  if (enableMetrics) {
    layer = layer.pipe(Layer.provideMerge(SentryMetricsLayer));
  }

  return layer;
}

export const withSentry = Layer.provideMerge(SentryLive());
