// Turns what the user typed into coordinates, or a name to look up.
//
//   parseSearch("133.768 -7.243")        → { kind: "coords", ra: 133.768, dec: -7.243 }
//   parseSearch("133.768, -7.243")       → same
//   parseSearch("08:55:04.3 -07:14:34")  → { kind: "coords", ra: 133.767917, dec: -7.242778 }  (RA in hours)
//   parseSearch("8h55m04.3s -7d14m34s")  → same
//   parseSearch("WISE 0855")             → { kind: "name", name: "WISE 0855" }
//   parseSearch("400 10")                → { kind: "error", message: "RA must be …" }
import { roundDegrees } from "../../utils/angles.js";

const FORMAT_HINT =
  "Type a name, decimal degrees (133.768 -7.243) or hh:mm:ss dd:mm:ss (08:55:04 -07:14:34).";

// Only digits, signs, separators and unit marks: anything else (letters) means it's a name.
const COORDINATE_CHARS = /^[\d\s.,:+\-hmsd°'"′″]+$/i;
const STARTS_LIKE_NUMBER = /^[+-]?\d/;
const UNIT_MARKS = /[hmsd°'"′″:]/gi;
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const HOURS_MARK = /\d\s*h/i; // "8h55m"

const error = (message) => ({ kind: "error", message });

export function parseSearch(input) {
  const text = input.trim();
  if (!text) return error(FORMAT_HINT);
  if (!COORDINATE_CHARS.test(text) || !STARTS_LIKE_NUMBER.test(text)) return { kind: "name", name: text };
  return parseCoordinates(text);
}

function parseCoordinates(text) {
  const halves = splitRaDec(text);
  if (!halves) return error(FORMAT_HINT);
  const [raTokens, decTokens] = halves;

  // "08 55 04" / "08:55:04" / "8h55m" are hours; a single plain number is degrees.
  const raInHours = raTokens.length > 1 || HOURS_MARK.test(text);
  const raValue = sexagesimal(raTokens);
  const dec = sexagesimal(decTokens);
  if (raValue === null || dec === null) return error(FORMAT_HINT);

  const ra = raInHours ? raValue * 15 : raValue;
  if (raValue < 0 || ra >= 360) return error("RA must be 0–360° (or 0–24h).");
  if (dec < -90 || dec > 90) return error("Dec must be between −90° and +90°.");
  return { kind: "coords", ra: roundDegrees(ra), dec: roundDegrees(dec) };
}

/** Splits into RA tokens and Dec tokens: at the comma if there is one, else in the middle. */
function splitRaDec(text) {
  const tokens = (s) => s.replace(UNIT_MARKS, " ").trim().split(/\s+/).filter(Boolean);
  if (text.includes(",")) {
    const parts = text.split(",");
    return parts.length === 2 ? parts.map(tokens) : null;
  }
  const all = tokens(text);
  if (all.length < 2 || all.length > 6 || all.length % 2 !== 0) return null;
  return [all.slice(0, all.length / 2), all.slice(all.length / 2)];
}

/** ["-07", "14", "34"] → -7.242778. Only the first part may carry a sign; minutes/seconds must be < 60. */
function sexagesimal(parts) {
  if (parts.length < 1 || parts.length > 3 || !parts.every((p) => NUMBER.test(p))) return null;
  const [first, ...rest] = parts;
  if (rest.some((p) => /^[+-]/.test(p) || Number(p) >= 60)) return null;
  const sign = first.startsWith("-") ? -1 : 1; // "-00 30" is negative even though Number("-00") is 0
  const magnitude = rest.reduce((sum, p, i) => sum + Number(p) / 60 ** (i + 1), Math.abs(Number(first)));
  return sign * magnitude;
}

/** For showing a position in the search box: "133.768079 -7.242922". */
export function formatCoords(ra, dec) {
  return `${roundDegrees(ra)} ${roundDegrees(dec)}`;
}
