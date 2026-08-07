import { Prisma } from "@prisma/client";
import type { SubmissionData } from "../types";

/**
 * Filter shape for calc db queries, matched against Submission.data (JSON):
 *   { estate_id: "abc" }                     — shorthand for equals
 *   { status: { equals: "active" } }         — explicit equals
 *   { score: { gte: 90 } }                   — numeric lt/lte/gt/gte
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
    }
>;

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
};

const FIND_ROW_CAP = 50;
const AGGREGATE_ROW_CAP = 1000;

const NUMERIC_OPS = ["lt", "lte", "gt", "gte"] as const;

/** JSON `equals` filters need Prisma.JsonNull for explicit nulls. */
function jsonEquals(
  value: string | number | boolean | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value;
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
  };
}
