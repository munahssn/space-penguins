import AppLayout from "../components/layout/AppLayout.jsx";
import Header from "../components/layout/Header.jsx";
import Placeholder from "../components/layout/Placeholder.jsx";
import DataChip from "../components/status/DataChip.jsx";
import ShareActions from "../components/share/ShareActions.jsx";

const PERSON_1 = "Person 1";
const PERSON_2 = "Person 2";

/** Main viewer page. Placeholders mark components that later issues will drop in. */
export default function ViewerPage() {
  return (
    <AppLayout
      header={
        <Header
          search={<Placeholder name="SearchBar" issue={7} owner={PERSON_2} className="placeholder-inline" />}
          status={<DataChip />}
          actions={<ShareActions />}
        />
      }
      viewer={
        <>
          <Placeholder name="FramePlayer" issue={4} owner={PERSON_1} className="placeholder-player" />
          <Placeholder name="ControlPanel" issue={9} owner={PERSON_2} />
        </>
      }
      side={
        <>
          <Placeholder name="“Is it new?” panel" issue={10} owner={PERSON_1} />
          <Placeholder name="Charts" issue={11} owner={PERSON_1} />
          <Placeholder name="SkyMap" issue={12} owner={PERSON_2} className="placeholder-square" />
        </>
      }
    />
  );
}
