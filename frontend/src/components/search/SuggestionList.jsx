// The dropdown under the search box: suggestions grouped under small headings, typed letters highlighted.
// It's the listbox half of an ARIA combobox: focus stays in the input, which points at the highlighted
// option with aria-activedescendant (see SearchBar). Options don't take focus, so mousedown is cancelled
// to keep the input focused while clicking.

const GROUP_TITLES = {
  coords: "Coordinates",
  recent: "Recent searches",
  popular: "Popular finds",
  known: "Well-known objects",
};

const keepInputFocused = (event) => event.preventDefault();

function Highlighted({ text, match }) {
  if (!match) return text;
  const [start, end] = match;
  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

/** Consecutive suggestions of the same group → [{ group, items: [{ suggestion, index }] }] */
function groupInOrder(suggestions) {
  const groups = [];
  suggestions.forEach((suggestion, index) => {
    const last = groups[groups.length - 1];
    if (last?.group === suggestion.group) last.items.push({ suggestion, index });
    else groups.push({ group: suggestion.group, items: [{ suggestion, index }] });
  });
  return groups;
}

export default function SuggestionList({ id, suggestions, activeIndex, optionId, onPick, onHover, onClearRecent }) {
  const hasRecent = suggestions.some((s) => s.group === "recent");

  return (
    <div className="search-suggestions">
      <ul id={id} role="listbox" aria-label="Suggestions">
        {groupInOrder(suggestions).map(({ group, items }) => (
          <li key={group} role="presentation">
            <span id={`${id}-${group}`} className="kicker search-suggestion-group" role="presentation">
              {GROUP_TITLES[group]}
            </span>
            <ul role="group" aria-labelledby={`${id}-${group}`}>
              {items.map(({ suggestion, index }) => (
                <li
                  key={suggestion.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="search-suggestion"
                  onMouseDown={keepInputFocused}
                  onMouseMove={() => onHover(index)}
                  onClick={() => onPick(suggestion)}
                >
                  <span className="search-suggestion-label">
                    <Highlighted text={suggestion.label} match={suggestion.match} />
                  </span>
                  {suggestion.detail && <span className="search-suggestion-detail">{suggestion.detail}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {hasRecent && (
        <button type="button" className="search-suggestions-clear" onMouseDown={keepInputFocused} onClick={onClearRecent}>
          Clear recent searches
        </button>
      )}
    </div>
  );
}
