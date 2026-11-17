// Start page: one paragraph on what SPHEREx and this tool do.
export default function Mission() {
  return (
    <section className="start-section mission" aria-labelledby="mission-title">
      <div className="mission-statement">
        <h2 id="mission-title" className="kicker">The mission</h2>
        <p>
          SPHEREx photographs the whole sky in 102 infrared colours every six months. Our tool lines those images up
          so you can spot what changed in seconds, <span className="mission-quiet">and also find undiscovered objects. It's for researchers, students and anyone curious about space.</span>
        </p>
      </div>
    </section>
  );
}
