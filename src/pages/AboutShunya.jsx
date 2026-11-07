import { useLayoutEffect } from 'react';
import { Header } from './Landing';
import MoireBackground from '../components/MoireBackground';
import SocialFooter from '../components/SocialFooter';
import teamPhoto from '../assets/shunya-team.jpeg';
import './about-shunya.css';

function TeamPhoto() {
  return <figure className="shunya-card shunya-team">
    <img className="shunya-team-photo" src={teamPhoto} alt="The Shunya team posing together in a classroom" width="1280" height="1018" loading="lazy" />
    <figcaption><p className="shunya-label">THE TEAM</p><h2>Minds Behind Shunya</h2></figcaption>
  </figure>;
}

export default function AboutShunya() {
  useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  return <div className="landing shunya-about">
    <Header aboutPage />
    <main>
      <MoireBackground intensity="subtle" pattern="moire" />
      <div className="shunya-content">
        <header className="shunya-intro">
          <h1>About Shunya</h1>
          <p>The official mathematics club of PES University, exploring the beauty and practicality of mathematics.</p>
        </header>
        <section className="shunya-story" aria-label="Our beginning and team">
          <article className="shunya-card">
            <p className="shunya-label">THE BEGINNING</p>
            <h2>Founded on December 14, 2021</h2>
            <p>Shunya started with a simple idea: Mathematics is not just about numbers on a page; it’s a language that describes the universe.</p>
            <p>What began as a small group of enthusiasts has grown into the official mathematics club of PES University, spanning all three campuses.</p>
            <p>We are dedicated to breaking the myth that math is mundane or purely academic, discovering its practicality through workshops, research groups, and competitive events.</p>
          </article>
          <TeamPhoto />
        </section>
        <section className="shunya-community" aria-label="Our mission and community">
          <article className="shunya-card">
            <p className="shunya-label">OUR MISSION</p>
            <h2>To Explore, Analyze, and Create</h2>
            <p>We aim to promote mathematical literacy and analytical thinking through practical application. Whether it’s game theory in poker, the geometry of black holes, or the algorithms behind AI, we explore it all.</p>
          </article>
          <article className="shunya-card shunya-stat"><strong>3+</strong><h2>Campuses</h2><p>Across PES University</p></article>
          <article className="shunya-card shunya-stat"><strong>500+</strong><h2>Members</h2><p>Active Community</p></article>
        </section>
        <section className="shunya-card shunya-philosophy" aria-label="The Shunya philosophy">
          <blockquote>“Everything is nothing, and nothing is everything.”</blockquote>
          <p>The name “Shunya” (शून्य) represents zero — the void, the beginning, and infinite potential. It embodies our philosophy that from nothing comes everything, and in understanding the void, we unlock the universe.</p>
        </section>
      </div>
    </main>
    <SocialFooter />
  </div>;
}
