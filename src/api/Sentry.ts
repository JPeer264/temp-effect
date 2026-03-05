import * as Sentry from "@sentry/effect";
import { Layer, Logger } from "effect";
import { SentryLogger } from "./sentry/logger.js";
import { SentryMetricsLayer } from "./sentry/metrics.js";
import { SentryTracerLayer } from "./sentry/spans.js";

function SentryLive(): Layer.Layer<never> {
  const currentClient = Sentry.getClient();

  if (!currentClient) {
    return Layer.empty;
  }

  const { enableLogs = false, enableMetrics = false } =
    currentClient.getOptions() ?? {};

  let layer: Layer.Layer<never> = SentryTracerLayer;

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
