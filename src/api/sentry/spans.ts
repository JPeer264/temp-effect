import * as Sentry from "@sentry/node";
import {
  Context,
  Exit,
  Layer,
  Option,
  Tracer as EffectTracer,
} from "effect";

const kindMap: Record<
  EffectTracer.SpanKind,
  "internal" | "server" | "client" | "producer" | "consumer"
> = {
  internal: "internal",
  client: "client",
  server: "server",
  producer: "producer",
  consumer: "consumer",
};

type HrTime = [number, number];

function nanosToHrTime(nanos: bigint): HrTime {
  const seconds = Number(nanos / BigInt(1_000_000_000));
  const remainingNanos = Number(nanos % BigInt(1_000_000_000));
  return [seconds, remainingNanos];
}

const SentrySpanSymbol = Symbol.for("@app/SentrySpan");

interface SentrySpanLike extends EffectTracer.Span {
  readonly [SentrySpanSymbol]: true;
  readonly sentrySpan: Sentry.Span;
}

function isSentrySpan(span: EffectTracer.AnySpan): span is SentrySpanLike {
  return SentrySpanSymbol in span;
}

function isHttpServerSpan(span: Sentry.Span): boolean {
  const op = Sentry.spanToJSON(span).op;
  return op === "http.server";
}

class SentrySpanWrapper implements SentrySpanLike {
  readonly [SentrySpanSymbol] = true as const;
  readonly _tag = "Span";
  readonly spanId: string;
  readonly traceId: string;
  readonly attributes = new Map<string, unknown>();
  readonly sampled: boolean;
  readonly parent: Option.Option<EffectTracer.AnySpan>;
  readonly links: Array<EffectTracer.SpanLink>;
  status: EffectTracer.SpanStatus;
  readonly ownsSpan: boolean;

  readonly sentrySpan: Sentry.Span;

  constructor(
    readonly name: string,
    parent: Option.Option<EffectTracer.AnySpan>,
    readonly context: Context.Context<never>,
    links: ReadonlyArray<EffectTracer.SpanLink>,
    startTime: bigint,
    readonly kind: EffectTracer.SpanKind,
    existingSpan: Sentry.Span,
    ownsSpan: boolean,
  ) {
    this.parent = parent;
    this.links = links.slice();
    this.sentrySpan = existingSpan;
    this.ownsSpan = ownsSpan;

    const spanContext = this.sentrySpan.spanContext();
    this.spanId = spanContext.spanId;
    this.traceId = spanContext.traceId;
    this.sampled = this.sentrySpan.isRecording();
    this.status = {
      _tag: "Started",
      startTime,
    };
  }

  attribute(key: string, value: unknown): void {
    this.sentrySpan.setAttribute(
      key,
      value as Parameters<Sentry.Span["setAttribute"]>[1],
    );
    this.attributes.set(key, value);
  }

  addLinks(_links: ReadonlyArray<EffectTracer.SpanLink>): void {
    this.links.push(..._links);
  }

  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    this.status = {
      _tag: "Ended",
      endTime,
      exit,
      startTime: this.status.startTime,
    };

    if (Exit.isFailure(exit)) {
      const cause = exit.cause;
      const message =
        cause._tag === "Fail"
          ? String(cause.error)
          : cause._tag === "Die"
            ? String(cause.defect)
            : "internal_error";
      this.sentrySpan.setStatus({ code: 2, message });
    } else {
      this.sentrySpan.setStatus({ code: 1 });
    }

    if (this.ownsSpan) {
      this.sentrySpan.end(nanosToHrTime(endTime));
    }
  }

  event(
    name: string,
    startTime: bigint,
    attributes?: Record<string, unknown>,
  ): void {
    this.sentrySpan.addEvent(
      name,
      attributes as Parameters<Sentry.Span["addEvent"]>[1],
      nanosToHrTime(startTime),
    );
  }
}

function createSentrySpan(
  name: string,
  parent: Option.Option<EffectTracer.AnySpan>,
  context: Context.Context<never>,
  links: ReadonlyArray<EffectTracer.SpanLink>,
  startTime: bigint,
  kind: EffectTracer.SpanKind,
): SentrySpanLike {
  const parentSentrySpan =
    Option.isSome(parent) && isSentrySpan(parent.value)
      ? parent.value.sentrySpan
      : (Sentry.getActiveSpan() ?? null);

  if (
    kind === "server" &&
    parentSentrySpan &&
    isHttpServerSpan(parentSentrySpan)
  ) {
    return new SentrySpanWrapper(
      name,
      parent,
      context,
      links,
      startTime,
      kind,
      parentSentrySpan,
      false,
    );
  }

  const newSpan = Sentry.startInactiveSpan({
    name,
    op: kindMap[kind],
    startTime: nanosToHrTime(startTime),
    ...(parentSentrySpan ? { parentSpan: parentSentrySpan } : {}),
  });

  return new SentrySpanWrapper(
    name,
    parent,
    context,
    links,
    startTime,
    kind,
    newSpan,
    true,
  );
}

const makeSentryTracer = (): EffectTracer.Tracer =>
  EffectTracer.make({
    span(name, parent, context, links, startTime, kind) {
      return createSentrySpan(name, parent, context, links, startTime, kind);
    },
    context(execution, fiber) {
      const currentSpan = fiber.currentSpan;
      if (currentSpan === undefined || !isSentrySpan(currentSpan)) {
        return execution();
      }
      return Sentry.withActiveSpan(currentSpan.sentrySpan, execution);
    },
  });

export const SentryTracerLayer = Layer.setTracer(makeSentryTracer());
