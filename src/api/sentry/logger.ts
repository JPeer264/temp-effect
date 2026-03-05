import * as Sentry from "@sentry/effect";
import { Logger, LogLevel } from "effect";

export const SentryLogger = Logger.make(({ logLevel, message }) => {
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
