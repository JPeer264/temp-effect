import * as Sentry from "@sentry/effect";
import {
  Effect,
  Layer,
  Metric,
  MetricKeyType,
  MetricPair,
  MetricState,
  Schedule,
} from "effect";

type MetricAttributes = Record<string, string>;

function labelsToAttributes(
  labels: ReadonlyArray<{ key: string; value: string }>,
): MetricAttributes {
  return labels.reduce((acc, label) => ({ ...acc, [label.key]: label.value }), {});
}

function sendMetricToSentry(pair: MetricPair.MetricPair.Untyped): void {
  const { metricKey, metricState } = pair;
  const name = metricKey.name;
  const attributes = labelsToAttributes(metricKey.tags);

  if (MetricState.isCounterState(metricState)) {
    const value =
      typeof metricState.count === "bigint"
        ? Number(metricState.count)
        : metricState.count;
    Sentry.metrics.count(name, value, { attributes });
  } else if (MetricState.isGaugeState(metricState)) {
    const value =
      typeof metricState.value === "bigint"
        ? Number(metricState.value)
        : metricState.value;
    Sentry.metrics.gauge(name, value, { attributes });
  } else if (MetricState.isHistogramState(metricState)) {
    Sentry.metrics.distribution(`${name}.sum`, metricState.sum, { attributes });
    Sentry.metrics.gauge(`${name}.count`, metricState.count, { attributes });
    Sentry.metrics.gauge(`${name}.min`, metricState.min, { attributes });
    Sentry.metrics.gauge(`${name}.max`, metricState.max, { attributes });
  } else if (MetricState.isSummaryState(metricState)) {
    Sentry.metrics.distribution(`${name}.sum`, metricState.sum, { attributes });
    Sentry.metrics.gauge(`${name}.count`, metricState.count, { attributes });
    Sentry.metrics.gauge(`${name}.min`, metricState.min, { attributes });
    Sentry.metrics.gauge(`${name}.max`, metricState.max, { attributes });
  } else if (MetricState.isFrequencyState(metricState)) {
    for (const [word, count] of metricState.occurrences) {
      Sentry.metrics.count(name, count, {
        attributes: { ...attributes, word },
      });
    }
  }
}

const previousCounterValues = new Map<string, number>();

function getMetricId(pair: MetricPair.MetricPair.Untyped): string {
  const tags = pair.metricKey.tags.map((t) => `${t.key}=${t.value}`).join(",");
  return `${pair.metricKey.name}:${tags}`;
}

function sendDeltaMetricToSentry(pair: MetricPair.MetricPair.Untyped): void {
  const { metricKey, metricState } = pair;
  const name = metricKey.name;
  const attributes = labelsToAttributes(metricKey.tags);
  const metricId = getMetricId(pair);

  if (MetricState.isCounterState(metricState)) {
    const currentValue =
      typeof metricState.count === "bigint"
        ? Number(metricState.count)
        : metricState.count;

    const previousValue = previousCounterValues.get(metricId) ?? 0;
    const delta = currentValue - previousValue;

    if (delta > 0) {
      Sentry.metrics.count(name, delta, { attributes });
    }

    previousCounterValues.set(metricId, currentValue);
  } else {
    sendMetricToSentry(pair);
  }
}

function flushMetricsToSentry(): void {
  const snapshot = Metric.unsafeSnapshot();

  snapshot.forEach((pair) => {
    if (MetricKeyType.isCounterKey(pair.metricKey.keyType)) {
      sendDeltaMetricToSentry(pair);
    } else {
      sendMetricToSentry(pair);
    }
  });
}

const metricsReporterEffect = Effect.gen(function* () {
  const schedule = Schedule.spaced("10 seconds");

  yield* Effect.repeat(
    Effect.sync(() => flushMetricsToSentry()),
    schedule,
  );
}).pipe(Effect.interruptible);

export const SentryMetricsLayer = Layer.scopedDiscard(
  Effect.forkScoped(metricsReporterEffect),
);
