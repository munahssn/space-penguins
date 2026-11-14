export default function Logo() {
  return (
    <a className="logo" href="/" aria-label="SPHEREx Blink home">
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
        <circle cx="12" cy="17" r="3" fill="currentColor" opacity="0.45" />
        <circle cx="20" cy="15" r="3" fill="var(--color-accent)" />
      </svg>
      <span className="logo-text">SPHEREx <strong>Blink</strong></span>
    </a>
  );
}
