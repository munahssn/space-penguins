const STEPS = [
  {
    title: "Pick a spot of sky",
    text: "Type a name like WISE 0855, paste coordinates, or start from one of the test targets.",
  },
  {
    title: "Blink the SPHEREx images",
    text: "SPHEREx maps the whole sky every six months. Flipping between passes makes anything that moved jump.",
  },
  {
    title: "Check if it's known",
    text: "Click a source to compare it with Gaia stars and known asteroids, and see if it's something new.",
  },
];

export default function HowItWorks() {
  return (
    <ol className="how-steps">
      {STEPS.map((step, i) => (
        <li key={step.title} className="how-step">
          <span className="how-step-number" aria-hidden="true">{i + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
