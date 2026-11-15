export default function Logo() {
  return (
    <a className="logo" href="/" aria-label="SPHEREx Blink home">
      <svg className="logo-mark" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="11" cy="14" r="3" fill="currentColor" />
        <circle cx="18.5" cy="14" r="1.6" fill="currentColor" opacity="0.55" />
      </svg>
      <span className="logo-text">SPHEREx Blink</span>
    </a>
  );
}
