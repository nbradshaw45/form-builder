import type { SubmissionData } from "../../types";

const KEY_REFERENCE = /\[([^\]]+)\]/g;

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" };

export function tokenizeFormula(
  formula: string,
  values: SubmissionData,
): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const source = formula.replace(KEY_REFERENCE, (match, key) => {
    const raw = values[key];
    const num = Number(raw);
    return Number.isFinite(num) && raw !== null && raw !== "" ? String(num) : "0";
  });

  while (index < source.length) {
    const char = source[index];
    if (char === " ") {
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
    if ("+-*/%^".includes(char)) {
      tokens.push({ type: "op", value: char });
      index++;
      continue;
    }
    const numberMatch = source.slice(index).match(/^\d*\.?\d+/);
    if (numberMatch) {
      tokens.push({ type: "number", value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }
    return [];
  }

  return tokens;
}

function compute(
  tokens: Token[],
  position: { index: number },
): { value: number; index: number } | null {
  const parseExpression = (): number | null => {
    let value = parseTerm();
    if (value === null) {
      return null;
    }
    while (position.index < tokens.length) {
      const token = tokens[position.index];
      if (token.type !== "op" || (token.value !== "+" && token.value !== "-")) {
        break;
      }
      position.index++;
      const right = parseTerm();
      if (right === null) {
        return null;
      }
      value = token.value === "+" ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value === null) {
      return null;
    }
    while (position.index < tokens.length) {
      const token = tokens[position.index];
      if (
        token.type !== "op" ||
        (token.value !== "*" && token.value !== "/" && token.value !== "%")
      ) {
        break;
      }
      position.index++;
      const right = parseFactor();
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

  const parseFactor = (): number | null => {
    const token = tokens[position.index];
    if (token && token.type === "op" && (token.value === "-" || token.value === "+")) {
      position.index++;
      const operand = parseFactor();
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
      const exponent = parseFactor();
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
  return { value, index: position.index };
}

export function evaluateFormula(
  formula: string,
  values: SubmissionData,
): number | null {
  const tokens = tokenizeFormula(formula, values);
  if (tokens.length === 0) {
    return null;
  }
  const result = compute(tokens, { index: 0 });
  return result === null ? null : result.value;
}

export function formatFormulaValue(
  formula: string,
  values: SubmissionData,
): string {
  const result = evaluateFormula(formula, values);
  if (result === null) {
    return "";
  }
  if (Number.isInteger(result)) {
    return String(result);
  }
  return String(Math.round(result * 100) / 100);
}
