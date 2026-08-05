import type { FormField, SubmissionData } from "../../types";

const KEY_REFERENCE = /\[([^\]]+)\]/g;

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" };

function isDateType(type: FormField["type"]): boolean {
  return (
    type === "date" ||
    type === "created_date" ||
    type === "modified_date"
  );
}

export function tokenizeFormula(
  formula: string,
  values: SubmissionData,
  fields?: FormField[],
): Token[] {
  const dateKeys = new Set(
    (fields ?? [])
      .filter((field) => isDateType(field.type))
      .map((field) => field.key),
  );

  const source = formula.replace(KEY_REFERENCE, (match, key) => {
    const raw = values[key];
    if (dateKeys.has(key) && typeof raw === "string" && raw !== "") {
      const timestamp = Date.parse(raw);
      if (!Number.isNaN(timestamp)) {
        return String(Math.floor(timestamp / 86400000));
      }
    }
    const num = Number(raw);
    return Number.isFinite(num) && raw !== null && raw !== "" ? String(num) : "0";
  });

  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (char === " " || char === "\t") {
      index++;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lparen" });
      index++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen" });
      index++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      index++;
      continue;
    }
    if ("+-*/%^".includes(char)) {
      tokens.push({ type: "op", value: char });
      index++;
      continue;
    }
    if ("<>=!".includes(char)) {
      const next = source[index + 1];
      if (
        (char === "=" && next === "=") ||
        (char === "!" && next === "=") ||
        (char === "<" && next === "=") ||
        (char === ">" && next === "=")
      ) {
        tokens.push({ type: "op", value: char + next });
        index += 2;
        continue;
      }
      if (char === "<" || char === ">") {
        tokens.push({ type: "op", value: char });
        index++;
        continue;
      }
      return [];
    }
    const numberMatch = source.slice(index).match(/^\d*\.?\d+/);
    if (numberMatch) {
      tokens.push({ type: "number", value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }
    const identifierMatch = source
      .slice(index)
      .match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (identifierMatch) {
      tokens.push({ type: "identifier", value: identifierMatch[0] });
      index += identifierMatch[0].length;
      continue;
    }
    return [];
  }

  return tokens;
}

type FunctionMap = Record<string, (...args: number[]) => number>;

const FUNCTIONS: FunctionMap = {
  sum: (...args) => args.reduce((acc, value) => acc + value, 0),
  avg: (...args) =>
    args.length === 0 ? 0 : args.reduce((acc, value) => acc + value, 0) / args.length,
  min: (...args) => (args.length === 0 ? 0 : Math.min(...args)),
  max: (...args) => (args.length === 0 ? 0 : Math.max(...args)),
  round: (value, digits) => {
    const factor = Math.pow(10, Math.round(digits ?? 0));
    return Math.round(value * factor) / factor;
  },
  abs: (value) => Math.abs(value),
  count: (...args) => args.filter((value) => value !== 0).length,
  if: (condition, thenValue, elseValue) =>
    condition !== 0 ? (thenValue ?? 0) : (elseValue ?? 0),
  dateDiff: (a, b) => a - b,
};

function callFunction(name: string, args: number[]): number | null {
  const fn = FUNCTIONS[name];
  if (!fn) {
    return null;
  }
  const result = fn(...args);
  return Number.isFinite(result) ? result : null;
}

function compute(
  tokens: Token[],
  position: { index: number },
): number | null {
  const parseExpression = (): number | null => {
    let value = parseComparison();
    if (value === null) {
      return null;
    }
    while (position.index < tokens.length) {
      const token = tokens[position.index];
      if (
        token.type !== "op" ||
        (token.value !== "<" &&
          token.value !== ">" &&
          token.value !== "<=" &&
          token.value !== ">=" &&
          token.value !== "==" &&
          token.value !== "!=")
      ) {
        break;
      }
      position.index++;
      const right = parseComparison();
      if (right === null) {
        return null;
      }
      switch (token.value) {
        case "<":
          value = value < right ? 1 : 0;
          break;
        case ">":
          value = value > right ? 1 : 0;
          break;
        case "<=":
          value = value <= right ? 1 : 0;
          break;
        case ">=":
          value = value >= right ? 1 : 0;
          break;
        case "==":
          value = value === right ? 1 : 0;
          break;
        case "!=":
          value = value !== right ? 1 : 0;
          break;
      }
    }
    return value;
  };

  const parseComparison = (): number | null => {
    let value = parseAddSub();
    if (value === null) {
      return null;
    }
    while (position.index < tokens.length) {
      const token = tokens[position.index];
      if (token.type !== "op" || (token.value !== "+" && token.value !== "-")) {
        break;
      }
      position.index++;
      const right = parseAddSub();
      if (right === null) {
        return null;
      }
      value = token.value === "+" ? value + right : value - right;
    }
    return value;
  };

  const parseAddSub = (): number | null => {
    let value = parseTerm();
    if (value === null) {
      return null;
    }
    while (position.index < tokens.length) {
      const token = tokens[position.index];
      if (
        token.type !== "op" ||
        (token.value !== "*" &&
          token.value !== "/" &&
          token.value !== "%")
      ) {
        break;
      }
      position.index++;
      const right = parseTerm();
      if (right === null) {
        return null;
      }
      if (token.value === "*") {
        value = value * right;
      } else if (token.value === "/") {
        if (right === 0) {
          return null;
        }
        value = value / right;
      } else {
        if (right === 0) {
          return null;
        }
        value = value % right;
      }
    }
    return value;
  };

  const parseTerm = (): number | null => {
    const token = tokens[position.index];
    if (token && token.type === "op" && (token.value === "-" || token.value === "+")) {
      position.index++;
      const operand = parseTerm();
      return operand === null ? null : token.value === "-" ? -operand : operand;
    }
    return parsePower();
  };

  const parsePower = (): number | null => {
    const base = parsePrimary();
    if (base === null) {
      return null;
    }
    const token = tokens[position.index];
    if (token && token.type === "op" && token.value === "^") {
      position.index++;
      const exponent = parseTerm();
      if (exponent === null) {
        return null;
      }
      return Math.pow(base, exponent);
    }
    return base;
  };

  const parsePrimary = (): number | null => {
    const token = tokens[position.index];
    if (!token) {
      return null;
    }
    if (token.type === "number") {
      position.index++;
      return token.value;
    }
    if (token.type === "identifier") {
      position.index++;
      const open = tokens[position.index];
      if (!open || open.type !== "lparen") {
        return null;
      }
      position.index++;
      const args: number[] = [];
      if (tokens[position.index]?.type === "rparen") {
        position.index++;
        return callFunction(token.value, args);
      }
      while (true) {
        const arg = parseExpression();
        if (arg === null) {
          return null;
        }
        args.push(arg);
        const separator = tokens[position.index];
        if (separator && separator.type === "comma") {
          position.index++;
          continue;
        }
        if (separator && separator.type === "rparen") {
          position.index++;
          return callFunction(token.value, args);
        }
        return null;
      }
    }
    if (token.type === "lparen") {
      position.index++;
      const value = parseExpression();
      const closing = tokens[position.index];
      if (value === null || !closing || closing.type !== "rparen") {
        return null;
      }
      position.index++;
      return value;
    }
    return null;
  };

  const value = parseExpression();
  if (value === null || position.index !== tokens.length) {
    return null;
  }
  return value;
}

export function evaluateFormula(
  formula: string,
  values: SubmissionData,
  fields?: FormField[],
): number | null {
  const tokens = tokenizeFormula(formula, values, fields);
  if (tokens.length === 0) {
    return null;
  }
  return compute(tokens, { index: 0 });
}

export function formatFormulaValue(
  formula: string,
  values: SubmissionData,
  fields?: FormField[],
  decimals?: number,
): string {
  const result = evaluateFormula(formula, values, fields);
  if (result === null) {
    return "";
  }
  const digits = decimals ?? 2;
  if (Number.isInteger(result) && digits <= 0) {
    return String(result);
  }
  return String(Number(result.toFixed(digits)));
}
