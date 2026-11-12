import logo from '../assets/shunya-logo.svg';
import './social-footer.css';

const socials = [
  { label: 'Instagram', href: 'https://www.instagram.com/shunya_pes/', path: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none" /></> },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/shunya-pes/', path: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 10v7M11 17v-7m0 3c0-4 6-4 6 0v4" /><circle cx="7" cy="7" r=".7" fill="currentColor" stroke="none" /></> },
  { label: 'Email Shunya', href: 'mailto:shunya@pes.edu', path: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></> },
];

export default function SocialFooter() {
  return <footer className="social-footer">
    <div className="social-footer-inner">
      <div>
        <a className="social-footer-brand" href="/" aria-label="SHUNYA — ZeroHour homepage">
          <img src={logo} alt="" width="40" height="40" /><strong>SHUNYA</strong>
        </a>
        <p>© 2026 SHUNYA. All rights reserved.</p>
      </div>
      <div className="social-footer-links" aria-label="Shunya social links">
        {socials.map(({label, href, path}) => <a key={href} href={href} aria-label={label}
          {...(href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
        </a>)}
      </div>
    </div>
  </footer>;
}
