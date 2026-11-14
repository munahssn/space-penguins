import Logo from "./Logo.jsx";

/** Top bar. Presentational: the caller passes in what goes in each slot. */
export default function Header({ search, status, actions }) {
  return (
    <header className="app-header">
      <Logo />
      <div className="app-header-search">{search}</div>
      <div className="app-header-end">
        {status}
        {actions}
      </div>
    </header>
  );
}
