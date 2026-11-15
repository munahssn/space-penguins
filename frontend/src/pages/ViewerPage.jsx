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
import TargetHeading from "../components/target/TargetHeading.jsx";
import TargetSummary from "../components/target/TargetSummary.jsx";

/**
 * Main viewer page: search + status on top; the player with charts and sky map under it on the left;
 * the black side panel with the target, view settings and "Is it new?" on the right.
 */
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
      viewer={<FramePlayer heading={<TargetHeading />} />}
      below={
        <div className="viewer-extras">
          <ChartsPanel />
          <SkyMap />
        </div>
      }
      side={
        <>
          <TargetSummary />
          <ControlPanel />
          <IsItNewPanel />
        </>
      }
    />
  );
}
