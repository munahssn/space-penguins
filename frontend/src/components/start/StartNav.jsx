// Links to the start page sections, in the pinned header.
// Wide screens: one row of links. Phones: a "Menu" button that opens the links as a vertical list
// under the header (start.css). The list closes on a link, Escape, or a tap outside the menu.
import { useEffect, useId, useRef, useState } from "react";

/** In page order. */
const SECTIONS = [
  { id: "search", label: "Search the sky" },
  { id: "how", label: "How it works" },
  { id: "features", label: "Features" },
  { id: "popular", label: "Popular finds" },
];

function MenuIcon({ open }) {
  return (
    <svg className="start-nav-icon" viewBox="0 0 20 20" aria-hidden="true">
      {open ? (
        <path d="M4 4l12 12M16 4L4 16" />
      ) : (
        <path d="M2 5h16M2 10h16M2 15h16" />
      )}
    </svg>
  );
}

export default function StartNav() {
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);
  const listId = useId();

  // While open: Escape closes (and puts focus back on the button), a tap outside the menu closes.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointerDown = (event) => {
      if (!navRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <nav ref={navRef} className="start-nav" aria-label="On this page">
      <button
        ref={toggleRef}
        type="button"
        className="btn-ghost start-nav-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <MenuIcon open={open} />
        Menu
      </button>
      <ul id={listId} className="start-nav-list" data-open={open}>
        {SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <a href={`#${id}`} onClick={() => setOpen(false)}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
