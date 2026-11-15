import Logo from "./Logo.jsx";
import "./layout.css";

/** Top bar. Presentational: the caller passes in what goes in each slot (all optional). */
export default function Header({ search, nav, status, actions }) {
  return (
    <header className="app-header">
      <Logo />
      {nav}
      {search && <div className="app-header-search">{search}</div>}
      <div className="app-header-end">
        {status}
        {actions}
      </div>
    </header>
  );
}
