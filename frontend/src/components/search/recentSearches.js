// The viewer's own recent searches, kept in this browser only (localStorage), newest first.
// Each entry remembers where it led, so picking it again jumps there without another name lookup:
//   { query: "wise 0855", name: "WISE 0855-0714", ra: 133.768079, dec: -7.242922 }
// Storage can be missing or blocked (private window, blocked site data): then the list is just empty.
import { useCallback, useRef, useState } from "react";

const STORAGE_KEY = "spherex-blink:recent-searches";
const MAX_ENTRIES = 8;

/** "WISE 0855-0714" and "wise0855" count as the same search. */
export const normalizeQuery = (text) => text.toLowerCase().replace(/[^a-z0-9.+-]/g, "");

const isEntry = (e) =>
  e && typeof e.query === "string" && e.query.trim() !== "" && Number.isFinite(e.ra) && Number.isFinite(e.dec);

function load() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored.filter(isEntry).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function save(entries) {
  try {
    if (entries.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage full or blocked: the list still works for this visit
  }
}

/** [recent, remember(entry), clear()]: remember puts an entry on top (replacing the same query). */
export function useRecentSearches() {
  const [recent, setRecent] = useState(load);
  const latest = useRef(recent);

  // Saved right away, not inside a state update: picking a result often switches page, which removes
  // this search box before React would get round to a queued update.
  const update = useCallback((next) => {
    latest.current = next;
    save(next);
    setRecent(next);
  }, []);

  const remember = useCallback((entry) => {
    const clean = { ...entry, query: entry.query.trim() };
    if (!isEntry(clean)) return;
    const key = normalizeQuery(clean.query);
    update([clean, ...latest.current.filter((e) => normalizeQuery(e.query) !== key)].slice(0, MAX_ENTRIES));
  }, [update]);

  const clear = useCallback(() => update([]), [update]);

  return [recent, remember, clear];
}
