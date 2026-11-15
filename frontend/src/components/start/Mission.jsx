// Start page: one paragraph on what SPHEREx and this tool do.
export default function Mission() {
  return (
    <section className="start-section mission" aria-labelledby="mission-title">
      <div className="mission-statement">
        <h2 id="mission-title" className="kicker">The mission</h2>
        <p>
          SPHEREx photographs the whole sky in 102 infrared colours every six months. Our tool lines those images up
          so you can spot what changed in seconds, <span className="mission-quiet">and also find undiscovered objects. It can be used for researchers, lawyers, students, or anyone interested in Space.</span>
        </p>
      </div>
    </section>
  );
}
