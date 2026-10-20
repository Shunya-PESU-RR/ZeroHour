import { Link } from 'react-router-dom';

// Decorative wireframe diamonds (echoes the Shunya site)
function Diamond({ className }) {
  return (
    <svg className={'shape ' + className} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <polygon points="50,4 96,50 50,96 4,50" />
      <polygon points="50,4 70,50 50,96 30,50" />
      <line x1="4" y1="50" x2="96" y2="50" />
    </svg>
  );
}

export default function Landing() {
  return (
    <main>
      <section className="hero">
        <Diamond className="d1" /><Diamond className="d2" /><Diamond className="d3" /><Diamond className="d4" />
        <p className="eyebrow">A SHUNYA EVENT &bull; 24-HOUR MATH HACKATHON</p>
        <h1>ZERO<span>HOUR</span></h1>
        <p className="tagline">Mathematics &bull; Logic &bull; Exploration</p>
        <div className="cta">
          <Link className="btn primary" to="/register">Register your team</Link>
          <a className="btn" href="#about">Learn more</a>
        </div>
      </section>

      <section id="about" className="section">
        <h2>About ZeroHour</h2>
        <p className="lead">
          To be announced
        </p>
        <div className="grid3">
          <div className="feature"><h3>Format</h3><p>To be announced</p></div>
          <div className="feature"><h3>Mentorship</h3><p>To be announced</p></div>
          <div className="feature"><h3>Judging</h3><p>To be announced</p></div>
        </div>
      </section>

      <section className="section">
        <h2>How it works</h2>
        <ol className="steps">
          <li><strong>Register</strong><span>Sign up your team before registrations close.</span></li>
          <li><strong>Get shortlisted</strong><span>Organizers review registrations and shortlist teams.</span></li>
          <li><strong>Request mentor access</strong><span>Shortlisted teams ask for mentor access.</span></li>
          <li><strong>Build for 24 hours</strong><span>Hack, get mentor help, and present your work.</span></li>
        </ol>
        <div className="cta">
          <Link className="btn primary" to="/register">Register now</Link>
          <Link className="btn" to="/mentor-access">Request mentor access</Link>
        </div>
      </section>

      <section className="section">
        <h2>Event details</h2>
        <div className="grid3">
          <div className="feature"><h3>Dates</h3><p>To be announced</p></div>
          <div className="feature"><h3>Venue</h3><p>To be announced</p></div>
          <div className="feature"><h3>Team size</h3><p>To be announced</p></div>
        </div>
      </section>
    </main>
  );
}