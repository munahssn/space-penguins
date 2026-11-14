import ViewerPage from "./pages/ViewerPage.jsx";
import DevCheck from "./pages/DevCheck.jsx";

// ?dev=1 opens the temporary API/view-state check page.
const isDevCheck = new URLSearchParams(window.location.search).has("dev");

export default function App() {
  return isDevCheck ? <DevCheck /> : <ViewerPage />;
}
