import { Prisma } from "@prisma/client";
import type { SubmissionData } from "../types";

/**
 * Filter shape for calc db queries, matched against Submission.data (JSON):
 *   { estate_id: "abc" }                     — shorthand for equals
 *   { status: { equals: "active" } }         — explicit equals
 *   { score: { gte: 90 } }                   — numeric lt/lte/gt/gte
 *   { user_id: { in: ["u1", "u2"] } }        — any of these values (max 100;
 *                                              longer lists are truncated)
 *   { a: 1, b: { lt: 5 } }                   — keys are AND-ed together
 */
export type CalcDbWhere = Record<
  string,
  | string
  | number
  | boolean
  | null
  | {
      equals?: string | number | boolean | null;
      lt?: number;
      lte?: number;
      gt?: number;
      gte?: number;
      in?: (string | number | boolean | null)[];
    }
>;

/** Structured join spec for db.join — aggregates FROM-side rows matched to TO-side rows. */
export type CalcJoinSpec = {
  /** Form id of the "left" side (aggregated). */
  from: string;
  /** Form id of the "right" side (matched against). */
  to: string;
  /** [fromFieldKey, toFieldKey] join keys (text equality). */
  on: [string, string];
  /** Filters on the from side. */
  whereFrom?: CalcDbWhere;
  /** Filters on the to side. */
  whereTo?: CalcDbWhere;
  aggregate: "count" | "sum" | "avg" | "min" | "max";
  /** Field key on the FROM side; required for sum/avg/min/max. */
  field?: string;
};

/** Read-only db API handed to calc scripts in "query" mode. */
export type CalcDbApi = {
  /** Number of submissions on a form matching the filter. */
  count(formId: string, where?: CalcDbWhere): Promise<number>;
  /** Sum of a numeric field over matching submissions (scans up to 1000). */
  sum(formId: string, fieldKey: string, where?: CalcDbWhere): Promise<number>;
  /** Average of a numeric field over matching submissions. */
  avg(formId: string, fieldKey: string, where?: CalcDbWhere): Promise<number>;
  /** Smallest numeric value of a field over matching submissions. */
  min(formId: string, fieldKey: string, where?: CalcDbWhere): Promise<number>;
  /** Largest numeric value of a field over matching submissions. */
  max(formId: string, fieldKey: string, where?: CalcDbWhere): Promise<number>;
  /** Matching submission data objects, newest first, capped at 50 rows. */
  find(
    formId: string,
    where?: CalcDbWhere,
    limit?: number,
  ): Promise<SubmissionData[]>;
  /**
   * Aggregate rows of one form joined to another (computed in the database;
   * no row cap — the calc script's ~5s timeout is the runaway guard).
   */
  join(spec: CalcJoinSpec): Promise<number>;
};

/** Subset of the Prisma client the db API needs (injectable for tests). */
export type CalcDbClient = {
  form: {
    findUnique(args: {
      where: { id: string };
      select: { userId: true };
    }): Promise<{ userId: string } | null>;
  };
  submission: {
    count(args: { where: Prisma.SubmissionWhereInput }): Promise<number>;
    findMany(args: {
      where: Prisma.SubmissionWhereInput;
      select: { data: true };
      take: number;
      orderBy: { createdAt: "desc" };
    }): Promise<{ data: unknown }[]>;
  };
  /**
   * Raw SQL with positional bound parameters ($1, $2, …). Used for db.join:
   * the only literal text is the fixed query skeleton — every form id, field
   * key, and value is a bound parameter. (Prisma's $queryRaw tagged template
   * generates its own placeholders, so the pre-built string form is the one
   * that fits positional params.)
   */
  $queryRawUnsafe(sql: string, ...params: unknown[]): Promise<unknown[]>;
};

const FIND_ROW_CAP = 50;
const AGGREGATE_ROW_CAP = 1000;
const IN_LIST_CAP = 100;

const NUMERIC_OPS = ["lt", "lte", "gt", "gte"] as const;

/** Regex literal used in join SQL for guarded numeric casts (fixed text). */
const NUMERIC_JSON_SQL_RE = `'^-?[0-9]+(\\.[0-9]+)?$'`;

const FIELD_KEY_RE = /^[A-Za-z0-9_]+$/;

/** Defense in depth for join SQL: field keys are bound params, but validate anyway. */
function assertValidFieldKey(key: string): void {
  if (!FIELD_KEY_RE.test(key)) {
    throw new Error(`Calc db: invalid field key "${key}"`);
  }
}

/** JSON `equals` filters need Prisma.JsonNull for explicit nulls. */
function jsonEquals(
  value: string | number | boolean | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value;
}

