import { PgClient } from "@effect/sql-pg"
import { Config, Redacted } from "effect"

const PgConfig = Config.all({
  host: Config.string("PG_HOST").pipe(Config.withDefault("localhost")),
  port: Config.integer("PG_PORT").pipe(Config.withDefault(5432)),
  username: Config.string("PG_USER").pipe(Config.withDefault("postgres")),
  password: Config.redacted("PG_PASSWORD").pipe(
    Config.withDefault(Redacted.make("postgres"))
  ),
  database: Config.string("PG_DATABASE").pipe(Config.withDefault("todos")),
})

export const DatabaseLive = PgClient.layerConfig(PgConfig)
