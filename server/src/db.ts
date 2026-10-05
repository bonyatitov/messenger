import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({ connectionString: env.databaseUrl });

// Схема задаётся через DB_SCHEMA и валидируется в env.ts — безопасно интерполировать.
pool.on("connect", (client) => {
  client.query(`SET search_path TO ${env.dbSchema}`);
});

export const query = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => pool.query<T>(text, params as never[]);