function isScalar(value: unknown): value is string | number | boolean | null {
  if (value === null) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return typeof value === "string" || typeof value === "boolean";
}

/** `in` lists: scalars only, silently truncated at IN_LIST_CAP. */
function normalizeInValues(
  values: unknown[],
): (string | number | boolean | null)[] {
  return values.filter(isScalar).slice(0, IN_LIST_CAP);
}

export function buildSubmissionWhere(
  formId: string,
  where?: CalcDbWhere,
): Prisma.SubmissionWhereInput {
  const conditions: Prisma.SubmissionWhereInput[] = [];
  for (const [key, condition] of Object.entries(where ?? {})) {
    if (
      condition !== null &&
      typeof condition === "object" &&
      !Array.isArray(condition)
    ) {
      if (condition.equals !== undefined) {
        conditions.push({
          data: { path: [key], equals: jsonEquals(condition.equals) },
        });
      }
      for (const numOp of NUMERIC_OPS) {
        const value = condition[numOp];
        if (typeof value === "number" && Number.isFinite(value)) {
          conditions.push({
            data: { path: [key], [numOp]: value } as Prisma.JsonFilter,
          });
        }
      }
      if (condition.in !== undefined) {
        // Prisma JSON filters have no `in` — translate to an OR of equals.
        const values = normalizeInValues(
          Array.isArray(condition.in) ? condition.in : [],
        );
        if (values.length > 0) {
          conditions.push({
            OR: values.map((value) => ({
              data: { path: [key], equals: jsonEquals(value) },
            })),
          });
        }
      }
    } else {
      conditions.push({
        data: {
          path: [key],
          equals: jsonEquals(condition as string | number | boolean | null),
        },
      });
    }
  }
  return conditions.length > 0 ? { formId, AND: conditions } : { formId };
}

const NUMERIC_SQL_OPS: Record<(typeof NUMERIC_OPS)[number], string> = {
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
};

/** Whitelisted SQL names for join aggregates (count is special-cased). */
const JOIN_AGGREGATES: Record<
  Exclude<CalcJoinSpec["aggregate"], "count">,
  string
> = {
  sum: "SUM",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
};

/**
 * Translate a CalcDbWhere to SQL clauses over `<alias>.data` (JSON), pushing
 * bound parameters onto `params` and referencing them positionally. Semantics
 * match buildSubmissionWhere: equals is text equality on ->> (numbers stored
 * as JSON compare fine as text), numeric ops use a guarded ::numeric cast,
 * `in` is an OR group of equals.
 */
function whereToSql(
  alias: "a" | "b",
  where: CalcDbWhere | undefined,
  params: unknown[],
): string[] {
  const clauses: string[] = [];
  const nextParam = (value: unknown): string => `$${params.push(value)}`;

  const equalsClause = (
    key: string,
    value: string | number | boolean | null,
  ): string => {
    const keyParam = nextParam(key);
    if (value === null) {
      return `(${alias}.data ->> ${keyParam}) IS NULL`;
    }
    return `(${alias}.data ->> ${keyParam}) = ${nextParam(String(value))}`;
  };

  for (const [key, condition] of Object.entries(where ?? {})) {
    assertValidFieldKey(key);
    if (
      condition !== null &&
      typeof condition === "object" &&
      !Array.isArray(condition)
    ) {
      if (condition.equals !== undefined) {
        clauses.push(equalsClause(key, condition.equals));
      }
      for (const numOp of NUMERIC_OPS) {
        const value = condition[numOp];
        if (typeof value === "number" && Number.isFinite(value)) {
          const keyParam = nextParam(key);
          const cast = `CASE WHEN ${alias}.data ->> ${keyParam} ~ ${NUMERIC_JSON_SQL_RE} THEN (${alias}.data ->> ${keyParam})::numeric END`;
          clauses.push(
            `(${cast}) ${NUMERIC_SQL_OPS[numOp]} ${nextParam(value)}`,
          );
        }
      }
      if (condition.in !== undefined) {
        const values = normalizeInValues(
          Array.isArray(condition.in) ? condition.in : [],
        );
        if (values.length > 0) {
          clauses.push(
            `(${values.map((value) => equalsClause(key, value)).join(" OR ")})`,
          );
        }
      }
    } else {
      clauses.push(
        equalsClause(key, condition as string | number | boolean | null),
      );
    }
  }
  return clauses;
}

/**
 * Build the read-only db API for query-mode calc scripts. Every query is
 * scoped to forms owned by `ownerId` (the owner of the form the calc belongs
 * to); any other form id throws, which the calc runner stores as "".
 */
