// Suggestions for what the user has typed so far. Pure function: no React, no storage, easy to test.
//
//   suggest("W", sources)   → WISE 0855-0714 (popular find), Wolf 359 (well-known), …
//   suggest("13", sources)  → 133.768079 -7.242922 · WISE 0855-0714, …
//   suggest("", sources)    → the recent searches
//
// Each suggestion: { id, group, label, detail, value, name?, position?, match? }
//   group:    "coords" | "recent" | "popular" | "known" (the list shows a heading per group)
//   value:    text that goes into the box when it's picked
//   name:     the object's name, if known (kept with the recent search)
//   position: { ra, dec } when we already know where it is (picking it needs no name lookup)
//   match:    [start, end] of the typed text inside label, for highlighting
import { formatCoords, parseSearch } from "./parseSearch.js";
import { normalizeQuery } from "./recentSearches.js";

export const MAX_SUGGESTIONS = 8;
const MAX_RECENT_WHILE_TYPING = 3;
const STARTS_LIKE_NUMBER = /^[+-]?\d/;

const isWordChar = (ch) => /[a-z0-9]/i.test(ch);
const squash = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, ""); // "WISE 0855-0714" → "wise08550714"

/**
 * Where `query` matches `text`: at the start or at the start of a word ("W" in "Wolf 359",
 * "08" in "WISE 0855"), or ignoring spaces and punctuation ("wise0855"). null when it doesn't.
 * Returns { rank, match } — lower rank sorts first; match is the range to highlight, if any.
 */
export function matchName(text, query) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  for (let i = lowerText.indexOf(lowerQuery); i !== -1; i = lowerText.indexOf(lowerQuery, i + 1)) {
    if (i === 0 || !isWordChar(lowerText[i - 1])) {
      return { rank: i === 0 ? 0 : 1, match: [i, i + query.length] };
    }
  }
  const squashedQuery = squash(query);
  if (squashedQuery && squash(text).startsWith(squashedQuery)) return { rank: 2, match: null };
  return null;
}

/**
 * Typed coordinates vs a known position "133.768079 -7.242922": RA and Dec are each matched as a prefix,
 * so "13", "133.7" and "133.76 -7" all match. Commas and extra spaces don't matter. Highlights the RA part.
 */
function matchCoords(coordText, query) {
  const [typedRa, typedDec, ...extra] = query.split(/[,\s]+/).filter(Boolean);
  const [ra, dec] = coordText.split(" ");
  if (extra.length || !ra.startsWith(typedRa) || (typedDec !== undefined && !dec.startsWith(typedDec))) return null;
  return { rank: 0, match: [0, typedRa.length] };
}

/** A recent search matches on what was typed then, or (without highlight) on the name or position it led to. */
function matchRecent(entry, query, looksLikeCoords) {
  const onQuery = matchName(entry.query, query);
  if (onQuery) return onQuery;
  if (entry.name && matchName(entry.name, query)) return { rank: 3, match: null };
  if (looksLikeCoords && matchCoords(formatCoords(entry.ra, entry.dec), query)) return { rank: 3, match: null };
  return null;
}

function recentSuggestion(entry, match) {
  // Second line: the name it led to, else its position, unless that just repeats what was typed.
  const coords = formatCoords(entry.ra, entry.dec);
  const sameAsName = entry.name && normalizeQuery(entry.name) === normalizeQuery(entry.query);
  const typedCoords = STARTS_LIKE_NUMBER.test(entry.query);
  return {
    id: `recent:${normalizeQuery(entry.query)}`,
    group: "recent",
    label: entry.query,
    detail: entry.name && !sameAsName ? entry.name : typedCoords ? null : coords,
    value: entry.query,
    name: entry.name,
    position: { ra: entry.ra, dec: entry.dec },
    match: match?.match ?? null,
  };
}

function popularSuggestion(target, match, asCoords) {
  const coords = formatCoords(target.ra, target.dec);
  return {
    id: `popular:${target.id}`,
    group: "popular",
    label: asCoords ? coords : target.name,
    detail: asCoords ? target.name : target.note,
    value: asCoords ? coords : target.name,
    name: target.name,
    position: { ra: target.ra, dec: target.dec },
    match: match.match,
  };
}

const byRank = (a, b) => a.rank - b.rank;

/** Keys that identify the same thing: the text, and the spot on the sky (to ~0.4″) when known. */
function identityKeys(item) {
  const keys = [`text:${normalizeQuery(item.value)}`];
  if (item.position) keys.push(`at:${item.position.ra.toFixed(4)},${item.position.dec.toFixed(4)}`);
  return keys;
}

/**
 * @param {string} text what's in the box
 * @param {{recent: object[], targets: object[], known: object[]}} sources
 */
export function suggest(text, { recent = [], targets = [], known = [] }) {
  const query = text.trim();
  if (!query) return recent.slice(0, MAX_SUGGESTIONS).map((e) => recentSuggestion(e));

  const looksLikeCoords = STARTS_LIKE_NUMBER.test(query);
  const results = [];

  // A complete position: show how it was read (e.g. hh:mm:ss turned into degrees).
  const parsed = looksLikeCoords ? parseSearch(query) : null;
  if (parsed?.kind === "coords") {
    results.push({
      id: "coords:typed",
      group: "coords",
      label: `RA ${parsed.ra}° · Dec ${parsed.dec}°`,
      detail: "Go to these coordinates",
      value: query,
      position: { ra: parsed.ra, dec: parsed.dec },
      match: null,
    });
  }

  const recentHits = recent
    .map((entry) => {
      const match = matchRecent(entry, query, looksLikeCoords);
      return match && { rank: match.rank, item: recentSuggestion(entry, match) };
    })
    .filter(Boolean)
    .sort(byRank)
    .slice(0, MAX_RECENT_WHILE_TYPING);

  const popularHits = targets
    .map((target) => {
      const match = looksLikeCoords
        ? matchCoords(formatCoords(target.ra, target.dec), query)
        : matchName(target.name, query);
      return match && { rank: match.rank, item: popularSuggestion(target, match, looksLikeCoords) };
    })
    .filter(Boolean)
    .sort(byRank);

  const knownHits = looksLikeCoords
    ? []
    : known
        .map((object) => {
          const match = matchName(object.name, query);
          return match && {
            rank: match.rank,
            item: { id: `known:${squash(object.name)}`, group: "known", label: object.name, detail: object.note,
              value: object.name, match: match.match },
          };
        })
        .filter(Boolean)
        .sort(byRank);

  // Same thing twice (e.g. a recent search for a popular find): keep the first, which is the higher group.
  const seen = new Set(results.flatMap(identityKeys));
  for (const { item } of [...recentHits, ...popularHits, ...knownHits]) {
    const keys = identityKeys(item);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    results.push(item);
  }
  return results.slice(0, MAX_SUGGESTIONS);
}
