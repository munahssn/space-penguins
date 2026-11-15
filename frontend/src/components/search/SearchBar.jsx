import { useId, useRef, useState } from "react";
import { resolve } from "../../api/api.js";
import { useViewState } from "../../hooks/useViewState.jsx";
import { formatCoords, parseSearch } from "./parseSearch.js";
import { findTargetAt, useTargets } from "./useTargets.js";
import "./search.css";

function lookupErrorMessage(error, name) {
  if (error.status === 404) return `No object called “${name}” was found. Check the spelling, or enter coordinates.`;
  if (error.status === 422) return error.message;
  return "Couldn't reach the name lookup. Try again, or enter coordinates.";
}

function TargetSelect({ targets, value, onChange }) {
  return (
    <select
      className="search-targets"
      value={value}
      onChange={onChange}
      disabled={targets.length === 0}
      aria-label="Test targets"
    >
      <option value="" disabled>
        {targets.length ? "Test targets" : "Loading targets…"}
      </option>
      {targets.map((t) => (
        <option key={t.id} value={t.id} title={t.note}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Search by name (→ /api/resolve), decimal degrees or hh:mm:ss dd:mm:ss, or pick a test target.
 * large: bigger version for the start page. showTargets: false hides the test-target dropdown.
 */
export default function SearchBar({ large = false, showTargets = true }) {
  const { ra, dec, setView } = useViewState();
  const targets = useTargets();
  const [text, setText] = useState(() => (ra !== null && dec !== null ? formatCoords(ra, dec) : ""));
  const [error, setError] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const latestLookup = useRef(0); // ignore answers to older lookups if the user searched again
  const errorId = useId();

  const currentTarget = findTargetAt(targets, ra, dec);

  function goTo(position) {
    setError(null);
    setView(position);
  }

  async function lookUp(name) {
    const lookup = ++latestLookup.current;
    setLookingUp(true);
    try {
      const hit = await resolve(name);
      if (lookup === latestLookup.current) goTo({ ra: hit.ra, dec: hit.dec });
    } catch (err) {
      if (lookup === latestLookup.current) setError(lookupErrorMessage(err, name));
    } finally {
      if (lookup === latestLookup.current) setLookingUp(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const parsed = parseSearch(text);
    if (parsed.kind === "error") setError(parsed.message);
    else if (parsed.kind === "coords") goTo({ ra: parsed.ra, dec: parsed.dec });
    else lookUp(parsed.name);
  }

  function handlePickTarget(event) {
    const target = targets.find((t) => t.id === event.target.value);
    if (!target) return;
    setText(target.name);
    goTo({ ra: target.ra, dec: target.dec });
  }

  return (
    <form className={`search ${large ? "search--large" : ""}`.trim()} role="search" onSubmit={handleSubmit} noValidate>
      <div className="search-row">
        <input
          className="search-input"
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="Name or coordinates, e.g. WISE 0855 or 133.768 -7.243"
          aria-label="Object name or coordinates"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn-primary" disabled={lookingUp}>
          {lookingUp ? "Looking up…" : "Go"}
        </button>
        {showTargets && (
          <TargetSelect targets={targets} value={currentTarget?.id ?? ""} onChange={handlePickTarget} />
        )}
      </div>
      {error && (
        <p id={errorId} className="search-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
