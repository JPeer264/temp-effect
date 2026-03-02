import * as Sentry from "@sentry/node";
import { Resource, Tracer as OtelTracer } from "@effect/opentelemetry";
import { Context, Effect, Layer } from "effect";
export interface SentryService {
  readonly client: Sentry.NodeClient | undefined;
}

export const SentryService =
  Context.GenericTag<SentryService>("@app/SentryService");

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

  // // First initialize Sentry (which sets up the global OTel tracer provider)
  // const Init = Layer.effectDiscard(Effect.sync(() => client))

  // Then create the Effect tracer layer that uses the global provider Sentry set up
  const Res = ResourceLayer(client);
  const EffectTracer = OtelTracer.layerGlobal.pipe(
    Layer.provide(Res),
    Layer.discard,
  );

  // Provide SentryService to the context
  const SentryServiceLayer = Layer.succeed(SentryService, { client });

  // Ensure Sentry is initialized before Effect tries to use the global tracer
  return Layer.effectDiscard(Effect.sync(() => client)).pipe(
    Layer.provideMerge(EffectTracer),
    Layer.provideMerge(SentryServiceLayer),
  );
}
