import { Link } from "react-router-dom"
import logo from "../assets/shunya-logo.svg"
import { PUBLIC_REGISTRATION_URL } from "../components/Layouts"
import ShunyaLogo from "../components/ShunyaLogo"
import MoireBackground from "../components/MoireBackground"
import AnamorphicInfinity from "./AnamorphicInfinity"
import SocialFooter from "../components/SocialFooter"
import { Competition, EventContact, ParticipantGuide, SectionHeading, Tracks } from './EventProgram'
import "./landing.css"

const Arrow = () => <span aria-hidden="true">↗</span>

function lissajousPath(phase) {
  return Array.from({ length: 181 }, (_, index) => {
    const t = index * Math.PI / 90
    const x = 90 + 80 * Math.sin(3 * t + phase)
    const y = 70 + 60 * Math.sin(2 * t)
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(" ") + "Z"
}

const phaseCurves = [0.25, 0.47, 0.69].map(lissajousPath)

function PhasePortrait() {
  return (
    <svg className="phase-portrait" viewBox="0 0 180 140" aria-hidden="true" focusable="false">
      <path className="phase-axis" d="M0 70H180M90 0V140" />
      {phaseCurves.map((curve) => <path key={curve} className="phase-curve" d={curve} />)}
    </svg>
  )
}

export function Header({ aboutPage = false }) {
  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link className="brand" to={aboutPage ? '/' : '#home'} aria-label="ZeroHour home">
          <img className="brand-logo" src={logo} alt="" width="34" height="34" />
          <span>ZERO</span><b>HOUR</b>
        </Link>
        <nav aria-label="Main navigation">
          <Link className={aboutPage ? undefined : 'active'} to={aboutPage ? '/' : '#home'} aria-current={aboutPage ? undefined : 'page'}>Home</Link>
          <Link className={aboutPage ? 'active' : undefined} to="/about" aria-current={aboutPage ? 'page' : undefined}>About</Link>
          <a href={PUBLIC_REGISTRATION_URL} target="_blank" rel="noreferrer">Register</a>
          <Link to="/admin/login">Admin</Link>
          <Link to="/team-login">Team Login</Link>
        </nav>
      </div>
    </header>
  )
}

function ZeroHourWordmark() {
  return (
    <h1 className="hero-wordmark" aria-label="ZEROHOUR">
      <svg viewBox="-3 -4 432 78" aria-hidden="true" focusable="false">
        <path d="M0 3H45V13L15 56H45V66H0V56L30 13H0Z" />
        <path d="M53 3H94V13H64V28H88V38H64V56H94V66H53Z" />
        <path id="zero-hour-r" fillRule="evenodd" d="M102 3H137L147 13V34L137 44L150 66H137L124 44H113V66H102ZM113 13V34H132L136 30V17L132 13Z" />
        <g className="wordmark-counter" transform="translate(155)">
          <path className="wordmark-counter-top" d="M0 49V14L11 3H38L49 14V27L38 32V18L33 13H16L11 18V44Z" />
          <path className="wordmark-counter-bottom" d="M0 53L11 48V51L16 56H33L38 51V36L49 31V55L38 66H11L0 55Z" />
        </g>
        <g className="wordmark-hour">
          <path d="M215 3H226V28H250V3H261V66H250V38H226V66H215Z" />
          <g className="wordmark-counter" transform="translate(269)">
            <path className="wordmark-counter-top" d="M0 49V14L11 3H38L49 14V27L38 32V18L33 13H16L11 18V44Z" />
            <path className="wordmark-counter-bottom" d="M0 53L11 48V51L16 56H33L38 51V36L49 31V55L38 66H11L0 55Z" />
          </g>
          <path d="M326 3H337V50L343 56H355L361 50V3H372V55L361 66H337L326 55Z" />
          <use href="#zero-hour-r" x="276" />
        </g>
      </svg>
    </h1>
  )
}

function Hero() {
  function shiftMath(event) {
    if (event.pointerType !== "mouse") return
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty("--math-x", `${((event.clientX - bounds.left) / bounds.width - .5) * 18}px`)
  }

  return (
    <section className="hero">
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="hero-presenter">
            <ShunyaLogo />
            <p>SHUNYA RR CAMPUS <span>PRESENTS</span></p>
          </div>
          <div className="hero-title">
            <ZeroHourWordmark />
            <p className="tagline">  A 24 Hour Mathematics Hackathon</p>
          </div>
          <dl className="event-stamp">
            <div>
              <dt>DATE</dt>
              <dd>NOVEMBER 14 & 15,2026</dd>
            </div>
            <div>
              <dt>VENUE</dt>
              <dd>13TH FLOOR BE BLOCK, PES UNIVERSITY RR CAMPUS</dd>
            </div>
          </dl>
          <div className="hero-actions">
            <a
              className="button button-primary"
              href={PUBLIC_REGISTRATION_URL}
              target="_blank"
              rel="noreferrer"
            >
              REGISTER NOW <Arrow />
            </a>
            <a className="button button-ghost" href="#about">
              EXPLORE <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <figure className="hero-scene" onPointerMove={shiftMath}
          onPointerLeave={(event) => event.currentTarget.style.removeProperty("--math-x")}>
          <div className="hero-math" aria-hidden="true"><span>∫</span><span>π</span><span>∇</span></div>
          <AnamorphicInfinity />
        </figure>
      </div>
    </section>
  )
}

function About() {
  return (
    <section className="section about" id="about">
      <SectionHeading
        number="01"
        label="ABOUT ZEROHOUR"
        title="Where Mathematics Meets Innovation."
        text="ZeroHour 1.0 is a two-day state-level hackathon organized by SHUNYA, PES University, bringing together students passionate about mathematics, technology, programming, logical reasoning, and innovation."
      />
      <div className="about-layout">
        <div className="about-statement">
          <PhasePortrait />
          <p>
            Collaborate with your team, explore challenging problem domains, and turn analytical ideas into practical solutions through creativity, technical implementation, and teamwork.
          </p>
          <small>SHUNYA </small>
        </div>
        <div className="about-cards">
          <article>
            <span>01</span>
            <h3>Think Beyond Limits</h3>
            <p>Challenge conventional thinking and explore innovative approaches to complex problems.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Build Together</h3>
            <p>Combine your team's strengths to transform ambitious ideas into working solutions.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Make It Count</h3>
            <p>Push your technical abilities, demonstrate your creativity, and compete with ambitious minds.</p>
          </article>
        </div>
      </div>
    </section>
  )
}

function Details() {
  return (
    <section className="section details" id="details">
      <SectionHeading
        number="05"
        label="EVENT DETAILS"
        title="24 hours. Zero assumptions."
      />
      <div className="detail-grid">
        <article>
          <span>WHEN</span>
          <b>NOVEMBER</b>
          <strong>14—15, 2026</strong>
        </article>
        <article>
          <span>DURATION</span>
          <b>24</b>
          <strong>HOURS</strong>
        </article>

        <article><span>TEAM SIZE</span><b>3–4</b><strong>PEOPLE</strong></article>
        <article><span>VENUE</span><b>13TH FLOOR</b><strong>BE BLOCK</strong></article>
      </div>
    </section>
  )
}

function Registration() {
  return (
    <section className="registration">
      <span className="registration-infinity" aria-hidden="true">∞</span>
      <p>THE CLOCK STARTS NOW</p>
      <h2>
        READY TO QUESTION
        <br />
        <span>REALITY?</span>
      </h2>
      <a
        className="button button-primary button-large"
        href={PUBLIC_REGISTRATION_URL}
        target="_blank"
        rel="noreferrer"
      >
        REGISTER NOW <Arrow />
      </a>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="landing" id="home">
      <Header />
      <main>
        <MoireBackground />
        <Hero />
        <About />
        <section className="section zero-hour-concept" id="zero-hour">
          <SectionHeading number="02" label="THE ZERO HOUR" title="Before the code, the math." />
          <div className="about-statement">
            <PhasePortrait />
            <div className="zero-hour-copy">
              <p>At ZeroHour, innovation begins where conventional thinking ends.</p>
              <p>24 hours of intense problem-solving, bold ideas, and unexpected challenges await. Push your mathematical intuition, challenge your assumptions, and turn creativity into something extraordinary.</p>
              <p>But there's a twist. The first hour plays by different rules. Are you ready?</p>
            </div>
          </div>
        </section>
        <Tracks />
        <Competition />
        <Details />
        <ParticipantGuide />
        <Registration />
        <EventContact />
      </main>
      <SocialFooter />
    </div>
  )
}
