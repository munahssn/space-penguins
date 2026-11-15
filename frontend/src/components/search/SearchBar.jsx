import { useEffect, useId, useMemo, useRef, useState } from "react";
import { resolve } from "../../api/api.js";
import { useViewState } from "../../hooks/useViewState.jsx";
import { KNOWN_OBJECTS } from "./knownObjects.js";
import { formatCoords, parseSearch } from "./parseSearch.js";
import { useRecentSearches } from "./recentSearches.js";
import { suggest } from "./suggest.js";
import SuggestionList from "./SuggestionList.jsx";
import { useTargets } from "./useTargets.js";
import "./search.css";

function lookupErrorMessage(error, name) {
  if (error.status === 404) return `No object called “${name}” was found. Check the spelling, or enter coordinates.`;
  if (error.status === 422) return error.message;
  return "Couldn't reach the name lookup. Try again, or enter coordinates.";
}

/**
 * Search by name (→ /api/resolve), decimal degrees or hh:mm:ss dd:mm:ss.
 * While typing, a list suggests recent searches, popular finds, well-known objects and known positions
 * (suggest.js). Successful searches are remembered in this browser (recentSearches.js).
 * large: bigger version for the start page.
 */
export default function SearchBar({ large = false }) {
  const { ra, dec, setView } = useViewState();
  const targets = useTargets();
  const [text, setText] = useState(() => (ra !== null && dec !== null ? formatCoords(ra, dec) : ""));
  const [error, setError] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const latestLookup = useRef(0); // ignore answers to older lookups if the user searched again
  const errorId = useId();
  const listId = useId();

  const [recent, remember, clearRecent] = useRecentSearches();
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1); // highlighted suggestion, -1 = none
  const suggestions = useMemo(
    () => suggest(text, { recent, targets, known: KNOWN_OBJECTS }),
    [text, recent, targets],
  );
  const showList = listOpen && suggestions.length > 0;
  const active = showList && activeIndex < suggestions.length ? activeIndex : -1;
  const optionId = (index) => `${listId}-option-${index}`;

  // Keep the highlighted suggestion in view when the list is taller than its box.
  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function closeList() {
    setListOpen(false);
    setActiveIndex(-1);
  }

  /** Go to a position we already know. With a query, it's remembered as a recent search. */
  function goTo(position, query, name) {
    setError(null);
    closeList();
    if (query) remember({ query, name, ...position });
    setView(position);
  }

  async function lookUp(name) {
    const lookup = ++latestLookup.current;
    setLookingUp(true);
    closeList();
    try {
      const hit = await resolve(name);
      if (lookup === latestLookup.current) goTo({ ra: hit.ra, dec: hit.dec }, name, hit.name);
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
    else if (parsed.kind === "coords") goTo({ ra: parsed.ra, dec: parsed.dec }, text);
    else lookUp(parsed.name);
  }

  /** A suggestion with a known position goes straight there; a name without one is looked up. */
  function pickSuggestion(suggestion) {
    setText(suggestion.value);
    if (suggestion.position) goTo(suggestion.position, suggestion.value, suggestion.name);
    else lookUp(suggestion.value);
  }

  // Combobox keys: Down/Up move through the list (and open it), Enter picks, Escape closes.
  function handleKeyDown(event) {
    const count = suggestions.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!count) return;
      event.preventDefault();
      setListOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current < 0 && step < 0 ? count - 1 : (current + step + count) % count));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault(); // pick the highlighted suggestion instead of submitting the text
      pickSuggestion(suggestions[active]);
    } else if (event.key === "Escape" && showList) {
      event.preventDefault(); // just close the list; a second Escape clears the box as usual
      closeList();
    }
  }

  // Close the list when focus leaves both the box and the list (Tab away, click elsewhere).
  function handleBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) closeList();
  }

  return (
    <form className={`search ${large ? "search--large" : ""}`.trim()} role="search" onSubmit={handleSubmit} noValidate>
      <div className="search-row">
        <div className="search-field" onBlur={handleBlur}>
          <input
            className="search-input"
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
              setListOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setListOpen(true)}
            onMouseDown={() => setListOpen(true)} // reopens the list after Escape without leaving the box
            onKeyDown={handleKeyDown}
            placeholder="Name or coordinates, e.g. WISE 0855 or 133.768 -7.243"
            role="combobox"
            aria-label="Object name or coordinates"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {showList && (
            <SuggestionList
              id={listId}
              suggestions={suggestions}
              activeIndex={active}
              optionId={optionId}
              onPick={pickSuggestion}
              onHover={setActiveIndex}
              onClearRecent={clearRecent}
            />
          )}
        </div>
        <button type="submit" className="btn-primary" disabled={lookingUp}>
          {lookingUp ? "Looking up…" : "Go"}
        </button>
      </div>
      {error && (
        <p id={errorId} className="search-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
