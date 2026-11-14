import { useViewState } from "./hooks/useViewState.jsx";
import DevCheck from "./pages/DevCheck.jsx";
import EmbedPage from "./pages/EmbedPage.jsx";
import StartPage from "./pages/StartPage.jsx";
import ViewerPage from "./pages/ViewerPage.jsx";

// ?dev=1 opens the temporary API/view-state check page.
const isDevCheck = new URLSearchParams(window.location.search).get("dev") === "1";

/**
 * ?embed=1 → player only (inside someone else's page).
 * Otherwise: no target in the URL → start page; a target (link, search or card) → viewer.
 */
export default function App() {
  const { ra, dec, embed } = useViewState();
  if (isDevCheck) return <DevCheck />;
  if (embed) return <EmbedPage />;
  return ra !== null && dec !== null ? <ViewerPage /> : <StartPage />;
}
