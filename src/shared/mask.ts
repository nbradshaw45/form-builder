export const MASK_PRESETS: { label: string; mask: string }[] = [
  { label: "Phone", mask: "(###) ###-####" },
  { label: "US phone", mask: "+1 (###) ###-####" },
  { label: "Credit card", mask: "#### #### #### ####" },
  { label: "Date", mask: "##/##/####" },
  { label: "Zip code", mask: "#####-####" },
  { label: "SSN", mask: "###-##-####" },
];

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isLetter(ch: string): boolean {
  return /[A-Za-z]/.test(ch);
}

function isAlphaNumeric(ch: string): boolean {
  return /[0-9A-Za-z]/.test(ch);
}

function isMaskable(ch: string): boolean {
  return isAlphaNumeric(ch);
}

/**
 * Formats a raw input string to match `mask`.
 *
 * Token chars:
 *   `#`  — any digit
 *   `A`  — any letter (upper-cased)
 *   `a`  — any letter (lower-cased)
 *   `*`  — any letter or digit
 *   anything else is a literal that is auto-inserted as the user types.
 *
 * Masking is idempotent: applying it to an already-masked value returns the
 * same value.
 */
export function maskInput(input: string, mask: string): string {
  if (!mask) {
    return input;
  }
  const raw: string[] = [];
  for (const ch of input) {
    if (isMaskable(ch)) {
      raw.push(ch);
    }
  }

  let output = "";
  let rawIndex = 0;
  for (const token of mask) {
    if (rawIndex >= raw.length) {
      break;
    }
    if (token === "#") {
      if (!isDigit(raw[rawIndex])) {
        break;
      }
      output += raw[rawIndex];
      rawIndex++;
    } else if (token === "A" || token === "a") {
      if (!isLetter(raw[rawIndex])) {
        break;
      }
      output += token === "A" ? raw[rawIndex].toUpperCase() : raw[rawIndex].toLowerCase();
      rawIndex++;
    } else if (token === "*") {
      if (!isAlphaNumeric(raw[rawIndex])) {
        break;
      }
      output += raw[rawIndex];
      rawIndex++;
    } else {
      output += token;
    }
  }

  return output;
}