export function buildCalcDbApi(
  ownerId: string,
  client: CalcDbClient,
): CalcDbApi {
  async function assertOwnedForm(formId: string): Promise<void> {
    const form = await client.form.findUnique({
      where: { id: formId },
      select: { userId: true },
    });
    if (!form || form.userId !== ownerId) {
      throw new Error("Calc db: form not found, or owned by a different user");
    }
  }

  async function aggregate(
    mode: "sum" | "avg" | "min" | "max",
    formId: string,
    fieldKey: string,
    where?: CalcDbWhere,
  ): Promise<number> {
    await assertOwnedForm(formId);
    const rows = await client.submission.findMany({
      where: buildSubmissionWhere(formId, where),
      select: { data: true },
      take: AGGREGATE_ROW_CAP,
      orderBy: { createdAt: "desc" },
    });
    const numbers = rows
      .map((row) =>
        Number(
          (row.data && typeof row.data === "object"
            ? (row.data as SubmissionData)
            : {})[fieldKey],
        ),
      )
      .filter((num) => Number.isFinite(num));
    if (numbers.length === 0) {
      return 0;
    }
    switch (mode) {
      case "sum":
        return numbers.reduce((acc, num) => acc + num, 0);
      case "avg":
        return numbers.reduce((acc, num) => acc + num, 0) / numbers.length;
      case "min":
        return Math.min(...numbers);
      case "max":
        return Math.max(...numbers);
    }
  }

  return {
    async count(formId, where) {
      await assertOwnedForm(formId);
      return client.submission.count({
        where: buildSubmissionWhere(formId, where),
      });
    },
    sum: (formId, fieldKey, where) =>
      aggregate("sum", formId, fieldKey, where),
    avg: (formId, fieldKey, where) =>
      aggregate("avg", formId, fieldKey, where),
    min: (formId, fieldKey, where) =>
      aggregate("min", formId, fieldKey, where),
    max: (formId, fieldKey, where) =>
      aggregate("max", formId, fieldKey, where),
    async find(formId, where, limit) {
      await assertOwnedForm(formId);
      const requested = Number.isFinite(limit) ? Math.floor(Number(limit)) : 0;
      const take = Math.max(1, Math.min(requested || FIND_ROW_CAP, FIND_ROW_CAP));
      const rows = await client.submission.findMany({
        where: buildSubmissionWhere(formId, where),
        select: { data: true },
        take,
        orderBy: { createdAt: "desc" },
      });
      return rows.map((row) =>
        row.data && typeof row.data === "object"
          ? (row.data as SubmissionData)
          : {},
      );
    },
    async join(spec) {
      // Both sides must be owned by the same user (self-joins are fine).
      await assertOwnedForm(spec.from);
      await assertOwnedForm(spec.to);
      assertValidFieldKey(spec.on?.[0] ?? "");
      assertValidFieldKey(spec.on?.[1] ?? "");

      const params: unknown[] = [spec.on[0], spec.on[1], spec.from, spec.to];
      let select: string;
      // Runtime-unchecked input (scripts are plain JS): validate explicitly.
      const aggregate: string = spec.aggregate;
      if (aggregate === "count") {
        select = "COUNT(*)";
      } else {
        const aggName = (JOIN_AGGREGATES as Record<string, string>)[aggregate];
        if (!aggName) {
          throw new Error(`Calc db join: unknown aggregate "${aggregate}"`);
        }
        if (!spec.field) {
          throw new Error(
            `Calc db join: "field" is required for ${spec.aggregate}`,
          );
        }
        assertValidFieldKey(spec.field);
        const fieldParam = `$${params.push(spec.field)}`;
        const cast = `CASE WHEN a.data ->> ${fieldParam} ~ ${NUMERIC_JSON_SQL_RE} THEN (a.data ->> ${fieldParam})::numeric END`;
        select = `${aggName}(${cast})`;
      }

      const clauses = [
        ...whereToSql("a", spec.whereFrom, params),
        ...whereToSql("b", spec.whereTo, params),
      ];
      const sql =
        `SELECT ${select} AS value FROM "Submission" a ` +
        `JOIN "Submission" b ON (a.data ->> $1) = (b.data ->> $2) ` +
        `WHERE a."formId" = $3 AND b."formId" = $4` +
        (clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "");
      const rows = await client.$queryRawUnsafe(sql, ...params);
      const raw = (rows[0] as { value?: unknown } | undefined)?.value;
      const num = Number(raw);
      return Number.isFinite(num) ? num : 0;
    },
  };
}
