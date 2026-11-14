import { useViewState } from "./hooks/useViewState.jsx";
import DevCheck from "./pages/DevCheck.jsx";
import StartPage from "./pages/StartPage.jsx";
import ViewerPage from "./pages/ViewerPage.jsx";

// ?dev=1 opens the temporary API/view-state check page.
const isDevCheck = new URLSearchParams(window.location.search).has("dev");

/** No target in the URL → start page. A target (from a link, search or card) → viewer. */
export default function App() {
  const { ra, dec } = useViewState();
  if (isDevCheck) return <DevCheck />;
  return ra !== null && dec !== null ? <ViewerPage /> : <StartPage />;
}
