import AppLayout from "../components/layout/AppLayout.jsx";
import Header from "../components/layout/Header.jsx";
import DataChip from "../components/status/DataChip.jsx";
import StatusBar from "../components/status/StatusBar.jsx";
import ShareActions from "../components/share/ShareActions.jsx";
import FramePlayer from "../components/player/FramePlayer.jsx";
import IsItNewPanel from "../components/verdict/IsItNewPanel.jsx";
import ChartsPanel from "../components/charts/ChartsPanel.jsx";
import SearchBar from "../components/search/SearchBar.jsx";
import ControlPanel from "../components/controls/ControlPanel.jsx";
import SkyMap from "../components/skymap/SkyMap.jsx";

/** Main viewer page: search + status on top, player and controls on the left, details on the right. */
export default function ViewerPage() {
  return (
    <AppLayout
      header={
        <Header
          search={<SearchBar />}
          status={<DataChip />}
          actions={<ShareActions />}
        />
      }
      statusBar={<StatusBar />}
      viewer={
        <>
          {/* Screen readers navigate by headings; the page's look doesn't need a visible one. */}
          <h1 className="visually-hidden">SPHEREx Blink viewer</h1>
          <FramePlayer />
          <ControlPanel />
        </>
      }
      side={
        <>
          <IsItNewPanel />
          <ChartsPanel />
          <SkyMap />
        </>
      }
    />
  );
}
