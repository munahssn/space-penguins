import AppLayout from "../components/layout/AppLayout.jsx";
import Header from "../components/layout/Header.jsx";
import Placeholder from "../components/layout/Placeholder.jsx";
import DataChip from "../components/status/DataChip.jsx";
import StatusBar from "../components/status/StatusBar.jsx";
import ShareActions from "../components/share/ShareActions.jsx";
import FramePlayer from "../components/player/FramePlayer.jsx";
import IsItNewPanel from "../components/verdict/IsItNewPanel.jsx";
import ChartsPanel from "../components/charts/ChartsPanel.jsx";
import SearchBar from "../components/search/SearchBar.jsx";
import ControlPanel from "../components/controls/ControlPanel.jsx";
import StretchFrame from "../components/controls/StretchFrame.jsx";

const PERSON_2 = "Person 2";

/** Main viewer page. Placeholders mark components that later issues will drop in. */
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
          <StretchFrame>
            <FramePlayer />
          </StretchFrame>
          <ControlPanel />
        </>
      }
      side={
        <>
          <IsItNewPanel />
          <ChartsPanel />
          <Placeholder name="SkyMap" issue={12} owner={PERSON_2} className="placeholder-square" />
        </>
      }
    />
  );
}
