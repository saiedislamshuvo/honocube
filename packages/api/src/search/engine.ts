import { ResourceSearchConfig, ResourceVirtualTableConfig, ResourceTsvectorConfig } from "../types.js";
import { DatabaseAdapter } from "../adapters/base.js";

/**
 * Sanitizes a raw user search string into a valid SQLite / D1 FTS5 query.
 *
 * - Trims whitespace and extracts double-quoted phrases (e.g., "web framework").
 * - Escapes inner quotes inside phrases.
 * - Strips characters that cause FTS5 syntax errors: punctuation, unmatched parentheses, colons, leading asterisks.
 * - Quotes bare operators ("AND", "OR", "NOT", "NEAR") so they are treated as literal terms rather than invalid operators.
 * - Adds a suffix asterisk `*` for prefix matching on individual terms.
 */
export function sanitizeFts5Query(query: string): string {
  if (!query || typeof query !== "string") return "";
  const trimmed = query.trim();
  if (!trimmed) return "";

  const tokens: string[] = [];
  const regex = /"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(trimmed)) !== null) {
    if (match[1] !== undefined) {
      // Quoted phrase: preserve literal search phrase
      const phrase = match[1].replace(/"/g, '""').trim();
      if (phrase) {
        tokens.push(`"${phrase}"`);
      }
    } else if (match[2] !== undefined) {
      // Unquoted term: clean up punctuation and handle operators / prefixes
      let term = match[2];
      const hasTrailingAsterisk = term.endsWith("*");
      term = term.replace(/[^\p{L}\p{N}_-]/gu, "");
      if (!term) continue;

      const upper = term.toUpperCase();
      if (upper === "AND" || upper === "OR" || upper === "NOT" || upper === "NEAR") {
        tokens.push(`"${term}"`);
      } else {
        tokens.push(hasTrailingAsterisk ? `${term}*` : `${term}*`);
      }
    }
  }

  return tokens.join(" ");
}

/**
 * Resolves the effective full-text search strategy based on configuration and database dialect.
 */
export function resolveSearchStrategy(
  config?: ResourceSearchConfig,
  dialect: "postgresql" | "mysql" | "sqlite" = "sqlite"
): "fts5" | "tsvector" | "fulltext" | "like" {
  if (!config) return "like";

  const requested = config.strategy ?? "auto";
  if (requested !== "auto") {
    return requested;
  }

  // Auto-detect based on dialect and available configuration
  if (dialect === "sqlite" && config.virtualTable?.tableName) {
    return "fts5";
  }
  if (dialect === "postgresql" && (config.tsvector || config.strategy === "tsvector")) {
    return "tsvector";
  }
  if (dialect === "mysql" && config.strategy === "fulltext") {
    return "fulltext";
  }

  return "like";
}

/**
 * Builds the BM25 order expression for SQLite / Cloudflare D1 FTS5 virtual tables.
 *
 * In SQLite FTS5, bm25() returns lower (more negative) values for better relevance,
 * so ascending order (`asc`) sorts the highest relevance matches to the top.
 */
export function buildFts5OrderExpression(
  tableName: string,
  weights: Record<string, number> | undefined,
  fields: string[],
  sanitizedQ: string,
  colId: any,
  sqlTag: any
): any {
  if (!sanitizedQ) return undefined;

  const weightsList = fields.length > 0 && weights
    ? fields.map(f => (weights[f] != null ? weights[f] : 1.0))
    : [];

  const bm25Sql = weightsList.length > 0
    ? sqlTag`bm25(${sqlTag.raw(tableName)}, ${sqlTag.raw(weightsList.join(", "))})`
    : sqlTag`bm25(${sqlTag.raw(tableName)})`;

  return sqlTag`(SELECT ${bm25Sql} FROM ${sqlTag.raw(tableName)} WHERE ${sqlTag.raw(tableName)} MATCH ${sanitizedQ} AND rowid = ${colId})`;
}

/**
 * Builds an FTS5 subquery resolving rowids of matching records:
 * `SELECT rowid FROM <tableName> WHERE <tableName> MATCH <sanitizedQ>`
 */
export function buildFts5Subquery(
  tableName: string,
  sanitizedQ: string,
  weights: Record<string, number> | undefined,
  fields: string[],
  sqlTag: any
): any {
  const weightsList = fields.length > 0 && weights
    ? fields.map(f => (weights[f] != null ? weights[f] : 1.0))
    : [];

  const bm25Sql = weightsList.length > 0
    ? sqlTag`bm25(${sqlTag.raw(tableName)}, ${sqlTag.raw(weightsList.join(", "))})`
    : sqlTag`bm25(${sqlTag.raw(tableName)})`;

  return sqlTag`SELECT rowid FROM ${sqlTag.raw(tableName)} WHERE ${sqlTag.raw(tableName)} MATCH ${sanitizedQ} ORDER BY ${bm25Sql}`;
}

