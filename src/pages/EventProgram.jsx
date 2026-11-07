import { PUBLIC_REGISTRATION_URL } from "../components/Layouts"
import "./event-program.css"

export function SectionHeading({ number, label, title, text, id }) {
  return (
    <div className="section-heading">
      <div className="section-kicker"><span>{number}</span> {label}</div>
      <h2 id={id}>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  )
}

const tracks = [
  {
    title: "Quantitative Finance, FinTech & Risk Analytics",
    tagline: "Decode uncertainty. Model the future.",
    description: "Explore financial modelling, risk assessment, fraud detection, uncertainty analysis, and data-driven financial decision-making.",
    topics: ["Financial modelling", "Risk assessment", "Fraud detection", "Probability and statistical analysis"],
  },
  {
    title: "Cybersecurity, Cryptography & Network Intelligence",
    tagline: "Find patterns. Secure systems.",
    description: "Apply mathematical reasoning and computational techniques to cryptographic systems, secure communication, threat detection, and network intelligence.",
    topics: ["Cryptography", "Secure communication", "Threat detection", "Network analysis"],
  },
  {
    title: "Optimization, Graph Theory & Intelligent Systems",
    tagline: "Find the smartest path forward.",
    description: "Solve complex problems involving resource allocation, scheduling, routing, network optimization, and intelligent decision-making under constraints.",
    topics: ["Graph algorithms", "Routing and scheduling", "Resource allocation", "Mathematical optimization"],
  },
  {
    title: "AI, Computational Mathematics & Scientific Simulation",
    tagline: "Model complexity. Discover possibilities.",
    description: "Explore predictive modelling, machine learning, numerical methods, mathematical simulations, and data-driven computational systems.",
    topics: ["Machine learning", "Predictive modelling", "Numerical computation", "Scientific simulation"],
  },
]

const nodes = [[22, 67], [57, 30], [78, 93], [115, 54], [146, 25], [174, 76], [210, 48]]
const surfaceRows = Array.from({ length: 8 }, (_, row) =>
  Array.from({ length: 33 }, (_, column) => {
    const x = column * 6
    const y = 36 + row * 8 + 13 * Math.sin(column / 5 + row / 3)
    return [x + 22, y.toFixed(1)].join(",")
  }).join(" "),
)

function TrackArt({ index }) {
  return (
    <svg className="program-track-art" viewBox="0 0 232 124" aria-hidden="true" focusable="false">
      <path className="program-gridline" d="M12 104H220M12 75H220M12 46H220M12 17H220M40 10V112M92 10V112M144 10V112M196 10V112" />
      {index === 0 && <>
        <path d="M12 98C50 98 63 91 84 52S119 10 141 53 170 98 220 98" />
        <path className="program-signal" d="M12 100C60 100 79 94 106 64S146 25 163 60 194 100 220 100" />
        <path d="M12 83L44 79 65 87 93 67 119 74 155 47 176 57 220 34" />
      </>}
      {(index === 1 || index === 2) && <>
        <path d={index === 1
          ? "M22 67L57 30 115 54 78 93 22 67 115 54 146 25 210 48 174 76 115 54M57 30L146 25 174 76 78 93"
          : "M22 67L57 30 146 25 210 48M22 67L78 93 174 76 210 48M57 30L115 54 78 93M115 54L174 76 146 25"} />
        <path className="program-signal" d={index === 1 ? "M57 30L115 54 174 76" : "M22 67L57 30 115 54 174 76 210 48"} />
        {nodes.map(([x, y]) => <circle key={x} cx={x} cy={y} r={index === 1 ? 4 : 3} />)}
      </>}
      {index === 3 && surfaceRows.map((points, row) =>
        <polyline key={points} className={row === 3 ? "program-signal" : undefined} points={points} />,
      )}
    </svg>
  )
}

function Accordion({ title, children }) {
  return (
    <details className="program-disclosure">
      <summary>{title}</summary>
      <div className="program-answer">{children}</div>
    </details>
  )
}

export function Tracks() {
  return (
    <section className="section event-program" id="tracks" aria-labelledby="tracks-heading">
      <SectionHeading id="tracks-heading" number="03" label="EXPLORE THE TRACKS" title="Four Tracks. Infinite Possibilities."
        text="Four domains where mathematical reasoning meets technological innovation. Explore complex challenges, develop analytical approaches, and build solutions that make an impact." />
      <div className="program-tracks">
        {tracks.map(({ title, tagline, description, topics }, index) => (
          <article className="program-track" key={title}>
            <div className="program-track-figure"><span>0{index + 1}</span><TrackArt index={index} /></div>
            <h3>{title}</h3>
            <p className="program-tagline">{tagline}</p>
            <p>{description}</p>
            <Accordion title="Explore focus areas"><ul>{topics.map(topic => <li key={topic}>{topic}</li>)}</ul></Accordion>
          </article>
        ))}
      </div>
    </section>
  )
}

const rounds = [
  {
    title: "Online Submission & Evaluation",
    description: "Participants receive problem statements and submit their proposed solutions online. Entries are evaluated on feasibility, technical understanding, creativity, and problem-solving ability.",
    criteria: ["Solution quality and feasibility", "Technical approach", "Creativity and innovation", "Problem-solving ability"],
    outcome: "Shortlisted teams advance. Only shortlisted teams must pay the ₹600 registration fee before proceeding.",
  },
  {
    title: "Development & Coding",
    description: "Shortlisted teams develop and refine their solutions through coding, technical implementation, and mentor interactions.",
    criteria: ["Technical implementation", "Development progress", "Efficiency and performance", "Problem-solving approach"],
    outcome: "Selected teams advance to the final round.",
  },
  {
    title: "Final Coding & Evaluation",
    description: "Finalist teams demonstrate their completed solutions, explain their technical approaches, and compete for a place among the top three.",
    criteria: ["Technical proficiency", "Implementation quality", "Efficiency", "Creativity", "Overall problem-solving and presentation"],
    outcome: "The top three teams are selected as winners.",
  },
]

export function Competition() {
  return (
    <section className="section event-program" id="competition" aria-labelledby="competition-heading">
      <SectionHeading id="competition-heading" number="04" label="COMPETITION STRUCTURE" title="Three Rounds. One Final Challenge." />
      <ol className="program-roadmap">
        {rounds.map(({ title, description, criteria, outcome }, index) => (
          <li key={title}>
            <span className="program-round">ROUND 0{index + 1}</span>
            <h3>{title}</h3>
            <p>{description}</p>
            <p className="program-tagline">Evaluation focus</p>
            <ul>{criteria.map(criterion => <li key={criterion}>{criterion}</li>)}</ul>
            <p><strong>{outcome}</strong></p>
          </li>
        ))}
      </ol>
    </section>
  )
}

const features = [
  ["Mathematics Meets Technology", "Apply mathematical reasoning to real-world challenges across finance, cybersecurity, optimization, and AI."],
  ["Build Something Real", "Turn theoretical ideas and analytical approaches into practical technical implementations."],
  ["Mentorship & Collaboration", "Work with your team, receive technical feedback, and improve your solutions through mentor interactions."],
  ["Compete & Stand Out", "Demonstrate your technical abilities, creativity, and problem-solving skills in a competitive environment."],
]

const rules = [
  "Complete registration within the specified deadline.",
  "Follow prescribed team size and eligibility requirements.",
  "Submit original work developed by the team.",
  "No plagiarism, impersonation, or misrepresentation.",
  "Meet all submission deadlines.",
  "Follow organizing team instructions.",
  "Cooperate with mentors and evaluators.",
  "Judges’ and organizers’ decisions are final.",
  "Misconduct or rule violations may lead to disqualification.",
]

const evaluation = [
  "Technical proficiency and implementation", "Solution quality and feasibility", "Creativity and innovation",
  "Efficiency and optimization", "Logical reasoning and problem-solving", "Development and presentation",
]

const faqs = [
  ["What is ZeroHour?", "ZeroHour 1.0 is a two-day state-level mathematics and technology hackathon organized by SHUNYA, PES University."],
  ["When and where is the event?", "November 14–15, 2026, at the 13th Floor, BE Block, PES University."],
  ["How many people can participate in a team?", "Teams consist of 3–4 members."],
  ["What are the available tracks?", tracks.map(track => track.title).join("; ") + "."],
  ["How does the competition work?", "The competition includes an online submission and evaluation round, a development and coding round, and a final coding and evaluation round."],
  ["Is there a registration fee?", "Shortlisted teams must pay ₹600 before proceeding beyond the online preliminary round."],
  ["Will mentors be available?", "Yes. Mentor interactions and technical reviews will take place during the development stage."],
  ["How are winners selected?", "Teams are evaluated on technical proficiency, feasibility, creativity, efficiency, logical reasoning, implementation, and presentation. The top three teams will be recognized."],
  ["Where can I register?", <>Through the <a href={PUBLIC_REGISTRATION_URL} target="_blank" rel="noreferrer">official ZeroHour Unstop registration page</a>.</>],
]

export function ParticipantGuide() {
  return (
    <>
      <section className="section event-program" id="why-zerohour" aria-labelledby="why-heading">
        <SectionHeading id="why-heading" number="06" label="WHY ZEROHOUR?" title="Beyond the Code. Beyond the Ordinary." />
        <div className="program-features">
          {features.map(([title, description], index) => (
            <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>
          ))}
        </div>
      </section>
      <section className="section event-program" id="rules" aria-labelledby="rules-heading">
        <SectionHeading id="rules-heading" number="07" label="RULES & EVALUATION" title="The Rules of the Challenge." />
        <Accordion title="Competition rules"><ol>{rules.map(rule => <li key={rule}>{rule}</li>)}</ol></Accordion>
        <Accordion title="Evaluation criteria"><ul>{evaluation.map(criterion => <li key={criterion}>{criterion}</li>)}</ul></Accordion>
      </section>
      <section className="section event-program" id="prizes" aria-labelledby="prizes-heading">
        <SectionHeading id="prizes-heading" number="08" label="PRIZES & RECOGNITION" title="The Best Rise to the Top." />
        <ol className="program-podium">
          {["First Prize", "Second Prize", "Third Prize"].map((prize, index) => (
            <li key={prize}><span aria-hidden="true">0{index + 1}</span><strong>{prize}</strong></li>
          ))}
        </ol>
        <p>Additional prize pool and reward details will be communicated by the organizers.</p>
      </section>
      <section className="section event-program" id="faq" aria-labelledby="faq-heading">
        <SectionHeading id="faq-heading" number="09" label="FAQs" title="Good Questions." />
        {faqs.map(([question, answer]) => <Accordion key={question} title={question}><p>{answer}</p></Accordion>)}
      </section>
    </>
  )
}

export function EventContact() {
  return (
    <section className="section event-program program-contact" aria-labelledby="contact-heading">
      <h2 id="contact-heading">Event queries</h2>
      <ul>
        <li>Madhu Sripada <a href="tel:+918431353950">84313 53950</a></li>
        <li>Janhavi Rajpurohit <a href="tel:+919606825231">96068 25231</a></li>
        <li><a href="https://www.instagram.com/p/Dfbc2arTuQp/?psln=MTB3OHZ0dGNlbjI4OA==" target="_blank" rel="noreferrer">Official Instagram event post ↗</a></li>
      </ul>
    </section>
  )
}