/**
 * Builds a PostgreSQL tsvector condition or subquery.
 */
export function buildTsvectorCondition(
  tsvectorConfig: ResourceTsvectorConfig | undefined,
  fields: string[],
  q: string,
  cols: Record<string, any>,
  sqlTag: any
): any {
  const lang = tsvectorConfig?.language || "english";

  if (tsvectorConfig?.column && cols[tsvectorConfig.column]) {
    return sqlTag`${cols[tsvectorConfig.column]} @@ websearch_to_tsquery(${lang}, ${q})`;
  }

  // Dynamic tsvector expression from fields
  const concatCols = sqlTag.join(
    fields.map(f => sqlTag`coalesce(${cols[f]}, '')`),
    sqlTag` || ' ' || `
  );
  return sqlTag`to_tsvector(${lang}, ${concatCols}) @@ websearch_to_tsquery(${lang}, ${q})`;
}

/**
 * Synchronizes a record into an FTS5 virtual table when `sync: "hooks"` is enabled.
 */
export async function syncVirtualTableRecord(
  action: "create" | "update" | "delete",
  record: any,
  virtualTableConfig: ResourceVirtualTableConfig | undefined,
  fields: string[],
  tx: DatabaseAdapter<any, any, any>
): Promise<void> {
  if (!virtualTableConfig || virtualTableConfig.sync !== "hooks") {
    return;
  }
  const tableName = virtualTableConfig.tableName;
  if (!tableName || fields.length === 0) return;

  const id = record?.id;
  if (id == null) return;

  const sqlTag = tx.getSql();
  const executeQuery = async (query: any) => {
    if (typeof tx.execute === "function") {
      return await tx.execute(query);
    }
    const db = tx.getDb();
    if (typeof db.run === "function") {
      return await db.run(query);
    }
    if (typeof db.execute === "function") {
      return await db.execute(query);
    }
    throw new Error("Underlying database does not support run or execute");
  };

  try {
    if (action === "create") {
      const colSql = sqlTag.join(fields.map(f => sqlTag.raw(`"${f}"`)), sqlTag`, `);
      const valSql = sqlTag.join(fields.map(f => sqlTag`${record[f] ?? ""}`), sqlTag`, `);
      await executeQuery(sqlTag`INSERT INTO ${sqlTag.raw(tableName)} (rowid, ${colSql}) VALUES (${id}, ${valSql})`);
    } else if (action === "update") {
      try {
        await executeQuery(sqlTag`DELETE FROM ${sqlTag.raw(tableName)} WHERE rowid = ${id}`);
      } catch {
        try {
          const colSql = sqlTag.join(fields.map(f => sqlTag.raw(`"${f}"`)), sqlTag`, `);
          const valSql = sqlTag.join(fields.map(f => sqlTag`${record[f] ?? ""}`), sqlTag`, `);
          await executeQuery(sqlTag`INSERT INTO ${sqlTag.raw(tableName)} (${sqlTag.raw(tableName)}, rowid, ${colSql}) VALUES ('delete', ${id}, ${valSql})`);
        } catch {
          // ignore
        }
      }

      const colSql = sqlTag.join(fields.map(f => sqlTag.raw(`"${f}"`)), sqlTag`, `);
      const valSql = sqlTag.join(fields.map(f => sqlTag`${record[f] ?? ""}`), sqlTag`, `);
      await executeQuery(sqlTag`INSERT INTO ${sqlTag.raw(tableName)} (rowid, ${colSql}) VALUES (${id}, ${valSql})`);
    } else if (action === "delete") {
      try {
        await executeQuery(sqlTag`DELETE FROM ${sqlTag.raw(tableName)} WHERE rowid = ${id}`);
      } catch {
        try {
          const colSql = sqlTag.join(fields.map(f => sqlTag.raw(`"${f}"`)), sqlTag`, `);
          const valSql = sqlTag.join(fields.map(f => sqlTag`${record[f] ?? ""}`), sqlTag`, `);
          await executeQuery(sqlTag`INSERT INTO ${sqlTag.raw(tableName)} (${sqlTag.raw(tableName)}, rowid, ${colSql}) VALUES ('delete', ${id}, ${valSql})`);
        } catch {
          // ignore
        }
      }
    }
  } catch (err: any) {
    console.warn(`[HonoCube Search] Virtual table sync failed: ${err.message}`);
  }
}
